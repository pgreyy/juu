#!/usr/bin/env bash
# Send all testnet BTC from the funder wallets in .env (FUNDER1, FUNDER2) to the deployer, keeping enough for gas.
# Testnet only. Prints addresses, amounts and transaction ids, never keys.
# Usage: scripts/sweep-funders.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="$HOME/.foundry/bin:$PATH"
set -a
source "$ROOT/.env"
set +a

# Keep 0.00001 BTC for gas. cast sets a max fee above the current gas price and the wallet must cover
# 21,000 x that max fee, so a reserve of exactly the expected cost is too tight.
reserve=10000000000000

for n in 1 2; do
    key_var="FUNDER${n}_KEY"
    addr_var="FUNDER${n}_ADDR"
    key="${!key_var:-}"
    addr="${!addr_var:-}"
    if [ -z "$key" ] || [ -z "$addr" ]; then
        echo "funder $n: not in .env, skipped"
        continue
    fi
    bal=$(cast balance "$addr" --rpc-url "$MEZO_RPC_URL")
    send=$(node -e "const b=BigInt('$bal'), r=BigInt('$reserve'); console.log(b > r ? (b - r).toString() : '0')")
    if [ "$send" = "0" ]; then
        echo "funder $n $addr: balance $(cast from-wei "$bal") BTC, nothing to send"
        continue
    fi
    echo "funder $n $addr: sending $(cast from-wei "$send") BTC to deployer $DEPLOYER"
    if out=$(cast send "$DEPLOYER" --value "$send" --gas-limit 21000 --private-key "$key" --rpc-url "$MEZO_RPC_URL" --json 2>&1); then
        echo "$out" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s);console.log("  tx",r.transactionHash,"status",parseInt(r.status))})'
    else
        echo "  send failed: $(echo "$out" | head -c 300)"
    fi
done
echo "deployer balance: $(cast balance "$DEPLOYER" --rpc-url "$MEZO_RPC_URL" --ether) BTC"
