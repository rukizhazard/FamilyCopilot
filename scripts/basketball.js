"use strict";
const https = require("node:https");
const dns = require("node:dns");
const { describeWeek } = require("./activity-week");
const T = require("../shared/basketball-teams");
const sourceUrl = "https://tpbl.basketball/schedule";
const otherSource = Object.freeze({ league: "P. LEAGUE+", status: "not_searched",
  sourceUrl: "https://pleagueofficial.com/schedule",
  message: "Not searched here. Open the official schedule; coverage of this week is unverified." });
const limit = 1024 * 1024;
const validId = id => Number.isSafeInteger(id) && id > 0 && id <= 9999999;
const text = value => typeof value === "string" && value.trim().length > 0 && value.length <= 120 ? value.trim() : null;
function publicIPv4(address) {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(address)) return false;
  const [a, b, c, d] = address.split(".").map(Number);
  return [a, b, c, d].every(n => n <= 255) && a > 0 && a < 224 &&
    ![10, 127].includes(a) && !(a === 100 && b >= 64 && b <= 127) &&
    !(a === 169 && b === 254) && !(a === 172 && b >= 16 && b <= 31) &&
    !(a === 192 && (b === 168 || b === 0 || b === 2 || b === 88 && c === 99)) &&
    !(a === 198 && (b === 18 || b === 19 || b === 51 && c === 100)) &&
    !(a === 203 && b === 0 && c === 113);
}
function safeLookup(hostname, options, callback) {
  if (hostname !== "api.tpbl.basketball") return callback(new Error("blocked"));
  dns.lookup(hostname, { family: 4, all: true }, (error, addresses) => {
    if (error || !addresses?.length || addresses.some(a => !publicIPv4(a.address))) return callback(new Error("unavailable"));
    // Connect to the checked address, not a second DNS lookup. TLS still verifies hostname.
    if (options?.all) callback(null, [addresses[0]]);
    else callback(null, addresses[0].address, 4);
  });
}
function allowedPath(path) { return path === "/api/seasons" || /^\/api\/seasons\/[1-9]\d{0,6}\/games$/.test(path); }
function readJson(path, { signal } = {}) {
  if (!allowedPath(path)) return Promise.reject(new Error("blocked"));
  return new Promise((resolve, reject) => {
    const deadline = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(10000)]);
    const request = https.get({ hostname: "api.tpbl.basketball", port: 443, path, lookup: safeLookup,
      agent: false, signal: deadline, headers: { Accept: "application/json", "Accept-Encoding": "identity" } }, response => {
      // No redirects, cookies, authentication, arbitrary URLs or retries.
      if (response.statusCode !== 200 || !/^application\/json(?:;|$)/i.test(response.headers["content-type"] || "") ||
        response.headers["content-encoding"] && response.headers["content-encoding"] !== "identity" ||
        Number(response.headers["content-length"]) > limit) {
        response.destroy(); reject(new Error("unavailable")); return;
      }
      let bytes = 0; const chunks = [];
      response.on("data", chunk => {
        bytes += chunk.length;
        if (bytes > limit) { response.destroy(); reject(new Error("unavailable")); }
        else chunks.push(chunk);
      });
      response.on("error", () => reject(new Error("unavailable")));
      response.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); } catch { reject(new Error("unavailable")); } });
    });
    request.on("error", () => reject(new Error(signal?.aborted ? "cancelled" : "unavailable")));
  });
}
function localStart(date, time) {
  if (!/^\d{4}-\d\d-\d\d$/.test(date || "") || !/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(time || "")) return null;
  const value = Date.parse(`${date}T${time}+08:00`);
  return Number.isFinite(value) && new Date(value + 8 * 3600000).toISOString().slice(0, 19) === `${date}T${time}` ? value : null;
}
function chooseSeason(seasons, week) {
  if (!Array.isArray(seasons) || !seasons.length || seasons.length > 40) throw new Error("unavailable");
  const rows = seasons.map(s => {
    if (!validId(s?.id) || !/^\d{4}-\d{4} /.test(s.name || "")) throw new Error("unavailable");
    const start = localStart(s.started_at?.slice(0, 10), s.started_at?.slice(11));
    const end = localStart(s.ended_at?.slice(0, 10), s.ended_at?.slice(11));
    if (start === null || end === null || end < start) throw new Error("unavailable");
    return { id: s.id, name: s.name.slice(0, 9), start, end };
  }).sort((a, b) => a.start - b.start);
  if (new Set(rows.map(s => s.id)).size !== rows.length) throw new Error("unavailable");
  return rows.find(s => s.end >= Date.parse(week.start)) || rows.at(-1);
}
function parseGames(rows, week, season, preference = T.selection()) {
  if (!Array.isArray(rows) || rows.length > 600) throw new Error("unavailable");
  preference = T.selection(preference.teamIds, preference.teamMode);
  let skipped = 0; const games = [], dates = [], seen = new Set(), roster = new Map();
  for (const row of rows) {
    const start = localStart(row?.game_date, row?.game_time);
    const home = text(row?.home_team?.name), away = text(row?.away_team?.name);
    if (start === null || row.gamed_at !== `${row.game_date} ${row.game_time}` || !validId(row.id) || seen.has(row.id) ||
      !home || !away || !["NOT_STARTED", "COMPLETED"].includes(row.status)) { skipped++; continue; }
    let homeTeam, awayTeam;
    try { homeTeam = T.team(row.home_team); awayTeam = T.team(row.away_team); }
    catch { skipped++; continue; }
    const eligible = start >= Date.parse(week.start) && start < Date.parse(week.end) && row.status === "NOT_STARTED";
    for (const team of [homeTeam, awayTeam]) {
      const previous = roster.get(team.key);
      // Conflicting source identity must not turn into a guessed favorite match.
      if (previous && previous.name !== team.name && !(T.isDreamers(previous.name) && T.isDreamers(team.name))) throw new Error("unavailable");
      if (!previous) roster.set(team.key, { ...team, gamesInRange: 0 });
      if (eligible) roster.get(team.key).gamesInRange++;
    }
    seen.add(row.id); dates.push(row.game_date);
    if (!eligible) continue;
    games.push({ id: `tpbl-${row.id}`, league: "TPBL", season: season.name, home, away,
      homeKey: homeTeam.key, awayKey: awayTeam.key,
      date: row.game_date, time: row.game_time.slice(0, 5), timezone: "Asia/Taipei",
      venue: text(row.venue), city: null, sourceUrl: `${sourceUrl}/${row.id}` });
  }
  dates.sort(); games.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const selected = T.selectGames(games, preference, [...roster.values()]);
  const inPublishedRange = dates.length && dates[0] <= week.firstDate && dates.at(-1) >= week.lastDate;
  const status = skipped ? "partial" : selected.games.length ? "results" : games.length || inPublishedRange ? "no_matches" : "outside_coverage";
  return { status, ...selected, availableTeams: [...roster.values()].sort((a, b) => a.key.localeCompare(b.key)), skipped,
    eligibleCount: games.length,
    publishedFrom: dates[0] || null, publishedThrough: dates.at(-1) || null };
}
async function searchBasketball({ window, teamIds, teamMode, signal, request = readJson, now = Date.now } = {}) {
  const week = describeWeek(window);
  const teamSelection = T.selection(teamIds, teamMode);
  const identity = { teamContract: T.contract, teamMatching: T.matchingContract, teamSelection };
  const deadline = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(25000)]);
  const source = { league: "TPBL", sourceUrl, status: "unavailable", checkedAt: null, attemptedAt: new Date(now()).toISOString() };
  try {
    if (deadline.aborted) throw new Error("cancelled");
    const season = chooseSeason(await request("/api/seasons", { signal: deadline }), week);
    if (deadline.aborted) throw new Error("cancelled");
    const result = parseGames(await request(`/api/seasons/${season.id}/games`, { signal: deadline }), week, season, teamSelection);
    if (deadline.aborted) throw new Error("cancelled");
    const { games, availableTeams, ...coverage } = result;
    Object.assign(source, coverage, { season: season.name, checkedAt: new Date(now()).toISOString() });
    return { ...identity, week, games, availableTeams, sources: [source, otherSource], coverage: "partial" };
  } catch {
    if (signal?.aborted) throw new Error("cancelled");
    return { ...identity, week, games: [], availableTeams: [], sources: [source, otherSource], coverage: "partial" };
  }
}
module.exports = { searchBasketball, readJson, parseGames, chooseSeason, localStart, publicIPv4, safeLookup, allowedPath, limit };