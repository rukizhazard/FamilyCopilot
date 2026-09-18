"use strict";
// Read-only fixed metadata diagnostics. Never follow inputs/outputs links or
// print run identifiers, timestamps, labels, addresses, URLs or provider errors.
const { createBackend, preflight, requireOK, logicUrl } = require("./calendar-list");
const { requireContract } = require("./owner-calendar");
const { workflowId } = require("../infra/calendar-list");
const { isDeepStrictEqual } = require("node:util");

async function diagnose(backend) {
  try {
    const before = await preflight(backend);
    requireContract(requireOK(await backend.arm("GET", logicUrl(workflowId))), backend.caller, "Disabled");
    const runs = requireOK(await backend.arm("GET", `${logicUrl(workflowId, "/runs")}&$top=1`));
    const run = runs?.value?.[0];
    const report = { workflowDisabled: true, runFound: Boolean(run), latestRunSucceeded: run?.properties?.status === "Succeeded",
      latestRunFailed: run?.properties?.status === "Failed", latestRunRunning: run?.properties?.status === "Running" };
    if (run) {
      if (!/^[a-zA-Z0-9-]{1,100}$/.test(run.name || "")) throw new Error("invalid_metadata");
      const actions = requireOK(await backend.arm("GET", logicUrl(workflowId, `/runs/${run.name}/actions`)));
      for (const name of ["List_calendars", "Validate_list", "Owner_labels", "Summary", "Invalid_list", "Unavailable", "Invalid_projection"]) {
        const action = actions?.value?.find(a => a.name === name);
        report[`${name}_succeeded`] = action?.properties?.status === "Succeeded";
        report[`${name}_failed`] = action?.properties?.status === "Failed";
        report[`${name}_timedOut`] = action?.properties?.status === "TimedOut";
      }
      const changed = Date.parse(before.connection.properties?.changedTime);
      const start = Date.parse(run.properties?.startTime), end = Date.parse(run.properties?.endTime);
      report.connectionChangedDuringLatestRun = Number.isFinite(changed) && Number.isFinite(start) && changed >= start && changed <= end;
    }
    const after = await preflight(backend);
    report.connectionStableAcrossReads = isDeepStrictEqual(before.connection, after.connection);
    report.invitationStableAcrossReads = isDeepStrictEqual(before.invitation, after.invitation);
    // Exact allowlisted field comparisons, never arbitrary values or key names.
    for (const key of ["changedTime", "statuses", "testLinks", "overallStatus", "authenticatedUser", "displayName", "parameterValues", "nonSecretParameterValues"]) {
      report[`connection_${key}_stable`] = isDeepStrictEqual(before.connection.properties?.[key], after.connection.properties?.[key]);
    }
    return report;
  } finally { backend.clear(); }
}
if (require.main === module) {
  (async () => {
    if (process.argv.length !== 3 || process.argv[2] !== "--metadata-only") throw new Error("blocked");
    console.log(JSON.stringify(await diagnose(createBackend())));
  })().catch(() => { console.error(JSON.stringify({ diagnosticFailed: true })); process.exitCode = 1; });
}
module.exports = { diagnose };