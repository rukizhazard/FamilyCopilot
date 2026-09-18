"use strict";
// WSL controller. Import/construction are inert except for a per-server random
// sealing key. Never decrypt here, never accept credentials/browser operations.
const { spawn } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const { StringDecoder } = require("node:string_decoder");
const path = require("node:path");
const { withOwnerOperation } = require("./owner-operation");
const { OwnerFailure } = require("./owner-calendar");
const { killNativeTree } = require("./windows-azure-cli");
const { stageChildBundle } = require("./windows-child-bundle");
const P = require("./windows-child-protocol");
const runtime = "/mnt/c/Users/weitan/AppData/Local/Programs/Microsoft VS Code/Code.exe";
function interopEnvironment(env = process.env) {
  return { PATH: "/usr/bin:/bin", ...(env.WSL_INTEROP ? { WSL_INTEROP: env.WSL_INTEROP } : {}),
    ELECTRON_RUN_AS_NODE: "1", WSLENV: "ELECTRON_RUN_AS_NODE/w" };
}
class BridgeFailure extends OwnerFailure {
  constructor(started, stage = "native_runtime", code = started ? "cleanup_failed" : "unavailable") {
    super(P.codes.includes(code) ? code : "unavailable"); this.started = Boolean(started); this.stage = P.stages.includes(stage) ? stage : "native_runtime";
  }
}
async function exchangeProcess(mode, { payload = {}, signal, stage = () => {} } = {}, { launch = spawn, convert,
  env = interopEnvironment(), killTree = pid => killNativeTree(pid, undefined, "/mnt/c/Windows/System32/taskkill.exe", env),
  operationMs = 240000, cleanupMs = 200000, startupMs = 15000 } = {}) {
  P.validateInput(mode, payload);
  if (signal?.aborted && !P.cleanupMode(mode)) throw new BridgeFailure(false, "native_runtime", "cancelled");
  let nativePath;
  try { nativePath = await convert(); } catch { throw new BridgeFailure(false); }
  if (signal?.aborted && !P.cleanupMode(mode)) throw new BridgeFailure(false, "native_runtime", "cancelled");
  return new Promise((resolve, reject) => {
    let child;
    try { child = launch(runtime, [nativePath, mode], { env, cwd: path.dirname(runtime), shell: false, detached: false, stdio: ["pipe", "pipe", "pipe"] }); }
    catch { reject(new BridgeFailure(false)); return; }
    const decoder = new StringDecoder("utf8");
    let bytes = 0, buffer = "", pid, started = false, invalid = false, cancelled = false, closed = false, result, termination, current = "native_runtime", deadline;
    const terminate = () => {
      invalid = true;
      if (termination) return;
      // Never release ownership on failed native-tree termination. The original
      // process close plus confirmed tree exit is required before any recovery.
      termination = Promise.resolve().then(() => pid ? killTree(pid).then(() => true) : child.kill()).catch(() => false);
    };
    const cancel = () => {
      if (cancelled || closed) return;
      cancelled = true;
      try { if (!child.stdin.destroyed) child.stdin.write("cancel\n"); } catch { invalid = true; }
      clearTimeout(deadline); deadline = setTimeout(terminate, cleanupMs);
    };
    const bad = () => { invalid = true; buffer = ""; cancel(); };
    const startup = setTimeout(() => { bad(); terminate(); }, startupMs);
    deadline = setTimeout(cancel, operationMs);
    child.stdin.on("error", bad);
    child.stdout.on("data", chunk => {
      if (closed) return;
      bytes += Buffer.byteLength(chunk);
      if (bytes > P.maxBytes) { bad(); return; }
      if (invalid) return;
      buffer += typeof chunk === "string" ? chunk : decoder.write(chunk);
      let index;
      while ((index = buffer.indexOf("\n")) >= 0 && !invalid) {
        const line = buffer.slice(0, index); buffer = buffer.slice(index + 1);
        try {
          const frame = P.parseFrame(line, mode, payload.disclosure);
          if (result) throw new Error();
          if (frame.type === "ready") {
            if (pid) throw new Error();
            pid = frame.pid; clearTimeout(startup);
            if (cancelled || signal?.aborted && !P.cleanupMode(mode)) { cancel(); continue; }
            // Revalidate expiry immediately before serializing the only payload.
            const start = P.startLine(mode, payload);
            started = true; child.stdin.write(start);
          } else {
            if (!started) throw new Error();
            if (frame.type === "stage") { current = frame.stage; stage(current); }
            else result = frame.result;
          }
        } catch { bad(); }
      }
    });
    child.stderr.on("data", bad); // Drain only; no native stderr retention/logging.
    child.on("error", bad);
    const abort = () => cancel();
    if (!P.cleanupMode(mode)) { signal?.addEventListener("abort", abort, { once: true }); if (signal?.aborted) cancel(); }
    child.on("close", async code => {
      if (closed) return;
      closed = true;
      clearTimeout(startup); clearTimeout(deadline); signal?.removeEventListener("abort", abort);
      if (termination && !await termination) { try { stage("cleanup_failed"); } catch { /* Keep lock held. */ } return; }
      if (invalid || buffer.length || decoder.end().length || !result || code !== (result.ok ? 0 : 1)) { reject(new BridgeFailure(started, current)); return; }
      if (cancelled && result.ok && !P.cleanupMode(mode)) result = { ok: false, code: "cancelled", cleanup: result.cleanup, extensionsRemoved: result.extensionsRemoved, stage: current };
      resolve(result);
    });
  });
}
async function exchange(mode, options = {}, dependencies = {}) {
  P.validateInput(mode, options.payload || {});
  if (options.signal?.aborted && !P.cleanupMode(mode)) throw new BridgeFailure(false, "native_runtime", "cancelled");
  if (dependencies.convert) return exchangeProcess(mode, options, dependencies); // Mock-only transport seam.
  let staged, started = false;
  try {
    try { staged = await (dependencies.stageBundle || stageChildBundle)(); }
    catch { throw new BridgeFailure(false, "native_runtime", "cleanup_failed"); }
    try {
      const result = await exchangeProcess(mode, options, { ...dependencies, convert: async () => staged.nativePath });
      started = true; return result;
    } catch (error) { started = Boolean(error?.started); throw error; }
  } finally {
    if (staged) {
      try { await staged.dispose(); }
      catch { throw new BridgeFailure(started, "extension_cleanup", "cleanup_failed"); }
    }
  }
}
function createChildNativeAdapter({ exchange: communicate = exchange, lock = withOwnerOperation } = {}) {
  const key = randomBytes(32).toString("hex"); // Per adapter/server lifetime, never returned.
  let sticky = false;
  const run = async (mode, options = {}, payload = {}) => {
    P.validateInput(mode, payload);
    if (sticky && mode !== "status") throw new OwnerFailure("cleanup_failed");
    try {
      return await lock(async () => {
        if (sticky && mode !== "status") throw new OwnerFailure("cleanup_failed");
        if (options.signal?.aborted) throw new OwnerFailure("cancelled");
        const progress = value => {
          if (!P.stages.includes(value)) throw new OwnerFailure("blocked");
          if (["cleanup_pending", "workflow_disabled", "cleanup_failed"].includes(value)) options.record?.(value);
          options.stage?.(value);
        };
        const recover = async () => {
          sticky = true;
          try { options.record?.("cleanup_pending"); } catch { /* Observer failure cannot bypass independent recovery. */ }
          try {
            const recoveryMode = mode === "enroll" ? "cleanup-import" : `cleanup-${mode}`;
            const recovery = P.validateResult(await communicate(recoveryMode, { payload: {}, stage: value => {
              try { progress(value); } catch { /* Recovery remains independent of observers. */ }
            } }), recoveryMode);
            if (!recovery.ok || recovery.cleanup !== "workflow_disabled") throw new OwnerFailure("cleanup_failed");
          } catch { /* Exact recovery failure stays sticky, never retries calendars. */ }
          try { options.record?.("cleanup_failed"); } catch { /* Sticky state is already held internally. */ }
          throw new OwnerFailure("cleanup_failed");
        };
        let result;
        try { result = P.validateResult(await communicate(mode, { payload, signal: options.signal, stage: progress }), mode, payload.disclosure); }
        catch (error) {
          // Unknown exchange/validation failures after dispatch are conservatively
          // treated as started. Only explicit pre-start evidence skips recovery.
          if (P.dataMode(mode) && !(error instanceof BridgeFailure && !error.started)) return recover();
          if (error?.code === "cleanup_failed") { sticky = true; options.record?.("cleanup_failed"); }
          throw error instanceof OwnerFailure ? error : new OwnerFailure("unavailable");
        }
        if (result.cleanup === "cleanup_failed" || result.code === "cleanup_failed") {
          sticky = true;
          if (P.dataMode(mode)) return recover();
        }
        if (result.cleanup !== "not_requested") options.record?.(result.cleanup);
        if (!result.ok) throw new OwnerFailure(result.code);
        if (P.dataMode(mode)) {
          P.validateSession(payload);
          if (options.signal?.aborted) throw new OwnerFailure("cancelled");
          return mode === "find" ? P.sourceList(result.data) : mode === "enroll" ? P.enrollment(result.data, payload.disclosure) : P.project(result.data, payload.disclosure);
        }
        return { ...P.validateReport(result.report, mode), execution: P.protocol, extensionsRemoved: true,
          calendarQueries: 0, cloudChanges: mode === "deploy", automaticRetry: false };
      });
    } catch (error) {
      if (error?.message === "owner_operation_busy") throw new OwnerFailure("busy");
      throw error instanceof OwnerFailure ? error : new OwnerFailure("unavailable");
    }
  };
  const metadata = (mode, options = {}) => {
    if (!options || typeof options !== "object" || Object.keys(options).some(k => !["signal", "stage", "record"].includes(k))) return Promise.reject(new OwnerFailure("blocked"));
    return run(mode, options);
  };
  return {
    check: options => metadata("check", options), status: options => metadata("status", options), deploy: options => metadata("deploy", options),
    perform: async (options = {}) => {
      const mode = options?.action;
      const allowed = ["action", "sessionId", "expires", "signal", "record", "stage", ...(mode === "find" ? [] : [mode === "sync" ? "reference" : "calendarId", "disclosure"])];
      if (!P.dataMode(mode) || !options || typeof options !== "object" || Array.isArray(options) || Object.keys(options).some(k => !allowed.includes(k))) throw new OwnerFailure("blocked");
      const payload = { action: mode, sessionId: options.sessionId, expires: options.expires, key,
        ...(mode === "find" ? {} : { ...(mode === "sync" ? { reference: options.reference } : { calendarId: options.calendarId }),
          disclosure: options.disclosure, person: "Kimi", guardian: true, confirmed: true }) };
      return run(mode, options, payload);
    }
  };
}
async function main(args, { createAdapter = createChildNativeAdapter, log = console.log } = {}) {
  const map = { "--metadata-only": "check", "--status": "status", "--approved-deploy-once": "deploy" };
  let mode = "invalid", stage = "native_runtime";
  try {
    if (args.length !== 1 || !Object.hasOwn(map, args[0])) throw new OwnerFailure("blocked");
    mode = map[args[0]];
    const result = await createAdapter()[mode]({ stage: value => { if (!P.stages.includes(value)) throw new OwnerFailure("blocked"); stage = value; } });
    if (result.status !== ({ check: "candidate_ready", status: "child_ready", deploy: "deployed_disabled" })[mode] || result.extensionsRemoved !== true || result.calendarQueries !== 0) throw new OwnerFailure("blocked");
    const safe = { mode, status: result.status, stage: "complete", extensionsRemoved: true, calendarQueries: 0,
      cloudChanges: mode === "deploy", runtimeVerified: false, automaticRetry: false };
    for (const field of ["sasDisabled", "preservedResourcesUnchanged", "httpGetCalendarCandidate", "nativeViewCandidate", "atomicCompareAndSwap"]) {
      if (typeof result[field] === "boolean") safe[field] = result[field];
    }
    log(JSON.stringify(safe)); return safe;
  } catch (error) {
    const safe = { mode, status: "preflight_blocked", stage: error instanceof BridgeFailure ? error.stage : stage,
      code: error instanceof OwnerFailure && P.codes.includes(error.code) ? error.code : "unavailable", calendarQueries: 0, automaticRetry: false };
    // A failed deployment may have written before readback failed; do not label
    // that outcome cloudChanges:false. No report ever contains IDs/key/data.
    log(JSON.stringify(safe)); return safe;
  }
}
if (require.main === module) {
  if (process.platform !== "linux") process.exitCode = 1;
  else main(process.argv.slice(2)).then(result => { if (result.status === "preflight_blocked") process.exitCode = 1; });
}
module.exports = { runtime, interopEnvironment, BridgeFailure, exchangeProcess, exchange, createChildNativeAdapter, main };