"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { harness, descendants, settle, deferred } = require("./fixtures/our-week-harness");
const D = require("../shared/date-selection");
const day = (h, date) => descendants(h.get("availability-date-grid")).find(n => n.dataset.date === date);
const choose = (h, date) => day(h, date).dispatchEvent({ type: "click" });
const key = (h, date, key, shiftKey = false) => day(h, date).dispatchEvent({ type: "keydown", key, shiftKey, preventDefault() {} });

test("two displayed dates share a calendar with continuous cross-week band and round endpoints", async t => {
  const h = harness(t);
  assert.equal(h.get("availability-start-label").textContent, "9 Oct 2026");
  assert.equal(h.get("availability-start-weekday").textContent, "Friday");
  assert.equal(h.get("availability-end-label").textContent, "11 Oct 2026");
  assert.equal(h.get("availability-end-weekday").textContent, "Sunday");
  await h.fire("availability-date-toggle");
  await choose(h, "2026-10-09");
  assert.equal(day(h, "2026-10-09").parentNode.dataset.rangePosition, "single");
  await choose(h, "2026-10-14");
  for (let d = 8; d <= 15; d++) {
    const cell = day(h, `2026-10-${String(d).padStart(2, "0")}`).parentNode;
    const expected = d === 9 ? "start" : d === 14 ? "end" : d > 9 && d < 14 ? "middle" : "none";
    assert.equal(cell.dataset.rangePosition, expected);
    assert.equal(cell.attributes["aria-selected"], String(expected !== "none"));
  }
  assert.notEqual(day(h, "2026-10-10").parentNode.parentNode, day(h, "2026-10-11").parentNode.parentNode);
  await choose(h, "2026-10-14"); await choose(h, "2026-10-09");
  assert.equal(day(h, "2026-10-09").parentNode.dataset.rangePosition, "start");
  assert.equal(day(h, "2026-10-14").parentNode.dataset.rangePosition, "end");
  await h.fire("availability-date-apply");
  assert.equal(h.get("availability-end-label").textContent, "14 Oct 2026");
  assert.equal(h.get("availability-end-weekday").textContent, "Wednesday");
  assert.deepEqual(h.calls, []);
});

test("pointer and keyboard preview a bounded band without committing dates or aria-selection", async t => {
  const h = harness(t);
  const stored = [...h.storage.values];
  await h.fire("availability-date-toggle"); await choose(h, "2026-10-09");
  await day(h, "2026-10-14").dispatchEvent({ type: "pointerenter" });
  const cells = () => descendants(h.get("availability-date-grid")).filter(n => n.dataset.inRange === "true");
  assert.equal(cells().length, 6);
  assert.equal(day(h, "2026-10-14").parentNode.dataset.rangePosition, "end");
  assert.equal(day(h, "2026-10-14").parentNode.dataset.preview, "true");
  assert.equal(day(h, "2026-10-14").parentNode.attributes["aria-selected"], "false");
  assert.equal(h.get("availability-date-apply").disabled, true);
  assert.equal(h.get("availability-end").value, "2026-10-11");
  await day(h, "2026-10-16").dispatchEvent({ type: "pointerenter" });
  assert.equal(cells().length, 1); assert.match(h.get("availability-date-hint").textContent, /1–7 days/);
  await key(h, "2026-10-09", "ArrowRight");
  assert.equal(cells().length, 2); assert.match(h.get("availability-date-hint").textContent, /Select to finish/);
  await h.get("availability-date-grid").dispatchEvent({ type: "pointerleave" });
  assert.equal(cells().length, 1);
  await choose(h, "2026-10-09");
  assert.equal(day(h, "2026-10-09").parentNode.dataset.rangePosition, "single");
  assert.equal(h.get("availability-date-apply").disabled, false);
  assert.deepEqual(h.calls, []); assert.deepEqual([...h.storage.values], stored);
});

test("range band is not masked by white buttons and clips only at endpoint centres", () => {
  const css = require("node:fs").readFileSync(require.resolve("../owner/owner.css"), "utf8");
  assert.match(css, /\.date-picker \.date-day \{[^}]*aspect-ratio:1;[^}]*border-radius:50%; background:transparent;/);
  assert.match(css, /\.date-cell\[data-in-range="true"\]::before \{[^}]*left:0; right:0;[^}]*background:#eee6f7;/);
  assert.match(css, /\[data-range-position="start"\]::before \{ left:50%; \}/);
  assert.match(css, /\[data-range-position="end"\]::before \{ right:50%; \}/);
  assert.match(css, /\[data-range-position="single"\]::before \{ content:none; \}/);
  assert.match(css, /\[data-in-range="true"\] \.date-day \{ background:transparent;/);
});

