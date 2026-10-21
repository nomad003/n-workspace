// 知识: n-knowledge-base ONLY (general knowledge; since the 2026-10 separation all personal/work notes live in n-life-data).
// 领域 (from 00-MOC: each MOC + the notes it links to) · 主题 (top folders) · 目录 · 搜索 (kb-index.json) · note page (any root).
// Life notes live under 生活 / 记录 / 计划; the note page still renders them (with a link back to their section).
import { V, records as ALL, byId, v9, kbIndex, noteBody, notesWhere, match, choosePrefixes, dirCovers, fallbacks } from "../data.js";
import { esc, header, tabs, card, noteList, noteLink, noteHref, badge, more, box, mainSide } from "../ui.js";
const MC = { stub: "infra", learning: "agent", evolving: "coding", evergreen: "ai" };
const records = ALL.filter(r => r.root === "kb");
const T = sub => tabs("knowledge", [["home", "领域"], ["topics", "主题"], ["tree", "目录"], ["search", "搜索"]], sub);
const searchBox = (q = "") => `<form class="kbsearch" onsubmit="location.hash='#knowledge/search?q='+encodeURIComponent(this.q.value);return false"><input name="q" value="${esc(q)}" placeholder="搜索标题、标签与正文…" autocomplete="off"></form>`;
const md = d => String(d ?? "").slice(5).replace("-", "/");
const group = (rs, depth) => { const g = {}; for (const r of rs) { const k = r.origin.source_path.split("/").slice(0, depth).join("/"); (g[k] ||= []).push(r); }
  return Object.entries(g).filter(([k]) => !/\.md$/.test(k)).map(([k, xs]) => ({ k, name: k.split("/").pop(), xs, last: xs.map(x => x.updated).filter(Boolean).sort().at(-1) })).sort((a, b) => String(b.last).localeCompare(String(a.last))); };
