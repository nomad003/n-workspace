// 今天: at most 5 blocks — 接下来 · 本季度计划 · 需要处理 · 最近在做 · Agents.
import { overview, weak2fa } from "../core.js";
import { bundle, V, M, records, plan, noteByPath, AGENTS, agentState } from "../data.js";
import { esc, noteHref, header } from "../ui.js";
const WD = ["日", "一", "二", "三", "四", "五", "六"];
const md = d => { const m = String(d).match(/^\d{4}-(\d{2})-(\d{2})/); return m ? `${+m[1]}/${+m[2]}` : esc(d); };
const when = u => u.approx && /-(28|29|30|31)$/.test(u.date) && u.kind === "截止" ? `${+u.date.slice(5, 7)} 月底` : md(u.date);
export const quarterActions = p => { const now = new Date(), q = `${now.getFullYear()} Q${Math.ceil((now.getMonth() + 1) / 3)}`;
  return (p?.actions || []).filter(a => a.horizon === q); };
export default function () {
  const v = V.today, o = overview(bundle, v), win = v.window_days ?? 30, max = v.max_rows ?? 5;
  const up = o.upcoming.filter(u => u.days <= win && u.days >= -7);
  const p = plan(), qa = quarterActions(p), qdone = qa.filter(a => a.done).length, qopen = qa.filter(a => !a.done);
  const w2 = weak2fa(M.accounts?.items || []);
  const subs = M.subscriptions?.items || [], verify = subs.filter(s => /待核实|suspected|pause|暂停/i.test(s.status ?? "")), refund = subs.filter(s => /refund/i.test(s.status ?? ""));
  const att = [w2.length && { n: w2.length, w: true, t: "重要账号 2FA 未确认", s: w2.slice(0, 4).map(a => a.service).join("、") + (w2.length > 4 ? " …" : ""), href: "#accounts/overview" },
    verify.length && { n: verify.length, t: "订阅待核实", s: verify.map(s => s.service.replace(/\s*[（(].*$/, "")).join(" · "), href: "#accounts/subscriptions" },
    refund.length && { n: refund.length, t: "退款处理中", s: refund.map(s => `${s.service} · ${s.amount ?? ""} ${s.currency ?? ""}`).join("；"), href: "#accounts/subscriptions" }].filter(Boolean).slice(0, 3);
  const recent = [...records].filter(r => !/(^|\/)(index|README)\.md$/i.test(r.origin?.source_path ?? "") && r.type !== "moc").sort((a, b) => String(b.updated).localeCompare(String(a.updated))).slice(0, v.recent_notes ?? 4);
  const ags = AGENTS.map(agentState).filter(a => a.tasks.length || a.channels.length);
  const x = (M.content?.items || []).find(c => /^X/i.test(c.platform ?? "")), xs = x?.snapshots?.at?.(-1);
  const now = new Date(), wk = Math.ceil(((now - new Date(now.getFullYear(), 0, 1)) / 864e5 + new Date(now.getFullYear(), 0, 1).getDay() + 1) / 7);
  const lede = `未来 ${win} 天有 <b>${up.length} 件</b>事到期${qa.length ? `，本季度计划完成 <b>${qdone} / ${qa.length}</b>` : ""}${att.length ? `，<b>${att.length} 项</b>需要你处理` : ""}。`;
  const planHref = (() => { const r = noteByPath("life", "life/12个月行动清单.md"); return r ? noteHref(r) : "#plan"; })();
  return { html: header("今天", "", [`${now.getMonth() + 1}月${now.getDate()}日 周${WD[now.getDay()]}`, `第 ${wk} 周`], lede) + `<div class="body">
  <section class="blk"><h2>接下来<a class="more" href="#plan">${win} 天 · 全部 ${o.upcoming.length} 项 →</a></h2>${up.length ? `<div class="rows">${up.slice(0, max).map((u, i) => `<div class="row"><span class="when ${i === 0 ? "soon" : ""}">${when(u)}</span><span class="t">${esc(u.name)}${u.extra && u.kind === "续费" ? `<span class="s">${esc(u.extra)}</span>` : ""}</span><span class="tag">${u.kind === "续费" ? "订阅" : u.kind === "截止" ? (u.extra && !/^user$/i.test(u.extra) ? `Agent · ${esc(u.extra)}` : "任务") : esc(u.kind)}</span></div>`).join("")}</div>` : `<p class="empty">${win} 天内没有到期项。</p>`}</section>
  <div class="two">
  <section class="blk"><h2>本季度计划<a class="more" href="#plan">行动清单 →</a></h2>${qa.length ? `<div class="q"><div class="bar"><i style="width:${Math.round(qdone / qa.length * 100)}%"></i></div><span class="p">${qdone} / ${qa.length}</span></div>
    <div class="rows">${qopen.slice(0, 4).map(a => `<a class="row r2" href="#plan"><span class="t"><span class="cb"></span>${esc(a.title.replace(/（.*?）/g, ""))}</span><span class="tag">${a.priority ? `${esc(a.priority)} · ` : ""}${esc(/^\d{4}-\d{2}/.test(a.due) ? `${+a.due.slice(5, 7)} 月` : a.due)}</span></a>`).join("")}</div>` : `<p class="empty">未找到 12 个月行动清单（life/12个月行动清单.md）。</p>`}</section>
  <section class="blk"><h2>需要处理</h2>${att.length ? `<div class="attn">${att.map(a => `<a class="ac ${a.w ? "w" : ""}" href="${a.href}"><span class="n">${a.n}</span><p>${esc(a.t)}<small>${esc(a.s)}</small></p></a>`).join("")}</div>` : `<p class="empty">没有待处理项。</p>`}</section></div>
  <div class="two">
  <section class="blk"><h2>最近在做<a class="more" href="#knowledge">知识 →</a></h2><div class="rows">${recent.map(r => `<a class="row r2" href="${noteHref(r)}"><span class="t">${esc(r.title)}<span class="s">${esc(r.origin.source_path.split("/").slice(0, -1).slice(-1)[0] || r.root)}</span></span><span class="tag">${md(r.updated)}</span></a>`).join("")}</div></section>
  <section class="blk"><h2>Agents<a class="more" href="#agents">→</a></h2><div class="ag">${ags.map(a => `<a href="#agents"><i class="dot ${a.label === "运行中" ? "on" : ""}"></i><b>${esc(a.name === "Blibli" ? "Bilibili" : a.name)}</b> ${a.name === "X" && xs ? `${esc(a.label)} · 关注 ${xs.following ?? "—"}` : a.tasks.length ? `${a.tasks.length} 待办` : esc(a.label)}</a>`).join("")}</div></section></div>
  </div>` };
}
