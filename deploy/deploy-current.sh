#!/usr/bin/env bash
# Run as juu: reinstall and restart whatever commit is checked out now (used for a rollback after git checkout <commit>).
set -euo pipefail
if [ "$(id -un)" != "juu" ]; then echo "Run this as the juu user."; exit 1; fi
. "$(dirname "$0")/node-env.sh"
cd "$HOME/juu"
(cd backend && npm ci --omit=dev --no-audit --no-fund --loglevel=error)
pm2 startOrReload deploy/ecosystem.config.cjs --update-env && pm2 save --force >/dev/null && pm2 ls
