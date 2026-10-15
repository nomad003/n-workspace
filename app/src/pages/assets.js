// 个人资产: 个人信息 / 账号 / 订阅 / 理财 as tabs.
import { V, M, notesWhere, subs, subCat, catColor, liveSub, CYCLE, toCNY, monthlyCNY, dupSet, dupKey, has2fa, nextRenewal, daysUntil, known } from "../data.js";
import { esc, header, tabs, table, more, card, fmt, kpis, pending, countUnknown, noteList, cd, riskC } from "../ui.js";
import { render as renderAccounts, mount as mountAccounts } from "./accounts.js";
import { hbars } from "../charts.js";
export default function (sub = "profile", P = new URLSearchParams(), rest = []) {
  const v = V.assets, a = M.accounts?.items || [], s = subs(), f = M.finance?.items || [];
  const t = tabs("assets", [["profile", "个人信息"], ["accounts", "账号", a.length], ["subscriptions", "订阅", s.length], ["finance", "理财", f.length]], sub);
  const head = (chips) => header("个人资产", "tui", chips) + t;
  const notes = id => { const rs = notesWhere(v.notes[id]); return rs.length ? more(rs.length, noteList(rs, 999), "相关笔记") : ""; };
  if (sub === "accounts") {
    return { html: head([`${a.length} 个账号`, M.identities?.items?.length ? "identities.yaml" : "身份推断"]) + `<div class="body">${renderAccounts(rest, P)}${notes("accounts")}</div>`, mount: mountAccounts };
  }
  if (sub === "subscriptions") {
    const dups = dupSet(), live = s.filter(liveSub);
    const byCat = Object.entries(live.reduce((t, x) => { const k = CYCLE(x), c = toCNY(x.amount, x.currency); if (k && c != null) t[subCat(x)] = (t[subCat(x)] || 0) + c / k; return t; }, {})).map(([label, n]) => ({ label, v: n, c: catColor(label) })).sort((x, y) => y.v - x.v);
    const renew = s.filter(x => !/cancel/i.test(x.status || "")).map(x => ({ x, r: nextRenewal(x) })).filter(y => y.r && daysUntil(y.r.date) >= -7).sort((p, q) => p.r.date.localeCompare(q.r.date));
    const verify = s.filter(x => /待核实|疑似|暂停|pause|refund/i.test(x.status || ""));
    return { html: head([`≈${Math.round(monthlyCNY())} CNY / 月`]) + `<div class="body">${pending(countUnknown(s), "订阅字段")}
      ${dups.size ? `<div class="pend">可能重复：<b>${[...dups].map(esc).join("、")}</b> · 两条记录均原样显示，未合并</div>` : ""}
      ${kpis([[s.length, "记录"], [live.length, "计费中"], [`≈${Math.round(monthlyCNY())}`, "CNY / 月（固定汇率）"], [verify.length, "需核实 / 退款中", { warn: verify.length > 0 }]])}
      <div class="grid">${card("即将续费", renew.length ? `<div class="ulist">${renew.map(({ x, r }) => `<div class="urow L-modes">${cd(r.date, r.approx)}<div><b>${esc(x.service)}</b><span class="m">${[x.plan, known(x.amount) ? `${x.amount} ${x.currency}` : ""].filter(known).map(esc).join(" · ")}</span></div></div>`).join("")}</div>` : `<p class="empty">无已知续费日</p>`, { span: "s6" })}
      ${card("月均 · 按类别（≈CNY）", hbars(byCat) + `<p class="note">类别由服务名推断。</p>`, { span: "s6" })}</div>
      ${card("需核实", table(verify, ["service", "plan", "amount", "currency", "status", "notes"]), { span: "s12 solo" })}
      ${more(s.length, table(s.map(x => ({ ...x, service: x.service + (dups.has(dupKey(x)) ? " ⚠︎" : "") })), v.columns.subscriptions, { rowClass: r => dups.has(dupKey({ service: r.service.replace(" ⚠︎", "") })) ? "dup" : "" }), "展开全部订阅")}${notes("subscriptions")}</div>` };
  }
  if (sub === "finance") {
    const snap = M.finance?.snapshot || {}, sm = M.finance?.summary || {}, kinds = [...new Set(f.map(x => x.kind))];
    const types = Object.entries(f.filter(x => x.kind === "accounts").reduce((t, x) => (t[x.type || "?"] = (t[x.type || "?"] || 0) + 1, t), {})).sort((p, q) => q[1] - p[1]).map(([label, n], i) => ({ label, v: n, c: ["ai", "agent", "coding", "modes", "tui", "ext"][i % 6] }));
    const facts = [[snap.currency, "币种"], [snap.date, "快照日期"], [sm.net_worth != null ? Math.round(sm.net_worth).toLocaleString() : null, "净资产"], [sm.assets != null ? Math.round(sm.assets).toLocaleString() : null, "资产"], [sm.liabilities != null ? Math.round(sm.liabilities).toLocaleString() : null, "负债"], [`${sm.filled ?? 0}/${sm.total ?? 0}`, "金额已填"]].filter(([n]) => known(n));
    return { html: head([`${f.filter(x => x.kind === "accounts").length} 个账户`]) + `<div class="body">${pending(countUnknown(f) + countUnknown(snap), "理财字段")}
      ${kpis(facts.map(([n, k]) => [esc(n), k]))}
      <div class="grid">${card("账户类型", hbars(types), { span: "s6" })}
      ${card("目标", table(f.filter(x => x.kind === "targets"), ["item", "value", "amount", "notes"]), { span: "s6" })}</div>
      ${kinds.map(k => { const xs = f.filter(x => x.kind === k); return more(xs.length, table(xs, v.columns.finance.filter(c => c !== "kind")), esc(k)); }).join("")}${notes("finance")}</div>` };
  }
  const d = M.profile?.data || {};
  const secs = Object.entries(d).map(([k, x]) => [k, fmt(x)]).filter(([, h]) => h);
  return { html: head([`${secs.length} 个分区`]) + `<div class="body">${pending(countUnknown(d), "个人信息")}
    <div class="grid">${secs.map(([k, h]) => card(esc(k), h, { span: k === "emergency" ? "s12" : "s6" })).join("")}</div>${notes("profile")}</div>` };
}
