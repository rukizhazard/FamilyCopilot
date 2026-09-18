const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { runInNewContext } = require("node:vm");
const { activities, filterActivities, safeHttpUrl, escapeHtml, providers, validateChoices, canConfirmImport,
  calendarCommitment, resetState, transition, authorizedChoices, disclosedEvents, availabilityMessage,
  scheduleContext, renderWeekendHtml, providerCardsHtml, consentHtml, resetSubjects, validateSubjectName,
  subjectTransition, subjectAuthorizedChoices, subjectDisclosedEvents, subjectScheduleContext, subjectStatus,
  subjectListHtml, subjectSettingsHtml, focusAfterSubjectDelete, subjectPalette, subjectColor, subjectInitials,
  resetInvitation, validateInvitationEmail, invitationTransition, invitationReviewHtml } = require("../app.js");

function act(state, provider, type, extra={}) { return transition(state, { provider, type, ...extra }); }
function edit(state, provider, field, value) { return act(state, provider, "edit", { id:providers[provider].calendar, field, value }); }
function choose(state, provider, disclosure="busy") {
  state = act(state, provider, "begin");
  state = act(state, provider, "grant");
  state = edit(state, provider, "selected", true);
  state = edit(state, provider, "person", providers[provider].person);
  state = edit(state, provider, "disclosure", disclosure);
  if (providers[provider].child) state = edit(state, provider, "guardian", true);
  return state;
}
function confirm(state, provider) {
  state = act(state, provider, "review");
  return act(state, provider, "confirm", { summaryId:state.providers[provider].summary?.id });
}
function connected(provider="outlook", disclosure="details", state=resetState()) {
  return confirm(choose(state, provider, disclosure), provider);
}

