"use strict";
// Native-only operation host. Backend/reader seams are trusted offline tests,
// never deserialized from stdin. No credentials/ARM envelopes leave this host.
const { StringDecoder } = require("node:string_decoder");
const child = require("./child-calendar");
const { createNativeReader } = require("./windows-azure-cli");
const { jsonRequest } = require("./calendar-list");
const { OwnerFailure } = require("./owner-calendar");
const C = require("../owner/child-calendar-core");
const P = require("./windows-child-protocol");

function rawSources(raw) {
  if (!P.exact(raw, ["calendars", "partial"]) || typeof raw.partial !== "boolean" || !Array.isArray(raw.calendars) ||
    raw.calendars.length > 100 || Buffer.byteLength(JSON.stringify(raw)) > C.maxBytes) throw new OwnerFailure("invalid_provider_response");
  const seen = new Set();
  for (const source of raw.calendars) {
    if (!P.exact(source, ["id", "name"]) || !P.validProviderId(source.id) || seen.has(source.id)) throw new OwnerFailure("invalid_provider_response");
    P.sanitizeName(source.name); seen.add(source.id);
  }
  return raw;
}

async function executeOperation(mode, { payload = {}, signal, platform = process.platform, stage = () => {}, makeReader = createNativeReader,
  makeBackend = child.childBackend, request = jsonRequest, deployment = child.deployment, inspectReady = child.inspectReady,
  find = child.find, importEvents = child.importEvents, recover = child.recover } = {}) {
  if (platform !== "win32") throw new OwnerFailure("blocked");
  P.validateInput(mode, payload);
  const recovery = P.cleanupMode(mode);
  let reader, backend, calendarId, data, report, failure, cleanup = "not_requested", current = "native_runtime", extensionsRemoved = false;
  const controller = new AbortController();
  const combined = recovery ? undefined : AbortSignal.any([controller.signal, ...(signal ? [signal] : [])]);
  const expiry = P.dataMode(mode) ? setTimeout(() => controller.abort(), Math.max(1, payload.expires - Date.now())) : undefined;
  // Losing the IPC observer must cancel data, NEVER interrupt native disable or
  // extension disposal. In particular a throwing cleanup_pending write cannot
  // be allowed to skip importEvents' subsequent independent disable.
  const publish = value => { try { stage(value); } catch { controller.abort(); } };
  const progress = value => { if (!P.stages.includes(value)) throw new OwnerFailure("blocked"); current = value; publish(value); };
  const fence = () => {
    if (!recovery && P.dataMode(mode) && Date.now() >= payload.expires) throw new OwnerFailure("expired");
    if (combined?.aborted) throw new OwnerFailure("cancelled");
  };
  const record = value => {
    if (!["cleanup_pending", "workflow_disabled", "cleanup_failed"].includes(value)) throw new OwnerFailure("blocked");
    if (cleanup !== "cleanup_failed") cleanup = value;
    progress(value);
  };
  const clearBackend = async () => {
    const previous = backend; backend = undefined;
    try { await previous?.clear(); }
    catch { cleanup = "cleanup_failed"; throw new OwnerFailure("cleanup_failed"); }
  };
  try {
    fence();
    // Authenticate seal/session before even constructing an Azure reader.
    if (mode === "import" || mode === "enroll") calendarId = P.openSource(payload.calendarId, payload);
    if (mode === "status" && typeof inspectReady !== "function" || recovery && typeof recover !== "function") throw new OwnerFailure("blocked");
    progress("extensions"); reader = await makeReader(); fence();
    const read = async (args, s) => {
      progress(args[0] === "ad" ? "signed_in_user" : args.includes("get-access-token") ? "credential" : "account");
      return reader.read(args, recovery ? undefined : s);
    };
    // Validate before importEvents can canonicalize/drop an invalid event. Raw
    // request bodies, bearer tokens and callbacks remain in this closure.
    const strictRequest = async (url, options) => {
      const result = await request(url, options);
      if (importing && options.maxBytes === C.maxBytes && result.status === 200) P.project(result.data, payload.disclosure);
      return result;
    };
    let importing = mode === "import" || mode === "enroll";
    if (mode === "cleanup-sync") {
      // Each target gets fresh authentication, even if the prior recovery or
      // credential disposal failed. Neither inherits data cancellation.
      progress("independent_cleanup");
      for (const action of ["find", "import"]) {
        try {
          backend = await makeBackend(`cleanup-${action}`, { signal: undefined, read, request: strictRequest });
          await recover(backend, action);
        } catch { failure = "cleanup_failed"; cleanup = "cleanup_failed"; }
        finally {
          try { await clearBackend(); } catch { failure = "cleanup_failed"; }
        }
      }
      if (!failure) { record("workflow_disabled"); report = { status: "workflow_disabled", calendarQueries: 0 }; }
    } else {
      backend = await makeBackend(mode === "status" ? "check" : importing ? "import" : mode === "sync" ? "find" : mode,
        { signal: combined, read, request: strictRequest, ...(importing ? { calendarId, disclosure: payload.disclosure } : {}) });
      fence();
    }
    // Capture before importEvents clears backend credentials. No caller or raw
    // source survives this native operation or appears in an error frame.
    const reference = mode === "enroll" ? P.sourceReference(calendarId, backend.caller) : undefined;
    calendarId = undefined;
    if (mode === "check" || mode === "deploy") {
      progress("deployment"); report = P.validateReport(await deployment(backend, mode === "deploy"), mode);
    } else if (mode === "status") {
      progress("child_contract"); report = P.validateReport(await inspectReady(backend), mode);
    } else if (mode === "cleanup-sync") {
      // Both exact targets were independently attempted above.
    } else if (recovery) {
      progress("independent_cleanup");
      // recover must resolve only after exact-contract Disabled/readback and
      // preservation checks; its arbitrary return value is never forwarded.
      await recover(backend, mode === "cleanup-find" ? "find" : "import");
      record("workflow_disabled"); report = { status: "workflow_disabled", calendarQueries: 0 };
    } else if (mode === "find") {
      progress("find");
      let raw;
      try {
        raw = await find(backend, { signal: combined, record }); fence();
        if (!P.exact(raw, ["calendars", "partial"]) || typeof raw.partial !== "boolean" || !Array.isArray(raw.calendars) || raw.calendars.length > 100) throw new OwnerFailure("invalid_provider_response");
        const seen = new Set();
        data = P.sourceList({ calendars: raw.calendars.map(c => {
          if (!P.exact(c, ["id", "name"]) || !P.validProviderId(c.id) || seen.has(c.id)) throw new OwnerFailure("invalid_provider_response");
          seen.add(c.id); return { id: P.sealSource(c.id, payload), name: P.sanitizeName(c.name) };
        }), partial: raw.partial });
      } finally { raw = undefined; }
    } else {
      if (mode === "sync") {
        let raw, caller = backend.caller;
        // Also reject an invalid caller when the returned list is empty.
        P.sourceReference("caller-validation", caller);
        try {
          progress("find"); fence();
          raw = rawSources(await find(backend, { signal: combined, record })); fence();
          for (const source of raw.calendars) {
            if (P.sourceReference(source.id, caller) === payload.reference) {
              if (calendarId !== undefined) throw new OwnerFailure("invalid_provider_response");
              calendarId = source.id;
            }
          }
          if (cleanup !== "workflow_disabled") throw new OwnerFailure("cleanup_failed");
          if (!calendarId) throw new OwnerFailure(raw.partial ? "unavailable" : "revoked");
        } finally { raw = undefined; caller = undefined; await clearBackend(); }
        fence();
        // List cleanup must not count as import cleanup. A second backend can
        // never inherit the first backend's token, source name or success flag.
        cleanup = "not_requested"; importing = true;
        backend = await makeBackend("import", { signal: combined, read, request: strictRequest, calendarId, disclosure: payload.disclosure });
        fence();
        if (P.sourceReference(calendarId, backend.caller) !== payload.reference) throw new OwnerFailure("revoked");
        calendarId = undefined;
      }
      progress("import"); fence();
      data = P.project(await importEvents(backend, { signal: combined, record, disclosure: payload.disclosure }), payload.disclosure);
      if (mode === "enroll") data = P.enrollment({ reference, data }, payload.disclosure);
    }
    fence();
  } catch (error) {
    failure = error instanceof OwnerFailure && P.codes.includes(error.code) ? error.code : "unavailable";
  } finally {
    clearTimeout(expiry); calendarId = undefined;
    try { await clearBackend(); } catch { failure = "cleanup_failed"; }
    try { if (reader) { publish("extension_cleanup"); await reader.dispose(); } extensionsRemoved = true; }
    catch { current = "extension_cleanup"; failure = "cleanup_failed"; cleanup = "cleanup_failed"; }
  }
  // Expiry/cancel may occur while extension cleanup is awaited. Never emit late
  // data, but finish cleanup independently before reporting the cancellation.
  try { fence(); } catch (error) { failure ||= error.code; }
  if (recovery && failure || cleanup === "cleanup_pending" || failure === "cleanup_failed" || cleanup === "cleanup_failed" ||
    !failure && P.dataMode(mode) && cleanup !== "workflow_disabled") { failure = "cleanup_failed"; cleanup = "cleanup_failed"; }
  const result = failure ? { ok: false, code: failure, cleanup, stage: current, extensionsRemoved } :
    { ok: true, cleanup, stage: "complete", extensionsRemoved, ...(P.dataMode(mode) ? { data } : { report }) };
  data = undefined;
  return P.validateResult(result, mode, payload.disclosure);
}

