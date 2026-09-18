"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs");
const { spliceWindow } = require("../scripts/smooth-demo-transition");
test("activity retake uses frame-aligned bounds and excludes calendars", () => {
  const bounds = spliceWindow({ captureStart: 1.542, scenes: [
    { kind: "preferences", start: 44.125 }, { kind: "details", start: 80.835 }
  ] });
  assert.deepEqual(bounds, { start: 57.8, end: 94.48, seconds: 94.48 - 57.8 });
});
test("retake cannot forward network requests or replace audio/caption band", () => {
  const script = fs.readFileSync(require.resolve("../scripts/smooth-demo-transition"), "utf8");
  assert.doesNotMatch(script, /route\.(continue|fetch)|scrollIntoViewIfNeeded/);
  assert.match(script, /requestAnimationFrame\(frame\)/);
  assert.match(script, /scale=1706:960/);
  assert.match(script, /"-c:a", "copy"/);
  assert.match(script, /Click must not auto-scroll/);
});