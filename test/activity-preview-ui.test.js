"use strict";
// Small DOM seam for the real offline controller; browser checks cover layout/native controls.
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const core = require("../activity-preview/core");

function harness() {
  const elements = new Map(), lifecycle = new Map();
  let focused = null, ages = [];
  class Element {
    constructor(id) { this.id = id; this.handlers = new Map(); this.attributes = {}; this.value = ""; this.checked = false; this.hidden = false; this.disabled = false; this.textContent = ""; this.html = ""; }
    addEventListener(name, handler) { this.handlers.set(name, handler); }
    fire(name, extra = {}) { this.handlers.get(name)?.({ preventDefault() {}, ...extra }); }
    focus() { focused = this.id; }
    setAttribute(key, value) { this.attributes[key] = value; }
    removeAttribute(key) { delete this.attributes[key]; }
    replaceChildren() { this.html = ""; }
    closest(selector) { return selector === "details" && ["date", "period", "format", "budget", "setting"].includes(this.id) ? elements.get("preferences") : null; }
    set innerHTML(html) {
      this.html = html;
      if (this.id !== "age-rows") return;
      ages.forEach(field => elements.delete(field.id));
      ages = [...html.matchAll(/<select id="([^"]+)"[^>]*>(.*?)<\/select>/g)].map(([, id, options]) => {
        const field = new Element(id); field.value = options.match(/value="([^"]+)" selected/)?.[1] || "";
        elements.set(id, field); return field;
      });
    }
    get innerHTML() { return this.html; }
  }
  for (const id of ["activity-form", "results", "cards", "status", "form-error", "result-summary", "age-rows", "add-age", "surprise", "results-title", "find", "edit", "reset", "preferences", "about", "date", "period", "format", "budget", "setting"]) elements.set(id, new Element(id));
  const interests = Object.keys(core.categories).map(id => { const field = new Element(id); field.value = id; return field; });
  const options = ["date", "period", "format", "budget", "setting"];
  const form = elements.get("activity-form");
  form.reset = () => { options.forEach(id => { elements.get(id).value = "any"; }); interests.forEach(field => { field.checked = false; }); };
  form.querySelectorAll = selector => selector === '[name="ages"]' ? ages : selector === '[name="interest"]' ? interests : [...elements.values()].filter(field => Object.hasOwn(field.attributes, "aria-invalid"));
  form.querySelector = () => interests.find(field => field.checked) || null;
  const document = { querySelector: selector => elements.get(selector.slice(1)), getElementById: id => elements.get(id), querySelectorAll: () => [elements.get("preferences"), elements.get("about")] };
  class FormData {
    constructor() { this.entries = [...options.map(id => [id, elements.get(id).value]), ...ages.map(field => ["ages", field.value]), ...interests.filter(field => field.checked).map(field => ["interest", field.value])]; }
    getAll(name) { return this.entries.filter(([key]) => key === name).map(([, value]) => value); }
    [Symbol.iterator]() { return this.entries[Symbol.iterator](); }
  }
  const context = vm.createContext({ document, FormData, ActivityPreview: core, addEventListener: (name, handler) => lifecycle.set(name, handler) });
  vm.runInContext(fs.readFileSync(require.resolve("../activity-preview/ui"), "utf8"), context);
  return { get: id => elements.get(id), get ages() { return ages; }, get focused() { return focused; }, interests, form,
    click: id => elements.get(id).fire("click"), submit: () => form.fire("submit"), change: () => form.fire("change"),
    remove(index) { elements.get("age-rows").fire("click", { target: { closest: () => ({ dataset: { remove: String(index) } }) } }); },
    leave: () => lifecycle.get("pagehide")(), restore: () => lifecycle.get("pageshow")({ persisted: true }) };
}

test("actual activity UI renders only on submit and invalidates prior results on input", () => {
  const h = harness();
  assert.equal(h.get("results").hidden, true); assert.equal(h.get("cards").innerHTML, "");
  assert.equal(h.ages.length, 1); assert.equal(h.ages[0].value, "");
  assert.equal(h.get("preferences").open, false);
  h.submit();
  assert.equal((h.get("cards").innerHTML.match(/<article/g) || []).length, 6);
  assert.equal(h.focused, "results-title"); assert.equal(h.get("results").hidden, false);
  h.form.fire("input");
  assert.equal(h.get("results").hidden, true); assert.equal(h.get("cards").innerHTML, "");
  assert.match(h.get("status").textContent, /Choices changed/);
});

