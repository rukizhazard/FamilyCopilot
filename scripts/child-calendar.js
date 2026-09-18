"use strict";
// Operator-gated adapter. No CLI list/import path, no startup auth, no disk data.
const { isDeepStrictEqual } = require("node:util");
const { cliAsync, OwnerFailure, load: loadList, requireContract: requireList, preservedAfterLoad } = require("./owner-calendar");
const { createBackend, tokenMatches, jsonRequest, preflight, requireOK, logicUrl, callbackUrl } = require("./calendar-list");
const { requireContract: requireAvailability } = require("./availability");
const { capabilityEvidence } = require("./child-calendar-preflight");
const { withOwnerOperation } = require("./owner-operation");
const { scope, apiId, connectionId, invitationId, workflowId: listId } = require("../infra/calendar-list");
const { workflowId: availabilityId } = require("../infra/availability");
const { workflowId, workflowName, buildChildWorkflow } = require("../infra/child-calendar");
const { validId } = require("./child-calendar-session");
const C = require("../owner/child-calendar-core");
function requireChild(actual, caller, state = "Disabled") {
  const expected = buildChildWorkflow(caller);
  const within = (obj, keys) => obj && typeof obj === "object" && !Array.isArray(obj) && Object.keys(obj).every(k => keys.includes(k));
  if (!within(actual, ["id", "name", "type", "location", "tags", "properties", "etag"]) ||
    actual.id && actual.id.toLowerCase() !== workflowId.toLowerCase() || actual.name && actual.name !== workflowName || actual.type && actual.type !== "Microsoft.Logic/workflows" ||
    !within(actual.properties, ["state", "accessControl", "definition", "parameters", "provisioningState", "createdTime", "changedTime", "version", "accessEndpoint", "endpointsConfiguration"]) ||
    actual.location !== expected.location || !isDeepStrictEqual(actual.tags, expected.tags) || actual.properties.state !== state ||
    ["definition", "accessControl", "parameters"].some(k => !isDeepStrictEqual(actual.properties[k], expected.properties[k]))) throw new OwnerFailure("contract_drift");
  return actual;
}
async function preserved(backend, includeList = true) {
  const base = await preflight(backend);
  const availability = requireAvailability(requireOK(await backend.arm("GET", logicUrl(availabilityId))), backend.caller, "Disabled");
  if (!includeList) return { ...base, availability };
  const list = requireOK(await backend.arm("GET", logicUrl(listId))); requireList(list, backend.caller, "Disabled");
  return { ...base, availability, list };
}
async function childBackend(mode, { signal, calendarId, disclosure, read = cliAsync, request = jsonRequest } = {}) {
  if (!["check", "deploy", "find", "import", "cleanup-find", "cleanup-import"].includes(mode) || mode === "import" && (!validId(calendarId) || !["details", "busy_only"].includes(disclosure))) throw new OwnerFailure("blocked");
  const recovery = mode === "cleanup-find" || mode === "cleanup-import";
  // A recovery authenticates afresh through the injected native reader. Neither
  // its credential reads nor its GET/disable requests inherit data cancellation.
  if (recovery) signal = undefined;
  const values = [];
  try {
    values.push(await read(["account", "show", "--subscription", scope.subscription, "--query", "{tenant:tenantId,state:state}"], signal));
    values.push(await read(["ad", "signed-in-user", "show", "--query", "id"], signal));
    values.push(await read(["account", "get-access-token", "--subscription", scope.subscription, "--resource", scope.audience, "--query", "accessToken"], signal));
    if (!tokenMatches(values[2], values[1], Date.now() + 8 * 60000)) throw new OwnerFailure("expired");
    let cleaning = recovery, bound, put = false, invoked = false;
    const backend = createBackend(() => values.shift(), (url, options) => request(url, { ...options,
      signal: cleaning ? undefined : signal,
      ...(url === bound ? { maxBytes: C.maxBytes, ...(mode === "import" ? { body: { calendarId, disclosure, person: "Kimi", guardian: true, confirmed: true } } : {}) } : {}) }));
    const raw = backend.arm.bind(backend), invoke = backend.invoke.bind(backend);
    const target = mode === "find" || mode === "cleanup-find" ? listId : workflowId;
    const reads = new Set([logicUrl(target), logicUrl(listId), logicUrl(availabilityId), logicUrl(invitationId),
      `${connectionId}?api-version=2016-06-01`, `/subscriptions/${scope.subscription}/resourceGroups/${scope.group}?api-version=2021-04-01`,
      ...(!recovery ? [logicUrl(workflowId), `${apiId}?api-version=2016-06-01&export=true`] : [])]);
    const posts = new Set((recovery ? ["/disable"] : ["/enable", "/disable", "/triggers/manual/listCallbackUrl"]).map(s => logicUrl(target, s)));
    backend.arm = async (method, id, body, headers) => {
      const deploy = mode === "deploy" && !put && method === "PUT" && id === logicUrl(workflowId) && isDeepStrictEqual(body, buildChildWorkflow(backend.caller));
      if (headers !== undefined || !(method === "GET" && reads.has(id) && body === undefined ||
        (["find", "import"].includes(mode) || recovery) && method === "POST" && posts.has(id) && (body === undefined || C.exact(body, [])) || deploy)) throw new OwnerFailure("blocked");
      if (deploy) put = true;
      if (id === logicUrl(target, "/disable")) cleaning = true;
      const result = await raw(method, id, body);
      if (id === logicUrl(target, "/triggers/manual/listCallbackUrl")) bound = callbackUrl(requireOK(result)?.value);
      return result;
    };
    backend.invoke = async (url, auth, options) => {
      if (!["find", "import"].includes(mode) || !bound || url !== bound || invoked || auth !== "valid") throw new OwnerFailure("blocked");
      invoked = true; return invoke(url, auth, options);
    };
    return backend;
  } catch (error) {
    if (recovery) throw new OwnerFailure("cleanup_failed");
    throw error;
  } finally { values.fill(undefined); values.length = 0; }
}
async function inspectReady(backend) {
  try {
    const before = await preserved(backend);
    const child = requireChild(requireOK(await backend.arm("GET", logicUrl(workflowId))), backend.caller);
    const swaggerUrl = `${apiId}?api-version=2016-06-01&export=true`;
    const swagger = requireOK(await backend.arm("GET", swaggerUrl));
    const evidence = capabilityEvidence(swagger);
    if (!evidence.httpGetCalendarCandidate) throw new OwnerFailure("contract_drift");
    const after = await preserved(backend);
    const final = requireChild(requireOK(await backend.arm("GET", logicUrl(workflowId))), backend.caller);
    const currentSwagger = requireOK(await backend.arm("GET", swaggerUrl));
    if (!isDeepStrictEqual(before, after) || !isDeepStrictEqual(child, final) || !isDeepStrictEqual(swagger, currentSwagger)) throw new OwnerFailure("contract_drift");
    return { status: "child_ready", httpGetCalendarCandidate: true, nativeViewCandidate: evidence.nativeViewCandidate,
      sasDisabled: true, preservedResourcesUnchanged: true, calendarQueries: 0, cloudChanges: false, runtimeVerified: false };
  } finally { await backend.clear(); }
}
async function recover(backend, action) {
  try {
    if (!["find", "import"].includes(action)) throw new OwnerFailure("cleanup_failed");
    const target = action === "find" ? listId : workflowId;
    const requireTarget = action === "find" ? requireList : requireChild;
    // The list itself is the find recovery target, NOT a preserved Disabled
    // resource. Availability, connection and invitation guards still run twice.
    const before = await preserved(backend, action !== "find");
    const actual = requireOK(await backend.arm("GET", logicUrl(target)));
    const state = actual?.properties?.state;
    if (!["Enabled", "Disabled"].includes(state)) throw new OwnerFailure("cleanup_failed");
    requireTarget(actual, backend.caller, state);
    if (state === "Enabled") requireOK(await backend.arm("POST", logicUrl(target, "/disable")), [200, 202, 204]);
    // Never infer completion from the disable reply, or from the initial GET
    // when already Disabled. The cleanup backend keeps this read independent.
    requireTarget(requireOK(await backend.arm("GET", logicUrl(target))), backend.caller, "Disabled");
    if (!isDeepStrictEqual(before, await preserved(backend, action !== "find"))) throw new OwnerFailure("cleanup_failed");
    return { status: "workflow_disabled", calendarQueries: 0 };
  } catch { throw new OwnerFailure("cleanup_failed"); }
  finally {
    try { await backend.clear(); } catch { throw new OwnerFailure("cleanup_failed"); }
  }
}
async function deployment(backend, create = false) {
  try {
    const before = await preserved(backend);
    const absent = async () => {
      const r = await backend.arm("GET", logicUrl(workflowId));
      if (r.status !== 404 || r.data?.error?.code !== "ResourceNotFound") throw new OwnerFailure("update_conflict");
    };
    await absent();
    if (!capabilityEvidence(requireOK(await backend.arm("GET", `${apiId}?api-version=2016-06-01&export=true`))).httpGetCalendarCandidate) throw new OwnerFailure("contract_drift");
    if (!isDeepStrictEqual(before, await preserved(backend))) throw new OwnerFailure("contract_drift");
    await absent();
    if (!create) return { status: "candidate_ready", cloudChanges: false, runtimeVerified: false };
    // Standard PUT, NOT atomic Azure absent-only CAS. External-writer race remains.
    requireOK(await backend.arm("PUT", logicUrl(workflowId), buildChildWorkflow(backend.caller)), [200, 201]);
    requireChild(requireOK(await backend.arm("GET", logicUrl(workflowId))), backend.caller);
    if (!isDeepStrictEqual(before, await preserved(backend))) throw new OwnerFailure("contract_drift");
    return { status: "deployed_disabled", sasDisabled: true, calendarQueries: 0, atomicCompareAndSwap: false };
  } finally { backend.clear(); }
}
async function find(backend, options) {
  // Keep provider identifiers only inside the server operation, after the existing
  // list contract/projection validated them. Never return IDs to the browser.
  let source;
  const invoke = backend.invoke.bind(backend), clear = backend.clear.bind(backend);
  backend.invoke = async (...args) => { const r = await invoke(...args); source = r; return r; };
  backend.clear = () => {}; // Outer finally retains credentials through preservation readback.
  try {
    const before = await preserved(backend, false);
    const result = await loadList(backend, options);
    if (!preservedAfterLoad(before, await preserved(backend, false))) throw new OwnerFailure("revoked");
    return { calendars: source.data.calendars.map((c, i) => ({ id: c.id, name: result.calendars[i].name })), partial: true };
  } finally { source = null; clear(); }
}
async function importEvents(backend, { signal, record = () => {}, disclosure } = {}) {
  let attempted = false, enabled = false;
  const fence = () => { if (signal?.aborted) throw new OwnerFailure("cancelled"); };
  try {
    fence(); const before = await preserved(backend);
    requireChild(requireOK(await backend.arm("GET", logicUrl(workflowId))), backend.caller); fence();
    const url = callbackUrl(requireOK(await backend.arm("POST", logicUrl(workflowId, "/triggers/manual/listCallbackUrl"), {}))?.value); fence();
    attempted = true; requireOK(await backend.arm("POST", logicUrl(workflowId, "/enable")), [200, 202, 204]); enabled = true;
    const active = requireChild(requireOK(await backend.arm("GET", logicUrl(workflowId))), backend.caller, "Enabled");
    if (!isDeepStrictEqual(before, await preserved(backend))) throw new OwnerFailure("revoked"); fence();
    const result = await backend.invoke(url, "valid"); fence();
    if (!isDeepStrictEqual(active, requireChild(requireOK(await backend.arm("GET", logicUrl(workflowId))), backend.caller, "Enabled")) || !preservedAfterLoad(before, await preserved(backend))) throw new OwnerFailure("revoked");
    if ([401, 403, 404].includes(result.status)) throw new OwnerFailure("revoked");
    if (result.status !== 200) throw new OwnerFailure("unavailable");
    return C.project(result.data, disclosure);
  } finally {
    try {
      if (attempted) {
        record("cleanup_pending");
        try {
          requireOK(await backend.arm("POST", logicUrl(workflowId, "/disable")), [200, 202, 204]);
          requireChild(requireOK(await backend.arm("GET", logicUrl(workflowId))), backend.caller);
          if (!enabled) throw new Error(); record("workflow_disabled");
        } catch { record("cleanup_failed"); throw new OwnerFailure("cleanup_failed"); }
      }
    } finally { backend.clear(); }
  }
}
async function perform(options) {
  try {
    return await withOwnerOperation(async () => {
      const mode = options.action === "find" ? "find" : options.action === "import" ? "import" : null;
      if (!mode) throw new OwnerFailure("blocked");
      const b = await childBackend(mode, options);
      return mode === "find" ? find(b, options) : importEvents(b, options);
    });
  } catch (e) { if (e?.message === "owner_operation_busy") throw new OwnerFailure("busy"); throw e; }
}
// No executable deployment or live-query CLI: review and native-auth/cross-OS
// exclusion evidence are still required before wiring an operator entry point.
module.exports = { requireChild, preserved, childBackend, inspectReady, recover, deployment, find, importEvents, perform };