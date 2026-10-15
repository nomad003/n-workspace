// Parse KB markdown frontmatter into data/records.json (gitignored).
// Privacy is decided ONLY by frontmatter `privacy: public`; missing/other => private (hidden unless SHOW_PRIVATE=1).
import fs from "node:fs"; import path from "node:path"; import * as yaml from "js-yaml";
import { select, isPublic } from "../app/src/filter.js";
const SRC = process.env.KB_DEST || (fs.existsSync("kb/n-knowledge-base") ? "kb/n-knowledge-base" : "kb"), OUT = "data";
const showPrivate = process.env.SHOW_PRIVATE === "1";
const all = [], skipped = [];
function fm(t) {
  const m = t.replace(/^\uFEFF/, "").match(/^---\r?\n([\s\S]*?)\r?\n---/); if (!m) return null;
  try { const o = yaml.load(m[1], { schema: yaml.JSON_SCHEMA }); return o && typeof o === "object" ? o : null; } // dates stay strings
  catch { return undefined; }
}
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!e.name.startsWith(".")) walk(p); continue; }
    if (!e.name.endsWith(".md")) continue;
    const f = fm(fs.readFileSync(p, "utf8"));
    if (f === undefined) { skipped.push(path.relative(SRC, p)); continue; }
    if (!f) continue;
    if (f.type === "template" || f.status === "template") continue;
    for (const k of ["created", "updated"]) if (f[k] != null) f[k] = String(f[k]);
    f.privacy = f.privacy === "public" ? "public" : "private";
    f.tags = f.tags == null ? [] : (Array.isArray(f.tags) ? f.tags : [f.tags]).map(String);
    f.title = f.title || path.basename(p, ".md");
    f.origin = { source: "n-knowledge-base", ...(f.origin || {}), source_path: path.relative(SRC, p) };
    all.push(f);
  }
}
walk(SRC);
const recs = showPrivate ? all : all.filter(isPublic);
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "records.json"), JSON.stringify(recs));
const stats = { total: all.length, private: all.filter(r => !isPublic(r)).length, views: {} };
for (const v of fs.readdirSync("views").filter(f => f.endsWith(".json"))) {
  const view = JSON.parse(fs.readFileSync(path.join("views", v)));
  const total = select(all, view).length, shown = select(recs, view).length;
  stats.views[v.replace(".json", "")] = { total, shown, private_hidden: showPrivate ? 0 : select(all.filter(r => !isPublic(r)), view).length };
}
fs.writeFileSync(path.join(OUT, "stats.json"), JSON.stringify(stats));
console.log(`${all.length} records, ${recs.length} written (private ${showPrivate ? "shown" : "hidden"})` + (skipped.length ? `; unparseable: ${skipped.join(", ")}` : ""));
console.log(JSON.stringify(stats.views));
