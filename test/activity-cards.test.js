"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createHash } = require("node:crypto");
const { activityRequest } = require("./fixtures/chat-context");
const contract = require("../shared/chat-contract");
const fixtures = require("../activity-preview/chat-activity-fixtures");
const assets = require("../activity-preview/chat-assets");
const { searchActivities } = require("../activity-preview/chat-search");
const { renderActivityCards } = require("../activity-preview/activity-cards");
const result = () => searchActivities(activityRequest(), { signal: new AbortController().signal });

function dom() {
  class Element {
    constructor(tag, document) {
      this.tag = tag; this.ownerDocument = document; this.children = []; this.attributes = {};
      this.listeners = new Map(); this.textContent = ""; this.hidden = false;
    }
    append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
    remove() { this.parent.children = this.parent.children.filter(child => child !== this); }
    setAttribute(name, value) { this.attributes[name] = value; }
    addEventListener(name, listener) { this.listeners.set(name, listener); }
    removeEventListener(name, listener) { if (this.listeners.get(name) === listener) this.listeners.delete(name); }
    fire(name) { this.listeners.get(name)?.(); }
    set innerHTML(value) { throw new Error("HTML injection forbidden"); }
  }
  const document = { createElement: tag => new Element(tag, document) };
  return document.createElement("div");
}
const all = element => [element, ...element.children.flatMap(all)];
const tags = (element, tag) => all(element).filter(node => node.tag === tag);
const text = element => all(element).map(node => node.textContent).join(" ");
const visible = element => element.hidden || element.tag === "details" ? "" :
  [element.textContent, ...element.children.map(visible)].join(" ");

test("cards show exact time, evidence, synthetic provenance and essential unknowns outside details", async () => {
  const host = dom();
  const data = await result();
  const before = structuredClone(data);
  const renderer = renderActivityCards(host, data);
  assert.deepEqual(Object.keys(renderer), ["dispose"]);
  assert.equal(tags(host, "article").length, 2);
  assert.equal(tags(host, "img").length, 2);
  assert.match(visible(host), /Demo; no live retrieval/);
  assert.doesNotMatch(visible(host), /synthetic/i);
  assert.match(visible(host), /Calendar availability not checked/);
  assert.match(visible(host), /Travel.*unknown/);
  assert.match(visible(host), /Cost.*Unknown/);
  assert.match(visible(host), /Tickets.*Availability unknown/);
  assert.match(visible(host), /Age guidance unknown/);
  assert.match(visible(host), /Recommended: 6\+/);
  assert.match(visible(host), /Explore these ideas/);
  assert.match(text(host), /Original demo artwork/);
  assert.deepEqual(tags(host, "time").map(node => node.dateTime).sort(), data.items.flatMap(item => [item.startAt, item.endAt]).sort());
  assert.ok(tags(host, "article").every(node => node.attributes["data-activity-id"]));
  assert.deepEqual(data, before);
});
test("public cards show saved provenance and never invent a film time or reuse fictional artwork", async () => {
  const request = activityRequest();
  const context = vm.createContext({ AbortSignal, structuredClone, FamilyChatContract: contract,
    FamilyChatActivityFixtures: require("../activity-preview/chat-public-snapshot") });
  vm.runInContext(fs.readFileSync(require.resolve("../activity-preview/chat-search"), "utf8"), context);
  const data = await context.FamilyChatActivities.searchActivities(request, { signal: new AbortController().signal });
  const host = dom(); renderActivityCards(host, data);
  assert.match(visible(host), /新北中信特攻 vs 福爾摩沙夢想家/);
  assert.match(visible(host), /preferred team: 新北中信特攻/);
  assert.match(visible(host), /Forgotten Island/);
  assert.match(visible(host), /Showtimes unverified/);
  assert.ok(tags(host, "a").some(link => link.textContent === "Choose a showtime"));
  assert.match(text(host), /Checked 2026-09-20T09:29:03Z; saved public data/);
  assert.doesNotMatch(visible(host), /Age guidance.*Unknown|Cost.*Unknown|Time and distance unknown|Availability unknown|2026-10-10T/);
  assert.match(visible(host), /Oct 10.*17:00/);
  assert.match(visible(host), /Saved public sources \/ Incomplete shortlist \/ Availability unverified/);
  assert.match(visible(host), /110 cm\+: ticket required/);
  assert.match(visible(host), /Protected \(6\+\).*Ages 6-11 must be accompanied by an adult/);
  assert.match(visible(host), /Indoor cinema \/ 109 min/);
  assert.match(visible(host), /Online fee: NT\$20\/ticket/);
  assert.match(text(host), /Visitor information checked 2026-09-20/);
  assert.ok(tags(host, "a").some(link => link.href === "https://tix.ctbcsports.com/DEA/UTK0101_"));
  assert.ok(tags(host, "a").filter(link => link.textContent === "Venue map").every(link => !/Child|Parent A|Parent B|origin=/.test(link.href)));
  assert.equal(all(host).filter(element => element.className === "fc-activity-reason").length, 2);
  assert.equal(tags(host, "img").length, 3);
  assert.match(visible(host), /GAME 5.*10\/10 \/ 17:00 Taipei.*AWAY.*福爾摩沙夢想家.*17:00.*VS.*HOME.*新北中信特攻/);
  assert.deepEqual(tags(host, "img").map(image => image.alt), ["Formosa Dreamers team logo", "New Taipei CTBC DEA team logo", "Forgotten Island theatrical poster"]);
  assert.match(text(host), /Internal demo reference only/);
  assert.match(text(host), /Public reuse permission has not been confirmed/);
  assert.equal(tags(host, "a").filter(link => link.textContent === "Image source").length, 2);
  assert.equal(tags(host, "time").length, 1);
  assert.doesNotMatch(text(host), /Skybound|Comets|Recommended: 6\+/);
  assert.ok(tags(host, "a").some(link => link.href === "https://tpbl.basketball/schedule/27539"));
  tags(host, "img")[0].fire("error");
  assert.match(visible(host), /福爾摩沙夢想家/);
  assert.equal(tags(host, "img")[0].hidden, true);
  assert.equal(tags(host, "img")[1].hidden, false);
  tags(host, "img")[1].fire("error");
  assert.match(visible(host), /新北中信特攻/);
});

