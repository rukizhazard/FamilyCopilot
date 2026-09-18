"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { once } = require("node:events");
const { createServer, validRequest } = require("../scripts/serve-owner");
const { OwnerFailure } = require("../scripts/owner-calendar");
const origin = "http://localhost:8002";
const requestId = "11111111-1111-4111-8111-111111111111";
const payload = { acknowledged: true, requestId };
const list = { status: "empty", count: 0, calendars: [], completeness: "unknown", ownership: "unverified", eventsRead: 0 };
async function harness(t, perform, options = {}) {
  // Historical disk fixtures keep their exact v4 data in synthetic mode. Live
  // October disk preservation has independent coverage in october-demo.test.js.
  const server = createServer({ perform, ...(options.storage?.window === A.window ? { synthetic: true } : {}), ...options }); server.listen(0, "127.0.0.1"); await once(server, "listening");
  t.after(() => server.shutdown());
  const request = (url, { method = "GET", headers = {}, body } = {}) => new Promise((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port: server.address().port, path: url, method,
      headers: { Host: "localhost:8002", ...headers } }, res => {
      let text = ""; res.setEncoding("utf8"); res.on("data", chunk => { text += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, text, headers: res.headers }));
    }); req.on("error", reject); req.end(body);
  });
  const page = await request("/");
  const csrf = page.text.match(/name="owner-csrf" content="([a-f0-9]+)"/)[1];
  const post = (url, body = {}, headers = {}) => request(url, { method: "POST", body: JSON.stringify(body),
    headers: { Origin: origin, "Content-Type": "application/json", "X-Owner-CSRF": csrf, ...headers } });
  return { server, request, page, csrf, post };
}

test("page/start/status perform no Azure or list work and expose only allowlisted files", async t => {
  let calls = 0;
  const h = await harness(t, async () => { calls++; });
  assert.equal(h.page.status, 200); assert.equal(calls, 0);
  assert.match(h.page.text, /Idle · Nothing loaded/); assert.match(h.page.text, /content="live"/);
  assert.equal((await h.post("/api/status")).status, 200); assert.equal(calls, 0);
  for (const url of ["/.env", "/scripts/owner-calendar.js", "/picker/public-config.json", "/api/events", "/api/load?x=1", "/../README.md", "/api/fixture"]) {
    assert.equal((await h.request(url)).status, 404);
  }
  assert.equal((await h.request("/demo")).status, 200);
  assert.equal(h.page.headers["access-control-allow-origin"], undefined);
  assert.equal(h.page.headers["cache-control"], "no-store");
  assert.match(h.page.headers["content-security-policy"], /frame-ancestors 'none'/);
});

test("exact loopback Host, matching Origin, content-type and CSRF required for every mutation", async t => {
  let calls = 0; const h = await harness(t, async () => { calls++; });
  for (const headers of [{ Origin: "http://evil.test" }, { Origin: "null" }, { Origin: "" }, { Host: "127.0.0.1:8002" },
    { Host: "localhost:8002.evil.test" }, { "X-Owner-CSRF": "incorrect" }, { "Content-Type": "text/plain" },
    { "Sec-Fetch-Site": "cross-site" }, { "X-Forwarded-Host": "localhost:8002" }]) {
    assert.equal((await h.post("/api/load", payload, headers)).status, 403);
  }
  assert.equal((await h.request("/api/load")).status, 403);
  assert.equal((await h.request("/api/load", { method: "OPTIONS" })).status, 403);
  assert.equal(calls, 0);
  assert.equal(validRequest({ socket: { remoteAddress: "10.0.0.1" }, headers: { host: "localhost:8002" } }, origin), false);
});

test("both exact loopback hosts serve activities/assets and independent same-origin owner sessions", async t => {
  let calls = 0, reads = 0, clears = 0;
  const never = async () => { calls++; throw new Error("must not query"); };
  const h = await harness(t, never, { performAvailability: never, storage: {
    read() { reads++; throw new Error("must not read"); }, clear() { clears++; throw new Error("must not clear"); }
  } });
  for (const Host of ["localhost:8002", "127.0.0.1:8002"]) {
    const headers = { Host, Origin: `http://${Host}` };
    for (const route of ["/activities", "/activities/", "/shell.css", "/activity-preview/core.js",
      "/activity-preview/ui.js", "/activity-preview/preview.css", "/styles.css", "/owner.css",
      "/owner-ui.js", "/owner-core.js", "/availability-core.js", "/availability-ui.js"]) {
      const response = await h.request(route, { headers });
      assert.equal(response.status, 200, `${Host}${route}`);
      assert.equal(response.headers.location, undefined);
      assert.equal(response.headers["access-control-allow-origin"], undefined);
      assert.equal((await h.request(route, { method: "HEAD", headers })).status, 200);
    }
    assert.equal((await h.request("/activities", { headers: { Host } })).status, 200);
    const page = await h.request("/", { headers });
    assert.equal(page.status, 200);
    const csrf = page.text.match(/name="owner-csrf" content="([a-f0-9]+)"/)[1];
    const result = await h.post("/api/status", {}, { ...headers, "X-Owner-CSRF": csrf });
    assert.equal(result.status, 200);
    assert.equal(JSON.parse(result.text).status, "idle");
    assert.equal((await h.post("/api/load", { ...payload, acknowledged: false }, { ...headers, "X-Owner-CSRF": csrf })).status, 400);
  }
  assert.equal(calls, 0); assert.equal(reads, 0); assert.equal(clears, 0);
});

