"use strict";
// Offline session boundary tests; all sources and encryption contexts are synthetic.
const test = require("node:test"), assert = require("node:assert/strict");
const { createChildSession, validId } = require("../scripts/child-calendar-session");
const P = require("../scripts/windows-child-protocol");
const { perform: fixture } = require("../browser-fixtures/child-calendar");
const now = Date.parse("2026-09-17T01:00:00Z");
const context = { key: "a".repeat(64), sessionId: "b".repeat(64), expires: now + 1800000 };
const sealed = P.sealSource("SYNTHETIC-ID", context, now);
const list = id => ({ calendars: [{ id, name: "Synthetic source" }], partial: true });
const reviewBody = handle => ({ handle, person: "Kimi", guardian: true, disclosure: "details", startDate: "2026-10-09", endDate: "2026-10-15" });
function session(t, options = {}) {
  const s = createChildSession({ expires: context.expires, now: () => now, ...options });
  t.after(() => s.close()); return s;
}
test("default session source validator remains validId for the old guarded adapter", async t => {
  const s = session(t);
  assert.equal(validId("SYNTHETIC-ID"), true);
  assert.equal((await s.find(() => list("SYNTHETIC-ID"))).calendars.length, 1);
  await assert.rejects(s.find(() => list("https://invalid.test/id")), /invalid_provider_response/);
});
test("native session accepts only sealed source syntax and exposes a separate random handle", async t => {
  const s = session(t, { sourceValidator: P.isSealed });
  assert.equal(P.isSealed(sealed), true);
  const found = await s.find(() => list(sealed));
  assert.match(found.calendars[0].handle, /^[a-f0-9]{64}$/);
  assert.notEqual(found.calendars[0].handle, sealed);
  assert.ok(!JSON.stringify(found).includes(sealed));
  for (const id of ["SYNTHETIC-ID", "a".repeat(64), "https://invalid.test/id", null, sealed + "="]) {
    await assert.rejects(s.find(() => list(id)), /invalid_provider_response/);
  }
  const large = P.sealSource("S".repeat(4096), context, now);
  assert.ok(large.length > 4096); assert.equal(validId(large), false);
  assert.equal((await s.find(() => list(large))).calendars.length, 1);
});
test("sealed source stays server-side and only the reviewed source reaches one import", async t => {
  const s = session(t, { sourceValidator: P.isSealed });
  const found = await s.find(() => list(sealed)), reviewed = s.review(reviewBody(found.calendars[0].handle));
  assert.ok(!JSON.stringify(reviewed).includes(sealed));
  let calls = 0;
  const imported = await s.import({ token: reviewed.token, confirmed: true }, async args => {
    calls++; assert.equal(args.calendarId, sealed); assert.equal(args.disclosure, "details");
    assert.deepEqual(Object.keys(args).sort(), ["calendarId", "disclosure", "signal"]);
    return fixture({ action: "import", disclosure: args.disclosure, record() {} });
  });
  assert.equal(imported.events.length, 3);
  await assert.rejects(s.import({ token: reviewed.token, confirmed: true }, () => assert.fail()), /blocked/);
  assert.equal(calls, 1);
});
test("validator is a trusted synchronous predicate, not a truthy or browser configuration", async t => {
  for (const sourceValidator of [null, "isSealed", {}, true]) assert.throws(() => createChildSession({ sourceValidator }), /blocked/);
  for (const sourceValidator of [() => "yes", () => ({}), async () => true, () => false]) {
    const s = session(t, { sourceValidator });
    await assert.rejects(s.find(() => list(sealed)), /invalid_provider_response/);
  }
});
test("failed sealed lists invalidate previous and partially accepted sources", async t => {
  const s = session(t, { sourceValidator: P.isSealed });
  const found = await s.find(() => list(sealed)), body = reviewBody(found.calendars[0].handle);
  for (const calendars of [[{ id: sealed, name: "Source" }, { id: "SYNTHETIC-RAW", name: "Other" }],
    Array(2).fill({ id: sealed, name: "Source" }), [{ id: sealed, name: "Source", providerId: "SYNTHETIC-RAW" }]]) {
    await assert.rejects(s.find(() => ({ calendars, partial: true })), /invalid_provider_response/);
    assert.throws(() => s.review(body), /blocked/);
  }
});
test("sealed sources keep cross-session, privacy reduction and clear consent fences", async t => {
  const a = session(t, { sourceValidator: P.isSealed }), b = session(t, { sourceValidator: P.isSealed });
  const found = await a.find(() => list(sealed)), body = reviewBody(found.calendars[0].handle), first = a.review(body);
  assert.throws(() => b.review(body), /blocked/);
  await assert.rejects(b.import({ token: first.token, confirmed: true }, () => assert.fail()), /blocked/);
  a.invalidateReview();
  await assert.rejects(a.import({ token: first.token, confirmed: true }, () => assert.fail()), /blocked/);
  const fresh = a.review({ ...body, disclosure: "busy_only" });
  const result = await a.import({ token: fresh.token, confirmed: true }, args => fixture({ ...args, action: "import", record() {} }));
  assert.ok(result.events.every(e => e.redacted && e.title === "Busy"));
  a.clear(); assert.throws(() => a.review(body), /blocked/);
});
test("trusted onValidated receives only reviewed minimal settings and projected result; default response unchanged", async t => {
  const s = session(t, { sourceValidator: P.isSealed, retention: "disk" });
  const found = await s.find(() => list(sealed)), body = reviewBody(found.calendars[0].handle);
  let changes = 0, validated = 0;
  let r = s.review(body, () => changes++); assert.match(r.summary, /until Clear/);
  r = s.review(body, () => changes++); assert.equal(changes, 1);
  const result = await s.import({ token: r.token, confirmed: true }, args => fixture({ ...args, action: "import", record() {} }), undefined, (access, data) => {
    validated++; assert.deepEqual(access, { person: "Kimi", guardian: true, disclosure: "details", sourceName: "Synthetic source" });
    assert.equal(data.events.length, 3); assert.ok(!JSON.stringify({ access, data }).includes(sealed));
  });
  assert.equal(result.events.length, 3); assert.equal(Object.hasOwn(result, "access"), false); assert.equal(validated, 1);
  s.review({ ...body, disclosure: "busy_only" }, () => changes++); assert.equal(changes, 2);
  s.invalidateScope(); s.review(body, () => changes++); assert.equal(changes, 3);
});
test("onValidated never runs for malformed, expired, aborted or invalidated responses", async t => {
  for (const reason of ["invalid", "expired", "abort", "clear"]) {
    let clock = now, finish;
    const s = session(t, { now: () => clock }), found = await s.find(() => list("SYNTHETIC-ID")), r = s.review(reviewBody(found.calendars[0].handle));
    const controller = new AbortController(); let calls = 0;
    const importing = s.import({ token: r.token, confirmed: true }, () => new Promise(resolve => { finish = resolve; }), controller.signal, () => calls++);
    const data = await fixture({ action: "import", disclosure: "details", record() {} });
    if (reason === "invalid") data.events[0].credentials = "SYNTHETIC PRIVATE";
    if (reason === "expired") clock += 1800001;
    if (reason === "abort") controller.abort();
    if (reason === "clear") s.clear();
    finish(data); await assert.rejects(importing, /invalid_provider_response|expired|cancelled/); assert.equal(calls, 0);
  }
});

