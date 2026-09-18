"use strict";
const C = require("../owner/child-calendar-core");
const codes = new Set(["child_cache_invalid", "child_cache_unavailable", "child_cache_clear_failed"]);
class ChildCacheFailure extends Error {
  constructor(code = "child_cache_unavailable") { super(codes.has(code) ? code : "child_cache_unavailable"); this.code = this.message; }
}
// One shared generation across all local sessions. Construction/status are inert.
// Storage is a trusted synchronous seam, never browser configuration.
function createChildCache({ storage, now = Date.now } = {}) {
  let entry = null, generation = 0, failure = null;
  const attempt = fn => {
    try { return fn(); }
    catch (error) { entry = null; failure = new ChildCacheFailure(error instanceof ChildCacheFailure ? error.code : undefined); throw failure; }
  };
  const validate = value => {
    try { const safe = C.saved(value, now()); if (safe.status !== "saved") throw Error(); return safe; }
    catch { throw new ChildCacheFailure("child_cache_invalid"); }
  };
  return {
    retention: storage ? "disk" : "memory",
    get generation() { return generation; },
    get failure() { return failure; },
    fence() { generation++; },
    // Fence new writers. Disk reloads only on a later explicit saved request;
    // RAM has no disk copy, so retain its completed snapshot for that same action.
    prepare() { generation++; if (storage) entry = null; },
    clear({ recover = true } = {}) {
      generation++; entry = null;
      const previous = failure;
      try { storage?.clear(); } catch { failure = new ChildCacheFailure("child_cache_clear_failed"); throw failure; }
      failure = recover ? null : previous;
    },
    get() {
      if (failure) throw failure;
      return attempt(() => {
        if (!entry && storage) { const value = storage.read(); if (value !== null) entry = validate(value); }
        return entry ? validate(entry) : null;
      });
    },
    put(access, data, version) {
      if (version !== generation) return false;
      if (failure) throw failure;
      return attempt(() => {
        const safe = validate({ status: "saved", access, data });
        storage?.write(safe.access, safe.data);
        entry = safe;
        return true;
      });
    }
  };
}
module.exports = { createChildCache, ChildCacheFailure };