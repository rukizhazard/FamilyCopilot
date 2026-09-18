"use strict";

// Fresh non-calendar context for contract consumers. No domain state or IO.
function demoContext() {
  return {
    version: "familycopilot.chat.v1", sessionId: "demo-1", contextRevision: 1,
    referenceNow: "2026-09-18T04:00:00Z", timeZone: "Asia/Taipei", mode: "synthetic",
    preferences: {
      ages: [8], interests: [], interestBasis: "demo_fixture", preferredTeams: [],
      origin: { area: "Xinyi District, Taipei City", precision: "district", landmark: null },
      travelMode: null,
      constraints: { maxTravelMinutes: null, budget: null, setting: "any", excludedCategories: [] }
    },
    activityRange: { startDate: "2026-10-09", endDate: "2026-10-11", timeZone: "Asia/Taipei" },
    triggerState: "not_started"
  };
}

function activityRequest() {
  const context = demoContext();
  return {
    version: context.version, requestId: "request-1", generation: 1,
    contextRevision: context.contextRevision, referenceNow: context.referenceNow,
    range: context.activityRange, mode: context.mode,
    trigger: { kind: "demo_start", actionId: "action-1" }, preferences: context.preferences
  };
}

module.exports = Object.freeze({ demoContext, activityRequest });