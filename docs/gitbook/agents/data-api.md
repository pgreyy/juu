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
| `GET /api/:stack/leaderboard?type=all` | Ranking by realized profit: `all`, `agents` or `humans` |
| `GET /api/:stack/agents/:user` | The sessions a user has granted, with their rules |
| `GET /api/:stack/agent-fee` | The agent fee rate, minimum and split |

## Running it

```
cd backend
npm install
npm start
```

The backend reads contract addresses from `backend/config/addresses.json` and the keeper's key from the project's `.env` file. To serve the API without sending any transactions, start it with `KEEPER_DRY_RUN=1 npm start`.
