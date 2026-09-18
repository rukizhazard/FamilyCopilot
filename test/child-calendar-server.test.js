"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), http = require("node:http");
const { once } = require("node:events");
const { createServer } = require("../scripts/serve-owner");
const { perform: fixture } = require("../browser-fixtures/child-calendar");
const findBody = { acknowledged: true, startDate: "2026-10-09", endDate: "2026-10-15" };
async function harness(t, options = {}) {
  let calls = 0, reads = 0, writes = 0, clears = 0;
  const server = createServer({ synthetic: true, storage: { read() { reads++; throw Error(); }, write() { writes++; throw Error(); }, clear() { clears++; throw Error(); } },
    performChild: async args => { calls++; return fixture(args); }, ...options });
  server.listen(0, "127.0.0.1"); await once(server, "listening"); t.after(() => server.shutdown());
  const request = (path, body, csrf, headers = {}) => new Promise((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port: server.address().port, path, method: body === undefined ? "GET" : "POST",
      headers: { Host: "localhost:8002", ...(body === undefined ? {} : { Origin: "http://localhost:8002", "Content-Type": "application/json", "X-Owner-CSRF": csrf || "bad" }), ...headers } }, res => {
      let text = ""; res.on("data", c => { text += c; }); res.on("end", () => resolve({ status: res.statusCode, text, data: body === undefined ? null : JSON.parse(text) }));
    }); req.on("error", reject); req.end(body === undefined ? undefined : JSON.stringify(body));
  });
  const page = await request("/"), csrf = /name="owner-csrf" content="([a-f0-9]+)"/.exec(page.text)[1];
  return { server, request, page, csrf, post: (path, body = {}, headers) => request(path, body, csrf, headers), counts: () => ({ calls, reads, writes, clears }) };
}
async function review(h, disclosure = "details") {
  const list = await h.post("/api/child/find", findBody); assert.equal(list.status, 200);
  const body = { handle: list.data.calendars[0].handle, person: "Kimi", guardian: true, disclosure, startDate: "2026-10-09", endDate: "2026-10-15" };
  const reviewed = await h.post("/api/child/review", body); assert.equal(reviewed.status, 200);
  return { token: reviewed.data.token, body };
}
test("child startup is idle; live capability gate stays unavailable and rejects live calls", async t => {
  const h = await harness(t, { synthetic: false });
  // Capability, not presentation copy: concurrent Our week work owns the UI.
  assert.match(h.page.text, /name="child-mode" content="unavailable"/);
  assert.deepEqual(h.counts(), { calls: 0, reads: 0, writes: 0, clears: 0 });
  assert.equal((await h.post("/api/child/find", findBody)).data.status, "child_not_ready");
  assert.deepEqual(h.counts(), { calls: 0, reads: 0, writes: 0, clears: 0 });
});
test("child end-to-end consent/find/import/clear never accesses parent file or exposes provider IDs", async t => {
  const h = await harness(t), r = await review(h);
  assert.equal(h.counts().calls, 1);
  const imported = await h.post("/api/child/import", { token: r.token, confirmed: true });
  assert.equal(imported.status, 200); assert.equal(imported.data.events.length, 3);
  assert.doesNotMatch(imported.text, /SYNTHETIC-ONLY-ID|providerId|attendees|location|description/);
  assert.equal((await h.post("/api/child/import", { token: r.token, confirmed: true })).status, 503);
  assert.equal((await h.post("/api/child/clear")).status, 200);
  assert.deepEqual(h.counts(), { calls: 2, reads: 0, writes: 0, clears: 0 });
});
test("every child operation enforces exact Origin/CSRF/body limits before adapter work", async t => {
  const h = await harness(t);
  for (const route of ["find", "review", "import", "clear", "edit"]) {
    for (const headers of [{ Origin: "http://evil.test" }, { "X-Owner-CSRF": "wrong" }, { "X-Forwarded-Host": "localhost:8002" }, { Host: "127.0.0.1:8002", Origin: "http://127.0.0.1:8002" }, { "Content-Type": "text/plain" }]) {
      assert.equal((await h.post(`/api/child/${route}`, {}, headers)).status, 403);
    }
  }
  for (const body of [{}, { ...findBody, acknowledged: false }, { ...findBody, startDate: "2026-10-01" }, { ...findBody, url: "https://evil.test" }, { extra: "x".repeat(300) }]) assert.equal((await h.post("/api/child/find", body)).status, 400);
  assert.equal(h.counts().calls, 0);
});
test("cross-page source handle and review token replay are refused before provider events", async t => {
  const h = await harness(t), r = await review(h), next = await h.request("/"), other = /name="owner-csrf" content="([a-f0-9]+)"/.exec(next.text)[1];
  assert.equal((await h.request("/api/child/review", r.body, other)).status, 400);
  assert.equal((await h.request("/api/child/import", { token: r.token, confirmed: true }, other)).status, 503);
  assert.equal(h.counts().calls, 1);
});
test("child import shares single-flight through cleanup and clear fences a late result without disk deletion", async t => {
  let started, finish, imports = 0;
  const ready = new Promise(r => { started = r; }), wait = new Promise(r => { finish = r; });
  const h = await harness(t, { performChild: async args => {
    if (args.action === "import") { imports++; started(); await wait; }
    return fixture(args);
  } });
  const r = await review(h), importing = h.post("/api/child/import", { token: r.token, confirmed: true }); await ready;
  assert.equal((await h.post("/api/availability", { acknowledged: true, requestId: "11111111-1111-4111-8111-111111111111" })).status, 409);
  const cleared = h.post("/api/child/clear");
  await new Promise(resolve => h.server.once("request", () => setImmediate(resolve))); finish();
  assert.equal((await cleared).status, 200); assert.equal((await importing).data.status, "cancelled"); assert.equal(imports, 1);
  assert.equal(h.counts().clears, 0); assert.equal(h.counts().reads, 0);
});
test("child expiry rejects pending and subsequent work without touching the parent snapshot", async t => {
  let now = Date.now(), finish, started;
  const ready = new Promise(r => { started = r; });
  const h = await harness(t, { now: () => now, performChild: async args => { if (args.action === "import") { started(); await new Promise(r => { finish = r; }); } return fixture(args); } });
  const r = await review(h), importing = h.post("/api/child/import", { token: r.token, confirmed: true }); await ready;
  now += 1800001; finish(); assert.equal((await importing).data.status, "expired");
  assert.equal((await h.post("/api/child/find", findBody)).status, 403); assert.equal(h.counts().reads, 0); assert.equal(h.counts().clears, 0);
});
test("child cleanup failure blocks all future calendar work but preserves existing parent file bytes", async t => {
  const h = await harness(t, { performChild: async ({ record }) => { record("cleanup_failed"); throw Error("SECRET token source@example.test"); } });
  const result = await h.post("/api/child/find", findBody); assert.equal(result.data.status, "cleanup_failed"); assert.doesNotMatch(result.text, /SECRET|token|@/);
  assert.equal((await h.post("/api/status")).data.status, "cleanup_failed");
  assert.equal((await h.post("/api/child/clear")).status, 503);
  assert.equal((await h.post("/api/availability", { acknowledged: true, requestId: "11111111-1111-4111-8111-111111111111" })).status, 503);
  assert.equal(h.counts().clears, 0); assert.equal(h.counts().writes, 0); assert.equal(h.counts().reads, 0);
});
test("edit and range clear revoke one-use review and require fresh consent", async t => {
  const h = await harness(t);
  for (const path of ["/api/child/edit", "/api/child/clear", "/api/clear"]) {
    const r = await review(h); assert.equal((await h.post(path, path === "/api/clear" ? { reason: "range" } : {})).status, 200);
    assert.equal((await h.post("/api/child/import", { token: r.token, confirmed: true })).status, 503);
  }
  assert.equal(h.counts().calls, 3); assert.equal(h.counts().clears, 0);
});
test("cleanup_failed exception without a record is sticky across child and parent requests", async t => {
  let calls = 0;
  const { OwnerFailure } = require("../scripts/owner-calendar");
  const h = await harness(t, { performChild: async () => { calls++; throw new OwnerFailure("cleanup_failed"); } });
  assert.equal((await h.post("/api/child/find", findBody)).data.status, "cleanup_failed");
  assert.equal((await h.post("/api/status")).data.status, "cleanup_failed");
  assert.equal((await h.post("/api/child/find", findBody)).data.status, "cleanup_failed");
  assert.equal((await h.post("/api/child/clear")).status, 503);
  assert.equal(calls, 1);
  assert.deepEqual(h.counts(), { calls: 0, reads: 0, writes: 0, clears: 0 });
});
test("adapter-mutated failure codes never become child HTTP output", async t => {
  const { OwnerFailure } = require("../scripts/owner-calendar");
  const h = await harness(t, { performChild: async () => { const e = new OwnerFailure(); e.code = "PRIVATE provider-id token"; throw e; } });
  const result = await h.post("/api/child/find", findBody);
  assert.equal(result.data.status, "unavailable");
  assert.doesNotMatch(result.text, /PRIVATE|provider-id|token/);
});
test("later disabled record cannot undo a child cleanup failure or release data", async t => {
  const h = await harness(t, { performChild: async args => { args.record("cleanup_failed"); return fixture(args); } });
  const result = await h.post("/api/child/find", findBody);
  assert.equal(result.status, 503); assert.equal(result.data.status, "cleanup_failed");
  assert.doesNotMatch(result.text, /calendars|handle|SYNTHETIC/);
  assert.equal((await h.post("/api/status")).data.status, "cleanup_failed");
});