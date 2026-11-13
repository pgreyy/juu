// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPriceFeed} from "./interfaces/IMezo.sol";
import {JuuSplitter} from "./JuuSplitter.sol";

interface IJuuBank {
    function payOut(address to, uint256 amount) external;
    function maxExposure() external view returns (uint256);
    function liquidity() external view returns (uint256);
}

interface IJuuBuffer {
    function coverBadDebt(uint256 amount) external returns (uint256);
}

interface IJuuPricer {
    function yValue(uint256 id, uint256 amount) external view returns (uint256);
    function pValue(uint256 id, uint256 amount) external view returns (uint256);
}

interface IJuuLoop {
    function isOn(address user) external view returns (bool);
    function loopWinnings(address user, uint256 amount) external;
}

/// @title MUSDash (v4)
/// @notice The game. Bet on BTC going up (Bull) or down (Bear) on one of ten floors; higher floors use more
///         leverage. Positions are synthetic: priced by a BTC price feed and settled in MUSD.
///
/// Chips: MUSD, or Y or P of one Juu series, valued by the Pricer at every check. Rewards that posted Y earns
/// are credited to that position: they count in its value and are paid to the owner when it closes.
///
/// Money flow: every win or loss settles against the Bank. With both sides open, one side's losses fund the
/// other side's wins through the Bank, so the Bank only carries the gap, capped by its exposure limit. When a
/// Y or P position owes MUSD (fee, premium or loss), the Bank pays it and takes that value of chips.
///
/// Win cap and cash check: a bet can win at most maxWinShare (100%) of its size, so its worst-case win is known. A
/// new bet (or a climb to a bigger size) is refused if the Bank's MUSD on hand couldn't pay that worst-case win.
///
/// Floor collapse: at equity <= 2% of size. The penalty goes 50% to survivors on the same side (size x time),
/// 25% Buffer, 25% Bank. Bad debt is paid by the Buffer.
///
/// Climb Premium (floors 7 to 10): each new seat pays base x (1 + r)^(seats taken on that floor this epoch) on
/// top of its chips, shared by the positions already on that floor (by size). At the end of each epoch, if new
/// top-floor seats fell below the kill level (50%) of the epoch before, the premium switches off for good.
///
/// Jackpot tickets: every position earns size x time held, per epoch, written to a per-epoch ledger. After an
/// epoch ends, anyone seals it (checkpoint); the jackpot contract draws a ticket from the sealed ledger.
///
/// Loop: when a player has the Loop turned on, their MUSD winnings go to the Loop contract, which swaps them to
/// BTC and adds them to their series lock.
contract MUSDash is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint8 public constant FLOORS = 10;
    uint8 public constant TOP_FLOOR_FROM = 7;
    uint256 internal constant ACC = 1e36;
    uint256 internal constant DUST = 10; // wei kept back from Y reward shares against rounding

    enum Side {
        Bull,
        Bear
    }

    enum Chip {
        MUSD,
        Y,
        P
    }

    struct Position {
        address owner;
        Side side;
        uint8 floor;
        Chip chip;
        uint64 openedAt;
        uint64 ticketsFrom; // jackpot tickets counted up to here
        uint256 seriesId;
        uint256 tokens; // chips held: MUSD, or Y or P tokens
        uint256 size; // MUSD of BTC exposure
        uint256 entryPrice;
        int256 fundingIndex;
        uint256 accA; // survivor accumulators when opened
        uint256 accB;
        uint256 premiumAcc; // floor premium accumulator when opened
    }

    struct Ticket {
        address owner;
        uint64 positionId;
        uint256 cum; // cumulative tickets including this entry
    }

    IERC20 public immutable musd;
    IPriceFeed public immutable priceFeed;
    IJuuBank public immutable bank;
    IJuuBuffer public immutable buffer;
    IJuuPricer public immutable pricer;
    JuuSplitter public immutable splitter;
    uint256 public immutable epochLength; // Mezo epoch = 1 week; the demo deployment uses a short one
    address public treasury;
    address public loop;

    uint256[FLOORS] public leverage;
    uint256 public maintenanceMargin = 0.02e18;
    uint256 public tradingFee = 0.001e18;
    uint256 public minMargin = 10e18;
    uint256 public fundingK = 0.0001e18;
    uint256 public feeToBank = 0.5e18;
    uint256 public feeToBuffer = 0.3e18;
    uint256 public liqToSurvivors = 0.5e18;
    uint256 public liqToBuffer = 0.25e18;
    uint256 public premiumBase = 1e18; // MUSD for the first seat of an epoch
    uint256 public premiumGrowth = 0.1e18; // r
    uint256 public killLevel = 0.5e18;
    bool public premiumOn = true;
    uint256 public maxWinShare = 1e18; // a bet wins at most this share of its size (1e18 = 100%)

    uint256[2] public openInterest;
    int256[2] public fundingIndex;
    uint256 public lastFundingTime;
    uint256[2] public sizeTime;
    uint256[2] public accA;
    uint256[2] public accB;
    uint256[FLOORS + 1] public floorSize; // by floor number
    uint256[FLOORS + 1] public premiumAcc;

    mapping(uint256 => mapping(uint8 => uint256)) public seatsTaken; // epoch => floor => seats
    mapping(uint256 => uint256) public topSeats; // epoch => seats on floors 7-10
    mapping(uint256 => bool) public killChecked;

    mapping(uint256 => Ticket[]) internal _tickets;
    mapping(uint256 => bool) public epochSealed;
    mapping(uint256 => uint256) public sealBlock;

    uint256 public nextId = 1;
    mapping(uint256 => Position) internal _positions;
    uint256[] internal _openIds;
    mapping(uint256 => uint256) internal _openIndex;
    mapping(uint256 => mapping(address => uint256)) internal _ySnap; // position => reward token => accPerY

    event Opened(uint256 indexed id, address indexed owner, Side side, uint8 floor, Chip chip, uint256 seriesId, uint256 tokens, uint256 value, uint256 size, uint256 price);
    event Closed(uint256 indexed id, address indexed owner, int256 pnl, int256 funding, uint256 earned, uint256 musdOut, uint256 tokensOut, uint256 price);
    event Agaruzo(uint256 indexed id, address indexed owner, uint8 fromFloor, uint8 toFloor, uint256 value, uint256 size, uint256 price);
    event Dropped(uint256 indexed id, address indexed owner, uint8 fromFloor, uint8 toFloor, uint256 value, uint256 size, uint256 price);
    event FloorCollapsed(uint256 indexed id, address indexed owner, int256 equity, uint256 toSurvivors, uint256 toBuffer, uint256 toBank, uint256 badDebt, uint256 price);
    /// @notice Realized result of a step for the leaderboard, in MUSD: fees, premiums, gains, losses, rewards.
    event Result(uint256 indexed id, address indexed owner, int256 result);
    event ChipsToBank(uint256 indexed id, Chip chip, uint256 seriesId, uint256 tokens, uint256 musdValue);
    event SeatPremium(uint256 indexed id, uint8 floor, uint256 epoch, uint256 seat, uint256 premium, bool sharedWithFloor);
    event KillSwitch(uint256 epoch, uint256 seats, uint256 previousSeats);
    event Sealed(uint256 indexed epoch, uint256 totalTickets, uint256 entries);
    event Looped(uint256 indexed id, address indexed owner, uint256 amount);
    event FeePaid(uint256 toBank, uint256 toBuffer, uint256 toProtocol);
    event SettingsChanged();

    error BadFloor();
    error BadChip();
    error MarginTooSmall();
    error NotOwner();
    error NoPosition();
    error ExposureCap();
    error Liquidatable();
    error NotLiquidatable();
    error BadValue();
    error SameFloor();
    error EpochNotOver();
    error AlreadySealed();
    error BankCannotCoverWin();

    constructor(
        address musd_,
        address priceFeed_,
        address bank_,
        address buffer_,
        address pricer_,
        address splitter_,
        address treasury_,
        uint256 epochLength_
    ) Ownable(msg.sender) {
        musd = IERC20(musd_);
        priceFeed = IPriceFeed(priceFeed_);
        bank = IJuuBank(bank_);
        buffer = IJuuBuffer(buffer_);
        pricer = IJuuPricer(pricer_);
        splitter = JuuSplitter(payable(splitter_));
        treasury = treasury_;
        epochLength = epochLength_;
        leverage = [uint256(1.5e18), 2e18, 3e18, 4e18, 5e18, 6e18, 7e18, 8e18, 9e18, 10e18];
        lastFundingTime = block.timestamp;
    }

    // ---------------------------------------------------------------- admin

    function setLeverage(uint256[FLOORS] calldata lev) external onlyOwner {
        for (uint256 i = 0; i < FLOORS; i++) if (lev[i] < 1e18) revert BadValue();
        leverage = lev;
        emit SettingsChanged();
    }

    function setRisk(uint256 maintenance, uint256 fee, uint256 minMargin_, uint256 k) external onlyOwner {
        if (maintenance >= 0.1e18 || fee >= 0.01e18) revert BadValue();
        _updateFunding();
        maintenanceMargin = maintenance;
        tradingFee = fee;
        minMargin = minMargin_;
        fundingK = k;
        emit SettingsChanged();
    }

    function setSplits(uint256 feeBank, uint256 feeBuffer, uint256 liqSurvivors, uint256 liqBuffer) external onlyOwner {
        if (feeBank + feeBuffer > 1e18 || liqSurvivors + liqBuffer > 1e18) revert BadValue();
        feeToBank = feeBank;
        feeToBuffer = feeBuffer;
        liqToSurvivors = liqSurvivors;
        liqToBuffer = liqBuffer;
        emit SettingsChanged();
    }

    function setPremium(uint256 base, uint256 growth, uint256 killLevel_) external onlyOwner {
        if (killLevel_ > 1e18 || growth > 1e18) revert BadValue();
        premiumBase = base;
        premiumGrowth = growth;
        killLevel = killLevel_;
        emit SettingsChanged();
    }

    function setMaxWinShare(uint256 share) external onlyOwner {
        if (share == 0) revert BadValue();
        maxWinShare = share;
        emit SettingsChanged();
    }

    /// @notice The most a bet of `size` can win, which the Bank must hold in MUSD to accept it.
    function worstCaseWin(uint256 size) public view returns (uint256) {
        return (size * maxWinShare) / 1e18;
    }

    function setTreasury(address treasury_) external onlyOwner {
        treasury = treasury_;
        emit SettingsChanged();
    }

    function setLoop(address loop_) external onlyOwner {
        loop = loop_;
        emit SettingsChanged();
    }

    // ---------------------------------------------------------------- play

    /// @notice Open with MUSD chips. Approve margin + trading fee + seat premium (floors 7-10) first.
    function open(Side side, uint8 floor, uint256 margin) external nonReentrant returns (uint256 id) {
        if (floor == 0 || floor > FLOORS) revert BadFloor();
        if (margin < minMargin) revert MarginTooSmall();
        _updateFunding();
        uint256 price = priceFeed.fetchPrice();
        uint256 size = (margin * leverage[floor - 1]) / 1e18;
        uint256 fee = (size * tradingFee) / 1e18;
        id = nextId++;
        uint256 premium = _takeSeat(id, floor);

        musd.safeTransferFrom(msg.sender, address(this), margin + fee + premium);
        _payFee(fee);
        _payPremium(floor, premium);

        _start(id, _newPosition(msg.sender, side, floor, Chip.MUSD, 0, margin, size, price));
        emit Opened(id, msg.sender, side, floor, Chip.MUSD, 0, margin, margin, size, price);
        emit Result(id, msg.sender, -int256(fee + premium));
    }

    /// @notice Open with Y or P chips. Approve the token first. Fee and premium are paid by the Bank, which takes
    ///         that value of chips.
    function openWithTokens(Side side, uint8 floor, Chip chip, uint256 seriesId, uint256 amount)
        external
        nonReentrant
        returns (uint256 id)
    {
        if (floor == 0 || floor > FLOORS) revert BadFloor();
        if (chip == Chip.MUSD) revert BadChip();
        _updateFunding();
        uint256 price = priceFeed.fetchPrice();
        _chipToken(chip, seriesId).safeTransferFrom(msg.sender, address(this), amount);

        id = nextId++;
        uint256 value = _tokenValue(chip, seriesId, amount);
        uint256 size = (value * leverage[floor - 1]) / 1e18;
        uint256 fee = (size * tradingFee) / 1e18;
        uint256 premium = _takeSeat(id, floor);
        if (value < minMargin + fee + premium) revert MarginTooSmall();
        uint256 sold = _sellChipsToBank(id, chip, seriesId, amount, value, fee + premium);
        _payFee(fee);
        _payPremium(floor, premium);

        _start(id, _newPosition(msg.sender, side, floor, chip, seriesId, amount - sold, size, price));
        emit Opened(id, msg.sender, side, floor, chip, seriesId, amount - sold, value - fee - premium, size, price);
        emit Result(id, msg.sender, -int256(fee + premium));
    }

    /// @notice Close: chips back, plus gains, survivor and premium earnings and Y rewards, minus the fee.
    function close(uint256 id) external nonReentrant {
        Position memory p = _mine(id);
        _updateFunding();
        uint256 price = priceFeed.fetchPrice();
        Valued memory v = _value(id, p, price);
        if (_isLiquidatable(p, v.equity)) revert Liquidatable();
        _finish(id, p);

        uint256 fee = (p.size * tradingFee) / 1e18;
        (uint256 cashOut, uint256 tokensLeft) = _settle(id, p, v, fee);
        _payFee(fee);
        _payCash(id, p.owner, cashOut);
        if (tokensLeft > 0) _chipToken(p.chip, p.seriesId).safeTransfer(p.owner, tokensLeft);
        _sendYExtras(v, p.owner);
        emit Closed(id, p.owner, v.pnl, v.funding, v.earned, cashOut, tokensLeft, price);
        emit Result(id, p.owner, v.pnl - v.funding - int256(fee) + int256(v.earned + v.yMusd + v.yOtherValue));
    }

    /// @notice Move to another floor: book the result, then the same chips sit on the new floor at today's price.
    ///         Arriving on floors 7-10 pays the seat premium. Climbing is the Agaruzo moment.
    function moveFloor(uint256 id, uint8 toFloor) external nonReentrant {
        if (toFloor == 0 || toFloor > FLOORS) revert BadFloor();
        Position memory p = _mine(id);
        if (toFloor == p.floor) revert SameFloor();
        _updateFunding();
        uint256 price = priceFeed.fetchPrice();
        Valued memory v = _value(id, p, price);
        if (_isLiquidatable(p, v.equity)) revert Liquidatable();
        _finish(id, p);

        uint256 fee = (p.size * tradingFee) / 1e18;
        uint256 premium = _takeSeat(id, toFloor);
        (uint256 cashOut, uint256 tokensLeft) = _settle(id, p, v, fee + premium);
        _payFee(fee);
        _payPremium(toFloor, premium);
        if (p.chip == Chip.MUSD) tokensLeft += cashOut;
        else _payCash(id, p.owner, cashOut);
        _sendYExtras(v, p.owner);

        uint256 value = _tokenValue(p.chip, p.seriesId, tokensLeft);
        if (value < minMargin) revert MarginTooSmall();
        uint256 size = (value * leverage[toFloor - 1]) / 1e18;
        _start(id, _newPosition(p.owner, p.side, toFloor, p.chip, p.seriesId, tokensLeft, size, price));

        if (toFloor > p.floor) emit Agaruzo(id, p.owner, p.floor, toFloor, value, size, price);
        else emit Dropped(id, p.owner, p.floor, toFloor, value, size, price);
        emit Result(id, p.owner, v.pnl - v.funding - int256(fee + premium) + int256(v.earned + v.yMusd + v.yOtherValue));
    }

    /// @notice Collapse a floor whose equity has fallen to the maintenance margin. Anyone can call it.
    function liquidate(uint256 id) external nonReentrant {
        Position memory p = _positions[id];
        if (p.owner == address(0)) revert NoPosition();
        _updateFunding();
        uint256 price = priceFeed.fetchPrice();
        Valued memory v = _value(id, p, price);
        if (!_isLiquidatable(p, v.equity)) revert NotLiquidatable();
        _finish(id, p);

        uint256 chipValue = v.tokenValue + v.yMusd + v.yOtherValue;
        Split memory s;
        if (v.equity >= 0) {
            uint256 e = uint256(v.equity);
            s.toSurvivors = (e * liqToSurvivors) / 1e18;
            s.toBuffer = (e * liqToBuffer) / 1e18;
            s.toBank = e - s.toSurvivors - s.toBuffer;
            if (!_creditSurvivors(p.side, s.toSurvivors)) {
                s.toBank += s.toSurvivors;
                s.toSurvivors = 0;
            }
            // MUSD chips always hold more than the penalty; a Y or P position's chips are all handed to the Bank.
            if (chipValue > e) s.toBank += chipValue - e;
        } else {
            s.toBank = chipValue;
            s.badDebt = uint256(-v.equity);
        }

        if (p.chip == Chip.MUSD) {
            if (s.toBank > 0) musd.safeTransfer(address(bank), s.toBank);
        } else {
            // All chips (and the Y rewards credited to them) go to the Bank; it pays the survivors' and the
            // Buffer's shares in MUSD.
            if (p.tokens > 0) _chipToken(p.chip, p.seriesId).safeTransfer(address(bank), p.tokens);
            for (uint256 i = 0; i < v.yTokens.length; i++) {
                if (v.yAmounts[i] > 0) IERC20(v.yTokens[i]).safeTransfer(address(bank), v.yAmounts[i]);
            }
            emit ChipsToBank(id, p.chip, p.seriesId, p.tokens, chipValue);
            if (s.toSurvivors + s.toBuffer > 0) bank.payOut(address(this), s.toSurvivors + s.toBuffer);
        }
        if (s.toBuffer > 0) musd.safeTransfer(address(buffer), s.toBuffer);
        if (s.badDebt > 0) buffer.coverBadDebt(s.badDebt);
        if (v.earned > 0) musd.safeTransfer(p.owner, v.earned);
        emit FloorCollapsed(id, p.owner, v.equity, s.toSurvivors, s.toBuffer, s.toBank, s.badDebt, price);
        emit Result(id, p.owner, int256(v.earned) - int256(chipValue));
    }

    /// @notice Bring funding up to date (the keeper calls this hourly; every action also does it).
    function updateFunding() external {
        _updateFunding();
    }

    /// @notice Check the Climb Premium kill switch for the epoch that just ended (also checked on every seat).
    function checkKillSwitch() external {
        _checkKill();
    }

    /// @notice Seal a finished epoch's jackpot tickets: count every open position up to the epoch's end.
    function checkpoint(uint256 epoch) external nonReentrant {
        uint256 end = (epoch + 1) * epochLength;
        if (block.timestamp < end) revert EpochNotOver();
        if (epochSealed[epoch]) revert AlreadySealed();
        for (uint256 i = 0; i < _openIds.length; i++) {
            Position storage p = _positions[_openIds[i]];
            if (p.ticketsFrom < end) p.ticketsFrom = uint64(_accrueTickets(_openIds[i], p.owner, p.size, p.ticketsFrom, end));
        }
        epochSealed[epoch] = true;
        sealBlock[epoch] = block.number;
        emit Sealed(epoch, totalTickets(epoch), _tickets[epoch].length);
    }

    // ---------------------------------------------------------------- views

    function getPosition(uint256 id) external view returns (Position memory) {
        return _positions[id];
    }

    function openPositionIds() external view returns (uint256[] memory) {
        return _openIds;
    }

    function openCount() external view returns (uint256) {
        return _openIds.length;
    }

    struct Live {
        uint256 tokenValue;
        uint256 yRewardValue;
        int256 pnl;
        int256 funding;
        int256 equity;
        uint256 earned; // survivor rewards + seat premiums earned
        bool liquidatable;
        uint256 liquidationPrice;
    }

    /// @notice Live numbers for a position at the current price.
    function positionValue(uint256 id) external view returns (Live memory l) {
        Position memory p = _positions[id];
        if (p.owner == address(0)) revert NoPosition();
        uint256 price = priceFeed.fetchPrice();
        int256[2] memory idx = _fundingPreview();
        l.tokenValue = _tokenValue(p.chip, p.seriesId, p.tokens);
        (,, uint256 yMusd, uint256 yOther) = _yRewards(id, p, price);
        l.yRewardValue = yMusd + yOther;
        l.pnl = _pnl(p, price);
        l.funding = (int256(p.size) * (idx[uint8(p.side)] - p.fundingIndex)) / 1e18;
        l.equity = int256(l.tokenValue + l.yRewardValue) + l.pnl - l.funding;
        l.earned = _reward(p) + _premiumEarned(p);
        l.liquidatable = _isLiquidatable(p, l.equity);
        // Price where equity = maintenance, holding chip value fixed.
        int256 need = int256((p.size * maintenanceMargin) / 1e18) - int256(l.tokenValue + l.yRewardValue) + l.funding;
        int256 move = (int256(p.entryPrice) * need) / int256(p.size);
        int256 lp = p.side == Side.Bull ? int256(p.entryPrice) + move : int256(p.entryPrice) - move;
        l.liquidationPrice = lp > 0 ? uint256(lp) : 0;
    }

    function fundingRates() external view returns (int256 bull, int256 bear) {
        int256 r = _ratePerHour();
        return (r, -r);
    }

    function imbalance() public view returns (uint256) {
        return openInterest[0] > openInterest[1] ? openInterest[0] - openInterest[1] : openInterest[1] - openInterest[0];
    }

    function currentEpoch() public view returns (uint256) {
        return block.timestamp / epochLength;
    }

    /// @notice What the next seat on `floor` pays now (0 below floor 7 or once the kill switch is off).
    function seatPremium(uint8 floor) external view returns (uint256) {
        if (floor < TOP_FLOOR_FROM || floor > FLOORS || !premiumOn) return 0;
        return _premiumFor(seatsTaken[currentEpoch()][floor]);
    }

    function totalTickets(uint256 epoch) public view returns (uint256) {
        uint256 n = _tickets[epoch].length;
        return n == 0 ? 0 : _tickets[epoch][n - 1].cum;
    }

    function ticketCount(uint256 epoch) external view returns (uint256) {
        return _tickets[epoch].length;
    }

    function ticketAt(uint256 epoch, uint256 i) external view returns (Ticket memory) {
        return _tickets[epoch][i];
    }

    /// @notice The ticket entry holding ticket number `r` (0-based) of `epoch`.
    function findTicket(uint256 epoch, uint256 r) external view returns (address owner, uint256 positionId) {
        Ticket[] storage t = _tickets[epoch];
        uint256 lo = 0;
        uint256 hi = t.length;
        while (lo < hi) {
            uint256 mid = (lo + hi) / 2;
            if (t[mid].cum > r) hi = mid;
            else lo = mid + 1;
        }
        return (t[lo].owner, t[lo].positionId);
    }

    // ---------------------------------------------------------------- internal: positions

    struct Valued {
        uint256 tokenValue;
        uint256 yMusd;
        uint256 yOtherValue;
        address[] yTokens;
        uint256[] yAmounts;
        int256 pnl;
        int256 funding;
        int256 equity;
        uint256 earned;
    }

    struct Split {
        uint256 toSurvivors;
        uint256 toBuffer;
        uint256 toBank;
        uint256 badDebt;
    }

    function _newPosition(address owner_, Side side, uint8 floor, Chip chip, uint256 seriesId, uint256 tokens, uint256 size, uint256 price)
        internal
        pure
        returns (Position memory p)
    {
        p.owner = owner_;
        p.side = side;
        p.floor = floor;
        p.chip = chip;
        p.seriesId = seriesId;
        p.tokens = tokens;
        p.size = size;
        p.entryPrice = price;
    }

    function _mine(uint256 id) internal view returns (Position memory p) {
        p = _positions[id];
        if (p.owner == address(0)) revert NoPosition();
        if (p.owner != msg.sender) revert NotOwner();
    }

    function _start(uint256 id, Position memory p) internal {
        uint256 gapBefore = imbalance();
        uint8 s = uint8(p.side);
        openInterest[s] += p.size;
        sizeTime[s] += p.size * block.timestamp;
        floorSize[p.floor] += p.size;
        uint256 gapAfter = imbalance();
        if (gapAfter > gapBefore && gapAfter > bank.maxExposure()) revert ExposureCap();
        if (bank.liquidity() < worstCaseWin(p.size)) revert BankCannotCoverWin();

        p.openedAt = uint64(block.timestamp);
        p.ticketsFrom = uint64(block.timestamp);
        p.fundingIndex = fundingIndex[s];
        p.accA = accA[s];
        p.accB = accB[s];
        p.premiumAcc = premiumAcc[p.floor];
        _positions[id] = p;
        _openIds.push(id);
        _openIndex[id] = _openIds.length;
        if (p.chip == Chip.Y) {
            address[] memory t = splitter.rewardTokenList();
            for (uint256 i = 0; i < t.length; i++) _ySnap[id][t[i]] = splitter.accPerY(p.seriesId, t[i]);
        }
    }

    /// @dev Ends a position's life in the books: jackpot tickets, Y rewards claimed, removed from open interest.
    function _finish(uint256 id, Position memory p) internal {
        _accrueTickets(id, p.owner, p.size, p.ticketsFrom, block.timestamp);
        if (p.chip == Chip.Y) splitter.claimY(p.seriesId);
        uint8 s = uint8(p.side);
        openInterest[s] -= p.size;
        sizeTime[s] -= p.size * p.openedAt;
        floorSize[p.floor] -= p.size;
        delete _positions[id];
        uint256 i = _openIndex[id] - 1;
        uint256 last = _openIds[_openIds.length - 1];
        _openIds[i] = last;
        _openIndex[last] = i + 1;
        _openIds.pop();
        delete _openIndex[id];
    }

    function _pnl(Position memory p, uint256 price) internal view returns (int256 pnl) {
        int256 move = int256(price) - int256(p.entryPrice);
        if (p.side == Side.Bear) move = -move;
        pnl = (int256(p.size) * move) / int256(p.entryPrice);
        int256 cap = int256(worstCaseWin(p.size));
        if (pnl > cap) pnl = cap;
    }

    function _value(uint256 id, Position memory p, uint256 price) internal view returns (Valued memory v) {
        v.tokenValue = _tokenValue(p.chip, p.seriesId, p.tokens);
        (v.yTokens, v.yAmounts, v.yMusd, v.yOtherValue) = _yRewards(id, p, price);
        v.pnl = _pnl(p, price);
        v.funding = (int256(p.size) * (fundingIndex[uint8(p.side)] - p.fundingIndex)) / 1e18;
        v.equity = int256(v.tokenValue + v.yMusd + v.yOtherValue) + v.pnl - v.funding;
        v.earned = _reward(p) + _premiumEarned(p);
    }

    function _isLiquidatable(Position memory p, int256 equity) internal view returns (bool) {
        return equity <= int256((p.size * maintenanceMargin) / 1e18);
    }

    // ---------------------------------------------------------------- internal: chips and Y rewards

    function _chipToken(Chip chip, uint256 seriesId) internal view returns (IERC20) {
        if (chip == Chip.MUSD) return musd;
        JuuSplitter.Series memory s = splitter.getSeries(seriesId);
        return IERC20(chip == Chip.Y ? address(s.y) : address(s.p));
    }

    function _tokenValue(Chip chip, uint256 seriesId, uint256 tokens) internal view returns (uint256) {
        if (tokens == 0) return 0;
        if (chip == Chip.MUSD) return tokens;
        if (chip == Chip.Y) return pricer.yValue(seriesId, tokens);
        return pricer.pValue(seriesId, tokens);
    }

    /// @dev Rewards a Y position has earned since it was opened, per reward token, and their value (MUSD 1:1,
    ///      BTC at price, other tokens not valued).
    function _yRewards(uint256 id, Position memory p, uint256 price)
        internal
        view
        returns (address[] memory tokens, uint256[] memory amounts, uint256 musdAmount, uint256 otherValue)
    {
        if (p.chip != Chip.Y) return (tokens, amounts, 0, 0);
        tokens = splitter.rewardTokenList();
        amounts = new uint256[](tokens.length);
        address btc = address(splitter.btc());
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 d = splitter.accPerY(p.seriesId, tokens[i]) - _ySnap[id][tokens[i]];
            uint256 a = (p.tokens * d) / 1e18;
            a = a > DUST ? a - DUST : 0;
            amounts[i] = a;
            if (tokens[i] == address(musd)) musdAmount = a;
            else if (tokens[i] == btc) otherValue += (a * price) / 1e18;
        }
    }

    /// @dev Pays a closing or moving Y position's non-MUSD rewards (BTC, MEZO) to its owner. MUSD rewards are
    ///      part of the cash result.
    function _sendYExtras(Valued memory v, address to) internal {
        for (uint256 i = 0; i < v.yTokens.length; i++) {
            if (v.yTokens[i] != address(musd) && v.yAmounts[i] > 0) IERC20(v.yTokens[i]).safeTransfer(to, v.yAmounts[i]);
        }
    }

    function _sellChipsToBank(uint256 id, Chip chip, uint256 seriesId, uint256 tokens, uint256 value, uint256 musdAmount)
        internal
        returns (uint256 taken)
    {
        if (musdAmount == 0) return 0;
        taken = (tokens * musdAmount + value - 1) / value;
        if (taken > tokens) taken = tokens;
        bank.payOut(address(this), musdAmount);
        _chipToken(chip, seriesId).safeTransfer(address(bank), taken);
        emit ChipsToBank(id, chip, seriesId, taken, musdAmount);
    }

    /// @dev cash = pnl - funding - costs + earnings + MUSD Y rewards. If negative, chips worth that much go to the
    ///      Bank (MUSD chips are simply used). The caller pays the costs from the game's MUSD afterwards.
    function _settle(uint256 id, Position memory p, Valued memory v, uint256 costs)
        internal
        returns (uint256 cashOut, uint256 tokensLeft)
    {
        int256 cash = v.pnl - v.funding - int256(costs) + int256(v.earned + v.yMusd);
        tokensLeft = p.tokens;
        if (cash < 0) {
            uint256 owed = uint256(-cash);
            if (p.chip == Chip.MUSD) tokensLeft -= owed;
            else tokensLeft -= _sellChipsToBank(id, p.chip, p.seriesId, p.tokens, v.tokenValue, owed);
        } else {
            cashOut = uint256(cash);
        }
        _settleWithBank(v.pnl - v.funding);
    }

    /// @dev Pays MUSD winnings to the owner, or to the Loop if the owner turned it on. If the Loop fails, pays MUSD.
    function _payCash(uint256 id, address to, uint256 amount) internal {
        if (amount == 0) return;
        if (loop != address(0) && IJuuLoop(loop).isOn(to)) {
            musd.forceApprove(loop, amount);
            try IJuuLoop(loop).loopWinnings(to, amount) {
                emit Looped(id, to, amount);
                return;
            } catch {
                musd.forceApprove(loop, 0);
            }
        }
        musd.safeTransfer(to, amount);
    }

    // ---------------------------------------------------------------- internal: money

    function _settleWithBank(int256 result) internal {
        if (result > 0) bank.payOut(address(this), uint256(result));
        else if (result < 0) musd.safeTransfer(address(bank), uint256(-result));
    }

    function _payFee(uint256 fee) internal {
        if (fee == 0) return;
        uint256 toBank = (fee * feeToBank) / 1e18;
        uint256 toBuffer = (fee * feeToBuffer) / 1e18;
        uint256 toProtocol = fee - toBank - toBuffer;
        if (toBank > 0) musd.safeTransfer(address(bank), toBank);
        if (toBuffer > 0) musd.safeTransfer(address(buffer), toBuffer);
        if (toProtocol > 0) musd.safeTransfer(treasury, toProtocol);
        emit FeePaid(toBank, toBuffer, toProtocol);
    }

    // ---------------------------------------------------------------- internal: Climb Premium

    function _premiumFor(uint256 seat) internal view returns (uint256) {
        uint256 x = 1e18 + premiumGrowth;
        uint256 z = 1e18;
        uint256 n = seat;
        while (n > 0) {
            if (n & 1 == 1) z = (z * x) / 1e18;
            x = (x * x) / 1e18;
            n >>= 1;
        }
        return (premiumBase * z) / 1e18;
    }

    /// @dev Counts a new seat on `floor` and returns the premium it pays (0 below floor 7 or when switched off).
    function _takeSeat(uint256 id, uint8 floor) internal returns (uint256 premium) {
        if (floor < TOP_FLOOR_FROM) return 0;
        _checkKill();
        uint256 e = currentEpoch();
        uint256 seat = seatsTaken[e][floor];
        seatsTaken[e][floor] = seat + 1;
        topSeats[e] += 1;
        if (!premiumOn) return 0;
        premium = _premiumFor(seat);
        emit SeatPremium(id, floor, e, seat, premium, floorSize[floor] > 0);
    }

    /// @dev Shares a premium among the positions already on the floor, by size. Nobody there: it goes to the Bank.
    function _payPremium(uint8 floor, uint256 premium) internal {
        if (premium == 0) return;
        if (floorSize[floor] > 0) premiumAcc[floor] += (premium * ACC) / floorSize[floor];
        else musd.safeTransfer(address(bank), premium);
    }

    function _premiumEarned(Position memory p) internal view returns (uint256) {
        return (p.size * (premiumAcc[p.floor] - p.premiumAcc)) / ACC;
    }

    function _checkKill() internal {
        uint256 e = currentEpoch();
        if (e < 2) return;
        uint256 last = e - 1;
        if (killChecked[last]) return;
        killChecked[last] = true;
        uint256 prev = topSeats[last - 1];
        if (premiumOn && prev > 0 && topSeats[last] * 1e18 < killLevel * prev) {
            premiumOn = false;
            emit KillSwitch(last, topSeats[last], prev);
        }
    }

    // ---------------------------------------------------------------- internal: jackpot tickets

    /// @dev Writes size x time from `from` to `until` into each epoch's ledger (skipping sealed epochs).
    function _accrueTickets(uint256 id, address owner_, uint256 size, uint256 from, uint256 until) internal returns (uint256) {
        uint256 t0 = from;
        for (uint256 k = 0; k < 16 && t0 < until; k++) {
            uint256 e = t0 / epochLength;
            uint256 end = (e + 1) * epochLength;
            if (end > until) end = until;
            if (!epochSealed[e] && end > t0) {
                uint256 n = _tickets[e].length;
                uint256 prior = n == 0 ? 0 : _tickets[e][n - 1].cum;
                _tickets[e].push(Ticket(owner_, uint64(id), prior + size * (end - t0)));
            }
            t0 = end;
        }
        return until;
    }

    // ---------------------------------------------------------------- internal: funding

    function _ratePerHour() internal view returns (int256) {
        uint256 bull = openInterest[0];
        uint256 bear = openInterest[1];
        uint256 total = bull + bear;
        if (total == 0) return 0;
        return (int256(fundingK) * (int256(bull) - int256(bear))) / int256(total);
    }

    function _fundingPreview() internal view returns (int256[2] memory idx) {
        idx[0] = fundingIndex[0];
        idx[1] = fundingIndex[1];
        uint256 dt = block.timestamp - lastFundingTime;
        if (dt == 0) return idx;
        int256 delta = (_ratePerHour() * int256(dt)) / 3600;
        idx[0] += delta;
        idx[1] -= delta;
    }

    function _updateFunding() internal {
        int256[2] memory idx = _fundingPreview();
        fundingIndex[0] = idx[0];
        fundingIndex[1] = idx[1];
        lastFundingTime = block.timestamp;
    }

    // ---------------------------------------------------------------- internal: survivors

    function _creditSurvivors(Side side, uint256 amount) internal returns (bool) {
        if (amount == 0) return true;
        uint8 s = uint8(side);
        uint256 weight = block.timestamp * openInterest[s] - sizeTime[s];
        if (weight == 0) return false;
        accA[s] += (amount * block.timestamp * ACC) / weight;
        accB[s] += (amount * ACC) / weight;
        return true;
    }

    function _reward(Position memory p) internal view returns (uint256) {
        uint8 s = uint8(p.side);
        uint256 a = accA[s] - p.accA;
        uint256 b = (accB[s] - p.accB) * p.openedAt;
        if (a <= b) return 0;
        return (p.size * (a - b)) / ACC;
    }
}
