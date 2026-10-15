// 个人资产 · 账号: identity-centred view — identity cards, dependency graph (SVG), SPOFs, grouped table with filters + drawer, checklists.
import { M, V } from "../data.js";
import { buildModel, checklist, rank, fa, edgeStats } from "../identity.js";
import { esc, known, pending, countUnknown, card, more, kpis, badge, riskC, fmt } from "../ui.js";
const FA = { na: ["不适用", "infra"], on: ["已开启", "ai"], off: ["未开启", "err"], unknown: ["待确认", "modes"] };
const LVL = { high: ["err", "高"], medium: ["modes", "中"] };
const ET = { login: "注册/登录", oauth: "OAuth", recovery: "恢复/绑定", notify: "通知" };
let model;
const S = { q: "", risk: new Set(), cat: "", fa: "", status: "", open: null };

function graph(m) {
  const show = m.accs.filter(a => !/closed/i.test(a.status ?? "") && !m.ids.some(i => i.anchor === a) && (rank(a.risk) <= 2 || m.spof.some(s => s.key === a._k)));
  const order = [...m.ids.map(i => i.id), "_none"];
  show.sort((x, y) => order.indexOf(x._group) - order.indexOf(y._group) || rank(x.risk) - rank(y.risk));
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
    edges += `<path class="ge ${e.type}${hiIds.has(src) && rank(a.risk) <= 1 ? " hot" : ""}" d="M${IX + IW} ${y1} C ${IX + IW + 160} ${y1}, ${AX - 160} ${y2}, ${AX} ${y2}"/>`;
  }
  for (const i of m.ids) for (const r of i.recoveryIds) if (iy.has(r)) { const y1 = iy.get(i.id), y2 = iy.get(r), x = IX - 4, d = Math.min(60, 18 + Math.abs(y2 - y1) / 6);
    arcs += `<path class="ge recovery" marker-end="url(#ah)" d="M${x} ${y1} C ${x - d} ${y1}, ${x - d} ${y2}, ${x} ${y2}"/>`; }
  const inodes = m.ids.map(i => { const y = iy.get(i.id), f = i.na2fa ? FA.na : FA[fa(i.two_fa)], rest = i.accounts.length - show.filter(a => a._edges.some(e => e.id === i.id || e.acc === i.anchor?._k)).length;
    return `<g class="gi ${hiIds.has(i.id) ? "spof" : ""}" data-id="${esc(i.id)}"><rect x="${IX}" y="${y - 26}" width="${IW}" height="52" rx="10"/><text x="${IX + 12}" y="${y - 7}" class="t">${esc(i.label)}</text>
      <text x="${IX + 12}" y="${y + 11}" class="s">${i.accounts.length} 个账号 · 2FA ${f[0]}${rest > 0 ? ` · +${rest} P3/P4` : ""}</text>${hiIds.has(i.id) ? `<text x="${IX + IW - 10}" y="${y - 7}" class="w" text-anchor="end">SPOF</text>` : ""}</g>`; }).join("");
  const anodes = show.map(a => { const y = ay.get(a._k);
    return `<g class="ga ${spA.has(a._k) ? "spof" : ""}" data-acc="${a._k}"><rect x="${AX}" y="${y - 9}" width="200" height="18" rx="5"/><text x="${AX + 8}" y="${y + 4}" class="t">${esc(String(a.service).slice(0, 22))}</text><text x="${AX + 192}" y="${y + 4}" class="r L-${riskC(a.risk)}" text-anchor="end">${known(a.risk) ? esc(a.risk) : ""}</text></g>`; }).join("");
  return `<div class="idgraph"><svg viewBox="0 0 ${W} ${H}" width="100%" style="max-height:${H}px"><defs><marker id="ah" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" class="ahp"/></marker></defs>
    <text x="${IX}" y="16" class="hd">身份</text><text x="${AX}" y="16" class="hd">账号（P0–P2 与单点项；P3/P4 计入身份节点）</text>${edges}${arcs}${inodes}${anodes}</svg>
    <div class="legend"><span class="gl login"><i></i>注册/登录</span><span class="gl oauth"><i></i>OAuth / 经由账号</span><span class="gl recovery"><i></i>恢复/绑定</span><span class="gl hot"><i></i>单点依赖的 P0/P1</span>${m.explicit ? "" : `<span class="note">关系由 login_method 文本推断</span>`}</div></div>`;
}

