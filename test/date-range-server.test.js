"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { once } = require("node:events");
const { createServer } = require("../scripts/serve-owner");
const { createSnapshotCache } = require("../scripts/availability-cache");
const { createDiskStore, CacheFailure, localBinding } = require("../scripts/availability-disk-cache");
const { OwnerFailure } = require("../scripts/owner-calendar");
const fixture = require("../browser-fixtures/availability");
const A = require("../owner/availability-core");
const legacy = { acknowledged: true, requestId: "11111111-1111-4111-8111-111111111111" };
const selected = (startDate = "2026-10-01", endDate = startDate, refresh = false) => ({ ...legacy, refresh, startDate, endDate });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
async function harness(t, options = {}) {
  // Never use a provider adapter, existing port, or real cache in these tests.
  const server = createServer({ synthetic: true, perform: async () => { throw new Error("unexpected list"); },
    performAvailability: fixture.perform, ...options });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  t.after(() => server.shutdown());
  const request = (url, body, headers = {}) => new Promise((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port: server.address().port, path: url,
      method: body === undefined ? "GET" : "POST", headers: { Host: "localhost:8002",
        ...(body === undefined ? {} : { Origin: "http://localhost:8002", "Content-Type": "application/json" }), ...headers } }, res => {
      let text = ""; res.setEncoding("utf8"); res.on("data", chunk => { text += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, text, data: res.headers["content-type"]?.startsWith("application/json") ? JSON.parse(text) : null }));
    });
    req.on("error", reject); req.end(body === undefined ? undefined : JSON.stringify(body));
  });
  const page = await request("/");
  const csrf = page.text.match(/name="owner-csrf" content="([a-f0-9]+)"/)[1];
  const post = (url, body = {}, headers = {}) => request(url, body, { "X-Owner-CSRF": csrf, ...headers });
  const fresh = async () => ({ "X-Owner-CSRF": (await request("/")).text.match(/name="owner-csrf" content="([a-f0-9]+)"/)[1] });
  return { request, post, fresh, page };
}
const noData = r => assert.doesNotMatch(r.text, /"(?:people|slots|window|checkedAt|cached)"/);

test("saved-only original week survives date edits, unsupported read/refresh, and restart byte-for-byte", async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "familycopilot-range-cache-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const filename = path.join(directory, "owner-availability.json");
  const binding = localBinding({ mode: "synthetic-test" });
  const storage = () => createDiskStore({ directory, binding });
  const data = await fixture.perform({ scenario: "partial", record() {} });
  storage().write("a".repeat(64), data);
  const original = fs.readFileSync(filename);
  let calls = 0;
  const never = async () => { calls++; throw new Error("No provider allowed"); };
  const body = { ...selected("2026-09-20", "2026-09-26"), cacheOnly: true };
  const h = await harness(t, { synthetic: true, storage: storage(), performAvailability: never });
  assert.match(h.page.text, /name="owner-saved" content="preserve-v1"/);
  const first = (await h.post("/api/availability", body)).data;
  assert.equal(first.cached, true);
  assert.ok(first.people[1].slots.every(s => s === "unknown"));
  assert.equal((await h.post("/api/clear", { reason: "range" })).data.status, "cleared");
  for (const refresh of [false, true]) {
    const wrong = await h.post("/api/availability", selected("2026-10-09", "2026-10-15", refresh));
    assert.equal(wrong.data.status, "range_unavailable"); noData(wrong);
    assert.deepEqual(fs.readFileSync(filename), original);
  }
  assert.deepEqual((await h.post("/api/availability", body)).data, first);
  const restarted = await harness(t, { synthetic: true, storage: storage(), performAvailability: never });
  assert.deepEqual((await restarted.post("/api/availability", body)).data, first);
  assert.deepEqual(fs.readFileSync(filename), original);
  assert.equal(calls, 0);
  assert.equal((await restarted.post("/api/clear", {})).data.status, "cleared");
  assert.equal(fs.existsSync(filename), false);
  const missing = await restarted.post("/api/availability", body, await restarted.fresh());
  assert.equal(missing.data.status, "cache_missing"); noData(missing); assert.equal(calls, 0);
});