test("loopback compatibility rejects other ports, host spellings, origins and forwarded header injection", async t => {
  let calls = 0;
  const never = async () => { calls++; throw new Error("must not query"); };
  const h = await harness(t, never, { performAvailability: never });
  for (const Host of ["evil.test:8002", "localhost:8003", "127.0.0.1:8003", "localhost", "127.0.0.1",
    "localhost:08002", "127.0.0.2:8002", "127.1:8002", "[::1]:8002", "localhost.:8002",
    "LOCALHOST:8002", "localhost:8002.evil.test", "127.0.0.1:8002@evil.test", "localhost:8002,127.0.0.1:8002"]) {
    const headers = { Host, Origin: `http://${Host}` };
    assert.equal((await h.request("/activities", { headers })).status, 403, Host);
    assert.equal((await h.post("/api/availability", payload, headers)).status, 403, Host);
  }
  for (const Host of ["localhost:8002", "127.0.0.1:8002"]) {
    const other = Host.startsWith("localhost") ? "127.0.0.1:8002" : "localhost:8002";
    for (const Origin of [`http://${other}`, `https://${Host}`, "http://evil.test:8002",
      "http://localhost:8003", "http://127.0.0.1:8003", `http://${Host}/`, "null", ""]) {
      assert.equal((await h.request("/activities", { headers: { Host, Origin } })).status, 403);
      assert.equal((await h.post("/api/status", {}, { Host, Origin })).status, 403);
    }
    for (const name of ["Forwarded", "X-Forwarded-Host", "X-Forwarded-Proto", "X-Forwarded-Port", "X-Forwarded-For"]) {
      for (const value of ["localhost:8002", ""]) {
        const headers = { Host, Origin: `http://${Host}`, [name]: value };
        assert.equal((await h.request("/activities", { headers })).status, 403, name);
        assert.equal((await h.post("/api/status", {}, headers)).status, 403, name);
      }
    }
    assert.equal((await h.request("/activities", { headers: { Host, "Sec-Fetch-Site": "cross-site" } })).status, 403);
  }
  assert.equal(calls, 0);
});

test("CSRF sessions cannot cross loopback origins on any API or affect cache or session state", async t => {
  let calls = 0, reads = 0, clears = 0, approvedCalls = 0;
  const never = async () => { calls++; throw new Error("must not query"); };
  const h = await harness(t, async ({ record }) => { calls++; record("workflow_disabled"); return list; },
    { synthetic: true, performAvailability: never, storage: {
    read() { reads++; throw new Error("must not read"); }, clear() { clears++; throw new Error("must not clear"); }
  } });
  for (const Host of ["localhost:8002", "127.0.0.1:8002"]) {
    const page = await h.request("/", { headers: { Host } });
    assert.equal(page.status, 200);
    const csrf = page.text.match(/name="owner-csrf" content="([a-f0-9]+)"/)[1];
    const other = Host.startsWith("localhost") ? "127.0.0.1:8002" : "localhost:8002";
    const wrong = { Host: other, Origin: `http://${other}`, "X-Owner-CSRF": csrf };
    for (const [route, body] of [["/api/status", {}], ["/api/load", payload], ["/api/availability", payload],
      ["/api/availability", { ...payload, refresh: true }], ["/api/clear", {}],
      ["/api/clear", { reason: "leave" }], ["/api/fixture", { scenario: "empty" }]]) {
      const response = await h.post(route, body, wrong);
      assert.equal(response.status, 403, route);
      assert.deepEqual(JSON.parse(response.text), { status: "blocked" });
    }
    const right = { Host, Origin: `http://${Host}`, "X-Owner-CSRF": csrf };
    assert.equal((await h.post("/api/status", {}, right)).status, 200);
    assert.equal((await h.post("/api/availability", { ...payload, acknowledged: false }, right)).status, 400);
    assert.equal(calls, approvedCalls); // Rejected requests never reached either adapter.
    assert.equal((await h.post("/api/load", payload, right)).status, 200); // Session was not used or revoked.
    approvedCalls++;
  }
  assert.equal(calls, 2); assert.equal(reads, 0); assert.equal(clears, 0);
});

