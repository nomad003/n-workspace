// 设置: data sources (sync state), 数据补全 queue (all placeholder fields in one place), theme.
import { bundle } from "../data.js";
import { esc, header, card, kpis, more } from "../ui.js";
const ROLE = { primary: ["主数据源", "ai"], secondary: ["次数据源", "agent"], reserved: ["预留", "infra"] };
const when = t => t ? new Date(t).toLocaleString("zh-CN", { hour12: false }) : "—";
export default function () {
  const S = bundle.sources || [], live = S.filter(s => s.role !== "reserved");
  const miss = S.flatMap(s => s.data_files || []).reduce((a, d) => a + d.missing_fields.reduce((x, f) => x + f.unknown, 0), 0);
  const row = s => { const st = s.role === "reserved" ? ["未接入", "infra"] : s.present ? ["已同步", "ai"] : ["缺失", "err"], m = s.meta || {};
    return card(`${esc(s.name)} <span class="sd L-${ROLE[s.role][1]}">${ROLE[s.role][0]}</span>`, `<dl class="kv">
      <dt>状态</dt><dd><span class="sd L-${st[1]}">${st[0]}</span></dd>
      ${m.repo ? `<dt>仓库</dt><dd class="mono">${esc(m.repo)}</dd>` : ""}${m.ref ? `<dt>ref / commit</dt><dd class="mono">${esc(m.ref)} @ ${esc((m.commit || "").slice(0, 7))}${m.commit_date ? ` · ${esc(when(m.commit_date))}` : ""}</dd>` : ""}
      ${m.fetched_at ? `<dt>抓取时间</dt><dd>${esc(when(m.fetched_at))}</dd>` : ""}
      ${s.schema_version ? `<dt>数据模型</dt><dd>schema_version ${s.schema_version}${s.schema_version === 9 ? " · tasks / plans / account-groups / sections" : "（v8 兼容模式）"}</dd>` : ""}<dt>隐私</dt><dd>${esc(s.privacy)}</dd>${s.notes ? `<dt>笔记</dt><dd>${s.notes} 篇</dd>` : ""}
      <dt>内容</dt><dd>${s.expects.map(e => `<span class="tag">${esc(e)}</span>`).join("")}</dd></dl>
      ${(s.data_files || []).length ? `<h4 class="subh">data/*.yaml</h4><div class="tbl"><table><thead><tr><th>文件</th><th>条目</th><th>更新</th><th>待补充字段</th></tr></thead><tbody>${s.data_files.map(d => `<tr><td class="t mono">${esc(d.name)}</td><td class="num">${d.items}</td><td>${esc(d.updated || "")}</td><td>${d.missing_fields.length ? `${d.missing_fields.reduce((a, f) => a + f.unknown, 0)} 处 · ${d.missing_fields.slice(0, 4).map(f => `<span class="tag">${esc(f.field)} ${f.unknown}/${f.total}</span>`).join("")}${d.missing_fields.length > 4 ? more(d.missing_fields.length - 4, d.missing_fields.slice(4).map(f => `<span class="tag">${esc(f.field)} ${f.unknown}/${f.total}</span>`).join(""), "更多") : ""}` : "—"}</td></tr>`).join("")}</tbody></table></div>` : ""}`, { span: "s6" }); };
  const queue = S.flatMap(s => (s.data_files || []).flatMap(d => d.missing_fields.map(f => ({ file: d.name, ...f })))).sort((a, b) => b.unknown - a.unknown);
  return { html: header("设置", "", [`${live.filter(s => s.present).length}/${live.length} 数据源已同步`, `构建 ${esc(when(bundle.generated))}`]) + `<div class="body">
    <section class="blk"><h2>外观</h2><div class="ag"><a href="#settings" data-theme-set="light">浅色</a><a href="#settings" data-theme-set="dark">深色</a></div></section>
    <section class="blk"><h2>数据补全<span class="more">${queue.reduce((n, q) => n + q.unknown, 0)} 处待补充 · 按缺失数排序</span></h2><div class="rows">${queue.slice(0, 12).map(q => `<div class="row r3"><span class="t">${esc(q.field)}<span class="s">${esc(q.file)}</span></span><span class="tag">${q.unknown} / ${q.total}</span><span class="tag">${Math.round(q.unknown / q.total * 100)}%</span></div>`).join("")}</div>${queue.length > 12 ? more(queue.length - 12, `<div class="rows">${queue.slice(12).map(q => `<div class="row r3"><span class="t">${esc(q.field)}<span class="s">${esc(q.file)}</span></span><span class="tag">${q.unknown} / ${q.total}</span><span class="tag"></span></div>`).join("")}</div>`, "展开全部") : ""}</section>
    <section class="blk"><h2>数据源</h2></section>
    <div class="grid">${S.map(row).join("")}</div>
    ${(bundle.warnings || []).length ? more(bundle.warnings.length, `<ul class="plain">${bundle.warnings.map(w => `<li>${esc(w)}</li>`).join("")}</ul>`, "构建警告") : ""}
    ${(bundle.broken_list || []).length ? more(bundle.broken_list.length, `<ul class="plain mono">${bundle.broken_list.map(w => `<li>${esc(w)}</li>`).join("")}</ul>`, "未解析链接") : ""}</div>` };
}