function filtered(m) {
  const q = S.q.toLowerCase();
  return m.accs.filter(a => (!S.risk.size || S.risk.has(String(a.risk).toUpperCase())) && (!S.cat || a.category === S.cat) && (!S.fa || fa(a.two_fa) === S.fa) && (!S.status || a.status === S.status)
    && (!q || Object.values(a).some(v => typeof v === "string" && v.toLowerCase().includes(q))));
}
function tableHtml(m) {
  const rows = filtered(m), groups = [...m.ids.map(i => [i.id, i.label]), ["_none", "未归属 / 待补充"]];
  const tr = a => `<tr class="arow" data-acc="${a._k}"><td class="t">${esc(a.service)}${m.spof.some(s => s.key === a._k) ? ` <span class="sd L-err">单点</span>` : ""}</td><td>${known(a.risk) ? `<span class="chip L-${riskC(a.risk)}">${esc(a.risk)}</span>` : ""}</td><td>${esc(a.category ?? "")}</td>
    <td>${a._via.length ? `<span class="tag">经 ${esc(a._via.join(" / "))}</span>` : ""}${a._rec.length ? `<span class="tag">恢复 ${esc(a._rec.join(" / "))}</span>` : ""}</td><td>${badge(FA[fa(a.two_fa)][0])}</td><td>${badge(a.status)}</td></tr>`;
  const body = groups.map(([g, l]) => { const xs = rows.filter(a => a._group === g).sort((x, y) => rank(x.risk) - rank(y.risk)); if (!xs.length) return "";
    const head = xs.slice(0, 6), rest = xs.slice(6);
    return `<tbody><tr class="grp"><th colspan="6">${esc(l)} <b>${xs.length}</b></th></tr>${head.map(tr).join("")}</tbody>${rest.length ? `<tbody class="rest" data-g="${esc(g)}" ${S.expand?.has(g) ? "" : "hidden"}>${rest.map(tr).join("")}</tbody><tbody><tr class="moreg"><td colspan="6"><button class="btn sm" data-expand="${esc(g)}">${S.expand?.has(g) ? "收起" : `展开全部 ${xs.length}`}</button></td></tr></tbody>` : ""}`; }).join("");
  return `<p class="note">${rows.length} / ${m.accs.length} 个账号</p><div class="tbl"><table class="idt"><thead><tr><th>服务</th><th>风险</th><th>类别</th><th>依赖</th><th>2FA</th><th>状态</th></tr></thead>${body}</table></div>`;
}
function drawer(m) {
  const a = m.accs.find(x => x._k === S.open); if (!a) return "";
  const keys = Object.keys(a).filter(k => !k.startsWith("_") && !["privacy", "name"].includes(k));
  const shown = keys.filter(k => typeof a[k] === "object" ? a[k] != null : known(a[k])), miss = keys.filter(k => !shown.includes(k));
  const url = known(a.url) && /^https?:\/\//.test(a.url) ? a.url : null;
  return `<div class="dscrim" data-close></div><aside class="drawer" role="dialog"><header><h3>${esc(a.service)}</h3>${known(a.risk) ? `<span class="chip L-${riskC(a.risk)}">${esc(a.risk)}</span>` : ""}<span class="sp"></span><button class="btn sm" data-close>关闭</button></header>
    ${url ? `<a class="btn primary" href="${esc(url)}" target="_blank" rel="noopener noreferrer">打开登录 / 安全设置 ↗</a>` : `<p class="note">url 待补充（不推断链接）</p>`}
    ${a._edges.length ? `<h4 class="subh">依赖关系</h4><ul class="plain">${a._edges.map(e => `<li>${ET[e.type]} → ${esc(e.acc ? m.accs.find(x => x._k === e.acc)?.service : m.ids.find(i => i.id === e.id)?.label)}${e.inferred ? ` <span class="note">推断</span>` : ""}</li>`).join("")}</ul>` : ""}
    <h4 class="subh">字段</h4><dl class="kv">${shown.map(k => `<dt>${esc(k)}</dt><dd>${k === "url" && url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url)}</a>` : fmt(a[k]) || esc(a[k])}</dd>`).join("")}</dl>
    ${miss.length ? `<div class="pend"><b>${miss.length}</b> 项待补充<span>：${miss.map(esc).join("、")}</span></div>` : ""}</aside>`;
}

export function render() {
  const accounts = M.accounts?.items || [], m = model = buildModel(accounts, M.identities?.items || []);
  const live = accounts.filter(x => !/closed/i.test(x.status || ""));
  const hi = m.spof.filter(s => s.level === "high");
  const cards = m.ids.map(i => { const f = i.na2fa ? FA.na : FA[fa(i.two_fa)], sp = m.spof.find(s => s.kind === "identity" && s.id === i.id);
    return `<section class="idc ${sp ? `L-${LVL[sp.level][0]}` : "L-ai"}"><div class="ih"><span class="ik">${i.kind === "phone" ? "☏" : "@"}</span><b>${esc(i.label)}</b>${known(i.risk) ? `<span class="chip L-${riskC(i.risk)}">${esc(i.risk)}</span>` : ""}${sp ? `<span class="sd L-${LVL[sp.level][0]}">单点</span>` : ""}</div>
      <div class="ia mono">${known(i.address) ? esc(i.address) : `<span class="note">地址未录入</span>`}</div>${known(i.role) ? `<div class="ir">${esc(i.role)}</div>` : ""}
      <dl class="kv sm"><dt>2FA</dt><dd><span class="sd L-${f[1]}" title="${esc(i.two_fa ?? "")}">${f[0]}</span></dd><dt>恢复</dt><dd>${i.recovery.length ? i.recovery.map(r => `<span class="tag">${esc(r)}</span>`).join("") : (i.naRecovery ? `<span class="sd L-infra">待补充</span>` : `<span class="sd L-err">无记录</span>`)}</dd>
      <dt>关联</dt><dd><b>${i.accounts.length}</b> 个账号 · P0/P1 <b>${i.critical.length}</b></dd></dl></section>`; }).join("");
  const spofHtml = s => `<div class="al L-${LVL[s.level][0]}"><span class="lv">${LVL[s.level][1]}</span>${esc(s.title)}${s.items.length ? `<div class="m">${s.kind === "account" ? "链：" : ""}${s.items.map(esc).join(s.kind === "account" ? " → " : "、")}</div>` : ""}</div>`;
  const checks = m.ids.map(i => { const c = checklist(i, m.accs), ok = c.filter(x => x[1] === "ok").length;
    return `<div class="chk"><h4>${esc(i.label)} <span class="note">${ok}/${c.length}</span></h4>${c.map(([t, st, d]) => `<div class="ci ${st}"><span>${st === "ok" ? "✓" : st === "bad" ? "✗" : "?"}</span>${esc(t)}${d ? `<small>${esc(d)}</small>` : ""}</div>`).join("")}</div>`; }).join("");
  const cats = [...new Set(accounts.map(a => a.category).filter(known))], sts = [...new Set(accounts.map(a => a.status).filter(known))];
  const st = edgeStats(m), src = m.explicit ? `身份来自 identities.yaml · 关系 ${st.real} 条来自字段（email_id / login_via / recovery），${st.inferred} 条由 login_method 推断补全` : `身份由 login_method 推断（未找到 identities.yaml${m.hasFields.length ? "" : "；accounts 无 email_id / login_via / recovery / url 字段"}）`;
  return `${pending(countUnknown(accounts), "账号字段")}<div class="pend info">${esc(src)}</div>
    ${kpis([[m.ids.length, "身份节点"], [live.length, "在册账号"], [hi.length, "高危单点", { warn: hi.length > 0 }], [m.accs.filter(a => a._group === "_none").length, "未归属身份"]])}
    <div class="idcards">${cards}</div>
    <div class="grid">${card("单点故障", m.spof.length ? m.spof.slice(0, 5).map(spofHtml).join("") + (m.spof.length > 5 ? more(m.spof.length - 5, m.spof.slice(5).map(spofHtml).join(""), "展开其余") : "") : `<p class="empty">未发现</p>`, { span: "s12", right: `${m.spof.length}` })}</div>
    <div class="grid">${card("依赖图 · 身份 → 账号", graph(m), { span: "s12" })}</div>
    <div class="grid"><section class="card s12" id="acct"><h3>账号 · 按身份分组</h3>
      <div class="afilters"><input id="aq" placeholder="搜索服务、类别、备注…" value="${esc(S.q)}">
      ${["P0", "P1", "P2", "P3", "P4"].map(r => `<button class="fchip ${S.risk.has(r) ? "on" : ""}" data-risk="${r}">${r}</button>`).join("")}
      <select id="acat"><option value="">全部类别</option>${cats.map(c => `<option ${S.cat === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>
      <select id="afa"><option value="">2FA 全部</option>${Object.entries(FA).map(([k, [l]]) => `<option value="${k}" ${S.fa === k ? "selected" : ""}>${l}</option>`).join("")}</select>
      <select id="ast"><option value="">全部状态</option>${sts.map(c => `<option ${S.status === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></div>
      <div id="atbl">${tableHtml(m)}</div></section></div>
    ${more(m.ids.length, `<div class="chks">${checks}</div>`, "完整度与安全检查")}
    <div id="adrawer">${drawer(m)}</div>`;
}
export function mount(el) {
  el._acct?.abort(); const ac = el._acct = new AbortController(), o = { signal: ac.signal };
  const T = () => el.querySelector("#atbl").innerHTML = tableHtml(model), D = () => el.querySelector("#adrawer").innerHTML = drawer(model);
  el.querySelector("#aq")?.addEventListener("input", e => { S.q = e.target.value; T(); }, o);
  for (const [id, k] of [["#acat", "cat"], ["#afa", "fa"], ["#ast", "status"]]) el.querySelector(id)?.addEventListener("change", e => { S[k] = e.target.value; T(); }, o);
  el.addEventListener("click", e => {
    if (!el.querySelector("#atbl")) return;
    const r = e.target.closest("[data-risk]"); if (r) { const v = r.dataset.risk; S.risk.has(v) ? S.risk.delete(v) : S.risk.add(v); r.classList.toggle("on"); T(); return; }
    const x = e.target.closest("[data-expand]"); if (x) { S.expand ||= new Set(); const g = x.dataset.expand; S.expand.has(g) ? S.expand.delete(g) : S.expand.add(g); T(); return; }
    if (e.target.closest("[data-close]")) { S.open = null; D(); return; }
    const a = e.target.closest("[data-acc]"); if (a) { S.open = a.dataset.acc; D(); }
  }, o);
  addEventListener("keydown", e => { if (e.key === "Escape" && S.open) { S.open = null; D(); } }, o);
}
