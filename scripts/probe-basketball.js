"use strict";
// Explicit public-only probe. Same bounded adapter as the button; no calendar imports/data.
const { searchBasketball } = require("./basketball");
if (require.main === module) {
  if (process.argv.length !== 2) { console.error("No arguments accepted."); process.exitCode = 1; }
  else searchBasketball().then(result => {
    console.log(JSON.stringify({ week: result.week, matches: result.games.length, sources: result.sources }, null, 2));
    if (result.sources[0].status === "unavailable") process.exitCode = 1;
  }).catch(() => { console.error("Public source unavailable."); process.exitCode = 1; });
}