test("saved-only schema and session/origin gates cannot read a cache or query on a miss", async t => {
  let reads = 0, effects = 0;
  const never = () => { effects++; throw new Error("No side effects"); };
  const h = await harness(t, { storage: { read() { reads++; return null; }, write: never, clear: never }, performAvailability: never });
  const body = { ...selected("2026-09-20", "2026-09-26"), cacheOnly: true };
  for (const invalid of [{ ...body, refresh: true }, { ...body, cacheOnly: "true" }, { ...body, acknowledged: false },
    { ...legacy, cacheOnly: true }, { ...body, extra: true }]) {
    const r = await h.post("/api/availability", invalid); assert.equal(r.status, 400); noData(r);
  }
  for (const headers of [{ Origin: "http://evil.test" }, { "X-Owner-CSRF": "bad" }, { Host: "127.0.0.1:8002" }]) {
    const r = await h.post("/api/availability", body, headers); assert.equal(r.status, 403); noData(r);
  }
  assert.equal(reads, 0);
  const r = await h.post("/api/availability", body);
  assert.equal(r.data.status, "cache_missing"); noData(r);
  assert.equal(reads, 1); assert.equal(effects, 0);
  await h.post("/api/clear", { reason: "leave" });
  assert.equal((await h.post("/api/availability", body)).data.status, "blocked");
  assert.equal(reads, 1);
});

test("range fences retain snapshots but context drift clears and late writes cannot replace them", async () => {
  const range = A.dateRange("2026-10-09", "2026-10-15");
  const data = await fixture.perform({ record() {} });
  const c = createSnapshotCache(); c.put("original", data, c.generation);
  const old = c.generation; c.fence();
  assert.equal(c.put("original", data, old), false);
  assert.equal(c.get("original", range), null);
  assert.deepEqual(c.get("original"), data);
  assert.equal(c.get("changed-owner", range), null);
  assert.equal(c.get("original"), null);
});

test("a late known access failure invalidates retained data even after a range fence", async t => {
  for (const code of ["revoked", "contract_drift", "expired", "blocked"]) {
    const started = deferred(), finish = deferred(); t.after(finish.resolve);
    const h = await harness(t, { perform: async o => {
      started.resolve(); await finish.promise; o.record("workflow_disabled"); throw new OwnerFailure(code);
    } });
    await h.post("/api/availability", legacy);
    const other = await h.fresh(), listing = h.post("/api/load", legacy);
    await started.promise;
    await h.post("/api/clear", { reason: "range" }, other);
    finish.resolve(); assert.equal((await listing).data.status, code);
    const cached = await h.post("/api/availability", { ...selected("2026-09-20", "2026-09-26"), cacheOnly: true }, other);
    assert.equal(cached.data.status, "cache_missing"); noData(cached);
  }
});

test("current live and synthetic pages advertise range protocol without touching cache/provider", async t => {
  let effects = 0;
  const never = () => { effects++; throw new Error("unexpected side effect"); };
  for (const synthetic of [false, true]) {
    const h = await harness(t, { synthetic, performAvailability: never, storage: { read: never, clear: never, write: never } });
    assert.match(h.page.text, /<meta name="owner-range" content="configurable-v1">/);
    assert.equal((h.page.text.match(/name="owner-range"/g) || []).length, 1);
    assert.equal((await h.post("/api/status")).data.status, "idle");
  }
  assert.equal(effects, 0);
});

