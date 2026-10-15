// Shared logic (browser + Node build): normalization, filters, countdowns, risk alerts.
export const as = v => v == null ? [] : Array.isArray(v) ? v : [v];
export const isPublic = r => r?.privacy === "public"; // privacy comes ONLY from data; missing => private

const ALIASES = {
  two_fa: ["2fa", "mfa", "twofa", "two_factor", "twoFactor", "2FA", "MFA"],
  next_renewal: ["renewal_date", "next_billing", "renew_at", "renews", "renewal", "expires", "expire", "expiry"],
  due: ["deadline", "due_date", "dueDate"],
  publish_at: ["published_at", "date", "scheduled_at"],
  name: ["title", "service", "account_name"],
  amount: ["price", "cost", "fee"],
  cycle: ["billing_cycle", "period", "interval"],
  last_login: ["last_used", "last_seen"],
};
const SECRET = /pass(word|wd)?|secret|token|otp_?seed|recovery_?codes?|^pin$|cvv|private_?key|api_?key/i;

export function normalize(item, kind) {
  if (item == null || typeof item !== "object") return item;
  const o = {};
  for (const [k, v] of Object.entries(item)) if (!SECRET.test(k)) o[k] = v;
  for (const [canon, al] of Object.entries(ALIASES)) {
    if (canon === "name" && kind === "tasks") continue;
    if (o[canon] == null) for (const a of al) if (o[a] != null) { o[canon] = o[a]; break; }
  }
  if (kind === "tasks" && o.title == null) o.title = o.name;
  for (const k of ["next_renewal", "due", "publish_at", "last_login", "updated", "created", "expires"])
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
    if (k === "updated_within_days") { const t = Date.parse(r.updated); if (isNaN(t) || (now - t) / 864e5 > vals) return false; continue; }
    if (vals.includes(null) && r[k] == null) continue;
    if (!as(r[k]).some(x => vals.includes(String(x)))) return false;
  }
  return true;
}

export const daysUntil = (d, now = Date.now()) => {
  const t = Date.parse(d); if (isNaN(t)) return null;
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  return Math.round((t - today.getTime()) / 864e5);
};
const has2fa = a => { const v = a.two_fa ?? a.two_fa_method; if (v == null) return null;
  if (typeof v === "boolean") return v; return !/^(no|none|false|off|无|未开启|0)$/i.test(String(v).trim()); };

export function overview(bundle, cfg = {}, now = Date.now()) {
  const win = cfg.window_days ?? 30, riskDays = cfg.risk_renewal_days ?? 14, m = bundle.modules;
  const upcoming = [], alerts = [];
  for (const s of m.subscriptions?.items || []) {
    if (/cancel/i.test(s.status || "")) continue;
    const d = daysUntil(s.next_renewal, now); if (d == null) continue;
    if (d <= win) upcoming.push({ kind: "续费", name: s.name, date: s.next_renewal, days: d, extra: [s.amount, s.currency].filter(x => x != null).join(" ") });
    if (d <= riskDays) alerts.push({ level: d < 0 ? "high" : "medium", module: "subscriptions", msg: `${s.name} ${d < 0 ? `已过续费日 ${-d} 天` : `${d} 天后续费`}${s.auto_renew === false ? "（未开自动续费）" : ""}` });
  }
  for (const t of m.tasks?.items || []) {
    if (/done|cancel/i.test(t.status || "")) continue;
    const d = daysUntil(t.due, now); if (d == null) continue;
    if (d <= win) upcoming.push({ kind: "截止", name: t.title, date: t.due, days: d, extra: t.owner || "" });
    if (d < 0) alerts.push({ level: "high", module: "tasks", msg: `任务逾期 ${-d} 天：${t.title}` });
  }
  for (const doc of as(m.profile?.data?.documents)) {
    const d = daysUntil(doc?.expires, now); if (d == null) continue;
    if (d <= 180) upcoming.push({ kind: "证件到期", name: doc.name, date: doc.expires, days: d });
    if (d <= 60) alerts.push({ level: d < 0 ? "high" : "medium", module: "profile", msg: `证件 ${doc.name} ${d < 0 ? "已过期" : `${d} 天后到期`}` });
  }
  for (const a of m.accounts?.items || []) {
    if (/closed/i.test(a.status || "")) continue;
    const f = has2fa(a);
    if (f === false) alerts.push({ level: "high", module: "accounts", msg: `账号未开启 2FA：${a.name}` });
    else if (f === null) alerts.push({ level: "low", module: "accounts", msg: `账号 2FA 状态未知：${a.name}` });
    if (/at_risk/i.test(a.status || "") || /high/i.test(a.risk_level || a.risk || "")) alerts.push({ level: "high", module: "accounts", msg: `账号风险：${a.name}${a.risk && typeof a.risk === "string" ? " — " + a.risk : ""}` });
  }
  upcoming.sort((a, b) => a.days - b.days);
  const order = { high: 0, medium: 1, low: 2 }; alerts.sort((a, b) => order[a.level] - order[b.level]);
  const agentTasks = (m.tasks?.items || []).filter(t => /^agent/i.test(String(t.owner || "")) || t.agent).filter(t => !/done|cancel/i.test(t.status || ""));
  const recent = (bundle.records || []).filter(r => r.status === "active" || r.status === "draft")
    .sort((a, b) => String(b.updated).localeCompare(String(a.updated))).slice(0, 8);
  return { upcoming, alerts, agentTasks, recent };
}
