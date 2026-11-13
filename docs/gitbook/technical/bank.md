# Bank in detail

Contract: `JuuBank` (v5), an ERC-20 share token (jBANK).

## Value

```
effective debt = trove debt - 200 MUSD           (Mezo refunds the 200 MUSD gas deposit at close)
token value    = sum over series of Pricer.yValue(Y held) + Pricer.pValue(P held)
NAV (BTC)      = idle BTC + trove collateral + (MUSD held + token value - effective debt) / price
capital (MUSD) = NAV x price
maxExposure    = capital x 20%
```

## Shares

```
deposit:  shares = BTC in x (supply + 1000) / (NAV before + 1)
```

The small offset protects the first depositors from share-price tricks.

## Withdraw

Burning a fraction `f` of all shares pays:

* `f` of idle BTC,
* `f` of the trove collateral, in BTC,
* plus MUSD only from the part of the Bank's MUSD that is above its effective debt.

If the Bank holds less MUSD than it owes, the gap is shared: the saver takes that much less BTC.

The saver also gets fraction `f` of every Y and P token the Bank holds.

The saver's share of the debt is repaid from the MUSD that backs it, down to Mezo's minimum loan (1,800 MUSD plus the 200 MUSD deposit). Repaying lowers MUSD and debt by the same amount, so it doesn't change anyone's value.

The last saver's withdrawal closes the trove. Closing needs MUSD equal to the debt minus 200.

## Cash reserve

```
reserveTarget = capitalMUSD x reserveShare        (reserveShare = 20%, setReserveShare)
```

* `topUpReserve()` (anyone; the keeper calls it when MUSD on hand < target): borrows `min(target - on hand, room)` where `room` keeps the trove at `targetCR` (300%). Refinances first if Mezo's borrowing cap is in the way. Emits `ReserveToppedUp`, and `ReserveShort` if it couldn't reach the target (or has no trove).
* `rebalance()` repays only from MUSD above the reserve.
* MUSDash checks `liquidity()` against each new bet's worst-case win.

## Rebalance

`rebalance()` (anyone; the keeper calls it on a schedule):

* **No trove yet:** if idle BTC can carry Mezo's minimum loan at the target ratio, it opens a trove with all of it.
* **Trove open:** adds idle BTC as collateral, then:
  * above 330%: borrows up to 300%. Mezo fixes a trove's borrowing cap when it opens, so the Bank refinances first if needed (a small Mezo fee).
  * below 270%: repays from MUSD held, down to Mezo's minimum loan.

## Y and P held

* `setValuation(splitter, pricer)` (owner): which Splitter's P and Y to count and which Pricer values them.
* `tokenValueMUSD()`: their value now.
* `claimY(id)` (anyone): claims the rewards of the Bank's Y in series `id` into the Bank.
* `redeemP(id)` (anyone): redeems all the Bank's matured P in series `id` for BTC.

## Game hooks

* `payOut(to, amount)`: only MUSDash. Pays a winner's gain from the Bank's MUSD, or buys Y and P chips from a player who owes MUSD.
* Income (fees, losses, penalties) arrives as plain MUSD transfers.

## On-chain test

See the transaction list on [Contracts and addresses](contracts-and-addresses.md). The test opened a trove, borrowed, repaid, paid a 10% withdrawal in BTC (exactly 10% of the Bank's value) and closed the trove with the last withdrawal.

## Live state

Bank v5 (main) opened its Mezo loan at 300% with 0.09 BTC and is MUSDash v4's Bank. The 0.09 BTC moved over from Bank v4, which was closed. The demo Bank v5 holds 0.02 BTC and 150 MUSD, with no Mezo loan.

## Known limits

* If game losses leave the Bank owing more MUSD than it holds, the last saver can't close the trove until MUSD is added.
* MUSDash checks each **new** bet against MUSD on hand, not the sum of all open bets. A win that arrives after MUSD on hand has fallen (paid to other winners first) can still have to wait for the next top-up.
* Mezo trove operations without position hints cost millions of gas (Mezo re-sorts its list of ~370 troves). Passing hints would cut this a lot; it is a planned improvement.
