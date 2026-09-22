"use strict";
(function(root) {
  const Contract = typeof module !== "undefined" && module.exports ? require("../shared/chat-contract") : root.FamilyChatContract;
  const copy = value => JSON.parse(JSON.stringify(value));
  const dayMs = 86400000;
  const invitationResult = "Parent A's invitation for Child's school meeting on Friday, October 16, 2026, 3:30-4:30 PM (Asia/Taipei) is awaiting his response.";

  function initialContext() {
    return {
      version: "familycopilot.chat.v1", sessionId: "session-0", contextRevision: 1,
      referenceNow: "2026-09-18T04:00:00Z", timeZone: "Asia/Taipei", mode: "synthetic",
      preferences: {
        ages: [7], interests: ["basketball", "baseball", "movies", "concerts", "museums", "outdoor-play", "science-discovery"], interestBasis: "demo_fixture", preferredTeams: ["新北中信特攻", "中信兄弟"],
        origin: { area: "Xinyi District, Taipei City", precision: "district", landmark: null },
        travelMode: null,
        constraints: { maxTravelMinutes: null, budget: null, setting: "any", excludedCategories: [] }
      },
      activityRange: { startDate: "2026-10-09", endDate: "2026-10-11", timeZone: "Asia/Taipei" },
      triggerState: "not_started"
    };
  }

  function interpretWeekend(text, referenceNow, timeZone) {
    if (typeof text !== "string" || text.length > 500 || timeZone !== "Asia/Taipei") return null;
    const normalized = text.trim().toLowerCase();
    if (!["this weekend", "this weekend?", "how about this weekend?",
      "october feels too far away. how about this weekend?"].includes(normalized)) return null;
    if (typeof referenceNow !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(referenceNow)) return null;
    const reference = Date.parse(referenceNow);
    if (!Number.isFinite(reference)) return null;
    const local = new Date(reference + 8 * 3600000);
    const today = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
    const weekday = local.getUTCDay();
    const start = today + (weekday === 0 ? 0 : (6 - weekday) * dayMs);
    const end = start + (weekday === 0 ? 0 : dayMs);
    const range = { startDate: new Date(start).toISOString().slice(0, 10),
      endDate: new Date(end).toISOString().slice(0, 10), timeZone };
    const probe = initialContext();
    const request = { version: probe.version, requestId: "date-check", generation: 1, contextRevision: 1,
      referenceNow, range, mode: "synthetic", trigger: { kind: "refinement_submit", actionId: "date-check" },
      preferences: probe.preferences };
    return Contract.validateActivityRequest(request) ? range : null;
  }

  function createConversation({ searchActivities, prepareSession = null, assessActivities = null, coordinateMeeting = null, prepareInvitation = null, onChange = () => {}, context = initialContext(),
    schedule = (callback, delay) => root.setTimeout(callback, delay),
    unschedule = timer => root.clearTimeout(timer) } = {}) {
    if (typeof searchActivities !== "function" || typeof onChange !== "function" ||
      prepareSession !== null && typeof prepareSession !== "function" ||
      assessActivities !== null && typeof assessActivities !== "function" ||
      coordinateMeeting !== null && typeof coordinateMeeting !== "function" ||
      prepareInvitation !== null && typeof prepareInvitation !== "function" ||
        typeof schedule !== "function" || typeof unschedule !== "function" || !Contract.validateDemoContext(context)) {
      throw new Error("invalid_conversation_options");
    }
    const seed = copy(context);
    let current = copy(seed), generation = 0, sequence = 0, dispatched = 0;
    let active = null, accepted = null, result = null, status = "not_started", disposed = false;
    let demoStep = 0, lastSubmission = null;
    let meetingState = null, meetingPreparation = null, invitationPreparation = null;
    let calendarAssessment = null, assessmentTimer = null;
    let messages = [];
    current.triggerState = "not_started";
    const nextId = prefix => `${prefix}-${++sequence}`;
    function processingActions() {
      if (status === "checking_meeting") return ["check_school_meeting"];
      if (status === "sending_demo_invitation") return ["send_demo_invitation"];
      if (meetingPreparation) return ["load_calendars", "check_school_meeting"];
      if (!active) return [];
      if (status === "checking_calendar") return ["compare_activity_times"];
      return [...(active.preparing ? ["load_calendars"] : []), "search_saved_activities",
        ...(assessActivities ? ["compare_activity_times"] : [])];
    }
    function snapshot() {
      return copy({ context: current, generation, dispatched, status, messages, result, demoStep, calendarAssessment, meetingState,
        processingActions: processingActions() });
    }
    function publish() { onChange(snapshot()); }
    function message(role, kind, text, requestId = null, cardIds = []) {
      messages.push({ id: nextId("message"), role, kind, text, requestId, cardIds });
    }
    function invalidate() {
      generation++;
      if (invitationPreparation) {
        const previous = invitationPreparation;
        invitationPreparation = null;
        unschedule(previous.timer); previous.controller.abort(); previous.finish();
      }
      if (meetingPreparation) {
        unschedule(meetingPreparation.timer); meetingPreparation.finish(); meetingPreparation = null;
      }
      if (meetingState) {
        meetingCommand("cancel"); meetingState = "unavailable";
        messages = messages.map(entry => entry.kind.startsWith("meeting_") ? { ...entry, text: "Please check the school meeting again. The earlier calendar check and invitation are no longer active." } : entry);
      }
      unschedule(assessmentTimer); assessmentTimer = null; calendarAssessment = null;
      const previous = active;
      active = null; accepted = null; result = null;
      messages = messages.map(entry => entry.kind === "activity_results" ? {
        ...entry, kind: "status", text: "Earlier suggestions", cardIds: []
      } : entry);
      if (previous) {
        unschedule(previous.timer);
        previous.controller.abort();
        previous.finish();
      }
    }
    function live(record) {
      return !disposed && active === record && generation === record.request.generation && current.triggerState === "active";
    }
    function stopRequest(record, outcome) {
      if (!live(record)) return;
      invalidate(); status = outcome; publish();
    }
    function calendarChanged() {
      if (disposed || status === "preparing" || current.triggerState === "not_started") return;
      invalidate(); status = "calendar_changed"; publish();
    }
    function meetingCommand(action) {
      try {
        const answer = coordinateMeeting?.(action);
        const allowed = { review: ["ask", "invited", "unavailable"], send_invitation: ["invited", "unavailable"],
          decline: ["declined", "unavailable"], cancel: ["cancelled", "unavailable"] };
        if (!answer || !allowed[action].includes(answer.state) ||
          Object.keys(answer).sort().join() !== (answer.state === "ask" ? "overlapMinutes,state" : "state") ||
          answer.state === "ask" && (!Number.isInteger(answer.overlapMinutes) || answer.overlapMinutes <= 0 || answer.overlapMinutes > 60)) return { state: "unavailable" };
        return answer;
      } catch { return { state: "unavailable" }; }
    }
    function reviewMeeting() {
      if (disposed || active || meetingPreparation || invitationPreparation || !["not_started", "active"].includes(current.triggerState)) return Promise.resolve();
      if (messages.length > 16) messages = [messages[0], ...messages.slice(-13)];
      if (current.triggerState === "not_started") {
        current.sessionId = nextId("session"); current.triggerState = "active";
        if (prepareSession) {
          let finish;
          const promise = new Promise(resolve => { finish = resolve; });
          const record = { promise, finish, timer: null };
          meetingPreparation = record; meetingState = "loading"; status = "preparing";
          const complete = failed => {
            if (disposed || meetingPreparation !== record) return;
            unschedule(record.timer); meetingPreparation = null; status = "ready";
            if (failed) {
              meetingState = "unavailable";
              message("assistant", "meeting_status", "I couldn't check both calendars. Please review the school meeting again before inviting Parent A.");
              publish();
            } else reviewMeeting();
            finish();
          };
          record.timer = schedule(() => complete(true), 10000);
          publish();
          if (meetingPreparation !== record) return promise;
          try { Promise.resolve(prepareSession()).then(() => complete(false), () => complete(true)); }
          catch { complete(true); }
          return promise;
        }
      }
      const reviewGeneration = generation;
      status = "checking_meeting"; publish();
      if (disposed || generation !== reviewGeneration || current.triggerState !== "active") return;
      const answer = meetingCommand("review");
      meetingState = answer.state;
      status = result?.status || "ready";
      message("assistant", "meeting_question", answer.state === "ask" ?
        `Your work meeting overlaps by ${answer.overlapMinutes === 30 ? "half an hour" : `${answer.overlapMinutes} minutes`}. Parent A's calendar looks clear then. If only one parent needs to attend, shall I invite Parent A to Child's school meeting on Friday, October 16, 2026, 3:30-4:30 PM (Asia/Taipei)?` :
        answer.state === "invited" ? invitationResult :
        "I can't confirm an alternative from both calendars. Please check the school meeting again before inviting Parent A.");
      publish();
    }
    function replyToMeeting(text) {
      const answer = text.trim().toLowerCase().replace(/[.!?。！？]+$/, "");
      if (messages.length > 16) messages = [messages[0], ...messages.slice(-13)];
      message("parent", "text", text);
      if (["continue activities", "back to activities", "繼續活動"].includes(answer)) {
        if (messages.length > 12) messages = [messages[0], ...messages.slice(-9)];
        meetingCommand("cancel"); meetingState = null;
        message("assistant", "meeting_status", "Let's return to activity ideas. We'll leave the school-meeting invitation aside.");
      } else if (["cancel", "undo", "cancel proposal", "取消", "撤回"].includes(answer)) {
        meetingCommand("cancel"); meetingState = "closed";
        message("assistant", "meeting_status", "Okay, I'll leave the invitation aside.");
      } else if (["no", "both parents need to attend", "不", "不是", "兩位都要"].includes(answer)) {
        meetingCommand("decline"); meetingState = "closed";
        message("assistant", "meeting_status", "I won't invite Parent A.");
      } else if (meetingState === "ask" && ["yes, one parent is enough. please send parent a an invitation", "yes, please send parent a an invitation"].includes(answer)) {
        const invitationGeneration = generation;
        let finish;
        const promise = new Promise(resolve => { finish = resolve; });
        const record = { promise, finish, timer: null, controller: new AbortController() };
        invitationPreparation = record;
        const complete = failed => {
          if (disposed || invitationPreparation !== record || generation !== invitationGeneration || current.triggerState !== "active") return;
          invitationPreparation = null; unschedule(record.timer); record.controller.abort();
          const result = failed ? { state: "unavailable" } : meetingCommand("send_invitation");
          if (failed) meetingCommand("cancel");
          meetingState = result.state; status = "ready";
          message("assistant", "meeting_invitation", result.state === "invited" ? invitationResult :
            "The calendar check is no longer current or complete. Please review the school meeting again before inviting Parent A.");
          publish(); finish();
        };
        record.timer = schedule(() => complete(true), 10000);
        status = "sending_demo_invitation"; publish();
        if (invitationPreparation !== record) return promise;
        try { Promise.resolve(prepareInvitation?.({ signal: record.controller.signal })).then(() => complete(false), () => complete(true)); }
        catch { complete(true); }
        return promise;
      } else {
        message("assistant", "meeting_status", meetingState === "ask" ?
          "If one parent is enough, shall I invite Parent A? Please explicitly ask me to send the invitation, or say No or Cancel." : meetingState === "invited" ?
          "Parent A's invitation is already awaiting his response." :
          "Please review the school meeting again, or say Continue activities.");
      }
      publish();
    }
    function assess(value) {
      if (!assessActivities) return null;
      const occurrences = value.items.map(item => ({ id: Contract.activityCardId(item), startAt: item.startAt,
        endAt: item.endAt, timeZone: item.timeZone }));
      try {
        const answer = assessActivities(occurrences);
        const exact = (object, keys) => object && typeof object === "object" && !Array.isArray(object) &&
          Object.keys(object).sort().join() === keys.sort().join();
        const reasons = { no_conflict: ["no_busy_reported"], conflict: ["busy"],
          unknown: ["invalid_timing", "outside_coverage", "unavailable", "stale", "incomplete"] };
        if (!exact(answer, ["version", "revision", "checkedAt", "coverage", "expiresAt", "items"]) ||
          answer.version !== "familycopilot.calendar-fit.v1" || !Number.isSafeInteger(answer.revision) || answer.revision < 0 ||
          !Number.isFinite(Date.parse(answer.checkedAt)) ||
          !exact(answer.coverage, ["startAt", "endAt", "timeZone"]) || answer.coverage.timeZone !== "Asia/Taipei" ||
          !["2026-10-08T16:00:00Z/2026-10-15T16:00:00Z", "2026-09-30T16:00:00Z/2026-10-31T16:00:00Z"].includes(`${answer.coverage.startAt}/${answer.coverage.endAt}`) ||
          answer.expiresAt !== null && (!Number.isFinite(Date.parse(answer.expiresAt)) ||
            Date.parse(answer.expiresAt) <= Date.now() || Date.parse(answer.expiresAt) > Date.parse(answer.checkedAt) + 300000) ||
          !Array.isArray(answer.items) || answer.items.length !== occurrences.length ||
          answer.items.some((item, index) => !exact(item, ["id", "status", "reason"]) || item.id !== occurrences[index].id ||
            !Object.hasOwn(reasons, item.status) || !reasons[item.status].includes(item.reason) ||
            item.status !== "unknown" && (answer.expiresAt === null ||
              !Number.isFinite(Date.parse(occurrences[index].endAt)) ||
              Date.parse(occurrences[index].startAt) < Date.parse(answer.coverage.startAt) ||
              Date.parse(occurrences[index].endAt) > Date.parse(answer.coverage.endAt)))) throw Error("invalid_assessment");
        return copy(answer);
      } catch {
        return { version: "familycopilot.calendar-fit.v1", revision: 0, checkedAt: new Date().toISOString(),
          coverage: { startAt: "2026-09-30T16:00:00Z", endAt: "2026-10-31T16:00:00Z", timeZone: "Asia/Taipei" }, expiresAt: null,
          items: occurrences.map(item => ({ id: item.id, status: "unknown", reason: "unavailable" })) };
      }
    }
    function requestFor(kind) {
      return { version: current.version, requestId: "pending", generation: generation + 1,
        contextRevision: current.contextRevision, referenceNow: current.referenceNow, range: copy(current.activityRange),
        mode: current.mode, trigger: { kind, actionId: "pending" }, preferences: copy(current.preferences) };
    }
    function canRefine(value) {
      return value && (["results", "unknown", "empty"].includes(value.status) ||
        value.status === "partial" && value.items.length > 0 && value.sources.every(source => source.kind === "public_snapshot"));
    }
    function dispatch(kind) {
      if (disposed || current.triggerState !== "active") return Promise.resolve();
      const request = requestFor(kind);
      const key = Contract.activityRequestKey(request);
      if (active && active.key === key && active.request.contextRevision === current.contextRevision) return active.promise;
      if (kind !== "explicit_retry") {
        if (accepted && accepted.key === key && accepted.request.contextRevision === current.contextRevision &&
            canRefine(result)) return Promise.resolve();
        if (accepted && accepted.key === key) { status = "retry_required"; publish(); return Promise.resolve(); }
      }
      if (dispatched >= 3) { status = "budget_exhausted"; publish(); return Promise.resolve(); }
      if (messages.length >= 20) { status = "message_limit"; publish(); return Promise.resolve(); }
      invalidate();
      request.generation = generation;
      request.requestId = nextId("request"); request.trigger.actionId = nextId("action");
      const controller = new AbortController();
      let finish;
      const promise = new Promise(resolve => { finish = resolve; });
      const record = { request, key, controller, promise, finish, timer: null, preparing: kind === "demo_start" && prepareSession !== null };
      active = record; dispatched++; status = record.preparing ? "preparing" : "loading";
      const awaitingPreparation = record.preparing;
      record.timer = schedule(() => {
        if (record.preparing === awaitingPreparation) stopRequest(record, awaitingPreparation ? "preparation_timeout" : "request_timeout");
      }, 10000);
      publish();
      if (!live(record)) return promise;
      function search() {
        if (!live(record)) return;
        if (record.preparing) {
          unschedule(record.timer); record.preparing = false;
          record.timer = schedule(() => stopRequest(record, "request_timeout"), 10000);
          status = "loading"; publish();
          if (!live(record)) return;
        }
        let work;
        try { work = searchActivities(copy(request), { signal: controller.signal }); }
        catch { stopRequest(record, "search_unavailable"); return; }
        Promise.resolve(work).then(value => {
          if (!live(record)) return;
          if (!Contract.validateActivityResult(value, request)) { stopRequest(record, "invalid_result"); return; }
          if (assessActivities) { status = "checking_calendar"; publish(); }
          if (!live(record)) return;
          const assessment = assess(value);
          if (!live(record)) return;
          calendarAssessment = assessment;
          unschedule(record.timer); active = null; accepted = record;
          result = copy(value);
          if (calendarAssessment) {
            const conflicts = new Set(calendarAssessment.items.filter(item => item.status === "conflict").map(item => item.id));
            result.items = result.items.filter(item => !conflicts.has(Contract.activityCardId(item)));
            if (!["partial", "unavailable"].includes(result.status)) {
              result.status = result.items.length ? result.items.every(item => item.assessment === "needs_checking") ? "unknown" : "results" : "empty";
              if (!result.items.length && conflicts.size) {
                result.issues = result.issues.filter(issue => issue.code !== "evidence_unknown");
                result.issues.push({ code: "no_matches", sourceId: null, message: "All returned options overlap the loaded calendars." });
              }
            }
            if (calendarAssessment.expiresAt !== null) assessmentTimer = schedule(() => {
              if (accepted === record) calendarChanged();
            }, Math.max(0, Date.parse(calendarAssessment.expiresAt) - Date.now()));
          }
          status = result.status;
          const reply = result.items.length === 1 && result.items[0].category === "movie" ?
            "Explore this movie for the weekend." : result.items.length ? "Here are some ideas for your family." :
            "I couldn't find a matching activity in this shortlist.";
          message("assistant", "activity_results", reply,
            request.requestId, result.items.map(Contract.activityCardId));
          record.finish(); publish();
        }, () => stopRequest(record, "search_unavailable"));
      }
      if (record.preparing) {
        try { Promise.resolve(prepareSession()).then(search, search); }
        catch { search(); }
      } else search();
      return promise;
    }
    function start() {
      if (disposed || meetingPreparation || demoStep !== 0 || !["not_started", "active"].includes(current.triggerState)) return active ? active.promise : Promise.resolve();
      current.sessionId = nextId("session"); current.triggerState = "active";
      demoStep = 1;
      const preferences = current.preferences;
      message("assistant", "status", `I'll use your interests (${preferences.interests.join(", ") || "none selected"}), ${preferences.preferredTeams.length ? "preferred team " + preferences.preferredTeams.join(", ") : "no preferred team"}, age ${preferences.ages[0]}, and ${preferences.origin.area}. I'll show which preferences match and flag anything I can't verify.`);
      message("assistant", "status", `Here are some ideas for ${current.activityRange.startDate} to ${current.activityRange.endDate} (${current.timeZone}).`);
      return dispatch("demo_start");
    }
    function refine(range) {
      if (disposed || current.triggerState !== "active") return Promise.resolve();
      const candidate = requestFor("refinement_submit"); candidate.range = range;
      if (!Contract.validateActivityRequest(candidate)) { status = "needs_clarification"; publish(); return Promise.resolve(); }
      const changed = JSON.stringify(current.activityRange) !== JSON.stringify(range);
      if (!changed) return dispatch("refinement_submit");
      if (dispatched >= 3) { status = "budget_exhausted"; publish(); return Promise.resolve(); }
      if (messages.length > 18) { status = "message_limit"; publish(); return Promise.resolve(); }
      invalidate(); current.contextRevision++; current.activityRange = copy(range);
      message("assistant", "interpretation", `Let's look sooner: ${range.startDate} to ${range.endDate} (${range.timeZone}).`);
      return dispatch("refinement_submit");
    }
    function submit(text) {
      if (disposed || !["not_started", "active"].includes(current.triggerState)) return Promise.resolve();
      if (invitationPreparation) return invitationPreparation.promise;
      if (meetingPreparation) return meetingPreparation.promise;
      if (active) return active.promise;
      if (typeof text !== "string" || !text.trim() || text.length > 500 || /[\u0000-\u001f\u007f]/.test(text)) {
        status = "needs_clarification"; publish(); return Promise.resolve();
      }
      const meetingRequest = ["can you check my schedule for the school meeting", "review school meeting", "review a school meeting", "school meeting"].includes(text.trim().toLowerCase().replace(/[.!?]+$/, ""));
      if (meetingState && !meetingRequest) {
        return replyToMeeting(text) || Promise.resolve();
      }
      if (meetingRequest) {
        message("parent", "text", text); return reviewMeeting();
      }
      if (messages.length > 16) { status = "message_limit"; publish(); return Promise.resolve(); }
      if (demoStep === 0) {
        lastSubmission = text.trim();
        message("parent", "text", text);
        return start();
      }
      if (!accepted || !canRefine(result)) {
        status = "retry_required"; publish(); return Promise.resolve();
      }
      if (text.trim() === lastSubmission) return Promise.resolve();
      if (demoStep === 2) {
        if (status !== "demo_complete") {
          message("assistant", "status", "This conversation's supported requests are complete. Start a new conversation to begin again; further messages are not interpreted.");
          status = "demo_complete"; publish();
        }
        return Promise.resolve();
      }
      const range = interpretWeekend("this weekend", current.referenceNow, current.timeZone);
      if (!range) { status = "needs_clarification"; publish(); return Promise.resolve(); }
      if (dispatched >= 3) { status = "budget_exhausted"; publish(); return Promise.resolve(); }
      demoStep = 2; lastSubmission = text.trim();
      message("parent", "text", text);
      const work = refine(range); publish(); return work;
    }
    function applyPreferences(preferences) {
      if (disposed || !Contract.validateDemoContext({ ...current, preferences })) return false;
      const next = copy(preferences);
      const interestsChanged = JSON.stringify([...next.interests].sort()) !== JSON.stringify([...current.preferences.interests].sort());
      next.interestBasis = interestsChanged ? "parent_confirmed" : current.preferences.interestBasis;
      if (JSON.stringify(next) === JSON.stringify(current.preferences)) return true;
      const candidate = { ...current, contextRevision: current.contextRevision + 1, preferences: next };
      if (!Contract.validateDemoContext(candidate)) return false;
      invalidate(); current = candidate;
      status = current.triggerState === "active" ? "preferences_updated" : current.triggerState;
      publish(); return true;
    }
    function pause() {
      if (disposed || current.triggerState !== "active") return;
      if (meetingState) { meetingCommand("cancel"); meetingState = "closed"; }
      invalidate(); current.triggerState = "paused"; status = "paused"; publish();
    }
    function resume() {
      if (disposed || current.triggerState !== "paused") return;
      current.triggerState = "active"; status = "ready"; publish();
    }
    function reset() {
      if (disposed) return;
      if (meetingState) meetingCommand("cancel");
      meetingState = null;
      invalidate(); current = copy(seed); current.sessionId = nextId("session"); current.triggerState = "not_started";
      messages = []; dispatched = 0; demoStep = 0; lastSubmission = null; status = "not_started"; publish();
    }
    function dispose() {
      if (disposed) return;
      if (meetingState) meetingCommand("cancel");
      meetingState = null;
      invalidate(); disposed = true; current = copy(seed); current.triggerState = "ended";
      current.sessionId = nextId("session");
      messages = []; dispatched = 0; demoStep = 0; lastSubmission = null; status = "ended"; publish();
    }
    return Object.freeze({ start, submit, refine, applyPreferences, calendarChanged, reviewMeeting, retry: () => dispatch("explicit_retry"), pause, resume, reset,
      end: reset, dispose, snapshot });
  }
  const api = Object.freeze({ initialContext, interpretWeekend, createConversation });
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.FamilyChatConversation = api;
})(globalThis);