test("one range control opens remembered dates; draft and cancel never query or change storage", async t => {
  const h = harness(t, { initialDates: ["2026-10-10", "2026-10-12"] });
  assert.match(h.get("availability-date-label").textContent, /10.*12.*Oct.*2026/);
  assert.equal(h.visible("availability-start"), false);
  assert.equal(h.visible("availability-end"), false);
  const before = [...h.storage.values];
  await h.fire("availability-date-toggle");
  assert.equal(h.visible("availability-date-picker"), true);
  assert.equal(h.focus, day(h, "2026-10-10"));
  await choose(h, "2026-10-13");
  assert.equal(h.get("availability-date-apply").disabled, true);
  assert.equal(h.get("availability-start").value, "2026-10-10");
  assert.deepEqual([...h.storage.values], before);
  await h.fire("availability-date-cancel");
  assert.equal(h.visible("availability-date-picker"), false);
  assert.equal(h.focus, h.get("availability-date-toggle"));
  assert.deepEqual(h.calls, []);
});

test("fresh owner opens with no selected dates, no warning, no writes and Sync disabled", async t => {
  const h = harness(t, { initialDates: null });
  for (const part of ["start", "end"]) {
    assert.equal(h.get(`availability-${part}`).value, "");
    assert.equal(h.get(`availability-${part}-label`).textContent, "Choose date");
    assert.equal(h.get(`availability-${part}-weekday`).textContent, "");
  }
  assert.equal(h.visible("availability-date-error"), false);
  assert.equal(h.get("availability-load").disabled, true);
  await h.fire("availability-load"); await h.fire("availability-date-toggle");
  assert.equal(h.get("availability-date-apply").disabled, true);
  assert.equal(descendants(h.get("availability-date-grid")).filter(n => n.attributes["aria-selected"] === "true").length, 0);
  assert.deepEqual(h.calls, []); assert.equal(h.storage.values.size, 0);
});

test("Reset dates empties selected dates and fences display without deleting saved child data", async t => {
  const h = harness(t); await h.seedSaved(); await h.fire("availability-load");
  const saved = h.savedSnapshot(); const queries = h.calls.filter(c => c.path === "/api/availability").length;
  await h.fire("availability-reset-dates");
  assert.equal(h.get("availability-start").value, ""); assert.equal(h.get("availability-end").value, "");
  assert.equal(h.get("availability-load").disabled, true);
  assert.equal(h.visible("availability-grid"), false);
  assert.deepEqual(h.savedSnapshot(), saved);
  assert.equal(h.calls.filter(c => c.path === "/api/availability").length, queries);
  assert.ok(h.calls.some(c => c.path === "/api/clear" && c.body.reason === "range"));
  assert.ok(h.calls.filter(c => c.path === "/api/clear").every(c => c.body.reason === "range"));
  assert.deepEqual(JSON.parse(h.storage.values.get(D.key)), { version: 1, state: "invalid" });
});

test("Apply commits both dates atomically, keeps exact provider scope and dates-only Activities schema", async t => {
  const h = harness(t, { meta: { "child-sync": "child-sync-v1" } });
  await h.seedSaved(); await h.fire("availability-load");
  const count = h.calls.length, snapshot = h.savedSnapshot();
  await h.fire("availability-date-toggle");
  await choose(h, "2026-10-15"); await choose(h, "2026-10-09");
  assert.equal(h.get("availability-start").value, "2026-10-09");
  assert.equal(h.get("availability-end").value, "2026-10-11");
  const selected = descendants(h.get("availability-date-grid")).filter(n => n.attributes["aria-selected"] === "true");
  assert.equal(selected.length, 7);
  await h.fire("availability-date-apply");
  assert.equal(h.get("availability-end").value, "2026-10-15");
  assert.equal(h.calls.length, count); assert.deepEqual(h.savedSnapshot(), snapshot);
  const record = JSON.parse(h.storage.values.get(D.key));
  assert.deepEqual(record, { version: 1, state: "selected", startDate: "2026-10-09", endDate: "2026-10-15" });
  assert.equal(h.visible("availability-grid"), true);
  assert.equal(h.focus, h.get("availability-date-toggle"));
  const parent = h.calls.find(c => c.path === "/api/availability");
  assert.equal(parent.body.startDate, "2026-10-09"); assert.equal(parent.body.endDate, "2026-10-15");
});

test("range limit is explicit; same-day, leap-day and cross-year selections retain inclusive days", async t => {
  for (const [start, end] of [["2026-10-09", "2026-10-09"], ["2028-02-28", "2028-03-01"], ["2026-12-30", "2027-01-02"]]) {
    const h = harness(t, { initialDates: [start, start] });
    await h.fire("availability-date-toggle");
    await choose(h, start); await choose(h, end);
    await h.fire("availability-date-apply");
    assert.equal(h.get("availability-start").value, start);
    assert.equal(h.get("availability-end").value, end);
    assert.deepEqual(h.calls, []);
  }
  const h = harness(t);
  await h.fire("availability-date-toggle"); await choose(h, "2026-10-09"); await choose(h, "2026-10-16");
  assert.equal(h.get("availability-date-apply").disabled, true);
  assert.match(h.get("availability-date-hint").textContent, /1–7 days/);
  await choose(h, "2026-10-15"); await h.fire("availability-date-apply");
  assert.equal(h.get("availability-end").value, "2026-10-15");
});

