"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { deployment, importEvents, requireChild, childBackend, find, inspectReady, recover, preserved } = require("../scripts/child-calendar");
const { createNativeReader, cliCommand, commands } = require("../scripts/windows-azure-cli");
const P = require("../scripts/windows-child-protocol");
const { buildChildWorkflow, workflowId } = require("../infra/child-calendar");
const { buildOctoberAvailability, workflowId: availabilityId } = require("../infra/availability");
const { scope, buildOwnerWorkflow, workflowId: listId, invitationId, connectionId, apiId } = require("../infra/calendar-list");
const { logicUrl } = require("../scripts/calendar-list");
const { perform } = require("../browser-fixtures/child-calendar");
const caller = "11111111-1111-4111-8111-111111111111";
const callback = `https://prod-01.eastus.logic.azure.com/workflows/${"b".repeat(32)}/triggers/manual/paths/invoke?api-version=2019-05-01`;
function swagger(native = false) {
  return { paths: { "/{connectionId}/codeless/httprequest": { post: { operationId: "HttpRequest", deprecated: false,
    description: "1st segment: /me, /users/<userId> 2nd segment: calendar, calendars.", parameters: [
      { name: "Uri", in: "header", type: "string", required: true }, { name: "Method", in: "header", type: "string", required: true, enum: ["GET"] }
    ] } }, ...(native ? { "/{connectionId}/calendars/{calendarId}/view": { get: {
      operationId: "GetEventsCalendarViewV3", deprecated: false, parameters: ["calendarId", "startDateTimeUtc", "endDateTimeUtc"].map(name => ({
        name, in: name === "calendarId" ? "path" : "query", type: "string", required: true
      }))
    } } } : {}) } };
}
function fake({ absent = false, state = "Disabled", listState = "Disabled", intercept = () => {} } = {}) {
  let resource = absent ? null : buildChildWorkflow(caller), cleared = false;
  const list = buildOwnerWorkflow(caller);
  if (resource) resource.properties.state = state;
  list.properties.state = listState;
  const calls = [], records = [];
  const backend = { caller, clear() { cleared = true; }, async arm(method, id, body) {
    calls.push({ method, id, body }); const override = intercept({ method, id, body, resource, calls }); if (override) return override;
    if (id === logicUrl(workflowId)) { if (method === "PUT") resource = structuredClone(body); return resource ? { status: 200, data: structuredClone(resource) } : { status: 404, data: { error: { code: "ResourceNotFound" } } }; }
    if (id === logicUrl(listId)) return { status: 200, data: structuredClone(list) };
    if (id === logicUrl(availabilityId)) return { status: 200, data: buildOctoberAvailability(caller) };
    if (id === logicUrl(invitationId)) return { status: 200, data: { properties: { state: "Disabled", accessControl: buildOwnerWorkflow(caller).properties.accessControl, parameters: { deliveryEnabled: { value: false } } } } };
    if (id.startsWith(connectionId)) return { status: 200, data: { location: "eastus", properties: { api: { id: apiId }, statuses: [{ status: "Connected" }] } } };
    if (id.startsWith(apiId)) return { status: 200, data: swagger() };
    if (id.includes("listCallbackUrl")) return { status: 200, data: { value: callback } };
    if (id === logicUrl(listId, "/enable")) { list.properties.state = "Enabled"; return { status: 200 }; }
    if (id === logicUrl(listId, "/disable")) { list.properties.state = "Disabled"; return { status: 200 }; }
    if (id.includes("/enable")) { resource.properties.state = "Enabled"; return { status: 200 }; }
    if (id.includes("/disable")) { resource.properties.state = "Disabled"; return { status: 200 }; }
    if (!id.includes("/providers/")) return { status: 200, data: { location: "eastus" } };
    throw Error("unexpected_route");
  }, async invoke(url, auth) { assert.equal(url, callback); calls.push({ auth }); const override = intercept({ auth, resource, calls }); return override || { status: 200, data: await perform({ action: "import", disclosure: "details", record() {} }) }; } };
  return { backend, calls, records, record: s => records.push(s), get cleared() { return cleared; } };
}
test("child candidate deploy is absent-only, disabled, exactly one PUT and no events", async () => {
  const f = fake({ absent: true }); assert.equal((await deployment(f.backend, true)).status, "deployed_disabled");
  const writes = f.calls.filter(c => c.method !== "GET"); assert.equal(writes.length, 1); assert.equal(writes[0].method, "PUT"); assert.equal(writes[0].id, logicUrl(workflowId));
  assert.equal(f.calls[f.calls.indexOf(writes[0]) - 1].id, logicUrl(workflowId)); assert.equal(writes[0].body.properties.state, "Disabled"); assert.equal(f.cleared, true);
  const collision = fake(); await assert.rejects(deployment(collision.backend, true), /update_conflict/); assert.ok(collision.calls.every(c => c.method === "GET"));
});
test("child deployment read-only mode and metadata/drift failure cannot write", async () => {
  const f = fake({ absent: true }); assert.equal((await deployment(f.backend)).status, "candidate_ready"); assert.ok(f.calls.every(c => c.method === "GET"));
  for (const intercept of [({ id }) => id.startsWith(apiId) ? { status: 200, data: {} } : null,
    ({ id }) => id === logicUrl(availabilityId) ? { status: 200, data: {} } : null]) {
    const b = fake({ absent: true, intercept }); await assert.rejects(deployment(b.backend, true)); assert.ok(b.calls.every(c => c.method === "GET"));
  }
});
test("child exact contract rejects broadened access, unknown properties and changed projection", () => {
  for (const mutate of [w => { w.identity = {}; }, w => { w.properties.state = "Enabled"; }, w => { w.properties.definition.actions.Redact.inputs.select.title = "@item()['subject']"; }, w => { w.properties.accessControl.triggers.sasAuthenticationPolicy.state = "Enabled"; }, w => { w.properties.parameters.other = {}; }]) {
    const w = buildChildWorkflow(caller); mutate(w); assert.throws(() => requireChild(w, caller), /contract_drift/);
  }
});
test("child import verifies exact contract and independent cleanup before returning redacted data", async () => {
  const f = fake(), result = await importEvents(f.backend, { disclosure: "details", record: f.record });
  assert.equal(result.events.length, 3); assert.deepEqual(f.records, ["cleanup_pending", "workflow_disabled"]); assert.equal(f.cleared, true);
  assert.equal(f.calls.filter(c => c.auth === "valid").length, 1); assert.ok(f.calls.filter(c => c.method && c.method !== "GET").every(c => c.id.startsWith(workflowId)));
});
test("child enable ambiguity, disable failure, cancellation and provider errors never retry or leak data", async () => {
  for (const suffix of ["/enable", "/disable"]) {
    const f = fake({ intercept: ({ id }) => { if (id?.includes(suffix)) throw Error("PRIVATE"); } });
    await assert.rejects(importEvents(f.backend, { disclosure: "details", record: f.record }), /cleanup_failed/); assert.equal(f.cleared, true); assert.equal(f.records.at(-1), "cleanup_failed");
  }
  const c = new AbortController(), f = fake({ intercept: ({ auth }) => { if (auth) c.abort(); } });
  await assert.rejects(importEvents(f.backend, { disclosure: "details", signal: c.signal, record: f.record }), /cancelled/); assert.equal(f.records.at(-1), "workflow_disabled");
  for (const status of [401, 403, 404, 429, 500]) {
    const b = fake({ intercept: ({ auth }) => auth ? { status, data: { secret: "PRIVATE" } } : null });
    await assert.rejects(importEvents(b.backend, { disclosure: "details", record: b.record }), /revoked|unavailable/); assert.equal(b.calls.filter(c => c.auth).length, 1); assert.equal(b.records.at(-1), "workflow_disabled");
  }
});
test("child transport binds token/caller, exact URL/body and one invocation, refuses history and other writes", async () => {
  const claims = { oid: caller, tid: scope.tenant, iss: `https://sts.windows.net/${scope.tenant}/`, appid: scope.application, aud: scope.audience, exp: 9999999999 };
  const token = `h.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.s`, calls = [], controller = new AbortController();
  const options = { calendarId: "SYNTHETIC-ID", disclosure: "busy_only", signal: controller.signal,
    read: async args => args.includes("get-access-token") ? token : args[0] === "ad" ? caller : { tenant: scope.tenant, state: "Enabled" },
    request: async (url, args) => { calls.push({ url, args }); return { status: 200, data: { value: callback } }; } };
  const b = await childBackend("import", options);
  for (const [method, id] of [["GET", logicUrl(workflowId, "/runs")], ["POST", logicUrl(listId, "/enable")], ["PUT", logicUrl(workflowId)], ["GET", "https://evil.test"]]) await assert.rejects(b.arm(method, id));
  await assert.rejects(b.invoke(callback, "valid"));
  await b.arm("POST", logicUrl(workflowId, "/triggers/manual/listCallbackUrl"), {});
  await assert.rejects(b.invoke("https://evil.test", "valid")); await b.invoke(callback, "valid"); await assert.rejects(b.invoke(callback, "valid"));
  assert.deepEqual(calls.at(-1).args.body, { calendarId: "SYNTHETIC-ID", disclosure: "busy_only", person: "Kimi", guardian: true, confirmed: true });
  assert.equal(calls.at(-1).args.maxBytes, 256 * 1024); controller.abort(); await b.arm("POST", logicUrl(workflowId, "/disable")); assert.equal(calls.at(-1).args.signal, undefined); b.clear();
  for (const mode of ["check", "deploy"]) { const x = await childBackend(mode, options); await assert.rejects(x.invoke(callback, "valid")); await assert.rejects(x.arm("POST", logicUrl(workflowId, "/enable"))); x.clear(); }
  await assert.rejects(childBackend("import", { ...options, calendarId: "../unsafe" }));
});