test("strict date HTTP schema rejects missing/extra/invalid dates before cache or provider effects", async t => {
  let effects = 0;
  const never = () => { effects++; throw new Error("unexpected side effect"); };
  const h = await harness(t, { performAvailability: never, storage: { read: never, clear: never, write: never } });
  const bodies = [
    { ...legacy, startDate: "2026-10-01" }, { ...legacy, endDate: "2026-10-01" },
    { ...legacy, refresh: false, startDate: "2026-10-01" }, { ...legacy, refresh: false, endDate: "2026-10-01" },
    { ...legacy, startDate: "2026-10-01", endDate: "2026-10-01" },
    { ...selected(), refresh: "false" }, { ...selected(), acknowledged: false }, { ...selected(), requestId: "invalid" },
    { ...selected(), timezone: "UTC" }, { ...selected(), window: A.window }, { ...selected(), extra: true },
    ...[null, 20261001, {}, [], "", "2026-1-01", "2026-10-1", "2026-10-01T00:00:00Z", "2026-10-01 ", " 2026-10-01",
      "2026-02-29", "2100-02-29", "2026-04-31", "2026-00-01", "2026-13-01", "1999-12-31", "2101-01-01"]
      .flatMap(value => [selected(value, "2026-10-01"), selected("2026-10-01", value)]),
    selected("2026-10-02", "2026-10-01"), selected("2026-10-01", "2026-10-08")
  ];
  for (const body of bodies) {
    const r = await h.post("/api/availability", body);
    assert.equal(r.status, 400, JSON.stringify(body)); assert.equal(r.data.status, "blocked"); noData(r);
  }
  assert.equal((await h.post("/api/load", selected())).status, 400);
  assert.equal(effects, 0);
});

test("live out-of-contract ranges reject read and refresh before all cache/provider effects; legacy still works", async t => {
  let reads = 0, clears = 0, writes = 0, calls = 0;
  const h = await harness(t, { synthetic: false, storage: {
    window: A.liveWindow,
    read() { reads++; return null; }, clear() { clears++; }, write() { writes++; }
  }, performAvailability: async o => { calls++; o.recordContext("a".repeat(64)); return fixture.perform(o); } });
  for (const refresh of [false, true]) {
    const r = await h.post("/api/availability", selected("2026-09-20", "2026-09-20", refresh));
    assert.equal(r.status, 503); assert.equal(r.data.status, "range_unavailable"); noData(r);
  }
  assert.deepEqual([reads, clears, writes, calls], [0, 0, 0, 0]);
  const first = await h.post("/api/availability", selected("2026-10-09", "2026-10-15"));
  assert.equal(first.status, 200); assert.deepEqual(first.data.window, A.liveWindow); assert.equal(calls, 1);
  const counts = [reads, clears, writes, calls];
  const rejected = await h.post("/api/availability", selected("2026-10-01", "2026-10-07", true));
  assert.equal(rejected.data.status, "range_unavailable"); noData(rejected);
  assert.deepEqual([reads, clears, writes, calls], counts);
  const cached = await h.post("/api/availability", legacy);
  assert.equal(cached.data.cached, true); assert.deepEqual(cached.data.window, A.liveWindow); assert.equal(calls, 1);
});

test("synthetic inclusive ranges produce exact Taipei boundaries and 48/96/336 slots, same-range hits and different misses", async t => {
  let calls = 0;
  const h = await harness(t, { performAvailability: async o => { calls++; return fixture.perform(o); } });
  const ranges = [["2026-10-01", "2026-10-01", 48], ["2026-12-31", "2027-01-01", 96],
    ["2028-02-27", "2028-03-04", 336], ["2000-01-01", "2000-01-01", 48], ["2100-12-31", "2100-12-31", 48]];
  for (const [start, end, slots] of ranges) {
    const count = calls;
    const first = await h.post("/api/availability", selected(start, end));
    assert.equal(first.status, 200); assert.equal(first.data.cached, false); assert.equal(first.data.synthetic, true);
    assert.deepEqual(first.data.window, A.dateRange(start, end));
    assert.equal(first.data.window.slots, slots); assert.equal(first.data.window.timezone, "Asia/Taipei");
    assert.ok(first.data.people.every(p => p.slots.length === slots && p.status === "checked"));
    const second = await h.post("/api/availability", selected(start, end), await h.fresh());
    assert.equal(second.data.cached, true); assert.equal(second.data.checkedAt, first.data.checkedAt);
    assert.deepEqual(second.data.people, first.data.people); assert.equal(calls, count + 1);
  }
  const legacyResult = await h.post("/api/availability", { ...legacy, refresh: false });
  assert.equal(legacyResult.status, 200); assert.deepEqual(legacyResult.data.window, A.window);
  assert.equal(legacyResult.data.cached, false);
  assert.equal((await h.post("/api/availability", legacy)).data.cached, true);
});

