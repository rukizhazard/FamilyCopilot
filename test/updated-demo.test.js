"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs");
const { permittedSearch, captionCues } = require("../scripts/record-updated-demo");
test("updated recording limits public search to chosen dates and team", () => {
  const url = new URL("http://127.0.0.1:8002/api/activities/basketball");
  const body = { startDate: "2026-10-09", endDate: "2026-10-11", teamMode: "only", teamIds: [`tpbl:name:${encodeURIComponent("中信特攻")}`] };
  assert(permittedSearch(url, "POST", body));
  for (const patch of [{ endDate: "2026-10-15" }, { teamMode: "prefer" }, { teamIds: [] }, { teamIds: ["other"] }]) assert(!permittedSearch(url, "POST", { ...body, ...patch }));
  assert(!permittedSearch(new URL("https://example.com/api/activities/basketball"), "POST", body));
  assert(!permittedSearch(url, "GET", body));
});
test("captions follow continuous take with basketball only after recorded selection", () => {
  const scenes = [{ start: 2, delay: 0 }, { start: 28, delay: 0.15 }, { start: 44, delay: 6 }, { start: 64, delay: 2 }, { start: 80, delay: 0.15 }, { start: 98, delay: 0.2 }];
  const clips = Array.from({ length: 7 }, (_, i) => ({ text: `Clip ${i}`, seconds: 10 }));
  const cues = captionCues({ captureStart: 2, calendarSecondVoice: 14, scenes }, clips, "Intro");
  assert.equal(cues.length, 8); assert.equal(cues[1].start, 14.65);
  assert.equal(cues[3].start, 41.35); assert.equal(cues[4].start, 63.2);
  assert.equal(cues.at(-1).text, "Clip 6");
});
test("calendar take has no scrolling actions and records a physical navigation click", () => {
  const source = fs.readFileSync(require.resolve("../scripts/record-updated-demo"), "utf8");
  const take = source.slice(source.indexOf("const captureStart = now()"), source.indexOf('phase = "preferences"'));
  assert(!/scrollTo\(|scrollIntoView|mouse\.wheel|\.goto\(/.test(take));
  assert.match(take, /page\.mouse\.down\(\)/); assert.match(take, /page\.mouse\.up\(\)/);
  assert.match(take, /assert\.deepEqual\(scrollCheck/);
});