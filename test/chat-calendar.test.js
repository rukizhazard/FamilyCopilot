"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fixtures = require("../owner/chat-calendar-fixtures");
const availability = require("../owner/availability-core"), child = require("../owner/child-calendar-core");
const options = body => ({ method: "POST", credentials: "omit", cache: "no-store", redirect: "error", body: JSON.stringify(body) });
const request = { acknowledged: true, startDate: "2026-10-09", endDate: "2026-10-15", refresh: false };
const { harness, settle, deferred, text, descendants } = require("./fixtures/our-week-harness");

test("October fixtures cover all 31 days without relaxing real calendar contracts", async () => {
  const month = availability.forSyntheticOctober(), childMonth = child.forSyntheticOctober();
  const scope = month.dateRange("2026-10-01", "2026-10-31");
  assert.equal(scope.slots, 1488);
  assert.equal(availability.liveWindow.slots, 336);
  assert.throws(() => availability.dateRange("2026-10-01", "2026-10-31"), /invalid_date_range/);
  assert.throws(() => month.dateRange("2026-09-01", "2026-09-30"), /invalid_date_range/);
  assert.equal(child.datesAllowed("2026-10-01", "2026-10-31"), false);
  const transport = fixtures.create({ syntheticOctober: true, scenario: () => "loaded" });
  const body = { ...request, startDate: "2026-10-01", endDate: "2026-10-31" };
  const childResult = await (await transport.fetch("/api/child/sync", options(body))).json();
  assert.equal(childMonth.saved(childResult).data.window.end, "2026-10-31T16:00:00Z");
  assert.throws(() => child.saved(childResult), /invalid_child_response/);
  const parents = await (await transport.fetch("/api/availability", options({ ...body, requestId: "11111111-1111-4111-8111-111111111111" }))).json();
  assert.equal(month.project(parents, scope).people[0].slots.length, 1488);
  assert.throws(() => availability.project(parents, scope), /invalid_date_range/);
  for (let day = 1; day <= 31; day++) {
    const date = `2026-10-${String(day).padStart(2, "0")}`;
    const result = transport.assessOccurrences([{ id: date, startAt: `${date}T14:00:00+08:00`,
      endAt: `${date}T15:00:00+08:00`, timeZone: "Asia/Taipei" }]);
    assert.notEqual(result.items[0].status, "unknown", date);
  }
});

test("school meeting belongs to Kimi's calendar and supplies the comparison without adding parent busy time", async () => {
  const transport = fixtures.create({ syntheticOctober: true, scenario: () => "loaded" });
  const body = { ...request, startDate: "2026-10-01", endDate: "2026-10-31" };
  const parents = await (await transport.fetch("/api/availability", options({ ...body, requestId: "11111111-1111-4111-8111-111111111111" }))).json();
  assert.equal(transport.coordination().meeting, null);
  const source = await (await transport.fetch("/api/child/sync", options(body))).json();
  assert.equal(source.access.person, "Kimi");
  const events = source.data.events.filter(event => event.title === "School meeting");
  assert.equal(events.length, 1);
  assert.equal(events[0].start, "2026-10-16T15:30:00+08:00");
  assert.equal(events[0].end, "2026-10-16T16:30:00+08:00");
  const comparison = transport.coordination();
  assert.deepEqual(comparison.meeting, { startAt: events[0].start, endAt: events[0].end, timeZone: "Asia/Taipei" });
  assert.deepEqual(comparison.people.map(person => [person.person, person.overlapMinutes]), [[0, 0], [1, 30]]);
  const slot = (Date.parse(events[0].start) - Date.parse(parents.window.start)) / 1800000;
  assert.deepEqual(parents.people.map(person => person.slots.slice(slot, slot + 2)), [
    ["free_or_elsewhere", "free_or_elsewhere"], ["busy", "free_or_elsewhere"]
  ]);
  await transport.fetch("/api/child/clear", options({}));
  assert.equal(transport.coordination().status, "unknown");
  assert.equal(transport.coordination().meeting, null);
});

test("candidate times merge checked intervals, clip daytime bounds and withdraw on stale or Clear", async () => {
  let now = Date.parse("2026-09-18T04:00:00Z");
  const transport = fixtures.create({ now: () => now, scenario: () => "loaded", syntheticOctober: true });
  const body = { ...request, startDate: "2026-10-01", endDate: "2026-10-31" };
  assert.equal(transport.candidateTimes().status, "unknown");
  await transport.fetch("/api/child/sync", options(body));
  await transport.fetch("/api/availability", options({ ...body, requestId: "11111111-1111-4111-8111-111111111111" }));
  const candidates = transport.candidateTimes();
  assert.equal(candidates.status, "candidates");
  assert.deepEqual(candidates.items, [["03", "01:00", "04:00"], ["04", "06:00", "09:00"], ["10", "05:00", "11:00"],
    ["17", "02:00", "04:00"], ["24", "07:00", "10:00"], ["31", "02:30", "06:30"]].map(([day, start, end]) => ({
    startAt: `2026-10-${day}T${start}:00.000Z`, endAt: `2026-10-${day}T${end}:00.000Z`, timeZone: "Asia/Taipei" })));
  assert.doesNotMatch(JSON.stringify(candidates), /Kimi|studio|events|slots|sourceName/);
  assert.equal(transport.assessOccurrences(candidates.items.map((item, index) => ({ id: String(index), ...item }))).items.every(item => item.status === "no_conflict"), true);
  now += 240000;
  assert.equal(transport.candidateTimes().status, "unknown");
  assert.deepEqual(transport.candidateTimes().items, []);
  await transport.fetch("/api/clear", options({}));
  assert.equal(transport.candidateTimes().status, "unknown");
  assert.equal(transport.candidateTimes().expiresAt, null);
});

test("coordination computes the overlap from loaded slots and fails closed without fresh complete context", async () => {
  let now = Date.parse("2026-09-18T04:00:00Z");
  const transport = fixtures.create({ now: () => now, scenario: () => "loaded", syntheticOctober: true });
  const body = { ...request, startDate: "2026-10-01", endDate: "2026-10-31" };
  assert.equal(transport.coordination().status, "unknown");
  await transport.fetch("/api/child/sync", options(body));
  await transport.fetch("/api/availability", options({ ...body, requestId: "11111111-1111-4111-8111-111111111111" }));
  const result = transport.coordination();
  assert.equal(result.status, "checked");
  assert.deepEqual(result.people.map(person => [person.person, person.status, person.overlapMinutes]), [[0, "no_conflict", 0], [1, "conflict", 30]]);
  assert.deepEqual(result.people[1].busy, [{ startAt: "2026-10-16T07:00:00.000Z", endAt: "2026-10-16T08:00:00.000Z" }]);
  assert.doesNotMatch(JSON.stringify(result), /studio|sourceName|title|Work meeting/);
  now += 240000;
  assert.equal(transport.coordination().status, "unknown");
  assert.deepEqual(transport.coordination().people, []);
  await transport.fetch("/api/clear", options({}));
  assert.equal(transport.coordination().status, "unknown");
});

