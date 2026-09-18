"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { scope, workflowId, connectionId, invitationId, apiId, operationPath, buildWorkflow, buildOwnerWorkflow } = require("../infra/calendar-list");
const { logicUrl, jsonRequest } = require("../scripts/calendar-list");
const { OwnerFailure, matches, status, update, projectOwnerList, preservedAfterLoad, load, ownerBackend } = require("../scripts/owner-calendar");
const caller = "11111111-1111-4111-8111-111111111111";
const callback = "https://prod-01.eastus.logic.azure.com/workflows/" + "a".repeat(32) + "/triggers/manual/paths/invoke?api-version=2019-05-01";
const sample = () => ({ status: 200, data: { status: "listed", count: 2, eventsRead: 0, completeness: "unknown", ownership: "unverified",
  calendars: [{ id: "synthetic-id-1", name: "Sample", owner: { address: "private@example.test" } }, { id: "synthetic-id-2", name: "<script>unsafe</script>" }] } });
function fake({ prior = false, etag = '"v1"', intercept, result = sample() } = {}) {
  let resource = (prior ? buildWorkflow : buildOwnerWorkflow)(caller), cleared = false;
  resource.id = workflowId; resource.name = scope.workflow; resource.type = "Microsoft.Logic/workflows";
  const calls = [], records = [];
  const backend = {
    caller,
    async arm(method, id, body, headers) {
      calls.push({ method, id, body, headers });
      const override = await intercept?.({ method, id, body, headers, resource, calls });
      if (override) return override;
      if (id === logicUrl(workflowId)) {
        if (method === "PUT") resource = structuredClone(body);
        return { status: 200, data: structuredClone(resource), etag };
      }
      if (id.startsWith(connectionId)) return { status: 200, data: { location: "eastus", properties: { api: { id: apiId }, statuses: [{ status: "Connected" }] } } };
      if (id.startsWith(invitationId)) return { status: 200, data: { properties: { state: "Disabled", accessControl: buildWorkflow(caller).properties.accessControl, parameters: { deliveryEnabled: { value: false } } } } };
      if (id.startsWith(apiId)) {
        const operation = {
          operationId: "CalendarGetTables_V2", deprecated: false,
          parameters: ["top", "skip"].map(name => ({ name, in: "query", type: "integer" })),
          responses: { 200: { schema: { properties: { value: { type: "array" } } } } }
        };
        return { status: 200, data: { paths: { [`/{connectionId}${operationPath}`]: { get: operation } } } };
      }
      if (id.includes("/listCallbackUrl")) return { status: 200, data: { value: callback } };
      if (id.includes("/enable")) { resource.properties.state = "Enabled"; return { status: 200 }; }
      if (id.includes("/disable")) { resource.properties.state = "Disabled"; return { status: 200 }; }
      if (!id.includes("/providers/")) return { status: 200, data: { location: "eastus" } };
      assert.fail("Unexpected ARM path");
    },
    async invoke(url, authorization, options) {
      assert.equal(url, callback); assert.equal(authorization, "valid"); assert.equal(options.ownerList, true);
      calls.push({ invoke: true });
      return typeof result === "function" ? result(options) : structuredClone(result);
    },
    clear() { cleared = true; }
  };
  return { backend, calls, records, record: value => records.push(value), get cleared() { return cleared; } };
}

test("v2 changes only projection and contract tag; existing caller/connector/path/schema remain exact", () => {
  const before = buildWorkflow(caller), after = buildOwnerWorkflow(caller);
  assert.deepEqual(after.properties.accessControl, before.properties.accessControl);
  assert.deepEqual(after.properties.parameters, before.properties.parameters);
  const a = after.properties.definition.actions;
  assert.deepEqual(a.List_calendars, before.properties.definition.actions.List_calendars);
  assert.deepEqual(a.Validate_list, before.properties.definition.actions.Validate_list);
  assert.deepEqual(a.Owner_labels.inputs.select, { id: "@item()['id']", name: "@item()['name']" });
  assert.deepEqual(a.Owner_labels.runtimeConfiguration.secureData.properties, ["inputs", "outputs"]);
  assert.deepEqual(a.Summary.runAfter, { Owner_labels: ["Succeeded"] });
  assert.equal(a.Summary.inputs.body.calendars, "@body('Owner_labels')");
  delete a.Owner_labels; delete a.Invalid_projection;
  a.Summary = before.properties.definition.actions.Summary;
  after.tags.contract = before.tags.contract;
  assert.deepEqual(after, before);
});

