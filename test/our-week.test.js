"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs");
const A = require("../owner/availability-core"), C = require("../owner/child-calendar-core");
const { harness: freshHarness, settle, deferred, descendants, text } = require("./fixtures/our-week-harness");
// Saved-view/lifecycle cases explicitly remember the supported week, not a fake default.
// Independent source/display lifecycle tests intentionally omit the action seam.
// The real shared flow is covered in shared-confirmation.test.js.
const harness = (t, options = {}) => freshHarness(t, { sharedActions: false, initialDates: ["2026-10-09", "2026-10-15"], ...options });
const now = Date.parse("2026-09-17T01:00:00Z");
const event = (start, end, extra = {}) => ({ start, end, allDay: false, status: "scheduled", ...extra });
const packet = (events = []) => ({ version: 1, generation: 1, revision: 0, lifecycle: "loaded", synthetic: true,
  window: { ...C.window }, checkedAt: "2026-09-17T00:59:00Z", partial: false, events });
const imported = (events = []) => ({ contract: C.contract, window: { ...C.window }, checkedAt: "2026-09-17T00:59:00Z", partial: false,
  events: events.map(e => ({ ...e, title: "SYNTHETIC APPROVED TITLE <img>", kind: "occurrence", redacted: false })) });
const json = data => new Response(JSON.stringify(data));

const literalName = 'SYNTHETIC <img src=x onerror="throw 1"> $& $$ $` $\' Event 1';
const namedData = () => ({ ...imported(), events: [
  { ...imported([event("invalid", "invalid")]).events[0], title: "SYNTHETIC DROPPED" },
  ...[literalName, "SYNTHETIC SECOND", "", "   ", "Busy"].map((title, i) => ({
    ...imported([event("2026-10-09T09:07:30+08:00", "2026-10-09T10:12:00+08:00")]).events[0],
    title, redacted: i === 4, status: i === 1 ? "cancelled" : i === 3 ? "unknown" : "scheduled"
  })),
  { ...imported([event("2026-10-09T00:00:00+08:00", "2026-10-13T00:00:00+08:00", { allDay: true })]).events[0], title: "SYNTHETIC ALL DAY" },
  { ...imported([event("2026-10-12T09:00:00+08:00", "2026-10-12T10:00:00+08:00")]).events[0], title: "SYNTHETIC LATER" }
] });
const genericNode = h => {
  const n = h.document.createElement("div");
  n.textContent = "Event 1 · 09:07:30–10:12 · Scheduled event";
  n.title = "2026-10-09 · Kimi · Event 1 · 09:07:30–10:12 · Not a Busy status";
  n.setAttribute("aria-label", n.title); return n;
};

test("consented names are literal text indexed to projected events, not identical times, with unnamed redactions and unchanged parent/storage/events", async t => {
  const data = namedData(), before = JSON.stringify(data);
  const h = harness(t, { childData: data });
  await h.fire("availability-saved"); const parent = h.parentBlocks().map(n => [n.title, n.style.gridRow]);
  const stored = h.storage.getItem(require("../shared/date-selection").key), snapshot = JSON.stringify(h.parentData());
  await h.openSaved();
  const timed = h.childBlocks().filter(n => n.className === "child-event" && n.dataset.childKey.startsWith("2026-10-09"));
  assert.deepEqual(timed.map(n => n.textContent.split(" · ")[0]), [literalName, "SYNTHETIC SECOND", "Event 3", "Event 4", "Event 5"]);
  assert.equal(new Set(timed.map(n => n.style.left)).size, 5);
  for (const n of timed) {
    assert.equal(n.attributes["aria-label"], n.title); assert.ok(n.title.includes(n.textContent));
    assert.match(n.title, /Not a Busy status/); assert.equal(n.children.length, 0);
  }
  assert.match(timed[1].textContent, /Cancelled event/); assert.match(timed[3].textContent, /Event status unknown/);
  const allDay = h.childBlocks().filter(n => n.className === "child-all-day");
  assert.ok(allDay.length > 1);
  for (const n of allDay) {
    assert.match(n.textContent, /^SYNTHETIC ALL DAY ·/); assert.match(n.title, /SYNTHETIC ALL DAY.*All-day.*Not a Busy status/);
    assert.equal(n.attributes["aria-label"], n.title);
  }
  assert.doesNotMatch(JSON.stringify(h.events), /title|SYNTHETIC|Fictional art|Busy/);
  assert.ok(h.packets.filter(p => p.lifecycle === "loaded").every(p => p.events.every(e => Object.keys(e).sort().join() === "allDay,end,start,status")));
  assert.doesNotMatch(JSON.stringify(descendants(h.get("availability-grid")).map(n => n.dataset)), /SYNTHETIC|title/);
  assert.doesNotMatch(h.all(), /SYNTHETIC DROPPED|SYNTHETIC PRIVATE SENTINEL/);
  assert.deepEqual(h.parentBlocks().map(n => [n.title, n.style.gridRow]), parent);
  assert.equal(JSON.stringify(h.parentData()), snapshot); assert.equal(JSON.stringify(data), before);
  assert.equal(h.storage.getItem(require("../shared/date-selection").key), stored);
  assert.deepEqual(h.calls[0].body, { acknowledged: true, requestId: "11111111-1111-4111-8111-111111111111", refresh: false, cacheOnly: true, startDate: "2026-10-09", endDate: "2026-10-15" });
  assert.equal(h.calls.filter(c => c.path === "/api/availability").length, 1);
});

