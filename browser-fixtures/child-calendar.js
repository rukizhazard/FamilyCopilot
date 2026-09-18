"use strict";
const C = require("../owner/child-calendar-core");
const { OwnerFailure } = require("../scripts/owner-calendar");
async function perform({ action, disclosure, scenario, signal, record }) {
  if (scenario === "slow") await new Promise(resolve => signal.addEventListener("abort", resolve, { once: true }));
  record(scenario === "cleanup_failed" ? "cleanup_failed" : "workflow_disabled");
  if (["unavailable", "revoked", "cleanup_failed"].includes(scenario)) throw new OwnerFailure(scenario);
  if (action === "find") return { calendars: scenario === "empty" ? [] : [{ id: "SYNTHETIC-ONLY-ID", name: "Fictional shared source <not real>" }], partial: true };
  return { contract: C.contract, window: C.window, checkedAt: "2026-09-17T00:00:00Z", partial: scenario === "partial", events: scenario === "empty" ? [] : [
    { title: disclosure === "details" ? "Fictional art club <sample>" : "Busy", redacted: disclosure !== "details", start: "2026-10-09T10:00:00+08:00", end: "2026-10-09T11:00:00+08:00", allDay: false, status: "scheduled", kind: "occurrence" },
    { title: "Busy", redacted: true, start: "2026-10-10T00:00:00+08:00", end: "2026-10-11T00:00:00+08:00", allDay: true, status: "unknown", kind: "unknown" },
    { title: "Busy", redacted: true, start: "2026-10-09T10:30:00+08:00", end: "2026-10-09T11:30:00+08:00", allDay: false, status: "cancelled", kind: "exception" }
  ] };
}
module.exports = { perform };