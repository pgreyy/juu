Read juu-spec.md in this folder. It is the full product spec for Juu, a gamified money layer on Mezo, with a leverage game inside called MUSDash. We are building it for the Mezo Buildathon on Mezo testnet (matsnet).

Work in this order and stop after step 3 for my approval.

Step 1: Research Mezo before writing any code.
- Clone github.com/mezo-org/musd and read the contracts (BorrowerOperations, TroveManager, PriceFeed, and the Stability Pool if there is one).
- Find the testnet addresses and interfaces for: veBTC (createLock, increaseAmount, transfer, voting), the gauges Voter, the Mezo DEX Router, PriceFeed, MUSD, and the MUSD Savings Vault (sMUSD).
- Known starting points from other buildathon repos (verify them, don't trust them blindly):
  - Chain id 31611, faucet https://faucet.test.mezo.org
  - MUSD testnet 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503
  - TroveManager testnet 0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0
  - PriceFeed testnet 0x86bCF0841622a5dAC14A313a15f96A95421b9366
  - veBTC 0xB63fcCd03521Cf21907627bd7fA465C129479231 (from the Perpetua repo)
  - Reference repos that already integrate these: github.com/oynozan/feasy, github.com/SundownRises/perpetua, github.com/gr4yha7/pikolo

Step 2: Answer the 5 open items in section 9 of the spec, in plain words. The most important one: can a MUSD trove be opened in, or moved to, a personal smart contract account the user controls (Door 3, Option B)? If not, say so and fall back to Option A.

Step 3: Propose the build plan.
- List the contracts you will write, what each does, and which Mezo contract each one calls.
- Include these two pieces from the spec:
  - Section 4.1: P and Y are ERC-20 tokens grouped into series by lock end date (Pendle style maturities).
  - Section 4.1b: a P Market so people who don't want to play can buy P at a discount for fixed yield. Propose the simplest way to build it.
- Propose the build order and what a working demo would look like.
- Flag anything in the spec that won't work on Mezo as written, and suggest the simplest fix.
- Then stop and wait. I decide what gets built now and what gets postponed.

About the website:
- Juu has two feels. Some sections feel like a game (MUSDash, floors, the Agaruzo cheer, the jackpot) and some feel like DeFi (the Bank, doors, positions, the P Market). The website must feel like that, not like a generic DeFi dashboard or template.
- Do not build or design any frontend yet. Focus on contracts and backend first. When we get to the frontend, wait for me to send visual references before designing anything.

Rules for this project:
- Use Foundry for the smart contracts.
- Any backend (keeper bot for liquidations, epoch voting, jackpot draws) is Node.js with Express.
- Do not write test files of any kind. I test manually and with Postman. Verify work by deploying to Mezo testnet and calling the contracts.
- Keep it simple. Don't add anything the spec doesn't ask for without asking me first.
- Explain any jargon in plain words when you report back, and keep explanations in short paragraphs.
- Never put private keys in code or commit them. Use a .env file and add it to .gitignore.
