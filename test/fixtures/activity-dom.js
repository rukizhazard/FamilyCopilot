"use strict";
// Deterministic DOM seam for BOTH real activity controllers. No network or browser.
const vm = require("node:vm"), fs = require("node:fs");
const core = require("../../activity-preview/core"), D = require("../../shared/date-selection"), T = require("../../shared/basketball-teams");
const { dateStorage } = require("./date-storage");
// Legacy mounted-ideas tests remain useful for controller compatibility.
// ideasSurface:false models the current page, where those nodes are removed.
function activityDOM(reply, { preview = false, ideasSurface = true, contextWeek = D.describeWeek(), storage = dateStorage() } = {}) {
  const nodes = new Map(), lifecycle = new Map(), requests = []; let focus, ages = [];
  class Element {
    constructor(tag = "div", id) { this.tag = tag; this.id = id; this.children = []; this.handlers = {}; this.dataset = {}; this.attributes = {}; this.textContent = ""; this.value = ""; this.checked = false; }
    addEventListener(name, fn) { (this.handlers[name] ||= []).push(fn); }
    async fire(name, extra = {}) {
      const event = { defaultPrevented: false, propagationStopped: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.propagationStopped = true; }, target: this, ...extra };
      for (const fn of this.handlers[name] || []) await fn(event);
      return event;
    }
    setAttribute(name, value) { this.attributes[name] = value; }
    removeAttribute(name) { delete this.attributes[name]; }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; this.html = ""; }
    querySelectorAll(tag) { return this.children.flatMap(child => [...(child.tag === tag ? [child] : []), ...child.querySelectorAll(tag)]); }
    focus() { focus = this; }
    closest(selector) { return selector === "details" && options.includes(this.id) ? get("preferences") : null; }
    set innerHTML(value) {
      if (!["age-rows", "cards"].includes(this.id)) throw new Error("Public HTML injection sink forbidden");
      this.html = value;
      if (this.id !== "age-rows") return;
      ages.forEach(field => nodes.delete(field.id));
      ages = [...value.matchAll(/<select id="([^"]+)"[^>]*>(.*?)<\/select>/g)].map(([, id, choices]) => {
        const field = get(id); field.value = choices.match(/value="([^"]+)" selected/)?.[1] || ""; return field;
      });
    }
    get innerHTML() { return this.html || ""; }
  }
  const get = id => { if (!nodes.has(id)) nodes.set(id, new Element("div", id)); return nodes.get(id); };
  const interests = Object.keys(core.categories).map(id => { const field = get(id); field.value = id; return field; });
  const sports = Object.keys(core.sports).map(id => { const field = get(id); field.value = id; return field; });
  const options = ["date", "period", "format", "budget", "setting"], form = get("activity-form");
  form.reset = () => {
    options.forEach(id => { get(id).value = "any"; }); interests.forEach(field => { field.checked = false; });
    sports.forEach(field => { field.checked = false; });
    for (const id of ["activity-start", "activity-end", "team-name"]) get(id).value = "";
    get("only-teams").checked = true;
  };
  form.querySelectorAll = selector => selector === '[name="ages"]' ? ages : selector === '[name="interest"]' ? interests :
    selector === '[name="sport"]' ? sports : [...nodes.values()].filter(field => Object.hasOwn(field.attributes, "aria-invalid"));
  form.querySelector = () => interests.find(field => field.checked);
  get("basketball-status").dataset.preview = String(preview);
  const lookup = id => !ideasSurface && ["results", "cards", "result-summary", "results-title", "edit"].includes(id) ? null : get(id);
  const document = { getElementById: get, createElement: tag => new Element(tag),
    querySelector: selector => selector === ".shell-date" ? get("date-label") : selector.startsWith("meta") ? { content: JSON.stringify(contextWeek) } : lookup(selector.slice(1)),
    querySelectorAll: () => [get("preferences"), get("about")], addEventListener: (name, fn) => { (lifecycle.get(name) || lifecycle.set(name, []).get(name)).push(fn); } };
  class FormData {
    constructor() { this.entries = [...options.map(id => [id, get(id).value]), ...ages.map(field => ["ages", field.value]),
      ...interests.filter(field => field.checked).map(field => ["interest", field.value]), ...sports.filter(field => field.checked).map(field => ["sport", field.value])]; }
    getAll(name) { return this.entries.filter(([key]) => key === name).map(([, value]) => value); }
    [Symbol.iterator]() { return this.entries[Symbol.iterator](); }
  }
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : ["2026-09-17T00:00:00Z"])); }
    static now() { return Date.parse("2026-09-17T00:00:00Z"); }
  }
  const context = vm.createContext({ document, FormData, Date: FixedDate, AbortController, AbortSignal,
    ActivityPreview: core, BasketballTeams: T, FamilyDates: { ...D, createStore: () => D.createStore(() => storage) },
    addEventListener: document.addEventListener,
    fetch: async (path, options) => { requests.push({ path, options }); return reply(path, options); } });
  for (const file of ["ui", "basketball-ui"]) vm.runInContext(fs.readFileSync(require.resolve(`../../activity-preview/${file}`), "utf8"), context);
  const input = async (id, value) => { get(id).value = value; const event = await get(id).fire("input"); if (!event.propagationStopped) await form.fire("input", { target: get(id) }); };
  return { get, requests, storage, form, interests, sports, get ages() { return ages; }, get focus() { return focus; },
    click: id => id === "find" ? form.fire("submit") : get(id).fire("click"),
    lifecycle: async (name, event = {}) => { for (const fn of lifecycle.get(name) || []) await fn(event); },
    category: async (...values) => { interests.forEach(field => { field.checked = values.includes(field.value); }); await form.fire("change"); },
    sport: async (...values) => { sports.forEach(field => { field.checked = values.includes(field.value); }); await form.fire("change"); },
    // Native Space toggles checkboxes and bubbles input/change; Enter submits.
    // This is a controller seam, not a browser keyboard/layout validation.
    key: async (id, key, extra = {}) => {
      const field = get(id); field.focus();
      const event = await field.fire("keydown", { key, ...extra });
      if (event.defaultPrevented) return event;
      if (key === " " && [...interests, ...sports].includes(field)) { field.checked = !field.checked; await form.fire("input", { target: field }); await form.fire("change", { target: field }); }
      else if (key === "Enter" && ["find", "team-name"].includes(id)) await form.fire("submit");
      else if (key === "Enter") await field.fire("click");
      return event;
    },
    input,
    addTeam: async name => { await input("team-name", name); await get("add-team").fire("click"); },
    removeTeam: index => get("preferred-teams").querySelectorAll("button")[index].fire("click")
  };
}
const text = node => [node.textContent, ...node.children.map(text)].join(" ");
module.exports = { activityDOM, text };