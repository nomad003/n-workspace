import assert from "node:assert/strict";
import { buildCalendar, dailyDate, monthWeeks, parseWeekBody, realWeek, weekOfNote, wikiLabel } from "../app/src/calendar-model.js";
import { weekKey } from "../app/src/timeline-model.js";

assert.equal(wikiLabel("对照 [[running-log|跑步记录]]"), "对照 跑步记录");
assert.equal(wikiLabel("见 [[review/weekly/2026-W41#周五]]"), "见 review/weekly/2026-W41");

const parsed = parseWeekBody(`# 忽略
## 工作
- [x] 写完提纲
- [ ] 补一段说明 [[demo|演示]]
正文不算事项
## 学习
- [X] 读完一节
## 周五复盘
跑完了。见 [[running-log|跑步记录]]。
- [x] 这条复盘里的勾选不计入进度
`);
assert.equal(parsed.done, 2);
assert.equal(parsed.total, 3);
assert.deepEqual(parsed.sections.map(s => s.title), ["工作", "学习"]);
assert.equal(parsed.sections[0].items[1].text, "补一段说明 演示");
assert.equal(parsed.sections[0].items[1].done, false);
assert.match(parsed.retro, /跑步记录/);
assert.equal(parsed.retro.includes("[x]"), false);

assert.equal(weekKey("2026-01-01"), "2026-W01");
assert.equal(weekKey("2025-12-29"), "2026-W01");
assert.equal(weekKey("2026-12-31"), "2026-W53");
assert.equal(weekKey("2021-01-01"), "2020-W53");
assert.equal(realWeek("2026-W53"), "2026-W53");
assert.equal(realWeek("2026-W54"), "");
assert.equal(realWeek("2026-W00"), "");

const edge = buildCalendar({
  notes: [
    { path: "review/weekly/2026-W53.md", title: "跨年", text: "## 生活\n- [ ] 元旦前把清单写完\n", period: "2026-W53" },
    { path: "review/weekly/old.md", title: "旧文件名", text: "## 工作\n- [x] 归档\n", start: "2021-01-01" },
    { path: "review/weekly/2026-W01.md", title: "被覆盖", text: "## 工作\n- [ ] 不要用这篇\n", week: "2026-W53" },
    { path: "life/journal/weekly/2026-W41.md", title: "旧路径", text: "## 工作\n- [x] 旧\n- [x] 旧二\n", period: "2026-W41" },
    { path: "review/weekly/2026-W41.md", title: "新路径", text: "## 工作\n- [x] 新\n", period: "2026-W41" },
    { path: "review/daily/2026/06/2026-06-10.md", title: "白天", date: "2026-06-10", text: "" },
    { path: "review/daily/2026/06/2026-06-10-AI模型切换.md", title: "模型切换", text: "" },
    { path: "life/journal/daily/2026/01/2026-01-01.md", title: "元旦", text: "" },
    { path: "review/daily/index.md", title: "索引", date: "2026-06-10", text: "" },
  ],
  events: [
    { date: "2026-06-10", touch: false, type: "note", title: "白天", href: "#n1" },
    { date: "2026-06-10", touch: true, type: "note", title: "结构", href: "#skip" },
    { date: "2026-06-10", touch: false, type: "topic", title: "主题一条", href: "#t" },
    { date: "2026-12-31", touch: false, type: "kb", title: "跨年笔记", href: "#k" },
  ],
  tasks: [
    { id: "t-a", title: "到期", due: "2026-06-10", done_at: null },
    { id: "t-b", title: "完成", due: "2026-06-09", done_at: "2026-06-10" },
    { id: "t-c", title: "只有月份", due: "2026-06", done_at: null },
  ],
  reviews: [
    { id: "r-weekly", kind: "weekly", instances: [{ period: "2026-W23", due: "2026-06-10", status: "open" }] },
  ],
});

const w53 = edge.weeks["2026-W53"];
assert.equal(w53.start, "2026-12-28");
assert.equal(w53.end, "2027-01-03");
assert.equal(w53.source, "life://review/weekly/2026-W53");
assert.equal(w53.total, 1);
assert.equal(edge.weeks["2026-W01"], undefined);
assert.equal(edge.weeks["2020-W53"].source, "life://review/weekly/old");
assert.equal(edge.weeks["2020-W53"].start, "2021-01-01");
assert.equal(edge.weeks["2020-W53"].end, "2021-01-03");
assert.equal(edge.weeks["2026-W41"].source, "life://review/weekly/2026-W41");
assert.equal(edge.weeks["2026-W41"].done, 1);

const june = edge.days["2026-06-10"];
assert.deepEqual(june.notes.map(n => n.title), ["白天", "模型切换"]);
assert.equal(june.events.count, 2);
assert.equal(june.events.items.some(e => e.title === "结构"), false);
assert.deepEqual(june.tasks_due.map(t => t.id), ["t-a"]);
assert.deepEqual(june.tasks_done.map(t => t.id), ["t-b"]);
assert.equal(june.reviews_due[0].period, "2026-W23");
assert.equal(edge.days["2026-01-01"].notes[0].source, "life://life/journal/daily/2026/01/2026-01-01");
assert.equal(dailyDate({ path: "review/daily/2026/06/2026-06-10-AI模型切换.md" }), "2026-06-10");
assert.equal(weekOfNote({ path: "review/weekly/2026-W54.md", period: "2026-W54" }), "");

const oct = monthWeeks("2026-10");
assert.equal(oct[0].days[0], "2026-09-28");
assert.equal(oct[0].days[6], "2026-10-04");
assert.equal(oct.at(-1).days[0], "2026-10-26");
assert.equal(new Date(oct[0].days[0] + "T00:00:00Z").getUTCDay(), 1);

const custom = buildCalendar({
  notes: [{ path: "review/weekly/2026-W44.md", text: "## 生活\n- [ ] 一件\n", period: "2026-W44", start: "2026-10-26", end: "2026-11-02" }],
});
assert.equal(custom.weeks["2026-W44"].start, "2026-10-26");
assert.equal(custom.weeks["2026-W44"].end, "2026-11-02");

console.log("calendar: ok");