// Real backend and native reader logic, with only filesystem/command/HTTP I/O
// replaced. No native executable, Azure CLI, network or private files are used.
async function transport(mode, { signal, identity = {}, nativeRun, ...fixture } = {}) {
  const f = fake(fixture), authCalls = [], requests = [];
  const claims = { oid: caller, tid: scope.tenant, iss: `https://sts.windows.net/${scope.tenant}/`, appid: scope.application,
    aud: scope.audience, exp: Math.floor(Date.now() / 1000) + 3600, ...identity.claims };
  const token = `h.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.s`;
  let removed = 0, backend;
  const reader = await createNativeReader({ platform: "win32", env: {},
    filesystem: { mkdtemp: async () => "synthetic-extensions", rmdir: async directory => { assert.equal(directory, "synthetic-extensions"); removed++; } },
    run: async (command, env) => {
      const index = commands.findIndex(args => cliCommand(args) === command);
      assert.notEqual(index, -1); authCalls.push(index);
      assert.equal(env.AZURE_EXTENSION_USE_DYNAMIC_INSTALL, "no");
      assert.equal(env.AZURE_EXTENSION_DIR, "synthetic-extensions");
      await nativeRun?.(index);
      return JSON.stringify(index === 0 ? { tenant: scope.tenant, state: "Enabled", ...identity.account } :
        index === 1 ? identity.caller || caller : token);
    } });
  const read = async (args, s) => { assert.equal(s, mode.startsWith("cleanup-") ? undefined : signal); return reader.read(args, s); };
  const request = async (url, options) => {
    assert.equal(options.token, token);
    requests.push({ url, method: options.method, signal: options.signal });
    if (options.signal?.aborted) throw Error("synthetic cancelled request");
    if (url === callback) return f.backend.invoke(url, "valid");
    assert.ok(url.startsWith("https://management.azure.com/"));
    return f.backend.arm(options.method, url.slice("https://management.azure.com".length), options.body);
  };
  try { backend = await childBackend(mode, { signal, read, request, calendarId: "SYNTHETIC-ID", disclosure: "details" }); }
  catch (error) { await reader.dispose(); assert.equal(requests.length, 0); throw error; }
  return { ...f, backend, requests, authCalls, get removed() { return removed; }, async dispose() { backend.clear(); await reader.dispose(); } };
}
const protectedReads = [logicUrl(availabilityId), logicUrl(invitationId), `${connectionId}?api-version=2016-06-01`,
  `/subscriptions/${scope.subscription}/resourceGroups/${scope.group}?api-version=2021-04-01`];