test("strict envelope refuses unknown drift, wrong resource identities and optional new configurable properties", () => {
  for (const mutate of [w => { w.identity = {}; }, w => { w.properties.integrationAccount = {}; }, w => { w.properties.newOption = true; },
    w => { w.id = invitationId; }, w => { w.name = scope.invitation; }, w => { w.properties.definition.actions.Unknown = {}; },
    w => { w.properties.accessControl.triggers.sasAuthenticationPolicy.state = "Enabled"; }]) {
    const w = buildOwnerWorkflow(caller); mutate(w); assert.equal(matches(w, caller), false);
  }
  assert.equal(matches(buildOwnerWorkflow(caller), caller), true);
  assert.equal(matches(buildWorkflow(caller), caller), false);
});

test("documented exact PUT works without ETag and never invents a version precondition", async () => {
  const f = fake({ prior: true, etag: null });
  const report = await update(f.backend);
  assert.equal(report.atomicCompareAndSwap, false);
  assert.equal(f.calls.find(c => c.method === "PUT").headers, undefined);
});

test("narrow update requires disabled v1, stable snapshots and final GET immediately before one exact PUT", async () => {
  const f = fake({ prior: true });
  const report = await update(f.backend);
  assert.equal(report.status, "updated_disabled");
  const writes = f.calls.filter(c => c.method !== "GET");
  assert.equal(writes.length, 1); assert.equal(writes[0].method, "PUT");
  assert.equal(writes[0].id, logicUrl(workflowId)); assert.equal(writes[0].headers, undefined);
  const fence = f.calls[f.calls.indexOf(writes[0]) - 1];
  assert.equal(fence.method, "GET"); assert.equal(fence.id, logicUrl(workflowId));
  assert.equal(writes[0].body.properties.state, "Disabled"); assert.ok(f.cleared);
});

test("collision, prior drift, version races and 412 stop without overwrite or retry", async () => {
  for (const options of [ {},
    { prior: true, intercept: ({ resource }) => { resource.properties.integrationAccount = {}; } },
    { prior: true, intercept: ({ id, calls }) => id === logicUrl(workflowId) && calls.filter(c => c.id === id).length === 2 ?
      { status: 200, data: { ...buildWorkflow(caller), properties: { ...buildWorkflow(caller).properties, version: "changed" } } } : null }
  ]) {
    const f = fake(options); await assert.rejects(update(f.backend));
    assert.ok(f.calls.every(c => c.method === "GET")); assert.ok(f.cleared);
  }
  const f = fake({ prior: true, intercept: ({ method }) => method === "PUT" ? { status: 412 } : null });
  await assert.rejects(update(f.backend), /update_conflict/);
  assert.equal(f.calls.filter(c => c.method === "PUT").length, 1);
});

test("status is safe, read-only and lists no calendars even for missing ETag", async () => {
  const f = fake({ prior: true, etag: null }); const report = await status(f.backend);
  assert.equal(report.contract, "list-only-v1"); assert.equal(report.sasDisabled, true);
  assert.equal(report.calendarRequestMade, false); assert.ok(f.calls.every(c => c.method === "GET"));
  assert.doesNotMatch(JSON.stringify(report), /synthetic-id|Sample|accessEndpoint|https:/);
});

