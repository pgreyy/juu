// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IBorrowerOperations, ITroveManager, IPriceFeed, IRouter} from "./interfaces/IMezo.sol";
import {MUSDash} from "./MUSDash.sol";

/// @title JuuAccount (Door 3)
/// @notice A personal contract account, controlled only by its owner, that holds its own fresh Mezo trove
///         (Mezo cannot move an existing trove) and plays MUSDash with it.
///
///   Margin: the account may keep chips in play up to the trove's margin value, 80% of its net worth
///           (collateral value - debt + MUSD held + chips in play).
///   Borrow into the game: play() borrows the MUSD it needs straight from the trove at Mezo's fixed rate.
///   Wins go back into the trove: the borrowed chips repay debt and the profit is swapped to BTC (with a price
///           loss limit) and added as collateral. If the swap would lose too much, the profit repays debt.
///   Losses come out of the trove: lost chips were borrowed, so their debt stays on the trove.
///   Safety guard: if the trove's collateral ratio falls below the guard level (130%), or Mezo's whole system
///           falls below 160% (before Recovery Mode at 150%), anyone (the keeper) can call guard(n) and the
///           account closes its bets, n per call, before Mezo's 110% liquidation line is near.
contract JuuAccount is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant GAS_COMPENSATION = 200e18;

    address public immutable owner;
    IBorrowerOperations public immutable borrowerOperations;
    ITroveManager public immutable troveManager;
    IPriceFeed public immutable priceFeed;
    IERC20 public immutable musd;
    IERC20 public immutable btc;
    MUSDash public immutable game;
    IRouter public immutable router;
    address public immutable poolFactory;

    uint256 public guardICR = 1.3e18;
    uint256 public guardTCR = 1.6e18;
    uint256 public playHaircut = 0.8e18;
    uint256 public maxSlippage = 0.12e18;

    uint256[] internal _openIds;
    mapping(uint256 => uint256) public marginOf; // position => MUSD chips
    uint256 public inPlay;

    event Played(uint256 indexed positionId, uint8 floor, uint256 margin, uint256 borrowed);
    event Returned(uint256 indexed positionId, uint256 margin, uint256 got, uint256 repaid, uint256 profitToCollateral);
    event Guarded(string reason, uint256 icr, uint256 tcr, uint256 closed);
    event Synced(uint256 indexed positionId, uint256 marginLost);
    event GuardSet(uint256 icr, uint256 tcr);

    error NotOwner();
    error OverCapacity();
    error TooRisky();
    error NoGuardNeeded();
    error PositionsOpen();
    error OnlySelf();
    error BadValue();
    error SendFailed();

    constructor(
        address owner_,
        address borrowerOperations_,
        address troveManager_,
        address priceFeed_,
        address musd_,
        address btc_,
        address game_,
        address router_,
        address poolFactory_
    ) {
        owner = owner_;
        borrowerOperations = IBorrowerOperations(borrowerOperations_);
        troveManager = ITroveManager(troveManager_);
        priceFeed = IPriceFeed(priceFeed_);
        musd = IERC20(musd_);
        btc = IERC20(btc_);
        game = MUSDash(game_);
        router = IRouter(router_);
        poolFactory = poolFactory_;
    }

    receive() external payable {}

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // ---------------------------------------------------------------- trove

    /// @notice Open the account's own trove with the BTC sent, borrowing `debtAmount` MUSD into the account.
    function openTrove(uint256 debtAmount) external payable onlyOwner nonReentrant {
        borrowerOperations.openTrove{value: msg.value}(debtAmount, address(0), address(0));
    }

    function addCollateral() external payable onlyOwner nonReentrant {
        borrowerOperations.addColl{value: msg.value}(address(0), address(0));
    }

    function borrow(uint256 amount) external onlyOwner nonReentrant {
        _borrow(amount);
        if (icr() < guardICR + 0.1e18) revert TooRisky();
    }

    function repay(uint256 amount) external onlyOwner nonReentrant {
        borrowerOperations.repayMUSD(amount, address(0), address(0));
    }

    /// @notice Take collateral out to the owner (the trove must stay 0.2 above the guard level).
    function withdrawCollateral(uint256 amount) external onlyOwner nonReentrant {
        borrowerOperations.withdrawColl(amount, address(0), address(0));
        if (icr() < guardICR + 0.2e18) revert TooRisky();
        _sendBTC(owner, amount);
    }

    /// @notice Send spare MUSD (not in play) to the owner.
    function withdrawMUSD(uint256 amount) external onlyOwner nonReentrant {
        musd.safeTransfer(owner, amount);
    }

    /// @notice Close the trove (no open bets; the account must hold the debt minus Mezo's 200 MUSD deposit).
    function closeTrove() external onlyOwner nonReentrant {
        if (_openIds.length > 0) revert PositionsOpen();
        borrowerOperations.closeTrove();
        uint256 m = musd.balanceOf(address(this));
        if (m > 0) musd.safeTransfer(owner, m);
        _sendBTC(owner, address(this).balance);
    }

    function setGuard(uint256 icr_, uint256 tcr_) external onlyOwner {
        if (icr_ < 1.2e18 || tcr_ < 1.5e18) revert BadValue();
        guardICR = icr_;
        guardTCR = tcr_;
        emit GuardSet(icr_, tcr_);
    }

    // ---------------------------------------------------------------- play

    /// @notice Bet with MUSD borrowed from the trove (and any MUSD the account already holds).
    function play(MUSDash.Side side, uint8 floor, uint256 margin) external onlyOwner nonReentrant returns (uint256 id) {
        if (inPlay + margin > capacity()) revert OverCapacity();
        uint256 size = (margin * game.leverage(floor - 1)) / 1e18;
        uint256 need = margin + (size * game.tradingFee()) / 1e18 + game.seatPremium(floor);
        uint256 cash = musd.balanceOf(address(this));
        uint256 borrowed = need > cash ? need - cash : 0;
        if (borrowed > 0) _borrow(borrowed);
        if (icr() < guardICR + 0.1e18) revert TooRisky();

        musd.forceApprove(address(game), need);
        id = game.open(side, floor, margin);
        musd.forceApprove(address(game), 0);
        _openIds.push(id);
        marginOf[id] = margin;
        inPlay += margin;
        emit Played(id, floor, margin, borrowed);
    }

    function moveFloor(uint256 id, uint8 toFloor) external onlyOwner nonReentrant {
        uint256 premium = game.seatPremium(toFloor);
        if (premium > 0) musd.forceApprove(address(game), premium);
        game.moveFloor(id, toFloor);
    }

    function close(uint256 id) external onlyOwner nonReentrant {
        _close(id);
    }

    /// @notice Safety guard: when the trove nears danger or Mezo nears Recovery Mode, close up to `maxCloses` bets
    ///         and put the MUSD back into the trove. Anyone can call it once the guard condition holds; the keeper
    ///         calls it again until the account is safe. One close costs millions of gas on Mezo (the trove list is
    ///         re-sorted), so closing them all in one transaction could exceed the block gas limit.
    function guard(uint256 maxCloses) external nonReentrant {
        (bool trip, string memory reason) = shouldGuard();
        if (!trip) revert NoGuardNeeded();
        uint256 closed;
        uint256[] memory ids = _openIds;
        for (uint256 i = 0; i < ids.length && closed < maxCloses; i++) {
            try this.closeForGuard(ids[i]) {
                closed++;
            } catch {}
        }
        emit Guarded(reason, icr(), tcr(), closed);
    }

    /// @dev External so guard() can skip a bet that cannot be closed (one that is due to collapse).
    function closeForGuard(uint256 id) external {
        if (msg.sender != address(this)) revert OnlySelf();
        _close(id);
    }

    /// @notice Drop bets that collapsed in MUSDash from the account's books.
    function sync() external {
        for (uint256 i = _openIds.length; i > 0; i--) {
            uint256 id = _openIds[i - 1];
            if (game.getPosition(id).owner == address(0)) {
                uint256 m = marginOf[id];
                inPlay -= m;
                delete marginOf[id];
                _openIds[i - 1] = _openIds[_openIds.length - 1];
                _openIds.pop();
                emit Synced(id, m);
            }
        }
    }

    // ---------------------------------------------------------------- views

    function trove() public view returns (uint256 coll, uint256 debt) {
        if (troveManager.getTroveStatus(address(this)) != 1) return (0, 0);
        (uint256 c, uint256 principal, uint256 interest,,,) = troveManager.getEntireDebtAndColl(address(this));
        return (c, principal + interest);
    }

    function icr() public view returns (uint256) {
        (uint256 coll, uint256 debt) = trove();
        if (debt == 0) return type(uint256).max;
        return (coll * priceFeed.fetchPrice()) / debt;
    }

    function tcr() public view returns (uint256) {
        return troveManager.getTCR(priceFeed.fetchPrice());
    }

    /// @notice Collateral value - debt + MUSD held + chips in play (at what was put in), in MUSD.
    function netWorth() public view returns (uint256) {
        (uint256 coll, uint256 debt) = trove();
        uint256 plus = (coll * priceFeed.fetchPrice()) / 1e18 + musd.balanceOf(address(this)) + inPlay;
        return plus > debt ? plus - debt : 0;
    }

    /// @notice Most chips the account may have in play: the trove's margin value (net worth x 80%).
    function capacity() public view returns (uint256) {
        return (netWorth() * playHaircut) / 1e18;
    }

    function shouldGuard() public view returns (bool, string memory) {
        if (_openIds.length == 0) return (false, "");
        if (icr() < guardICR) return (true, "trove below guard ratio");
        if (tcr() < guardTCR) return (true, "Mezo near Recovery Mode");
        return (false, "");
    }

    function openPositions() external view returns (uint256[] memory) {
        return _openIds;
    }

    // ---------------------------------------------------------------- internal

    function _borrow(uint256 amount) internal {
        (, uint256 debt) = trove();
        uint256 fee = borrowerOperations.getBorrowingFee(amount);
        // Mezo fixes a trove's borrowing cap when it opens; refinancing resets it to today's collateral.
        if (troveManager.getTroveMaxBorrowingCapacity(address(this)) < debt + amount + fee) {
            borrowerOperations.refinance(address(0), address(0));
        }
        borrowerOperations.withdrawMUSD(amount, address(0), address(0));
    }

    function _close(uint256 id) internal {
        uint256 before = musd.balanceOf(address(this));
        game.close(id);
        uint256 got = musd.balanceOf(address(this)) - before;
        uint256 margin = marginOf[id];
        _remove(id);
        inPlay -= margin;

        uint256 profit = got > margin ? got - margin : 0;
        uint256 toCollateral;
        if (profit > 0) toCollateral = _profitToCollateral(profit);
        // Returned chips (and any profit that could not be swapped) repay debt, down to Mezo's minimum loan.
        uint256 repaid = _repayUpTo(got - (toCollateral > 0 ? profit : 0));
        emit Returned(id, margin, got, repaid, toCollateral);
    }

    function _profitToCollateral(uint256 amount) internal returns (uint256 btcAdded) {
        uint256 minOut = (((amount * 1e18) / priceFeed.fetchPrice()) * (1e18 - maxSlippage)) / 1e18;
        IRouter.Route[] memory route = new IRouter.Route[](1);
        route[0] = IRouter.Route(address(musd), address(btc), false, poolFactory);
        musd.forceApprove(address(router), amount);
        uint256 before = address(this).balance;
        try router.swapExactTokensForTokens(amount, minOut, route, address(this), block.timestamp) {
            btcAdded = address(this).balance - before;
            borrowerOperations.addColl{value: btcAdded}(address(0), address(0));
        } catch {
            musd.forceApprove(address(router), 0);
        }
    }

    function _repayUpTo(uint256 amount) internal returns (uint256 repaid) {
        (, uint256 debt) = trove();
        uint256 floor = borrowerOperations.minNetDebt() + GAS_COMPENSATION;
        uint256 room = debt > floor ? debt - floor : 0;
        uint256 cash = musd.balanceOf(address(this));
        repaid = amount < room ? amount : room;
        if (repaid > cash) repaid = cash;
        if (repaid > 0) borrowerOperations.repayMUSD(repaid, address(0), address(0));
    }

    function _remove(uint256 id) internal {
        for (uint256 i = 0; i < _openIds.length; i++) {
            if (_openIds[i] == id) {
                _openIds[i] = _openIds[_openIds.length - 1];
                _openIds.pop();
                break;
            }
        }
        delete marginOf[id];
    }

    function _sendBTC(address to, uint256 amount) internal {
        if (amount == 0) return;
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert SendFailed();
    }
}

/// @title JuuAccountFactory
/// @notice Creates one personal Juu account per user.
contract JuuAccountFactory {
    address public immutable borrowerOperations;
    address public immutable troveManager;
    address public immutable priceFeed;
    address public immutable musd;
    address public immutable btc;
    address public immutable game;
    address public immutable router;
    address public immutable poolFactory;

    mapping(address => address) public accountOf;

    event AccountCreated(address indexed owner, address account);

    error AlreadyHasAccount();

    constructor(address bo, address tm, address pf, address musd_, address btc_, address game_, address router_, address poolFactory_) {
        borrowerOperations = bo;
        troveManager = tm;
        priceFeed = pf;
        musd = musd_;
        btc = btc_;
        game = game_;
        router = router_;
        poolFactory = poolFactory_;
    }

    function create() external returns (address account) {
        if (accountOf[msg.sender] != address(0)) revert AlreadyHasAccount();
        account = address(new JuuAccount(msg.sender, borrowerOperations, troveManager, priceFeed, musd, btc, game, router, poolFactory));
        accountOf[msg.sender] = account;
        emit AccountCreated(msg.sender, account);
    }
}
