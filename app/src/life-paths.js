// Life-note locations across three layouts. A lookup tries the path it was given.
// If that path is absent, older and newer names are tried newest-first:
//   v3 (life/, learn/, content/, work/, accounts/) → v2 (bot-domain) → v1 (original folders).
// Fan-out is grouped by layout. The first group that exists is used, so two layouts on disk do not both list.
// archive/, data/, schemas/, tools/, and templates/ stay at the life-repo root and are not listed.
// data/ is read by filename in v9.mjs.

const bare = p => String(p ?? "").replace(/\\/g, "/").replace(/^\.\//, "").replace(/\.md$/i, "").replace(/\/+$/, "");
const isDir = p => /\/$/.test(String(p));
const asDir = p => bare(p) + "/";
const uniq = xs => [...new Set(xs)];

// Each row is newest-first. Directories end with /. Longer directory prefixes win.
export const LIFE_CHAINS = [
  ["life/profile/", "bot/profile/", "profile/"],
  ["life/family/", "bot/family/", "family/"],
  ["life/journal/daily/", "bot/journal/daily/", "journal/daily/"],
  ["life/journal/weekly/", "bot/journal/weekly/", "journal/weekly/"],
  ["life/journal/", "bot/journal/", "journal/"],
  ["life/plan/", "bot/plan/", "plan/"],
  ["life/plan/TODO", "bot/TODO", "work/projects/TODO"],
  ["life/records/", "bot/records/", "records/"],
  ["work/index", "bot/项目索引", "work/projects/index"],
  ["team", "bot/团队", "agent-ops/Bot管理-Agent-Team"],
  ["life/health/", "health/"],
  ["life/finance/", "finance/"],
  ["life/house/", "house/"],
  ["life/travel/", "travel/", "records/旅游时间线"],
  ["life/health/index", "health/index", "moc/Health-MOC"],
  ["life/finance/index", "finance/index", "moc/Investment-MOC"],
  ["work/cfwork/reports/", "cfwork/reports/", "work/reports/"],
  ["work/cfwork/chengfeng-ai/", "cfwork/chengfeng-ai/", "work/projects/chengfeng-ai/"],
  ["work/cfwork/ai-build/", "cfwork/ai-build/", "work/projects/ai-build/"],
  ["work/cfwork/ops/", "cfwork/ops/", "work/projects/comet-ops-tools/"],
  ["work/cfwork/", "cfwork/"],
  ["work/server/", "server/", "work/projects/comet-server/"],
  ["learn/ai/", "ai/", "learning/"],
  ["learn/english/", "english/"],
  ["learn/mind/reviews/", "mind/reviews/", "reviews/"],
  ["learn/mind/", "mind/"],
  ["learn/idea/", "idea/", "explore/"],
  ["learn/kb/", "kb/"],
  ["learn/agent/pi/", "pi/", "agent-ops/X账号运营/图解Pi"],
  ["content/x/", "x/", "agent-ops/X账号运营/"],
  ["content/blibli/", "blibli/"],
  ["accounts/register/", "register/", "affairs/"],
  ["accounts/workspace/", "workspace/", "digital/"],
  ["learn/mind/十年设计-2026-2036", "mind/十年设计-2026-2036", "plan/十年设计-2026-2036"],
  ["learn/mind/复盘节奏", "mind/复盘节奏", "plan/复盘节奏"],
  ["learn/mind/困难记录-2019-2026", "mind/困难记录-2019-2026", "records/困难记录-2019-2026"],
  ["life/travel/旅游时间线", "travel/旅游时间线", "records/旅游时间线"],
  ["work/cfwork/工具组-职责与愿景", "cfwork/工具组-职责与愿景", "agent-ops/工具组-职责与愿景"],
  ["content/x/index", "x/index", "agent-ops/X账号运营/index"],
  ["content/x/X运营-养号与起号攻略", "x/X运营-养号与起号攻略", "agent-ops/X账号运营/X运营-养号与起号攻略"],
  ["content/x/运营日志", "x/运营日志", "agent-ops/X账号运营/运营日志"],
  ["learn/agent/pi/图解Pi-系列计划", "pi/图解Pi-系列计划", "agent-ops/X账号运营/图解Pi-系列计划"],
  ["learn/agent/pi/图解Pi-长文-01-为什么拆它", "pi/图解Pi-长文-01-为什么拆它", "agent-ops/X账号运营/图解Pi-长文-01-为什么拆它"],
];

// [source, groups newest-first]. Used when the source path itself is absent.
// A path under the source rewrites onto every directory target, newest group first.
export const LIFE_FANOUT = [
  ["work/projects/", [
    ["work/server/", "work/cfwork/chengfeng-ai/", "work/cfwork/ai-build/", "work/cfwork/ops/"],
    ["server/", "cfwork/chengfeng-ai/", "cfwork/ai-build/", "cfwork/ops/"],
  ]],
  ["cfwork/", [
    ["work/cfwork/"],
    ["work/projects/chengfeng-ai/", "work/projects/ai-build/", "work/projects/comet-ops-tools/", "work/reports/"],
  ]],
  ["work/cfwork/", [
    ["cfwork/"],
    ["work/projects/chengfeng-ai/", "work/projects/ai-build/", "work/projects/comet-ops-tools/", "work/reports/"],
  ]],
  ["agent-ops/", [
    ["content/x/", "content/blibli/", "learn/agent/pi/"],
    ["x/", "blibli/", "pi/"],
  ]],
  ["mind/", [
    ["learn/mind/"],
    ["reviews/", "plan/十年设计-2026-2036", "plan/复盘节奏", "records/困难记录-2019-2026"],
  ]],
  ["learn/mind/", [
    ["mind/"],
    ["reviews/", "plan/十年设计-2026-2036", "plan/复盘节奏", "records/困难记录-2019-2026"],
  ]],
];

// [folder, ...indexes newest-first]. When the folder is listed and its newest index file is absent,
// the first older index that exists is shown (life/health/index, then health/index, then moc/Health-MOC).
export const LIFE_INDEX = [
  ["life/health/", "life/health/index", "health/index", "moc/Health-MOC"],
  ["health/", "health/index", "moc/Health-MOC"],
  ["life/finance/", "life/finance/index", "finance/index", "moc/Investment-MOC"],
  ["finance/", "finance/index", "moc/Investment-MOC"],
];

// Filename prefixes (图解Pi-…) may continue with "-". A whole note such as team must not match team-roster.
const FILE_PREFIXES = new Set();
{
  const files = LIFE_CHAINS.flat().filter(m => !isDir(m)).map(bare);
  for (const a of files) for (const b of files) if (a !== b && b.startsWith(a)) FILE_PREFIXES.add(a);
}

export function matchesPath(file, prefix) {
  const f = String(file ?? "");
  if (String(prefix).endsWith("/")) return f.startsWith(prefix);
  const b = bare(prefix), fb = bare(f);
  if (fb === b) return true;
  if (!fb.startsWith(b)) return false;
  const next = fb.charAt(b.length);
  if (next === "/" || next === ".") return true;
  return next === "-" && FILE_PREFIXES.has(b);
}

function shaped(member) {
  return isDir(member) ? asDir(member) : member;
}

function chainPrefix(qPath) {
  let best = null, bestLen = -1;
  for (const chain of LIFE_CHAINS) for (const member of chain) {
    if (!isDir(member) || !qPath.startsWith(member) || member.length <= bestLen) continue;
    best = { chain, from: member };
    bestLen = member.length;
  }
  return best;
}

function fanPrefix(qPath) {
  let best = null, bestLen = -1;
  for (const [from, groups] of LIFE_FANOUT) {
    if (!isDir(from) || !qPath.startsWith(from) || from.length <= bestLen) continue;
    best = { from, groups };
    bestLen = from.length;
  }
  return best;
}

function rewriteRest(targets, rest, dir) {
  const outs = [];
  for (const to of targets) {
    if (!isDir(to)) continue;
    let next = to + rest;
    next = dir ? (next.endsWith("/") ? next : next + "/") : next.replace(/\/$/, "");
    outs.push(next);
  }
  return outs;
}

// Other paths that mean the same note or folder. Does not include `query`. Newest first.
export function fallbacks(query) {
  const q = bare(query);
  const dir = isDir(query);
  const qPath = dir ? q + "/" : q;
  const exact = [];
  for (const chain of LIFE_CHAINS) {
    if (!chain.some(m => bare(m) === q)) continue;
    for (const m of chain) if (bare(m) !== q) exact.push(shaped(m));
  }
  const fan = LIFE_FANOUT.find(([from]) => bare(from) === q && isDir(from) === dir);
  if (fan) for (const group of fan[1]) for (const to of group) exact.push(shaped(to));
  if (exact.length) return uniq(exact);
  const chainHit = chainPrefix(qPath), fanHit = fanPrefix(qPath);
  if (chainHit && (!fanHit || chainHit.from.length >= fanHit.from.length))
    return uniq(rewriteRest(chainHit.chain.filter(m => m !== chainHit.from), qPath.slice(chainHit.from.length), dir));
  if (fanHit)
    return uniq(rewriteRest(fanHit.groups.flat(), qPath.slice(fanHit.from.length), dir));
  return [];
}

// `covers(path)` is true when that folder or file is actually in the life tree.
// The requested path wins. Otherwise the first fan-out group that is present, then the first present alias.
export function choosePrefixes(query, covers) {
  const primary = isDir(query) ? asDir(query) : query;
  if (covers(primary)) return [primary];
  const fan = LIFE_FANOUT.find(([from]) => bare(from) === bare(primary) && isDir(from) === isDir(primary));
  if (fan) {
    for (const group of fan[1]) {
      const hit = group.filter(covers);
      if (hit.length) return hit;
    }
  }
  const alt = fallbacks(primary).find(covers);
  return alt ? [alt] : [primary];
}
