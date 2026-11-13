# P Market

{% hint style="info" %}
**Status:** live on testnet: one P/BTC pool per series on Mezo's DEX, each seeded with a small amount.
{% endhint %}

The P Market is for people who want a fixed return and no game.

## How it gives a fixed return

P is a claim on 1 BTC paid on the series end date. Because you have to wait, P sells for a little less than 1 BTC.

Example: you buy 1 P for 0.96 BTC today. After the end date you redeem it for 1 BTC. That is a fixed return of about 4.2% for the wait, known the day you buy.

## How it is built

* Each series has one **P/BTC pool on Mezo's own DEX**.
* The **JuuPMarket** helper creates the pools, shows P's price and the fixed return it implies, and lets you buy or sell P with plain BTC through Mezo's Router.
* As the end date gets closer, P's price moves toward 1 BTC, because anyone holding P can soon redeem it for exactly 1 BTC.

## Things to know

* The test pools are tiny. A big buy moves the price a lot. On testnet, a buy of about 10% of a pool's BTC paid more than 1 BTC per P, while a buy of about 2% paid 0.96. Check `quoteBuy` before buying, and set a minimum amount out.
* The price you pay fixes your return only if you hold P to the end date.
