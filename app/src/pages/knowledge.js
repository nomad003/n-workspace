// 知识: n-knowledge-base ONLY (general knowledge; personal notes, including mindset, live in n-life-data).
// 领域 is one row per top-level folder (cs, backend, devtools, ai, math, tools). 主题 is the next level
// (backend/network, ai/llm, …). 目录 · 搜索 (kb-index.json) · note page (any root).
// Life notes live under 生活 / 记录 / 计划; the note page still renders them (with a link back to their section).
import { V, records as ALL, byId, v9, kbIndex, lifeIndex, noteBody, notesWhere, choosePrefixes, dirCovers, fallbacks, section, isIndexNote, moduleList, topics } from "../data.js";
import { pageTabs } from "../page-tabs.js";
import { moduleIdsForRecord, routeOfModule } from "../module-model.js";
import { annotateEntry, searchNotes } from "../search-model.js";
import { esc, header, tabs, card, noteList, noteLink, more, box, mainSide, folderBanner } from "../ui.js";
const records = ALL.filter(r => r.root === "kb");
const T = sub => tabs("knowledge", pageTabs(section("knowledge"), "knowledge"), sub);
const searchBox = (q = "") => `<form class="kbsearch" onsubmit="location.hash='#knowledge/search?q='+encodeURIComponent(this.q.value);return false"><input name="q" value="${esc(q)}" placeholder="搜索标题、标签与正文…" autocomplete="off"></form>`;
const md = d => String(d ?? "").slice(5).replace("-", "/");
const DOMAIN_ORDER = ["cs", "backend", "devtools", "ai", "math", "tools"];
const byOrder = (a, b) => { const rank = n => { const i = DOMAIN_ORDER.indexOf(String(n).split("/")[0]); return i < 0 ? 99 : i; }; return rank(a.k) - rank(b.k) || a.k.localeCompare(b.k); };
const group = (rs, depth) => { const g = {}; for (const r of rs) { if (isIndexNote(r)) continue; const k = r.origin.source_path.split("/").slice(0, depth).join("/"); (g[k] ||= []).push(r); }
  return Object.entries(g).filter(([k]) => k && !/\.md$/.test(k)).map(([k, xs]) => ({ k, name: k.split("/").pop(), xs, last: xs.map(x => x.updated).filter(Boolean).sort().at(-1) })).sort(byOrder); };
