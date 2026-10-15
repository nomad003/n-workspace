// 计划: 12 个月行动清单 by horizon · 复盘 cadence · 生活领域 · 学习路线. Source: life/12个月行动清单.md + life/复盘节奏.md.
import { V, plan, notesWhere, noteByPath, tasks, openTasks } from "../data.js";
import { overview } from "../core.js";
import { bundle } from "../data.js";
import { esc, header, tabs, noteHref, noteList, more } from "../ui.js";
const ORDER = h => h === "节点" ? 0 : h === "持续" ? 9 : 1;
const link = (p, label) => { const r = noteByPath("life", p); return r ? `<a class="more" href="${noteHref(r)}">${label} →</a>` : ""; };
export default function (sub = "actions") {
  const v = V.plan, p = plan(), acts = p?.actions || [], done = acts.filter(a => a.done).length;
  const reviews = p?.reviews || [], nextRev = reviews.flatMap(r => r.next.filter(n => !n.done).slice(0, 1).map(n => ({ ...n, title: r.title, detail: r.detail, checklist: r.checklist }))).sort((a, b) => a.date.localeCompare(b.date))[0];
  const domains = notesWhere(v.domains).filter(r => !/index\.md$/.test(r.origin.source_path)), learn = notesWhere(v.learning_notes).filter(r => !/index\.md$/.test(r.origin.source_path));
  const ltasks = openTasks().filter(t => (v.learning_tasks?.["title~"] || []).some(k => String(t.title).includes(k)) && !/^(X|Blibli|Register)$/.test(t.owner));
  const lede = acts.length ? `${acts.length} 项行动，已完成 <b>${done}</b>。${nextRev ? `下一次复盘：<b>${esc(nextRev.date.replace(/（.*）/, ""))} · ${esc(nextRev.title)}</b>（${esc(nextRev.detail.split("，")[0])}）。` : ""}` : "";
  const head = header("计划", "", [p?.updated ? `12 个月行动清单 · 更新于 ${esc(p.updated)}` : "计划"], lede) + tabs("plan", [["actions", "行动清单"], ["reviews", "复盘"], ["domains", `生活领域 · ${domains.length}`], ["learning", "学习路线"]], sub);
  if (sub === "reviews") return { html: head + `<div class="body">${reviews.map(r => `<section class="blk"><h2>${esc(r.title)}<span class="more">${esc(r.detail)}</span></h2>
      <div class="hz"><div class="h">清单</div><div class="rows">${r.checklist.map(c => `<div class="prow"><span class="cb"></span><div class="t">${esc(c)}</div><span></span></div>`).join("")}</div></div>
      <div class="hz"><div class="h">下次应执行</div><div class="rows">${r.next.map(n => `<div class="prow ${n.done ? "done" : ""}"><span class="cb ${n.done ? "done" : ""}"></span><div class="t">${esc(n.window)}</div><span class="pill g">${esc(n.date)}</span></div>`).join("")}</div></div></section>`).join("") || `<p class="empty">未找到 life/复盘节奏.md。</p>`}
      <p class="note">${link("life/复盘节奏.md", "打开复盘节奏")}</p></div>` };
  if (sub === "domains") return { html: head + `<div class="body"><section class="blk"><h2>生活领域<span class="more">life/生活拓展</span></h2>${noteList(domains, 99)}</section>
      <section class="blk"><h2>规划笔记</h2>${noteList(notesWhere(v.life_notes).filter(r => !/index\.md$/.test(r.origin.source_path)), 99)}</section></div>` };
  if (sub === "learning") return { html: head + `<div class="body"><section class="blk"><h2>学习路线</h2>${noteList(learn, 99)}</section>
      <section class="blk"><h2>研究课题<span class="more">${ltasks.length} 项 · 无截止日</span></h2><div class="rows">${ltasks.map(t => `<div class="prow"><span class="cb"></span><div><div class="t">${esc(t.title)}</div></div><span class="pill g">${esc(t.owner === "user" ? "我" : t.owner)}</span></div>`).join("")}</div></section></div>` };
  const groups = [...new Set(acts.map(a => a.horizon))].sort((a, b) => ORDER(a) - ORDER(b) || a.localeCompare(b));
  const sub2 = { 节点: "无固定日期", 持续: "习惯" };
  const prow = a => `<div class="prow ${a.done ? "done" : ""}"><span class="cb ${a.done ? "done" : ""}"></span><div><div class="t">${esc(a.title)}</div><div class="d">${esc(a.standard)}${a.next ? ` · 下一步：${esc(a.next)}` : ""}</div></div><span class="pill ${a.priority === "P0" && !a.done ? "" : "g"}">${[a.priority, /^\d{4}-\d{2}/.test(a.due) ? `${+a.due.slice(5, 7)} 月` : a.horizon === "节点" ? a.due : ""].filter(Boolean).map(esc).join(" · ") || "—"}</span></div>`;
  // other dated tasks not in the action list (e.g. agent or work deadlines)
  const o = overview(bundle, V.today), other = o.upcoming.filter(u => !acts.some(a => u.name.startsWith(a.title.slice(0, 6))));
  return { html: head + `<div class="body">${acts.length ? groups.map(g => `<div class="hz"><div class="h">${esc(g === "节点" ? "签约节点" : g)}<small>${esc(sub2[g] ?? (/Q4/.test(g) ? "10–12 月" : /上半年/.test(g) ? "1–6 月" : ""))}</small></div><div class="rows">${acts.filter(a => a.horizon === g).map(prow).join("")}</div></div>`).join("")
      : `<p class="empty">未找到 life/12个月行动清单.md。</p>`}
    ${nextRev ? `<div class="hz"><div class="h">下一次复盘</div><a class="review" href="#plan/reviews"><b>${esc(nextRev.title)} · ${esc(nextRev.date.replace(/（.*）/, ""))}</b><p>${nextRev.checklist.slice(0, 4).map(c => esc(c.split(/[：:（]/)[0])).join(" · ")}</p><span class="btn">查看清单</span></a></div>` : ""}
    ${other.length ? `<div class="hz"><div class="h">其他截止<small>任务 / 订阅</small></div><div class="rows">${other.map(u => `<div class="prow"><span class="cb"></span><div><div class="t">${esc(u.name)}</div><div class="d">${esc(u.kind)}${u.extra ? ` · ${esc(u.extra)}` : ""}</div></div><span class="pill g">${esc(u.date.slice(5).replace("-", "/"))}</span></div>`).join("")}</div></div>` : ""}
    <p class="note">${link("life/12个月行动清单.md", "打开行动清单原文")}</p></div>` };
}