test("page-local renderer is single-registration, returns no names and fences wrong generation/revision/index", async t => {
  const h = harness(t, { childData: namedData() }); await h.openSaved();
  const p = h.packets.findLast(p => p.lifecycle === "loaded");
  assert.throws(() => h.registerRenderer(() => {}), /Invalid week renderer/);
  for (const [index, generation, revision] of [[0, p.generation - 1, p.revision], [0, p.generation, p.revision + 1], [-1, p.generation, p.revision], [100, p.generation, p.revision], [.5, p.generation, p.revision]]) {
    const n = genericNode(h), before = n.textContent;
    assert.equal(h.renderChild(n, index, generation, revision), undefined); assert.equal(n.textContent, before);
  }
  const n = genericNode(h);
  assert.equal(h.renderChild(n, 0, p.generation, p.revision), undefined);
  assert.ok(n.textContent.startsWith(literalName + " · "));
  const rendered = n.textContent; h.renderChild(n, 0, p.generation, p.revision); assert.equal(n.textContent, rendered);
});

test("names survive pager, parent cleanup and stale/focus redraw without extra calls or dates-only writes", async t => {
  const h = freshHarness(t, { sharedActions: false, childData: namedData() });
  await h.fire("availability-saved"); await h.openSaved();
  const before = h.childBlocks().map(n => n.title), stored = h.storage.getItem(require("../shared/date-selection").key);
  await h.fire("availability-check"); // Safe parent cleanup metadata must not erase valid child names.
  const count = h.calls.length;
  await h.fire("availability-display-next");
  assert.ok(h.childBlocks().some(n => n.textContent.startsWith("SYNTHETIC LATER ·")));
  await h.fire("availability-display-previous"); assert.deepEqual(h.childBlocks().map(n => n.title), before);
  const first = h.childBlocks().find(n => n.className === "child-event"); first.focus();
  await h.advance(240000); await h.document.dispatchEvent({ type: "visibilitychange" });
  assert.match(h.get("child-week-status").textContent, /Stale/);
  assert.deepEqual(h.childBlocks().map(n => n.title), before); assert.equal(h.focus.dataset.childKey, first.dataset.childKey);
  assert.equal(h.calls.length, count); assert.equal(h.storage.getItem(require("../shared/date-selection").key), stored);
});

test("renderer fails closed before delayed date and expiry notifications and cannot recover cleared names", async t => {
  for (const trigger of ["dates", "expiry"]) {
    const h = harness(t, { childData: namedData() }); await h.openSaved();
    const p = h.packets.findLast(p => p.lifecycle === "loaded");
    if (trigger === "dates") h.get("availability-end").value = "2026-10-16";
    else h.elapseWithoutTimers(1800001);
    const n = genericNode(h); h.renderChild(n, 0, p.generation, p.revision);
    assert.match(n.textContent, /^Event 1 ·/);
    h.get("availability-end").value = "2026-10-15";
    h.renderChild(n, 0, p.generation, p.revision); assert.match(n.textContent, /^Event 1 ·/);
  }
});

test("name disclosure copy and long-title wrapping preserve grid geometry and parent scope", () => {
  const html = fs.readFileSync(require.resolve("../owner/index.html"), "utf8");
  const css = fs.readFileSync(require.resolve("../owner/owner.css"), "utf8");
  assert.match(html, /Our week shows consented event names, times and reported status\. Private and Busy-only events stay unnamed/);
  assert.doesNotMatch(html, /never titles|Titles omitted/);
  assert.match(html, /336 half-hour slots per parent, 672 total across the two parent calendars only/);
  assert.match(css, /\.child-event, \.child-all-day \{ overflow-wrap:anywhere; \}/);
  assert.match(css, /\.child-all-day \{[^}]*height:44px; overflow:hidden;/);
  assert.match(css, /grid-template-rows:repeat\(48,24px\)/);
});

