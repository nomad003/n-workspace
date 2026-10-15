// 知识库: home, directory tree, maturity view (absorbs 学习与成长), note page, full-text search.
import { V, records, byId, kbIndex, noteBody, notesWhere, match } from "../data.js";
import { esc, header, tabs, card, noteList, noteLink, noteHref, badge, more } from "../ui.js";
const MC = { stub: "infra", learning: "agent", evolving: "coding", evergreen: "ai" };
const T = sub => tabs("kb", [["home", "首页"], ["tree", "目录"], ["maturity", "成熟度"], ["search", "搜索"]], sub);
const searchBox = (q = "") => `<form class="kbsearch" onsubmit="location.hash='#kb/search?q='+encodeURIComponent(this.q.value);return false"><input name="q" value="${esc(q)}" placeholder="全文搜索笔记（标题、标签、正文）…" autocomplete="off"><button class="btn">搜索</button></form>`;
const mat = r => r.maturity || "stub";
export default async function (sub = "home", P = new URLSearchParams()) {
  const v = V.kb, kbN = records.filter(r => r.root === "kb").length, lifeN = records.length - kbN;
  const head = (extra = []) => header("知识库", "ext", [`${records.length} 篇`, `kb ${kbN} · life ${lifeN}`, ...extra]);
  if (sub === "note") return notePage(P.get("id"));
  if (sub === "search") return searchPage(P.get("q") || "", head);
  if (sub === "tree") return treePage(P, head);
  if (sub === "maturity") {
    const pool = notesWhere(v.learning), cols = v.maturity;
    return { html: head() + T(sub) + `<div class="body"><p class="note">学习与成长：KB 学习类笔记 + n-life-data <code>learning/</code>（私密），按成熟度流转。</p>
      <div class="kb">${cols.map(c => { const xs = pool.filter(r => mat(r) === c); return `<div class="kcol L-${MC[c]}"><h4><span class="sd L-${MC[c]}">${c}</span><span class="n">${xs.length}</span></h4>${xs.slice(0, 12).map(r => `<a class="kcard L-${MC[c]}" href="${noteHref(r)}"><b>${esc(r.title)}</b><div class="m">${esc(r.area || "")} · ${esc(r.updated || "")}${r.root === "life" ? " · life" : ""}</div></a>`).join("")}${xs.length > 12 ? more(xs.length - 12, xs.slice(12).map(r => `<a class="kcard L-${MC[c]}" href="${noteHref(r)}"><b>${esc(r.title)}</b></a>`).join(""), "展开其余") : ""}</div>`; }).join("")}</div></div>` };
  }
  // home
  const mocs = notesWhere(v.moc), recent = [...records].sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
  const counts = v.maturity.map(c => [c, records.filter(r => r.maturity ? r.maturity === c : c === "stub").length]), tot = counts.reduce((a, [, n]) => a + n, 0) || 1;
  const tags = Object.entries(records.flatMap(r => r.tags || []).reduce((a, t) => (a[t] = (a[t] || 0) + 1, a), {})).sort((a, b) => b[1] - a[1]).slice(0, 48);
  const tmax = tags[0]?.[1] || 1;
  return { html: head() + T("home") + `<div class="body">${searchBox()}
    <div class="matbar" title="成熟度分布">${counts.map(([c, n]) => `<a class="seg L-${MC[c]}" style="flex:${n || 0.001}" href="#kb/maturity" title="${c} ${n}"></a>`).join("")}</div>
    <div class="legend">${counts.map(([c, n]) => `<span class="L-${MC[c]}"><i></i>${c} <b class="mono">${n}</b> · ${Math.round(n / tot * 100)}%</span>`).join("")}<span class="note">无 maturity 字段按 stub 计</span></div>
    <h3 class="subh">MOC · 地图</h3><div class="mocs">${mocs.map(r => `<a class="moc L-${r.root === "life" ? "tui" : "ext"}" href="${noteHref(r)}"><b>${esc(r.title)}</b><span>${esc(r.root)}://${esc(r.origin.source_path)}</span></a>`).join("")}</div>
    <div class="grid">${card("最近更新", noteList(recent, 10), { span: "s7" })}
    ${card("标签", `<div class="tcloud">${tags.map(([t, n]) => `<a href="#kb/search?q=${encodeURIComponent(t)}" style="font-size:${(11 + 9 * Math.sqrt(n / tmax)).toFixed(1)}px" title="${n}">${esc(t)}</a>`).join("")}</div>`, { span: "s5" })}</div></div>` };
}
function treePage(P, head) {
  const root = P.get("root") || "", dir = P.get("dir") || "", area = P.get("area") || "", type = P.get("type") || "", status = P.get("status") || "";
  const pool = records.filter(r => (!root || r.root === root) && (!area || r.area === area) && (!type || r.type === type) && (!status || r.status === status));
  const q = o => "#kb/tree?" + new URLSearchParams(Object.entries({ root, dir, area, type, status, ...o }).filter(([, x]) => x)).toString();
  // folder tree (depth ≤ 3) with counts
  const tree = {}; for (const r of pool) { const parts = [r.root, ...r.origin.source_path.split("/").slice(0, -1)].slice(0, 4); let path = "";
    parts.forEach(p => { path = path ? `${path}/${p}` : p; tree[path] = (tree[path] || 0) + 1; }); }
  const dirs = Object.keys(tree).sort();
  const treeHtml = dirs.map(d => { const depth = d.split("/").length - 1, name = d.split("/").pop();
    return `<a class="tn ${d === dir ? "on" : ""}" style="padding-left:${8 + depth * 14}px" href="${q({ dir: d })}">${depth === 0 ? `<b>${esc(name)}://</b>` : esc(name)}<span>${tree[d]}</span></a>`; }).join("");
  const inDir = dir ? pool.filter(r => `${r.root}/${r.origin.source_path}`.startsWith(dir + "/")) : pool;
  const facet = (key, label) => { const vals = Object.entries(records.reduce((a, r) => (r[key] && (a[r[key]] = (a[r[key]] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1]).slice(0, 14);
    const cur = { area, type, status }[key]; return `<div class="filters"><span class="fl">${label}</span><a class="fchip ${!cur ? "on" : ""}" href="${q({ [key]: "" })}">全部</a>${vals.map(([x, n]) => `<a class="fchip ${cur === x ? "on" : ""}" href="${q({ [key]: x })}">${esc(x)} <b>${n}</b></a>`).join("")}</div>`; };
  return { html: head() + T("tree") + `<div class="body"><div class="filters"><span class="fl">根</span>${[["", "全部"], ["life", "life://"], ["kb", "kb://"]].map(([x, l]) => `<a class="fchip ${root === x ? "on" : ""}" href="${q({ root: x, dir: "" })}">${l}</a>`).join("")}</div>
    ${facet("area", "领域")}${facet("type", "类型")}${facet("status", "状态")}
    <div class="treegrid"><nav class="tree">${treeHtml || `<p class="empty">无</p>`}</nav><div>${card(`${esc(dir || "全部")} · ${inDir.length} 篇`, noteList(inDir.sort((a, b) => String(b.updated).localeCompare(String(a.updated))), 60) + (inDir.length > 60 ? more(inDir.length - 60, noteList(inDir.slice(60), 9999), "展开其余") : ""), { span: "s12 solo" })}</div></div></div>` };
}
async function notePage(id) {
  const r = byId.get(id);
  if (!r) return { html: header("知识库", "ext", []) + `<div class="body"><p class="empty">未找到笔记：${esc(id)}</p></div>` };
  const [body, idx] = await Promise.all([noteBody(r), kbIndex()]); const ix = idx.find(x => x.id === id) || {};
  const crumbs = [r.root + "://", ...r.origin.source_path.split("/").slice(0, -1)];
  const chips = [r.root === "life" ? `<span class="chip L-tui">life · 私密</span>` : `<span class="chip L-ext">kb</span>`, r.area && esc(r.area), r.type && esc(r.type), r.status && badge(r.status), r.maturity && `<span class="sd L-${MC[r.maturity] || "infra"}">${esc(r.maturity)}</span>`, r.updated && `更新 ${esc(r.updated)}`];
  const links = ids => ids.map(x => byId.get(x)).filter(Boolean);
  const out = links([...new Set(ix.links || [])]), back = links(ix.backlinks || []);
  return { html: `<header class="ph L-${r.root === "life" ? "tui" : "ext"}"><h1>${esc(r.title)}</h1>${chips.filter(Boolean).map(c => `<span class="hchip">${c}</span>`).join("")}<span class="sp"></span><button class="btn sm" data-cmdk>⌘K 搜索</button></header>
    <div class="body"><nav class="crumbs"><a href="#kb">知识库</a>${crumbs.map((c, i) => `<span class="sep">/</span><a href="#kb/tree?dir=${encodeURIComponent([r.root, ...crumbs.slice(1, i + 1)].join("/"))}">${esc(c)}</a>`).join("")}</nav>
    ${(r.tags || []).length ? `<div class="filters">${r.tags.map(t => `<a class="fchip" href="#kb/search?q=${encodeURIComponent(t)}">#${esc(t)}</a>`).join("")}</div>` : ""}
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
