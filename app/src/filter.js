// Shared view-filter logic (used by the browser renderer and build-index stats).
export const as = v => v == null ? [] : Array.isArray(v) ? v : [v];
// Privacy comes ONLY from frontmatter: anything not explicitly "public" is private.
export const isPublic = r => r.privacy === "public";
export function match(r, f = {}, now = Date.now()) {
  for (const [k, vals] of Object.entries(f)) {
    if (k === "any") { if (!vals.some(sub => match(r, sub, now))) return false; continue; }
    if (k === "updated_within_days") {
      const t = Date.parse(r.updated); if (isNaN(t) || (now - t) / 864e5 > vals) return false; continue;
    }
    if (!as(r[k]).some(x => vals.includes(String(x)))) return false;
  }
  return true;
}
const cmp = keys => (a, b) => { for (const k of keys) { const d = k[0] === "-" ? -1 : 1, f = k.replace(/^-/, "");
  const x = String(a[f] ?? ""), y = String(b[f] ?? ""); if (x !== y) return x < y ? -d : d; } return 0; };
export function select(records, v, now = Date.now()) {
  let rs = records.filter(r => match(r, v.filter, now));
  if (!rs.length && v.fallback) rs = [...records];
  if (v.sort || v.fallback?.sort) rs.sort(cmp(v.sort || v.fallback.sort));
  if (v.fallback?.limit && rs.length > v.fallback.limit) rs = rs.slice(0, v.fallback.limit);
  return rs;
}
