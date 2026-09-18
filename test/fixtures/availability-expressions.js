"use strict";
// Small OFFLINE evaluator for precisely the WDL expression subset used here.
// This is not an Azure emulator or a runtime-proof claim. No eval or networking.
function expression(text, context) {
  if (typeof text !== "string" || !text.startsWith("@")) return text;
  let at = 1;
  const skip = () => { while (/\s/.test(text[at] || "") && at < text.length) at++; };
  const funcs = {
    body: x => context.actions[x], outputs: x => context.actions[x], parameters: x => context.parameters[x], item: () => context.item,
    equals: (a, b) => JSON.stringify(a) === JSON.stringify(b), not: x => !x, and: (...x) => x.every(Boolean), if: (a,b,c) => a ? b : c,
    length: x => x.length, string: x => x == null ? "" : typeof x === "string" ? x : JSON.stringify(x),
    split: (s, delimiter) => s.split(delimiter), last: x => x.at(-1), contains: (s, value) => s.includes(value),
    replace: (s, from, to) => s.split(from).join(to), empty: x => x.length === 0,
    add: (a, b) => a + b, greater: (a, b) => a > b, greaterOrEquals: (a, b) => a >= b,
    toLower: x => x.toLowerCase(), first: x => x[0], union: (a,b) => [...a, ...b.filter(x => !a.some(y => JSON.stringify(x) === JSON.stringify(y)))],
    createArray: (...x) => x, json: JSON.parse, concat: (...x) => x.join(""), substring: (s, n, count) => s.slice(n,n+count),
    range: (n,count) => Array.from({length:count}, (_,i) => n+i), utcNow: () => "2026-09-15T01:00:00Z",
    // Extra offline-only WDL functions can be supplied by another contract test.
    ...(context.functions || {})
  };
  function parse() {
    skip(); let value;
    if (text[at] === "'") { at++; const end = text.indexOf("'",at); if (end < 0) throw new Error("syntax"); value = text.slice(at,end); at = end+1; }
    else if (/\d/.test(text[at] || "")) { const match = /^\d+/.exec(text.slice(at))[0]; value = Number(match); at += match.length; }
    else {
      const name = /^[A-Za-z_][A-Za-z_0-9]*/.exec(text.slice(at))?.[0]; if (!name) throw new Error("syntax"); at += name.length; skip();
      if (name === "null") value = null;
      else if (name === "true" || name === "false") value = name === "true";
      else {
        if (text[at++] !== "(" || !Object.hasOwn(funcs,name)) throw new Error("unsupported");
        const args = []; skip();
        while (text[at] !== ")") { args.push(parse()); skip(); if (text[at] !== ",") break; at++; }
        if (text[at++] !== ")") throw new Error("syntax"); value = funcs[name](...args);
      }
    }
    skip();
    while (text[at] === "?" || text[at] === "[") {
      const optional = text[at] === "?"; if (optional) at++;
      if (text[at++] !== "[") throw new Error("syntax"); const key = parse();
      if (text[at++] !== "]") throw new Error("syntax"); value = value?.[key]; if (optional && value === undefined) value = null; skip();
    }
    return value;
  }
  const result = parse(); skip(); if (at !== text.length) throw new Error("trailing"); return result;
}
function projectCloud(workflow, raw, targets) {
  const actions = workflow.properties.definition.actions;
  const c = { parameters: { targets: { people: targets } }, actions: { Validate_response: raw } };
  for (const person of [0,1]) {
    const match = `Match_${person}`, state = `State_${person}`, grid = `Grid_${person}`;
    c.actions[match] = expression(actions[match].inputs.from,c).filter(item => expression(actions[match].inputs.where,{...c,item}));
    c.actions[state] = expression(actions[state].inputs,c);
    c.actions[grid] = expression(actions[grid].inputs.from,c).map(item => expression(actions[grid].inputs.select,{...c,item}));
  }
  const response = actions.Availability.inputs.body;
  return { window: { ...response.window }, checkedAt: expression(response.checkedAt,c), people: response.people.map(p => ({person:p.person,status:expression(p.status,c),slots:expression(p.slots,c)})) };
}
module.exports = { expression, projectCloud };