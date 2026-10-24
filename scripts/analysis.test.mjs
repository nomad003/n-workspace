import assert from "node:assert/strict";
import { activityAgeText, activityStatus, analysisStats, buildCoverage, buildRollups, comparePeriods, effortKind, effortMonths, instanceStatus, isoWeekBounds, orderCoverage, planMonths, quarterKey, reviewSnapshot, shiftMonth, shiftQuarter, structuralCue, structuralLabel, totalOf } from "../app/src/analysis-model.js";
import { latestStructuralDate, weekKey } from "../app/src/timeline-model.js";

assert.deepEqual(planMonths("2026-10"), ["2026-10"]);
assert.deepEqual(planMonths("2026-Q4"), ["2026-10", "2026-11", "2026-12"]);
assert.equal(planMonths("2026-H2").length, 6);
assert.equal(planMonths("2026").length, 12);
assert.equal(activityStatus(0), "活跃");
assert.equal(activityStatus(13), "活跃");
assert.equal(activityStatus(14), "偏久");
assert.equal(activityStatus(29), "偏久");
assert.equal(activityStatus(30), "停滞");
assert.equal(activityStatus(null), "停滞");

const events = [
  { date: "2026-10-13", type: "topic", touch: false, modules: ["life"], topics: ["running"], module: "life", topic: "running" },
  { date: "2026-10-22", type: "note", touch: true, modules: ["life"], topics: ["running"], module: "life", topic: "running" },
  { date: "2026-10-02", type: "kb", touch: false, modules: ["kb"], topics: [], module: "kb", topic: null },
  { date: "2026-10-01", type: "note", touch: false, modules: ["life"], topics: ["running"], module: "life", topic: "running" },
  { date: "2026-10-20", type: "note", touch: false, modules: ["learn", "content"], topics: ["blog"], module: "learn", topic: "blog" },
  { date: "2026-09-01", type: "note", touch: false, modules: ["work"], topics: [], module: "work", topic: null },
];
const tasks = [
  { id: "a", status: "done", due: "2026-10-18", done_at: "2026-10-03", created: "2026-09-01" },
  { id: "b", status: "open", due: "2026-10-20", done_at: null, created: "2026-09-01" },
];
const plans = [
  { id: "m", period: "2026-10", status: "active" },
  { id: "y", period: "2026", status: "done" },
];
const reviews = [
  { id: "w", kind: "weekly", rrule: "FREQ=WEEKLY;BYDAY=SU", instances: [{ period: "2026-W41", due: "2026-10-11", status: "done", done_at: "2026-10-12" }] },
  { id: "q", kind: "quarterly", rrule: "FREQ=MONTHLY;INTERVAL=3", instances: [{ period: "2026-Q3", due: "2026-09-30", status: "done", done_at: "2026-10-02" }, { period: "2026-Q4", due: "2026-12-31", status: "open" }] },
];
const roll = buildRollups({ events, tasks, plans, reviews, today: "2026-10-23" });
const oct = roll.months.find(m => m.key === "2026-10");
assert.equal(oct.modules.life.topic, 1);
assert.equal(oct.modules.life.note, 1);
assert.equal(oct.topics.running.note, 1);
assert.equal(oct.modules.kb.kb, 1);
assert.equal(oct.modules.learn.note, 1);
assert.equal(oct.modules.content.note, 1);
assert.equal(oct.total.note, 2);
assert.equal(totalOf(oct.total), 4);
assert.equal(oct.tasks.planned, 2);
assert.equal(oct.tasks.done, 1);
assert.equal(oct.plans.planned, 2);
assert.equal(oct.plans.done, 1);
assert.equal(oct.reviews.expected, 4);
assert.equal(oct.reviews.done, 1);
const sep = roll.months.find(m => m.key === "2026-09");
assert.equal(sep.reviews.expected, 5);
assert.equal(sep.reviews.done, 1);
const touched = roll.weeks.find(w => w.key === weekKey("2026-10-22"));
assert.equal(touched.modules.life?.note || 0, 0);
const doneWeek = roll.weeks.find(w => w.key === weekKey("2026-10-12"));
assert.equal(doneWeek.reviews.done, 1);
assert.equal(doneWeek.reviews.expected, 1);
assert.equal(roll.current.month, "2026-10");

