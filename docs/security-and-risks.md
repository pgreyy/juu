# Security and risks

Juu runs on **Mezo testnet only**. Testnet BTC and MUSD have no value. **The contracts have had no security review
yet**; mainnet comes only after one. This page lists the limits built into the contracts, who can do what, and the
risks we know about. The transactions referred to are in [evidence.md](evidence.md).

## Limits in the contracts

| Limit | Where | What it does |
| --- | --- | --- |
| Win cap | MUSDash `maxWinShare`, 100% of size | A bet can win at most its own size, so its worst case for the Bank is known. |
| Bank cash check | MUSDash, `BankCannotCoverWin` | A bet (or a climb) is refused if the Bank's MUSD on hand could not pay its worst case win. |
| Exposure cap | JuuBank, 20% of capital | The gap between Bull and Bear can't grow past this share of the Bank's capital; the owner can't set it above 100%. |
| Cash reserve | JuuBank, 20% of capital | The Bank keeps MUSD on hand for payouts, borrowing more from its trove but never below its 300% target ratio. |
| Trove ratio | JuuBank, 300% target, 270% to 330% band | The Bank's own trove is kept far above Mezo's 110% minimum. |
| Bad debt | JuuBuffer `coverBadDebt` | If a collapsed bet is worth less than zero, the safety jar pays the difference to the Bank. |
| Setting bounds | MUSDash `setRisk`, `setPremium`, `setLeverage` | Maintenance under 10%, trading fee under 1%, leverage at least 1x, premium growth and kill level at most 100%. |
| Swap fee cap | JuuSwap `MAX_FEE` | 0.5% hard cap; the fee can be turned off. |
| Agent rules | AgentGateway | Max per bet, highest floor, a daily realised loss stop, expiry, revoke. |
| Price impact | App only | The Principal Market and Swap pages refuse orders that would move a pool more than 5%. The contracts themselves only enforce the minimum output the user signs. |

## Who can do what (threat model)

| Actor | Can | Can't | Risk |
| --- | --- | --- | --- |
| **Owner** (the deployer key, one key) | Change settings on every contract: fees, leverage, risk, Climb Premium, haircuts, keeper address, fee sinks. Point the Bank and Buffer at a different game or jackpot contract (`setGame`, `setJackpot`). | Call any function that moves a saver's BTC or mints P or Y directly. | A stolen or misused owner key could point the Bank at a contract of its choosing, which could then take the Bank's MUSD through `payOut`. There is no multisig and no timelock yet. On the demo stack the owner also sets the price. |
| **Keeper** (separate key) | Report weekly yield to the Pricer (which values Y chips), vote the series locks, commit and reveal the jackpot. Call the public time critical steps (collapses, unlocks, maturity, guards). | Change settings, or send funds to itself. | A wrong yield report would misprice Y chips until the next report; the Y haircut steps down when real yield comes in below the forecast. A keeper that stops means late collapses, a late unlock (Principal paid on a later Thursday) or a missed jackpot draw; anyone can call the public steps. |
| **Agent** (its own key) | Open, climb and close for a user, inside that user's rules. | Withdraw anything: winnings always go to the user (or the user's Loop). | It can lose the user's MUSD up to the rules. See the loss stop below. |
| **Players** | Open, climb, cash out, collapse floors that are due. | Take more than a bet's capped win. | A crowded side pays funding; a floor collapse takes the bet's chips. |
| **Price feed** | Sets every mark on the main stack (Mezo's feed). | | A wrong or stale price would collapse or pay out wrongly. Juu adds no second source. |
| **Data API and MCP server** | Read the chain; the MCP server signs only with the agent key the client sends. | Sign for a user. | If they are down the contracts still work, but the app shows less. The MCP server sees each agent key in the requests it serves. |

## The daily realised loss stop

The AgentGateway's loss stop **counts losses from closed bets** (including collapsed ones) since 00:00 UTC. Once they
reach the user's limit, the agent can't open or climb until the next UTC day; it can still close. **Open bets can lose
more until they close**, so the most a user can lose in a day is the limit plus whatever their open agent bets lose
when they later close or collapse (each capped by the max per bet). Shown working: an open refused with
`StoppedForToday` after the limit was reached (simulated).

## Jackpot reveal timing

The draw is commit and reveal: the keeper commits a hash of a secret before the epoch ends, anyone seals the tickets
after it ends, and the keeper reveals within 256 blocks of the seal. The winning ticket comes from the secret and the
hash of the block after the seal, so neither the keeper (when committing) nor a block producer can choose it.

The risk: once that block exists, **the keeper can work out the winner before revealing**. A dishonest keeper could
then refuse to reveal; after 256 blocks the reveal fails (`TooLate`) and that epoch is not drawn. The prize stays in the
Buffer for a later draw, so no money is lost, but a keeper could skip draws it doesn't like. A keeper that is offline
for those 256 blocks also skips the draw. Fix before mainnet: a reveal bond or a public randomness source.

## The Climb Premium has no cap

On floors 7 to 10 each new seat pays a premium to the positions already on that floor: 1 MUSD for the first seat in an
epoch, then 10% more for each next seat on that floor. **There is no maximum**: within one epoch the premium keeps
growing by 10% per seat; it resets each epoch. It pays earlier climbers from later entries. The kill switch turns it
off for good once new top floor seats in an epoch fall below half of the epoch before (shown working on the demo stack).

## Not tested yet

* **Maturity and Principal redemption.** The first series ends Thu 10 Dec 2026; `mature` and `redeemP` have not run.
  The keeper is set to call `mature` from one hour after the end date and retry until it succeeds.
* **Yield rewards credited to Yield chips** posted in MUSDash: no rewards have arrived yet (Mezo pays a week's rewards
  after the week ends).
* **The weekly jackpot on the main stack** (it ran on the demo stack's 15 minute epochs).
* **The app's Trove Door page with a real wallet** (the contract flows ran by direct calls; see evidence.md).

## Other limits

* **Small pools.** The Principal Market pools for series 1 and 2 hold about 0.0065 BTC each and series 0 about 0.001 BTC, so larger orders move the price a lot.
* **The demo stack's price is set by hand.** It exists to show collapses; the main stack uses Mezo's price feed.
* **Gas.** Closing a Juu account bet can cost 4 to 6 million gas (Mezo re-sorts the trove list), so the guard closes one
  bet per call.
* **Mezo's testnet RPC** sometimes fails a receipt lookup; the backend polls receipts with retries.
