"use strict";
(function(root) {
  const Core = typeof module !== "undefined" && module.exports ? require("./conversation-core") : root.FamilyChatConversation;
  const Contract = typeof module !== "undefined" && module.exports ? require("../shared/chat-contract") : root.FamilyChatContract;
  const mounted = new WeakMap();
  const interestLabels = {
    basketball: "Basketball", baseball: "Baseball", "ping-pong": "Ping-pong", movies: "Movie",
    concerts: "Concerts", museums: "Museums", "outdoor-play": "Outdoor play", "science-discovery": "Science & discovery"
  };
  const teamLabels = { dea: "新北中信特攻", brothers: "中信兄弟" };
  const labels = {
    preparing: "Loading family members' calendars...",
    preparation_timeout: "Calendar is taking longer than expected. You can update suggestions independently.",
    not_started: "", loading: "Finding activities that match your family's interests...",
    checking_calendar: "Checking activity times against your calendars...",
    checking_meeting: "Checking both parents' calendars for the school meeting...",
    sending_demo_invitation: "Preparing Mike's invitation...",
    calendar_changed: "Calendar check expired or changed. Check again before continuing.",
    results: "", unknown: "",
    empty: "No matching activities found.", partial: "The search is incomplete.",
    unavailable: "Activity sources are unavailable.", search_unavailable: "Search unavailable. Retry when ready.",
    invalid_result: "The activity response could not be verified.", request_timeout: "Search timed out. No automatic retry.",
    paused: "Stopped.", ready: "Ready.",
    preferences_updated: "Preferences applied. Previous suggestions retired.",
    needs_clarification: "Enter a non-empty message of up to 500 characters.", retry_required: "Retry this request before continuing.",
    demo_complete: "This conversation's supported requests are complete. Start a new conversation to begin again.",
    budget_exhausted: "This session's search limit is reached. Start a new conversation.",
    message_limit: "This conversation is full. Start a new conversation.", ended: "Session ended. Reload to begin again."
  };
  const actionLabels = {
    load_calendars: "Load family members' calendars", search_saved_activities: "Find activities that match your family's interests",
    compare_activity_times: "Compare activity times with calendars", check_school_meeting: "Check both parents' calendars for the school meeting",
    send_demo_invitation: "Prepare Mike's invitation"
  };
  function mountChat(document, { calendar = null, activities = null, lifecycle = root } = {}) {
    if (mounted.has(document)) return mounted.get(document);
    const get = id => document.getElementById(id);
    const ids = ["chat-page", "calendar-host", "calendar-connection", "calendar-conversation", "calendar-introduction", "activity-connection",
      "chat-progress", "chat-retry", "chat-reset", "chat-options", "chat-options-toggle", "chat-status", "chat-opening", "chat-messages", "calendar-assessment", "activity-results", "chat-composer", "chat-input", "chat-send",
      "preferences-edit", "interests-edit", "teams-edit", "team-dea", "team-brothers", "preference-other-teams", "preference-add-team", "preference-custom-teams", "preference-other-interests", "preferences-editor", "preferences-apply", "preferences-cancel", "preferences-error",
      "preference-age", "preference-area", "preference-age-summary", "preference-area-summary", "preference-place-summary", "preference-interests-summary", "preference-teams-summary",
      ...Object.keys(interestLabels).map(value => `interest-${value}`)];
    const elements = Object.fromEntries(ids.map(id => [id, get(id)]));
    if (Object.values(elements).some(value => !value)) throw Error("chat_host_missing");
    const node = id => elements[id];
    let calendarController = null, cards = null, renderedId = null, core = null, closed = false, disposal = null;
    const removers = [];
    let preferenceOpener = "preferences-edit";
    let draftTeams = [], teamRemovers = [];
    function renderDraftTeams() {
      teamRemovers.splice(0).forEach(remove => remove());
      node("preference-custom-teams").replaceChildren(...draftTeams.map(team => {
        const item = document.createElement("li"), name = document.createElement("span"), remove = document.createElement("button");
        name.textContent = team; remove.textContent = "Remove";
        remove.setAttribute("type", "button"); remove.setAttribute("aria-label", `Remove ${team}`);
        remove.setAttribute("title", `Remove ${team}`);
        const discard = () => {
          draftTeams = draftTeams.filter(value => value !== team); renderDraftTeams();
          node("preference-other-teams").focus();
        };
        remove.addEventListener("click", discard);
        teamRemovers.push(() => remove.removeEventListener("click", discard));
        item.append(name, remove); return item;
      }));
    }
    function selectedTeams() {
      const extra = node("preference-other-teams").value.split(",").map(value => value.trim()).filter(Boolean);
      return [...new Map([...Object.entries(teamLabels).filter(([value]) => node(`team-${value}`).checked).map(([, label]) => label), ...draftTeams, ...extra]
        .map(value => [value.toLowerCase(), value])).values()];
    }
    function listen(target, name, callback) {
      target.addEventListener(name, callback); removers.push(() => target.removeEventListener(name, callback));
    }
    function measureComposer() {
      if (closed || typeof node("chat-composer").getBoundingClientRect !== "function" ||
          typeof node("chat-page").style?.setProperty !== "function") return;
      const viewport = lifecycle.visualViewport;
      const offset = viewport && Number.isFinite(lifecycle.innerHeight) ?
        Math.max(0, lifecycle.innerHeight - viewport.height - viewport.offsetTop) : 0;
      const height = node("chat-composer").getBoundingClientRect().height;
      if (Number.isFinite(height)) node("chat-page").style.setProperty("--composer-height", `${Math.ceil(height)}px`);
      if (Number.isFinite(offset)) node("chat-page").style.setProperty("--keyboard-offset", `${Math.ceil(offset)}px`);
    }
    if (lifecycle && typeof lifecycle.addEventListener === "function") {
      listen(lifecycle, "resize", measureComposer);
      if (lifecycle.visualViewport) {
        listen(lifecycle.visualViewport, "resize", measureComposer);
        listen(lifecycle.visualViewport, "scroll", measureComposer);
      }
      if (typeof lifecycle.ResizeObserver === "function") {
        const observer = new lifecycle.ResizeObserver(measureComposer);
        observer.observe(node("chat-composer"), { box: "border-box" }); removers.push(() => observer.disconnect());
      }
    }
    listen(node("chat-input"), "input", measureComposer);
    measureComposer();
    function clearCards() {
      if (cards) { cards.dispose(); cards = null; }
      renderedId = null;
      node("activity-results").replaceChildren();
    }
    function renderAssessment(state) {
      const host = node("calendar-assessment"), assessment = state.calendarAssessment;
      host.replaceChildren(); host.hidden = !assessment || !state.result;
      node("activity-results").className = host.hidden ? "" : "calendar-assessed";
      if (host.hidden) return;
      const heading = document.createElement("h2"); heading.textContent = "Calendar check";
      const summary = document.createElement("p");
      const scope = document.createElement("p");
      const localDate = instant => new Date(Date.parse(instant) + 8 * 3600000).toISOString().slice(0, 10);
      const lastDate = localDate(new Date(Date.parse(assessment.coverage.endAt) - 1).toISOString());
      scope.textContent = `Calendars: ${localDate(assessment.coverage.startAt)} to ${lastDate} / Taipei. Event times only; travel is not included.`;
      const outside = state.result.range.startDate < localDate(assessment.coverage.startAt) || state.result.range.endDate > lastDate;
      if (outside) {
        scope.textContent += " Requested dates are outside the loaded October calendar range.";
      }
      summary.textContent = outside ? "Calendar not checked for this weekend" :
        assessment.items.some(item => item.status === "unknown") ? "Calendar fit not confirmed" :
        "Calendar times compared; travel not checked";
      const checked = document.createElement("p");
      checked.textContent = `Compared locally at ${assessment.checkedAt}. No busy block reported is not a guarantee of availability.`;
      const list = document.createElement("ul");
      const explanations = { no_busy_reported: "No overlapping busy time in the loaded calendars.",
        incomplete: "Cannot confirm: some calendar information is missing.",
        outside_coverage: "Cannot confirm: outside the loaded October calendar range.",
        unavailable: "Cannot confirm: calendars have not loaded or are unavailable.",
        stale: "Cannot confirm: the calendar snapshot is out of date.",
        invalid_timing: "Cannot confirm: the activity time is incomplete." };
      for (const item of state.result.items) {
        const entry = assessment.items.find(entry => entry.id === Contract.activityCardId(item));
        const row = document.createElement("li");
        row.textContent = `${item.title}: ${explanations[entry?.reason] || explanations.unavailable}`;
        list.append(row);
      }
      const details = document.createElement("details"), disclosure = document.createElement("summary");
      disclosure.textContent = "Calendar check details";
      details.append(disclosure, scope, checked, list);
      host.append(heading, summary, details);
      const excluded = assessment.items.filter(item => item.status === "conflict").length;
      if (excluded) {
        const notice = document.createElement("p");
        notice.textContent = `${excluded} conflicting option${excluded === 1 ? "" : "s"} excluded.`;
        host.append(notice);
      }
    }
    function closePreferences(restoreFocus = true) {
      node("preferences-editor").hidden = true;
      node("preferences-edit").setAttribute("aria-expanded", "false");
      node("interests-edit").setAttribute("aria-expanded", "false");
      node("teams-edit").setAttribute("aria-expanded", "false");
      node("preferences-error").hidden = true;
      node("preference-age").value = ""; node("preference-area").value = "";
      node("preference-other-interests").value = "";
      node("preference-other-teams").value = "";
      draftTeams = []; renderDraftTeams();
      for (const value of Object.keys(teamLabels)) node(`team-${value}`).checked = false;
      for (const value of Object.keys(interestLabels)) node(`interest-${value}`).checked = false;
      if (restoreFocus) node(preferenceOpener).focus();
    }
    function render(state) {
      const isActive = state.context.triggerState === "active";
      node("chat-page").setAttribute("data-conversation", state.messages.length ? "started" : "idle");
      const preparing = state.status === "preparing";
      const busy = state.processingActions.length > 0;
      node("chat-page").setAttribute("data-processing", String(busy));
      node("activity-results").setAttribute("aria-busy", String(busy));
      const focused = document.activeElement;
      node("calendar-conversation").hidden = state.context.triggerState === "not_started";
      node("calendar-introduction").textContent = preparing ? labels.preparing :
        state.meetingState ? "Debby, let's check your school meeting against the loaded October calendars." :
        "Let me check your October calendar and find some ideas.";
      const preferences = state.context.preferences;
      node("preferences-edit").disabled = closed;
      node("interests-edit").disabled = closed;
      node("teams-edit").disabled = closed;
      node("preference-age-summary").textContent = `(${preferences.ages[0]})`;
      node("preference-teams-summary").replaceChildren(...(preferences.preferredTeams.length ? preferences.preferredTeams : ["No preference"]).map(value => {
        const item = document.createElement("li");
        item.className = `interest-tag${value === teamLabels.brothers ? " interest-baseball" : ""}`;
        item.textContent = value;
        return item;
      }));
      node("preference-age-summary").setAttribute("aria-label", `Age ${preferences.ages[0]}`);
      node("preference-area-summary").textContent = preferences.origin.area === "Xinyi District, Taipei City" ? "Xinyi, Taipei" : preferences.origin.area;
      node("preference-place-summary").hidden = preferences.origin.area !== "Xinyi District, Taipei City";
      node("preference-interests-summary").replaceChildren(...preferences.interests.map(value => {
        const item = document.createElement("li");
        item.className = `interest-tag${Object.hasOwn(interestLabels, value) ? ` interest-${value}` : ""}`;
        item.textContent = interestLabels[value] || value;
        return item;
      }));
      const snapshotNeedsChecking = state.status === "partial" && state.result?.items.length > 0 &&
        state.result.sources.every(source => source.kind === "public_snapshot") &&
        state.result.issues.every(issue => ["scope_incomplete", "candidate_limit"].includes(issue.code));
      node("chat-retry").disabled = closed || !isActive || busy || !!state.meetingState || state.demoStep === 0 || state.dispatched >= 3 || snapshotNeedsChecking;
      node("chat-retry").hidden = node("chat-retry").disabled || !["preparation_timeout", "partial", "unavailable", "search_unavailable",
        "invalid_result", "request_timeout", "retry_required", "preferences_updated", "calendar_changed"].includes(state.status);
      node("chat-retry").textContent = state.status === "preferences_updated" ? "Show suggestions" : "Retry";
      node("chat-reset").disabled = closed || state.context.triggerState === "not_started" && state.messages.length === 0;
      node("chat-options").hidden = node("chat-reset").disabled;
      if (node("chat-options").hidden) node("chat-options").open = false;
      node("chat-input").placeholder = "Message Family Copilot...";
      node("chat-input").disabled = closed || !["not_started", "active", "paused"].includes(state.context.triggerState) || busy || !state.meetingState && state.messages.length > 16;
      node("chat-send").disabled = node("chat-input").disabled;
      node("chat-status").textContent = labels[state.status] ?? "Activity status unavailable.";
      node("chat-status").hidden = state.status === "not_started" || state.status === "results" || snapshotNeedsChecking;
      node("chat-progress").replaceChildren(...state.processingActions.slice(1).map(action => {
        const item = document.createElement("li"); item.textContent = `Next: ${actionLabels[action]}`; return item;
      }));
      node("chat-progress").hidden = state.processingActions.length < 2;
      if (!closed && (focused === node("chat-status") && !busy || focused === node("chat-retry") && focused.hidden)) {
        (busy ? node("chat-status") : node("chat-input").disabled ? node("chat-options-toggle") : node("chat-input")).focus();
      }
      const messages = state.messages.map(message => {
        const item = document.createElement("li"), speaker = document.createElement("span"), text = document.createElement("p");
        item.className = `message message-${message.role}`;
        speaker.className = "speaker"; speaker.textContent = message.role === "parent" ? "You" : "Family Copilot";
        text.textContent = message.text; item.append(speaker, text); return item;
      });
      const hasOpening = state.messages[0]?.role === "parent";
      node("chat-opening").replaceChildren(...(hasOpening ? messages.slice(0, 1) : []));
      node("chat-messages").replaceChildren(...messages.slice(hasOpening ? 1 : 0));
      renderAssessment(state);
      const nextId = state.result ? state.result.requestId : null;
      if (nextId !== renderedId) {
        clearCards();
        if (state.result) {
          try {
            cards = activities.renderActivityCards(node("activity-results"), state.result);
            if (!cards || typeof cards.dispose !== "function") throw Error("invalid_renderer");
            renderedId = nextId;
          } catch {
            cards = null; node("activity-results").replaceChildren();
            node("chat-status").hidden = false;
            node("chat-status").textContent = "Activity cards could not be displayed.";
          }
        }
      }
    }
    if (calendar && typeof calendar.mountCalendar === "function") {
      try {
        calendarController = calendar.mountCalendar(node("calendar-host"), { version: "familycopilot.chat.v1", mode: "synthetic" });
        node("calendar-connection").hidden = true;
      } catch { node("calendar-connection").textContent = "Calendar component unavailable."; }
    }
    if (activities && typeof activities.searchActivities === "function" && typeof activities.renderActivityCards === "function") {
      node("activity-connection").hidden = true;
      core = Core.createConversation({ searchActivities: (request, options) => activities.searchActivities(request, options), onChange: render,
        coordinateMeeting: typeof calendarController?.coordinateMeeting === "function" ? action => calendarController.coordinateMeeting(action) : null,
        assessActivities: typeof calendarController?.assessOccurrences === "function" ? occurrences => calendarController.assessOccurrences(occurrences) : null,
        prepareSession: typeof calendarController?.loadSynthetic === "function" ? () => calendarController.loadSynthetic() : null });
      if (typeof calendarController?.subscribeAssessment === "function") {
        removers.push(calendarController.subscribeAssessment(() => core.calendarChanged()));
      }
      if (typeof calendarController?.subscribeMeetingReview === "function") {
        removers.push(calendarController.subscribeMeetingReview(() => {
          core.reviewMeeting();
          if (!node("chat-input").disabled) node("chat-input").focus();
          node("chat-messages").lastElementChild?.scrollIntoView?.({ block: "center" });
        }));
      }
      render(core.snapshot());
      closePreferences(false);
      for (const opener of ["preferences-edit", "interests-edit", "teams-edit"]) listen(node(opener), "click", () => {
        preferenceOpener = opener;
        if (!node("preferences-editor").hidden) { closePreferences(); return; }
        const preferences = core.snapshot().context.preferences;
        node("preference-age").value = String(preferences.ages[0]); node("preference-area").value = preferences.origin.area;
        for (const value of Object.keys(interestLabels)) node(`interest-${value}`).checked = preferences.interests.includes(value);
        node("preference-other-interests").value = preferences.interests.filter(value => !Object.hasOwn(interestLabels, value)).join(", ");
        for (const [value, label] of Object.entries(teamLabels)) node(`team-${value}`).checked = preferences.preferredTeams.includes(label);
        draftTeams = preferences.preferredTeams.filter(value => !Object.values(teamLabels).includes(value));
        node("preference-other-teams").value = ""; renderDraftTeams();
        node("preferences-editor").hidden = false;
        node("preferences-edit").setAttribute("aria-expanded", "true");
        node("interests-edit").setAttribute("aria-expanded", "true");
        node("teams-edit").setAttribute("aria-expanded", "true");
        node(opener === "teams-edit" ? "team-dea" : opener === "interests-edit" ? "preference-other-interests" : "preference-age").focus();
      });
      listen(node("preferences-cancel"), "click", () => closePreferences());
      function addTeam() {
        if (!node("preference-other-teams").value.trim()) { node("preference-other-teams").focus(); return; }
        const context = core.snapshot().context, teams = selectedTeams();
        if (!Contract.validateDemoContext({ ...context, preferences: { ...context.preferences, preferredTeams: teams } })) {
          node("preferences-error").textContent = "Use up to 16 teams, with 1-120 characters per name. Control characters are not allowed.";
          node("preferences-error").hidden = false; node("preferences-error").focus(); return;
        }
        for (const [value, label] of Object.entries(teamLabels)) node(`team-${value}`).checked = teams.includes(label);
        draftTeams = teams.filter(value => !Object.values(teamLabels).includes(value));
        node("preference-other-teams").value = ""; node("preferences-error").hidden = true;
        renderDraftTeams(); node("preference-other-teams").focus();
      }
      listen(node("preference-add-team"), "click", addTeam);
      listen(node("preference-other-teams"), "keydown", event => {
        if (event.key !== "Enter" || event.isComposing || event.keyCode === 229) return;
        event.preventDefault(); if (!event.repeat) addTeam();
      });
      listen(node("preferences-editor"), "keydown", event => {
        if (event.key === "Escape") { event.preventDefault(); closePreferences(); }
      });
      listen(node("preferences-editor"), "submit", event => {
        event.preventDefault();
        const preferences = core.snapshot().context.preferences;
        const age = node("preference-age").value;
        preferences.ages = [/^\d+$/.test(age) ? Number(age) : NaN];
        preferences.origin.area = node("preference-area").value.trim();
        const extra = node("preference-other-interests").value.split(",").map(value => value.trim()).filter(Boolean)
          .map(value => Object.keys(interestLabels).find(key => key === value.toLowerCase() || interestLabels[key].toLowerCase() === value.toLowerCase()) || value);
        preferences.interests = [...new Map([...Object.keys(interestLabels).filter(value => node(`interest-${value}`).checked), ...extra]
          .map(value => [value.toLowerCase(), value])).values()];
        preferences.preferredTeams = selectedTeams();
        if (!core.applyPreferences(preferences)) {
          node("preferences-error").textContent = "Use age 0-120, an area of 1-120 characters, up to 12 comma-separated interests of 1-40 characters each, and up to 16 comma-separated teams of 1-120 characters each. Control characters are not allowed.";
          node("preferences-error").hidden = false; node("preferences-error").focus(); return;
        }
        closePreferences();
      });
      listen(node("chat-retry"), "click", () => { void core.retry(); });
      listen(node("chat-options"), "keydown", event => {
        if (event.key === "Escape") { event.preventDefault(); node("chat-options").open = false; node("chat-options-toggle").focus(); }
      });
      listen(node("chat-reset"), "click", () => { closePreferences(false); calendarController?.resetProposal?.(); core.reset(); node("chat-input").value = ""; node("chat-input").focus(); });
      function submitMessage(event) {
        event.preventDefault();
        if (node("chat-input").disabled) return;
        const text = node("chat-input").value; node("chat-input").value = "";
        if (!text.trim()) { node("chat-input").focus(); return; }
        if (core.snapshot().context.triggerState === "paused") core.resume();
        void core.submit(text);
        (node("chat-input").disabled ? node("chat-status") : node("chat-input")).focus();
        if (core.snapshot().meetingState) node("chat-messages").lastElementChild?.scrollIntoView?.({ block: "center" });
      }
      listen(node("chat-composer"), "submit", submitMessage);
      listen(node("chat-input"), "keydown", event => {
        if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey ||
            event.isComposing || event.keyCode === 229 || event.defaultPrevented) return;
        if (event.repeat) { event.preventDefault(); return; }
        submitMessage(event);
      });
    } else {
      for (const id of ["chat-retry", "chat-reset", "chat-input", "chat-send", "preferences-edit", "interests-edit", "teams-edit"]) node(id).disabled = true;
      listen(node("chat-composer"), "submit", event => event.preventDefault());
    }
    function stopLocal() {
      if (closed) return;
      closed = true;
      if (core) core.dispose();
      closePreferences(false);
      clearCards(); node("chat-input").value = "";
      removers.splice(0).forEach(remove => remove());
    }
    if (lifecycle && typeof lifecycle.addEventListener === "function") listen(lifecycle, "pagehide", stopLocal);
    const controller = Object.freeze({
      dispose() {
        if (disposal) return disposal;
        stopLocal();
        disposal = Promise.resolve().then(() => calendarController ? calendarController.dispose() : undefined).catch(() => {
          node("calendar-connection").hidden = false;
          node("calendar-connection").textContent = "Calendar cleanup could not be confirmed.";
          throw Error("calendar_cleanup_unconfirmed");
        });
        return disposal;
      }
    });
    mounted.set(document, controller);
    return controller;
  }
  const api = Object.freeze({ mountChat });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else {
    root.FamilyChatUI = api;
    if (root.document) mountChat(root.document, { calendar: root.FamilyChatCalendar, activities: root.FamilyChatActivities });
  }
})(globalThis);