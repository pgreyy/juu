# Juu design system (final)

This is the exact look Nic signed off. Both the app and the landing page use it.

**Source of truth:** `juu-app-reference.html`. Open it in any browser: it is the real, clickable design. Every page, colour, spacing and interaction in it is final. When this file and the reference disagree, the reference wins.

The reference also contains a "MIX LAB" button (bottom right). That was only for choosing the look. Leave it out of the real product.

Final pick: Logo Stack · Colour Ascension, light by default with a dark mode · Font Zine · Numbers match the font · Tower Ladder · Layout Left sidebar.


## 1. Colour

| Token | Light (default) | Dark | Use |
|---|---|---|---|
| bg | #E6E1D5 | #0A0A0A | page background, sidebar rail, footer |
| surf | #F6F2E8 | #101010 | main surface |
| ink | #101010 | #F0E9D8 | text |
| muted | #55524B | #929292 | labels, secondary text |
| rule | #101010 | #3A3A3A | strong lines, borders |
| rule2 | #D6CFBF | #222222 | thin dividers |
| strong | #101010 | #E6F05A | primary buttons, selected states |
| onStrong | #F6F2E8 | #101010 | text on strong |
| panel | #ECE6D8 | #1C1C1C | blocks like the floor badge, "you get" boxes |
| bull | #12804A | #3DDC84 | bull text, gains |
| bear | #C8361B | #F04427 | bear text, losses, collapse prices, danger |
| bullBar | #1FAF66 | #3DDC84 | bull bars and depth shading |
| bearBar | #E2452A | #F04427 | bear bars and depth shading |
| hi | #6B7300 | #E6F05A | floors 7 to 10, jackpot, Agaruzo |
| sel | #ECE6D8 | #1E1E1E | selected row |

- Bull is always green. Bear is always red. Gains use bull, losses and danger use bear.
- Always pair colour with ▲ / ▼ or the word, never colour alone.
- All text pairs above pass 4.5:1.


## 2. Type

- Headlines and body: **Bricolage Grotesque** 500 / 700 / 800.
- Numbers, labels, prices, tickers, buttons: **DM Mono** 400 / 500.
- Labels: uppercase DM Mono 11px, letter spacing 0.12em, muted.
- Big numbers: DM Mono, one colour, no greyed decimals.
- Google Fonts: `family=Bricolage+Grotesque:wght@500;700;800&family=DM+Mono:wght@400;500`


## 3. Shape and spacing

- Corner radius **0** everywhere.
- Borders 1.5px strong, 1px dividers.
- Touch targets at least 44px.
- Main content padding 24px 32px. Gap between tower and right column 28px.


## 4. Brand assets (in `assets/`)

- `juu-logo.svg` and `juu-logo-dark.svg`: the Stack mark (three blocks narrowing upward).
- `favicon.svg`.
- `icons/`: the eight page icons plus `sidebar.svg`. 24px grid, stroke 1.8, round caps, currentColor.
- Wordmark: Stack mark + "JUU" in Bricolage Grotesque 700, letter spacing 0.04em. Tagline "THE MUSDASH TOTE" in DM Mono 12px, letter spacing 0.12em, muted.


## 5. App shell

**Left sidebar rail**, attached to the main surface (same rounded-off card, no gap):
- Background `bg`, divider `rule2` on its right.
- Closed 96px, icons only. Open 220px, icons + names.
- Top spot: the Stack logo. On hover it swaps to the sidebar icon. When open, only the sidebar icon shows. Clicking toggles open/closed.
- Items: MUSDash, Positions, Doors, Bank, Principal Market, Jackpot, Agents, Leaderboard, each with its icon.
- Active page: a 6px green dot (bull colour) beside the icon. No box. Label bold when open. Hover shows the name.

**Header:** Stack logo (40px) + JUU 38px + tagline on the left, wallet button on the right.

**Ticker** under the header, full width, like a perp exchange:
- Scrolls left in a seamless loop (content duplicated, 52s per loop), pauses on hover, stops for reduced motion.
- Items: BTC/USD with % change · open interest with a 40px mini starburst ray chart and bull/bear split · bull open · bear open · funding · safety jar · jackpot · collapsed floors · climb premium · top agent.
- Labels DM Mono 11px muted, values DM Mono 18px coloured by meaning.

**Footer** (background `bg`):
- Brand block: Stack logo + "Juu", then one line: "Bring your Bitcoin positions in, split them into Principal and Yield, then play them, save with them or lock in a fixed return."
- Columns: Play (MUSDash, Jackpot, Leaderboard, Agents) · Earn (Doors, Positions, Bank, Principal Market) · Build (Docs, Data API, MCP server, Source on GitHub) · On the network (Contracts on explorer, X, Mezo Discord, note "Runs on Mezo testnet (matsnet).").
- Bottom bar: "Mezo testnet only. No mainnet contracts yet."


## 6. MUSDash page

Two columns: the tower (grows) and a right column (basis 380px, stretches its children to full width).

**Tower: the Ladder** (order-book style):
- Bordered box. Header row labels: BULL POOL · BULL FALLS AT · FLOOR · BEAR FALLS AT · BEAR POOL.
- A `strong` bar with MARK price and % change.
- Ten rows, floor 10 at top. Each row: bull pool (bull colour) | bull collapse price | floor number (Bricolage 18px, `hi` for floors 7 to 10) | bear collapse price | bear pool.
- Depth shading behind each row: bull from the left, bear from the right, 18% opacity, width = pool size.
- Selected floor row gets `sel`. Clicking a row selects that floor.
- Collapse price: mark × (1 − (1/leverage − 2%)) for bull, mark × (1 + (1/leverage − 2%)) for bear. Leverage per floor: 1.5, 2, 3 … 10.
- Caption under it in muted DM Mono.
- **Live feed** sits under the tower with 56px of space above it.

**Right column:**
- Bull / Bear buttons (selected = filled with its colour, text in `surf`).
- Chips: MUSD · Yield 31 DEC · Principal 31 DEC. Three equal columns, **one line each** (11px, no wrapping).
- Amount input: DM Mono 30px. The input must be allowed to shrink (width 0 + flex grow) so it never forces the column wider.
- Floor picker: 2 rows of 5.
- Readout: leverage, exposure, collapses at (bear colour), fee, climb premium.
- Primary button "OPEN ON FLOOR N".
- Your position: floor badge (panel colour), side + leverage, P&L in bull colour, collapse price, Drop / Climb / Cash out, Loop toggle.


## 7. Moments

- **Agaruzo!** on climb or open: a `strong` banner beside the page title with "AGARUZO!" big and "FLOOR 05" small, for 1.8 seconds. Never blocks play.
- **Collapse:** the feed logs "FLOOR 09 BULLS DOWN · survivors +41.20" in bear colour. The ticker repeats it.
- **Jackpot:** the big starburst ray chart is the ticket chamber.


## 8. Words

- Always **Principal** and **Yield** in full. Never "P" or "Y" alone.
- **Principal Market**, not "P Market".
- The BTC door is just **BTC**.
- Floors, climb, drop, collapse, survivors. Agaruzo! is the climb cheer.
