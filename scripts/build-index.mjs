// Build data/bundle.json (gitignored) from the life repo (data/*.yaml + notes) and the KB (notes).
// Local builds include private records by default (personal tool). Opt out with SHOW_PRIVATE=0.
import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto"; import * as yaml from "js-yaml"; import { marked } from "marked"; import { loadV9, loadTopics, mask } from "./v9.mjs";
import { fallbacks, setLegacyPaths, legacyPaths, choosePrefixes, noteFallback, drainFallbackWarnings, LIFE_INDEX } from "../app/src/life-paths.js";
import { tabWarnings } from "../app/src/page-tabs.js";
import { buildTimeline, noteDisplayTitle, timelineCounts } from "../app/src/timeline-model.js";
import { analysisStats, buildCoverage, buildRollups, comparePeriods, effortMonths, instanceStatus } from "../app/src/analysis-model.js";
import { todayStamp } from "../app/src/module-model.js";
import { toItems, normalize, isPublic, match, overview, known, dueEnd } from "../app/src/core.js";
import { extractUris, linkContext, normalizeUriPath, resolveUri } from "../app/src/kb-uri.js";

// Two content roots (gitignored, fetched by scripts/fetch-root.sh):
//   KB_ROOT   = n-knowledge-base (notes keep their frontmatter privacy)
//   LIFE_ROOT = n-life-data      (everything is private, regardless of frontmatter)
const KB_ROOT = process.env.KB_ROOT || process.env.KB_DEST || (fs.existsSync("kb/n-knowledge-base") ? "kb/n-knowledge-base" : "kb");
const KB_REPO_ROOT = fs.existsSync(path.join(KB_ROOT, "..", ".")) && path.basename(KB_ROOT) === "n-knowledge-base" ? path.dirname(KB_ROOT) : KB_ROOT;
const LIFE_ROOT = process.env.LIFE_ROOT || "life";
const SRC = KB_ROOT;
const warnings = [];
setLegacyPaths(process.env.LIFE_LEGACY_PATHS === "1");
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
const SKIP_DIRS = new Set(["templates", "node_modules"]);

