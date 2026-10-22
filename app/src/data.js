// Loaded data + derived helpers shared by pages.
import { match, nextRenewal, taskDue, known, isAgentTask, daysUntil, twoFaState, weak2fa } from "./core.js";
import { choosePrefixes, fallbacks, matchesPath, LIFE_INDEX } from "./life-paths.js";
export const bundle = await fetch("../data/bundle.json", { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null);
const IDS = ["today", "plan", "life", "journal", "knowledge", "accounts", "agents", "settings"];
export const views = (await Promise.all(IDS.map(id => fetch(`../views/${id}.json`).then(r => r.json())))).sort((a, b) => a.order - b.order);
export const V = Object.fromEntries(views.map(v => [v.id, v]));
export const M = bundle?.modules || {};
export const records = bundle?.records || [];
export const byId = new Map(records.map(r => [r.id, r]));
export const notesWhere = f => f ? records.filter(r => match(r, f)).sort((a, b) => String(b.updated).localeCompare(String(a.updated))) : [];
let lidx; export const lifeIndex = async () => lidx ||= await fetch("../data/life-index.json", { cache: "no-store" }).then(r => r.ok ? r.json() : []).catch(() => []);
let idx; export const kbIndex = async () => idx ||= await fetch("../data/kb-index.json", { cache: "no-store" }).then(r => r.ok ? r.json() : []).catch(() => []);
export const noteBody = r => fetch(`../data/notes/${r.f}.json`, { cache: "no-store" }).then(x => x.ok ? x.json() : null).catch(() => null);

export const FX = V.today?.fx || { CNY: 1, USD: 7.1, JPY: 0.047, HKD: 0.91 };
export const tasks = () => M.tasks?.items || [];
export const openTasks = () => tasks().filter(t => !/done|closed|cancel/i.test(t.status || ""));
export const stageOf = t => /progress|doing/i.test(t.status) ? "in-progress" : /pend|block|wait/i.test(t.status) ? "pending" : /done|closed/i.test(t.status) ? "done" : "open";
export const TSTAGE = [["open", "待办", "agent"], ["in-progress", "进行中", "coding"], ["pending", "等待", "modes"], ["done", "完成", "ai"]];
export const isLifeTask = t => match(t, { "source~": ["12个月行动清单", "人生资产负债表"] });
export const subs = () => M.subscriptions?.items || [];
const CAT = [[/openai|chatgpt|grok|perplexity|google ai|openrouter|claude/i, "AI 工具", "coding"], [/icloud|drive|dropbox|storage/i, "存储", "ext"], [/vps|hostinger|cloud|hyper3d|server/i, "云 / 开发", "agent"],
  [/视频|music|netflix|bilibili|vip/i, "影音会员", "tui"], [/许可|license/i, "软件许可", "ai"]];
export const subCat = s => s.category || (CAT.find(([re]) => re.test(s.service || "")) || [0, "其他", "infra"])[1];
export const catColor = c => (CAT.find(x => x[1] === c) || [0, 0, "infra"])[2];
export const liveSub = s => !/cancel|refund|one-time|预充值|暂停|pause/i.test(s.status || "") && known(s.amount);
export const CYCLE = s => /年|year/i.test(s.cycle || "") ? 12 : /季|quarter/i.test(s.cycle || "") ? 3 : /月|month/i.test(s.cycle || "") ? 1 : null;
export const toCNY = (amt, cur) => FX[String(cur).toUpperCase()] == null ? null : +amt * FX[String(cur).toUpperCase()];
export const monthlyCNY = () => subs().filter(liveSub).reduce((t, s) => { const k = CYCLE(s), v = toCNY(s.amount, s.currency); return k && v != null ? t + v / k : t; }, 0);
export const dupKey = s => String(s.service || "").toLowerCase().replace(/[（(].*$|\bvia\b.*$/g, "").trim();
export const dupSet = () => { const c = {}; subs().forEach(s => c[dupKey(s)] = (c[dupKey(s)] || 0) + 1); return new Set(Object.keys(c).filter(k => c[k] > 1)); };
export const has2fa = a => ({ on: "已开启", off: "未开启", unknown: "待确认", na: "不适用" })[twoFaState(a.two_fa)];
export const AGENTS = ["Bot", "X", "KB", "Pi", "Github", "Register", "Blibli"];
export function agentState(a) {
  const ts = tasks().filter(t => t.owner === a), ch = (M.content?.items || []).filter(c => c.owner_agent === a);
  const st = ts.some(t => stageOf(t) === "in-progress") ? ["运行中", "ai"] : ts.some(t => stageOf(t) === "pending") ? ["等待", "modes"] : ts.length || ch.length ? ["排队", "agent"] : ["空闲", "infra"];
  return { name: a, tasks: ts, channels: ch, label: st[0], c: st[1] };
}
export { match, nextRenewal, taskDue, known, isAgentTask, daysUntil };

// ---- accounts: stable ids, category pages (views/assets.json account_categories), relations
export const accId = a => a?.id && !String(a.id).includes(":") ? String(a.id) : String(a.service ?? "").trim().toLowerCase().replace(/[\s/·]+/g, "-").replace(/[()（）.]+/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
export const accHref = a => `#account/${encodeURIComponent(accId(a))}`;
export const accounts = () => M.accounts?.items || [];
export const accById = id => accounts().find(a => accId(a) === id);
const AC = () => V.accounts?.account_categories || { pages: [], by_category: {} };
export const catPages = () => bundle?.v9?.groups?.length ? bundle.v9.groups.map(g => ({ slug: g.id, label: g.label })) : AC().pages;
const anchorRe = /^(Gmail \/ Google|Microsoft 账号|QQ ?邮箱|手机号运营商)/;
export function catOf(a) {
  if (a.group) return { slug: a.group, rule: "v9" };
  const c = AC(), ov = c.service_overrides?.[a.service]; if (ov) return { slug: ov, rule: "override" };
  if (c.identity_anchors) { const ids = M.identities?.items || []; // anchor = provider's own account: its email_id is that identity and it logs in with the provider account itself
    const own = ids.some(i => [].concat(a.email_id ?? []).includes(i.id) && /-account$|^phone-sms/.test(String(a.login_via ?? "")) && anchorRe.test(a.service)) || anchorRe.test(a.service);
    if (own) return { slug: "identity", rule: "identity" }; }
  for (const s of c.split || []) if (a.category === s.category && new RegExp(s.service_re, "i").test(a.service ?? "")) return { slug: s.to, rule: "split" };
  const m = c.by_category?.[a.category]; return m ? { slug: m, rule: "category" } : { slug: "other", rule: "unmapped" };
}
const tok = a => String(a.service ?? "").split(/\s*[/（(]\s*/)[0].trim();
const hit = (txt, a) => { const t = tok(a); if (t.length < 2 || (/^[\x00-\x7f]+$/.test(t) && t.length < 3)) return false; return String(txt ?? "").toLowerCase().includes(t.toLowerCase()); };
export const relatedSubs = a => subs().some(s => s.account_id) ? subs().filter(s => s.account_id === accId(a)) : subs().filter(s => hit(s.service, a) || hit(a.service, { service: s.service }) || hit(s.notes, a));
export const relatedTasks = a => tasks().filter(t => hit(t.title, a) || hit(t.notes, a));
export async function relatedNotes(a) {
  const ix = await kbIndex(), t = tok(a).toLowerCase();
  const byTitle = ix.filter(n => hit(n.title, a)), byText = ix.filter(n => !byTitle.includes(n) && hit(n.text, a));
  return { byTitle, byText: byText.sort((x, y) => (y.text.toLowerCase().split(t).length) - (x.text.toLowerCase().split(t).length)) };
}

export const noteByPath = (root, p) => byId.get(`${root}:${p}`);
export const plan = () => bundle?.plan || null;
// ---- v9 (n-life-data schema_version 9)
export const v9 = bundle?.v9 || null;
export const groups = () => v9?.groups || [];
export const plansV9 = () => v9?.plans || [];
export const reviews = () => v9?.reviews || [];
export const section = id => (v9?.sections || []).find(s => s.id === id) || null;
export const lifeFiles = () => v9?.files || [];
export const subsOf = id => subs().filter(s => s.account_id === id);
export const paidBy = id => subs().filter(s => s.paid_via === id);
export const agentName = o => ({ bilibili: "Bilibili", kb: "KB", pi: "Pi", x: "X", register: "Register", bot: "Bot", github: "Github" })[String(o).replace(/^agent:/, "")] ?? String(o).replace(/^agent:/, "");
export const dirOf = u => String(u).replace(/^life:\/\//, "").replace(/[#?].*$/, "");
const barePath = p => String(p ?? "").replace(/\.md$/i, "").replace(/\/+$/, "");
const pathHit = matchesPath;
export const dirCovers = prefix => {
  if (prefix.endsWith("/") && (v9?.dirs || []).some(d => d === prefix || d.startsWith(prefix))) return true;
  if (records.some(r => r.root === "life" && pathHit(r.origin.source_path, prefix))) return true;
  return lifeFiles().some(f => pathHit(f.path, prefix));
};
const rawNotes = prefix => records.filter(r => r.root === "life" && pathHit(r.origin.source_path, prefix));
const dedupeNotes = xs => { const seen = new Set(), out = []; for (const r of xs) if (r && !seen.has(r.id)) { seen.add(r.id); out.push(r); } return out; };
// Directory queries try the given path, then the paired old/new path when the given one is absent.
export const notesIn = dir => {
  const q = dir.endsWith("/") || !dir.includes("/") ? (dir.endsWith("/") ? dir : dir + "/") : dir;
  const prefs = choosePrefixes(q, dirCovers);
  const out = dedupeNotes(prefs.flatMap(rawNotes));
  const seen = new Set(out.map(r => r.id));
  for (const [folder, ...indexes] of LIFE_INDEX) {
    if (!prefs.some(p => p === folder || (folder.endsWith("/") && p.startsWith(folder)))) continue;
    const newest = indexes[0];
    if (records.some(r => r.root === "life" && barePath(r.origin.source_path) === barePath(newest))) continue;
    for (const legacy of indexes.slice(1)) {
      const hit = records.find(r => r.root === "life" && barePath(r.origin.source_path) === barePath(legacy));
      if (!hit) continue;
      if (!seen.has(hit.id)) { seen.add(hit.id); out.push(hit); }
      break;
    }
  }
  return out;
};
export const filesIn = dir => {
  const prefs = choosePrefixes(dir.endsWith("/") ? dir : dir + "/", dirCovers);
  const seen = new Set(), out = [];
  for (const p of prefs) for (const f of lifeFiles()) if (pathHit(f.path, p) && !seen.has(f.path)) { seen.add(f.path); out.push(f); }
  return out;
};
export const findLifeNote = path => {
  const want = [barePath(path), ...fallbacks(path).map(barePath)];
  for (const b of want) { const hit = records.find(r => r.root === "life" && barePath(r.origin.source_path) === b); if (hit) return hit; }
  return null;
};
const dropRedundantIndex = xs => xs.filter(r => {
  if (!/\/index\.md$/i.test(r.origin.source_path)) return true;
  const dir = r.origin.source_path.replace(/index\.md$/i, "");
  return !xs.some(o => o.id !== r.id && o.origin.source_path.startsWith(dir));
});
// Agents notes: content/x/, content/blibli/, learn/agent/pi/ (and team.md). Falls back through x/ blibli/ pi/, then the whole agent-ops/ tree.
export function agentNotes() {
  const specs = (V.agents?.agent_notes?.path || ["content/x/", "content/blibli/", "learn/agent/pi/"]).map(p => p.endsWith("/") ? p : p + "/");
  let notes = dedupeNotes(specs.flatMap(notesIn));
  const team = findLifeNote("team");
  if (team) notes = dedupeNotes([...notes, team]);
  const used = specs.map(s => choosePrefixes(s, dirCovers)[0]);
  let label = used.map(s => `life://${s}`).join(" · ");
  if (!notes.length && !used.some(dirCovers) && dirCovers("agent-ops/")) {
    notes = rawNotes("agent-ops/");
    label = "life://agent-ops/";
  }
  return { notes: dropRedundantIndex(notes), label };
}
export { choosePrefixes, fallbacks };
// 主题 (topics): data/topics.yaml + topic-logs, loaded by build-index (missing → []).
export const topics = () => v9?.topics || [];
export const topicById = id => topics().find(t => t.id === id);
// Channel numbers (X followers etc.): the topic log is the single home (content.yaml `snapshots_ref: data/topic-logs/<id>.jsonl`);
// latest value per metric from that topic's series. Falls back to the old content.yaml `snapshots` list when there is no ref/log/metric.
export function channelStats(c) {
  const ref = String(c?.snapshots_ref ?? "").match(/topic-logs\/([\w-]+)\.jsonl/), t = ref && topicById(ref[1]);
  if (t && Object.keys(t.series || {}).length) { const pick = k => t.series[k]?.at(-1);
    const vals = Object.fromEntries(["followers", "following", "posts"].map(k => [k, pick(k)?.[1] ?? null])), date = ["followers", "following", "posts"].map(k => pick(k)?.[0]).filter(Boolean).sort().at(-1);
    return { ...vals, date, source: `topic-logs/${t.id}.jsonl`, topic: t.id }; }
  const s = Array.isArray(c?.snapshots) ? c.snapshots.at(-1) : null;
  return s ? { followers: s.followers ?? null, following: s.following ?? null, posts: s.posts ?? null, date: s.date ?? null, source: "content.yaml（旧快照）" } : null;
}
