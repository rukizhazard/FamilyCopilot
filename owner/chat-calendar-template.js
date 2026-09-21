"use strict";
(function(root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FamilyCalendarTemplate = factory();
})(globalThis, () => {
  function create(host) {
    const document = host.ownerDocument, nodes = new Map();
    function node(tag, id, text, attributes = {}) {
      if (id && document.getElementById(id)) throw new Error("calendar_duplicate_id");
      const element = document.createElement(tag);
      if (id) { element.setAttribute("id", id); nodes.set(id, element); }
      if (text) element.textContent = text;
      for (const [name, value] of Object.entries(attributes)) {
        if (["hidden", "disabled"].includes(name)) element[name] = value;
        else element.setAttribute(name, value);
      }
      return element;
    }
    const button = (id, text, attributes) => node("button", id, text, { type: "button", ...attributes });
    const paragraph = (id, text, attributes) => node("p", id, text, attributes);
    const panel = node("section", "chat-calendar-panel", "", { class: "chat-calendar", "aria-labelledby": "availability-title" });
    const heading = node("header", "chat-calendar-heading");
    const toggle = button("chat-calendar-toggle", "Collapse calendar", { "aria-expanded": "true", "aria-controls": "chat-calendar-body" });
    heading.append(node("h2", "availability-title", "Family calendars"), node("span", "", "Sample calendars", { class: "calendar-sample" }), toggle);
    const notice = paragraph("owner-source-row", "", { class: "calendar-sample" });
    notice.append(node("strong", "owner-source-badge", "Sample calendars"), document.createTextNode(" / Synthetic schedules"));
    const strip = node("div", "chat-calendar-status", "", { "aria-label": "Calendar sources and coverage" });
    const safety = paragraph("chat-calendar-safety", "", { role: "status", hidden: true, tabindex: "-1" });
    const overview = node("div", "chat-calendar-overview", "", { "aria-live": "polite" });
    overview.append(paragraph("chat-calendar-scope", "Calendars"));
    const sourceStates = node("div", "", "", { class: "calendar-source-states" });
    for (const index of [0, 1, 2]) sourceStates.append(node("span", "chat-calendar-person-" + index));
    overview.append(sourceStates);
    const details = node("details", "chat-calendar-source-details", "", { class: "availability-details" });
    details.append(node("summary", "", "Details"), notice);
    strip.append(overview);
    for (const [id, text, tag, attributes] of [
      ["availability-source", "Sample data / Not real calendars"],
      ["availability-window", "Nothing checked."],
      ["availability-parent-details", "", "div"],
      ["availability-freshness", "Freshness unknown."],
      ["child-week-status", "Kimi (sample) / Not loaded."],
      ["availability-status", "Schedules not loaded.", "p", { hidden: true, tabindex: "-1", role: "status" }],
      ["availability-status-details", "", "p", { hidden: true, role: "status" }],
      ["child-status", "", "p", { hidden: true, tabindex: "-1", role: "status" }],
      ["child-status-details", "", "p", { hidden: true, role: "status" }],
      ["availability-cleanup", "", "p", { hidden: true, role: "status" }]
    ]) {
      const target = ["availability-status", "child-status", "availability-cleanup"].includes(id) ? strip : details;
      target.append(node(tag || "p", id, text, attributes));
    }
    strip.append(details);
    const body = node("div", "chat-calendar-body");
    const people = node("div", "", "", { class: "calendar-people", role: "group", "aria-label": "Calendar loading status" });
    for (const [index, name] of ["Mike", "Debby", "Kimi"].entries()) {
      const chip = node("span", "member-row-" + index, "", { class: "member-chip" });
      chip.append(button("calendar-person-" + index, name + " (sample)", { disabled: true }),
        button("member-remove-" + index, "-", { "aria-label": "Remove " + name + " from sample member list" }));
      people.append(chip);
    }
    people.append(node("span", "member-demo-list"), button("member-add", "+", { "aria-label": "Add sample member", "aria-expanded": "false", "aria-controls": "member-editor" }));
    const editor = node("div", "member-editor", "", { hidden: true, class: "member-editor" });
    const nameLabel = node("label", "", "Member name", { for: "member-name" });
    nameLabel.append(node("input", "member-name", "", { type: "text", maxlength: "40", autocomplete: "off", "aria-describedby": "member-demo-help member-message" }));
    editor.append(nameLabel, button("member-save", "Add"), button("member-cancel", "Cancel"));
    const memberHelp = paragraph("member-demo-help", "Sample member list only. Calendars and Sync stay unchanged.");
    memberHelp.append(button("member-reset", "Reset members", { hidden: true }));
    const dates = node("div", "", "", { hidden: true });
    for (const id of ["availability-start", "availability-end"]) dates.append(node("input", id, "", { type: "hidden" }));
    const surface = node("div", "availability-surface", "", { class: "week-surface" });
    const actions = node("div", "", "", { class: "availability-actions" });
    const sync = button("availability-load", "", { hidden: true, disabled: true, "aria-describedby": "availability-targets availability-load-scope availability-saved-help child-retention" });
    sync.append(node("span", "", "", { class: "sync-calendar-icon", "aria-hidden": "true" }), node("span", "availability-sync-label", "Sync"));
    actions.append(sync, button("availability-clear", "Clear", { "aria-label": "Clear sample saved views and remembered source" }));
    const empty = node("div", "availability-empty", "", { class: "week-empty", role: "region", "aria-labelledby": "availability-empty-title" });
    empty.append(node("h3", "availability-empty-title", "Your week, at a glance"), paragraph("availability-empty-description", "Choose your dates, then select Sync."));
    surface.append(actions, empty);
    const legend = node("div", "availability-legend", "", { hidden: true });
    const list = node("ul", "", "", { class: "week-legend", "aria-label": "Calendar status legend" });
    for (const [status, label] of [["free_or_elsewhere", "No busy time*"], ["tentative", "Tentative"], ["busy", "Busy"], ["oof", "Away"], ["unknown", "Unknown"]]) {
      list.append(node("li", "", label, { "data-status": status }));
    }
    legend.append(list, paragraph("week-help", "*No busy block is not guaranteed availability. Missing time is unknown."));
    const navigation = node("div", "", "", { class: "display-navigation", role: "group", "aria-label": "Calendar display only" });
    navigation.append(button("availability-display-previous", "Earlier days", { disabled: true, "aria-describedby": "availability-display-help" }),
      button("availability-display-next", "Later days", { disabled: true, "aria-describedby": "availability-display-help" }));
    details.append(navigation);
    for (const [id, text] of [
      ["availability-targets", "Mike (sample) + Debby (sample) / Default calendars / Busy-only"],
      ["availability-date-help", "Calendar coverage stays 9-15 October 2026. Browsing months does not load other dates."],
      ["availability-date-sharing", "Calendar dates stay in memory, separate from activity dates."],
      ["availability-range-support", "Sample dates only."],
      ["availability-load-scope", "Nothing checked."],
      ["availability-saved-help", "Sync opens only fictional fixtures. Clear removes only these in-memory fixtures."],
      ["availability-display-label", ""],
      ["availability-display-help", "Previous/Next change the view only, not dates, consent or loaded scope."],
      ["child-retention", "Fictional data only, in memory."],
      ["child-imported-access", ""],
      ["child-event-help", "Permitted names and times stay inside Calendar. Private events stay unnamed; gaps are unknown, not free."],
      ["owner-source-notice", "No real calendars or providers are accessed."],
      ["availability-grid-source", "Fictional data only."],
      ["availability-identity", "Sample schedules do not establish real calendar access."],
      ["availability-retention", "Memory only."],
      ["availability-storage", "No calendar file or browser storage is used."]
    ]) details.append(paragraph(id, text));
    details.append(paragraph("", "Saved views retain their original check times. After five minutes they are stale. This page expires after 30 minutes. No background refresh, calendar changes, bookings or assistant access."),
      button("availability-check", "Check status"));
    const candidates = node("section", "calendar-candidates", "", { hidden: true, "aria-label": "Candidate family times" });
    candidates.append(paragraph("calendar-candidate-status", "", { role: "status" }),
      node("ul", "calendar-candidate-list", "", { class: "calendar-candidate-list" }),
      paragraph("calendar-candidate-note", "No overlapping busy time in the loaded calendars. Availability is not guaranteed; travel is not included."));
    const monthOverview = node("details", "calendar-month-overview", "", { class: "availability-details", hidden: true });
    monthOverview.open = true;
    monthOverview.append(node("summary", "", "Browse October"));
    const month = node("section", "calendar-month", "", { "aria-labelledby": "calendar-month-title" });
    const monthHeading = node("div", "", "", { class: "calendar-month-heading" });
    monthHeading.append(button("calendar-month-previous", "\u2039", { "aria-label": "Previous month", title: "Previous month" }),
      node("h3", "calendar-month-title", "", { "aria-live": "polite" }),
      button("calendar-month-next", "\u203a", { "aria-label": "Next month", title: "Next month" }));
    const weekdays = node("div", "", "", { class: "calendar-month-weekdays", "aria-hidden": "true" });
    for (const day of ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]) weekdays.append(node("span", "", day));
    month.append(monthHeading, weekdays, node("div", "calendar-month-days", "", { class: "calendar-month-days", role: "group", "aria-label": "Month dates" }),
      paragraph("calendar-month-note", "Unloaded dates are unknown.", { class: "calendar-month-note" }));
    const dayDetails = node("details", "calendar-day-details", "", { class: "availability-details" });
    dayDetails.open = true;
    dayDetails.append(node("summary", "calendar-day-title", "Schedule details"), legend,
      paragraph("calendar-candidate-selection", "", { hidden: true }),
      node("div", "availability-grid", "", { hidden: true, role: "region", tabindex: "0", "aria-label": "Weekly calendar", "aria-describedby": "week-help" }));
    monthOverview.append(month);
    details.append(paragraph("", "Candidate times: up to six distinct weekend windows across October, at least two consecutive hours between 09:00 and 20:00 Taipei. One per Monday-based week first, then additional dates; longest interval per day, earlier on ties. Weekends are not guaranteed days off. Public-holiday dates have not been verified. These are sample display rules, not saved family preferences. Activity suggestions use their separate October 9-11 sample window."),
      paragraph("calendar-invitation-source", "Invitations use sample data and stay on this page. No invitation is delivered and no calendars are changed."));
    const coordination = node("section", "calendar-coordination", "", { hidden: true, "aria-labelledby": "coordination-title" });
    coordination.append(node("h3", "coordination-title", "Kimi's school meeting"),
      paragraph("", "Parent-teacher meeting / Fri, Oct 16 / 15:30-16:30 Taipei"),
      button("coordination-review", "Review a school meeting", { "aria-expanded": "false", "aria-controls": "coordination-body" }));
    const coordinationBody = node("div", "coordination-body", "", { hidden: true });
    coordinationBody.append(paragraph("coordination-status", "", { role: "status", tabindex: "-1" }),
      node("div", "coordination-timeline", "", { "aria-label": "Meeting and parent busy times, 14:00 to 18:00 Taipei" }),
      paragraph("coordination-result", "", { role: "status", hidden: true }),
      paragraph("", "Current user: Debby. Mike's response and travel are not confirmed.", { class: "coordination-note" }));
    coordination.append(coordinationBody);
    details.append(people, editor, memberHelp, paragraph("member-message", "", { hidden: true, role: "status" }), dates);
    body.append(
      paragraph("availability-date-error", "", { hidden: true, role: "status" }), button("availability-supported-dates", "Choose 9-15 October 2026", { hidden: true }),
      button("availability-refresh", "Update", { hidden: true, disabled: true }), button("availability-saved", "View saved only", { hidden: true, disabled: true }),
      paragraph("availability-recovery", "Reload to begin again; nothing loads automatically.", { hidden: true }),
      node("div", "availability-context", "", { hidden: true, "aria-live": "polite" }), surface, monthOverview, dayDetails, candidates, coordination);
    panel.append(heading, safety, strip, body);
    host.append(panel);
    return { panel, toggle, body, strip, safety, nodes };
  }
  return Object.freeze({ create });
});