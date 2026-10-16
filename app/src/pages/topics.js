// 主题 (topics): long-running dossiers from data/topics.yaml + data/topic-logs/<id>.jsonl.
//   #topics[/<kind>]                 overview grid (all | project | habit | skill | area)
//   #topics/<id>[/overview|log|metrics|resources][?kind=…]   detail: status strip, KPIs, tabs, side rail (next steps, issues, links)
import { topics, topicById, tasks, plansV9, reviews, records, accById, accHref, v9 } from "../data.js";
import { esc, header, tabs, box, mainSide, noteHref } from "../ui.js";
const KIND = { project: "项目", habit: "习惯", skill: "技能", area: "领域" };
const LC = { active: "进行中", paused: "暂停", done: "完成", archived: "归档" };
const HL = { "on-track": ["正常", "ok"], "at-risk": ["有风险", "warn"], "off-track": ["偏离", "warn"] };
const EK = { event: "事件", decision: "决定", note: "笔记", review: "复盘", resource: "资料", milestone: "里程碑", issue: "问题", metric: "指标", status: "状态" };
const md = d => { const m = String(d ?? "").match(/^\d{4}-(\d{2})-(\d{2})/); return m ? `${+m[1]}/${+m[2]}` : esc(d ?? "—"); };
const days = d => d ? Math.floor((Date.now() - new Date(d + "T00:00:00")) / 864e5) : null;
const owner = o => o === "user" ? "我" : String(o).replace(/^agent:/, "").replace(/^./, c => c.toUpperCase());
const period = cad => { if (!cad) return null; const f = (cad.match(/FREQ=(\w+)/) || [])[1], n = +((cad.match(/INTERVAL=(\d+)/) || [])[1] || 1); return ({ DAILY: 1, WEEKLY: 7, MONTHLY: 31, YEARLY: 366 }[f] || 0) * n; };
const cadLabel = cad => { if (!cad) return "不定期"; const by = (cad.match(/BYDAY=([\w,]+)/) || [])[1], n = +((cad.match(/INTERVAL=(\d+)/) || [])[1] || 1);
  const W = { MO: "一", TU: "二", WE: "三", TH: "四", FR: "五", SA: "六", SU: "日" };
  if (/WEEKLY/.test(cad)) return by ? `每周${by.split(",").map(x => W[x]).join("、")}` : "每周"; if (/MONTHLY/.test(cad)) return n === 3 ? "每季度" : n > 1 ? `每 ${n} 个月` : "每月"; return /DAILY/.test(cad) ? "每天" : "每年"; };