test("activity page and assets load without sessions, cache access or automatic backend calls", async t => {
  let calls = 0, reads = 0;
  const never = async () => { calls++; throw new Error("must not query"); };
  const storage = { read() { reads++; throw new Error("must not read"); }, clear() { throw new Error("must not clear"); } };
  const h = await harness(t, never, { performAvailability: never, storage });
  for (const route of ["/activities", "/activities/", "/activity-preview/core.js", "/activity-preview/ui.js", "/activity-preview/preview.css"]) {
    const response = await h.request(route);
    assert.equal(response.status, 200);
    assert.match(response.headers["content-security-policy"], /connect-src 'self'/);
    assert.match(response.headers["content-security-policy"], /form-action 'none'/);
    assert.equal(response.headers["set-cookie"], undefined);
    assert.doesNotMatch(response.text, /owner-csrf|OWNER_CSRF|owner-ui\.js|availability-ui\.js/);
    assert.equal((await h.request(route, { method: "HEAD" })).text, "");
    assert.equal((await h.request(route, { method: "POST", body: '{"ages":[8]}' })).status, 404);
  }
  for (const route of ["/activities?ages=8", "/activity-preview/serve.js", "/activity-preview/../owner/index.html", "/activity-preview/%2e%2e/owner/index.html", "/activity-preview/core.js?age=8"]) assert.equal((await h.request(route)).status, 404);
  assert.equal((await h.request("/activities", { headers: { Origin: "http://evil.test" } })).status, 403);
  // Repeated static activity pages must not exhaust the 32 owner-session limit.
  for (let i = 0; i < 35; i++) assert.equal((await h.request("/activities")).status, 200);
  const shell = await h.request("/shell.css");
  assert.equal(shell.status, 200);
  assert.equal(shell.headers["content-type"], "text/css; charset=utf-8");
  assert.equal(shell.headers["set-cookie"], undefined);
  assert.equal(shell.text, require("node:fs").readFileSync(require.resolve("../shell.css"), "utf8"));
  assert.equal((await h.request("/shell.css", { method: "HEAD" })).text, "");
  for (const route of ["/shell.css?x=1", "/../shell.css", "/%2e%2e/shell.css"])
    assert.equal((await h.request(route)).status, 404);
  assert.equal((await h.request("/shell.css", { method: "POST" })).status, 404);
  const activity = (await h.request("/activities")).text;
  assert.match(activity, /href="\/">Our week<\/a>/);
  assert.match(activity, /href="\/activities" aria-current="page">Activities<\/a>/);
  assert.equal((await h.request("/")).status, 200);
  assert.equal((await h.request("/demo")).text, require("node:fs").readFileSync(require.resolve("../index.html"), "utf8"));
  assert.equal(calls, 0); assert.equal(reads, 0);
});

test("reject missing acknowledgement, arbitrary body paths, huge bodies and malformed JSON before live work", async t => {
  let calls = 0; const h = await harness(t, async () => { calls++; });
  for (const body of [{}, { ...payload, acknowledged: false }, { ...payload, path: "/events" }, { ...payload, requestId: "x" },
    { ...payload, extra: "x".repeat(1000) }, []]) assert.equal((await h.post("/api/load", body)).status, 400);
  assert.equal(calls, 0);
});

test("one load per page and global single-flight through cleanup, success only after disable", async t => {
  let finish; let calls = 0;
  const pending = new Promise(resolve => { finish = resolve; });
  const h = await harness(t, async ({ record }) => { calls++; await pending; record("workflow_disabled"); return list; });
  const operation = h.post("/api/load", payload);
  // Event-loop rendezvous without sleeps or polling.
  await new Promise(resolve => h.server.once("request", () => setImmediate(resolve)));
  const secondPage = await h.request("/"); const secondCsrf = secondPage.text.match(/name="owner-csrf" content="([a-f0-9]+)"/)[1];
  assert.equal((await h.post("/api/load", payload, { "X-Owner-CSRF": secondCsrf })).status, 409);
  finish(); const result = await operation;
  assert.equal(result.status, 200); assert.equal(JSON.parse(result.text).cleanup, "workflow_disabled");
  assert.equal((await h.post("/api/load", payload)).status, 400); assert.equal(calls, 1);
});

test("clear aborts active load, awaits cleanup and fences late success", async t => {
  let started; const ready = new Promise(resolve => { started = resolve; });
  const h = await harness(t, async ({ signal, record }) => {
    started(); await new Promise(resolve => signal.addEventListener("abort", resolve, { once: true }));
    record("workflow_disabled"); return list;
  });
  const loading = h.post("/api/load", payload); await ready;
  const cleared = await h.post("/api/clear"); const response = await loading;
  assert.equal(JSON.parse(cleared.text).status, "cleared");
  assert.equal(JSON.parse(response.text).status, "cancelled"); assert.doesNotMatch(response.text, /calendars/);
  assert.equal((await h.post("/api/load", payload)).status, 400);
});

