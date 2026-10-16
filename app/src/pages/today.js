// 今天 (v9): every block is derived from data/tasks.yaml + plans.yaml + subscriptions.yaml (+ profile documents) via core.deriveToday.
import { deriveToday, weak2fa, dueEnd } from "../core.js";
import { V, M, records, tasks, subs, plansV9, reviews, agentName, v9 } from "../data.js";
import { esc, noteHref, header } from "../ui.js";
import { dueLabel, taskRow } from "./_tasks.js";
const WD = ["日", "一", "二", "三", "四", "五", "六"];
const md = d => { const m = String(d).match(/^\d{4}-(\d{2})-(\d{2})/); return m ? `${+m[1]}/${+m[2]}` : esc(d); };
export default function () {
  if (!v9) return { html: header("今天", "", [], "需要 n-life-data schema_version 9（data/tasks.yaml + plans.yaml）。请设置 LIFE_REF 后重新 npm start。") };
  const now = new Date(), docs = [...(M.profile?.data?.documents || [])];
  const T = deriveToday({ tasks: tasks(), plans: plansV9(), reviews: reviews(), subs: subs(), docs }, now);
  const rows = [
    ...T.overdue.map(t => ({ k: "逾期", c: "late", when: dueLabel(t), t })), ...T.dueToday.map(t => ({ k: "今天到期", c: "soon", when: "今天", t })),
    ...T.scheduled.map(t => ({ k: "今天安排", c: "soon", when: "今天", t })), ...T.week_.map(t => ({ k: "本周", when: md(t.scheduled || t.due), t })),
    ...T.thisMonth.map(t => ({ k: "本月", when: `${+t.due.slice(5)} 月底`, t })),
    ...T.renewals.map(({ s, d }) => ({ k: "续费", when: md(s.renew_date), sub: { title: s.service, s: [s.amount, s.currency].filter(x => x && x !== "待补充").join(" "), href: `#account/${encodeURIComponent(s.account_id ?? "")}` } })),
    ...T.expiring.map(({ d, n }) => ({ k: "证件", c: n < 0 ? "late" : "", when: md(d.expires), sub: { title: d.name, s: n < 0 ? "已过期" : `${n} 天后到期`, href: "#life/profile" } }))];
  const w2 = weak2fa(M.accounts?.items || []), verify = subs().filter(s => ["verify", "paused", "refund-requested"].includes(s.state));
  const att = [w2.length && { n: w2.length, w: true, t: "重要账号 2FA 未确认", s: w2.slice(0, 4).map(a => a.service).join("、") + (w2.length > 4 ? " …" : ""), href: "#accounts/security" },
    verify.length && { n: verify.length, t: "订阅待核实 / 暂停 / 退款", s: verify.map(s => s.service.replace(/\s*[（(].*$/, "")).join(" · "), href: "#accounts/subscriptions" },
    T.inbox.length && { n: T.inbox.length, t: "任务没有日期", s: "给它们排一个 due 或 scheduled（do-date）", href: "#plan/board" }].filter(Boolean);
  const q = T.quarter, qOpen = q ? q.tasks.filter(t => t.status !== "done").sort((a, b) => String(a.priority).localeCompare(String(b.priority))) : [];
  const recent = records.filter(r => r.root === "life" && !/(^|\/)(index|README)\.md$/i.test(r.origin.source_path) && r.type !== "moc").sort((a, b) => String(b.updated).localeCompare(String(a.updated))).slice(0, 5);
  const ags = Object.entries(T.agents);
  const wk = Math.ceil((((now - new Date(now.getFullYear(), 0, 1)) / 864e5) + new Date(now.getFullYear(), 0, 1).getDay() + 1) / 7);
  const lede = [T.overdue.length ? `<b class="w">${T.overdue.length} 件逾期</b>` : "没有逾期", T.dueToday.length + T.scheduled.length ? `今天 <b>${T.dueToday.length + T.scheduled.length}</b> 件` : "",
    T.thisMonth.length ? `本月还有 <b>${T.thisMonth.length}</b> 件` : "", q ? `本季度计划 <b>${q.done} / ${q.tasks.length}</b>` : "", att.length ? `<b>${att.length}</b> 项需要处理` : ""].filter(Boolean).join("，") + "。";
  const rowHtml = r => r.t ? `<a class="row" href="#plan/board"><span class="when ${r.c ?? ""}">${esc(r.when)}</span><span class="t">${esc(r.t.title)}${r.t.owner !== "user" ? `<span class="s">${esc(agentName(r.t.owner))}</span>` : ""}</span><span class="tag">${esc(r.k)}</span></a>`
    : `<a class="row" href="${r.sub.href}"><span class="when ${r.c ?? ""}">${esc(r.when)}</span><span class="t">${esc(r.sub.title)}<span class="s">${esc(r.sub.s)}</span></span><span class="tag">${esc(r.k)}</span></a>`;
  return { html: header("今天", "", [`${now.getMonth() + 1}月${now.getDate()}日 周${WD[now.getDay()]}`, `第 ${wk} 周`, `本周 ${md(T.week[0])}–${md(T.week[1])}`], lede) + `<div class="body">
  <section class="blk"><h2>接下来<a class="more" href="#plan/board">本周 / 本月 →</a></h2>${rows.length ? `<div class="rows">${rows.slice(0, 8).map(rowHtml).join("")}</div>` : `<p class="empty">今天、本周和本月都没有到期事项。</p>`}
    <p class="note">${["逾期 " + T.overdue.length, "今天到期 " + T.dueToday.length, "今天安排 " + T.scheduled.length, "本周 " + T.week_.length, "本月 " + T.thisMonth.length, "续费 14 天内 " + T.renewals.length].join(" · ")}</p></section>
  <div class="two">
  <section class="blk"><h2>本季度计划${q ? `<span class="more">${esc(q.plan.period)}</span>` : ""}<a class="more" href="#plan/tree">目标树 →</a></h2>${q ? `<div class="q"><div class="bar"><i style="width:${Math.round(q.done / Math.max(1, q.tasks.length) * 100)}%"></i></div><span class="p">${q.done} / ${q.tasks.length}</span></div>
    <div class="rows">${qOpen.slice(0, 5).map(t => taskRow(t, { detail: false })).join("")}</div>` : `<p class="empty">plans.yaml 中没有本季度（${esc(T.today.slice(0, 4))}）的 quarter 计划。</p>`}</section>
  <section class="blk"><h2>需要处理</h2>${att.length ? `<div class="attn">${att.map(a => `<a class="ac ${a.w ? "w" : ""}" href="${a.href}"><span class="n">${a.n}</span><p>${esc(a.t)}<small>${esc(a.s)}</small></p></a>`).join("")}</div>` : `<p class="empty">没有待处理项。</p>`}
    ${T.nextReview ? `<a class="review sm" href="#plan/reviews"><b>下次复盘 · ${esc(T.nextReview.period)}</b><p>${esc({ quarterly: "季度轻复盘", annual: "年度大复盘" }[T.nextReview.review.kind] ?? T.nextReview.review.id)} · 截止 ${esc(dueLabel({ due: T.nextReview.due }))} · ${T.nextReview.review.duration_min} 分钟</p></a>` : ""}</section></div>
  <div class="two">
  <section class="blk"><h2>最近记录<a class="more" href="#journal">记录 →</a></h2><div class="rows">${recent.map(r => `<a class="row r2" href="${noteHref(r)}"><span class="t">${esc(r.title)}<span class="s">${esc(r.origin.source_path.split("/")[0])}</span></span><span class="tag">${md(r.updated)}</span></a>`).join("")}</div></section>
  <section class="blk"><h2>Agents<a class="more" href="#agents">→</a></h2>${ags.length ? `<div class="ag">${ags.map(([a, ts]) => `<a href="#agents"><i class="dot ${ts.some(t => t.status === "in-progress") ? "on" : ""}"></i><b>${esc(agentName(a))}</b> ${ts.length} 待办</a>`).join("")}</div>` : `<p class="empty">没有 agent 任务。</p>`}</section></div>
  </div>` };
}
