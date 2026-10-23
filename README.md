# n-workspace

Personal life/work dashboard: Sections (v9, n-life-data data model v9): **今天** (derived from `data/tasks.yaml` + `plans.yaml` + `subscriptions.yaml`: overdue · due today · scheduled today · this week · this month · quarter progress · renewals · next review · agents) · **计划** (本周/本月 board, goal tree decade → year → half/quarter → tasks, review cadences + instances + `learn/mind/reviews/`, learning under `learn/ai/`) · **主题** · **生活** · **记录** · **账号** (身份 → 分类 = `account-groups.yaml` group → subcategory → account → 订阅 linked by `account_id`; plus 安全 and 关系图) · **知识** (n-knowledge-base only; `kb-index.json`) · **Agents** (tasks with `owner: agent:*`, notes from the agents section: `content/x/` `content/blibli/` `learn/agent/pi/` and `life://team`). Plus **设置**. Every page's tabs — ids and labels — come from `data/sections.yaml` (`source` may be omitted or `[]`). Built-in tab lists are used only when that page has no section, and a tab id with no renderer (or a renderer the section omits) is a build warning on 设置. `app/src/life-paths.js` uses the path it is given. Older v2/v1 names are tried only when `LIFE_LEGACY_PATHS=1`, and each hit is a build warning. `data/` stays at the life-repo root.

Data: `scripts/v9.mjs` loads schema_version 9 files (and masks any e-mail / phone it passes through); v8 data still builds (compat path). `kb://` / `life://` resolve by path first, then frontmatter `id`. Build a branch of either root with `KB_REF=… LIFE_REF=… npm start` (default `main`). Indexes: `data/kb-index.json` (KB) and `data/life-index.json` (life).

Design: calm neutrals, one indigo accent, light/dark; type-led lists instead of KPI strips, no charts on home, placeholders never shown inline (they are collected in 设置 → 数据补全). 2FA "needs attention" is defined once in `core.js` (`twoFaState`, `weak2fa`) and used everywhere. Code: `app/src/main.js` (shell, router, ⌘K) + `app/src/pages/*.js` + `ui.js` / `data.js` / `identity.js`.

When `data/sections.yaml` has a non-empty `modules` list, the sidebar is **总览**, then each module (生活、工作、学习、内容、账号、知识), then the cross-module views (规划与复盘、团队), then **主题**. A module or view page shows its owner bots and paths, then the tabs it names as `sectionId/tabId` (resolved against `sections`). **总览** is the home page: one card per module (owners, note count, latest update, days since that update, active and proposed topic counts) and a topic strip (module, lifecycle, last log date, staleness). Proposed topics are marked 提议 and listed on their own. Old hashes such as `#today`, `#plan/board`, `#journal/cfwork` and `#agents` redirect to the module that owns that tab. `#knowledge/note` stays the note page. If `modules` is missing or empty, the sidebar stays 今天 · 计划 · 主题 · 生活 · 记录 · 账号 · 知识 · Agents, and `#overview` opens 今天. On a module page the folder description and the directory rail stay inside that module (`<模块>目录` lists only its folders).

⌘K and **知识 → 搜索** search life and KB note bodies (`life-index.json` and `kb-index.json`). Filters: module, topic, source (`kb` or `life`), and a date range. Each hit shows its module badge. **时间线** (`data/timeline.json`) lists dated life notes (frontmatter `date`, otherwise `updated`), topic-log lines, completed tasks, completed reviews, and KB updates. Open it from 总览, from a module (pre-filtered), or from a topic. Group by month or week. A note page lists **被引用** incoming `kb://`, `life://`, and wiki links, grouped by module.

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
* `kb://<path>` and `life://<path>` in notes and data values become in-app links (`#kb/note?id=…`), with backlinks on the note.
  The path is relative to that repo's root, uses the real filename (Chinese is fine), omits `.md`, and is not percent-encoded. A path with spaces is wrapped in angle brackets: `[gRPC Args](<kb://backend/network/gRPC/gRPC Args>)`. Parentheses in a name are part of the path (`kb://backend/architecture/限流方案(参考)`). A trailing `/` is a folder (`kb://math/`, `kb://backend/`): open `index.md` in that folder when it exists, otherwise the filtered note list. `kb://<id>` / `life://<id>` still match a frontmatter id when no file has that path. A unique filename matches too.
