// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IMUSDSavingsRate} from "./interfaces/IMezo.sol";
import {PYToken, IYieldHook} from "./PYToken.sol";

/// @title JuuSavingsSplitter (Door 2: sMUSD)
/// @notice Splits Mezo's sMUSD into P and Y, grouped in series with the same end dates as the veBTC series.
///   P = the MUSD principal: after the end date, 1 P redeems for 1 MUSD.
///   Y = the savings yield sMUSD earns until the end date (Mezo pays it separately via claimYield).
/// On testnet, sMUSD is 1 per MUSD and its yield follows the holder, so 1 sMUSD deposited mints 1 P and 1 Y.
///
/// All series' sMUSD sits in this one contract. Yield is shared between series by sMUSD's own yield index:
/// each series earns principal x (index now - index when last booked), exactly what sMUSD credits for it.
contract JuuSavingsSplitter is Ownable, ReentrancyGuard, IYieldHook {
    using SafeERC20 for IERC20;

    uint256 public constant WEEK = 7 days;

    struct Series {
        uint64 end;
        bool matured;
        uint256 principal; // MUSD owed to P holders
        uint256 lastIndex; // sMUSD yield index when this series was last booked
        uint256 accPerY; // MUSD earned per Y, 1e18 scale
        PYToken p;
        PYToken y;
    }

    IMUSDSavingsRate public immutable smusd;
    IERC20 public immutable musd;
    Series[] internal _series;
    mapping(uint256 => mapping(address => uint256)) public paidPerY;
    mapping(uint256 => mapping(address => uint256)) public owed;
    uint256 public unbooked; // MUSD yield claimed from sMUSD and not yet booked to a series

    event SeriesCreated(uint256 indexed id, uint64 end, address p, address y);
    event Deposited(uint256 indexed id, address indexed user, uint256 amount);
    event YieldBooked(uint256 indexed id, uint256 amount);
    event YieldClaimed(uint256 indexed id, address indexed user, uint256 amount);
    event Matured(uint256 indexed id, uint256 principal);
    event PRedeemed(uint256 indexed id, address indexed user, uint256 amount);

    error NotThursday();
    error BadSeries();
    error Closed();
    error TooEarly();
    error NotMatured();
    error OnlyYToken();

    constructor(address smusd_, address musd_) Ownable(msg.sender) {
        smusd = IMUSDSavingsRate(smusd_);
        musd = IERC20(musd_);
    }

    function createSeries(uint64 end, string calldata pName, string calldata pSymbol, string calldata yName, string calldata ySymbol)
        external
        onlyOwner
        returns (uint256 id)
    {
        if (end % WEEK != 0) revert NotThursday();
        if (end <= block.timestamp) revert Closed();
        id = _series.length;
        PYToken p = new PYToken(pName, pSymbol, id, false);
        PYToken y = new PYToken(yName, ySymbol, id, true);
        _series.push(Series(end, false, 0, smusd.yieldIndex(), 0, p, y));
        emit SeriesCreated(id, end, address(p), address(y));
    }

    /// @notice Deposit sMUSD (approve this contract first) and get P and Y, one each per sMUSD.
    function deposit(uint256 id, uint256 amount) external nonReentrant {
        Series storage s = _get(id);
        if (s.matured || block.timestamp >= s.end) revert Closed();
        _book(id);
        IERC20(address(smusd)).safeTransferFrom(msg.sender, address(this), amount);
        s.principal += amount;
        s.p.mint(msg.sender, amount);
        s.y.mint(msg.sender, amount);
        emit Deposited(id, msg.sender, amount);
    }

    /// @notice Book the yield sMUSD has credited to a series so far.
    function harvest(uint256 id) external nonReentrant {
        _book(id);
    }

    /// @notice Claim the MUSD your Y has earned.
    function claimY(uint256 id) external nonReentrant {
        _book(id);
        _settle(id, msg.sender);
        uint256 amt = owed[id][msg.sender];
        if (amt > 0) {
            owed[id][msg.sender] = 0;
            musd.safeTransfer(msg.sender, amt);
            emit YieldClaimed(id, msg.sender, amt);
        }
    }

    /// @notice After the end date: book the last yield and turn the series' sMUSD back into MUSD for P holders.
    function mature(uint256 id) external nonReentrant {
        Series storage s = _get(id);
        if (block.timestamp < s.end) revert TooEarly();
        if (s.matured) revert Closed();
        _book(id);
        s.matured = true;
        if (s.principal > 0) {
            uint256 before = musd.balanceOf(address(this));
            smusd.withdraw(s.principal); // also pays out any yield sMUSD still owed to this contract
            uint256 extra = musd.balanceOf(address(this)) - before - s.principal;
            unbooked += extra;
        }
        emit Matured(id, s.principal);
    }

    /// @notice After maturity, burn P for MUSD 1:1.
    function redeemP(uint256 id, uint256 amount) external nonReentrant {
        Series storage s = _get(id);
        if (!s.matured) revert NotMatured();
        s.p.burn(msg.sender, amount);
        musd.safeTransfer(msg.sender, amount);
        emit PRedeemed(id, msg.sender, amount);
    }

    /// @inheritdoc IYieldHook
    function onYTransfer(uint256 id, address from, address to) external {
        if (msg.sender != address(_series[id].y)) revert OnlyYToken();
        _settle(id, from);
        _settle(id, to);
    }

    // ---------------------------------------------------------------- views

    function seriesCount() external view returns (uint256) {
        return _series.length;
    }

    function getSeries(uint256 id) external view returns (Series memory) {
        return _get(id);
    }

    function pendingY(uint256 id, address user) external view returns (uint256) {
        Series storage s = _get(id);
        uint256 acc = s.accPerY;
        uint256 supply = s.y.totalSupply();
        if (!s.matured && supply > 0) acc += (((s.principal * (smusd.yieldIndex() - s.lastIndex)) / 1e18) * 1e18) / supply;
        return owed[id][user] + (s.y.balanceOf(user) * (acc - paidPerY[id][user])) / 1e18;
    }

    // ---------------------------------------------------------------- internal

    function _get(uint256 id) internal view returns (Series storage) {
        if (id >= _series.length) revert BadSeries();
        return _series[id];
    }

    /// @dev Claims sMUSD yield into this contract and books this series' share by the yield index.
    function _book(uint256 id) internal {
        Series storage s = _get(id);
        uint256 got = smusd.claimYield();
        unbooked += got;
        if (s.matured) return;
        uint256 idx = smusd.yieldIndex();
        uint256 due = (s.principal * (idx - s.lastIndex)) / 1e18;
        s.lastIndex = idx;
        if (due > unbooked) due = unbooked;
        uint256 supply = s.y.totalSupply();
        if (due == 0 || supply == 0) return;
        unbooked -= due;
        s.accPerY += (due * 1e18) / supply;
        emit YieldBooked(id, due);
    }

    function _settle(uint256 id, address user) internal {
        if (user == address(0)) return;
        Series storage s = _series[id];
        uint256 d = s.accPerY - paidPerY[id][user];
        if (d > 0) owed[id][user] += (s.y.balanceOf(user) * d) / 1e18;
        paidPerY[id][user] = s.accPerY;
    }
}
