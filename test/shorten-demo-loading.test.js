"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { transitionPlan, transitionFilter } = require("../scripts/shorten-demo-loading");
const previous = { start: 113.92, end: 116.92 };
test("white starts on click release, lasts one second, and old white is replaced", () => {
  assert.deepEqual(transitionPlan(110.88, previous), {
    start: 110.88, end: 111.88, officialStart: 113.92, repairEnd: 116.92, holdSeconds: 2.04
  });
});
test("transition aligns to frames and rejects invalid timing", () => {
  assert.equal(transitionPlan(110.881, previous).start, 110.92);
  for (const click of [NaN, Infinity, -1, 0, 114]) assert.throws(() => transitionPlan(click, previous));
  for (const seconds of [NaN, Infinity, -1, 0, .01, 3]) assert.throws(() => transitionPlan(110, previous, seconds));
  assert.throws(() => transitionPlan(110, { start: 114, end: 113 }));
});
test("only viewport is replaced; official footage bridges old handoff without caption changes", () => {
  const filter = transitionFilter(transitionPlan(110.88, previous));
  assert.match(filter, /crop=1706:960:107:0/);
  assert.match(filter, /trim=end_frame=1/);
  assert.match(filter, /eof_action=repeat/);
  assert.match(filter, /gte\(t,111.88\)\*lt\(t,116.92\)/);
  assert.match(filter, /gte\(t,110.88\)\*lt\(t,111.88\)/);
});