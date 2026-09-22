"use strict";
(function(root, factory) {
  const api = factory();
  api.forSyntheticOctober = () => factory(true);
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.OwnerAvailability = api;
})(globalThis, function(syntheticOctober = false) {
  const window = Object.freeze({ start: "2026-09-19T16:00:00Z", end: "2026-09-26T16:00:00Z", timezone: "Asia/Taipei", interval: 30, slots: 336 });
  // Historical September fixtures stay frozen; only this bounded live demo moves.
  const liveWindow = Object.freeze(syntheticOctober
    ? { start: "2026-09-30T16:00:00Z", end: "2026-10-31T16:00:00Z", timezone: "Asia/Taipei", interval: 30, slots: 1488 }
    : { start: "2026-10-08T16:00:00Z", end: "2026-10-15T16:00:00Z", timezone: "Asia/Taipei", interval: 30, slots: 336 });
  function dateRange(startDate, endDate) {
    const parse = value => {
      if (typeof value !== "string" || !/^(20\d\d|2100)-\d{2}-\d{2}$/.test(value)) throw new Error("invalid_date_range");
      const time = Date.parse(`${value}T00:00:00Z`);
      if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) throw new Error("invalid_date_range");
      return time;
    };
    const start = parse(startDate), end = parse(endDate), days = (end - start) / 86400000 + 1;
    const limit = syntheticOctober && startDate >= "2026-10-01" && endDate <= "2026-10-31" ? 31 : 7;
    if (days < 1 || days > limit) throw new Error("invalid_date_range");
    const iso = value => new Date(value).toISOString().replace(".000Z", "Z");
    return { start: iso(start - 8 * 3600000), end: iso(end + 16 * 3600000), timezone: "Asia/Taipei", interval: 30, slots: days * 48 };
  }
  function validateWindow(value) {
    try {
      if (!value || Object.keys(value).length !== 5 || typeof value.start !== "string" || typeof value.end !== "string") return false;
      const local = time => new Date(time + 8 * 3600000).toISOString().slice(0, 10);
      const expected = dateRange(local(Date.parse(value.start)), local(Date.parse(value.end) - 1));
      return Object.keys(expected).every(k => expected[k] === value[k]);
    } catch { return false; }
  }
  // UI scope resolution only, not provider authorization. A contained display
  // selection uses the existing bounded week; unsupported dates stay explicit.
  function calendarWindow(selection) {
    if (!validateWindow(selection)) return null;
    return { ...(selection.start >= liveWindow.start && selection.end <= liveWindow.end ? liveWindow : selection) };
  }
  function displayWindow(selection) {
    if (!validateWindow(selection)) return null;
    return dateRange(slotTime(0, selection).date, slotTime(Math.min(144, selection.slots) - 1, selection).date);
  }
  function displayPages(selection) {
    const scope = calendarWindow(selection), initial = displayWindow(selection);
    if (!scope || !initial) return [];
    const page = (start, end) => dateRange(slotTime(start, scope).date, slotTime(end - 1, scope).date);
    const offset = (Date.parse(initial.start) - Date.parse(scope.start)) / 1800000;
    const pages = [initial];
    // Anchor the initial subset so Previous/Next are exact inverses, even for
    // remembered one-/two-day views. Final pages shrink, never overlap or clamp.
    for (let end = offset; end > 0; end -= 144) pages.unshift(page(Math.max(0, end - 144), end));
    for (let start = offset + initial.slots; start < scope.slots; start += 144) pages.push(page(start, Math.min(scope.slots, start + 144)));
    return pages;
  }
  // Bounded allowance for two 336-element enum arrays, including service whitespace.
  const responseLimit = (syntheticOctober ? 96 : 24) * 1024;
  const labels = Object.freeze({ free_or_elsewhere: "No busy block reported (may be working elsewhere)", tentative: "Tentative", busy: "Busy", oof: "Out of office", unknown: "Unknown" });
  const unknown = (person, status = "missing", selectedWindow = window) => ({ person, status, slots: Array(selectedWindow.slots).fill("unknown") });
  function project(data, window = api.window) {
    if (!validateWindow(window)) throw new Error("invalid_date_range");
    if (!data || !data.window || Object.keys(window).some(k => data.window[k] !== window[k]) ||
      Object.keys(data.window).length !== Object.keys(window).length || typeof data.checkedAt !== "string" ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,7})?Z$/.test(data.checkedAt) || !Number.isFinite(Date.parse(data.checkedAt)) ||
      !Array.isArray(data.people) || data.people.length > 2) throw new Error("invalid_provider_response");
    const people = [0, 1].map(person => {
      const rows = data.people.filter(p => p?.person === person);
      if (rows.length !== 1) return unknown(person, rows.length ? "invalid" : "missing", window);
      const p = rows[0];
      if (!["checked", "partial", "missing", "invalid", "unavailable"].includes(p.status)) return unknown(person, "invalid", window);
      if (!["checked", "partial"].includes(p.status)) return unknown(person, p.status, window);
      if (!Array.isArray(p.slots) || p.slots.length !== window.slots) return unknown(person, "invalid", window);
      const slots = Array.from(p.slots, s => Object.hasOwn(labels, s) && typeof s === "string" ? s : "unknown");
      return { person, status: slots.includes("unknown") ? "partial" : "checked", slots };
    });
    return { window: { ...window }, checkedAt: data.checkedAt, people };
  }
  function initial(generation = 0, used = false) { return { generation, used, phase: "idle", data: null }; }
  function transition(state, action) {
    if (action.type === "clear") return { ...initial(state.generation + 1, state.used), phase: "cleared" };
    if (action.type === "load" && state.phase !== "loading" && (!state.used || state.phase === "loaded" || action.refresh && state.phase === "unavailable") && action.acknowledged) return { ...initial(state.generation + 1, true), phase: "loading" };
    if (state.phase !== "loading" || action.generation !== state.generation) return state;
    if (action.type === "loaded") { try { return { ...state, phase: "loaded", data: project(action.data, action.window || window), cached: action.data.cached === true }; } catch { return { ...state, phase: "unavailable", data: null }; } }
    if (action.type === "failed") return { ...state, phase: "unavailable", data: null };
    return state;
  }
  function freshness(data, now = Date.now()) {
    const age = now - Date.parse(data?.checkedAt);
    return Number.isFinite(age) && age >= 0 && age <= 5 * 60000 ? "Snapshot (not continuously refreshed)" : "Stale or unknown freshness · Do not infer current availability";
  }
  function sessionUnavailable(data) { return data?.status === "blocked" && data?.reason === "session_unavailable"; }
  function failureText(data) {
    if (sessionUnavailable(data)) return "Page session expired or unavailable · This request was rejected locally before Azure. Reload the owner page, then review again. No automatic retry; neither row establishes availability.";
    const errors = {
      cache_missing: "No matching saved snapshot exists. No provider query made; neither calendar establishes availability. Loading calendars requires a separate explicit action.",
      range_unavailable: "These dates are outside the bounded 9–15 October 2026 calendar demo. Nothing was read or queried. Other dates still work for Activities.",
      cache_invalid: "Local snapshot is invalid or belongs to a different configuration · Nothing loaded; no provider query made. Use Clear / cancel to remove it, then reload and review again.",
      cache_unavailable: "Local snapshot storage unavailable · No cached fallback or automatic provider query. Nothing loaded. Use Clear / cancel to retry local removal; if it fails, operator storage recovery is required.",
      cache_clear_failed: "Local snapshot deletion not confirmed · Results hidden and reuse blocked. Use Clear / cancel to retry. If it still fails, operator storage recovery is required; do not restart to bypass this block.",
      expired: "Credential lifetime insufficient · Backend stopped before Azure requests. The operator must check the existing CLI credential. No automatic retry.",
      blocked: "Request blocked · The page may have expired or been cleared. Reload to review again; unresolved cleanup still blocks loading. No automatic retry.",
      cleanup_failed: "Cleanup failed or uncertain · Loading remains blocked. Operator must inspect the exact workflow before restarting; do not reset the connector.",
      contract_drift: "Contract or access-policy mismatch · Operator review required. No automatic repair or retry.",
      busy: "Busy · Another local operation is active. No second request started; no automatic retry.",
      cancelled: "Cancelled · Late results discarded. Neither row establishes availability.",
      revoked: "Access changed · Results discarded. No availability inferred; no automatic retry."
    };
    return Object.hasOwn(errors, data?.status) ? errors[data.status] : "Unavailable or blocked · Neither row can establish availability. No automatic retry. Check cleanup before restarting.";
  }
  function cleanupText(data, synthetic = false, blocked = false) {
    if (blocked || data?.status === "cleanup_failed" || data?.cleanup === "cleanup_failed") return "Cleanup failed or uncertain · Loading blocked. Operator recovery required; do not reset the connector.";
    if (sessionUnavailable(data)) return "No backend load started by this rejected request. Azure cleanup is not verified here. Reload, then explicitly check local cleanup; reload does not clear a backend cleanup block.";
    if (data?.cached === true && data?.cleanup === "workflow_disabled") return "Cached snapshot · Disable was verified at the original load, not rechecked now. No provider request made.";
    if (data?.cleanup === "workflow_disabled") return `${synthetic ? "Synthetic fixture" : "Backend"} · Workflow disable verified. Protected Azure history is not erased.`;
    if (data?.cleanup === "not_requested") return "No enable cleanup recorded for this local operation. Current Azure state is not inferred.";
    if (data?.cleanup === "cleanup_pending") return "Cleanup pending · Keep the backend running until disable is verified.";
    return "Cleanup not confirmed. Keep the backend running and check local cleanup status.";
  }
  function slotTime(index, window = api.window) {
    if (!validateWindow(window)) throw new Error("invalid_date_range");
    if (!Number.isInteger(index) || index < 0 || index > window.slots) throw new Error("invalid_slot");
    const utc = new Date(Date.parse(window.start) + index * window.interval * 60000);
    const local = new Date(utc.getTime() + 8 * 60 * 60000).toISOString();
    return { utc: utc.toISOString(), date: local.slice(0, 10), time: local.slice(11, 16) };
  }
  function days(window = api.window) {
    if (!validateWindow(window)) throw new Error("invalid_date_range");
    return Array.from({ length: window.slots / 48 }, (_, day) => ({ date: slotTime(day * 48, window).date, start: day * 48, end: (day + 1) * 48 }));
  }
  // Presentation aliases only. Never used as provider identities or authorization.
  function displayPeople(synthetic = false) {
    return ["Parent A", "Parent B"].map((alias, person) => ({ person, alias: synthetic ? `${alias} (sample)` : alias,
      previous: (synthetic ? ["Alex (fictional)", "Sam (fictional)"] : ["Parent A", "Parent B"])[person] }));
  }
  const compactLabels = Object.freeze({ free_or_elsewhere: "No busy*", tentative: "Tent.", busy: "Busy", oof: "Away", unknown: "Unknown" });
  function dayTime(slot) {
    if (!Number.isInteger(slot) || slot < 0 || slot > 48) throw new Error("invalid_day_slot");
    return `${String(Math.floor(slot / 2)).padStart(2, "0")}:${slot % 2 ? "30" : "00"}`;
  }
  function weekLayout(people = [], window = api.window) {
    return days(window).map(day => ({ ...day,
      heading: `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(`${day.date}T00:00:00Z`).getUTCDay()]} ${day.date.slice(8)}`,
      tracks: [0, 1].map(person => {
        const rows = people.filter(p => p?.person === person), p = rows.length === 1 ? rows[0] : null;
        const usable = p && ["checked", "partial"].includes(p.status) && Array.isArray(p.slots) && p.slots.length === window.slots;
        const runs = [];
        for (let offset = 0; offset < 48; offset++) {
          const value = usable ? p.slots[day.start + offset] : "unknown";
          const status = typeof value === "string" && Object.hasOwn(labels, value) ? value : "unknown";
          const last = runs.at(-1);
          if (last?.status === status) { last.end = offset + 1; last.endTime = dayTime(offset + 1); }
          else runs.push({ status, start: offset, end: offset + 1, startTime: dayTime(offset), endTime: dayTime(offset + 1) });
        }
        return { person, runs };
      })
    }));
  }
  // Separate page-only display contract. Never a third parent/provider/cache row.
  const childLabels = Object.freeze({ scheduled: "Event reported", cancelled: "Cancelled event", unknown: "Event status unknown" });
  const exactKeys = (o, keys) => o && typeof o === "object" && !Array.isArray(o) &&
    Object.keys(o).sort().join() === [...keys].sort().join();
  function childTimestamp(s) {
    if (typeof s !== "string" || s.length > 40 || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,7})?(?:Z|[+-]\d\d:\d\d)$/.test(s)) throw new Error("invalid_child_display");
    const t = Date.parse(s), date = s.slice(0, 10);
    if (!Number.isFinite(t) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date ||
      +s.slice(11, 13) > 23 || +s.slice(14, 16) > 59 || +s.slice(17, 19) > 59) throw new Error("invalid_child_display");
    return t;
  }
  function childDisplay(packet, selectedWindow, synthetic, now = Date.now()) {
    const fail = () => { throw new Error("invalid_child_display"); };
    if (!exactKeys(packet, ["version", "generation", "revision", "lifecycle", "synthetic", "window", "checkedAt", "partial", "events"]) ||
      packet.version !== 1 || !Number.isSafeInteger(packet.generation) || packet.generation < 1 ||
      !Number.isSafeInteger(packet.revision) || packet.revision < 0 || typeof packet.synthetic !== "boolean" || packet.synthetic !== synthetic ||
      !["idle", "loading", "loaded", "cleared", "unavailable", "expired"].includes(packet.lifecycle) || !Array.isArray(packet.events) || packet.events.length > 100) fail();
    let window = null, events = [];
    if (packet.lifecycle === "loaded") {
      if (!validateWindow(selectedWindow) || !exactKeys(packet.window, ["start", "end", "timezone"]) ||
        ["start", "end", "timezone"].some(k => packet.window[k] !== liveWindow[k] || packet.window[k] !== selectedWindow[k]) ||
        typeof packet.partial !== "boolean" || childTimestamp(packet.checkedAt) > now + 60000) fail();
      window = { start: packet.window.start, end: packet.window.end, timezone: packet.window.timezone };
      events = packet.events.map(e => {
        if (!exactKeys(e, ["start", "end", "allDay", "status"]) || ![true, false, null].includes(e.allDay) ||
          typeof e.status !== "string" || !Object.hasOwn(childLabels, e.status)) fail();
        const start = childTimestamp(e.start), end = childTimestamp(e.end);
        if (end <= start || end <= Date.parse(window.start) || start >= Date.parse(window.end) ||
          e.allDay === true && (!/T00:00:00(?:\.0+)?(?:Z|[+-]\d\d:\d\d)$/.test(e.start) || !/T00:00:00(?:\.0+)?(?:Z|[+-]\d\d:\d\d)$/.test(e.end))) fail();
        return { start: e.start, end: e.end, allDay: e.allDay, status: e.status };
      });
    } else if (packet.window !== null || packet.checkedAt !== null || packet.partial !== null || packet.events.length) fail();
    return { version: 1, generation: packet.generation, revision: packet.revision, lifecycle: packet.lifecycle,
      synthetic: packet.synthetic, window, checkedAt: packet.checkedAt, partial: packet.partial, events };
  }
  function childFreshness(data, now = Date.now()) {
    const age = now - Date.parse(data?.checkedAt);
    return !Number.isFinite(age) || age < 0 || age >= 300000 ? "Stale or unknown freshness" : "Recent snapshot, not continuous verification";
  }
  function childDayLayout(packet, selectedWindow, synthetic, now = Date.now()) {
    const data = childDisplay(packet, selectedWindow, synthetic, now);
    if (data.lifecycle !== "loaded") return [];
    const time = minutes => {
      const seconds = Math.floor(minutes * 60 + .00001);
      return `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}${seconds % 60 ? `:${String(seconds % 60).padStart(2, "0")}` : ""}`;
    };
    return days(selectedWindow).map(day => {
      const start = Date.parse(selectedWindow.start) + day.start * 1800000, end = start + 86400000;
      const allDay = [], timed = [];
      data.events.forEach((e, index) => {
        const from = Math.max(start, Date.parse(e.start)), to = Math.min(end, Date.parse(e.end));
        if (from >= to) return; // Half-open days: midnight belongs only to the next day.
        const item = { index, status: e.status, allDay: e.allDay, start: (from - start) / 60000, end: (to - start) / 60000,
          startTime: time((from - start) / 60000), endTime: time((to - start) / 60000) };
        (e.allDay === true ? allDay : timed).push(item);
      });
      timed.sort((a, b) => a.start - b.start || a.end - b.end || a.index - b.index);
      // Stable interval partitioning, independently per overlap-connected group.
      let group = [], ends = [], groupEnd = -1;
      const finish = () => { for (const item of group) item.lanes = ends.length; group = []; ends = []; };
      for (const item of timed) {
        if (item.start >= groupEnd) finish();
        let lane = ends.findIndex(end => end <= item.start);
        if (lane < 0) lane = ends.length;
        ends[lane] = item.end; item.lane = lane; group.push(item); groupEnd = Math.max(groupEnd, item.end);
      }
      finish();
      return { date: day.date, allDay, timed };
    });
  }
  const api = { window, liveWindow, dateRange, validateWindow, calendarWindow, displayWindow, displayPages, responseLimit, slotTime, days, labels, compactLabels, displayPeople, dayTime, weekLayout, unknown, project, initial, transition, freshness, sessionUnavailable, failureText, cleanupText,
    childDisplay, childDayLayout, childFreshness, childLabels };
  return api;
});