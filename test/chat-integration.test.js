"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm");
const { mountChat } = require("../chat/ui");
const Contract = require("../shared/chat-contract");
const { harness: calendarHarness, settle, deferred, text: calendarText } = require("./fixtures/our-week-harness");
const flush = () => new Promise(resolve => setImmediate(resolve));
const descendants = element => [element, ...element.children.flatMap(descendants)];
const tags = (element, tag) => descendants(element).filter(node => node.tag === tag);
const text = element => descendants(element).map(node => node.textContent).join(" ");
function sendGreeting(setup) {
  setup.get("chat-input").value = "Hello";
  setup.get("chat-composer").fire("submit");
}
async function sendPageGreeting(page) {
  page.get("chat-input").value = "Hello";
  await page.get("chat-composer").dispatchEvent({ type: "submit", preventDefault() {} });
}
function harness({ components = true, failCleanup = false, browser = false, holdResults = false, geometry = false, controlledTimers = false, calendarMethods = {} } = {}) {
  const nodes = new Map(), calls = [], counts = { mount: 0, dispose: 0, rendered: 0, removed: 0 };
  const timers = new Map(); let timerSequence = 0;
  class Element {
    constructor(tag, document) {
      this.tag = tag; this.ownerDocument = document; this.attributes = {};
      this.children = []; this.handlers = new Map(); this.value = ""; this.textContent = ""; this.disabled = false; this.hidden = false;
    }
    addEventListener(name, callback) { this.handlers.set(name, callback); }
    removeEventListener(name) { this.handlers.delete(name); }
    fire(name, event = {}) { this.handlers.get(name)?.({ preventDefault() {}, ...event }); }
    append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
    replaceChildren(...children) { this.children.forEach(child => { child.parent = null; }); this.children = []; this.append(...children); }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
    setAttribute(name, value) { this.attributes[name] = value; }
    focus() { this.focused = true; }
    set innerHTML(value) { throw Error("html_sink_forbidden"); }
  }
  const get = id => { if (!nodes.has(id)) nodes.set(id, new Element("div", document)); return nodes.get(id); };
  const document = { getElementById: get, createElement: tag => new Element(tag, document) }, lifecycle = new Element();
  const properties = new Map(); let measure, disconnected = 0, composerHeight = 150;
  if (geometry) {
    get("chat-page").style = { setProperty: (key, value) => properties.set(key, value) };
    get("chat-composer").getBoundingClientRect = () => ({ height: composerHeight });
    lifecycle.innerHeight = 810;
    lifecycle.visualViewport = Object.assign(new Element(), { height: 810, offsetTop: 0 });
    lifecycle.ResizeObserver = class {
      constructor(callback) { measure = callback; }
      observe(target, options) {
        assert.equal(target, get("chat-composer"));
        assert.deepEqual(options, { box: "border-box" });
      }
      disconnect() { disconnected++; }
    };
  }
  const host = get("calendar-host");
  for (const key of ["children", "innerHTML", "textContent"]) Object.defineProperty(host, key, { get() { throw Error("calendar_data_read"); } });
  const calendar = { mountCalendar(received, options) {
    assert.equal(received, host); assert.equal(Contract.validateCalendarMountOptions(options), true); counts.mount++;
    return Object.freeze({ expand() {}, collapse() {}, dispose() { counts.dispose++; return failCleanup ? Promise.reject(Error("private details")) : Promise.resolve(); }, ...calendarMethods });
  } };
  const activities = {
    searchActivities(request, { signal }) {
      assert.equal(Contract.validateActivityRequest(request), true);
      return new Promise((resolve, reject) => calls.push({ request, signal, resolve, reject }));
    },
    renderActivityCards(received, result) {
      assert.equal(received, get("activity-results")); assert.equal(Contract.validateActivityResultShape(result), true);
      counts.rendered++; return { dispose() { counts.removed++; } };
    }
  };
  const options = { lifecycle, ...(components ? { calendar, activities } : {}) };
  let controller;
  if (browser) {
    const forbidden = () => { throw Error("forbidden_side_effect"); };
    const context = vm.createContext({ document, AbortController, AbortSignal, structuredClone, URL, setTimeout, clearTimeout,
      ...(controlledTimers ? {
        setTimeout(callback, delay) { timers.set(++timerSequence, { callback, delay }); return timerSequence; },
        clearTimeout(id) { timers.delete(id); }
      } : {}),
      addEventListener: lifecycle.addEventListener.bind(lifecycle), removeEventListener: lifecycle.removeEventListener.bind(lifecycle),
      ...(components ? { FamilyChatCalendar: calendar } : {}) });
    for (const name of ["fetch", "XMLHttpRequest", "WebSocket", "localStorage", "sessionStorage", "FamilyDates", "MutationObserver"]) {
      Object.defineProperty(context, name, { get: forbidden });
    }
    const html = fs.readFileSync(require.resolve("../chat/index.html"), "utf8");
    for (const [, script] of html.matchAll(/<script defer src="([^"]+)"/g)) {
      if (script.startsWith("../owner/") || script === "../shared/date-selection.js") continue;
      if (script === "ui.js") {
        const realActivities = context.FamilyChatActivities;
        assert.deepEqual(Object.keys(realActivities).sort(), ["renderActivityCards", "searchActivities"]);
        context.FamilyChatActivities = Object.freeze({
          searchActivities(request, options) {
            assert.equal(Contract.validateActivityRequest(request), true);
            const call = { request: structuredClone(request), signal: options.signal };
            calls.push(call);
            const work = realActivities.searchActivities(request, options);
            if (holdResults) return new Promise((resolve, reject) => {
              work.then(value => { call.result = value; call.release = () => resolve(value); }, reject);
            });
            return work;
          },
          renderActivityCards(host, result) {
            counts.rendered++;
            const renderer = realActivities.renderActivityCards(host, result);
            return { dispose() { counts.removed++; renderer.dispose(); } };
          }
        });
      }
      const filename = require("node:path").resolve(__dirname, "../chat", script);
      vm.runInContext(fs.readFileSync(filename, "utf8"), context, { filename });
    }
    controller = context.FamilyChatUI.mountChat(document);
  } else controller = mountChat(document, options);
  function complete(index) {
    const { request, resolve } = calls[index];
    resolve({ version: request.version, requestId: request.requestId, generation: request.generation,
      contextRevision: request.contextRevision, mode: "synthetic", range: request.range, status: "empty",
      sources: [{ sourceId: "test", name: "Synthetic", url: null, kind: "synthetic", freshness: "synthetic", retrievedAt: null,
        coverage: { range: request.range, categories: [], completeness: "complete" } }], items: [],
      issues: [{ code: "no_matches", sourceId: null, message: "No matches." }], calendarFit: "not_checked" });
  }
  return { get, lifecycle, controller, counts, calls, complete, document, options, properties, timers,
    resizeComposer(height) { composerHeight = height; measure(); }, get disconnected() { return disconnected; } };
}
test("composer exposes processing without Stop and clears it on reset, failure and completion", async () => {
  const setup = harness();
  const { get, calls, controller } = setup;
  assert.equal(get("chat-input").placeholder, "Message Family Copilot...");
  assert.equal(get("chat-input").value, "");
  assert.equal(get("chat-page").attributes["data-processing"], "false");
  sendGreeting(setup);
  assert.equal(get("chat-input").placeholder, "Message Family Copilot...");
  assert.equal(get("chat-page").attributes["data-processing"], "true");
  assert.equal(get("activity-results").attributes["aria-busy"], "true");
  assert.equal(get("chat-status").textContent, "Finding activities that match your family's interests...");
  assert.equal(get("chat-status").hidden, false);
  assert.equal(get("chat-send").disabled, true);
  sendGreeting(setup);
  assert.equal(calls.length, 1);
  get("chat-reset").fire("click");
  assert.equal(get("chat-input").placeholder, "Message Family Copilot...");
  assert.equal(calls[0].signal.aborted, true);
  assert.equal(get("chat-page").attributes["data-processing"], "false");
  setup.complete(0); await flush();
  assert.equal(setup.counts.rendered, 0);
  get("chat-input").value = "Continue"; get("chat-composer").fire("submit");
  assert.equal(calls.length, 2);
  calls[1].reject(Error("offline failure")); await flush();
  assert.equal(get("chat-input").placeholder, "Message Family Copilot...");
  assert.equal(get("chat-page").attributes["data-processing"], "false");
  assert.equal(get("chat-retry").hidden, false);
  get("chat-retry").fire("click");
  assert.equal(get("chat-page").attributes["data-processing"], "true");
  setup.complete(2); await flush();
  assert.equal(get("chat-input").placeholder, "Message Family Copilot...");
  assert.equal(get("activity-results").attributes["aria-busy"], "false");
  assert.equal(get("chat-send").disabled, false);
  assert.equal(get("chat-progress").hidden, true);
  const html = fs.readFileSync(require.resolve("../chat/index.html"), "utf8");
  const composer = html.slice(html.indexOf('<form id="chat-composer">'));
  assert.match(composer, /id="chat-status"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.doesNotMatch(html, /id="chat-pause"|>Stop<\/button>/);
  await controller.dispose();
  assert.equal(get("chat-input").placeholder, "Message Family Copilot...");
});

test("composer names actual background actions and lists only pending steps", async context => {
  const pending = deferred();
  const setup = harness({ calendarMethods: {
    loadSynthetic: () => pending.promise,
    assessOccurrences() {
      assert.equal(setup.get("chat-status").textContent, "Checking activity times against your calendars...");
      assert.equal(setup.get("chat-progress").hidden, true);
      return null;
    },
    coordinateMeeting(action) {
      if (action === "review" || action === "send_invitation") {
        assert.equal(setup.get("chat-status").textContent, action === "review" ?
          "Checking both parents' calendars for the school meeting..." : "Preparing Mike's invitation...");
        assert.equal(setup.get("chat-page").attributes["data-processing"], "true");
        assert.equal(setup.get("chat-input").disabled, true);
        assert.equal(setup.get("chat-progress").hidden, true);
      }
      return action === "review" ? { state: "ask", overlapMinutes: 30 } : { state: action === "send_invitation" ? "invited" : "cancelled" };
    }
  } });
  context.after(() => setup.controller.dispose());
  sendGreeting(setup);
  assert.equal(setup.get("chat-status").textContent, "Loading family members' calendars...");
  assert.deepEqual(setup.get("chat-progress").children.map(item => item.textContent), [
    "Next: Find activities that match your family's interests", "Next: Compare activity times with calendars"
  ]);
  assert.equal(setup.get("chat-progress").hidden, false);
  pending.resolve(); await flush();
  assert.equal(setup.get("chat-status").textContent, "Finding activities that match your family's interests...");
  assert.deepEqual(setup.get("chat-progress").children.map(item => item.textContent), ["Next: Compare activity times with calendars"]);
  setup.complete(0); await flush();
  for (const message of ["Can you check my schedule for the school meeting?", "Yes, please send Mike an invitation."]) {
    setup.get("chat-input").value = message; setup.get("chat-composer").fire("submit");
    assert.equal(setup.get("chat-progress").hidden, true);
    assert.equal(setup.get("chat-progress").children.length, 0);
    assert.equal(setup.get("chat-page").attributes["data-processing"], "false");
    assert.equal(setup.get("chat-input").disabled, false);
  }
  assert.equal(setup.calls.length, 1);
  assert.match(text(setup.get("chat-messages")), /awaiting his response/);
  setup.get("chat-reset").fire("click"); sendGreeting(setup); await flush();
  assert.equal(setup.get("chat-progress").hidden, false);
  setup.calls[1].reject(Error("synthetic failure")); await flush();
  assert.equal(setup.get("chat-progress").hidden, true);
  assert.equal(setup.get("chat-progress").children.length, 0);
});

function integratedHarness(context, { cleanup, beforeCalendarFetch } = {}) {
  const page = calendarHarness(context, { chat: true }), document = page.document;
  const html = fs.readFileSync(require.resolve("../chat/index.html"), "utf8");
  const container = page.get("calendar-host").parentNode, shellIds = new Set();
  const createElement = document.createElement;
  document.createElement = tag => {
    const node = createElement(tag);
    node.remove = () => {
      if (node.parentNode) node.parentNode.children = node.parentNode.children.filter(child => child !== node);
      node.parentNode = null;
    };
    return node;
  };
  for (const [, tag, id] of html.matchAll(/<(\w+)\b[^>]*\bid="([^"]+)"/g)) {
    shellIds.add(id);
    if (id === "calendar-host") continue;
    const node = document.createElement(tag); node.setAttribute("id", id); container.append(node);
  }
  const calls = [], searches = [], timers = new Map();
  let timerId = 0, mounted = 0, calendarController;
  const forbidden = () => { throw Error("forbidden_side_effect"); };
  const window = document.defaultView;
  const runtime = vm.createContext({ document, window, AbortController, AbortSignal, structuredClone, URL,
    TextEncoder, TextDecoder, Uint8Array, Response,
    Date: class extends Date { static now() { return Date.parse("2026-09-18T04:00:00Z"); } },
    crypto: require("node:crypto").webcrypto,
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    Option: function(text, value) { const node = document.createElement("option"); node.textContent = text; node.value = value; return node; },
    setTimeout(callback, delay) { timers.set(++timerId, { callback, delay }); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    addEventListener: window.addEventListener.bind(window), removeEventListener: window.removeEventListener.bind(window) });
  for (const name of ["fetch", "XMLHttpRequest", "WebSocket", "localStorage", "sessionStorage", "indexedDB", "caches", "MutationObserver"]) {
    Object.defineProperty(runtime, name, { get: forbidden });
  }
  const shellDocument = {
    getElementById(id) { assert.ok(shellIds.has(id), "shell must not read Calendar internals"); return document.getElementById(id); },
    createElement: document.createElement
  };
  for (const [, script] of html.matchAll(/<script defer src="([^"]+)"/g)) {
    if (script === "ui.js") {
      const calendar = runtime.FamilyChatCalendar, activities = runtime.FamilyChatActivities;
      runtime.FamilyChatCalendar = { mountCalendar(host, options) {
        mounted++; calendarController = calendar.mountCalendar(host, options); return calendarController;
      } };
      runtime.FamilyChatActivities = { ...activities, searchActivities(request, options) {
        assert.equal(Contract.validateActivityRequest(request), true);
        searches.push(structuredClone(request)); return activities.searchActivities(request, options);
      } };
      runtime.document = shellDocument;
    }
    const filename = require("node:path").resolve(__dirname, "../chat", script);
    vm.runInContext(fs.readFileSync(filename, "utf8"), runtime, { filename });
    if (script === "../owner/chat-calendar-fixtures.js") {
      const create = runtime.FamilyCalendarFixtures.create;
      runtime.FamilyCalendarFixtures = { create(options) {
        const transport = create(options);
        return { ...transport, async fetch(path, options) {
          const body = JSON.parse(options.body); calls.push({ path, body });
          if (path === "/api/clear" && cleanup) return cleanup.promise;
          if (beforeCalendarFetch) await beforeCalendarFetch(path);
          return transport.fetch(path, options);
        } };
      } };
    }
  }
  const controller = runtime.FamilyChatUI.mountChat(shellDocument);
  context.after(() => controller.dispose().catch(() => {}));
  return { page, controller, calls, searches, timers, get mounted() { return mounted; },
    get calendar() { return calendarController; },
    async submit(value) {
      page.get("chat-input").value = value;
      await page.get("chat-composer").dispatchEvent({ type: "submit", preventDefault() {} }); await settle();
    } };
}
test("missing domain components fail closed and never fabricate Calendar or activity results", async () => {
  const setup = harness({ components: false });
  assert.equal(setup.get("chat-input").disabled, true); assert.equal(setup.get("chat-input").disabled, true);
  assert.equal(setup.calls.length, 0); assert.equal(setup.counts.mount, 0); await setup.controller.dispose();
});

