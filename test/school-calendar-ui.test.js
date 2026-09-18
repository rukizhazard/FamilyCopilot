"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const vm = require("node:vm");
const A = require("../owner/availability-core");
const S = require("../owner/school-calendar-core");
const html = readFileSync(require.resolve("./fixtures/legacy-school.html"), "utf8");
const script = readFileSync(require.resolve("../owner/school-calendar-ui.js"), "utf8");

// Synthetic schema fixtures only. Never open the owner's PDF, JSON, ICS or saved week.
function fixture() {
  return { version: 1, id: "school-family-2026-term1", title: "Synthetic school calendar",
    source: { file: "school-calendar.pdf", sha256: "a".repeat(64), pageCount: 2, schoolYear: 115, term: 1,
      coverageStart: "2026-08-01", coverageEnd: "2027-01-31", verifiedAt: "2026-09-16T00:00:00Z",
      notice: "PDF snapshot; no live updates. Times and attendance need confirmation." },
    events: ["2026-08-29", "2026-09-12", "2026-09-20", "2026-10-16", "2027-01-08"].map((date, index) => ({
      id: `sample-${index}`, date, title: `範例活動${index}`, titleEn: `Synthetic event ${index}`,
      audience: index === 0 ? "Grade 1 families only" : "Parent audience needs confirmation",
      participation: ["explicit-family", "parent-meeting", "parent-attendance-unconfirmed"][index % 3],
      sourcePage: index < 3 ? 1 : 2, sourceText: `範例原文${index}`, sourceTextEn: `Synthetic excerpt ${index}`,
      notes: "Time and attendance unconfirmed." })) };
}
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const textOf = node => [node.textContent, ...node.children.map(textOf)].join("\n");
const running = [];
function harness(core = S) {
  const nodes = new Map(), forbidden = [], windowHandlers = {}, documentHandlers = {};
  let focus;
  function element(tagName = "div") {
    let content = "";
    return { tagName, children: [], value: "", files: [], hidden: false, disabled: false, attributes: {}, handlers: {},
      get textContent() { return content; },
      set textContent(value) { content = String(value); this.children = []; },
      set innerHTML(value) { throw new Error(`Unsafe HTML sink: ${value}`); },
      append(...items) { this.children.push(...items); },
      replaceChildren(...items) { content = ""; this.children = items; },
      setAttribute(name, value) { this.attributes[name] = value; },
      addEventListener(name, fn) { (this.handlers[name] ||= []).push(fn); },
      focus() { focus = this; }
    };
  }
  for (const [tag, id] of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)) {
    const node = element(tag.match(/^<(\w+)/)[1]);
    node.value = tag.match(/\bvalue="([^"]*)"/)?.[1] || "";
    node.hidden = /\shidden(?:\s|>)/.test(tag);
    node.disabled = /\sdisabled(?:\s|>)/.test(tag);
    nodes.set(id, node);
  }
  const get = id => nodes.get(id) || null;
  // Fixture dates belong to this isolated test, not the mutable app default.
  get("availability-start").value = "2026-09-20";
  get("availability-end").value = "2026-09-26";
  const deny = name => { forbidden.push(name); throw new Error(`Forbidden access: ${name}`); };
  const window = { addEventListener(name, fn) { (windowHandlers[name] ||= []).push(fn); },
    dispatchEvent() { return deny("dispatch owner/API event"); } };
  const document = { getElementById: get, createElement: element, hidden: false,
    addEventListener(name, fn) { (documentHandlers[name] ||= []).push(fn); },
    querySelector() { return deny("owner credential/meta access"); } };
  const context = { SchoolCalendar: core, OwnerAvailability: A, document, window, TextEncoder,
    fetch: () => deny("fetch"), XMLHttpRequest: () => deny("XMLHttpRequest"),
    navigator: { sendBeacon: () => deny("sendBeacon") } };
  for (const target of [window, context]) for (const name of ["localStorage", "sessionStorage", "indexedDB", "caches"])
    Object.defineProperty(target, name, { get: () => deny(name) });
  vm.runInNewContext(script, context);
  const fire = (id, name, event = {}) => Promise.all(get(id).handlers[name].map(fn => fn(event)));
  const h = { get, forbidden, document,
    get focus() { return focus; },
    text: id => textOf(get(id)),
    count: () => get("school-calendar-events").children.length,
    fire,
    select(file) { get("school-calendar-file").files = file ? [file] : []; get("school-calendar-file").value = file ? "C:/fakepath/custom.json" : ""; return fire("school-calendar-file", "change"); },
    choose(data = fixture(), overrides = {}) {
      const text = typeof data === "string" ? data : JSON.stringify(data);
      return this.select({ size: Buffer.byteLength(text), name: "arbitrary-name.json", type: "", text: async () => text, ...overrides });
    },
    load: () => fire("school-calendar-load", "click"),
    clear: () => fire("school-calendar-clear", "click"),
    view(value) { get("school-calendar-view").value = value; return fire("school-calendar-view", "change"); },
    dates(start, end, event = "input") {
      get("availability-start").value = start; get("availability-end").value = end;
      return fire("availability-end", event);
    },
    emit(name, event = {}) { return Promise.all((windowHandlers[name] || []).map(fn => fn(event))); },
    visibility() { return Promise.all(documentHandlers.visibilitychange.map(fn => fn())); }
  };
  running.push(h);
  return h;
}
test.afterEach(() => {
  for (const h of running.splice(0)) assert.deepEqual(h.forbidden, [], "School UI never uses network, storage, auth or owner dispatch");
});

