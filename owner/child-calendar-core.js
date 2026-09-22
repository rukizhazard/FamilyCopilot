/* Cloud-projected child data and strict locally saved views. No inferred availability. */
(function (root, factory) {
  const api = factory();
  api.forSyntheticOctober = () => factory(true);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ChildCalendar = api;
})(globalThis, (syntheticOctober) => {
  "use strict";
  const contract = "kimi-calendar-v1";
  const window = Object.freeze(syntheticOctober
    ? { start: "2026-09-30T16:00:00Z", end: "2026-10-31T16:00:00Z", timezone: "Asia/Taipei" }
    : { start: "2026-10-08T16:00:00Z", end: "2026-10-15T16:00:00Z", timezone: "Asia/Taipei" });
  const maxBytes = 256 * 1024, maxEvents = 100;
  const exact = (o, keys) => o && typeof o === "object" && !Array.isArray(o) && Object.keys(o).sort().join() === [...keys].sort().join();
  const fail = () => { throw new Error("invalid_child_response"); };
  const text = (s, max) => typeof s === "string" && s.length <= max && !/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(s);
  const handle = s => typeof s === "string" && /^[a-f0-9]{64}$/.test(s);
  // Error-only, page-local diagnostics. Never include IDs, names, URLs, bodies or
  // arbitrary exception text. This is not part of an event or saved-view schema.
  const diagnosticStages = Object.freeze(["native_runtime", "extensions", "account", "signed_in_user", "credential",
    "find", "source_list_request", "source_match", "import", "event_request", "event_validation",
    "cleanup", "extension_cleanup", "backend", "browser_request", "browser_response"]);
  const diagnosticCodes = Object.freeze(["blocked", "busy", "unavailable", "expired", "revoked", "contract_drift",
    "cancelled", "cleanup_failed", "invalid_provider_response", "update_conflict", "update_required",
    "source_not_found", "request_failed", "invalid_response"]);
  const diagnosticElapsed = (start, now = Date.now()) => Math.min(600000, Math.max(0, Math.floor(now - start)));
  function syncDiagnostic(value) {
    const keys = ["stage", "code", "elapsedMs"];
    if (!value || typeof value !== "object" || Array.isArray(value) || Reflect.ownKeys(value).length !== keys.length) fail();
    const fields = keys.map(key => Object.getOwnPropertyDescriptor(value, key));
    if (fields.some(field => !field || !Object.hasOwn(field, "value"))) fail();
    const [stage, code, elapsedMs] = fields.map(field => field.value);
    if (!diagnosticStages.includes(stage) || typeof code !== "string" ||
      !(diagnosticCodes.includes(code) || /^http_[45]\d\d$/.test(code)) ||
      !Number.isSafeInteger(elapsedMs) || elapsedMs < 0 || elapsedMs > 600000) fail();
    return { stage, code, elapsedMs };
  }
  function timestamp(s) {
    if (typeof s !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,7})?(?:Z|[+-]\d\d:\d\d)$/.test(s) || !Number.isFinite(Date.parse(s))) fail();
    const parts = /^(\d{4}-\d\d-\d\d)T(\d\d):(\d\d):(\d\d)/.exec(s);
    if (new Date(`${parts[1]}T00:00:00Z`).toISOString().slice(0, 10) !== parts[1] || +parts[2] > 23 || +parts[3] > 59 || +parts[4] > 59) fail();
    return Date.parse(s);
  }
  function project(data, disclosure, now = Date.now()) {
    if (!["busy_only", "details"].includes(disclosure) || new TextEncoder().encode(JSON.stringify(data)).length > maxBytes ||
      !exact(data, ["contract", "window", "checkedAt", "partial", "events"]) || data.contract !== contract ||
      !exact(data.window, Object.keys(window)) || Object.keys(window).some(k => data.window[k] !== window[k]) ||
      typeof data.partial !== "boolean" || !Array.isArray(data.events) || data.events.length > maxEvents || timestamp(data.checkedAt) > now + 60000) fail();
    let partial = data.partial;
    const events = [];
    for (const e of data.events) {
      if (!exact(e, ["title", "start", "end", "allDay", "status", "kind", "redacted"]) || !text(e.title, 200) ||
        typeof e.redacted !== "boolean" || ![true, false, null].includes(e.allDay) ||
        !["scheduled", "cancelled", "unknown"].includes(e.status) || !["singleInstance", "occurrence", "exception", "unknown"].includes(e.kind) ||
        (e.redacted || disclosure === "busy_only") && e.title !== "Busy" || disclosure === "busy_only" && !e.redacted) fail();
      let start, end;
      try { start = timestamp(e.start); end = timestamp(e.end); } catch { partial = true; continue; }
      if (end <= start || end <= Date.parse(window.start) || start >= Date.parse(window.end)) { partial = true; continue; }
      // Retain original overlapping/all-day boundaries; do not shift or clip dates.
      if (e.allDay === true && (!/T00:00:00(?:\.0+)?(?:Z|[+-]\d\d:\d\d)$/.test(e.start) || !/T00:00:00(?:\.0+)?(?:Z|[+-]\d\d:\d\d)$/.test(e.end))) { partial = true; continue; }
      events.push({ ...e });
    }
    return { contract, window: { ...window }, checkedAt: data.checkedAt, partial, events };
  }
  function list(data) {
    if (!exact(data, ["calendars", "partial"]) || typeof data.partial !== "boolean" || !Array.isArray(data.calendars) || data.calendars.length > 100) fail();
    const seen = new Set();
    for (const c of data.calendars) {
      if (!exact(c, ["handle", "name"]) || !handle(c.handle) || seen.has(c.handle) || !text(c.name, 1024) || !c.name) fail();
      seen.add(c.handle);
    }
    return { calendars: data.calendars.map(c => ({ ...c })), partial: data.partial };
  }
  const datesAllowed = (start, end) => start === (syntheticOctober ? "2026-10-01" : "2026-10-09") && end === (syntheticOctober ? "2026-10-31" : "2026-10-15");
  const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  function savedAccess(value) {
    if (!exact(value, ["person", "guardian", "disclosure", "sourceName"]) || value.person !== "Kimi" || value.guardian !== true ||
      !["details", "busy_only"].includes(value.disclosure) || !text(value.sourceName, 1024) || !value.sourceName.trim()) fail();
    return { person: "Kimi", guardian: true, disclosure: value.disclosure, sourceName: value.sourceName };
  }
  function saved(response, now = Date.now()) {
    if (exact(response, ["status"]) && response.status === "cache_missing") return { status: "cache_missing" };
    if (!exact(response, ["status", "access", "data"]) || response.status !== "saved") fail();
    const access = savedAccess(response.access), data = project(response.data, access.disclosure, now);
    // Persisted input must ALREADY be projected, not silently repaired on read.
    if (data.partial !== response.data.partial || data.events.length !== response.data.events.length ||
      data.events.some((e, i) => Object.keys(e).some(k => e[k] !== response.data.events[i][k]))) fail();
    return { status: "saved", access, data };
  }
  function summary(name, disclosure, retention = "session") {
    if (!text(name, 1024) || !["details", "busy_only"].includes(disclosure) || !["session", "disk", "memory"].includes(retention)) fail();
    const storage = retention === "session" ? "Page/session memory only (at most 30 minutes); no child saved file."
      : `${retention === "disk" ? "Permitted names/times and reviewed access saved privately on this device until Clear, including after restart." : "Permitted names/times and reviewed access kept in process memory until Clear or server restart; no child saved file."} Source/privacy changes delete the saved view. No automatic refresh; offline permission revocation is unknown. Saved settings authorize saved viewing only; a new session must find, select and review a fresh source for Update.`;
    return `Child · ${name} · Existing authorized Outlook connection · Guardian authority acknowledged · ${disclosure === "details" ? "Normal titles and times" : "Busy-only"}. Private, personal, confidential and unknown sensitivity: Busy-only. 9–15 October 2026, Asia/Taipei; ends 16 October 00:00 exclusive. Current local parent only; no assistant or cross-parent sharing. ${storage} Azure protected processing/history is not zero retention.`;
  }
  return { contract, window, maxBytes, maxEvents, exact, text, handle, timestamp, project, list, datesAllowed, escapeHtml, summary, savedAccess, saved,
    diagnosticStages, diagnosticCodes, diagnosticElapsed, syncDiagnostic };
});