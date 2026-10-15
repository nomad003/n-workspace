// n-workspace dashboard: renders views/*.json against data/bundle.json (built locally, gitignored).
import { as, match, overview, daysUntil } from "./core.js";
const IDS = ["overview", "profile", "accounts", "subscriptions", "finance", "work", "learning", "content", "life"];
const bundle = await fetch("../data/bundle.json", { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null);
const views = (await Promise.all(IDS.map(id => fetch(`../views/${id}.json`).then(r => r.json())))).sort((a, b) => a.order - b.order);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const records = bundle?.records || [];
const fmt = v => v == null || v === "" ? "" : typeof v === "boolean" ? `<span class="pill ${v ? "ok" : "bad"}">${v ? "是" : "否"}</span>`
  : Array.isArray(v) ? v.map(x => `<span class="pill">${esc(typeof x === "object" ? JSON.stringify(x) : x)}</span>`).join("")
  : typeof v === "object" ? esc(Object.entries(v).map(([k, x]) => `${k}: ${x}`).join(", ")) : esc(v);
const cd = d => { const n = daysUntil(d); if (n == null) return ""; return `<span class="cd ${n < 0 ? "late" : n <= 7 ? "soon" : ""}">${n < 0 ? `逾期${-n}天` : n === 0 ? "今天" : `${n}天`}</span>`; };
const card = r => `<div class="card">${esc(r.title)}<br><small>${esc(r.origin?.source_path?.replace(/\/[^/]*$/, ""))} · ${esc(r.updated)}</small></div>`;
const table = (rows, cols) => rows.length ? `<table><tr>${cols.map(c => `<th>${esc(c)}</th>`).join("")}</tr>${rows.map(r => `<tr>${cols.map(c =>
  `<td>${["next_renewal", "due", "expires"].includes(c) && r[c] ? `${esc(r[c])} ${cd(r[c])}` : fmt(r[c])}</td>`).join("")}</tr>`).join("")}</table>` : `<p class="empty">无数据</p>`;
const notesOf = v => v.notes ? records.filter(r => match(r, v.notes)) : [];
function notesBlock(v, rs) {
  if (!rs.length) return "";
  if (v.group_by && v.columns_board) { const g = r => r[v.group_by] ?? v.default_group ?? "(none)";
    return `<h3>笔记 (${rs.length})</h3><div class="cols">${v.columns_board.map(c => { const xs = rs.filter(r => g(r) === c);
      return `<div class="col"><b>${c} <small>${xs.length}</small></b>${xs.slice(0, 40).map(card).join("")}${xs.length > 40 ? `<small>…另 ${xs.length - 40} 条</small>` : ""}</div>`; }).join("")}</div>`; }
  return `<h3>相关笔记 (${rs.length})</h3>${table(rs.sort((a, b) => String(b.updated).localeCompare(String(a.updated))).map(r => ({ ...r, path: r.origin?.source_path })), ["title", "status", "updated", "path"])}`;
}
function missingNote(file) { return bundle?.missing?.includes(`${file}.yaml`) ? `<div class="warn">KB 中未找到 <code>${esc(bundle.data_dir)}/${file}.yaml</code>，结构化数据为空；下方仅显示相关笔记。</div>` : ""; }
function renderOverview(v) {
  const o = overview(bundle, v);
  const up = o.upcoming.length ? `<table><tr><th>倒计时</th><th>类型</th><th>名称</th><th>日期</th><th></th></tr>${o.upcoming.map(u =>
    `<tr><td>${cd(u.date)}</td><td>${esc(u.kind)}</td><td>${esc(u.name)}</td><td>${esc(u.date)}</td><td>${esc(u.extra)}</td></tr>`).join("")}</table>` : `<p class="empty">${v.window_days} 天内无续费/截止</p>`;
  const al = o.alerts.length ? o.alerts.map(a => `<div class="al ${a.level}">${esc(a.msg)} <small>· ${a.module}</small></div>`).join("") : `<p class="empty">暂无风险提醒</p>`;
  const ag = o.agentTasks.length ? table(o.agentTasks, ["title", "owner", "status", "due"]) : `<p class="empty">无进行中的 agent 任务</p>`;
  const m = bundle.modules, subs = m.subscriptions?.items || [];
  const monthly = subs.filter(s => !/cancel/i.test(s.status || "")).reduce((t, s) => { const a = +s.amount; if (!a) return t;
    const k = { yearly: 1 / 12, quarterly: 1 / 3, weekly: 4.33, monthly: 1 }[s.cycle] ?? 1; const c = s.currency || "?"; t[c] = (t[c] || 0) + a * k; return t; }, {});
  return `<h2>总览 <small>${new Date().toLocaleDateString("zh-CN")}</small></h2>
  ${bundle.missing?.length ? `<div class="warn">缺少 KB 结构化数据：${bundle.missing.map(esc).join(", ")}（${esc(bundle.data_dir)}/）。</div>` : ""}
  <div class="grid">
   <div class="box"><h3>即将到来（续费 / 截止）</h3>${up}</div>
   <div class="box"><h3>风险提醒 (${o.alerts.length})</h3>${al}</div>
   <div class="box"><h3>Agent 任务</h3>${ag}</div>
   <div class="box"><h3>概况</h3><div class="grid" style="grid-template-columns:repeat(3,1fr)">
     <div><div class="stat">${(m.accounts?.items || []).length}</div>账号</div><div><div class="stat">${subs.length}</div>订阅</div>
     <div><div class="stat">${(m.tasks?.items || []).filter(t => !/done|cancel/i.test(t.status || "")).length}</div>未完成任务</div></div>
     <p>月度订阅支出：${Object.entries(monthly).map(([c, x]) => `${x.toFixed(2)} ${esc(c)}`).join(" + ") || "—"}</p></div>
   <div class="box" style="grid-column:1/-1"><h3>今日 · 最近更新的笔记</h3>${table(o.recent, ["title", "status", "area", "updated"])}</div>
  </div>`;
}
function render(id) {
  const v = views.find(x => x.id === id) || views[0], el = document.getElementById("view");
  document.querySelectorAll("nav a").forEach(a => a.classList.toggle("on", a.dataset.id === v.id));
  if (!bundle) { el.innerHTML = `<h2>${esc(v.name)}</h2><div class="warn">未找到 data/bundle.json，请先运行 <code>npm start</code>。</div>`; return; }
  if (v.layout === "overview") { el.innerHTML = renderOverview(v); return; }
  const mod = v.data ? bundle.modules[v.data] : null, ns = notesOf(v);
  let body = v.data ? missingNote(v.data) : "";
  if (v.layout === "kv") { const d = mod?.data || {};
    body += Object.keys(d).length ? `<dl class="kv">${Object.entries(d).map(([k, x]) => `<dt>${esc(k)}</dt><dd>${fmt(x)}</dd>`).join("")}</dl>` : "";
  } else if (v.layout === "table" && mod) {
    let items = mod.items; if (v.data_filter) items = items.filter(r => match(r, v.data_filter));
    const cols = [...new Set([...v.columns.filter(c => items.some(r => r[c] != null) || !items.length), ...Object.keys(items[0] || {}).filter(k => !v.columns.includes(k) && !["privacy", "notes", "metrics"].includes(k)).slice(0, 3)])];
    if (items.length || mod.source) body += `<h3>${esc(v.data)}.yaml (${items.length})</h3>${table(items, cols)}`;
    if (v.totals && items.length) { const t = {}; for (const s of items) if (+s.amount) t[s.currency || "?"] = (t[s.currency || "?"] || 0) + +s.amount; body += `<p>合计（单期）：${Object.entries(t).map(([c, x]) => `${x.toFixed(2)} ${esc(c)}`).join(" + ")}</p>`; }
  }
  el.innerHTML = `<h2>${esc(v.name)}</h2>${body}${notesBlock(v, ns)}${!body && !ns.length ? `<p class="empty">无数据</p>` : ""}`;
}
document.getElementById("nav").innerHTML = views.map(v => `<a href="#${v.id}" data-id="${v.id}">${esc(v.name)}</a>`).join("");
document.getElementById("meta").innerHTML = bundle ? `构建 ${esc(bundle.generated.slice(0, 16).replace("T", " "))}Z<br>${bundle.show_private ? "含私密记录" : `已隐藏私密 ${bundle.private_hidden} 条`}${bundle.kb_ref ? `<br>KB: ${esc(bundle.kb_ref)}` : ""}` : "";
addEventListener("hashchange", () => render(location.hash.slice(1)));
render(location.hash.slice(1) || "overview");
