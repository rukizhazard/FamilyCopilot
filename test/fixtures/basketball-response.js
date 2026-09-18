"use strict";
// Build a versioned synthetic browser response through the real projection and
// filter-before-40 path. Supply only synthetic TPBL-shaped season rows.
const B = require("../../scripts/basketball"), D = require("../../shared/date-selection"), T = require("../../shared/basketball-teams");
function row(id = 1, date = "2026-09-20", changes = {}) {
  return { id, game_date: date, game_time: "14:00:00", gamed_at: `${date} 14:00:00`, status: "NOT_STARTED",
    home_team: { name: "Synthetic Home" }, away_team: { name: "Synthetic Away" }, venue: "Synthetic Arena", ...changes };
}
function basketballResponse({ startDate = "2026-09-20", endDate = "2026-09-26", teamIds, teamMode, rows = [row()], checkedAt = "2026-09-17T00:00:00Z" } = {}) {
  const week = D.describeWeek(D.requestWindow({ startDate, endDate })), teamSelection = T.selection(teamIds, teamMode);
  const { games, availableTeams, ...coverage } = B.parseGames(rows, week, { name: "2026-2027" }, teamSelection);
  return { synthetic: true, teamContract: T.contract, teamMatching: T.matchingContract, teamSelection, week, games, availableTeams, coverage: "partial", sources: [
    { league: "TPBL", sourceUrl: "https://tpbl.basketball/schedule", ...coverage, checkedAt, season: "2026-2027" },
    { league: "P. LEAGUE+", status: "not_searched", sourceUrl: "https://pleagueofficial.com/schedule" }
  ] };
}
module.exports = { basketballResponse, row };