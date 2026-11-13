# Juu

Juu is a gamified Bitcoin money layer on Mezo. Bring in a BTC position (plain BTC, a veBTC NFT, sMUSD or a Mezo trove) and Juu splits it into Principal and Yield tokens. Play your Yield in MUSDash, a 10 floor bull or bear leverage game where the players who survive collect the penalties and fees of the ones who fall. Or skip the game and earn: lock a fixed rate on the Principal Market, or save in the Bank, the 300% collateralised trove that backs the game. A weekly jackpot, optional looping, and Juu Agents (AI agents that play beside humans on their own leaderboard) complete it. Live on Mezo testnet.

* App: [app.playjuu.xyz](https://app.playjuu.xyz) · Site: [playjuu.xyz](https://playjuu.xyz)
* Docs: [playjuu.xyz/docs](https://playjuu.xyz/docs) · Data API: [playjuu.xyz/docs/agents/data-api](https://playjuu.xyz/docs/agents/data-api)
* MCP server for agents: `https://mcp.playjuu.xyz`, guide at [playjuu.xyz/docs/mcp](https://playjuu.xyz/docs/mcp)

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
