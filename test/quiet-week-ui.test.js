"use strict";
// Static DOM visibility and real controllers only; no browser, listener or saved files.
const test = require("node:test"), assert = require("node:assert/strict");
const C = require("../owner/child-calendar-core");
const { harness, deferred, settle, text } = require("./fixtures/our-week-harness");
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
const detailIds = ["availability-saved-help", "availability-source", "child-week-status",
  "availability-display-label", "availability-display-help", "availability-date-help",
  "availability-date-sharing", "availability-range-support", "availability-load-scope", "availability-targets"];

test("compact controls show actual per-person loading state without additional requests", async t => {
  const h = harness(t);
  assert.equal(h.visible("availability-saved"), false);
  assert.equal(text(h.get("availability-title")).trim(), "Our week");
  assert.equal(text(h.get("availability-load")).replace("↻", "").trim(), "Sync");
  assert.equal(h.visible("availability-refresh"), false);
  for (const index of [0, 1, 2]) {
    assert.equal(h.get("calendar-person-" + index).disabled, true);
    assert.doesNotMatch(h.get("calendar-person-" + index).textContent, /Not loaded/);
    assert.match(h.get("calendar-person-" + index).attributes["aria-label"], /Not loaded/);
  }
  assert.deepEqual(h.calls, []);
  await h.seedSaved(); await h.fire("availability-load");
  for (const index of [0, 1, 2]) {
    assert.equal(h.get("calendar-person-" + index).disabled, false);
    assert.match(h.get("calendar-person-" + index).textContent, /✓/);
    assert.match(h.get("calendar-person-" + index).attributes["aria-label"], /Loaded/);
    const count = h.calls.length;
    await h.fire("calendar-person-" + index);
    assert.equal(h.focus, h.get("availability-grid"));
    assert.equal(h.calls.length, count);
  }
  await h.advance(300001);
  for (const index of [0, 1, 2]) {
    assert.match(h.get("calendar-person-" + index).attributes["aria-label"], /Loaded/);
    assert.doesNotMatch(h.get("calendar-person-" + index).textContent, /Stale/);
  }
  assert.match(h.get("availability-freshness").textContent, /Stale/);
  assert.match(h.get("child-status-details").textContent, /Stale/);
  await h.fire("availability-clear");
  for (const index of [0, 1, 2]) assert.equal(h.get("calendar-person-" + index).disabled, true);
});

test("person buttons do not label missing child or unavailable parent data as loaded", async t => {
  const h = harness(t, { override: path => {
    if (path !== "/api/availability") return;
    const data = h.parentData();
    data.people[0].status = "partial";
    data.people[0].slots[0] = "unknown";
    data.people[1] = { person: 1, status: "unavailable", slots: [] };
    return json(data);
  } });
  await h.fire("availability-load");
  assert.match(h.get("calendar-person-0").textContent, /Partial/);
  assert.match(h.get("calendar-person-0").attributes["aria-label"], /Loaded · Partial/);
  assert.match(h.get("calendar-person-1").textContent, /Unavailable/);
  assert.equal(h.get("calendar-person-1").disabled, true);
  assert.doesNotMatch(h.get("calendar-person-2").textContent, /Loaded/);
  assert.equal(h.get("calendar-person-2").disabled, true);
});

test("pasted explanations and secondary day paging stay in closed Details with accessible names", async t => {
  const h = harness(t);
  assert.equal(h.details.open, false);
  for (const id of detailIds) assert.equal(h.visible(id), false, id);
  for (const id of ["availability-status", "child-status"]) assert.equal(h.visible(id), false, id);
  for (const [id, label, name] of [["availability-display-previous", "Earlier days", "Previous days"], ["availability-display-next", "Later days", "Next days"]]) {
    const button = h.get(id);
    assert.equal(h.visible(id), false);
    assert.equal(text(button).trim(), label);
    assert.equal(button.attributes["aria-label"], name);
    assert.equal(button.attributes["aria-describedby"], "availability-display-help");
  }
  assert.match(h.get("availability-load").attributes["aria-describedby"], /availability-saved-help/);
  h.details.open = true;
  for (const id of detailIds) assert.equal(h.visible(id), true, id);
  assert.match(h.get("availability-saved-help").textContent, /Confirm loads.*Update refreshes parents only/);
  h.details.open = false;
  await h.fire("availability-display-next"); await h.fire("availability-display-previous");
  assert.deepEqual(h.calls, []); assert.equal(h.storage.values.size, 0);
});

