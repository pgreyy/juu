# MUSDash in detail

Contract: `MUSDash` (v4), with `JuuBuffer` (v2) and `JuuJackpot`. Live on testnet; addresses and the test transactions are on [Contracts and addresses](contracts-and-addresses.md). The epoch length is set when deployed: 1 week on main, 15 minutes on the demo deployment.

The protocol's 20% of trading fees goes to a treasury address, currently the deployer's testnet wallet.

## Position

| Field | Meaning |
| --- | --- |
| `side` | 0 Bull, 1 Bear |
| `floor` | 1 to 10 |
| `chip` | 0 MUSD, 1 Y, 2 P |
| `seriesId` | series of the Y or P chips |
| `tokens` | chips held (MUSD, Y or P) |
| `size` | chip value at open x leverage(floor) |
| `entryPrice` | BTC price when opened |
| `fundingIndex`, `accA`, `accB` | snapshots for funding and survivor rewards |

## Value

```
chip value = tokens (MUSD), Pricer.yValue (Y) or Pricer.pValue (P), read now
             + for Y: rewards earned since the position opened (MUSD 1:1, BTC at price; MEZO not valued)
pnl        = size x (price - entry) / entry       (Bull; sign flipped for Bear)
funding    = size x (side funding index now - index at open)
equity     = chip value + pnl - funding
collapse when equity <= size x 2%
```

## Functions

| Function | What it does |
| --- | --- |
| `open(side, floor, margin)` | MUSD chips. Takes margin + 0.1% fee (approve MUSD first). Refuses if it would push the gap between sides above the Bank's `maxExposure`. |
| `openWithTokens(side, floor, chip, seriesId, amount)` | Y or P chips (approve the token first). The fee is paid by the Bank, which takes that value of chips. |
| `sweepYRewards(seriesId)` | Anyone. Claims the rewards of Y posted as chips and sends them to the Bank. |
| `close(id)` | Settles the result with the Bank, adds survivor rewards, takes the fee, returns your chips plus any gain. |
| `moveFloor(id, toFloor)` | Books the result, takes the fee, reopens the same chips on the new floor at today's price. Emits `Agaruzo` when climbing. |
| `liquidate(id)` | Anyone, once due. Splits what is left: 50% survivors, 25% Buffer, 25% Bank. Bad debt goes to the Buffer. |
| `updateFunding()` | Brings funding up to date (keeper, hourly). |
| `positionValue(id)` | pnl, funding, equity, rewards, whether it can collapse, collapse price. |

## How Y and P chips settle

```
cash = pnl - funding - fee + survivor reward
```

* `cash >= 0`: you get all your chips back plus `cash` in MUSD.
* `cash < 0`: the Bank pays `-cash` in MUSD and takes chips worth that much: `chips taken = tokens x owed / chip value` (rounded up, in the Bank's favour). You get the rest back.
* Collapse: all chips go to the Bank. The Bank pays the survivors' and Buffer's shares in MUSD.
* Moving floors with Y or P: a gain is paid to you in MUSD; the chips stay on the new floor at their value now.

## Win cap and Bank cash check (v4)

```
worstCaseWin(size) = size x maxWinShare           (maxWinShare = 100%, setMaxWinShare)
pnl is capped at worstCaseWin(size)
open / move: refused with BankCannotCoverWin if bank.liquidity() < worstCaseWin(new size)
```

## Y rewards on posted Y

MUSDash snapshots the Splitter's per-Y reward totals (`accPerY`) for each reward token when a Y position opens. A position's rewards are `tokens x (accPerY now - snapshot)`, less 10 wei against rounding. On close or move, MUSDash claims the series' Y rewards and pays this position its share (MUSD as part of the cash result, BTC and MEZO directly). On collapse they go to the Bank with the chips.

## Climb Premium

```
premium(seat) = premiumBase x (1 + premiumGrowth) ^ seat      seat = seats taken on that floor this epoch
```

Paid when a position opens on, or moves onto, floors 7 to 10. Shared by the floor's positions by size through an accumulator per floor (`premiumAcc`); with nobody on the floor, it goes to the Bank. `checkKillSwitch()` (and every new seat) compares the epoch just ended with the one before: if `topSeats[last] < killLevel x topSeats[previous]`, `premiumOn` becomes false for good.

## Jackpot tickets

Each position records tickets `size x seconds held` per epoch in a ledger (`ticketAt`, `totalTickets`, `findTicket`). `checkpoint(epoch)` (anyone, after the epoch ends) counts every open position up to the epoch's end and seals it. `JuuJackpot` draws from the sealed ledger with commit and reveal and pays from the Buffer's surplus.

## Loop

If the owner turned the Loop on (`JuuLoop.isOn`), MUSD winnings from `close` (and from `moveFloor` with Y or P chips) are handed to `JuuLoop.loopWinnings`. If that call fails, the owner gets the MUSD.

## Result events (leaderboard)

Every open, close, move and collapse emits `Result(id, owner, result)`: the realized MUSD result of that step (fees and premiums paid negative; gains, losses, funding, survivor and premium earnings and Y rewards included).

## Funding

```
rate per hour = k x (bull size - bear size) / (bull size + bear size),   k = 0.01%
```

The Bull index moves up by the rate and the Bear index down. A side with a rising index pays; a side with a falling index receives. Because every result settles with the Bank, the Bank ends up with the crowded side's payments minus what the quiet side receives, which is the funding on the gap it covers.

## Survivor rewards (size x time)

When a floor collapses, the survivors' share is split by `size x (now - openedAt)` across open positions on that side. Two running totals per side make this cheap:

```
weight = now x open interest - sum(size x openedAt)
accA  += reward x now / weight
accB  += reward / weight
your reward = size x ((accA - accA at open) - openedAt x (accB - accB at open))
```

If no position on that side has any weight yet, the survivors' share goes to the Bank.

## Price feed

MUSDash reads whatever price feed it is deployed with. The main deployment uses Mezo's PriceFeed. A separate demo deployment, clearly labelled, uses `DemoPriceFeed`. That contract follows Mezo's price unless its owner sets a demo price, so a floor collapse can be shown without waiting for the market. The demo feed is never used by the main contracts.

## Not yet tested on chain

* **Y rewards credited to a Y position:** the code is deployed, but the series locks earn their first rewards only after Mezo's week ends (Thursday 19 November 2026), so no Y position has had rewards to credit yet.
