"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { scope, workflowId, invitationId, connectionId, apiId, operationPath, pageSize, buildWorkflow } = require("../infra/calendar-list");
const { SafeFailure, safeCode, cli, jsonRequest, tokenMatches, operationVerified, workflowMatches,
  callbackUrl, projectSummary, createBackend, run } = require("../scripts/calendar-list");
const caller = "11111111-1111-4111-8111-111111111111";
const url = "https://prod-01.eastus.logic.azure.com/workflows/" + "a".repeat(32) + "/triggers/manual/paths/invoke?api-version=2016-10-01";
const summary = { status: "listed", count: 2, completeness: "unknown", ownership: "unverified", eventsRead: 0 };
const metadata = () => ({ paths: { [`/{connectionId}${operationPath}`]: { get: {
  operationId: "CalendarGetTables_V2", deprecated: false,
  parameters: ["top", "skip"].map(name => ({ name, in: "query", type: "integer" })),
  responses: { 200: { schema: { properties: { value: { type: "array" } } } } }
} } } });

function fake({ present = false, denial = 401, live = { status: 200, data: summary }, mutate, enableFailure = false, disableFailure = false } = {}) {
  let resource = present ? buildWorkflow(caller) : null;
  let cleared = false;
  const calls = [];
  const logs = [];
  const backend = {
    caller,
    async arm(method, id, body, headers) {
      calls.push({ method, id, body, headers });
      if (mutate) { const override = mutate({ method, id, body, resource, calls }); if (override) return override; }
      if (id.includes("/resourceGroups/") && !id.includes("/providers/")) return { status: 200, data: { location: "eastus" } };
      if (id.startsWith(connectionId)) return { status: 200, data: { location: "eastus", properties: { api: { id: apiId }, statuses: [{ status: "Connected" }] } } };
      if (id.startsWith(invitationId)) return { status: 200, data: { properties: {
        state: "Disabled", accessControl: buildWorkflow(caller).properties.accessControl, parameters: { deliveryEnabled: { value: false } }
      } } };
      if (id.startsWith(apiId)) return { status: 200, data: metadata() };
      assert.ok(id.startsWith(workflowId));
      if (id.includes("/listCallbackUrl")) return { status: 200, data: { value: url } };
      if (id.includes("/enable")) { resource.properties.state = "Enabled"; if (enableFailure) throw new SafeFailure(); return { status: 200 }; }
      if (id.includes("/disable")) { if (disableFailure) throw new SafeFailure(); resource.properties.state = "Disabled"; return { status: 200 }; }
      if (method === "PUT") { resource = structuredClone(body); return { status: 201, data: resource }; }
      return resource ? { status: 200, data: structuredClone(resource) } : { status: 404, data: { error: { code: "ResourceNotFound" } } };
    },
    async invoke(endpoint, authorization) {
      assert.equal(endpoint, url); calls.push({ invoke: authorization });
      if (authorization !== "valid") return { status: denial, data: { secret: "synthetic-private-value" } };
      if (live instanceof Error) throw live;
      return live;
    },
    clear() { cleared = true; }
  };
  return { backend, calls, logs, log: text => logs.push(text), get cleared() { return cleared; } };
}

test("list workflow has a single fixed connector GET and no events, mail, writes, recurrence or pagination", () => {
  const w = buildWorkflow(caller);
  assert.equal(w.properties.state, "Disabled");
  assert.equal(w.location, "eastus");
  const d = w.properties.definition;
  assert.deepEqual(Object.keys(d.triggers), ["manual"]);
  const api = Object.values(d.actions).filter(a => a.type === "ApiConnection");
  assert.equal(api.length, 1);
  assert.equal(api[0].inputs.method, "get");
  assert.equal(api[0].inputs.path, operationPath);
  assert.deepEqual(api[0].inputs.queries, { top: 100, skip: 0 });
  assert.deepEqual(api[0].inputs.retryPolicy, { type: "none" });
  assert.deepEqual(api[0].limit, { timeout: "PT1M" });
  assert.doesNotMatch(JSON.stringify(w), /Recurrence|Foreach|Until|paginationPolicy|\/events|\/Mail|Microsoft.DocumentDB|Microsoft.Storage|trackedProperties/);
  assert.deepEqual(d.outputs, {});
  assert.deepEqual(w.properties.parameters.$connections.value.office365, { id: apiId, connectionId, connectionName: scope.connection });
});

