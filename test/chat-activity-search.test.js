"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { activityRequest } = require("./fixtures/chat-context");
const contract = require("../shared/chat-contract");
const { searchActivities } = require("../activity-preview/chat-search");
const search = request => searchActivities(request, { signal: new AbortController().signal });
const vm = require("node:vm");
const fs = require("node:fs");
const fixtures = require("../activity-preview/chat-activity-fixtures");

function isolatedSearch(changePool = () => {}) {
  let calls = 0;
  const forbidden = () => { throw new Error("Forbidden side effect"); };
  const context = vm.createContext({
    AbortSignal, structuredClone, FamilyChatContract: contract,
    FamilyChatActivityFixtures: { createPool(range) {
      calls++;
      const pool = fixtures.createPool(range);
      changePool(pool);
      return pool;
    } },
    fetch: forbidden, setTimeout: forbidden, XMLHttpRequest: forbidden
  });
  for (const name of ["document", "localStorage", "sessionStorage", "FamilyChatCalendar"]) {
    Object.defineProperty(context, name, { get: forbidden });
  }
  vm.runInContext(fs.readFileSync(require.resolve("../activity-preview/chat-search"), "utf8"), context);
  return { search: request => context.FamilyChatActivities.searchActivities(request, { signal: new AbortController().signal }),
    get calls() { return calls; }, context };
}

test("synthetic alternatives preserve correlation, evidence and unknowns", async () => {
  const request = activityRequest();
  const before = structuredClone(request);
  const result = await search(request);
  assert.ok(contract.validateActivityResult(result, request));
  assert.equal(result.status, "results");
  assert.deepEqual(result.items.map(item => item.category), ["basketball", "movie"]);
  assert.equal(result.calendarFit, "not_checked");
  for (const item of result.items) {
    assert.equal(item.calendarFit, "not_checked");
    assert.equal(item.travel.durationMinutes, null);
    assert.ok(item.unknowns.includes("Ticket availability unknown."));
    assert.ok(item.evidence.every(entry => entry.kind === "synthetic" && entry.retrievedAt === null));
  }
  assert.deepEqual(request, before);
});
test("public snapshots rank preferred teams and keep real movies untimed through refinement", async () => {
  const snapshot = require("../activity-preview/chat-public-snapshot");
  const harness = isolatedSearch(pool => Object.assign(pool, snapshot.createPool(current.range)));
  const current = activityRequest();
  const october = await harness.search(current);
  assert.equal(october.status, "partial");
  assert.deepEqual(Array.from(october.items, item => item.title), ["新北中信特攻 vs 福爾摩沙夢想家", "Forgotten Island"]);
  assert.equal(october.items[0].endAt, null);
  assert.equal(october.items[1].startAt, null);
  assert.match(october.items[0].rationale.map(reason => reason.text).join(" "), /preferred team: 新北中信特攻/);
  assert.doesNotMatch(october.items[0].rationale.map(reason => reason.text).join(" "), /中信兄弟/);
  assert.match(october.items[1].rationale.map(reason => reason.text).join(" "), /matches your preferred area.*Age 7/);
  assert.ok(october.items.every(item => item.thumbnail === null && item.assessment === "needs_checking"));
  current.preferences.preferredTeams = ["CTBC DEA"];
  const englishAlias = await harness.search(current);
  assert.match(englishAlias.items[0].rationale.map(reason => reason.text).join(" "), /preferred team: CTBC DEA/);
  for (const team of ["福爾摩沙夢想家", "Formosa Dreamers"]) {
    current.preferences.preferredTeams = [team];
    const matched = await harness.search(current);
    assert.ok(matched.items[0].rationale.some(reason => reason.text.includes(`preferred team: ${team}`)));
    assert.equal(matched.items[0].title, "新北中信特攻 vs 福爾摩沙夢想家");
  }
  current.preferences.preferredTeams = ["中信兄弟"];
  current.preferences.interests = ["movies"];
  const reranked = await harness.search(current);
  assert.equal(reranked.items[0].title, "Forgotten Island");
  assert.doesNotMatch(reranked.items.flatMap(item => item.rationale.map(reason => reason.text)).join(" "), /preferred team/);
  current.range = { startDate: "2026-09-19", endDate: "2026-09-20", timeZone: "Asia/Taipei" };
  const sooner = await harness.search(current);
  assert.equal(sooner.items.length, 1);
  assert.match(sooner.items[0].title, /Chiikawa/);
  assert.equal(sooner.items[0].startAt, null);
  assert.notEqual(sooner.items[0].eventId, october.items[1].eventId);
  assert.equal(contract.validateActivityResult(sooner, current), true);
});

