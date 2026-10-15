#!/bin/sh
# One-command local start: fetch KB -> build bundle -> serve on 127.0.0.1.
set -eu
cd "$(dirname "$0")/.."
command -v node >/dev/null 2>&1 || { echo "error: Node.js >= 18 required" >&2; exit 1; }
[ -d node_modules/js-yaml ] || npm install --no-audit --no-fund --silent
[ "${SKIP_FETCH:-0}" = "1" ] || sh scripts/fetch-kb.sh
node scripts/build-index.mjs
exec node scripts/serve.mjs