const swaggerUrl = `${apiId}?api-version=2016-06-01&export=true`;
const readyReport = nativeViewCandidate => ({ status: "child_ready", httpGetCalendarCandidate: true, nativeViewCandidate,
  sasDisabled: true, preservedResourcesUnchanged: true, calendarQueries: 0, cloudChanges: false, runtimeVerified: false });

test("child backend exports real readiness and recovery integration", () => {
  assert.equal(typeof inspectReady, "function"); assert.equal(typeof recover, "function");
});

for (const action of ["find", "import"]) {
  const mode = `cleanup-${action}`, target = action === "find" ? listId : workflowId;
  test(`${mode} real allowlist permits only exact protected GETs and target disable`, async () => {
    const c = new AbortController(); c.abort();
    const f = await transport(mode, { signal: c.signal });
    try {
      assert.deepEqual(f.authCalls, [0, 1, 2]);
      const allowed = [...new Set([...protectedReads, logicUrl(target), ...(action === "import" ? [logicUrl(listId)] : [])])];
      for (const id of allowed) await f.backend.arm("GET", id);
      for (const body of [undefined, {}]) await f.backend.arm("POST", logicUrl(target, "/disable"), body);
      const count = f.requests.length;
      const denied = [
        ["GET", swaggerUrl], ["GET", logicUrl(target, "/runs")], ["GET", logicUrl(target, "/triggers")],
        ["GET", `${logicUrl(target)}&extra=true`], ["GET", target], ["GET", "https://evil.test/"],
        ["GET", logicUrl(target).replace(scope.subscription, "00000000-0000-4000-8000-000000000000")],
        ["GET", logicUrl(target), {}], ["GET", logicUrl(target), undefined, {}],
        ["POST", logicUrl(target, "/enable")], ["POST", logicUrl(target, "/triggers/manual/listCallbackUrl"), {}],
        ["POST", logicUrl(target, "/disable"), { extra: true }], ["POST", logicUrl(target, "/disable"), []],
        ["POST", logicUrl(target, "/disable"), null], ["POST", logicUrl(target, "/disable"), {}, {}],
        ["PUT", logicUrl(workflowId), buildChildWorkflow(caller)], ["PATCH", logicUrl(target), {}], ["DELETE", logicUrl(target)],
        ...[workflowId, listId, availabilityId, invitationId, connectionId].filter(id => id !== target).map(id => ["POST", logicUrl(id, "/disable")]),
        ...(action === "find" ? [["GET", logicUrl(workflowId)]] : [])
      ];
      for (const args of denied) await assert.rejects(f.backend.arm(...args), /blocked/);
      for (const auth of ["valid", "invalid", "none"]) await assert.rejects(f.backend.invoke(callback, auth), /blocked/);
      assert.equal(f.requests.length, count);
      assert.ok(f.requests.every(r => r.signal === undefined));
    } finally { await f.dispose(); }
  });

  for (const state of ["Enabled", "Disabled"]) test(`${mode} ${state} recovery authenticates despite cancellation and independently reads Disabled`, async () => {
    const c = new AbortController(); c.abort();
    const f = await transport(mode, { signal: c.signal, ...(action === "find" ? { listState: state } : { state }) });
    try {
      const report = await recover(f.backend, action);
      assert.deepEqual(report, { status: "workflow_disabled", calendarQueries: 0 }); P.validateReport(report, mode);
      const writes = f.calls.filter(r => r.method !== "GET");
      assert.equal(writes.length, state === "Enabled" ? 1 : 0);
      if (writes.length) {
        assert.equal(writes[0].id, logicUrl(target, "/disable"));
        assert.deepEqual(f.calls[f.calls.indexOf(writes[0]) + 1], { method: "GET", id: logicUrl(target), body: undefined });
      }
      assert.equal(f.calls.filter(r => r.id === logicUrl(target)).length, 2);
      for (const id of [...protectedReads, ...(action === "import" ? [logicUrl(listId)] : [])]) assert.equal(f.calls.filter(r => r.id === id).length, 2);
      assert.ok(f.requests.every(r => r.signal === undefined));
      const count = f.requests.length; await assert.rejects(f.backend.arm("GET", logicUrl(target))); assert.equal(f.requests.length, count);
    } finally { await f.dispose(); }
    assert.equal(f.removed, 1);
  });

  test(`${mode} unknown state or target contract drift is never disabled`, async () => {
    for (const mutate of [w => { w.properties.state = "Suspended"; }, w => { delete w.properties.state; },
      w => { w.properties.accessControl.triggers.sasAuthenticationPolicy.state = "Enabled"; },
      w => { w.properties.definition.actions = {}; }, w => { w.id = availabilityId; },
      w => { w.identity = {}; }, w => { w.properties.parameters.extra = {}; }]) {
      const f = await transport(mode, { intercept: ({ id }) => {
        if (id !== logicUrl(target)) return;
        const data = action === "find" ? buildOwnerWorkflow(caller) : buildChildWorkflow(caller);
        data.properties.state = "Enabled"; mutate(data); return { status: 200, data };
      } });
      try {
        await assert.rejects(recover(f.backend, action), { code: "cleanup_failed", message: "cleanup_failed" });
        assert.ok(f.calls.every(r => r.method === "GET"));
        const count = f.requests.length; await assert.rejects(f.backend.arm("GET", logicUrl(target))); assert.equal(f.requests.length, count);
      } finally { await f.dispose(); }
    }
  });

  test(`${mode} failed or ambiguous disable and independent readback fail closed without retry`, async () => {
    for (const fault of ["initial_missing", "initial_denied", "disable_throw", "disable_http", "still_enabled", "readback_throw", "readback_missing", "readback_drift"]) {
      const f = await transport(mode, { ...(action === "find" ? { listState: "Enabled" } : { state: "Enabled" }), intercept: ({ id, calls }) => {
        const reads = calls.filter(r => r.id === logicUrl(target)).length;
        if (id === logicUrl(target) && reads === 1) {
          if (fault === "initial_missing") return { status: 404, data: { error: { code: "ResourceNotFound" } } };
          if (fault === "initial_denied") return { status: 403 };
        }
        if (id === logicUrl(target, "/disable")) {
          if (fault === "disable_throw") throw Error("SYNTHETIC_PRIVATE_ERROR");
          if (fault === "disable_http") return { status: 500 };
          if (fault === "still_enabled") return { status: 202 };
        }
        if (id === logicUrl(target) && reads === 2) {
          if (fault === "readback_throw") throw Error("SYNTHETIC_PRIVATE_ERROR");
          if (fault === "readback_missing") return { status: 404 };
          if (fault === "readback_drift") return { status: 200, data: {} };
        }
      } });
      try {
        await assert.rejects(recover(f.backend, action), { code: "cleanup_failed", message: "cleanup_failed" });
        assert.equal(f.calls.filter(r => r.method === "POST").length, fault.startsWith("initial") ? 0 : 1);
        assert.ok(f.calls.every(r => r.method === "GET" || r.id === logicUrl(target, "/disable")));
        const count = f.requests.length; await assert.rejects(f.backend.arm("GET", logicUrl(target))); assert.equal(f.requests.length, count);
      } finally { await f.dispose(); }
    }
  });

  test(`${mode} validates all protected resources before and after target recovery`, async () => {
    for (const id of [...protectedReads, ...(action === "import" ? [logicUrl(listId)] : [])]) for (const pass of [1, 2]) {
      const f = await transport(mode, { ...(action === "find" ? { listState: "Enabled" } : { state: "Enabled" }), intercept: c => {
        if (c.id === id && c.calls.filter(r => r.id === id).length === pass) return { status: 200, data: {} };
      } });
      try {
        await assert.rejects(recover(f.backend, action), { code: "cleanup_failed" });
        assert.equal(f.calls.filter(r => r.method === "POST").length, pass === 1 ? 0 : 1);
      } finally { await f.dispose(); }
    }
  });
}

