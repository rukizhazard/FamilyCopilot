"use strict";

// Feasibility only. No mailbox input, connector invocation, run history or writes.
const { isDeepStrictEqual } = require("node:util");
const { scope, apiId, workflowId, invitationId, connectionId } = require("../infra/calendar-list");
const { ownerBackend, requireContract } = require("./owner-calendar");
const { preflight, requireOK, logicUrl } = require("./calendar-list");
const { withOwnerOperation } = require("./owner-operation");

const swaggerUrl = `${apiId}?api-version=2016-06-01&export=true`;
const httpPath = "/{connectionId}/codeless/httprequest";
const meetingPath = "/{connectionId}/codeless/beta/me/findMeetingTimes";
const reads = new Set([swaggerUrl, logicUrl(workflowId), logicUrl(invitationId),
  `${connectionId}?api-version=2016-06-01`,
  `/subscriptions/${scope.subscription}/resourceGroups/${scope.group}?api-version=2021-04-01`]);

function capabilityEvidence(swagger) {
  const http = swagger?.paths?.[httpPath]?.post;
  const meeting = swagger?.paths?.[meetingPath]?.post;
  const parameters = Array.isArray(http?.parameters) ? http.parameters : [];
  const parameter = name => parameters.filter(p => p?.name === name);
  const has = (name, predicate) => parameter(name).length === 1 && predicate(parameter(name)[0]);
  // The exported Swagger documents the segment rule as prose, not a URI enum.
  // Unknown wording yields false, never a guessed permission or arbitrary output.
  const description = typeof http?.description === "string" ? http.description : "";
  const segments = /1st seg(?:e)?ment:\s*([^\n]+?)\s+2nd segment:\s*([^\n.]+)/i.exec(description);
  const httpOperationPresent = http?.operationId === "HttpRequest" && http.deprecated === false;
  const httpUriHeader = has("Uri", p => p.in === "header" && p.type === "string" && p.required === true);
  const httpPostAllowed = has("Method", p => p.in === "header" && p.type === "string" &&
    p.required === true && Array.isArray(p.enum) && p.enum.includes("POST"));
  const httpBinaryBody = has("Body", p => p.in === "body" && p.schema?.type === "string" && p.schema.format === "binary");
  const httpJsonContentType = has("ContentType", p => p.in === "header" && p.type === "string" && p.default === "application/json");
  const httpMeCalendarDocumented = Boolean(segments && segments[1].split(/,\s*/).includes("/me") &&
    segments[2].split(/,\s*/).map(s => s.trim()).includes("calendar"));
  const meetingParameters = Array.isArray(meeting?.parameters) ? meeting.parameters : [];
  const meetingBody = meetingParameters.find(p => p?.name === "body" && p.in === "body")?.schema?.properties;
  const findMeetingTimesV2Present = meeting?.operationId === "FindMeetingTimes_V2" && meeting.deprecated === false;
  const findMeetingTimesBoundedInputs = meetingBody?.RequiredAttendees?.type === "string" &&
    ["Start", "End"].every(key => meetingBody?.[key]?.format === "date-time") && meetingBody?.MaxCandidates?.type === "integer";
  const findMeetingTimesSuggestionsOutput = Boolean(meeting?.responses?.["200"]?.schema?.properties?.meetingTimeSuggestions);
  return {
    httpOperationPresent, httpUriHeader, httpPostAllowed, httpBinaryBody, httpJsonContentType, httpMeCalendarDocumented,
    getScheduleRouteCandidate: httpOperationPresent && httpUriHeader && httpPostAllowed && httpBinaryBody && httpJsonContentType && httpMeCalendarDocumented,
    findMeetingTimesV2Present, findMeetingTimesBoundedInputs, findMeetingTimesSuggestionsOutput,
    runtimeAuthorizationVerified: false
  };
}

async function inspectCapability(backend) {
  // Expose only the exact metadata GETs to preflight; never pass invoke through.
  const reader = { caller: backend.caller, async arm(method, id, body, headers) {
    if (method !== "GET" || !reads.has(id) || body !== undefined || headers !== undefined) throw new Error("blocked");
    return backend.arm("GET", id);
  } };
  try {
    const before = await preflight(reader);
    const workflow = requireOK(await reader.arm("GET", logicUrl(workflowId)));
    requireContract(workflow, reader.caller, "Disabled");
    const evidence = capabilityEvidence(requireOK(await reader.arm("GET", swaggerUrl)));
    const after = await preflight(reader);
    const final = requireOK(await reader.arm("GET", logicUrl(workflowId)));
    requireContract(final, reader.caller, "Disabled");
    if (!isDeepStrictEqual(before, after) || !isDeepStrictEqual(workflow, final)) throw new Error("metadata_drift");
    return { metadataOnly: true, ...evidence, ownerV2Disabled: true, ownerSasDisabled: true,
      connectionConnected: true, invitationDisabled: true, invitationSasDisabled: true, invitationDeliveryOff: true,
      resourcesStableAcrossReads: true, calendarRequestMade: false, cloudChangesMade: false };
  } finally { backend.clear(); }
}

async function main(args, { makeBackend = () => ownerBackend(undefined, undefined, undefined, "status"),
  lock = withOwnerOperation, log = console.log } = {}) {
  if (args.length !== 1 || !["--help", "--metadata-only"].includes(args[0])) throw new Error("blocked");
  if (args[0] === "--help") {
    log("Usage: node scripts/availability-capability.js --metadata-only|--help\nFixed approved Azure scope, metadata GETs only. No calendar queries, addresses, dates, deployment, invocation or retry. Output is boolean evidence, not runtime authorization.");
    return;
  }
  // Same local exclusion as owner Load/update, acquired before credentials.
  const report = await lock(async () => inspectCapability(await makeBackend()));
  log(JSON.stringify(report));
  return report;
}
if (require.main === module) main(process.argv.slice(2)).catch(() => {
  console.error(JSON.stringify({ capabilityCheckFailed: true, calendarRequestMade: false, cloudChangesMade: false, automaticRetry: false }));
  process.exitCode = 1;
});
module.exports = { capabilityEvidence, inspectCapability, main };