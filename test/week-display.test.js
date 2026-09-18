"use strict";
// Real controllers and synthetic session only. No listener, disk cache or live I/O.
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs");
const A = require("../owner/availability-core"), C = require("../owner/child-calendar-core");
const D = require("../shared/date-selection");
const { harness: mount, settle, deferred, descendants, text } = require("./fixtures/our-week-harness");
// Exercise display behavior independently of shared saved-view coordination.
const harness = (t, options = {}) => mount(t, { ...options, sharedActions: false });
const live = { "owner-mode": "live", "owner-cache": "disk", "child-mode": C.contract };
const columns = h => h.get("availability-grid").children[0]?.children.slice(1) || [];
const columnDates = h => columns(h).map(n => n.attributes["aria-label"].slice(0, 10));
const json = data => new Response(JSON.stringify(data));

test("three-day opening is supported but inert; every explicit parent action still loads exactly October 9–15", async t => {
  for (const meta of [live, {}]) for (const action of ["availability-load", "availability-saved"]) {
    const h = harness(t, { meta });
    assert.equal(h.get("availability-empty").dataset.state, "idle");
    assert.equal(h.get(action).disabled, false);
    assert.equal(h.get("availability-supported-dates").hidden, true);
    assert.match(h.get("availability-load-scope").textContent, /9–15 October 2026.*336/);
    assert.equal(h.calls.length, 0); assert.equal(h.storage.values.size, 1); // Explicit dates-only fixture selection.
    await h.fire("availability-refresh"); assert.equal(h.calls.length, 0);
    await h.fire(action); await h.fire("availability-refresh");
    assert.equal(h.calls.length, 2);
    for (const c of h.calls) {
      assert.equal(c.path, "/api/availability"); assert.equal(c.body.startDate, "2026-10-09");
      assert.equal(c.body.endDate, "2026-10-15"); assert.equal(c.body.acknowledged, true);
    }
    assert.equal(h.calls[0].body.cacheOnly, action === "availability-saved" ? true : undefined);
    assert.equal(h.calls[1].body.refresh, true);
    assert.deepEqual(columnDates(h), ["2026-10-09", "2026-10-10", "2026-10-11"]);
    assert.ok(columns(h).every(n => n.children[1].children.length === 3));
    assert.equal(h.get("child-source-select"), null); assert.equal(h.get("child-guardian"), null);
    assert.equal(h.packets.some(p => p.lifecycle === "loaded"), false);
  }
});

test("display navigation clips all seven original parent days without requests, storage changes, aborts or fencing", async t => {
  let data;
  const h = harness(t, { override: path => path === "/api/availability" ? json(data) : null });
  h.details.open = true; // Secondary paging no longer clutters the main view.
  data = h.parentData(); data.cached = true;
  data.people.forEach(p => { p.status = "partial"; p.slots = Array.from({ length: 336 }, (_, i) => Object.keys(A.labels)[(i + p.person * 2) % 5]); });
  const original = JSON.stringify(data);
  await h.fire("availability-saved");
  const freshness = h.get("availability-freshness").textContent, status = h.get("availability-status").textContent;
  const metadata = JSON.stringify(h.metadata), packets = JSON.stringify(h.packets), stored = h.storage.getItem(D.key);
  const storageCalls = [];
  for (const method of ["getItem", "setItem", "removeItem"]) {
    const original = h.storage[method].bind(h.storage);
    h.storage[method] = (...args) => { storageCalls.push(method); return original(...args); };
  }
  const checked = new Set();
  for (let page = 0; page < 3; page++) {
    assert.deepEqual(columnDates(h), [
      ["2026-10-09", "2026-10-10", "2026-10-11"],
      ["2026-10-12", "2026-10-13", "2026-10-14"], ["2026-10-15"]
    ][page]);
    assert.ok(columns(h).every(n => n.children[1].children.length === 3));
    for (const day of columns(h)) {
      const date = day.attributes["aria-label"].slice(0, 10), offset = Number(date.slice(-2)) - 9;
      checked.add(date);
      day.children[1].children.slice(0, 2).forEach((track, person) => {
        const slots = [];
        for (const run of track.children) {
          const [start, end] = run.style.gridRow.split(" / ").map(Number);
          for (let i = start; i < end; i++) slots[i - 1] = run.dataset.status;
        }
        assert.deepEqual(slots, data.people[person].slots.slice(offset * 48, (offset + 1) * 48));
      });
    }
    if (!h.get("availability-display-next").disabled) {
      h.get("availability-display-next").focus(); await h.fire("availability-display-next");
    }
  }
  assert.equal(checked.size, 7); assert.equal(h.get("availability-display-next").disabled, true);
  assert.deepEqual(columnDates(h), ["2026-10-15"]);
  assert.match(h.get("availability-display-label").textContent, /1 day ·/);
  assert.equal(h.focus, h.get("availability-display-previous"));
  await h.fire("availability-display-previous");
  assert.deepEqual(columnDates(h), ["2026-10-12", "2026-10-13", "2026-10-14"]);
  h.get("availability-display-previous").focus(); await h.fire("availability-display-previous");
  assert.deepEqual(columnDates(h), ["2026-10-09", "2026-10-10", "2026-10-11"]);
  assert.equal(h.get("availability-display-previous").disabled, true);
  assert.equal(h.focus, h.get("availability-display-next"));
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0].options.signal.aborted, false);
  assert.equal(JSON.stringify(h.metadata), metadata); assert.equal(JSON.stringify(h.packets), packets);
  assert.equal(h.get("availability-status").textContent, status); assert.equal(h.get("availability-freshness").textContent, freshness);
  assert.deepEqual(storageCalls, []);
  assert.equal(h.storage.getItem(D.key), stored); assert.equal(JSON.stringify(data), original);
});

