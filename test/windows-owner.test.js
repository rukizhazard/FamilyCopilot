"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { EventEmitter, once } = require("node:events"), { PassThrough } = require("node:stream");
const http = require("node:http"), net = require("node:net");
const fs = require("node:fs/promises"), os = require("node:os"), path = require("node:path");
const { commands, cliCommand, createNativeReader, runCommand, killNativeTree } = require("../scripts/windows-azure-cli");
const { protocol, maxBytes, busyOnly, parseFrame, validateResult } = require("../scripts/windows-owner-protocol");
const { executeOperation, serveWorker } = require("../scripts/windows-owner-worker");
const { interopEnvironment, exchange, createNativeAdapter, BridgeFailure, runtime } = require("../scripts/windows-owner");
const { manifest, bundle, stageBundle } = require("../scripts/windows-owner-bundle");
const { withOwnerOperation } = require("../scripts/owner-operation");
const { createServer } = require("../scripts/serve-owner");
const { scope, workflowId: ownerId, connectionId, invitationId, apiId, buildOwnerWorkflow, buildWorkflow } = require("../infra/calendar-list");
const { workflowId, buildOctoberAvailability } = require("../infra/availability");
const { logicUrl } = require("../scripts/calendar-list");
const A = require("../owner/availability-core");
const caller = "11111111-1111-4111-8111-111111111111";
const callback = `https://prod-01.eastus.logic.azure.com/workflows/${"a".repeat(32)}/triggers/manual/paths/invoke?api-version=2019-05-01`;
const snapshot = () => ({ window: { ...A.liveWindow }, checkedAt: "2026-09-17T10:00:00Z", people: [0, 1].map(person => ({ person, status: "checked", slots: Array(336).fill("busy") })) });
const success = (mode = "availability") => ({ ok: true, cleanup: mode === "status" ? "not_requested" : "workflow_disabled", stage: "complete", extensionsRemoved: true,
  ...(mode === "availability" ? { binding: "a".repeat(64), data: snapshot() } : {}) });
const failure = (code = "cancelled", cleanup = "workflow_disabled") => ({ ok: false, code, cleanup, stage: "availability", extensionsRemoved: true });
const frame = value => JSON.stringify({ protocol, ...value }) + "\n";
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
function child() {
  const c = new EventEmitter(); c.stdout = new PassThrough(); c.stderr = new PassThrough(); c.stdin = new PassThrough(); c.pid = 1234;
  c.kill = () => { c.emit("close", null); return true; };
  return c;
}
function provider({ hook, output = snapshot(), mutate, dispose } = {}) {
  const claims = { oid: caller, tid: scope.tenant, iss: `https://sts.windows.net/${scope.tenant}/`, appid: scope.application, aud: scope.audience, exp: 9999999999 };
  const token = `h.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.s`;
  let resource = buildOctoberAvailability(caller), clears = 0;
  mutate?.(resource);
  const calls = [], stages = [];
  const makeReader = async () => ({ read: async args => args[0] === "ad" ? caller : args.includes("get-access-token") ? token : { tenant: scope.tenant, state: "Enabled" },
    dispose: async () => { clears++; await dispose?.(); } });
  const request = async (url, options) => {
    calls.push({ url, method: options.method, signal: options.signal, authenticated: options.token === token });
    const override = await hook?.({ url, options, resource, calls }); if (override) return override;
    if (url === callback) return { status: options.token === token ? 200 : 401, data: output };
    const id = url.replace("https://management.azure.com", "");
    if (id === logicUrl(workflowId)) return { status: 200, data: structuredClone(resource) };
    if (id === logicUrl(ownerId)) return { status: 200, data: buildOwnerWorkflow(caller) };
    if (id === `${connectionId}?api-version=2016-06-01`) return { status: 200, data: { location: scope.location, properties: { api: { id: apiId }, statuses: [{ status: "Connected" }] } } };
    if (id === logicUrl(invitationId)) return { status: 200, data: { properties: { state: "Disabled", accessControl: buildWorkflow(caller).properties.accessControl, parameters: { deliveryEnabled: { value: false } } } } };
    if (id === `/subscriptions/${scope.subscription}/resourceGroups/${scope.group}?api-version=2021-04-01`) return { status: 200, data: { location: scope.location } };
    if (id === logicUrl(workflowId, "/triggers/manual/listCallbackUrl")) return { status: 200, data: { value: callback } };
    if (id === logicUrl(workflowId, "/enable")) { resource.properties.state = "Enabled"; return { status: 200 }; }
    if (id === logicUrl(workflowId, "/disable")) { resource.properties.state = "Disabled"; return { status: 200 }; }
    throw Error("unexpected_request");
  };
  return { request, makeReader, stage: s => stages.push(s), stages, calls, token, get clears() { return clears; } };
}

