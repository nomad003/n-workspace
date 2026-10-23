// Compact 本周 / 本月 counts. Module pages pass a module id; 总览 shows the whole workspace.
import { TYPE_KEYS, TYPE_LABEL, totalOf } from "../analysis-model.js";
import { esc } from "../ui.js";

export function rollupCard(rollups, moduleId) {
  if (!rollups?.current) return "";
  const week = rollups.weeks?.find(w => w.key === rollups.current.week);
  const month = rollups.months?.find(m => m.key === rollups.current.month);
  const bucket = p => moduleId ? (p?.modules?.[moduleId] || {}) : (p?.total || {});
  const bits = b => TYPE_KEYS.map(k => (b?.[k] ? `${TYPE_LABEL[k]} ${b[k]}` : "")).filter(Boolean).join(" · ") || "没有活动";
  const cell = (label, p) => {
    const b = bucket(p);
    const extra = moduleId ? "" : `<span class="muted">任务 ${p?.tasks?.done ?? 0}/${p?.tasks?.planned ?? 0} · 复盘 ${p?.reviews?.done ?? 0}/${p?.reviews?.expected ?? 0}</span>`;
    return `<div class="roll-c"><div class="k">${label}</div><div class="n">${totalOf(b)} <small>条</small></div><div class="s">${esc(bits(b))}</div>${extra}</div>`;
  };
  const href = moduleId ? `#timeline?module=${encodeURIComponent(moduleId)}` : "#analysis";
  return `<section class="roll"><div class="roll-h"><h2>本周 / 本月</h2><a href="${href}">${moduleId ? "时间线" : "分析"}</a></div><div class="roll-g">${cell("本周", week)}${cell("本月", month)}</div></section>`;
}
