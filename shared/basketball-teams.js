(function (root) {
  "use strict";
  // Local keys, not invented provider IDs. Case folding is not fuzzy matching.
  const contract = "tpbl-teams-v2", dreamersKey = "tpbl:alias:formosa-dreamers";
  const matchingContract = "tpbl-fuzzy-v1";
  const aliases = Object.freeze(["福爾摩沙夢想家", "Formosa Dreamers"]);
  const validName = name => typeof name === "string" && name.length > 0 && name.length <= 120 && name === name.trim() && !/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(name);
  const isDreamers = name => typeof name === "string" && aliases.some(alias => alias.toLowerCase() === name.toLowerCase());
  const nameKey = name => isDreamers(name) ? dreamersKey : `tpbl:name:${encodeURIComponent(name)}`;
  function preferredTeam(raw) {
    // Reject controls even at the edges, before trimming; never retain an ID guess.
    if (typeof raw !== "string" || raw.length > 120 || !validName(raw.trim()) ||
      /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(raw)) throw new Error("invalid_team_name");
    const name = raw.trim(), key = nameKey(name.toLowerCase());
    if (!validKey(key)) throw new Error("invalid_team_name");
    return { key, name };
  }
  function team(value) {
    if (!value || typeof value.name !== "string") throw new Error("invalid_team");
    const name = value.name.trim();
    if (!validName(name)) throw new Error("invalid_team");
    if (value.id != null && (!Number.isSafeInteger(value.id) || value.id < 1 || value.id > 9999999)) throw new Error("invalid_team");
    return { key: value.id == null ? nameKey(name) : `tpbl:id:${value.id}`, name };
  }
  function validKey(key) {
    if (typeof key !== "string" || key.length > 1100) return false;
    if (key === dreamersKey || /^tpbl:id:[1-9]\d{0,6}$/.test(key)) return true;
    try {
      if (!key.startsWith("tpbl:name:")) return false;
      const name = decodeURIComponent(key.slice(10));
      return validName(name) && nameKey(name) === key;
    } catch { return false; }
  }
  function validTeam(value) {
    return !!value && validName(value.name) && validKey(value.key) &&
      (/^tpbl:id:/.test(value.key) || nameKey(value.name) === value.key);
  }
  function selection(teamIds = [], teamMode = "prefer") {
    if (!Array.isArray(teamIds) || teamIds.length > 16 || Array.from(teamIds).some(key => !validKey(key)) ||
      new Set(teamIds).size !== teamIds.length || !["prefer", "only"].includes(teamMode)) throw new Error("invalid_team_selection");
    return { teamIds: [...teamIds].sort(), teamMode };
  }
  function matches(game, ids) {
    return ids.some(key => key === game.homeKey || key === game.awayKey ||
      key === dreamersKey && (isDreamers(game.home) || isDreamers(game.away)) ||
      validKey(key) && key.startsWith("tpbl:name:") &&
        [game.home, game.away].some(name => validName(name) && name.toLowerCase() === decodeURIComponent(key.slice(10)).toLowerCase()));
  }
  // Matching copies only; never rewrite names, keys or game/source identities.
  const normalized = name => name.normalize("NFKC").toLowerCase().replace(/[\s.'’\-]/gu, "");
  const searchable = name => /^[\p{L}\p{N}\s.'’\-]+$/u.test(name.normalize("NFKC"));
  function oneEditApart(left, right) {
    const a = Array.from(left), b = Array.from(right);
    if (Math.min(a.length, b.length) < 4 || Math.abs(a.length - b.length) > 1) return false;
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    if (i === Math.min(a.length, b.length)) return true;
    const tail = (x, y) => a.slice(x).join("") === b.slice(y).join("");
    if (a.length !== b.length) return a.length > b.length ? tail(i + 1, i) : tail(i, i + 1);
    return tail(i + 1, i + 1) || a[i] === b[i + 1] && a[i + 1] === b[i] && tail(i + 2, i + 2);
  }
  function resolveTeams(roster, ids = []) {
    selection(ids);
    if (!Array.isArray(roster) || roster.length > 1200 || roster.some(team => !validTeam(team)) ||
      new Set(roster.map(team => team.key)).size !== roster.length) throw new Error("invalid_team_roster");
    const matchesByName = ids.map(key => {
      const exact = roster.filter(team => matches({ homeKey: team.key, awayKey: team.key, home: team.name, away: team.name }, [key]));
      if (exact.length) return { key, kind: "exact", candidates: exact };
      if (!key.startsWith("tpbl:name:")) return { key, kind: "unmatched", candidates: [] };
      const name = decodeURIComponent(key.slice(10)), query = normalized(name);
      if (!searchable(name) || !query) return { key, kind: "unmatched", candidates: [] };
      const entries = roster.filter(team => searchable(team.name)).map(team => ({ team, name: normalized(team.name) }));
      // Exact > formatting > contained abbreviation > one edit/transposition.
      // All candidates at the winning tier count, regardless of dates/game count.
      let candidates = entries.filter(entry => entry.name === query);
      const minimum = /\p{Script=Han}/u.test(query) ? 2 : 3;
      if (!candidates.length && Array.from(query).length >= minimum) candidates = entries.filter(entry => entry.name.includes(query));
      if (!candidates.length) candidates = entries.filter(entry => oneEditApart(query, entry.name));
      return { key, kind: candidates.length === 1 ? "fuzzy" : candidates.length ? "ambiguous" : "unmatched",
        candidates: candidates.map(entry => entry.team) };
    });
    return { matches: matchesByName, teamIds: [...new Set(matchesByName
      .filter(match => match.kind === "exact" || match.kind === "fuzzy")
      .flatMap(match => match.candidates.map(team => team.key)))].sort() };
  }
  // Input is the complete validated eligible season subset, never the first 40.
  function selectGames(games, preference = selection(), roster = [...new Map(games.flatMap(game => [
    [game.homeKey, { key: game.homeKey, name: game.home }], [game.awayKey, { key: game.awayKey, name: game.away }]
  ])).values()]) {
    const { teamIds, teamMode } = selection(preference.teamIds, preference.teamMode);
    const resolved = resolveTeams(roster, teamIds).teamIds;
    const preferred = games.filter(game => matches(game, resolved));
    const chosen = !teamIds.length ? games : teamMode === "only" ? preferred :
      [...preferred, ...games.filter(game => !matches(game, resolved))];
    return { games: chosen.slice(0, 40), matchedCount: chosen.length, preferredCount: preferred.length, truncated: chosen.length > 40 };
  }
  function label(name) {
    if (isDreamers(name)) return aliases[0];
    return name;
  }
  const api = { contract, matchingContract, dreamersKey, aliases, team, preferredTeam, validName, validKey, validTeam, selection, matches, resolveTeams, selectGames, label, isDreamers };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.BasketballTeams = Object.freeze(api);
})(globalThis);