test("supported sample filters narrow local fixtures", () => {
  assert.deepEqual(filterActivities(activities, { age:"7-10", interest:"science", date:"2026-06-20", budget:"low" }).map(x => x.id), ["science"]);
  assert.equal(filterActivities(activities, { age:"9-13", interest:"science", date:"all", budget:"all" }).length, 0);
});
test("only http and https URLs are eligible for display as links", () => {
  assert.equal(safeHttpUrl("javascript:alert(1)"), null);
  assert.equal(safeHttpUrl("data:text/html,nope"), null);
  assert.equal(safeHttpUrl("https://mock.example.test/night-lab"), "https://mock.example.test/night-lab");
});
test("pasted URL text is safely escaped before rendering", () => {
  assert.equal(escapeHtml('<img src=x onerror=alert(1)>'), "&lt;img src=x onerror=alert(1)&gt;");
});
test("simulated permission cannot be granted before explanation, and denial/cancel import nothing", () => {
  for (const provider of Object.keys(providers)) {
    const initial = resetState();
    assert.equal(act(initial, provider, "grant"), initial);
    const pending = act(initial, provider, "begin");
    assert.equal(pending.providers[provider].status, "pending");
    assert.equal(pending.providers[provider].permission, false);
    assert.match(consentHtml(pending, provider), /not OAuth or real authorization/);
    for (const action of ["deny", "cancel"]) {
      const stopped = act(pending, provider, action);
      assert.equal(stopped.providers[provider].status, "disconnected");
      assert.deepEqual(disclosedEvents(stopped), []);
    }
    const granted = act(pending, provider, "grant");
    assert.equal(granted.providers[provider].permission, true);
    assert.equal(granted.providers[provider].choices[0].selected, false);
    assert.equal(granted.providers[provider].choices[0].disclosure, "busy");
    assert.equal(granted.providers[provider].choices[0].person, "");
    assert.deepEqual(disclosedEvents(granted), []);
    assert.deepEqual(disclosedEvents(act(granted, provider, "cancel")), []);
  }
});
test("validation rejects missing choice, wrong calendar/person, invalid disclosure and missing child authority", () => {
  const valid = choose(resetState(), "google").providers.google.choices;
  assert.deepEqual(validateChoices("google", valid), []);
  for (const [field, value] of [["id","alex"], ["selected",false], ["selected","true"], ["person",""], ["person","Alex (fictional adult)"], ["person","Real name"], ["disclosure","public"], ["guardian",false], ["guardian","true"]]) {
    assert.ok(validateChoices("google", [{ ...valid[0], [field]:value }]).length, field);
  }
  for (const choices of [[], null, [valid[0], valid[0]]]) assert.ok(validateChoices("google", choices).length);
  assert.deepEqual(validateChoices("outlook", choose(resetState(), "outlook").providers.outlook.choices), []);
  const unlabelled = edit(choose(resetState(), "google"), "google", "person", "");
  assert.equal(act(unlabelled, "google", "review"), unlabelled);
  assert.equal(act(unlabelled, "google", "confirm", { summaryId:"invented" }), unlabelled);
});
test("review is a snapshot, imports nothing, and only its explicit valid confirmation imports", () => {
  const chosen = choose(resetState(), "outlook", "details");
  assert.equal(act(chosen, "outlook", "confirm"), chosen);
  const reviewed = act(chosen, "outlook", "review"), summary = reviewed.providers.outlook.summary;
  assert.match(summary.account, /example\.test$/);
  assert.match(summary.range, /20–21 June 2026/);
  assert.match(summary.audience, /Current demo viewer only/);
  assert.match(summary.retention, /Session memory only/);
  assert.notEqual(summary.choices, reviewed.providers.outlook.choices);
  assert.deepEqual(disclosedEvents(reviewed), []);
  assert.doesNotMatch(consentHtml(reviewed, "outlook"), /Garden planning/);
  assert.equal(canConfirmImport(reviewed, "outlook", "wrong"), false);
  assert.equal(canConfirmImport(reviewed, "outlook", summary.id), true);
  const loaded = act(reviewed, "outlook", "confirm", { summaryId:summary.id });
  assert.equal(loaded.providers.outlook.status, "connected");
  assert.match(disclosedEvents(loaded)[0].text, /Garden planning/);
  assert.equal(act(loaded, "outlook", "confirm", { summaryId:summary.id }), loaded);
});
test("back, cancel, edits and reset invalidate stale reviewed confirmations", () => {
  const reviewed = act(choose(resetState(), "google", "details"), "google", "review");
  const id = reviewed.providers.google.summary.id;
  const variants = [act(reviewed, "google", "back"), act(reviewed, "google", "cancel"),
    edit(reviewed, "google", "disclosure", "busy"), transition(reviewed, { type:"reset" })];
  for (const state of variants) {
    assert.equal(canConfirmImport(state, "google", id), false);
    assert.equal(act(state, "google", "confirm", { summaryId:id }), state);
    assert.deepEqual(disclosedEvents(state), []);
  }
  const rereviewed = act(variants[0], "google", "review");
  assert.notEqual(rereviewed.providers.google.summary.id, id);
  const afterReset = act(choose(variants[3], "google", "details"), "google", "review");
  assert.notEqual(afterReset.providers.google.summary.id, id);
  assert.equal(act(afterReset, "google", "confirm", { summaryId:id }), afterReset);
});
test("each provider connects independently without selecting or dropping the counterpart", () => {
  const initial = resetState();
  const outlook = connected("outlook");
  assert.deepEqual(outlook.providers.google, initial.providers.google);
  const both = connected("google", "busy", outlook);
  assert.deepEqual(both.providers.outlook, outlook.providers.outlook);
  assert.deepEqual(authorizedChoices(both).map(x => x.id), ["alex", "sam"]);
  assert.equal(disclosedEvents(both).find(e => e.calendar === "sam").text, "Unavailable — busy-only block");
  const google = connected("google");
  assert.deepEqual(google.providers.outlook, initial.providers.outlook);
  const deniedOutlook = act(act(google, "outlook", "begin"), "outlook", "deny");
  assert.deepEqual(deniedOutlook.providers.google, google.providers.google);
});
test("a provider change does not invalidate the other provider's reviewed confirmation", () => {
  const reviewed = act(choose(resetState(), "outlook"), "outlook", "review");
  const id = reviewed.providers.outlook.summary.id;
  const google = connected("google", "busy", reviewed);
  assert.equal(canConfirmImport(google, "outlook", id), true);
  assert.equal(authorizedChoices(act(google, "outlook", "confirm", { summaryId:id })).length, 2);
});
test("privacy edits, deselection, represented-person changes and authority removal fail closed even after cancel", () => {
  const both = connected("google", "details", connected("outlook"));
  for (const [field, value] of [["disclosure","busy"], ["selected",false], ["person",""], ["guardian",false]]) {
    const changed = edit(act(both, "google", "manage"), "google", field, value);
    assert.equal(changed.providers.google.status, "pending");
    assert.deepEqual(changed.providers.google.confirmed, []);
    assert.deepEqual(changed.providers.outlook, both.providers.outlook);
    assert.deepEqual(disclosedEvents(changed).map(e => e.calendar), ["alex"]);
    assert.doesNotMatch(providerCardsHtml(changed), /Music lesson/);
    const cancelled = act(changed, "google", "cancel");
    assert.deepEqual(disclosedEvents(cancelled).map(e => e.calendar), ["alex"]);
    assert.deepEqual(scheduleContext(transition(cancelled, { type:"scenario", value:"ready" })).checked, ["alex"]);
  }
  const downgraded = confirm(edit(act(both, "google", "manage"), "google", "disclosure", "busy"), "google");
  assert.equal(disclosedEvents(downgraded).find(e => e.calendar === "sam").text, "Unavailable — busy-only block");
  const upgraded = edit(act(downgraded, "google", "manage"), "google", "disclosure", "details");
  assert.doesNotMatch(JSON.stringify(disclosedEvents(upgraded)), /Music lesson/);
  assert.match(JSON.stringify(disclosedEvents(confirm(upgraded, "google"))), /Music lesson/);
});
test("opening management without editing preserves confirmed access; cancellation cannot import drafts", () => {
  const initial = connected();
  const managed = act(initial, "outlook", "manage");
  assert.deepEqual(disclosedEvents(managed), disclosedEvents(initial));
  assert.deepEqual(disclosedEvents(act(managed, "outlook", "cancel")), disclosedEvents(initial));
});
test("pause, disconnect and deletion remove only affected authorization and reject stale confirmation", () => {
  const both = connected("google", "details", connected("outlook"));
  for (const type of ["pause", "disconnect", "delete"]) {
    const reviewed = act(act(both, "google", "manage"), "google", "review");
    const removed = act(reviewed, "google", type);
    assert.deepEqual(removed.providers.google.confirmed, []);
    assert.equal(removed.providers.google.choices[0].selected, false);
    assert.equal(removed.providers.google.status, type === "pause" ? "paused" : "disconnected");
    assert.deepEqual(removed.providers.outlook, both.providers.outlook);
    assert.equal(canConfirmImport(removed, "google", reviewed.providers.google.summary.id), false);
    const ready = transition(removed, { type:"scenario", value:"ready" });
    assert.deepEqual(scheduleContext(ready).checked, ["alex"]);
    const reopened = act(removed, "google", "manage");
    assert.equal(reopened.providers.google.step, type === "pause" ? "picker" : "explain");
    assert.deepEqual(disclosedEvents(reopened).map(e => e.calendar), ["alex"]);
  }
});
test("revocation and reset clear both providers and cannot be reversed by the scenario selector", () => {
  const both = connected("google", "details", connected("outlook"));
  for (const action of [{ type:"reset" }, { type:"scenario", value:"revoked" }]) {
    const cleared = transition(both, action);
    for (const c of Object.values(cleared.providers)) {
      assert.equal(c.permission, false);
      assert.deepEqual(c.confirmed, []);
      assert.equal(c.choices[0].selected, false);
      assert.equal(c.choices[0].disclosure, "busy");
    }
    for (const value of ["ready", "partial", "conflict"]) assert.deepEqual(scheduleContext(transition(cleared, { type:"scenario", value })).events, []);
  }
});
test("disclosure redacts sample event details until confirmed; private fixtures always stay busy-only", () => {
  assert.equal(calendarCommitment("busy", true, "Private sample title"), "Unavailable — busy-only block");
  assert.equal(calendarCommitment("details", false, "Private sample title"), "Unavailable — busy-only block");
  assert.match(calendarCommitment("details", true, "Sample title", "Alex"), /Alex: Sample title/);
  assert.equal(calendarCommitment("details", true, "Private sample title", "Alex", true), "Unavailable — busy-only block");
  const conflict = transition(connected(), { type:"scenario", value:"conflict" });
  assert.equal(disclosedEvents(conflict)[1].text, "Unavailable — busy-only block");
  assert.doesNotMatch(JSON.stringify(disclosedEvents(conflict)), /Private sample appointment/);
  assert.doesNotMatch(renderWeekendHtml(conflict) + providerCardsHtml(conflict), /Private sample appointment/);
  const busy = connected("outlook", "busy");
  assert.doesNotMatch(JSON.stringify(disclosedEvents(busy)), /Garden planning/);
});
test("availability never converts missing or stale calendars into free time", () => {
  assert.match(availabilityMessage("partial"), /Cannot verify availability/);
  assert.match(availabilityMessage("stale"), /Cannot verify availability/);
  assert.match(availabilityMessage("ready", ["alex"]), /Alex Outlook.*Sat 20 June 09:00–17:00 EDT/);
  assert.match(availabilityMessage("ready", ["alex"]), /Missing or not checked: Sam Google/);
  assert.match(availabilityMessage("ready"), /Checked calendars: none; no time range checked/);
});
test("Sam-only context has no Alex commitment or claim that Alex was checked, including conflict", () => {
  for (const value of ["ready", "conflict"]) {
    const state = transition(connected("google"), { type:"scenario", value });
    const context = scheduleContext(state);
    assert.deepEqual(context.checked, ["sam"]);
    assert.match(context.message, /Checked calendars: Sam Google, Sat/);
    assert.match(context.message, /Missing or not checked: Alex Outlook/);
    assert.match(context.message, /Cannot verify availability/);
    assert.doesNotMatch(context.message, /Possible conflict: Alex/);
    assert.deepEqual(context.events.map(e => e.calendar), ["sam"]);
    assert.doesNotMatch(renderWeekendHtml(state), /Garden planning|Alex \(fictional adult\)|10:00–11:00/);
    assert.match(renderWeekendHtml(state), /Sam \(fictional child\): Music lesson/);
  }
});
test("all demo scenarios respect confirmed access and explicit partial or unavailable context", () => {
  const scenarios = ["ready","loading","empty","no-calendar","partial","stale","conflict","revoked","unavailable","unsupported"];
  for (const value of scenarios) {
    const unauthorized = transition(choose(resetState(), "outlook", "details"), { type:"scenario", value });
    assert.deepEqual(scheduleContext(unauthorized).events, [], value);
    assert.doesNotMatch(renderWeekendHtml(unauthorized), /Garden planning|Music lesson/);
  }
  const both = connected("google", "details", connected());
  const partial = scheduleContext(transition(both, { type:"scenario", value:"partial" }));
  assert.deepEqual(partial.checked, ["alex"]);
  assert.deepEqual(partial.events.map(e => e.calendar), ["alex"]);
  assert.match(partial.message, /Missing or not checked: Sam Google/);
  const samPartial = scheduleContext(transition(connected("google"), { type:"scenario", value:"partial" }));
  assert.deepEqual(samPartial.checked, []);
  assert.match(samPartial.message, /Missing or not checked: Alex Outlook and Sam Google/);
  for (const value of ["loading","empty","no-calendar","stale","unavailable","unsupported"]) {
    const context = scheduleContext(transition(both, { type:"scenario", value }));
    assert.deepEqual(context.checked, []);
    assert.deepEqual(context.events, []);
    assert.match(context.message, /Cannot verify availability/);
  }
});
test("transitions do not mutate prior state or accept unknown actions and calendar IDs", () => {
  const before = choose(resetState(), "outlook"), snapshot = JSON.stringify(before);
  const reviewed = act(before, "outlook", "review");
  edit(reviewed, "outlook", "disclosure", "details");
  assert.equal(JSON.stringify(before), snapshot);
  assert.equal(act(before, "unknown", "begin"), before);
  assert.equal(act(before, "outlook", "unknown"), before);
  assert.equal(act(before, "outlook", "edit", { id:"sam", field:"selected", value:true }), before);
  assert.equal(transition(before, { type:"scenario", value:"bogus" }), before);
});
test("rendered draft labels are escaped and arbitrary labels can never authorize events", () => {
  const payload = '<img src=x onerror="alert(1)">';
  const state = edit(choose(resetState(), "outlook"), "outlook", "person", payload);
  assert.match(providerCardsHtml(state), /&lt;img/);
  assert.doesNotMatch(providerCardsHtml(state), /<img/);
  assert.deepEqual(disclosedEvents(confirm(state, "outlook")), []);
  assert.equal(escapeHtml('&<>"\''), "&amp;&lt;&gt;&quot;&#39;");
});