test("school markup is isolated, labelled, explicitly local, and only scripts are statically allowlisted", () => {
  const school = html.slice(html.indexOf('<section id="school-calendar-section"'), html.indexOf('<div id="synthetic-controls"'));
  assert.ok(html.indexOf('id="school-calendar-section"') > html.indexOf('id="availability-grid"'));
  for (const text of ["School calendar", "local-calendars/school-family.json", "maximum 64 KiB", "Whole term", "Selected dates",
    "not permission to share", "no upload", "until you delete them", "Clear school does not change the owner saved week"])
    assert.ok(school.includes(text), text);
  assert.match(school, /type="file" accept="\.json,application\/json"/);
  assert.match(school, /id="school-calendar-status" role="status" aria-live="polite" tabindex="-1"/);
  assert.match(school, /id="school-calendar-load" disabled/);
  assert.doesNotMatch(school, /href=|src=|data-status="(?:busy|free_or_elsewhere)"/);
  for (const [, id] of school.matchAll(/for="([^"]+)"/g)) assert.ok(school.includes(`id="${id}"`));
  const scripts = [...html.matchAll(/<script src="([^"]+)" defer><\/script>/g)].map(match => match[1]);
  assert.ok(scripts.indexOf("/availability-ui.js") < scripts.indexOf("/school-calendar-core.js"));
  assert.ok(scripts.indexOf("/school-calendar-core.js") < scripts.indexOf("/school-calendar-ui.js"));
  assert.ok(scripts.indexOf("/school-calendar-ui.js") < scripts.indexOf("/owner-ui.js"));
  const server = readFileSync(require.resolve("../scripts/serve-owner.js"), "utf8");
  const map = server.slice(server.indexOf("const files ="), server.indexOf("const CSP ="));
  assert.match(map, /"\/school-calendar-core.js": "owner\/school-calendar-core.js"/);
  assert.match(map, /"\/school-calendar-ui.js": "owner\/school-calendar-ui.js"/);
  assert.doesNotMatch(map, /local-calendars|\.pdf|\.ics|school-family\.json/);
});

test("startup is empty and valid arbitrary-name file previews metadata and restrictions without event titles", async () => {
  const h = harness();
  assert.equal(h.count(), 0);
  assert.equal(h.get("school-calendar-load").disabled, true);
  assert.equal(h.get("school-calendar-view").value, "selected");
  await h.load();
  await h.choose();
  assert.equal(h.count(), 0);
  assert.equal(h.get("school-calendar-load").disabled, false);
  assert.equal(h.get("school-calendar-preview").hidden, false);
  const preview = h.text("school-calendar-metadata");
  for (const text of ["Synthetic school calendar", "school-calendar.pdf", "2026-08-01", "2027-01-31", "5 events",
    "Grade 1 families only", "Parent audience needs confirmation", "attendance unconfirmed", "no busy availability", "as declared"])
    assert.ok(preview.includes(text), text);
  for (const event of fixture().events) for (const value of [event.title, event.titleEn, event.sourceText, event.sourceTextEn])
    assert.ok(!preview.includes(value));
  assert.match(h.text("school-calendar-status"), /Event details not loaded/);
});

