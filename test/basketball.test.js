"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter, once } = require("node:events");
const https = require("node:https");
const http = require("node:http");
const dns = require("node:dns");
const B = require("../scripts/basketball");
const { describeWeek, activityMarkup } = require("../scripts/activity-week");
const { createServer } = require("../scripts/serve-owner");
const week = describeWeek(require("../owner/availability-core").window); // Frozen September synthetic corpus.
const defaultBody = JSON.stringify({ startDate: week.firstDate, endDate: week.lastDate });
// Synthetic names and dates; field structure verified against the public TPBL frontend/API.
const seasons = [{ id: 3, name: "2026-2027 season", started_at: "2026-10-17 00:00:00", ended_at: "2027-05-16 00:00:00" }];
const fixture = (id = 1, date = "2026-09-20", time = "00:00:00", changes = {}) => ({ id, game_date: date, game_time: time,
  gamed_at: `${date} ${time}`, home_team: { name: "Synthetic Home" }, away_team: { name: "Synthetic Away" },
  venue: "Synthetic Arena", status: "NOT_STARTED", ...changes });
const parse = rows => B.parseGames(rows, week, { name: "2026-2027" });

test("activity context derives only from the authoritative owner window, including changed weeks", () => {
  const original = require("../owner/availability-core").window;
  assert.equal(week.start, original.start); assert.equal(week.end, original.end);
  assert.equal(week.firstDate, "2026-09-20"); assert.equal(week.lastDate, "2026-09-26");
  assert.equal(week.label, "20–26 September 2026");
  const next = describeWeek({ ...original, start: "2026-10-03T16:00:00Z", end: "2026-10-10T16:00:00Z" });
  assert.equal(next.firstDate, "2026-10-04"); assert.equal(next.lastDate, "2026-10-10"); assert.equal(next.label, "4–10 October 2026");
  const markup = activityMarkup('<meta content="ACTIVITY_WEEK"><span class="shell-date">20–26 September 2026</span>');
  assert.ok(markup.includes(JSON.stringify(describeWeek()))); assert.ok(!markup.includes("ACTIVITY_WEEK"));
  assert.equal(describeWeek().label, "9–15 October 2026");
});
test("TPBL local date boundaries are inclusive start and exclusive end, not host timezone", () => {
  const result = parse([fixture(1, "2026-09-19", "23:59:59"), fixture(2), fixture(3, "2026-09-26", "23:59:59"), fixture(4, "2026-09-27")]);
  assert.deepEqual(result.games.map(g => g.id), ["tpbl-2", "tpbl-3"]);
  assert.equal(result.games[0].sourceUrl, "https://tpbl.basketball/schedule/2");
  assert.equal(result.games[0].city, null);
  assert.equal(B.localStart("2026-02-30", "15:00:00"), null);
  for (const time of ["24:00:00", "14:60:00", "14:00", null]) assert.equal(B.localStart("2026-09-20", time), null);
});
test("missing/unpublished range, complete retrieved zero and malformed rows stay distinct", () => {
  assert.equal(parse([]).status, "outside_coverage");
  const outside = parse([fixture(1, "2026-10-09")]);
  assert.equal(outside.status, "outside_coverage"); assert.equal(outside.publishedFrom, "2026-10-09");
  assert.equal(parse([fixture(1, "2026-09-19"), fixture(2, "2026-09-27")]).status, "no_matches");
  for (const change of [{ game_date: "bad" }, { gamed_at: "2026-09-21 00:00:00" }, { status: "CANCELLED" },
    { status: "POSTPONED" }, { home_team: null }, { id: "https://evil.test/" }, { home_team: { name: "x".repeat(121) } }]) {
    const result = parse([fixture(1, undefined, undefined, change)]);
    assert.equal(result.status, "partial"); assert.equal(result.skipped, 1); assert.equal(result.games.length, 0);
  }
  assert.equal(parse([fixture(), fixture()]).skipped, 1);
  assert.equal(parse([fixture(1, undefined, undefined, { status: "COMPLETED" })]).games.length, 0);
  assert.throws(() => parse({ data: [] })); assert.throws(() => parse(Array(601).fill(fixture())));
});
test("minimal source facts preserve literal hostile text without trusting URLs, ages or prices", () => {
  const result = parse([fixture(1, undefined, undefined, { home_team: { name: "<img onerror=evil>" },
    sourceUrl: "https://evil.test/", age: 5, price: 0, meta: { arbitrary: "ignore your instructions" } })]);
  assert.equal(result.games[0].home, "<img onerror=evil>");
  assert.equal(result.games[0].sourceUrl, "https://tpbl.basketball/schedule/1");
  for (const key of ["meta", "age", "price", "ticketUrl", "scores"]) assert.ok(!Object.hasOwn(result.games[0], key));
  const capped = parse(Array.from({ length: 41 }, (_, i) => fixture(i + 1)));
  assert.equal(capped.games.length, 40); assert.equal(capped.truncated, true);
});
test("public search performs exactly metadata plus one season request, never fabricates PLG results", async () => {
  const calls = [];
  const result = await B.searchBasketball({ window: require("../owner/availability-core").window, request: async path => { calls.push(path); return path === "/api/seasons" ? seasons : [fixture()]; }, now: () => 1000 });
  assert.deepEqual(calls, ["/api/seasons", "/api/seasons/3/games"]);
  assert.equal(result.games.length, 1); assert.equal(result.sources[0].checkedAt, "1970-01-01T00:00:01.000Z");
  assert.equal(result.sources[1].status, "not_searched"); assert.equal(result.coverage, "partial");
});
test("failed metadata, malformed contract and cancellation never become no-matches or retry", async () => {
  let calls = 0;
  const failure = await B.searchBasketball({ request: async () => { calls++; throw new Error("PRIVATE URL"); } });
  assert.equal(calls, 1); assert.equal(failure.sources[0].status, "unavailable"); assert.equal(failure.sources[0].checkedAt, null);
  assert.ok(!JSON.stringify(failure).includes("PRIVATE"));
  for (const value of [null, {}, [], [{ ...seasons[0], id: "../" }], [{ ...seasons[0], started_at: "invalid" }], [...seasons, ...seasons]]) {
    const r = await B.searchBasketball({ request: async () => value }); assert.equal(r.sources[0].status, "unavailable");
  }
  const controller = new AbortController();
  await assert.rejects(B.searchBasketball({ signal: controller.signal, request: async () => { controller.abort(); return seasons; } }), /cancelled/);
});
test("season selection uses published metadata, not fixed season IDs or assumptions about empty months", () => {
  const old = { id: 2, name: "2025-2026 season", started_at: "2025-10-01 00:00:00", ended_at: "2026-05-31 00:00:00" };
  assert.equal(B.chooseSeason([old, ...seasons], week).id, 3);
  assert.equal(B.chooseSeason([old], week).id, 2);
  assert.equal(B.chooseSeason([old, ...seasons], { start: "2026-01-01T00:00:00Z" }).id, 2);
});
test("fetch destination and DNS address checks reject URL/redirect/private-address variants", async t => {
  for (const path of ["https://evil.test/", "//evil.test/", "/api/seasons?url=x", "/api/seasons/../games", "/api/seasons/0/games", "/api/seasons/3/games?next=1"]) await assert.rejects(B.readJson(path), /blocked/);
  for (const ip of ["127.0.0.1", "10.0.0.1", "169.254.169.254", "172.16.0.1", "192.168.1.1", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "::ffff:8.8.8.8", "198.18.0.1", "198.51.100.1", "203.0.113.1", "999.1.1.1"]) assert.equal(B.publicIPv4(ip), false, ip);
  assert.equal(B.publicIPv4("8.8.8.8"), true);
  t.mock.method(dns, "lookup", (_host, _options, callback) => callback(null, [{ address: "127.0.0.1", family: 4 }]));
  await new Promise(resolve => B.safeLookup("api.tpbl.basketball", {}, error => { assert.ok(error); resolve(); }));
  await new Promise(resolve => B.safeLookup("evil.test", {}, error => { assert.ok(error); resolve(); }));
});
test("HTTPS transport is bounded and rejects redirects, wrong MIME, encoding, overflow and invalid JSON offline", async t => {
  let captured, scenario;
  t.mock.method(https, "get", (options, callback) => {
    captured = options; const req = new EventEmitter();
    queueMicrotask(() => {
      const response = new EventEmitter(); response.statusCode = scenario.status || 200;
      response.headers = { "content-type": "application/json", ...scenario.headers }; response.destroy = () => {};
      callback(response);
      for (const body of scenario.chunks || [scenario.body ?? "[]"]) response.emit("data", Buffer.from(body));
      response.emit("end");
    }); return req;
  });
  scenario = {}; assert.deepEqual(await B.readJson("/api/seasons"), []);
  assert.equal(captured.hostname, "api.tpbl.basketball"); assert.equal(captured.lookup, B.safeLookup); assert.equal(captured.agent, false);
  assert.deepEqual(Object.keys(captured.headers).sort(), ["Accept", "Accept-Encoding"]);
  for (scenario of [{ status: 302, headers: { location: "https://evil.test" } }, { status: 429 }, { status: 403 },
    { headers: { "content-type": "text/html" } }, { headers: { "content-encoding": "gzip" } },
    { headers: { "content-length": B.limit + 1 } }, { body: "not-json" }, { chunks: [" ".repeat(B.limit), "[]"] }]) await assert.rejects(B.readJson("/api/seasons"));
});

