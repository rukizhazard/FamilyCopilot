"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createHandler } = require("../scripts/serve-chat-preview");
const handler = createHandler();
function request(url, method = "GET") {
  return new Promise(resolve => {
    const result = {};
    handler({ url, method }, {
      writeHead(status, headers) { Object.assign(result, { status, headers }); },
      end(body) { resolve({ ...result, body }); }
    });
  });
}

test("preview serves reference images unchanged with correct MIME and HEAD", async () => {
  for (const [name, type] of [["ctbc-dea.png", "image/png"], ["forgotten-island.jpg", "image/jpeg"], ["chiikawa.jpg", "image/jpeg"], ["formosa-dreamers.webp", "image/webp"]]) {
    const url = `/activity-preview/chat-assets/${name}`;
    const response = await request(url);
    assert.equal(response.status, 200);
    assert.equal(response.headers["Content-Type"], type);
    assert.equal(response.headers["Cache-Control"], "no-store");
    assert.equal(response.headers["X-Content-Type-Options"], "nosniff");
    assert.deepEqual(response.body, fs.readFileSync(path.join(__dirname, "..", url)));
    const head = await request(url, "HEAD");
    assert.equal(head.status, 200); assert.equal(head.body, undefined);
  }
});

test("preview serves HTML dependencies but rejects APIs, private paths, queries and non-read methods", async () => {
  for (const url of ["/chat/index.html", "/activity-preview/chat-assets.js", "/activity-preview/activity-cards.css"]) {
    assert.equal((await request(url)).status, 200);
  }
  for (const url of ["/api/availability", "/.env", "/local-calendars/school-family.json", "/chat/../chat/index.html",
    "/activity-preview/chat-assets/ctbc-dea.png?test=1", "http://localhost/chat/index.html", "/%2e%2e/.env"]) {
    assert.equal((await request(url)).status, 404);
  }
  for (const method of ["POST", "PUT", "DELETE", "OPTIONS"]) {
    assert.equal((await request("/chat/index.html", method)).status, 404);
  }
});