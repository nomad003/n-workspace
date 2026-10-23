// n-workspace shell. With modules: nav groups (default 看板 · 规划 · 领域 · 资料). Without modules: the section pages.
import { weak2fa } from "./core.js";
import { bundle, M, records, tasks, subs, known, accHref, groups, section, agentName, topics, listedNotes, isIndexNote, moduleList, viewList, moduleByRoute, viewById, kbIndex, lifeIndex, v9, loadCoverage } from "./data.js";
import { pageTabs } from "./page-tabs.js";
import { legacyTarget, resolveNav } from "./module-model.js";
import { annotateEntry } from "./search-model.js";
import { isOpenTask } from "./core.js";
import { esc, noteHref } from "./ui.js";
import pToday from "./pages/today.js";
import pPlan from "./pages/plan.js";
import pTopics, { stale as topicStale } from "./pages/topics.js";
import pKnowledge from "./pages/knowledge.js";
import pMoney from "./pages/money.js";
import pAgents from "./pages/agents.js";
import pSettings from "./pages/settings.js";
import pAccount from "./pages/account.js";
import pOverview from "./pages/overview.js";
import pTimeline from "./pages/timeline.js";
import pAnalysis from "./pages/analysis.js";
import pReview from "./pages/review.js";
import { renderSurface } from "./pages/surface.js";
import { life as pLife, journal as pJournal } from "./pages/folders.js";

