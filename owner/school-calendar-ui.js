/* Local file details only. Never contributes busy blocks or owner consent. */
(() => {
  "use strict";
  const S = globalThis.SchoolCalendar, A = globalThis.OwnerAvailability;
  const $ = id => document.getElementById(id);
  const fileInput = $("school-calendar-file"), view = $("school-calendar-view");
  const loadButton = $("school-calendar-load"), list = $("school-calendar-events");
  const preview = $("school-calendar-preview"), metadata = $("school-calendar-metadata");
  const maxBytes = 64 * 1024;
  const participation = {
    "explicit-family": "Family participation explicitly mentioned; attendance still needs confirmation",
    "parent-meeting": "Parent meeting; attendance and audience need confirmation",
    "parent-attendance-unconfirmed": "Parent attendance unconfirmed"
  };
  let calendar = null, loaded = false, reading = false, generation = 0;
  const datesKey = () => `${$("availability-start").value}/${$("availability-end").value}`;
  let lastDates = datesKey();

  function status(message, focus = false) {
    $("school-calendar-status").textContent = message;
    if (focus) $("school-calendar-status").focus();
  }
  function paragraph(parent, text) {
    const node = document.createElement("p");
    node.textContent = text;
    parent.append(node);
  }
  function hideEvents() {
    loaded = false;
    list.replaceChildren();
    list.hidden = true;
    $("school-calendar-preview-title").textContent = "File preview · Details not loaded";
  }
  function rangeError() {
    if (view.value === "term") return "";
    if (view.value !== "selected") return "Invalid school calendar view. Choose Selected dates or Whole term.";
    const start = $("availability-start").value, end = $("availability-end").value;
    if (!start || !end) return "No dates selected. Choose Start date and End date in Our week, or Whole term.";
    try { A.dateRange(start, end); }
    catch { return "Invalid dates. Choose 1–7 inclusive valid days in Our week, or Whole term."; }
    return "";
  }
  function controls() {
    loadButton.disabled = !S || !A || !calendar || reading || !!rangeError();
    preview.hidden = !calendar;
  }
  function remove(message, focus = false) {
    generation++;
    calendar = null;
    reading = false;
    hideEvents();
    metadata.replaceChildren();
    fileInput.value = "";
    view.value = "selected";
    lastDates = datesKey();
    controls();
    status(message, focus);
  }
  function showPreview() {
    metadata.replaceChildren();
    const source = calendar.source;
    paragraph(metadata, `Calendar: ${calendar.title}`);
    paragraph(metadata, `Source file (as declared): ${source.file} · ${source.pageCount} pages · School year ${source.schoolYear}, term ${source.term}`);
    paragraph(metadata, `Coverage: ${source.coverageStart} through ${source.coverageEnd}, inclusive · ${calendar.events.length} events`);
    paragraph(metadata, `Recorded verification time (as declared): ${source.verifiedAt}`);
    paragraph(metadata, `Declared PDF SHA-256: ${source.sha256}. This browser has not compared it with the PDF; the filename does not establish authority.`);
    paragraph(metadata, `Source notice: ${source.notice}`);
    paragraph(metadata, "Restrictions: local-only, read-only details in this tab after Load. No sharing permission. Date-only entries, time unknown; no busy availability is inferred.");
    for (const audience of new Set(calendar.events.map(event => event.audience)))
      paragraph(metadata, `Audience restriction: ${audience}`);
    for (const value of new Set(calendar.events.map(event => event.participation)))
      paragraph(metadata, `Participation: ${participation[value]}`);
    controls();
  }
  function dateEdit(force = false) {
    const next = datesKey();
    if (!force && next === lastDates) return;
    lastDates = next;
    if (reading) {
      remove("Dates changed while reading. Not loaded; choose the file again to preview.");
      return;
    }
    generation++;
    hideEvents();
    controls();
    status(rangeError() || (calendar ? "Dates changed. School details hidden; press Load local school calendar again." : "Not loaded · Choose a local school calendar file to preview."));
  }
  function draw() {
    list.replaceChildren();
    const start = $("availability-start").value, end = $("availability-end").value;
    const events = view.value === "term" ? calendar.events : S.filter(calendar, start, end);
    for (const event of events) {
      const item = document.createElement("li"), title = document.createElement("h3");
      title.textContent = `${event.title} (${event.titleEn})`;
      item.append(title);
      paragraph(item, `Date: ${event.date} · Time unknown (date only, not a confirmed all-day commitment)`);
      paragraph(item, `Audience: ${event.audience}`);
      paragraph(item, `Participation: ${participation[event.participation]}`);
      paragraph(item, `Source: ${calendar.source.file} · Page ${event.sourcePage} · Event ID: ${event.id}`);
      paragraph(item, `${event.sourceText} (${event.sourceTextEn})`);
      paragraph(item, `Uncertainties: ${event.notes || "Times and attendance need confirmation."}`);
      list.append(item);
    }
    list.hidden = events.length === 0;
    $("school-calendar-preview-title").textContent = "Source and scope · Loaded locally";
    const source = calendar.source;
    if (view.value === "selected" && (end < source.coverageStart || start > source.coverageEnd)) {
      status("Selected dates are outside the school term coverage. No school events shown; this does not establish a free schedule.");
    } else {
      const scope = view.value === "term" ? `Whole term: ${source.coverageStart} through ${source.coverageEnd}` : `Selected dates: ${start} through ${end}`;
      const partial = view.value === "selected" && (start < source.coverageStart || end > source.coverageEnd)
        ? " Some selected dates are outside term coverage; those dates are unknown." : "";
      status(`${scope} · ${events.length ? `${events.length} school events shown.` : "No matching school events in this file."}${partial} PDF snapshot only, no live updates. Times and attendance need confirmation; no availability established.`);
    }
  }

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    generation++;
    const request = generation;
    calendar = null;
    reading = false;
    hideEvents();
    metadata.replaceChildren();
    lastDates = datesKey();
    controls();
    if (!file) { remove("Not loaded · No file selected."); return; }
    if (!S || !A) { remove("School calendar unavailable. Required local scripts could not load; no file read."); return; }
    if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > maxBytes) {
      remove("Invalid file size. Choose a non-empty school calendar JSON file no larger than 64 KiB.");
      return;
    }
    reading = true;
    controls();
    status("Reading local file for metadata preview only. Event details are not loaded.");
    try {
      const text = await file.text();
      if (request !== generation) return;
      if (typeof text !== "string" || new TextEncoder().encode(text).byteLength > maxBytes) throw new Error("Invalid size");
      const validated = S.validate(JSON.parse(text));
      if (request !== generation) return;
      calendar = validated;
      reading = false;
      showPreview();
      status(rangeError() || "Valid file preview. Event details not loaded; review the source and restrictions, then press Load local school calendar.");
    } catch {
      if (request !== generation) return;
      remove("Could not read a valid school calendar JSON file. Nothing loaded. Choose a valid file and try again.");
    }
  });
  loadButton.addEventListener("click", () => {
    dateEdit();
    if (!calendar || reading || !S || !A) return;
    const error = rangeError();
    if (error) { hideEvents(); controls(); status(error, true); return; }
    generation++;
    try {
      draw();
      loaded = true;
      $("school-calendar-status").focus();
    } catch {
      remove("Could not display this school calendar. Nothing loaded. Choose a valid file and try again.", true);
    }
  });
  view.addEventListener("change", () => {
    dateEdit();
    const error = rangeError();
    controls();
    if (error) { hideEvents(); status(error); return; }
    if (loaded && calendar) {
      try { draw(); }
      catch { remove("Could not display this school calendar. Nothing loaded. Choose a valid file and try again."); }
    } else if (!reading) {
      status(calendar ? "View selected. Details not loaded; press Load local school calendar." : "Not loaded · Choose a local school calendar file to preview.");
    }
  });
  $("school-calendar-clear").addEventListener("click", () => remove("School page copy removed. Original JSON and ICS files and owner saved week unchanged.", true));
  for (const id of ["availability-start", "availability-end"])
    for (const event of ["input", "change"]) $(id).addEventListener(event, () => dateEdit(true));
  // The existing supported-dates button writes values synchronously without input events.
  $("availability-supported-dates")?.addEventListener("click", () => dateEdit());
  window.addEventListener("owner-session-cleared", () => remove("Owner session cleared. School page copy removed; original files unchanged."));
  window.addEventListener("pagehide", () => remove("Page left. School page copy removed; original files unchanged."));
  window.addEventListener("pageshow", event => {
    if (event.persisted) remove("Restored page · School calendar not loaded. Choose the file again.");
    else dateEdit();
  });
  window.addEventListener("focus", () => dateEdit());
  document.addEventListener("visibilitychange", () => { if (!document.hidden) dateEdit(); });
  remove(S && A ? "Not loaded · Choose a local school calendar file to preview."
    : "School calendar unavailable. Required local scripts could not load; no file read.");
})();