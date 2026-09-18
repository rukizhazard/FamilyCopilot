"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), vm = require("node:vm");
const C = require("../shared/chat-contract");
const { demoContext, activityRequest } = require("./fixtures/chat-context");
const clone = value => JSON.parse(JSON.stringify(value));
const options = () => ({ version: "familycopilot.chat.v1", mode: "synthetic" });

// Schema specimens, not the Activities search pool or Calendar fixtures.
function occurrence() {
  return {
    sourceId: "fixture-source", eventId: "fixture-event", occurrenceId: "october-10",
    category: "science", title: "Fictional science visit", sourceUrl: null,
    startAt: "2026-10-10T10:00:00+08:00", endAt: "2026-10-10T11:00:00+08:00",
    timeZone: "Asia/Taipei", venue: { name: null, area: "Taipei" },
    ageGuidance: { minAge: 6, maxAge: 12, rule: "recommended", evidenceId: "age" },
    travel: { durationMinutes: null, distanceKm: null, mode: null, originArea: null, evidenceId: null },
    cost: { amount: null, currency: null, basis: null, evidenceId: null },
    setting: "unknown", thumbnail: null,
    rationale: [{ text: "Fictional age guidance includes age eight.", evidenceIds: ["age"] }],
    evidence: ["identity", "timing", "venue", "age"].map(field => ({
      id: field, field, kind: "synthetic", sourceId: "fixture-source", sourceUrl: null,
      retrievedAt: null, sourceUpdatedAt: null, text: "Invented contract-test evidence."
    })),
    unknowns: ["Travel unknown.", "Ticket availability unknown.", "Cost unknown."],
    assessment: "candidate", calendarFit: "not_checked"
  };
}
function result(request = activityRequest()) {
  return {
    version: request.version, requestId: request.requestId, generation: request.generation,
    contextRevision: request.contextRevision, mode: request.mode, range: clone(request.range),
    status: "results", sources: [{ sourceId: "fixture-source", name: "Invented source", url: null,
      kind: "synthetic", coverage: { range: clone(request.range), categories: ["science"], completeness: "complete" },
      retrievedAt: null, freshness: "synthetic" }],
    items: [occurrence()], issues: [], calendarFit: "not_checked"
  };
}
function addEvidence(item, field) {
  item.evidence.push({ ...clone(item.evidence[0]), id: field, field });
}
function priced(item, amount = 100) {
  addEvidence(item, "cost");
  item.cost = { amount, currency: "TWD", basis: "per_child", evidenceId: "cost" };
}
function illustrated(item) {
  addEvidence(item, "thumbnail");
  item.thumbnail = { assetKey: "test-original", alt: "Fictional illustration", sourceUrl: null,
    attribution: "Original synthetic test artwork", permission: "original_synthetic", evidenceId: "thumbnail" };
}
function freeze(value) {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function recordPaths(value, path = []) {
  if (!value || typeof value !== "object") return [];
  return [...(Array.isArray(value) ? [] : [path]), ...Object.keys(value).flatMap(key => recordPaths(value[key], [...path, key]))];
}
const at = (value, path) => path.reduce((current, key) => current[key], value);

test("exact frozen browser/CommonJS API works without DOM, storage, clocks or domain globals", () => {
  const names = ["validateDemoContext", "validateActivityRequest", "validateActivityResultShape", "validateActivityResult",
    "validateCalendarMountOptions", "activityRequestKey", "activityCardId"].sort();
  assert.deepEqual(Object.keys(C).sort(), names); assert.equal(Object.isFrozen(C), true);
  const sandbox = { URL };
  for (const key of ["fetch", "XMLHttpRequest", "document", "localStorage", "sessionStorage", "console", "Date",
    "setTimeout", "setInterval", "OwnerAvailability", "FamilyDates", "FamilyChatCalendar", "FamilyChatActivities"]) {
    Object.defineProperty(sandbox, key, { get() { throw Error("forbidden_dependency"); } });
  }
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(require.resolve("../shared/chat-contract"), "utf8"), sandbox);
  const B = sandbox.FamilyChatContract;
  assert.deepEqual(Object.keys(B).sort(), names); assert.equal(Object.isFrozen(B), true);
  assert.equal(B.validateCalendarMountOptions(options()), true);
  assert.equal(B.validateDemoContext(demoContext()), true);
  assert.equal(B.validateActivityResult(result(), activityRequest()), true);
  assert.equal(B.activityRequestKey(activityRequest()), C.activityRequestKey(activityRequest()));
  assert.equal(B.activityCardId(occurrence()), C.activityCardId(occurrence()));
  const foreign = vm.runInContext('({version:"familycopilot.chat.v1",mode:"synthetic"})', sandbox);
  assert.equal(C.validateCalendarMountOptions(foreign), true);
});

