"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const vm = require("node:vm");
const A = require("../owner/availability-core");
const D = require("../shared/date-selection");
const { dateStorage } = require("./fixtures/date-storage");

// Minimal DOM seam runs the real UI handlers offline; no browser or credentials.
function harness(respond, mode = "synthetic", storage = "memory", range = "configurable-v1", selectedDates, saved = "preserve-v1", contract = "bounded-availability-v5") {
  // Successful-import fixtures explicitly remember their supported full week.
  // Fresh-default tests pass empty storage instead; never substitute date logic.
  if (!selectedDates) {
    selectedDates = dateStorage();
    D.createStore(() => selectedDates).write(...(mode === "synthetic" ? ["2026-09-20", "2026-09-26"] : ["2026-10-09", "2026-10-15"]));
  }
  const nodes = new Map(), calls = [], bodies = [], requests = [], handlers = {}, documentHandlers = {};
  let focus;
  const element = () => ({ value: "", disabled: false, hidden: false, textContent: "", children: [], dataset: {}, style: {}, attributes: {}, handlers: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    append(...items) { this.children.push(...items); }, replaceChildren(...items) { this.children = items; },
    addEventListener(name, fn) { this.handlers[name] = fn; }, focus() { focus = this; } });
  const html = readFileSync(require.resolve("../owner/index.html"), "utf8");
  for (const [tag, id] of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)) {
    const node = element();
    node.value = tag.match(/\bvalue="([^"]*)"/)?.[1] || "";
    node.hidden = /\shidden(?:\s|>)/.test(tag);
    node.disabled = /\sdisabled(?:\s|>)/.test(tag);
    nodes.set(id, node);
  }
  // Missing IDs must not silently manufacture the removed consent checkbox.
  const get = id => nodes.get(id) || null;
  const dateLabel = element();
  const meta = { "owner-csrf": "synthetic-csrf", "owner-mode": mode, "owner-cache": storage, "owner-range": range, "owner-saved": saved, "owner-contract": contract };
  const document = { getElementById: get, createElement: element, hidden: false,
    addEventListener(name, fn) { documentHandlers[name] = fn; },
    querySelector(selector) {
      if (selector === ".shell-date") return dateLabel;
      const name = selector.match(/^meta\[name="([^"]+)"\]$/)?.[1];
      return Object.hasOwn(meta, name) && meta[name] !== null ? { content: meta[name] } : null;
    } };
  const context = {
    OwnerAvailability: { ...A, freshness: data => A.freshness(data, Date.parse("2026-09-15T01:10:00Z")) },
    FamilyDates: { ...D, createStore: () => D.createStore(() => selectedDates) },
    AbortController, AbortSignal, TextEncoder, CustomEvent: class {}, clearTimeout() {}, setTimeout() {},
    crypto: { randomUUID: () => "11111111-1111-4111-8111-111111111111" },
    window: { addEventListener(name, fn) { handlers[name] = fn; }, dispatchEvent() {} },
    document,
    fetch: async (path, options) => {
      assert.ok(["/api/availability", "/api/clear", "/api/status"].includes(path), `Unexpected mocked request: ${path}`);
      calls.push(path); bodies.push(JSON.parse(options.body)); requests.push(options);
      const data = await respond(path, options);
      return { text: async () => typeof data === "string" ? data : JSON.stringify(data) };
    }
  };
  vm.runInNewContext(readFileSync(require.resolve("../owner/availability-ui.js"), "utf8"), context);
  return { get, calls, bodies, requests, handlers, documentHandlers, document, dateLabel,
    output: () => [...nodes.values()].flatMap(descendants)
      .map(n => [n.textContent, n.title, ...Object.values(n.attributes)].join(" ")).join("\n"),
    get focus() { return focus; },
    load: () => get("availability-load").handlers.click(),
    input(id, value) { get(id).value = value; return get(id).handlers.input(); },
    range(start, end) {
      get("availability-start").value = start; get("availability-end").value = end;
      return get("availability-end").handlers.input();
    } };
}
const descendants = node => [node, ...node.children.flatMap(descendants)];
const blocks = h => descendants(h.get("availability-grid")).filter(n => n.className === "week-run");
const noWeekView = (h, days = 7) => h.get("availability-grid").hidden && h.get("availability-grid").children.length === 0 &&
  h.get("availability-legend").hidden && !h.get("availability-empty").hidden &&
  h.get("availability-window").textContent.includes(`All ${days * 48} half-hour slots per parent`);
const settle = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; };
const snapshot = (window = A.window, synthetic = true) => ({ window, synthetic, checkedAt: "2026-09-15T01:08:00Z", cleanup: "workflow_disabled",
  people: [0, 1].map(person => ({ person, status: "checked", slots: Array(window.slots).fill("busy") })) });

test("live badge stays empty and hidden while samples stay labelled without startup or lifecycle requests", async () => {
  for (const mode of ["live", "synthetic"]) {
    const h = harness(() => { throw Error("No automatic API permitted"); }, mode);
    const assertSource = () => {
      assert.equal(h.get("owner-mode"), null);
      assert.equal(h.get("availability-diagnostic"), null);
      assert.equal(h.document.querySelector('meta[name="owner-mode"]').content, mode);
      assert.equal(h.get("owner-source-row").hidden, mode === "live");
      assert.equal(h.get("owner-source-badge").textContent, mode === "live" ? "" : "SAMPLE DATA");
      assert.equal(h.document.title, mode === "live" ? "Family Copilot · Our week" : "Family Copilot · SAMPLE calendars");
      assert.doesNotMatch(h.output(), /Read-only calendar|Technical details|workflow_disabled|shared-proxy/);
    };
    assertSource();
    h.documentHandlers.visibilitychange(); h.handlers.pageshow({ persisted: false });
    await h.get("availability-refresh").handlers.click();
    assertSource();
    h.handlers.pagehide(); h.handlers.pageshow({ persisted: true }); await settle();
    assertSource(); assert.deepEqual(h.calls, []);
  }
});

test("routine cleanup is silent; only explicit Check status reports local app state without rechecking calendars", async () => {
  for (const mode of ["live", "synthetic"]) for (const cleanup of ["workflow_disabled", "not_requested"]) {
    const data = snapshot(mode === "live" ? A.liveWindow : A.window, mode === "synthetic");
    const h = harness(path => path === "/api/availability" ? data :
      { status: path === "/api/clear" ? "cleared" : "idle", cleanup }, mode);
    const silent = () => {
      assert.equal(h.get("availability-cleanup").textContent, "");
      assert.equal(h.get("availability-cleanup").hidden, true);
    };
    silent(); assert.deepEqual(h.calls, []);
    await h.load(); silent();
    const originalSummary = h.get("availability-status").textContent;
    assert.equal(originalSummary, `${mode === "synthetic" ? "Mike (sample) + Debby (sample)" : "Mike + Debby"} · Updated 15 Sept 2026, 09:08 · Saved view`);
    await h.get("availability-check").handlers.click();
    assert.equal(h.get("availability-cleanup").textContent, "No unfinished update reported by the app. Calendars and Outlook access were not checked.");
    assert.equal(h.get("availability-cleanup").hidden, false);
    assert.equal(h.get("availability-status").textContent, originalSummary);
    assert.deepEqual(h.calls, ["/api/availability", "/api/status"]);
    assert.deepEqual(h.bodies[1], {});
    h.documentHandlers.visibilitychange(); h.handlers.pageshow({ persisted: false });
    assert.deepEqual(h.calls, ["/api/availability", "/api/status"]);
    await h.get("availability-refresh").handlers.click(); silent();
    assert.equal(h.bodies[2].refresh, true);
    assert.equal(h.get("availability-status").textContent, originalSummary);
    h.get("availability-clear").handlers.click(); await settle(); silent();
    assert.deepEqual(h.calls, ["/api/availability", "/api/status", "/api/availability", "/api/clear"]);
  }
});

test("raw private errors and diagnostic fields never reach any availability DOM output", async () => {
  const privateText = "PRIVATE_DIAGNOSTIC <script>privateAction()</script> private@example.test token=TEST_ONLY";
  const responses = [
    { status: privateText, cleanup: privateText },
    { status: "__proto__", cleanup: "constructor" },
    { status: "contract_drift", cleanup: "not_requested" },
    { status: "cleanup_failed", cleanup: "cleanup_failed" },
    { status: "cache_clear_failed", cleanup: "workflow_disabled" },
    { status: "blocked", reason: "session_unavailable" },
    `{${privateText}`,
    new Error(privateText)
  ];
  for (const action of ["availability-load", "availability-check", "availability-clear"]) for (const response of responses) {
    const h = harness(() => {
      if (response instanceof Error) throw response;
      return typeof response === "string" ? response : { ...response, error: privateText, message: privateText, diagnostic: privateText, private: privateText };
    });
    assert.deepEqual(h.calls, []);
    await h.get(action).handlers.click(); await settle();
    assert.equal(h.get("availability-diagnostic"), null);
    assert.equal(h.get("owner-mode"), null);
    assert.doesNotMatch(h.output(), /PRIVATE_DIAGNOSTIC|privateAction|private@|TEST_ONLY|<script>|__proto__|constructor/);
    for (const id of ["availability-status", "availability-cleanup"])
      assert.doesNotMatch(h.get(id).textContent, /workflow|cleanup|shared-proxy|credential|Azure|operator/i);
    assert.ok(noWeekView(h));
    h.documentHandlers.visibilitychange(); h.handlers.pageshow({ persisted: false }); await settle();
    assert.deepEqual(h.calls, [action === "availability-load" ? "/api/availability" : action === "availability-check" ? "/api/status" : "/api/clear"]);
  }
});

test("fresh owner dates are empty without startup writes/API; explicit selection retains full-week scope", async () => {
  for (const mode of ["live", "synthetic"]) {
    const storage = dateStorage(), writes = [], set = storage.setItem;
    storage.setItem = (...args) => { writes.push(args); return set(...args); };
    const h = harness(() => snapshot(A.liveWindow, mode === "synthetic"), mode, "memory", "configurable-v1", storage);
    assert.equal(h.get("availability-start").value, "");
    assert.equal(h.get("availability-end").value, "");
    assert.equal(h.get("availability-date-error").hidden, true);
    assert.equal(h.get("availability-start-label").textContent, "Choose date");
    h.documentHandlers.visibilitychange(); h.handlers.pageshow({ persisted: false });
    await h.get("availability-refresh").handlers.click();
    assert.deepEqual(h.calls, []); assert.deepEqual(writes, []); assert.equal(storage.getItem(D.key), null);
    assert.equal(h.get("availability-empty").dataset.state, "invalid");
    assert.equal(h.get("availability-supported-dates").hidden, true);
    for (const id of ["availability-load", "availability-saved"]) assert.equal(h.get(id).disabled, true);
    await h.load(); assert.deepEqual(h.calls, []);
    await h.range("2026-10-09", "2026-10-11");
    await h.load();
    assert.deepEqual(h.calls, ["/api/availability"]);
    assert.equal(h.bodies[0].endDate, "2026-10-15");
    assert.equal(h.get("availability-grid").children[0].children.length - 1, 3);
    assert.equal(writes.length, 1); assert.equal(blocks(h).length, 6);
  }
});

