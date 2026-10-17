// Demo mode (cross-platform, no shell env syntax): build data/ from the FICTIONAL examples/ roots, then serve on 127.0.0.1.
//   npm run demo            build + serve
//   npm run demo -- --build build only (CI / screenshots)
// Note: data/ is the shared build output; run `npm start` afterwards to rebuild from your private repos.
import { spawnSync, spawn } from "node:child_process";
import path from "node:path"; import fs from "node:fs"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = { ...process.env, KB_ROOT: path.join(ROOT, "examples", "kb", "n-knowledge-base"), LIFE_ROOT: path.join(ROOT, "examples", "life"), SHOW_PRIVATE: "1", NW_DEMO: "1" };
for (const k of ["DATA_DIR", "DATA_ROOT", "KB_DEST"]) delete env[k];
if (!fs.existsSync(env.LIFE_ROOT)) { console.error("error: examples/life not found"); process.exit(1); }
const b = spawnSync(process.execPath, [path.join(ROOT, "scripts", "build-index.mjs")], { cwd: ROOT, env, stdio: "inherit" });
if (b.status !== 0) process.exit(b.status ?? 1);
if (process.argv.includes("--build")) process.exit(0);
const s = spawn(process.execPath, [path.join(ROOT, "scripts", "serve.mjs")], { cwd: ROOT, env, stdio: "inherit" });
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { s.kill(sig); process.exit(0); });
s.on("exit", c => process.exit(c ?? 0));