test("enrollment is explicit and validated; reference reaches only trusted commit and token stays one-use", async t => {
  const s = session(t, { sourceValidator: P.isSealed }), found = await s.find(() => list(sealed));
  const body = reviewBody(found.calendars[0].handle), data = await fixture({ action: "import", disclosure: "details", record() {} });
  const reference = "d".repeat(64), envelope = { reference, data }; let commits = 0;
  let r = s.review(body);
  await assert.rejects(s.import({ token: r.token, confirmed: true }, () => envelope), /invalid_provider_response/);
  // Legacy project-only mode must not silently accept an enrollment envelope.
  const fresh = await s.find(() => list(sealed)); r = s.review(reviewBody(fresh.calendars[0].handle));
  await assert.rejects(s.import({ token: r.token, confirmed: true }, () => envelope, undefined, () => {}, { enroll: true }), /blocked/);
  const response = await s.import({ token: r.token, confirmed: true }, () => envelope, undefined, (access, projected, ref) => {
    commits++; assert.equal(ref, reference); assert.equal(access.sourceName, "Synthetic source"); assert.deepEqual(projected, data);
  }, { enroll: true, enrollmentValidator: P.enrollment });
  assert.deepEqual(response, data); assert.ok(!JSON.stringify(response).includes(reference)); assert.equal(commits, 1);
  await assert.rejects(s.import({ token: r.token, confirmed: true }, () => assert.fail(), undefined, () => {}, { enroll: true, enrollmentValidator: P.enrollment }), /blocked/);
});

test("invalid enrollment and cancelled enrollment never commit a source reference", async t => {
  for (const kind of ["missing", "sealed", "extra", "noncanonical", "cancelled", "expiry"]) {
    let clock = now, finish, commits = 0;
    const s = session(t, { now: () => clock, sourceValidator: P.isSealed }), found = await s.find(() => list(sealed));
    const r = s.review(reviewBody(found.calendars[0].handle)), controller = new AbortController();
    const pending = s.import({ token: r.token, confirmed: true }, () => new Promise(resolve => { finish = resolve; }), controller.signal, () => commits++, { enroll: true, enrollmentValidator: P.enrollment });
    const data = await fixture({ action: "import", disclosure: "details", record() {} });
    const value = { reference: "d".repeat(64), data };
    if (kind === "missing") delete value.reference;
    if (kind === "sealed") value.reference = sealed;
    if (kind === "extra") value.rawId = "SYNTHETIC-ID";
    if (kind === "noncanonical") data.events[0].start = "invalid";
    if (kind === "cancelled") controller.abort();
    if (kind === "expiry") clock += 1800001;
    finish(value); await assert.rejects(pending, /invalid_provider_response|cancelled|expired/); assert.equal(commits, 0);
  }
});