test("Calendar accepts only exact version and synthetic options, never a host or Calendar payload", () => {
  assert.equal(C.validateCalendarMountOptions(options()), true);
  for (const value of [null, undefined, [], {}, "synthetic", true, 1,
    { version: "familycopilot.chat.v0", mode: "synthetic" }, { version: options().version, mode: "live" },
    { version: options().version }, { mode: "synthetic" }]) assert.equal(C.validateCalendarMountOptions(value), false);
  for (const key of ["host", "getState", "onResult", "events", "calendar", "consent", "sourceId", "busySlots", "token", "signal"]) {
    assert.equal(C.validateCalendarMountOptions({ ...options(), [key]: {} }), false, key);
  }
});

test("all record levels reject extra/missing keys, without stripping or mutation", () => {
  const rich = result(); priced(rich.items[0]); illustrated(rich.items[0]);
  rich.issues.push({ code: "evidence_unknown", sourceId: null, message: "Travel unknown." });
  const asked = activityRequest(); asked.preferences.constraints.budget = { amount: 100, currency: "TWD", basis: "per_child" };
  for (const [value, validate] of [[options(), C.validateCalendarMountOptions], [demoContext(), C.validateDemoContext],
    [asked, C.validateActivityRequest], [rich, C.validateActivityResultShape]]) {
    assert.equal(validate(value), true);
    for (const path of recordPaths(value)) {
      const extra = clone(value); at(extra, path).privateCalendar = "not_allowed";
      assert.equal(validate(extra), false, `extra ${path.join(".")}`);
      const missing = clone(value), target = at(missing, path); delete target[Object.keys(target)[0]];
      assert.equal(validate(missing), false, `missing ${path.join(".")}`);
    }
  }
});

test("validators reject accessors, custom prototypes, hidden/symbol keys and malformed arrays without calling hooks", () => {
  let calls = 0;
  const getter = options(); Object.defineProperty(getter, "mode", { enumerable: true, get() { calls++; throw Error(); } });
  const hidden = options(); Object.defineProperty(hidden, "extra", { value: 1 });
  const symbol = options(); symbol[Symbol("extra")] = 1;
  const inherited = Object.assign(Object.create({ inherited: true }), options());
  for (const value of [getter, hidden, symbol, inherited]) assert.equal(C.validateCalendarMountOptions(value), false);
  const nullPrototype = Object.assign(Object.create(null), options()); assert.equal(C.validateCalendarMountOptions(nullPrototype), true);
  const request = activityRequest(); Object.defineProperty(request.preferences, "ages", { enumerable: true, get() { calls++; throw Error(); } });
  assert.equal(C.validateActivityRequest(request), false);
  for (const values of [Array(1), Object.assign([8], { extra: 1 }), new Uint8Array([8])]) {
    const candidate = activityRequest(); candidate.preferences.ages = values; assert.equal(C.validateActivityRequest(candidate), false);
  }
  const arrayGetter = activityRequest(); Object.defineProperty(arrayGetter.preferences.ages, "0", { get() { calls++; throw Error(); } });
  assert.equal(C.validateActivityRequest(arrayGetter), false); assert.equal(calls, 0);
});

test("invalid JSON-like values are total, and fixed key/id errors never echo input", () => {
  const circular = {}; circular.self = circular;
  for (const value of [null, undefined, true, false, 1, -Infinity, NaN, "private-test-value", [], {}, circular, 1n, Symbol(), () => {}]) {
    for (const validate of [C.validateDemoContext, C.validateActivityRequest, C.validateActivityResultShape, C.validateCalendarMountOptions]) {
      assert.equal(validate(value), false);
    }
    assert.equal(C.validateActivityResult(value, activityRequest()), false);
    assert.equal(C.validateActivityResult(result(), value), false);
    assert.throws(() => C.activityRequestKey(value), { message: "invalid_request" });
    assert.throws(() => C.activityCardId(value), { message: "invalid_result" });
  }
});