export const stale = t => { const p = period(t.tracking?.cadence); return !!(p && t.status?.lifecycle === "active" && t.last && days(t.last) > 2 * p); };
const tr = t => t.tracking || { metrics: [], goals: [] };
const keyMetric = t => tr(t).metrics.find(m => m.type === "number" && (t.series?.[m.id] || []).length) || tr(t).metrics.find(m => m.type === "number");
// resolve life:// / kb:// / https refs to an in-app link (plain text when the note does not exist)
function ref(u, label) {
  const s = String(u ?? ""); if (/^https?:\/\//.test(s)) return `<a href="${esc(s)}" target="_blank" rel="noopener noreferrer">${esc(label || s)} ↗</a>`;
  const m = s.match(/^(kb|life):\/\/(?:n-knowledge-base\/)?([^#?]+)/); if (!m) return esc(label || s);
  const p = m[2].replace(/\.md$/, ""), r = records.find(x => x.root === m[1] && (x.slug === p || x.origin.source_path.replace(/\.md$/, "") === p));
  const nm = !r ? "" : /^(index|readme)$/i.test(r.title) ? r.origin.source_path.split("/").slice(-2, -1)[0] || r.title : r.title;
  return r ? `<a href="${noteHref(r)}">${esc(label || nm)}</a>` : `<span class="muted">${esc(label || p.split("/").pop())}</span>`;
}
// SVG: sparkline (cards) and line chart (指标 tab); vanilla, no deps
function spark(pts, w = 120, h = 28) {
  if (!pts?.length) return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><line x1="0" y1="${h - 2}" x2="${w}" y2="${h - 2}" class="sp-empty"/></svg>`;
  const ys = pts.map(p => +p[1]), lo = Math.min(...ys), hi = Math.max(...ys), n = pts.length, X = i => n === 1 ? w / 2 : 2 + i * (w - 4) / (n - 1), Y = v => hi === lo ? h / 2 : h - 3 - (v - lo) / (hi - lo) * (h - 6);
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><polyline points="${pts.map((p, i) => `${X(i).toFixed(1)},${Y(+p[1]).toFixed(1)}`).join(" ")}"/>${pts.map((p, i) => i === n - 1 ? `<circle cx="${X(i).toFixed(1)}" cy="${Y(+p[1]).toFixed(1)}" r="2.5"/>` : "").join("")}</svg>`;
}
function chart(pts, goal, unit = "") {
  const W = 640, H = 200, L = 44, B = 26, T = 12, R = 12; if (!pts?.length) return `<p class="empty">还没有记录。</p>`;
  const ys = pts.map(p => +p[1]), tv = goal?.target && typeof goal.target.value === "number" ? goal.target.value : null;
  let lo = Math.min(...ys, tv ?? Infinity), hi = Math.max(...ys, tv ?? -Infinity); if (hi === lo) { hi += 1; lo = Math.max(0, lo - 1); }
  const t0 = +new Date(pts[0][0]), t1 = +new Date(pts.at(-1)[0]), X = d => t1 === t0 ? (L + W - R) / 2 : L + (+new Date(d) - t0) / (t1 - t0) * (W - L - R), Y = v => T + (hi - v) / (hi - lo) * (H - T - B);
  const ticks = [lo, (lo + hi) / 2, hi].map(v => `<line class="grid" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ax" x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${Math.round(v * 10) / 10}</text>`).join("");
  return `<svg class="chart" viewBox="0 0 ${W} ${H}">${ticks}
    ${tv != null ? `<line class="goal" x1="${L}" x2="${W - R}" y1="${Y(tv)}" y2="${Y(tv)}"/><text class="ax goal-t" x="${W - R}" y="${Y(tv) - 4}" text-anchor="end">目标 ${tv}${esc(unit)}</text>` : ""}
    <polyline points="${pts.map(p => `${X(p[0]).toFixed(1)},${Y(+p[1]).toFixed(1)}`).join(" ")}"/>${pts.map(p => `<circle cx="${X(p[0]).toFixed(1)}" cy="${Y(+p[1]).toFixed(1)}" r="3"><title>${esc(p[0])}: ${esc(p[1])}${esc(unit)}</title></circle>`).join("")}
    <text class="ax" x="${L}" y="${H - 6}">${md(pts[0][0])}</text>${pts.length > 1 ? `<text class="ax" x="${W - R}" y="${H - 6}" text-anchor="end">${md(pts.at(-1)[0])}</text>` : ""}</svg>`;
}
const stagePill = t => `<span class="pill ${t.status?.lifecycle === "active" ? "accent" : ""}">${esc(t.status?.stage || LC[t.status?.lifecycle] || "—")}</span>`;
const healthDot = t => { const h = HL[t.status?.health]; return `<span class="hdot ${h ? h[1] : ""}" title="健康度（由本人设置）">${h ? h[0] : "健康 —"}</span>`; };
const goalProgress = (t, g) => { if (!g.metric || !g.target || typeof g.target.value !== "number" || g.target.per) return null; const s = t.series?.[g.metric]; if (!s?.length) return 0; return Math.max(0, Math.min(100, Math.round(+s.at(-1)[1] / g.target.value * 100))); };

function card(t) {
  const km = keyMetric(t), s = km ? t.series?.[km.id] || [] : [], st = stale(t), next = (t.status?.next || [])[0];
  return box({ title: `<a href="#topics/${encodeURIComponent(t.id)}">${esc(t.title)}</a>`, meta: `${KIND[t.kind] ?? t.kind} · ${esc(owner(t.owner))}`, cls: `tcard ${t.status?.lifecycle !== "active" ? "dim" : ""}`,
    body: `<div class="tc-st">${stagePill(t)}${healthDot(t)}</div>
      ${km ? `<div class="tc-m"><div><div class="kpi-k">${esc(km.label)}</div><div class="tc-v">${s.length ? esc(s.at(-1)[1]) : "—"}<small>${esc(km.unit ?? "")}</small></div></div>${spark(s)}</div>` : `<div class="tc-m"><div><div class="kpi-k">记录</div><div class="tc-v">${t.entries.length}<small>条</small></div></div>${spark([])}</div>`}
      <p class="tc-n">${next ? `下一步：${esc(next)}` : t.status?.summary ? esc(t.status.summary) : `<span class="muted">未写当前小结</span>`}</p>`,
    footer: `更新 ${md(t.last)} · ${t.entries.length} 条记录${t.open_issues.length ? ` · <span class="w">${t.open_issues.length} 个未解决问题</span>` : ""}${st ? ` · <span class="w">停滞</span>` : ""} · ${cadLabel(t.tracking?.cadence)}` });
}

export default function (sub, P = new URLSearchParams(), rest = []) {
  const all = topics();
  if (!v9) return { html: header("主题", "", [], "需要 n-life-data schema_version 9。") };
  const t = sub && topicById(sub);
  if (t) return detail(t, rest[0] || "overview", P);
  const kind = KIND[sub] ? sub : "all", xs = all.filter(x => kind === "all" || x.kind === kind).sort((a, b) => (a.status?.lifecycle !== "active") - (b.status?.lifecycle !== "active") || String(b.last).localeCompare(String(a.last)));
  const week = all.flatMap(x => x.entries).filter(e => days(e.date) != null && days(e.date) <= 7).length, issues = all.reduce((n, x) => n + x.open_issues.length, 0), stl = all.filter(stale);
  const goals = all.flatMap(x => tr(x).goals.filter(g => g.deadline).map(g => ({ x, g })));
  const head = header("主题", "", [`${all.length} 个主题`, "data/topics.yaml + topic-logs"], all.length ? `长期在推进的事：每个主题有档案、当前状态、信息登记和指标。${stl.length ? `<b class="w">${stl.length} 个停滞</b>，` : ""}${issues ? `${issues} 个未解决问题。` : "没有未解决问题。"}` : "", {
    kpis: all.length ? [[all.filter(x => x.status?.lifecycle === "active").length, "进行中", { tone: "focus", sub: `${all.filter(x => x.status?.lifecycle !== "active").length} 个暂停 / 完成` }], [week, "近 7 天新记录"],
      [stl.length, "停滞", { tone: stl.length ? "warn" : "", sub: "超过 2 个周期未记录" }], [issues, "未解决问题", { tone: issues ? "warn" : "" }], [goals.length, "有期限的目标", { sub: goals.length ? `最近：${esc(goals.sort((a, b) => String(a.g.deadline).localeCompare(String(b.g.deadline)))[0].g.deadline)}` : "" }]] : [] })
    + tabs("topics", [["all", "全部", all.length], ...Object.entries(KIND).map(([k, l]) => [k, l, all.filter(x => x.kind === k).length || ""])], kind);
  if (!all.length) return { html: head + `<div class="body">${box({ title: "还没有主题", body: `<p class="empty">n-life-data 中没有 data/topics.yaml。按 topics 提案添加 data/topics.yaml 与 data/topic-logs/&lt;id&gt;.jsonl 后重新 npm start。</p>` })}</div>` };
  return { html: head + `<div class="body"><div class="tgrid">${xs.map(card).join("")}</div></div>` };
}

function detail(t, tab, P) {
  const S = t.status || {}, T = tr(t), base = `topics/${encodeURIComponent(t.id)}`, taskOf = id => tasks().find(x => x.id === id), planOf = id => [...plansV9(), ...reviews()].find(x => x.id === id);
  const kpis = [...T.metrics.filter(m => m.type === "number").slice(0, 3).map(m => { const s = t.series?.[m.id] || []; return [s.length ? esc(s.at(-1)[1]) : "—", esc(m.label), { unit: m.unit ?? "", sub: s.length ? `${md(s.at(-1)[0])} · ${s.length} 次记录` : "未记录" }]; }),
    [t.entries.length, "记录", { tone: "focus", sub: `最近 ${md(t.last)}` }], T.goals.length && [`${T.goals.filter(g => goalProgress(t, g) === 100 || g.done_at).length}<small>/ ${T.goals.length}</small>`, "目标达成"],
    [t.open_issues.length, "未解决问题", { tone: t.open_issues.length ? "warn" : "" }]];
  const meta = [KIND[t.kind] ?? t.kind, owner(t.owner), t.started ? `起于 ${esc(t.started)}` : "起始日期未填", cadLabel(T.cadence), ...(t.accounts || []).map(a => { const x = accById(a); return x ? `账号 <a href="${accHref(x)}">${esc(x.service)}</a>` : `账号 ${esc(a)}`; })];
  const head = header(esc(t.title), "", meta, S.summary ? esc(S.summary) : `<span class="muted">还没有当前小结（topics.yaml → status.summary）</span>`, { kpis, actions: [t.narrative && ["叙述页", "#" + (ref(t.narrative).match(/href="#([^"]+)"/)?.[1] || "topics")], ["全部主题", "#topics"]].filter(Boolean) })
    .replace('<div class="ctx">', `<div class="ctx">`) + `<div class="sstrip">${stagePill(t)}${healthDot(t)}<span>${esc(LC[S.lifecycle] ?? S.lifecycle ?? "")}${S.since ? ` · 阶段起于 ${esc(S.since)}` : ""}</span><span class="muted">状态更新 ${esc(S.updated ?? "—")}${S.source ? ` · 来源 ${ref(S.source, S.source.replace(/^life:\/\//, ""))}` : ""}</span></div>`;
  const T4 = tabs(base, [["overview", "概览"], ["log", "记录", t.entries.length], ["metrics", "指标", T.metrics.length || ""], ["resources", "资料", (t.resources || []).length + (t.links?.notes || []).length]], tab);
  const erow = e => `<div class="ev k-${e.kind}"><span class="ev-d">${md(e.date)}</span><span class="ev-k">${esc(EK[e.kind] ?? e.kind)}</span><div class="ev-b"><b>${esc(e.title)}</b>${e.stage ? ` <span class="pill accent">${esc(e.stage)}</span>` : ""}${e.lifecycle ? ` <span class="pill">${esc(LC[e.lifecycle] ?? e.lifecycle)}</span>` : ""}
    ${e.values ? `<div class="ev-v">${Object.entries(e.values).map(([k, v]) => `<span>${esc(T.metrics.find(m => m.id === k)?.label ?? k)} <b>${v == null ? "—" : esc(v)}</b></span>`).join("")}</div>` : ""}
    ${e.body ? `<p>${esc(e.body)}</p>` : ""}<div class="ev-m">${(e.tags || []).map(x => `#${esc(x)}`).join(" ")}${e.ref ? ` ${ref(e.ref)}` : ""}${e.resolves ? ` · 解决：${esc(e.resolves.split("#")[1] ?? e.resolves)}` : ""}${e.by && e.by !== "user" ? ` · ${esc(owner(e.by))}` : ""}${e.source && e.source !== e.ref ? ` · 来源 ${ref(e.source, "原文")}` : ""}</div></div></div>`;
  let main = "";
  if (tab === "log") {
    const k = P.get("kind") || "", es = [...t.entries].reverse().filter(e => !k || e.kind === k), kinds = [...new Set(t.entries.map(e => e.kind))];
    main = box({ title: "信息登记", meta: `${es.length} 条 · 最新在上`, flush: true, body: `<div class="filters" style="padding:12px 16px 0"><a class="fchip ${!k ? "on" : ""}" href="#${base}/log">全部</a>${kinds.map(x => `<a class="fchip ${k === x ? "on" : ""}" href="#${base}/log?kind=${x}">${esc(EK[x] ?? x)} <b>${t.entries.filter(e => e.kind === x).length}</b></a>`).join("")}</div><div class="tl">${es.map(erow).join("") || `<p class="empty" style="padding:16px">无</p>`}</div>`,
      footer: `追加：python3 tools/append_entry.py ${esc(t.id)} &lt;kind&gt; "标题" …（只追加，不改旧行）` });
  } else if (tab === "metrics") {
    main = T.metrics.length ? T.metrics.map(m => { const s = t.series?.[m.id] || [], g = T.goals.find(x => x.metric === m.id);
      return box({ title: esc(m.label), meta: `${({ number: "数值", bool: "是/否", enum: "枚举", text: "文本" })[m.type]} · ${esc(m.aggregation)}${m.period ? ` / ${esc(m.period)}` : ""}${m.unit ? ` · ${esc(m.unit)}` : ""}`,
        body: m.type === "number" ? chart(s, g, m.unit) : s.length ? `<div class="rows">${[...s].reverse().map(([d, v]) => `<div class="row r2"><span class="t">${esc(v)}</span><span class="tag">${esc(d)}</span></div>`).join("")}</div>` : `<p class="empty">还没有记录。</p>`,
        footer: g ? `目标：${esc(g.title)}${g.deadline ? ` · 期限 ${esc(g.deadline)}` : ""}` : "" }); }).join("") : box({ title: "指标", body: `<p class="empty">这个主题没有定义指标（topics.yaml → tracking.metrics）。信息登记照常可用。</p>` });
  } else if (tab === "resources") {
    const rs = t.resources || [], notes = t.links?.notes || [], le = t.entries.filter(e => e.kind === "resource");
    main = box({ title: "资料", meta: `${rs.length} 项`, flush: true, body: rs.length ? `<div class="rows">${rs.map(r => `<div class="row r2"><span class="t">${ref(r.ref, r.title)}</span><span class="tag mono">${esc(String(r.ref).split("://")[0])}</span></div>`).join("")}</div>` : `<p class="empty" style="padding:16px">无</p>` })
      + box({ title: "关联笔记", meta: `${notes.length} 篇`, flush: true, body: notes.length ? `<div class="rows">${notes.map(n => `<div class="row r2"><span class="t">${ref(n)}</span><span class="tag mono">${esc(String(n).split("://")[0])}</span></div>`).join("")}</div>` : `<p class="empty" style="padding:16px">无</p>` })
      + (le.length ? box({ title: "记录中的资料", flush: true, body: `<div class="tl">${[...le].reverse().map(erow).join("")}</div>` }) : "");
  } else {
    const gl = T.goals.map(g => { const p = goalProgress(t, g); return `<div class="row r2"><span class="t">${esc(g.title)}<span class="s">${g.deadline ? `期限 ${esc(g.deadline)}` : "无期限"}${g.task ? ` · ${esc(g.task)}` : ""}</span></span><span class="tag">${p == null ? "" : `<span class="prog mini"><i style="width:${p}%"></i></span> ${p}%`}</span></div>`; }).join("");
    const hist = t.history.length ? `<div class="stl">${t.history.map(h => `<div class="stl-i"><span class="ev-d">${esc(h.date)}</span><span class="stl-dot"></span><div><b>${esc(h.stage || LC[h.lifecycle] || h.title)}</b><small>${esc(h.title ?? "")}</small></div></div>`).join("")}</div>` : `<p class="empty">还没有状态变化记录。</p>`;
    main = box({ title: "档案", body: `<dl class="kv2"><dt>为什么</dt><dd>${t.why ? esc(t.why) : `<span class="muted">未填</span>`}</dd><dt>范围</dt><dd>${t.scope ? esc(t.scope) : `<span class="muted">未填</span>`}</dd>${(t.rules || []).length ? `<dt>规则</dt><dd>${t.rules.map(esc).join("<br>")}</dd>` : ""}${t.tracking?.done_when ? `<dt>完成标准</dt><dd>${esc(t.tracking.done_when)}</dd>` : ""}</dl>`, footer: t.narrative ? `叙述页：${ref(t.narrative)}` : "" })
      + box({ title: "阶段历史", meta: `${t.history.length} 次变化`, body: hist })
      + (T.goals.length ? box({ title: "目标", meta: `${T.goals.length} 个`, flush: true, body: `<div class="rows">${gl}</div>` }) : "")
      + box({ title: "最近记录", link: ["全部记录", `#${base}/log`], flush: true, body: `<div class="tl">${[...t.entries].reverse().slice(0, 5).map(erow).join("") || `<p class="empty" style="padding:16px">无</p>`}</div>` });
  }
  const tl = (t.links?.tasks || []).map(id => { const x = taskOf(id); return `<a class="row r2" href="${x?.owner === "user" ? "#plan/board" : "#agents"}"><span class="t">${esc(x?.title ?? id)}</span><span class="tag">${esc(x?.status ?? "")}</span></a>`; }).join("");
  const pl = (t.links?.plans || []).map(id => { const x = planOf(id); return `<a class="row r2" href="#plan/${x?.rrule ? "reviews" : "tree"}"><span class="t">${esc(x?.title ?? ({ quarterly: "季度复盘", annual: "年度复盘" })[x?.kind] ?? id)}</span><span class="tag">${esc(x?.period ?? "")}</span></a>`; }).join("");
  const side = box({ title: "下一步", flush: true, body: (S.next || []).length ? `<div class="rows">${S.next.map(n => `<div class="prow"><span class="cb"></span><div class="t">${esc(n)}</div><span></span></div>`).join("")}</div>` : `<p class="empty" style="padding:16px">未写下一步</p>` })
    + box({ title: "阻碍 / 未解决问题", meta: `${(S.blockers || []).length + t.open_issues.length}`, flush: true, body: (S.blockers || []).length + t.open_issues.length ? `<div class="rows">${(S.blockers || []).map(b => `<div class="row r2"><span class="t">${esc(b)}</span><span class="tag warn">阻碍</span></div>`).join("")}${t.open_issues.map(i => `<div class="row r2"><span class="t">${esc(i.title)}</span><span class="tag warn">${md(i.date)}</span></div>`).join("")}</div>` : `<p class="empty" style="padding:16px">无</p>` })
    + box({ title: "关联", flush: true, body: `${tl ? `<div class="hz"><div class="h">任务</div><div class="rows">${tl}</div></div>` : ""}${pl ? `<div class="hz"><div class="h">计划</div><div class="rows">${pl}</div></div>` : ""}${(t.accounts || []).length ? `<div class="hz"><div class="h">账号</div><div class="rows">${t.accounts.map(a => { const x = accById(a); return x ? `<a class="row r2" href="${accHref(x)}"><span class="t">${esc(x.service)}</span><span class="tag">${esc(x.priority ?? "")}</span></a>` : `<div class="row r2"><span class="t">${esc(a)}</span></div>`; }).join("")}</div></div>` : ""}${t.narrative ? `<div class="hz"><div class="h">叙述页</div><div class="rows"><div class="row r2"><span class="t">${ref(t.narrative)}</span></div></div></div>` : ""}` || `<p class="empty" style="padding:16px">无</p>` });
  return { html: head + T4 + `<div class="body">${mainSide(main, side)}</div>` };
}
