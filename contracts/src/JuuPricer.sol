// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IPriceFeed, ITroveManager} from "./interfaces/IMezo.sol";
import {JuuSplitter} from "./JuuSplitter.sol";

/// @title JuuPricer
/// @notice How much each chip counts for as margin, in MUSD (18 decimals).
///
/// Y (one Y = the yield of 1 BTC in a series until its end date):
///   expected_yield = weekly_yield x yield_weeks_left
///   Y_margin_value = expected_yield x Y_haircut
/// weekly_yield is MUSD earned per week by 1 BTC at full voting power (set by the keeper from real harvests;
/// most rewards on Mezo are paid in MUSD). yield_weeks_left follows how the series lock behaves:
///   while the lock is permanent, voting power is full, so each week counts as 1;
///   after unlocking, voting power falls in a straight line to zero at the end date, which is worth half a
///   week per week, (time_left^2) / (2 x max_lock x week) in total. That tail is about 2.1 weeks for a
///   30 day lock.
/// The Y haircut slides: each keeper report moves it down one step if real yield came in below the forecast
/// and up one step if above, within set bounds.
///
/// P (one P = 1 BTC paid at the series end date):  P_margin_value = P x BTC_price x P_haircut
/// Trove in a Juu account:  trove_margin_value = (collateral x BTC_price - debt) x trove_haircut
contract JuuPricer is Ownable {
    uint256 public constant WEEK = 7 days;

    IPriceFeed public immutable priceFeed;
    ITroveManager public immutable troveManager;
    JuuSplitter public immutable splitter;

    address public keeper;

    uint256 public weeklyYieldPerBTC; // MUSD per week for 1 BTC at full voting power
    uint256 public yHaircut = 0.8e18;
    uint256 public yHaircutMin = 0.2e18;
    uint256 public yHaircutMax = 0.9e18;
    uint256 public yHaircutStep = 0.05e18;
    uint256 public pHaircut = 0.9e18;
    uint256 public troveHaircut = 0.8e18;

    event KeeperSet(address keeper);
    event WeeklyYieldReported(uint256 realized, uint256 previousForecast, uint256 yHaircut);
    event HaircutsSet(uint256 yHaircut, uint256 pHaircut, uint256 troveHaircut);
    event YHaircutRuleSet(uint256 min, uint256 max, uint256 step);

    error NotKeeper();
    error BadValue();

    constructor(address priceFeed_, address troveManager_, address splitter_, address keeper_) Ownable(msg.sender) {
        priceFeed = IPriceFeed(priceFeed_);
        troveManager = ITroveManager(troveManager_);
        splitter = JuuSplitter(payable(splitter_));
        keeper = keeper_;
    }

    // ---------------------------------------------------------------- admin

    function setKeeper(address keeper_) external onlyOwner {
        keeper = keeper_;
        emit KeeperSet(keeper_);
    }

    function setHaircuts(uint256 y, uint256 p, uint256 trove) external onlyOwner {
        if (y > 1e18 || p > 1e18 || trove > 1e18) revert BadValue();
        yHaircut = y;
        pHaircut = p;
        troveHaircut = trove;
        emit HaircutsSet(y, p, trove);
    }

    function setYHaircutRule(uint256 min, uint256 max, uint256 step) external onlyOwner {
        if (min > max || max > 1e18) revert BadValue();
        yHaircutMin = min;
        yHaircutMax = max;
        yHaircutStep = step;
        emit YHaircutRuleSet(min, max, step);
    }

    /// @notice Keeper reports last week's real yield per BTC at full voting power (MUSD).
    ///         It becomes the new forecast and slides the Y haircut one step.
    function reportWeeklyYield(uint256 realized) external {
        if (msg.sender != keeper && msg.sender != owner()) revert NotKeeper();
        uint256 previous = weeklyYieldPerBTC;
        if (previous > 0) {
            if (realized < previous) {
                yHaircut = yHaircut > yHaircutMin + yHaircutStep ? yHaircut - yHaircutStep : yHaircutMin;
            } else if (realized > previous) {
                yHaircut = yHaircut + yHaircutStep < yHaircutMax ? yHaircut + yHaircutStep : yHaircutMax;
            }
        }
        weeklyYieldPerBTC = realized;
        emit WeeklyYieldReported(realized, previous, yHaircut);
    }

    // ---------------------------------------------------------------- prices

    /// @notice BTC price in USD (18 decimals) from Mezo's PriceFeed.
    function btcPrice() public view returns (uint256) {
        return priceFeed.fetchPrice();
    }

    /// @notice Weeks of full-power yield left for a series (1e18 = one week).
    function yieldWeeksLeft(uint256 id) public view returns (uint256) {
        JuuSplitter.Series memory s = splitter.getSeries(id);
        uint256 maxLock = splitter.maxLockTime();
        uint256 nowTs = block.timestamp;

        if (s.phase == JuuSplitter.Phase.Open) {
            uint256 unlock = splitter.unlockFrom(id);
            uint256 full = nowTs < unlock ? unlock - nowTs : 0;
            // After unlocking, about maxLock of time remains, decaying to zero: worth maxLock / 2.
            return (full * 1e18) / WEEK + (maxLock * 1e18) / (2 * WEEK);
        }
        if (s.phase == JuuSplitter.Phase.Unlocking) {
            uint256 left = s.lockEnd > nowTs ? s.lockEnd - nowTs : 0;
            return (left * left * 1e18) / (2 * maxLock * WEEK);
        }
        return 0;
    }

    /// @notice MUSD a single Y (1 BTC worth) is expected to earn until the series ends.
    function expectedYieldPerY(uint256 id) public view returns (uint256) {
        return (weeklyYieldPerBTC * yieldWeeksLeft(id)) / 1e18;
    }

    /// @notice Margin value of `amount` Y of series `id`, in MUSD.
    function yValue(uint256 id, uint256 amount) external view returns (uint256) {
        return (((amount * expectedYieldPerY(id)) / 1e18) * yHaircut) / 1e18;
    }

    /// @notice Margin value of `amount` P of series `id`, in MUSD.
    function pValue(uint256 id, uint256 amount) external view returns (uint256) {
        JuuSplitter.Series memory s = splitter.getSeries(id);
        uint256 btcAmount = s.phase == JuuSplitter.Phase.Matured ? (amount * s.pRate) / 1e18 : amount;
        return (((btcAmount * btcPrice()) / 1e18) * pHaircut) / 1e18;
    }

    /// @notice Margin value of the trove owned by `account` (a Juu account), in MUSD. 0 if none or underwater.
    function troveValue(address account) external view returns (uint256) {
        if (troveManager.getTroveStatus(account) != 1) return 0;
        (uint256 coll, uint256 principal, uint256 interest,,,) = troveManager.getEntireDebtAndColl(account);
        uint256 collValue = (coll * btcPrice()) / 1e18;
        uint256 debt = principal + interest;
        if (collValue <= debt) return 0;
        return ((collValue - debt) * troveHaircut) / 1e18;
    }
}
