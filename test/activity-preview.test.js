"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { search, normalize, summary, items, cardHtml, resultsHtml, escapeHtml } = require("../activity-preview/core.js");
const read = name => fs.readFileSync(path.join(__dirname, "../activity-preview", name), "utf8");

test("preferred-team entry replaces obsolete intent and roster-first UI with labelled removable-chip controls", () => {
  const html = read("index.html"), css = read("basketball.css"), js = read("basketball-ui.js");
  const teams = html.match(/<fieldset id="basketball-choices"[\s\S]*?<\/fieldset>/)[0];
  assert.doesNotMatch(teams, /Watch|Play|Either|roster|team-search|any-team|team-options/);
  assert.doesNotMatch(html + js + read("core.js"), /basketballIntent|Watch uses TPBL/);
  assert.match(teams, /<label for="team-name" id="preferred-teams-label">Preferred teams<\/label>/);
  assert.match(teams, /type="text" id="team-name" maxlength="120" autocomplete="off"/);
  assert.match(teams, /aria-describedby="team-status"/);
  assert.doesNotMatch(html, /team-help|Up to 16 names, this page only/);
  assert.match(teams, /type="button" id="add-team">Add<\/button>/);
  assert.match(teams, /id="team-status" role="status" aria-live="polite" aria-atomic="true"/);
  assert.equal((teams.match(/>Preferred teams</g) || []).length, 1);
  assert.doesNotMatch(teams, /Add a preferred team|Your preferred teams|team-summary|Off: preferred/);
  assert.doesNotMatch(js, /team-summary|Preference only; no search made/);
  assert.match(teams, /<ul id="preferred-teams"[^>]*aria-labelledby="preferred-teams-label"/);
  assert.match(teams, /id="only-teams" checked> Only preferred teams/);
  assert.match(css, /\.preferred-team > span \{[^}]*overflow-wrap: anywhere/);
  assert.match(css, /\.preferred-team button \{[^}]*flex: 0 0 44px/);
  assert.match(css, /#team-controls :focus-visible/);
  assert.doesNotMatch(js, /localStorage|sessionStorage|document\.cookie|sendBeacon/);
});

test("activity preview works without any calendar or identity input", () => {
  const result = search({});
  assert.deepEqual(result.matches.map(x => x.item.id), ["hoops", "music", "art", "science", "nature", "exhibit"]);
  assert.equal(result.request.age, null);
  assert.match(summary(result.request), /Age not checked/);
  assert.equal(result.uncertain.length, 0);
});
test("summaries and requests retire basketball intent even for legacy inputs", () => {
  assert.doesNotMatch(summary(search({ interests: ["music"], basketballIntent: "play" }).request), /Basketball/);
  for (const basketballIntent of ["play", "watch", "either", "<img>"]) {
    const result = search({ interests: ["sports", "music"], sports: ["basketball"], basketballIntent });
    assert.doesNotMatch(summary(result.request), /Basketball:|play|either|<img>/);
    assert.equal(Object.hasOwn(result.request, "basketballIntent"), false);
    assert.deepEqual(result.matches.map(entry => entry.item.id), ["music"]);
  }
});

test("sport validation is bounded, fail-closed and does not echo malicious choices", () => {
  for (const sports of [null, "basketball", {}, [null], [1], [[]], [{}], Array(1), ["__proto__"], ["constructor"], ["Basketball"], ["<img onerror=evil>"], ["x".repeat(10000)], Array(7).fill("basketball")]) {
    const result = search({ interests: ["sports"], sports });
    assert.equal(result.field, "sport-choices"); assert.equal(resultsHtml(result), "");
    assert.doesNotMatch(result.error, /<img|onerror|__proto__|constructor/);
    assert.ok(search({ sports }).error, "Hidden malformed preferences also fail closed");
  }
  assert.deepEqual(search({ interests: ["sports"], sports: ["basketball", "basketball"] }).request.sports, ["basketball"]);
});

test("explicit Basketball means spectator listings while other sport and category OR filters remain independent", () => {
  const fixtures = [items[0], { ...items[0], id: "swim", sport: "swimming" }, { ...items[0], id: "unknown", sport: undefined }, items[1]];
  const ids = raw => search(raw, fixtures).matches.map(entry => entry.item.id);
  assert.deepEqual(ids({ interests: ["sports"], sports: ["swimming"] }), ["swim"]);
  assert.deepEqual(ids({ interests: ["sports"], sports: ["basketball", "swimming"] }), ["swim"]);
  assert.deepEqual(ids({ interests: ["sports", "music"], sports: ["basketball", "swimming"], basketballIntent: "watch" }), ["swim", "music"]);
  for (const sport of ["pingpong", "baseball", "football", "badminton", "swimming"]) assert.equal(search({ interests: ["sports"], sports: [sport] }).matches.length, 0);
});

test("effective broad requests ignore hidden sports and basketball intent without mutating remembered choices", () => {
  const C = require("../activity-preview/core");
  for (const raw of [{ sports: ["swimming"], basketballIntent: "play" }, { interests: ["sports"], sports: [], basketballIntent: "watch" }]) {
    const before = JSON.stringify(raw), result = search(raw);
    assert.ok(result.matches.some(entry => entry.item.id === "hoops"));
    assert.equal(result.request.basketballIntent, undefined); assert.equal(C.basketballSelected(result.request), false);
    assert.equal(C.basketballEligible(result.request), true); assert.doesNotMatch(summary(result.request), /Basketball:|Swimming/);
    assert.equal(JSON.stringify(raw), before);
  }
  for (const sports of [["football"], ["badminton", "swimming"], ["basketball"]]) {
    const request = search({ interests: ["sports"], sports, basketballIntent: "play" }).request;
    assert.equal(C.basketballEligible(request), sports.includes("basketball"));
  }
});

test("sport markup uses labelled native unchecked controls, hidden panels and keyboard focus styles", () => {
  const html = read("index.html"), css = read("basketball.css");
  const category = html.match(/<label class="interest peach">[\s\S]*?<\/label>/)[0];
  assert.match(category, /🏅/);
  assert.doesNotMatch(category, /🏀/);
  const picker = html.match(/<fieldset id="sport-choices"[\s\S]*?<\/fieldset>/)[0];
  assert.match(picker, /tabindex="-1" hidden/); assert.match(picker, /<legend>Which sports\?/);
  const icons = [...picker.matchAll(/<label title="([A-Za-z-]+)"><input type="checkbox" name="sport" value="([a-z]+)" aria-label="([A-Za-z-]+)"><span aria-hidden="true">([^<]+)<\/span><\/label>/g)];
  assert.deepEqual(icons.map(m => [m[2], m[3]]), Object.entries(require("../activity-preview/core").sports));
  assert.ok(icons.every(m => m[1] === m[3]), "Tooltips and accessible names agree");
  assert.deepEqual(icons.map(m => m[4]), ["🏀", "🏓", "⚾", "⚽", "🏸", "🏊"]);
  assert.match(css, /\.sport-icons label \{[^}]*min-height: 64px/);
  assert.match(css, /\.sport-icons label:has\(input:checked\)/);
  assert.match(css, /\.sport-icons input\[type=checkbox\] \{[^}]*position: absolute;[^}]*width: 100%;[^}]*height: 100%;[^}]*opacity: 0/);
  assert.match(css, /\.sport-icons input:checked \+ span::after \{ content: "✓"/);
  assert.doesNotMatch(picker, /\schecked(?:\s|>)/);
  assert.match(html, /id="basketball-choices"[^>]*hidden/);
  assert.match(picker, /None selected means any sport/);
  assert.doesNotMatch(html, /Live coverage: TPBL basketball only; other sports are not sourced here\./);
  assert.match(css, /\.intent-choices input\[type=checkbox\]/); assert.match(css, /\.intent-choices label:focus-within/);
  assert.match(css, /min-height: 44px/); assert.match(css, /\[hidden\] \{ display: none !important/);
});

