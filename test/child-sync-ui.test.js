"use strict";
// Explicit capability opt-in; real controllers, synthetic in-memory responses only.
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs");
const C = require("../owner/child-calendar-core");
const { harness, settle, deferred, text } = require("./fixtures/our-week-harness");
const meta = { "child-sync": "child-sync-v1" };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
const paths = h => h.calls.map(c => c.path);
const count = (h, path) => paths(h).filter(p => p === path).length;
const saved = () => ({ status: "saved", access: { person: "Kimi", guardian: true, disclosure: "details", sourceName: "Synthetic source <$&>" },
  data: { contract: C.contract, window: { ...C.window }, checkedAt: "2026-09-16T23:00:00Z", partial: false,
    events: [{ title: "SYNTHETIC <$&><script>text only</script>", start: "2026-10-09T09:00:00+08:00", end: "2026-10-09T10:00:00+08:00", allDay: false, status: "scheduled", kind: "singleInstance", redacted: false },
      { title: "Busy", start: "2026-10-09T10:00:00+08:00", end: "2026-10-09T11:00:00+08:00", allDay: false, status: "unknown", kind: "unknown", redacted: true }] } });
const noSetup = h => {
  assert.equal(paths(h).some(p => /\/child\/(find|review|import)$/.test(p)), false);
  for (const id of ["calendar-access", "child-calendar-section", "child-source-select", "child-guardian", "child-person", "child-clear"]) assert.equal(h.get(id), null);
};

test("safe Sync diagnostics appear only in Details and disappear on retry/success/date edit", async t => {
  let failing = true;
  const h = harness(t, { meta, savedChild: saved(), override: path => failing && path === "/api/child/sync"
    ? json({ status: "unavailable", diagnostic: { stage: "event_request", code: "http_500", elapsedMs: 4200 } }, 503) : null });
  const storage = [...h.storage.values];
  assert.deepEqual(h.calls, []);
  await h.fire("availability-load");
  const details = h.get("child-status-details");
  assert.match(details.textContent, /stage: event_request · code: http_500 · elapsed: 4200 ms/);
  assert.equal(details.hidden, false); assert.equal(h.visible(details), false); // Closed Details stays closed.
  assert.doesNotMatch(h.get("child-status").textContent, /http_500|4200/);
  assert.equal(h.focus, h.get("availability-load"));
  assert.deepEqual([...h.storage.values], storage);
  assert.doesNotMatch(JSON.stringify(h.events), /diagnostic|http_500|4200/);
  assert.doesNotMatch(JSON.stringify(h.calls.map(c => c.body)), /diagnostic|http_500|4200/);
  failing = false; await h.fire("availability-load");
  assert.doesNotMatch(details.textContent, /Sync diagnostic|http_500/);
  failing = true; await h.fire("availability-load");
  await h.range("2026-10-08", "2026-10-14");
  assert.doesNotMatch(details.textContent, /Sync diagnostic|http_500/);
});

test("invalid or old backend diagnostics never expose arbitrary text or invent native evidence", async t => {
  const values = [undefined, null, { stage: "PRIVATE", code: "http_500", elapsedMs: 1 },
    { stage: "event_request", code: "PRIVATE", elapsedMs: 1 },
    { stage: "event_request", code: "http_500", elapsedMs: 600001 },
    { stage: "event_request", code: "http_500", elapsedMs: 1, token: "PRIVATE" }];
  for (const diagnostic of values) {
    const h = harness(t, { meta, override: path => path === "/api/child/sync" ? json({ status: "unavailable", diagnostic }, 503) : null });
    await h.fire("availability-load");
    assert.match(h.get("child-status-details").textContent, /stage: browser_response · code: http_503/);
    assert.doesNotMatch(h.all(), /PRIVATE|stage: event_request/);
    assert.equal(h.calls.filter(c => c.path === "/api/child/sync").length, 1);
  }
});

test("transport failures have browser-only diagnostics and remain generic, bounded and nonpersistent", async t => {
  const h = harness(t, { meta, override: path => { if (path === "/api/child/sync") throw Error("PRIVATE url token"); } });
  await h.fire("availability-load");
  assert.match(h.get("child-status-details").textContent, /stage: browser_request · code: request_failed · elapsed: \d+ ms/);
  assert.doesNotMatch(h.all(), /PRIVATE url token/);
});

