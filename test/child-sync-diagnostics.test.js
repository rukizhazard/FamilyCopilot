"use strict";
// OFFLINE ONLY. No subprocesses, sockets, services, browsers or private files.
// The worker/backend/find/import implementation is real; only credential-reader
// filesystem/command I/O and HTTP requests are synthetic. No other test is loaded.
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../owner/child-calendar-core");
const P = require("../scripts/windows-child-protocol");
const { executeOperation } = require("../scripts/windows-child-worker");
const { createChildNativeAdapter, BridgeFailure } = require("../scripts/windows-child");
const { createNativeReader, cliCommand, commands } = require("../scripts/windows-azure-cli");
const { OwnerFailure } = require("../scripts/owner-calendar");
const { logicUrl } = require("../scripts/calendar-list");
const { scope, buildOwnerWorkflow, workflowId: listId, invitationId, connectionId, apiId } = require("../infra/calendar-list");
const { buildOctoberAvailability, workflowId: availabilityId } = require("../infra/availability");
const { buildChildWorkflow, workflowId: childId } = require("../infra/child-calendar");

const PRIVATE = "SYNTHETIC_PRIVATE_DIAGNOSTIC_CANARY";
const SOURCE = "SYNTHETIC_PRIVATE_SOURCE_ID";
const CALLER = "11111111-1111-4111-8111-111111111111";
const callbacks = {
  find: `https://prod-01.eastus.logic.azure.com/workflows/${"a".repeat(32)}/triggers/manual/paths/invoke?api-version=2019-05-01`,
  import: `https://prod-01.eastus.logic.azure.com/workflows/${"b".repeat(32)}/triggers/manual/paths/invoke?api-version=2019-05-01`
};
const context = () => ({ key: "a".repeat(64), sessionId: "b".repeat(64), expires: Date.now() + 1800000 });
const diagnostic = (stage = "event_request", code = "http_500", elapsedMs = 7) => ({ stage, code, elapsedMs });
const failure = (extra = {}) => ({ ok: false, code: "unavailable", cleanup: "workflow_disabled", stage: "workflow_disabled", extensionsRemoved: true, ...extra });
const syncInput = (reference = P.sourceReference(SOURCE, CALLER), disclosure = "details", session = context()) => ({
  ...session, action: "sync", reference, disclosure, person: "Kimi", guardian: true, confirmed: true, diagnostics: true
});
const adapterInput = () => {
  const { key, person, guardian, confirmed, diagnostics, ...input } = syncInput();
  return input;
};
const events = (disclosure = "details") => ({
  contract: C.contract, window: { ...C.window }, checkedAt: "2026-09-01T00:00:00Z", partial: true,
  events: [{ title: disclosure === "details" ? "Synthetic permitted event" : "Busy", start: "2026-10-09T01:00:00Z",
    end: "2026-10-09T02:00:00Z", allDay: false, status: "scheduled", kind: "occurrence", redacted: disclosure === "busy_only" }]
});
function success(mode, disclosure = "details") {
  const report = mode === "check" ? { status: "candidate_ready", cloudChanges: false, runtimeVerified: false }
    : mode === "deploy" ? { status: "deployed_disabled", sasDisabled: true, calendarQueries: 0, atomicCompareAndSwap: false }
      : mode === "status" ? { status: "child_ready", httpGetCalendarCandidate: true, nativeViewCandidate: false,
        sasDisabled: true, preservedResourcesUnchanged: true, calendarQueries: 0, cloudChanges: false, runtimeVerified: false }
        : { status: "workflow_disabled", calendarQueries: 0 };
  const data = mode === "find" ? { calendars: [], partial: true }
    : mode === "enroll" ? { reference: P.sourceReference(SOURCE, CALLER), data: events(disclosure) } : events(disclosure);
  return { ok: true, cleanup: P.dataMode(mode) || P.cleanupMode(mode) ? "workflow_disabled" : "not_requested",
    stage: "complete", extensionsRemoved: true, ...(P.dataMode(mode) ? { data } : { report }) };
}
const resultFrame = result => JSON.stringify({ protocol: P.protocol, type: "result", result });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const tick = () => new Promise(resolve => setImmediate(resolve));

