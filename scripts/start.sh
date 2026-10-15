#!/bin/sh
# One-command local start: fetch KB + life roots -> build bundle -> serve on 127.0.0.1.
set -eu
cd "$(dirname "$0")/.."
export KB_REF="${KB_REF:-main}" LIFE_REF="${LIFE_REF:-main}"
command -v node >/dev/null 2>&1 || { echo "error: Node.js >= 18 required" >&2; exit 1; }
[ -d node_modules/js-yaml ] || npm install --no-audit --no-fund --silent
if [ "${SKIP_FETCH:-0}" != "1" ]; then
  sh scripts/fetch-root.sh kb
  # life root is optional: missing repo/branch only warns (build falls back to KB data/).
  sh scripts/fetch-root.sh life || echo "warn: continuing without life root" >&2
fi
node scripts/build-index.mjs
exec node scripts/serve.mjs
