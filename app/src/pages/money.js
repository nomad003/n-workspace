// 账号 (v9): 身份 → 分类 (group → subcategory → account) → 订阅 (by account_id), plus 安全 and 关系图.
//   #accounts/identities[?id=…]          layer 1: identities (identity-centred view)
//   #accounts/groups[/<group>[/<sub>]]    layers 2–3: data/account-groups.yaml → accounts
//   #accounts/subscriptions              subscriptions grouped by account (account_id) with paid_via
//   #accounts/security                   2FA (shared weak2fa → 29) / recovery / SPOF
//   #accounts/graph                      relation graph (pages/graph.js)
//   #account/<id>                        account detail (pages/account.js); old #accounts/cat/<slug> and #accounts/overview still work
import { M, V, subs, liveSub, monthlyCNY, known, accHref, accById, catOf, catPages, groups, subsOf, v9, section } from "../data.js";
import { pageTabs } from "../page-tabs.js";
import { weak2fa, twoFaState, priorityOf, daysUntil } from "../core.js";
import { buildModel, security, mask, prank } from "../identity.js";
import { esc, header, tabs, more, box, treeDetail } from "../ui.js";
import { render as renderGraph, mount as mountGraph } from "./graph.js";
import { render as renderAccounts, mount as mountAccounts } from "./accounts.js";
const FA = { on: "已开启", off: "未开启", unknown: "待确认", na: "不适用" };
const md = d => String(d).slice(5).replace("-", "/");
const ST = { active: "在用", verify: "待核实", paused: "暂停", prepaid: "预充值", canceled: "已取消", "one-time": "一次性", "refund-requested": "退款中" };
export default function (sub = "identities", P = new URLSearchParams(), rest = []) {
  if (sub === "overview") sub = "security";
  if (sub === "cat") { sub = "groups"; rest = [rest[0]]; }
  const accs = M.accounts?.items || [], s = subs(), w2 = weak2fa(accs), live = accs.filter(a => !/closed/i.test(a.status ?? ""));
  const G = groups().length ? groups() : catPages().map(p => ({ id: p.slug, label: p.label, subcategories: [] }));
  const counts = { identities: (M.identities?.items || []).length, groups: G.length, subscriptions: s.length, security: w2.length || "" };
  const T = tabs("accounts", pageTabs(section("accounts"), "accounts").map(([id, label]) => [id, label, counts[id] ?? ""]), sub);
  const IDS = M.identities?.items || [], liveSubs = s.filter(x => x.state === "active");
  const head = (lede, extra = []) => header("账号", "", [`${accs.length} 个账号`, `${IDS.length} 个身份`, `${G.length} 个分类`, `${s.length} 个订阅`, ...extra], lede, {
    actions: [["关系图", "#accounts/graph"], ["安全检查", "#accounts/security", true]],
    kpis: [[IDS.length, "身份", { href: "#accounts/identities", sub: "第 1 层 · 邮箱 / 手机" }], [G.length, "分类", { href: "#accounts/groups", sub: `第 2–3 层 · ${G.reduce((n, g) => n + (g.subcategories?.length || 0), 0)} 个子分类` }],
      [live.length, "账号", { tone: "focus", href: "#accounts/groups", sub: `${accs.length - live.length} 个已关闭` }], [w2.length, "2FA 待确认", { tone: w2.length ? "warn" : "", href: "#accounts/security", sub: "P0 / P1" }],
      [Math.round(monthlyCNY()), "订阅 / 月", { unit: "CNY", href: "#accounts/subscriptions", sub: `${liveSubs.length} 个在用 · ${s.length} 个总计` }]] });
  const LAYERS = n => `<div class="layers">${["身份", "分类", "子分类", "账号"].map((l, i) => `<span class="layer ${i + 1 <= n ? "on" : ""}"><b>${i + 1}</b>${l}</span>`).join(`<span class="sep">→</span>`)}</div>`;
  const idLabel = i => `${String(i.provider ?? i.id).replace(/[（(].*$/, "")}`;
  const idOf = a => (a.identity_ids || []);
  // groups → subcategories → accounts box list, for any account subset
  const byLayer = xs => G.map(g => { const gx = xs.filter(a => catOf(a).slug === g.id); if (!gx.length) return "";
    const subsL = g.subcategories?.length ? g.subcategories : [{ id: "", label: g.label }];
    return box({ title: `<a href="#accounts/groups/${g.id}">${esc(g.label)}</a>`, meta: `${gx.length} 个账号${weak2fa(gx).length ? ` · <span class="w">${weak2fa(gx).length} 待确认</span>` : ""}`, flush: true,
      body: subsL.map(c => { const ys = gx.filter(a => !c.id || a.subcategory === c.id).sort((a, b) => prank(a) - prank(b)); return ys.length ? `<div class="hz"><div class="h"><a href="#accounts/groups/${g.id}/${c.id}">${esc(c.label)}</a><small>${ys.length}</small></div><div class="rows">${ys.map(arow).join("")}</div></div>` : ""; }).join("") }); }).join("");
  const fa = a => twoFaState(a.two_fa);
  const arow = a => { const ss = subsOf(a.id); return `<a class="row r4" href="${accHref(a)}"><span class="t">${esc(a.service)}<span class="s">${esc((a.identity_ids || []).map(i => (M.identities?.items || []).find(x => x.id === i)?.provider?.replace(/[（(].*$/, "") ?? i).join(" · ") || "未绑定身份")}</span></span>
    <span class="tag">${esc(priorityOf(a) ?? "")}</span><span class="tag ${fa(a) === "on" ? "ok" : /P[01]/.test(priorityOf(a) ?? "") && fa(a) !== "na" ? "warn" : ""}">2FA ${FA[fa(a)]}</span><span class="tag">${ss.length ? `${ss.length} 订阅` : ""}</span></a>`; };
  if (!new Set(["identities", "groups", "subscriptions", "security", "graph"]).has(sub)) return { html: head("这个分页还没有对应的页面。") + T + `<div class="body"><p class="empty">「${esc(sub)}」还没有对应的页面。</p></div>` };
  if (sub === "graph") return { html: head("身份是枢纽，连线是登录 / OAuth / 恢复关系；点身份看它失守会波及哪些账号。") + T + `<div class="body">${renderGraph(P)}</div>`, mount: mountGraph };
  if (sub === "identities") {
    const sel = P.get("id") || IDS[0]?.id, cur = IDS.find(i => i.id === sel), xs = sel === "_none" ? live.filter(a => !idOf(a).length) : live.filter(a => idOf(a).includes(sel));
    const nav = `<div class="th">身份</div>${IDS.map(i => { const ys = live.filter(a => idOf(a).includes(i.id)), w = weak2fa(ys).length;
      return `<a class="tl l1 ${i.id === sel ? "on" : ""}" href="#accounts/identities?id=${encodeURIComponent(i.id)}"><span class="chev">${i.type === "phone" ? "☏" : "@"}</span>${esc(idLabel(i))}<span class="k ${w ? "w" : ""}">${ys.length}</span></a>`; }).join("")}
      <a class="tl l1 ${sel === "_none" ? "on" : ""}" href="#accounts/identities?id=_none"><span class="chev">∅</span>未绑定身份<span class="k">${live.filter(a => !idOf(a).length).length}</span></a>`;
    const card = cur ? `<section class="box"><div class="idcard"><div class="ico">${cur.type === "phone" ? "☏" : "@"}</div><div><h3>${esc(idLabel(cur))}</h3><p>${esc(cur.address_masked ?? "")} · ${esc(cur.role ?? "")}</p></div>
        <span style="margin-left:auto" class="pill ${twoFaState(cur.two_fa) === "on" ? "accent" : "warn"}">2FA ${FA[twoFaState(cur.two_fa)] ?? "待确认"}</span></div>
        <footer class="box-f">承载 ${xs.length} 个账号 · ${weak2fa(xs).length} 个重要账号 2FA 待确认${cur.recovery ? ` · 恢复：${esc([].concat(cur.recovery).map(r => IDS.find(y => y.id === r) ? idLabel(IDS.find(y => y.id === r)) : r).join("、"))}` : ""}</footer></section>`
      : box({ title: "未绑定身份", body: `<p class="empty">${xs.length} 个账号没有绑定任何身份，补上 identity_ids 后会归到对应身份下。</p>` });
    return { html: head("从身份出发：选左侧身份，右侧按 分类 → 子分类 → 账号 展开它承载的账号。") + T + `<div class="body">${LAYERS(4)}${treeDetail(nav, card + byLayer(xs))}</div>` };
  }
  if (sub === "groups") {
    const [gid, sid] = rest, g = G.find(x => x.id === gid);
    const nav = `<div class="th">分类 → 子分类</div><a class="tl l1 ${!g ? "on" : ""}" href="#accounts/groups">全部分类<span class="k">${live.length}</span></a>` + G.map(x => { const xs = live.filter(a => catOf(a).slug === x.id), w = weak2fa(xs).length, open = g?.id === x.id;
      return `<a class="tl l1 ${open && !sid ? "on" : ""}" href="#accounts/groups/${x.id}"><span class="chev">${open ? "▾" : "▸"}</span>${esc(x.label)}<span class="k ${w ? "w" : ""}">${xs.length}</span></a>`
        + (open ? (x.subcategories || []).map(c => `<a class="tl l2 ${sid === c.id ? "on" : ""}" href="#accounts/groups/${x.id}/${c.id}">${esc(c.label)}<span class="k">${xs.filter(a => a.subcategory === c.id).length}</span></a>`).join("") : ""); }).join("");
    if (!g) return { html: head("分类视图：左侧选分类和子分类，右侧是账号。") + T + `<div class="body">${LAYERS(3)}${treeDetail(nav, `<div class="ggrid">${G.map(x => { const xs = live.filter(a => catOf(a).slug === x.id), w = weak2fa(xs).length;
      return box({ title: `<a href="#accounts/groups/${x.id}">${esc(x.label)}</a>`, meta: `${xs.length} 个${w ? ` · <span class="w">${w}</span> 待确认` : ""}`, flush: true, body: `<div class="rows">${(x.subcategories || []).map(c => { const ys = xs.filter(a => a.subcategory === c.id), wy = weak2fa(ys).length;
        return `<a class="row r3" href="#accounts/groups/${x.id}/${c.id}"><span class="t">${esc(c.label)}</span><span class="tag ${wy ? "warn" : ""}">${wy ? `${wy} 待确认` : ""}</span><span class="tag">${ys.length}</span></a>`; }).join("")}</div>` }); }).join("")}</div>`)}</div>` };
    const xs = live.filter(a => catOf(a).slug === g.id), subsL = g.subcategories?.length ? g.subcategories : [{ id: "", label: g.label }], cur = sid ? subsL.filter(x => x.id === sid) : subsL;
    const crumbs = `<nav class="crumbs"><a href="#accounts/groups">分类</a><span class="sep">/</span><a href="#accounts/groups/${g.id}">${esc(g.label)}</a>${sid ? `<span class="sep">/</span><span>${esc(cur[0]?.label ?? sid)}</span>` : ""}</nav>`;
    return { html: head(`${esc(g.label)}${sid ? ` / ${esc(cur[0]?.label ?? sid)}` : ""} · ${xs.length} 个账号，${weak2fa(xs).length} 个重要账号 2FA 未确认。`) + T + `<div class="body">${LAYERS(sid ? 4 : 3)}${treeDetail(nav, crumbs + cur.map(c => { const ys = xs.filter(a => !c.id || a.subcategory === c.id).sort((a, b) => prank(a) - prank(b) || String(a.service).localeCompare(String(b.service)));
      return box({ title: `<a href="#accounts/groups/${g.id}/${c.id}">${esc(c.label)}</a>`, meta: `${ys.length} 个 · ${weak2fa(ys).length} 个 2FA 待确认`, flush: true, body: ys.length ? `<div class="rows">${ys.map(arow).join("")}</div>` : `<p class="empty" style="padding:16px">无</p>` }); }).join(""))}</div>` };
  }
  if (sub === "subscriptions") {
    const by = {}; for (const x of s) (by[x.account_id ?? "_"] ||= []).push(x);
    const keys = Object.keys(by).sort((a, b) => (by[b].some(x => x.state === "active") - by[a].some(x => x.state === "active")) || a.localeCompare(b));
    const srow = x => { const pv = x.paid_via ? accById(x.paid_via) : null;
      return `<div class="row r4" id="sub-${esc(x.id)}"><span class="t">${esc(x.service)}<span class="s">${esc([x.plan, x.amount !== "待补充" ? `${x.amount}${x.currency !== "待补充" ? ` ${x.currency}` : ""}` : "", x.cycle !== "unknown" ? x.cycle : ""].filter(Boolean).join(" · "))}</span></span>
      <span class="tag">${/^\d{4}-\d{2}-\d{2}$/.test(x.renew_date) ? `续费 ${md(x.renew_date)}` : x.renew_day ? `每月 ${x.renew_day} 日` : ""}</span><span class="tag">${pv ? `经 <a href="${accHref(pv)}">${esc(pv.service)}</a>` : x.paid_via ? esc(x.paid_via) : "付款方式待补充"}</span><span class="tag ${["verify", "paused", "refund-requested"].includes(x.state) ? "warn" : ""}">${esc(ST[x.state] ?? x.state)}</span></div>`; };
    const active = s.filter(x => x.state === "active"), verify = s.filter(x => ["verify", "paused", "refund-requested"].includes(x.state));
    return { html: head(`订阅挂在账号下（account_id）。${active.length} 个在用，约 <b>${Math.round(monthlyCNY())} CNY / 月</b>；<b>${verify.length}</b> 个待核实 / 暂停 / 退款。`) + T + `<div class="body">
      ${keys.map(k => { const a = accById(k); return `<section class="blk"><h2>${a ? `<a href="${accHref(a)}">${esc(a.service)}</a>` : "未关联账号"}<span class="more">${a ? esc(priorityOf(a) ?? "") + " · 2FA " + FA[fa(a)] : ""} · ${by[k].length} 个订阅</span></h2><div class="rows">${by[k].map(srow).join("")}</div></section>`; }).join("")}</div>` };
  }
  // security
  const m = buildModel(accs, M.identities?.items || []), sec = security(m);
  const why = a => `2FA：${a.two_fa_detail ?? FA[fa(a)]}`;
  const lines = [[sec.noRecovery.length, "缺恢复方式"], [sec.unbound.length, "未绑定身份"], [sec.noPM.length, "未使用密码管理器"], [m.spof.length, "单点故障"]];
  return { html: head(`<b>${w2.length}</b> 个重要账号（P0/P1）2FA 未确认。`) + T + `<div class="body">
    <section class="blk"><h2>重要账号 · 2FA 未确认<span class="more">${w2.length} 个 · P0/P1</span></h2><div class="rows">${w2.sort((a, b) => prank(a) - prank(b)).slice(0, 8).map(a => `<a class="row r2" href="${accHref(a)}"><span class="t">${esc(a.service)}<span class="s">${esc(why(a))}</span></span><span class="tag">${esc(priorityOf(a) ?? "")}</span></a>`).join("")}</div>
      ${w2.length > 8 ? more(w2.length - 8, `<div class="rows">${w2.slice(8).map(a => `<a class="row r2" href="${accHref(a)}"><span class="t">${esc(a.service)}<span class="s">${esc(why(a))}</span></span><span class="tag">${esc(priorityOf(a) ?? "")}</span></a>`).join("")}</div>`, "展开全部") : ""}
      <div class="ag" style="margin-top:12px">${lines.map(([n, t]) => `<a href="#accounts/identities"><b>${n}</b> ${t}</a>`).join("")}</div></section>
    <section class="blk"><h2>单点故障<span class="more">${m.spof.length}</span></h2><div class="rows">${m.spof.slice(0, 10).map(x => `<div class="row r2"><span class="t">${esc(x.title)}</span><span class="tag ${x.level === "high" ? "warn" : ""}">${x.level === "high" ? "高" : "中"}</span></div>`).join("")}</div></section></div>` };
}