test("synthetic missing, unavailable and partial fixtures preserve requested range and unknown slot counts", async t => {
  const h = await harness(t);
  for (const scenario of ["empty", "unavailable", "revoked", "partial"]) {
    assert.equal((await h.post("/api/fixture", { scenario })).status, 200);
    const r = await h.post("/api/availability", selected("2026-10-01", "2026-10-02"));
    assert.equal(r.status, 200); assert.equal(r.data.window.slots, 96);
    assert.ok(r.data.people.every(p => p.slots.length === 96));
    assert.ok(r.data.people[1].slots.every(s => s === "unknown"));
    if (scenario !== "partial") assert.ok(r.data.people[0].slots.every(s => s === "unknown"));
  }
});

test("wrong-range provider response is never served or cached and safe extras are redacted", async t => {
  let calls = 0;
  const h = await harness(t, { performAvailability: async o => {
    calls++; const result = await fixture.perform({ ...o, ...(calls === 1 ? { window: A.window } : {}) });
    result.subject = "PRIVATE"; result.people[0].address = "PRIVATE"; return result;
  } });
  const rejected = await h.post("/api/availability", selected());
  assert.equal(rejected.status, 503); assert.equal(rejected.data.status, "unavailable"); noData(rejected);
  const good = await h.post("/api/availability", selected());
  assert.equal(good.status, 200); assert.equal(good.data.cached, false); assert.equal(calls, 2);
  assert.doesNotMatch(good.text, /PRIVATE|subject|address/);
  assert.equal((await h.post("/api/availability", selected())).data.cached, true);
});

test("range clear cancels and fences active availability across sessions, but allows the next deliberate request", async t => {
  for (const crossSession of [false, true]) {
    let calls = 0; const started = deferred(), aborted = deferred(), finish = deferred();
    t.after(finish.resolve);
    const h = await harness(t, { performAvailability: async o => {
      calls++;
      if (calls === 1) { o.signal.addEventListener("abort", aborted.resolve, { once: true }); started.resolve(); await finish.promise; }
      return fixture.perform(o);
    } });
    const other = crossSession ? await h.fresh() : {};
    const loading = h.post("/api/availability", selected()); await started.promise;
    const clearing = h.post("/api/clear", { reason: "range" }, other); await aborted.promise;
    assert.equal((await h.post("/api/availability", selected("2026-10-02"), other)).status, 409);
    finish.resolve(); const cleared = await clearing, late = await loading;
    assert.equal(cleared.data.status, "cleared"); assert.equal(late.data.status, "cancelled"); noData(late);
    const next = await h.post("/api/availability", selected("2026-10-02"), other);
    assert.equal(next.status, 200); assert.equal(next.data.cached, false); assert.equal(calls, 2);
    assert.deepEqual(next.data.window, A.dateRange("2026-10-02", "2026-10-02"));
    assert.equal((await h.post("/api/availability", selected("2026-10-02"))).data.cached, true);
  }
});

