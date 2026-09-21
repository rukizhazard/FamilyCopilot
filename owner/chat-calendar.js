"use strict";
(function(root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root,
    require("../shared/chat-contract"), require("./chat-calendar-template"), require("./chat-calendar-fixtures"),
    require("./availability-core"), require("./child-calendar-core"), require("../shared/date-selection"),
    { availability: require("./availability-ui"), child: require("./child-calendar-ui") });
  else root.FamilyChatCalendar = factory(root, root.FamilyChatContract, root.FamilyCalendarTemplate,
    root.FamilyCalendarFixtures, root.OwnerAvailability, root.ChildCalendar, root.FamilyDates, root.FamilyCalendarControllers);
})(globalThis, (root, contract, template, fixtures, availability, child, dates, controllers) => {
  const instances = new WeakMap();
  function mountCalendar(host, options) {
    if (!contract.validateCalendarMountOptions(options)) throw new Error("invalid_calendar_options");
    const document = host?.ownerDocument;
    if (!document || host.nodeType !== 1 || host.id !== "calendar-host" || !host.isConnected ||
      document.getElementById("calendar-host") !== host) throw new Error("invalid_calendar_host");
    const previous = instances.get(document);
    if (previous) {
      if (previous.disposed) throw new Error("calendar_disposed");
      if (previous.host !== host) throw new Error("calendar_already_mounted");
      return previous.controller;
    }
    if (host.childNodes.length || document.getElementById("availability-grid") || !controllers?.availability || !controllers?.child) {
      throw new Error("invalid_calendar_host");
    }
    const record = { host, disposed: false, controller: null };
    instances.set(document, record);
    let view;
    try { view = template.create(host); }
    catch { record.disposed = true; throw new Error("calendar_mount_failed"); }
    const listeners = [], timers = new Set();
    const bus = (() => {
      const handlers = new Map();
      return {
        addEventListener(type, handler) { if (!handlers.has(type)) handlers.set(type, new Set()); handlers.get(type).add(handler); },
        removeEventListener(type, handler) { handlers.get(type)?.delete(handler); },
        dispatchEvent(event) { for (const handler of handlers.get(event.type) || []) handler(event); }
      };
    })();
    const demoAvailability = availability.forSyntheticOctober(), demoChild = child.forSyntheticOctober();
    const transport = fixtures.create({ now: () => root.Date.now(), scenario: () => "loaded", syntheticOctober: true });
    let collapsed = false, collapsedScroll, disposal, availabilityController, loading, conversationLoading = false;
    let coordinationOpen = false, proposalRevision = null, coordinationReady = false;
    let meetingRevision = null, alternateRevision = null;
    let invitation = null;
    const meetingListeners = new Set(), assessmentListeners = new Set();
    const listen = (target, type, handler) => {
      const guarded = event => { if (!record.disposed) return handler(event); };
      target.addEventListener(type, guarded);
      listeners.push(() => target.removeEventListener(type, guarded));
    };
    const cleanupResources = () => {
      meetingListeners.clear();
      assessmentListeners.clear();
      for (const remove of listeners.splice(0)) remove();
      for (const timer of timers) root.clearTimeout(timer);
      timers.clear();
    };
    const metadata = Object.freeze({ "owner-csrf": "calendar-synthetic", "owner-mode": "synthetic", "owner-cache": "memory",
      "owner-range": "configurable-v1", "owner-saved": "preserve-v1", "owner-contract": "bounded-availability-v5",
      "child-mode": "synthetic", "child-cache": "child-saved-v1-memory", "child-sync": "child-sync-v1" });
    const localDocument = {
      getElementById: id => view.nodes.get(id) || null,
      createElement: tag => document.createElement(tag),
      querySelector: selector => { const name = /^meta\[name="([a-z-]+)"\]$/.exec(selector)?.[1]; return name && Object.hasOwn(metadata, name) ? { content: metadata[name] } : null; },
      addEventListener: (...args) => document.addEventListener(...args),
      removeEventListener: (...args) => document.removeEventListener(...args),
      get activeElement() { return document.activeElement; }, get hidden() { return document.hidden; }
    };
    const environment = {
      document: localDocument, window: bus, OwnerAvailability: demoAvailability, ChildCalendar: demoChild,
      FamilyDates: { createStore: () => dates.createStore(() => transport.storage) },
      Date: root.Date, CustomEvent: root.CustomEvent, Option: root.Option, crypto: root.crypto,
      calendarCandidates: () => transport.candidateTimes(),
      renderCoordination,
      listen, calendarDisposed: () => record.disposed,
      focusCalendar(target, options) { if (!record.disposed && !collapsed && !conversationLoading && !target.hidden) target.focus(options); },
      setTimeout(handler, duration) {
        if (record.disposed) return undefined;
        const timer = root.setTimeout(() => { timers.delete(timer); if (!record.disposed) handler(); }, duration);
        timers.add(timer); return timer;
      },
      clearTimeout(timer) { timers.delete(timer); root.clearTimeout(timer); },
      async fetch(path, options) {
        const body = JSON.parse(options.body);
        const leaving = path === "/api/clear" && body.reason === "leave";
        const cleanup = ["/api/clear", "/api/child/clear", "/api/child/edit"].includes(path);
        if (record.disposed && !leaving) throw new Error("calendar_disposed");
        const response = await transport.fetch(path, options);
        if (record.disposed && !cleanup) throw new Error("calendar_disposed");
        return response;
      }
    };
    function renderCoordination(ready) {
      coordinationReady = ready;
      const get = id => view.nodes.get(id);
      const result = ready ? transport.coordination() : null;
      get("calendar-coordination").hidden = !ready && !coordinationOpen;
      const checked = result?.status === "checked";
      const consentRetired = [proposalRevision, meetingRevision, alternateRevision, invitation?.revision ?? null].some(revision =>
        revision !== null && (!checked || revision !== result.revision));
      if (invitation && (!checked || invitation.revision !== result.revision)) invitation = null;
      if (!checked || proposalRevision !== null && proposalRevision !== result.revision) proposalRevision = null;
      if (!checked || meetingRevision !== null && meetingRevision !== result.revision) meetingRevision = null;
      if (!checked || alternateRevision !== null && alternateRevision !== result.revision) alternateRevision = null;
      get("coordination-review").disabled = !ready;
      get("coordination-review").setAttribute("aria-expanded", String(coordinationOpen));
      get("coordination-body").hidden = !coordinationOpen;
      const mike = result?.people.find(person => person.person === 0), debby = result?.people.find(person => person.person === 1);
      get("coordination-status").textContent = !checked ? "Calendar context is missing, incomplete or out of date. No proposal can be confirmed." :
        debby.status === "conflict" ? `Debby (you) has ${debby.overlapMinutes} minutes of overlap with the meeting. ${mike.status === "no_conflict" ? "Mike has no overlapping busy time reported." : "Mike's calendar also needs checking."}` :
        "No overlapping busy time reported for Debby (you). Availability is not guaranteed.";
      const canPropose = checked && debby.status === "conflict" && mike.status === "no_conflict";
      if (!canPropose) { proposalRevision = null; invitation = null; }
      get("coordination-status").dataset.proposed = String(proposalRevision !== null);
      if (proposalRevision !== null) get("coordination-status").textContent = "This proposal avoids your conflict by having Mike attend instead. His confirmation is still needed.";
      get("coordination-result").hidden = proposalRevision === null;
      get("coordination-result").textContent = proposalRevision === null ? "" :
        `Before: Debby (you) attending overlaps your calendar by ${debby.overlapMinutes} minutes. Proposed: Mike attends instead; no overlap with his reported busy time. Your commitments stay unchanged. Awaiting Mike's confirmation.`;
      if (invitation) {
        get("coordination-status").textContent = "Mike pending response";
        get("coordination-result").hidden = false;
        get("coordination-result").textContent = "Mike's invitation for Kimi's school meeting, Friday, October 16, 2026, 3:30-4:30 PM (Asia/Taipei), is awaiting his response.";
      }
      get("coordination-result").dataset.invitationId = invitation?.id || "";
      const timeline = get("coordination-timeline"); timeline.replaceChildren();
      if (consentRetired) for (const listener of assessmentListeners) listener();
      if (!checked || !coordinationOpen) return;
      const format = value => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
      const baseline = Date.parse("2026-10-16T14:00:00+08:00");
      const rows = [["Kimi / School meeting", [result.meeting]],
        ["Debby (you) / Busy only", debby.busy], ["Mike / Busy only", mike.busy]];
      for (const [label, intervals] of rows) {
        const row = document.createElement("div"), title = document.createElement("strong"), rail = document.createElement("div");
        row.className = "coordination-row"; title.textContent = label; rail.className = "coordination-rail";
        for (const interval of intervals) {
          const block = document.createElement("span"); block.className = "coordination-interval";
          block.textContent = `${format(interval.startAt)}-${format(interval.endAt)}`;
          block.style.left = `${(Date.parse(interval.startAt) - baseline) / 14400000 * 100}%`;
          block.style.width = `${(Date.parse(interval.endAt) - Date.parse(interval.startAt)) / 14400000 * 100}%`;
          rail.append(block);
          if (label === "Debby (you) / Busy only" && proposalRevision === null) {
            const start = Math.max(Date.parse(interval.startAt), Date.parse(result.meeting.startAt));
            const end = Math.min(Date.parse(interval.endAt), Date.parse(result.meeting.endAt));
            if (end > start) {
              const overlap = document.createElement("span"); overlap.className = "coordination-overlap";
              overlap.style.left = `${(start - baseline) / 14400000 * 100}%`; overlap.style.width = `${(end - start) / 14400000 * 100}%`;
              overlap.setAttribute("aria-label", `${(end - start) / 60000} minute overlap`); rail.append(overlap);
            }
          }
        }
        row.append(title, rail); timeline.append(row);
      }
      const axis = document.createElement("div"); axis.className = "coordination-axis";
      for (const time of ["14:00", "15:00", "16:00", "17:00", "18:00"]) {
        const tick = document.createElement("span"); tick.textContent = time; axis.append(tick);
      }
      timeline.append(axis);
    }
    function resetProposal() {
      if (record.disposed) return;
      coordinationOpen = false; proposalRevision = null; meetingRevision = null; alternateRevision = null;
      invitation = null;
      renderCoordination(coordinationReady);
    }
    function coordinateMeeting(action) {
      if (record.disposed || conversationLoading || !["review", "assess_alternate", "confirm", "send_invitation", "decline", "cancel"].includes(action)) return { state: "unavailable" };
      if (action === "cancel" || action === "decline") {
        invitation = null;
        proposalRevision = null; meetingRevision = null; alternateRevision = null; availabilityController.redraw();
        return { state: action === "cancel" ? "cancelled" : "declined" };
      }
      availabilityController.redraw();
      const result = coordinationReady ? transport.coordination() : null;
      const mike = result?.people.find(person => person.person === 0), debby = result?.people.find(person => person.person === 1);
      if (result?.status !== "checked" || debby?.status !== "conflict" || mike?.status !== "no_conflict") {
        invitation = null;
        proposalRevision = null; meetingRevision = null; alternateRevision = null; return { state: "unavailable" };
      }
      if (invitation && ["review", "send_invitation"].includes(action)) return { state: "invited" };
      if (action === "review") {
        coordinationOpen = true; proposalRevision = null; meetingRevision = result.revision; alternateRevision = null;
        availabilityController.redraw();
        return { state: "ask", overlapMinutes: debby.overlapMinutes };
      }
      if (meetingRevision === null || meetingRevision !== result.revision) return { state: "unavailable" };
      if (action === "send_invitation") {
        invitation = Object.freeze({ id: "demo-school-meeting-mike-20261016", revision: result.revision,
          recipient: "Mike", startAt: "2026-10-16T15:30:00+08:00", endAt: "2026-10-16T16:30:00+08:00",
          timeZone: "Asia/Taipei", response: "pending" });
        proposalRevision = null; meetingRevision = null; alternateRevision = null;
        availabilityController.redraw();
        return { state: "invited" };
      }
      if (action === "assess_alternate") {
        alternateRevision = result.revision;
        return { state: "confirm_alternate" };
      }
      if (alternateRevision === null || alternateRevision !== result.revision) return { state: "unavailable" };
      proposalRevision = result.revision; meetingRevision = null; alternateRevision = null;
      availabilityController.redraw();
      return { state: "proposed" };
    }
    function subscribeMeetingReview(listener) {
      if (record.disposed || typeof listener !== "function") throw Error("invalid_meeting_listener");
      meetingListeners.add(listener);
      return () => meetingListeners.delete(listener);
    }
    function loadSynthetic() {
      if (record.disposed) return Promise.reject(new Error("calendar_disposed"));
      if (loading) return loading;
      conversationLoading = true;
      loading = Promise.resolve().then(() => {
        if (record.disposed) throw new Error("calendar_disposed");
        return availabilityController.loadSynthetic();
      }).then(() => undefined, () => {
        if (!record.disposed) {
          view.safety.hidden = false;
          view.safety.textContent = "Calendar loading unavailable. Calendar availability remains unknown.";
        }
        throw new Error("calendar_load_unavailable");
      })
        .finally(() => { conversationLoading = false; });
      return loading;
    }
    function expand() {
      if (record.disposed || !collapsed) return;
      collapsed = false; view.body.hidden = false;
      view.toggle.setAttribute("aria-expanded", "true"); view.toggle.textContent = "Collapse calendar";
      if (collapsedScroll) {
        const grid = view.nodes.get("availability-grid");
        grid.scrollTop = collapsedScroll.top; grid.scrollLeft = collapsedScroll.left;
      }
    }
    function collapse() {
      if (record.disposed || collapsed) return;
      const moveFocus = view.body.contains(document.activeElement);
      const grid = view.nodes.get("availability-grid");
      collapsedScroll = grid.hidden ? null : { top: grid.scrollTop, left: grid.scrollLeft };
      collapsed = true; view.body.hidden = true;
      view.toggle.setAttribute("aria-expanded", "false"); view.toggle.textContent = "Expand calendar";
      if (moveFocus) view.toggle.focus({ preventScroll: true });
    }
    function assessOccurrences(occurrences) {
      if (record.disposed || conversationLoading) throw new Error("calendar_assessment_unavailable");
      return transport.assessOccurrences(occurrences);
    }
    function subscribeAssessment(listener) {
      if (record.disposed || typeof listener !== "function") throw Error("invalid_assessment_listener");
      assessmentListeners.add(listener);
      const unsubscribe = transport.subscribeAssessment(listener);
      return () => { assessmentListeners.delete(listener); unsubscribe(); };
    }
    function dispose() {
      if (disposal) return disposal;
      let resolveDisposal, rejectDisposal;
      disposal = new Promise((resolve, reject) => { resolveDisposal = resolve; rejectDisposal = reject; });
      const moveFocus = view.panel.contains(document.activeElement);
      record.disposed = true;
      view.body.hidden = true; view.body.inert = true; view.toggle.disabled = true;
      view.safety.hidden = false; view.safety.textContent = "Calendar closing. Cleanup not yet confirmed.";
      view.body.replaceChildren(); view.strip.replaceChildren();
      if (moveFocus) view.safety.focus({ preventScroll: true });
      cleanupResources();
      let leaving;
      try { leaving = availabilityController.leave(); } catch { leaving = Promise.reject(new Error("calendar_cleanup_unconfirmed")); }
      Promise.resolve(leaving).then(() => {
        view.safety.textContent = "Calendar closed. In-memory leave completed; saved fixtures were not deleted. Reload for explicit re-entry.";
        resolveDisposal();
      }, () => {
        view.safety.textContent = "Calendar cleanup unconfirmed. Calendar hidden and reuse blocked; no automatic retry.";
        rejectDisposal(new Error("calendar_cleanup_unconfirmed"));
      });
      return disposal;
    }
    try {
      availabilityController = controllers.availability(environment);
      controllers.child(environment);
      view.nodes.get("availability-date-help").textContent = "Sample calendars cover all of October 2026. Browsing months does not load other dates.";
      view.nodes.get("owner-source-notice").textContent = "Fictional data only. No provider, local service, file or browser storage access.";
      view.nodes.get("availability-identity").textContent = "Mike, Debby and Kimi have sample schedules here. Names do not establish real calendar access or authorization.";
      view.nodes.get("availability-retention").textContent = "Sample snapshots remain in this Calendar instance only. Sync replaces fixtures; Clear deletes fixtures. Collapse and leave do not delete snapshots.";
      view.nodes.get("child-retention").textContent = "Kimi (sample): fictional reviewed source and permitted names/times, in memory only. No real guardian consent or source authorization is granted. Sync and saved viewing use fixtures only.";
      listen(view.toggle, "click", () => collapsed ? expand() : collapse());
      listen(view.nodes.get("coordination-review"), "click", () => {
        if (meetingListeners.size) {
          for (const listener of meetingListeners) listener();
          return;
        }
        coordinationOpen = !coordinationOpen;
        availabilityController.redraw();
        if (coordinationOpen) view.nodes.get("coordination-status").focus();
      });
      const onExit = () => { void dispose().catch(() => {}); };
      listen(document.defaultView, "pagehide", onExit);
      listen(document.defaultView, "pageshow", event => { if (event.persisted) onExit(); });
    } catch {
      record.disposed = true; cleanupResources(); view.body.replaceChildren(); view.strip.replaceChildren();
      view.safety.hidden = false; view.safety.textContent = "Calendar unavailable. Reload for explicit re-entry.";
      throw new Error("calendar_mount_failed");
    }
    record.controller = Object.freeze({ expand, collapse, dispose, loadSynthetic, assessOccurrences, subscribeAssessment, resetProposal, coordinateMeeting, subscribeMeetingReview });
    return record.controller;
  }
  return Object.freeze({ mountCalendar });
});