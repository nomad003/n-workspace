// 数据源: registry of content roots + reserved connectors, sync state and missing fields.
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
      <dt>隐私</dt><dd>${esc(s.privacy)}</dd>${s.notes ? `<dt>笔记</dt><dd>${s.notes} 篇</dd>` : ""}
      <dt>内容</dt><dd>${s.expects.map(e => `<span class="tag">${esc(e)}</span>`).join("")}</dd></dl>
      ${(s.data_files || []).length ? `<h4 class="subh">data/*.yaml</h4><div class="tbl"><table><thead><tr><th>文件</th><th>条目</th><th>更新</th><th>待补充字段</th></tr></thead><tbody>${s.data_files.map(d => `<tr><td class="t mono">${esc(d.name)}</td><td class="num">${d.items}</td><td>${esc(d.updated || "")}</td><td>${d.missing_fields.length ? `${d.missing_fields.reduce((a, f) => a + f.unknown, 0)} 处 · ${d.missing_fields.slice(0, 4).map(f => `<span class="tag">${esc(f.field)} ${f.unknown}/${f.total}</span>`).join("")}${d.missing_fields.length > 4 ? more(d.missing_fields.length - 4, d.missing_fields.slice(4).map(f => `<span class="tag">${esc(f.field)} ${f.unknown}/${f.total}</span>`).join(""), "更多") : ""}` : "—"}</td></tr>`).join("")}</tbody></table></div>` : ""}`, { span: "s6" }); };
  return { html: header("数据源", "infra", [`${live.filter(s => s.present).length}/${live.length} 已同步`, `构建 ${esc(when(bundle.generated))}`]) + `<div class="body">
    ${kpis([[live.filter(s => s.present).length + "/" + live.length, "已同步"], [bundle.records.length, "笔记"], [miss, "待补充字段值", { warn: miss > 0 }], [bundle.broken_links ?? 0, "未解析链接", { warn: (bundle.broken_links ?? 0) > 0 }], [bundle.missing?.length ?? 0, "缺失数据文件", { warn: (bundle.missing?.length ?? 0) > 0 }]])}
    <div class="grid">${S.map(row).join("")}</div>
    ${(bundle.warnings || []).length ? more(bundle.warnings.length, `<ul class="plain">${bundle.warnings.map(w => `<li>${esc(w)}</li>`).join("")}</ul>`, "构建警告") : ""}
    ${(bundle.broken_list || []).length ? more(bundle.broken_list.length, `<ul class="plain mono">${bundle.broken_list.map(w => `<li>${esc(w)}</li>`).join("")}</ul>`, "未解析链接") : ""}</div>` };
}
