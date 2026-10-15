// Parse KB markdown frontmatter into data/records.json (gitignored).
import fs from "node:fs"; import path from "node:path";
const SRC = process.env.KB_DEST || "kb", OUT = "data";
const showPrivate = process.env.SHOW_PRIVATE === "1";
const recs = [];
function fm(t){const m=t.match(/^---\n([\s\S]*?)\n---/);if(!m)return null;const o={};
  for(const l of m[1].split("\n")){const i=l.indexOf(":");if(i>0){let v=l.slice(i+1).trim();
    if(v.startsWith("[")&&v.endsWith("]"))v=v.slice(1,-1).split(",").map(s=>s.trim()).filter(Boolean);
    o[l.slice(0,i).trim()]=v;}}return o;}
function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);
  if(e.isDirectory()){if(!e.name.startsWith("."))walk(p);}
  else if(e.name.endsWith(".md")){const f=fm(fs.readFileSync(p,"utf8"));if(!f)continue;
    f.privacy=f.privacy||"private"; if(f.privacy==="private"&&!showPrivate)continue;
    f.title=path.basename(p,".md"); f.origin={source:"n-knowledge-base",source_path:path.relative(SRC,p)};
    recs.push(f);}}}
walk(SRC); fs.mkdirSync(OUT,{recursive:true});
fs.writeFileSync(path.join(OUT,"records.json"),JSON.stringify(recs));
console.log(`${recs.length} records (private ${showPrivate?"shown":"hidden"})`);