const topics = [
  { id: "running", title: "跑步", module: "life", status: { lifecycle: "active" }, tracking: { cadence: "FREQ=WEEKLY" }, started: "2026-08-01", entries: [{ date: "2026-10-13" }, { date: "2026-10-20" }] },
  { id: "money", title: "财务", module: "life", status: { lifecycle: "active" }, tracking: { cadence: "FREQ=MONTHLY" }, started: "2026-10-03", entries: [] },
  { id: "desk", title: "书桌", module: "life", status: { lifecycle: "proposed" }, tracking: { cadence: "FREQ=WEEKLY" }, entries: [] },
];
const cov = buildCoverage({
  events, topics, reviews, today: "2026-10-23",
  modules: [{ id: "life", title: "生活" }, { id: "work", title: "工作" }, { id: "learn", title: "学习" }],
});
const life = cov.modules.find(m => m.id === "life");
assert.equal(life.last, "2026-10-13");
assert.equal(life.days, 10);
assert.equal(life.status, "活跃");
assert.equal(life.longestGap, 12);
assert.equal(life.weeks.length, 12);
assert.ok(life.activeWeeks >= 2);
assert.equal(cov.modules.find(m => m.id === "work").status, "停滞");
const running = cov.topics.find(t => t.id === "running");
assert.equal(running.weeks.length, 12);
assert.equal(running.missing.includes(weekKey("2026-10-13")), false);
assert.equal(running.missing.includes(weekKey("2026-10-20")), false);
assert.ok(running.missing.length >= 1);
assert.ok(cov.topics.find(t => t.id === "money").missing.includes("2026-10"));
const desk = cov.topics.find(t => t.id === "desk");
assert.equal(desk.status, "提议");
assert.equal(desk.lifecycle, "proposed");
assert.equal(desk.missing.length, 0);
assert.equal(cov.topics.find(t => t.id === "money").status, "停滞");
assert.ok(cov.missingReviews.some(r => r.id === "w" && r.kind === "weekly" && r.period === weekKey("2026-10-23")));
assert.equal(cov.missingReviews.some(r => r.period === "2026-Q4"), false);
const ordered = orderCoverage(cov.modules, cov.topics, { sort: "days", dir: "desc" });
assert.equal(ordered.at(-1).id, "desk");
assert.notEqual(ordered[0].id, "desk");
assert.equal(orderCoverage(cov.modules, cov.topics, { hideProposed: true }).some(r => r.id === "desk"), false);
const periods = cov.topics.reduce((n, t) => n + t.missing.length, 0);
assert.equal(periods, running.missing.length + cov.topics.find(t => t.id === "money").missing.length);
const stats = analysisStats(roll, cov);
assert.match(stats.line, /this month 4/);
assert.match(stats.coverage, /modules 活跃 2 · 偏久 0 · 停滞 1/);
assert.match(stats.coverage, /topics 活跃 1 · 偏久 0 · 停滞 1 · 提议 1/);
assert.match(stats.coverage, /missing reviews 1/);
assert.equal(activityAgeText(57, "停滞"), "57 天 · 停滞");
assert.equal(activityAgeText(null, "停滞"), "停滞");
assert.equal(activityAgeText(7, "活跃"), "7 天");
assert.equal(structuralCue("2026-10-16", "2026-08-27", "2026-10-23"), 7);
assert.equal(structuralCue("2026-08-01", "2026-08-27", "2026-10-23"), null);
assert.equal(structuralCue("2026-08-27", "2026-08-27", "2026-10-23"), null);
assert.equal(structuralLabel(7), "结构更新 7 天前");
const recs = [
  { root: "life", updated: "2026-10-16", origin: { source_path: "work/REORG.md" } },
  { root: "life", updated: "2026-10-20", origin: { source_path: "work/note.md" } },
  { root: "life", updated: "2026-10-22", origin: { source_path: "work/index.md" } },
  { root: "life", updated: "2026-09-01", origin: { source_path: "life/health/sleep.md" } },
];
assert.equal(latestStructuralDate(["work"], recs), "2026-10-22");
assert.equal(latestStructuralDate(["life/health"], recs), null);

assert.equal(quarterKey("2026-10-23"), "2026-Q4");
assert.equal(shiftMonth("2026-01", -1), "2025-12");
assert.equal(shiftQuarter("2026-Q1", -1), "2025-Q4");
const w41 = isoWeekBounds("2026-W41");
assert.equal(w41.start, "2026-10-05");
assert.equal(w41.end, "2026-10-11");
assert.equal(weekKey(w41.start), "2026-W41");
assert.equal(weekKey(w41.end), "2026-W41");

