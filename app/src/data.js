// Loaded data + derived helpers shared by pages.
import { match, nextRenewal, taskDue, known, isAgentTask, daysUntil, twoFaState, weak2fa } from "./core.js";
import { choosePrefixes, fallbacks, matchesPath, LIFE_INDEX, setLegacyPaths, legacyPaths, noteFallback } from "./life-paths.js";
import { folderBanner } from "./ui.js";
import { routeOfModule } from "./module-model.js";
export const bundle = await fetch("../data/bundle.json", { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null);
setLegacyPaths(!!bundle?.life_legacy_paths);
const IDS = ["today", "plan", "life", "journal", "knowledge", "accounts", "agents", "settings"];
export const views = (await Promise.all(IDS.map(id => fetch(`../views/${id}.json`).then(r => r.json())))).sort((a, b) => a.order - b.order);
export const V = Object.fromEntries(views.map(v => [v.id, v]));
export const M = bundle?.modules || {};
export const records = bundle?.records || [];
export const byId = new Map(records.map(r => [r.id, r]));
export const notesWhere = f => f ? records.filter(r => match(r, f)).sort((a, b) => String(b.updated).localeCompare(String(a.updated))) : [];
let lidx; export const lifeIndex = async () => lidx ||= await fetch("../data/life-index.json", { cache: "no-store" }).then(r => r.ok ? r.json() : []).catch(() => []);
let tl; export const loadTimeline = async () => tl ||= await fetch("../data/timeline.json", { cache: "no-store" }).then(r => r.ok ? r.json() : []).catch(() => []);
let rollups; export const loadRollups = async () => rollups ||= await fetch("../data/rollups.json", { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null);
let coverage; export const loadCoverage = async () => coverage ||= await fetch("../data/coverage.json", { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null);
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
  const [kb, life] = await Promise.all([kbIndex(), lifeIndex()]);
  const ix = [...(Array.isArray(kb) ? kb : []), ...(Array.isArray(life) ? life : [])];
  const t = tok(a).toLowerCase();
  const byTitle = ix.filter(n => hit(n.title, a)), byText = ix.filter(n => !byTitle.includes(n) && hit(n.text, a));
  return { byTitle, byText: byText.sort((x, y) => (String(y.text ?? "").toLowerCase().split(t).length) - (String(x.text ?? "").toLowerCase().split(t).length)) };
}

export const noteByPath = (root, p) => byId.get(`${root}:${p}`);
export const plan = () => bundle?.plan || null;
// ---- v9 (n-life-data schema_version 9)
export const v9 = bundle?.v9 || null;
export const groups = () => v9?.groups || [];
export const plansV9 = () => v9?.plans || [];
export const reviews = () => v9?.reviews || [];
export const section = id => (v9?.sections || []).find(s => s.id === id) || null;
// Null when sections.yaml has no modules array: the shell keeps the section pages.
export const moduleList = () => Array.isArray(v9?.modules) && v9.modules.length ? v9.modules : null;
export const viewList = () => moduleList() ? (Array.isArray(v9?.views) ? v9.views : []) : [];
export const moduleByRoute = route => moduleList()?.find(m => routeOfModule(m.id) === route) || null;
export const viewById = id => viewList().find(v => v.id === id) || null;
// Directory sources on one sections.yaml tab. `fallback` is used only when that page has no section.
export function dirSources(pageId, tabId, fallback = []) {
  const S = section(pageId);
  if (!S) return fallback;
  const t = (S.tabs || []).find(x => x.id === tabId);
  return (Array.isArray(t?.source) ? t.source : []).filter(u => /^life:\/\/[^#?]+\/$/.test(String(u))).map(u => String(u).slice(7));
}
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
// Directory queries use the given path. Older names are tried only when LIFE_LEGACY_PATHS=1.
export const notesIn = dir => {
  const q = dir.endsWith("/") || !dir.includes("/") ? (dir.endsWith("/") ? dir : dir + "/") : dir;
  const prefs = choosePrefixes(q, dirCovers);
  const out = dedupeNotes(prefs.flatMap(rawNotes));
  const seen = new Set(out.map(r => r.id));
  if (legacyPaths()) for (const [folder, ...indexes] of LIFE_INDEX) {
    if (!prefs.some(p => p === folder || (folder.endsWith("/") && p.startsWith(folder)))) continue;
    const newest = indexes[0];
    if (records.some(r => r.root === "life" && barePath(r.origin.source_path) === barePath(newest))) continue;
    for (const legacy of indexes.slice(1)) {
      const hit = records.find(r => r.root === "life" && barePath(r.origin.source_path) === barePath(legacy));
      if (!hit) continue;
      noteFallback(newest, legacy);
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
  for (const b of want) {
    const hit = records.find(r => r.root === "life" && barePath(r.origin.source_path) === b);
    if (!hit) continue;
    if (b !== want[0]) noteFallback(path, b);
    return hit;
  }
  return null;
};
const INDEX_RE = /(^|\/)(index|README)\.md$/i;
export const isIndexNote = r => INDEX_RE.test(r?.origin?.source_path || "");
export const folderIndex = dir => {
  const base = String(dir || "").replace(/\/+$/, "");
  return base ? findLifeNote(`${base}/index`) || findLifeNote(`${base}/README`) : null;
};
const tabDirs = tab => (Array.isArray(tab?.source) ? tab.source : []).filter(u => /^life:\/\/[^#?]+\/$/.test(String(u))).map(u => String(u).slice(7));
// Notes shown in one sections.yaml tab. A folder's own index.md / README.md stays in ⌘K
// and is rendered as the folder description, not as a row. A note that also sits in a
// more specific tab of the same section is listed only on that tab.
export function listedNotes(sectionId, tabId, fallbackDirs = []) {
  const S = section(sectionId);
  const tabs = S?.tabs || [];
  const me = tabs.find(t => t.id === tabId);
  const dirs = me ? tabDirs(me) : (S ? [] : fallbackDirs);
  const nested = [];
  for (const t of tabs) {
    if (t.id === tabId) continue;
    const ds = tabDirs(t).filter(d => dirs.some(mine => d.startsWith(mine) && d.length > mine.length));
    if (ds.length) nested.push({ tab: t, dirs: ds });
  }
  const nestedDirs = nested.flatMap(n => n.dirs);
  const owned = path => nestedDirs.some(d => String(path || "").startsWith(d));
  const notes = dedupeNotes(dirs.flatMap(notesIn).filter(r => !isIndexNote(r) && !owned(r.origin.source_path)));
  return { dirs, notes, see: nested.map(n => n.tab), nestedDirs };
}
export async function folderIntro(dirs) {
  const notes = [];
  const seen = new Set();
  for (const d of dirs || []) {
    const n = folderIndex(d);
    if (n && !seen.has(n.id)) { seen.add(n.id); notes.push(n); }
  }
  const bodies = await Promise.all(notes.map(noteBody));
  return notes.map((n, i) => folderBanner(n, bodies[i])).join("");
}
const dropRedundantIndex = xs => xs.filter(r => {
  if (!/\/index\.md$/i.test(r.origin.source_path)) return true;
  const dir = r.origin.source_path.replace(/index\.md$/i, "");
  return !xs.some(o => o.id !== r.id && o.origin.source_path.startsWith(dir));
});
// Agents notes follow the agents section sources (directories plus file pins such as life://team/team).
// views/agents.json is the fallback when that section is absent. The agent-ops/ tree is a LIFE_LEGACY_PATHS fallback.
export function agentNotes() {
  const sec = section("agents");
  const raw = sec?.tabs?.length
    ? sec.tabs.flatMap(t => Array.isArray(t.source) ? t.source : [])
    : (V.agents?.agent_notes?.path || ["content/x/", "content/blibli/", "learn/agent/pi/"]).map(p => `life://${p}`);
  const dirs = [], files = [];
  for (const u of raw) {
    const body = String(u).replace(/^life:\/\//, "").replace(/[#?].*$/, "");
    if (!body || body.startsWith("data/")) continue;
    if (body.endsWith("/")) dirs.push(body);
    else files.push(body);
  }
  let notes = dedupeNotes(dirs.flatMap(notesIn));
  for (const f of files) { const n = findLifeNote(f); if (n) notes = dedupeNotes([...notes, n]); }
  const used = dirs.map(s => choosePrefixes(s, dirCovers)[0]);
  let label = [...used.map(s => `life://${s}`), ...files.map(f => `life://${f}`)].join(" · ");
  if (legacyPaths() && !notes.length && !used.some(dirCovers) && dirCovers("agent-ops/")) {
    notes = rawNotes("agent-ops/");
    label = "life://agent-ops/";
    noteFallback(dirs.join(" ") || "agents", "agent-ops/");
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
