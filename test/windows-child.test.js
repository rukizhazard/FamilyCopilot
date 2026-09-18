"use strict";
// OFFLINE ONLY: no native executable, auth CLI, real calendar, browser, server,
// process inspection or private filesystem access. Every execution seam is fake.
const test = require("node:test"), assert = require("node:assert/strict");
const { EventEmitter } = require("node:events"), { PassThrough } = require("node:stream");
const fs = require("node:fs/promises"), path = require("node:path"), vm = require("node:vm");
const P = require("../scripts/windows-child-protocol");
const { executeOperation: executeNativeOperation, serveWorker } = require("../scripts/windows-child-worker");
const executeOperation = (mode, options = {}) => executeNativeOperation(mode, { platform: "win32", ...options });
const { createChildNativeAdapter, exchange, exchangeProcess, BridgeFailure, runtime, interopEnvironment, main } = require("../scripts/windows-child");
const { manifest, bundle, stageChildBundle } = require("../scripts/windows-child-bundle");
const { createNativeReader } = require("../scripts/windows-azure-cli");
const { OwnerFailure } = require("../scripts/owner-calendar");
const C = require("../owner/child-calendar-core");
const child = require("../scripts/child-calendar");
const { scope, buildOwnerWorkflow, workflowId: listId, invitationId, connectionId, apiId } = require("../infra/calendar-list");
const { buildOctoberAvailability, workflowId: availabilityId } = require("../infra/availability");
const { buildChildWorkflow, workflowId } = require("../infra/child-calendar");
const { logicUrl } = require("../scripts/calendar-list");
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const context = () => ({ key: "a".repeat(64), sessionId: "b".repeat(64), expires: Date.now() + 600000 });
const payload = (mode = "find", c = context()) => ({ ...c, action: mode, ...(["import", "enroll", "sync"].includes(mode) ? {
  ...(mode === "sync" ? { reference: "c".repeat(64) } : { calendarId: P.sealSource("SYNTHETIC-ID", c) }), disclosure: "details", person: "Kimi", guardian: true, confirmed: true
} : {}) });
const events = (disclosure = "details") => ({ contract: C.contract, window: { ...C.window }, checkedAt: "2026-09-01T00:00:00Z", partial: true,
  events: [{ title: disclosure === "details" ? "Synthetic event" : "Busy", start: "2026-10-09T01:00:00Z", end: "2026-10-09T02:00:00Z", allDay: false, status: "scheduled", kind: "occurrence", redacted: disclosure === "busy_only" }] });
const readyReport = () => ({ status: "child_ready", httpGetCalendarCandidate: true, nativeViewCandidate: false, sasDisabled: true,
  preservedResourcesUnchanged: true, calendarQueries: 0, cloudChanges: false, runtimeVerified: false });
function success(mode, data) {
  const report = mode === "check" ? { status: "candidate_ready", cloudChanges: false, runtimeVerified: false } :
    mode === "deploy" ? { status: "deployed_disabled", sasDisabled: true, calendarQueries: 0, atomicCompareAndSwap: false } :
      mode === "status" ? readyReport() : { status: "workflow_disabled", calendarQueries: 0 };
  return { ok: true, cleanup: P.dataMode(mode) || P.cleanupMode(mode) ? "workflow_disabled" : "not_requested", stage: "complete", extensionsRemoved: true,
    ...(P.dataMode(mode) ? { data: data || (mode === "find" ? { calendars: [], partial: true } : events()) } : { report }) };
}
const failure = (code = "cancelled", cleanup = "workflow_disabled") => ({ ok: false, code, cleanup, stage: "complete", extensionsRemoved: true });
const frame = f => JSON.stringify({ protocol: P.protocol, ...f }) + "\n";
function processFake() {
  const c = new EventEmitter(); c.stdin = new PassThrough(); c.stdout = new PassThrough(); c.stderr = new PassThrough();
  c.kill = () => { c.emit("close", null); return true; }; return c;
}
function lockFake() {
  let held = false;
  return { get held() { return held; }, async lock(fn) {
    if (held) throw Error("owner_operation_busy"); held = true;
    try { return await fn(); } finally { held = false; }
  } };
}
function provider({ absent = false, output = events(), hook, dispose, identity = "normal" } = {}) {
  const caller = "11111111-1111-4111-8111-111111111111";
  const claims = { oid: caller, tid: scope.tenant, iss: `https://sts.windows.net/${scope.tenant}/`, appid: scope.application, aud: scope.audience, exp: 9999999999 };
  const token = `h.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.s`;
  const callback = `https://prod-01.eastus.logic.azure.com/workflows/${"b".repeat(32)}/triggers/manual/paths/invoke?api-version=2019-05-01`;
  let resource = absent ? null : buildChildWorkflow(caller), list = buildOwnerWorkflow(caller), removed = 0;
  const calls = [], reads = [], stages = [];
  const makeReader = () => createNativeReader({ platform: "win32", env: {},
    filesystem: { mkdtemp: async () => "synthetic-extension-directory", rmdir: async () => { await dispose?.(); removed++; } },
    run: async (command, env) => {
      reads.push(command); assert.equal(env.AZURE_EXTENSION_USE_DYNAMIC_INSTALL, "no");
      if (command.includes("signed-in-user")) return JSON.stringify(identity === "caller" ? "22222222-2222-4222-8222-222222222222" : caller);
      if (command.includes("get-access-token")) return JSON.stringify(identity === "token" ? "INVALID_SYNTHETIC_TOKEN" : token);
      return JSON.stringify({ tenant: scope.tenant, state: "Enabled" });
    } });
  const request = async (url, options) => {
    calls.push({ url, method: options.method, signal: options.signal });
    const override = await hook?.({ url, options, resource, list, calls }); if (override) return override;
    if (url === callback) return { status: 200, data: output };
    const id = url.replace("https://management.azure.com", "");
    if (id === logicUrl(workflowId)) {
      if (options.method === "PUT") resource = structuredClone(options.body);
      return resource ? { status: 200, data: structuredClone(resource) } : { status: 404, data: { error: { code: "ResourceNotFound" } } };
    }
    if (id === logicUrl(listId)) return { status: 200, data: structuredClone(list) };
    if (id === logicUrl(availabilityId)) return { status: 200, data: buildOctoberAvailability(caller) };
    if (id === logicUrl(invitationId)) return { status: 200, data: { properties: { state: "Disabled", accessControl: buildOwnerWorkflow(caller).properties.accessControl, parameters: { deliveryEnabled: { value: false } } } } };
    if (id === `${connectionId}?api-version=2016-06-01`) return { status: 200, data: { location: scope.location, properties: { api: { id: apiId }, statuses: [{ status: "Connected" }] } } };
    if (id === `${apiId}?api-version=2016-06-01&export=true`) return { status: 200, data: { paths: { "/{connectionId}/codeless/httprequest": { post: {
      operationId: "HttpRequest", deprecated: false, description: "1st segment: /me 2nd segment: calendars.", parameters: [
        { name: "Uri", in: "header", type: "string", required: true }, { name: "Method", in: "header", type: "string", required: true, enum: ["GET"] }
      ] } } } } };
    if (id === `/subscriptions/${scope.subscription}/resourceGroups/${scope.group}?api-version=2021-04-01`) return { status: 200, data: { location: scope.location } };
    for (const [target, get] of [[workflowId, () => resource], [listId, () => list]]) {
      if (id === logicUrl(target, "/triggers/manual/listCallbackUrl")) return { status: 200, data: { value: callback } };
      if (id === logicUrl(target, "/enable")) { get().properties.state = "Enabled"; return { status: 200 }; }
      if (id === logicUrl(target, "/disable")) { get().properties.state = "Disabled"; return { status: 200 }; }
    }
    throw Error("unexpected_synthetic_route");
  };
  return { makeReader, request, stage: s => stages.push(s), calls, reads, stages, get removed() { return removed; } };
}

