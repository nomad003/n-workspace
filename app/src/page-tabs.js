// Tab ids each page knows how to render. life and journal render every sections.yaml
// tab as a folder. The other pages use FALLBACK_TABS only when that page has no section.

export const FOLDER_PAGES = new Set(["life", "journal"]);

export const PAGE_RENDERERS = {
  today: ["today"],
  plan: ["board", "tree", "reviews", "learning"],
  topics: ["all", "project", "habit", "skill", "area"],
  accounts: ["identities", "groups", "subscriptions", "security", "graph"],
  knowledge: ["home", "topics", "tree", "search"],
  agents: ["agents"],
};

export const FALLBACK_TABS = {
  today: [["today", "今天"]],
  plan: [["board", "本周 / 本月"], ["tree", "目标树"], ["reviews", "复盘"], ["learning", "学习路线"]],
  topics: [["all", "全部"], ["project", "项目"], ["habit", "习惯"], ["skill", "技能"], ["area", "领域"]],
  accounts: [["identities", "身份"], ["groups", "分类"], ["subscriptions", "订阅"], ["security", "安全"], ["graph", "关系图"]],
  knowledge: [["home", "领域"], ["topics", "主题"], ["tree", "目录"], ["search", "搜索"]],
  agents: [["agents", "Agents"]],
};

export function pageTabs(section, pageId) {
  const tabs = section?.tabs;
  if (Array.isArray(tabs) && tabs.length) return tabs.map(t => [String(t.id), String(t.label ?? t.id)]);
  return (FALLBACK_TABS[pageId] || []).map(([id, label]) => [id, label]);
}

// Build warnings: a sections tab with no renderer, or a renderer whose id the section omits.
export function tabWarnings(sections) {
  const warnings = [];
  const byId = new Map((sections || []).filter(s => s && s.id).map(s => [s.id, s]));
  for (const [page, renderers] of Object.entries(PAGE_RENDERERS)) {
    const sec = byId.get(page);
    if (!sec) {
      warnings.push(`sections.yaml: no "${page}" section; ${page} uses built-in tabs (${renderers.join(", ")})`);
      continue;
    }
    const ids = (sec.tabs || []).map(t => t.id);
    const idSet = new Set(ids);
    for (const id of ids) if (!renderers.includes(id)) warnings.push(`sections.yaml: ${page}/${id} has no renderer`);
    for (const id of renderers) if (!idSet.has(id)) warnings.push(`sections.yaml: ${page} is missing tab "${id}" that the page renders`);
  }
  for (const page of FOLDER_PAGES) {
    if (!byId.get(page)) warnings.push(`sections.yaml: no "${page}" section; that page has no tabs`);
  }
  return warnings;
}
