// 计划 (v9): 本周/本月 board · 目标树 (decade → year → half/quarter → tasks) · 复盘 (cadences + instances + learn/mind/reviews/) · 学习路线 (learn/ai/).
import { tasks, plansV9, reviews, notesIn, records, v9, dirCovers, section, dirSources } from "../data.js";
import { pageTabs } from "../page-tabs.js";
import { dueEnd, daysUntil, isOpenTask, quarterOf, ymdOf } from "../core.js";
import { esc, header, tabs, noteHref, noteList, box, mainSide } from "../ui.js";
import { taskRow } from "./_tasks.js";
const LVL = { decade: "十年", year: "年度", half: "半年", quarter: "季度", month: "月", week: "周" };
const KIND = { quarterly: "季度轻复盘", annual: "年度大复盘", monthly: "月度复盘", weekly: "周复盘" };
const rr = r => { const m = String(r).match(/BYMONTH=([\d,]+)/); return m ? `每年 ${m[1].split(",").join(" / ")} 月` : r; };
const src = u => {
  const raw = String(u ?? "").trim(); if (!raw) return "";
  const plain = raw.replace(/^life:\/\//, "");
  if (plain.startsWith("templates/")) return `<span class="more">${esc(plain)}</span>`;
  const m = raw.match(/^life:\/\/([^#?]+)/); if (!m) return "";
  const r = records.find(x => x.root === "life" && (x.slug === m[1] || x.origin.source_path.replace(/\.md$/, "") === m[1]));
  return r ? `<a class="more" href="${noteHref(r)}">原文 →</a>` : "";
};
const PLAN_DIRS = { tree: ["life/plan/"], reviews: ["learn/mind/reviews/"], learning: ["learn/ai/"] };
const dirsOf = id => dirSources("plan", id, PLAN_DIRS[id] || []);
const notesOf = id => { const dirs = dirsOf(id); return { dirs, notes: dirs.flatMap(notesIn) }; };
const noteBlock = (title, id) => { const { dirs, notes } = notesOf(id), label = dirs.map(d => `life://${d}`).join(" · ");
  const body = !dirs.length ? `<p class="empty">sections.yaml 里这个分页没有目录来源。</p>` : (notes.length || dirs.some(dirCovers) ? noteList(notes, 99) : `<p class="empty">${esc(label)} 目录还不存在。</p>`);
  return `<section class="blk"><h2>${esc(title)}${label ? `<span class="more">${esc(label)}</span>` : ""}</h2>${body}</section>`; };
export default function (sub = "board") {
  if (!v9) return { html: header("计划", "", [], "需要 n-life-data schema_version 9。") };
  const ts = tasks(), P = plansV9(), open = ts.filter(isOpenTask), now = new Date(), today = ymdOf(now), q = quarterOf(now);
  const qp = P.find(p => p.level === "quarter" && p.period === q), qt = qp ? ts.filter(t => t.plan === qp.id) : [];
  const nr = reviews().flatMap(r => r.instances.filter(i => i.status === "open").map(i => ({ ...i, r }))).sort((a, b) => String(dueEnd(a.due)).localeCompare(String(dueEnd(b.due))))[0];
  const lede = `${open.length} 个未完成任务${qp ? `，${esc(qp.title)} <b>${qt.filter(t => t.status === "done").length} / ${qt.length}</b>` : ""}${nr ? `。下一次复盘：<b>${esc(nr.period)} · ${esc(KIND[nr.r.kind] ?? nr.r.id)}</b>（${esc(nr.due)}）` : ""}。`;
  const qd = qt.filter(t => t.status === "done").length, lateN = open.filter(t => dueEnd(t.due) && dueEnd(t.due) < today).length;
  const head = header("计划", "", [`tasks.yaml ${ts.length}`, `plans.yaml ${P.length} 个计划 · ${reviews().length} 个复盘节奏`], lede, { actions: [["目标树", "#plan/tree"], ["复盘", "#plan/reviews", true]],
    kpis: [[open.length, "未完成任务", { sub: `我 ${open.filter(t => t.owner === "user").length} · agent ${open.filter(t => t.owner !== "user").length}` }], [lateN, "逾期", { tone: lateN ? "warn" : "" }],
      qp && [`${qd}<small>/ ${qt.length}</small>`, `${esc(qp.period)} 计划`, { tone: "focus", bar: qt.length ? qd / qt.length * 100 : 0, href: "#plan/tree" }],
      [open.filter(t => !t.due && !t.due_event && !t.recurrence && !t.scheduled).length, "无日期", { sub: "需要排期" }], nr && [esc(nr.period), "下一次复盘", { sub: esc(nr.due), href: "#plan/reviews" }]] })
    + tabs("plan", pageTabs(section("plan"), "plan"), sub);
  if (!new Set(["board", "tree", "reviews", "learning"]).has(sub)) return { html: head + `<div class="body"><p class="empty">「${esc(sub)}」还没有对应的页面。</p></div>` };
  if (sub === "tree") {
    const kids = id => P.filter(p => p.parent === id), roots = P.filter(p => !p.parent || !P.some(x => x.id === p.parent));
    const node = (p, d) => { const xs = ts.filter(t => t.plan === p.id), done = xs.filter(t => t.status === "done").length;
      return `<div class="pnode" style="--d:${d}"><div class="ph2"><span class="lv">${esc(LVL[p.level] ?? p.level)}</span><b>${esc(p.title)}</b><span class="s">${esc(p.period)}${p.measure ? ` · ${esc(p.measure)}` : ""}</span>${xs.length ? `<span class="q mini"><span class="bar"><i style="width:${Math.round(done / xs.length * 100)}%"></i></span><span class="p">${done} / ${xs.length}</span></span>` : ""}${src(p.source)}</div>
        ${xs.length ? `<div class="rows">${xs.sort((a, b) => (a.status === "done") - (b.status === "done") || String(a.priority).localeCompare(String(b.priority))).map(t => taskRow(t)).join("")}</div>` : ""}${kids(p.id).map(k => node(k, d + 1)).join("")}</div>`; };
    const loose = open.filter(t => !t.plan);
    return { html: head + `<div class="body">${roots.map(p => node(p, 0)).join("")}
      <section class="blk"><h2>未挂计划的任务<span class="more">${loose.length} 项 · backlog</span></h2><div class="rows">${loose.map(t => taskRow(t)).join("")}</div></section>${noteBlock("计划笔记", "tree")}</div>` };
  }
  if (sub === "reviews") {
    return { html: head + `<div class="body">${reviews().map(r => `<section class="blk"><h2>${esc(KIND[r.kind] ?? r.id)}<span class="more">${esc(rr(r.rrule))} · ${r.duration_min} 分钟</span>${src(r.template)}</h2>
      <div class="hz"><div class="h">清单</div><div class="rows">${(r.checklist || []).map(c => `<div class="prow"><span class="cb"></span><div class="t">${esc(c)}</div><span></span></div>`).join("")}</div></div>
      <div class="hz"><div class="h">实例</div><div class="rows">${(r.instances || []).map(i => `<div class="prow ${i.status === "done" ? "done" : ""}"><span class="cb ${i.status === "done" ? "done" : ""}"></span><div><div class="t">${esc(i.period)}</div><div class="d">${esc(i.note ?? "")}${i.done_at ? ` · 完成于 ${esc(i.done_at)}` : ""}</div></div><span class="pill ${daysUntil(dueEnd(i.due)) < 0 && i.status === "open" ? "late" : "g"}">${esc(i.due)}</span></div>`).join("")}</div></div></section>`).join("") || `<p class="empty">plans.yaml 中没有 reviews。</p>`}
      ${noteBlock("复盘记录", "reviews")}</div>` };
  }
  if (sub === "learning") {
    const lt = open.filter(t => t.area === "learning");
    return { html: head + `<div class="body">${noteBlock("学习路线", "learning")}
      <section class="blk"><h2>学习任务<span class="more">${lt.length} 项 · area: learning</span></h2><div class="rows">${lt.map(t => taskRow(t)).join("")}</div></section></div>` };
  }
  // board: grouped by time window
  const end = t => dueEnd(t.due), W1 = (() => { const d = new Date(now); d.setDate(now.getDate() + (6 - (now.getDay() + 6) % 7)); return ymdOf(d); })(), M1 = dueEnd(today.slice(0, 7)), Q1 = dueEnd(q);
  const G = [["逾期", t => end(t) && end(t) < today], ["今天", t => end(t) === today || t.scheduled === today], ["本周", t => (end(t) && end(t) <= W1) || (t.scheduled && t.scheduled <= W1)], ["本月", t => end(t) && end(t) <= M1],
    ["本季度", t => end(t) && end(t) <= Q1], ["之后", t => !!end(t)], ["重复", t => !!t.recurrence], ["事件节点", t => !!t.due_event], ["无日期", () => true]];
  const left = new Set(open), out = G.map(([k, f]) => { const xs = [...left].filter(f); xs.forEach(x => left.delete(x)); return [k, xs.sort((a, b) => String(end(a)).localeCompare(String(end(b))) || String(a.priority).localeCompare(String(b.priority)))]; }).filter(([, xs]) => xs.length);
  const board = box({ title: "按时间窗口", meta: `${open.length} 项未完成`, cls: "focus", flush: true,
    body: out.map(([k, xs]) => `<div class="hz"><div class="h">${esc(k)}<small>${xs.length} 项</small></div><div class="rows">${xs.map(t => taskRow(t)).join("")}</div></div>`).join("") });
  const levels = P.filter(p => ["year", "half", "quarter"].includes(p.level)).map(p => { const xs = ts.filter(t => t.plan === p.id), d = xs.filter(t => t.status === "done").length;
    return `<div class="row r2"><span class="t">${esc(p.title)}<span class="s">${esc(LVL[p.level] ?? p.level)} · ${esc(p.period)}</span></span><span class="tag">${xs.length ? `${d} / ${xs.length}` : ""}</span></div>`; }).join("");
  const done = ts.filter(t => t.status === "done");
  const side = box({ title: "计划层级", link: ["目标树", "#plan/tree"], flush: true, body: `<div class="rows">${levels}</div>` })
    + box({ title: "已完成", meta: `${done.length} 项`, flush: true, body: done.length ? `<div class="rows">${done.map(t => `<div class="row r2"><span class="t">${esc(t.title)}</span><span class="tag">${esc(String(t.done_at ?? "").slice(0, 10))}</span></div>`).join("")}</div>` : `<p class="empty" style="padding:16px">无</p>` });
  return { html: head + `<div class="body">${mainSide(board, side)}</div>` };
}
