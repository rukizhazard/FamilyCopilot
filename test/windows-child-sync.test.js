"use strict";
// OFFLINE ONLY. All worker authentication, provider, process and lock seams are
// fake. No native executable, CLI, listener, private file or calendar is accessed.
const test = require("node:test"), assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { EventEmitter } = require("node:events"), { PassThrough } = require("node:stream");
const P = require("../scripts/windows-child-protocol"), C = require("../owner/child-calendar-core");
const { executeOperation, serveWorker } = require("../scripts/windows-child-worker");
const { createChildNativeAdapter, exchangeProcess, BridgeFailure } = require("../scripts/windows-child");
const { OwnerFailure } = require("../scripts/owner-calendar");
const caller = "abcdef01-1111-4111-8111-111111111111", otherCaller = "abcdef02-2222-4222-8222-222222222222";
const first = "SYNTHETIC-FIRST-ID", selected = "SYNTHETIC-SECOND-ID";
const context = () => ({ key: "a".repeat(64), sessionId: "b".repeat(64), expires: Date.now() + 600000 });
const events = (disclosure = "details") => ({ contract: C.contract, window: { ...C.window }, checkedAt: "2026-09-01T00:00:00Z", partial: true,
  events: [{ title: disclosure === "details" ? "Synthetic event" : "Busy", start: "2026-10-09T01:00:00Z", end: "2026-10-09T02:00:00Z",
    allDay: false, status: "scheduled", kind: "occurrence", redacted: disclosure === "busy_only" }] });
const payload = (action, c = context(), disclosure = "details") => ({ ...c, action, disclosure, person: "Kimi", guardian: true, confirmed: true,
  ...(action === "sync" ? { reference: P.sourceReference(selected, caller) } : { calendarId: P.sealSource(selected, c) }) });
const success = (mode, data = events()) => ({ ok: true, cleanup: "workflow_disabled", stage: "complete", extensionsRemoved: true,
  ...(P.dataMode(mode) ? { data } : { report: { status: "workflow_disabled", calendarQueries: 0 } }) });
const frame = value => JSON.stringify({ protocol: P.protocol, ...value }) + "\n";
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const list = () => ({ calendars: [{ id: first, name: "Same renamed label" }, { id: selected, name: "Same renamed label" }], partial: false });
function fixture({ raw = list(), callers = [caller, caller], onClear, onFind, onImport, onDispose, onBackend, cleanup = true } = {}) {
  const calls = [], stages = [], readers = [], backends = [];
  let index = 0;
  const seams = {
    platform: "win32", stage: value => stages.push(value),
    makeReader: async () => {
      const reader = { read: async () => "synthetic-native-only", dispose: async () => { calls.push("dispose"); await onDispose?.(); } };
      readers.push(reader); return reader;
    },
    makeBackend: async (mode, options) => {
      const i = index++; calls.push(`backend:${mode}`); await onBackend?.(mode, options, i);
      const b = { caller: callers[i], clear: async () => { calls.push(`clear:${mode}`); await onClear?.(mode); } };
      backends.push({ mode, options, b }); return b;
    },
    find: async (b, options) => {
      calls.push("find"); await onFind?.(b, options);
      if (cleanup) { options.record("cleanup_pending"); options.record("workflow_disabled"); }
      return raw;
    },
    importEvents: async (b, options) => {
      calls.push("import");
      try { await onImport?.(b, options); return events(options.disclosure); }
      finally { if (cleanup) { options.record("cleanup_pending"); options.record("workflow_disabled"); } }
    },
    request: async () => assert.fail("No real request seam permitted"),
    deployment: () => assert.fail("No deployment"), inspectReady: () => assert.fail("No metadata inspection"),
    recover: async () => assert.fail("Recovery must be explicitly mocked")
  };
  return { seams, calls, stages, readers, backends, run: (mode, input = payload(mode), extra = {}) => executeOperation(mode, { ...seams, ...extra, payload: input }) };
}

