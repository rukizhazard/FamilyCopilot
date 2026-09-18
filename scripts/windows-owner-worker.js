"use strict";
// Executed directly by native Code.exe in Node mode. Not a PowerShell script
// loader. All credentials, caller IDs, ARM bodies and callback URLs stay here.
const { isDeepStrictEqual } = require("node:util");
const { availabilityBackend, preserved, requireContract, loadAvailability } = require("./availability");
const { jsonRequest, logicUrl, requireOK } = require("./calendar-list");
const { workflowId } = require("../infra/availability");
const { OwnerFailure } = require("./owner-calendar");
const { createNativeReader } = require("./windows-azure-cli");
const { protocol, codes, busyOnly, validateResult } = require("./windows-owner-protocol");

async function executeOperation(mode, { signal, stage = () => {}, makeReader = createNativeReader,
  makeBackend = availabilityBackend, request = jsonRequest } = {}) {
  if (!["status", "availability", "cleanup"].includes(mode)) throw new OwnerFailure("blocked");
  let reader, backend, binding, data, cleanup = "not_requested", current = "extensions", extensionsRemoved = false, failure;
  const progress = value => { current = value; stage(value); };
  const fence = () => { if (signal?.aborted) throw new OwnerFailure("cancelled"); };
  try {
    fence(); progress("extensions"); reader = await makeReader();
    const read = async (args, s) => {
      progress(args[0] === "ad" ? "signed_in_user" : args.includes("get-access-token") ? "credential" : "account");
      return reader.read(args, s);
    };
    // Strict cloud-projected response validation happens on Windows, BEFORE IPC.
    // ARM envelopes remain solely inside the exact existing backend allowlist.
    const strictRequest = async (url, options) => {
      const result = await request(url, options);
      if (options.maxBytes === require("../owner/availability-core").responseLimit && result.status === 200) busyOnly(result.data, false);
      return result;
    };
    backend = await makeBackend(signal, mode === "status" ? "status" : "load", undefined, read, strictRequest);
    fence(); progress("preserved_before"); const before = await preserved(backend);
    fence(); progress("availability_contract"); const actual = requireOK(await backend.arm("GET", logicUrl(workflowId)));
    if (mode === "cleanup") {
      // Independent recovery after abnormal worker exit, never enables or invokes.
      progress("independent_cleanup");
      requireContract(actual, backend.caller, actual?.properties?.state === "Enabled" ? "Enabled" : "Disabled");
      if (actual.properties.state === "Enabled") requireOK(await backend.arm("POST", logicUrl(workflowId, "/disable")), [200, 202, 204]);
      requireContract(requireOK(await backend.arm("GET", logicUrl(workflowId))), backend.caller, "Disabled");
      cleanup = "workflow_disabled";
    } else requireContract(actual, backend.caller, "Disabled");
    fence(); progress("preserved_after");
    if (!isDeepStrictEqual(before, await preserved(backend))) throw new OwnerFailure("contract_drift");
    fence();
    if (mode === "availability") {
      progress("availability");
      data = busyOnly(await loadAvailability(backend, { signal, record: value => { cleanup = value; }, recordContext: value => { binding = value; } }));
      backend = undefined; // loadAvailability cleared credentials after disable.
      fence();
    }
  } catch (error) {
    failure = error instanceof OwnerFailure && codes.includes(error.code) ? error.code : "unavailable";
  } finally {
    backend?.clear();
    try {
      if (reader) { stage("extension_cleanup"); await reader.dispose(); }
      extensionsRemoved = true;
    } catch { failure = "cleanup_failed"; cleanup = "cleanup_failed"; }
  }
  if (mode === "cleanup" && failure || cleanup === "cleanup_pending") { failure = "cleanup_failed"; cleanup = "cleanup_failed"; }
  const result = failure ? { ok: false, code: failure, cleanup, stage: current, extensionsRemoved } :
    { ok: true, cleanup, stage: "complete", extensionsRemoved, ...(mode === "availability" ? { binding, data } : {}) };
  return validateResult(result, mode);
}

// Handshake: no Azure call before WSL has the native PID and explicitly starts
// this operation while holding its lock. EOF/invalid input cancels, not detaches.
async function serveWorker(mode, { input = process.stdin, output = process.stdout, execute = executeOperation, pid = process.pid,
  operationMs = 240000, startMs = 10000 } = {}) {
  if (!["status", "availability", "cleanup"].includes(mode)) throw new OwnerFailure("blocked");
  const controller = new AbortController();
  let started = false, bytes = 0, buffer = "", start;
  const gate = new Promise(resolve => { start = resolve; });
  const write = frame => output.write(JSON.stringify({ protocol, ...frame }) + "\n");
  const cancel = () => { controller.abort(); start(false); };
  const receive = chunk => {
    bytes += chunk.length;
    if (bytes > 32) { cancel(); return; }
    buffer += chunk.toString("utf8");
    let index;
    while ((index = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, index); buffer = buffer.slice(index + 1);
      if (line === "start" && !started && !controller.signal.aborted) { started = true; start(true); }
      else cancel(); // Only the fixed cancel command (or malformed input) stops.
    }
  };
  input.on("data", receive); input.on("end", cancel); input.on("error", cancel); output.on("error", cancel);
  const interrupt = () => cancel();
  process.on("SIGINT", interrupt); process.on("SIGTERM", interrupt);
  const startTimer = setTimeout(cancel, startMs);
  let timer;
  try {
    write({ type: "ready", pid });
    if (!await gate) return;
    clearTimeout(startTimer);
    timer = setTimeout(cancel, operationMs);
    const result = await execute(mode, { signal: controller.signal, stage: value => write({ type: "stage", stage: value }) });
    // No raw exceptions ever become stdout/stderr; only this validated frame.
    write({ type: "result", result: validateResult(result, mode) });
    return result;
  } finally {
    clearTimeout(startTimer); clearTimeout(timer);
    input.off("data", receive); input.off("end", cancel); input.off("error", cancel); input.pause();
    // Keep the safe output error handler until the pipe is fully closed.
    process.off("SIGINT", interrupt); process.off("SIGTERM", interrupt);
  }
}
if (require.main === module) (async () => {
  if (process.platform !== "win32" || process.argv.length !== 3) throw new OwnerFailure("blocked");
  const result = await serveWorker(process.argv[2]);
  if (!result?.ok) process.exitCode = 1;
})().catch(() => { process.exitCode = 1; });
module.exports = { executeOperation, serveWorker };