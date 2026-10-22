// Check kb:// targets. Prints totals only (no paths) unless KB_LINK_DETAILS=1.
// Self-test always runs. A corpus check runs when KB_ROOT, LIFE_ROOT and data/*-index.json
// are from the same build (the indexes are the notes that build actually emitted).
//
//   KB_ROOT=… LIFE_ROOT=… node scripts/build-index.mjs
//   KB_ROOT=… LIFE_ROOT=… node scripts/check-kb-links.mjs
import fs from "node:fs";
import path from "node:path";
import * as yaml from "js-yaml";
import { extractUris, linkContext, normalizeUriPath, resolveUri } from "../app/src/kb-uri.js";

const details = process.env.KB_LINK_DETAILS === "1";
const fail = (msg) => { console.error(msg); process.exit(1); };
const assert = (cond, msg) => { if (!cond) fail("self-test: " + msg); };

function trimLoose(s) {
  let out = s.replace(/[.,;:]+$/u, "");
  while (out.endsWith("）") && (out.match(/）/g) || []).length > (out.match(/（/g) || []).length) out = out.slice(0, -1);
  return out;
}
function normPath(raw, root) {
  let s = String(raw ?? "").trim().replace(/\\(.)/g, "$1");
  try { s = decodeURIComponent(s); } catch { /* keep */ }
  s = s.trim().replace(/^\/+/, "").replace(/^\.\//, "");
  if (root === "kb") s = s.replace(/^n-knowledge-base\//, "");
  const cut = s.search(/[?#]/);
  if (cut >= 0) s = s.slice(0, cut);
  return s.replace(/\/{2,}/g, "/");
}
const STOP = new Set([..." \t\n\r]\"'`<>|，。；"]);
// Independent of extractUris: angle brackets, balanced "()", folders keep their slash.
function scanUris(text) {
  const s = String(text), out = [];
  for (let i = 0; i < s.length; i++) {
    const kb = s.startsWith("kb://", i), life = s.startsWith("life://", i);
    if (!kb && !life) continue;
    if (i > 0 && /[A-Za-z0-9_]/.test(s[i - 1])) continue;
    const root = kb ? "kb" : "life";
    const pathStart = i + root.length + 3;
    const angled = i > 0 && s[i - 1] === "<" && s.indexOf(">", pathStart) >= 0;
    let raw;
    if (angled) {
      const gt = s.indexOf(">", pathStart);
      raw = s.slice(pathStart, gt);
      i = gt;
    } else {
      let j = pathStart, depth = 0;
      while (j < s.length) {
        const c = s[j];
        if (c === "\\") { j += 2; continue; }
        if (c === "(") { depth++; j++; continue; }
        if (c === ")") { if (depth === 0) break; depth--; j++; continue; }
        if (STOP.has(c)) break;
        j++;
      }
      raw = trimLoose(s.slice(pathStart, j));
      i = pathStart + raw.length - 1;
    }
    const path = normPath(raw, root);
    if (path) out.push({ root, path });
  }
  return out;
}
function stripCode(t) { return String(t).replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, ""); }
function bodyOf(t) {
  const m = String(t).replace(/^\uFEFF/, "").match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  return m ? t.slice(m[0].length) : t;
}

// --- self-test (fictional strings only) ---
const fixtures = [
  ["见 [gRPC Args](<kb://backend/network/gRPC/gRPC Args>)。", "kb", "backend/network/gRPC/gRPC Args"],
  ["对照：[限流方案(参考)](kb://backend/architecture/限流方案(参考))。", "kb", "backend/architecture/限流方案(参考)"],
  ["也见 kb://backend/architecture/限流方案(参考)。", "kb", "backend/architecture/限流方案(参考)"],
  ["目录：kb://backend/。", "kb", "backend/"],
  ["这一页在目录 kb://math/ 里", "kb", "math/"],
  ["kb://cs/哈希表", "kb", "cs/哈希表"],
  ["kb://n-knowledge-base/cs/哈希表", "kb", "cs/哈希表"],
  ["kb://backend/network/gRPC/gRPC%20Args", "kb", "backend/network/gRPC/gRPC Args"],
  ["（kb://cs/所有权与借用）", "kb", "cs/所有权与借用"],
  ["life://life/health/index", "life", "life/health/index"],
  ["notkb://skip", null, null],
];
for (const [text, root, want] of fixtures) {
  const a = extractUris(stripCode(text)).filter(u => u.path);
  const b = scanUris(stripCode(text));
  if (!want) { assert(a.length === 0 && b.length === 0, "unexpected hit in " + text); continue; }
  assert(a.length === 1 && a[0].root === root && a[0].path === want, "extract " + text);
  assert(b.length === 1 && b[0].root === root && b[0].path === want, "scan " + text);
}
const two = "kb://cs/哈希表 与 kb://math/";
assert(scanUris(two).map(u => u.path).join("|") === "cs/哈希表|math/", "two links");
const code = "see `kb://cs/哈希表` and\n```\nkb://math/\n```\nkb://tools/写作工作流";
assert(scanUris(stripCode(code)).map(u => u.path).join("|") === "tools/写作工作流", "code ignored");
{
  const files = new Set(["b.md", "a.md", "backend/index.md", "math/梯度下降.md", "backend/architecture/限流方案(参考).md", "backend/network/gRPC/gRPC Args.md", "cs/哈希表.md"]);
  const ids = new Map([["b", "a.md"], ["cs/hash-table", "cs/哈希表.md"]]);
  const dirs = new Set(["backend", "math", "cs", "backend/architecture", "backend/network", "backend/network/gRPC"]);
  const bases = new Map();
  for (const f of files) { const base = f.replace(/\.md$/i, "").split("/").pop(); const xs = bases.get(base) || []; xs.push(f); bases.set(base, xs); }
  const ctx = { files, ids, dirs, basenames: bases, allowFolder: true, shortestBasename: true };
  assert(resolveUri("b", ctx).file === "b.md", "path wins over id");
  assert(resolveUri("backend/", ctx).file === "backend/index.md", "folder index");
  assert(resolveUri("math/", ctx).folder === "math", "folder list");
  assert(resolveUri("backend/architecture/限流方案(参考)", ctx).file.endsWith("限流方案(参考).md"), "parens");
  assert(resolveUri("backend/network/gRPC/gRPC Args", ctx).file.endsWith("gRPC Args.md"), "spaces");
  assert(resolveUri(normalizeUriPath("cs/hash-table"), ctx).file === "cs/哈希表.md", "id fallback");
  const built = linkContext([{ root: "kb", slug: "cs/hash-table", origin: { source_path: "cs/哈希表.md" } }], "kb", { allowFolder: true });
  assert(resolveUri("cs/哈希表", built).file === "cs/哈希表.md", "linkContext path");
  assert(resolveUri("cs/hash-table", built).file === "cs/哈希表.md", "linkContext id");
}
console.log("self-test ok");

const KB_ROOT = process.env.KB_ROOT || (fs.existsSync("kb/n-knowledge-base") ? "kb/n-knowledge-base" : "kb");
const LIFE_ROOT = process.env.LIFE_ROOT || "life";
const kbIdxPath = "data/kb-index.json", lifeIdxPath = "data/life-index.json", bundlePath = "data/bundle.json";
if (!fs.existsSync(kbIdxPath) || !fs.existsSync(bundlePath)) {
  console.log("no build index; self-test only");
  process.exit(0);
}

const kbIdx = JSON.parse(fs.readFileSync(kbIdxPath, "utf8"));
const lifeIdx = fs.existsSync(lifeIdxPath) ? JSON.parse(fs.readFileSync(lifeIdxPath, "utf8")) : [];
const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));
const notes = [...kbIdx, ...lifeIdx];
const byKey = new Map(notes.map(n => [`${n.root}:${n.path}`, n]));
function fsDirs(root) {
  const out = new Set();
  const walk = (d, rel) => {
    let ents = [];
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      if (e.name.startsWith(".") || e.name === "node_modules" || e.name === "templates") continue;
      if (!e.isDirectory()) continue;
      const next = rel ? `${rel}/${e.name}` : e.name;
      out.add(next);
      walk(path.join(d, e.name), next);
    }
  };
  if (fs.existsSync(root)) walk(root, "");
  return out;
}
function indexOf(rootName) {
  const rows = notes.filter(n => n.root === rootName);
  const files = new Set(rows.map(n => n.path));
  const ids = new Map();
  for (const n of rows) if (n.slug) ids.set(String(n.slug).toLowerCase(), n.path);
  const dirs = rootName === "kb" ? fsDirs(KB_ROOT) : fsDirs(LIFE_ROOT);
  for (const f of files) {
    const parent = f.split("/").slice(0, -1);
    let acc = "";
    for (const seg of parent) { acc = acc ? `${acc}/${seg}` : seg; dirs.add(acc); }
  }
  return { files, ids, dirs };
}
const ix = { kb: indexOf("kb"), life: indexOf("life") };
function noteHref(root, file) { return `#kb/note?id=${encodeURIComponent(`${root}:${file}`)}`; }
function treeHref(folder) { return `#kb/tree?dir=${encodeURIComponent(folder ? `kb/${folder}` : "kb")}`; }
function expectTarget(root, raw) {
  const spec = ix[root]; if (!spec) return { ok: false };
  const p = normPath(raw, root);
  if (!p) return { ok: false };
  const isDir = p.endsWith("/");
  const clean = p.replace(/\.md$/i, "").replace(/\/+$/, "");
  const tryFile = (c) => !c ? null : spec.files.has(c) ? c : spec.files.has(c + ".md") ? c + ".md" : null;
  if (isDir) {
    const index = tryFile(clean ? `${clean}/index` : "index");
    if (index) return { ok: true, href: noteHref(root, index) };
    const has = clean && (spec.dirs.has(clean) || [...spec.files].some(f => f.startsWith(clean + "/")));
    if (root === "kb" && has) return { ok: true, href: treeHref(clean) };
    return { ok: false };
  }
  const file = tryFile(clean);
  if (file) return { ok: true, href: noteHref(root, file) };
  const id = spec.ids.get(clean.toLowerCase());
  if (id) return { ok: true, href: noteHref(root, id) };
  const base = clean.split("/").pop();
  const hits = [...spec.files].filter(f => f.replace(/\.md$/i, "").split("/").pop() === base).sort((a, b) => a.length - b.length);
  if (hits.length) return { ok: true, href: noteHref(root, hits[0]) };
  return { ok: false };
}
function htmlTokens(html) {
  const out = [];
  const re = /<a class="uri" href="([^"]*)"|<span class="wl broken uri">/g;
  let m; while ((m = re.exec(html))) out.push(m[1] != null ? { ok: true, href: m[1].replace(/&amp;/g, "&") } : { ok: false });
  return out;
}
const stat = { kb: 0, kbUnresolved: 0, kbMis: 0, lifeBad: 0 };
const problems = [];
function tally(root, expected, actual, where) {
  if (root !== "kb") {
    if (expected.ok && (!actual || !actual.ok || actual.href !== expected.href)) stat.lifeBad++;
    return;
  }
  stat.kb++;
  if (!expected.ok || !actual || !actual.ok) { stat.kbUnresolved++; if (details) problems.push("unresolved " + where); return; }
  if (actual.href !== expected.href) { stat.kbMis++; if (details) problems.push("misresolved " + where); }
}
function considerRendered(rootName, rel, text) {
  const note = byKey.get(`${rootName}:${rel}`);
  const bodyLinks = scanUris(stripCode(bodyOf(text)));
  if (note) {
    let html = "";
    try { html = JSON.parse(fs.readFileSync(path.join("data", "notes", note.f + ".json"), "utf8")).html || ""; } catch { html = ""; }
    const tokens = htmlTokens(html);
    if (tokens.length !== bodyLinks.length) {
      for (const u of bodyLinks) if (u.root === "kb") { stat.kb++; stat.kbMis++; }
      if (details) problems.push("token count " + rootName);
      return;
    }
    bodyLinks.forEach((u, i) => tally(u.root, expectTarget(u.root, u.path), tokens[i], rootName));
  } else {
    for (const u of bodyLinks) if (u.root === "kb") tally("kb", expectTarget("kb", u.path), expectTarget("kb", u.path).ok ? { ok: true, href: expectTarget("kb", u.path).href } : { ok: false }, rootName);
  }
  // frontmatter strings (not rendered): still have to resolve
  const fm = String(text).replace(/^\uFEFF/, "").match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return;
  let doc = null; try { doc = yaml.load(fm[1]); } catch { return; }
  const extra = [];
  const walk = (v) => { if (typeof v === "string") extra.push(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === "object") Object.values(v).forEach(walk); };
  walk(doc);
  for (const s of extra) for (const u of linksInValue(s)) if (u.root === "kb") tally("kb", expectTarget("kb", u.path), { ok: expectTarget("kb", u.path).ok, href: expectTarget("kb", u.path).href }, "fm");
}
function linksInValue(s) {
  const t = String(s).trim();
  let bare = t;
  if (bare.startsWith("<") && bare.endsWith(">")) bare = bare.slice(1, -1).trim();
  if (/^(kb|life):\/\//.test(bare) && !bare.includes("](") && !/[\n\r]/.test(bare)) {
    const m = bare.match(/^(kb|life):\/\/([\s\S]*)$/);
    const path = m && normPath(m[2], m[1]);
    return path ? [{ root: m[1], path }] : [];
  }
  return scanUris(stripCode(t));
}
function walkTree(rootDir, rootName) {
  const walk = (d, rel) => {
    let ents = [];
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      if (e.name.startsWith(".") || e.name === "node_modules" || e.name === "templates") continue;
      const next = rel ? `${rel}/${e.name}` : e.name;
      const p = path.join(d, e.name);
      if (e.isDirectory()) { walk(p, next); continue; }
      const lower = e.name.toLowerCase();
      if (lower.endsWith(".md")) considerRendered(rootName, next, fs.readFileSync(p, "utf8"));
      else if (/\.(ya?ml|jsonl?)$/i.test(e.name)) {
        const text = fs.readFileSync(p, "utf8");
        const values = [];
        if (lower.endsWith(".jsonl")) {
          for (const line of text.split(/\n/)) { if (!line.trim()) continue; try { const walk = (v) => { if (typeof v === "string") values.push(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === "object") Object.values(v).forEach(walk); }; walk(JSON.parse(line)); } catch { /* skip */ } }
        } else if (lower.endsWith(".json")) {
          try { const walk = (v) => { if (typeof v === "string") values.push(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === "object") Object.values(v).forEach(walk); }; walk(JSON.parse(text)); } catch { /* skip */ }
        } else {
          try { const walk = (v) => { if (typeof v === "string") values.push(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === "object") Object.values(v).forEach(walk); }; walk(yaml.load(text)); } catch { /* skip */ }
        }
        for (const s of values) for (const u of linksInValue(s)) if (u.root === "kb") {
          const exp = expectTarget("kb", u.path);
          tally("kb", exp, exp.ok ? { ok: true, href: exp.href } : { ok: false }, "data");
        }
      }
    }
  };
  if (fs.existsSync(rootDir)) walk(rootDir, "");
}
if (fs.existsSync(KB_ROOT)) walkTree(KB_ROOT, "kb");
if (fs.existsSync(LIFE_ROOT)) walkTree(LIFE_ROOT, "life");
let topicBad = 0;
for (const w of bundle.warnings || []) { const m = String(w).match(/(\d+) unresolved ref/); if (m && String(w).startsWith("topics:")) topicBad += +m[1]; }
if (topicBad) stat.kbUnresolved += topicBad;
console.log(`kb:// checked=${stat.kb} unresolved=${stat.kbUnresolved} misresolved=${stat.kbMis}`);
if (stat.lifeBad) console.log(`life:// regressions=${stat.lifeBad}`);
if (details) for (const p of problems) console.error(p);
if (stat.kbUnresolved || stat.kbMis || stat.lifeBad) process.exit(1);