export default async function (sub = "home", P = new URLSearchParams()) {
  if (sub === "domains") sub = "home"; // sections.yaml tab id
  const v = V.knowledge, kbN = records.filter(r => r.root === "kb").length;
  const mocN = records.filter(r => r.type === "moc").length, lastU = records.map(r => r.updated).filter(Boolean).sort().at(-1) ?? "";
  const head = (extra = [], lede = "通用知识库：按领域（MOC）与主题组织。个人、工作与项目笔记在 生活 / 记录。") => header("知识", "", [`n-knowledge-base · ${kbN} 篇`, ...extra], lede, { actions: [["全文搜索", "#knowledge/search", true]],
    kpis: sub === "home" ? [[kbN, "笔记", { tone: "focus" }], [domainMocs().length, "领域"], [group(notesWhere(v.topics).filter(r => r.root === "kb"), 1).length, "主题"], [mocN, "MOC"], [lastU.slice(5).replace("-", "/") || "—", "最近更新", { sub: esc(lastU) }]] : [] });
  if (sub === "note") return notePage(P.get("id"));
  if (sub === "search") return searchPage(P.get("q") || "", head);
  if (sub === "tree") return treePage(P, head);
  if (sub === "topics") {
    const topics = group(notesWhere(v.topics).filter(r => r.root === "kb"), 1), mocs = records.filter(r => r.type === "moc");
    return { html: head() + T(sub) + `<div class="body"><section class="blk"><h2>MOC<span class="more">${mocs.length}</span></h2>${noteList(mocs, 99)}</section>${topics.map(g => `<section class="blk"><h2><a href="#knowledge/tree?root=kb&dir=${encodeURIComponent("kb/" + g.k)}">${esc(g.name)}</a><span class="more">${g.xs.length} 篇 · ${md(g.last)}</span></h2>${noteList(g.xs.sort((a, b) => String(b.updated).localeCompare(String(a.updated))), 8)}</section>`).join("")}</div>` };
  }
  if (sub === "logs") { location.hash = "#journal"; return { html: "" }; }
  // home (领域): one row per MOC (except Home) with the KB notes it links to; then topic folders; recent on the side
  const idx = await kbIndex(), ixById = new Map(idx.map(x => [x.id, x])), topics = group(notesWhere(v.topics).filter(r => r.root === "kb"), 1);
  const doms = domainMocs().map(m => { const xs = [...new Set(ixById.get(m.id)?.links || [])].map(i => byId.get(i)).filter(x => x && x.root === "kb" && x.type !== "moc");
    return { m, xs, last: [m.updated, ...xs.map(x => x.updated)].filter(Boolean).sort().at(-1) }; });
  const home = records.find(r => r.type === "moc" && /(^|\/)Home\.md$/.test(r.origin.source_path));
  const recent = [...records].filter(r => !/(^|\/)(index|README)\.md$/i.test(r.origin.source_path) && r.type !== "moc").sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
  const prow = g => `<a class="row r3" href="#knowledge/tree?root=kb&dir=${encodeURIComponent("kb/" + g.k)}"><span class="t">${esc(g.name)}</span><span class="tag">${g.xs.length} 篇</span><span class="tag">${md(g.last)}</span></a>`;
  const drow = d => `<a class="row r3" href="${noteHref(d.m)}"><span class="t">${esc(d.m.title.replace(/[-\s]*MOC$/i, ""))}<span class="s">${esc(d.m.title)}</span></span><span class="tag">${d.xs.length} 篇</span><span class="tag">${md(d.last)}</span></a>`;
  return { html: head() + T("home") + `<div class="body">${searchBox()}${mainSide(
    box({ title: "领域", meta: `${doms.length} 个 · 00-MOC`, link: home ? ["Home", noteHref(home)] : null, flush: true, cls: "focus", body: doms.length ? `<div class="rows">${doms.map(drow).join("")}</div>` : `<p class="empty">00-MOC 下没有 MOC。</p>` })
    + box({ title: "主题", meta: `${topics.length} 个 · 顶层目录`, link: ["主题页", "#knowledge/topics"], flush: true, body: `<div class="rows">${topics.map(prow).join("")}</div>` }),
    box({ title: "最近更新", link: ["目录", "#knowledge/tree"], flush: true, body: noteList(recent, 12) }))}</div>` };
}
function domainMocs() { return records.filter(r => r.origin.source_path.startsWith("00-MOC/") && !/(^|\/)Home\.md$/.test(r.origin.source_path)).sort((a, b) => a.title.localeCompare(b.title)); }
function treePage(P, head) {
  const root = "kb", dir = P.get("dir") || "", area = P.get("area") || "", type = P.get("type") || "", status = P.get("status") || "";
  const pool = records.filter(r => (!root || r.root === root) && (!area || r.area === area) && (!type || r.type === type) && (!status || r.status === status));
  const q = o => "#knowledge/tree?" + new URLSearchParams(Object.entries({ root, dir, area, type, status, ...o }).filter(([, x]) => x)).toString();
  // folder tree (depth ≤ 3) with counts
  const tree = {}; for (const r of pool) { const parts = [r.root, ...r.origin.source_path.split("/").slice(0, -1)].slice(0, 4); let path = "";
    parts.forEach(p => { path = path ? `${path}/${p}` : p; tree[path] = (tree[path] || 0) + 1; }); }
  const dirs = Object.keys(tree).sort();
  const treeHtml = dirs.map(d => { const depth = d.split("/").length - 1, name = d.split("/").pop();
    return `<a class="tn ${d === dir ? "on" : ""}" style="padding-left:${8 + depth * 14}px" href="${q({ dir: d })}">${depth === 0 ? `<b>${esc(name)}://</b>` : esc(name)}<span>${tree[d]}</span></a>`; }).join("");
  const inDir = dir ? pool.filter(r => `${r.root}/${r.origin.source_path}`.startsWith(dir + "/")) : pool;
  const facet = (key, label) => { const vals = Object.entries(records.reduce((a, r) => (r[key] && (a[r[key]] = (a[r[key]] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1]).slice(0, 14);
    const cur = { area, type, status }[key]; return `<div class="filters"><span class="fl">${label}</span><a class="fchip ${!cur ? "on" : ""}" href="${q({ [key]: "" })}">全部</a>${vals.map(([x, n]) => `<a class="fchip ${cur === x ? "on" : ""}" href="${q({ [key]: x })}">${esc(x)} <b>${n}</b></a>`).join("")}</div>`; };
  return { html: head() + T("tree") + `<div class="body">
    ${facet("area", "领域")}${facet("type", "类型")}${facet("status", "状态")}
    <div class="treegrid"><nav class="tree">${treeHtml || `<p class="empty">无</p>`}</nav><div>${card(`${esc(dir || "全部")} · ${inDir.length} 篇`, noteList(inDir.sort((a, b) => String(b.updated).localeCompare(String(a.updated))), 60) + (inDir.length > 60 ? more(inDir.length - 60, noteList(inDir.slice(60), 9999), "展开其余") : ""), { span: "s12 solo" })}</div></div></div>` };
}
async function notePage(id) {
  const r = byId.get(id);
  if (!r) return { html: header("知识", "", []) + `<div class="body"><p class="empty">未找到笔记：${esc(id)}</p></div>` };
  const [body, idx] = await Promise.all([noteBody(r), kbIndex()]); const ix = idx.find(x => x.id === id) || {};
  const crumbs = [r.root + "://", ...r.origin.source_path.split("/").slice(0, -1)];
  const chips = [r.root === "life" ? "life · 私密" : "kb", r.area && esc(r.area), r.type && esc(r.type), r.status && esc(r.status), r.updated && `更新 ${esc(r.updated)}`];
  const links = ids => ids.map(x => byId.get(x)).filter(Boolean);
  const out = links([...new Set(ix.links || [])]), back = links(ix.backlinks || []);
  return { html: `<header class="ph"><div class="ctx">${chips.filter(Boolean).join(" · ")}</div><h1>${esc(r.title)}</h1></header>
    <div class="body"><nav class="crumbs">${r.root === "life" ? `<a href="#${lifeSec(r)}">${lifeSec(r).startsWith("journal") ? "记录" : lifeSec(r).startsWith("plan") ? "计划" : "生活"}</a>` : `<a href="#knowledge">知识</a>`}${r.root === "life" ? crumbs.slice(1).map(c => `<span class="sep">/</span><span>${esc(c)}</span>`).join("") : crumbs.map((c, i) => `<span class="sep">/</span><a href="#knowledge/tree?dir=${encodeURIComponent([r.root, ...crumbs.slice(1, i + 1)].join("/"))}">${esc(c)}</a>`).join("")}</nav>
    ${(r.tags || []).length ? `<div class="filters">${r.tags.map(t => `<a class="fchip" href="#knowledge/search?q=${encodeURIComponent(t)}">#${esc(t)}</a>`).join("")}</div>` : ""}
    <article class="md">${body ? body.html : `<p class="empty">正文未加载（运行 npm start 重新构建）</p>`}</article>
    <div class="grid">${card(`反向链接 · ${back.length}`, back.length ? `<div class="nlist">${back.map(x => `<div class="nrow">${noteLink(x)}</div>`).join("")}</div>` : `<p class="empty">无</p>`, { span: "s6" })}
    ${card(`出链 · ${out.length}`, out.length ? `<div class="nlist">${out.map(x => `<div class="nrow">${noteLink(x)}</div>`).join("")}</div>` : `<p class="empty">无</p>`, { span: "s6" })}</div></div>` };
}
async function searchPage(q, head) {
  const idx = await kbIndex(), terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = !terms.length ? [] : idx.map(x => { const t = x.title.toLowerCase(), tg = (x.tags || []).join(" ").toLowerCase(), p = x.path.toLowerCase(), b = (x.text || "").toLowerCase();
    let s = 0; for (const w of terms) { const ws = (t.includes(w) ? 10 : 0) + (tg.includes(w) ? 5 : 0) + (p.includes(w) ? 3 : 0) + (b.includes(w) ? 1 + Math.min(4, b.split(w).length - 2) : 0); if (!ws) return null; s += ws; }
    return { x, s }; }).filter(Boolean).sort((a, b) => b.s - a.s);
  const snip = text => { const lo = text.toLowerCase(), i = terms.map(w => lo.indexOf(w)).filter(i => i >= 0).sort((a, b) => a - b)[0] ?? 0;
    let sn = esc(text.slice(Math.max(0, i - 50), i + 110)); for (const w of terms) sn = sn.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), m => `<mark>${m}</mark>`); return (i > 50 ? "…" : "") + sn + "…"; };
  return { html: head([q ? `“${esc(q)}” · ${hits.length} 条` : ""]) + T("search") + `<div class="body">${searchBox(q)}
    ${q ? (hits.length ? `<div class="hits">${hits.slice(0, 50).map(({ x }) => `<a class="hit" href="#kb/note?id=${encodeURIComponent(x.id)}"><b>${esc(x.title)}</b>${x.root === "life" ? `<span class="rt">life</span>` : ""}<span class="m">${esc(x.root)}://${esc(x.path)}${x.updated ? ` · ${esc(x.updated)}` : ""}</span><p>${snip(x.text || "")}</p></a>`).join("")}</div>${hits.length > 50 ? `<p class="note">仅显示前 50 条</p>` : ""}` : `<p class="empty">没有匹配的笔记。</p>`) : `<p class="empty">输入关键词，搜索标题、标签、路径与正文（${idx.length} 篇已索引）。</p>`}</div>` };
}

// which 生活 / 记录 / 计划 tab owns a life note (via data/sections.yaml)
function lifeSec(r) {
  const path = r.origin.source_path, bare = path.replace(/\.md$/i, "");
  for (const s of v9?.sections || []) for (const t of s.tabs) for (const u of t.source) {
    const d = String(u).replace(/^life:\/\//, "").replace(/[#?].*$/, "");
    if (!d || d.startsWith("data/")) continue;
    const prefs = d.endsWith("/") ? choosePrefixes(d, dirCovers) : [d, ...fallbacks(d)];
    if (prefs.some(p => p.endsWith("/") ? path.startsWith(p) : bare === p.replace(/\.md$/i, "").replace(/\/+$/, ""))) return `${s.id}/${t.id}`;
  }
  return "life";
}
