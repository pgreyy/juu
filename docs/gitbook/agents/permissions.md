# Give an agent permission

## The rules you set

| Rule | What it does |
| --- | --- |
| **Max chips per bet** | The most MUSD value the agent may put on one bet. For Y or P chips, their Pricer value counts. |
| **Highest floor** | The agent can't open on, or climb to, any floor above this. |
| **Daily realised loss stop** | Once the agent's realised losses for you reach this today (UTC), it can't open or climb until tomorrow. It can still close positions. Counts losses from closed bets. Open bets can lose more until they close. |
| **Expiry** | After this time the agent can do nothing. |
| **Can set Loop** | Whether the agent may turn your Loop on or off. |

You can **revoke** at any time. A revoked or expired agent can't open, climb, drop or close.

You can always close your agent's positions yourself with `userClose(positionId)` on the gateway, for example after revoking it. You pay no agent fee for that.

## In the app

On the **Agents** page, **Create a new agent key** makes a fresh wallet for your agent in your browser and shows its key
once (copy or download it; Juu never stores or sends it). Set the rules and click **Give permission**: the app grants the
session, approves the gateway for ten bets' worth of MUSD, and can send the agent a little BTC for gas, all from your
wallet. Or choose **Use my own agent wallet** and paste its address. Then connect the agent: see
[MCP server](mcp.md).

A revoked or expired agent's card has **Remove**: after you confirm, your wallet signs a short message (no transaction,
no gas) and the agent disappears from your Agents page on every device. Its past results stay on the leaderboard. Giving
the same agent permission again brings it back. An agent that was your own wallet can only be removed, not restored.

## How agent funding works

| Question | Answer |
| --- | --- |
| Whose money does the agent bet? | Yours. At each bet the Agent Gateway takes your MUSD (or your Y and P chips) from your wallet, using the allowance you gave it. The agent's wallet holds none. |
| How much can it use? | The app approves the gateway for ten times the max per bet (500 MUSD per bet → 5,000 MUSD in total), and every bet still has to fit the session's rules. |
| Who pays the fees? | You: MUSDash's trading fee, any seat premium on floors 7 to 10, and the agent fee, all from your MUSD. |
| Where do winnings go? | Everything a closed bet returns goes straight to your wallet (or into your Loop if it is on), never to the agent. |
| Does the agent need BTC? | Yes, a little, for its own transaction gas. Mezo gas is tiny; the 0.00002 BTC the app can send lasts a long time. |
| Y or P chips? | The app approves MUSD only. To let an agent bet chips, approve those tokens for the gateway too. |

The app refuses your own connected wallet as an agent address: an agent's key goes into an AI client, and it must never
be your main wallet's key.

## Steps (by hand, from the contracts)

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

On the demo deployment, a test agent was given a session (max 30 MUSD, highest floor 5, daily realised loss stop 5 MUSD). It opened a bet, climbed from floor 2 to 4 and closed. Then:

* a 40 MUSD bet was refused with `BetTooBig`,
* floor 6 was refused with `FloorTooHigh` (open and climb),
* after `revoke`, every action was refused with `NoSession`.

Transactions are on [Contracts and addresses](../technical/contracts-and-addresses.md).
