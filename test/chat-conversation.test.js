"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const Core = require("../chat/conversation-core"), Contract = require("../shared/chat-contract");
const { demoContext } = require("./fixtures/chat-context");
function empty(request) {
  return { version: request.version, requestId: request.requestId, generation: request.generation,
    contextRevision: request.contextRevision, mode: request.mode, range: { ...request.range }, status: "empty",
    sources: [{ sourceId: "test", name: "Synthetic test", url: null, kind: "synthetic",
      coverage: { range: { ...request.range }, categories: [], completeness: "complete" }, retrievedAt: null, freshness: "synthetic" }],
    items: [], issues: [{ code: "no_matches", sourceId: null, message: "No synthetic matches." }], calendarFit: "not_checked" };
}
function harness() {
  const calls = [], timers = new Map(), changes = []; let timerSequence = 0;
  const core = Core.createConversation({
    searchActivities(request, options) { return new Promise((resolve, reject) => calls.push({ request, ...options, resolve, reject })); },
    schedule(callback, delay) { assert.equal(delay, 10000); timers.set(++timerSequence, callback); return timerSequence; },
    unschedule(timer) { timers.delete(timer); }, onChange: state => changes.push(state)
  });
  return { core, calls, timers, changes };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
const weekend = { startDate: "2026-09-19", endDate: "2026-09-20", timeZone: "Asia/Taipei" };
test("retired activity history uses natural copy while clearing cards and preserving request fencing", async () => {
  const activities = require("../activity-preview/chat-search");
  const requests = [];
  let release;
  const core = Core.createConversation({ searchActivities(request, options) {
    requests.push(request);
    if (requests.length === 1) return activities.searchActivities(request, options);
    return new Promise(resolve => { release = async () => resolve(await activities.searchActivities(request, { signal: new AbortController().signal })); });
  } });
  try {
    await core.submit("October ideas");
    const original = core.snapshot().messages.find(entry => entry.kind === "activity_results");
    assert.ok(original.cardIds.length > 0);
    const pending = core.submit("Could we do something sooner, like this weekend?");
    const loading = core.snapshot();
    const retired = loading.messages.find(entry => entry.id === original.id);
    assert.equal(retired.kind, "status");
    assert.equal(retired.text, "Earlier suggestions");
    assert.deepEqual(retired.cardIds, []);
    assert.equal(loading.result, null);
    assert.equal(loading.status, "loading");
    assert.equal(loading.dispatched, 2);
    assert.deepEqual(requests[1].range, weekend);
    core.pause();
    await release(); await pending;
    assert.equal(core.snapshot().result, null);
    assert.equal(core.snapshot().dispatched, 2);
  } finally { core.dispose(); }
});

test("processing lists only current and upcoming actions for activities, meeting review and demo invitation", async () => {
  const changes = [], commands = [];
  const core = Core.createConversation({
    prepareSession: async () => {}, searchActivities: request => empty(request), assessActivities: () => null,
    coordinateMeeting(action) {
      commands.push(action);
      return action === "review" ? { state: "ask", overlapMinutes: 30 } : { state: "invited" };
    },
    onChange: state => changes.push(state)
  });
  await core.submit("October ideas");
  assert.deepEqual(changes.filter(state => state.processingActions.length).map(state => state.processingActions), [
    ["load_calendars", "search_saved_activities", "compare_activity_times"],
    ["search_saved_activities", "compare_activity_times"], ["compare_activity_times"]
  ]);
  assert.deepEqual(core.snapshot().processingActions, []);
  changes.length = 0;
  core.reviewMeeting();
  await core.submit("Yes, please send Parent A an invitation.");
  assert.deepEqual(changes.filter(state => state.processingActions.length).map(state => state.processingActions), [
    ["check_school_meeting"], ["send_demo_invitation"]
  ]);
  assert.deepEqual(commands, ["review", "send_invitation"]);
  assert.deepEqual(core.snapshot().processingActions, []);
  core.reset(); changes.length = 0;
  await core.submit("Can you check my schedule for the school meeting?");
  assert.deepEqual(changes.find(state => state.status === "preparing").processingActions, ["load_calendars", "check_school_meeting"]);
  assert.ok(changes.every(state => !state.processingActions.includes("search_saved_activities")));
  core.dispose();
});
test("async invitation preparation deduplicates, revalidates and fails closed across interruption", async () => {
  for (const outcome of ["complete", "reset", "pause", "dispose", "calendarChanged", "preferences", "reject", "timeout", "stale"]) {
    let resolve, reject, signal;
    const commands = [], timers = new Map(); let sequence = 0;
    const core = Core.createConversation({ searchActivities: request => empty(request),
      prepareInvitation(options) { signal = options.signal; return new Promise((done, fail) => { resolve = done; reject = fail; }); },
      coordinateMeeting(action) {
        commands.push(action);
        return action === "review" ? { state: "ask", overlapMinutes: 30 } : { state: outcome === "stale" ? "unavailable" : "invited" };
      },
      schedule(callback, delay) { timers.set(++sequence, { callback, delay }); return sequence; },
      unschedule(timer) { timers.delete(timer); }
    });
    await core.reviewMeeting();
    const pending = core.submit("Yes, please send Parent A an invitation.");
    assert.equal(core.submit("Yes, please send Parent A an invitation."), pending);
    assert.equal(core.snapshot().status, "sending_demo_invitation");
    assert.deepEqual(commands, ["review"]);
    if (["reset", "pause", "dispose", "calendarChanged"].includes(outcome)) core[outcome]();
    if (outcome === "preferences") core.applyPreferences({ ...core.snapshot().context.preferences, ages: [8] });
    if (outcome === "timeout") [...timers.values()].find(timer => timer.delay === 10000).callback();
    if (outcome === "reject") reject(Error("preparation failed")); else resolve();
    await pending;
    assert.equal(commands.filter(command => command === "send_invitation").length, ["complete", "stale"].includes(outcome) ? 1 : 0);
    assert.equal(core.snapshot().meetingState === "invited", outcome === "complete");
    assert.equal(core.snapshot().processingActions.length, 0);
    assert.equal(signal.aborted, true);
    assert.equal(timers.size, 0);
    core.dispose();
  }
});
test("reset during meeting progress prevents the retired review or invitation action", async () => {
  for (const target of ["checking_meeting", "sending_demo_invitation"]) {
    const commands = [];
    const core = Core.createConversation({ searchActivities: request => empty(request),
      coordinateMeeting(action) {
        commands.push(action);
        return action === "review" ? { state: "ask", overlapMinutes: 30 } : { state: "invited" };
      },
      onChange(state) { if (state.status === target) core.reset(); }
    });
    await core.submit("October ideas"); core.reviewMeeting();
    if (target === "sending_demo_invitation") await core.submit("Yes, please send Parent A an invitation.");
    assert.equal(commands.includes(target === "checking_meeting" ? "review" : "send_invitation"), false);
    assert.deepEqual(core.snapshot().processingActions, []);
    assert.equal(core.snapshot().context.triggerState, "not_started");
    core.dispose();
  }
});
test("actual local comparison filters conflicting activities and never forwards Calendar data to search", async () => {
  const fixtures = require("../owner/chat-calendar-fixtures");
  const activities = require("../activity-preview/chat-search");
  const transport = fixtures.create({ scenario: () => "loaded" });
  const requestOptions = body => ({ method: "POST", credentials: "omit", cache: "no-store", redirect: "error", body: JSON.stringify(body) });
  const body = { acknowledged: true, startDate: "2026-10-09", endDate: "2026-10-15", refresh: false };
  const calls = [];
  let allConflict = false;
  const core = Core.createConversation({
    prepareSession: async () => {
      await transport.fetch("/api/child/sync", requestOptions(body));
      await transport.fetch("/api/availability", requestOptions({ ...body, requestId: "11111111-1111-4111-8111-111111111111" }));
    },
    async searchActivities(request, options) {
      calls.push(request);
      const result = await activities.searchActivities(request, options);
      for (const item of result.items) {
        if (request.range.startDate === "2026-10-09" && (allConflict || item.category === "basketball")) {
          item.startAt = "2026-10-10T09:30:00+08:00"; item.endAt = "2026-10-10T10:30:00+08:00";
        }
      }
      return result;
    },
    assessActivities: items => transport.assessOccurrences(items)
  });
  await core.submit("October ideas");
  const state = core.snapshot();
  assert.equal(state.result.items.length, 1); assert.equal(state.result.items[0].category, "movie");
  assert.ok(state.calendarAssessment.items.some(item => item.status === "conflict"));
  assert.equal(Contract.validateActivityResult(state.result, calls[0]), true);
  assert.doesNotMatch(JSON.stringify([state, calls]), /Sample studio visit|sourceName|"slots"|"events"/);
  allConflict = true; await core.retry();
  assert.equal(core.snapshot().result.status, "empty");
  assert.equal(core.snapshot().result.items.length, 0);
  assert.equal(Contract.validateActivityResult(core.snapshot().result, calls[1]), true);
  await core.submit("Sooner please");
  assert.equal(core.snapshot().calendarAssessment.items[0].reason, "outside_coverage");
  assert.equal(core.snapshot().result.items.length, 1);
  assert.doesNotMatch(JSON.stringify(calls), /calendar-fit|checkedAt|no_conflict|busy/);
  core.dispose();
});

test("calendar changes fence a pending search; malformed assessment fails closed", async () => {
  const activities = require("../activity-preview/chat-search");
  let release, latestSignal;
  const core = Core.createConversation({ searchActivities(request, options) {
    latestSignal = options.signal;
    return new Promise(resolve => { release = async () => resolve(await activities.searchActivities(request, { signal: new AbortController().signal })); });
  }, assessActivities: () => ({ items: [], privateCalendarPayload: "never retain" }) });
  const first = core.submit("October ideas");
  core.calendarChanged(); assert.equal(latestSignal.aborted, true);
  await release(); await first;
  assert.equal(core.snapshot().result, null);
  const retry = core.retry(); await release(); await retry;
  assert.ok(core.snapshot().calendarAssessment.items.every(item => item.status === "unknown"));
  assert.doesNotMatch(JSON.stringify(core.snapshot()), /privateCalendarPayload|never retain/);
  core.dispose();
});

test("meeting replies require explicit consent and reject malformed summaries without leaking calendar content", async () => {
  for (const invalid of [true, false]) {
    const requests = [], commands = [];
    const core = Core.createConversation({
      searchActivities(request) { requests.push(request); return empty(request); },
      coordinateMeeting(action) {
        commands.push(action);
        if (action === "review") return { state: "ask", overlapMinutes: 30 };
        if (action === "send_invitation") return invalid ? { state: "invited", privateTitle: "never disclose" } : { state: "invited" };
        return { state: action === "cancel" ? "cancelled" : "declined" };
      }
    });
    await core.submit("October ideas"); core.reviewMeeting();
    await core.submit("yes, but both parents must attend");
    assert.deepEqual(commands, ["review"]);
    assert.equal(core.snapshot().meetingState, "ask");
    await core.submit("對");
    assert.equal(core.snapshot().meetingState, "ask");
    await core.submit("Yes, please send Parent A an invitation.");
    assert.equal(core.snapshot().meetingState, invalid ? "unavailable" : "invited");
    assert.equal(core.snapshot().demoStep, 1);
    assert.equal(requests.length, 1);
    assert.doesNotMatch(JSON.stringify([requests, core.snapshot()]), /never disclose|privateTitle/);
    await core.submit("Yes");
    assert.equal(commands.filter(action => action === "send_invitation").length, 1);
    await core.submit("取消"); assert.equal(core.snapshot().meetingState, "closed");
    await core.submit("Continue activities"); assert.equal(requests.length, 1);
    await core.submit("Sooner please"); assert.equal(requests.length, 2);
    core.dispose();
  }
});

test("fresh school question checks both parents and offers one explicit demo invitation without an activity request", async () => {
  const commands = [], requests = [];
  let preparations = 0;
  const core = Core.createConversation({ prepareSession() { preparations++; },
    searchActivities(request) { requests.push(request); return empty(request); },
    coordinateMeeting(action) {
      commands.push(action);
      return action === "review" ? { state: "ask", overlapMinutes: 30 } :
        { state: { send_invitation: "invited", cancel: "cancelled", decline: "declined" }[action] };
    } });
  const before = core.snapshot().context;
  await core.submit("Can you check my schedule for the school meeting?");
  assert.equal(preparations, 1);
  assert.equal(core.snapshot().messages[0].text, "Can you check my schedule for the school meeting?");
  assert.match(core.snapshot().messages.at(-1).text, /overlaps by half an hour.*Parent A's calendar looks clear then.*If only one parent needs to attend, shall I invite Parent A to Child's school meeting on Friday, October 16, 2026, 3:30-4:30 PM \(Asia\/Taipei\)\?/);
  for (const reply of ["Maybe", "yes, but don't send", "Yes. Could Parent A go instead?", "Yes", "Please send Parent A an invitation if he's willing"]) await core.submit(reply);
  assert.deepEqual(commands, ["review"]);
  await core.submit("Yes, one parent is enough. Please send Parent A an invitation.");
  assert.equal(core.snapshot().meetingState, "invited");
  assert.match(core.snapshot().messages.at(-1).text, /Parent A's invitation for Child's school meeting on Friday, October 16, 2026, 3:30-4:30 PM \(Asia\/Taipei\) is awaiting his response/);
  await core.submit("Yes, one parent is enough. Please send Parent A an invitation.");
  assert.equal(commands.filter(command => command === "send_invitation").length, 1);
  assert.equal(core.snapshot().dispatched, 0); assert.equal(core.snapshot().demoStep, 0);
  assert.equal(requests.length, 0);
  assert.deepEqual(core.snapshot().context.activityRange, before.activityRange);
  assert.deepEqual(core.snapshot().context.preferences, before.preferences);
  await core.submit("Undo"); assert.equal(core.snapshot().meetingState, "closed");
  await core.submit("Continue activities"); assert.equal(requests.length, 0);
  await core.submit("October ideas"); assert.equal(requests.length, 1);
  assert.equal(core.snapshot().demoStep, 1);
  await core.submit("Sooner please"); assert.equal(requests.length, 2);
  core.dispose();
});

test("meeting preparation is coalesced and fenced by stop, reset, dispose, preferences and timeout", async () => {
  for (const action of ["pause", "reset", "dispose", "preferences", "timeout"]) {
    let release, timeout;
    const commands = [], searches = [];
    const core = Core.createConversation({ prepareSession: () => new Promise(resolve => { release = resolve; }),
      coordinateMeeting(command) { commands.push(command); return { state: "cancelled" }; },
      searchActivities(request) { searches.push(request); return empty(request); },
      schedule(callback) { timeout = callback; return 1; }, unschedule() {} });
    const work = core.submit("Can you check my schedule for the school meeting?");
    assert.equal(core.submit("Yes"), work);
    if (action === "timeout") timeout();
    else if (action === "preferences") {
      const preferences = core.snapshot().context.preferences; preferences.ages = [12]; core.applyPreferences(preferences);
    } else core[action]();
    const before = core.snapshot(); release(); await work; await flush();
    assert.deepEqual(core.snapshot(), before, action);
    assert.equal(commands.includes("review"), false); assert.equal(searches.length, 0);
    core.dispose();
  }
});

test("each meeting consent boundary rejects negative replies and withdraws on reset or context changes", async () => {
  for (const phase of ["ask", "invited"]) {
    for (const change of ["No", "Cancel", "Undo", "reset", "preferences", "calendar", "pause"]) {
      const commands = [], requests = [];
      const core = Core.createConversation({ searchActivities(request) { requests.push(request); return empty(request); },
        coordinateMeeting(action) {
          commands.push(action);
          return action === "review" ? { state: "ask", overlapMinutes: 30 } :
            { state: { send_invitation: "invited", cancel: "cancelled", decline: "declined" }[action] };
        } });
      await core.submit("Can you check my schedule for the school meeting?");
      if (phase === "invited") await core.submit("Yes, please send Parent A an invitation.");
      const confirmed = commands.filter(command => command === "send_invitation").length;
      if (change === "preferences") {
        const preferences = core.snapshot().context.preferences; preferences.ages = [12]; core.applyPreferences(preferences);
      } else if (change === "calendar") core.calendarChanged();
      else if (["reset", "pause"].includes(change)) core[change]();
      else await core.submit(change);
      assert.ok(["cancel", "decline"].includes(commands.at(-1)), `${phase}: ${change}`);
      assert.notEqual(core.snapshot().meetingState, "invited");
      if (change !== "reset") await core.submit("Yes, please send Parent A an invitation.");
      assert.equal(commands.filter(command => command === "send_invitation").length, confirmed);
      assert.equal(requests.length, 0);
      if (["calendar", "preferences"].includes(change)) assert.doesNotMatch(JSON.stringify(core.snapshot().messages), /awaiting his response|Parent A's calendar looks clear/);
      core.dispose();
    }
  }
});

test("failed meeting preparation and malformed review summaries never grant consent or start activities", async () => {
  for (const failure of ["preparation", "review"]) {
    const commands = [], searches = [];
    const core = Core.createConversation({
      prepareSession() { if (failure === "preparation") throw Error("private detail"); },
      searchActivities(request) { searches.push(request); return empty(request); },
      coordinateMeeting(action) {
        commands.push(action);
        return action === "review" ? { state: "ask", overlapMinutes: 30, privateTitle: "never retain" } : { state: "cancelled" };
      }
    });
    await core.submit("Can you check my schedule for the school meeting?");
    await core.submit("Yes, please send Parent A an invitation.");
    assert.equal(core.snapshot().meetingState, "unavailable");
    assert.equal(commands.includes("send_invitation"), false); assert.equal(searches.length, 0);
    assert.doesNotMatch(JSON.stringify(core.snapshot()), /private detail|privateTitle|never retain/);
    core.dispose();
  }
});

test("first activity message starts preset October dates and never forwards raw text", async () => {
  let release, preparations = 0; const calls = [];
  const core = Core.createConversation({ prepareSession() {
    preparations++; return new Promise(resolve => { release = resolve; });
  }, searchActivities(request) { calls.push(request); return empty(request); } });
  assert.equal(preparations, 0);
  const work = core.submit("How about this weekend?");
  assert.equal(core.submit("How about this weekend?"), work);
  assert.equal(preparations, 1); assert.equal(calls.length, 0);
  assert.deepEqual(core.snapshot().context.activityRange, Core.initialContext().activityRange);
  assert.equal(core.snapshot().demoStep, 1);
  assert.equal(core.snapshot().messages.filter(message => message.role === "parent").length, 1);
  release(); await work;
  assert.equal(calls.length, 1); assert.deepEqual(calls[0].range, Core.initialContext().activityRange);
  assert.doesNotMatch(JSON.stringify(calls), /How about/); core.dispose();
});
test("invalid input never loads or advances; arbitrary opening starts the labeled scenario", async () => {
  let preparations = 0; const calls = [];
  const core = Core.createConversation({ prepareSession() { preparations++; },
    searchActivities(request) { calls.push(request); return empty(request); } });
  for (const value of ["", " ", "x".repeat(501), "hello\nworld", null]) await core.submit(value);
  assert.equal(preparations, 0); assert.equal(calls.length, 0);
  assert.equal(core.snapshot().context.triggerState, "not_started");
  assert.equal(core.snapshot().demoStep, 0);
  await core.submit("Any family ideas for October?");
  assert.equal(preparations, 1); assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].range, Core.initialContext().activityRange);
  assert.match(JSON.stringify(core.snapshot().messages), /2026-10-09 to 2026-10-11/);
  assert.doesNotMatch(JSON.stringify(core.snapshot().messages), /Scripted demo|not interpreted from text/);
  core.dispose();
});
test("explicit Start waits for preparation once, discards its payload and then searches", async () => {
  let release, preparations = 0; const calls = [];
  const core = Core.createConversation({ prepareSession() {
    preparations++; return new Promise(resolve => { release = resolve; });
  }, searchActivities(request) { calls.push(request); return empty(request); } });
  assert.equal(preparations, 0);
  const work = core.start(); assert.equal(core.start(), work);
  assert.equal(preparations, 1); assert.equal(calls.length, 0); assert.equal(core.snapshot().status, "preparing");
  release({ privateCalendarPayload: "never forward" }); await work;
  assert.equal(calls.length, 1); assert.equal(core.snapshot().status, "empty");
  assert.doesNotMatch(JSON.stringify([calls, core.snapshot()]), /privateCalendarPayload|never forward/);
  core.dispose();
});
test("pause, reset, dispose, preference edit and timeout fence late preparation without a search", async () => {
  for (const action of ["pause", "reset", "dispose", "preferences", "timeout"]) {
    let release, timeout; const calls = [];
    const core = Core.createConversation({ prepareSession: () => new Promise(resolve => { release = resolve; }),
      searchActivities(request) { calls.push(request); return empty(request); },
      schedule(callback) { timeout = callback; return 1; }, unschedule() {} });
    const work = core.start();
    if (action === "timeout") timeout();
    else if (action === "preferences") {
      const preferences = core.snapshot().context.preferences; preferences.ages = [12]; core.applyPreferences(preferences);
    } else core[action]();
    const expected = core.snapshot().status; release(); await work; await flush();
    assert.equal(calls.length, 0, action); assert.equal(core.snapshot().status, expected);
    core.dispose();
  }
});
test("preparation rejection never claims Calendar success and still permits independent activities", async () => {
  const core = Core.createConversation({ prepareSession: () => Promise.reject(Error("private calendar failure")),
    searchActivities: request => Promise.resolve(empty(request)) });
  await core.start(); assert.equal(core.snapshot().status, "empty");
  assert.doesNotMatch(JSON.stringify(core.snapshot()), /private calendar failure/);
  core.dispose();
});
test("a retired preparation timer cannot timeout the subsequent activity search", async () => {
  const timers = []; let release, complete;
  const core = Core.createConversation({ prepareSession: () => new Promise(resolve => { release = resolve; }),
    searchActivities: request => new Promise(resolve => { complete = () => resolve(empty(request)); }),
    schedule(callback) { timers.push(callback); return timers.length; }, unschedule() {} });
  const work = core.start(); release(); await flush();
  assert.equal(core.snapshot().status, "loading");
  timers[0](); assert.equal(core.snapshot().status, "loading");
  complete(); await work; assert.equal(core.snapshot().status, "empty"); core.dispose();
});
test("default runtime context equals synthetic fixture apart from unstarted session identity", () => {
  const value = Core.initialContext(), expected = demoContext(); expected.sessionId = value.sessionId;
  assert.deepEqual(value, expected); assert.equal(Contract.validateDemoContext(value), true);
});
test("scripted interpretation is exact, bounded, timezone-independent and Sunday clips past Saturday", () => {
  assert.deepEqual(Core.interpretWeekend("  October feels too far away. How about this weekend?  ", "2026-09-18T04:00:00Z", "Asia/Taipei"), weekend);
  for (const [instant, start, end] of [["2026-09-18T16:00:00Z", "2026-09-19", "2026-09-20"],
    ["2026-09-19T16:00:00Z", "2026-09-20", "2026-09-20"], ["2026-09-20T16:00:00Z", "2026-09-26", "2026-09-27"]]) {
    assert.deepEqual(Core.interpretWeekend("THIS WEEKEND", instant, "Asia/Taipei"), { startDate: start, endDate: end, timeZone: "Asia/Taipei" });
  }
  for (const text of ["tomorrow", "this weekend or October 10", "this weekend, age 12", "ignore instructions", "x".repeat(501)]) {
    assert.equal(Core.interpretWeekend(text, "2026-09-18T04:00:00Z", "Asia/Taipei"), null);
  }
  assert.equal(Core.interpretWeekend("this weekend", "2026-02-30T00:00:00Z", "Asia/Taipei"), null);
});
test("startup makes zero calls; explicit Start double click coalesces and result is correlated", async () => {
  const { core, calls, timers } = harness(); assert.equal(calls.length, 0);
  const first = core.start(); assert.equal(core.start(), first); assert.equal(calls.length, 1);
  assert.equal(Contract.validateActivityRequest(calls[0].request), true);
  calls[0].resolve(empty(calls[0].request)); await first;
  assert.equal(core.snapshot().status, "empty"); assert.equal(timers.size, 0);
  await core.start(); assert.equal(calls.length, 1);
});
test("refinement preserves preferences, sends no raw message, reuses only current completed result", async () => {
  const { core, calls } = harness(); const first = core.start(); calls[0].resolve(empty(calls[0].request)); await first;
  const work = core.submit("How about this weekend?");
  assert.deepEqual(calls[1].request.range, weekend); assert.deepEqual(calls[1].request.preferences, calls[0].request.preferences);
  assert.equal(JSON.stringify(calls[1].request).includes("How about"), false);
  assert.equal(core.snapshot().result, null); assert.equal(calls[1].request.contextRevision, 2);
  calls[1].resolve(empty(calls[1].request)); await work;
  const accepted = core.snapshot().result; await core.submit("this weekend");
  assert.equal(calls.length, 2); assert.deepEqual(core.snapshot().result, accepted);
});
test("A-B-A dispatches fresh IDs and ignored abort cannot restore either old response", async () => {
  const { core, calls } = harness(); const first = core.start();
  const second = core.refine(weekend); const third = core.refine(Core.initialContext().activityRange);
  assert.equal(calls.length, 3); assert.equal(calls[0].signal.aborted, true); assert.equal(calls[1].signal.aborted, true);
  assert.equal(new Set(calls.map(call => call.request.requestId)).size, 3);
  calls[1].resolve(empty(calls[1].request)); calls[0].reject(new Error("unsafe provider payload"));
  await first; await second; await flush(); assert.equal(core.snapshot().status, "loading");
  calls[2].resolve(empty(calls[2].request)); await third;
  assert.equal(core.snapshot().result.requestId, calls[2].request.requestId);
  await core.retry(); assert.equal(calls.length, 3); assert.equal(core.snapshot().status, "budget_exhausted");
});
test("timeout retires before abort and resolves local work even if provider never settles", async () => {
  const { core, calls, timers } = harness(); const work = core.start(); const generation = core.snapshot().generation;
  calls[0].signal.addEventListener("abort", () => assert.equal(core.snapshot().result, null));
  [...timers.values()][0](); await work;
  assert.equal(core.snapshot().status, "request_timeout"); assert.ok(core.snapshot().generation > generation);
  calls[0].resolve(empty(calls[0].request)); await flush(); assert.equal(core.snapshot().status, "request_timeout");
});
test("pause fences, resume does not search, reset clears page data without resetting generation", async () => {
  const { core, calls } = harness(); const work = core.start(), firstSession = core.snapshot().context.sessionId;
  core.pause(); await work; assert.equal(core.snapshot().status, "paused"); core.resume(); assert.equal(calls.length, 1);
  const retry = core.retry(); assert.equal(calls.length, 2); const generation = core.snapshot().generation;
  core.reset(); await retry; assert.ok(core.snapshot().generation > generation);
  assert.equal(core.snapshot().messages.length, 0); assert.equal(core.snapshot().result, null);
  assert.notEqual(core.snapshot().context.sessionId, firstSession);
  calls[1].resolve(empty(calls[1].request)); await flush(); assert.equal(core.snapshot().status, "not_started");
});
test("invalid result and synchronous error are fixed failures without raw payloads or automatic retry", async () => {
  const { core, calls } = harness(); const work = core.start();
  calls[0].resolve({ ...empty(calls[0].request), generation: 1234 }); await work;
  assert.equal(core.snapshot().status, "invalid_result"); assert.equal(core.snapshot().result, null);
  assert.equal(calls.length, 1);
  const failed = Core.createConversation({ searchActivities() { throw Error("private body"); } });
  await failed.start(); assert.equal(failed.snapshot().status, "search_unavailable");
  assert.equal(JSON.stringify(failed.snapshot()).includes("private body"), false);
});
test("third and later inputs finish the demo without dispatch or unbounded messages", async () => {
  const { core, calls } = harness(); const work = core.start(); calls[0].resolve(empty(calls[0].request)); await work;
  const second = core.submit("Something sooner would be nicer"); calls[1].resolve(empty(calls[1].request)); await second;
  for (let index = 0; index < 25; index++) await core.submit("tomorrow");
  assert.ok(core.snapshot().messages.length <= 20); assert.equal(core.snapshot().status, "demo_complete");
  assert.equal(core.snapshot().messages.filter(message => message.text.includes("supported requests are complete")).length, 1);
  assert.equal(calls.length, 2); const external = core.snapshot(); external.context.preferences.ages[0] = 12;
  assert.deepEqual(core.snapshot().context.preferences.ages, [7]);
});
test("duplicate and pending inputs never skip a stage; reset replays October", async () => {
  const { core, calls } = harness();
  const first = core.submit("Plan something for us");
  assert.equal(core.submit("A second click while loading"), first);
  assert.equal(core.snapshot().demoStep, 1);
  assert.equal(core.snapshot().messages.filter(message => message.role === "parent").length, 1);
  calls[0].resolve(empty(calls[0].request)); await first;
  await core.submit("  Plan something for us  "); await core.submit(" ");
  assert.equal(calls.length, 1); assert.equal(core.snapshot().demoStep, 1);
  const second = core.submit("Could we go sooner?");
  assert.equal(core.submit("Repeated click"), second);
  assert.deepEqual(calls[1].request.range, weekend);
  assert.deepEqual(calls[1].request.preferences, calls[0].request.preferences);
  assert.doesNotMatch(JSON.stringify(calls.map(call => call.request)), /Plan something|go sooner/);
  core.reset(); await second;
  assert.equal(core.snapshot().demoStep, 0);
  calls[1].resolve(empty(calls[1].request)); await flush();
  assert.equal(core.snapshot().result, null);
  const replay = core.submit("Plan something for us");
  assert.deepEqual(calls[2].request.range, Core.initialContext().activityRange);
  calls[2].resolve(empty(calls[2].request)); await replay; core.dispose();
});
test("cancelled or failed stage requires explicit retry, not the next scene", async () => {
  for (const outcome of ["pause", "failure"]) {
    const { core, calls } = harness(); const first = core.submit("October outing");
    if (outcome === "pause") { core.pause(); core.resume(); }
    else calls[0].reject(Error("unavailable"));
    await first;
    await core.submit("October outing");
    assert.equal(core.snapshot().status, "retry_required");
    await core.submit("Go sooner");
    assert.equal(core.snapshot().demoStep, 1); assert.equal(calls.length, 1);
    assert.equal(core.snapshot().status, "retry_required");
    const retry = core.retry(); assert.deepEqual(calls[1].request.range, Core.initialContext().activityRange);
    calls[1].resolve(empty(calls[1].request)); await retry;
    assert.equal(core.snapshot().demoStep, 1);
    const second = core.submit("Go sooner"); assert.deepEqual(calls[2].request.range, weekend);
    calls[2].resolve(empty(calls[2].request)); await second; core.dispose();
  }
});
test("dispose is terminal, clears memory and ignores late settlements", async () => {
  const { core, calls } = harness(); const work = core.start(); core.dispose(); core.dispose(); await work;
  calls[0].resolve(empty(calls[0].request)); await flush();
  await core.start(); await core.submit("this weekend"); await core.retry(); core.resume(); core.reset();
  assert.equal(calls.length, 1); assert.equal(core.snapshot().status, "ended"); assert.deepEqual(core.snapshot().messages, []);
});
test("second-scene cancellation or failure retries the same dates and cannot advance beyond the demo", async () => {
  for (const outcome of ["pause", "failure"]) {
    const { core, calls } = harness(); const first = core.submit("October plans");
    calls[0].resolve(empty(calls[0].request)); await first;
    const second = core.submit("Prefer sooner");
    if (outcome === "pause") { core.pause(); core.resume(); }
    else calls[1].reject(Error("unavailable"));
    await second; await core.submit("Prefer sooner");
    assert.equal(core.snapshot().status, "retry_required");
    assert.equal(core.snapshot().demoStep, 2); assert.equal(calls.length, 2);
    const retry = core.retry(); assert.deepEqual(calls[2].request.range, weekend);
    calls[2].resolve(empty(calls[2].request)); await retry;
    await core.submit("More options please");
    assert.equal(core.snapshot().status, "demo_complete"); assert.equal(calls.length, 3);
    core.dispose();
  }
});
test("partial/unavailable results require explicit retry and rapid Retry coalesces", async () => {
  for (const status of ["partial", "unavailable"]) {
    const { core, calls } = harness(); const initial = core.start();
    const value = empty(calls[0].request); value.status = status;
    value.sources[0].coverage.completeness = status === "partial" ? "partial" : "unknown";
    value.issues = [{ code: status === "partial" ? "candidate_limit" : "source_unavailable", sourceId: "test", message: "Synthetic incomplete source." }];
    calls[0].resolve(value); await initial; assert.equal(core.snapshot().status, status);
    await core.refine(Core.initialContext().activityRange); assert.equal(core.snapshot().status, "retry_required");
    assert.equal(calls.length, 1);
    const retry = core.retry(); assert.equal(core.retry(), retry); assert.equal(calls.length, 2);
    assert.equal(calls[1].request.trigger.kind, "explicit_retry");
    assert.notEqual(calls[1].request.trigger.actionId, calls[0].request.trigger.actionId);
    assert.equal(core.snapshot().messages.some(entry => entry.kind === "activity_results"), false);
    calls[1].resolve(empty(calls[1].request)); await retry;
  }
});
test("old timeout/final rejection cannot clear a newer request's loading state", async () => {
  const { core, calls, timers } = harness(); const initial = core.start(); const timeout = [...timers.values()][0];
  const refined = core.refine(weekend); await initial;
  timeout(); calls[0].reject(new Error("late")); await flush();
  assert.equal(core.snapshot().status, "loading"); assert.equal(timers.size, 1);
  calls[1].resolve(empty(calls[1].request)); await refined; assert.equal(core.snapshot().status, "empty");
});

