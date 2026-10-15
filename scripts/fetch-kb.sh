#!/usr/bin/env bash
# Build-time fetch of the private KB. Token comes ONLY from env (KB_TOKEN / CI secret).
set -euo pipefail
: "${KB_TOKEN:?KB_TOKEN not set}"
REPO="${KB_REPO:-nomad003/n-knowledge-base}"
DEST="${KB_DEST:-kb}"
rm -rf "$DEST"
git clone --depth 1 -q "https://x-access-token:${KB_TOKEN}@github.com/${REPO}.git" "$DEST"
rm -rf "$DEST/.git"
echo "KB fetched into $DEST (gitignored)"
