"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { initial, transition, validList } = require("../owner/core");
const key = "11111111-1111-4111-8111-111111111111";
const data = { status: "listed", count: 1, calendars: [{ key, name: "<script>synthetic</script>" }], eventsRead: 0,
  completeness: "unknown", ownership: "unverified", cleanup: "workflow_disabled" };
const loading = () => transition(transition(initial(), { type: "ack", value: true }), { type: "load" });

test("owner UI is idle, acknowledgement gated and one-shot, with no fake connection state", () => {
  const s = initial(); assert.equal(s.phase, "idle"); assert.equal(transition(s, { type: "load" }), s);
  const l = loading(); assert.equal(l.phase, "loading"); assert.equal(transition(l, { type: "load" }), l);
  assert.equal(l.calendars.length, 0);
});
test("all calendars start unselected; summary needs explicit selection and never grants event access", () => {
  const l = loading(), s = transition(l, { type: "loaded", generation: l.generation, data });
  assert.deepEqual(s.selected, []); assert.equal(transition(s, { type: "review" }), s);
  const selected = transition(s, { type: "select", key, value: true });
  const summary = transition(selected, { type: "review" }); assert.equal(summary.phase, "summary");
  assert.equal(summary.connected, undefined); assert.equal(summary.events, undefined);
  const deselected = transition(summary, { type: "select", key, value: false });
  assert.equal(deselected.phase, "selecting"); assert.deepEqual(deselected.selected, []);
});
test("clear, acknowledgement removal and late results cannot restore names or summary", () => {
  const l = loading();
  for (const action of [{ type: "clear" }, { type: "ack", value: false }]) {
    const cleared = transition(l, action);
    assert.equal(transition(cleared, { type: "loaded", generation: l.generation, data }), cleared);
    assert.deepEqual(cleared.calendars, []); assert.deepEqual(cleared.selected, []);
    assert.equal(cleared.acknowledged, false); assert.equal(cleared.used, true);
  }
});
test("invalid list, unverified cleanup, mismatched count and opaque key injection are rejected", () => {
  for (const d of [{ ...data, cleanup: "cleanup_pending" }, { ...data, eventsRead: 1 }, { ...data, count: 0 },
    { ...data, calendars: [null] }, { ...data, calendars: [{ key: "onclick=x", name: "Sample" }] }, { ...data, completeness: "complete" }]) assert.equal(validList(d), false);
});
test("owner rendering uses text nodes only; no storage, analytics, raw provider messages or automatic fetching", () => {
  const ui = readFileSync(require.resolve("../owner/ui.js"), "utf8");
  assert.doesNotMatch(ui, /innerHTML|outerHTML|insertAdjacentHTML|localStorage|sessionStorage|indexedDB|console\.|setInterval/);
  assert.match(ui, /text\.textContent = calendar\.name/);
  assert.match(ui, /li\.textContent = calendar\.name/);
  assert.match(ui, /pagehide/); assert.match(ui, /generation !== state.generation/);
  const html = readFileSync(require.resolve("../owner/index.html"), "utf8");
  assert.match(html, /developer's previously authorized account/);
  assert.match(html, /protected run history/); assert.match(html, /No access granted, no events imported/);
  assert.match(html, /id="owner-load" disabled/); assert.match(html, /role="status"/);
  assert.doesNotMatch(html, /no ETag|Live listing is blocked|Deployment gate:/);
  assert.match(html, /Every explicit Load checks the current contract/);
});