test("child preserved excludes only the list when it is the mutated target", async () => {
  const f = await transport("cleanup-find", { listState: "Enabled" });
  try {
    const result = await preserved(f.backend, false);
    assert.deepEqual(Object.keys(result).sort(), ["availability", "connection", "invitation"]);
    assert.deepEqual(f.calls.map(r => r.id).sort(), [...protectedReads].sort());
    await assert.rejects(preserved(f.backend));
  } finally { await f.dispose(); }
});

for (const native of [false, true]) test(`readiness real backend verifies current exported Swagger and exact strict status (native=${native})`, async () => {
  const f = await transport("check", { intercept: ({ id }) => id === swaggerUrl ? { status: 200, data: swagger(native) } : undefined });
  try {
    const report = await inspectReady(f.backend); assert.deepEqual(report, readyReport(native)); P.validateReport(report, "status");
    assert.equal(f.calls.length, 14);
    for (const id of [...protectedReads, logicUrl(listId), logicUrl(workflowId), swaggerUrl]) assert.equal(f.calls.filter(r => r.id === id).length, 2);
    assert.ok(f.calls.every(r => r.method === "GET"));
    assert.doesNotMatch(JSON.stringify(report), /11111111|https:|token|calendarId|paths/);
    const count = f.requests.length; await assert.rejects(f.backend.arm("GET", logicUrl(workflowId))); assert.equal(f.requests.length, count);
  } finally { await f.dispose(); }
});