test("fixture factories return fresh non-calendar context, all functions preserve frozen inputs", () => {
  const context = freeze(demoContext()), asked = freeze(activityRequest()), found = freeze(result());
  const before = JSON.stringify([context, asked, found]);
  assert.equal(C.validateDemoContext(context), true); assert.equal(C.validateActivityRequest(asked), true);
  assert.equal(C.validateActivityResultShape(found), true); assert.equal(C.validateActivityResult(found, asked), true);
  C.activityRequestKey(asked); C.activityCardId(found.items[0]);
  assert.equal(JSON.stringify([context, asked, found]), before);
  const changed = demoContext(); changed.preferences.ages[0] = 9;
  assert.deepEqual(demoContext().preferences.ages, [8]);
});

test("context fixes demo reference, mode, zone, revision and trigger state", () => {
  for (const state of ["not_started", "active", "paused", "ended"]) {
    const value = demoContext(); value.triggerState = state; assert.equal(C.validateDemoContext(value), true);
  }
  for (const [key, invalid] of [["sessionId", "person@example.test"], ["contextRevision", 0], ["mode", "live"],
    ["timeZone", "UTC"], ["referenceNow", "2026-09-18T04:00:01Z"], ["triggerState", "authorized"]]) {
    const value = demoContext(); value[key] = invalid; assert.equal(C.validateDemoContext(value), false);
  }
});

test("request IDs, positive safe counters, trigger and live-mode rejection", () => {
  for (const key of ["requestId", "generation", "contextRevision", "mode", "referenceNow"]) {
    const values = key === "requestId" ? ["", "a".repeat(65), "x/y", "x\n"] :
      key === "mode" ? ["live", "sample"] : key === "referenceNow" ? ["2026-09-18", "2026-09-18T12:00:00+08:00", "2026-02-30T00:00:00Z"] :
        [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "1"];
    for (const invalid of values) { const value = activityRequest(); value[key] = invalid; assert.equal(C.validateActivityRequest(value), false); }
  }
  for (const kind of ["demo_start", "refinement_submit", "explicit_retry"]) {
    const value = activityRequest(); value.trigger.kind = kind; assert.equal(C.validateActivityRequest(value), true);
  }
  for (const trigger of [{ kind: "startup", actionId: "a" }, { kind: "demo_start", actionId: "" }]) {
    const value = activityRequest(); value.trigger = trigger; assert.equal(C.validateActivityRequest(value), false);
  }
  const value = activityRequest(); value.requestId = "a".repeat(64); value.generation = Number.MAX_SAFE_INTEGER;
  assert.equal(C.validateActivityRequest(value), true);
});

test("date ranges enforce 1–7 days, 28-day forward window and actual Gregorian dates", () => {
  for (const [start, end, expected] of [
    ["2026-09-18", "2026-09-18", true], ["2026-10-09", "2026-10-15", true],
    ["2026-10-15", "2026-10-15", true], ["2026-10-16", "2026-10-16", false],
    ["2026-09-17", "2026-09-18", false], ["2026-09-18", "2026-09-25", false],
    ["2026-10-10", "2026-10-09", false], ["2026-02-30", "2026-03-01", false],
    ["2026-9-18", "2026-09-18", false], ["1999-12-31", "2000-01-01", false], ["2101-01-01", "2101-01-01", false]
  ]) {
    const value = activityRequest(); value.range.startDate = start; value.range.endDate = end;
    assert.equal(C.validateActivityRequest(value), expected, `${start}..${end}`);
  }
  for (const [referenceNow, date, expected] of [["2028-02-28T16:00:00Z", "2028-02-29", true],
    ["2100-02-28T00:00:00Z", "2100-02-29", false], ["2000-02-28T16:00:00Z", "2000-02-29", true],
    ["2026-09-18T16:00:00Z", "2026-09-18", false], ["2026-09-18T15:59:59.999Z", "2026-09-18", true]]) {
    const value = activityRequest(); value.referenceNow = referenceNow; value.range.startDate = value.range.endDate = date;
    assert.equal(C.validateActivityRequest(value), expected, referenceNow);
  }
});

