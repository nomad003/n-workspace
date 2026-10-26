// Pure module / view model. Sections stay the source of tab labels and sources.
// `modules` and `views` only name tabs as "sectionId/tabId". Absent modules → the old section nav.

export const MODULE_IDS = ["plan", "review", "life", "work", "learn", "content", "accounts", "kb", "team"];
export const MODULE_ROUTE = { life: "life", work: "work", learn: "learn", content: "content", accounts: "accounts", kb: "knowledge", plan: "plan", review: "review", team: "team" };
export const BUILTIN_NAV = {
  overview: { title: "总览", href: "#overview" },
  timeline: { title: "时间线", href: "#timeline" },
  analysis: { title: "分析", href: "#analysis" },
  topics: { title: "主题", href: "#topics" },
  calendar: { title: "日历", href: "#calendar" },
};
export const DEFAULT_NAV = [
  { id: "board", title: "看板", items: ["overview", "timeline", "analysis"] },
  { id: "planning", title: "规划", items: ["plan", "review", "calendar", "topics"] },
  { id: "domains", title: "领域", items: ["work", "life", "learn", "content"] },
  { id: "library", title: "资料", items: ["kb", "accounts", "team"] },
];
const LEGACY_DEFAULT = { today: "today", plan: "board", journal: "daily", agents: "agents" };
const INDEX_RE = /(^|\/)(index|README)\.md$/i;

export const routeOfModule = id => MODULE_ROUTE[id] || id;
export const moduleIdFromRoute = route => Object.entries(MODULE_ROUTE).find(([, r]) => r === route)?.[0] || null;

export function tabIndex(sections) {
  const map = new Map();
  for (const s of sections || []) for (const t of s.tabs || []) {
    const ref = `${s.id}/${t.id}`;
    map.set(ref, { ref, sectionId: s.id, tabId: String(t.id), label: t.label || t.id, source: Array.isArray(t.source) ? t.source : [], sectionLabel: s.label || s.id });
  }
  return map;
}

// Tab absorbed_by and a top-level absorbed map are the same table. The tab value wins when both set one key.
export function absorbedMap(sections, extra) {
  const out = {};
  if (extra && typeof extra === "object" && !Array.isArray(extra)) {
    for (const [k, v] of Object.entries(extra)) if (v != null && v !== "") out[String(k)] = String(v);
  }
  for (const s of sections || []) for (const t of s.tabs || []) if (t?.absorbed_by) out[`${s.id}/${t.id}`] = String(t.absorbed_by);
  return out;
}

export function absorbedTarget(raw, sub, sections) {
  const key = `${raw}/${sub || raw}`;
  const dest = absorbedMap(sections)[key];
  if (!dest) return null;
  return dest === "overview" ? "overview" : dest;
}

// 日历 is its own page. A nav that never names it still shows it: after 复盘, else after 计划, else at the end of the first group. An explicit item stays where it was written.
function withCalendar(groups) {
  const copy = groups.map(g => ({ ...g, items: [...(g.items || [])] }));
  if (!copy.length || copy.some(g => g.items.includes("calendar"))) return copy;
  const host = copy.find(g => g.items.includes("review")) || copy.find(g => g.items.includes("plan")) || copy[0];
  const reviewAt = host.items.indexOf("review");
  const planAt = host.items.indexOf("plan");
  const at = reviewAt >= 0 ? reviewAt + 1 : planAt >= 0 ? planAt + 1 : host.items.length;
  host.items.splice(at, 0, "calendar");
  return copy;
}

// Groups of module ids and built-in page ids. Null when there is no module layer (the section nav stays).
export function resolveNav(nav, modules) {
  if (!modules?.length) return null;
  const groups = withCalendar(Array.isArray(nav) && nav.length ? nav : DEFAULT_NAV);
  const byId = new Map(modules.map(m => [m.id, m]));
  return groups.map(g => ({
    id: g.id || "",
    title: g.title || "",
    items: (g.items || []).map(id => {
      if (BUILTIN_NAV[id]) return { id, kind: "page", ...BUILTIN_NAV[id] };
      const m = byId.get(id);
      if (!m) return null;
      return { id, kind: "module", title: m.title || id, href: `#${routeOfModule(m.id)}` };
    }).filter(Boolean),
  })).filter(g => g.items.length);
}

function resolveEntry(entry, index) {
  const tabs = (entry?.tabs || []).map(ref => {
    const key = String(ref);
    const hit = index.get(key);
    if (hit) return { ...hit };
    const [sectionId, tabId = ""] = key.split("/");
    return { ref: key, missing: true, sectionId, tabId, label: key, source: [] };
  });
  return { ...entry, tabs: [...(entry?.tabs || [])], resolved: tabs };
}

// `doc` is a sections.yaml object. modules: null means "keep the current section pages".
export function resolveLayer(doc) {
  const sections = doc?.sections || [];
  const index = tabIndex(sections);
  const raw = doc?.modules;
  if (!Array.isArray(raw) || !raw.length) return { modules: null, views: null, nav: null, absorbed: {} };
  const modules = raw.map(m => resolveEntry(m, index));
  return {
    modules,
    views: (Array.isArray(doc?.views) ? doc.views : []).map(v => resolveEntry(v, index)),
    nav: Array.isArray(doc?.nav) && doc.nav.length ? doc.nav : null,
    absorbed: absorbedMap(sections, doc?.absorbed),
  };
}