test("presentation pages partition the resolved scope, preserving every remembered starting subset without clamping outside dates", () => {
  for (let start = 9; start <= 15; start++) for (let end = start; end <= 15; end++) {
    const selection = A.dateRange(`2026-10-${String(start).padStart(2, "0")}`, `2026-10-${String(end).padStart(2, "0")}`);
    const before = JSON.stringify(selection), pages = A.displayPages(selection);
    assert.deepEqual(A.calendarWindow(selection), A.liveWindow);
    assert.equal(pages[0].start, A.liveWindow.start); assert.equal(pages.at(-1).end, A.liveWindow.end);
    assert.ok(pages.every((p, i) => A.validateWindow(p) && p.slots <= 144 && (!i || pages[i - 1].end === p.start)));
    assert.deepEqual(pages.find(p => p.start === selection.start), A.displayWindow(selection));
    assert.equal(pages.reduce((n, p) => n + p.slots, 0), 336);
    assert.equal(JSON.stringify(selection), before);
  }
  for (const pair of [["2026-10-08", "2026-10-10"], ["2026-10-14", "2026-10-16"], ["2026-12-30", "2027-01-05"]]) {
    const selection = A.dateRange(...pair), pages = A.displayPages(selection);
    assert.deepEqual(A.calendarWindow(selection), selection);
    assert.equal(pages[0].start, selection.start); assert.equal(pages.at(-1).end, selection.end);
  }
  for (const invalid of [null, {}, { ...A.liveWindow, slots: 144 }]) assert.deepEqual(A.displayPages(invalid), []);
});

test("display/date subset edits retain saved child data without operations or title-bearing events", async t => {
  const h = harness(t); await h.fire("availability-load");
  assert.equal(h.calls.length, 1);
  await h.openSaved(); const summary = h.get("child-imported-access").textContent;
  assert.match(summary, /Saved access.*Kimi/);
  const before = h.calls.length, metadata = JSON.stringify(h.metadata);
  await h.fire("availability-display-next"); await h.range("2026-10-10", "2026-10-11");
  assert.equal(h.get("child-imported-access").textContent, summary); assert.equal(h.calls.length, before);
  assert.equal(JSON.stringify(h.metadata), metadata);
  assert.equal(h.calls.filter(c => c.path === "/api/child/saved").length, 1);
  const loaded = h.packets.findLast(p => p.lifecycle === "loaded"); assert.ok(loaded);
  const count = h.calls.length, childStatus = h.get("child-week-status").textContent;
  await h.fire("availability-display-next"); await h.fire("availability-display-previous");
  assert.equal(h.calls.length, count); assert.equal(h.get("child-week-status").textContent, childStatus);
  assert.doesNotMatch(JSON.stringify(h.packets), /title|sourceName|handle|token|summary/);
  assert.doesNotMatch(text(h.get("availability-grid")), /Private|Untitled/);
  assert.ok(h.calls.filter(c => c.path === "/api/child/saved")
    .every(c => c.body.startDate === "2026-10-09" && c.body.endDate === "2026-10-15"));
});