test("native CLI exactly allowlists credentials; command injection and auth flags are blocked", () => {
  for (const args of commands) assert.match(cliCommand(args), /az\.cmd.*@arguments; exit \$LASTEXITCODE/);
  for (const args of [["login"], ["rest"], ["account", "get-access-token"], [...commands[1], "--debug"], [...commands[1].slice(0, -1), "id'; evil"], [...commands[0], "--tenant", scope.tenant]]) assert.throws(() => cliCommand(args), /blocked/);
  assert.doesNotMatch(commands.map(cliCommand).join("\n"), /EncodedCommand|ExecutionPolicy|\.ps1|Invoke-Expression/);
});
test("native reader uses one empty temporary extension directory, retains native auth path, and removes it", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "familycopilot-native-test-"));
  let directory, runs = 0;
  const env = { USERPROFILE: "C:\\Users\\Synthetic", AZURE_CONFIG_DIR: "C:\\Users\\Synthetic\\.azure", AZURE_EXTENSION_DIR: "PRIVATE_OLD" };
  try {
    const reader = await createNativeReader({ platform: "win32", env, temp, run: async (_command, nativeEnv) => {
      runs++; directory ||= nativeEnv.AZURE_EXTENSION_DIR;
      assert.equal(nativeEnv.AZURE_EXTENSION_DIR, directory); assert.deepEqual(await fs.readdir(directory), []);
      assert.equal(nativeEnv.AZURE_CONFIG_DIR, env.AZURE_CONFIG_DIR);
      assert.equal(nativeEnv.AZURE_LOGGING_ENABLE_LOG_FILE, "false"); assert.equal(nativeEnv.AZURE_EXTENSION_USE_DYNAMIC_INSTALL, "no");
      return '"synthetic"';
    } });
    await reader.read(commands[0]); await reader.read(commands[1]); await reader.dispose();
    assert.equal(runs, 2); await assert.rejects(fs.stat(directory), { code: "ENOENT" });
    assert.equal(env.AZURE_EXTENSION_DIR, "PRIVATE_OLD"); await assert.rejects(reader.read(commands[1]), /blocked/);
  } finally { await fs.rm(temp, { recursive: true, force: true }); }
});
test("native reader refuses Linux, Linux auth overrides, concurrency, and cancels without detaching command", async () => {
  for (const config of [{ platform: "linux" }, { platform: "win32", env: { AZURE_CONFIG_DIR: "/home/synthetic/.azure" } }]) await assert.rejects(createNativeReader(config), /blocked/);
  const wait = deferred(), controller = new AbortController(); let removed = false, settled = false;
  const reader = await createNativeReader({ platform: "win32", env: {}, filesystem: { mkdtemp: async () => "synthetic-temp", rmdir: async () => { removed = true; } }, run: () => wait.promise });
  const read = reader.read(commands[0], controller.signal).finally(() => { settled = true; });
  controller.abort(); await tick(); assert.equal(settled, false);
  await assert.rejects(reader.dispose(), /cleanup_failed/); await assert.rejects(reader.read(commands[1]), /blocked/);
  wait.resolve('"PRIVATE_TOKEN"'); await assert.rejects(read, /cancelled/); await reader.dispose(); assert.equal(removed, true);
});
test("native command bounds output/time, drains private errors and waits for owned-tree termination", async () => {
  const c = child(), killed = deferred(); let pid;
  const run = runCommand("fixed", {}, { launch: () => c, maxBytes: 4, killTree: value => { pid = value; return killed.promise; } });
  c.stdout.write("PRIVATE_TOKEN"); c.stderr.write("PRIVATE_ID"); c.emit("close", 1);
  let settled = false; run.catch(() => { settled = true; }); await tick(); assert.equal(settled, false); assert.equal(pid, c.pid);
  killed.resolve(); await assert.rejects(run, error => error.message === "unavailable" && !JSON.stringify(error).includes("PRIVATE"));
  const timed = child(); let timerKill = false;
  const p = runCommand("fixed", {}, { launch: () => timed, timeout: 5, killTree: async () => { timerKill = true; setImmediate(() => timed.emit("close", 1)); } });
  await assert.rejects(p, /unavailable/); assert.equal(timerKill, true);
});
test("taskkill accepts only owned numeric PID with fixed native executable and no shell", async () => {
  for (const value of ["123 & evil", 0, -1, NaN]) await assert.rejects(killNativeTree(value), /cleanup_failed/);
  await killNativeTree(123, async (file, args, options) => { assert.match(file, /System32\\taskkill\.exe$/); assert.deepEqual(args, ["/PID", "123", "/T", "/F"]); assert.equal(options.shell, undefined); });
});
test("worker boundary rejects extra fields, credentials, unexpected output and noncanonical busy data", () => {
  assert.deepEqual(busyOnly(snapshot()), snapshot());
  for (const mutate of [d => d.token = "PRIVATE", d => d.people[0].subject = "PRIVATE", d => d.people[0].person = caller,
    d => d.people[0].slots[0] = "PRIVATE", d => d.people[0].slots.pop(), d => d.people[1].person = 0,
    d => d.window.start = A.window.start, d => d.checkedAt = "PRIVATE", d => d.people[0].status = "missing"]) {
    const d = snapshot(); mutate(d); assert.throws(() => busyOnly(d));
  }
  for (const r of [{ ...success(), token: "PRIVATE" }, { ...success(), binding: caller }, { ...success(), cleanup: "not_requested" }, { ...failure(), code: "PRIVATE" }]) assert.throws(() => validateResult(r, "availability"));
  for (const text of ["PRIVATE", "x".repeat(maxBytes + 1), frame({ type: "stage", stage: "PRIVATE" }), frame({ type: "ready", pid: "123" })]) assert.throws(() => parseFrame(text, "status"));
});
test("full native status checks exact caller/JWT/Disabled v5 and preserved resources, with GET only", async () => {
  const p = provider(), result = await executeOperation("status", p);
  assert.deepEqual(result, success("status")); assert.ok(p.calls.length > 0); assert.ok(p.calls.every(c => c.method === "GET")); assert.equal(p.clears, 1);
  assert.deepEqual(p.stages, ["extensions", "account", "signed_in_user", "credential", "preserved_before", "availability_contract", "preserved_after", "extension_cleanup"]);
  assert.doesNotMatch(JSON.stringify(result), /https:|token|11111111|slots|@/);
});
test("status/availability reject wrong caller, token lifetime and drift without calendar access or fallback", async () => {
  for (const mutate of [w => w.properties.state = "Enabled", w => w.tags.extra = true, w => w.properties.accessControl.triggers.sasAuthenticationPolicy.state = "Enabled"]) {
    const p = provider({ mutate }); const r = await executeOperation("status", p); assert.equal(r.ok, false); assert.ok(p.calls.every(c => c.method === "GET"));
  }
  for (const kind of ["caller", "token", "account", "identity_failure"]) {
    const p = provider(), makeReader = p.makeReader;
    p.makeReader = async () => { const r = await makeReader(), read = r.read; r.read = async args => {
      if (kind === "identity_failure" && args[0] === "ad") throw Error("AADSTS530084 PRIVATE");
      if (kind === "caller" && args[0] === "ad") return "22222222-2222-4222-8222-222222222222";
      if (kind === "token" && args.includes("get-access-token")) return "PRIVATE_INVALID_TOKEN";
      if (kind === "account" && args[0] === "account" && args[1] === "show") return { tenant: "wrong", state: "Enabled" };
      return read(args);
    }; return r; };
    const result = await executeOperation("status", p); assert.equal(result.ok, false); assert.equal(p.calls.length, 0); assert.equal(p.clears, 1);
    assert.doesNotMatch(JSON.stringify(result), /AADSTS|PRIVATE|22222222/);
  }
});
test("full native availability performs denial probes then one query and disables before IPC result", async () => {
  const p = provider(), r = await executeOperation("availability", p);
  assert.equal(r.ok, true); assert.deepEqual(r.data, snapshot()); assert.match(r.binding, /^[a-f0-9]{64}$/);
  assert.equal(p.calls.filter(c => c.url === callback && c.authenticated).length, 1);
  assert.equal(p.calls.filter(c => c.url === callback).length, 3);
  assert.match(p.calls.at(-1).url, /api-version=2019-05-01$/);
  assert.equal(r.cleanup, "workflow_disabled"); assert.equal(p.clears, 1);
  assert.equal(JSON.stringify(r).includes(p.token), false); assert.equal(JSON.stringify(r).includes(caller), false);
});
test("cloud extras are rejected inside Windows instead of silently crossing process boundary", async () => {
  const p = provider({ output: { ...snapshot(), token: "PRIVATE_RAW_PROVIDER_CONTENT" } });
  const r = await executeOperation("availability", p); assert.equal(r.ok, false); assert.equal(r.code, "invalid_provider_response");
  assert.equal(r.cleanup, "workflow_disabled"); assert.doesNotMatch(JSON.stringify(r), /PRIVATE|data|binding/);
});
test("cancellation after query holds native execution through independent disable and discards data", async () => {
  const controller = new AbortController(), cleaning = deferred(), entered = deferred();
  const p = provider({ hook: async ({ url, options }) => {
    if (url === callback && options.token !== undefined && options.token !== "invalid-prototype-token") controller.abort();
    if (url.includes("/disable?")) { assert.equal(options.signal, undefined); entered.resolve(); await cleaning.promise; }
  } });
  let settled = false; const run = executeOperation("availability", { ...p, signal: controller.signal }).finally(() => { settled = true; });
  await entered.promise; await tick(); assert.equal(settled, false); assert.equal(p.clears, 0);
  cleaning.resolve(); const result = await run; assert.deepEqual(result, failure()); assert.equal(p.clears, 1);
});
test("ambiguous enable and failed disable stay sticky, with one disable attempt and no data", async () => {
  for (const suffix of ["/enable?", "/disable?"]) {
    const p = provider({ hook: ({ url }) => { if (url.includes(suffix)) throw Error("PRIVATE"); } });
    const result = await executeOperation("availability", p); assert.equal(result.code, "cleanup_failed"); assert.equal(result.cleanup, "cleanup_failed");
    assert.equal(p.calls.filter(c => c.url.includes("/disable?")).length, 1); assert.equal(p.clears, 1); assert.equal(result.data, undefined);
  }
});
test("native independent recovery only disables exact existing contract, never enables/invokes/deploys", async () => {
  for (const enabled of [false, true]) {
    const p = provider({ mutate: w => { if (enabled) w.properties.state = "Enabled"; } });
    const result = await executeOperation("cleanup", p); assert.deepEqual(result, success("cleanup"));
    assert.ok(p.calls.every(c => c.method === "GET" || c.method === "POST" && c.url.includes("/disable?")));
    assert.equal(p.calls.filter(c => c.method !== "GET").length, enabled ? 1 : 0);
  }
  const p = provider({ mutate: w => { w.tags.extra = true; } }); const r = await executeOperation("cleanup", p);
  assert.equal(r.code, "cleanup_failed"); assert.ok(p.calls.every(c => c.method === "GET"));
});
test("extension removal failure suppresses success, and unsupported mode never creates reader", async () => {
  const p = provider({ dispose: () => { throw Error("PRIVATE_PATH"); } });
  const r = await executeOperation("status", p); assert.equal(r.code, "cleanup_failed"); assert.equal(r.extensionsRemoved, false);
  for (const mode of ["deploy", "find", "import", "diagnostic", "http://evil.test"]) await assert.rejects(executeOperation(mode, { makeReader: () => assert.fail() }), /blocked/);
});
test("WSL environment passes only Electron flag, never auth paths or token/Node injection variables", () => {
  const result = interopEnvironment({ WSL_INTEROP: "/run/interop", AZURE_CONFIG_DIR: "PRIVATE", AZURE_EXTENSION_DIR: "PRIVATE", TOKEN: "PRIVATE", NODE_OPTIONS: "--require evil", WSLENV: "TOKEN:AZURE_CONFIG_DIR" });
  assert.deepEqual(result, { PATH: "/usr/bin:/bin", WSL_INTEROP: "/run/interop", ELECTRON_RUN_AS_NODE: "1", WSLENV: "ELECTRON_RUN_AS_NODE/w" });
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE|TOKEN|NODE_OPTIONS|AZURE/);
});
test("native handshake performs no operation on startup, malformed input or EOF", async () => {
  for (const inputText of ["cancel\n", "availability\n", "x".repeat(33), null]) {
    const input = new PassThrough(), output = new PassThrough(); let count = 0;
    const done = serveWorker("status", { input, output, execute: async () => { count++; return success("status"); } });
    await tick(); assert.equal(count, 0);
    if (inputText === null) input.end(); else input.write(inputText);
    await done; assert.equal(count, 0);
  }
});
test("native stdin cancellation waits for worker cleanup and emits only validated response", async () => {
  const input = new PassThrough(), output = new PassThrough(), wait = deferred(), entered = deferred(); let text = "", signal;
  output.on("data", c => { text += c; });
  const done = serveWorker("availability", { input, output, execute: async (_mode, options) => { signal = options.signal; entered.resolve(); await wait.promise; return failure(); } });
  input.write("start\n"); await entered.promise; input.write("cancel\n"); assert.equal(signal.aborted, true);
  assert.equal(text.includes('"result"'), false); wait.resolve(); await done;
  assert.deepEqual(parseFrame(text.trim().split("\n").at(-1), "availability").result, failure());
});
test("WSL launches exact native exe/script without shell or detachment and waits beyond result until close", async () => {
  const c = child(), writes = []; c.stdin.on("data", s => writes.push(s.toString()));
  const done = exchange("availability", {}, { convert: async () => "fixed-native-worker", launch: (file, args, options) => {
    assert.equal(file, runtime); assert.deepEqual(args, ["fixed-native-worker", "availability"]); assert.equal(options.shell, false); assert.equal(options.detached, false); assert.equal(options.signal, undefined); return c;
  } });
  await tick(); c.stdout.write(frame({ type: "ready", pid: 3456 })); assert.deepEqual(writes, ["start\n"]);
  c.stdout.write(frame({ type: "result", result: success() })); let settled = false; done.then(() => { settled = true; });
  await tick(); assert.equal(settled, false); c.emit("close", 0); assert.deepEqual(await done, success());
});
test("WSL cancellation sends one control line, never detaches child, fences successful late data", async () => {
  const c = child(), controller = new AbortController(), writes = []; c.stdin.on("data", s => writes.push(s.toString()));
  c.kill = () => assert.fail("must not kill cooperative cleanup");
  const done = exchange("availability", { signal: controller.signal }, { convert: async () => "worker", launch: () => c });
  await tick(); c.stdout.write(frame({ type: "ready", pid: 3456 })); controller.abort(); assert.deepEqual(writes, ["start\n", "cancel\n"]);
  c.stdout.write(frame({ type: "result", result: success() })); c.emit("close", 0);
  const result = await done; assert.equal(result.ok, false); assert.equal(result.code, "cancelled"); assert.equal(result.data, undefined);
});
test("malformed/oversized/stderr/extra frames fail closed after process exit, never leak output", async () => {
  for (const variant of ["malformed", "oversized", "stderr", "extra", "wrongexit"]) {
    const c = child(); const done = exchange("availability", {}, { convert: async () => "worker", launch: () => c });
    await tick(); c.stdout.write(frame({ type: "ready", pid: 3456 }));
    if (variant === "malformed") c.stdout.write("PRIVATE_TOKEN\n");
    if (variant === "oversized") c.stdout.write("x".repeat(maxBytes + 1));
    if (variant === "stderr") c.stderr.write("PRIVATE_ERROR");
    if (["extra", "wrongexit"].includes(variant)) c.stdout.write(frame({ type: "result", result: success() }));
    if (variant === "extra") c.stdout.write(frame({ type: "stage", stage: "complete" }));
    c.emit("close", 1); await assert.rejects(done, e => e instanceof BridgeFailure && e.started && !JSON.stringify(e).includes("PRIVATE"));
  }
});
test("watchdog cancels first, then reaps only its native PID and waits for termination confirmation", async () => {
  const c = child(), cancelled = deferred(), reaped = deferred(), killing = deferred();
  c.stdin.on("data", b => { if (b.toString() === "cancel\n") cancelled.resolve(); });
  let settled = false;
  const done = exchange("availability", {}, { convert: async () => "worker", launch: () => c, operationMs: 5, cleanupMs: 5,
    killTree: async pid => { assert.equal(pid, 3456); killing.resolve(); await reaped.promise; } });
  done.catch(() => { settled = true; }); await tick(); c.stdout.write(frame({ type: "ready", pid: 3456 }));
  await cancelled.promise; await killing.promise; c.emit("close", null); await tick(); assert.equal(settled, false);
  reaped.resolve(); await assert.rejects(done, /cleanup_failed/);
});
test("WSL operation lock covers native execution AND independent recovery; failure stays sticky", async () => {
  const probe = net.createServer(); probe.listen(0, "127.0.0.1"); await once(probe, "listening"); const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const entered = deferred(), release = deferred(), calls = [], records = [];
  const lock = work => withOwnerOperation(work, { port });
  const adapter = createNativeAdapter({ lock, exchange: async mode => {
    calls.push(mode); await assert.rejects(lock(async () => {}), /owner_operation_busy/);
    if (mode === "availability") throw new BridgeFailure(true, "availability");
    if (mode === "cleanup") { entered.resolve(); await release.promise; return success("cleanup"); }
    return success("status");
  } });
  const pending = adapter.perform({ record: s => records.push(s) });
  await entered.promise; await assert.rejects(lock(async () => {}), /owner_operation_busy/); release.resolve();
  await assert.rejects(pending, /cleanup_failed/); await lock(async () => {});
  await assert.rejects(adapter.perform({}), /cleanup_failed/); assert.deepEqual(calls, ["availability", "cleanup"]);
  assert.deepEqual(records, ["cleanup_pending", "cleanup_failed"]);
  await adapter.status(); await assert.rejects(adapter.perform({}), /cleanup_failed/);
});
test("preflight failures never launch a cleanup writer; missing windows runtime never falls back", async () => {
  const calls = [], adapter = createNativeAdapter({ lock: work => work(), exchange: async mode => { calls.push(mode); throw new BridgeFailure(false, "native_runtime"); } });
  await assert.rejects(adapter.status(), /unavailable/); await assert.rejects(adapter.perform({}), /unavailable/); assert.deepEqual(calls, ["status", "availability"]);
  await assert.rejects(adapter.perform({ window: A.window }), /blocked/); assert.equal(calls.length, 2);
});
test("explicit native server construction, page/status/activity navigation perform zero startup work", async t => {
  const server = createServer({ ownerExecution: "windows-native" }); server.listen(0, "127.0.0.1"); await once(server, "listening"); t.after(() => server.shutdown());
  const request = (url, body, csrf) => new Promise((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port: server.address().port, path: url, method: body ? "POST" : "GET", headers: { Host: "localhost:8002", ...(body ? { Origin: "http://localhost:8002", "Content-Type": "application/json", "X-Owner-CSRF": csrf } : {}) } }, res => {
      let text = ""; res.on("data", b => { text += b; }); res.on("end", () => resolve({ code: res.statusCode, text }));
    }); req.on("error", reject); req.end(body ? JSON.stringify(body) : undefined);
  });
  const page = await request("/"), csrf = page.text.match(/name="owner-csrf" content="([a-f0-9]+)"/)[1];
  assert.match(page.text, /name="child-mode" content="unavailable"/); assert.equal((await request("/activities")).code, 200);
  const status = JSON.parse((await request("/api/status", {}, csrf)).text); assert.equal(status.status, "idle"); assert.equal(status.cleanup, "not_requested"); assert.equal(status.execution, "windows-native-v1");
  const childResult = await request("/api/child/find", { acknowledged: true, startDate: "2026-10-09", endDate: "2026-10-15" }, csrf);
  assert.equal(JSON.parse(childResult.text).status, "child_not_ready");
  assert.throws(() => createServer({ ownerExecution: "native-typo" }), /blocked/);
  assert.throws(() => createServer({ ownerExecution: "windows-native", synthetic: true }), /blocked/);
  // Explicit native child opt-in is now supported and covered by the child
  // server suite; malformed approval must still fail closed.
  assert.throws(() => createServer({ ownerExecution: "windows-native", childApproved: "true" }), /blocked/);
});

