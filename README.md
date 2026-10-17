# n-workspace

Personal life/work dashboard: Sections (v9, n-life-data data model v9): **今天** (derived from `data/tasks.yaml` + `plans.yaml` + `subscriptions.yaml`: overdue · due today · scheduled today · this week · this month · quarter progress · renewals · next review · agents) · **计划** (本周/本月 board, goal tree decade → year → half/quarter → tasks, review cadences + instances + `reviews/`, learning) · **生活** and **记录** (tabs come from `data/sections.yaml` and mirror the life folders: profile/ family/ finance/ health/ records/ affairs/ digital/ explore/ · journal/daily, journal/weekly, work/reports) · **账号** (身份 → 分类 = `account-groups.yaml` group → subcategory → account → 订阅 linked by `account_id`; plus 安全 and 关系图) · **知识** (n-knowledge-base only; `kb-index.json`) · **Agents** (tasks with `owner: agent:*`). Plus **设置**.

Data: `scripts/v9.mjs` loads schema_version 9 files (and masks any e-mail / phone it passes through); v8 data still builds (compat path). `kb://<id>` / `life://<id>` resolve by frontmatter `id` first, then path. Build a branch of either root with `KB_REF=… LIFE_REF=… npm start` (default `main`). Indexes: `data/kb-index.json` (KB) and `data/life-index.json` (life).

Design: calm neutrals, one indigo accent, light/dark; type-led lists instead of KPI strips, no charts on home, placeholders never shown inline (they are collected in 设置 → 数据补全). 2FA "needs attention" is defined once in `core.js` (`twoFaState`, `weak2fa`) and used everywhere. Code: `app/src/main.js` (shell, router, ⌘K) + `app/src/pages/*.js` + `ui.js` / `data.js` / `identity.js`.

## Quick start (macOS / Linux)

Prerequisites: **Node.js ≥ 18**, `git`, a POSIX `sh`, plus either `KB_TOKEN` (GitHub token with read access to both private repos) or the `gh` CLI logged in (`gh auth login`).

```sh
npm start   # install deps → fetch kb/ + life/ → build data/bundle.json → serve http://127.0.0.1:5173/app/
```

Two content roots, fetched as plain folders (not submodules) into gitignored `kb/` and `life/`:

| root | repo (default) | env | privacy |
|---|---|---|---|
| KB_ROOT → `kb/` | `nomad003/n-knowledge-base` | `KB_REPO`, `KB_REF` (main), `KB_LOCAL` | per-note frontmatter `privacy` (missing = private) |
| LIFE_ROOT → `life/` | `nomad003/n-life-data` | `LIFE_REPO`, `LIFE_REF` (main), `LIFE_LOCAL`, `LIFE_TOKEN` | **everything private** |

* `*_LOCAL=/path/to/clone` copies a local checkout instead of fetching. `KB_ROOT` / `LIFE_ROOT` override the folders the build reads.
* The life root is optional: if the repo/branch is missing, `npm start` warns and continues with the KB only.
* Structured data (`data/*.yaml`) is read per file from `LIFE_ROOT/data/`, falling back to the KB's `data/` with a warning.
* `kb://path` and `life://path` links in notes and data values become in-app links (`#notes?id=…`), with backlinks in the 知识库 detail panel.
  Paths are relative to the repo root; `.md` is optional; a unique file name also resolves. Encode spaces as `%20`.
* `life/templates/`, `11-Templates/` and template notes are skipped. Life notes without frontmatter are included (area/type = top folder).

| env | default | meaning |
|---|---|---|
| `KB_TOKEN` / `LIFE_TOKEN` | `gh auth token` | used only in memory for the clone, never written to disk |
| `SKIP_FETCH=1` | – | reuse existing `kb/` and `life/` |
| `SHOW_PRIVATE` | on | personal local tool. `SHOW_PRIVATE=0` drops all life content and every KB note/data item not marked `privacy: public` |
| `PORT` | 5173 | server port (always bound to 127.0.0.1; only `app/`, `views/`, `schema/`, `data/bundle.json`, `data/kb-index.json`, `data/life-index.json` and `data/notes/` are served) |

## Demo mode (no private repos needed)

```
npm install
npm run demo            # builds data/ from examples/ and serves http://127.0.0.1:5173/app/
npm run demo -- --build # build only
```

Works the same on Windows, macOS and Linux (`scripts/demo.mjs` sets the roots itself — no `VAR=value` shell syntax).
`examples/` is a **fully fictional** v9 dataset (Jane Doe, example.com, 138-0000-0000, made-up services and numbers):

* `examples/life/` — n-life-data layout: `data/*.yaml` (schema_version 9: identities, account-groups, 15 accounts, 5 subscriptions linked by `account_id`, plans + reviews, tasks, sections, topics + `topic-logs/*.jsonl` with metric entries, profile, finance, content), ~17 notes across the sections and one image attachment.
* `examples/kb/n-knowledge-base/` — ~14 general notes with MOCs and `kb://` links (never into life).
* `examples/schemas/` + `examples/tools/validate.py` — the v9 schemas and validator; `npm run validate-examples` (Python 3 + PyYAML) must report no errors.

Demo mode writes the same `data/` build output as `npm start`; run `npm start` again to go back to your own data.

