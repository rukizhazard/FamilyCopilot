"use strict";
// Explicit local-only activation. No Azure calls, calendar queries or snapshot I/O.
const fs = require("node:fs"), path = require("node:path"), readline = require("node:readline");
const { execFileSync, spawn } = require("node:child_process");
const { once } = require("node:events");
const { withOwnerOperation } = require("./owner-operation");
const { inspectLocalOwner } = require("./owner-local-status");
const root = path.resolve(__dirname, "..");
const listeners = () => [...execFileSync("ss", ["-ltnp", "sport = :8002"], { encoding: "utf8", timeout: 10000 }).matchAll(/pid=(\d+)/g)].map(m => Number(m[1]));
function identity(pid) {
  const args = fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0").filter(Boolean);
  if (fs.readlinkSync(`/proc/${pid}/cwd`) !== root || args.length !== 2 || path.basename(args[0]) !== "node" || args[1] !== "scripts/serve-owner.js") throw Error("blocked");
  // Do not silently switch an opted-in native-auth server back to the WSL task.
  const execution = fs.readFileSync(`/proc/${pid}/environ`, "utf8").split("\0").find(value => value.startsWith("FAMILYCOPILOT_OWNER_EXECUTION="));
  if (execution && execution !== "FAMILYCOPILOT_OWNER_EXECUTION=wsl") throw Error("blocked");
  return fs.readFileSync(`/proc/${pid}/stat`, "utf8").split(") ")[1].split(" ")[19];
}
async function stop(pid) {
  const waiter = spawn("/usr/bin/pidwait", ["-p", String(pid)], { stdio: "ignore", timeout: 15000 });
  const done = once(waiter, "close");
  await once(waiter, "spawn"); process.kill(pid, "SIGTERM");
  const [code] = await done;
  if (code !== 0) throw Error("stop_unconfirmed");
}
async function waitForTask() {
  const rl = readline.createInterface({ input: process.stdin });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { rl.close(); reject(Error("task_start_timeout")); }, 120000);
      rl.once("line", line => { clearTimeout(timer); line === "verify" ? resolve() : reject(Error("blocked")); });
    });
  } finally { rl.close(); }
}
async function assets() {
  // Only static activity assets, no owner page or public-source search.
  for (const resource of ["/shared/basketball-teams.js", "/activity-preview/basketball-ui.js"]) {
    const response = await fetch(`http://127.0.0.1:8002${resource}`, { redirect: "error", signal: AbortSignal.timeout(5000) });
    if (!response.ok || await response.text() !== fs.readFileSync(path.join(root, resource.slice(1)), "utf8")) throw Error("assets_unconfirmed");
  }
}
const safe = status => status.safeIdle && status.dateProtocol && status.savedViewProtocol && status.octoberProtocol;
async function activate(dependencies = {}) {
  const d = { lock: withOwnerOperation, listeners, identity, inspect: inspectLocalOwner, stop, waitForTask, assets,
    report: value => console.log(JSON.stringify(value)), ...dependencies };
  return d.lock(async () => {
    const before = d.listeners();
    if (before.length > 1) throw Error("unexpected_listener_count");
    const pid = before[0];
    if (pid) {
      const start = d.identity(pid);
      if (!safe(await d.inspect())) throw Error("not_safe_idle");
      if (d.listeners().join() !== String(pid) || d.identity(pid) !== start) throw Error("identity_changed");
      await d.stop(pid);
    } else {
      // Resume after a separately confirmed stop, never kill an additional PID.
      try { await d.inspect(); throw Error("unexpected_status_response"); }
      catch (error) { if (error.code !== "ECONNREFUSED") throw error; }
    }
    if (d.listeners().length) throw Error("stop_unconfirmed");
    d.report({ stage: "await_existing_task_start", operationLockHeld: true, stoppedPid: pid || null, alreadyStopped: !pid, forceKill: false });
    await d.waitForTask();
    const after = d.listeners();
    if (after.length !== 1) throw Error("unexpected_listener_count");
    d.identity(after[0]);
    const status = await d.inspect();
    if (!safe(status)) throw Error("activation_unconfirmed");
    await d.assets();
    return { stage: "activated", pid: after[0], ...status, teamContract: require("../shared/basketball-teams").contract,
      staticAssetsMatch: true, calendarQueries: 0, privateCacheAccess: false, cloudRequests: 0 };
  });
}
if (require.main === module) {
  if (process.argv.length !== 3 || process.argv[2] !== "--approved-local-restart") {
    console.error("Explicit approval required for an idle local restart; no service changed."); process.exitCode = 1;
  } else activate().then(value => console.log(JSON.stringify(value))).catch(error => {
    const known = ["blocked", "owner_operation_busy", "stop_unconfirmed", "task_start_timeout", "assets_unconfirmed", "unexpected_listener_count", "not_safe_idle", "identity_changed", "activation_unconfirmed", "unexpected_status_response"];
    console.error(JSON.stringify({ status: "activation_unconfirmed", reason: known.includes(error.message) ? error.message : "local_check_failed", automaticRetry: false, forceKill: false })); process.exitCode = 1;
  });
}
module.exports = { activate };