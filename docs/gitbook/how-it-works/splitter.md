# Splitter

The Splitter takes BTC locked in Mezo's veBTC and gives you two tokens for it: **P** and **Y**.

{% hint style="info" %}
**Your BTC stays in Juu until your series end date.** It sits in a Mezo veBTC lock held by the Splitter. You get it back by redeeming P after that date.
{% endhint %}

## What it does

1. **Takes your BTC in.** Either a veBTC lock you already have (Door 1) or plain BTC (Door 4).
2. **Keeps it locked at Mezo.** Each series has one veBTC lock. Everything deposited into that series goes into it.
3. **Gives you P and Y.** One P and one Y for each BTC you add.
4. **Votes every week.** The lock votes at Mezo for the reward pool that pays the most. The rewards go to Y holders.
5. **Pays you back.** After the series end date, the BTC comes out of Mezo and each P is worth 1 BTC.

## Why the lock stays strong

veBTC's voting power usually shrinks as the unlock date gets closer, and less voting power means less reward. Mezo's longest lock is 30 days.

Juu gets around both by keeping each series lock **permanent** until about 30 days before its end date. A permanent lock keeps full voting power. Then the lock is switched back to normal, and Mezo sets it to end exactly on the series end date.

So for most of a series, Y earns at full strength. In the last month, it earns less each week as the lock winds down.

## Who can do what

* Anyone can deposit into an open series.
* Anyone can start a series' unlock in its unlock week, and anyone can trigger the payout after the end date. Juu's keeper bot does both on schedule so payouts are not late.
* Only Juu's keeper picks which reward pool to vote for.

See [Splitter in detail](../technical/splitter.md) for the full mechanics.
