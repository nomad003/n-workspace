// Weekly and monthly rollups, plus module/topic coverage. Pure: the build and tests both call this.
// Structural touches (timeline events with touch: true) are not activity.
import { daysSince } from "./module-model.js";
import { monthKey, weekKey } from "./timeline-model.js";

export const TYPE_KEYS = ["note", "topic", "task", "review", "kb"];
export const TYPE_LABEL = { note: "笔记", topic: "主题", task: "任务", review: "复盘", kb: "知识" };

export function totalOf(bucket) {
  return TYPE_KEYS.reduce((n, k) => n + (bucket?.[k] || 0), 0);
}

export function activityStatus(days) {
  if (days == null || days >= 30) return "停滞";
  if (days >= 14) return "偏久";
  return "活跃";
}

const iso = v => /^\d{4}-\d{2}-\d{2}/.test(String(v || "")) ? String(v).slice(0, 10) : "";

export function addDays(date, n) {
  const d = new Date(iso(date) + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return "";
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function weekStart(date) {
  const d = new Date(iso(date) + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return "";
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

function monthEnd(key) {
  const [y, m] = String(key).split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

export function recentWeeks(today, n = 12) {
  const end = weekStart(today);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const start = addDays(end, -7 * i);
    out.push({ key: weekKey(start), start, end: addDays(start, 6) });
  }
  return out;
}

export function planMonths(period) {
  const p = String(period || "");
  if (/^\d{4}-\d{2}$/.test(p)) return [p];
  if (/^\d{4}$/.test(p)) return Array.from({ length: 12 }, (_, i) => `${p}-${String(i + 1).padStart(2, "0")}`);
  const h = p.match(/^(\d{4})-H([12])$/);
  if (h) {
    const a = h[2] === "1" ? 1 : 7;
    return Array.from({ length: 6 }, (_, i) => `${h[1]}-${String(a + i).padStart(2, "0")}`);
  }
  const q = p.match(/^(\d{4})-Q([1-4])$/);
  if (q) {
    const a = (+q[2] - 1) * 3 + 1;
    return [0, 1, 2].map(i => `${q[1]}-${String(a + i).padStart(2, "0")}`);
  }
  return [];
}

const blank = () => Object.fromEntries(TYPE_KEYS.map(k => [k, 0]));
const inRange = (date, start, end) => { const d = iso(date); return !!(d && d >= start && d <= end); };
const isWeekly = r => r?.kind === "weekly" || /FREQ=WEEKLY/.test(r?.rrule || "");
const isQuarterly = r => r?.kind === "quarterly" || /INTERVAL=3/.test(r?.rrule || "");

function sundaysInMonth(key) {
  const end = monthEnd(key);
  let n = 0;
  for (let d = `${key}-01`; d && d <= end; d = addDays(d, 1)) if (new Date(d + "T00:00:00Z").getUTCDay() === 0) n++;
  return n;
}

function planCovers(plan, grain, key, start, end) {
  const months = new Set(planMonths(plan?.period));
  if (!months.size) return false;
  if (grain === "month") return months.has(key);
  for (let d = start; d && d <= end; d = addDays(d, 1)) if (months.has(d.slice(0, 7))) return true;
  return false;
}

function taskStats(tasks, start, end) {
  const planned = (tasks || []).filter(t => inRange(t.due, start, end) || (!iso(t.due) && inRange(t.created, start, end)));
  const done = (tasks || []).filter(t => t.status === "done" && inRange(t.done_at, start, end));
  return { done: done.length, planned: planned.length };
}

function planStats(plans, grain, key, start, end) {
  const hit = (plans || []).filter(p => planCovers(p, grain, key, start, end));
  return { done: hit.filter(p => p.status === "done").length, planned: hit.length };
}

function reviewStats(reviews, grain, key, start, end) {
  let expected = 0, done = 0;
  for (const rev of reviews || []) {
    const inst = rev.instances || [];
    if (isWeekly(rev)) {
      expected += grain === "week" ? 1 : sundaysInMonth(key);
      done += inst.filter(i => i.status === "done" && inRange(i.done_at, start, end)).length;
    } else if (isQuarterly(rev)) {
      expected += inst.filter(i => inRange(i.due, start, end)).length;
      done += inst.filter(i => i.status === "done" && inRange(i.due, start, end)).length;
    }
  }
  return { done, expected };
}

function eachWeek(from, to) {
  const out = [];
  let d = weekStart(from);
  const end = weekStart(to);
  while (d && end && d <= end) {
    out.push({ key: weekKey(d), start: d, end: addDays(d, 6) });
    d = addDays(d, 7);
  }
  return out;
}

function eachMonth(from, to) {
  const out = [];
  let y = +from.slice(0, 4), m = +from.slice(5, 7);
  const ey = +to.slice(0, 4), em = +to.slice(5, 7);
  while (y < ey || (y === ey && m <= em)) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    out.push({ key, start: `${key}-01`, end: monthEnd(key) });
    m += 1;
    if (m === 13) { m = 1; y += 1; }
  }
  return out;
}

function bump(bucket, type) {
  if (bucket && Object.prototype.hasOwnProperty.call(bucket, type)) bucket[type] += 1;
}

export function buildRollups({ events = [], tasks = [], plans = [], reviews = [], today } = {}) {
  const day = iso(today) || new Date().toISOString().slice(0, 10);
  const real = (events || []).filter(e => !e.touch && iso(e.date));
  const marks = [day];
  for (const e of real) marks.push(e.date);
  for (const t of tasks || []) marks.push(iso(t.due), iso(t.done_at), iso(t.created));
  for (const r of reviews || []) for (const i of r.instances || []) marks.push(iso(i.due), iso(i.done_at));
  const dated = marks.filter(Boolean).sort();
  const from = dated[0] < addDays(day, -366 * 5) ? addDays(day, -366 * 5) : (dated[0] || day);
  const last = dated.at(-1) || day;
  const to = last > addDays(day, 366) ? addDays(day, 366) : last;
  const fill = (periods, grain) => periods.map(p => {
    const total = blank(), modules = {}, topics = {};
    for (const e of real) {
      if (!inRange(e.date, p.start, p.end)) continue;
      bump(total, e.type);
      const mods = e.modules?.length ? e.modules : (e.module ? [e.module] : []);
      const tops = e.topics?.length ? e.topics : (e.topic ? [e.topic] : []);
      for (const id of mods) { modules[id] ||= blank(); bump(modules[id], e.type); }
      for (const id of tops) { topics[id] ||= blank(); bump(topics[id], e.type); }
    }
    return { ...p, total, modules, topics, tasks: taskStats(tasks, p.start, p.end), plans: planStats(plans, grain, p.key, p.start, p.end), reviews: reviewStats(reviews, grain, p.key, p.start, p.end) };
  });
  return {
    today: day,
    current: { week: weekKey(day), month: monthKey(day) },
    weeks: fill(eachWeek(from, to), "week"),
    months: fill(eachMonth(from.slice(0, 7), to.slice(0, 7)), "month"),
  };
}

function idsOf(e, key) {
  const list = e[key + "s"];
  if (list?.length) return list;
  return e[key] ? [e[key]] : [];
}

function longestGap(dates, today) {
  const xs = [...new Set(dates.filter(Boolean))].sort();
  if (!xs.length) return null;
  let gap = 0;
  for (let i = 1; i < xs.length; i++) gap = Math.max(gap, daysSince(xs[i - 1], xs[i]) ?? 0);
  const open = daysSince(xs.at(-1), today);
  if (open != null) gap = Math.max(gap, open);
  return gap;
}

function cadenceOf(cad) {
  if (!cad) return null;
  if (/WEEKLY/.test(cad)) return "week";
  if (/MONTHLY/.test(cad)) return +((String(cad).match(/INTERVAL=(\d+)/) || [])[1] || 1) >= 3 ? "quarter" : "month";
  return null;
}

function missingLogs(topic, today, weeks) {
  if (topic?.status?.lifecycle !== "active") return [];
  const kind = cadenceOf(topic?.tracking?.cadence);
  if (!kind) return [];
  const dates = (topic.entries || []).map(e => iso(e.date)).filter(Boolean);
  const started = iso(topic.started) || dates[0] || "";
  if (kind === "week") {
    return weeks.filter(w => (!started || w.end >= started) && !dates.some(d => d >= w.start && d <= w.end)).map(w => w.key);
  }
  const months = [];
  const cursor = new Date(today.slice(0, 7) + "-01T00:00:00Z");
  for (let i = 0; i < 3; i++) {
    const key = cursor.toISOString().slice(0, 7);
    const start = `${key}-01`, end = monthEnd(key);
    if ((!started || end >= started) && !dates.some(d => d >= start && d <= end)) months.push(key);
    cursor.setUTCMonth(cursor.getUTCMonth() - 1);
  }
  return months.reverse();
}

function coverOne({ id, title, dates, today, weeks }) {
  const last = dates.filter(Boolean).sort().at(-1) || null;
  const days = last ? daysSince(last, today) : null;
  const shown = days == null ? null : Math.max(0, days);
  const counts = weeks.map(w => dates.filter(d => d >= w.start && d <= w.end).length);
  return {
    id, title, last, days: shown, activeWeeks: counts.filter(n => n > 0).length,
    longestGap: longestGap(dates, today), status: activityStatus(shown), weeks: counts,
  };
}

export function buildCoverage({ events = [], topics = [], modules = [], reviews = [], today } = {}) {
  const day = iso(today) || new Date().toISOString().slice(0, 10);
  const real = (events || []).filter(e => !e.touch && iso(e.date));
  const weeks = recentWeeks(day, 12);
  const moduleRows = (modules || []).map(m => coverOne({
    id: m.id, title: m.title || m.id, today: day, weeks,
    dates: real.filter(e => idsOf(e, "module").includes(m.id)).map(e => e.date),
  }));
  const topicRows = (topics || []).map(t => {
    const row = coverOne({
      id: t.id, title: t.title || t.id, today: day, weeks,
      dates: real.filter(e => idsOf(e, "topic").includes(t.id)).map(e => e.date),
    });
    const mods = [...new Set([t.module, ...(t.modules || [])].filter(Boolean))];
    return { ...row, modules: mods, lifecycle: t.status?.lifecycle || null, missing: missingLogs(t, day, weeks) };
  });
  const wstart = weekStart(day), wend = addDays(wstart, 6);
  const missingReviews = [];
  for (const rev of reviews || []) {
    const inst = rev.instances || [];
    if (isWeekly(rev) && !inst.some(i => i.status === "done" && inRange(i.done_at, wstart, wend)))
      missingReviews.push({ id: rev.id, kind: "weekly", period: weekKey(day), label: "周复盘" });
    if (isQuarterly(rev)) for (const i of inst) {
      if (iso(i.due) && iso(i.due) <= day && i.status !== "done")
        missingReviews.push({ id: rev.id, kind: "quarterly", period: i.period || iso(i.due), label: "季度复盘" });
    }
  }
  return { today: day, weeks: weeks.map(w => ({ key: w.key, start: w.start })), modules: moduleRows, topics: topicRows, missingReviews };
}

export function analysisStats(rollups, coverage) {
  const week = rollups?.weeks?.find(w => w.key === rollups.current?.week);
  const month = rollups?.months?.find(m => m.key === rollups.current?.month);
  const tally = rows => {
    const n = { 活跃: 0, 偏久: 0, 停滞: 0 };
    for (const r of rows || []) n[r.status] = (n[r.status] || 0) + 1;
    return `活跃 ${n.活跃} · 偏久 ${n.偏久} · 停滞 ${n.停滞}`;
  };
  const missingPeriods = (coverage?.topics || []).reduce((n, t) => n + (t.missing?.length || 0), 0);
  return {
    line: `rollups: ${rollups?.weeks?.length || 0} weeks · ${rollups?.months?.length || 0} months · this week ${totalOf(week?.total)} · this month ${totalOf(month?.total)}`,
    coverage: `coverage: modules ${tally(coverage?.modules)} · topics ${tally(coverage?.topics)} · missing reviews ${coverage?.missingReviews?.length || 0} · missing topic periods ${missingPeriods}`,
  };
}