test("preferences retain exact age/coarse origin and bounded optional constraints", () => {
  const invalids = [p => p.ages = [], p => p.ages = [8, 8], p => p.ages = [9],
    p => p.origin.landmark = "MRT", p => p.origin.precision = "address", p => p.origin.area = "Other area",
    p => p.interestBasis = "inferred", p => p.travelMode = "teleport", p => p.interests = [""],
    p => p.interests = ["science", "science"], p => p.interests = ["a".repeat(41)],
    p => p.preferredTeams = ["a".repeat(121)], p => p.constraints.maxTravelMinutes = 0,
    p => p.constraints.maxTravelMinutes = 181, p => p.constraints.maxTravelMinutes = 1.5,
    p => p.constraints.setting = "nearby", p => p.constraints.excludedCategories = ["x", "x"]];
  for (const mutate of invalids) { const value = activityRequest(); mutate(value.preferences); assert.equal(C.validateActivityRequest(value), false); }
  for (const budget of [{ amount: -1, currency: "TWD", basis: "per_child" }, { amount: Infinity, currency: "TWD", basis: "per_child" },
    { amount: 100001, currency: "TWD", basis: "per_child" }, { amount: 0, currency: "twd", basis: "per_child" },
    { amount: 0, currency: "TWD", basis: "family" }]) {
    const value = activityRequest(); value.preferences.constraints.budget = budget; assert.equal(C.validateActivityRequest(value), false);
  }
  for (const [field, maximum] of [["interests", 12], ["preferredTeams", 16]]) {
    const value = activityRequest(); value.preferences[field] = Array.from({ length: maximum }, (_, i) => `token-${i}`);
    assert.equal(C.validateActivityRequest(value), true); value.preferences[field].push("extra"); assert.equal(C.validateActivityRequest(value), false);
  }
});

test("canonical keys ignore correlation/trigger, normalize only set-like tokens, preserve all constraints", () => {
  const first = activityRequest(), second = activityRequest();
  first.preferences.interests = [" SCIENCE ", "Cafe\u0301", "science"];
  second.preferences.interests = ["café", "science"];
  first.preferences.preferredTeams = [" Team B ", "TEAM A", "team a"];
  second.preferences.preferredTeams = ["team a", "team b"];
  first.preferences.constraints.excludedCategories = [" Outdoors ", "ART"];
  second.preferences.constraints.excludedCategories = ["art", "outdoors"];
  Object.assign(second, { requestId: "new", generation: 3, contextRevision: 4, trigger: { kind: "explicit_retry", actionId: "retry" } });
  const before = JSON.stringify(first);
  assert.equal(C.activityRequestKey(first), C.activityRequestKey(second)); assert.equal(JSON.stringify(first), before);
  const shuffled = Object.fromEntries(Object.entries(second).reverse());
  shuffled.preferences = Object.fromEntries(Object.entries(second.preferences).reverse());
  assert.equal(C.activityRequestKey(first), C.activityRequestKey(shuffled));
  for (const mutate of [v => v.range.startDate = "2026-10-10", v => v.referenceNow = "2026-09-18T05:00:00Z",
    v => v.preferences.travelMode = "transit", v => v.preferences.interestBasis = "parent_confirmed",
    v => v.preferences.constraints.maxTravelMinutes = 30,
    v => v.preferences.constraints.budget = { amount: 0, currency: "TWD", basis: "per_child" }]) {
    const changed = clone(first); mutate(changed); assert.notEqual(C.activityRequestKey(first), C.activityRequestKey(changed));
  }
  const parsed = JSON.parse(C.activityRequestKey(first));
  assert.deepEqual(Object.keys(parsed), ["mode", "preferences", "range", "referenceNow", "version"]);
});

test("card identity validates the occurrence and uses a collision-free JSON tuple", () => {
  const item = occurrence();
  assert.equal(C.activityCardId(item), JSON.stringify([item.sourceId, item.eventId, item.occurrenceId]));
  const other = clone(item); other.occurrenceId = "another-date"; assert.notEqual(C.activityCardId(item), C.activityCardId(other));
  assert.throws(() => C.activityCardId({ sourceId: "a", eventId: "b", occurrenceId: "c" }), { message: "invalid_result" });
  item.eventId = 'a", "b'; assert.equal(JSON.parse(C.activityCardId(item))[1], item.eventId);
});

