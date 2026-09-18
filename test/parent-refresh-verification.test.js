"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { verifyRefresh, requestLocal } = require("../scripts/verify-parent-refresh");
const { liveWindow } = require("../owner/availability-core");
function fixture(overrides = {}) {
  const calls = [], page = Object.entries({ "owner-csrf": "a".repeat(64), "owner-mode": "live", "owner-cache": "disk",
    "owner-contract": "bounded-availability-v5", "owner-range": "configurable-v1", "owner-saved": "preserve-v1", ...overrides.meta })
    .map(([name, value]) => `<meta name="${name}" content="${value}">`).join("");
  let inspections = 0;
  return { calls, get inspections() { return inspections; },
    request: async (path, body, csrf) => {
      calls.push({ path, body });
      if (path === "/") return { status: 200, text: page };
      assert.equal(csrf, "a".repeat(64));
      if (path === "/api/status") return { status: 200, text: JSON.stringify({ status: "idle", cleanup: "workflow_disabled", synthetic: false, ...overrides.idle }) };
      assert.equal(path, "/api/availability");
      const data = { window: liveWindow, checkedAt: "2026-09-17T00:00:00Z", people: [0, 1].map(person => ({ person, status: "checked", slots: Array(336).fill("busy") })),
        cached: false, cleanup: "workflow_disabled", synthetic: false, ...overrides.body };
      return { status: overrides.httpStatus || 200, text: JSON.stringify(data) };
    },
    inspect: async () => { inspections++;
      if (overrides.inspectFails) throw Error("sensitive diagnostic");
      return { status: "disabled_verified", execution: "windows-native-v1", availabilityV5Disabled: true, ownerV2Disabled: true,
        sasDisabled: true, extensionsRemoved: true, preservedResourcesUnchanged: true, connectorConnected: true, invitationDisabled: true, deliveryOff: true };
    }
  };
}
test("one exact October refresh, redacted output, independent readback and no clear", async () => {
  const f = fixture(), result = await verifyRefresh(f);
  assert.equal(result.success, true); assert.deepEqual(result.slotCounts, [336, 336]);
  assert.deepEqual(f.calls.map(c => c.path), ["/", "/api/status", "/api/availability", "/api/status"]);
  const body = f.calls[2].body;
  assert.deepEqual({ ...body, requestId: "id" }, { acknowledged: true, refresh: true, startDate: "2026-10-09", endDate: "2026-10-15", requestId: "id" });
  assert.equal(f.inspections, 1);
  assert.doesNotMatch(JSON.stringify(result), /checkedAt|2026-|slots|aaaaa/);
  assert.throws(() => requestLocal("/api/clear"), /blocked/);
});
for (const meta of [{ "owner-mode": "synthetic" }, { "owner-contract": "bounded-availability-v4" }, { "owner-cache": "memory" }]) {
  test(`wrong page fails before refresh: ${JSON.stringify(meta)}`, async () => {
    const f = fixture({ meta }), result = await verifyRefresh(f);
    assert.equal(result.refreshSubmitted, false); assert.equal(result.success, false); assert.equal(f.inspections, 0);
    assert.ok(f.calls.every(c => c.path !== "/api/availability"));
  });
}
for (const body of [{ cached: true }, { cleanup: "cleanup_failed" }, { synthetic: true }, { people: [] }]) {
  test(`invalid refresh cannot pass or retry: ${JSON.stringify(body)}`, async () => {
    const f = fixture({ body }), result = await verifyRefresh(f);
    assert.equal(result.success, false); assert.equal(f.calls.filter(c => c.path === "/api/availability").length, 1);
    assert.equal(f.inspections, 1); assert.equal(result.automaticRetry, false);
  });
}
test("generic failure is reported without provider text or cached fallback", async () => {
  const f = fixture({ httpStatus: 503, body: { status: "unavailable", cleanup: "not_requested", privateText: "secret" } });
  const result = await verifyRefresh(f);
  assert.equal(result.status, "unavailable"); assert.equal(result.success, false);
  assert.doesNotMatch(JSON.stringify(result), /secret/);
});
test("independent disabled readback is required for success", async () => {
  const result = await verifyRefresh(fixture({ inspectFails: true }));
  assert.equal(result.status, "checked"); assert.equal(result.success, false); assert.equal(result.disabledVerified, false);
});
test("busy local status cannot submit a refresh", async () => {
  const f = fixture({ idle: { status: "busy" } }), result = await verifyRefresh(f);
  assert.equal(result.refreshSubmitted, false); assert.equal(f.inspections, 0);
});