// Dated events for 时间线. Pure: build-index and tests both call this.
import { moduleIdsForRecord, topicIdsForRecord, topicModuleIds } from "./module-model.js";

const iso = v => /^\d{4}-\d{2}-\d{2}/.test(String(v || "")) ? String(v).slice(0, 10) : "";
const noteHref = r => `#knowledge/note?id=${encodeURIComponent(r.id)}`;

function fakeNote(uri) {
  const m = String(uri || "").match(/life:\/\/([^\s#?]+)/);
  if (!m) return null;
  let body = m[1].replace(/\/+$/, "");
  if (!body || body.startsWith("data/")) return null;
  if (String(uri).includes(m[1] + "/") || m[1].endsWith("/")) body = body.replace(/\/+$/, "") + "/index.md";
  else if (!/\.md$/i.test(body)) body += ".md";
  return { id: `life:${body}`, root: "life", title: body.split("/").pop().replace(/\.md$/i, ""), origin: { source_path: body } };
}

export function weekKey(date) {
  const d = new Date(String(date).slice(0, 10) + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return "";
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const first = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d - first) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function monthKey(date) {
  return /^\d{4}-\d{2}/.test(String(date || "")) ? String(date).slice(0, 7) : "";
}

export function buildTimeline({ records = [], topics = [], tasks = [], reviews = [], modules = [] } = {}) {
  const events = [];
  const push = e => { if (!iso(e.date)) return; events.push({ ...e, date: iso(e.date), module: e.modules?.[0] || null, topic: e.topics?.[0] || null }); };
  for (const r of records) {
    if (r.root !== "life" && r.root !== "kb") continue;
    const modulesOf = moduleIdsForRecord(modules, r);
    const topicsOf = topicIdsForRecord(topics, r);
    const kbMods = r.root === "kb" && !modulesOf.length ? ["kb"] : modulesOf;
    push({
      id: `${r.root === "kb" ? "kb" : "note"}:${r.id}`,
      date: r.root === "life" ? (iso(r.date) || iso(r.updated)) : iso(r.updated),
      type: r.root === "kb" ? "kb" : "note",
      source: r.root,
      title: r.title || r.id,
      href: noteHref(r),
      modules: kbMods,
      topics: topicsOf,
    });
  }
  for (const t of topics) {
    const mods = topicModuleIds(t);
    for (const [i, e] of (t.entries || []).entries()) {
      push({
        id: `topic:${t.id}:${i}:${iso(e.date)}:${e.kind || ""}:${e.title || ""}`,
        date: e.date,
        type: "topic",
        source: "life",
        title: `${t.title} · ${e.title || e.kind || "记录"}`,
        href: `#topics/${encodeURIComponent(t.id)}/log`,
        modules: mods,
        topics: [t.id],
      });
    }
  }
  for (const task of tasks) {
    if (task.status !== "done") continue;
    const tops = (topics || []).filter(t => (t.links?.tasks || []).includes(task.id));
    push({
      id: `task:${task.id}`,
      date: task.done_at,
      type: "task",
      source: "life",
      title: task.title || task.id,
      href: "#plan/board",
      modules: [...new Set(tops.flatMap(topicModuleIds))],
      topics: tops.map(t => t.id),
    });
  }
  for (const rev of reviews) {
    for (const inst of rev.instances || []) {
      if (inst.status !== "done") continue;
      const note = fakeNote(inst.note);
      const mods = note ? moduleIdsForRecord(modules, note) : [];
      const tops = note ? topicIdsForRecord(topics, note) : [];
      push({
        id: `review:${rev.id}:${inst.period || iso(inst.done_at)}`,
        date: inst.done_at,
        type: "review",
        source: "life",
        title: `${inst.period || "复盘"} 复盘`,
        href: note ? noteHref(note) : "#plan/reviews",
        modules: mods,
        topics: tops,
      });
    }
  }
  events.sort((a, b) => b.date.localeCompare(a.date) || String(a.title).localeCompare(String(b.title)));
  return events;
}

export function timelineCounts(events) {
  const byModule = {}, byType = {};
  for (const e of events || []) {
    byType[e.type] = (byType[e.type] || 0) + 1;
    const ids = e.modules?.length ? e.modules : ["(none)"];
    for (const id of ids) byModule[id] = (byModule[id] || 0) + 1;
  }
  return { total: (events || []).length, byModule, byType };
}

export function groupEvents(events, group) {
  const key = group === "week" ? weekKey : monthKey;
  const buckets = [];
  const index = new Map();
  for (const e of events || []) {
    const k = key(e.date) || e.date;
    if (!index.has(k)) { const b = { key: k, events: [] }; index.set(k, b); buckets.push(b); }
    index.get(k).events.push(e);
  }
  return buckets;
}
