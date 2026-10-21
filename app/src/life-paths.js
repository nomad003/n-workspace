// Life-note locations after the bot-domain reorg, and the paths they replace.
// A lookup tries the path it was given. If that path is absent, the other name in its pair is used.
// Fan-out rows run only in the old → new direction (a new folder must not swallow an unrelated old tree).
// data/ at the life-repo root is not listed: v9.mjs keeps reading it by filename.

const bare = p => String(p ?? "").replace(/\\/g, "/").replace(/^\.\//, "").replace(/\.md$/i, "").replace(/\/+$/, "");
const isDir = p => /\/$/.test(String(p));
const asDir = p => bare(p) + "/";

// [new, old]. Directories end with /. Longer prefixes win over shorter ones.
export const LIFE_PAIRS = [
  ["mind/reviews/", "reviews/"],
  ["ai/", "learning/"],
  ["bot/journal/daily/", "journal/daily/"],
  ["bot/journal/weekly/", "journal/weekly/"],
  ["bot/journal/", "journal/"],
  ["bot/plan/", "plan/"],
  ["bot/profile/", "profile/"],
  ["bot/family/", "family/"],
  ["bot/records/", "records/"],
  ["cfwork/reports/", "work/reports/"],
  ["cfwork/chengfeng-ai/", "work/projects/chengfeng-ai/"],
  ["cfwork/ai-build/", "work/projects/ai-build/"],
  ["cfwork/ops/", "work/projects/comet-ops-tools/"],
  ["server/", "work/projects/comet-server/"],
  ["register/", "affairs/"],
  ["workspace/", "digital/"],
  ["idea/", "explore/"],
  ["x/", "agent-ops/X账号运营/"],
  ["pi/", "agent-ops/X账号运营/图解Pi"],
  ["health/index", "moc/Health-MOC"],
  ["finance/index", "moc/Investment-MOC"],
  ["bot/团队", "agent-ops/Bot管理-Agent-Team"],
  ["mind/十年设计-2026-2036", "plan/十年设计-2026-2036"],
  ["mind/复盘节奏", "plan/复盘节奏"],
  ["mind/困难记录-2019-2026", "records/困难记录-2019-2026"],
  ["travel/旅游时间线", "records/旅游时间线"],
  ["bot/项目索引", "work/projects/index"],
  ["bot/TODO", "work/projects/TODO"],
  ["cfwork/工具组-职责与愿景", "agent-ops/工具组-职责与愿景"],
  ["x/index", "agent-ops/X账号运营/index"],
  ["x/X运营-养号与起号攻略", "agent-ops/X账号运营/X运营-养号与起号攻略"],
  ["x/运营日志", "agent-ops/X账号运营/运营日志"],
  ["pi/图解Pi-系列计划", "agent-ops/X账号运营/图解Pi-系列计划"],
  ["pi/图解Pi-长文-01-为什么拆它", "agent-ops/X账号运营/图解Pi-长文-01-为什么拆它"],
];

// Used only when the left path itself is absent.
export const LIFE_FANOUT = [
  ["work/projects/", ["server/", "cfwork/chengfeng-ai/", "cfwork/ai-build/", "cfwork/ops/"]],
  ["cfwork/", ["work/projects/chengfeng-ai/", "work/projects/ai-build/", "work/projects/comet-ops-tools/", "work/reports/"]],
  ["agent-ops/", ["x/", "blibli/", "pi/"]],
  ["mind/", ["reviews/", "plan/十年设计-2026-2036", "plan/复盘节奏", "records/困难记录-2019-2026"]],
];

// When a folder is listed and its new index file is absent, also show the old pinned MOC.
export const LIFE_INDEX = [
  ["health/", "health/index", "moc/Health-MOC"],
  ["finance/", "finance/index", "moc/Investment-MOC"],
];

const uniq = xs => [...new Set(xs)];

function form(p, dir) {
  if (isDir(p)) return asDir(p);
  return dir ? asDir(p) : p;
}

// Other paths that mean the same note or folder. Does not include `query`.
export function fallbacks(query) {
  const q = bare(query);
  const dir = isDir(query);
  const exact = [];
  for (const [a, b] of LIFE_PAIRS) {
    if (bare(a) === q) exact.push(form(b, dir && isDir(b)));
    else if (bare(b) === q) exact.push(form(a, dir && isDir(a)));
  }
  if (exact.length) return uniq(exact);
  const qPath = dir ? q + "/" : q;
  let best = null, bestLen = -1;
  for (const [a, b] of LIFE_PAIRS) {
    for (const [from, to] of [[a, b], [b, a]]) {
      if (!isDir(from) || !qPath.startsWith(from) || from.length <= bestLen) continue;
      best = to + qPath.slice(from.length);
      bestLen = from.length;
    }
  }
  if (best) return [dir ? (best.endsWith("/") ? best : best + "/") : best.replace(/\/$/, "")];
  for (const [from, tos] of LIFE_FANOUT) {
    if (bare(from) === q && isDir(from) === dir) return [...tos];
    if (isDir(from) && qPath.startsWith(from) && qPath !== from) {
      const rest = qPath.slice(from.length);
      return tos.filter(isDir).map(to => to + rest);
    }
  }
  return [];
}

// `covers(path)` is true when that folder or file is actually in the life tree.
// The requested path wins. Otherwise every present fan-out target, or the first present pair.
export function choosePrefixes(query, covers) {
  const primary = isDir(query) ? asDir(query) : query;
  if (covers(primary)) return [primary];
  const fan = LIFE_FANOUT.find(([from]) => bare(from) === bare(primary) && isDir(from) === isDir(primary));
  if (fan) {
    const hit = fan[1].filter(covers);
    if (hit.length) return hit;
  }
  const alt = fallbacks(primary).find(covers);
  return alt ? [alt] : [primary];
}
