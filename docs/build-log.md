# Juu build log

## Series lock design (decided 13 Nov 2026)

Juu sets its own series end dates (Thursdays 00:00 UTC; first two: 31 Dec 2026 and 25 Mar 2027).
Checked on the live veBTC (0x38E3…130a) by read-only simulation, as the owners of real locks:

- a) lockPermanent: worked on all 28 normal live locks tried, voted or not. unlockPermanent works only when
  the lock has no active vote; Voter.reset clears it, allowed once a new week has started since the last vote.
  **Used.**
- b) increaseUnlockTime to 30 days: works unless the lock already ends at the 30 day maximum.
- c) withdraw after expiry: works (then createLock).

How (a) runs in JuuSplitter:
- Open: the series lock is permanent (full voting power). Doors 1 and 4 add BTC to it.
- startUnlock (anyone, from 30 days before the end, before the keeper votes that week): reset, unlockPermanent.
  Mezo sets the end to the next Thursday at most 30 days out, which is the series end date when called in
  the week starting 30 days before it. Called later, the lock ends on a later Thursday (P is paid later).
- mature (anyone, from 1 hour after the end): last harvest, reset, withdraw. P redeems 1:1 in BTC.
  BTC above the principal (rebase Mezo added into the lock) goes to Y holders.

Y forecast (JuuPricer):
`expected_yield = weekly_yield x (full_power_weeks_left + tail)`, where full-power weeks run until the
unlock date and the tail is the last ~30 days as power falls to zero: `time_left^2 / (2 x 30 days x 1 week)`,
about 2.1 weeks. `Y_margin_value = expected_yield x Y_haircut`. weekly_yield is in MUSD per BTC per week
(set by the keeper; 0 until first reported).

For the app (later): show users that their BTC stays in Juu until their series end date, and the date P pays.

Keeper requirement (owner, 13 Nov 2026), build with the keeper bot: for every series, the keeper calls
startUnlock automatically in the week that opens 30 days before the end date (at the start of that week,
after Mezo's first hour and before that week's vote), and calls mature right after the end date (from one
hour after it, retrying until it succeeds). A P payout must never slip to a later Thursday because nobody
called it. The keeper should alert if either call is still pending as its window closes.

## Built so far

| Contract | File | Size |
|---|---|---|
| JuuSplitter | contracts/src/JuuSplitter.sol | 19.6 KB |
| PYToken (P and Y per series) | contracts/src/PYToken.sol | 2.6 KB |
| JuuPricer | contracts/src/JuuPricer.sol | 4.2 KB |
| JuuBank (v4) | contracts/src/JuuBank.sol | 13.0 KB |
| MUSDash (v2, Y and P chips) | contracts/src/MUSDash.sol | 16.0 KB |
| JuuBuffer | contracts/src/JuuBuffer.sol | 1.5 KB |
| DemoPriceFeed (DEMO ONLY, for the separate demo deployment) | contracts/src/demo/DemoPriceFeed.sol | 1.1 KB |

