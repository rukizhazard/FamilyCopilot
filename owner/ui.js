"use strict";
(() => {
  if (document.getElementById("calendar-host")) return;
  const { initial, validList, transition } = globalThis.OwnerCalendar;
  const $ = id => document.getElementById(id);
  const csrf = document.querySelector('meta[name="owner-csrf"]').content;
  document.querySelector('meta[name="owner-csrf"]').remove();
  const synthetic = document.querySelector('meta[name="owner-mode"]').content === "synthetic";
  const calendarUiHidden = $("owner-calendar-section").hidden;
  let state = initial(), controller, clearPending = false, blocked = false;
  if (synthetic) { $("synthetic-controls").hidden = false; $("owner-deployment").hidden = true; }
  const errors = {
    update_required: "Unavailable · The deployed workflow still returns counts only. The guarded owner-label update is required. Nothing was enabled or listed.",
    contract_drift: "Blocked · The workflow contract or access policy changed. Operator review required; no automatic repair.",
    cleanup_failed: "Cleanup failed or uncertain · Further loads are blocked. Operator must inspect and disable only the calendar-list workflow. Do not reset the connector.",
    revoked: "Revoked or access changed · No names retained. The existing connection was not reset.",
    cancelled: "Cancelled · Late results discarded.", busy: "Busy · Another local request or deployment is active. No second request was started.",
    expired: "Unavailable · The existing CLI credential needs sufficient remaining lifetime. No automatic retry.",
    blocked: "Blocked · This page expired, was cleared, or its request was rejected. No automatic retry.",
    unavailable: "Unavailable · No usable calendar list. Account policy, provider support or local service may be unavailable. No automatic retry.",
    invalid_provider_response: "Unavailable · Invalid provider response rejected; no names retained."
  };
  const cleanupText = value => ({
    workflow_disabled: synthetic ? "Synthetic cleanup: workflow disable verified by fixture, not Azure." : "Workflow disable verified after this request. Azure protected run history remains.",
    cleanup_pending: "Cleanup pending · Do not stop the local backend until disable completes.",
    cleanup_failed: errors.cleanup_failed,
    not_requested: "No enable cleanup recorded for this local operation; current cloud state is not inferred."
  })[value] || "Cleanup unknown · The local service could not confirm its status. Keep the backend running; use Check local cleanup status.";
  function render() {
    $("owner-ack").checked = state.acknowledged;
    $("owner-load").disabled = calendarUiHidden || !state.acknowledged || state.used || clearPending || blocked;
    $("fixture").disabled = state.used || clearPending;
    $("owner-picker").hidden = state.phase !== "selecting";
    $("owner-summary").hidden = state.phase !== "summary";
    $("owner-review").disabled = !state.selected.length;
    $("owner-selection").textContent = `${state.selected.length} selected · Local summary only, not a grant.`;
    const fragment = document.createDocumentFragment();
    for (const calendar of state.calendars) {
      const label = document.createElement("label"), input = document.createElement("input"), text = document.createElement("span");
      label.className = "owner-choice"; input.type = "checkbox"; input.value = calendar.key;
      input.checked = state.selected.includes(calendar.key); text.textContent = calendar.name;
      input.addEventListener("change", () => {
        state = transition(state, { type: "select", key: calendar.key, value: input.checked });
        $("owner-summary-list").replaceChildren();
        $("owner-review").disabled = !state.selected.length;
        $("owner-selection").textContent = `${state.selected.length} selected · Local summary only, not a grant.`;
      });
      label.append(input, text); fragment.append(label);
    }
    $("owner-list").replaceChildren(fragment);
    $("owner-summary-list").replaceChildren();
    if (state.phase === "summary") for (const calendar of state.calendars.filter(c => state.selected.includes(c.key))) {
      const li = document.createElement("li"); li.textContent = calendar.name; $("owner-summary-list").append(li);
    }
  }
  async function post(url, body, signal, keepalive = false) {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "X-Owner-CSRF": csrf },
      body: JSON.stringify(body), signal, keepalive, credentials: "omit", cache: "no-store", redirect: "error" });
    const text = await response.text();
    if (text.length > 200000) throw new Error();
    return JSON.parse(text);
  }
  async function clear(leaving = false, external = false) {
    if (!external) window.dispatchEvent(new CustomEvent("owner-session-cleared", { detail: { source: "calendars", leaving } }));
    const started = state.used;
    state = transition(state, { type: "clear" }); controller?.abort(); controller = undefined;
    $("owner-ack").checked = false;
    $("owner-status").textContent = started ? "Cleared locally · Late results fenced. Waiting for backend cleanup confirmation…" : "Cleared · No calendar request made.";
    clearPending = started; render();
    if (!leaving && !external) $("owner-status").focus();
    if ((!started && leaving) || external) return;
    $("owner-cleanup").textContent = cleanupText("cleanup_pending");
    try {
      const result = await post("/api/clear", leaving ? { reason: "leave" } : {}, AbortSignal.timeout(150000), leaving);
      if (result.status === "cleanup_failed") blocked = true;
      $("owner-cleanup").textContent = cleanupText(result.cleanup);
      $("owner-status").textContent = result.status === "cleanup_failed" ? errors.cleanup_failed : "Cleared · Names and selections removed. No event access or sharing granted.";
    } catch { $("owner-cleanup").textContent = cleanupText("unknown"); }
    finally { clearPending = false; render(); }
  }
  $("owner-ack").addEventListener("change", () => {
    if (calendarUiHidden) return;
    if (!$("owner-ack").checked) { void clear(); return; }
    state = transition(state, { type: "ack", value: true }); render();
  });
  $("owner-load").addEventListener("click", async () => {
    if (calendarUiHidden || blocked || clearPending) return;
    const next = transition(state, { type: "load" }); if (next === state) return;
    state = next; const generation = state.generation;
    controller = new AbortController(); const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(420000)]);
    render(); $("owner-status").textContent = "Loading once · Checking owner policy, then listing names only. Waiting for verified disable before display…";
    $("owner-cleanup").textContent = "Cleanup pending if workflow enable begins. No automatic retry.";
    $("owner-clear").focus();
    try {
      const data = await post("/api/load", { acknowledged: true, requestId: crypto.randomUUID() }, signal);
      if (generation !== state.generation || state.phase !== "loading") return;
      $("owner-cleanup").textContent = cleanupText(data.cleanup);
      if (data.synthetic !== synthetic || !validList(data)) {
        if (data.status === "cleanup_failed") blocked = true;
        state = transition(state, { type: "failed", generation });
        $("owner-status").textContent = errors[data.status] || errors.unavailable;
      } else {
        state = transition(state, { type: "loaded", generation, data });
        $("owner-status").textContent = data.count ? `${synthetic ? "Synthetic sample" : "Live response"} · ${data.count} available calendars listed at ${new Date().toLocaleTimeString()}. Completeness unknown; ownership unverified. No events or time range checked.` : "Empty response · No calendars returned by this bounded request. This does not establish no calendars or free time.";
      }
      render(); $("owner-status").focus();
    } catch {
      if (generation !== state.generation) return;
      state = transition(state, { type: "failed", generation }); render();
      $("owner-status").textContent = errors.unavailable;
      $("owner-cleanup").textContent = cleanupText("unknown");
      $("owner-status").focus();
    }
  });
  $("owner-clear").addEventListener("click", () => { void clear(); });
  window.addEventListener("owner-session-cleared", event => { if (event.detail.source !== "calendars") void clear(event.detail.leaving, true); });
  $("owner-check").addEventListener("click", async () => {
    if (calendarUiHidden) return;
    try {
      const result = await post("/api/status", {}, AbortSignal.timeout(10000));
      if (result.status === "cleanup_failed") { blocked = true; render(); }
      $("owner-cleanup").textContent = cleanupText(result.cleanup);
      $("owner-cleanup").textContent += " Last shared-proxy operation only (calendar list or availability), not a fresh cloud-state check.";
    } catch { $("owner-cleanup").textContent = cleanupText("unknown"); }
  });
  $("owner-review").addEventListener("click", () => { state = transition(state, { type: "review" }); render(); $("owner-summary-title").focus(); });
  $("owner-back").addEventListener("click", () => { state = transition(state, { type: "back" }); render(); $("owner-list").querySelector("input")?.focus(); });
  $("fixture").addEventListener("change", async () => {
    if (!synthetic || state.used) return;
    $("owner-load").disabled = true;
    try { await post("/api/fixture", { scenario: $("fixture").value }, AbortSignal.timeout(10000)); }
    catch { blocked = true; $("owner-status").textContent = "Synthetic fixture unavailable."; }
    render();
  });
  window.addEventListener("pagehide", () => { void clear(true); });
  window.addEventListener("pageshow", event => { if (event.persisted) { state = transition(state, { type: "clear" }); render(); } });
  render(); // Pure local idle rendering. No status, credentials or list fetch on startup.
})();