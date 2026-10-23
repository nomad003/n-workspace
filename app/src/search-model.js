// Full-text note search over kb-index + life-index rows. Filters are exact and optional.
import { moduleIdsForRecord, topicIdsForRecord } from "./module-model.js";

const day = v => /^\d{4}-\d{2}-\d{2}/.test(String(v || "")) ? String(v).slice(0, 10) : "";

export function annotateEntry(entry, modules, topics) {
  const record = { root: entry.root, origin: { source_path: entry.path || entry.origin?.source_path || "" } };
  return {
    ...entry,
    path: record.origin.source_path,
    date: day(entry.date) || day(entry.updated),
    modules: moduleIdsForRecord(modules, record),
    topics: topicIdsForRecord(topics, record),
  };
}

export function searchNotes(entries, { q = "", module = "", topic = "", source = "", from = "", to = "" } = {}) {
  const terms = String(q || "").toLowerCase().split(/\s+/).filter(Boolean);
  const fromD = day(from), toD = day(to);
  const out = [];
  for (const x of entries || []) {
    if (source && x.root !== source) continue;
    if (module && !(x.modules || []).includes(module)) continue;
    if (topic && !(x.topics || []).includes(topic)) continue;
    const d = day(x.date) || day(x.updated);
    if (fromD && (!d || d < fromD)) continue;
    if (toD && (!d || d > toD)) continue;
    if (!terms.length) { out.push({ entry: x, score: 0 }); continue; }
    const title = String(x.title || "").toLowerCase();
    const tags = (x.tags || []).join(" ").toLowerCase();
    const path = String(x.path || "").toLowerCase();
    const body = String(x.text || "").toLowerCase();
    let score = 0, ok = true;
    for (const w of terms) {
      const inBody = body.includes(w);
      const part = (title.includes(w) ? 10 : 0) + (tags.includes(w) ? 5 : 0) + (path.includes(w) ? 3 : 0) + (inBody ? 1 + Math.min(4, body.split(w).length - 2) : 0);
      if (!part) { ok = false; break; }
      score += part;
    }
    if (ok) out.push({ entry: x, score });
  }
  out.sort((a, b) => b.score - a.score || String(b.entry.date || b.entry.updated || "").localeCompare(String(a.entry.date || a.entry.updated || "")));
  return out;
}
