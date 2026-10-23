// 时间线: dated events from timeline.json, grouped by month or week.
import { loadTimeline, moduleList, topics } from "../data.js";
import { routeOfModule } from "../module-model.js";
import { weekKey } from "../timeline-model.js";
import { esc, header } from "../ui.js";

const TYPE = { note: "笔记", topic: "主题", task: "任务", review: "复盘", kb: "知识" };

function href(P, over) {
  const n = new URLSearchParams();
  const base = { module: P.get("module") || "", topic: P.get("topic") || "", type: P.get("type") || "", group: P.get("group") || "", ...over };
  for (const [k, v] of Object.entries(base)) if (v) n.set(k, v);
  const s = n.toString();
  return s ? `#timeline?${s}` : "#timeline";
}

function chips(label, current, options, P, key) {
  return `<div class="filters"><span class="fl">${label}</span><a class="fchip ${!current ? "on" : ""}" href="${href(P, { [key]: "" })}">全部</a>${options.map(([id, text]) => `<a class="fchip ${current === id ? "on" : ""}" href="${href(P, { [key]: id })}">${esc(text)}</a>`).join("")}</div>`;
}

export default async function timelinePage(_sub, P = new URLSearchParams()) {
  const all = await loadTimeline();
  const mods = moduleList() || [];
  const tops = topics();
  const module = P.get("module") || "", topic = P.get("topic") || "", type = P.get("type") || "", group = P.get("group") === "week" ? "week" : "month";
  const events = all.filter(e => (!module || (e.modules || []).includes(module) || e.module === module) && (!topic || (e.topics || []).includes(topic) || e.topic === topic) && (!type || e.type === type));
  const title = module ? (mods.find(m => m.id === module)?.title || module) : topic ? (tops.find(t => t.id === topic)?.title || topic) : "";
  const groups = [];
  const seen = new Map();
  const keyOf = e => group === "week" ? weekKey(e.date) : String(e.date || "").slice(0, 7);
  for (const e of events) {
    const k = keyOf(e);
    if (!seen.has(k)) { const b = { key: k, events: [] }; seen.set(k, b); groups.push(b); }
    seen.get(k).events.push(e);
  }
  const modName = id => mods.find(m => m.id === id)?.title || (id === "kb" ? "知识" : id);
  const row = e => {
    const badges = (e.modules || []).map(id => `<a class="pill" href="#${routeOfModule(id)}">${esc(modName(id))}</a>`).join("");
    const topicLink = e.topic ? `<a class="pill" href="#topics/${encodeURIComponent(e.topic)}">${esc(tops.find(t => t.id === e.topic)?.title || e.topic)}</a>` : "";
    return `<div class="tl-item"><span class="mono">${esc(e.date)}</span><span class="tag">${esc(TYPE[e.type] || e.type)}</span><a class="t" href="${esc(e.href)}">${esc(e.title)}</a><span class="ov-mods">${badges}${topicLink}</span></div>`;
  };
  const body = events.length ? groups.map(g => `<section class="tl-group"><h2 class="tl-h">${esc(g.key)}<span class="more">${g.events.length}</span></h2>${g.events.map(row).join("")}</section>`).join("") : `<p class="empty">这个范围里没有事件。</p>`;
  const modOpts = mods.map(m => [m.id, m.title]);
  const topicOpts = tops.map(t => [t.id, t.title]);
  const typeOpts = Object.entries(TYPE);
  return { html: header("时间线", "", [title || "全部", `${events.length} 条`], "笔记、主题记录、完成的任务、复盘，和知识库更新。", { actions: [[group === "week" ? "按月" : "按周", href(P, { group: group === "week" ? "" : "week" })]] })
    + `<div class="body">${chips("模块", module, modOpts, P, "module")}${chips("主题", topic, topicOpts, P, "topic")}${chips("类型", type, typeOpts, P, "type")}${body}</div>` };
}
