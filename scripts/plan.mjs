// Parse the user's planning notes (life root) into structured data for 今天 / 计划:
//   life/12个月行动清单.md  → actions (table: # | 行动 | 时限 | 完成标准 | 状态) + quarter focus (优先 | # | 行动 | 下一步)
//   life/复盘节奏.md         → review cadences (quarterly / annual): checklist + "下次应执行" windows
// Only values present in the notes are used; nothing is invented.
import fs from "node:fs"; import path from "node:path";
const plain = s => String(s ?? "").replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2").replace(/\[\[([^\]]+)\]\]/g, (_, x) => x.replace(/\.md$/, "")).replace(/\*\*/g, "").replace(/\\\|/g, "|").trim();
function tables(md) { // -> [{head:[..], rows:[[..]], heading}]
  const out = []; let cur = null, heading = "";
  for (const line of md.split("\n")) {
    if (/^#{1,6}\s/.test(line)) heading = line.replace(/^#+\s*/, "").trim();
    if (/^\s*\|/.test(line)) { const cells = line.replace(/\\\|/g, "\u0000").replace(/\[\[[^\]]*\]\]/g, m => m.replace(/\|/g, "\u0000")).trim().replace(/^\||\|$/g, "").split("|").map(c => c.replace(/\u0000/g, "|").trim());
      if (!cur) { cur = { head: cells, rows: [], heading }; out.push(cur); } else if (!cells.every(c => /^:?-+:?$/.test(c))) cur.rows.push(cells); }
    else cur = null;
  }
  return out;
}
const fmDate = md => md.match(/^---[\s\S]*?\nupdated:\s*['"]?([\d-]+)/)?.[1] ?? null;
export const horizonOf = due => {
  const m = String(due).match(/^(\d{4})-(\d{2})/); if (!m) return /持续/.test(due) ? "持续" : "节点";
  const y = +m[1], mo = +m[2]; return mo <= 6 ? `${y} 上半年` : `${y} Q${Math.ceil(mo / 3)}`;
};
export function parsePlan(lifeRoot) {
  const f = path.join(lifeRoot, "life", "12个月行动清单.md"); if (!fs.existsSync(f)) return null;
  const md = fs.readFileSync(f, "utf8"), ts = tables(md);
  const main = ts.find(t => t.head.includes("行动") && t.head.includes("时限"));
  const focus = ts.find(t => t.head.includes("优先") && t.head.includes("#"));
  const col = (t, name) => t.head.indexOf(name);
  const actions = (main?.rows || []).map(r => ({ n: +r[col(main, "#")], title: plain(r[col(main, "行动")]), due: plain(r[col(main, "时限")]), standard: plain(r[col(main, "完成标准")]), done: /☑|✅|\[x\]/i.test(r[col(main, "状态")] ?? "") }));
  for (const a of actions) a.horizon = horizonOf(a.due);
  for (const r of focus?.rows || []) { const a = actions.find(x => x.n === +r[col(focus, "#")]); if (a) { a.priority = plain(r[col(focus, "优先")]); a.focus = true; const nx = plain(r[3]); if (nx && !/^待补充/.test(nx)) a.next = nx; } }
  const plan = { source: "life://life/12个月行动清单.md", updated: fmDate(md), focus_title: focus?.heading ?? null, actions };
  const rf = path.join(lifeRoot, "life", "复盘节奏.md");
  if (fs.existsSync(rf)) {
    const rmd = fs.readFileSync(rf, "utf8"), reviews = [];
    for (const sec of rmd.split(/\n(?=## )/).slice(1)) {
      const title = sec.split("\n")[0].replace(/^##\s*/, "").trim(); if (!/复盘/.test(title)) continue;
      const checklist = [...sec.matchAll(/^- \[[ x]\] (.+)$/gm)].map(m => plain(m[1]));
      const t = tables(sec).find(x => x.head.includes("窗口"));
      const next = (t?.rows || []).map(r => ({ window: plain(r[0]), date: plain(r[1]), done: /☑|✅/.test(r[2] ?? "") }));
      reviews.push({ title: title.replace(/（.*）/, "").trim(), detail: title.match(/（(.*)）/)?.[1] ?? "", checklist, next });
    }
    plan.reviews = reviews; plan.reviews_source = "life://life/复盘节奏.md";
  }
  return plan;
}
