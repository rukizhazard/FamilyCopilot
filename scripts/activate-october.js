"use strict";
// Operator-only status/metadata activation. Never read a snapshot, query a
// calendar, enable a workflow, or stop anything except the exact idle owner PID.
const fs = require("node:fs"), path = require("node:path"), readline = require("node:readline");
const { execFileSync, spawn } = require("node:child_process");
const { once } = require("node:events");
const { withOwnerOperation } = require("./owner-operation");
const { inspectLocalOwner } = require("./owner-local-status");
const { availabilityBackend, preserved, requireContract } = require("./availability");
const { requireOK, logicUrl } = require("./calendar-list");
const { workflowId } = require("../infra/availability");
const root = path.resolve(__dirname, "..");
const listeners = () => [...execFileSync("ss", ["-ltnp", "sport = :8002"], { encoding: "utf8", timeout: 10000 }).matchAll(/pid=(\d+)/g)].map(m => Number(m[1]));
function identity(pid) {
  const args = fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0").filter(Boolean);
  if (fs.readlinkSync(`/proc/${pid}/cwd`) !== root || args.length !== 2 || path.basename(args[0]) !== "node" || args[1] !== "scripts/serve-owner.js") throw Error("unexpected_identity");
  return fs.readFileSync(`/proc/${pid}/stat`, "utf8").split(") ")[1].split(" ")[19];
}
async function cloudDisabled() {
  const b = await availabilityBackend(undefined, "status");
  try {
    await preserved(b);
    requireContract(requireOK(await b.arm("GET", logicUrl(workflowId))), b.caller, "Disabled");
  } finally { b.clear(); }
}
async function activate() {
  return withOwnerOperation(async () => {
    await cloudDisabled(); // Refuse to activate local October code on other cloud state.
    const ids = listeners();
    if (ids.length !== 1) throw Error("unexpected_listener_count");
    const pid = ids[0], start = identity(pid), before = await inspectLocalOwner();
    if (!before.safeIdle || !before.dateProtocol || !before.savedViewProtocol) throw Error("not_safe_idle");
    if (listeners().join() !== String(pid) || identity(pid) !== start) throw Error("identity_changed");
    console.log(JSON.stringify({ stage: "before", ...before, cloudContract: "bounded-availability-v5", workflowDisabled: true, sasDisabled: true }));
    const waiter = spawn("/usr/bin/pidwait", ["-p", String(pid)], { stdio: "ignore", timeout: 15000 });
    const done = once(waiter, "close"); await once(waiter, "spawn"); process.kill(pid, "SIGTERM");
    const [code] = await done;
    if (code !== 0 || listeners().length) throw Error("graceful_stop_unconfirmed");
    console.log(JSON.stringify({ stage: "await_existing_task_start", operationLockHeld: true, ownerStopped: true, forceKill: false }));
    const rl = readline.createInterface({ input: process.stdin });
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(Error("task_start_timeout")), 120000);
        rl.once("line", line => { clearTimeout(timer); line === "verify" ? resolve() : reject(Error("invalid_control")); });
      });
      const current = listeners(); if (current.length !== 1) throw Error("unexpected_listener_count");
      identity(current[0]);
      const after = await inspectLocalOwner();
      if (!after.safeIdle || !after.dateProtocol || !after.savedViewProtocol || !after.octoberProtocol) throw Error("activation_unconfirmed");
      return { stage: "activated", ...after, cloudContract: "bounded-availability-v5", statusOnly: true, calendarQueries: 0, privateCacheAccess: false };
    } finally { rl.close(); }
  });
}
if (require.main === module) {
  if (process.argv.length !== 2) { console.error(JSON.stringify({ status: "blocked" })); process.exitCode = 1; }
  else activate().then(result => console.log(JSON.stringify(result))).catch(() => {
    console.error(JSON.stringify({ status: "activation_unconfirmed", automaticRetry: false, forceKill: false })); process.exitCode = 1;
  });
}
module.exports = { identity, activate };