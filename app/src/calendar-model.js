// Read-only calendar. Weekly plans and daily notes are parsed here; the page only draws them.
// Weeks are ISO (Monday start). Directory names follow life-paths.js, newest layout first.
import { LIFE_CHAINS } from "./life-paths.js";
import { weekKey } from "./timeline-model.js";
import { isoWeekBounds } from "./analysis-model.js";

const WEEK_RE = /^(\d{4})-W(\d{1,2})$/i;
const DAY_FILE_RE = /^(\d{4}-\d{2}-\d{2})(?:-[^/]+)?\.md$/i;
const INDEX_RE = /(^|\/)(index|readme)\.md$/i;
const EVENT_CAP = 3;

function chainDirs(head) {
  const chain = LIFE_CHAINS.find(c => c[0] === head) || [];
  return chain.filter(m => m.endsWith("/"));
}
const WEEKLY_DIRS = chainDirs("review/weekly/");
const DAILY_DIRS = chainDirs("review/daily/");

export function addDays(iso, n) {
  const d = new Date(String(iso || "").slice(0, 10) + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return "";
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function asDate(v) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = String(v ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : "";
}

export function weekId(v) {
  const m = String(v ?? "").trim().match(WEEK_RE);
  if (!m) return "";
  const n = +m[2];
  if (n < 1 || n > 53) return "";
  return `${m[1]}-W${String(n).padStart(2, "0")}`;
}

// A key is real only when its Monday falls in that ISO week (2026-W53 yes, 2026-W54 no).
export function realWeek(key) {
  const id = weekId(key);
  if (!id) return "";
  const bounds = isoWeekBounds(id);
  if (!bounds || weekKey(bounds.start) !== id) return "";
  return id;
}

export function shiftWeek(key, n) {
  const id = realWeek(key);
  const bounds = id && isoWeekBounds(id);
  if (!bounds) return "";
  return realWeek(weekKey(addDays(bounds.start, n * 7)));
}

function slash(p) {
  return String(p || "").replace(/\\/g, "/");
}

function dirRank(path, dirs) {
  const p = slash(path);
  let best = -1;
  dirs.forEach((dir, i) => {
    if (p.startsWith(dir) && (best < 0 || i < best)) best = i;
  });
  return best;
}

export function isWeeklyPath(path) {
  const p = slash(path);
  return dirRank(p, WEEKLY_DIRS) >= 0 && /\.md$/i.test(p) && !INDEX_RE.test(p);
}

export function isDailyPath(path) {
  const p = slash(path);
  return dirRank(p, DAILY_DIRS) >= 0 && /\.md$/i.test(p) && !INDEX_RE.test(p);
}

export function lifeSource(path) {
  return `life://${slash(path).replace(/\.md$/i, "")}`;
}

// [[target|label]] and [[target#heading]] become the visible label.
export function wikiLabel(text) {
  return String(text ?? "").replace(/\[\[([^\]\n]+)\]\]/g, (_, inner) => {
    const pipe = inner.indexOf("|");
    const raw = (pipe >= 0 ? inner.slice(pipe + 1) : inner).split("#")[0];
    return raw.trim();
  });
}

function headingTitle(line) {
  return wikiLabel(line).replace(/\s+#+\s*$/, "").trim();
}

function checkbox(line) {
  const m = String(line).match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/);
  if (!m) return null;
  const text = wikiLabel(m[2]).trim();
  if (!text) return null;
  return { text, done: /x/i.test(m[1]) };
}

function retroText(lines) {
  const out = [];
  for (const line of lines) {
    const item = checkbox(line);
    const text = wikiLabel(item ? item.text : line).trim();
    if (text) out.push(text);
  }
  return out.join("\n");
}

// ## headings become sections. A heading whose title contains 复盘 is the retro, not a checklist.
export function parseWeekBody(text) {
  const sections = [];
  const retros = [];
  let current = null;
  for (const line of String(text ?? "").replace(/\r\n/g, "\n").split("\n")) {
    const h = line.match(/^##\s+(.+?)\s*$/);
    if (h) {
      const title = headingTitle(h[1]);
      current = { title, retro: /复盘/.test(title), items: [], lines: [] };
      if (current.retro) retros.push(current);
      else if (title) sections.push(current);
      continue;
    }
    if (!current) continue;
    if (current.retro) current.lines.push(line);
    else {
      const item = checkbox(line);
      if (item) current.items.push(item);
    }
  }
  const items = sections.flatMap(s => s.items);
  return {
    sections: sections.map(s => ({ title: s.title, items: s.items })),
    done: items.filter(i => i.done).length,
    total: items.length,
    retro: retros.map(s => retroText(s.lines)).filter(Boolean).join("\n\n"),
  };
}

export function weekOfNote(note) {
  const fromWeek = realWeek(note?.week);
  if (fromWeek) return fromWeek;
  const fromPeriod = realWeek(note?.period);
  if (fromPeriod) return fromPeriod;
  const base = slash(note?.path).split("/").pop() || "";
  const named = base.match(/(\d{4})-W(\d{1,2})/i);
  if (named) {
    const id = realWeek(`${named[1]}-W${named[2]}`);
    if (id) return id;
  }
  const start = asDate(note?.start);
  return start ? realWeek(weekKey(start)) : "";
}

export function boundsOfNote(note, id) {
  const iso = isoWeekBounds(id) || { start: "", end: "" };
  const start = asDate(note?.start) || iso.start;
  const end = asDate(note?.end) || iso.end;
  if (start && end && start > end) return { start: end, end: start };
  return { start, end };
}

export function dailyDate(note) {
  if (!isDailyPath(note?.path)) return "";
  const base = slash(note.path).split("/").pop() || "";
  const named = base.match(DAY_FILE_RE);
  if (named) return named[1];
  return asDate(note?.date);
}

function rankNote(note) {
  return dirRank(note.path, WEEKLY_DIRS);
}

export function monthWeeks(ym) {
  const m = String(ym || "").match(/^(\d{4})-(\d{2})$/);
  if (!m) return [];
  const month = +m[2];
  if (month < 1 || month > 12) return [];
  const first = `${m[1]}-${m[2]}-01`;
  const dim = new Date(Date.UTC(+m[1], month, 0)).getUTCDate();
  const last = `${m[1]}-${m[2]}-${String(dim).padStart(2, "0")}`;
  let cursor = addDays(first, -((new Date(first + "T00:00:00Z").getUTCDay() + 6) % 7));
  const end = addDays(last, 6 - ((new Date(last + "T00:00:00Z").getUTCDay() + 6) % 7));
  const weeks = [];
  while (cursor && cursor <= end) {
    const days = [];
    for (let i = 0; i < 7; i++) { days.push(cursor); cursor = addDays(cursor, 1); }
    weeks.push({ week: weekKey(days[0]), days });
  }
  return weeks;
}

function dayBucket(days, date) {
  if (!date) return null;
  return days[date] ||= { notes: [], events: { count: 0, items: [] }, tasks_due: [], tasks_done: [], reviews_due: [] };
}

function eventItem(e) {
  return { title: e.title || "", href: e.href || "", type: e.type || "" };
}

export function buildCalendar({ notes = [], events = [], tasks = [], reviews = [] } = {}) {
  const weeks = {};
  const candidates = new Map();
  for (const note of notes) {
    if (!isWeeklyPath(note?.path)) continue;
    const id = weekOfNote(note);
    if (!id) continue;
    const parsed = parseWeekBody(note.text);
    const row = { id, rank: rankNote(note), path: slash(note.path), ...boundsOfNote(note, id), ...parsed, title: note.title || "" };
    const prev = candidates.get(id);
    if (!prev || row.rank < prev.rank || (row.rank === prev.rank && row.total > prev.total)) candidates.set(id, row);
  }
  for (const [id, row] of candidates) {
    weeks[id] = {
      start: row.start,
      end: row.end,
      source: lifeSource(row.path),
      sections: row.sections,
      done: row.done,
      total: row.total,
      retro: row.retro,
    };
  }

  const days = {};
  const seenNote = new Set();
  for (const note of notes) {
    const date = dailyDate(note);
    if (!date) continue;
    const source = lifeSource(note.path);
    if (seenNote.has(source)) continue;
    seenNote.add(source);
    dayBucket(days, date).notes.push({ title: note.title || source.split("/").pop(), source });
  }
  for (const day of Object.values(days)) day.notes.sort((a, b) => a.source.localeCompare(b.source));

  const byDay = new Map();
  for (const e of events) {
    if (!e || e.touch) continue;
    const date = asDate(e.date);
    if (!date) continue;
    if (!byDay.has(date)) byDay.set(date, []);
    byDay.get(date).push(e);
  }
  for (const [date, list] of byDay) {
    const bucket = dayBucket(days, date);
    const items = list.slice().sort((a, b) => String(a.type).localeCompare(String(b.type)) || String(a.title).localeCompare(String(b.title)));
    bucket.events = { count: items.length, items: items.slice(0, EVENT_CAP).map(eventItem) };
  }

  for (const task of tasks) {
    const due = asDate(task?.due);
    const done = asDate(task?.done_at);
    const row = { id: task?.id || "", title: task?.title || task?.id || "" };
    if (!row.id && !row.title) continue;
    if (due) dayBucket(days, due).tasks_due.push(row);
    if (done) dayBucket(days, done).tasks_done.push(row);
  }
  for (const rev of reviews) {
    for (const inst of rev?.instances || []) {
      const due = asDate(inst?.due);
      if (!due) continue;
      dayBucket(days, due).reviews_due.push({
        id: rev.id || "",
        kind: rev.kind || "",
        period: inst.period || "",
        status: inst.status || "",
      });
    }
  }
  return { weeks, days };
}
