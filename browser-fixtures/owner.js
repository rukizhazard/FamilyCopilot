"use strict";
// Explicit separate port/process; never available via the live server.
const { setTimeout: delay } = require("node:timers/promises");
const { OwnerFailure } = require("../scripts/owner-calendar");
async function perform({ signal, record, scenario }) {
  try {
    await delay(scenario === "slow" ? 30000 : 150, undefined, { signal });
    if (["unavailable", "revoked"].includes(scenario)) throw new OwnerFailure(scenario);
    return { status: scenario === "empty" ? "empty" : "listed", count: scenario === "empty" ? 0 : 3,
      completeness: "unknown", ownership: "unverified", eventsRead: 0,
      calendars: scenario === "empty" ? [] : [
        { key: "11111111-1111-4111-8111-111111111111", name: "Sample main calendar" },
        { key: "22222222-2222-4222-8222-222222222222", name: "Sample shared calendar (ownership unverified)" },
        { key: "33333333-3333-4333-8333-333333333333", name: '<img src=x onerror=alert(1)> Synthetic & "calendar" ' + "LongLabel".repeat(20) }
      ] };
  } finally {
    record("cleanup_pending");
    if (scenario === "cleanup_failed") { record("cleanup_failed"); throw new OwnerFailure("cleanup_failed"); }
    record("workflow_disabled");
  }
}
module.exports = { perform };