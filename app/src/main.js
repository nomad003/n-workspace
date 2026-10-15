// Minimal renderer: loads views/*.json and data/records.json (built by build-index; private already excluded).
import { as, isPublic, select } from "./filter.js";
const VIEWS = ["today", "projects", "learning", "life"];
const showPrivate = new URLSearchParams(location.search).has("private");
const records = (await fetch("../data/records.json").then(r => r.ok ? r.json() : []).catch(() => []))
  .filter(r => showPrivate || isPublic(r));
const views = await Promise.all(VIEWS.map(v => fetch(`../views/${v}.json`).then(r => r.json())));
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const card = r => `<div class="card">${esc(r.title)}<br><small>${esc(r.area)} · ${esc(r.updated)}</small><br><small>${as(r.tags).map(esc).join(", ")}</small></div>`;
function render(i) {
  const v = views[i], rs = select(records, v), el = document.getElementById("view");
  const head = `<h2>${esc(v.name)} <small>(${rs.length})</small></h2>`;
  const g = r => r[v.group_by] ?? v.default_group ?? "(none)";
  if (v.layout === "kanban") el.innerHTML = head + `<div class="cols">${v.columns.map(c =>
    `<div class="col"><b>${c}</b>${rs.filter(r => g(r) === c).map(card).join("")}</div>`).join("")}</div>`;
  else if (v.layout === "table") el.innerHTML = head + (rs.length ? `<table><tr><th>title</th>${v.fields.map(f => `<th>${f}</th>`).join("")}</tr>${
    rs.map(r => `<tr><td>${esc(r.title)}</td>${v.fields.map(f => `<td>${as(r[f]).map(esc).join(", ")}</td>`).join("")}</tr>`).join("")}</table>` : "<p>暂无</p>");
  else el.innerHTML = head + (rs.map(card).join("") || "<p>暂无</p>");
  location.hash = VIEWS[i];
}
document.getElementById("nav").innerHTML = views.map((v, i) => `<a href="#${VIEWS[i]}" data-i="${i}">${esc(v.name)}</a>`).join(" ");
document.getElementById("nav").onclick = e => { if (e.target.dataset.i) { e.preventDefault(); render(+e.target.dataset.i); } };
render(Math.max(0, VIEWS.indexOf(location.hash.slice(1))));