test("cleanup failure blocks new pages too; fixed failure survives status without leaking raw errors", async t => {
  const h = await harness(t, async ({ record }) => { record("cleanup_failed"); throw new OwnerFailure("cleanup_failed"); });
  const result = await h.post("/api/load", payload);
  assert.equal(JSON.parse(result.text).status, "cleanup_failed");
  const page = await h.request("/"); const csrf = page.text.match(/name="owner-csrf" content="([a-f0-9]+)"/)[1];
  const blocked = await h.post("/api/load", payload, { "X-Owner-CSRF": csrf });
  assert.equal(blocked.status, 503); assert.equal(JSON.parse(blocked.text).status, "cleanup_failed");
  assert.equal(JSON.parse((await h.post("/api/status")).text).status, "cleanup_failed");
});

test("session expiry, shutdown and unknown provider error fail closed", async t => {
  let now = 0; const h = await harness(t, async () => { throw new Error("private@example.test token=secret"); }, { now: () => now });
  const response = await h.post("/api/load", payload); assert.doesNotMatch(response.text, /private|secret/);
  now = 31 * 60 * 1000; assert.equal((await h.post("/api/status")).status, 403);
});

test("expired availability page reports local session rejection before any backend work", async t => {
  let now = 0, calls = 0;
  const perform = async () => { calls++; throw new Error("must not run"); };
  const h = await harness(t, perform, { now: () => now, performAvailability: perform });
  now = 130 * 60 * 1000;
  for (const route of ["/api/availability", "/api/status", "/api/clear", "/api/load"]) {
    const r = await h.post(route, route === "/api/load" || route === "/api/availability" ? payload : {});
    assert.equal(r.status, 403);
    assert.deepEqual(JSON.parse(r.text), { status: "blocked", reason: "session_unavailable" });
  }
  assert.equal(calls, 0);
  const page = await h.request("/"), csrf = page.text.match(/name="owner-csrf" content="([a-f0-9]+)"/)[1];
  const status = JSON.parse((await h.post("/api/status", {}, { "X-Owner-CSRF": csrf })).text);
  assert.equal(status.status, "idle"); assert.equal(status.cleanup, "not_requested");
  assert.equal(calls, 0); // Fresh page/status is not a retry.
});

test("session rejection never reveals cleanup state or clears a sticky failure on a fresh page", async t => {
  let now = 0, calls = 0;
  const perform = async ({ record }) => { calls++; record("cleanup_failed"); throw new OwnerFailure("cleanup_failed"); };
  const h = await harness(t, perform, { now: () => now, performAvailability: perform });
  await h.post("/api/availability", payload);
  now = 30 * 60 * 1000;
  assert.deepEqual(JSON.parse((await h.post("/api/status")).text), { status: "blocked", reason: "session_unavailable" });
  const page = await h.request("/"), csrf = page.text.match(/name="owner-csrf" content="([a-f0-9]+)"/)[1];
  const headers = { "X-Owner-CSRF": csrf };
  assert.equal(JSON.parse((await h.post("/api/status", {}, headers)).text).status, "cleanup_failed");
  assert.equal(JSON.parse((await h.post("/api/availability", payload, headers)).text).status, "cleanup_failed");
  assert.equal(calls, 1);
  const invalidOrigin = await h.post("/api/status", {}, { ...headers, Origin: "http://evil.test" });
  assert.deepEqual(JSON.parse(invalidOrigin.text), { status: "blocked" });
});

test("socket disconnect aborts the request and cannot publish late provider data", async t => {
  let started, finished;
  const ready = new Promise(resolve => { started = resolve; });
  const cleaned = new Promise(resolve => { finished = resolve; });
  const h = await harness(t, async ({ signal, record }) => {
    started(); await new Promise(resolve => signal.addEventListener("abort", resolve, { once: true }));
    record("workflow_disabled"); finished(); return list;
  });
  const req = http.request({ hostname: "127.0.0.1", port: h.server.address().port, path: "/api/load", method: "POST",
    headers: { Host: "localhost:8002", Origin: origin, "Content-Type": "application/json", "X-Owner-CSRF": h.csrf } });
  req.on("error", () => {}); req.end(JSON.stringify(payload)); await ready; req.destroy(); await cleaned;
  assert.equal(JSON.parse((await h.post("/api/status")).text).cleanup, "workflow_disabled");
  assert.equal((await h.post("/api/load", payload)).status, 400);
});