test("Apply validates without dispatch, fences ignored abort and explicitly searches new preferences", async () => {
  const { core, calls, timers } = harness(), initial = core.start(), before = core.snapshot();
  const preferences = structuredClone(before.context.preferences);
  preferences.ages = [12]; preferences.origin.area = "Da'an District, Taipei City"; preferences.interests = ["movies"];
  assert.equal(core.applyPreferences(preferences), true); await initial;
  const applied = core.snapshot();
  assert.equal(calls.length, 1); assert.equal(calls[0].signal.aborted, true); assert.equal(timers.size, 0);
  assert.equal(applied.context.contextRevision, before.context.contextRevision + 1);
  assert.ok(applied.generation > before.generation); assert.equal(applied.status, "preferences_updated");
  assert.equal(applied.context.preferences.interestBasis, "parent_confirmed");
  assert.deepEqual(applied.context.activityRange, before.context.activityRange); assert.equal(applied.dispatched, 1);
  calls[0].resolve(empty(calls[0].request)); await flush(); assert.equal(core.snapshot().result, null);
  preferences.ages[0] = 100; assert.deepEqual(core.snapshot().context.preferences.ages, [12]);
  const retry = core.retry(); assert.equal(calls[1].request.trigger.kind, "explicit_retry");
  assert.deepEqual(calls[1].request.preferences, applied.context.preferences);
  calls[1].resolve(empty(calls[1].request)); await retry;
  const refinement = core.refine(weekend); assert.deepEqual(calls[2].request.preferences, applied.context.preferences);
  calls[2].resolve(empty(calls[2].request)); await refinement;
  assert.equal(core.applyPreferences({ ...applied.context.preferences, ages: [9] }), true);
  await core.retry(); assert.equal(calls.length, 3); assert.equal(core.snapshot().status, "budget_exhausted");
  assert.equal(core.snapshot().messages.some(message => message.kind === "activity_results" || message.cardIds.length), false);
});

