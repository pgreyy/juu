# Glossary

**Agent** An AI or trading program that plays MUSDash for a user through the Agent Gateway, with its own key and the user's rules.

**Agent fee** A small extra fee on every agent action, split between the Buffer and the Bank.

**Agaruzo!** Japanese for "it's going up!". The cheer when a position climbs to a higher floor.

**Bank** Juu's savers' pot. It holds BTC, borrows MUSD at Mezo, and backs the game.

**Bear / Bull** The two sides in MUSDash. Bull wins when BTC goes up, Bear when it goes down.

**Buffer** The safety jar under MUSDash. It pays bad debt and funds the weekly jackpot.

**Climb Premium** An extra price for a seat on floors 7 to 10, shared by those already on the floor.

**Chip** Anything you post as margin in MUSDash: MUSD, Y or P of a series. A Juu account plays with MUSD borrowed from its own Mezo loan.

**Collapse (liquidation)** When a position's value falls to 2% of its size, it is closed and what's left is shared as a penalty.

**Collateral ratio** Value of the collateral divided by the debt. 300% means $3 of BTC behind every $1 borrowed.

**Door** A way to bring something into Juu (veBTC lock, BTC, sMUSD, a Mezo loan).

**Epoch** A Mezo week, starting Thursday 00:00 UTC. Votes and rewards run per epoch.

**Funding** A small hourly fee the crowded side pays the quiet side.

**Gauge** A Mezo reward pool that veBTC holders vote for. Voters share its fees and bribes.

**Haircut** A safety discount on a chip's value. An 80% haircut counts a chip at 80% of its value.

**Jackpot** The Buffer's surplus above its target, drawn each epoch among position holders by tickets.

**Juu account** A personal contract wallet that holds its own Mezo loan and plays with it (Door 3).

**Keeper** Juu's bot that runs the scheduled steps: votes, unlocks, payouts, collapses, Bank upkeep.

**Kill switch** Turns the Climb Premium off for good when new top-floor seats fall below half of the previous epoch.

**Leverage** How much bigger your bet is than your chips. 5x means 1,000 MUSD of chips bets on 5,000 MUSD of BTC.

**Margin** The money that backs a bet.

**Loop** Turns MUSDash winnings into BTC added to your series lock.

**MCP** Model Context Protocol, the standard way AI assistants connect to tools. Juu's MCP server lets an AI play through an agent key.

**MUSD** Mezo's dollar stablecoin, borrowed against BTC.

**MUSDash** Juu's game: ten floors of bets on BTC's price.

**P (Principal)** A token worth 1 BTC on its series end date.

**Permanent lock** A veBTC lock with no end date. It keeps full voting power until it is unlocked.

**Rebase** The small BTC reward Mezo adds into veBTC locks each week.

**Recovery Mode** A Mezo safety state when its whole system falls below 150% collateral. Collateral can't be taken out of loans while it lasts.

**Redemption** Mezo lets anyone swap MUSD for BTC taken from the riskiest loans first.

**Session key** A separate key you give an agent, limited by rules you set and cancellable any time.

**Series** P and Y tokens that share one end date.

**sMUSD** Mezo's MUSD savings token.

**Splitter** The Juu contract that holds BTC in veBTC and issues P and Y.

**Trove** A Mezo loan: BTC collateral with MUSD borrowed against it.

**veBTC** Mezo's locked BTC. Locked BTC can vote for gauges and earns rewards.

**Y (Yield)** A token that earns everything its series' BTC earns until the end date.