for (const trigger of ["clear", "loading", "dates", "expiry", "safety", "pagehide"])
  test(`names clear synchronously on ${trigger}; stale redraw and old renderer calls cannot resurrect them`, async t => {
    const h = harness(t, { childData: namedData() }); await h.openSaved();
    assert.ok(h.childBlocks().some(n => n.textContent.includes(literalName)));
    const p = h.packets.findLast(p => p.lifecycle === "loaded");
    let work;
    if (trigger === "clear") work = h.fire("availability-clear");
    else if (trigger === "loading") work = h.childActions().saved();
    else if (trigger === "dates") work = h.range("2026-10-08", "2026-10-14");
    else if (trigger === "expiry") work = h.advance(1800001);
    else if (trigger === "safety") work = h.emit("week-safety-changed", { detail: { version: 1, revision: 0, pending: false, blocked: true, expired: false } });
    else work = h.emit("pagehide");
    assert.equal(h.childBlocks().length, 0);
    const n = genericNode(h), before = n.textContent;
    h.renderChild(n, 0, p.generation, p.revision); assert.equal(n.textContent, before);
    await work; await settle();
    // A successful explicit saved load may draw new names, never old renderer generations.
    if (trigger === "loading") { assert.ok(h.childBlocks().length); return; }
    if (trigger === "dates") await h.range("2026-10-09", "2026-10-15");
    await h.document.dispatchEvent({ type: "visibilitychange" }); await h.emit("child-week-changed", { detail: p });
    assert.equal(h.childBlocks().length, 0); assert.doesNotMatch(h.all(), /SYNTHETIC ALL DAY|SYNTHETIC SECOND/);
  });

test("busy-only saved views remain generic; failed restricted projections never retain private names", async t => {
  const h = harness(t); await h.openSaved("busy_only");
  assert.ok(h.childBlocks().length); assert.ok(h.childBlocks().every(n => /^Event \d+ ·/.test(n.textContent)));
  for (const redacted of [false, true]) {
    const data = namedData(); data.events = [{ ...data.events[1], title: "SYNTHETIC PRIVATE SENTINEL", redacted }];
    const h = harness(t, { override: path => path === "/api/child/saved" ? json({ status: "saved", access: { person: "Kimi", guardian: true, disclosure: "busy_only", sourceName: "Synthetic source" }, data }) : null });
    await h.openSaved("busy_only");
    assert.equal(h.childBlocks().length, 0); assert.doesNotMatch(h.all(), /SYNTHETIC PRIVATE SENTINEL/);
    const n = genericNode(h); h.renderChild(n, 0, h.packets.at(-1).generation + 1, 0);
    assert.match(n.textContent, /^Event 1 ·/);
  }
});

test("a late named saved read cannot replace a newer read, and a failed projection clears earlier names", async t => {
  const late = deferred(); let attempt = 0;
  const data = C.project(namedData(), "details", now), invalid = { ...data, extra: "SYNTHETIC PRIVATE SENTINEL" };
  const wrap = data => ({ status: "saved", access: { person: "Kimi", guardian: true, disclosure: "details", sourceName: "Synthetic source" }, data });
  const h = harness(t, { override: path => path === "/api/child/saved" ? (++attempt === 1 ? late.promise : json(wrap(attempt === 2 ? data : invalid))) : null });
  const oldRead = h.childActions().saved(); await settle();
  await h.range("2026-10-08", "2026-10-14"); await h.range("2026-10-09", "2026-10-15"); await settle();
  await h.childActions().saved();
  const p = h.packets.findLast(p => p.lifecycle === "loaded"), names = h.childBlocks().map(n => n.title);
  late.resolve(json(wrap({ ...data, events: [{ ...data.events[1], title: "SYNTHETIC LATE" }] }))); await oldRead; await settle();
  assert.deepEqual(h.childBlocks().map(n => n.title), names); assert.doesNotMatch(h.all(), /SYNTHETIC LATE/);
  await h.childActions().saved(); await settle();
  assert.equal(h.childBlocks().length, 0);
  const n = genericNode(h); h.renderChild(n, 0, p.generation, p.revision); assert.match(n.textContent, /^Event 1 ·/);
  assert.doesNotMatch(h.all(), /SYNTHETIC PRIVATE SENTINEL/);
});