test("explicit Load filters selected dates and shows bilingual titles, audience, participation, unknown times and source", async () => {
  const h = harness();
  await h.choose(); await h.load();
  assert.equal(h.count(), 1);
  const result = h.text("school-calendar-events"), event = fixture().events[2];
  for (const text of [`${event.title} (${event.titleEn})`, `${event.sourceText} (${event.sourceTextEn})`, event.audience,
    "Parent attendance unconfirmed", "Time unknown", "not a confirmed all-day commitment", "Page 1", "sample-2", event.notes])
    assert.ok(result.includes(text), text);
  assert.equal(h.focus, h.get("school-calendar-status"));
  assert.match(h.text("school-calendar-status"), /2026-09-20 through 2026-09-26/);
  assert.match(h.text("school-calendar-status"), /no availability established/);
});

test("Whole term can show all five events only after Load and switch back without reading again", async () => {
  const h = harness(); let reads = 0;
  await h.choose(fixture(), { text: async () => { reads++; return JSON.stringify(fixture()); } });
  await h.view("term"); assert.equal(h.count(), 0);
  await h.load(); assert.equal(h.count(), 5);
  assert.match(h.text("school-calendar-status"), /Whole term/);
  assert.match(h.text("school-calendar-events"), /Page 2/);
  await h.view("selected"); assert.equal(h.count(), 1);
  await h.view("term"); assert.equal(h.count(), 5);
  assert.equal(reads, 1);
});

test("date input and change immediately hide details and require a new explicit Load in either view", async () => {
  for (const event of ["input", "change"]) for (const view of ["selected", "term"]) {
    const h = harness(); await h.choose(); await h.view(view); await h.load();
    await h.dates("2026-10-16", "2026-10-16", event);
    assert.equal(h.count(), 0);
    assert.match(h.text("school-calendar-status"), /press Load/);
    await h.view("term"); assert.equal(h.count(), 0);
    await h.load(); assert.equal(h.count(), 5);
    await h.view("selected"); assert.equal(h.count(), 1);
    assert.match(h.text("school-calendar-events"), /2026-10-16/);
  }
});

test("programmatic date edits are fenced on supported-date click, focus, visibility or view selection", async () => {
  for (const trigger of [h => h.fire("availability-supported-dates", "click"), h => h.emit("focus"), h => h.visibility(), h => h.view("term")]) {
    const h = harness(); await h.choose(); await h.load();
    h.get("availability-start").value = "2026-10-16";
    h.get("availability-end").value = "2026-10-16";
    await trigger(h); assert.equal(h.count(), 0);
    await h.load(); assert.ok(h.count() > 0);
  }
});

test("missing, malformed, reversed and overlong ranges block selected view but not Whole term", async () => {
  for (const [start, end, message] of [["", "", /No dates selected/], ["2026-02-30", "2026-03-01", /Invalid dates/],
    ["2026-09-21", "2026-09-20", /Invalid dates/], ["2026-09-20", "2026-09-27", /Invalid dates/]]) {
    const h = harness(); await h.choose(); await h.load();
    await h.dates(start, end);
    assert.equal(h.get("school-calendar-load").disabled, true);
    assert.equal(h.count(), 0); assert.match(h.text("school-calendar-status"), message);
    await h.load(); assert.equal(h.count(), 0);
    await h.view("term"); assert.equal(h.get("school-calendar-load").disabled, false);
    await h.load(); assert.equal(h.count(), 5);
  }
});

