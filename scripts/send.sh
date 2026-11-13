#!/usr/bin/env bash
# Send one transaction from the deployer in .env, padding Mezo's gas estimate by half.
# Usage: scripts/send.sh <to> "<function signature>" [args...] [--value <amount>]
# Prints only the transaction id and status. Never prints the key.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="$HOME/.foundry/bin:$PATH"
set -a
source "$ROOT/.env"
set +a
to="$1"
shift
if ! gas=$(cast estimate "$to" "$@" --from "$DEPLOYER" --rpc-url "$MEZO_RPC_URL" 2>&1); then
    echo "estimate failed: $(echo "$gas" | tail -c 300)"
    exit 1
fi
if ! out=$(cast send "$to" "$@" --gas-limit $((gas * 3 / 2)) --private-key "$PRIVATE_KEY" --rpc-url "$MEZO_RPC_URL" --json 2>&1); then
    echo "send failed: $(echo "$out" | tail -c 300)"
    exit 1
fi
echo "$out" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s);console.log("tx",r.transactionHash,"status",parseInt(r.status))})'