test("child protocol is separate and rejects parent/generic/raw inputs and extra consent fields", () => {
  const c = context();
  for (const mode of P.modes) P.validateInput(mode, P.dataMode(mode) ? payload(mode, c) : {});
  for (const mode of ["availability", "cleanup", "http://evil.test", "login"]) assert.throws(() => P.validateInput(mode, {}), /blocked/);
  const good = payload("import", c);
  for (const mutate of [p => p.calendarId = "SYNTHETIC-ID", p => p.person = "Other", p => p.guardian = false, p => p.confirmed = false,
    p => p.disclosure = "all", p => p.action = "find", p => p.url = "https://evil.test", p => p.token = "SYNTHETIC", p => p.window = C.window]) {
    const p = { ...good }; mutate(p); assert.throws(() => P.validateInput("import", p));
  }
  for (const mode of ["check", "status", "deploy", "cleanup-find", "cleanup-import"]) assert.throws(() => P.validateInput(mode, { sessionId: c.sessionId }));
  assert.throws(() => P.parseFrame(JSON.stringify({ protocol: "windows-owner-v1", type: "ready", pid: 1 }), "check"));
  assert.throws(() => P.parseStart("start", "check"));
  assert.throws(() => P.parseStart(JSON.stringify({ protocol: P.protocol, type: "start", payload: {}, mode: "deploy" }), "check"));
});
test("AES-GCM seal validates key/session/absolute expiry/AAD/tampering and cannot be a raw provider ID", () => {
  const now = Date.now(), c = context(), id = "SYNTHETIC/ID+=";
  const sealed = P.sealSource(id, c, now);
  assert.ok(P.isSealed(sealed)); assert.equal(P.openSource(sealed, c, now), id); assert.notEqual(P.sealSource(id, c, now), sealed);
  assert.ok(sealed.length <= 6144); assert.equal(P.isSealed(id), false); assert.equal(P.isSealed("a".repeat(64)), false);
  assert.equal(P.isSealed(sealed + "="), false); assert.equal(P.isSealed("x".repeat(6145)), false);
  for (const next of [{ ...c, key: "c".repeat(64) }, { ...c, sessionId: "d".repeat(64) }, { ...c, expires: c.expires + 1 },
    { ...c, expires: now }, { ...c, expires: now + 1800001 }, { ...c, expires: 1.5 }, { ...c, key: "wrong" }]) assert.throws(() => P.openSource(sealed, next, now));
  for (const index of [5, 17, 33]) { const b = Buffer.from(sealed, "base64url"); b[index] ^= 1; assert.throws(() => P.openSource(b.toString("base64url"), c, now)); }
  assert.throws(() => P.sealSource("../unsafe", c));
  assert.equal(P.openSource(P.sealSource("A".repeat(4096), c), c).length, 4096);
});
test("sealed source names are sanitized natively, bounded, unique and strict after IPC", () => {
  const c = context(), id = P.sealSource("SYNTHETIC", c);
  assert.equal(P.sanitizeName(" \u202ehello\u0000 user@example.test "), "hello [address hidden]");
  assert.equal(P.sanitizeName("\u0000 "), "Unnamed calendar");
  assert.throws(() => P.sanitizeName("x".repeat(1025)));
  const good = { calendars: [{ id, name: "Synthetic" }], partial: true }; P.sourceList(good);
  for (const bad of [{ ...good, token: "PRIVATE" }, { calendars: [{ id: "RAW-ID", name: "x" }], partial: true },
    { calendars: [...good.calendars, ...good.calendars], partial: true }, { calendars: [{ id, name: "a@b.test" }], partial: true },
    { calendars: [{ id, name: "x\n" }], partial: true }, { calendars: [{ id, name: "" }], partial: true }]) assert.throws(() => P.sourceList(bad));
});
test("normal and busy disclosure require canonical projection both before and after IPC", () => {
  for (const disclosure of ["details", "busy_only"]) {
    const data = events(disclosure); assert.deepEqual(P.project(data, disclosure), data);
    P.validateResult(success("import", data), "import", disclosure);
    for (const mutate of [d => d.events[0].location = "PRIVATE", d => d.events[0].start = "invalid", d => d.events[0].end = "2026-10-08T00:00:00Z",
      d => d.window.end = "2027-01-01T00:00:00Z", d => d.extra = true]) { const d = structuredClone(data); mutate(d); assert.throws(() => P.project(d, disclosure)); }
  }
  assert.throws(() => P.project(events("details"), "busy_only"));
  const privateData = events(); privateData.events[0].redacted = true; assert.throws(() => P.project(privateData, "details"));
});
test("status/report/result schemas cannot pass arbitrary reports or unverified success", () => {
  for (const mode of ["check", "status", "deploy", "cleanup-find", "cleanup-import"]) {
    P.validateResult(success(mode), mode);
    for (const mutate of [r => r.report.token = "PRIVATE", r => r.extensionsRemoved = false, r => r.stage = "account", r => r.report.status = "arbitrary",
      r => r.report.calendarQueries = 1]) { const r = success(mode); mutate(r); assert.throws(() => P.validateResult(r, mode)); }
  }
  const s = success("status"); s.report.httpGetCalendarCandidate = false; assert.throws(() => P.validateResult(s, "status"));
  P.validateResult(failure("update_conflict", "not_requested"), "deploy");
  assert.throws(() => P.validateResult(failure("PRIVATE"), "find"));
  assert.throws(() => P.validateResult({ ...failure(), raw: "PRIVATE" }, "find"));
});
test("worker uses actual native-only reader with mocked commands; check GET-only and one guarded deploy PUT", async () => {
  for (const mode of ["check", "deploy"]) {
    const p = provider({ absent: true }); const result = await executeOperation(mode, p);
    assert.deepEqual(result, success(mode)); assert.equal(p.reads.length, 3); assert.equal(p.removed, 1);
    assert.equal(p.calls.filter(c => c.method !== "GET").length, mode === "check" ? 0 : 1);
    assert.ok(p.calls.every(c => c.method === "GET" || c.method === "PUT"));
    assert.doesNotMatch(JSON.stringify(result), /https:|11111111|token|calendarId/);
  }
  const collision = provider(); const result = await executeOperation("deploy", collision);
  assert.equal(result.code, "update_conflict"); assert.ok(collision.calls.every(c => c.method === "GET"));
});
test("native caller and token validation failures never reach metadata or invocation", async () => {
  for (const identity of ["caller", "token"]) {
    const p = provider({ identity, absent: true }); const result = await executeOperation("check", p);
    assert.equal(result.ok, false); assert.equal(p.calls.length, 0); assert.equal(p.removed, 1);
    assert.doesNotMatch(JSON.stringify(result), /22222222|INVALID_SYNTHETIC_TOKEN/);
  }
});
test("status delegates exact readiness to check-only backend and rejects generic metadata reports", async () => {
  for (const bad of [false, true]) {
    let mode, invoked = 0;
    const p = provider();
    const result = await executeOperation("status", { ...p, makeBackend: async (value, options) => {
      mode = value; const b = await child.childBackend(value, options);
      const invoke = b.invoke; b.invoke = (...args) => { invoked++; return invoke(...args); }; return b;
    }, inspectReady: async b => { await child.preserved(b); return bad ? { ...readyReport(), raw: "PRIVATE" } : readyReport(); } });
    assert.equal(mode, "check"); assert.equal(invoked, 0); assert.equal(result.ok, !bad); assert.equal(p.removed, 1);
    assert.ok(p.calls.every(c => c.method === "GET"));
  }
});
test("native find seals sources after validated operation/cleanup, raw IDs never cross IPC", async () => {
  const c = context(), p = provider();
  const result = await executeOperation("find", { ...p, payload: payload("find", c), find: async (_b, { record }) => {
    record("cleanup_pending"); record("workflow_disabled");
    return { calendars: [{ id: "SYNTHETIC-ID", name: "Calendar user@example.test\u0000" }], partial: true };
  } });
  assert.equal(result.ok, true); assert.equal(result.data.calendars[0].name, "Calendar [address hidden]");
  assert.equal(P.openSource(result.data.calendars[0].id, c), "SYNTHETIC-ID"); assert.doesNotMatch(JSON.stringify(result), /SYNTHETIC-ID|user@example|"key"/);
  assert.equal(p.removed, 1);
});
test("native import decrypts only in worker, sends fixed consent, validates raw response before canonicalizing", async () => {
  for (const disclosure of ["details", "busy_only"]) {
    let body;
    const input = { ...payload("import"), disclosure }, p = provider({ output: events(disclosure), hook: ({ url, options }) => { if (!url.includes("management.azure.com")) body = options.body; } });
    const result = await executeOperation("import", { ...p, payload: input });
    assert.equal(result.ok, true); assert.deepEqual(result.data, events(disclosure)); assert.equal(p.removed, 1);
    assert.deepEqual(body, { calendarId: "SYNTHETIC-ID", disclosure, person: "Kimi", guardian: true, confirmed: true });
    assert.equal(p.calls.filter(c => !c.url.includes("management.azure.com")).length, 1);
  }
  const malformed = events(); malformed.events[0].start = "invalid";
  const p = provider({ output: malformed }), result = await executeOperation("import", { ...p, payload: payload("import") });
  assert.equal(result.code, "invalid_provider_response"); assert.equal(result.cleanup, "workflow_disabled"); assert.equal(result.data, undefined);
});
test("import seal tampering is rejected before backend/auth; startup and invalid mode are inert", async () => {
  let readers = 0, backends = 0;
  const input = payload("import"); input.sessionId = "c".repeat(64);
  const result = await executeOperation("import", { payload: input, makeReader: async () => { readers++; }, makeBackend: async () => { backends++; } });
  assert.equal(result.code, "blocked"); assert.equal(readers, 0); assert.equal(backends, 0);
  await assert.rejects(executeOperation("arbitrary", { makeReader: () => assert.fail() }), /blocked/);
  await assert.rejects(executeOperation("import", { payload: { ...input, expires: Date.now() - 1 }, makeReader: () => assert.fail() }), /expired/);
});
test("cancel after native import awaits independent disable/readback and extension removal, no late data", async () => {
  const controller = new AbortController(), wait = deferred(), entered = deferred();
  const p = provider({ hook: async ({ url, options }) => {
    if (!url.includes("management.azure.com")) controller.abort();
    if (url.includes("/disable?")) { assert.equal(options.signal, undefined); entered.resolve(); await wait.promise; }
  } });
  let done = false;
  const operation = executeOperation("import", { ...p, payload: payload("import"), signal: controller.signal }).finally(() => { done = true; });
  await entered.promise; await tick(); assert.equal(done, false); assert.equal(p.removed, 0);
  wait.resolve(); const result = await operation; assert.equal(result.code, "cancelled"); assert.equal(result.cleanup, "workflow_disabled"); assert.equal(result.data, undefined); assert.equal(p.removed, 1);
});
test("extension disposal failure, missing cleanup and ambiguous enable are explicit sticky failures", async () => {
  const p = provider({ absent: true, dispose: () => { throw Error("PRIVATE_PATH"); } });
  const r = await executeOperation("check", p); assert.equal(r.code, "cleanup_failed"); assert.equal(r.extensionsRemoved, false); assert.equal(r.cleanup, "cleanup_failed");
  const incomplete = await executeOperation("find", { ...provider(), payload: payload(), find: async () => ({ calendars: [], partial: true }) });
  assert.equal(incomplete.code, "cleanup_failed");
  const ambiguous = provider({ hook: ({ url }) => { if (url.includes("/enable?")) throw Error("PRIVATE"); } });
  const result = await executeOperation("import", { ...ambiguous, payload: payload("import") });
  assert.equal(result.code, "cleanup_failed"); assert.equal(ambiguous.calls.filter(c => c.url.includes("/disable?")).length, 1);
});
test("cleanup modes require empty payload, ignore data cancellation and invoke only dedicated recovery", async () => {
  for (const mode of ["cleanup-find", "cleanup-import"]) {
    const aborted = new AbortController(); aborted.abort(); let recovered = false, clear = 0, disposed = 0;
    const result = await executeOperation(mode, { payload: {}, signal: aborted.signal,
      makeReader: async () => ({ read: async () => {}, dispose: async () => { disposed++; } }),
      makeBackend: async (m, options) => { assert.equal(m, mode); assert.equal(options.signal, undefined); return { clear() { clear++; } }; },
      recover: async (_b, action) => { assert.equal(action, mode.slice(8)); recovered = true; return { arbitrary: "NEVER_FORWARD" }; },
      find: () => assert.fail(), importEvents: () => assert.fail(), deployment: () => assert.fail() });
    assert.deepEqual(result, success(mode)); assert.ok(recovered); assert.equal(clear, 1); assert.equal(disposed, 1);
    await assert.rejects(executeOperation(mode, { payload: { expires: 1 }, makeReader: () => assert.fail() }), /blocked/);
    const r = await executeOperation(mode, { makeReader: async () => { throw Error("PRIVATE"); }, recover: async () => {} });
    assert.equal(r.code, "cleanup_failed"); assert.equal(r.cleanup, "cleanup_failed");
  }
});
test("worker ready handshake comes before execution; malformed/start timeout/EOF cannot execute", async () => {
  for (const inputText of ["start\n", "cancel\n", "x".repeat(P.inputLimit + 1), null, "timeout"]) {
    const input = new PassThrough(), output = new PassThrough(); let count = 0, text = "";
    output.on("data", b => { text += b; });
    const done = serveWorker("check", { input, output, startMs: 5, execute: async () => { count++; return success("check"); } });
    assert.equal(P.parseFrame(text.trim(), "check").type, "ready"); assert.equal(count, 0);
    if (inputText === null) input.end(); else if (inputText !== "timeout") input.write(inputText);
    await done; assert.equal(count, 0);
  }
});
test("worker EOF/cancel/operation deadline await execution cleanup, fence late successful writes", async () => {
  for (const action of ["EOF", "cancel", "timeout"]) {
    const input = new PassThrough(), output = new PassThrough(), wait = deferred(), entered = deferred(), cancelled = deferred();
    let text = "", signal, lateStage;
    output.on("data", b => { text += b; });
    const done = serveWorker("import", { input, output, operationMs: 5, execute: async (_mode, options) => {
      signal = options.signal; lateStage = options.stage; signal.addEventListener("abort", () => cancelled.resolve(), { once: true });
      entered.resolve(); await wait.promise; return success("import");
    } });
    input.write(P.startLine("import", payload("import"))); await entered.promise;
    if (action === "EOF") input.end(); else if (action === "cancel") input.write("cancel\n");
    await cancelled.promise; assert.ok(signal.aborted); assert.equal(text.includes('"result"'), false);
    wait.resolve(); const result = await done; assert.equal(result.code, "cancelled"); assert.equal(result.data, undefined);
    const prior = text; lateStage("complete"); assert.equal(text, prior);
  }
});
test("controller launches exact native Code.exe, minimal env, start JSON on stdin only; waits close", async () => {
  const c = processFake(), input = payload("import"), writes = [];
  c.stdin.on("data", b => writes.push(b.toString()));
  const done = exchangeProcess("import", { payload: input }, { convert: async () => "C:\\Temp\\worker.cjs", launch: (file, args, options) => {
    assert.equal(file, runtime); assert.deepEqual(args, ["C:\\Temp\\worker.cjs", "import"]); assert.equal(options.shell, false); assert.equal(options.detached, false); assert.equal(options.signal, undefined);
    assert.doesNotMatch(JSON.stringify({ args, options }), /sessionId|calendarId|"key"|AZURE_CONFIG_DIR/); return c;
  } });
  await tick(); assert.equal(writes.length, 0); c.stdout.write(frame({ type: "ready", pid: 1234 }));
  assert.deepEqual(P.parseStart(writes[0].trim(), "import"), input);
  c.stdout.write(frame({ type: "result", result: success("import") })); let settled = false; done.then(() => { settled = true; });
  await tick(); assert.equal(settled, false); c.emit("close", 0); assert.equal((await done).ok, true);
  assert.deepEqual(interopEnvironment({ WSL_INTEROP: "synthetic", NODE_OPTIONS: "PRIVATE", AZURE_CONFIG_DIR: "PRIVATE", WSLENV: "PRIVATE" }),
    { PATH: "/usr/bin:/bin", WSL_INTEROP: "synthetic", ELECTRON_RUN_AS_NODE: "1", WSLENV: "ELECTRON_RUN_AS_NODE/w" });
});
test("transport decodes split UTF8 code points without changing canonical event titles", async () => {
  const c = processFake(), data = events(); data.events[0].title = "Synthetic \u2603 \ud83c\udf08";
  const done = exchange("import", { payload: payload("import") }, { convert: async () => "worker", launch: () => c });
  await tick(); c.stdout.write(frame({ type: "ready", pid: 1234 }));
  const bytes = Buffer.from(frame({ type: "result", result: success("import", data) }));
  for (const byte of bytes) c.stdout.write(Buffer.from([byte]));
  c.emit("close", 0); assert.deepEqual((await done).data, data);
});
test("transport rejects stderr, parent frames, overflow, duplicate handshake, late frames and wrong exits after close", async () => {
  for (const kind of ["stderr", "parent", "overflow", "duplicate", "late", "wrongexit", "partial"]) {
    const c = processFake(), done = exchange("find", { payload: payload() }, { convert: async () => "worker", launch: () => c });
    await tick(); c.stdout.write(frame({ type: "ready", pid: 1234 }));
    if (kind === "stderr") c.stderr.write("PRIVATE");
    if (kind === "parent") c.stdout.write('{"protocol":"windows-owner-v1","type":"ready","pid":2}\n');
    if (kind === "overflow") c.stdout.write("x".repeat(P.maxBytes + 1));
    if (kind === "duplicate") c.stdout.write(frame({ type: "ready", pid: 1234 }));
    if (["late", "wrongexit", "partial"].includes(kind)) c.stdout.write(frame({ type: "result", result: success("find") }));
    if (kind === "late") c.stdout.write(frame({ type: "stage", stage: "complete" }));
    if (kind === "partial") c.stdout.write(Buffer.from([0xe2]));
    c.emit("close", 1); await assert.rejects(done, e => e instanceof BridgeFailure && e.started && !JSON.stringify(e).includes("PRIVATE"));
  }
});
test("cancellation sends one cancel line and suppresses cooperative late success without detaching", async () => {
  const c = processFake(), controller = new AbortController(), writes = [];
  c.stdin.on("data", b => writes.push(b.toString())); c.kill = () => assert.fail("no kill of cooperative worker");
  const done = exchange("find", { payload: payload(), signal: controller.signal }, { convert: async () => "worker", launch: () => c });
  await tick(); c.stdout.write(frame({ type: "ready", pid: 1234 })); controller.abort(); controller.abort();
  assert.equal(writes.filter(w => w === "cancel\n").length, 1);
  c.stdout.write(frame({ type: "result", result: success("find") })); c.emit("close", 0);
  const result = await done; assert.equal(result.code, "cancelled"); assert.equal(result.data, undefined);
});
test("watchdog holds lock beyond result/close until owned tree exit and code disposal, then independent recovery", async () => {
  const c = processFake(), killing = deferred(), reaped = deferred(), recovering = deferred(), recovered = deferred(), disposed = [];
  const state = lockFake(); let count = 0;
  const adapter = createChildNativeAdapter({ lock: state.lock, exchange: async (mode, options) => {
    assert.equal(state.held, true); count++;
    if (mode === "cleanup-find") { assert.equal(options.signal, undefined); assert.deepEqual(options.payload, {}); assert.deepEqual(disposed, [true]); recovering.resolve(); await recovered.promise; return success(mode); }
    return exchange(mode, options, { launch: () => c, operationMs: 5, cleanupMs: 5,
      stageBundle: async () => ({ nativePath: "worker", dispose: async () => { assert.equal(state.held, true); disposed.push(true); } }),
      killTree: async pid => { assert.equal(pid, 1234); killing.resolve(); await reaped.promise; } });
  } });
  const records = [], cxt = context();
  const done = adapter.perform({ action: "find", sessionId: cxt.sessionId, expires: cxt.expires, record: r => records.push(r) });
  const rejection = assert.rejects(done, /cleanup_failed/);
  await tick(); c.stdout.write(frame({ type: "ready", pid: 1234 })); await killing.promise; c.emit("close", null);
  await tick(); assert.equal(state.held, true); assert.equal(count, 1); assert.equal(disposed.length, 0);
  reaped.resolve(); await recovering.promise; assert.equal(state.held, true);
  recovered.resolve(); await rejection; assert.equal(state.held, false); assert.deepEqual(records, ["cleanup_pending", "cleanup_failed"]);
  await assert.rejects(adapter.perform({ action: "find", sessionId: cxt.sessionId, expires: cxt.expires }), /cleanup_failed/);
});
test("adapter construction inert; generated key stable per adapter, distinct across adapters, consent fixed", async () => {
  const inputs = [], state = lockFake();
  const communicate = async (mode, options) => { assert.equal(state.held, true); inputs.push(options.payload); return success(mode); };
  const a = createChildNativeAdapter({ lock: state.lock, exchange: communicate }), b = createChildNativeAdapter({ lock: state.lock, exchange: communicate });
  assert.equal(inputs.length, 0); const c = context(), base = { sessionId: c.sessionId, expires: c.expires };
  await a.perform({ ...base, action: "find" }); await a.perform({ ...base, action: "find" }); await b.perform({ ...base, action: "find" });
  assert.equal(inputs[0].key, inputs[1].key); assert.notEqual(inputs[0].key, inputs[2].key);
  await a.perform({ ...base, action: "import", calendarId: P.sealSource("SYNTHETIC", inputs[0]), disclosure: "details" });
  assert.deepEqual(inputs[3], { ...inputs[0], action: "import", calendarId: inputs[3].calendarId, disclosure: "details", person: "Kimi", guardian: true, confirmed: true });
  await assert.rejects(a.perform({ ...base, action: "deploy" }), /blocked/);
  await assert.rejects(a.perform({ ...base, action: "find", key: c.key }), /blocked/);
  await assert.rejects(a.perform({ ...base, action: "import", calendarId: "RAW", disclosure: "details" }), /blocked/);
});
test("adapter independent recovery validates strict response and stays sticky even after successful status", async () => {
  for (const recovery of ["success", "malformed", "failed", "throw"]) {
    const calls = [], records = [], state = lockFake(), controller = new AbortController(), c = context();
    const adapter = createChildNativeAdapter({ lock: state.lock, exchange: async (mode, options) => {
      calls.push(mode); assert.equal(state.held, true);
      if (mode === "import") { controller.abort(); throw new BridgeFailure(true, "import"); }
      if (mode === "status") return success(mode);
      assert.equal(mode, "cleanup-import"); assert.equal(options.signal, undefined); assert.deepEqual(options.payload, {});
      if (recovery === "throw") throw Error("PRIVATE");
      if (recovery === "failed") return failure("cleanup_failed", "cleanup_failed");
      return recovery === "malformed" ? { ...success(mode), raw: "PRIVATE" } : success(mode);
    } });
    await assert.rejects(adapter.perform({ action: "import", sessionId: c.sessionId, expires: c.expires, calendarId: P.sealSource("SYNTHETIC", c), disclosure: "details", signal: controller.signal, record: s => records.push(s) }), /cleanup_failed/);
    assert.deepEqual(calls, ["import", "cleanup-import"]); assert.deepEqual(records, ["cleanup_pending", "cleanup_failed"]);
    await adapter.status(); await assert.rejects(adapter.deploy(), /cleanup_failed/); assert.equal(state.held, false);
  }
});
test("validated cleanup failure and malformed result also trigger independent recovery, never automatic find retry", async () => {
  for (const first of [failure("cleanup_failed", "cleanup_failed"), { ...success("find"), raw: "PRIVATE" }]) {
    const modes = [], c = context(), adapter = createChildNativeAdapter({ lock: fn => fn(), exchange: async mode => { modes.push(mode); return mode === "find" ? first : success(mode); } });
    await assert.rejects(adapter.perform({ action: "find", sessionId: c.sessionId, expires: c.expires }), /cleanup_failed/);
    assert.deepEqual(modes, ["find", "cleanup-find"]);
  }
});
test("prestart failure skips recovery, lock contention does no work, prestart staging failures remain sticky", async () => {
  for (const code of ["unavailable", "cleanup_failed"]) {
    let calls = 0; const c = context(), adapter = createChildNativeAdapter({ lock: fn => fn(), exchange: async () => { calls++; throw new BridgeFailure(false, "native_runtime", code); } });
    await assert.rejects(adapter.perform({ action: "find", sessionId: c.sessionId, expires: c.expires }), new RegExp(code)); assert.equal(calls, 1);
    if (code === "cleanup_failed") { await assert.rejects(adapter.check(), /cleanup_failed/); assert.equal(calls, 1); }
  }
  const blocked = createChildNativeAdapter({ lock: async () => { throw Error("owner_operation_busy"); }, exchange: () => assert.fail() });
  await assert.rejects(blocked.status(), /busy/);
});
test("staging disposal runs after native close and failure remains sticky before lock release", async () => {
  const c = processFake(), state = lockFake(); let disposed = false;
  const adapter = createChildNativeAdapter({ lock: state.lock, exchange: (mode, options) => exchange(mode, options, { launch: () => c,
    stageBundle: async () => ({ nativePath: "worker", dispose: async () => { assert.equal(state.held, true); disposed = true; throw Error("PRIVATE_PATH"); } }) }) });
  const done = adapter.check(), rejected = assert.rejects(done, /cleanup_failed/);
  await tick(); c.stdout.write(frame({ type: "ready", pid: 1234 })); c.stdout.write(frame({ type: "result", result: success("check") }));
  await tick(); assert.equal(disposed, false); assert.equal(state.held, true); c.emit("close", 0); await rejected;
  assert.equal(disposed, true); assert.equal(state.held, false); await assert.rejects(adapter.deploy(), /cleanup_failed/);
});
test("CLI has only metadata/status/single deploy, outputs only safe fixed fields, never IDs/key/events", async () => {
  for (const arg of ["find", "import", "--find", "--import", "--status --find", "__proto__"]) {
    const result = await main([arg], { createAdapter: () => assert.fail(), log: () => {} }); assert.equal(result.status, "preflight_blocked");
  }
  for (const [arg, mode] of [["--metadata-only", "check"], ["--status", "status"], ["--approved-deploy-once", "deploy"]]) {
    let calls = 0, text;
    const adapter = createChildNativeAdapter({ lock: fn => fn(), exchange: async m => { assert.equal(m, mode); calls++; return success(m); } });
    const result = await main([arg], { createAdapter: () => adapter, log: t => { text = t; } });
    assert.equal(calls, 1); assert.equal(result.mode, mode); assert.equal(result.calendarQueries, 0); assert.equal(result.extensionsRemoved, true);
    assert.doesNotMatch(text, /"key"|sessionId|calendarId|calendars|events|https:/);
  }
});
test("fixed child code-only manifest resolves every literal import and bundle only emits ready until start", async () => {
  assert.equal(new Set(manifest).size, manifest.length);
  assert.ok(manifest.every(f => /^(scripts|infra|owner)\/[\w-]+\.js$/.test(f) && !/cache|school|config|\.ps1|serve-owner/.test(f)));
  for (const file of manifest) {
    const source = await fs.readFile(path.join(__dirname, "..", file), "utf8");
    for (const match of source.matchAll(/require\(["']([^"']+)["']\)/g)) {
      if (match[1].startsWith("node:")) continue;
      const id = path.posix.normalize(path.posix.join(path.posix.dirname(file), match[1])) + ".js";
      assert.ok(manifest.includes(id), `${file}: unresolved application import ${id}`);
    }
  }
  const code = await bundle(), proc = new EventEmitter(), input = new PassThrough(), output = new PassThrough(); let text = "";
  Object.assign(proc, { platform: "win32", argv: ["node", "worker.cjs", "check"], env: {}, stdin: input, stdout: output, pid: 2345 });
  output.on("data", b => { text += b; });
  vm.runInNewContext(code, { require, process: proc, Buffer, setTimeout, clearTimeout, AbortController, AbortSignal, structuredClone, TextEncoder });
  assert.equal(P.parseFrame(text.trim(), "check").type, "ready"); input.end(); await tick(); assert.equal(proc.exitCode, 1); assert.equal(text.trim().split("\n").length, 1);
  await assert.rejects(bundle(async () => "x".repeat(256 * 1024 + 1)), /blocked/);
});
test("child staging reuses code-only helper, deletes own file only and promotes uncertain removal to cleanup_failed", async () => {
  const calls = [];
  const filesystem = { mkdtemp: async prefix => { calls.push("mkdir"); return prefix + "synthetic"; },
    writeFile: async (_file, source, options) => { calls.push("write"); assert.equal(options.flag, "wx"); assert.match(source, /windows-child-worker/); },
    unlink: async () => { calls.push("unlink"); }, rmdir: async () => { calls.push("rmdir"); } };
  const staged = await stageChildBundle({ filesystem }); assert.match(staged.nativePath, /^C:\\/); await staged.dispose();
  assert.deepEqual(calls, ["mkdir", "write", "unlink", "rmdir"]);
  await assert.rejects(stageChildBundle({ filesystem: { ...filesystem, writeFile: async () => { throw Error("PRIVATE"); }, unlink: async () => { throw Error("PRIVATE"); } } }), /cleanup_failed/);
});