test("local fixture assessment uses loaded intervals, exclusive boundaries and bounded coverage", async () => {
  let now = Date.parse("2026-09-18T04:00:00Z");
  const transport = fixtures.create({ now: () => now, scenario: () => "loaded" });
  const occurrence = (id, startAt, endAt) => ({ id, startAt, endAt, timeZone: "Asia/Taipei" });
  const items = [
    occurrence("game", "2026-10-10T17:00:00+08:00", "2026-10-10T19:00:00+08:00"),
    occurrence("busy", "2026-10-10T10:45:00+08:00", "2026-10-10T11:15:00+08:00"),
    occurrence("boundary", "2026-10-10T11:00:00+08:00", "2026-10-10T12:00:00+08:00"),
    occurrence("weekend", "2026-09-20T14:00:00+08:00", "2026-09-20T15:30:00+08:00")
  ];
  assert.equal(transport.assessOccurrences(items).items[0].reason, "unavailable");
  await transport.fetch("/api/child/sync", options(request));
  await transport.fetch("/api/availability", options({ ...request, requestId: "11111111-1111-4111-8111-111111111111" }));
  const assessment = transport.assessOccurrences(items);
  assert.deepEqual(assessment.items.map(item => item.status), ["no_conflict", "conflict", "no_conflict", "unknown"]);
  assert.equal(assessment.items[3].reason, "outside_coverage");
  assert.doesNotMatch(JSON.stringify(assessment), /Kimi|studio|events|slots|sourceName/);
  now += 300000;
  assert.equal(transport.assessOccurrences(items).items[0].reason, "stale");
  await transport.fetch("/api/clear", options({}));
  assert.equal(transport.assessOccurrences(items).items[0].reason, "unavailable");
});

test("Calendar-owned fixture transport validates projections and preserves original independent freshness", async () => {
  const now = Date.parse("2026-09-18T04:00:00Z"), transport = fixtures.create({ now: () => now });
  const parent = await (await transport.fetch("/api/availability", options({ ...request, requestId: "11111111-1111-4111-8111-111111111111" }))).json();
  assert.equal(availability.project(parent, availability.liveWindow).people[1].status, "partial");
  assert.equal(parent.cached, false);
  const first = child.saved(await (await transport.fetch("/api/child/sync", options(request))).json(), now);
  const saved = child.saved(await (await transport.fetch("/api/child/saved", options({ acknowledged: true, startDate: request.startDate, endDate: request.endDate }))).json(), now);
  assert.deepEqual(saved, first);
  assert.notEqual(first.data.checkedAt, parent.checkedAt);
});

test("partial, unavailable, missing and revoked fixtures never assert available time", async () => {
  for (const scenario of ["partial", "unavailable", "missing", "revoked", "cleanup_failed", "stale"]) {
    const transport = fixtures.create({ scenario: () => scenario });
    await transport.fetch("/api/child/sync", options(request));
    await transport.fetch("/api/availability", options({ ...request, requestId: "11111111-1111-4111-8111-111111111111" }));
    const answer = transport.assessOccurrences([{ id: "game", startAt: "2026-10-10T17:00:00+08:00",
      endAt: "2026-10-10T19:00:00+08:00", timeZone: "Asia/Taipei" }]);
    assert.equal(answer.items[0].status, "unknown", scenario);
    assert.equal(transport.candidateTimes().status, "unknown", scenario);
    assert.deepEqual(transport.candidateTimes().items, [], scenario);
  }
});

test("Calendar seam reports only minimal assessment and invalidates on Clear but not collapse", async context => {
  const page = harness(context, { chat: true, scenario: "loaded" }), calendar = page.mount();
  const items = [{ id: "game", startAt: "2026-10-10T17:00:00+08:00", endAt: "2026-10-10T19:00:00+08:00", timeZone: "Asia/Taipei" }];
  let changes = 0;
  const unsubscribe = calendar.subscribeAssessment(() => changes++);
  await calendar.loadSynthetic();
  assert.equal(calendar.assessOccurrences(items).items[0].status, "no_conflict");
  const previous = changes;
  calendar.collapse(); calendar.expand(); assert.equal(changes, previous);
  await page.fire("availability-clear"); await settle();
  assert.ok(changes > previous);
  assert.equal(calendar.assessOccurrences(items).items[0].status, "unknown");
  unsubscribe(); await calendar.dispose();
  assert.throws(() => calendar.assessOccurrences(items), /calendar_assessment_unavailable/);
});

test("fixture rejects unknown routes, bodies and calls after non-destructive leave", async () => {
  const transport = fixtures.create();
  await assert.rejects(transport.fetch("https://example.test/", options({})), /calendar_fixture_request_rejected/);
  await assert.rejects(transport.fetch("/api/child/sync", options({ ...request, events: [] })), /calendar_fixture_request_rejected/);
  assert.deepEqual(await (await transport.fetch("/api/clear", options({ reason: "leave" }))).json(), { status: "cleared", cleanup: "not_requested" });
  await assert.rejects(transport.fetch("/api/child/sync", options(request)), /calendar_fixture_request_rejected/);
});

test("mount exposes only frozen presentation methods, runs no queries and ignores external Calendar events", async t => {
  const page = harness(t, { chat: true });
  const controller = page.mount();
  assert.deepEqual(Object.keys(controller).sort(), ["assessOccurrences", "collapse", "coordinateMeeting", "dispose", "expand", "loadSynthetic", "resetProposal", "subscribeAssessment", "subscribeMeetingReview"]);
  assert.equal(Object.isFrozen(controller), true);
  assert.equal(page.mount(), controller);
  assert.equal(page.calls.length, 0);
  assert.equal(page.storage.values.size, 0);
  assert.equal(page.calendarDates().status, "default");
  assert.equal(page.packets.length, 0);
  await page.emit("owner-session-cleared", { detail: { source: "other", leaving: false } });
  assert.equal(page.calls.length, 0);
  assert.equal(controller.collapse(), undefined);
  assert.equal(controller.expand(), undefined);
  await controller.dispose();
  assert.deepEqual(page.calls.map(call => [call.path, call.body]), [["/api/clear", { reason: "leave" }]]);
});

