// Shared task row + due label for 今天 / 计划 / Agents (v9 tasks.yaml).
import { dueEnd, daysUntil } from "../core.js";
import { esc } from "../ui.js";
import { agentName } from "../data.js";
const plainW = v => String(v ?? "").replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2");
export function dueLabel(t) {
  if (t.recurrence) return /WEEKLY/.test(t.recurrence) ? "每周" : /MONTHLY/.test(t.recurrence) ? "每月" : "重复";
  if (t.due_event) return t.due_event;
  const s = String(t.due ?? ""); let m;
  if ((m = s.match(/^\d{4}-(\d{2})-(\d{2})$/))) return `${+m[1]}/${+m[2]}`;
  if ((m = s.match(/^\d{4}-(\d{2})$/))) return `${+m[1]} 月`;
  if ((m = s.match(/^(\d{4})-Q(\d)$/))) return `${m[1]} Q${m[2]}`;
  if ((m = s.match(/^(\d{4})-H(\d)$/))) return `${m[1]} ${m[2] === "1" ? "上" : "下"}半年`;
  return s || "无日期";
}
export const late = t => { const e = dueEnd(t.due); return e && daysUntil(e) < 0 && !["done", "canceled"].includes(t.status); };
export const owner = t => t.owner && t.owner !== "user" ? `<span class="pill g">${esc(agentName(t.owner))}</span>` : "";
export const taskRow = (t, { detail = true } = {}) => `<div class="prow ${t.status === "done" ? "done" : ""}" data-task="${esc(t.id)}"><span class="cb ${t.status === "done" ? "done" : ""}"></span>
  <div><div class="t">${esc(plainW(t.title))}</div>${detail ? `<div class="d">${[plainW(t.standard), t.status === "in-progress" ? "进行中" : t.status === "waiting" ? "等待中" : "", t.done_at && /^\d{4}/.test(t.done_at) ? `完成于 ${t.done_at}` : ""].filter(Boolean).map(esc).join(" · ")}</div>` : ""}</div>
  <span class="pr">${owner(t)}<span class="pill ${t.priority === "P0" && t.status !== "done" ? "" : "g"} ${late(t) ? "late" : ""}">${esc([t.priority, dueLabel(t)].filter(Boolean).join(" · "))}</span></span></div>`;
