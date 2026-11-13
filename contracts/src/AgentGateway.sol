// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {MUSDash, IJuuPricer, IJuuLoop} from "./MUSDash.sol";
import {IPriceFeed} from "./interfaces/IMezo.sol";
import {JuuSplitter} from "./JuuSplitter.sol";

interface IJuuLoopSetter {
    function setLoopFor(address user, bool on, uint256 seriesId) external;
}

/// @title AgentGateway (Juu Agents)
/// @notice Lets a user's AI or trading agent play MUSDash for them under rules the user sets, without ever
///         holding the user's wallet key. The agent uses its own address (a session key); the user grants it a
///         session here:
///           - only MUSDash actions: open, close, climb, drop (and the Loop setting if allowed)
///           - max chips per bet and highest floor allowed
///           - daily loss limit: once today's realized losses reach it, the agent can't open or move until the
///             next UTC day (it can still close)
///           - expiry, and the user can revoke at any time; a revoked or expired session can do nothing
///
/// Funds: the user approves this gateway for MUSD (and for Y or P if the agent may use them). The gateway pulls
/// exactly what each action needs, holds the agent's positions in MUSDash, and forwards everything a position
/// returns (MUSD, chips, Y rewards) straight to the user. Agent positions are labelled on chain by the
/// AgentOpened/AgentClosed/AgentLiquidated events.
///
/// Agent fee: every agent action pays an extra fee on top of MUSDash's trading fee: a share of the position size
/// (with a minimum), split between the Buffer and the Bank (default 50/50). Both are settings.
contract AgentGateway is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Session {
        bool active;
        bool canSetLoop;
        uint8 maxFloor;
        uint64 expiry;
        uint64 day; // UTC day of lossToday
        uint256 maxChips; // MUSD value per bet
        uint256 dailyLossLimit; // MUSD
        uint256 lossToday; // MUSD
    }

    struct AgentPosition {
        address user;
        address agent;
        int256 cost; // MUSD value put in so far, minus value taken out before the end
        bool settled;
    }

    MUSDash public immutable game;
    IERC20 public immutable musd;
    JuuSplitter public immutable splitter;
    address public immutable buffer;
    address public immutable bank;
    IJuuLoop public loop;

    uint256 public agentFeeRate = 0.0005e18; // 0.05% of position size
    uint256 public agentFeeMin = 0.05e18; // MUSD
    uint256 public agentFeeToBuffer = 0.5e18; // the Bank gets the rest

    mapping(address => mapping(address => Session)) internal _sessions; // user => agent
    mapping(uint256 => AgentPosition) public positions;

    event SessionGranted(address indexed user, address indexed agent, uint256 maxChips, uint8 maxFloor, uint256 dailyLossLimit, uint64 expiry, bool canSetLoop);
    event SessionRevoked(address indexed user, address indexed agent);
    event AgentFeePaid(uint256 indexed positionId, address indexed user, address indexed agent, uint256 fee, uint256 toBuffer, uint256 toBank);
    event AgentOpened(uint256 indexed positionId, address indexed user, address indexed agent, MUSDash.Side side, uint8 floor, MUSDash.Chip chip, uint256 seriesId, uint256 value);
    event AgentMoved(uint256 indexed positionId, address indexed user, address indexed agent, uint8 fromFloor, uint8 toFloor);
    event AgentClosed(uint256 indexed positionId, address indexed user, address indexed agent, int256 cost, uint256 returned, int256 result);
    event AgentLiquidated(uint256 indexed positionId, address indexed user, address indexed agent, int256 cost, uint256 returned, int256 result);
    event AgentStopped(address indexed user, address indexed agent, uint256 day, uint256 lossToday);
    event AgentLoopSet(address indexed user, address indexed agent, bool on, uint256 seriesId);
    event Forwarded(uint256 indexed positionId, address indexed user, address token, uint256 amount);
    event SettingsChanged();

    error NoSession();
    error Expired();
    error StoppedForToday();
    error FloorTooHigh();
    error BetTooBig();
    error NotYourPosition();
    error AlreadySettled();
    error LoopNotAllowed();
    error BadValue();

    constructor(address game_, address buffer_, address bank_) Ownable(msg.sender) {
        game = MUSDash(game_);
        musd = game.musd();
        splitter = game.splitter();
        buffer = buffer_;
        bank = bank_;
    }

    // ---------------------------------------------------------------- settings

    function setAgentFee(uint256 rate, uint256 minFee, uint256 toBuffer) external onlyOwner {
        if (rate > 0.01e18 || toBuffer > 1e18) revert BadValue();
        agentFeeRate = rate;
        agentFeeMin = minFee;
        agentFeeToBuffer = toBuffer;
        emit SettingsChanged();
    }

    function setLoop(address loop_) external onlyOwner {
        loop = IJuuLoop(loop_);
        emit SettingsChanged();
    }

    // ---------------------------------------------------------------- users

    /// @notice Let `agent` play for you under these rules. Granting again replaces the rules.
    function grant(address agent, uint256 maxChips, uint8 maxFloor, uint256 dailyLossLimit, uint64 expiry, bool canSetLoop) external {
        if (maxFloor == 0 || maxFloor > 10 || expiry <= block.timestamp) revert BadValue();
        Session storage s = _sessions[msg.sender][agent];
        s.active = true;
        s.canSetLoop = canSetLoop;
        s.maxFloor = maxFloor;
        s.expiry = expiry;
        s.maxChips = maxChips;
        s.dailyLossLimit = dailyLossLimit;
        emit SessionGranted(msg.sender, agent, maxChips, maxFloor, dailyLossLimit, expiry, canSetLoop);
    }

    /// @notice Cancel an agent's session now.
    function revoke(address agent) external {
        _sessions[msg.sender][agent].active = false;
        emit SessionRevoked(msg.sender, agent);
    }

    // ---------------------------------------------------------------- agents

    /// @notice Agent opens a position with the user's MUSD.
    function openMUSD(address user, MUSDash.Side side, uint8 floor, uint256 margin) external nonReentrant returns (uint256 id) {
        Session storage s = _check(user, msg.sender, true);
        if (floor > s.maxFloor) revert FloorTooHigh();
        if (margin > s.maxChips) revert BetTooBig();
        uint256 size = (margin * game.leverage(floor - 1)) / 1e18;
        uint256 total = margin + (size * game.tradingFee()) / 1e18 + game.seatPremium(floor);
        uint256 fee = agentFee(size);

        uint256 before = musd.balanceOf(address(this));
        musd.safeTransferFrom(user, address(this), total + fee);
        musd.forceApprove(address(game), total);
        id = game.open(side, floor, margin);
        _payAgentFee(id, user, fee);
        // Refund anything the game did not take (for example if the premium switched off in this block).
        uint256 left = musd.balanceOf(address(this)) - before;
        if (left > 0) musd.safeTransfer(user, left);
        musd.forceApprove(address(game), 0);

        positions[id] = AgentPosition(user, msg.sender, int256(total - left + fee), false);
        emit AgentOpened(id, user, msg.sender, side, floor, MUSDash.Chip.MUSD, 0, margin);
    }

    /// @notice Agent opens a position with the user's Y or P chips (agent fee paid in MUSD).
    function openTokens(address user, MUSDash.Side side, uint8 floor, MUSDash.Chip chip, uint256 seriesId, uint256 amount)
        external
        nonReentrant
        returns (uint256 id)
    {
        Session storage s = _check(user, msg.sender, true);
        if (floor > s.maxFloor) revert FloorTooHigh();
        uint256 value = chip == MUSDash.Chip.Y ? game.pricer().yValue(seriesId, amount) : game.pricer().pValue(seriesId, amount);
        if (value > s.maxChips) revert BetTooBig();
        uint256 fee = agentFee((value * game.leverage(floor - 1)) / 1e18);
        IERC20 token = _chipToken(chip, seriesId);

        token.safeTransferFrom(user, address(this), amount);
        musd.safeTransferFrom(user, address(this), fee);
        token.forceApprove(address(game), amount);
        id = game.openWithTokens(side, floor, chip, seriesId, amount);
        _payAgentFee(id, user, fee);

        positions[id] = AgentPosition(user, msg.sender, int256(value + fee), false);
        emit AgentOpened(id, user, msg.sender, side, floor, chip, seriesId, value);
    }

    /// @notice Agent closes one of its positions. Everything it returns goes to the user (winnings to the Loop if
    ///         the user turned it on). Allowed even after the daily loss limit is hit.
    function close(uint256 id) external nonReentrant {
        AgentPosition storage a = _agentPos(id);
        _check(a.user, msg.sender, false);
        MUSDash.Position memory p = game.getPosition(id);
        uint256 fee = agentFee(p.size);
        musd.safeTransferFrom(a.user, address(this), fee);
        _payAgentFee(id, a.user, fee);

        (address[] memory tokens, uint256[] memory before) = _snapshot(p);
        game.close(id);
        uint256 returned = _forward(id, a.user, p, tokens, before, true);

        int256 result = int256(returned) - a.cost - int256(fee);
        a.settled = true;
        _bookResult(a.user, msg.sender, result);
        emit AgentClosed(id, a.user, msg.sender, a.cost + int256(fee), returned, result);
    }

    /// @notice The user closes a position their agent opened (for example after revoking the agent). No agent fee.
    function userClose(uint256 id) external nonReentrant {
        AgentPosition storage a = positions[id];
        if (a.user != msg.sender) revert NotYourPosition();
        if (a.settled) revert AlreadySettled();
        MUSDash.Position memory p = game.getPosition(id);
        (address[] memory tokens, uint256[] memory before) = _snapshot(p);
        game.close(id);
        uint256 returned = _forward(id, a.user, p, tokens, before, true);
        int256 result = int256(returned) - a.cost;
        a.settled = true;
        _bookResult(a.user, a.agent, result);
        emit AgentClosed(id, a.user, a.agent, a.cost, returned, result);
    }

    /// @notice Agent moves a position to another floor (climb or drop), within the user's highest floor.
    function moveFloor(uint256 id, uint8 toFloor) external nonReentrant {
        AgentPosition storage a = _agentPos(id);
        Session storage s = _check(a.user, msg.sender, true);
        if (toFloor > s.maxFloor) revert FloorTooHigh();
        MUSDash.Position memory p = game.getPosition(id);
        uint256 fee = agentFee(p.size);
        musd.safeTransferFrom(a.user, address(this), fee);
        _payAgentFee(id, a.user, fee);

        (address[] memory tokens, uint256[] memory before) = _snapshot(p);
        game.moveFloor(id, toFloor);
        uint256 returned = _forward(id, a.user, p, tokens, before, false);
        a.cost = a.cost + int256(fee) - int256(returned);
        emit AgentMoved(id, a.user, msg.sender, p.floor, toFloor);
    }

    /// @notice Agent turns the user's Loop on or off, if the user allowed it in the session.
    function setLoopFor(address user, bool on, uint256 seriesId) external nonReentrant {
        Session storage s = _check(user, msg.sender, false);
        if (!s.canSetLoop) revert LoopNotAllowed();
        musd.safeTransferFrom(user, address(this), agentFeeMin);
        _payAgentFee(0, user, agentFeeMin);
        IJuuLoopSetter(address(loop)).setLoopFor(user, on, seriesId);
        emit AgentLoopSet(user, msg.sender, on, seriesId);
    }

    /// @notice Collapse an agent position whose floor is due and forward what is left (rewards) to the user.
    ///         The keeper collapses agent positions through here.
    function liquidateAndForward(uint256 id) external nonReentrant {
        AgentPosition storage a = positions[id];
        if (a.user == address(0)) revert NotYourPosition();
        if (a.settled) revert AlreadySettled();
        MUSDash.Position memory p = game.getPosition(id);
        (address[] memory tokens, uint256[] memory before) = _snapshot(p);
        game.liquidate(id);
        uint256 returned = _forward(id, a.user, p, tokens, before, false);
        int256 result = int256(returned) - a.cost;
        a.settled = true;
        _bookResult(a.user, a.agent, result);
        emit AgentLiquidated(id, a.user, a.agent, a.cost, returned, result);
    }

    /// @notice Owner forwards tokens that reached the gateway outside the flows above (for example survivor
    ///         rewards when someone collapsed an agent position directly in MUSDash).
    function forwardStray(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
    }

    // ---------------------------------------------------------------- views

    function session(address user, address agent) external view returns (Session memory) {
        return _sessions[user][agent];
    }

    function positionUser(uint256 id) external view returns (address) {
        return positions[id].user;
    }

    function agentFee(uint256 size) public view returns (uint256) {
        uint256 f = (size * agentFeeRate) / 1e18;
        return f < agentFeeMin ? agentFeeMin : f;
    }

    // ---------------------------------------------------------------- internal

    function _check(address user, address agent, bool risk) internal returns (Session storage s) {
        s = _sessions[user][agent];
        if (!s.active) revert NoSession();
        if (block.timestamp >= s.expiry) revert Expired();
        uint64 today = uint64(block.timestamp / 1 days);
        if (s.day != today) {
            s.day = today;
            s.lossToday = 0;
        }
        if (risk && s.lossToday >= s.dailyLossLimit) revert StoppedForToday();
    }

    function _agentPos(uint256 id) internal view returns (AgentPosition storage a) {
        a = positions[id];
        if (a.agent != msg.sender) revert NotYourPosition();
        if (a.settled) revert AlreadySettled();
    }

    function _bookResult(address user, address agent, int256 result) internal {
        if (result >= 0) return;
        Session storage s = _sessions[user][agent];
        uint64 today = uint64(block.timestamp / 1 days);
        if (s.day != today) {
            s.day = today;
            s.lossToday = 0;
        }
        s.lossToday += uint256(-result);
        if (s.lossToday >= s.dailyLossLimit) emit AgentStopped(user, agent, today, s.lossToday);
    }

    function _payAgentFee(uint256 id, address user, uint256 fee) internal {
        uint256 toBuffer = (fee * agentFeeToBuffer) / 1e18;
        uint256 toBank = fee - toBuffer;
        if (toBuffer > 0) musd.safeTransfer(buffer, toBuffer);
        if (toBank > 0) musd.safeTransfer(bank, toBank);
        emit AgentFeePaid(id, user, msg.sender, fee, toBuffer, toBank);
    }

    function _chipToken(MUSDash.Chip chip, uint256 seriesId) internal view returns (IERC20) {
        if (chip == MUSDash.Chip.MUSD) return musd;
        JuuSplitter.Series memory s = splitter.getSeries(seriesId);
        return IERC20(chip == MUSDash.Chip.Y ? address(s.y) : address(s.p));
    }

    /// @dev Balances of every token a position can return: MUSD, its chip token and the Y reward tokens.
    function _snapshot(MUSDash.Position memory p) internal view returns (address[] memory tokens, uint256[] memory before) {
        address[] memory rewards = splitter.rewardTokenList();
        tokens = new address[](rewards.length + 1);
        tokens[0] = address(_chipToken(p.chip, p.seriesId));
        for (uint256 i = 0; i < rewards.length; i++) tokens[i + 1] = rewards[i];
        before = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) before[i] = IERC20(tokens[i]).balanceOf(address(this));
    }

    /// @dev Forwards what the game paid to the user and returns its MUSD value. On close, MUSD winnings (above the
    ///      MUSD chips returned) go to the Loop if the user turned it on.
    function _forward(uint256 id, address user, MUSDash.Position memory p, address[] memory tokens, uint256[] memory before, bool isClose)
        internal
        returns (uint256 value)
    {
        uint256 price = game.priceFeed().fetchPrice();
        address btc = address(splitter.btc());
        for (uint256 i = 0; i < tokens.length; i++) {
            if (i > 0 && tokens[i] == tokens[0]) continue; // chip token already handled (MUSD chips)
            uint256 got = IERC20(tokens[i]).balanceOf(address(this)) - before[i];
            if (got == 0) continue;
            if (tokens[i] == address(musd)) {
                value += got;
                uint256 chipsBack = (isClose && p.chip == MUSDash.Chip.MUSD) ? (got < p.tokens ? got : p.tokens) : 0;
                uint256 winnings = got - chipsBack;
                if (isClose && winnings > 0 && address(loop) != address(0) && loop.isOn(user)) {
                    musd.forceApprove(address(loop), winnings);
                    try loop.loopWinnings(user, winnings) {
                        got = chipsBack;
                    } catch {
                        musd.forceApprove(address(loop), 0);
                    }
                }
                if (got > 0) musd.safeTransfer(user, got);
            } else {
                if (tokens[i] == btc) value += (got * price) / 1e18;
                else if (i == 0) value += _chipValueNow(p, got);
                IERC20(tokens[i]).safeTransfer(user, got);
            }
            emit Forwarded(id, user, tokens[i], got);
        }
    }

    function _chipValueNow(MUSDash.Position memory p, uint256 amount) internal view returns (uint256) {
        IJuuPricer pr = game.pricer();
        return p.chip == MUSDash.Chip.Y ? pr.yValue(p.seriesId, amount) : pr.pValue(p.seriesId, amount);
    }
}