test("invalid options and second host fail closed; disposed documents cannot remount", async t => {
  const page = harness(t, { chat: true });
  for (const options of [undefined, {}, { version: "familycopilot.chat.v1", mode: "live" }, { version: "familycopilot.chat.v1", mode: "synthetic", events: [] }]) {
    if (options === undefined) continue;
    assert.throws(() => page.mount(page.get("calendar-host"), options), /invalid_calendar_options/);
  }
  const controller = page.mount();
  const other = page.document.createElement("div");
  other.setAttribute("id", "second-calendar-host");
  assert.throws(() => page.mount(other), /invalid_calendar_host/);
  page.get("calendar-host").parentNode.append(other);
  other.setAttribute("id", "calendar-host");
  assert.throws(() => page.mount(other), /calendar_already_mounted/);
  await controller.dispose();
  assert.throws(() => page.mount(), /calendar_disposed/);
});

test("conversation load hides Sync, coalesces once and keeps loading and failure states visible", async context => {
  const pending = deferred();
  const page = harness(context, { chat: true, override: path => path === "/api/child/sync" ? pending.promise : undefined });
  const controller = page.mount();
  assert.equal(page.get("availability-title").textContent, "Family calendars");
  assert.equal(page.visible("availability-load"), false);
  for (const id of ["chat-calendar-status", "chat-calendar-toggle", "availability-empty", "calendar-month", "availability-clear"]) {
    assert.equal(page.visible(id), false, id);
  }
  assert.doesNotMatch(page.visibleText(), /Mike: Not loaded|Debby: Not loaded|Kimi: Not loaded|snapshot/i);
  assert.equal(page.calls.length, 0);
  const loading = controller.loadSynthetic();
  assert.equal(controller.loadSynthetic(), loading);
  await settle();
  assert.equal(page.visible("chat-calendar-status"), true);
  assert.equal(page.visible("chat-calendar-toggle"), true);
  assert.equal(page.visible("calendar-month"), false);
  assert.match(page.visibleText(), /Loading|Syncing/);
  pending.resolve(new Response(JSON.stringify({ status: "unavailable", cleanup: "workflow_disabled", synthetic: true }), { status: 503 }));
  await loading; await settle();
  assert.equal(page.visible("chat-calendar-status"), true);
  assert.match(page.visibleText(), /Unavailable|Partial|couldn|Couldn/);
  assert.equal(await loading, undefined);
  const count = page.calls.length;
  assert.equal(controller.loadSynthetic(), loading); await loading;
  assert.equal(page.calls.length, count);
  assert.equal(page.visible("availability-load"), false);
  await controller.dispose();
  await assert.rejects(controller.loadSynthetic(), /calendar_disposed/);
});

test("mount refuses legacy ID collisions instead of creating duplicate controls", t => {
  const page = harness(t, { chat: true });
  const existing = page.document.createElement("input");
  existing.setAttribute("id", "availability-start");
  page.get("calendar-host").parentNode.append(existing);
  assert.throws(() => page.mount(), /calendar_mount_failed/);
  assert.equal(page.calls.length, 0);
  assert.equal(page.get("calendar-host").children.length, 0);
  assert.throws(() => page.mount(), /calendar_disposed/);
});

test("loaded collapse preserves dates, grid, scroll, independent freshness and zero additional queries", async t => {
  const page = harness(t, { chat: true });
  const controller = page.mount();
  await page.fire("availability-load"); await settle();
  assert.deepEqual(page.calls.map(call => call.path), ["/api/child/sync", "/api/availability"]);
  assert.equal(page.childBlocks().length, 1);
  const grid = page.get("availability-grid"), content = grid.children[0], dates = page.calendarDates();
  grid.scrollTop = 530; grid.scrollLeft = 165; grid.focus();
  controller.collapse();
  assert.equal(page.focus, page.get("chat-calendar-toggle"));
  assert.equal(page.visible("availability-grid"), false);
  assert.match(text(page.get("chat-calendar-status")), /partial/);
  assert.match(text(page.get("chat-calendar-status")), /Fresh fixture result/);
  assert.equal(page.visible("availability-parent-details"), false);
  page.get("chat-calendar-source-details").open = true;
  assert.equal(page.visible("availability-parent-details"), true);
  controller.expand();
  assert.equal(grid.children[0], content);
  assert.equal(grid.scrollTop, 530); assert.equal(grid.scrollLeft, 165);
  assert.deepEqual(page.calendarDates(), dates);
  assert.equal(page.calls.length, 2);
  assert.equal(page.packets.length, 0); assert.equal(page.metadata.length, 0);
  await controller.dispose();
});

test("Sync completion while collapsed cannot reopen or focus hidden controls", async t => {
  const response = deferred();
  const page = harness(t, { chat: true, override: path => path === "/api/availability" ? response.promise : undefined });
  const controller = page.mount();
  const loading = page.fire("availability-load"); await settle();
  page.get("availability-clear").focus(); controller.collapse();
  response.resolve(new Response(JSON.stringify(page.parentData())));
  await loading;
  assert.equal(page.get("chat-calendar-body").hidden, true);
  assert.equal(page.focus, page.get("chat-calendar-toggle"));
  assert.equal(page.calls.length, 2);
  assert.match(text(page.get("chat-calendar-status")), /Checked/);
  await controller.dispose();
});

