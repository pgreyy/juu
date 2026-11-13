# Pricer in detail

Contract: `JuuPricer`. All values are MUSD with 18 decimals.

## Y

```
yieldWeeksLeft =
  Open:       (unlockFrom - now) / 1 week  +  maxLockTime / (2 x 1 week)
  Unlocking:  (lockEnd - now)^2 / (2 x maxLockTime x 1 week)
  Matured:    0

expectedYieldPerY = weeklyYieldPerBTC x yieldWeeksLeft
yValue(amount)    = amount x expectedYieldPerY x yHaircut
```

Why the tail is a square: after unlocking, veBTC voting power falls in a straight line, `power = amount x (lockEnd - t) / maxLockTime`. Adding that up week by week gives `(time left)^2 / (2 x maxLockTime)`. With a 30-day maximum lock, the whole tail is worth about 2.14 full weeks.

Example (series 0 on 13 Nov 2026, before its unlock): 2.57 full weeks + 2.14 tail weeks = **4.72** weeks, as read from the contract.

### Sliding haircut

`reportWeeklyYield(realized)` (keeper) sets the new forecast. If a forecast already existed, the Y haircut moves one step (5%) down if `realized` is below it, or up if above. It stays between 20% and 90%. The start is 80%.

## P

```
pValue(amount) = BTC amount x BTC price x pHaircut (90%)
```

After maturity, the BTC amount is `amount x pRate`.

## A Mezo loan

```
troveValue(account) = (collateral x BTC price - (principal + interest)) x troveHaircut (80%)
```

Debt and collateral come from `TroveManager.getEntireDebtAndColl`, which includes pending amounts. The value is 0 if the account has no active loan or owes more than its collateral is worth.

## Price

`btcPrice()` reads `PriceFeed.fetchPrice()`. Mezo's oracle updates every block (about 4.2 seconds on testnet). `fetchPrice` reverts if the oracle is more than 60 seconds old.
