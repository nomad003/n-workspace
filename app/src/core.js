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
    // KB paths like "13-Life/..." also match their n-life-data location ("life/...") after the split.
    const alt = x => r.root === "life" ? [x, x.replace(/^13-Life\//, "life/")] : [x];
    if (k === "path") { if (!vals.some(x => alt(x).some(y => p.startsWith(y)))) return false; continue; }
    if (k === "not_path") { if (vals.some(x => alt(x).some(y => p.startsWith(y)))) return false; continue; }
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
// ---- 2FA: the ONE shared definition (used by 今天, 账号与订阅, account detail, identity model)
// state: "on" | "off" | "unknown" (待补充/待确认/不确定/missing) | "na" ("—", e.g. a phone number)
export function twoFaState(v) {
  if (typeof v === "boolean") return v ? "on" : "off";
  const t = String(v ?? "").trim();
  if (/^[—–-]+$/.test(t)) return "na";
  if (!known(t) || /^(不确定|uncertain|unsure|未知)/i.test(t)) return "unknown";
  return /^(no|none|false|off|无|否|未开|未开启|关闭|0)/i.test(t) ? "off" : "on";
}
export const priorityOf = a => known(a?.priority) ? String(a.priority) : known(a?.risk) ? String(a.risk) : null; // priority (P0/P1/P2+) wins over risk
export const isImportant = a => /^P[01]\b/i.test(priorityOf(a) ?? "");
export const isLiveAccount = a => !/closed/i.test(a?.status ?? "");
/** Important (P0/P1), live accounts whose 2FA is not confirmed on (off / unknown / 不确定). */
export const weak2fa = accounts => (accounts || []).filter(a => isLiveAccount(a) && isImportant(a) && !["on", "na"].includes(twoFaState(a.two_fa)));
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
  const accs = m.accounts?.items || [], w2 = weak2fa(accs);
  if (w2.length) alerts.push({ level: "high", module: "accounts", kind: "2fa", n: w2.length, msg: `${w2.length} 个重要账号 2FA 未确认`, items: w2.map(a => a.service) });
  for (const a of accs) if (/to-close/i.test(a.status || "")) alerts.push({ level: "low", module: "accounts", msg: `待注销账号：${a.service}` });
  upcoming.sort((a, b) => a.days - b.days);
  const order = { high: 0, medium: 1, low: 2 }; alerts.sort((a, b) => order[a.level] - order[b.level]);
  const agentTasks = (m.tasks?.items || []).filter(isAgentTask).filter(t => !/done|closed|cancel/i.test(t.status || ""));
  const recent = (bundle.records || []).filter(r => r.status === "active" || r.status === "draft")
    .sort((a, b) => String(b.updated).localeCompare(String(a.updated))).slice(0, 8);
  return { upcoming, alerts, agentTasks, recent };
}

// kb:// and life:// link resolution against bundle records (exact, +.md, or unique basename).
export function resolveLink(records, href) {
  const m = String(href).match(/^(kb|life):\/\/(.+)$/); if (!m) return null;
  const root = m[1]; let clean = m[2]; try { clean = decodeURIComponent(clean); } catch {}
  clean = clean.replace(/^\/+/, "").replace(/^n-knowledge-base\//, "").replace(/#.*$/, "").replace(/\.md$/, "");
  const hit = records.find(r => r.root === root && (r.origin?.source_path === clean || r.origin?.source_path === clean + ".md"));
  if (hit) return hit;
  const base = clean.split("/").pop().replace(/\.md$/, ""), hs = records.filter(r => r.root === root && r.origin?.source_path.replace(/\.md$/, "").split("/").pop() === base);
  return hs.length === 1 ? hs[0] : null;
}

// ---- v9 tasks / plans: a due value means "by the END of that period" (2026-12 → 12-31, 2026-Q4 → 12-31, 2027-H1 → 06-30)
const pad = n => String(n).padStart(2, "0"), lastDay = (y, m) => new Date(y, m, 0).getDate();
export function dueEnd(due) {
  const s = String(due ?? ""); let m;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/))) return s;
  if ((m = s.match(/^(\d{4})-(\d{2})$/))) return `${s}-${pad(lastDay(+m[1], +m[2]))}`;
  if ((m = s.match(/^(\d{4})-Q([1-4])$/))) return `${m[1]}-${pad(m[2] * 3)}-${pad(lastDay(+m[1], m[2] * 3))}`;
  if ((m = s.match(/^(\d{4})-H([12])$/))) return m[2] === "1" ? `${m[1]}-06-30` : `${m[1]}-12-31`;
  if ((m = s.match(/^(\d{4})$/))) return `${s}-12-31`;
  return null;
}
export const isOpenTask = t => !["done", "canceled"].includes(t?.status);
export const ymdOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const quarterOf = d => `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
/** 今天 blocks derived from tasks / plans / subscriptions / profile documents (see tools/derive_today.py in n-life-data). */
export function deriveToday({ tasks = [], plans = [], reviews = [], subs = [], docs = [] }, now = new Date()) {
  const today = ymdOf(now), dow = (now.getDay() + 6) % 7, wk0 = new Date(now); wk0.setDate(now.getDate() - dow); const wk1 = new Date(wk0); wk1.setDate(wk0.getDate() + 6);
  const W0 = ymdOf(wk0), W1 = ymdOf(wk1), month = today.slice(0, 7), open = tasks.filter(isOpenTask);
  const exact = t => /^\d{4}-\d{2}-\d{2}$/.test(String(t.due ?? ""));
  const overdue = open.filter(t => dueEnd(t.due) && dueEnd(t.due) < today);
  const dueToday = open.filter(t => dueEnd(t.due) === today && exact(t));
  const scheduled = open.filter(t => t.scheduled === today);
  const week = open.filter(t => (exact(t) && t.due > today && t.due <= W1) || (t.scheduled && t.scheduled > today && t.scheduled <= W1));
  const thisMonth = open.filter(t => t.due === month);
  const renewals = subs.filter(s => /^\d{4}-\d{2}-\d{2}$/.test(String(s.renew_date)) && ["active", "verify"].includes(s.state ?? s.status)).map(s => ({ s, d: daysUntil(s.renew_date, now) })).filter(x => x.d >= 0 && x.d <= 14);
  const expiring = docs.map(d => ({ d, n: daysUntil(d?.expires, now) })).filter(x => x.n != null && x.n <= 60);
  const qp = plans.find(p => p.level === "quarter" && p.period === quarterOf(now));
  const qt = qp ? tasks.filter(t => t.plan === qp.id && t.status !== "canceled") : [];
  const nextReview = reviews.flatMap(r => (r.instances || []).filter(i => i.status === "open").map(i => ({ ...i, review: r }))).sort((a, b) => String(dueEnd(a.due)).localeCompare(String(dueEnd(b.due))))[0] || null;
  const agents = {}; for (const t of open) if (/^agent:/.test(t.owner)) (agents[t.owner.slice(6)] ||= []).push(t);
  const inbox = open.filter(t => !(t.due || t.due_event || t.recurrence || t.scheduled));
  return { today, week: [W0, W1], overdue, dueToday, scheduled, week_: week, thisMonth, renewals, expiring, quarter: qp ? { plan: qp, tasks: qt, done: qt.filter(t => t.status === "done").length } : null, nextReview, agents, inbox };
}