test("navigation during parent and child requests preserves pending results and their original scope", async t => {
  const parent = deferred(), child = deferred();
  const h = harness(t, { override: path => path === "/api/availability" ? parent.promise : path === "/api/child/saved" ? child.promise : null });
  const reading = h.childActions().saved(); await settle();
  const loading = h.fire("availability-load"), count = h.calls.length;
  const metadataCount = h.metadata.length;
  const signals = h.calls.map(c => c.options.signal.aborted);
  await h.fire("availability-display-next");
  await h.range("2026-10-10", "2026-10-11");
  await h.fire("availability-display-next");
  assert.equal(h.calls.length, count); assert.equal(h.metadata.length, metadataCount);
  assert.deepEqual(h.calls.map(c => c.options.signal.aborted), signals);
  parent.resolve(json(h.parentData())); await loading;
  child.resolve(json({ status: "saved", access: { person: "Kimi", guardian: true, disclosure: "details", sourceName: "Synthetic source" }, data: { contract: C.contract, window: C.window, checkedAt: "2026-09-17T00:59:00Z", partial: true,
    events: [{ start: "2026-10-12T09:07:30+08:00", end: "2026-10-12T10:00:00+08:00", allDay: false,
      title: "SYNTHETIC TITLE SENTINEL", redacted: false, kind: "occurrence", status: "scheduled" }] } }));
  await reading; await settle();
  assert.deepEqual(columnDates(h), ["2026-10-12", "2026-10-13", "2026-10-14"]);
  assert.ok(h.parentBlocks().length); assert.equal(h.childBlocks().length, 1);
  assert.match(h.get("child-week-status").textContent, /Partial context/);
  assert.match(h.all(), /SYNTHETIC TITLE SENTINEL/);
  assert.doesNotMatch(JSON.stringify(h.packets), /SYNTHETIC TITLE SENTINEL/);
  assert.ok(h.calls.filter(c => ["/api/availability", "/api/child/saved"].includes(c.path)).every(c => !c.options.signal.aborted));
});

test("remembered selections stay exact for Activities, independently of three-day paging and the seven-day calendar load", async t => {
  for (const dates of [["2026-10-09", "2026-10-15"], ["2026-10-10", "2026-10-11"], ["2026-10-15", "2026-10-15"]]) {
    const h = harness(t, { initialDates: dates, meta: live });
    const remembered = h.storage.getItem(D.key);
    assert.equal(h.get("availability-start").value, dates[0]); assert.equal(h.get("availability-end").value, dates[1]);
    assert.match(h.get("availability-date-sharing").textContent, new RegExp(`${dates[0]} through ${dates[1]}`));
    await h.fire("availability-display-next"); await h.fire("availability-display-previous");
    let prevented = false;
    await h.document.dispatchEvent({ type: "click", target: { closest: () => ({}) }, preventDefault() { prevented = true; } });
    assert.equal(prevented, false); assert.equal(h.storage.getItem(D.key), remembered);
    assert.equal(h.calls.length, 0);
    await h.fire("availability-load"); assert.equal(h.calls[0].body.endDate, "2026-10-15");
    assert.ok(columns(h).length <= 3);
    const initial = columnDates(h), count = h.calls.length;
    const expected = A.displayPages(A.dateRange(...dates)).map(p => A.days(p).map(d => d.date));
    while (!h.get("availability-display-previous").disabled) await h.fire("availability-display-previous");
    const forward = [columnDates(h)];
    while (!h.get("availability-display-next").disabled) { await h.fire("availability-display-next"); forward.push(columnDates(h)); }
    assert.deepEqual(forward, expected);
    const backward = [columnDates(h)];
    while (!h.get("availability-display-previous").disabled) { await h.fire("availability-display-previous"); backward.push(columnDates(h)); }
    assert.deepEqual(backward, [...expected].reverse());
    assert.ok(expected.some(p => JSON.stringify(p) === JSON.stringify(initial)));
    assert.equal(h.calls.length, count); assert.equal(h.storage.getItem(D.key), remembered);
  }
});

