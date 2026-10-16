// 账号 (v9): 身份 → 分类 (group → subcategory → account) → 订阅 (by account_id), plus 安全 and 关系图.
//   #accounts/identities[?id=…]          layer 1: identities (identity-centred view)
//   #accounts/groups[/<group>[/<sub>]]    layers 2–3: data/account-groups.yaml → accounts
//   #accounts/subscriptions              subscriptions grouped by account (account_id) with paid_via
//   #accounts/security                   2FA (shared weak2fa → 29) / recovery / SPOF
//   #accounts/graph                      relation graph (pages/graph.js)
//   #account/<id>                        account detail (pages/account.js); old #accounts/cat/<slug> and #accounts/overview still work
import { M, V, subs, liveSub, monthlyCNY, known, accHref, accById, catOf, catPages, groups, subsOf, v9 } from "../data.js";
import { weak2fa, twoFaState, priorityOf, daysUntil } from "../core.js";
import { buildModel, security, mask, prank } from "../identity.js";
import { esc, header, tabs, more } from "../ui.js";
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
  const T = tabs("accounts", [["identities", "身份", (M.identities?.items || []).length], ["groups", "分类", G.length], ["subscriptions", "订阅", s.length], ["security", "安全", w2.length || ""], ["graph", "关系图"]], sub);
  const head = (lede, extra = []) => header("账号", "", [`${accs.length} 个账号`, `${(M.identities?.items || []).length} 个身份`, `${G.length} 个分类`, `${s.length} 个订阅`, ...extra], lede);
  const fa = a => twoFaState(a.two_fa);
  const arow = a => { const ss = subsOf(a.id); return `<a class="row r4" href="${accHref(a)}"><span class="t">${esc(a.service)}<span class="s">${esc((a.identity_ids || []).map(i => (M.identities?.items || []).find(x => x.id === i)?.provider?.replace(/[（(].*$/, "") ?? i).join(" · ") || "未绑定身份")}</span></span>
    <span class="tag">${esc(priorityOf(a) ?? "")}</span><span class="tag ${fa(a) === "on" ? "ok" : /P[01]/.test(priorityOf(a) ?? "") && fa(a) !== "na" ? "warn" : ""}">2FA ${FA[fa(a)]}</span><span class="tag">${ss.length ? `${ss.length} 订阅` : ""}</span></a>`; };
  if (sub === "graph") return { html: head("身份是枢纽，连线是登录 / OAuth / 恢复关系；点身份看它失守会波及哪些账号。") + T + `<div class="body">${renderGraph(P)}</div>`, mount: mountGraph };
  if (sub === "identities") return { html: head("第一层：4 个身份（邮箱 / 手机）。每个账号挂在它绑定的身份下；点身份看承载的账号与恢复链。") + T + `<div class="body">${renderAccounts([], P)}</div>`, mount: mountAccounts };
  if (sub === "groups") {
    const [gid, sid] = rest, g = G.find(x => x.id === gid);
    if (g) { const xs = live.filter(a => catOf(a).slug === g.id), subsL = g.subcategories?.length ? g.subcategories : [{ id: "", label: g.label }];
      const cur = sid ? subsL.filter(x => x.id === sid) : subsL;
      return { html: head(`<a href="#accounts/groups">分类</a> / <b>${esc(g.label)}</b>${sid ? ` / <b>${esc(cur[0]?.label ?? sid)}</b>` : ""} · ${xs.length} 个账号，${weak2fa(xs).length} 个重要账号 2FA 未确认。`) + T + `<div class="body">
        <nav class="crumbs"><a href="#accounts/groups">分类</a><span class="sep">/</span><a href="#accounts/groups/${g.id}">${esc(g.label)}</a>${sid ? `<span class="sep">/</span><span>${esc(cur[0]?.label ?? sid)}</span>` : ""}</nav>
        ${cur.map(c => { const ys = xs.filter(a => !c.id || a.subcategory === c.id).sort((a, b) => prank(a) - prank(b) || String(a.service).localeCompare(String(b.service)));
          return `<section class="blk"><h2><a href="#accounts/groups/${g.id}/${c.id}">${esc(c.label)}</a><span class="more">${ys.length} 个 · ${weak2fa(ys).length} 个 2FA 待确认</span></h2><div class="rows">${ys.map(arow).join("") || `<p class="empty">无</p>`}</div></section>`; }).join("")}</div>` };
    }
    return { html: head("第二层：分组 → 子分类；第三层：账号。数字 = 账号数 / P0·P1 中 2FA 未确认数。") + T + `<div class="body"><div class="ggrid">${G.map(g => { const xs = live.filter(a => catOf(a).slug === g.id), w = weak2fa(xs).length;
      return `<section class="blk gcard"><h2><a href="#accounts/groups/${g.id}">${esc(g.label)}</a><span class="more">${xs.length} 个${w ? ` · <span class="w">${w}</span> 待确认` : ""}</span></h2><div class="rows">${(g.subcategories || []).map(c => { const ys = xs.filter(a => a.subcategory === c.id);
        return `<a class="row r3" href="#accounts/groups/${g.id}/${c.id}"><span class="t">${esc(c.label)}</span><span class="tag">${ys.length}</span><span class="tag ${weak2fa(ys).length ? "warn" : ""}">${weak2fa(ys).length ? `${weak2fa(ys).length} 待确认` : ""}</span></a>`; }).join("")}</div></section>`; }).join("")}</div></div>` };
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
