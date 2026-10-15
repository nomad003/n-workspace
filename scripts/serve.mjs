// Zero-dependency static server bound to 127.0.0.1 only (serves app/, views/, data/ for local use).
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const ROOT = path.resolve(process.env.SERVE_ROOT || "."), PORT = +(process.env.PORT || 5173), HOST = "127.0.0.1";
const ALLOW = ["/app/", "/views/", "/data/bundle.json", "/schema/", "/index.html", "/"];
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml" };
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (!ALLOW.some(a => a === "/" ? p === "/" : p === a || p.startsWith(a))) { res.writeHead(404).end("not found"); return; }
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404).end("not found"); return; }
    res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream", "cache-control": "no-store" }).end(b); });
}).listen(PORT, HOST, () => console.log(`n-workspace: http://${HOST}:${PORT}/app/`));