test("diagnostic cannot weaken cleanup blocking and a late failure cannot revive Details", async t => {
  const diagnostic = { stage: "cleanup", code: "cleanup_failed", elapsedMs: 600000 };
  const blocked = harness(t, { meta, override: path => path === "/api/child/sync" ? json({ status: "cleanup_failed", diagnostic }, 503) : null });
  await blocked.fire("availability-load");
  assert.equal(blocked.get("availability-load").disabled, true);
  assert.match(blocked.get("child-status-details").textContent, /stage: cleanup/);
  assert.equal(blocked.calls.some(c => c.path === "/api/availability"), false);
  const wait = deferred(), h = harness(t, { meta, override: path => path === "/api/child/sync" ? wait.promise : null });
  const loading = h.fire("availability-load"); await settle();
  await h.range("2026-10-08", "2026-10-14");
  wait.resolve(json({ status: "cleanup_failed", diagnostic }, 503)); await loading;
  assert.doesNotMatch(h.get("child-status-details").textContent, /Sync diagnostic/);
});

test("new marker is doublequoted and startup, focus and freshness timers never sync", async t => {
  assert.match(fs.readFileSync(require.resolve("../owner/index.html"), "utf8"), /<meta name="child-sync" content="CHILD_SYNC">/);
  const h = harness(t, { meta, savedChild: saved() });
  await h.emit("focus"); await h.advance(300001);
  assert.deepEqual(h.calls, []); assert.deepEqual(Object.keys(h.childActions()).sort(), ["release", "saved", "sync"]);
  assert.equal(h.get("availability-saved").hidden, true); noSetup(h);
});

test("common Sync sends exact child false then parent false, child true then parent true, never overlaps", async t => {
  const childWait = deferred(), parentWait = deferred(); let childDelayed = true, parentDelayed = true;
  const h = harness(t, { meta, savedChild: saved(), override(path) {
    if (path === "/api/child/sync" && childDelayed) return childWait.promise;
    if (path === "/api/availability" && parentDelayed) return parentWait.promise;
  } });
  const done = h.fire("availability-load"); await settle();
  assert.deepEqual(paths(h), ["/api/child/sync"]);
  for (const id of ["availability-load", "availability-refresh", "availability-saved"]) { assert.equal(h.get(id).disabled, true); await h.fire(id); }
  assert.equal(await h.childActions().sync(true), "cancel");
  assert.deepEqual(paths(h), ["/api/child/sync"]);
  childWait.resolve(json(saved())); await settle();
  assert.deepEqual(paths(h), ["/api/child/sync", "/api/availability"]);
  assert.equal(await h.childActions().sync(true), "cancel");
  await h.fire("availability-load"); assert.equal(h.calls.length, 2);
  parentWait.resolve(json(h.parentData())); await done;
  childDelayed = parentDelayed = false; await h.fire("availability-load");
  assert.deepEqual(paths(h), ["/api/child/sync", "/api/availability", "/api/child/sync", "/api/availability"]);
  for (const [i, refresh] of [[0, false], [2, true]]) {
    assert.deepEqual(h.calls[i].body, { acknowledged: true, startDate: "2026-10-09", endDate: "2026-10-15", refresh });
    assert.deepEqual(h.calls[i + 1].body, { acknowledged: true, requestId: "11111111-1111-4111-8111-111111111111", refresh, startDate: "2026-10-09", endDate: "2026-10-15" });
  }
  assert.equal(h.focus, h.get("availability-load")); noSetup(h);
});

test("missing remembered source stays concise and unknown, allows parents without setup or name migration", async t => {
  const h = harness(t, { meta }); await h.fire("availability-load");
  assert.deepEqual(paths(h), ["/api/child/sync", "/api/availability"]);
  assert.equal(h.get("child-status").textContent, "Kimi is not connected."); assert.equal(h.visible("child-status"), true);
  assert.match(h.get("child-status-details").textContent, /one-time exact source confirmation/i);
  assert.match(h.get("child-status-details").textContent, /not migrated from (a )?cached name/i);
  assert.match(h.get("child-status-details").textContent, /unknown/i);
  assert.equal(h.childBlocks().length, 0); assert.ok(h.parentBlocks().length); noSetup(h);
  await h.fire("availability-load"); assert.equal(h.calls.at(-2).body.refresh, true);
  assert.equal(h.get("availability-load").disabled, false);
});