async function serveWorker(mode, { input = process.stdin, output = process.stdout, execute = executeOperation, pid = process.pid,
  operationMs = 240000, startMs = 10000 } = {}) {
  P.requireMode(mode);
  const controller = new AbortController(), decoder = new StringDecoder("utf8");
  let started = false, bytes = 0, outputBytes = 0, buffer = "", payload, start, finished = false;
  const gate = new Promise(resolve => { start = resolve; });
  const cancel = () => { controller.abort(); start(false); };
  const write = frame => {
    if (finished) return;
    const text = JSON.stringify({ protocol: P.protocol, ...frame }) + "\n";
    outputBytes += Buffer.byteLength(text);
    if (outputBytes > P.maxBytes) { cancel(); throw new OwnerFailure("blocked"); }
    output.write(text);
  };
  const receive = chunk => {
    bytes += Buffer.byteLength(chunk);
    if (bytes > P.inputLimit) { buffer = ""; cancel(); return; }
    buffer += typeof chunk === "string" ? chunk : decoder.write(chunk);
    let index;
    while ((index = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, index); buffer = buffer.slice(index + 1);
      if (started || controller.signal.aborted) { cancel(); continue; }
      try { payload = P.parseStart(line, mode); started = true; start(true); }
      catch { cancel(); }
    }
    // A split cancel command is allowed; any other trailing input immediately
    // fences execution rather than being silently discarded after success.
    if (started && buffer && !"cancel\n".startsWith(buffer)) cancel();
  };
  input.on("data", receive); input.on("end", cancel); input.on("error", cancel); output.on("error", cancel);
  process.on("SIGINT", cancel); process.on("SIGTERM", cancel);
  const startTimer = setTimeout(cancel, startMs); let timer;
  try {
    write({ type: "ready", pid });
    if (!await gate || controller.signal.aborted) return;
    clearTimeout(startTimer); timer = setTimeout(cancel, operationMs);
    let result = P.validateResult(await execute(mode, { payload, signal: controller.signal, stage: value => {
      if (!P.stages.includes(value)) throw new OwnerFailure("blocked"); write({ type: "stage", stage: value });
    } }), mode, payload.disclosure);
    if (controller.signal.aborted && result.ok && !P.cleanupMode(mode)) result = { ok: false, code: "cancelled", cleanup: result.cleanup, stage: "complete", extensionsRemoved: result.extensionsRemoved };
    write({ type: "result", result: P.validateResult(result, mode, payload.disclosure) }); return result;
  } finally {
    finished = true; payload = undefined; buffer = "";
    clearTimeout(startTimer); clearTimeout(timer);
    input.off("data", receive); input.off("end", cancel); input.off("error", cancel); input.pause();
    process.off("SIGINT", cancel); process.off("SIGTERM", cancel);
    // Retain output's non-logging error listener until pipe close.
  }
}
if (require.main === module) (async () => {
  if (process.platform !== "win32" || process.argv.length !== 3) throw new OwnerFailure("blocked");
  const result = await serveWorker(process.argv[2]); if (!result?.ok) process.exitCode = 1;
})().catch(() => { process.exitCode = 1; });
module.exports = { executeOperation, serveWorker };