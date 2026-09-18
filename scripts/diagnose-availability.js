"use strict";
// Fixed management metadata only. Never follow payload links, echo provider
// messages, or print run IDs, timestamps, actors or availability values.
const { availabilityBackend, preserved, requireContract } = require("./availability");
const { requireOK, logicUrl } = require("./calendar-list");
const { preservedAfterLoad } = require("./owner-calendar");
const { withOwnerOperation } = require("./owner-operation");
const { workflowId, buildAvailability, buildOctoberAvailability, buildRepairedAvailability, buildLegacyAvailability } = require("../infra/availability");
const statuses = new Set(["Succeeded", "Failed", "Skipped", "TimedOut", "Running", "Cancelled", "Aborted"]);
const codes = new Set(["BadRequest", "Unauthorized", "Forbidden", "NotFound", "TooManyRequests", "InternalServerError", "BadGateway", "InvalidTemplate", "ValidationFailed", "InvalidContent", "InvalidJSON", "InvalidSchema", "InvalidJsonSchema", "InvalidJSONSchema", "InvalidSchemaValidation", "InvalidRegex", "InvalidRegularExpression", "InvalidSchemaPattern", "JsonSchemaValidationFailed", "SchemaValidationFailed", "ExpressionEvaluationFailed", "InvalidParameters", "InvalidParameter", "ParameterNotFound", "InvalidType", "ActionFailed", "ActionSkipped", "OK"]);
function errorEvidence(properties) {
  // Inspect error metadata in memory only. Never return any substring of a
  // service message, even after redaction: only fixed, tested classifications.
  const error = properties?.error;
  const message = typeof error?.message === "string" ? error.message.slice(0, 16384) : "";
  const rules = {
    protectedMessage: /secure|redacted|sensitive/i,
    schemaInvalid: /schema.*(?:invalid|not valid)|(?:invalid|not valid).*schema/i,
    patternFailure: /pattern|regular expression|regex/i,
    patternUnsupported: /(?:pattern|regular expression|regex).*not supported|unsupported.*(?:pattern|regular expression|regex)/i,
    patternPropertyNamed: /['"]pattern['"]/i,
    propertyNotSupported: /propert(?:y|ies).*not supported|not supported.*propert(?:y|ies)/i,
    patternMismatch: /does not match (?:regex|pattern)|not matching.*pattern/i,
    invalidPattern: /invalid.*(?:pattern|regular expression|regex)|(?:pattern|regular expression|regex).*invalid/i,
    rangeFailure: /range|subtraction|character class/i,
    typeMismatch: /invalid type|type mismatch|expected .* (?:but|got)|property selection is not supported on values of type/i,
    missingProperty: /property .*doesn't exist|property .*does not exist|required propert/i,
    parameterFailure: /parameter/i,
    expressionFailure: /template language|expression|template action/i,
    schemaValidationFailure: /schema validation failed|validation errors|does not match/i
  };
  return { messagePresent: !!message, ...Object.fromEntries(Object.entries(rules).map(([key, rule]) => [key, rule.test(message)])),
    detailCodes: Array.isArray(error?.details) ? error.details.slice(0, 8).map(e => codes.has(e?.code) ? e.code : "OtherOrAbsent") : [] };
}
async function diagnose(backend) {
  try {
    const before = await preserved(backend);
    const initial = requireOK(await backend.arm("GET", logicUrl(workflowId)));
    const factory = initial?.tags?.contract === "bounded-availability-v1" ? buildLegacyAvailability : initial?.tags?.contract === "bounded-availability-v2" ? buildRepairedAvailability : initial?.tags?.contract === "bounded-availability-v5" ? buildOctoberAvailability : buildAvailability;
    requireContract(initial, backend.caller, "Disabled", factory);
    const run = requireOK(await backend.arm("GET", `${logicUrl(workflowId, "/runs")}&$top=1`))?.value?.[0];
    const report = { workflowDisabled: true, runFound: !!run, runStatus: statuses.has(run?.properties?.status) ? run.properties.status : "Unknown", actions: {} };
    if (run) {
      if (!/^[a-zA-Z0-9-]{1,100}$/.test(run.name || "")) throw new Error("invalid_metadata");
      const actions = requireOK(await backend.arm("GET", logicUrl(workflowId, `/runs/${run.name}/actions`)))?.value;
      if (!Array.isArray(actions) || actions.length > 30) throw new Error("invalid_metadata");
      for (const name of Object.keys(buildAvailability(backend.caller).properties.definition.actions)) {
        const p = actions.find(a => a.name === name)?.properties;
        report.actions[name] = { status: statuses.has(p?.status) ? p.status : "Unknown", code: codes.has(p?.code) ? p.code : "OtherOrAbsent",
          errorCode: codes.has(p?.error?.code) ? p.error.code : "OtherOrAbsent",
          ...(p?.status === "Failed" ? { evidence: errorEvidence(p) } : {}) };
      }
    }
    requireContract(requireOK(await backend.arm("GET", logicUrl(workflowId))), backend.caller, "Disabled", factory);
    report.preservedResourcesUnchanged = preservedAfterLoad(before, await preserved(backend));
    return report;
  } finally { backend.clear(); }
}
if (require.main === module) (async () => {
  if (process.argv.length !== 3 || process.argv[2] !== "--metadata-only") throw new Error("blocked");
  console.log(JSON.stringify(await withOwnerOperation(async () => diagnose(await availabilityBackend(undefined, "diagnostic")))));
})().catch(() => { console.error(JSON.stringify({ status: "metadata_diagnostic_failed", queryMade: false })); process.exitCode = 1; });
module.exports = { diagnose, errorEvidence };