test("fresh combined default resolves the fixed load scope, preserves unknown schedules, and never automatically writes or calls APIs", async t => {
  const h = freshHarness(t, { meta: { "owner-mode": "live", "owner-cache": "disk", "child-mode": C.contract } });
  assert.equal(h.get("availability-start").value, "2026-10-09"); assert.equal(h.get("availability-end").value, "2026-10-11");
  assert.equal(h.get("availability-empty").dataset.state, "idle");
  assert.match(h.get("availability-window").textContent, /All 336 half-hour slots per parent, 672 total/);
  for (const id of ["availability-load", "availability-saved"]) assert.equal(h.get(id).disabled, false);
  assert.equal(h.get("availability-refresh").disabled, true); await h.fire("availability-refresh");
  await h.emit("focus"); await h.emit("pageshow", { persisted: false });
  await h.document.dispatchEvent({ type: "visibilitychange" }); await settle();
  assert.equal(h.calls.length, 0); assert.equal(h.storage.values.size, 1); // Explicit dates-only fixture selection.
  assert.equal(h.parentBlocks().length, 0); assert.equal(h.childBlocks().length, 0);
  assert.match(h.get("child-week-status").textContent, /unknown|Not loaded/i);
  assert.equal(C.datesAllowed("2026-10-09", "2026-10-11"), false);
  assert.equal(C.datesAllowed("2026-10-09", "2026-10-15"), true);
  assert.deepEqual(C.window, { start: "2026-10-08T16:00:00Z", end: "2026-10-15T16:00:00Z", timezone: "Asia/Taipei" });
  await h.fire("availability-supported-dates"); await settle();
  assert.equal(h.get("availability-end").value, "2026-10-15"); assert.equal(h.calls.length, 0);
  assert.equal(h.get("availability-load").disabled, false); assert.equal(h.get("child-find"), null);
  assert.equal(h.get("child-review-panel"), null);
});

test("pure child display rejects malformed/extra data and copies every nested field without parent contract changes", () => {
  const p = packet([event("2026-10-09T09:07:30+08:00", "2026-10-09T10:12:00+08:00")]);
  const before = JSON.stringify(p), copy = A.childDisplay(p, A.liveWindow, true, now);
  assert.deepEqual(copy, p); assert.notEqual(copy.window, p.window); assert.notEqual(copy.events[0], p.events[0]);
  for (const mutate of [v => { v.title = "SECRET"; }, v => { v.events[0].title = "SECRET"; }, v => { v.window.interval = 30; },
    v => { v.version = 2; }, v => { v.generation = -1; }, v => { v.revision = .5; }, v => { v.synthetic = false; },
    v => { v.lifecycle = "ready"; }, v => { v.partial = null; }, v => { v.checkedAt = "2026-02-30T00:00:00Z"; },
    v => { v.events[0].status = "busy"; }, v => { v.events[0].allDay = "false"; }, v => { v.events[0].start = "2026-10-09T24:00:00Z"; },
    v => { v.events[0].end = v.events[0].start; }, v => { v.events = Array(101).fill(v.events[0]); },
    v => { v.events[0].allDay = true; }, v => { v.window.end = "2026-10-16T16:00:00Z"; }]) {
    const bad = structuredClone(p); mutate(bad); assert.throws(() => A.childDisplay(bad, A.liveWindow, true, now));
  }
  assert.throws(() => A.childDisplay(p, A.window, true, now));
  for (const lifecycle of ["idle", "loading", "cleared", "unavailable", "expired"]) {
    const empty = { ...packet(), lifecycle, window: null, checkedAt: null, partial: null };
    assert.equal(A.childDisplay(empty, null, true, now).events.length, 0);
    assert.throws(() => A.childDisplay({ ...empty, checkedAt: p.checkedAt }, null, true, now));
    assert.throws(() => A.childDisplay({ ...empty, events: p.events }, null, true, now));
  }
  assert.equal(JSON.stringify(p), before);
  assert.equal(A.displayPeople().length, 2); assert.equal(A.weekLayout([], A.liveWindow)[0].tracks.length, 2);
  assert.deepEqual(A.project({ window: A.liveWindow, checkedAt: p.checkedAt, people: [] }, A.liveWindow).people.map(p => p.person), [0, 1]);
});