test("result echoes reject stale request generation/revision/ID and changed range", () => {
  const asked = activityRequest();
  for (const [key, value] of [["requestId", "other"], ["generation", 2], ["contextRevision", 2]]) {
    const found = result(); found[key] = value;
    assert.equal(C.validateActivityResultShape(found), true); assert.equal(C.validateActivityResult(found, asked), false);
  }
  const found = result(); found.range.startDate = "2026-10-08";
  assert.equal(C.validateActivityResultShape(found), true); assert.equal(C.validateActivityResult(found, asked), false);
  for (const [key, value] of [["version", "v0"], ["mode", "live"], ["calendarFit", "free"]]) {
    const invalid = result(); invalid[key] = value; assert.equal(C.validateActivityResultShape(invalid), false);
  }
});

test("occurrences require matching zone/offset, valid instants and strictly increasing ends", () => {
  for (const startAt of ["2026-10-10T10:00:00", "2026-10-10T02:00:00Z", "2026-10-10T10:00:00+09:00",
    "2026-02-30T10:00:00+08:00", "2026-10-10T24:00:00+08:00", "2026-10-10T10:60:00+08:00",
    "2026-10-10T10:00:60+08:00"]) {
    const found = result(); found.items[0].startAt = startAt; assert.equal(C.validateActivityResultShape(found), false, startAt);
  }
  for (const endAt of ["2026-10-10T10:00:00+08:00", "2026-10-10T09:59:59+08:00"]) {
    const found = result(); found.items[0].endAt = endAt; assert.equal(C.validateActivityResultShape(found), false);
  }
  const found = result(); found.items[0].timeZone = "UTC"; assert.equal(C.validateActivityResultShape(found), false);
});

test("range containment includes exact end midnight, excludes next-midnight start and fractional overrun", () => {
  const found = result();
  found.items[0].startAt = "2026-10-09T00:00:00+08:00"; found.items[0].endAt = "2026-10-12T00:00:00+08:00";
  assert.equal(C.validateActivityResult(found, activityRequest()), true);
  found.items[0].endAt = "2026-10-12T00:00:00.000000001+08:00"; assert.equal(C.validateActivityResultShape(found), false);
  found.items[0].endAt = null; found.items[0].assessment = "needs_checking"; found.status = "unknown";
  found.items[0].startAt = "2026-10-12T00:00:00+08:00"; assert.equal(C.validateActivityResultShape(found), false);
  found.items[0].startAt = "2026-10-08T23:59:59+08:00"; assert.equal(C.validateActivityResultShape(found), false);
});

test("same-day earlier starts are rejected against explicit reference including submilliseconds", () => {
  const asked = activityRequest(); asked.range.startDate = asked.range.endDate = "2026-09-18";
  asked.referenceNow = "2026-09-18T04:00:00.000000002Z";
  const found = result(asked), item = found.items[0];
  item.startAt = "2026-09-18T12:00:00.000000001+08:00"; item.endAt = "2026-09-18T13:00:00+08:00";
  assert.equal(C.validateActivityResultShape(found), true); assert.equal(C.validateActivityResult(found, asked), false);
  item.startAt = "2026-09-18T12:00:00.000000002+08:00"; assert.equal(C.validateActivityResult(found, asked), true);
});

test("unknown end and age force needs_checking without turning missing time into fit", () => {
  for (const change of [item => item.endAt = null, item => item.ageGuidance = { minAge: null, maxAge: null, rule: "unknown", evidenceId: null }]) {
    const found = result(); change(found.items[0]); assert.equal(C.validateActivityResultShape(found), false);
    found.items[0].assessment = "needs_checking"; found.status = "unknown";
    assert.equal(C.validateActivityResult(found, activityRequest()), true);
  }
});

test("source references, evidence identity and canonical card identities are unique and resolved", () => {
  for (const mutate of [v => v.sources.push(clone(v.sources[0])), v => v.items.push(clone(v.items[0])),
    v => v.items[0].sourceId = "missing", v => v.items[0].evidence[0].sourceId = "missing",
    v => v.issues.push({ code: "evidence_unknown", sourceId: "missing", message: "Unknown" }),
    v => v.items[0].evidence.push(clone(v.items[0].evidence[0])),
    v => v.items[0].ageGuidance.evidenceId = "timing", v => v.items[0].rationale[0].evidenceIds = ["missing"]]) {
    const found = result(); mutate(found); assert.equal(C.validateActivityResultShape(found), false);
  }
  const found = result(); found.items.push(clone(found.items[0])); found.items[1].occurrenceId = "distinct";
  assert.equal(C.validateActivityResultShape(found), true);
});

