"use strict";
(function(root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./availability-core"), require("./child-calendar-core"));
  else root.FamilyCalendarFixtures = factory(root.OwnerAvailability, root.ChildCalendar);
})(globalThis, (availability, child) => {
  const scenarios = Object.freeze(["partial", "loaded", "busy", "missing", "stale", "unavailable", "revoked", "cleanup_failed"]);
  function create({ now = () => Date.now(), scenario = () => "partial", syntheticOctober = false } = {}) {
    const availabilityCore = syntheticOctober ? availability.forSyntheticOctober() : availability;
    const childCore = syntheticOctober ? child.forSyntheticOctober() : child;
    const dates = new Map();
    let parentSnapshot, childSnapshot, generation = 0, closed = false;
    let parentVisible = false, childVisible = false;
    const listeners = new Set();
    function invalidateAssessment() {
      generation++;
      for (const listener of listeners) listener();
    }
    function subscribeAssessment(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
    function assessOccurrences(occurrences) {
      if (!Array.isArray(occurrences) || occurrences.length > 40 || occurrences.some(item =>
        !child.exact(item, ["id", "startAt", "endAt", "timeZone"]) || typeof item.id !== "string" || item.id.length > 500 ||
        item.timeZone !== "Asia/Taipei")) throw new Error("invalid_assessment_request");
      const instant = now(), start = Date.parse(childCore.window.start), end = Date.parse(childCore.window.end);
      const parents = !closed && parentVisible ? parentSnapshot : null;
      const childData = !closed && childVisible ? childSnapshot?.data : null;
      const fresh = data => data && instant >= Date.parse(data.checkedAt) && instant < Date.parse(data.checkedAt) + 300000;
      const items = occurrences.map(item => {
        let from, to;
        try { from = child.timestamp(item.startAt); to = child.timestamp(item.endAt); } catch {}
        let reason = "incomplete", status = "unknown";
        if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) reason = "invalid_timing";
        else if (from < start || to > end) reason = "outside_coverage";
        else if (!parents || !childData) reason = "unavailable";
        else if (!fresh(parents) || !fresh(childData)) reason = "stale";
        else {
          const first = Math.floor((from - Date.parse(parents.window.start)) / 1800000);
          const last = Math.ceil((to - Date.parse(parents.window.start)) / 1800000);
          const slots = parents.people.flatMap(person => person.slots.slice(first, last));
          const overlaps = childData.events.filter(event => event.status !== "cancelled" &&
            Date.parse(event.start) < to && Date.parse(event.end) > from);
          if (slots.some(value => ["busy", "tentative", "oof"].includes(value)) || overlaps.some(event => event.status === "scheduled")) {
            status = "conflict"; reason = "busy";
          } else if (from >= Date.parse(parents.window.start) && to <= Date.parse(parents.window.end) &&
            parents.people.length === 2 && slots.length === (last - first) * 2 &&
            slots.every(value => value === "free_or_elsewhere") && !childData.partial && overlaps.length === 0) {
            status = "no_conflict"; reason = "no_busy_reported";
          }
        }
        return { id: item.id, status, reason };
      });
      return { version: "familycopilot.calendar-fit.v1", revision: generation, checkedAt: new Date(instant).toISOString(),
        coverage: { startAt: childCore.window.start, endAt: childCore.window.end, timeZone: "Asia/Taipei" },
        expiresAt: fresh(parents) && fresh(childData) ? new Date(Math.min(Date.parse(parents.checkedAt), Date.parse(childData.checkedAt)) + 300000).toISOString() : null,
        items };
    }
    function candidateTimes() {
      const result = assessOccurrences([]), items = [];
      let uncertain = false;
      const halfHour = 1800000, dayLength = 86400000;
      for (let day = Date.parse(result.coverage.startAt); day < Date.parse(result.coverage.endAt); day += dayLength) {
        const local = new Date(day + 8 * 3600000);
        if (![0, 6].includes(local.getUTCDay())) continue;
        const intervals = Array.from({ length: 22 }, (_, index) => ({ id: String(index),
          startAt: new Date(day + (18 + index) * halfHour).toISOString(),
          endAt: new Date(day + (19 + index) * halfHour).toISOString(), timeZone: "Asia/Taipei" }));
        const assessment = assessOccurrences(intervals);
        let run = null, longest = null;
        for (const [index, item] of assessment.items.entries()) {
          if (item.status === "unknown") uncertain = true;
          if (item.status === "no_conflict") {
            run = { startAt: run?.startAt || intervals[index].startAt, endAt: intervals[index].endAt, timeZone: "Asia/Taipei" };
            if (!longest || Date.parse(run.endAt) - Date.parse(run.startAt) > Date.parse(longest.endAt) - Date.parse(longest.startAt)) longest = run;
          } else run = null;
        }
        if (longest && Date.parse(longest.endAt) - Date.parse(longest.startAt) >= 4 * halfHour) items.push(longest);
      }
      const selected = [], weeks = new Set(), times = new Set();
      const add = item => {
        const time = item.startAt.slice(11) + item.endAt.slice(11);
        if (selected.length >= 6 || selected.includes(item) || times.has(time)) return;
        selected.push(item); times.add(time);
      };
      for (const item of items) {
        const local = new Date(Date.parse(item.startAt) + 8 * 3600000);
        const week = Math.floor((local.getUTCDate() + 2) / 7);
        if (!weeks.has(week)) { add(item); weeks.add(week); }
      }
      for (const item of items) add(item);
      selected.sort((first, second) => first.startAt.localeCompare(second.startAt));
      return { status: selected.length ? "candidates" : uncertain ? "unknown" : "empty",
        checkedAt: result.checkedAt, expiresAt: result.expiresAt, items: selected };
    }
    function coordination() {
      const schoolEvents = childVisible ? childSnapshot?.data.events.filter(event => event.title === "School meeting" && event.status === "scheduled") || [] : [];
      const event = schoolEvents.length === 1 ? schoolEvents[0] : null;
      const meeting = event ? { startAt: event.start, endAt: event.end, timeZone: "Asia/Taipei" } : null;
      if (!meeting) return { revision: generation, expiresAt: null, meeting: null, status: "unknown", people: [] };
      const assessment = assessOccurrences([{ id: "school-meeting", ...meeting }]);
      const result = { revision: generation, expiresAt: assessment.expiresAt, meeting, status: "unknown", people: [] };
      if (!syntheticOctober || assessment.items[0].status === "unknown" || childSnapshot?.data.partial) return result;
      const from = Date.parse(meeting.startAt), to = Date.parse(meeting.endAt), start = Date.parse(parentSnapshot.window.start);
      for (const person of parentSnapshot.people) {
        let overlapMinutes = 0, unknown = person.status !== "checked";
        const busy = [];
        for (let index = 0; index < person.slots.length; index++) {
          const slotStart = start + index * 1800000, slotEnd = slotStart + 1800000;
          const overlap = Math.max(0, Math.min(to, slotEnd) - Math.max(from, slotStart));
          if (overlap && person.slots[index] === "unknown") unknown = true;
          if (!["busy", "tentative", "oof"].includes(person.slots[index])) continue;
          if (slotStart >= Date.parse("2026-10-16T14:00:00+08:00") && slotEnd <= Date.parse("2026-10-16T18:00:00+08:00")) {
            if (busy.at(-1)?.endAt === new Date(slotStart).toISOString()) busy.at(-1).endAt = new Date(slotEnd).toISOString();
            else busy.push({ startAt: new Date(slotStart).toISOString(), endAt: new Date(slotEnd).toISOString() });
          }
          overlapMinutes += overlap / 60000;
        }
        result.people.push({ person: person.person, status: unknown ? "unknown" : overlapMinutes ? "conflict" : "no_conflict", overlapMinutes, busy });
      }
      result.status = result.people.some(person => person.status === "unknown") ? "unknown" : "checked";
      return result;
    }
    const storage = Object.freeze({ getItem: key => dates.get(key) ?? null,
      setItem: (key, value) => { dates.set(key, value); }, removeItem: key => { dates.delete(key); } });
    const checkedAt = age => new Date(now() - age).toISOString();
    function monthStatus(window, index, person) {
      const local = new Date(Date.parse(window.start) + index * 1800000 + 8 * 3600000);
      const day = local.getUTCDate(), hour = local.getUTCHours() + local.getUTCMinutes() / 60;
      const plans = {
        3: [[12, 16], [16, 20]], 4: [[9, 14], [17, 20]],
        10: [[9, 13], [19, 20]], 11: [[9, 12], [17, 20]],
        17: [[9, 10], [12, 20]], 18: [[9, 11], [14, 20]],
        24: [[9, 15], [18, 20]], 25: [[9, 12.5], [16, 20]],
        31: [[9, 10.5], [14.5, 20]]
      };
      const intervals = plans[day] ? [plans[day][person]] : day === 16 ?
        person === 1 ? [[9, 12], [15, 16]] : [[9, 12], [17, 18]] : [[9, person === 0 ? 17 : 16.5]];
      return intervals.some(([start, end]) => hour >= start && hour < end) ? "busy" : "free_or_elsewhere";
    }
    function parent(window, choice) {
      return { synthetic: true, cleanup: "workflow_disabled", window, checkedAt: checkedAt(choice === "stale" ? 600000 : 0),
        people: [0, 1].map(person => ({ person, status: choice === "partial" && person === 1 ? "partial" : "checked",
          slots: Array.from({ length: window.slots }, (_, index) => choice === "busy" ? "busy" : choice === "partial" && person === 1 && index % 48 < 16
            ? "unknown" : syntheticOctober ? monthStatus(window, index, person) : index % 48 >= 18 && index % 48 < 22 ? "busy" : "free_or_elsewhere") })) };
    }
    function childSaved(choice, fresh) {
      return childCore.saved({ status: "saved", access: { person: "Kimi", guardian: true, disclosure: "details", sourceName: "Fictional shared source" },
        data: { contract: childCore.contract, window: { ...childCore.window }, checkedAt: checkedAt(choice === "stale" ? 660000 : fresh ? 0 : 60000),
          partial: choice === "partial", events: [{ title: "Studio visit", start: "2026-10-09T10:00:00+08:00",
            end: "2026-10-09T11:00:00+08:00", allDay: false, status: "scheduled", kind: "singleInstance", redacted: false },
            ...(syntheticOctober ? [{ title: "Swimming lesson", start: "2026-10-03T16:00:00+08:00", end: "2026-10-03T17:00:00+08:00",
              allDay: false, status: "scheduled", kind: "singleInstance", redacted: false },
              { title: "Family lunch", start: "2026-10-04T12:00:00+08:00", end: "2026-10-04T14:00:00+08:00",
                allDay: false, status: "scheduled", kind: "singleInstance", redacted: false },
              { title: "School meeting", start: "2026-10-16T15:30:00+08:00", end: "2026-10-16T16:30:00+08:00",
                allDay: false, status: "scheduled", kind: "singleInstance", redacted: false }] : [])] } }, now());
    }
    async function fetch(path, options) {
      const invalid = () => { throw new Error("calendar_fixture_request_rejected"); };
      if (!options || options.method !== "POST" || options.credentials !== "omit" || options.cache !== "no-store" || options.redirect !== "error") invalid();
      let body;
      try { body = JSON.parse(options.body); } catch { invalid(); }
      const choice = scenario();
      if (!scenarios.includes(choice) || !body || typeof body !== "object" || Array.isArray(body)) invalid();
      const respond = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
      if (["/api/clear", "/api/child/clear", "/api/child/edit"].includes(path)) {
        if (!child.exact(body, []) && !(child.exact(body, ["reason"]) && ["leave", "range", "cancel"].includes(body.reason))) invalid();
        parentVisible = false; childVisible = false; invalidateAssessment();
        if (body.reason === "leave") closed = true;
        if (choice === "cleanup_failed") return respond({ status: "cleanup_failed", cleanup: "cleanup_failed" }, 503);
        if (!body.reason && path !== "/api/child/edit") {
          childSnapshot = undefined;
          if (path === "/api/clear") parentSnapshot = undefined;
        }
        return respond(path === "/api/clear" ? { status: "cleared", cleanup: "not_requested" } : { status: "cleared" });
      }
      if (closed) invalid();
      if (path === "/api/status" && child.exact(body, [])) return respond({ status: "idle", cleanup: "not_requested" });
      const isParent = path === "/api/availability", isSync = path === "/api/child/sync";
      if (!isParent && !isSync && path !== "/api/child/saved") invalid();
      const keys = ["acknowledged", "startDate", "endDate", ...(isParent ? ["requestId", "refresh", ...(Object.hasOwn(body, "cacheOnly") ? ["cacheOnly"] : [])] : isSync ? ["refresh"] : [])];
      if (!child.exact(body, keys) || body.acknowledged !== true || (isParent || isSync) && typeof body.refresh !== "boolean" ||
        isParent && (typeof body.requestId !== "string" || !/^[a-f0-9-]{36}$/.test(body.requestId) || Object.hasOwn(body, "cacheOnly") && body.cacheOnly !== true)) invalid();
      let window;
      try { window = availabilityCore.dateRange(body.startDate, body.endDate); } catch { invalid(); }
      if (!isParent && !childCore.datesAllowed(body.startDate, body.endDate)) invalid();
      if (isParent) parentVisible = false; else childVisible = false;
      invalidateAssessment();
      const version = generation;
      await Promise.resolve();
      if (options.signal?.aborted || version !== generation || closed) throw new Error("calendar_fixture_cancelled");
      if (["unavailable", "revoked", "cleanup_failed"].includes(choice)) {
        return respond({ status: choice, cleanup: choice === "cleanup_failed" ? choice : "workflow_disabled", synthetic: true }, 503);
      }
      if (choice === "missing") return respond(isParent ? { status: "cache_missing", cleanup: "not_requested", synthetic: true }
        : { status: isSync ? "source_missing" : "cache_missing" });
      if (isParent) {
        const matching = parentSnapshot && parentSnapshot.window.start === window.start && parentSnapshot.window.end === window.end;
        if (body.cacheOnly && !matching) return respond({ status: "cache_missing", cleanup: "not_requested", synthetic: true });
        const cached = !!matching && !body.refresh;
        if (!cached) parentSnapshot = parent(window, choice);
        parentVisible = true;
        return respond({ ...parentSnapshot, cached });
      }
      if (!isSync && !childSnapshot) return respond({ status: "cache_missing" });
      if (!childSnapshot || body.refresh) childSnapshot = childSaved(choice, body.refresh === true);
      childVisible = true;
      return respond(childSnapshot);
    }
    return Object.freeze({ fetch, storage, assessOccurrences, subscribeAssessment, candidateTimes, coordination });
  }
  return Object.freeze({ create, scenarios });
});