test("exact owner caller policy, SAS disabled, no arbitrary input, all sensitive history protected", () => {
  const w = buildWorkflow(caller);
  const acl = w.properties.accessControl;
  assert.equal(acl.triggers.sasAuthenticationPolicy.state, "Disabled");
  const policies = Object.values(acl.triggers.openAuthenticationPolicies.policies);
  assert.equal(policies.length, 1);
  assert.deepEqual(policies[0], { type: "AAD", claims: [
    { name: "iss", value: `https://sts.windows.net/${scope.tenant}/` }, { name: "aud", value: scope.audience },
    { name: "oid", value: caller }, { name: "appid", value: scope.application }
  ] });
  assert.deepEqual(acl.contents.allowedCallerIpAddresses, [{ addressRange: "0.0.0.0-0.0.0.0" }]);
  const d = w.properties.definition;
  assert.deepEqual(d.triggers.manual.inputs, { method: "POST", schema: { type: "object", properties: {}, additionalProperties: false } });
  assert.equal(d.triggers.manual.operationOptions, "EnableSchemaValidation");
  assert.deepEqual(d.triggers.manual.runtimeConfiguration.secureData.properties, ["outputs"]);
  for (const a of Object.values(d.actions)) {
    assert.deepEqual(a.runtimeConfiguration.secureData.properties, a.type === "ApiConnection" ? ["inputs", "outputs"] : ["inputs"]);
    if (a.type === "Response") assert.equal(a.inputs.headers["Cache-Control"], "no-store");
  }
  assert.equal(d.actions.Validate_list.inputs.schema.properties.value.maxItems, pageSize);
  assert.deepEqual(d.actions.Summary.runAfter, { Validate_list: ["Succeeded"] });
  assert.deepEqual(d.actions.Unavailable.runAfter, { List_calendars: ["Failed", "TimedOut"] });
  assert.deepEqual(d.actions.Invalid_list.runAfter, { Validate_list: ["Failed", "TimedOut"] });
});

test("operation metadata must match exact method/path/operation, pagination parameter types and list schema", () => {
  assert.equal(operationVerified(metadata()), true);
  for (const change of [m => { m.paths = {}; }, m => { m.paths[`/{connectionId}${operationPath}`].get.deprecated = true; },
    m => { m.paths[`/{connectionId}${operationPath}`].get.operationId = "GetEvents"; },
    m => { m.paths[`/{connectionId}${operationPath}`].get.parameters = []; }]) {
    const m = metadata(); change(m); assert.equal(operationVerified(m), false);
  }
});

test("check and status are read-only; deploy creates absent workflow only with a collision precondition", async () => {
  for (const mode of ["check", "status"]) {
    const f = fake(); await run(mode, f.backend, f.log);
    assert.ok(f.calls.every(c => c.method === "GET")); assert.ok(f.cleared);
  }
  const f = fake(); const result = await run("deploy", f.backend, f.log);
  assert.equal(result.status, "deployed_disabled");
  const writes = f.calls.filter(c => c.method !== "GET");
  assert.equal(writes.length, 1); assert.equal(writes[0].method, "PUT");
  assert.equal(writes[0].id, `${workflowId}?api-version=2019-05-01`);
  assert.deepEqual(writes[0].headers, { "If-None-Match": "*" });
  assert.equal(writes[0].body.properties.state, "Disabled");
  assert.equal(f.calls.some(c => c.invoke), false);
});

test("existing names, inaccessible resources, changed connection and incorrect operator stop without writes", async () => {
  const collision = fake({ present: true });
  await assert.rejects(run("deploy", collision.backend), /Conflict/);
  assert.ok(collision.calls.every(c => c.method === "GET"));
  for (const mutate of [
    ({ id }) => id.startsWith(connectionId) ? { status: 200, data: { properties: { statuses: [{ status: "Error" }] } } } : null,
    ({ id }) => id.startsWith(workflowId) ? { status: 403, data: { error: { code: "Forbidden", message: "private" } } } : null,
    ({ id }) => id.startsWith(workflowId) ? { status: 404, data: { error: { code: "unknown" } } } : null,
    ({ id }) => id.startsWith(apiId) ? { status: 200, data: {} } : null
  ]) {
    const f = fake({ mutate }); await assert.rejects(run("deploy", f.backend));
    assert.ok(f.calls.every(c => c.method === "GET")); assert.ok(f.cleared);
  }
  const f = fake(); f.backend.caller = "22222222-2222-4222-8222-222222222222";
  await assert.rejects(run("deploy", f.backend)); assert.ok(f.calls.every(c => c.method === "GET"));
});

test("contract drift (extra action, broader ACL, wrong connection, unprotected output) fails closed", async () => {
  for (const change of [
    w => { w.properties.definition.actions.Other = {}; },
    w => { w.properties.accessControl.triggers.sasAuthenticationPolicy.state = "Enabled"; },
    w => { w.properties.parameters.$connections.value.office365.connectionId = "wrong"; },
    w => { delete w.properties.definition.actions.List_calendars.runtimeConfiguration; },
    w => { w.properties.definition.triggers.manual.inputs.schema.additionalProperties = true; }
  ]) {
    const altered = buildWorkflow(caller); change(altered); assert.equal(workflowMatches(altered, caller), false);
    const f = fake({ present: true, mutate: ({ id }) => id.startsWith(workflowId) ? { status: 200, data: altered } : null });
    await assert.rejects(run("verify", f.backend)); assert.ok(f.calls.every(c => c.method === "GET"));
  }
});

