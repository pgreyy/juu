# Pricer

The Pricer decides how much each chip counts for when you use it in MUSDash. That amount is your **margin**: the money that backs a bet.

Chips are never counted at full value. Each kind gets a **haircut**, a safety discount, because its value can change or it can't be sold right away.

## Y

Y is a claim on future rewards, so its value is a forecast:

```
expected yield = weekly yield x weeks of yield left
Y margin value = expected yield x Y haircut
```

* **Weekly yield** is what 1 BTC at full voting power earned last week, in MUSD. Juu's keeper reports it each week.
* **Weeks of yield left** counts each week before the unlock as a full week. The last month, while voting power winds down to zero, counts as about 2.1 weeks in total.
* **Y haircut** starts at 80%. It slides: each week it moves down a step if real yield came in below the forecast, and up a step if above.

## P

P is BTC paid on a set date:

```
P margin value = P x BTC price x P haircut (90%)
```

The haircut covers the wait until the end date.

## A Mezo loan in a Juu account

```
loan margin value = (collateral value - debt) x loan haircut (80%)
```

This is for Door 3, which is planned.

## The BTC price

The Pricer reads BTC's price from Mezo's MUSD PriceFeed. That feed updates every block (about every 4 seconds). If it ever falls more than 60 seconds behind, Mezo's feed refuses to answer, and actions that need a price wait until it is fresh again.

See [Pricer in detail](../technical/pricer.md) for the exact math.