test("owner load returns minimal opaque keys after one invoke and verified disable", async () => {
  const f = fake(); const result = await load(f.backend, { record: f.record });
  assert.equal(result.calendars.length, 2); assert.equal(result.eventsRead, 0);
  assert.ok(result.calendars.every(c => Object.keys(c).sort().join() === "key,name"));
  assert.doesNotMatch(JSON.stringify(result), /synthetic-id|private@example.test/);
  assert.equal(f.calls.filter(c => c.invoke).length, 1);
  assert.deepEqual(f.records, ["cleanup_pending", "workflow_disabled"]); assert.ok(f.cleared);
  assert.ok(f.calls.filter(c => c.method === "POST").every(c => c.id.startsWith(workflowId)));
});

test("no list and no enable on v1, drift, revoked policy or cancelled startup", async () => {
  const cancelled = new AbortController(); cancelled.abort();
  for (const [options, signal] of [[{ prior: true }], [{ intercept: ({ resource }) => { resource.properties.definition.actions.Extra = {}; } }], [{}, cancelled.signal]]) {
    const f = fake(options); await assert.rejects(load(f.backend, { signal, record: f.record }));
    assert.ok(f.calls.every(c => c.method === "GET")); assert.ok(f.cleared);
  }
});

test("cancel after accepted enable fences invoke but still disables", async () => {
  const controller = new AbortController();
  const f = fake({ intercept: ({ id, resource }) => {
    if (id.includes("/enable")) { resource.properties.state = "Enabled"; controller.abort(); return { status: 200 }; }
  } });
  await assert.rejects(load(f.backend, { signal: controller.signal, record: f.record }), /cancelled/);
  assert.equal(f.calls.filter(c => c.invoke).length, 0); assert.deepEqual(f.records, ["cleanup_pending", "workflow_disabled"]);
});

test("aborted in-flight and late successful response never restore calendars; cleanup independent of abort", async () => {
  const controller = new AbortController();
  const f = fake({ result: async () => { controller.abort(); return sample(); } });
  await assert.rejects(load(f.backend, { signal: controller.signal, record: f.record }), /cancelled/);
  assert.equal(f.calls.filter(c => c.invoke).length, 1); assert.deepEqual(f.records, ["cleanup_pending", "workflow_disabled"]);
});

test("enable ambiguity, failed disable or failed verification records sticky cleanup failure", async () => {
  for (const intercept of [
    ({ id }) => { if (id.includes("/enable")) throw new Error("private data"); },
    ({ id }) => { if (id.includes("/disable")) throw new Error("private data"); },
    ({ id, calls }) => id === logicUrl(workflowId) && calls.some(c => c.id.includes("/disable")) ? { status: 503 } : null
  ]) {
    const f = fake({ intercept }); await assert.rejects(load(f.backend, { record: f.record }), /cleanup_failed/);
    assert.equal(f.calls.filter(c => c.id?.includes("/disable")).length, 1);
    assert.deepEqual(f.records, ["cleanup_pending", "cleanup_failed"]); assert.ok(f.cleared);
  }
});

test("invalid lists and provider errors are fail-closed, empty is not complete, addresses and control text removed", () => {
  for (const change of [d => { d.calendars[1].id = d.calendars[0].id; }, d => { d.calendars[0].name = null; },
    d => { d.calendars[0].id = ""; }, d => { d.count = 3; }, d => { d.calendars[0].name = "x".repeat(1025); }]) {
    const r = sample(); change(r.data); assert.throws(() => projectOwnerList(r));
  }
  const r = sample(); r.data.calendars[0].name = "private@example.test\u202e calendar";
  assert.equal(projectOwnerList(r).calendars[0].name, "[address hidden] calendar");
  const empty = sample(); empty.data = { ...empty.data, status: "empty", count: 0, calendars: [] };
  assert.equal(projectOwnerList(empty).completeness, "unknown");
  assert.throws(() => projectOwnerList({ status: 502, data: { status: "provider_unavailable", eventsRead: 0, providerHttpStatus: 403 } }), /revoked/);
});

