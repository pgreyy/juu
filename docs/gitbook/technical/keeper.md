# Keeper bot

Juu's keeper bot runs the scheduled steps that keep Juu working. It is part of the Node backend (`backend/`), together with the [data API](../agents/data-api.md). The time-critical steps can also be called by anyone; the keeper makes sure they happen on time.

## Jobs

| Job | Every | What it does |
| --- | --- | --- |
| `liquidations` | 20 s | Collapses every floor that is due. Agent positions go through the Agent Gateway so their rewards reach the user. |
| `funding` | 1 h | Brings funding up to date on each game. |
| `series` | 2 min | Starts each series' unlock in its unlock week (from one hour into the week, before that week's vote) and pays out each series from one hour after its end date; also matures sMUSD series. Warns if an unlock or payout is late. |
| `voting` | 10 min | Each series lock votes once a week for the gauge that paid the most per vote the week before. Skips a lock whose unlock is due first. |
| `rewards` | 6 h | Collects series rewards for Y holders, sMUSD yield, the Banks' Y rewards and matured P; once a week reports the weekly yield to the Pricers. |
| `killSwitch` | 1 min | Checks the Climb Premium kill switch after each epoch ends. |
| `jackpot` | 1 min | Commits a secret for each epoch, seals each finished epoch's tickets, reveals within 256 blocks, or skips. |
| `bank` | 30 min | Rebalances each Bank's Mezo loan when it leaves its band or has idle BTC. |
| `guards` | 1 min | Calls the safety guard on any Juu account whose loan nears danger or when Mezo nears Recovery Mode. |
| `prices` | 1 min | Samples each stack's BTC price for the price history. |
| `events` | 30 s | Scans game, gateway, jackpot and account events for the API and leaderboard. |

## Never slipping a payout

A series' unlock must happen in the week that opens 30 days before its end date; if it happens later, Mezo sets the lock to end on a later Thursday. The `series` job checks every two minutes and calls `startUnlock` as soon as Mezo allows it in that week (one hour after the week opens). The `voting` job skips any lock whose unlock is still due, because a vote cast that week would block the unlock until the next week. The payout (`mature`) is called from one hour after the end date and retried every two minutes until it succeeds.

## Warnings

* Any job that fails records the error and raises a warning.
* A job that hasn't succeeded for three of its intervals is marked late.
* `series` raises a critical warning if a payout is more than three hours late or if an unlocked lock doesn't end on its series end date.

## Checking it

| Endpoint | Shows |
| --- | --- |
| `GET /health` | `ok`, late jobs, failing jobs, warnings from the last hour |
| `GET /jobs` | Every job: runs, failures, last run, last success, last error; recent keeper transactions; recent warnings |

## Running it

```
cd backend
npm install
npm start
```

The keeper signs with its own wallet (`KEEPER_KEY` in the project's `.env`), which is set as keeper on the Splitter, the Pricers and the Jackpots. It needs a little BTC for gas.
