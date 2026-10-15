// 事务: tasks, 生活事务, 日记.
import { V, M, tasks, openTasks, stageOf, TSTAGE, isLifeTask, isAgentTask, taskDue, daysUntil, notesWhere, noteBody, byId } from "../data.js";
import { esc, header, tabs, table, more, card, steps, urow, noteList, pending, countUnknown, noteHref } from "../ui.js";
import { stackedBars } from "../charts.js";
export default async function (sub = "tasks") {
  const v = V.affairs, ts = tasks(), life = ts.filter(isLifeTask), lifeNotes = notesWhere(v.life_notes), daily = notesWhere(v.daily_notes).filter(r => !/MOC/i.test(r.title));
  const t = tabs("affairs", [["tasks", "任务", openTasks().length], ["life", "生活事务", life.length + lifeNotes.length], ["daily", "日记", daily.length]], sub);
  const head = header("事务", "agent", [`${openTasks().length} 未完成`, `${daily.length} 篇日记`]) + t;
  if (sub === "life") {
    const due = life.map(x => ({ x, d: taskDue(x) })).filter(y => y.d).sort((a, b) => a.d.date.localeCompare(b.d.date));
    return { html: head + `<div class="body">${pending(countUnknown(life), "生活任务")}<div class="grid">
      ${card("行动清单 · 最近截止", due.length ? `<div class="ulist">${due.slice(0, 6).map(({ x, d }) => urow(d.date, d.approx, esc(x.title), esc(x.id || ""))).join("")}</div>` : `<p class="empty">无可推断截止日期</p>`, { span: "s6", right: `${life.length} 项` })}
      ${card("生活笔记 · 最近更新", noteList(lifeNotes, 8), { span: "s6", right: `${lifeNotes.length} 篇` })}</div>
      ${more(life.length, table(life, v.task_columns), "展开全部任务")}${more(lifeNotes.length, noteList(lifeNotes, 999), "展开全部笔记")}</div>` };
  }
  if (sub === "daily") {
    const latest = daily[0], body = latest ? await noteBody(latest) : null;
    return { html: head + `<div class="body"><div class="grid">${card("日记", noteList(daily, 12), { span: "s4", right: `${daily.length} 篇` })}
      ${card(latest ? `最新 · ${esc(latest.title)}` : "最新", body ? `<article class="md clip">${body.html}</article><p class="note"><a href="${noteHref(latest)}">打开全文 →</a></p>` : `<p class="empty">无日记</p>`, { span: "s8" })}</div>
      ${daily.length > 12 ? more(daily.length, noteList(daily, 999)) : ""}</div>` };
  }
  const open = openTasks(), soon = open.map(x => ({ x, d: taskDue(x) })).sort((a, b) => (a.d?.date || "9999").localeCompare(b.d?.date || "9999"));
  const owners = [...new Set(ts.map(x => x.owner ?? "?"))].sort((a, b) => a === "user" ? -1 : b === "user" ? 1 : a.localeCompare(b));
  return { html: head + `<div class="body">${pending(countUnknown(ts), "任务")}
    ${steps(TSTAGE.map(([id, label, c]) => ({ k: label, c, n: ts.filter(x => stageOf(x) === id).length })))}
    <div class="grid">${card("接下来", `<div class="ulist">${soon.slice(0, 6).map(({ x, d }) => d ? urow(d.date, d.approx, esc(x.title), `${esc(x.id)} · ${esc(x.owner)}`) : `<div class="urow L-infra"><span class="cd L-infra">—</span><div><b>${esc(x.title)}</b><span class="m">${esc(x.id)} · ${esc(x.owner)} · 无截止</span></div></div>`).join("")}</div>`, { span: "s7" })}
      ${card("按负责人", stackedBars(owners.map(o => ({ label: o, parts: TSTAGE.map(([id, label, c]) => ({ c, label, v: ts.filter(x => (x.owner ?? "?") === o && stageOf(x) === id).length })) })), { h: 220, W: 420, series: TSTAGE.map(([id, label, c]) => ({ c, label, v: ts.filter(x => stageOf(x) === id).length })) }), { span: "s5" })}</div>
    ${more(ts.length, table(ts, v.task_columns), "展开全部任务")}</div>` };
}
