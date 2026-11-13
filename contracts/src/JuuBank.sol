// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IBorrowerOperations, ITroveManager, IPriceFeed} from "./interfaces/IMezo.sol";
import {JuuSplitter} from "./JuuSplitter.sol";
import {JuuPricer} from "./JuuPricer.sol";

/// @title JuuBank
/// @notice The pot that backs MUSDash. Savers deposit BTC and get Bank shares (jBANK).
///         The Bank runs one Mezo trove at about 300% collateral ratio and borrows MUSD at Mezo's fixed rate.
///         That MUSD is the game's liquidity: MUSDash pays winners from it (payOut) and sends the Bank its
///         income (trading fees, funding, liquidation share, losers' margin) as plain MUSD transfers.
///
/// Share value, in BTC: idle BTC + trove collateral + (MUSD held - trove debt) / BTC price, where trove debt
/// leaves out the 200 MUSD gas compensation Mezo refunds when the trove closes.
/// Withdrawals pay a fair slice in BTC, plus MUSD only from what the Bank holds above its debt. The MUSD
/// backing the loan stays in the Bank, so the game keeps its liquidity and the last saver can close the trove.
/// While Mezo is in Recovery Mode it blocks taking collateral out of troves, so withdrawals that need
/// trove BTC wait until it ends.
///
/// Y and P chips: when a player loses Y or P chips in MUSDash, the Bank pays the MUSD and takes the tokens at
/// the Pricer's value. The Bank counts the Y and P it holds in its value (at the Pricer's value), anyone can make
/// it claim Y rewards or redeem matured P, and a withdrawing saver also gets their share of those tokens.
contract JuuBank is ERC20, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant GAS_COMPENSATION = 200e18; // MUSD Mezo adds to every trove's debt
    uint256 internal constant ACTIVE = 1;

    IBorrowerOperations public immutable borrowerOperations;
    ITroveManager public immutable troveManager;
    IPriceFeed public immutable priceFeed;
    IERC20 public immutable musd;

    address public game; // MUSDash, allowed to pay winners
    uint256 public targetCR = 3e18; // 300%
    uint256 public lowerCR = 2.7e18; // rebalance repays below this
    uint256 public upperCR = 3.3e18; // rebalance borrows above this
    uint256 public exposureCap = 0.2e18; // MUSDash keeps the Bank's uncovered exposure under 20% of capital
    JuuSplitter public splitter; // P and Y the Bank may hold
    JuuPricer public pricer; // values them

    event Deposited(address indexed sender, address indexed receiver, uint256 btc, uint256 shares);
    event Withdrawn(address indexed owner, address indexed receiver, uint256 shares, uint256 btc, uint256 musdOut);
    event TroveOpened(uint256 coll, uint256 debtAmount);
    event Borrowed(uint256 amount);
    event Repaid(uint256 amount);
    event PaidOut(address indexed to, uint256 amount);
    event GameSet(address game);
    event RatiosSet(uint256 target, uint256 lower, uint256 upper);
    event ExposureCapSet(uint256 cap);
    event ValuationSet(address splitter, address pricer);

    error NotGame();
    error ZeroAmount();
    error ZeroShares();
    error BadValue();
    error SendFailed();
    error NotEnoughMUSDToClose();

    constructor(address borrowerOperations_, address troveManager_, address priceFeed_, address musd_)
        ERC20("Juu Bank share", "jBANK")
        Ownable(msg.sender)
    {
        borrowerOperations = IBorrowerOperations(borrowerOperations_);
        troveManager = ITroveManager(troveManager_);
        priceFeed = IPriceFeed(priceFeed_);
        musd = IERC20(musd_);
    }

    /// @dev Mezo sends trove collateral back as plain BTC.
    receive() external payable {}

    // ---------------------------------------------------------------- admin

    function setGame(address game_) external onlyOwner {
        game = game_;
        emit GameSet(game_);
    }

    function setRatios(uint256 target, uint256 lower, uint256 upper) external onlyOwner {
        if (lower < 1.5e18 || lower > target || target > upper) revert BadValue();
        targetCR = target;
        lowerCR = lower;
        upperCR = upper;
        emit RatiosSet(target, lower, upper);
    }

    function setValuation(address splitter_, address pricer_) external onlyOwner {
        splitter = JuuSplitter(payable(splitter_));
        pricer = JuuPricer(pricer_);
        emit ValuationSet(splitter_, pricer_);
    }

    function setExposureCap(uint256 cap) external onlyOwner {
        if (cap > 1e18) revert BadValue();
        exposureCap = cap;
        emit ExposureCapSet(cap);
    }

    // ---------------------------------------------------------------- views

    function price() public view returns (uint256) {
        return priceFeed.fetchPrice();
    }

    function hasTrove() public view returns (bool) {
        return troveManager.getTroveStatus(address(this)) == ACTIVE;
    }

    /// @notice The Bank's trove: collateral (BTC) and total debt (MUSD, including interest).
    function trove() public view returns (uint256 coll, uint256 debt) {
        if (!hasTrove()) return (0, 0);
        (uint256 c, uint256 principal, uint256 interest,,,) = troveManager.getEntireDebtAndColl(address(this));
        return (c, principal + interest);
    }

    /// @notice Everything the Bank owns, net of debt, in BTC (18 decimals).
    function totalAssetsBTC() public view returns (uint256) {
        return _navBTC(price());
    }

    /// @notice Everything the Bank owns, net of debt, in MUSD.
    function capitalMUSD() public view returns (uint256) {
        uint256 p = price();
        return (_navBTC(p) * p) / 1e18;
    }

    /// @notice The most uncovered exposure MUSDash may leave on the Bank, in MUSD.
    function maxExposure() external view returns (uint256) {
        return (capitalMUSD() * exposureCap) / 1e18;
    }

    /// @notice Y and P the Bank holds, at the Pricer's margin value, in MUSD.
    function tokenValueMUSD() public view returns (uint256 v) {
        if (address(pricer) == address(0)) return 0;
        uint256 n = splitter.seriesCount();
        for (uint256 i = 0; i < n; i++) {
            JuuSplitter.Series memory s = splitter.getSeries(i);
            uint256 y = s.y.balanceOf(address(this));
            if (y > 0) v += pricer.yValue(i, y);
            uint256 pb = s.p.balanceOf(address(this));
            if (pb > 0) v += pricer.pValue(i, pb);
        }
    }

    /// @notice MUSD the Bank can pay out right now.
    function liquidity() external view returns (uint256) {
        return musd.balanceOf(address(this));
    }

    /// @notice Trove collateral ratio (1e18 = 100%). 0 without a trove.
    function collateralRatio() public view returns (uint256) {
        (uint256 coll, uint256 debt) = trove();
        if (debt == 0) return 0;
        return (coll * price()) / debt;
    }

    // ---------------------------------------------------------------- savers

    /// @notice Deposit BTC, receive Bank shares.
    function deposit(address receiver) external payable nonReentrant returns (uint256 shares) {
        if (msg.value == 0) revert ZeroAmount();
        uint256 p = price();
        uint256 navBefore = _navBTC(p) - msg.value; // this contract's balance already includes msg.value
        shares = (msg.value * (totalSupply() + 1e3)) / (navBefore + 1);
        if (shares == 0) revert ZeroShares();
        if (hasTrove()) borrowerOperations.addColl{value: msg.value}(address(0), address(0));
        _mint(receiver, shares);
        emit Deposited(msg.sender, receiver, msg.value, shares);
    }

    /// @notice Burn shares and receive a fair slice: BTC, plus MUSD if the Bank holds more MUSD than it owes.
    function withdraw(uint256 shares, address receiver) external nonReentrant returns (uint256 btcOut, uint256 musdOut) {
        if (shares == 0) revert ZeroAmount();
        uint256 supply = totalSupply();
        uint256 f = (shares * 1e18) / supply;
        bool last = shares == supply;
        _burn(msg.sender, shares);

        uint256 idle = address(this).balance;
        if (!hasTrove()) {
            btcOut = (idle * f) / 1e18;
            musdOut = (musd.balanceOf(address(this)) * f) / 1e18;
        } else if (last) {
            // Closing repays the debt minus Mezo's gas compensation and returns all collateral.
            (, uint256 debt) = trove();
            if (musd.balanceOf(address(this)) + GAS_COMPENSATION < debt) revert NotEnoughMUSDToClose();
            borrowerOperations.closeTrove();
            btcOut = address(this).balance;
            musdOut = musd.balanceOf(address(this));
        } else {
            uint256 collOut;
            (collOut, musdOut) = _troveSlice(f);
            btcOut = (idle * f) / 1e18 + collOut;
        }

        _sendTokenSlice(f, receiver);
        if (musdOut > 0) musd.safeTransfer(receiver, musdOut);
        if (btcOut > 0) {
            (bool ok,) = receiver.call{value: btcOut}("");
            if (!ok) revert SendFailed();
        }
        emit Withdrawn(msg.sender, receiver, shares, btcOut, musdOut);
    }

    // ---------------------------------------------------------------- trove upkeep

    /// @notice Move the trove toward the target ratio. Opens the trove once idle BTC can carry Mezo's
    ///         minimum loan at the target ratio. Callable by anyone (the keeper calls it on a schedule).
    function rebalance() external nonReentrant {
        uint256 p = price();
        uint256 idle = address(this).balance;

        if (!hasTrove()) {
            // Total debt Mezo records = amount + borrowing fee + gas compensation.
            uint256 target = (idle * p) / targetCR;
            if (target <= GAS_COMPENSATION) return;
            uint256 amount = _amountForNetDebt(target - GAS_COMPENSATION);
            if (amount + borrowerOperations.getBorrowingFee(amount) < borrowerOperations.minNetDebt()) return;
            borrowerOperations.openTrove{value: idle}(amount, address(0), address(0));
            emit TroveOpened(idle, amount);
            return;
        }

        if (idle > 0) borrowerOperations.addColl{value: idle}(address(0), address(0));

        (uint256 coll, uint256 debt) = trove();
        uint256 cr = (coll * p) / debt;
        uint256 targetDebt = (coll * p) / targetCR;

        if (cr > upperCR) {
            uint256 amount = _amountForNetDebt(targetDebt - debt);
            if (amount == 0) return;
            // Mezo fixes a trove's borrowing cap when it opens; refinancing resets it to today's collateral.
            uint256 cap = troveManager.getTroveMaxBorrowingCapacity(address(this));
            if (cap < debt + amount + borrowerOperations.getBorrowingFee(amount)) {
                borrowerOperations.refinance(address(0), address(0));
            }
            borrowerOperations.withdrawMUSD(amount, address(0), address(0));
            emit Borrowed(amount);
        } else if (cr < lowerCR) {
            uint256 repay = debt - targetDebt;
            uint256 m = musd.balanceOf(address(this));
            if (repay > m) repay = m;
            uint256 floor = borrowerOperations.minNetDebt() + GAS_COMPENSATION;
            uint256 maxRepay = debt > floor ? debt - floor : 0;
            if (repay > maxRepay) repay = maxRepay;
            if (repay == 0) return;
            borrowerOperations.repayMUSD(repay, address(0), address(0));
            emit Repaid(repay);
        }
    }

    // ---------------------------------------------------------------- Y and P held

    /// @notice Claim the rewards of the Y the Bank holds in series `id`. Callable by anyone.
    function claimY(uint256 id) external nonReentrant {
        splitter.claimY(id);
    }

    /// @notice Redeem all matured P the Bank holds in series `id` for BTC. Callable by anyone.
    function redeemP(uint256 id) external nonReentrant {
        uint256 bal = splitter.getSeries(id).p.balanceOf(address(this));
        if (bal > 0) splitter.redeemP(id, bal);
    }

    // ---------------------------------------------------------------- game

    /// @notice MUSDash pays a winner from the Bank's MUSD.
    function payOut(address to, uint256 amount) external nonReentrant {
        if (msg.sender != game) revert NotGame();
        musd.safeTransfer(to, amount);
        emit PaidOut(to, amount);
    }

    // ---------------------------------------------------------------- internal

    /// @dev Pay fraction `f` of the trove side while it stays open.
    ///      The saver is paid in BTC from the collateral. MUSD leaves the Bank only when it holds more than it
    ///      owes, so the MUSD backing the loan stays for the game and for closing the trove later.
    ///      The saver's share of the debt is repaid from the MUSD that backs it (down to Mezo's minimum loan);
    ///      repaying lowers MUSD and debt by the same amount, so it does not change anyone's value.
    function _troveSlice(uint256 f) internal returns (uint256 collOut, uint256 musdOut) {
        (uint256 coll, uint256 debt) = trove();
        // What the Bank really owes: Mezo refunds the gas compensation at close.
        uint256 debtShare = ((debt - GAS_COMPENSATION) * f) / 1e18;
        uint256 musdShare = (musd.balanceOf(address(this)) * f) / 1e18;

        collOut = (coll * f) / 1e18;
        if (musdShare >= debtShare) {
            musdOut = musdShare - debtShare;
        } else {
            // The Bank owes more MUSD than it holds: the saver carries their share of that gap in BTC.
            uint256 gap = ((debtShare - musdShare) * 1e18) / price();
            collOut = collOut > gap ? collOut - gap : 0;
        }

        uint256 repay = debtShare < musdShare ? debtShare : musdShare;
        uint256 floor = borrowerOperations.minNetDebt() + GAS_COMPENSATION;
        uint256 maxRepay = debt > floor ? debt - floor : 0;
        if (repay > maxRepay) repay = maxRepay;
        if (repay > 0) borrowerOperations.repayMUSD(repay, address(0), address(0));
        if (collOut > 0) borrowerOperations.withdrawColl(collOut, address(0), address(0));
    }

    function _sendTokenSlice(uint256 f, address receiver) internal {
        if (address(splitter) == address(0)) return;
        uint256 n = splitter.seriesCount();
        for (uint256 i = 0; i < n; i++) {
            JuuSplitter.Series memory s = splitter.getSeries(i);
            uint256 y = (s.y.balanceOf(address(this)) * f) / 1e18;
            if (y > 0) IERC20(address(s.y)).safeTransfer(receiver, y);
            uint256 pb = (s.p.balanceOf(address(this)) * f) / 1e18;
            if (pb > 0) IERC20(address(s.p)).safeTransfer(receiver, pb);
        }
    }

    function _navBTC(uint256 p) internal view returns (uint256) {
        (uint256 coll, uint256 debt) = trove();
        // Mezo refunds the 200 MUSD gas compensation when the trove closes, so it is not a real cost.
        if (debt > GAS_COMPENSATION) debt -= GAS_COMPENSATION;
        // Y and P held count at the Pricer's value, as if they were MUSD.
        uint256 m = musd.balanceOf(address(this)) + tokenValueMUSD();
        uint256 btcSide = address(this).balance + coll;
        if (m >= debt) return btcSide + ((m - debt) * 1e18) / p;
        uint256 shortBTC = ((debt - m) * 1e18) / p;
        return btcSide > shortBTC ? btcSide - shortBTC : 0;
    }

    /// @dev Amount to request so that amount + Mezo's borrowing fee is about `netDebt`.
    function _amountForNetDebt(uint256 netDebt) internal view returns (uint256) {
        uint256 feeOn1 = borrowerOperations.getBorrowingFee(1e18); // fee for 1 MUSD, 1e18 scale
        return (netDebt * 1e18) / (1e18 + feeOn1);
    }
}
