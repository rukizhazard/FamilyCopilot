"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { verifyOnce } = require("../scripts/verify-owner");

function harness({ failure = false, drift = false, dirtyCleanup = false, synthetic = false } = {}) {
  const calls = []; let reads = 0;
  return { calls, options: {
    inspect: async () => ({ syntheticPreserved: drift ? reads++ : 0 }),
    request: async (path, body) => {
      calls.push({ path, body });
      if (path === "/") return { status: 200, text: `<meta name="owner-mode" content="${synthetic ? "synthetic" : "live"}"><meta name="owner-csrf" content="${"a".repeat(64)}">` };
      if (path === "/api/status") return { status: 200, text: JSON.stringify({ status: "idle", synthetic: false }) };
      if (path === "/api/clear") return { status: dirtyCleanup ? 503 : 200, text: JSON.stringify({ status: dirtyCleanup ? "cleanup_failed" : "cleared" }) };
      if (failure) throw new Error("private-provider-label token=synthetic-secret");
      return { status: 200, text: JSON.stringify({ status: "listed", count: 1, eventsRead: 0, completeness: "unknown", ownership: "unverified",
        calendars: [{ key: "11111111-1111-4111-8111-111111111111", name: "private-provider-label" }], synthetic: false, cleanup: "workflow_disabled" }) };
    }
  } };
}
test("one-shot proxy verifier emits only booleans/counts, clears session and independently checks preserved resources", async () => {
  const h = harness(); const report = await verifyOnce(h.options);
  assert.equal(report.passed, true); assert.equal(report.count, 1);
  assert.equal(h.calls.filter(c => c.path === "/api/load").length, 1);
  assert.equal(h.calls.filter(c => c.path === "/api/clear").length, 1);
  assert.ok(Object.values(report).every(v => typeof v === "boolean" || typeof v === "number"));
  assert.doesNotMatch(JSON.stringify(report), /private-provider|token=|11111111/);
});
test("failed live verification never retries; cleanup/drift/fixture failures never produce success", async () => {
  for (const options of [{ failure: true }, { drift: true }, { dirtyCleanup: true }, { synthetic: true }]) {
    const h = harness(options); const report = await verifyOnce(h.options);
    assert.equal(report.passed, false);
    assert.equal(h.calls.filter(c => c.path === "/api/load").length, options.synthetic ? 0 : 1);
    assert.equal(h.calls.filter(c => c.path === "/api/clear").length, options.synthetic ? 0 : 1);
    assert.doesNotMatch(JSON.stringify(report), /private-provider|synthetic-secret/);
  }
});