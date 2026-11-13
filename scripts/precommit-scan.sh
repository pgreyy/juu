#!/usr/bin/env bash
# Stops a commit if any staged file contains a private key from .env, an excluded path is staged, or a
# key-like assignment appears. Prints names only, never key values.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
bad=0
if git diff --cached --name-only | grep -E "(^|/)\.env$|^research/|broadcast/|/cache/|contracts/lib/|backend/data/|node_modules/"; then
    echo "excluded path staged"; bad=1
fi
node -e '
const fs=require("fs"), cp=require("child_process");
const keys=fs.readFileSync(".env","utf8").split("\n").map(l=>l.match(/^([A-Z0-9_]+_KEY)=0x([0-9a-fA-F]{64})$/)).filter(Boolean);
const files=cp.execSync("git diff --cached --name-only --diff-filter=ACMR").toString().trim().split("\n").filter(Boolean);
let hits=0;
for (const f of files) { const t=cp.execSync("git show :"+JSON.stringify(f)).toString().toLowerCase(); for (const [, name, v] of keys) if (t.includes(v.toLowerCase())) { console.log("KEY", name, "found in", f); hits++; } }
console.log("key scan:", keys.length, "keys,", files.length, "files,", hits, "hits"); process.exit(hits?1:0);' || bad=1
if git grep --cached -nIE "(PRIVATE|SECRET|MNEMONIC|SEED)[A-Z_]*\s*[=:]\s*['\"]?0x[0-9a-fA-F]{64}|BEGIN [A-Z ]*PRIVATE KEY" -- . ; then echo "key-like assignment staged"; bad=1; fi
[ $bad -eq 0 ] && echo "scan clean" || { echo "STOP: do not commit"; exit 1; }