function frontmatter(t) {
  const m = t.replace(/^\uFEFF/, "").match(/^---\r?\n([\s\S]*?)\r?\n---/); if (!m) return null;
  try { const o = yaml.load(m[1], { schema: yaml.JSON_SCHEMA }); return o && typeof o === "object" ? o : null; } catch { return undefined; }
}
// Links: kb://<path> and life://<path> (real filenames relative to that root, no %20).
// Spaces use an angle destination, [label](<kb://dir/file name>). Folders end with / (kb://backend/).
// A ")" inside the name is kept (方案(参考)). Legacy kb://<id> is resolved after the path.
// A leading n-knowledge-base/ and %20 still parse. Plus [[wikilinks]] (same root).
const WIKI_RE = /\[\[([^\]|#\n]+?)(?:#[^\]|\n]*)?(?:\|[^\]\n]*)?\]\]/g;
const ATTACH_RE = /\.(png|jpe?g|gif|webp|svg|pdf|mp4|mov|zip|enc|bin|html?|mmd|canvas|excalidraw|py|pyw|ps1|psm1|sh|bash|zsh|fish|bat|cmd|js|mjs|cjs|jsx|ts|tsx|rb|go|rs|pl|pm|lua|sql|txt|csv|tsv|toml|ini|cfg|conf|xml|css|scss|jsonl?|ya?ml|env|log|r|php|swift|kt|kts|java|c|cc|cpp|h|hpp|cs)$/i;
function linksIn(t, root) {
  const body = String(t).replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, ""); // ignore code
  const out = extractUris(body).map(m => ({ root: m.root, path: m.path, kind: "uri" }));
  for (const m of body.matchAll(WIKI_RE)) { const p = m[1].replace(/\\+$/, "").trim(); if (!p || ATTACH_RE.test(p)) continue; out.push({ root, path: p, kind: "wiki" }); }
  return out;
}
function listMd(d) { try { return fs.readdirSync(d, { recursive: true }).filter(f => String(f).endsWith(".md")).map(f => path.basename(String(f), ".md")); } catch { return []; } }
function safeDecode(x) { try { return decodeURIComponent(x); } catch { return x; } }
const records = [];
const lifeDirs = new Set();
const noteDirs = { kb: new Set(), life: new Set() };
function walk(root, d, rootName) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { const rel = path.relative(root, p).split(path.sep).join("/"); if (rel && !e.name.startsWith(".")) noteDirs[rootName].add(rel); if (rootName === "life" && rel) lifeDirs.add(rel + "/"); if (SKIP_DIRS.has(e.name)) for (const t of listMd(p)) templateNames.add(t); if (!e.name.startsWith(".") && !SKIP_DIRS.has(e.name) && path.resolve(p) !== path.resolve(DATA_DIR)) walk(root, p, rootName); continue; }
    if (/\.tar\.enc$|\.enc$/.test(e.name) || !e.name.endsWith(".md") || /^(README|AGENTS|CLAUDE)\.md$/.test(e.name) && d === root) continue;
    const text = mask(fs.readFileSync(p, "utf8")), rel = path.relative(root, p).split(path.sep).join("/");
    let f = frontmatter(text);
    if (f === undefined) { warnings.push(`unparseable frontmatter: ${rootName}://${rel}`); continue; }
    if (!f) { if (rootName !== "life") continue; f = {}; } // life notes may lack frontmatter
    if (f.type === "template" || f.status === "template") { templateNames.add(path.basename(p, ".md")); continue; }
    const asDay = v => { if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10); const s = String(v ?? ""); return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s; };
    for (const k of ["created", "updated", "date"]) if (f[k] != null) f[k] = asDay(f[k]);
    if (rootName === "life") { f.privacy = "private"; f.area ??= rel.split("/")[0]; f.status ??= "active"; f.type ??= rel.split("/")[0]; f.updated ??= fs.statSync(p).mtime.toISOString().slice(0, 10); }
    else f.privacy = f.privacy === "public" ? "public" : "private";
    f.tags = as(f.tags).map(String);
    const body = text.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
    f.title = noteDisplayTitle({ title: f.title, path: rel, text: body });
    f.slug = f.id != null ? String(f.id) : null; f.root = rootName; f.id = `${rootName}:${rel}`;
    f.origin = { source: rootName === "life" ? "n-life-data" : "n-knowledge-base", ...(f.origin || {}), source_path: rel };
    f.links = linksIn(text, rootName);
    Object.defineProperty(f, "_text", { value: body, enumerable: false });
    records.push(f);
  }
}
if (fs.existsSync(KB_ROOT)) walk(KB_ROOT, KB_ROOT, "kb"); else warnings.push(`KB root not found: ${KB_ROOT}`);
if (hasLife) walk(LIFE_ROOT, LIFE_ROOT, "life");
// resolve links: exact path, path + ".md", or unique basename match within the root.
const byId = new Map(records.map(r => [r.id, r]));
// Path first, then frontmatter id (kb://<id> / life://<id>). Built after the walk so folder dirs are known.
const linkCtx = {
  kb: linkContext(records, "kb", { dirs: noteDirs.kb, allowFolder: true, shortestBasename: true }),
  life: linkContext(records, "life", { dirs: noteDirs.life, allowFolder: false, shortestBasename: true }),
};
// Obsidian wikilinks: vault path, then the path relative to the linking note, then basename (shortest wins).
// kb:// and life:// are vault-absolute: path, life-layout aliases, folder index or (kb) folder list, id, basename.
function resolve(link, from) {
  const root = link.root;
  const norm = normalizeUriPath(link.path, { exact: true, stripVault: root === "kb" && link.kind !== "wiki" });
  const extra = [];
  if (link.kind === "wiki" && from && from.root === root) {
    const dir = path.posix.dirname(from.origin.source_path);
    const clean = norm.replace(/\.md$/i, "").replace(/\/+$/, "");
    if (dir && dir !== "." && clean) extra.push(path.posix.join(dir, clean));
  }
  if (root === "life" && legacyPaths()) extra.push(...fallbacks(norm));
  const hit = resolveUri(norm, linkCtx[root], { extraPaths: extra });
  if (hit?.file && root === "life" && legacyPaths()) {
    const stem = hit.file.replace(/\.md$/i, "");
    const primary = norm.replace(/\.md$/i, "").replace(/\/+$/, "");
    if (stem !== primary && stem !== `${primary}/index`) {
      const alts = fallbacks(norm).map(a => String(a).replace(/\.md$/i, "").replace(/\/+$/, ""));
      if (alts.some(a => stem === a || stem === `${a}/index`)) noteFallback(norm, hit.file);
    }
  }
  if (!hit) return null;
  if (hit.file) return { id: `${root}:${hit.file}`, folder: null };
  return { id: null, folder: hit.folder };
}
const resolvedOk = res => !!(res && (res.id || res.folder != null));
let broken = 0; const brokenList = [];
for (const r of records) r.links = r.links.map(l => {
  const res = resolve(l, r);
  const tpl = !resolvedOk(res) && templateNames.has(String(l.path).split("/").pop().replace(/\.md$/, "").replace(/\/+$/, ""));
  if (!resolvedOk(res) && !tpl) { broken++; brokenList.push(`${r.id} -> ${l.kind === "wiki" ? `[[${l.path}]]` : `${l.root}://${l.path}`}`); }
  return { href: l.kind === "wiki" ? `[[${l.path}]]` : `${l.root}://${l.path}`, id: res?.id || null, folder: res?.folder ?? null, kind: tpl ? "template" : l.kind };
});
const backlinks = {};
for (const r of records) for (const l of r.links) if (l.id) (backlinks[l.id] ||= []).push(r.id);
for (const r of records) r.backlinks = backlinks[r.id] || [];
// boundary (separation 2026-10): KB holds general knowledge only and must never link into life.
// Flags explicit life:// links, links that resolve to a life note, and unresolved KB wikilinks whose name matches a life note (moved out of KB).
const lifeBase = new Set(records.filter(r => r.root === "life").map(r => r.origin.source_path.replace(/\.md$/, "").split("/").pop()));
const boundary = [];
for (const r of records.filter(r => r.root === "kb")) for (const l of r.links) {
  const hit = l.id?.startsWith("life:") || l.href.startsWith("life://") || (!l.id && l.kind === "wiki" && lifeBase.has(l.href.slice(2, -2).split("/").pop().replace(/\.md$/, "")));
  if (hit) boundary.push(`${r.id} -> ${l.href}`); }
if (boundary.length) warnings.push(`boundary: ${boundary.length} KB link(s) point into life (KB must not link into life): ${boundary.slice(0, 5).join("; ")}${boundary.length > 5 ? " …" : ""}`);
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
    for (const w of V9.missingDirs) {
      if (legacyPaths()) {
        const here = p => fs.existsSync(path.join(LIFE_ROOT, String(p).replace(/\/$/, "")));
        const chosen = choosePrefixes(w, here);
        if (chosen.some(p => p.replace(/\/$/, "") !== String(w).replace(/\/$/, "") && here(p))) continue;
      }
      warnings.push(`sections.yaml: life://${w} does not exist yet (tab shows empty)`);
    }
    for (const w of tabWarnings(V9.sections)) warnings.push(w);
    if (Array.isArray(V9.modules)) for (const entry of [...V9.modules, ...(V9.views || [])]) for (const t of entry.resolved || []) if (t.missing) warnings.push(`sections.yaml: ${entry.id} references missing tab ${t.ref}`);
    if (legacyPaths()) {
      const bare = p => String(p).replace(/\.md$/i, "").replace(/\/+$/, "");
      const has = p => records.some(r => r.root === "life" && bare(r.origin.source_path) === bare(p));
      const dirs = new Set();
      for (const s of V9.sections) for (const t of s.tabs || []) for (const u of (Array.isArray(t.source) ? t.source : [])) {
        const p = String(u).replace(/^life:\/\//, "").replace(/[#?].*$/, "");
        if (p.endsWith("/")) dirs.add(p);
      }
      for (const [folder, newest, ...older] of LIFE_INDEX) {
        if (![...dirs].some(d => d === folder || folder.startsWith(d) || d.startsWith(folder))) continue;
        if (has(newest)) continue;
        const hit = older.find(has);
        if (hit) noteFallback(newest, hit);
      }
      const pins = [];
      for (const s of V9.sections) for (const t of s.tabs || []) for (const u of (Array.isArray(t.source) ? t.source : [])) {
        const p = String(u).replace(/^life:\/\//, "").replace(/[#?].*$/, "");
        if (p && !p.startsWith("data/") && !p.endsWith("/")) pins.push(p);
      }
      for (const p of pins) {
        if (has(p)) continue;
        const alt = fallbacks(p).find(has);
        if (alt) noteFallback(p, alt);
      }
      const agentDirs = dirs.size ? [...dirs].filter(d => /^(content\/x|content\/blibli|learn\/agent\/pi)\//.test(d)) : ["content/x/", "content/blibli/", "learn/agent/pi/"];
      const covered = p => lifeDirs.has(p) || [...lifeDirs].some(d => d.startsWith(p)) || has(p);
      if (agentDirs.length && agentDirs.every(d => !covered(d)) && covered("agent-ops/")) noteFallback(agentDirs.join(" "), "agent-ops/");
    }
  }
}
const shown = showPrivate ? records : records.filter(isPublic);
const views = Object.fromEntries(fs.readdirSync("views").filter(f => f.endsWith(".json"))
  .map(f => JSON.parse(fs.readFileSync(path.join("views", f), "utf8"))).map(v => [v.id, v]));

/* ---------- note bodies: Markdown -> HTML (per-note JSON, loaded on demand) + full-text index ---------- */
const noteFile = id => crypto.createHash("sha1").update(id).digest("hex").slice(0, 16);
const escH = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const href = id => `#kb/note?id=${encodeURIComponent(id)}`;
const folderHref = folder => `#kb/tree?dir=${encodeURIComponent(folder ? `kb/${folder}` : "kb")}`;
const linkHref = res => res?.id ? href(res.id) : res?.folder != null ? folderHref(res.folder) : null;
// attachments: every non-markdown file under each root (no .enc, no data/); resolved per note (relative to the note, root-relative, then unique basename).
// Resolved files go to data/attachments.json — the ONLY non-note files serve.mjs will hand out (/files/<root>/<path>, 127.0.0.1).
const ROOT_DIR = { kb: KB_ROOT, life: LIFE_ROOT };
const FILES = { kb: [], life: [] };
for (const [rt, dir] of Object.entries(ROOT_DIR)) { if (!fs.existsSync(dir)) continue;
  const w = (d, rel) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.name.startsWith(".")) continue; const rp = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) { if (!(rt === "life" && /^(data|tools|schemas)$/.test(rp))) w(path.join(d, e.name), rp); } else if (!/\.(md|enc)$/i.test(e.name)) FILES[rt].push(rp); } };
  w(dir, ""); }