test("non-null facts require same-field synthetic evidence; unknown evidence never proves facts", () => {
  for (const field of ["identity", "timing", "venue", "age"]) {
    const found = result(); found.items[0].evidence.find(e => e.field === field).kind = "unknown";
    assert.equal(C.validateActivityResultShape(found), false, field);
  }
  const found = result(), item = found.items[0];
  item.setting = "indoor"; assert.equal(C.validateActivityResultShape(found), false);
  addEvidence(item, "setting"); assert.equal(C.validateActivityResultShape(found), true);
  priced(item, 0); assert.equal(C.validateActivityResultShape(found), true);
  item.cost.evidenceId = "age"; assert.equal(C.validateActivityResultShape(found), false);
  item.cost.evidenceId = "cost"; item.evidence.find(e => e.field === "cost").kind = "unknown";
  assert.equal(C.validateActivityResultShape(found), false);
});

test("M1 never accepts live provenance, timestamps, calendar fit, or district-only routing numbers", () => {
  for (const mutate of [v => v.sources[0].kind = "live", v => v.sources[0].freshness = "fresh",
    v => v.sources[0].retrievedAt = "2026-09-18T04:00:00Z", v => v.items[0].evidence[0].kind = "published",
    v => v.items[0].evidence[0].sourceUpdatedAt = "2026-09-18T04:00:00Z",
    v => v.items[0].evidence[0].retrievedAt = "2026-09-18T04:00:00Z",
    v => v.items[0].calendarFit = "compatible", v => v.items[0].travel.durationMinutes = 0,
    v => v.items[0].travel.distanceKm = 1, v => v.items[0].unknowns = []]) {
    const found = result(); mutate(found); assert.equal(C.validateActivityResultShape(found), false);
  }
});

test("safe links are HTTPS navigation only; credentials, unsafe schemes and controls are rejected", () => {
  for (const url of ["javascript:alert(1)", "data:text/html,test", "http://example.test", "//example.test",
    "https://name:secret@example.test", "https://example.test\\@evil.test", " https://example.test",
    "https://example.test/\n", "https://", "https://example.test/" + "x".repeat(2048)]) {
    for (const field of ["source", "item", "evidence", "thumbnail"]) {
      const found = result(); illustrated(found.items[0]);
      if (field === "source") found.sources[0].url = url;
      else if (field === "item") found.items[0].sourceUrl = url;
      else if (field === "evidence") found.items[0].evidence[0].sourceUrl = url;
      else found.items[0].thumbnail.sourceUrl = url;
      assert.equal(C.validateActivityResultShape(found), false, `${field}: ${url.slice(0, 40)}`);
    }
  }
  const found = result(); found.items[0].sourceUrl = "https://example.test/event?a=1&b=2#details";
  found.items[0].title = '<img src=x onerror="example()">';
  assert.equal(C.validateActivityResultShape(found), true, "untrusted plain text still needs text-node rendering");
});

test("thumbnails accept symbolic original assets only and validate field-matched evidence", () => {
  const found = result(); illustrated(found.items[0]); assert.equal(C.validateActivityResultShape(found), true);
  for (const key of ["../poster.svg", "/poster.svg", "https://example.test/a", "data:image/svg+xml,x", "x".repeat(81), ""]) {
    const invalid = clone(found); invalid.items[0].thumbnail.assetKey = key; assert.equal(C.validateActivityResultShape(invalid), false);
  }
  const invalid = clone(found); invalid.items[0].thumbnail.permission = "licensed"; assert.equal(C.validateActivityResultShape(invalid), false);
  invalid.items[0].thumbnail.permission = "original_synthetic"; invalid.items[0].thumbnail.evidenceId = "identity";
  assert.equal(C.validateActivityResultShape(invalid), false);
});

