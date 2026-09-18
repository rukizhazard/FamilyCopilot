"use strict";
(() => {
  const A = globalThis.OwnerAvailability, $ = id => document.getElementById(id);
  const csrf = document.querySelector('meta[name="owner-csrf"]').content;
  const synthetic = document.querySelector('meta[name="owner-mode"]').content === "synthetic";
  const disk = document.querySelector('meta[name="owner-cache"]')?.content === "disk";
  const childCacheAvailable = ["child-saved-v1-disk", "child-saved-v1-memory"].includes(document.querySelector('meta[name="child-cache"]')?.content);
  const configurable = document.querySelector('meta[name="owner-range"]')?.content === "configurable-v1" &&
    document.querySelector('meta[name="owner-saved"]')?.content === "preserve-v1" &&
    document.querySelector('meta[name="owner-contract"]')?.content === "bounded-availability-v5";
  const childSyncAvailable = configurable && childCacheAvailable &&
    document.querySelector('meta[name="child-sync"]')?.content === "child-sync-v1" &&
    document.querySelector('meta[name="child-mode"]')?.content === (synthetic ? "synthetic" : "kimi-calendar-v1");
  const people = A.displayPeople(synthetic), names = people.map(p => p.alias);
  let state = A.initial(), controller, pending = false, blocked = false, storageBlocked = false, sessionRejected = false, globalClearing = false;
  // selectedWindow is the actual request/validation scope. Neither the dates-only
  // selection nor the clipped display window may relabel a response or snapshot.
  let selectedWindow, dateSelection, visibleWindow, confirmed = false, rangeClearing = false;
  let dateRevision = 0, childGeneration = 0, child = null, childLifecycle = "idle", childBlocked = !configurable, childTimer;
  const childExpires = Date.now() + 30 * 60000;
  const childName = synthetic ? "Kimi (sample)" : "Kimi";
  // Page-local DOM renderer only: the child owns names and returns no data.
  // Independent of action coordination and the strictly title-free event bridge.
  let childRenderer, gridPositioned = false;
  globalThis.FamilyWeekRenderer = Object.freeze({ register(renderer) {
    if (childRenderer || typeof renderer !== "function") throw new Error("Invalid week renderer");
    childRenderer = renderer;
  } });
  // Private page-only action seam, separate from the title-free display bridge.
  // Callbacks expose saved viewing, optional remembered-source Sync and lifecycle;
  // only fixed decisions/booleans cross here, never calendar or source data.
  let childActions, sharedActive = false, actionRevision = 0, childWorking = false, childActionBlocked = false;
  const canContinue = version => version === actionRevision && !blocked && !storageBlocked && !sessionRejected &&
    !childActionBlocked && !rangeClearing && Date.now() < childExpires;
  function fenceActions() { actionRevision++; }
  globalThis.FamilyWeekActions = Object.freeze({
    register(actions) {
      if (childActions || !actions || !["release,saved", ...(childSyncAvailable ? ["release,saved,sync"] : [])].includes(Object.keys(actions).sort().join()) ||
        Object.values(actions).some(value => typeof value !== "function")) throw new Error("Invalid week action interface");
      childActions = Object.freeze(actions);
      return Object.freeze({ changed(value) {
        if (!value || Object.keys(value).sort().join() !== "blocked,expired,pending" ||
          Object.values(value).some(v => typeof v !== "boolean")) return;
        childWorking = value.pending;
        childActionBlocked = value.blocked || value.expired;
        if (childActionBlocked) actionRevision++;
        if (value.expired && !sessionRejected) {
          sessionRejected = true;
          state = A.transition(state, { type: "clear" }); controller?.abort();
          hideChild("expired"); failure({ status: "expired" });
        }
        render();
      } });
    }
  });
  const parentLoaded = () => state.phase === "loaded" && !!state.data && !blocked && !storageBlocked && !sessionRejected;
  const childLoaded = () => child?.lifecycle === "loaded" && !childBlocked && Date.now() < childExpires && !!selectedWindow &&
    child.window.start === selectedWindow.start && child.window.end === selectedWindow.end;
  function safety(pendingRange = rangeClearing) {
    window.dispatchEvent(new CustomEvent("week-safety-changed", { detail: {
      version: 1, revision: dateRevision, pending: pendingRange, blocked: childBlocked, expired: sessionRejected
    } }));
  }
  function hideChild(lifecycle = "cleared") {
    child = null; childLifecycle = lifecycle; clearTimeout(childTimer);
  }
  const unsupported = () => selectedWindow && (!synthetic || disk) &&
    (selectedWindow.start !== A.liveWindow.start || selectedWindow.end !== A.liveWindow.end);
  const rangeMessage = "This calendar demo supports 9–15 October 2026 only. Nothing loaded; other dates still work for Activities. Earlier saved dates are kept, never shifted into October.";
  const dates = globalThis.FamilyDates.createStore();
  const restoredDates = dates.read();
  // Our week starts unselected; Activities keeps its own existing default.
  // Explicit remembered choices still survive navigation/reload.
  dateSelection = restoredDates.status === "default" ? null : restoredDates.window;
  selectedWindow = A.calendarWindow(dateSelection);
  visibleWindow = A.displayWindow(dateSelection);
  $("availability-start").value = dateSelection ? A.slotTime(0, dateSelection).date : "";
  $("availability-end").value = dateSelection ? A.slotTime(dateSelection.slots - 1, dateSelection).date : "";
  if (!selectedWindow && restoredDates.status !== "default") {
    $("availability-date-error").hidden = false;
    $("availability-date-error").textContent = "Remembered dates are invalid or unavailable. Choose valid dates again; nothing has loaded.";
    for (const id of ["availability-start", "availability-end"]) $(id).setAttribute("aria-invalid", "true");
  }
  // Refuse navigation with an obsolete selection if this tab cannot save edits.
  document.addEventListener("click", event => {
    if (!event.target.closest?.('a[href="/activities"]')) return;
    if (!dates.write($("availability-start").value, $("availability-end").value)) {
      event.preventDefault();
      $("availability-date-sharing").textContent = "Cannot remember dates in this tab. Allow session storage before opening Activities; no earlier dates will be used.";
      status("Dates could not be shared. Stay here and try again.", true);
    }
  });
  $("availability-range-support").textContent = !configurable
    ? "Calendar access needs an update. Ask the person who set up this page for help, then reload. Nothing will load here yet."
    : synthetic ? "Sample dates only · No real calendars queried."
      : "Calendars are available for 9–15 October 2026. Other dates still work for Activities.";
  // Also label pages served by an older running backend. No load or cache read.
  document.title = synthetic ? "Family Copilot · SAMPLE calendars" : "Family Copilot · Our week";
  $("owner-source-row").hidden = !synthetic;
  $("owner-source-badge").textContent = synthetic ? "SAMPLE DATA" : "";
  $("owner-source-notice").textContent = synthetic
    ? "Sample data—not real calendars. Synthetic browser review only; no Microsoft/Azure requests. For your owner calendars, open http://localhost:8002/ and review access there."
    : "Local owner calendars · Nothing loads until you review access and ask. Cached results are not a fresh provider check.";
  $("availability-grid-source").textContent = synthetic
    ? "Sample data—not real calendars. Repeating half-hour statuses are test fixtures, not family commitments. Unknown is unavailable test context, never free time."
    : "Owner calendar view · Only explicitly loaded default-calendar statuses are shown. Check source, missing context and last updated above.";
  $("availability-retention").textContent = disk
    ? "Confirm opens a matching saved view if one exists; otherwise it checks the calendars once. Update checks again, without falling back to older results if it fails. A saved view survives closing or restarting the app and changing dates. It stays until replaced by a successful update, deleted with Clear, or removed because access changed or an update could not finish safely. The app must be running to open it. Saved views do not recheck Outlook permissions."
    : "Confirm opens a matching saved view if one exists; otherwise it checks the calendars once. Update checks again. This view is kept in memory only: restarting the app removes it; reloading the page does not. Saved views do not recheck Outlook permissions.";
  $("availability-storage").textContent = disk
    ? "Parent busy times, their dates and original last-updated time are saved privately on this device, with information that ties the saved view to this setup. No sign-in credentials or event details are saved. Clear deletes this saved view, not backups, other open pages or Azure history; it is not secure erase. Kimi is never saved in this file."
    : "Parent busy times, their dates and original last-updated time stay in memory only. No calendar file or browser storage is used. Restarting the app removes them. Sample calendars never use your saved calendar data.";
  $("availability-identity").textContent = synthetic
    ? "SYNTHETIC ONLY · Mike (sample) = fictional Alex; Debby (sample) = fictional Sam. No real identities or Azure calls."
    : "Display labels: Mike = Mike Lee; Debby = Debby. These labels do not establish identity, parent relationships or guardian authority. The protected targets and existing owner authorization are unchanged.";
  $("availability-targets").textContent = names.join(" + ") + " · Default calendars · Busy-only";
  $("availability-source").textContent = synthetic
    ? "Sample data · Not real calendars"
    : "Outlook · Default calendars only";
  if (!childCacheAvailable) $("availability-saved-help").textContent = "This backend supports parent-only controls: Mike + Debby, busy-only, for the load scope above. View saved only never queries on a miss. Kimi saved viewing and saved-data deletion need a safe backend update; Clear here confirms parent deletion only. Reload alone cannot update the backend.";
  if (childSyncAvailable) {
    $("availability-saved-help").textContent = "Sync first opens a matching Kimi saved view or checks its remembered source, then loads Mike + Debby busy times. Later Sync checks Kimi first, then parents again. A missing source stays unknown; no source is selected automatically. View saved only never queries Outlook, even on a miss. Clear deletes both saved views and the remembered source.";
    $("child-event-help").textContent = "Our week shows consented event names, times and reported status. Private and Busy-only events stay unnamed. Events are not verified Busy slots; gaps are unknown. Sync uses only the previously confirmed remembered source; no new source import or setup is available here.";
  }
  const node = (tag, className, text) => {
    const element = document.createElement(tag); element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  function status(text, urgent = false, detailsOnly = false) {
    // Only explicitly routine outcomes move to Details; errors default visible.
    const hidden = detailsOnly && !urgent;
    if (hidden && document.activeElement === $("availability-status")) $("availability-clear").focus();
    $("availability-status").textContent = text;
    $("availability-status").dataset.urgent = String(urgent);
    $("availability-status").hidden = hidden;
    $("availability-status-details").textContent = hidden ? text : "";
    $("availability-status-details").hidden = !hidden || !text;
  }
  function sharingText() {
    return dateSelection
      ? `Activities selected dates: ${A.slotTime(0, dateSelection).date} through ${A.slotTime(dateSelection.slots - 1, dateSelection).date}, inclusive. Only these dates are remembered in this tab; no names, ages or calendar statuses are shared. Previous/Next do not change Activities dates.`
      : "Choose valid dates for Activities. No calendar access is needed.";
  }
  $("availability-date-sharing").textContent = sharingText();
  // Presentation only: fixed, parent-facing messages replace diagnostics. They
  // never authorize a retry or change the existing fail-closed state machine.
  function failure(data) {
    if (blocked) return status(`Updating paused.${storageBlocked ? " Saved view wasn’t cleared." : ""} Get help in Details.`, true);
    if (storageBlocked) return status(data?.status === "cache_clear_failed"
      ? "Couldn’t clear the saved view. Try Clear; if it fails again, get help in Details."
      : "Can’t open the saved view. Try Clear; if it fails, get help in Details.", true);
    if (A.sessionUnavailable(data) || sessionRejected) return status("Page expired. Reload page to continue.", true);
    const messages = {
      range_unavailable: rangeMessage,
      cache_missing: "No saved view exists for these dates. No calendars queried. Confirm can request supported dates when you choose; missing schedules remain unknown.",
      expired: "Can’t connect to the calendars. Get help in Details.",
      contract_drift: "Calendar access needs checking. Get help in Details.",
      revoked: "Calendar access changed. Get help in Details.",
      blocked: "Can’t open this week. Reload page; if it still fails, get help in Details.",
      busy: "Another update is running. Try Sync when it finishes.",
      cancelled: "Update cancelled. Schedules aren’t available."
    };
    status(Object.hasOwn(messages, data?.status) ? messages[data.status]
      : ["workflow_disabled", "not_requested"].includes(data?.cleanup)
        ? "Couldn’t load the week. Try Sync once."
        : "Couldn’t load the week. Get help in Details before trying again.", true);
  }
  // Presentation only: a view with no loaded data is not an all-Unknown schedule.
  // Existing status/cleanup messages remain the authority for recovery actions.
  function renderWeekPresentation() {
    const showWeek = !!selectedWindow && !unsupported() && (parentLoaded() || childLoaded());
    $("availability-surface").dataset.loaded = String(showWeek);
    $("availability-grid").hidden = !showWeek;
    $("availability-legend").hidden = !showWeek;
    $("availability-empty").hidden = showWeek;
    $("availability-empty").setAttribute("aria-busy", String(state.phase === "loading"));
    if (showWeek) return true;
    gridPositioned = false;
    $("availability-grid").replaceChildren();
    const phase = !configurable || blocked || storageBlocked || sessionRejected ? "blocked"
      : !selectedWindow ? "invalid" : unsupported() ? "unsupported"
        : state.phase === "loading" ? "loading" : state.phase === "cleared" ? "cleared"
          : state.phase === "unavailable" || $("availability-status").dataset.urgent === "true" ? "unavailable" : "idle";
    const messages = {
      idle: ["Your week, at a glance", "Choose your dates, then select Sync."],
      loading: [synthetic ? "Loading your sample week…" : "Loading your week…", "The calendar load scope shown above is being loaded. Only the displayed days will appear here when the request finishes successfully."],
      invalid: ["Choose dates for your week", "Select a valid range of 1–7 days above before loading calendars."],
      unsupported: ["These dates aren’t supported for calendars", "See the supported dates above. You can still explore Activities for your chosen dates without calendar access."],
      unavailable: ["No calendar view to show", "See the message above for what happened and the next step. No results are shown here."],
      cleared: ["Calendar view hidden", "See the status above for the outcome of clearing or closing this view."],
      blocked: ["Calendar view unavailable", "See the message above and Details for the next step. No results are shown here."]
    };
    $("availability-empty").dataset.state = phase;
    $("availability-empty-title").textContent = messages[phase][0];
    $("availability-empty-description").textContent = messages[phase][1];
    return false;
  }
  function renderPeople() {
    for (const [index, name] of [...names, childName].entries()) {
      const button = $("calendar-person-" + index);
      if (!button) continue;
      const loaded = !!selectedWindow && !unsupported() && (index === 2 ? childLoaded() : parentLoaded());
      const person = index < 2 && loaded ? state.data.people[index] : null;
      const available = loaded && (index === 2 || ["checked", "partial"].includes(person?.status));
      const loading = index === 2 ? childWorking || childLifecycle === "loading" : state.phase === "loading";
      const partial = available && (index === 2 ? child.partial : person.status === "partial");
      const failed = index === 2 ? childBlocked || childActionBlocked || ["unavailable", "expired"].includes(childLifecycle)
        : blocked || storageBlocked || sessionRejected || state.phase === "unavailable" || loaded && !available;
      const label = available ? ["Loaded", partial && "Partial"].filter(Boolean).join(" · ")
        : loading ? "Loading…" : failed ? "Unavailable" : "Not loaded";
      // Quiet idle/ready labels; uncertainty remains explicit, not color-only.
      button.textContent = name + (partial ? " · Partial" : available ? " ✓" : loading ? " · Syncing" : failed ? " · Unavailable" : "");
      button.dataset.loaded = String(available);
      button.disabled = !available;
      button.setAttribute("aria-label", `${name} · ${label}${available ? " · Show calendar" : ""}`);
      button.title = `${name} · ${label}`;
    }
  }
  for (const index of [0, 1, 2]) $("calendar-person-" + index)?.addEventListener("click", () => {
    if (!$("availability-grid").hidden) $("availability-grid").focus();
  });
  $("availability-grid").addEventListener("keydown", event => {
    const grid = $("availability-grid");
    if (event.target !== grid || !["Home", "End"].includes(event.key)) return;
    event.preventDefault();
    grid.scrollTop = event.key === "Home" ? 0 : grid.scrollHeight;
  });
  // Explicitly cosmetic demo roster: no calendar state, requests, storage or
  // consent changes. The real status buttons keep their existing bindings.
  if ($("member-add")) {
    const removed = new Set(), extras = [];
    const labels = ["Mike", "Debby", "Kimi"];
    const key = value => value.toLocaleLowerCase("en-US");
    const message = value => {
      $("member-message").textContent = value;
      $("member-message").hidden = !value;
    };
    const close = () => {
      $("member-editor").hidden = true;
      $("member-add").setAttribute("aria-expanded", "false");
      $("member-name").value = "";
      $("member-name").setAttribute("aria-invalid", "false");
      $("member-add").focus();
    };
    const roster = () => {
      for (const index of [0, 1, 2]) $("member-row-" + index).hidden = removed.has(index);
      $("member-demo-list").replaceChildren();
      for (const name of extras) {
        const chip = node("span", "member-chip member-sample");
        const label = node("span", "member-demo-label", `${name} · Demo`);
        const remove = node("button", "member-remove", "−");
        remove.type = "button";
        remove.setAttribute("aria-label", `Remove ${name} from demo member list`);
        remove.addEventListener("click", () => {
          extras.splice(extras.indexOf(name), 1); roster();
          message(`${name} removed from the demo list. Calendars unchanged.`);
          $("member-add").focus();
        });
        chip.append(label, remove); $("member-demo-list").append(chip);
      }
      $("member-reset").hidden = !removed.size && !extras.length;
    };
    for (const index of [0, 1, 2]) $("member-remove-" + index).addEventListener("click", () => {
      removed.add(index); roster();
      message(`${labels[index]} removed from the demo list. Calendars unchanged.`);
      $("member-add").focus();
    });
    $("member-add").addEventListener("click", () => {
      $("member-editor").hidden = false;
      $("member-add").setAttribute("aria-expanded", "true");
      message(""); $("member-name").focus();
    });
    const save = () => {
      const name = $("member-name").value.trim();
      const existing = labels.findIndex(label => key(label) === key(name));
      const error = !name || name.length > 40 || /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(name)
        ? "Enter a name of 1–40 characters without control characters."
        : existing !== -1 && !removed.has(existing) || extras.some(label => key(label) === key(name))
          ? "This member is already in the list."
          : 3 - removed.size + extras.length >= 12 ? "The demo supports up to 12 members." : "";
      if (error) {
        message(error); $("member-name").setAttribute("aria-invalid", "true"); $("member-name").focus(); return;
      }
      if (existing !== -1) removed.delete(existing); else extras.push(name);
      roster(); close();
      message(`${name} ${existing !== -1 ? "restored" : "added"} to the demo list. No calendar connected.`);
    };
    $("member-save").addEventListener("click", save);
    $("member-cancel").addEventListener("click", () => { close(); message(""); });
    $("member-editor").addEventListener("keydown", event => {
      if (event.key === "Escape") { event.preventDefault(); close(); message(""); }
      else if (event.key === "Enter" && event.target === $("member-name")) { event.preventDefault(); save(); }
    });
    $("member-reset").addEventListener("click", () => {
      removed.clear(); extras.length = 0; roster(); close(); message("Demo member list reset. Calendars unchanged.");
    });
  }
  function render() {
    renderPeople();
    const focusedChild = document.activeElement?.dataset?.childKey;
    let focusTarget;
    const disabled = !configurable || !selectedWindow || unsupported() || state.phase === "loading" || state.used && state.phase !== "loaded" || pending || blocked || storageBlocked || sessionRejected;
    $("availability-refresh").disabled = !confirmed || !configurable || !selectedWindow || unsupported() || state.phase === "loading" || state.phase === "cleared" || pending || blocked || storageBlocked || sessionRejected;
    $("availability-load").disabled = confirmed ? $("availability-refresh").disabled : disabled;
    $("availability-saved").disabled = !configurable || !selectedWindow || unsupported() || state.phase === "loading" || state.phase === "cleared" || pending || blocked || storageBlocked || sessionRejected;
    if (sharedActive || childWorking || childActionBlocked) {
      for (const id of ["availability-load", "availability-refresh", "availability-saved"]) $(id).disabled = true;
    }
    const syncing = sharedActive || childWorking || state.phase === "loading";
    $("availability-load").setAttribute("aria-busy", String(syncing));
    $("availability-sync-label").textContent = syncing ? "Syncing…" : "Sync";
    $("availability-supported-dates").hidden = !configurable || !unsupported();
    if (configurable && unsupported() && !blocked && !storageBlocked && !sessionRejected) status(rangeMessage, true);
    const canPage = configurable && selectedWindow && visibleWindow && !unsupported() && !blocked && !storageBlocked && !sessionRejected && !rangeClearing && state.phase !== "cleared";
    $("availability-display-previous").disabled = !canPage || visibleWindow.start <= selectedWindow.start;
    $("availability-display-next").disabled = !canPage || visibleWindow.end >= selectedWindow.end;
    $("availability-clear").disabled = rangeClearing || globalClearing;
    const showWeek = renderWeekPresentation();
    $("child-week-status").textContent = childLoaded()
      ? `${childName} · ${childSyncAvailable ? "Bounded snapshot" : "Saved view only"} · ${synthetic ? "Sample shared source" : "Selected Outlook source"} · Checked ${child.checkedAt} · ${childSyncAvailable ? "Sync uses remembered source · " : ""}${A.childFreshness(child)} · ${child.partial ? "Partial context" : child.events.length ? "Bounded view returned" : "Loaded; no events returned"}. Missing time is unknown, not free.${childSyncAvailable ? " Cached results keep their original check time." : " Update refreshes parents only."}`
      : `${childName} · ${childLifecycle === "loading" ? childSyncAvailable ? "Loading" : "Opening saved view only" : childLifecycle === "expired" ? "Page expired" : childLifecycle === "unavailable" ? "Unavailable" : "Not loaded"}. Missing time is unknown. ${childSyncAvailable ? "Sync uses only a previously confirmed remembered source." : "No live Kimi refresh."}`;
    if (!selectedWindow) {
      $("availability-grid").replaceChildren();
      $("availability-grid").setAttribute("aria-label", "Calendar · Choose valid dates; nothing checked");
      $("availability-context").replaceChildren(); $("availability-context").hidden = true;
      $("availability-parent-details").replaceChildren();
      $("availability-freshness").textContent = "Freshness unknown · No snapshot loaded.";
      $("availability-window").textContent = "No valid date range selected. Nothing checked.";
      $("availability-load-scope").textContent = "Calendar load scope unavailable. Choose valid dates; no calendars checked.";
      $("availability-display-label").textContent = "No valid display dates.";
      return;
    }
    const label = range => new Intl.DateTimeFormat("en-GB", { timeZone: range.timezone, day: "numeric", month: "long", year: "numeric" })
      .formatRange(new Date(range.start), new Date(Date.parse(range.end) - 1)).replace(/ /g, "");
    const weekLabel = label(visibleWindow);
    $("availability-display-label").textContent = `Display: ${weekLabel} · ${visibleWindow.slots / 48} ${visibleWindow.slots === 48 ? "day" : "days"} · Taipei (UTC+8). This is a view, not a shorter calendar query.`;
    $("availability-load-scope").textContent = unsupported()
      ? "Calendar load unavailable for this selection. Supported load scope: 9–15 October 2026 inclusive · Taipei (UTC+8), ending 16 October 00:00 exclusive · 336 half-hours per parent. Nothing checked."
      : `Calendar load scope: ${label(selectedWindow)} inclusive · Taipei (UTC+8), ending ${A.slotTime(selectedWindow.slots, selectedWindow).date} 00:00 exclusive · ${selectedWindow.slots} half-hours per parent. Confirm / Update / View saved only cover this entire scope, not just the displayed days. ${childSyncAvailable ? "Sync uses Kimi's remembered source before parents; View saved only never queries." : "Kimi is saved-view only; Update refreshes parents only."}`;
    $("availability-grid").setAttribute("aria-label", `Weekly calendar, ${weekLabel}, ${[...names, childName].join(" and ")}, ${selectedWindow.timezone}`);
    $("availability-window").textContent = `Calendar load window: ${A.slotTime(0, selectedWindow).date} 00:00 through ${A.slotTime(selectedWindow.slots, selectedWindow).date} 00:00 (end exclusive) · Asia/Taipei (UTC+8). All ${selectedWindow.slots} half-hour slots per parent, ${selectedWindow.slots * 2} total across the two parent calendars only. Only returned statuses are checked; missing data is unknown. ${childSyncAvailable ? "Kimi uses its separate remembered-source or saved-only view, not parent Busy slots." : "Kimi is saved-view only."}`;
    $("availability-context").replaceChildren();
    $("availability-parent-details").replaceChildren();
    for (const person of [0, 1]) {
      const p = parentLoaded() ? state.data.people[person] : null;
      $("availability-parent-details").append(node("p", "source-detail", `${names[person]} · ${synthetic ? "Sample" : "Outlook"} default calendar · Busy-only · ${p ? `${p.status} · Checked ${state.data.checkedAt} · ${A.freshness(state.data)}` : "Not loaded; freshness unknown"}.`));
      if (!showWeek || p?.status === "checked") continue;
      const text = p?.status === "partial" ? "Some of this schedule is unknown." : "This schedule isn’t available.";
      const label = p?.status === "partial" ? `${names[person]}: ${text}` : `${names[person]}’s schedule isn’t available.`;
      $("availability-context").append(node("p", "person-context", label));
    }
    $("availability-context").hidden = !$("availability-context").children.length;
    $("availability-freshness").textContent = state.data
      ? `${A.freshness(state.data)}. ${state.cached ? "Cached use does not recheck provider permissions." : "Not continuously refreshed."}`
      : "Freshness unknown · No snapshot loaded.";
    if (state.data && !blocked && !storageBlocked && !sessionRejected && $("availability-status").dataset.urgent !== "true") {
      const updated = new Date(state.data.checkedAt).toLocaleString("en-GB", {
        timeZone: "Asia/Taipei", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false
      });
      status(`${names.join(" + ")} · Updated ${updated} · Saved view${A.freshness(state.data).startsWith("Stale") ? " · May be out of date" : ""}`, false, true);
    }
    if (!showWeek) return;
    const visibleDates = new Set(A.days(visibleWindow).map(day => day.date));
    const childDays = childLoaded() ? A.childDayLayout(child, selectedWindow, synthetic).filter(day => visibleDates.has(day.date)) : [];
    // Shared header height across every day/axis; true all-day events never fill 24h.
    const bandRows = Math.min(3, Math.max(0, ...childDays.map(d => d.allDay.length)));
    const headingHeight = 80 + (bandRows ? 24 + bandRows * 44 : 0);
    const week = node("div", "availability-week"), axis = node("div", "week-axis");
    week.style.gridTemplateColumns = `56px repeat(${visibleWindow.slots / 48},minmax(264px,1fr))`;
    week.style.minWidth = `${56 + visibleWindow.slots / 48 * 264}px`;
    const axisHeading = node("div", "week-heading", bandRows ? "UTC+8 · All-day band" : "UTC+8");
    axisHeading.style.height = `${headingHeight}px`; axis.append(axisHeading);
    const hours = node("div", "week-hours");
    for (let slot = 0; slot <= 48; slot += 4) {
      const label = node("span", "hour-label", A.dayTime(slot));
      label.style.top = `${slot / 48 * 100}%`; hours.append(label);
    }
    axis.append(hours); week.append(axis);
    for (const day of A.weekLayout(parentLoaded() ? state.data.people : [], selectedWindow)) {
      if (!visibleDates.has(day.date)) continue;
      const column = node("section", "week-day"), header = node("div", "week-heading");
      header.style.height = `${headingHeight}px`;
      column.setAttribute("aria-label", `${day.date} · Asia/Taipei (UTC+8)`);
      header.append(node("h3", "", day.heading));
      const trackNames = node("div", "track-names");
      [...names, childName].forEach(name => trackNames.append(node("span", "", name)));
      header.append(trackNames); column.append(header);
      const childDay = childDays.find(d => d.date === day.date);
      if (bandRows) {
        const band = node("div", "week-all-day");
        band.style.height = `${24 + bandRows * 44}px`;
        band.dataset.childKey = `${day.date}-all-day`;
        if (focusedChild === band.dataset.childKey) focusTarget = band;
        band.setAttribute("tabindex", "0");
        band.setAttribute("aria-label", `${day.date} · ${childName} · All-day events; scroll for more. Not a Busy status.`);
        band.append(node("span", "", `${childName} · All-day`));
        for (const e of childDay?.allDay || []) {
          const item = node("p", "child-all-day", `Event ${e.index + 1} · ${A.childLabels[e.status]}`);
          item.dataset.status = e.status;
          item.title = `${day.date} · ${childName} · Event ${e.index + 1} · All-day · ${A.childLabels[e.status]} · Not a Busy status`;
          item.setAttribute("aria-label", item.title);
          childRenderer?.(item, e.index, child.generation, child.revision);
          band.append(item);
        }
        header.append(band);
      }
      const tracks = node("div", "day-tracks");
      for (const track of day.tracks) {
        const list = node("ol", "week-track");
        list.setAttribute("aria-label", `${day.date} · ${names[track.person]} · Default calendar · Asia/Taipei (UTC+8)`);
        for (const run of track.runs) {
          const block = node("li", "week-run", A.compactLabels[run.status]);
          block.dataset.status = run.status; block.style.gridRow = `${run.start + 1} / ${run.end + 1}`;
          const description = `${day.date} · ${names[track.person]} · ${run.startTime}–${run.endTime} Asia/Taipei (UTC+8) · ${A.labels[run.status]}`;
          block.title = description; block.setAttribute("aria-label", description); list.append(block);
        }
        tracks.append(list);
      }
      const childTrack = node("div", "child-track");
      childTrack.dataset.loaded = String(childLoaded());
      childTrack.setAttribute("aria-label", `${day.date} · ${childName} · Selected shared source · Missing time unknown · Asia/Taipei (UTC+8)`);
      // Loaded gaps stay visually empty, not a claim of verified free time.
      if (!childLoaded()) childTrack.append(node("p", "child-gap", "Not loaded · Unknown"));
      for (const e of childDay?.timed || []) {
        const label = `Event ${e.index + 1} · ${e.startTime}–${e.endTime} · ${A.childLabels[e.status]}${e.allDay === null ? " · All-day status unknown" : ""}`;
        const item = node("div", "child-event", label);
        item.dataset.childKey = `${day.date}-${e.index}`;
        if (focusedChild === item.dataset.childKey) focusTarget = item;
        item.dataset.status = e.status;
        item.style.top = `${e.start / 1440 * 100}%`; item.style.height = `${(e.end - e.start) / 1440 * 100}%`;
        item.style.left = `${e.lane / e.lanes * 100}%`; item.style.width = `${100 / e.lanes}%`;
        item.title = `${day.date} · ${childName} · ${label} · Asia/Taipei (UTC+8) · Not a Busy status`;
        item.setAttribute("aria-label", item.title); item.setAttribute("tabindex", "0");
        childRenderer?.(item, e.index, child.generation, child.revision);
        childTrack.append(item);
      }
      tracks.append(childTrack);
      column.append(tracks); week.append(column);
    }
    const grid = $("availability-grid");
    const scrollTop = grid.scrollTop || 0, scrollLeft = grid.scrollLeft || 0;
    grid.replaceChildren(week);
    // Start at 6 AM in Taipei, without truncating midnight slots or events.
    // Sticky headings/all-day bands stay visible; redraws preserve manual scroll.
    grid.style.scrollPaddingTop = `${headingHeight}px`;
    grid.scrollTop = gridPositioned ? scrollTop : 12 * 24;
    grid.scrollLeft = scrollLeft;
    gridPositioned = true;
    // Freshness/visibility redraws must not drop keyboard focus inside the grid.
    if (focusTarget) focusTarget.focus({ preventScroll: true });
  }
  async function post(path, body, signal, keepalive = false) {
    const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json", "X-Owner-CSRF": csrf }, body: JSON.stringify(body), signal,
      keepalive, cache: "no-store", credentials: "omit", redirect: "error" });
    const text = await r.text(); if (new TextEncoder().encode(text).length > A.responseLimit) throw new Error(); return JSON.parse(text);
  }
  const childStorageFailure = data => [data.status, data.childCacheStatus, data.childSourceStatus].some(value =>
    ["child_cache_invalid", "child_cache_unavailable", "child_cache_clear_failed", "child_source_invalid", "child_source_unavailable", "child_source_clear_failed"].includes(value));
  function cleanup(data) {
    if (data.status === "cleanup_failed" || data.cleanup === "cleanup_failed") blocked = true;
    if (childStorageFailure(data)) {
      storageBlocked = true; childBlocked = true; hideChild("unavailable");
      status("Kimi saved view or remembered source could not be read, saved or cleared. Calendar reuse is blocked until explicit Clear succeeds; reload cannot unblock storage.", true);
      safety();
    }
    const cacheStatus = data.cacheStatus || data.status;
    if (["cache_invalid", "cache_unavailable", "cache_clear_failed"].includes(cacheStatus)) {
      storageBlocked = true;
      state = A.transition(state, { type: "clear" });
      confirmed = false;
      failure({ status: cacheStatus });
    }
    const message = blocked
      ? "Updating paused because the last update could not finish safely. Ask the person who set up this page for help; reloading cannot unblock it."
      : A.sessionUnavailable(data)
        ? "Page expired. Reload to review access again. This does not confirm that the last update finished safely or unblock a paused update."
        : data.cleanup === "cleanup_pending"
          ? "The update is still finishing. Keep the app running."
          : ["workflow_disabled", "not_requested"].includes(data.cleanup) ? ""
            : "The last update could not be confirmed. Keep the app running and ask for help before trying again.";
    $("availability-cleanup").textContent = message;
    $("availability-cleanup").hidden = !message;
    if (A.sessionUnavailable(data)) {
      sessionRejected = true;
      $("availability-recovery").hidden = false;
      failure(data);
    }
    if (blocked) failure(data);
    if (blocked || storageBlocked || sessionRejected || ["revoked", "contract_drift", "expired", "blocked"].includes(data.status)) {
      childBlocked = true; hideChild(sessionRejected ? "expired" : "unavailable"); safety();
    }
  }
  async function clear(leaving = false, external = false) {
    if (!configurable || globalClearing) return;
    globalClearing = true;
    fenceActions();
    const childSettled = childActions?.release();
    childBlocked = true; hideChild();
    if (!external) window.dispatchEvent(new CustomEvent("owner-session-cleared", { detail: { source: "availability", leaving } }));
    const used = state.used;
    state = A.transition(state, { type: "clear" }); controller?.abort(); controller = undefined;
    confirmed = false; pending = true; render();
    status(leaving ? "View closed." : "Clearing saved view…");
    if (!leaving && !external) $("availability-status").focus();
    try {
      if (!(used || childActions || !leaving) || external) return;
      if (childSettled) await childSettled;
      const data = await post("/api/clear", leaving ? { reason: "leave" } : {}, AbortSignal.timeout(150000), leaving);
      cleanup(data);
      if (!leaving && data.status === "cleared" && !childStorageFailure(data)) {
        storageBlocked = false;
        if (blocked) failure(data);
        else status(childCacheAvailable
          ? "Saved view cleared. Parent and Kimi snapshots and reviewed child access removed. Reload page to start again; nothing loads automatically."
          : "Saved view cleared for Mike + Debby only. Kimi saved-data deletion is unconfirmed on this backend. A safe backend update is needed before clearing Kimi; reload alone cannot update it.", !childCacheAvailable, childCacheAvailable);
      } else if (!leaving && !blocked && !storageBlocked && !sessionRejected) {
        status("Couldn’t confirm the saved view was cleared. Get help in Details.", true);
      }
    }
    catch {
      cleanup({});
      if (!leaving) { storageBlocked = true; failure({ status: "cache_clear_failed" }); }
    }
    finally { pending = false; globalClearing = false; render(); }
  }
  async function changeRange() {
    let selection;
    try { selection = A.dateRange($("availability-start").value, $("availability-end").value); }
    catch { selection = null; }
    updateDateLabel();
    const nextWindow = A.calendarWindow(selection);
    const sameScope = selectedWindow && nextWindow && selectedWindow.start === nextWindow.start && selectedWindow.end === nextWindow.end;
    dateSelection = selection; visibleWindow = A.displayWindow(selection);
    const remembered = dates.write($("availability-start").value, $("availability-end").value);
    $("availability-date-sharing").textContent = remembered ? sharingText()
      : "Dates could not be remembered. Activity navigation is blocked until this tab can save dates.";
    $("availability-date-error").hidden = !!selection;
    $("availability-date-error").textContent = selection ? "" : "Choose valid start and end dates, 1–7 days inclusive, between 2000 and 2100.";
    for (const id of ["availability-start", "availability-end"]) $(id).setAttribute("aria-invalid", String(!selection));
    // A different view inside the same approved scope is not consent withdrawal
    // or a query change. Preserve requests, generations, results and timestamps.
    if (sameScope) { render(); return; }
    fenceActions();
    const used = state.used;
    const previousController = controller;
    // Invalidate the local generation before abort/cleanup. No old response can
    // appear beneath the new dates, even if it arrives during range cleanup.
    state = A.initial(state.generation + 1);
    // Keep the response connection open until server-side cancellation finishes:
    // a transport disconnect intentionally revokes this page session.
    confirmed = false; controller = undefined;
    selectedWindow = nextWindow;
    dateRevision++; hideChild();
    // Parent range cleanup also clears the backend child session. Child work must
    // wait for BOTH cleanups, including date-away/back while the first is pending.
    safety(configurable && (used || rangeClearing));
    status(selectedWindow ? "Calendar load scope changed. Review it before Confirm." : "Check the selected dates.");
    render();
    if (!used || rangeClearing || !configurable) return;
    rangeClearing = true; pending = true; render();
    try {
      const data = await post("/api/clear", { reason: "range" }, AbortSignal.timeout(150000));
      cleanup(data);
      if (data.status !== "cleared" && !blocked && !storageBlocked && !sessionRejected) {
        storageBlocked = true; failure({ status: "cache_clear_failed" });
      }
    } catch { storageBlocked = true; failure({ status: "cache_clear_failed" }); }
    finally {
      previousController?.abort(); rangeClearing = false; pending = false;
      if (blocked || storageBlocked || sessionRejected) { childBlocked = true; hideChild("unavailable"); }
      safety(false); render();
    }
  }
  for (const id of ["availability-start", "availability-end"]) $(id).addEventListener("input", changeRange);
  // One calendar edits a page-local draft. Apply writes both backing inputs
  // together, then enters the existing date/safety path exactly once. Browsing
  // or cancelling never changes consent, storage, results or request generations.
  const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const fullDateFormat = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const monthFormat = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" });
  const weekdayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" });
  const dateValue = value => Date.parse(value + "T00:00:00Z");
  const isoDate = value => new Date(value).toISOString().slice(0, 10);
  const firstDate = dateValue("2000-01-01"), lastDate = dateValue("2100-12-31"), dayMs = 86400000;
  const clampDate = value => Math.max(firstDate, Math.min(lastDate, value));
  let draftStart, draftEnd, dateCursor, dateMonth;
  const dateButtons = new Map();
  function rangeLabel(start, end) {
    const a = dateValue(start), b = dateValue(end);
    return a === b ? dateFormat.format(a) : dateFormat.formatRange(a, b);
  }
  function updateDateLabel() {
    const start = $("availability-start").value, end = $("availability-end").value;
    let valid = false;
    try { A.dateRange(start, end); valid = true; } catch { /* Invalid remembered dates remain invalid. */ }
    const label = valid ? rangeLabel(start, end) : "Choose dates";
    $("availability-date-label").textContent = label;
    $("availability-reset-dates").hidden = !valid;
    for (const [part, value] of [["start", start], ["end", end]]) {
      $("availability-" + part + "-label").textContent = valid ? dateFormat.format(dateValue(value)) : "Choose date";
      $("availability-" + part + "-weekday").textContent = valid ? weekdayFormat.format(dateValue(value)) : "";
    }
    $("availability-date-toggle").setAttribute("aria-label", `Choose date range: ${label}`);
    $("availability-date-toggle").setAttribute("aria-invalid", String(!valid));
  }
  function closeDatePicker(restoreFocus = true) {
    $("availability-date-picker").hidden = true;
    $("availability-date-toggle").setAttribute("aria-expanded", "false");
    if (restoreFocus) $("availability-date-toggle").focus();
  }
  function moveDateMonth(offset) {
    const current = new Date(dateCursor);
    const target = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + offset, 1));
    const maxDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    dateCursor = clampDate(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(current.getUTCDate(), maxDay)));
    dateMonth = new Date(dateCursor).setUTCDate(1);
  }
  function paintDateRange(candidate, message) {
    let start = draftStart, end = draftEnd || draftStart, preview = false;
    if (candidate && draftStart && !draftEnd) {
      const a = candidate < draftStart ? candidate : draftStart, b = candidate < draftStart ? draftStart : candidate;
      try { A.dateRange(a, b); start = a; end = b; preview = candidate !== draftStart; }
      catch { message = "Choose 1–7 days, including the start and end dates."; }
    }
    // Preview is paint only: no draft commit, aria-selection, storage or requests.
    for (const [date, button] of dateButtons) {
      const cell = button.parentNode, inRange = !!start && date >= start && date <= end;
      cell.dataset.inRange = String(inRange);
      cell.dataset.rangePosition = !inRange ? "none" : date === start
        ? (start === end ? "single" : "start") : date === end ? "end" : "middle";
      cell.dataset.preview = String(preview);
    }
    $("availability-date-hint").textContent = message || (preview
      ? `${rangeLabel(start, end)} · Select to finish.`
      : draftStart && !draftEnd ? `${dateFormat.format(dateValue(draftStart))} · Choose an end date (1–7 days).`
        : draftStart ? `${rangeLabel(draftStart, draftEnd)} · Click a day to start a new range.`
          : "Choose a start date, then an end date. Up to 7 days.");
  }
  function drawDatePicker(focusDay = false, message) {
    const current = new Date(dateMonth), year = current.getUTCFullYear(), month = current.getUTCMonth();
    $("availability-date-month").value = String(month);
    $("availability-date-year").value = String(year);
    $("availability-date-month-label").textContent = `${monthFormat.format(dateMonth)} ${year}`;
    $("availability-date-previous").disabled = dateMonth <= firstDate;
    $("availability-date-next").disabled = year === 2100 && month === 11;
    $("availability-date-apply").disabled = !draftStart || !draftEnd;
    const grid = $("availability-date-grid"); grid.replaceChildren(); dateButtons.clear();
    const header = node("div", "date-week-row"); header.setAttribute("role", "row");
    for (const name of ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]) {
      const heading = node("span", "date-weekday", name); heading.setAttribute("role", "columnheader"); header.append(heading);
    }
    grid.append(header);
    const first = dateMonth - current.getUTCDay() * dayMs;
    for (let week = 0; week < 6; week++) {
      const row = node("div", "date-week-row"); row.setAttribute("role", "row");
      for (let d = 0; d < 7; d++) {
        const value = first + (week * 7 + d) * dayMs, date = isoDate(value);
        const selected = !!draftStart && date >= draftStart && date <= (draftEnd || draftStart);
        const edge = date === draftStart || date === draftEnd;
        const cell = node("div", "date-cell"); cell.setAttribute("role", "gridcell");
        cell.setAttribute("aria-selected", String(selected)); cell.dataset.selected = String(selected); cell.dataset.edge = String(edge);
        const button = node("button", "date-day", String(new Date(value).getUTCDate()));
        button.type = "button"; button.dataset.date = date;
        button.dataset.outside = String(new Date(value).getUTCMonth() !== month);
        button.disabled = value < firstDate || value > lastDate;
        button.tabIndex = value === dateCursor ? 0 : -1;
        button.setAttribute("aria-label", fullDateFormat.format(value) + (date === draftStart ? ", Start date" : "") + (date === draftEnd ? ", End date" : ""));
        button.addEventListener("pointerenter", () => { if (!button.disabled) paintDateRange(date); });
        button.addEventListener("click", () => {
          if (button.disabled) return;
          dateCursor = value; dateMonth = new Date(value).setUTCDate(1);
          let error;
          if (!draftStart || draftEnd) { draftStart = date; draftEnd = null; }
          else {
            const start = date < draftStart ? date : draftStart, end = date < draftStart ? draftStart : date;
            try { A.dateRange(start, end); draftStart = start; draftEnd = end; }
            catch { error = "Choose 1–7 days, including the start and end dates."; }
          }
          drawDatePicker(true, error);
        });
        button.addEventListener("keydown", event => {
          const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7,
            Home: -new Date(value).getUTCDay(), End: 6 - new Date(value).getUTCDay() };
          if (Object.hasOwn(offsets, event.key)) dateCursor = clampDate(value + offsets[event.key] * dayMs);
          else if (["PageUp", "PageDown"].includes(event.key)) {
            dateCursor = value; moveDateMonth((event.key === "PageUp" ? -1 : 1) * (event.shiftKey ? 12 : 1));
          } else return;
          event.preventDefault(); dateMonth = new Date(dateCursor).setUTCDate(1); drawDatePicker(true);
          paintDateRange(isoDate(dateCursor));
        });
        dateButtons.set(date, button); cell.append(button); row.append(cell);
      }
      grid.append(row);
    }
    paintDateRange(undefined, message);
    if (focusDay) dateButtons.get(isoDate(dateCursor))?.focus();
  }
  $("availability-date-grid").addEventListener("pointerleave", () => paintDateRange());
  for (let month = 0; month < 12; month++) {
    const option = node("option", "", monthFormat.format(Date.UTC(2026, month, 1))); option.value = String(month);
    $("availability-date-month").append(option);
  }
  for (let year = 2000; year <= 2100; year++) {
    const option = node("option", "", String(year)); option.value = String(year); $("availability-date-year").append(option);
  }
  $("availability-date-toggle").addEventListener("click", () => {
    if (!$("availability-date-picker").hidden) { closeDatePicker(); return; }
    draftStart = null; draftEnd = null;
    try {
      A.dateRange($("availability-start").value, $("availability-end").value);
      draftStart = $("availability-start").value; draftEnd = $("availability-end").value;
    } catch { /* Do not repair invalid storage implicitly. */ }
    dateCursor = dateValue(draftStart || A.slotTime(0, A.liveWindow).date);
    dateMonth = new Date(dateCursor).setUTCDate(1);
    $("availability-date-picker").hidden = false;
    $("availability-date-toggle").setAttribute("aria-expanded", "true"); drawDatePicker(true);
  });
  for (const [id, offset] of [["availability-date-previous", -1], ["availability-date-next", 1]]) {
    $(id).addEventListener("click", () => { if (!$(id).disabled) { moveDateMonth(offset); drawDatePicker(); if ($(id).disabled) dateButtons.get(isoDate(dateCursor))?.focus(); } });
  }
  for (const id of ["availability-date-month", "availability-date-year"]) $(id).addEventListener("change", () => {
    const year = Number($("availability-date-year").value), month = Number($("availability-date-month").value);
    if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 0 || month > 11) return;
    dateCursor = dateMonth = Date.UTC(year, month, 1); drawDatePicker();
  });
  $("availability-date-cancel").addEventListener("click", () => closeDatePicker());
  $("availability-reset-dates").addEventListener("click", async () => {
    $("availability-start").value = ""; $("availability-end").value = "";
    closeDatePicker();
    // Use normal fencing and the dates-only tombstone; never delete snapshots.
    await changeRange();
    $("availability-date-error").hidden = true;
    $("availability-date-toggle").setAttribute("aria-invalid", "false");
  });
  $("availability-date-apply").addEventListener("click", async () => {
    if ($("availability-date-apply").disabled || !draftStart || !draftEnd) return;
    try { A.dateRange(draftStart, draftEnd); } catch { return; }
    $("availability-start").value = draftStart; $("availability-end").value = draftEnd;
    closeDatePicker(); await changeRange();
  });
  $("availability-date-picker").addEventListener("keydown", event => {
    if (event.key === "Escape") { event.preventDefault(); closeDatePicker(); }
  });
  // Non-modal popover: Tab may leave freely; leaving discards only the draft.
  $("availability-date-control").addEventListener("focusout", event => {
    if (event.relatedTarget && !$("availability-date-control").contains(event.relatedTarget)) closeDatePicker(false);
  });
  document.addEventListener("pointerdown", event => {
    if (!$("availability-date-picker").hidden && !event.target.closest?.("#availability-date-control")) closeDatePicker(false);
  });
  updateDateLabel();
  if (restoredDates.status === "default") $("availability-date-toggle").setAttribute("aria-invalid", "false");
  function pageDisplay(direction) {
    const id = direction < 0 ? "availability-display-previous" : "availability-display-next";
    if ($(id).disabled || !visibleWindow || !selectedWindow) return;
    const pages = A.displayPages(dateSelection);
    const index = pages.findIndex(page => page.start === visibleWindow.start && page.end === visibleWindow.end);
    if (index < 0 || !pages[index + direction]) return;
    visibleWindow = pages[index + direction];
    // Render only: never change selected Activities dates, consent or lifecycle.
    const focused = document.activeElement === $(id);
    render();
    if (focused && $(id).disabled) $(direction < 0 ? "availability-display-next" : "availability-display-previous").focus();
  }
  $("availability-display-previous").addEventListener("click", () => pageDisplay(-1));
  $("availability-display-next").addEventListener("click", () => pageDisplay(1));
  async function load(refresh = false, cacheOnly = false) {
    if (!configurable || !selectedWindow || blocked || storageBlocked || pending || sessionRejected || refresh && !confirmed) return;
    if (unsupported()) { status(rangeMessage, true); return; }
    const requestWindow = selectedWindow;
    const next = A.transition(state, { type: "load", refresh: refresh || cacheOnly, acknowledged: true }); if (next === state) return;
    confirmed = true;
    state = next; const generation = state.generation; controller = new AbortController(); render();
    status(synthetic ? "Loading sample week…" : refresh ? "Updating week…" : "Opening week…");
    $("availability-cleanup").textContent = "The update is still finishing. Keep the app running.";
    $("availability-cleanup").hidden = false;
    $("availability-clear").focus();
    let response;
    try {
      const data = await post("/api/availability", { acknowledged: true, requestId: crypto.randomUUID(), refresh, ...(cacheOnly ? { cacheOnly: true } : {}),
        startDate: A.slotTime(0, requestWindow).date, endDate: A.slotTime(requestWindow.slots - 1, requestWindow).date }, AbortSignal.any([controller.signal, AbortSignal.timeout(420000)]));
      if (generation !== state.generation) return;
      if (Date.now() >= childExpires) {
        sessionRejected = true; state = A.transition(state, { type: "clear" });
        controller?.abort(); hideChild("expired"); safety(); failure({ status: "expired" }); render();
        return;
      }
      response = data;
      cleanup(data);
      if (storageBlocked) { render(); $("availability-status").focus(); return; }
      if (data.synthetic !== synthetic || data.cleanup !== "workflow_disabled" || !data.people || cacheOnly && data.cached !== true) throw new Error();
      state = A.transition(state, { type: "loaded", generation, data, window: requestWindow });
      if (state.phase !== "loaded") throw new Error();
      status("", false, true);
    } catch {
      if (generation !== state.generation) return;
      state = A.transition(state, { type: "failed", generation });
      // A cache-only miss did not query or revoke access. Leave Confirm available
      // for a separate deliberate request, never make that request automatically.
      if (cacheOnly && response?.status === "cache_missing") { state = A.initial(state.generation + 1); confirmed = false; }
      failure(response);
    }
    render();
    ($("availability-status").hidden ? $("availability-grid") : $("availability-status")).focus();
  }
  async function parentOperation(refresh, cacheOnly = false) {
    safety(true); // Native parent and child operations must never overlap.
    try { await load(refresh, cacheOnly); }
    finally { safety(rangeClearing); }
  }
  async function sharedLoad(refresh = false, button = $(refresh ? "availability-refresh" : "availability-load")) {
    if (button.disabled || sharedActive || childWorking || childActionBlocked) return;
    if (!childActions) return parentOperation(refresh);
    const version = ++actionRevision;
    sharedActive = true; render();
    try {
      button.focus();
      // Await child completion (including independent cleanup) before parents.
      // Older runtimes retain saved-first/parent-only refresh, never a 404 probe.
      const choice = childActions.sync ? await childActions.sync(refresh) : refresh ? "skip" : await childActions.saved();
      if (choice === "cancel" || !canContinue(version) || childWorking) return;
      await parentOperation(refresh);
    } finally {
      sharedActive = false; render();
      if (canContinue(version)) (button.disabled ? $("availability-load") : button).focus();
    }
  }
  $("availability-load").addEventListener("click", () => sharedLoad(confirmed, $("availability-load")));
  $("availability-saved").addEventListener("click", async () => {
    if ($("availability-saved").disabled || sharedActive || childWorking) return;
    const version = ++actionRevision;
    sharedActive = true; render();
    try {
      await parentOperation(false, true);
      // A parent miss/generic error is independent. Safety, storage and cleanup
      // failures must fence the second operation, including late responses.
      if (canContinue(version)) await childActions?.saved();
    } finally { sharedActive = false; render(); }
  });
  $("availability-supported-dates").addEventListener("click", async () => {
    $("availability-start").value = A.slotTime(0, A.liveWindow).date;
    $("availability-end").value = A.slotTime(A.liveWindow.slots - 1, A.liveWindow).date;
    await changeRange();
    $("availability-load").focus();
  });
  $("availability-refresh").addEventListener("click", () => sharedLoad(true));
  $("availability-clear").addEventListener("click", () => { void clear(); });
  $("availability-check").addEventListener("click", async () => {
    if (!configurable) return;
    try {
      const data = await post("/api/status", {}, AbortSignal.timeout(10000));
      cleanup(data);
      if (!blocked && !storageBlocked && !sessionRejected && !["workflow_disabled", "not_requested"].includes(data.cleanup)) {
        status(data.cleanup === "cleanup_pending" ? "Update is still finishing. Keep this page open."
          : "Can’t confirm the update finished. Get help in Details.", true);
      }
      if (!blocked && !storageBlocked && !sessionRejected && ["workflow_disabled", "not_requested"].includes(data.cleanup)) {
        $("availability-cleanup").textContent = "No unfinished update reported by the app. Calendars and Outlook access were not checked.";
        $("availability-cleanup").hidden = false;
      }
    } catch { cleanup({}); status("Couldn’t check the page. Get help in Details.", true); }
    render();
    if ($("availability-status").dataset.urgent === "true") $("availability-status").focus();
  });
  // Either surface clearing the shared owner session also clears this grid.
  window.addEventListener("owner-session-cleared", event => { if (event.detail.source !== "availability") void clear(event.detail.leaving, true); });
  window.addEventListener("pagehide", () => { void clear(true); });
  window.addEventListener("pageshow", e => { if (e.persisted) void clear(true); });
  window.addEventListener("child-week-changed", event => {
    try {
      // Ignore old/replayed packets before validating their obsolete date window.
      if (Number.isSafeInteger(event.detail?.generation) && event.detail.generation <= childGeneration ||
        Number.isSafeInteger(event.detail?.revision) && event.detail.revision < dateRevision) return;
      const data = A.childDisplay(event.detail, selectedWindow, synthetic);
      if (data.generation <= childGeneration || data.revision !== dateRevision) return;
      childGeneration = data.generation; clearTimeout(childTimer);
      if (childBlocked && data.lifecycle === "loaded") return;
      if (data.lifecycle === "expired") childBlocked = true;
      child = data.lifecycle === "loaded" ? data : null; childLifecycle = data.lifecycle;
      if (child) childTimer = setTimeout(() => render(), Math.max(1, 300000 - (Date.now() - Date.parse(child.checkedAt))));
    } catch { hideChild("unavailable"); }
    render();
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) render(); });
  render(); // No Azure, local API or credential access at startup.
})();