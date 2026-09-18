"use strict";

// CLI output and HTTP bodies stay in process memory. Never log arbitrary errors,
// caller IDs, tokens, callback URLs, calendar IDs, labels, or owner addresses.
const { execFileSync } = require("node:child_process");
const { isDeepStrictEqual } = require("node:util");
const { scope, workflowId, connectionId, invitationId, apiId, operationPath, pageSize, buildWorkflow } = require("../infra/calendar-list");
const armOrigin = "https://management.azure.com";
const codes = new Set(["AuthorizationFailed", "Authorization_RequestDenied", "InvalidAuthenticationToken",
  "ExpiredAuthenticationToken", "InvalidTemplate", "InvalidRequestContent", "WorkflowInvalid",
  "RequestDisallowedByPolicy", "ResourceNotFound", "ResourceGroupNotFound", "Conflict", "PreconditionFailed",
  "WorkflowTriggerIsNotEnabled", "DirectApiAuthorizationRequired", "InvalidUseOfOAuthToken",
  "MisMatchingOAuthClaims", "AuthorizationPermissionMismatch", "Unauthorized", "Forbidden",
  "AADSTS53003", "AADSTS50076", "AADSTS700082", "AccountScopeMismatch", "OperatorClaimsMismatch",
  "GroupLocationMismatch", "ConnectionNotReady", "InvitationGuardMismatch", "ExistingCallerPolicyMismatch",
  "OperationMetadataMismatch", "WorkflowContractMismatch", "WorkflowNotDisabled", "UnsafeCallbackUrl"]);
function safeCode(value) { return codes.has(value) ? value : "UnclassifiedFailure"; }
class SafeFailure extends Error {
  constructor(code, status = 0) { super(safeCode(code)); this.code = safeCode(code); this.status = Number.isInteger(status) ? status : 0; }
}
function cli(args, execute = execFileSync) {
  try {
    const text = execute("az", [...args, "--only-show-errors", "--output", "json"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 60000, maxBuffer: 1024 * 1024,
      env: { ...process.env, AZURE_EXTENSION_USE_DYNAMIC_INSTALL: "no", AZURE_CORE_COLLECT_TELEMETRY: "false", AZURE_CORE_ENABLE_LOG_FILE: "false" }
    });
    return JSON.parse(text);
  } catch (error) {
    const text = String(error?.stderr || "");
    const code = [...codes].find(code => new RegExp(`\\b${code}\\b`).test(text));
    throw new SafeFailure(code);
  }
}

