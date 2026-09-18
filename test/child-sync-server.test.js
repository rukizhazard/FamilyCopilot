"use strict";
// OFFLINE: ephemeral loopback test listeners, synthetic data and synchronous RAM
// disk stand-ins only. No native process, shared listener, cloud or private file.
const test = require("node:test"), assert = require("node:assert/strict"), http = require("node:http");
const { once } = require("node:events");
const { randomBytes } = require("node:crypto");
const { createServer } = require("../scripts/serve-owner");
const P = require("../scripts/windows-child-protocol"), C = require("../owner/child-calendar-core");
const A = require("../owner/availability-core");
const { OwnerFailure } = require("../scripts/owner-calendar");
const { ChildSourceFailure } = require("../scripts/child-source-store");
const { CacheFailure } = require("../scripts/availability-disk-cache");
const { perform: fixture } = require("../browser-fixtures/child-calendar");
const dates = { acknowledged: true, startDate: "2026-10-09", endDate: "2026-10-15" };
const syncBody = (refresh = false) => ({ ...dates, refresh });
const access = { person: "Kimi", guardian: true, disclosure: "details", sourceName: "Synthetic chosen source" };
const reference = "d".repeat(64), rawId = "SYNTHETIC-CHOSEN-ID";
const sourceRecord = () => ({ version: 1, reference, access: { ...access }, window: { ...C.window } });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const sample = () => fixture({ action: "import", disclosure: "details", record() {} });
function stores({ source = null, saved = null } = {}) {
  const counts = { sourceReads: 0, sourceWrites: 0, sourceClears: 0, cacheReads: 0, cacheWrites: 0, cacheClears: 0 };
  return { counts, source: { read() { counts.sourceReads++; return structuredClone(source); },
    write(value) { counts.sourceWrites++; source = structuredClone(value); }, clear() { counts.sourceClears++; source = null; } },
  cache: { read() { counts.cacheReads++; return structuredClone(saved); },
    write(a, data) { counts.cacheWrites++; saved = structuredClone({ status: "saved", access: a, data }); },
    clear() { counts.cacheClears++; saved = null; } },
  value: () => structuredClone({ source, saved }) };
}
async function harness(t, { memory = stores(), handler, options = {}, factory = createServer, native = true } = {}) {
  const calls = [], key = randomBytes(32).toString("hex");
  const parent = { reads: 0, writes: 0, clears: 0, calls: 0 };
  const parentData = { window: A.liveWindow, checkedAt: "2026-09-17T00:00:00Z",
    people: [0, 1].map(person => ({ person, status: "checked", slots: Array(336).fill("unknown") })) };
  const fallback = async args => {
    args.record("workflow_disabled");
    if (args.action === "find") return { calendars: [{ id: P.sealSource(rawId, { key, sessionId: args.sessionId, expires: args.expires }), name: access.sourceName }], partial: true };
    if (args.action === "enroll") {
      assert.equal(P.openSource(args.calendarId, { key, sessionId: args.sessionId, expires: args.expires }), rawId);
      return { reference, data: await fixture({ action: "import", disclosure: args.disclosure, record() {} }) };
    }
    assert.equal(args.action, "sync"); assert.equal(args.reference, reference);
    return fixture({ action: "import", disclosure: args.disclosure, record() {} });
  };
  const perform = async args => {
    calls.push(args);
    if (native) {
      assert.deepEqual(Object.keys(args).sort(), ["action", "expires", "record", "sessionId", "signal",
        ...(args.action === "find" ? [] : [args.action === "sync" ? "reference" : "calendarId", "disclosure"])].sort());
      assert.match(args.sessionId, /^[a-f0-9]{64}$/); assert.ok(Number.isSafeInteger(args.expires));
      assert.ok(args.signal instanceof AbortSignal);
    }
    return handler ? handler(args, fallback) : fallback(args);
  };
  if (native) t.mock.method(require("../scripts/windows-owner"), "createNativeAdapter", () => ({ perform() { parent.calls++; assert.fail("No parent provider"); } }));
  const server = factory({ ...(native ? { ownerExecution: "windows-native", childApproved: true, nativeChildAdapter: { perform } }
    : { synthetic: true, performChild: perform }), childSourceStorage: memory.source, childStorage: memory.cache,
    storage: { preserveOnMiss: true, window: A.liveWindow, contract: "bounded-availability-v5",
      read() { parent.reads++; return { context: "a".repeat(64), data: structuredClone(parentData) }; },
      write() { parent.writes++; assert.fail("No parent write"); }, clear() { parent.clears++; } }, ...options });
  server.listen(0, "127.0.0.1"); await once(server, "listening"); t.after(() => server.shutdown());
  const request = (path, body, csrf, headers = {}) => new Promise((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port: server.address().port, path, method: body === undefined ? "GET" : "POST",
      headers: { Host: "localhost:8002", ...(body === undefined ? {} : { Origin: "http://localhost:8002", "Content-Type": "application/json", "X-Owner-CSRF": csrf }), ...headers } }, res => {
      let text = ""; res.on("data", c => { text += c; }); res.on("end", () => resolve({ status: res.statusCode, text, data: body === undefined ? null : JSON.parse(text) }));
    }); req.on("error", reject); req.end(body === undefined ? undefined : JSON.stringify(body));
  });
  const next = async () => /name="owner-csrf" content="([a-f0-9]+)"/.exec((await request("/")).text)[1];
  const csrf = await next();
  return { server, calls, memory, parent, request, csrf, next, post: (route, body = {}, headers) => request(route, body, csrf, headers) };
}
async function enroll(h, disclosure = "details") {
  const found = await h.post("/api/child/find", dates); assert.equal(found.status, 200);
  const body = { handle: found.data.calendars[0].handle, person: "Kimi", guardian: true, disclosure, startDate: dates.startDate, endDate: dates.endDate };
  const reviewed = await h.post("/api/child/review", body); assert.equal(reviewed.status, 200);
  const imported = await h.post("/api/child/import", { token: reviewed.data.token, confirmed: true });
  assert.equal(imported.status, 200);
  return { body, imported, token: reviewed.data.token };
}
const parentBody = { acknowledged: true, requestId: "11111111-1111-4111-8111-111111111111", startDate: dates.startDate, endDate: dates.endDate, cacheOnly: true, refresh: false };