test("later pages clip child midnight and all-day intervals at their actual dates and retain freshness when returning", async t => {
  const event = (start, end, allDay = false) => ({ start, end, allDay, status: "scheduled", kind: "occurrence", title: "SYNTHETIC OMITTED", redacted: false });
  const h = harness(t, { childData: { contract: C.contract, window: C.window, checkedAt: "2026-09-17T00:59:00Z", partial: false, events: [
    event("2026-10-11T23:55:00+08:00", "2026-10-12T00:07:30+08:00"),
    event("2026-10-12T09:07:30+08:00", "2026-10-12T10:12:00+08:00"),
    event("2026-10-12T00:00:00+08:00", "2026-10-15T00:00:00+08:00", true),
    event("2026-10-14T23:55:00+08:00", "2026-10-15T00:00:00+08:00"),
    event("2026-10-15T00:00:00+08:00", "2026-10-16T00:00:00+08:00", true),
    event("2026-10-15T23:57:00+08:00", "2026-10-16T03:00:00+08:00")
  ] } });
  await h.fire("availability-load"); await h.openSaved();
  const childStatus = h.get("child-week-status").textContent, count = h.calls.length;
  const first = h.childBlocks().map(n => n.title);
  await h.fire("availability-display-next");
  const middle = h.childBlocks().map(n => n.title);
  const timed = h.childBlocks().filter(n => n.className === "child-event");
  assert.deepEqual(timed.map(n => n.title.match(/\d{2}:\d{2}(?::\d{2})?–\d{2}:\d{2}(?::\d{2})?/)[0]), ["00:00–00:07:30", "09:07:30–10:12", "23:55–24:00"]);
  assert.equal(timed[1].style.top, `${547.5 / 1440 * 100}%`);
  assert.equal(h.childBlocks().filter(n => n.className === "child-all-day").length, 3);
  await h.fire("availability-display-next");
  assert.deepEqual(columnDates(h), ["2026-10-15"]);
  assert.equal(h.childBlocks().length, 2);
  assert.match(h.childBlocks()[0].title, /All-day/);
  assert.match(h.childBlocks()[1].title, /23:57–24:00/);
  assert.equal(h.get("availability-grid").children[0].style.gridTemplateColumns, "56px repeat(1,minmax(264px,1fr))");
  await h.fire("availability-display-previous"); assert.deepEqual(h.childBlocks().map(n => n.title), middle);
  await h.fire("availability-display-previous"); assert.deepEqual(h.childBlocks().map(n => n.title), first);
  assert.equal(h.calls.length, count); assert.equal(h.get("child-week-status").textContent, childStatus);
  assert.match(h.all(), /SYNTHETIC OMITTED/);
  assert.doesNotMatch(JSON.stringify(h.packets), /SYNTHETIC OMITTED/);
});

test("full-response validation precedes slicing: shortened parent rows and invalid off-page child events never become valid visible context", async t => {
  let data;
  const h = harness(t, { override: path => path === "/api/availability" ? json(data) : null });
  data = h.parentData(); data.people[0].slots = Array(144).fill("busy");
  data.people[1].slots[335] = "untrusted-status";
  await h.fire("availability-load");
  assert.ok(columns(h).every(day => day.children[1].children[0].children.every(n => n.dataset.status === "unknown")));
  assert.equal(h.get("availability-context").children.length, 2);
  await h.openSaved();
  const packet = structuredClone(h.packets.findLast(p => p.lifecycle === "loaded"));
  packet.generation++;
  packet.events.push({ start: "2026-10-15T09:00:00+08:00", end: "2026-10-15T10:00:00+08:00", allDay: false, status: "untrusted-status" });
  await h.emit("child-week-changed", { detail: packet });
  assert.equal(h.childBlocks().length, 0); assert.match(h.get("child-week-status").textContent, /Unavailable/);
  await h.fire("availability-display-next"); await h.fire("availability-display-next");
  assert.equal(columns(h)[0].children[1].children[1].children.at(-1).dataset.status, "unknown");
});

