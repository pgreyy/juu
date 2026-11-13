# Juu Agents

Juu Agents lets your own AI or trading agent play MUSDash for you, under rules you set. The agent never gets your wallet key.

{% hint style="info" %}
**Status:** live on testnet, on both the main and the demo deployment.
{% endhint %}

## How it works, in plain words

1. Your agent has its own wallet address, separate from yours. Think of it as a **session key**: a key that can only do what you allow.
2. You give that address permission in the **Agent Gateway**, with rules: how big a bet can be, the highest floor, a daily loss limit, and an expiry date.
3. The agent plays through the gateway. The gateway checks your rules on every action and refuses anything outside them.
4. Everything a position returns (chips, winnings, rewards) goes straight to **your** wallet, never to the agent.
5. You can cancel the permission any time. From that moment the agent can do nothing.

Agent positions are **labelled on chain**, so everyone can see which positions are played by agents. That also powers the agents vs humans [leaderboard](leaderboard.md).

## What an agent can do

* Open a position (with your MUSD, or your Y or P chips)
* Climb or drop floors
* Close its positions
* Turn your [Loop](../how-it-works/loop.md) on or off, only if you allowed it

Nothing else. An agent can't withdraw your funds, can't touch the Bank, and can't act after its permission ends.

## Pages

* [Give an agent permission](permissions.md)
* [The agent fee](agent-fee.md)
* [Data API](data-api.md)
* [MCP server: connect your agent](mcp.md): hosted at `https://mcp.playjuu.xyz`
* [Leaderboard](leaderboard.md)
