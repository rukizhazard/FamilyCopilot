"use strict";
// No CLI path prints target values, resource bodies, callback URLs or schedules.
const { isDeepStrictEqual } = require("node:util");
const { createHash } = require("node:crypto");
const { createBackend, tokenMatches, jsonRequest, preflight, requireOK, logicUrl, callbackUrl, SafeFailure } = require("./calendar-list");
const { cliAsync, OwnerFailure, requireContract: requireOwner, preservedAfterLoad } = require("./owner-calendar");
const { withOwnerOperation } = require("./owner-operation");
const { scope, workflowId: ownerId, connectionId, invitationId, apiId } = require("../infra/calendar-list");
const { workflowId, workflowName, buildAvailability, buildOctoberAvailability, buildPriorWeekAvailability, buildRepairedAvailability, buildLegacyAvailability, validateTargets } = require("../infra/availability");
const { project, responseLimit, liveWindow } = require("../owner/availability-core");
const { capabilityEvidence } = require("./availability-capability");
const within = (obj, keys) => obj && typeof obj === "object" && !Array.isArray(obj) && Object.keys(obj).every(k => keys.includes(k));
function requireContract(actual, caller, state, factory = buildOctoberAvailability) {
  const expected = factory(caller);
  const p = actual?.properties;
  // Secure values are intentionally not readable from ARM. Verify the exact
  // definition and only the service's redacted envelope; fence version per load.
  const parameters = structuredClone(p?.parameters || {});
  const targets = parameters.targets;
  if (targets !== undefined && (!within(targets, ["type", "value"]) || targets.type && targets.type !== "SecureObject" ||
    Object.hasOwn(targets, "value") && targets.value !== null)) throw new OwnerFailure("contract_drift");
  delete parameters.targets;
  if (!within(actual, ["id", "name", "type", "location", "tags", "properties", "etag"]) ||
    actual.id && actual.id.toLowerCase() !== workflowId.toLowerCase() || actual.name && actual.name !== workflowName ||
    actual.type && actual.type !== "Microsoft.Logic/workflows" ||
    !within(p, ["state", "accessControl", "definition", "parameters", "provisioningState", "createdTime", "changedTime", "version", "accessEndpoint", "endpointsConfiguration"]) ||
    actual.location !== expected.location || !isDeepStrictEqual(actual.tags, expected.tags) ||
    !isDeepStrictEqual(p.definition, expected.properties.definition) || !isDeepStrictEqual(p.accessControl, expected.properties.accessControl) ||
    !isDeepStrictEqual(parameters, expected.properties.parameters) || p.state !== state) throw new OwnerFailure("contract_drift");
  return actual;
}
async function preserved(backend) {
  const resources = await preflight(backend);
  const owner = requireOK(await backend.arm("GET", logicUrl(ownerId)));
  requireOwner(owner, backend.caller, "Disabled");
  return { ...resources, owner };
}
async function availabilityBackend(signal, mode = "load", targets, read = cliAsync, request = jsonRequest) {
  if (!["load", "deploy", "repair", "week", "sunday", "october", "status", "diagnostic"].includes(mode)) throw new OwnerFailure("blocked");
  const values = [];
  try {
    values.push(await read(["account", "show", "--subscription", scope.subscription, "--query", "{tenant:tenantId,state:state}"], signal));
    values.push(await read(["ad", "signed-in-user", "show", "--query", "id"], signal));
    values.push(await read(["account", "get-access-token", "--subscription", scope.subscription, "--resource", scope.audience, "--query", "accessToken"], signal));
    // Same ten-minute remaining-lifetime margin as the owner-list backend,
    // including independent cleanup. Insufficient lifetime is not policy denial.
    if (!tokenMatches(values[2], values[1], Date.now() + 8 * 60 * 1000)) throw new OwnerFailure("expired");
    let cleaning = false, put = false, invoked = false, boundUrl, actionsUrl;
    const backend = createBackend(() => values.shift(), (url, options) => request(url, { ...options,
      ...(url === boundUrl ? { maxBytes: responseLimit } : {}), signal: cleaning ? undefined : signal }));
    const arm = backend.arm.bind(backend), invoke = backend.invoke.bind(backend);
    const reads = new Set([logicUrl(workflowId), logicUrl(ownerId), logicUrl(invitationId), `${connectionId}?api-version=2016-06-01`,
      `${apiId}?api-version=2016-06-01&export=true`, `/subscriptions/${scope.subscription}/resourceGroups/${scope.group}?api-version=2021-04-01`]);
    const posts = new Set(["/enable", "/disable", "/triggers/manual/listCallbackUrl"].map(s => logicUrl(workflowId, s)));
    backend.arm = async (method, id, body, headers) => {
      const runsUrl = `${logicUrl(workflowId, "/runs")}&$top=1`;
      const metadata = mode === "diagnostic" && method === "GET" && body === undefined &&
        (id === runsUrl || actionsUrl !== undefined && id === actionsUrl);
      const factory = mode === "repair" ? buildRepairedAvailability : mode === "week" ? buildPriorWeekAvailability : mode === "october" ? buildOctoberAvailability : buildAvailability;
      const deploy = ["deploy", "repair", "week", "sunday", "october"].includes(mode) && !put && method === "PUT" && id === logicUrl(workflowId) &&
        isDeepStrictEqual(body, factory(backend.caller, targets));
      if (headers !== undefined || !(metadata || method === "GET" && reads.has(id) && body === undefined ||
        mode === "load" && method === "POST" && posts.has(id) && (body === undefined || isDeepStrictEqual(body, {})) || deploy)) throw new OwnerFailure("blocked");
      if (deploy) put = true;
      if (id === logicUrl(workflowId, "/disable")) cleaning = true;
      const result = await arm(method, id, body);
      if (mode === "diagnostic" && id === runsUrl) {
        const name = requireOK(result)?.value?.[0]?.name;
        actionsUrl = /^[a-zA-Z0-9-]{1,100}$/.test(name || "") ? logicUrl(workflowId, `/runs/${name}/actions`) : undefined;
      }
      if (id === logicUrl(workflowId, "/triggers/manual/listCallbackUrl")) boundUrl = callbackUrl(requireOK(result)?.value);
      return result;
    };
    backend.invoke = async (url, auth) => {
      if (mode !== "load" || url !== boundUrl || !["none", "invalid", "valid"].includes(auth) || auth === "valid" && invoked) throw new OwnerFailure("blocked");
      if (auth === "valid") invoked = true;
      return invoke(url, auth); // Empty request body only; never accepts browser targets.
    };
    return backend;
  } finally { values.fill(undefined); values.length = 0; }
}
async function deploy(backend, targets) {
  try {
    validateTargets(targets);
    const before = await preserved(backend);
    const absent = async () => {
      const r = await backend.arm("GET", logicUrl(workflowId));
      if (r.status !== 404 || r.data?.error?.code !== "ResourceNotFound") throw new OwnerFailure("update_conflict");
    };
    await absent();
    if (!capabilityEvidence(requireOK(await backend.arm("GET", `${apiId}?api-version=2016-06-01&export=true`))).getScheduleRouteCandidate) throw new OwnerFailure("contract_drift");
    if (!isDeepStrictEqual(before, await preserved(backend))) throw new OwnerFailure("contract_drift");
    await absent(); // Standard supported PUT; local lock is not atomic Azure CAS.
    requireOK(await backend.arm("PUT", logicUrl(workflowId), buildAvailability(backend.caller, targets)), [200, 201]);
    requireContract(requireOK(await backend.arm("GET", logicUrl(workflowId))), backend.caller, "Disabled", buildAvailability);
    if (!isDeepStrictEqual(before, await preserved(backend))) throw new OwnerFailure("contract_drift");
    return { status: "deployed_disabled", sasDisabled: true, preservedResourcesUnchanged: true, queryMade: false };
  } finally { backend.clear(); }
}
async function repair(backend, targets) {
  return migrate(backend, targets, buildLegacyAvailability, buildRepairedAvailability, "repaired_disabled");
}
async function updateWeek(backend, targets) {
  return migrate(backend, targets, buildRepairedAvailability, buildPriorWeekAvailability, "week_updated_disabled");
}
async function updateSunday(backend, targets) {
  return migrate(backend, targets, buildPriorWeekAvailability, buildAvailability, "sunday_updated_disabled");
}
async function updateOctober(backend, targets) {
  return migrate(backend, targets, buildAvailability, buildOctoberAvailability, "october_updated_disabled");
}
async function migrate(backend, targets, prior, next, status) {
  try {
    validateTargets(targets);
    const before = await preserved(backend);
    const initial = requireContract(requireOK(await backend.arm("GET", logicUrl(workflowId))), backend.caller, "Disabled", prior);
    if (!capabilityEvidence(requireOK(await backend.arm("GET", `${apiId}?api-version=2016-06-01&export=true`))).getScheduleRouteCandidate) throw new OwnerFailure("contract_drift");
    if (!isDeepStrictEqual(before, await preserved(backend))) throw new OwnerFailure("update_conflict");
    const fence = requireContract(requireOK(await backend.arm("GET", logicUrl(workflowId))), backend.caller, "Disabled", prior);
    if (!isDeepStrictEqual(initial, fence)) throw new OwnerFailure("update_conflict");
    // Exactly one old->new PUT, immediately after the full prior snapshot check.
    // Called under the same local lock as loads; not an atomic Azure CAS.
    const result = await backend.arm("PUT", logicUrl(workflowId), next(backend.caller, targets));
    if ([409, 412].includes(result.status)) throw new OwnerFailure("update_conflict");
    requireOK(result, [200]);
    requireContract(requireOK(await backend.arm("GET", logicUrl(workflowId))), backend.caller, "Disabled", next);
    if (!isDeepStrictEqual(before, await preserved(backend))) throw new OwnerFailure("contract_drift");
    return { status, sasDisabled: true, preservedResourcesUnchanged: true, queryMade: false, atomicCompareAndSwap: false };
  } finally { backend.clear(); }
}
async function loadAvailability(backend, { signal, record = () => {}, recordContext = () => {} } = {}) {
  let enabled = false, completedEnable = false;
  const fence = () => { if (signal?.aborted) throw new OwnerFailure("cancelled"); };
  try {
    fence(); const before = await preserved(backend); fence();
    requireContract(requireOK(await backend.arm("GET", logicUrl(workflowId))), backend.caller, "Disabled");
    const url = callbackUrl(requireOK(await backend.arm("POST", logicUrl(workflowId, "/triggers/manual/listCallbackUrl"), {}))?.value); fence();
    enabled = true;
    requireOK(await backend.arm("POST", logicUrl(workflowId, "/enable")), [200, 202, 204]); completedEnable = true; fence();
    const active = requireContract(requireOK(await backend.arm("GET", logicUrl(workflowId))), backend.caller, "Enabled");
    // These requests must be denied BEFORE the single authenticated query.
    for (const auth of ["none", "invalid"]) { fence(); const r = await backend.invoke(url, auth); if (![401, 403].includes(r.status)) throw new OwnerFailure("blocked"); }
    const check = async (afterQuery = false) => {
      const current = requireContract(requireOK(await backend.arm("GET", logicUrl(workflowId))), backend.caller, "Enabled");
      if (!isDeepStrictEqual(current, active)) throw new OwnerFailure("contract_drift");
      const next = await preserved(backend);
      if (!(afterQuery ? preservedAfterLoad(before, next) : isDeepStrictEqual(before, next))) throw new OwnerFailure("revoked");
    };
    await check(); fence();
    const result = await backend.invoke(url, "valid"); fence();
    await check(true); fence();
    if (result.status !== 200) throw new OwnerFailure("unavailable");
    // Internal only: bind a snapshot to the verified caller/configuration version,
    // never a display alias or browser-supplied email. No offline revocation claim.
    recordContext(createHash("sha256").update(JSON.stringify([workflowId, backend.caller, active.properties.version, active.tags.contract])).digest("hex"));
    return project(result.data, liveWindow);
  } finally {
    try {
      if (enabled) {
        record("cleanup_pending");
        try {
          requireOK(await backend.arm("POST", logicUrl(workflowId, "/disable")), [200, 202, 204]);
          requireContract(requireOK(await backend.arm("GET", logicUrl(workflowId))), backend.caller, "Disabled");
          if (!completedEnable) throw new Error();
          record("workflow_disabled");
        } catch { record("cleanup_failed"); throw new OwnerFailure("cleanup_failed"); }
      }
    } finally { backend.clear(); }
  }
}
async function inspectDisabled() {
  return withOwnerOperation(async () => {
    const b = await availabilityBackend(undefined, "status");
    try { const snapshot = await preserved(b); requireContract(requireOK(await b.arm("GET", logicUrl(workflowId))), b.caller, "Disabled"); return snapshot; }
    finally { b.clear(); }
  });
}
async function perform(options) {
  try { return await withOwnerOperation(async () => loadAvailability(await availabilityBackend(options.signal), options)); }
  catch (e) { if (e?.message === "owner_operation_busy") throw new OwnerFailure("busy"); throw e; }
}
if (require.main === module) (async () => {
  if (process.argv.length !== 3 || !["deploy", "repair", "week", "sunday", "october", "status"].includes(process.argv[2])) throw new OwnerFailure("blocked");
  if (process.argv[2] === "status") { await inspectDisabled(); console.log(JSON.stringify({ status: "disabled_verified", sasDisabled: true, ownerDisabled: true, connectorConnected: true, invitationDisabled: true, deliveryOff: true })); return; }
  let text = "";
  for await (const chunk of process.stdin) { text += chunk; if (text.length > 1024) throw new OwnerFailure("blocked"); }
  const targets = validateTargets(JSON.parse(text)); text = "";
  const mode = process.argv[2];
  try { console.log(JSON.stringify(await withOwnerOperation(async () => {
    if (mode === "october" && !(await require("./owner-local-status").inspectLocalOwner()).safeIdle) throw new OwnerFailure("busy");
    return ({ repair, deploy, week: updateWeek, sunday: updateSunday, october: updateOctober }[mode])(await availabilityBackend(undefined, mode, targets), targets);
  }))); }
  finally { targets.fill(""); }
})().catch(e => { console.error(JSON.stringify({ status: "stopped", code: e instanceof OwnerFailure || e instanceof SafeFailure ? e.code : "unavailable", automaticRetry: false })); process.exitCode = 1; });
module.exports = { requireContract, preserved, availabilityBackend, deploy, repair, updateWeek, updateSunday, updateOctober, loadAvailability, inspectDisabled, perform };