test("composer reserves measured height, follows visual viewport keyboard and releases geometry listeners", async () => {
  const setup = harness({ geometry: true }), viewport = setup.lifecycle.visualViewport;
  assert.equal(setup.properties.get("--composer-height"), "150px");
  assert.equal(setup.properties.get("--keyboard-offset"), "0px");
  viewport.height = 440; viewport.fire("resize"); assert.equal(setup.properties.get("--keyboard-offset"), "370px");
  viewport.offsetTop = 35; viewport.fire("scroll"); assert.equal(setup.properties.get("--keyboard-offset"), "335px");
  setup.resizeComposer(205.2); assert.equal(setup.properties.get("--composer-height"), "206px");
  setup.lifecycle.innerHeight = 475; setup.lifecycle.fire("resize"); assert.equal(setup.properties.get("--keyboard-offset"), "0px");
  viewport.height = 810; viewport.offsetTop = 0; setup.lifecycle.innerHeight = 810; viewport.fire("resize");
  assert.equal(setup.properties.get("--keyboard-offset"), "0px"); assert.equal(setup.calls.length, 0);
  await setup.controller.dispose(); assert.equal(setup.disconnected, 1);
  assert.equal(viewport.handlers.size, 0); assert.equal(setup.lifecycle.handlers.size, 0);
  setup.resizeComposer(100); assert.equal(setup.properties.get("--composer-height"), "206px");
});
test("message Enter sends once, ignores blank and busy input, and releases its handler", async context => {
  const setup = harness(); context.after(() => setup.controller.dispose());
  const input = setup.get("chat-input");
  let prevented = 0;
  const enter = () => input.fire("keydown", { key: "Enter", preventDefault() { prevented++; } });
  input.value = " \n "; enter();
  assert.equal(setup.calls.length, 0);
  input.value = "October ideas"; enter();
  assert.equal(setup.calls.length, 1);
  assert.equal(input.value, "");
  input.value = "Not while loading"; enter();
  assert.equal(setup.calls.length, 1);
  assert.equal(input.value, "Not while loading");
  assert.equal(prevented, 3);
  setup.complete(0); await flush();
  input.value = "How about this weekend?"; enter();
  assert.equal(setup.calls.length, 2);
  setup.complete(1); await flush();
  await setup.controller.dispose();
  assert.equal(input.handlers.has("keydown"), false);
});
test("message Enter preserves multiline and IME input without sending", async context => {
  const setup = harness(); context.after(() => setup.controller.dispose());
  const input = setup.get("chat-input"); input.value = "Draft message";
  for (const event of [{ key: "a" }, { key: "Enter", shiftKey: true },
    { key: "Enter", ctrlKey: true }, { key: "Enter", altKey: true }, { key: "Enter", metaKey: true },
    { key: "Enter", isComposing: true }, { key: "Enter", keyCode: 229 },
    { key: "Enter", defaultPrevented: true }]) {
    input.fire("keydown", { ...event, preventDefault() { assert.fail("native editing must be preserved"); } });
    assert.equal(input.value, "Draft message");
    assert.equal(setup.calls.length, 0);
  }
  let prevented = false;
  input.fire("keydown", { key: "Enter", repeat: true, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(setup.calls.length, 0);
  assert.equal(input.value, "Draft message");
});
test("one Calendar mount, no startup search, same renderer used for initial and refined requests", async () => {
  const setup = harness(); assert.equal(setup.counts.mount, 1); assert.equal(setup.calls.length, 0);
  assert.equal(setup.get("chat-page").attributes["data-conversation"], "idle");
  assert.equal(mountChat(setup.document, setup.options), setup.controller); assert.equal(setup.counts.mount, 1);
  sendGreeting(setup); sendGreeting(setup); assert.equal(setup.calls.length, 1);
  assert.equal(setup.get("chat-page").attributes["data-conversation"], "started");
  setup.complete(0); await flush(); assert.equal(setup.counts.rendered, 1);
  setup.get("chat-input").value = "How about this weekend?"; setup.get("chat-composer").fire("submit");
  assert.equal(setup.counts.removed, 1); assert.equal(setup.calls[1].request.range.startDate, "2026-09-19");
  setup.complete(1); await flush(); assert.equal(setup.counts.rendered, 2);
  setup.get("chat-reset").fire("click"); assert.equal(setup.counts.dispose, 0); assert.equal(setup.counts.removed, 2);
  assert.equal(setup.get("chat-page").attributes["data-conversation"], "idle");
  assert.equal(setup.get("chat-input").focused, true); await setup.controller.dispose(); assert.equal(setup.counts.dispose, 1);
});
test("parent text uses text nodes, never Calendar DOM or HTML sinks", async () => {
  const setup = harness(); sendGreeting(setup); setup.complete(0); await flush();
  setup.get("chat-input").value = '<img src=x onerror="fetch()">'; setup.get("chat-composer").fire("submit");
  assert.equal(setup.calls.length, 2);
  assert.doesNotMatch(JSON.stringify(setup.calls[1].request), /onerror|fetch/);
  const text = setup.get("chat-messages").children.flatMap(item => item.children).map(item => item.textContent).join(" ");
  assert.ok(text.includes('<img src=x onerror="fetch()">')); await setup.controller.dispose();
});

test("preference draft and Cancel/Escape never search; Apply clears real cards and updates explicit requests", async context => {
  const setup = harness({ browser: true }); context.after(() => setup.controller.dispose());
  const get = setup.get;
  get("preferences-edit").fire("click"); assert.equal(get("preference-age").focused, true);
  get("preference-age").value = "12"; get("interest-movies").checked = false;
  get("preferences-cancel").fire("click"); assert.equal(get("preferences-editor").hidden, true);
  assert.equal(get("preferences-edit").focused, true); assert.equal(setup.calls.length, 0);
  get("preferences-edit").fire("click"); assert.equal(get("preference-age").value, "7");
  assert.equal(get("interest-movies").checked, true);
  assert.equal(get("interest-basketball").checked, true); assert.equal(get("interest-baseball").checked, true);
  assert.equal(get("interest-ping-pong").checked, false);
  get("preferences-editor").fire("keydown", { key: "Escape" }); assert.equal(get("preferences-editor").hidden, true);
  sendGreeting(setup); await flush(); assert.equal(tags(get("activity-results"), "article").length, 2);
  get("preferences-edit").fire("click"); get("preference-age").value = "121";
  get("preferences-editor").fire("submit"); assert.equal(get("preferences-error").hidden, false);
  assert.equal(tags(get("activity-results"), "article").length, 2); assert.equal(setup.calls.length, 1);
  get("preference-age").value = "12"; get("preference-area").value = "  Zhongshan, Taipei  "; get("interest-movies").checked = true;
  get("interest-basketball").checked = false; get("interest-baseball").checked = false;
  for (const value of ["concerts", "museums", "outdoor-play", "science-discovery"]) get(`interest-${value}`).checked = false;
  get("preferences-editor").fire("submit"); assert.equal(get("preferences-editor").hidden, true);
  assert.equal(get("preference-age-summary").textContent, "(12)");
  assert.equal(get("preference-area-summary").textContent, "Zhongshan, Taipei");
  assert.equal(get("preference-place-summary").hidden, true);
  assert.deepEqual(tags(get("preference-interests-summary"), "li").map(item => item.textContent), ["Movie"]);
  assert.equal(get("activity-results").children.length, 0); assert.equal(setup.calls.length, 1);
  assert.match(get("chat-status").textContent, /Preferences applied/);
  assert.equal(get("chat-retry").hidden, false);
  assert.equal(get("chat-retry").textContent, "Show suggestions");
  get("chat-retry").fire("click"); await flush(); assert.equal(setup.calls.length, 2);
  assert.equal(setup.calls[1].request.preferences.ages[0], 12);
  assert.equal(setup.calls[1].request.preferences.origin.area, "Zhongshan, Taipei");
  assert.equal(setup.calls[1].request.preferences.interestBasis, "parent_confirmed");
  assert.match(text(tags(get("activity-results"), "article")[0]), /Forgotten Island/);
  assert.equal(setup.calls[1].request.range.startDate, "2026-10-09");
  get("chat-reset").fire("click"); assert.equal(get("preference-age-summary").textContent, "(7)");
  assert.equal(get("preference-place-summary").hidden, false);
  assert.deepEqual(tags(get("preference-interests-summary"), "li").map(item => item.textContent), ["Basketball", "Baseball", "Movie", "Concerts", "Museums", "Outdoor play", "Science & discovery"]);
  assert.equal(setup.counts.mount, 1); assert.equal(setup.counts.dispose, 0);
});

test("interest plus edits custom preferences without searching and restores focus", async context => {
  const setup = harness(); context.after(() => setup.controller.dispose());
  const get = setup.get;
  assert.equal(get("chat-status").hidden, true);
  get("interests-edit").fire("click");
  assert.equal(get("preference-other-interests").focused, true);
  assert.equal(get("interests-edit").attributes["aria-expanded"], "true");
  get("preference-other-interests").value = "Hiking, Movie, hiking, science";
  get("preferences-editor").fire("submit");
  assert.equal(get("interests-edit").focused, true);
  assert.equal(setup.calls.length, 0);
  assert.deepEqual(tags(get("preference-interests-summary"), "li").map(item => item.textContent),
    ["Basketball", "Baseball", "Movie", "Concerts", "Museums", "Outdoor play", "Science & discovery", "hiking", "science"]);
  get("interests-edit").fire("click");
  get("preference-other-interests").value = "x".repeat(41);
  get("preferences-editor").fire("submit");
  assert.equal(get("preferences-error").hidden, false);
  get("preferences-editor").fire("keydown", { key: "Escape" });
  assert.equal(get("interests-edit").focused, true);
  sendGreeting(setup);
  assert.deepEqual(setup.calls[0].request.preferences.interests, ["basketball", "baseball", "movies", "concerts", "museums", "outdoor-play", "science-discovery", "hiking", "science"]);
  assert.doesNotMatch(JSON.stringify(setup.calls[0].request), /Kimi/);
  assert.equal(get("chat-status").hidden, false);
});
test("team plus supports draft cancellation, validation, deduplication, empty preferences and reset", async context => {
  const setup = harness({ browser: true }); context.after(() => setup.controller.dispose());
  const get = setup.get;
  const summary = () => tags(get("preference-teams-summary"), "li").map(item => item.textContent);
  assert.deepEqual(summary(), ["新北中信特攻", "中信兄弟"]);
  get("teams-edit").fire("click");
  assert.equal(get("team-dea").focused, true);
  assert.equal(get("teams-edit").attributes["aria-expanded"], "true");
  get("team-dea").checked = false; get("preference-other-teams").value = "Draft team";
  get("preferences-cancel").fire("click");
  assert.equal(get("teams-edit").focused, true);
  get("teams-edit").fire("click");
  assert.equal(get("team-dea").checked, true); assert.equal(get("preference-other-teams").value, "");
  for (const value of ["x".repeat(121), Array.from({ length: 17 }, (_, index) => `Team ${index}`).join(","), "Bad\u202ename"]) {
    get("preference-other-teams").value = value; get("preferences-editor").fire("submit");
    assert.equal(get("preferences-error").hidden, false);
    assert.deepEqual(summary(), ["新北中信特攻", "中信兄弟"]);
  }
  get("preferences-editor").fire("keydown", { key: "Escape" });
  assert.equal(get("teams-edit").attributes["aria-expanded"], "false");
  get("teams-edit").fire("click"); get("team-dea").checked = false;
  get("preference-other-teams").value = ' Formosa Dreamers, Formosa Dreamers, 中信兄弟, <img src=x onerror=alert(1)> ';
  get("preferences-editor").fire("submit");
  assert.equal(get("preferences-editor").hidden, true);
  assert.deepEqual(summary(), ["中信兄弟", "Formosa Dreamers", "<img src=x onerror=alert(1)>"]);
  assert.equal(tags(get("preference-teams-summary"), "img").length, 0);
  assert.equal(setup.calls.length, 0);
  sendGreeting(setup); await flush();
  assert.deepEqual(setup.calls[0].request.preferences.preferredTeams, summary());
  assert.match(text(get("activity-results")), /preferred team: Formosa Dreamers/);
  get("teams-edit").fire("click"); get("team-brothers").checked = false; get("preference-other-teams").value = "";
  while (tags(get("preference-custom-teams"), "button").length) tags(get("preference-custom-teams"), "button")[0].fire("click");
  get("preferences-editor").fire("submit");
  assert.deepEqual(summary(), ["No preference"]);
  assert.equal(get("activity-results").children.length, 0); assert.equal(setup.calls.length, 1);
  get("chat-retry").fire("click"); await flush();
  assert.deepEqual(setup.calls[1].request.preferences.preferredTeams, []);
  assert.doesNotMatch(text(get("activity-results")), /preferred team:/);
  get("chat-reset").fire("click");
  assert.deepEqual(summary(), ["新北中信特攻", "中信兄弟"]);
});
test("team Add and Remove edit a draft, Enter adds without applying, and Cancel discards it", async context => {
  const setup = harness({ browser: true }); context.after(() => setup.controller.dispose());
  const get = setup.get;
  get("teams-edit").fire("click");
  get("preference-other-teams").value = "Formosa Dreamers";
  get("preference-add-team").fire("click");
  assert.equal(get("preference-other-teams").value, "");
  assert.match(text(get("preference-custom-teams")), /Formosa Dreamers.*Remove/);
  assert.doesNotMatch(text(get("preference-teams-summary")), /Dreamers/);
  get("preference-other-teams").value = "formosa dreamers";
  let prevented = false;
  get("preference-other-teams").fire("keydown", { key: "Enter", preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(tags(get("preference-custom-teams"), "li").length, 1);
  assert.equal(get("preferences-editor").hidden, false);
  get("preferences-cancel").fire("click"); get("teams-edit").fire("click");
  assert.equal(tags(get("preference-custom-teams"), "li").length, 0);
  get("preference-other-teams").value = "x".repeat(121); get("preference-add-team").fire("click");
  assert.equal(get("preferences-error").hidden, false);
  assert.equal(tags(get("preference-custom-teams"), "li").length, 0);
  get("preference-other-teams").value = "Formosa Dreamers"; get("preference-add-team").fire("click");
  get("preferences-editor").fire("submit"); get("teams-edit").fire("click");
  const remove = tags(get("preference-custom-teams"), "button")[0];
  assert.equal(remove.attributes["aria-label"], "Remove Formosa Dreamers");
  remove.fire("click");
  assert.equal(get("preference-other-teams").focused, true);
  assert.match(text(get("preference-teams-summary")), /Dreamers/);
  get("preferences-editor").fire("submit");
  assert.doesNotMatch(text(get("preference-teams-summary")), /Dreamers/);
  assert.equal(setup.calls.length, 0);
});
test("team edits abort in-flight suggestions without changing calendar ownership", async context => {
  const setup = harness({ browser: true, holdResults: true }); context.after(() => setup.controller.dispose());
  sendGreeting(setup); await flush();
  setup.get("teams-edit").fire("click"); setup.get("preferences-editor").fire("submit");
  assert.equal(setup.calls[0].signal.aborted, false);
  setup.get("teams-edit").fire("click"); setup.get("team-dea").checked = false;
  setup.get("preferences-editor").fire("submit");
  assert.equal(setup.calls[0].signal.aborted, true); assert.equal(setup.calls.length, 1);
  setup.calls[0].release(); await flush();
  assert.equal(setup.get("activity-results").children.length, 0);
  assert.equal(setup.counts.mount, 1); assert.equal(setup.counts.dispose, 0);
});
test("interest options preserve defaults, apply without searching and reach the real search unchanged", async context => {
  const html = fs.readFileSync(require.resolve("../chat/index.html"), "utf8");
  const options = [...html.matchAll(/<input id="interest-([^"]+)" type="checkbox" value="([^"]+)">([^<]+)</g)]
    .map(([, id, value, label]) => ({ id, value, label: label.replace(/&amp;/g, "&") }));
  assert.deepEqual(options, [
    { id: "basketball", value: "basketball", label: "Basketball" },
    { id: "baseball", value: "baseball", label: "Baseball" },
    { id: "ping-pong", value: "ping-pong", label: "Ping-pong" },
    { id: "movies", value: "movies", label: "Movie" },
    { id: "concerts", value: "concerts", label: "Concerts" },
    { id: "museums", value: "museums", label: "Museums" },
    { id: "outdoor-play", value: "outdoor-play", label: "Outdoor play" },
    { id: "science-discovery", value: "science-discovery", label: "Science & discovery" }
  ]);
  const setup = harness({ browser: true }); context.after(() => setup.controller.dispose());
  setup.get("preferences-edit").fire("click");
  for (const option of options) assert.equal(setup.get(`interest-${option.id}`).checked,
    option.value !== "ping-pong");
  for (const option of options) setup.get(`interest-${option.id}`).checked = true;
  setup.get("preferences-editor").fire("submit");
  assert.equal(setup.calls.length, 0);
  assert.deepEqual(tags(setup.get("preference-interests-summary"), "li").map(item => item.textContent), options.map(option => option.label));
  setup.get("preferences-edit").fire("click");
  for (const option of options) assert.equal(setup.get(`interest-${option.id}`).checked, true);
  setup.get("preferences-cancel").fire("click");
  sendGreeting(setup); await flush();
  assert.deepEqual(setup.calls[0].request.preferences.interests, options.map(option => option.value));
  assert.equal(tags(setup.get("activity-results"), "article").length, 2);
  assert.doesNotMatch(text(setup.get("activity-results")), /baseball|ping-pong/i);
});
test("Apply aborts and isolates an old actual-component result; no-op Apply preserves it", async context => {
  const setup = harness({ browser: true, holdResults: true }); context.after(() => setup.controller.dispose());
  sendGreeting(setup); await flush();
  setup.get("preferences-edit").fire("click"); setup.get("preferences-editor").fire("submit");
  assert.equal(setup.calls[0].signal.aborted, false);
  setup.get("preferences-edit").fire("click"); setup.get("preference-age").value = "0";
  setup.get("preferences-editor").fire("submit"); assert.equal(setup.calls.length, 1);
  assert.equal(setup.calls[0].signal.aborted, true); setup.calls[0].release(); await flush();
  assert.equal(setup.get("activity-results").children.length, 0);
  assert.match(setup.get("chat-status").textContent, /Preferences applied/);
});
test("pagehide cancels chat only; Calendar owns its page lifecycle and explicit teardown coalesces", async () => {
  const setup = harness(); sendGreeting(setup); setup.lifecycle.fire("pagehide");
  assert.equal(setup.calls[0].signal.aborted, true); assert.equal(setup.counts.dispose, 0);
  setup.complete(0); await flush(); assert.equal(setup.counts.rendered, 0);
  const first = setup.controller.dispose(); assert.equal(setup.controller.dispose(), first); await first;
  assert.equal(setup.counts.dispose, 1); assert.equal(setup.get("chat-input").disabled, true);
});
test("cleanup failure remains visible, fixed and idempotent rather than false success", async () => {
  const setup = harness({ failCleanup: true }); const first = setup.controller.dispose();
  await assert.rejects(first, { message: "calendar_cleanup_unconfirmed" });
  assert.equal(setup.controller.dispose(), first); assert.equal(setup.counts.dispose, 1);
  assert.equal(setup.get("calendar-connection").hidden, false);
  assert.match(setup.get("calendar-connection").textContent, /could not be confirmed/);
});
test("HTML bootstrap uses real Activities for October alternatives and distinct weekend cards without Calendar data", async context => {
  const setup = harness({ browser: true }); context.after(() => setup.controller.dispose());
  const results = setup.get("activity-results");
  assert.equal(setup.calls.length, 0); assert.equal(setup.counts.mount, 1);
  assert.equal(setup.get("chat-input").disabled, false);
  assert.equal(setup.get("activity-connection").hidden, true);
  setup.get("chat-input").value = "How about this weekend?"; setup.get("chat-input").fire("input");
  setup.lifecycle.fire("focus"); assert.equal(setup.calls.length, 0);
  sendGreeting(setup); sendGreeting(setup); await flush();
  assert.equal(setup.calls.length, 1); assert.equal(tags(results, "article").length, 2);
  assert.equal(setup.get("chat-retry").hidden, true);
  assert.equal(setup.get("chat-retry").disabled, true);
  assert.equal(setup.get("chat-status").hidden, true);
  assert.match(text(results), /Incomplete shortlist \/ Availability unverified/);
  assert.match(text(results), /新北中信特攻 vs 福爾摩沙夢想家/); assert.match(text(results), /Forgotten Island/);
  assert.match(text(results), /saved public data, not a live search/);
  assert.match(text(results), /preferred team: 新北中信特攻/);
  assert.deepEqual(tags(setup.get("preference-teams-summary"), "li").map(item => item.textContent), ["新北中信特攻", "中信兄弟"]);
  assert.match(text(setup.get("chat-messages")), /age 7.*Xinyi District/);
  assert.match(text(results), /Calendar availability not checked/);
  assert.match(text(results), /Time and distance unknown/);
  const originalIds = tags(results, "article").map(node => node.attributes["data-activity-id"]);
  const images = tags(results, "img");
  assert.equal(images.length, 3);
  assert.deepEqual(images.map(image => image.src), ["../activity-preview/chat-assets/formosa-dreamers.webp", "../activity-preview/chat-assets/ctbc-dea.png", "../activity-preview/chat-assets/forgotten-island.jpg"]);
  assert.match(text(results), /Public reuse permission has not been confirmed/);
  tags(results, "details").forEach(node => { node.open = true; node.fire("toggle"); });
  assert.equal(setup.calls.length, 1);
  setup.get("chat-input").value = "October feels too far away. How about this weekend?";
  setup.get("chat-composer").fire("submit");
  assert.equal(results.children.length, 0); assert.ok(images.every(image => image.handlers.size === 0));
  await flush();
  assert.equal(setup.calls.length, 2); assert.equal(tags(results, "article").length, 1);
  assert.equal(setup.get("chat-retry").hidden, true);
  assert.equal(setup.get("chat-status").hidden, true);
  assert.match(text(results), /Chiikawa/); assert.doesNotMatch(text(results), /中信特攻 vs 福爾摩沙夢想家|Forgotten Island/);
  assert.deepEqual(tags(results, "img").map(image => image.src), ["../activity-preview/chat-assets/chiikawa.jpg"]);
  assert.match(text(results), /Showtimes unverified/);
  assert.ok(!originalIds.includes(tags(results, "article")[0].attributes["data-activity-id"]));
  assert.deepEqual(setup.calls[1].request.preferences, setup.calls[0].request.preferences);
  assert.deepEqual(setup.calls[1].request.range, { startDate: "2026-09-19", endDate: "2026-09-20", timeZone: "Asia/Taipei" });
  assert.equal(setup.calls[1].request.trigger.kind, "refinement_submit");
  assert.equal(setup.calls[0].request.preferences.travelMode, null);
  assert.deepEqual(setup.calls[0].request.preferences.ages, [7]);
  assert.equal(setup.calls[0].request.preferences.origin.landmark, null);
  assert.match(text(setup.get("chat-messages")), /2026-09-19 to 2026-09-20/);
  setup.get("chat-input").value = "this weekend"; setup.get("chat-composer").fire("submit"); await flush();
  assert.equal(setup.calls.length, 2); assert.equal(setup.counts.rendered, 2);
  setup.get("chat-reset").fire("click");
  assert.equal(results.children.length, 0); assert.equal(setup.counts.removed, 2);
  assert.equal(setup.counts.dispose, 0); assert.equal(setup.counts.mount, 1);
});
test("partial public results with a failed source retain Retry", async context => {
  const setup = harness({ browser: true, holdResults: true }); context.after(() => setup.controller.dispose());
  sendGreeting(setup); await flush();
  const call = setup.calls[0];
  call.result.items = call.result.items.filter(item => item.sourceId !== "vieshow-snapshot");
  call.result.issues.push({ code: "source_unavailable", sourceId: "vieshow-snapshot", message: "Source unavailable." });
  call.release(); await flush();
  assert.equal(tags(setup.get("activity-results"), "article").length, 1);
  assert.equal(setup.get("chat-retry").hidden, false);
  assert.equal(setup.get("chat-retry").disabled, false);
  assert.equal(setup.get("chat-retry").textContent, "Retry");
  assert.equal(setup.get("chat-status").hidden, false);
  assert.equal(setup.get("chat-status").textContent, "The search is incomplete.");
});
test("real Activities remain usable without Calendar and reset fences fixture work", async context => {
  const setup = harness({ browser: true, components: false }); context.after(() => setup.controller.dispose());
  const results = setup.get("activity-results");
  assert.equal(setup.counts.mount, 0); assert.equal(setup.get("chat-input").disabled, false);
  sendGreeting(setup); setup.get("chat-reset").fire("click"); await flush();
  assert.equal(setup.calls[0].signal.aborted, true); assert.equal(results.children.length, 0);
  assert.equal(setup.counts.rendered, 0); assert.equal(setup.get("chat-status").hidden, true);
  assert.equal(setup.get("chat-input").disabled, false);
  setup.get("chat-input").value = "How about this weekend?";
  setup.get("chat-composer").fire("submit"); await flush();
  assert.equal(setup.calls.length, 2); assert.equal(tags(results, "article").length, 2);
  assert.equal(setup.calls[1].request.range.startDate, "2026-10-09");
  setup.get("chat-reset").fire("click"); sendGreeting(setup); setup.get("chat-reset").fire("click");
  await flush(); assert.equal(setup.calls[2].signal.aborted, true); assert.equal(results.children.length, 0);
  assert.equal(setup.get("chat-messages").children.length, 0);
  assert.equal(setup.get("chat-input").value, ""); assert.equal(setup.get("chat-input").disabled, false);
});
test("conversation controls appear only when relevant and New conversation stays in closed options", async context => {
  const setup = harness(); context.after(() => setup.controller.dispose());
  const get = setup.get;
  assert.equal(get("chat-input").disabled, false);
  get("chat-input").value = "Hello"; get("chat-input").fire("input");
  assert.equal(setup.calls.length, 0);
  get("chat-input").value = " "; get("chat-composer").fire("submit");
  assert.equal(setup.calls.length, 0);
  for (const id of ["chat-progress", "chat-retry", "chat-options"]) assert.equal(get(id).hidden, true);
  setup.document.activeElement = get("chat-input");
  sendGreeting(setup);
  assert.equal(get("chat-status").focused, true);
  assert.equal(get("chat-options").hidden, false); assert.equal(get("chat-options").open, false);
  setup.calls[0].reject(Error("synthetic failure")); await flush();
  assert.equal(get("chat-retry").hidden, false);
  assert.equal(get("chat-retry").textContent, "Retry");
  get("chat-retry").fire("click"); assert.equal(get("chat-retry").hidden, true);
  setup.complete(1); await flush();
  assert.equal(get("chat-retry").hidden, true);
  get("chat-options").open = true; get("chat-options").fire("keydown", { key: "Escape" });
  assert.equal(get("chat-options").open, false); assert.equal(get("chat-options-toggle").focused, true);
  get("chat-options").open = true; get("chat-reset").fire("click");
  assert.equal(get("chat-options").open, false); assert.equal(get("chat-options").hidden, true);
  assert.equal(get("chat-input").disabled, false); assert.equal(setup.calls.length, 2);
  assert.equal(setup.counts.mount, 1); assert.equal(setup.counts.dispose, 0);
});
test("pending inputs cannot skip scenes; late retired Activities results cannot reappear after pagehide", async context => {
  const setup = harness({ browser: true, holdResults: true }); context.after(() => setup.controller.dispose());
  const results = setup.get("activity-results");
  sendGreeting(setup); await flush();
  assert.equal(setup.calls[0].result.items.length, 2);
  setup.get("chat-input").value = "this weekend"; setup.get("chat-composer").fire("submit"); await flush();
  assert.equal(setup.calls.length, 1); assert.equal(setup.get("chat-input").disabled, true);
  setup.get("preferences-edit").fire("click"); setup.get("preference-age").value = "9";
  setup.get("preferences-editor").fire("submit");
  assert.equal(setup.calls[0].signal.aborted, true);
  setup.get("chat-retry").fire("click"); await flush();
  setup.calls[1].release(); await flush(); assert.equal(tags(results, "article").length, 2);
  setup.calls[0].release(); await flush(); assert.equal(setup.counts.rendered, 1);
  assert.match(text(results), /2026-10-/);
  const images = tags(results, "img");
  setup.get("chat-input").value = "Something sooner"; setup.get("chat-composer").fire("submit"); await flush();
  assert.equal(setup.calls[2].request.range.startDate, "2026-09-19");
  setup.lifecycle.fire("pagehide"); setup.calls[2].release(); await flush();
  assert.equal(setup.calls[2].signal.aborted, true); assert.equal(results.children.length, 0);
  assert.ok(images.every(image => image.handlers.size === 0));
  assert.equal(setup.counts.rendered, 1); assert.equal(setup.counts.dispose, 0);
  assert.equal(setup.get("chat-input").disabled, true);
});
test("timed-out actual Activities result stays retired until explicit retry returns fresh cards", async context => {
  const setup = harness({ browser: true, holdResults: true, controlledTimers: true });
  context.after(() => setup.controller.dispose());
  const results = setup.get("activity-results");
  sendGreeting(setup); await flush();
  assert.equal(setup.calls[0].result.items.length, 2);
  assert.equal(setup.timers.size, 1);
  const timeout = [...setup.timers.values()][0];
  assert.equal(timeout.delay, 10000); timeout.callback();
  assert.equal(setup.calls[0].signal.aborted, true);
  assert.equal(setup.timers.size, 0); assert.equal(results.children.length, 0);
  assert.match(setup.get("chat-status").textContent, /timed out/);
  setup.calls[0].release(); await flush();
  assert.equal(setup.calls.length, 1); assert.equal(setup.counts.rendered, 0);
  assert.match(setup.get("chat-status").textContent, /timed out/);
  setup.get("chat-retry").fire("click"); setup.get("chat-retry").fire("click"); await flush();
  assert.equal(setup.calls.length, 2);
  assert.equal(setup.calls[1].request.trigger.kind, "explicit_retry");
  assert.notEqual(setup.calls[1].request.requestId, setup.calls[0].request.requestId);
  assert.ok(setup.calls[1].request.generation > setup.calls[0].request.generation);
  assert.deepEqual(setup.calls[1].request.preferences, setup.calls[0].request.preferences);
  timeout.callback(); assert.equal(setup.calls[1].signal.aborted, false);
  assert.equal(setup.get("chat-status").textContent, "Finding activities that match your family's interests...");
  setup.calls[1].release(); await flush();
  assert.equal(tags(results, "article").length, 2); assert.equal(setup.counts.rendered, 1);
  assert.equal(setup.timers.size, 0); assert.equal(setup.counts.dispose, 0);
});
test("opening message precedes Calendar loading and suggestions wait for preparation", async context => {
  const pending = deferred();
  const setup = integratedHarness(context, { beforeCalendarFetch: path => path === "/api/child/sync" ? pending.promise : undefined });
  const { page } = setup;
  const html = fs.readFileSync(require.resolve("../chat/index.html"), "utf8");
  const order = ["chat-opening", "calendar-conversation", "chat-messages", "activity-results", "chat-composer", "chat-status", "chat-input"];
  for (let index = 1; index < order.length; index++) {
    assert.ok(html.indexOf(`id="${order[index - 1]}"`) < html.indexOf(`id="${order[index]}"`));
  }
  assert.equal(page.get("calendar-conversation").hidden, true);
  assert.equal(setup.calls.length, 0); assert.equal(setup.searches.length, 0);
  await setup.submit("What could we do together in October?"); await settle();
  assert.match(text(page.get("chat-opening")), /What could we do together in October\?/);
  assert.doesNotMatch(text(page.get("chat-messages")), /What could we do together in October\?/);
  assert.equal(page.get("calendar-conversation").hidden, false);
  assert.equal(page.get("availability-load").hidden, true);
  assert.equal(page.get("calendar-introduction").textContent, "Loading family members' calendars...");
  assert.equal(page.get("chat-status").textContent, "Loading family members' calendars...");
  assert.equal(page.get("chat-status").hidden, false);
  assert.equal(page.get("chat-page").attributes["data-processing"], "true");
  assert.equal(page.get("chat-input").disabled, true);
  assert.deepEqual(setup.calls.map(call => call.path), ["/api/child/sync"]);
  assert.equal(setup.searches.length, 0);
  pending.resolve(); await settle(); await settle();
  assert.deepEqual(setup.calls.map(call => call.path), ["/api/child/sync", "/api/availability"]);
  assert.equal(setup.searches.length, 1);
  assert.equal(tags(page.get("activity-results"), "article").length, 2);
  assert.equal(page.get("chat-status").hidden, true);
  assert.equal(page.get("chat-page").attributes["data-processing"], "false");
  assert.match(page.get("calendar-introduction").textContent, /check your October calendar/);
  assert.match(text(page.get("chat-messages")), /Here are some ideas for your family\./);
  assert.doesNotMatch(text(page.get("chat-messages")), /couldn't confirm calendar fit/);
  assert.match(text(page.get("calendar-assessment")), /activity time is incomplete/);
  assert.match(page.get("calendar-assessment").children[1].textContent, /Calendar fit not confirmed/);
  assert.equal(tags(page.get("calendar-assessment"), "details").length, 1);
  assert.ok(!tags(page.get("calendar-assessment"), "details")[0].open);
  assert.doesNotMatch(JSON.stringify(setup.searches), /Mike|Debby|Kimi/);
  await page.fire("chat-reset"); assert.equal(page.get("calendar-conversation").hidden, true);
  assert.equal(page.get("chat-opening").children.length, 0);
  await sendPageGreeting(page); await settle(); await settle();
  assert.equal(setup.calls.length, 2); assert.equal(setup.searches.length, 2);
});
test("arbitrary messages run October then weekend scenes, preserve Calendar and stop after the demo", async context => {
  const setup = integratedHarness(context), { page } = setup;
  assert.equal(page.get("chat-input").disabled, false);
  assert.equal(setup.calls.length, 0); assert.equal(setup.searches.length, 0);
  assert.equal(page.get("chat-input").placeholder, "Message Family Copilot...");
  await setup.submit("Family outing ideas please"); await settle(); await settle();
  assert.equal(setup.searches.length, 1);
  assert.equal(setup.searches[0].range.startDate, "2026-10-09");
  assert.equal(setup.searches[0].range.endDate, "2026-10-11");
  assert.equal(tags(page.get("activity-results"), "article").length, 2);
  assert.match(text(page.get("activity-results")), /中信特攻 vs 福爾摩沙夢想家/);
  assert.match(text(page.get("chat-messages")), /2026-10-09 to 2026-10-11/);
  assert.doesNotMatch(text(page.get("chat-messages")), /preset proposal|not interpreted from text/);
  assert.equal(page.get("chat-input").placeholder, "Message Family Copilot...");
  await setup.submit("Family outing ideas please"); await settle();
  assert.equal(setup.searches.length, 1);
  const calendarCalls = setup.calls.length;
  const originalIds = tags(page.get("activity-results"), "article").map(node => node.attributes["data-activity-id"]);
  await setup.submit("Maybe a little sooner"); await settle(); await settle();
  assert.equal(setup.searches.length, 2);
  assert.match(text(page.get("chat-messages")), /Explore this movie for the weekend\./);
  assert.doesNotMatch(text(page.get("chat-messages")), /availability still needs checking|dated showtimes not verified|outside.*October calendar|Details still need checking/);
  assert.equal(page.get("calendar-assessment").children[1].textContent, "Calendar not checked for this weekend");
  assert.ok(!tags(page.get("calendar-assessment"), "details")[0].open);
  assert.match(text(tags(page.get("calendar-assessment"), "details")[0]), /outside the loaded October calendar/);
  assert.equal(setup.searches[1].range.startDate, "2026-09-19");
  assert.equal(setup.searches[1].range.endDate, "2026-09-20");
  assert.deepEqual(setup.searches[1].preferences, setup.searches[0].preferences);
  assert.equal(tags(page.get("activity-results"), "article").length, 1);
  assert.ok(!originalIds.includes(tags(page.get("activity-results"), "article")[0].attributes["data-activity-id"]));
  assert.doesNotMatch(text(page.get("activity-results")), /中信特攻 vs 福爾摩沙夢想家|Forgotten Island/);
  assert.match(calendarText(page.get("chat-calendar-scope")), /2026-10-01 - 2026-10-31/);
  assert.equal(setup.calls.length, calendarCalls);
  assert.doesNotMatch(JSON.stringify(setup.searches), /Family outing|Maybe a little|Mike|Debby|Kimi/);
  await setup.submit("What about another month?"); await settle();
  assert.equal(setup.searches.length, 2); assert.match(page.get("chat-status").textContent, /supported requests are complete/);
  assert.equal(page.get("chat-input").placeholder, "Message Family Copilot...");
  await page.fire("chat-reset");
  assert.equal(page.get("chat-input").placeholder, "Message Family Copilot...");
  await setup.submit("A completely different opening"); await settle(); await settle();
  assert.equal(setup.searches.length, 3); assert.equal(setup.searches[2].range.startDate, "2026-10-09");
});
for (const action of ["chat-reset"]) {
  test(`${action} during real Calendar loading fences subsequent suggestions without clearing Calendar`, async context => {
    const pending = deferred();
    const setup = integratedHarness(context, { beforeCalendarFetch: path => path === "/api/child/sync" ? pending.promise : undefined });
    const { page } = setup;
    await sendPageGreeting(page); await settle(); await page.fire(action);
    assert.equal(page.get("chat-input").placeholder, "Message Family Copilot...");
    pending.resolve(); await settle(); await settle();
    assert.equal(setup.searches.length, 0); assert.equal(page.get("activity-results").children.length, 0);
    assert.equal(setup.calls.some(call => call.path === "/api/clear"), false);
  });
}
test("real Calendar failure stays inside Calendar and does not block independent activity suggestions", async context => {
  const setup = integratedHarness(context, { beforeCalendarFetch(path) {
    if (path !== "/api/clear") throw Error("private fixture failure");
  } });
  await sendPageGreeting(setup.page); await settle(); await settle();
  assert.equal(setup.searches.length, 1);
  assert.equal(tags(setup.page.get("activity-results"), "article").length, 2);
  assert.match(calendarText(setup.page.get("chat-calendar-status")), /Unavailable|couldn|Couldn/);
  assert.doesNotMatch(text(setup.page.get("chat-messages")), /private fixture failure|Mike|Debby|Kimi/);
  assert.match(text(setup.page.get("calendar-assessment")), /activity time is incomplete/);
});
for (const action of ["clear", "expire"]) {
  test(`Calendar ${action} retires assessments and cards without an automatic search`, async context => {
    const setup = integratedHarness(context), { page } = setup;
    await setup.submit("October ideas"); await settle();
    assert.match(text(page.get("calendar-assessment")), /activity time is incomplete/);
    const expiration = [...setup.timers.values()].filter(timer => timer.delay === 240000).at(-1);
    assert.ok(expiration);
    if (action === "clear") { await page.fire("availability-clear"); await settle(); }
    else expiration.callback();
    assert.equal(page.get("calendar-assessment").hidden, true);
    assert.equal(page.get("activity-results").children.length, 0);
    assert.equal(setup.searches.length, 1);
    assert.match(page.get("chat-status").textContent, /expired or changed/);
    await page.fire("chat-retry"); await settle();
    assert.equal(setup.searches.length, 2);
    if (action === "clear") assert.match(text(page.get("calendar-assessment")), /activity time is incomplete/);
    expiration.callback();
    assert.equal(tags(page.get("activity-results"), "article").length, 2);
  });
}
test("full HTML mounts real Calendar once and refines real Activities without changing Calendar state", async context => {
  const setup = integratedHarness(context), { page } = setup;
  assert.equal(setup.mounted, 1); assert.ok(setup.calendar);
  assert.equal(Object.isFrozen(setup.calendar), true);
  assert.deepEqual(Object.keys(setup.calendar).sort(), ["assessOccurrences", "collapse", "coordinateMeeting", "dispose", "expand", "loadSynthetic", "resetProposal", "subscribeAssessment", "subscribeMeetingReview"]);
  assert.equal(page.get("calendar-connection").hidden, true);
  assert.equal(setup.calls.length, 0); assert.equal(setup.searches.length, 0);
  assert.equal(page.storage.values.size, 0);
  assert.equal(page.get("calendar-conversation").hidden, true);
  await sendPageGreeting(page); await settle();
  assert.equal(page.get("calendar-conversation").hidden, false);
  assert.deepEqual(setup.calls.map(call => call.path), ["/api/child/sync", "/api/availability"]);
  assert.equal(setup.searches.length, 1);
  const grid = page.get("availability-grid"), originalGrid = grid.children[0];
  const dates = [page.get("availability-start").value, page.get("availability-end").value];
  const freshness = calendarText(page.get("chat-calendar-status"));
  grid.scrollTop = 530; grid.scrollLeft = 165; page.get("availability-clear").focus();
  await page.fire("chat-calendar-toggle");
  assert.equal(page.get("chat-calendar-body").hidden, true);
  assert.equal(page.focus, page.get("chat-calendar-toggle"));
  await sendPageGreeting(page); await settle();
  assert.equal(tags(page.get("activity-results"), "article").length, 2);
  await setup.submit("October feels too far away. How about this weekend?");
  assert.equal(tags(page.get("activity-results"), "article").length, 1);
  assert.match(text(page.get("activity-results")), /2026-09-20/);
  assert.equal(page.get("activity-results").className, "calendar-assessed");
  assert.match(text(page.get("calendar-assessment")), /outside the loaded October calendar/);
  assert.deepEqual(setup.searches[1].preferences, setup.searches[0].preferences);
  assert.equal(setup.searches[1].range.startDate, "2026-09-19");
  assert.doesNotMatch(JSON.stringify(setup.searches), /Mike|Debby|Kimi/);
  await page.fire("chat-reset");
  assert.equal(page.get("activity-results").children.length, 0);
  assert.equal(setup.calls.length, 2); assert.equal(setup.mounted, 1);
  assert.equal(page.get("chat-calendar-body").hidden, true);
  await page.fire("chat-calendar-toggle");
  assert.equal(grid.children[0], originalGrid);
  assert.equal(grid.scrollTop, 530); assert.equal(grid.scrollLeft, 165);
  assert.deepEqual([page.get("availability-start").value, page.get("availability-end").value], dates);
  assert.equal(calendarText(page.get("chat-calendar-status")), freshness);
  assert.equal(page.storage.values.size, 0); assert.equal(page.packets.length, 0); assert.equal(page.metadata.length, 0);
  await setup.controller.dispose();
  assert.deepEqual(setup.calls.filter(call => call.path === "/api/clear").map(call => call.body), [{ reason: "leave" }]);
  assert.equal(setup.timers.size, 0);
});
test("fresh Debby school question checks both parents and sends only an explicit demo invitation without an outing", async context => {
  const setup = integratedHarness(context), { page } = setup;
  const assertDisclosure = () => {
    assert.match(text(page.get("chat-calendar-heading")), /Sample calendars/);
    assert.equal(page.get("chat-calendar-panel").hidden, false);
    assert.equal(page.get("chat-calendar-source-details").hidden, false);
    assert.equal(descendants(page.get("chat-calendar-source-details")).includes(page.get("calendar-invitation-source")), true);
    assert.equal(page.get("calendar-invitation-source").textContent, "Invitations use sample data and stay on this page. No invitation is delivered and no calendars are changed.");
    assert.doesNotMatch(text(page.get("chat-messages")), /demo invitation|simulation|no real invitation|no calendars have changed|has not been contacted/i);
  };
  assert.doesNotMatch(fs.readFileSync(require.resolve("../chat/index.html"), "utf8"), /meeting-disclosure/);
  const dates = [page.get("availability-start").value, page.get("availability-end").value];
  assert.equal(setup.calls.length, 0); assert.equal(setup.searches.length, 0);
  await setup.submit("Can you check my schedule for the school meeting?"); await settle();
  assert.match(text(page.get("chat-opening")), /Can you check my schedule for the school meeting\?/);
  assert.match(text(page.get("chat-messages")), /Your work meeting overlaps by half an hour\. Mike's calendar looks clear then\. If only one parent needs to attend, shall I invite Mike to Kimi's school meeting/);
  assert.match(text(page.get("chat-messages")), /If only one parent needs to attend, shall I invite Mike to Kimi's school meeting on Friday, October 16, 2026, 3:30-4:30 PM \(Asia\/Taipei\)\?/);
  assertDisclosure();
  assert.match(page.get("calendar-introduction").textContent, /Debby/);
  assert.equal(page.get("coordination-title").textContent, "Kimi's school meeting");
  assert.equal(page.get("coordination-timeline").children[0].children[0].textContent, "Kimi / School meeting");
  assert.match(text(page.get("coordination-timeline")), /Debby \(you\) \/ Busy only.*15:00-16:00.*Mike \/ Busy only.*17:00-18:00/);
  assert.equal(descendants(page.get("coordination-timeline")).filter(node => node.className === "coordination-overlap").length, 1);
  await setup.submit("Yes. Could Mike go instead?");
  assert.equal(page.get("coordination-result").hidden, true);
  assert.equal(page.get("chat-input").placeholder, "Message Family Copilot...");
  await setup.submit("Maybe");
  assert.equal(page.get("coordination-result").hidden, true);
  assertDisclosure();
  await setup.submit("Yes, one parent is enough. Please send Mike an invitation.");
  assert.equal(page.get("coordination-result").hidden, false);
  assert.equal(page.get("chat-input").placeholder, "Message Family Copilot...");
  assert.match(text(page.get("coordination-result")), /Mike's invitation.*October 16, 2026, 3:30-4:30 PM \(Asia\/Taipei\).*awaiting his response/);
  assert.match(text(page.get("chat-messages")), /Mike's invitation for Kimi's school meeting.*awaiting his response/);
  assertDisclosure();
  const invitationId = page.get("coordination-result").dataset.invitationId;
  assert.equal(page.get("coordination-timeline").children[0].children[0].textContent, "Kimi / School meeting");
  await setup.submit("Yes, please send Mike an invitation.");
  assert.equal(page.get("coordination-result").dataset.invitationId, invitationId);
  assert.match(text(page.get("chat-messages")), /already awaiting his response/);
  assertDisclosure();
  assert.equal(setup.searches.length, 0);
  assert.deepEqual(setup.calls.map(call => call.path), ["/api/child/sync", "/api/availability"]);
  assert.deepEqual([page.get("availability-start").value, page.get("availability-end").value], dates);
  await setup.submit("Undo"); assert.equal(page.get("coordination-result").hidden, true);
  assertDisclosure();
  await setup.submit("Review school meeting");
  await page.fire("availability-clear"); await settle();
  assert.equal(page.get("chat-retry").hidden, true);
  await setup.submit("Yes, please send Mike an invitation."); assert.equal(page.get("coordination-result").hidden, true);
  assert.doesNotMatch(text(page.get("chat-messages")), /awaiting his response|Mike's calendar looks clear/);
  assertDisclosure();
  assert.equal(setup.searches.length, 0);
  await page.fire("chat-reset");
  assert.equal(page.get("chat-opening").children.length, 0);
  assert.equal(page.get("chat-messages").children.length, 0);
});

test("source and no-delivery facts remain in Calendar Details after No and return to activities", async context => {
  const setup = integratedHarness(context), { page } = setup;
  const html = fs.readFileSync(require.resolve("../chat/index.html"), "utf8");
  assert.doesNotMatch(html, /meeting-disclosure|>Demo details<|>Demo invitation</);
  await setup.submit("Can you check my schedule for the school meeting?"); await settle();
  for (const reply of ["No", "Continue activities"]) {
    await setup.submit(reply);
    assert.match(text(page.get("chat-calendar-heading")), /Sample calendars/);
    assert.equal(page.get("chat-calendar-source-details").hidden, false);
    assert.match(text(page.get("chat-calendar-source-details")), /No invitation is delivered and no calendars are changed/);
    assert.doesNotMatch(text(page.get("chat-messages")), /demo|simulation|no real|no calendars have changed/i);
    assert.equal(page.get("coordination-result").hidden, true);
    assert.equal(setup.searches.length, 0);
  }
  await setup.controller.dispose();
  assert.equal(page.get("chat-messages").children.length, 0);
});

test("member-calendar capture flow uses natural copy while preserving source, uncertainty and pending response", async context => {
  const setup = integratedHarness(context), { page } = setup;
  const assertNaturalCopy = () => {
    assert.doesNotMatch(page.visibleText(), /\bdemo\b|invitation preview|no real send|no real delivery|No invitation is delivered/i);
    assert.match(text(page.get("chat-calendar-heading")), /Sample calendars/);
    assert.match(text(page.get("chat-calendar-source-details")), /No invitation is delivered and no calendars are changed/);
  };
  assertNaturalCopy();
  await setup.submit("What could we do together in October?");
  assert.equal(tags(page.get("activity-results"), "article").length, 2);
  assert.match(text(page.get("activity-results")), /Saved public sources/);
  assertNaturalCopy();
  const schoolDay = descendants(page.get("calendar-month-days")).find(node => node.dataset.monthDate === "2026-10-16");
  assert.ok(schoolDay);
  await page.get("calendar-month-days").dispatchEvent({ type: "click", target: schoolDay });
  assert.match(text(page.get("availability-grid")), /School meeting/);
  assertNaturalCopy();
  await setup.submit("Could we do something sooner, like this weekend?");
  assert.equal(tags(page.get("activity-results"), "article").length, 1);
  assert.match(text(page.get("activity-results")), /Chiikawa/);
  assert.match(text(page.get("activity-results")), /Showtimes unverified/);
  assert.match(text(page.get("calendar-assessment")), /Calendar not checked for this weekend/);
  assertNaturalCopy();
  await page.fire("chat-reset");
  assert.equal(page.get("chat-messages").children.length, 0);
  await setup.submit("Can you check my schedule for the school meeting?");
  assert.match(text(page.get("coordination-status")), /Debby \(you\) has 30 minutes of overlap/);
  assert.equal(page.get("coordination-timeline").children[0].children[0].textContent, "Kimi / School meeting");
  assertNaturalCopy();
  const calls = setup.calls.length;
  await setup.submit("Yes, one parent is enough. Please send Mike an invitation.");
  assert.match(text(page.get("chat-messages")), /is awaiting his response/);
  assert.equal(page.get("coordination-status").textContent, "Mike pending response");
  assert.doesNotMatch(text(page.get("coordination-result")), /sent|delivered|accepted/i);
  assert.equal(page.get("coordination-timeline").children[0].children[0].textContent, "Kimi / School meeting");
  assert.match(text(page.get("coordination-timeline")), /Debby \(you\) \/ Busy only.*Mike \/ Busy only/);
  assert.equal(setup.calls.length, calls);
  assertNaturalCopy();
});

test("neutral composer copy survives meeting cancellation and activity resumption without resetting user state", async context => {
  const setup = integratedHarness(context), { page } = setup;
  const html = fs.readFileSync(require.resolve("../chat/index.html"), "utf8");
  const ui = fs.readFileSync(require.resolve("../chat/ui.js"), "utf8");
  assert.match(html, /<textarea id="chat-input"[^>]*placeholder="Message Family Copilot\.\.\."/);
  assert.match(html, /<textarea id="chat-input"[^>]*><\/textarea>/);
  assert.deepEqual([...ui.matchAll(/node\("chat-input"\)\.placeholder\s*=\s*([^;]+);/g)].map(match => match[1]),
    ['"Message Family Copilot..."']);
  assert.equal(page.get("chat-input").value, "");
  assert.equal(setup.calls.length, 0); assert.equal(setup.searches.length, 0);
  for (const reply of ["Cancel", "Undo", "No"]) {
    await setup.submit("Can you check my schedule for the school meeting?"); await settle();
    assert.equal(page.get("chat-input").placeholder, "Message Family Copilot...");
    await setup.submit(reply);
    assert.equal(page.get("chat-input").placeholder, "Message Family Copilot...");
    assert.equal(page.get("coordination-result").hidden, true);
    await setup.submit("Continue activities");
    assert.equal(page.get("chat-input").placeholder, "Message Family Copilot...");
    assert.ok(page.get("chat-opening").children.length > 0);
    assert.equal(setup.searches.length, 0);
    await page.fire("chat-reset");
    assert.equal(page.get("chat-input").placeholder, "Message Family Copilot...");
    assert.equal(page.get("chat-input").value, "");
  }
});

test("school meeting is a conversation, fences stale confirmation and never advances outing scenes", async context => {
  const setup = integratedHarness(context), { page } = setup;
  await setup.submit("October ideas"); await settle();
  const calls = setup.calls.length;
  await page.fire("coordination-review");
  assert.match(text(page.get("chat-messages")), /half an hour.*If only one parent needs to attend/);
  assert.equal(page.get("chat-input").placeholder, "Message Family Copilot...");
  await setup.submit("Maybe");
  assert.match(text(page.get("chat-messages")), /Please explicitly ask me to send the invitation/);
  assert.equal(page.get("coordination-result").hidden, true);
  await setup.submit("Yes");
  assert.equal(page.get("coordination-result").hidden, true);
  await setup.submit("Yes, please send Mike an invitation.");
  assert.equal(page.get("coordination-result").hidden, false);
  assert.match(text(page.get("chat-messages")), /Mike's invitation for Kimi's school meeting.*awaiting his response/);
  for (let index = 0; index < 10; index++) await setup.submit("Tell me more");
  assert.equal(page.get("chat-input").disabled, false);
  assert.ok(page.get("chat-messages").children.length <= 19);
  await setup.submit("Undo");
  assert.equal(page.get("coordination-result").hidden, true);
  await setup.submit("Review school meeting");
  await setup.submit("No");
  assert.equal(page.get("coordination-result").hidden, true);
  assert.equal(setup.searches.length, 1); assert.equal(setup.calls.length, calls);
  await setup.submit("Continue activities");
  assert.equal(setup.searches.length, 1);
  assert.equal(page.get("chat-input").placeholder, "Message Family Copilot...");
  await setup.submit("Could we go sooner?");
  assert.equal(setup.searches.length, 2);
  await page.fire("chat-reset"); await setup.submit("October again");
  await page.fire("coordination-review");
  await page.fire("availability-clear"); await settle();
  await setup.submit("Yes, please send Mike an invitation.");
  assert.equal(page.get("coordination-result").hidden, true);
  assert.doesNotMatch(text(page.get("chat-messages")), /she could attend instead/);
  assert.equal(setup.searches.length, 3);
});

test("preference Apply leaves loaded real Calendar dates, grid, freshness and transport untouched", async context => {
  const setup = integratedHarness(context), { page } = setup;
  await sendPageGreeting(page); await settle();
  const dates = [page.get("availability-start").value, page.get("availability-end").value];
  const grid = page.get("availability-grid").children[0], freshness = calendarText(page.get("chat-calendar-status"));
  const calls = structuredClone(setup.calls);
  await page.fire("preferences-edit"); page.get("preference-age").value = "12";
  page.get("preference-area").value = "Zhongshan, Taipei"; page.get("interest-movies").checked = true;
  page.get("interest-basketball").checked = false; page.get("interest-baseball").checked = false;
  for (const value of ["concerts", "museums", "outdoor-play", "science-discovery"]) page.get(`interest-${value}`).checked = false;
  await page.get("preferences-editor").dispatchEvent({ type: "submit", preventDefault() {} }); await settle();
  assert.equal(setup.searches.length, 1); assert.equal(page.get("activity-results").children.length, 0);
  assert.deepEqual(setup.calls, calls); assert.equal(page.get("availability-grid").children[0], grid);
  assert.deepEqual([page.get("availability-start").value, page.get("availability-end").value], dates);
  assert.equal(calendarText(page.get("chat-calendar-status")), freshness);
  await page.fire("chat-retry"); await settle();
  assert.equal(setup.searches.length, 2); assert.equal(setup.searches[1].preferences.ages[0], 12);
  assert.equal(setup.searches[1].preferences.origin.area, "Zhongshan, Taipei");
  assert.equal(setup.searches[1].preferences.interests[0], "movies");
  assert.deepEqual(setup.calls, calls); assert.equal(page.storage.values.size, 0);
  assert.equal(page.packets.length, 0); assert.equal(page.metadata.length, 0); assert.equal(setup.mounted, 1);
});

test("real Calendar teardown is awaited, coalesces pagehide and keeps cleanup failure visible without retries", async context => {
  const cleanup = deferred(), setup = integratedHarness(context, { cleanup }), { page } = setup;
  await sendPageGreeting(page); await settle();
  const first = setup.controller.dispose();
  assert.equal(setup.controller.dispose(), first);
  let settled = false;
  void first.then(() => { settled = true; }, () => { settled = true; });
  const rejection = assert.rejects(first, { message: "calendar_cleanup_unconfirmed" });
  await page.emit("pagehide"); await settle();
  assert.equal(settled, false);
  assert.equal(page.get("chat-calendar-body").hidden, true);
  assert.equal(page.get("activity-results").children.length, 0);
  assert.equal(page.get("chat-input").disabled, true);
  assert.deepEqual(setup.calls.filter(call => call.path === "/api/clear"), [{ path: "/api/clear", body: { reason: "leave" } }]);
  cleanup.resolve(new Response(JSON.stringify({ status: "unknown" })));
  await rejection;
  assert.equal(page.get("calendar-connection").hidden, false);
  assert.match(page.get("calendar-connection").textContent, /could not be confirmed/);
  assert.equal(page.get("chat-calendar-safety").hidden, false);
  assert.match(page.get("chat-calendar-safety").textContent, /unconfirmed/);
  setup.calendar.expand(); setup.calendar.collapse();
  assert.equal(setup.controller.dispose(), first);
  await page.emit("pageshow", { persisted: true }); await settle();
  assert.equal(setup.calls.filter(call => call.path === "/api/clear").length, 1); assert.equal(setup.mounted, 1); assert.equal(setup.timers.size, 0);
  assert.equal(page.get("chat-calendar-body").hidden, true);
});
test("static host loads both domain dependencies before shell startup and forbids network connections", () => {
  const disclosure = fs.readFileSync(require.resolve("../chat/index.html"), "utf8");
  assert.match(disclosure, /<details class="demo-details">/);
  assert.match(disclosure, /<summary>Details<\/summary>/);
  assert.doesNotMatch(disclosure, />[^<]*\bDemo\b/i);
  assert.match(disclosure, /There is no live search or AI/);
  assert.match(disclosure, /dated screenings are unverified/);
  assert.match(disclosure, /Game end time, admission, tickets and travel remain unknown/);
  assert.match(disclosure, /October 1-31, 2026/);
  assert.match(disclosure, /messages do not select dates/);
  const html = fs.readFileSync(require.resolve("../chat/index.html"), "utf8");
  const family = html.match(/<section class="family-section"[\s\S]*?<\/section>/)?.[0];
  assert.ok(family);
  assert.match(family, /<div class="family-heading">\s*<h2 id="family-title">About our family<\/h2>\s*<button id="preferences-edit"/);
  assert.match(family, /aria-label="Edit family preferences"/);
  assert.equal((html.match(/id="preferences-edit"/g) || []).length, 1);
  for (const name of ["Mike", "Debby", "Kimi"]) assert.ok(family.includes(name));
  assert.doesNotMatch(family, /Synthetic/);
  assert.ok(html.indexOf(family) < html.indexOf('id="calendar-host"'));
  assert.match(family, /Kimi <span id="preference-age-summary"[^>]*>\(7\)/);
  assert.match(html, /Kimi's age/);
  assert.doesNotMatch(html, /Age preference|Add child/);
  assert.doesNotMatch(html, /Scripted reference:|id="activity-range"|class="reference"/);
  assert.doesNotMatch(html, /OUR CONVERSATION|Time for something together|Other suggestions welcome|class="mode"|<dt>Children<\/dt>/);
  assert.match(html, /<h1 id="conversation-title">Family <span>Copilot<\/span><\/h1>/);
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.doesNotMatch(html, /class="masthead"|class="brand"/);
  assert.match(html, /Your AI Chief of Staff at Home/);
  assert.doesNotMatch(html, /Less juggling|that was fun/);
  assert.match(html, /connect-src 'none'/); assert.match(html, /maxlength="500"/);
  assert.equal((html.match(/id="calendar-host"/g) || []).length, 1);
  const scripts = [...html.matchAll(/<script defer src="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(scripts, ["../shared/chat-contract.js", "../owner/availability-core.js", "../owner/child-calendar-core.js",
    "../shared/date-selection.js", "../owner/availability-ui.js", "../owner/child-calendar-ui.js",
    "../owner/chat-calendar-template.js", "../owner/chat-calendar-fixtures.js", "../owner/chat-calendar.js",
    "../activity-preview/chat-public-snapshot.js",
    "../activity-preview/chat-assets.js", "../activity-preview/chat-search.js", "../activity-preview/activity-cards.js",
    "conversation-core.js", "ui.js"]);
  assert.match(html, /<link rel="stylesheet" href="\.\.\/activity-preview\/activity-cards\.css">/);
  assert.match(html, /<link rel="stylesheet" href="\.\.\/owner\/chat-calendar\.css">/);
  assert.doesNotMatch(html, /owner\/(?:index\.html|owner\.css|ui\.js)/);
  for (const script of scripts) assert.ok(fs.existsSync(require("node:path").resolve(__dirname, "../chat", script)));
  const context = { FamilyChatContract: Contract, AbortController, URL };
  for (const name of ["fetch", "localStorage", "sessionStorage", "FamilyDates", "FamilyChatCalendar"]) {
    Object.defineProperty(context, name, { get() { throw Error("forbidden_dependency"); } });
  }
  vm.runInNewContext(fs.readFileSync(require.resolve("../chat/conversation-core"), "utf8"), context);
  assert.equal(Contract.validateDemoContext(context.FamilyChatConversation.initialContext()), true);
});