test("complete offline adapter-to-worker find/import uses actual child backend and never returns raw source", async () => {
  const c = context(), state = lockFake(), modes = [], providers = [];
  const adapter = createChildNativeAdapter({ lock: state.lock, exchange: async (mode, options) => {
    modes.push(mode); assert.equal(state.held, true);
    const output = mode === "find" ? { status: "listed", count: 1, completeness: "unknown", ownership: "unverified", eventsRead: 0,
      calendars: [{ id: "SYNTHETIC-ID", name: "Calendar user@example.test" }] } : events(options.payload.disclosure);
    const p = provider({ output }); providers.push(p);
    return executeOperation(mode, { ...p, ...options });
  } });
  const base = { sessionId: c.sessionId, expires: c.expires }, records = [];
  const list = await adapter.perform({ ...base, action: "find", record: r => records.push(r) });
  assert.equal(list.calendars.length, 1); assert.ok(P.isSealed(list.calendars[0].id)); assert.equal(list.calendars[0].name, "Calendar [address hidden]");
  const data = await adapter.perform({ ...base, action: "import", calendarId: list.calendars[0].id, disclosure: "busy_only" });
  assert.deepEqual(data, events("busy_only")); assert.deepEqual(modes, ["find", "import"]);
  assert.ok(records.includes("workflow_disabled")); assert.equal(records.includes("cleanup_failed"), false);
  assert.ok(providers.every(p => p.removed === 1 && p.calls.filter(call => !call.url.includes("management.azure.com")).length === 1));
  assert.equal(state.held, false);
});
test("native provider revocation retains verified cleanup, no result or automatic retry", async () => {
  const p = provider({ hook: ({ url }) => !url.includes("management.azure.com") ? { status: 403, data: { error: "PRIVATE" } } : undefined });
  const result = await executeOperation("import", { ...p, payload: payload("import") });
  assert.equal(result.code, "revoked"); assert.equal(result.cleanup, "workflow_disabled"); assert.equal(result.data, undefined);
  assert.equal(p.calls.filter(c => !c.url.includes("management.azure.com")).length, 1); assert.equal(p.removed, 1);
});
test("abort during extension removal fences final data while preserving successful cleanup", async () => {
  const controller = new AbortController();
  const p = provider({ dispose: () => controller.abort() });
  const result = await executeOperation("import", { ...p, payload: payload("import"), signal: controller.signal });
  assert.equal(result.code, "cancelled"); assert.equal(result.cleanup, "workflow_disabled"); assert.equal(result.data, undefined); assert.equal(p.removed, 1);
});
test("worker malformed trailing payload and unknown modes fail before executing", async () => {
  const input = new PassThrough(), output = new PassThrough(); let calls = 0;
  const done = serveWorker("check", { input, output, execute: async () => { calls++; return success("check"); } });
  input.write(P.startLine("check", {}) + "{unexpected"); await done; assert.equal(calls, 0);
  assert.throws(() => P.parseFrame(frame({ type: "ready", pid: 1 }), "availability"), /blocked/);
});
test("transport has a pre-handshake startup bound and cannot send a payload after cancelled start", async () => {
  const c = processFake(), writes = []; let kills = 0;
  c.stdin.on("data", b => writes.push(b.toString())); c.kill = () => { kills++; c.emit("close", null); return true; };
  const done = exchangeProcess("check", {}, { convert: async () => "worker", launch: () => c, startupMs: 5 });
  await assert.rejects(done, e => e instanceof BridgeFailure && !e.started);
  assert.equal(kills, 1); assert.deepEqual(writes, ["cancel\n"]);
  c.stdout.write(frame({ type: "ready", pid: 2 })); assert.deepEqual(writes, ["cancel\n"]);
});
test("adapter fences synthetic late results after request cancellation without recovery/retry", async () => {
  const controller = new AbortController(), c = context(), modes = [];
  const adapter = createChildNativeAdapter({ lock: fn => fn(), exchange: async mode => { modes.push(mode); controller.abort(); return success(mode); } });
  await assert.rejects(adapter.perform({ action: "find", sessionId: c.sessionId, expires: c.expires, signal: controller.signal }), /cancelled/);
  assert.deepEqual(modes, ["find"]);
});
test("worker preserves original failure stage while removing native extensions", async () => {
  let disposed = false;
  const result = await executeOperation("check", { makeReader: async () => ({ read: async () => { throw new OwnerFailure("unavailable"); }, dispose: async () => { disposed = true; } }) });
  assert.equal(result.code, "unavailable"); assert.equal(result.stage, "account"); assert.equal(disposed, true);
});

