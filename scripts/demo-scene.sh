#!/usr/bin/env bash
# Demo stack only (DEMO ONLY: the demo price feed is set by the owner). Stages the collapse scene for the demo video.
#
#   scripts/demo-scene.sh setup   pin the demo price at Mezo's current BTC price (whole dollars), then open
#                                 Bull floor 2 (30 MUSD), Bear floor 3 (30 MUSD) and Bull floor 10 (10 MUSD)
#   scripts/demo-scene.sh drop    move the demo price down 9% from the pinned price and collapse floor 10 at once
#                                 (the Bull on floor 2 is the only Bull survivor, so it collects the survivors' share)
#   scripts/demo-scene.sh reset   close the deployer's open demo positions, then run setup again (for a retake)
#   scripts/demo-scene.sh status  show the demo price and the open demo positions
#
# Sends from the deployer in .env through scripts/send.sh. Never prints a key.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="$HOME/.foundry/bin:$PATH"
RPC=$(grep -E '^MEZO_RPC_URL=' "$ROOT/.env" | cut -d= -f2-)
ME=$(grep -E '^DEPLOYER=' "$ROOT/.env" | cut -d= -f2-)
GAME=0x652C3Db601a194f4f7BD4294e7447f1fDbe99525   # MUSDash, demo stack
FEED=0x01297A4923330BC49EAA21777284b3e6440498E8   # DemoPriceFeed (DEMO ONLY)
MUSD=0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503
POS='getPosition(uint256)((address,uint8,uint8,uint8,uint64,uint64,uint256,uint256,uint256,uint256,int256,uint256,uint256,uint256))'

send() { "$ROOT/scripts/send.sh" "$@"; }
num() { cast call "$@" --rpc-url "$RPC" | cut -d' ' -f1; }
usd() { python3 -c "print(f'\${int($1)/1e18:,.2f}')"; }

# Deployer's open positions on the demo stack: "id side floor" per line.
mine() {
    local ids
    ids=$(cast call "$GAME" 'openPositionIds()(uint256[])' --rpc-url "$RPC" | tr -d '[] ' | tr ',' ' ')
    for id in $ids; do
        cast call "$GAME" "$POS" "$id" --rpc-url "$RPC" | tr -d '() ' | awk -F, -v id="$id" -v me="$ME" \
            'tolower($1) == tolower(me) { print id, ($2 == 0 ? "Bull" : "Bear"), $3 }'
    done
}

status() {
    echo "demo price $(usd "$(num "$FEED" 'fetchPrice()(uint256)')") (pinned: $( [ "$(num "$FEED" 'demoPrice()(uint256)')" = 0 ] && echo no, following Mezo || echo yes))"
    echo "deployer MUSD $(usd "$(num "$MUSD" 'balanceOf(address)(uint256)' "$ME")")"
    local m; m=$(mine)
    if [ -z "$m" ]; then echo "no open demo positions"; else echo "$m" | awk '{ print "  #" $1, $2, "floor", $3 }'; fi
}

setup() {
    if [ -n "$(mine)" ]; then echo "positions already open; use reset"; status; exit 1; fi
    echo "follow Mezo's price for a moment"; send "$FEED" 'setDemoPrice(uint256)' 0
    local p; p=$(python3 -c "print(int('$(num "$FEED" 'fetchPrice()(uint256)')') // 10**18 * 10**18)")
    echo "pin demo price at $(usd "$p")"
    send "$FEED" 'setDemoPrice(uint256)' "$p"
    echo "open Bull floor 2, 30 MUSD";  send "$GAME" 'open(uint8,uint8,uint256)' 0 2 30000000000000000000
    echo "open Bear floor 3, 30 MUSD";  send "$GAME" 'open(uint8,uint8,uint256)' 1 3 30000000000000000000
    echo "open Bull floor 10, 10 MUSD"; send "$GAME" 'open(uint8,uint8,uint256)' 0 10 10000000000000000000
    status
}

drop() {
    local pinned; pinned=$(num "$FEED" 'demoPrice()(uint256)')
    [ "$pinned" = 0 ] && pinned=$(num "$FEED" 'fetchPrice()(uint256)')
    local p; p=$(python3 -c "print(int('$pinned') * 91 // 100)")
    echo "demo price $(usd "$pinned") -> $(usd "$p") (down 9%)"
    send "$FEED" 'setDemoPrice(uint256)' "$p"
    # Collapse floor 10 now rather than waiting for the keeper (if the keeper got there first, that's fine too).
    mine | awk '$2 == "Bull" && $3 == 10 { print $1 }' | while read -r id; do
        echo "collapse #$id"; send "$GAME" 'liquidate(uint256)' "$id" || echo "  already collapsed (keeper)"
    done
    status
}

reset() {
    mine | while read -r id side floor; do echo "close #$id ($side floor $floor)"; send "$GAME" 'close(uint256)' "$id"; done
    setup
}

case "${1:-status}" in
    setup) setup ;;
    drop) drop ;;
    reset) reset ;;
    status) status ;;
    *) echo "usage: scripts/demo-scene.sh setup|drop|reset|status"; exit 1 ;;
esac