test("public demo references require exact source, category, event and activity URL", () => {
  const snapshot = require("../activity-preview/chat-public-snapshot");
  for (const range of [{ startDate: "2026-10-09", endDate: "2026-10-11" },
    { startDate: "2026-09-19", endDate: "2026-09-20" }]) {
    const pool = snapshot.createPool({ ...range, timeZone: "Asia/Taipei" });
    for (const { item } of pool.candidates) {
      const source = pool.sources.find(entry => entry.sourceId === item.sourceId);
      const asset = assets.resolve(item, source);
      assert.ok(asset);
      assert.ok(snapshot.visitorInfo(item));
      if (item.category === "movie") {
        const visitor = snapshot.visitorInfo(item);
        assert.match(visitor.admission, /Protected \(6\+\).*6-11/);
        assert.equal(visitor.format, `Indoor cinema / ${item.eventId === "8786" ? 100 : 109} min`);
        assert.equal(visitor.admissionUrl, "https://www.vscinemas.com.tw/vsTicketing/ticketing/ticket.aspx");
      }
      assert.match(asset.path, /^\.\.\/activity-preview\/chat-assets\/[a-z-]+\.(png|jpg)$/);
      assert.match(asset.rights, /Public reuse permission has not been confirmed/);
      assert.equal(assets.resolve(item), null);
      assert.equal(assets.resolve(item, { ...source, kind: "synthetic" }), null);
      for (const field of ["sourceId", "eventId", "category", "sourceUrl"]) {
        assert.equal(assets.resolve({ ...item, [field]: "mismatch" }, source), null);
        assert.equal(snapshot.visitorInfo({ ...item, [field]: "mismatch" }), null);
      }
      assert.equal(assets.resolve({ ...item, thumbnail: { permission: "unavailable" } }, source), null);
    }
  }
});

test("missing, unapproved, mismatched and load-error media all have a stable fallback", async () => {
  for (const change of [item => { item.thumbnail = null; },
    item => { item.thumbnail.assetKey = "unknown"; },
    item => { item.thumbnail.permission = "unavailable"; },
    item => { item.thumbnail.assetKey = item.category === "movie" ? "basketball-synthetic" : "movie-synthetic"; }]) {
    const data = await result();
    data.items.forEach(change);
    const host = dom();
    renderActivityCards(host, data);
    assert.equal(tags(host, "img").length, 0);
    assert.match(visible(host), /Image unavailable/);
  }
  const host = dom();
  const renderer = renderActivityCards(host, await result());
  const images = tags(host, "img");
  images[0].fire("error");
  assert.equal(images[0].hidden, true);
  assert.match(visible(host), /Image unavailable/);
  renderer.dispose();
  renderer.dispose();
  assert.equal(host.children.length, 0);
  assert.ok(images.every(image => image.listeners.size === 0));
});

test("text is literal; safe links are explicit navigation and unsafe results reject before DOM changes", async () => {
  const host = dom();
  const data = await result();
  data.items[0].title = '<img src=x onerror="fetch()">';
  data.items[0].sourceUrl = "https://example.test/fictional";
  renderActivityCards(host, data);
  assert.ok(text(host).includes(data.items[0].title));
  assert.equal(tags(host, "img").length, 2);
  const link = tags(host, "a")[0];
  assert.equal(link.href, data.items[0].sourceUrl);
  assert.equal(link.rel, "noopener noreferrer");
  const count = host.children.length;
  for (const url of ["javascript:alert(1)", "http://example.test", "https://user:pass@example.test"]) {
    data.items[0].sourceUrl = url;
    assert.throws(() => renderActivityCards(host, data), /^Error: invalid_result$/);
    assert.equal(host.children.length, count);
  }
});