function navGroups() {
  return resolveNav(v9?.nav, moduleList());
}
function navItems() {
  const grouped = navGroups();
  if (!grouped) return [["today", "今天"], ["plan", "计划"], ["topics", "主题"], ["analysis", "分析"], ["life", "生活"], ["journal", "记录"], ["accounts", "账号"], ["knowledge", "知识"], ["agents", "Agents"]];
  return grouped.flatMap(g => g.items.map(it => [it.href.slice(1).split("/")[0], it.title]));
}
const PAGES = { overview: pOverview, today: pToday, plan: pPlan, topics: pTopics, life: pLife, journal: pJournal, knowledge: pKnowledge, accounts: pMoney, agents: pAgents, settings: pSettings, account: pAccount, timeline: pTimeline, analysis: pAnalysis, reviews: pReview };
const ALIAS = { kb: "knowledge", assets: "accounts", affairs: "plan", workcontent: "agents", sources: "settings", logs: "journal" };
const NAV_OF = { account: "accounts", reviews: "review" };
const ICON_SUN = `<svg class="th-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`;
const ICON_MOON = `<svg class="th-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`;
const IC = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const NAV_IC = { today: IC('<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/>'), plan: IC('<path d="M4 6h10M4 12h16M4 18h7"/><circle cx="18" cy="6" r="2"/>'), topics: IC('<path d="M4 19V5"/><path d="M4 19h16"/><path d="M7 15l4-4 3 3 5-6"/>'), life: IC('<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
  journal: IC('<path d="M6 3h10l3 3v15H6z"/><path d="M9 9h7M9 13h7M9 17h4"/>'), accounts: IC('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'), knowledge: IC('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/>'),
  agents: IC('<rect x="5" y="7" width="14" height="12" rx="3"/><path d="M12 3v4M9 12h.01M15 12h.01"/>'), analysis: IC('<path d="M4 19V5M4 19h16"/><path d="M8 16v-5M12 16V8M16 16v-3"/>'), settings: IC('<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1c.6.5 1.3.9 2 1.2L10 21h4l.5-2.6c.7-.3 1.4-.7 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z"/>') };
const setTheme = t => { document.documentElement.dataset.theme = t; localStorage.setItem("nw-theme", t); };

function worstTopic(cov) {
  const rows = (cov?.topics || []).filter(t => t.lifecycle !== "proposed" && (t.status === "停滞" || t.status === "偏久"));
  rows.sort((a, b) => (a.status === "停滞" ? 0 : 1) - (b.status === "停滞" ? 0 : 1) || (b.days ?? -1) - (a.days ?? -1));
  return rows[0] || null;
}
function statusDot(status, days) {
  if (status !== "停滞" && status !== "偏久") return "";
  const n = days == null ? "" : `${days} 天`;
  return `<span class="dot ${status === "停滞" ? "stop" : "stale"}" title="${esc(status)}${n ? ` · ${n}` : ""}"></span>`;
}
function sidebar(cov) {
  const src = (bundle?.sources || []).filter(s => s.meta);
  const foot = `<div class="foot"><a href="#settings" data-id="settings" class="ni sm">${NAV_IC.settings}设置</a>
     <div class="meta">${src.map(s => `${esc(s.id)} ${esc((s.meta.commit || "").slice(0, 7))}`).join(" · ")}<br>${bundle?.show_private ? "本机 · 含私密" : ""}</div>
     <button class="iconbtn theme" aria-label="切换主题">${ICON_MOON}${ICON_SUN}</button></div>`;
  const side = document.getElementById("side");
  const groups = navGroups();
  if (groups) {
    const byMod = Object.fromEntries((cov?.modules || []).map(m => [m.id, m]));
    const topic = worstTopic(cov);
    side.classList.add("grouped");
    side.innerHTML = `
   <div class="me"><span class="av">n</span><b>n-workspace</b></div>
   <button class="find" data-cmdk>⌕ 搜索或跳转<kbd>⌘K</kbd></button>
   <nav class="nav5">${groups.map(g => `<div class="navgrp"><div class="navh">${esc(g.title)}</div>${g.items.map(it => {
      const id = it.href.slice(1).split("/")[0];
      const row = it.kind === "module" ? byMod[it.id] : (it.id === "topics" ? topic : null);
      return `<a href="${esc(it.href)}" data-id="${esc(id)}" class="ni">${esc(it.title)}${row ? statusDot(row.status, row.days) : ""}</a>`;
    }).join("")}</div>`).join("")}</nav>
   ${foot}`;
    markActive();
    return;
  }
  const open = tasks().filter(t => isOpenTask(t) && t.owner === "user").length, w2 = weak2fa(M.accounts?.items || []).length;
  const tw = topics().filter(t => topicStale(t) || t.open_issues?.length).length;
  const countSec = id => { const S = section(id); if (!S) return null; const seen = new Set(); for (const t of S.tabs || []) for (const r of listedNotes(id, t.id).notes) seen.add(r.id); return seen.size || ""; };
  const lifeN = countSec("life"), journalN = countSec("journal");
  const journalRe = /^(journal|bot\/journal|life\/journal|work|cfwork|server)\//;
  const lifeSkip = /^(journal|work|plan|learning|agent-ops|moc|bot\/journal|bot\/plan|cfwork|server|life\/journal|life\/plan|content|learn|accounts)\//;
  const noteCount = pred => records.filter(r => pred(r) && !isIndexNote(r)).length;
  const cnt = { topics: tw ? `<span class="w">${tw}</span>` : (topics().length || ""), plan: open || "", life: lifeN ?? (noteCount(r => r.root === "life" && r.origin.source_path.includes("/") && !lifeSkip.test(r.origin.source_path)) || ""), journal: journalN ?? (noteCount(r => r.root === "life" && journalRe.test(r.origin.source_path)) || ""), knowledge: noteCount(r => r.root === "kb"), accounts: w2 ? `<span class="w">${w2}</span>` : "" };
  side.classList.remove("grouped");
  side.innerHTML = `
   <div class="me"><span class="av">n</span><b>n-workspace</b></div>
   <button class="find" data-cmdk>⌕ 搜索或跳转<kbd>⌘K</kbd></button>
   <div class="navh">工作区</div><nav class="nav5">${navItems().map(([id, l]) => `<a href="#${id}" data-id="${id}" class="ni">${NAV_IC[id] || ""}${l}<span class="c">${cnt[id] ?? ""}</span></a>`).join("")}</nav>
   ${foot}`;
  markActive();
}
document.addEventListener("click", e => {
  if (e.target.closest("[data-cmdk]")) { e.preventDefault(); openK(); return; }
  if (e.target.closest(".theme")) { e.preventDefault(); setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"); return; }
  const ts = e.target.closest("[data-theme-set]"); if (ts) { e.preventDefault(); setTheme(ts.dataset.themeSet); }
});
document.getElementById("menu")?.addEventListener("click", () => document.body.classList.toggle("nav-open"));

/* ---------- ⌘K ---------- */
const TABS = Object.fromEntries(["today", "plan", "topics", "life", "journal", "accounts", "knowledge", "agents"].map(id => [id, pageTabs(section(id), id)]));
function searchIndex() {
  const nav = navItems();
  const idx = [...nav, ["settings", "设置"]].map(([id, l]) => ({ kind: "页面", title: l, href: `#${id}` }));
  const mods = moduleList();
  if (mods) {
    for (const m of mods) for (const t of (m.resolved || []).filter(x => !x.missing)) idx.push({ kind: "页面", title: `${m.title} · ${t.label}`, href: `#${routeOfModule(m.id)}/${t.tabId}`, low: 1 });
    for (const v of viewList()) for (const t of (v.resolved || []).filter(x => !x.missing)) idx.push({ kind: "页面", title: `${v.title} · ${t.label}`, href: `#${v.id}/${t.tabId}`, low: 1 });
  } else for (const [id, ts] of Object.entries(TABS)) for (const [t, l] of ts) idx.push({ kind: "页面", title: `${nav.find(n => n[0] === id)[1]} · ${l}`, href: `#${id}/${t}`, low: 1 });
  for (const g of groups()) { idx.push({ kind: "页面", title: `账号 · ${g.label}`, href: `#accounts/groups/${g.id}`, low: 1 }); for (const c of g.subcategories || []) idx.push({ kind: "页面", title: `账号 · ${g.label} · ${c.label}`, href: `#accounts/groups/${g.id}/${c.id}`, low: 1 }); }
  for (const a of M.accounts?.items || []) idx.push({ kind: "账号", title: a.service, sub: [a.category, a.priority ?? a.risk].filter(known).join(" · "), href: accHref(a) });
  for (const s of subs()) idx.push({ kind: "订阅", title: s.service, sub: [s.plan, s.status].filter(known).join(" · "), href: "#accounts/subscriptions" });
  for (const t of topics()) idx.push({ kind: "主题", title: t.title, sub: [t.status?.stage, t.status?.lifecycle].filter(Boolean).join(" · "), href: `#topics/${encodeURIComponent(t.id)}` });
  const boardHref = `#${legacyTarget("plan", "board", moduleList()) || "plan/board"}`;
  const agentHref = `#${legacyTarget("agents", "agents", moduleList()) || "agents"}`;
  for (const t of tasks()) idx.push({ kind: "任务", title: t.title, sub: `${t.owner === "user" ? "我" : agentName(t.owner)} · ${t.status}${t.due ? ` · ${t.due}` : t.due_event ? ` · ${t.due_event}` : ""}`, href: t.owner === "user" ? boardHref : agentHref });
  if (!idx.some(x => x.href === "#timeline")) idx.push({ kind: "页面", title: "时间线", href: "#timeline", low: 1 });
  return idx;
}
let NOTES = null;
function ensureNotes() {
  if (NOTES) return Promise.resolve(NOTES);
  return Promise.all([kbIndex(), lifeIndex()]).then(([kb, life]) => { NOTES = [...kb, ...life].map(x => annotateEntry(x, moduleList() || [], topics())); return NOTES; });
}
function noteItems() {
  const rows = NOTES || records.map(r => ({ id: r.id, title: r.title, root: r.root, path: r.origin?.source_path, updated: r.updated, text: "", modules: [], topics: [], tags: [] }));
  return rows.map(x => ({ kind: "笔记", title: x.title, sub: `${x.root}://${x.path || ""}`, href: noteHref({ id: x.id }), text: x.text || "", modules: x.modules || [], topics: x.topics || [], root: x.root, updated: x.date || x.updated, low: 1 }));
}
const kFilter = { source: "", module: "", topic: "", from: "", to: "" };
let IDX, kSel = 0, kRes = [];
const kEl = document.createElement("div"); kEl.className = "cmdk"; kEl.hidden = true;
kEl.innerHTML = `<div class="kbox" role="dialog" aria-label="搜索"><div class="kin"><input placeholder="搜索页面、计划、账号、订阅、笔记正文…" autocomplete="off"><kbd>esc</kbd></div><div class="kfilters"><select data-k="source"><option value="">来源</option><option value="life">生活</option><option value="kb">知识库</option></select><select data-k="module"><option value="">模块</option></select><select data-k="topic"><option value="">主题</option></select><input data-k="from" type="date" aria-label="从"><input data-k="to" type="date" aria-label="到"></div><div class="klist"></div></div>`;
for (const m of moduleList() || []) kEl.querySelector("[data-k=module]").insertAdjacentHTML("beforeend", `<option value="${esc(m.id)}">${esc(m.title)}</option>`);
for (const t of topics()) kEl.querySelector("[data-k=topic]").insertAdjacentHTML("beforeend", `<option value="${esc(t.id)}">${esc(t.title)}</option>`);
kEl.querySelector(".kfilters").addEventListener("change", e => { const el = e.target.closest("[data-k]"); if (!el) return; kFilter[el.dataset.k] = el.value; kSel = 0; kRender(); });
document.body.appendChild(kEl);
const kIn = kEl.querySelector("input"), kList = kEl.querySelector(".klist");
function kRender() {
  const raw = kIn.value.trim(), q = raw.toLowerCase(); IDX ||= searchIndex();
  if (!NOTES) ensureNotes().then(() => { if (!kEl.hidden) kRender(); });
  const filtering = Object.values(kFilter).some(Boolean);
  const notes = noteItems().filter(x => {
    if (kFilter.source && x.root !== kFilter.source) return false;
    if (kFilter.module && !x.modules.includes(kFilter.module)) return false;
    if (kFilter.topic && !x.topics.includes(kFilter.topic)) return false;
    const d = String(x.updated || "").slice(0, 10);
    if (kFilter.from && (!d || d < kFilter.from)) return false;
    if (kFilter.to && (!d || d > kFilter.to)) return false;
    return true;
  });
  const terms = q.split(/\s+/).filter(Boolean);
  const score = x => {
    const blob = `${x.title || ""} ${x.sub || ""} ${x.kind === "笔记" ? x.text || "" : ""}`.toLowerCase();
    if (!terms.length) return x.kind === "笔记" ? (filtering ? 1 : 0) : (x.kind === "页面" && !x.low ? 1 : 0);
    if (!terms.every(w => blob.includes(w))) return 0;
    const t = String(x.title || "").toLowerCase();
    return terms.every(w => t.includes(w)) ? (t.startsWith(terms[0]) ? 3 : 2) : 1;
  };
  kRes = [...IDX, ...notes].map(x => [score(x), x]).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0] || String(b[1].updated || "").localeCompare(String(a[1].updated || ""))).slice(0, 40).map(([, x]) => x);
  const params = new URLSearchParams();
  if (raw) params.set("q", raw);
  for (const [k, v] of Object.entries(kFilter)) if (v) params.set(k, v);
  if (raw || filtering) kRes.push({ kind: "全文", title: `打开搜索页 “${raw || "当前筛选"}”`, sub: "生活 + 知识库", href: `#knowledge/search?${params}` });
  kSel = Math.min(kSel, Math.max(0, kRes.length - 1));
  const groups = [...new Set(kRes.map(x => x.kind))];
  kList.innerHTML = kRes.length ? groups.map(g => `<div class="kg">${g}</div>` + kRes.filter(x => x.kind === g).map(x => { const j = kRes.indexOf(x);
    const badges = (x.modules || []).map(id => `<span class="pill">${esc((moduleList() || []).find(m => m.id === id)?.title || id)}</span>`).join("");
    return `<a class="ki ${j === kSel ? "sel" : ""}" data-i="${j}" href="${x.href}"><span class="t">${esc(x.title)}</span>${badges ? `<span class="ov-mods">${badges}</span>` : ""}<span class="s">${esc(x.sub ?? "")}</span></a>`; }).join("")).join("") : `<p class="empty" style="padding:16px">无结果</p>`;
  kList.querySelector(".sel")?.scrollIntoView({ block: "nearest" });
}
function openK(q = "") { kEl.hidden = false; kIn.value = q; kSel = 0; kRender(); setTimeout(() => kIn.focus(), 0); }
const closeK = () => { kEl.hidden = true; };
kIn.addEventListener("input", () => { kSel = 0; kRender(); });
kEl.addEventListener("click", e => { if (e.target === kEl || e.target.closest(".ki")) closeK(); });
addEventListener("keydown", e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); kEl.hidden ? openK() : closeK(); return; }
  if (!kEl.hidden && document.activeElement !== kIn && kEl.contains(document.activeElement)) { if (e.key === "Escape") closeK(); return; }
  if (kEl.hidden) { if (e.key === "/" && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); openK(); } return; }
  if (e.key === "Escape") closeK();
  else if (e.key === "ArrowDown") { kSel = Math.min(kSel + 1, kRes.length - 1); kRender(); e.preventDefault(); }
  else if (e.key === "ArrowUp") { kSel = Math.max(kSel - 1, 0); kRender(); e.preventDefault(); }
  else if (e.key === "Enter" && kRes[kSel]) { location.hash = kRes[kSel].href; closeK(); }
});
window.nwOpenK = openK;