test("all bounded result collections and text lengths reject overflow", () => {
  const mutations = [v => v.sources = [], v => v.sources = Array.from({ length: 9 }, (_, i) => ({ ...v.sources[0], sourceId: `s${i}` })),
    v => v.items = Array.from({ length: 7 }, (_, i) => ({ ...v.items[0], occurrenceId: `o${i}` })),
    v => v.issues = Array.from({ length: 13 }, () => ({ code: "evidence_unknown", sourceId: null, message: "Unknown" })),
    v => v.items[0].unknowns = Array(13).fill("Unknown"), v => v.items[0].rationale = Array(4).fill(v.items[0].rationale[0]),
    v => v.items[0].rationale[0].evidenceIds = Array(9).fill("age"), v => v.items[0].evidence = Array(17).fill(v.items[0].evidence[0]),
    v => v.sources[0].coverage.categories = Array(13).fill("science"), v => v.items[0].title = "x".repeat(161),
    v => v.items[0].eventId = "x".repeat(121), v => v.sources[0].sourceId = "x".repeat(81),
    v => v.items[0].venue.area = "x".repeat(121), v => v.items[0].rationale[0].text = "x".repeat(241),
    v => v.items[0].unknowns = ["x".repeat(161)], v => v.items[0].title = "x\u0000",
    v => v.items[0].ageGuidance.minAge = 121, v => v.items[0].ageGuidance.minAge = 13,
    v => v.items[0].ageGuidance.maxAge = 1.5];
  for (const mutate of mutations) { const found = result(); mutate(found); assert.equal(C.validateActivityResultShape(found), false); }
});

test("status precedence separates complete results/unknown/empty, partial and unavailable", () => {
  const complete = result(); assert.equal(C.validateActivityResultShape(complete), true);
  const unknown = result(); unknown.items[0].assessment = "needs_checking"; unknown.status = "unknown";
  assert.equal(C.validateActivityResultShape(unknown), true);
  const empty = result(); empty.items = []; empty.status = "empty";
  assert.equal(C.validateActivityResultShape(empty), false);
  empty.issues = [{ code: "no_matches", sourceId: null, message: "No fixture matches." }]; assert.equal(C.validateActivityResultShape(empty), true);
  const partial = result(); partial.sources[0].coverage.completeness = "partial"; partial.status = "partial";
  partial.issues = [{ code: "candidate_limit", sourceId: "fixture-source", message: "Candidate limit." }];
  assert.equal(C.validateActivityResultShape(partial), true); partial.items = []; assert.equal(C.validateActivityResultShape(partial), true);
  const unavailable = result(); unavailable.items = []; unavailable.sources[0].coverage.completeness = "unknown";
  unavailable.status = "unavailable"; unavailable.issues = [{ code: "source_unavailable", sourceId: "fixture-source", message: "Unavailable." }];
  assert.equal(C.validateActivityResultShape(unavailable), true);
  for (const [found, validStatus] of [[complete, "results"], [unknown, "unknown"], [empty, "empty"], [partial, "partial"], [unavailable, "unavailable"]]) {
    for (const status of ["results", "unknown", "empty", "partial", "unavailable"]) {
      const changed = clone(found); changed.status = status; assert.equal(C.validateActivityResultShape(changed), status === validStatus, `${validStatus}/${status}`);
    }
  }
});

test("incomplete source scope needs a corresponding issue and cannot claim complete failure or no matches with items", () => {
  for (const mutate of [v => v.sources[0].coverage.completeness = "unknown",
    v => v.issues = [{ code: "source_unavailable", sourceId: "fixture-source", message: "Unavailable." }],
    v => v.issues = [{ code: "no_matches", sourceId: null, message: "No matches." }],
    v => v.sources[0].coverage.range.startDate = "2026-10-08",
    v => v.sources[0].coverage.range.endDate = "2026-10-09"]) {
    const found = result(); mutate(found); assert.equal(C.validateActivityResultShape(found), false);
  }
  const found = result(); found.status = "partial";
  found.sources.push({ ...clone(found.sources[0]), sourceId: "failed", coverage: { ...clone(found.sources[0].coverage), completeness: "unknown" } });
  found.issues = [{ code: "source_unavailable", sourceId: "failed", message: "Other source unavailable." }];
  assert.equal(C.validateActivityResultShape(found), true);
});

test("known required age violations exclude, recommended mismatch needs checking, shape is preference-independent", () => {
  const found = result(); found.items[0].ageGuidance.minAge = 9;
  assert.equal(C.validateActivityResultShape(found), true); assert.equal(C.validateActivityResult(found, activityRequest()), false);
  found.items[0].assessment = "needs_checking"; found.status = "unknown"; assert.equal(C.validateActivityResult(found, activityRequest()), true);
  found.items[0].ageGuidance.rule = "required"; assert.equal(C.validateActivityResult(found, activityRequest()), false);
  found.items[0].ageGuidance.minAge = 8; assert.equal(C.validateActivityResult(found, activityRequest()), true);
});

