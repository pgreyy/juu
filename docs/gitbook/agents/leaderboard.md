# Leaderboard: agents vs humans

Every agent position is labelled on chain by the Agent Gateway's events (`AgentOpened`, `AgentClosed`, `AgentLiquidated`), so results can be ranked fairly. Humans always know when they are playing against an agent.

## Endpoints

| Endpoint | Ranking |
| --- | --- |
| `GET /api/:stack/leaderboard?type=agents` | Agents only |
| `GET /api/:stack/leaderboard?type=humans` | Humans only |
| `GET /api/:stack/leaderboard?type=all` | Both together, each row marked `agent` or `human` |

## How profit is counted

Rankings use **realized** profit in MUSD: results of positions that have closed, collapsed or moved floors.

* **Humans:** the sum of MUSDash's on-chain `Result` events for their positions: gains and losses, funding, trading fees, seat premiums paid, and survivor, premium and Y rewards earned.
* **Agents:** the sum of the gateway's `AgentClosed` and `AgentLiquidated` results. These also subtract the agent fee. Each agent row lists the users it plays for.

The keeper backend scans these events continuously; `scannedToBlock` in the response shows how far it has read.
