// 工作与内容: work reports, 内容运营, agent operations.
import { V, M, notesWhere, tasks, isAgentTask, stageOf, AGENTS, agentState, isLifeTask, noteBody } from "../data.js";
import { esc, header, tabs, table, more, card, fmt, kpis, pending, countUnknown, noteList, badge, noteHref } from "../ui.js";
import { flow } from "../charts.js";
export default async function (sub = "reports") {
  const v = V.workcontent, reports = notesWhere(v.reports), ch = M.content?.items || [], cn = notesWhere(v.content_notes), an = notesWhere(v.agent_notes);
  const agentTasks = tasks().filter(isAgentTask);
  const t = tabs("workcontent", [["reports", "工作汇报", reports.length], ["content", "内容运营", ch.length], ["agents", "Agent 运营", agentTasks.length]], sub);
  const head = header("工作与内容", "coding", [`${reports.length} 份汇报`, `${ch.length} 个渠道`]) + t;
  if (sub === "content") {
    return { html: head + `<div class="body">${pending(countUnknown(ch), "内容渠道")}<div class="grid">${ch.map(c => { const last = (c.snapshots || []).at?.(-1) || {};
      const kv = ["handle", "url", "stage", "positioning", "rules"].map(k => [k, k === "url" && c.url && /^https?:/.test(c.url) ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.url)}</a>` : fmt(c[k])]).filter(([, h]) => h);
      return card(`${esc(c.platform)} <span class="chip L-coding">${esc(c.owner_agent ?? "")}</span>`, `${["posts", "followers", "following"].some(k => last[k] != null) ? kpis(["posts", "followers", "following"].filter(k => last[k] != null).map(k => [last[k], `${k} · ${esc(last.date ?? "")}`])) : ""}
        <dl class="kv">${kv.map(([k, h]) => `<dt>${k}</dt><dd>${h}</dd>`).join("")}</dl>${Array.isArray(c.next) && c.next.length ? `<h4 class="subh">下一步</h4><ol class="steps-l">${c.next.map(n => `<li>${esc(n)}</li>`).join("")}</ol>` : ""}`, { span: "s6" }); }).join("")}</div>
      ${cn.length ? card("运营笔记", noteList(cn, 10), { span: "s12 solo" }) : ""}</div>` };
  }
  if (sub === "agents") {
    const ags = AGENTS.map(agentState);
    const mods = [["work", "工作"], ["life", "生活"], ["content", "内容运营"]];
    const edges = {}; for (const x of agentTasks) { const k = `${x.owner}>${isLifeTask(x) ? "life" : "work"}`; edges[k] = (edges[k] || 0) + 1; }
    for (const c of ch) if (c.owner_agent) edges[`${c.owner_agent}>content`] = (edges[`${c.owner_agent}>content`] || 0) + 1;
    const E = Object.entries(edges).map(([k, n]) => { const [from, to] = k.split(">"); return { from, to, v: n }; });
    return { html: head + `<div class="body"><div class="grid">${card("Agents", `<div class="tbl"><table><thead><tr><th>agent</th><th>状态</th><th>任务</th><th>渠道</th></tr></thead><tbody>${ags.map(a => `<tr><td class="t">${esc(a.name)}</td><td>${badge(a.label)}</td><td class="num">${a.tasks.length || ""}</td><td>${a.channels.map(c => esc(c.platform)).join(", ")}</td></tr>`).join("")}</tbody></table></div>`, { span: "s5" })}
      ${card("Agent → 模块", flow(ags.map(a => ({ id: a.name, label: a.name, n: E.filter(e => e.from === a.name).reduce((s, e) => s + e.v, 0) || "", active: E.some(e => e.from === a.name) })), mods.map(([id, label], i) => ({ id, label, c: ["coding", "infra", "tui"][i], n: E.filter(e => e.to === id).reduce((s, e) => s + e.v, 0) || "" })), E), { span: "s7" })}</div>
      ${card("Agent 运营笔记", noteList(an, 10), { span: "s12 solo", right: `${an.length}` })}
      ${more(agentTasks.length, table(agentTasks, ["id", "title", "owner", "status", "notes"]), "展开 Agent 任务")}</div>` };
  }
  const latest = reports.find(r => !/README/i.test(r.title)), body = latest ? await noteBody(latest) : null;
  return { html: head + `<div class="body"><div class="grid">${card("工作汇报", noteList(reports, 12), { span: "s4", right: `${reports.length}` })}
    ${card(latest ? `最新 · ${esc(latest.title)}` : "最新", body ? `<article class="md clip">${body.html}</article><p class="note"><a href="${noteHref(latest)}">打开全文 →</a></p>` : `<p class="empty">无汇报</p>`, { span: "s8" })}</div></div>` };
}
