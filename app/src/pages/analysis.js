// 分析: cross-module, read-only. Counts only — no amounts.
import { loadCoverage, loadRollups, moduleList } from "../data.js";
import { totalOf } from "../analysis-model.js";
import { routeOfModule } from "../module-model.js";
import { esc, header } from "../ui.js";

const ST = { 活跃: "live", 偏久: "stale", 停滞: "stop" };
const level = n => n <= 0 ? "l0" : n === 1 ? "l1" : n < 4 ? "l2" : n < 8 ? "l3" : "l4";

function href(sort, dir) {
  const n = new URLSearchParams();
  if (sort && sort !== "days") n.set("sort", sort);
  if (dir === "asc") n.set("dir", "asc");
  const s = n.toString();
  return s ? `#analysis?${s}` : "#analysis";
}

export default async function analysisPage(_sub, P = new URLSearchParams()) {
  const [roll, cov] = await Promise.all([loadRollups(), loadCoverage()]);
  if (!roll?.weeks || !cov?.modules) return { html: header("分析", "", [], "还没有 rollups.json / coverage.json。运行 npm run demo 或 npm start 后再打开。") };
  const mods = moduleList() || cov.modules.map(m => ({ id: m.id, title: m.title }));
  const name = id => mods.find(m => m.id === id)?.title || cov.modules.find(m => m.id === id)?.title || id;
  const weeks = cov.weeks || [];
  const max = Math.max(1, ...cov.modules.flatMap(m => m.weeks || []));
  const headCells = weeks.map(w => `<span class="wk" title="${esc(w.key)}">${esc(String(w.key).slice(6))}</span>`).join("");
  const heatRows = cov.modules.map(m => `<span class="lab"><a href="#${routeOfModule(m.id)}">${esc(m.title || m.id)}</a></span>${(m.weeks || []).map((n, i) => `<span class="cell ${level(n)}" title="${esc(weeks[i]?.key || "")} · ${n}"></span>`).join("")}`).join("");
  const heat = `<div class="heat-wrap"><div class="heat" style="grid-template-columns:88px repeat(${weeks.length || 12}, minmax(18px, 1fr))"><span></span>${headCells}${heatRows}</div></div>`;

  const cur = roll.months.find(m => m.key === roll.current.month);
  const prevKey = (() => { const [y, m] = roll.current.month.split("-").map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`; })();
  const prev = roll.months.find(m => m.key === prevKey);
  const curTotal = totalOf(cur?.total), prevTotal = totalOf(prev?.total);
  const pct = (b, all) => all ? Math.round(totalOf(b) / all * 100) : 0;
  const share = cov.modules.map(m => {
    const a = pct(cur?.modules?.[m.id], curTotal), b = pct(prev?.modules?.[m.id], prevTotal);
    return `<div class="share-row"><span>${esc(m.title || m.id)}</span><span class="bar" title="本月 ${a}%"><i style="width:${a}%"></i></span><b>${a}%</b><span class="bar dim" title="上月 ${b}%"><i style="width:${b}%"></i></span><span class="muted">${prev ? b + "%" : "—"}</span></div>`;
  }).join("");

  const sort = P.get("sort") || "days";
  const dir = P.get("dir") === "asc" ? "asc" : "desc";
  const sign = dir === "asc" ? 1 : -1;
  const rows = [
    ...cov.modules.map(m => ({ ...m, kind: "模块", href: `#${routeOfModule(m.id)}` })),
    ...cov.topics.map(t => ({ ...t, kind: "主题", href: `#topics/${encodeURIComponent(t.id)}` })),
  ];
  const val = r => {
    if (sort === "name") return r.title || r.id;
    if (sort === "weeks") return r.activeWeeks || 0;
    if (sort === "gap") return r.longestGap ?? (dir === "desc" ? 99999 : -1);
    return r.days ?? (dir === "desc" ? 99999 : -1);
  };
  rows.sort((a, b) => {
    const x = val(a), y = val(b);
    if (typeof x === "string") return x.localeCompare(y) * sign;
    return (x - y) * sign || String(a.title).localeCompare(String(b.title));
  });
  const th = (key, label) => {
    const next = sort === key && dir === "desc" ? "asc" : "desc";
    const on = sort === key ? " on" : "";
    return `<a class="th${on}" href="${href(key, next)}">${label}</a>`;
  };
  const table = `<div class="cov"><div class="cov-row cov-head">${th("name", "名称")}<span>类型</span>${th("days", "距今")}<span>状态</span>${th("weeks", "活跃周")}${th("gap", "最长间隔")}<span>最近</span></div>${rows.map(r => `<div class="cov-row"><a href="${r.href}">${esc(r.title || r.id)}</a><span>${r.kind}</span><span class="mono">${r.days == null ? "—" : r.days}</span><span class="st st-${ST[r.status] || ""}">${esc(r.status)}</span><span class="mono">${r.activeWeeks}</span><span class="mono">${r.longestGap == null ? "—" : r.longestGap}</span><span class="mono">${esc(r.last || "—")}</span></div>`).join("")}</div>`;

  const week = roll.weeks.find(w => w.key === roll.current.week);
  const pair = (label, p) => `<div class="roll-c"><div class="k">${label}</div><div class="s">任务 ${p?.tasks?.done ?? 0}/${p?.tasks?.planned ?? 0}</div><div class="s">计划 ${p?.plans?.done ?? 0}/${p?.plans?.planned ?? 0}</div><div class="s">复盘 ${p?.reviews?.done ?? 0}/${p?.reviews?.expected ?? 0}</div></div>`;
  const flags = [
    ...(cov.missingReviews || []).map(r => `${r.label} ${r.period} 还没完成`),
    ...cov.topics.filter(t => t.missing?.length).map(t => `${t.title} 缺 ${t.missing.length} 个周期，最近 ${t.missing.at(-1)}`),
  ];
  const panel = `<div class="roll-g">${pair(`本周 ${esc(roll.current.week)}`, week)}${pair(`本月 ${esc(roll.current.month)}`, cur)}</div>${flags.length ? `<ul class="miss">${flags.map(f => `<li>${esc(f)}</li>`).join("")}</ul>` : `<p class="empty">这一周的复盘和主题节奏都在。</p>`}`;

  return { html: header("分析", "", [`截至 ${esc(roll.today)}`, "只读"], "近 12 周的活动、这个月和上个月的占比、覆盖，以及计划与复盘。跨模块的一条记在每个模块里，占比加起来可以超过 100%。", { actions: [["时间线", "#timeline"], ["总览", "#overview"]] })
    + `<div class="body an"><h2 class="ov-sec">模块 × 周</h2>${heat}<h2 class="ov-sec">本月 / 上月占比</h2><div class="share"><div class="share-row share-head"><span></span><span>本月</span><span></span><span>上月</span><span></span></div>${share}</div><h2 class="ov-sec">覆盖</h2>${table}<h2 class="ov-sec">计划与复盘</h2>${panel}</div>` };
}
