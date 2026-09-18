"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path"), http = require("node:http");
const { once } = require("node:events");
const { createServer } = require("../scripts/serve-owner");
const { createDiskStore, localBinding } = require("../scripts/availability-disk-cache");
const { createSnapshotCache } = require("../scripts/availability-cache");
const { OwnerFailure } = require("../scripts/owner-calendar");
const A = require("../owner/availability-core"), D = require("../shared/date-selection");
const fixture = require("../browser-fixtures/availability");
const { dateStorage } = require("./fixtures/date-storage");
const context = "a".repeat(64);
const body = { acknowledged: true, requestId: "11111111-1111-4111-8111-111111111111", refresh: false, startDate: "2026-10-09", endDate: "2026-10-15" };
const saved = { ...body, cacheOnly: true };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

async function disk(t, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "familycopilot-october-test-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const priorBinding = localBinding({ mode: "synthetic-test" });
  const binding = localBinding({ mode: "synthetic-test", october: true });
  const prior = createDiskStore({ directory, binding: priorBinding });
  prior.write(context, await fixture.perform({ scenario: "partial", record() {} }));
  const filename = path.join(directory, "owner-availability.json"), original = fs.readFileSync(filename);
  const store = () => createDiskStore({ directory, binding, priorBinding, october: true, ...options });
  return { filename, original, store, prior, directory, binding, priorBinding };
}
async function server(t, storage, performAvailability) {
  // Live-mode security code, but both adapters are injected; never real providers.
  const s = createServer({ storage, performAvailability, perform: async () => { throw Error("No list permitted"); } });
  s.listen(0, "127.0.0.1"); await once(s, "listening"); t.after(() => s.shutdown());
  const request = (url, payload, csrf) => new Promise((resolve, reject) => {
    const r = http.request({ hostname: "127.0.0.1", port: s.address().port, path: url, method: payload ? "POST" : "GET",
      headers: { Host: "127.0.0.1:8002", ...(payload ? { Origin: "http://127.0.0.1:8002", "Content-Type": "application/json", "X-Owner-CSRF": csrf } : {}) } }, res => {
      let text = ""; res.on("data", c => { text += c; }); res.on("end", () => resolve({ status: res.statusCode, text }));
    }); r.on("error", reject); r.end(payload ? JSON.stringify(payload) : undefined);
  });
  const page = await request("/"), csrf = page.text.match(/name="owner-csrf" content="([a-f0-9]+)"/)[1];
  return { page, s, post: async (url, payload = {}) => JSON.parse((await request(url, payload, csrf)).text) };
}

test("October is the empty-tab default; existing dates and September sample contracts stay unchanged", () => {
  const storage = dateStorage(), dates = D.createStore(() => storage);
  assert.deepEqual(dates.read().window, A.dateRange("2026-10-09", "2026-10-11"));
  assert.equal(storage.getItem(D.key), null); // Defaults do not write consent or dates.
  dates.write("2026-09-20", "2026-09-26"); assert.deepEqual(dates.read().window, A.window);
  dates.write("2026-10-09", "2026-10-15");
  assert.equal(D.describeWeek(D.createStore(() => storage).read().window).label, "9–15 October 2026");
  assert.equal(require("../infra/availability").buildAvailability("11111111-1111-4111-8111-111111111111").tags.contract, "bounded-availability-v4");
  assert.equal(require("../activity-preview/core").week.start, "2026-09-20");
});

test("October startup/status/saved-only miss never queries, relabels or alters a completed September file", async t => {
  let reads = 0, writes = 0, clears = 0, calls = 0;
  const f = await disk(t);
  const instrument = () => {
    const inner = f.store();
    return { ...inner, read(...a) { reads++; return inner.read(...a); }, write(...a) { writes++; return inner.write(...a); }, clear() { clears++; return inner.clear(); } };
  };
  const never = async () => { calls++; throw Error("No provider permitted"); };
  const h = await server(t, instrument(), never);
  assert.match(h.page.text, /name="owner-contract" content="bounded-availability-v5"/);
  assert.match(h.page.text, /class="shell-date">9–11 October 2026/);
  assert.equal((await h.post("/api/status")).status, "idle");
  assert.deepEqual([reads, writes, clears, calls], [0, 0, 0, 0]);
  assert.equal((await h.post("/api/availability", saved)).status, "cache_missing");
  assert.deepEqual([reads, writes, clears, calls], [1, 0, 0, 0]);
  for (const request of [{ ...body, startDate: "2026-09-20", endDate: "2026-09-26" },
    { ...body, endDate: "2026-10-14", refresh: true }]) {
    const data = await h.post("/api/availability", request);
    assert.equal(data.status, "range_unavailable"); assert.equal(data.people, undefined);
  }
  assert.equal((await h.post("/api/clear", { reason: "range" })).status, "cleared");
  assert.deepEqual(fs.readFileSync(f.filename), f.original);
  await h.s.shutdown();
  const next = await server(t, instrument(), never);
  assert.equal((await next.post("/api/availability", saved)).status, "cache_missing");
  assert.deepEqual(fs.readFileSync(f.filename), f.original);
  assert.equal(calls + clears + writes, 0);
  assert.equal(reads, 2);
});