test("server shutdown aborts active work and waits for cleanup rather than clearing credentials early", async t => {
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  const h = await harness(t, async ({ signal, record }) => {
    started(); await new Promise(resolve => signal.addEventListener("abort", resolve, { once: true }));
    record("workflow_disabled"); return list;
  });
  const response = h.post("/api/load", payload).catch(() => null); await ready;
  const stopped = await h.server.shutdown(); await response;
  assert.equal(stopped.cleanup, "workflow_disabled"); assert.equal(stopped.cleanupFailed, false);
});

test("false success without verified cleanup is suppressed and blocks future loads", async t => {
  const h = await harness(t, async () => list);
  const response = await h.post("/api/load", payload);
  assert.equal(JSON.parse(response.text).status, "cleanup_failed"); assert.doesNotMatch(response.text, /calendars/);
});

const A = require("../owner/availability-core");
const snapshot = (window = A.window) => ({ window, checkedAt: "2026-09-15T01:00:00Z",
  people: [0, 1].map(person => ({ person, status: "checked", slots: Array(336).fill("busy") })) });
async function freshHeaders(h) {
  const page = await h.request("/");
  return { "X-Owner-CSRF": page.text.match(/name="owner-csrf" content="([a-f0-9]+)"/)[1] };
}
const verified = ({ record, recordContext, window }) => { recordContext("a".repeat(64)); record("workflow_disabled"); return snapshot(window); };

test("server keeps source row hidden before JavaScript and labels synthetic title and notice without adapter work", async t => {
  for (const synthetic of [true, false]) {
    let calls = 0, reads = 0;
    const never = async () => { calls++; throw new Error("No adapter work allowed"); };
    const h = await harness(t, never, { synthetic, performAvailability: never, searchBasketball: never,
      storage: { read() { reads++; throw new Error("No saved data read allowed"); }, clear() { throw new Error("No saved data clear allowed"); } } });
    assert.match(h.page.text, synthetic ? /<title>Family Copilot · SAMPLE calendars<\/title>/ : /<title>Family Copilot · Local owner calendars<\/title>/);
    assert.match(h.page.text, new RegExp(`<meta name="owner-mode" content="${synthetic ? "synthetic" : "live"}">`));
    // The extra accessible label deliberately prevents the unchanged backend's
    // legacy badge replacement. JS alone reveals the SAMPLE DATA row; live stays hidden.
    assert.match(h.page.text, /<div class="shell-source-row" id="owner-source-row" hidden><span class="shell-source" id="owner-source-badge" aria-label="Calendar source">Source not verified<\/span><\/div>/);
    assert.doesNotMatch(h.page.text, /Read-only calendar|id="(?:availability-diagnostic|owner-mode)"/);
    assert.match(h.page.text, synthetic ? /id="owner-source-notice">Sample data—not real calendars/ : /id="owner-source-notice">Local owner calendars/);
    assert.equal(calls, 0); assert.equal(reads, 0);
  }
});

test("built-in fixtures cannot be served under live mode; synthetic defaults never use the live list adapter", async t => {
  const availabilityFixture = require("../browser-fixtures/availability").perform;
  const ownerFixture = require("../browser-fixtures/owner").perform;
  assert.throws(() => createServer({ performAvailability: availabilityFixture }), /blocked/);
  assert.throws(() => createServer({ perform: ownerFixture }), /blocked/);
  const h = await harness(t, undefined, { synthetic: true });
  const data = JSON.parse((await h.post("/api/load", payload)).text);
  assert.equal(data.synthetic, true);
  assert.equal(data.cleanup, "workflow_disabled");
  assert.ok(Array.isArray(data.calendars));
});

test("RAM week hit across reload needs acknowledgement, never queries, preserves timestamp beyond 30 minutes", async t => {
  let calls = 0, now = 0;
  const h = await harness(t, async () => list, { now: () => now, performAvailability: async o => { calls++; return verified(o); } });
  const first = JSON.parse((await h.post("/api/availability", payload)).text);
  assert.equal(first.cached, false); assert.equal(calls, 1);
  await h.post("/api/clear", { reason: "leave" });
  now = 24 * 60 * 60 * 1000; // Retention is NOT the page-session lifetime.
  const headers = await freshHeaders(h);
  assert.equal(calls, 1);
  assert.equal((await h.post("/api/availability", { ...payload, acknowledged: false }, headers)).status, 400);
  const hit = JSON.parse((await h.post("/api/availability", payload, headers)).text);
  assert.equal(hit.cached, true); assert.equal(hit.checkedAt, first.checkedAt); assert.deepEqual(hit.people, first.people);
  assert.match(A.freshness(hit, Date.parse(hit.checkedAt) + 86400000), /Stale/); assert.equal(calls, 1);
  assert.equal((await h.post("/api/availability", payload)).status, 403);
});

