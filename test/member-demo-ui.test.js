"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { harness, text } = require("./fixtures/our-week-harness");
async function add(h, name) {
  await h.fire("member-add"); h.get("member-name").value = name; await h.fire("member-save");
}
test("demo members add, remove, restore and reset without calendar requests or storage", async t => {
  const h = harness(t);
  await h.fire("member-add"); assert.equal(h.focus, h.get("member-name"));
  await h.fire("member-cancel"); assert.equal(h.focus, h.get("member-add"));
  await add(h, "Taylor");
  assert.match(text(h.get("member-demo-list")), /Taylor · Demo/);
  assert.equal(h.visible("member-editor"), false);
  await h.get("member-demo-list").children[0].children[1].dispatchEvent({ type: "click" });
  assert.equal(h.get("member-demo-list").children.length, 0);
  for (const i of [0, 1, 2]) await h.fire("member-remove-" + i);
  for (const i of [0, 1, 2]) assert.equal(h.visible("calendar-person-" + i), false);
  await add(h, "child"); assert.equal(h.visible("calendar-person-2"), true);
  await h.fire("member-reset");
  for (const i of [0, 1, 2]) assert.equal(h.visible("calendar-person-" + i), true);
  assert.deepEqual(h.calls, []); assert.equal(h.storage.values.size, 0);
});
test("member input validates blank, duplicate, long, control names and capacity; treats markup as text", async t => {
  const h = harness(t);
  for (const name of [" ", "Parent A", "pArEnT a", "a".repeat(41), "bad\u202ename"]) {
    await add(h, name);
    assert.equal(h.get("member-name").attributes["aria-invalid"], "true");
    assert.equal(h.get("member-demo-list").children.length, 0);
  }
  await add(h, "<img src=x onerror=alert(1)>");
  assert.match(text(h.get("member-demo-list")), /<img src=x onerror=alert\(1\)> · Demo/);
  assert.equal(h.get("member-demo-list").children[0].children[0].children.length, 0);
  for (let i = 0; i < 8; i++) await add(h, "Guest " + i);
  await add(h, "Overflow"); assert.match(h.get("member-message").textContent, /up to 12/);
  assert.equal(h.get("member-demo-list").children.length, 9); assert.deepEqual(h.calls, []);
});
test("Enter adds and Escape cancels with focus restored", async t => {
  const h = harness(t);
  await h.fire("member-add"); h.get("member-name").value = "Taylor";
  let prevented = 0;
  await h.get("member-editor").dispatchEvent({ type: "keydown", key: "Enter", target: h.get("member-name"), preventDefault() { prevented++; } });
  assert.match(text(h.get("member-demo-list")), /Taylor · Demo/);
  await h.fire("member-add");
  await h.get("member-editor").dispatchEvent({ type: "keydown", key: "Escape", preventDefault() { prevented++; } });
  assert.equal(prevented, 2); assert.equal(h.visible("member-editor"), false); assert.equal(h.focus, h.get("member-add"));
});
test("roster edits survive calendar redraw without changing snapshots, real statuses or Sync targets", async t => {
  const h = harness(t, { meta: { "child-sync": "child-sync-v1" } });
  await h.seedSaved(); await h.fire("availability-load");
  const saved = h.savedSnapshot(), count = h.calls.length;
  await h.fire("member-remove-2"); await add(h, "Taylor");
  await h.document.dispatchEvent({ type: "visibilitychange" });
  assert.equal(h.visible("calendar-person-2"), false); assert.match(h.get("calendar-person-2").attributes["aria-label"], /Loaded/);
  assert.match(text(h.get("member-demo-list")), /Taylor · Demo/);
  assert.deepEqual(h.savedSnapshot(), saved); assert.equal(h.calls.length, count);
  await h.fire("availability-load");
  assert.deepEqual(h.calls.slice(count).map(c => c.path), ["/api/child/sync", "/api/availability"]);
  assert.doesNotMatch(JSON.stringify(h.calls), /Taylor/);
  const fresh = harness(t); assert.equal(fresh.get("member-demo-list").children.length, 0);
  assert.equal(fresh.visible("calendar-person-2"), true);
});