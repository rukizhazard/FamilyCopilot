"use strict";
// Real controllers and in-memory fixtures only. No listener, provider or disk data.
const test = require("node:test"), assert = require("node:assert/strict");
const C = require("../owner/child-calendar-core");
const { harness, settle, deferred, text } = require("./fixtures/our-week-harness");
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
const paths = h => h.calls.map(c => c.path);
const count = (h, path) => paths(h).filter(p => p === path).length;
const saved = () => ({ status: "saved", access: { person: "Kimi", guardian: true, disclosure: "details", sourceName: "Synthetic reviewed source" },
  data: { contract: C.contract, window: { ...C.window }, checkedAt: "2026-09-16T23:00:00Z", partial: false,
    events: [{ title: "SYNTHETIC saved <$&>", start: "2026-10-09T09:00:00+08:00", end: "2026-10-09T10:00:00+08:00", allDay: false, status: "scheduled", kind: "singleInstance", redacted: false }] } });
const disk = { "child-cache": "child-saved-v1-disk" };
const noProvider = h => assert.ok(paths(h).every(p => !["/api/child/find", "/api/child/review", "/api/child/import"].includes(p)));

test("saved-only independently loads both snapshots with exact requests, original named provenance and title-safe redraw", async t => {
  const original = saved(), h = harness(t, { savedChild: original, meta: disk });
  assert.deepEqual(h.calls, []);
  await h.fire("availability-saved");
  assert.deepEqual(paths(h), ["/api/availability", "/api/child/saved"]);
  assert.equal(h.calls[0].body.cacheOnly, true);
  assert.deepEqual(h.calls[1].body, { acknowledged: true, startDate: "2026-10-09", endDate: "2026-10-15" });
  assert.equal(h.get("child-calendar-section"), null); noProvider(h);
  assert.ok(h.childBlocks().some(n => n.textContent.startsWith(original.data.events[0].title)));
  assert.match(h.get("child-imported-access").textContent, /Saved access \(view only, not live authorization\).*2026-09-16T23:00:00Z.*Synthetic reviewed source/);
  assert.match(text(h.get("availability-parent-details")), /Parent A \(sample\).*Checked 2026-09-17T00:59:00Z/);
  assert.match(text(h.get("availability-parent-details")), /Parent B \(sample\).*Checked 2026-09-17T00:59:00Z/);
  assert.doesNotMatch(h.get("availability-status").textContent, /Child|23:00/);
  const labels = h.childBlocks().map(n => n.title), stamp = h.get("child-imported-access").textContent;
  await h.fire("availability-display-next"); await h.fire("availability-display-previous");
  await h.advance(300001); await h.document.dispatchEvent({ type: "visibilitychange" });
  assert.deepEqual(h.childBlocks().map(n => n.title), labels); assert.equal(h.get("child-imported-access").textContent, stamp);
  assert.equal(h.calls.length, 2); assert.deepEqual(h.savedSnapshot(), original);
  assert.doesNotMatch(JSON.stringify(h.events), /title|handle|token|sourceName|SYNTHETIC saved|Synthetic reviewed/);
  assert.equal(h.get("child-source-select"), null); assert.equal(h.get("child-guardian"), null);
});

test("Confirm first uses the disclosed saved child view, then parent snapshot behavior, without opening setup", async t => {
  const h = harness(t, { savedChild: saved(), meta: disk });
  await h.fire("availability-load");
  assert.deepEqual(paths(h), ["/api/child/saved", "/api/availability"]);
  assert.equal(h.calls[1].body.refresh, false); assert.equal(h.calls[1].body.cacheOnly, undefined);
  assert.equal(h.get("child-calendar-section"), null); assert.ok(h.childBlocks().length); noProvider(h);
  assert.match(h.get("child-retention").textContent, /privately on this device until Clear.*separate from parent.*No provider IDs, handles or tokens.*cannot detect Outlook revocation/);
});

