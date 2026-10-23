// Module and view pages: masthead (owners, paths) then that entry's tabs, then the existing section page.
import pToday from "./today.js";
import pPlan from "./plan.js";
import pKnowledge from "./knowledge.js";
import pMoney from "./money.js";
import pAgents from "./agents.js";
import { life as pLife, journal as pJournal } from "./folders.js";
import { esc, tabs } from "../ui.js";
import { routeOfModule } from "../module-model.js";

const RENDER = {
  today: (sub, P, rest) => pToday(sub, P, rest),
  plan: (sub, P, rest) => pPlan(sub, P, rest),
  life: (sub, P, rest) => pLife(sub, P, rest),
  journal: (sub, P, rest) => pJournal(sub, P, rest),
  accounts: (sub, P, rest) => pMoney(sub, P, rest),
  knowledge: (sub, P, rest) => pKnowledge(sub, P, rest),
  agents: (sub, P, rest) => pAgents(sub, P, rest),
};

const stripTabs = html => String(html || "").replace(/<nav class="tabs">[\s\S]*?<\/nav>/, "");

export async function renderSurface(entry, kind, sub, P, rest) {
  const route = kind === "view" ? entry.id : routeOfModule(entry.id);
  const resolved = (entry.resolved || []).filter(t => !t.missing);
  const tab = resolved.find(t => t.tabId === (sub || "")) || resolved[0];
  const owners = (entry.owners || []).filter(Boolean);
  const paths = (entry.paths || []).filter(Boolean);
  const ctx = [kind === "view" ? "视图" : "模块", owners.length ? `负责 ${owners.join(" · ")}` : ""].filter(Boolean).map(esc).join(`<span class="sep">·</span>`);
  const mast = `<header class="ph modhead"><div class="ph-row"><div class="ph-main"><div class="ctx">${ctx}</div><h1>${esc(entry.title)}</h1>${paths.length ? `<p class="lede paths">${paths.map(esc).join(" · ")}</p>` : ""}</div></div></header>`;
  const nav = resolved.length ? tabs(route, resolved.map(t => [t.tabId, t.label]), tab?.tabId) : "";
  if (!tab) return { html: `<div class="surface">${mast}<div class="body"><p class="empty">这里还没有可显示的页。</p></div></div>` };
  const page = RENDER[tab.sectionId];
  if (!page) return { html: `<div class="surface">${mast}${nav}<div class="body"><p class="empty">${esc(tab.ref)} 还没有页面。</p></div></div>` };
  const out = await page(tab.tabId, P, rest);
  return { html: `<div class="surface">${mast}${nav}${stripTabs(out?.html || "")}</div>`, mount: out?.mount };
}