test("saved-only helper stays cache-only with new capability, including a miss", async t => {
  for (const hit of [false, true]) {
    const h = harness(t, { meta, savedChild: hit ? saved() : undefined }); await h.fire("availability-saved");
    assert.deepEqual(paths(h), ["/api/availability", "/api/child/saved"]);
    assert.equal(h.calls[0].body.cacheOnly, true);
    assert.deepEqual(h.calls[1].body, { acknowledged: true, startDate: "2026-10-09", endDate: "2026-10-15" });
    assert.equal(h.childBlocks().length > 0, hit); noSetup(h);
  }
});

for (const marker of [undefined, "CHILD_SYNC", "unavailable", "child-sync-v0", null]) test(`old Sync marker ${marker} retains legacy saved-only with no probing`, async t => {
  const h = harness(t, { meta: { "child-sync": marker }, savedChild: saved() });
  assert.deepEqual(Object.keys(h.childActions()).sort(), ["release", "saved"]);
  await h.fire("availability-load"); const original = h.childBlocks().map(n => n.title);
  await h.fire("availability-load");
  assert.deepEqual(paths(h), ["/api/child/saved", "/api/availability", "/api/availability"]);
  assert.deepEqual(h.childBlocks().map(n => n.title), original);
  assert.match(h.get("child-week-status").textContent, /Saved view only.*Update refreshes parents only/); noSetup(h);
});

test("registration preserves strict legacy functions and only opts into sync on capability", async t => {
  const fn = () => "skip";
  for (const enabled of [false, true]) {
    for (const actions of [{ saved: fn, release: fn, sync: false }, { saved: fn, release: fn, sync: fn, data: fn }, { saved: fn }, { saved: true, release: fn }]) {
      const h = harness(t, { meta: enabled ? meta : {}, sharedActions: false });
      assert.throws(() => h.registerActions(actions), /Invalid week action interface/);
    }
    const legacy = harness(t, { meta: enabled ? meta : {}, sharedActions: false });
    const coordination = legacy.registerActions({ saved: fn, release: fn });
    assert.deepEqual(Object.keys(coordination), ["changed"]);
    const h = harness(t, { meta: enabled ? meta : {}, sharedActions: false });
    if (enabled) assert.deepEqual(Object.keys(h.registerActions({ saved: fn, release: fn, sync: fn })), ["changed"]);
    else assert.throws(() => h.registerActions({ saved: fn, release: fn, sync: fn }), /Invalid week action interface/);
  }
  const h = harness(t, { meta });
  for (const value of [undefined, 0, "true", {}, null]) assert.equal(await h.childActions().sync(value), "cancel");
  assert.deepEqual(h.calls, []);
});

for (const trigger of ["clear", "date-away-back", "expiry", "clock-expiry"]) test(`late child Sync after ${trigger} cannot display or start parents`, async t => {
  const wait = deferred(); const h = harness(t, { meta, savedChild: saved(), override: path => path === "/api/child/sync" ? wait.promise : null });
  const done = h.fire("availability-load"); await settle();
  if (trigger === "clear") await h.fire("availability-clear");
  else if (trigger === "date-away-back") { await h.range("2026-10-08", "2026-10-14"); await h.range("2026-10-09", "2026-10-11"); }
  else if (trigger === "expiry") await h.advance(1800001);
  else h.elapseWithoutTimers(1800001);
  await settle(); wait.resolve(json(saved())); await done; await settle();
  assert.equal(count(h, "/api/availability"), 0); assert.equal(h.childBlocks().length, 0);
  assert.equal(h.get("child-imported-access").hidden, true); assert.doesNotMatch(h.all(), /SYNTHETIC <\$&>/);
  assert.equal(h.calls[0].options.signal.aborted, true);
  if (trigger !== "clear") assert.deepEqual(h.savedSnapshot(), saved());
  noSetup(h);
});

for (const trigger of ["clear", "date-away-back", "expiry"]) test(`late parent response after ${trigger} never revives completed child Sync`, async t => {
  const wait = deferred(); const h = harness(t, { meta, savedChild: saved(), override: path => path === "/api/availability" ? wait.promise : null });
  const done = h.fire("availability-load"); await settle(); assert.ok(h.childBlocks().length);
  if (trigger === "clear") await h.fire("availability-clear");
  else if (trigger === "expiry") await h.advance(1800001);
  else { await h.range("2026-10-08", "2026-10-14"); await h.range("2026-10-09", "2026-10-11"); }
  assert.equal(h.childBlocks().length, 0);
  wait.resolve(json(h.parentData())); await done; await settle();
  assert.equal(h.childBlocks().length, 0); assert.equal(h.parentBlocks().length, 0);
  assert.equal(count(h, "/api/child/sync"), 1); noSetup(h);
});

