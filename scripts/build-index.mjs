// Build data/bundle.json (gitignored) from the KB: notes frontmatter + n-knowledge-base/data/*.yaml.
// Local builds include private records by default (personal tool). Opt out with SHOW_PRIVATE=0.
import fs from "node:fs"; import path from "node:path"; import * as yaml from "js-yaml";
import { toItems, normalize, isPublic, match, overview } from "../app/src/core.js";

const SRC = process.env.KB_DEST || (fs.existsSync("kb/n-knowledge-base") ? "kb/n-knowledge-base" : "kb");
// KB keeps data/ at the repo root (kb/data); older layouts put it inside the vault.
const DATA_DIR = process.env.KB_DATA_DIR || ["kb/data", path.join(SRC, "data")].find(d => fs.existsSync(d)) || path.join(SRC, "data");
const OUT = "data";
const showPrivate = process.env.SHOW_PRIVATE !== "0";
const MODULE_FILES = ["accounts", "subscriptions", "finance", "profile", "tasks", "content"];
const warnings = [];

function frontmatter(t) {
  const m = t.replace(/^\uFEFF/, "").match(/^---\r?\n([\s\S]*?)\r?\n---/); if (!m) return null;
  try { const o = yaml.load(m[1], { schema: yaml.JSON_SCHEMA }); return o && typeof o === "object" ? o : null; } catch { return undefined; }
}
const records = [];
(function walk(d) {
  if (!fs.existsSync(d)) { warnings.push(`KB folder not found: ${d}`); return; }
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!e.name.startsWith(".") && p !== DATA_DIR) walk(p); continue; }
    if (!e.name.endsWith(".md") || e.name === "README.md" && d === DATA_DIR) continue;
    const f = frontmatter(fs.readFileSync(p, "utf8"));
    if (f === undefined) { warnings.push(`unparseable frontmatter: ${path.relative(SRC, p)}`); continue; }
    if (!f || f.type === "template" || f.status === "template") continue;
    for (const k of ["created", "updated"]) if (f[k] != null) f[k] = String(f[k]);
    f.privacy = f.privacy === "public" ? "public" : "private";
    f.tags = as(f.tags).map(String);
    f.title = f.title || path.basename(p, ".md");
    f.origin = { source: "n-knowledge-base", ...(f.origin || {}), source_path: path.relative(SRC, p) };
    records.push(f);
  }
})(SRC);
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
  const file = ["yaml", "yml"].map(x => path.join(DATA_DIR, `${name}.${x}`)).find(f => fs.existsSync(f));
  if (!file) { missing.push(`${name}.yaml`); modules[name] = { items: [], source: null }; continue; }
  let doc;
  try { doc = yaml.load(fs.readFileSync(file, "utf8")); } catch (e) { warnings.push(`${name}: YAML error ${e.message.split("\n")[0]}`); doc = null; }
  if (name === "profile") {
    const data = doc && typeof doc === "object" && !Array.isArray(doc) ? normalize(doc, "profile") : {};
    if (data.documents) data.documents = as(data.documents).map(x => normalize(x, "doc"));
    for (const k of ["privacy", "updated", "sources"]) delete data[k];
    modules[name] = { data: showPrivate || doc?.privacy === "public" ? data : {}, items: [], source: path.relative(".", file) };
  } else {
    const filePrivacy = doc && !Array.isArray(doc) ? doc.privacy : undefined; // file-level privacy applies to items without their own
    let all = toItems(doc, name).map(x => ({ ...x, privacy: x.privacy ?? filePrivacy ?? "private" }));
    const extra = {};
    if (name === "finance" && doc && !Array.isArray(doc)) {
      if (doc.snapshot && typeof doc.snapshot === "object") extra.snapshot = normalize(doc.snapshot, "snapshot");
      extra.summary = financeSummary(all);
    }
    modules[name] = { ...extra, items: showPrivate ? all : all.filter(isPublic), hidden: showPrivate ? 0 : all.filter(x => !isPublic(x)).length, source: path.relative(".", file), updated: doc?.updated ? String(doc.updated instanceof Date ? doc.updated.toISOString().slice(0, 10) : doc.updated) : null };
  }
}
const shown = showPrivate ? records : records.filter(isPublic);
const views = Object.fromEntries(fs.readdirSync("views").filter(f => f.endsWith(".json"))
  .map(f => JSON.parse(fs.readFileSync(path.join("views", f), "utf8"))).map(v => [v.id, v]));
const bundle = { generated: new Date().toISOString(), show_private: showPrivate, kb_ref: process.env.KB_REF || null,
  data_dir: DATA_DIR, missing, warnings, records: shown,
  private_hidden: records.length - shown.length, modules };
bundle.overview = overview(bundle, views.overview);
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "bundle.json"), JSON.stringify(bundle));
console.log(`notes: ${records.length} (${shown.length} included, private ${showPrivate ? "SHOWN" : "hidden"})`);
for (const [id, v] of Object.entries(views)) if (v.notes) console.log(`  ${id}: ${shown.filter(r => match(r, v.notes)).length} notes`);
console.log(`data: ${MODULE_FILES.map(n => `${n}=${modules[n].source ? (modules[n].items.length || Object.keys(modules[n].data || {}).length) : "missing"}`).join(" ")}`);
console.log(`overview: ${bundle.overview.upcoming.length} upcoming, ${bundle.overview.alerts.length} alerts`);
for (const w of warnings) console.warn("warn:", w);
