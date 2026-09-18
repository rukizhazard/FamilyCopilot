"use strict";

// Never print returned objects: only status() and update() are CLI surfaces.
const { execFile } = require("node:child_process");
const { promisify, isDeepStrictEqual } = require("node:util");
const { randomUUID } = require("node:crypto");
const { withOwnerOperation } = require("./owner-operation");
const { scope, workflowId, connectionId, invitationId, apiId, pageSize, buildWorkflow, buildOwnerWorkflow } = require("../infra/calendar-list");
const { createBackend, tokenMatches, jsonRequest, preflight, requireOK, logicUrl, callbackUrl, projectSummary, operationVerified } = require("./calendar-list");

const allowedCodes = new Set(["update_required", "contract_drift", "update_conflict", "unavailable",
  "revoked", "cancelled", "cleanup_failed", "blocked", "busy", "expired", "invalid_provider_response"]);
class OwnerFailure extends Error {
  constructor(code = "unavailable") { super(allowedCodes.has(code) ? code : "unavailable"); this.code = this.message; }
}
const keysWithin = (value, keys) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).every(key => keys.includes(key));

function matches(actual, caller, factory = buildOwnerWorkflow) {
  const expected = factory(caller);
  // Known service-generated envelope only. Unknown configurable drift is NOT dropped.
  return keysWithin(actual, ["id", "name", "type", "location", "tags", "properties", "etag"]) &&
    (!actual.id || actual.id.toLowerCase() === workflowId.toLowerCase()) &&
    (!actual.name || actual.name === scope.workflow) && (!actual.type || actual.type === "Microsoft.Logic/workflows") &&
    keysWithin(actual.properties, ["state", "accessControl", "definition", "parameters", "provisioningState", "createdTime",
      "changedTime", "version", "accessEndpoint", "endpointsConfiguration"]) &&
    actual.location === expected.location && isDeepStrictEqual(actual.tags, expected.tags) &&
    ["accessControl", "definition", "parameters"].every(key => isDeepStrictEqual(actual.properties[key], expected.properties[key]));
}

async function readWorkflow(backend) {
  return backend.arm("GET", logicUrl(workflowId));
}
function requireContract(resource, caller, state, factory = buildOwnerWorkflow) {
  if (!matches(resource, caller, factory)) {
    throw new OwnerFailure(matches(resource, caller, buildWorkflow) ? "update_required" : "contract_drift");
  }
  if (resource.properties.state !== state) throw new OwnerFailure("blocked");
}
async function status(backend) {
  try {
    await preflight(backend);
    const result = await readWorkflow(backend), resource = requireOK(result);
    return { status: "inspected", workflowState: ["Disabled", "Enabled"].includes(resource.properties?.state) ? resource.properties.state : "unknown",
      contract: matches(resource, backend.caller) ? "local-owner-list-v2" : matches(resource, backend.caller, buildWorkflow) ? "list-only-v1" : "drift",
      sasDisabled: resource.properties?.accessControl?.triggers?.sasAuthenticationPolicy?.state === "Disabled",
      connectionConnected: true, invitationDisabled: true, invitationDeliveryOff: true, calendarRequestMade: false };
  } finally { backend.clear(); }
}

async function update(backend) {
  try {
    const before = await preflight(backend);
    const initial = await readWorkflow(backend), existing = requireOK(initial);
    requireContract(existing, backend.caller, "Disabled", buildWorkflow);
    const swagger = requireOK(await backend.arm("GET", `${apiId}?api-version=2016-06-01&export=true`));
    if (!operationVerified(swagger)) throw new OwnerFailure("contract_drift");
    if (!isDeepStrictEqual(await preflight(backend), before)) throw new OwnerFailure("update_conflict");
    // The documented CreateOrUpdate PUT has no documented ETag/CAS precondition.
    // Keep the workflow re-read immediately adjacent to PUT; local exclusion is
    // held by the CLI entry point. An external ARM writer can still race this gap.
    const fence = await readWorkflow(backend);
    if (!isDeepStrictEqual(requireOK(fence), existing)) throw new OwnerFailure("update_conflict");
    requireContract(fence.data, backend.caller, "Disabled", buildWorkflow);
    const result = await backend.arm("PUT", logicUrl(workflowId), buildOwnerWorkflow(backend.caller));
    if (result.status === 412 || result.status === 409) throw new OwnerFailure("update_conflict");
    requireOK(result, [200]);
    requireContract(requireOK(await readWorkflow(backend)), backend.caller, "Disabled");
    if (!isDeepStrictEqual(await preflight(backend), before)) throw new OwnerFailure("contract_drift");
    return { status: "updated_disabled", contract: "local-owner-list-v2", existingResourcesUnchanged: true,
      atomicCompareAndSwap: false, calendarRequestMade: false };
  } finally { backend.clear(); }
}