/* ---------- router ---------- */
function resolveRoute() {
  const [path, qs = ""] = location.hash.slice(1).split("?");
  const parts = path ? path.split("/").map(decodeURIComponent) : [];
  let raw = parts[0] || "", sub = parts[1], rest = parts.slice(2);
  if (ALIAS[raw]) raw = ALIAS[raw];
  const mods = moduleList();
  if (!mods && raw === "overview") raw = "today";
  if (mods) {
    if (raw === "knowledge" && sub === "note") return { kind: "page", id: "knowledge", sub, rest, qs };
    const absorbed = v9?.absorbed?.[`${raw}/${sub || raw}`];
    if (absorbed) {
      const next = `#${absorbed}`;
      if (location.hash.split("?")[0] !== next) { location.replace(next); return { kind: "redirect" }; }
    }
    const leg = legacyTarget(raw, sub, mods);
    if (leg) {
      const next = `#${leg}${rest.length ? "/" + rest.map(encodeURIComponent).join("/") : ""}${qs ? "?" + qs : ""}`;
      if (location.hash !== next) { location.replace(next); return { kind: "redirect" }; }
    }
    if (!raw || raw === "overview") return { kind: "page", id: "overview", sub, rest, qs };
    const mod = moduleByRoute(raw);
    if (mod) return { kind: "surface", entry: mod, surface: "module", sub, rest, qs };
    const view = viewById(raw);
    if (view) return { kind: "surface", entry: view, surface: "view", sub, rest, qs };
    if (PAGES[raw]) return { kind: "page", id: raw, sub, rest, qs };
    return { kind: "page", id: "overview", sub: undefined, rest: [], qs: "" };
  }
  const id = PAGES[raw] ? raw : "today";
  return { kind: "page", id, sub, rest, qs };
}
function markActive() {
  const [path] = location.hash.slice(1).split("?");
  const parts = path ? path.split("/").map(decodeURIComponent) : [];
  let raw = parts[0] || "", sub = parts[1];
  if (ALIAS[raw]) raw = ALIAS[raw];
  const mods = moduleList();
  let active;
  if (!mods) active = raw === "overview" ? "today" : (PAGES[raw] ? raw : "today");
  else {
    const absorbed = v9?.absorbed?.[`${raw}/${sub || raw}`];
    const leg = legacyTarget(raw, sub, mods);
    if (absorbed) active = absorbed.split("/")[0];
    else if (leg) active = leg.split("/")[0];
    else if (!raw || raw === "overview") active = "overview";
    else if (moduleByRoute(raw) || viewById(raw)) active = raw;
    else active = NAV_OF[raw] || (PAGES[raw] ? raw : "overview");
  }
  document.querySelectorAll("#side a[data-id]").forEach(a => a.classList.toggle("on", a.dataset.id === active));
}
let seq = 0;
async function render() {
  const target = resolveRoute();
  if (target.kind === "redirect") return;
  const el = document.getElementById("view"), my = ++seq;
  markActive();
  document.body.classList.remove("nav-open");
  if (!bundle) { el.innerHTML = `<div class="body"><p class="empty">未找到 data/bundle.json，请先运行 <code>npm start</code>。</p></div>`; return; }
  try {
    const P = new URLSearchParams(target.qs);
    const out = target.kind === "surface" ? await renderSurface(target.entry, target.surface, target.sub || undefined, P, target.rest) : await PAGES[target.id](target.sub || undefined, P, target.rest);
    if (my === seq) { el._acct?.abort(); el.innerHTML = out.html; out.mount?.(el); }
  }
  catch (err) { console.error(err); if (my === seq) el.innerHTML = `<div class="body"><p class="empty">页面渲染失败：${esc(err.message)}</p></div>`; }
}
sidebar(); loadCoverage().then(cov => { if (moduleList()) sidebar(cov); }); document.querySelectorAll(".topbar .theme").forEach(b => b.innerHTML = ICON_MOON + ICON_SUN);
addEventListener("hashchange", () => { render().then(() => scrollTo(0, 0)); });
render();
