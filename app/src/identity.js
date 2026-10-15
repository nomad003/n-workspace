// Identity model for the 账号 tab: identity nodes (emails / phones) → accounts, OAuth chains, recovery edges, SPOFs.
// Prefers explicit fields (data/identities.yaml; accounts.email_id / login_via / recovery / url). When they are absent it
// falls back to parsing login_method / phone_binding text. Inferred links are flagged `inferred`; no value is invented
// (addresses, URLs and 2FA states only come from data).
import { known } from "./core.js";
const as = v => v == null ? [] : Array.isArray(v) ? v : String(v).split(/[,，、;；]\s*/);
const RANK = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };
export const rank = r => RANK[String(r ?? "").toUpperCase()] ?? 9;
export const fa = v => !known(v) ? "unknown" : /^(no|none|false|off|无|否|未开|关闭)/i.test(String(v)) ? "off" : "on";

// Fallback identity catalogue, used only when identities.yaml is absent. Keys match login_method text.
const FALLBACK = [
  { id: "gmail", kind: "email", label: "Gmail", provider: "Google", anchor: /^Gmail|^Google 账号$/i, re: /gmail|google/i },
  { id: "outlook", kind: "email", label: "Outlook", provider: "Microsoft", anchor: /^Microsoft 账号/i, re: /outlook|microsoft/i },
  { id: "qq", kind: "email", label: "QQ 邮箱", provider: "Tencent", anchor: /^QQ ?邮箱/i, re: /qq ?邮箱|^qq$|\bqq\b/i },
  { id: "phone", kind: "phone", label: "手机号", provider: "运营商", anchor: /手机号运营商/, re: /手机|phone|sms/i },
];

