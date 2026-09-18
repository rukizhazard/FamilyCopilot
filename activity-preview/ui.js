(function () {
  "use strict";
  const core = globalThis.ActivityPreview;
  const form = document.querySelector("#activity-form");
  const results = document.querySelector("#results");
  const cards = document.querySelector("#cards");
  const status = document.querySelector("#status");
  const error = document.querySelector("#form-error");
  const resultSummary = document.querySelector("#result-summary");
  const ageRows = document.querySelector("#age-rows");
  const addAge = document.querySelector("#add-age");
  const surprise = document.querySelector("#surprise");
  const ageValues = () => [...form.querySelectorAll('[name="ages"]')].map(field => field.value);
  function renderAges(values) {
    ageRows.innerHTML = core.ageRowsHtml(values);
    addAge.disabled = values.length >= core.maxChildren;
  }
  function syncSurprise() {
    surprise.setAttribute("aria-pressed", String(!form.querySelector('[name="interest"]:checked')));
  }

  function clearResults(message = "") {
    if (results) results.hidden = true;
    cards?.replaceChildren();
    if (resultSummary) resultSummary.textContent = "";
    error.textContent = "";
    form.querySelectorAll("[aria-invalid]").forEach(field => field.removeAttribute("aria-invalid"));
    status.textContent = message;
  }
  function choicesChanged(message) {
    clearResults(message);
    globalThis.ActivityDiscovery?.invalidate(message);
  }
  function reset() {
    form.reset();
    renderAges([""]);
    syncSurprise();
    clearResults();
    document.querySelectorAll("details").forEach(details => { details.open = false; });
  }
  // No data restoration from history or browser form autofill is relied on.
  reset();
  form.addEventListener("input", () => choicesChanged("Choices changed. Select Find activities when you're ready."));
  form.addEventListener("change", () => { choicesChanged("Choices changed. Select Find activities when you're ready."); syncSurprise(); });
  addAge.addEventListener("click", () => {
    const values = ageValues();
    if (values.length >= core.maxChildren) return;
    renderAges([...values, ""]);
    choicesChanged(values.length + 1 === core.maxChildren ? "Eight ages maximum. Remove one to add another." : "An optional age added.");
    document.getElementById(`age-${values.length}`).focus();
  });
  ageRows.addEventListener("click", event => {
    const button = event.target.closest("button[data-remove]");
    if (!button) return;
    const index = Number(button.dataset.remove), values = ageValues();
    if (!Number.isInteger(index) || index < 0 || index >= values.length) return;
    values.splice(index, 1);
    renderAges(values);
    choicesChanged("Age removed. Select Find activities when you're ready.");
    (document.getElementById(`age-${Math.min(index, values.length - 1)}`) || addAge).focus();
  });
  surprise.addEventListener("click", () => {
    form.querySelectorAll('[name="interest"]').forEach(field => { field.checked = false; });
    syncSurprise();
    choicesChanged("Any interest. Sport and basketball preferences do not apply. Select Find activities when you're ready.");
  });
  function findSamples() {
    clearResults();
    const data = new FormData(form);
    const result = core.search({ ...Object.fromEntries(data), ages: data.getAll("ages"), interests: data.getAll("interest"), sports: data.getAll("sport") });
    if (result.error) {
      error.textContent = result.error;
      let field = document.getElementById(result.field) || document.querySelector("#find");
      if (field.hidden) field = document.querySelector("#find");
      const details = field.closest("details");
      if (details) details.open = true;
      field.setAttribute("aria-invalid", "true");
      field.focus();
      return false;
    }
    // The current activity page omits the ideas surface. Still validate choices
    // before public discovery, but do not render/announce or focus removed ideas.
    if (!results) return true;
    cards.innerHTML = core.resultsHtml(result);
    resultSummary.textContent = core.summary(result.request);
    const total = result.matches.length + result.uncertain.length;
    document.querySelector("#results-title").textContent = total ? `${total} ${total === 1 ? "idea" : "ideas"} to explore` : "No matching ideas";
    results.hidden = false;
    status.textContent = `${total} ${total === 1 ? "idea" : "ideas"}. ${result.uncertain.length ? `${result.uncertain.length} needs checking. ` : ""}Fixed September 20–26 examples, not live listings.`;
    document.querySelector("#results-title").focus();
    return true;
  }
  globalThis.ActivitySamples = { search: findSamples, clear: clearResults };
  form.addEventListener("submit", event => {
    event.preventDefault();
    if (globalThis.ActivityDiscovery) return globalThis.ActivityDiscovery.find();
    findSamples();
  });
  const focusChoices = () => (document.getElementById("age-0") || addAge).focus();
  document.querySelector("#edit")?.addEventListener("click", focusChoices);
  document.querySelector("#reset").addEventListener("click", () => {
    reset();
    status.textContent = "A fresh start. Preview choices cleared.";
    focusChoices();
  });
  globalThis.addEventListener("pagehide", reset);
  globalThis.addEventListener("pageshow", event => { if (event.persisted) reset(); });
})();