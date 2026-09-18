"use strict";
// This entire process, its native CLI and ARM HTTP calls stay on Windows.
// Only fixed metadata reports cross back to WSL. No token/ID export or live mode.
const { execFile } = require("node:child_process");
const { promisify, isDeepStrictEqual } = require("node:util");
const { scope } = require("../infra/calendar-list");
const { OwnerFailure } = require("./owner-calendar");
const { main } = require("./child-calendar-preflight");
const cliPath = "C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\wbin\\az.cmd";
const allowed = [
  ["account", "show", "--subscription", scope.subscription, "--query", "{tenant:tenantId,state:state}"],
  ["ad", "signed-in-user", "show", "--query", "id"],
  ["account", "get-access-token", "--subscription", scope.subscription, "--resource", scope.audience, "--query", "accessToken"]
];
function cliScript(args) {
  if (!allowed.some(value => isDeepStrictEqual(value, args))) throw new OwnerFailure("blocked");
  const quoted = [...args, "--only-show-errors", "--output", "json"].map(value => `'${value.replaceAll("'", "''")}'`).join(",");
  return `$ErrorActionPreference='Stop'; $arguments=@(${quoted}); & '${cliPath}' @arguments; exit $LASTEXITCODE`;
}
async function nativeRead(args, signal) {
  if (process.platform !== "win32") throw new OwnerFailure("blocked");
  try {
    const { stdout } = await promisify(execFile)("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(cliScript(args), "utf16le").toString("base64")], {
      encoding: "utf8", timeout: 60000, maxBuffer: 1024 * 1024, signal, windowsHide: true,
      env: { ...process.env, AZURE_EXTENSION_USE_DYNAMIC_INSTALL: "no", AZURE_CORE_COLLECT_TELEMETRY: "false", AZURE_CORE_ENABLE_LOG_FILE: "false" }
    });
    return JSON.parse(stdout.replace(/^\uFEFF/, ""));
  } catch { throw new OwnerFailure(signal?.aborted ? "cancelled" : "unavailable"); }
}
if (require.main === module) (async () => {
  if (process.platform !== "win32" || process.argv.length !== 3 || !["--runtime-only", "--metadata-only"].includes(process.argv[2]) || /^\//.test(process.env.AZURE_CONFIG_DIR || "")) throw new OwnerFailure("blocked");
  if (process.argv[2] === "--runtime-only") { console.log(JSON.stringify({ status: "native_runtime_ready", nativeWindows: true, nodeMajor: Number(process.versions.node.split(".")[0]), calendarQueries: 0, cloudChanges: false })); return; }
  const result = await main(["--metadata-only"], { read: nativeRead });
  if (result.status === "preflight_blocked") process.exitCode = 1;
})().catch(() => { console.log(JSON.stringify({ status: "preflight_blocked", stage: "native_runtime", code: "unavailable", calendarQueries: 0, cloudChanges: false, automaticRetry: false })); process.exitCode = 1; });
module.exports = { cliScript, nativeRead };