async function jsonRequest(url, { method = "GET", token, body, headers = {}, signal, timeout = 90000, maxBytes = 2 * 1024 * 1024 } = {}, fetcher = fetch) {
  let result;
  try {
    result = await fetcher(url, {
      method, redirect: "error", signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout),
      headers: { Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    if (Number(result.headers.get("content-length")) > maxBytes) { await result.body?.cancel(); throw new SafeFailure(); }
    let bytes = 0;
    const chunks = [];
    if (result.body) for await (const chunk of result.body) {
      bytes += chunk.length;
      if (bytes > maxBytes) throw new SafeFailure();
      chunks.push(Buffer.from(chunk));
    }
    const text = Buffer.concat(chunks).toString("utf8");
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* Never echo malformed bodies. */ }
    return { status: result.status, data, etag: result.headers.get("etag") };
  } catch (error) {
    if (error instanceof SafeFailure) throw error;
    throw new SafeFailure(undefined, result?.status);
  }
}

function tokenMatches(token, caller, now = Date.now()) {
  // Local sanity check only. Azure validates signature/issuer/claims at the endpoint.
  try {
    if (typeof token !== "string" || token.length > 32768) return false;
    const p = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return p.oid === caller && p.tid === scope.tenant && p.iss === `https://sts.windows.net/${scope.tenant}/` &&
      p.appid === scope.application && p.aud === scope.audience && p.exp * 1000 > now + 120000;
  } catch { return false; }
}

function operationVerified(swagger) {
  const op = swagger?.paths?.[`/{connectionId}${operationPath}`]?.get;
  return op?.operationId === "CalendarGetTables_V2" && op.deprecated === false &&
    op.responses?.["200"]?.schema?.properties?.value?.type === "array" &&
    ["top", "skip"].every(name => op.parameters?.some(p => p.name === name && p.in === "query" && p.type === "integer"));
}

function workflowMatches(actual, caller) {
  const expected = buildWorkflow(caller);
  return actual?.location === expected.location && isDeepStrictEqual(actual.tags, expected.tags) &&
    ["accessControl", "definition", "parameters"].every(key => isDeepStrictEqual(actual.properties?.[key], expected.properties[key]));
}

function callbackUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !/^prod-\d+\.eastus\.logic\.azure\.com$/.test(url.hostname) ||
      url.username || url.password || (url.port && url.port !== "443") || url.hash ||
      !/^\/workflows\/[a-f0-9]{32}\/triggers\/manual\/paths\/invoke$/.test(url.pathname) ||
      [...url.searchParams.keys()].some(k => k !== "api-version") ||
      url.searchParams.getAll("api-version").length !== 1 ||
      !["2016-10-01", "2019-05-01"].includes(url.searchParams.get("api-version"))) throw new SafeFailure("UnsafeCallbackUrl");
    return url.href;
  } catch { throw new SafeFailure("UnsafeCallbackUrl"); }
}

function projectSummary(result) {
  const d = result?.data;
  if (result?.status === 200 && d && ["listed", "empty"].includes(d.status) &&
    Number.isInteger(d.count) && d.count >= 0 && d.count <= pageSize &&
    (d.status === "empty") === (d.count === 0) && d.eventsRead === 0 &&
    d.completeness === "unknown" && d.ownership === "unverified") {
    return { status: d.status, count: d.count, completeness: "unknown", ownership: "unverified", eventsRead: 0 };
  }
  if (result?.status === 502 && d?.eventsRead === 0 && ["provider_unavailable", "invalid_provider_response"].includes(d.status)) {
    return { status: d.status, eventsRead: 0, providerHttpStatus: [401,403,404,429,500,502,503,504].includes(d.providerHttpStatus) ? d.providerHttpStatus : 0 };
  }
  throw new SafeFailure(d?.error?.code, result?.status);
}

function createBackend(read = cli, request = jsonRequest) {
  const account = read(["account", "show", "--subscription", scope.subscription, "--query", "{tenant:tenantId,state:state}"]);
  if (account?.tenant !== scope.tenant || account.state !== "Enabled") throw new SafeFailure("AccountScopeMismatch");
  const caller = read(["ad", "signed-in-user", "show", "--query", "id"]);
  buildWorkflow(caller);
  // Azure CLI accepts a subscription OR a tenant selector, not both. The account
  // read and token claim check independently enforce the exact approved tenant.
  let token = read(["account", "get-access-token", "--subscription", scope.subscription,
    "--resource", scope.audience, "--query", "accessToken"]);
  if (!tokenMatches(token, caller)) { token = undefined; throw new SafeFailure("OperatorClaimsMismatch"); }
  return {
    caller,
    async arm(method, id, body, headers) {
      if (!token || !id.startsWith(`/subscriptions/${scope.subscription}/`)) throw new SafeFailure();
      const result = await request(`${armOrigin}${id}`, { method, body, headers, token, maxBytes: 8 * 1024 * 1024 });
      return result;
    },
    async invoke(url, authorization, options = {}) {
      if (!token || !["none", "invalid", "valid"].includes(authorization)) throw new SafeFailure();
      return request(callbackUrl(url), { method: "POST", body: {}, token: authorization === "valid" ? token :
        authorization === "invalid" ? "invalid-prototype-token" : undefined, timeout: 90000,
        maxBytes: options.ownerList === true ? 2 * 1024 * 1024 : 8192, signal: options.signal });
    },
    clear() { token = undefined; }
  };
}