test("chat keeps routine source paragraphs in closed Details across Sync and collapse", async context => {
  const page = harness(context, { chat: true });
  const controller = page.mount();
  const details = page.get("chat-calendar-source-details");
  const routineIds = ["owner-source-row", "availability-source", "availability-window", "availability-parent-details",
    "availability-freshness", "child-week-status", "availability-status-details", "child-status-details"];
  assert.equal(details.open, false);
  assert.match(page.get("chat-calendar-scope").textContent, /Calendars.*2026-10-01.*2026-10-31.*Taipei/);
  assert.equal(page.get("chat-calendar-person-0").textContent, "Mike: Not loaded");
  assert.equal(page.calls.length, 0);
  for (const id of routineIds) assert.equal(page.visible(id), false, id);
  for (const iteration of [0, 1]) {
    await page.fire("availability-load");
    controller.collapse();
    for (const id of routineIds) assert.equal(page.visible(id), false, id);
    assert.equal(page.visible("chat-calendar-person-1"), true);
    assert.equal(page.get("chat-calendar-person-1").textContent, "Debby: Loaded · Partial");
    assert.doesNotMatch(page.visibleText(), /Calendar load window:|Fresh fixture result|Checked 2026-|Snapshot \(not continuously/);
    const count = page.calls.length;
    details.open = true;
    assert.equal(page.visible("availability-parent-details"), true);
    assert.match(text(page.get("availability-parent-details")), /Checked/);
    assert.match(page.get("child-status-details").textContent, iteration ? /Fresh fixture/ : /Saved fixture/);
    details.open = false;
    controller.expand();
    assert.equal(page.calls.length, count);
  }
  await controller.dispose();
});

test("collapse restores manual scroll even when an in-flight render changes scroll geometry", async t => {
  const pending = deferred();
  let pause = false;
  const page = harness(t, { chat: true, override: path => pause && path === "/api/availability" ? pending.promise : undefined });
  const controller = page.mount();
  await page.fire("availability-load");
  const grid = page.get("availability-grid"); grid.scrollTop = 672; grid.scrollLeft = 210;
  pause = true;
  const loading = page.fire("availability-load");
  controller.collapse(); await settle();
  grid.scrollTop = 0; grid.scrollLeft = 0;
  pending.resolve(new Response(JSON.stringify(page.parentData())));
  await loading; controller.expand();
  assert.equal(grid.scrollTop, 672); assert.equal(grid.scrollLeft, 210);
  await controller.dispose();
});

test("date-away-and-back fences results but preserves completed fixture timestamps; no browser date write", async t => {
  const page = harness(t, { chat: true });
  const controller = page.mount();
  await page.fire("availability-load");
  const original = text(page.get("availability-parent-details"));
  await page.range("2026-11-17", "2026-11-18"); await settle();
  assert.equal(page.get("availability-grid").hidden, true);
  await page.range("2026-10-09", "2026-10-11"); await settle();
  await page.fire("availability-saved");
  assert.equal(text(page.get("availability-parent-details")), original);
  assert.match(page.get("availability-status-details").textContent, /Saved fixture/);
  assert.equal(page.storage.values.size, 0);
  assert.equal(page.calls.filter(call => call.path === "/api/availability").at(-1).body.cacheOnly, true);
  assert.equal(page.calls.some(call => call.path === "/api/clear" && !call.body.reason), false);
  await controller.dispose();
});

test("generic parent failure preserves independent child freshness and never uses a saved fallback", async t => {
  const page = harness(t, { chat: true, override: path => path === "/api/availability"
    ? new Response('{"status":"unavailable","cleanup":"workflow_disabled","synthetic":true}', { status: 503 }) : undefined });
  const controller = page.mount();
  await page.fire("availability-load"); controller.collapse();
  assert.equal(page.childBlocks().length, 1);
  assert.match(page.get("child-week-status").textContent, /Checked/);
  assert.match(text(page.get("availability-parent-details")), /Not loaded; freshness unknown/);
  assert.match(page.get("availability-status").textContent, /load the week/);
  assert.equal(page.calls.length, 2);
  await controller.dispose();
});

for (const pendingPath of ["/api/child/sync", "/api/availability"]) {
  test(`collapsed date-away-and-back fences a late ${pendingPath} response without a new Sync`, async context => {
    const pending = deferred();
    let originalResponse;
    const transport = fixtures.create({ syntheticOctober: true });
    const page = harness(context, { chat: true, override: async (path, body, requestOptions) => {
      if (path !== pendingPath) return undefined;
      originalResponse = await transport.fetch(path, requestOptions);
      return pending.promise;
    } });
    const controller = page.mount();
    const loading = page.fire("availability-load");
    await settle();
    assert.ok(originalResponse);
    controller.collapse();
    await page.range("2026-11-17", "2026-11-18");
    await page.range("2026-10-09", "2026-10-11");
    await settle();
    const callsBeforeReply = page.calls.length;
    pending.resolve(originalResponse);
    await loading;
    await settle();
    assert.equal(page.calls.length, callsBeforeReply);
    assert.equal(page.get("chat-calendar-body").hidden, true);
    assert.equal(page.get("availability-grid").hidden, true);
    assert.equal(page.childBlocks().length, 0);
    assert.match(text(page.get("availability-parent-details")), /Not loaded; freshness unknown/);
    controller.expand();
    assert.equal(page.get("availability-grid").hidden, true);
    assert.equal(page.get("availability-start").value, "2026-10-09");
    assert.equal(page.get("availability-end").value, "2026-10-11");
    assert.equal(page.storage.values.size, 0);
    assert.equal(page.packets.length, 0);
    assert.equal(page.metadata.length, 0);
    assert.equal(page.calls.some(call => call.path === "/api/clear" && !call.body.reason), false);
    await controller.dispose();
  });
}

test("transport exceptions during leave expose a fixed sticky error, not arbitrary payload text", async t => {
  const page = harness(t, { chat: true, override: path => {
    if (path === "/api/clear") throw new Error("untrusted fixture payload");
  } });
  const controller = page.mount();
  const exit = controller.dispose();
  await assert.rejects(exit, { message: "calendar_cleanup_unconfirmed" });
  assert.doesNotMatch(page.get("chat-calendar-safety").textContent, /untrusted/);
  controller.expand(); assert.equal(controller.dispose(), exit);
  assert.equal(page.calls.length, 1);
});

test("CommonJS seam imports without DOM, storage or transport access", () => {
  const calendar = require("../owner/chat-calendar");
  assert.deepEqual(Object.keys(calendar), ["mountCalendar"]);
  assert.equal(Object.isFrozen(calendar), true);
  assert.throws(() => calendar.mountCalendar(null, { version: "familycopilot.chat.v1", mode: "synthetic" }), /invalid_calendar_host/);
});

test("sample foreground retains source and pending facts with no-delivery qualification in Details", async context => {
  const page = harness(context, { chat: true, scenario: "loaded" }), controller = page.mount();
  assert.match(page.visibleText(), /Sample calendars/);
  assert.doesNotMatch(page.visibleText(), /demo|fictional|No invitation is delivered/i);
  const loading = controller.loadSynthetic();
  assert.match(page.visibleText(), /Sample calendars/);
  await loading;
  await page.fire("coordination-review");
  page.get("calendar-day-details").open = true;
  assert.doesNotMatch(page.visibleText(), /demo|fictional|No invitation is delivered/i);
  assert.match(page.visibleText(), /Parent-teacher meeting \/ Fri, Oct 16 \/ 15:30-16:30 Taipei/);
  assert.match(page.visibleText(), /Mike's response and travel are not confirmed/);
  assert.match(text(page.get("chat-calendar-source-details")), /Fictional data only/);
  assert.match(text(page.get("chat-calendar-source-details")), /Invitations use sample data and stay on this page\. No invitation is delivered and no calendars are changed\./);
  page.get("chat-calendar-source-details").open = true;
  assert.match(page.visibleText(), /No invitation is delivered/);
  assert.doesNotMatch(page.visibleText(), /\bdemo\b|fictional.*identities/i);
  await controller.dispose();
});
test("coordination requires the one-parent condition, supports undo/reset, and never changes calendars", async context => {
  const page = harness(context, { chat: true, scenario: "loaded" }), controller = page.mount();
  assert.equal(page.visible("calendar-coordination"), false);
  await controller.loadSynthetic();
  const calls = page.calls.length, dates = page.calendarDates();
  await page.fire("coordination-review");
  assert.match(page.get("coordination-status").textContent, /Debby \(you\).*30 minutes.*Mike has no overlapping/);
  assert.equal(page.get("coordination-timeline").children[0].children[0].textContent, "Kimi / School meeting");
  assert.deepEqual(structuredClone(controller.coordinateMeeting("confirm")), { state: "unavailable" });
  assert.equal(descendants(page.get("coordination-timeline")).filter(node => node.className === "coordination-overlap").length, 1);
  assert.equal(page.get("coordination-result").hidden, true);
  assert.deepEqual(structuredClone(controller.coordinateMeeting("review")), { state: "ask", overlapMinutes: 30 });
  assert.deepEqual(structuredClone(controller.coordinateMeeting("confirm")), { state: "unavailable" });
  assert.deepEqual(structuredClone(controller.coordinateMeeting("assess_alternate")), { state: "confirm_alternate" });
  assert.equal(page.get("coordination-result").hidden, true);
  assert.deepEqual(structuredClone(controller.coordinateMeeting("confirm")), { state: "proposed" });
  assert.equal(page.get("coordination-result").hidden, false);
  assert.match(page.get("coordination-result").textContent, /Before: Debby.*30 minutes.*Proposed: Mike.*Awaiting Mike's confirmation/);
  assert.match(page.get("coordination-status").textContent, /proposal avoids your conflict.*confirmation is still needed/);
  assert.equal(descendants(page.get("coordination-timeline")).filter(node => node.className === "coordination-overlap").length, 0);
  assert.equal(page.get("coordination-timeline").children[0].children[0].textContent, "Kimi / School meeting");
  assert.doesNotMatch(text(page.get("coordination-timeline")), /Meeting \/ Debby|Meeting \/ Mike|Mike proposed/);
  controller.coordinateMeeting("cancel");
  assert.equal(page.get("coordination-result").hidden, true);
  controller.coordinateMeeting("review"); controller.coordinateMeeting("assess_alternate"); controller.coordinateMeeting("confirm");
  controller.coordinateMeeting("decline");
  assert.equal(page.get("coordination-result").hidden, true);
  controller.coordinateMeeting("review"); controller.coordinateMeeting("assess_alternate"); controller.coordinateMeeting("confirm");
  controller.resetProposal();
  assert.equal(page.get("coordination-body").hidden, true);
  assert.deepEqual(structuredClone(controller.coordinateMeeting("confirm")), { state: "unavailable" });
  assert.equal(page.get("coordination-result").hidden, true);
  assert.equal(page.calls.length, calls);
  assert.deepEqual(page.calendarDates(), dates);
  await controller.dispose();
});

test("demo invitation requires review, is idempotent and pending, and retires without calendar writes", async context => {
  const page = harness(context, { chat: true, scenario: "loaded" }), controller = page.mount();
  await controller.loadSynthetic();
  const calls = page.calls.length, dates = page.calendarDates();
  assert.equal(controller.coordinateMeeting("send_invitation").state, "unavailable");
  assert.equal(controller.coordinateMeeting("review").state, "ask");
  assert.equal(controller.coordinateMeeting("send_invitation").state, "invited");
  const id = page.get("coordination-result").dataset.invitationId;
  assert.equal(page.get("coordination-timeline").children[0].children[0].textContent, "Kimi / School meeting");
  assert.equal(id, "demo-school-meeting-mike-20261016");
  assert.equal(page.get("coordination-status").textContent, "Mike pending response");
  assert.match(page.get("coordination-result").textContent, /Mike's invitation.*October 16, 2026, 3:30-4:30 PM \(Asia\/Taipei\).*awaiting his response/);
  assert.doesNotMatch(page.get("coordination-result").textContent, /sent|delivered|accepted|\bdemo\b/i);
  assert.equal(controller.coordinateMeeting("send_invitation").state, "invited");
  assert.equal(controller.coordinateMeeting("review").state, "invited");
  assert.equal(page.get("coordination-result").dataset.invitationId, id);
  assert.equal(page.calls.length, calls);
  assert.deepEqual(page.calendarDates(), dates);
  page.elapseWithoutTimers(240000);
  assert.equal(controller.coordinateMeeting("send_invitation").state, "unavailable");
  assert.equal(page.get("coordination-result").hidden, true);
  assert.equal(page.get("coordination-result").dataset.invitationId, "");
  await controller.dispose();
});

for (const phase of ["reviewed", "invited"]) test(`demo invitation revalidates both calendars after ${phase}`, async context => {
  for (const change of ["partial", "missing", "stale", "unavailable", "revoked", "busy", "revision", "expiry"]) {
    const page = harness(context, { chat: true, scenario: "loaded" }), controller = page.mount();
    await controller.loadSynthetic();
    assert.equal(controller.coordinateMeeting("review").state, "ask");
    if (phase === "invited") assert.equal(controller.coordinateMeeting("send_invitation").state, "invited");
    if (change === "expiry") page.elapseWithoutTimers(240000);
    else {
      page.setScenario(change === "revision" ? "loaded" : change);
      await page.fire("availability-load"); await settle();
    }
    const calls = page.calls.length;
    assert.equal(controller.coordinateMeeting("send_invitation").state, "unavailable", change);
    assert.equal(page.get("coordination-result").hidden, true, change);
    assert.equal(page.get("coordination-result").dataset.invitationId, "", change);
    assert.equal(page.calls.length, calls, change);
    if (change === "revoked") await assert.rejects(controller.dispose()); else await controller.dispose();
  }
});

for (const action of ["cancel", "decline", "reset", "expire"]) test(`demo invitation clears on ${action} without real withdrawal`, async context => {
  const page = harness(context, { chat: true, scenario: "loaded" }), controller = page.mount();
  await controller.loadSynthetic();
  controller.coordinateMeeting("review"); controller.coordinateMeeting("send_invitation");
  const calls = page.calls.length;
  if (action === "reset") controller.resetProposal();
  else if (action === "expire") await page.advance(240000);
  else controller.coordinateMeeting(action);
  assert.equal(page.get("coordination-result").hidden, true);
  assert.equal(page.get("coordination-result").dataset.invitationId, "");
  assert.equal(controller.coordinateMeeting("send_invitation").state, "unavailable");
  assert.equal(page.calls.length, calls);
  await controller.dispose();
});

test("meeting-only expiry notifies conversation listeners and retires a proposal without activity assessment", async context => {
  const page = harness(context, { chat: true, scenario: "loaded" }), controller = page.mount();
  await controller.loadSynthetic();
  controller.coordinateMeeting("review"); controller.coordinateMeeting("assess_alternate"); controller.coordinateMeeting("confirm");
  let retired = 0;
  const unsubscribe = controller.subscribeAssessment(() => {
    retired++; controller.coordinateMeeting("cancel");
  });
  await page.advance(240000);
  assert.equal(retired, 1);
  assert.equal(page.get("coordination-result").hidden, true);
  assert.equal(controller.coordinateMeeting("confirm").state, "unavailable");
  unsubscribe(); await controller.dispose();
});

for (const action of ["clear", "expire", "stale_click", "range"]) test(`coordination withdraws on ${action}`, async context => {
  const page = harness(context, { chat: true, scenario: "loaded" }), controller = page.mount();
  await controller.loadSynthetic(); await page.fire("coordination-review");
  controller.coordinateMeeting("review");
  controller.coordinateMeeting("assess_alternate");
  if (action !== "stale_click") controller.coordinateMeeting("confirm");
  if (action === "clear") { await page.fire("availability-clear"); await settle(); }
  if (action === "expire") await page.advance(240000);
  if (action === "range") { await page.range("invalid", "2026-10-11"); await settle(); }
  if (action === "stale_click") page.elapseWithoutTimers(240000);
  assert.deepEqual(structuredClone(controller.coordinateMeeting("confirm")), { state: "unavailable" });
  assert.equal(page.get("coordination-result").hidden, true);
  assert.equal(page.get("coordination-timeline").children.length, 0);
  assert.match(page.get("coordination-status").textContent, /missing, incomplete or out of date/);
  await controller.dispose();
});

for (const phase of ["ask", "confirm_alternate", "proposed"]) test(`coordination rechecks changed evidence after ${phase}`, async context => {
  for (const change of ["partial", "missing", "stale", "unavailable", "revoked", "busy", "revision", "expiry"]) {
    const page = harness(context, { chat: true, scenario: "loaded" }), controller = page.mount();
    await controller.loadSynthetic();
    assert.equal(controller.coordinateMeeting("review").state, "ask");
    if (phase !== "ask") assert.equal(controller.coordinateMeeting("assess_alternate").state, "confirm_alternate");
    if (phase === "proposed") assert.equal(controller.coordinateMeeting("confirm").state, "proposed");
    if (change === "expiry") page.elapseWithoutTimers(240000);
    else {
      page.setScenario(change === "revision" ? "loaded" : change);
      await page.fire("availability-load"); await settle();
    }
    assert.equal(controller.coordinateMeeting(phase === "ask" ? "assess_alternate" : "confirm").state, "unavailable", change);
    assert.equal(page.get("coordination-result").hidden, true, change);
    if (change === "revoked") await assert.rejects(controller.dispose()); else await controller.dispose();
  }
});

for (const scenario of ["partial", "missing", "stale", "unavailable", "revoked", "busy"]) test(`coordination cannot propose with ${scenario} calendars`, async context => {
  const page = harness(context, { chat: true, scenario }), controller = page.mount();
  await controller.loadSynthetic(); await page.fire("coordination-review");
  assert.deepEqual(structuredClone(controller.coordinateMeeting("review")), { state: "unavailable" });
  assert.deepEqual(structuredClone(controller.coordinateMeeting("assess_alternate")), { state: "unavailable" });
  assert.deepEqual(structuredClone(controller.coordinateMeeting("confirm")), { state: "unavailable" });
  assert.deepEqual(structuredClone(controller.coordinateMeeting("send_invitation")), { state: "unavailable" });
  assert.equal(page.get("coordination-result").hidden, true);
  if (scenario === "revoked") await assert.rejects(controller.dispose()); else await controller.dispose();
});

test("candidate shortlist selects the existing day timeline without requests and withdraws on expiry", async context => {
  const page = harness(context, { chat: true, scenario: "loaded" }), controller = page.mount();
  assert.equal(page.visible("calendar-candidates"), false);
  await controller.loadSynthetic();
  const list = page.get("calendar-candidate-list"), before = page.calls.length, dates = page.calendarDates();
  assert.equal(list.children.length, 6);
  assert.match(text(list), /Sat, Oct 3/);
  assert.equal(page.get("calendar-month-overview").open, true);
  assert.equal(page.get("calendar-day-details").open, true);
  const sections = Array.from(page.get("chat-calendar-body").children);
  assert.ok(sections.indexOf(page.get("calendar-month-overview")) < sections.indexOf(page.get("calendar-day-details")));
  assert.ok(sections.indexOf(page.get("calendar-day-details")) < sections.indexOf(page.get("calendar-candidates")));
  assert.equal(page.visible("availability-grid"), true);
  assert.match(text(page.get("availability-grid")), /Mike.*Debby.*Kimi/s);
  await list.dispatchEvent({ type: "click", target: list.children[0].children[0].children[0] });
  assert.equal(page.get("calendar-day-details").open, true);
  assert.equal(page.focus, page.get("availability-grid"));
  assert.match(page.get("availability-grid").attributes["aria-label"], /3 October 2026/);
  assert.match(page.get("calendar-candidate-selection").textContent, /09:00.*12:00/);
  const highlight = descendants(page.get("availability-grid")).find(node => node.className === "candidate-window");
  assert.equal(highlight.style.height, "12.5%");
  assert.equal(list.children[0].children[0].attributes["aria-pressed"], "true");
  assert.equal(page.calls.length, before);
  assert.deepEqual(page.calendarDates(), dates);
  controller.collapse(); controller.expand();
  assert.equal(list.children.length, 6);
  await page.advance(240000);
  assert.equal(list.children.length, 0);
  assert.match(page.get("calendar-candidate-status").textContent, /can't confirm/);
  assert.equal(page.get("calendar-candidate-selection").hidden, true);
  assert.equal(descendants(page.get("availability-grid")).some(node => node.className === "candidate-window"), false);
  assert.equal(page.calls.length, before);
  await controller.dispose();
});

test("candidate selection rechecks freshness even before the expiry timer runs", async context => {
  const page = harness(context, { chat: true, scenario: "loaded" }), controller = page.mount();
  await controller.loadSynthetic();
  page.get("calendar-day-details").open = false;
  const list = page.get("calendar-candidate-list"), target = list.children[0].children[0];
  page.elapseWithoutTimers(240000);
  await list.dispatchEvent({ type: "click", target });
  assert.equal(list.children.length, 0);
  assert.equal(page.get("calendar-day-details").open, false);
  await controller.dispose();
});

test("Clear and invalid dates remove candidate windows; busy differs from missing context", async context => {
  const page = harness(context, { chat: true, scenario: "loaded" }), controller = page.mount();
  await controller.loadSynthetic();
  await page.range("invalid", "2026-10-11"); await settle();
  assert.equal(page.get("calendar-candidate-list").children.length, 0);
  await page.range("2026-10-09", "2026-10-11"); await settle();
  await page.fire("availability-saved");
  assert.equal(page.get("calendar-candidate-list").children.length, 6);
  await page.fire("availability-clear"); await settle();
  assert.equal(page.get("calendar-candidate-list").children.length, 0);
  await controller.dispose();
  const busy = harness(context, { chat: true, scenario: "busy" }), busyController = busy.mount();
  await busyController.loadSynthetic();
  assert.equal(busy.get("calendar-candidate-list").children.length, 0);
  assert.match(busy.get("calendar-candidate-status").textContent, /No shared two-hour window/);
  await busyController.dispose();
});

test("month overview has no invented markers or editable date range", async context => {
  const page = harness(context, { chat: true });
  const controller = page.mount();
  const month = page.get("calendar-month-days");
  const markers = () => month.children.flatMap(cell => cell.children.filter(item => item.className === "calendar-month-marker"));
  assert.equal(page.get("calendar-month-title").textContent, "October 2026");
  assert.equal(month.children.length, 42);
  assert.equal(markers().length, 0);
  assert.equal(month.children.every(cell => cell.disabled), true);
  assert.equal(page.calls.length, 0);
  page.get("chat-calendar-source-details").open = true;
  for (const id of ["availability-start", "availability-end"]) {
    assert.equal(page.visible(id), false);
    assert.equal(page.get(id).attributes.type, "hidden");
  }
  assert.doesNotMatch(page.visibleText(), /Start date|End date|Choose your dates/);
  page.get("chat-calendar-source-details").open = false;
  await page.fire("availability-load");
  assert.equal(page.get("calendar-month-overview").open, true);
  assert.equal(page.visible("calendar-month-days"), true);
  page.get("calendar-month-overview").open = false;
  assert.equal(page.visible("calendar-month-days"), false);
  page.get("calendar-month-overview").open = true;
  assert.equal(page.visible("calendar-month-days"), true);
  assert.equal(page.visible("availability-grid"), true);
  assert.equal(page.get("calendar-day-details").open, true);
  assert.deepEqual(month.children.filter(cell => !cell.disabled).map(cell => cell.dataset.monthDate),
    Array.from({ length: 31 }, (_, index) => `2026-10-${String(index + 1).padStart(2, "0")}`));
  assert.equal(markers().length, 66);
  assert.equal(markers().filter(marker => marker.dataset.person === "2").length, 4);
  const meetingDay = month.children.find(cell => cell.dataset.monthDate === "2026-10-16");
  assert.equal(meetingDay.children.filter(marker => marker.className === "calendar-month-marker" && marker.dataset.person === "2").length, 1);
  assert.match(page.get("child-status-details").textContent, /1.*31 October 2026/);
  assert.doesNotMatch(text(month), /studio visit|10:00|11:00/i);
  for (const cell of month.children) assert.match(cell.attributes["aria-label"], /Missing time is unknown, not free/);
  await month.dispatchEvent({ type: "click", target: meetingDay.children[0] });
  assert.match(text(page.get("availability-grid")), /School meeting/);
  await controller.dispose();
});

test("month browsing and explicit day details do not query or change selected dates", async context => {
  const page = harness(context, { chat: true });
  const controller = page.mount();
  await page.fire("availability-load");
  page.get("calendar-month-overview").open = true;
  const original = page.calendarDates(), freshness = text(page.get("availability-parent-details")), count = page.calls.length;
  const month = page.get("calendar-month-days");
  const selected = month.children.find(cell => cell.dataset.monthDate === "2026-10-09");
  await month.dispatchEvent({ type: "click", target: selected.children[0] });
  assert.equal(page.get("calendar-day-details").open, true);
  assert.equal(page.visible("availability-grid"), true);
  assert.equal(page.focus, page.get("availability-grid"));
  assert.match(page.get("availability-grid").attributes["aria-label"], /9 October 2026/);
  await page.fire("calendar-month-next");
  assert.equal(page.get("calendar-month-title").textContent, "November 2026");
  assert.equal(month.children.every(cell => cell.disabled), true);
  await page.fire("calendar-month-previous");
  controller.collapse(); controller.expand();
  assert.equal(page.get("calendar-month-title").textContent, "October 2026");
  assert.deepEqual(page.calendarDates(), original);
  assert.equal(text(page.get("availability-parent-details")), freshness);
  assert.equal(page.calls.length, count);
  assert.equal(page.packets.length, 0);
  await controller.dispose();
});

test("month markers clear on invalid dates and Clear; saved data is not shifted", async context => {
  const page = harness(context, { chat: true });
  const controller = page.mount();
  await page.fire("availability-load");
  await page.range("invalid", "2026-10-11"); await settle();
  assert.equal(page.get("calendar-month-days").children.every(cell => cell.disabled), true);
  assert.equal(page.get("calendar-day-details").hidden, true);
  await page.range("2026-10-09", "2026-10-11"); await settle();
  await page.fire("availability-saved");
  assert.equal(page.get("calendar-month-days").children.filter(cell => !cell.disabled).length, 31);
  await page.fire("availability-clear"); await settle();
  assert.equal(page.get("calendar-month-days").children.every(cell => cell.disabled), true);
  assert.equal(page.get("calendar-day-details").hidden, true);
  await controller.dispose();
});

test("month navigation handles year boundaries and Taipei today without requests", async context => {
  const page = harness(context, { chat: true, initialDates: ["2026-12-31", "2027-01-01"] });
  const controller = page.mount();
  assert.equal(page.get("calendar-month-title").textContent, "December 2026");
  await page.fire("calendar-month-next");
  assert.equal(page.get("calendar-month-title").textContent, "January 2027");
  for (let index = 0; index < 4; index++) await page.fire("calendar-month-previous");
  assert.equal(page.get("calendar-month-title").textContent, "September 2026");
  const today = page.get("calendar-month-days").children.filter(cell => cell.attributes["aria-current"] === "date");
  assert.equal(today.length, 1);
  assert.equal(today[0].dataset.monthDate, "2026-09-17");
  assert.equal(page.calls.length, 0);
  await controller.dispose();
});

test("dispose coalesces pagehide races, rejects unknown cleanup, hides data and never retries", async t => {
  const cleanup = deferred();
  const page = harness(t, { chat: true, override: path => path === "/api/clear" ? cleanup.promise : undefined });
  const controller = page.mount();
  await page.fire("availability-load");
  const first = controller.dispose();
  assert.equal(first, controller.dispose());
  controller.expand(); controller.collapse();
  assert.equal(page.get("chat-calendar-body").hidden, true);
  assert.equal(page.get("chat-calendar-status").children.length, 0);
  await page.emit("pagehide"); await settle();
  const rejection = assert.rejects(first, { message: "calendar_cleanup_unconfirmed" });
  cleanup.resolve(new Response(JSON.stringify({ status: "unknown" })));
  await rejection;
  assert.equal(controller.dispose(), first);
  assert.match(page.get("chat-calendar-safety").textContent, /unconfirmed/);
  assert.equal(page.resources().timers, 0);
  assert.deepEqual(page.calls.filter(call => call.path === "/api/clear").map(call => call.body), [{ reason: "leave" }]);
  await page.emit("pageshow", { persisted: true });
  assert.throws(() => page.mount(), /calendar_disposed/);
});

test("collapsed parent freshness updates just beyond five minutes without another query", async t => {
  const page = harness(t, { chat: true });
  const controller = page.mount();
  await page.fire("availability-load"); controller.collapse();
  const original = text(page.get("availability-parent-details"));
  assert.doesNotMatch(original, /Stale/);
  await page.advance(300000);
  await page.advance(1);
  assert.match(text(page.get("availability-parent-details")), /Stale/);
  assert.match(page.get("child-week-status").textContent, /Stale/);
  assert.match(page.get("chat-calendar-person-0").textContent, /Stale/);
  assert.match(page.get("chat-calendar-person-2").textContent, /Stale/);
  assert.equal(page.visible("chat-calendar-person-2"), true);
  assert.equal(page.visible("availability-parent-details"), false);
  assert.equal(page.calls.length, 2);
  await controller.dispose();
});

test("child provenance distinguishes saved fixture from explicit fresh Sync", async t => {
  const page = harness(t, { chat: true });
  const controller = page.mount();
  await page.fire("availability-load");
  assert.match(page.get("child-status-details").textContent, /Saved fixture/);
  await page.advance(1000);
  await page.fire("availability-load");
  assert.match(page.get("child-status-details").textContent, /Fresh fixture result/);
  assert.deepEqual(page.calls.filter(call => call.path === "/api/child/sync").map(call => call.body.refresh), [false, true]);
  await controller.dispose();
});

test("independent missing child source does not hide loaded parent partial coverage", async t => {
  const page = harness(t, { chat: true, override: path => path === "/api/child/sync" ? new Response('{"status":"source_missing"}') : undefined });
  const controller = page.mount();
  await page.fire("availability-load"); controller.collapse();
  assert.match(page.get("child-status").textContent, /not connected/);
  assert.match(text(page.get("availability-parent-details")), /partial/);
  assert.match(page.get("availability-window").textContent, /2026-10-01.*2026-11-01.*exclusive/);
  assert.match(page.get("availability-window").textContent, /1488/);
  assert.equal(page.visible("child-status"), true);
  assert.equal(page.visible("chat-calendar-person-2"), true);
  assert.match(page.get("chat-calendar-person-2").textContent, /Not loaded|Unavailable/);
  assert.equal(page.calls.length, 2);
  await controller.dispose();
});

test("expiry remains active while collapsed and prevents another Sync", async t => {
  const page = harness(t, { chat: true });
  const controller = page.mount();
  await page.fire("availability-load"); controller.collapse();
  await page.advance(30 * 60000);
  assert.match(text(page.get("chat-calendar-status")), /expired/);
  assert.equal(page.get("availability-load").disabled, true);
  assert.equal(page.childBlocks().length, 0);
  const count = page.calls.length;
  controller.expand(); await page.fire("availability-load");
  assert.equal(page.calls.length, count);
  await controller.dispose();
});

test("late child reply after disposal never starts parent work or restores any Calendar content", async t => {
  const pending = deferred();
  const page = harness(t, { chat: true, override: path => path === "/api/child/sync" ? pending.promise : undefined });
  const controller = page.mount();
  const loading = page.fire("availability-load"); await settle();
  const exit = controller.dispose();
  await exit;
  pending.resolve(new Response('{"status":"source_missing"}'));
  await loading;
  assert.deepEqual(page.calls.map(call => call.path), ["/api/child/sync", "/api/clear"]);
  assert.equal(page.get("chat-calendar-body").children.length, 0);
  assert.equal(page.get("chat-calendar-status").children.length, 0);
  assert.equal(page.resources().timers, 0);
});

test("pagehide owns one leave, releases listeners, and bfcache never reloads data", async t => {
  const page = harness(t, { chat: true });
  const baseline = page.resources();
  const controller = page.mount();
  await page.emit("pagehide");
  const exit = controller.dispose(); await exit;
  assert.equal(controller.dispose(), exit);
  assert.equal(page.resources().listeners, baseline.listeners);
  assert.equal(page.resources().timers, 0);
  await page.emit("pageshow", { persisted: true });
  assert.equal(page.calls.length, 1);
  assert.equal(page.calls[0].body.reason, "leave");
  assert.throws(() => page.mount(), /calendar_disposed/);
});

test("Clear stays an explicit separate action; dispose racing Clear still performs exactly one leave", async t => {
  const pending = deferred();
  const page = harness(t, { chat: true, override: (path, body) => path === "/api/clear" && !body.reason ? pending.promise : undefined });
  const controller = page.mount();
  await page.fire("availability-load");
  await page.fire("availability-clear"); await settle();
  const exit = controller.dispose();
  pending.resolve(new Response('{"status":"cleared","cleanup":"not_requested"}'));
  await exit;
  assert.deepEqual(page.calls.filter(call => call.path === "/api/clear").map(call => call.body), [{}, { reason: "leave" }]);
});

for (const scenario of ["unavailable", "revoked", "cleanup_failed"]) {
  test(`collapsed ${scenario} remains explicit without a successful calendar view`, async t => {
    const page = harness(t, { chat: true, scenario });
    const controller = page.mount();
    await page.fire("availability-load"); controller.collapse();
    assert.match(text(page.get("chat-calendar-status")), /unavailable|unconfirmed|revoked|paused/i);
    assert.equal(page.get("availability-grid").hidden, true);
    const completion = controller.dispose();
    if (scenario === "unavailable") await completion;
    else await assert.rejects(completion, { message: "calendar_cleanup_unconfirmed" });
    assert.equal(controller.dispose(), completion);
  });
}