function projectOwnerList(result, key = randomUUID) {
  const summary = projectSummary(result);
  if (!["listed", "empty"].includes(summary.status)) throw new OwnerFailure(summary.providerHttpStatus === 401 || summary.providerHttpStatus === 403 ? "revoked" : "unavailable");
  const list = result.data.calendars;
  if (!Array.isArray(list) || list.length !== summary.count || list.length > pageSize) throw new OwnerFailure("invalid_provider_response");
  const seen = new Set();
  const calendars = list.map(item => {
    if (!item || typeof item.id !== "string" || !item.id.length || item.id.length > 4096 || seen.has(item.id) ||
      typeof item.name !== "string" || item.name.length > 1024) throw new OwnerFailure("invalid_provider_response");
    seen.add(item.id);
    // IDs have no later use in this milestone: drop, rather than retain a mapping.
    // Do not expose addresses embedded in provider labels either.
    const name = item.name.replace(/\S+@\S+/g, "[address hidden]").replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, "").trim();
    return { key: key(), name: name || "Unnamed calendar" };
  });
  return { ...summary, calendars };
}

function preservedAfterLoad(before, after) {
  if (isDeepStrictEqual(before, after)) return true;
  const previous = before?.connection?.properties?.changedTime;
  const current = after?.connection?.properties?.changedTime;
  // ARM documents changedTime as a connection lifecycle timestamp; the live
  // connector advanced it during our successful read-only run. Only this known
  // timestamp may advance AFTER invocation. Keep all other fields, unknown keys,
  // identity, status, parameters, tags, ETag and the entire invitation exact.
  if (typeof previous !== "string" || typeof current !== "string" ||
    !Number.isFinite(Date.parse(previous)) || !Number.isFinite(Date.parse(current)) ||
    Date.parse(current) < Date.parse(previous)) return false;
  const prior = structuredClone(before), next = structuredClone(after);
  delete prior.connection.properties.changedTime;
  delete next.connection.properties.changedTime;
  return isDeepStrictEqual(prior, next);
}

async function load(backend, { signal, record = () => {} } = {}) {
  let enabledAttempted = false, completedEnable = false;
  const fence = () => { if (signal?.aborted) throw new OwnerFailure("cancelled"); };
  try {
    fence();
    const before = await preflight(backend); fence();
    requireContract(requireOK(await readWorkflow(backend)), backend.caller, "Disabled"); fence();
    const callback = requireOK(await backend.arm("POST", logicUrl(workflowId, "/triggers/manual/listCallbackUrl"), {}));
    const url = callbackUrl(callback?.value); fence();
    enabledAttempted = true;
    requireOK(await backend.arm("POST", logicUrl(workflowId, "/enable")), [200, 202, 204]);
    completedEnable = true; fence();
    requireContract(requireOK(await readWorkflow(backend)), backend.caller, "Enabled");
    if (!isDeepStrictEqual(await preflight(backend), before)) throw new OwnerFailure("revoked");
    fence();
    // No denial probes here: verified previously; one explicit authenticated list only.
    const result = await backend.invoke(url, "valid", { ownerList: true, signal }); fence();
    requireContract(requireOK(await readWorkflow(backend)), backend.caller, "Enabled");
    if (!preservedAfterLoad(before, await preflight(backend))) throw new OwnerFailure("revoked");
    fence();
    return projectOwnerList(result);
  } finally {
    try {
      if (enabledAttempted) {
        record("cleanup_pending");
        try {
          // Independent of cancellation, and never retried. Do not clear credentials early.
          requireOK(await backend.arm("POST", logicUrl(workflowId, "/disable")), [200, 202, 204]);
          requireContract(requireOK(await readWorkflow(backend)), backend.caller, "Disabled");
          // A timed-out enable could arrive after disable: keep ambiguous lifecycle blocked.
          if (!completedEnable) throw new OwnerFailure("cleanup_failed");
          record("workflow_disabled");
        } catch { record("cleanup_failed"); throw new OwnerFailure("cleanup_failed"); }
      }
    } finally { backend.clear(); }
  }
}