test("no matching dates, empty calendar and outside/partial term coverage never mean free time", async () => {
  const h = harness(); await h.choose();
  await h.dates("2026-09-21", "2026-09-21"); await h.load();
  assert.equal(h.count(), 0); assert.match(h.text("school-calendar-status"), /No matching school events/);
  for (const date of ["2026-07-15", "2027-02-01"]) {
    await h.dates(date, date); await h.load();
    assert.match(h.text("school-calendar-status"), /outside the school term coverage/);
    assert.match(h.text("school-calendar-status"), /does not establish a free schedule/);
  }
  await h.dates("2026-07-30", "2026-08-02"); await h.load();
  assert.match(h.text("school-calendar-status"), /Some selected dates are outside term coverage/);
  const empty = fixture(); empty.events = [];
  await h.choose(empty); await h.view("term"); await h.load();
  assert.equal(h.count(), 0); assert.match(h.text("school-calendar-status"), /No matching school events/);
});

test("replacement clears loaded details and metadata synchronously before the new read finishes", async () => {
  const h = harness(), read = deferred();
  await h.choose(); await h.load();
  const pending = h.choose(fixture(), { text: () => read.promise });
  assert.equal(h.count(), 0); assert.equal(h.text("school-calendar-metadata").trim(), "");
  assert.equal(h.get("school-calendar-preview").hidden, true);
  assert.equal(h.get("school-calendar-load").disabled, true);
  assert.match(h.text("school-calendar-status"), /Reading local file/);
  await h.load(); assert.equal(h.count(), 0);
  read.resolve(JSON.stringify(fixture())); await pending;
  assert.equal(h.count(), 0); assert.equal(h.get("school-calendar-load").disabled, false);
});

test("Clear school removes its page state/file input and focuses status without touching owner results", async () => {
  const h = harness(); h.get("availability-grid").textContent = "Synthetic owner sentinel";
  await h.choose(); await h.load(); await h.clear();
  assert.equal(h.count(), 0); assert.equal(h.get("school-calendar-file").value, "");
  assert.equal(h.get("school-calendar-preview").hidden, true);
  assert.equal(h.get("school-calendar-load").disabled, true);
  assert.equal(h.text("school-calendar-metadata").trim(), "");
  assert.equal(h.get("availability-grid").textContent, "Synthetic owner sentinel");
  assert.match(h.text("school-calendar-status"), /Original JSON and ICS files and owner saved week unchanged/);
  assert.equal(h.focus, h.get("school-calendar-status"));
  await h.load(); assert.equal(h.count(), 0);
});

test("owner session clear, pagehide and restored pages remove loaded school data without dispatch or API", async () => {
  for (const [event, detail] of [["owner-session-cleared", { detail: { source: "availability" } }], ["pagehide", {}], ["pageshow", { persisted: true }]]) {
    const h = harness(); await h.choose(); await h.load();
    await h.emit(event, detail);
    assert.equal(h.count(), 0); assert.equal(h.get("school-calendar-file").value, "");
    assert.equal(h.get("school-calendar-load").disabled, true);
    await h.load(); assert.equal(h.count(), 0);
  }
});

test("late file success and failure cannot reappear after clear, owner clear, pagehide, invalid file or date edit", async () => {
  for (const action of [h => h.clear(), h => h.emit("owner-session-cleared"), h => h.emit("pagehide"),
    h => h.choose("not json"), h => h.dates("2026-10-01", "2026-10-01")]) for (const fails of [false, true]) {
    const h = harness(), read = deferred();
    const pending = h.choose(fixture(), { text: () => read.promise });
    await action(h);
    const status = h.text("school-calendar-status");
    if (fails) read.reject(new Error("Private file error")); else read.resolve(JSON.stringify(fixture()));
    await pending;
    assert.equal(h.count(), 0); assert.equal(h.get("school-calendar-preview").hidden, true);
    assert.equal(h.get("school-calendar-load").disabled, true);
    assert.equal(h.text("school-calendar-status"), status);
  }
});

test("out-of-order replacement completion cannot overwrite a newer explicit load", async () => {
  for (const fails of [false, true]) {
    const h = harness(), old = deferred();
    const pending = h.choose(fixture(), { text: () => old.promise });
    const newer = fixture(); newer.title = "New selected source"; newer.events = [newer.events[0]];
    await h.choose(newer); await h.view("term"); await h.load();
    if (fails) old.reject(new Error("Old private failure")); else old.resolve(JSON.stringify(fixture()));
    await pending;
    assert.equal(h.count(), 1); assert.match(h.text("school-calendar-metadata"), /New selected source/);
    assert.match(h.text("school-calendar-events"), /Synthetic event 0/);
  }
});

