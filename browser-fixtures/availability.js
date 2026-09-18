"use strict";
const { window: defaultWindow, unknown, validateWindow } = require("../owner/availability-core");
const { OwnerFailure } = require("../scripts/owner-calendar");
async function perform({ signal, record, scenario, window = defaultWindow }) {
  if (validateWindow(window) === false) throw new OwnerFailure("blocked");
  if (scenario === "slow") await new Promise(resolve => { if (signal.aborted) resolve(); else signal.addEventListener("abort", resolve, { once: true }); });
  if (scenario === "cleanup_failed") { record("cleanup_failed"); throw new OwnerFailure("cleanup_failed"); }
  record("workflow_disabled");
  const slots = Array.from({ length: window.slots }, (_, i) => ["free_or_elsewhere", "tentative", "busy", "oof"][i % 4]);
  return { window, checkedAt: "2026-09-15T01:00:00Z", people: [0, 1].map(person =>
    ["unavailable", "revoked"].includes(scenario) ? unknown(person, "unavailable", window) : scenario === "empty" ? unknown(person, "missing", window) : scenario === "partial" && person === 1 ? unknown(person, "unavailable", window) : { person, status: "checked", slots: [...slots] }) };
}
module.exports = { perform };