* `templates/` (in either root) and template notes are skipped. Life notes without frontmatter are included (area/type = top folder).

| env | default | meaning |
|---|---|---|
| `KB_TOKEN` / `LIFE_TOKEN` | `gh auth token` | used only in memory for the clone, never written to disk |
| `SKIP_FETCH=1` | – | reuse existing `kb/` and `life/` |
| `SHOW_PRIVATE` | on | personal local tool. `SHOW_PRIVATE=0` drops all life content and every KB note/data item not marked `privacy: public` |
| `PORT` | 5173 | server port (always bound to 127.0.0.1; only `app/`, `views/`, `data/bundle.json`, `data/kb-index.json`, `data/life-index.json`, `data/timeline.json` and `data/notes/` are served) |

## Demo mode (no private repos needed)

```
npm install
npm run demo            # builds data/ from examples/ and serves http://127.0.0.1:5173/app/
npm run demo -- --build # build only
```

Works the same on Windows, macOS and Linux (`scripts/demo.mjs` sets the roots itself — no `VAR=value` shell syntax).
`examples/` is a **fully fictional** v9 dataset (Jane Doe, example.com, 138-0000-0000, made-up services and numbers):

* `examples/life/` — fictional n-life-data v3 layout: `data/*.yaml` still at the repo root (schema_version 9: identities, account-groups, 15 accounts, 5 subscriptions linked by `account_id`, plans + reviews, tasks, sections, topics + `topic-logs/*.jsonl` with metric entries, profile, finance, content). `data/sections.yaml` lists the same pages and tab ids as the life repo (today, plan, topics, life, journal including `weekly` and `records`, accounts, knowledge, agents), plus fictional `modules` and `views` that point at those tabs. Topics name a module (one of them also a second module) and include one `proposed` topic. Each sourced folder has an `index.md`. Notes under `life/` (`profile` `family` `journal/daily` `journal/weekly` `plan` `records` `health` `finance` `house` `travel` `reading`), `learn/` (`ai` `idea` `mind` `mind/reviews` `english` `agent/pi`), `accounts/` (`register` `workspace`), `content/` (`x` `blibli`), `work/` (`cfwork` `cfwork/reports` `server`), plus one image attachment. Frontmatter ids are unchanged.
* `examples/kb/n-knowledge-base/` — fictional general notes in the current vault layout (`cs/`, `backend/{network,storage,architecture}`, `ai/llm/`, `math/`, `tools/`, `templates/`, `README.md`, `AGENTS.md`) with `kb://<path>` links, including a spaced path, a parenthesised name, and a folder link. Mindset lives in `examples/life/learn/mind/`.
* `examples/schemas/`, `examples/tools/validate.py`, and `examples/tools/check_links.py` are **vendored from n-life-data**. Re-sync them with `LIFE_ROOT=/path/to/n-life-data sh scripts/sync-schemas.sh` (`LIFE_ROOT` defaults to `life/`). Do not edit these files in this repo; a later sync would overwrite the change. `npm run validate-examples` (Python 3 + PyYAML) must report no errors. `npm run check-example-links` runs the vendored checker against `examples/life`. The checker takes its root from its own file path, so that script is the supported way to point it at the example life repo.

Demo mode writes the same `data/` build output as `npm start`; run `npm start` again to go back to your own data.

## Data model

