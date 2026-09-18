"use strict";
// Isolated visual-review helper. Never serves repository, account or auth files.
const http = require("node:http");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const { activityMarkup } = require("../scripts/activity-week");
const assets = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/activities", ["index.html", "text/html; charset=utf-8"]],
  ["/activities/", ["index.html", "text/html; charset=utf-8"]],
  ["/shell.css", ["../shell.css", "text/css; charset=utf-8"]],
  ["/availability-core.js", ["../owner/availability-core.js", "text/javascript; charset=utf-8"]],
  ["/shared/date-selection.js", ["../shared/date-selection.js", "text/javascript; charset=utf-8"]],
  ["/shared/basketball-teams.js", ["../shared/basketball-teams.js", "text/javascript; charset=utf-8"]],
  ["/activity-preview/preview.css", ["preview.css", "text/css; charset=utf-8"]],
  ["/activity-preview/core.js", ["core.js", "text/javascript; charset=utf-8"]],
  ["/activity-preview/ui.js", ["ui.js", "text/javascript; charset=utf-8"]],
  ["/activity-preview/basketball-ui.js", ["basketball-ui.js", "text/javascript; charset=utf-8"]],
  ["/activity-preview/basketball.css", ["basketball.css", "text/css; charset=utf-8"]],
  ["/preview.css", ["preview.css", "text/css; charset=utf-8"]],
  ["/core.js", ["core.js", "text/javascript; charset=utf-8"]],
  ["/ui.js", ["ui.js", "text/javascript; charset=utf-8"]]
]);
function createPreviewServer() {
  const server = http.createServer(async (req, res) => {
    const port = server.address().port;
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'");
    if (!["127.0.0.1:" + port, "localhost:" + port].includes(req.headers.host)) {
      res.writeHead(403).end("Local preview only"); return;
    }
    if (!["GET", "HEAD"].includes(req.method)) { res.writeHead(405, { Allow: "GET, HEAD" }).end(); return; }
    const asset = assets.get(req.url);
    if (!asset) { res.writeHead(404).end("Not found"); return; }
    try {
      let content = await readFile(path.join(__dirname, asset[0]), "utf8");
      if (asset[0] === "index.html") content = activityMarkup(content)
        .replace('href="/">Our week', 'href="http://localhost:8002/">Our week')
        .replace('id="basketball-status"', 'id="basketball-status" data-preview="true"');
      res.writeHead(200, { "Content-Type": asset[1] });
      res.end(req.method === "HEAD" ? undefined : content);
    } catch { res.writeHead(503).end("Preview unavailable"); }
  });
  return server;
}
if (require.main === module) {
  const server = createPreviewServer();
  server.on("error", () => { console.error("Preview could not start. Existing servers were not changed."); process.exitCode = 1; });
  server.listen(8010, "127.0.0.1", () => console.log("Fictional activity design preview: http://127.0.0.1:8010/"));
}
module.exports = { createPreviewServer };