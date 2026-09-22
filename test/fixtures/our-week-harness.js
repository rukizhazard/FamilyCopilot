"use strict";
// Real controllers, multi-listener DOM bus, synthetic adapters; no HTTP listener.
const assert = require("node:assert/strict"), vm = require("node:vm"), fs = require("node:fs");
const A = require("../../owner/availability-core"), C = require("../../owner/child-calendar-core");
const D = require("../../shared/date-selection"), { dateStorage } = require("./date-storage");
const fixture = require("../../browser-fixtures/child-calendar");
const html = fs.readFileSync(require.resolve("../../owner/index.html"), "utf8");
const settle = async () => { for (let i = 0; i < 15; i++) await new Promise(setImmediate); };
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const descendants = n => [n, ...n.children.flatMap(descendants)];
const text = n => [n.textContent, ...n.children.map(text)].join("\n");
function harness(t, { override, meta: overrides = {}, childData, initialDates, sharedActions = true, savedChild, cloneResponses = true,
  chat = false, scenario = "partial" } = {}) {
  const nodes = new Map(), calls = [], packets = [], metadata = [], events = [], timers = new Map(), storage = dateStorage();
  let renderer, rendererInterface, childActions, actionInterface;
  let document, calendarStore;
  let clock = Date.parse("2026-09-17T01:00:00Z"), timer = 0, focus;
  function bus() {
    const handlers = new Map();
    return { addEventListener(name, fn) { if (!handlers.has(name)) handlers.set(name, []); handlers.get(name).push(fn); },
      removeEventListener(name, fn) { handlers.set(name, (handlers.get(name) || []).filter(handler => handler !== fn)); },
      listenerCount() { return [...handlers.values()].reduce((count, values) => count + values.length, 0); },
      dispatchEvent(event) { const results = (handlers.get(event.type) || []).map(fn => fn(event)); return Promise.all(results); } };
  }
  function element(tag = "div") {
    let content = "";
    return Object.assign(bus(), { tag, children: [], value: "", checked: false, hidden: false, disabled: false, dataset: {}, style: {}, attributes: {},
      get textContent() { return content; }, set textContent(value) { content = String(value); this.children = []; },
      append(...items) { for (const item of items) { item.parentNode = this; this.children.push(item); } },
      replaceChildren(...items) { content = ""; this.children = []; this.append(...items); },
      setAttribute(k, v) { this.attributes[k] = v; }, focus() { if (visible(this)) focus = this; },
      open: false, showModal() { assert.equal(this.tag, "dialog"); this.open = true; }, close() { this.open = false; }
    });
  }
  // Define accessors after Object.assign, which otherwise copies their values.
  const make = tag => {
    const n = element(tag); let content = "";
    Object.defineProperty(n, "textContent", { get: () => content, set(value) { content = String(value); n.children = []; } });
    Object.defineProperty(n, "innerHTML", { set() { throw Error("unsafe_html"); } });
    Object.defineProperties(n, {
      ownerDocument: { get: () => document }, nodeType: { value: tag === "#text" ? 3 : 1 },
      childNodes: { get: () => n.children }, id: { get: () => n.attributes.id },
      isConnected: { get: () => { let parent = n; while (parent.parentNode) parent = parent.parentNode; return parent === root; } }
    });
    n.contains = target => !!target && descendants(n).includes(target);
    n.setAttribute = (key, value) => {
      n.attributes[key] = String(value);
      if (key === "id") nodes.set(String(value), n);
      if (key === "class") n.className = String(value);
      if (key.startsWith("data-")) n.dataset[key.slice(5)] = String(value);
    };
    n.addText = value => { content += value; };
    n.replaceChildren = (...items) => {
      content = ""; for (const child of n.children) child.parentNode = null;
      n.children = []; n.append(...items);
    }; return n;
  };
  // Model the actual static hierarchy, inherited hidden state and closed Details.
  // This tests disclosure visibility, not browser layout or physical keyboard input.
  const root = make("document"), stack = [root];
  for (const [token] of (chat ? '<div id="calendar-host"></div>' : html).matchAll(/<!--[\s\S]*?-->|<![^>]*>|<[^>]+>|[^<]+/g)) {
    if (token.startsWith("<!")) continue;
    if (token.startsWith("</")) { stack.pop(); continue; }
    if (!token.startsWith("<")) { stack.at(-1).addText(token); continue; }
    const tag = token.match(/^<(\w+)/)[1], n = make(tag);
    for (const [, key, value] of token.matchAll(/\s([\w-]+)(?:="([^"]*)")?/g)) n.attributes[key] = value ?? "";
    n.value = n.attributes.value || ""; n.className = n.attributes.class || "";
    for (const key of ["hidden", "disabled", "open"]) n[key] = Object.hasOwn(n.attributes, key);
    if (n.attributes.id) nodes.set(n.attributes.id, n);
    stack.at(-1).append(n);
    if (!["meta", "link", "input", "br", "hr", "img"].includes(tag)) stack.push(n);
  }
  function visible(node) {
    for (let child = node, parent = node; parent; child = parent, parent = parent.parentNode) {
      if (parent.hidden) return false;
      if (parent !== node && parent.tag === "details" && !parent.open && child.tag !== "summary") return false;
    }
    return !!node;
  }
  const get = id => nodes.get(id) || null;
  const meta = { "owner-csrf": "synthetic-csrf", "owner-mode": "synthetic", "owner-cache": "memory", "owner-range": "configurable-v1",
    "owner-saved": "preserve-v1", "owner-contract": "bounded-availability-v5", "child-mode": "synthetic", "child-cache": "child-saved-v1-memory", ...overrides };
  const label = make("span");
  document = Object.assign(bus(), { getElementById: get, createElement: make, createTextNode(value) { const element = make("#text"); element.textContent = value; return element; }, hidden: false,
    querySelector(selector) { return selector === ".shell-date" ? label : { content: meta[selector.match(/name="([^"]+)"/)?.[1]] }; } });
  const window = bus();
  document.defaultView = window;
  const dispatch = window.dispatchEvent;
  window.dispatchEvent = event => { events.push({ type: event.type, detail: structuredClone(event.detail) }); return dispatch(event); };
  Object.defineProperty(document, "activeElement", { get: () => focus });
  window.addEventListener("child-week-changed", e => packets.push(structuredClone(e.detail)));
  window.addEventListener("week-safety-changed", e => metadata.push(structuredClone(e.detail)));
  if (initialDates) D.createStore(() => storage).write(...initialDates);
  const parentWindow = chat ? A.forSyntheticOctober().liveWindow : A.liveWindow;
  const parentData = () => ({ window: parentWindow, checkedAt: "2026-09-17T00:59:00Z", synthetic: meta["owner-mode"] === "synthetic", cleanup: "workflow_disabled",
    people: [0, 1].map(person => ({ person, status: "checked", slots: Array(parentWindow.slots).fill("busy") })) });
  const fetch = async (path, options) => {
    const body = JSON.parse(options.body); calls.push({ path, body, options });
    assert.ok(["/api/availability", "/api/clear", "/api/status", "/api/child/saved", "/api/child/edit", "/api/child/clear",
      ...(meta["child-sync"] === "child-sync-v1" ? ["/api/child/sync"] : [])].includes(path), `UI must not call unapproved operations: ${path}`);
    assert.equal(options.credentials, "omit"); assert.equal(options.cache, "no-store"); assert.equal(options.redirect, "error");
    const response = await override?.(path, body, options);
    // Single-use stream tests can own the response directly: a cloned tee's
    // cancel promise otherwise waits forever for the unconsumed original branch.
    if (response) return cloneResponses ? response.clone() : response;
    let data;
    if (path === "/api/availability") data = { ...parentData(), cached: body.cacheOnly === true };
    else if (path === "/api/clear") { if (!body.reason) savedChild = undefined; data = { status: "cleared", cleanup: "not_requested" }; }
    else if (path === "/api/status") data = { status: "idle", cleanup: "not_requested" };
    else if (path.endsWith("/saved")) data = savedChild || { status: "cache_missing" };
    else if (path.endsWith("/sync")) data = savedChild || { status: "source_missing" };
    else { if (!body.reason) savedChild = undefined; data = { status: "cleared" }; }
    return new Response(JSON.stringify(data));
  };
  const context = { document, window, OwnerAvailability: { ...A,
    forSyntheticOctober() {
      const month = A.forSyntheticOctober();
      return { ...month, freshness: data => month.freshness(data, clock), childFreshness: data => month.childFreshness(data, clock),
        childDisplay: (data, range, synthetic) => month.childDisplay(data, range, synthetic, clock),
        childDayLayout: (data, range, synthetic) => month.childDayLayout(data, range, synthetic, clock) };
    },
    freshness: data => A.freshness(data, clock), childFreshness: data => A.childFreshness(data, clock),
    childDisplay: (data, range, synthetic) => A.childDisplay(data, range, synthetic, clock),
    childDayLayout: (data, range, synthetic) => A.childDayLayout(data, range, synthetic, clock) },
    ChildCalendar: { ...C, project: (data, disclosure) => C.project(data, disclosure, clock) },
    FamilyDates: { ...D, createStore: (getStorage = () => storage) => D.createStore(getStorage) }, fetch,
    Date: class extends Date { static now() { return clock; } }, AbortController, AbortSignal, TextEncoder, TextDecoder, Uint8Array, Response,
    crypto: { randomUUID: () => "11111111-1111-4111-8111-111111111111" },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    Option: function(content, value) { const n = make("option"); n.textContent = content; n.value = value; return n; },
    setTimeout(fn, ms) { const id = ++timer; timers.set(id, { fn, at: clock + ms }); return id; }, clearTimeout(id) { timers.delete(id); } };
  for (const target of [context, window]) for (const name of ["localStorage", "sessionStorage", "indexedDB", "caches"])
    Object.defineProperty(target, name, { get() { throw Error("calendar_storage_forbidden"); } });
  const ctx = vm.createContext(context);
  if (chat) context.fetch = () => { throw new Error("native_fetch_forbidden"); };
  const files = chat ? ["../../shared/chat-contract.js", "../../owner/availability-ui.js", "../../owner/child-calendar-ui.js",
    "../../owner/ui.js", "../../owner/chat-calendar-template.js", "../../owner/chat-calendar-fixtures.js", "../../owner/chat-calendar.js"]
    : ["../../owner/availability-ui.js", "../../owner/child-calendar-ui.js"];
  for (const file of files) {
    if (file.endsWith("/child-calendar-ui.js") && context.FamilyWeekRenderer) {
      rendererInterface = context.FamilyWeekRenderer;
      context.FamilyWeekRenderer = { register(fn) { renderer = fn; return rendererInterface.register(fn); } };
    }
    if (file.endsWith("/child-calendar-ui.js") && !chat) {
      const actions = actionInterface = context.FamilyWeekActions;
      // Independent renderer tests may call saved() directly without a parent
      // request. This is a test-only seam, not a hidden DOM action or provider API.
      context.FamilyWeekActions = { register(value) {
        childActions = value;
        return sharedActions ? actions.register(value) : undefined;
      } };
    }
    vm.runInContext(fs.readFileSync(require.resolve(file), "utf8"), ctx);
    if (file.endsWith("/chat-calendar-fixtures.js")) {
      const create = context.FamilyCalendarFixtures.create;
      context.FamilyCalendarFixtures = { create(options) {
        const transport = create({ ...options, scenario: () => scenario });
        calendarStore = transport.storage;
        if (initialDates) D.createStore(() => transport.storage).write(...initialDates);
        return { ...transport, async fetch(path, options) {
          const body = JSON.parse(options.body); calls.push({ path, body, options });
          const response = await override?.(path, body, options);
          return response || transport.fetch(path, options);
        } };
      } };
    }
  }
  const fire = (id, type = "click") => get(id).dispatchEvent({ type });
  const h = { get, calls, packets, metadata, events, storage, document, parentData, fire,
    mount: (host = get("calendar-host"), options = { version: "familycopilot.chat.v1", mode: "synthetic" }) => context.FamilyChatCalendar.mountCalendar(host, options),
    calendarDates: () => D.createStore(() => calendarStore).read(),
    setScenario(value) { scenario = value; },
    resources: () => ({ timers: timers.size, listeners: document.listenerCount() + window.listenerCount() + descendants(root).reduce((sum, node) => sum + node.listenerCount(), 0) }),
    visible: id => visible(typeof id === "string" ? get(id) : id),
    details: descendants(root).find(n => n.className === "availability-details"),
    visibleText: () => descendants(root).filter(n => visible(n)).map(n => n.textContent).join("\n"),
    savedSnapshot: () => structuredClone(savedChild),
    renderChild(...args) { return renderer?.(...args); },
    registerRenderer(fn) { return rendererInterface.register(fn); },
    registerActions(value) { return actionInterface.register(value); },
    get focus() { return focus; }, get now() { return clock; },
    elapseWithoutTimers(ms) { clock += ms; },
    all: () => [...nodes.values()].map(text).join("\n"),
    childBlocks: () => descendants(get("availability-grid")).filter(n => n.className === "child-event" || n.className === "child-all-day"),
    parentBlocks: () => descendants(get("availability-grid")).filter(n => n.className === "week-run"),
    emit(type, detail = {}) { return window.dispatchEvent({ type, ...detail }); },
    childActions: () => childActions,
    setSaved(value) { savedChild = structuredClone(value); },
    async seedSaved(disclosure = "details") {
      const data = childData ? structuredClone(childData) : await fixture.perform({ action: "import", disclosure, record() {} });
      // Simulate a completed projected snapshot, not a new UI import or repair on read.
      savedChild = { status: "saved", access: { person: "Kimi", guardian: true, disclosure, sourceName: "Fictional shared source <not real>" }, data: C.project(data, disclosure, clock) };
    },
    async openSaved(disclosure = "details") { await h.seedSaved(disclosure); await childActions.saved(); await settle(); },
    range(start, end) { get("availability-start").value = start; get("availability-end").value = end; return fire("availability-end", "input"); },
    async advance(ms) {
      clock += ms;
      for (const [id, timer] of [...timers]) if (timer.at <= clock && timers.has(id)) { timers.delete(id); timer.fn(); }
      await settle();
    }
  };
  return h;
}
module.exports = { harness, settle, deferred, descendants, text };