# Other contracts in detail

## JuuJackpot

* `commit(epoch, hash)` (keeper): before the epoch ends.
* `MUSDash.checkpoint(epoch)` (anyone): after it ends, seals the tickets and records the seal block.
* `reveal(epoch, secret)` (anyone with the secret): between seal block + 2 and seal block + 256. Winning ticket = `keccak256(secret, blockhash(sealBlock + 1)) mod totalTickets`. Prize = Buffer balance above `target()`, which is 5% of all open position size.
* `skip(epoch)`: after a missed reveal window or with no commit. The surplus stays.
* For positions held by the Agent Gateway, the prize goes to `gateway.positionUser(id)`.

## JuuBuffer (v2)

`coverBadDebt` (MUSDash only) and `payJackpot` (Jackpot only). Receives fees and penalties as plain MUSD transfers.

## JuuLoop

* `setLoop(on, seriesId)`: eligible if the caller holds that series' P or Y and the series is Open.
* `loopWinnings(user, amount)`: MUSDash and the Agent Gateway only. Swaps MUSD to BTC on Mezo's Router with `minOut = amount / price x (1 - maxSlippage)` (12% on testnet), then `Splitter.zap{value}(series, user)`. On any failure the user gets the MUSD (or the BTC if only the zap failed).

## JuuPMarket

`createPool(seriesId)`, `poolOf`, `priceOfP` (BTC per P from reserves), `impliedReturn` (fixed return to the end date and seconds left), `quoteBuy`, `buyP(seriesId, minPOut)` with plain BTC, `sellP(seriesId, amount, minBtcOut)`. Pools are Mezo DEX volatile pools.

## JuuSavingsSplitter (Door 2)

* `deposit(seriesId, amount)`: sMUSD in, P and Y out 1:1.
* Yield: on every deposit, harvest and claim, the contract claims sMUSD's yield and books each series' share as `principal x (yieldIndex now - yieldIndex last booked)`, the same formula sMUSD uses for holders.
* `claimY`, `mature` (after the end date: withdraws the series' sMUSD as MUSD), `redeemP` (1 P for 1 MUSD).

## JuuAccount and JuuAccountFactory (Door 3)

* `JuuAccountFactory.create()` makes one account per user, owned only by them.
* Owner: `openTrove(debt)` with BTC, `addCollateral`, `borrow`, `repay`, `withdrawCollateral` (must stay 0.2 above the guard ratio), `withdrawMUSD`, `closeTrove` (no open bets), `play(side, floor, margin)`, `moveFloor`, `close`, `setGuard(icr, tcr)` (at least 120% and 150%).
* `play` borrows what it needs and refuses if chips in play would exceed `capacity()` (80% of net worth) or the trove would fall below the guard ratio + 10%.
* On close: returned chips repay debt (down to Mezo's minimum loan); profit is swapped to BTC and added as collateral, or repays debt if the swap would lose more than 12%.
* `guard()` (anyone, when `shouldGuard()`): trove ratio below `guardICR` (130%) or Mezo's system ratio below `guardTCR` (160%). Closes every bet it can. `sync()` drops bets that collapsed.
* Mezo fixes a trove's borrowing cap at opening; `borrow` refinances first when needed.
