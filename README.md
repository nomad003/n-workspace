# n-workspace

Personal life/work dashboard: 5 sections (v8 redesign): **今天** (5 blocks: 接下来 30 天 · 本季度计划 · 需要处理 · 最近在做 · Agents) · **计划** (12 个月行动清单 by horizon, 复盘 cadence, 生活领域, 学习路线 — parsed from `life/12个月行动清单.md` and `life/复盘节奏.md` by `scripts/plan.mjs`) · **知识** (projects first, directory tree, logs archive, full-text search, note pages with wikilinks/backlinks) · **账号与订阅** (attention → identities → categories; drill-down `#accounts/identities`, `#accounts/cat/<slug>`, `#account/<id>`; subscriptions) · **Agents**. Plus **设置** (data sources, one 数据补全 queue, theme).

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
| `PORT` | 5173 | server port (always bound to 127.0.0.1; only `app/`, `views/`, `schema/`, `data/bundle.json`, `data/kb-index.json` and `data/notes/` are served) |

`npm run demo` builds from `examples/` (synthetic, fake data).

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
