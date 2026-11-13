// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IRouter, IPriceFeed} from "./interfaces/IMezo.sol";
import {JuuSplitter} from "./JuuSplitter.sol";

/// @title JuuLoop
/// @notice Turns a player's MUSD winnings into a bigger BTC lock. Each player turns it on or off for themselves
///         (off by default) and picks the series to grow.
///
/// Who can turn it on: players who came in through veBTC or plain BTC, i.e. who hold P or Y of the series they
/// pick at the moment they turn it on. Everyone else always gets MUSD.
///
/// When on, MUSDash (or the Agent Gateway, for an agent's winnings) hands the winnings here. The Loop swaps them
/// to BTC on Mezo's Router and zaps that BTC into the player's series, minting new P and Y to the player.
/// Price loss limit: the swap must return at least the oracle amount minus `maxSlippage`. If the swap would lose
/// more, or the series no longer takes deposits, the player gets the MUSD instead.
contract JuuLoop is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    JuuSplitter public immutable splitter;
    IRouter public immutable router;
    IPriceFeed public immutable priceFeed;
    IERC20 public immutable musd;
    IERC20 public immutable btc;
    address public immutable poolFactory;

    uint256 public maxSlippage = 0.12e18; // testnet: Mezo's MUSD/BTC pool sits ~10% from the oracle price
    mapping(address => bool) public callers; // MUSDash, Agent Gateway
    mapping(address => bool) public isOn;
    mapping(address => uint256) public seriesOf;

    event LoopSet(address indexed user, bool on, uint256 seriesId);
    event Looped(address indexed user, uint256 seriesId, uint256 musdIn, uint256 btcLocked);
    event PaidInstead(address indexed user, uint256 musdOut, string reason);
    event SettingsChanged();

    error NotEligible();
    error NotCaller();
    error OnlySelf();

    constructor(address splitter_, address router_, address priceFeed_, address musd_, address poolFactory_) Ownable(msg.sender) {
        splitter = JuuSplitter(payable(splitter_));
        router = IRouter(router_);
        priceFeed = IPriceFeed(priceFeed_);
        musd = IERC20(musd_);
        btc = splitter.btc();
        poolFactory = poolFactory_;
    }

    receive() external payable {}

    function setCaller(address caller, bool allowed) external onlyOwner {
        callers[caller] = allowed;
        emit SettingsChanged();
    }

    function setMaxSlippage(uint256 s) external onlyOwner {
        maxSlippage = s;
        emit SettingsChanged();
    }

    /// @notice Turn the Loop on (growing `seriesId`) or off for yourself.
    function setLoop(bool on, uint256 seriesId) external {
        _set(msg.sender, on, seriesId);
    }

    /// @notice The Agent Gateway sets the Loop for a user whose agent is allowed to (same eligibility rule).
    function setLoopFor(address user, bool on, uint256 seriesId) external {
        if (!callers[msg.sender]) revert NotCaller();
        _set(user, on, seriesId);
    }

    /// @notice Whether `user` may turn the Loop on for `seriesId`: they hold its P or Y and it takes deposits.
    function eligible(address user, uint256 seriesId) public view returns (bool) {
        JuuSplitter.Series memory s = splitter.getSeries(seriesId);
        return s.phase == JuuSplitter.Phase.Open && (s.p.balanceOf(user) > 0 || s.y.balanceOf(user) > 0);
    }

    /// @notice Pull `amount` MUSD winnings from the caller and loop them for `user` (or pay MUSD if that fails).
    function loopWinnings(address user, uint256 amount) external nonReentrant {
        if (!callers[msg.sender]) revert NotCaller();
        musd.safeTransferFrom(msg.sender, address(this), amount);
        if (!isOn[user]) return _payInstead(user, amount, "loop off");
        uint256 id = seriesOf[user];
        if (splitter.getSeries(id).phase != JuuSplitter.Phase.Open) return _payInstead(user, amount, "series closed");

        uint256 minOut = (((amount * 1e18) / priceFeed.fetchPrice()) * (1e18 - maxSlippage)) / 1e18;
        IRouter.Route[] memory route = new IRouter.Route[](1);
        route[0] = IRouter.Route(address(musd), address(btc), false, poolFactory);
        musd.forceApprove(address(router), amount);
        uint256 before = address(this).balance;
        try this.swapForLoop(amount, minOut, route) {} catch {
            musd.forceApprove(address(router), 0);
            return _payInstead(user, amount, "swap below price limit");
        }
        uint256 got = address(this).balance - before;
        // zap() pulls its own BTC from msg.value, minting P and Y to the user.
        try splitter.zap{value: got}(id, user) {
            emit Looped(user, id, amount, got);
        } catch {
            btc.safeTransfer(user, got);
            emit PaidInstead(user, 0, "zap failed, BTC sent");
        }
    }

    /// @dev External so a failed swap can be caught. Only callable by this contract.
    function swapForLoop(uint256 amount, uint256 minOut, IRouter.Route[] calldata route) external {
        if (msg.sender != address(this)) revert OnlySelf();
        router.swapExactTokensForTokens(amount, minOut, route, address(this), block.timestamp);
    }

    function _set(address user, bool on, uint256 seriesId) internal {
        if (on && !eligible(user, seriesId)) revert NotEligible();
        isOn[user] = on;
        seriesOf[user] = seriesId;
        emit LoopSet(user, on, seriesId);
    }

    function _payInstead(address user, uint256 amount, string memory reason) internal {
        musd.safeTransfer(user, amount);
        emit PaidInstead(user, amount, reason);
    }
}
