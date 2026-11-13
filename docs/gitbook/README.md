# Introduction

Juu is a game layer for your Bitcoin on Mezo. You bring in a Mezo position, split it into parts, play with those parts, and send your winnings back into your Bitcoin.

The game inside Juu is called **MUSDash**. When you climb a floor, the building cheers **Agaruzo!** (Japanese for "it's going up!").

The name has two meanings. *Juu* means "up" in Swahili and "ten" in Japanese. MUSDash has ten floors.

{% hint style="warning" %}
Juu runs on Mezo **testnet** only. Testnet BTC and MUSD have no value. Some parts are still being built; each page says what is live.
{% endhint %}

## The idea in plain words

Think of your Bitcoin on Mezo as a farm. When you lock it in Mezo's veBTC, it produces a small harvest every week: the fees and rewards veBTC earns.

Juu splits that position in two:

* **P (Principal)** is the farm itself: your BTC, paid back on a set date.
* **Y (Yield)** is the harvest: everything the BTC earns until that date.

You can keep both, sell one, or take them into **MUSDash**, a building where every floor is a bet on Bitcoin's price going up or down. Low floors are small bets. High floors are big ones.

Savers who don't want to play can act as the **Bank**. They deposit BTC, the Bank borrows MUSD cheaply against it at Mezo, and that MUSD backs the game.

A safety jar under the building, the **Buffer**, catches bad falls.

## What is live today

| Part | Status |
| --- | --- |
| Splitter, P and Y, series (Doors 1 and 4) | Live on testnet |
| sMUSD door (Door 2) | Live on testnet |
| Pricer | Live on testnet |
| Bank | Live on testnet |
| MUSDash with MUSD, Y and P chips | Live on testnet (plus a separate demo deployment) |
| Climb Premium, Buffer and jackpot | Live on testnet |
| Loop | Live on testnet |
| P Market | Live on testnet (small seed pools) |
| Juu Agents (gateway, data API, MCP server, leaderboard) | Live on testnet |
| Juu account (Door 3) | Deployed; trove test pending |
| Keeper bot | Running from the project's backend |

See [Contracts and addresses](technical/contracts-and-addresses.md) for every address and the transactions that show each part working.

## Where to start

* Want to play? Read [For players](guides/for-players.md).
* Want to earn as the house? Read [For savers](guides/for-savers.md).
* Want a fixed return with no game? Read [For fixed yield](guides/for-fixed-yield.md).
* New to the words? The [Glossary](reference/glossary.md) explains them.