test("verify denies anonymous and invalid token first, invokes once, disables and clears tokens", async () => {
  const f = fake({ present: true }); const result = await run("verify", f.backend, f.log);
  assert.deepEqual(result, { ...summary, existingResourcesUnchanged: true });
  assert.deepEqual(f.calls.filter(c => c.invoke).map(c => c.invoke), ["none", "invalid", "valid"]);
  assert.equal(f.calls.filter(c => c.id?.includes("/disable")).length, 1);
  assert.ok(f.cleared); assert.doesNotMatch(f.logs.join(""), /synthetic-private|https:|Bearer/);
  assert.ok(f.calls.filter(c => c.method && c.method !== "GET").every(c => c.id.startsWith(workflowId)));
});

test("failed denial probes prevent authenticated access and always disable", async () => {
  for (const denial of [200, 202, 400, 404, 429, 500]) {
    const f = fake({ present: true, denial }); await assert.rejects(run("verify", f.backend, f.log));
    assert.equal(f.calls.some(c => c.invoke === "valid"), false);
    assert.equal(f.calls.filter(c => c.id?.includes("/disable")).length, 1); assert.ok(f.cleared);
  }
});

test("enable ambiguity, runtime failure, cleanup failure and revocation do not retry or return stale success", async () => {
  for (const options of [{ enableFailure: true }, { live: new Error("private provider content") }, { disableFailure: true }, {
    mutate: ({ id, calls }) => id.startsWith(workflowId) && !id.includes("/disable") && calls.some(c => c.invoke === "invalid") ?
      { status: 200, data: buildWorkflow(caller) } : null
  }]) {
    const f = fake({ present: true, ...options }); await assert.rejects(run("verify", f.backend, f.log));
    assert.ok(f.calls.filter(c => c.invoke === "valid").length <= 1);
    assert.equal(f.calls.filter(c => c.id?.includes("/disable")).length, 1); assert.ok(f.cleared);
    assert.doesNotMatch(f.logs.join(""), /private provider content/);
  }
});

test("summary projection drops labels/IDs/owners/injection and keeps empty/unknown/error semantics", () => {
  assert.deepEqual(projectSummary({ status: 200, data: { ...summary, name: "<script>private</script>", id: "private", owner: "private@example.test" } }), summary);
  assert.equal(projectSummary({ status: 200, data: { ...summary, status: "empty", count: 0 } }).count, 0);
  for (const d of [{ ...summary, count: "2" }, { ...summary, count: 101 }, { ...summary, count: -1 },
    { ...summary, count: 0 }, { ...summary, eventsRead: 1 }, { ...summary, completeness: "complete" }, null]) {
    assert.throws(() => projectSummary({ status: 200, data: d }));
  }
  assert.deepEqual(projectSummary({ status: 502, data: { status: "provider_unavailable", eventsRead: 0, providerHttpStatus: 403, error: "private" } }),
    { status: "provider_unavailable", eventsRead: 0, providerHttpStatus: 403 });
});

test("callback validation refuses SAS, URL injection, redirects, wrong region/host/path and duplicate parameters", () => {
  assert.equal(callbackUrl(url), url);
  const actualApiVersion = url.replace("2016-10-01", "2019-05-01");
  assert.equal(callbackUrl(actualApiVersion), actualApiVersion);
  assert.throws(() => callbackUrl(url.replace("2016-10-01", "2099-01-01")));
  for (const value of [url + "&sig=private", url + "&api-version=2016-10-01", url + "#private", url.replace("https:", "http:"),
    url.replace("eastus", "westus"), url.replace("logic.azure.com", "logic.azure.com.evil.test"),
    url.replace("manual", "other"), url.replace("https://", "https://user:password@"), "http://127.0.0.1/"]) assert.throws(() => callbackUrl(value));
});

test("safe errors emit only fixed codes and CLI captures secrets without logging or shell interpolation", () => {
  assert.equal(safeCode("Forbidden"), "Forbidden"); assert.equal(safeCode("private mailbox"), "UnclassifiedFailure");
  assert.throws(() => cli(["account", "show"], (_exe, args, opts) => {
    assert.ok(args.includes("--only-show-errors")); assert.equal(opts.shell, undefined);
    assert.deepEqual(opts.stdio, ["ignore", "pipe", "pipe"]); assert.equal(opts.timeout, 60000);
    throw { stderr: "Forbidden token=private person@example.test" };
  }), error => error.message === "Forbidden" && !error.message.includes("private"));
});