## Data model

* Notes: Markdown frontmatter (`schema/record.schema.json`). Privacy comes **only** from frontmatter `privacy`; missing means private. File names (e.g. `.local.md`) are never used.
* Structured data: KB repo-root `data/{accounts,subscriptions,finance,profile,tasks,content}.yaml` (field names follow the KB `data/README.md`; schemas in `schema/*.schema.json`). Placeholders like `待补充` are treated as unknown. Task due dates are inferred from `YYYY-MM` hints in `notes` (shown as 约). `renew_date` accepts ISO dates and 约每月 N 日.
  Loaders accept a top-level list, `{items: [...]}`, or an object of named lists; common field aliases are mapped
  (`2fa`/`mfa`→`two_fa`, `renewal_date`/`next_billing`/`expires`→`next_renewal`, `deadline`→`due`, …). Fields that look like secrets
  (password, token, secret, recovery codes, pin, cvv) are dropped and never reach the bundle. Missing files are reported in the UI.
* `views/*.json` configure each module: which YAML file, which notes (by `path` prefix / `area` / `type`), columns, grouping.
* 总览 computes countdowns (renewals, task due dates, document expiry) and risk alerts: accounts without 2FA or flagged at risk,
  renewals within `risk_renewal_days`, overdue tasks. Agent tasks are tasks whose `owner` is not `user`.

## Future deploy: Cloudflare Pages + Access (not set up)

1. Pages project from this repo; build command `sh scripts/fetch-root.sh kb && sh scripts/fetch-root.sh life && node scripts/build-index.mjs && mkdir -p dist && cp -R app views index.html dist/ && mkdir -p dist/data && cp -R data/bundle.json data/kb-index.json data/notes dist/data/`, output `dist`.
2. Add `KB_TOKEN` (fine-grained, read-only on the KB) as an encrypted build env var. Do **not** add `gh`.
3. **Before the first deploy**, put the whole Pages domain (including `*.pages.dev` previews) behind **Cloudflare Access** (Zero Trust → Applications → self-hosted, allow only your email/IdP). The bundle contains private data whenever `SHOW_PRIVATE` is not `0`.
4. Consider `SHOW_PRIVATE=0` for any deploy not protected by Access.

## UI

Design system adapted from [pi-analysis](https://pi-analysis.pages.dev/) (nomad003/pi-analysis): Inter + JetBrains Mono (bundled in `app/fonts/`, SIL OFL),
neutral surfaces with a violet accent, per-category color tokens (`--l`, `--l-bg`, `--l-fg`), chips/status dots, radial-glow hero with a masked grid,
stats strip, light/dark theme (persisted in `localStorage`), and a mobile drawer. Charts are dependency-free SVG (`app/src/charts.js`):
donut, stacked bars, horizontal bars, progress, timeline and an agent→module flow diagram.

## Build outputs (all gitignored under `data/`)

* `data/bundle.json` — module data, lite note records, source registry (`sources`), overview.
* `data/kb-index.json` — per-note title/path/tags/links/backlinks + plain text (≤30k chars) for client-side full-text search, loaded lazily.
* `data/notes/<hash>.json` — note HTML rendered at build time with [`marked`](https://github.com/markedjs/marked); wikilinks / `kb://` / `life://` rewritten to in-app links, scripts/iframes/`on*` attributes stripped.
* `<root>/.nw-source.json` — written by `fetch-root.sh` (repo, ref, commit, commit date, fetch time) and shown on 数据源.

## 主题 (topics)

`#topics` shows long-running topics from n-life-data `data/topics.yaml` + `data/topic-logs/<id>.jsonl` (profile, current status, append-only information log, metrics).
Both files are optional; without them the page shows an empty state. To preview with local draft data: `LIFE_ROOT=<copy of life with data/topics.yaml> npm run build && npm run serve`.

## Separation (2026-10): KB = general knowledge, life = everything personal

- **Branches**: `KB_REF` / `LIFE_REF` default to `main`; to preview unmerged data: `KB_REF=feat/separation LIFE_REF=feat/separation npm start`.
- **知识** reads n-knowledge-base only. Its home tab is **领域** (one row per `00-MOC/*` MOC with the KB notes it links to), replacing the old 项目 (10-Projects) tab.
- **生活 / 记录** read n-life-data only (`data/sections.yaml`). A tab source that names a single note (`life://moc/Health-MOC`) is pinned as the tab's 索引; `记录 → 工作项目` mirrors `life://work/projects/`.
- **主题** reads `data/topics.yaml` + `data/topic-logs/*.jsonl` from n-life-data. Channel numbers (X followers …) come from the topic log (`content.yaml snapshots_ref`), falling back to old `snapshots`.
- **Build warnings**: `boundary:` when a KB note links into life (explicit `life://`, resolves to a life note, or a dangling wikilink whose name is now a life note); `topics:` for unresolved topic refs or a KB narrative; `attachments:` for missing files.
- **Attachments**: images and files referenced by notes (and every file under life section folders) are listed in `data/attachments.json` and served at `/files/<kb|life>/<path>` on 127.0.0.1 only. Nothing else under kb/ or life/ is served (no `.md`, `.enc`, `data/`); exported HTML is sandboxed (no scripts).
