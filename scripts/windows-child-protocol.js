"use strict";
// Separate from the busy-only parent protocol. Keys and plaintext sources are
// stdin/native memory only; this module never performs authentication or I/O.
const { randomBytes, createCipheriv, createDecipheriv, createHash } = require("node:crypto");
const { isDeepStrictEqual } = require("node:util");
const { OwnerFailure } = require("./owner-calendar");
const C = require("../owner/child-calendar-core");
const protocol = "windows-child-v1", maxBytes = 300 * 1024, inputLimit = 8192, maxSealed = 6144;
const modes = Object.freeze(["check", "status", "deploy", "find", "import", "enroll", "sync", "cleanup-find", "cleanup-import", "cleanup-sync"]);
const stages = Object.freeze(["native_runtime", "extensions", "account", "signed_in_user", "credential", "child_contract",
  "deployment", "find", "import", "cleanup_pending", "workflow_disabled", "cleanup_failed", "independent_cleanup", "extension_cleanup", "complete"]);
const codes = Object.freeze(["blocked", "busy", "unavailable", "expired", "revoked", "contract_drift", "cancelled", "cleanup_failed", "invalid_provider_response", "update_conflict", "update_required"]);
const exact = (o, keys) => o && typeof o === "object" && !Array.isArray(o) && isDeepStrictEqual(Object.keys(o).sort(), [...keys].sort());
const dataMode = mode => ["find", "import", "enroll", "sync"].includes(mode);
const cleanupMode = mode => ["cleanup-find", "cleanup-import", "cleanup-sync"].includes(mode);
const fail = (code = "blocked") => { throw new OwnerFailure(code); };
const validProviderId = id => typeof id === "string" && /^[A-Za-z0-9_+/=-]{1,4096}$/.test(id) && !/[\r\n]/.test(id);
const validReference = value => typeof value === "string" && value.length === 64 && C.handle(value);
const magic = Buffer.from("FCCH1", "ascii"), overhead = magic.length + 12 + 16;
function requireMode(mode) { if (!modes.includes(mode)) fail(); return mode; }
function validateSession(value, now = Date.now()) {
  if (!validReference(value?.sessionId) || !Number.isSafeInteger(value?.expires) || !validReference(value?.key)) fail();
  if (value.expires <= now) fail("expired");
  if (value.expires > now + 30 * 60000) fail();
  return value;
}
function isSealed(value) {
  if (typeof value !== "string" || value.length > maxSealed || !/^[A-Za-z0-9_-]+$/.test(value)) return false;
  const bytes = Buffer.from(value, "base64url");
  return bytes.toString("base64url") === value && bytes.length > overhead && bytes.length <= overhead + 4096 && bytes.subarray(0, magic.length).equals(magic);
}
const aad = ({ sessionId, expires }) => Buffer.from(JSON.stringify([protocol, C.contract, sessionId, expires]), "utf8");
function sealSource(id, context, now = Date.now()) {
  validateSession(context, now); if (!validProviderId(id)) fail("invalid_provider_response");
  const key = Buffer.from(context.key, "hex"), plain = Buffer.from(id, "utf8"), iv = randomBytes(12);
  try {
    const cipher = createCipheriv("aes-256-gcm", key, iv); cipher.setAAD(aad(context));
    const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
    const sealed = Buffer.concat([magic, iv, cipher.getAuthTag(), encrypted]).toString("base64url");
    if (!isSealed(sealed)) fail(); return sealed;
  } finally { key.fill(0); plain.fill(0); }
}
function openSource(sealed, context, now = Date.now()) {
  validateSession(context, now); if (!isSealed(sealed)) fail();
  const key = Buffer.from(context.key, "hex"), bytes = Buffer.from(sealed, "base64url");
  let plain, first, last;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(5, 17));
    decipher.setAAD(aad(context)); decipher.setAuthTag(bytes.subarray(17, 33));
    first = decipher.update(bytes.subarray(overhead)); last = decipher.final();
    plain = Buffer.concat([first, last]);
    const id = plain.toString("utf8"); if (!validProviderId(id)) fail(); return id;
  } catch { fail(); }
  finally { key.fill(0); plain?.fill(0); first?.fill(0); last?.fill(0); }
}
function validateInput(mode, value, now = Date.now()) {
  requireMode(mode);
  if (!dataMode(mode)) { if (!exact(value, [])) fail(); return value; }
  const keys = ["sessionId", "expires", "key", "action"];
  if (mode !== "find") keys.push(mode === "sync" ? "reference" : "calendarId", "disclosure", "person", "guardian", "confirmed");
  if (!exact(value, keys) || value.action !== mode) fail();
  validateSession(value, now);
  if (mode !== "find" && (!(mode === "sync" ? validReference(value.reference) : isSealed(value.calendarId)) || !["details", "busy_only"].includes(value.disclosure) ||
    value.person !== "Kimi" || value.guardian !== true || value.confirmed !== true)) fail();
  return value;
}
// Native-only calculation over an already authenticated caller. This digest is
// a source match, not a credential, source name, or reusable session seal.
function sourceReference(rawId, caller) {
  if (typeof caller !== "string" || caller.length !== 36 || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(caller)) fail();
  if (!validProviderId(rawId)) fail("invalid_provider_response");
  return createHash("sha256").update(JSON.stringify(["child-source-v1", C.contract, C.window, caller.toLowerCase(), rawId])).digest("hex");
}
function sanitizeName(name) {
  if (typeof name !== "string" || name.length > 1024) fail("invalid_provider_response");
  return name.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, "").replace(/\S+@\S+/g, "[address hidden]").trim() || "Unnamed calendar";
}
function sourceList(data) {
  if (!exact(data, ["calendars", "partial"]) || typeof data.partial !== "boolean" || !Array.isArray(data.calendars) || data.calendars.length > 100 ||
    Buffer.byteLength(JSON.stringify(data)) > C.maxBytes) fail("invalid_provider_response");
  const seen = new Set();
  for (const c of data.calendars) {
    if (!exact(c, ["id", "name"]) || !isSealed(c.id) || seen.has(c.id) || !C.text(c.name, 1024) || !c.name || sanitizeName(c.name) !== c.name) fail("invalid_provider_response");
    seen.add(c.id);
  }
  return data;
}
function project(data, disclosure, now = Date.now()) {
  let canonical;
  try { canonical = C.project(data, disclosure, now); } catch { fail("invalid_provider_response"); }
  if (!isDeepStrictEqual(data, canonical)) fail("invalid_provider_response");
  return canonical;
}
function enrollment(value, disclosure, now = Date.now()) {
  if (!exact(value, ["reference", "data"]) || !validReference(value.reference)) fail("invalid_provider_response");
  return { reference: value.reference, data: project(value.data, disclosure, now) };
}
function validateReport(report, mode) {
  requireMode(mode);
  if (mode === "check") {
    if (!exact(report, ["status", "cloudChanges", "runtimeVerified"]) || report.status !== "candidate_ready" || report.cloudChanges !== false || report.runtimeVerified !== false) fail();
  } else if (mode === "deploy") {
    if (!exact(report, ["status", "sasDisabled", "calendarQueries", "atomicCompareAndSwap"]) || report.status !== "deployed_disabled" || report.sasDisabled !== true || report.calendarQueries !== 0 || report.atomicCompareAndSwap !== false) fail();
  } else if (mode === "status") {
    if (!exact(report, ["status", "httpGetCalendarCandidate", "nativeViewCandidate", "sasDisabled", "preservedResourcesUnchanged", "calendarQueries", "cloudChanges", "runtimeVerified"]) ||
      report.status !== "child_ready" || report.httpGetCalendarCandidate !== true || typeof report.nativeViewCandidate !== "boolean" || report.sasDisabled !== true ||
      report.preservedResourcesUnchanged !== true || report.calendarQueries !== 0 || report.cloudChanges !== false || report.runtimeVerified !== false) fail();
  } else if (cleanupMode(mode)) {
    if (!exact(report, ["status", "calendarQueries"]) || report.status !== "workflow_disabled" || report.calendarQueries !== 0) fail();
  } else fail();
  return report;
}
function validateResult(result, mode, disclosure) {
  requireMode(mode);
  const keys = ["ok", "cleanup", "stage", "extensionsRemoved", ...(result?.ok ? [dataMode(mode) ? "data" : "report"] : ["code"])];
  if (!exact(result, keys) || typeof result.ok !== "boolean" || !stages.includes(result.stage) || typeof result.extensionsRemoved !== "boolean" ||
    !["not_requested", "workflow_disabled", "cleanup_failed"].includes(result.cleanup) || Buffer.byteLength(JSON.stringify(result)) > maxBytes - 4096) fail();
  if (!result.ok) {
    if (!codes.includes(result.code) || !result.extensionsRemoved && result.code !== "cleanup_failed" ||
      result.cleanup === "cleanup_failed" && result.code !== "cleanup_failed" || result.code === "cleanup_failed" && result.cleanup !== "cleanup_failed") fail();
  } else {
    if (!result.extensionsRemoved || result.stage !== "complete" || result.cleanup !== (dataMode(mode) || cleanupMode(mode) ? "workflow_disabled" : "not_requested")) fail();
    if (mode === "find") sourceList(result.data);
    else if (mode === "enroll") enrollment(result.data, disclosure);
    else if (mode === "import" || mode === "sync") project(result.data, disclosure);
    else validateReport(result.report, mode);
  }
  return result;
}
function parseFrame(text, mode, disclosure) {
  requireMode(mode);
  if (typeof text !== "string" || Buffer.byteLength(text) > maxBytes) fail();
  let f; try { f = JSON.parse(text); } catch { fail(); }
  if (f?.protocol !== protocol) fail();
  if (f.type === "ready" && exact(f, ["protocol", "type", "pid"]) && Number.isSafeInteger(f.pid) && f.pid > 0) return f;
  if (f.type === "stage" && exact(f, ["protocol", "type", "stage"]) && stages.includes(f.stage)) return f;
  if (f.type === "result" && exact(f, ["protocol", "type", "result"])) { validateResult(f.result, mode, disclosure); return f; }
  fail();
}
function startLine(mode, payload) {
  validateInput(mode, payload);
  const line = JSON.stringify({ protocol, type: "start", payload }) + "\n";
  if (Buffer.byteLength(line) > inputLimit - 32) fail(); return line;
}
function parseStart(line, mode) {
  if (typeof line !== "string" || Buffer.byteLength(line) > inputLimit - 32) fail();
  let f; try { f = JSON.parse(line); } catch { fail(); }
  if (!exact(f, ["protocol", "type", "payload"]) || f.protocol !== protocol || f.type !== "start") fail();
  return validateInput(mode, f.payload);
}
module.exports = { protocol, modes, stages, codes, maxBytes, inputLimit, maxSealed, exact, dataMode, cleanupMode, requireMode,
  validProviderId, validateSession, isSealed, sealSource, openSource, validateInput, sourceReference, sanitizeName, sourceList, project, enrollment,
  validateReport, validateResult, parseFrame, startLine, parseStart };