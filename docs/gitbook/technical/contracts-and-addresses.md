# Contracts and addresses

All addresses are on **Mezo testnet** (chain id 31611). Explorer: [explorer.test.mezo.org](https://explorer.test.mezo.org).

## Juu contracts (live)

| Contract | Address |
| --- | --- |
| JuuSplitter | `0xC97F652387E213a92DD2DaBDb41754CdD535ce5e` |
| JuuPricer | `0xe25F6095665626342ffF7FeA7d8BE0c40517Cf34` |
| JuuBank (v4) | `0x42428f3c928c9af20E4d10Ca1D91aBDd565c5959` |
| MUSDash (v3) | `0xfD5c96497Ae439f88023EFa78D13Afa6C0ca40E7` |
| JuuBuffer (v2) | `0xAB61604F82f645110A062b49F2bC204cbb473d39` |
| JuuJackpot | `0x508d6449FCb235c92D79f0011Dd09f3833233D62` |
| JuuLoop | `0x33c807030053b821B1efCEcbF40F9A7025edec28` |
| AgentGateway | `0x29da0243E5604CAf1490d148B7dB5f0835Ab2394` |
| JuuAccountFactory (Door 3) | `0xECEf17Da15D530dB1bb0B906a35A8DCB6545d084` |
| JuuPMarket | `0x6748eA3C557B03611Fb360889ea61B4fB72B891c` |
| JuuSavingsSplitter (Door 2, sMUSD) | `0xF7857dB1d1Aa1Aa60a8576EBc1b2F8236b4A22f4` |
| Keeper bot wallet | `0x01cd4ca24A84ce336798bFedC6276a0c7D28F547` |

### P Market pools (Mezo DEX)

| Series | Pool |
| --- | --- |
| 0 (10 Dec 2026) | `0xD45911fe9c72006D815C54FCBc60D7D21a8FebCd` |
| 1 (31 Dec 2026) | `0x2180E41eA2cd0e2c1adEC39d055A198c1bf84CdE` |
| 2 (25 Mar 2027) | `0xf80410ebcdA86aaF749aBF079d1D9B8DC0155707` |

### Series tokens

| Series | End date | P | Y |
| --- | --- | --- | --- |
| 0 | Thu 10 Dec 2026 | `0xd48fff2Cb7eD312FE9F806176786a82a06480a4c` | `0x1378aA37A64729AA6a082d0550E06f3C308619Bf` |
| 1 | Thu 31 Dec 2026 | `0x93269Ff6A2316F0DAf62030d7A175AD6E5b1d657` | `0x9e8A5E7BCAf3d9ca2C693f203F1EF42823e2FB2C` |
| 2 | Thu 25 Mar 2027 | `0x6CCb4e6e2a21b22dC2Ab62F2c579721b479F3265` | `0x4d11dbd2654feD34136bAD235ABa012c8DE821C1` |

## Demo deployment (DEMO ONLY)

A separate set of contracts for showing MUSDash on demand. Its price feed follows Mezo's BTC price unless the owner sets a demo price. **It is not connected to the main contracts above.**

| Contract | Address |
| --- | --- |
| DemoPriceFeed (DEMO ONLY) | `0x01297A4923330BC49EAA21777284b3e6440498E8` |
| JuuPricer (demo) | `0x009BcfeC38cF0F15215E87B44fF1DF53c868A0D1` |
| JuuBank (demo, v4) | `0x0A2acca04fD2fEbd2BB9e6eE30762b487A51F420` |
| MUSDash (demo, v3, 15-minute epochs) | `0x3DC2CfdF76fa127abf5486357e79082A9b2E37Cd` |
| JuuBuffer (demo, v2) | `0xaa07cCbd7DC5662321D0E2bc7D4CFa34a9eB62A0` |
| JuuJackpot (demo) | `0xD5109C77e5C5ce383c4aD716281882B00B0F7e6c` |
| JuuLoop (demo) | `0x6509684FF00DE88c0E233Ca16c2082b01Ce450a1` |
| AgentGateway (demo) | `0xb57abA53d416832974f3036A2c32Fe05f106DCAb` |

The first demo set (MUSDash `0x756e4aA5a229bEB93591785CaB6dEd40a121E376`, Bank `0x35D4D57507F33805a0b62b3852396a394088a390`, Buffer `0x955eB2cFCE5204a818e3E506F9060300Edbf479C`) ran the MUSD-only tests below.

## Retired contracts

| Contract | Address | Why |
| --- | --- | --- |
| MUSDash v1 (MUSD chips only) | `0xC5C8064985ee3FcF8529228038265CC87a049AC6` | Replaced by v2 with Y and P chips |
| MUSDash v2 (main) | `0xBc8d6C76BcabF0A4370828CEeb20ffF2F2d0b2Bf` | Replaced by v3 (Y rewards credited to positions, Climb Premium, jackpot tickets, Loop) |
| JuuBuffer v1 (main) | `0x264305bb088cA727433FF8dCe791840D0E75cff4` | Replaced by v2 (jackpot payouts) |
| Demo v2 set: MUSDash `0x96e7A84D8bC5Cd7bfe8742c399141B4596b5844b`, Buffer `0x523BbdFecf4B226d4BA4302234A69586A6069A93` | | Replaced by the demo v3 set |
| JuuBank v3 | `0x2F12021337cB016e8b03D922D0981A0D82B37E27` | Replaced by v4, which values Y and P it holds. Loan closed, funds moved. |

## Mezo contracts Juu calls

| Contract | Address |
| --- | --- |
| veBTC | `0x38E35d92E6Bfc6787272A62345856B13eA12130a` |
| Voter | `0x263F1Fd5fB7F866881e1B6cD7d5d6c40Fd985F0D` |
| RewardsDistributor | `0x9050218f89F0b5b17df4a30Ba4Fc97C72E307442` |
| BTC (ERC-20 view of native BTC) | `0x7b7C000000000000000000000000000000000000` |
| MUSD | `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503` |
| BorrowerOperations | `0xCdF7028ceAB81fA0C6971208e83fa7872994beE5` |
| TroveManager | `0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0` |
| PriceFeed | `0x86bCF0841622a5dAC14A313a15f96A95421b9366` |
| Router (DEX) | `0x9a1ff7FE3a0F69959A3fBa1F1e5ee18e1A9CD7E9` |
| sMUSD (MUSD Savings Rate) | `0x6f461c68B2c5492C0F5CCEc5a264d692aA7A8e16` |

## Transactions that show each part working

### Splitter

| What | Transaction |
| --- | --- |
| Zap 0.001 BTC into series 0 (creates series lock #1747) | `0xbdfe129d67757baff73a18af19dc7d4de51386ab84ec88f49ed2de03c55a0539` |
| Zap 0.001 BTC into series 1 (series lock #1748, permanent) | `0x295eb29b14a63a9a953c6f1b8e28b3c9379c8ede1afb5d3839269a61a5232ac8` |
| Start series 0 unlock (Mezo sets the lock to end 10 Dec 2026) | `0x2c69cf4e0deff3c56457fa72c86eba1a90fee72a0ff6d58e32164a11c032939d` |
| Vote series 0 lock for the sMUSD gauge | `0x0ed8eeb0a8748dec560bfc83b3a34dd2997194476aab167c0a5866a46d57f537` |
| Vote series 1 lock for the sMUSD gauge | `0xaa84856fd791199b39dec3f2f8e2587f77862942d17a8ab232d3f53b31bc5d41` |
| Deposit an existing veBTC lock (Door 1) and merge it into a series lock | `0x672a209d3918ab927d86b930eef16353e615fbf2b9e51f44483c3a43ef60e38d` (first Splitter version) |

The first non-zero reward collection is expected after Thursday 19 November 2026, when Mezo pays the first week of votes.

### Bank

| What | Transaction |
| --- | --- |
| Open the Bank's Mezo loan | `0x5e033333db7e68ae853ccbfd50764aca79fae9b44b5900d8508b233feceb5983` |
| Borrow more (rebalance) | `0x3430d67fccac479df2ee808a2d2caff2046135c8af3a6362cc6f57c78681c35c` |
| Repay (rebalance) | `0xb17f9dbfbb0ca49f5a1d62b1858bfff1cf17fcdd2f64ed4c788d45e4d8ab9420` |
| Withdraw 10% while the loan is open (paid in BTC) | `0xa9dfe181660a598fa46f58792e7f85c10a15153fdc46efc30d32faa8a455ee8d` |
| Last withdrawal closes the loan | `0x891bad45aa70c9f38bb78e2b7017583754a23e130e09a079da11b76450b448fe` |

That test ran with the target ratio temporarily at 160%, because the test wallet held too little BTC for a 300% loan. The ratio was set back to 300% afterwards: `0xa8f3f1858cc8c37d1d9033b5e5738c23959e8b79c2a5d0d3434117309ce6cd85`.

The Bank then opened its loan at 300% with 0.09 BTC: deposit `0x72853df93b12e03fa3cdd90103d58d7b7d1409da15193b6fea2ad0167c301639`, open `0x96d09de019acd0861370c4e1b95c75c68dee4b9fe60d525fedf143094e4a50d2`.

### MUSDash v1 (main, Mezo's real BTC price)

| What | Transaction |
| --- | --- |
| Open a Bull position, floor 1, 20 MUSD | `0x7a5896acf3ed6a610c586966e35acd48730c9a894756d444455faa7a9c2ea245` |
| Close it | `0x8a4df09b3d1cfe89dab62208d2c94af5cc6bf9fec6178c3fa4b1f9cdd7bc97db` |

### Bank v4 and MUSDash v2 (main, Mezo's real BTC price)

| What | Transaction |
| --- | --- |
| Close Bank v3's loan (last withdrawal) | `0x3cf988e1032828ad2e920ac3ef37aca3f78aa7a975f1fb04f6b21fe80a276476` |
| Deposit 0.09 BTC into Bank v4 | `0xa8e98f3c3bb6dc9837a8fe1ab5761f6180ac37592df07fec44d11897215bb7a2` |
| Bank v4 opens its loan at 300% | `0x773bc74401ad97132a81c03bd24600bd1da5a2686ede946906a4ba02706055e4` |
| Keeper reports testnet's weekly yield (3,568 MUSD per BTC) to the Pricer | `0x6c321b9e6324dfef312bc235f235310286f2aa0d3acefc5b604e15eb911ffbee` |
| Open Bull, floor 2, with 0.001 P (fee paid in P to the Bank) | `0xcea6b7e8252585cc87a799f77ecd7379f9f9d766ea7c777896eacc986c2d7c76` |
| Open Bear, floor 1, with 0.001 Y | `0x4216d7211b1a77314be19f8aab1f9414ca2cebb060fe832ef5c304d8eeb7e770` |
| Climb the P position to floor 3 | `0x12cf36c8ca9f7f5c555eba685e5287070039d64dfeeb5fcbcf57957c2930b8e6` |
| Close the P position | `0x1f05a3a072b70add4a73ff79193a6e91d53b3d0b1908bb2a6b01297a34b10a6e` |
| Close the Y position | `0x24fd9a6449dbf3ddde4e78f60888663ee8752436d309be7261c11151e4995769` |

The weekly yield figure is testnet's sMUSD gauge payout last week (22,047 MUSD) divided by the gauge's current vote weight (6.18). Testnet rewards are far higher than real ones.

After those trades the player held 0.0009937 P and 0.0009956 Y (the rest paid fees through the Bank), and the game contract held no tokens or MUSD.

### MUSDash v1 (first demo set, demo price)

| What | Transaction |
| --- | --- |
| Set demo price to 71,000 | `0x6a934cc5ee37a8455613b121c142f33507a497660a4e9beee40001dc02238f79` |
| Open #1 Bull, floor 2, 100 MUSD | `0x74fce9375c7bab09184f29cecb3e7008524d661b022601a77532a8ad800cbb6b` |
| Open #2 Bear, floor 3, 100 MUSD | `0x2ec32299e38ed8f524a66ee12faff182ea1fcbe839ee139b371163190ab3247c` |
| Open #3 Bull, floor 10, 30 MUSD | `0xf04b4e589ddc0e8ad05f05bb025781635ac8c3bcb3ccfd37e4642d024606ac05` |
| Climb #1 from floor 2 to floor 3 (Agaruzo event) | `0x9bc3d8884f06ad254dd752c4287fec76839aaaf1eaa2157ef5b5e8d1a541902c` |
| Set demo price to 64,610 (down 9%) | `0x55ef1edefc1cf887fa48e91d78bd8065ee8e2baeae6d26c1759293f5293fcdac` |
| Collapse #3 (FloorCollapsed event) | `0x34e5031e0c3352d087d65bf94e606a8aafdbfadaa44b3fc0a24a91d69f092d52` |
| Close #2, the Bear winner | `0xedabd6ae550ddb6ed43bba62afae148e80cc2461bd6e08a8f59afd7ae0a1b416` |
| Close #1, the Bull survivor, with its survivor reward | `0xffd1258cec2c708e9819c2474f318be2bca4c9e352c4a8ceb979747ca3ee3840` |
| Demo price back to following Mezo | `0x5236c811c72c396144a98c50cac7aee1ff51d917f1ae85307607e88fe7eb4588` |

What the demo shows, in MUSD: #3 was worth 3.00 at the collapse, under its 6.00 line (2% of 300). The 3.00 penalty went 1.50 to #1 (the only Bull survivor), 0.75 to the Buffer and 0.75 to the Bank; the Bank also took #3's 27.00 loss. #2 was paid 126.70 (worth 127.00, minus a 0.30 fee), with the 27.00 gain paid by the Bank. #1 was paid 74.05 (worth 72.85, plus 1.50 survivor reward, minus a 0.30 fee). Afterwards the game contract held 0 MUSD.

### P Market (main)

| What | Transaction |
| --- | --- |
| Buy P of series 2 at 0.9604 BTC per P (redeems for 1 BTC on 25 Mar 2027) | `0x5354cf147d6899c2e5d3571c0d61cdf7a1e11aa9ed95764589d92aa078998d66` |
| Sell P back into the series 1 pool | `0xacabaa8ac86134ea36bdac9eab4065c4828ed9ab26875e7fee4803baeee7bced` |

### sMUSD door (main)

| What | Transaction |
| --- | --- |
| Deposit 50 sMUSD into the 31 Dec 2026 series: 50 P-sMUSD and 50 Y-sMUSD minted | `0xd74e283de1f13ed8f8a3eb6ddeeb4aaf401f93ddfd4ac49930dc287c0257b1ca` |

### Juu Agents (demo)

| What | Transaction |
| --- | --- |
| User grants the test agent a session | `0x51855d7a685870bf37e2bc0f83610141887773311551e8d65201eb534c1ded4e` |
| Agent opens a 20 MUSD Bull bet (agent fee 0.05, split 0.025 / 0.025) | `0xe6e8cdd1e45aadedbb31770b2240a83d5900b126a765807a55b34d941edff632` |
| Agent climbs floor 2 to 4 | `0x3b6672d211e95bf497b377f22b931dbcd2dbc1a16cf5c18a6585aa42fb050407` |
| Agent closes; everything goes to the user | `0xabf2edb97c8f8eba9ed04ea1f7d0726e989012392a172e1aa2cb6d657174de52` |
| User revokes the agent | `0x2eb58b994d7e683b43b708c7bf8608769b1ddac60f3cf61f9406f6d855f26862` |
| Agent opens through the MCP server | `0x0a6becd99ffcc7f1f79ec504240a6ddcdfe5055bcf8ab606d7d6dc3ac6e4ab73` |
| Agent closes through the MCP server | `0x17ca6777f3a6a568571454e0cb3f7a41bb615a81a705307d6d72838aec1151c9` |

Refused as expected (simulated, no transaction): a 40 MUSD bet with a 30 MUSD limit (`BetTooBig`), floor 6 with a floor-5 limit (`FloorTooHigh`), any action after revoke (`NoSession`), any open after the daily loss limit (`StoppedForToday`).

### Loop (demo)

| What | Transaction |
| --- | --- |
| Turn the Loop on for series 2 | `0x22827c462ddddea9aa621659f2ccb2c5c39a7ad653013cc36fa7c59a5a46c352` |
| Close a winning bet: 1.96 MUSD swapped to 0.0000250 BTC and added to series 2 (new P and Y) | `0xc3cb26b10ca0e5341da479c3008fdf9835bb2337e579daa2e1d17e8457bc67f0` |

### Climb Premium (demo, 15-minute epochs)

| What | Transaction |
| --- | --- |
| Seat 1 on floor 7 pays 1.00 (floor empty, to the Bank) | `0x27cb9b457dd89b839b500942f774787f1c89722beb14b73fb3748023cfa7e44d` |
| Seat 2 on floor 7 pays 1.10, shared with the seat already there | `0x0cd12390fb52438e82b10aa12af258b43b3a02069129473945e7365be686b8e2` |
| Seat 3 on floor 7 pays 1.21, shared by size | `0xe8e64f132b28f182a5b65cead66524933457d241e265670fd59c14c160599ddc` |
| First seat closes: paid its 1.705 premium earnings | `0x55e63ba54f07b95061fe4f78a66f7fe9c312c6b85c61b370d22b0d0a31fc1e5c` |
| Next epoch: only one top seat | `0x5e31466fefda6c4a7193db632d886327faffcbbc37f31c9d98a4f2ee3e970ccc` |
| Keeper checks the kill switch: 1 seat vs 3 the epoch before, premium switched off for good (`KillSwitch` event) | `0xc26fc2a54e92cb8e5f0429c8bcf061e5cc567dee37fb6484d5708d3a8bdb3ad7` |

### Jackpot (demo, 15-minute epochs, run by the keeper)

| What | Transaction |
| --- | --- |
| Keeper commits for the epoch | `0xf624fc443e5016af3823a5b53308a8a3c5878f591db53e6ab1ff89ee6bf18e94` |
| Keeper seals the epoch's tickets after it ends | `0xe3e6a3899bf7757b87db8d3e0bf8135f800c33ea9fe3df0c5ca3370f090e6552` |
| Keeper reveals: ticket 59,383,996,936,443,951,029,287 of 121,770,000,000,000,000,000,000 wins; 0.431 MUSD paid from the Buffer's surplus | `0xeeb4b936f145a867063a600f3d45df48990da826c23e5b3286de434562a131a5` |

The epoch before had positions open at the draw, so the Buffer was below its 5% target and the draw was skipped (`0x82cd30164e09f88a0c9e007fc073faddfc7550d0d93befbb53bb31786e612b36`).

### Agents with the Climb Premium and the Loop

| What | Transaction |
| --- | --- |
| Main: agent opens a floor-7 seat; the gateway collects the 1.00 MUSD seat premium from the user | `0x1a150549e65b262b8893fa4f8e6c42ab3d9f68a8ab9800aee64d2e9ffeb83255` |
| Main: agent turns the user's Loop on (allowed by the session) | `0x9f30acb9b34abf0cb0c1c8e4a2b4ec4e8202a40bf398f06f81bc87a378803ec9` |
| Demo: agent's winning close; 1.96 MUSD goes through the user's Loop into 0.0000250 BTC of series 2 | `0x4b010a4768cd837d517db35c24e4dc9b994e3d5862da85305efb7db440a6a0e7` |
