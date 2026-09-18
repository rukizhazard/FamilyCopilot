"use strict";
const { isDeepStrictEqual } = require("node:util");
const A = require("../owner/availability-core");
const { OwnerFailure } = require("./owner-calendar");
const protocol = "windows-owner-v1", maxBytes = 32768;
const stages = Object.freeze(["native_runtime", "extensions", "account", "signed_in_user", "credential", "preserved_before", "availability_contract", "preserved_after", "availability", "independent_cleanup", "extension_cleanup", "complete"]);
const codes = Object.freeze(["blocked", "busy", "unavailable", "expired", "revoked", "contract_drift", "cancelled", "cleanup_failed", "invalid_provider_response"]);
const exact = (o, keys) => o && typeof o === "object" && !Array.isArray(o) && isDeepStrictEqual(Object.keys(o).sort(), [...keys].sort());
function busyOnly(value, canonical = true) {
  if (!exact(value, ["window", "checkedAt", "people"]) || !isDeepStrictEqual(value.window, A.liveWindow) || !Array.isArray(value.people) || value.people.length !== 2 ||
    value.people.some((p, i) => !exact(p, ["person", "status", "slots"]) || p.person !== i ||
      !["checked", "partial", "missing", "invalid", "unavailable"].includes(p.status) || !Array.isArray(p.slots) || p.slots.length !== 336 ||
      p.slots.some(s => typeof s !== "string" || !Object.hasOwn(A.labels, s)))) throw new OwnerFailure("invalid_provider_response");
  let projected;
  try { projected = A.project(value, A.liveWindow); } catch { throw new OwnerFailure("invalid_provider_response"); }
  if (canonical && !isDeepStrictEqual(value, projected)) throw new OwnerFailure("invalid_provider_response");
  return projected;
}
function validateResult(r, mode) {
  if (!exact(r, r?.ok ? mode === "availability" ? ["ok", "cleanup", "stage", "extensionsRemoved", "binding", "data"] : ["ok", "cleanup", "stage", "extensionsRemoved"] : ["ok", "cleanup", "stage", "extensionsRemoved", "code"]) ||
    typeof r.ok !== "boolean" || !stages.includes(r.stage) || typeof r.extensionsRemoved !== "boolean" ||
    !["not_requested", "workflow_disabled", "cleanup_failed"].includes(r.cleanup)) throw new OwnerFailure("blocked");
  if (!r.ok) {
    if (!codes.includes(r.code) || r.cleanup === "cleanup_failed" && r.code !== "cleanup_failed") throw new OwnerFailure("blocked");
  } else {
    if (!r.extensionsRemoved || r.stage !== "complete" || r.cleanup !== (mode === "status" ? "not_requested" : "workflow_disabled")) throw new OwnerFailure("blocked");
    if (mode === "availability") {
      if (typeof r.binding !== "string" || !/^[a-f0-9]{64}$/.test(r.binding)) throw new OwnerFailure("blocked");
      busyOnly(r.data);
    }
  }
  return r;
}
function parseFrame(text, mode) {
  if (typeof text !== "string" || Buffer.byteLength(text) > maxBytes) throw new OwnerFailure("blocked");
  let f; try { f = JSON.parse(text); } catch { throw new OwnerFailure("blocked"); }
  if (f?.protocol !== protocol) throw new OwnerFailure("blocked");
  if (f.type === "ready" && exact(f, ["protocol", "type", "pid"]) && Number.isSafeInteger(f.pid) && f.pid > 0) return f;
  if (f.type === "stage" && exact(f, ["protocol", "type", "stage"]) && stages.includes(f.stage)) return f;
  if (f.type === "result" && exact(f, ["protocol", "type", "result"])) { validateResult(f.result, mode); return f; }
  throw new OwnerFailure("blocked");
}
module.exports = { protocol, maxBytes, stages, codes, exact, busyOnly, validateResult, parseFrame };