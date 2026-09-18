"use strict";
// Independent activity-only host. Never import the owner server, Auth or caches.
// The separate serve.js remains an offline preview with connect-src 'none'.
const http = require("node:http");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const { activityMarkup } = require("../scripts/activity-week");
const { createBasketballRoute } = require("../scripts/basketball-route");
const T = require("../shared/basketball-teams");
const assets = new Map([
  ...["/", "/index.html", "/activities", "/activities/"].map(url => [url, ["index.html", "text/html; charset=utf-8"]]),
  ["/shell.css", ["../shell.css", "text/css; charset=utf-8"]],
  // Read-only pure date helper, not an owner controller or calendar adapter.
  ["/availability-core.js", ["../owner/availability-core.js", "text/javascript; charset=utf-8"]],
  ["/shared/date-selection.js", ["../shared/date-selection.js", "text/javascript; charset=utf-8"]],
  ["/shared/basketball-teams.js", ["../shared/basketball-teams.js", "text/javascript; charset=utf-8"]],
  ...["core.js", "ui.js", "basketball-ui.js", "preview.css", "basketball.css"].map(file =>
    [`/activity-preview/${file}`, [file, file.endsWith(".css") ? "text/css; charset=utf-8" : "text/javascript; charset=utf-8"]])
]);
function standaloneMarkup(html) {
  return activityMarkup(html)
    .replace('<a href="/">Our week</a>', '<span aria-disabled="true" title="Calendars are not available on this independent service">Our week (separate)</span>')
    .replace('id="activity-source">Activity discovery', 'id="activity-source">Independent activity search · TPBL on demand')
    .replace("Only dates are remembered in this same-origin tab, also used by Our week.",
      "Dates stay in this activity tab, separate from calendar-service dates. No calendar access is needed.");
}
function createActivitySearchServer({ search, now } = {}) {
  const basketball = createBasketballRoute({ search, now });
  let stopping = false, shutdown;
  const server = http.createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'");
    const reject = (code, text) => {
      if (!res.destroyed && !res.writableEnded) res.writeHead(code, { "Content-Type": "text/plain; charset=utf-8" }).end(req.method === "HEAD" ? undefined : text);
    };
    const port = server.address()?.port, host = req.headers.host;
    const names = req.rawHeaders.filter((_, i) => i % 2 === 0).map(name => name.toLowerCase());
    if (!["127.0.0.1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress) ||
      ![`127.0.0.1:${port}`, `localhost:${port}`].includes(host) ||
      names.filter(name => name === "host").length !== 1 || names.filter(name => name === "origin").length > 1 ||
      names.some(name => name === "forwarded" || name.startsWith("x-forwarded-")) ||
      req.headers.origin !== undefined && req.headers.origin !== `http://${host}` ||
      req.headers["sec-fetch-site"] && !["same-origin", "none"].includes(req.headers["sec-fetch-site"])) {
      reject(403, "Local same-origin activity service only"); return;
    }
    if (stopping) { reject(503, "Activity service stopping"); return; }
    try {
      if (req.url === "/api/activities/basketball") { await basketball.handle(req, res); return; }
      const asset = assets.get(req.url);
      if (!asset && req.url !== "/health") { reject(404, "Not found"); return; }
      if (!["GET", "HEAD"].includes(req.method)) { res.setHeader("Allow", "GET, HEAD"); reject(405, "Method not allowed"); return; }
      if (req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(req.method === "HEAD" ? undefined : JSON.stringify({ service: "activity-search", teamContract: T.contract })); return;
      }
      let content = await readFile(path.join(__dirname, asset[0]), "utf8");
      if (asset[0] === "index.html") content = standaloneMarkup(content);
      if (res.destroyed || res.writableEnded) return;
      res.writeHead(200, { "Content-Type": asset[1] }); res.end(req.method === "HEAD" ? undefined : content);
    } catch { reject(503, "Activity search unavailable"); }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 1000;
  server.setTimeout(35000, socket => socket.destroy());
  server.shutdown = () => {
    if (shutdown) return shutdown;
    stopping = true; basketball.close();
    shutdown = new Promise(resolve => {
      // Abort source work first, then give HTTP handlers a bounded drain period.
      const deadline = setTimeout(() => server.closeAllConnections(), 1000);
      deadline.unref();
      server.close(() => { clearTimeout(deadline); resolve(); });
      server.closeIdleConnections();
    });
    return shutdown;
  };
  return server;
}
function parseArguments(args) {
  if (args.length !== 2 || !args.includes("--live")) throw Error("Explicit port and mode required");
  const value = args.find(arg => /^--port=[1-9]\d{3,4}$/.test(arg));
  const port = Number(value?.slice(7));
  if (!Number.isInteger(port) || port < 1024 || port > 65535 || port === 8002) throw Error("Invalid activity port");
  return { port };
}
if (require.main === module) {
  try {
    const { port } = parseArguments(process.argv.slice(2));
    const server = createActivitySearchServer();
    const stop = () => { void server.shutdown(); };
    process.once("SIGTERM", stop); process.once("SIGINT", stop);
    server.on("error", () => {
      console.error("Activity search could not start. Existing listeners were not changed.");
      process.exitCode = 1;
    });
    server.listen(port, "127.0.0.1", () => {
      console.log(`Independent activity search: http://127.0.0.1:${port}/activities`);
      console.log(`PID ${process.pid} · live TPBL adapter on explicit Find only · no calendars, Auth or storage`);
    });
  } catch {
    console.error("Use --live and one --port=NUMBER (1024–65535, never 8002). No service started.");
    process.exitCode = 1;
  }
}
module.exports = { createActivitySearchServer, parseArguments };