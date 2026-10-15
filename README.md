# n-workspace

Code-only workspace viewer for a private knowledge base. **This repo is public and never holds data or secrets.**

## Layout
- `schema/` — record schema (`record.schema.json`): type, area, project, status, maturity, owner, privacy, created, updated, tags, origin.
- `views/` — view configs: 今日 (`today`), 项目看板 (`projects`), 学习 (`learning`), 生活与账号 (`life`).
- `app/` — static renderer (vanilla JS).
- `scripts/fetch-kb.sh` — build-time clone of the private KB using `KB_TOKEN` from env / CI secret only.
- `scripts/build-index.mjs` — parses frontmatter into `data/records.json`.

## Usage
```bash
export KB_TOKEN=...        # fine-grained, read-only, never committed
npm run build              # fetch KB -> kb/, index -> data/
npm run serve              # open /app/
```

## Privacy rules
- `kb/`, `data/`, `dist/`, `.env` are gitignored. Never commit KB content.
- Records default to `privacy: private` and are hidden unless `SHOW_PRIVATE=1` at local build time.
- Deploy built output only to a private target (local, or Cloudflare Pages + Access). Do not publish to public GitHub Pages.
