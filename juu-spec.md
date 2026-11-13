# Juu: product spec (v0.2)

A Bitcoin-native financial layer on Mezo. Bring your Mezo positions in, split them, play them, and loop the winnings back.

The game inside is called **MUSDash**. The cheer when you climb a floor is **Agaruzo!** (Japanese, "it's going up!").

Juu means "up" in Swahili and "ten" in Japanese. MUSDash has ten floors.

Built for the Mezo Buildathon (AKINDO), Track 1 (DeFi). Runs on Mezo testnet (matsnet).


## 1. The idea in plain words

Your Bitcoin on Mezo is like a farm. Every week it produces a small harvest: the fees veBTC earns.

Juu splits your position into two parts. One is the farm itself (Principal, P). The other is the harvest it will produce (Yield, Y).

You take those parts into **MUSDash**, a building where every floor is a bet on Bitcoin's price, up or down. Low floors are small bets. High floors are big ones.

If the price goes your way, you win. If your floor collapses, the players still standing collect what you lost.

Winnings get turned back into BTC and added to your lock. A bigger lock makes a bigger harvest, so you have bigger chips next time.

Savers who don't want to play act as the Bank. They lend cheaply borrowed MUSD into the game and earn from it.

A safety jar under the building catches bad falls. When it overflows, the extra is paid out as a weekly jackpot.


## 2. What we use from Mezo (we don't rebuild these)

| Need | Mezo piece we call |
|---|---|
| Locking BTC | veBTC contract (createLock, increaseAmount) |
| Borrowing MUSD at 1% fixed | MUSD troves (BorrowerOperations) |
| Swapping MUSD and BTC | Mezo DEX Router |
| BTC price | Mezo PriceFeed |
| MUSD savings yield | MUSD Savings Vault (sMUSD) |
| Voting | Mezo gauges (Voter) |


## 3. Doors: what users can bring in

**Door 1: veBTC NFT.** The user deposits their existing veBTC position. Our Splitter holds it and votes it.

**Door 2: sMUSD.** Mezo's savings vault token. It already earns yield, so it can be split the same way.

**Door 3: troves (lending positions).**
- Option B first: the user moves their trove into a personal Juu account, a small contract wallet only they control. This pattern comes from DeFi Saver and Instadapp. Claude Code must confirm from the MUSD contracts how a trove can be opened in or moved to such an account.
- Option A as the fallback: the user brings the MUSD they borrowed.

What a trove does in the game (Option B):
1. **Its equity counts as margin.** 1 BTC ($100,000) with 50,000 MUSD debt = $50,000 equity. At an 80% haircut that is $40,000 of margin.
2. **Borrow straight into the game.** The Juu account can draw fresh MUSD from the user's own trove at Mezo's 1% and drop it into MUSDash as chips.
3. **Wins go back into the trove.** Winnings are swapped to BTC and added as collateral, which raises how much the user can borrow.
4. **Losses come out of the trove.** The game withdraws BTC equal to the loss and pays the winners.
5. **Safety guard.** If a loss would push the trove near Mezo's 110% minimum, the game closes the bet first, before Mezo can liquidate it.

The trove still lives in Mezo's system, so redemptions can still hit it if it is among the riskiest troves.

Sources: DeFi Saver and Instadapp smart accounts, cross margin from Binance and dYdX. The auto close guard is Claude's own idea.

Note: the user's trove (Door 3) and the Bank's trove (4.5) are two different things. The user's trove is their chip. The Bank's trove is the pot that pays winners.

**Door 4: plain BTC (zap).** One click routes BTC through Mezo's own veBTC lock, then through Door 1. Zaps come from Zapper and Yearn.

**Postponed:** liquid veBTC tokens (Aurove first). Each one needs its own connector, we can't vote it, and it depends on the other project.


## 4. What we build

