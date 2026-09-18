"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { loadingInterval } = require("../scripts/add-demo-loading");
test("white loading starts at official-page handoff and lasts three seconds", () => {
  assert.deepEqual(loadingInterval({ captureStart: 1.542, captureEnd: 100.25 }), { start: 113.92, end: 116.92 });
});
test("loading duration and capture boundaries must be bounded and finite", () => {
  for (const duration of [-1, 0, 6, NaN, Infinity])
    assert.throws(() => loadingInterval({ captureStart: 1, captureEnd: 100 }, duration));
  assert.throws(() => loadingInterval({ captureStart: 100, captureEnd: 1 }));
});