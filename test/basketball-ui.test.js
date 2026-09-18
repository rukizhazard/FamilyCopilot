"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const D = require("../shared/date-selection"), T = require("../shared/basketball-teams");
const { dateStorage } = require("./fixtures/date-storage");
const { activityDOM, text } = require("./fixtures/activity-dom");
const { basketballResponse, row } = require("./fixtures/basketball-response");
const response = options => basketballResponse(options);
function harness(reply = async (_path, options) => ({ ok: true, json: async () => response(JSON.parse(options.body)) }), options = {}) {
  if (!options.storage) { options = { ...options, storage: dateStorage() }; D.createStore(() => options.storage).write("2026-09-20", "2026-09-26"); }
  return activityDOM(reply, options);
}
const counts = h => h.get("basketball-games").children.length;
test("successful game summaries are concise without hiding truncation or fuzzy resolution", async () => {
  for (const total of [1, 2, 45]) {
    const rows = Array.from({ length: total }, (_, i) => row(i + 1, undefined, { home_team: { name: "新北中信特攻" } }));
    const h = harness(async (_path, options) => ({ ok: true, json: async () => response({ ...JSON.parse(options.body), rows }) }));
    await h.category("sports"); await h.sport("basketball"); await h.addTeam("中信特攻");
    await h.click("find");
    const count = total > 40 ? "Showing 40 of 45 games." : `${total} ${total === 1 ? "game" : "games"} found.`;
    assert.equal(h.get("basketball-status").textContent, `${count} Fuzzy match: 中信特攻 → 新北中信特攻.`);
    assert.equal(counts(h), Math.min(40, total));
    assert.match(text(h.get("basketball-sources")), /Retrieved/);
    assert.match(text(h.get("preferred-teams")), /中信特攻/);
    h.get("only-teams").checked = false; await h.get("only-teams").fire("change");
    await h.click("find");
    assert.equal(h.get("basketball-status").textContent, `${count} Preferred teams first. Fuzzy match: 中信特攻 → 新北中信特攻.`);
  }
});
test("public listings heading appears only after Find and hides when choices are invalidated", async () => {
  const html = require("node:fs").readFileSync(require.resolve("../activity-preview/index.html"), "utf8");
  assert.match(html, /<h2 id="basketball-title" tabindex="-1" hidden>/);
  const h = harness(undefined, { ideasSurface: false });
  assert.equal(h.get("basketball-title").hidden, true);
  await h.category("sports"); await h.sport("basketball");
  assert.equal(h.get("basketball-title").hidden, true); assert.equal(h.requests.length, 0);
  await h.click("find");
  assert.equal(h.get("basketball-title").hidden, false); assert.ok(counts(h) > 0);
  assert.equal(h.focus.id, "basketball-title");
  await h.input("activity-end", "2026-09-25");
  assert.equal(h.get("basketball-title").hidden, true);
  await h.click("find"); assert.equal(h.get("basketball-title").hidden, false);
  await h.click("reset"); assert.equal(h.get("basketball-title").hidden, true);
  await h.lifecycle("pagehide"); assert.equal(h.get("basketball-title").hidden, true);
});
test("pre-search coverage and disclaimer paragraphs are absent and never recreated by choice changes", async () => {
  const fs = require("node:fs");
  const html = fs.readFileSync(require.resolve("../activity-preview/index.html"), "utf8");
  const js = fs.readFileSync(require.resolve("../activity-preview/basketball-ui.js"), "utf8");
  assert.doesNotMatch(html + js, /discovery-scope|Public coverage:|Public games: ages, price, tickets/);
  for (const preview of [false, true]) {
    const h = harness(undefined, { preview, ideasSurface: false });
    await h.category("music"); await h.category("sports"); await h.sport("basketball");
    await h.addTeam("Formosa Dreamers"); await h.click("reset");
    assert.equal(h.requests.length, 0);
    assert.equal(h.get("discovery-scope").textContent, "");
    await h.category("sports"); await h.sport("basketball"); await h.click("find");
    assert.equal(h.requests.length, preview ? 0 : 1);
    assert.equal(h.get("discovery-scope").textContent, "");
    if (preview) assert.match(h.get("basketball-status").textContent, /Offline preview/);
    else {
      assert.ok(counts(h) > 0);
      assert.match(text(h.get("basketball-games")), /Admission, price and ticket availability unknown/);
    }
  }
});
test("removed ideas surface never renders or announces counts while public search and resets still work", async () => {
  for (const preview of [false, true]) {
    const h = harness(undefined, { ideasSurface: false, preview });
    const noIdeas = () => {
      assert.equal(h.get("cards").innerHTML, "");
      assert.equal(h.get("result-summary").textContent, "");
      assert.equal(h.get("results-title").textContent, "");
      assert.doesNotMatch(h.get("status").textContent, /\d+ ideas?|Fixed September|No matching ideas/);
      assert.notEqual(h.focus?.id, "results-title");
    };
    assert.equal(h.requests.length, 0); noIdeas();
    await h.category("sports"); await h.sport("basketball");
    await h.click("find"); noIdeas();
    assert.equal(h.requests.length, preview ? 0 : 1);
    if (!preview) assert.ok(counts(h) > 0);
    await h.category("music"); await h.click("find"); noIdeas();
    assert.equal(h.requests.length, preview ? 0 : 1);
    h.ages[0].value = "<img>"; await h.click("find");
    assert.ok(h.get("form-error").textContent); noIdeas();
    await h.click("reset"); noIdeas();
    assert.equal(h.ages[0].value, "");
    await h.lifecycle("pagehide"); await h.lifecycle("pageshow", { persisted: true }); noIdeas();
  }
});
test("activity layout keeps one visible date editor and hides technical header chrome with scoped styles", () => {
  const fs = require("node:fs");
  const html = fs.readFileSync(require.resolve("../activity-preview/index.html"), "utf8");
  const css = fs.readFileSync(require.resolve("../activity-preview/basketball.css"), "utf8");
  assert.match(html, /<body class="activity-page">/);
  assert.match(css, /\.activity-page \.shell-source-row,[\s\S]*?\.activity-page \.shell-nav > \[aria-disabled="true"\],[\s\S]*?\.activity-page \.shell-intro \.shell-date,[\s\S]*?\.activity-page \.shell-intro \.shell-zone\s*\{\s*display: none;/);
  assert.match(html, /<details class="date-help">\s*<summary>About these dates<\/summary>\s*<p class="hint">Only dates are remembered/);
  assert.equal((html.match(/id="activity-start"/g) || []).length, 1);
  assert.equal((html.match(/id="activity-end"/g) || []).length, 1);
  assert.match(css, /\.activity-page \.shell-nav\s*\{[^}]*flex-wrap: wrap/);
  assert.match(css, /\.discovery-dates > label\s*\{[^}]*min-width: 0/);
});
test("date hint never repeats selected dates; invalid input stays visible and reset preserves no-query behavior", async () => {
  const h = harness(undefined, { storage: dateStorage() });
  assert.equal(h.get("basketball-dates").textContent, "Taipei (UTC+8) · Default dates · Choose 1–7 days.");
  await h.input("activity-start", "2026-10-10");
  assert.equal(h.get("basketball-dates").textContent, "Taipei (UTC+8) · Choose 1–7 days.");
  assert.doesNotMatch(h.get("basketball-dates").textContent, /October|2026|Our week/);
  await h.input("activity-end", "2026-10-09");
  assert.match(h.get("basketball-dates").textContent, /Dates are invalid/);
  assert.equal(h.get("find").disabled, true);
  await h.click("reset-dates");
  assert.equal(h.get("find").disabled, false); assert.equal(h.focus.id, "activity-start");
  assert.match(h.get("basketball-dates").textContent, /Default dates/);
  assert.equal(h.requests.length, 0);
});
test("short name finds screenshot team before40 and discloses source name without changing preferences", async () => {
  // User-supplied card facts replayed offline, not a fresh source response.
  const fullName = "新北中信特攻";
  const rows = [...Array.from({ length: 45 }, (_, i) => row(i + 1, "2026-10-10")), row(27539, "2026-10-10", {
    home_team: { name: fullName }, away_team: { name: "福爾摩沙夢想家" },
    game_time: "17:00:00", gamed_at: "2026-10-10 17:00:00", venue: "和平籃球館"
  })];
  const storage = dateStorage(); D.createStore(() => storage).write("2026-10-10", "2026-10-10");
  const h = harness(async (_path, options) => ({ ok: true, json: async () => response({ ...JSON.parse(options.body), rows }) }), { storage });
  await h.category("sports"); await h.sport("basketball"); await h.addTeam("中信特攻"); await h.click("find");
  assert.equal(counts(h), 1); assert.match(text(h.get("basketball-games")), /tpbl-27539/);
  assert.match(text(h.get("basketball-games")), /2026-10-10.*17:00/);
  assert.match(h.get("basketball-status").textContent, /Fuzzy match: 中信特攻 → 新北中信特攻/);
  assert.equal(h.get("only-teams").checked, true); assert.equal(h.get("preferred-teams").children.length, 1);
  assert.equal(h.requests.length, 1); assert.equal(JSON.parse(h.requests[0].options.body).teamMode, "only");
  assert.deepEqual(JSON.parse(h.requests[0].options.body).teamIds, [T.preferredTeam("中信特攻").key]);
});
test("ambiguous fuzzy names require explicit source choice, even alongside another matched preference", async () => {
  const rows = [row(1, undefined, { home_team: { id: 91, name: "City Falcons" } }),
    row(2, undefined, { home_team: { id: 92, name: "Valley Falcons" } }),
    row(3, undefined, { home_team: { name: "Formosa Dreamers" } })];
  const h = harness(async (_path, options) => ({ ok: true, json: async () => response({ ...JSON.parse(options.body), rows }) }));
  await h.category("sports"); await h.sport("basketball"); await h.addTeam("Falcons"); await h.addTeam("Formosa Dreamers"); await h.click("find");
  assert.equal(counts(h), 1); assert.match(h.get("basketball-status").textContent, /Ambiguous team name: Falcons/);
  assert.equal(h.get("basketball-source-details").open, true);
  const choose = h.get("basketball-sources").querySelectorAll("button").find(b => b.textContent === "Add City Falcons");
  assert.ok(choose); await choose.fire("click"); assert.equal(h.requests.length, 1);
  assert.equal(h.get("preferred-teams").children.length, 3);
  await h.click("find"); assert.equal(counts(h), 2);
  assert.doesNotMatch(text(h.get("basketball-games")), /tpbl-2/);
});
test("old exact-only backend is rejected instead of masquerading as fuzzy search", async () => {
  for (const marker of [undefined, "tpbl-fuzzy-v0", null]) {
    const h = harness(async (_path, options) => {
      const data = response(JSON.parse(options.body)); data.teamMatching = marker;
      return { ok: true, json: async () => data };
    });
    await h.click("find"); assert.equal(counts(h), 0);
    assert.match(h.get("basketball-status").textContent, /Search unavailable/);
  }
});
test("fuzzy UI rejects forged unrelated and ambiguous games without incomplete client filtering", async () => {
  for (const ambiguous of [false, true]) {
    const rows = [row(1, undefined, { home_team: { name: "City Falcons" } }),
      row(2, undefined, { home_team: { name: ambiguous ? "Valley Falcons" : "Unrelated Club" } })];
    const h = harness(async (_path, options) => {
      const request = JSON.parse(options.body), data = response({ ...request, teamIds: [], teamMode: "prefer", rows });
      data.teamSelection = T.selection(request.teamIds, request.teamMode);
      data.sources[0].preferredCount = data.games.length;
      return { ok: true, json: async () => data };
    });
    await h.category("sports"); await h.sport("basketball"); await h.addTeam("Falcons"); await h.click("find");
    assert.equal(counts(h), 0); assert.match(h.get("basketball-status").textContent, /Search unavailable/);
  }
});
test("fuzzy source names stay literal and date edits fence candidate controls", async () => {
  const rows = [row(1, undefined, { home_team: { name: "City Falcons" } }),
    row(2, undefined, { home_team: { name: "Valley Falcons" } })];
  const h = harness(async (_path, options) => ({ ok: true, json: async () => response({ ...JSON.parse(options.body), rows }) }));
  await h.category("sports"); await h.sport("basketball"); await h.addTeam("Falcons"); await h.click("find");
  const control = h.get("basketball-sources").querySelectorAll("button")[0];
  assert.ok(control); await h.input("activity-end", "2026-09-25"); await control.fire("click");
  assert.equal(h.get("preferred-teams").children.length, 1); assert.equal(h.requests.length, 1);
  assert.doesNotMatch(h.storage.getItem(D.key), /Falcons|team/);
});
test("known team with no games is distinct from unknown names and unavailable source has no suggestions", async () => {
  const h = harness(async (_path, options) => ({ ok: true, json: async () => response({ ...JSON.parse(options.body), rows: [row(1, "2026-10-09")] }) }));
  await h.category("sports"); await h.sport("basketball"); await h.addTeam("Synthetic Home"); await h.click("find");
  assert.match(h.get("basketball-status").textContent, /Team names matched.*no upcoming games/);
  assert.doesNotMatch(h.get("basketball-status").textContent, /No exact team-name match/);
  const failed = harness(async (_path, options) => { const data = response({ ...JSON.parse(options.body), rows: [] }); data.sources[0].status = "unavailable"; return { ok: true, json: async () => data }; });
  await failed.category("sports"); await failed.sport("basketball"); await failed.addTeam("Unknown"); await failed.click("find");
  assert.equal(failed.get("basketball-sources").querySelectorAll("button").length, 0);
  assert.doesNotMatch(failed.get("basketball-status").textContent, /No exact team-name match/);
});
test("returned-name recovery is literal, bounded and stale controls cannot change preferences", async () => {
  const rows = Array.from({ length: 20 }, (_, i) => row(i + 1, undefined, { home_team: { id: i + 100, name: i ? `Synthetic ${i}` : "<img onerror=evil>" } }));
  const h = harness(async (_path, options) => ({ ok: true, json: async () => response({ ...JSON.parse(options.body), rows }) }));
  await h.category("sports"); await h.sport("basketball"); await h.addTeam("Unknown"); await h.click("find");
  const controls = h.get("basketball-sources").querySelectorAll("button");
  assert.equal(controls.length, 16); assert.match(text(h.get("basketball-sources")), /first 16/);
  assert.equal(h.get("basketball-sources").querySelectorAll("img").length, 0);
  await h.click("reset"); await controls[0].fire("click");
  assert.equal(h.get("preferred-teams").children.length, 0); assert.equal(h.requests.length, 1);
});
test("demo starts without preset teams and accepts manually typed CTBC preference via Enter", async () => {
  const fs = require("node:fs");
  const html = fs.readFileSync(require.resolve("../activity-preview/index.html"), "utf8");
  const controller = fs.readFileSync(require.resolve("../activity-preview/basketball-ui.js"), "utf8");
  assert.doesNotMatch(html, /add-dreamers|福爾摩沙夢想家|中信特攻/);
  assert.doesNotMatch(controller, /\$\("add-dreamers"\)/);
  const rows = [row(1, undefined, { home_team: { id: 99, name: "中信特攻" } }), row(2)];
  const h = harness(async (_path, options) => ({ ok: true, json: async () => response({ ...JSON.parse(options.body), rows }) }));
  await h.category("sports"); await h.sport("basketball");
  assert.equal(h.get("team-name").value, ""); assert.equal(h.get("preferred-teams").children.length, 0);
  assert.equal(h.get("team-suggestions").children.length, 0); assert.equal(h.requests.length, 0);
  await h.input("team-name", "中信特攻"); await h.key("team-name", "Enter");
  assert.equal(h.requests.length, 0); assert.equal(h.get("preferred-teams").children.length, 1);
  await h.click("find"); assert.equal(counts(h), 1);
  assert.deepEqual(JSON.parse(h.requests[0].options.body).teamIds, [T.preferredTeam("中信特攻").key]);
  assert.equal(JSON.parse(h.requests[0].options.body).teamMode, "only");
  assert.match(text(h.get("basketball-games")), /tpbl-1/); assert.doesNotMatch(text(h.get("basketball-games")), /tpbl-2/);
  await h.click("reset"); assert.equal(h.get("team-name").value, ""); assert.equal(h.get("preferred-teams").children.length, 0);
});
test("screenshot listing27538 is excluded with Dreamers-only but checkbox alone cannot select a team", async () => {
  // User-supplied card facts, replayed offline; not a new verified source response.
  const rows = [row(27538, "2026-10-10", {
    home_team: { name: "高雄全家海神" }, away_team: { name: "新竹御嵿攻城獅" },
    game_time: "14:30:00", gamed_at: "2026-10-10 14:30:00", venue: "和平籃球館"
  })];
  const h = harness(async (_path, options) => ({ ok: true, json: async () => response({ ...JSON.parse(options.body), rows }) }), { storage: dateStorage() });
  await h.category("sports"); await h.sport("basketball");
  assert.equal(h.get("only-teams").checked, true); assert.equal(h.get("preferred-teams").children.length, 0);
  await h.click("find"); assert.equal(counts(h), 1);
  assert.deepEqual(JSON.parse(h.requests[0].options.body).teamIds, []);
  assert.match(text(h.get("basketball-games")), /tpbl-27538/);
  await h.addTeam("Formosa Dreamers"); await h.click("find");
  const request = JSON.parse(h.requests[1].options.body);
  assert.deepEqual(request.teamIds, [T.dreamersKey]); assert.equal(request.teamMode, "only");
  assert.equal(counts(h), 0); assert.match(h.get("basketball-status").textContent, /No matching favorite-team games/);
  assert.equal(h.get("preferred-teams").children.length, 1);
});
test("visible unadded team input blocks Find instead of silently searching all or previously added teams", async () => {
  for (const only of [true, false]) for (const existing of [false, true]) {
    const h = harness(); await h.category("sports"); await h.sport("basketball");
    if (existing) await h.addTeam("Synthetic Away");
    h.get("only-teams").checked = only;
    await h.input("team-name", "Synthetic Home"); await h.click("find");
    assert.equal(h.requests.length, 0); assert.equal(counts(h), 0);
    assert.equal(h.get("results").hidden, true); assert.equal(h.focus.id, "team-name");
    assert.match(h.get("team-status").textContent, /Add.*clear/);
    assert.equal(h.get("team-name").value, "Synthetic Home");
    assert.equal(h.get("only-teams").checked, only);
    await h.click("add-team"); await h.click("find");
    assert.equal(h.requests.length, 1);
    const selection = JSON.parse(h.requests[0].options.body);
    assert.equal(selection.teamMode, only ? "only" : "prefer");
    assert.equal(selection.teamIds.length, existing ? 2 : 1);
  }
});
test("draft-team guard ignores hidden preferences, clears on reset and accepts duplicate Add recovery", async () => {
  const h = harness(); await h.category("sports"); await h.sport("basketball");
  await h.input("team-name", "Synthetic Home"); await h.click("find");
  assert.equal(h.requests.length, 0);
  await h.click("surprise"); await h.click("find");
  assert.deepEqual(JSON.parse(h.requests[0].options.body).teamIds, []);
  await h.category("sports"); await h.sport("basketball"); await h.click("add-team");
  await h.addTeam("synthetic HOME"); assert.equal(h.get("team-name").value, "");
  await h.click("find"); assert.equal(h.requests.length, 2);
  await h.input("team-name", "Unadded"); await h.click("reset"); await h.click("find");
  assert.equal(h.requests.length, 3); assert.deepEqual(JSON.parse(h.requests[2].options.body).teamIds, []);
});
test("preferred-only excludes unrelated games but retains the preferred team's opponent, without translation suffixes", async () => {
  const rows = [row(1, undefined, { home_team: { id: 91, name: "Formosa Dreamers" }, away_team: { id: 92, name: "Synthetic 對手" } }),
    row(2, undefined, { away_team: { id: 91, name: "Formosa Dreamers" } }), row(3)];
  const h = harness(async (_path, options) => ({ ok: true, json: async () => response({ ...JSON.parse(options.body), rows }) }));
  await h.category("sports"); await h.sport("basketball"); await h.addTeam("Formosa Dreamers"); await h.click("find");
  assert.equal(h.get("only-teams").checked, true); assert.equal(counts(h), 2);
  assert.match(text(h.get("basketball-games")), /tpbl-1/); assert.match(text(h.get("basketball-games")), /tpbl-2/);
  assert.doesNotMatch(text(h.get("basketball-games")), /tpbl-3/);
  assert.match(text(h.get("basketball-games")), /Synthetic 對手/);
  assert.doesNotMatch(text(h.get("basketball-games")) + text(h.get("team-suggestions")), /English translation unverified/);
  await h.addTeam("Synthetic 對手");
  assert.doesNotMatch(text(h.get("preferred-teams")) + text(h.get("team-status")), /English translation unverified/);
});
test("preferred-only rejects unrelated games even when a backend claims the requested selection", async () => {
  const h = harness(async (_path, options) => {
    const request = JSON.parse(options.body);
    const data = response({ ...request, teamIds: [], teamMode: "prefer", rows: [row(1)] });
    data.teamSelection = T.selection(request.teamIds, request.teamMode);
    return { ok: true, json: async () => data };
  });
  await h.category("sports"); await h.sport("basketball"); await h.addTeam("Formosa Dreamers"); await h.click("find");
  assert.equal(counts(h), 0); assert.match(h.get("basketball-status").textContent, /Search unavailable/);
});
test("preferred-only can be toggled before adding teams and retains the choice", async () => {
  const h = harness(); await h.category("sports"); await h.sport("basketball");
  assert.equal(h.get("only-teams").disabled, false);
  h.get("only-teams").checked = false; await h.get("only-teams").fire("change");
  assert.equal(h.get("only-teams").checked, false); assert.equal(h.requests.length, 0);
  await h.click("find");
  assert.deepEqual(JSON.parse(h.requests[0].options.body).teamIds, []);
  await h.addTeam("Synthetic Home");
  assert.equal(h.get("only-teams").checked, false);
  await h.click("find"); assert.equal(JSON.parse(h.requests[1].options.body).teamMode, "prefer");
  h.get("only-teams").checked = true; await h.get("only-teams").fire("change");
  await h.removeTeam(0); assert.equal(h.get("only-teams").disabled, false);
  h.get("only-teams").checked = false; await h.get("only-teams").fire("change");
  assert.equal(h.get("only-teams").checked, false);
});
test("Add and Enter add trimmed names before any roster exists, never submit search; composition is safe", async () => {
  const h = harness(); await h.category("sports"); await h.sport("basketball");
  await h.input("team-name", "  Synthetic Falcons  ");
  const event = await h.key("team-name", "Enter");
  assert.equal(event.defaultPrevented, true); assert.equal(h.requests.length, 0);
  assert.equal(h.get("team-name").value, ""); assert.equal(h.focus.id, "team-name");
  assert.equal(h.get("preferred-teams").children.length, 1); assert.match(text(h.get("preferred-teams")), /Synthetic Falcons/);
  assert.equal(h.get("team-status").textContent, "");
  await h.input("team-name", "Synthetic Composing"); await h.key("team-name", "Enter", { isComposing: true });
  assert.equal(h.get("preferred-teams").children.length, 1); assert.equal(h.requests.length, 0);
  await h.key("add-team", "Enter"); assert.equal(h.get("preferred-teams").children.length, 2); assert.equal(h.requests.length, 0);
  await h.click("find");
  assert.deepEqual(JSON.parse(h.requests[0].options.body).teamIds, T.selection([T.preferredTeam("Synthetic Falcons").key, T.preferredTeam("Synthetic Composing").key]).teamIds);
  assert.equal(JSON.parse(h.requests[0].options.body).teamMode, "only"); assert.equal(counts(h), 0);
});
test("normalized duplicates and bilingual Dreamers remain one removable preference, Add never replaces others", async () => {
  const h = harness(); await h.category("sports"); await h.sport("basketball");
  await h.addTeam(" Synthetic Falcons "); await h.addTeam("synthetic FALCONS");
  assert.equal(h.get("preferred-teams").children.length, 1); assert.match(h.get("team-status").textContent, /Already/);
  await h.addTeam("福爾摩沙夢想家"); await h.addTeam(" formosa DREAMERS "); await h.addTeam("Formosa Dreamers");
  assert.equal(h.get("preferred-teams").children.length, 2); assert.match(h.get("team-status").textContent, /Already/);
  const removal = h.get("preferred-teams").querySelectorAll("button")[0];
  assert.equal(removal.attributes["aria-label"], "Remove Synthetic Falcons");
  await h.removeTeam(0); assert.equal(h.focus, h.get("preferred-teams").querySelectorAll("button")[0]);
  await h.removeTeam(0); assert.equal(h.focus.id, "team-name"); assert.equal(h.get("team-summary").textContent, "");
  assert.equal(h.get("team-status").textContent, "");
  await h.addTeam("SYNTHETIC FALCONS"); await h.addTeam("Formosa Dreamers"); assert.equal(h.get("preferred-teams").children.length, 2);
  assert.equal(h.requests.length, 0);
});
test("blank, long and control names fail without echo, changing the existing list or searching; XSS is literal text", async () => {
  const h = harness(); await h.category("sports"); await h.sport("basketball"); await h.addTeam("Synthetic Keep");
  for (const name of ["", "   ", "x".repeat(121), "\nSynthetic", "Synthetic\t", "Synthetic\u0000", "Synthetic\u007f", "Synthetic\u202e", "Synthetic\u2066", "\ud800"]) {
    await h.addTeam(name); assert.equal(h.get("preferred-teams").children.length, 1);
    assert.match(h.get("team-status").textContent, /1–120 characters/); assert.equal(h.get("team-name").attributes["aria-invalid"], "true"); assert.equal(h.focus.id, "team-name");
  }
  await h.addTeam("x".repeat(120)); assert.equal(h.get("preferred-teams").children.length, 2);
  await h.addTeam('<img src=x onerror="evil()">');
  assert.equal(h.get("preferred-teams").children.length, 3); assert.equal(h.get("preferred-teams").querySelectorAll("img").length, 0);
  assert.match(text(h.get("preferred-teams")), /<img src=x/); assert.equal(h.get("team-name").attributes["aria-invalid"], undefined);
  assert.equal(h.requests.length, 0);
});
test("current-page preferred chips survive date/category changes but never storage, reset, reload or page exit", async () => {
  const h = harness(); await h.category("sports"); await h.sport("basketball"); await h.addTeam("Synthetic Keep");
  const snapshot = h.storage.getItem(D.key);
  await h.category("music"); assert.equal(h.get("team-controls").hidden, true); assert.match(text(h.get("preferred-teams")), /Synthetic Keep/);
  await h.category("sports"); assert.equal(h.get("team-controls").hidden, false);
  await h.input("activity-end", "2026-09-25"); assert.match(text(h.get("preferred-teams")), /Synthetic Keep/);
  await h.click("reset-dates"); assert.match(text(h.get("preferred-teams")), /Synthetic Keep/); assert.equal(h.get("team-suggestions").children.length, 0);
  const restored = harness(undefined, { storage: h.storage }); assert.equal(restored.get("preferred-teams").children.length, 0);
  assert.doesNotMatch(snapshot, /Synthetic|team/);
  for (const action of [() => h.click("reset"), () => h.lifecycle("pagehide"), () => h.lifecycle("pageshow", { persisted: true })]) {
    await h.category("sports"); await h.sport("basketball"); await h.addTeam("Synthetic Keep"); await h.input("team-name", "Unadded"); await action();
    assert.equal(h.get("preferred-teams").children.length, 0); assert.equal(h.get("team-name").value, ""); assert.equal(h.get("team-status").textContent, "");
  }
  assert.equal(h.requests.length, 0);
});
test("added exact name renders numeric-ID home and away past40, nonexistent names have no fallback", async () => {
  const rows = [...Array.from({ length: 45 }, (_, i) => row(i + 1)),
    row(46, "2026-09-21", { home_team: { id: 99, name: "Synthetic Falcons" } }),
    row(47, "2026-09-22", { away_team: { id: 99, name: "Synthetic Falcons" } })];
  const h = harness(async (_path, options) => ({ ok: true, json: async () => response({ ...JSON.parse(options.body), rows }) }));
  await h.category("sports"); await h.sport("basketball"); await h.addTeam(" synthetic FALCONS "); await h.click("find");
  assert.equal(counts(h), 2); assert.match(text(h.get("basketball-games")), /tpbl-46/); assert.match(text(h.get("basketball-games")), /tpbl-47/);
  assert.equal(h.get("basketball-status").textContent, "2 games found.");
  await h.get("basketball-games").querySelectorAll("button")[0].fire("click");
  await h.removeTeam(0); assert.equal(counts(h), 0); assert.equal(h.get("cards").innerHTML, "");
  await h.addTeam("Nonexistent Club"); await h.click("find"); assert.equal(counts(h), 0); assert.match(h.get("basketball-status").textContent, /No alternate team/);
  assert.match(text(h.get("preferred-teams")), /Nonexistent Club/);
});
test("adding or removing teams fences both transport and decoding, including selected-game cleanup", async () => {
  for (const phase of ["transport", "decode"]) for (const action of [h => h.addTeam("Synthetic New"), h => h.removeTeam(0)]) {
    let finish, started; const ready = new Promise(resolve => { started = resolve; });
    const h = harness(phase === "transport" ? () => new Promise(resolve => { finish = resolve; started(); }) : async () => ({ ok: true, json: () => new Promise(resolve => { finish = resolve; started(); }) }));
    await h.category("sports"); await h.sport("basketball"); await h.addTeam("Synthetic Home");
    const pending = h.click("find"); await ready; await action(h);
    assert.equal(h.requests[0].options.signal.aborted, true);
    const data = response(JSON.parse(h.requests[0].options.body)); finish(phase === "transport" ? { ok: true, json: async () => data } : data); await pending;
    assert.equal(counts(h), 0); assert.equal(h.get("basketball-sources").children.length, 0); assert.equal(h.get("cards").innerHTML, ""); assert.equal(h.requests.length, 1);
  }
});
test("non-basketball sports and combinations make zero network requests and never show basketball workshops", async () => {
  const h = harness(); await h.category("sports");
  for (const sports of [["pingpong"], ["baseball"], ["football"], ["badminton"], ["swimming"], ["football", "swimming"]]) {
    await h.sport(...sports); await h.click("find");
    assert.equal(h.get("basketball-choices").hidden, true); assert.equal(h.get("team-controls").hidden, true);
    assert.match(h.get("cards").innerHTML, /No ideas match/); assert.doesNotMatch(h.get("cards").innerHTML, /Little hoops/);
    assert.match(h.get("basketball-status").textContent, /Public search not requested/);
    assert.equal(h.requests.length, 0);
  }
  await h.category("sports", "music"); await h.click("find");
  assert.match(h.get("cards").innerHTML, /pocket-sized orchestra/); assert.doesNotMatch(h.get("cards").innerHTML, /Little hoops/); assert.equal(h.requests.length, 0);
});

test("hidden preferred teams never restrict Anything or all-sports searches", async () => {
  for (const only of [true, false]) {
    const h = harness(); await h.category("sports"); await h.sport("basketball"); await h.addTeam("Formosa Dreamers"); h.get("only-teams").checked = only;
    await h.sport("swimming"); await h.click("find"); assert.equal(h.requests.length, 0); assert.doesNotMatch(h.get("cards").innerHTML, /Little hoops/);
    await h.click("surprise"); await h.click("find");
    assert.equal(counts(h), 1); assert.match(h.get("cards").innerHTML, /Little hoops/);
    assert.deepEqual(JSON.parse(h.requests[0].options.body).teamIds, []); assert.equal(JSON.parse(h.requests[0].options.body).teamMode, "prefer");
    assert.doesNotMatch(h.get("result-summary").textContent, /Basketball:|Swimming/);
    assert.doesNotMatch(h.get("basketball-status").textContent + text(h.get("basketball-games")), /match your teams|Matches a selected team|Another team/);
    assert.equal(h.get("team-recovery").hidden, true);
    await h.category("sports"); await h.sport(); await h.click("find");
    assert.equal(h.get("basketball-choices").hidden, true); assert.equal(counts(h), 1);
    assert.deepEqual(JSON.parse(h.requests[1].options.body).teamIds, []); assert.match(h.get("cards").innerHTML, /Little hoops/);
    await h.sport("basketball"); assert.match(text(h.get("preferred-teams")), /福爾摩沙夢想家/);
    await h.click("find");
    assert.equal(h.requests.length, 3);
    assert.deepEqual(JSON.parse(h.requests[2].options.body).teamIds, [T.dreamersKey]);
    assert.equal(JSON.parse(h.requests[2].options.body).teamMode, only ? "only" : "prefer");
  }
});

test("multiple sport choices dispatch spectator Basketball only when included", async () => {
  const h = harness(); await h.category("sports"); await h.sport("basketball", "swimming");
  await h.click("find"); assert.equal(h.requests.length, 1); assert.doesNotMatch(h.get("cards").innerHTML, /Little hoops/);
  await h.sport("swimming"); await h.click("find"); assert.equal(h.requests.length, 1);
  await h.sport("basketball"); await h.click("find"); assert.equal(h.requests.length, 2); assert.doesNotMatch(h.get("cards").innerHTML, /Little hoops/);
  for (const request of h.requests) assert.deepEqual(Object.keys(JSON.parse(request.options.body)).sort(), ["endDate", "startDate", "teamIds", "teamMode"]);
});

test("sport edits clear both result sections and fence transport and JSON-decode late responses", async () => {
  for (const phase of ["transport", "decode"]) {
    let finish, started; const ready = new Promise(resolve => { started = resolve; });
    const h = harness(phase === "transport" ? () => new Promise(resolve => { finish = resolve; started(); }) : async () => ({ ok: true, json: () => new Promise(resolve => { finish = resolve; started(); }) }));
    await h.category("sports"); await h.sport("basketball"); const pending = h.click("find"); await ready;
    assert.doesNotMatch(h.get("cards").innerHTML, /Little hoops/);
    await h.sport("swimming"); assert.equal(h.get("cards").innerHTML, ""); assert.equal(h.get("results").hidden, true);
    assert.equal(h.requests[0].options.signal.aborted, true);
    finish(phase === "transport" ? { ok: true, json: async () => response() } : response()); await pending;
    assert.equal(counts(h), 0); assert.equal(h.get("basketball-sources").children.length, 0);
    await h.click("find"); assert.equal(h.requests.length, 1); assert.match(h.get("cards").innerHTML, /No ideas match/);
  }
  const h = harness(); await h.click("find"); assert.equal(counts(h), 1);
  await h.category("sports"); await h.sport("swimming"); assert.equal(counts(h), 0); assert.equal(h.get("cards").innerHTML, "");
});

test("native keyboard event seam progresses Sports then Basketball, Enter searches and reset clears without searching", async () => {
  const h = harness(); await h.key("sports", " ");
  assert.equal(h.focus.id, "sports"); assert.equal(h.get("sport-choices").hidden, false); assert.equal(h.get("basketball-choices").hidden, true);
  await h.key("basketball", " "); assert.equal(h.focus.id, "basketball"); assert.equal(h.get("basketball-choices").hidden, false); assert.equal(h.requests.length, 0);
  await h.key("find", "Enter"); assert.equal(h.requests.length, 1); assert.equal(h.focus.id, "basketball-title");
  await h.key("basketball", " "); assert.equal(h.get("basketball-choices").hidden, true); assert.equal(counts(h), 0); assert.equal(h.requests.length, 1);
  await h.key("basketball", " "); await h.addTeam("Formosa Dreamers"); await h.click("reset");
  assert.ok(h.interests.concat(h.sports).every(field => !field.checked)); assert.equal(h.get("only-teams").checked, true); assert.equal(h.get("only-teams").disabled, false);
  assert.equal(h.get("team-summary").textContent, ""); assert.equal(h.focus.id, "find"); assert.equal(h.requests.length, 1);
});

test("malicious DOM sport values block dispatch without echo and focus a visible recovery control", async () => {
  for (const explicit of [true, false]) {
    const h = harness(); if (explicit) await h.category("sports");
    h.sports[0].checked = true; h.sports[0].value = "<img onerror=evil>"; await h.form.fire("change"); await h.click("find");
    assert.equal(h.requests.length, 0); assert.equal(counts(h), 0); assert.equal(h.get("results").hidden, true);
    assert.match(h.get("form-error").textContent, /listed sports/); assert.doesNotMatch(h.get("form-error").textContent, /<img|onerror/);
    assert.equal(h.focus.id, explicit ? "sport-choices" : "find");
  }
});

test("rendered controller statuses, errors, source details and cards omit redundant labels, preserve synthetic truth", async () => {
  const check = h => {
    for (const id of ["basketball-status", "basketball-sources", "basketball-games", "team-summary", "preferred-teams", "team-status", "discovery-scope", "status", "results-title", "result-summary", "form-error"]) assert.doesNotMatch(text(h.get(id)), /\b(?:demo|samples?)\b/i, id);
    assert.doesNotMatch(h.get("cards").innerHTML.replace(/<[^>]*>/g, " "), /\b(?:demo|samples?)\b/i);
  };
  const h = harness(); check(h); await h.click("find"); check(h);
  assert.match(text(h.get("basketball-games")), /Synthetic test data/); assert.match(text(h.get("basketball-sources")), /Synthetic test data/);
  assert.match(text(h.get("basketball-sources")), /Retrieved|May be out of date/);
  await h.category("sports"); await h.sport("basketball"); await h.addTeam("Formosa Dreamers"); check(h); await h.click("find"); check(h);
  await h.category("music"); await h.click("find"); check(h);
  for (const options of [{ preview: true }, { contextWeek: null }]) { const offline = harness(undefined, options); await offline.click("find"); check(offline); }
  const failed = harness(async () => ({ ok: false, status: 503 })); await failed.click("find"); check(failed);
  assert.match(failed.get("basketball-status").textContent, /Search unavailable/);
});

test("category-first Anything starts idle and keeps six diverse samples separate from public games", async () => {
  const h = harness(); assert.equal(h.requests.length, 0); assert.equal(h.get("preferred-teams").children.length, 0); assert.equal(h.get("team-summary").textContent, "");
  assert.equal(h.get("basketball-choices").hidden, true); await h.click("find");
  assert.equal(h.requests.length, 1); assert.equal(counts(h), 1);
  assert.equal((h.get("cards").innerHTML.match(/<article/g) || []).length, 6);
  assert.match(h.get("status").textContent, /Fixed September 20–26 examples/);
  assert.match(text(h.get("basketball-sources")), /No invented results added/); assert.match(text(h.get("basketball-sources")), /Not searched/);
  assert.match(text(h.get("basketball-sources")), /Synthetic test data/); assert.match(text(h.get("basketball-games")), /Synthetic test data · TPBL fixture/);
});
test("Sports reveals unchecked sport choices; only Basketball reveals its options, Anything/reset collapse", async () => {
  const h = harness();
  assert.equal(h.get("sport-choices").hidden, true);
  assert.equal(h.get("basketball-choices").hidden, true);
  assert.ok(h.sports.every(field => !field.checked));
  await h.category("sports"); assert.equal(h.get("sport-choices").hidden, false); assert.equal(h.get("basketball-choices").hidden, true);
  assert.ok(h.sports.every(field => !field.checked));
  await h.sport("basketball"); assert.equal(h.get("basketball-choices").hidden, false);
  await h.category("sports", "music"); assert.equal(h.get("basketball-choices").hidden, false);
  await h.category("music"); assert.equal(h.get("basketball-choices").hidden, true);
  await h.category("sports"); await h.sport("swimming"); assert.equal(h.get("basketball-choices").hidden, true);
  await h.sport("basketball", "swimming"); assert.equal(h.get("basketball-choices").hidden, false);
  await h.category("sports"); await h.click("surprise");
  assert.equal(h.get("basketball-choices").hidden, true); assert.equal(h.get("sport-choices").hidden, true);
  await h.category("sports"); await h.click("reset");
  assert.equal(h.get("basketball-choices").hidden, true); assert.equal(h.get("sport-choices").hidden, true);
  assert.ok(h.sports.every(field => !field.checked));
  assert.equal(h.requests.length, 0);
});
test("non-sports categories, combinations and invalid ages never request spectator games", async () => {
  const h = harness();
  for (const category of ["music", "art", "science", "outdoors", "exhibition"]) {
    await h.category(category); assert.equal(h.get("basketball-choices").hidden, true); await h.click("find");
    assert.equal((h.get("cards").innerHTML.match(/<article/g) || []).length, 1);
  }
  await h.category("music", "art"); await h.click("find"); assert.equal((h.get("cards").innerHTML.match(/<article/g) || []).length, 2);
  await h.category(); assert.equal(h.requests.length, 0);
  await h.category("sports"); await h.sport("basketball"); h.ages[0].value = "<img>"; await h.click("find"); assert.equal(h.requests.length, 0); assert.equal(h.focus.id, "age-0");
});
test("Basketball dispatches explicitly and never sends ages or invented-idea format preferences", async () => {
  const h = harness(); await h.category("sports", "music"); await h.sport("basketball"); h.ages[0].value = "8"; h.get("budget").value = "15"; await h.click("find");
  assert.doesNotMatch(h.get("cards").innerHTML, /Little hoops/); assert.match(h.get("cards").innerHTML, /pocket-sized orchestra/);
  const { path, options } = h.requests[0]; assert.equal(path, "/api/activities/basketball");
  assert.deepEqual(JSON.parse(options.body), { startDate: "2026-09-20", endDate: "2026-09-26", teamIds: [], teamMode: "prefer" });
  assert.equal(options.credentials, "omit"); assert.equal(options.referrerPolicy, "no-referrer"); assert.equal(options.redirect, "error"); assert.deepEqual(Object.keys(options.headers), ["Content-Type"]);
  h.get("format").value = "class"; await h.form.fire("change"); assert.equal(counts(h), 0); assert.equal(h.requests.length, 1); await h.click("find"); assert.equal(h.requests.length, 2); assert.doesNotMatch(h.get("cards").innerHTML, /Little hoops/);
});
test("manually added Dreamers displays one language across chips, cards and suggestions while matching both aliases", async () => {
  const rows = [row(1, undefined, { home_team: { id: 91, name: "福爾摩沙夢想家" } }), row(2, undefined, { away_team: { name: "Formosa Dreamers" } }), row(3)];
  const h = harness(async (_path, options) => ({ ok: true, json: async () => response({ ...JSON.parse(options.body), rows }) }));
  await h.category("sports"); await h.sport("basketball");
  const html = require("node:fs").readFileSync(require.resolve("../activity-preview/index.html"), "utf8");
  assert.doesNotMatch(html, /id="add-dreamers"/);
  await h.addTeam("Formosa Dreamers"); assert.equal(h.requests.length, 0); assert.match(text(h.get("preferred-teams")), /福爾摩沙夢想家/);
  await h.click("find"); assert.deepEqual(JSON.parse(h.requests[0].options.body).teamIds, [T.dreamersKey]); assert.equal(JSON.parse(h.requests[0].options.body).teamMode, "only"); assert.equal(counts(h), 2);
  assert.equal((text(h.get("basketball-games")).match(/福爾摩沙夢想家/g) || []).length, 2); assert.doesNotMatch(h.get("cards").innerHTML, /Little hoops/);
  for (const id of ["preferred-teams", "team-status", "basketball-games", "team-suggestions"]) assert.doesNotMatch(text(h.get(id)), /Formosa Dreamers/);
  const suggestions = h.get("team-suggestions").children;
  assert.equal(suggestions.filter(option => option.value === "福爾摩沙夢想家").length, 1);
  assert.ok(suggestions.every(option => option.value === option.textContent));
  const controls = h.get("basketball-games").querySelectorAll("button"); await controls[0].fire("click"); assert.equal(controls[0].attributes["aria-pressed"], "true"); assert.equal(h.get("basketball-games").querySelectorAll("details")[0].open, true);
  assert.doesNotMatch(controls[0].attributes["aria-label"] + h.get("basketball-status").textContent, /Formosa Dreamers/);
  await controls[1].fire("click"); assert.equal(controls[0].attributes["aria-pressed"], "false"); assert.equal(controls[1].textContent, "Selected"); assert.match(h.get("basketball-status").textContent, /nothing booked, saved or added/);
});
test("added names and prefer/only/removal change page state without autosend; source autocomplete is optional", async () => {
  const rows = [row(1, undefined, { home_team: { id: 12, name: "Synthetic A" }, away_team: { id: 13, name: "Synthetic B" } }), row(2, undefined, { home_team: { id: 14, name: "Synthetic C" } })];
  const h = harness(async (_path, options) => ({ ok: true, json: async () => response({ ...JSON.parse(options.body), rows }) }));
  await h.category("sports"); await h.sport("basketball");
  await h.addTeam("Synthetic A"); await h.addTeam("Synthetic B"); assert.equal(h.requests.length, 0);
  await h.click("find"); assert.equal(counts(h), 1); assert.ok(h.get("team-suggestions").children.some(option => option.value === "Synthetic C"));
  h.get("only-teams").checked = false; await h.get("only-teams").fire("change"); assert.equal(h.requests.length, 1); assert.equal(counts(h), 0); assert.equal(h.get("cards").innerHTML, "");
  await h.click("find"); assert.equal(JSON.parse(h.requests[1].options.body).teamIds.length, 2); assert.equal(counts(h), 2);
  h.get("only-teams").checked = true; await h.get("only-teams").fire("change"); await h.click("find"); assert.equal(counts(h), 1);
  await h.removeTeam(0); await h.removeTeam(0); assert.equal(counts(h), 0); assert.equal(h.requests.length, 3); assert.equal(h.get("team-summary").textContent, "");
});
test("no favorite matches offers explicit all/date/name-edit recovery, never automatic replacement", async () => {
  const h = harness(); await h.category("sports"); await h.sport("basketball"); await h.addTeam("Formosa Dreamers"); await h.click("find"); assert.equal(counts(h), 0);
  assert.match(h.get("basketball-status").textContent, /No matching favorite-team games/); assert.equal(h.get("team-recovery").hidden, false);
  await h.click("edit-preferred-teams"); assert.match(text(h.get("preferred-teams")), /福爾摩沙夢想家/); assert.equal(h.focus.id, "team-name"); assert.equal(h.requests.length, 1);
  await h.click("find"); await h.click("change-activity-dates"); assert.equal(h.focus.id, "activity-start"); assert.equal(h.requests.length, 2);
  await h.click("find"); await h.click("show-all-teams"); assert.equal(h.focus.id, "find"); assert.equal(counts(h), 0);
  await h.click("find"); assert.equal(counts(h), 1); assert.deepEqual(JSON.parse(h.requests.at(-1).options.body).teamIds, []);
  const empty = harness(async (_path, options) => ({ ok: true, json: async () => response({ ...JSON.parse(options.body), rows: [] }) }));
  await empty.category("sports"); await empty.sport("basketball");
  await empty.addTeam("Formosa Dreamers"); await empty.click("find"); assert.equal(empty.get("team-suggestions").children.length, 0);
  await empty.click("edit-preferred-teams"); assert.equal(empty.focus.id, "team-name"); assert.equal(empty.requests.length, 1);
});
test("actual cards/roster use literal text, safe links and unknown guidance", async () => {
  const h = harness(async () => ({ ok: true, json: async () => response({ rows: [row(1, undefined, { home_team: { name: "<img onerror=evil>" } })] }) }));
  await h.click("find"); const cards = h.get("basketball-games"); assert.match(text(cards), /<img onerror=evil>/); assert.match(text(h.get("team-suggestions")), /<img onerror=evil>/); assert.equal(cards.querySelectorAll("img").length, 0);
  for (const phrase of [/Age guidance not provided/, /Admission, price and ticket availability unknown/, /feed supplies a local clock, not a UTC offset/]) assert.match(text(cards), phrase);
  for (const a of cards.querySelectorAll("a")) { assert.equal(a.href, "https://tpbl.basketball/schedule/1"); assert.equal(a.rel, "noopener noreferrer"); }
});
test("source unavailable, empty, outside range and partial stay distinct", async () => {
  for (const [state, expected] of [["outside_coverage", /outside.*published game range/], ["unavailable", /could not be checked/], ["no_matches", /retrieved TPBL season listing/], ["partial", /could not be verified/]]) {
    const data = response({ rows: [] }); data.sources[0].status = state; const h = harness(async () => ({ ok: true, json: async () => data })); await h.click("find");
    assert.match(h.get("basketball-status").textContent, expected); assert.equal(counts(h), 0); assert.equal(h.get("basketball-sources").querySelectorAll("a").length, 2);
  }
});
test("old/truncated/team-mismatched contracts and malicious URLs/IDs/dates fail closed", async () => {
  const changes = [data => { delete data.teamContract; }, data => { data.teamContract = "tpbl-teams-v1"; }, data => { delete data.availableTeams; }, data => { data.teamSelection.teamMode = "only"; }, data => { data.sources[0].truncated = true; }, data => { data.sources[0].status = "unavailable"; }, data => { data.week.end = "2030-01-01"; }, data => { data.availableTeams[0].key = "javascript:alert(1)"; }, data => { data.availableTeams[0].gamesInRange = -1; },
    ...[{ sourceUrl: "javascript:alert(1)" }, { sourceUrl: "https://tpbl.basketball.evil.test/schedule/1" }, { date: "2026-09-27" }, { date: "2026-09-19" }, { time: "24:00" }, { home: "x".repeat(121) }, { homeKey: "tpbl:id:999" }].map(change => data => Object.assign(data.games[0], change))];
  for (const change of changes) {
    const data = response(); change(data); const h = harness(async () => ({ ok: true, json: async () => data })); await h.click("find"); assert.match(h.get("basketball-status").textContent, /Search unavailable/); assert.equal(counts(h), 0);
    assert.ok(h.get("basketball-sources").querySelectorAll("a").every(a => /^https:\/\/(tpbl.basketball|pleagueofficial.com)\/schedule$/.test(a.href)));
  }
});
test("cancel/category/sport/team/only/reset/lifecycle fence late data even if transport ignores abort", async () => {
  for (const action of [h => h.click("cancel-games"), h => h.category("music"), h => h.sport("swimming"), h => h.addTeam("Formosa Dreamers"), h => h.get("only-teams").fire("change"), h => h.click("reset"), h => h.lifecycle("pagehide"), h => h.lifecycle("pageshow", { persisted: true }), h => h.input("team-name", "Home")]) {
    let finish; const h = harness(() => new Promise(resolve => { finish = resolve; })); const pending = h.click("find"); assert.match(h.get("basketball-status").textContent, /Checking/); assert.equal(h.get("cancel-games").hidden, false);
    await action(h); assert.equal(h.requests[0].options.signal.aborted, true); finish({ ok: true, json: async () => response() }); await pending;
    assert.equal(counts(h), 0); assert.equal(h.get("basketball-sources").children.length, 0); assert.equal(h.get("cancel-games").hidden, true);
  }
});
test("shared date changes at focus/history/visibility/storage/response/decode fence old data", async () => {
  for (const event of ["focus", "pageshow", "visibilitychange", "storage", "response", "decode"]) {
    let finish; const h = harness(() => new Promise(resolve => { finish = resolve; })); const pending = h.click("find");
    const change = () => D.createStore(() => h.storage).write("2026-10-09", "2026-10-15"); if (event !== "decode") change();
    if (!["response", "decode"].includes(event)) await h.lifecycle(event, { key: D.key });
    finish({ ok: true, json: async () => { if (event === "decode") change(); return response(); } }); await pending;
    assert.equal(counts(h), 0); assert.equal(h.get("date-label").textContent, "9–15 October 2026"); assert.equal(h.requests.length, 1); assert.equal(h.get("cards").innerHTML, "");
    assert.equal(h.get("activity-start").value, "2026-10-09"); assert.equal(h.get("activity-end").value, "2026-10-15");
  }
});
test("direct dates use existing key only, preserve fixed sample dates, and Start over keeps dates", async () => {
  const storage = dateStorage(); storage.setItem("unrelated", "keep");
  const h = harness(async (_path, options) => ({ ok: true, json: async () => response({ ...JSON.parse(options.body), rows: [row(1, "2026-10-09")] }) }), { storage });
  assert.equal(h.get("activity-start").value, "2026-10-09"); await h.input("activity-end", "2026-10-09"); await h.click("find"); assert.equal(counts(h), 1);
  assert.match(h.get("result-summary").textContent, /Sep 20–Sat, Sep 26/); assert.equal(JSON.parse(h.requests[0].options.body).endDate, "2026-10-09");
  await h.addTeam("Formosa Dreamers"); await h.click("reset"); assert.equal(h.get("activity-end").value, "2026-10-09"); assert.equal(h.get("preferred-teams").children.length, 0); assert.equal(h.get("team-summary").textContent, "");
  assert.deepEqual(JSON.parse(storage.getItem(D.key)), { version: 1, state: "selected", startDate: "2026-10-09", endDate: "2026-10-09" });
  await h.click("reset-dates"); assert.equal(storage.getItem(D.key), null); assert.equal(storage.getItem("unrelated"), "keep"); assert.equal(h.requests.length, 1);
});
test("invalid dates block requests, direct edits immediately clear selected games and sample results", async () => {
  const h = harness(); await h.click("find"); await h.get("basketball-games").querySelectorAll("button")[0].fire("click");
  await h.input("activity-start", "2026-10-09"); assert.equal(counts(h), 0); assert.equal(h.get("cards").innerHTML, ""); assert.equal(h.get("find").disabled, true); await h.click("find"); assert.equal(h.requests.length, 1);
  await h.input("activity-end", "2026-10-15"); assert.equal(h.get("find").disabled, false);
  for (const raw of ['{"version":1,"state":"invalid"}', "bad"]) {
    const storage = dateStorage(); storage.setItem(D.key, raw); const invalid = harness(undefined, { storage }); await invalid.click("find"); assert.equal(invalid.requests.length, 0); assert.equal(invalid.get("date-label").textContent, "Choose dates"); await invalid.click("reset-dates"); assert.equal(invalid.get("find").disabled, false);
  }
});
test("offline preview explains basketball limits after Find without changing preferences", async () => {
  const h = harness(undefined, { preview: true });
  assert.equal(h.get("discovery-scope").textContent, "");
  await h.category("sports"); await h.sport("basketball"); await h.addTeam("Synthetic Falcons");
  await h.click("find");
  assert.equal(h.requests.length, 0); assert.equal(counts(h), 0);
  assert.equal(h.get("results").hidden, false); assert.equal(h.get("results-title").textContent, "No matching ideas");
  assert.equal(h.focus.id, "basketball-title");
  assert.match(h.get("basketball-status").textContent, /Offline preview.*No live search was sent/);
  assert.match(h.get("basketball-status").textContent, /no basketball game fixtures/);
  assert.match(h.get("basketball-status").textContent, /Anything.*Find activities/);
  assert.doesNotMatch(h.get("basketball-status").textContent, /older backend|owner server|team-filter contract/);
  assert.equal(h.get("preferred-teams").children.length, 1); assert.equal(h.get("basketball").checked, true);
  assert.equal(h.get("find").disabled, false);
  await h.click("surprise"); await h.click("find");
  assert.equal((h.get("cards").innerHTML.match(/<article/g) || []).length, 6);
  assert.equal(h.requests.length, 0); assert.equal(h.focus.id, "results-title");
  assert.match(h.get("basketball-status").textContent, /September 20–26/);
});
test("offline preview preserves mixed-category ideas and validation errors", async () => {
  const h = harness(undefined, { preview: true });
  await h.category("sports", "music"); await h.sport("basketball"); await h.click("find");
  assert.equal((h.get("cards").innerHTML.match(/<article/g) || []).length, 1);
  assert.equal(h.requests.length, 0); assert.equal(h.get("music").checked, true);
  await h.input("budget", "invalid"); await h.click("find");
  assert.ok(h.get("form-error").textContent); assert.equal(h.focus.id, "budget");
  assert.equal(h.requests.length, 0);
});
test("stale warns without requery, busy/errors recover, standalone preview can still filter samples", async () => {
  const h = harness(async () => ({ ok: true, json: async () => response({ checkedAt: "2026-01-01T00:00:00Z" }) })); await h.click("find"); assert.match(h.get("basketball-status").textContent, /May be out of date/); await h.lifecycle("visibilitychange"); assert.equal(h.requests.length, 1);
  for (const code of [429, 503]) { const failed = harness(async () => ({ ok: false, status: code })); await failed.click("find"); assert.match(failed.get("basketball-status").textContent, code === 429 ? /Wait a few seconds/ : /Search unavailable/); assert.equal(failed.get("find").disabled, false); }
  for (const options of [{ preview: true }, { contextWeek: null }]) { const preview = harness(undefined, options); await preview.click("find"); assert.equal(preview.requests.length, 0); assert.equal((preview.get("cards").innerHTML.match(/<article/g) || []).length, 6); assert.match(preview.get("basketball-status").textContent, options.preview ? /Offline preview/ : /Public search unavailable/); }
});
test("empty three-day October selection works with the unchanged full-week server marker and no startup writes/API", async () => {
  const storage = dateStorage(), writes = [], set = storage.setItem;
  storage.setItem = (...args) => { writes.push(args); return set(...args); };
  const h = harness(async (_path, options) => { const data = response({ ...JSON.parse(options.body), rows: [row(1, "2026-10-09")] }); data.week.label = "9 – 11 October 2026"; return { ok: true, json: async () => data }; }, { storage, contextWeek: { ...D.describeWeek(), label: "9 – 15 October 2026" } });
  assert.equal(h.get("date-label").textContent, "9–11 October 2026");
  assert.equal(h.get("activity-start").value, "2026-10-09"); assert.equal(h.get("activity-end").value, "2026-10-11");
  for (const event of ["focus", "pageshow", "visibilitychange"]) await h.lifecycle(event, { persisted: false });
  assert.equal(h.requests.length, 0); assert.deepEqual(writes, []);
  await h.click("find"); assert.equal(counts(h), 1); assert.equal(storage.getItem(D.key), null); assert.deepEqual(writes, []);
  assert.deepEqual(JSON.parse(h.requests[0].options.body), { startDate: "2026-10-09", endDate: "2026-10-11", teamIds: [], teamMode: "prefer" });
  await h.input("activity-end", "2026-10-15"); await h.click("reset-dates");
  assert.equal(h.get("activity-end").value, "2026-10-11"); assert.equal(h.get("date-label").textContent, "9–11 October 2026");
  assert.equal(h.requests.length, 1); assert.equal(storage.getItem(D.key), null); assert.equal(counts(h), 0);
});
test("denied date storage fails closed, invalid edit retains no earlier result, reset cannot claim recovery", async () => {
  const storage = { getItem() { throw Error("denied"); }, setItem() { throw Error("denied"); }, removeItem() { throw Error("denied"); } };
  const h = harness(undefined, { storage }); assert.equal(h.get("find").disabled, true);
  await h.input("activity-start", "2026-10-09"); await h.input("activity-end", "2026-10-15"); await h.click("find"); await h.click("reset-dates");
  assert.equal(h.requests.length, 0); assert.equal(h.get("find").disabled, true); assert.equal(h.get("date-label").textContent, "Choose dates");
});
test("late team response decoding and direct date/reset edits cannot resurrect old data or selected games", async () => {
  for (const action of [h => h.click("show-all-teams"), h => h.click("surprise"), h => h.input("activity-end", "2026-09-25"), h => h.click("reset-dates")]) {
    let decode, decoding; const ready = new Promise(resolve => { decoding = resolve; });
    const h = harness(async () => ({ ok: true, json: () => new Promise(resolve => { decode = resolve; decoding(); }) }));
    const pending = h.click("find"); await ready;
    await action(h); decode(response()); await pending; assert.equal(counts(h), 0); assert.equal(h.requests.length, 1); assert.equal(h.requests[0].options.signal.aborted, true);
  }
});
test("16-team limit is explicit and unadded input never leaks to request or persistent dates", async () => {
  const h = harness();
  await h.category("sports"); await h.sport("basketball");
  for (let i = 0; i < 16; i++) await h.addTeam(`Synthetic ${i}`);
  await h.addTeam("Synthetic 16"); assert.equal(h.get("preferred-teams").children.length, 16); assert.match(h.get("team-status").textContent, /up to 16/); assert.equal(h.focus.id, "team-name");
  await h.input("team-name", "<img onerror=evil>"); await h.click("find");
  assert.equal(h.requests.length, 0); assert.match(h.get("team-status").textContent, /Add.*clear/);
  await h.input("team-name", ""); await h.click("find");
  assert.equal(JSON.parse(h.requests[0].options.body).teamIds.length, 16); assert.doesNotMatch(h.requests[0].options.body, /onerror|ages|budget/);
  assert.doesNotMatch(h.storage.getItem(D.key), /team|onerror/);
  await h.removeTeam(5); await h.addTeam("Synthetic 16"); assert.equal(h.get("preferred-teams").children.length, 16); assert.equal(h.get("team-status").textContent, ""); assert.equal(h.requests.length, 1);
});