for (const error of ["unavailable", "404", "transport", "stream"]) test(`Sync ${error} has no fallback, truthful request uncertainty and independent parent continuation`, async t => {
  let fail = false;
  const h = harness(t, { meta, savedChild: saved(), override(path) {
    if (!fail || path !== "/api/child/sync") return;
    if (error === "transport") throw Error("PRIVATE transport detail");
    if (error === "stream") return new Response(new ReadableStream({ start(controller) { controller.error(Error("PRIVATE stream detail")); } }));
    return json({ status: "unavailable" }, error === "404" ? 404 : 503);
  } });
  await h.fire("availability-load"); fail = true; const start = h.calls.length;
  await h.fire("availability-load"); await settle();
  assert.deepEqual(paths(h).slice(start), ["/api/child/sync", "/api/child/edit", "/api/availability"]);
  assert.equal(h.childBlocks().length, 0); assert.ok(h.parentBlocks().length);
  assert.match(h.get("child-status").textContent, /unknown/i);
  assert.doesNotMatch(h.get("child-status").textContent, /no Outlook request|Outlook not queried/i);
  assert.doesNotMatch(h.all(), /PRIVATE (transport|stream) detail/);
  assert.deepEqual(h.savedSnapshot(), saved()); noSetup(h);
});

for (const code of ["child_source_invalid", "child_source_unavailable", "child_source_clear_failed", "child_cache_invalid", "child_cache_unavailable", "child_cache_clear_failed", "cleanup_failed", "revoked", "expired", "blocked", "contract_drift"]) test(`Sync ${code} blocks reuse and queued parents`, async t => {
  const h = harness(t, { meta, savedChild: saved(), override: path => path === "/api/child/sync" ? json({ status: code }, 503) : null });
  await h.fire("availability-load"); await settle();
  assert.equal(count(h, "/api/availability"), 0); assert.equal(h.childBlocks().length, 0);
  for (const id of ["availability-load", "availability-refresh", "availability-saved"]) assert.equal(h.get(id).disabled, true);
  await h.fire("availability-check"); await h.fire("availability-load");
  assert.equal(count(h, "/api/child/sync"), 1);
  assert.doesNotMatch(h.get("child-status").textContent, /no Outlook request/i); noSetup(h);
});

test("source storage flags on Sync or common status block reuse, even with successful status", async t => {
  for (const code of ["child_source_invalid", "child_source_unavailable", "child_source_clear_failed"]) {
    for (const path of ["/api/child/sync", "/api/status", "/api/clear"]) {
      const h = harness(t, { meta, savedChild: saved(), override: p => p === path ? json({ ...(path === "/api/child/sync" ? saved() : { status: path === "/api/status" ? "idle" : "cleared", cleanup: "not_requested" }), childSourceStatus: code }) : null });
      await h.fire("availability-load");
      if (path !== "/api/child/sync") await h.fire(path === "/api/status" ? "availability-check" : "availability-clear");
      await settle();
      assert.equal(h.childBlocks().length, 0); assert.equal(h.get("availability-load").disabled, true);
      assert.match(h.all(), /blocked|paused|could not|couldn.t/i);
      if (path === "/api/clear") assert.doesNotMatch(h.get("availability-status").textContent, /^Saved view cleared\./);
    }
  }
});

test("strict Sync successes reject malformed, oversized, extra fields, invalid rows, private title leaks and legacy misses", async t => {
  const mutations = [s => { s.reference = "PRIVATE reference"; }, s => { s.access.sourceRef = "PRIVATE reference"; },
    s => { s.access.guardian = false; }, s => { s.data.checkedAt = "2099-01-01T00:00:00Z"; },
    s => { s.data.events[0].start = "bad"; }, s => { s.data.events[1].title = "PRIVATE redacted title"; },
    s => { s.access.disclosure = "busy_only"; }];
  const responses = [json(saved(), 201), new Response("PRIVATE malformed JSON"), json(null), json([]),
    json({ status: "source_missing", access: saved().access }), json({ status: "cache_missing" }),
    new Response(JSON.stringify(saved()), { headers: { "content-length": String(C.maxBytes + 1) } }),
    new Response(" ".repeat(C.maxBytes + 1)),
    ...mutations.map(mutate => { const value = saved(); mutate(value); return json(value); })];
  for (const response of responses) {
    const h = harness(t, { meta, savedChild: saved(), cloneResponses: false, override: path => path === "/api/child/sync" ? response : null });
    await h.fire("availability-load");
    assert.deepEqual(paths(h), ["/api/child/sync"]); assert.equal(h.childBlocks().length, 0);
    assert.equal(h.get("availability-load").disabled, true); assert.equal(h.get("child-imported-access").hidden, true);
    assert.doesNotMatch(h.all(), /PRIVATE (reference|redacted title|malformed JSON)/);
    assert.doesNotMatch(h.get("child-status").textContent, /no Outlook request/i);
  }
});