test("construction/pages/status are inert; exact Sync marker only for native-approved or synthetic", async t => {
  const promises = require("node:fs/promises"), filename = require.resolve("../scripts/serve-owner"), previous = require.cache[filename];
  t.mock.method(promises, "readFile", async () => '<meta name="owner-csrf" content="OWNER_CSRF"><meta name="child-sync" content="CHILD_SYNC">');
  let factory;
  try { delete require.cache[filename]; factory = require("../scripts/serve-owner").createServer; } finally { require.cache[filename] = previous; }
  for (const mode of ["native", "synthetic", "disabled", "legacy"]) {
    const options = mode === "disabled" ? { childApproved: false, nativeChildAdapter: undefined }
      : mode === "legacy" ? { ownerExecution: "wsl", nativeChildAdapter: undefined } : {};
    const h = await harness(t, { factory, native: mode !== "synthetic", options });
    const page = await h.request("/");
    assert.match(page.text, new RegExp(`name="child-sync" content="${["native", "synthetic"].includes(mode) ? "child-sync-v1" : "unavailable"}"`));
    await h.post("/api/status"); assert.equal(h.calls.length, 0);
    assert.ok(Object.values(h.memory.counts).every(n => n === 0));
    assert.deepEqual(h.parent, { reads: 0, writes: 0, clears: 0, calls: 0 });
    if (["disabled", "legacy"].includes(mode)) assert.equal((await h.post("/api/child/sync", syncBody())).data.status, "child_not_ready");
  }
});
test("Sync exact body/bounds/origin/CSRF reject before storage or adapters", async t => {
  const h = await harness(t);
  for (const body of [{}, dates, { ...syncBody(), acknowledged: false }, { ...syncBody(), refresh: "true" },
    { ...syncBody(), startDate: "2026-10-08" }, { ...syncBody(), endDate: "2026-10-16" },
    { ...syncBody(), reference }, { ...syncBody(), sourceName: access.sourceName }, { ...syncBody(), disclosure: "details" }]) {
    assert.equal((await h.post("/api/child/sync", body)).status, 400);
  }
  for (const headers of [{ Origin: "http://evil.test" }, { "X-Owner-CSRF": "bad" }, { "Content-Type": "text/plain" }, { "X-Forwarded-Host": "localhost:8002" }]) {
    assert.equal((await h.post("/api/child/sync", syncBody(), headers)).status, 403);
  }
  assert.equal(h.calls.length, 0); assert.ok(Object.values(h.memory.counts).every(n => n === 0));
});
test("source miss performs no find/import; saved first succeeds without any source read", async t => {
  const h = await harness(t);
  for (const refresh of [false, true]) assert.deepEqual((await h.post("/api/child/sync", syncBody(refresh))).data, { status: "source_missing" });
  assert.equal(h.calls.length, 0);
  const data = await sample(), saved = { status: "saved", access, data };
  const existing = await harness(t, { memory: stores({ saved }) });
  assert.deepEqual((await existing.post("/api/child/sync", syncBody())).data, saved);
  assert.equal(existing.memory.counts.sourceReads, 0); assert.equal(existing.calls.length, 0);
  assert.equal((await existing.post("/api/child/sync", syncBody(true))).data.status, "source_missing");
  assert.deepEqual(existing.memory.value().saved, saved);
});
test("native enroll alone persists reference; new-page/recreated server Sync has exact server-only context and original freshness", async t => {
  const memory = stores(), h = await harness(t, { memory }), enrolled = await enroll(h);
  assert.deepEqual(memory.value().source, sourceRecord()); assert.equal(memory.counts.sourceWrites, 1);
  assert.equal(h.calls[1].action, "enroll"); assert.ok(P.isSealed(h.calls[1].calendarId));
  assert.notEqual(reference, h.calls[1].calendarId);
  const response = await h.request("/api/child/sync", syncBody(true), await h.next());
  assert.deepEqual(response.data, { status: "saved", access, data: enrolled.imported.data });
  assert.notEqual(h.calls[2].sessionId, h.calls[1].sessionId);
  assert.equal(memory.counts.sourceWrites, 1); // Sync cannot renew or rewrite confirmed scope.
  for (const result of [enrolled.imported, response, await h.post("/api/status")]) {
    assert.ok(!result.text.includes(reference)); assert.ok(!result.text.includes(h.calls[1].calendarId));
    assert.doesNotMatch(result.text, /SYNTHETIC-CHOSEN-ID|sessionId|calendarId|reference/);
  }
  await h.server.shutdown();
  const fresh = await harness(t, { memory }); assert.equal(fresh.calls.length, 0);
  assert.equal((await fresh.post("/api/child/sync", syncBody(true))).data.data.checkedAt, enrolled.imported.data.checkedAt);
  assert.deepEqual(fresh.calls.map(c => c.action), ["sync"]);
  assert.equal((await fresh.post("/api/child/import", { token: enrolled.token, confirmed: true })).status, 503);
});
test("same-choice review preserves committed reference; changed disclosure invalidates both before import", async t => {
  const h = await harness(t), enrolled = await enroll(h), before = { ...h.memory.counts };
  assert.equal((await h.post("/api/child/review", enrolled.body)).status, 200);
  assert.equal(h.memory.counts.sourceClears, before.sourceClears); assert.equal(h.memory.counts.cacheClears, before.cacheClears);
  assert.equal(h.memory.value().source.reference, reference);
  assert.equal((await h.post("/api/child/review", { ...enrolled.body, disclosure: "busy_only" })).status, 200);
  assert.deepEqual(h.memory.value(), { source: null, saved: null });
});
test("synthetic legacy find/import reuse hashes raw identity, not renamed or duplicate labels", async t => {
  let renamed = false, missing = false, duplicate = false;
  const h = await harness(t, { native: false, handler: async args => {
    args.record("workflow_disabled");
    if (args.action === "find") return { partial: true, calendars: [
      { id: "SYNTHETIC-OTHER-ID", name: renamed ? "Old name" : "Same name" },
      ...(missing ? [] : [{ id: rawId, name: renamed ? "New name" : "Same name" }]),
      ...(duplicate ? [{ id: rawId, name: "Duplicate identity" }] : [])] };
    assert.equal(args.action, "import"); assert.equal(args.calendarId, rawId); return sample();
  } });
  const found = await h.post("/api/child/find", dates);
  const reviewed = await h.post("/api/child/review", { handle: found.data.calendars[1].handle, person: "Kimi", guardian: true, disclosure: "details", startDate: dates.startDate, endDate: dates.endDate });
  assert.equal((await h.post("/api/child/import", { token: reviewed.data.token, confirmed: true })).status, 200);
  const ref = h.memory.value().source.reference; assert.match(ref, /^[a-f0-9]{64}$/);
  renamed = true;
  const synced = await h.request("/api/child/sync", syncBody(true), await h.next());
  assert.equal(synced.data.status, "saved"); assert.equal(synced.data.access.sourceName, "Same name");
  assert.equal(h.memory.value().source.reference, ref); assert.ok(!synced.text.includes(ref));
  duplicate = true;
  assert.equal((await h.post("/api/child/sync", syncBody(true))).data.status, "invalid_provider_response");
  assert.equal(h.memory.value().source, null);
  // No same-name fallback when the selected identity disappears.
  duplicate = false; missing = true;
  const other = await harness(t, { native: false, memory: stores({ source: { ...sourceRecord(), reference: ref } }), handler: async args => {
    assert.equal(args.action, "find"); args.record("workflow_disabled"); return { calendars: [{ id: "SYNTHETIC-OTHER-ID", name: "Same name" }], partial: true };
  } });
  assert.equal((await other.post("/api/child/sync", syncBody(true))).data.status, "revoked"); assert.equal(other.calls.length, 1);
});
test("ordinary Sync failure has no fallback or automatic retry, preserves source and permits explicit retry", async t => {
  let failing = false;
  const h = await harness(t, { handler: async (args, fallback) => {
    if (failing && args.action === "sync") { args.record("workflow_disabled"); throw new OwnerFailure("unavailable"); }
    return fallback(args);
  } });
  await enroll(h); const before = h.memory.value(); failing = true;
  const failed = await h.post("/api/child/sync", syncBody(true)); assert.equal(failed.data.status, "unavailable"); assert.equal(Object.hasOwn(failed.data, "data"), false);
  await h.post("/api/status"); assert.equal(h.calls.length, 3); assert.deepEqual(h.memory.value(), before);
  failing = false; assert.equal((await h.post("/api/child/sync", syncBody(true))).data.status, "saved"); assert.equal(h.calls.length, 4);
});
test("known revocation/contract/invalid responses remove reference and events but not parent snapshot", async t => {
  for (const code of ["revoked", "contract_drift", "invalid_provider_response", "blocked"]) {
    const h = await harness(t, { memory: stores({ source: sourceRecord(), saved: { status: "saved", access, data: await sample() } }), handler: async args => {
      args.record("workflow_disabled"); if (code !== "invalid_provider_response") throw new OwnerFailure(code);
      return { ...(await sample()), arbitrary: "SYNTHETIC PRIVATE" };
    } });
    const result = await h.post("/api/child/sync", syncBody(true)); assert.equal(result.data.status, code); assert.doesNotMatch(result.text, /SYNTHETIC PRIVATE|events/);
    assert.deepEqual(h.memory.value(), { source: null, saved: null });
    assert.equal((await h.post("/api/availability", parentBody)).data.cached, true);
    assert.deepEqual(h.parent, { reads: 1, writes: 0, clears: 0, calls: 0 });
  }
});
test("cross-session explicit Clear fences pending sync and enrollment and deletes stores before cleanup", async t => {
  for (const action of ["sync", "enroll"]) {
    const start = deferred(), finish = deferred(), abort = deferred(); let waiting = false;
    const h = await harness(t, { handler: async (args, fallback) => {
      if (waiting && args.action === action) { start.resolve(); args.signal.addEventListener("abort", () => abort.resolve(), { once: true }); await finish.promise; }
      return fallback(args);
    } });
    const r = await enroll(h); waiting = true;
    const reviewed = action === "enroll" ? await h.post("/api/child/review", r.body) : null;
    const before = { ...h.memory.counts };
    const pending = h.post(`/api/child/${action === "enroll" ? "import" : "sync"}`, reviewed ? { token: reviewed.data.token, confirmed: true } : syncBody(true));
    await start.promise;
    assert.equal((await h.post("/api/child/sync", syncBody(true))).status, 409);
    const clearing = h.request("/api/child/clear", {}, await h.next()); await abort.promise;
    assert.deepEqual(h.memory.value(), { source: null, saved: null }); assert.equal((await h.post("/api/status")).data.status, "busy");
    finish.resolve(); assert.equal((await pending).data.status, "cancelled"); assert.equal((await clearing).status, 200);
    assert.equal(h.memory.counts.sourceWrites, before.sourceWrites); assert.equal(h.memory.counts.cacheWrites, before.cacheWrites);
    assert.equal((await h.post("/api/child/sync", syncBody())).data.status, "source_missing"); assert.equal(h.parent.clears, 0);
  }
});
test("leave/range/cancel retain completed reference and snapshot while fencing a late sync", async t => {
  for (const [route, reason] of [["/api/child/clear", "leave"], ["/api/child/clear", "range"], ["/api/child/edit", "cancel"], ["/api/clear", "leave"], ["/api/clear", "range"]]) {
    const start = deferred(), finish = deferred(), abort = deferred();
    const h = await harness(t, { memory: stores({ source: sourceRecord(), saved: { status: "saved", access, data: await sample() } }), handler: async (args, fallback) => {
      start.resolve(); args.signal.addEventListener("abort", () => abort.resolve(), { once: true }); await finish.promise; return fallback(args);
    } });
    const before = h.memory.value(), pending = h.post("/api/child/sync", syncBody(true)); await start.promise;
    const clearing = h.post(route, { reason }); await abort.promise; finish.resolve();
    assert.equal((await pending).data.status, "cancelled"); assert.equal((await clearing).status, 200); assert.deepEqual(h.memory.value(), before);
    assert.equal(h.memory.counts.sourceWrites, 0); assert.equal(h.memory.counts.cacheWrites, 0);
  }
});
test("page expiry and shutdown fence unfinished Sync without deleting completed references", async t => {
  for (const stopping of [false, true]) {
    let clock = Date.now(); const start = deferred(), finish = deferred();
    const h = await harness(t, { options: { now: () => clock }, memory: stores({ source: sourceRecord(), saved: { status: "saved", access, data: await sample() } }), handler: async args => {
      start.resolve(); await finish.promise; args.record("workflow_disabled"); return sample();
    } });
    const before = h.memory.value(), pending = h.post("/api/child/sync", syncBody(true)); await start.promise;
    if (!stopping) clock += 1800001;
    const stop = stopping ? h.server.shutdown() : null; finish.resolve();
    const result = await pending; assert.ok(["expired", "cancelled"].includes(result.data.status)); if (stop) await stop;
    assert.deepEqual(h.memory.value(), before); assert.equal(h.memory.counts.cacheWrites, 0);
    if (!stopping) {
      assert.equal((await h.post("/api/child/sync", syncBody(true))).status, 403);
      assert.equal((await h.request("/api/child/sync", syncBody(), await h.next())).data.status, "saved");
    }
  }
});
test("source read failure is sticky, status is fixed/inert, setup cannot query, independent parent saved still works", async t => {
  const memory = stores(); let reads = 0;
  memory.source.read = () => { reads++; throw new ChildSourceFailure("SYNTHETIC PRIVATE path"); };
  const h = await harness(t, { memory });
  assert.equal((await h.post("/api/child/sync", syncBody(true))).data.childSourceStatus, "child_source_unavailable");
  for (const route of ["/api/status", "/api/child/find", "/api/child/import", "/api/child/sync"]) {
    const result = await h.post(route, route.endsWith("sync") ? syncBody(true) : route.endsWith("find") ? dates : {});
    assert.equal(result.data.childSourceStatus, "child_source_unavailable"); assert.doesNotMatch(result.text, /PRIVATE|path/);
  }
  assert.equal(reads, 1); assert.equal(h.calls.length, 0);
  assert.equal((await h.post("/api/availability", parentBody)).data.cached, true);
  assert.equal((await h.post("/api/child/clear")).status, 200);
  memory.source.read = () => null; assert.equal((await h.post("/api/child/sync", syncBody(true))).data.status, "source_missing");
});
test("source read preparation blocks confirmed setup import before native enrollment", async t => {
  const memory = stores(), h = await harness(t, { memory });
  const found = await h.post("/api/child/find", dates);
  const reviewed = await h.post("/api/child/review", { handle: found.data.calendars[0].handle, person: "Kimi", guardian: true, disclosure: "details", startDate: dates.startDate, endDate: dates.endDate });
  memory.source.read = () => { throw new ChildSourceFailure("child_source_invalid"); };
  const response = await h.post("/api/child/import", { token: reviewed.data.token, confirmed: true });
  assert.equal(response.data.status, "child_source_invalid"); assert.equal(h.calls.length, 1); assert.equal(memory.counts.cacheWrites, 0);
});
test("source write failure blocks snapshot commit and queries until explicit Clear, without parent deletion", async t => {
  const memory = stores(), h = await harness(t, { memory });
  memory.source.write = () => { throw Error("SYNTHETIC PRIVATE path"); };
  const found = await h.post("/api/child/find", dates);
  const reviewed = await h.post("/api/child/review", { handle: found.data.calendars[0].handle, person: "Kimi", guardian: true, disclosure: "details", startDate: dates.startDate, endDate: dates.endDate });
  const result = await h.post("/api/child/import", { token: reviewed.data.token, confirmed: true });
  assert.equal(result.data.childSourceStatus, "child_source_unavailable"); assert.doesNotMatch(result.text, /PRIVATE|events/);
  assert.equal(memory.counts.cacheWrites, 0); assert.equal((await h.post("/api/child/sync", syncBody(true))).data.status, "child_source_unavailable");
  assert.equal(h.calls.length, 2); assert.equal((await h.post("/api/availability", parentBody)).data.cached, true);
  assert.equal((await h.post("/api/child/clear")).status, 200); assert.equal(h.parent.clears, 0);
});
test("source and event deletion failures are independent, fixed and sticky; explicit Clear recovers storage only", async t => {
  for (const which of ["source", "cache", "both"]) {
    const memory = stores({ source: sourceRecord(), saved: { status: "saved", access, data: await sample() } });
    const clearSource = memory.source.clear, clearCache = memory.cache.clear; let sourceClears = 0, cacheClears = 0;
    memory.source.clear = () => { sourceClears++; if (which !== "cache") throw Error("SYNTHETIC PRIVATE"); clearSource(); };
    memory.cache.clear = () => { cacheClears++; if (which !== "source") throw Error("SYNTHETIC PRIVATE"); clearCache(); };
    const h = await harness(t, { memory }); const result = await h.post("/api/child/clear");
    assert.equal(result.status, 503); assert.equal(sourceClears, 1); assert.equal(cacheClears, 1); assert.doesNotMatch(result.text, /PRIVATE/);
    if (which !== "cache") assert.equal(result.data.childSourceStatus, "child_source_clear_failed");
    if (which !== "source") assert.equal(result.data.childCacheStatus, "child_cache_clear_failed");
    await h.post("/api/child/edit", { reason: "cancel" }); await h.post("/api/status");
    assert.equal(sourceClears, 1); assert.equal(cacheClears, 1); assert.equal(h.calls.length, 0);
    assert.equal((await h.post("/api/availability", parentBody)).data.cached, true);
    memory.source.clear = clearSource; memory.cache.clear = clearCache;
    assert.equal((await h.post("/api/child/clear")).status, 200); assert.deepEqual(memory.value(), { source: null, saved: null });
  }
});
test("missing cleanup and failed-then-disabled cleanup prevent commit; Clear never recovers cloud uncertainty", async t => {
  for (const mode of ["missing", "failed"]) {
    const h = await harness(t, { memory: stores({ source: sourceRecord(), saved: { status: "saved", access, data: await sample() } }), handler: async args => {
      if (mode === "failed") { args.record("cleanup_failed"); args.record("workflow_disabled"); } return sample();
    } });
    assert.equal((await h.post("/api/child/sync", syncBody(true))).data.status, "cleanup_failed");
    assert.deepEqual(h.memory.value(), { source: null, saved: null }); assert.equal(h.memory.counts.cacheWrites, 0);
    assert.equal((await h.post("/api/child/clear")).data.status, "cleanup_failed");
    assert.equal((await h.request("/api/child/sync", syncBody(true), await h.next())).data.status, "cleanup_failed");
    assert.equal(h.calls.length, 1); assert.equal(h.parent.clears, 0);
  }
});
test("body parsing race with cross-session Clear cannot restore captured reference or invoke adapters", async t => {
  const h = await harness(t, { memory: stores({ source: sourceRecord() }) }), other = await h.next();
  const entered = deferred(); h.server.once("request", () => entered.resolve());
  let req;
  const result = new Promise((resolve, reject) => {
    req = http.request({ hostname: "127.0.0.1", port: h.server.address().port, path: "/api/child/sync", method: "POST",
      headers: { Host: "localhost:8002", Origin: "http://localhost:8002", "Content-Type": "application/json", "X-Owner-CSRF": h.csrf } }, res => {
      let text = ""; res.on("data", c => { text += c; }); res.on("end", () => resolve({ status: res.statusCode, data: JSON.parse(text) }));
    }); req.on("error", reject); req.write('{"acknowledged":true,');
  });
  await entered.promise; assert.equal((await h.request("/api/child/clear", {}, other)).status, 200);
  req.end('"startDate":"2026-10-09","endDate":"2026-10-15","refresh":true}');
  assert.equal((await result).status, 400); assert.equal(h.calls.length, 0); assert.equal(h.memory.counts.sourceReads, 0);
});

