"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const B = require("../scripts/basketball"), T = require("../shared/basketball-teams"), D = require("../shared/date-selection");
const { createBasketballRoute, searchRequest, bodyLimit } = require("../scripts/basketball-route");
const { basketballResponse, row } = require("./fixtures/basketball-response");
const body = { startDate: "2026-09-20", endDate: "2026-09-26" }, week = D.describeWeek(D.requestWindow(body));
const parse = (rows, ids = [], mode = "prefer") => B.parseGames(rows, week, { name: "2026-2027" }, T.selection(ids, mode));
test("preferred-name helper bounds, trims and case-folds without normalizing interior spaces or guessing IDs", () => {
  assert.deepEqual(T.preferredTeam(" Synthetic FALCONS "), { key: "tpbl:name:synthetic%20falcons", name: "Synthetic FALCONS" });
  for (const name of ["FORMOSA DREAMERS", "福爾摩沙夢想家", " Formosa Dreamers "]) assert.equal(T.preferredTeam(name).key, T.dreamersKey);
  assert.equal(T.preferredTeam("tpbl:id:99").key, "tpbl:name:tpbl%3Aid%3A99");
  for (const name of [null, {}, 12, "", " ", "x".repeat(121), "bad\n", "\tbad", "bad\u0080", "bad\u202e", "bad\u2069", "\ud800"]) assert.throws(() => T.preferredTeam(name));
  assert.equal(T.validKey(T.preferredTeam("x".repeat(120)).key), true);
  assert.equal(T.validKey(T.preferredTeam("夢".repeat(120)).key), true);
  assert.equal(T.validKey(T.preferredTeam("<img onerror=evil>").key), true);
  assert.equal(T.label("Synthetic 夢"), "Synthetic 夢");
  assert.doesNotMatch(T.label("Synthetic 夢"), /source name|verified team/);
  assert.notEqual(T.preferredTeam("Synthetic  Falcons").key, T.preferredTeam("Synthetic Falcons").key);
  const rows = [row(1, undefined, { home_team: { id: 99, name: "Synthetic Falcons" } })];
  assert.equal(parse(rows, [T.preferredTeam(" synthetic FALCONS ").key], "only").games.length, 1);
  assert.equal(parse(rows, [T.preferredTeam("tpbl:id:99").key], "only").games.length, 0);
});
test("exact and unique fuzzy names match numeric-ID home and away before40", () => {
  const rows = Array.from({ length: 45 }, (_, i) => row(i + 1));
  rows.push(row(46, "2026-09-21", { home_team: { id: 12, name: "Synthetic Falcons" } }),
    row(47, "2026-09-22", { away_team: { id: 12, name: "Synthetic Falcons" } }));
  const key = T.team({ name: "Synthetic Falcons" }).key;
  assert.deepEqual(parse(rows, [key], "only").games.map(g => g.id), ["tpbl-46", "tpbl-47"]);
  const prefer = parse(rows, [key]);
  assert.deepEqual(prefer.games.slice(0, 3).map(g => g.id), ["tpbl-46", "tpbl-47", "tpbl-1"]);
  assert.equal(prefer.games.length, 40); assert.equal(prefer.preferredCount, 2);
  for (const name of ["Falcons", "Synthetic Falcon", "Synthetic  Falcons", "Synthetci Falcons"]) {
    assert.equal(parse(rows, [T.preferredTeam(name).key], "only").games.length, 2);
  }
  assert.equal(parse(rows, [T.preferredTeam("Nonexistent Club").key], "only").games.length, 0);
});
test("fuzzy resolution uses full roster, including out-of-range ambiguity, not just first40 games", () => {
  const rows = [...Array.from({ length: 45 }, (_, i) => row(i + 1)),
    row(46, undefined, { home_team: { id: 99, name: "新北中信特攻" } })];
  const preference = [T.preferredTeam("中信特攻").key];
  assert.deepEqual(parse(rows, preference, "only").games.map(game => game.id), ["tpbl-46"]);
  assert.equal(parse(rows, preference, "prefer").games[0].id, "tpbl-46");
  rows.push(row(47, "2026-10-10", { home_team: { id: 100, name: "Synthetic 中信特攻 Academy" } }));
  assert.equal(parse(rows, preference, "only").games.length, 0);
  const result = T.resolveTeams(parse(rows).availableTeams, preference);
  assert.deepEqual(result.teamIds, []); assert.equal(result.matches[0].kind, "ambiguous");
  assert.equal(result.matches[0].candidates.length, 2);
});
test("fuzzy matching prioritizes exact names, preserves source identity, bounds typo/short queries and input", () => {
  const roster = [T.team({ id: 5, name: "City Falcons" }), T.team({ id: 6, name: "City Falcons Academy" }),
    T.team({ id: 7, name: "City Talcons" }), T.team({ id: 8, name: "新北中信特攻" })];
  const resolve = name => T.resolveTeams(roster, [T.preferredTeam(name).key]);
  assert.deepEqual(resolve("City Falcons").teamIds, ["tpbl:id:5"]);
  assert.equal(resolve("Falcons").matches[0].kind, "ambiguous");
  assert.equal(resolve("City Balcons").matches[0].kind, "ambiguous");
  assert.deepEqual(resolve("Ｃｉｔｙ　Ｆａｌｃｏｎｓ").teamIds, ["tpbl:id:5"]);
  assert.deepEqual(resolve("新北中信特功").teamIds, ["tpbl:id:8"]);
  for (const name of ["中", "Ci", "新北中信功功", "Nonexistent", "tpbl:id:5"]) assert.deepEqual(resolve(name).teamIds, [], name);
  assert.deepEqual(T.resolveTeams(roster, ["tpbl:id:5"]).teamIds, ["tpbl:id:5"]);
  assert.deepEqual(T.resolveTeams(roster, ["tpbl:id:999"]).teamIds, []);
  assert.deepEqual(T.resolveTeams(roster, []).teamIds, []);
  assert.throws(() => T.resolveTeams(Array(1201).fill(roster[0]), []));
  assert.throws(() => T.resolveTeams([{ key: "javascript:x", name: "Falcons" }], []));
  assert.throws(() => T.resolveTeams(roster, ["tpbl:name:%"]));
});
test("browser and CommonJS fuzzy resolution agree without mutating source names or preferences", () => {
  const vm = require("node:vm"), fs = require("node:fs"), browser = {};
  vm.runInNewContext(fs.readFileSync(require.resolve("../shared/basketball-teams"), "utf8"), browser);
  const roster = Object.freeze([Object.freeze(T.team({ id: 9, name: "新北中信特攻" }))]);
  const ids = Object.freeze([T.preferredTeam("中信特攻").key]);
  assert.equal(JSON.stringify(browser.BasketballTeams.resolveTeams(roster, ids)), JSON.stringify(T.resolveTeams(roster, ids)));
  assert.equal(roster[0].name, "新北中信特攻"); assert.equal(ids[0], T.preferredTeam("中信特攻").key);
  assert.equal(browser.BasketballTeams.matchingContract, "tpbl-fuzzy-v1");
});
test("real adapter path advertises fuzzy contract on success and failure without sending preferences to source", async () => {
  const calls = [], rows = [row(1, undefined, { home_team: { id: 8, name: "新北中信特攻" } })];
  const query = { window: D.requestWindow(body), teamIds: [T.preferredTeam("中信特攻").key], teamMode: "only" };
  const data = await B.searchBasketball({ ...query, request: async (path, options) => {
    calls.push([path, Object.keys(options)]);
    return path === "/api/seasons" ? [{ id: 3, name: "2026-2027 season", started_at: "2026-10-17 00:00:00", ended_at: "2027-05-16 00:00:00" }] : rows;
  } });
  assert.equal(data.teamMatching, "tpbl-fuzzy-v1"); assert.equal(data.games.length, 1);
  assert.deepEqual(data.teamSelection, T.selection(query.teamIds, "only"));
  assert.deepEqual(calls, [["/api/seasons", ["signal"]], ["/api/seasons/3/games", ["signal"]]]);
  const unavailable = await B.searchBasketball({ ...query, request: async () => { throw Error("offline failure"); } });
  assert.equal(unavailable.teamMatching, "tpbl-fuzzy-v1"); assert.equal(unavailable.sources[0].status, "unavailable");
  assert.deepEqual(unavailable.games, []); assert.deepEqual(unavailable.availableTeams, []);
});
test("team keys use actual numeric IDs or exact names, never a guessed Dreamers ID or fuzzy aliases", () => {
  assert.deepEqual(T.team({ id: 91, name: "福爾摩沙夢想家" }), { key: "tpbl:id:91", name: "福爾摩沙夢想家" });
  for (const name of ["福爾摩沙夢想家", "Formosa Dreamers", "formosa dreamers"]) assert.equal(T.team({ name }).key, T.dreamersKey);
  for (const name of ["Dreamers", "福爾摩沙夢想家 B", "Formosa Dreamers Academy"]) assert.notEqual(T.team({ name }).key, T.dreamersKey);
  assert.equal(T.label("福爾摩沙夢想家"), "福爾摩沙夢想家");
  assert.equal(T.label("Formosa Dreamers"), "福爾摩沙夢想家");
  assert.equal(T.validKey(T.team({ name: "<img onerror=evil>" }).key), true);
});
test("Dreamers only matches home or away, including exact aliases alongside actual source numeric IDs", () => {
  const result = parse([row(1, undefined, { home_team: { id: 91, name: "福爾摩沙夢想家" } }),
    row(2, undefined, { away_team: { name: "Formosa Dreamers" } }), row(3), row(4, undefined, { home_team: { name: "Dreamers" } })], [T.dreamersKey], "only");
  assert.deepEqual(result.games.map(g => g.id), ["tpbl-1", "tpbl-2"]); assert.equal(result.preferredCount, 2); assert.equal(result.eligibleCount, 4);
});
test("only/prefer filters and ranks BEFORE first40; chronological order within groups and no padding", () => {
  const rows = Array.from({ length: 45 }, (_, i) => row(i + 1));
  rows.push(row(46, "2026-09-21", { away_team: { id: 91, name: "Formosa Dreamers" } }));
  const only = parse(rows, [T.dreamersKey], "only"); assert.deepEqual(only.games.map(g => g.id), ["tpbl-46"]); assert.equal(only.truncated, false); assert.equal(only.matchedCount, 1);
  const prefer = parse(rows, [T.dreamersKey]); assert.equal(prefer.games[0].id, "tpbl-46"); assert.equal(prefer.games[1].id, "tpbl-1"); assert.equal(prefer.games.length, 40); assert.equal(prefer.truncated, true); assert.equal(prefer.matchedCount, 46);
  const all = parse(rows); assert.equal(all.games[0].id, "tpbl-1"); assert.equal(all.matchedCount, 46);
});
test("multiple teams use OR across both sides, unknown only returns none; prefer explicitly includes others", () => {
  const rows = [row(1, undefined, { home_team: { id: 11, name: "Synthetic A" } }), row(2, undefined, { away_team: { id: 12, name: "Synthetic B" } }), row(3)];
  assert.deepEqual(parse(rows, ["tpbl:id:11", "tpbl:id:12"], "only").games.map(g => g.id), ["tpbl-1", "tpbl-2"]);
  const only = parse(rows, ["tpbl:id:999"], "only"); assert.equal(only.games.length, 0); assert.equal(only.status, "no_matches");
  const prefer = parse(rows, ["tpbl:id:999"], "prefer"); assert.equal(prefer.games.length, 3); assert.equal(prefer.preferredCount, 0);
});
test("full validated season supplies roster including out-of-window/completed teams but not malformed identities", () => {
  const result = parse([row(), row(2, "2026-10-09", { away_team: { id: 22, name: "Synthetic Future" } }),
    row(3, undefined, { status: "COMPLETED", home_team: { id: 23, name: "Synthetic Completed" } }),
    row(4, undefined, { home_team: { id: "../secret", name: "Synthetic Invalid" } })], [T.dreamersKey], "only");
  assert.equal(result.status, "partial"); assert.equal(result.skipped, 1);
  assert.ok(result.availableTeams.some(team => team.key === "tpbl:id:22" && team.gamesInRange === 0));
  assert.ok(result.availableTeams.some(team => team.key === "tpbl:id:23" && team.gamesInRange === 0));
  assert.ok(!result.availableTeams.some(team => team.name === "Synthetic Invalid"));
  assert.equal(result.games.length, 0); assert.equal(result.availableTeams.find(team => team.name === "Synthetic Home").gamesInRange, 1);
});
test("conflicting source numeric identity fails closed; malformed IDs/text never become name guesses", () => {
  assert.throws(() => parse([row(1, undefined, { home_team: { id: 1, name: "Synthetic A" } }), row(2, undefined, { home_team: { id: 1, name: "Synthetic B" } })]));
  for (const id of ["6", "<svg>", "__proto__", 0, -1, 1.5, Infinity, {}, 10000000]) assert.throws(() => T.team({ id, name: "Formosa Dreamers" }));
  for (const name of ["", " ", "x".repeat(121), "Fake\u202Ename", "Fake\nname", "Fake\u0000name"]) assert.throws(() => T.team({ name }));
  for (const key of ["6", "tpbl:id:06", "tpbl:id:6?url=x", "javascript:x", "tpbl:name:%", "tpbl:name:%00", "tpbl:name:%3cimg%3e", "tpbl:alias:dreamers", "tpbl:name:", "x".repeat(1101)]) assert.equal(T.validKey(key), false, key);
  for (const ids of [["__proto__"], [T.dreamersKey, T.dreamersKey], Array(17).fill(T.dreamersKey), [null], "all", Array(1)]) assert.throws(() => T.selection(ids));
  assert.throws(() => T.selection([], "guess"));
});
test("local request contract accepts dates with paired team fields; rejects ages/unknown keys before source work", () => {
  assert.deepEqual(searchRequest(body).teamIds, []);
  const request = { ...body, teamIds: [T.dreamersKey], teamMode: "only" }; assert.deepEqual(searchRequest(request).teamIds, [T.dreamersKey]);
  for (const invalid of [null, [], {}, { ...body, teamIds: [] }, { ...body, teamMode: "only" }, { ...request, ages: [8] }, { ...request, category: "sports" }, { ...request, url: "https://evil.test" }, { ...request, teamIds: [6] }, { ...request, teamIds: ["tpbl:id:0"] }, { ...request, teamMode: "auto" }]) assert.throws(() => searchRequest(invalid));
});
test("team preferences stay local: exactly two existing source GET paths with signal only, no query params", async () => {
  const calls = [];
  const result = await B.searchBasketball({ window: D.requestWindow(body), teamIds: [T.dreamersKey], teamMode: "only", now: () => 1000,
    request: async (path, options) => { calls.push({ path, keys: Object.keys(options) }); return path === "/api/seasons" ? [{ id: 3, name: "2026-2027 season", started_at: "2026-10-17 00:00:00", ended_at: "2027-05-16 00:00:00" }] : [row()]; } });
  assert.deepEqual(calls, [{ path: "/api/seasons", keys: ["signal"] }, { path: "/api/seasons/3/games", keys: ["signal"] }]);
  assert.equal(result.teamContract, T.contract); assert.deepEqual(result.teamSelection, T.selection([T.dreamersKey], "only")); assert.equal(result.games.length, 0);
  let fetched = 0; await assert.rejects(B.searchBasketball({ teamIds: ["evil"], request: async () => { fetched++; } })); assert.equal(fetched, 0);
});
test("local route enforces byte limit/team contract before dispatch, passes only validated fields", async () => {
  async function invoke(raw) {
    let received, code, result;
    const route = createBasketballRoute({ search: async options => { received = options; return { teamContract: T.contract }; } });
    const req = { method: "POST", headers: { host: "localhost:8002", origin: "http://localhost:8002", "content-type": "application/json" }, setTimeout() {}, async *[Symbol.asyncIterator]() { yield Buffer.from(raw); } };
    const res = new EventEmitter(); res.writeHead = status => { code = status; return res; }; res.end = value => { result = JSON.parse(value); res.writableEnded = true; };
    await route.handle(req, res); return { received, code, result };
  }
  const valid = await invoke(JSON.stringify({ ...body, teamIds: [T.dreamersKey], teamMode: "only" })); assert.equal(valid.code, 200); assert.deepEqual(Object.keys(valid.received).sort(), ["signal", "teamIds", "teamMode", "window"]);
  for (const raw of [" ".repeat(bodyLimit + 1), JSON.stringify({ ...body, teamIds: ["javascript:bad"], teamMode: "only" }), JSON.stringify({ ...body, ages: [8] })]) { const blocked = await invoke(raw); assert.equal(blocked.code, 400); assert.equal(blocked.received, undefined); }
});
test("mock-browser helper uses identical bounded contract and filter path, never a hand-built truncated roster", () => {
  const data = basketballResponse({ ...body, teamIds: [T.dreamersKey], teamMode: "only", rows: [...Array.from({ length: 40 }, (_, i) => row(i + 1)), row(41, undefined, { away_team: { name: "Formosa Dreamers" } })] });
  assert.deepEqual(data.games.map(game => game.id), ["tpbl-41"]); assert.equal(data.teamContract, T.contract); assert.equal(data.availableTeams.length, 3); assert.equal(data.sources[0].eligibleCount, 41);
});