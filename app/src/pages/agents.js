// Agents (v9): tasks with owner agent:<name> (tasks.yaml), channels (content.yaml owner_agent), agent-ops notes.
import { M, tasks, notesIn, agentName, known } from "../data.js";
import { isOpenTask } from "../core.js";
import { esc, header, noteList } from "../ui.js";
import { taskRow } from "./_tasks.js";
export default function () {
  const ts = tasks().filter(t => /^agent:/.test(t.owner)), ch = M.content?.items || [];
  const names = [...new Set([...ts.map(t => t.owner.slice(6)), ...ch.map(c => String(c.owner_agent ?? "").replace(/^agent:/, "").toLowerCase()).filter(Boolean)])];
  const ag = names.map(n => { const mine = ts.filter(t => t.owner === `agent:${n}`), open = mine.filter(isOpenTask), chans = ch.filter(c => String(c.owner_agent ?? "").replace(/^agent:/, "").toLowerCase() === n);
    return { n, mine, open, chans, run: open.some(t => t.status === "in-progress"), wait: open.some(t => t.status === "waiting") }; }).sort((a, b) => b.open.length - a.open.length);
  const notes = notesIn("agent-ops/").filter(r => !/index\.md$/.test(r.origin.source_path));
  return { html: header("Agents", "", [`${ag.length} 个 agent`, `${ts.filter(isOpenTask).length} 个未完成任务`, "owner: agent:*"], `${ag.filter(a => a.run).length} 个运行中，${ag.filter(a => a.wait).length} 个在等你确认。`) + `<div class="body">
    ${ag.map(a => `<section class="blk"><h2><i class="dot ${a.run ? "on" : ""}"></i> ${esc(agentName(a.n))}<span class="more">${a.run ? "运行中" : a.wait ? "等待确认" : a.open.length ? "排队" : "空闲"} · ${a.open.length} 待办${a.chans.length ? ` · ${a.chans.map(c => esc(c.platform)).join("、")}` : ""}</span></h2>
      <div class="rows">${a.mine.map(t => taskRow(t)).join("")}</div>
      ${a.chans.map(c => { const s = (c.snapshots || []).at?.(-1); return `<p class="note">${esc(c.platform)} ${esc(c.handle ?? "")} · ${esc(c.stage ?? "")}${s ? ` · 关注 ${esc(s.following ?? "—")} / 粉丝 ${esc(s.followers ?? "—")}（${esc(s.date ?? "")}）` : ""}${known(c.next) ? ` · 下一步：${esc(Array.isArray(c.next) ? c.next[0] : c.next)}` : ""}</p>`; }).join("")}</section>`).join("")}
    <section class="blk"><h2>agent-ops 笔记<span class="more">life://agent-ops/</span></h2>${noteList(notes, 99)}</section></div>` };
}
