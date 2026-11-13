# Bank

The Bank is the pot that backs MUSDash, like the house money at a table. Savers who don't want to play put BTC in and earn from the game instead.

## What it does

* **Savers deposit BTC** and get Bank shares (jBANK).
* **The Bank opens one Mezo loan** (a "trove") with that BTC as collateral, keeping it at about **300%** collateral. That means $3 of BTC behind every $1 borrowed.
* **It borrows MUSD at Mezo's fixed rate** (1% a year, plus Mezo's one-time 0.1% fee).
* **That MUSD backs the game.** When one side of MUSDash is bigger than the other, the Bank covers the difference and pays winners.

{% hint style="info" %}
**Status:** live on testnet. Its Mezo loan is open at 300%, and it backs MUSDash: it pays winners and receives fees and losses.
{% endhint %}

## Why it is needed

If Bulls have $100,000 in play and Bears only $60,000, and BTC jumps, the Bears' losses can't cover all of the Bulls' wins. The Bank pays the gap.

To keep that risk in check, MUSDash will not let the gap between the sides grow above **20% of the Bank's capital**.

## How savers earn

The Bank earns:

* a share of every trading fee, and half of every agent fee,
* funding paid by the crowded side when the Bank covers the gap,
* a share of every collapsed floor's penalty,
* the losses of players on the losing side, paid in MUSD or in Y and P chips at the Pricer's value.

It pays out the wins of players on the winning side. Over time, savers earn when the Bank's income is bigger than what it pays out plus Mezo's interest.

## Keeping the loan healthy

The Bank's keeper calls **rebalance** on a schedule:

* If collateral rises well above 300% (above 330%), the Bank borrows more MUSD.
* If it falls well below (under 270%), the Bank repays MUSD.

300% is far above Mezo's 110% liquidation line. That also keeps the Bank away from the front of Mezo's redemption line, which hits the riskiest loans first.

## Withdrawing

You can withdraw any time by burning shares. You get your fair slice of the Bank:

* **in BTC**, from the Bank's collateral,
* **plus MUSD** only if the Bank holds more MUSD than it owes,
* **plus your share of any Y and P** the Bank has taken from players.

## Y and P the Bank holds

When players lose Y or P chips, the Bank takes them. It counts them in its value at the Pricer's margin value. Anyone can make the Bank claim the rewards of its Y, or redeem its P for BTC once a series has ended.

The MUSD that backs the loan stays in the Bank, so the game keeps its money to pay winners.

{% hint style="warning" %}
While Mezo is in **Recovery Mode** (when Mezo's whole system falls below 150% collateral), Mezo blocks taking collateral out of loans. Withdrawals that need the Bank's collateral wait until Recovery Mode ends.
{% endhint %}

See [Bank in detail](../technical/bank.md) for share math and the on-chain test.