test("nearer range returns a distinct screening without inventing basketball", async () => {
  const request = activityRequest();
  const initial = await search(request);
  request.range = { startDate: "2026-09-19", endDate: "2026-09-20", timeZone: "Asia/Taipei" };
  request.requestId = "nearer";
  request.generation = 2;
  request.contextRevision = 2;
  const result = await search(request);
  assert.ok(contract.validateActivityResult(result, request));
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].occurrenceId, "sep20-1400");
  assert.notEqual(result.items[0].occurrenceId, initial.items[1].occurrenceId);
});

test("hard exclusions and unknown required travel or cost remain explicit", async () => {
  const request = activityRequest();
  request.preferences.constraints.excludedCategories = [" Basketball "];
  request.preferences.constraints.maxTravelMinutes = 30;
  request.preferences.constraints.budget = { amount: 100, currency: "TWD", basis: "per_child" };
  const result = await search(request);
  assert.equal(result.status, "unknown");
  assert.deepEqual(result.items.map(item => item.category), ["movie"]);
  assert.ok(result.items[0].unknowns.some(text => text.startsWith("Budget needs")));
  assert.ok(result.items[0].unknowns.some(text => text.startsWith("Travel limit")));
  request.preferences.constraints.setting = "outdoor";
  assert.equal((await search(request)).status, "empty");
});

test("invalid, live, missing signal and cancelled requests fail closed", async () => {
  await assert.rejects(search({ ...activityRequest(), chat: "private" }), /^Error: invalid_request$/);
  await assert.rejects(search({ ...activityRequest(), mode: "live" }), /^Error: mode_not_enabled$/);
  await assert.rejects(searchActivities(activityRequest()), /^Error: invalid_request$/);
  const controller = new AbortController();
  controller.abort("private reason");
  await assert.rejects(searchActivities(activityRequest(), { signal: controller.signal }), { name: "AbortError", message: "request_cancelled" });
  const pendingController = new AbortController();
  const pending = searchActivities(activityRequest(), { signal: pendingController.signal });
  pendingController.abort();
  await assert.rejects(pending, { name: "AbortError" });
});

test("hard age, setting and comparable budget violations precede ranking and six-card limit", async () => {
  const request = activityRequest();
  request.preferences.interests = ["sports"];
  request.preferences.constraints.budget = { amount: 100, currency: "TWD", basis: "per_child" };
  const harness = isolatedSearch(pool => {
    const original = pool.candidates[1];
    pool.candidates = Array.from({ length: 12 }, (_, index) => {
      const entry = structuredClone(original);
      entry.item.occurrenceId = `occurrence-${String(index).padStart(2, "0")}`;
      if (index < 6) {
        entry.item.ageGuidance = { minAge: 12, maxAge: null, rule: "required", evidenceId: "age" };
        entry.interests = ["sports"];
      }
      return entry;
    });
    pool.candidates[6].item.cost = { amount: 101, currency: "TWD", basis: "per_child", evidenceId: "cost" };
    pool.candidates[6].item.evidence.push({ ...pool.candidates[6].item.evidence[0], id: "cost", field: "cost", text: "Fictional TWD 101 per child." });
  });
  const result = await harness.search(request);
  assert.equal(result.items.length, 5);
  assert.ok(result.items.every(item => Number(item.occurrenceId.slice(-2)) >= 7));
  assert.ok(contract.validateActivityResult(result, request));
});