test("live transport propagates abort and ETag without echoing errors", async () => {
  const signal = new AbortController().signal;
  const result = await jsonRequest("https://synthetic.example.test", { signal }, async (_url, options) => {
    assert.ok(options.signal); return new Response("{}", { headers: { etag: '"version"' } });
  });
  assert.equal(result.etag, '"version"');
});

test("async credential backend restricts exact ARM paths and never leaks tokens into command arguments", async () => {
  const p = { oid: caller, tid: scope.tenant, iss: `https://sts.windows.net/${scope.tenant}/`, appid: scope.application, aud: scope.audience, exp: 9999999999 };
  const token = `header.${Buffer.from(JSON.stringify(p)).toString("base64url")}.signature`;
  const commands = [], requests = [], controller = new AbortController();
  const backend = await ownerBackend(controller.signal, async args => {
    commands.push(args); return args.includes("get-access-token") ? token : args[0] === "ad" ? caller : { tenant: scope.tenant, state: "Enabled" };
  }, async (url, options) => { requests.push({ url, options }); return { status: 200 }; });
  assert.doesNotMatch(JSON.stringify(commands), /header\./);
  for (const [method, id] of [["POST", logicUrl(invitationId, "/enable")], ["PUT", `${connectionId}?api-version=2016-06-01`], ["GET", `${workflowId}/runs?api-version=2019-05-01`]]) {
    assert.throws(() => backend.arm(method, id), /blocked/);
  }
  await backend.arm("GET", logicUrl(workflowId)); assert.equal(requests.length, 1);
  assert.equal(requests[0].options.signal, controller.signal);
  controller.abort();
  await backend.arm("POST", logicUrl(workflowId, "/disable"));
  await backend.arm("GET", logicUrl(workflowId));
  assert.equal(requests[1].options.signal, undefined); assert.equal(requests[2].options.signal, undefined);
  backend.clear(); await assert.rejects(backend.invoke(callback, "valid", { ownerList: true }));
});

module.exports = { fake, sample };

test("post-list comparison permits only a valid advancing connection changedTime, never unknown/config/auth drift", () => {
  const before = { connection: { properties: { changedTime: "2026-09-15T01:00:00Z", statuses: [{ status: "Connected" }], parameterValues: {} } }, invitation: { disabled: true } };
  const after = structuredClone(before); after.connection.properties.changedTime = "2026-09-15T01:01:00Z";
  assert.equal(preservedAfterLoad(before, after), true);
  for (const mutate of [
    x => { x.connection.properties.changedTime = "invalid"; },
    x => { x.connection.properties.changedTime = "2026-09-14T01:01:00Z"; },
    x => { delete x.connection.properties.changedTime; },
    x => { x.connection.properties.statuses[0].status = "Error"; },
    x => { x.connection.properties.parameterValues.account = "other-synthetic"; },
    x => { x.connection.properties.unknown = true; },
    x => { x.connection.etag = "changed"; },
    x => { x.invitation.disabled = false; }
  ]) {
    const changed = structuredClone(after); mutate(changed); assert.equal(preservedAfterLoad(before, changed), false);
  }
});

test("live lifecycle accepts connector timestamp advance only after invocation; keeps pre-invoke and update fences strict", async () => {
  const connection = timestamp => ({ location: "eastus", properties: { changedTime: timestamp, api: { id: apiId }, statuses: [{ status: "Connected" }] } });
  for (const stage of ["after", "before", "update"]) {
    const f = fake({ prior: stage === "update", intercept: ({ id, calls }) => {
      if (!id.startsWith(connectionId)) return;
      const changed = stage === "after" ? calls.some(c => c.invoke) : calls.filter(c => c.id?.startsWith(connectionId)).length > 1;
      return { status: 200, data: connection(changed ? "2026-09-15T01:01:00Z" : "2026-09-15T01:00:00Z") };
    } });
    if (stage === "after") assert.equal((await load(f.backend, { record: f.record })).count, 2);
    else await assert.rejects(stage === "update" ? update(f.backend) : load(f.backend, { record: f.record }));
    assert.equal(f.calls.filter(c => c.invoke).length, stage === "after" ? 1 : 0);
    if (stage === "update") assert.equal(f.calls.filter(c => c.method === "PUT").length, 0);
  }
});

