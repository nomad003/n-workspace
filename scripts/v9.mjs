// n-life-data schema_version 9 loader (data/*.yaml written by KB, see n-workspace-v9-proposal.md).
// Returns v9 records as-is PLUS v8-compatible aliases so shared logic (identity graph, 2FA, detail pages) keeps one code path.
// Masks e-mail addresses and long phone numbers in every string it passes through (defence in depth; data is already masked).
import fs from "node:fs";
import path from "node:path";
import * as yaml from "js-yaml";
export const mask = v => typeof v !== "string" ? v : v.replace(/([A-Za-z0-9._%+-]{1,2})[A-Za-z0-9._%+-]*@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}/g, "$1***@…").replace(/(?<!\d)1[3-9]\d{5}(\d{4})(?!\d)/g, "•••$1");
const deep = x => Array.isArray(x) ? x.map(deep) : x && typeof x === "object" ? (x instanceof Date ? x.toISOString().slice(0, 10) : Object.fromEntries(Object.entries(x).map(([k, v]) => [k, k === "url" ? v : deep(v)]))) : mask(x);
const load = (dir, n) => { const f = path.join(dir, `${n}.yaml`); if (!fs.existsSync(f)) return null; try { return deep(yaml.load(fs.readFileSync(f, "utf8"))); } catch (e) { return { _error: e.message.split("\n")[0] }; } };
export const isV9 = dir => { const d = load(dir, "accounts"); return d?.schema_version === 9; };
const VIA_BACK = { "gmail-google": "google-account", "microsoft-账号-outlook": "microsoft-account", "qq-邮箱": "qq-account" };
const FA_BACK = v => v === "na" ? "—" : v === "unknown" ? "待确认" : v; // core.twoFaState reads these back to the same enum
const PH = v => v == null || v === "" || (Array.isArray(v) && !v.length) ? "待补充" : v;

export function loadV9(LIFE_ROOT, warn) {
  const dir = path.join(LIFE_ROOT, "data"), D = {};
  for (const n of ["identities", "account-groups", "accounts", "subscriptions", "plans", "tasks", "sections", "finance", "profile", "content"]) {
    D[n] = load(dir, n); if (D[n]?._error) warn(`${n}.yaml: YAML error ${D[n]._error}`);
    else if (D[n] && n !== "finance" && n !== "profile" && n !== "content" && D[n].schema_version !== 9) warn(`${n}.yaml: schema_version ${D[n].schema_version ?? "missing"} (expected 9)`);
  }
  const groups = (D["account-groups"]?.groups || []).sort((a, b) => a.order - b.order);
  const subLabel = Object.fromEntries(groups.flatMap(g => (g.subcategories || []).map(s => [`${g.id}/${s.id}`, s.label])));
  const ids = D.identities?.identities || [], accRaw = D.accounts?.accounts || [];
  const byAcc = Object.fromEntries(accRaw.map(a => [a.id, a]));
  const accounts = accRaw.map(a => ({ ...a,
    email_id: PH(a.identity_ids), login_via: PH((a.login_via || []).map(l => l.method === "oauth" ? VIA_BACK[l.via] ?? l.via : l.method === "app-scan" ? "wechat" : l.method === "sms" ? "phone-sms" : l.method === "unknown" ? "待补充" : "email").filter(Boolean)),
    login_method: (a.login_via || []).map(l => `${l.method}${l.via ? `:${l.via}` : ""}${l.confirmed ? "" : "（待确认）"}`).join(" / ") || "待补充",
    recovery: PH(a.recovery), two_fa: FA_BACK(a.two_fa), category: subLabel[`${a.group}/${a.subcategory}`] ?? a.legacy?.category ?? a.subcategory, risk: a.legacy?.risk ?? a.priority,
    phone_binding: (a.identity_ids || []).some(i => /phone/.test(i)) ? "已绑定" : "待补充" }));
  const identities = ids.map(i => ({ ...i, address: i.address_masked, two_fa: FA_BACK(i.two_fa), account: byAcc[i.anchor_account]?.service ?? null }));
  const subscriptions = (D.subscriptions?.subscriptions || []).map(s => ({ ...s, state: s.status, status: s.legacy?.status ?? s.status, amount: s.amount ?? "待补充", currency: s.currency ?? "待补充",
    renew_date: s.renew_date ?? (s.renew_day ? `约每月 ${s.renew_day} 日` : "待补充"), billing: s.paid_via ? byAcc[s.paid_via]?.service ?? s.paid_via : s.legacy?.billing ?? "待补充" }));
  const tasks = (D.tasks?.tasks || []).map(t => ({ ...t, due: t.due ?? (t.due_event ? null : null) }));
  const plans = D.plans?.plans || [], reviews = D.plans?.reviews || [], sections = D.sections?.sections || [];
  // folders referenced by sections that do not exist (e.g. reviews/) are reported, never fatal
  const missingDirs = [...new Set(sections.flatMap(s => s.tabs.flatMap(t => t.source)).filter(u => /^life:\/\/[^#?]+\/$/.test(u)).map(u => u.slice(7)).filter(d => !fs.existsSync(path.join(LIFE_ROOT, d))))];
  // non-markdown files (resume pdf/html, report html/pdf/assets) under section folders
  const files = []; const walk = (d, rel) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.name.startsWith(".")) continue; const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) { if (!["data", "tools", "schemas", "templates"].includes(r)) walk(path.join(d, e.name), r); } else if (!/\.(md|enc)$/.test(e.name)) files.push({ path: r, size: fs.statSync(path.join(d, e.name)).size }); } };
  walk(LIFE_ROOT, "");
  return { schema_version: 9, accounts, identities, subscriptions, tasks, plans, reviews, groups, sections, missingDirs, files,
    updated: Object.fromEntries(Object.entries(D).map(([k, v]) => [k, v?.updated ? String(v.updated) : null])) };
}