test("names stay escaped/page-only, private events unnamed, original provenance survives redraws without sync", async t => {
  const original = saved(), h = harness(t, { meta, savedChild: original, initialDates: ["2026-10-09", "2026-10-11"] });
  const storedDates = [...h.storage.values];
  await h.fire("availability-load"); const labels = h.childBlocks().map(n => n.title);
  assert.ok(h.childBlocks().some(n => n.textContent.startsWith(original.data.events[0].title)));
  assert.ok(h.childBlocks().some(n => n.textContent.startsWith("Event 2 ·") && /Event status unknown/.test(n.title)));
  assert.match(h.get("child-imported-access").textContent, /Checked 2026-09-16T23:00:00Z · Sync uses remembered source/);
  assert.match(h.get("child-status-details").textContent, /Checked 2026-09-16T23:00:00Z · Sync uses remembered source/);
  for (const id of ["child-week-status", "availability-load-scope", "availability-window", "availability-saved-help", "child-retention", "child-event-help"])
    assert.doesNotMatch(h.get(id).textContent, /Update refreshes parents only|No live Kimi refresh|Kimi is saved-view only/);
  assert.match(text(h.get("availability-parent-details")), /Checked 2026-09-17T00:59:00Z/);
  const stamp = h.get("child-imported-access").textContent;
  await h.fire("availability-display-next"); await h.fire("availability-display-previous"); await h.advance(300001);
  await h.document.dispatchEvent({ type: "visibilitychange" });
  assert.deepEqual(h.childBlocks().map(n => n.title), labels); assert.equal(h.get("child-imported-access").textContent, stamp);
  assert.equal(h.calls.length, 2); assert.deepEqual(h.savedSnapshot(), original); assert.deepEqual([...h.storage.values], storedDates);
  assert.doesNotMatch(JSON.stringify(h.events), /sourceName|title|reference|SYNTHETIC|Synthetic source/);
  assert.doesNotMatch(JSON.stringify(h.calls.map(c => c.body)), /source|reference|disclosure|title/); noSetup(h);
});

test("partial/empty/unknown/cancelled Sync results remain event context, never free time", async t => {
  for (const scenario of ["partial", "empty", "unknown", "cancelled"]) {
    const value = saved();
    if (scenario === "empty") value.data.events = [];
    else if (scenario === "partial") value.data.partial = true;
    else value.data.events[0].status = scenario;
    const h = harness(t, { meta, savedChild: value }); await h.fire("availability-load");
    assert.match(h.get("child-week-status").textContent, /Missing time is unknown, not free/);
    if (scenario === "partial") assert.match(h.get("calendar-person-2").textContent, /Partial/);
    if (scenario === "empty") assert.match(h.get("child-week-status").textContent, /no events returned/);
    assert.ok(h.childBlocks().every(n => /Not a Busy status/.test(n.title)));
  }
});

test("native-capable page uses the same bounded Sync shape with no synthetic/live label confusion", async t => {
  const h = harness(t, { meta: { ...meta, "owner-mode": "live", "owner-cache": "disk", "child-mode": C.contract, "child-cache": "child-saved-v1-disk" }, savedChild: saved() });
  assert.deepEqual(h.calls, []); await h.fire("availability-load"); await h.fire("availability-load");
  assert.deepEqual(paths(h), ["/api/child/sync", "/api/availability", "/api/child/sync", "/api/availability"]);
  assert.equal(h.calls[0].body.refresh, false); assert.equal(h.calls[2].body.refresh, true);
  assert.match(h.get("child-status-details").textContent, /Outlook.*Checked 2026-09-16T23:00:00Z · Sync uses remembered source/);
  assert.doesNotMatch(h.get("child-week-status").textContent, /sample|Sample/);
  assert.match(h.get("child-retention").textContent, /privately on this device until Clear/); noSetup(h);
});