// Minimal DOM seam for handler regressions, not a substitute for native browser/focus testing.
function demoHarness() {
  const elements = new Map();
  let ready, focused;
  function element(id) {
    if (!elements.has(id)) elements.set(id, { id, value:"", innerHTML:"", textContent:"", open:false,
      replaceChildren() { this.innerHTML = ""; this.textContent = ""; },
      setAttribute(name, value) { this[name] = value; },
      reset() {}, focus() { focused = id; },
      showModal() { this.open = true; }, close() { this.open = false; } });
    return elements.get(id);
  }
  const document = {
    addEventListener(name, handler) { if (name === "DOMContentLoaded") ready = handler; },
    querySelector(selector) { return element(selector.slice(1)); },
    getElementById:element,
    querySelectorAll(selector) { return selector === "#reset,#footer-reset" ? [element("reset"), element("footer-reset")] : []; }
  };
  runInNewContext(readFileSync(require.resolve("../app.js"), "utf8"), { document, URL,
    FormData:class { *[Symbol.iterator]() { for (const name of ["age","interest","date","budget"]) yield [name, "all"]; } } });
  ready();
  const click = (id, dataset, buttonId="") => element(id).onclick({ target:{ closest:() => ({ dataset, id:buttonId }) } });
  const selectedProviders = new Set();
  const subjectId = provider => provider === "outlook" ? "subject-0-1" : "subject-0-2";
  const settings = id => click("subject-list", { subjectId:id, action:"settings" }, `settings-${id}`);
  const selectProvider = provider => element("consent-content").onchange({ target:{ id:"subject-provider", value:provider } });
  const manage = (provider, action="manage") => {
    const id = subjectId(provider);
    if (action === "delete") { click("subject-list", { subjectId:id, action }); return; }
    settings(id);
    if (!selectedProviders.has(provider)) { selectProvider(provider); selectedProviders.add(provider); }
    flow(action);
    if (["pause","disconnect"].includes(action)) element("close-settings").onclick();
  };
  const flow = action => click("consent-content", { action,
    summaryId:element("consent-content").innerHTML.match(/data-summary-id="([^"]+)"/)?.[1] });
  const change = (field, value) => element("consent-content").onchange({ target:{ dataset:{ field },
    type:typeof value === "boolean" ? "checkbox" : "select-one", checked:value, value } });
  const load = provider => {
    manage(provider); flow("grant"); change("selected", true);
    change("person", providers[provider].person); change("disclosure", "details");
    if (providers[provider].child) change("guardian", true);
    flow("review"); flow("confirm");
  };
  const assess = () => { element("event-url").value = activities[0].url; element("check-url").onclick(); };
  const add = name => { element("subject-name").value = name; element("add-subject").onsubmit({ preventDefault() {} }); };
  return { element, click, settings, selectProvider, add, manage, flow, change, load, assess, focused:() => focused };
}

test("DOM handlers gate review, close denied/cancelled flows and request focus return", () => {
  const h = demoHarness();
  h.manage("outlook");
  assert.equal(h.element("consent-dialog").open, true);
  h.flow("deny");
  assert.equal(h.element("consent-dialog").open, false);
  assert.equal(h.focused(), "settings-subject-0-1");
  assert.doesNotMatch(h.element("weekend-result").innerHTML, /Garden planning/);
  h.manage("google"); h.flow("grant"); h.flow("review");
  assert.match(h.element("consent-error").textContent, /Select at least one/);
  assert.match(h.element("consent-content").innerHTML, /Step 2/);
  h.change("selected", true); h.change("person", providers.google.person);
  h.flow("review");
  assert.match(h.element("consent-error").textContent, /guardian authority/);
  h.change("guardian", true); h.flow("review");
  assert.match(h.element("consent-content").innerHTML, /Step 3/);
  h.flow("back");
  assert.match(h.element("consent-content").innerHTML, /Step 2/);
  let prevented = false;
  h.element("consent-dialog").oncancel({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(h.element("consent-dialog").open, false);
  assert.equal(h.focused(), "settings-subject-0-2");
  assert.doesNotMatch(h.element("weekend-result").innerHTML, /Music lesson/);
  h.element("scenario").onchange({ target:{ value:"conflict" } });
  assert.doesNotMatch(h.element("weekend-result").innerHTML, /<h3>Commitments<\/h3>/);
});
test("Escape key cancels embedded consent without importing and restores opener focus", () => {
  const h = demoHarness();
  h.manage("outlook"); h.flow("grant");
  h.change("selected", true); h.change("person", providers.outlook.person);
  h.flow("review");
  let prevented = false;
  h.element("consent-dialog").onkeydown({ key:"Escape", preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(h.element("consent-dialog").open, false);
  assert.equal(h.focused(), "settings-subject-0-1");
  assert.doesNotMatch(h.element("weekend-result").innerHTML, /<h3>Commitments<\/h3>/);
});
test("DOM handlers remove stale event assessments on every consent-management path", () => {
  for (const action of ["pause", "disconnect", "delete", "edit", "reset", "revoked"]) {
    const h = demoHarness();
    h.load("outlook"); h.load("google"); h.assess();
    assert.match(h.element("event-result").innerHTML, /Checked calendars: Alex \(Demo source: Alex Outlook.*and Sam \(Demo source: Sam Google/);
    if (action === "edit") {
      h.manage("google");
      assert.equal(h.element("event-result").innerHTML, "");
      h.change("disclosure", "busy"); h.flow("cancel");
    } else if (action === "reset") h.element("reset").onclick();
    else if (action === "revoked") h.element("scenario").onchange({ target:{ value:"revoked" } });
    else h.manage("google", action);
    assert.equal(h.element("event-result").innerHTML, "", action);
    assert.doesNotMatch(h.element("weekend-result").innerHTML, /Music lesson/);
    if (!["reset", "revoked"].includes(action)) assert.match(h.element("weekend-result").innerHTML, /Garden planning/);
    else assert.doesNotMatch(h.element("weekend-result").innerHTML, /Garden planning/);
    h.element("scenario").onchange({ target:{ value:"ready" } }); h.assess();
    assert.match(h.element("event-result").innerHTML, /Cannot verify/);
    assert.doesNotMatch(h.element("event-result").innerHTML, /Checked calendars: Alex \(Demo source: Alex Outlook.*and Sam \(Demo source: Sam Google/);
  }
});
test("markup keeps the overview first and outside switchable journeys with no old global picker", () => {
  const html = readFileSync(require.resolve("../index.html"), "utf8");
  assert.match(html, /<main>\s*<section id="calendar-overview" class="card"/);
  assert.ok(html.indexOf('id="calendar-overview"') < html.indexOf('id="ask-title"'));
  assert.doesNotMatch(html, /id="settings"|id="disclosure"|id="authority"|data-management=/);
  assert.match(html, /<dialog id="consent-dialog" aria-labelledby="consent-title"/);
});

function subjectAct(state, id, type, extra={}) { return subjectTransition(state, { subjectId:id, type, ...extra }); }
function subjectChoose(state, id, provider="outlook", disclosure="details") {
  state = subjectAct(state, id, "select-provider", { provider });
  state = subjectAct(state, id, "manage");
  state = subjectAct(state, id, "grant");
  for (const [field, value] of [["selected",true], ["person",providers[provider].person], ["disclosure",disclosure], ["guardian",providers[provider].child]]) {
    state = subjectAct(state, id, "edit", { id:providers[provider].calendar, field, value });
  }
  return state;
}
function subjectReview(state, id) { return subjectAct(state, id, "review"); }
function subjectConfirm(state, id) {
  const reviewed = subjectReview(state, id), s = reviewed.subjects.find(s => s.id === id);
  return subjectAct(reviewed, id, "confirm", { summaryId:s.access.providers[s.provider].summary?.id });
}
function subjectConnected(state, id, provider="outlook", disclosure="details") {
  return subjectConfirm(subjectChoose(state, id, provider, disclosure), id);
}

test("sample names are trimmed, bounded and duplicate checked without treating labels as state keys", () => {
  const state = resetSubjects();
  for (const name of ["", " \n\t ", null, 2, "x".repeat(61), " alex ", "SAM"]) assert.ok(validateSubjectName(name, state.subjects));
  for (const name of ["x".repeat(60), "__proto__", "constructor", "<script>sample</script>", " Fictional Third "]) {
    assert.equal(validateSubjectName(name, state.subjects), "");
    const added = subjectTransition(state, { type:"add", name });
    assert.equal(added.subjects[2].name, name.trim());
    assert.equal(added.subjects[2].id, "subject-0-3");
    assert.equal(added.subjects[2].provider, null);
    assert.deepEqual(subjectAuthorizedChoices(added), []);
  }
  assert.equal(subjectTransition(state, { type:"add", name:"aLeX" }), state);
  assert.equal(subjectTransition(state, { type:"add", name:"  " }), state);
});
test("initial and empty subject lists have no grants and do not block discovery", () => {
  const state = resetSubjects();
  assert.deepEqual(state.subjects.map(s => [s.name, subjectStatus(s)]), [["Alex","Not configured"], ["Sam","Not configured"]]);
  const empty = state.subjects.reduce((current, s) => subjectAct(current, s.id, "delete"), state);
  assert.deepEqual(empty.subjects, []);
  assert.match(subjectListHtml(empty), /No names yet.*find an activity without calendars/);
  assert.match(subjectScheduleContext(empty).message, /Discovery still works; schedule compatibility was not checked/);
  assert.doesNotMatch(subjectScheduleContext(empty).message, /Alex|Sam|Missing or not checked:/);
  assert.equal(filterActivities(activities, { age:"all", interest:"all", date:"all", budget:"all" }).length, 3);
});
test("subject labels are escaped in list actions, settings, summaries and answers; fixtures remain explicit", () => {
  const payload = '<img src=x onerror="alert(1)">&\'';
  const added = subjectTransition(resetSubjects(), { type:"add", name:payload });
  const id = added.subjects[2].id;
  const reviewed = subjectReview(subjectChoose(added, id, "google"), id);
  const connected = subjectConfirm(reviewed, id);
  for (const html of [subjectListHtml(added), subjectSettingsHtml(added, id), subjectSettingsHtml(reviewed, id),
    subjectSettingsHtml(connected, id), renderWeekendHtml(connected)]) {
    assert.doesNotMatch(html, /<img/);
    assert.ok(html.includes(escapeHtml(payload)), html);
  }
  assert.match(subjectListHtml(added), /id="settings-subject-0-3"/);
  assert.match(subjectSettingsHtml(reviewed, id), /Demo source:.*Sam Google.*Sam \(fictional child\)/);
  assert.match(renderWeekendHtml(connected), /fictional identity, not this name's real calendar/);
  assert.equal(subjectDisclosedEvents(connected)[0].person, providers.google.person);
  assert.match(subjectSettingsHtml(subjectChoose(added, id, "google"), id), /guardian-authority/);
  assert.doesNotMatch(subjectSettingsHtml(subjectChoose(added, id, "outlook"), id), /id="guardian-authority"/);
});
test("two subjects using the same provider have independent grants, revisions and redacted results", () => {
  let state = resetSubjects();
  const [a, b] = state.subjects.map(s => s.id);
  state = subjectConnected(state, a);
  const first = state.subjects[0];
  state = subjectConnected(state, b, "outlook", "busy");
  assert.deepEqual(state.subjects[0], first);
  assert.deepEqual(subjectAuthorizedChoices(state).map(c => c.subjectId), [a,b]);
  assert.match(subjectDisclosedEvents(state)[0].text, /Garden planning/);
  assert.equal(subjectDisclosedEvents(state)[1].text, "Unavailable — busy-only block");
  const reviewed = subjectReview(subjectAct(state, a, "manage"), a);
  const summaryId = reviewed.subjects[0].access.providers.outlook.summary.id;
  const paused = subjectAct(reviewed, b, "pause");
  assert.equal(canConfirmImport(paused.subjects[0].access, "outlook", summaryId), true);
  assert.equal(subjectStatus(paused.subjects[1]), "Paused");
  assert.deepEqual(subjectDisclosedEvents(paused).map(e => e.subjectId), [a]);
  const partial = subjectTransition(state, { type:"scenario", value:"partial" });
  assert.deepEqual(subjectScheduleContext(partial).checked, [a,b]);
});
test("deleting configured subjects drops all their data, preserves others, and does not invent missing names", () => {
  let state = resetSubjects();
  const [a,b] = state.subjects.map(s => s.id);
  state = subjectConnected(subjectConnected(state, a), b, "google");
  const remaining = state.subjects[1];
  state = subjectAct(state, a, "delete");
  assert.deepEqual(state.subjects, [remaining]);
  assert.deepEqual(subjectDisclosedEvents(state).map(e => e.subjectId), [b]);
  assert.doesNotMatch(JSON.stringify(state), /Garden planning|subject-0-1/);
  assert.doesNotMatch(subjectScheduleContext(state).message, /Alex|Missing or not checked:/);
  assert.match(subjectScheduleContext(state).message, /Sam \(Demo source: Sam Google/);
});
test("delete and re-add of identical labels, source switches and reset fence stale summaries", () => {
  let state = resetSubjects();
  const id = state.subjects[0].id;
  state = subjectReview(subjectChoose(state, id), id);
  const summaryId = state.subjects[0].access.providers.outlook.summary.id;
  let readded = subjectTransition(subjectAct(state, id, "delete"), { type:"add", name:"Alex" });
  const newId = readded.subjects[1].id;
  assert.notEqual(newId, id);
  assert.equal(subjectAct(readded, id, "confirm", { summaryId }), readded);
  readded = subjectReview(subjectChoose(readded, newId), newId);
  assert.equal(subjectAct(readded, newId, "confirm", { summaryId }), readded);
  let switched = subjectAct(state, id, "select-provider", { provider:"google" });
  switched = subjectReview(subjectChoose(switched, id), id);
  assert.equal(subjectAct(switched, id, "confirm", { summaryId }), switched);
  const reset = subjectTransition(state, { type:"reset" });
  assert.notEqual(reset.subjects[0].id, id);
  const resetReviewed = subjectReview(subjectChoose(reset, reset.subjects[0].id), reset.subjects[0].id);
  assert.equal(subjectAct(resetReviewed, reset.subjects[0].id, "confirm", { summaryId }), resetReviewed);
  assert.deepEqual(subjectDisclosedEvents(resetReviewed), []);
});
test("subject consent cannot be borrowed or bypassed, including arbitrary provider action fields", () => {
  let state = resetSubjects();
  const [a,b] = state.subjects.map(s => s.id);
  assert.equal(subjectAct(state, a, "grant"), state);
  state = subjectAct(state, a, "select-provider", { provider:"google" });
  assert.equal(subjectAct(state, a, "grant"), state);
  state = subjectChoose(state, a, "google");
  state = subjectAct(state, a, "edit", { id:"sam", field:"guardian", value:false });
  assert.equal(subjectReview(state, a), state);
  state = subjectReview(subjectChoose(state, a, "google"), a);
  const summaryId = state.subjects[0].access.providers.google.summary.id;
  const reviewedB = subjectReview(subjectChoose(state, b, "google"), b);
  assert.equal(subjectAct(reviewedB, b, "confirm", { summaryId }), reviewedB);
  const confirmed = subjectAct(reviewedB, a, "confirm", { provider:"outlook", summaryId });
  assert.deepEqual(subjectAuthorizedChoices(confirmed).map(c => [c.subjectId,c.provider]), [[a,"google"]]);
  assert.deepEqual(confirmed.subjects[0].access.providers.outlook.confirmed, []);
});
test("subject cancel, edits, pause, disconnect and provider switches fail closed without affecting peers", () => {
  let state = resetSubjects();
  const [a,b] = state.subjects.map(s => s.id);
  state = subjectConnected(subjectConnected(state, a), b, "google");
  const other = state.subjects[1];
  const managed = subjectAct(state, a, "manage");
  assert.deepEqual(subjectDisclosedEvents(subjectAct(managed, a, "cancel")), subjectDisclosedEvents(state));
  for (const [type, extra] of [["edit", { id:"alex", field:"disclosure", value:"busy" }],
    ["edit", { id:"alex", field:"selected", value:false }], ["pause",{}], ["disconnect",{}], ["select-provider",{ provider:"google" }]]) {
    const changed = subjectAct(managed, a, type, extra);
    const cancelled = subjectAct(changed, a, "cancel");
    assert.deepEqual(cancelled.subjects[1], other);
    assert.deepEqual(subjectDisclosedEvents(cancelled).map(e => e.subjectId), [b]);
    assert.doesNotMatch(subjectSettingsHtml(cancelled, a), /Garden planning/);
    assert.match(subjectScheduleContext(cancelled).message, /Missing or not checked: Alex/);
  }
});
test("global scenarios survive subject confirmations; revocation and reset cannot restore grants", () => {
  const initial = resetSubjects(), [a,b] = initial.subjects.map(s => s.id);
  for (const scenario of ["ready","partial","conflict","loading","empty","no-calendar","stale","revoked","unavailable","unsupported"]) {
    const state = subjectTransition(subjectConnected(initial, b, "google"), { type:"scenario", value:scenario });
    const confirmed = subjectConnected(state, a);
    assert.equal(confirmed.scenario, scenario);
    const context = subjectScheduleContext(confirmed);
    if (!["ready","partial","conflict"].includes(scenario)) assert.deepEqual(context.events, []);
    if (scenario === "partial") assert.deepEqual(context.checked, [a]);
    assert.match(context.message, /Cannot verify/);
  }
  const both = subjectConnected(subjectConnected(initial, a), b, "google");
  for (const action of [{ type:"reset" }, { type:"scenario", value:"revoked" }]) {
    const cleared = subjectTransition(both, action);
    assert.deepEqual(cleared.subjects.map(s => s.name), ["Alex","Sam"]);
    for (const subject of cleared.subjects) for (const c of Object.values(subject.access.providers)) {
      assert.equal(c.permission, false); assert.deepEqual(c.confirmed, []); assert.equal(c.summary, null);
    }
    assert.deepEqual(subjectDisclosedEvents(subjectTransition(cleared, { type:"scenario", value:"ready" })), []);
  }
});
test("subject transitions are immutable and ignore nonexistent IDs, fields and providers", () => {
  const state = resetSubjects(), snapshot = JSON.stringify(state), id = state.subjects[0].id;
  subjectConnected(state, id);
  assert.equal(JSON.stringify(state), snapshot);
  for (const action of [{ type:"delete", subjectId:"Alex" }, { type:"select-provider", subjectId:id, provider:"__proto__" },
    { type:"scenario", value:"bogus" }, { type:"unknown", subjectId:id }]) assert.equal(subjectTransition(state, action), state);
});
test("front list contains only names, short statuses and icon actions; technical controls start closed", () => {
  const state = subjectConnected(resetSubjects(), "subject-0-1");
  const list = subjectListHtml(state), html = readFileSync(require.resolve("../index.html"), "utf8");
  assert.match(list, /Ready/); assert.match(list, /Not configured/);
  assert.equal((list.match(/<button /g) || []).length, 4);
  assert.doesNotMatch(list, /Outlook|Google|example\.test|disclosure|freshness|preview|Connect|Pause|Disconnect|<select/);
  assert.match(html, /<details class="demo-controls card">/);
  assert.doesNotMatch(html, /<dialog[^>]*\bopen\b|<details[^>]*\bopen\b/);
  assert.match(html, /id="subject-name" maxlength="60" required/);
  assert.match(html, /id="close-settings">Close/);
});
test("DOM Settings alone opens details; adding, cancelling, invalid names and deletion have focus seams", () => {
  const h = demoHarness();
  assert.equal(h.element("consent-dialog").open, false);
  assert.equal(h.element("consent-content").innerHTML, "");
  h.add(" alex ");
  assert.match(h.element("name-error").textContent, /already exists/);
  assert.equal(h.focused(), "subject-name");
  h.add("  Example Third  ");
  assert.match(h.element("subject-list").innerHTML, /Example Third/);
  assert.equal(h.element("consent-dialog").open, false);
  h.settings("subject-0-3");
  assert.equal(h.element("consent-title").textContent, "Calendar settings for Example Third");
  assert.match(h.element("consent-content").innerHTML, /Choose a provider/);
  assert.equal(h.focused(), "consent-title");
  h.selectProvider("google");
  assert.equal(h.focused(), "subject-provider");
  h.flow("begin"); h.flow("grant"); h.change("selected", true);
  assert.equal(h.focused(), "choose-calendar");
  h.element("close-settings").onclick();
  assert.equal(h.element("consent-dialog").open, false);
  assert.equal(h.focused(), "settings-subject-0-3");
  assert.doesNotMatch(h.element("weekend-result").innerHTML, /Music lesson/);
  h.click("subject-list", { action:"delete", subjectId:"subject-0-3" });
  assert.equal(h.focused(), "settings-subject-0-2");
  h.click("subject-list", { action:"delete", subjectId:"subject-0-1" });
  assert.equal(h.focused(), "settings-subject-0-2");
  h.click("subject-list", { action:"delete", subjectId:"subject-0-2" });
  assert.equal(h.focused(), "add-calendar");
  assert.match(h.element("subject-list").innerHTML, /No names yet/);
  assert.match(h.element("activity-results").innerHTML, /Night Lab/);
  assert.doesNotMatch(h.element("weekend-result").innerHTML, /Alex|Sam \(/);
});
test("DOM arbitrary new labels can configure same-provider fixtures; deletion clears derived assessments", () => {
  const h = demoHarness(), payload = '<img src=x onerror="x">';
  h.load("google"); h.add(payload); h.settings("subject-0-3");
  assert.equal(h.element("consent-title").textContent, `Calendar settings for ${payload}`);
  h.selectProvider("google"); h.flow("begin"); h.flow("grant");
  h.change("selected", true); h.change("person", providers.google.person); h.change("guardian", true);
  h.flow("review"); h.flow("confirm");
  assert.equal(h.element("management-status").textContent, `${payload}: ready. Open Settings to inspect or change access.`);
  assert.match(h.element("subject-list").innerHTML, /&lt;img/);
  h.assess(); assert.match(h.element("event-result").innerHTML, /&lt;img/);
  assert.doesNotMatch(h.element("event-result").innerHTML, /<img/);
  h.click("subject-list", { action:"delete", subjectId:"subject-0-3" });
  assert.equal(h.element("event-result").innerHTML, "");
  assert.doesNotMatch(h.element("weekend-result").innerHTML, /&lt;img/);
  assert.match(h.element("weekend-result").innerHTML, /Music lesson/);
});
test("DOM stale dialog events after deletion, revocation and reset do not resurrect data", () => {
  for (const action of ["delete","revoked","reset"]) {
    const h = demoHarness();
    h.manage("outlook"); h.flow("grant"); h.change("selected", true); h.change("person", providers.outlook.person);
    h.flow("review");
    const summaryId = h.element("consent-content").innerHTML.match(/data-summary-id="([^"]+)"/)[1];
    if (action === "delete") { h.click("subject-list", { action:"delete", subjectId:"subject-0-1" }); h.add("Alex"); }
    else if (action === "reset") h.element("reset").onclick();
    else h.element("scenario").onchange({ target:{ value:"revoked" } });
    h.click("consent-content", { action:"confirm", summaryId });
    assert.doesNotMatch(h.element("weekend-result").innerHTML, /<h3>Commitments<\/h3>/);
    if (action !== "revoked") assert.equal(h.element("consent-content").innerHTML, "");
  }
  const state = resetSubjects();
  assert.equal(focusAfterSubjectDelete(state, state.subjects[0].id), "settings-subject-0-2");
  assert.equal(focusAfterSubjectDelete({ ...state, subjects:[state.subjects[0]] }, state.subjects[0].id), "add-calendar");
});

test("six creation-order colors are distinct, stable through lifecycle changes, and cycle without recoloring peers", () => {
  let state = resetSubjects();
  for (let n = 3; n <= subjectPalette.length; n++) state = subjectTransition(state, { type:"add", name:`Alias ${n}` });
  assert.equal(subjectPalette.length, 6);
  assert.ok(Object.isFrozen(subjectPalette));
  assert.deepEqual(state.subjects.map(subjectColor), [...subjectPalette]);
  const colors = new Map(state.subjects.map(s => [s.id, subjectColor(s)]));
  const first = state.subjects[0].id, second = state.subjects[1].id;
  state = subjectConnected(state, second, "google");
  for (const type of ["manage", "cancel", "pause", "disconnect"]) {
    state = subjectAct(state, second, type);
    for (const s of state.subjects) assert.equal(subjectColor(s), colors.get(s.id));
  }
  state = subjectAct(state, second, "select-provider", { provider:"outlook" });
  state = subjectAct(state, first, "delete");
  state = subjectTransition(state, { type:"add", name:"Alex" });
  const readded = state.subjects.at(-1);
  assert.notEqual(readded.id, first);
  assert.equal(subjectColor(readded), subjectPalette[0]);
  assert.deepEqual(authorizedChoices(readded.access), []);
  for (const s of state.subjects.slice(0, -1)) assert.equal(subjectColor(s), colors.get(s.id));
  const revoked = subjectTransition(state, { type:"scenario", value:"revoked" });
  assert.deepEqual(revoked.subjects.map(subjectColor), state.subjects.map(subjectColor));
  assert.deepEqual(subjectTransition(state, { type:"reset" }).subjects.map(subjectColor), subjectPalette.slice(0, 2));
});

test("color inputs cannot inject styles or change consent, and names do not determine themes", () => {
  const initial = resetSubjects(), subject = initial.subjects[0];
  for (const colorIndex of ['\" style="background:url(https://example.test)', "rose", -1, NaN, Infinity, 1.5, null]) {
    const modified = { ...initial, subjects:[{ ...subject, colorIndex }] };
    assert.equal(subjectColor(modified.subjects[0]), "ocean");
    assert.doesNotMatch(subjectListHtml(modified), /style=|url\(|https:/);
    assert.deepEqual(subjectAuthorizedChoices(modified), []);
  }
  const a = subjectTransition(initial, { type:"add", name:"Any alias" });
  const b = subjectTransition(initial, { type:"add", name:"An entirely different alias" });
  assert.equal(subjectColor(a.subjects[2]), subjectColor(b.subjects[2]));
});

test("icon-only controls keep dynamic accessible names and tooltips; initials and names are escaped", () => {
  assert.equal(subjectInitials("  Alex  North  "), "AN");
  assert.equal(subjectInitials("Sam"), "S");
  assert.equal(subjectInitials("🪁 Sky"), "🪁S");
  assert.equal(subjectInitials(""), "");
  const payload = '<img src=x onerror="x"> &\'';
  const state = subjectTransition(resetSubjects(), { type:"add", name:payload });
  const html = subjectListHtml(state), escaped = escapeHtml(payload);
  for (const label of [`Calendar settings for ${escaped}`, `Remove ${escaped}`]) {
    assert.ok(html.includes(`aria-label="${label}"`));
    assert.ok(html.includes(`title="${label}"`));
  }
  assert.ok(html.includes(`aria-hidden="true">${escapeHtml(subjectInitials(payload))}</span>`));
  assert.doesNotMatch(html, /<img|<script|style=/);
  const controls = [...html.matchAll(/<button\b[^>]*>(.*?)<\/button>/gs)];
  assert.equal(controls.length, 6);
  assert.deepEqual(controls.map(m => m[1]), Array(3).fill(['<span aria-hidden="true">⋯</span>', '<span aria-hidden="true">−</span>']).flat());
  const markup = readFileSync(require.resolve("../index.html"), "utf8");
  assert.match(markup, /id="add-calendar"[^>]*type="button"[^>]*aria-label="Invite an adult" title="Invite an adult"[^>]*><span aria-hidden="true">\+<\/span>/);
  assert.match(markup, /<label for="subject-name">Fictional alias \(demo calendars only\)<\/label>/);
  const long = subjectTransition(resetSubjects(), { type:"add", name:"x".repeat(60) });
  assert.ok(subjectListHtml(long).includes(`<strong>${"x".repeat(60)}</strong>`));
});

test("fixed palette has readable contrast and compact 44px layout/focus rules", () => {
  const css = readFileSync(require.resolve("../styles.css"), "utf8");
  function luminance(hex) {
    const rgb = hex.match(/\w\w/g).map(x => parseInt(x, 16) / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4);
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  }
  const themes = [...css.matchAll(/\.subject-color-(\w+) \{ --subject-ink:#([a-f\d]{6}); --subject-tint:#([a-f\d]{6}); \}/g)];
  assert.deepEqual(themes.map(m => m[1]), [...subjectPalette]);
  for (const [,name,ink,tint] of themes) {
    assert.ok(1.05 / (luminance(ink) + .05) >= 4.5, `${name}: white initials`);
    assert.ok((luminance(tint) + .05) / (luminance(ink) + .05) >= 4.5, `${name}: ink on tint`);
    assert.ok((luminance(tint) + .05) / (luminance("52657c") + .05) >= 4.5, `${name}: text status`);
  }
  assert.match(css, /\.icon-button \{[^}]*min-width:44px; height:44px/);
  assert.match(css, /\.subject-row \{[^}]*grid-template-columns:36px minmax\(0,1fr\) auto/);
  assert.match(css, /\.subject-actions \{[^}]*flex-wrap:nowrap/);
  assert.match(css, /\.subject-label \{[^}]*overflow-wrap:anywhere/);
  assert.match(css, /\.add-subject \.input-row \{ flex-wrap:nowrap/);
  assert.match(css, /button:focus-visible[^}]*outline:3px solid var\(--focus\)/);
});

test("routine copy is concise while consent and global boundaries stay explicit", () => {
  const html = readFileSync(require.resolve("../index.html"), "utf8");
  assert.equal((html.match(/aria-label="Demo notice"/g) || []).length, 1);
  assert.match(html, /Interactive demo<\/strong> · No real calendars connected\. Data is fictional and stays in this tab\. Do not enter personal information\./);
  assert.match(html, /About this prototype/);
  assert.match(html, /No real permission is requested and no real calendar is connected/);
  assert.match(html, /Family Copilot · Prototype/);
  const copy = html.replace(/<[^>]*>/g, " ");
  assert.doesNotMatch(copy, /sample|mock|fixture|synthetic|deterministic/i);
  for (const provider of Object.keys(providers)) {
    const begun = act(resetState(), provider, "begin");
    const picked = choose(resetState(), provider);
    const reviewed = act(picked, provider, "review");
    const surfaces = [consentHtml(begun, provider), consentHtml(picked, provider), consentHtml(reviewed, provider),
      providerCardsHtml(connected(provider), provider), subjectSettingsHtml(resetSubjects(), "subject-0-1")];
    for (const surface of surfaces) assert.doesNotMatch(surface, /sample|mock|fixture|synthetic|deterministic/i);
    assert.match(consentHtml(begun, provider), /Grant permission in demo/);
    assert.match(consentHtml(begun, provider), /No real permission is requested/);
    assert.match(consentHtml(begun, provider), /Personal\/work details must not be shared with another parent/);
    assert.match(consentHtml(reviewed, provider), /Confirm in demo/);
    assert.match(consentHtml(reviewed, provider), /Import range:|Audience:|Retention:/);
    assert.deepEqual(disclosedEvents(reviewed), []);
    assert.match(providerCardsHtml(resetState(), provider), />Continue in demo<\/button>/);
  }
  for (const name of ["", "Alex", "x".repeat(61)]) assert.doesNotMatch(validateSubjectName(name, resetSubjects().subjects), /sample|mock|fixture|synthetic|deterministic/i);
});

test("activity and assessment copy retain fictional evidence, unknown travel/tickets and missing context", () => {
  const h = demoHarness();
  const activitiesHtml = h.element("activity-results").innerHTML;
  assert.match(activitiesHtml, /Fictional event/);
  assert.match(activitiesHtml, /Demo source: Science Hall listing/);
  assert.match(activitiesHtml, /Invented facts; no live venue page exists/);
  h.assess();
  const eventHtml = h.element("event-result").innerHTML;
  assert.match(eventHtml, /Event facts — fictional, not fetched/);
  for (const surface of [activitiesHtml, eventHtml]) {
    assert.match(surface, /Travel:<\/strong> unverified/);
    assert.match(surface, /Tickets:<\/strong> unknown\/unverified/);
    assert.match(surface, /Checked calendars: none; no time range checked/);
    assert.match(surface, /Missing or not checked: Alex and Sam/);
    assert.doesNotMatch(surface, /sample|mock|fixture|synthetic|deterministic/i);
  }
  for (const url of ["javascript:alert(1)", "https://example.test/unlisted", "https://mock.example.test/ambiguous", "https://mock.example.test/failure"]) {
    h.element("event-url").value = url; h.element("check-url").onclick();
    assert.match(h.element("event-result").innerHTML, /Unsupported|Ambiguous|Extraction failure/);
    assert.doesNotMatch(h.element("event-result").innerHTML, /Garden planning|Music lesson/);
  }
});

test("DOM color accents agree across list/settings/commitments and survive peer deletion", () => {
  const h = demoHarness();
  h.load("google"); h.settings("subject-0-2");
  for (const [id, cls] of [["subject-list","subject-row"], ["consent-content","subject-heading"], ["weekend-result","commitment"]]) {
    assert.ok(h.element(id).innerHTML.includes(`class="${cls} subject-color-plum"`), id);
  }
  h.element("close-settings").onclick();
  h.click("subject-list", { action:"delete", subjectId:"subject-0-1" });
  assert.match(h.element("subject-list").innerHTML, /subject-color-plum/);
  assert.equal(h.focused(), "settings-subject-0-2");
  h.settings("subject-0-2"); h.flow("manage"); h.change("disclosure", "busy"); h.flow("cancel");
  assert.match(h.element("subject-list").innerHTML, /subject-color-plum/);
  assert.doesNotMatch(h.element("weekend-result").innerHTML, /Music lesson|class="commitment/);
});

test("invitation validation permits only bounded fictional adult email syntax", () => {
  for (const value of ["adult@example.test", " Adult+preview@EXAMPLE.TEST ", "a.b@family.example.test", "a".repeat(64) + "@example.test"]) {
    assert.equal(validateInvitationEmail(value), "", value);
  }
  for (const value of [null, 1, "", "  ", "adult", "a@@example.test", "a..b@example.test", ".a@example.test",
    "a.@example.test", "Adult <adult@example.test>", "a@example.test,b@example.test", "a@example.test\r\nBcc:b@example.test",
    "a@-example.test", "a@example-.test", "a@exam_ple.test", "a@.test", "a@test", "a@" + "b".repeat(64) + ".test",
    "a".repeat(65) + "@example.test", "a@" + ("b".repeat(63) + ".").repeat(4) + "test", "<img src=x>@example.test"]) {
    assert.ok(validateInvitationEmail(value), String(value));
  }
  for (const value of ["adult@example.com", "adult@example.test.com"]) assert.match(validateInvitationEmail(value), /Real addresses are not supported/);
});

test("invitation transitions are immutable and cannot claim sent, accepted or connected", () => {
  const closed = resetInvitation(), snapshot = JSON.stringify(closed);
  assert.equal(invitationTransition(closed, { type:"review", email:"adult@example.test" }), closed);
  const editing = invitationTransition(closed, { type:"open" });
  const reviewed = invitationTransition(editing, { type:"review", email:" Adult@example.test " });
  assert.deepEqual(reviewed, { status:"unavailable", recipient:"Adult@example.test", error:"" });
  assert.equal(JSON.stringify(closed), snapshot);
  assert.equal(editing.recipient, "");
  for (const type of ["send", "sent", "accept", "ready", "confirm", "provider_accepted"]) {
    assert.equal(invitationTransition(reviewed, { type }), reviewed);
  }
  assert.equal(invitationTransition(reviewed, { type:"review", email:"other@example.test" }), reviewed);
  assert.deepEqual(invitationTransition(reviewed, { type:"back" }), editing);
  for (const type of ["close", "reset", "revoke"]) assert.deepEqual(invitationTransition(reviewed, { type }), closed);
});

test("invalid or real addresses never enter invitation state or rendered error text", () => {
  const editing = invitationTransition(resetInvitation(), { type:"open" });
  for (const email of ["adult@example.com", '<img src=x onerror="alert(1)">@example.test']) {
    const rejected = invitationTransition(editing, { type:"review", email });
    assert.equal(rejected.recipient, "");
    assert.equal(rejected.status, "editing");
    assert.ok(rejected.error);
    assert.ok(!JSON.stringify(rejected).includes(email));
    assert.equal(invitationReviewHtml(rejected), "");
  }
});

test("invitation review escapes recipients, labels unavailable delivery and explains separate consent", () => {
  const reviewed = invitationTransition(invitationTransition(resetInvitation(), { type:"open" }), { type:"review", email:"o'preview&test@example.test" });
  const html = invitationReviewHtml(reviewed);
  assert.match(html, /o&#39;preview&amp;test@example.test/);
  assert.match(html, /Not sent · Unavailable/);
  assert.match(html, /no connected invitation server, mail delivery, or recipient onboarding page/);
  assert.match(html, /not implemented/);
  assert.match(html, /Acknowledgement or provider sign-in alone is not calendar consent/);
  assert.match(html, /Personal\/work details stay hidden from other parents; private events stay Busy-only/);
  assert.match(html, /disabled aria-describedby="invitation-unavailable"/);
  assert.doesNotMatch(html, /href=|mailto:|<input|<script|data-action="confirm"/);
  assert.equal(invitationReviewHtml({ status:"unavailable", recipient:'<img src=x>@example.test' }), "");
});

test("invitation state never becomes a fixture identity and is cleared on reset or privacy reduction", () => {
  const initial = subjectConnected(resetSubjects(), "subject-0-1");
  let preview = subjectTransition(initial, { type:"invitation", invitation:{ type:"open" } });
  preview = subjectTransition(preview, { type:"invitation", invitation:{ type:"review", email:"adult@example.test" } });
  assert.equal(preview.subjects, initial.subjects);
  assert.deepEqual(subjectAuthorizedChoices(preview), subjectAuthorizedChoices(initial));
  assert.deepEqual(subjectScheduleContext(preview), subjectScheduleContext(initial));
  assert.doesNotMatch(subjectListHtml(preview), /adult@example.test/);
  for (const action of [{ type:"reset" }, { type:"scenario", value:"revoked" },
    ...["delete", "pause", "disconnect"].map(type => ({ type, subjectId:"subject-0-1" }))]) {
    assert.deepEqual(subjectTransition(preview, action).invitation, resetInvitation());
  }
});

test("DOM + opens invitation dialog, reviews only fictional email and leaves calendars/results unchanged", () => {
  const h = demoHarness(), before = h.element("subject-list").innerHTML, activitiesBefore = h.element("activity-results").innerHTML;
  h.element("add-calendar").onclick();
  assert.equal(h.element("invitation-dialog").open, true);
  assert.equal(h.element("consent-dialog").open, false);
  assert.equal(h.focused(), "invitation-email");
  h.element("invitation-email").value = "adult@example.com";
  h.element("invitation-form").onsubmit({ preventDefault() {} });
  assert.equal(h.element("invitation-email").value, "");
  assert.equal(h.element("invitation-email")["aria-invalid"], "true");
  assert.match(h.element("invitation-error").textContent, /Real addresses are not supported/);
  assert.equal(h.element("invitation-review").innerHTML, "");
  h.element("invitation-email").value = "adult@example.test";
  h.element("invitation-form").onsubmit({ preventDefault() {} });
  assert.equal(h.element("invitation-form").hidden, true);
  assert.equal(h.element("invitation-email").value, "");
  assert.equal(h.element("invitation-email")["aria-invalid"], "false");
  assert.equal(h.focused(), "invitation-title");
  assert.match(h.element("invitation-review").innerHTML, /adult@example.test/);
  assert.equal(h.element("subject-list").innerHTML, before);
  assert.equal(h.element("activity-results").innerHTML, activitiesBefore);
  h.click("invitation-review", { invitationAction:"back" });
  assert.equal(h.element("invitation-form").hidden, false);
  assert.equal(h.element("invitation-review").innerHTML, "");
  assert.equal(h.focused(), "invitation-email");
});

test("DOM invitation close/Escape/reset/revocation clear both DOM input and reviewed recipient", () => {
  for (const review of [false, true]) for (const action of ["close", "cancel", "escape", "reset", "footer-reset", "revoked"]) {
    const h = demoHarness();
    h.element("add-calendar").onclick();
    h.element("invitation-email").value = "adult@example.test";
    if (review) h.element("invitation-form").onsubmit({ preventDefault() {} });
    if (action === "close") h.element("close-invitation").onclick();
    else if (action === "cancel") h.element("invitation-dialog").oncancel({ preventDefault() {} });
    else if (action === "escape") h.element("invitation-dialog").onkeydown({ key:"Escape", preventDefault() {} });
    else if (action === "revoked") h.element("scenario").onchange({ target:{ value:"revoked" } });
    else h.element(action).onclick();
    assert.equal(h.element("invitation-dialog").open, false, action);
    assert.equal(h.element("invitation-email").value, "", action);
    assert.equal(h.element("invitation-review").innerHTML, "", action);
    assert.equal(h.focused(), "add-calendar", action);
    h.element("invitation-form").onsubmit({ preventDefault() {} });
    assert.equal(h.element("invitation-review").innerHTML, "", "stale review after close");
  }
});

test("invitation markup is labelled and offline; alias controls are separated from main +", () => {
  const html = readFileSync(require.resolve("../index.html"), "utf8"), js = readFileSync(require.resolve("../app.js"), "utf8");
  assert.match(html, /<dialog id="invitation-dialog" aria-labelledby="invitation-title" aria-describedby="invitation-boundary">/);
  assert.match(html, /<label for="invitation-email">Adult email \(preview only\)<\/label>/);
  assert.match(html, /id="invitation-email" type="email"[^>]*autocomplete="off"/);
  assert.match(html, /id="invitation-error"[^>]*role="alert"/);
  assert.ok(html.indexOf('id="add-subject"') > html.indexOf('<summary>Demo state controls</summary>'));
  assert.equal((html.match(/id="add-calendar"/g) || []).length, 1);
  assert.doesNotMatch(js, /\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|sendBeacon|mailto:|logic\.azure/);
});