test("readiness rejects missing/Enabled child, invalid capability and every failed protected read", async () => {
  const scenarios = [{ absent: true }, { state: "Enabled" }, { listState: "Enabled" },
    ...[...protectedReads, swaggerUrl, logicUrl(workflowId)].map(id => ({ intercept: c => c.id === id ? { status: 200, data: {} } : undefined }))];
  for (const scenario of scenarios) {
    const f = await transport("check", scenario);
    try {
      await assert.rejects(inspectReady(f.backend)); assert.ok(f.calls.every(r => r.method === "GET"));
      const count = f.requests.length; await assert.rejects(f.backend.arm("GET", logicUrl(workflowId))); assert.equal(f.requests.length, count);
    } finally { await f.dispose(); }
  }
});

test("readiness compares full target, protected envelopes and Swagger, not just capability booleans", async () => {
  for (const id of [logicUrl(workflowId), logicUrl(listId), logicUrl(availabilityId), logicUrl(invitationId), `${connectionId}?api-version=2016-06-01`, swaggerUrl]) {
    const f = await transport("check");
    const arm = f.backend.arm.bind(f.backend);
    let seen = 0;
    f.backend.arm = async (...args) => {
      const result = await arm(...args);
      if (args[1] === id && ++seen === 2) result.data.etag = "synthetic-drift";
      return result;
    };
    try {
      await assert.rejects(inspectReady(f.backend), { code: "contract_drift" });
      assert.ok(f.calls.every(r => r.method === "GET"));
    } finally { await f.dispose(); }
  }
});

