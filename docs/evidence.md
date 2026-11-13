# Evidence

Every flow below ran on **Mezo testnet** (chain 31611). Each link opens the transaction on
[explorer.test.mezo.org](https://explorer.test.mezo.org); every one has status 1 unless the row says otherwise.
"App" means it was driven through app.playjuu.xyz in a browser; "direct" means a contract call from a script or the
keeper. The history behind each row is in [build-log.md](build-log.md). Current and retired addresses are in
[gitbook/technical/contracts-and-addresses.md](gitbook/technical/contracts-and-addresses.md).

Some rows ran on contract versions that are now retired (marked **retired set**). The code paths they show are
unchanged in the current versions unless the row says so.

## Doors and Splitter

| Feature | What happened | Explorer |
| --- | --- | --- |
| BTC Door (direct) | 0.001 BTC zapped into series 0; creates series lock #1747 | [tx](https://explorer.test.mezo.org/tx/0xbdfe129d67757baff73a18af19dc7d4de51386ab84ec88f49ed2de03c55a0539) |
| BTC Door (direct) | 0.001 BTC zapped into series 1; series lock #1748, permanent | [tx](https://explorer.test.mezo.org/tx/0x295eb29b14a63a9a953c6f1b8e28b3c9379c8ede1afb5d3839269a61a5232ac8) |
| BTC Door (app) | 0.003 BTC zapped into series 1 | [tx](https://explorer.test.mezo.org/tx/0x1a8f6f5bc32f2acf09a8ff77f05ae31f7301fc750f4281854ca39440b30ed836) |
| veBTC Door (app) | an existing 0.002 BTC veBTC lock deposited into series 1 | [tx](https://explorer.test.mezo.org/tx/0xcd4bc3978bd1dce641246c1dc2d2ec3df0b850dc2732a5df042f6b7a287f2644) |
| sMUSD Door (app) | 50 sMUSD deposited into sMUSD series 0 | [tx](https://explorer.test.mezo.org/tx/0xeed0f64f12164fb6c1a7df33ac02a88cd7ebc5dfae6ccb5852c90a4dc6dcab64) |
| sMUSD Door (direct) | 50 sMUSD into the 31 Dec 2026 series: 50 P-sMUSD and 50 Y-sMUSD minted | [tx](https://explorer.test.mezo.org/tx/0xd74e283de1f13ed8f8a3eb6ddeeb4aaf401f93ddfd4ac49930dc287c0257b1ca) |
| Series unlock (direct) | startUnlock on series 0; Mezo set lock #1747 to end Thu 10 Dec 2026 00:00 UTC | [tx](https://explorer.test.mezo.org/tx/0x2c69cf4e0deff3c56457fa72c86eba1a90fee72a0ff6d58e32164a11c032939d) |
| Gauge votes (direct) | series 0 and series 1 locks vote for the sMUSD gauge | [series 0](https://explorer.test.mezo.org/tx/0x0ed8eeb0a8748dec560bfc83b3a34dd2997194476aab167c0a5866a46d57f537), [series 1](https://explorer.test.mezo.org/tx/0xaa84856fd791199b39dec3f2f8e2587f77862942d17a8ab232d3f53b31bc5d41) |
| Keeper on the server | first server keeper transaction: a veBTC harvest of series 0 | [tx](https://explorer.test.mezo.org/tx/0xf2749c0e28627e5e152e2847a26f3c6dc50866aa1645eab5385f10c5de9f0d3e) |

## Bank

| Feature | What happened | Explorer |
| --- | --- | --- |
| Loan opens (retired set, Bank v3) | the Bank opened its own Mezo trove | [tx](https://explorer.test.mezo.org/tx/0x5e033333db7e68ae853ccbfd50764aca79fae9b44b5900d8508b233feceb5983) |
| Borrow and repay (retired set, Bank v3) | rebalance borrowed more, then repaid | [borrow](https://explorer.test.mezo.org/tx/0x3430d67fccac479df2ee808a2d2caff2046135c8af3a6362cc6f57c78681c35c), [repay](https://explorer.test.mezo.org/tx/0xb17f9dbfbb0ca49f5a1d62b1858bfff1cf17fcdd2f64ed4c788d45e4d8ab9420) |
| Withdraw while the loan is open (retired set, Bank v3) | a saver withdrew 10% and was paid in BTC | [tx](https://explorer.test.mezo.org/tx/0xa9dfe181660a598fa46f58792e7f85c10a15153fdc46efc30d32faa8a455ee8d) |
| Last withdrawal closes the loan (retired set, Bank v3) | the trove closed and the last saver got the BTC | [tx](https://explorer.test.mezo.org/tx/0x891bad45aa70c9f38bb78e2b7017583754a23e130e09a079da11b76450b448fe) |
| Current Bank (v5) opens at 300% | 0.09 BTC, trove at 300.2% | [tx](https://explorer.test.mezo.org/tx/0x622ea8f69b4d079d219f98cd232d3fba22f8b9d716a7c4930c8b7d53a67a37a9) |
| Cash reserve top-up (v5) | borrows 943.98 MUSD, stops at 300%, records the shortfall | [tx](https://explorer.test.mezo.org/tx/0x9b481d20d5d9a21143eecfa0ea056ade7dbe214389e74b308bb330c9b0719c03) |
| Refinance (v5) | borrowing past the opening cap; Mezo's RefinancingFeePaid, cap 5,764 to 8,341 MUSD | [tx](https://explorer.test.mezo.org/tx/0xdac713db550bc7440fd97a3d68964e9c3da07e5643d556b559af3396d17c67ec) |
| Settings restored (v5) | back to 300% and a 20% reserve; repaid down, never below the reserve | [tx](https://explorer.test.mezo.org/tx/0xac6c11e4267be89639f94aff0003a55cbaa8121437a0c29e17e38e10654365c1) |
| Bank cash check (demo) | with no MUSD a bet was refused (BankCannotCoverWin, simulated); after 150 MUSD was added it opened | [tx](https://explorer.test.mezo.org/tx/0x794e261f45c6e1e097cffd3fa138b0c1ee073b50112644b0a2ceba547f484b2b) |
| Bank deposit and withdraw (app, demo) | 0.002 BTC in, 0.0019 BTC out | [deposit](https://explorer.test.mezo.org/tx/0x0d54b95065398ccda41e318f10b1ca1695a94077632148f8488d7e83b1feadc1), [withdraw](https://explorer.test.mezo.org/tx/0xddc83fc90db36e2b632063b13715033818c7dd1aacd202d638d3a78f2f4e2760) |

## Trove Door (Juu account)

All of these are direct contract calls by the account's owner (the deployer) or the keeper. The first account was made
by the retired v3 factory `0xECEf…d084`; the guard test account `0x4eef…4a06` was made by the current factory
`0x6Fe8…76e4` (checked on chain: `accountOf(deployer)` on each factory).

| Feature | What happened | Explorer |
| --- | --- | --- |
| Open a trove and borrow (retired v3 factory) | 0.0405 BTC collateral, 1,800 MUSD borrowed, ICR 143.3% | [tx](https://explorer.test.mezo.org/tx/0x21a9fd65810d4d1518be967df061bda74d38bc4aa7516bbc406d998d7c6f6337) |
| Withdraw MUSD to the owner | 1,700 MUSD out of the account | [tx](https://explorer.test.mezo.org/tx/0x19c95dec40886cf7e14a6d2fb573d59d7b7051ca0c793a9262d1d4531b46d611) |
| Play with MUSD borrowed from the trove | a 120 MUSD bet; the shortfall was borrowed from the trove | [tx](https://explorer.test.mezo.org/tx/0x6060203fc349ee755ca6ead7ee210bfe77bef805e73fb33294e7cec9150ee77c) |
| Settle a bet | the returned chips repaid the debt down to Mezo's 2,000 MUSD minimum | [tx](https://explorer.test.mezo.org/tx/0x34277d2842a7491d1bbc1cd08d95b0d113936699574aa4426ac68be337801294) |
| Profit becomes collateral | a winning close: 0.177 MUSD profit swapped to 0.00000226 BTC and added as trove collateral | [tx](https://explorer.test.mezo.org/tx/0xd91df3100e8567170124aedd171430856d8c0c147791ff2ccdcc2e465fdd986c) |
| Close the trove (retired v3 factory) | all BTC back to the owner | [tx](https://explorer.test.mezo.org/tx/0xd2838f2beb4eca4cf6a6963b3afed2643b35d01eec4630d5c49356da63f5f659) |
| Open a trove (current factory) | new account, trove opened | [tx](https://explorer.test.mezo.org/tx/0xf8cd33356868ae56a8fd70386c946a6bc3c8561326ceaf12fdbf63223867d6db) |
| Two bets from the trove (current factory) | two 50 MUSD bets | [bet 1](https://explorer.test.mezo.org/tx/0xe1758c80b1f2dfc8de16de4675367db7360cbcf013cecfe3f6f80e387b70137a), [bet 2](https://explorer.test.mezo.org/tx/0x7b6e9a676e4568e5f5040d33b176e03b4bb554316de112ff048d7fc543b047f9) |
| Guard (current factory) | guard set to 150% on a 143% trove; the keeper's `guard(1)` closed one bet per call | [close 1](https://explorer.test.mezo.org/tx/0xef6b712f9ac4aab24daa89d8c26e1622a18c8e464f95530878752baf08eebe45), [close 2](https://explorer.test.mezo.org/tx/0x5c4d77ba2bee1346166cfd0cab4d239a615e992e079dab4656b2d60d7a8a983c) |
| Close the trove (current factory) | all BTC back to the owner | [tx](https://explorer.test.mezo.org/tx/0x7930fbf60b63e1a93332b1a264d5dca333fb92848a23fc6ae00de8095ec3fcc1) |

Not run yet: the app's Trove Door page with a real wallet (Mezo's smallest loan needs about 0.032 BTC of collateral and
the test wallet held 0.0146 BTC), and the owner's manual `addCollateral`, `borrow`, `repay` and `withdrawCollateral`
calls (collateral was only added by the profit path above).

## MUSDash

| Feature | What happened | Explorer |
| --- | --- | --- |
| MUSD round (app, demo) | open 15 MUSD on floor 2, climb to floor 3 (Agaruzo!), cash out | [open](https://explorer.test.mezo.org/tx/0x56ce94b42c63c35afb615749320e698325ff94a1b4c60b61589974d6fa756aa5), [climb](https://explorer.test.mezo.org/tx/0x5fcb7a2e23ea9d303552d1cf3eb7ee8311c770332dc9a43fcc9c3f55f56e339e), [cash out](https://explorer.test.mezo.org/tx/0xe13c91b3f487863248bac1b85f1180eef9c23505a4f0e80fe3272dd0f034197a) |
| Yield chips (app, demo) | open Bull floor 2 with 0.0015 Y, cash out 0.00149337 Y | [open](https://explorer.test.mezo.org/tx/0xe985c2b1fa5f98dd2188d4ac8260812d11fbe96551a615107ff58e0a72c1ba64), [cash out](https://explorer.test.mezo.org/tx/0xfee64f5049cb7242e333720ac4757d4d70ad0c32364a8daafe5aeb5712922b20) |
| Principal chips (app, demo) | open with 0.0003 P, cash out 0.00029878 P | [open](https://explorer.test.mezo.org/tx/0xe7f3195eb86931bdb648d301e478b39e555f6186ddc73978d9cb816ea59f6dea), [cash out](https://explorer.test.mezo.org/tx/0x4accba4292c963a047bed157c2ecd4525c3f78ce9d204af5bf541f37148ef38b) |
| Real BTC price (retired set, main v1) | open Bull floor 1, 20 MUSD, then close at Mezo's price | [open](https://explorer.test.mezo.org/tx/0x7a5896acf3ed6a610c586966e35acd48730c9a894756d444455faa7a9c2ea245), [close](https://explorer.test.mezo.org/tx/0x8a4df09b3d1cfe89dab62208d2c94af5cc6bf9fec6178c3fa4b1f9cdd7bc97db) |
| Collapse (retired set, demo v1) | demo price down 9%; floor 10 Bull collapsed (FloorCollapsed); the floor 2 Bull survivor was paid 1.50 MUSD of its penalty on close | [price](https://explorer.test.mezo.org/tx/0x55ef1edefc1cf887fa48e91d78bd8065ee8e2baeae6d26c1759293f5293fcdac), [collapse](https://explorer.test.mezo.org/tx/0x34e5031e0c3352d087d65bf94e606a8aafdbfadaa44b3fc0a24a91d69f092d52), [survivor close](https://explorer.test.mezo.org/tx/0xffd1258cec2c708e9819c2474f318be2bca4c9e352c4a8ceb979747ca3ee3840) |
| Survivors by size x time (retired set, demo v1) | three Bull survivors shared 0.9868 MUSD exactly by size x seconds held | [collapse](https://explorer.test.mezo.org/tx/0xad1de53ac6c2b8e0b5dc4fa2c5728f2a04dc9ba92c1e999984d9251879b2e941) |
| Funding over three hours (retired set, demo v1) | each position's funding matched `k x (bull - bear) / (bull + bear)` per hour within 0.04% to 0.35% | closes: [A](https://explorer.test.mezo.org/tx/0x8342c3396b005f7adb1fa471e32d72a6252f35dbe535d674603e6ac050f924cf), [B](https://explorer.test.mezo.org/tx/0xa098ca9eecb1e305c0d245fb71ed6f43f732a8ad281230d2d7ce5d713dbf3c48), [D](https://explorer.test.mezo.org/tx/0x8ca06004f454e434bbbf941f302a2711662f10a4f887cdd76cf657c40ad2580c), [C](https://explorer.test.mezo.org/tx/0xe1c925dbdcf5a5fc47ea243022f1e53f455a7e4f4f766e5807aa0bd4eaef4f81) |
| Bad debt (retired set, demo v1) | a 10x bet hit by an 11% drop was worth -1.000053 MUSD; the Buffer paid exactly that to the Bank | [tx](https://explorer.test.mezo.org/tx/0xe31c29aa3291bbeb025b43ac13ae3eeb995d2f18bb7bc5e21071b8ebdee5bf48) |
| Climb Premium (retired set, demo v3) | seats on floor 7 paid 1.00, 1.10, 1.21; the first seat was paid its 1.705 earnings on close | [1](https://explorer.test.mezo.org/tx/0x27cb9b457dd89b839b500942f774787f1c89722beb14b73fb3748023cfa7e44d), [2](https://explorer.test.mezo.org/tx/0x0cd12390fb52438e82b10aa12af258b43b3a02069129473945e7365be686b8e2), [3](https://explorer.test.mezo.org/tx/0xe8e64f132b28f182a5b65cead66524933457d241e265670fd59c14c160599ddc), [paid](https://explorer.test.mezo.org/tx/0x55e63ba54f07b95061fe4f78a66f7fe9c312c6b85c61b370d22b0d0a31fc1e5c) |
| Kill switch (retired set, demo v3) | 1 top seat vs 3 the epoch before: premium off for good (KillSwitch event) | [tx](https://explorer.test.mezo.org/tx/0xc26fc2a54e92cb8e5f0429c8bcf061e5cc567dee37fb6484d5708d3a8bdb3ad7) |
| Loop (retired set, demo v3) | Loop on; a winning close turned 1.96 MUSD into 0.0000250 BTC of series 2 (new P and Y) | [on](https://explorer.test.mezo.org/tx/0x22827c462ddddea9aa621659f2ccb2c5c39a7ad653013cc36fa7c59a5a46c352), [close](https://explorer.test.mezo.org/tx/0xc3cb26b10ca0e5341da479c3008fdf9835bb2337e579daa2e1d17e8457bc67f0) |

## Jackpot

| Feature | What happened | Explorer |
| --- | --- | --- |
| Commit, seal, reveal (retired set, demo v3, 15 minute epochs) | the keeper committed, sealed the tickets, revealed; 0.431 MUSD paid from the Buffer's surplus | [commit](https://explorer.test.mezo.org/tx/0xf624fc443e5016af3823a5b53308a8a3c5878f591db53e6ab1ff89ee6bf18e94), [seal](https://explorer.test.mezo.org/tx/0xe3e6a3899bf7757b87db8d3e0bf8135f800c33ea9fe3df0c5ca3370f090e6552), [reveal](https://explorer.test.mezo.org/tx/0xeeb4b936f145a867063a600f3d45df48990da826c23e5b3286de434562a131a5) |
| No surplus, no draw | the epoch before, the Buffer was under its target, so the draw was skipped | [tx](https://explorer.test.mezo.org/tx/0x82cd30164e09f88a0c9e007fc073faddfc7550d0d93befbb53bb31786e612b36) |

## Principal Market and Swap

| Feature | What happened | Explorer |
| --- | --- | --- |
| Buy Principal below full price (direct) | 0.00001 BTC bought 0.0000104 P of series 2: 0.9604 BTC per P | [tx](https://explorer.test.mezo.org/tx/0x5354cf147d6899c2e5d3571c0d61cdf7a1e11aa9ed95764589d92aa078998d66) |
| Buy and sell (app) | buy 0.000005 BTC of series 1 P, sell 0.000005 P | [buy](https://explorer.test.mezo.org/tx/0x240863e0757a6fc5a736f9c80e968b7f737a60d4cb40b246b8ba5962f2e3f8a3), [sell](https://explorer.test.mezo.org/tx/0xdcb75e24086bd64f5c81cfef097be6eaf6b6938f5d6857aa6a82b50444636791) |
| Buy after the liquidity top-up (app) | 0.00005 BTC on series 1 at 0.81% price impact | [tx](https://explorer.test.mezo.org/tx/0x8037bfc3da38cfcf1c0079a66b767e7cbeafe4b71caa7feba7efb66bafba1844) |
| Swap through Mezo's Router (app) | 0.0001 BTC to 7.8259 MUSD; 5 MUSD to 0.0000638 BTC | [BTC to MUSD](https://explorer.test.mezo.org/tx/0xd3bd63e39edf43bdf4fe4216f66a321e818eb57aa201f1a93a9f5daa950554c9), [MUSD to BTC](https://explorer.test.mezo.org/tx/0x81083bfb5962801c5521fe2f212bb3e04d597a31b78621e3fae493a201fcb37a) |
| JuuSwap 0.1% fee (app) | fee turned into MUSD, half to the safety jar, half to the Bank | [BTC to MUSD](https://explorer.test.mezo.org/tx/0x008529dd96cd2a74955258c9fd763df928d438843529a29a7f9427dc62fc477f), [MUSD to BTC](https://explorer.test.mezo.org/tx/0x57c4b5f946df571f5b4c52371d9ea8c67355b508900c6e2c415dcc2a206c0268) |

## Agents and MCP

| Feature | What happened | Explorer |
| --- | --- | --- |
| Session and play (retired set, demo v3) | grant, open 20 MUSD (agent fee 0.05), climb floor 2 to 4, close (all to the user), revoke | [grant](https://explorer.test.mezo.org/tx/0x51855d7a685870bf37e2bc0f83610141887773311551e8d65201eb534c1ded4e), [open](https://explorer.test.mezo.org/tx/0xe6e8cdd1e45aadedbb31770b2240a83d5900b126a765807a55b34d941edff632), [climb](https://explorer.test.mezo.org/tx/0x3b6672d211e95bf497b377f22b931dbcd2dbc1a16cf5c18a6585aa42fb050407), [close](https://explorer.test.mezo.org/tx/0xabf2edb97c8f8eba9ed04ea1f7d0726e989012392a172e1aa2cb6d657174de52), [revoke](https://explorer.test.mezo.org/tx/0x2eb58b994d7e683b43b708c7bf8608769b1ddac60f3cf61f9406f6d855f26862) |
| Permission in the app (demo) | rules (max 20, floor 4, loss stop 50, 7 days), then the agent played 15 MUSD | [grant](https://explorer.test.mezo.org/tx/0x7d45fed0ca21d4d67b4f2373a2cc97f355d803bb550edef37fd247ed3aadcb5b), [open](https://explorer.test.mezo.org/tx/0xfc356b25f9a28070ad13fa1c6da875e2bd1720baac4de8550d9cfab650206863), [close](https://explorer.test.mezo.org/tx/0x07ba93f9e9a2abd8b7f8686eee9f3b8710cb67951294d0e3ea09499807a24510) |
| Agent key made in the browser (demo) | the new agent's permission | [tx](https://explorer.test.mezo.org/tx/0xcdf38ff2290d039386113dd26d8cf2c74038f94a5d1fffdaa8a6c2ef03b4d44f) |
| Hosted MCP server (demo) | the agent's own key as bearer token: open, climb, close | [open](https://explorer.test.mezo.org/tx/0x6ce83f1bf752053c446f6c17b446dab433ad5741e1edd45330ece92f9af292c6), [climb](https://explorer.test.mezo.org/tx/0xbe326913360d4679725d0ebcadbd9c335a17bc8b91e9f2d94c489aef57ff96a9), [close](https://explorer.test.mezo.org/tx/0xd753682da814d2a8822e18889331b0f75b246aeeb430985809abc788d82ad662) |
| MCP finds the owner (demo) | open and close without passing `user` | [open](https://explorer.test.mezo.org/tx/0x9f1f25c83e327407042cf1ad6eaf4c80913742f715ca969132fdfcf43df046b5), [close](https://explorer.test.mezo.org/tx/0x800f906abae361aee8db849485a35a92926a96512a7ff26150b403aa37f611b8) |
| Agent and the Climb Premium (retired set, main v3) | a floor 7 seat; the gateway collected the 1.00 MUSD premium from the user | [tx](https://explorer.test.mezo.org/tx/0x1a150549e65b262b8893fa4f8e6c42ab3d9f68a8ab9800aee64d2e9ffeb83255) |
| Agent and the Loop (retired set, demo v3) | a winning agent close went through the user's Loop into series 2 | [tx](https://explorer.test.mezo.org/tx/0x4b010a4768cd837d517db35c24e4dc9b994e3d5862da85305efb7db440a6a0e7) |
| Remove an agent (demo) | revoke, then a signed hide (no transaction) | [revoke](https://explorer.test.mezo.org/tx/0xd3143cbf5ce7e9dfcf0e9746574d9fcc35c6426125a546dfdd6f195bdaffdbdb) |

Refused as expected (simulated, so there is no transaction): a 40 MUSD bet with a 30 MUSD limit (`BetTooBig`), floor 6
with a floor 5 limit (`FloorTooHigh`), any action after revoke (`NoSession`), and an open after the daily realised loss
stop was reached (`StoppedForToday`).

## Not tested yet

* Series maturity and Principal redemption: the first series ends Thu 10 Dec 2026, so `mature` and `redeemP` have not run.
* Yield rewards credited to Yield chips: the series locks earn their first rewards only after Mezo's week ends.
* The weekly jackpot on the main stack (it ran on the demo stack's 15 minute epochs).
* The app's Trove Door page with a real wallet, and the manual trove calls listed above.