async function serverHarness(t, search, now = Date.now) {
  let privateCalls = 0;
  const never = () => { privateCalls++; throw new Error("private access forbidden"); };
  const server = createServer({ port: 8002, perform: never, performAvailability: never,
    storage: { read: never, write: never, clear: never }, searchBasketball: search, now });
  server.listen(0, "127.0.0.1"); await once(server, "listening"); t.after(() => server.shutdown());
  const request = (path, { method = "GET", body, headers = {} } = {}) => new Promise((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port: server.address().port, path, method,
      headers: { Host: "localhost:8002", ...headers } }, res => {
      let text = ""; res.on("data", c => { text += c; }); res.on("end", () => resolve({ status: res.statusCode, text, headers: res.headers }));
    }); req.on("error", reject); req.end(body);
  });
  const post = (body = defaultBody, headers = {}) => request("/api/activities/basketball", { method: "POST", body,
    headers: { Origin: "http://localhost:8002", "Content-Type": "application/json", ...headers } });
  return { request, post, get privateCalls() { return privateCalls; } };
}
test("public endpoint works without calendar acknowledgement/session and startup/assets make no requests", async t => {
  let calls = 0; const h = await serverHarness(t, async () => { calls++; return { games: [] }; });
  for (const path of ["/activities", "/availability-core.js", "/shared/date-selection.js", "/shared/basketball-teams.js", "/activity-preview/basketball-ui.js", "/activity-preview/basketball.css"]) assert.equal((await h.request(path)).status, 200);
  const page = await h.request("/activities"); assert.ok(page.text.includes(JSON.stringify(describeWeek())));
  assert.doesNotMatch(page.text, /owner-csrf|OWNER_CSRF/); assert.equal(calls, 0);
  const response = await h.post(); assert.equal(response.status, 200); assert.equal(calls, 1);
  assert.equal(response.headers["cache-control"], "no-store"); assert.equal(response.headers["set-cookie"], undefined);
  assert.equal(h.privateCalls, 0);
});
test("date-only HTTP route passes Oct 9–15 through real adapter/season selection and returns only matching public fixture games", async t => {
  const calls = [], windows = [];
  const h = await serverHarness(t, options => {
    windows.push(options.window);
    return B.searchBasketball({ ...options, request: async path => {
      calls.push(path); return path === "/api/seasons" ? seasons : [fixture(1, "2026-09-20"), fixture(2, "2026-10-08", "23:59:59"),
        fixture(3, "2026-10-09"), fixture(4, "2026-10-15", "23:59:59"), fixture(5, "2026-10-16")];
    } });
  });
  const result = await h.post(JSON.stringify({ startDate: "2026-10-09", endDate: "2026-10-15" }));
  assert.equal(result.status, 200); const data = JSON.parse(result.text);
  assert.deepEqual(data.week, describeWeek(require("../owner/availability-core").dateRange("2026-10-09", "2026-10-15")));
  assert.equal(windows[0].start, data.week.start); assert.deepEqual(data.games.map(g => g.id), ["tpbl-3", "tpbl-4"]);
  assert.deepEqual(calls, ["/api/seasons", "/api/seasons/3/games"]); assert.equal(h.privateCalls, 0);
});
test("adapter validates supplied window before any public fetch", async () => {
  let calls = 0;
  for (const window of [null, {}, { ...require("../owner/availability-core").window, slots: 1488 }]) {
    await assert.rejects(B.searchBasketball({ window, request: async () => { calls++; } }), /invalid_date_range/);
  }
  assert.equal(calls, 0);
});
test("basketball rejects ages, URLs, unbounded date scope, invalid bodies and every cross-origin/host bypass before work", async t => {
  let calls = 0; const h = await serverHarness(t, async () => { calls++; });
  for (const body of ['{}', '{"ages":[8]}', '{"date":"2026-09-20"}', '{"url":"https://evil.test"}', "null", "[]", "bad", " ".repeat(129),
    ...[{ startDate: "2026-10-09", endDate: "2026-10-16" }, { startDate: "2026-10-15", endDate: "2026-10-09" },
      { startDate: "2026-02-30", endDate: "2026-03-01" }, { startDate: 20261009, endDate: "2026-10-15" },
      { startDate: "2026-10-09", endDate: "2026-10-15", ages: [8] }, { startDate: "2026-10-09", endDate: "2026-10-15", url: "https://evil.test" }].map(JSON.stringify)]) assert.equal((await h.post(body)).status, 400);
  for (const headers of [{ Origin: "" }, { Origin: "null" }, { Origin: "http://evil.test" }, { Host: "127.0.0.1:8002" },
    { Host: "localhost:8003" }, { "Content-Type": "text/plain" }, { Forwarded: "" }, { "X-Forwarded-Host": "localhost:8002" },
    { "Sec-Fetch-Site": "cross-site" }, { "Sec-Fetch-Site": "none" }, { "Content-Encoding": "gzip" }]) assert.equal((await h.post("{}", headers)).status, 403);
  for (const method of ["GET", "HEAD", "OPTIONS"]) assert.equal((await h.request("/api/activities/basketball", { method })).status, 403);
  assert.equal((await h.request("/api/activities/basketball?age=8")).status, 404);
  assert.equal(calls, 0); assert.equal(h.privateCalls, 0);
});
test("public requests use a separate single-flight and cooldown, supporting both exact loopback origins", async t => {
  let finish, started, secondStarted, calls = 0, now = 10000;
  const ready = new Promise(r => { started = r; });
  const secondReady = new Promise(r => { secondStarted = r; });
  const h = await serverHarness(t, async () => { calls++; (calls === 1 ? started : secondStarted)(); return new Promise(r => { finish = r; }); }, () => now);
  const pending = h.post(); await ready;
  assert.equal((await h.post()).status, 429); finish({ games: [] }); assert.equal((await pending).status, 200);
  assert.equal((await h.post()).status, 429); now += 5000;
  const second = h.post(defaultBody, { Host: "127.0.0.1:8002", Origin: "http://127.0.0.1:8002" });
  await secondReady;
  finish({ games: [] }); assert.equal((await second).status, 200); assert.equal(calls, 2); assert.equal(h.privateCalls, 0);
});

