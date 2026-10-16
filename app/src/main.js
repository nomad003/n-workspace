// n-workspace v9 shell: 今天 · 计划 · 生活 · 记录 · 账号 · 知识 · Agents + 设置, ⌘K, hash router (#page/sub/…?params).
import { weak2fa } from "./core.js";
import { bundle, V, M, records, tasks, subs, known, accHref, catPages, groups, section, agentName } from "./data.js";
import { isOpenTask } from "./core.js";
import { esc, noteHref } from "./ui.js";
import pToday from "./pages/today.js";
import pPlan from "./pages/plan.js";
import pKnowledge from "./pages/knowledge.js";
import pMoney from "./pages/money.js";
import pAgents from "./pages/agents.js";
import pSettings from "./pages/settings.js";
import pAccount from "./pages/account.js";
import { life as pLife, journal as pJournal } from "./pages/folders.js";

const NAV = [["today", "今天"], ["plan", "计划"], ["life", "生活"], ["journal", "记录"], ["accounts", "账号"], ["knowledge", "知识"], ["agents", "Agents"]];
const PAGES = { today: pToday, plan: pPlan, life: pLife, journal: pJournal, knowledge: pKnowledge, accounts: pMoney, agents: pAgents, settings: pSettings, account: pAccount };
const ALIAS = { overview: "today", kb: "knowledge", assets: "accounts", affairs: "plan", workcontent: "agents", sources: "settings", logs: "journal" }; // old links keep working
const NAV_OF = { account: "accounts" };
const ICON_SUN = `<svg class="th-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`;
const ICON_MOON = `<svg class="th-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`;
const setTheme = t => { document.documentElement.dataset.theme = t; localStorage.setItem("nw-theme", t); };

