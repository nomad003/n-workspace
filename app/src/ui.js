// Shared UI helpers (lean v7): one-line headers, hidden placeholders, collapsible full tables.
import { known, daysUntil, nextRenewal } from "./core.js";
export { known };
export const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const STATUS = [
  [/^(active|open|在册)$/i, "agent"], [/in-progress|doing|进行/i, "coding"], [/pending|待|trial|疑似|暂停|pause/i, "modes"],
  [/done|published|evergreen|one-time|预充值/i, "ai"], [/refund|at_risk|失败|overdue/i, "err"], [/cancel|closed|archived|to-close/i, "infra"], [/draft|idea|stub/i, "infra"],
];
export const tone = v => (STATUS.find(([re]) => re.test(String(v ?? ""))) || [0, "infra"])[1];
export const badge = v => v == null || v === "" ? "" : `<span class="sd L-${tone(v)}">${esc(v)}</span>`;
export const riskC = r => ({ P0: "err", P1: "modes", P2: "agent", P3: "ext", P4: "infra" })[String(r).toUpperCase()] || "infra";
export const urg = d => d == null ? "infra" : d <= 7 ? "err" : d <= 30 ? "modes" : d <= 90 ? "agent" : "ai";
export const cd = (date, approx) => { const n = daysUntil(date); if (n == null) return "";
  return `<span class="cd L-${urg(n)}">${approx ? "<small>约</small>" : ""}${n < 0 ? `逾期 ${-n}` : n === 0 ? "今天" : n}<small>${n === 0 ? "" : "天"}</small></span>`; };
export const noteHref = r => `#kb/note?id=${encodeURIComponent(r.id)}`;
export const noteLink = r => r ? `<a class="nl" href="${noteHref(r)}">${esc(r.title)}</a>${r.root === "life" ? `<span class="rt">life</span>` : ""}` : "";

