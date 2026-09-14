(function (root) {
  "use strict";
  const activities = [
    { id:"science", type:"science", age:"7-10", date:"2026-06-20", cost:12, title:"Night Lab: Light & Shadows — 20 June, 10:00–11:15", venue:"Mock Science Hall, Northside", guidance:"Ages 7–10", rationale:"Hands-on light experiments match the science sample interest.", source:"Local mock source panel: Science Hall listing", url:"https://mock.example.test/night-lab" },
    { id:"concert", type:"concert", age:"9-13", date:"2026-06-20", cost:25, title:"Tiny Orchestra: Family Matinee — 20 June, 14:00 performance", venue:"Mock Civic Studio, Downtown", guidance:"Recommended ages 9–13", rationale:"Short orchestral performance with a family matinee format.", source:"Local mock source panel: Civic Studio listing", url:"https://mock.example.test/tiny-orchestra" },
    { id:"exhibition", type:"exhibition", age:"7-10", date:"2026-06-21", cost:0, title:"Build It! Materials Exhibition — 21 June, 11:00–16:00", venue:"Mock Museum, Riverside", guidance:"All ages; activity table best for 7–10", rationale:"Making table and material displays suit the selected age range.", source:"Local mock source panel: Museum listing", url:"https://mock.example.test/build-it" }
  ];
  const state = { scenario:"no-calendar", selected:[], disclosure:"busy", confirmed:false };
  const toSafeString = value => String(value == null ? "" : value);
  const escapeHtml = value => toSafeString(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const safeHttpUrl = value => { try { const u = new URL(value); return /^https?:$/.test(u.protocol) ? u.href : null; } catch { return null; } };
  const canConfirmImport = (selected, attested) => selected.length > 0 && attested;
  const calendarCommitment = (disclosure, confirmed, title) => disclosure === "details" && confirmed ? `Alex sample: ${title}` : "Unavailable — busy-only block";
  const resetState = () => ({ scenario:"no-calendar", selected:[], disclosure:"busy", confirmed:false });
  const filterActivities = (items, filters) => items.filter(x =>
    (filters.age === "all" || x.age === filters.age) && (filters.interest === "all" || x.type === filters.interest) &&
    (filters.date === "all" || x.date === filters.date) && (filters.budget === "all" || (filters.budget === "low" ? x.cost <= 15 : x.cost <= 30)));
  const availabilityMessage = (scenario, selected=["alex", "sam"]) => ({
    "no-calendar":"No calendar sample is selected. Discovery still works; schedule compatibility was not checked.",
    partial:"Cannot verify availability: Sam’s sample Google calendar is missing from the checked context.",
    stale:"Cannot verify availability: selected sample calendars are stale (simulated freshness: 17 June 2026, 18:00 EDT).",
    revoked:"Cannot verify availability: sample permission was revoked. Reconnect sample state or reset.",
    unavailable:"Cannot verify availability: sample provider is unavailable. Retry sample state or reset.",
    unsupported:"Cannot verify availability: sample child account is unsupported. Provider/guardian feasibility is not verified.",
    loading:"Loading synthetic calendar context; availability cannot yet be verified.",
    empty:"No synthetic commitments are available in the sample range; availability cannot be verified.",
    conflict:"Possible conflict: Alex sample Outlook is busy 10:30–11:30 on Sat 20 June.",
    ready:`No conflict found in the selected sample calendars: ${selected.map(x => x === "alex" ? "Alex sample Outlook" : "Sam sample Google").join(" and ")}, checked Sat 20 June 09:00–17:00 EDT. This is not complete availability.`
  }[scenario] || "");
  const card = (title, body, cls="") => `<article class="result-card ${cls}"><h3>${title}</h3>${body}</article>`;
  function renderWeekend() {
    const el = document.querySelector("#weekend-result"), s = state.scenario;
    if (s !== "ready" && s !== "conflict") { el.innerHTML = card("Sample calendar context", `<p>${availabilityMessage(s, state.selected)}</p>`, "alert"); return; }
    el.innerHTML = card("Checked synthetic context", `<p>${availabilityMessage(s, state.selected)}</p><p>Sources: Alex (represented person) · sample Outlook; Sam (represented person) · sample Google. Checked calendars: ${state.selected.map(x => x === "alex" ? "Alex sample Outlook" : "Sam sample Google").join("; ")}.</p>`, "ok") +
      card("Sample commitments", `<p><strong>Sat 10:00–11:00:</strong> ${calendarCommitment(state.disclosure, state.confirmed, "Garden planning")}</p><p><strong>Sat 10:30–11:30:</strong> ${s === "conflict" ? calendarCommitment(state.disclosure, state.confirmed, "Sample lesson") : "No additional sample block"}</p><p>Busy-only blocks intentionally contain no title, location, attendees, or inferred purpose.</p>`);
  }
  function renderActivities() {
    const form = document.querySelector("#filters"), filters = Object.fromEntries(new FormData(form)), results = filterActivities(activities, filters);
    document.querySelector("#activity-results").innerHTML = results.length ? results.map(x => card(`${x.title} <span class="tag">Mock activity result — not live</span>`, `<p><strong>Venue/area:</strong> ${x.venue} · <strong>Age:</strong> ${x.guidance} · <strong>Cost:</strong> $${x.cost}</p><p><strong>Why it may suit:</strong> ${x.rationale}</p><p><strong>Provenance:</strong> ${x.source}. Invented fixture facts; no live venue page exists.</p><p><strong>Travel:</strong> unverified. <strong>Tickets:</strong> unknown/unverified. <strong>Calendar fit:</strong> ${availabilityMessage(state.scenario, state.selected)}</p>`)).join("") : card("No local samples match those supported filters", "<p>Only type, listed age range, sample date, and budget filter the fixed fixtures. Try Reset demo or relax a supported filter.</p>", "alert");
  }
  function assess(value) {
    const out = document.querySelector("#event-result"), url = safeHttpUrl(value);
    if (!url) { out.innerHTML = card("Unsupported assessment", "<p>Use a safe http/https URL. The page is not fetched; try a sample selection.</p>", "alert"); return; }
    const item = activities.find(x => x.url === url);
    if (url.includes("ambiguous")) { out.innerHTML = card("Ambiguous performance — simulated", "<p>The local mock concert page has multiple sample performances. Select “Tiny Orchestra: Family Matinee — 20 June, 14:00” before a schedule comparison.</p>", "alert"); return; }
    if (url.includes("failure")) { out.innerHTML = card("Extraction failure — simulated", "<p>No facts were extracted. This URL was not fetched; try the Night Lab sample.</p>", "alert"); return; }
    if (!item) { out.innerHTML = card("Unsupported page", `<p>“${escapeHtml(value)}” is displayed as text only and was not fetched or associated with preset facts. Try a sample.</p>`, "alert"); return; }
    out.innerHTML = card("Extracted local mock facts — simulated", `<p><strong>Exact identity:</strong> ${item.title}</p><p><strong>Venue:</strong> ${item.venue}; <strong>Age:</strong> ${item.guidance}; <strong>Cost:</strong> $${item.cost}</p><p><strong>Mock provenance:</strong> ${item.source}. <strong>Schedule comparison:</strong> ${availabilityMessage(state.scenario, state.selected)}</p>`, "ok");
  }
  function renderImportSummary() {
    const out = document.querySelector("#import-summary");
    const chosen = [...document.querySelectorAll("[name=calendar]:checked")].map(x => x.value);
    const isAttested = document.querySelector("#authority").checked;
    state.selected = chosen;
    state.disclosure = document.querySelector("#disclosure").value;
    state.confirmed = false;
    if (!canConfirmImport(chosen, isAttested)) {
      out.innerHTML = card("Sample import not ready", "<p>Select at least one synthetic calendar and the fictional guardian attestation. Nothing has been loaded.</p>", "alert");
      return;
    }
    const labels = chosen.map(value => value === "alex" ? "Alex" : "Sam").join(", ");
    const article = document.createElement("article");
    const heading = document.createElement("h3");
    const summary = document.createElement("p");
    const preview = document.createElement("p");
    const confirm = document.createElement("button");
    article.className = "result-card";
    heading.textContent = "Confirm sample import";
    summary.textContent = `Fictional account alex.demo@example.test · selected: ${labels} · disclosure: ${state.disclosure === "busy" ? "Busy only" : "Details"} · sample window: 20–21 June 2026.`;
    preview.textContent = state.disclosure === "busy" ? "Disclosure preview: unavailable time only; no event titles, locations, attendees, or inferred purpose." : "Disclosure preview: synthetic titles may appear only in this demo.";
    confirm.id = "confirm-import";
    confirm.textContent = "Confirm and load samples";
    article.append(heading, summary, preview, confirm);
    out.replaceChildren(article);
  }
  function reset() { Object.assign(state, resetState()); document.querySelector("#scenario").value="no-calendar"; document.querySelectorAll("[name=calendar],#authority").forEach(x => x.checked=false); document.querySelector("#disclosure").value="busy"; document.querySelector("#import-summary").innerHTML=""; document.querySelector("#management-status").textContent="Demo reset. No sample calendars selected."; renderWeekend(); renderActivities(); }
  function init() {
    document.querySelectorAll("[data-view]").forEach(b => b.onclick = () => { document.querySelectorAll(".view").forEach(v => v.hidden = v.id !== b.dataset.view); document.querySelectorAll("[data-view]").forEach(x => x.removeAttribute("aria-current")); b.setAttribute("aria-current","page"); });
    document.querySelectorAll("[data-prompt]").forEach(b => b.onclick = () => { const p=b.dataset.prompt; document.querySelector("#question").value=b.textContent; document.querySelector("#question-status").textContent="Recognized deterministic sample prompt."; document.querySelector(`[data-view="${p === "discover" ? "discover" : p === "event" ? "event" : "weekend"}"]`).click(); });
    document.querySelector("#question").onchange = e => { if (!e.target.value.match(/family|science|exhibition|concert|sample/i)) document.querySelector("#question-status").textContent="Unsupported input: this static prototype recognizes only the example prompts; it does not understand general questions."; };
    document.querySelector("#scenario").onchange = e => { state.scenario=e.target.value; renderWeekend(); renderActivities(); if (document.querySelector("#event-url").value) assess(document.querySelector("#event-url").value); };
    document.querySelector("#filters").onsubmit = e => { e.preventDefault(); renderActivities(); };
    document.querySelectorAll("[data-sample-url]").forEach(b => b.onclick = () => { const key=b.dataset.sampleUrl; const value=key === "science" ? activities.find(activity => activity.id === "science").url : `https://mock.example.test/${key}`; document.querySelector("#event-url").value=value; assess(value); });
    document.querySelector("#check-url").onclick = () => assess(document.querySelector("#event-url").value);
    document.querySelector("#review-import").onclick = renderImportSummary;
    document.querySelector("#import-summary").onclick = e => { if(e.target.id==="confirm-import") { state.confirmed=true; state.scenario="ready"; document.querySelector("#scenario").value="ready"; document.querySelector("#import-summary").innerHTML=card("Synthetic samples loaded", "<p>Confirmation complete in session memory only. Results update to the current disclosure setting immediately.</p>", "ok"); renderWeekend(); renderActivities(); } };
    document.querySelector("#settings").onchange = e => { if(e.target.id === "disclosure" && state.confirmed) { state.disclosure=e.target.value; renderWeekend(); renderActivities(); document.querySelector("#management-status").textContent="Disclosure changed immediately for all sample results."; } };
    document.querySelectorAll("[data-management]").forEach(b => b.onclick = () => { const action=b.dataset.management; if(action==="delete" || action==="disconnect") reset(); else document.querySelector("#management-status").textContent=`${action[0].toUpperCase()+action.slice(1)} affects sample state only; no provider was contacted.`; });
    document.querySelectorAll("#reset,#footer-reset").forEach(b => b.onclick=reset); renderWeekend(); renderActivities();
  }
  if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", init);
  const api = { activities, filterActivities, safeHttpUrl, escapeHtml, canConfirmImport, calendarCommitment, resetState, availabilityMessage };
  if (typeof module !== "undefined") module.exports = api; else root.FamilyCopilot = api;
})(this);
