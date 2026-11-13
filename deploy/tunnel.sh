#!/usr/bin/env bash
# Started by pm2 as juu (process "juu-tunnel"): runs Juu's own Cloudflare tunnel, which carries https://api.playjuu.xyz
# to the Data API on 127.0.0.1:8788. Outgoing connections only, so no port is opened on the server.
# The token is read from .env (TUNNEL_TOKEN) and passed in the environment, so it never shows in a command line.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TUNNEL_TOKEN="$(grep -m1 '^TUNNEL_TOKEN=' "$ROOT/.env" | cut -d= -f2-)"
if [ -z "$TUNNEL_TOKEN" ]; then echo "TUNNEL_TOKEN is empty in $ROOT/.env"; exit 1; fi
export TUNNEL_TOKEN
# Metrics (and the /ready check) on localhost only.
exec "$HOME/.local/bin/cloudflared" tunnel --no-autoupdate --metrics 127.0.0.1:20250 run
