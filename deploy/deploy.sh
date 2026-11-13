#!/usr/bin/env bash
# Run as the juu user on the server: pulls the latest Juu from GitHub, installs the backend and restarts Juu's own
# pm2 processes (juu-backend, juu-mcp, juu-tunnel). It touches nothing outside /home/juu.
set -euo pipefail

if [ "$(id -un)" != "juu" ]; then echo "Run this as the juu user."; exit 1; fi
. "$(dirname "$0")/node-env.sh"
REPO="$HOME/juu"
cd "$REPO"

if [ ! -f .env ]; then echo "Missing $REPO/.env (copy .env.example and fill it in)."; exit 1; fi
if [ "$(stat -c %a .env)" != "600" ]; then chmod 600 .env; echo "Set .env to mode 600."; fi

before=$(git rev-parse --short HEAD)
git fetch --quiet origin
git pull --ff-only --quiet
after=$(git rev-parse --short HEAD)
echo "Code: $before -> $after"

(cd backend && npm ci --omit=dev --no-audit --no-fund --loglevel=error)

pm2 startOrReload deploy/ecosystem.config.cjs --update-env
pm2 save --force >/dev/null

echo "Waiting for the services..."
for i in $(seq 1 20); do
  if curl -fsS -m 3 http://127.0.0.1:8788/health >/dev/null 2>&1 && curl -fsS -m 3 http://127.0.0.1:8789/mcp/health >/dev/null 2>&1; then
    echo "Data API: $(curl -fsS -m 3 http://127.0.0.1:8788/health | head -c 200)"
    echo "MCP:      $(curl -fsS -m 3 http://127.0.0.1:8789/mcp/health)"
    pm2 ls
    echo "Deployed $after. To roll back: git -C $REPO checkout $before && $REPO/deploy/deploy-current.sh"
    exit 0
  fi
  sleep 3
done
echo "Services did not answer within a minute. Check: pm2 logs juu-backend --lines 50 ; pm2 logs juu-mcp --lines 50"
exit 1