const logicUrl = (id, suffix = "") => `${id}${suffix}?api-version=2019-05-01`;
function requireOK(result, allowed = [200]) {
  if (!allowed.includes(result?.status)) throw new SafeFailure(result?.data?.error?.code, result?.status);
  return result.data;
}

async function preflight(backend) {
  const group = requireOK(await backend.arm("GET", `/subscriptions/${scope.subscription}/resourceGroups/${scope.group}?api-version=2021-04-01`));
  if (group?.location !== scope.location) throw new SafeFailure("GroupLocationMismatch");
  const connection = requireOK(await backend.arm("GET", `${connectionId}?api-version=2016-06-01`));
  if (connection?.properties?.api?.id?.toLowerCase() !== apiId.toLowerCase() || connection.location !== scope.location ||
    !connection.properties.statuses?.length || connection.properties.statuses.some(s => s.status !== "Connected")) throw new SafeFailure("ConnectionNotReady");
  const invitation = requireOK(await backend.arm("GET", logicUrl(invitationId)));
  if (invitation?.properties?.state !== "Disabled" || invitation.properties.accessControl?.triggers?.sasAuthenticationPolicy?.state !== "Disabled" ||
    invitation.properties.parameters?.deliveryEnabled?.value !== false) throw new SafeFailure("InvitationGuardMismatch");
  // Bind the new workflow to the already approved operator, not any CLI login.
  const policies = Object.values(invitation.properties.accessControl.triggers.openAuthenticationPolicies?.policies || {});
  const claims = policies[0]?.claims;
  const expected = buildWorkflow(backend.caller).properties.accessControl.triggers.openAuthenticationPolicies.policies.OwnerOnly;
  if (policies.length !== 1 || policies[0].type !== "AAD" || !isDeepStrictEqual(claims, expected.claims)) throw new SafeFailure("ExistingCallerPolicyMismatch");
  return { connection, invitation };
}

async function inspectWorkflow(backend, mustExist = false) {
  const result = await backend.arm("GET", logicUrl(workflowId));
  if (result.status === 404 && result.data?.error?.code === "ResourceNotFound" && !mustExist) return null;
  return requireOK(result);
}