Dry runs need FOUNDRY_EVM_VERSION=osaka (Mezo's veBTC uses osaka opcodes). Mezo's BTC is a chain precompile,
so BTC transfers only run on the real chain, not in a local simulation.

Live veBTC differs from the tigris repo source: voting power is `votingPowerOfNFT` (no `balanceOfNFT`).
Every other function Juu calls matches the explorer's verified ABI of the live veBTC, Voter and RewardsDistributor.

## Deployed on Mezo testnet (deployer 0x5Ac87a8AeC1EF2Ff28835e6EBbf52495C89Bc5eA)

### Current: Splitter v2 (13 Nov 2026)
v2 change: a series can be created while its unlock week is still ahead (so a 10 Dec demo series fits), and
deposits stay open until startUnlock is called.

| Contract | Address |
|---|---|
| JuuSplitter | 0xC97F652387E213a92DD2DaBDb41754CdD535ce5e |
| JuuPricer | 0xe25F6095665626342ffF7FeA7d8BE0c40517Cf34 |
| Series 0, demo, ends Thu 10 Dec 2026, P / Y | 0xd48fff2Cb7eD312FE9F806176786a82a06480a4c / 0x1378aA37A64729AA6a082d0550E06f3C308619Bf |
| Series 1, ends Thu 31 Dec 2026, P / Y | 0x93269Ff6A2316F0DAf62030d7A175AD6E5b1d657 / 0x9e8A5E7BCAf3d9ca2C693f203F1EF42823e2FB2C |
| Series 2, ends Thu 25 Mar 2027, P / Y | 0x6CCb4e6e2a21b22dC2Ab62F2c579721b479F3265 / 0x4d11dbd2654feD34136bAD235ABa012c8DE821C1 |

Deploy: 9 transactions, all status 1, blocks 16743418 to 16743426.

Checked on chain:
- Zap 0.001 BTC into series 0: tx 0xbdfe129d67757baff73a18af19dc7d4de51386ab84ec88f49ed2de03c55a0539 (series lock #1747).
- Zap 0.001 BTC into series 1: tx 0x295eb29b14a63a9a953c6f1b8e28b3c9379c8ede1afb5d3839269a61a5232ac8 (series lock #1748, permanent, full power).
- startUnlock series 0: tx 0x2c69cf4e0deff3c56457fa72c86eba1a90fee72a0ff6d58e32164a11c032939d. Mezo set #1747 to end
  1796860800 = Thu 10 Dec 2026 00:00 UTC (the series end date). Phase Unlocking, voting power 96.5% and falling.
- Vote both locks for the sMUSD gauge: tx 0x0ed8eeb0a8748dec560bfc83b3a34dd2997194476aab167c0a5866a46d57f537 (series 0),
  tx 0xaa84856fd791199b39dec3f2f8e2587f77862942d17a8ab232d3f53b31bc5d41 (series 1). The gauge's fee reward contract shows
  balances 0.000965 and 0.001 for #1747 and #1748.
- harvest series 0 and 1: tx 0x6b56df82…7cd7, tx 0x661e2e2d…8209; claimY series 0 and 1: tx 0xe27f96a3…4947,
  tx 0x96ce0450…2126. All status 1, amounts 0: Mezo pays a week's voting rewards only after the week ends.
  First real payout check: from Thu 19 Nov 2026 (estimate ~7 MUSD for the week at last week's rate).

Demo calendar for series 0: harvest + claimY weekly from 19 Nov; mature from Thu 10 Dec 01:00 UTC; then redeemP.

### Bank v3, current (13 Nov 2026)
JuuBank 0x2F12021337cB016e8b03D922D0981A0D82B37E27, deploy tx 0xb635bae9846c480f517fece9a1ada382cd23923e60b0699b071478566b92ac13.
Savers deposit BTC for jBANK shares (about 1,000 shares per BTC at the start). One trove at 300% (rebalance between
270% and 330%). MUSDash will pay winners with payOut and send income as MUSD; exposure cap 20% of capital.
Mezo details it handles: borrowing cap is fixed at trove open, so rebalance refinances before borrowing more; repaying
stops at Mezo's minimum loan (1,800 + 200 MUSD); collateral comes back as plain BTC; the 200 MUSD gas compensation is
refunded at close, so it is not counted as a cost. While the trove is open, savers are paid in BTC; MUSD leaves only
from what the Bank holds above its debt.

Trove test on v3 with the TEMPORARY 160% setting (faucet cooldown), all status 1:
- setRatios 160/150/170 tx 0x28bb3ec7a8c00a9c4148ef97b720aba5ef376f41621c91ddbffb58d4fb6e7f4b
- deposit 0.0453 BTC tx 0x3bb28339…2901; rebalance opened the trove tx 0x5e033333db7e68ae853ccbfd50764aca79fae9b44b5900d8508b233feceb5983:
  coll 0.0453 BTC, debt 2,016.70 MUSD, CR 160.0%, Bank MUSD 1,814.89. NAV 0.045275 BTC (only Mezo's 0.1% fee lost).
- borrow (target 150%): tx 0x3430d67fccac479df2ee808a2d2caff2046135c8af3a6362cc6f57c78681c35c, debt 2,151.61, CR 150.0%.
- repay (target 160%): tx 0xb17f9dbfbb0ca49f5a1d62b1858bfff1cf17fcdd2f64ed4c788d45e4d8ab9420, debt 2,018.30, CR 160.0%.
- withdraw 10% while open: tx 0xa9dfe181660a598fa46f58792e7f85c10a15153fdc46efc30d32faa8a455ee8d, paid 0.00452726 BTC
  (exactly 10% of NAV), no MUSD; debt stopped at Mezo's 2,000 floor; CR 145.3%.
- 3 MUSD sent to cover Mezo's borrowing fees, then withdraw all: tx 0x891bad45aa70c9f38bb78e2b7017583754a23e130e09a079da11b76450b448fe
  closed the trove, paid 0.04077274 BTC + 1.05 MUSD. Bank empty.
- **RESTORED to 300%** (3.0 / 2.7 / 3.3): tx 0xa8f3f1858cc8c37d1d9033b5e5738c23959e8b79c2a5d0d3434117309ce6cd85.
Not yet run: refinance (needs collateral added to an open trove, then a borrow above the opening cap), payOut (MUSDash).
Known limit: if the game leaves the Bank owing more MUSD than it holds, the last saver cannot close the trove until
MUSD is added (bought or earned).
Earlier the deployer swapped 0.0001 BTC for 7.84 MUSD on Mezo's Router (tx 0xca79ae3e43275ee1f0d822cc81c8970b06c76c52c50b16c0809ef356dc75a700).

### Retired: Bank v1 and v2 (13 Nov 2026), both empty, no trove
- v1 0x56f40Bbb4D9d8a86b7aF0A712ec44fcEEe43fEA0: counted Mezo's refundable 200 MUSD gas compensation as a cost
  (Bank value fell ~6% when the trove opened). Closed with tx 0x07cfa7b41564061f82a6576d4cf37253d0f987040a22b66b96feeb4d4ce0d1b1.
- v2 0x214767De1eE65CFf147EAA1c90F719535b594baB: a withdrawal while the trove was open paid MUSD that backed the loan,
  so the last saver could not close. Closed after returning 148 MUSD, tx 0xca293255509f852aa0507bd33d38cb66894afc1c2be8fdee59e8f962d3d25161.

### Retired: Splitter v1 (13 Nov 2026)
JuuSplitter 0xc79ef730C6CdbD38b1bF63Cb8b8Ec806c10d6180 and JuuPricer 0xE2E8C7D8d52cc27a16F54edc82142D66Eeb3cE18.
Still holds series 0 (ends 31 Dec 2026) with 0.002 BTC of test funds (zap tx 0xa2c39c04…94c2, deposit of lock #1746
tx 0x672a209d…e38d into lock #1745). The deployer can mature it and redeem after 31 Dec 2026.

## Wallets and helper scripts
- Deployer 0x5Ac87a8AeC1EF2Ff28835e6EBbf52495C89Bc5eA. Faucet funders (testnet only, keys only in .env):
  funder 1 0xE52c35FcA206c0421B84f3469129aa8342115857, funder 2 0xCBEB69C6cAe97384AE211B5f04D667e020549E7D.
- scripts/send.sh: send one tx from the deployer (gas estimate padded by half).
- scripts/sweep-funders.sh: send the funders' BTC (minus a gas reserve) to the deployer. Run only when the owner says
  they are funded.

## MUSDash (deployed 13 Nov 2026)
Funding: scripts/sweep-funders.sh moved 0.04999 + 0.04999 BTC to the deployer (tx 0x93c3919125c9a4d0a2d41e4cec87d217302bcaf509445ec99ddc00728bb8c9be,
tx 0x97828a04825c1ef87bc064f4adff2efd87743d9aa87df5f608998bdfd25bb0ad). First run failed: the gas reserve was too tight for
cast's max fee; the reserve is now a flat 0.00001 BTC and failures print their error.

Main Bank v3 funded: deposit 0.09 BTC tx 0x72853df93b12e03fa3cdd90103d58d7b7d1409da15193b6fea2ad0167c301639; rebalance opened
the trove at 300.0% tx 0x96d09de019acd0861370c4e1b95c75c68dee4b9fe60d525fedf143094e4a50d2 (debt 2,138.81 MUSD, Bank MUSD 1,936.87,
capital ~6,414 MUSD, maxExposure ~1,283 MUSD).

Main deployment (Mezo PriceFeed, Bank v3): MUSDash 0xC5C8064985ee3FcF8529228038265CC87a049AC6, JuuBuffer
0x264305bb088cA727433FF8dCe791840D0E75cff4. 4 txs, all status 1 (first 0xeaaa8f58…2046). bank.game and buffer.game set.
Real-price check: open Bull floor 1, 20 MUSD (tx 0x7a5896ac…a245; size 30, liquidation price 25,180), close
(tx 0x8a4df09b…c97db). Cost 0.0588 MUSD (two 0.03 fees + tiny move). Buffer got 0.018.

DEMO deployment (separate, DemoPriceFeed): feed 0x01297A4923330BC49EAA21777284b3e6440498E8, Bank 0x35D4D57507F33805a0b62b3852396a394088a390,
Buffer 0x955eB2cFCE5204a818e3E506F9060300Edbf479C, MUSDash 0x756e4aA5a229bEB93591785CaB6dEd40a121E376. 6 txs, all status 1.
Demo Bank: deposit 0.03 BTC (tx 0x01bee7cf…0fa9), no trove (capital ~2,138 MUSD, maxExposure ~427).
Chips: swapped 0.015 BTC for 1,176.6 MUSD on Mezo's Router (tx 0x42b0a167…80f2).

Demo test (price pinned at 71,000, all status 1; full tx list in docs/gitbook/technical/contracts-and-addresses.md):
- opened #1 Bull f2 100, #2 Bear f3 100, #3 Bull f10 30. Liquidation prices 36,920 / 93,247 / 65,320 (= -8% at 10x). Funding
  bull pays 0.0025%/h (0.01% x 200/800).
- climb #1 f2 -> f3: margin 99.80 (0.2 fee), size 299.4, Agaruzo event in the log.
- price to 64,610 (-9%): #3 equity 3.00 <= 6.00, collapsed (FloorCollapsed event): 1.50 to #1, 0.75 Buffer, 0.75 + 27.00 loss to Bank.
- close #2 (Bear): paid 126.70 + 0.06 protocol fee to treasury (deployer); Bank paid the 27.00 gain.
- close #1: paid 74.05 (72.85 + 1.50 survivor reward - 0.30 fee) + 0.06 protocol fee. Game contract left with 0 MUSD.
- price back to following Mezo.
Not yet tested: bad debt (Buffer.coverBadDebt), funding over hours, survivors with several positions.

Deployer after all this: ~0.0109 BTC, ~1,149 MUSD (most demo chips came back on close).

## Bad debt test (demo v1 stack, 13 Nov 2026)
Price 71,000 (tx 0x64dad2c7…b288); open #4 Bull f10, 10 MUSD (tx 0xf8d798e8…e54a); price 63,190 = -11% (tx 0x9e30047b…dc4b);
liquidate #4 tx 0xe31c29aa3291bbeb025b43ac13ae3eeb995d2f18bb7bc5e21071b8ebdee5bf48: equity -1.000053, Bank got the 10.00 margin,
BadDebtCovered asked 1.000053 paid 1.000053 (Buffer 1.2598 -> 0.2597). Bank total +11.000053 = the position's full loss.

## Survivors + funding run (demo v1 stack, started 13 Nov 2026)
Price pinned 71,000. Opened #5 A Bull f1 100, #6 B Bull f2 50, #7 D Bear f2 100, #8 V Bull f10 20 (deployer).
Background job opens #9 C Bull f3 40 from funder 1 after 90 min and snapshots after 3 h (research/demo-funding-run.log).
Then: V collapses at -9%, survivors A, B, C share by size x time; check funding against the formula.

## Y and P chips: MUSDash v2 + Bank v4 (13 Nov 2026)
MUSDash v2: chips are MUSD, Y or P of one series. Y/P value read from the Pricer at every check. When a Y/P position owes
MUSD (fee or loss) the Bank pays it (payOut) and takes chips worth that much (rounded up). Collapse: all chips to the Bank,
Bank pays survivors' and Buffer's shares. Y rewards earned while posted go to the Bank (sweepYRewards) - flagged to owner.
Bank v4: counts Y/P it holds at Pricer value (tokenValueMUSD), gives withdrawing savers their share of them, claimY/redeemP.
Sizes: MUSDash 16.0 KB, JuuBank 13.0 KB.

Main: JuuBank v4 0x42428f3c928c9af20E4d10Ca1D91aBDd565c5959, MUSDash v2 0xBc8d6C76BcabF0A4370828CEeb20ffF2F2d0b2Bf, Buffer
0x2643…cff4 reused (setBank, setGame). 6 txs status 1. Bank v3 closed (top-up 2.9 MUSD tx 0xa4377508…219c, withdraw all
tx 0x3cf988e1…6476), 0.09 BTC into v4 (tx 0xa8e98f3c…b7a2), trove at 300.0% (tx 0x773bc744…55e4), MUSD 1,931.10.
Demo v2 (separate): Pricer 0x009BcfeC38cF0F15215E87B44fF1DF53c868A0D1 (reads demo feed), Bank v4 0x0A2acca04fD2fEbd2BB9e6eE30762b487A51F420,
Buffer 0x523BbdFecf4B226d4BA4302234A69586A6069A93, MUSDash v2 0x96e7A84D8bC5Cd7bfe8742c399141B4596b5844b. 7 txs status 1.
Weekly yield reported to both Pricers: 3,568.25 MUSD per BTC per week = epoch of 5 Nov sMUSD gauge fees 22,047.15 /
current gauge weight 6.18 (main tx 0x6c321b9e…bfee, demo tx 0x1c11fd6b…a746). 0.001 Y (series 1) = 13.45 MUSD margin,
0.001 P = ~64 MUSD.
Main chip test, all status 1: open Bull f2 0.001 P (tx 0xcea6b7e8…7c76, fee 0.128 -> Bank took 0.000002 P), open Bear f1
0.001 Y (tx 0x4216d7211b1a77314be19f8aab1f9414ca2cebb060fe832ef5c304d8eeb7e770), climb P f2->f3 (tx 0x12cf36c8…b8e6), close both (tx 0x1f05a3a0…a6e,
tx 0x24fd9a64…5769). Player left with 0.0009937 P, 0.0009956 Y; game holds 0; Bank holds the fee chips.

## v3 build (13 Nov 2026): Agents, Loop, P Market, Climb Premium, jackpot, sMUSD door, Juu account, keeper

Why new versions: the owner's Y-rewards decision (credit Y rewards to the position), the Climb Premium (charged when a
seat is taken), jackpot tickets (size x time, only the game can track) and the Loop (catch winnings at payout) all need
MUSDash changes, so MUSDash v3 was deployed next to v2 (v2 had no open positions). Juu Agents did NOT need any MUSDash
change: the AgentGateway sits in front and holds agent positions. Buffer v2 adds jackpot payouts. Splitter, Pricers and
Bank v4 are reused (Bank.setGame points them at v3). foundry.toml now uses via_ir (MUSDash v3 hit "stack too deep").
MUSDash v3 takes its epoch length at deploy: 1 week main, 15 minutes demo (DEMO ONLY), so kill switch and jackpot can
be shown in an hour.

Sizes: MUSDash 20.8 KB, AgentGateway 16.8 KB, JuuAccount 11.4 KB (factory 13.5 KB), JuuSavingsSplitter 10.6 KB,
JuuLoop 6.0 KB, JuuJackpot 4.4 KB, JuuPMarket 4.2 KB, JuuBuffer 1.8 KB.

Main (script/DeployV3.s.sol STACK=main, 19 txs status 1, first 0x77b3db4c…a700, blocks 16744663-16744681):
  MUSDash v3 0xfD5c96497Ae439f88023EFa78D13Afa6C0ca40E7, Buffer v2 0xAB61604F82f645110A062b49F2bC204cbb473d39,
  Jackpot 0x508d6449FCb235c92D79f0011Dd09f3833233D62, Loop 0x33c807030053b821B1efCEcbF40F9A7025edec28,
  AgentGateway 0x29da0243E5604CAf1490d148B7dB5f0835Ab2394, JuuAccountFactory 0xECEf17Da15D530dB1bb0B906a35A8DCB6545d084,
  JuuPMarket 0x6748eA3C557B03611Fb360889ea61B4fB72B891c, JuuSavingsSplitter 0xF7857dB1d1Aa1Aa60a8576EBc1b2F8236b4A22f4
  (sMUSD series 0/1/2 = 10 Dec 2026, 31 Dec 2026, 25 Mar 2027).
Demo (STACK=demo, 13 txs status 1, first 0x7dd5d917…8650): MUSDash v3 0x3DC2CfdF76fa127abf5486357e79082A9b2E37Cd,
  Buffer v2 0xaa07cCbd7DC5662321D0E2bc7D4CFa34a9eB62A0, Jackpot 0xD5109C77e5C5ce383c4aD716281882B00B0F7e6c,
  Loop 0x6509684FF00DE88c0E233Ca16c2082b01Ce450a1, AgentGateway 0xb57abA53d416832974f3036A2c32Fe05f106DCAb
  (with demo feed 0x0129…98E8, demo Pricer 0x009B…A0D1, demo Bank v4 0x0A2a…F420).
Keeper wallet 0x01cd4ca24A84ce336798bFedC6276a0c7D28F547 (key in .env) set as keeper on Splitter, both Pricers, both
Jackpots (txs 0xc6e02c50…, 0xde7a5ba7…, 0x94fba210…, 0xea6b094a…, 0x5aa7253e…). Test agent 0x5028fbbeB006e97f0103d6DD85807fc63998429a.

P Market (main): zap 0.001 BTC into series 2 (tx 0x2bf2e9aa…37e0); pools series 0/1/2 = 0xD45911fe9c72006D815C54FCBc60D7D21a8FebCd /
  0x2180E41eA2cd0e2c1adEC39d055A198c1bf84CdE / 0xf80410ebcdA86aaF749aBF079d1D9B8DC0155707; seeded 0.0005 P with 0.000495 /
  0.00049 / 0.00047 BTC. Implied fixed return 1.0% / 2.0% / 6.4%. My first test buy (0.00005 BTC = ~10% of the pool)
  paid 1.08 BTC per P (pool too small; my sizing error); sold 0.00005 P back (tx 0xacabaa8a…7bced) to restore ~0.98.
  Buy below full value: 0.00001 BTC -> 0.0000104 P on series 2 = 0.9604 BTC per P (tx 0x5354cf147d6899c2e5d3571c0d61cdf7a1e11aa9ed95764589d92aa078998d66).
sMUSD door (main): 50 MUSD -> 50 sMUSD (tx 0x6d5c0677…483d), deposit into series 1 (tx 0xd74e283de1f13ed8f8a3eb6ddeeb4aaf401f93ddfd4ac49930dc287c0257b1ca)
  -> 50 P-sMUSD-DEC26 + 50 Y-sMUSD-DEC26; harvest tx 0x50ab7fc3…0b0b (0 yield so far: sMUSD pays weekly).
Agents (demo): grant tx 0x51855d7a…1ded4e; open #1 Bull f2 20 MUSD via gateway tx 0xe6e8cdd1e45aadedbb31770b2240a83d5900b126a765807a55b34d941edff632
  (Buffer +0.037, Bank +0.045 = trading fee 0.04 split 30/50 + agent fee 0.05 split 50/50); climb f2->f4 tx 0x3b6672d2…0407;
  close tx 0xabf2edb97c8f8eba9ed04ea1f7d0726e989012392a172e1aa2cb6d657174de52 (cost 20.19, returned 19.88, result -0.31);
  AgentFeePaid 0.05 each (0.025/0.025) on open, climb, close. Refusals: 40 MUSD -> BetTooBig, floor 6 -> FloorTooHigh,
  climb to 7 -> refused, after revoke (tx 0x2eb58b99…) -> NoSession, daily limit 0.20 with 0.31 lost -> StoppedForToday.
MCP server: 21 tools listed; whoami/sides/my_session read OK; juu_open opened #8 (tx 0x0a6becd99ffcc7f1f79ec504240a6ddcdfe5055bcf8ab606d7d6dc3ac6e4ab73),
  juu_close closed it (tx 0x17ca6777…51c9); errors now decoded (e.g. "refused by the Agent Gateway: NoSession").
Loop (demo): setLoop(on, 2) tx 0x22827c46…c352; open #7 Bull f2 20; demo price +5%; close tx 0xc3cb26b10ca0e5341da479c3008fdf9835bb2337e579daa2e1d17e8457bc67f0:
  winnings 1.96 MUSD swapped to 0.0000250 BTC and zapped into series 2 (P2 and Y2 +0.0000250 each, Looped + Zapped events).
Climb Premium (demo, epoch 1993924): seats on floor 7 paid 1.00 (to Bank, floor empty), 1.10, 1.21 (txs 0x27cb9b45…,
  0x0cd12390…, 0xe8e64f13…); A (#2) earned 1.705 = 1.10 + 1.21 x 70/140 and was paid 11.649 on close (tx 0x55e63ba5…1e5c).
  Epoch 1993925: one seat (D #6 floor 8, tx 0x5e31466f…0ccc). Kill switch expected to trip after 01:30 UTC.

Kill switch: keeper tx 0xc26fc2a54e92cb8e5f0429c8bcf061e5cc567dee37fb6484d5708d3a8bdb3ad7, KillSwitch(epoch 1993925, seats 1, previous 3);
  premiumOn false, floor-7 seat premium now 0. Seats in 1993925: one (D). Closes: B 39.94, C 10.55 (earned 0.605 = half
  of E's 1.21), E 9.94, D 9.94 (txs 0x921455ed…, 0x6ba20b17…, 0x766d03db…, 0xdf897884…).
Jackpot (keeper): epoch 1993924 revealed (tx 0x82cd3016…2b36), skipped: Buffer 0.34 < 15 target (positions open).
  Epoch 1993925: commit tx 0xf624fc44…8e94, seal tx 0xe3e6a389…6552, reveal tx 0xeeb4b936f145a867063a600f3d45df48990da826c23e5b3286de434562a131a5:
  ticket 5.938e22 of 1.2177e23 -> position #4 (deployer), prize 0.43095196 MUSD (Buffer surplus, OI 0).
Agents + premium (main gateway): agent open floor 7 tx 0x1a150549…3255; user paid 11.106 = 10 + 0.07 fee + 1.00 premium +
  0.05 agent fee - 0.014 protocol share back to treasury; Bank +1.06. Agent setLoopFor on tx 0x9f30acb9…; close tx
  0x0db1ca82… had no winnings (real price dipped); Loop off tx 0x4f16d524…; revoke tx 0x03907dbb….
Agents + Loop (demo): first try failed: the demo Bank (no trove, 0.73 MUSD on hand) could not pay a 2 MUSD win
  (ERC20InsufficientBalance). userClose #9 tx 0xdcd8c5bd…; added 20 MUSD to the demo Bank (tx 0x0447793f…); retry:
  agent close tx 0x4b010a4768cd837d517db35c24e4dc9b994e3d5862da85305efb7db440a6a0e7 -> 1.96 MUSD looped into 0.0000250 BTC
  of series 2 (Looped + Zapped), AgentClosed result +1.82. Price reset, Loop off, revoked.
FINDING (decision for owner): MUSDash's exposure cap counts the Bank's whole capital, but winners are paid from Bank
  MUSD on hand. A Bank without a trove can't pay large wins. Keeper now warns when MUSD on hand < 20% of the gap.
Leaderboard (demo): agents: test agent -0.45 (plays for deployer); humans: deployer -0.82; all: both, labelled.
MCP: errors now decoded via a simulated call before sending.
Daily loss limit: re-grant with 0.20 limit after 0.31 lost -> StoppedForToday (simulated).

## GitHub (13 Nov 2026)
Private repo created with gh (name juu, branch main). First commit d2411f7 "Add Juu contracts, backend, docs and spec".
Before it: .gitignore covers .env, research/, broadcast/, cache/, out/, contracts/lib/ (reinstall with forge install),
backend/data/ (keeper secrets, event cache), node_modules/. Key scan: the 5 private keys in .env checked against all 79
staged files, 0 hits; no key-like assignments. .claude/settings.json sets includeCoAuthoredBy false. No attribution in
commits. scripts/precommit-scan.sh repeats the scan before every commit.

## RPC flakiness (13 Nov 2026)
Mezo's RPC sometimes fails eth_getTransactionReceipt ("method handler crashed" / null response). It crashed the
backend once (ethers' tx.wait threw outside a try). Fix: the backend and MCP server poll receipts themselves with
retries; unhandled errors become warnings. scripts/send.sh now submits with --async and polls the receipt.

## Juu account test (main, 13 Nov 2026)
Account 0x6B09715cb102ff39ecb15375dCDF624131049BC5 (factory create tx 0xd8b53466…5da4). BTC came from the old demo
Bank (withdraw all tx 0xb1a5e1ba…1e79, 40 MUSD returned to it for the open funding run, tx 0x219ed77e…c9ad), the
demo v2 Bank (withdraw tx 0x66f520d9…bcfb) and 300 MUSD swapped to 0.00382 BTC (tx 0x8c218e49…dcda3).
- openTrove 0.0405 BTC, borrow 1800: tx 0x21a9fd65810d4d1518be967df061bda74d38bc4aa7516bbc406d998d7c6f6337, ICR 143.3%,
  cash 1800, capacity 2133.
- withdrawMUSD 1700 to owner (RPC null reply; state confirms cash 100, capacity 774).
- play #2 Bull f2 120 MUSD: borrowed ~20.26 straight from the trove (debt 2001.8 -> 2022.06), position owned by the
  account (RPC null reply on the receipt; state confirms).
- close #2: tx 0x34277d2842a7491d1bbc1cd08d95b0d113936699574aa4426ac68be337801294, Returned: margin 120, got 119.70,
  repaid 22.06 (debt back to Mezo's 2000 floor), no profit to swap.
- play #3 Bull f10 20 (tx 0x6baf3869…99df) and #4 Bear f10 20 (tx 0x556f127f…c23c); a background watcher closes the
  first one to profit after fees (profit -> BTC collateral path).

## Cash reserve rule: Bank v5 + MUSDash v4 (13 Nov 2026, owner's decision)
Bank v5: reserveShare (20%, setting); reserveTarget = capital x 20%; topUpReserve() borrows the shortfall from the trove
but never past targetCR (300%), emits ReserveToppedUp / ReserveShort; rebalance never repays below the reserve.
MUSDash v4: maxWinShare (100% of size, setting) caps a bet's win so its worst case is known; open and climb are refused
(BankCannotCoverWin) if bank.liquidity() < worst-case win. Sizes: MUSDash 21.2 KB, JuuBank 12.9 KB.
Deploy (script/DeployV4.s.sol, reuses Buffer v2 and Loop): main 15/15 status 1 (first 0xa41412dd…4614; one RPC receipt
failure mid-run, finished with --resume): Bank v5 0x55726A86c321347db688f2C6A331445465eeE9BE, MUSDash v4
0xb86Ef40aB59dFbc9fAE812Bc379D248DB3D6Defd, Jackpot 0xAca44212b5Ac418E17B750142F9152314eccdE5e, Gateway
0x87968C86f9728FB0f946453e6DECD0Cea70204Fd. Demo 14/14 (first 0x4527d880…7b0f): Bank v5 0x136fc7b4f5C7A2028C33d27055cf1ab8387Aa4fD,
MUSDash v4 0x652C3Db601a194f4f7BD4294e7447f1fDbe99525, Jackpot 0x357B24D3dc36f8F40601aD50E7325c5D076d8296, Gateway
0x5E2DFd2992CACb5d8ca505069FD79154Bf15e4F5. Account factory: first v4 one 0xA7e5…6983 replaced (see guard) by
0x6Fe844B458829e60CCe1dcd0000eeA94B96C76e4 (tx 0x8ba65843…73e1).
Funds moved: Bank v4 withdraw all (closes trove) tx 0x5178fb66…1d01; Bank v5 deposit 0.09 BTC tx 0x9645235a…dc9e,
rebalance tx 0x622ea8f6…a37a9 (CR 300.2%, MUSD 1911, reserve 1268); P1/Y1 fee chips passed to v5.
Tests (main v5): +0.04 BTC deposit; reserveShare 45% -> topUpReserve tx 0x9b481d20…9c03 borrowed 943.98 (CR 300.16%),
ReserveShort (2855 of 4128). Refinance: target 150% -> rebalance tx 0xdac713db…67ec, RefinancingFeePaid, cap
5763.6 -> 8341.0, debt 6117 > old cap. Restored 300% / 20% + rebalance tx 0xac6c11e4…65c1 (repaid down, MUSD stayed
above reserve); withdrew the extra shares tx 0x406e1cb2…77af8 (+0.03998 BTC), CR 291% (in band).
Demo cash check: Bank v5 with 0.02 BTC, 0 MUSD -> open refused BankCannotCoverWin (0x357e9431); 150 MUSD added (tx
0x0d387195…6896) -> open tx 0x794e261f…4b2b; size 200 > 150 refused; close tx 0x297b37a2…f320. topUpReserve without a
trove emits ReserveShort (tx 0xb92ed0d9…6f52d).

## Juu account guard fix (13 Nov 2026)
Finding: one account close costs 4.4-6.4M gas on Mezo (trove re-sorted in a ~370-trove list without hints); block gas
limit is 10M. The first guard() tried every bet in one call; with gas estimation, the try/catch let inner closes run
out of gas and skip (Guarded closed 0, txs 0x8e6552c2…, 0xf2a61d66…). Fix: guard(maxCloses); keeper calls guard(1) with
a fixed 9.5M gas limit each minute. Test on a new account 0x4eefd06CFCEE98057767fA24152783D596914a06 (v4 factory):
trove tx 0xf8cd3335…d6db, two 50 MUSD bets, setGuard 150% -> keeper guard(1) tx 0xef6b712f…ebe45 (closed 1, 4.75M gas)
and tx 0x5c4d77ba…983c (closed 1, 6.18M gas). Guard back to 130%; trove closed tx 0x7930fbf6…fcc1, BTC back.
Earlier account (v3) 0x6B09…9BC5: profit path tx 0xd91df310…986c (0.177 MUSD profit -> 0.00000226 BTC collateral);
closed bet 3 by owner, trove closed tx 0xd2838f2b…f659.
Follow-up: pass Mezo hints (HintHelpers.getApproxHint) in Bank and account trove calls to cut gas.

## Survivors + funding run results (demo v1, 13 Nov 2026, 00:21 to 03:22 UTC)
Funding rebuilt independently per segment (k=0.01%/h; rates 0.00385%/h then 0.00481%/h after C): expected vs contract
A 0.019646/0.019654, B 0.013067/0.013072, D -0.026095/-0.026116, V 0.026090/0.026133, C 0.008686/0.008717 (0.04-0.35%,
read-time drift). Bulls paid 0.067576, Bear received 0.026116; difference 0.041460 = funding on the gap (Bank).
Collapse V at -9% (price tx 0xe9943ee2…eb13, liquidate tx 0xad1de53a…e941): equity 1.973613, survivors 0.986807,
Buffer 0.493403, Bank 18.519790. Survivor shares by size x seconds: A 0.477020 (expected 0.47702), B 0.317695
(0.31769), C 0.192092 (0.19209); Bear 0. Closes: A 86.837, B 41.224, D 117.866 (txs 0x8342c339…, 0xa098ca9e…,
0x8ca06004…), C by funder 1 tx 0xe1c925db…4f81. Game left with 1 wei. Demo price back to following Mezo (tx 0x3e6ad0c6…c314).

## Public docs
docs/gitbook/ (GitBook, SUMMARY.md). Standing task: update them with every contract build or change, in the same task.

## Deploy (after funding)

```
cd contracts && set -a && source ../.env && set +a
FOUNDRY_EVM_VERSION=osaka forge script script/DeploySplitter.s.sol --rpc-url $MEZO_RPC_URL --broadcast --slow --gas-estimate-multiplier 150
```

## App end to end on testnet, all remaining flows (13 Nov 2026)

Driven through the app in a headless browser with the deployer as the wallet; every transaction status 1.

* Door 01 BTC, demo page: zap 0.003 BTC into series 1 (31 Dec 26) tx 0x1a8f6f5bc32f2acf09a8ff77f05ae31f7301fc750f4281854ca39440b30ed836.
* Door 02 veBTC: lock #1751 of 0.002 BTC made on Mezo first (tx 0xf462f2b5f595065d592077495fad20c947203ab01f161ca4ccdb8ca2d6fce3e8);
  approve tx 0x569940f88a16c5b8265dfa36e4995158fb48d15f5523739b187b21680ce46db3, deposit into series 1
  tx 0xcd4bc3978bd1dce641246c1dc2d2ec3df0b850dc2732a5df042f6b7a287f2644.
* Door 03 sMUSD: 60 MUSD to sMUSD on Mezo first (tx 0xe5f8813efd862142871b8de070dd9fd130b6b95767fb951f538ff28c03323449); approve
  tx 0x8582369b6508e0249c37e67ad310845c21fd0c1e61ab191a4ecb66294392ee69, deposit 50 into sMUSD series 0
  tx 0xeed0f64f12164fb6c1a7df33ac02a88cd7ebc5dfae6ccb5852c90a4dc6dcab64.
* Door 04 trove (main): not run. The wallet held 0.0146 BTC; Mezo's smallest loan needs about 0.032 BTC at 110%. The page
  now refuses it before signing ("You have 0.0146 BTC in this wallet." / "Mezo needs at least 110% collateral").
* Bank (demo): deposit 0.002 BTC tx 0x0d54b95065398ccda41e318f10b1ca1695a94077632148f8488d7e83b1feadc1, withdraw 0.0019 BTC
  tx 0xddc83fc90db36e2b632063b13715033818c7dd1aacd202d638d3a78f2f4e2760 (an earlier deposit, tx 0x3f6a831d…8fa4, also stands).
* Principal Market (series 1): buy 0.000005 BTC tx 0x240863e0757a6fc5a736f9c80e968b7f737a60d4cb40b246b8ba5962f2e3f8a3; sell
  0.000005 P: approve tx 0xe850141b05163a68a1802f783ea01f76205d3f46de3038e5d150e7442b5fd5fd, sell
  tx 0xdcb75e24086bd64f5c81cfef097be6eaf6b6938f5d6857aa6a82b50444636791.
  Found on the first run: the page's default amount (0.0098 BTC) replaced the typed one and bought 0.000476 P for 0.009818 BTC
  from a pool holding 0.0005 BTC (tx 0x40a62200…7227); a test sell then got 0.00305 BTC for 0.00001 P (tx 0xf28d1ec3…f903).
  Pool repaired by selling 0.000468 P back (txs 0x9064d32a…ce5b, 0xe42bfb51…c659): price 0.975 BTC per P. Fixed: price impact
  shown, orders above 5% refused (a 0.005 BTC order showed 1,022.92% and the button stayed off), typed amounts kept.
* MUSDash with Yield chips (demo): open Bull floor 2 with 0.0015 Y-veBTC1: approve tx 0xd10734501d59621daf6f5740ed1b8d2c3d3ae2692ac9354c8b46ce6b5940dc13,
  open tx 0xe985c2b1fa5f98dd2188d4ac8260812d11fbe96551a615107ff58e0a72c1ba64, cash out tx
  0xfee64f5049cb7242e333720ac4757d4d70ad0c32364a8daafe5aeb5712922b20 (0.00149337 Y back). Agaruzo! shown.
* MUSDash with Principal chips (demo): 0.0003 P-veBTC1: approve tx 0x75cf8a22382ecee28e03aff94d28dd59e72ca2d282a6056a87feb92d55bb43d9,
  open tx 0xe7f3195eb86931bdb648d301e478b39e555f6186ddc73978d9cb816ea59f6dea, cash out tx
  0x4accba4292c963a047bed157c2ecd4525c3f78ce9d204af5bf541f37148ef38b (0.00029878 P back). Agaruzo! shown.
* Agent (demo): give permission to the test agent (max 20, floor 4, loss stop 50, 7 days) tx
  0x7d45fed0ca21d4d67b4f2373a2cc97f355d803bb550edef37fd247ed3aadcb5b, MUSD allowance tx
  0x15c72dd718a7e5a40ab80ee1c511db9e80a51a76fbe01a6cd3e083f7d13ca533. The agent then played 15 MUSD through the gateway: open
  #7 tx 0xfc356b25f9a28070ad13fa1c6da875e2bd1720baac4de8550d9cfab650206863, close tx
  0x07ba93f9e9a2abd8b7f8686eee9f3b8710cb67951294d0e3ea09499807a24510 (result -0.1597). The card showed "−0.16 ▼ LOSS TODAY".
  The first permission attempt failed with Mezo's reasonless "missing revert data"; the app now retries such a call once.

Keeper moved to the server (13 Nov 2026, 09:33 UTC): laptop keeper stopped first, state copied (jackpot secrets checksum
matched), server keeper's first transactions: veBTC harvest series 0 tx 0xf2749c0e28627e5e152e2847a26f3c6dc50866aa1645eab5385f10c5de9f0d3e.
