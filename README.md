# Juu

A game layer for Bitcoin on Mezo. Bring a Mezo position in, split it into P (principal) and Y (yield), play them in MUSDash, a ten-floor game of BTC bets, and loop the winnings back. Runs on Mezo testnet.

## Layout

| Folder | What |
| --- | --- |
| `contracts/` | Solidity contracts (Foundry) and deploy scripts |
| `backend/` | Keeper bot, data API for agents, MCP server (Node.js, Express) |
| `docs/gitbook/` | Public docs (GitBook, `SUMMARY.md`) |
| `docs/build-log.md` | Internal build log with every deployment and test transaction |
| `scripts/` | Small helpers for sending testnet transactions |

## Setup

1. Copy `.env.example` to `.env` and fill in a testnet key. Never commit `.env`.
2. Contracts: see `contracts/README.md`.
3. Backend: `cd backend && npm install && npm start`.

Spec: `juu-spec.md`.
