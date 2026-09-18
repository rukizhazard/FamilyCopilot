"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { capabilityEvidence, inspect, main } = require("../scripts/child-calendar-preflight");
const { OwnerFailure } = require("../scripts/owner-calendar");
const { scope, apiId, connectionId, invitationId, workflowId: ownerId, buildOwnerWorkflow } = require("../infra/calendar-list");
const { workflowId, buildOctoberAvailability } = require("../infra/availability");
const { logicUrl } = require("../scripts/calendar-list");
const caller = "11111111-1111-4111-8111-111111111111";
const httpPath = "/{connectionId}/codeless/httprequest";
// Deliberately fictional native path: discovery must not guess a deployed path.
const nativePath = "/{connectionId}/synthetic/{calendarId}/view";
function swagger() {
  return { paths: {
    [httpPath]: { post: { operationId: "HttpRequest", deprecated: false,
      description: "1st segement: /me, /users/<userId> 2nd segment: messages, calendar, calendars, outlook. Learn more.",
      parameters: [{ name: "Uri", in: "header", required: true, type: "string" },
        { name: "Method", in: "header", required: true, type: "string", enum: ["GET", "POST"] }] } },
    [nativePath]: { get: { operationId: "GetEventsCalendarViewV3", deprecated: false,
      parameters: ["calendarId", "startDateTimeUtc", "endDateTimeUtc"].map(name => ({ name,
        in: name === "calendarId" ? "path" : "query", type: "string", required: true })) } }
  } };
}
function fixture(mutate = () => {}) {
  const calls = [], counts = new Map(); let cleared = 0;
  const resources = new Map([
    [logicUrl(ownerId), buildOwnerWorkflow(caller)], [logicUrl(workflowId), buildOctoberAvailability(caller)],
    [logicUrl(invitationId), { properties: { state: "Disabled", accessControl: buildOwnerWorkflow(caller).properties.accessControl,
      parameters: { deliveryEnabled: { value: false } } } }],
    [`${connectionId}?api-version=2016-06-01`, { location: "eastus", properties: { api: { id: apiId }, statuses: [{ status: "Connected" }] } }],
    [`/subscriptions/${scope.subscription}/resourceGroups/${scope.group}?api-version=2021-04-01`, { location: "eastus" }],
    [`${apiId}?api-version=2016-06-01&export=true`, swagger()]
  ]);
  return { calls, get cleared() { return cleared; }, backend: { caller, clear() { cleared++; },
    invoke() { assert.fail("Never invoke a provider"); }, async arm(method, id, body, headers) {
      assert.equal(method, "GET"); assert.equal(body, undefined); assert.equal(headers, undefined);
      assert.ok(resources.has(id), "Only six fixed metadata endpoints"); calls.push(id);
      counts.set(id, (counts.get(id) || 0) + 1);
      const result = { status: 200, data: structuredClone(resources.get(id)) };
      mutate(result, id, counts.get(id)); return result;
    } } };
}
test("child preflight independently recognizes native and HTTP candidates, never runtime or sharing permission", () => {
  assert.deepEqual(capabilityEvidence(swagger()), { httpGetCalendarCandidate: true, nativeViewCandidate: true,
    runtimeAuthorizationVerified: false, sharedCalendarVisibilityVerified: false, selectSupportVerified: false });
  const s = swagger(); delete s.paths[httpPath];
  assert.equal(capabilityEvidence(s).nativeViewCandidate, true);
  assert.equal(capabilityEvidence(s).httpGetCalendarCandidate, false);
});
test("child preflight rejects malformed, ambiguous, deprecated and wrong-method metadata", () => {
  for (const value of [null, {}, { paths: [] }, { paths: { [httpPath]: { post: { parameters: {} } } } }]) {
    assert.equal(capabilityEvidence(value).httpGetCalendarCandidate, false);
    assert.equal(capabilityEvidence(value).nativeViewCandidate, false);
  }
  for (const change of [s => { s.paths[httpPath].post.parameters[1].enum = ["POST"]; },
    s => { s.paths[httpPath].post.deprecated = true; },
    s => { s.paths[httpPath].post.parameters.push(s.paths[httpPath].post.parameters[0]); },
    s => { s.paths[httpPath].post.description = "maybe calendar"; }]) {
    const s = swagger(); change(s); assert.equal(capabilityEvidence(s).httpGetCalendarCandidate, false);
  }
  for (const change of [s => { s.paths[nativePath].get.parameters[1].required = false; },
    s => { s.paths[nativePath].get.deprecated = true; },
    s => { s.paths[nativePath].get.parameters[0].in = "query"; },
    s => { s.paths["/{connectionId}/duplicate"] = s.paths[nativePath]; }]) {
    const s = swagger(); change(s); assert.equal(capabilityEvidence(s).nativeViewCandidate, false);
  }
});
test("child metadata preflight performs eleven exact GETs, checks v5/v2 preservation and clears credentials", async () => {
  const f = fixture((r, id) => { if (id.includes("export=true")) r.data.untrusted = "private@example.test secret"; });
  const result = await inspect(f.backend);
  assert.equal(f.calls.length, 11); assert.equal(f.cleared, 1);
  assert.equal(result.availabilityV5Disabled, true); assert.equal(result.ownerV2Disabled, true);
  assert.equal(result.calendarQueries, 0); assert.equal(result.cloudChanges, false);
  assert.doesNotMatch(JSON.stringify(result), /private|secret|11111111|https:|synthetic/);
});
test("child preflight stops before Swagger on unexpected preserved state or history protections", async () => {
  for (const change of [
    (r, id) => { if (id === logicUrl(workflowId)) r.data.properties.state = "Enabled"; },
    (r, id) => { if (id === logicUrl(ownerId)) r.data.properties.definition.actions.List_calendars.runtimeConfiguration = {}; },
    (r, id) => { if (id === logicUrl(invitationId)) r.data.properties.parameters.deliveryEnabled.value = true; },
    (r, id) => { if (id.startsWith(connectionId)) r.data.properties.statuses[0].status = "Error"; }
  ]) {
    const f = fixture(change); await assert.rejects(inspect(f.backend)); assert.equal(f.cleared, 1);
    assert.equal(f.calls.some(id => id.includes("export=true")), false);
  }
});
test("child preflight detects drift in every preserved resource without a write or retry", async () => {
  for (const target of [workflowId, ownerId, invitationId, connectionId]) {
    const f = fixture((r, id, count) => { if (id.startsWith(target) && count === 2) r.data.unexpected = true; });
    await assert.rejects(inspect(f.backend)); assert.equal(f.cleared, 1);
  }
});
test("child preflight reports exact credential failure stage without IDs, raw errors or further requests", async () => {
  const calls = [], logs = []; let locked = false;
  const result = await main(["--metadata-only"], { lock: async fn => { locked = true; return fn(); },
    read: async args => { assert.equal(locked, true); calls.push(args[0]); if (args[0] === "ad") throw new Error("private@example.test token=secret"); return {}; },
    makeBackend: async read => { await read(["account", "show"]); await read(["ad", "signed-in-user", "show"]); assert.fail("Must stop"); },
    log: text => logs.push(text) });
  assert.deepEqual(calls, ["account", "ad"]); assert.equal(logs.length, 1);
  assert.equal(result.stage, "signed_in_user"); assert.equal(result.status, "preflight_blocked");
  assert.doesNotMatch(logs[0], /private|secret|@/); assert.equal(result.automaticRetry, false);
});
test("child preflight rejects live and deployment arguments before credentials; help is offline", async () => {
  let called = false;
  const options = { makeBackend: async () => { called = true; assert.fail(); }, log() {} };
  for (const args of [[], ["deploy"], ["verify"], ["--live-once"], ["--metadata-only", "calendar-id"]]) {
    const result = await main(args, options); assert.equal(result.stage, "arguments"); assert.equal(result.code, "blocked");
  }
  await main(["--help"], options); assert.equal(called, false);
});
test("child preflight lock conflict stops before credentials and uses fixed output", async () => {
  let called = false;
  const result = await main(["--metadata-only"], { makeBackend: () => { called = true; },
    lock: async () => { throw new Error("owner_operation_busy"); }, log() {} });
  assert.equal(called, false); assert.equal(result.stage, "operation_lock"); assert.equal(result.code, "busy");
});
test("child preflight returns guarded metadata success only after cleanup", async () => {
  const f = fixture(); const logs = [];
  const result = await main(["--metadata-only"], { makeBackend: () => f.backend, lock: fn => fn(),
    log: text => { assert.equal(f.cleared, 1); logs.push(text); } });
  assert.equal(result.status, "metadata_inspected"); assert.equal(logs.length, 1);
});
test("child preflight labels contract failure stage and does not expose arbitrary Azure error details", async () => {
  const f = fixture((r, id) => { if (id.includes("export=true")) throw new OwnerFailure("unavailable"); });
  const result = await main(["--metadata-only"], { makeBackend: () => f.backend, lock: fn => fn(), log() {} });
  assert.equal(result.stage, "connector_metadata"); assert.equal(result.code, "unavailable");
  assert.equal(f.cleared, 1); assert.equal(result.calendarQueries, 0);
});