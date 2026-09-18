"use strict";
// Wizard UI removed; core/session tests still enforce guardian and import consent.
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs");
const { harness, settle } = require("./fixtures/our-week-harness");
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
const removed = ["calendar-access", "child-calendar-section", "child-setup", "child-find", "child-source-select", "child-person", "child-disclosure", "child-guardian", "child-review", "child-review-panel", "child-summary", "child-import", "child-change", "child-clear", "child-skip", "child-cancel"];

test("markup removes every Kimi operation and wizard rather than hiding reachable controls", t => {
  const h = harness(t), html = fs.readFileSync(require.resolve("../owner/index.html"), "utf8");
  for (const id of removed) { assert.equal(h.get(id), null, id); assert.doesNotMatch(html, new RegExp(`(?:id|aria-controls)="${id}"`)); }
  assert.doesNotMatch(html, /<dialog|<button[^>]*id="child-|Continue without Kimi|Change Kimi access|Remove Kimi access/);
  assert.ok(html.indexOf('id="child-retention"') > html.indexOf('<details class="availability-details">'));
  assert.match(html, /Update refreshes parents only/);
  assert.deepEqual(h.calls, []);
});

test("saved controller exposes only saved/release and has no provider paths or wizard listeners", t => {
  const h = harness(t), script = fs.readFileSync(require.resolve("../owner/child-calendar-ui.js"), "utf8");
  assert.deepEqual(Object.keys(h.childActions()).sort(), ["release", "saved"]);
  assert.doesNotMatch(script, /\/api\/child\/(?:find|review|import)|showModal|importReviewed|reviewAccess|finishFlow|closeFlow/);
  for (const id of removed) assert.ok(!script.includes(`$("${id}")`));
});

for (const mode of ["synthetic", "unavailable"]) test(`startup and presentation notifications are inert: ${mode}`, async t => {
  const h = harness(t, { meta: { "child-mode": mode } });
  await h.emit("focus"); await h.emit("pageshow", { persisted: false });
  await h.document.dispatchEvent({ type: "visibilitychange" });
  assert.deepEqual(h.calls, []); assert.equal(h.childBlocks().length, 0);
  assert.equal(h.get("school-calendar-section"), null);
  if (mode === "unavailable") { await h.fire("availability-load"); assert.deepEqual(h.calls.map(c => c.path), ["/api/availability"]); }
});

for (const error of ["revoked", "blocked", "contract_drift", "expired", "cleanup_failed"]) test(`saved ${error} hides names and fences reuse with fixed text`, async t => {
  let fail = false;
  const h = harness(t, { override: path => fail && path === "/api/child/saved" ? json({ status: error }, 503) : null });
  await h.seedSaved(); await h.fire("availability-saved"); assert.ok(h.childBlocks().length);
  fail = true; await h.fire("availability-saved"); await settle();
  assert.equal(h.childBlocks().length, 0); assert.equal(h.get("child-imported-access").hidden, true);
  assert.equal(h.get("availability-refresh").disabled, true);
  assert.equal(h.get("child-status").attributes["data-urgent"], "true");
  const count = h.calls.length;
  for (const id of ["availability-load", "availability-saved", "availability-refresh"]) await h.fire(id);
  assert.equal(h.calls.length, count);
  assert.doesNotMatch(h.get("child-status").textContent, /find|select|review again|import/i);
});

test("expired backend page response fences queued parents without reopening access", async t => {
  const h = harness(t, { override: path => path === "/api/child/saved" ? json({ status: "blocked", reason: "session_unavailable" }, 403) : null });
  await h.fire("availability-load"); await settle();
  assert.match(h.get("child-status").textContent, /session expired/);
  assert.equal(h.calls.some(c => c.path === "/api/availability"), false);
  assert.equal(h.get("availability-load").disabled, true);
});

test("malformed and arbitrary provider errors use fixed text and never expose contents", async t => {
  for (const response of [json({ status: "PRIVATE provider-id" }, 503), new Response("not JSON PRIVATE"), json({ status: "saved", secret: "PRIVATE" })]) {
    const h = harness(t, { override: path => path === "/api/child/saved" ? response : null });
    await h.fire("availability-load"); await settle();
    assert.equal(h.childBlocks().length, 0); assert.doesNotMatch(h.all(), /PRIVATE|provider-id/);
    assert.match(h.get("child-status").textContent, /unavailable|invalid/i);
  }
});

for (const event of ["input", "change"]) test(`unsupported date ${event} fences child even without shared date event`, async t => {
  const h = harness(t, { sharedActions: false }); await h.openSaved();
  h.get("availability-end").value = "2026-10-16";
  await h.fire("availability-end", event); await settle();
  assert.equal(h.childBlocks().length, 0);
  const count = h.calls.length; await h.childActions().saved(); assert.equal(h.calls.length, count);
  assert.ok(h.savedSnapshot());
});

test("child cleanup failure stays sticky after dates return", async t => {
  const h = harness(t, { sharedActions: false, override: path => path === "/api/child/clear" ? json({ status: "cleanup_failed" }, 503) : null });
  await h.openSaved(); await h.range("2026-10-08", "2026-10-14"); await settle();
  await h.range("2026-10-09", "2026-10-15"); await settle();
  const count = h.calls.length; await h.childActions().saved(); assert.equal(h.calls.length, count);
  assert.equal(h.childBlocks().length, 0);
});