test("candidate cap examines stable identities, reports partial even with zero matches", async () => {
  const harness = isolatedSearch(pool => {
    const original = pool.candidates[1];
    pool.candidates = Array.from({ length: 41 }, (_, index) => {
      const entry = structuredClone(original);
      entry.item.occurrenceId = `item-${String(index).padStart(2, "0")}`;
      return entry;
    }).reverse();
  });
  const request = activityRequest();
  const result = await harness.search(request);
  assert.equal(result.status, "partial");
  assert.equal(result.items.length, 6);
  assert.equal(result.items[0].occurrenceId, "item-00");
  assert.ok(result.issues.some(issue => issue.code === "candidate_limit"));
  assert.ok(contract.validateActivityResult(result, request));
  request.preferences.constraints.excludedCategories = ["movie"];
  const emptyPartial = await harness.search(request);
  assert.equal(emptyPartial.status, "partial");
  assert.equal(emptyPartial.items.length, 0);
  assert.ok(!emptyPartial.issues.some(issue => issue.code === "no_matches"));
});

test("partial and unavailable sources cannot become complete empty searches", async () => {
  for (const allFailed of [false, true]) {
    const harness = isolatedSearch(pool => {
      for (const source of pool.sources.slice(0, allFailed ? 2 : 1)) {
        source.coverage.completeness = "unknown";
        pool.issues.push({ code: "source_unavailable", sourceId: source.sourceId, message: "Synthetic failure." });
      }
    });
    const request = activityRequest();
    const result = await harness.search(request);
    assert.equal(result.status, allFailed ? "unavailable" : "partial");
    assert.equal(result.items.length, allFailed ? 0 : 1);
    assert.ok(contract.validateActivityResult(result, request));
  }
});

test("interests and exact fictional team names rank, never restrict or invent matches", async () => {
  const request = activityRequest();
  request.preferences.interests = [" MOVIES "];
  assert.equal((await search(request)).items[0].category, "movie");
  request.preferences.interests = [];
  request.preferences.preferredTeams = [" Comets "];
  assert.equal((await search(request)).items[0].category, "basketball");
  request.preferences.preferredTeams = ["Unknown team"];
  assert.equal((await search(request)).items.length, 2);
});

test("edited interests remain ranking preferences for either basis, including unmatched and empty choices", async () => {
  const harness = isolatedSearch();
  for (const interestBasis of ["demo_fixture", "parent_confirmed"]) {
    for (const { interests, preferredTeams, categories } of [
      { interests: [" MOVIES "], preferredTeams: [], categories: ["movie", "basketball"] },
      { interests: ["sports"], preferredTeams: [], categories: ["basketball", "movie"] },
      { interests: ["science", "nature"], preferredTeams: ["Unknown team"], categories: ["basketball", "movie"] },
      { interests: [], preferredTeams: [], categories: ["basketball", "movie"] },
      { interests: ["movies"], preferredTeams: [" Comets "], categories: ["basketball", "movie"] }
    ]) {
      const request = activityRequest();
      Object.assign(request.preferences, { ages: [12], interestBasis, interests, preferredTeams });
      request.preferences.origin.area = "Da'an District, Taipei City";
      const before = structuredClone(request);
      const result = await harness.search(request);
      assert.ok(contract.validateActivityResult(result, request));
      assert.deepEqual(Array.from(result.items, item => item.category), categories);
      assert.deepEqual(request, before);
      assert.equal(result.calendarFit, "not_checked");
    }
  }
  assert.equal(harness.calls, 10);
  const request = activityRequest();
  request.preferences.interests = ["movies"];
  request.preferences.interestBasis = "parent_confirmed";
  request.preferences.constraints.excludedCategories = ["movie"];
  const result = await harness.search(request);
  assert.deepEqual(Array.from(result.items, item => item.category), ["basketball"]);
});

test("edited preferences rank before the six-card limit without excluding other interests", async () => {
  const harness = isolatedSearch(pool => {
    const original = pool.candidates[1];
    pool.candidates = Array.from({ length: 7 }, (_, index) => {
      const entry = structuredClone(original);
      entry.item.occurrenceId = `rank-${index}`;
      entry.interests = index === 6 ? ["science"] : ["movies"];
      return entry;
    });
  });
  const request = activityRequest();
  request.preferences.ages = [12];
  request.preferences.interests = ["science"];
  request.preferences.interestBasis = "parent_confirmed";
  const result = await harness.search(request);
  assert.ok(contract.validateActivityResult(result, request));
  assert.deepEqual(Array.from(result.items, item => item.occurrenceId),
    ["rank-6", "rank-0", "rank-1", "rank-2", "rank-3", "rank-4"]);
});