test("recovery requires strict protected equality even for connector timestamp-only drift", async () => {
  for (const action of ["find", "import"]) {
    const f = await transport(`cleanup-${action}`, { intercept: ({ id, calls }) => {
      if (id !== `${connectionId}?api-version=2016-06-01`) return;
      return { status: 200, data: { location: "eastus", properties: { api: { id: apiId }, statuses: [{ status: "Connected" }],
        changedTime: calls.filter(r => r.id === id).length === 1 ? "2026-09-01T00:00:00Z" : "2026-09-01T00:00:01Z" } } };
    } });
    try { await assert.rejects(recover(f.backend, action), { code: "cleanup_failed" }); }
    finally { await f.dispose(); }
  }
});

test("recovery rejects wrong actions/mode targets and clear failure is always cleanup_failed", async () => {
  for (const action of [undefined, "status", "cleanup-find", "https://evil.test", "import"]) {
    const f = await transport("cleanup-find");
    try { await assert.rejects(recover(f.backend, action), { code: "cleanup_failed" }); }
    finally { await f.dispose(); }
  }
  for (const action of ["find", "import"]) {
    const f = await transport(`cleanup-${action}`), clear = f.backend.clear.bind(f.backend);
    f.backend.clear = () => { clear(); throw Error("SYNTHETIC_PRIVATE_ERROR"); };
    try { await assert.rejects(recover(f.backend, action), { code: "cleanup_failed", message: "cleanup_failed" }); }
    finally { f.backend.clear = clear; await f.dispose(); }
  }
});

