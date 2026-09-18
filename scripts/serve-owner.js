"use strict";
const http = require("node:http");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const { randomBytes, createHash } = require("node:crypto");
const { isDeepStrictEqual } = require("node:util");
const { OwnerFailure, ownerBackend, load } = require("./owner-calendar");
const { withOwnerOperation } = require("./owner-operation");
const { createSnapshotCache } = require("./availability-cache");
const { createDiskStore, defaultCacheDirectory, localBinding, CacheFailure } = require("./availability-disk-cache");
const A = require("../owner/availability-core");
const { activityMarkup } = require("./activity-week");
const { createBasketballRoute } = require("./basketball-route");
const { createChildSession, validId } = require("./child-calendar-session");
const { createChildCache, ChildCacheFailure } = require("./child-calendar-cache");
const { createChildDiskStore, childBinding } = require("./child-calendar-disk-cache");
const { createChildSourceStore, createChildSourceDiskStore, sourceBinding, ChildSourceFailure } = require("./child-source-store");
const childProtocol = require("./windows-child-protocol");
const C = require("../owner/child-calendar-core");

const root = path.resolve(__dirname, "..");
const files = Object.freeze({ "/": "owner/index.html", "/styles.css": "styles.css", "/owner.css": "owner/owner.css",
  "/shell.css": "shell.css",
  "/owner-ui.js": "owner/ui.js", "/owner-core.js": "owner/core.js", "/demo": "index.html", "/app.js": "app.js",
  "/availability-core.js": "owner/availability-core.js", "/availability-ui.js": "owner/availability-ui.js",
  "/school-calendar-core.js": "owner/school-calendar-core.js", "/school-calendar-ui.js": "owner/school-calendar-ui.js",
  "/child-calendar-core.js": "owner/child-calendar-core.js", "/child-calendar-ui.js": "owner/child-calendar-ui.js",
  "/shared/date-selection.js": "shared/date-selection.js",
  "/shared/basketball-teams.js": "shared/basketball-teams.js",
  "/activities": "activity-preview/index.html", "/activities/": "activity-preview/index.html",
  "/activity-preview/core.js": "activity-preview/core.js", "/activity-preview/ui.js": "activity-preview/ui.js",
  "/activity-preview/basketball-ui.js": "activity-preview/basketball-ui.js",
  "/activity-preview/basketball.css": "activity-preview/basketball.css",
  "/activity-preview/preview.css": "activity-preview/preview.css" });
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'";
const bodyLimit = 256;

function validRequest(req, origin, mutate = false) {
  const port = new URL(origin).port;
  // Remote VS Code may forward localhost as IPv4. Accept only these exact
  // authorities on the configured port; never normalize or trust proxy headers.
  const requestOrigin = `http://${req.headers.host}`;
  return req.socket.remoteAddress === "127.0.0.1" &&
    [`localhost:${port}`, `127.0.0.1:${port}`].includes(req.headers.host) &&
    !Object.keys(req.headers).some(name => name === "forwarded" || name.startsWith("x-forwarded-")) &&
    (!Object.hasOwn(req.headers, "origin") || req.headers.origin === requestOrigin) &&
    (!req.headers["sec-fetch-site"] || ["same-origin", "none"].includes(req.headers["sec-fetch-site"])) &&
    (!mutate || req.method === "POST" && req.headers.origin === requestOrigin && req.headers["content-type"] === "application/json");
}
async function readBody(req) {
  if (req.headers["content-encoding"] || Number(req.headers["content-length"]) > bodyLimit) throw new OwnerFailure("blocked");
  let bytes = 0, text = "";
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > bodyLimit) throw new OwnerFailure("blocked");
    text += chunk.toString("utf8");
  }
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new OwnerFailure("blocked"); }
}
const empty = body => Object.keys(body).length === 0;

// Synthetic raw fixture IDs only, never a native seal or a display-name match.
function syntheticReference(id) {
  if (!validId(id) || childProtocol.isSealed(id)) throw new OwnerFailure("invalid_provider_response");
  return createHash("sha256").update(JSON.stringify(["synthetic-child-source-v1", C.contract, C.window, id])).digest("hex");
}
function syntheticSource(data, reference) {
  if (!C.exact(data, ["calendars", "partial"]) || typeof data.partial !== "boolean" || !Array.isArray(data.calendars) ||
    data.calendars.length > 100 || Buffer.byteLength(JSON.stringify(data)) > C.maxBytes) throw new OwnerFailure("invalid_provider_response");
  const ids = new Set(); let match;
  for (const source of data.calendars) {
    if (!C.exact(source, ["id", "name"]) || ids.has(source.id) || typeof source.name !== "string" || source.name.length > 1024) throw new OwnerFailure("invalid_provider_response");
    const candidate = syntheticReference(source.id); ids.add(source.id);
    if (candidate === reference) match = source.id;
  }
  if (!match) throw new OwnerFailure("revoked");
  return match;
}

