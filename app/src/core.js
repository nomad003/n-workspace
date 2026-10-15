// Shared logic (browser + Node build): normalization, filters, countdowns, risk alerts.
export const as = v => v == null ? [] : Array.isArray(v) ? v : [v];
export const isPublic = r => r?.privacy === "public"; // privacy comes ONLY from data; missing => private

// Canonical names follow n-knowledge-base data/README.md (feat/data-layer). Aliases kept for tolerance.
const ALIASES = {
  two_fa: ["2fa", "mfa", "twofa", "two_factor", "twoFactor", "2FA", "MFA"],
  renew_date: ["next_renewal", "renewal_date", "next_billing", "renew_at", "expires"],
  due: ["deadline", "due_date", "dueDate"],
  service: ["name", "account_name"],
  amount: ["price", "cost", "fee", "balance"],
  billing: ["payment_method", "billing_method"],
  last_checked: ["last_login", "last_used"],
  handle: ["account"],
};
// Unknown placeholder used by the KB.
export const UNKNOWN = /^(待补充|待确认|待核实|不适用|tbd|unknown|n\/a)/i;
export const known = v => v != null && v !== "" && !UNKNOWN.test(String(v).trim());
const SECRET = /^pass(word|wd)?$|secret|token|otp_?seed|recovery_?codes?|^pin$|cvv|private_?key|api_?key/i;

export function normalize(item, kind) {
  if (item == null || typeof item !== "object") return item;
  const o = {};
  for (const [k, v] of Object.entries(item)) if (!SECRET.test(k)) o[k] = v;
  for (const [canon, al] of Object.entries(ALIASES)) {
    if (canon === "service" && kind !== "accounts" && kind !== "subscriptions") continue;
    if (canon === "handle" && kind !== "content") continue;
    if (canon === "amount" && kind === "accounts") continue;
    if (o[canon] == null) for (const a of al) if (o[a] != null) { o[canon] = o[a]; break; }
  }
  if (kind === "tasks" && o.title == null) o.title = o.name;
  if (o.name == null && kind !== "profile") { const n = o.service ?? o.institution ?? o.item ?? o.title ?? o.platform; if (n != null) o.name = n; }
  for (const k of ["renew_date", "billed_date", "due", "last_checked", "updated", "created", "expires", "date"])
    if (o[k] instanceof Date) o[k] = o[k].toISOString().slice(0, 10); else if (o[k] != null && typeof o[k] !== "object") o[k] = String(o[k]);
  return o;
}

// Accept a top-level list, {items:[..]}, {<kind>:[..]}, or an object of named lists (flattened with kind=<key>).
export function toItems(doc, kind) {
  if (doc == null) return [];
  if (Array.isArray(doc)) return doc.map(x => normalize(x, kind));
  if (Array.isArray(doc.items)) return doc.items.map(x => normalize(x, kind));
  if (Array.isArray(doc[kind])) return doc[kind].map(x => normalize(x, kind));
  const lists = Object.entries(doc).filter(([, v]) => Array.isArray(v) && v.some(x => x && typeof x === "object"));
  if (lists.length) return lists.flatMap(([k, v]) => v.map(x => normalize({ kind: k, ...x }, kind)));
  return [];
}

export function match(r, f = {}, now = Date.now()) {
  for (const [k, vals] of Object.entries(f)) {
    if (k === "any") { if (!vals.some(s => match(r, s, now))) return false; continue; }
    const p = r.origin?.source_path || "";
    if (k === "path") { if (!vals.some(x => p.startsWith(x))) return false; continue; }
    if (k === "not_path") { if (vals.some(x => p.startsWith(x))) return false; continue; }
    if (k.endsWith("!~")) { const f = String(r[k.slice(0, -2)] ?? ""); if (vals.some(x => f.includes(x))) return false; continue; }
    if (k.endsWith("~")) { const f = String(r[k.slice(0, -1)] ?? ""); if (!vals.some(x => f.includes(x))) return false; continue; } // substring
    if (k === "updated_within_days") { const t = Date.parse(r.updated); if (isNaN(t) || (now - t) / 864e5 > vals) return false; continue; }
    if (vals.includes(null) && r[k] == null) continue;
    if (!as(r[k]).some(x => vals.includes(String(x)))) return false;
  }
  return true;
}

