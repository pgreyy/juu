# Juu contracts

Solidity 0.8.24, built with Foundry (`via_ir`, optimizer 200 runs). Deployed on Mezo testnet (chain id 31611).

## Setup

The libraries are not committed. Install them once:

```
forge install --no-git foundry-rs/forge-std
forge install --no-git OpenZeppelin/openzeppelin-contracts@v5.1.0
forge build
```

## Contracts

| File | Contract |
| --- | --- |
| `src/JuuSplitter.sol` | Splitter: veBTC series, P and Y, voting, payout (Doors 1 and 4) |
| `src/PYToken.sol` | P and Y tokens |
| `src/JuuPricer.sol` | Margin values of Y, P and troves |
| `src/JuuBank.sol` | Bank: savers' BTC, one Mezo trove, pays winners |
| `src/MUSDash.sol` | The game (v3): floors, chips, collapses, funding, Climb Premium, jackpot tickets, Loop hook |
| `src/JuuBuffer.sol` | Buffer: bad debt and jackpot payouts |
| `src/JuuJackpot.sol` | Commit and reveal jackpot draw |
| `src/JuuLoop.sol` | Loop: winnings to BTC into a series |
| `src/AgentGateway.sol` | Juu Agents: sessions, rules, agent fee |
| `src/JuuPMarket.sol` | P Market helper on Mezo's DEX |
| `src/JuuSavingsSplitter.sol` | sMUSD door (Door 2) |
| `src/JuuAccount.sol` | Juu account and factory (Door 3) |
| `src/demo/DemoPriceFeed.sol` | DEMO ONLY price feed for the separate demo deployment |

## Deploy

Scripts in `script/`. Mezo's veBTC uses osaka opcodes, so dry runs need `FOUNDRY_EVM_VERSION=osaka`:

```
set -a; source ../.env; set +a
STACK=main FOUNDRY_EVM_VERSION=osaka forge script script/DeployV3.s.sol --rpc-url $MEZO_RPC_URL --broadcast --slow --gas-estimate-multiplier 150
```

Mezo's BTC is a chain precompile, so BTC transfers can only be checked on the real chain, not in a local simulation.

Addresses and test transactions: `docs/gitbook/technical/contracts-and-addresses.md`.