const FSET = { kb: new Set(FILES.kb), life: new Set(FILES.life) }, FBASE = { kb: {}, life: {} };
for (const rt of ["kb", "life"]) for (const f of FILES[rt]) (FBASE[rt][f.split("/").pop()] ||= []).push(f);
const served = new Set(), attBroken = [];
function resolveAtt(r, target) {
  const t = safeDecode(String(target).trim().replace(/^<|>$/g, "").split(/[?#]/)[0]); if (!t || /^(https?:|mailto:|data:|#)/.test(t)) return null;
  const set = FSET[r.root], dir = path.posix.dirname(r.origin.source_path);
  for (const c of [path.posix.normalize(path.posix.join(dir, t)), t.replace(/^\/+/, "")]) if (set.has(c)) { served.add(`${r.root}/${c}`); return `../files/${r.root}/${c.split("/").map(encodeURIComponent).join("/")}`; }
  const b = FBASE[r.root][t.split("/").pop()]; if (b?.length === 1) { served.add(`${r.root}/${b[0]}`); return `../files/${r.root}/${b[0].split("/").map(encodeURIComponent).join("/")}`; }
  attBroken.push(`${r.id} -> ${t}`); return null;
}
const IMG_RE = /\.(png|jpe?g|gif|webp|svg)$/i;
const attHtml = (r, t, label) => { const u = resolveAtt(r, t), name = escH(label || String(t).split("/").pop());
  return !u ? `<span class="att broken" title="附件未找到">附件 · ${name}</span>` : IMG_RE.test(t) ? `<img class="att-img" loading="lazy" src="${u}" alt="${name}">` : `<a class="att" href="${u}" target="_blank" rel="noopener">附件 · ${name}</a>`; };
function renderNote(r) {
  const code = []; // protect code from link rewriting
  let md = r._text.replace(/```[\s\S]*?```|`[^`\n]*`/g, m => `\u0000${code.push(m) - 1}\u0000`);
  md = md.replace(/!\[\[([^\]]+)\]\]/g, (m, t) => attHtml(r, t.split("|")[0]));
  md = md.replace(/\[\[([^\]|#\n]+?)\\?(#[^\]|\n]*)?(?:\\?\|([^\]\n]*))?\]\]/g, (m, t, h, alias) => {
    const target = t.replace(/\\+$/, "").trim(), label = escH((alias || target.split("/").pop()).replace(/\\$/, ""));
    if (ATTACH_RE.test(target)) return attHtml(r, target, alias);
    const res = resolve({ root: r.root, path: target, kind: "wiki" }, r);
    const url = linkHref(res);
    return url ? `<a class="wl" href="${url}">${label}</a>` : templateNames.has(target.split("/").pop()) ? `<span class="wl tpl">${label}</span>` : `<span class="wl broken" title="未解析">${label}</span>`;
  });
  { const hits = extractUris(md); if (hits.length) { let out = "", c = 0; for (const u of hits) { if (u.from < c) continue; out += md.slice(c, u.from);
    const res = resolve({ root: u.root, path: u.path, kind: "uri" }, r), url = linkHref(res);
    const name = u.label != null ? u.label : res?.id ? (byId.get(res.id)?.title || u.path) : res?.folder != null ? (String(res.folder).split("/").pop() || "知识库") : u.raw;
    if (url && u.inLink && u.label == null && md[u.from] === "]") out += `](${url})`;
    else if (url) out += `<a class="uri" href="${url}">${escH(name)}</a>`;
    else out += `<span class="wl broken uri">${escH(u.label || u.raw)}</span>`;
    c = u.to; } md = out + md.slice(c); } }
  md = md.replace(/\u0000(\d+)\u0000/g, (m, i) => code[+i]);
  let html = marked.parse(md, { gfm: true, breaks: false });
  html = html.replace(/<(script|iframe|object|embed|style)[\s\S]*?<\/\1>/gi, "").replace(/\son\w+="[^"]*"/gi, "").replace(/href="javascript:[^"]*"/gi, 'href="#"')
    .replace(/<img\b[^>]*>/gi, m => { if (/class="att-img"/.test(m)) return m; const src = (m.match(/src="([^"]*)"/) || [])[1] || "", alt = (m.match(/alt="([^"]*)"/) || [])[1] || "";
      if (/^https?:/.test(src)) return `<span class="att">图片${alt ? " · " + alt : ""}</span>`; // no remote fetches
      const u = resolveAtt(r, src.replace(/&amp;/g, "&")); return u ? `<img class="att-img" loading="lazy" src="${u}" alt="${alt}">` : `<span class="att broken" title="附件未找到">图片${alt ? " · " + alt : ""}</span>`; })
    .replace(/<a href="(?!#|https?:|mailto:|\.\.\/files\/)([^"]*)"/g, (m, h) => { const t = h.replace(/&amp;/g, "&"); if (/\.md$/i.test(safeDecode(t.split("#")[0])) || !/\.[A-Za-z0-9]{1,6}$/.test(safeDecode(t.split(/[?#]/)[0]))) return '<a class="att" data-local="' + h + '"';
      const u = resolveAtt(r, t); return u ? `<a class="att" target="_blank" rel="noopener" href="${u}"` : `<a class="att broken" title="附件未找到" data-local="${h}"`; });
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
    maturity: r.maturity ?? null, tags: r.tags, updated: r.updated ?? null, date: /^\d{4}-\d{2}-\d{2}/.test(String(r.date || "")) ? String(r.date).slice(0, 10) : (r.updated ?? null), links: r.links.filter(l => l.id).map(l => l.id), backlinks: r.backlinks, text: plain(r._text).slice(0, 30000) });
}
fs.writeFileSync(path.join(OUT, "kb-index.json"), JSON.stringify(kbIndex)); // KB only (知识)
fs.writeFileSync(path.join(OUT, "life-index.json"), JSON.stringify(lifeIndex)); // life notes (生活 / 记录 / 计划)
for (const f of FILES.life) if (!/^templates\//.test(f)) served.add(`life/${f}`); // folder pages link every life attachment (生活 / 记录 file rows)
fs.writeFileSync(path.join(OUT, "attachments.json"), JSON.stringify([...served].sort())); // serve.mjs allowlist
if (attBroken.length) warnings.push(`attachments: ${attBroken.length} reference(s) not found: ${[...new Set(attBroken)].slice(0, 6).join("; ")}${attBroken.length > 6 ? " …" : ""}`);

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
    data_files: dataFiles.filter(d => d.root === "life"), expects: V9 ? [...new Set(V9.sections.flatMap(x => (x.tabs || []).flatMap(t => Array.isArray(t.source) ? t.source : [])).filter(u => /\/$/.test(String(u))).map(u => String(u).slice(7)))] : ["data/*.yaml"], schema_version: V9 ? 9 : 8 },
  { id: "kb", name: "n-knowledge-base", role: "secondary", kind: "git", present: fs.existsSync(KB_ROOT), meta: readMeta(KB_REPO_ROOT) || readMeta(KB_ROOT), notes: records.filter(r => r.root === "kb").length, privacy: "按 frontmatter privacy",
    data_files: dataFiles.filter(d => d.root === "kb"), expects: ["n-knowledge-base/**.md"] },
  { id: "x", name: "X (@handle)", role: "reserved", kind: "api", present: false, meta: null, notes: 0, privacy: "—", data_files: [], expects: ["posts / followers 快照（未接入）"] },
  { id: "bilibili", name: "Bilibili", role: "reserved", kind: "api", present: false, meta: null, notes: 0, privacy: "—", data_files: [], expects: ["视频 / 粉丝快照（未接入）"] },
];

const lite = shown.map(r => ({ id: r.id, slug: r.slug, f: r.file, title: r.title, root: r.root, area: r.area ?? null, type: r.type ?? null, status: r.status ?? null, maturity: r.maturity ?? null,
  tags: r.tags, updated: r.updated ?? null, origin: { source_path: r.origin.source_path }, privacy: r.privacy }));
const bundle = { generated: new Date().toISOString(), show_private: showPrivate, kb_ref: sources[1].meta?.ref || process.env.KB_REF || null, life_ref: hasLife ? (sources[0].meta?.ref || process.env.LIFE_REF || "main") : null,
  life_legacy_paths: legacyPaths(),
  roots: { kb: fs.existsSync(KB_ROOT), life: hasLife }, broken_links: broken, broken_list: brokenList.slice(0, 200),
  missing, warnings, boundary, attachments: { served: served.size, broken: [...new Set(attBroken)].slice(0, 100), files: { kb: FILES.kb.length, life: FILES.life.length } }, records: lite, private_hidden: records.length - shown.length, modules, sources };
bundle.overview = overview(bundle, views.today);
const TOPICS = V9 ? loadTopics(LIFE_ROOT, w => warnings.push(w)) : [];
// topic refs: every kb:// / life:// ref must resolve; KB notes may only appear as resources (a narrative is always life://).
for (const t of TOPICS) {
  const refs = [t.narrative, ...(t.resources || []).map(x => x.ref), ...Object.values(t.links || {}).flat(), ...t.entries.flatMap(e => [e.ref, e.source])].filter(u => /^<?(kb|life):\/\//.test(String(u ?? "").trim()));
  const bad = [...new Set(refs.filter(u => { let s = String(u).trim(); if (s.startsWith("<") && s.endsWith(">")) s = s.slice(1, -1).trim(); const m = s.match(/^(kb|life):\/\/([\s\S]+)$/); return !(m && m[2] && resolvedOk(resolve({ root: m[1], path: m[2], kind: "uri" }))); }))];
  if (bad.length) warnings.push(`topics: ${t.id}: ${bad.length} unresolved ref(s): ${bad.slice(0, 4).join("; ")}`);
  if (/^kb:\/\//.test(t.narrative ?? "")) warnings.push(`topics: ${t.id}: narrative is a KB note (topics link to KB as resources only)`);
}
if (V9) bundle.v9 = { schema_version: 9, topics: TOPICS, groups: V9.groups, plans: V9.plans, reviews: V9.reviews, sections: V9.sections, modules: V9.modules, views: V9.views, nav: V9.nav, absorbed: V9.absorbed, missing_dirs: V9.missingDirs, files: V9.files, dirs: [...lifeDirs].sort(), updated: V9.updated };
const timeline = buildTimeline({ records: shown, topics: TOPICS, tasks: V9?.tasks || [], reviews: V9?.reviews || [], modules: V9?.modules || [] });
const timelineStat = timelineCounts(timeline);
for (const w of drainFallbackWarnings()) if (!warnings.includes(w)) warnings.push(w);
fs.writeFileSync(path.join(OUT, "bundle.json"), JSON.stringify(bundle));
fs.writeFileSync(path.join(OUT, "timeline.json"), JSON.stringify(timeline));
const today = todayStamp();
const rollups = buildRollups({ events: timeline, tasks: V9?.tasks || [], plans: V9?.plans || [], reviews: V9?.reviews || [], today });
const coverage = buildCoverage({ events: timeline, topics: TOPICS, modules: V9?.modules || [], reviews: V9?.reviews || [], today });
fs.writeFileSync(path.join(OUT, "rollups.json"), JSON.stringify(rollups));
fs.writeFileSync(path.join(OUT, "coverage.json"), JSON.stringify(coverage));
const size = f => (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0) + " KB";
console.log(`roots: kb=${fs.existsSync(KB_ROOT)} (${sources[1].meta?.commit?.slice(0, 7) ?? "?"}) life=${hasLife} (${sources[0].meta?.commit?.slice(0, 7) ?? "?"}); links ${records.reduce((a, r) => a + r.links.length, 0)} (${broken} unresolved)`);
console.log(`notes: ${records.length} (kb ${records.filter(r => r.root === "kb").length}, life ${records.filter(r => r.root === "life").length}); ${shown.length} included, private ${showPrivate ? "SHOWN" : "hidden"}`);
console.log(`files: bundle.json ${size("bundle.json")}, kb-index.json ${size("kb-index.json")} (${kbIndex.length}), life-index.json ${size("life-index.json")} (${lifeIndex.length}), timeline.json ${size("timeline.json")} (${timeline.length}), rollups.json ${size("rollups.json")}, coverage.json ${size("coverage.json")}, notes/ ${kbIndex.length + lifeIndex.length} files`);
console.log(V9 ? `v9: ${V9.accounts.length} accounts · ${V9.groups.length} groups · ${V9.subscriptions.length} subs (${V9.subscriptions.filter(x => x.account_id).length} linked) · ${V9.tasks.length} tasks · ${V9.plans.length} plans · ${V9.reviews.length} reviews · ${V9.sections.length} sections · ${V9.modules ? `${V9.modules.length} modules` : "no modules"} · ${(V9.views || []).length} views` : "v8 data (schema_version != 9)");
console.log(`data: ${dataFiles.map(d => `${d.name}=${d.root ?? "missing"}:${d.items}`).join(" ")}`);
console.log(`attachments: ${served.size} resolved (${FILES.life.length} life / ${FILES.kb.length} kb files), ${attBroken.length} missing; boundary kb→life: ${boundary.length}`);
console.log(`overview: ${bundle.overview.upcoming.length} upcoming, ${bundle.overview.alerts.length} alerts`);
console.log(`timeline: ${timelineStat.total} events · ${Object.entries(timelineStat.byModule).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(" · ")} · touch ${timelineStat.touch}`);
const built = analysisStats(rollups, coverage);
console.log(built.line);
console.log(built.coverage);
const cmp = comparePeriods({ events: timeline, modules: V9?.modules || [], topics: TOPICS, today, kind: "month" });
const effort = effortMonths({ events: timeline, modules: V9?.modules || [], today });
const instances = (V9?.reviews || []).flatMap(r => (r.instances || []).map(i => instanceStatus({ ...i, due: dueEnd(i.due) || i.due }, today)));
console.log(`compare: ${cmp.current.key} vs ${cmp.previous.key} · yoy ${cmp.yoy ? cmp.yoy.key : "none"} · effort ${effort.months.length} months`);
console.log(`reviews: ${instances.length} instances · done ${instances.filter(s => s === "done").length} · open ${instances.filter(s => s === "open").length} · overdue ${instances.filter(s => s === "overdue").length}`);
for (const w of warnings) console.warn("warn:", w);
