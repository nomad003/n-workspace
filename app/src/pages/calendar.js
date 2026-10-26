// 日历: month grid and one ISO week. Read-only. Plans come from weekly notes; days from daily notes, tasks, reviews, and the timeline.
import { loadCalendar, records } from "../data.js";
import { todayStamp } from "../module-model.js";
import { weekKey } from "../timeline-model.js";
import { isoWeekBounds, shiftMonth } from "../analysis-model.js";
import { monthWeeks, realWeek, shiftWeek } from "../calendar-model.js";
import { esc, header, noteHref } from "../ui.js";

const WD = ["一", "二", "三", "四", "五", "六", "日"];
const KIND = { quarterly: "季度复盘", annual: "年度复盘", monthly: "月度复盘", weekly: "周复盘" };
const TYPE = { note: "笔记", topic: "主题", task: "任务", review: "复盘", kb: "知识" };

function noteLink(source) {
  const bare = String(source || "").replace(/^life:\/\//, "").replace(/\.md$/i, "");
  const rec = records.find(r => r.root === "life" && String(r.origin?.source_path || "").replace(/\.md$/i, "") === bare);
  return rec ? noteHref(rec) : "";
}

function heat(n) {
  if (!n) return 0;
  if (n === 1) return 1;
  if (n < 4) return 2;
  return 3;
}

function progress(week) {
  if (!week) return "—";
  return `${week.done}/${week.total}`;
}

function dayBits(day) {
  if (!day) return "";
  const bits = [];
  if (day.notes?.length) bits.push(`<span class="cal-bit note" title="日记">${day.notes.length}</span>`);
  const ev = day.events?.count || 0;
  if (ev) bits.push(`<i class="cal-heat h${heat(ev)}" title="时间线 ${ev}"></i>`);
  if (day.tasks_due?.length) bits.push(`<span class="cal-bit due">待${day.tasks_due.length}</span>`);
  if (day.tasks_done?.length) bits.push(`<span class="cal-bit done">完${day.tasks_done.length}</span>`);
  if (day.reviews_due?.length) bits.push(`<span class="cal-bit rev">复盘</span>`);
  return bits.join("");
}

function monthPage(cal, ym, today) {
  const weeks = monthWeeks(ym);
  const label = ym.replace("-", "年") + "月";
  const prev = shiftMonth(ym, -1), next = shiftMonth(ym, 1);
  const here = today.slice(0, 7);
  const focus = ym === here ? weekKey(today) : (weeks.find(w => w.days.includes(`${ym}-01`))?.week || weeks[0]?.week || "");
  const head = `<div class="cal-dow"><span></span>${WD.map(d => `<span>${d}</span>`).join("")}</div>`;
  const rows = weeks.map(w => {
    const plan = cal.weeks?.[w.week];
    const cells = w.days.map(d => {
      const outside = d.slice(0, 7) !== ym;
      const day = cal.days?.[d];
      return `<div class="cal-cell${outside ? " out" : ""}${d === today ? " today" : ""}"><span class="cal-num">${+d.slice(8)}</span><span class="cal-bits">${dayBits(day)}</span></div>`;
    }).join("");
    return `<div class="cal-row"><a class="cal-wk" href="#calendar/week/${esc(w.week)}"><b>${esc(w.week.slice(6))}</b><span>${esc(progress(plan))}</span></a>${cells}</div>`;
  }).join("");
  return header("日历", "", [label, "月"], "一周一行。左边是周计划进度，格子里是日记、时间线上的活动、到期和完成的任务、该交的复盘。", {
    actions: [["上一月", `#calendar/month/${prev}`], ["今天", `#calendar/month/${here}`], ["下一月", `#calendar/month/${next}`], ["周视图", focus ? `#calendar/week/${focus}` : "#calendar"]],
  }) + `<div class="body cal">${head}${rows}</div>`;
}

function taskLinks(rows, kind) {
  if (!rows?.length) return "";
  return rows.map(t => `<a class="cal-li" href="#plan/board"><span class="cal-k">${kind}</span>${esc(t.title || t.id)}</a>`).join("");
}

function reviewLinks(rows) {
  if (!rows?.length) return "";
  return rows.map(r => `<a class="cal-li" href="#reviews/${encodeURIComponent(r.id)}/${encodeURIComponent(r.period)}"><span class="cal-k">复盘</span>${esc(KIND[r.kind] || r.kind || "复盘")} ${esc(r.period)}</a>`).join("");
}

function eventLinks(events) {
  const items = events?.items || [];
  if (!items.length) return "";
  const more = (events.count || 0) - items.length;
  return items.map(e => `<a class="cal-li" href="${esc(e.href || "#timeline")}"><span class="cal-k">${esc(TYPE[e.type] || "记录")}</span>${esc(e.title || "未命名")}</a>`).join("")
    + (more > 0 ? `<span class="cal-more">还有 ${more} 条</span>` : "");
}

function noteLinks(notes) {
  if (!notes?.length) return "";
  return notes.map(n => {
    const href = noteLink(n.source);
    const inner = esc(n.title || "日记");
    return href ? `<a class="cal-li" href="${href}"><span class="cal-k">日记</span>${inner}</a>` : `<span class="cal-li"><span class="cal-k">日记</span>${inner}</span>`;
  }).join("");
}

function planBody(week) {
  if (!week?.source && !week?.total) return `<p class="empty">这周还没有周计划。</p>`;
  const sections = (week.sections || []).map(s => {
    const items = s.items?.length ? s.items.map(it => `<li class="${it.done ? "on" : ""}"><i></i><span>${esc(it.text)}</span></li>`).join("") : `<li class="none">这一栏没有事项。</li>`;
    return `<h3>${esc(s.title)}</h3><ul class="cal-checks">${items}</ul>`;
  }).join("");
  const emptyPlan = week.source && !week.total && !(week.sections || []).length ? `<p class="empty">这周的周记还没有分项。</p>` : "";
  const bar = week.total ? `<div class="cal-prog"><span class="bar"><i style="width:${Math.round(week.done / week.total * 100)}%"></i></span><span class="mono">${week.done} / ${week.total}</span></div>` : "";
  const retro = week.retro ? `<h3>复盘</h3><p class="cal-retro">${esc(week.retro).replace(/\n/g, "<br>")}</p>` : "";
  const src = week.source ? (() => { const href = noteLink(week.source); return href ? `<p class="cal-src"><a href="${href}">打开周记</a></p>` : ""; })() : "";
  return `${bar}${emptyPlan}${sections}${retro}${src}`;
}

function dayColumn(date, day, today) {
  const body = `${noteLinks(day?.notes)}${taskLinks(day?.tasks_due, "到期")}${taskLinks(day?.tasks_done, "完成")}${reviewLinks(day?.reviews_due)}${eventLinks(day?.events)}`;
  const quiet = !body;
  return `<section class="cal-dcol${date === today ? " today" : ""}"><h3><span>${WD[(new Date(date + "T00:00:00Z").getUTCDay() + 6) % 7]}</span><b>${+date.slice(8)}</b></h3>${quiet ? `<p class="empty">这天没有记录。</p>` : body}</section>`;
}

function weekPage(cal, key, today) {
  const id = realWeek(key);
  const bounds = id ? isoWeekBounds(id) : null;
  if (!id || !bounds) {
    return header("日历", "", [], "没有这一周。", { actions: [["月视图", `#calendar/month/${today.slice(0, 7)}`], ["本周", `#calendar/week/${weekKey(today)}`]] })
      + `<div class="body"><p class="empty">周次需要是 ISO 周，例如 2026-W44。</p></div>`;
  }
  const week = cal.weeks?.[id];
  const days = [];
  for (let i = 0, d = bounds.start; i < 7; i++, d = shiftDate(d)) days.push(d);
  const cols = days.map(d => dayColumn(d, cal.days?.[d], today)).join("");
  return header("日历", "", [id, `${bounds.start} – ${bounds.end}`], "左边是这一周的计划，右边是七天里的日记、任务、复盘和时间线。只读。", {
    actions: [["上一周", `#calendar/week/${shiftWeek(id, -1)}`], ["本周", `#calendar/week/${weekKey(today)}`], ["下一周", `#calendar/week/${shiftWeek(id, 1)}`], ["月视图", `#calendar/month/${bounds.start.slice(0, 7)}`]],
  }) + `<div class="body cal-week"><section class="cal-plan"><h2>周计划 <span class="more">${esc(progress(week))}</span></h2>${planBody(week)}</section><div class="cal-cols">${cols}</div></div>`;
}

function shiftDate(iso) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default async function calendarPage(sub, _P, rest = []) {
  const cal = (await loadCalendar()) || { weeks: {}, days: {} };
  const today = todayStamp();
  if (sub === "week") return { html: weekPage(cal, rest[0] || weekKey(today), today) };
  const ym = sub === "month" && /^\d{4}-\d{2}$/.test(rest[0] || "") ? rest[0] : today.slice(0, 7);
  return { html: monthPage(cal, ym, today) };
}

export function weekCard(cal, today) {
  const id = weekKey(today);
  const week = cal?.weeks?.[id];
  const detail = week?.source ? `${week.done}/${week.total} 项` : "这周还没有周计划";
  return `<a class="cal-banner" href="#calendar/week/${esc(id)}"><span class="ov-kicker">本周</span><strong>${esc(id)}</strong><span>${esc(detail)}</span><span class="link">打开周视图</span></a>`;
}
