"use strict";
// Isolated ephemeral HTTP listeners and injected synthetic stores only.
const test = require("node:test"), assert = require("node:assert/strict"), http = require("node:http");
const { once } = require("node:events");
const { createServer } = require("../scripts/serve-owner");
const { perform: fixture } = require("../browser-fixtures/child-calendar");
const { OwnerFailure } = require("../scripts/owner-calendar");
const dates = { acknowledged: true, startDate: "2026-10-09", endDate: "2026-10-15" };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
async function harness(t, options = {}, factory = createServer) {
  const counts = { reads: 0, writes: 0, clears: 0, calls: 0, parentReads: 0, parentWrites: 0, parentClears: 0 };
  let saved = null;
  const store = { read() { counts.reads++; return structuredClone(saved); }, write(access, data) { counts.writes++; saved = { status: "saved", access, data }; }, clear() { counts.clears++; saved = null; } };
  const server = factory({ synthetic: true, childStorage: store,
    storage: { read() { counts.parentReads++; throw Error("No parent read"); }, write() { counts.parentWrites++; throw Error("No parent write"); }, clear() { counts.parentClears++; } },
    performChild: async args => { counts.calls++; return fixture(args); }, ...options });
  server.listen(0, "127.0.0.1"); await once(server, "listening"); t.after(() => server.shutdown());
  const request = (route, body, csrf, headers = {}) => new Promise((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port: server.address().port, path: route, method: body === undefined ? "GET" : "POST",
      headers: { Host: "localhost:8002", ...(body === undefined ? {} : { Origin: "http://localhost:8002", "Content-Type": "application/json", "X-Owner-CSRF": csrf }), ...headers } }, res => {
      let text = ""; res.on("data", c => { text += c; }); res.on("end", () => resolve({ status: res.statusCode, text, data: body === undefined ? null : JSON.parse(text) }));
    }); req.on("error", reject); req.end(body === undefined ? undefined : JSON.stringify(body));
  });
  const page = await request("/"), csrf = /name="owner-csrf" content="([a-f0-9]+)"/.exec(page.text)[1];
  const next = async () => /name="owner-csrf" content="([a-f0-9]+)"/.exec((await request("/")).text)[1];
  return { server, request, csrf, page, next, counts, store, post: (route, body = {}, headers) => request(route, body, csrf, headers) };
}
async function review(h, disclosure = "details") {
  const found = await h.post("/api/child/find", dates); assert.equal(found.status, 200);
  const body = { handle: found.data.calendars[0].handle, person: "Kimi", guardian: true, disclosure, startDate: dates.startDate, endDate: dates.endDate };
  const result = await h.post("/api/child/review", body); assert.equal(result.status, 200);
  return { body, token: result.data.token, summary: result.data.summary };
}
async function imported(h) { const r = await review(h); const result = await h.post("/api/child/import", { token: r.token, confirmed: true }); assert.equal(result.status, 200); return { ...r, data: result.data }; }
test("saved is explicit, exact-bounded, CSRF/origin-gated and never reads on startup/status or queries on miss", async t => {
  const h = await harness(t); await h.post("/api/status"); assert.equal(h.counts.reads, 0); assert.equal(h.counts.calls, 0);
  for (const body of [{}, { ...dates, acknowledged: false }, { ...dates, startDate: "2026-10-10" }, { ...dates, endDate: "2026-10-16" }, { ...dates, token: "secret" }]) assert.equal((await h.post("/api/child/saved", body)).status, 400);
  for (const headers of [{ Origin: "http://evil.test" }, { "X-Owner-CSRF": "bad" }, { "Content-Type": "text/plain" }]) assert.equal((await h.post("/api/child/saved", dates, headers)).status, 403);
  assert.equal(h.counts.reads, 0);
  assert.deepEqual((await h.post("/api/child/saved", dates)).data, { status: "cache_missing" });
  assert.equal(h.counts.reads, 1); assert.equal(h.counts.calls, 0); assert.equal(h.counts.parentReads, 0);
});
test("successful import saves reviewed settings after cleanup; new page saved does not restore handles/tokens", async t => {
  const h = await harness(t), r = await imported(h); assert.equal(h.counts.writes, 1); assert.match(r.summary, /until Clear/);
  const other = await h.next(), saved = await h.request("/api/child/saved", dates, other);
  assert.equal(saved.status, 200); assert.deepEqual(saved.data, { status: "saved", access: { person: "Kimi", guardian: true, disclosure: "details", sourceName: "Fictional shared source <not real>" }, data: r.data });
  assert.doesNotMatch(saved.text, /token|handle|SYNTHETIC-ONLY-ID/);
  assert.equal((await h.request("/api/child/review", r.body, other)).status, 400);
  assert.equal((await h.request("/api/child/import", { token: r.token, confirmed: true }, other)).status, 503);
  assert.equal(h.counts.calls, 2); assert.equal(h.counts.parentWrites, 0);
});
test("RAM survives reload but not server recreation; injected stores alone select disk retention", async t => {
  const h = await harness(t, { childStorage: undefined }); const r = await imported(h);
  assert.match(r.summary, /restart/); assert.doesNotMatch(r.summary, /no child saved file.*until Clear/);
  assert.equal((await h.request("/api/child/saved", dates, await h.next())).data.status, "saved");
  const empty = await harness(t, { childStorage: undefined }); assert.equal((await empty.post("/api/child/saved", dates)).data.status, "cache_missing");
});
test("leave/range and review cancellation preserve completed snapshot; privacy edit and child Clear delete only child", async t => {
  for (const [route, body, keep] of [["/api/child/clear", { reason: "leave" }, true], ["/api/child/clear", { reason: "range" }, true],
    ["/api/child/edit", { reason: "cancel" }, true], ["/api/clear", { reason: "range" }, true], ["/api/clear", { reason: "leave" }, true],
    ["/api/child/edit", {}, false], ["/api/child/clear", {}, false]]) {
    const h = await harness(t); const r = await imported(h); const clears = h.counts.clears;
    assert.equal((await h.post(route, body)).status, 200);
    const saved = await h.request("/api/child/saved", dates, await h.next());
    assert.equal(saved.data.status, keep ? "saved" : "cache_missing"); if (keep) assert.equal(saved.data.data.checkedAt, r.data.checkedAt);
    assert.equal(h.counts.clears, clears + (keep ? 0 : 1)); assert.equal(h.counts.parentClears, 0);
  }
});
test("same-source update failure retains disk with no fallback; source/disclosure change invalidates", async t => {
  let failing = false;
  const h = await harness(t, { performChild: async args => { if (failing && args.action === "import") { args.record("workflow_disabled"); throw new OwnerFailure("unavailable"); } return fixture(args); } });
  const r = await imported(h); failing = true;
  const fresh = await h.post("/api/child/review", r.body);
  const result = await h.post("/api/child/import", { token: fresh.data.token, confirmed: true });
  assert.equal(result.data.status, "unavailable"); assert.equal(Object.hasOwn(result.data, "data"), false);
  assert.equal((await h.post("/api/child/saved", dates)).data.data.checkedAt, r.data.checkedAt);
  const next = await review(h, "busy_only"); assert.ok(next.token);
  assert.equal((await h.post("/api/child/saved", dates)).data.status, "cache_missing");
});
test("failed RAM update also keeps completed data for a separate explicit saved view, never the failed response", async t => {
  let fail = false;
  const h = await harness(t, { childStorage: undefined, performChild: async args => {
    if (fail && args.action === "import") { args.record("workflow_disabled"); throw new OwnerFailure("unavailable"); }
    return fixture(args);
  } });
  const r = await imported(h); fail = true;
  const fresh = await h.post("/api/child/review", r.body);
  const failed = await h.post("/api/child/import", { token: fresh.data.token, confirmed: true });
  assert.equal(failed.data.status, "unavailable"); assert.equal(Object.hasOwn(failed.data, "data"), false);
  assert.deepEqual((await h.post("/api/child/saved", dates)).data.data, r.data);
});
test("Clear independently deletes child before awaiting shared cross-session import even when parent deletion fails", async t => {
  const started = deferred(), finish = deferred(), aborted = deferred(); let wait = false, childClears = 0;
  const h = await harness(t, { storage: { clear() { throw Error("parent failure"); } },
    childStorage: { read() { return null; }, write() {}, clear() { childClears++; } },
    performChild: async args => { if (wait && args.action === "import") { args.signal.addEventListener("abort", () => aborted.resolve(), { once: true }); started.resolve(); await finish.promise; } return fixture(args); } });
  const r = await review(h); wait = true;
  const importing = h.post("/api/child/import", { token: r.token, confirmed: true }); await started.promise;
  const before = childClears, other = await h.next(), clearing = h.request("/api/clear", {}, other);
  await aborted.promise; assert.equal(childClears, before + 1); finish.resolve();
  assert.equal((await importing).data.status, "cancelled"); assert.equal((await clearing).status, 503);
});
test("child Clear across sessions cancels late writer; preserved range/cancel fences also reject late results", async t => {
  for (const [route, body, otherSession] of [["/api/child/clear", {}, true], ["/api/child/edit", {}, true],
    ["/api/child/clear", { reason: "range" }, false], ["/api/child/edit", { reason: "cancel" }, false]]) {
    const started = deferred(), finish = deferred(), aborted = deferred();
    const h = await harness(t, { performChild: async args => { if (args.action === "import") { args.signal.addEventListener("abort", () => aborted.resolve(), { once: true }); started.resolve(); await finish.promise; } return fixture(args); } });
    const r = await review(h), pending = h.post("/api/child/import", { token: r.token, confirmed: true }); await started.promise;
    const clearing = h.request(route, body, otherSession ? await h.next() : h.csrf); await aborted.promise; finish.resolve();
    assert.equal((await clearing).status, 200); assert.equal((await pending).data.status, "cancelled"); assert.equal(h.counts.writes, 0);
    assert.equal((await h.request("/api/child/saved", dates, await h.next())).data.status, "cache_missing");
  }
});
test("child store errors are sticky, fixed and distinct from parent state; explicit Clear works without load", async t => {
  let fail = true, reads = 0, clears = 0;
  const h = await harness(t, { childStorage: { read() { reads++; throw Error("PRIVATE path title"); }, write() {}, clear() { clears++; if (fail) throw Error("PRIVATE"); } } });
  assert.equal((await h.post("/api/child/saved", dates)).data.status, "child_cache_unavailable");
  const status = await h.post("/api/status"); assert.equal(status.data.childCacheStatus, "child_cache_unavailable"); assert.doesNotMatch(status.text, /PRIVATE/);
  await h.post("/api/child/saved", dates); assert.equal(reads, 1);
  assert.equal((await h.post("/api/child/clear")).data.childCacheStatus, "child_cache_clear_failed");
  fail = false; assert.equal((await h.post("/api/child/clear")).status, 200); assert.equal(clears, 2);
  const beforeLoad = await harness(t); assert.equal((await beforeLoad.post("/api/child/clear")).status, 200); assert.equal(beforeLoad.counts.clears, 1); assert.equal(beforeLoad.counts.reads, 0);
});
test("expiry denies old session saved access, but fresh saved view retains prior reviewed scope", async t => {
  let now = Date.now(); const h = await harness(t, { now: () => now }); const r = await imported(h);
  now += 1800001; assert.equal((await h.post("/api/child/saved", dates)).status, 403);
  assert.deepEqual((await h.request("/api/child/saved", dates, await h.next())).data.data, r.data);
});
test("known provider/validation/cleanup failures invalidate child snapshot without parent deletion", async t => {
  for (const code of ["revoked", "contract_drift", "invalid_provider_response", "cleanup_failed"]) {
    let fail = false;
    const h = await harness(t, { performChild: async args => { if (fail) { args.record(code === "cleanup_failed" ? code : "workflow_disabled"); throw new OwnerFailure(code); } return fixture(args); } });
    const r = await imported(h); fail = true;
    const fresh = await h.post("/api/child/review", r.body), result = await h.post("/api/child/import", { token: fresh.data.token, confirmed: true });
    assert.equal(result.data.status, code); assert.equal(h.counts.parentClears, 0);
    assert.equal((await h.request("/api/child/saved", dates, await h.next())).data.status, code === "cleanup_failed" ? "cleanup_failed" : "cache_missing");
  }
});
test("no write before independent cleanup; missing or later failed cleanup cannot save", async t => {
  for (const failure of ["missing", "failed-then-disabled"]) {
    const h = await harness(t, { performChild: async args => {
      if (args.action === "find") return fixture(args);
      const data = await fixture({ ...args, record() {} });
      if (failure === "failed-then-disabled") { args.record("cleanup_failed"); args.record("workflow_disabled"); }
      return data;
    } });
    const r = await review(h), result = await h.post("/api/child/import", { token: r.token, confirmed: true });
    assert.equal(result.data.status, "cleanup_failed"); assert.equal(h.counts.writes, 0);
    assert.equal((await h.post("/api/child/saved", dates)).data.status, "cleanup_failed");
  }
});
test("disk recreation through a new server loads original data but never old live authority", async t => {
  const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
  const { createChildDiskStore, childBinding } = require("../scripts/child-calendar-disk-cache");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "familycopilot-child-http-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = () => createChildDiskStore({ directory: path.join(root, "child"), binding: childBinding({ mode: "synthetic-test" }) });
  const first = await harness(t, { childStorage: store() }), r = await imported(first);
  await first.server.shutdown();
  const fresh = await harness(t, { childStorage: store() });
  assert.equal(fresh.counts.calls, 0); const saved = await fresh.post("/api/child/saved", dates);
  assert.deepEqual(saved.data.data, r.data); assert.equal(fresh.counts.calls, 0);
  assert.equal((await fresh.post("/api/child/review", r.body)).status, 400);
  assert.equal((await fresh.post("/api/child/import", { token: r.token, confirmed: true })).status, 503); assert.equal(fresh.counts.calls, 0);
});
test("parent generic failure is independent, but parent known access/cleanup failure invalidates child", async t => {
  for (const code of ["unavailable", "revoked", "cleanup_failed"]) {
    const h = await harness(t, { perform: async ({ record }) => { record(code === "cleanup_failed" ? code : "workflow_disabled"); throw new OwnerFailure(code); } });
    await imported(h);
    const result = await h.post("/api/load", { acknowledged: true, requestId: "11111111-1111-4111-8111-111111111111" }); assert.equal(result.status, 503);
    const saved = await h.request("/api/child/saved", dates, await h.next());
    assert.equal(saved.data.status, code === "unavailable" ? "saved" : code === "revoked" ? "cache_missing" : "cleanup_failed");
  }
});
test("both storage Clear failures are reported independently and child saved ignores parent-only storage block", async t => {
  const h = await harness(t, { storage: { clear() { throw Object.assign(Error("PRIVATE"), { code: "cache_clear_failed" }); } },
    childStorage: { read() { return null; }, write() {}, clear() { throw Error("PRIVATE"); } } });
  const result = await h.post("/api/clear"); assert.equal(result.status, 503);
  assert.equal(result.data.cacheStatus, "cache_clear_failed"); assert.equal(result.data.childCacheStatus, "child_cache_clear_failed"); assert.doesNotMatch(result.text, /PRIVATE/);
  const status = await h.request("/api/status", {}, await h.next()); assert.equal(status.data.childCacheStatus, "child_cache_clear_failed");
  const other = await harness(t, { storage: { clear() { throw Object.assign(Error(), { code: "cache_clear_failed" }); } } });
  await other.post("/api/clear"); assert.equal((await other.request("/api/child/saved", dates, await other.next())).data.status, "cache_missing");
});
test("newly selected source invalidates other pages' pending review, even with identical source labels", async t => {
  const h = await harness(t), first = await imported(h);
  const secondToken = (await h.post("/api/child/review", first.body)).data.token;
  const other = await h.next(), found = await h.request("/api/child/find", dates, other);
  const body = { ...first.body, handle: found.data.calendars[0].handle };
  assert.equal((await h.request("/api/child/review", body, other)).status, 200);
  assert.equal((await h.post("/api/child/saved", dates)).data.status, "cache_missing");
  assert.equal((await h.post("/api/child/import", { token: secondToken, confirmed: true })).status, 503);
});
test("late known access failure cannot retry a failed child deletion or reset its sticky block", async t => {
  let fail = false, clears = 0;
  const started = deferred(), aborted = deferred();
  const h = await harness(t, { childStorage: { read() { return null; }, write() {}, clear() { clears++; if (fail) throw Error("PRIVATE"); } },
    performChild: async args => {
      if (args.action === "find") return fixture(args);
      args.signal.addEventListener("abort", () => aborted.resolve(), { once: true }); started.resolve();
      await aborted.promise; args.record("workflow_disabled"); throw new OwnerFailure("revoked");
    } });
  const r = await review(h), pending = h.post("/api/child/import", { token: r.token, confirmed: true }); await started.promise;
  const previous = clears; fail = true;
  assert.equal((await h.post("/api/child/clear")).data.childCacheStatus, "child_cache_clear_failed");
  assert.equal((await pending).data.status, "child_cache_clear_failed"); assert.equal(clears, previous + 1);
  assert.equal((await h.post("/api/child/edit", { reason: "cancel" })).status, 503); assert.equal(clears, previous + 1);
  fail = false; assert.equal((await h.post("/api/child/clear")).status, 200); assert.equal(clears, previous + 2);
});
test("main-owned HTML placeholder renders exact disk/memory child capability without startup I/O", async t => {
  // Inject an in-memory HTML asset rather than editing the main writer's markup.
  const promises = require("node:fs/promises"), filename = require.resolve("../scripts/serve-owner"), previous = require.cache[filename];
  t.mock.method(promises, "readFile", async () => '<meta name="owner-csrf" content="OWNER_CSRF"><meta name="child-cache" content="CHILD_CACHE">');
  let factory;
  try { delete require.cache[filename]; factory = require("../scripts/serve-owner").createServer; }
  finally { require.cache[filename] = previous; }
  for (const disk of [true, false]) {
    let effects = 0; const never = () => { effects++; throw Error("Unexpected storage access"); };
    const h = await harness(t, { childStorage: disk ? { read: never, write: never, clear: never } : undefined }, factory);
    assert.match(h.page.text, new RegExp(`name="child-cache" content="child-saved-v1-${disk ? "disk" : "memory"}"`));
    assert.doesNotMatch(h.page.text, /CHILD_CACHE/); await h.post("/api/status"); assert.equal(effects, 0); assert.equal(h.counts.calls, 0);
  }
});