test("failed explicit clear fences active work; range edits cannot recover its sticky deletion block", async t => {
  let fail = false, calls = 0, reads = 0, writes = 0;
  const started = deferred(), aborted = deferred(), finish = deferred();
  t.after(finish.resolve);
  const h = await harness(t, { storage: { read() { reads++; return null; }, write() { writes++; },
    clear() { if (fail) throw new CacheFailure("cache_clear_failed"); }
  }, performAvailability: async o => {
    calls++;
    if (calls === 1) { o.signal.addEventListener("abort", aborted.resolve, { once: true }); started.resolve(); await finish.promise; }
    return fixture.perform(o);
  } });
  const loading = h.post("/api/availability", legacy); await started.promise;
  fail = true; const clearing = h.post("/api/clear", {}); await aborted.promise;
  finish.resolve();
  for (const r of [await clearing, await loading]) { assert.equal(r.status, 503); assert.equal(r.data.status, "cache_clear_failed"); noData(r); }
  assert.equal(writes, 0);
  for (const headers of [{}, await h.fresh()]) {
    const expected = Object.keys(headers).length ? "cache_clear_failed" : "blocked";
    const r = await h.post("/api/availability", legacy, headers);
    assert.equal(r.data.status, expected); noData(r);
    const different = await h.post("/api/availability", selected(), headers);
    assert.equal(different.data.status, expected); noData(different);
  }
  assert.equal(calls, 1); assert.equal(reads, 1);
  fail = false;
  assert.equal((await h.post("/api/clear", { reason: "range" })).data.status, "cache_clear_failed");
  assert.equal((await h.post("/api/clear", {})).data.status, "cleared");
  assert.equal((await h.post("/api/availability", legacy, await h.fresh())).status, 200); assert.equal(calls, 2);
});

test("range clear cannot recover sticky provider cleanup failure or revive explicit Clear/leave revoked sessions", async t => {
  let calls = 0;
  const failed = await harness(t, { performAvailability: async o => {
    calls++; o.record("cleanup_failed"); throw new OwnerFailure("cleanup_failed");
  } });
  assert.equal((await failed.post("/api/availability", selected())).data.status, "cleanup_failed");
  assert.equal((await failed.post("/api/clear", { reason: "range" })).data.status, "cleanup_failed");
  assert.equal((await failed.post("/api/availability", selected(), await failed.fresh())).data.status, "cleanup_failed");
  assert.equal(calls, 1);
  for (const body of [{}, { reason: "leave" }]) {
    const h = await harness(t);
    await h.post("/api/availability", selected());
    assert.equal((await h.post("/api/clear", body)).data.status, "cleared");
    await h.post("/api/clear", { reason: "range" });
    const r = await h.post("/api/availability", selected());
    assert.equal(r.status, 400); assert.equal(r.data.status, "blocked"); noData(r);
  }
});

test("range edits and leave retain completed cache; malformed/unauthorized clear cannot erase it", async t => {
  let calls = 0;
  const h = await harness(t, { performAvailability: async o => { calls++; return fixture.perform(o); } });
  await h.post("/api/availability", selected());
  for (const body of [{ reason: "other" }, { reason: "range", extra: true }, { reason: null }])
    assert.equal((await h.post("/api/clear", body)).status, 400);
  for (const headers of [{ Origin: "http://evil.test" }, { "X-Owner-CSRF": "bad" }, { Host: "127.0.0.1:8002" }])
    assert.equal((await h.post("/api/clear", { reason: "range" }, headers)).status, 403);
  assert.equal((await h.post("/api/availability", selected())).data.cached, true); assert.equal(calls, 1);
  await h.post("/api/clear", { reason: "leave" });
  const fresh = await h.fresh();
  assert.equal((await h.post("/api/availability", selected(), fresh)).data.cached, true);
  assert.equal((await h.post("/api/clear", { reason: "range" }, fresh)).data.status, "cleared");
  assert.equal((await h.post("/api/availability", selected(), fresh)).data.cached, true); assert.equal(calls, 1);
});