test("invalid dates fence in-flight work; same-scope edits cannot bypass a sticky cleanup failure", async t => {
  const late = deferred(), cleanup = deferred();
  const h = harness(t, { override: path => path === "/api/availability" ? late.promise : path === "/api/clear" ? cleanup.promise : null });
  await h.openSaved(); const old = structuredClone(h.packets.findLast(p => p.lifecycle === "loaded"));
  const loading = h.fire("availability-load");
  const changing = h.range("", "2026-10-11");
  assert.equal(columns(h).length, 0); assert.equal(h.get("child-find"), null);
  await h.range("2026-10-09", "2026-10-11");
  await h.range("2026-10-10", "2026-10-12");
  assert.equal(h.get("availability-load").disabled, true);
  cleanup.resolve(json({ status: "cleanup_failed", cleanup: "cleanup_failed" }));
  await changing; await settle();
  late.resolve(json(h.parentData())); await loading;
  await h.emit("child-week-changed", { detail: old });
  const count = h.calls.length;
  await h.range("2026-10-09", "2026-10-11");
  for (const id of ["availability-load", "availability-saved", "availability-refresh", "availability-display-next"]) await h.fire(id);
  await h.childActions().saved();
  await settle();
  assert.equal(h.calls.length, count); assert.equal(columns(h).length, 0);
  assert.equal(h.get("availability-empty").dataset.state, "blocked");
  assert.deepEqual(h.calls.find(c => c.path === "/api/clear").body, { reason: "range" });
});

test("outside-window edits still fence both sources; neither unsupported actions nor navigation can reuse old results", async t => {
  const h = harness(t, { meta: live }); await h.fire("availability-load"); await h.openSaved();
  const old = structuredClone(h.packets.findLast(p => p.lifecycle === "loaded"));
  await h.range("2026-10-08", "2026-10-10"); await settle();
  assert.equal(h.get("availability-empty").dataset.state, "unsupported");
  assert.equal(columns(h).length, 0); assert.equal(h.get("child-find"), null);
  assert.equal(h.get("availability-display-next").disabled, true);
  assert.deepEqual(h.calls.find(c => c.path === "/api/clear").body, { reason: "range" });
  const count = h.calls.length;
  for (const id of ["availability-load", "availability-saved", "availability-refresh", "availability-display-next"]) await h.fire(id);
  await h.childActions().saved();
  await settle(); assert.equal(h.calls.length, count);
  await h.range("2026-10-09", "2026-10-11"); await h.emit("child-week-changed", { detail: old });
  assert.equal(columns(h).length, 0); assert.equal(h.get("child-review-panel"), null);
  assert.equal(h.get("availability-load").disabled, false);
});

test("saved miss or a shortened/mislabeled response cannot turn three display days into a saved success", async t => {
  for (const outcome of ["miss", "short", "old"]) {
    let response;
    const h = harness(t, { meta: live, override: path => path === "/api/availability" ? json(response) : null });
    response = outcome === "miss" ? { status: "cache_missing", cleanup: "not_requested" } :
      { ...h.parentData(), cached: true, window: outcome === "short" ? A.dateRange("2026-10-09", "2026-10-11") : A.window };
    await h.fire("availability-saved"); await h.fire("availability-display-next");
    assert.equal(h.calls.length, 1); assert.equal(columns(h).length, 0);
    assert.match(h.get("availability-status").textContent, outcome === "miss" ? /No saved view exists/ : /Couldn’t load/);
    assert.equal(h.calls[0].body.cacheOnly, true); assert.equal(h.calls[0].body.endDate, "2026-10-15");
  }
});

test("scope stays in Details and labelled controls retain descriptions without a child consent wizard", () => {
  const html = fs.readFileSync(require.resolve("../owner/index.html"), "utf8");
  const details = html.match(/<details class="availability-details">([\s\S]*?)<\/details>/)[1];
  assert.match(details, /id="availability-load-scope"[^>]*>[^<]*9–15 October 2026[^<]*336/);
  for (const id of ["availability-load", "availability-refresh", "availability-saved"]) {
    assert.match(html.match(new RegExp(`<button id="${id}"[^>]*>`))[0], /aria-describedby="[^"]*availability-load-scope/);
  }
  for (const name of ["previous", "next"]) assert.match(html, new RegExp(`id="availability-display-${name}"[^>]*type="button"[^>]*aria-describedby="availability-display-help"`));
  assert.match(html, /Previous\/Next[^<]*do not load calendars, change consent or change the selected dates for Activities/);
  assert.doesNotMatch(html, /<dialog|id="child-(?:source-select|person|disclosure|guardian|review|import)"/);
  assert.match(html, /Kimi is saved-view only; Update refreshes parents only/);
});