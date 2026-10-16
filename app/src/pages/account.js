// Account detail page: #account/<stable-id>
import { M, accById, accHref, catOf, catPages, relatedSubs, relatedTasks, relatedNotes, accounts } from "../data.js";
import { buildModel, fa, prio, missingOf, KEY_FIELDS, mask, noPM } from "../identity.js";
import { esc, known, header, card, more, riskC, badge, noteHref } from "../ui.js";
const FA = { na: ["不适用", "infra"], on: ["已开启", "ai"], off: ["未开启", "err"], unknown: ["待确认", "modes"] };
const VIA_L = { "google-oauth": "Google OAuth", "google-account": "Google 账号", "microsoft-account": "Microsoft 账号", "qq-account": "QQ 账号", wechat: "微信", "phone-sms": "手机短信", email: "邮箱 + 密码/验证码" };
const LABEL = { service: "服务", category: "category", purpose: "用途", account: "登录名", login_method: "登录方式（原文）", login_via: "登录方式", email_id: "绑定身份", recovery: "恢复", two_fa: "2FA", phone_binding: "绑定手机", password_location: "密码保管处", status: "状态", risk: "risk", priority: "priority", last_checked: "最后核对", url: "安全页", notes: "备注" };
const ET = { login: "注册/登录", oauth: "OAuth / 经由", recovery: "恢复/绑定", notify: "通知" };
export default async function (id) {
  const a = accById(id);
  if (!a) return { html: header("账号", "tui", []) + `<div class="body"><p class="empty">未找到账号：${esc(id)}　<a href="#accounts/identities">返回账号管理</a></p></div>` };
  const m = buildModel(accounts(), M.identities?.items || []), x = m.accs.find(y => y.service === a.service) || a;
  const cat = catOf(a), pg = catPages().find(p => p.slug === cat.slug), p = prio(a), f = FA[fa(a.two_fa)], miss = missingOf(a);
  const url = known(a.url) && /^https?:\/\//.test(a.url) ? a.url : null;
  const ids = [...new Set([...(x._edges || []).filter(e => e.id).map(e => e.id), ...[].concat(a.email_id ?? []).map(v => String(v).replace(/[（(].*$/, ""))])].map(i => m.ids.find(y => y.id === i)).filter(Boolean);
  const roleOf = i => (x._edges || []).filter(e => e.id === i.id).map(e => ET[e.type] + (e.inferred ? "（推断）" : "")).join(" · ") || "绑定";
  const [subsR, tasksR, notes] = [relatedSubs(a), relatedTasks(a), await relatedNotes(a)];
  const val = k => { const v = a[k]; if (k === "url") return url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url)}</a>` : "";
    if (k === "login_via" && known(v)) return esc(VIA_L[String(v).replace(/[（(].*$/, "").trim()] ?? v) + (/待确认/.test(v) ? "（待确认）" : "");
    if (k === "email_id" || k === "recovery") return [].concat(v ?? []).filter(known).map(z => { const i = m.ids.find(y => y.id === String(z).replace(/[（(].*$/, "")); return i ? `<a class="tag" href="#accounts/identities?id=${encodeURIComponent(i.id)}">${esc(i.label)}</a>` : esc(z); }).join("");
    if (k === "two_fa") return known(v) ? `<span class="sd L-${f[1]}">${esc(v)}</span>` : "";
    if (k === "status") return badge(v);
    return typeof v === "object" ? esc(mask(JSON.stringify(v))) : known(v) ? esc(mask(v)) : ""; };
  const keys = [...Object.keys(LABEL).filter(k => k in a), ...Object.keys(a).filter(k => !(k in LABEL) && !["name", "privacy", "legacy", "identity_ids", "group", "subcategory", "id", "parent_id", "two_fa_detail"].includes(k) && !k.startsWith("_"))];
  const shown = keys.filter(k => val(k)), hidden = keys.filter(k => !val(k));
  const nrow = n => `<a class="nrow" href="${noteHref(n)}"><span class="t">${esc(n.title)}</span>${n.root === "life" ? `<span class="rt">life</span>` : ""}<span class="m">${esc(n.path.replace(/\/[^/]*$/, ""))}</span><span class="d">${esc(n.updated || "")}</span></a>`;
  const chips = [p && `<span class="chip L-${riskC(String(p).slice(0, 2))}">${esc(p)}</span>`, pg && `<a href="#accounts/groups/${pg.slug}">${esc(pg.label)}</a>`, `2FA <span class="sd L-${f[1]}">${f[0]}</span>`, miss.length ? `<span class="miss">${miss.length} 项待补充</span>` : "字段完整"];
  const spof = m.spof.filter(s => s.key === x._k);
  return { html: header(esc(a.service), "tui", chips) + `<div class="body">
    <nav class="crumbs"><a href="#accounts/groups">账号 · 分类</a>${pg ? `<span class="sep">/</span><a href="#accounts/groups/${pg.slug}">${esc(pg.label)}</a>` : ""}${a.subcategory ? `<span class="sep">/</span><a href="#accounts/groups/${pg?.slug}/${a.subcategory}">${esc(a.category)}</a>` : ""}<span class="sep">/</span><span>${esc(a.service)}</span></nav>
    ${spof.map(s => `<div class="al L-err"><span class="lv">单点</span>${esc(s.title)}</div>`).join("")}
    <div class="adetail-top">${url ? `<a class="btn primary" href="${esc(url)}" target="_blank" rel="noopener noreferrer">打开安全设置 ↗</a>` : `<span class="miss">安全页 url 待补充</span>`}
      ${ids.map(i => `<a class="idchip" href="#accounts/identities?id=${encodeURIComponent(i.id)}"><span class="ik">${i.kind === "phone" ? "☏" : "@"}</span><b>${esc(i.label)}</b><small>${esc(roleOf(i))}</small></a>`).join("") || `<span class="miss">未绑定身份</span>`}</div>
    <div class="grid">${card("字段", `<dl class="kv">${shown.map(k => `<dt>${esc(LABEL[k] ?? k)}</dt><dd>${val(k)}</dd>`).join("")}</dl>${hidden.length ? `<p class="note">${hidden.length} 个字段待补充（已隐藏）</p>` : ""}`, { span: "s7" })}
      ${card("缺失字段检查", `<div class="chk">${KEY_FIELDS.map(k => `<div class="ci ${miss.includes(k) ? "bad" : "ok"}"><span>${miss.includes(k) ? "✗" : "✓"}</span>${esc(LABEL[k] ?? k)}<small>${esc(k)}</small></div>`).join("")}
        <div class="ci ${noPM(a) ? "bad" : known(a.password_location) ? "ok" : "unknown"}"><span>${noPM(a) ? "✗" : known(a.password_location) ? "✓" : "?"}</span>使用密码管理器</div></div>`, { span: "s5", right: `${KEY_FIELDS.length - miss.length}/${KEY_FIELDS.length}` })}</div>
    <div class="grid">${card("相关订阅", subsR.length ? `<div class="slist">${subsR.map(s => `<a class="srow" href="#accounts/subscriptions"><span class="t">${esc(s.service)}</span><span class="m">${esc([s.plan, known(s.amount) ? `${s.amount} ${s.currency}` : "", s.state ?? s.status, s.paid_via ? `经 ${accById(s.paid_via)?.service ?? s.paid_via}` : ""].filter(known).join(" · "))}</span></a>`).join("")}</div>` : `<p class="empty">无</p>`, { span: "s6", right: subsR.length })}
      ${card("相关任务", tasksR.length ? `<div class="slist">${tasksR.map(t => `<a class="srow" href="#plan/board"><span class="t">${esc(t.title)}</span><span class="m">${esc([t.owner, t.status, t.due].filter(known).join(" · "))}</span></a>`).join("")}</div>` : `<p class="empty">无</p>`, { span: "s6", right: tasksR.length })}</div>
    ${card("相关笔记", notes.byTitle.length + notes.byText.length ? `<div class="nlist">${notes.byTitle.map(nrow).join("")}${notes.byText.slice(0, 8).map(nrow).join("")}</div>${notes.byText.length > 8 ? more(notes.byText.length - 8, `<div class="nlist">${notes.byText.slice(8).map(nrow).join("")}</div>`, "展开全部") : ""}<p class="note">按服务名「${esc(String(a.service).split(/\s*[/（(]\s*/)[0])}」匹配标题与正文。</p>` : `<p class="empty">无</p>`, { span: "s12 solo", right: notes.byTitle.length + notes.byText.length })}
  </div>` };
}