test("Taipei half-open clipping retains seconds, midnight exclusion, overlap lanes and a separate all-day band", () => {
  const p = packet([
    event("2026-10-08T23:50:00+08:00", "2026-10-09T00:07:30+08:00"),
    event("2026-10-09T09:07:30+08:00", "2026-10-09T10:12:00+08:00"),
    event("2026-10-09T09:08:00+08:00", "2026-10-09T09:15:00+08:00", { status: "cancelled" }),
    event("2026-10-09T09:15:00+08:00", "2026-10-09T09:30:00+08:00", { allDay: null, status: "unknown" }),
    event("2026-10-09T23:55:00+08:00", "2026-10-10T00:00:00+08:00"),
    event("2026-10-09T00:00:00+08:00", "2026-10-11T00:00:00+08:00", { allDay: true }),
    event("2026-10-15T23:57:00+08:00", "2026-10-16T03:00:00+08:00")
  ]);
  const layout = A.childDayLayout(p, A.liveWindow, true, now), first = layout[0];
  assert.deepEqual(first.timed.map(e => [e.startTime, e.endTime, e.lane, e.lanes]), [
    ["00:00", "00:07:30", 0, 1], ["09:07:30", "10:12", 0, 2], ["09:08", "09:15", 1, 2],
    ["09:15", "09:30", 1, 2], ["23:55", "24:00", 0, 1]
  ]);
  assert.equal(first.timed[1].start, 547.5); assert.equal(first.timed[3].allDay, null);
  assert.deepEqual(layout.map(d => d.allDay.length), [1, 1, 0, 0, 0, 0, 0]);
  assert.equal(layout[1].timed.length, 0); assert.equal(layout[6].timed[0].endTime, "24:00");
  assert.deepEqual(A.childDayLayout(p, A.liveWindow, true, now), layout);
  assert.equal(A.childFreshness(p, Date.parse(p.checkedAt) + 299999), "Recent snapshot, not continuous verification");
  assert.equal(A.childFreshness(p, Date.parse(p.checkedAt) + 300000), "Stale or unknown freshness");
});

test("combined startup is empty, restores dates first and preserves old-protocol/source gating with zero API", async t => {
  for (const meta of [{}, { "child-mode": "unavailable" }, { "owner-range": "old" }, { "owner-saved": "old" }, { "owner-contract": "old" }, { "child-mode": C.contract }]) {
    const h = harness(t, { meta });
    assert.equal(h.calls.length, 0); assert.equal(h.get("availability-empty").hidden, false);
    assert.equal(h.get("availability-grid").hidden, true); assert.equal(h.focus, undefined);
    if (Object.keys(meta).length) { await h.childActions().saved(); assert.equal(h.calls.length, 0); }
  }
  const h = harness(t, { initialDates: ["2026-09-20", "2026-09-26"] });
  await h.childActions().saved(); assert.equal(h.calls.length, 0);
});

test("parent-only, child-only and combined share one grid with no third parent request, bridge titles, or activity storage", async t => {
  const h = harness(t);
  const remembered = h.storage.getItem(require("../shared/date-selection").key);
  await h.fire("availability-load");
  assert.equal(h.calls.length, 1); assert.equal(h.childBlocks().length, 0);
  assert.match(h.get("child-week-status").textContent, /Not loaded/);
  const parentBefore = h.parentBlocks().map(n => [n.title, n.style.gridRow]);
  await h.openSaved();
  assert.ok(h.childBlocks().length > 0); assert.deepEqual(h.parentBlocks().map(n => [n.title, n.style.gridRow]), parentBefore);
  assert.ok(h.get("availability-grid").children[0].children.slice(1).every(d => d.children[1].children.length === 3));
  assert.doesNotMatch(JSON.stringify(h.packets), /title|handle|token|summary|sourceName|<sample>|Busy/);
  assert.match(text(h.get("availability-grid")), /Fictional art club <sample>/);
  assert.doesNotMatch(text(h.get("availability-grid")), /Private|Untitled|Busy-only/);
  assert.equal(h.calls.filter(c => c.path === "/api/availability").length, 1);
  assert.deepEqual(h.calls[0].body, { acknowledged: true, requestId: "11111111-1111-4111-8111-111111111111", refresh: false, startDate: "2026-10-09", endDate: "2026-10-15" });
  assert.equal(h.storage.getItem(require("../shared/date-selection").key), remembered);
  const childOnly = harness(t); await childOnly.openSaved();
  assert.equal(childOnly.calls.some(c => c.path === "/api/availability"), false);
  assert.equal(childOnly.get("availability-empty").hidden, true);
  assert.ok(childOnly.parentBlocks().every(n => n.dataset.status === "unknown"));
  assert.equal(childOnly.get("availability-context").children.length, 2);
});

test("loaded empty child is not the initial empty state and never implies free gaps", async t => {
  const h = harness(t, { childData: imported() }); await h.openSaved();
  assert.equal(h.childBlocks().length, 0); assert.equal(h.get("availability-grid").hidden, false);
  assert.match(h.get("child-week-status").textContent, /Loaded; no events returned.*unknown, not free/);
  assert.ok(h.parentBlocks().every(n => n.dataset.status === "unknown"));
});

