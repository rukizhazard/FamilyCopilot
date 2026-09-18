"use strict";
// Approved local execution switch only. Preserve the existing snapshot and
// cloud definitions. Keep the cooperative lock through native preflight and
// the existing-task handoff. Never issue a calendar request here.
const fs = require("node:fs");
const { activate } = require("./activate-activities");
const { identity } = require("./activate-october");
const { withOwnerOperation } = require("./owner-operation");
const { createNativeAdapter } = require("./windows-owner");
const { createChildNativeAdapter } = require("./windows-child");
const childProtocol = require("./windows-child-protocol");
const { inspectLocalOwner } = require("./owner-local-status");
const { contract: childContract } = require("../owner/child-calendar-core");
function execution(pid) {
  const value = fs.readFileSync(`/proc/${pid}/environ`, "utf8").split("\0")
    .find(item => item.startsWith("FAMILYCOPILOT_OWNER_EXECUTION="));
  return value ? value.slice("FAMILYCOPILOT_OWNER_EXECUTION=".length) : "wsl";
}
function childMode(pid) {
  // Extract only this non-secret opt-in. Never return/log the environment.
  const value = fs.readFileSync(`/proc/${pid}/environ`, "utf8").split("\0")
    .find(item => item.startsWith("FAMILYCOPILOT_CHILD_ENABLED="));
  return value ? value.slice("FAMILYCOPILOT_CHILD_ENABLED=".length) : undefined;
}
async function activateNative(dependencies = {}) {
  const d = { activate, identity, execution, childMode, inspect: inspectLocalOwner, enableChild: false, lock: withOwnerOperation,
    preflight: () => createNativeAdapter({ lock: operation => operation() }).status(),
    childPreflight: () => createChildNativeAdapter({ lock: operation => operation() }).status(), ...dependencies };
  if (typeof d.enableChild !== "boolean") throw Error("blocked");
  return d.lock(async () => {
    await d.preflight();
    if (d.enableChild) {
      const { execution, extensionsRemoved, automaticRetry, ...report } = await d.childPreflight();
      childProtocol.validateReport(report, "status");
      if (execution !== childProtocol.protocol || extensionsRemoved !== true || automaticRetry !== false) throw Error("blocked");
    }
    let stopped = false;
    const result = await d.activate({
      lock: operation => operation(),
      identity: pid => {
        const start = d.identity(pid), mode = d.execution(pid);
        if (stopped ? mode !== "windows-native" : !["wsl", "windows-native"].includes(mode)) throw Error("blocked");
        if (d.enableChild) {
          const child = d.childMode(pid);
          if (stopped ? child !== childContract : child !== undefined && child !== childContract) throw Error("blocked");
        }
        return start;
      },
      inspect: async () => {
        const status = await d.inspect();
        if (stopped && d.enableChild && (status.childProtocol !== true || status.childSavedProtocol !== true)) throw Error("activation_unconfirmed");
        return status;
      },
      report: value => { stopped = true; (dependencies.report || console.log)(JSON.stringify(value)); },
      ...(dependencies.activation || {})
    });
    // The delegated local activator makes no cloud requests, but our native
    // preflight does read Azure metadata. Do not inherit its zero-request claim.
    const { cloudRequests, ...local } = result;
    return { ...local, execution: "windows-native-v1", cloudMetadataVerified: true, cloudChanges: false,
      ...(d.enableChild ? { childExecution: childProtocol.protocol, childMetadataVerified: true, runtimeVerified: false } : {}) };
  });
}
if (require.main === module) {
  if (process.argv.length !== 3 || !["--approved-local-restart", "--approved-local-restart-with-child"].includes(process.argv[2])) {
    console.error("Explicit local restart approval required."); process.exitCode = 1;
  } else activateNative({ enableChild: process.argv[2] === "--approved-local-restart-with-child" }).then(result => console.log(JSON.stringify({ ...result, execution: "windows-native-v1" })))
    .catch(() => { console.error(JSON.stringify({ status: "activation_unconfirmed", automaticRetry: false, forceKill: false })); process.exitCode = 1; });
}
module.exports = { activateNative };