"use strict";
const { project, window, validateWindow } = require("../owner/availability-core");
const { isDeepStrictEqual } = require("node:util");
const { CacheFailure } = require("./availability-disk-cache");
const { buildAvailability } = require("../infra/availability");

// One redacted requested range; optional disk storage declares its fixed window.
// context is the backend's verified caller/configuration fingerprint, not an alias.
function createSnapshotCache({ storage } = {}) {
  const defaultWindow = storage?.window || window;
  const contract = storage?.contract || buildAvailability("11111111-1111-4111-8111-111111111111").tags.contract;
  const key = (context, selectedWindow) => JSON.stringify([contract,
    [selectedWindow.start, selectedWindow.end, selectedWindow.timezone, selectedWindow.interval, selectedWindow.slots], context]);
  const checkWindow = selectedWindow => {
    if (validateWindow(selectedWindow) === false) throw new CacheFailure("cache_invalid");
    if (storage && !isDeepStrictEqual(selectedWindow, defaultWindow)) throw new CacheFailure("cache_invalid");
  };
  let entry = null, generation = 0, failure = null;
  const attempt = fn => {
    try { return fn(); } catch (e) { entry = null; failure = e; throw e; }
  };
  return {
    get generation() { return generation; },
    get failure() { return failure; },
    fence() { generation++; }, // Cancel pending writers without deleting a completed snapshot.
    prepare() { generation++; entry = null; }, // No fallback during a new query; retain disk until verified replacement.
    clear() {
      generation++; entry = null; // Synchronous fence BEFORE all storage I/O.
      attempt(() => storage?.clear()); failure = null;
    },
    get(context, requestedWindow = defaultWindow) {
      if (failure) throw failure;
      checkWindow(requestedWindow);
      if (!entry && storage) attempt(() => {
        const saved = storage.read(requestedWindow);
        if (saved) entry = { key: key(saved.context, requestedWindow), context: saved.context, data: project(saved.data, requestedWindow) };
      });
      if (!entry) return null;
      if ((!context && !storage) || context && context !== entry.context) { this.clear(); return null; }
      // A different viewing range is not withdrawal of the original permission.
      // Never relabel it, but allow a later explicitly confirmed matching view.
      if (!isDeepStrictEqual(entry.data.window, requestedWindow)) return null;
      return project(structuredClone(entry.data), requestedWindow);
    },
    put(context, data, fence, requestedWindow = defaultWindow) {
      if (!context || fence !== generation) return false;
      if (failure) throw failure;
      checkWindow(requestedWindow);
      const projected = project(data, requestedWindow);
      // Partial/missing context is preserved; malformed or wholly failed loads
      // must not replace a useful snapshot or become a cached false success.
      if (projected.people.some(p => p.status === "invalid") ||
        !projected.people.some(p => ["checked", "partial"].includes(p.status))) return false;
      attempt(() => storage?.write(context, projected, requestedWindow));
      entry = { key: key(context, requestedWindow), context, data: projected };
      return true;
    }
  };
}
module.exports = { createSnapshotCache };