test("saved view uses validated stored disclosure and shows provenance only in common Details", async t => {
  const h = harness(t); await h.openSaved("busy_only");
  assert.equal(h.get("child-imported-access").hidden, false);
  assert.match(h.get("child-imported-access").textContent, /Saved access.*Busy-only/);
  assert.doesNotMatch(JSON.stringify(h.packets), /Guardian|disclosure|summary|sourceName/);
  await h.fire("availability-clear"); assert.equal(h.get("child-imported-access").hidden, true);
  assert.equal(h.get("child-imported-access").textContent, "");
  await settle(); const count = h.calls.length; await h.childActions().saved();
  assert.equal(h.calls.length, count); assert.equal(h.childBlocks().length, 0);
});

test("child exact geometry and status text retain approved names and all headers/axis align", async t => {
  const h = harness(t, { childData: imported([
    event("2026-10-09T09:07:30+08:00", "2026-10-09T09:08:00+08:00", { allDay: null, status: "unknown" }),
    event("2026-10-09T00:00:00+08:00", "2026-10-10T00:00:00+08:00", { allDay: true, status: "cancelled" })
  ]) }); await h.openSaved();
  const [band, timed] = h.childBlocks();
  assert.equal(band.className, "child-all-day"); assert.match(band.textContent, /Cancelled event/);
  assert.equal(timed.style.top, `${547.5 / 1440 * 100}%`); assert.equal(timed.style.height, `${.5 / 1440 * 100}%`);
  assert.match(timed.attributes["aria-label"], /09:07:30–09:08.*Event status unknown.*All-day status unknown/);
  assert.equal(timed.attributes.tabindex, "0"); assert.match(timed.textContent, /SYNTHETIC APPROVED TITLE <img>/);
  assert.doesNotMatch(h.all(), /SYNTHETIC PRIVATE SENTINEL/);
  assert.deepEqual(new Set(h.get("availability-grid").children[0].children.map(n => n.children[0].style.height)), new Set(["148px"]));
});

test("parent loading, successful Update, saved miss and generic failures do not remove a valid child", async t => {
  for (const kind of ["success", "miss", "failure", "transport"]) {
    const wait = deferred();
    const h = harness(t, { override: path => path === "/api/availability" ? wait.promise : null });
    await h.openSaved(); const original = h.childBlocks().map(n => n.title), stamp = h.packets.at(-1).checkedAt;
    const pending = h.fire(kind === "miss" ? "availability-saved" : "availability-load");
    assert.deepEqual(h.childBlocks().map(n => n.title), original); assert.equal(h.get("availability-empty").hidden, true);
    if (kind === "transport") wait.reject(Error("PRIVATE"));
    else wait.resolve(json(kind === "success" ? h.parentData() : { status: kind === "miss" ? "cache_missing" : "unavailable", cleanup: "workflow_disabled" }));
    await pending;
    assert.deepEqual(h.childBlocks().map(n => n.title), original); assert.match(h.get("child-week-status").textContent, new RegExp(stamp));
    assert.equal(h.calls.filter(c => c.path === "/api/child/saved").length, 1);
    if (kind !== "miss") { await h.fire("availability-refresh"); assert.deepEqual(h.childBlocks().map(n => n.title), original); }
  }
});

test("invalid child saved data only removes child and leaves the independent parent view", async t => {
  const h = harness(t, { override: path => path === "/api/child/saved" ? json({ title: "PRIVATE" }) : null });
  await h.fire("availability-load"); await h.openSaved();
  assert.equal(h.childBlocks().length, 0); assert.ok(h.parentBlocks().every(n => n.dataset.status === "busy"));
  assert.match(h.get("child-week-status").textContent, /Unavailable/);
});