function assertElapsed(value) {
  assert.ok(Number.isSafeInteger(value), "elapsed must be an integer");
  assert.ok(value >= 0 && value <= 600000, "elapsed must stay within the public bound");
}
function assertDiagnostic(value, stage, code) {
  assert.deepEqual(Reflect.ownKeys(value).sort(), ["code", "elapsedMs", "stage"]);
  assert.deepEqual(C.syncDiagnostic(value), value);
  assert.equal(value.stage, stage); assert.equal(value.code, code); assertElapsed(value.elapsedMs);
}
function assertPrivateAbsent(value, provider) {
  const text = JSON.stringify(value);
  for (const secret of [PRIVATE, SOURCE, CALLER, ...Object.values(callbacks), scope.subscription, scope.tenant, scope.application,
    ...(provider ? provider.tokens : [])]) assert.equal(text.includes(secret), false, "synthetic private material escaped");
  assert.doesNotMatch(text, /https?:\/\/|"(?:token|calendarId|sessionId|key|raw|body|url)"/);
}

// This closed fake models two independent callback endpoints and workflow state.
// Unexpected I/O is recorded as well as rejected: production catches cannot turn
// a bad fixture route into a false-positive expected unavailable result.
function provider({ faults = {}, enabled = [], onRequest, onDispose } = {}) {
  const resources = { find: buildOwnerWorkflow(CALLER), import: buildChildWorkflow(CALLER) };
  for (const target of enabled) resources[target].properties.state = "Enabled";
  const calls = [], reads = [], stages = [], unexpected = [], tokens = new Set();
  let created = 0, disposeAttempts = 0, removed = 0, round = 0, token;
  const unexpectedIO = () => { unexpected.push("unexpected_io"); throw new Error("unexpected_synthetic_io"); };
  const makeReader = () => createNativeReader({
    platform: "win32", env: {}, temp: "synthetic-temp",
    filesystem: {
      mkdtemp: async () => { created++; return "synthetic-extension-directory"; },
      rmdir: async directory => {
        assert.equal(directory, "synthetic-extension-directory"); disposeAttempts++;
        await onDispose?.();
        if (faults.extensions) throw new Error(PRIVATE);
        removed++;
      }
    },
    run: async (command, env) => {
      const index = commands.findIndex(args => cliCommand(args) === command);
      if (index < 0) return unexpectedIO();
      const kind = ["account", "signed_in_user", "credential"][index];
      reads.push(kind);
      assert.equal(env.AZURE_EXTENSION_USE_DYNAMIC_INSTALL, "no");
      assert.equal(env.AZURE_EXTENSION_DIR, "synthetic-extension-directory");
      if (index === 0) { round++; return JSON.stringify({ tenant: scope.tenant, state: "Enabled" }); }
      if (index === 1) return JSON.stringify(CALLER);
      if (faults.credentialRound === round && faults.credential === "throw") throw new Error(`${PRIVATE} ${callbacks.import}`);
      const claims = { oid: CALLER, tid: scope.tenant, iss: `https://sts.windows.net/${scope.tenant}/`, appid: scope.application,
        aud: scope.audience, exp: faults.credentialRound === round && faults.credential === "expired" ? 1 : 9999999999,
        syntheticRound: round };
      token = faults.credentialRound === round && faults.credential === "invalid" ? PRIVATE
        : `synthetic.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;
      tokens.add(token); return JSON.stringify(token);
    }
  });
  const request = async (url, options) => {
    const target = Object.keys(callbacks).find(name => callbacks[name] === url);
    const id = url.startsWith("https://management.azure.com") ? url.slice("https://management.azure.com".length) : null;
    let call;
    if (target) call = { kind: "callback", target, method: options.method, signal: options.signal };
    else {
      for (const [name, resourceId] of [["find", listId], ["import", childId]]) {
        for (const [kind, suffix] of [["read", ""], ["callback_url", "/triggers/manual/listCallbackUrl"], ["enable", "/enable"], ["disable", "/disable"]]) {
          if (id === logicUrl(resourceId, suffix)) call = { kind, target: name, method: options.method, signal: options.signal };
        }
      }
      call ||= { kind: "preserved", method: options.method, signal: options.signal };
    }
    calls.push(call);
    assert.equal(options.token, token, "request must use the current synthetic credential");
    if (target) {
      assert.equal(options.method, "POST"); assert.equal(options.maxBytes, C.maxBytes);
      assert.equal(resources[target].properties.state, "Enabled");
      if (target === "find") assert.deepEqual(options.body, {});
      else assert.deepEqual(options.body, { calendarId: SOURCE, disclosure: options.body.disclosure, person: "Kimi", guardian: true, confirmed: true });
    }
    await onRequest?.(call);
    if (target) {
      if (faults.throwCallback === target) throw new Error(`${PRIVATE} ${url} ${token}`);
      if (faults.httpTarget === target) return { status: faults.httpStatus, data: { error: `${PRIVATE} ${SOURCE} ${token} ${url}` } };
      if (target === "find") return { status: 200, data: {
        status: faults.missing ? "empty" : "listed", count: faults.missing ? 0 : 1,
        completeness: "unknown", ownership: "unverified", eventsRead: 0,
        calendars: faults.missing ? [] : [{ id: SOURCE, name: PRIVATE }]
      } };
      const output = events(options.body.disclosure);
      if (faults.invalidEvent === "time") output.events[0].start = "invalid";
      if (faults.invalidEvent === "extra") output.events[0].location = PRIVATE;
      if (faults.invalidEvent === "private") { output.events[0].title = PRIVATE; output.events[0].redacted = true; }
      return { status: 200, data: output };
    }
    if (["read", "callback_url", "enable", "disable"].includes(call.kind)) {
      if (options.method !== (call.kind === "read" ? "GET" : "POST")) return unexpectedIO();
      const resource = resources[call.target];
      if (call.kind === "read") return { status: 200, data: structuredClone(resource) };
      if (call.kind === "callback_url") return { status: 200, data: { value: callbacks[call.target] } };
      if (call.kind === "disable" && faults.cleanup === call.target) return { status: 500, data: { error: PRIVATE } };
      resource.properties.state = call.kind === "enable" ? "Enabled" : "Disabled";
      return { status: 200 };
    }
    if (options.method !== "GET") return unexpectedIO();
    if (id === logicUrl(availabilityId)) return { status: 200, data: buildOctoberAvailability(CALLER) };
    if (id === logicUrl(invitationId)) return { status: 200, data: { properties: {
      state: "Disabled", accessControl: buildOwnerWorkflow(CALLER).properties.accessControl, parameters: { deliveryEnabled: { value: false } }
    } } };
    if (id === `${connectionId}?api-version=2016-06-01`) return { status: 200, data: {
      location: scope.location, properties: { api: { id: apiId }, statuses: [{ status: "Connected" }] }
    } };
    if (id === `/subscriptions/${scope.subscription}/resourceGroups/${scope.group}?api-version=2021-04-01`)
      return { status: 200, data: { location: scope.location } };
    return unexpectedIO();
  };
  return {
    makeReader, request, faults, calls, reads, stages, tokens,
    stage: value => stages.push(value),
    assertIO() { assert.deepEqual(unexpected, [], "all synthetic routes must be explicitly modelled"); },
    resetTrace() { calls.length = 0; reads.length = 0; stages.length = 0; created = 0; disposeAttempts = 0; removed = 0; round = 0; },
    get lifecycle() { return { created, disposeAttempts, removed }; }
  };
}
async function execute(p, mode, payload, options = {}) {
  // Deliberately omit makeBackend/find/importEvents/recover overrides.
  const result = await executeOperation(mode, { platform: "win32", payload, makeReader: p.makeReader,
    request: p.request, stage: p.stage, ...options });
  p.assertIO(); return result;
}
function assertQueries(p, targets) {
  assert.deepEqual(p.calls.filter(c => c.kind === "callback").map(c => c.target), targets, "no calendar retries or extra callbacks");
  assert.deepEqual(p.calls.filter(c => c.kind === "enable").map(c => c.target), targets);
  assert.deepEqual(p.calls.filter(c => c.kind === "disable").map(c => c.target), targets);
  for (const call of p.calls.filter(c => c.kind === "disable")) {
    assert.equal(call.signal, undefined, "disable must not inherit data cancellation");
    const laterRead = p.calls.slice(p.calls.indexOf(call) + 1).find(c => c.kind === "read" && c.target === call.target);
    if (p.faults.cleanup !== call.target) {
      assert.ok(laterRead, "disable needs independent readback");
      assert.equal(laterRead.signal, undefined);
    }
  }
  assert.deepEqual(p.lifecycle, { created: 1, disposeAttempts: 1, removed: p.faults.extensions ? 0 : 1 });
  p.assertIO();
}
function assertWorkerFailure(result, p, stage, code, outerCode = "unavailable", cleanup = "workflow_disabled") {
  assert.equal(result.ok, false); assert.equal(result.code, outerCode); assert.equal(result.cleanup, cleanup);
  assert.equal(Object.hasOwn(result, "data"), false); assert.equal(Object.hasOwn(result, "report"), false);
  assertDiagnostic(result.diagnostic, stage, code); assertPrivateAbsent(result, p);
  assert.deepEqual(P.parseFrame(resultFrame(result), "sync", "details").result, result);
}

test("diagnostic schema accepts only exported stages/codes and all HTTP 4xx/5xx values", () => {
  assert.ok(C.diagnosticStages.length > 0); assert.ok(C.diagnosticCodes.length > 0);
  for (const stage of C.diagnosticStages) assert.deepEqual(C.syncDiagnostic(diagnostic(stage)), diagnostic(stage));
  for (const code of [...C.diagnosticCodes, ...Array.from({ length: 200 }, (_, i) => `http_${400 + i}`)])
    assert.deepEqual(C.syncDiagnostic(diagnostic("event_request", code)), diagnostic("event_request", code));
  for (const elapsedMs of [0, 1, 599999, 600000]) {
    const input = Object.freeze(diagnostic("credential", "expired", elapsedMs));
    const output = C.syncDiagnostic(input); assert.deepEqual(output, input); assert.notEqual(output, input);
  }
  const nullPrototype = Object.assign(Object.create(null), diagnostic());
  assert.deepEqual(C.syncDiagnostic(nullPrototype), diagnostic());
});

test("diagnostic schema rejects extra, hidden, symbol and inherited required fields without getters", () => {
  let getters = 0;
  const get = () => { getters++; throw new Error(PRIVATE); };
  const bad = [null, undefined, false, 1, "http_500", [], () => {}, Object.create(diagnostic()), { ...diagnostic(), raw: PRIVATE }];
  for (const key of ["stage", "code", "elapsedMs"]) {
    const missing = diagnostic(); delete missing[key]; bad.push(missing);
    bad.push(Object.defineProperty(diagnostic(), key, { get, enumerable: true }));
    bad.push(Object.defineProperty(diagnostic(), key, { set() {}, enumerable: true }));
  }
  bad.push(Object.defineProperty(diagnostic(), "secret", { value: PRIVATE, enumerable: false }));
  bad.push(Object.defineProperty(diagnostic(), "toJSON", { get, enumerable: false }));
  bad.push(Object.defineProperty(diagnostic(), Symbol("secret"), { get }));
  const replaced = diagnostic(); delete replaced.code; replaced[Symbol("code")] = "http_500"; bad.push(replaced);
  for (const value of bad) assert.throws(() => C.syncDiagnostic(value), /invalid_child_response/);
  assert.equal(getters, 0);
});

test("diagnostic schema rejects arbitrary stages, codes, coerced strings and elapsed bounds", () => {
  let coerced = 0;
  const object = { toString() { coerced++; return "http_500"; }, valueOf() { coerced++; return 0; } };
  for (const stage of ["complete", "cleanup_pending", PRIVATE, "event_request\n", "", null, object, Symbol("stage")])
    assert.throws(() => C.syncDiagnostic({ ...diagnostic(), stage }), /invalid_child_response/);
  for (const code of [PRIVATE, callbacks.import, "http_200", "http_399", "http_600", "http_4xx", "http_5xx", "HTTP_500", "http_0500", "http_500 extra", "", null, object, Symbol("code")])
    assert.throws(() => C.syncDiagnostic({ ...diagnostic(), code }), /invalid_child_response/);
  for (const elapsedMs of [-1, 600001, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, "0", "600000", null, undefined, false, 0n, object])
    assert.throws(() => C.syncDiagnostic({ ...diagnostic(), elapsedMs }), /invalid_child_response/);
  assert.equal(coerced, 0);
});

test("diagnostic HTTP codes reject trailing line terminators", () => {
  for (const suffix of ["\n", "\r", "\r\n", "\u2028", "\u2029"])
    assert.throws(() => C.syncDiagnostic(diagnostic("event_request", `http_500${suffix}`)), /invalid_child_response/);
});

test("IPC accepts optional diagnostics only on sync errors and retains every legacy error mode", () => {
  const detailed = failure({ diagnostic: diagnostic() });
  assert.deepEqual(P.validateResult(detailed, "sync"), detailed);
  assert.deepEqual(P.parseFrame(resultFrame(detailed), "sync").result, detailed);
  for (const mode of P.modes) {
    const old = failure(); assert.deepEqual(P.validateResult(old, mode), old);
    assert.deepEqual(P.parseFrame(resultFrame(old), mode).result, old);
    if (mode !== "sync") {
      assert.throws(() => P.validateResult(detailed, mode), /blocked/);
      assert.throws(() => P.parseFrame(resultFrame(detailed), mode), /blocked/);
    }
    const good = success(mode); P.validateResult(good, mode, "details");
    assert.throws(() => P.validateResult({ ...good, diagnostic: diagnostic() }, mode, "details"), /blocked/);
    assert.throws(() => P.parseFrame(resultFrame({ ...good, diagnostic: diagnostic() }), mode, "details"), /blocked/);
  }
});

test("old controller payload receives legacy errors from newly staged worker", async () => {
  const p = provider({ faults: { missing: true } });
  const input = syncInput(); delete input.diagnostics;
  const result = await execute(p, "sync", input);
  assert.equal(result.code, "unavailable");
  assert.deepEqual(Object.keys(result).sort(), ["ok", "code", "cleanup", "stage", "extensionsRemoved"].sort());
  assertQueries(p, ["find"]);
  for (const diagnostics of [false, null, 1, "true", {}])
    assert.throws(() => P.validateInput("sync", { ...input, diagnostics }), /blocked/);
  assert.throws(() => P.validateInput("find", { ...context(), action: "find", diagnostics: true }), /blocked/);
});

test("IPC rejects malformed diagnostics and diagnostics in non-result frames", () => {
  for (const value of [undefined, null, "http_500", {}, { ...diagnostic(), body: PRIVATE }, diagnostic(PRIVATE), diagnostic("event_request", PRIVATE), diagnostic("event_request", "http_500", 600001)]) {
    assert.throws(() => P.validateResult(failure({ diagnostic: value }), "sync"), /blocked/);
    // Undefined is absent on the wire and therefore intentionally remains legacy.
    if (value !== undefined) assert.throws(() => P.parseFrame(resultFrame(failure({ diagnostic: value })), "sync"), /blocked/);
  }
  let getters = 0;
  const accessor = Object.defineProperty(diagnostic(), "code", { get() { getters++; return PRIVATE; } });
  assert.throws(() => P.validateResult(failure({ diagnostic: accessor }), "sync"), /blocked/); assert.equal(getters, 0);
  for (const frame of [{ type: "ready", pid: 1 }, { type: "stage", stage: "credential" }])
    assert.throws(() => P.parseFrame(JSON.stringify({ protocol: P.protocol, ...frame, diagnostic: diagnostic() }), "sync"), /blocked/);
  assert.throws(() => P.validateResult(failure({ code: "http_500", diagnostic: diagnostic() }), "sync"), /blocked/);
});

for (const disclosure of ["details", "busy_only"]) {
  test(`actual find/enrollment then two successful syncs survive cleared-backend no-op (${disclosure})`, async () => {
    const p = provider(), session = context();
    const listed = await execute(p, "find", { ...session, action: "find" });
    assert.equal(listed.ok, true); assert.equal(listed.data.calendars.length, 1);
    const calendarId = listed.data.calendars[0].id;
    assert.ok(P.isSealed(calendarId)); assert.equal(P.openSource(calendarId, session), SOURCE);
    assertQueries(p, ["find"]); p.resetTrace();
    const enrolled = await execute(p, "enroll", { ...session, action: "enroll", calendarId, disclosure, person: "Kimi", guardian: true, confirmed: true });
    assert.equal(enrolled.ok, true); assert.equal(Object.hasOwn(enrolled, "diagnostic"), false);
    assert.equal(enrolled.data.reference, P.sourceReference(SOURCE, CALLER));
    assert.deepEqual(enrolled.data.data, events(disclosure)); assertPrivateAbsent(enrolled, p); assertQueries(p, ["import"]);
    for (let attempt = 0; attempt < 2; attempt++) {
      p.resetTrace();
      const newSession = { key: "c".repeat(64), sessionId: `${attempt + 1}`.repeat(64), expires: Date.now() + 1800000 };
      const result = await execute(p, "sync", syncInput(enrolled.data.reference, disclosure, newSession));
      assert.deepEqual(result, success("sync", disclosure)); assert.equal(Object.hasOwn(result, "diagnostic"), false);
      assert.deepEqual(p.reads, ["account", "signed_in_user", "credential", "account", "signed_in_user", "credential"]);
      assert.equal(p.stages.filter(s => s === "workflow_disabled").length, 2);
      assert.equal(p.stages.includes("cleanup_failed"), false);
      assertQueries(p, ["find", "import"]); assertPrivateAbsent(result, p);
    }
  });
}

const failures = [
  { name: "missing remembered source", faults: { missing: true }, stage: "source_match", code: "source_not_found", targets: ["find"] },
  { name: "event callback HTTP 500", faults: { httpTarget: "import", httpStatus: 500 }, stage: "event_request", code: "http_500", targets: ["find", "import"] },
  { name: "list callback HTTP 502", faults: { httpTarget: "find", httpStatus: 502 }, stage: "source_list_request", code: "http_502", targets: ["find"] },
  { name: "event callback request throw", faults: { throwCallback: "import" }, stage: "event_request", code: "request_failed", targets: ["find", "import"] },
  { name: "list callback request throw", faults: { throwCallback: "find" }, stage: "source_list_request", code: "request_failed", targets: ["find"] },
  ...["time", "extra", "private"].map(invalidEvent => ({ name: `invalid projected event ${invalidEvent}`, faults: { invalidEvent },
    stage: "event_validation", code: "invalid_provider_response", outer: "invalid_provider_response", targets: ["find", "import"] })),
  { name: "event callback revocation", faults: { httpTarget: "import", httpStatus: 403 }, stage: "event_request", code: "http_403", outer: "revoked", targets: ["find", "import"] },
  { name: "event cleanup dominates HTTP failure", faults: { httpTarget: "import", httpStatus: 500, cleanup: "import" }, stage: "cleanup", code: "cleanup_failed", outer: "cleanup_failed", cleanup: "cleanup_failed", targets: ["find", "import"] },
  { name: "list cleanup dominates HTTP failure", faults: { httpTarget: "find", httpStatus: 502, cleanup: "find" }, stage: "cleanup", code: "cleanup_failed", outer: "cleanup_failed", cleanup: "cleanup_failed", targets: ["find"] },
  { name: "extension cleanup dominates HTTP failure", faults: { httpTarget: "import", httpStatus: 500, extensions: true }, stage: "extension_cleanup", code: "cleanup_failed", outer: "cleanup_failed", cleanup: "cleanup_failed", targets: ["find", "import"] },
  { name: "extension cleanup suppresses successful data", faults: { extensions: true }, stage: "extension_cleanup", code: "cleanup_failed", outer: "cleanup_failed", cleanup: "cleanup_failed", targets: ["find", "import"] }
];
for (const scenario of failures) {
  test(`actual sync diagnostic: ${scenario.name}`, async () => {
    const p = provider({ faults: scenario.faults });
    const result = await execute(p, "sync", syncInput());
    assertWorkerFailure(result, p, scenario.stage, scenario.code, scenario.outer, scenario.cleanup);
    assert.equal(result.extensionsRemoved, !scenario.faults.extensions); assertQueries(p, scenario.targets);
  });
}

for (const credentialRound of [1, 2]) for (const credential of ["throw", "invalid", "expired"]) {
  test(`actual sync credential failure ${credential}, authentication round ${credentialRound}`, async () => {
    const p = provider({ faults: { credentialRound, credential } });
    const result = await execute(p, "sync", syncInput());
    const code = credential === "throw" ? "unavailable" : "expired";
    assertWorkerFailure(result, p, "credential", code, code, "not_requested");
    assert.equal(p.reads.length, 3 * credentialRound);
    assertQueries(p, credentialRound === 1 ? [] : ["find"]);
    if (credentialRound === 1) assert.equal(p.calls.length, 0, "no metadata before successful authentication");
  });
}

for (const target of ["find", "import"]) {
  test(`actual sync cancellation at ${target} callback still disables independently and removes extensions`, async () => {
    const controller = new AbortController();
    const p = provider({ onRequest: call => { if (call.kind === "callback" && call.target === target) controller.abort(); } });
    const result = await execute(p, "sync", syncInput(), { signal: controller.signal });
    assert.equal(result.ok, false); assert.equal(result.code, "cancelled"); assert.equal(result.cleanup, "workflow_disabled");
    assert.equal(result.extensionsRemoved, true); assert.equal(Object.hasOwn(result, "data"), false);
    assertQueries(p, target === "find" ? ["find"] : ["find", "import"]); assertPrivateAbsent(result, p);
    assertElapsed(result.diagnostic.elapsedMs); assert.equal(result.diagnostic.code, "cancelled");
  });
}

test("actual sync waits for workflow cleanup and extension disposal; elapsed includes both", { timeout: 3000 }, async t => {
  let now = Date.now(); t.mock.method(Date, "now", () => now);
  const disableEntered = deferred(), releaseDisable = deferred(), disposeEntered = deferred(), releaseDispose = deferred();
  const p = provider({ faults: { httpTarget: "import", httpStatus: 500 }, onRequest: async call => {
    if (call.kind === "disable") {
      now += 2000;
      if (call.target === "import") { disableEntered.resolve(); await releaseDisable.promise; }
    }
  }, onDispose: async () => { disposeEntered.resolve(); await releaseDispose.promise; now += 5000; } });
  let done = false;
  const running = execute(p, "sync", syncInput()).finally(() => { done = true; });
  try {
    await disableEntered.promise; await tick(); assert.equal(done, false); assert.equal(p.lifecycle.disposeAttempts, 0);
    releaseDisable.resolve(); await disposeEntered.promise; await tick(); assert.equal(done, false);
  } finally { releaseDisable.resolve(); releaseDispose.resolve(); }
  const result = await running;
  assertWorkerFailure(result, p, "event_request", "http_500");
  assert.ok(result.diagnostic.elapsedMs >= 9000, "elapsed includes synthetic disable and extension cleanup time");
  assertQueries(p, ["find", "import"]);
});

test("actual sync elapsed is capped even when extension cleanup takes more than ten minutes", async t => {
  let now = Date.now(); t.mock.method(Date, "now", () => now);
  const p = provider({ faults: { missing: true }, onDispose: () => { now += 900000; } });
  const result = await execute(p, "sync", syncInput());
  assertWorkerFailure(result, p, "source_match", "source_not_found");
  assert.ok(result.diagnostic.elapsedMs >= 599999); assertQueries(p, ["find"]);
});

test("elapsed helper clamps backwards time and fractional durations without wall-clock sleeps", () => {
  assert.equal(C.diagnosticElapsed(100, 99), 0);
  assert.equal(C.diagnosticElapsed(100, 101.9), 1);
  assertElapsed(C.diagnosticElapsed(0, 900000));
  assert.ok(C.diagnosticElapsed(0, 900000) >= 599999);
});

function adapterHarness(communicate) {
  let held = false;
  const modes = [];
  const adapter = createChildNativeAdapter({
    lock: async fn => { assert.equal(held, false); held = true; try { return await fn(); } finally { held = false; } },
    exchange: async (mode, options) => {
      assert.equal(held, true); modes.push(mode); return communicate(mode, options);
    }
  });
  return { adapter, modes, get held() { return held; } };
}

test("adapter propagates the actual worker diagnostic unchanged on OwnerFailure", async () => {
  const p = provider({ faults: { httpTarget: "import", httpStatus: 500 } });
  let workerResult;
  const h = adapterHarness(async (mode, options) => {
    workerResult = await execute(p, mode, options.payload, { signal: options.signal, stage: options.stage });
    return workerResult;
  });
  const records = [];
  await assert.rejects(h.adapter.perform({ ...adapterInput(), record: value => records.push(value) }), error => {
    assert.ok(error instanceof OwnerFailure); assert.equal(error.code, "unavailable");
    assertDiagnostic(error.diagnostic, "event_request", "http_500");
    assert.deepEqual(error.diagnostic, workerResult.diagnostic); assertPrivateAbsent(error, p); return true;
  });
  assert.deepEqual(h.modes, ["sync"]); assert.equal(h.held, false);
  assert.equal(records.includes("cleanup_failed"), false); assertQueries(p, ["find", "import"]);
});

test("adapter creates bounded diagnostics for legacy worker errors without retry or sticky blocking", async () => {
  const h = adapterHarness(async (mode, options) => {
    assert.equal(mode, "sync"); options.stage("credential");
    return failure({ code: "expired", cleanup: "not_requested", stage: "credential" });
  });
  for (let i = 0; i < 2; i++) {
    await assert.rejects(h.adapter.perform(adapterInput()), error => {
      assert.ok(error instanceof OwnerFailure); assertDiagnostic(error.diagnostic, "credential", "expired");
      assertPrivateAbsent(error); return true;
    });
    assert.equal(h.modes.length, i + 1, "only explicitly requested attempts occur");
  }
  assert.equal(h.held, false);
});

test("adapter pre-start bridge failure falls back safely without cleanup or retry", async () => {
  const h = adapterHarness(async () => { throw new BridgeFailure(false, "native_runtime", "unavailable"); });
  await assert.rejects(h.adapter.perform(adapterInput()), error => {
    assert.ok(error instanceof OwnerFailure); assertDiagnostic(error.diagnostic, "native_runtime", "unavailable");
    assertPrivateAbsent(error); return true;
  });
  assert.deepEqual(h.modes, ["sync"]); assert.equal(h.held, false);
});

for (const invalid of ["extra", "stage", "elapsed", "success", "started_bridge", "cleanup_failure"]) {
  test(`adapter rejects ${invalid}, recovers once independently and remains sticky after status`, async () => {
    const controller = new AbortController(), records = [];
    const h = adapterHarness(async (mode, options) => {
      if (mode === "status") return success(mode);
      if (mode === "cleanup-sync") {
        assert.equal(options.signal, undefined); assert.deepEqual(options.payload, {});
        return success(mode);
      }
      assert.equal(mode, "sync"); controller.abort();
      if (invalid === "started_bridge") throw new BridgeFailure(true, "import");
      if (invalid === "cleanup_failure") return failure({ code: "cleanup_failed", cleanup: "cleanup_failed", diagnostic: diagnostic("cleanup", "cleanup_failed") });
      if (invalid === "success") return { ...success(mode), diagnostic: diagnostic() };
      return failure({ diagnostic: invalid === "extra" ? { ...diagnostic(), raw: PRIVATE }
        : invalid === "stage" ? diagnostic(PRIVATE) : diagnostic("event_request", "http_500", 600001) });
    });
    await assert.rejects(h.adapter.perform({ ...adapterInput(), signal: controller.signal, record: value => records.push(value) }), error => {
      assert.ok(error instanceof OwnerFailure); assert.equal(error.code, "cleanup_failed");
      assertDiagnostic(error.diagnostic, "cleanup", "cleanup_failed"); assertPrivateAbsent(error); return true;
    });
    assert.deepEqual(h.modes, ["sync", "cleanup-sync"]);
    assert.deepEqual(records, ["cleanup_pending", "cleanup_failed"]);
    await h.adapter.status();
    await assert.rejects(h.adapter.perform(adapterInput()), /cleanup_failed/);
    await assert.rejects(h.adapter.check(), /cleanup_failed/);
    assert.deepEqual(h.modes, ["sync", "cleanup-sync", "status"]); assert.equal(h.held, false);
  });
}

for (const recovery of ["malformed", "failed", "throw"]) {
  test(`adapter ${recovery} recovery cannot expose payloads, retry Sync or clear sticky state`, async () => {
    const h = adapterHarness(async mode => {
      if (mode === "sync") throw new BridgeFailure(true, "find");
      assert.equal(mode, "cleanup-sync");
      if (recovery === "throw") throw new Error(PRIVATE);
      if (recovery === "failed") return failure({ code: "cleanup_failed", cleanup: "cleanup_failed" });
      return { ...success(mode), diagnostic: diagnostic() };
    });
    await assert.rejects(h.adapter.perform(adapterInput()), error => {
      assertDiagnostic(error.diagnostic, "cleanup", "cleanup_failed"); assertPrivateAbsent(error); return true;
    });
    await assert.rejects(h.adapter.perform(adapterInput()), /cleanup_failed/);
    assert.deepEqual(h.modes, ["sync", "cleanup-sync"]); assert.equal(h.held, false);
  });
}

test("actual cleanup-sync authenticates both targets even when first credentials fail and data signal is aborted", async () => {
  const controller = new AbortController(); controller.abort();
  const p = provider({ enabled: ["import"], faults: { credentialRound: 1, credential: "throw" }, onRequest: call => {
    assert.equal(call.signal, undefined, "recovery never inherits the cancelled data signal");
  } });
  // The event workflow starts Enabled in memory only; no live state is inspected.
  const result = await execute(p, "cleanup-sync", {}, { signal: controller.signal });
  assert.equal(result.ok, false); assert.equal(result.code, "cleanup_failed");
  assert.equal(result.cleanup, "cleanup_failed"); assert.equal(Object.hasOwn(result, "diagnostic"), false);
  assert.deepEqual(p.reads, ["account", "signed_in_user", "credential", "account", "signed_in_user", "credential"]);
  assert.equal(p.calls.filter(c => c.kind === "callback" || c.kind === "enable" || c.kind === "callback_url").length, 0);
  assert.ok(p.calls.some(c => c.kind === "read" && c.target === "import"), "second target recovery is independently attempted");
  assert.deepEqual(p.calls.filter(c => c.kind === "disable").map(c => c.target), ["import"]);
  assert.deepEqual(p.lifecycle, { created: 1, disposeAttempts: 1, removed: 1 }); assertPrivateAbsent(result, p);
});