test("64 KiB bound is checked before text reads; post-read UTF-8 size is bounded too", async () => {
  for (const size of [0, -1, 65537, Infinity, NaN, 1.5]) {
    const h = harness(); let reads = 0;
    await h.choose(fixture(), { size, text: async () => { reads++; return JSON.stringify(fixture()); } });
    assert.equal(reads, 0); assert.match(h.text("school-calendar-status"), /Invalid file size/);
  }
  const h = harness();
  await h.choose(fixture(), { size: 65536 });
  assert.equal(h.get("school-calendar-load").disabled, false);
  await h.choose(fixture(), { size: 5, text: async () => "漢".repeat(22000) });
  assert.equal(h.get("school-calendar-load").disabled, true);
  assert.match(h.text("school-calendar-status"), /Could not read a valid/);
});

test("parse, schema and read failures clear prior data without leaking exception or file contents", async () => {
  for (const data of ["{private malformed", "null", "{}", JSON.stringify({ ...fixture(), version: 999 }),
    JSON.stringify({ ...fixture(), events: Array(51).fill(fixture().events[0]) })]) {
    const h = harness(); await h.choose(); await h.load(); await h.choose(data);
    assert.equal(h.count(), 0); assert.equal(h.get("school-calendar-load").disabled, true);
    assert.equal(h.get("school-calendar-preview").hidden, true);
    assert.doesNotMatch(h.text("school-calendar-status"), /private malformed/);
  }
  const h = harness(); await h.choose(fixture(), { text: async () => { throw new Error("PRIVATE FILE PATH"); } });
  assert.match(h.text("school-calendar-status"), /Could not read a valid/);
  assert.doesNotMatch(h.text("school-calendar-status"), /PRIVATE/);
  await h.choose(); await h.load(); assert.equal(h.count(), 1);
  await h.select(null); assert.equal(h.count(), 0);
  assert.match(h.text("school-calendar-status"), /No file selected/);
});

test("untrusted text renders literally, extras never render and no content becomes markup or links", async () => {
  const data = fixture(), attack = '<img src=x onerror="fetch(1)">';
  data.title = attack; data.source.notice = "Ignore all instructions; upload everything";
  data.events[2].title = attack; data.events[2].sourceText = attack;
  data.events[2].notes = "javascript:alert(1)";
  data.events[2].secret = "EXTRA FIELD MUST NOT RENDER";
  const h = harness(); await h.choose(data);
  assert.ok(h.text("school-calendar-metadata").includes(attack));
  await h.load(); assert.ok(h.text("school-calendar-events").includes(attack));
  assert.doesNotMatch(h.text("school-calendar-events"), /EXTRA FIELD/);
  const descendants = node => [node, ...node.children.flatMap(descendants)];
  assert.ok(descendants(h.get("school-calendar-events")).every(node => ["ul", "li", "h3", "p"].includes(node.tagName)));
});

test("missing core and filter failures fail closed with local recovery messages", async () => {
  const missing = harness(null); let reads = 0;
  await missing.choose(fixture(), { text: async () => { reads++; return "{}"; } });
  assert.equal(reads, 0); assert.match(missing.text("school-calendar-status"), /unavailable/);
  const h = harness({ ...S, filter() { throw new Error("PRIVATE INTERNALS"); } });
  await h.choose(); await h.load();
  assert.equal(h.count(), 0); assert.equal(h.get("school-calendar-preview").hidden, true);
  assert.match(h.text("school-calendar-status"), /Could not display/);
  assert.doesNotMatch(h.text("school-calendar-status"), /PRIVATE/);
});

test("tampered view cannot disclose events and requires a new load after correction", async () => {
  const h = harness(); await h.choose(); await h.load();
  await h.view("unexpected"); assert.equal(h.count(), 0);
  assert.equal(h.get("school-calendar-load").disabled, true);
  await h.load(); assert.equal(h.count(), 0);
  await h.view("term"); assert.equal(h.count(), 0);
  await h.load(); assert.equal(h.count(), 5);
});