test("both cleanup barriers settle before new child saved work after date-away/back; old reads cannot repaint", async t => {
  const parentClear = deferred(), childClear = deferred(), late = deferred(); let delay = false, delayImport = false;
  const h = harness(t, { override: path => delay && path === "/api/clear" ? parentClear.promise :
    delay && path === "/api/child/clear" ? childClear.promise : delayImport && path === "/api/child/saved" ? late.promise : null });
  await h.fire("availability-load"); await h.openSaved(); const old = structuredClone(h.packets.at(-1));
  delayImport = true; const reading = h.childActions().saved(); await settle(); delay = true;
  const away = h.range("2026-10-08", "2026-10-14");
  assert.equal(h.childBlocks().length, 0); assert.equal(h.parentBlocks().length, 0);
  const back = h.range("2026-10-09", "2026-10-15");
  const count = h.calls.filter(c => c.path === "/api/child/saved").length;
  await h.childActions().saved(); assert.equal(h.calls.filter(c => c.path === "/api/child/saved").length, count);
  childClear.resolve(json({ status: "cleared" })); await settle();
  await h.childActions().saved(); assert.equal(h.calls.filter(c => c.path === "/api/child/saved").length, count);
  parentClear.resolve(json({ status: "cleared", cleanup: "not_requested" })); await away; await back; await settle();
  late.resolve(json({ status: "cache_missing" })); await reading; await settle();
  await h.emit("child-week-changed", { detail: old }); assert.equal(h.childBlocks().length, 0);
  assert.equal(h.calls.filter(c => c.path === "/api/clear").length, 1);
  assert.deepEqual(h.calls.find(c => c.path === "/api/clear").body, { reason: "range" });
});

test("parent cleanup/session/access failures invalidate child via metadata, never a signalling parent Clear", async t => {
  for (const response of [{ status: "cleanup_failed", cleanup: "cleanup_failed" }, { status: "blocked", reason: "session_unavailable" },
    { status: "revoked", cleanup: "workflow_disabled" }, { status: "contract_drift", cleanup: "not_requested" }]) {
    const h = harness(t, { override: path => path === "/api/status" ? json(response) : null });
    await h.openSaved(); await h.fire("availability-check"); await settle();
    assert.equal(h.childBlocks().length, 0);
    const count = h.calls.length; await h.childActions().saved(); assert.equal(h.calls.length, count);
    assert.equal(h.calls.some(c => c.path === "/api/clear"), false);
    assert.equal(h.metadata.at(-1).blocked, true);
  }
});

test("freshness becomes stale at five minutes; child expiry clears child, not saved parents or their timestamp", async t => {
  const h = harness(t, { childData: imported([event("2026-10-09T09:00:00+08:00", "2026-10-09T10:00:00+08:00")]) });
  await h.fire("availability-saved"); await h.openSaved();
  const parent = h.parentBlocks().map(n => n.title), original = h.get("availability-status").textContent;
  assert.match(h.get("child-week-status").textContent, /Recent snapshot/);
  h.childBlocks()[0].focus(); const focusedKey = h.focus.dataset.childKey;
  await h.advance(240000); assert.match(h.get("child-week-status").textContent, /Stale/);
  assert.equal(h.focus.dataset.childKey, focusedKey);
  assert.ok(h.childBlocks().includes(h.focus));
  const old = structuredClone(h.packets.find(p => p.lifecycle === "loaded"));
  await h.advance(1560000); assert.equal(h.childBlocks().length, 0); assert.match(h.get("child-week-status").textContent, /expired/);
  const count = h.calls.length; await h.childActions().saved(); assert.equal(h.calls.length, count);
  assert.deepEqual(h.parentBlocks().map(n => n.title), parent);
  assert.ok(h.get("availability-status").textContent.startsWith(original.split(" · Saved view")[0]));
  await h.emit("child-week-changed", { detail: old }); assert.equal(h.childBlocks().length, 0);
  assert.equal(h.calls.some(c => c.path === "/api/clear"), false);
});

test("many all-day events stay in a bounded keyboard-scrollable band, not timed Busy blocks", async t => {
  const h = harness(t, { childData: imported(Array.from({ length: 10 }, () =>
    event("2026-10-09T00:00:00+08:00", "2026-10-10T00:00:00+08:00", { allDay: true }))) });
  await h.openSaved();
  const band = descendants(h.get("availability-grid")).find(n => n.className === "week-all-day");
  assert.equal(band.style.height, "156px"); assert.equal(band.attributes.tabindex, "0");
  assert.equal(h.childBlocks().length, 10); assert.ok(h.childBlocks().every(n => n.className === "child-all-day"));
  band.focus(); await h.document.dispatchEvent({ type: "visibilitychange" });
  assert.equal(h.focus.dataset.childKey, band.dataset.childKey); assert.notEqual(h.focus, band);
});

test("parent range acknowledgement alone cannot bypass pending child cleanup, and cleanup failure stays blocked", async t => {
  for (const failed of [false, true]) {
    const wait = deferred(); let delay = false;
    const h = harness(t, { override: path => delay && path === "/api/child/clear" ? wait.promise : null });
    await h.fire("availability-load"); await h.openSaved(); delay = true;
    await h.range("2026-10-08", "2026-10-14"); await h.range("2026-10-09", "2026-10-15");
    const count = h.calls.length; await h.childActions().saved(); assert.equal(h.calls.length, count);
    wait.resolve(json({ status: failed ? "cleanup_failed" : "cleared" })); await settle();
    assert.equal(h.childBlocks().length, 0);
    assert.equal(h.calls.filter(c => c.path === "/api/clear").length, 1);
    delay = false; await h.childActions().saved();
    assert.equal(h.childBlocks().length > 0, !failed);
  }
});

