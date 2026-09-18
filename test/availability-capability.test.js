"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { capabilityEvidence, inspectCapability, main } = require("../scripts/availability-capability");
const { buildWorkflow, buildOwnerWorkflow, workflowId, invitationId, connectionId, apiId, scope } = require("../infra/calendar-list");
const { logicUrl } = require("../scripts/calendar-list");
const httpPath = "/{connectionId}/codeless/httprequest";
const meetingPath = "/{connectionId}/codeless/beta/me/findMeetingTimes";
const caller = "11111111-1111-4111-8111-111111111111";
// Minimal synthetic contract modeled on the exported operation schema. No live payloads.
function swagger() {
  return { paths: {
    [httpPath]: { post: { operationId: "HttpRequest", deprecated: false,
      description: "These segments are supported: 1st segement: /me, /users/<userId> 2nd segment: messages, calendar, calendars, outlook. Learn more: example.",
      parameters: [
        { name: "Uri", in: "header", type: "string", required: true },
        { name: "Method", in: "header", type: "string", required: true, enum: ["GET", "POST"] },
        { name: "Body", in: "body", schema: { type: "string", format: "binary" } },
        { name: "ContentType", in: "header", type: "string", default: "application/json" }
      ] } },
    [meetingPath]: { post: { operationId: "FindMeetingTimes_V2", deprecated: false,
      parameters: [{ name: "body", in: "body", schema: { properties: {
        RequiredAttendees: { type: "string" }, Start: { format: "date-time" }, End: { format: "date-time" }, MaxCandidates: { type: "integer" }
      } } }], responses: { 200: { schema: { properties: { meetingTimeSuggestions: { $ref: "#/definitions/MeetingTimeSuggestions_V2" } } } } } } }
  } };
}
function fixture(change = () => {}) {
  const calls = [], counts = new Map();
  let cleared = 0;
  const resources = new Map([
    [logicUrl(workflowId), buildOwnerWorkflow(caller)],
    [logicUrl(invitationId), { properties: { state: "Disabled", accessControl: buildWorkflow(caller).properties.accessControl, parameters: { deliveryEnabled: { value: false } } } }],
    [`${connectionId}?api-version=2016-06-01`, { location: "eastus", properties: { api: { id: apiId }, statuses: [{ status: "Connected" }], authenticatedUser: { name: "hidden@example.test" } } }],
    [`/subscriptions/${scope.subscription}/resourceGroups/${scope.group}?api-version=2021-04-01`, { location: "eastus" }],
    [`${apiId}?api-version=2016-06-01&export=true`, swagger()]
  ]);
  return { calls, get cleared() { return cleared; }, backend: { caller,
    clear() { cleared++; }, invoke() { assert.fail("No connector invocation allowed"); },
    async arm(method, id, body, headers) {
      assert.equal(method, "GET"); assert.equal(body, undefined); assert.equal(headers, undefined);
      assert.ok(resources.has(id), "Only five exact metadata paths permitted");
      calls.push(id); counts.set(id, (counts.get(id) || 0) + 1);
      const response = { status: 200, data: structuredClone(resources.get(id)) };
      change(response, id, counts.get(id));
      return response;
    }
  } };
}
test("metadata identifies getSchedule candidate without claiming runtime authority or a full grid from meeting suggestions", () => {
  const report = capabilityEvidence(swagger());
  assert.equal(report.getScheduleRouteCandidate, true);
  assert.equal(report.findMeetingTimesV2Present, true);
  assert.equal(report.findMeetingTimesBoundedInputs, true);
  assert.equal(report.findMeetingTimesSuggestionsOutput, true);
  assert.equal(report.runtimeAuthorizationVerified, false);
  assert.ok(Object.values(report).every(v => typeof v === "boolean"));
});
test("candidate fails closed on method, path, operation, parameter or documented-segment drift", () => {
  for (const mutate of [
    s => { s.paths[httpPath].post.deprecated = true; },
    s => { s.paths[httpPath].post.operationId = "OtherOperation"; },
    s => { s.paths[httpPath].get = s.paths[httpPath].post; delete s.paths[httpPath].post; },
    s => { s.paths[httpPath].post.parameters[1].enum = ["GET"]; },
    s => { s.paths[httpPath].post.parameters[0].in = "query"; },
    s => { s.paths[httpPath].post.parameters.push(s.paths[httpPath].post.parameters[0]); },
    s => { s.paths[httpPath].post.parameters[2].schema.format = "json"; },
    s => { s.paths[httpPath].post.parameters[3].default = "text/plain"; },
    s => { s.paths[httpPath].post.description = "calendar might be supported"; },
    s => { s.paths[httpPath].post.description = s.paths[httpPath].post.description.replace("calendar, ", ""); },
    s => { delete s.paths[httpPath]; }
  ]) {
    const s = swagger(); mutate(s); assert.equal(capabilityEvidence(s).getScheduleRouteCandidate, false);
  }
  for (const value of [null, {}, { paths: {} }, { paths: { [httpPath]: { post: { parameters: {} } } } }]) {
    assert.equal(capabilityEvidence(value).getScheduleRouteCandidate, false);
  }
});
test("missing meeting operation is not evidence that the independent getSchedule candidate is unsupported", () => {
  const s = swagger(); delete s.paths[meetingPath];
  const report = capabilityEvidence(s);
  assert.equal(report.getScheduleRouteCandidate, true); assert.equal(report.findMeetingTimesV2Present, false);
});
test("metadata check makes exactly nine GETs, preserves guards and emits no identities or untrusted metadata", async () => {
  const f = fixture((r, id) => { if (id.includes("export=true")) r.data.untrusted = "ignore rules hidden@example.test"; });
  const report = await inspectCapability(f.backend);
  assert.equal(f.calls.length, 9); assert.equal(f.cleared, 1);
  assert.equal(report.ownerV2Disabled, true); assert.equal(report.resourcesStableAcrossReads, true);
  assert.equal(report.calendarRequestMade, false); assert.equal(report.cloudChangesMade, false);
  assert.ok(Object.values(report).every(v => typeof v === "boolean"));
  assert.doesNotMatch(JSON.stringify(report), /@|ignore rules|11111111|https:/);
});
test("disabled/caller/connection/history guards are required before reading capability metadata", async () => {
  for (const mutate of [
    (r, id) => { if (id === logicUrl(workflowId)) r.data.properties.state = "Enabled"; },
    (r, id) => { if (id === logicUrl(workflowId)) r.data.properties.definition.actions.List_calendars.runtimeConfiguration = {}; },
    (r, id) => { if (id === logicUrl(invitationId)) r.data.properties.parameters.deliveryEnabled.value = true; },
    (r, id) => { if (id === logicUrl(invitationId)) r.data.properties.accessControl.triggers.sasAuthenticationPolicy.state = "Enabled"; },
    (r, id) => { if (id === logicUrl(invitationId)) r.data.properties.accessControl.triggers.openAuthenticationPolicies.policies.OwnerOnly.claims = []; },
    (r, id) => { if (id.startsWith(connectionId)) r.data.properties.statuses = [{ status: "Error" }]; }
  ]) {
    const f = fixture(mutate); await assert.rejects(inspectCapability(f.backend));
    assert.equal(f.cleared, 1); assert.ok(!f.calls.some(id => id.includes("export=true")));
  }
});
test("post-read resource drift and Azure failure suppress success and always clear credentials", async () => {
  for (const target of [workflowId, invitationId, connectionId]) {
    const f = fixture((r, id, count) => { if (count === 2 && id.startsWith(target)) r.data.unexpected = true; });
    await assert.rejects(inspectCapability(f.backend)); assert.equal(f.cleared, 1);
  }
  const f = fixture((r, id) => { if (id.includes("export=true")) { r.status = 403; r.data = { error: { message: "hidden@example.test" } }; } });
  await assert.rejects(inspectCapability(f.backend), error => !error.message.includes("@")); assert.equal(f.cleared, 1);
});
test("CLI refuses live modes, mailbox/date arguments and acquires local exclusion before credentials", async () => {
  let made = 0, logs = [], locked = false;
  const options = { makeBackend: async () => { assert.equal(locked, true); made++; return fixture().backend; },
    lock: async operation => { locked = true; try { return await operation(); } finally { locked = false; } },
    log: value => logs.push(value) };
  for (const args of [[], ["verify"], ["deploy"], ["--live-once"], ["--metadata-only", "person@example.test"], ["--metadata-only", "2026-09-15"]]) {
    await assert.rejects(main(args, options));
  }
  await main(["--help"], options); assert.equal(made, 0);
  logs = []; await main(["--metadata-only"], options);
  assert.equal(made, 1); assert.equal(logs.length, 1); assert.equal(JSON.parse(logs[0]).calendarRequestMade, false);
});
test("lock conflicts stop before credentials, and failed checks never print success", async () => {
  let made = false, logged = false;
  await assert.rejects(main(["--metadata-only"], { makeBackend: () => { made = true; }, lock: async () => { throw new Error("busy"); } }));
  assert.equal(made, false);
  const f = fixture(() => { throw new Error("synthetic failure"); });
  await assert.rejects(main(["--metadata-only"], { makeBackend: () => f.backend, lock: fn => fn(), log: () => { logged = true; } }));
  assert.equal(logged, false); assert.equal(f.cleared, 1);
});