test("source reference is exact namespaced SHA256, session-independent and caller/source-bound", async () => {
  const expected = createHash("sha256").update(JSON.stringify(["child-source-v1", C.contract, C.window, caller, selected])).digest("hex");
  assert.equal(P.sourceReference(selected, caller), expected);
  assert.equal(P.sourceReference(selected, caller.toUpperCase()), expected);
  assert.notEqual(P.sourceReference(first, caller), expected);
  assert.notEqual(P.sourceReference(selected, otherCaller), expected);
  const references = [];
  for (const c of [context(), { ...context(), key: "c".repeat(64), sessionId: "d".repeat(64) }]) {
    const f = fixture(), result = await f.run("enroll", payload("enroll", c));
    assert.equal(result.ok, true); references.push(result.data.reference);
    assert.deepEqual(result.data.data, events()); assert.deepEqual(f.calls, ["backend:import", "import", "clear:import", "dispose"]);
    assert.equal(f.backends[0].options.calendarId, selected);
    assert.doesNotMatch(JSON.stringify(result), /SYNTHETIC-SECOND-ID|abcdef01|calendarId|sourceName|"key"/);
  }
  assert.deepEqual(references, [expected, expected]);
});
test("invalid caller and raw source fail closed without returning identifiers", async () => {
  for (const bad of [undefined, null, {}, "", "not-a-uuid", caller + "\n", caller.replaceAll("-", "")]) {
    assert.throws(() => P.sourceReference(selected, bad), /blocked/);
    for (const mode of ["enroll", "sync"]) {
      const f = fixture({ callers: [bad], raw: { calendars: [], partial: false } });
      const r = await f.run(mode); assert.equal(r.code, "blocked"); assert.equal(r.data, undefined);
      assert.equal(f.calls.includes("import"), false); assert.equal(f.calls.includes("find"), false);
    }
  }
  for (const id of ["", "https://evil.test", "../source", selected + "\n", "x".repeat(4097)]) assert.throws(() => P.sourceReference(id, caller));
});
test("enrollment preserves old seal expiry, same-session authentication and pre-auth refusal", async () => {
  const c = context(), original = payload("enroll", c);
  for (const change of [{ sessionId: "e".repeat(64) }, { key: "f".repeat(64) }, { expires: c.expires + 1 }]) {
    const f = fixture(), r = await f.run("enroll", { ...original, ...change });
    assert.equal(r.code, "blocked"); assert.equal(f.readers.length, 0); assert.deepEqual(f.calls, []);
  }
  const f = fixture(); await assert.rejects(f.run("enroll", { ...original, expires: Date.now() - 1 }), /expired/);
  assert.equal(f.readers.length, 0);
  assert.throws(() => P.openSource(original.calendarId, c, c.expires), /expired/);
});
test("sync matches second source by reference despite rename and duplicate names, clearing before reauth", async () => {
  for (const disclosure of ["details", "busy_only"]) {
    for (const partial of [false, true]) {
      const f = fixture({ raw: { ...list(), partial } }), r = await f.run("sync", payload("sync", context(), disclosure));
      assert.equal(r.ok, true); assert.deepEqual(r.data, events(disclosure));
      assert.deepEqual(f.calls, ["backend:find", "find", "clear:find", "backend:import", "import", "clear:import", "dispose"]);
      assert.equal(f.readers.length, 1); assert.notEqual(f.backends[0].b, f.backends[1].b);
      assert.equal(f.backends[0].options.read, f.backends[1].options.read);
      assert.equal(f.backends[0].options.calendarId, undefined);
      assert.equal(f.backends[1].options.calendarId, selected); assert.equal(f.backends[1].options.disclosure, disclosure);
      assert.deepEqual(r.data.window, C.window); assert.doesNotMatch(JSON.stringify(r), /SYNTHETIC-(FIRST|SECOND)-ID|abcdef01|Same renamed label|reference|sourceName/);
    }
  }
});
test("sync never guesses first/default/name: partial missing unavailable, complete missing revoked", async () => {
  for (const partial of [false, true]) {
    for (const calendars of [[], [{ id: first, name: "Child" }]]) {
      const f = fixture({ raw: { calendars, partial } }), r = await f.run("sync");
      assert.equal(r.code, partial ? "unavailable" : "revoked"); assert.equal(r.cleanup, "workflow_disabled");
      assert.equal(r.data, undefined); assert.equal(f.backends.length, 1); assert.equal(f.calls.includes("import"), false);
    }
    const f = fixture({ callers: [otherCaller], raw: { ...list(), partial } }), r = await f.run("sync");
    assert.equal(r.code, partial ? "unavailable" : "revoked"); assert.equal(f.backends.length, 1);
  }
});
test("sync validates entire bounded list including duplicates after match and unknown fields", async () => {
  const good = list();
  const badLists = [
    { ...good, token: "SYNTHETIC_SECRET" }, { ...good, partial: "false" }, { calendars: {}, partial: false },
    { ...good, calendars: [...good.calendars, good.calendars[1]] },
    { ...good, calendars: [...good.calendars, { id: "BAD-ID", name: "x", credential: "SYNTHETIC_SECRET" }] },
    { ...good, calendars: [{ id: selected, name: "x" }, { id: "https://evil.test", name: "x" }] },
    { ...good, calendars: [{ id: selected, name: "x".repeat(1025) }] },
    { ...good, calendars: [{ id: selected, name: null }] },
    { ...good, calendars: [{ id: "x".repeat(4097), name: "x" }] },
    { ...good, calendars: Array.from({ length: 101 }, (_, i) => ({ id: `SYNTHETIC-${i}`, name: "x" })) },
    { ...good, calendars: Array.from({ length: 100 }, (_, i) => ({ id: `S${i}`.padEnd(4096, "x"), name: "x" })) }
  ];
  for (const raw of badLists) {
    const f = fixture({ raw }), r = await f.run("sync");
    assert.equal(r.code, "invalid_provider_response"); assert.equal(r.data, undefined); assert.equal(f.backends.length, 1);
    assert.doesNotMatch(JSON.stringify(r), /SYNTHETIC_SECRET|BAD-ID|evil/);
  }
  const raw = { calendars: Array.from({ length: 99 }, (_, i) => ({ id: `SYNTHETIC-${i}`, name: "x" })).concat({ id: selected, name: "x" }), partial: true };
  assert.equal((await fixture({ raw }).run("sync")).ok, true);
});
test("reauth caller change or invalid caller prevents any import", async () => {
  for (const next of [otherCaller, undefined, caller + "\n"]) {
    const f = fixture({ callers: [caller, next] }), r = await f.run("sync");
    assert.equal(r.code, next === otherCaller ? "revoked" : "blocked"); assert.equal(r.data, undefined);
    assert.equal(f.calls.includes("import"), false); assert.ok(f.calls.includes("clear:import")); assert.ok(f.calls.includes("dispose"));
  }
});
test("sync cancellation and expiry between list cleanup and import prevent second backend", async () => {
  for (const kind of ["cancel", "expire", "clear-fail"]) {
    const controller = new AbortController(), input = payload("sync"), f = fixture({ onClear: mode => {
      if (mode !== "find") return;
      if (kind === "cancel") controller.abort();
      if (kind === "expire") input.expires = Date.now() - 1;
      if (kind === "clear-fail") throw Error("SYNTHETIC_SECRET");
    } });
    const r = await f.run("sync", input, { signal: controller.signal });
    assert.equal(r.code, { cancel: "cancelled", expire: "expired", "clear-fail": "cleanup_failed" }[kind]);
    assert.equal(r.data, undefined); assert.equal(f.backends.length, 1); assert.ok(f.calls.includes("dispose"));
  }
});
test("sync requires separate verified cleanup for both data stages", async () => {
  const missingFind = fixture({ cleanup: false }), r = await missingFind.run("sync");
  assert.equal(r.code, "cleanup_failed"); assert.equal(missingFind.backends.length, 1);
  const f = fixture(), missingImport = await f.run("sync", payload("sync"), { importEvents: async () => events() });
  assert.equal(missingImport.code, "cleanup_failed"); assert.equal(missingImport.data, undefined);
  const bad = fixture({ onFind: (_b, o) => o.record("cleanup_failed") });
  assert.equal((await bad.run("sync")).code, "cleanup_failed"); assert.equal(bad.backends.length, 1);
});
test("enroll and sync fence cancellation, revocation and cleanup failures without data or retry", async () => {
  for (const mode of ["enroll", "sync"]) for (const kind of ["cancel", "revoked", "cleanup-fail", "dispose-cancel", "dispose-fail", "reauth-cancel"]) {
    const controller = new AbortController(), f = fixture({
      onBackend: action => { if (kind === "reauth-cancel" && action === "import") controller.abort(); },
      onImport: (_b, options) => {
        if (kind === "cancel") controller.abort();
        if (kind === "revoked") throw new OwnerFailure("revoked");
        if (kind === "cleanup-fail") options.record("cleanup_failed");
      },
      onDispose: () => { if (kind === "dispose-cancel") controller.abort(); if (kind === "dispose-fail") throw Error("SYNTHETIC_SECRET"); }
    });
    const r = await f.run(mode, payload(mode), { signal: controller.signal });
    assert.equal(r.code, kind.includes("fail") ? "cleanup_failed" : kind === "revoked" ? "revoked" : "cancelled");
    assert.equal(r.data, undefined); assert.equal(f.calls.filter(c => c === "import").length, kind === "reauth-cancel" ? 0 : 1);
    assert.equal(f.calls.filter(c => c === "dispose").length, 1);
  }
});
test("strict cloud request projection applies to enroll and sync import, not list envelope", async () => {
  for (const mode of ["enroll", "sync"]) {
    const f = fixture(), malformed = events(); malformed.events[0].start = "invalid";
    const r = await f.run(mode, payload(mode), {
      request: async (_url, options) => ({ status: 200, data: options.list ? list() : malformed }),
      find: async (_b, o) => {
        assert.deepEqual((await f.backends[0].options.request("synthetic", { maxBytes: C.maxBytes, list: true })).data, list());
        o.record("workflow_disabled"); return list();
      },
      importEvents: async (_b, o) => {
        try { const r = await f.backends.at(-1).options.request("synthetic", { maxBytes: C.maxBytes }); return C.project(r.data, "details"); }
        finally { o.record("workflow_disabled"); }
      }
    });
    assert.equal(r.code, "invalid_provider_response"); assert.equal(r.data, undefined); assert.equal(r.cleanup, "workflow_disabled");
  }
});
test("cleanup-sync attempts both fresh exact targets even on first authentication/recovery/clear failure", async () => {
  for (const failAt of ["none", "auth-find", "recover-find", "clear-find", "recover-import", "dispose"]) {
    const controller = new AbortController(); controller.abort();
    const f = fixture({ onBackend: (mode, options) => {
      assert.equal(options.signal, undefined); if (failAt === "auth-find" && mode === "cleanup-find") throw Error("SYNTHETIC_SECRET");
    }, onClear: mode => { if (failAt === "clear-find" && mode === "cleanup-find") throw Error("SYNTHETIC_SECRET"); },
    onDispose: () => { if (failAt === "dispose") throw Error("SYNTHETIC_SECRET"); } });
    const recovered = [], r = await f.run("cleanup-sync", {}, { signal: controller.signal, recover: async (_b, action) => {
      recovered.push(action); if (failAt === `recover-${action}`) throw Error("SYNTHETIC_SECRET");
      return { arbitrary: "NOT_FOR_IPC" };
    } });
    assert.deepEqual(f.calls.filter(c => c.startsWith("backend:")), ["backend:cleanup-find", "backend:cleanup-import"]);
    assert.deepEqual(recovered, failAt === "auth-find" ? ["import"] : ["find", "import"]);
    assert.equal(f.readers.length, 1); assert.equal(f.calls.filter(c => c === "dispose").length, 1);
    assert.equal(r.ok, failAt === "none"); if (!r.ok) assert.equal(r.code, "cleanup_failed");
    assert.doesNotMatch(JSON.stringify(r), /SYNTHETIC_SECRET|NOT_FOR_IPC|abcdef/);
  }
});
test("new protocol modes remain exact, bounded and reject credential/URL/consent leaks", () => {
  assert.equal(P.protocol, "windows-child-v1"); assert.equal(P.maxSealed, 6144); assert.equal(P.inputLimit, 8192); assert.equal(P.maxBytes, 300 * 1024);
  for (const mode of ["enroll", "sync"]) {
    const good = payload(mode); assert.deepEqual(P.parseStart(P.startLine(mode, good), mode), good);
    for (const extra of ["token", "caller", "sourceName", "url", "window", mode === "sync" ? "calendarId" : "reference"]) assert.throws(() => P.validateInput(mode, { ...good, [extra]: "SYNTHETIC_SECRET" }));
    for (const change of [{ guardian: false }, { confirmed: false }, { person: "Other" }, { disclosure: "all" }, { action: "import" },
      { key: good.key + "\n" }, { sessionId: good.sessionId + "\n" }]) assert.throws(() => P.validateInput(mode, { ...good, ...change }));
    for (const key of Object.keys(good)) { const bad = { ...good }; delete bad[key]; assert.throws(() => P.validateInput(mode, bad)); }
  }
  for (const reference of ["A".repeat(64), "a".repeat(63), "a".repeat(65), "a".repeat(64) + "\n", "https://evil.test", null]) {
    assert.throws(() => P.validateInput("sync", { ...payload("sync"), reference }));
    assert.throws(() => P.enrollment({ reference, data: events() }, "details"));
  }
  assert.throws(() => P.validateInput("cleanup-sync", { reference: "a".repeat(64) }));
  for (const mode of ["cleanup-enroll", "cleanup-arbitrary", "sync-default", "__proto__"]) assert.throws(() => P.parseFrame(frame({ type: "ready", pid: 1 }), mode));
  const value = { reference: P.sourceReference(selected, caller), data: events() };
  assert.deepEqual(P.enrollment(value, "details"), value);
  for (const bad of [{ ...value, caller }, { ...value, token: "SYNTHETIC_SECRET" }, { ...value, data: { ...events(), sourceId: selected } }, { ...value, data: events("details") }]) {
    assert.throws(() => P.enrollment(bad, "busy_only"));
  }
  for (const mode of ["enroll", "sync", "cleanup-sync"]) {
    const r = success(mode, mode === "enroll" ? value : events());
    P.parseFrame(frame({ type: "result", result: r }), mode, "details");
    for (const change of [{ caller }, { extensionsRemoved: false }, { cleanup: "not_requested" }, { stage: "find" }]) assert.throws(() => P.validateResult({ ...r, ...change }, mode, "details"));
  }
});
test("adapter enroll and fresh-session sync preserve one key, exact payloads and legacy shapes", async () => {
  const inputs = [], outputs = []; let held = false;
  const adapter = createChildNativeAdapter({ lock: async fn => { assert.equal(held, false); held = true; try { return await fn(); } finally { held = false; } },
    exchange: async (mode, options) => {
      assert.equal(held, true); inputs.push(options.payload);
      const f = fixture(), r = await f.run(mode, options.payload); outputs.push(r); return r;
    } });
  const c = context(), found = await adapter.perform({ action: "find", sessionId: c.sessionId, expires: c.expires });
  const enrolled = await adapter.perform({ action: "enroll", sessionId: c.sessionId, expires: c.expires, calendarId: found.calendars[1].id, disclosure: "details" });
  assert.deepEqual(enrolled, { reference: P.sourceReference(selected, caller), data: events() });
  const fresh = { sessionId: "d".repeat(64), expires: c.expires + 1 };
  const synced = await adapter.perform({ action: "sync", ...fresh, reference: enrolled.reference, disclosure: "busy_only" });
  assert.deepEqual(synced, events("busy_only")); assert.equal(inputs[0].key, inputs[2].key);
  assert.deepEqual(Object.keys(inputs[2]).sort(), ["action", "sessionId", "expires", "key", "reference", "disclosure", "person", "guardian", "confirmed", "diagnostics"].sort());
  assert.equal(inputs[2].diagnostics, true);
  assert.equal(inputs[2].person, "Kimi"); assert.equal(inputs[2].guardian, true); assert.equal(inputs[2].confirmed, true);
  assert.doesNotMatch(JSON.stringify(outputs), /SYNTHETIC-(FIRST|SECOND)-ID|abcdef01|"key"|"caller"/);
  assert.deepEqual(await adapter.perform({ action: "import", sessionId: c.sessionId, expires: c.expires, calendarId: found.calendars[1].id, disclosure: "details" }), events());
  assert.equal(held, false);
});
test("adapter rejects unapproved fields and expired sessions before lock/dispatch", async () => {
  let calls = 0; const adapter = createChildNativeAdapter({ lock: () => { calls++; assert.fail(); }, exchange: () => assert.fail() });
  for (const mode of ["enroll", "sync"]) {
    const p = payload(mode), base = { action: mode, sessionId: p.sessionId, expires: p.expires, disclosure: p.disclosure,
      ...(mode === "sync" ? { reference: p.reference } : { calendarId: p.calendarId }) };
    for (const key of ["url", "caller", "token", "key", "sourceName", "guardian", "confirmed", "person", "window", "diagnostics"]) await assert.rejects(adapter.perform({ ...base, [key]: "SYNTHETIC_SECRET" }), /blocked/);
    await assert.rejects(adapter.perform({ ...base, expires: Date.now() - 1 }), /expired/);
  }
  for (const action of ["cleanup-sync", "cleanup-enroll", "sync-default"]) await assert.rejects(adapter.perform({ action }), /blocked/);
  assert.equal(calls, 0);
});
test("adapter maps recovery exactly, holds lock, ignores cancellation and stays sticky even on recovery success", async () => {
  for (const mode of ["enroll", "sync"]) for (const kind of ["bridge", "cleanup", "leak"]) {
    let held = false; const modes = [], records = [], controller = new AbortController(), p = payload(mode);
    const adapter = createChildNativeAdapter({ lock: async fn => { held = true; try { return await fn(); } finally { held = false; } }, exchange: async (action, options) => {
      assert.equal(held, true); modes.push(action);
      if (action === mode) {
        controller.abort();
        if (kind === "bridge") throw new BridgeFailure(true, "import");
        if (kind === "cleanup") return { ok: false, code: "cleanup_failed", cleanup: "cleanup_failed", stage: "import", extensionsRemoved: true };
        return { ...success(mode, mode === "enroll" ? { reference: p.reference || "a".repeat(64), data: events() } : events()), token: "SYNTHETIC_SECRET" };
      }
      assert.equal(action, mode === "enroll" ? "cleanup-import" : "cleanup-sync");
      assert.equal(options.signal, undefined); assert.deepEqual(options.payload, {}); return success(action);
    } });
    const options = { action: mode, sessionId: p.sessionId, expires: p.expires, disclosure: "details", signal: controller.signal, record: value => records.push(value),
      ...(mode === "enroll" ? { calendarId: p.calendarId } : { reference: p.reference }) };
    await assert.rejects(adapter.perform(options), /cleanup_failed/);
    assert.deepEqual(modes, [mode, mode === "enroll" ? "cleanup-import" : "cleanup-sync"]);
    assert.deepEqual(records, ["cleanup_pending", "cleanup_failed"]); assert.equal(held, false);
    await assert.rejects(adapter.perform({ ...options, signal: undefined }), /cleanup_failed/); assert.equal(modes.length, 2);
  }
});
test("adapter fences late enrollment/sync success without reference, data, recovery or retry", async () => {
  for (const mode of ["enroll", "sync"]) for (const kind of ["cancel", "expire"]) {
    const controller = new AbortController(), modes = [], p = payload(mode);
    const adapter = createChildNativeAdapter({ lock: fn => fn(), exchange: async (action, options) => {
      modes.push(action); if (kind === "cancel") controller.abort(); else options.payload.expires = Date.now() - 1;
      return success(mode, mode === "enroll" ? { reference: "a".repeat(64), data: events() } : events());
    } });
    await assert.rejects(adapter.perform({ action: mode, sessionId: p.sessionId, expires: p.expires, disclosure: "details", signal: controller.signal,
      ...(mode === "enroll" ? { calendarId: p.calendarId } : { reference: p.reference }) }), kind === "cancel" ? /cancelled/ : /expired/);
    assert.deepEqual(modes, [mode]);
  }
});
test("worker framed new-mode responses contain no source/caller and EOF fences late data", async () => {
  for (const mode of ["enroll", "sync"]) for (const cancel of [false, true]) {
    const input = new PassThrough(), output = new PassThrough(), entered = deferred(), wait = deferred(), cancelled = deferred(); let text = "";
    output.on("data", b => { text += b; });
    const f = fixture({ onDispose: async () => { entered.resolve(); await wait.promise; } });
    const done = serveWorker(mode, { input, output, execute: (action, options) => {
      options.signal.addEventListener("abort", () => cancelled.resolve(), { once: true });
      return executeOperation(action, { ...f.seams, ...options });
    } });
    input.write(P.startLine(mode, payload(mode))); await entered.promise;
    assert.equal(text.includes('"result"'), false);
    if (cancel) { input.end(); await cancelled.promise; }
    wait.resolve();
    const r = await done; assert.equal(r.ok, !cancel); if (cancel) { assert.equal(r.code, "cancelled"); assert.equal(r.data, undefined); }
    assert.doesNotMatch(text, /SYNTHETIC-(FIRST|SECOND)-ID|abcdef01|Same renamed label|sourceName|"key"|"caller"/);
    for (const line of text.trim().split("\n")) P.parseFrame(line, mode, "details");
  }
});
test("fake controller transport supports new frames, waits native exit and rejects leaked IPC", async () => {
  for (const mode of ["enroll", "sync", "cleanup-sync"]) for (const leak of [false, true]) {
    const c = new EventEmitter(); c.stdin = new PassThrough(); c.stdout = new PassThrough(); c.stderr = new PassThrough();
    c.kill = () => assert.fail("No real or synthetic kill expected"); const writes = [], p = mode === "cleanup-sync" ? {} : payload(mode);
    c.stdin.on("data", b => writes.push(b.toString()));
    const done = exchangeProcess(mode, { payload: p }, { convert: async () => "synthetic-worker", launch: (_file, args, options) => {
      assert.equal(args[1], mode); assert.doesNotMatch(JSON.stringify({ args, options }), /reference|calendarId|"key"|abcdef/); return c;
    } });
    const rejected = leak ? assert.rejects(done, e => e instanceof BridgeFailure && e.started) : undefined;
    await tick(); c.stdout.write(frame({ type: "ready", pid: 1234 })); assert.deepEqual(P.parseStart(writes[0], mode), p);
    const r = success(mode, mode === "enroll" ? { reference: P.sourceReference(selected, caller), data: events() } : events());
    if (leak) r.caller = caller;
    c.stdout.write(frame({ type: "result", result: r })); let settled = false; done.then(() => { settled = true; }, () => {});
    await tick(); assert.equal(settled, false); c.emit("close", 0);
    if (leak) await rejected; else assert.equal((await done).ok, true);
  }
});