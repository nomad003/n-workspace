#!/bin/sh
# Fetch the private KB into ./kb (gitignored). Token: $KB_TOKEN, else `gh auth token`. Never written to disk.
set -eu
REPO="${KB_REPO:-nomad003/n-knowledge-base}"
DEST="${KB_DEST_ROOT:-kb}"
REF="${KB_REF:-main}"
if [ -n "${KB_LOCAL:-}" ]; then  # use an existing local clone/folder instead of fetching
  rm -rf "$DEST"; mkdir -p "$DEST"; cp -R "$KB_LOCAL"/. "$DEST"/; rm -rf "$DEST/.git"; echo "KB copied from $KB_LOCAL"; exit 0
fi
TOKEN="${KB_TOKEN:-}"
if [ -z "$TOKEN" ] && command -v gh >/dev/null 2>&1; then TOKEN="$(gh auth token 2>/dev/null || true)"; fi
if [ -z "$TOKEN" ]; then
  if [ -d "$DEST" ]; then echo "warn: no KB_TOKEN/gh token; using existing $DEST" >&2; exit 0; fi
  echo "error: set KB_TOKEN or log in with 'gh auth login'" >&2; exit 1
fi
TMP="$DEST.tmp.$$"; rm -rf "$TMP"
# Token passed via an HTTP header for this one command only (not in the remote URL, not saved in git config).
AUTH="$(printf 'x-access-token:%s' "$TOKEN" | base64 | tr -d '\n')"
if git -c "http.https://github.com/.extraheader=AUTHORIZATION: basic $AUTH" clone -q --depth 1 --branch "$REF" "https://github.com/$REPO.git" "$TMP"; then
  rm -rf "$TMP/.git" "$DEST"; mv "$TMP" "$DEST"; echo "KB fetched ($REPO@$REF) into $DEST"
else
  rm -rf "$TMP"; if [ -d "$DEST" ]; then echo "warn: fetch failed; using existing $DEST" >&2; else exit 1; fi
fi