* Notes: Markdown frontmatter (`examples/schemas/frontmatter.schema.json`, vendored from n-life-data). Privacy comes **only** from frontmatter `privacy`; missing means private. File names (e.g. `.local.md`) are never used.
* Structured data lives in the life repo: `data/{accounts,subscriptions,finance,profile,tasks,content,plans,sections,…}.yaml` (schemas vendored in `examples/schemas/`). A missing life file can still be read from a KB `data/` copy, with a build warning. Placeholders like `待补充` are treated as unknown. Task due dates are inferred from `YYYY-MM` hints in `notes` (shown as 约). `renew_date` accepts ISO dates and 约每月 N 日.
  Loaders accept a top-level list, `{items: [...]}`, or an object of named lists; common field aliases are mapped
  (`2fa`/`mfa`→`two_fa`, `renewal_date`/`next_billing`/`expires`→`next_renewal`, `deadline`→`due`, …). Fields that look like secrets
  (password, token, secret, recovery codes, pin, cvv) are dropped and never reach the bundle. Missing files are reported in the UI.
* `views/*.json` hold module order and the settings pages still read: `today` countdown windows, the `accounts` category map, the `knowledge` topic filter, and `agents` note paths (used only when `sections.yaml` has no agents section). Page tabs are not listed here; they come from `data/sections.yaml`.
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
- **知识** reads n-knowledge-base only. Its home tab is **领域** (one row per top-level folder: `cs`, `backend`, `devtools`, `ai`, `math`, `tools`). **主题** is the next level (`backend/network`, `ai/llm`, …).
- **Tabs** for 今天, 计划, 主题, 生活, 记录, 账号, 知识 and Agents are the `tabs` of that page in `data/sections.yaml` (id + label). A folder source (`life://…/`) lists the notes in that directory: 计划 → 目标树 includes `life/plan/`, 复盘 includes `learn/mind/reviews/`, 记录 → 时间线 is `life/records/`. A folder's own `index.md` / `README.md` is not a row in that list (and is omitted from the sidebar and tab counts). When the folder has one, its content — or the first paragraph, when the note is long — is the description at the top of the tab, with an 打开索引 link. The note itself stays in ⌘K and in links. The same rule applies to 知识 directory lists. When one tab's folder is inside another tab's folder in the same section, the parent list leaves those notes out and shows 另见 plus the more specific tab (记录 → 乘风 and 工作汇报). A single-note source is pinned as the tab's 索引. `source: []` and a missing `source` are empty, not an error. A sections tab id with no page renderer, or a renderer the section does not list, is reported under 设置 → 构建警告. Set `LIFE_LEGACY_PATHS=1` to look up a missing v3 path under the older bot-domain and original names; each lookup that hits is its own build warning.
- **主题** reads `data/topics.yaml` + `data/topic-logs/*.jsonl` from n-life-data. Channel numbers (X followers …) come from the topic log (`content.yaml snapshots_ref`), falling back to old `snapshots`.
- **Build warnings**: `boundary:` when a KB note links into life (explicit `life://`, resolves to a life note, or a dangling wikilink whose name is now a life note); `topics:` for unresolved topic refs or a KB narrative; `attachments:` for missing files; `sections.yaml:` for a tab id the page cannot render, a renderer the section omits, or a folder that is not on disk yet; `life path fallback:` when `LIFE_LEGACY_PATHS=1` and an older path is the one that exists.
- **Attachments**: images, scripts (`.py`, `.ps1`, `.sh`, and other common script and text extensions) and other non-markdown files referenced by notes — `[[…/x.py]]` is an attachment, not a note link — plus every file under life section folders, are listed in `data/attachments.json` and served at `/files/<kb|life>/<path>` on 127.0.0.1 only. Nothing else under kb/ or life/ is served (no `.md`, `.enc`, `data/`); exported HTML is sandboxed (no scripts). Review templates (`templates/…`, with or without a `life://` prefix) are shown as plain text.
- **账号 → 相关笔记** searches both `life-index.json` and `kb-index.json`, so a note under `accounts/register/` is included when the service name appears in it.
