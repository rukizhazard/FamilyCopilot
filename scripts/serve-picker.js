"use strict";
const http = require("node:http");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const files = Object.freeze({ "/":"index.html", "/index.html":"index.html", "/redirect.html":"redirect.html",
  "/main.js":"main.js", "/redirect.js":"redirect.js", "/picker.css":"picker.css", "/MSAL-LICENSE.txt":"MSAL-LICENSE.txt" });
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src data:; connect-src https://login.microsoftonline.com https://graph.microsoft.com; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'";
function createServer(root = path.resolve(__dirname, "../dist-picker")) {
  return http.createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store"); res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Content-Type-Options", "nosniff"); res.setHeader("Content-Security-Policy", CSP);
    res.setHeader("X-Frame-Options", "DENY");
    // No COOP header on the redirect bridge, as required by MSAL v5.
    if (req.headers.host !== "localhost:8001" || !["GET", "HEAD"].includes(req.method)) { res.writeHead(403).end(); return; }
    if (!Object.hasOwn(files, req.url)) { res.writeHead(404).end(); return; }
    try {
      const name = files[req.url], body = await readFile(path.join(root, name));
      res.setHeader("Content-Type", ({ ".html":"text/html", ".css":"text/css", ".js":"text/javascript", ".txt":"text/plain" })[path.extname(name)] + "; charset=utf-8");
      res.writeHead(200).end(req.method === "HEAD" ? undefined : body);
    } catch { res.writeHead(503).end("Local bundle unavailable. Build the picker first."); }
    // Deliberately no request, query-string, callback, or payload logs.
  });
}
if (require.main === module) {
  const synthetic = process.argv[2] === "--synthetic";
  const server = createServer(synthetic ? path.resolve(__dirname, "../dist-picker-synthetic") : undefined);
  server.on("error", () => { console.error("Picker server could not start on loopback port 8001."); process.exitCode = 1; });
  server.listen(8001, "127.0.0.1", () => console.log(`${synthetic ? "SYNTHETIC HARNESS" : "Picker"}: http://localhost:8001/ (loopback only; no request logs)`));
}
module.exports = { createServer, files, CSP };