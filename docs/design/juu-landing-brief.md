# Juu landing page brief (for hallmark)

The landing page must feel like the front door of the app in `juu-app-reference.html`. Same colours, fonts, sharp corners, logo, ticker and Ladder. Someone who clicks "Enter MUSDash" should feel they walked from the lobby into the same building, not into a different product.


## Brand rules (from juu-design-system.md)

- Ascension light: background #E6E1D5, surface #F6F2E8, ink #101010. Dark mode optional but must use the dark tokens.
- Bricolage Grotesque for headlines and body, DM Mono for numbers, labels and buttons.
- Corner radius 0. Borders 1.5px.
- Bull green, bear red, `hi` olive (#6B7300) for floors 7 to 10 and the jackpot.
- Stack logo from `assets/juu-logo.svg`, favicon from `assets/favicon.svg`.
- No stock photos, no 3D coins, no gradients, no glassmorphism. Product visuals only, built from the same parts as the app (ladder rows, ticker, starburst, floor badges).
- Do not use hallmark's theme catalog. These tokens are fixed. Record them in the first CSS comment as hallmark does.


## Real facts you may use

Only these, or anything you can verify in juu-spec.md, docs/gitbook and docs/build-log.md. Never invent numbers, users or partners.

- Runs on Mezo testnet (matsnet).
- Ten floors, from 1.5x on floor 1 to 10x on floor 10.
- A floor collapses on a move of 1/leverage minus 2%. Example: floor 5 at 5x collapses on an 18% move.
- When a floor collapses, survivors on that side collect part of the penalty.
- Principal was bought at 0.9604 BTC in testing, about 4% below full value.
- The Bank's trove runs at 300%.
- The first demo series ends Thursday 10 December 2026.
- The first jackpot draw paid 0.431 MUSD.
- Agents play through the Agent Gateway under rules the owner sets, and every agent move pays a small extra fee.
- Doors: BTC, veBTC, sMUSD, trove.

Sample figures (like 71,000 BTC price) are fine only inside visuals that are clearly a preview of the game, never as claims.


## Page plan

1. **Header:** Stack logo + JUU + "THE MUSDASH TOTE", links (How it works, MUSDash, Earn, Agents, Docs), button "Enter MUSDash".

2. **Hero:**
   - Eyebrow (DM Mono, uppercase): "BITCOIN MONEY GAME ON MEZO".
   - Headline (Bricolage 800, huge): **"Ten floors. How high?"** (changed from "Your Bitcoin. Ten floors. How high?" on 13 Nov 2026)
   - One line: "Bring your Bitcoin in, split it into Principal and Yield, then climb the tower, save with it or lock in a fixed return."
   - Buttons: "Enter MUSDash" (strong) and "How it works" (outline).
   - Visual: a live-looking slice of the Ladder (floors 10 to 1, MARK bar, depth shading), animated gently: depth bars breathe, one floor flashes AGARUZO!. This is the centrepiece, not an illustration.

3. **Ticker strip:** the same moving ticker as the app, full width.

4. **How it works, three steps:** each with its icon from `assets/icons/`:
   1. "Bring it in": BTC, veBTC, sMUSD or a trove through the Doors.
   2. "It splits": Principal (your Bitcoin back on the end date) and Yield (what it earns until then).
   3. "Use it": climb in MUSDash, back the game in the Bank, or buy Principal below full price.

5. **MUSDash section:** the Ladder big. Copy: pick Bull or Bear, pick a floor, climb or drop, a floor collapses on a move of 1/leverage minus 2%, survivors collect. Show the Agaruzo! banner style.

6. **Don't want to play?** Two blocks side by side:
   - Bank: "Back the game, earn from it." Trove at 300%, paid out in BTC.
   - Principal Market: "Buy Bitcoin below full price." Principal bought at 0.9604 BTC in testing, full Bitcoin on the end date.

7. **Agents vs humans:** "Let your agent play. You set the rules." Rules list (max per bet, highest floor, daily loss stop, expiry, revoke any time). A small leaderboard preview with AGENT and HUMAN badges.

8. **Jackpot:** the big starburst ray chart. "Every week the safety jar's overflow becomes a jackpot. Tickets = position size × time held." First draw paid 0.431 MUSD.

9. **Final call to action:** "Ten floors are waiting." Button "Enter MUSDash".

10. **Footer:** exactly the app footer (section 5 of the design system).


## Motion

- Ticker loop as in the app. Respect reduced motion everywhere.
- Hero ladder: subtle, slow. No bouncing, no parallax.
- Agaruzo! banner: 1.8 seconds, then settles.


## Words

Principal and Yield in full. Principal Market. Floors, climb, drop, collapse, survivors. Short sentences.
