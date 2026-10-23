// One read-only page per review instance: #reviews/<id>/<period>. Counts only — no amounts.
import { loadTimeline, moduleList, plansV9, reviews, tasks, topics } from "../data.js";
import { instanceStatus, reviewSnapshot } from "../analysis-model.js";
import { dueEnd } from "../core.js";
import { routeOfModule, todayStamp } from "../module-model.js";
import { esc, header } from "../ui.js";

const KIND = { quarterly: "季度复盘", annual: "年度复盘", monthly: "月度复盘", weekly: "周复盘" };
const ST = { done: "已完成", open: "待完成", overdue: "逾期", skipped: "跳过" };

export default async function reviewPage(id, _P, rest = []) {
  const period = rest[0] || "";
  const rev = reviews().find(r => r.id === id);
  const inst = rev?.instances?.find(i => i.period === period);
  if (!rev || !inst) return { html: header("复盘", "", [], "没有这场复盘。", { actions: [["复盘", "#review"]] }) };
  const today = todayStamp();
  const status = instanceStatus({ ...inst, due: dueEnd(inst.due) || inst.due }, today);
  const events = await loadTimeline();
  const snap = reviewSnapshot({ events, topics: topics(), tasks: tasks(), plans: plansV9(), period, today });
  const mods = moduleList() || [];
  const name = mid => mods.find(m => m.id === mid)?.title || mid;
  const modRows = Object.entries(snap?.modules || {}).sort((a, b) => b[1] - a[1]);
  const topicRows = Object.entries(snap?.topics || {}).sort((a, b) => b[1] - a[1]);
  const topicTitle = tid => topics().find(t => t.id === tid)?.title || tid;
  const modList = modRows.length ? modRows.map(([k, n]) => `<div class="cov-row"><a href="#${routeOfModule(k)}">${esc(name(k))}</a><span class="mono">${n}</span></div>`).join("") : `<p class="empty">这段时间没有模块活动。</p>`;
  const topList = topicRows.length ? topicRows.map(([k, n]) => `<div class="cov-row"><a href="#topics/${encodeURIComponent(k)}">${esc(topicTitle(k))}</a><span class="mono">${n}</span></div>`).join("") : `<p class="empty">这段时间没有主题活动。</p>`;
  const moved = (snap?.movement || []).map(m => `<li>${esc(m.title)} ${m.change === "stale" ? "变停滞" : "恢复"} <span class="muted">${esc(m.from)} → ${esc(m.to)}</span></li>`).join("");
  const miles = (snap?.milestones || []).map(m => `<li><a href="#topics/${encodeURIComponent(m.topic)}">${esc(m.title)}</a> · ${esc(m.text)} <span class="mono">${esc(m.date)}</span></li>`).join("");
  const notes = (snap?.notes || []).map(n => `<a class="row r2" href="${n.href || "#"}"><span class="t">${esc(n.title || "笔记")}</span><span class="tag">${esc(n.date || "")}</span></a>`).join("");
  const checks = (rev.checklist || []).map(c => `<li>${esc(String(c))}</li>`).join("");
  const done = snap?.tasks || { done: 0, planned: 0 }, plans = snap?.plans || { done: 0, planned: 0 };
  return { html: header(period, "", [KIND[rev.kind] || rev.kind, ST[status] || status, "只读"], `${esc(snap?.period?.start || "")} – ${esc(snap?.period?.end || "")}${inst.done_at ? ` · 完成于 ${esc(inst.done_at)}` : ""}`, { actions: [["复盘", "#review"], ["时间线", "#timeline"]] })
    + `<div class="body an">
      <div class="roll-g"><div class="roll-c"><div class="k">任务</div><div class="n">${done.done}<small>/${done.planned}</small></div><div class="s">完成 / 计划内</div></div>
      <div class="roll-c"><div class="k">计划</div><div class="n">${plans.done}<small>/${plans.planned}</small></div><div class="s">完成 / 覆盖这段时间</div></div></div>
      <h2 class="ov-sec">模块</h2><div class="cov pair">${modList}</div>
      <h2 class="ov-sec">主题</h2><div class="cov pair">${topList}</div>
      <h2 class="ov-sec">停滞与恢复</h2>${moved ? `<ul class="miss">${moved}</ul>` : `<p class="empty">没有主题在这段时间里变停滞或恢复。</p>`}
      <h2 class="ov-sec">里程碑</h2>${miles ? `<ul class="miss">${miles}</ul>` : `<p class="empty">没有里程碑落在这段时间。</p>`}
      <h2 class="ov-sec">清单</h2>${checks ? `<ul class="plain">${checks}</ul>` : `<p class="empty">这场复盘没有清单。</p>`}
      <h2 class="ov-sec">笔记</h2>${notes ? `<div class="rows">${notes}</div>` : `<p class="empty">这段时间没有笔记。</p>`}
    </div>` };
}
