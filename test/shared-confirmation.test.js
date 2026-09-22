"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { harness, settle, deferred } = require("./fixtures/our-week-harness");
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
const paths = h => h.calls.map(c => c.path);
const noProvider = h => assert.ok(paths(h).every(p => !/\/child\/(find|review|import)$/.test(p)));

for (const hit of [false, true]) test(`Confirm finishes without wizard on child saved ${hit ? "hit" : "miss"}`, async t => {
  const h = harness(t); if (hit) await h.seedSaved();
  assert.deepEqual(h.calls, []); await h.fire("availability-load");
  assert.deepEqual(paths(h), ["/api/child/saved", "/api/availability"]);
  assert.equal(h.get("child-calendar-section"), null); assert.equal(h.get("calendar-access"), null);
  assert.equal(h.childBlocks().length > 0, hit); assert.ok(h.parentBlocks().length);
  assert.equal(h.get("availability-refresh").disabled, false);
  assert.equal(h.focus, h.get("availability-load")); noProvider(h);
  if (!hit) assert.match(h.get("child-status").textContent, /No saved view.*unknown/);
  assert.deepEqual(Object.keys(h.calls[1].body).sort(), ["acknowledged", "endDate", "refresh", "requestId", "startDate"]);
  assert.equal(h.calls[1].body.startDate, "2026-10-09"); assert.equal(h.calls[1].body.endDate, "2026-10-15");
});

for (const hit of [false, true]) test(`second Sync updates parents without any child operation (${hit ? "saved hit" : "saved miss"})`, async t => {
  const wait = deferred(); let delay = false;
  const h = harness(t, { override: path => delay && path === "/api/availability" ? wait.promise : null });
  if (hit) await h.seedSaved();
  await h.fire("availability-load"); const before = h.calls.length, names = h.childBlocks().map(n => n.title);
  assert.equal(h.calls.find(c => c.path === "/api/availability").body.refresh, false);
  const stamp = h.get("child-imported-access").textContent, packets = JSON.stringify(h.packets);
  delay = true; const done = h.fire("availability-load"); await settle();
  assert.equal(h.get("availability-load").disabled, true);
  await h.fire("availability-load"); // A second click while pending cannot overlap.
  assert.deepEqual(paths(h).slice(before), ["/api/availability"]); assert.equal(h.calls.at(-1).body.refresh, true);
  assert.deepEqual(h.childBlocks().map(n => n.title), names); assert.equal(h.get("child-imported-access").textContent, stamp);
  wait.resolve(json(h.parentData())); await done;
  assert.deepEqual(h.childBlocks().map(n => n.title), names); assert.equal(h.get("child-imported-access").textContent, stamp);
  assert.equal(JSON.stringify(h.packets), packets); assert.equal(h.focus, h.get("availability-load")); noProvider(h);
  assert.match(h.get("child-week-status").textContent, hit ? /Saved view only.*Update refreshes parents only/ : /No live Child refresh/);
});

test("generic child saved failure permits parents after independent preserve cleanup", async t => {
  const h = harness(t, { override: path => path === "/api/child/saved" ? json({ status: "unavailable" }, 503) : null });
  await h.fire("availability-load"); await settle();
  assert.equal(h.childBlocks().length, 0); assert.ok(h.parentBlocks().length);
  assert.equal(h.get("availability-refresh").disabled, false); noProvider(h);
});

for (const outcome of ["unavailable", "transport", "revoked", "cleanup_failed"]) test(`parent Update ${outcome} preserves independent child or fails closed on safety loss`, async t => {
  let fail = false;
  const h = harness(t, { override(path) {
    if (!fail || path !== "/api/availability") return;
    if (outcome === "transport") throw Error("PRIVATE");
    return json({ status: outcome, cleanup: outcome === "cleanup_failed" ? outcome : "workflow_disabled" });
  } });
  await h.seedSaved(); await h.fire("availability-load");
  const original = h.childBlocks().map(n => n.title), stamp = h.get("child-imported-access").textContent;
  const before = h.calls.length; fail = true; await h.fire("availability-refresh"); await settle();
  assert.deepEqual(paths(h).slice(before), ["/api/availability"]);
  if (["unavailable", "transport"].includes(outcome)) {
    assert.deepEqual(h.childBlocks().map(n => n.title), original); assert.equal(h.get("child-imported-access").textContent, stamp);
  } else { assert.equal(h.childBlocks().length, 0); assert.equal(h.get("child-imported-access").hidden, true); }
  noProvider(h);
});

for (const trigger of ["clear", "scope-away-back", "expiry"]) test(`${trigger} fences pending parent Update and preserved child titles`, async t => {
  const wait = deferred(); let delay = false;
  const h = harness(t, { override: path => delay && path === "/api/availability" ? wait.promise : null });
  await h.seedSaved(); await h.fire("availability-load"); delay = true;
  const done = h.fire("availability-refresh"); await settle();
  if (trigger === "clear") await h.fire("availability-clear");
  else if (trigger === "expiry") await h.advance(1800001);
  else { await h.range("2026-10-08", "2026-10-14"); await h.range("2026-10-09", "2026-10-11"); }
  wait.resolve(json(h.parentData())); await done; await settle();
  assert.equal(h.childBlocks().length, 0); noProvider(h);
});

test("saved-only and same-scope paging retain saved names with exact bounds and no operations", async t => {
  const h = harness(t); await h.seedSaved(); await h.fire("availability-saved");
  assert.deepEqual(paths(h), ["/api/availability", "/api/child/saved"]); assert.equal(h.calls[0].body.cacheOnly, true);
  const before = h.calls.length, stamp = h.get("child-week-status").textContent;
  await h.fire("availability-display-next"); await h.fire("availability-display-next");
  await h.range("2026-10-10", "2026-10-11");
  assert.equal(h.calls.length, before); assert.equal(h.get("child-week-status").textContent, stamp);
  await h.fire("availability-refresh");
  assert.deepEqual(paths(h).slice(before), ["/api/availability"]); assert.equal(h.calls.at(-1).body.endDate, "2026-10-15");
});

test("common buttons cannot overlap pending child saved read and Clear fences it", async t => {
  const wait = deferred(); const h = harness(t, { override: path => path === "/api/child/saved" ? wait.promise : null });
  const done = h.fire("availability-load"); await settle();
  for (const id of ["availability-load", "availability-saved", "availability-refresh"]) { assert.equal(h.get(id).disabled, true); await h.fire(id); }
  assert.deepEqual(paths(h), ["/api/child/saved"]);
  await h.fire("availability-clear"); await settle(); wait.resolve(json({ status: "cache_missing" })); await done;
  assert.deepEqual(paths(h), ["/api/child/saved", "/api/clear"]); noProvider(h);
});

test("global Clear drains child cleanup before its single delete-both request", async t => {
  const wait = deferred(); let delay = false;
  const h = harness(t, { override: path => delay && path === "/api/child/clear" ? wait.promise : null });
  await h.seedSaved(); await h.fire("availability-load"); delay = true;
  h.get("availability-end").value = "2026-10-16"; await h.fire("availability-end", "change"); await settle();
  await h.fire("availability-clear"); await settle();
  assert.equal(paths(h).includes("/api/clear"), false);
  wait.resolve(json({ status: "cleared" })); await settle();
  assert.equal(paths(h).filter(p => p === "/api/clear").length, 1);
  assert.equal(h.savedSnapshot(), undefined); assert.equal(h.childBlocks().length, 0); noProvider(h);
});