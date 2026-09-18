/* Saved views and capability-gated remembered-source Sync. No source selection or browser storage. */
(() => {
  "use strict";
  const C = globalThis.ChildCalendar, $ = id => document.getElementById(id);
  if (!C || !$("child-status")) return;
  const mode = document.querySelector('meta[name="child-mode"]')?.content;
  const csrf = document.querySelector('meta[name="owner-csrf"]')?.content;
  const synthetic = document.querySelector('meta[name="owner-mode"]')?.content === "synthetic";
  const cacheMode = document.querySelector('meta[name="child-cache"]')?.content;
  const retention = cacheMode === "child-saved-v1-disk" ? "disk" : cacheMode === "child-saved-v1-memory" ? "memory" : null;
  const currentPage = document.querySelector('meta[name="owner-range"]')?.content === "configurable-v1" &&
    document.querySelector('meta[name="owner-saved"]')?.content === "preserve-v1" &&
    document.querySelector('meta[name="owner-contract"]')?.content === "bounded-availability-v5";
  const available = currentPage && !!retention && (synthetic ? mode === "synthetic" : mode === C.contract);
  const syncAvailable = available && document.querySelector('meta[name="child-sync"]')?.content === "child-sync-v1";
  const cacheErrors = ["child_cache_invalid", "child_cache_unavailable", "child_cache_clear_failed"];
  const storageErrors = [...cacheErrors, "child_source_invalid", "child_source_unavailable", "child_source_clear_failed"];
  const updateHelp = "Kimi saved viewing needs a safe backend update. Parent-only controls still work; reloading cannot fix a storage/cleanup block.";
  let generation = 0, pending = false, controller, used = false, blocked = false, expired = false;
  let bridgeGeneration = 0, revision = 0, sharedPending = false, cleanupPending = 0;
  let eventNames = [], namesGeneration = -1, namesRevision = -1;
  let coordination, released = false, clearing = Promise.resolve(), staleTimer;
  const expires = Date.now() + 30 * 60000;
  function clearNames() { eventNames = []; namesGeneration = namesRevision = -1; }
  const dates = () => {
    // Resolve the existing full load scope, never relabel a shorter display as a saved window.
    const A = globalThis.OwnerAvailability;
    try {
      const scope = A.calendarWindow(A.dateRange($("availability-start").value, $("availability-end").value));
      return [A.slotTime(0, scope).date, A.slotTime(scope.slots - 1, scope).date];
    } catch { return ["", ""]; }
  };
  let lastDates = dates().join();
  globalThis.FamilyWeekRenderer?.register((node, index, generation, displayRevision) => {
    if (blocked || expired || released || Date.now() >= expires || dates().join() !== lastDates || !C.datesAllowed(...dates())) {
      clearNames(); return;
    }
    if (generation !== namesGeneration || generation !== bridgeGeneration || displayRevision !== namesRevision ||
      displayRevision !== revision || !Number.isSafeInteger(index) || index < 0) return;
    const name = eventNames[index], prefix = `Event ${index + 1} · `;
    if (!name || !node.textContent.startsWith(prefix)) return;
    // Literal replacement callbacks: markup/dollar sequences stay text, never HTML.
    node.textContent = node.textContent.replace(prefix, () => `${name} · `);
    node.title = node.title.replace(` · ${prefix}`, () => ` · ${name} · `);
    node.setAttribute("aria-label", node.title);
  });
  function status(message, focus = false, detailsOnly = false) {
    const hidden = detailsOnly && !focus && !blocked && !expired;
    if (hidden && document.activeElement === $("child-status")) $("availability-clear").focus();
    $("child-status").textContent = message;
    $("child-status").setAttribute("data-urgent", String(focus || blocked));
    $("child-status").hidden = hidden;
    $("child-status-details").textContent = hidden ? message : "";
    $("child-status-details").hidden = !hidden || !message;
    if (focus) $("child-status").focus();
  }
  function publish(lifecycle, result = null) {
    if (lifecycle !== "loaded") clearNames();
    // Title-free bridge remains independent of the private page-local renderer.
    window.dispatchEvent(new CustomEvent("child-week-changed", { detail: {
      version: 1, generation: ++bridgeGeneration, revision, lifecycle, synthetic,
      window: result ? { start: result.window.start, end: result.window.end, timezone: result.window.timezone } : null,
      checkedAt: result ? result.checkedAt : null, partial: result ? result.partial : null,
      events: result ? result.events.map(e => ({ start: e.start, end: e.end, allDay: e.allDay, status: e.status })) : []
    } }));
  }
  function controls() { coordination?.changed({ pending: pending || cleanupPending > 0, blocked, expired }); }
  function hide(lifecycle = "cleared") {
    clearNames(); generation++; controller?.abort(); pending = false; clearTimeout(staleTimer);
    $("child-imported-access").textContent = ""; $("child-imported-access").hidden = true;
    publish(lifecycle);
  }
  async function post(path, body, signal, keepalive = false) {
    const loading = ["/api/child/saved", "/api/child/sync"].includes(path);
    const invalid = () => new Error(loading ? "child_cache_invalid" : "unavailable");
    const response = await fetch(path, { method: "POST", credentials: "omit", cache: "no-store", redirect: "error", keepalive,
      headers: { "Content-Type": "application/json", "X-Owner-CSRF": csrf }, body: JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(245000)]) : AbortSignal.timeout(245000) });
    if (+response.headers.get("content-length") > C.maxBytes) throw invalid();
    const reader = response.body.getReader(); let size = 0, chunks = [];
    try {
      while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > C.maxBytes) throw invalid(); chunks.push(value); }
    } finally { await reader.cancel().catch(() => {}); }
    const bytes = new Uint8Array(size); let at = 0; for (const c of chunks) { bytes.set(c, at); at += c.length; }
    let data;
    try { data = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw invalid(); }
    if (!data || typeof data !== "object" || Array.isArray(data)) throw invalid();
    if (loading && response.ok && response.status !== 200) throw invalid();
    if (data.status === "cleanup_failed" || data.cleanup === "cleanup_failed") throw new Error("cleanup_failed");
    const storageError = [data.childCacheStatus, data.childSourceStatus, data.status].find(value => storageErrors.includes(value));
    if (storageError) throw new Error(storageError);
    if (!response.ok) throw new Error(data.reason === "session_unavailable" ? "expired" : ["revoked", "expired", "blocked", "contract_drift", "busy", "child_not_ready"].includes(data.status) ? data.status : "unavailable");
    return data;
  }
  function cancel(kind = "cancel", leaving = false) {
    if (!used || !available || released) return clearing;
    // Preserve snapshots for range/leave/cancellation. Only known access loss
    // uses deletion here; common Clear owns normal user-requested deletion.
    cleanupPending++; controls();
    clearing = clearing.then(async () => {
      const result = await post(kind === "cancel" ? "/api/child/edit" : "/api/child/clear", kind === "clear" ? {} : { reason: kind }, undefined, leaving);
      if (!C.exact(result, ["status"]) || result.status !== "cleared") throw new Error("cleanup_failed");
    }).catch(e => {
      blocked = true; hide("unavailable");
      status(storageErrors.includes(e.message)
        ? "Kimi saved view or remembered source could not be cleared or verified. Reuse is blocked until explicit Clear succeeds; reload cannot unblock storage."
        : "Cleanup unconfirmed. Kimi data hidden; further calendar requests blocked. Get help in Details; no automatic retry.", true);
    }).finally(() => { cleanupPending--; controls(); });
    return clearing;
  }
  function reset(message, kind = "cancel", leaving = false, notify = true) {
    hide(expired ? "expired" : blocked ? "unavailable" : "cleared"); controls(); status(message, false, true);
    if (notify) void cancel(kind, leaving);
  }
  function draw(data, disclosure, sourceName, useSync) {
    clearNames();
    const result = C.project(data, disclosure);
    eventNames = result.events.map(e => disclosure === "details" && !e.redacted && e.title.trim() ? e.title : "");
    namesGeneration = bridgeGeneration + 1; namesRevision = revision;
    publish("loaded", result);
    $("child-imported-access").textContent = `${useSync ? "Reviewed access" : "Saved access (view only, not live authorization)"} · Checked ${result.checkedAt} · ${syncAvailable ? "Sync uses remembered source · " : ""}${sourceName} · Kimi · ${disclosure === "details" ? "Permitted names and times" : "Busy-only"}. Our week shows consented event names, times and reported status. Private and Busy-only events stay unnamed.`;
    $("child-imported-access").hidden = false;
    // Only provenance scalars are retained for the five-minute freshness redraw.
    const checkedAt = result.checkedAt;
    const message = () => status(`Kimi · ${synthetic ? "SAMPLE" : "Outlook"} · ${sourceName} · ${syncAvailable ? `Checked ${checkedAt} · Sync uses remembered source` : `Saved only, checked ${checkedAt}`} · ${Date.now() - Date.parse(checkedAt) >= 300000 ? "Stale; may be out of date" : "Recent snapshot, not continuous verification"}. 9–15 October 2026 Taipei. ${syncAvailable ? "Cached results keep their original check time; no background refresh." : "Outlook not rechecked; Update refreshes parents only."}`, false, true);
    message(); staleTimer = setTimeout(message, Math.max(1, 300000 - (Date.now() - Date.parse(checkedAt))));
  }
  const saved = () => loadInternal(false);
  const sync = refresh => typeof refresh === "boolean" ? loadInternal(true, refresh) : Promise.resolve("cancel");
  async function loadInternal(useSync, refresh = false) {
    if (!available) { status(updateHelp); return "skip"; }
    if (useSync && !syncAvailable) return "skip";
    if (Date.now() >= expires) { expire(); return "cancel"; }
    if (released || blocked || expired || sharedPending || pending || cleanupPending || !C.datesAllowed(...dates())) return "cancel";
    hide(); const version = ++generation;
    const [startDate, endDate] = dates();
    pending = true; publish("loading"); controls();
    status(useSync ? refresh ? "Syncing Kimi's remembered source…" : "Opening Kimi's saved view or syncing its remembered source…" : "Opening Kimi's saved view only… No Outlook request.");
    await clearing;
    if (version !== generation) return "cancel";
    if (Date.now() >= expires) { expire(); return "cancel"; }
    controller = new AbortController(); used = true;
    try {
      const response = await post(useSync ? "/api/child/sync" : "/api/child/saved", { acknowledged: true, startDate, endDate, ...(useSync ? { refresh } : {}) }, controller.signal);
      if (version !== generation) return "cancel";
      if (Date.now() >= expires) { expire(); return "cancel"; }
      if (useSync && C.exact(response, ["status"]) && response.status === "source_missing") {
        publish("idle"); status("Kimi is not connected.");
        $("child-status-details").textContent = "Sync needs a one-time exact source confirmation. It is not migrated from a cached name. No setup opens here; Kimi's schedule remains unknown. Parents can still load.";
        $("child-status-details").hidden = false;
        return "missing";
      }
      let result;
      try {
        result = C.saved(response, Date.now());
        if (useSync && result.status !== "saved") throw new Error();
      } catch { throw new Error("child_cache_invalid"); }
      if (result.status === "cache_missing") {
        publish("idle"); status("Kimi · No saved view for these dates. Schedule unknown; Outlook not queried.");
        return "missing";
      }
      draw(result.data, result.access.disclosure, result.access.sourceName, useSync);
      return "saved";
    } catch (e) {
      if (version !== generation) return "cancel";
      if (Date.now() >= expires) { expire(); return "cancel"; }
      const lostAccess = ["revoked", "blocked", "contract_drift"].includes(e.message);
      expired ||= e.message === "expired";
      blocked ||= lostAccess || e.message === "cleanup_failed" || storageErrors.includes(e.message);
      hide(expired ? "expired" : "unavailable");
      const messages = {
        revoked: "Kimi access revoked. Saved results hidden; reuse blocked.",
        expired: "Page session expired. Kimi page data hidden; reload does not load saved data.",
        cleanup_failed: "Cleanup unconfirmed. Kimi data hidden; loading blocked. Get help in Details.",
        busy: "Kimi saved view unavailable while another calendar operation is running. Schedule unknown."
      };
      status(storageErrors.includes(e.message)
        ? "Kimi saved view or remembered source is invalid, unavailable, or could not be saved/cleared. Reuse is blocked until explicit Clear succeeds; reload cannot unblock storage."
        : messages[e.message] || (lostAccess ? "Kimi access is unconfirmed. Saved results hidden; reuse blocked." : useSync
          ? "Kimi Sync unavailable. Schedule unknown; the Outlook request outcome is unconfirmed. No saved fallback."
          : "Kimi saved view unavailable. Schedule unknown; no Outlook request."), true);
      if (lostAccess) await cancel("clear");
      else if (!blocked) await cancel(expired ? "leave" : "cancel");
      return blocked || expired ? "cancel" : "skip";
    } finally { if (version === generation) pending = false; controls(); }
  }
  function dateEdit() {
    const next = dates().join(); if (next === lastDates) return; lastDates = next;
    reset("Dates changed. Kimi page data hidden; saved view kept.", "range");
  }
  for (const id of ["availability-start", "availability-end"]) for (const event of ["input", "change"]) $(id).addEventListener(event, dateEdit);
  $("availability-supported-dates")?.addEventListener("click", dateEdit);
  function release() {
    // Fence now, drain prior cleanup, then let common Clear send its sole deletion.
    released = true;
    reset("Calendar view closed. Kimi page data hidden.", "leave", false, false);
    return clearing;
  }
  window.addEventListener("owner-session-cleared", release);
  window.addEventListener("week-safety-changed", event => {
    const d = event.detail;
    if (!C.exact(d, ["version", "revision", "pending", "blocked", "expired"]) || d.version !== 1 ||
      !Number.isSafeInteger(d.revision) || d.revision < revision || [d.pending, d.blocked, d.expired].some(v => typeof v !== "boolean")) return;
    const changed = revision !== d.revision;
    revision = d.revision; sharedPending = d.pending;
    blocked ||= d.blocked; expired ||= d.expired;
    if (changed || blocked || expired) {
      lastDates = dates().join();
      reset(expired ? "Page session expired. Kimi page data hidden; saved view kept." : blocked
        ? "Shared cleanup or access is unconfirmed. Kimi data hidden; get help in Details."
        : "Dates changed. Kimi page data hidden; saved view kept.", expired ? "leave" : "range", false, !d.blocked && !d.pending);
    }
    controls();
  });
  window.addEventListener("pagehide", () => reset("Page left. Kimi page data hidden; saved view kept.", "leave", true, !coordination));
  window.addEventListener("pageshow", e => { if (e.persisted) reset("Restored page. Saved data has not been loaded.", "leave", false, !coordination); else dateEdit(); });
  window.addEventListener("focus", () => { if (Date.now() >= expires) expire(); else dateEdit(); });
  function expire() {
    if (expired) return;
    expired = true;
    reset("Page session expired. Kimi page data hidden; saved view kept. Reload does not load it.", "leave");
  }
  setTimeout(expire, 30 * 60000);
  status(available ? syncAvailable ? "Kimi · Not loaded. Sync uses only a previously confirmed remembered source." : "Kimi · Saved view not loaded. No Outlook request." : updateHelp, false, available);
  $("child-retention").textContent = !retention ? updateHelp : `Kimi: permitted names/times and minimal reviewed settings ${retention === "disk" ? "are saved privately on this device until Clear, separate from parent busy times" : "stay in memory until Clear or server restart"}. ${syncAvailable ? "The remembered source stays server-side, separate from the saved view. Sync reuses that confirmed source and disclosure, never a cached name. No source references, provider IDs, handles or tokens reach browser storage. View saved only cannot detect Outlook revocation and never queries on a miss." : "No provider IDs, handles or tokens are saved. Saved viewing cannot detect Outlook revocation or authorize live refresh."} The page view expires after 30 minutes; saved retention is separate.`;
  coordination = globalThis.FamilyWeekActions?.register({ saved, release, ...(syncAvailable ? { sync } : {}) });
  publish(available ? "idle" : "unavailable"); controls();
})();