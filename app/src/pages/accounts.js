// 个人资产 · 账号: identity-centred view — identity cards, dependency graph (SVG), SPOFs, grouped table with filters + drawer, checklists.
import { M, V, accHref, catOf, catPages } from "../data.js";
import { buildModel, checklist, rank, prank, prio, fa, edgeStats, security, missingOf, noPM, unbound, mask, KEY_FIELDS } from "../identity.js";
import { esc, known, pending, countUnknown, card, more, kpis, badge, riskC, fmt } from "../ui.js";
const FA = { na: ["不适用", "infra"], on: ["已开启", "ai"], off: ["未开启", "err"], unknown: ["待确认", "modes"] };
const LVL = { high: ["err", "高"], medium: ["modes", "中"] };
const ET = { login: "注册/登录", oauth: "OAuth", recovery: "恢复/绑定", notify: "通知" };
let model;
const S = { q: "", prio: new Set(), email: "", miss: false, open: null, all: false };

function graph(m) {
  const show = m.accs.filter(a => !/closed/i.test(a.status ?? "") && !m.ids.some(i => i.anchor === a) && (prank(a) <= 2 || m.spof.some(s => s.key === a._k)));
  const order = [...m.ids.map(i => i.id), "_none"];
  show.sort((x, y) => order.indexOf(x._group) - order.indexOf(y._group) || prank(x) - prank(y));
  const RH = 21, top = 30, W = 980, AX = 600, IX = 70, IW = 215, H = top + show.length * RH + 20;
  const ay = new Map(show.map((a, n) => [a._k, top + n * RH + RH / 2]));
  const iy = new Map(); m.ids.forEach(i => { const ys = show.filter(a => a._group === i.id).map(a => ay.get(a._k)); iy.set(i.id, ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : top + 20); });
  // spread identity nodes so they don't overlap
  const ids = [...m.ids].sort((a, b) => iy.get(a.id) - iy.get(b.id)); let last = -1e9; for (const i of ids) { const y = Math.max(iy.get(i.id), last + 70); iy.set(i.id, y); last = y; }
  const hiIds = new Set(m.spof.filter(s => s.kind === "identity" && s.level === "high").map(s => s.id)), spA = new Set(m.spof.filter(s => s.kind === "account").map(s => s.key));
  const anchorId = k => m.ids.find(i => i.anchor?._k === k)?.id;
  let edges = "", arcs = "";
  for (const a of show) for (const e of a._edges) {
    const y2 = ay.get(a._k), src = e.id ?? anchorId(e.acc);
    if (e.acc && ay.has(e.acc)) { const y1 = ay.get(e.acc); arcs += `<path class="ge oauth" d="M${AX + 200} ${y1} C ${AX + 260} ${y1}, ${AX + 260} ${y2}, ${AX + 200} ${y2}"/>`; continue; }
    if (!src || !iy.has(src)) continue; const y1 = iy.get(src);
    edges += `<path class="ge ${e.type}${hiIds.has(src) && prank(a) <= 1 ? " hot" : ""}" d="M${IX + IW} ${y1} C ${IX + IW + 160} ${y1}, ${AX - 160} ${y2}, ${AX} ${y2}"/>`;
  }
  for (const i of m.ids) for (const r of i.recoveryIds) if (iy.has(r)) { const y1 = iy.get(i.id), y2 = iy.get(r), x = IX - 4, d = Math.min(60, 18 + Math.abs(y2 - y1) / 6);
    arcs += `<path class="ge recovery" marker-end="url(#ah)" d="M${x} ${y1} C ${x - d} ${y1}, ${x - d} ${y2}, ${x} ${y2}"/>`; }
  const inodes = m.ids.map(i => { const y = iy.get(i.id), f = i.na2fa ? FA.na : FA[fa(i.two_fa)], rest = i.accounts.length - show.filter(a => a._edges.some(e => e.id === i.id || e.acc === i.anchor?._k)).length;
    return `<g class="gi ${hiIds.has(i.id) ? "spof" : ""}" data-id="${esc(i.id)}"><rect x="${IX}" y="${y - 26}" width="${IW}" height="52" rx="10"/><text x="${IX + 12}" y="${y - 7}" class="t">${esc(i.label)}</text>
      <text x="${IX + 12}" y="${y + 11}" class="s">${i.accounts.length} 个账号 · 2FA ${f[0]}${rest > 0 ? ` · +${rest} P3/P4` : ""}</text>${hiIds.has(i.id) ? `<text x="${IX + IW - 10}" y="${y - 7}" class="w" text-anchor="end">SPOF</text>` : ""}</g>`; }).join("");
  const anodes = show.map(a => { const y = ay.get(a._k);
    return `<g class="ga ${spA.has(a._k) ? "spof" : ""}" data-acc="${a._k}"><rect x="${AX}" y="${y - 9}" width="200" height="18" rx="5"/><text x="${AX + 8}" y="${y + 4}" class="t">${esc(String(a.service).slice(0, 22))}</text><text x="${AX + 192}" y="${y + 4}" class="r L-${riskC(prio(a))}" text-anchor="end">${known(prio(a)) ? esc(prio(a)) : ""}</text></g>`; }).join("");
  return `<div class="idgraph"><svg viewBox="0 0 ${W} ${H}" width="100%" style="max-height:${H}px"><defs><marker id="ah" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" class="ahp"/></marker></defs>
    <text x="${IX}" y="16" class="hd">身份</text><text x="${AX}" y="16" class="hd">账号（P0–P2 与单点项；P3/P4 计入身份节点）</text>${edges}${arcs}${inodes}${anodes}</svg>
    <div class="legend"><span class="gl login"><i></i>注册/登录</span><span class="gl oauth"><i></i>OAuth / 经由账号</span><span class="gl recovery"><i></i>恢复/绑定</span><span class="gl hot"><i></i>单点依赖的 P0/P1</span>${m.explicit ? "" : `<span class="note">关系由 login_method 文本推断</span>`}</div></div>`;
}