test("fresh shorter display leaves a mocked saved full week untouched until explicit saved-view loads it", async () => {
  const data = { ...snapshot(A.liveWindow, false), cached: true };
  const original = JSON.stringify(data), dates = dateStorage();
  const h = harness((path, options) => {
    assert.equal(path, "/api/availability");
    assert.equal(JSON.parse(options.body).cacheOnly, true);
    return data; // In-memory saved fixture only; no disk store or provider adapter.
  }, "live", "disk", "configurable-v1", dates);
  h.documentHandlers.visibilitychange();
  assert.deepEqual(h.calls, []); assert.equal(JSON.stringify(data), original);
  await h.range("2026-10-09", "2026-10-11");
  await h.get("availability-saved").handlers.click();
  const summary = h.get("availability-status").textContent;
  assert.equal(h.bodies[0].startDate, "2026-10-09"); assert.equal(h.bodies[0].endDate, "2026-10-15");
  assert.equal(h.bodies[0].refresh, false); assert.equal(JSON.stringify(data), original);
  const remembered = dates.getItem(D.key);
  const reloaded = harness(() => { throw Error("No automatic saved-view read"); }, "live", "disk", "configurable-v1", dates);
  assert.equal(reloaded.get("availability-end").value, "2026-10-11");
  assert.equal(dates.getItem(D.key), remembered); assert.deepEqual(reloaded.calls, []);
  assert.match(summary, /Updated 15 Sept 2026, 09:08/); assert.equal(JSON.stringify(data), original);
});

test("empty week presentation starts without a grid or legend and never loads on visibility changes", () => {
  for (const mode of ["live", "synthetic"]) {
    const h = harness(() => { throw Error("No startup request allowed"); }, mode);
    assert.equal(h.get("availability-grid").hidden, true);
    assert.equal(h.get("availability-grid").children.length, 0);
    assert.equal(h.get("availability-legend").hidden, true);
    assert.equal(h.get("availability-empty").hidden, false);
    assert.equal(h.get("availability-empty").dataset.state, "idle");
    assert.equal(h.get("availability-empty-title").textContent, "Your week, at a glance");
    assert.equal(h.get("availability-empty-description").textContent, "Choose your dates, then select Sync.");
    const html = readFileSync(require.resolve("../owner/index.html"), "utf8");
    assert.doesNotMatch(html, /id="availability-empty-note"|No schedules loaded\. This does not mean the time is free\./);
    assert.equal(h.get("availability-refresh").disabled, true);
    assert.equal(h.get("availability-saved").disabled, false);
    h.documentHandlers.visibilitychange(); h.handlers.pageshow({ persisted: false });
    assert.deepEqual(h.calls, []);
    assert.equal(h.focus, undefined);
  }
});

test("empty week presentation distinguishes loading, loaded unknown data, Update and saved-only miss", async () => {
  const waiting = deferred();
  const h = harness(() => waiting.promise);
  const pending = h.load();
  assert.equal(h.get("availability-grid").children.length, 0);
  assert.equal(h.get("availability-empty").dataset.state, "loading");
  assert.equal(h.get("availability-empty").attributes["aria-busy"], "true");
  assert.match(h.get("availability-empty-title").textContent, /Loading/);
  assert.equal(h.focus, h.get("availability-clear"));
  const data = snapshot(); data.people.forEach(p => p.slots.fill("unknown"));
  waiting.resolve(data); await pending;
  assert.equal(h.get("availability-grid").hidden, false);
  assert.equal(h.get("availability-legend").hidden, false);
  assert.equal(h.get("availability-empty").hidden, true);
  assert.equal(h.get("availability-empty").attributes["aria-busy"], "false");
  assert.equal(blocks(h).length, 6);
  assert.ok(blocks(h).every(n => n.dataset.status === "unknown"));
  assert.equal(h.get("availability-context").children.length, 2);
  assert.equal(h.focus, h.get("availability-grid"));
  assert.equal(h.get("availability-status").hidden, true);
  const updating = h.get("availability-refresh").handlers.click();
  assert.equal(h.get("availability-grid").children.length, 0);
  assert.equal(h.get("availability-legend").hidden, true);
  await updating;
  assert.equal(h.calls.length, 2);

  const miss = harness(async () => ({ status: "cache_missing", cleanup: "not_requested" }));
  await miss.get("availability-saved").handlers.click();
  assert.equal(miss.get("availability-empty").dataset.state, "unavailable");
  assert.equal(miss.get("availability-grid").hidden, true);
  assert.match(miss.get("availability-status").textContent, /No saved view exists.*No calendars queried/);
  assert.equal(miss.get("availability-load").disabled, false);
  assert.equal(miss.get("availability-refresh").disabled, true);
  assert.deepEqual(miss.calls, ["/api/availability"]);
});

test("empty week presentation explains invalid, unsupported and blocked states without inventing availability", async () => {
  const h = harness(() => { throw Error("No request allowed"); }, "live");
  await h.range("", "");
  assert.equal(h.get("availability-empty").dataset.state, "invalid");
  assert.match(h.get("availability-empty-description").textContent, /1–7/);
  await h.range("2028-02-29", "2028-02-29");
  assert.equal(h.get("availability-empty").dataset.state, "unsupported");
  assert.equal(h.get("availability-supported-dates").hidden, false);
  assert.equal(h.get("availability-legend").hidden, true);
  assert.deepEqual(h.calls, []);

  for (const status of ["unavailable", "revoked", "cleanup_failed", "cache_clear_failed"]) {
    const failed = harness(async () => ({ status, cleanup: "not_requested" }));
    await failed.load();
    assert.equal(failed.get("availability-grid").children.length, 0);
    assert.equal(failed.get("availability-legend").hidden, true);
    assert.equal(failed.get("availability-status").dataset.urgent, "true");
    assert.doesNotMatch(failed.get("availability-empty-description").textContent, /time is free|No events/);
    assert.deepEqual(failed.calls, ["/api/availability"]);
    assert.equal(failed.focus, failed.get("availability-status"));
  }
});

test("empty week presentation never claims Clear succeeded while deletion is pending", async () => {
  const waiting = deferred();
  const h = harness(() => waiting.promise);
  h.get("availability-clear").handlers.click();
  assert.equal(h.get("availability-empty").dataset.state, "cleared");
  assert.equal(h.get("availability-grid").children.length, 0);
  assert.equal(h.get("availability-status").textContent, "Clearing saved view…");
  assert.doesNotMatch(h.get("availability-empty-description").textContent, /deleted|cleared|Confirm/);
  waiting.resolve({ status: "cache_clear_failed", cleanup: "not_requested" }); await settle();
  assert.equal(h.get("availability-empty").dataset.state, "blocked");
  assert.match(h.get("availability-status").textContent, /Couldn’t clear/);
});

test("empty week presentation removes a loaded grid after a session or cleanup block without restoring it on visibility", async () => {
  for (const response of [{ status: "blocked", reason: "session_unavailable" }, { status: "cleanup_failed", cleanup: "cleanup_failed" }]) {
    const h = harness(path => path === "/api/availability" ? snapshot() : response);
    await h.load();
    assert.equal(h.get("availability-grid").hidden, false);
    await h.get("availability-check").handlers.click();
    assert.ok(noWeekView(h));
    assert.equal(h.get("availability-empty").dataset.state, "blocked");
    assert.equal(h.get("availability-context").hidden, true);
    assert.equal(h.get("availability-status").dataset.urgent, "true");
    h.documentHandlers.visibilitychange();
    assert.ok(noWeekView(h));
    await h.load();
    assert.deepEqual(h.calls, ["/api/availability", "/api/status"]);
  }
});

