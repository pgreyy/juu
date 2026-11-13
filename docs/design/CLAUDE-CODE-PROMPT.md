I've added a folder docs/design/ with the final design handoff. It contains:
- juu-app-reference.html: the exact app design, clickable. Open it in a browser. It is the source of truth.
- juu-design-system.md: tokens, fonts, layout and rules written out.
- juu-landing-brief.md: the landing page plan.
- juu-spec.md: the latest product spec (includes Juu Agents, section 4.9).
- assets/: logo, dark logo, favicon and the page icons as SVG.

Read all of it before writing any frontend code. Open juu-app-reference.html and click through every page so you see exactly what I see. Ignore its MIX LAB panel, that was only for choosing the look.

Part 1: the app frontend.
Rebuild the app so it looks and behaves exactly like juu-app-reference.html in its default state:
- Left sidebar rail with the icons, the logo that swaps to the sidebar icon, the green active dot.
- Header, moving ticker with the mini starburst, the Ladder tower, live feed under the tower, the right column (Bull/Bear, chips on one line, amount, floor picker 2x5, readout, open button, your position).
- Every page: MUSDash, Positions, Doors, Bank, Principal Market, Jackpot, Agents, Leaderboard.
- Light mode by default with a dark mode toggle, using the dark tokens.
- The full footer.
- Match spacing, sizes, fonts and colours exactly. When unsure, measure against the reference.
- Use a proper app stack (Next.js + TypeScript, or what fits the repo). Don't copy the reference's tiny renderer, it only exists so the design can be viewed.
- Connect it to the deployed contracts and the Data API. Replace sample figures with live data. Where data doesn't exist yet, show a clean empty state in the same style, never fake numbers.
- Wallet connect for Mezo testnet (chain id 31611).
- Agaruzo! banner on climb and open, ticker loop, reduced motion respected.

Part 2: the landing page with hallmark.
Use hallmark to build the landing page in frontend/landing/, following juu-landing-brief.md.
- Do not pick a theme from hallmark's catalog. Use our tokens, fonts, sharp corners and assets. Record them in the first CSS comment.
- Product visuals only (Ladder slice, ticker, starburst, floor badges), built from the same parts as the app. No stock photos.
- Still run hallmark's floor rules, sloplint at every width and its fresh subagent review.
- Real facts only, as listed in the brief.
- The "Enter MUSDash" buttons link to the app.
- It must feel like the lobby of the same building as the app.

Rules:
- No test files. Verify by running it and checking in the browser.
- Commit and push after each finished piece, no Claude or Anthropic attribution, never commit secrets.
- Update the GitBook docs where the frontend changes how people use Juu.
- When both parts are done, give me the commands to run them locally, the URLs, and a short list of anything you couldn't connect or match.