const PR = a => { const p = prio(a); return known(p) ? `<span class="chip L-${riskC(String(p).slice(0, 2))}">${esc(p)}</span>` : ""; };
const VIA_L = { "google-oauth": "Google OAuth", "google-account": "Google 账号", "microsoft-account": "Microsoft 账号", "qq-account": "QQ 账号", wechat: "微信", "phone-sms": "手机短信", email: "邮箱 + 密码/验证码" };
const via = a => { const v = String(a.login_via ?? "").replace(/[（(].*$/, "").trim(); return known(a.login_via) ? (VIA_L[v] ?? v) + (/待确认/.test(a.login_via) ? "（待确认）" : "") : ""; };
const idl = (m, v) => [].concat(v ?? []).map(x => m.ids.find(i => i.id === String(x).replace(/[（(].*$/, "").trim())?.label).filter(Boolean);
function filtered(m) {
  const q = S.q.toLowerCase();
  return m.accs.filter(a => (!S.cat || catOf(a).slug === S.cat) && (!S.prio.size || S.prio.has(String(prio(a)).replace("+", "")))
    && (!S.email || (S.email === "_none" ? unbound(a) : [].concat(a.email_id ?? []).some(x => String(x).startsWith(S.email))))
    && (!S.miss || missingOf(a).length > 0)
    && (!q || Object.values(a).some(v => typeof v === "string" && v.toLowerCase().includes(q)))).sort((x, y) => prank(x) - prank(y) || rank(x.risk) - rank(y.risk));
}
const acard = (m, a) => { const miss = missingOf(a), url = known(a.url) && /^https?:\/\//.test(a.url) ? a.url : null, f = FA[fa(a.two_fa)];
  const row = (k, label, val) => `<dt>${label}</dt><dd>${miss.includes(k) ? `<span class="miss">待补充</span>` : val}</dd>`;
  return `<article class="acard ${/closed/i.test(a.status ?? "") ? "closed" : ""} ${miss.length ? "has-miss" : ""}">
    <header><a class="an" href="${accHref(a)}"><b>${esc(a.service)}</b></a>${PR(a)}${m.spof.some(s => s.key === a._k) ? `<span class="sd L-err">单点</span>` : ""}<span class="sp"></span>${miss.length ? `<span class="mc" title="${esc(miss.join("、"))}">${miss.length} 缺</span>` : `<span class="mc ok">完整</span>`}</header>
    <dl class="kv sm">${row("email_id", "身份", idl(m, a.email_id).map(x => `<span class="tag">${esc(x)}</span>`).join("") || esc(mask(a.email_id)))}
    ${row("login_via", "登录", esc(via(a)))}${row("recovery", "恢复", idl(m, a.recovery).map(x => `<span class="tag">${esc(x)}</span>`).join("") || esc(a.recovery))}
    ${row("two_fa", "2FA", `<span class="sd L-${f[1]}" title="${esc(a.two_fa ?? "")}">${f[1] === "ai" ? esc(String(a.two_fa).slice(0, 18)) : f[0]}</span>`)}
    ${row("password_location", "密码", noPM(a) ? `<span class="sd L-err">无密码管理器</span>` : esc(a.password_location))}</dl>
    <footer>${url ? `<a class="seclink" href="${esc(url)}" target="_blank" rel="noopener noreferrer">安全设置 ↗</a>` : `<span class="miss">url 待补充</span>`}<span class="m">${esc(a.category ?? "")}</span></footer></article>`; };
function tableHtml(m) {
  const rows = filtered(m), lim = S.all ? rows.length : 18;
  return `<p class="note">${rows.length} / ${m.accs.length} 个账号 · 按优先级排序</p><div class="acards">${rows.slice(0, lim).map(a => acard(m, a)).join("")}</div>
    ${rows.length > lim || S.all ? `<button class="btn sm moreb" data-all>${S.all ? "收起" : `展开全部 ${rows.length}`}</button>` : ""}`;
}
function drawer(m) {
  const a = m.accs.find(x => x._k === S.open); if (!a) return "";
  const keys = Object.keys(a).filter(k => !k.startsWith("_") && !["privacy", "name"].includes(k));
  const shown = keys.filter(k => typeof a[k] === "object" ? a[k] != null : known(a[k])), miss = keys.filter(k => !shown.includes(k));
  const url = known(a.url) && /^https?:\/\//.test(a.url) ? a.url : null;
  return `<div class="dscrim" data-close></div><aside class="drawer" role="dialog"><header><h3>${esc(a.service)}</h3>${known(a.risk) ? `<span class="chip L-${riskC(a.risk)}">${esc(a.risk)}</span>` : ""}<span class="sp"></span><button class="btn sm" data-close>关闭</button></header>
    ${url ? `<a class="btn primary" href="${esc(url)}" target="_blank" rel="noopener noreferrer">打开登录 / 安全设置 ↗</a>` : `<p class="note">url 待补充（不推断链接）</p>`}
    ${a._edges.length ? `<h4 class="subh">依赖关系</h4><ul class="plain">${a._edges.map(e => `<li>${ET[e.type]} → ${esc(e.acc ? m.accs.find(x => x._k === e.acc)?.service : m.ids.find(i => i.id === e.id)?.label)}${e.inferred ? ` <span class="note">推断</span>` : ""}</li>`).join("")}</ul>` : ""}
    <h4 class="subh">字段</h4><dl class="kv">${shown.map(k => `<dt>${esc(k)}</dt><dd>${k === "url" && url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url)}</a>` : esc(mask(typeof a[k] === "object" ? JSON.stringify(a[k]) : a[k]))}</dd>`).join("")}</dl>
    ${miss.length ? `<div class="pend"><b>${miss.length}</b> 项待补充<span>：${miss.map(esc).join("、")}</span></div>` : ""}</aside>`;
}

export function render(rest = [], P = new URLSearchParams()) {
  if (P.get("id")) S.openId = P.get("id");
  S.cat = rest[0] === "cat" ? rest[1] || "" : "";
  if (S.cat) return renderCat(S.cat);
  const accounts = M.accounts?.items || [], m = model = buildModel(accounts, M.identities?.items || []), sec = security(m);
  const live = m.accs.filter(x => !/closed/i.test(x.status || "")), imp = live.filter(a => prank(a) <= 1);
  const st = edgeStats(m), src = m.explicit ? `身份来自 identities.yaml · 关系 ${st.real} 条来自字段，${st.inferred} 条由 login_method 推断补全` : "身份由 login_method 推断（未找到 identities.yaml）";
  // 1. identity view — expandable nodes
  const idv = m.ids.map(i => { const f = i.na2fa ? FA.na : FA[fa(i.two_fa)], sp = m.spof.find(s => s.kind === "identity" && s.id === i.id);
    const bound = live.filter(a => [].concat(a.email_id ?? []).some(x => String(x).startsWith(i.id))).sort((x, y) => prank(x) - prank(y));
    return `<details class="idc ${sp ? `L-${LVL[sp.level][0]}` : "L-ai"}" ${S.openId === i.id ? "open" : ""} data-idn="${esc(i.id)}"><summary><div class="ih"><span class="ik">${i.kind === "phone" ? "☏" : "@"}</span><b>${esc(i.label)}</b>${sp ? `<span class="sd L-${LVL[sp.level][0]}">单点</span>` : ""}<span class="sp"></span><span class="bc"><b>${bound.length}</b> 绑定</span></div>
      <div class="ia mono">${known(i.address) ? esc(mask(String(i.address).replace(/[（(].*$/, ""))) : `<span class="note">地址未录入</span>`}</div>${known(i.role) ? `<div class="ir">${esc(i.role)}</div>` : ""}
      <dl class="kv sm"><dt>2FA</dt><dd><span class="sd L-${f[1]}" title="${esc(i.two_fa ?? "")}">${f[0]}</span></dd><dt>恢复</dt><dd>${i.recovery.length ? i.recovery.map(r => `<span class="tag">${esc(r)}</span>`).join("") : `<span class="sd L-err">无记录</span>`}</dd>
      <dt>P0/P1</dt><dd><b>${bound.filter(a => prank(a) <= 1).length}</b> 个</dd></dl><span class="exp">展开绑定账号 ▾</span></summary>
      <div class="bl">${bound.map(a => `<a class="brow" href="${accHref(a)}">${PR(a)}<span>${esc(a.service)}</span><span class="sd L-${FA[fa(a.two_fa)][1]}">${FA[fa(a.two_fa)][0]}</span></a>`).join("") || `<p class="empty">无</p>`}</div></details>`; }).join("");
  // 2. security overview
  const sl = (title, xs, why, warn) => card(`${title}`, xs.length ? `<div class="slist">${xs.slice(0, 8).map(a => `<a class="srow" href="${accHref(a)}">${PR(a)}<span class="t">${esc(a.service)}</span><span class="m">${esc(why(a))}</span></a>`).join("")}</div>${xs.length > 8 ? more(xs.length - 8, `<div class="slist">${xs.slice(8).map(a => `<a class="srow" href="${accHref(a)}">${PR(a)}<span class="t">${esc(a.service)}</span><span class="m">${esc(why(a))}</span></a>`).join("")}</div>`, "展开全部") : ""}` : `<p class="empty">无</p>`, { span: "s6", right: `<b class="${warn && xs.length ? "warnn" : ""}">${xs.length}</b>` });
  const sec4 = `<div class="grid" id="secov">${sl("P0/P1 · 2FA 未确认 / 不确定 / 否", sec.weak2fa, a => String(a.two_fa ?? ""), 1)}${sl("缺恢复方式", sec.noRecovery, a => `recovery: ${a.recovery ?? "—"}`, 1)}
    ${sl("未绑定身份（email_id 待补充）", sec.unbound, a => a.category ?? "", 0)}${sl("未使用密码管理器", sec.noPM, a => a.password_location, 1)}</div>${sec.pmUnknown ? `<p class="note">另有 ${sec.pmUnknown} 个账号 password_location 待补充。</p>` : ""}`;
  const spofHtml = s => `<div class="al L-${LVL[s.level][0]}"><span class="lv">${LVL[s.level][1]}</span>${esc(s.title)}${s.items.length ? `<div class="m">${s.kind === "account" ? "链：" : ""}${s.items.map(esc).join(s.kind === "account" ? " → " : "、")}</div>` : ""}</div>`;
  const checks = m.ids.map(i => { const c = checklist(i, m.accs), ok = c.filter(x => x[1] === "ok").length;
    return `<div class="chk"><h4>${esc(i.label)} <span class="note">${ok}/${c.length}</span></h4>${c.map(([t, st, d]) => `<div class="ci ${st}"><span>${st === "ok" ? "✓" : st === "bad" ? "✗" : "?"}</span>${esc(t)}${d ? `<small>${esc(d)}</small>` : ""}</div>`).join("")}</div>`; }).join("");
  const missTotal = live.reduce((n, a) => n + missingOf(a).length, 0);
  return `<p class="note">${esc(src)} · 缺失字段汇总见 <a href="#settings">设置 → 数据补全</a></p>
    ${kpis([[imp.length, "P0/P1 重要账号"], [sec.weak2fa.length, "重要账号 2FA 未确认", { warn: sec.weak2fa.length > 0 }], [sec.noRecovery.length, "缺恢复方式", { warn: sec.noRecovery.length > 0 }], [sec.unbound.length, "未绑定身份"], [sec.noPM.length, "未用密码管理器", { warn: sec.noPM.length > 0 }]])}
    ${catNav("")}<h3 class="subh">身份</h3><div class="idcards" id="idview">${idv}</div>
    <h3 class="subh">安全概览</h3>${sec4}
    ${m.spof.length ? more(m.spof.length, m.spof.map(spofHtml).join(""), "单点故障") : ""}
    ${more("", graph(m), "依赖图 · 身份 → 账号")}
    <div class="grid"><section class="card s12" id="acct"><h3>账号</h3>
      <div class="afilters"><input id="aq" placeholder="搜索服务、类别、备注…" value="${esc(S.q)}">
      ${["P0", "P1", "P2"].map(r => `<button class="fchip ${S.prio.has(r) ? "on" : ""}" data-prio="${r}">${r === "P2" ? "P2+" : r}</button>`).join("")}
      <select id="aem"><option value="">全部邮箱 / 身份</option>${m.ids.map(i => `<option value="${esc(i.id)}" ${S.email === i.id ? "selected" : ""}>${esc(i.label)}</option>`).join("")}<option value="_none" ${S.email === "_none" ? "selected" : ""}>未绑定</option></select>
      <label class="fchk"><input type="checkbox" id="amiss" ${S.miss ? "checked" : ""}> 有缺失字段</label></div>
      <div id="atbl">${tableHtml(m)}</div></section></div>
    ${more(m.ids.length, `<div class="chks">${checks}</div>`, "完整度与安全检查")}
    <div id="adrawer">${drawer(m)}</div>`;
}
export function mount(el) {
  el._acct?.abort(); const ac = el._acct = new AbortController(), o = { signal: ac.signal };
  const T = () => el.querySelector("#atbl").innerHTML = tableHtml(model), D = () => el.querySelector("#adrawer").innerHTML = drawer(model);
  el.querySelector("#aq")?.addEventListener("input", e => { S.q = e.target.value; T(); }, o);
  el.querySelector("#aem")?.addEventListener("change", e => { S.email = e.target.value; T(); }, o);
  el.querySelector("#amiss")?.addEventListener("change", e => { S.miss = e.target.checked; T(); }, o);
  el.addEventListener("click", e => {
    if (!el.querySelector("#atbl")) return;
    const r = e.target.closest("[data-prio]"); if (r) { const v = r.dataset.prio; S.prio.has(v) ? S.prio.delete(v) : S.prio.add(v); r.classList.toggle("on"); T(); return; }
    const c = e.target.closest(".acard"); if (c && !e.target.closest("a")) { location.hash = c.querySelector("a.an").getAttribute("href"); return; }
    if (e.target.closest("[data-all]")) { S.all = !S.all; T(); return; }
    if (e.target.closest("[data-close]")) { S.open = null; D(); return; }
    const a = e.target.closest("[data-acc]"); if (a) { e.preventDefault(); S.open = a.dataset.acc; D(); }
  }, o);
  const tgt = S.openId && el.querySelector(`[data-idn="${CSS.escape(S.openId)}"]`); if (tgt && location.hash.includes("id=")) { tgt.open = true; setTimeout(() => tgt.scrollIntoView({ block: "center" }), 50); }
  el.addEventListener("toggle", e => { if (e.target.dataset?.idn && e.target.open) S.openId = e.target.dataset.idn; }, { ...o, capture: true });
  addEventListener("keydown", e => { if (e.key === "Escape" && S.open) { S.open = null; D(); } }, o);
}

function catNav(cur) {
  const all = model.accs; return `<nav class="catnav"><a class="${cur ? "" : "on"}" href="#accounts/identities">全部 <b>${all.length}</b></a>${catPages().map(p => `<a class="${cur === p.slug ? "on" : ""}" href="#accounts/cat/${p.slug}">${esc(p.label)} <b>${all.filter(a => catOf(a).slug === p.slug).length}</b></a>`).join("")}</nav>`;
}
function renderCat(slug) {
  const m = model = buildModel(M.accounts?.items || [], M.identities?.items || []), pg = catPages().find(p => p.slug === slug);
  if (!pg) return `<p class="empty">未知分类：${esc(slug)}</p>`;
  const xs = m.accs.filter(a => catOf(a).slug === slug), live = xs.filter(a => !/closed/i.test(a.status ?? ""));
  const w2 = live.filter(a => fa(a.two_fa) !== "on"), w2i = w2.filter(a => prank(a) <= 1), nr = live.filter(a => missingOf(a).includes("recovery"));
  const srcCats = [...new Set(xs.map(a => a.category))].filter(Boolean);
  const top = (t, ys) => ys.length ? `<div class="slist">${ys.slice(0, 6).map(a => `<a class="srow" href="${accHref(a)}">${PR(a)}<span class="t">${esc(a.service)}</span><span class="m">${esc(t(a))}</span></a>`).join("")}</div>${ys.length > 6 ? more(ys.length - 6, `<div class="slist">${ys.slice(6).map(a => `<a class="srow" href="${accHref(a)}">${PR(a)}<span class="t">${esc(a.service)}</span><span class="m">${esc(t(a))}</span></a>`).join("")}</div>`, "展开全部") : ""}` : `<p class="empty">无</p>`;
  return `${catNav(slug)}<p class="note">来源 category：${srcCats.map(c => `<span class="tag">${esc(c)}</span>`).join("") || "—"}</p>
    ${kpis([[xs.length, "账号"], [w2.length, "2FA 未确认", { warn: w2.length > 0 }], [w2i.length, "其中 P0/P1", { warn: w2i.length > 0 }], [nr.length, "缺恢复方式", { warn: nr.length > 0 }]])}
    <div class="grid">${card("2FA 未确认 · 按优先级", top(a => String(a.two_fa ?? ""), w2.sort((x, y) => prank(x) - prank(y))), { span: "s6", right: w2.length })}${card("缺恢复方式", top(a => `recovery: ${a.recovery ?? "—"}`, nr.sort((x, y) => prank(x) - prank(y))), { span: "s6", right: nr.length })}</div>
    <div class="grid"><section class="card s12" id="acct"><h3>${esc(pg.label)} · 账号</h3>
      <div class="afilters"><input id="aq" placeholder="搜索…" value="${esc(S.q)}">${["P0", "P1", "P2"].map(r => `<button class="fchip ${S.prio.has(r) ? "on" : ""}" data-prio="${r}">${r === "P2" ? "P2+" : r}</button>`).join("")}
      <select id="aem"><option value="">全部邮箱 / 身份</option>${m.ids.map(i => `<option value="${esc(i.id)}" ${S.email === i.id ? "selected" : ""}>${esc(i.label)}</option>`).join("")}<option value="_none">未绑定</option></select>
      <label class="fchk"><input type="checkbox" id="amiss" ${S.miss ? "checked" : ""}> 有缺失字段</label></div><div id="atbl">${tableHtml(m)}</div></section></div><div id="adrawer"></div>`;
}
