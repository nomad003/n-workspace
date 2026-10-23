// Zero-dependency static server bound to 127.0.0.1 only (serves app/, views/, data/ for local use).
// /files/<kb|life>/<path>: note attachments, ONLY those listed in data/attachments.json (written by build-index; never .md, .enc or data/).
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const ROOT = path.resolve(process.env.SERVE_ROOT || "."), PORT = +(process.env.PORT || 5173), HOST = "127.0.0.1";
const ALLOW = ["/app/", "/views/", "/data/bundle.json", "/data/kb-index.json", "/data/life-index.json", "/data/notes/", "/index.html", "/"];
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".pdf": "application/pdf", ".mp4": "video/mp4", ".txt": "text/plain; charset=utf-8", ".csv": "text/csv; charset=utf-8" };
const KB_ROOT = path.resolve(process.env.KB_ROOT || process.env.KB_DEST || (fs.existsSync("kb/n-knowledge-base") ? "kb/n-knowledge-base" : "kb")), LIFE_ROOT = path.resolve(process.env.LIFE_ROOT || "life");
let allow = null, allowAt = 0;
const attachments = () => { const f = path.join(ROOT, "data", "attachments.json"); try { const m = fs.statSync(f).mtimeMs; if (m !== allowAt) { allow = new Set(JSON.parse(fs.readFileSync(f, "utf8"))); allowAt = m; } } catch { allow = new Set(); } return allow; };
const send = (res, f) => fs.readFile(f, (e, b) => { if (e) { res.writeHead(404).end("not found"); return; }
  res.writeHead(200, { "content-type": TYPES[path.extname(f).toLowerCase()] || "application/octet-stream", "cache-control": "no-store", "x-content-type-options": "nosniff" }).end(b); });
http.createServer((req, res) => {
  let p; try { p = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch { res.writeHead(400).end(); return; }
  const fm = p.match(/^\/files\/(kb|life)\/(.+)$/);
  if (fm) { const key = `${fm[1]}/${fm[2]}`, base = fm[1] === "kb" ? KB_ROOT : LIFE_ROOT, f = path.join(base, fm[2]);
    if (!attachments().has(key) || !f.startsWith(base + path.sep)) { res.writeHead(404).end("not found"); return; }
    if (/\.html?$/i.test(f)) res.setHeader("content-security-policy", "sandbox; default-src 'self' 'unsafe-inline' data:"); // exported reports: no scripts, no network
    return send(res, f); }
  if (!ALLOW.some(a => a === "/" ? p === "/" : p === a || p.startsWith(a))) { res.writeHead(404).end("not found"); return; }
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT + path.sep)) { res.writeHead(403).end(); return; }
  send(res, f);
}).listen(PORT, HOST, () => console.log(`n-workspace: http://${HOST}:${PORT}/app/`));