function sidebar() {
  const open = tasks().filter(t => isOpenTask(t) && t.owner === "user").length, w2 = weak2fa(M.accounts?.items || []).length, n = id => (section(id)?.tabs || []).length;
  const cnt = { plan: open || "", life: records.filter(r => r.root === "life" && r.origin.source_path.includes("/") && !/^(journal|work|plan|learning|agent-ops|moc)\//.test(r.origin.source_path)).length || "", journal: records.filter(r => r.root === "life" && /^(journal|work)\//.test(r.origin.source_path)).length || "", knowledge: records.filter(r => r.root === "kb").length, accounts: w2 ? `<span class="w">${w2}</span>` : "" };
  const src = (bundle?.sources || []).filter(s => s.meta);
  document.getElementById("side").innerHTML = `
   <div class="me"><span class="av">n</span><b>n-workspace</b></div>
   <button class="find" data-cmdk>⌕ 搜索或跳转<kbd>⌘K</kbd></button>
   <nav class="nav5">${NAV.map(([id, l]) => `<a href="#${id}" data-id="${id}" class="ni"><i></i>${l}<span class="c">${cnt[id] ?? ""}</span></a>`).join("")}</nav>
   <div class="foot"><a href="#settings" data-id="settings" class="ni sm"><i></i>设置</a>
     <div class="meta">${src.map(s => `${esc(s.id)} ${esc((s.meta.commit || "").slice(0, 7))}`).join(" · ")}<br>${bundle?.show_private ? "本机 · 含私密" : ""}</div>
     <button class="iconbtn theme" aria-label="切换主题">${ICON_MOON}${ICON_SUN}</button></div>`;
}
document.addEventListener("click", e => {
  if (e.target.closest("[data-cmdk]")) { e.preventDefault(); openK(); return; }
  if (e.target.closest(".theme")) { e.preventDefault(); setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"); return; }
  const ts = e.target.closest("[data-theme-set]"); if (ts) { e.preventDefault(); setTheme(ts.dataset.themeSet); }
});
document.getElementById("menu")?.addEventListener("click", () => document.body.classList.toggle("nav-open"));

/* ---------- ⌘K ---------- */
const TABS = { plan: [["board", "本周 / 本月"], ["tree", "目标树"], ["reviews", "复盘"], ["learning", "学习路线"]], knowledge: [["home", "项目"], ["topics", "主题"], ["tree", "目录"], ["search", "全文搜索"]],
  accounts: [["identities", "身份"], ["groups", "分类"], ["subscriptions", "订阅"], ["security", "安全"], ["graph", "关系图"]],
  ...Object.fromEntries(["life", "journal"].map(id => [id, (section(id)?.tabs || []).map(t => [t.id, t.label])])) };
function searchIndex() {
  const idx = [...NAV, ["settings", "设置"]].map(([id, l]) => ({ kind: "页面", title: l, href: `#${id}` }));
  for (const [id, ts] of Object.entries(TABS)) for (const [t, l] of ts) idx.push({ kind: "页面", title: `${NAV.find(n => n[0] === id)[1]} · ${l}`, href: `#${id}/${t}`, low: 1 });
  for (const g of groups()) { idx.push({ kind: "页面", title: `账号 · ${g.label}`, href: `#accounts/groups/${g.id}`, low: 1 }); for (const c of g.subcategories || []) idx.push({ kind: "页面", title: `账号 · ${g.label} · ${c.label}`, href: `#accounts/groups/${g.id}/${c.id}`, low: 1 }); }
  for (const a of M.accounts?.items || []) idx.push({ kind: "账号", title: a.service, sub: [a.category, a.priority ?? a.risk].filter(known).join(" · "), href: accHref(a) });
  for (const s of subs()) idx.push({ kind: "订阅", title: s.service, sub: [s.plan, s.status].filter(known).join(" · "), href: "#accounts/subscriptions" });
  for (const t of tasks()) idx.push({ kind: "任务", title: t.title, sub: `${t.owner === "user" ? "我" : agentName(t.owner)} · ${t.status}${t.due ? ` · ${t.due}` : t.due_event ? ` · ${t.due_event}` : ""}`, href: t.owner === "user" ? "#plan/board" : "#agents" });
  for (const r of records) idx.push({ kind: "笔记", title: r.title, sub: `${r.root}://${r.origin?.source_path}`, href: noteHref(r) });
  return idx;
}
let IDX, kSel = 0, kRes = [];
const kEl = document.createElement("div"); kEl.className = "cmdk"; kEl.hidden = true;
kEl.innerHTML = `<div class="kbox" role="dialog" aria-label="搜索"><div class="kin"><input placeholder="搜索页面、计划、账号、订阅、笔记…" autocomplete="off"><kbd>esc</kbd></div><div class="klist"></div></div>`;
document.body.appendChild(kEl);
const kIn = kEl.querySelector("input"), kList = kEl.querySelector(".klist");
function kRender() {
  const raw = kIn.value.trim(), q = raw.toLowerCase(); IDX ||= searchIndex();
  const score = x => { const t = String(x.title ?? "").toLowerCase(), s = String(x.sub ?? "").toLowerCase(); if (!q) return x.kind === "页面" && !x.low ? 1 : 0; return t.startsWith(q) ? 3 : t.includes(q) ? 2 : s.includes(q) ? 1 : 0; };
  kRes = IDX.map(x => [score(x), x]).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0]).slice(0, 40).map(([, x]) => x);
  if (q) kRes.push({ kind: "全文", title: `全文搜索 “${raw}”`, sub: "知识", href: `#knowledge/search?q=${encodeURIComponent(raw)}` });
  kSel = Math.min(kSel, Math.max(0, kRes.length - 1));
  const groups = [...new Set(kRes.map(x => x.kind))];
  kList.innerHTML = kRes.length ? groups.map(g => `<div class="kg">${g}</div>` + kRes.filter(x => x.kind === g).map(x => { const j = kRes.indexOf(x);
    return `<a class="ki ${j === kSel ? "sel" : ""}" data-i="${j}" href="${x.href}"><span class="t">${esc(x.title)}</span><span class="s">${esc(x.sub ?? "")}</span></a>`; }).join("")).join("") : `<p class="empty" style="padding:16px">无结果</p>`;
  kList.querySelector(".sel")?.scrollIntoView({ block: "nearest" });
}
function openK(q = "") { kEl.hidden = false; kIn.value = q; kSel = 0; kRender(); setTimeout(() => kIn.focus(), 0); }
const closeK = () => { kEl.hidden = true; };
kIn.addEventListener("input", () => { kSel = 0; kRender(); });
kEl.addEventListener("click", e => { if (e.target === kEl || e.target.closest(".ki")) closeK(); });
addEventListener("keydown", e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); kEl.hidden ? openK() : closeK(); return; }
  if (kEl.hidden) { if (e.key === "/" && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); openK(); } return; }
  if (e.key === "Escape") closeK();
  else if (e.key === "ArrowDown") { kSel = Math.min(kSel + 1, kRes.length - 1); kRender(); e.preventDefault(); }
  else if (e.key === "ArrowUp") { kSel = Math.max(kSel - 1, 0); kRender(); e.preventDefault(); }
  else if (e.key === "Enter" && kRes[kSel]) { location.hash = kRes[kSel].href; closeK(); }
});
window.nwOpenK = openK;

/* ---------- router ---------- */
let seq = 0;
async function render() {
  const [path, qs = ""] = location.hash.slice(1).split("?"), [raw, sub, ...rest] = path.split("/").map(decodeURIComponent);
  const id = PAGES[ALIAS[raw] ?? raw] ? (ALIAS[raw] ?? raw) : "today", el = document.getElementById("view"), my = ++seq;
  document.querySelectorAll("#side a[data-id]").forEach(a => a.classList.toggle("on", a.dataset.id === (NAV_OF[id] || id)));
  document.body.classList.remove("nav-open");
  if (!bundle) { el.innerHTML = `<div class="body"><p class="empty">未找到 data/bundle.json，请先运行 <code>npm start</code>。</p></div>`; return; }
  try { const out = await PAGES[id](sub || undefined, new URLSearchParams(qs), rest); if (my === seq) { el._acct?.abort(); el.innerHTML = out.html; out.mount?.(el); } }
  catch (err) { console.error(err); if (my === seq) el.innerHTML = `<div class="body"><p class="empty">页面渲染失败：${esc(err.message)}</p></div>`; }
}
sidebar(); document.querySelectorAll(".topbar .theme").forEach(b => b.innerHTML = ICON_MOON + ICON_SUN);
addEventListener("hashchange", () => { render().then(() => scrollTo(0, 0)); });
render();