export const daysUntil = (d, now = Date.now()) => {
  const iso = String(d ?? "").match(/^(\d{4}-\d{2}-\d{2})/); if (!iso) return null;
  const t = Date.parse(iso[1] + "T00:00:00"); const today = new Date(now); today.setHours(0, 0, 0, 0);
  return Math.round((t - today.getTime()) / 864e5);
};
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
// renew_date may be ISO ("2026-10-28"), annotated ("2026-07-24（曾标）"), "约每月 28 日", or a placeholder.
export function nextRenewal(s, now = Date.now()) {
  const v = String(s.renew_date ?? "");
  const iso = v.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return { date: iso[1], approx: v.length > 10 };
  const mon = v.match(/每月\s*(\d{1,2})\s*[日号]/);
  if (mon) { const d = new Date(now); d.setHours(0, 0, 0, 0); const day = +mon[1];
    let n = new Date(d.getFullYear(), d.getMonth(), day); if (n < d) n = new Date(d.getFullYear(), d.getMonth() + 1, day);
    return { date: ymd(n), approx: /约/.test(v) }; }
  return null;
}
// tasks.yaml has no due field; notes carry hints like "#4 · Q4 P1 · 2026-12" (=> end of that month, approximate).
export function taskDue(t) {
  if (known(t.due) && /^\d{4}-\d{2}-\d{2}/.test(t.due)) return { date: t.due.slice(0, 10), approx: false };
  const m = String(t.notes ?? "").match(/(\d{4})-(\d{2})(?!-\d)/); if (!m) return null;
  return { date: ymd(new Date(+m[1], +m[2], 0)), approx: true };
}
const SUB_INACTIVE = /cancel|one-time|refund|预充值/i;
const has2fa = a => { const v = a.two_fa; if (v == null || !known(v)) return null;
  if (typeof v === "boolean") return v; return !/^(no|none|false|off|无|否|未开|未开启|关闭|0)/i.test(String(v).trim()); };
export const isAgentTask = t => t.owner != null && !/^(user|me|我)$/i.test(String(t.owner).trim());

export function overview(bundle, cfg = {}, now = Date.now()) {
  const win = cfg.window_days ?? 30, riskDays = cfg.risk_renewal_days ?? 14, m = bundle.modules;
  const upcoming = [], alerts = [];
  for (const s of m.subscriptions?.items || []) {
    const st = String(s.status ?? "");
    if (/refund/i.test(st)) alerts.push({ level: "medium", module: "subscriptions", msg: `退款处理中：${s.service}${known(s.amount) ? ` ${s.amount} ${s.currency ?? ""}` : ""}${s.billed_date ? `（扣款 ${s.billed_date}）` : ""}` });
    else if (/待核实|暂停|失败|pause/i.test(st) || /付款失败|payment fail/i.test(s.notes ?? "")) alerts.push({ level: /失败|暂停|pause/i.test(st + (s.notes ?? "")) ? "medium" : "low", module: "subscriptions", msg: `订阅需核实：${s.service}（${st}）` });
    if (SUB_INACTIVE.test(st) || /canceled/i.test(st)) continue;
    const r = nextRenewal(s, now); if (!r) continue;
    const d = daysUntil(r.date, now);
    if (d < 0 && !/^active$/i.test(st)) continue; // stale date on a paused/unverified sub: alert above, no countdown
    if (d <= win) upcoming.push({ kind: "续费", name: s.service, date: r.date, approx: r.approx, days: d, extra: [s.amount, s.currency].filter(known).join(" ") });
    if (d <= riskDays) alerts.push({ level: d < 0 ? "high" : "medium", module: "subscriptions", msg: `${s.service} ${d < 0 ? `已过续费日 ${-d} 天` : `${d} 天后续费`}` });
  }
  for (const t of m.tasks?.items || []) {
    if (/done|closed|cancel/i.test(t.status || "")) continue;
    const r = taskDue(t); if (!r) continue; const d = daysUntil(r.date, now);
    if (d <= Math.max(win, 90)) upcoming.push({ kind: "截止", name: t.title, date: r.date, approx: r.approx, days: d, extra: t.owner || "" });
    if (d < 0) alerts.push({ level: "high", module: "tasks", msg: `任务逾期 ${-d} 天：${t.title}` });
  }
  const docs = [...as(m.profile?.data?.documents), ...as(m.profile?.data?.emergency?.documents)];
  for (const doc of docs) {
    const d = daysUntil(doc?.expires, now); if (d == null) continue;
    if (d <= 180) upcoming.push({ kind: "证件到期", name: doc.name, date: doc.expires, days: d });
    if (d <= 60) alerts.push({ level: d < 0 ? "high" : "medium", module: "profile", msg: `证件 ${doc.name} ${d < 0 ? "已过期" : `${d} 天后到期`}` });
  }
  const unknown2fa = [];
  for (const a of m.accounts?.items || []) {
    if (/closed/i.test(a.status || "")) continue;
    const f = has2fa(a), core = /^P[01]$/i.test(String(a.risk ?? ""));
    if (f === false) alerts.push({ level: core ? "high" : "medium", module: "accounts", msg: `账号未开启 2FA：${a.service}（${a.risk ?? "?"}）` });
    else if (f === null && core) unknown2fa.push(a.service);
    if (/to-close/i.test(a.status || "")) alerts.push({ level: "low", module: "accounts", msg: `待注销账号：${a.service}` });
  }
  if (unknown2fa.length) alerts.push({ level: "medium", module: "accounts", msg: `P0/P1 账号 2FA 待确认（${unknown2fa.length}）：${unknown2fa.join("、")}` });
  upcoming.sort((a, b) => a.days - b.days);
  const order = { high: 0, medium: 1, low: 2 }; alerts.sort((a, b) => order[a.level] - order[b.level]);
  const agentTasks = (m.tasks?.items || []).filter(isAgentTask).filter(t => !/done|closed|cancel/i.test(t.status || ""));
  const recent = (bundle.records || []).filter(r => r.status === "active" || r.status === "draft")
    .sort((a, b) => String(b.updated).localeCompare(String(a.updated))).slice(0, 8);
  return { upcoming, alerts, agentTasks, recent };
}
