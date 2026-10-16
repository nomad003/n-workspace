// 账号与订阅: lean landing (attention → identities → categories), subscriptions tab, and drill-downs
//   #accounts/identities[?id=…]  identity-centred view (cards, graph, SPOFs, filters)  — from the v7 account work
//   #accounts/graph[?focus=<identity>&risky=1]  account graph (pages/graph.js)
//   #accounts/cat/<slug>         category page
//   #account/<id>                account detail (pages/account.js)
import { M, V, subs, liveSub, CYCLE, toCNY, monthlyCNY, dupSet, dupKey, nextRenewal, daysUntil, known, accHref, catOf, catPages } from "../data.js";
import { weak2fa, twoFaState, priorityOf } from "../core.js";
import { buildModel, security, missingOf, mask, prank } from "../identity.js";
import { esc, header, tabs, table, more, noteList, pending, countUnknown } from "../ui.js";
import { render as renderGraph, mount as mountGraph } from "./graph.js";
import { render as renderAccounts, mount as mountAccounts } from "./accounts.js";
const FA = { on: "已开启", off: "未开启", unknown: "待确认", na: "不适用" };
const md = d => String(d).slice(5).replace("-", "/");
export default function (sub = "overview", P = new URLSearchParams(), rest = []) {
  const accs = M.accounts?.items || [], s = subs(), w2 = weak2fa(accs);
  const T = tabs("accounts", [["overview", "概览"], ["subscriptions", "订阅"], ["identities", "全部账号"], ["graph", "图"]], ["cat", "identities"].includes(sub) ? "identities" : sub);
  const head = (lede) => header("账号与订阅", "", [`${accs.length} 个账号`, `${(M.identities?.items || []).length} 个身份`, `${s.length} 个订阅`], lede);
  if (sub === "graph") return { html: head("身份是枢纽，连线是登录 / OAuth / 恢复关系；点身份看它失守会波及哪些账号。") + T + `<div class="body">${renderGraph(P)}</div>`, mount: mountGraph };
  if (sub === "identities" || sub === "cat") return { html: head("") + T + `<div class="body">${renderAccounts(sub === "cat" ? ["cat", rest[0]] : [], P)}</div>`, mount: mountAccounts };
  if (sub === "subscriptions") {
    const dups = dupSet(), live = s.filter(liveSub);
    const renew = s.filter(x => !/cancel/i.test(x.status || "")).map(x => ({ x, r: nextRenewal(x) })).filter(y => y.r && daysUntil(y.r.date) >= -7).sort((p, q) => p.r.date.localeCompare(q.r.date));
    const verify = s.filter(x => /待核实|疑似|suspected|暂停|pause|refund/i.test(x.status || ""));
    const row = (x, right) => `<div class="row r2"><span class="t">${esc(x.service)}<span class="s">${esc([x.plan, known(x.amount) ? `${x.amount} ${x.currency}` : "", x.cycle && known(x.cycle) ? x.cycle : ""].filter(known).join(" · "))}</span></span><span class="tag">${right}</span></div>`;
    return { html: head(`${live.length} 个在计费，约 <b>${Math.round(monthlyCNY())} CNY / 月</b>（固定汇率）。${verify.length ? `<b>${verify.length}</b> 个需核实或退款中。` : ""}`) + T + `<div class="body">
      <div class="two"><section class="blk"><h2>即将续费</h2>${renew.length ? `<div class="rows">${renew.map(({ x, r }) => row(x, `${r.approx ? "约 " : ""}${md(r.date)}`)).join("")}</div>` : `<p class="empty">无已知续费日</p>`}</section>
      <section class="blk"><h2>需核实</h2>${verify.length ? `<div class="rows">${verify.map(x => row(x, esc(x.status))).join("")}</div>` : `<p class="empty">无</p>`}</section></div>
      ${dups.size ? `<p class="note">可能重复：${[...dups].map(esc).join("、")}（两条记录均保留）</p>` : ""}
      ${more(s.length, table(s, V.accounts.columns.subscriptions), "全部订阅")}</div>` };
  }
  // overview
  const m = buildModel(accs, M.identities?.items || []), sec = security(m), live = m.accs.filter(a => !/closed/i.test(a.status ?? ""));
  const arow = (a, why) => `<a class="row r2" href="${accHref(a)}"><span class="t">${esc(a.service)}<span class="s">${esc(why)}</span></span><span class="tag">${esc(priorityOf(a) ?? "")}</span></a>`;
  const lines = [[sec.noRecovery.length, "缺恢复方式", "#accounts/identities"], [sec.unbound.length, "未绑定身份", "#accounts/identities"], [sec.noPM.length, "未使用密码管理器", "#accounts/identities"]];
  const cats = catPages().map(p => { const xs = live.filter(a => catOf(a).slug === p.slug); return { ...p, n: xs.length, w: weak2fa(xs).length }; }).filter(c => c.n);
  return { html: head(`<b>${w2.length}</b> 个重要账号 2FA 未确认。其余问题见下方，详情从身份、分类或账号进入。`) + T + `<div class="body">
    <section class="blk"><h2>重要账号 · 2FA 未确认<span class="more">${w2.length} 个 · P0/P1</span></h2><div class="rows">${w2.sort((a, b) => prank(a) - prank(b)).slice(0, 6).map(a => arow(a, `2FA：${known(a.two_fa) ? a.two_fa : "待补充"}`)).join("")}</div>
      ${w2.length > 6 ? more(w2.length - 6, `<div class="rows">${w2.slice(6).map(a => arow(a, `2FA：${known(a.two_fa) ? a.two_fa : "待补充"}`)).join("")}</div>`, "展开全部") : ""}
      <div class="ag" style="margin-top:12px">${lines.map(([n, t, h]) => `<a href="${h}"><b>${n}</b> ${t}</a>`).join("")}</div></section>
    <div class="two"><section class="blk"><h2>身份<a class="more" href="#accounts/identities">身份视图 →</a></h2><div class="rows">${m.ids.map(i => { const n = live.filter(a => [].concat(a.email_id ?? []).some(x => String(x).startsWith(i.id))).length;
        return `<a class="row r3" href="#accounts/identities?id=${encodeURIComponent(i.id)}"><span class="t">${esc(i.label)}<span class="s">${esc(mask(String(i.address ?? "").replace(/[（(].*$/, "")))}</span></span><span class="tag">${n} 个账号</span><span class="tag">2FA ${i.na2fa ? "不适用" : FA[twoFaState(i.two_fa)]}</span></a>`; }).join("")}</div></section>
    <section class="blk"><h2>分类</h2><div class="rows">${cats.map(c => `<a class="row r3" href="#accounts/cat/${c.slug}"><span class="t">${esc(c.label)}</span><span class="tag">${c.n}</span><span class="tag ${c.w ? "warn" : ""}">${c.w ? `${c.w} 待确认` : ""}</span></a>`).join("")}</div></section></div>
  </div>` };
}
