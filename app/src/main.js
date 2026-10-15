// Minimal renderer: loads views/*.json and data/records.json (served at build time).
const VIEWS = ["today","projects","learning","life"];
const records = await fetch("../data/records.json").then(r=>r.ok?r.json():[]).catch(()=>[]);
const views = await Promise.all(VIEWS.map(v=>fetch(`../views/${v}.json`).then(r=>r.json())));
const as = v => Array.isArray(v)?v:[v];
function match(r,f={}){for(const[k,vals]of Object.entries(f)){
  if(k==="updated_within_days"){if(!r.updated||(Date.now()-new Date(r.updated))/864e5>vals)return false;continue;}
  if(!vals.includes(r[k]))return false;}return r.privacy!=="private";}
function card(r){return `<div class="card">${r.title}<br><small>${as(r.tags||[]).join(", ")}</small></div>`;}
function render(v){const rs=records.filter(r=>match(r,v.filter));const el=document.getElementById("view");
  if(v.layout==="kanban")el.innerHTML=`<h2>${v.name}</h2><div class="cols">${v.columns.map(c=>
    `<div class="col"><b>${c}</b>${rs.filter(r=>r[v.group_by]===c).map(card).join("")}</div>`).join("")}</div>`;
  else el.innerHTML=`<h2>${v.name}</h2>${rs.map(card).join("")||"<p>暂无</p>"}`;}
document.getElementById("nav").innerHTML=views.map((v,i)=>`<a data-i="${i}">${v.name}</a>`).join("");
document.getElementById("nav").onclick=e=>e.target.dataset.i&&render(views[e.target.dataset.i]);
render(views[0]);
