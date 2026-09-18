"use strict";
const { createPicker, messages } = require("./core.js");

function mount(options, doc = document, win = window) {
  const byId = id => doc.getElementById(id);
  const content = byId("picker-content"), status = byId("picker-status");
  let priorStatus;
  function node(tag, text) { const el = doc.createElement(tag); if (text) el.textContent = text; return el; }
  function button(text, action) { const el = node("button", text); el.type = "button"; el.onclick = action; return el; }
  function render(s) {
    const focusId = doc.activeElement?.id;
    status.textContent = messages[s.status];
    byId("sign-in").disabled = s.settling || ["unconfigured", "cleanup", "signing", "identity", "loading", "picker", "empty", "summary"].includes(s.status);
    byId("disconnect").hidden = !["signing", "identity", "loading", "picker", "empty", "summary"].includes(s.status);
    content.replaceChildren();
    if (s.account) content.append(node("p", `Microsoft account: ${s.account.name} · ${s.account.label}`));
    if (s.status === "identity") {
      content.append(node("h2", "Is this your intended work account?"),
        node("p", "Continuing requests a bounded list of calendar names, IDs and ownership metadata. It does not read events or share with another person."),
        button("Yes, list my calendars", () => void picker.load(true)),
        button("Not my account · disconnect", () => picker.disconnect()));
    }
    if (["picker", "summary", "empty"].includes(s.status)) {
      content.append(node("p", `Source: Microsoft Graph /me/calendars · List received: ${new Date(s.listedAt).toLocaleString()}. Snapshot only; no background refresh.`));
      content.append(node("p", `${s.excluded} calendar(s) withheld: shared or ownership could not be matched. Aliases may cause your own calendar to be withheld. Missing calendars are not free time.`));
    }
    if (s.status === "picker") {
      const fieldset = node("fieldset"), legend = node("legend", "Choose your own calendars"); fieldset.append(legend);
      s.calendars.forEach((c, index) => {
        const label = node("label"), input = node("input");
        input.type = "checkbox"; input.id = `choice-${index}`; input.checked = s.selected.includes(c.id);
        input.onchange = () => picker.select(index, input.checked);
        label.append(input, node("span", `${c.name} · Calendar ${index + 1}`)); fieldset.append(label);
      });
      const label = node("label"), self = node("input"); self.type = "checkbox"; self.id = "represents-self"; self.checked = s.self;
      self.onchange = () => picker.represent(self.checked);
      label.append(self, node("span", "These selected calendars represent my own schedule, not a child or another adult."));
      const review = button("Review selection", () => picker.review()); review.id = "review-selection";
      content.append(fieldset, label, review);
    }
    if (s.status === "summary") {
      const list = node("ul");
      s.calendars.forEach((c, index) => { if (s.selected.includes(c.id)) list.append(node("li", `${c.name} · Calendar ${index + 1}`)); });
      content.append(node("h2", "Your selection summary"), list,
        node("p", "Represents: the signed-in account holder (self-attested). Audience: you in this tab only. No cross-family sharing or assistant access."),
        node("p", "Event disclosure: none. Import range: none. Events checked: none. Schedule compatibility and conflicts are not assessed."),
        node("p", "Retention: memory in this page only. Reload, navigation or disconnect clears the list and selection. This is not an invitation acceptance or a saved calendar connection."),
        button("Change selection", () => picker.back()));
    }
    byId("picker-error").textContent = s.note || (s.settling && s.status !== "signing" ? "Waiting for the previous authentication attempt and local cache cleanup to settle. Close its popup if still open; reload this tab if it cannot finish." : "");
    if (priorStatus !== s.status) status.focus();
    else if (focusId) byId(focusId)?.focus();
    priorStatus = s.status;
  }
  const picker = createPicker({ ...options, onChange:render });
  byId("sign-in").onclick = () => void picker.connect();
  byId("disconnect").onclick = () => picker.disconnect();
  win.addEventListener("pagehide", () => picker.disconnect());
  win.addEventListener("pageshow", event => { if (event.persisted) picker.disconnect(); });
  win.addEventListener("focus", () => picker.check());
  doc.addEventListener("visibilitychange", () => { if (doc.visibilityState === "visible") picker.check(); });
  render(picker.snapshot());
  return picker;
}
module.exports = { mount };