# Overview

Juu is built from a few parts that pass value to each other. Each part uses Mezo's own contracts instead of rebuilding them.

## The parts

* **[Doors](doors.md)**: the ways in. Bring a veBTC lock, plain BTC, sMUSD or a Mezo loan.
* **[Splitter](splitter.md)**: holds your BTC in a Mezo veBTC lock and gives you P and Y tokens for it.
* **[P and Y](p-and-y.md)**: the two tokens. P is your BTC back on a date; Y is what it earns until then.
* **[Series](series.md)**: P and Y are grouped by end date. Each date has its own P and Y.
* **[Pricer](pricer.md)**: decides how much each chip counts for in the game.
* **[Bank](bank.md)**: savers' pot. It backs the game with MUSD borrowed at Mezo.
* **[MUSDash](musdash.md)**: the game. Ten floors of bets on BTC going up or down.
* **[Climb Premium](climb-premium.md)**: an extra seat price on the top floors, with a kill switch.
* **[Buffer and jackpot](buffer-and-jackpot.md)**: the safety jar and the weekly prize from its overflow.
* **[Loop](loop.md)**: winnings go back into your BTC lock, so your harvest grows.
* **[P Market](p-market.md)**: buy P below full price for a fixed return, no game needed.

## What Juu uses from Mezo

| Need | Mezo contract |
| --- | --- |
| Locking BTC | veBTC |
| Voting for rewards | Voter (gauges) |
| Weekly BTC rebase | RewardsDistributor |
| Borrowing MUSD | MUSD BorrowerOperations and TroveManager |
| BTC price | MUSD PriceFeed |
| Swapping MUSD and BTC | Mezo DEX Router |
| MUSD savings yield | MUSD Savings Rate (sMUSD) |

## How money moves

1. You lock BTC through the Splitter and get P and Y.
2. The Splitter votes your locked BTC at Mezo every week and collects the rewards for Y holders.
3. On the series end date, the BTC comes out of Mezo and P holders get it back.
4. In MUSDash, players' chips sit in the game. Losses go to the Bank and the Bank pays winners. When both sides are open, one side's losses pay the other side's wins.
5. Fees and penalties feed the Bank and the Buffer.