test("actual age add/remove handlers preserve twins, enforce max eight and return useful focus", () => {
  const h = harness(); h.ages[0].value = "8"; h.click("add-age");
  assert.equal(h.focused, "age-1"); assert.equal(h.ages[0].value, "8");
  h.ages[1].value = "10"; h.submit();
  assert.match(h.get("result-summary").textContent, /Ages 8 \+ 10/);
  assert.match(h.get("cards").innerHTML, /checking-heading/);
  h.remove(0); assert.equal(h.ages[0].value, "10"); assert.equal(h.focused, "age-0");
  h.remove(0); assert.equal(h.ages.length, 0); assert.equal(h.focused, "add-age");
  h.click("add-age"); h.ages[0].value = "8"; h.click("add-age"); h.ages[1].value = "8";
  h.submit(); assert.match(h.get("result-summary").textContent, /Ages 8 \+ 8/);
  for (let i = 0; i < 10; i++) h.click("add-age");
  assert.equal(h.ages.length, 8); assert.equal(h.get("add-age").disabled, true);
  assert.match(h.get("status").textContent, /Eight ages maximum/);
  h.remove(7); assert.equal(h.ages.length, 7); assert.equal(h.focused, "age-6"); assert.equal(h.get("add-age").disabled, false);
  assert.doesNotMatch(h.get("status").textContent, /Eight ages maximum/);
  h.remove(999); assert.equal(h.ages.length, 7);
});

test("removing all ages and Surprise us are explicit independent actions, not silent filter relaxation", () => {
  const h = harness(); h.ages[0].value = "8"; h.interests[0].checked = true; h.change();
  assert.equal(h.get("surprise").attributes["aria-pressed"], "false");
  h.get("budget").value = "0"; h.submit(); assert.match(h.get("cards").innerHTML, /No ideas match/);
  h.click("surprise"); assert.equal(h.get("results").hidden, true);
  assert.equal(h.ages[0].value, "8"); assert.equal(h.get("budget").value, "0");
  assert.ok(h.interests.every(field => !field.checked)); assert.equal(h.get("surprise").attributes["aria-pressed"], "true");
  h.submit(); assert.match(h.get("result-summary").textContent, /Any interest/);
  h.remove(0); assert.equal(h.ages.length, 0); assert.equal(h.focused, "add-age");
  assert.equal(h.get("results").hidden, true); assert.equal(h.get("budget").value, "0");
  h.submit(); assert.match(h.get("result-summary").textContent, /Age not checked/);
  assert.doesNotMatch(h.get("cards").innerHTML, /covers every selected age/);
});

test("Any skips an age without removing its chip or changing the other filters", () => {
  const h = harness(); h.ages[0].value = "8"; h.interests[0].checked = true;
  h.get("budget").value = "15"; h.submit();
  h.ages[0].value = ""; h.change();
  assert.equal(h.get("results").hidden, true); assert.equal(h.get("cards").innerHTML, "");
  assert.equal(h.ages.length, 1); assert.equal(h.interests[0].checked, true);
  assert.equal(h.get("budget").value, "15");
  h.submit(); assert.match(h.get("result-summary").textContent, /Age not checked/);
  assert.equal((h.get("cards").innerHTML.match(/<article/g) || []).length, 1);
  h.click("edit"); assert.equal(h.focused, "age-0");
  h.remove(0); h.submit(); h.click("edit"); assert.equal(h.focused, "add-age");
});

test("actual UI errors focus the age or open More options, without results or unsafe echo", () => {
  const h = harness(); h.ages[0].value = "<img>"; h.submit();
  assert.equal(h.focused, "age-0"); assert.equal(h.ages[0].attributes["aria-invalid"], "true");
  assert.equal(h.get("results").hidden, true); assert.doesNotMatch(h.get("form-error").textContent, /<img>/);
  h.ages[0].value = "8"; h.change(); assert.equal(h.ages[0].attributes["aria-invalid"], undefined);
  h.get("date").value = "2026-09-19"; h.submit(); assert.equal(h.focused, "date"); assert.equal(h.get("preferences").open, true);
});

test("start over, reload, page exit and history restoration clear ages, interests and results", () => {
  for (const action of [h => h.click("reset"), h => h.leave(), h => h.restore()]) {
    const h = harness(); h.ages[0].value = "8"; h.click("add-age"); h.ages[1].value = "10";
    h.interests[0].checked = true; h.get("budget").value = "15"; h.get("preferences").open = true; h.submit(); action(h);
    assert.equal(h.ages.length, 1); assert.equal(h.ages[0].value, "");
    assert.ok(h.interests.every(field => !field.checked)); assert.equal(h.get("budget").value, "any");
    assert.equal(h.get("results").hidden, true); assert.equal(h.get("cards").innerHTML, ""); assert.equal(h.get("preferences").open, false);
    assert.equal(h.get("surprise").attributes["aria-pressed"], "true");
  }
  const freshPage = harness(); assert.equal(freshPage.ages[0].value, ""); assert.equal(freshPage.get("cards").innerHTML, "");
});