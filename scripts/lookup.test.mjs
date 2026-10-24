import assert from "node:assert/strict";
import fs from "node:fs";
import * as yaml from "js-yaml";
import { moduleIdsForRecord, resolveLayer, scopedFolderTabs, topicIdsForRecord } from "../app/src/module-model.js";
import { searchNotes } from "../app/src/search-model.js";
import { TIMELINE_EXCLUDE, buildTimeline, isStructuralNote, monthKey, noteDisplayTitle, timelineCounts, weekKey } from "../app/src/timeline-model.js";

const doc = yaml.load(fs.readFileSync(new URL("../examples/life/data/sections.yaml", import.meta.url), "utf8"));
const layer = resolveLayer(doc);
const learn = layer.modules.find(m => m.id === "learn");
const lifeTabs = scopedFolderTabs(learn, "life").map(t => t.tabId);
assert.deepEqual(lifeTabs, ["mind", "english"]);
assert.equal(lifeTabs.includes("family"), false);
assert.equal(scopedFolderTabs(null, "life"), null);
assert.deepEqual(scopedFolderTabs(layer.modules.find(m => m.id === "work"), "journal").map(t => t.tabId), ["work", "cfwork", "server"]);

const lifeNote = { id: "life:life/health/running-log.md", root: "life", title: "跑步记录", date: "2026-10-09", updated: "2026-10-12", origin: { source_path: "life/health/running-log.md" } };
const workNote = { id: "life:work/cfwork/standup.md", root: "life", title: "站会", updated: "2026-10-12", origin: { source_path: "work/cfwork/standup.md" } };
const kbNote = { id: "kb:cs/哈希表.md", root: "kb", title: "哈希表", updated: "2026-10-02", origin: { source_path: "cs/哈希表.md" } };
assert.deepEqual(moduleIdsForRecord(layer.modules, lifeNote), ["life"]);
assert.deepEqual(moduleIdsForRecord(layer.modules, workNote), ["work"]);
assert.equal(moduleIdsForRecord(layer.modules, workNote).includes("life"), false);
assert.deepEqual(moduleIdsForRecord(layer.modules, kbNote), ["kb"]);
assert.deepEqual(moduleIdsForRecord(layer.modules, { root: "life", origin: { source_path: "life/idea/note.md" } }), ["life"]);
assert.deepEqual(moduleIdsForRecord(layer.modules, { root: "life", origin: { source_path: "learn/idea/note.md" } }), []);
assert.ok(moduleIdsForRecord(layer.modules, { root: "life", origin: { source_path: "review/daily/2026/10/2026-10-13.md" } }).includes("review"));
assert.deepEqual(moduleIdsForRecord(layer.modules, { root: "life", origin: { source_path: "team/team.md" } }), ["team"]);
assert.equal(moduleIdsForRecord(layer.modules, { root: "life", origin: { source_path: "team/index.md" } }).includes("accounts"), false);

const topics = [
  { id: "running", title: "跑步", module: "life", paths: ["life/health"], links: { tasks: ["t-run-plan"], notes: [] }, entries: [{ date: "2026-10-13", kind: "metric", title: "周跑量" }] },
  { id: "blog", title: "博客", module: "learn", modules: ["content"], paths: ["learn/idea"], links: { tasks: [], notes: [] }, entries: [] },
];
assert.deepEqual(topicIdsForRecord(topics, lifeNote), ["running"]);

const events = buildTimeline({
  records: [lifeNote, workNote, kbNote],
  topics,
  tasks: [{ id: "t-run-plan", title: "计划写完", status: "done", done_at: "2026-10-03" }, { id: "t-open", title: "还没做", status: "open", done_at: null }],
  reviews: [{ id: "r1", kind: "quarterly", instances: [{ period: "2026-Q3", status: "done", done_at: "2026-10-02", note: "见 life://life/health/running-log" }, { period: "2026-Q4", status: "open", done_at: null }] }],
  modules: layer.modules,
});
const byId = Object.fromEntries(events.map(e => [e.id, e]));
assert.equal(byId["note:life:life/health/running-log.md"].date, "2026-10-09");
assert.equal(byId["note:life:life/health/running-log.md"].type, "note");
assert.equal(byId["note:life:life/health/running-log.md"].module, "life");
assert.equal(byId["note:life:life/health/running-log.md"].topic, "running");
assert.equal(byId["kb:kb:cs/哈希表.md"].type, "kb");
assert.equal(byId["kb:kb:cs/哈希表.md"].source, "kb");
assert.equal(byId["kb:kb:cs/哈希表.md"].touch, true);
assert.equal(byId["note:life:life/health/running-log.md"].touch, false);
assert.equal(byId["note:life:work/cfwork/standup.md"].date, "2026-10-12");
assert.equal(byId["note:life:work/cfwork/standup.md"].touch, true);
assert.equal(byId["task:t-run-plan"].module, "life");
assert.equal(byId["task:t-open"], undefined);
assert.equal(byId["review:r1:2026-Q3"].type, "review");
assert.equal(byId["review:r1:2026-Q3"].topic, "running");
assert.ok(events.some(e => e.type === "topic" && e.topic === "running"));
const counts = timelineCounts(events);
assert.equal(counts.total, events.length);
assert.ok(counts.byModule.life >= 3);
assert.ok(counts.byModule.kb >= 1);
assert.equal(counts.byType.task, 1);
assert.equal(weekKey("2026-01-01"), "2026-W01");
assert.equal(monthKey("2026-10-14"), "2026-10");