async function run(mode, backend, log = console.log) {
  if (!["check", "deploy", "status", "verify"].includes(mode)) throw new SafeFailure();
  let enabledAttempted = false;
  let report;
  try {
    const before = await preflight(backend);
    const existing = await inspectWorkflow(backend);
    if (mode === "status") {
      return { status: existing ? "present" : "absent", workflowState: ["Enabled", "Disabled"].includes(existing?.properties?.state) ? existing.properties.state : "unknown",
        sasDisabled: existing?.properties?.accessControl?.triggers?.sasAuthenticationPolicy?.state === "Disabled",
        contractMatches: existing ? workflowMatches(existing, backend.caller) : false, connectionConnected: true, invitationDisabled: true };
    }
    if (["check", "deploy"].includes(mode)) {
      if (existing) throw new SafeFailure("Conflict", 409);
      const swagger = requireOK(await backend.arm("GET", `${apiId}?api-version=2016-06-01&export=true`));
      if (!operationVerified(swagger)) throw new SafeFailure("OperationMetadataMismatch");
      if (mode === "check") return { status: "ready_to_create_disabled", operationVerified: true, connectionConnected: true, cloudChanges: false };
      // Recheck immediately before conditional create. Never update a collision.
      if (await inspectWorkflow(backend)) throw new SafeFailure("Conflict", 409);
      const created = await backend.arm("PUT", logicUrl(workflowId), buildWorkflow(backend.caller), { "If-None-Match": "*" });
      requireOK(created, [200, 201]);
      const actual = await inspectWorkflow(backend, true);
      if (!workflowMatches(actual, backend.caller)) throw new SafeFailure("WorkflowContractMismatch");
      if (actual.properties.state !== "Disabled") throw new SafeFailure("WorkflowNotDisabled");
      report = { status: "deployed_disabled", contractMatches: true, eventsRead: 0 };
    } else {
      if (!existing || !workflowMatches(existing, backend.caller)) throw new SafeFailure("WorkflowContractMismatch");
      if (existing.properties.state !== "Disabled") throw new SafeFailure("WorkflowNotDisabled");
      const callback = requireOK(await backend.arm("POST", logicUrl(workflowId, "/triggers/manual/listCallbackUrl"), {}));
      const url = callbackUrl(callback?.value);
      // Keep disable in finally even if enabling succeeds remotely but its reply fails.
      enabledAttempted = true;
      requireOK(await backend.arm("POST", logicUrl(workflowId, "/enable")), [200, 202, 204]);
      const active = await inspectWorkflow(backend, true);
      if (!workflowMatches(active, backend.caller) || active.properties.state !== "Enabled") throw new SafeFailure();
      for (const authorization of ["none", "invalid"]) {
        const denied = await backend.invoke(url, authorization);
        if (![401, 403].includes(denied.status)) throw new SafeFailure(undefined, denied.status);
        log(JSON.stringify({ check: authorization === "none" ? "unauthenticated" : "invalid_token", status: "denied", httpStatus: denied.status }));
      }
      // Recheck revocation/contract after probes and before the one authorized call.
      const fence = await inspectWorkflow(backend, true);
      if (!workflowMatches(fence, backend.caller) || fence.properties.state !== "Enabled") throw new SafeFailure();
      const current = await preflight(backend);
      if (!isDeepStrictEqual(current, before)) throw new SafeFailure();
      report = projectSummary(await backend.invoke(url, "valid"));
      log(JSON.stringify({ check: "live_list", ...report }));
    }
    const after = await preflight(backend);
    if (!isDeepStrictEqual(after, before)) throw new SafeFailure();
    return { ...report, existingResourcesUnchanged: true };
  } finally {
    try {
      if (enabledAttempted) {
        requireOK(await backend.arm("POST", logicUrl(workflowId, "/disable")), [200, 202, 204]);
        const final = await inspectWorkflow(backend, true);
        if (final.properties.state !== "Disabled") throw new SafeFailure();
        log(JSON.stringify({ cleanup: "workflow_disabled" }));
      }
    } finally { backend.clear(); }
  }
}

if (require.main === module) {
  (async () => {
    if (process.argv.length !== 3 || !["check", "deploy", "status", "verify", "--help"].includes(process.argv[2])) throw new SafeFailure();
    if (process.argv[2] === "--help") {
      console.log("Usage: node scripts/calendar-list.js check|deploy|status|verify\nFixed approved Azure scope; existing signed-in CLI operator required. Deploy creates only an absent disabled list-only workflow. Verify temporarily enables it, requires two denial probes, performs at most one authenticated list request, and disables in finally. No automatic retry. Output is counts/status only. Each future live verification requires owner authorization.");
      return;
    }
    const report = await run(process.argv[2], createBackend());
    console.log(JSON.stringify(report));
    if (["provider_unavailable", "invalid_provider_response"].includes(report.status)) process.exitCode = 2;
  })().catch(error => {
    console.error(JSON.stringify({ status: "stopped", code: error instanceof SafeFailure ? error.code : "UnclassifiedFailure",
      httpStatus: error instanceof SafeFailure ? error.status : 0, automaticRetry: false }));
    process.exitCode = 1;
  });
}

module.exports = { SafeFailure, safeCode, cli, jsonRequest, tokenMatches, operationVerified, workflowMatches,
  callbackUrl, projectSummary, createBackend, preflight, inspectWorkflow, run, requireOK, logicUrl };