test("a replaced in-flight child saved response cannot overwrite a newer saved view or its source state", async t => {
  const late = deferred(); let first = true;
  const h = harness(t, { override: path => path === "/api/child/saved" && first ? (first = false, late.promise) : null });
  const reading = h.openSaved(); await settle();
  await h.range("2026-10-08", "2026-10-14"); await h.range("2026-10-09", "2026-10-15"); await settle(); await h.openSaved();
  const before = h.childBlocks().map(n => n.title), summary = h.get("child-status").textContent;
  late.resolve(json({ status: "cache_missing" })); await reading; await settle();
  assert.deepEqual(h.childBlocks().map(n => n.title), before); assert.equal(h.get("child-status").textContent, summary);
  const current = structuredClone(h.packets.at(-1));
  await h.emit("child-week-changed", { detail: { ...current, generation: current.generation - 1, revision: 0 } });
  assert.deepEqual(h.childBlocks().map(n => n.title), before);
});

for (const trigger of ["availability-clear", "owner-session-cleared", "pagehide", "pageshow"])
  test(`${trigger} fences both controllers and replayed child data`, async t => {
    const h = harness(t); await h.fire("availability-load"); await h.openSaved(); const old = structuredClone(h.packets.at(-1));
    if (trigger === "availability-clear") await h.fire(trigger); else await h.emit(trigger, { persisted: true, detail: { source: "owner", leaving: true } });
    assert.equal(h.childBlocks().length, 0); assert.equal(h.parentBlocks().length, 0); await settle();
    await h.emit("child-week-changed", { detail: old }); assert.equal(h.childBlocks().length, 0);
  });

test("details response cannot be reused as busy-only; strict receiver rejects injected titles and copies accepted packets", async t => {
  const h = harness(t); await h.openSaved();
  const old = structuredClone(h.packets.at(-1)); const p = { ...old, generation: old.generation + 1 };
  await h.emit("child-week-changed", { detail: p }); const count = h.childBlocks().length;
  p.events.length = 0; await h.document.dispatchEvent({ type: "visibilitychange" }); assert.equal(h.childBlocks().length, count);
  const bad = { ...old, generation: old.generation + 2, title: "DO NOT DISCLOSE" };
  await h.emit("child-week-changed", { detail: bad }); assert.equal(h.childBlocks().length, 0); assert.doesNotMatch(h.all(), /DO NOT DISCLOSE/);
  const restricted = harness(t, { override: path => path === "/api/child/saved" ? json({ status: "saved", access: { person: "Kimi", guardian: true, disclosure: "busy_only", sourceName: "Synthetic source" }, data: imported([event("2026-10-09T09:00:00+08:00", "2026-10-09T10:00:00+08:00")]) }) : null });
  await restricted.openSaved("busy_only"); assert.equal(restricted.childBlocks().length, 0);
  assert.equal(restricted.packets.some(p => p.lifecycle === "loaded"), false);
});

test("main markup has no child wizard or operations and keeps correct CSRF script order", () => {
  const html = fs.readFileSync(require.resolve("../owner/index.html"), "utf8");
  assert.doesNotMatch(html, /<dialog|id="child-calendar-section"|id="calendar-access"/);
  assert.doesNotMatch(html, /id="child-events"|id="school-calendar|src="\/school-calendar|Kimi source &amp; access|Load Kimi/);
  assert.doesNotMatch(html, /id="child-(?:source-select|person|disclosure|guardian|review|import|change|clear|skip|cancel)"/);
  assert.ok(html.indexOf('/availability-ui.js') < html.indexOf('/child-calendar-ui.js'));
  assert.ok(html.indexOf('/child-calendar-core.js') < html.indexOf('/child-calendar-ui.js'));
  assert.ok(html.indexOf('/child-calendar-ui.js') < html.indexOf('/owner-ui.js'));
  assert.match(html, /336 half-hour slots per parent, 672 total across the two parent calendars only/);
  const css = fs.readFileSync(require.resolve("../owner/owner.css"), "utf8");
  assert.match(css, /repeat\(3,minmax\(0,1fr\)\)/); assert.match(css, /repeat\(48,24px\)/);
  assert.match(css, /\.child-event:focus-visible/); assert.doesNotMatch(css, /calendar-access-dialog/);
});