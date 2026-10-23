// kb:// and life:// link text. Paths are real filenames (Chinese allowed), not percent-encoded.
// Spaces belong in an angle-bracket destination: [label](<kb://dir/file name>).
// A trailing slash is a folder. Legacy kb://n-knowledge-base/<path> and %20 still parse.
// Bracket-aware: a ")" inside the path (方案(参考)) is part of the name.

export function safeDecode(x) {
  try { return decodeURIComponent(x); } catch { return x; }
}

function escapedAt(s, i) {
  let n = 0;
  for (let j = i - 1; j >= 0 && s[j] === "\\"; j--) n++;
  return n % 2 === 1;
}

// Index of the '[' that opens the markdown label ending at `bracket` (the ']').
function findLabelStart(s, bracket) {
  let depth = 1;
  const stop = Math.max(0, bracket - 500);
  for (let i = bracket - 1; i >= stop; i--) {
    if (s[i] === "\n") return null;
    if (escapedAt(s, i)) continue;
    if (s[i] === "]") depth++;
    else if (s[i] === "[") { depth--; if (depth === 0) return i; }
  }
  return null;
}

// Drop sentence punctuation that is not part of a filename. Balanced （） stay.
function trimLoose(s) {
  let out = s.replace(/[.,;:]+$/u, "");
  const open = (out.match(/（/g) || []).length;
  let close = (out.match(/）/g) || []).length;
  while (close > open && out.endsWith("）")) { out = out.slice(0, -1); close--; }
  return out;
}

/**
 * Normalize a path captured after "kb://" / "life://".
 * `exact` (angle-bracket form) keeps trailing punctuation; the ">" already ended the path.
 * `stripVault` removes a legacy "n-knowledge-base/" prefix (kb links only).
 */