test("cached week cannot bypass Host, Origin, CSRF, expired session or local revocation", async t => {
  let calls = 0;
  const h = await harness(t, async () => list, { performAvailability: async o => { calls++; return verified(o); } });
  await h.post("/api/availability", payload);
  for (const headers of [{ Origin: "http://evil.test" }, { Host: "evil.test" }, { "X-Owner-CSRF": "bad" }]) {
    const r = await h.post("/api/availability", payload, headers);
    assert.equal(r.status, 403); assert.doesNotMatch(r.text, /people|checkedAt|slots/);
  }
  await h.post("/api/clear", { reason: "leave" });
  assert.equal((await h.post("/api/availability", payload)).status, 400);
  const headers = await freshHeaders(h);
  assert.equal(JSON.parse((await h.post("/api/availability", payload, headers)).text).cached, true);
  assert.equal(calls, 1);
});

test("explicit repeated Refresh bypasses RAM, drops extra fields, and never overlaps", async t => {
  let calls = 0;
  const h = await harness(t, async () => list, { performAvailability: async o => {
    calls++; const d = verified(o); d.checkedAt = `2026-09-15T01:0${calls}:00Z`; d.subject = "PRIVATE"; d.people[0].address = "PRIVATE"; return d;
  } });
  for (let i = 1; i <= 3; i++) {
    const r = await h.post("/api/availability", { ...payload, refresh: true });
    assert.equal(r.status, 200); assert.equal(JSON.parse(r.text).cached, false); assert.equal(calls, i);
    assert.doesNotMatch(r.text, /PRIVATE|subject|address/);
  }
  assert.equal(JSON.parse((await h.post("/api/availability", payload)).text).cached, true); assert.equal(calls, 3);
  assert.equal((await h.post("/api/load", { ...payload, refresh: true })).status, 400); // List remains unchanged.
});

test("Clear from a fresh unloaded page erases shared RAM; restart cannot restore a snapshot", async t => {
  let calls = 0; const performAvailability = async o => { calls++; return verified(o); };
  const h = await harness(t, async () => list, { performAvailability });
  await h.post("/api/availability", payload);
  await h.post("/api/clear", {}, await freshHeaders(h));
  const r = JSON.parse((await h.post("/api/availability", payload, await freshHeaders(h))).text);
  assert.equal(r.cached, false); assert.equal(calls, 2);
  const restarted = await harness(t, async () => list, { performAvailability });
  assert.equal(JSON.parse((await restarted.post("/api/availability", payload)).text).cached, false); assert.equal(calls, 3);
});

test("cross-session Clear aborts refresh and fences late writer before waiting for disable", async t => {
  let calls = 0, started;
  const ready = new Promise(resolve => { started = resolve; });
  const h = await harness(t, async () => list, { performAvailability: async o => {
    calls++;
    if (calls === 2) { started(); await new Promise(resolve => o.signal.addEventListener("abort", resolve, { once: true })); }
    return verified(o);
  } });
  await h.post("/api/availability", payload);
  const headers = await freshHeaders(h), loading = h.post("/api/availability", { ...payload, refresh: true });
  await ready;
  assert.equal((await h.post("/api/availability", payload, headers)).status, 409);
  assert.equal(JSON.parse((await h.post("/api/clear", {}, headers)).text).status, "cleared");
  const late = await loading; assert.equal(JSON.parse(late.text).status, "cancelled"); assert.doesNotMatch(late.text, /people|slots/);
  assert.equal(JSON.parse((await h.post("/api/availability", payload, await freshHeaders(h))).text).cached, false);
  assert.equal(calls, 3);
});

test("failed Refresh erases snapshot without fallback; known auth/contract failures stay fail closed", async t => {
  for (const code of ["revoked", "contract_drift", "expired", "unavailable"]) {
    let calls = 0;
    const h = await harness(t, async () => list, { performAvailability: async o => {
      calls++; if (calls === 2) throw new OwnerFailure(code); return verified(o);
    } });
    await h.post("/api/availability", payload);
    const failed = await h.post("/api/availability", { ...payload, refresh: true });
    assert.equal(JSON.parse(failed.text).status, code); assert.doesNotMatch(failed.text, /people|slots|checkedAt/);
    const next = JSON.parse((await h.post("/api/availability", payload, await freshHeaders(h))).text);
    assert.equal(next.cached, false); assert.equal(calls, 3);
  }
});

