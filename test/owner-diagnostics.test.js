"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { diagnose } = require("../scripts/diagnose-owner");
const { buildWorkflow, buildOwnerWorkflow, workflowId, invitationId, connectionId, apiId } = require("../infra/calendar-list");
const { logicUrl } = require("../scripts/calendar-list");
test("diagnostics read only bounded run/action metadata and never follow protected payload links", async () => {
  const caller = "11111111-1111-4111-8111-111111111111";
  let cleared = false;
  const backend = { caller, clear() { cleared = true; }, async arm(method, id) {
    assert.equal(method, "GET"); assert.ok(id.startsWith("/subscriptions/"));
    assert.doesNotMatch(id, /private-payload|inputs|outputs|enable|disable/);
    if (id === logicUrl(workflowId)) return { status: 200, data: buildOwnerWorkflow(caller) };
    if (id.includes("/runs?")) return { status: 200, data: { value: [{ name: "synthetic-run", properties: { status: "Succeeded", startTime: "2026-09-15T01:00:00Z", endTime: "2026-09-15T01:02:00Z" } }] } };
    if (id.includes("/actions?")) return { status: 200, data: { value: [{ name: "Summary", properties: { status: "Succeeded", outputsLink: { uri: "https://private-payload.example.test" } } }] } };
    if (id.startsWith(connectionId)) return { status: 200, data: { location: "eastus", properties: { api: { id: apiId }, statuses: [{ status: "Connected" }], changedTime: "2026-09-15T01:01:00Z" } } };
    if (id.startsWith(invitationId)) return { status: 200, data: { properties: { state: "Disabled", accessControl: buildWorkflow(caller).properties.accessControl, parameters: { deliveryEnabled: { value: false } } } } };
    assert.ok(id.includes("resourceGroups/vdi-prebuilt-dte?")); return { status: 200, data: { location: "eastus" } };
  } };
  const report = await diagnose(backend);
  assert.ok(cleared); assert.equal(report.Summary_succeeded, true); assert.equal(report.connectionChangedDuringLatestRun, true);
  assert.ok(Object.values(report).every(value => typeof value === "boolean"));
  assert.doesNotMatch(JSON.stringify(report), /synthetic-run|private-payload|2026-09/);
});