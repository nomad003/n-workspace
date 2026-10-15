// 总览: only items due within 7 days, risks, and agents (+ source sync in the rail).
import { overview } from "../core.js";
import { bundle, V, AGENTS, agentState, openTasks } from "../data.js";
import { esc, header, kpis, card, urow, more } from "../ui.js";
const LV = { high: ["err", "高"], medium: ["modes", "中"], low: ["infra", "低"] };
export default function () {
  const v = V.overview, o = overview(bundle, v), days = v.due_days ?? 7;
  const due = o.upcoming.filter(u => u.days <= days), next = o.upcoming.find(u => u.days > days);
  const high = o.alerts.filter(a => a.level === "high").length;
  const ags = AGENTS.map(agentState), active = ags.filter(a => a.label !== "空闲").length;
  const src = (bundle.sources || []).filter(s => s.role !== "reserved"), ok = src.filter(s => s.present).length;
  const today = new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "short" });
  const al = a => `<div class="al L-${LV[a.level][0]}"><span class="lv">${LV[a.level][1]}</span>${esc(a.msg)}</div>`;
  const main = `${kpis([[due.length, `${days} 天内到期`, { warn: due.some(u => u.days < 0) }], [o.alerts.length, `风险 · 高 ${high}`, { warn: high > 0 }], [`${active}/${AGENTS.length}`, "Agents 活跃"], [openTasks().length, "未完成任务", { href: "#affairs/tasks" }], [`${ok}/${src.length}`, "数据源已同步", { href: "#sources" }]])}
    <div class="grid">${card(`${days} 天内到期`, due.length ? `<div class="ulist">${due.map(u => urow(u.date, u.approx, esc(u.name), `${esc(u.kind)} · ${esc(u.date)}`, esc(u.extra || ""))).join("")}</div>`
      : `<p class="empty">${days} 天内没有到期项。${next ? `下一项：<b>${esc(next.name)}</b>（${esc(next.kind)}，${next.days} 天后）` : ""}</p>`, { span: "s12", right: `${due.length} 项` })}</div>
    <div class="grid">${card("风险", o.alerts.length ? o.alerts.slice(0, 5).map(al).join("") + (o.alerts.length > 5 ? more(o.alerts.length - 5, o.alerts.slice(5).map(al).join(""), "展开其余") : "") : `<p class="empty">暂无风险</p>`, { span: "s12", right: `${o.alerts.length} 条` })}</div>`;
  const rail = `<section class="rbox"><h4>Agents<span>${o.agentTasks.length} 任务</span></h4><div class="agents in-rail">${ags.map(a => `<div class="ag L-${a.c}"><span class="st"></span><span class="lb">${esc(a.name)}</span><span class="cnt">${a.tasks.length || ""}</span><span class="sl">${a.label}</span></div>`).join("")}</div></section>
    <section class="rbox"><h4>数据源</h4>${src.map(s => `<div class="mr"><span class="sd L-${s.present ? "ai" : "err"}">${esc(s.name)}</span><small>${esc(s.meta?.commit?.slice(0, 7) || "—")} · ${s.meta?.fetched_at ? esc(new Date(s.meta.fetched_at).toLocaleString("zh-CN", { hour12: false, month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })) : "未同步"}</small></div>`).join("")}<p class="note"><a href="#sources">查看数据源 →</a></p></section>`;
  return { html: header(`总览 · ${esc(today)}`, "coding", []) + `<div class="pg"><div class="body pg-main">${main}</div><aside class="rail">${rail}</aside></div>` };
}