test("partial context is cached as unknown, malformed/failed responses never cached, cleanup failure blocks hits", async t => {
  for (const scenario of ["partial", "invalid", "failed", "cleanup"]) {
    let calls = 0;
    const h = await harness(t, async () => list, { performAvailability: async o => {
      calls++; const d = verified(o);
      if (scenario === "cleanup" && calls === 2) { o.record("cleanup_failed"); throw new OwnerFailure("cleanup_failed"); }
      if (scenario === "partial") d.people[1] = A.unknown(1, "unavailable");
      if (scenario === "invalid") d.people[0].slots.pop();
      if (scenario === "failed") d.people = [A.unknown(0, "unavailable"), A.unknown(1, "unavailable")];
      return d;
    } });
    await h.post("/api/availability", payload);
    if (scenario === "cleanup") await h.post("/api/availability", { ...payload, refresh: true });
    const result = JSON.parse((await h.post("/api/availability", payload, await freshHeaders(h))).text);
    if (scenario === "cleanup") { assert.equal(result.status, "cleanup_failed"); assert.equal(calls, 2); }
    else { assert.equal(result.cached, scenario === "partial"); assert.equal(calls, scenario === "partial" ? 1 : 2);
      assert.ok(result.people[scenario === "invalid" ? 0 : 1].slots.every(s => s === "unknown")); }
  }
});

test("single snapshot key binds context and week; clear fences generation and returned objects are copies", () => {
  const { createSnapshotCache } = require("../scripts/availability-cache");
  const c = createSnapshotCache(), d = snapshot();
  assert.equal(c.put(null, d, c.generation), false); // No verified owner/config context, no cache.
  assert.equal(c.put("caller-config-v1", d, c.generation), true);
  const hit = c.get("caller-config-v1"); hit.people[0].slots[0] = "free_or_elsewhere";
  assert.equal(c.get("caller-config-v1").people[0].slots[0], "busy");
  assert.equal(c.get("other-person-config"), null); assert.equal(c.get("caller-config-v1"), null);
  assert.throws(() => c.put("caller-config-v1", { ...d, window: { ...d.window, start: "2026-09-14T16:00:00Z" } }, c.generation));
  const generation = c.generation; c.clear(); assert.equal(c.put("caller-config-v1", d, generation), false);
});

function diskFixture(t, io) {
  const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
  const { createDiskStore, localBinding } = require("../scripts/availability-disk-cache");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "familycopilot-server-test-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return { directory, filename: path.join(directory, "owner-availability.json"),
    storage: () => createDiskStore({ directory, binding: localBinding({ mode: "synthetic-test" }), io }) };
}

test("disk restart hit requires new CSRF and acknowledgement, no startup I/O/provider, Refresh replaces, Clear removes", async t => {
  let calls = 0, reads = 0, now = 0;
  const fs = require("node:fs");
  const f = diskFixture(t, { ...fs, readSync(...args) { reads++; return fs.readSync(...args); } });
  const performAvailability = async o => { calls++; const d = verified(o); d.checkedAt = `2026-09-15T01:0${calls}:00Z`; return d; };
  const h = await harness(t, async () => list, { storage: f.storage(), performAvailability, now: () => now });
  assert.match(h.page.text, /name="owner-cache" content="disk"/);
  assert.equal(reads, 0); assert.equal(calls, 0);
  const first = JSON.parse((await h.post("/api/availability", payload)).text);
  await h.post("/api/clear", { reason: "leave" }); await h.server.shutdown();
  assert.equal(fs.existsSync(f.filename), true);
  now = 31 * 60000;
  const next = await harness(t, async () => list, { storage: f.storage(), performAvailability, now: () => now });
  assert.equal(reads, 0); assert.equal(calls, 1);
  await next.post("/api/status"); assert.equal(reads, 0);
  for (const headers of [{ "X-Owner-CSRF": h.csrf }, { Origin: "http://evil.test" }, { Host: "evil.test" }])
    assert.equal((await next.post("/api/availability", payload, headers)).status, 403);
  assert.equal((await next.post("/api/availability", { ...payload, acknowledged: false })).status, 400);
  assert.equal(reads, 0);
  const hit = JSON.parse((await next.post("/api/availability", payload)).text);
  assert.equal(hit.cached, true); assert.equal(hit.checkedAt, first.checkedAt); assert.equal(calls, 1);
  assert.match(A.freshness(hit, Date.parse(hit.checkedAt) + 31 * 60000), /Stale/);
  const fresh = JSON.parse((await next.post("/api/availability", { ...payload, refresh: true })).text);
  assert.equal(fresh.cached, false); assert.notEqual(fresh.checkedAt, hit.checkedAt); assert.equal(calls, 2);
  assert.equal(f.storage().read().data.checkedAt, fresh.checkedAt);
  await next.post("/api/clear", {}, await freshHeaders(next)); assert.equal(fs.existsSync(f.filename), false);
  await next.server.shutdown();
  const empty = await harness(t, async () => list, { storage: f.storage(), performAvailability });
  assert.equal(JSON.parse((await empty.post("/api/availability", payload)).text).cached, false); assert.equal(calls, 3);
});