test("Sync marker alone cannot enable an unavailable child or obsolete page/cache capability", async t => {
  for (const overrides of [{ "child-mode": "unavailable" }, { "child-cache": "CHILD_CACHE" }, { "owner-contract": "bounded-availability-v4" }]) {
    const h = harness(t, { meta: { ...meta, ...overrides } });
    assert.deepEqual(Object.keys(h.childActions()).sort(), ["release", "saved"]);
    await h.fire("availability-load");
    assert.equal(count(h, "/api/child/sync"), 0); assert.equal(count(h, "/api/child/saved"), 0);
  }
});

test("missing source on later Sync removes old child titles without cached-name recovery", async t => {
  let missing = false;
  const h = harness(t, { meta, savedChild: saved(), override: path => missing && path === "/api/child/sync" ? json({ status: "source_missing" }) : null });
  await h.fire("availability-load"); assert.ok(h.childBlocks().length); missing = true;
  await h.fire("availability-load");
  assert.equal(h.childBlocks().length, 0); assert.equal(h.get("child-imported-access").hidden, true);
  assert.equal(h.get("child-status").textContent, "Kimi is not connected.");
  assert.deepEqual(h.savedSnapshot(), saved()); assert.equal(count(h, "/api/child/saved"), 0);
  assert.ok(h.parentBlocks().length); noSetup(h);
});

test("Clear drains pending Sync error cleanup before its sole deletion and never starts queued parents", async t => {
  const wait = deferred();
  const h = harness(t, { meta, savedChild: saved(), override(path) {
    if (path === "/api/child/sync") return json({ status: "unavailable" }, 503);
    if (path === "/api/child/edit") return wait.promise;
  } });
  const done = h.fire("availability-load"); await settle();
  assert.deepEqual(paths(h), ["/api/child/sync", "/api/child/edit"]);
  const signal = h.calls[1].options.signal;
  await h.fire("availability-clear"); await h.fire("availability-clear"); await h.emit("pagehide"); await settle();
  assert.equal(count(h, "/api/clear"), 0); assert.equal(signal.aborted, false);
  wait.resolve(json({ status: "cleared" })); await done; await settle();
  assert.deepEqual(paths(h), ["/api/child/sync", "/api/child/edit", "/api/clear"]);
  assert.deepEqual(h.calls.at(-1).body, {}); assert.equal(h.savedSnapshot(), undefined);
  assert.equal(h.childBlocks().length, 0); assert.equal(count(h, "/api/availability"), 0);
});

test("Sync cancellation cleanup failure is sticky and prevents queued parent or automatic retry", async t => {
  const h = harness(t, { meta, savedChild: saved(), override(path) {
    if (path === "/api/child/sync") return json({ status: "unavailable" }, 503);
    if (path === "/api/child/edit") return json({ status: "child_source_clear_failed" }, 503);
  } });
  await h.fire("availability-load"); await settle();
  assert.deepEqual(paths(h), ["/api/child/sync", "/api/child/edit"]);
  assert.match(h.get("child-status").textContent, /blocked until explicit Clear/);
  await h.fire("availability-load"); await h.fire("availability-saved");
  assert.equal(h.calls.length, 2); assert.equal(h.get("availability-load").disabled, true);
  assert.deepEqual(h.savedSnapshot(), saved()); noSetup(h);
});

test("generic parent errors retain the independent child Sync snapshot; shared safety errors hide it", async t => {
  for (const outcome of ["unavailable", "transport", "revoked", "cleanup_failed"]) {
    const h = harness(t, { meta, savedChild: saved(), override(path) {
      if (path !== "/api/availability") return;
      if (outcome === "transport") throw Error("PRIVATE synthetic parent error");
      return json({ status: outcome, cleanup: outcome === "cleanup_failed" ? outcome : "workflow_disabled" });
    } });
    await h.fire("availability-load"); await settle();
    assert.equal(count(h, "/api/child/sync"), 1); assert.equal(count(h, "/api/child/saved"), 0);
    if (["unavailable", "transport"].includes(outcome)) {
      assert.ok(h.childBlocks().length); assert.match(h.get("child-imported-access").textContent, /Checked 2026-09-16T23:00:00Z/);
      assert.ok(h.parentBlocks().every(n => n.dataset.status === "unknown"));
    } else { assert.equal(h.childBlocks().length, 0); assert.equal(h.get("child-imported-access").hidden, true); }
    assert.doesNotMatch(h.all(), /PRIVATE synthetic parent error/); noSetup(h);
  }
});