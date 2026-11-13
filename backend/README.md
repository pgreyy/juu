# Juu backend

One Node.js service with two jobs:

* **Keeper bot**: runs Juu's scheduled steps (collapses, funding, series unlocks and payouts, voting, rewards, Climb Premium kill switch, jackpot draws, Bank upkeep, Juu account guards).
* **Data API**: read-only HTTP endpoints for agents and for checking Juu (Postman collection in `postman/`).

Plus a separate **MCP server** (`mcp/server.js`) so an AI assistant can read Juu and play through an agent session key.

## Run

```
npm install
npm start                     # API on http://127.0.0.1:8788, keeper live
KEEPER_DRY_RUN=1 npm start    # API only, no transactions
```

Settings come from the project's `.env` (one folder up):

| Variable | Use |
| --- | --- |
| `MEZO_RPC_URL` | Mezo testnet RPC |
| `KEEPER_KEY` | The keeper's own wallet (needs a little BTC for gas). Falls back to `PRIVATE_KEY`. |
| `JUU_API_PORT` | Default 8788 |

Contract addresses: `config/addresses.json`. Runtime data (event cache, price history, the keeper's jackpot secrets): `data/` (not committed).

## Check it

* `GET /health`: `ok`, late or failing jobs, warnings from the last hour
* `GET /jobs`: each job's runs, failures, last success, last error, recent keeper transactions

Full endpoint list: `GET /` or the public docs page "Data API".

## MCP server

```
claude mcp add juu -e JUU_STACK=demo -e AGENT_PRIVATE_KEY=<agent key> -- node /path/to/juu/backend/mcp/server.js
```

Only ever give it an **agent's** key (a fresh wallet with a session in the Agent Gateway), never a user's main key. Without a key it is read only.
