// 生活 / 记录 (v9): tabs come from data/sections.yaml; each tab mirrors its life:// folder(s): subfolders, notes, attachments, counts, last update.
// A source naming a single note is pinned above the folder groups. life:// only — never KB.
// The folder's own index.md / README.md is the description at the top, not a row. Notes owned by a more specific tab of this same section are left out, with a 另见 hint.
import { section, filesIn, findLifeNote, M, v9, listedNotes, isIndexNote, folderIntro } from "../data.js";
import { esc, header, tabs, noteHref, box, mainSide, more, seeAlso } from "../ui.js";
const md = d => String(d ?? "").slice(0, 10);
const kb = n => n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
const pinOf = u => { const p = String(u).replace(/^life:\/\//, "").replace(/[#?].*$/, ""); return /^life:\/\//.test(u) && !p.endsWith("/") && !p.startsWith("data/") ? findLifeNote(p) || { missing: p } : null; };
const last = xs => xs.map(r => r.updated).filter(Boolean).sort().at(-1);
export async function folderPage(secId, title, sub, P) {
  const S = section(secId);
  if (!v9 || !S) return { html: header(title, "", [], "需要 n-life-data schema_version 9 的 data/sections.yaml。") };
  const T = (S.tabs || []).map(t => { const sources = Array.isArray(t.source) ? t.source : [], pins = sources.map(pinOf).filter(Boolean), listed = listedNotes(secId, t.id);
    const files = listed.dirs.flatMap(filesIn).filter(f => !listed.nestedDirs.some(d => f.path.startsWith(d)));
    return { ...t, pins, ...listed, files, missing: listed.dirs.filter(d => (v9.missing_dirs || []).includes(d)), last: last(listed.notes) }; });
  if (!T.length) return { html: header(title, "", [], "data/sections.yaml 里这个页面没有分页。") };
  const cur = T.find(t => t.id === sub) || T[0];
  const total = T.reduce((n, t) => n + t.notes.length, 0), allLast = T.map(t => t.last).filter(Boolean).sort().at(-1);
  const head = header(title, "", [`${T.length} 个目录`, "data/sections.yaml"], secId === "journal" ? "日记、周记与工作记录，按时间倒序。" : "生活各领域的笔记与附件，镜像 life:// 目录。", {
    kpis: [[total, "全部笔记"], [cur.notes.length, `当前 · ${esc(cur.label)}`, { tone: "focus" }], [cur.files.length, "附件"], [md(allLast).slice(5).replace("-", "/") || "—", "最近更新", { sub: esc(md(allLast)) }]] })
    + tabs(secId, T.map(t => [t.id, t.label, t.notes.length || ""]), cur.id);
  // group by the first path segment below the tab folder (journal/daily/2026/05 → "2026/05"; work/reports/2026-06 → "2026-06")
  const big = cur.notes.length > 60; // large trees (work/projects): one box per top subfolder, first rows + 展开
  const groups = {}; for (const r of cur.notes) { const d = cur.dirs.find(x => r.origin.source_path.startsWith(x)) ?? "", rel = r.origin.source_path.slice(d.length).split("/").slice(0, -1);
    const k = secId === "journal" && cur.id === "daily" ? rel.slice(0, 2).join("/") : big ? rel.slice(0, 1).join("/") : rel.join("/"); (groups[k] ||= []).push(r); }
  for (const f of cur.files) { const d = cur.dirs.find(x => f.path.startsWith(x)) ?? "", rel = f.path.slice(d.length).split("/"); const k = rel.slice(0, -1).filter(x => !/\.assets$/.test(x)).slice(0, big ? 1 : 99).join("/"); (groups[k] ||= []); }
  const keys = Object.keys(groups).sort((a, b) => a === "" ? -1 : b === "" ? 1 : secId === "journal" ? b.localeCompare(a) : a.localeCompare(b));
  const filesOf = k => cur.files.filter(f => { const d = cur.dirs.find(x => f.path.startsWith(x)) ?? ""; return f.path.slice(d.length).split("/").slice(0, -1).filter(x => !/\.assets$/.test(x)).slice(0, big ? 1 : 99).join("/") === k; });
  const nrow = r => `<a class="row r3" href="${noteHref(r)}"><span class="t">${esc(r.title)}${r.type && r.type !== "note" ? `<span class="s">${esc(r.type)}</span>` : ""}</span><span class="tag">${esc(r.status ?? "")}</span><span class="tag">${esc(md(r.updated))}</span></a>`;
  const frow = f => `<a class="row r3 file" target="_blank" rel="noopener" href="../files/life/${f.path.split("/").map(encodeURIComponent).join("/")}"><span class="t">${esc(f.path.split("/").pop())}<span class="s">${esc(f.path.split(".").pop().toUpperCase())}</span></span><span class="tag">附件</span><span class="tag">${kb(f.size)}</span></a>`;
  const extra = secId === "life" && cur.id === "finance" && M.finance?.summary ? `<p class="note">data/finance.yaml：${M.finance.items?.length ?? 0} 条记录，已填金额 ${M.finance.summary.filled}/${M.finance.summary.total}（明细在原文，不在此处展示金额）。</p>`
    : secId === "life" && cur.id === "profile" ? `<p class="note">data/profile.yaml：证件 ${(M.profile?.data?.documents || []).length} 项（只显示到期提醒，号码不展示）。</p>` : "";
  const blocks = keys.map(k => { const xs = (groups[k] || []).sort((a, b) => String(b.updated).localeCompare(String(a.updated))), fs = filesOf(k);
    return xs.length || fs.length ? box({ title: esc(k || cur.label), meta: `${xs.length} 篇${fs.length ? ` · ${fs.length} 个附件` : ""}${last(xs) ? ` · ${esc(md(last(xs)))}` : ""}`, flush: true, body: big && xs.length + fs.length > 12 ? `<div class="rows">${xs.slice(0, 10).map(nrow).join("")}</div>` + more(Math.max(0, xs.length - 10) + fs.length, `<div class="rows">${xs.slice(10).map(nrow).join("")}${fs.map(frow).join("")}</div>`, "展开其余") : `<div class="rows">${xs.map(nrow).join("")}${fs.map(frow).join("")}</div>` }) : ""; }).join("");
  const pinRows = cur.pins.filter(p => p.missing || (p.id && !isIndexNote(p) && !cur.notes.some(n => n.id === p.id)));
  const pinned = pinRows.length ? box({ title: "索引", meta: "MOC · data/sections.yaml", cls: "focus", flush: true, body: `<div class="rows">${pinRows.map(p => p.missing ? `<div class="row r3"><span class="t">life://${esc(p.missing)}</span><span class="tag">未找到</span><span class="tag"></span></div>` : nrow(p)).join("")}</div>` }) : "";
  const intro = await folderIntro(cur.dirs);
  const main = intro + seeAlso(secId, cur.see) + pinned + (cur.missing.length && !cur.notes.length && !intro ? box({ title: esc(cur.label), body: `<p class="empty">${cur.missing.map(d => `life://${esc(d)}`).join("、")} 目录还不存在。</p>` }) : "") + blocks;
  const side = box({ title: "目录", body: `<dl class="mini-kv"><dt>来源</dt><dd>${cur.dirs.map(d => `<span class="mono sm">life://${esc(d)}</span>`).join("<br>")}</dd><dt>笔记</dt><dd>${cur.notes.length}</dd><dt>附件</dt><dd>${cur.files.length}</dd><dt>最近更新</dt><dd>${esc(md(cur.last)) || "—"}</dd></dl>`, footer: extra.replace(/<\/?p[^>]*>/g, "") })
    + box({ title: `全部${title}目录`, flush: true, body: `<div class="rows">${T.map(t => `<a class="row r2" href="#${secId}/${t.id}"${t.id === cur.id ? ' style="background:var(--accent-soft)"' : ""}><span class="t">${esc(t.label)}</span><span class="tag">${t.notes.length}</span></a>`).join("")}</div>` });
  return { html: head + `<div class="body">${mainSide(main || box({ title: esc(cur.label), body: `<p class="empty">空</p>` }), side)}</div>` };
}
export const life = (sub, P) => folderPage("life", "生活", sub, P);
export const journal = (sub, P) => folderPage("journal", "记录", sub, P);