export function buildModel(accounts, identityItems = []) {
  const explicit = identityItems.length > 0;
  const accs = accounts.map((a, i) => ({ ...a, _k: `a${i}`, _edges: [] }));
  const bySvc = s => accs.find(a => String(a.service).toLowerCase() === String(s).toLowerCase())
    || accs.find(a => String(a.service).toLowerCase().startsWith(String(s).toLowerCase()));
  // ---- identities
  let ids;
  if (explicit) ids = identityItems.map((x, i) => {
    const id = String(x.id ?? x.key ?? x.address ?? x.email ?? x.phone ?? `id${i}`);
    const kind = x.kind ?? x.type ?? (/@/.test(x.address ?? x.email ?? "") ? "email" : x.phone ? "phone" : "email");
    const anchor = x.account ? bySvc(x.account) : null;
    return { ...x, id, kind, label: x.label ?? x.name ?? x.provider ?? id, address: x.address ?? x.email ?? x.phone, anchor, inferred: false };
  });
  else ids = FALLBACK.map(f => {
    const anchor = accs.find(a => f.anchor.test(String(a.service)));
    const addr = f.kind === "phone" ? accs.map(a => a.phone_binding).find(known) : null; // e.g. "尾号5875" as recorded
    return { id: f.id, kind: f.kind, label: f.label, provider: f.provider, address: addr ?? null, anchor, inferred: true, _re: f.re };
  });
  const idOf = s => { const t = String(s ?? "").trim(); if (!t) return null;
    return ids.find(i => i.id === t || i.address === t || String(i.label).toLowerCase() === t.toLowerCase())
      || (explicit ? null : ids.find(i => i._re.test(t))); };
  // identity-level fields: explicit or from the anchor account (2FA, risk) — never guessed
  for (const i of ids) {
    i.two_fa = i.two_fa ?? i["2fa"] ?? i.anchor?.two_fa ?? null;
    i.risk = known(i.risk) ? i.risk : known(i.anchor?.risk) ? i.anchor.risk : null;
    i.role = i.role ?? i.purpose ?? i.anchor?.purpose ?? null;
  }
  // ---- edges: {to: identity|account, type: login|oauth|recovery|notify, inferred}
  const addE = (a, e) => { if (!e.id && !e.acc) return; if (a._edges.some(x => x.type === e.type && x.id === e.id && x.acc === e.acc)) return; a._edges.push(e); };
  for (const a of accs) {
    const isAnchor = ids.find(i => i.anchor === a);
    // explicit fields
    for (const e of as(a.email_id)) { const i = idOf(e); if (i) addE(a, { type: "login", id: i.id }); }
    for (const v of as(a.login_via)) { const t = bySvc(v) || ids.find(i => i.provider && new RegExp(i.provider, "i").test(v))?.anchor; const i = idOf(v);
      if (t && t !== a) addE(a, { type: "oauth", acc: t._k, id: ids.find(x => x.anchor === t)?.id }); else if (i) addE(a, { type: "oauth", id: i.id }); }
    for (const v of as(a.recovery)) { if (!known(v)) continue; const i = idOf(v), t = bySvc(v); if (i) addE(a, { type: "recovery", id: i.id }); else if (t && t !== a) addE(a, { type: "recovery", acc: t._k }); }
    if (a._edges.length) continue;
    // fallback: parse login_method ("Google OAuth（Gmail） · 绑定 QQ邮箱", "Outlook 注册 · 手机登录" …)
    const lm = known(a.login_method) ? String(a.login_method) : "";
    for (const [n, seg] of lm.split(/\s*·\s*/).entries()) {
      const s = seg.trim(); if (!s) continue;
      for (const part of s.split(/\s*(?:\+|\/|=)\s*/)) {
        const type = /绑定/.test(s) ? "recovery" : /oauth/i.test(part) ? "oauth" : /收单|订阅/.test(part) ? "notify" : "login";
        const svc = !isAnchor && accs.find(x => x !== a && /^(微信|GitHub)$/.test(x.service) && part.includes(x.service));
        if (svc) { addE(a, { type: "oauth", acc: svc._k, id: ids.find(i => i.anchor === svc)?.id, inferred: true }); continue; }
        const i = ids.find(i => i._re?.test(part)); if (!i || i.anchor === a) continue;
        if (type === "oauth" && i.anchor) addE(a, { type: "oauth", acc: i.anchor._k, id: i.id, inferred: true });
        else addE(a, { type, id: i.id, inferred: true });
      }
    }
    if (known(a.phone_binding) && !isAnchor?.kind?.startsWith("phone")) { const p = ids.find(i => i.kind === "phone"); if (p && p.anchor !== a) addE(a, { type: "recovery", id: p.id, inferred: true }); }
  }
  // anchors' own recovery (e.g. Gmail account bound to QQ) becomes identity recovery
  for (const i of ids) {
    i.recovery = explicit ? as(i.recovery).filter(known) : [];
    if (!i.recovery.length && i.anchor) i.recovery = i.anchor._edges.filter(e => e.type === "recovery" && e.id && e.id !== i.id).map(e => ids.find(x => x.id === e.id)?.label);
    i.recoveryIds = i.anchor ? i.anchor._edges.filter(e => e.type === "recovery" && e.id).map(e => e.id) : [];
  }
  // primary group for each account
  for (const a of accs) {
    const l = a._edges.find(e => e.type === "login" && e.id) || a._edges.find(e => e.type === "oauth" && e.id);
    const anchorOf = ids.find(i => i.anchor === a);
    a._group = anchorOf?.id ?? l?.id ?? "_none";
    a._via = a._edges.filter(e => e.type === "oauth").map(e => accs.find(x => x._k === e.acc)?.service ?? ids.find(i => i.id === e.id)?.label);
    a._rec = a._edges.filter(e => e.type === "recovery").map(e => e.acc ? accs.find(x => x._k === e.acc)?.service : ids.find(i => i.id === e.id)?.label);
  }
  for (let pass = 0; pass < 3; pass++) for (const a of accs) if (a._group === "_none") { // OAuth via another account → inherit its group
    const o = a._edges.find(e => e.type === "oauth" && e.acc), t = o && accs.find(x => x._k === o.acc); if (t && t._group !== "_none") a._group = t._group; }
  // dependents
  for (const i of ids) {
    i.accounts = accs.filter(a => a !== i.anchor && a._edges.some(e => (e.id === i.id) || (i.anchor && e.acc === i.anchor._k)));
    i.critical = i.accounts.filter(a => rank(a.risk) <= 1 && !/closed/i.test(a.status ?? ""));
  }
  // ---- single points of failure
  const spof = [];
  for (const i of ids) {
    const no2 = fa(i.two_fa) !== "on", noRec = !i.recovery.length;
    if ((no2 || noRec) && i.critical.length >= 3)
      spof.push({ level: no2 && noRec ? "high" : "medium", kind: "identity", id: i.id, title: `${i.label}：${[no2 ? (fa(i.two_fa) === "off" ? "2FA 未开" : "2FA 未确认") : "", noRec ? "无恢复方式记录" : ""].filter(Boolean).join(" + ")}，承载 ${i.critical.length} 个 P0/P1 账号`, items: i.critical.map(a => a.service) });
  }
  for (const a of accs) {
    if (/closed/i.test(a.status ?? "")) continue;
    const rec = a._edges.filter(e => e.type === "recovery"), logins = a._edges.filter(e => e.type === "login"), oauth = a._edges.filter(e => e.type === "oauth");
    const chain = []; let cur = a, guard = 0; // follow oauth links: GitHub → Gmail / Google → (recovery) QQ
    while (cur && guard++ < 5) { const o = cur._edges.find(e => e.type === "oauth" && e.acc); if (!o) break; cur = accs.find(x => x._k === o.acc); if (cur) chain.push(cur.service); }
    if (oauth.length && !logins.length && rec.length <= 1 && rank(a.risk) <= 2)
      spof.push({ level: rank(a.risk) <= 1 ? "high" : "medium", kind: "account", key: a._k, title: `${a.service}：仅通过 ${a._via.join(" / ")} 登录${rec.length ? `，恢复只依赖 ${a._rec[0]}` : "，无独立恢复方式记录"}`, items: chain });
    else if (rec.length === 1 && rec[0].acc && !logins.length && rank(a.risk) <= 2)
      spof.push({ level: "medium", kind: "account", key: a._k, title: `${a.service}：唯一恢复方式是另一个账号 ${a._rec[0]}`, items: [] });
  }
  spof.sort((x, y) => (x.level === "high" ? 0 : 1) - (y.level === "high" ? 0 : 1));
  return { ids, accs, spof, explicit, hasFields: ["email_id", "login_via", "recovery", "url"].filter(f => accounts.some(a => a[f] != null)) };
}

// Per-identity checklist. state: ok | bad | unknown
export function checklist(i, accs) {
  const deps = i.accounts.filter(a => !/closed/i.test(a.status ?? ""));
  const n2 = deps.filter(a => fa(a.two_fa) === "on").length, nChk = i.critical.filter(a => known(a.last_checked)).length;
  return [
    ["地址已录入", known(i.address) ? "ok" : "unknown", known(i.address) ? "" : "address 待补充"],
    ["2FA 已开启", { on: "ok", off: "bad", unknown: "unknown" }[fa(i.two_fa)], fa(i.two_fa) === "unknown" ? "待确认" : ""],
    ["恢复方式已录入", i.recovery.length ? "ok" : "bad", i.recovery.join("、")],
    ["风险等级已定", known(i.risk) ? "ok" : "unknown", known(i.risk) ? i.risk : ""],
    ["P0/P1 依赖已核查", i.critical.length ? (nChk === i.critical.length ? "ok" : "unknown") : "ok", `${nChk}/${i.critical.length} 有 last_checked`],
    ["依赖账号 2FA", deps.length ? (n2 === deps.length ? "ok" : n2 ? "unknown" : "bad") : "ok", `${n2}/${deps.length} 已确认`],
  ];
}
