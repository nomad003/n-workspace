// Build data/bundle.json (gitignored) from the KB: notes frontmatter + n-knowledge-base/data/*.yaml.
// Local builds include private records by default (personal tool). Opt out with SHOW_PRIVATE=0.
import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto"; import * as yaml from "js-yaml"; import { marked } from "marked"; import { loadV9 } from "./v9.mjs";
import { toItems, normalize, isPublic, match, overview, known } from "../app/src/core.js";

// Two content roots (gitignored, fetched by scripts/fetch-root.sh):
//   KB_ROOT   = n-knowledge-base (notes keep their frontmatter privacy)
//   LIFE_ROOT = n-life-data      (everything is private, regardless of frontmatter)
const KB_ROOT = process.env.KB_ROOT || process.env.KB_DEST || (fs.existsSync("kb/n-knowledge-base") ? "kb/n-knowledge-base" : "kb");
const KB_REPO_ROOT = fs.existsSync(path.join(KB_ROOT, "..", ".")) && path.basename(KB_ROOT) === "n-knowledge-base" ? path.dirname(KB_ROOT) : KB_ROOT;
const LIFE_ROOT = process.env.LIFE_ROOT || "life";
const SRC = KB_ROOT;
const warnings = [];
const hasLife = fs.existsSync(LIFE_ROOT);
if (!hasLife) warnings.push(`life root not found: ${LIFE_ROOT} (set LIFE_REPO/LIFE_LOCAL; using KB only)`);
// data/*.yaml: LIFE_ROOT/data first; fall back to KB data/ with a warning.
const DATA_CANDIDATES = [[path.join(LIFE_ROOT, "data"), "life"], [path.join(KB_REPO_ROOT, "data"), "kb"], [path.join(KB_ROOT, "data"), "kb"]];
const [DATA_DIR, DATA_ROOT] = process.env.DATA_DIR ? [process.env.DATA_DIR, process.env.DATA_ROOT || "life"]
  : DATA_CANDIDATES.find(([d]) => fs.existsSync(d)) || [path.join(LIFE_ROOT, "data"), "life"];
if (DATA_ROOT === "kb") warnings.push(`data/*.yaml read from KB fallback ${DATA_DIR} (expected ${path.join(LIFE_ROOT, "data")})`);
const OUT = "data";
fs.mkdirSync(OUT, { recursive: true });
const showPrivate = process.env.SHOW_PRIVATE !== "0";
const MODULE_FILES = ["accounts", "subscriptions", "finance", "profile", "tasks", "content", "identities"];
const OPTIONAL_FILES = new Set(["identities"]); // newer files: absence is not reported as missing
const templateNames = new Set();
const SKIP_DIRS = new Set(["templates", "11-Templates", "node_modules"]);

