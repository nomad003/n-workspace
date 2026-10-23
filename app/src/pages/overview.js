// 总览: one card per module, then the topic axis. Read-only. No amounts.
import { records, topics, moduleList, loadRollups } from "../data.js";
import { rollupCard } from "./rollup-card.js";
import { moduleNoteStats, topicCounts, topicModuleIds, ageTone, routeOfModule, daysSince, todayStamp } from "../module-model.js";
import { esc, header } from "../ui.js";
import { stale as topicStale } from "./topics.js";

const LC = { active: "进行中", paused: "暂停", done: "完成", archived: "归档", proposed: "提议" };

function ageText(days) {
  if (days == null) return "—";
  if (days <= 0) return "今天";
  const mark = days >= 30 ? " · 很久" : days >= 14 ? " · 偏久" : "";
  return `${days} 天${mark}`;
}

function topicRow(t, mods, today) {
  const badges = topicModuleIds(t).map(id => {
    const m = mods.find(x => x.id === id);
    return `<a class="pill" href="#${routeOfModule(id)}">${esc(m?.title || id)}</a>`;
  }).join("");
  const life = t.status?.lifecycle;
  const days = daysSince(t.last, today);
  const shown = days == null ? null : Math.max(0, days);
  const stalled = life === "active" && topicStale(t);
  return `<div class="ov-row">
    <a class="ov-title" href="#topics/${encodeURIComponent(t.id)}">${esc(t.title)}</a>
    <span class="ov-mods">${badges || "—"}</span>
    <span>${esc(LC[life] || life || "—")}</span>
    <span class="mono">${esc(t.last || "—")}</span>
    <span class="age ${ageTone(shown)}">${ageText(shown)}${stalled ? " · 停滞" : ""}</span>
  </div>`;
}

export default async function overview() {
  const mods = moduleList();
  const today = todayStamp();
  const roll = rollupCard(await loadRollups());
  if (!mods) return { html: header("总览", "", [], "这份数据还没有模块。", { actions: [["时间线", "#timeline"], ["分析", "#analysis"]] }) + (roll ? `<div class="body ov">${roll}</div>` : "") };
  const all = topics();
  const cards = mods.map(m => {
    const stats = moduleNoteStats(m, records, today);
    const counts = topicCounts(m.id, all);
    const tone = ageTone(stats.days);
    const owners = (m.owners || []).join(" · ");
    return `<a class="ov-card" href="#${routeOfModule(m.id)}">
      <div class="ov-kicker">模块</div>
      <h2>${esc(m.title)}</h2>
      <p class="ov-own">${owners ? esc(owners) : "未指定负责 bot"}</p>
      <dl class="ov-stats">
        <div><dt>笔记</dt><dd>${stats.count}</dd></div>
        <div><dt>最近更新</dt><dd>${esc(stats.latest || "—")}</dd></div>
        <div><dt>距上次更新</dt><dd class="age ${tone}">${ageText(stats.days)}</dd></div>
        <div><dt>主题</dt><dd>${counts.active} 进行中 · ${counts.proposed} 提议</dd></div>
      </dl>
    </a>`;
  }).join("");
  const proposed = all.filter(t => t.status?.lifecycle === "proposed").sort((a, b) => String(b.last).localeCompare(String(a.last)));
  const rest = all.filter(t => t.status?.lifecycle !== "proposed").sort((a, b) => (a.status?.lifecycle !== "active") - (b.status?.lifecycle !== "active") || String(b.last).localeCompare(String(a.last)));
  const headRow = `<div class="ov-row ov-head"><span>主题</span><span>模块</span><span>状态</span><span>最近记录</span><span>距今</span></div>`;
  const strip = rest.length ? `<div class="ov-strip">${headRow}${rest.map(t => topicRow(t, mods, today)).join("")}</div>` : `<p class="empty">还没有进行中的主题。</p>`;
  const proposedBlock = proposed.length ? `<h2 class="ov-sec">提议</h2><p class="ov-note">这些主题还没开始，单独列在这里。</p><div class="ov-strip">${proposed.map(t => topicRow(t, mods, today)).join("")}</div>` : "";
  return { html: header("总览", "", [`${mods.length} 个模块`, `${all.length} 个主题`], "按模块看笔记更新，按主题看做到哪一步。", { actions: [["时间线", "#timeline"], ["分析", "#analysis"]] }) + `<div class="body ov">${roll}<div class="ov-grid">${cards}</div><h2 class="ov-sec">主题</h2>${strip}${proposedBlock}</div>` };
}
