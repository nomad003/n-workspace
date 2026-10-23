// Module and view pages: masthead (owners, paths) then that entry's tabs, then the existing section page.
import pToday from "./today.js";
import pPlan from "./plan.js";
import pKnowledge from "./knowledge.js";
import pMoney from "./money.js";
import pAgents from "./agents.js";
import { life as pLife, journal as pJournal } from "./folders.js";
import { esc, noteHref, tabs } from "../ui.js";
import { routeOfModule, todayStamp } from "../module-model.js";
import { activityAgeText, structuralCue, structuralLabel } from "../analysis-model.js";
import { latestStructuralDate } from "../timeline-model.js";
import { loadCoverage, loadRollups, noteBody, records } from "../data.js";
import { rollupCard } from "./rollup-card.js";

const RENDER = {
  today: (sub, P, rest) => pToday(sub, P, rest),
  plan: (sub, P, rest) => pPlan(sub, P, rest),
  life: (sub, P, rest, scope) => pLife(sub, P, rest, scope),
  journal: (sub, P, rest, scope) => pJournal(sub, P, rest, scope),
  accounts: (sub, P, rest) => pMoney(sub, P, rest),
  knowledge: (sub, P, rest) => pKnowledge(sub, P, rest),
  agents: (sub, P, rest) => pAgents(sub, P, rest),
};

const stripTabs = html => String(html || "").replace(/<nav class="tabs">[\s\S]*?<\/nav>/, "");

async function pinnedNotes(entry) {
  const files = (entry?.paths || []).map(String).filter(p => /\.md$/i.test(p));
  const bits = [];
  for (const p of files) {
    const bare = p.replace(/^life:\/\//, "").replace(/\.md$/i, "");
    const rec = records.find(r => r.root === "life" && String(r.origin?.source_path || "").replace(/\.md$/i, "") === bare);
    if (!rec) continue;
    const body = rec.f ? await noteBody(rec) : null;
    const plain = String(body?.html || rec.title || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const text = plain.slice(0, 240);
    bits.push(`<p class="lede pin">${esc(text)}${plain.length > 240 ? "…" : ""} <a href="${noteHref(rec)}">打开</a></p>`);
  }
  return bits.join("");
}

export async function renderSurface(entry, kind, sub, P, rest) {
  const route = kind === "view" ? entry.id : routeOfModule(entry.id);
  const resolved = (entry.resolved || []).filter(t => !t.missing);
  const tab = resolved.find(t => t.tabId === (sub || "")) || resolved[0];
  const owners = (entry.owners || []).filter(Boolean);
  const paths = (entry.paths || []).filter(Boolean);
  const ctx = [kind === "view" ? "视图" : "模块", owners.length ? `负责 ${owners.join(" · ")}` : ""].filter(Boolean).map(esc).join(`<span class="sep">·</span>`);
  const timeHref = kind === "module" ? `#timeline?module=${encodeURIComponent(entry.id)}` : "#timeline";
  const [rollups, cov] = kind === "module" ? await Promise.all([loadRollups(), loadCoverage()]) : [null, null];
  const roll = kind === "module" ? rollupCard(rollups, entry.id) : "";
  const real = kind === "module" ? cov?.modules?.find(x => x.id === entry.id) : null;
  const clock = cov?.today || todayStamp();
  const cue = kind === "module" ? structuralLabel(structuralCue(latestStructuralDate(entry.paths, records), real?.last, clock)) : "";
  const activity = kind === "module" ? `<p class="lede act">最近活动 ${esc(real?.last || "—")} · ${esc(real ? activityAgeText(real.days, real.status) : "—")}${cue ? ` <span class="ov-struct">${esc(cue)}</span>` : ""}</p>` : "";
  const pins = await pinnedNotes(entry);
  const mast = `<header class="ph modhead"><div class="ph-row"><div class="ph-main"><div class="ctx">${ctx}</div><h1>${esc(entry.title)}</h1>${paths.length ? `<p class="lede paths">${paths.map(esc).join(" · ")}</p>` : ""}${activity}${pins}</div><div class="ph-act"><a class="btn" href="${timeHref}">时间线</a><a class="btn" href="#analysis">分析</a></div></div></header>`;
  const nav = resolved.length ? tabs(route, resolved.map(t => [t.tabId, t.label]), tab?.tabId) : "";
  if (!tab) return { html: `<div class="surface">${mast}${roll}<div class="body"><p class="empty">这里还没有可显示的页。</p></div></div>` };
  const page = RENDER[tab.sectionId];
  if (!page) return { html: `<div class="surface">${mast}${roll}${nav}<div class="body"><p class="empty">${esc(tab.ref)} 还没有页面。</p></div></div>` };
  const out = await page(tab.tabId, P, rest, { entry, route, kind });
  return { html: `<div class="surface">${mast}${roll}${nav}${stripTabs(out?.html || "")}</div>`, mount: out?.mount };
}