const mods = [{ id: "life", title: "生活" }, { id: "work", title: "工作" }];
const cmp = comparePeriods({ events, modules: mods, topics, today: "2026-10-23", kind: "month" });
assert.equal(cmp.current.key, "2026-10");
assert.equal(cmp.previous.key, "2026-09");
assert.equal(cmp.yoy, null);
const lifeRow = cmp.rows.find(r => r.id === "life");
assert.equal(lifeRow.events, 2);
assert.ok(lifeRow.deltaEvents >= 1);
const withYear = comparePeriods({
  events: [...events, { date: "2025-10-15", type: "note", touch: false, modules: ["life"], topics: [], module: "life" }],
  modules: mods, topics, today: "2026-10-23", kind: "month",
});
assert.equal(withYear.yoy.key, "2025-10");
assert.equal(withYear.rows.find(r => r.id === "life").yoyEvents, 1);
assert.equal(comparePeriods({ events, modules: mods, topics, today: "2026-10-23", kind: "quarter" }).current.key, "2026-Q4");

assert.equal(effortKind({ type: "topic", touch: false }), "primary");
assert.equal(effortKind({ type: "note", touch: false, path: "life/journal/daily/2026-10-13.md" }), "primary");
assert.equal(effortKind({ type: "note", touch: false, path: "review/daily/2026-10-13.md" }), "primary");
assert.equal(effortKind({ type: "kb", touch: false, path: "cs/哈希表.md" }), "note");
assert.equal(effortKind({ type: "task", touch: false }), null);
assert.equal(effortKind({ type: "note", touch: true, path: "life/journal/daily/x.md" }), null);
const effort = effortMonths({
  events: [...events, { date: "2026-10-14", type: "note", touch: false, path: "life/journal/daily/2026-10-14.md", modules: ["life"], module: "life" }],
  modules: mods, today: "2026-10-23",
});
assert.equal(effort.months.length, 6);
assert.equal(effort.months.at(-1).key, "2026-10");
assert.equal(effort.months.at(-1).by.life.primary, 2);
assert.match(effort.note, /不含 commit/);

assert.equal(instanceStatus({ status: "open", due: "2026-10-04" }, "2026-10-23"), "overdue");
assert.equal(instanceStatus({ status: "done", due: "2026-10-04" }, "2026-10-23"), "done");
assert.equal(instanceStatus({ status: "open", due: "2026-12-31" }, "2026-10-23"), "open");
const snap = reviewSnapshot({
  events: [
    { date: "2026-06-20", type: "topic", touch: false, topics: ["fade"], topic: "fade", modules: ["life"], module: "life" },
    { date: "2026-01-02", type: "note", touch: false, topics: ["back"], topic: "back", modules: ["work"], module: "work" },
    { date: "2026-09-20", type: "topic", touch: false, topics: ["back"], topic: "back", modules: ["work"], module: "work" },
    { date: "2026-09-01", type: "note", touch: false, path: "life/health/a.md", topics: [], modules: ["life"], module: "life", title: "跑步", href: "#n" },
  ],
  topics: [
    { id: "fade", title: "淡出", status: { lifecycle: "active" }, entries: [] },
    { id: "back", title: "回来", status: { lifecycle: "active" }, entries: [{ date: "2026-09-01", kind: "milestone", title: "Chirp 账号建立" }] },
    { id: "desk", title: "书桌", status: { lifecycle: "proposed" }, entries: [{ date: "2026-09-02", kind: "milestone", title: "忽略" }] },
  ],
  tasks, plans, period: "2026-Q3", today: "2026-10-23",
});
assert.equal(snap.movement.find(m => m.id === "fade").change, "stale");
assert.equal(snap.movement.find(m => m.id === "back").change, "recovered");
assert.equal(snap.movement.some(m => m.id === "desk"), false);
assert.equal(snap.milestones[0].text, "Chirp 账号建立");
assert.equal(snap.milestones.some(m => m.topic === "desk"), false);
assert.equal(snap.notes[0].title, "跑步");
assert.equal(snap.modules.life, 1);
assert.equal("amount" in snap, false);

console.log("analysis: ok");