test("empty, unknown, partial and unavailable show truthful status and scope without extra cards", async () => {
  for (const status of ["empty", "unknown", "partial", "unavailable"]) {
    const data = await result();
    data.status = status;
    if (status === "unknown") data.items = [data.items[0]];
    else data.items = [];
    if (status === "empty") data.issues = [{ code: "no_matches", sourceId: null, message: "No matching fixture occurrences." }];
    if (status === "partial" || status === "unavailable") {
      data.sources.forEach(source => { source.coverage.completeness = "unknown"; });
      data.issues = [{ code: status === "partial" ? "scope_incomplete" : "source_unavailable", sourceId: null, message: "Synthetic scope unavailable." }];
    }
    const host = dom();
    renderActivityCards(host, data);
    assert.equal(tags(host, "article").length, status === "unknown" ? 1 : 0);
    assert.match(visible(host), /Calendar availability not checked/);
    assert.match(text(host), /within demo fixtures only/);
  }
});

test("renderer owns only its region; caller replaces results after disposing", async () => {
  const host = dom();
  const sibling = host.ownerDocument.createElement("p");
  sibling.textContent = "Builder content";
  host.append(sibling);
  const first = renderActivityCards(host, await result());
  first.dispose();
  const request = activityRequest();
  request.range = { startDate: "2026-09-19", endDate: "2026-09-20", timeZone: "Asia/Taipei" };
  const second = renderActivityCards(host, await searchActivities(request, { signal: new AbortController().signal }));
  first.dispose();
  assert.equal(tags(host, "article").length, 1);
  assert.match(text(host), /2026-09-20/);
  assert.doesNotMatch(text(host), /2026-10-11/);
  second.dispose();
  assert.deepEqual(host.children, [sibling]);
});

test("browser search and renderer share one namespace and perform no network, calendar, storage or timer work", async () => {
  const forbidden = () => { throw new Error("Forbidden side effect"); };
  const context = vm.createContext({ AbortSignal, structuredClone, FamilyChatContract: contract,
    FamilyChatActivityFixtures: fixtures, FamilyChatActivityAssets: assets,
    fetch: forbidden, XMLHttpRequest: forbidden, setTimeout: forbidden });
  for (const name of ["document", "sessionStorage", "localStorage", "FamilyChatCalendar"]) {
    Object.defineProperty(context, name, { get: forbidden });
  }
  for (const name of ["chat-search", "activity-cards"]) {
    vm.runInContext(fs.readFileSync(require.resolve(`../activity-preview/${name}`), "utf8"), context);
  }
  assert.deepEqual(Object.keys(context.FamilyChatActivities).sort(), ["renderActivityCards", "searchActivities"]);
  const host = dom();
  const data = await context.FamilyChatActivities.searchActivities(activityRequest(), { signal: new AbortController().signal });
  assert.ok(contract.validateActivityResult(data, activityRequest()));
  const controller = context.FamilyChatActivities.renderActivityCards(host, data);
  tags(host, "details").forEach(details => { details.open = true; details.fire("toggle"); });
  controller.dispose();
});

test("public demo image bytes match the inspected local files", () => {
  const expected = [
    ["formosa-dreamers.webp", "7d7aa1b0a9f3d49f48031f326066accb5c097c0faac6a3e62031a691211088cc", "52494646"],
    ["ctbc-dea.png", "819f386bc0b22ab06f73e7d222696b1dc882b5deeeb17f85f7be528b24ac8ffd", "89504e470d0a1a0a"],
    ["forgotten-island.jpg", "b31bab62bf87ae3217f79b4cfdde3c4222e55bf662769bd767d1e89462082ca3", "ffd8ff"],
    ["chiikawa.jpg", "74dcec47ef3b1c4d7e336012ec16bd2d2f1ebbcb0bd7f9c878d5fcf9c9a7eb6a", "ffd8ff"]
  ];
  for (const [name, hash, signature] of expected) {
    const bytes = fs.readFileSync(path.join(__dirname, "../activity-preview/chat-assets", name));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), hash);
    assert.equal(bytes.subarray(0, signature.length / 2).toString("hex"), signature);
    assert.ok(bytes.length < 500000);
  }
});

test("all local artwork is present and contains no executable or external media references", async () => {
  for (const item of (await result()).items) {
    const asset = assets.resolve(item);
    assert.ok(asset);
    const filename = path.resolve(__dirname, "../chat", asset.path);
    const svg = fs.readFileSync(filename, "utf8");
    assert.match(svg, /viewBox="0 0 800 450"/);
    assert.match(svg, /<title[^>]*>/);
    assert.doesNotMatch(svg, /<(?:script|foreignObject|image)\b|\bon\w+\s*=|(?:href|src)\s*=/i);
  }
  const css = fs.readFileSync(require.resolve("../activity-preview/activity-cards.css"), "utf8");
  assert.match(css, /aspect-ratio: 16 \/ 9/);
  assert.match(css, /:focus-visible/);
  assert.doesNotMatch(css, /@import|url\(/);
});