test("disk corruption and storage failures are distinct safe statuses with no implicit provider fallback", async t => {
  const fs = require("node:fs");
  for (const scenario of ["corrupt", "read", "write", "clear"]) {
    let calls = 0, fail = false;
    const denied = () => { throw Object.assign(new Error("PRIVATE"), { code: "EACCES" }); };
    const f = diskFixture(t, { ...fs,
      readSync(...a) { if (fail && scenario === "read") denied(); return fs.readSync(...a); },
      writeFileSync(...a) { if (fail && scenario === "write") denied(); return fs.writeFileSync(...a); },
      unlinkSync(...a) { if (fail && scenario === "clear") denied(); return fs.unlinkSync(...a); }
    });
    f.storage().write("a".repeat(64), snapshot());
    if (scenario === "corrupt") fs.writeFileSync(f.filename, "{");
    fail = true;
    const h = await harness(t, async () => list, { storage: f.storage(), performAvailability: async o => { calls++; return verified(o); } });
    const r = await h.post("/api/availability", { ...payload, refresh: ["write", "clear"].includes(scenario) });
    assert.equal(r.status, 503);
    assert.equal(JSON.parse(r.text).status, ({ corrupt: "cache_invalid", read: "cache_unavailable", write: "cache_unavailable", clear: "cache_clear_failed" })[scenario]);
    assert.doesNotMatch(r.text, /PRIVATE|people|slots|checkedAt/);
    assert.equal(calls, scenario === "write" ? 1 : 0);
    assert.equal((await h.post("/api/availability", payload, await freshHeaders(h))).status, 503);
    assert.equal(calls, scenario === "write" ? 1 : 0);
    fail = false; assert.equal(JSON.parse((await h.post("/api/clear")).text).status, "cleared");
  }
});

test("disk cross-session Clear fences late provider result before async cleanup and restart cannot resurrect it", async t => {
  let started, finish;
  const ready = new Promise(r => { started = r; }), wait = new Promise(r => { finish = r; });
  const f = diskFixture(t), fs = require("node:fs");
  const h = await harness(t, async () => list, { storage: f.storage(), performAvailability: async o => {
    started(); await wait; return verified(o);
  } });
  const other = await freshHeaders(h), loading = h.post("/api/availability", payload); await ready;
  const cleared = h.post("/api/clear", {}, other);
  await new Promise(resolve => h.server.once("request", () => setImmediate(resolve)));
  assert.equal(fs.existsSync(f.filename), false);
  finish(); assert.equal(JSON.parse((await cleared).text).status, "cleared");
  assert.equal(JSON.parse((await loading).text).status, "cancelled");
  await h.server.shutdown(); assert.equal(f.storage().read(), null);
});

test("disk failed Refresh and known auth/list or cleanup failures never survive restart as an old snapshot", async t => {
  for (const code of ["revoked", "contract_drift", "expired", "unavailable", "cleanup_failed"]) {
    const f = diskFixture(t); f.storage().write("a".repeat(64), snapshot());
    const h = await harness(t, async () => { throw new OwnerFailure(code); }, { storage: f.storage(),
      performAvailability: async o => { if (code === "cleanup_failed") o.record("cleanup_failed"); throw new OwnerFailure(code); } });
    const r = await h.post(code === "revoked" ? "/api/load" : "/api/availability", code === "revoked" ? payload : { ...payload, refresh: true });
    assert.equal(JSON.parse(r.text).status, code); assert.doesNotMatch(r.text, /people|slots/);
    await h.server.shutdown(); assert.equal(f.storage().read(), null);
  }
});

test("Clear I/O failure still aborts asynchronous work and cannot let a late writer clear the sticky failure", async t => {
  const fs = require("node:fs");
  let fail = false, started, finish;
  const ready = new Promise(r => { started = r; }), wait = new Promise(r => { finish = r; });
  const f = diskFixture(t, { ...fs, lstatSync(...args) {
    if (fail) throw Object.assign(new Error("PRIVATE"), { code: "EACCES" });
    return fs.lstatSync(...args);
  } });
  const h = await harness(t, async () => list, { storage: f.storage(), performAvailability: async o => {
    started(); await wait; return verified(o);
  } });
  const other = await freshHeaders(h), loading = h.post("/api/availability", payload); await ready;
  fail = true;
  const clearing = h.post("/api/clear", {}, other);
  await new Promise(resolve => h.server.once("request", () => setImmediate(resolve)));
  finish();
  assert.equal(JSON.parse((await clearing).text).status, "cache_clear_failed");
  const late = await loading;
  assert.equal(JSON.parse(late.text).status, "cache_clear_failed"); assert.doesNotMatch(late.text, /people|slots|PRIVATE/);
  assert.equal(JSON.parse((await h.post("/api/status")).text).status, "cache_clear_failed");
  fail = false;
  assert.equal(f.storage().read(), null);
  assert.equal(JSON.parse((await h.post("/api/clear")).text).status, "cleared");
});