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
# Submit, then wait for the receipt with retries: Mezo's RPC sometimes fails a receipt lookup.
if ! hash=$(cast send "$to" "$@" --gas-limit $((gas * 3 / 2)) --private-key "$PRIVATE_KEY" --rpc-url "$MEZO_RPC_URL" --async 2>&1); then
    echo "send failed: $(echo "$hash" | tail -c 300)"
    exit 1
fi
hash=$(echo "$hash" | grep -oE '0x[0-9a-fA-F]{64}' | tail -1)
for _ in $(seq 1 40); do
    if status=$(cast receipt "$hash" status --rpc-url "$MEZO_RPC_URL" 2>/dev/null) && [ -n "$status" ]; then
        if echo "$status" | grep -qiE '^1|success|true'; then echo "tx $hash status 1"; else echo "tx $hash status 0 ($status)"; exit 1; fi
        exit 0
    fi
    sleep 3
done
echo "tx $hash sent, receipt not found yet"
exit 1
