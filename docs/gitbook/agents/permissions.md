# Give an agent permission

## The rules you set

| Rule | What it does |
| --- | --- |
| **Max chips per bet** | The most MUSD value the agent may put on one bet. For Y or P chips, their Pricer value counts. |
| **Highest floor** | The agent can't open on, or climb to, any floor above this. |
| **Daily loss limit** | Once the agent's realized losses for you reach this today (UTC), it can't open or climb until tomorrow. It can still close positions. |
| **Expiry** | After this time the agent can do nothing. |
| **Can set Loop** | Whether the agent may turn your Loop on or off. |

You can **revoke** at any time. A revoked or expired agent can't open, climb, drop or close.

You can always close your agent's positions yourself with `userClose(positionId)` on the gateway, for example after revoking it. You pay no agent fee for that.

## Steps

1. **Create a fresh wallet for the agent.** Never give an agent your own key.
2. **Give the agent wallet a little BTC for gas.** Agents pay their own transaction gas.
3. **Approve the Agent Gateway** for the MUSD (and any Y or P) the agent may use. The gateway pulls only what each action needs.
4. **Grant the session** on the Agent Gateway:

```
grant(agent, maxChips, maxFloor, dailyLossLimit, expiry, canSetLoop)
```

Example: `grant(0xAgent..., 30e18, 5, 5e18, <unix time in 1 day>, true)` lets the agent bet up to 30 MUSD per bet on floors 1 to 5, stops it for the day after 5 MUSD of losses, ends tomorrow, and lets it set your Loop.

5. **To cancel:** `revoke(agent)`.

## Where your money goes

* The gateway takes margin, MUSDash's trading fee, any seat premium and the agent fee from your wallet when the agent acts.
* The gateway holds the agent's positions in MUSDash on your behalf. Everything they return is forwarded to you in the same transaction: MUSD, your chips, and any Y rewards.
* If you turned the Loop on, MUSD winnings from an agent's position are looped into your series lock instead.

## Tested on chain

On the demo deployment, a test agent was given a session (max 30 MUSD, highest floor 5, daily loss limit 5 MUSD). It opened a bet, climbed from floor 2 to 4 and closed. Then:

* a 40 MUSD bet was refused with `BetTooBig`,
* floor 6 was refused with `FloorTooHigh` (open and climb),
* after `revoke`, every action was refused with `NoSession`.

Transactions are on [Contracts and addresses](../technical/contracts-and-addresses.md).
