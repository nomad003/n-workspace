#!/bin/sh
# Copy the canonical schemas and checkers from a local n-life-data checkout.
# These files are vendored under examples/ and must be re-synced, not edited here.
set -eu
ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
LIFE="${LIFE_ROOT:-$ROOT/life}"
if [ ! -d "$LIFE/schemas" ] || [ ! -f "$LIFE/tools/validate.py" ] || [ ! -f "$LIFE/tools/check_links.py" ]; then
  echo "LIFE_ROOT ($LIFE) is missing schemas/ or tools/validate.py or tools/check_links.py" >&2
  exit 1
fi
mkdir -p "$ROOT/examples/schemas" "$ROOT/examples/tools"
cp "$LIFE/schemas/"*.schema.json "$ROOT/examples/schemas/"
cp "$LIFE/tools/validate.py" "$LIFE/tools/check_links.py" "$ROOT/examples/tools/"
echo "synced schemas and tools from $LIFE"