// Placeholder values (待补充/待确认/不适用…) are hidden; pages show "N 项待补充" instead.
export function countUnknown(x, skip = new Set(["notes", "privacy", "kind", "name", "source", "sources", "id"]), k = "") {
  if (skip.has(k)) return 0;
  if (Array.isArray(x)) return x.reduce((a, y) => a + countUnknown(y, skip), 0);
  if (x && typeof x === "object") return Object.entries(x).reduce((a, [kk, y]) => a + countUnknown(y, skip, kk), 0);
  return x == null || known(x) ? 0 : 1;
}
export const pending = (n, what = "") => n ? `<div class="pend"><b>${n}</b> 项待补充${what ? ` · ${esc(what)}` : ""}<span>（已隐藏，详见 <a href="#sources">数据源</a>）</span></div>` : "";
export const fmt = v => {
  if (v == null || v === "") return "";
  if (typeof v === "boolean") return badge(v ? "是" : "否");
  if (Array.isArray(v)) return v.filter(x => typeof x === "object" || known(x)).map(x => `<span class="tag">${x && typeof x === "object" ? esc(Object.entries(x).filter(([, y]) => known(y)).map(([k, y]) => `${k}: ${y}`).join(" · ")) : esc(x)}</span>`).join("");
  if (typeof v === "object") { const e = Object.entries(v).filter(([, x]) => typeof x === "object" ? x && Object.keys(x).length : known(x));
    return e.length ? `<dl class="kv">${e.map(([k, x]) => `<dt>${esc(k)}</dt><dd>${fmt(x)}</dd>`).join("")}</dl>` : ""; }
  return known(v) ? esc(v) : "";
};
const BADGE = new Set(["status", "two_fa", "stage"]);
export function cell(r, c) {
  const v = r[c];
  if (c === "title" && r.id && r.root) return noteLink(r);
  if (c === "risk" && known(v)) return `<span class="chip L-${riskC(v)}">${esc(v)}</span>`;
  if (BADGE.has(c) && known(v)) return badge(v);
  if (c === "renew_date" && v != null) { const n = nextRenewal(r); return n ? `${esc(n.date)} ${cd(n.date, n.approx)}` : ""; }
  if (c === "url" && known(v)) return `<a href="${esc(v)}" target="_blank" rel="noopener">${esc(String(v).replace(/^https?:\/\//, ""))}</a>`;
  if (c === "owner" || c === "owner_agent") return known(v) ? `<span class="chip L-${/^user$/i.test(v) ? "infra" : "coding"}">${esc(v)}</span>` : "";
  if (c === "path") return `<span class="mono sm">${esc(v)}</span>`;
  return fmt(v);
}
const NUM = new Set(["amount", "balance", "value"]), WRAP = new Set(["notes", "purpose", "login_method", "snapshots", "next", "rules"]);
// Columns whose values are all placeholders are dropped.
export function table(rows, cols, { rowClass = () => "" } = {}) {
  if (!rows.length) return `<p class="empty">无数据</p>`;
  const cs = cols.filter(c => rows.some(r => c === "title" || (typeof r[c] === "object" ? r[c] != null : known(r[c]))));
  return `<div class="tbl"><table><thead><tr>${cs.map(c => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr class="${rowClass(r)}">${cs.map((c, i) =>
    `<td class="${i === 0 ? "t" : ""} ${NUM.has(c) && known(r[c]) ? "num" : ""} ${WRAP.has(c) ? "wrap" : ""}">${cell(r, c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
export const more = (n, inner, label = "展开全部") => `<details class="more"><summary>${label} <b>${n}</b></summary>${inner}</details>`;
export const card = (title, body, { span = "s6", right = "", cls = "" } = {}) => `<section class="card ${span} ${cls}"><h3>${title}${right ? `<span class="r">${right}</span>` : ""}</h3>${body}</section>`;
export const stat = (n, k, { unit = "", warn = false, href = "" } = {}) => `<${href ? `a href="${href}"` : "div"} class="stat ${warn ? "warn" : ""}"><div class="n">${n}${unit ? `<small>${unit}</small>` : ""}</div><div class="k">${k}</div></${href ? "a" : "div"}>`;
export const kpis = rows => `<div class="stats">${rows.map(r => stat(...r)).join("")}</div>`;
// One-line page header: title + inline meta chips.
export const header = (title, color, chips = []) => `<header class="ph L-${color}"><h1>${title}</h1>${chips.filter(Boolean).map(c => `<span class="hchip">${c}</span>`).join("")}<span class="sp"></span><button class="btn sm" data-cmdk>⌘K 搜索</button></header>`;
export const tabs = (base, list, active) => `<nav class="tabs">${list.map(([id, label, n]) => `<a href="#${base}/${id}" class="${id === active ? "on" : ""}">${esc(label)}${n != null && n !== "" ? `<b>${n}</b>` : ""}</a>`).join("")}</nav>`;
export const steps = rows => `<div class="steps">${rows.map(r => `<div class="step L-${r.c}"><div class="n">${r.n}</div><div class="k">${esc(r.k)}</div></div>`).join("")}</div>`;
export const urow = (date, approx, title, meta, extra = "") => `<div class="urow L-${urg(daysUntil(date))}">${cd(date, approx)}<div><b>${title}</b><span class="m">${meta}</span></div><span class="m x">${extra}</span></div>`;
export const noteList = (rs, n = 8) => rs.length ? `<div class="nlist">${rs.slice(0, n).map(r => `<a class="nrow" href="${noteHref(r)}"><span class="t">${esc(r.title)}</span>${r.root === "life" ? `<span class="rt">life</span>` : ""}<span class="m">${esc(r.origin?.source_path?.replace(/\/[^/]*$/, "") || "")}</span><span class="d">${esc(r.updated || "")}</span></a>`).join("")}</div>` : `<p class="empty">无笔记</p>`;