test("invalid/no-op Apply leaves active work unchanged; origin-only Apply preserves interest provenance", async () => {
  const { core, calls } = harness(), initial = core.start(), before = core.snapshot();
  for (const preferences of [null, { ...before.context.preferences, ages: [121] },
    { ...before.context.preferences, calendar: {} }, { ...before.context.preferences, origin: { area: "", precision: "district", landmark: null } }]) {
    assert.equal(core.applyPreferences(preferences), false); assert.deepEqual(core.snapshot(), before);
  }
  assert.equal(core.applyPreferences(before.context.preferences), true); assert.deepEqual(core.snapshot(), before);
  assert.equal(calls[0].signal.aborted, false);
  const preferences = structuredClone(before.context.preferences); preferences.origin.area = "Zhongshan, Taipei";
  preferences.interestBasis = "parent_confirmed";
  core.applyPreferences(preferences); await initial;
  assert.equal(core.snapshot().context.preferences.interestBasis, "demo_fixture");
  core.pause(); const count = calls.length; core.applyPreferences({ ...preferences, ages: [0] });
  assert.equal(core.snapshot().context.triggerState, "paused"); assert.equal(core.snapshot().status, "paused");
  core.resume(); assert.equal(calls.length, count); core.reset();
  assert.deepEqual(core.snapshot().context.preferences, Core.initialContext().preferences);
  core.applyPreferences({ ...preferences, ages: [120] }); assert.equal(core.snapshot().status, "not_started");
  assert.equal(calls.length, count); core.dispose(); assert.equal(core.applyPreferences(preferences), false);
});