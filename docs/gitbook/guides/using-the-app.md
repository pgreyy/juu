# Using the app

The Juu app is the website where you play MUSDash, bring Bitcoin in and save. It runs on Mezo testnet only.

## Connect a wallet

1. Click **CONNECT WALLET** at the top right.
2. Your wallet asks to switch to (or add) **Mezo Testnet**, chain id 31611. Accept.
3. You need a little testnet BTC for gas, from Mezo's faucet.

Every action asks your wallet to confirm. Some actions need two confirmations: first a permission for Juu to use a token (an "approval"), then the action itself. The app says which step you are on and links each transaction on the Mezo explorer. Before sending, the app checks the action would succeed; if it would not, it tells you why in plain words instead of sending.

**DARK** / **LIGHT** at the top right switches the colour mode. The app remembers your choice.

## Connecting a wallet

**CONNECT WALLET** lists every wallet installed in your browser (MetaMask, Rabby, Coinbase Wallet, OKX, Trust or any
other EVM wallet that announces itself the standard way, EIP-6963); pick one. If your wallet is on another network, Juu
asks it to switch to Mezo testnet (chain 31611); if the wallet has never seen Mezo, it first asks to add it (Mezo
Testnet, BTC with 18 decimals, `https://rpc.test.mezo.org`, explorer `https://explorer.test.mezo.org`). If you decline,
the page says so and **SWITCH TO MEZO TESTNET** asks again. The app remembers your pick and reconnects quietly next time;
click your address to pick another wallet or disconnect.

## The sidebar

The icons on the left open each page. Click the Juu logo at the top of the sidebar to show the page names.

| Page | What you do there |
| --- | --- |
| MUSDash | Play: pick Bull or Bear, chips, an amount and a floor, then open. Climb, drop or cash out your position. |
| Portfolio | Two tabs. **Overview**: everything your wallet holds in Juu with its value in BTC and USD, today's profit or loss, your open bets (yours and your agents') and your recent activity; each wallet row (BTC, MUSD, MEZO) has a Swap button. **Swap**: swap BTC, MUSD and MEZO on Mezo's own pools through Mezo's Router, with the rate, price impact, minimum received and slippage (0.5% by default) under Details. The old `/positions` and `/swap` addresses lead here. |
| Doors | Bring BTC, a veBTC lock, sMUSD or a new trove into Juu. |
| Bank | Deposit BTC to back the game, or withdraw your share (paid in BTC). |
| Principal Market | Buy Principal below full price for a fixed return, or sell the Principal you hold for BTC now. |
| Jackpot | This week's prize, your tickets and odds, past winners. |
| Agents | Create an agent (a new key made in your browser, shown once) or use your own agent wallet, give it permission, connect it to an MCP client, and revoke it. |
| Leaderboard | Humans and agents ranked by realised profit. |

## The ticker

The strip under the header scrolls live figures: the BTC price and its change over the last day, open interest with its bull and bear split (the small starburst: green is the bull share), bull and bear open, funding, the safety jar, the jackpot, the latest collapse, the floor 10 seat premium and the top agent. Hover over it to pause it. It stays still if your device asks for reduced motion.

## MUSDash

* **The Ladder** lists the ten floors, floor 10 at the top. For each floor it shows the open Bull and Bear pools (shaded by size) and the price at which a new Bull or Bear on that floor would collapse, worked out from the current mark price. Click a row to pick that floor.
* **Chips:** MUSD, or the Yield or Principal of the nearest open series. Yield and Principal chips are valued by the Pricer.
* **Readout:** leverage, exposure (amount × leverage), the collapse price, the trading fee and the Climb Premium seat price on floors 7 to 10.
* **Open:** opens the position. **AGARUZO!** shows for 1.8 seconds when you open or climb.
* **Your position:** your newest open position. If you have several, pick one under the buttons. A bet must stay at or above the 10 MUSD minimum after the move's fee, so a very small bet can't climb.
* **Loop winnings into my BTC lock:** turns the Loop on or off. You need to hold Principal or Yield of an open series.
* **Live:** the latest moves on the tower, each linked to its transaction.

## Agents

**GIVE PERMISSION** sends two transactions: the rules for the agent (max per bet, highest floor, daily loss stop, expiry), then an MUSD allowance for the Agent Gateway of ten times the max per bet, because the agent plays with your MUSD. The gateway can only use it under your rules. **REVOKE NOW** stops the agent at once.

Each agent card shows the agent's **net result today**: every bet it closed or that collapsed since 00:00 UTC, gains
and losses together, green with ▲ for a profit and red with ▼ for a loss. Under it, the daily loss stop shows how much
of the limit today's losses have used; the gateway stops the agent when they reach it.

## Principal Market

**BUY** pays BTC for Principal at the pool's price. **SELL** sells Principal you hold back to the pool for BTC now
(two transactions the first time: an approval, then the sale). The pools are small on testnet, so the panel shows the
**price impact**: how far your order's average price is from the pool's price. Above 5% the button stays off; try a
smaller amount.

## Amounts

Every amount box starts empty. **25%**, **50%**, **75%** and **MAX** under it fill it from your real balance of that token;
MAX on BTC keeps 0.00001 BTC back for gas.

## Checks before you sign

Pages that pay in BTC (Doors, Bank, Principal Market) check your wallet's BTC first and say how much you have if the
amount is more. The trove door also checks Mezo's limits: a loan of at least 1,800 MUSD to you and at least 110%
collateral. Below 150% it warns, because Juu's guard starts closing bets at 130%.

## Jackpot tickets

One ticket is 1 MUSD of position size held for one hour this week. Your odds are your tickets divided by everyone's.

## Main and demo

The app reads the main stack by default. Add `?stack=demo` to the address to switch to the demo stack, where the owner can move the BTC price to show collapses. The header then shows **DEMO STACK**. `?stack=main` switches back.

## Running it yourself

You need Node.js 22.

```
cd backend && npm install && npm start          # data API and keeper, http://127.0.0.1:8788
cd frontend && npm install && npm run dev:app   # the app, http://localhost:3000
```

The app reads the data API through its own `/api` path. To use a data API somewhere else, set `JUU_API_URL` before starting the app.
