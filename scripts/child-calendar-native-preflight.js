"use strict";
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const path = require("node:path");
const { withOwnerOperation } = require("./owner-operation");
const execute = promisify(execFile);
function safeReport(text) {
  if (typeof text !== "string" || Buffer.byteLength(text) > 16384) throw Error();
  const data = JSON.parse(text.trim().replace(/^\uFEFF/, ""));
  const common = ["status", "calendarQueries", "cloudChanges"];
  const fields = {
    preflight_blocked: ["stage", "code", "automaticRetry"],
    native_runtime_ready: ["nativeWindows", "nodeMajor"],
    metadata_inspected: ["automaticRetry", "httpGetCalendarCandidate", "nativeViewCandidate", "runtimeAuthorizationVerified", "sharedCalendarVisibilityVerified", "selectSupportVerified", "availabilityV5Disabled", "ownerV2Disabled", "sasDisabled", "preservedResourcesUnchanged"]
  };
  if (!data || !Object.hasOwn(fields, data.status) || Object.keys(data).sort().join() !== [...common, ...fields[data.status]].sort().join() || data.calendarQueries !== 0 || data.cloudChanges !== false) throw Error();
  if (data.status === "preflight_blocked") {
    if (!["arguments", "operation_lock", "credentials", "account", "signed_in_user", "credential", "preserved_before", "connector_metadata", "preserved_after", "native_runtime"].includes(data.stage) || !["blocked", "busy", "unavailable", "expired", "contract_drift"].includes(data.code) || data.automaticRetry !== false) throw Error();
  } else if (data.status === "native_runtime_ready") {
    if (data.nativeWindows !== true || !Number.isInteger(data.nodeMajor) || data.nodeMajor < 18 || data.nodeMajor > 100) throw Error();
  } else {
    if (["httpGetCalendarCandidate", "nativeViewCandidate"].some(k => typeof data[k] !== "boolean") || ["automaticRetry", "runtimeAuthorizationVerified", "sharedCalendarVisibilityVerified", "selectSupportVerified"].some(k => data[k] !== false) || ["availabilityV5Disabled", "ownerV2Disabled", "sasDisabled", "preservedResourcesUnchanged"].some(k => data[k] !== true)) throw Error();
  }
  return data;
}
async function run(args) {
  if (process.platform !== "linux" || args.length !== 1 || !["--metadata-only", "--runtime-only"].includes(args[0])) throw Error();
  return withOwnerOperation(async () => {
    const { stdout } = await execute("wslpath", ["-w", path.join(__dirname, "child-calendar-native.ps1")], { timeout: 10000, maxBuffer: 4096 });
    let output, failed = false;
    try {
      output = await execute("/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe", ["-NoProfile", "-NonInteractive", "-File", stdout.trim(), "-Mode", args[0]], { timeout: 300000, maxBuffer: 16384 });
    } catch (error) { failed = true; output = { stdout: error.stdout || "" }; }
    const report = safeReport(output.stdout);
    if (failed && report.status !== "preflight_blocked") throw Error();
    return report;
  });
}
if (require.main === module) run(process.argv.slice(2)).then(result => { console.log(JSON.stringify(result)); if (result.status === "preflight_blocked") process.exitCode = 1; }).catch(error => {
  console.log(JSON.stringify({ status: "preflight_blocked", stage: "native_runtime", code: error?.message === "owner_operation_busy" ? "busy" : "unavailable", calendarQueries: 0, cloudChanges: false, automaticRetry: false })); process.exitCode = 1;
});
module.exports = { run, safeReport };