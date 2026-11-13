# Agent Gateway in detail

Contract: `AgentGateway`. One per deployment (main and demo).

## Sessions

`grant(agent, maxChips, maxFloor, dailyLossLimit, expiry, canSetLoop)` stores a session for `(user = msg.sender, agent)`. Granting again replaces the rules but keeps today's recorded loss. `revoke(agent)` sets it inactive.

Checks on every agent call:

| Check | Error |
| --- | --- |
| Session active | `NoSession` |
| Before expiry | `Expired` |
| Open or move: today's realized loss below the limit | `StoppedForToday` |
| Open or move: floor at or below `maxFloor` | `FloorTooHigh` |
| Open: chip value at or below `maxChips` | `BetTooBig` |
| Close or move: the position belongs to this agent | `NotYourPosition` |
| Set Loop: allowed in the session | `LoopNotAllowed` |

## Functions

| Function | Caller | Notes |
| --- | --- | --- |
| `openMUSD(user, side, floor, margin)` | agent | Pulls margin + trading fee + seat premium + agent fee from the user; refunds anything MUSDash didn't take. |
| `openTokens(user, side, floor, chip, seriesId, amount)` | agent | Pulls the Y or P and the agent fee (MUSD). |
| `moveFloor(id, toFloor)` | agent | Climb or drop. |
| `close(id)` | agent | Allowed after the daily realised loss stop is reached, not after revoke or expiry. |
| `setLoopFor(user, on, seriesId)` | agent | Only if `canSetLoop`. Pays the minimum agent fee. |
| `userClose(id)` | user | Close your agent's position yourself, no agent fee. |
| `liquidateAndForward(id)` | anyone | Collapses a due agent position and forwards what's left (rewards) to the user. The keeper uses this. |
| `setAgentFee(rate, min, toBuffer)` | owner | Fee settings. |

## Where funds go

The gateway is the position owner inside MUSDash. Before each call it snapshots its balances of MUSD, the chip token and every Y reward token; after the call it forwards every increase to the user. On close, MUSD winnings above the returned MUSD chips go to the user's Loop if it is on.

## Profit and loss for the limit

* `cost` starts as everything the user paid in (chip value, fees, premium, agent fee) and grows with each later agent fee, minus anything paid out before the end.
* On close or collapse: `result = value returned - cost`, where returned tokens are valued now (MUSD 1:1, BTC at price, chips at the Pricer's value).
* A negative result is added to today's loss.

## Events (labels and leaderboard)

`SessionGranted`, `SessionRevoked`, `AgentOpened`, `AgentMoved`, `AgentClosed`, `AgentLiquidated`, `AgentFeePaid`, `AgentStopped`, `AgentLoopSet`, `Forwarded`.

## Limit

If someone collapses an agent position directly in MUSDash instead of through `liquidateAndForward`, its survivor rewards stay in the gateway. The owner can forward them with `forwardStray`.
