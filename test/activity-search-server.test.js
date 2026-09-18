"use strict";
// All source reads are injected. Never use the live TPBL transport in this suite.
const test = require("node:test"), assert = require("node:assert/strict");
const http = require("node:http"), https = require("node:https");
const { once } = require("node:events");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
test.mock.method(https, "get", () => { throw new Error("Live transport forbidden in offline tests"); });
const { createActivitySearchServer, parseArguments } = require("../activity-preview/serve-search");
const { createPreviewServer } = require("../activity-preview/serve");
const { searchBasketball } = require("../scripts/basketball");
const T = require("../shared/basketball-teams");
const { activityDOM, text } = require("./fixtures/activity-dom");
const dates = { startDate: "2026-10-09", endDate: "2026-10-15" };
const seasons = [{ id: 3, name: "2026-2027 synthetic", started_at: "2026-10-01 00:00:00", ended_at: "2027-05-16 00:00:00" }];
const row = (id, changes = {}) => ({ id, game_date: "2026-10-09", game_time: "15:00:00", gamed_at: "2026-10-09 15:00:00",
  home_team: { id: 1, name: "Synthetic Home" }, away_team: { id: 2, name: "Synthetic Away" }, venue: "Synthetic Arena", status: "NOT_STARTED", ...changes });
