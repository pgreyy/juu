# MUSDash

MUSDash is the game: a building with ten floors, where every floor is a bet on Bitcoin's price.

{% hint style="info" %}
**Status:** live on testnet (MUSDash v3) with MUSD, Y and P as chips, the Climb Premium, jackpot tickets and the Loop. A separate, clearly labelled demo deployment lets the price be set by hand and uses 15-minute epochs, so collapses, the kill switch and jackpot draws can be shown on demand.
{% endhint %}

## Two sides

* **Bull** wins when BTC goes up.
* **Bear** wins when BTC goes down.

## Ten floors

Each floor uses a different **leverage**: how much bigger your bet is than your chips.

| Floor | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Leverage | 1.5x | 2x | 3x | 4x | 5x | 6x | 7x | 8x | 9x | 10x |

At 5x, 1,000 MUSD of chips controls 5,000 MUSD of BTC exposure. If BTC moves 10% your way, you gain 500 MUSD. If it moves 10% against you, you lose 500.

Positions are **synthetic**. No BTC is bought or sold. Your result is worked out from BTC's price on Mezo's price feed and paid in MUSD.

## Climbing: Agaruzo!

You can move a position to another floor. Your gains or losses so far are booked, then the same chips sit on the new floor at today's price. Moving up a floor is the **Agaruzo!** moment.

## When a floor collapses

If the price moves too far against you, your floor collapses (in trading terms, the position is liquidated). That happens when what your position is worth falls to 2% of its size:

```
collapse move = 1 / leverage - 2%
```

| Floor | 1 (1.5x) | 3 (3x) | 5 (5x) | 8 (8x) | 10 (10x) |
| --- | --- | --- | --- | --- | --- |
| Move that collapses it | about 65% | about 31% | 18% | 10.5% | 8% |

Anyone can trigger a collapse once it's due. Juu's keeper bot watches for them.

What is left of the margin when it collapses is the **penalty**. It is shared:

* **50%** to survivors on the same side, weighted by how big their position is and how long they've held it,
* **25%** to the Buffer,
* **25%** to the Bank.

If a position lost more than its chips (a very fast price move), the Buffer pays the difference to the Bank.

## Win cap and the Bank's cash

A bet can win at most **100% of its size** (a setting). For a Bear that's already the limit (BTC can't fall below zero); for a Bull it means BTC doubling while the bet is open.

Because the worst-case win is known, MUSDash checks before every new bet, and every climb to a bigger size, that the Bank holds enough MUSD on hand to pay it. If not, the bet is refused (`BankCannotCoverWin`). The [data API](../agents/data-api.md) shows the largest bet the Bank can cover right now.

## Who pays winners

All chips sit in the game. Every result settles with the Bank: losses go to the Bank, wins are paid by the Bank. When both Bulls and Bears are playing, one side's losses pay the other side's wins through the Bank. The Bank only carries the difference between the sides, and the game won't let that difference grow above 20% of the Bank's capital.

## Funding

When one side is much bigger, it pays a small fee to the other side every hour:

```
funding per hour = 0.01% x (bull - bear) / (bull + bear)
```

At the most lopsided, the crowded side pays 0.01% of its size per hour. The quiet side receives at the same rate, and the part that matches the gap goes to the Bank, which covers it.

## Climb Premium (floors 7 to 10)

Taking a seat on a top floor costs a premium on top of your chips, shared by those already on that floor. See [Climb Premium](climb-premium.md).

## Jackpot tickets

Every position earns jackpot tickets: size x time held each epoch. See [Buffer and jackpot](buffer-and-jackpot.md).

## Trading fee

Opening, closing and moving floors each cost 0.1% of the position size. The fee goes 50% to the Bank, 30% to the Buffer and 20% to the protocol.

## What you can post as chips

Each position uses one kind of chip:

* **MUSD.**
* **Y** of one series (yield mode). Only your future rewards are at stake; your BTC is never at risk.
* **P** of one series (principal mode). Your BTC is at stake: if you lose, P goes to the Bank.
* **A Mezo loan** through a personal Juu account (principal mode): planned.

Y and P count at the [Pricer](pricer.md)'s value, checked again every time the game looks at your position:

* A **P** chip's value moves with BTC. A Bull bet backed by P gains or loses twice when BTC moves: once on the bet and once on the chip. A Bear bet backed by P is partly hedged.
* A **Y** chip's value shrinks week by week as its series nears its end date.

When a Y or P position owes MUSD (a fee or a loss), the **Bank pays that MUSD and takes the same value of your chips**. You don't need MUSD to play with Y or P. When you close, you get the rest of your chips back, plus any gain in MUSD.

While Y sits in the game as chips, the rewards it earns are **credited to your position**. They count in its value (MUSD at face value, BTC at today's price), so a Y position isn't pushed toward collapse just because time passes. You receive them when the position closes or moves. If it collapses, they go to the Bank with the chips.

See [MUSDash in detail](../technical/musdash.md).