test("keyboard navigation crosses months, clamps month/year boundaries and Escape discards draft", async t => {
  const h = harness(t, { initialDates: ["2028-01-31", "2028-01-31"] });
  await h.fire("availability-date-toggle");
  await key(h, "2028-01-31", "PageDown"); assert.equal(h.focus.dataset.date, "2028-02-29");
  await key(h, "2028-02-29", "PageDown", true); assert.equal(h.focus.dataset.date, "2029-02-28");
  await key(h, "2029-02-28", "ArrowRight"); assert.equal(h.focus.dataset.date, "2029-03-01");
  await key(h, "2029-03-01", "Home"); assert.equal(h.focus.dataset.date, "2029-02-25");
  await key(h, "2029-02-25", "End"); assert.equal(h.focus.dataset.date, "2029-03-03");
  await key(h, "2029-03-03", "ArrowUp"); assert.equal(h.focus.dataset.date, "2029-02-24");
  await h.get("availability-date-picker").dispatchEvent({ type: "keydown", key: "Escape", preventDefault() {} });
  assert.equal(h.visible("availability-date-picker"), false);
  assert.equal(h.focus, h.get("availability-date-toggle"));
  assert.equal(h.get("availability-start").value, "2028-01-31"); assert.deepEqual(h.calls, []);
});

test("Apply outside approved scope fences pending results and keeps child snapshot, without new queries", async t => {
  const wait = deferred();
  const h = harness(t, { override: path => path === "/api/availability" ? wait.promise : null });
  await h.seedSaved(); const snapshot = h.savedSnapshot();
  const loading = h.fire("availability-load"); await settle();
  await h.fire("availability-date-toggle"); await choose(h, "2026-10-08"); await choose(h, "2026-10-08");
  const applying = h.fire("availability-date-apply");
  assert.equal(h.visible("availability-grid"), false);
  await applying;
  wait.resolve(new Response(JSON.stringify(h.parentData()))); await loading;
  assert.equal(h.visible("availability-grid"), false);
  assert.deepEqual(h.savedSnapshot(), snapshot);
  assert.equal(h.calls.filter(c => c.path === "/api/availability").length, 1);
  assert.ok(h.calls.some(c => c.path === "/api/clear" && c.body.reason === "range"));
});

test("invalid remembered dates need explicit selection, supported-date recovery updates range label", async t => {
  const h = harness(t, { initialDates: ["bad", "bad"] });
  assert.equal(h.get("availability-date-label").textContent, "Choose dates");
  assert.equal(h.get("availability-date-toggle").attributes["aria-invalid"], "true");
  await h.fire("availability-date-toggle");
  // Calendar-only dates use UTC arithmetic, not conversion of the provider instant.
  assert.equal(h.focus.dataset.date, "2026-10-09");
  assert.equal(h.get("availability-date-month-label").textContent, "October 2026");
  assert.equal(h.get("availability-date-apply").disabled, true);
  await h.fire("availability-date-cancel"); await h.fire("availability-supported-dates");
  assert.match(h.get("availability-date-label").textContent, /9.*15.*Oct.*2026/);
  assert.equal(h.get("availability-date-toggle").attributes["aria-invalid"], "false");
  assert.deepEqual(h.calls, []);
});

test("month/year controls and keyboard stay within 2000–2100 without saving draft navigation", async t => {
  for (const [date, nav, arrow] of [["2000-01-01", "previous", "ArrowLeft"], ["2100-12-31", "next", "ArrowRight"]]) {
    const h = harness(t, { initialDates: [date, date] });
    await h.fire("availability-date-toggle");
    assert.equal(h.get(`availability-date-${nav}`).disabled, true);
    await key(h, date, arrow); assert.equal(h.focus.dataset.date, date);
    assert.equal(descendants(h.get("availability-date-grid")).filter(n => n.tabIndex === 0).length, 1);
    const outside = descendants(h.get("availability-date-grid")).filter(n => n.dataset.date && (n.dataset.date < "2000-01-01" || n.dataset.date > "2100-12-31"));
    assert.ok(outside.length); assert.ok(outside.every(n => n.disabled));
    h.get("availability-date-month").value = "1"; h.get("availability-date-year").value = "2028";
    await h.fire("availability-date-year", "change");
    assert.equal(h.get("availability-date-month-label").textContent, "February 2028");
    assert.ok(day(h, "2028-02-29"));
    await h.fire("availability-date-next");
    assert.equal(h.get("availability-date-month-label").textContent, "March 2028");
    await h.fire("availability-date-previous");
    assert.equal(h.get("availability-date-month-label").textContent, "February 2028");
    await h.document.dispatchEvent({ type: "pointerdown", target: {} });
    assert.equal(h.visible("availability-date-picker"), false);
    assert.equal(h.get("availability-start").value, date); assert.deepEqual(h.calls, []);
  }
});