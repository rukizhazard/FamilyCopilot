"use strict";
// Native-only credential reader. Never export its output to the WSL parent.
const { spawn, execFile } = require("node:child_process");
const { promisify, isDeepStrictEqual } = require("node:util");
const fs = require("node:fs/promises");
const os = require("node:os"), path = require("node:path");
const { scope } = require("../infra/calendar-list");
const { OwnerFailure } = require("./owner-calendar");
const powershell = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
const cliPath = "C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\wbin\\az.cmd";
const commands = Object.freeze([
  ["account", "show", "--subscription", scope.subscription, "--query", "{tenant:tenantId,state:state}"],
  ["ad", "signed-in-user", "show", "--query", "id"],
  ["account", "get-access-token", "--subscription", scope.subscription, "--resource", scope.audience, "--query", "accessToken"]
].map(Object.freeze));
function cliCommand(args) {
  if (!commands.some(command => isDeepStrictEqual(command, args))) throw new OwnerFailure("blocked");
  // All arguments come from the fixed list above, never from CLI/browser text.
  const quoted = [...args, "--only-show-errors", "--output", "json"].map(s => `'${s.replaceAll("'", "''")}'`).join(",");
  return `$ErrorActionPreference='Stop'; $arguments=@(${quoted}); & '${cliPath}' @arguments; exit $LASTEXITCODE`;
}
async function killNativeTree(pid, execute = promisify(execFile), executable = "C:\\Windows\\System32\\taskkill.exe", env) {
  if (!Number.isSafeInteger(pid) || pid <= 0) throw new OwnerFailure("cleanup_failed");
  // Only a PID belonging to this invocation, never image-name or wildcard kills.
  try { await execute(executable, ["/PID", String(pid), "/T", "/F"], { windowsHide: true, timeout: 15000, maxBuffer: 4096, ...(env ? { env } : {}) }); }
  catch { throw new OwnerFailure("cleanup_failed"); }
}
function runCommand(command, env, { launch = spawn, killTree = killNativeTree, timeout = 60000, maxBytes = 65536 } = {}) {
  return new Promise((resolve, reject) => {
    let child;
    try { child = launch(powershell, ["-NoProfile", "-NonInteractive", "-Command", command], { env, windowsHide: true, shell: false, stdio: ["ignore", "pipe", "pipe"] }); }
    catch { reject(new OwnerFailure("unavailable")); return; }
    let bytes = 0, output = "", failed = false, termination;
    const terminate = () => {
      failed = true; output = "";
      if (!termination) termination = killTree(child.pid).then(() => true, () => false);
    };
    const timer = setTimeout(terminate, timeout);
    child.stdout.on("data", chunk => {
      bytes += chunk.length;
      if (bytes > maxBytes) terminate();
      else if (!failed) output += chunk.toString("utf8");
    });
    // Drain without retaining or forwarding CLI error text (which may contain IDs).
    child.stderr.on("data", chunk => { bytes += chunk.length; if (bytes > maxBytes) terminate(); });
    child.on("error", () => { failed = true; });
    child.on("close", async code => {
      clearTimeout(timer);
      const reaped = termination ? await termination : true;
      if (failed || code !== 0 || !reaped) { output = ""; reject(new OwnerFailure("unavailable")); return; }
      resolve(output); output = "";
    });
    // Cancellation does NOT kill a PowerShell parent and abandon az descendants.
    // The caller waits for this command (60s bound + owned-tree reaping), then fences.
  });
}
async function createNativeReader({ platform = process.platform, env = process.env, filesystem = fs,
  temp = os.tmpdir(), run = runCommand } = {}) {
  if (platform !== "win32" || env.AZURE_CONFIG_DIR && !/^[A-Za-z]:\\/.test(env.AZURE_CONFIG_DIR)) throw new OwnerFailure("blocked");
  const directory = await filesystem.mkdtemp(path.join(temp, "familycopilot-az-extensions-"));
  // One EMPTY disposable extensions directory per operation. The native auth
  // directory is inherited unchanged; no WSL config, token copying or permission edits.
  const nativeEnv = { ...env, AZURE_EXTENSION_DIR: directory, AZURE_EXTENSION_USE_DYNAMIC_INSTALL: "no",
    AZURE_CORE_COLLECT_TELEMETRY: "false", AZURE_CORE_ENABLE_LOG_FILE: "false", AZURE_LOGGING_ENABLE_LOG_FILE: "false" };
  let closed = false, active = false;
  return {
    async read(args, signal) {
      const command = cliCommand(args);
      if (closed || active || signal?.aborted) throw new OwnerFailure(signal?.aborted ? "cancelled" : "blocked");
      active = true;
      let text;
      try {
        text = await run(command, nativeEnv);
        if (signal?.aborted) throw new OwnerFailure("cancelled");
        return JSON.parse(text.replace(/^\uFEFF/, ""));
      } catch { throw new OwnerFailure(signal?.aborted ? "cancelled" : "unavailable"); }
      finally { text = undefined; active = false; }
    },
    async dispose() {
      if (active) throw new OwnerFailure("cleanup_failed");
      closed = true;
      // Never recursively delete an unexpected directory or auth files.
      await filesystem.rmdir(directory);
    }
  };
}
module.exports = { commands, cliCommand, createNativeReader, runCommand, killNativeTree };