test("non-Xinyi origins preserve fixed venues and unknown travel without fabricated nearness", async () => {
  const harness = isolatedSearch();
  const request = activityRequest();
  request.preferences.ages = [12];
  const original = await harness.search(request);
  for (const area of ["Da'an District, Taipei City", "Lingya District, Kaohsiung City"]) {
    request.preferences.origin.area = area;
    request.requestId = `edited-${request.generation + 1}`;
    request.generation++;
    request.contextRevision++;
    request.trigger = { kind: "explicit_retry", actionId: request.requestId };
    const before = structuredClone(request);
    const callsBefore = harness.calls;
    const result = await harness.search(request);
    assert.equal(harness.calls, callsBefore + 1);
    assert.ok(contract.validateActivityResult(result, request));
    assert.equal(result.requestId, request.requestId);
    assert.equal(result.generation, request.generation);
    assert.equal(result.contextRevision, request.contextRevision);
    assert.deepEqual(request, before);
    assert.deepEqual(result.items, original.items);
    assert.deepEqual(Array.from(result.items, item => item.venue.name), ["Sample Taipei Arena", "Sample Xinyi Cinema"]);
    for (const item of result.items) {
      assert.ok(Object.values(item.travel).every(value => value === null));
      assert.ok(item.unknowns.includes("Travel time and distance unknown; district-only origin is not routed."));
      assert.ok(item.evidence.every(entry => entry.field !== "travel"));
      assert.equal(item.calendarFit, "not_checked");
    }
    assert.equal(result.items[0].assessment, "needs_checking");
    assert.ok(result.items[0].unknowns.includes("Age guidance unknown."));
  }
  request.preferences.travelMode = "transit";
  request.preferences.constraints.maxTravelMinutes = 30;
  const limited = await harness.search(request);
  assert.ok(contract.validateActivityResult(limited, request));
  assert.equal(limited.status, "unknown");
  assert.equal(limited.items.length, 2);
  for (const item of limited.items) {
    assert.ok(Object.values(item.travel).every(value => value === null));
    assert.ok(item.unknowns.includes("Travel limit cannot be checked without a comparable route."));
  }
});

test("shared date validation handles whole containment, exact midnight and fractional reference", async () => {
  const request = activityRequest();
  request.range = { startDate: "2026-10-10", endDate: "2026-10-10", timeZone: "Asia/Taipei" };
  const boundary = endAt => isolatedSearch(pool => {
    pool.candidates = [pool.candidates[0]];
    pool.candidates[0].item.endAt = endAt;
  }).search(request);
  assert.equal((await boundary("2026-10-11T00:00:00+08:00")).items.length, 1);
  assert.equal((await boundary("2026-10-11T00:00:00.0001+08:00")).items.length, 0);
  request.referenceNow = "2026-10-10T09:00:00.0001Z";
  assert.equal((await search(request)).items.length, 0);
});

test("unknown end and recommended age mismatch remain needs-checking, not hard exclusions", async () => {
  const harness = isolatedSearch(pool => {
    pool.candidates = [pool.candidates[1]];
    pool.candidates[0].item.endAt = null;
    pool.candidates[0].item.assessment = "needs_checking";
    pool.candidates[0].item.ageGuidance.minAge = 12;
  });
  const result = await harness.search(activityRequest());
  assert.equal(result.status, "unknown");
  assert.equal(result.items.length, 1);
  assert.ok(result.items[0].unknowns.some(text => text.startsWith("End time")));
  assert.ok(result.items[0].unknowns.some(text => text.startsWith("Recommended age")));
});

