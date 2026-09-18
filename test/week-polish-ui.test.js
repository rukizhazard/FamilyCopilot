"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs");
const { harness, descendants, text, deferred, settle } = require("./fixtures/our-week-harness");
const C = require("../owner/child-calendar-core");

test("loaded child gaps are white and text-free without presenting unloaded or failed context as empty", async t => {
  const h = harness(t, { meta: { "child-sync": "child-sync-v1" } });
  await h.fire("availability-load");
  const tracks = () => descendants(h.get("availability-grid")).filter(n => n.className === "child-track");
  assert.ok(tracks().length);
  assert.ok(tracks().every(n => n.dataset.loaded === "false" && /Not loaded · Unknown/.test(text(n))));
  await h.seedSaved(); await h.fire("availability-load");
  const count = h.calls.length;
  assert.ok(tracks().every(n => n.dataset.loaded === "true" && !n.children.some(c => c.className === "child-gap")));
  assert.ok(tracks().every(n => /Missing time unknown/.test(n.attributes["aria-label"])));
  assert.ok(h.childBlocks().length);
  await h.document.dispatchEvent({ type: "visibilitychange" });
  assert.equal(h.calls.length, count);
  await h.emit("child-week-changed", { detail: {} });
  assert.ok(tracks().every(n => n.dataset.loaded === "false" && /Not loaded · Unknown/.test(text(n))));
  const css = fs.readFileSync(require.resolve("../owner/owner.css"), "utf8");
  assert.match(css, /\.child-track\[data-loaded="true"\] \{ background:#fff;/);
});

test("one calendar Sync action replaces decorative icon; timezone and day paging stay out of heading", async t => {
  const h = harness(t);
  const html = fs.readFileSync(require.resolve("../owner/index.html"), "utf8");
  assert.doesNotMatch(html, /class="shell-zone"|week-empty-icon/);
  assert.equal(h.get("availability-surface").dataset.loaded, "false");
  assert.equal(h.get("availability-load").parentNode.parentNode, h.get("availability-surface"));
  assert.equal(h.visible("availability-display-next"), false);
  assert.equal(h.visible("availability-display-previous"), false);
  assert.match(h.get("week-help").textContent, /6:00 AM.*scroll up/);
  for (const i of [0, 1, 2]) {
    assert.doesNotMatch(h.get("calendar-person-" + i).textContent, /Loaded|Not loaded/);
    assert.match(h.get("calendar-person-" + i).attributes["aria-label"], /Not loaded/);
  }
  assert.deepEqual(h.calls, []); assert.equal(h.storage.values.size, 0);
  await h.fire("availability-load");
  assert.equal(h.get("availability-surface").dataset.loaded, "true");
  assert.equal(h.visible("availability-empty"), false);
  assert.equal(h.visible("availability-load"), true);
});

test("shared Sync has loading feedback, blocks double submit and retains failure action gating", async t => {
  const wait = deferred();
  const h = harness(t, { override: path => path === "/api/availability" ? wait.promise : null });
  const pending = h.fire("availability-load"); await settle();
  assert.equal(h.get("availability-sync-label").textContent, "Syncing…");
  assert.equal(h.get("availability-load").attributes["aria-busy"], "true");
  assert.equal(h.get("availability-load").disabled, true);
  const count = h.calls.length; await h.fire("availability-load"); assert.equal(h.calls.length, count);
  wait.resolve(new Response(JSON.stringify({ status: "cleanup_failed", cleanup: "cleanup_failed" })));
  await pending;
  assert.equal(h.get("availability-load").disabled, true);
  assert.equal(h.get("availability-load").attributes["aria-busy"], "false");
  assert.equal(h.visible("availability-status"), true);
  assert.equal(h.get("availability-grid").children.length, 0);
});

test("six AM opening preserves all hours, early child events, all-day bands, exact scopes and manual scroll", async t => {
  const childData = { contract: C.contract, window: C.window, checkedAt: "2026-09-17T00:59:00Z", partial: false, events: [
    { title: "Synthetic early event", start: "2026-10-09T01:00:00+08:00", end: "2026-10-09T02:00:00+08:00", allDay: false, status: "scheduled", kind: "singleInstance", redacted: false },
    { title: "Synthetic all day", start: "2026-10-09T00:00:00+08:00", end: "2026-10-10T00:00:00+08:00", allDay: true, status: "scheduled", kind: "singleInstance", redacted: false }
  ] };
  const h = harness(t, { childData }); await h.seedSaved(); await h.fire("availability-load");
  const grid = h.get("availability-grid"), before = h.savedSnapshot(), count = h.calls.length;
  assert.equal(grid.scrollTop, 288);
  assert.equal(grid.style.scrollPaddingTop, "148px");
  const early = h.childBlocks().find(n => /Synthetic early/.test(n.textContent));
  assert.match(early.title, /01:00–02:00/);
  assert.equal(early.style.top, `${60 / 1440 * 100}%`);
  assert.ok(h.childBlocks().some(n => n.className === "child-all-day"));
  const axis = descendants(grid).filter(n => n.className === "hour-label").map(text);
  assert.ok(axis.includes("00:00")); assert.ok(axis.includes("06:00")); assert.ok(axis.includes("24:00"));
  grid.scrollTop = 0; grid.scrollLeft = 175;
  await h.document.dispatchEvent({ type: "visibilitychange" });
  assert.equal(grid.scrollTop, 0); assert.equal(grid.scrollLeft, 175);
  grid.scrollTop = 480; await h.advance(300001);
  assert.equal(grid.scrollTop, 480); assert.deepEqual(h.savedSnapshot(), before); assert.equal(h.calls.length, count);
  let prevented = 0;
  grid.scrollHeight = 1300;
  for (const [key, top] of [["Home", 0], ["End", 1300]]) {
    await grid.dispatchEvent({ type: "keydown", target: grid, key, preventDefault() { prevented++; } });
    assert.equal(grid.scrollTop, top);
  }
  await grid.dispatchEvent({ type: "keydown", target: early, key: "Home", preventDefault() { prevented++; } });
  assert.equal(prevented, 2); // Focused child events keep their own keyboard behavior.
  const parent = h.calls.find(c => c.path === "/api/availability");
  assert.equal(parent.body.startDate, "2026-10-09"); assert.equal(parent.body.endDate, "2026-10-15");
  await h.range("2026-10-15", "2026-10-15");
  assert.equal(grid.children[0].children.length, 2); // Axis + one full day, not a shortened query.
  await h.range("2026-10-08", "2026-10-14");
  assert.equal(grid.children.length, 0);
  assert.equal(h.get("availability-surface").dataset.loaded, "false");
});