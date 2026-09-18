"use strict";
// OFFLINE ONLY. HTTP uses ephemeral loopback listeners, all native/WSL/provider
// and storage seams are synthetic. No shared service, native process or disk data.
const test = require("node:test"), assert = require("node:assert/strict"), http = require("node:http");
const { once } = require("node:events");
const { randomBytes } = require("node:crypto");
const { createServer, executionOptions } = require("../scripts/serve-owner");
const child = require("../scripts/child-calendar"), native = require("../scripts/windows-child");
const parent = require("../scripts/windows-owner");
const P = require("../scripts/windows-child-protocol");
const C = require("../owner/child-calendar-core");
const A = require("../owner/availability-core");
const { perform: fixture } = require("../browser-fixtures/child-calendar");
const { OwnerFailure } = require("../scripts/owner-calendar");
const findBody = { acknowledged: true, startDate: "2026-10-09", endDate: "2026-10-15" };
const reviewBody = (handle, disclosure = "details") => ({ handle, person: "Kimi", guardian: true, disclosure, startDate: "2026-10-09", endDate: "2026-10-15" });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
async function harness(t, { handler, adapter, options = {}, saved = false } = {}) {
  const calls = [], counts = { wsl: 0, parent: 0, reads: 0, writes: 0, clears: 0 };
  const key = randomBytes(32).toString("hex");
  const sampleParent = { window: A.liveWindow, checkedAt: "2026-09-17T00:00:00Z", people: [0, 1].map(person => ({ person, status: "checked", slots: Array(336).fill("unknown") })) };
  const original = JSON.stringify(sampleParent);
  t.mock.method(child, "perform", async () => { counts.wsl++; throw Error("WSL must never run"); });
  t.mock.method(parent, "createNativeAdapter", () => ({ perform: async () => { counts.parent++; throw Error("Native parent must never run"); } }));
  const fallback = async args => {
    if (args.action === "find") return { calendars: [{ id: P.sealSource("SYNTHETIC-RAW-ID", { key, sessionId: args.sessionId, expires: args.expires }), name: "Synthetic source" }], partial: true };
    P.openSource(args.calendarId, { key, sessionId: args.sessionId, expires: args.expires });
    return { reference: "c".repeat(64), data: await fixture({ action: "import", disclosure: args.disclosure, record() {} }) };
  };
  const perform = async args => {
    calls.push(args);
    assert.deepEqual(Object.keys(args).sort(), ["action", "expires", "record", "sessionId", "signal", ...(args.action === "enroll" ? ["calendarId", "disclosure"] : [])].sort());
    assert.match(args.sessionId, /^[a-f0-9]{64}$/); assert.ok(Number.isSafeInteger(args.expires));
    if (handler) return handler(args, fallback);
    args.record("workflow_disabled"); return fallback(args);
  };
  const server = createServer({ ownerExecution: "windows-native", childApproved: true, nativeChildAdapter: adapter || { perform },
    storage: { preserveOnMiss: true, window: A.liveWindow, contract: "bounded-availability-v5",
      read() { counts.reads++; return saved ? { context: "a".repeat(64), data: structuredClone(sampleParent) } : null; },
      write() { counts.writes++; throw Error("No parent write allowed"); }, clear() { counts.clears++; throw Error("No parent clear allowed"); } }, ...options });
  server.listen(0, "127.0.0.1"); await once(server, "listening"); t.after(() => server.shutdown());
  const request = (path, body, csrf, headers = {}) => new Promise((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port: server.address().port, path, method: body === undefined ? "GET" : "POST",
      headers: { Host: "localhost:8002", ...(body === undefined ? {} : { Origin: "http://localhost:8002", "Content-Type": "application/json", "X-Owner-CSRF": csrf || "bad" }), ...headers } }, res => {
      let text = ""; res.on("data", c => { text += c; }); res.on("end", () => resolve({ status: res.statusCode, text, data: body === undefined ? null : JSON.parse(text) }));
    }); req.on("error", reject); req.end(body === undefined ? undefined : JSON.stringify(body));
  });
  const page = await request("/"), csrf = /name="owner-csrf" content="([a-f0-9]+)"/.exec(page.text)[1];
  return { server, calls, counts, page, csrf, request, post: (path, body = {}, headers) => request(path, body, csrf, headers),
    parentUnchanged: () => assert.equal(JSON.stringify(sampleParent), original) };
}
async function review(h, disclosure = "details") {
  const found = await h.post("/api/child/find", findBody); assert.equal(found.status, 200);
  const body = reviewBody(found.data.calendars[0].handle, disclosure);
  const result = await h.post("/api/child/review", body); assert.equal(result.status, 200);
  return { found, body, token: result.data.token, reviewed: result };
}
const importBody = token => ({ token, confirmed: true });
test("CLI child env permits only explicit live windows-native opt-in and defaults disabled", () => {
  for (const ownerExecution of ["wsl", "windows-native"]) assert.deepEqual(executionOptions({ ownerExecution }), { ownerExecution, childApproved: false });
  assert.deepEqual(executionOptions({ ownerExecution: "windows-native", childEnabled: C.contract }), { ownerExecution: "windows-native", childApproved: true });
  for (const childEnabled of ["", "true", "1", "kimi-calendar-v2", " kimi-calendar-v1", null, true]) assert.throws(() => executionOptions({ ownerExecution: "windows-native", childEnabled }), /blocked/);
  for (const options of [{ childEnabled: C.contract }, { synthetic: true, childEnabled: C.contract },
    { synthetic: true, ownerExecution: "windows-native", childEnabled: C.contract }, { ownerExecution: "typo" }]) assert.throws(() => executionOptions(options), /blocked/);
});
test("native child seam rejects malformed, inherited, getter, extra and synthetic/live adapter injection", () => {
  const options = { ownerExecution: "windows-native", childApproved: true };
  let getters = 0;
  for (const nativeChildAdapter of [null, true, "perform", () => {}, {}, { perform: "find" },
    Object.create({ perform() {} }), { get perform() { getters++; return () => {}; } },
    { perform() {}, check() {} }, { perform() {}, [Symbol("extra")]: true }, { perform: fixture }, { perform: child.perform }]) {
    assert.throws(() => createServer({ ...options, nativeChildAdapter }), /blocked/);
  }
  assert.equal(getters, 0);
  for (const extra of [{ synthetic: true, ownerExecution: "wsl" }, { childApproved: false }, { ownerExecution: "wsl" }]) {
    assert.throws(() => createServer({ ...options, ...extra, nativeChildAdapter: { perform() {} } }), /blocked/);
  }
  for (const performChild of [fixture, async () => ({})]) assert.throws(() => createServer({ ...options, performChild }), /blocked/);
  assert.throws(() => createServer({ synthetic: true, performChild: child.perform }), /blocked/);
  assert.throws(() => createServer({ ...options, childApproved: "true" }), /blocked/);
});
test("approved native construction creates exactly one inert child adapter, disabled creates none", async t => {
  let constructed = 0, performed = 0;
  t.mock.method(native, "createChildNativeAdapter", () => { constructed++; return { perform: async () => { performed++; assert.fail(); } }; });
  const h = await harness(t, { options: { nativeChildAdapter: undefined } });
  assert.equal(constructed, 1); assert.equal(performed, 0);
  await h.request("/"); await h.request("/activities");
  const status = await h.post("/api/status");
  assert.deepEqual(status.data, { status: "idle", cleanup: "not_requested", synthetic: false, execution: "windows-native-v1", childExecution: "windows-child-v1" });
  assert.match(h.page.text, /name="child-mode" content="kimi-calendar-v1"/);
  assert.equal(constructed, 1); assert.equal(performed, 0);
  assert.deepEqual(h.counts, { wsl: 0, parent: 0, reads: 0, writes: 0, clears: 0 });
  const disabled = createServer({ ownerExecution: "windows-native" }); t.after(() => disabled.shutdown());
  assert.equal(constructed, 1);
});
test("disabled native child has no marker, no calls and no WSL fallback", async t => {
  const h = await harness(t, { options: { childApproved: false, nativeChildAdapter: undefined } });
  assert.match(h.page.text, /name="child-mode" content="unavailable"/);
  assert.equal(Object.hasOwn((await h.post("/api/status")).data, "childExecution"), false);
  assert.equal((await h.post("/api/child/find", findBody)).data.status, "child_not_ready");
  assert.equal(h.calls.length, 0); assert.equal(h.counts.wsl, 0);
});
test("explicitly approved legacy WSL injection retains old source/scenario contract without native marker", async t => {
  let calls = 0;
  const h = await harness(t, { options: { ownerExecution: "wsl", nativeChildAdapter: undefined, performChild: args => {
    calls++; assert.equal(args.scenario, "listed"); assert.equal(Object.hasOwn(args, "sessionId"), false);
    assert.equal(Object.hasOwn(args, "expires"), false); return fixture(args);
  } } });
  assert.equal(calls, 0); assert.match(h.page.text, /name="child-mode" content="kimi-calendar-v1"/);
  assert.equal(Object.hasOwn((await h.post("/api/status")).data, "childExecution"), false);
  const r = await review(h);
  assert.equal((await h.post("/api/child/import", importBody(r.token))).status, 200);
  assert.equal(calls, 2); assert.equal(h.counts.wsl, 0);
});
test("native HTTP binding is server-only, stable per session, fresh across pages and scenario-free", async t => {
  const now = Date.now(), h = await harness(t, { options: { now: () => now } });
  const r = await review(h);
  assert.deepEqual(Object.keys(r.found.data.calendars[0]).sort(), ["handle", "name"]);
  assert.equal((await h.post("/api/child/import", importBody(r.token))).status, 200);
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls[0].sessionId, h.calls[1].sessionId); assert.notEqual(h.calls[0].sessionId, h.csrf);
  assert.equal(h.calls[0].expires, now + 1800000); assert.equal(h.calls[1].expires, now + 1800000);
  assert.equal(P.isSealed(h.calls[1].calendarId), true);
  for (const result of [h.page, r.found, r.reviewed, await h.post("/api/status")]) {
    assert.ok(!result.text.includes(h.calls[0].sessionId)); assert.ok(!result.text.includes(h.calls[1].calendarId));
    assert.doesNotMatch(result.text, /SYNTHETIC-RAW-ID/);
  }
  const otherPage = await h.request("/"), other = /name="owner-csrf" content="([a-f0-9]+)"/.exec(otherPage.text)[1];
  assert.equal((await h.request("/api/child/find", findBody, other)).status, 200);
  assert.notEqual(h.calls[0].sessionId, h.calls[2].sessionId);
  assert.equal(h.counts.wsl, 0); assert.equal(h.counts.parent, 0);
});
test("native find rejects browser context/raw IDs/scenarios/extra fields and enforces every CSRF route", async t => {
  const h = await harness(t);
  for (const extra of [{ sessionId: "a".repeat(64) }, { expires: Date.now() + 1000 }, { calendarId: "SYNTHETIC-RAW-ID" },
    { scenario: "listed" }, { nativeChildAdapter: { perform: "find" } }, { action: "import" }, { stage: "complete" }, { disclosure: "details" }]) {
    assert.equal((await h.post("/api/child/find", { ...findBody, ...extra })).status, 400);
  }
  for (const route of ["find", "review", "import", "clear", "edit"]) {
    for (const headers of [{ Origin: "http://invalid.test" }, { "X-Owner-CSRF": "bad" }, { "Content-Type": "text/plain" }, { "X-Forwarded-Host": "localhost:8002" }]) {
      assert.equal((await h.post(`/api/child/${route}`, {}, headers)).status, 403);
    }
  }
  assert.equal((await h.post("/api/fixture", { scenario: "listed" })).status, 404);
  assert.equal(h.calls.length, 0); assert.equal(h.counts.wsl, 0);
});
test("native find rejects raw provider output and releases no source handle", async t => {
  const h = await harness(t, { handler: async args => { args.record("workflow_disabled"); return { calendars: [{ id: "SYNTHETIC-RAW-ID", name: "Synthetic source" }], partial: true }; } });
  const result = await h.post("/api/child/find", findBody);
  assert.equal(result.status, 503); assert.equal(result.data.status, "invalid_provider_response");
  assert.doesNotMatch(result.text, /SYNTHETIC-RAW-ID|calendars|handle/);
  assert.equal(h.calls.length, 1); assert.equal(h.counts.wsl, 0);
});
test("native review/import preserves person/guardian/disclosure/bounds/one-use/cross-session consent", async t => {
  const h = await harness(t), found = await h.post("/api/child/find", findBody), body = reviewBody(found.data.calendars[0].handle);
  for (const changes of [{ person: "Debby" }, { guardian: false }, { disclosure: "all" }, { startDate: "2026-10-08" },
    { endDate: "2026-10-16" }, { calendarId: "SYNTHETIC-RAW-ID" }, { sessionId: "a".repeat(64) }]) assert.equal((await h.post("/api/child/review", { ...body, ...changes })).status, 400);
  const reviewed = await h.post("/api/child/review", body), token = reviewed.data.token;
  const page = await h.request("/"), other = /name="owner-csrf" content="([a-f0-9]+)"/.exec(page.text)[1];
  assert.equal((await h.request("/api/child/review", body, other)).status, 400);
  assert.equal((await h.request("/api/child/import", importBody(token), other)).status, 503);
  assert.equal(h.calls.length, 1);
  assert.equal((await h.post("/api/child/import", importBody(token))).status, 200);
  assert.equal((await h.post("/api/child/import", importBody(token))).status, 503);
  assert.equal(h.calls.length, 2);
  const fresh = await review(h);
  assert.equal((await h.post("/api/child/import", { token: fresh.token, confirmed: false })).status, 503);
  assert.equal((await h.post("/api/child/import", importBody(fresh.token))).status, 503);
  assert.equal(h.calls.length, 3);
});
test("native privacy edit invalidates review, busy import redacts, child clear preserves parent snapshot", async t => {
  const h = await harness(t, { saved: true }), r = await review(h);
  assert.equal((await h.post("/api/child/edit")).status, 200);
  const busy = await h.post("/api/child/review", { ...r.body, disclosure: "busy_only" });
  assert.equal((await h.post("/api/child/import", importBody(busy.data.token))).status, 200);
  const r2 = await review(h, "busy_only"), imported = await h.post("/api/child/import", importBody(r2.token));
  assert.ok(imported.data.events.every(e => e.title === "Busy" && e.redacted));
  assert.equal((await h.post("/api/child/clear")).status, 200);
  assert.equal((await h.post("/api/child/import", importBody(r.token))).status, 503);
  assert.deepEqual(h.counts, { wsl: 0, parent: 0, reads: 0, writes: 0, clears: 0 });
  const saved = await h.post("/api/availability", { acknowledged: true, requestId: "11111111-1111-4111-8111-111111111111",
    startDate: "2026-10-09", endDate: "2026-10-15", cacheOnly: true, refresh: false });
  assert.equal(saved.status, 200); assert.equal(saved.data.cached, true); assert.equal(saved.data.people.length, 2);
  assert.equal(h.counts.reads, 1); assert.equal(h.counts.parent, 0); h.parentUnchanged();
});
test("native child clear waits for cleanup, holds single-flight, cancels late result without parent deletion", async t => {
  const started = deferred(), finish = deferred(), aborted = deferred();
  const h = await harness(t, { handler: async (args, fallback) => {
    if (args.action === "enroll") { args.signal.addEventListener("abort", () => aborted.resolve(), { once: true }); started.resolve(); await finish.promise; }
    args.record("workflow_disabled"); return fallback(args);
  } });
  const r = await review(h), importing = h.post("/api/child/import", importBody(r.token)); await started.promise;
  assert.equal((await h.post("/api/status")).data.status, "busy");
  assert.equal((await h.post("/api/child/find", findBody)).status, 409);
  assert.equal((await h.post("/api/availability", { acknowledged: true, requestId: "11111111-1111-4111-8111-111111111111" })).status, 409);
  const clearing = h.post("/api/child/clear"); await aborted.promise;
  assert.equal((await h.post("/api/status")).data.status, "busy"); finish.resolve();
  assert.equal((await clearing).status, 200); assert.equal((await importing).data.status, "cancelled");
  assert.equal((await h.post("/api/status")).data.status, "idle");
  assert.deepEqual(h.counts, { wsl: 0, parent: 0, reads: 0, writes: 0, clears: 0 });
});
test("native pending expiry fences success and later requests before adapters", async t => {
  let now = Date.now(); const started = deferred(), finish = deferred();
  const h = await harness(t, { options: { now: () => now }, handler: async args => {
    started.resolve(); await finish.promise; args.record("workflow_disabled"); return { calendars: [], partial: true };
  } });
  const finding = h.post("/api/child/find", findBody); await started.promise; now += 1800001; finish.resolve();
  assert.equal((await finding).data.status, "expired");
  assert.equal((await h.post("/api/child/find", findBody)).status, 403); assert.equal(h.calls.length, 1);
  assert.equal(h.counts.clears, 0);
});
test("native error never falls back to WSL; cleanup uncertainty stays sticky across new pages", async t => {
  const h = await harness(t, { handler: async args => { args.record("cleanup_failed"); args.record("workflow_disabled"); throw new OwnerFailure("cleanup_failed"); } });
  assert.equal((await h.post("/api/child/find", findBody)).data.status, "cleanup_failed");
  const page = await h.request("/"), other = /name="owner-csrf" content="([a-f0-9]+)"/.exec(page.text)[1];
  assert.equal((await h.request("/api/child/find", findBody, other)).data.status, "cleanup_failed");
  assert.equal((await h.post("/api/child/clear")).status, 503);
  assert.equal((await h.post("/api/status")).data.status, "cleanup_failed");
  assert.equal((await h.post("/api/availability", { acknowledged: true, requestId: "11111111-1111-4111-8111-111111111111" })).status, 503);
  assert.equal(h.calls.length, 1); assert.deepEqual(h.counts, { wsl: 0, parent: 0, reads: 0, writes: 0, clears: 0 });
});
test("native prestart failure has no automatic retry or WSL fallback, missing cleanup blocks later work", async t => {
  let mode = "unavailable";
  const h = await harness(t, { handler: async () => {
    if (mode === "unavailable") throw new OwnerFailure("unavailable");
    return { calendars: [], partial: true };
  } });
  assert.equal((await h.post("/api/child/find", findBody)).data.status, "unavailable");
  assert.equal(h.calls.length, 1); assert.equal((await h.post("/api/status")).data.status, "idle");
  mode = "missing_cleanup";
  assert.equal((await h.post("/api/child/find", findBody)).data.status, "cleanup_failed");
  assert.equal((await h.post("/api/child/find", findBody)).data.status, "cleanup_failed");
  assert.equal(h.calls.length, 2); assert.equal(h.counts.wsl, 0); assert.equal(h.counts.clears, 0);
});
test("native provider revocation and malformed import never disclose data or fall back", async t => {
  let fail = "revoked";
  const h = await harness(t, { handler: async (args, fallback) => {
    args.record("workflow_disabled");
    if (args.action === "find") return fallback(args);
    if (fail === "revoked") throw new OwnerFailure("revoked");
    const data = await fallback(args); data.data.events[1].title = "SYNTHETIC-PRIVATE"; return data;
  } });
  const first = await review(h), revoked = await h.post("/api/child/import", importBody(first.token));
  assert.equal(revoked.data.status, "revoked");
  assert.equal((await h.post("/api/child/review", first.body)).status, 400);
  fail = "malformed";
  const next = await review(h), malformed = await h.post("/api/child/import", importBody(next.token));
  assert.equal(malformed.status, 503); assert.doesNotMatch(malformed.text, /SYNTHETIC-PRIVATE|events|title/);
  assert.equal(h.calls.length, 4); assert.equal(h.counts.wsl, 0); assert.equal(h.counts.clears, 0);
});
test("actual native adapter accepts HTTP-generated context with mocked exchange and no scenario", async t => {
  const exchanges = []; let lockCalls = 0;
  const adapter = native.createChildNativeAdapter({ lock: async fn => { lockCalls++; return fn(); }, exchange: async (mode, { payload }) => {
    exchanges.push({ mode, payload });
    const data = mode === "find" ? { calendars: [{ id: P.sealSource("SYNTHETIC-RAW-ID", payload), name: "Synthetic source" }], partial: true }
      : { reference: "c".repeat(64), data: await fixture({ action: "import", disclosure: payload.disclosure, record() {} }) };
    if (mode === "enroll") assert.equal(P.openSource(payload.calendarId, payload), "SYNTHETIC-RAW-ID");
    return { ok: true, cleanup: "workflow_disabled", stage: "complete", extensionsRemoved: true, data };
  } });
  const h = await harness(t, { adapter: { perform: adapter.perform } });
  assert.equal(exchanges.length, 0); assert.equal(lockCalls, 0);
  const r = await review(h), imported = await h.post("/api/child/import", importBody(r.token));
  assert.equal(imported.status, 200); assert.equal(imported.data.events.length, 3);
  assert.deepEqual(exchanges.map(x => x.mode), ["find", "enroll"]); assert.equal(lockCalls, 2);
  assert.equal(exchanges[0].payload.sessionId, exchanges[1].payload.sessionId);
  assert.equal(exchanges[0].payload.key, exchanges[1].payload.key);
  assert.equal(exchanges[1].payload.person, "Kimi"); assert.equal(exchanges[1].payload.guardian, true); assert.equal(exchanges[1].payload.confirmed, true);
  assert.equal(h.counts.wsl, 0); assert.equal(h.counts.parent, 0);
});