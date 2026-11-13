# For savers

The Bank is for people who want to earn from the game without playing it. It is live on testnet.

## How to join

1. Call **deposit** on the Bank with the BTC you want to put in. You get Bank shares (jBANK).
2. That's it. The Bank's keeper looks after the Mezo loan.

At the start, about 1,000 shares stand for 1 BTC of Bank value. The value of each share then moves with the Bank's results.

## What your shares are worth

```
Bank value (in BTC) = BTC held + loan collateral + (MUSD held - MUSD owed) / BTC price
```

"MUSD owed" leaves out the 200 MUSD deposit that Mezo adds to every loan and refunds when it closes.

## Withdrawing

Call **withdraw** with the number of shares. You get your slice:

* in **BTC**,
* plus **MUSD** only if the Bank holds more MUSD than it owes,
* plus your share of any **Y and P** the Bank took from losing players.

## Where the Bank's income comes from

Trading fees, half of every agent fee, funding on the gap it covers, collapse penalties, losing players' chips, seat premiums on empty top floors, and the rewards of the Y it holds.

## What can go wrong

* **Players win on balance.** If the Bank pays out more to winners than it earns, share value falls.
* **Recovery Mode.** If Mezo's whole system drops below 150% collateral, Mezo blocks taking collateral out of loans. Withdrawals wait until it ends.
* **A big BTC drop.** The Bank's loan is kept at about 300%, so BTC would need to fall about 63% before the loan reached Mezo's 110% liquidation line. The keeper repays debt as the ratio falls, if the Bank holds MUSD to repay with.

More in [Risks](../reference/risks.md).