const kbNotes = v => notesWhere(v.topics).filter(r => r.root === "kb");
function topicGroups(v) {
  const g = {};
  for (const r of kbNotes(v)) { if (isIndexNote(r)) continue; const parts = r.origin.source_path.split("/"); const k = parts.length > 2 ? parts.slice(0, 2).join("/") : parts[0]; if (!k || /\.md$/i.test(k)) continue; (g[k] ||= []).push(r); }
  return Object.entries(g).map(([k, xs]) => ({ k, name: k.split("/").pop(), xs, last: xs.map(x => x.updated).filter(Boolean).sort().at(-1) })).sort(byOrder);
}
function kbFolderIndex(dir) {
  const rel = String(dir || "").replace(/^kb\/?/, "").replace(/\/$/, "");
  const re = rel ? new RegExp(`^${rel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/(index|README)\\.md$`, "i") : /^(index|README)\.md$/i;
  return records.find(r => re.test(r.origin.source_path)) || null;
}
export default async function (sub = "home", P = new URLSearchParams()) {
  if (sub === "domains") sub = "home"; // sections.yaml tab id
  const v = V.knowledge, kbN = records.filter(r => !isIndexNote(r)).length;
  const lastU = records.map(r => r.updated).filter(Boolean).sort().at(-1) ?? "";
  const head = (extra = [], lede = "通用知识库：按顶层目录与下一级主题组织。个人、工作与项目笔记在 生活 / 记录。") => header("知识", "", [`n-knowledge-base · ${kbN} 篇`, ...extra], lede, { actions: [["全文搜索", "#knowledge/search", true]],
    kpis: sub === "home" ? [[kbN, "笔记", { tone: "focus" }], [group(kbNotes(v), 1).length, "领域"], [topicGroups(v).length, "主题"], [lastU.slice(5).replace("-", "/") || "—", "最近更新", { sub: esc(lastU) }]] : [] });
  if (sub === "note") return notePage(P.get("id"));
  if (sub === "logs") { location.hash = "#journal"; return { html: "" }; }
  if (!new Set(["home", "topics", "tree", "search"]).has(sub || "home")) return { html: head() + T(sub) + `<div class="body"><p class="empty">「${esc(sub)}」还没有对应的页面。</p></div>` };
  if (sub === "search") return searchPage(P.get("q") || "", head, P);
  if (sub === "tree") return treePage(P, head);
  if (sub === "topics") {
    const topics = topicGroups(v), mocs = records.filter(r => r.type === "moc" && !/^(README|index)\.md$/i.test(r.origin.source_path));
    return { html: head() + T(sub) + `<div class="body">${mocs.length ? `<section class="blk"><h2>MOC<span class="more">${mocs.length}</span></h2>${noteList(mocs, 99)}</section>` : ""}${topics.map(g => `<section class="blk"><h2><a href="#knowledge/tree?root=kb&dir=${encodeURIComponent("kb/" + g.k)}">${esc(g.k)}</a><span class="more">${g.xs.length} 篇 · ${md(g.last)}</span></h2>${noteList(g.xs.sort((a, b) => String(b.updated).localeCompare(String(a.updated))), 8)}</section>`).join("")}</div>` };
  }
  // home (领域): one row per top-level folder. Nested folders (backend/network, ai/llm) are 主题.
  const topics = topicGroups(v), doms = group(kbNotes(v), 1);
  const recent = [...records].filter(r => !/(^|\/)(index|README)\.md$/i.test(r.origin.source_path) && r.type !== "moc").sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
  const row = g => `<a class="row r3" href="#knowledge/tree?root=kb&dir=${encodeURIComponent("kb/" + g.k)}"><span class="t">${esc(g.k)}</span><span class="tag">${g.xs.length} 篇</span><span class="tag">${md(g.last)}</span></a>`;
  return { html: head() + T("home") + `<div class="body">${searchBox()}${mainSide(
    box({ title: "领域", meta: `${doms.length} 个 · 顶层目录`, flush: true, cls: "focus", body: doms.length ? `<div class="rows">${doms.map(row).join("")}</div>` : `<p class="empty">知识库里还没有笔记。</p>` })
    + box({ title: "主题", meta: `${topics.length} 个`, link: ["主题页", "#knowledge/topics"], flush: true, body: topics.length ? `<div class="rows">${topics.map(row).join("")}</div>` : `<p class="empty">没有主题目录。</p>` }),
    box({ title: "最近更新", link: ["目录", "#knowledge/tree"], flush: true, body: noteList(recent, 12) }))}</div>` };
}
async function treePage(P, head) {
  const root = "kb", dir = P.get("dir") || "", area = P.get("area") || "", type = P.get("type") || "", status = P.get("status") || "";
  const pool = records.filter(r => (!root || r.root === root) && (!area || r.area === area) && (!type || r.type === type) && (!status || r.status === status));
  const q = o => "#knowledge/tree?" + new URLSearchParams(Object.entries({ root, dir, area, type, status, ...o }).filter(([, x]) => x)).toString();
  // folder tree (depth ≤ 3) with counts; index.md / README.md are the folder description, not a counted note
  const tree = {}; for (const r of pool) { const parts = [r.root, ...r.origin.source_path.split("/").slice(0, -1)].slice(0, 4); let path = ""; const bump = !isIndexNote(r);
    parts.forEach(p => { path = path ? `${path}/${p}` : p; tree[path] = (tree[path] || 0) + (bump ? 1 : 0); }); }
  const dirs = Object.keys(tree).sort();
  const treeHtml = dirs.map(d => { const depth = d.split("/").length - 1, name = d.split("/").pop();
    return `<a class="tn ${d === dir ? "on" : ""}" style="padding-left:${8 + depth * 14}px" href="${q({ dir: d })}">${depth === 0 ? `<b>${esc(name)}://</b>` : esc(name)}<span>${tree[d]}</span></a>`; }).join("");
  const inDir = (dir ? pool.filter(r => `${r.root}/${r.origin.source_path}`.startsWith(dir + "/")) : pool).filter(r => !isIndexNote(r));
  const idx = dir ? kbFolderIndex(dir) : null;
  const banner = idx ? folderBanner(idx, await noteBody(idx)) : "";
  const facet = (key, label) => { const vals = Object.entries(records.filter(r => !isIndexNote(r)).reduce((a, r) => (r[key] && (a[r[key]] = (a[r[key]] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1]).slice(0, 14);
    const cur = { area, type, status }[key]; return `<div class="filters"><span class="fl">${label}</span><a class="fchip ${!cur ? "on" : ""}" href="${q({ [key]: "" })}">全部</a>${vals.map(([x, n]) => `<a class="fchip ${cur === x ? "on" : ""}" href="${q({ [key]: x })}">${esc(x)} <b>${n}</b></a>`).join("")}</div>`; };
  return { html: head() + T("tree") + `<div class="body">
    ${facet("area", "领域")}${facet("type", "类型")}${facet("status", "状态")}
    <div class="treegrid"><nav class="tree">${treeHtml || `<p class="empty">无</p>`}</nav><div>${banner}${card(`${esc(dir || "全部")} · ${inDir.length} 篇`, noteList(inDir.sort((a, b) => String(b.updated).localeCompare(String(a.updated))), 60) + (inDir.length > 60 ? more(inDir.length - 60, noteList(inDir.slice(60), 9999), "展开其余") : ""), { span: "s12 solo" })}</div></div></div>` };
}
function moduleBadges(ids) {
  const mods = moduleList() || [];
  return (ids || []).map(id => {
    const m = mods.find(x => x.id === id);
    return `<a class="pill mod" href="#${routeOfModule(id)}">${esc(m?.title || (id === "kb" ? "知识" : id))}</a>`;
  }).join("");
}
function citedGroups(notes) {
  const mods = moduleList() || [];
  const order = mods.map(m => m.id);
  const groups = new Map();
  for (const n of notes) {
    let ids = moduleIdsForRecord(mods, n);
    if (!ids.length) ids = [n.root === "kb" ? "kb" : ""];
    const key = ids[0];
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(n);
  }
  const keys = [...groups.keys()].sort((a, b) => (order.indexOf(a) < 0 ? 99 : order.indexOf(a)) - (order.indexOf(b) < 0 ? 99 : order.indexOf(b)));
  return keys.map(k => {
    const title = k ? (mods.find(m => m.id === k)?.title || (k === "kb" ? "知识" : k)) : "未归类";
    const head = k && mods.some(m => m.id === k) ? `<a href="#${routeOfModule(k)}">${esc(title)}</a>` : esc(title);
    return `<div class="cite-g"><h3>${head}</h3><div class="nlist">${groups.get(k).map(x => `<div class="nrow">${noteLink(x)}</div>`).join("")}</div></div>`;
  }).join("");
}
async function notePage(id) {
  const r = byId.get(id);
  if (!r) return { html: header("知识", "", []) + `<div class="body"><p class="empty">未找到笔记：${esc(id)}</p></div>` };
  const [body, kb, life] = await Promise.all([noteBody(r), kbIndex(), lifeIndex()]);
  const ix = (r.root === "life" ? life : kb).find(x => x.id === id) || {};
  const crumbs = [r.root + "://", ...r.origin.source_path.split("/").slice(0, -1)];
  const chips = [r.root === "life" ? "life · 私密" : "kb", r.area && esc(r.area), r.type && esc(r.type), r.status && esc(r.status), r.updated && `更新 ${esc(r.updated)}`];
  const links = ids => ids.map(x => byId.get(x)).filter(Boolean);
  const out = links([...new Set(ix.links || [])]), back = links(ix.backlinks || []);
  const here = moduleIdsForRecord(moduleList() || [], r);
  return { html: `<header class="ph"><div class="ctx">${chips.filter(Boolean).join(" · ")}${here.length ? ` · ${moduleBadges(here)}` : ""}</div><h1>${esc(r.title)}</h1></header>
    <div class="body"><nav class="crumbs">${r.root === "life" ? `<a href="#${lifeSec(r)}">${lifeSec(r).startsWith("journal") ? "记录" : lifeSec(r).startsWith("plan") ? "计划" : "生活"}</a>` : `<a href="#knowledge">知识</a>`}${r.root === "life" ? crumbs.slice(1).map(c => `<span class="sep">/</span><span>${esc(c)}</span>`).join("") : crumbs.map((c, i) => `<span class="sep">/</span><a href="#knowledge/tree?dir=${encodeURIComponent([r.root, ...crumbs.slice(1, i + 1)].join("/"))}">${esc(c)}</a>`).join("")}</nav>
    ${(r.tags || []).length ? `<div class="filters">${r.tags.map(t => `<a class="fchip" href="#knowledge/search?q=${encodeURIComponent(t)}">#${esc(t)}</a>`).join("")}</div>` : ""}
    <article class="md">${body ? body.html : `<p class="empty">正文未加载（运行 npm start 重新构建）</p>`}</article>
    <div class="grid">${card(`被引用 · ${back.length}`, back.length ? citedGroups(back) : `<p class="empty">还没有笔记用 kb://、life:// 或维基链接指向这篇。</p>`, { span: "s6" })}
    ${card(`出链 · ${out.length}`, out.length ? `<div class="nlist">${out.map(x => `<div class="nrow">${noteLink(x)}</div>`).join("")}</div>` : `<p class="empty">无</p>`, { span: "s6" })}</div></div>` };
}
function searchHref(cur, over = {}) {
  const n = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...cur, ...over })) if (v) n.set(k, v);
  const s = n.toString();
  return s ? `#knowledge/search?${s}` : "#knowledge/search";
}
async function searchPage(q, head, P = new URLSearchParams()) {
  const [kb, life] = await Promise.all([kbIndex(), lifeIndex()]);
  const mods = moduleList() || [], tops = topics();
  const entries = [...kb, ...life].map(x => annotateEntry(x, mods, tops));
  const filter = { q, module: P.get("module") || "", topic: P.get("topic") || "", source: P.get("source") || "", from: P.get("from") || "", to: P.get("to") || "" };
  const active = filter.q || filter.module || filter.topic || filter.source || filter.from || filter.to;
  const hits = active ? searchNotes(entries, filter) : [];
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const snip = text => { const lo = String(text || "").toLowerCase(), i = terms.map(w => lo.indexOf(w)).filter(n => n >= 0).sort((a, b) => a - b)[0] ?? 0;
    let sn = esc(String(text || "").slice(Math.max(0, i - 50), i + 110)); for (const w of terms) sn = sn.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), m => `<mark>${m}</mark>`); return (i > 50 ? "…" : "") + sn + (String(text || "").length > i + 110 ? "…" : ""); };
  const opt = (name, value, label) => `<option value="${esc(value)}" ${filter[name] === value ? "selected" : ""}>${esc(label)}</option>`;
  const form = `<form class="sfilters" onsubmit="const p=new URLSearchParams(new FormData(this)); for (const [k,v] of [...p]) if(!v) p.delete(k); location.hash='#knowledge/search?'+p.toString(); return false">
    <input name="q" value="${esc(q)}" placeholder="搜索标题、标签、路径与正文" autocomplete="off">
    <select name="source">${opt("source", "", "全部来源")}${opt("source", "life", "生活")}${opt("source", "kb", "知识库")}</select>
    <select name="module">${opt("module", "", "全部模块")}${mods.map(m => opt("module", m.id, m.title)).join("")}</select>
    <select name="topic">${opt("topic", "", "全部主题")}${tops.map(t => opt("topic", t.id, t.title)).join("")}</select>
    <label>从 <input name="from" type="date" value="${esc(filter.from)}"></label>
    <label>到 <input name="to" type="date" value="${esc(filter.to)}"></label>
    <button class="btn" type="submit">筛选</button>
    ${active ? `<a class="btn" href="#knowledge/search">清除</a>` : ""}
  </form>`;
  const list = hits.slice(0, 50).map(({ entry: x }) => `<div class="hit"><a class="hit-t" href="#knowledge/note?id=${encodeURIComponent(x.id)}">${esc(x.title)}</a><span class="ov-mods">${moduleBadges(x.modules)}</span><span class="m">${esc(x.root)}://${esc(x.path)}${x.date ? ` · ${esc(x.date)}` : ""}</span>${terms.length ? `<p>${snip(x.text || x.title || "")}</p>` : ""}</div>`).join("");
  return { html: head([q ? `“${esc(q)}” · ${hits.length} 条` : active ? `${hits.length} 条` : ""]) + T("search") + `<div class="body">${form}
    ${active ? (hits.length ? `<div class="hits">${list}</div>${hits.length > 50 ? `<p class="note">仅显示前 50 条</p>` : ""}` : `<p class="empty">没有匹配的笔记。</p>`) : `<p class="empty">输入关键词，或按模块、主题、来源和日期筛选。生活和知识库正文都已索引（${entries.length} 篇）。</p>`}</div>` };
}

// which 生活 / 记录 / 计划 tab owns a life note (via data/sections.yaml)
function lifeSec(r) {
  const path = r.origin.source_path, bare = path.replace(/\.md$/i, "");
  for (const s of v9?.sections || []) for (const t of s.tabs || []) for (const u of (Array.isArray(t.source) ? t.source : [])) {
    const d = String(u).replace(/^life:\/\//, "").replace(/[#?].*$/, "");
    if (!d || d.startsWith("data/")) continue;
    const prefs = d.endsWith("/") ? choosePrefixes(d, dirCovers) : [d, ...fallbacks(d)];
    if (prefs.some(p => p.endsWith("/") ? path.startsWith(p) : bare === p.replace(/\.md$/i, "").replace(/\/+$/, ""))) return `${s.id}/${t.id}`;
  }
  return "life";
}
