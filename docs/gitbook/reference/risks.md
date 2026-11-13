# Risks

Juu is an experiment on Mezo **testnet**. Read this before you use it.

## For everyone

* **Smart contract risk.** Juu's contracts are new and have not been reviewed by an outside firm. A bug could lose funds.
* **Mezo risk.** Juu is built on Mezo's veBTC, MUSD, DEX and price feed. If any of those fail or change, Juu is affected. For example, the live testnet veBTC is already newer than Mezo's published source; Juu checks every function it calls against the live contracts.
* **Keeper risk.** Juu's keeper bot starts each series' unlock, triggers payouts, votes, collapses floors and keeps the Bank's loan healthy. Anyone can call the time-critical steps, but if nobody does, things happen late. A late unlock means P is paid on a later Thursday.
* **Price feed pauses.** If Mezo's price feed falls more than 60 seconds behind, actions that need a price wait.

## Splitter, P and Y

* **Your BTC is locked until the series end date.** You can sell P before then, but you can't get your BTC out of Mezo early.
* **Y is a forecast.** Rewards change every week. The rewards Y earns may be much less than expected.
* **Testnet rewards are not realistic.** Use testnet numbers to see how Juu works, not to predict real returns.

## Bank

* **Players can win.** The Bank pays winners. If players win more than the Bank earns, share value falls.
* **Loan risk.** The Bank's Mezo loan is kept near 300%. A very large BTC drop could still bring it toward Mezo's 110% liquidation line.
* **Redemptions.** Mezo lets anyone swap MUSD for BTC from the riskiest loans. At 300% the Bank is far from the front of that line, but not out of it.
* **Recovery Mode.** While Mezo's whole system is below 150% collateral, withdrawals that need the Bank's collateral wait.

## Juu account (Door 3)

* **Your own Mezo loan.** The account's loan can be liquidated by Mezo like any loan if BTC falls far enough. The guard closes bets early, but it can't stop the BTC price.
* **Swaps.** Winnings are swapped to BTC with a 12% loss limit on testnet; if the swap would lose more, they repay debt instead.

## Juu Agents

* **An agent can lose your money within its rules.** The rules cap each bet, the floor and the daily loss, but losses up to those limits are real.
* **Agent keys.** Anyone holding the agent's key can act within its session. Keep it safe, set an expiry, and revoke when done.

## Loop and P Market

* **Swap prices.** The Loop and the P Market trade on Mezo's DEX. Small pools move a lot on big trades; use quotes and minimum amounts.

## MUSDash

* **You can lose all your chips.** A floor collapses when what your position is worth falls to 2% of its size. On floor 10 that is an 8% move against you.
* **Fast moves.** If the price jumps past your collapse price before anyone collapses your floor, you lose all your margin.
* **Climb Premium.** Seat premiums on floors 7 to 10 reward early climbers with later climbers' money. They stop for good once new top-floor seats drop below half of the week before. Don't count on them continuing.
* **The Bank's cap limits new bets, not price moves.** Juu won't let a new bet push the gap between the sides above 20% of the Bank's capital. A big price move can still make the Bank's side lose more than that.
