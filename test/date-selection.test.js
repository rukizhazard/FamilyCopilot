"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { readFileSync } = require("node:fs"), vm = require("node:vm");
const D = require("../shared/date-selection"), A = require("../owner/availability-core");
const { dateStorage } = require("./fixtures/date-storage");
test("missing date key defaults to three inclusive Taipei days without any storage mutation", () => {
  const storage = dateStorage(), mutations = [];
  storage.setItem("unrelated", "preserve");
  for (const method of ["setItem", "removeItem"]) storage[method] = (...args) => { mutations.push([method, ...args]); };
  const expected = { start: "2026-10-08T16:00:00Z", end: "2026-10-11T16:00:00Z", timezone: "Asia/Taipei", interval: 30, slots: 144 };
  for (const store of [D.createStore(() => storage), D.createStore(() => storage)]) {
    assert.deepEqual(store.read(), { status: "default", window: expected });
    assert.equal(D.describeWeek(store.read().window).label, "9–11 October 2026");
    assert.equal(A.days(store.read().window).length, 3);
    assert.equal(A.slotTime(144, store.read().window).date, "2026-10-12");
  }
  assert.deepEqual(mutations, []); assert.equal(storage.getItem(D.key), null);
  assert.equal(storage.getItem("unrelated"), "preserve");
});
test("remembered full week and custom ranges remain byte-identical; reset alone restores the three-day default", () => {
  const storage = dateStorage(), store = D.createStore(() => storage);
  storage.setItem("unrelated", "preserve");
  for (const dates of [["2026-10-09", "2026-10-15"], ["2026-10-10", "2026-10-11"], ["2028-02-29", "2028-02-29"]]) {
    store.write(...dates); const before = storage.getItem(D.key);
    assert.deepEqual(D.createStore(() => storage).read(), { status: "selected", window: A.dateRange(...dates) });
    assert.equal(storage.getItem(D.key), before);
  }
  assert.equal(store.reset(), true); assert.equal(storage.getItem(D.key), null);
  assert.deepEqual(store.read(), { status: "default", window: A.dateRange("2026-10-09", "2026-10-11") });
  assert.equal(storage.getItem("unrelated"), "preserve");
});
test("describeWeek default remains the exact live full-week compatibility marker, not the initial selection", () => {
  assert.deepEqual(A.liveWindow, { start: "2026-10-08T16:00:00Z", end: "2026-10-15T16:00:00Z", timezone: "Asia/Taipei", interval: 30, slots: 336 });
  assert.deepEqual(D.describeWeek(), D.describeWeek(A.liveWindow));
  assert.equal(D.describeWeek().label, "9–15 October 2026");
  const { activityMarkup } = require("../scripts/activity-week");
  const html = readFileSync(require.resolve("../activity-preview/index.html"), "utf8");
  const markup = activityMarkup(html);
  assert.deepEqual(JSON.parse(markup.match(/name="activity-week" content='([^']+)'/)[1]), D.describeWeek());
  assert.match(markup, /class="shell-date">9–11 October 2026/);
  const owner = activityMarkup(readFileSync(require.resolve("../owner/index.html"), "utf8"));
  // The compact Our week heading no longer duplicates the editable dates.
  assert.match(owner, /id="availability-title" class="shell-title">Our week<\/h1>/);
  assert.match(owner, /id="availability-start"[^>]*value=""/);
  assert.match(owner, /id="availability-end"[^>]*value=""/);
});
test("shared date contract uses Our week validation: 1–7 inclusive Taipei days, not host timezone", () => {
  const body = { startDate: "2026-10-09", endDate: "2026-10-15" };
  assert.deepEqual(D.requestWindow(body), A.dateRange(body.startDate, body.endDate));
  assert.deepEqual(D.describeWeek(D.requestWindow(body)), { start: "2026-10-08T16:00:00Z", end: "2026-10-15T16:00:00Z",
    timezone: "Asia/Taipei", firstDate: "2026-10-09", lastDate: "2026-10-15", label: "9–15 October 2026" });
  for (const candidate of [null, [], {}, { startDate: "2026-10-09" }, { startDate: "2026-10-09", endDate: "2026-10-16" },
    { startDate: "2026-10-15", endDate: "2026-10-09" }, { startDate: "2026-02-29", endDate: "2026-03-01" },
    { startDate: "1999-12-31", endDate: "2000-01-01" }, { startDate: "2101-01-01", endDate: "2101-01-01" },
    { startDate: ["2026-10-09"], endDate: "2026-10-15" }, { ...body, ages: [8] }, { ...body, url: "https://evil.test/" }]) assert.throws(() => D.requestWindow(candidate));
  assert.equal(D.requestWindow({ startDate: "2028-02-29", endDate: "2028-02-29" }).slots, 48);
  assert.throws(() => D.describeWeek({ ...A.window, timezone: "UTC" }));
});
test("only version/state/two dates survive navigation and reset removes only the dedicated key", () => {
  const storage = dateStorage(), first = D.createStore(() => storage);
  storage.setItem("unrelated", "preserve");
  assert.equal(first.read().status, "default");
  assert.equal(first.write("2026-10-09", "2026-10-15"), true);
  assert.deepEqual(JSON.parse(storage.getItem(D.key)), { version: 1, state: "selected", startDate: "2026-10-09", endDate: "2026-10-15" });
  assert.equal(D.createStore(() => storage).read().status, "selected");
  assert.equal(first.reset(), true); assert.equal(first.read().status, "default");
  assert.equal(storage.getItem("unrelated"), "preserve");
});
test("invalid edits replace earlier dates with a minimal tombstone; corrupt or oversized descriptors never fall back", () => {
  const storage = dateStorage(), store = D.createStore(() => storage);
  store.write("2026-10-09", "2026-10-15"); store.write("", "2026-10-15");
  assert.deepEqual(JSON.parse(storage.getItem(D.key)), { version: 1, state: "invalid" });
  for (const raw of [storage.getItem(D.key), "bad", "null", "[]", " ".repeat(161),
    JSON.stringify({ version: 2, state: "selected", startDate: "2026-10-09", endDate: "2026-10-15" }),
    JSON.stringify({ version: 1, state: "selected", startDate: "2026-10-09", endDate: "2026-10-15", age: 8 }),
    JSON.stringify({ version: 1, state: "selected", startDate: "2026-02-30", endDate: "2026-03-01" })]) {
    storage.setItem(D.key, raw); assert.equal(store.read().status, "invalid"); assert.equal(store.read().window, null);
  }
});
test("storage denial/quota cannot expose the previous date selection", () => {
  const denied = D.createStore(() => { throw new Error("blocked"); });
  assert.equal(denied.read().window, null); assert.equal(denied.write("2026-10-09", "2026-10-15"), false);
  assert.equal(denied.reset(), false); assert.equal(denied.read().window, null);
  const storage = dateStorage(); D.createStore(() => storage).write("2026-09-20", "2026-09-26");
  storage.setItem = () => { throw new Error("quota"); };
  const store = D.createStore(() => storage);
  assert.equal(store.write("2026-10-09", "2026-10-15"), false);
  assert.equal(store.read().window, null); assert.equal(storage.getItem(D.key), null);
});
test("shared browser module has no network, owner controller, credential or calendar-data side effects", () => {
  const source = readFileSync(require.resolve("../shared/date-selection"), "utf8");
  const context = { OwnerAvailability: A };
  vm.runInNewContext(source, context);
  assert.equal(context.FamilyDates.describeWeek().label, D.describeWeek().label);
  assert.doesNotMatch(source.replace(/^\s*\/\/.*$/gm, ""), /fetch\(|XMLHttpRequest|localStorage|\.clear\(|document\.|cookie|console\.|\/api\//);
});