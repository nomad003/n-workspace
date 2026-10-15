// n-workspace dashboard. Renders views/*.json against data/bundle.json (built locally, gitignored).
import { as, match, overview, daysUntil, nextRenewal, taskDue, known, isAgentTask, resolveLink } from "./core.js";
import { donut, stackedBars, hbars, progress, timeline, flow } from "./charts.js";

const IDS = ["overview", "tasks", "profile", "accounts", "finance", "subscriptions", "work", "content", "learning", "notes", "life"];
const COLOR = { tasks: "agent", notes: "ext", overview: "coding", profile: "tui", accounts: "agent", subscriptions: "modes", finance: "ai", work: "coding", learning: "ext", content: "tui", life: "infra" };
const AGENTS = ["Bot", "X", "KB", "Pi", "Github", "Register", "Blibli"];
const bundle = await fetch("../data/bundle.json", { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null);
const views = (await Promise.all(IDS.map(id => fetch(`../views/${id}.json`).then(r => r.json())))).sort((a, b) => a.order - b.order);
const V = Object.fromEntries(views.map(v => [v.id, v]));
const M = bundle?.modules || {}, records = bundle?.records || [];
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const FX = V.overview?.fx || { CNY: 1, USD: 7.1, JPY: 0.047, HKD: 0.91 };

/* ---------- theme ---------- */
const ICON_SUN = `<svg class="th-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`;
const ICON_MOON = `<svg class="th-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`;
document.querySelectorAll(".theme").forEach(b => { b.innerHTML = ICON_MOON + ICON_SUN; b.onclick = () => {
  const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = t; localStorage.setItem("nw-theme", t); }; });
document.getElementById("menu").onclick = () => document.body.classList.toggle("nav-open");

/* ---------- helpers ---------- */
const STATUS = [
  [/^(active|open|在册)$/i, "agent"], [/in-progress|doing|进行/i, "coding"], [/pending|待|trial|疑似|暂停|pause/i, "modes"],
  [/done|published|evergreen|one-time|预充值/i, "ai"], [/refund|at_risk|失败|overdue/i, "err"], [/cancel|closed|archived|to-close/i, "infra"], [/draft|idea|stub/i, "infra"],
];
const tone = v => (STATUS.find(([re]) => re.test(String(v ?? ""))) || [0, "infra"])[1];
const badge = v => v == null || v === "" ? "" : `<span class="sd L-${tone(v)}">${esc(v)}</span>`;
const riskC = r => ({ P0: "err", P1: "modes", P2: "agent", P3: "ext", P4: "infra" })[String(r).toUpperCase()] || "infra";
const urg = d => d == null ? "infra" : d < 0 ? "err" : d <= 7 ? "err" : d <= 30 ? "modes" : d <= 90 ? "agent" : "ai";
const cd = (date, approx) => { const n = daysUntil(date); if (n == null) return "";
  return `<span class="cd L-${urg(n)}">${approx ? "<small>约</small>" : ""}${n < 0 ? `逾期 ${-n}` : n === 0 ? "今天" : n}<small>${n === 0 ? "" : "天"}</small></span>`; };
const fmt = v => v == null || v === "" ? "" : typeof v === "boolean" ? badge(v ? "是" : "否")
  : Array.isArray(v) ? v.map(x => `<span class="tag">${x && typeof x === "object" ? esc(Object.entries(x).map(([k, y]) => `${k}: ${y}`).join(" · ")) : esc(x)}</span>`).join("")
  : typeof v === "object" ? `<dl class="kv">${Object.entries(v).map(([k, x]) => `<dt>${esc(k)}</dt><dd>${fmt(x)}</dd>`).join("")}</dl>`
  : !known(v) ? `<span class="unk">${esc(v)}</span>` : linkify(v);
const isPinned = id => JSON.parse(localStorage.getItem("nw-pins") || "[]").includes(id);
const noteHref = r => `#notes?id=${encodeURIComponent(r.id || "")}`;
// kb://path and life://path -> in-app note links (broken links get a dashed badge).
function linkify(v) {
  return esc(v).replace(/\b(kb|life):\/\/([^\s)\]"'`<>|，。；]+)/g, (m, root, p) => { const r = resolveLink(records, `${root}://${p.replace(/&amp;/g, "&")}`);
    return r ? `<a class="xl L-${root === "life" ? "tui" : "ext"}" href="${noteHref(r)}"><b>${root}</b>${esc(r.title)}</a>` : `<span class="xl broken" title="未解析">${m}</span>`; });
}
const BADGE_COLS = new Set(["status", "two_fa", "stage"]);
function cell(r, c) {
  const v = r[c];
  if (c === "title" && v && typeof v === "object" && v.id) return `<a href="${noteHref(v)}">${esc(v.title)}</a> ${v.root === "life" ? `<span class="chip L-tui">life</span>` : ""}`;
  if (c === "risk" && known(v)) return `<span class="chip L-${riskC(v)}">${esc(v)}</span>`;
  if (BADGE_COLS.has(c) && v != null && typeof v !== "object") return badge(v);
  if (c === "renew_date" && v != null) { const n = nextRenewal(r); return `${fmt(v)} ${n ? cd(n.date, n.approx) : ""}`; }
  if (c === "url" && known(v)) return `<a href="${esc(v)}" target="_blank" rel="noopener">${esc(String(v).replace(/^https?:\/\//, ""))}</a>`;
  if (c === "owner" || c === "owner_agent") return known(v) ? `<span class="chip L-${/^user$/i.test(v) ? "infra" : "coding"}">${esc(v)}</span>` : fmt(v);
  return fmt(v);
}
const NUMC = new Set(["amount", "balance", "value"]), WRAPC = new Set(["notes", "purpose", "login_method", "snapshots", "next", "rules"]);
function table(rows, cols, { first = cols[0], rowClass = () => "" } = {}) {
  if (!rows.length) return `<p class="empty">无数据</p>`;
  return `<div class="tbl"><table><thead><tr>${cols.map(c => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr class="${rowClass(r)}">${cols.map(c =>
    `<td class="${c === first ? "t" : ""} ${NUMC.has(c) && known(r[c]) ? "num" : ""} ${WRAPC.has(c) ? "wrap" : ""}">${cell(r, c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
const card = (title, body, { span = "s6", right = "", cls = "" } = {}) => `<section class="card ${span} ${cls}"><h3>${title}${right ? `<span class="r">${right}</span>` : ""}</h3>${body}</section>`;
const stat = (n, k, { unit = "", warn = false } = {}) => `<div class="stat ${warn ? "warn" : ""}"><div class="n">${n}${unit ? `<small>${unit}</small>` : ""}</div><div class="k">${k}</div></div>`;
const GROUP_OF = id => (NAV.find(g => g.items.includes(id)) || { label: "" }).label;
const hero = (v, title, lead, inner = "", isHero = false) => `<header class="phero L-${COLOR[v.id]} ${isHero ? "hero" : ""}"><div class="in">
  <div class="pbar"><nav class="crumbs"><a href="#overview">n-workspace</a><span class="sep">/</span><span>${esc(GROUP_OF(v.id))}</span><span class="sep">/</span><span class="here">${esc(v.name)}</span></nav>
  <span class="spacer"></span><span class="eyebrow"><b>KB</b>${esc(bundle?.kb_ref || "n-knowledge-base")}${bundle?.modules?.[v.data]?.updated ? ` · ${esc(bundle.modules[v.data].updated)}` : ""}</span>
  <button class="btn sm pin-btn" data-pin="${v.id}">${isPinned(v.id) ? "★ 已固定" : "☆ 固定"}</button><button class="btn sm" data-cmdk>${ICONS.search}<span>搜索</span><kbd>⌘K</kbd></button></div>
  <h1>${title}</h1>${lead ? `<p class="lead">${lead}</p>` : ""}${inner}</div></header>`;

/* ---------- derived data ---------- */
// Completeness: share of leaf values that are not placeholders (待补充/待确认/待核实/不适用...).
function leaves(x, out = { k: 0, t: 0 }, key = "") {
  if (["notes", "privacy", "kind", "name", "source", "sources", "id"].includes(key)) return out;
  if (Array.isArray(x)) { x.forEach(y => leaves(y, out)); return out; }
  if (x && typeof x === "object") { for (const [k, y] of Object.entries(x)) leaves(y, out, k); return out; }
  out.t++; if (known(x)) out.k++; return out;
}
const completeness = () => ["profile", "accounts", "subscriptions", "finance", "tasks", "content"].filter(n => M[n]?.source)
  .map(n => { const r = leaves(n === "profile" ? M[n].data : M[n].items); return { label: n, done: r.k, total: r.t }; });
const toCNY = (amt, cur) => (FX[String(cur).toUpperCase()] ?? null) == null ? null : +amt * FX[String(cur).toUpperCase()];
const subs = () => M.subscriptions?.items || [];
const CAT = [[/openai|chatgpt|grok|perplexity|google ai|openrouter|claude/i, "AI 工具", "coding"], [/icloud|drive|dropbox|storage/i, "存储", "ext"], [/vps|hostinger|cloud|hyper3d|server/i, "云 / 开发", "agent"],
  [/视频|music|netflix|bilibili|vip/i, "影音会员", "tui"], [/许可|license/i, "软件许可", "ai"]];
const subCat = s => s.category || (CAT.find(([re]) => re.test(s.service || "")) || [0, "其他", "infra"])[1];
const catColor = c => (CAT.find(x => x[1] === c) || [0, 0, "infra"])[2];
const liveSub = s => !/cancel|refund|one-time|预充值|暂停|pause/i.test(s.status || "") && known(s.amount);
const CYCLE = s => /年|year/i.test(s.cycle || "") ? 12 : /季|quarter/i.test(s.cycle || "") ? 3 : /月|month/i.test(s.cycle || "") ? 1 : null;
function monthlyProjection(n = 12) {
  const now = new Date(), months = [...Array(n)].map((_, i) => { const d = new Date(now.getFullYear(), now.getMonth() + i, 1); return { y: d.getFullYear(), m: d.getMonth(), label: `${d.getMonth() + 1}月`, parts: {} }; });
  for (const s of subs().filter(liveSub)) { const step = CYCLE(s); if (!step) continue; const v = toCNY(s.amount, s.currency); if (v == null) continue;
    const r = nextRenewal(s); const start = r ? new Date(r.date) : null;
    months.forEach((mo, i) => { const hit = step === 1 || (start ? ((mo.y - start.getFullYear()) * 12 + mo.m - start.getMonth()) % step === 0 : i === 0);
      if (hit) { const c = subCat(s); mo.parts[c] = (mo.parts[c] || 0) + v; } }); }
  return months;
}
const monthlyCNY = () => subs().filter(liveSub).reduce((t, s) => { const k = CYCLE(s), v = toCNY(s.amount, s.currency); return k && v != null ? t + v / k : t; }, 0);
const tasks = () => M.tasks?.items || [];
const openTasks = () => tasks().filter(t => !/done|closed|cancel/i.test(t.status || ""));
const moduleOfTask = t => match(t, V.life?.data_filter || {}) ? "life" : "work";
const dupKey = s => String(s.service || "").toLowerCase().replace(/[（(].*$|\bvia\b.*$/g, "").trim();
const dupSet = () => { const c = {}; subs().forEach(s => c[dupKey(s)] = (c[dupKey(s)] || 0) + 1); return new Set(Object.keys(c).filter(k => c[k] > 1)); };
const has2fa = a => { const v = a.two_fa; if (!known(v)) return "待确认"; return /^(no|none|false|off|无|否|未开|关闭)/i.test(String(v)) ? "未开启" : "已开启"; };

/* ---------- shared visual blocks ---------- */
const TSTAGE = [["open", "待办", "agent"], ["in-progress", "进行中", "coding"], ["pending", "等待", "modes"], ["done", "完成", "ai"]];
const stageOf = t => /progress|doing/i.test(t.status) ? "in-progress" : /pend|block|wait/i.test(t.status) ? "pending" : /done|closed/i.test(t.status) ? "done" : "open";
function kanban(ts) {
  return `<div class="kb">${TSTAGE.map(([id, label, c]) => { const xs = ts.filter(t => stageOf(t) === id);
    return `<div class="kcol L-${c}"><h4><span class="sd L-${c}">${label}</span><span class="n">${xs.length}</span></h4>${xs.map(t => { const d = taskDue(t);
      return `<div class="kcard L-${isAgentTask(t) ? "coding" : "infra"}"><b>${esc(t.title)}</b><div class="m"><span class="chip L-${isAgentTask(t) ? "coding" : "infra"}">${esc(t.owner ?? "?")}</span>${d ? cd(d.date, d.approx) : ""}<span>${esc(t.id ?? "")}</span></div></div>`; }).join("") || `<p class="empty">—</p>`}</div>`; }).join("")}</div>`;
}
const steps = rows => `<div class="steps">${rows.map(r => `<div class="step L-${r.c}"><div class="n">${r.n}</div><div class="k">${esc(r.k)}</div></div>`).join("")}</div>`;
function ownerChart() {
  const owners = [...new Set(tasks().map(t => t.owner ?? "?"))].sort((a, b) => a === "user" ? -1 : b === "user" ? 1 : a.localeCompare(b));
  return stackedBars(owners.map(o => ({ label: o, parts: TSTAGE.map(([id, label, c]) => ({ c, label, v: tasks().filter(t => (t.owner ?? "?") === o && stageOf(t) === id).length })) })),
    { h: 230, W: 420, series: TSTAGE.map(([id, label, c]) => ({ c, label, v: tasks().filter(t => stageOf(t) === id).length })) });
}
function agentFlow() {
  const mods = ["work", "life", "content", "accounts", "subscriptions", "learning"];
  const edges = {}; const add = (a, m) => { const k = a + ">" + m; edges[k] = (edges[k] || 0) + 1; };
  for (const t of tasks()) if (isAgentTask(t)) add(t.owner, moduleOfTask(t));
  for (const c of M.content?.items || []) if (known(c.owner_agent)) add(c.owner_agent, "content");
  const E = Object.entries(edges).map(([k, v]) => { const [from, to] = k.split(">"); return { from, to, v }; });
  const agents = [...new Set([...AGENTS, ...E.map(e => e.from)])];
  const left = agents.map(a => ({ id: a, label: a, n: E.filter(e => e.from === a).reduce((s, e) => s + e.v, 0) || "", active: E.some(e => e.from === a) }));
  const right = mods.map(m => ({ id: m, label: V[m]?.name || m, c: COLOR[m], n: E.filter(e => e.to === m).reduce((s, e) => s + e.v, 0) || "" }));
  return flow(left, right, E) + `<p class="note">连线 = 该 Agent 负责的未完成任务（tasks.yaml owner）与内容渠道（content.yaml owner_agent）；灰色 Agent 当前无数据关联。</p>`;
}
function renewalTimeline(withTasks = true) {
  const items = [];
  for (const s of subs()) { if (/cancel/i.test(s.status || "")) continue;
    const r = nextRenewal(s); if (r) items.push({ label: s.service, days: daysUntil(r.date), c: urg(daysUntil(r.date)) });
    if (s.billed_date) items.push({ label: `${s.service}（扣款）`, days: daysUntil(s.billed_date), c: "err" }); }
  if (withTasks) for (const t of openTasks()) { const d = taskDue(t); if (d) items.push({ label: t.title.slice(0, 12), days: daysUntil(d.date), c: "infra" }); }
  items.sort((a, b) => a.days - b.days);
  return timeline(items.slice(0, 18)) + `<p class="note">橙色带 = 14 天内；续费日为空（待补充）的订阅不在轴上。</p>`;
}
function securityChecklist(accts) {
  const live = accts.filter(a => !/closed/i.test(a.status || ""));
  const chk = [["2FA 已确认", a => known(a.two_fa)], ["密码保管处", a => known(a.password_location)], ["绑定手机", a => known(a.phone_binding)], ["最近核对", a => known(a.last_checked)], ["登录方式", a => known(a.login_method)]];
  return progress(chk.map(([label, f]) => ({ label, done: live.filter(f).length, total: live.length }))) + `<p class="note">统计范围：${live.length} 个未关闭账号。</p>`;
}
function riskTierProgress(accts) {
  return progress(["P0", "P1", "P2", "P3", "P4"].map(p => { const xs = accts.filter(a => String(a.risk).toUpperCase() === p && !/closed/i.test(a.status || ""));
    return { label: `${p} · ${xs.length} 个`, done: xs.filter(a => has2fa(a) === "已开启").length, total: xs.length, c: riskC(p) }; }).filter(r => r.total));
}
function notesTable(v) {
  const rs = v.notes ? records.filter(r => match(r, v.notes)) : []; if (!rs.length) return "";
  return `<h3 class="subh">相关笔记 · ${rs.length}</h3>` + table(rs.sort((a, b) => String(b.updated).localeCompare(String(a.updated))).slice(0, 60).map(r => ({ ...r, title: r, path: `${r.root}://${r.origin?.source_path}` })), ["title", "status", "updated", "path"]);
}
const missing = v => v.data && bundle?.missing?.includes(`${v.data}.yaml`) ? `<div class="banner">KB 中未找到 <code>${esc(bundle.data_dir)}/${v.data}.yaml</code>。</div>` : "";

/* ---------- pages ---------- */
const PAGES = {
  overview(v) {
    const o = overview(bundle, v), accts = M.accounts?.items || [], fs = M.finance?.snapshot || {};
    const comp = completeness(), ck = comp.reduce((a, c) => a + c.done, 0), ct = comp.reduce((a, c) => a + c.total, 0);
    const high = o.alerts.filter(a => a.level === "high").length;
    const nw = M.finance?.summary?.net_worth;
    const today = new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" });
    const statsHtml = `<div class="stats">${stat(o.upcoming.filter(u => u.days <= 30).length, "30 天内续费 / 截止")}${stat(o.alerts.length, `风险提醒 · 高 ${high}`, { warn: high > 0 })}
      ${stat(openTasks().length, `未完成任务 · Agent ${o.agentTasks.length}`)}${stat(Math.round(monthlyCNY()), "月度订阅 ≈", { unit: "CNY" })}
      ${stat(accts.length, `账号 · 2FA 已确认 ${accts.filter(a => has2fa(a) === "已开启").length}`)}
      ${stat(nw != null ? Math.round(nw).toLocaleString() : `<span class="unk">${esc(fs.date ?? "待补充")}</span>`, `净资产（${esc(fs.currency || "CNY")}）· 已填 ${M.finance?.summary?.filled ?? 0}/${M.finance?.summary?.total ?? 0}`)}
      ${stat(ct ? Math.round(ck / ct * 100) + "%" : "—", "数据完整度")}</div>`;
    const up = o.upcoming.length ? `<div class="ulist">${o.upcoming.slice(0, 9).map(u => `<div class="urow L-${urg(u.days)}">${cd(u.date, u.approx)}<div><b>${esc(u.name)}</b><span class="m">${esc(u.kind)} · ${esc(u.date)}</span></div><span class="m x">${esc(u.extra || "")}</span></div>`).join("")}</div>` : `<p class="empty">${v.window_days} 天内无续费/截止</p>`;
    const LV = { high: ["err", "高"], medium: ["modes", "中"], low: ["infra", "低"] };
    const al = o.alerts.length ? o.alerts.map(a => `<div class="al L-${LV[a.level][0]}"><span class="lv">${LV[a.level][1]}</span>${esc(a.msg)}<span class="mod">${esc(a.module)}</span></div>`).join("") : `<p class="empty">暂无风险提醒</p>`;
    const months = monthlyProjection(), cats = [...new Set(months.flatMap(m => Object.keys(m.parts)))];
    return hero(v, `<span class="grad">${esc(today)}</span>`, "续费、截止、风险与 Agent 任务一屏总览。数据来自私有知识库，仅本机构建。", statsHtml, true) + `<div class="body">
      <div class="grid">${card("即将到来 · 倒计时", up, { span: "s7", right: `${o.upcoming.length} 项` })}${card("风险提醒", al, { span: "s5", right: `${o.alerts.length} 条` })}</div>
      <div class="grid">${card("续费与截止时间轴", renewalTimeline(), { span: "s12" })}</div>
      <div class="grid">${card("Agent → 模块 关系图", agentFlow(), { span: "s7" })}${card("数据完整度（非 待补充/待确认 占比）", progress(comp), { span: "s5", right: `${ck}/${ct}` })}</div>
      <div class="grid">${card("订阅支出预测 · 未来 12 个月（≈CNY，按类别）", stackedBars(months.map(m => ({ label: m.label, parts: cats.map(c => ({ c: catColor(c), label: c, v: m.parts[c] || 0 })) })), { W: 560, series: cats.map(c => ({ c: catColor(c), label: c, v: Math.round(months.reduce((a, m) => a + (m.parts[c] || 0), 0)) })) }), { span: "s7" })}
        ${card("任务状态 · 按负责人 / Agent", ownerChart(), { span: "s5" })}</div>
      <div class="grid">${card("Agent 任务看板", kanban(o.agentTasks), { span: "s12", right: `${o.agentTasks.length} 项` })}</div>
      <div class="grid">${card("今日 · 最近更新的笔记", table(o.recent, ["title", "status", "area", "updated"]), { span: "s12" })}</div></div>`;
  },
  profile(v) {
    const d = M.profile?.data || {}; const c = leaves(d);
    const sec = Object.entries(d).map(([k, x]) => card(esc(k), fmt(x), { span: k === "emergency" ? "s12" : "s6" })).join("");
    return hero(v, "个人信息", "基本信息、家庭、联系方式（掩码）、紧急信息索引与简历状态。", `<div class="facts"><div class="fact"><div class="n">${Object.keys(d).length}</div><div class="k">分区</div></div><div class="fact"><div class="n">${c.t ? Math.round(c.k / c.t * 100) : 0}%</div><div class="k">已填 ${c.k}/${c.t}</div></div></div>`)
      + `<div class="body">${missing(v)}<div class="grid">${card("各分区完整度", progress(Object.entries(d).map(([k, x]) => { const r = leaves(x); return { label: k, done: r.k, total: r.t }; })), { span: "s12" })}${sec}</div>${notesTable(v)}</div>`;
  },
  accounts(v) {
    const a = M.accounts?.items || [];
    const st = [...new Set(a.map(x => x.status || "?"))].map(s => ({ label: s, v: a.filter(x => (x.status || "?") === s).length, c: tone(s) }));
    const f2 = ["已开启", "未开启", "待确认"].map((s, i) => ({ label: s, v: a.filter(x => !/closed/i.test(x.status || "") && has2fa(x) === s).length, c: ["ai", "err", "modes"][i] }));
    const cats = Object.entries(a.reduce((t, x) => (t[x.category || "?"] = (t[x.category || "?"] || 0) + 1, t), {})).sort((x, y) => y[1] - x[1]).slice(0, 10).map(([label, n], i) => ({ label, v: n, c: ["agent", "coding", "ai", "modes", "tui", "ext"][i % 6] }));
    const sorted = [...a].sort((x, y) => String(x.risk ?? "~").localeCompare(String(y.risk ?? "~")));
    return hero(v, "账号中心", "账号状态、2FA 与风险等级（P0 核心身份 → P4 可弃）。不含任何密码或恢复码。", `<div class="facts">${["P0", "P1", "P2", "P3", "P4"].map(p => `<div class="fact"><div class="n">${a.filter(x => x.risk === p).length}</div><div class="k"><span class="chip L-${riskC(p)}">${p}</span></div></div>`).join("")}</div>`)
      + `<div class="body">${missing(v)}<div class="grid">${card("状态 / 2FA", `<div class="donuts">${donut(st, { title: "账号状态" })}${donut(f2, { title: "2FA（未关闭）" })}</div>`, { span: "s5" })}
        ${card("安全检查清单 · 进度", securityChecklist(a), { span: "s4" })}${card("2FA 已确认 · 按风险等级", riskTierProgress(a), { span: "s3" })}</div>
        <div class="grid">${card("分类分布 · Top 10", hbars(cats), { span: "s12" })}</div>
        <h3 class="subh">accounts.yaml · ${a.length}</h3>${table(sorted, v.columns.filter(c => a.some(r => r[c] != null)))}${notesTable(v)}</div>`;
  },
  subscriptions(v) {
    const s = subs(), dups = dupSet(), months = monthlyProjection(), cats = [...new Set(months.flatMap(m => Object.keys(m.parts)))];
    const byCat = Object.entries(s.filter(liveSub).reduce((t, x) => { const k = CYCLE(x), c = toCNY(x.amount, x.currency); if (k && c != null) t[subCat(x)] = (t[subCat(x)] || 0) + c / k; return t; }, {})).map(([label, n]) => ({ label, v: n, c: catColor(label) })).sort((a, b) => b.v - a.v);
    const stc = [...new Set(s.map(x => x.status || "?"))].map(x => ({ label: x, v: s.filter(y => (y.status || "?") === x).length, c: tone(x) }));
    const rows = s.map(x => ({ ...x, category: subCat(x), service: x.service + (dups.has(dupKey(x)) ? " ⚠︎" : "") }));
    return hero(v, "订阅与支出", "续费日倒计时、按类别的月度支出与 12 个月预测（外币按固定汇率折算 ≈CNY）。", `<div class="facts"><div class="fact"><div class="n">${s.length}</div><div class="k">记录</div></div><div class="fact"><div class="n">${s.filter(liveSub).length}</div><div class="k">计费中（金额已知）</div></div><div class="fact"><div class="n">≈${Math.round(monthlyCNY())}</div><div class="k">CNY / 月</div></div><div class="fact"><div class="n">${s.filter(x => /待核实|待补充/.test(x.status || "")).length}</div><div class="k">待核实</div></div></div>`)
      + `<div class="body">${missing(v)}${dups.size ? `<div class="banner">⚠︎ 可能重复：${[...dups].map(esc).join("、")}，KB 标注待合并。两条记录均按原样显示，未去重。</div>` : ""}
        <div class="grid">${card("续费时间轴", renewalTimeline(false), { span: "s12" })}</div>
        <div class="grid">${card("未来 12 个月支出（≈CNY）", stackedBars(months.map(m => ({ label: m.label, parts: cats.map(c => ({ c: catColor(c), label: c, v: m.parts[c] || 0 })) })), { W: 560, series: cats.map(c => ({ c: catColor(c), label: c, v: Math.round(months.reduce((a, m) => a + (m.parts[c] || 0), 0)) })) }), { span: "s7" })}
          ${card("按类别 · 月均 ≈CNY", hbars(byCat) + `<p class="note">类别由服务名推断（KB 无 category 字段）。</p>`, { span: "s5" })}</div>
        <div class="grid">${card("状态分布", donut(stc, { title: "订阅" }), { span: "s4" })}${card("续费流程", steps([["active", "agent"], ["待核实", "modes"], ["refund-requested", "err"], ["canceled", "infra"], ["one-time", "ai"]].map(([k, c]) => ({ k, c, n: s.filter(x => (x.status || "") === k || (k === "待核实" && /待核实|疑似|暂停/.test(x.status || ""))).length }))), { span: "s8" })}</div>
        <h3 class="subh">subscriptions.yaml · ${s.length}</h3>${table(rows, ["service", "category", ...v.columns.slice(1)].filter(c => rows.some(r => r[c] != null)), { rowClass: r => dups.has(dupKey({ service: r.service.replace(" ⚠︎", "") })) ? "dup" : "" })}${notesTable(v)}</div>`;
  },
  finance(v) {
    const f = M.finance || {}, items = f.items || [], snap = f.snapshot || {}, sum = f.summary || {};
    const kinds = [...new Set(items.map(x => x.kind))];
    const types = Object.entries(items.filter(x => x.kind === "accounts").reduce((t, x) => (t[x.type || "?"] = (t[x.type || "?"] || 0) + 1, t), {})).sort((a, b) => b[1] - a[1]).map(([label, n], i) => ({ label, v: n, c: ["ai", "agent", "coding", "modes", "tui", "ext"][i % 6] }));
    const fact = (n, k) => `<div class="fact"><div class="n">${n}</div><div class="k">${k}</div></div>`;
    const money = x => x == null ? `<span class="unk">待补充</span>` : Math.round(x).toLocaleString();
    return hero(v, "理财", "资产负债表快照、账户清单与目标。金额未填时显示为待补充。", `<div class="facts">${fact(fmt(snap.date ?? "待补充"), "快照日期")}${fact(esc(snap.currency ?? "—"), "币种")}${fact(fmt(snap.scope ?? "待补充"), "范围")}
      ${fact(money(sum.assets), "资产合计")}${fact(money(sum.liabilities), "负债合计")}${fact(money(sum.net_worth), "净资产")}${fact(`${sum.filled ?? 0}/${sum.total ?? 0}`, "金额已填")}</div>`)
      + `<div class="body">${missing(v)}<div class="grid">${card("snapshot", `<dl class="kv">${Object.entries(snap).map(([k, x]) => `<dt>${esc(k)}</dt><dd>${fmt(x)}</dd>`).join("") || "<dd class=empty>无</dd>"}</dl>`, { span: "s4" })}
        ${card("各分区金额填写进度", progress(kinds.filter(k => k !== "accounts").map(k => { const xs = items.filter(x => x.kind === k); return { label: k, done: xs.filter(x => known(x.amount ?? x.balance ?? x.value)).length, total: xs.length }; })), { span: "s4" })}
        ${card("账户类型", hbars(types), { span: "s4" })}</div>
        ${kinds.map(k => { const xs = items.filter(x => x.kind === k); return `<h3 class="subh">${esc(k)} · ${xs.length}</h3>${table(xs, v.columns.filter(c => c !== "kind" && xs.some(r => r[c] != null)))}`; }).join("")}${notesTable(v)}</div>`;
  },
  work(v) { return taskPage(v, "工作与项目", "项目与 Agent 任务的流转看板。"); },
  life(v) { return taskPage(v, "生活事务", "12 个月行动清单与家庭事务。"); },
  learning(v) {
    const rs = records.filter(r => match(r, v.notes)), g = r => r.maturity ?? v.default_group;
    const MC = { stub: "infra", learning: "agent", evolving: "coding", evergreen: "ai" };
    const areas = Object.entries(rs.reduce((t, r) => (t[r.area] = (t[r.area] || 0) + 1, t), {})).sort((a, b) => b[1] - a[1]).map(([label, n], i) => ({ label, v: n, c: ["ext", "agent", "coding", "ai", "modes", "tui"][i % 6] }));
    return hero(v, "学习与成长", "笔记成熟度流水线：stub → learning → evolving → evergreen。", "")
      + `<div class="body">${steps(v.columns_board.map(c => ({ k: c, c: MC[c], n: rs.filter(r => g(r) === c).length })))}
      <div class="grid">${card("按领域", hbars(areas), { span: "s5" })}${card("成熟度", donut(v.columns_board.map(c => ({ label: c, v: rs.filter(r => g(r) === c).length, c: MC[c] })), { title: "笔记" }), { span: "s4" })}${card("最近更新", table(rs.sort((a, b) => String(b.updated).localeCompare(String(a.updated))).slice(0, 6), ["title", "updated"]), { span: "s4" })}</div>
      <div class="kb">${v.columns_board.map(c => { const xs = rs.filter(r => g(r) === c); return `<div class="kcol L-${MC[c]}"><h4><span class="sd L-${MC[c]}">${c}</span><span class="n">${xs.length}</span></h4>${xs.slice(0, 30).map(r => `<div class="kcard L-${MC[c]}"><b>${esc(r.title)}</b><div class="m">${esc(r.area)} · ${esc(r.updated)}</div></div>`).join("")}${xs.length > 30 ? `<p class="note">…另 ${xs.length - 30} 条</p>` : ""}</div>`; }).join("")}</div></div>`;
  },
  content(v) {
    const ch = M.content?.items || [];
    const cards = ch.map(c => { const last = as(c.snapshots).at(-1) || {};
      return card(`${esc(c.platform)} <span class="chip L-coding">${esc(c.owner_agent ?? "")}</span>`, `<div class="facts" style="margin-bottom:12px">${["posts", "followers", "following"].map(k => `<div class="fact"><div class="n">${fmt(last[k] ?? "—")}</div><div class="k">${k}</div></div>`).join("")}</div>
        <dl class="kv"><dt>handle</dt><dd>${cell(c, "handle")}</dd><dt>url</dt><dd>${cell(c, "url")}</dd><dt>stage</dt><dd>${cell(c, "stage")}</dd>${c.positioning ? `<dt>定位</dt><dd>${esc(c.positioning)}</dd>` : ""}${c.rules ? `<dt>规则</dt><dd>${fmt(c.rules)}</dd>` : ""}${c.notes ? `<dt>notes</dt><dd>${esc(c.notes)}</dd>` : ""}</dl>
        ${as(c.next).length ? `<h3 class="subh">下一步</h3><ol class="ulist">${as(c.next).map((n, i) => `<div class="urow L-coding" style="grid-template-columns:30px 1fr"><span class="mono">${i + 1}</span><div>${esc(n)}</div></div>`).join("")}</ol>` : ""}`, { span: "s6" }); }).join("");
    const STG = [["养号", "modes"], ["起号", "agent"], ["运营", "coding"], ["变现", "ai"]];
    return hero(v, "内容运营", "X / B站 渠道阶段、数据快照与下一步。", "") + `<div class="body">${missing(v)}
      ${steps(STG.map(([k, c]) => ({ k, c, n: ch.filter(x => String(x.stage ?? "").includes(k)).map(x => x.platform).join(" · ") || "—" })))}
      <div class="grid">${cards}</div>${notesTable(v)}</div>`;
  },
};
function taskPage(v, title, lead) {
  const ts = tasks().filter(t => match(t, v.data_filter || {}));
  const due = ts.map(t => ({ t, d: taskDue(t) })).filter(x => x.d).sort((a, b) => a.d.date.localeCompare(b.d.date));
  return hero(v, title, lead, `<div class="facts">${TSTAGE.map(([id, label, c]) => `<div class="fact"><div class="n">${ts.filter(t => stageOf(t) === id).length}</div><div class="k"><span class="sd L-${c}">${label}</span></div></div>`).join("")}<div class="fact"><div class="n">${ts.filter(isAgentTask).length}</div><div class="k">Agent 负责</div></div></div>`)
    + `<div class="body">${missing(v)}<div class="grid">${card("任务看板 · 按阶段", kanban(ts), { span: "s12", right: `${ts.length} 项` })}</div>
      <div class="grid">${card("截止倒计时（由备注中的年月推断）", due.length ? `<div class="ulist">${due.map(({ t, d }) => `<div class="urow L-${urg(daysUntil(d.date))}">${cd(d.date, d.approx)}<div><b>${esc(t.title)}</b><span class="m">${esc(t.id)} · ${esc(d.date)}</span></div><span class="m x">${esc(t.owner)}</span></div>`).join("")}</div>` : `<p class="empty">无可推断的截止日期</p>`, { span: "s7" })}
      ${card("按负责人", hbars(Object.entries(ts.reduce((a, t) => (a[t.owner ?? "?"] = (a[t.owner ?? "?"] || 0) + 1, a), {})).map(([label, n]) => ({ label, v: n, c: /^user$/i.test(label) ? "infra" : "coding" }))), { span: "s5" })}</div>
      <h3 class="subh">tasks.yaml · ${ts.length}</h3>${table(ts, v.columns)}${notesTable(v)}</div>`;
}

/* ---------- router ---------- */
/* ---------- added pages: 任务 / 知识库 ---------- */
PAGES.tasks = v => {
  const ts = tasks(), ag = ts.filter(isAgentTask);
  return hero(v, "任务", "全部任务（个人 + Agent），按阶段流转。", kpis([[ts.length, "全部"], [ts.filter(t => stageOf(t) === "open").length, "待办"], [ts.filter(t => stageOf(t) === "in-progress").length, "进行中"], [ts.filter(t => stageOf(t) === "pending").length, "等待"], [ag.length, "Agent 负责"]]))
    + `<div class="body"><div class="grid">${card("看板 · 按阶段", kanban(ts), { span: "s12", right: `${ts.length} 项` })}</div>
    <div class="grid">${card("按负责人 / Agent", ownerChart(), { span: "s12" })}</div>
    <h3 class="subh">tasks.yaml · ${ts.length}</h3>${table(ts.map(t => ({ ...t, module: V[moduleOfTask(t)]?.name })), ["id", "title", "owner", "status", "module", "notes"])}</div>`;
};
PAGES.notes = (v, q = "") => {
  const P = new URLSearchParams(q), area = P.get("area"), text = P.get("q") || "", root = P.get("root"), id = P.get("id");
  const sel = id ? records.find(r => r.id === id) : null;
  const pool = records.filter(r => !root || r.root === root);
  const areas = Object.entries(pool.reduce((a, r) => (a[r.area || "?"] = (a[r.area || "?"] || 0) + 1, a), {})).sort((a, b) => b[1] - a[1]);
  const rs = pool.filter(r => (!area || r.area === area) && (!text || (r.title + " " + r.tags.join(" ") + " " + r.origin?.source_path).toLowerCase().includes(text.toLowerCase())))
    .sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
  const qs = o => "#notes?" + new URLSearchParams(Object.entries({ root, area, ...o }).filter(([, x]) => x)).toString();
  const nroot = k => records.filter(r => r.root === k).length;
  const detail = sel ? `<section class="card note-detail L-${sel.root === "life" ? "tui" : "ext"}" style="margin-bottom:16px"><h3><span class="chip L-${sel.root === "life" ? "tui" : "ext"}">${sel.root}</span>${esc(sel.title)}<span class="r"><a href="${qs({})}">关闭 ×</a></span></h3>
    <dl class="kv"><dt>路径</dt><dd class="mono">${esc(sel.root)}://${esc(sel.origin?.source_path)}</dd>${["type", "area", "status", "maturity", "privacy", "updated", "tags"].filter(k => sel[k] != null && (!Array.isArray(sel[k]) || sel[k].length)).map(k => `<dt>${k}</dt><dd>${k === "status" ? badge(sel[k]) : fmt(sel[k])}</dd>`).join("")}
    <dt>出链 (${(sel.links || []).length})</dt><dd>${(sel.links || []).map(l => { const r = l.id && records.find(x => x.id === l.id); return r ? `<a class="xl L-${r.root === "life" ? "tui" : "ext"}" href="${noteHref(r)}"><b>${r.root}</b>${esc(r.title)}</a>` : `<span class="xl broken">${esc(l.href)}</span>`; }).join(" ") || "—"}</dd>
    <dt>反链 (${(sel.backlinks || []).length})</dt><dd>${(sel.backlinks || []).map(bid => { const r = records.find(x => x.id === bid); return r ? `<a class="xl L-${r.root === "life" ? "tui" : "ext"}" href="${noteHref(r)}"><b>${r.root}</b>${esc(r.title)}</a>` : ""; }).join(" ") || "—"}</dd></dl></section>` : "";
  return hero(v, "知识库", "两个根：n-knowledge-base（kb://，按 frontmatter privacy）与 n-life-data（life://，全部私密）。", kpis([[records.length, "笔记"], [nroot("kb"), "kb://"], [nroot("life"), "life:// · 私密"], [records.reduce((a, r) => a + (r.links?.length || 0), 0), `链接 · 未解析 ${bundle.broken_links ?? 0}`]]))
    + `<div class="body">${!bundle.roots?.life ? `<div class="banner">未加载 n-life-data（life/）。设置 <code>LIFE_REPO</code> / <code>LIFE_LOCAL</code> 后重新 <code>npm start</code>；当前结构化数据来自 ${esc(bundle.data_root === "kb" ? "KB data/（回退）" : bundle.data_dir)}。</div>` : ""}${detail}
    <div class="filters"><a class="fchip ${!root ? "on" : ""}" href="#notes">全部根 <b>${records.length}</b></a><a class="fchip ${root === "kb" ? "on" : ""}" href="#notes?root=kb">kb:// <b>${nroot("kb")}</b></a><a class="fchip ${root === "life" ? "on" : ""}" href="#notes?root=life">life:// <b>${nroot("life")}</b></a></div>
    <div class="filters"><a class="fchip ${!area ? "on" : ""}" href="${qs({ area: "" })}">全部领域 <b>${pool.length}</b></a>${areas.map(([a, n]) => `<a class="fchip ${area === a ? "on" : ""}" href="${qs({ area: a })}">${esc(a)} <b>${n}</b></a>`).join("")}</div>
    ${text ? `<div class="banner">搜索：<b>${esc(text)}</b> · ${rs.length} 条 <a href="#notes">清除</a></div>` : ""}
    ${table(rs.slice(0, 200).map(r => ({ ...r, title: r, path: `${r.root}://${r.origin?.source_path}` })), ["title", "area", "type", "status", "updated", "path"])}${rs.length > 200 ? `<p class="note">仅显示前 200 条</p>` : ""}</div>`;
};
function kpis(rows) { return `<div class="stats">${rows.map(([n, k, o]) => stat(n, k, o || {})).join("")}</div>`; }

/* ---------- icons ---------- */
const P = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICONS = {
  overview: P('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
  tasks: P('<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>'),
  profile: P('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  accounts: P('<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'),
  finance: P('<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>'),
  subscriptions: P('<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>'),
  work: P('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>'),
  content: P('<path d="M4 4h16v12H8l-4 4z"/>'),
  learning: P('<path d="M2 7l10-4 10 4-10 4z"/><path d="M6 9v5c0 2 3 3 6 3s6-1 6-3V9"/>'),
  notes: P('<path d="M4 4h11l5 5v11H4z"/><path d="M14 4v6h6"/>'),
  life: P('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>'),
  search: P('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
  chev: P('<path d="M6 9l6 6 6-6"/>'),
  star: P('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>'),
  bot: P('<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 14h.01M15 14h.01"/>'),
};

/* ---------- sidebar ---------- */
const NAV = [
  { id: "g-desk", label: "工作台", items: ["overview", "tasks"] },
  { id: "g-me", label: "我", items: ["profile", "accounts", "finance", "subscriptions"] },
  { id: "g-career", label: "事业", items: ["work", "content"] },
  { id: "g-grow", label: "成长", items: ["learning", "notes"] },
  { id: "g-life", label: "生活", items: ["life"] },
];
const LS = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set: (k, v) => localStorage.setItem(k, JSON.stringify(v)) };
const OV = bundle ? overview(bundle, V.overview) : { alerts: [], upcoming: [], agentTasks: [] };
const ALERT_MOD = { subscriptions: "subscriptions", accounts: "accounts", tasks: "tasks", profile: "profile" };
const alertsFor = id => OV.alerts.filter(a => ALERT_MOD[a.module] === id || (id === "overview"));
const navCount = id => ({ tasks: openTasks().length, accounts: M.accounts?.items?.length, subscriptions: M.subscriptions?.items?.length, finance: M.finance?.items?.length, work: tasks().filter(t => match(t, V.work.data_filter)).length, life: tasks().filter(t => match(t, V.life.data_filter)).length, content: M.content?.items?.length, learning: records.filter(r => match(r, V.learning.notes)).length, notes: records.length })[id] ?? "";
function navItem(id) {
  const v = V[id]; if (!v) return ""; const al = id === "overview" ? [] : alertsFor(id), hi = al.some(a => a.level === "high");
  return `<a href="#${id}" data-id="${id}" class="ni L-${COLOR[id]}"><span class="ic">${ICONS[id] || ""}</span><span class="lb">${esc(v.name)}</span>
    ${al.length ? `<span class="ab ${hi ? "hi" : ""}" title="${al.length} 条提醒">${al.length}</span>` : ""}<span class="cnt">${navCount(id)}</span>
    <button class="pin ${isPinned(id) ? "on" : ""}" data-pin="${id}" title="固定">${ICONS.star}</button></a>`;
}
function agentStatus() {
  const AG = ["Bot", "X", "KB", "Pi", "Github", "Register", "Blibli"];
  return AG.map(a => { const ts = tasks().filter(t => t.owner === a), ch = (M.content?.items || []).filter(c => c.owner_agent === a);
    const st = ts.some(t => stageOf(t) === "in-progress") ? ["运行中", "ai"] : ts.some(t => stageOf(t) === "pending") ? ["等待", "modes"] : ts.length || ch.length ? ["排队", "agent"] : ["空闲", "infra"];
    return `<div class="ag L-${st[1]}" title="${esc(a)} · ${st[0]} · 任务 ${ts.length}${ch.length ? ` · 渠道 ${ch.length}` : ""}"><span class="st"></span><span class="lb">${esc(a)}</span><span class="cnt">${ts.length || ""}</span><span class="sl">${st[0]}</span></div>`; }).join("");
}
function sidebar() {
  const p = M.profile?.data?.personal || {}, name = known(p.name) ? p.name : "我", pins = LS.get("nw-pins", []), col = LS.get("nw-collapsed", []);
  document.getElementById("side").innerHTML = `
   <div class="me"><span class="av">${esc(String(name).slice(-1))}</span><div class="who"><b>${esc(name)}</b><small>${esc([p.occupation, p.location].filter(known).join(" · ") || "n-workspace")}</small></div><button class="iconbtn theme sm" aria-label="切换主题"></button></div>
   <button class="search" data-cmdk>${ICONS.search}<span>搜索模块与记录…</span><kbd>⌘K</kbd></button>
   <div class="nav-scroll">
   ${pins.length ? `<div class="grp"><div class="gh static">${ICONS.star}<span>固定</span></div><div class="gi">${pins.map(navItem).join("")}</div></div>` : ""}
   ${NAV.map(g => `<div class="grp ${col.includes(g.id) ? "closed" : ""}"><button class="gh" data-grp="${g.id}"><span>${g.label}</span><span class="gc">${g.items.reduce((n, id) => n + alertsFor(id).filter(() => id !== "overview").length, 0) || ""}</span><span class="chev">${ICONS.chev}</span></button><div class="gi">${g.items.map(navItem).join("")}</div></div>`).join("")}
   </div>
   <div class="agents"><div class="gh static">${ICONS.bot}<span>Agents</span><span class="gc">${OV.agentTasks.length}</span></div>${agentStatus()}</div>
   <div class="side-foot">${bundle ? `<span class="mono">kb@${esc(bundle.kb_ref || "main")} · ${bundle.roots?.life ? `life@${esc(bundle.life_ref)}` : "life: 未加载"}</span><br>构建 ${esc(new Date(bundle.generated).toLocaleString("zh-CN", { hour12: false }))} · ${bundle.show_private ? "含私密 · 仅本机" : `隐藏私密 ${bundle.private_hidden}`}` : ""}</div>`;
  wireTheme();
}
function wireTheme() {
  document.querySelectorAll(".theme").forEach(b => { b.innerHTML = ICON_MOON + ICON_SUN; b.onclick = e => { e.preventDefault();
    const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = t; localStorage.setItem("nw-theme", t); }; });
}
document.addEventListener("click", e => {
  const pin = e.target.closest("[data-pin]");
  if (pin) { e.preventDefault(); e.stopPropagation(); const id = pin.dataset.pin, ps = LS.get("nw-pins", []);
    LS.set("nw-pins", ps.includes(id) ? ps.filter(x => x !== id) : [...ps, id]); sidebar(); render(); return; }
  const g = e.target.closest("[data-grp]");
  if (g) { const id = g.dataset.grp, c = LS.get("nw-collapsed", []); LS.set("nw-collapsed", c.includes(id) ? c.filter(x => x !== id) : [...c, id]); g.parentElement.classList.toggle("closed"); return; }
  if (e.target.closest("[data-cmdk]")) { e.preventDefault(); openK(); }
});

/* ---------- right rail ---------- */
const MOD_UP = { overview: () => true, subscriptions: u => u.kind === "续费", tasks: u => u.kind === "截止", work: u => u.kind === "截止", life: u => u.kind === "截止", profile: u => u.kind === "证件到期" };
function rail(v) {
  const LV = { high: ["err", "高"], medium: ["modes", "中"], low: ["infra", "低"] };
  const al = v.id === "overview" ? [] : alertsFor(v.id), up = OV.upcoming.filter(MOD_UP[v.id] || (() => false));
  const comp = completeness().find(c => c.label === (v.data === "tasks" ? "tasks" : v.data));
  const rel = v.notes ? records.filter(r => match(r, v.notes)).sort((a, b) => String(b.updated).localeCompare(String(a.updated))).slice(0, 6) : [];
  const box = (t, b, r = "") => `<section class="rbox"><h4>${t}${r ? `<span>${r}</span>` : ""}</h4>${b}</section>`;
  let h = "";
  if (v.id === "overview") h += box("Agents", `<div class="agents in-rail">${agentStatus()}</div>`, `${OV.agentTasks.length} 任务`) + box("数据完整度", progress(completeness()));
  if (up.length) h += box("倒计时", `<div class="mini">${up.slice(0, 6).map(u => `<div class="mr">${cd(u.date, u.approx)}<span>${esc(u.name)}</span></div>`).join("")}</div>`, up.length);
  if (al.length) h += box("提醒", al.map(a => `<div class="al L-${LV[a.level][0]}"><span class="lv">${LV[a.level][1]}</span>${esc(a.msg.length > 70 ? a.msg.slice(0, 70) + "…" : a.msg)}</div>`).join(""), al.length);
  if (comp) h += box("数据完整度", progress([comp]) + `<p class="note">${comp.done}/${comp.total} 个字段已填，其余为 待补充/待确认。</p>`);
  if (rel.length) h += box("相关笔记", `<div class="mini">${rel.map(r => `<a class="mr" href="${noteHref(r)}">${ICONS.notes}<span>${esc(r.title)}</span><small>${esc(r.updated)}</small></a>`).join("")}</div>`);
  if (bundle?.modules?.[v.data]?.source) h += box("来源", `<p class="note mono">${esc(bundle.modules[v.data].source)}<br>更新 ${esc(bundle.modules[v.data].updated || "—")}</p>`);
  return h ? `<aside class="rail">${h}</aside>` : "";
}

/* ---------- Cmd-K palette ---------- */
function searchIndex() {
  const idx = views.map(v => ({ kind: "模块", title: v.name, sub: GROUP_OF(v.id), href: `#${v.id}`, icon: v.id }));
  for (const a of M.accounts?.items || []) idx.push({ kind: "账号", title: a.service, sub: [a.category, a.risk, a.status].filter(known).join(" · "), href: "#accounts", icon: "accounts" });
  for (const s of subs()) idx.push({ kind: "订阅", title: s.service, sub: [s.plan, s.status, known(s.amount) ? `${s.amount} ${s.currency}` : ""].filter(Boolean).join(" · "), href: "#subscriptions", icon: "subscriptions" });
  for (const t of tasks()) idx.push({ kind: "任务", title: t.title, sub: `${t.owner} · ${t.status}`, href: `#${moduleOfTask(t)}`, icon: "tasks" });
  for (const f of M.finance?.items || []) idx.push({ kind: "理财", title: f.institution || f.item, sub: [f.kind, f.type].filter(Boolean).join(" · "), href: "#finance", icon: "finance" });
  for (const c of M.content?.items || []) idx.push({ kind: "内容", title: `${c.platform} ${c.handle ?? ""}`, sub: c.stage, href: "#content", icon: "content" });
  for (const r of records) idx.push({ kind: "笔记", title: r.title, sub: `${r.root}://${r.origin?.source_path}`, href: noteHref(r), icon: "notes" });
  return idx;
}
let IDX, kSel = 0, kRes = [];
const kEl = document.createElement("div"); kEl.className = "cmdk"; kEl.hidden = true;
kEl.innerHTML = `<div class="kbox" role="dialog" aria-label="搜索"><div class="kin">${ICONS.search}<input placeholder="搜索模块、账号、订阅、任务、笔记…" autocomplete="off"><kbd>esc</kbd></div><div class="klist"></div><div class="kfoot"><span><kbd>↑</kbd><kbd>↓</kbd> 选择</span><span><kbd>↵</kbd> 打开</span><span><kbd>⌘K</kbd> 切换</span></div></div>`;
document.body.appendChild(kEl);
const kIn = kEl.querySelector("input"), kList = kEl.querySelector(".klist");
function kRender() {
  const q = kIn.value.trim().toLowerCase(); IDX ||= searchIndex();
  const score = x => { const t = String(x.title ?? "").toLowerCase(), s = String(x.sub ?? "").toLowerCase(); if (!q) return x.kind === "模块" ? 1 : 0; return t.startsWith(q) ? 3 : t.includes(q) ? 2 : s.includes(q) ? 1 : 0; };
  kRes = IDX.map(x => [score(x), x]).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0]).slice(0, 40).map(([, x]) => x); kSel = Math.min(kSel, Math.max(0, kRes.length - 1));
  const groups = [...new Set(kRes.map(x => x.kind))];
  let i = 0; kList.innerHTML = kRes.length ? groups.map(g => `<div class="kg">${g}</div>` + kRes.filter(x => x.kind === g).map(x => { const j = kRes.indexOf(x);
    return `<a class="ki L-${COLOR[x.icon] || "infra"} ${j === kSel ? "sel" : ""}" data-i="${j}" href="${x.href}"><span class="ic">${ICONS[x.icon] || ""}</span><span class="t">${esc(x.title)}</span><span class="s">${esc(x.sub ?? "")}</span></a>`; }).join("")).join("") : `<p class="empty" style="padding:16px">无结果</p>`;
  kList.querySelector(".sel")?.scrollIntoView({ block: "nearest" });
}
function openK(q = "") { kEl.hidden = false; kIn.value = q; kSel = 0; kRender(); setTimeout(() => kIn.focus(), 0); }
const closeK = () => { kEl.hidden = true; };
kIn.addEventListener("input", () => { kSel = 0; kRender(); });
kEl.addEventListener("click", e => { if (e.target === kEl) closeK(); if (e.target.closest(".ki")) closeK(); });
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
function render() {
  const [id, q = ""] = location.hash.slice(1).split("?"), v = V[id] || V.overview, el = document.getElementById("view");
  document.querySelectorAll("#side a.ni").forEach(a => a.classList.toggle("on", a.dataset.id === v.id));
  document.body.classList.remove("nav-open");
  if (!bundle) { el.innerHTML = hero(v, v.name, "") + `<div class="body"><div class="banner">未找到 data/bundle.json，请先运行 <code>npm start</code>。</div></div>`; return; }
  let html = PAGES[v.id](v, q); const i = html.indexOf('<div class="body">');
  const r = rail(v);
  if (i >= 0 && r) html = html.slice(0, i) + `<div class="pg"><div class="body pg-main">` + html.slice(i + 18) + r + `</div>`;
  el.innerHTML = html;
}
sidebar();
addEventListener("hashchange", () => { render(); scrollTo(0, 0); });
render();
