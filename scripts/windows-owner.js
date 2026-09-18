"use strict";
// WSL controller: owns the existing lock until native exit AND any independent
// recovery exit. No tokens, provider identifiers, callbacks or ARM bodies here.
const { spawn } = require("node:child_process");
const { isDeepStrictEqual } = require("node:util");
const path = require("node:path");
const { withOwnerOperation } = require("./owner-operation");
const { OwnerFailure } = require("./owner-calendar");
const { killNativeTree } = require("./windows-azure-cli");
const { parseFrame, maxBytes, validateResult } = require("./windows-owner-protocol");
const { stageBundle } = require("./windows-owner-bundle");
const { liveWindow } = require("../owner/availability-core");
const runtime = "/mnt/c/Users/weitan/AppData/Local/Programs/Microsoft VS Code/Code.exe";
function interopEnvironment(env = process.env) {
  // Do not spread terminal environment, WSLENV, auth paths or Node injection flags.
  return { PATH: "/usr/bin:/bin", ...(env.WSL_INTEROP ? { WSL_INTEROP: env.WSL_INTEROP } : {}),
    ELECTRON_RUN_AS_NODE: "1", WSLENV: "ELECTRON_RUN_AS_NODE/w" };
}
class BridgeFailure extends OwnerFailure {
  constructor(started, stage) { super(started ? "cleanup_failed" : "unavailable"); this.started = started; this.stage = stage; }
}
async function exchangeProcess(mode, { signal, stage = () => {} } = {}, { launch = spawn, convert, env = interopEnvironment(),
  killTree = pid => killNativeTree(pid, undefined, "/mnt/c/Windows/System32/taskkill.exe", env),
  operationMs = 240000, cleanupMs = 200000, startupMs = 15000 } = {}) {
  if (!["status", "availability", "cleanup"].includes(mode)) throw new OwnerFailure("blocked");
  if (signal?.aborted) throw new OwnerFailure("cancelled");
  let nativePath;
  try { nativePath = await convert(); } catch { throw new BridgeFailure(false, "native_runtime"); }
  if (signal?.aborted) throw new OwnerFailure("cancelled");
  return new Promise((resolve, reject) => {
    let child;
    try { child = launch(runtime, [nativePath, mode], { env, cwd: path.dirname(runtime), shell: false, detached: false, stdio: ["pipe", "pipe", "pipe"] }); }
    catch { reject(new BridgeFailure(false, "native_runtime")); return; }
    let bytes = 0, buffer = "", pid, started = false, invalid = false, cancelled = false, result, termination, current = "native_runtime";
    let deadline;
    const terminate = () => {
      invalid = true;
      if (termination) return;
      termination = pid ? killTree(pid).then(() => true, () => false) : Promise.resolve(child.kill());
    };
    const cancel = () => {
      if (cancelled) return;
      cancelled = true;
      // Never pass AbortSignal to spawn: that would detach enable/disable cleanup.
      if (!child.stdin.destroyed) child.stdin.write("cancel\n");
      clearTimeout(deadline); deadline = setTimeout(terminate, cleanupMs);
    };
    const bad = () => { invalid = true; buffer = ""; cancel(); };
    const startup = setTimeout(() => { bad(); terminate(); }, startupMs);
    deadline = setTimeout(cancel, operationMs);
    child.stdin.on("error", bad);
    child.stdout.on("data", chunk => {
      bytes += chunk.length;
      if (bytes > maxBytes) { bad(); return; }
      if (invalid) return;
      buffer += chunk.toString("utf8");
      let newline;
      while ((newline = buffer.indexOf("\n")) !== -1 && !invalid) {
        const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
        try {
          const frame = parseFrame(line, mode);
          if (result) throw new Error();
          if (frame.type === "ready") {
            if (pid) throw new Error();
            pid = frame.pid; clearTimeout(startup);
            if (cancelled || signal?.aborted) { cancel(); return; }
            started = true; child.stdin.write("start\n");
          } else {
            if (!started) throw new Error();
            if (frame.type === "stage") { current = frame.stage; stage(current); }
            else result = frame.result;
          }
        } catch { bad(); }
      }
    });
    // Unsolicited stderr is never forwarded or saved; it invalidates the result.
    child.stderr.on("data", () => bad());
    child.on("error", bad);
    const abort = () => cancel();
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) cancel();
    child.on("close", async code => {
      clearTimeout(startup); clearTimeout(deadline); signal?.removeEventListener("abort", abort);
      // A failed tree termination is NOT evidence of descendant exit. Keep the
      // cooperative lock held rather than start recovery alongside a live writer.
      if (termination && !await termination) {
        stage("independent_cleanup");
        return; // Operator intervention required; never silently abandon a child.
      }
      if (invalid || buffer.length || !result || code !== (result.ok ? 0 : 1)) { reject(new BridgeFailure(started, current)); return; }
      if (cancelled && result.ok && mode !== "cleanup") result = { ok: false, code: "cancelled", cleanup: result.cleanup,
        extensionsRemoved: result.extensionsRemoved, stage: current };
      resolve(result);
    });
  });
}
async function exchange(mode, options = {}, dependencies = {}) {
  if (!["status", "availability", "cleanup"].includes(mode)) throw new OwnerFailure("blocked");
  if (options.signal?.aborted) throw new OwnerFailure("cancelled");
  // convert is a mock subprocess test seam. Real execution uses Windows-local
  // code staging only, with no UNC allowlist change or credential/config copy.
  if (dependencies.convert) return exchangeProcess(mode, options, dependencies);
  let staged;
  try {
    staged = await (dependencies.stageBundle || stageBundle)();
    return await exchangeProcess(mode, options, { ...dependencies, convert: async () => staged.nativePath });
  } finally {
    if (staged) {
      try { await staged.dispose(); }
      catch { throw new OwnerFailure("cleanup_failed"); }
    }
  }
}
function createNativeAdapter({ exchange: communicate = exchange, lock = withOwnerOperation } = {}) {
  let sticky = false;
  const run = async (mode, options = {}) => {
    if (sticky && mode !== "status") throw new OwnerFailure("cleanup_failed");
    try {
      return await lock(async () => {
        if (options.signal?.aborted) throw new OwnerFailure("cancelled");
        let result;
        try { result = validateResult(await communicate(mode, options), mode); }
        catch (error) {
          if (mode === "availability" && error instanceof BridgeFailure && error.started) {
            sticky = true; options.record?.("cleanup_pending");
            // No inherited cancellation: independent, bounded exact-contract
            // disable/readback after the original native process is fully reaped.
            try { await communicate("cleanup", { stage: options.stage }); } catch { /* Remains sticky even if recovery cannot authenticate. */ }
            options.record?.("cleanup_failed");
            throw new OwnerFailure("cleanup_failed");
          }
          throw error;
        }
        if (result.cleanup === "cleanup_failed" || result.code === "cleanup_failed") sticky = true;
        if (result.cleanup !== "not_requested") options.record?.(result.cleanup);
        if (!result.ok) throw new OwnerFailure(result.code);
        if (mode === "availability") { options.recordContext?.(result.binding); return result.data; }
        return { status: "disabled_verified", execution: "windows-native-v1", availabilityV5Disabled: true, ownerV2Disabled: true,
          sasDisabled: true, connectorConnected: true, invitationDisabled: true, deliveryOff: true,
          preservedResourcesUnchanged: true, extensionsRemoved: true, calendarQueries: 0, cloudChanges: false, automaticRetry: false };
      });
    } catch (error) {
      if (error?.message === "owner_operation_busy") throw new OwnerFailure("busy");
      throw error;
    }
  };
  return {
    status: options => run("status", options),
    perform: options => {
      if (options?.window && !isDeepStrictEqual(options.window, liveWindow)) return Promise.reject(new OwnerFailure("blocked"));
      return run("availability", options);
    }
  };
}
// Importing is inert. The server explicitly selects this adapter at construction.
if (require.main === module) (async () => {
  if (process.platform !== "linux" || process.argv.length !== 3 || process.argv[2] !== "--status") throw new OwnerFailure("blocked");
  const completedStages = [];
  let current = "native_runtime";
  try {
    const result = await createNativeAdapter().status({ stage: value => { current = value; completedStages.push(value); } });
    console.log(JSON.stringify({ ...result, stages: completedStages }));
  } catch (error) {
    console.log(JSON.stringify({ status: "preflight_blocked", stage: error instanceof BridgeFailure ? error.stage : current,
      code: error instanceof OwnerFailure ? error.code : "unavailable", calendarQueries: 0, cloudChanges: false, automaticRetry: false }));
    process.exitCode = 1;
  }
})().catch(() => { console.log(JSON.stringify({ status: "preflight_blocked", stage: "arguments", code: "blocked", calendarQueries: 0, cloudChanges: false, automaticRetry: false })); process.exitCode = 1; });
module.exports = { runtime, interopEnvironment, BridgeFailure, exchange, createNativeAdapter };