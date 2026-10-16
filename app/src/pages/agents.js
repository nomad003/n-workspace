// Agents (v9): tasks with owner agent:<name> (tasks.yaml), channels (content.yaml owner_agent; numbers from the topic log via channelStats), agent-ops notes.
import { M, tasks, notesIn, agentName, known, channelStats } from "../data.js";
import { isOpenTask } from "../core.js";
import { esc, header, noteList, box, mainSide } from "../ui.js";
import { taskRow } from "./_tasks.js";
export default function () {
  const ts = tasks().filter(t => /^agent:/.test(t.owner)), ch = M.content?.items || [];
  const names = [...new Set([...ts.map(t => t.owner.slice(6)), ...ch.map(c => String(c.owner_agent ?? "").replace(/^agent:/, "").toLowerCase()).filter(Boolean)])];
  const ag = names.map(n => { const mine = ts.filter(t => t.owner === `agent:${n}`), open = mine.filter(isOpenTask), chans = ch.filter(c => String(c.owner_agent ?? "").replace(/^agent:/, "").toLowerCase() === n);
    return { n, mine, open, chans, run: open.some(t => t.status === "in-progress"), wait: open.some(t => t.status === "waiting") }; }).sort((a, b) => b.open.length - a.open.length);
  const notes = notesIn("agent-ops/").filter(r => !/index\.md$/.test(r.origin.source_path));
  const openN = ts.filter(isOpenTask).length;
  const cards = ag.map(a => box({ title: `<i class="dot ${a.run ? "on" : ""}"></i> ${esc(agentName(a.n))}`, meta: `<span class="pill ${a.run ? "accent" : a.wait ? "warn" : ""}">${a.run ? "运行中" : a.wait ? "等待确认" : a.open.length ? "排队" : "空闲"}</span>`, flush: true,
    body: a.mine.length ? `<div class="rows">${a.mine.map(t => taskRow(t)).join("")}</div>` : `<p class="empty" style="padding:16px">没有任务</p>`,
    footer: [`${a.open.length} 待办 / ${a.mine.length} 总计`, ...a.chans.map(c => { const s = channelStats(c); return `${esc(c.platform)} ${esc(c.handle ?? "")} · ${esc(c.stage ?? "")}${s ? ` · 关注 ${esc(s.following ?? "—")} / 粉丝 ${esc(s.followers ?? "—")}${s.date ? ` <span class="s" title="${esc(s.source)}">${esc(String(s.date).slice(5))}${s.topic ? ` · <a href="#topics/${esc(s.topic)}">主题</a>` : ""}</span>` : ""}` : ""}${known(c.next) ? ` · 下一步：${esc(Array.isArray(c.next) ? c.next[0] : c.next)}` : ""}`; })].join("<br>") })).join("");
  const side = box({ title: "概况", body: `<dl class="mini-kv">${ag.map(a => `<dt>${esc(agentName(a.n))}</dt><dd>${a.open.length}</dd>`).join("")}</dl>` })
    + box({ title: "agent-ops 笔记", meta: "life://agent-ops/", flush: true, body: noteList(notes, 99) });
  return { html: header("Agents", "", [`${ag.length} 个 agent`, "owner: agent:*"], `${ag.filter(a => a.run).length} 个运行中，${ag.filter(a => a.wait).length} 个在等你确认。`,
    { kpis: [[ag.length, "Agents"], [openN, "未完成任务", { tone: "focus" }], [ag.filter(a => a.run).length, "运行中"], [ag.filter(a => a.wait).length, "等你确认", { tone: ag.some(a => a.wait) ? "warn" : "" }]] })
    + `<div class="body">${mainSide(cards, side)}</div>` };
}
