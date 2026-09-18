"use strict";

// Metadata only. No calendar listing, event reads, enable, deployment, history,
// callback URL retrieval, storage access or automatic retry exists in this CLI.
const { isDeepStrictEqual } = require("node:util");
const { availabilityBackend, preserved, requireContract } = require("./availability");
const { cliAsync, OwnerFailure } = require("./owner-calendar");
const { requireOK, logicUrl } = require("./calendar-list");
const { apiId } = require("../infra/calendar-list");
const { workflowId } = require("../infra/availability");
const { withOwnerOperation } = require("./owner-operation");
const httpPath = "/{connectionId}/codeless/httprequest";
const swaggerUrl = `${apiId}?api-version=2016-06-01&export=true`;

function capabilityEvidence(swagger) {
  const paths = swagger?.paths;
  const http = paths?.[httpPath]?.post;
  const parameters = Array.isArray(http?.parameters) ? http.parameters : [];
  const has = (name, predicate) => {
    const matches = parameters.filter(p => p?.name === name);
    return matches.length === 1 && predicate(matches[0]);
  };
  const description = typeof http?.description === "string" ? http.description : "";
  const segments = /1st seg(?:e)?ment:\s*([^\n]+?)\s+2nd segment:\s*([^\n.]+)/i.exec(description);
  const httpGetCalendarCandidate = http?.operationId === "HttpRequest" && http.deprecated === false &&
    has("Uri", p => p.in === "header" && p.type === "string" && p.required === true) &&
    has("Method", p => p.in === "header" && p.type === "string" && p.required === true && Array.isArray(p.enum) && p.enum.includes("GET")) &&
    Boolean(segments && segments[1].split(/,\s*/).includes("/me") && segments[2].split(/,\s*/).map(s => s.trim()).includes("calendars"));
  // Native support is independent of HttpRequest. Do not turn missing HTTP
  // metadata into the false claim that the connector cannot read calendarView.
  const views = paths && typeof paths === "object" && !Array.isArray(paths)
    ? Object.entries(paths).filter(([path, methods]) => path.startsWith("/{connectionId}/") && methods?.get?.operationId === "GetEventsCalendarViewV3") : [];
  const view = views.length === 1 ? views[0][1].get : null;
  const vp = Array.isArray(view?.parameters) ? view.parameters : [];
  const nativeViewCandidate = view?.deprecated === false && ["calendarId", "startDateTimeUtc", "endDateTimeUtc"].every(name => {
    const p = vp.filter(p => p?.name === name);
    return p.length === 1 && p[0].type === "string" && p[0].required === true &&
      p[0].in === (name === "calendarId" ? "path" : "query");
  });
  return { httpGetCalendarCandidate: Boolean(httpGetCalendarCandidate), nativeViewCandidate: Boolean(nativeViewCandidate),
    runtimeAuthorizationVerified: false, sharedCalendarVisibilityVerified: false, selectSupportVerified: false };
}

async function inspect(backend, stage = () => {}) {
  try {
    stage("preserved_before");
    const before = await preserved(backend);
    const availability = requireContract(requireOK(await backend.arm("GET", logicUrl(workflowId))), backend.caller, "Disabled");
    stage("connector_metadata");
    const evidence = capabilityEvidence(requireOK(await backend.arm("GET", swaggerUrl)));
    stage("preserved_after");
    const after = await preserved(backend);
    const final = requireContract(requireOK(await backend.arm("GET", logicUrl(workflowId))), backend.caller, "Disabled");
    if (!isDeepStrictEqual(before, after) || !isDeepStrictEqual(availability, final)) throw new OwnerFailure("contract_drift");
    return { status: "metadata_inspected", ...evidence, availabilityV5Disabled: true, ownerV2Disabled: true,
      sasDisabled: true, preservedResourcesUnchanged: true, calendarQueries: 0, cloudChanges: false, automaticRetry: false };
  } finally { backend.clear(); }
}

async function main(args, { read = cliAsync, lock = withOwnerOperation,
  makeBackend = (read) => availabilityBackend(undefined, "status", undefined, read), log = console.log } = {}) {
  let stage = "arguments";
  try {
    if (args.length !== 1 || !["--metadata-only", "--help"].includes(args[0])) throw new OwnerFailure("blocked");
    if (args[0] === "--help") {
      log("Usage: node scripts/child-calendar-preflight.js --metadata-only|--help\nRead-only bounded capability and preservation checks. No calendars, events, deployment, enabling or retry. Candidate evidence is not runtime authorization or import readiness.");
      return;
    }
    stage = "operation_lock";
    const result = await lock(async () => {
      const trackedRead = async (...params) => {
        const args = params[0];
        stage = args[0] === "ad" ? "signed_in_user" : args[1] === "get-access-token" ? "credential" : "account";
        return read(...params);
      };
      stage = "credentials";
      const backend = await makeBackend(trackedRead);
      return inspect(backend, next => { stage = next; });
    });
    log(JSON.stringify(result)); return result;
  } catch (error) {
    // Never expose arbitrary Azure error text, metadata, caller IDs or tokens.
    const code = error instanceof OwnerFailure ? error.code : error?.message === "owner_operation_busy" ? "busy" : "unavailable";
    const result = { status: "preflight_blocked", stage, code, calendarQueries: 0, cloudChanges: false, automaticRetry: false };
    log(JSON.stringify(result)); return result;
  }
}
if (require.main === module) main(process.argv.slice(2)).then(result => {
  if (result?.status === "preflight_blocked") process.exitCode = 1;
});
module.exports = { capabilityEvidence, inspect, main };