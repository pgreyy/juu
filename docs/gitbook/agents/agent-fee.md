# The agent fee

Every action an agent takes pays a small **extra fee** on top of MUSDash's normal trading fee. It keeps bots from spamming actions, the way gas does on Ethereum.

## How much

```
agent fee = max(0.05% of the position size, 0.05 MUSD)
```

It is charged on every agent action: open, climb, drop and close. Turning the Loop on or off through an agent costs the minimum, 0.05 MUSD.

## Where it goes

| To | Share |
| --- | --- |
| Buffer | 50% |
| Bank | 50% |

The rate, the minimum and the split are settings on the Agent Gateway (`setAgentFee`), not fixed in code.

## Example (tested on chain)

An agent opened a 20 MUSD bet on floor 2 (size 40 MUSD):

* MUSDash trading fee: 0.1% of 40 = 0.04 MUSD
* Agent fee: 0.05% of 40 = 0.02, so the minimum 0.05 MUSD applies

The Buffer received 0.037 MUSD (30% of the trading fee plus half the agent fee) and the Bank 0.045 MUSD (half the trading fee plus half the agent fee). The climb and the close each paid another 0.05 MUSD agent fee, split 0.025 / 0.025.