export function normalizeUriPath(raw, { exact = false, stripVault = false } = {}) {
  let s = String(raw ?? "").trim();
  if (!exact) s = s.replace(/\\(.)/g, "$1");
  s = safeDecode(s).trim();
  s = s.replace(/^\/+/, "").replace(/^\.\//, "");
  if (stripVault) s = s.replace(/^n-knowledge-base\//, "");
  const cut = s.search(/[?#]/);
  if (cut >= 0) s = s.slice(0, cut);
  s = s.replace(/\/{2,}/g, "/");
  if (!exact) s = trimLoose(s);
  return s;
}

const STOP = /[\s\]"'`<>|]/;

/**
 * kb:// and life:// occurrences in `text` (caller strips code fences).
 * Each hit covers the whole markdown link when it is one:
 *   [label](kb://path)  [label](<kb://path with spaces>)  <kb://auto>  kb://bare
 * `path` keeps a trailing "/" for folders and may contain spaces and parentheses.
 */
export function extractUris(text) {
  const s = String(text), out = [];
  for (let i = 0; i < s.length; i++) {
    const kb = s.startsWith("kb://", i), life = s.startsWith("life://", i);
    if (!kb && !life) continue;
    if (i > 0 && /[A-Za-z0-9_]/.test(s[i - 1])) continue;
    const root = kb ? "kb" : "life";
    const pathStart = i + root.length + 3;
    let angled = i > 0 && s[i - 1] === "<";
    const inLink = angled ? i >= 3 && s.slice(i - 3, i - 1) === "](" : i >= 2 && s.slice(i - 2, i) === "](";
    let rawEnd, gt = -1;
    if (angled) {
      gt = s.indexOf(">", pathStart);
      if (gt < 0) angled = false;
    }
    if (angled) rawEnd = gt;
    else {
      let j = pathStart, depth = 0;
      while (j < s.length) {
        const c = s[j];
        if (c === "\\") { j += 2; continue; }
        if (c === "(") { depth++; j++; continue; }
        if (c === ")") { if (depth === 0) break; depth--; j++; continue; }
        if (c === "\n" || STOP.test(c) || "，。；".includes(c)) break;
        j++;
      }
      const slice = s.slice(pathStart, j);
      rawEnd = pathStart + trimLoose(slice).length;
    }
    const path = normalizeUriPath(s.slice(pathStart, rawEnd), { exact: angled, stripVault: root === "kb" });
    let from = i, to = rawEnd, label = null;
    if (angled) to = gt + 1;
    if (inLink && s[to] === ")") to++;
    if (inLink) {
      const bracket = angled ? i - 3 : i - 2;
      const start = findLabelStart(s, bracket);
      if (start != null) {
        from = start > 0 && s[start - 1] === "!" ? start - 1 : start;
        label = s.slice(start + 1, bracket).replace(/\\(.)/g, "$1");
      } else from = bracket;
    } else if (angled) from = i - 1;
    out.push({ root, path, from, to, inLink, label, raw: `${root}://${s.slice(pathStart, rawEnd)}` });
    if (to <= i) continue;
    i = to - 1;
  }
  return out;
}

// One URI occupying the whole string (YAML / JSON values). Spaces do not need angle brackets.
export function uriValue(value) {
  let t = String(value ?? "").trim();
  if (t.startsWith("<") && t.endsWith(">")) t = t.slice(1, -1).trim();
  const m = t.match(/^(kb|life):\/\/([\s\S]*)$/);
  if (!m || /[\n\r]/.test(t) || t.includes("](")) return null;
  return { root: m[1], path: normalizeUriPath(m[2], { stripVault: m[1] === "kb" }) };
}

/**
 * Resolve one normalized path against one root.
 * Order: file path, extra path aliases, folder index.md, folder listing, frontmatter id, basename.
 * `files` holds source paths with the ".md" suffix. `ids` maps a lowercased id to that path.
 * `basenames` maps a filename stem to source paths, shortest first.
 * Returns { file, folder } — `folder` is the directory without a trailing slash — or null.
 */
export function resolveUri(rawPath, ctx, { extraPaths = [] } = {}) {
  const path = normalizeUriPath(rawPath, { exact: true, stripVault: false });
  const isDir = path.endsWith("/");
  const clean = path.replace(/\.md$/i, "").replace(/\/+$/, "");
  const tryFile = (c) => {
    if (!c) return null;
    if (ctx.files.has(c)) return c;
    if (!c.endsWith(".md") && ctx.files.has(c + ".md")) return c + ".md";
    return null;
  };
  const fromExtras = (asDir) => {
    for (const alt of extraPaths) {
      const a = String(alt).replace(/\\/g, "/").replace(/\.md$/i, "").replace(/\/+$/, "");
      const hit = (asDir ? tryFile(`${a}/index`) : null) || tryFile(a);
      if (hit) return hit;
    }
    return null;
  };
  if (isDir) {
    const index = tryFile(clean ? `${clean}/index` : "index") || fromExtras(true);
    if (index) return { file: index, folder: null };
    const has = clean && (ctx.dirs.has(clean) || [...ctx.files].some(f => f.startsWith(clean + "/")));
    if (ctx.allowFolder && has) return { file: null, folder: clean };
    return null;
  }
  const direct = tryFile(clean) || fromExtras(false);
  if (direct) return { file: direct, folder: null };
  const id = ctx.ids.get(clean.toLowerCase());
  if (id) return { file: id, folder: null };
  const base = clean.split("/").pop();
  const hits = base ? ctx.basenames.get(base) || [] : [];
  if (hits.length === 1 || (ctx.shortestBasename && hits.length > 1)) return { file: hits[0], folder: null };
  return null;
}

export function linkContext(records, root, { dirs = [], allowFolder = false, shortestBasename = true } = {}) {
  const files = new Set(), ids = new Map(), basenames = new Map(), dirSet = new Set(dirs);
  for (const r of records) {
    if (r.root !== root) continue;
    const rel = r.origin?.source_path;
    if (!rel) continue;
    files.add(rel);
    const stem = rel.replace(/\.md$/i, "");
    const parts = stem.split("/");
    let acc = "";
    for (let i = 0; i < parts.length - 1; i++) { acc = acc ? `${acc}/${parts[i]}` : parts[i]; dirSet.add(acc); }
    const base = parts[parts.length - 1];
    if (base) { const xs = basenames.get(base) || []; xs.push(rel); basenames.set(base, xs); }
    if (r.slug) ids.set(String(r.slug).toLowerCase(), rel);
  }
  for (const xs of basenames.values()) xs.sort((a, b) => a.length - b.length);
  return { files, ids, dirs: dirSet, basenames, allowFolder, shortestBasename };
}
