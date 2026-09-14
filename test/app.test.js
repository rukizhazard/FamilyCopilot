const test = require("node:test");
const assert = require("node:assert/strict");
const { activities, filterActivities, safeHttpUrl, escapeHtml, canConfirmImport, calendarCommitment, resetState, availabilityMessage } = require("../app.js");

test("supported sample filters narrow local fixtures", () => {
  assert.deepEqual(filterActivities(activities, { age:"7-10", interest:"science", date:"2026-06-20", budget:"low" }).map(x => x.id), ["science"]);
  assert.equal(filterActivities(activities, { age:"9-13", interest:"science", date:"all", budget:"all" }).length, 0);
});
test("only http and https URLs are eligible for display as links", () => {
  assert.equal(safeHttpUrl("javascript:alert(1)"), null);
  assert.equal(safeHttpUrl("data:text/html,nope"), null);
  assert.equal(safeHttpUrl("https://mock.example.test/night-lab"), "https://mock.example.test/night-lab");
});
test("pasted URL text is safely escaped before rendering", () => {
  assert.equal(escapeHtml('<img src=x onerror=alert(1)>'), "&lt;img src=x onerror=alert(1)&gt;");
});
test("sample loading requires a selection and guardian attestation", () => {
  assert.equal(canConfirmImport([], true), false);
  assert.equal(canConfirmImport(["alex"], false), false);
  assert.equal(canConfirmImport(["alex"], true), true);
});
test("disclosure redacts sample event details until confirmed and reset restores no-calendar state", () => {
  assert.equal(calendarCommitment("busy", true, "Private sample title"), "Unavailable — busy-only block");
  assert.equal(calendarCommitment("details", false, "Private sample title"), "Unavailable — busy-only block");
  assert.match(calendarCommitment("details", true, "Private sample title"), /Private sample title/);
  assert.deepEqual(resetState(), { scenario:"no-calendar", selected:[], disclosure:"busy", confirmed:false });
});
test("availability never converts missing or stale calendars into free time", () => {
  assert.match(availabilityMessage("partial"), /Cannot verify availability/);
  assert.match(availabilityMessage("stale"), /Cannot verify availability/);
  assert.match(availabilityMessage("ready", ["alex"]), /Alex sample Outlook.*Sat 20 June 09:00–17:00 EDT/);
});