async function performLive({ signal, record }) {
  try {
    return await withOwnerOperation(async () => {
      if (signal.aborted) throw new OwnerFailure("cancelled");
      return load(await ownerBackend(signal), { signal, record });
    });
  } catch (error) {
    if (error?.message === "owner_operation_busy") throw new OwnerFailure("busy");
    throw error;
  }
}

// Pure CLI gate: absence is disabled; no typo/truthy value enables child access.
function executionOptions({ synthetic = false, ownerExecution = "wsl", childEnabled } = {}) {
  if (!["wsl", "windows-native"].includes(ownerExecution) || synthetic && ownerExecution !== "wsl" ||
    childEnabled !== undefined && (childEnabled !== C.contract || synthetic || ownerExecution !== "windows-native")) throw new OwnerFailure("blocked");
  return { ownerExecution, childApproved: childEnabled === C.contract };
}

function createServer({ port = 8002, synthetic = false, perform = synthetic ? require("../browser-fixtures/owner").perform : performLive,
  performAvailability = synthetic ? require("../browser-fixtures/availability").perform : require("./availability").perform,
  now = Date.now, storage, childStorage, childSourceStorage, searchBasketball, childApproved = false, ownerExecution = "wsl",
  nativeChildAdapter,
  performChild = synthetic ? require("../browser-fixtures/child-calendar").perform : require("./child-calendar").perform } = {}) {
  executionOptions({ synthetic, ownerExecution });
  if (typeof childApproved !== "boolean") throw new OwnerFailure("blocked");
  const nativeChild = !synthetic && childApproved && ownerExecution === "windows-native";
  if (nativeChildAdapter !== undefined) {
    // Trusted in-process test seam only. Reject deserialized function names,
    // getters, inherited methods and extra capabilities before adapter creation.
    const descriptor = nativeChildAdapter && Object.getOwnPropertyDescriptor(nativeChildAdapter, "perform");
    if (!nativeChild || !nativeChildAdapter || typeof nativeChildAdapter !== "object" ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(nativeChildAdapter)) ||
      Reflect.ownKeys(nativeChildAdapter).length !== 1 || typeof descriptor?.value !== "function" ||
      [require("../browser-fixtures/child-calendar").perform, require("./child-calendar").perform].includes(descriptor.value)) throw new OwnerFailure("blocked");
  }
  if (ownerExecution === "windows-native" && performChild !== require("./child-calendar").perform ||
    synthetic && performChild === require("./child-calendar").perform) throw new OwnerFailure("blocked");
  if (ownerExecution === "windows-native") {
    // Explicit opt-in, no probing/fallback on startup. Hidden legacy list/child
    // routes must not silently use the broken WSL credential execution context.
    if (performAvailability !== require("./availability").perform || perform !== performLive) throw new OwnerFailure("blocked");
    performAvailability = require("./windows-owner").createNativeAdapter().perform;
    perform = async () => { throw new OwnerFailure("blocked"); };
  }
  // Built-in review adapters must never produce a response labelled as live.
  if (!synthetic && (perform === require("../browser-fixtures/owner").perform ||
    performAvailability === require("../browser-fixtures/availability").perform ||
    performChild === require("../browser-fixtures/child-calendar").perform)) throw new OwnerFailure("blocked");
  const sourceValidator = nativeChild ? require("./windows-child-protocol").isSealed : undefined;
  if (nativeChild) {
    // One inert adapter per server (one sealing key); never probe/authenticate
    // on startup and never fall back to the old WSL child implementation.
    const adapter = nativeChildAdapter || require("./windows-child").createChildNativeAdapter();
    performChild = adapter.perform.bind(adapter);
  }
  const origin = `http://localhost:${port}`;
  const sessions = new Map();
  const basketball = createBasketballRoute({ search: searchBasketball, now });
  const cache = createSnapshotCache({ storage });
  const childCache = createChildCache({ storage: childStorage, now });
  const childSource = createChildSourceStore({ storage: childSourceStorage, now });
  const childSync = nativeChild || synthetic;
  let ownerContext = null;
  const clearCache = () => { ownerContext = null; cache.clear(); };
  const discardCache = () => { try { clearCache(); } catch { /* Sticky cache.failure reported separately. */ } };
  let active = null, closing = false, cleanupFailed = false, cleanup = "not_requested";
  const childCacheFlags = () => ({ ...(childCache.failure ? { childCacheStatus: childCache.failure.code } : {}),
    ...(childSource.failure ? { childSourceStatus: childSource.failure.code } : {}) });
  // Fence every affected session BEFORE disk I/O or awaiting native cleanup.
  const invalidateChild = ({ recover = false, clearSources = false } = {}) => {
    childCache.fence();
    childSource.fence();
    for (const s of sessions.values()) { if (clearSources) s.child.clear(); else s.child.invalidateScope(); }
    if (active?.child) active.controller.abort();
    // Attempt both independently; neither failure may skip the other deletion.
    // No implicit retry of a sticky failed store outside explicit Clear.
    for (const store of [childSource, childCache]) {
      if (store.failure && !recover) continue;
      try { store.clear({ recover }); } catch { /* Fixed sticky status, independent of parent storage. */ }
    }
  };
  const record = value => {
    if (!["cleanup_pending", "workflow_disabled", "cleanup_failed"].includes(value)) return;
    cleanup = value;
    if (value === "cleanup_failed") {
      invalidateChild();
      discardCache();
      cleanupFailed = true;
      // Fixed status only. Sticky block survives browser reload for this process.
      console.error("Owner UI: cleanup_failed; loading blocked. Operator recovery required.");
    }
  };
  const send = (res, code, body) => {
    if (res.destroyed || res.writableEnded) return;
    res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" }).end(JSON.stringify(body));
  };
  const server = http.createServer({ maxHeaderSize: 8192, requestTimeout: 10000, headersTimeout: 10000 }, async (req, res) => {
    res.setHeader("Cache-Control", "no-store"); res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Content-Type-Options", "nosniff"); res.setHeader("Content-Security-Policy", CSP);
    res.setHeader("X-Frame-Options", "DENY"); res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    try {
      if (!validRequest(req, origin) || closing) { send(res, 403, { status: "blocked" }); return; }
      const requestOrigin = `http://${req.headers.host}`;
      // Expiry requires no background timers, credential refresh or provider access.
      for (const [key, session] of sessions) if (session.expires <= now()) {
        session.child.close();
        if (active?.session === session) active.controller.abort();
        else sessions.delete(key);
      }
      if (["GET", "HEAD"].includes(req.method) && Object.hasOwn(files, req.url)) {
        // Activities shares only browser-selected dates, never an owner session or calendar data.
        if (files[req.url].startsWith("activity-preview/")) res.setHeader("Content-Security-Policy", CSP.replace("img-src 'none'", "img-src 'self' data:"));
        let body = await readFile(path.join(root, files[req.url]), "utf8");
        if (["owner/index.html", "activity-preview/index.html"].includes(files[req.url])) body = activityMarkup(body);
        if (req.url === "/" && req.method === "GET") {
          if (sessions.size >= 32) { send(res, 429, { status: "busy" }); return; }
          const csrf = randomBytes(32).toString("hex");
          const expires = now() + 30 * 60 * 1000;
          sessions.set(csrf, { origin: requestOrigin, expires, sessionId: randomBytes(32).toString("hex"),
            used: false, revoked: false, child: createChildSession({ expires, now, sourceValidator, retention: childCache.retention }) });
          body = body.replace("OWNER_CSRF", csrf).replace("OWNER_MODE", synthetic ? "synthetic" : "live")
            .replace("CHILD_MODE", synthetic ? "synthetic" : childApproved ? C.contract : "unavailable")
            .replace("CHILD_CACHE", childStorage ? "child-saved-v1-disk" : "child-saved-v1-memory")
            .replace("CHILD_SYNC", childSync ? "child-sync-v1" : "unavailable")
            .replace("OWNER_RANGE", "configurable-v1")
            .replace("OWNER_SAVED", "preserve-v1")
            .replace("OWNER_CONTRACT", "bounded-availability-v5")
            .replace("OWNER_CACHE", storage ? "disk" : "memory")
            .replace("Family Copilot · Calendar source not verified", synthetic ? "Family Copilot · SAMPLE calendars" : "Family Copilot · Local owner calendars")
            .replace('id="owner-source-badge">Source not verified', `id="owner-source-badge">${synthetic ? "SAMPLE DATA" : "Read-only calendar"}`)
            .replace("Calendar source not verified. Do not treat this page as real availability.", synthetic
              ? "Sample data—not real calendars. Synthetic browser review only; no Microsoft/Azure requests. For your owner calendars, open http://localhost:8002/ and review access there."
              : "Local owner calendars · Nothing loads until you review access and ask. Cached results are not a fresh provider check.");
        }
        res.setHeader("Content-Type", ({ ".html": "text/html", ".css": "text/css", ".js": "text/javascript" })[path.extname(files[req.url])] + "; charset=utf-8");
        res.writeHead(200).end(req.method === "HEAD" ? undefined : body); return;
      }
      if (req.url === "/api/activities/basketball") { await basketball.handle(req, res); return; }
      const childPaths = ["/api/child/find", "/api/child/review", "/api/child/import", "/api/child/saved", "/api/child/sync", "/api/child/clear", "/api/child/edit"];
      const apiPaths = ["/api/load", "/api/availability", "/api/clear", "/api/status", ...childPaths, ...(synthetic ? ["/api/fixture"] : [])];
      if (!apiPaths.includes(req.url)) { send(res, 404, { status: "unavailable" }); return; }
      const session = sessions.get(req.headers["x-owner-csrf"]);
      if (!validRequest(req, origin, true)) { send(res, 403, { status: "blocked" }); return; }
      if (session && session.origin !== requestOrigin) { send(res, 403, { status: "blocked" }); return; }
      // Missing/expired sessions (including pages from a prior server process)
      // stop before backend work. Do not disclose global cleanup to an invalid
      // session, or mistake this rejection for a workflow cleanup failure.
      if (!session || session.expires <= now()) { send(res, 403, { status: "blocked", reason: "session_unavailable" }); return; }
      req.setTimeout(10000, () => req.destroy());
      const childGeneration = session.child.generation;
      const sharedChildGeneration = childCache.generation;
      const sourceGeneration = childSource.generation;
      const body = await readBody(req);
      req.setTimeout(0);
      if (childPaths.includes(req.url)) {
        if (["/api/child/clear", "/api/child/edit"].includes(req.url)) {
          const clear = req.url.endsWith("/clear");
          if (!empty(body) && !(C.exact(body, ["reason"]) && (clear ? ["leave", "range"] : ["cancel"]).includes(body.reason))) throw new OwnerFailure("blocked");
          const pending = active?.child ? active : null;
          if (body.reason) {
            // Closing a view/review is not a privacy reduction or deletion.
            if (clear) session.child.clear(); else session.child.invalidateReview();
            if (pending?.session === session) { childCache.fence(); childSource.fence(); pending.controller.abort(); }
          } else invalidateChild({ recover: clear, clearSources: clear });
          if (pending && (!body.reason || pending.session === session)) await pending.done;
          send(res, cleanupFailed || childCache.failure || childSource.failure ? 503 : 200, {
            status: cleanupFailed ? "cleanup_failed" : childCache.failure?.code || childSource.failure?.code || "cleared", ...childCacheFlags() }); return;
        }
        const requireChildRequest = () => {
          if (closing || session.revoked || session.expires <= now() || childGeneration !== session.child.generation ||
            sharedChildGeneration !== childCache.generation || sourceGeneration !== childSource.generation || cleanupFailed) throw new OwnerFailure(cleanupFailed ? "cleanup_failed" : "blocked");
          if (childCache.failure) throw childCache.failure;
          if (childSource.failure) throw childSource.failure;
        };
        requireChildRequest();
        if (req.url === "/api/child/saved") {
          if (!C.exact(body, ["acknowledged", "startDate", "endDate"]) || body.acknowledged !== true || !C.datesAllowed(body.startDate, body.endDate)) throw new OwnerFailure("blocked");
          if (!synthetic && !childApproved) { send(res, 503, { status: "child_not_ready" }); return; }
          if (active) { send(res, 409, { status: "busy" }); return; }
          const saved = childCache.get(); requireChildRequest();
          send(res, 200, saved || { status: "cache_missing" }); return;
        }
        if (!synthetic && !childApproved) { send(res, 503, { status: "child_not_ready" }); return; }
        if (active) { send(res, 409, { status: "busy" }); return; }
        const syncing = req.url === "/api/child/sync";
        const syncStartedAt = Date.now();
        let sourceRecord;
        if (syncing) {
          if (!C.exact(body, ["acknowledged", "startDate", "endDate", "refresh"]) || body.acknowledged !== true ||
            typeof body.refresh !== "boolean" || !C.datesAllowed(body.startDate, body.endDate)) throw new OwnerFailure("blocked");
          if (!childSync) { send(res, 503, { status: "child_not_ready" }); return; }
          const saved = !body.refresh && childCache.get();
          requireChildRequest();
          if (saved) { send(res, 200, saved); return; }
          sourceRecord = childSource.get();
          requireChildRequest();
          if (!sourceRecord) { send(res, 200, { status: "source_missing" }); return; }
        }
        if (req.url === "/api/child/review") {
          const reviewed = session.child.review(body, () => {
            invalidateChild();
            if (childCache.failure) throw childCache.failure;
            if (childSource.failure) throw childSource.failure;
          });
          send(res, 200, reviewed); return;
        }
        if (req.url === "/api/child/find" && (!C.exact(body, ["acknowledged", "startDate", "endDate"]) || body.acknowledged !== true || !C.datesAllowed(body.startDate, body.endDate))) throw new OwnerFailure("blocked");
        if (req.url === "/api/child/import") childSource.get(); // Prepare/validate before any provider operation.
        requireChildRequest(); // A reentrant trusted storage read cannot renew a cancelled request.
        if (syncing || req.url === "/api/child/import") childCache.prepare();
        const controller = new AbortController(), operation = { session, controller, child: true, generation: childCache.generation,
          sourceGeneration: childSource.generation, sessionGeneration: session.child.generation, done: null };
        active = operation;
        let childCleanup = "not_requested", invoked = false;
        const childRecord = value => {
          if (!["cleanup_pending", "workflow_disabled", "cleanup_failed"].includes(value)) return;
          childCleanup = value;
          if (value === "cleanup_failed") {
            cleanupFailed = true; cleanup = value;
            invalidateChild();
            for (const s of sessions.values()) s.child.clear();
          }
        };
        const disconnect = () => { if (!res.writableEnded) { session.child.clear(); controller.abort(); } };
        res.on("close", disconnect);
        operation.done = (async () => {
          try {
            const invoke = async args => {
              if (controller.signal.aborted || args.signal?.aborted || session.expires <= now()) throw new OwnerFailure("cancelled");
              childCleanup = "not_requested"; // Each synthetic find/import must independently finish cleanup.
              invoked = true;
              const result = await performChild({ ...args, record: childRecord,
                ...(nativeChild ? { sessionId: session.sessionId, expires: session.expires } : { scenario: session.scenario || "listed" }) });
              if (cleanupFailed || childCleanup !== "workflow_disabled") { childRecord("cleanup_failed"); throw new OwnerFailure("cleanup_failed"); }
              return result;
            };
            const commitReady = () => {
              if (closing || cleanupFailed || session.revoked || session.expires <= now() || controller.signal.aborted ||
                operation.generation !== childCache.generation || operation.sourceGeneration !== childSource.generation ||
                operation.sessionGeneration !== session.child.generation) throw new OwnerFailure("cancelled");
              if (childSource.failure) throw childSource.failure;
              if (childCache.failure) throw childCache.failure;
            };
            const commit = (access, projected, reference) => {
              let sourceWritten = false, cacheWritten = false;
              try {
                commitReady();
                if (reference !== undefined) {
                  sourceWritten = childSource.put(reference, access, operation.sourceGeneration);
                  if (!sourceWritten) throw new OwnerFailure("cancelled");
                }
                commitReady();
                cacheWritten = childCache.put(access, projected, operation.generation);
                if (!cacheWritten) throw new OwnerFailure("cancelled");
                commitReady();
              }
              catch (error) {
                // Roll back completed halves of an unfinished commit, including
                // reentrant synchronous test storage. Never recover sticky I/O.
                for (const [store, written] of [[childSource, sourceWritten], [childCache, cacheWritten]]) {
                  if (written && !store.failure) { try { store.clear({ recover: false }); } catch { /* Sticky status below. */ } }
                }
                throw error;
              }
            };
            const data = req.url === "/api/child/find"
              ? await session.child.find(signal => invoke({ action: "find", signal }), controller.signal)
              : syncing ? await session.child.sync(async signal => {
                const { reference, access } = sourceRecord;
                if (nativeChild) return invoke({ action: "sync", reference, disclosure: access.disclosure, signal });
                const calendarId = syntheticSource(await invoke({ action: "find", signal }), reference);
                return invoke({ action: "import", calendarId, disclosure: access.disclosure, signal });
              }, controller.signal, result => {
                let projected;
                try { projected = nativeChild ? childProtocol.project(result, sourceRecord.access.disclosure, now()) : C.project(result, sourceRecord.access.disclosure, now()); }
                catch { throw new OwnerFailure("invalid_provider_response"); }
                commit(sourceRecord.access, projected);
                return { status: "saved", access: sourceRecord.access, data: projected };
              }) : await session.child.import(body, async options => {
                const result = await invoke({ ...options, action: nativeChild ? "enroll" : "import" });
                if (!synthetic) return result;
                try { return { reference: syntheticReference(options.calendarId), data: C.project(result, options.disclosure, now()) }; }
                catch { throw new OwnerFailure("invalid_provider_response"); }
              }, controller.signal, commit, { enroll: childSync, enrollmentValidator: childProtocol.enrollment });
            if (closing || session.revoked || controller.signal.aborted || operation.generation !== childCache.generation || operation.sourceGeneration !== childSource.generation) throw new OwnerFailure("cancelled");
            send(res, 200, data);
          } catch (error) {
            session.child.clear();
            const code = error instanceof ChildSourceFailure ? new ChildSourceFailure(error.code).code : error instanceof ChildCacheFailure ? new ChildCacheFailure(error.code).code : error instanceof OwnerFailure ? new OwnerFailure(error.code).code : "unavailable";
            if (invoked && ["revoked", "contract_drift", "blocked", "invalid_provider_response"].includes(code)) invalidateChild();
            if (error instanceof ChildSourceFailure || error instanceof ChildCacheFailure && !syncing) invalidateChild();
            if (code === "cleanup_failed") childRecord("cleanup_failed");
            let diagnostic;
            if (syncing) {
              // Revalidate at HTTP egress; never serialize the exception, native
              // frame, provider body, source reference or arbitrary properties.
              try { if (error instanceof OwnerFailure && error.diagnostic) diagnostic = C.syncDiagnostic(error.diagnostic); } catch { /* Fixed fallback below. */ }
              if (cleanupFailed) diagnostic = undefined;
              diagnostic ||= C.syncDiagnostic({ stage: cleanupFailed ? "cleanup" : "backend",
                code: cleanupFailed ? "cleanup_failed" : C.diagnosticCodes.includes(code) ? code : "unavailable",
                elapsedMs: C.diagnosticElapsed(syncStartedAt) });
            }
            send(res, 503, { status: cleanupFailed ? "cleanup_failed" : childCache.failure?.code || childSource.failure?.code || code, ...childCacheFlags(),
              ...(diagnostic ? { diagnostic } : {}) });
          } finally { res.off("close", disconnect); active = null; }
        })();
        await operation.done; return;
      }
      if (req.url === "/api/fixture") {
        if (active || !["listed", "empty", "unavailable", "revoked", "slow", "cleanup_failed", "partial"].includes(body.scenario) || Object.keys(body).length !== 1) throw new OwnerFailure("blocked");
        clearCache();
        invalidateChild({ clearSources: true });
        session.scenario = body.scenario; send(res, 200, { status: "synthetic_only" }); return;
      }
      if (req.url === "/api/status") {
        if (!empty(body)) throw new OwnerFailure("blocked");
        send(res, 200, { status: cleanupFailed ? "cleanup_failed" : cache.failure?.code || childCache.failure?.code || childSource.failure?.code || (active ? "busy" : "idle"),
          ...(cache.failure ? { cacheStatus: cache.failure.code } : {}), ...childCacheFlags(), cleanup, synthetic,
          ...(ownerExecution === "windows-native" ? { execution: "windows-native-v1" } : {}),
          ...(nativeChild ? { childExecution: "windows-child-v1" } : {}) }); return;
      }
      if (req.url === "/api/clear") {
        if (!empty(body) && !(Object.keys(body).join() === "reason" && ["leave", "range"].includes(body.reason))) throw new OwnerFailure("blocked");
        session.child.clear();
        const leaving = body.reason === "leave";
        const changingRange = body.reason === "range";
        if (empty(body)) invalidateChild({ recover: true, clearSources: true });
        else if (active?.child && active.session === session) { childCache.fence(); childSource.fence(); active.controller.abort(); }
        // Explicit Clear/withdrawal invalidates the shared generation BEFORE
        // awaiting cleanup, including a refresh started by another page.
        if (changingRange) cache.fence();
        else if (!leaving) discardCache();
        if (body.reason !== "range") session.revoked = true;
        if (active && (active.session === session || !leaving && active.availability || empty(body) && active.child)) { active.controller.abort(); await active.done; }
        send(res, cleanupFailed || cache.failure || childCache.failure || childSource.failure ? 503 : 200, {
          status: cleanupFailed ? "cleanup_failed" : cache.failure?.code || childCache.failure?.code || childSource.failure?.code || "cleared",
          ...(cache.failure ? { cacheStatus: cache.failure.code } : {}), ...childCacheFlags(), cleanup, synthetic }); return;
      }
      const availability = req.url === "/api/availability";
      const keys = Object.keys(body).sort().join();
      const hasDates = Object.hasOwn(body, "startDate") || Object.hasOwn(body, "endDate");
      const allowedKeys = availability ? ["acknowledged,requestId", "acknowledged,refresh,requestId",
        "acknowledged,endDate,refresh,requestId,startDate", "acknowledged,cacheOnly,endDate,refresh,requestId,startDate"] : ["acknowledged,requestId"];
      if (!allowedKeys.includes(keys) || Object.hasOwn(body, "refresh") && typeof body.refresh !== "boolean" || body.acknowledged !== true ||
        Object.hasOwn(body, "cacheOnly") && (typeof body.cacheOnly !== "boolean" || body.cacheOnly && body.refresh) ||
        typeof body.requestId !== "string" || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(body.requestId)) throw new OwnerFailure("blocked");
      // Parse and reject dates before any cache read, invalidation or provider work.
      let requestedWindow = synthetic ? storage?.window || A.window : A.liveWindow;
      if (hasDates) {
        try { requestedWindow = A.dateRange(body.startDate, body.endDate); }
        catch { throw new OwnerFailure("blocked"); }
      }
      const usedKey = availability ? "availabilityUsed" : "used";
      if (session.revoked || !availability && session[usedKey] || cleanupFailed || closing) throw new OwnerFailure(cleanupFailed ? "cleanup_failed" : "blocked");
      if (availability && cache.failure) throw cache.failure;
      // Live v5 is exactly October 9–15, never an arbitrary-range provider API.
      if (availability && (!synthetic || storage) && !isDeepStrictEqual(requestedWindow, synthetic ? storage?.window || A.window : A.liveWindow)) {
        send(res, 503, { status: "range_unavailable", cleanup, synthetic }); return;
      }
      if (active) { send(res, 409, { status: "busy" }); return; }
      session[usedKey] = true;
      if (availability) {
        const cached = !body.refresh && cache.get(ownerContext, requestedWindow);
        if (cached) { send(res, 200, { ...cached, cached: true, cleanup: "workflow_disabled", synthetic }); return; }
        if (body.cacheOnly) { send(res, 200, { status: "cache_missing", cleanup, synthetic }); return; }
        // A refresh/miss can never fall back to an earlier cached result.
        if (storage?.preserveOnMiss) { ownerContext = null; cache.prepare(); }
        else clearCache();
      }
      const controller = new AbortController();
      const operation = { controller, session, availability, generation: cache.generation, context: synthetic ? localBinding({ mode: "synthetic" }) : null, done: null };
      active = operation; cleanup = "not_requested";
      const disconnect = () => { if (!res.writableEnded) { session.revoked = true; controller.abort(); } };
      res.on("close", disconnect);
      // Backend owns independent bounded disable cleanup; browser timeout never detaches it.
      operation.done = (async () => {
        try {
          const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(240000)]);
          const result = await (availability ? performAvailability : perform)({ signal, record, scenario: session.scenario || "listed",
            ...(availability ? { window: requestedWindow } : {}),
            recordContext: value => { if (typeof value === "string" && /^[a-f0-9]{64}$/.test(value)) operation.context = value; } });
          if (signal.aborted || session.revoked || closing || availability && operation.generation !== cache.generation) throw new OwnerFailure("cancelled");
          if (cleanup !== "workflow_disabled") { record("cleanup_failed"); throw new OwnerFailure("cleanup_failed"); }
          const safe = availability ? A.project(result, requestedWindow) : result;
          if (availability && cache.put(operation.context, result, operation.generation, requestedWindow)) ownerContext = operation.context;
          send(res, 200, { ...safe, ...(availability ? { cached: false } : {}), cleanup, synthetic });
        } catch (error) {
          const code = error instanceof OwnerFailure || error instanceof CacheFailure ? error.code : "unavailable";
          if (["revoked", "contract_drift", "expired", "blocked", "invalid_provider_response"].includes(code)) invalidateChild();
          // Do not undo Clear's failure/block or another session's invalidation.
          // A range fence preserves old data, unlike deletion. Known access
          // failure must still invalidate it, including a late list response.
          if (!(error instanceof CacheFailure) && !cache.failure &&
            (["revoked", "contract_drift", "expired", "blocked"].includes(code) ||
              availability && !storage?.preserveOnMiss && operation.generation === cache.generation)) discardCache();
          if (code === "cleanup_failed" && !cleanupFailed) record("cleanup_failed");
          send(res, 503, { status: cleanupFailed ? "cleanup_failed" : cache.failure?.code || code,
            ...(cache.failure ? { cacheStatus: cache.failure.code } : {}), ...childCacheFlags(), cleanup, synthetic });
        } finally { res.off("close", disconnect); active = null; }
      })();
      await operation.done;
    } catch (error) {
      send(res, error instanceof ChildSourceFailure || error instanceof ChildCacheFailure || error instanceof CacheFailure || error instanceof OwnerFailure && error.code === "cleanup_failed" ? 503 : 400,
        { status: error instanceof ChildSourceFailure ? new ChildSourceFailure(error.code).code : error instanceof ChildCacheFailure ? new ChildCacheFailure(error.code).code : error instanceof OwnerFailure || error instanceof CacheFailure ? error.code : "blocked", ...childCacheFlags(), cleanup, synthetic });
    }
  });
  server.on("clientError", (_error, socket) => socket.destroy());
  server.maxConnections = 32;
  server.keepAliveTimeout = 1000;
  server.shutdown = async () => {
    closing = true;
    basketball.close();
    // Retain completed snapshots; abort/fence unfinished work, never persist it.
    const done = active?.done;
    childCache.fence();
    childSource.fence();
    active?.controller.abort();
    server.close(); server.closeIdleConnections();
    if (done) await done;
    for (const session of sessions.values()) session.child.close();
    sessions.clear(); server.closeAllConnections();
    return { cleanup, cleanupFailed };
  };
  return server;
}

