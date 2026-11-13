# P and Y

When you put BTC into the Splitter, you get two tokens: one **P** and one **Y** for every BTC.

## P: Principal

P is your BTC, paid back on the series end date.

* After the end date, 1 P can be redeemed for 1 BTC.
* Before the end date, P can be sold or used as a chip. Because you have to wait for it, P usually sells for a little less than 1 BTC. Buying it below 1 BTC is how the [P Market](p-market.md) gives a fixed return.

## Y: Yield

Y is everything the BTC earns until the series end date.

Y holders earn:

* **Voting rewards.** Each week the series lock votes at Mezo, and the reward pool pays it in MUSD and other tokens.
* **The BTC rebase.** Mezo adds a small BTC reward into veBTC locks each week. It builds up inside the series lock and is paid to Y holders when the lock is withdrawn at the end date.

You claim Y rewards whenever you like. If you send Y to someone else, the rewards earned so far stay yours, and the new holder earns from then on.

After the end date, Y stops earning.

## Both are ordinary tokens

P and Y are standard ERC-20 tokens, the format every wallet and app understands. Each series has its own P and its own Y, so other apps can tell them apart.

## Example

You zap 1 BTC into the series ending 31 Dec 2026. You get 1 P-veBTC-DEC26 and 1 Y-veBTC-DEC26.

* You keep Y and claim its MUSD rewards each week.
* You sell P to someone for 0.99 BTC today. They redeem it for 1 BTC after 31 December.
