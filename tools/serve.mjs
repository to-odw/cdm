// Local preview server with live reload. No dependencies.
// Usage: node tools/serve.mjs [port]   (default 8080)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.argv[2]) || 8080;
const IGNORE = /(^|[\\/])(\.git|node_modules|\.tmp-preview|assets[\\/]examples)([\\/]|$)/;

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif",
  ".ico": "image/x-icon", ".pdf": "application/pdf", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8",
};

// Injected before </body>: reload on change; CSS-only changes swap stylesheets without a full reload.
const CLIENT = `<script>(function(){var es=new EventSource("/__reload");es.onmessage=function(e){
if(/\\.css$/i.test(e.data)){document.querySelectorAll('link[rel="stylesheet"]').forEach(function(l){
var u=new URL(l.href);if(u.origin!==location.origin)return;u.searchParams.set("_r",Date.now());l.href=u.href;});}
else location.reload();};})();</script>`;

const clients = new Set();

const server = http.createServer((req, res) => {
  let url;
  try { url = new URL("http://localhost" + req.url.replace(/^\/+/, "/")); }
  catch { res.writeHead(400).end("Bad request"); return; }
  if (url.pathname === "/__reload") {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    res.write(": connected\n\n");
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }

  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith("/")) rel += "index.html";
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end("Forbidden"); return; }

  fs.stat(file, (err, st) => {
    // Allow extensionless URLs like /programs -> programs.html
    if (err && !path.extname(file)) return serve(file + ".html", res);
    if (!err && st.isDirectory()) return serve(path.join(file, "index.html"), res);
    serve(file, res);
  });
});

function serve(file, res) {
  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<p>404: ${path.relative(ROOT, file)}</p>` + CLIENT);
      return;
    }
    const ext = path.extname(file).toLowerCase();
    const headers = { "Content-Type": TYPES[ext] || "application/octet-stream", "Cache-Control": "no-store" };
    if (ext === ".html") {
      const html = buf.toString("utf8");
      const out = html.includes("</body>") ? html.replace(/<\/body>(?![\s\S]*<\/body>)/i, CLIENT + "</body>") : html + CLIENT;
      res.writeHead(200, headers).end(out);
    } else {
      res.writeHead(200, headers).end(buf);
    }
  });
}

// Windows fires watch events when files are merely read, so only react to a real mtime/size change.
const stamps = new Map();
function stamp(name) {
  try { const s = fs.statSync(path.join(ROOT, name)); return s.isFile() ? s.mtimeMs + ":" + s.size : null; }
  catch { return "gone"; }
}
let timer = null, last = "";
fs.watch(ROOT, { recursive: true }, (_evt, name) => {
  if (!name || IGNORE.test(name)) return;
  const now = stamp(name);
  if (now === null || stamps.get(name) === now) return;
  const known = stamps.has(name);
  stamps.set(name, now);
  if (!known && now !== "gone") {
    // First sighting: only treat as a change if it was modified in the last few seconds.
    const mtime = Number(now.split(":")[0]);
    if (Date.now() - mtime > 3000) return;
  }
  last = name;
  clearTimeout(timer);
  timer = setTimeout(() => {
    const msg = last.replace(/\\/g, "/");
    console.log("changed:", msg);
    for (const c of clients) c.write(`data: ${msg}\n\n`);
  }, 120);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Serving ${ROOT}\n  http://localhost:${PORT}/\n  Live reload on. Ctrl+C to stop.`);
});