test("RAM cache binds requested window independently of context, rejects wrong range and fences late puts", async () => {
  const range = A.dateRange("2026-10-01", "2026-10-02"), other = A.dateRange("2026-10-03", "2026-10-04");
  const data = await fixture.perform({ window: range, signal: new AbortController().signal, record() {} });
  const c = createSnapshotCache();
  assert.equal(c.put("synthetic", data, c.generation, range), true);
  const copy = c.get("synthetic", range); copy.people[0].slots[0] = "PRIVATE";
  assert.notEqual(c.get("synthetic", range).people[0].slots[0], "PRIVATE");
  assert.throws(() => c.put("synthetic", data, c.generation, other));
  assert.equal(c.get("synthetic", other), null); assert.deepEqual(c.get("synthetic", range), data);
  const generation = c.generation; c.clear();
  assert.equal(c.put("synthetic", data, generation, range), false);
});

test("dynamic disk use is rejected before I/O at server, cache and store boundaries", async t => {
  let effects = 0;
  const never = () => { effects++; throw new Error("unexpected I/O"); };
  const range = A.dateRange("2026-10-01", "2026-10-02");
  const store = createDiskStore({ directory: "/tmp/familycopilot-never-accessed-range-test", binding: localBinding({ mode: "synthetic-test" }),
    io: new Proxy({}, { get() { return never; } }) });
  assert.throws(() => store.read(range), { code: "cache_invalid" });
  assert.throws(() => store.write("a".repeat(64), {}, range), { code: "cache_invalid" });
  const c = createSnapshotCache({ storage: store });
  assert.throws(() => c.get(null, range), { code: "cache_invalid" });
  assert.throws(() => c.put("a".repeat(64), {}, c.generation, range), { code: "cache_invalid" });
  const h = await harness(t, { storage: store, performAvailability: never });
  const r = await h.post("/api/availability", selected());
  assert.equal(r.data.status, "range_unavailable"); noData(r);
  assert.equal(effects, 0);
});

test("a late list failure cannot retry failed explicit deletion or remove its sticky cache block", async t => {
  let clears = 0, failedClear = false;
  const started = deferred(), aborted = deferred();
  const h = await harness(t, { storage: { clear() {
    clears++;
    if (!failedClear) { failedClear = true; throw new CacheFailure("cache_clear_failed"); }
  } }, perform: async o => {
    o.signal.addEventListener("abort", aborted.resolve, { once: true }); started.resolve();
    await aborted.promise; o.record("workflow_disabled"); throw new OwnerFailure("revoked");
  } });
  const loading = h.post("/api/load", legacy); await started.promise;
  const clearing = await h.post("/api/clear", {});
  assert.equal(clearing.data.status, "cache_clear_failed");
  const late = await loading; assert.equal(late.data.status, "cache_clear_failed"); noData(late);
  assert.equal(clears, 1); // The obsolete list error must not implicitly retry deletion.
  assert.equal((await h.post("/api/status")).data.status, "cache_clear_failed");
  assert.equal((await h.post("/api/clear", { reason: "range" })).data.status, "cache_clear_failed");
  assert.equal(clears, 1);
  assert.equal((await h.post("/api/clear", {})).data.status, "cleared");
  assert.equal(clears, 2);
});

test("range clear from another page leaves active calendar-list work alone and preserves its single-use guard", async t => {
  const started = deferred(), finish = deferred(); let signal;
  t.after(finish.resolve);
  const h = await harness(t, { perform: async o => {
    signal = o.signal; started.resolve(); await finish.promise; o.record("workflow_disabled");
    return { status: "empty", count: 0, calendars: [] };
  } });
  const other = await h.fresh(), loading = h.post("/api/load", legacy); await started.promise;
  assert.equal((await h.post("/api/clear", { reason: "range" }, other)).data.status, "cleared");
  assert.equal(signal.aborted, false);
  assert.equal((await h.post("/api/load", legacy, other)).status, 409);
  finish.resolve(); assert.equal((await loading).status, 200);
  assert.equal((await h.post("/api/load", legacy)).status, 400);
  assert.equal((await h.post("/api/load", legacy, other)).status, 200);
});