function frontmatter(t) {
  const m = t.replace(/^\uFEFF/, "").match(/^---\r?\n([\s\S]*?)\r?\n---/); if (!m) return null;
  try { const o = yaml.load(m[1], { schema: yaml.JSON_SCHEMA }); return o && typeof o === "object" ? o : null; } catch { return undefined; }
}
// Links: kb://n-knowledge-base/<path> and life://<path> (cross-root, %20-encoded), plus [[wikilinks]] (same root).
const LINK_RE = /\b(kb|life):\/\/([^\s)\]"'`<>|，。；]+)/g;
const WIKI_RE = /\[\[([^\]|#\n]+?)(?:#[^\]|\n]*)?(?:\|[^\]\n]*)?\]\]/g;
const ATTACH_RE = /\.(png|jpe?g|gif|webp|svg|pdf|mp4|mov|zip|enc|bin|html?|mmd|canvas|excalidraw)$/i;
function linksIn(t, root) {
  const body = String(t).replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, ""); // ignore code
  const out = [...body.matchAll(LINK_RE)].map(m => ({ root: m[1], path: safeDecode(m[2]).replace(/[.,;:）]+$/, ""), kind: "uri" }));
  for (const m of body.matchAll(WIKI_RE)) { const p = m[1].replace(/\\+$/, "").trim(); if (!p || ATTACH_RE.test(p)) continue; out.push({ root, path: p, kind: "wiki" }); }
  return out;
}
function listMd(d) { try { return fs.readdirSync(d, { recursive: true }).filter(f => String(f).endsWith(".md")).map(f => path.basename(String(f), ".md")); } catch { return []; } }
function safeDecode(x) { try { return decodeURIComponent(x); } catch { return x; } }
const records = [];
function walk(root, d, rootName) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (SKIP_DIRS.has(e.name)) for (const t of listMd(p)) templateNames.add(t); if (!e.name.startsWith(".") && !SKIP_DIRS.has(e.name) && path.resolve(p) !== path.resolve(DATA_DIR)) walk(root, p, rootName); continue; }
    if (/\.tar\.enc$|\.enc$/.test(e.name) || !e.name.endsWith(".md") || /^(README|AGENTS|CLAUDE)\.md$/.test(e.name) && d === root) continue;
    const text = fs.readFileSync(p, "utf8"), rel = path.relative(root, p).split(path.sep).join("/");
    let f = frontmatter(text);
    if (f === undefined) { warnings.push(`unparseable frontmatter: ${rootName}://${rel}`); continue; }
    if (!f) { if (rootName !== "life") continue; f = {}; } // life notes may lack frontmatter
    if (f.type === "template" || f.status === "template") { templateNames.add(path.basename(p, ".md")); continue; }
    for (const k of ["created", "updated"]) if (f[k] != null) f[k] = String(f[k]);
    if (rootName === "life") { f.privacy = "private"; f.area ??= rel.split("/")[0]; f.status ??= "active"; f.type ??= rel.split("/")[0]; f.updated ??= fs.statSync(p).mtime.toISOString().slice(0, 10); }
    else f.privacy = f.privacy === "public" ? "public" : "private";
    f.tags = as(f.tags).map(String);
    f.title = f.title || path.basename(p, ".md");
    f.slug = f.id != null ? String(f.id) : null; f.root = rootName; f.id = `${rootName}:${rel}`;
    f.origin = { source: rootName === "life" ? "n-life-data" : "n-knowledge-base", ...(f.origin || {}), source_path: rel };
    f.links = linksIn(text, rootName);
    Object.defineProperty(f, "_text", { value: text.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---\r?\n?/, ""), enumerable: false });
    records.push(f);
  }
}
if (fs.existsSync(KB_ROOT)) walk(KB_ROOT, KB_ROOT, "kb"); else warnings.push(`KB root not found: ${KB_ROOT}`);
if (hasLife) walk(LIFE_ROOT, LIFE_ROOT, "life");
// resolve links: exact path, path + ".md", or unique basename match within the root.
const byId = new Map(records.map(r => [r.id, r]));
const bySlug = new Map(records.filter(r => r.slug).map(r => [`${r.root}|${r.slug.toLowerCase()}`, r.id])); // v9 frontmatter ids: kb://<id>, life://<id>
// Obsidian-style resolution: exact vault path, path relative to the linking note, then basename (shortest path wins).
function resolve({ root, path: p }, from) {
  // kb:// links carry the vault folder ("n-knowledge-base/<path>"); records are relative to the vault.
  const clean = p.replace(/^\/+/, "").replace(/^n-knowledge-base\//, "").replace(/#.*$/, "").replace(/\.md$/, "");
  const sl = bySlug.get(`${root}|${clean.toLowerCase()}`); if (sl) return sl;
  const dir = from && from.root === root ? path.posix.dirname(from.origin.source_path) : "";
  for (const c of [clean, dir && dir !== "." ? path.posix.join(dir, clean) : null].filter(Boolean))
    for (const x of [c, c + ".md"]) if (byId.has(`${root}:${x}`)) return `${root}:${x}`;
  const base = clean.split("/").pop();
  const hits = records.filter(r => r.root === root && r.origin.source_path.replace(/\.md$/, "").split("/").pop() === base)
    .sort((a, b) => a.origin.source_path.length - b.origin.source_path.length);
  return hits.length ? hits[0].id : null;
}
let broken = 0; const brokenList = [];
for (const r of records) r.links = r.links.map(l => { const id = resolve(l, r); const tpl = !id && templateNames.has(l.path.split("/").pop().replace(/\.md$/, "")); if (!id && !tpl) { broken++; brokenList.push(`${r.id} -> ${l.kind === "wiki" ? `[[${l.path}]]` : `${l.root}://${l.path}`}`); }
  return { href: l.kind === "wiki" ? `[[${l.path}]]` : `${l.root}://${l.path}`, id, kind: tpl ? "template" : l.kind }; });
const backlinks = {};
for (const r of records) for (const l of r.links) if (l.id) (backlinks[l.id] ||= []).push(r.id);
for (const r of records) r.backlinks = backlinks[r.id] || [];
function as(v) { return v == null ? [] : Array.isArray(v) ? v : [v]; }

// finance.snapshot summary: sums only numeric (filled-in) amounts; "净资产合计" row wins when filled.
function financeSummary(items) {
  const num = x => { const n = typeof x === "number" ? x : Number(String(x ?? "").replace(/[, ]/g, "")); return Number.isFinite(n) && String(x ?? "").trim() !== "" ? n : null; };
  const val = x => num(x.amount ?? x.balance ?? x.value);
  const money = items.filter(x => ["income", "expenses", "assets", "liabilities"].includes(x.kind));
  const sum = k => { const xs = items.filter(x => x.kind === k && !/合计|total/i.test(x.item ?? "")).map(val).filter(v => v != null); return xs.length ? xs.reduce((a, b) => a + b, 0) : null; };
  const nwRow = items.find(x => x.kind === "assets" && /净资产|net/i.test(x.item ?? ""));
  const assets = sum("assets"), liabilities = sum("liabilities");
  const net_worth = nwRow && val(nwRow) != null ? val(nwRow) : assets != null ? assets - (liabilities ?? 0) : null;
  return { assets, liabilities, net_worth, income: sum("income"), expenses: sum("expenses"), filled: money.filter(x => val(x) != null).length, total: money.length };
}
const modules = {}; const missing = [];
for (const name of MODULE_FILES) {
  // per-file lookup: LIFE_ROOT/data first, then KB data/ (fallback, warned).
  const dirs = process.env.DATA_DIR ? [[DATA_DIR, DATA_ROOT]] : DATA_CANDIDATES.filter(([d]) => fs.existsSync(d));
  let file, DATA_ROOT_F;
  for (const [d, rt] of dirs) { file = ["yaml", "yml"].map(x => path.join(d, `${name}.${x}`)).find(f => fs.existsSync(f)); if (file) { DATA_ROOT_F = rt; break; } }
  if (!file) { if (!OPTIONAL_FILES.has(name)) missing.push(`${name}.yaml`); modules[name] = { items: [], source: null }; continue; }
  if (DATA_ROOT_F === "kb" && hasLife) warnings.push(`${name}.yaml not in ${path.join(LIFE_ROOT, "data")}; using KB fallback ${file}`);
  const DATA_ROOT = DATA_ROOT_F;
  let doc;
  try { doc = yaml.load(fs.readFileSync(file, "utf8")); } catch (e) { warnings.push(`${name}: YAML error ${e.message.split("\n")[0]}`); doc = null; }
  if (name === "profile") {
    const data = doc && typeof doc === "object" && !Array.isArray(doc) ? normalize(doc, "profile") : {};
    if (data.documents) data.documents = as(data.documents).map(x => normalize(x, "doc"));
    for (const k of ["privacy", "updated", "sources"]) delete data[k];
    modules[name] = { data: showPrivate || (DATA_ROOT !== "life" && doc?.privacy === "public") ? data : {}, items: [], source: `${DATA_ROOT}://${path.relative(DATA_ROOT === "life" ? LIFE_ROOT : KB_REPO_ROOT, file)}`, root: DATA_ROOT };
  } else {
    const filePrivacy = DATA_ROOT === "life" ? "private" : doc && !Array.isArray(doc) ? doc.privacy : undefined; // file-level privacy applies to items without their own
    let all = toItems(doc, name).map(x => ({ ...x, privacy: DATA_ROOT === "life" ? "private" : x.privacy ?? filePrivacy ?? "private" }));
    const extra = {};
    if (name === "finance" && doc && !Array.isArray(doc)) {
      if (doc.snapshot && typeof doc.snapshot === "object") extra.snapshot = normalize(doc.snapshot, "snapshot");
      extra.summary = financeSummary(all);
    }
    modules[name] = { ...extra, items: showPrivate ? all : all.filter(isPublic), hidden: showPrivate ? 0 : all.filter(x => !isPublic(x)).length, source: `${DATA_ROOT}://${path.relative(DATA_ROOT === "life" ? LIFE_ROOT : KB_REPO_ROOT, file)}`, root: DATA_ROOT, updated: doc?.updated ? String(doc.updated instanceof Date ? doc.updated.toISOString().slice(0, 10) : doc.updated) : null };
  }
}
// ---- schema_version 9 (n-life-data data model v9): replaces the v8 items with v9 records + compatibility aliases
let V9 = null;
if (hasLife && !process.env.DATA_DIR) {
  const accDoc = (() => { try { return yaml.load(fs.readFileSync(path.join(LIFE_ROOT, "data", "accounts.yaml"), "utf8")); } catch { return null; } })();
  if (accDoc?.schema_version === 9) {
    V9 = loadV9(LIFE_ROOT, w => warnings.push(w));
    const src = n => `life://data/${n}.yaml`;
    for (const [n, items] of [["accounts", V9.accounts], ["identities", V9.identities], ["subscriptions", V9.subscriptions], ["tasks", V9.tasks]])
      modules[n] = { ...modules[n], items: showPrivate ? items : [], hidden: showPrivate ? 0 : items.length, source: src(n), root: "life", updated: V9.updated[n] ?? modules[n]?.updated ?? null, schema_version: 9 };
    for (const w of V9.missingDirs) warnings.push(`sections.yaml: life://${w} does not exist yet (tab shows empty)`);
  }
}
const shown = showPrivate ? records : records.filter(isPublic);
const views = Object.fromEntries(fs.readdirSync("views").filter(f => f.endsWith(".json"))
  .map(f => JSON.parse(fs.readFileSync(path.join("views", f), "utf8"))).map(v => [v.id, v]));

/* ---------- note bodies: Markdown -> HTML (per-note JSON, loaded on demand) + full-text index ---------- */
const noteFile = id => crypto.createHash("sha1").update(id).digest("hex").slice(0, 16);
const escH = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const href = id => `#kb/note?id=${encodeURIComponent(id)}`;
function renderNote(r) {
  const code = []; // protect code from link rewriting
  let md = r._text.replace(/```[\s\S]*?```|`[^`\n]*`/g, m => `\u0000${code.push(m) - 1}\u0000`);
  md = md.replace(/!\[\[([^\]]+)\]\]/g, (m, t) => `<span class="att">附件 · ${escH(t.split("|")[0].split("/").pop())}</span>`);
  md = md.replace(/\[\[([^\]|#\n]+?)\\?(#[^\]|\n]*)?(?:\\?\|([^\]\n]*))?\]\]/g, (m, t, h, alias) => {
    const target = t.replace(/\\+$/, "").trim(), label = escH((alias || target.split("/").pop()).replace(/\\$/, ""));
    if (ATTACH_RE.test(target)) return `<span class="att">附件 · ${escH(target.split("/").pop())}</span>`;
    const id = resolve({ root: r.root, path: target }, r);
    return id ? `<a class="wl" href="${href(id)}">${label}</a>` : templateNames.has(target.split("/").pop()) ? `<span class="wl tpl">${label}</span>` : `<span class="wl broken" title="未解析">${label}</span>`;
  });
  md = md.replace(/(\]\()?\b(kb|life):\/\/([^\s)\]"'`<>|，。；]+)/g, (m, inLink, root, p) => {
    const id = resolve({ root, path: safeDecode(p).replace(/[.,;:）]+$/, "") }, r); const url = id ? href(id) : "#kb";
    return inLink ? `](${url}` : id ? `[${escH(byId.get(id).title)}](${url})` : `<span class="wl broken">${escH(m)}</span>`;
  });
  md = md.replace(/\u0000(\d+)\u0000/g, (m, i) => code[+i]);
  let html = marked.parse(md, { gfm: true, breaks: false });
  html = html.replace(/<(script|iframe|object|embed|style)[\s\S]*?<\/\1>/gi, "").replace(/\son\w+="[^"]*"/gi, "").replace(/href="javascript:[^"]*"/gi, 'href="#"')
    .replace(/<img[^>]*?(?:alt="([^"]*)")?[^>]*>/gi, (m, alt) => `<span class="att">图片${alt ? " · " + alt : ""}</span>`)
    .replace(/<a href="(?!#|https?:|mailto:)([^"]*)"/g, '<a class="att" data-local="$1"');
  return html;
}
const plain = t => t.replace(/```[\s\S]*?```/g, " ").replace(/!?\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (m, a, b) => b || a).replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
  .replace(/[#>*_`~|-]+/g, " ").replace(/\s+/g, " ").trim();
fs.rmSync(path.join(OUT, "notes"), { recursive: true, force: true }); fs.mkdirSync(path.join(OUT, "notes"), { recursive: true });
const kbIndex = [], lifeIndex = [];
for (const r of shown) {
  const f = noteFile(r.id);
  fs.writeFileSync(path.join(OUT, "notes", f + ".json"), JSON.stringify({ id: r.id, html: renderNote(r) }));
  r.file = f;
  (r.root === "life" ? lifeIndex : kbIndex).push({ id: r.id, slug: r.slug, f, title: r.title, root: r.root, path: r.origin.source_path, area: r.area ?? null, type: r.type ?? null, status: r.status ?? null,
    maturity: r.maturity ?? null, tags: r.tags, updated: r.updated ?? null, links: r.links.filter(l => l.id).map(l => l.id), backlinks: r.backlinks, text: plain(r._text).slice(0, 30000) });
}
fs.writeFileSync(path.join(OUT, "kb-index.json"), JSON.stringify(kbIndex)); // KB only (知识)
fs.writeFileSync(path.join(OUT, "life-index.json"), JSON.stringify(lifeIndex)); // life notes (生活 / 记录 / 计划)

/* ---------- source registry (数据源) ---------- */
const readMeta = d => { try { return JSON.parse(fs.readFileSync(path.join(d, ".nw-source.json"), "utf8")); } catch { return null; } };
function missingFields(m) {
  const per = {}; const walkF = (x, k) => { if (k === "legacy" || k === "login_method") return; if (Array.isArray(x)) x.forEach(y => walkF(y, k)); else if (x && typeof x === "object") for (const [kk, y] of Object.entries(x)) walkF(y, kk); else if (k && !["notes", "privacy", "kind", "name", "source", "id"].includes(k) && !(m.schema_version === 9 && x == null)) { per[k] ||= [0, 0]; per[k][1]++; if (!known(x)) per[k][0]++; } };
  walkF(m.items?.length ? m.items : m.data, null);
  return Object.entries(per).filter(([, [u]]) => u > 0).map(([field, [unknown, total]]) => ({ field, unknown, total })).sort((a, b) => b.unknown - a.unknown);
}
const dataFiles = MODULE_FILES.map(n => ({ name: `${n}.yaml`, root: modules[n].root || null, source: modules[n].source, items: modules[n].items?.length || Object.keys(modules[n].data || {}).length, updated: modules[n].updated || null, missing_fields: modules[n].source ? missingFields(modules[n]) : [] }));
const sources = [
  { id: "life", name: "n-life-data", role: "primary", kind: "git", present: hasLife, meta: readMeta(LIFE_ROOT), notes: records.filter(r => r.root === "life").length, privacy: "全部私密",
    data_files: dataFiles.filter(d => d.root === "life"), expects: V9 ? V9.sections.flatMap(x => x.tabs.flatMap(t => t.source)).filter(u => /\/$/.test(u)).map(u => u.slice(7)).filter((x, i, a) => a.indexOf(x) === i) : ["data/*.yaml"], schema_version: V9 ? 9 : 8 },
  { id: "kb", name: "n-knowledge-base", role: "secondary", kind: "git", present: fs.existsSync(KB_ROOT), meta: readMeta(KB_REPO_ROOT) || readMeta(KB_ROOT), notes: records.filter(r => r.root === "kb").length, privacy: "按 frontmatter privacy",
    data_files: dataFiles.filter(d => d.root === "kb"), expects: ["n-knowledge-base/**.md"] },
  { id: "x", name: "X (@handle)", role: "reserved", kind: "api", present: false, meta: null, notes: 0, privacy: "—", data_files: [], expects: ["posts / followers 快照（未接入）"] },
  { id: "bilibili", name: "Bilibili", role: "reserved", kind: "api", present: false, meta: null, notes: 0, privacy: "—", data_files: [], expects: ["视频 / 粉丝快照（未接入）"] },
];

const lite = shown.map(r => ({ id: r.id, slug: r.slug, f: r.file, title: r.title, root: r.root, area: r.area ?? null, type: r.type ?? null, status: r.status ?? null, maturity: r.maturity ?? null,
  tags: r.tags, updated: r.updated ?? null, origin: { source_path: r.origin.source_path }, privacy: r.privacy }));
const bundle = { generated: new Date().toISOString(), show_private: showPrivate, kb_ref: sources[1].meta?.ref || process.env.KB_REF || null, life_ref: hasLife ? (sources[0].meta?.ref || process.env.LIFE_REF || "main") : null,
  roots: { kb: fs.existsSync(KB_ROOT), life: hasLife }, broken_links: broken, broken_list: brokenList.slice(0, 200),
  missing, warnings, records: lite, private_hidden: records.length - shown.length, modules, sources };
bundle.overview = overview(bundle, views.today);
if (V9) bundle.v9 = { schema_version: 9, groups: V9.groups, plans: V9.plans, reviews: V9.reviews, sections: V9.sections, missing_dirs: V9.missingDirs, files: V9.files, updated: V9.updated };
fs.writeFileSync(path.join(OUT, "bundle.json"), JSON.stringify(bundle));
const size = f => (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0) + " KB";
console.log(`roots: kb=${fs.existsSync(KB_ROOT)} (${sources[1].meta?.commit?.slice(0, 7) ?? "?"}) life=${hasLife} (${sources[0].meta?.commit?.slice(0, 7) ?? "?"}); links ${records.reduce((a, r) => a + r.links.length, 0)} (${broken} unresolved)`);
console.log(`notes: ${records.length} (kb ${records.filter(r => r.root === "kb").length}, life ${records.filter(r => r.root === "life").length}); ${shown.length} included, private ${showPrivate ? "SHOWN" : "hidden"}`);
console.log(`files: bundle.json ${size("bundle.json")}, kb-index.json ${size("kb-index.json")} (${kbIndex.length}), life-index.json ${size("life-index.json")} (${lifeIndex.length}), notes/ ${kbIndex.length + lifeIndex.length} files`);
console.log(V9 ? `v9: ${V9.accounts.length} accounts · ${V9.groups.length} groups · ${V9.subscriptions.length} subs (${V9.subscriptions.filter(x => x.account_id).length} linked) · ${V9.tasks.length} tasks · ${V9.plans.length} plans · ${V9.reviews.length} reviews · ${V9.sections.length} sections` : "v8 data (schema_version != 9)");
console.log(`data: ${dataFiles.map(d => `${d.name}=${d.root ?? "missing"}:${d.items}`).join(" ")}`);
console.log(`overview: ${bundle.overview.upcoming.length} upcoming, ${bundle.overview.alerts.length} alerts`);
for (const w of warnings) console.warn("warn:", w);