test("real injected native authentication checks tenant, caller, issuer, app, audience and ten-minute token margin", async () => {
  const other = "22222222-2222-4222-8222-222222222222";
  const identities = [{ account: { tenant: other } }, { account: { state: "Disabled" } }, { caller: other }, { caller: "invalid" },
    ...["oid", "tid", "iss", "appid", "aud"].map(key => ({ claims: { [key]: other } })),
    { claims: { exp: Math.floor(Date.now() / 1000) + 590 } }, { claims: { exp: 0 } }];
  for (const mode of ["check", "cleanup-find", "cleanup-import"]) for (const identity of identities) {
    await assert.rejects(transport(mode, { identity }), mode.startsWith("cleanup-") ? { code: "cleanup_failed" } : undefined);
  }
  for (const stage of [0, 1, 2]) await assert.rejects(transport("cleanup-import", { nativeRun: index => {
    if (index === stage) throw Error("SYNTHETIC_PRIVATE_ERROR");
  } }), { code: "cleanup_failed", message: "cleanup_failed" });
});

test("matching alternate caller token still fails protected owner policy before any target mutation", async () => {
  const other = "22222222-2222-4222-8222-222222222222";
  for (const mode of ["check", "cleanup-find", "cleanup-import"]) {
    const f = await transport(mode, { identity: { caller: other, claims: { oid: other } } });
    try {
      await assert.rejects(mode === "check" ? inspectReady(f.backend) : recover(f.backend, mode.slice("cleanup-".length)));
      assert.ok(f.calls.every(r => r.method === "GET"));
      assert.ok(!f.calls.some(r => r.id === logicUrl(workflowId) || r.id === logicUrl(listId)));
      const count = f.requests.length; await assert.rejects(f.backend.arm("GET", logicUrl(invitationId))); assert.equal(f.requests.length, count);
    } finally { await f.dispose(); }
  }
});

test("readiness failure and recovery success cannot resolve before credential clear completes", async () => {
  for (const mode of ["check", "cleanup-find", "cleanup-import"]) {
    const f = await transport(mode, mode === "check" ? { absent: true } : {}), clear = f.backend.clear.bind(f.backend);
    let released, clearing = false, settled = false;
    const gate = new Promise(resolve => { released = resolve; });
    f.backend.clear = async () => { clear(); clearing = true; await gate; };
    const operation = (mode === "check" ? inspectReady(f.backend) : recover(f.backend, mode.slice("cleanup-".length)))
      .then(value => { settled = true; return value; }, error => { settled = true; return error; });
    // Flush promise-only synthetic HTTP/auth work without a wall-clock wait.
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(clearing, true); assert.equal(settled, false); released();
    await operation; assert.equal(settled, true);
    f.backend.clear = clear; await f.dispose();
  }
});

test("cancelled data auth stops while cleanup auth and readbacks ignore cancellation", async () => {
  for (const stage of [0, 1, 2]) {
    const c = new AbortController();
    await assert.rejects(transport("check", { signal: c.signal, nativeRun: index => { if (index === stage) c.abort(); } }), { code: "cancelled" });
  }
  for (const action of ["find", "import"]) {
    const c = new AbortController();
    const f = await transport(`cleanup-${action}`, { signal: c.signal, nativeRun: () => c.abort(),
      ...(action === "find" ? { listState: "Enabled" } : { state: "Enabled" }) });
    try { await recover(f.backend, action); assert.ok(f.requests.every(r => r.signal === undefined)); }
    finally { await f.dispose(); }
  }
});

