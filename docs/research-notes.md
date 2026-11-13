# Juu: Mezo testnet research notes (step 1 and 2)

Checked 12 Nov 2026 against Mezo testnet (matsnet), chain id 31611, RPC https://rpc.test.mezo.org, block ~16,742,900.
Every address below has code on chain. "How checked" says where the address came from.

## Addresses (testnet)

| Piece | Address | How checked |
|---|---|---|
| MUSD | 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503 | Mezo docs + musd repo deployments/matsnet |
| BorrowerOperations | 0xCdF7028ceAB81fA0C6971208e83fa7872994beE5 | musd repo deployments/matsnet |
| BorrowerOperationsSignatures | 0xD757e3646AF370b15f32EB557F0F8380Df7D639e | musd repo |
| TroveManager | 0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0 | musd repo |
| HintHelpers | 0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6 | musd repo |
| SortedTroves | 0x722E4D24FD6Ff8b0AC679450F3D91294607268fA | musd repo |
| PriceFeed | 0x86bCF0841622a5dAC14A313a15f96A95421b9366 | musd repo; reads oracle 0x7b7c…0015 |
| StabilityPool | 0x1CCA7E410eE41739792eA0A24e00349Dd247680e | musd repo |
| PCV | 0x4dDD70f4C603b6089c07875Be02fEdFD626b80Af | musd repo |
| InterestRateManager | 0xD4D6c36A592A2c5e86035A6bca1d57747a567f37 | musd repo; interestRate() = 100 bps |
| sMUSD (MUSDSavingsRate, proxy) | 0x6f461c68B2c5492C0F5CCEc5a264d692aA7A8e16 | PCV.feeRecipient() on chain; explorer names impl MUSDSavingsRate |
| BTC (ERC-20 view of native BTC) | 0x7b7C000000000000000000000000000000000000 | veBTC.token() |
| MEZO | 0x7B7c000000000000000000000000000000000001 | docs |
| **veBTC (live)** | **0x38E35d92E6Bfc6787272A62345856B13eA12130a** | Voter(live).ve(); 1,744 locks |
| **Voter (live)** | **0x263F1Fd5fB7F866881e1B6cD7d5d6c40Fd985F0D** | used by feasy; has sMUSD gauge |
| RewardsDistributor (live) | 0x9050218f89F0b5b17df4a30Ba4Fc97C72E307442 | veBTC(live).distributor() |
| Router (DEX) | 0x9a1ff7FE3a0F69959A3fBa1F1e5ee18e1A9CD7E9 | tigris deployments/testnet |
| PoolFactory | 0x4947243CC818b627A5D06d14C4eCe7398A23Ce1A | Router.defaultFactory() |
| MUSD/BTC volatile pool | 0xd16A5Df82120ED8D626a1a15232bFcE2366d6AA9 | PoolFactory.getPool |
| sMUSD gauge / its fee reward | 0xA6972f35550717280f2538EA77638B29073e3F07 / 0x613F6386A6549d29a1488F5246C58cE54B128ED4 | Voter(live) |
| Pyth (not used by MUSD) | 0x2880aB155794e7179c9eE2e38200202908C17B43 | docs |

Old, not live: veBTC 0xB63fcCd03521Cf21907627bd7fA465C129479231 and Voter 0x72F8dd7F44fFa19E45955aa20A5486E8EB255738
(from the tigris repo and the Perpetua repo). They still have code but only 424 locks, no sMUSD gauge and zero rebase for 9 weeks.

## Facts that shape the design

- veBTC max lock is 30 days (tigris deploy/08_deploy_ve_btc.ts; on chain a 35 day createLock reverts LockDurationTooLong).
  Lock ends round down to Thursday 00:00 UTC. So at most 4 to 5 end dates exist at any time.
- veBTC can be transferred (normal ERC-721, safeTransferFrom needs onERC721Received). Not blocked by having voted.
  Voting power drops to 0 at lock end unless the lock is permanent. Permanent locks have no end date.
- increaseAmount: owner or approved address; fails after the lock has expired.
- RewardsDistributor.claim adds the weekly BTC rebase back into the lock (depositFor) while the lock is live. It pays out to the owner only after expiry.
- Voter: one vote per lock per weekly epoch, from epoch start + 1 h to end − 1 h. Votes stay until reset. withdraw needs reset first.
  Voter.claimFees / claimBribes pay the NFT owner.
- Weekly voter rewards on testnet (last epoch): about 22,000 MUSD to sMUSD gauge voters (gauge weight ~6.2), near zero elsewhere.
  BTC rebase per week: 0.000006 to 0.027 BTC total, erratic. Testnet rates are not realistic.
- Troves are keyed by msg.sender. No function moves a trove to a new owner. A contract can open and run its own trove
  (feasy vault 0x5e78…9Ed2 is a contract with an active trove).
- Min debt: minNetDebt 1,800 MUSD + 200 MUSD gas compensation. Borrowing fee 0.1% once. Interest 1%/year. MCR 110%, Recovery Mode below 150% system ratio (now 256%).
  In Recovery Mode collateral withdrawals are blocked.
- PriceFeed.fetchPrice() reverts if the oracle is older than 60 s. Oracle (precompile 0x7b7c…0015) updates every block; blocks ~4.2 s.
- sMUSD on testnet is NOT an exchange-rate vault: deposit(amount) mints 1:1, withdraw(amount) burns 1:1, yield is claimed with claimYield().
  Yield follows the holder through transfers (_beforeTokenTransfer settles it).
- DEX: MUSD/BTC volatile pool reserves ~102.4M MUSD / 1,305 BTC, implied ~$78,500 vs oracle ~$71,300 (about 10% apart on testnet).

## Probe scripts
research/tools/probe*.mjs (read only, no keys). Run: `cd research/tools && node probe.mjs`.