for (const parentOutcome of ["cache_missing", "unavailable", "transport"]) test(`parent saved ${parentOutcome} still permits valid independent child saved view`, async t => {
  const h = harness(t, { savedChild: saved(), override(path) {
    if (path !== "/api/availability") return;
    if (parentOutcome === "transport") throw new Error("synthetic transport");
    return json({ status: parentOutcome, cleanup: "not_requested" });
  } });
  await h.fire("availability-saved");
  assert.deepEqual(paths(h), ["/api/availability", "/api/child/saved"]); assert.ok(h.childBlocks().length);
  assert.ok(h.parentBlocks().every(n => n.dataset.status === "unknown")); noProvider(h);
});

for (const failure of [
  { status: "cleanup_failed", cleanup: "cleanup_failed" }, { status: "revoked", cleanup: "workflow_disabled" },
  { status: "cache_invalid", cleanup: "not_requested" }, { status: "idle", cleanup: "not_requested", childCacheStatus: "child_cache_unavailable" }
]) test(`parent safety ${failure.childCacheStatus || failure.status} blocks both saved sources`, async t => {
  const h = harness(t, { savedChild: saved(), override: path => path === "/api/availability" ? json(failure) : null });
  await h.fire("availability-saved"); await settle();
  assert.equal(count(h, "/api/child/saved"), 0); assert.equal(h.childBlocks().length, 0);
  for (const id of ["availability-load", "availability-refresh", "availability-saved"]) assert.equal(h.get(id).disabled, true);
});

test("saved miss and Confirm never find sources or open an access dialog", async t => {
  const h = harness(t); await h.fire("availability-saved");
  assert.equal(h.get("child-calendar-section"), null); assert.match(h.get("child-status").textContent, /No saved view.*unknown/); noProvider(h);
  await h.fire("availability-load");
  assert.equal(h.get("child-calendar-section"), null); assert.equal(h.get("child-guardian"), null); noProvider(h);
  assert.equal(count(h, "/api/availability"), 2);
});

test("reload preserves synthetic saved contents and original freshness, but saved settings cannot authorize live Update", async t => {
  const original = saved(), before = harness(t, { savedChild: original });
  await before.fire("availability-saved"); await before.emit("pagehide"); await settle();
  assert.deepEqual(before.savedSnapshot(), original);
  const h = harness(t, { savedChild: before.savedSnapshot(), meta: disk });
  assert.deepEqual(h.calls, []); await h.fire("availability-saved");
  assert.match(h.get("child-imported-access").textContent, /2026-09-16T23:00:00Z/);
  const names = h.childBlocks().map(n => n.title);
  await h.fire("availability-refresh");
  assert.equal(count(h, "/api/child/saved"), 1); assert.equal(count(h, "/api/child/review"), 0);
  assert.equal(h.get("child-source-select"), null); assert.equal(h.get("child-person"), null); assert.equal(h.get("child-guardian"), null);
  assert.deepEqual(h.childBlocks().map(n => n.title), names); assert.equal(count(h, "/api/availability"), 2); noProvider(h);
});

for (const marker of [undefined, "CHILD_CACHE", "child-saved-v0", null]) test(`old cache marker ${marker} fails closed without disabling parent-only use`, async t => {
  const h = harness(t, { meta: { "child-cache": marker } }); assert.deepEqual(h.calls, []);
  assert.match(h.get("child-status").textContent, /safe backend update.*Parent-only controls still work/);
  await h.fire("availability-saved");
  assert.deepEqual(paths(h), ["/api/availability"]); assert.ok(h.parentBlocks().length);
  await h.fire("availability-refresh"); assert.equal(count(h, "/api/availability"), 2);
  assert.equal(paths(h).some(p => p.startsWith("/api/child/")), false);
  await h.fire("availability-clear"); await settle();
  assert.match(h.get("availability-status").textContent, /Parent A \+ Parent B only.*Child saved-data deletion is unconfirmed/);
  assert.match(h.get("availability-saved-help").textContent, /Clear here confirms parent deletion only/);
});

