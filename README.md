# n-workspace

Personal life/work dashboard: 9 modules (总览, 个人信息, 账号中心, 订阅与支出, 理财, 工作与项目, 学习与成长, 内容运营, 生活事务).
**This repo is code only.** All data comes from the private KB `nomad003/n-knowledge-base` at build time and is never committed
(`/kb/`, `/data/`, `/dist/`, `.env*` are gitignored).

## Quick start (macOS / Linux)

Prerequisites: **Node.js ≥ 18**, `git`, a POSIX `sh`, plus either `KB_TOKEN` (a GitHub token with read access to the KB) or the `gh` CLI logged in (`gh auth login`).

```sh
npm start          # install deps if needed → fetch KB → build data/bundle.json → serve http://127.0.0.1:5173/app/
```

| env | default | meaning |
|---|---|---|
| `KB_TOKEN` | `gh auth token` | GitHub token; used only in memory for the clone, never written to disk |
| `KB_REF` | `main` | KB branch to fetch (e.g. a `feat/data-*` branch) |
| `KB_LOCAL` | – | copy from a local KB clone instead of fetching |
| `SKIP_FETCH=1` | – | reuse the existing `kb/` |
| `SHOW_PRIVATE` | on | personal local tool: private records are included. `SHOW_PRIVATE=0` hides everything not marked `privacy: public` |
| `PORT` | 5173 | server port (always bound to 127.0.0.1) |

`npm run demo` builds from `examples/` (synthetic, fake data) to preview all widgets.

## Data model

* Notes: Markdown frontmatter (`schema/record.schema.json`). Privacy comes **only** from frontmatter `privacy`; missing means private. File names (e.g. `.local.md`) are never used.
* Structured data: `n-knowledge-base/data/{accounts,subscriptions,finance,profile,tasks,content}.yaml` (schemas in `schema/*.schema.json`).
  Loaders accept a top-level list, `{items: [...]}`, or an object of named lists; common field aliases are mapped
  (`2fa`/`mfa`→`two_fa`, `renewal_date`/`next_billing`/`expires`→`next_renewal`, `deadline`→`due`, …). Fields that look like secrets
  (password, token, secret, recovery codes, pin, cvv) are dropped and never reach the bundle. Missing files are reported in the UI.
* `views/*.json` configure each module: which YAML file, which notes (by `path` prefix / `area` / `type`), columns, grouping.
* 总览 computes countdowns (renewals, task due dates, document expiry) and risk alerts: accounts without 2FA or flagged at risk,
  renewals within `risk_renewal_days`, overdue tasks. Agent tasks are tasks with `owner: agent:<name>`.

## Future deploy: Cloudflare Pages + Access (not set up)

1. Pages project from this repo; build command `sh scripts/fetch-kb.sh && node scripts/build-index.mjs && mkdir -p dist && cp -R app views index.html dist/ && mkdir -p dist/data && cp data/bundle.json dist/data/`, output `dist`.
2. Add `KB_TOKEN` (fine-grained, read-only on the KB) as an encrypted build env var. Do **not** add `gh`.
3. **Before the first deploy**, put the whole Pages domain (including `*.pages.dev` previews) behind **Cloudflare Access** (Zero Trust → Applications → self-hosted, allow only your email/IdP). The bundle contains private data whenever `SHOW_PRIVATE` is not `0`.
4. Consider `SHOW_PRIVATE=0` for any deploy not protected by Access.