for (const requestedAge of [0, 12, 120]) {
  for (const rule of ["recommended", "required"]) {
    test(`${rule} age guidance uses requested age ${requestedAge} and inclusive bounds`, async () => {
      const request = activityRequest();
      request.preferences.ages = [requestedAge];
      const before = structuredClone(request);
      const guidanceCases = [
        { minAge: requestedAge, maxAge: requestedAge, matches: true },
        { minAge: requestedAge, maxAge: null, matches: true },
        { minAge: null, maxAge: requestedAge, matches: true },
        ...(requestedAge < 120 ? [{ minAge: requestedAge + 1, maxAge: null, matches: false }] : []),
        ...(requestedAge > 0 ? [{ minAge: null, maxAge: requestedAge - 1, matches: false }] : [])
      ];
      for (const { minAge, maxAge, matches } of guidanceCases) {
        const harness = isolatedSearch(pool => {
          pool.candidates = [pool.candidates[1]];
          const item = pool.candidates[0].item;
          item.ageGuidance = { minAge, maxAge, rule, evidenceId: "age" };
          item.evidence.find(entry => entry.id === "age").text =
            `Synthetic ${rule} age guidance: minimum ${minAge}, maximum ${maxAge}.`;
        });
        const result = await harness.search(request);
        assert.ok(contract.validateActivityResult(result, request));
        assert.deepEqual(request, before);
        if (!matches && rule === "required") {
          assert.equal(result.status, "empty");
          assert.equal(result.items.length, 0);
          assert.ok(result.issues.some(issue => issue.code === "no_matches"));
          continue;
        }
        assert.equal(result.items.length, 1);
        assert.equal(result.status, matches ? "results" : "unknown");
        assert.equal(result.items[0].assessment, matches ? "candidate" : "needs_checking");
        const warnings = Array.from(result.items[0].unknowns).filter(text => text.startsWith("Recommended age"));
        assert.deepEqual(warnings, matches ? [] : [
          `Recommended age guidance does not match age ${requestedAge}; suitability needs checking.`
        ]);
      }
    });
  }
}

test("browser module is inert, isolated and rejects invalid data before fixture work", async () => {
  const harness = isolatedSearch();
  assert.equal(harness.calls, 0);
  for (const extra of [{ rawChat: "unsafe" }, { mode: "live" }, { version: "old" }, { calendarFit: "free" }]) {
    await assert.rejects(harness.search({ ...activityRequest(), ...extra }));
  }
  assert.equal(harness.calls, 0);
  const controller = new AbortController();
  const pending = harness.context.FamilyChatActivities.searchActivities(activityRequest(), { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(harness.calls, 0);
  assert.ok(contract.validateActivityResult(await harness.search(activityRequest()), activityRequest()));
  assert.equal(harness.calls, 1);
});

test("each request snapshots input, returns independent data and rejects corrupted fixture evidence", async () => {
  const request = activityRequest();
  const pending = search(request);
  request.requestId = "changed";
  const result = await pending;
  assert.equal(result.requestId, "request-1");
  result.items[0].title = "mutated";
  assert.equal((await search(activityRequest())).items[0].title, "Comets vs Grove");
  const harness = isolatedSearch(pool => { pool.candidates[0].item.evidence = []; });
  await assert.rejects(harness.search(activityRequest()), /^Error: invalid_result$/);
});

test("cancellation after fixture work still rejects and does not publish a result", async () => {
  const controller = new AbortController();
  const harness = isolatedSearch(() => controller.abort());
  await assert.rejects(harness.context.FamilyChatActivities.searchActivities(activityRequest(), { signal: controller.signal }), { name: "AbortError" });
  assert.equal(harness.calls, 1);
});

test("unknown setting and non-comparable prices cannot confirm required constraints", async () => {
  const request = activityRequest();
  request.preferences.constraints.setting = "indoor";
  request.preferences.constraints.budget = { amount: 100, currency: "TWD", basis: "per_child" };
  const harness = isolatedSearch(pool => {
    pool.candidates = [pool.candidates[1]];
    const item = pool.candidates[0].item;
    item.setting = "unknown";
    item.cost = { amount: 1, currency: "USD", basis: "per_person", evidenceId: "cost" };
    item.evidence.push({ ...item.evidence[0], id: "cost", field: "cost", text: "Fictional USD 1 per person." });
  });
  const data = await harness.search(request);
  assert.equal(data.status, "unknown");
  assert.equal(data.items[0].assessment, "needs_checking");
  assert.ok(data.items[0].unknowns.includes("Indoor/outdoor requirement needs checking."));
  assert.ok(data.items[0].unknowns.some(text => text.startsWith("Budget needs checking")));
});