test("isolated loopback E2E traverses real proxy and backend lifecycle with synthetic provider data only", async t => {
  const http = require("node:http");
  const { once } = require("node:events");
  const { createServer } = require("../scripts/serve-owner");
  const { verifyOnce } = require("../scripts/verify-owner");
  const f = fake();
  const server = createServer({ perform: options => load(f.backend, options) });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  t.after(() => server.shutdown());
  const request = (path, body, csrf) => new Promise((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port: server.address().port, path, method: body === undefined ? "GET" : "POST",
      headers: { Host: "localhost:8002", ...(body === undefined ? {} : { Origin: "http://localhost:8002", "Content-Type": "application/json", "X-Owner-CSRF": csrf }) }
    }, res => {
      let text = ""; res.setEncoding("utf8"); res.on("data", chunk => { text += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, text }));
    }); req.on("error", reject); req.end(body === undefined ? undefined : JSON.stringify(body));
  });
  const report = await verifyOnce({ request, inspect: async () => ({ synthetic: true }) });
  assert.equal(report.passed, true); assert.equal(report.count, 2);
  assert.equal(f.calls.filter(c => c.invoke).length, 1);
  assert.equal(f.calls.filter(c => c.id?.includes("/disable")).length, 1);
  assert.equal(report.sessionRevoked, true);
});

test("updates refuse preserved-resource drift before PUT and detect post-write contract drift", async () => {
  for (const after of [false, true]) {
    const f = fake({ prior: true, intercept: ({ method, id, resource, calls }) => {
      if (after && method === "GET" && id === logicUrl(workflowId) && calls.some(c => c.method === "PUT")) resource.tags.unapproved = "drift";
      if (!after && id.startsWith(connectionId) && calls.filter(c => c.id.startsWith(connectionId)).length === 2) {
        return { status: 200, data: { location: "eastus", tags: { changed: true }, properties: { api: { id: apiId }, statuses: [{ status: "Connected" }] } } };
      }
    } });
    await assert.rejects(update(f.backend), /update_conflict|contract_drift/);
    assert.equal(f.calls.filter(c => c.method === "PUT").length, after ? 1 : 0);
    assert.ok(f.cleared);
  }
});

test("update transport permits one exact v2 PUT only, forbids enable/invoke/headers/arbitrary bodies", async () => {
  const p = { oid: caller, tid: scope.tenant, iss: `https://sts.windows.net/${scope.tenant}/`, appid: scope.application, aud: scope.audience, exp: 9999999999 };
  const token = `header.${Buffer.from(JSON.stringify(p)).toString("base64url")}.signature`;
  let writes = 0;
  const backend = await ownerBackend(undefined, async args => args.includes("get-access-token") ? token : args[0] === "ad" ? caller : { tenant: scope.tenant, state: "Enabled" },
    async () => { writes++; return { status: 200 }; }, "update");
  assert.throws(() => backend.arm("POST", logicUrl(workflowId, "/enable")), /blocked/);
  assert.throws(() => backend.invoke(callback, "valid"), /blocked/);
  assert.throws(() => backend.arm("PUT", logicUrl(workflowId), buildWorkflow(caller)), /blocked/);
  assert.throws(() => backend.arm("PUT", logicUrl(workflowId), buildOwnerWorkflow(caller), { "If-Match": "*" }), /blocked/);
  await backend.arm("PUT", logicUrl(workflowId), buildOwnerWorkflow(caller));
  assert.throws(() => backend.arm("PUT", logicUrl(workflowId), buildOwnerWorkflow(caller)), /blocked/);
  assert.equal(writes, 1); backend.clear();
});