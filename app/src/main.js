// n-workspace v7 shell: flat 6-item sidebar, Cmd-K, hash router (#page/sub?params). Pages live in pages/*.js.
import { overview } from "./core.js";
import { bundle, V, M, records, tasks, openTasks, subs, known } from "./data.js";
import { esc, noteHref } from "./ui.js";
import pOverview from "./pages/overview.js";
import pAffairs from "./pages/affairs.js";
import pAssets from "./pages/assets.js";
import pWork from "./pages/workcontent.js";
import pKb from "./pages/kb.js";
import pSources from "./pages/sources.js";

const P = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICONS = {
  overview: P('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
  affairs: P('<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>'),
  assets: P('<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'),
  workcontent: P('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>'),
  kb: P('<path d="M4 4h11l5 5v11H4z"/><path d="M14 4v6h6"/>'),
  sources: P('<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>'),
  search: P('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
};
const COLOR = { overview: "coding", affairs: "agent", assets: "tui", workcontent: "modes", kb: "ext", sources: "infra" };
const PAGES = { overview: pOverview, affairs: pAffairs, assets: pAssets, workcontent: pWork, kb: pKb, sources: pSources };
const ORDER = Object.keys(PAGES);
const ICON_SUN = `<svg class="th-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`;
const ICON_MOON = `<svg class="th-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`;
const OV = bundle ? overview(bundle, V.overview) : { alerts: [], upcoming: [] };
const ALERT = { affairs: ["tasks"], assets: ["accounts", "subscriptions", "profile", "finance"] };
const navCount = id => ({ affairs: openTasks().length, assets: (M.accounts?.items?.length || 0) + subs().length, workcontent: M.content?.items?.length, kb: records.length, sources: (bundle?.sources || []).filter(s => s.present).length, overview: OV.upcoming.filter(u => u.days <= (V.overview?.due_days ?? 7)).length || "" })[id] ?? "";

function sidebar() {
  const p = M.profile?.data?.personal || {}, name = known(p.name) ? p.name : "我";
  const src = (bundle?.sources || []).filter(s => s.meta);
  document.getElementById("side").innerHTML = `
   <div class="me"><span class="av">${esc(String(name).slice(-1))}</span><div class="who"><b>${esc(name)}</b><small>n-workspace</small></div></div>
   <button class="search" data-cmdk>${ICONS.search}<span>搜索…</span><kbd>⌘K</kbd></button>
   <nav class="nav-scroll flat">${ORDER.map(id => { const al = OV.alerts.filter(a => (ALERT[id] || []).includes(a.module)), hi = al.some(a => a.level === "high");
     return `<a href="#${id}" data-id="${id}" class="ni L-${COLOR[id]}"><span class="ic">${ICONS[id]}</span><span class="lb">${esc(V[id]?.name || id)}</span>${al.length ? `<span class="ab ${hi ? "hi" : ""}" title="${al.length} 条提醒">${al.length}</span>` : ""}<span class="cnt">${navCount(id)}</span></a>`; }).join("")}</nav>
   <div class="side-foot">${src.map(s => `<span class="mono">${esc(s.id)}@${esc(s.meta.ref)} ${esc((s.meta.commit || "").slice(0, 7))}</span>`).join("<br>")}${bundle ? `<br>${bundle.show_private ? "含私密 · 仅本机" : `隐藏私密 ${bundle.private_hidden}`}` : ""}<button class="iconbtn theme sm" aria-label="切换主题"></button></div>`;
  document.querySelectorAll(".theme").forEach(b => { b.innerHTML = ICON_MOON + ICON_SUN; b.onclick = e => { e.preventDefault();
    const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = t; localStorage.setItem("nw-theme", t); }; });
}
document.getElementById("menu")?.addEventListener("click", () => document.body.classList.toggle("nav-open"));
document.addEventListener("click", e => { if (e.target.closest("[data-cmdk]")) { e.preventDefault(); openK(); } });

/* ---------- Cmd-K ---------- */
const TABS = { affairs: [["tasks", "任务"], ["life", "生活事务"], ["daily", "日记"]], assets: [["profile", "个人信息"], ["accounts", "账号"], ["subscriptions", "订阅"], ["finance", "理财"]], workcontent: [["reports", "工作汇报"], ["content", "内容运营"], ["agents", "Agent 运营"]], kb: [["home", "首页"], ["tree", "目录"], ["maturity", "成熟度 · 学习与成长"], ["search", "全文搜索"]] };
function searchIndex() {
  const idx = ORDER.map(id => ({ kind: "页面", title: V[id]?.name || id, href: `#${id}`, icon: id }));
  for (const [id, ts] of Object.entries(TABS)) for (const [t, l] of ts) idx.push({ kind: "页面", title: `${V[id]?.name} · ${l}`, href: `#${id}/${t}`, icon: id, low: 1 });
  for (const a of M.accounts?.items || []) idx.push({ kind: "账号", title: a.service, sub: [a.category, a.risk, a.status].filter(known).join(" · "), href: "#assets/accounts", icon: "assets" });
  for (const s of subs()) idx.push({ kind: "订阅", title: s.service, sub: [s.plan, s.status].filter(known).join(" · "), href: "#assets/subscriptions", icon: "assets" });
  for (const t of tasks()) idx.push({ kind: "任务", title: t.title, sub: `${t.owner} · ${t.status}`, href: "#affairs/tasks", icon: "affairs" });
  for (const f of M.finance?.items || []) idx.push({ kind: "理财", title: f.institution || f.item, sub: [f.kind, f.type].filter(known).join(" · "), href: "#assets/finance", icon: "assets" });
  for (const c of M.content?.items || []) idx.push({ kind: "内容", title: `${c.platform} ${c.handle ?? ""}`, sub: c.stage, href: "#workcontent/content", icon: "workcontent" });
  for (const r of records) idx.push({ kind: "笔记", title: r.title, sub: `${r.root}://${r.origin?.source_path}`, href: noteHref(r), icon: "kb" });
  return idx;
}
let IDX, kSel = 0, kRes = [];
const kEl = document.createElement("div"); kEl.className = "cmdk"; kEl.hidden = true;
kEl.innerHTML = `<div class="kbox" role="dialog" aria-label="搜索"><div class="kin">${ICONS.search}<input placeholder="搜索页面、账号、订阅、任务、笔记…" autocomplete="off"><kbd>esc</kbd></div><div class="klist"></div><div class="kfoot"><span><kbd>↑</kbd><kbd>↓</kbd> 选择</span><span><kbd>↵</kbd> 打开</span><span><kbd>⌘K</kbd> 切换</span></div></div>`;
document.body.appendChild(kEl);
const kIn = kEl.querySelector("input"), kList = kEl.querySelector(".klist");
function kRender() {
  const raw = kIn.value.trim(), q = raw.toLowerCase(); IDX ||= searchIndex();
  const score = x => { const t = String(x.title ?? "").toLowerCase(), s = String(x.sub ?? "").toLowerCase(); if (!q) return x.kind === "页面" && !x.low ? 1 : 0; return t.startsWith(q) ? 3 : t.includes(q) ? 2 : s.includes(q) ? 1 : 0; };
  kRes = IDX.map(x => [score(x), x]).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0]).slice(0, 40).map(([, x]) => x);
  if (q) kRes.push({ kind: "全文", title: `全文搜索 “${raw}”`, sub: "知识库正文", href: `#kb/search?q=${encodeURIComponent(raw)}`, icon: "kb" });
  kSel = Math.min(kSel, Math.max(0, kRes.length - 1));
  const groups = [...new Set(kRes.map(x => x.kind))];
  kList.innerHTML = kRes.length ? groups.map(g => `<div class="kg">${g}</div>` + kRes.filter(x => x.kind === g).map(x => { const j = kRes.indexOf(x);
    return `<a class="ki L-${COLOR[x.icon] || "infra"} ${j === kSel ? "sel" : ""}" data-i="${j}" href="${x.href}"><span class="ic">${ICONS[x.icon] || ""}</span><span class="t">${esc(x.title)}</span><span class="s">${esc(x.sub ?? "")}</span></a>`; }).join("")).join("") : `<p class="empty" style="padding:16px">无结果</p>`;
  kList.querySelector(".sel")?.scrollIntoView({ block: "nearest" });
}
function openK(q = "") { kEl.hidden = false; kIn.value = q; kSel = 0; kRender(); setTimeout(() => kIn.focus(), 0); }
const closeK = () => { kEl.hidden = true; };
kIn.addEventListener("input", () => { kSel = 0; kRender(); });
kEl.addEventListener("click", e => { if (e.target === kEl || e.target.closest(".ki")) closeK(); });
addEventListener("keydown", e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); kEl.hidden ? openK() : closeK(); return; }
  if (kEl.hidden) { if (e.key === "/" && !/input|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); openK(); } return; }
  if (e.key === "Escape") closeK();
  else if (e.key === "ArrowDown") { kSel = Math.min(kSel + 1, kRes.length - 1); kRender(); e.preventDefault(); }
  else if (e.key === "ArrowUp") { kSel = Math.max(kSel - 1, 0); kRender(); e.preventDefault(); }
  else if (e.key === "Enter" && kRes[kSel]) { location.hash = kRes[kSel].href; closeK(); }
});
window.nwOpenK = openK;

/* ---------- router ---------- */
let seq = 0;
async function render() {
  const [path, qs = ""] = location.hash.slice(1).split("?"), [id0, sub] = path.split("/"), id = PAGES[id0] ? id0 : "overview", el = document.getElementById("view"), my = ++seq;
  document.querySelectorAll("#side a.ni").forEach(a => a.classList.toggle("on", a.dataset.id === id));
  document.body.classList.remove("nav-open");
  if (!bundle) { el.innerHTML = `<div class="body"><div class="pend">未找到 data/bundle.json，请先运行 <code>npm start</code>。</div></div>`; return; }
  try { const out = await PAGES[id](sub || undefined, new URLSearchParams(qs)); if (my === seq) { el._acct?.abort(); el.innerHTML = out.html; out.mount?.(el); } }
  catch (err) { console.error(err); if (my === seq) el.innerHTML = `<div class="body"><div class="pend">页面渲染失败：${esc(err.message)}</div></div>`; }
}
sidebar();
addEventListener("hashchange", () => { render().then(() => scrollTo(0, 0)); });
render();