async function cliAsync(args, signal) {
  try {
    const { stdout } = await promisify(execFile)("az", [...args, "--only-show-errors", "--output", "json"], {
      encoding: "utf8", timeout: 60000, maxBuffer: 1024 * 1024, signal,
      env: { ...process.env, AZURE_EXTENSION_USE_DYNAMIC_INSTALL: "no", AZURE_CORE_COLLECT_TELEMETRY: "false", AZURE_CORE_ENABLE_LOG_FILE: "false" }
    });
    return JSON.parse(stdout);
  } catch { throw new OwnerFailure(signal?.aborted ? "cancelled" : "unavailable"); }
}

async function ownerBackend(signal, read = cliAsync, request = jsonRequest, mode = "load") {
  // Acquire asynchronously only in an explicit operation, never at server startup.
  if (!["load", "status", "update"].includes(mode)) throw new OwnerFailure("blocked");
  const values = [];
  let backend;
  try {
    values.push(await read(["account", "show", "--subscription", scope.subscription, "--query", "{tenant:tenantId,state:state}"], signal));
    values.push(await read(["ad", "signed-in-user", "show", "--query", "id"], signal));
    values.push(await read(["account", "get-access-token", "--subscription", scope.subscription, "--resource", scope.audience, "--query", "accessToken"], signal));
    if (!tokenMatches(values[2], values[1], Date.now() + 8 * 60 * 1000)) throw new OwnerFailure("expired");
    const reads = new Set([logicUrl(workflowId), logicUrl(invitationId), `${connectionId}?api-version=2016-06-01`,
      `/subscriptions/${scope.subscription}/resourceGroups/${scope.group}?api-version=2021-04-01`, `${apiId}?api-version=2016-06-01&export=true`]);
    const posts = new Set([logicUrl(workflowId, "/enable"), logicUrl(workflowId, "/disable"), logicUrl(workflowId, "/triggers/manual/listCallbackUrl")]);
    let cleaning = false, putAttempted = false;
    backend = createBackend(() => values.shift(), (url, options) => request(url, { ...options, signal: cleaning ? undefined : signal }));
    const arm = backend.arm.bind(backend);
    backend.arm = (method, id, body, headers) => {
      const exactUpdate = mode === "update" && !putAttempted && method === "PUT" && id === logicUrl(workflowId) &&
        headers === undefined && isDeepStrictEqual(body, buildOwnerWorkflow(backend.caller));
      if (!(method === "GET" && reads.has(id) || mode === "load" && method === "POST" && posts.has(id) || exactUpdate)) throw new OwnerFailure("blocked");
      if (exactUpdate) putAttempted = true;
      if (method === "POST" && id === logicUrl(workflowId, "/disable")) cleaning = true;
      return arm(method, id, body, headers);
    };
    const invoke = backend.invoke.bind(backend);
    backend.invoke = (...args) => {
      if (mode !== "load") throw new OwnerFailure("blocked");
      return invoke(...args);
    };
    if (signal?.aborted) { backend.clear(); throw new OwnerFailure("cancelled"); }
    return backend;
  } finally { values.fill(undefined); values.length = 0; }
}

if (require.main === module) {
  (async () => {
    const mode = process.argv[2];
    if (process.argv.length !== 3 || !["status", "update"].includes(mode)) throw new OwnerFailure("blocked");
    const execute = async () => (mode === "status" ? status : update)(await ownerBackend(undefined, undefined, undefined, mode));
    console.log(JSON.stringify(await (mode === "update" ? withOwnerOperation(execute) : execute())));
  })().catch(error => {
    console.error(JSON.stringify({ status: "stopped", code: error instanceof OwnerFailure ? error.code :
      error?.message === "owner_operation_busy" ? "busy" : "unavailable", calendarRequestMade: false, automaticRetry: false }));
    process.exitCode = 1;
  });
}

module.exports = { OwnerFailure, matches, requireContract, status, update, projectOwnerList, preservedAfterLoad, load, ownerBackend, cliAsync };