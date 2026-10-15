#!/bin/sh
# Fetch one private content root into a gitignored folder.
# Usage: sh scripts/fetch-root.sh <kb|life>
#   kb   -> KB_REPO   (nomad003/n-knowledge-base), KB_REF,   KB_LOCAL   -> ./kb
#   life -> LIFE_REPO (nomad003/n-life-data),      LIFE_REF, LIFE_LOCAL -> ./life
# Token: $KB_TOKEN (also used for life unless $LIFE_TOKEN is set), else `gh auth token`. Never written to disk.
set -eu
NAME="${1:?usage: fetch-root.sh kb|life}"
case "$NAME" in
  kb)   REPO="${KB_REPO:-nomad003/n-knowledge-base}"; REF="${KB_REF:-main}";   LOCAL="${KB_LOCAL:-}";   TOKEN="${KB_TOKEN:-}";;
  life) REPO="${LIFE_REPO:-nomad003/n-life-data}";    REF="${LIFE_REF:-main}"; LOCAL="${LIFE_LOCAL:-}"; TOKEN="${LIFE_TOKEN:-${KB_TOKEN:-}}";;
  *) echo "unknown root: $NAME" >&2; exit 2;;
esac
DEST="$NAME"
if [ -n "$LOCAL" ]; then
  [ -d "$LOCAL" ] || { echo "error: ${NAME} local path not found: $LOCAL" >&2; exit 1; }
  rm -rf "$DEST"; mkdir -p "$DEST"; cp -R "$LOCAL"/. "$DEST"/
  COMMIT="$(git -C "$LOCAL" rev-parse HEAD 2>/dev/null || echo unknown)"; rm -rf "$DEST/.git"
  printf '{"repo":"%s","ref":"local","commit":"%s","fetched_at":"%s","method":"local","path":"%s"}\n' "$REPO" "$COMMIT" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$LOCAL" > "$DEST/.nw-source.json"
  echo "$NAME: copied from $LOCAL"; exit 0
fi
if [ -z "$TOKEN" ] && command -v gh >/dev/null 2>&1; then TOKEN="$(gh auth token 2>/dev/null || true)"; fi
if [ -z "$TOKEN" ]; then
  if [ -d "$DEST" ]; then echo "warn: $NAME: no token; using existing ./$DEST" >&2; exit 0; fi
  echo "error: $NAME: set KB_TOKEN or log in with 'gh auth login'" >&2; exit 1
fi
TMP="$DEST.tmp.$$"; rm -rf "$TMP"
AUTH="$(printf 'x-access-token:%s' "$TOKEN" | base64 | tr -d '\n')"
if git -c "http.https://github.com/.extraheader=AUTHORIZATION: basic $AUTH" clone -q --depth 1 --branch "$REF" "https://github.com/$REPO.git" "$TMP" 2>/dev/null; then
  COMMIT="$(git -C "$TMP" rev-parse HEAD 2>/dev/null || echo unknown)"
  COMMIT_DATE="$(git -C "$TMP" log -1 --format=%cI 2>/dev/null || echo "")"
  rm -rf "$TMP/.git" "$DEST"; mv "$TMP" "$DEST"
  # sync metadata for the 数据源 registry (no secrets)
  printf '{"repo":"%s","ref":"%s","commit":"%s","commit_date":"%s","fetched_at":"%s","method":"git"}\n' "$REPO" "$REF" "$COMMIT" "$COMMIT_DATE" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$DEST/.nw-source.json"
  echo "$NAME: fetched $REPO@$REF ($COMMIT) into ./$DEST"
else
  rm -rf "$TMP"
  if [ -d "$DEST" ]; then echo "warn: $NAME: fetch of $REPO@$REF failed; using existing ./$DEST" >&2; exit 0; fi
  echo "warn: $NAME: fetch of $REPO@$REF failed (repo/branch missing or no access)" >&2; exit 3
fi
