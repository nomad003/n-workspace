// Agents: one row per agent (status, open tasks, channel), X snapshot, agent-ops notes.
import { V, M, notesWhere, AGENTS, agentState, stageOf, known } from "../data.js";
import { esc, header, noteList, more } from "../ui.js";
const NAME = a => a === "Blibli" ? "Bilibili" : a;
export default function () {
  const ags = AGENTS.map(agentState), active = ags.filter(a => a.tasks.length || a.channels.length), idle = ags.filter(a => !active.includes(a));
  const notes = notesWhere(V.agents.agent_notes).filter(r => !/index\.md$/.test(r.origin.source_path));
  const ch = M.content?.items || [];
  return { html: header("Agents", "", [`${AGENTS.length} 个 agent`, `${active.length} 个有任务或渠道`], `${ags.filter(a => a.label === "运行中").length} 个运行中，${ags.reduce((n, a) => n + a.tasks.length, 0)} 个任务。`) + `<div class="body">
    <section class="blk"><h2>状态</h2><div class="rows">${active.map(a => `<div class="agrow"><div class="an"><i class="dot ${a.label === "运行中" ? "on" : ""}"></i><b>${esc(NAME(a.name))}</b><span class="s">${esc(a.label)}</span></div>
      <div class="at">${a.tasks.map(t => `<div>${esc(t.title)}<span class="s">${esc(t.status)}${known(t.due) ? ` · ${esc(t.due)}` : ""}</span></div>`).join("")}${a.channels.map(c => `<div>${esc(c.platform)}<span class="s">${esc(c.stage ?? "")}</span></div>`).join("")}</div></div>`).join("")}</div>
      ${idle.length ? `<p class="note">空闲：${idle.map(a => esc(NAME(a.name))).join("、")}</p>` : ""}</section>
    ${ch.length ? `<section class="blk"><h2>渠道</h2><div class="rows">${ch.map(c => { const s = (c.snapshots || []).at?.(-1);
        return `<div class="row r3"><span class="t">${esc(c.platform)}<span class="s">${esc([c.owner_agent, c.stage].filter(known).join(" · "))}</span></span><span class="tag">${s ? `${esc(s.date)} · 帖 ${s.posts ?? "—"} · 粉 ${s.followers ?? "—"} · 关注 ${s.following ?? "—"}` : "无快照"}</span><span class="tag">${(c.snapshots || []).length} 次</span></div>`; }).join("")}</div></section>` : ""}
    <section class="blk"><h2>运营笔记<span class="more">agent-ops</span></h2>${noteList(notes, 10)}</section></div>` };
}