test("activity markup, cards, summaries and validation copy omit Demo and Sample without losing truth", () => {
  const visible = html => html.replace(/<[^>]*>/g, " ");
  assert.doesNotMatch(visible(read("index.html")), /\b(?:demo|samples?)\b/i);
  assert.doesNotMatch(read("index.html"), /Invented examples · Not live listings/);
  assert.doesNotMatch(read("index.html"), /id="(?:results|results-title|result-summary|cards|edit)"|class="result-boundary"|Fixed coverage:/);
  assert.match(read("index.html"), /id="status" class="sr-only" role="status"/);
  assert.match(read("index.html"), /id="basketball-games"/);
  for (const raw of [{}, { ages: [8] }, { interests: ["sports"], sports: ["swimming"] }, { interests: ["exhibition"], budget: 0, ages: [8] }]) {
    const result = search(raw);
    assert.doesNotMatch(visible(resultsHtml(result)) + summary(result.request), /\b(?:demo|samples?)\b/i);
  }
  for (const raw of [{ budget: -1 }, { slot: "bad" }, { sports: ["<img>"] }]) assert.doesNotMatch(search(raw).error, /\b(?:demo|samples?)\b/i);
  assert.match(resultsHtml(search({})), /Free \(invented\)/); assert.match(resultsHtml(search({})), /USD \/ child \(invented\)/);
});
test("activity preview uses OR interests and AND format/indoor/price filters", () => {
  assert.deepEqual(search({ interests: ["sports", "music"] }).matches.map(x => x.item.id), ["hoops", "music"]);
  assert.deepEqual(search({ interests: ["sports", "music"], format: "watch", indoor: true, budget: "15" }).matches.map(x => x.item.id), ["music"]);
  assert.equal(search({ interests: ["sports"], format: "watch" }).matches.length, 0);
  assert.equal(search({ interests: ["outdoors"], indoor: true }).matches.length, 0);
});
test("activity preview numeric age guidance includes endpoints and excludes known mismatches", () => {
  for (const age of [6, 10]) assert.equal(search({ age, interests: ["sports"] }).matches.length, 1);
  for (const age of [5, 11]) assert.equal(search({ age, interests: ["sports"] }).matches.length, 0);
  assert.match(summary(search({ age: 8 }).request), /Age 8/);
});
test("activity preview unknown age and price never satisfy required filters", () => {
  const result = search({ age: 8, budget: "0", interests: ["exhibition"] });
  assert.equal(result.matches.length, 0);
  assert.equal(result.uncertain.length, 1);
  assert.deepEqual(result.uncertain[0].reasons, ["Age guidance unknown", "Price unknown"]);
  const html = resultsHtml(result);
  assert.match(html, /Needs checking: Age guidance unknown; Price unknown/);
  assert.doesNotMatch(html, /Free \(invented\)|event time fits this window/);
});
test("activity preview checks whole fixed session, not just overlap", () => {
  const fixture = { ...items[0], start: 780, end: 1020 };
  assert.equal(search({ slot: "sunday" }, [fixture]).matches.length, 1);
  for (const changes of [{ start: 779 }, { end: 1021 }, { end: null }, { start: NaN }, { end: 780 }, { date: "2026-09-21" }]) {
    assert.equal(search({ slot: "sunday" }, [{ ...fixture, ...changes }]).matches.length, 0);
  }
  assert.deepEqual(search({ slot: "morning", budget: "0" }).matches.map(x => x.item.id), ["science"]);
});
test("activity preview keywords are bounded literal words, not instructions or regex", () => {
  assert.deepEqual(search({ keywords: "Basketball, beginner" }).matches.map(x => x.item.id), ["hoops"]);
  assert.equal(search({ keywords: "painting, basketball" }).matches.length, 0);
  assert.equal(search({ keywords: "swimming" }).matches.length, 0);
  for (const keywords of ["no basketball", "not indoor", "without music", "basketball or painting", "under fifteen", "<script>", "a.*", "x".repeat(81), "one two three four five six"]) {
    assert.equal(normalize({ keywords }).field, "keywords");
  }
});
test("activity preview rejects invalid request choices fail closed", () => {
  for (const raw of [{ slot: "__proto__" }, { age: 0 }, { age: "NaN" }, { age: 8.5 }, { age: 18 }, { interests: "music" }, { interests: ["__proto__"] }, { format: "book" }, { budget: -1 }]) {
    assert.ok(search(raw).error);
    assert.equal(resultsHtml(search(raw)), "");
  }
});
test("activity preview summary records applied filters without echoing uninterpreted sentences", () => {
  const request = search({ age: 8, interests: ["sports"], format: "class", budget: "15", indoor: true, keywords: "beginner" }).request;
  for (const phrase of ["Taipei (UTC+8)", "Sep 20", "Sep 26", "Age 8", "Sports", "Class / workshop", "$15 USD per child", "Indoors only", "All keywords: beginner"]) assert.ok(summary(request).includes(phrase));
});
test("activity preview keeps synthetic provenance and uncertainty visible", () => {
  const html = resultsHtml(search({}));
  for (const phrase of ["All facts and venues are invented", "Travel not checked", "Spaces unknown", "No calendars or travel were checked", "no live source", "Age not checked", "not converted or family totals"]) assert.ok(html.includes(phrase));
  const beforeDetails = html.split("<details>")[0];
  assert.match(beforeDetails, /Taipei \(fictional\)/);
  assert.doesNotMatch(read("index.html"), /Travel not checked · Spaces unknown · No calendars checked/);
  assert.doesNotMatch(html, /href=|booking|verified available/);
});
test("activity preview escapes fixture text and allowlists theme classes", () => {
  assert.equal(escapeHtml('<img src=x onerror="bad()">'), "&lt;img src=x onerror=&quot;bad()&quot;&gt;");
  const malicious = { ...items[0], title: '<img src=x onerror="bad()">', source: "<script>bad()</script>", emoji: "<svg>", theme: 'evil" onclick="bad()' };
  const html = cardHtml({ item: malicious, reasons: [] }, search({}).request);
  assert.match(html, /activity-card lilac/);
  assert.doesNotMatch(html, /<img|<script|<svg|onclick=/);
  assert.match(html, /&lt;img/);
  const fields = { title: "<img>", venue: "<svg>", reason: "<script>", source: '<a href="javascript:bad()">', time: "<iframe>", emoji: "<img>" };
  const all = cardHtml({ item: { ...items[0], ...fields }, reasons: ["<svg>"] }, search({ ages: [8, 10] }).request);
  assert.doesNotMatch(all, /<img|<svg|<script|<iframe|<a href/);
  assert.match(all, /&lt;a href=/);
});
test("activity preview empty matches do not fabricate alternatives or relax filters", () => {
  const raw = { interests: ["sports"], budget: "0" };
  const before = JSON.stringify(raw);
  const result = search(raw);
  assert.equal(result.matches.length, 0);
  assert.equal(result.uncertain.length, 0);
  assert.match(resultsHtml(result), /No ideas match/);
  assert.match(resultsHtml(result), /no filters were changed for you/);
  assert.equal(JSON.stringify(raw), before);
});
test("sample controller stays offline while the separate public mode permits only same-origin connection", () => {
  const html = read("index.html"), js = read("core.js") + read("ui.js");
  assert.match(html, /connect-src 'self'/);
  assert.match(html, /form-action 'none'/);
  assert.deepEqual([...html.matchAll(/<script src="([^"]+)"/g)].map(x => x[1]), ["/activity-preview/core.js", "/activity-preview/ui.js", "/availability-core.js", "/shared/date-selection.js", "/shared/basketball-teams.js", "/activity-preview/basketball-ui.js"]);
  assert.doesNotMatch(html + js, /https?:\/\/|fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|document\.cookie|\.\.\/|postMessage|serviceWorker/);
  assert.match(js, /pagehide/);
  assert.match(js, /pageshow/);
  assert.match(js, /form\.reset\(\)/);
  assert.match(js, /form\.addEventListener\("input", \(\) => choicesChanged/);
  assert.match(js, /globalThis\.ActivityDiscovery\?\.invalidate/);
});
test("activity preview retains semantic labels, keyboard states and non-color indicators", () => {
  const html = read("index.html"), css = read("preview.css");
  assert.equal([...html.matchAll(/name="interest"/g)].length, 6);
  assert.equal([...html.matchAll(/class="selection-mark" aria-hidden="true">✓/g)].length, 6);
  assert.match(html, /role="status" aria-live="polite"/);
  assert.match(html, /role="alert"/);
  assert.match(html, /<main id="main"[^>]*tabindex="-1"/);
  for (const id of ["date", "period", "format", "budget", "setting"]) assert.ok(html.includes(`for="${id}"`));
  assert.match(require("../activity-preview/core").ageRowsHtml(), /for="age-0"/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /input:focus-visible \+ \.interest-face/);
  assert.match(css, /\.interest input \{[^}]*width: 100%; height: 100%/);
  assert.match(css, /forced-colors: active/);
  assert.match(css, /\.sr-only/);
});
test("activity preview server serves only isolated assets on loopback", async t => {
  const { createPreviewServer } = require("../activity-preview/serve.js");
  const server = createPreviewServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port;
  const request = (url, options = {}) => new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path: url, ...options }, res => {
      let body = ""; res.setEncoding("utf8"); res.on("data", chunk => { body += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on("error", reject); req.end();
  });
  const main = await request("/");
  assert.equal(main.status, 200);
  assert.match(main.body, /What sounds fun/);
  assert.match(main.body, /href="http:\/\/localhost:8002\/">Our week<\/a>/);
  assert.match(main.body, /href="\/activities" aria-current="page">Activities<\/a>/);
  assert.equal(main.headers["cache-control"], "no-store");
  assert.match(main.headers["content-security-policy"], /frame-ancestors 'none'/);
  for (const asset of ["/preview.css", "/core.js", "/ui.js", "/activities", "/activities/", "/activity-preview/core.js", "/activity-preview/ui.js", "/activity-preview/preview.css", "/shared/basketball-teams.js"]) assert.equal((await request(asset)).status, 200);
  const shell = await request("/shell.css");
  assert.equal(shell.status, 200);
  assert.equal(shell.headers["content-type"], "text/css; charset=utf-8");
  assert.equal(shell.body, fs.readFileSync(path.join(__dirname, "../shell.css"), "utf8"));
  assert.equal((await request("/shell.css", { method: "HEAD" })).body, "");
  for (const route of ["/activities", "/activities/", "/index.html"]) {
    const page = await request(route);
    assert.match(page.body, /href="http:\/\/localhost:8002\/">Our week<\/a>/);
    assert.match(page.body, /href="\/activities" aria-current="page">Activities<\/a>/);
  }
  for (const url of ["/styles.css", "/shell.css?x=1", "/../shell.css", "/%2e%2e/shell.css"]) assert.equal((await request(url)).status, 404);
  for (const url of ["/../README.md", "/%2e%2e/owner/index.html", "/owner/", "/picker/public-config.json", "/.env", "/serve.js", "/core.js?x=1"]) assert.equal((await request(url)).status, 404);
  assert.equal((await request("/", { method: "POST" })).status, 405);
  assert.equal((await request("/", { headers: { host: "not-local.example" } })).status, 403);
  assert.equal((await request("/", { method: "HEAD" })).body, "");
});

test("every selected age must fit one activity, endpoints included and twins preserved", () => {
  const raw = { ages: ["8", "10"], interests: [] };
  const result = search(raw);
  assert.deepEqual(result.request.ages, [8, 10]);
  assert.equal(result.matches.length, 5); assert.equal(result.uncertain.length, 1);
  assert.deepEqual(search({ ages: [6, 10], interests: ["sports"] }).matches.map(x => x.item.id), ["hoops"]);
  for (const ages of [[5, 10], [6, 11], [4, 17]]) assert.equal(search({ ages, interests: ["sports"] }).matches.length, 0);
  assert.deepEqual(search({ ages: [8, 8] }).request.ages, [8, 8]);
  assert.deepEqual(search({ ages: ["", 8, null] }).request.ages, [8]);
  assert.deepEqual(search({ ages: Array(8).fill(8) }).request.ages, Array(8).fill(8));
  assert.deepEqual(raw.ages, ["8", "10"]);
  assert.match(summary(result.request), /Ages 8 \+ 10/);
});

test("malformed and oversized ages, interests, dates and choices fail closed without echo", () => {
  for (const ages of ["8", {}, [false], [{}], [[]], [NaN], [Infinity], [-1], [3], [18], [8.5], ["8.0"], [" 8"], ["8e0"], ["<img>"], ["8".repeat(100)], Array(9).fill(8), Array(1)]) assert.ok(search({ ages }).error, String(ages));
  for (const raw of [null, [], { ages: [8], age: 9 }, { interests: Array(7).fill("art") }, { interests: Array(1) }, { interests: [null] }, { interests: ["toString"] }, { date: "2026-09-19" }, { date: "2026-09-27" }, { date: "2026-09-31" }, { date: "2026-09-20T00:00:00Z" }, { date: [] }, { period: "evening" }, { setting: "nearby" }, { indoor: "yes" }, { setting: "outdoor", indoor: true }, { budget: true }, { budget: [] }, { keywords: {} }]) assert.ok(search(raw).error, JSON.stringify(raw));
  assert.deepEqual(search({ interests: ["art", "art"] }).request.interests, ["art"]);
  assert.doesNotMatch(JSON.stringify(search({ ages: ["<img>"] })), /<img>/);
});

test("fixed Taipei week, day and full time containment do not depend on host timezone", () => {
  const { week, dateLabel } = require("../activity-preview/core");
  assert.equal(week.zone, "Asia/Taipei");
  assert.equal(dateLabel("2026-09-20"), "Sun, Sep 20"); assert.equal(dateLabel("2026-09-26"), "Sat, Sep 26");
  assert.ok(items.every(x => x.date >= week.start && x.date <= week.end));
  assert.deepEqual(search({ date: "2026-09-20" }).matches.map(x => x.item.id), ["hoops"]);
  assert.equal(search({ date: "2026-09-23" }).matches.length, 0);
  assert.deepEqual(search({ period: "morning" }).matches.map(x => x.item.id), ["science"]);
  assert.equal(search({ period: "afternoon" }).matches.length, 5);
  for (const changes of [{ start: -1 }, { end: 1441 }, { start: 1.5 }, { end: Infinity }, { date: "2026-09-19" }, { date: "2026-09-27" }]) assert.equal(search({}, [{ ...items[0], ...changes }]).matches.length, 0);
  const noon = { ...items[0], start: 660, end: 720 };
  assert.equal(search({ period: "morning" }, [noon]).matches.length, 1);
  assert.equal(search({ period: "morning" }, [{ ...noon, end: 721 }]).matches.length, 0);
  assert.equal(search({ period: "afternoon" }, [{ ...noon, start: 719, end: 780 }]).matches.length, 0);
});

test("unknown or malformed source guidance remains separate, skipped ages are never confirmed", () => {
  for (const changes of [{ minAge: null }, { minAge: 12, maxAge: 4 }, { minAge: -1 }, { maxAge: Infinity }, { minAge: "6" }]) {
    const result = search({ ages: [8, 10] }, [{ ...items[0], ...changes }]);
    assert.equal(result.matches.length, 0); assert.equal(result.uncertain.length, 1);
    assert.match(resultsHtml(result), /checking-heading/);
    assert.doesNotMatch(resultsHtml(result), /covers every selected age/);
  }
  assert.match(resultsHtml(search({ ages: [] })), /Age not checked/);
  assert.doesNotMatch(resultsHtml(search({ ages: [] })), /covers every selected age/);
  assert.equal(search({ setting: "outdoor" }).matches[0].item.id, "nature");
  assert.equal(search({ setting: "outdoor", budget: 0 }).matches.length, 1);
});

test("results cap and deduplicate actual fixtures deterministically without padding", () => {
  const fixtures = Array.from({ length: 10 }, (_, i) => ({ ...items[0], id: `sample-${i}` }));
  assert.equal(search({}, fixtures).matches.length, 6);
  assert.equal(search({}, [items[0], items[0]]).matches.length, 1);
  assert.equal(search({}, [null, {}, { ...items[0], id: "x".repeat(81) }]).matches.length, 0);
  assert.equal(search({}, null).matches.length, 0);
  const one = search({ interests: ["sports"] });
  assert.equal(one.matches.length, 1); assert.equal(one.uncertain.length, 0);
  assert.equal((resultsHtml(one).match(/<article/g) || []).length, 1);
});

test("age controls are bounded, optional, removable and cannot echo unsafe values", () => {
  const { ageRowsHtml } = require("../activity-preview/core");
  const html = ageRowsHtml([8, 8, '<img onerror="bad()">']);
  for (let i = 0; i < 3; i++) {
    assert.ok(html.includes(`<label class="sr-only" for="age-${i}">Age for child ${i + 1}</label>`));
    assert.ok(html.includes(`aria-label="Remove age ${i + 1}" title="Remove age ${i + 1}"`));
  }
  assert.equal((html.match(/<span aria-hidden="true">×<\/span>/g) || []).length, 3);
  assert.equal((html.match(/<option value="">Any<\/option>/g) || []).length, 3);
  assert.doesNotMatch(ageRowsHtml(), / selected/);
  const options = [...ageRowsHtml().matchAll(/<option value="(\d+)"/g)].map(x => Number(x[1]));
  assert.deepEqual(options, Array.from({ length: 14 }, (_, i) => i + 4));
  assert.equal((html.match(/value="8" selected/g) || []).length, 2);
  assert.doesNotMatch(html, /required|<img|onerror|birth|name="name"/);
  assert.equal(ageRowsHtml([]), "");
  assert.equal((ageRowsHtml(Array(10).fill(8)).match(/<select/g) || []).length, 8);
});

test("compact age chips keep one optional caption and accessible icons without permanent instructions", () => {
  const html = read("index.html"), css = read("preview.css");
  const party = html.slice(html.indexOf('<fieldset class="party">'), html.indexOf('<details class="preferences"'));
  assert.equal((party.match(/Ages \(optional\)/g) || []).length, 1);
  assert.match(party, /id="age-note">Ages \(optional\)/);
  assert.match(party, /id="add-age" aria-label="Add an age" title="Add an age"><span aria-hidden="true">\+<\/span>/);
  assert.doesNotMatch(party, /<p|Skip ages|skip-ages|Child ages|birthdays|eight/);
  assert.match(css, /\.age-controls \{[^}]*display: flex; flex-wrap: wrap/);
  assert.match(css, /#age-rows \{ display: contents; \}/);
  const ageSelect = css.match(/\.age-row select \{([^}]+)\}/)[1];
  assert.match(ageSelect, /width: 6em;/);
  assert.match(ageSelect, /flex: 0 0 auto;/);
  assert.match(ageSelect, /padding-inline-end: 2em;/);
  assert.match(ageSelect, /min-height: 44px;/);
  assert.doesNotMatch(ageSelect, /appearance: none/);
  assert.match(css, /\.age-icon \{[^}]*width: 44px; min-width: 44px; height: 44px/);
  assert.doesNotMatch(css, /#age-rows \{[^}]*grid-template-columns/);
});

test("playful sky reuses local sun cloud and sparkles without changing shared header geometry", () => {
  const html = read("index.html"), css = read("preview.css");
  assert.match(html, /class="shell-decoration hero-art" aria-hidden="true"><span class="sky">/);
  for (const name of ["sun", "sun-eyes", "sun-smile", "cloud", "sparkle"]) assert.ok(html.includes(`class="${name}"`));
  assert.match(css, /\.sun \{[^}]*width: 62px; height: 62px/);
  assert.match(css, /\.sky \{ position: absolute; width: 120px; height: 88px/);
  assert.match(css, /\.shell-decoration\.hero-art \{[^}]*pointer-events: none/);
  assert.doesNotMatch(css, /(?:^|\n)\.(?:shell-card|shell-intro|shell-title|family-shell)\s*\{/);
});

test("simple workflow keeps secondary choices collapsed with a working canonical navigation", () => {
  const html = read("index.html");
  assert.ok(html.indexOf("What sounds fun?") < html.indexOf("Who's coming?"));
  assert.doesNotMatch(html, /id="basketball-mode"|id="sample-mode"|id="sample-panel"/);
  assert.match(html, /Find activities/);
  assert.doesNotMatch(html, /Fixed coverage:/);
  assert.ok(html.indexOf("What sounds fun?") < html.indexOf('id="find"'));
  assert.match(html, /href="\/">Our week/); assert.match(html, /href="\/activities" aria-current="page"/);
  assert.match(html, /Six invented Taipei activities and venues, not web listings or real places/);
  assert.doesNotMatch(html, /<details[^>]*\sopen|id="keywords"|id="slot"|America\/New_York|Sep 19/);
  assert.match(html, /id="surprise" aria-pressed="true"/);
  for (const id of ["date", "period", "budget", "format", "setting"]) assert.ok(html.slice(html.indexOf('id="preferences"'), html.indexOf('id="form-error"')).includes(`id="${id}"`));
});

test("activity text and selected controls retain readable contrast across warm backgrounds", () => {
  const luminance = hex => hex.match(/\w\w/g).map(x => parseInt(x, 16) / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
  for (const [foreground, background] of [["352e49", "fcf9f5"], ["625a70", "ffffff"], ["ffffff", "624199"], ["71603e", "ffffff"], ["8b2b28", "ffffff"], ...["fff0e1", "eee7fa", "fce9ef", "e9f0fc", "e8f2e8", "faf2d9"].map(bg => ["352e49", bg])]) {
    const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    assert.ok((light + .05) / (dark + .05) >= 4.5, `${foreground} on ${background}`);
  }
});