### 4.1 Splitter
Turns a deposit into two tokens:
- **P (Principal):** claim on the locked BTC, or on the sMUSD principal.
- **Y (Yield):** claim on everything the position earns until its lock ends.

Source: Pendle (PT and YT). Nobody on Mezo splits veBTC this way yet. Tenor and PrismTeleport split sMUSD only.

**P and Y are standard ERC-20 tokens, grouped into series.**
ERC-20 is the token format every wallet and app understands, so other platforms can accept P and Y later (lending markets, DEXs).

Every veBTC lock ends on a different date, so not every P is worth the same. Positions are grouped into series by end date, for example "P, ends March 2027". Each series is its own P token and its own Y token. A lock that ends between series dates goes into the nearest series that ends after it.

Once a veBTC NFT is deposited, it stays in Juu. Its P and Y are what move around.

Source: Pendle's maturity dates.

### 4.1b P Market (fixed yield, no game needed)
For people who don't want to play.

P is a claim on BTC you get back when the lock ends. Because you have to wait, it sells below full price. Example: buy 1 BTC of P for 0.97 BTC today and get 1 BTC back at unlock. That's a fixed 3% with no game involved.

The P Market is a simple place to buy and sell P for BTC, one pool per series. P's price should move toward full value as the end date gets closer, because there is less time left to wait. Claude Code should propose the simplest way to do this.

Source: Pendle, where buying principal tokens is how people lock in fixed yield, and Pendle's pools, whose prices drift toward full value as the end date nears.

### 4.2 Pricer
Decides how much each chip counts for as margin (the money that backs a bet).

**Y value**
```
expected_yield = recent_weekly_yield x weeks_left_in_lock
Y_margin_value = expected_yield x BTC_price x Y_haircut
```
Example: 1 BTC lock, about 0.02 BTC expected over the rest of the lock, BTC at $100,000. That's $2,000 expected. With an 80% haircut, Y counts as **$1,600 MUSD** of margin.

The haircut slides. If real yield comes in below forecast, it drops, and if above, it rises. The sliding rule is my own idea. Pricing future yield this way comes from Pendle and revenue based financing.

**P value**
```
P_margin_value = BTC_locked x BTC_price x P_haircut   (suggest 90%)
```
The haircut covers the fact that P can't be sold until the lock ends. Source: how Aave values Pendle PT as collateral.

**Trove in a Juu account**
```
trove_margin_value = (collateral_value - debt) x trove_haircut
```

### 4.3 MUSDash (the game)
- **Two sides:** Bull (BTC up) and Bear (BTC down).
- **Ten floors:** Floor 1 = 1.5x leverage up to Floor 10 = 10x. Leverage means your bet is bigger than your chips. At 5x, $1,600 of chips controls $8,000 of BTC exposure.
- **Positions are synthetic.** They're priced by Mezo's PriceFeed and settled in MUSD. No BTC is actually bought on a DEX.
- **Two modes:**
  - Yield floors: only Y or MUSD can be posted. Your BTC is untouchable.
  - Principal floors: P or a trove can be posted too. Lose, and it goes to the winners.

**When a floor collapses (liquidation)**
```
liquidation_move = 1/leverage - maintenance_margin   (suggest 2%)
```
At 5x, a move of about 18% against you collapses the floor.

The collapsed position pays a penalty. The suggested split, all tunable:
- 50% to survivors on the same side, weighted by size and time held
- 25% to the Buffer
- 25% to the Bank

Survivors earning from liquidations comes from Liquity's Stability Pool. Floors as risk layers come from tranches (traditional finance CDOs, BarnBridge, Aurove).

**Who pays winners**
1. The losers' margin (players against players)
2. The Bank covers the gap when one side is bigger, up to a cap
3. The Buffer covers any bad debt

Sources: player against player from dYdX and Hyperliquid. The vault covering the gap from GMX and Hyperliquid HLP.

