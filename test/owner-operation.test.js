"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const net = require("node:net");
const { once } = require("node:events");
const { withOwnerOperation } = require("../scripts/owner-operation");

test("local exclusive reservation blocks overlapping operations before work and releases after failure", async () => {
  const probe = net.createServer(); probe.listen(0, "127.0.0.1"); await once(probe, "listening");
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  let overlappingCalls = 0;
  await assert.rejects(withOwnerOperation(async () => {
    await assert.rejects(withOwnerOperation(() => { overlappingCalls++; }, { port }), /owner_operation_busy/);
    throw new Error("synthetic_failure");
  }, { port }), /synthetic_failure/);
  assert.equal(overlappingCalls, 0);
  assert.equal(await withOwnerOperation(async () => true, { port }), true);
});