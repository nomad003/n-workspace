import assert from "node:assert/strict";
import fs from "node:fs";
import * as yaml from "js-yaml";
import { loadV9 } from "./v9.mjs";
import {
  absorbedTarget, ageTone, daysSince, legacyTarget, moduleNoteStats, notesForPaths, resolveLayer, resolveNav, tabIndex, topicCounts, topicModuleIds,
} from "../app/src/module-model.js";

const doc = yaml.load(fs.readFileSync(new URL("../examples/life/data/sections.yaml", import.meta.url), "utf8"));
const layer = resolveLayer(doc);

assert.equal(layer.modules.length, 9);
assert.deepEqual(layer.modules.map(m => m.id), ["plan", "review", "work", "life", "learn", "content", "kb", "accounts", "team"]);
assert.deepEqual(layer.views, []);
assert.equal(layer.absorbed["today/today"], "overview");
assert.equal(layer.modules.flatMap(m => m.resolved).some(t => t.missing), false, "example tab ref did not resolve");
assert.equal(legacyTarget("journal", "cfwork", layer.modules), "work/cfwork");
assert.equal(legacyTarget("today", undefined, layer.modules), null);
assert.equal(legacyTarget("plan", "reviews", layer.modules), "review/reviews");
assert.equal(legacyTarget("agents", undefined, layer.modules), "content/agents");
assert.equal(legacyTarget("journal", "records", layer.modules), "review/records");
assert.equal(legacyTarget("journal", "daily", layer.modules), "review/daily");

const index = tabIndex(doc.sections);
for (const [ref, hit] of index) {
  const owners = layer.modules.filter(m => (m.tabs || []).includes(ref));
  if (hit.sectionId === "topics" || absorbedTarget(hit.sectionId, hit.tabId, doc.sections)) assert.equal(owners.length, 0, ref);
  else assert.equal(owners.length, 1, ref);
}

const nav = resolveNav(doc.nav, layer.modules);
assert.deepEqual(nav.map(g => g.id), ["board", "planning", "domains", "library"]);
assert.deepEqual(nav[0].items.map(i => i.id), ["overview", "timeline", "analysis"]);
assert.deepEqual(nav[1].items.map(i => i.id), ["plan", "review", "topics"]);
assert.equal(nav[1].items.find(i => i.id === "plan").href, "#plan");
assert.equal(nav[3].items.find(i => i.id === "kb").title, "知识库");
assert.equal(nav[3].items.find(i => i.id === "kb").href, "#knowledge");
assert.deepEqual(resolveNav(null, layer.modules).map(g => g.id), ["board", "planning", "domains", "library"]);
assert.equal(resolveNav(doc.nav, null), null);
assert.equal(absorbedTarget("today", undefined, doc.sections), "overview");
assert.equal(absorbedTarget("plan", "board", doc.sections), null);
assert.equal(layer.nav[0].id, "board");

assert.equal(resolveLayer({ sections: doc.sections }).modules, null);
assert.equal(resolveLayer({ sections: doc.sections, modules: [] }).modules, null);
assert.equal(legacyTarget("today", "today", null), null);
assert.equal(legacyTarget("today", "today", resolveLayer({ sections: doc.sections }).modules), null);

const missing = resolveLayer({
  sections: doc.sections,
  modules: [{ id: "life", title: "生活", owners: [], paths: [], tabs: ["nope/nope", "today/today"] }],
});
assert.equal(missing.modules[0].resolved[0].missing, true);
assert.equal(missing.modules[0].resolved[1].missing, undefined);
assert.equal(missing.modules[0].resolved[1].label.length > 0, true);

const records = [
  { id: "work-note", root: "life", updated: "2026-10-01", origin: { source_path: "work/cfwork/note.md" } },
  { id: "life-note", root: "life", updated: "2026-10-20", origin: { source_path: "life/health/sleep.md" } },
  { id: "life-index", root: "life", updated: "2026-10-21", origin: { source_path: "life/health/index.md" } },
  { id: "kb-note", root: "kb", updated: "2026-10-10", origin: { source_path: "backend/net.md" } },
  { id: "kb-other", root: "kb", updated: "2026-10-11", origin: { source_path: "unlisted/x.md" } },
];
const work = layer.modules.find(m => m.id === "work");
const life = layer.modules.find(m => m.id === "life");
const kb = layer.modules.find(m => m.id === "kb");
const workStats = moduleNoteStats(work, records, "2026-10-23");
assert.deepEqual(workStats, { count: 1, latest: "2026-10-01", days: 22 });
assert.equal("amount" in workStats, false);
assert.equal(moduleNoteStats(life, records, "2026-10-23").count, 1);
assert.equal(notesForPaths(life.paths, records).some(r => r.id === "work-note"), false);
assert.equal(moduleNoteStats(kb, records, "2026-10-23").count, 1);
assert.equal(moduleNoteStats(kb, records, "2026-10-23").latest, "2026-10-10");

const topics = [
  { id: "a", module: "life", status: { lifecycle: "active" } },
  { id: "b", module: "life", status: { lifecycle: "proposed" } },
  { id: "c", module: "learn", modules: ["content"], status: { lifecycle: "active" } },
  { id: "d", module: "learn", modules: ["learn"], status: { lifecycle: "active" } },
];
assert.deepEqual(topicModuleIds(topics[2]), ["learn", "content"]);
assert.deepEqual(topicModuleIds(topics[3]), ["learn"]);
assert.deepEqual(topicCounts("life", topics), { active: 1, proposed: 1 });
assert.deepEqual(topicCounts("content", topics), { active: 1, proposed: 0 });
assert.deepEqual(topicCounts("learn", topics), { active: 2, proposed: 0 });

assert.equal(daysSince("2026-10-01", "2026-10-23"), 22);
assert.equal(daysSince("nope", "2026-10-23"), null);
assert.equal(ageTone(30), "old");
assert.equal(ageTone(14), "stale");
assert.equal(ageTone(13), "");
assert.equal(ageTone(null), "");

const warnings = [];
const loaded = loadV9(new URL("../examples/life", import.meta.url).pathname, w => warnings.push(w));
assert.equal(loaded.modules.length, 9);
assert.equal(loaded.views.length, 0);
assert.equal(loaded.nav.length, 4);
assert.equal(loaded.absorbed["today/today"], "overview");
assert.equal(loaded.modules.some(m => m.resolved.some(t => t.missing)), false);
assert.equal(warnings.filter(w => /missing tab/.test(w)).length, 0);

console.log("module-nav: ok");