test("local token checks require exact tenant/oid/appid/audience and sufficient lifetime", () => {
  const p = { oid: caller, tid: scope.tenant, iss: `https://sts.windows.net/${scope.tenant}/`, appid: scope.application, aud: scope.audience, exp: 9999999999 };
  const token = data => `header.${Buffer.from(JSON.stringify(data)).toString("base64url")}.signature`;
  assert.equal(tokenMatches(token(p), caller), true);
  for (const key of ["oid", "tid", "iss", "appid", "aud", "exp"]) assert.equal(tokenMatches(token({ ...p, [key]: "wrong" }), caller), false);
  assert.equal(tokenMatches("not-a-token", caller), false);
});

test("backend never exposes token to caller, callback shell arguments or cleared backend", async () => {
  const p = { oid: caller, tid: scope.tenant, iss: `https://sts.windows.net/${scope.tenant}/`, appid: scope.application, aud: scope.audience, exp: 9999999999 };
  const token = `header.${Buffer.from(JSON.stringify(p)).toString("base64url")}.signature`;
  const calls = [];
  const backend = createBackend(args => {
    calls.push(args);
    if (args.includes("get-access-token")) {
      assert.ok(args.includes("--subscription")); assert.equal(args.includes("--tenant"), false);
    }
    return args.includes("get-access-token") ? token : args[0] === "ad" ? caller : { tenant: scope.tenant, state: "Enabled" };
  }, async (_url, options) => { assert.equal(options.token, token); return { status: 200 }; });
  assert.equal(backend.token, undefined); assert.doesNotMatch(JSON.stringify(calls), /header\./);
  await backend.arm("GET", `${workflowId}?api-version=2019-05-01`);
  backend.clear(); await assert.rejects(backend.arm("GET", `${workflowId}?api-version=2019-05-01`));
});

test("HTTP has timeout, no redirects/retries, bounded streaming and no raw error exposure", async () => {
  let attempts = 0;
  const f = async (_url, options) => {
    attempts++; assert.equal(options.redirect, "error"); assert.ok(options.signal);
    return new Response(JSON.stringify({ secret: "private" }), { status: 200 });
  };
  await assert.rejects(jsonRequest("https://synthetic.example.test", { maxBytes: 2 }, f));
  assert.equal(attempts, 1);
  await assert.rejects(jsonRequest("https://synthetic.example.test", {}, async () => { throw new Error("token=private"); }),
    error => error.message === "UnclassifiedFailure");
});

test("empty and provider failure results stay explicit and still disable without retry", async () => {
  for (const live of [
    { status: 200, data: { ...summary, status: "empty", count: 0 } },
    { status: 502, data: { status: "provider_unavailable", eventsRead: 0, providerHttpStatus: 429 } },
    { status: 502, data: { status: "invalid_provider_response", eventsRead: 0 } }
  ]) {
    const f = fake({ present: true, live }); const result = await run("verify", f.backend, f.log);
    assert.equal(result.status, live.data.status);
    assert.equal(f.calls.filter(c => c.invoke === "valid").length, 1);
    assert.equal(f.calls.filter(c => c.id?.includes("/disable")).length, 1);
    assert.ok(f.cleared);
  }
});

test("late name collisions and conditional-create failures never overwrite or retry", async () => {
  const collision = fake({ mutate: ({ id, calls }) => id.startsWith(workflowId) &&
    calls.filter(c => c.id.startsWith(workflowId)).length === 2 ? { status: 200, data: buildWorkflow(caller) } : null });
  await assert.rejects(run("deploy", collision.backend), /Conflict/);
  assert.equal(collision.calls.some(c => c.method === "PUT"), false);
  const failed = fake({ mutate: ({ method }) => method === "PUT" ? { status: 412, data: { error: { code: "PreconditionFailed", message: "private" } } } : null });
  await assert.rejects(run("deploy", failed.backend), /PreconditionFailed/);
  assert.equal(failed.calls.filter(c => c.method === "PUT").length, 1);
});

test("backend clearing fences invocation as well as ARM reads", async () => {
  const p = { oid: caller, tid: scope.tenant, iss: `https://sts.windows.net/${scope.tenant}/`, appid: scope.application, aud: scope.audience, exp: 9999999999 };
  const backend = createBackend(args => args.includes("get-access-token") ?
    `header.${Buffer.from(JSON.stringify(p)).toString("base64url")}.signature` : args[0] === "ad" ? caller : { tenant: scope.tenant, state: "Enabled" },
  async () => { assert.fail("A cleared backend must never reach network"); });
  backend.clear();
  for (const auth of ["valid", "invalid", "none"]) await assert.rejects(backend.invoke(url, auth));
});