if (require.main === module) {
  const synthetic = process.argv.length === 3 && process.argv[2] === "--synthetic";
  if (process.argv.length > 2 && !synthetic) { console.error("Use no arguments for live, or --synthetic for isolated review."); process.exitCode = 1; }
  else try {
    const port = synthetic ? 8003 : 8002;
    const execution = executionOptions({ synthetic, ownerExecution: process.env.FAMILYCOPILOT_OWNER_EXECUTION || "wsl",
      childEnabled: process.env.FAMILYCOPILOT_CHILD_ENABLED });
    const server = createServer({ port, synthetic, ...(synthetic ? { perform: require("../browser-fixtures/owner").perform } : {
      ...execution,
      ...(execution.childApproved && execution.ownerExecution === "windows-native" ? {
        childStorage: createChildDiskStore({ directory: path.join(defaultCacheDirectory(), "child"), binding: childBinding({ mode: "windows-native" }) }),
        childSourceStorage: createChildSourceDiskStore({ directory: path.join(defaultCacheDirectory(), "child-source"), binding: sourceBinding({ mode: "windows-native" }) })
      } : {}),
      storage: createDiskStore({ directory: defaultCacheDirectory(), binding: localBinding({ october: true }), priorBinding: localBinding(), october: true })
    }) });
    let stopping = false;
    const stop = async () => {
      if (stopping) return; stopping = true;
      const result = await server.shutdown();
      console.log(JSON.stringify({ status: "owner_server_stopped", ...result }));
      if (result.cleanupFailed) process.exitCode = 1;
    };
    process.on("SIGINT", stop); process.on("SIGTERM", stop);
    server.on("error", () => { console.error("Owner UI port unavailable; no existing server was stopped."); process.exitCode = 1; });
    server.listen(port, "127.0.0.1", () => console.log(`${synthetic ? "SYNTHETIC ONLY" : "Local owner UI"}: http://localhost:${port}/ · idle; no calendar request; loopback only; no request logs`));
  } catch {
    console.error("Owner UI configuration blocked; no server started."); process.exitCode = 1;
  }
}
module.exports = { createServer, files, CSP, validRequest, readBody, bodyLimit, executionOptions };