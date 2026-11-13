// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IVotingEscrow, IVoter, IRewardsDistributor} from "./interfaces/IMezo.sol";
import {PYToken, IYieldHook} from "./PYToken.sol";

/// @title JuuSplitter
/// @notice Splits BTC locked in Mezo's veBTC into P (principal) and Y (yield) tokens, grouped in series.
///
/// Series: Juu picks the end date (a Thursday 00:00 UTC, the day veBTC locks end on). It can be months away,
/// longer than veBTC's 30 day maximum lock. Each series keeps one veBTC lock (the "master" NFT):
///   Open       the master is a permanent lock, so its voting power stays at the maximum. Deposits allowed.
///   Unlocking  about 30 days before the end, anyone calls startUnlock. Mezo's unlockPermanent sets the lock
///              to end on the next Thursday at most 30 days out, which is the series end date when called in
///              the week that starts 30 days before it. Voting power then falls to zero by the end date.
///   Matured    after the end date, anyone calls mature. The BTC is withdrawn from Mezo; P holders redeem
///              1 P for 1 BTC. Any BTC above the principal (the weekly rebase that Mezo adds into the lock)
///              goes to Y holders.
/// The BTC stays in Juu (inside the series lock at Mezo) until the series end date.
///
/// Doors: deposit an existing veBTC NFT (Door 1) or send plain BTC (Door 4, zap). Both mint P and Y 1:1
/// with the BTC added.
///
/// Y earns: voting fees and bribes the master collects (any tokens listed as rewards), the BTC rebase paid
/// out after the lock expires, and the BTC surplus at maturity.
contract JuuSplitter is Ownable, ReentrancyGuard, IYieldHook {
    using SafeERC20 for IERC20;

    uint256 public constant WEEK = 7 days;
    uint8 internal constant NORMAL = 0;

    enum Phase {
        None,
        Open,
        Unlocking,
        Matured
    }

    struct Series {
        uint64 end; // series end date, Thursday 00:00 UTC
        uint64 lockEnd; // actual end of the veBTC lock once unlocking started
        Phase phase;
        uint256 masterId; // veBTC NFT holding this series' BTC, 0 until the first deposit
        uint256 principal; // BTC owed to P holders (equals P minted)
        uint256 pRate; // BTC paid per P after maturity, 1e18 = 1:1
        PYToken p;
        PYToken y;
    }

    struct RewardSource {
        address reward; // a gauge's fees or bribe reward contract
        address[] tokens; // tokens to claim from it
    }

    IVotingEscrow public immutable ve;
    IVoter public immutable voter;
    IRewardsDistributor public immutable distributor;
    IERC20 public immutable btc;
    uint256 public immutable maxLockTime; // veBTC maximum lock, 30 days on Mezo

    address public keeper;

    Series[] internal _series;
    RewardSource[] internal _sources;
    address[] public rewardTokens;
    mapping(address => bool) public isRewardToken;

    // Y yield bookkeeping, per series and reward token: running total per Y, what each holder already counted,
    // and what each holder can claim.
    mapping(uint256 => mapping(address => uint256)) public accPerY;
    mapping(uint256 => mapping(address => mapping(address => uint256))) public paidPerY;
    mapping(uint256 => mapping(address => mapping(address => uint256))) public owed;

    event KeeperSet(address keeper);
    event SeriesCreated(uint256 indexed id, uint64 end, address p, address y);
    event Deposited(uint256 indexed id, address indexed user, uint256 tokenId, uint256 amount);
    event Zapped(uint256 indexed id, address indexed payer, address indexed to, uint256 amount);
    event UnlockStarted(uint256 indexed id, uint64 lockEnd);
    event Matured(uint256 indexed id, uint256 received, uint256 surplus, uint256 pRate);
    event YieldCredited(uint256 indexed id, address indexed token, uint256 amount);
    event YieldClaimed(uint256 indexed id, address indexed user, address indexed token, uint256 amount);
    event PRedeemed(uint256 indexed id, address indexed user, uint256 pAmount, uint256 btcOut);
    event RewardSourceAdded(address reward, address[] tokens);
    event RewardSourceRemoved(address reward);

    error NotKeeper();
    error NotThursday();
    error EndTooSoon();
    error BadSeries();
    error WrongPhase();
    error DepositsClosed();
    error NotNormalLock();
    error EmptyLock();
    error LockExpired();
    error TooEarly();
    error ZeroAmount();
    error OnlyYToken();
    error NotMatured();

    constructor(address ve_, address voter_, address distributor_, uint256 maxLockTime_, address keeper_)
        Ownable(msg.sender)
    {
        ve = IVotingEscrow(ve_);
        voter = IVoter(voter_);
        distributor = IRewardsDistributor(distributor_);
        btc = IERC20(IVotingEscrow(ve_).token());
        maxLockTime = maxLockTime_;
        keeper = keeper_;
        _addRewardToken(address(btc));
    }

    receive() external payable {}

    modifier onlyKeeper() {
        if (msg.sender != keeper && msg.sender != owner()) revert NotKeeper();
        _;
    }

    // ---------------------------------------------------------------- admin

    function setKeeper(address keeper_) external onlyOwner {
        keeper = keeper_;
        emit KeeperSet(keeper_);
    }

    /// @notice Open a new series. `end` must be a Thursday 00:00 UTC whose unlock week has not passed:
    ///         unlocking lands on `end` only if done between end - maxLockTime and end - maxLockTime + 1 week.
    function createSeries(uint64 end, string calldata pName, string calldata pSymbol, string calldata yName, string calldata ySymbol)
        external
        onlyOwner
        returns (uint256 id)
    {
        if (end % WEEK != 0) revert NotThursday();
        if (block.timestamp + maxLockTime >= uint256(end) + WEEK) revert EndTooSoon();
        id = _series.length;
        PYToken p = new PYToken(pName, pSymbol, id, false);
        PYToken y = new PYToken(yName, ySymbol, id, true);
        _series.push(Series({end: end, lockEnd: 0, phase: Phase.Open, masterId: 0, principal: 0, pRate: 0, p: p, y: y}));
        emit SeriesCreated(id, end, address(p), address(y));
    }

    /// @notice Add a gauge reward contract (fees or bribe) whose tokens Y holders earn.
    function addRewardSource(address reward, address[] calldata tokens) external onlyOwner {
        _sources.push(RewardSource({reward: reward, tokens: tokens}));
        for (uint256 i = 0; i < tokens.length; i++) _addRewardToken(tokens[i]);
        emit RewardSourceAdded(reward, tokens);
    }

    function removeRewardSource(uint256 index) external onlyOwner {
        address reward = _sources[index].reward;
        _sources[index] = _sources[_sources.length - 1];
        _sources.pop();
        emit RewardSourceRemoved(reward);
    }

    // ---------------------------------------------------------------- doors

    /// @notice Door 1. Bring an existing veBTC NFT (approve this contract on veBTC first).
    ///         The NFT is folded into the series lock. If it voted this week, try again next week.
    ///         Rewards the NFT has not claimed yet go to Y holders, so claim them first.
    function deposit(uint256 id, uint256 tokenId) external nonReentrant {
        Series storage s = _openSeries(id);
        ve.transferFrom(msg.sender, address(this), tokenId);
        if (ve.escrowType(tokenId) != NORMAL) revert NotNormalLock();
        if (ve.voted(tokenId)) voter.reset(tokenId);

        IVotingEscrow.LockedBalance memory l = ve.locked(tokenId);
        if (l.amount <= 0) revert EmptyLock();
        uint256 amount = uint256(int256(l.amount));

        if (s.masterId == 0) {
            if (!l.isPermanent) {
                if (l.end <= block.timestamp) revert LockExpired();
                ve.lockPermanent(tokenId);
            }
            s.masterId = tokenId;
        } else {
            if (l.isPermanent) ve.unlockPermanent(tokenId);
            ve.merge(tokenId, s.masterId);
        }
        _mintPY(s, msg.sender, amount);
        emit Deposited(id, msg.sender, tokenId, amount);
    }

    /// @notice Door 4. Send BTC; it is locked into the series lock and `to` gets P and Y.
    function zap(uint256 id, address to) external payable nonReentrant {
        if (msg.value == 0) revert ZeroAmount();
        Series storage s = _openSeries(id);
        // veBTC pulls the BTC from this contract, so approve exactly this amount first.
        btc.forceApprove(address(ve), msg.value);
        if (s.masterId == 0) {
            s.masterId = ve.createLock(msg.value, maxLockTime);
            ve.lockPermanent(s.masterId);
        } else {
            ve.increaseAmount(s.masterId, msg.value);
        }
        _mintPY(s, to, msg.value);
        emit Zapped(id, msg.sender, to, msg.value);
    }

    // ---------------------------------------------------------------- series life cycle

    /// @notice Turn the permanent lock back into a normal one so it ends on the series end date.
    ///         Callable by anyone from 30 days before the end. Call it before the keeper votes that week.
    function startUnlock(uint256 id) external nonReentrant {
        Series storage s = _get(id);
        if (s.phase != Phase.Open) revert WrongPhase();
        if (block.timestamp < unlockFrom(id)) revert TooEarly();
        if (s.masterId == 0) {
            s.phase = Phase.Matured;
            s.pRate = 1e18;
            emit Matured(id, 0, 0, 1e18);
            return;
        }
        if (ve.voted(s.masterId)) voter.reset(s.masterId);
        ve.unlockPermanent(s.masterId);
        s.lockEnd = uint64(ve.locked(s.masterId).end);
        s.phase = Phase.Unlocking;
        emit UnlockStarted(id, s.lockEnd);
    }

    /// @notice After the lock has ended: collect the last rewards, withdraw the BTC from Mezo and open
    ///         P redemptions. Callable by anyone, from one hour after the end (Mezo's vote reset window).
    function mature(uint256 id) external nonReentrant {
        Series storage s = _get(id);
        if (s.phase != Phase.Unlocking) revert WrongPhase();
        if (block.timestamp < s.lockEnd) revert TooEarly();
        _harvest(id, s.masterId);
        if (ve.voted(s.masterId)) voter.reset(s.masterId);

        uint256 before = btc.balanceOf(address(this));
        ve.withdraw(s.masterId);
        uint256 received = btc.balanceOf(address(this)) - before;

        uint256 surplus;
        if (received >= s.principal) {
            s.pRate = 1e18;
            surplus = received - s.principal;
            if (surplus > 0) _credit(id, address(btc), surplus);
        } else {
            s.pRate = s.principal == 0 ? 1e18 : (received * 1e18) / s.principal;
        }
        s.phase = Phase.Matured;
        emit Matured(id, received, surplus, s.pRate);
    }

    /// @notice Burn P after maturity and receive BTC.
    function redeemP(uint256 id, uint256 amount) external nonReentrant {
        Series storage s = _get(id);
        if (s.phase != Phase.Matured) revert NotMatured();
        if (amount == 0) revert ZeroAmount();
        s.p.burn(msg.sender, amount);
        uint256 out = (amount * s.pRate) / 1e18;
        btc.safeTransfer(msg.sender, out);
        emit PRedeemed(id, msg.sender, amount, out);
    }

    // ---------------------------------------------------------------- yield

    /// @notice Collect voting fees, bribes and any paid-out rebase for a series and book them to Y holders.
    function harvest(uint256 id) external nonReentrant {
        Series storage s = _get(id);
        if (s.masterId == 0 || s.phase == Phase.Matured) revert WrongPhase();
        _harvest(id, s.masterId);
    }

    /// @notice Claim everything your Y tokens of a series have earned.
    function claimY(uint256 id) external nonReentrant {
        _get(id);
        _settle(id, msg.sender);
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            address t = rewardTokens[i];
            uint256 amt = owed[id][t][msg.sender];
            if (amt > 0) {
                owed[id][t][msg.sender] = 0;
                IERC20(t).safeTransfer(msg.sender, amt);
                emit YieldClaimed(id, msg.sender, t, amt);
            }
        }
    }

    /// @inheritdoc IYieldHook
    function onYTransfer(uint256 id, address from, address to) external {
        if (msg.sender != address(_series[id].y)) revert OnlyYToken();
        _settle(id, from);
        _settle(id, to);
    }

    // ---------------------------------------------------------------- voting (keeper)

    function vote(uint256 id, address[] calldata pools, uint256[] calldata weights) external onlyKeeper {
        voter.vote(_get(id).masterId, pools, weights);
    }

    function poke(uint256 id) external {
        voter.poke(_get(id).masterId);
    }

    // ---------------------------------------------------------------- views

    function seriesCount() external view returns (uint256) {
        return _series.length;
    }

    function getSeries(uint256 id) external view returns (Series memory) {
        return _get(id);
    }

    function rewardSources() external view returns (RewardSource[] memory) {
        return _sources;
    }

    function rewardTokenList() external view returns (address[] memory) {
        return rewardTokens;
    }

    /// @notice First moment startUnlock may be called: Mezo then sets the lock end to the series end date.
    function unlockFrom(uint256 id) public view returns (uint256) {
        return uint256(_get(id).end) - maxLockTime;
    }

    /// @notice Yield of `token` that `user` can claim now from series `id`.
    function pendingY(uint256 id, address user, address token) external view returns (uint256) {
        Series storage s = _get(id);
        uint256 d = accPerY[id][token] - paidPerY[id][token][user];
        return owed[id][token][user] + (s.y.balanceOf(user) * d) / 1e18;
    }

    /// @notice BTC locked for the series right now, including rebase Mezo has added to the lock.
    function lockedBTC(uint256 id) external view returns (uint256) {
        Series storage s = _get(id);
        if (s.masterId == 0 || s.phase == Phase.Matured) return 0;
        return uint256(int256(ve.locked(s.masterId).amount));
    }

    // ---------------------------------------------------------------- internal

    function _get(uint256 id) internal view returns (Series storage s) {
        if (id >= _series.length) revert BadSeries();
        s = _series[id];
    }

    function _openSeries(uint256 id) internal view returns (Series storage s) {
        s = _get(id);
        if (s.phase != Phase.Open) revert DepositsClosed();
    }

    function _mintPY(Series storage s, address to, uint256 amount) internal {
        s.principal += amount;
        s.p.mint(to, amount);
        s.y.mint(to, amount);
    }

    function _addRewardToken(address t) internal {
        if (!isRewardToken[t]) {
            isRewardToken[t] = true;
            rewardTokens.push(t);
        }
    }

    function _harvest(uint256 id, uint256 masterId) internal {
        uint256 n = rewardTokens.length;
        uint256[] memory before = new uint256[](n);
        for (uint256 i = 0; i < n; i++) before[i] = IERC20(rewardTokens[i]).balanceOf(address(this));

        // Each source is claimed on its own so one failing reward contract cannot block the rest.
        for (uint256 i = 0; i < _sources.length; i++) {
            address[] memory r = new address[](1);
            address[][] memory t = new address[][](1);
            r[0] = _sources[i].reward;
            t[0] = _sources[i].tokens;
            try voter.claimFees(r, t, masterId) {} catch {}
        }
        // While the lock runs, Mezo adds the rebase into the lock; after it ends, Mezo pays it out here.
        try distributor.claim(masterId) {} catch {}

        for (uint256 i = 0; i < n; i++) {
            uint256 gained = IERC20(rewardTokens[i]).balanceOf(address(this)) - before[i];
            if (gained > 0) _credit(id, rewardTokens[i], gained);
        }
    }

    function _credit(uint256 id, address token, uint256 amount) internal {
        uint256 supply = _series[id].y.totalSupply();
        if (supply == 0) return;
        accPerY[id][token] += (amount * 1e18) / supply;
        emit YieldCredited(id, token, amount);
    }

    function _settle(uint256 id, address user) internal {
        if (user == address(0)) return;
        uint256 bal = _series[id].y.balanceOf(user);
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            address t = rewardTokens[i];
            uint256 acc = accPerY[id][t];
            uint256 d = acc - paidPerY[id][t][user];
            if (d > 0) {
                if (bal > 0) owed[id][t][user] += (bal * d) / 1e18;
                paidPerY[id][t][user] = acc;
            }
        }
    }
}