test("fresh, cached and stale success summaries are visible only after opening Details", async t => {
  for (const action of ["availability-load", "availability-saved"]) for (const meta of [{}, { "owner-mode": "live", "child-mode": C.contract }]) {
    const h = harness(t, { meta }); await h.seedSaved();
    await h.fire(action);
    const count = h.calls.length, before = h.savedSnapshot();
    for (const id of ["availability-status", "child-status"]) assert.equal(h.visible(id), false, id);
    assert.doesNotMatch(h.visibleText(), /Updated|Saved only, checked|Display:|Previous\/Next only move|Default calendars only/);
    h.details.open = true;
    for (const id of ["availability-status-details", "child-status-details", ...detailIds]) assert.equal(h.visible(id), true, id);
    assert.match(h.get("availability-status-details").textContent, /Mike.*Debby.*Updated.*Saved view/);
    assert.match(h.get("child-status-details").textContent, /Fictional shared source.*Saved only, checked/);
    assert.equal(h.get("availability-source").textContent, meta["owner-mode"] === "live" ? "Outlook · Default calendars only" : "Sample data · Not real calendars");
    const original = h.get("child-imported-access").textContent;
    assert.match(h.get("availability-window").textContent, /2026-10-09.*2026-10-16.*336/);
    h.details.open = false;
    await h.advance(300001); await h.document.dispatchEvent({ type: "visibilitychange" });
    await h.fire("availability-display-next"); await h.fire("availability-display-previous");
    assert.equal(h.visible("availability-status"), false); assert.equal(h.visible("child-status"), false);
    assert.match(h.get("availability-status-details").textContent, /May be out of date/);
    assert.match(h.get("child-status-details").textContent, /Stale/);
    assert.equal(h.get("child-imported-access").textContent, original);
    assert.deepEqual(h.savedSnapshot(), before); assert.equal(h.calls.length, count);
    assert.ok(h.visible(h.focus));
  }
});

test("parent errors replace hidden success and remain visible through redraw with Details closed", async t => {
  for (const status of ["unavailable", "revoked", "cache_invalid", "cache_clear_failed", "cleanup_failed", "blocked"]) {
    let fail = false;
    const h = harness(t, { sharedActions: false, override: path => fail && path === "/api/availability"
      ? json({ status, cleanup: status === "cleanup_failed" ? "cleanup_failed" : "not_requested",
        ...(status === "blocked" ? { reason: "session_unavailable" } : {}) }) : null });
    await h.fire("availability-load"); fail = true; await h.fire("availability-refresh");
    assert.equal(h.details.open, false); assert.equal(h.visible("availability-status"), true, status);
    assert.equal(h.get("availability-status").dataset.urgent, "true");
    assert.equal(h.focus, h.get("availability-status"));
    assert.equal(h.get("availability-status-details").textContent, "");
    assert.match(h.get("availability-status").textContent, /Couldn’t|Can’t|access changed|paused|Page expired/);
    await h.document.dispatchEvent({ type: "visibilitychange" });
    assert.equal(h.visible("availability-status"), true); assert.equal(h.calls.length, 2);
  }
});

test("missing saved views and partial parent context are still visible, never successful hidden errors", async t => {
  const h = harness(t, { override: path => path === "/api/availability" ? json({ status: "cache_missing", cleanup: "not_requested" }) : null });
  await h.fire("availability-saved");
  assert.equal(h.visible("availability-status"), true); assert.match(h.get("availability-status").textContent, /No saved view exists/);
  assert.equal(h.visible("child-status"), true); assert.match(h.get("child-status").textContent, /No saved view.*unknown/);
  const partial = harness(t, { sharedActions: false, override: path => {
    if (path !== "/api/availability") return;
    const data = partial.parentData(); data.people[1] = { person: 1, status: "unavailable", slots: [] }; return json(data);
  } });
  await partial.fire("availability-load");
  assert.equal(partial.visible("availability-context"), true);
  assert.match(text(partial.get("availability-context")), /Debby.*isn’t available/);
});

test("child access, storage, session and cleanup errors remain visible outside Details", async t => {
  for (const status of ["unavailable", "revoked", "expired", "child_cache_invalid", "child_cache_unavailable", "child_cache_clear_failed", "cleanup_failed"]) {
    let fail = false;
    const h = harness(t, { override: path => fail && path === "/api/child/saved" ? json({ status }, 503) : null });
    await h.seedSaved(); await h.fire("availability-saved"); fail = true;
    await h.fire("availability-saved"); await settle();
    assert.equal(h.details.open, false); assert.equal(h.visible("child-status"), true, status);
    assert.match(h.get("child-status").textContent, /unavailable|revoked|expired|blocked|unconfirmed/i);
    assert.equal(h.get("child-status-details").textContent, "");
    await h.document.dispatchEvent({ type: "visibilitychange" });
    assert.equal(h.visible("child-status"), true);
  }
});

test("parent and child loading remain visible until success without opening Details or adding requests", async t => {
  for (const path of ["/api/availability", "/api/child/saved"]) {
    const wait = deferred();
    const h = harness(t, { override: p => p === path ? wait.promise : null });
    await h.seedSaved();
    const loading = h.fire("availability-load"); await settle();
    const id = path === "/api/availability" ? "availability-status" : "child-status";
    assert.equal(h.visible(id), true); assert.match(h.get(id).textContent, /Loading|Opening/);
    wait.resolve(json(path === "/api/availability" ? h.parentData() : h.savedSnapshot()));
    await loading; assert.equal(h.visible(id), false); assert.equal(h.details.open, false);
    assert.deepEqual(h.calls.map(c => c.path), ["/api/child/saved", "/api/availability"]);
  }
});

test("expiry replaces successful child prose with a visible error without restoring names", async t => {
  const h = harness(t); await h.seedSaved(); await h.fire("availability-load");
  await h.advance(1800001);
  assert.equal(h.visible("child-status"), true); assert.match(h.get("child-status").textContent, /expired/);
  assert.equal(h.childBlocks().length, 0); assert.equal(h.get("child-status-details").textContent, "");
});