test("no child removal or Calendar access entry exists and an unused page preserves the saved snapshot", async t => {
  const h = harness(t, { savedChild: saved() });
  for (const id of ["child-clear", "calendar-access", "child-cancel", "child-skip"]) assert.equal(h.get(id), null);
  await h.emit("focus"); await settle();
  assert.deepEqual(paths(h), []); assert.deepEqual(h.savedSnapshot(), saved());
});

test("global Clear before any use sends one deletion, no child preserve/delete race", async t => {
  const h = harness(t, { savedChild: saved() });
  await h.fire("availability-clear"); await settle();
  assert.deepEqual(paths(h), ["/api/clear"]); assert.deepEqual(h.calls[0].body, {}); assert.equal(h.savedSnapshot(), undefined);
  await h.emit("pagehide"); await settle(); assert.equal(count(h, "/api/child/clear"), 0); assert.equal(count(h, "/api/child/edit"), 0);
});

for (const lifecycle of ["range", "leave", "expire"]) test(`${lifecycle} keeps completed saved child view and uses only preserve reasons`, async t => {
  const original = saved(), h = harness(t, { savedChild: original });
  await h.fire("availability-saved"); const start = h.calls.length;
  if (lifecycle === "range") { await h.range("2026-10-08", "2026-10-14"); await h.range("2026-10-09", "2026-10-11"); }
  else if (lifecycle === "leave") await h.emit("pagehide");
  else if (lifecycle === "expire") await h.advance(1800001);
  await settle(); assert.deepEqual(h.savedSnapshot(), original);
  for (const call of h.calls.slice(start).filter(c => /\/(clear|edit)$/.test(c.path))) assert.ok(["leave", "range", "cancel"].includes(call.body.reason));
});


for (const status of ["child_cache_invalid", "child_cache_unavailable", "child_cache_clear_failed"]) test(`${status} and optional status flag block saved reuse until explicit Clear`, async t => {
  for (const flag of [false, true]) {
    let broken = true;
    const h = harness(t, { override: path => path === "/api/child/saved" && broken ? json(flag ? { status: "saved", childCacheStatus: status } : { status }, flag ? 200 : 503) : null });
    await h.fire("availability-saved"); assert.equal(h.childBlocks().length, 0);
    assert.match(h.get("child-status").textContent, /blocked until explicit Clear.*reload cannot unblock/i);
    assert.equal(h.get("availability-saved").disabled, true); assert.equal(h.get("child-status").attributes["data-urgent"], "true");
    broken = false; await h.fire("availability-check"); assert.equal(h.get("availability-saved").disabled, true);
    await h.fire("availability-clear"); await settle(); assert.equal(count(h, "/api/clear"), 1);
    assert.equal(h.childBlocks().length, 0);
  }
});

test("strict saved validation rejects extra fields, future freshness, invalid rows and guardian bypass without drawing", async t => {
  const mutations = [s => { s.extra = true; }, s => { s.access.handle = "a".repeat(64); }, s => { s.access.guardian = false; },
    s => { s.data.checkedAt = "2099-01-01T00:00:00Z"; }, s => { s.data.events[0].start = "bad"; }, s => { s.access.disclosure = "busy_only"; }];
  for (const mutate of mutations) {
    const response = saved(); mutate(response);
    const h = harness(t, { override: path => path === "/api/child/saved" ? json(response) : null });
    await h.fire("availability-saved");
    assert.equal(h.childBlocks().length, 0); assert.equal(h.get("availability-saved").disabled, true);
    assert.doesNotMatch(h.all(), /SYNTHETIC saved/); assert.equal(h.get("child-imported-access").hidden, true); noProvider(h);
  }
});


for (const trigger of ["clear", "range", "expiry"]) test(`late child saved response after ${trigger} cannot draw or launch queued parents`, async t => {
  const wait = deferred(); const h = harness(t, { override: path => path === "/api/child/saved" ? wait.promise : null });
  const done = h.fire("availability-load"); await settle();
  if (trigger === "clear") await h.fire("availability-clear");
  else if (trigger === "expiry") await h.advance(1800001);
  else { await h.range("2026-10-08", "2026-10-14"); await h.range("2026-10-09", "2026-10-11"); }
  await settle(); wait.resolve(json(saved())); await done; await settle();
  assert.equal(h.childBlocks().length, 0); assert.equal(count(h, "/api/availability"), 0); assert.doesNotMatch(h.all(), /SYNTHETIC saved/);
});