test("native code bundle is a fixed code-only manifest, with inert imports and cancelled handshake", async () => {
  assert.equal(manifest.length, 11);
  assert.ok(manifest.every(file => /^(scripts|infra|owner)\/[\w-]+\.js$/.test(file)));
  assert.ok(manifest.every(file => !/child|school|cache|config|\.ps1/.test(file)));
  const code = await bundle();
  const vm = require("node:vm"), proc = new EventEmitter(), input = new PassThrough(), output = new PassThrough();
  Object.assign(proc, { platform: "win32", argv: ["node", "worker.cjs", "status"], env: {}, stdin: input, stdout: output, pid: 2345 });
  let frames = ""; output.on("data", b => { frames += b; });
  vm.runInNewContext(code, { require, process: proc, Buffer, setTimeout, clearTimeout, AbortController, AbortSignal, structuredClone, console });
  assert.equal(parseFrame(frames.trim(), "status").type, "ready");
  input.end("cancel\n"); await tick(); assert.equal(proc.exitCode, 1);
  assert.equal(frames.trim().split("\n").length, 1);
  await assert.rejects(bundle(async () => "x".repeat(256 * 1024 + 1)), /blocked/);
});
test("Windows-local staging writes exclusive code only and deletes exactly its own file/directory", async () => {
  const calls = [];
  const filesystem = {
    mkdtemp: async prefix => { calls.push(["mkdir", prefix]); return prefix + "synthetic"; },
    writeFile: async (file, content, options) => { calls.push(["write", file]); assert.equal(content, "code-only"); assert.equal(options.flag, "wx"); },
    unlink: async file => calls.push(["unlink", file]), rmdir: async folder => calls.push(["rmdir", folder])
  };
  const staged = await stageBundle({ filesystem, build: async () => "code-only" });
  assert.match(staged.nativePath, /^C:\\Users\\weitan\\AppData\\Local\\Temp\\familycopilot-owner-worker-[\w-]+\\worker\.cjs$/);
  await staged.dispose(); assert.deepEqual(calls.map(c => c[0]), ["mkdir", "write", "unlink", "rmdir"]);
  assert.doesNotMatch(JSON.stringify(calls), /\.azure|school|availability\.json/);
});
test("staged code is retained until native close and then disposed before returning to the lock owner", async () => {
  const c = child(); let removed = false;
  const done = exchange("status", {}, { launch: () => c, stageBundle: async () => ({ nativePath: "C:\\Temp\\worker.cjs", dispose: async () => { removed = true; } }) });
  await tick(); c.stdout.write(frame({ type: "ready", pid: 3456 })); c.stdout.write(frame({ type: "result", result: success("status") }));
  await tick(); assert.equal(removed, false); c.emit("close", 0); await done; assert.equal(removed, true);
});