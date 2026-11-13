# Series

A series is a group of P and Y tokens that share one end date.

## Why series exist

Not every P is worth the same. P that pays back next week is worth more today than P that pays back in three months. So each end date gets its own P token and its own Y token.

Juu picks the end dates, for example monthly or quarterly. They are always **Thursdays at 00:00 UTC**, because Mezo's veBTC locks end on Thursdays.

## Live series (testnet)

| Series | End date | P | Y |
| --- | --- | --- | --- |
| 0 (short demo) | Thu 10 Dec 2026 | P-veBTC-DEC10 | Y-veBTC-DEC10 |
| 1 | Thu 31 Dec 2026 | P-veBTC-DEC26 | Y-veBTC-DEC26 |
| 2 | Thu 25 Mar 2027 | P-veBTC-MAR27 | Y-veBTC-MAR27 |

Addresses are on [Contracts and addresses](../technical/contracts-and-addresses.md).

## The life of a series

1. **Open.** The series lock is permanent, so it votes at full strength. You can deposit BTC or a veBTC lock.
2. **Unlocking.** About 30 days before the end date (in the week that opens 30 days before it), the lock is switched back to normal. Mezo sets it to end exactly on the end date. Deposits close. Y still earns, a little less each week.
3. **Matured.** From one hour after the end date, the BTC is withdrawn from Mezo. Each P can now be redeemed for 1 BTC. Any extra BTC that built up in the lock goes to Y holders.

Juu's keeper bot starts the unlock in the right week and triggers the payout right after the end date, so the payout does not slip. Anyone else can call both steps too.

## The short demo series

Series 0 ends on 10 December 2026, about four weeks after it opened. It exists so the whole cycle (lock, split, unlock, payout) can be seen in a short time. It works exactly like the others.