test("hard exclusions and settings filter, unknown setting requires needs checking", () => {
  const asked = activityRequest(), found = result(); asked.preferences.constraints.excludedCategories = [" SCIENCE "];
  assert.equal(C.validateActivityResult(found, asked), false); asked.preferences.constraints.excludedCategories = [];
  asked.preferences.constraints.setting = "indoor"; assert.equal(C.validateActivityResult(found, asked), false);
  found.items[0].assessment = "needs_checking"; found.status = "unknown"; assert.equal(C.validateActivityResult(found, asked), true);
  found.items[0].setting = "outdoor"; addEvidence(found.items[0], "setting"); assert.equal(C.validateActivityResult(found, asked), false);
  found.items[0].setting = "indoor"; assert.equal(C.validateActivityResult(found, asked), true);
});

test("budget uses evidenced amount/currency/unit, never converts or makes unknown cost free", () => {
  const asked = activityRequest(), found = result(); asked.preferences.constraints.budget = { amount: 100, currency: "TWD", basis: "per_child" };
  assert.equal(C.validateActivityResult(found, asked), false); priced(found.items[0], 100);
  assert.equal(C.validateActivityResult(found, asked), true); found.items[0].cost.amount = 101; assert.equal(C.validateActivityResult(found, asked), false);
  found.items[0].cost.amount = 0; assert.equal(C.validateActivityResult(found, asked), true);
  found.items[0].cost.currency = "USD"; assert.equal(C.validateActivityResult(found, asked), false);
  found.items[0].assessment = "needs_checking"; found.status = "unknown"; assert.equal(C.validateActivityResult(found, asked), true);
  found.items[0].cost.currency = "TWD"; found.items[0].cost.basis = "per_person"; assert.equal(C.validateActivityResult(found, asked), true);
});

test("district-only travel limit is always uncertain; interests and teams are not hard constraints", () => {
  const asked = activityRequest(), found = result(); asked.preferences.interests = ["music"]; asked.preferences.preferredTeams = ["Other team"];
  assert.equal(C.validateActivityResult(found, asked), true);
  asked.preferences.constraints.maxTravelMinutes = 30; assert.equal(C.validateActivityResult(found, asked), false);
  found.items[0].assessment = "needs_checking"; found.status = "unknown"; assert.equal(C.validateActivityResult(found, asked), true);
});

test("a complete second source cannot legitimize cards from a failed or unsupported source", () => {
  for (const code of ["source_unsupported", "source_unavailable"]) {
    const found = result(); found.status = "partial";
    found.sources.push({ ...clone(found.sources[0]), sourceId: "working" });
    found.sources[0].coverage.completeness = "unknown";
    found.issues = [{ code, sourceId: "fixture-source", message: "Source work did not succeed." }];
    assert.equal(C.validateActivityResultShape(found), false);
    assert.equal(C.validateActivityResult(found, activityRequest()), false);
    found.items = []; assert.equal(C.validateActivityResultShape(found), true);
  }
});

test("unavailable thumbnails validate as an explicit neutral fallback, never enabled artwork", () => {
  const found = result(); illustrated(found.items[0]);
  found.items[0].thumbnail.permission = "unavailable";
  found.items[0].evidence.find(e => e.field === "thumbnail").kind = "unknown";
  assert.equal(C.validateActivityResultShape(found), true);
  found.items[0].thumbnail.evidenceId = "age"; assert.equal(C.validateActivityResultShape(found), false);
});

test("serialized card identity stays within the 400-character conversation bound after escaping", () => {
  const found = result(); found.items[0].eventId = '"'.repeat(120); found.items[0].occurrenceId = '"'.repeat(120);
  assert.equal(C.validateActivityResultShape(found), false);
  assert.throws(() => C.activityCardId(found.items[0]), { message: "invalid_result" });
  found.items[0].eventId = "a".repeat(120); found.items[0].occurrenceId = "b".repeat(120);
  assert.equal(C.validateActivityResultShape(found), true); assert.ok(C.activityCardId(found.items[0]).length <= 400);
});