test("October query failure and wrong-window response preserve prior bytes without returning old data", async t => {
  for (const scenario of ["unavailable", "wrong-window", "empty"]) {
    const f = await disk(t); let calls = 0;
    const h = await server(t, f.store(), async o => {
      calls++; o.record("workflow_disabled");
      if (scenario === "unavailable") throw new OwnerFailure("unavailable");
      return fixture.perform({ ...o, window: scenario === "wrong-window" ? A.window : A.liveWindow, scenario: "empty" });
    });
    const data = await h.post("/api/availability", body);
    if (scenario !== "empty") assert.equal(data.people, undefined);
    else assert.ok(data.people.every(p => p.slots.every(s => s === "unknown")));
    assert.equal(calls, 1); assert.deepEqual(fs.readFileSync(f.filename), f.original);
    assert.equal((await h.post("/api/availability", saved)).status, "cache_missing"); assert.equal(calls, 1);
  }
});

test("October confirmed success atomically replaces one snapshot, retains original timestamp on exact saved-only restart", async t => {
  const f = await disk(t); let calls = 0;
  const h = await server(t, f.store(), async o => { calls++; o.recordContext(context); return fixture.perform({ ...o, scenario: "partial" }); });
  const first = await h.post("/api/availability", body);
  assert.equal(first.cached, false); assert.deepEqual(first.window, A.liveWindow);
  assert.equal(first.people[0].slots.length, 336); assert.ok(first.people[1].slots.every(s => s === "unknown"));
  assert.notDeepEqual(fs.readFileSync(f.filename), f.original);
  assert.deepEqual(fs.readdirSync(f.directory), ["owner-availability.json"]);
  await h.s.shutdown();
  const next = await server(t, f.store(), async () => { calls++; throw Error("No fallback"); });
  const hit = await next.post("/api/availability", saved);
  assert.equal(hit.cached, true); assert.deepEqual(hit.people, first.people); assert.equal(hit.checkedAt, first.checkedAt); assert.equal(calls, 1);
});

test("October range fence cancels late writes without destroying prior file; explicit Clear deletes and cannot resurrect", async t => {
  for (const clear of [{ reason: "range" }, {}]) {
    const f = await disk(t), started = deferred(), finish = deferred(), aborted = deferred(); t.after(finish.resolve);
    const h = await server(t, f.store(), async o => {
      o.recordContext(context); o.signal.addEventListener("abort", aborted.resolve, { once: true });
      started.resolve(); await finish.promise; return fixture.perform({ ...o, signal: undefined });
    });
    const loading = h.post("/api/availability", body); await started.promise;
    const clearing = h.post("/api/clear", clear); await aborted.promise; finish.resolve();
    assert.equal((await clearing).status, "cleared"); assert.equal((await loading).status, "cancelled");
    if (clear.reason) assert.deepEqual(fs.readFileSync(f.filename), f.original);
    else assert.equal(fs.existsSync(f.filename), false);
  }
});

test("October known revocation/contract/cleanup failure still destroys retained data, never bypasses privacy reductions", async t => {
  for (const code of ["revoked", "contract_drift", "expired", "blocked", "cleanup_failed"]) {
    const f = await disk(t);
    const h = await server(t, f.store(), async o => { if (code === "cleanup_failed") o.record(code); throw new OwnerFailure(code); });
    assert.equal((await h.post("/api/availability", body)).status, code);
    assert.equal(fs.existsSync(f.filename), false);
  }
});

test("October rejects foreign prior binding, extra fields and dynamic reads without deletion or provider fallback", async t => {
  const f = await disk(t);
  assert.notEqual(f.binding, f.priorBinding);
  const wrong = createDiskStore({ directory: f.directory, binding: f.binding, october: true, priorBinding: "b".repeat(64) });
  assert.throws(() => wrong.read(), { code: "cache_invalid" });
  assert.deepEqual(fs.readFileSync(f.filename), f.original);
  assert.throws(() => f.store().read(A.window), { code: "cache_invalid" });
  assert.throws(() => f.store().write(context, {}, A.window), { code: "cache_invalid" });
  const c = createSnapshotCache({ storage: f.store() });
  assert.throws(() => c.get(null, A.window), { code: "cache_invalid" });
  const generation = c.generation; c.prepare();
  assert.equal(c.put(context, {}, generation, A.liveWindow), false);
  const malformed = JSON.parse(f.original); malformed.data.subject = "PRIVATE";
  fs.writeFileSync(f.filename, JSON.stringify(malformed));
  assert.throws(() => f.store().read(), { code: "cache_invalid" });
});