assert.ok(TIMELINE_EXCLUDE.files.includes("index.md"));
assert.ok(TIMELINE_EXCLUDE.dirs.includes("archive") && TIMELINE_EXCLUDE.dirs.includes("templates"));
const structuralPaths = ["index.md", "dir/README.md", "REORG.md", "docs/AGENTS.md", "notes/Daily-Notes-MOC.md", "MOC.md", "templates/Note.md", "archive/old.md", "work/archive/kept.md"];
for (const root of ["life", "kb"]) {
  for (const source_path of structuralPaths) {
    const dropped = buildTimeline({ records: [{ id: `${root}:${source_path}`, root, title: "index", updated: "2026-10-23", origin: { source_path } }] });
    assert.equal(dropped.length, 0, `${root}:${source_path}`);
    assert.equal(isStructuralNote({ origin: { source_path } }), true);
  }
}
const kept = buildTimeline({ records: [{ id: "life:notes/a.md", root: "life", title: "A", date: "2024-01-01", updated: "2026-10-23", origin: { source_path: "notes/a.md" } }, { id: "kb:cs/b.md", root: "kb", title: "B", updated: "2026-10-22", origin: { source_path: "cs/b.md" } }] });
assert.equal(kept.find(e => e.id === "note:life:notes/a.md").date, "2024-01-01");
assert.equal(kept.find(e => e.id === "note:life:notes/a.md").touch, false);
assert.equal(kept.find(e => e.id === "kb:kb:cs/b.md").date, "2026-10-22");
assert.equal(kept.find(e => e.id === "kb:kb:cs/b.md").touch, true);

const examplePath = "archive/index.md";
const example = fs.readFileSync(new URL("../examples/life/archive/index.md", import.meta.url), "utf8");
const exampleBody = example.replace(/^---[\s\S]*?\n---\r?\n?/, "");
assert.equal(isStructuralNote({ origin: { source_path: examplePath } }), true);
assert.equal(noteDisplayTitle({ path: examplePath, text: exampleBody }), "归档目录");
assert.equal(noteDisplayTitle({ title: "健康", path: "life/health/index.md", text: "# 别的" }), "健康");
assert.equal(noteDisplayTitle({ path: "life/health/index.md", text: "没有标题" }), "health");
assert.equal(noteDisplayTitle({ path: "life/health/running-log.md", text: "# 忽略" }), "running-log");
assert.equal(noteDisplayTitle({ path: "notes/Daily-Notes-MOC.md", text: "# 日记总览" }), "日记总览");
assert.equal(buildTimeline({ records: [{ id: "life:archive/index.md", root: "life", title: "归档目录", updated: "2026-10-23", origin: { source_path: examplePath } }] }).length, 0);

const entries = [
  { id: "a", title: "跑步记录", root: "life", path: "life/health/running-log.md", text: "周四轻松跑", date: "2026-10-09", modules: ["life"], topics: ["running"], tags: [] },
  { id: "b", title: "哈希表", root: "kb", path: "cs/哈希表.md", text: "平均查找", date: "2026-10-02", modules: ["kb"], topics: [], tags: ["cs"] },
];
const bodyHits = searchNotes(entries, { q: "轻松跑" });
assert.deepEqual(bodyHits.map(h => h.entry.id), ["a"]);
assert.equal(searchNotes(entries, { q: "轻松跑", source: "kb" }).length, 0);
assert.equal(searchNotes(entries, { q: "轻松跑", module: "life" }).length, 1);
assert.equal(searchNotes(entries, { q: "轻松跑", module: "work" }).length, 0);
assert.equal(searchNotes(entries, { topic: "running" }).length, 1);
assert.equal(searchNotes(entries, { from: "2026-10-08", to: "2026-10-10" }).length, 1);
assert.equal(searchNotes(entries, { from: "2026-10-01", to: "2026-10-05" })[0].entry.id, "b");
const structuralHit = { id: "s", title: "归档目录", root: "life", path: "archive/index.md", text: "结构索引", date: "2026-10-23", modules: [], topics: [], tags: [] };
assert.equal(searchNotes([...entries, structuralHit], { q: "结构索引" })[0].entry.id, "s");

console.log("lookup: ok");
