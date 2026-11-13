# Splitter in detail

Contract: `JuuSplitter`. P and Y tokens: `PYToken` (one P and one Y per series, created by the Splitter).

## Series state

| Field | Meaning |
| --- | --- |
| `end` | Series end date, a Thursday 00:00 UTC |
| `lockEnd` | Actual end of the veBTC lock, set when unlocking starts |
| `phase` | 1 Open, 2 Unlocking, 3 Matured |
| `masterId` | The series' veBTC lock (NFT id), 0 until the first deposit |
| `principal` | BTC owed to P holders, equal to P minted |
| `pRate` | BTC paid per P after maturity (1e18 = 1 BTC) |

## Functions

| Function | Who | What it does |
| --- | --- | --- |
| `zap(id, to)` payable | anyone | Door 4. Creates the series lock (permanent) or adds to it; mints P and Y to `to`. |
| `deposit(id, tokenId)` | anyone | Door 1. Takes your veBTC lock (approve the Splitter first), clears its vote, then makes it the series lock or merges it in. Mints P and Y. |
| `startUnlock(id)` | anyone | From `end - 30 days`: clears the vote and calls Mezo's `unlockPermanent`. Mezo sets the lock end to the next Thursday at most 30 days away. |
| `mature(id)` | anyone | From `lockEnd` (and 1 hour after, for Mezo's vote window): collects last rewards, clears the vote, withdraws the BTC. Sets `pRate`. Surplus BTC goes to Y. |
| `redeemP(id, amount)` | P holder | After maturity, burns P and pays BTC. |
| `harvest(id)` | anyone | Claims voting fees and bribes from each reward source and the RewardsDistributor, and books what arrived to Y holders. |
| `claimY(id)` | Y holder | Pays all reward tokens your Y has earned. |
| `vote(id, pools, weights)` | keeper | Votes the series lock at Mezo's Voter. |
| `poke(id)` | anyone | Refreshes the series lock's vote weight at Mezo. |

## Timing rules from Mezo

* veBTC locks end on Thursdays 00:00 UTC, and the longest lock is 30 days.
* A lock can vote once per week. A vote can be cleared (`reset`) only after a new week has started, from one hour after the week opens.
* A permanent lock can be unlocked only when it has no active vote. That's why the keeper starts the unlock **before** it votes in the unlock week.
* `unlockPermanent` sets the end to `floor((now + 30 days) / 1 week) x 1 week`. Called in the week starting 30 days before the series end, that is exactly the series end.

If the unlock is started late, the lock ends on a later Thursday and P is paid later. The keeper calls it in the first hours of the unlock week to avoid that.

## How Y rewards are booked

Each reward token has a running total per Y (`accPerY`). When rewards arrive, `accPerY += amount / Y supply`. Each holder's share is settled on every Y transfer, mint or claim, so rewards stay with whoever held the Y when they were earned.

Reward tokens: BTC, MUSD and MEZO. Reward sources: the fee and bribe contracts of the sMUSD gauge and the MUSD/BTC gauge.

## The BTC rebase

While a lock runs, Mezo's RewardsDistributor adds its weekly BTC rebase into the lock. That BTC is counted at maturity: whatever comes out above the principal goes to Y holders. A rebase claimed after the lock has ended is paid out directly and also goes to Y.

## Verified against Mezo

The live testnet veBTC is newer than the source in Mezo's public repository; it reads voting power with `votingPowerOfNFT`. Every other function the Splitter calls matches the explorer's verified interface for the live veBTC, Voter and RewardsDistributor.