**Funding fee**
The crowded side pays the quiet side every hour:
```
funding_rate = k x (bull_size - bear_size) / (bull_size + bear_size)
```
If the Bank is covering the gap, it receives the funding. Source: perpetual futures funding (BitMEX 2016), skew fees (GMX v2).

**Trading fee:** a small fee on every open, close, climb or drop. Split between the Bank, the Buffer and the protocol.

Bustline (another buildathon project) is a 100x perp. MUSDash differs in having floors, survivors collecting, and P/Y/troves as margin.

### 4.4 Climb Premium (the ponzi slot)
Floors 7 to 10 only.
```
seat_premium = base_premium x (1 + r) ^ seats_taken_this_epoch
```
Each new seat on a top floor pays a premium on top of its margin. That premium is split among the people already sitting on that floor. Early climbers earn from late ones.

**Kill switch:** at the end of each Mezo epoch (7 days), if new top floor seats fell below a set level (suggest 50% of the previous epoch), the premium switches off. Everyone falls back to the real engines: veBTC fees, the Bank spread, game fees and liquidations.

The premium rate and kill switch status are shown openly in the app.

Sources: FOMO3D key pricing, pump.fun bonding curves. The kill switch is my own idea.

### 4.5 Bank (savers)
The Bank is the pot that makes sure winners always get paid. It does not lend to individual players. It backs the game, like house money at a table.

Why it is needed: if bulls have $100,000 in play and bears only $60,000, and BTC pumps, the bears can't cover all the bull winnings. The Bank pays the missing part.

- Savers deposit BTC and get Bank shares.
- The Bank opens one Mezo trove at about 300% collateral ratio and borrows MUSD at 1%. The high ratio keeps it far from the front of the redemption line.
- That MUSD becomes game liquidity: it covers the gap between sides and pays winners when needed.
- **Earns:** its share of trading fees, funding when covering, its share of liquidations, and Y bought or held.
- **Cap:** the Bank's uncovered exposure can't go above a set % of its capital.

Example: 10 BTC ($1,000,000) at 300% borrows about $333,000 MUSD. That costs about $3,330 a year.

Sources: net interest margin (banking), Yearn's pooled vault, GMX GLP.

### 4.6 Buffer and jackpot
- A slice of trading fees and liquidations fills the Buffer.
- It pays bad debt first, when a loser lost more than their margin.
- Target size is a % of all open positions. Every Mezo epoch, anything above the target becomes the **jackpot**.
- Tickets = position size x time held that epoch.
- The draw needs randomness. Suggest commit and reveal, which Knockout already uses on Mezo.

Sources: BitMEX and Binance insurance funds, PoolTogether.

### 4.7 Loop
Winnings in MUSD are swapped to BTC through the Mezo Router, then added to the user's veBTC through increaseAmount.

A bigger lock means a bigger Y, which means bigger margin next round. Users who came in through other doors get BTC or MUSD back instead.

Your idea, wired through Mezo's own functions.

### 4.8 Voting (side feature)
The Splitter votes the veBTC it holds each epoch toward the gauge paying the most fees per vote. A keeper bot (Node) triggers it.


### 4.9 Juu Agents
Users can let their own AI or trading agents play MUSDash for them, safely, under rules the user sets.

**1. Agent permissions (session keys).** A user never gives an agent their wallet key. Instead they give it a limited key with rules:
- only MUSDash actions (open, close, climb, drop)
- max chips per bet, highest floor allowed
- daily loss limit, after which the agent is stopped
- expiry date, and the user can cancel any time

Sources: session keys in smart account wallets (ZeroDev, Biconomy) and ERC-7715 (MetaMask advanced permissions).

**2. Agent fee (spam fee).** Every action an agent takes pays a small extra fee on top of the normal trading fee. It stops bots spamming actions. Default split: 50% Buffer, 50% Bank, adjustable. Source: transaction fees as anti-spam, which is what gas on Ethereum does.

