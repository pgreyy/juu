# Data API

A read-only HTTP API for agents (and anyone curious). It is served by the same Node backend as Juu's keeper bot. Nothing here can move funds.

Base URL when running locally: `http://127.0.0.1:8788`

`:stack` is `main` or `demo`. The demo stack can have its BTC price set by its owner, for demonstrations. It is labelled DEMO everywhere.

Amounts are decimal numbers in MUSD or BTC. Times are ISO dates in UTC.

## Endpoints

| Endpoint | What it returns |
| --- | --- |
| `GET /` | The list of endpoints |
| `GET /health` | Keeper health: late or failing jobs, warnings from the last hour |
| `GET /jobs` | Every keeper job with its last run, last success, last error, and recent transactions |
| `GET /api/series` | Every series: end date, phase, unlock date, BTC locked, Y and P margin values, P Market price and fixed return, sMUSD series |
| `GET /api/:stack/floors` | Each floor: leverage, the price move that collapses it, collapse prices for a new Bull or Bear, open size, seat premium, positions on it with their collapse prices |
| `GET /api/:stack/sides` | Bull and Bear open size, the gap the Bank carries, the most it may carry, room left |
| `GET /api/:stack/funding` | Funding per hour for each side (positive pays, negative receives) |
| `GET /api/:stack/climb-premium` | Next seat price on floors 7 to 10, seats this epoch, kill switch status |
| `GET /api/:stack/bank` | Bank capital, the most gap it may carry, MUSD on hand, Y and P held, its Mezo loan |
| `GET /api/:stack/price/history?minutes=60` | BTC price sampled every minute (up to 7 days) |
| `GET /api/:stack/collapses/recent?limit=20` | Recent floor collapses with how the penalty was shared |
| `GET /api/:stack/positions` | All open positions with live value, equity, collapse price, and whether an agent plays it |
| `GET /api/:stack/positions/:id` | One position |
| `GET /api/:stack/jackpot` | Buffer size, target, current prize, recent draws |
| `GET /api/:stack/leaderboard?type=all` | Ranking by realized profit: `all`, `agents` or `humans`, with each player's highest floor reached |
| `GET /api/:stack/agents/:user` | The sessions a user has granted, with their rules, the loss counted toward today's stop (`lossTodayMUSD`) and the net result of today's closes and collapses (`netTodayMUSD`, UTC day) |
| `GET /api/:stack/agent-fee` | The agent fee rate, minimum and split |
| `GET /api/:stack/feed?limit=20` | Recent moves, newest first: opens, climbs, drops, cash-outs, collapses (with floor and side) and jackpot draws, each with its time and transaction |
| `GET /api/:stack/tickets/:user` | This week's jackpot tickets for one address and for everyone, and the address's odds. One ticket is 1 MUSD of position size held for one hour |

Browsers can read the API directly only from the sites listed in `CORS_ORIGINS` in the `.env` (comma-separated). The
Juu app and landing page read it through their own `/api` path, so they don't depend on it.

## Running it

```
cd backend
npm install
npm start
```

The backend reads contract addresses from `backend/config/addresses.json` and the keeper's key from the project's `.env` file. To serve the API without sending any transactions, start it with `KEEPER_DRY_RUN=1 npm start`.

## Freshness

Answers under `/api/` are shared between everyone asking for a few seconds: an answer is fresh for 3 seconds; after that
the API still answers at once with the last one while it fetches a new one in the background (up to a minute old, only
when nobody asked for a while). The `X-Cache` header says which: `fresh`, `stale` or `miss`. `/health` and `/jobs` are
never cached.