test("empty week presentation has a labelled static fallback without focus traps, animation or status-only colors", () => {
  const html = readFileSync(require.resolve("../owner/index.html"), "utf8");
  const css = readFileSync(require.resolve("../owner/owner.css"), "utf8");
  const empty = html.slice(html.indexOf('<div id="availability-empty"'), html.indexOf('<div id="availability-legend"'));
  assert.match(empty, /role="region" aria-labelledby="availability-empty-title"/);
  assert.match(empty, /<h2 id="availability-empty-title">Your week, at a glance<\/h2>/);
  assert.match(html, /id="availability-load"[^>]*>[\s\S]*?sync-calendar-icon/);
  assert.doesNotMatch(empty, /week-empty-icon/);
  assert.match(empty, /Choose your dates, then select Sync\./);
  assert.doesNotMatch(empty, /tabindex|<button|<input|aria-live|role="status"|\shidden/);
  assert.match(html, /id="availability-grid"[^>]*\shidden>/);
  assert.match(html, /id="availability-legend"[^>]*\shidden>/);
  assert.match(css, /\[hidden\] \{ display:none !important; \}/);
  assert.match(css, /\.owner-page \.week-empty p[^}]*overflow-wrap:anywhere/);
  const rules = [...css.matchAll(/\.owner-page \.week-empty[^{}]*\{([^}]+)\}/g)].map(match => match[1]);
  assert.equal(rules.length, 4);
  rules.forEach(rule => assert.doesNotMatch(rule, /animation|transition|overflow:hidden|max-height|outline:none/));
  const luminance = hex => hex.match(/\w\w/g).map(value => parseInt(value, 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
  const backgrounds = css.match(/\.owner-page \.week-surface\[data-loaded="false"\] \{[^}]*linear-gradient\(135deg,#([\da-f]{6}),#([\da-f]{6})\)/).slice(1);
  for (const name of ["ink", "muted"]) for (const background of backgrounds) {
    const foreground = css.match(new RegExp(`--${name}:#([\\da-f]{6})`))[1];
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    assert.ok((values[0] + .05) / (values[1] + .05) >= 4.5, `${name} contrast on ${background}`);
  }
});

test("date-only handoff restores owner inputs before any consent/query and remembers edits for Activities", async () => {
  const storage = dateStorage(), store = D.createStore(() => storage);
  store.write("2026-10-09", "2026-10-15");
  const never = async () => { throw new Error("No calendar request allowed"); };
  const h = harness(never, "synthetic", "memory", "configurable-v1", storage);
  assert.equal(h.get("availability-start").value, "2026-10-09");
  assert.equal(h.get("availability-end").value, "2026-10-15");
  assert.match(h.get("availability-display-label").textContent, /9–11 October 2026/); assert.deepEqual(h.calls, []); assert.ok(noWeekView(h));
  assert.equal(h.get("availability-refresh").disabled, true);
  await h.range("2026-10-10", "2026-10-11"); assert.deepEqual(h.calls, []);
  assert.equal(D.describeWeek(store.read().window).label, "10–11 October 2026");
  await h.input("availability-start", ""); assert.equal(store.read().window, null); assert.deepEqual(h.calls, []);
  const restored = harness(never, "synthetic", "memory", "configurable-v1", storage);
  assert.equal(restored.get("availability-start").value, ""); assert.equal(restored.get("availability-load").disabled, true);
  assert.equal(restored.get("availability-date-error").hidden, false); assert.deepEqual(restored.calls, []);
});
test("storage failures block activity-link handoff instead of navigating with obsolete dates", async () => {
  const storage = dateStorage(); storage.setItem = () => { throw new Error("quota"); };
  const h = harness(async () => { throw new Error(); }, "synthetic", "memory", "configurable-v1", storage);
  await h.range("2026-10-09", "2026-10-15"); let prevented = false;
  h.documentHandlers.click({ target: { closest: () => ({}) }, preventDefault() { prevented = true; } });
  assert.equal(prevented, true); assert.deepEqual(h.calls, []);
  assert.match(h.get("availability-date-sharing").textContent, /Cannot remember dates/);
});

test("fresh and reused weeks keep original-date success in Details and focus the visible grid", async () => {
  for (const cached of [false, true]) for (const stale of [false, true]) {
    const checkedAt = stale ? "2026-09-15T01:00:00Z" : "2026-09-15T01:08:00Z";
    const h = harness(async () => ({ window: A.window, checkedAt, cached, synthetic: true, cleanup: "workflow_disabled",
      people: [0, 1].map(person => ({ person, status: "checked", slots: Array(336).fill("busy") })) }));
    assert.deepEqual(h.calls, []);
    await h.load();
    const summary = h.get("availability-status").textContent;
    assert.equal(summary, `Mike (sample) + Debby (sample) · Updated 15 Sept 2026, 09:${stale ? "00" : "08"} · Saved view${stale ? " · May be out of date" : ""}`);
    assert.equal(h.get("availability-status").dataset.urgent, "false");
    assert.equal(h.get("availability-context").hidden, true);
    assert.equal(h.get("availability-context").children.length, 0);
    assert.equal(h.get("availability-status").hidden, true);
    assert.equal(h.get("availability-status-details").textContent, summary);
    assert.equal(h.focus, h.get("availability-grid"));
    assert.doesNotMatch(summary, /cached|snapshot|permissions|provider|cleanup|Graph|both.*free/i);
    assert.doesNotMatch(h.get("availability-freshness").textContent, /15 Sept|09:|Updated/i);
    assert.equal(h.get("owner-source-badge").textContent, "SAMPLE DATA");
    assert.equal(h.get("availability-source").textContent, "Sample data · Not real calendars");
  }
});

test("safe failure offers only a deliberate Update; uncertain and cleanup failures stay visibly actionable", async () => {
  for (const [data, expected] of [
    [{ status: "unavailable", cleanup: "workflow_disabled" }, "Couldn’t load the week. Try Sync once."],
    [{ status: "unavailable" }, "Couldn’t load the week. Get help in Details before trying again."],
    [{ status: "cleanup_failed", cleanup: "cleanup_failed" }, "Updating paused. Get help in Details."]
  ]) {
    const h = harness(async () => data);
    await h.load();
    assert.equal(h.get("availability-status").textContent, expected);
    assert.equal(h.get("availability-status").dataset.urgent, "true");
    assert.equal(h.focus, h.get("availability-status"));
    assert.ok(noWeekView(h));
    assert.equal(h.calls.length, 1);
    assert.equal(h.get("availability-diagnostic"), null);
    assert.equal(h.get("availability-cleanup").hidden, data.cleanup === "workflow_disabled");
    assert.doesNotMatch(h.get("availability-cleanup").textContent, /workflow|cleanup|Azure|operator/i);
    if (data.status === "cleanup_failed") assert.equal(h.get("availability-refresh").disabled, true);
  }
});

test("urgent status-check failures are not overwritten by a previously loaded success summary", async () => {
  const h = harness(async path => {
    if (path === "/api/status") throw new Error("PRIVATE");
    return { window: A.window, checkedAt: "2026-09-15T01:08:00Z", synthetic: true, cleanup: "workflow_disabled",
      people: [0, 1].map(person => ({ person, status: "checked", slots: Array(336).fill("busy") })) };
  });
  await h.load();
  await h.get("availability-check").handlers.click();
  assert.equal(h.get("availability-status").textContent, "Couldn’t check the page. Get help in Details.");
  assert.equal(h.get("availability-status").dataset.urgent, "true");
  assert.equal(h.calls.length, 2);
});

test("unconfirmed or pending cleanup is visible outside Details without inventing success", async () => {
  for (const cleanup of [undefined, "cleanup_pending"]) {
    const h = harness(async () => ({ status: "idle", cleanup }));
    await h.get("availability-check").handlers.click();
    assert.equal(h.get("availability-status").dataset.urgent, "true");
    assert.match(h.get("availability-status").textContent, cleanup ? /still finishing/ : /Can’t confirm/);
    assert.equal(h.focus, h.get("availability-status"));
    assert.equal(h.calls.length, 1);
  }
  const h = harness(async () => ({ status: "unavailable", cleanup: "not_requested" }));
  h.get("availability-clear").handlers.click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.get("availability-status").textContent, "Couldn’t confirm the saved view was cleared. Get help in Details.");
  assert.equal(h.get("availability-status").dataset.urgent, "true");
});

test("availability expired-session response hides the grid and exposes explicit reload without retry", async () => {
  const h = harness(async () => ({ status: "blocked", reason: "session_unavailable" }));
  assert.deepEqual(h.calls, []); assert.equal(h.get("availability-load").disabled, false);
  await h.load();
  assert.deepEqual(h.calls, ["/api/availability"]);
  assert.equal(h.get("availability-status").textContent, "Page expired. Reload page to continue.");
  assert.equal(h.get("availability-status").dataset.urgent, "true");
  assert.equal(h.get("availability-cleanup").textContent, "Page expired. Reload to review access again. This does not confirm that the last update finished safely or unblock a paused update.");
  assert.equal(h.get("availability-cleanup").hidden, false);
  assert.equal(h.get("availability-recovery").hidden, false);
  assert.equal(h.get("availability-load").disabled, true);
  assert.equal(h.focus, h.get("availability-status"));
  assert.ok(noWeekView(h));
  await h.load(); assert.equal(h.calls.length, 1);
});

test("explicit cleanup check on expired page gives reload guidance, never a false disable confirmation", async () => {
  const h = harness(async () => ({ status: "blocked", reason: "session_unavailable" }));
  await h.get("availability-check").handlers.click();
  assert.deepEqual(h.calls, ["/api/status"]);
  assert.equal(h.get("availability-recovery").hidden, false);
  assert.match(h.get("availability-cleanup").textContent, /does not confirm that the last update finished safely or unblock a paused update/);
  assert.doesNotMatch(h.get("availability-cleanup").textContent, /Workflow disable verified|No unfinished update reported/);
  await h.load();
  assert.equal(h.get("availability-load").disabled, true);
  assert.deepEqual(h.calls, ["/api/status"]);
});

test("credential and contract errors remain distinct, unknown error text is never rendered", async () => {
  for (const [status, expected] of [["expired", /Can’t connect/], ["contract_drift", /Calendar access needs checking/],
    ["PRIVATE <script> alex@example.test", /Couldn’t load the week/]]) {
    const h = harness(async () => ({ status, cleanup: "not_requested", error: "PRIVATE" }));
    await h.load();
    assert.match(h.get("availability-status").textContent, expected);
    assert.equal(h.get("availability-cleanup").textContent, "");
    assert.equal(h.get("availability-cleanup").hidden, true);
    assert.doesNotMatch(h.get("availability-status").textContent, /PRIVATE|script|@/);
    assert.equal(h.get("availability-load").disabled, false); // Explicit Sync may retry, just as Update did.
  }
});

test("cleanup failure remains sticky even if a later shared-proxy status reports disabled", async () => {
  let first = true;
  const h = harness(async () => first ? (first = false, { status: "cleanup_failed", cleanup: "cleanup_failed" }) :
    { status: "idle", cleanup: "workflow_disabled" });
  await h.load(); await h.get("availability-check").handlers.click();
  assert.equal(h.get("availability-load").disabled, true);
  assert.equal(h.get("availability-cleanup").textContent, "Updating paused because the last update could not finish safely. Ask the person who set up this page for help; reloading cannot unblock it.");
  assert.equal(h.get("availability-cleanup").hidden, false);
  assert.doesNotMatch(h.get("availability-cleanup").textContent, /Workflow disable verified|No unfinished update reported/);
  assert.equal(h.get("availability-recovery").hidden, true);
  await h.load(); await h.get("availability-refresh").handlers.click();
  assert.deepEqual(h.calls, ["/api/availability", "/api/status"]);
});

test("unknown transport cleanup and pending cleanup are not treated as expired sessions or success", () => {
  assert.match(A.cleanupText({}), /Cleanup not confirmed/);
  assert.match(A.cleanupText({ cleanup: "cleanup_pending" }), /Keep the backend running/);
  assert.equal(A.sessionUnavailable({ status: "cleanup_failed", reason: "session_unavailable" }), false);
  assert.match(A.cleanupText({ cleanup: "workflow_disabled" }, true), /Synthetic fixture/);
  assert.match(A.cleanupText({ cleanup: "workflow_disabled" }, false, true), /Loading blocked/);
  assert.match(A.cleanupText({ cleanup: "workflow_disabled", cached: true }), /original load, not rechecked now/);
  assert.match(A.cleanupText({ cleanup: "workflow_disabled", cached: true }, false, true), /Loading blocked/);
});

test("week UI renders three display tracks daily with two unchanged parent tracks and exact midnight labels", async () => {
  const data={window:A.window,checkedAt:"2026-09-15T01:00:00Z",synthetic:true,cleanup:"workflow_disabled",
    people:[0,1].map(person=>({person,status:"checked",slots:Array.from({length:336},(_,i)=>Object.keys(A.labels)[i%5])}))};
  const h=harness(async path=>path==="/api/availability"?data:{status:"cleared",cleanup:"workflow_disabled"});
  await h.get("availability-refresh").handlers.click();assert.equal(h.calls.length,0);
  await h.load();
  const week=h.get("availability-grid").children;assert.equal(week.length,1);
  const days=week[0].children.slice(1);assert.equal(days.length,3);
  days.forEach((day,index)=>{
    assert.match(day.attributes["aria-label"],new RegExp(`2026-09-${20+index}`));
    const tracks=day.children[1].children;assert.equal(tracks.length,3);
    assert.equal(tracks[2].className, "child-track");
    tracks.slice(0,2).forEach((track,person)=>{
      assert.match(track.attributes["aria-label"],new RegExp(person?"Debby \\(sample\\)":"Mike \\(sample\\)"));
      const slots=track.children;assert.equal(slots.length,48);
      assert.match(slots[0].title,/00:00–00:30/);
      assert.match(slots[47].title,/23:30–24:00 Asia\/Taipei/);
      assert.equal(slots[47].style.gridRow,"48 / 49");
      assert.equal(slots[47].attributes["aria-label"],slots[47].title);
    });
  });
  assert.equal(blocks(h).length,288);
  assert.deepEqual(new Set(blocks(h).map(n=>n.dataset.status)),new Set(Object.keys(A.labels)));
  assert.equal(h.focus,h.get("availability-grid"));assert.equal(h.get("availability-load").disabled,false);
  h.get("availability-clear").handlers.click();
  assert.ok(noWeekView(h));
  assert.equal(h.get("availability-refresh").disabled,true);
  assert.equal(h.get("availability-ack"),null);
  await settle();
});

test("initial calendar picker is hidden and inert, handlers retained, explicit week consent and fictional separation", () => {
  const html=readFileSync(require.resolve("../owner/index.html"),"utf8");
  assert.match(html,/<section id="owner-calendar-section"[^>]* hidden inert>/);
  for(const id of ["owner-ack","owner-load","owner-check","owner-clear","owner-picker","owner-summary","fixture"])assert.ok(html.includes(`id="${id}"`));
  assert.ok(html.indexOf('id="synthetic-controls"')<html.indexOf('id="owner-calendar-section"'));
  for(const text of ["Mike Lee","Debby","2026-10-09 00:00","2026-10-16 00:00 (end exclusive)","All 336","UTC+8","no availability or calendar selections are used"])assert.ok(html.includes(text));
  assert.doesNotMatch(html,/person 0|person 1|Today’s|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const ui=readFileSync(require.resolve("../owner/ui.js"),"utf8");
  assert.match(ui,/if \(calendarUiHidden \|\| blocked \|\| clearPending\) return/);
  assert.match(ui,/owner-session-cleared/);assert.match(ui,/pagehide/);
  const css=readFileSync(require.resolve("../owner/owner.css"),"utf8");
  assert.match(css,/grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css,/#synthetic-controls select \{ width:100%; \}/);
});

test("oversized availability UI responses fail closed with no automatic retry", async () => {
  const h=harness(async()=>({padding:"x".repeat(A.responseLimit+1)}));
  await h.load();assert.equal(h.calls.length,1);
  await h.load();assert.equal(h.calls.length,2); // A second explicit Sync is a fresh request.
  assert.ok(noWeekView(h));
  assert.match(h.get("availability-status").textContent,/Couldn’t load the week/);
});

test("display aliases are exact, presentation-only and synthetic mapping never claims live identities", () => {
  assert.deepEqual(A.displayPeople(),[{person:0,alias:"Mike",previous:"Mike Lee"},{person:1,alias:"Debby",previous:"Debby"}]);
  assert.deepEqual(A.displayPeople(true),[{person:0,alias:"Mike (sample)",previous:"Alex (fictional)"},{person:1,alias:"Debby (sample)",previous:"Sam (fictional)"}]);
  const live=harness(()=>{},"live"), sample=harness(()=>{});
  assert.equal(live.get("availability-targets").textContent,"Mike + Debby · Default calendars · Busy-only");
  assert.match(live.get("availability-identity").textContent,/do not establish identity, parent relationships or guardian authority/);
  assert.equal(sample.get("availability-targets").textContent,"Mike (sample) + Debby (sample) · Default calendars · Busy-only");
  assert.match(sample.get("availability-identity").textContent,/Mike \(sample\) = fictional Alex; Debby \(sample\) = fictional Sam/);
  assert.doesNotMatch(sample.get("availability-identity").textContent,/Mike Lee|@/);
  for (const [h, names] of [[live, ["Mike", "Debby"]], [sample, ["Mike (sample)", "Debby (sample)"]]]) {
    assert.equal(h.get("availability-context").children.length, 0);
    assert.equal(h.get("availability-context").hidden, true);
    assert.equal(h.get("availability-grid").attributes["aria-label"], `Weekly calendar, ${h === live ? "9–11 October 2026" : "20–22 September 2026"}, ${[...names, h === live ? "Kimi" : "Kimi (sample)"].join(" and ")}, Asia/Taipei`);
  }
  assert.deepEqual(live.calls,[]);assert.deepEqual(sample.calls,[]);
  assert.ok(noWeekView(live));assert.ok(noWeekView(sample));
});

test("Our week title is static copy with no family-role labels or optional nickname/multiuser controls", () => {
  const html=readFileSync(require.resolve("../owner/index.html"),"utf8");
  const ui=readFileSync(require.resolve("../owner/availability-ui.js"),"utf8");
  assert.match(html,/<h1 id="availability-title" class="shell-title">Our week<\/h1>/);
  for (const source of [html, ui, readFileSync(require.resolve("../owner/availability-core.js"),"utf8")])
    assert.doesNotMatch(source,/\bDad\b|\bMom\b|availability-people|Add someone|nickname/i);
  assert.doesNotMatch(ui,/availability-title/); // Rendering must not overwrite the static title.
  assert.match(html,/aria-label="Calendar status legend"/);
});

test("day layout merges contiguous equal statuses without crossing midnight or people", () => {
  const people=[0,1].map(person=>({person,status:"checked",slots:Array(336).fill("busy")}));
  people[0].slots[47]="unknown";people[0].slots[48]="unknown";
  const copy=JSON.stringify(people), week=A.weekLayout(people);
  assert.deepEqual(week.map(d=>d.heading),["Sun 20","Mon 21","Tue 22","Wed 23","Thu 24","Fri 25","Sat 26"]);
  assert.equal(week.length,7);
  assert.deepEqual(week[0].tracks[0].runs,[{status:"busy",start:0,end:47,startTime:"00:00",endTime:"23:30"},{status:"unknown",start:47,end:48,startTime:"23:30",endTime:"24:00"}]);
  assert.deepEqual(week[1].tracks[0].runs[0],{status:"unknown",start:0,end:1,startTime:"00:00",endTime:"00:30"});
  for(const day of week)for(const track of day.tracks){
    assert.equal(track.runs[0].start,0);assert.equal(track.runs.at(-1).end,48);
    assert.equal(track.runs.reduce((sum,r)=>sum+r.end-r.start,0),48);
    for(let i=1;i<track.runs.length;i++)assert.equal(track.runs[i].start,track.runs[i-1].end);
  }
  assert.equal(JSON.stringify(people),copy);
  for(const slot of [-1,49,0.5,"0",NaN])assert.throws(()=>A.dayTime(slot));
  assert.equal(A.dayTime(48),"24:00");
});

test("layout rejects unavailable, missing, malformed or duplicate rows and untrusted slot strings", () => {
  for(const people of [[],[{person:0,status:"unavailable",slots:Array(336).fill("free_or_elsewhere")}],
    [{person:0,status:"checked",slots:Array(335).fill("free_or_elsewhere")}],
    [0,0].map(person=>({person,status:"checked",slots:Array(336).fill("free_or_elsewhere")}))]) {
    assert.ok(A.weekLayout(people).every(d=>d.tracks.every(t=>t.runs.length===1&&t.runs[0].status==="unknown")));
  }
  const slots=Array(336);slots[0]="<script>";slots[1]="__proto__";slots[2]="free_or_elsewhere";
  const week=A.weekLayout([{person:0,status:"partial",slots}]);
  assert.equal(week[0].tracks[0].runs[0].status,"unknown");
  assert.equal(week[0].tracks[0].runs[1].status,"free_or_elsewhere");
  assert.doesNotMatch(JSON.stringify(week),/script|__proto__/);
  assert.match(A.labels.free_or_elsewhere,/may be working elsewhere/);
});

test("loading and date edits hide the grid while loaded stale partial context retains unknown statuses", async () => {
  let release;
  const response={window:A.window,checkedAt:"2026-09-15T01:00:00Z",synthetic:true,cleanup:"workflow_disabled",
    people:[{person:0,status:"partial",slots:Array(336).fill("unknown")},A.unknown(1,"unavailable")]};
  response.people[0].slots[0]="busy";
  const h=harness(path=>path==="/api/availability"?new Promise(r=>{release=r;}):{status:"cleared",cleanup:"workflow_disabled"});
  const load=h.load();assert.ok(noWeekView(h));
  assert.equal(h.get("availability-context").hidden, true);
  assert.equal(h.get("availability-status").textContent, "Loading sample week…");
  release(response);await load;
  assert.match(h.get("availability-context").children[0].textContent,/Mike.*Some of this schedule is unknown/);
  assert.match(h.get("availability-context").children[1].textContent,/Debby.*schedule isn’t available/);
  assert.equal(h.get("availability-context").hidden, false);
  assert.match(h.get("availability-freshness").textContent,/Stale or unknown freshness/);
  assert.ok(blocks(h).some(n=>n.dataset.status==="busy"));
  assert.ok(blocks(h).every(n=>n.dataset.status!=="free_or_elsewhere"));
  const edit = h.input("availability-end", "2026-09-25");
  assert.ok(noWeekView(h,6));assert.equal(h.get("availability-load").disabled,true);
  assert.equal(h.get("availability-refresh").disabled,true);
  await edit;
  const late=harness(path=>path==="/api/availability"?new Promise(r=>{release=r;}):{status:"cleared",cleanup:"workflow_disabled"});
  const pending=late.load();late.get("availability-clear").handlers.click();release(response);await pending;
  assert.ok(noWeekView(late));assert.equal(late.calls.filter(p=>p==="/api/availability").length,1);
});

test("calendar scroll region is keyboard reachable, technical details closed, block DOM insertion safe", () => {
  const html=readFileSync(require.resolve("../owner/index.html"),"utf8"),ui=readFileSync(require.resolve("../owner/availability-ui.js"),"utf8"),css=readFileSync(require.resolve("../owner/owner.css"),"utf8");
  assert.match(html,/id="availability-grid" role="region" tabindex="0"/);
  assert.match(html,/<details class="availability-details"><summary>/);
  assert.doesNotMatch(html,/id="availability-deployment"|<details[^>]* open/);
  assert.match(html,/Mike \+ Debby · Default calendars · Busy-only/);
  assert.doesNotMatch(ui,/innerHTML|outerHTML|insertAdjacentHTML/);
  // Only the date-picker day buttons rove; schedule blocks do not gain tab stops.
  assert.deepEqual(ui.match(/\w+\.tabIndex\s*=.*;/g), ["button.tabIndex = value === dateCursor ? 0 : -1;"]);
  assert.match(css,/overflow-x:auto/);assert.match(css,/repeat\(3,minmax\(264px,1fr\)\)/);
  assert.match(css,/position:sticky; left:0/);assert.match(css,/repeating-linear-gradient/);
});

test("cached UI requires Confirm, preserves timestamp/stale disclosure and explicit Refresh flag", async () => {
  const data = { window: A.window, checkedAt: "2026-09-15T01:00:00Z", synthetic: true, cleanup: "workflow_disabled", cached: true,
    people: [0, 1].map(person => ({ person, status: "checked", slots: Array(336).fill("busy") })) };
  const h = harness(async () => data);
  assert.deepEqual(h.calls, []);
  await h.get("availability-refresh").handlers.click(); assert.deepEqual(h.calls, []);
  await h.load();
  assert.equal(h.bodies[0].refresh, false);
  assert.match(h.get("availability-status").textContent, /Updated 15 Sept 2026, 09:00 · Saved view · May be out of date/);
  assert.match(h.get("availability-freshness").textContent, /Stale.*Cached use does not recheck provider permissions/);
  assert.doesNotMatch(h.get("availability-freshness").textContent, /Updated|Last updated|09:00/);
  assert.equal(h.get("availability-refresh").disabled, false);
  await h.get("availability-refresh").handlers.click(); assert.equal(h.bodies[1].refresh, true);
  h.handlers.pagehide(); assert.deepEqual(h.bodies.at(-1), { reason: "leave" }); assert.ok(noWeekView(h));
  await settle();
});

test("Confirm replaces the checkbox: startup is idle and Update cannot query before confirmation", async () => {
  for (const mode of ["live", "synthetic"]) {
    const dates = dateStorage(); D.createStore(() => dates).write("2026-10-09", "2026-10-15");
    const h = harness(async () => snapshot(A.liveWindow, mode === "synthetic"), mode, "memory", "configurable-v1", dates);
    assert.equal(h.get("availability-ack"), null);
    assert.equal(h.get("availability-start").value, "2026-10-09");
    assert.equal(h.get("availability-end").value, "2026-10-15");
    assert.equal(h.get("availability-load").disabled, false);
    assert.equal(h.get("availability-refresh").disabled, true);
    await h.get("availability-refresh").handlers.click();
    h.documentHandlers.visibilitychange(); h.handlers.pageshow({ persisted: false });
    assert.deepEqual(h.calls, []);
    assert.ok(noWeekView(h));
    await h.load();
    assert.deepEqual(h.calls, ["/api/availability"]);
    assert.deepEqual(h.bodies[0], { acknowledged: true, requestId: "11111111-1111-4111-8111-111111111111", refresh: false,
      startDate: "2026-10-09", endDate: "2026-10-15" });
    assert.equal(h.get("availability-refresh").disabled, false);
    await h.get("availability-refresh").handlers.click();
    assert.equal(h.calls.length, 2);
    assert.deepEqual(h.bodies[1], { ...h.bodies[0], refresh: true });
  }
});

test("explicit Clear before any load empties shared RAM; failed Refresh drops UI data without fallback", async () => {
  const h = harness(async () => ({ status: "cleared", cleanup: "not_requested" }));
  h.get("availability-clear").handlers.click(); assert.deepEqual(h.calls, ["/api/clear"]); assert.deepEqual(h.bodies[0], {});
  let count = 0;
  const loaded = harness(async () => ++count === 1 ? { window: A.window, checkedAt: "2026-09-15T01:00:00Z", synthetic: true, cleanup: "workflow_disabled",
    people: [0, 1].map(person => ({ person, status: "checked", slots: Array(336).fill("busy") })) } : { status: "unavailable", cleanup: "workflow_disabled" });
  await loaded.load(); assert.ok(!noWeekView(loaded));
  await loaded.get("availability-refresh").handlers.click(); assert.ok(noWeekView(loaded));
  assert.equal(loaded.calls.length, 2); assert.equal(loaded.get("availability-refresh").disabled, false);
  await loaded.get("availability-refresh").handlers.click(); assert.equal(loaded.calls.length, 3); // Deliberate retry only.
});

test("disk UI accurately discloses restart retention while memory/old-server mode never claims persistence", () => {
  const disk = harness(() => {}, "live", "disk"), memory = harness(() => {}, "live", "OWNER_CACHE");
  assert.match(disk.get("availability-retention").textContent, /survives closing or restarting the app and changing dates/);
  assert.match(disk.get("availability-retention").textContent, /app must be running/);
  assert.match(disk.get("availability-retention").textContent, /without falling back to older results if it fails/);
  assert.match(disk.get("availability-retention").textContent, /replaced by a successful update, deleted with Clear, or removed because access changed or an update could not finish safely/);
  assert.match(disk.get("availability-storage").textContent, /Parent busy times, their dates and original last-updated time are saved privately on this device/);
  assert.match(disk.get("availability-storage").textContent, /No sign-in credentials or event details are saved/);
  assert.match(disk.get("availability-storage").textContent, /Clear deletes this saved view, not backups, other open pages or Azure history; it is not secure erase/);
  assert.match(disk.get("availability-storage").textContent, /Kimi is never saved in this file/);
  assert.doesNotMatch(disk.get("availability-storage").textContent, /0700|0600|fingerprint|digest/);
  assert.match(memory.get("availability-retention").textContent, /memory only/);
  assert.match(memory.get("availability-retention").textContent, /restarting the app removes it; reloading the page does not/);
  assert.match(memory.get("availability-storage").textContent, /No calendar file or browser storage is used/);
  assert.match(memory.get("availability-storage").textContent, /Sample calendars never use your saved calendar data/);
  for (const h of [disk, memory]) assert.match(h.get("availability-retention").textContent, /Saved views do not recheck Outlook permissions/);
  assert.deepEqual(disk.calls, []); assert.deepEqual(memory.calls, []);
});

test("disk errors hide rows and block reuse without hiding deletion failure behind Azure cleanup", async () => {
  for (const status of ["cache_invalid", "cache_unavailable", "cache_clear_failed"]) {
    const h = harness(async () => ({ status, cleanup: "workflow_disabled", private: "SECRET" }), "live", "disk");
    await h.load(); assert.ok(noWeekView(h));
    assert.match(h.get("availability-status").textContent, /saved view.*Try Clear/);
    assert.doesNotMatch(h.get("availability-status").textContent, /SECRET|Request blocked/);
    assert.equal(h.get("availability-refresh").disabled, true);
    assert.equal(h.focus, h.get("availability-status"));
    await h.load(); assert.equal(h.calls.length, 1);
  }
});

test("Clear only claims file removal after success; deletion failure/transport loss stays visible", async () => {
  for (const outcome of ["cleared", "cache_clear_failed", "transport"]) {
    let release;
    const h = harness(() => new Promise((resolve, reject) => { release = () => outcome === "transport" ? reject(new Error()) : resolve({ status: outcome, cleanup: "not_requested" }); }), "live", "disk");
    h.get("availability-clear").handlers.click();
    assert.equal(h.get("availability-status").textContent, "Clearing saved view…");
    release(); await new Promise(resolve => setImmediate(resolve));
    assert.match(h.get("availability-status").textContent, outcome === "cleared" ? /Saved view cleared/ : /Couldn’t clear the saved view/);
    assert.ok(noWeekView(h));
  }
});

test("simultaneous cache deletion and workflow cleanup failures both remain visible and blocking", async () => {
  const h = harness(async () => ({ status: "cleanup_failed", cleanup: "cleanup_failed", cacheStatus: "cache_clear_failed" }));
  await h.load();
  assert.match(h.get("availability-status").textContent, /Updating paused. Saved view wasn’t cleared. Get help in Details/);
  assert.match(h.get("availability-cleanup").textContent, /Updating paused because the last update could not finish safely/);
  assert.equal(h.get("availability-cleanup").hidden, false);
  assert.equal(h.get("availability-refresh").disabled, true);
});

test("sample source and aliases stay unmistakable beside the grid with no startup API", async () => {
  const fixture = await require("../browser-fixtures/availability").perform({ scenario: "partial", record() {} });
  const h = harness(async () => ({ ...fixture, synthetic: true, cleanup: "workflow_disabled" }));
  assert.deepEqual(h.calls, []);
  assert.equal(h.get("owner-source-badge").textContent, "SAMPLE DATA");
  assert.match(h.get("owner-source-notice").textContent, /Sample data—not real calendars/);
  assert.match(h.get("availability-targets").textContent, /Mike \(sample\).*Debby \(sample\)/);
  assert.match(h.get("availability-grid-source").textContent, /Sample data—not real calendars/);
  assert.match(h.get("availability-grid").attributes["aria-label"], /sample/);
  await h.load();
  assert.equal(h.get("availability-context").children.length, 1);
  assert.match(h.get("availability-context").children[0].textContent, /Debby \(sample\).*schedule isn’t available/);
  const days = h.get("availability-grid").children[0].children.slice(1);
  for (const day of days) {
    assert.deepEqual(day.children[0].children[1].children.map(n => n.textContent), ["Mike (sample)", "Debby (sample)", "Kimi (sample)"]);
    assert.equal(day.children[1].children[1].children.length, 1);
    assert.equal(day.children[1].children[1].children[0].dataset.status, "unknown");
  }
});

test("live page rejects synthetic responses, including cached ones, without rendering sample slots", async () => {
  for (const cached of [true, false]) {
    const fixture = await require("../browser-fixtures/availability").perform({ scenario: "listed", record() {} });
    const h = harness(async () => ({ ...fixture, synthetic: true, cached, cleanup: "workflow_disabled" }), "live");
    assert.equal(h.get("owner-source-badge").textContent, "");
    assert.equal(h.get("owner-source-row").hidden, true);
    await h.load();
    assert.ok(noWeekView(h));
    assert.match(h.get("availability-status").textContent, /Couldn’t load the week/);
    assert.equal(h.get("owner-source-badge").textContent, "");
    assert.equal(h.get("owner-source-row").hidden, true);
    assert.deepEqual(h.calls, ["/api/availability"]);
  }
});

test("all 672 distinct day/person/offset positions round-trip into exact Sunday-week grid rows", async () => {
  const statuses = Object.keys(A.labels);
  const people = [0, 1].map(person => ({ person, status: "partial", slots: Array.from({ length: 336 }, (_, i) =>
    statuses[(Math.floor(i / 48) * 3 + person * 2 + i % 48) % statuses.length]) }));
  const h = harness(async () => ({ window: A.window, checkedAt: "2026-09-15T01:00:00Z", people, synthetic: true, cleanup: "workflow_disabled" }));
  await h.load();
  const seen = new Set();
  for (let page = 0; page < 3; page++) {
    const days = h.get("availability-grid").children[0].children.slice(1);
    days.forEach(day => day.children[1].children.slice(0, 2).forEach((track, person) => {
      const date = day.attributes["aria-label"].slice(0, 10), index = Number(date.slice(-2)) - 20;
      const reconstructed = []; seen.add(`${date}-${person}`);
      for (const block of track.children) {
        const [start, end] = block.style.gridRow.split(" / ").map(Number);
        for (let row = start; row < end; row++) reconstructed[row - 1] = block.dataset.status;
        assert.match(block.title, new RegExp(`2026-09-${20 + index}`));
      }
      assert.deepEqual(reconstructed, people[person].slots.slice(index * 48, (index + 1) * 48));
    }));
    await h.get("availability-display-next").handlers.click();
  }
  assert.equal(seen.size, 14); assert.equal(h.calls.length, 1);
  assert.equal(A.slotTime(0).utc, "2026-09-19T16:00:00.000Z");
  assert.equal(A.slotTime(336).utc, "2026-09-26T16:00:00.000Z");
});

// Explicit UTC expectations avoid deriving the test oracle from dateRange itself.
const validRanges = [
  { start: "2026-09-20", end: "2026-09-26", days: 7, utcStart: "2026-09-19T16:00:00Z", utcEnd: "2026-09-26T16:00:00Z", exclusive: "2026-09-27" },
  { start: "2028-02-29", end: "2028-02-29", days: 1, utcStart: "2028-02-28T16:00:00Z", utcEnd: "2028-02-29T16:00:00Z", exclusive: "2028-03-01" },
  { start: "2026-09-30", end: "2026-10-01", days: 2, utcStart: "2026-09-29T16:00:00Z", utcEnd: "2026-10-01T16:00:00Z", exclusive: "2026-10-02" },
  { start: "2026-12-31", end: "2027-01-01", days: 2, utcStart: "2026-12-30T16:00:00Z", utcEnd: "2027-01-01T16:00:00Z", exclusive: "2027-01-02" },
  { start: "2028-02-28", end: "2028-02-29", days: 2, utcStart: "2028-02-27T16:00:00Z", utcEnd: "2028-02-29T16:00:00Z", exclusive: "2028-03-01" },
  { start: "2026-09-28", end: "2026-10-04", days: 7, utcStart: "2026-09-27T16:00:00Z", utcEnd: "2026-10-04T16:00:00Z", exclusive: "2026-10-05" },
  { start: "2026-12-28", end: "2027-01-03", days: 7, utcStart: "2026-12-27T16:00:00Z", utcEnd: "2027-01-03T16:00:00Z", exclusive: "2027-01-04" },
  { start: "2028-02-26", end: "2028-03-03", days: 7, utcStart: "2028-02-25T16:00:00Z", utcEnd: "2028-03-03T16:00:00Z", exclusive: "2028-03-04" },
  { start: "2000-01-01", end: "2000-01-01", days: 1, utcStart: "1999-12-31T16:00:00Z", utcEnd: "2000-01-01T16:00:00Z", exclusive: "2000-01-02" },
  { start: "2100-12-31", end: "2100-12-31", days: 1, utcStart: "2100-12-30T16:00:00Z", utcEnd: "2100-12-31T16:00:00Z", exclusive: "2101-01-01" }
];
for (const range of validRanges) test(`Confirm loads ${range.days} inclusive Taipei day(s): ${range.start} through ${range.end}`, async () => {
  const expected = { start: range.utcStart, end: range.utcEnd, timezone: "Asia/Taipei", interval: 30, slots: range.days * 48 };
  assert.deepEqual(A.dateRange(range.start, range.end), expected);
  assert.equal(A.validateWindow(expected), true);
  assert.equal(Date.parse(expected.end) - Date.parse(expected.start), range.days * 86400000);
  const data = snapshot(expected);
  // Distinguish every offset/person/day rather than just counting columns.
  data.people.forEach(p => { p.slots = Array.from({ length: expected.slots }, (_, i) => Object.keys(A.labels)[(i + p.person) % 5]); });
  const h = harness(async () => data);
  await h.range(range.start, range.end);
  assert.deepEqual(h.calls, []);
  assert.ok(noWeekView(h, range.days));
  assert.equal(h.get("availability-refresh").disabled, true);
  await h.get("availability-refresh").handlers.click();
  assert.deepEqual(h.calls, []);
  assert.equal(h.get("availability-load").disabled, false);
  assert.equal(h.get("availability-date-error").hidden, true);
  assert.equal(h.get("availability-start").attributes["aria-invalid"], "false");
  assert.equal(h.get("availability-end").attributes["aria-invalid"], "false");
  assert.equal(h.get("availability-window").textContent,
    `Calendar load window: ${range.start} 00:00 through ${range.exclusive} 00:00 (end exclusive) · Asia/Taipei (UTC+8). All ${expected.slots} half-hour slots per parent, ${expected.slots * 2} total across the two parent calendars only. Only returned statuses are checked; missing data is unknown. Kimi is saved-view only.`);
  const labelBeforeLoad = h.get("availability-display-label").textContent;
  assert.ok(labelBeforeLoad.includes(range.start.slice(0, 4)));
  if (range.days <= 3 && range.start.slice(0, 4) !== range.end.slice(0, 4)) assert.ok(labelBeforeLoad.includes(range.end.slice(0, 4)));
  if (range.start !== "2026-09-20") assert.notEqual(labelBeforeLoad, "20–26 September 2026");
  await h.load();
  assert.deepEqual(h.calls, ["/api/availability"]);
  assert.deepEqual(h.bodies[0], { acknowledged: true, requestId: "11111111-1111-4111-8111-111111111111", refresh: false, startDate: range.start, endDate: range.end });
  assert.equal(h.requests[0].method, "POST");
  assert.equal(h.requests[0].headers["X-Owner-CSRF"], "synthetic-csrf");
  assert.equal(h.requests[0].cache, "no-store");
  assert.equal(h.requests[0].credentials, "omit");
  assert.equal(h.requests[0].redirect, "error");
  assert.equal(h.get("availability-display-label").textContent, labelBeforeLoad);
  assert.equal(h.get("availability-grid").attributes["aria-label"], `Weekly calendar, ${labelBeforeLoad.slice(9).split(" · ")[0]}, Mike (sample) and Debby (sample) and Kimi (sample), Asia/Taipei`);
  const week = h.get("availability-grid").children[0];
  const displayedDays = Math.min(3, range.days);
  assert.equal(week.style.gridTemplateColumns, `56px repeat(${displayedDays},minmax(264px,1fr))`);
  assert.equal(week.style.minWidth, `${56 + displayedDays * 264}px`);
  assert.equal(week.children.length, displayedDays + 1);
  week.children.slice(1).forEach((day, dayIndex) => {
    const date = new Date(Date.parse(`${range.start}T00:00:00Z`) + dayIndex * 86400000).toISOString().slice(0, 10);
    assert.equal(day.attributes["aria-label"], `${date} · Asia/Taipei (UTC+8)`);
    assert.equal(day.children[1].children.length, 3);
    day.children[1].children.slice(0, 2).forEach((track, person) => {
      const reconstructed = [];
      for (const block of track.children) {
        const [start, end] = block.style.gridRow.split(" / ").map(Number);
        for (let row = start; row < end; row++) reconstructed[row - 1] = block.dataset.status;
        assert.ok(block.title.startsWith(`${date} · `));
        assert.equal(block.attributes["aria-label"], block.title);
      }
      assert.deepEqual(reconstructed, data.people[person].slots.slice(dayIndex * 48, (dayIndex + 1) * 48));
      assert.match(track.children[0].title, /00:00–00:30/);
      assert.match(track.children.at(-1).title, /23:30–24:00/);
    });
  });
  assert.equal(h.focus, h.get("availability-grid"));
  await h.get("availability-refresh").handlers.click();
  assert.deepEqual(h.calls, ["/api/availability", "/api/availability"]);
  assert.deepEqual(h.bodies[1], { ...h.bodies[0], refresh: true });
});

const invalidRanges = [
  ["", "2026-09-26"], ["2026-09-20", ""], ["", ""],
  ["2026-09-21", "2026-09-20"], ["2026-09-20", "2026-09-27"],
  ["2026-12-28", "2027-01-04"], ["2028-02-26", "2028-03-04"],
  ["2026-02-29", "2026-03-01"], ["2100-02-29", "2100-03-01"],
  ["2026-04-30", "2026-04-31"], ["2026-13-01", "2026-13-02"],
  ["2026-09-00", "2026-09-01"], ["1999-12-31", "2000-01-01"],
  ["2101-01-01", "2101-01-01"], ["2026-9-20", "2026-09-26"],
  ["2026-09-20T00:00:00Z", "2026-09-26"], ["<script>", "2026-09-26"]
];
for (const [start, end] of invalidRanges) test(`invalid range ${JSON.stringify([start, end])} prevents any request`, async () => {
  assert.throws(() => A.dateRange(start, end), /invalid_date_range/);
  const h = harness(() => { throw new Error("No request expected"); });
  await h.range(start, end);
  for (const id of ["availability-load", "availability-refresh"]) {
    assert.equal(h.get(id).disabled, true);
    await h.get(id).handlers.click(); // Guard even programmatic invocations.
  }
  assert.deepEqual(h.calls, []);
  assert.equal(h.get("availability-grid").children.length, 0);
  assert.equal(h.get("availability-display-label").textContent, "No valid display dates.");
  assert.equal(h.get("availability-window").textContent, "No valid date range selected. Nothing checked.");
  assert.equal(h.get("availability-date-error").hidden, false);
  assert.match(h.get("availability-date-error").textContent, /1–7 days inclusive/);
  for (const id of ["availability-start", "availability-end"]) assert.equal(h.get(id).attributes["aria-invalid"], "true");
  assert.doesNotMatch(h.get("availability-date-error").textContent, /script/);
  await h.range("2026-09-20", "2026-09-26");
  assert.equal(h.get("availability-load").disabled, false);
  assert.equal(h.get("availability-refresh").disabled, true);
  assert.equal(h.get("availability-date-error").hidden, true);
  assert.deepEqual(h.calls, []); // Correcting a date is not confirmation.
});

test("editing either date after load synchronously hides old rows and clears once before reconfirmation", async () => {
  for (const [id, value, dayCount] of [["availability-start", "2026-09-21", 6], ["availability-end", "2026-09-21", 2]]) {
    const cleanup = deferred();
    const h = harness((path, options) => path === "/api/clear" ? cleanup.promise :
      snapshot(A.dateRange(JSON.parse(options.body).startDate, JSON.parse(options.body).endDate)));
    await h.load();
    assert.ok(blocks(h).some(n => n.dataset.status === "busy"));
    h.get(id).focus();
    const edit = h.input(id, value);
    // Old data is synchronously fenced. Keep transport open until the backend
    // confirms cancellation so its disconnect guard cannot revoke this session.
    assert.ok(noWeekView(h, dayCount));
    assert.equal(h.requests[0].signal.aborted, false);
    assert.equal(h.focus, h.get(id));
    assert.equal(h.get("availability-context").hidden, true);
    assert.doesNotMatch(h.get("availability-status").textContent, /Updated|Saved view/);
    assert.match(h.get("availability-freshness").textContent, /No snapshot loaded/);
    assert.deepEqual(h.calls, ["/api/availability", "/api/clear"]);
    assert.deepEqual(h.bodies[1], { reason: "range" });
    for (const action of ["availability-load", "availability-refresh", "availability-clear"]) assert.equal(h.get(action).disabled, true);
    await h.load(); await h.get("availability-refresh").handlers.click();
    assert.equal(h.calls.length, 2);
    cleanup.resolve({ status: "cleared", cleanup: "workflow_disabled" }); await edit;
    assert.equal(h.requests[0].signal.aborted, true);
    assert.equal(h.get("availability-load").disabled, false);
    assert.equal(h.get("availability-refresh").disabled, true);
    h.documentHandlers.visibilitychange();
    assert.equal(h.calls.length, 2);
    assert.equal(h.focus, h.get(id));
    await h.load();
    assert.deepEqual(h.calls, ["/api/availability", "/api/clear", "/api/availability"]);
    assert.equal(h.bodies[2].acknowledged, true);
    assert.equal(h.bodies[2].refresh, false);
    assert.equal(h.bodies[2].startDate, h.get("availability-start").value);
    assert.equal(h.bodies[2].endDate, h.get("availability-end").value);
  }
});

test("empty input after loading removes rows immediately and cannot skip range cleanup on correction", async () => {
  const cleanup = deferred();
  const h = harness(path => path === "/api/clear" ? cleanup.promise : snapshot());
  await h.load();
  const edit = h.input("availability-start", "");
  assert.equal(h.get("availability-grid").children.length, 0);
  assert.equal(h.requests[0].signal.aborted, false);
  assert.deepEqual(h.bodies.at(-1), { reason: "range" });
  await h.range("2026-12-31", "2027-01-01");
  assert.ok(noWeekView(h, 2));
  assert.equal(h.get("availability-load").disabled, true);
  await h.load(); assert.equal(h.calls.length, 2);
  cleanup.resolve({ status: "cleared", cleanup: "workflow_disabled" }); await edit;
  assert.equal(h.get("availability-load").disabled, false);
  assert.equal(h.get("availability-refresh").disabled, true);
  assert.equal(h.calls.length, 2);
});

for (const timing of ["during cleanup", "after new confirmation"]) test(`pending range edits fence delayed old responses ${timing}`, async () => {
  for (const outcome of ["success", "cleanup_failed", "transport"]) {
    const old = deferred(), cleanup = deferred();
    let availabilityCalls = 0;
    const h = harness((path, options) => {
      if (path === "/api/clear") return cleanup.promise;
      if (++availabilityCalls === 1) return old.promise;
      const body = JSON.parse(options.body);
      const data = snapshot(A.dateRange(body.startDate, body.endDate));
      data.people.forEach(p => p.slots.fill("tentative"));
      return data;
    });
    const first = h.load();
    assert.equal(h.focus, h.get("availability-clear"));
    await h.load(); await h.get("availability-refresh").handlers.click();
    assert.equal(availabilityCalls, 1); // Double clicks cannot duplicate a pending request.
    h.get("availability-end").focus();
    const edit = h.range("2026-12-31", "2027-01-01");
    assert.equal(h.requests[0].signal.aborted, false);
    await h.range("2028-02-29", "2028-02-29"); // New input while cleanup is pending.
    assert.ok(noWeekView(h, 1));
    assert.deepEqual(h.calls, ["/api/availability", "/api/clear"]);
    await h.load(); assert.equal(availabilityCalls, 1);
    const finishOld = () => outcome === "transport" ? old.reject(new Error("PRIVATE")) :
      old.resolve(outcome === "success" ? snapshot() : { status: "cleanup_failed", cleanup: "cleanup_failed" });
    if (timing === "during cleanup") {
      finishOld(); await first;
      assert.ok(noWeekView(h, 1));
      assert.equal(h.focus, h.get("availability-end"));
      assert.equal(h.get("availability-load").disabled, true);
      assert.doesNotMatch(h.get("availability-status").textContent, /Updated|paused|PRIVATE/);
    }
    cleanup.resolve({ status: "cleared", cleanup: "workflow_disabled" }); await edit;
    assert.equal(h.get("availability-refresh").disabled, true);
    assert.equal(availabilityCalls, 1);
    await h.load();
    const newStatus = h.get("availability-status").textContent;
    if (timing === "after new confirmation") { finishOld(); await first; }
    assert.equal(h.get("availability-status").textContent, newStatus);
    assert.equal(h.get("availability-refresh").disabled, false);
    assert.equal(blocks(h).length, 2);
    assert.ok(blocks(h).every(n => n.dataset.status === "tentative" && n.title.startsWith("2028-02-29")));
    assert.match(h.get("availability-display-label").textContent, /29 February 2028/);
    assert.deepEqual(h.bodies[2], { ...h.bodies[0], startDate: "2028-02-29", endDate: "2028-02-29" });
    assert.equal(h.calls.length, 3);
  }
});

test("range cleanup failures block confirmation and Update across further edits and later idle status", async () => {
  for (const outcome of ["cache_clear_failed", "cleanup_failed", "transport", "unconfirmed", "session_unavailable"]) {
    const h = harness(path => {
      if (path === "/api/availability") return snapshot();
      if (path === "/api/status") return { status: "idle", cleanup: "workflow_disabled" };
      if (outcome === "transport") throw new Error("PRIVATE");
      return outcome === "session_unavailable" ? { status: "blocked", reason: outcome } :
        { status: outcome === "unconfirmed" ? "unavailable" : outcome, cleanup: outcome === "cleanup_failed" ? outcome : "not_requested" };
    });
    await h.load(); await h.range("2028-02-29", "2028-02-29");
    assert.ok(noWeekView(h, 1));
    assert.equal(h.get("availability-status").dataset.urgent, "true");
    assert.match(h.get("availability-status").textContent, outcome === "cleanup_failed" ? /Updating paused/ :
      outcome === "session_unavailable" ? /Page expired/ : /saved view.*Try Clear/);
    await h.range("2026-12-31", "2027-01-01");
    await h.get("availability-check").handlers.click();
    for (const id of ["availability-load", "availability-refresh"]) {
      assert.equal(h.get(id).disabled, true, outcome);
      await h.get(id).handlers.click();
    }
    assert.deepEqual(h.calls, ["/api/availability", "/api/clear", "/api/status"]);
    assert.ok(noWeekView(h, 2));
    assert.doesNotMatch(h.get("availability-status").textContent, /PRIVATE/);
  }
});

for (const marker of [null, "OWNER_RANGE", "configurable-v0"]) test(`unsupported owner-range marker ${marker} never loads calendars`, async () => {
  for (const mode of ["live", "synthetic"]) {
    const h = harness(() => { throw new Error("No request expected"); }, mode, "memory", marker);
    assert.equal(h.get("availability-range-support").textContent, "Calendar access needs an update. Ask the person who set up this page for help, then reload. Nothing will load here yet.");
    assert.deepEqual(h.calls, []);
    await h.range("2028-02-29", "2028-02-29");
    for (const id of ["availability-load", "availability-refresh"]) {
      assert.equal(h.get(id).disabled, true);
      await h.get(id).handlers.click();
    }
    h.documentHandlers.visibilitychange(); h.handlers.pagehide(); h.handlers.pageshow({ persisted: true });
    await settle();
    assert.deepEqual(h.calls, []);
    assert.ok(noWeekView(h, 1));
    assert.equal(h.get("owner-source-badge").textContent, mode === "synthetic" ? "SAMPLE DATA" : "");
    assert.equal(h.get("owner-source-row").hidden, mode !== "synthetic");
  }
});

for (const action of ["availability-check", "availability-clear"]) test(`old server blocks ${action} too without API requests`, async () => {
  const h = harness(async () => ({ status: "cleared", cleanup: "not_requested" }), "live", "memory", null);
  await h.get(action).handlers.click(); await settle();
  assert.deepEqual(h.calls, [], "An unsupported server must not receive even cleanup/status requests from the new page");
});

test("unsupported live dates are blocked before all API calls, with explicit date-only recovery", async () => {
  const h = harness(async () => ({ status: "range_unavailable", cleanup: "not_requested" }), "live", "disk");
  assert.equal(h.get("availability-range-support").textContent, "Calendars are available for 9–15 October 2026. Other dates still work for Activities.");
  await h.range("2026-12-31", "2027-01-01");
  assert.deepEqual(h.calls, []);
  await h.load();
  assert.deepEqual(h.calls, []);
  assert.match(h.get("availability-status").textContent, /9–15 October 2026 only.*Nothing loaded/);
  assert.equal(h.get("availability-supported-dates").hidden, false);
  assert.equal(h.get("availability-load").disabled, true);
  assert.equal(h.get("availability-saved").disabled, true);
  assert.ok(noWeekView(h, 2));
  h.documentHandlers.visibilitychange(); await h.load();
  assert.equal(h.calls.length, 0);
  await h.get("availability-supported-dates").handlers.click();
  assert.match(h.get("availability-display-label").textContent, /9–11 October 2026/);
  assert.equal(h.focus, h.get("availability-load"));
  assert.equal(h.get("availability-saved").disabled, false);
  assert.ok(noWeekView(h)); assert.deepEqual(h.calls, []);
});

test("saved-only confirms exact dates without a provider fallback, preserving stale and partial labels", async () => {
  const data = snapshot(A.liveWindow, false); data.cached = true;
  data.people[1] = A.unknown(1, "unavailable");
  data.checkedAt = "2026-09-15T01:00:00Z";
  const h = harness(async (path, options) => {
    if (path === "/api/clear") return { status: "cleared", cleanup: "workflow_disabled" };
    assert.equal(JSON.parse(options.body).cacheOnly, true);
    assert.equal(JSON.parse(options.body).refresh, false);
    return data;
  }, "live", "disk");
  assert.deepEqual(h.calls, []);
  await h.get("availability-saved").handlers.click();
  assert.match(h.get("availability-status").textContent, /Updated 15 Sept 2026, 09:00.*May be out of date/);
  assert.match(h.get("availability-context").children[0].textContent, /Debby.*isn’t available/);
  await h.range("2026-09-20", "2026-09-26");
  assert.ok(noWeekView(h));
  await h.load(); await h.get("availability-saved").handlers.click();
  assert.deepEqual(h.calls, ["/api/availability", "/api/clear"]);
  await h.get("availability-supported-dates").handlers.click();
  await h.get("availability-saved").handlers.click();
  assert.match(h.get("availability-status").textContent, /Updated 15 Sept 2026, 09:00/);
  assert.equal(h.calls.filter(p => p === "/api/availability").length, 2);
});

test("saved-only miss and invalid responses never display invented data or auto-query", async () => {
  for (const response of [{ status: "cache_missing", cleanup: "not_requested" }, snapshot(A.window, false)]) {
    const h = harness(async () => response, "live", "disk");
    await h.get("availability-saved").handlers.click();
    assert.ok(noWeekView(h)); assert.deepEqual(h.calls, ["/api/availability"]);
    if (response.status === "cache_missing") {
      assert.match(h.get("availability-status").textContent, /No saved view exists.*No calendars queried/);
      assert.equal(h.get("availability-load").disabled, false);
      assert.equal(h.get("availability-refresh").disabled, true);
    }
  }
});

test("obsolete saved-view protocol blocks all APIs including destructive range changes", async () => {
  const h = harness(async () => { throw new Error("No calls allowed"); }, "live", "disk", "configurable-v1", dateStorage(), null);
  await h.range("2026-10-09", "2026-10-15");
  for (const id of ["availability-load", "availability-refresh", "availability-clear", "availability-check", "availability-saved"])
    await h.get(id).handlers.click();
  assert.deepEqual(h.calls, []);
  assert.match(h.get("availability-range-support").textContent, /Calendar access needs an update.*help, then reload.*Nothing will load here yet/);
});

test("changed-window partial responses keep missing slots and people unknown at the exact selected length", async () => {
  const window = A.dateRange("2026-12-31", "2027-01-01");
  for (const second of ["missing", "unavailable", "wrong length"]) {
    const data = snapshot(window);
    data.people[0] = { person: 0, status: "partial", slots: Array(96).fill("unknown") };
    data.people[0].slots[0] = "busy"; data.people[0].slots[95] = "tentative";
    data.people = [data.people[0], ...(second === "missing" ? [] : [{ person: 1, status: second === "unavailable" ? "unavailable" : "checked", slots: Array(second === "wrong length" ? 336 : 96).fill("free_or_elsewhere") }])];
    const h = harness(async () => data);
    await h.range("2026-12-31", "2027-01-01"); await h.load();
    const days = h.get("availability-grid").children[0].children.slice(1);
    assert.equal(days.length, 2);
    days.forEach(day => {
      const missing = day.children[1].children[1].children;
      assert.equal(missing.length, 1);
      assert.equal(missing[0].dataset.status, "unknown");
      assert.equal(missing[0].style.gridRow, "1 / 49");
    });
    assert.equal(days[0].children[1].children[0].children[0].style.gridRow, "1 / 2");
    assert.equal(days[1].children[1].children[0].children.at(-1).style.gridRow, "48 / 49");
    assert.equal(h.get("availability-context").children.length, 2);
    assert.match(h.get("availability-context").children[0].textContent, /Some of this schedule is unknown/);
    assert.match(h.get("availability-context").children[1].textContent, /schedule isn’t available/);
    assert.ok(blocks(h).every(n => n.dataset.status !== "free_or_elsewhere"));
    assert.match(h.get("availability-window").textContent, /All 96 half-hour slots per parent, 192 total across the two parent calendars only/);
  }
});

test("wrong-window responses including same-length shifted and extra-key windows fail closed", async () => {
  const selected = A.dateRange("2026-12-31", "2027-01-01");
  for (const window of [A.window, A.dateRange("2027-01-01", "2027-01-02"), { ...selected, timezone: "UTC" }, { ...selected, extra: "PRIVATE" }]) {
    for (const cached of [false, true]) {
      const h = harness(async () => ({ ...snapshot(window), cached }));
      await h.range("2026-12-31", "2027-01-01"); await h.load();
      assert.ok(noWeekView(h, 2));
      assert.equal(h.calls.length, 1);
      assert.match(h.get("availability-status").textContent, /Couldn’t load the week/);
      assert.doesNotMatch(h.get("availability-status").textContent, /Updated|PRIVATE/);
      assert.equal(h.focus, h.get("availability-status"));
    }
  }
});

test("synthetic pages reject live or missing mode markers, cached or fresh, rather than relabel real data", async () => {
  for (const synthetic of [false, undefined]) for (const cached of [false, true]) {
    const h = harness(async () => ({ ...snapshot(), synthetic, cached }));
    await h.load();
    assert.ok(noWeekView(h));
    assert.match(h.get("availability-status").textContent, /Couldn’t load the week/);
    assert.equal(h.calls.length, 1);
  }
});

test("malicious slot strings and extra provider details never become DOM content", async () => {
  const window = A.dateRange("2028-02-29", "2028-02-29"), data = snapshot(window);
  data.people[0].slots[0] = "<img src=x onerror=PRIVATE()>";
  data.people[0].slots[1] = "__proto__";
  data.people[0].subject = "PRIVATE alex@example.test";
  data.people[1].status = "<script>PRIVATE</script>";
  data.location = "PRIVATE";
  const h = harness(async () => data);
  await h.range("2028-02-29", "2028-02-29"); await h.load();
  assert.equal(h.get("availability-diagnostic"), null);
  const visible = ["availability-grid", "availability-context", "availability-status", "availability-cleanup"]
    .flatMap(id => descendants(h.get(id))).map(n => [n.textContent, n.title, ...Object.values(n.attributes)].join(" ")).join(" ");
  assert.doesNotMatch(visible, /PRIVATE|<img|<script|__proto__|alex@/);
  assert.equal(blocks(h)[0].dataset.status, "unknown");
  assert.equal(blocks(h)[0].style.gridRow, "1 / 3");
  assert.ok(blocks(h).some(n => n.dataset.status === "busy"));
  assert.equal(h.get("availability-context").children.length, 2);
});

test("malformed JSON and byte-oversized multibyte responses hide data without retries", async () => {
  const multibyte = JSON.stringify({ padding: "☀".repeat(Math.floor(A.responseLimit / 2)) });
  assert.ok(multibyte.length < A.responseLimit);
  assert.ok(new TextEncoder().encode(multibyte).length > A.responseLimit);
  for (const response of ["{PRIVATE", multibyte]) {
    const h = harness(async () => response);
    await h.load();
    assert.ok(noWeekView(h));
    assert.equal(h.calls.length, 1);
    assert.match(h.get("availability-status").textContent, /Couldn’t load the week/);
    assert.doesNotMatch(h.get("availability-status").textContent, /PRIVATE|☀/);
    assert.equal(h.focus, h.get("availability-status"));
  }
});

test("external shared clear and page exit abort pending work without late rows or focus theft", async () => {
  for (const external of [false, true]) {
    const old = deferred();
    const h = harness(path => path === "/api/availability" ? old.promise : { status: "cleared", cleanup: "workflow_disabled" });
    const load = h.load();
    h.get("availability-end").focus();
    if (external) h.handlers["owner-session-cleared"]({ detail: { source: "calendars", leaving: false } });
    else h.handlers.pagehide();
    assert.equal(h.requests[0].signal.aborted, true);
    assert.ok(noWeekView(h));
    assert.equal(h.focus, h.get("availability-end"));
    old.resolve(snapshot()); await load; await settle();
    assert.ok(noWeekView(h));
    assert.equal(h.get("availability-refresh").disabled, true);
    assert.equal(h.focus, h.get("availability-end"));
    assert.deepEqual(h.calls, external ? ["/api/availability"] : ["/api/availability", "/api/clear"]);
    if (!external) { assert.deepEqual(h.bodies[1], { reason: "leave" }); assert.equal(h.requests[1].keepalive, true); }
  }
});

test("missing, old or unresolved October contract marker blocks every API despite current static assets", async () => {
  for (const contract of [null, "OWNER_CONTRACT", "bounded-availability-v4"]) {
    const h = harness(() => { throw Error("No API permitted"); }, "live", "disk", "configurable-v1", dateStorage(), "preserve-v1", contract);
    assert.equal(h.get("availability-display-label").textContent, "No valid display dates.");
    assert.equal(h.get("availability-load").disabled, true);
    for (const id of ["availability-load", "availability-refresh", "availability-saved", "availability-clear", "availability-check"]) await h.get(id).handlers.click();
    assert.deepEqual(h.calls, []); assert.match(h.get("availability-range-support").textContent, /Calendar access needs an update.*help, then reload.*Nothing will load here yet/);
  }
});