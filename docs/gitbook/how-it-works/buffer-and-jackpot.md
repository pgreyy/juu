# Buffer and jackpot

{% hint style="info" %}
**Status:** live on testnet (Buffer v2 and the Jackpot contract), on both deployments.
{% endhint %}

## The Buffer

The Buffer is the safety jar under MUSDash.

* **It fills from:** 30% of every trading fee, 25% of every collapsed floor's penalty, and 50% of every agent fee.
* **It pays bad debt first:** if a position lost more than its chips (a very fast price move), the Buffer pays the difference to the Bank.

## The jackpot

The Buffer has a target size: **5% of all open positions**. Every epoch, anything above the target becomes the **jackpot**, paid to one player.

* **Tickets** = position size x time held during that epoch. A 100 MUSD position held for a whole epoch has twice the tickets of one held for half the epoch.
* Tickets are written on chain by MUSDash as positions are held, closed, moved or collapse. When an epoch ends, the keeper seals it: every open position's time up to the end is counted.

## The draw: commit and reveal

A fair draw needs randomness nobody controls alone.

1. **Commit.** Before the epoch ends, the keeper publishes a fingerprint (hash) of a secret number.
2. **Seal.** After the epoch ends, its tickets are sealed. Nothing can be added any more.
3. **Reveal.** The keeper reveals the secret within about 18 minutes (256 blocks). The winning ticket comes from mixing the secret with a block hash from just after the seal.

The keeper couldn't know that block hash when it committed, and block producers don't know the secret, so neither can pick the winner alone. If the reveal is missed, the epoch is skipped and its surplus stays for the next draw.

For positions played by agents, the jackpot goes to the user the agent plays for.

The demo deployment draws every **15 minutes**.