export function ownerModule(ref, modules) {
  return (modules || []).find(m => (m.tabs || []).includes(ref)) || null;
}

// Old page hashes (#today, #plan/reviews, #journal/cfwork, #agents) land on the module that owns that tab.
export function legacyTarget(raw, sub, modules) {
  if (!modules || !(raw in LEGACY_DEFAULT)) return null;
  const tab = sub || LEGACY_DEFAULT[raw];
  const mod = ownerModule(`${raw}/${tab}`, modules);
  if (!mod) return null;
  return `${routeOfModule(mod.id)}/${tab}`;
}

export function todayStamp(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function daysSince(date, today) {
  const d = String(date || "").slice(0, 10), t = String(today || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const a = Date.parse(t + "T00:00:00Z"), b = Date.parse(d + "T00:00:00Z");
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((a - b) / 86400000);
}

function pathSpec(p) {
  const s = String(p || "").trim();
  if (!s) return null;
  if (s.startsWith("kb://")) return { root: "kb", prefix: s.slice(5).replace(/\/+$/, "") };
  if (s.startsWith("life://")) {
    const body = s.slice(7).replace(/[#?].*$/, "").replace(/\/+$/, "");
    if (!body || body.startsWith("data/") || /\.ya?ml$/i.test(body)) return null;
    if (/\.md$/i.test(body)) return { root: "life", file: body.replace(/\.md$/i, "") };
    return { root: "life", prefix: body };
  }
  if (s.startsWith("data/") || /\.ya?ml$/i.test(s)) return null;
  if (/\.md$/i.test(s)) return { root: "life", file: s.replace(/\.md$/i, "") };
  return { root: "life", prefix: s.replace(/\/+$/, "") };
}

function covered(spec, record) {
  if (!spec || record?.root !== spec.root) return false;
  const path = String(record.origin?.source_path || "");
  const bare = path.replace(/\.md$/i, "");
  if (spec.file) return bare === spec.file;
  if (!spec.prefix) return spec.root === "kb" && !path.includes("/");
  return bare === spec.prefix || bare.startsWith(spec.prefix + "/") || path.startsWith(spec.prefix + "/");
}

export function matchesPaths(paths, record) {
  const specs = (paths || []).map(pathSpec).filter(Boolean);
  return specs.some(s => covered(s, record));
}

export function notesForPaths(paths, records) {
  const specs = (paths || []).map(pathSpec).filter(Boolean);
  const seen = new Set(), out = [];
  for (const r of records || []) {
    if (!r || INDEX_RE.test(r.origin?.source_path || "") || seen.has(r.id)) continue;
    if (!specs.some(s => covered(s, r))) continue;
    seen.add(r.id); out.push(r);
  }
  return out;
}

export function moduleIdsForRecord(modules, record) {
  return (modules || []).filter(m => matchesPaths(m.paths, record)).map(m => m.id);
}

function uriMatchesRecord(uri, record) {
  const s = String(uri || "").trim().replace(/^<|>$/g, "");
  const m = s.match(/^(kb|life):\/\/([\s\S]+)$/);
  if (!m) return false;
  const body = m[2].replace(/[#?].*$/, "").replace(/\/+$/, "").replace(/\.md$/i, "");
  const path = String(record?.origin?.source_path || "").replace(/\.md$/i, "");
  return record?.root === m[1] && (path === body || path === `${body}/index`);
}

export function topicIdsForRecord(topics, record) {
  const out = [];
  for (const t of topics || []) {
    const refs = [t.narrative, ...(t.links?.notes || []), ...(t.resources || []).map(r => r.ref)];
    if (matchesPaths(t.paths, record) || refs.some(u => uriMatchesRecord(u, record))) out.push(t.id);
  }
  return out;
}

// Folder tabs of one section that this module or view owns. Null means "no scope, show the whole section".
export function scopedFolderTabs(entry, sectionId) {
  if (!entry) return null;
  return (entry.resolved || []).filter(t => !t.missing && t.sectionId === sectionId);
}

export function moduleNoteStats(entry, records, today) {
  const notes = notesForPaths(entry?.paths, records);
  const latest = notes.map(r => String(r.updated || "").slice(0, 10)).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().at(-1) || null;
  const days = daysSince(latest, today);
  return { count: notes.length, latest, days: days == null ? null : Math.max(0, days) };
}

export function topicModuleIds(topic) {
  return [...new Set([topic?.module, ...(Array.isArray(topic?.modules) ? topic.modules : [])].filter(Boolean))];
}

export function topicCounts(moduleId, topics) {
  const xs = (topics || []).filter(t => topicModuleIds(t).includes(moduleId));
  return {
    active: xs.filter(t => t.status?.lifecycle === "active").length,
    proposed: xs.filter(t => t.status?.lifecycle === "proposed").length,
  };
}

export function ageTone(days) {
  if (days == null) return "";
  if (days >= 30) return "old";
  if (days >= 14) return "stale";
  return "";
}
