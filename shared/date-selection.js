"use strict";
(function(root) {
  // Pure date validation/formatting is shared with Our week. No calendar state.
  const A = typeof module !== "undefined" && module.exports ? require("../owner/availability-core") : root.OwnerAvailability;
  const key = "familycopilot.dates.v1";
  function describeWeek(window = A.liveWindow) {
    if (!A.validateWindow(window)) throw new Error("invalid_date_range");
    const format = new Intl.DateTimeFormat("en-GB", { timeZone: window.timezone, day: "numeric", month: "long", year: "numeric" });
    return { start: window.start, end: window.end, timezone: window.timezone,
      firstDate: A.slotTime(0, window).date, lastDate: A.slotTime(window.slots - 1, window).date,
      label: format.formatRange(new Date(window.start), new Date(Date.parse(window.end) - 1)).replace(/ /g, "") };
  }
  function requestWindow(body) {
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).sort().join() !== "endDate,startDate") throw new Error("invalid_date_range");
    return A.dateRange(body.startDate, body.endDate);
  }
  // Only this small key is ever read or written, never storage.clear(). Getter
  // access is inside try/catch because browsers can deny sessionStorage itself.
  function createStore(getStorage = () => root.sessionStorage) {
    let failed = false;
    function read() {
      if (failed) return { status: "unavailable", window: null };
      try {
        const raw = getStorage().getItem(key);
        if (raw === null) return { status: "default", window: A.dateRange("2026-10-09", "2026-10-11") };
        if (typeof raw !== "string" || raw.length > 160) throw new Error();
        const value = JSON.parse(raw);
        if (!value || value.version !== 1) throw new Error();
        if (Object.keys(value).sort().join() === "state,version" && value.state === "invalid") return { status: "invalid", window: null };
        if (Object.keys(value).sort().join() !== "endDate,startDate,state,version" || value.state !== "selected") throw new Error();
        return { status: "selected", window: requestWindow({ startDate: value.startDate, endDate: value.endDate }) };
      } catch { return { status: "invalid", window: null }; }
    }
    function write(startDate, endDate) {
      let value = { version: 1, state: "invalid" };
      try { requestWindow({ startDate, endDate }); value = { version: 1, state: "selected", startDate, endDate }; } catch { /* Tombstone, not a hidden earlier week. */ }
      try { getStorage().setItem(key, JSON.stringify(value)); failed = false; return true; }
      catch {
        // Remove an obsolete selection if quota/storage policy prevents updating.
        try { getStorage().removeItem(key); getStorage().setItem(key, '{"version":1,"state":"invalid"}'); } catch { /* Navigation must stay blocked. */ }
        failed = true; return false;
      }
    }
    function reset() {
      try { getStorage().removeItem(key); failed = false; return true; }
      catch { failed = true; return false; }
    }
    return { read, write, reset };
  }
  const api = { key, describeWeek, requestWindow, createStore };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.FamilyDates = api;
})(globalThis);