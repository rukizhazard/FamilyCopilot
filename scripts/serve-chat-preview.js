"use strict";
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const types = Object.freeze({ ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp" });

function createHandler() {
  const allowed = new Set(["/chat/index.html", "/activity-preview/chat-assets/basketball-synthetic.svg",
    "/activity-preview/chat-assets/movie-synthetic.svg", "/activity-preview/chat-assets/ctbc-dea.png",
    "/activity-preview/chat-assets/forgotten-island.jpg", "/activity-preview/chat-assets/chiikawa.jpg",
    "/activity-preview/chat-assets/formosa-dreamers.webp"]);
  const html = fs.readFileSync(path.join(root, "chat/index.html"), "utf8");
  for (const match of html.matchAll(/(?:src|href)="([^" ]+\.(?:js|css))"/g)) {
    const url = new URL(match[1], "http://localhost/chat/index.html");
    if (url.origin !== "http://localhost" || url.search || url.hash) throw Error("External preview dependency");
    allowed.add(url.pathname);
  }
  return (request, response) => {
    if (!["GET", "HEAD"].includes(request.method) || !allowed.has(request.url)) {
      response.writeHead(404, { "Cache-Control": "no-store" }); response.end(); return;
    }
    fs.readFile(path.join(root, request.url.slice(1)), (error, bytes) => {
      if (error) { response.writeHead(404); response.end(); return; }
      response.writeHead(200, { "Content-Type": types[path.extname(request.url)],
        "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
      response.end(request.method === "HEAD" ? undefined : bytes);
    });
  };
}

if (require.main === module) {
  const port = Number(process.argv[2] || 34393);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error("Invalid preview port");
  const server = http.createServer(createHandler());
  server.on("error", error => { console.error(error.message); process.exitCode = 1; });
  server.listen(port, "127.0.0.1", () => console.log(`Offline chat preview: http://localhost:${port}/chat/index.html`));
  process.on("SIGINT", () => server.close());
  process.on("SIGTERM", () => server.close());
}

module.exports = { createHandler };