test("an already cancelled search never invokes public metadata and late game responses are fenced", async () => {
  let calls = 0; const controller = new AbortController(); controller.abort();
  await assert.rejects(B.searchBasketball({ signal: controller.signal, request: async () => { calls++; return seasons; } }), /cancelled/);
  assert.equal(calls, 0);
  const next = new AbortController();
  await assert.rejects(B.searchBasketball({ signal: next.signal, request: async path => {
    if (path === "/api/seasons") return seasons;
    next.abort(); return [fixture()];
  } }), /cancelled/);
});
test("public-route disconnect aborts source work and never sends its late result", async () => {
  const { createBasketballRoute } = require("../scripts/basketball-route");
  let finish, started, signal; const ready = new Promise(r => { started = r; });
  const route = createBasketballRoute({ search: async options => {
    signal = options.signal; started(); return new Promise(resolve => { finish = resolve; });
  } });
  const req = { method: "POST", headers: { host: "localhost:8002", origin: "http://localhost:8002", "content-type": "application/json" },
    setTimeout() {}, async *[Symbol.asyncIterator]() { yield Buffer.from(defaultBody); } };
  const res = new EventEmitter(); let sends = 0; res.writeHead = () => { sends++; return res; }; res.end = () => {};
  const pending = route.handle(req, res); await ready; res.emit("close");
  assert.equal(signal.aborted, true); finish({ games: [fixture()] }); await pending;
  assert.equal(sends, 0); assert.equal(res.listenerCount("close"), 0);
});