async function harness(t, search, now = Date.now) {
  const server = createActivitySearchServer({ search, now });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  t.after(() => server.shutdown());
  const port = server.address().port;
  const request = (url, { method = "GET", headers = {}, body, signal } = {}) => new Promise((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port, path: url, method, agent: false, signal,
      headers: { Host: `127.0.0.1:${port}`, ...headers } }, res => {
      let text = ""; res.on("data", chunk => { text += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, text, headers: res.headers }));
      res.on("error", reject);
    }); req.on("error", reject); req.end(body);
  });
  const post = (body = JSON.stringify(dates), headers = {}, signal) => request("/api/activities/basketball", {
    method: "POST", body, signal, headers: { Origin: `http://127.0.0.1:${port}`, "Content-Type": "application/json", ...headers }
  });
  return { server, request, post, port };
}
test("standalone page and every referenced asset work with zero startup/source calls", { timeout: 10000 }, async t => {
  let calls = 0;
  const h = await harness(t, async () => { calls++; throw Error("unexpected"); });
  for (const url of ["/", "/index.html", "/activities", "/activities/"]) {
    const page = await h.request(url);
    assert.equal(page.status, 200); assert.match(page.text, /Independent activity search/);
    assert.doesNotMatch(page.text, /data-preview="true"|ACTIVITY_WEEK|href="\/">Our week|8002|owner-csrf/);
    assert.match(page.text, /Dates stay in this activity tab/);
    assert.doesNotMatch(page.text, /id="(?:activity-start|activity-end|reset-dates|calendar-dates-link|change-activity-dates)"/);
    assert.match(page.text, /does not receive Calendar changes/);
    assert.match(page.headers["content-security-policy"], /connect-src 'self'/);
    assert.equal(page.headers["cache-control"], "no-store"); assert.equal(page.headers["set-cookie"], undefined);
    for (const [, asset] of page.text.matchAll(/(?:src|href)="(\/[^"#]+\.(?:js|css))"/g)) {
      const result = await h.request(asset); assert.equal(result.status, 200, asset);
      assert.match(result.headers["content-type"], asset.endsWith(".css") ? /^text\/css/ : /^text\/javascript/);
    }
  }
  assert.equal((await h.request("/activities", { method: "HEAD" })).text, "");
  const health = await h.request("/health"); assert.equal(health.status, 200);
  assert.deepEqual(JSON.parse(health.text), { service: "activity-search", teamContract: T.contract });
  assert.equal(calls, 0);
});
test("exact Host/Origin and forwarded-header gates block every route before source work", { timeout: 10000 }, async t => {
  let calls = 0; const h = await harness(t, async () => { calls++; return {}; });
  for (const headers of [{ Host: "evil.test" }, { Host: "localhost:8002" }, { Host: `localhost:${h.port}.evil.test` },
    { Origin: "null" }, { Origin: "http://evil.test" }, { Origin: `http://localhost:${h.port}` },
    { Forwarded: "" }, { "X-Forwarded-Host": "" }, { "X-Forwarded-For": "127.0.0.1" }, { "Sec-Fetch-Site": "cross-site" }]) {
    assert.equal((await h.request("/activities", { headers })).status, 403);
    assert.equal((await h.post(JSON.stringify(dates), headers)).status, 403);
  }
  for (const headers of [{ Origin: "" }, { "Content-Type": "text/plain" }, { "Content-Encoding": "gzip" }]) {
    assert.equal((await h.post(JSON.stringify(dates), headers)).status, 403);
  }
  for (const method of ["GET", "HEAD", "OPTIONS", "PUT"]) assert.equal((await h.request("/api/activities/basketball", { method })).status, 403);
  assert.equal((await h.request("/activities", { method: "POST" })).status, 405);
  assert.equal(calls, 0);
  const result = await h.post(JSON.stringify(dates), { Host: `localhost:${h.port}`, Origin: `http://localhost:${h.port}` });
  assert.equal(result.status, 200); assert.equal(result.headers["access-control-allow-origin"], undefined);
});
test("no Auth/private routes, proxy, repository exposure or unbounded request paths", { timeout: 10000 }, async t => {
  let calls = 0; const h = await harness(t, async () => { calls++; });
  for (const url of ["/api/status", "/api/availability", "/api/calendars", "/api/child/calendars", "/owner/ui.js", "/owner/index.html",
    "/scripts/serve-owner.js", "/.env", "/.git/config", "/../README.md", "/%2e%2e/README.md", "/activities?url=http://localhost:8002/", "/api/activities/basketball?next=1"]) {
    assert.equal((await h.request(url)).status, 404, url);
  }
  for (const body of ["{}", "null", "[]", "bad", " ".repeat(20001), JSON.stringify({ ...dates, ages: [8] }),
    JSON.stringify({ ...dates, url: "http://localhost:8002/" }), JSON.stringify({ ...dates, endDate: "2026-10-16" }),
    JSON.stringify({ ...dates, teamIds: ["invalid"] })]) assert.equal((await h.post(body)).status, 400);
  assert.equal(calls, 0);
});
test("standalone API reuses real TPBL adapter with offline reads and filters before40", { timeout: 10000 }, async t => {
  const calls = [];
  const h = await harness(t, options => searchBasketball({ ...options, request: async source => {
    calls.push(source);
    return source === "/api/seasons" ? seasons : [...Array.from({ length: 45 }, (_, i) => row(i + 1)),
      row(46, { home_team: { id: 99, name: "Synthetic Falcons" } }), row(47, { away_team: { id: 99, name: "Synthetic Falcons" } })];
  } }));
  const selection = T.selection([T.preferredTeam("synthetic FALCONS").key], "only");
  const result = await h.post(JSON.stringify({ ...dates, ...selection }));
  assert.equal(result.status, 200); const data = JSON.parse(result.text);
  assert.equal(data.teamContract, T.contract); assert.deepEqual(data.teamSelection, selection);
  assert.equal(data.week.firstDate, dates.startDate); assert.equal(data.week.lastDate, dates.endDate);
  assert.deepEqual(data.games.map(game => game.id), ["tpbl-46", "tpbl-47"]);
  assert.equal(data.sources[0].matchedCount, 2); assert.equal(data.sources[0].eligibleCount, 47);
  assert.deepEqual(calls, ["/api/seasons", "/api/seasons/3/games"]);
});
test("empty, partial, outside coverage and unavailable stay distinct without live fallback", { timeout: 10000 }, async t => {
  for (const [rows, status] of [[[], "outside_coverage"], [[row(1, { status: "COMPLETED" })], "no_matches"],
    [[row(1), row(2, { game_time: "bad" })], "partial"], [null, "unavailable"]]) {
    const h = await harness(t, options => searchBasketball({ ...options, request: async source => {
      if (rows === null) throw Error("sensitive source failure");
      return source === "/api/seasons" ? seasons : rows;
    } }));
    // One-day range permits a complete retrieved empty/completed day.
    const result = await h.post(JSON.stringify({ ...dates, endDate: dates.startDate }));
    assert.equal(result.status, 200); const data = JSON.parse(result.text);
    assert.equal(data.sources[0].status, status); assert.equal(data.sources[1].status, "not_searched");
    assert.doesNotMatch(result.text, /sensitive/);
  }
});
test("served page through both real UI controllers and HTTP searches only on Find", { timeout: 10000 }, async t => {
  let calls = 0;
  const h = await harness(t, async options => {
    calls++; const data = await searchBasketball({ ...options, request: async source => source === "/api/seasons" ? seasons : [row(1, { home_team: { id: 1, name: "<img onerror=evil>" } })] });
    return { ...data, synthetic: true };
  });
  const page = await h.request("/activities");
  const contextWeek = JSON.parse(page.text.match(/name="activity-week" content='([^']+)'/)[1]);
  const ui = activityDOM(async (url, options) => {
    assert.equal(url, "/api/activities/basketball"); const result = await h.post(options.body, {}, options.signal);
    return { ok: result.status === 200, status: result.status, json: async () => JSON.parse(result.text) };
  }, { contextWeek, preview: page.text.includes('data-preview="true"') });
  await ui.category("sports"); await ui.sport("basketball"); await ui.addTeam("<img onerror=evil>");
  assert.equal(calls, 0); await ui.click("find"); assert.equal(calls, 1);
  assert.equal(ui.get("basketball-games").children.length, 1); assert.equal(ui.focus.id, "basketball-title");
  assert.match(text(ui.get("basketball-games")), /Synthetic test data/);
  assert.equal(ui.get("basketball-games").querySelectorAll("img").length, 0);
  assert.match(text(ui.get("basketball-games")), /<img onerror=evil>/);
  await ui.click("reset"); assert.equal(ui.get("basketball-games").children.length, 0); assert.equal(calls, 1);
});
test("independent route preserves single-flight, cooldown and client cancellation", { timeout: 10000 }, async t => {
  let started, finish, signal, now = 10000, calls = 0;
  const ready = new Promise(resolve => { started = resolve; });
  const h = await harness(t, options => {
    calls++; if (calls > 1) return Promise.resolve({ games: [] });
    signal = options.signal; started(); return new Promise(resolve => { finish = resolve; });
  }, () => now);
  const controller = new AbortController();
  const pending = h.post(undefined, {}, controller.signal); const rejected = assert.rejects(pending);
  await ready; assert.equal((await h.post()).status, 429);
  const aborted = once(signal, "abort"); controller.abort(); await rejected; await aborted;
  assert.equal(signal.aborted, true); finish({ games: ["late fixture"] });
  assert.equal((await h.post()).status, 429); assert.equal(calls, 1);
  now += 5000;
  assert.equal((await h.post()).status, 200); assert.equal(calls, 2);
});
test("shutdown is idempotent, cancels active source work and rejects late output", { timeout: 10000 }, async t => {
  let started, finish, signal; const ready = new Promise(resolve => { started = resolve; });
  const h = await harness(t, options => { signal = options.signal; started(); return new Promise(resolve => { finish = resolve; }); });
  const pending = h.post(); const rejected = assert.rejects(pending); await ready;
  const shutdown = h.server.shutdown(); assert.equal(signal.aborted, true);
  assert.equal(h.server.shutdown(), shutdown); finish({ games: ["late fixture"] });
  await shutdown; await rejected; assert.equal(h.server.listening, false);
});
test("offline preview is retained separately with no public API or relaxed CSP", { timeout: 10000 }, async t => {
  const server = createPreviewServer(); server.listen(0, "127.0.0.1"); await once(server, "listening");
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const port = server.address().port;
  const request = method => new Promise((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port, path: method === "GET" ? "/activities" : "/api/activities/basketball", method, agent: false }, res => {
      let text = ""; res.on("data", c => { text += c; }); res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, text }));
    }); req.on("error", reject); req.end();
  });
  const page = await request("GET"); assert.match(page.text, /data-preview="true"/);
  assert.match(page.headers["content-security-policy"], /connect-src 'none'/); assert.equal((await request("POST")).status, 405);
});
test("launcher requires an explicit non8002 assigned port and live mode, without replacing listeners", { timeout: 10000 }, async t => {
  for (const args of [[], ["--live"], ["--port=8030"], ["--live", "--port=8002"], ["--live", "--port=0"],
    ["--live", "--port=65536"], ["--live", "--port=8030", "--host=0.0.0.0"], ["--live", "--port=8030", "--port=8031"]]) assert.throws(() => parseArguments(args));
  assert.deepEqual(parseArguments(["--port=8030", "--live"]), { port: 8030 });
  const h = await harness(t, async () => { throw Error("never"); });
  const result = spawnSync(process.execPath, [path.join(__dirname, "../activity-preview/serve-search.js"), "--live", `--port=${h.port}`], { encoding: "utf8", timeout: 5000 });
  assert.equal(result.status, 1); assert.match(result.stderr, /Existing listeners were not changed/);
  assert.equal((await h.request("/health")).status, 200);
});
test("standalone module graph never imports owner/Auth/cache or shared activation code", () => {
  const visited = new Set();
  function walk(module) { if (visited.has(module.filename)) return; visited.add(module.filename); module.children.forEach(walk); }
  walk(require.cache[require.resolve("../activity-preview/serve-search")]);
  for (const filename of visited) {
    const relative = path.relative(path.join(__dirname, ".."), filename).replaceAll("\\", "/");
    if (relative === "owner/availability-core.js") continue; // Pure shared date utility only.
    assert.doesNotMatch(relative, /^(?:owner|picker|infra)\/|(?:auth|cache|serve-owner|owner-operation|activat)/i, relative);
  }
});