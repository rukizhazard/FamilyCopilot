"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const C = require("../owner/child-calendar-core");
const { createChildSession, validId } = require("../scripts/child-calendar-session");
const { buildChildWorkflow, workflowId } = require("../infra/child-calendar");
const { expression } = require("./fixtures/availability-expressions");
const { perform } = require("../browser-fixtures/child-calendar");
const caller = "11111111-1111-4111-8111-111111111111";
const now = Date.parse("2026-09-17T01:00:00Z");
const sample = disclosure => perform({ action: "import", disclosure, record() {} });
const reviewBody = handle => ({ handle, person: "Kimi", guardian: true, disclosure: "details", startDate: "2026-10-09", endDate: "2026-10-15" });
function session(t, clock = () => now) { const s = createChildSession({ expires: now + 1800000, now: clock }); t.after(() => s.close()); return s; }
const providerList = () => ({ calendars: [{ id: "SYNTHETIC-ID", name: '<img src=x onerror="alert(1)"> calendar' }], partial: true });

for (const sensitivity of ["normal", "private", "personal", "confidential", "unknown", "NORMAL", "", null, { normal: true }]) {
  for (const disclosure of ["details", "busy_only"]) test(`actual cloud title expressions: ${JSON.stringify(sensitivity)} / ${disclosure}`, () => {
    const fields = buildChildWorkflow(caller).properties.definition.actions.Redact.inputs.select;
    const ctx = { actions: { Validate_request: { disclosure } }, item: { sensitivity, subject: "UNTRUSTED <script> https://evil.test" },
      functions: { take: (s, n) => s.slice(0, n) } };
    assert.equal(expression(fields.title, ctx), sensitivity === "normal" && disclosure === "details" ? ctx.item.subject : "Busy");
    assert.equal(expression(fields.redacted, ctx), sensitivity !== "normal" || disclosure !== "details");
  });
}
test("child workflow freezes endpoint/window/read-only verb and protects all raw actions", () => {
  const w = buildChildWorkflow(caller), d = w.properties.definition, a = d.actions;
  assert.equal(w.properties.state, "Disabled"); assert.equal(w.properties.accessControl.triggers.sasAuthenticationPolicy.state, "Disabled");
  assert.equal(a.Get_view.inputs.headers.Method, "GET"); assert.equal(a.Get_view.inputs.path, "/codeless/httprequest");
  assert.match(a.Get_view.inputs.headers.Uri, /uriComponent/); assert.match(a.Get_view.inputs.headers.Uri, /2026-10-08T16%3A00%3A00Z/);
  assert.match(a.Get_view.inputs.headers.Uri, /\$top=100/); assert.doesNotMatch(a.Get_view.inputs.headers.Uri, /description|location|attendees|\$skip|webLink/);
  assert.deepEqual(a.Get_view.inputs.retryPolicy, { type: "none" }); assert.equal(a.Get_view.limit.timeout, "PT1M");
  assert.deepEqual(d.outputs, {}); assert.deepEqual(d.triggers.manual.runtimeConfiguration.secureData.properties, ["outputs"]);
  for (const action of Object.values(a)) assert.deepEqual(action.runtimeConfiguration.secureData.properties, ["Response", "ParseJson"].includes(action.type) ? ["inputs"] : ["inputs", "outputs"]);
  assert.deepEqual(Object.keys(a.Redact.inputs.select).sort(), ["allDay", "end", "kind", "redacted", "start", "status", "title"]);
  assert.equal(a.Validate_view.inputs.schema.properties.value.maxItems, 100);
  assert.equal(d.triggers.manual.inputs.schema.additionalProperties, false);
});
test("cloud URI expression encodes selected IDs and cannot change host or window", () => {
  const uri = buildChildWorkflow(caller).properties.definition.actions.Get_view.inputs.headers.Uri;
  for (const calendarId of ["SYNTHETIC/a+b=c", "SYNTHETIC-ID"]) {
    const result = expression(uri, { actions: { Validate_request: { calendarId } }, functions: { uriComponent: encodeURIComponent } });
    const url = new URL(result); assert.equal(url.origin, "https://graph.microsoft.com");
    assert.equal(url.pathname, `/v1.0/me/calendars/${encodeURIComponent(calendarId)}/calendarView`);
    assert.equal(url.searchParams.get("startDateTime"), C.window.start); assert.equal(url.searchParams.get("endDateTime"), C.window.end);
  }
  for (const id of ["../events?x=1", "https://evil.test", "%2f", "'", "a\n", "a".repeat(4097), null]) assert.equal(validId(id), false);
});
test("actual cloud enum expressions retain cancellations and recurrence exceptions without IDs", () => {
  const fields = buildChildWorkflow(caller).properties.definition.actions.Redact.inputs.select;
  for (const [item, status, kind, allDay] of [[{ isCancelled: true, type: "exception", isAllDay: true }, "cancelled", "exception", true],
    [{ isCancelled: false, type: "occurrence", isAllDay: false }, "scheduled", "occurrence", false], [{}, "unknown", "unknown", null]]) {
    assert.equal(expression(fields.status, { item }), status); assert.equal(expression(fields.kind, { item }), kind); assert.equal(expression(fields.allDay, { item }), allDay);
  }
});
test("project retains original all-day/overlap boundaries and distinct instances without inferred free time", async () => {
  const d = await sample("details"), result = C.project(d, "details", now);
  assert.deepEqual(result, d); assert.equal(result.events.length, 3); assert.equal(result.events[1].end, "2026-10-11T00:00:00+08:00");
  assert.equal(result.events[2].status, "cancelled"); assert.doesNotMatch(JSON.stringify(result), /free|SYNTHETIC-ONLY-ID/);
});
test("strict local boundary rejects unredacted titles, extra fields, excessive counts, future or invalid timestamps", async () => {
  for (const mutate of [d => { d.events[1].title = "PRIVATE"; }, d => { d.events[0].providerId = "SECRET"; }, d => { d.description = "SECRET"; },
    d => { d.window.end = "2026-10-16T16:00:00Z"; }, d => { d.events = Array(101).fill(d.events[0]); }, d => { d.checkedAt = "2026-09-18T00:00:00Z"; },
    d => { d.checkedAt = "2026-02-30T00:00:00Z"; }, d => { d.events[0].title = "x".repeat(201); }, d => { d.events[0].title = "x\n"; }]) {
    const d = structuredClone(await sample("details")); mutate(d); assert.throws(() => C.project(d, "details", now));
  }
  assert.throws(() => C.project({}, "details", now)); assert.throws(() => C.project(null, "details", now));
  assert.throws(() => C.project({ data: "x".repeat(C.maxBytes + 1) }, "details", now));
  const details = await sample("details");
  assert.throws(() => C.project(details, "busy_only", now));
});
test("invalid/out-of-window times produce partial missing context, never shifted events", async () => {
  for (const [start, end] of [["2026-10-08T15:00:00Z", C.window.start], [C.window.end, "2026-10-15T17:00:00Z"],
    ["2026-10-09T10:00:00", "2026-10-09T11:00:00"], ["2026-10-09T12:00:00Z", "2026-10-09T11:00:00Z"], ["2026-02-30T00:00:00Z", "2026-03-01T00:00:00Z"]]) {
    const d = await sample("details"); d.events = [{ ...d.events[0], start, end }];
    const result = C.project(d, "details", now); assert.equal(result.partial, true); assert.equal(result.events.length, 0);
  }
});
test("safe summary/escaping and returned sources treat HTML, URLs and prompts as data", () => {
  const name = '<script>fetch("https://evil.test")</script>';
  assert.match(C.summary(name, "details"), /Current local parent only/);
  assert.doesNotMatch(C.escapeHtml(name), /<script>/); assert.match(C.escapeHtml(name), /&lt;script&gt;/);
  assert.equal(C.datesAllowed("2026-10-09", "2026-10-15"), true); assert.equal(C.datesAllowed("2026-10-09", "2026-10-16"), false);
});
test("server handles are random, session scoped, not derived from calendar names or IDs", async t => {
  const a = session(t), b = session(t), first = await a.find(providerList), second = await b.find(providerList);
  assert.equal(C.handle(first.calendars[0].handle), true); assert.notEqual(first.calendars[0].handle, second.calendars[0].handle);
  assert.doesNotMatch(JSON.stringify(first), /SYNTHETIC-ID/);
  assert.throws(() => b.review(reviewBody(first.calendars[0].handle)), /blocked/);
});
test("one selected source/person/guardian/disclosure/exact dates required before one-use import", async t => {
  const s = session(t), { calendars } = await s.find(providerList), body = reviewBody(calendars[0].handle); let calls = 0;
  for (const changes of [{ person: "Parent B" }, { guardian: false }, { disclosure: "all" }, { startDate: "2026-10-08" }, { endDate: "2026-10-16" }, { calendarId: "SYNTHETIC-ID" }, { handle: "a".repeat(64) }]) assert.throws(() => s.review({ ...body, ...changes }), /blocked/);
  await assert.rejects(s.import({ token: "a".repeat(64), confirmed: true }, () => { calls++; }), /blocked/); assert.equal(calls, 0);
  const r = s.review(body); assert.match(r.summary, /Guardian authority acknowledged/);
  const fn = async options => { calls++; assert.equal(options.calendarId, "SYNTHETIC-ID"); assert.equal(options.disclosure, "details"); return sample("details"); };
  await assert.rejects(s.import({ token: r.token, confirmed: false }, fn), /blocked/);
  await s.import({ token: r.token, confirmed: true }, fn);
  await assert.rejects(s.import({ token: r.token, confirmed: true }, fn), /blocked/); assert.equal(calls, 1);
});
for (const reason of ["clear", "invalidateReview", "close", "expiry"]) test(`late child import is fenced by ${reason}`, async t => {
  let clock = now, finish, started;
  const ready = new Promise(r => { started = r; }), wait = new Promise(r => { finish = r; });
  const s = session(t, () => clock), { calendars } = await s.find(providerList), r = s.review(reviewBody(calendars[0].handle));
  const importing = s.import({ token: r.token, confirmed: true }, async () => { started(); await wait; return sample("details"); });
  await ready; if (reason === "expiry") clock += 1800001; else s[reason](); finish();
  await assert.rejects(importing, /cancelled|expired/);
  assert.throws(() => s.review(reviewBody(calendars[0].handle)), /blocked|expired/);
});
test("late listing, duplicated IDs and unexpected provider fields never leave usable handles", async t => {
  const s = session(t); let done;
  const loading = s.find(() => new Promise(r => { done = r; })); s.clear(); done(providerList());
  await assert.rejects(loading, /cancelled/);
  for (const data of [{ calendars: [{ id: "SYNTHETIC", name: "Source", location: "SECRET" }], partial: true }, { calendars: Array(2).fill({ id: "SYNTHETIC", name: "Source" }), partial: true }, { calendars: [{ id: "../unsafe", name: "Source" }], partial: true }]) await assert.rejects(s.find(() => data));
});
test("privacy reduction invalidates old review and produces only Busy in subsequent results", async t => {
  const s = session(t), { calendars } = await s.find(providerList), body = reviewBody(calendars[0].handle), old = s.review(body);
  s.invalidateReview(); await assert.rejects(s.import({ token: old.token, confirmed: true }, () => assert.fail()), /blocked/);
  const fresh = s.review({ ...body, disclosure: "busy_only" });
  const data = await s.import({ token: fresh.token, confirmed: true }, () => sample("busy_only")); assert.ok(data.events.every(e => e.title === "Busy"));
});
module.exports = { caller, now, sample, reviewBody };
test("closed child sessions cannot be reopened by a fresh find", async t => {
  const s = session(t); s.close(); let calls = 0;
  await assert.rejects(s.find(() => { calls++; return providerList(); }), /expired|blocked/);
  assert.equal(calls, 0);
});
test("busy-only projection requires both the fixed title and redaction indicator", async () => {
  const d = await sample("busy_only"); d.events[0].redacted = false;
  assert.throws(() => C.project(d, "busy_only", now));
});
test("actual cloud bounds, response-size and partial expressions are bounded and fail closed", () => {
  const a = buildChildWorkflow(caller).properties.definition.actions;
  const functions = { base64: s => Buffer.from(s).toString("base64"), lessOrEquals: (a, b) => a <= b, or: (...v) => v.some(Boolean), empty: v => v == null || v.length === 0 };
  for (const calendarId of ["SYNTHETIC/a+b=c", "../events?x=1", "https://evil.test", "%2f", "a\n", "'"]) {
    assert.equal(expression(a.Validate_bounds.inputs.content, { actions: { Validate_request: { calendarId } }, functions: { ...functions, triggerBody: () => ({ calendarId }) } }), validId(calendarId));
  }
  assert.equal(expression(a.Validate_bounds.inputs.content, { actions: { Validate_request: { calendarId: "a" } }, functions: { ...functions, triggerBody: () => ({ extra: "a".repeat(12000) }) } }), false);
  for (const [payload, expected] of [[{}, true], [{ huge: "x".repeat(262144) }, false]]) assert.equal(expression(a.Validate_size.inputs.content, { actions: { Get_view: payload }, functions }), expected);
  for (const [value, next, expected] of [[[], null, false], [Array(99).fill({}), null, false], [Array(100).fill({}), null, true], [[], "https://untrusted.test/next", true]]) {
    assert.equal(expression(a.Result.inputs.body.partial, { actions: { Validate_view: { value, "@odata.nextLink": next } }, functions }), expected);
  }
  for (const [name, action] of Object.entries(a).filter(([name]) => name.startsWith("Failed_"))) {
    assert.deepEqual(Object.keys(action.inputs.body), ["status"]);
    assert.equal(action.inputs.body.status, name === "Failed_Get_view" ? "unavailable" : "invalid_provider_response");
    assert.doesNotMatch(JSON.stringify(action.inputs.body), /@|error\(|body\(/);
  }
});