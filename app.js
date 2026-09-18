(function (root) {
  "use strict";
  const activities = [
    { id:"science", type:"science", age:"7-10", date:"2026-06-20", cost:12, title:"Night Lab: Light & Shadows — 20 June, 10:00–11:15", venue:"Science Hall, Northside", guidance:"Ages 7–10", rationale:"Hands-on light experiments match the science interest.", source:"Demo source: Science Hall listing", url:"https://mock.example.test/night-lab" },
    { id:"concert", type:"concert", age:"9-13", date:"2026-06-20", cost:25, title:"Tiny Orchestra: Family Matinee — 20 June, 14:00 performance", venue:"Civic Studio, Downtown", guidance:"Recommended ages 9–13", rationale:"Short orchestral performance with a family matinee format.", source:"Demo source: Civic Studio listing", url:"https://mock.example.test/tiny-orchestra" },
    { id:"exhibition", type:"exhibition", age:"7-10", date:"2026-06-21", cost:0, title:"Build It! Materials Exhibition — 21 June, 11:00–16:00", venue:"Museum, Riverside", guidance:"All ages; activity table best for 7–10", rationale:"Making table and material displays suit the selected age range.", source:"Demo source: Museum listing", url:"https://mock.example.test/build-it" }
  ];
  const toSafeString = value => String(value == null ? "" : value);
  const escapeHtml = value => toSafeString(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const safeHttpUrl = value => { try { const u = new URL(value); return /^https?:$/.test(u.protocol) ? u.href : null; } catch { return null; } };
  const providers = Object.freeze({
    outlook:Object.freeze({ name:"Outlook", account:"alex.demo@example.test", calendar:"alex", label:"Alex Outlook", person:"Alex (fictional adult)", child:false }),
    google:Object.freeze({ name:"Google", account:"guardian.demo@example.test", calendar:"sam", label:"Sam Google", person:"Sam (fictional child)", child:true })
  });
  const sampleWindow = "20–21 June 2026, America/New_York";
  const sampleFreshness = "19 June 2026, 18:00 EDT (simulated, not current)";
  const audience = "Current demo viewer only; no family sharing";
  const retention = "Session memory only; cleared on reload, reset, deletion, or disconnect; no storage or background sync";
  const emptyChoices = provider => [{ id:providers[provider].calendar, selected:false, person:"", disclosure:"busy", guardian:false }];
  const newConnection = provider => ({ status:"disconnected", permission:false, step:null, choices:emptyChoices(provider), confirmed:[], summary:null, revision:0 });
  const resetState = (generation=0) => ({ generation, scenario:"no-calendar", providers:Object.fromEntries(Object.keys(providers).map(p => [p, newConnection(p)])) });
  // Presentation only: allocated once per subject, never derived from identity or permission.
  // Six fixed CSS themes repeat in creation order; names and statuses remain textual.
  const subjectPalette = Object.freeze(["ocean", "plum", "forest", "clay", "indigo", "rose"]);
  const subjectColor = subject => subjectPalette[Number.isInteger(subject.colorIndex) && subject.colorIndex >= 0 ? subject.colorIndex % subjectPalette.length : 0];
  const subjectInitials = name => toSafeString(name).trim().split(/\s+/u).filter(Boolean).slice(0, 2).map(part => Array.from(part)[0]).join("").toUpperCase();
  const subjectAvatarHtml = subject => `<span class="subject-avatar" aria-hidden="true">${escapeHtml(subjectInitials(subject.name))}</span>`;
  let state = resetSubjects();

  // Offline invitation entry only. Never retain a real address or infer an identity/grant.
  function resetInvitation() { return { status:"closed", recipient:"", error:"" }; }
  function validateInvitationEmail(value) {
    if (typeof value !== "string" || !value.trim()) return "Enter a fictional adult email, such as adult@example.test.";
    const email = value.trim();
    const parts = email.split("@"), local = parts[0], domain = parts[1];
    if (email.length > 254 || parts.length !== 2 || local.length > 64 ||
      !/^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/i.test(local) ||
      !domain || !domain.includes(".") || domain.split(".").some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) {
      return "Use one valid email address, without a display name or extra recipients.";
    }
    if (!/\.test$/i.test(domain)) return "Real addresses are not supported here. Use a fictional .test address; nothing will be sent.";
    return "";
  }
  function invitationTransition(current, action) {
    if (["close", "reset", "revoke"].includes(action.type)) return resetInvitation();
    if (action.type === "open") return { ...resetInvitation(), status:"editing" };
    if (action.type === "back" && current.status === "unavailable") return { ...resetInvitation(), status:"editing" };
    if (action.type !== "review" || current.status !== "editing") return current;
    const error = validateInvitationEmail(action.email);
    return error ? { ...resetInvitation(), status:"editing", error }
      : { status:"unavailable", recipient:action.email.trim(), error:"" };
  }
  function invitationReviewHtml(invitation) {
    if (invitation.status !== "unavailable" || validateInvitationEmail(invitation.recipient)) return "";
    return `<h3>Review invitation</h3><p><strong>Fictional recipient:</strong> ${escapeHtml(invitation.recipient)}</p>
      <p><strong>Requested action:</strong> Ask this adult to review an invitation and decide whether to share selected calendars read-only.</p>
      <p id="invitation-unavailable" class="status">Not sent · Unavailable: this app has no connected invitation server, mail delivery, or recipient onboarding page. No invitation or calendar row was created.</p>
      <p><strong>Intended recipient journey (not implemented):</strong></p>
      <ol><li>Open the invitation and sign in as the intended adult, then explicitly acknowledge or decline. Opening a link alone grants nothing.</li>
      <li>Choose calendars and represented-person labels, disclosure and audience. Personal/work details stay hidden from other parents; private events stay Busy-only.</li>
      <li>Review and confirm the access summary before any event import. Acknowledgement or provider sign-in alone is not calendar consent.</li></ol>
      <p>No link is generated and no email app is opened. A mail draft is not a delivered invitation or a working calendar-sharing flow.</p>
      <div class="button-row"><button type="button" disabled aria-describedby="invitation-unavailable">Send invitation (unavailable)</button><button type="button" data-invitation-action="back">Change recipient</button></div>`;
  }

  // Only known synthetic labels are accepted; no free-text identities or provider data.
  function validateChoices(provider, choices) {
    const source = providers[provider];
    if (!source || !Array.isArray(choices) || choices.length !== 1 || choices[0]?.id !== source.calendar) return ["Choose a listed calendar for this provider."];
    const choice = choices[0], errors = [];
    if (choice.selected !== true) errors.push("Select at least one calendar explicitly.");
    if (choice.person !== source.person) errors.push("Choose the matching fictional represented-person label.");
    if (!["busy", "details"].includes(choice.disclosure)) errors.push("Choose Busy-only or Details.");
    if (source.child && choice.guardian !== true) errors.push("Attest guardian authority for the fictional child calendar.");
    return errors;
  }
  const copyChoices = choices => choices.map(x => ({ ...x }));
  const sameChoices = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function canConfirmImport(state, provider, summaryId) {
    const connection = state.providers[provider], summary = connection?.summary;
    return Boolean(connection?.permission && connection.step === "review" && summary &&
      summary.id === summaryId && summary.id === `${state.generation}:${provider}:${connection.revision}` &&
      !validateChoices(provider, connection.choices).length && sameChoices(summary.choices, connection.choices));
  }

  // Pure transitions. Edits invalidate only this provider immediately, even if later cancelled.
  // Revision + reset generation fence stale confirmations without touching another provider's grant.
  function transition(current, action) {
    if (action.type === "reset") return resetState(current.generation + 1);
    if (action.type === "scenario") {
      if (!["ready","loading","empty","no-calendar","partial","stale","conflict","revoked","unavailable","unsupported"].includes(action.value)) return current;
      const next = action.value === "revoked" ? resetState(current.generation + 1) : { ...current };
      return { ...next, scenario:action.value };
    }
    const p = action.provider;
    if (!Object.hasOwn(providers, p)) return current;
    const old = current.providers[p];
    const c = { ...old, choices:copyChoices(old.choices), confirmed:copyChoices(old.confirmed), revision:old.revision + 1, summary:null };
    let scenario = current.scenario;
    switch (action.type) {
      case "begin":
        if (old.permission) return current;
        c.status = "pending"; c.step = "explain";
        break;
      case "grant":
        if (old.step !== "explain") return current;
        c.permission = true; c.step = "picker"; c.choices = emptyChoices(p);
        break;
      case "deny":
        if (old.step !== "explain") return current;
        Object.assign(c, newConnection(p), { revision:c.revision });
        break;
      case "manage":
        if (!old.permission) return transition(current, { type:"begin", provider:p });
        c.step = "picker";
        break;
      case "edit": {
        if (!old.permission || !["picker", "review"].includes(old.step)) return current;
        const choice = c.choices.find(x => x.id === action.id);
        if (!choice || !["selected", "person", "disclosure", "guardian"].includes(action.field)) return current;
        choice[action.field] = action.value;
        c.confirmed = []; c.status = "pending"; c.step = "picker";
        break;
      }
      case "review":
        if (!old.permission || old.step !== "picker" || validateChoices(p, old.choices).length) return current;
        c.step = "review";
        c.summary = { id:`${current.generation}:${p}:${c.revision}`, choices:copyChoices(c.choices), account:providers[p].account, range:sampleWindow, audience, retention };
        break;
      case "back":
        if (old.step !== "review") return current;
        c.step = "picker";
        break;
      case "confirm":
        if (!canConfirmImport(current, p, action.summaryId)) return current;
        c.confirmed = copyChoices(c.choices); c.status = "connected"; c.step = null;
        scenario = "ready";
        break;
      case "cancel":
        if (!old.step) return current;
        if (!old.permission) Object.assign(c, newConnection(p), { revision:c.revision });
        else { c.step = null; c.choices = c.confirmed.length ? copyChoices(c.confirmed) : emptyChoices(p); }
        break;
      case "pause":
        if (!old.permission) return current;
        c.status = "paused"; c.step = null; c.confirmed = []; c.choices = emptyChoices(p);
        break;
      case "disconnect":
      case "delete":
        Object.assign(c, newConnection(p), { revision:c.revision });
        break;
      default: return current;
    }
    return { ...current, scenario, providers:{ ...current.providers, [p]:c } };
  }

  function authorizedChoices(state) {
    return Object.entries(providers).flatMap(([provider, source]) => {
      const c = state.providers[provider];
      return c.permission && c.status === "connected" && !validateChoices(provider, c.confirmed).length
        ? c.confirmed.map(choice => ({ ...choice, provider, label:source.label })) : [];
    });
  }
  const calendarCommitment = (disclosure, confirmed, title, person, privateEvent=false) =>
    disclosure === "details" && confirmed && !privateEvent ? `${person}: ${title}` : "Unavailable — busy-only block";
  function disclosedEvents(state) {
    return authorizedChoices(state).flatMap(choice => {
      const events = choice.id === "alex"
        ? [{ time:"Sat 20 June 10:00–11:00 EDT", title:"Garden planning" }]
        : [{ time:"Sat 20 June 13:00–14:00 EDT", title:"Music lesson" }];
      if (state.scenario === "conflict" && choice.id === "alex") events.push({ time:"Sat 20 June 10:30–11:30 EDT", title:"Private sample appointment", private:true });
      // Raw fixture titles never leave this projection for busy-only/private events.
      return events.map(event => ({ calendar:choice.id, source:choice.label, person:choice.person, time:event.time,
        text:calendarCommitment(choice.disclosure, true, event.title, choice.person, event.private) }));
    });
  }
  const filterActivities = (items, filters) => items.filter(x =>
    (filters.age === "all" || x.age === filters.age) && (filters.interest === "all" || x.type === filters.interest) &&
    (filters.date === "all" || x.date === filters.date) && (filters.budget === "all" || (filters.budget === "low" ? x.cost <= 15 : x.cost <= 30)));
  function availabilityMessage(scenario, selected=[]) {
    const checked = ["ready", "conflict", "partial"].includes(scenario)
      ? Object.values(providers).filter(p => selected.includes(p.calendar) && !(scenario === "partial" && p.calendar === "sam")) : [];
    const missing = Object.values(providers).filter(p => !checked.includes(p)).map(p => p.label);
    const contexts = {
      "no-calendar":"No calendar context is being checked. Discovery still works; schedule compatibility was not checked.",
      partial:"Partial context omits Google.",
      stale:"Selected calendars are stale (simulated freshness: 17 June 2026, 18:00 EDT); not used for compatibility.",
      revoked:"Permission was revoked. Open Settings to restart consent in the demo.",
      unavailable:"Provider is unavailable. Change scenario to retry confirmed choices or open Settings.",
      unsupported:"Child account is unsupported. Provider/guardian feasibility is not verified.",
      loading:"Loading calendar context; availability cannot yet be verified.",
      empty:"No commitments are available in the selected range; availability cannot be verified."
    };
    const status = contexts[scenario] || (checked.length
      ? scenario === "conflict" && selected.includes("alex") ? "Possible conflict: Alex Outlook is busy Sat 20 June 10:30–11:30 EDT." : "No conflict found in the selected calendars for this fictional comparison only."
      : "No confirmed calendar import is available. Discovery still works; schedule compatibility was not checked.");
    return `${status} Checked calendars: ${checked.length ? checked.map(p => p.label).join(" and ") + ", Sat 20 June 09:00–17:00 EDT; freshness: " + sampleFreshness : "none; no time range checked"}. ` +
      (missing.length ? `Missing or not checked: ${missing.join(" and ")}. Cannot verify availability.` : "This is not complete availability; travel and context outside the selected range are unknown.");
  }
  function scheduleContext(state) {
    if (state.subjects) return subjectScheduleContext(state);
    const selected = authorizedChoices(state).map(c => c.id);
    const checked = ["ready", "conflict", "partial"].includes(state.scenario)
      ? selected.filter(id => state.scenario !== "partial" || id !== "sam") : [];
    return { checked, message:availabilityMessage(state.scenario, selected), events:disclosedEvents(state).filter(e => checked.includes(e.calendar)) };
  }
  const card = (title, body, cls="") => `<article class="result-card ${cls}"><h3>${title}</h3>${body}</article>`;
  function renderWeekendHtml(state) {
    const context = scheduleContext(state);
    return card("Checked calendar context", `<p>${escapeHtml(context.message)}</p>`, context.checked.length ? "ok" : "alert") +
      (context.events.length ? card("Commitments", context.events.map(e => `<div class="commitment${e.subjectId ? ` subject-color-${subjectColor(e)}` : ""}">${e.subjectId ? subjectAvatarHtml({ name:e.subjectName }) : ""}<p><strong>${escapeHtml(e.time)}:</strong> ${escapeHtml(e.text)}<br>${e.subjectId ? `Name: ${escapeHtml(e.subjectName)} · ` : ""}Demo source: ${escapeHtml(e.source)} · represented person: ${escapeHtml(e.person)}${e.subjectId ? " (fictional identity, not this name's real calendar)" : ""}</p></div>`).join("") +
        "<p>Busy-only/private blocks contain no title, location, attendees, or inferred purpose.</p>") : "");
  }
  function renderWeekend() {
    document.querySelector("#weekend-result").innerHTML = renderWeekendHtml(state);
  }
  function renderActivities() {
    const form = document.querySelector("#filters"), filters = Object.fromEntries(new FormData(form)), results = filterActivities(activities, filters);
    document.querySelector("#activity-results").innerHTML = results.length ? results.map(x => card(`${escapeHtml(x.title)} <span class="tag">Fictional event</span>`, `<p><strong>Venue/area:</strong> ${escapeHtml(x.venue)} · <strong>Age:</strong> ${escapeHtml(x.guidance)} · <strong>Cost:</strong> $${x.cost}</p><p><strong>Why it may suit:</strong> ${escapeHtml(x.rationale)}</p><p><strong>Provenance:</strong> ${escapeHtml(x.source)}. Invented facts; no live venue page exists.</p><p><strong>Travel:</strong> unverified. <strong>Tickets:</strong> unknown/unverified. <strong>Calendar fit:</strong> ${escapeHtml(scheduleContext(state).message)}</p>`)).join("") : card("No activities match those filters", "<p>Only type, listed age range, date, and budget filter these events. Try Reset demo or relax a supported filter.</p>", "alert");
  }
  function assess(value) {
    const out = document.querySelector("#event-result"), url = safeHttpUrl(value);
    if (!url) { out.innerHTML = card("Unsupported assessment", "<p>Use a safe http/https URL. The page is not fetched; choose an event below.</p>", "alert"); return; }
    const item = activities.find(x => x.url === url);
    if (url.includes("ambiguous")) { out.innerHTML = card("Ambiguous performance — demo", "<p>The fictional concert page has multiple performances. Select “Tiny Orchestra: Family Matinee — 20 June, 14:00” before a schedule comparison.</p>", "alert"); return; }
    if (url.includes("failure")) { out.innerHTML = card("Extraction failure — demo", "<p>No facts were extracted. This URL was not fetched; try Night Lab.</p>", "alert"); return; }
    if (!item) { out.innerHTML = card("Unsupported page", `<p>“${escapeHtml(value)}” is displayed as text only and was not fetched or associated with preset facts. Choose a listed event.</p>`, "alert"); return; }
    out.innerHTML = card("Event facts — fictional, not fetched", `<p><strong>Exact identity:</strong> ${escapeHtml(item.title)}</p><p><strong>Venue:</strong> ${escapeHtml(item.venue)}; <strong>Age:</strong> ${escapeHtml(item.guidance)}; <strong>Cost:</strong> $${item.cost}</p><p><strong>Provenance:</strong> ${escapeHtml(item.source)}. <strong>Travel:</strong> unverified. <strong>Tickets:</strong> unknown/unverified.</p><p><strong>Schedule comparison:</strong> ${escapeHtml(scheduleContext(state).message)}</p>`, "ok");
  }
  const disclosureLabel = choice => choice.disclosure === "details" ? "Details" : "Busy-only";
  function providerCardsHtml(state, onlyProvider) {
    return Object.entries(providers).filter(([p]) => !onlyProvider || p === onlyProvider).map(([p, source]) => {
      const c = state.providers[p], selected = c.confirmed.length ? c.confirmed : c.choices.filter(x => x.selected);
      const status = { disconnected:"Not configured", pending:"Pending — import not confirmed", connected:"Ready in demo", paused:"Paused — import removed; fresh confirmation required" }[c.status];
      const preview = disclosedEvents(state).filter(e => e.calendar === source.calendar);
      return `<article class="provider-card"><h3>${source.name} <span class="tag">Read-only</span></h3>
        <p><strong>Status:</strong> ${status}</p><p>Fictional account: ${escapeHtml(source.account)}</p>
        <p><strong>${c.confirmed.length ? "Confirmed" : "Unconfirmed"} selection:</strong> ${selected.length} calendar(s)</p>
        <ul>${selected.map(x => `<li>${escapeHtml(source.label)} · ${escapeHtml(x.person || "Represented person not chosen")} · ${disclosureLabel(x)}</li>`).join("") || "<li>No calendars selected. Default: Busy-only.</li>"}</ul>
        <p class="small">Freshness: ${c.confirmed.length ? sampleFreshness : "No active import"}. No live sync.</p>
        ${preview.length ? `<details><summary>Imported preview — current disclosure</summary>${preview.map(e => `<p>${escapeHtml(e.time)} · ${escapeHtml(e.text)} · ${escapeHtml(e.source)}</p>`).join("")}</details>` : ""}
        <div class="button-row">
          ${c.permission ? `<button id="manage-${p}" data-provider="${p}" data-action="manage">Manage ${source.name}</button>` : `<button id="connect-${p}" data-provider="${p}" data-action="begin">Continue in demo</button>`}
          ${c.permission ? `<button data-provider="${p}" data-action="pause">Pause ${source.name}</button>
          <button data-provider="${p}" data-action="disconnect">Disconnect ${source.name}</button>` : ""}
        </div></article>`;
    }).join("");
  }
  const flowButton = (action, text) => `<button data-action="${action}">${text}</button>`;
  function consentHtml(state, p) {
    const source = providers[p], c = state.providers[p];
    if (c.step === "explain") return `<p><strong>Step 1 · ${source.name} access</strong></p>
      <p>Compare only selected schedules when asked. This is a pretend read-only permission grant, not OAuth or real authorization. No real permission is requested; no login, calendar list, or events are fetched.</p>
      <p>Busy-only shows times and source/person labels. Details also shows fictional titles to this viewer only. Private events stay Busy-only.</p>
      <details><summary>Data use and privacy</summary><p>No provider scopes, advertising, training, sharing, writes, bookings, or notifications. Personal/work details must not be shared with another parent.</p><p><strong>Retention:</strong> ${retention}.</p></details>
      <p>Next: choose calendars explicitly, review access, then confirm. Granting permission in the demo alone imports nothing.</p>
      <div class="button-row">${flowButton("grant", "Grant permission in demo")}${flowButton("deny", "Deny permission")}${flowButton("cancel", "Cancel")}</div>`;
    if (c.step === "picker") {
      const choice = c.choices[0];
      return `<p><strong>Step 2 · Choose calendars</strong></p><p>Demo permission granted for ${escapeHtml(source.account)}. Nothing new imported.</p>
        <p>Each calendar starts off and Busy-only. Changing selection or privacy immediately removes this name's previous authorization and results, even if you cancel later. Other names are unchanged.</p>
        <fieldset><legend>${escapeHtml(source.label)}</legend>
          <label><input id="choose-calendar" type="checkbox" data-field="selected" ${choice.selected ? "checked" : ""}> Select ${escapeHtml(source.label)}</label>
          <label for="represented-person">Represents</label>
          <select id="represented-person" data-field="person"><option value="">Choose a fictional person</option><option value="${escapeHtml(source.person)}" ${choice.person === source.person ? "selected" : ""}>${escapeHtml(source.person)}</option></select>
          <label for="calendar-disclosure">Per-calendar disclosure</label>
          <select id="calendar-disclosure" data-field="disclosure"><option value="busy" ${choice.disclosure === "busy" ? "selected" : ""}>Busy-only</option><option value="details" ${choice.disclosure === "details" ? "selected" : ""}>Details (current demo viewer only)</option></select>
          ${source.child ? `<label><input id="guardian-authority" type="checkbox" data-field="guardian" ${choice.guardian ? "checked" : ""}> I attest guardian authority to review this fictional child calendar in the demo. This is not verified real authority.</label>` : "<p>No child-calendar attestation is needed for this fictional adult calendar.</p>"}
        </fieldset>
        <details><summary>Missing a calendar?</summary><p>${source.child ? "Google child-account and Family Link access remain unverified. Supervision alone does not grant Calendar access; use a parent calendar or this demo if unsupported. Never supply a child's password." : "Microsoft family membership alone does not grant access. A real future flow would need owner-approved read-only sharing or an independently consenting account; neither happens here."}</p></details>
        <div class="button-row">${flowButton("review", "Review access")}${flowButton("cancel", "Cancel")}</div>`;
    }
    if (c.step === "review" && c.summary) {
      const summary = c.summary, choice = summary.choices[0];
      return `<p><strong>Step 3 · Review access</strong></p>
        <ul><li>Provider/account: ${source.name} · ${escapeHtml(summary.account)}</li>
        <li>Selected calendar: ${escapeHtml(source.label)}</li><li>Represents: ${escapeHtml(choice.person)}</li>
        <li>Disclosure: ${disclosureLabel(choice)}; private events always Busy-only</li>
        <li>Guardian attestation: ${source.child ? "Recorded for this fictional child only" : "Not applicable (fictional adult)"}</li>
        <li>Import range: ${escapeHtml(summary.range)}</li><li>Audience: ${escapeHtml(summary.audience)}</li>
        <li>Retention: ${escapeHtml(summary.retention)}</li></ul>
        <p><strong>Illustrative preview, not imported events:</strong> ${choice.disclosure === "busy" ? "Unavailable — busy-only block. No titles, locations, attendees, or inferred purpose." : "Example activity title for this fictional person. Private events still show Unavailable — busy-only block."}</p>
        <p>Only these reviewed choices can be confirmed. Back or Cancel does not import. Confirmation loads fictional events only; reopen Settings to inspect the redacted preview.</p>
        <div class="button-row"><button data-action="confirm" data-summary-id="${escapeHtml(summary.id)}">Confirm in demo</button>${flowButton("back", "Back to calendar choices")}${flowButton("cancel", "Cancel")}</div>`;
    }
    return "";
  }
  // Subject labels are display data, never identity, authority, DOM IDs, or state keys.
  // Each subject composes the same consent engine with a private provider-state container.
  function resetSubjects(generation=0) {
    return { generation, nextId:3, scenario:"ready", invitation:resetInvitation(), subjects:[
      { id:`subject-${generation}-1`, name:"Alex", colorIndex:0, provider:null, sourceRevision:0, access:resetState(`${generation}:1:0`) },
      { id:`subject-${generation}-2`, name:"Sam", colorIndex:1, provider:null, sourceRevision:0, access:resetState(`${generation}:2:0`) }
    ] };
  }
  function validateSubjectName(value, subjects=[]) {
    if (typeof value !== "string" || !value.trim()) return "Enter a name or alias.";
    const name = value.trim();
    if (name.length > 60) return "Use at most 60 characters for a name.";
    if (subjects.some(s => s.name.toLowerCase() === name.toLowerCase())) return "That name already exists (names are case-insensitive).";
    return "";
  }
  function subjectTransition(current, action) {
    if (action.type === "reset") return resetSubjects(current.generation + 1);
    if (action.type === "invitation") return { ...current, invitation:invitationTransition(current.invitation, action.invitation) };
    if (action.type === "add") {
      if (validateSubjectName(action.name, current.subjects)) return current;
      const id = `subject-${current.generation}-${current.nextId}`;
      return { ...current, nextId:current.nextId + 1, subjects:[...current.subjects,
        { id, name:action.name.trim(), colorIndex:(current.nextId - 1) % subjectPalette.length, provider:null, sourceRevision:0, access:resetState(`${current.generation}:${id}:0`) }] };
    }
    if (action.type === "scenario") {
      const scenario = transition(resetState(), action).scenario;
      if (scenario !== action.value) return current;
      return { ...current, scenario, invitation:scenario === "revoked" ? resetInvitation() : current.invitation, subjects:scenario !== "revoked" ? current.subjects : current.subjects.map(s => ({
        ...s, sourceRevision:s.sourceRevision + 1, access:resetState(`${current.generation}:${s.id}:${s.sourceRevision + 1}`)
      })) };
    }
    const subject = current.subjects.find(s => s.id === action.subjectId);
    if (!subject) return current;
    if (action.type === "delete") return { ...current, invitation:resetInvitation(), subjects:current.subjects.filter(s => s.id !== subject.id) };
    let updated;
    if (action.type === "select-provider") {
      if (action.provider !== null && !Object.hasOwn(providers, action.provider)) return current;
      if (subject.provider === action.provider) return current;
      updated = { ...subject, provider:action.provider, sourceRevision:subject.sourceRevision + 1,
        access:resetState(`${current.generation}:${subject.id}:${subject.sourceRevision + 1}`) };
    } else {
      if (!subject.provider || !["begin","grant","deny","manage","edit","review","back","confirm","cancel","pause","disconnect"].includes(action.type)) return current;
      const access = transition(subject.access, { ...action, provider:subject.provider });
      if (access === subject.access) return current;
      updated = { ...subject, access };
    }
    // A subject's confirmation must not turn a global stale/partial/revoked scenario into ready.
    return { ...current, invitation:["pause", "disconnect", "edit", "select-provider"].includes(action.type) ? resetInvitation() : current.invitation,
      subjects:current.subjects.map(s => s.id === subject.id ? updated : s) };
  }
  function subjectAuthorizedChoices(state) {
    return state.subjects.flatMap(s => authorizedChoices(s.access).filter(c => c.provider === s.provider)
      .map(c => ({ ...c, subjectId:s.id, subjectName:s.name })));
  }
  function subjectDisclosedEvents(state) {
    return state.subjects.flatMap(s => disclosedEvents({ ...s.access, scenario:state.scenario })
      .filter(e => s.provider && e.calendar === providers[s.provider].calendar)
      .map(e => ({ ...e, subjectId:s.id, subjectName:s.name, colorIndex:s.colorIndex })));
  }
  function subjectScheduleContext(state) {
    const authorized = subjectAuthorizedChoices(state);
    const checkedChoices = ["ready","conflict","partial"].includes(state.scenario)
      ? authorized.filter(c => state.scenario !== "partial" || c.provider !== "google") : [];
    const checked = checkedChoices.map(c => c.subjectId);
    const missing = state.subjects.filter(s => !checked.includes(s.id)).map(s => s.name);
    const descriptions = {
      "no-calendar":"No calendar context is being checked. Discovery still works; schedule compatibility was not checked.",
      partial:"Partial context omits Google.",
      stale:"Selected calendars are stale (simulated freshness: 17 June 2026, 18:00 EDT); not used for compatibility.",
      revoked:"Permission was revoked. Open Settings to restart consent in the demo.",
      unavailable:"Provider is unavailable. Change scenario to retry confirmed choices or open Settings.",
      unsupported:"Child account is unsupported. Provider/guardian feasibility is not verified.",
      loading:"Loading calendar context; availability cannot yet be verified.",
      empty:"No commitments are available in the selected range; availability cannot be verified."
    };
    const conflicts = state.scenario === "conflict" ? checkedChoices.filter(c => c.provider === "outlook") : [];
    const status = descriptions[state.scenario] || (conflicts.length
      ? `Possible conflict in ${conflicts.map(c => `${c.subjectName} (Demo source: ${c.label})`).join(" and ")}: busy Sat 20 June 10:30–11:30 EDT.`
      : checked.length ? "No conflict found in the checked calendars for this fictional comparison only."
        : "No confirmed calendar import is available. Discovery still works; schedule compatibility was not checked.");
    const sources = checkedChoices.map(c => `${c.subjectName} (Demo source: ${c.label}; not this name's real calendar)`);
    const message = `${status} Checked calendars: ${sources.length ? sources.join(" and ") + ", Sat 20 June 09:00–17:00 EDT; freshness: " + sampleFreshness : "none; no time range checked"}. ` +
      (missing.length ? `Missing or not checked: ${missing.join(" and ")}. Cannot verify availability.`
        : "Cannot verify complete availability; travel and context outside the selected range are unknown.");
    return { checked, message, events:subjectDisclosedEvents(state).filter(e => checked.includes(e.subjectId)) };
  }
  function subjectStatus(subject) {
    const c = subject.provider && subject.access.providers[subject.provider];
    return c?.status === "paused" ? "Paused" : c?.status === "connected" && authorizedChoices(subject.access).length ? "Ready" : "Not configured";
  }
  function subjectListHtml(state) {
    return state.subjects.length ? state.subjects.map(s => `<li class="subject-row subject-color-${subjectColor(s)}">
      ${subjectAvatarHtml(s)}
      <div class="subject-label"><strong>${escapeHtml(s.name)}</strong><span class="small">${subjectStatus(s)}</span></div>
      <div class="subject-actions"><button id="settings-${s.id}" class="icon-button" data-subject-id="${s.id}" data-action="settings" aria-label="Calendar settings for ${escapeHtml(s.name)}" title="Calendar settings for ${escapeHtml(s.name)}"><span aria-hidden="true">⋯</span></button>
      <button class="icon-button remove-button" data-subject-id="${s.id}" data-action="delete" aria-label="Remove ${escapeHtml(s.name)}" title="Remove ${escapeHtml(s.name)}"><span aria-hidden="true">−</span></button></div></li>`).join("")
      : '<li class="small">No names yet. Restore fictional calendars in Demo state controls, or find an activity without calendars.</li>';
  }
  function subjectSettingsHtml(state, id) {
    const s = state.subjects.find(s => s.id === id);
    if (!s) return "";
    const c = s.provider && s.access.providers[s.provider];
    return `<div class="subject-heading subject-color-${subjectColor(s)}">${subjectAvatarHtml(s)}<p><strong>${escapeHtml(s.name)}</strong><br>${subjectStatus(s)}</p></div>
      <details><summary>Names, colors, and privacy</summary><p>This tab-only alias is not a persistent profile, real identity, or proof of guardian authority. Adding a name imports nothing and grants no access. Colors repeat after six names in creation order; they do not indicate identity, age, authority, or status.</p></details>
      <label for="subject-provider">Provider</label>
      <select id="subject-provider"><option value="">Choose a provider</option>${Object.entries(providers).map(([p, source]) => `<option value="${p}" ${s.provider === p ? "selected" : ""}>${source.name}</option>`).join("")}</select>
      <p class="small">Changing provider immediately clears this name's grant, choices, and results, even if you cancel. Other names are unchanged.</p>
      ${s.provider ? `<p><strong>Demo source:</strong> ${escapeHtml(providers[s.provider].label)} represents ${escapeHtml(providers[s.provider].person)}, not the real calendar of ${escapeHtml(s.name)}. Child attestation follows this fictional source, never the added name.</p>
      ${c.step ? consentHtml(s.access, s.provider) : providerCardsHtml(s.access, s.provider)}` : "<p>Choose a provider to try the consent steps with fictional calendars. No connection has been made.</p>"}`;
  }
  function focusAfterSubjectDelete(state, id) {
    const index = state.subjects.findIndex(s => s.id === id);
    const next = state.subjects[index + 1] || state.subjects[index - 1];
    return next ? `settings-${next.id}` : "add-calendar";
  }
  let activeSubject = null, returnFocusId = null;
  function renderInvitation() {
    const invitation = state.invitation;
    document.querySelector("#invitation-form").hidden = invitation.status !== "editing";
    document.querySelector("#invitation-error").textContent = invitation.error;
    document.querySelector("#invitation-email").setAttribute("aria-invalid", String(Boolean(invitation.error)));
    document.querySelector("#invitation-review").innerHTML = invitationReviewHtml(invitation);
  }
  function clearInvitationDialog() {
    const dialog = document.querySelector("#invitation-dialog"), wasOpen = dialog.open;
    if (wasOpen) dialog.close();
    document.querySelector("#invitation-email").value = "";
    renderInvitation();
    if (wasOpen) document.querySelector("#add-calendar").focus();
  }
  function closeInvitation(e) {
    e?.preventDefault();
    state = subjectTransition(state, { type:"invitation", invitation:{ type:"close" } });
    clearInvitationDialog();
  }
  function refreshResults() {
    if (state.invitation.status === "closed") clearInvitationDialog();
    document.querySelector("#subject-list").innerHTML = subjectListHtml(state);
    document.querySelector("#scenario").value = state.scenario;
    renderWeekend(); renderActivities();
    // A previous assessment may contain derived calendar context. Never retain it after a consent change.
    document.querySelector("#event-result").replaceChildren();
  }
  function renderConsent() {
    const subject = state.subjects.find(s => s.id === activeSubject);
    if (!subject) return;
    document.querySelector("#consent-title").textContent = `Calendar settings for ${subject.name}`;
    document.querySelector("#consent-content").innerHTML = subjectSettingsHtml(state, activeSubject);
    document.querySelector("#consent-error").textContent = "";
    document.querySelector("#consent-title").focus();
  }
  function closeConsent() {
    document.querySelector("#consent-dialog").close();
    document.querySelector("#consent-content").replaceChildren();
    document.querySelector("#consent-title").textContent = "Calendar settings";
    document.querySelector("#consent-error").textContent = "";
    activeSubject = null;
    const opener = document.getElementById(returnFocusId);
    (opener || document.querySelector("#add-calendar"))?.focus();
  }
  function reset() {
    state = subjectTransition(state, { type:"reset" });
    document.querySelector("#filters").reset();
    document.querySelector("#question").value = "";
    document.querySelector("#event-url").value = "";
    document.querySelector("#question-status").textContent = "";
    document.querySelector("#subject-name").value = "";
    document.querySelector("#name-error").textContent = "";
    refreshResults();
    if (activeSubject) { returnFocusId = "add-calendar"; closeConsent(); }
    document.querySelector("#management-status").textContent = "Demo reset. Invitation entry, grants, selections, imports, and assessments removed.";
  }
  function init() {
    document.querySelectorAll("[data-view]").forEach(b => b.onclick = () => { document.querySelectorAll(".view").forEach(v => v.hidden = v.id !== b.dataset.view); document.querySelectorAll("[data-view]").forEach(x => x.removeAttribute("aria-current")); b.setAttribute("aria-current","page"); });
    document.querySelectorAll("[data-prompt]").forEach(b => b.onclick = () => { const p=b.dataset.prompt; document.querySelector("#question").value=b.textContent; document.querySelector("#question-status").textContent="Example selected. Explore the matching view below."; document.querySelector(`[data-view="${p === "discover" ? "discover" : p === "event" ? "event" : "weekend"}"]`).click(); });
    document.querySelector("#question").onchange = e => { if (!e.target.value.match(/family|science|exhibition|concert|sample/i)) document.querySelector("#question-status").textContent="Unsupported input: this static prototype recognizes only the example prompts; it does not understand general questions."; };
    document.querySelector("#scenario").onchange = e => {
      state = subjectTransition(state, { type:"scenario", value:e.target.value }); refreshResults();
      if (activeSubject) renderConsent();
    };
    document.querySelector("#filters").onsubmit = e => { e.preventDefault(); renderActivities(); };
    document.querySelectorAll("[data-sample-url]").forEach(b => b.onclick = () => { const key=b.dataset.sampleUrl; const value=key === "science" ? activities.find(activity => activity.id === "science").url : `https://mock.example.test/${key}`; document.querySelector("#event-url").value=value; assess(value); });
    document.querySelector("#check-url").onclick = () => assess(document.querySelector("#event-url").value);
    document.querySelector("#add-calendar").onclick = () => {
      state = subjectTransition(state, { type:"invitation", invitation:{ type:"open" } });
      document.querySelector("#invitation-email").value = "";
      renderInvitation();
      document.querySelector("#invitation-dialog").showModal();
      document.querySelector("#invitation-email").focus();
    };
    document.querySelector("#invitation-form").onsubmit = e => {
      e.preventDefault();
      const input = document.querySelector("#invitation-email");
      state = subjectTransition(state, { type:"invitation", invitation:{ type:"review", email:input.value } });
      input.value = ""; // Invalid/real input is never copied into app state or an error message.
      renderInvitation();
      document.querySelector(state.invitation.error ? "#invitation-email" : "#invitation-title").focus();
    };
    document.querySelector("#invitation-review").onclick = e => {
      const button = e.target.closest("button[data-invitation-action]");
      if (!button || button.dataset.invitationAction !== "back") return;
      state = subjectTransition(state, { type:"invitation", invitation:{ type:"back" } });
      renderInvitation(); document.querySelector("#invitation-email").focus();
    };
    document.querySelector("#close-invitation").onclick = closeInvitation;
    document.querySelector("#invitation-dialog").oncancel = closeInvitation;
    document.querySelector("#invitation-dialog").onkeydown = e => { if (e.key === "Escape") closeInvitation(e); };
    if (typeof root.addEventListener === "function") root.addEventListener("pagehide", closeInvitation);
    document.querySelector("#add-subject").onsubmit = e => {
      e.preventDefault();
      const input = document.querySelector("#subject-name"), error = validateSubjectName(input.value, state.subjects);
      document.querySelector("#name-error").textContent = error;
      if (error) { input.focus(); return; }
      state = subjectTransition(state, { type:"add", name:input.value });
      input.value = ""; refreshResults(); input.focus();
      document.querySelector("#management-status").textContent = "Fictional alias added. No invitation sent. Open Settings to try demo calendars.";
    };
    document.querySelector("#subject-list").onclick = e => {
      const button = e.target.closest("button[data-action]");
      if (!button) return;
      const id = button.dataset.subjectId, action = button.dataset.action;
      if (!state.subjects.some(s => s.id === id)) return;
      if (action === "settings") {
        activeSubject = id; returnFocusId = button.id;
        refreshResults(); renderConsent();
        document.querySelector("#consent-dialog").showModal();
        document.querySelector("#consent-title").focus();
      } else if (action === "delete") {
        const focusId = focusAfterSubjectDelete(state, id);
        state = subjectTransition(state, { type:"delete", subjectId:id });
        refreshResults();
        if (activeSubject === id) { returnFocusId = focusId; closeConsent(); }
        document.getElementById(focusId)?.focus();
        document.querySelector("#management-status").textContent = "Name and its access removed. Other names are unchanged.";
      }
    };
    document.querySelector("#consent-content").onchange = e => {
      const subject = state.subjects.find(s => s.id === activeSubject);
      if (!subject) return;
      if (e.target.id === "subject-provider") {
        state = subjectTransition(state, { type:"select-provider", subjectId:activeSubject, provider:e.target.value || null });
        refreshResults(); renderConsent(); document.querySelector("#subject-provider").focus();
        return;
      }
      const field = e.target.dataset.field;
      if (!field || !subject.provider) return;
      state = subjectTransition(state, { type:"edit", subjectId:activeSubject, id:providers[subject.provider].calendar, field,
        value:e.target.type === "checkbox" ? e.target.checked : e.target.value });
      refreshResults(); renderConsent();
      const fieldId = { selected:"choose-calendar", person:"represented-person", disclosure:"calendar-disclosure", guardian:"guardian-authority" }[field];
      if (fieldId) document.getElementById(fieldId)?.focus();
      document.querySelector("#consent-error").textContent = "Choices changed. This name's previous import is removed; review and confirm again.";
    };
    document.querySelector("#consent-content").onclick = e => {
      const button = e.target.closest("button[data-action]");
      const subject = state.subjects.find(s => s.id === activeSubject);
      if (!button || !subject?.provider) return;
      const action = button.dataset.action, p = subject.provider;
      if (action === "review") {
        const errors = validateChoices(p, subject.access.providers[p].choices);
        if (errors.length) { document.querySelector("#consent-error").textContent = errors.join(" "); return; }
      }
      const next = subjectTransition(state, { type:action, subjectId:activeSubject, summaryId:button.dataset.summaryId });
      if (next === state) { document.querySelector("#consent-error").textContent = "This summary is no longer valid. Go back and review current choices."; return; }
      state = next; refreshResults();
      if (["cancel", "deny", "confirm"].includes(action)) {
        closeConsent();
        document.querySelector("#management-status").textContent = action === "confirm"
          ? `${subject.name}: ready. Open Settings to inspect or change access.`
          : `${subject.name}: ${action === "deny" ? "permission denied" : "settings cancelled"}. Nothing new imported.`;
      } else renderConsent();
    };
    function cancelSettings(e) {
      e?.preventDefault();
      state = subjectTransition(state, { type:"cancel", subjectId:activeSubject });
      refreshResults(); closeConsent();
      document.querySelector("#management-status").textContent = "Settings closed. Nothing new imported; withdrawn access is not restored.";
    }
    document.querySelector("#close-settings").onclick = cancelSettings;
    document.querySelector("#consent-dialog").oncancel = cancelSettings;
    document.querySelector("#consent-dialog").onkeydown = e => {
      // Embedded previews do not consistently dispatch the native dialog cancel event.
      if (e.key === "Escape" && activeSubject) cancelSettings(e);
    };
    document.querySelectorAll("#reset,#footer-reset").forEach(b => b.onclick=reset);
    refreshResults();
  }
  if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", init);
  const api = { activities, filterActivities, safeHttpUrl, escapeHtml, providers, validateChoices, canConfirmImport,
    calendarCommitment, resetState, transition, authorizedChoices, disclosedEvents, availabilityMessage, scheduleContext,
    renderWeekendHtml, providerCardsHtml, consentHtml, resetSubjects, validateSubjectName, subjectTransition,
    subjectAuthorizedChoices, subjectDisclosedEvents, subjectScheduleContext, subjectStatus, subjectListHtml,
    subjectSettingsHtml, focusAfterSubjectDelete, subjectPalette, subjectColor, subjectInitials,
    resetInvitation, validateInvitationEmail, invitationTransition, invitationReviewHtml };
  if (typeof module !== "undefined") module.exports = api; else root.FamilyCopilot = api;
})(this);