test("configured source without snapshot synchronizes on first explicit click, with no browser setup", async t => {
  const h = await harness(t, { memory: stores({ source: sourceRecord() }) });
  const response = await h.post("/api/child/sync", syncBody());
  assert.equal(response.data.status, "saved"); assert.deepEqual(response.data.access, access);
  assert.deepEqual(h.calls.map(c => c.action), ["sync"]);
  assert.equal(h.memory.counts.sourceWrites, 0); assert.equal(h.memory.counts.cacheWrites, 1);
});
test("approved legacy nonnative setup keeps import compatibility but never manufactures reusable live reference", async t => {
  const memory = stores(), h = await harness(t, { memory, options: { ownerExecution: "wsl", nativeChildAdapter: undefined,
    performChild: args => fixture(args) } });
  const result = await enroll(h); assert.equal(result.imported.status, 200);
  assert.equal(memory.value().source, null); assert.equal(memory.counts.sourceWrites, 0);
  assert.equal((await h.post("/api/child/sync", syncBody(true))).data.status, "child_not_ready");
});
test("synthetic Sync requires independent cleanup for both bounded find and import", async t => {
  let syncing = false;
  const h = await harness(t, { native: false, handler: async args => {
    if (syncing && args.action === "import") return fixture({ ...args, record() {} });
    return fixture(args);
  } });
  await enroll(h); const writes = h.memory.counts.cacheWrites; syncing = true;
  assert.equal((await h.post("/api/child/sync", syncBody(true))).data.status, "cleanup_failed");
  assert.equal(h.memory.counts.cacheWrites, writes); assert.deepEqual(h.memory.value(), { source: null, saved: null });
  assert.deepEqual(h.calls.map(c => c.action), ["find", "import", "find", "import"]);
});
test("shared Clear attempts source and child deletion even when parent deletion fails", async t => {
  const memory = stores({ source: sourceRecord(), saved: { status: "saved", access, data: await sample() } });
  const h = await harness(t, { memory, options: { storage: { clear() { throw new CacheFailure("cache_clear_failed"); } } } });
  const response = await h.post("/api/clear"); assert.equal(response.status, 503); assert.equal(response.data.cacheStatus, "cache_clear_failed");
  assert.equal(memory.counts.sourceClears, 1); assert.equal(memory.counts.cacheClears, 1);
  assert.deepEqual(memory.value(), { source: null, saved: null });
});
test("source and snapshot commit fences survive reentrant shutdown in either synchronous writer", async t => {
  for (const which of ["source", "cache"]) {
    const memory = stores(), h = await harness(t, { memory }); let shutdown;
    const storage = which === "source" ? memory.source : memory.cache, write = storage.write;
    storage.write = (...args) => { shutdown = h.server.shutdown(); write(...args); };
    const found = await h.post("/api/child/find", dates);
    const reviewed = await h.post("/api/child/review", { handle: found.data.calendars[0].handle, person: "Kimi", guardian: true, disclosure: "details", startDate: dates.startDate, endDate: dates.endDate });
    const response = await h.post("/api/child/import", { token: reviewed.data.token, confirmed: true });
    assert.equal(response.data.status, "cancelled"); await shutdown;
    assert.deepEqual(memory.value(), { source: null, saved: null });
    assert.equal(memory.counts.cacheWrites, which === "source" ? 0 : 1);
  }
});
test("cache-write failure during Sync preserves previously confirmed reference and blocks only child storage", async t => {
  const memory = stores({ source: sourceRecord(), saved: { status: "saved", access, data: await sample() } });
  memory.cache.write = () => { throw Error("SYNTHETIC private write failure"); };
  const h = await harness(t, { memory });
  const failed = await h.post("/api/child/sync", syncBody(true)); assert.equal(failed.data.childCacheStatus, "child_cache_unavailable");
  assert.deepEqual(memory.value().source, sourceRecord()); assert.equal(memory.counts.sourceWrites, 0);
  assert.equal((await h.post("/api/availability", parentBody)).data.cached, true);
  assert.equal((await h.post("/api/child/sync", syncBody(true))).data.status, "child_cache_unavailable"); assert.equal(h.calls.length, 1);
});