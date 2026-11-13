# Doors: what you can bring in

A door is a way to bring something you already hold on Mezo into Juu.

| Door | You bring | You get | Status |
| --- | --- | --- | --- |
| 1 | A veBTC lock (NFT) | P and Y of a series | Live on testnet |
| 2 | sMUSD (Mezo's MUSD savings token) | P and Y of an sMUSD series | Live on testnet |
| 3 | A fresh Mezo loan in a personal Juu account, or the MUSD you borrowed | Margin in MUSDash | Live on testnet |
| 4 | Plain BTC | P and Y of a series | Live on testnet |

## Door 1: a veBTC lock

You hand your veBTC lock to the Splitter. It joins the series lock and you get P and Y equal to the BTC in it.

Before you deposit:

* **Claim your own rewards first.** Rewards your lock earned but you didn't claim go to the series' Y holders after the deposit.
* **If your lock voted this week, wait until next week.** Mezo only lets a vote be cleared once a new week has started.
* Your lock can end on any date. Once deposited, your BTC follows the series end date instead.

## Door 2: sMUSD

sMUSD is Mezo's MUSD savings token. On testnet it is 1 sMUSD per MUSD, and its savings yield is paid separately. Juu splits it:

* **P-sMUSD** is the MUSD: after the series end date, 1 P redeems for 1 MUSD.
* **Y-sMUSD** is the savings yield sMUSD earns until the end date. Claim it any time.

sMUSD series use the same end dates as the veBTC series. Your MUSD stays in Juu (as sMUSD) until the end date.

How: approve the sMUSD Splitter for your sMUSD, then `deposit(seriesId, amount)`.

## Door 3: a Mezo loan

Mezo has no way to move a loan (a "trove") from one owner to another, so Door 3 works in one of two ways.

**Juu account (Option B).** You create a personal Juu account, a small contract wallet only you control, and open a **fresh** Mezo loan inside it.

* **Its value counts as margin.** You can keep chips in play up to 80% of the account's net worth: collateral value minus debt, plus MUSD held, plus chips already in play.
* **Borrow straight into the game.** When you bet, the account borrows the MUSD it needs from its own loan at Mezo's fixed rate.
* **Wins go back into the loan.** The borrowed chips repay debt and the profit is swapped to BTC (with a price loss limit) and added as collateral.
* **Losses come out of the loan.** Lost chips were borrowed, so their debt stays on the loan.
* **Safety guard.** If the loan's collateral falls below 130% of its debt, or Mezo's whole system falls below 160% (before Recovery Mode at 150%), the keeper closes the account's bets, one per call, well before Mezo's 110% liquidation line. (Each close costs a lot of gas on Mezo, so closing them one at a time keeps every call inside the block gas limit.)

**Bring the MUSD (Option A).** Borrow MUSD at Mezo yourself and play with it as MUSD chips.

## Door 4: plain BTC

Send BTC and pick a series. The Splitter locks it at Mezo for you and you get P and Y.