test("late parent saved response after Clear cannot launch the queued child read", async t => {
  const wait = deferred(); const h = harness(t, { override: path => path === "/api/availability" ? wait.promise : null });
  const done = h.fire("availability-saved"); await settle(); await h.fire("availability-clear"); await settle();
  wait.resolve(json({ ...h.parentData(), cached: true })); await done; await settle();
  assert.equal(count(h, "/api/child/saved"), 0); assert.equal(h.childBlocks().length, 0); assert.equal(h.parentBlocks().length, 0);
});

test("global Clear drains pending child cancellation before its sole deletion", async t => {
  const wait = deferred(); let delay = false;
  const h = harness(t, { savedChild: saved(), override: path => delay && path === "/api/child/clear" ? wait.promise : null });
  await h.fire("availability-load"); delay = true;
  h.get("availability-end").value = "2026-10-16"; await h.fire("availability-end", "change"); await settle();
  const previousChildClears = count(h, "/api/child/clear");
  await h.fire("availability-clear"); await settle();
  assert.equal(count(h, "/api/clear"), 0);
  wait.resolve(json({ status: "cleared" })); await settle();
  assert.equal(count(h, "/api/clear"), 1); assert.equal(h.calls.at(-1).path, "/api/clear");
  assert.equal(count(h, "/api/child/clear"), previousChildClears); assert.equal(count(h, "/api/child/import"), 0);
});

test("disk and memory retention details are accurate without a review or import", async t => {
  for (const retention of ["disk", "memory"]) {
    const h = harness(t, { meta: { "child-cache": `child-saved-v1-${retention}` } });
    assert.match(h.get("child-retention").textContent, retention === "disk" ? /privately on this device until Clear/ : /memory until Clear or server restart/);
    assert.deepEqual(paths(h), []);
  }
});

test("non-200, malformed JSON, null and oversized saved responses fail closed without exposing response text", async t => {
  const responses = [json(saved(), 201), new Response("PRIVATE malformed body"), json(null),
    new Response(JSON.stringify(saved()), { headers: { "content-length": String(C.maxBytes + 1) } })];
  for (const response of responses) {
    const h = harness(t, { override: path => path === "/api/child/saved" ? response : null });
    await h.fire("availability-saved");
    assert.equal(h.childBlocks().length, 0); assert.equal(h.get("availability-saved").disabled, true);
    assert.match(h.get("child-status").textContent, /blocked until explicit Clear/);
    assert.doesNotMatch(h.all(), /PRIVATE malformed/);
  }
});

test("Clear in flight disables another Clear and suppresses page-exit preserve races", async t => {
  const wait = deferred(); const h = harness(t, { override: path => path === "/api/clear" ? wait.promise : null });
  await h.fire("availability-clear"); await settle();
  assert.equal(h.get("availability-clear").disabled, true);
  await h.fire("availability-clear"); await h.emit("pagehide"); await settle();
  assert.deepEqual(paths(h), ["/api/clear"]); assert.deepEqual(h.calls[0].body, {});
  wait.resolve(json({ status: "cleared", cleanup: "not_requested" })); await settle();
  assert.match(h.get("availability-status").textContent, /Saved view cleared/);
});

test("invalid date edits synchronously remove both sources' loaded Details and titles", async t => {
  const h = harness(t, { savedChild: saved() }); await h.fire("availability-saved");
  assert.match(text(h.get("availability-parent-details")), /Checked/);
  const change = h.range("", "2026-10-15");
  assert.equal(h.get("availability-parent-details").children.length, 0);
  assert.equal(h.get("child-imported-access").hidden, true); assert.equal(h.childBlocks().length, 0);
  await change; assert.deepEqual(h.savedSnapshot(), saved());
});