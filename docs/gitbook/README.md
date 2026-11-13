# Introduction

**Ten floors. How high?**

Juu is a Bitcoin-native financial layer on Mezo. Bring in a BTC position (plain BTC, a veBTC NFT, sMUSD or a Mezo trove) and Juu splits it into Principal and Yield tokens. Play your Yield in MUSDash, a 10 floor bull or bear leverage game where the players who survive collect the penalties and fees of the ones who fall. Or skip the game and earn: lock a fixed rate on the Principal Market, or save in the Bank, the 300% collateralised trove that backs the game. A weekly jackpot, optional looping, and Juu Agents (AI agents that play beside humans on their own leaderboard) complete it. Live on Mezo testnet.

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
| Bank (with a 20% cash reserve) | Live on testnet |
| MUSDash with MUSD, Y and P chips | Live on testnet (plus a separate demo deployment) |
| Climb Premium, Buffer and jackpot | Live on testnet |
| Loop | Live on testnet |
| P Market | Live on testnet (small seed pools) |
| Juu Agents (gateway, data API, MCP server, leaderboard) | Live on testnet |
| Juu account (Door 3) | Live on testnet |
| Keeper bot | Running from the project's backend |

See [Contracts and addresses](technical/contracts-and-addresses.md) for every address and the transactions that show each part working.

## Where to start

* Want to play? Read [For players](guides/for-players.md).
* Want to earn as the house? Read [For savers](guides/for-savers.md).
* Want a fixed return with no game? Read [For fixed yield](guides/for-fixed-yield.md).
* New to the words? The [Glossary](reference/glossary.md) explains them.