test("worker refuses non-native execution before decrypt/auth even with valid import input", async () => {
  await assert.rejects(executeNativeOperation("import", { platform: "linux", payload: payload("import"), makeReader: () => assert.fail() }), /blocked/);
});
test("broken IPC stage observer cannot skip native disable or extension disposal", async () => {
  const p = provider();
  const result = await executeOperation("import", { ...p, payload: payload("import"), stage: s => { if (s === "cleanup_pending" || s === "extension_cleanup") throw Error("synthetic_pipe_closed"); } });
  assert.equal(result.code, "cancelled"); assert.equal(result.cleanup, "workflow_disabled"); assert.equal(p.removed, 1);
  assert.equal(p.calls.filter(c => c.url.includes("/disable?")).length, 1); assert.equal(result.data, undefined);
});
test("throwing WSL observer cannot bypass independent recovery or clear sticky state", async () => {
  const c = context(), modes = [];
  const adapter = createChildNativeAdapter({ lock: fn => fn(), exchange: async (mode, options) => {
    modes.push(mode); if (mode === "find") throw new BridgeFailure(true, "find");
    options.stage("workflow_disabled"); return success(mode);
  } });
  await assert.rejects(adapter.perform({ action: "find", sessionId: c.sessionId, expires: c.expires, record: () => { throw Error("synthetic_observer"); } }), /cleanup_failed/);
  assert.deepEqual(modes, ["find", "cleanup-find"]); await assert.rejects(adapter.deploy(), /cleanup_failed/);
});