test("cancelled real import preserves independent disable and exact readback, with no data retry", async () => {
  const c = new AbortController(), records = [];
  const f = await transport("import", { signal: c.signal, intercept: ({ auth }) => { if (auth) c.abort(); } });
  try {
    await assert.rejects(importEvents(f.backend, { signal: c.signal, disclosure: "details", record: s => records.push(s) }), { code: "cancelled" });
    assert.deepEqual(records, ["cleanup_pending", "workflow_disabled"]);
    const index = f.requests.findIndex(r => r.url === `https://management.azure.com${logicUrl(workflowId, "/disable")}`);
    assert.ok(index > 0); assert.equal(f.requests[index].signal, undefined); assert.equal(f.requests[index + 1].signal, undefined);
    assert.equal(f.requests.filter(r => r.url === callback).length, 1);
  } finally { await f.dispose(); }
});

// Cross-module regression: do not replace childBackend/inspectReady/recover or
// deployment with success stubs. Only native authentication and HTTPS I/O are
// synthetic; no worker process, credential store or Azure resource is touched.
for (const mode of ["check", "status", "deploy", "cleanup-find", "cleanup-import"]) {
  test(`native worker and real child backend agree on ${mode} without calendar invocation`, async () => {
    const { executeOperation } = require("../scripts/windows-child-worker");
    const f = fake({ absent: ["check", "deploy"].includes(mode),
      ...(mode === "cleanup-find" ? { listState: "Enabled" } : mode === "cleanup-import" ? { state: "Enabled" } : {}) });
    const claims = { oid: caller, tid: scope.tenant, iss: `https://sts.windows.net/${scope.tenant}/`,
      appid: scope.application, aud: scope.audience, exp: Math.floor(Date.now() / 1000) + 3600 };
    const token = `h.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.s`;
    const auth = [], stages = []; let disposed = false;
    const cancelled = new AbortController();
    if (mode.startsWith("cleanup-")) cancelled.abort();
    const result = await executeOperation(mode, { platform: "win32", signal: cancelled.signal,
      stage: value => stages.push(value),
      makeReader: async () => ({
        read: async (args, signal) => {
          const index = commands.findIndex(command => JSON.stringify(command) === JSON.stringify(args));
          assert.notEqual(index, -1); auth.push(index);
          if (mode.startsWith("cleanup-")) assert.equal(signal, undefined);
          return index === 0 ? { tenant: scope.tenant, state: "Enabled" } : index === 1 ? caller : token;
        },
        dispose: async () => { disposed = true; }
      }),
      request: async (url, options) => {
        assert.equal(options.token, token);
        assert.ok(url.startsWith("https://management.azure.com/"));
        if (mode.startsWith("cleanup-")) assert.equal(options.signal, undefined);
        return f.backend.arm(options.method, url.slice("https://management.azure.com".length), options.body);
      }
    });
    assert.equal(result.ok, true); assert.equal(disposed, true); assert.equal(result.extensionsRemoved, true);
    assert.deepEqual(auth, [0, 1, 2]); P.validateResult(result, mode);
    assert.equal(Object.hasOwn(result, "data"), false);
    assert.equal(result.report.status, ({ check: "candidate_ready", status: "child_ready", deploy: "deployed_disabled",
      "cleanup-find": "workflow_disabled", "cleanup-import": "workflow_disabled" })[mode]);
    const writes = f.calls.filter(call => call.method !== "GET");
    assert.equal(writes.length, ["check", "status"].includes(mode) ? 0 : 1);
    assert.ok(f.calls.every(call => !call.auth && !call.id.includes("listCallbackUrl") && !call.id.includes("/enable")));
    assert.equal(stages.at(-1), "extension_cleanup");
    assert.doesNotMatch(JSON.stringify(result), /11111111|https:|calendarId|accessToken/);
  });
}