**3. Data API for agents.** Read-only endpoints served by the Node/Express backend: floor states and collapse prices, bull vs bear sizes, funding rate, Climb Premium price and kill switch status, Y and P prices, Bank capacity, BTC price history, recent collapses.

**4. Juu MCP server.** MCP is the standard way AI assistants plug into tools. The Juu MCP server lets anyone's AI agent read the game and play it through its session key, without writing code. It never touches a user's main wallet key. Source: Boar already runs a blockchain MCP for Mezo.

**5. Agents vs humans leaderboard.** Agent positions are labelled on chain, so results can be ranked: agents against agents, and agents against humans. Source: Nof1's Alpha Arena (2025), where AI models traded real money against each other on Hyperliquid.

Fairness: agent accounts are always labelled, so humans know who they're up against.


## 5. Money map

| Source | Who pays | Who receives |
|---|---|---|
| veBTC fees | Mezo chain activity | Y holders |
| sMUSD yield | Mezo MUSD vault | Y holders |
| Trading fee | every player move | Bank, Buffer, protocol |
| Funding fee | crowded side | quiet side, or the Bank |
| Liquidation penalty | collapsed positions | survivors, Buffer, Bank |
| Climb Premium | new top floor seats | existing top floor seats |
| Jackpot | Buffer surplus | position holders by ticket |
| Agent fee | every agent action | Buffer, Bank |
| 1% MUSD interest | Bank | Mezo (flows back partly to veBTC holders) |


## 6. Settings to tune

| Setting | Suggested start |
|---|---|
| Y haircut | 80%, sliding |
| P haircut | 90% |
| Trove haircut | 80% |
| Floors | 10, from 1.5x to 10x |
| Maintenance margin | 2% |
| Liquidation split | 50 survivors / 25 Buffer / 25 Bank |
| Bank collateral ratio | 300% |
| Bank exposure cap | 20% of Bank capital |
| Buffer target | 5% of open positions |
| Climb Premium floors | 7 to 10 |
| Kill switch level | new seats below 50% of last epoch |

All numbers are starting suggestions to tune on testnet.


## 7. Dropped or postponed

- **Entry tax:** dropped, your call.
- **Player's own trove as a chip outside an account:** replaced by Door 3 Option B. Redemptions can shrink a loose trove mid game.
- **Separate Cash Desk:** dropped as a standalone product. Its pricing lives inside the Pricer. Thaw and Epoch Lite already offer cash advances.
- **No loss lottery game:** dropped. MezoLotto and Knockout did it. The jackpot keeps a taste.
- **Separate yield betting game:** dropped. Y pricing already is that bet.
- **Hourly floor rent:** folded into funding and liquidation shares.
- **Liquid veBTC door (Aurove):** postponed.
- **veMEZO boosts via Janus:** parked.
- **Loop vault for non players:** dropped. Pylon, Coil and MezoLoop already do this on Mezo.


## 8. Neighbours and how we differ

| Project | What they do | Our difference |
|---|---|---|
| 40acres (Base) | Loans against veNFTs, repaid from rewards | We split P and Y and use them as game chips |
| Thaw, Epoch Lite (this buildathon) | Advance or sell veBTC yield | We don't stop at cash; Y goes into a game and loops |
| Tenor, PrismTeleport | PT/YT for sMUSD | We split veBTC too |
| Bustline | 100x perp in MUSD | Floors, survivors collect, P/Y/troves as margin |
| Boar | veBTC auto voting | Voting is only our side feature |
| Velar PerpDEX | Perps on Mezo, exploited Jan 2026 | Shows leverage on Mezo needs tight caps |


## 9. Open items for Claude Code to confirm
1. Whether MUSD troves can be opened in or moved to a personal contract account (Door 3, Option B).
2. veBTC NFT transfer and increaseAmount behaviour on testnet.
3. Real recent veBTC yield on testnet, used to set the Y haircut.
4. The PriceFeed's update frequency, since liquidations depend on it.
5. sMUSD contract interface for splitting.
