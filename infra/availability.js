"use strict";
const { buildWorkflow, scope, workflowId: ownerId } = require("./calendar-list");
const workflowName = "familycopilot-availability-dev";
const workflowId = ownerId.replace(scope.workflow, workflowName);
// Independent literal freezes the v4 factory against future UI/default changes.
const window = Object.freeze({ start: "2026-09-19T16:00:00Z", end: "2026-09-26T16:00:00Z", timezone: "Asia/Taipei", interval: 30, slots: 336 });
const { liveWindow } = require("../owner/availability-core");
const priorWeekWindow = Object.freeze({ start: "2026-09-14T16:00:00Z", end: "2026-09-21T16:00:00Z", timezone: "Asia/Taipei", interval: 30, slots: 336 });
const legacyWindow = Object.freeze({ start: "2026-09-15T01:00:00Z", end: "2026-09-15T09:00:00Z", timezone: "Asia/Taipei", interval: 30, slots: 16 });
const secure = (...properties) => ({ secureData: { properties } });
const after = name => ({ [name]: ["Succeeded"] });
const response = (body, runAfter, statusCode = 200) => ({ type: "Response", kind: "Http", runAfter,
  inputs: { statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body }, runtimeConfiguration: secure("inputs") });
const unknown = (person, status) => ({ person, status, slots: Array(16).fill("unknown") });
function validateTargets(targets) {
  if (!Array.isArray(targets) || targets.length !== 2 || targets.some(x => typeof x !== "string" ||
    x.length > 254 || !/^[a-z0-9][a-z0-9._+-]*@[a-z0-9.-]+\.[a-z]{2,}$/i.test(x)) || targets[0].toLowerCase() === targets[1].toLowerCase()) throw new Error("invalid_operator_config");
  return targets.map(x => x.toLowerCase());
}
// Frozen prior contract, accepted only by the one-way guarded repair path.
function buildLegacyAvailability(caller, targets) {
  const window = legacyWindow;
  const w = buildWorkflow(caller);
  w.tags = { application: "FamilyCopilot", purpose: "owner-two-person-availability", environment: "development", contract: "bounded-availability-v1" };
  const d = w.properties.definition;
  d.parameters.targets = { type: "SecureObject" };
  if (targets) w.properties.parameters.targets = { value: { people: validateTargets(targets) } };
  const fallback = status => ({ window, checkedAt: "@utcNow()", people: [unknown(0, status), unknown(1, status)] });
  const actions = {
    Validate_request: { type: "ParseJson", runAfter: {}, inputs: { content: "@triggerBody()", schema: { type: "object", properties: {}, additionalProperties: false } }, runtimeConfiguration: secure("inputs") },
    Validate_targets: { type: "ParseJson", runAfter: after("Validate_request"), inputs: { content: "@parameters('targets')['people']", schema: {
      type: "array", minItems: 2, maxItems: 2, uniqueItems: true, items: { type: "string", minLength: 3, maxLength: 254, pattern: "^[a-z0-9][a-z0-9._+-]*@[a-z0-9.-]+\\.[a-z]{2,}$" }
    } }, runtimeConfiguration: secure("inputs") },
    Get_schedule: { type: "ApiConnection", runAfter: after("Validate_targets"), inputs: {
      host: { connection: { name: "@parameters('$connections')['office365']['connectionId']" } },
      method: "post", path: "/codeless/httprequest", headers: { Uri: "https://graph.microsoft.com/v1.0/me/calendar/getSchedule", Method: "POST", ContentType: "application/json" },
      body: { schedules: "@body('Validate_targets')", startTime: { dateTime: "2026-09-15T01:00:00", timeZone: "UTC" }, endTime: { dateTime: "2026-09-15T09:00:00", timeZone: "UTC" }, availabilityViewInterval: 30 },
      retryPolicy: { type: "none" }
    }, limit: { timeout: "PT1M" }, runtimeConfiguration: secure("inputs", "outputs") },
    Validate_response: { type: "ParseJson", runAfter: after("Get_schedule"), inputs: { content: "@body('Get_schedule')", schema: {
      type: "object", required: ["value"], properties: { value: { type: "array", maxItems: 2, items: { type: "object" } } }
    } }, runtimeConfiguration: secure("inputs") },
    Invalid_request: response({ status: "blocked" }, { Validate_request: ["Failed", "TimedOut"] }, 400),
    Invalid_targets: response(fallback("unavailable"), { Validate_targets: ["Failed", "TimedOut"] }),
    Unavailable: response(fallback("unavailable"), { Get_schedule: ["Failed", "TimedOut"] }),
    Invalid_response: response(fallback("invalid"), { Validate_response: ["Failed", "TimedOut"] })
  };
  for (const person of [0, 1]) {
    const match = `Match_${person}`, state = `State_${person}`, grid = `Grid_${person}`;
    actions[match] = { type: "Query", runAfter: after("Validate_response"), inputs: {
      from: "@body('Validate_response')['value']", where: `@equals(toLower(string(item()?['scheduleId'])), parameters('targets')['people'][${person}])`
    }, runtimeConfiguration: secure("inputs", "outputs") };
    // first() is always safe, even for missing rows. No provider text is emitted.
    const row = `first(union(body('${match}'), createArray(json('{}'))))`;
    actions[state] = { type: "Compose", runAfter: after(match), inputs:
      `@if(equals(length(body('${match}')),0),'missing',if(not(equals(length(body('${match}')),1)),'invalid',if(not(equals(${row}?['error'],null)),'unavailable',if(and(equals(${row}?['availabilityView'],string(${row}?['availabilityView'])),equals(length(string(${row}?['availabilityView'])),16)),'checked','invalid'))))`, runtimeConfiguration: secure("inputs") };
    const digit = `substring(concat(string(${row}?['availabilityView']),'????????????????'),item(),1)`;
    actions[grid] = { type: "Select", runAfter: after(state), inputs: { from: "@range(0,16)", select:
      `@if(equals(outputs('${state}'),'checked'),if(equals(${digit},'0'),'free_or_elsewhere',if(equals(${digit},'1'),'tentative',if(equals(${digit},'2'),'busy',if(equals(${digit},'3'),'oof','unknown')))),'unknown')`
    }, runtimeConfiguration: secure("inputs", "outputs") };
    actions[`Invalid_person_${person}`] = response(fallback("invalid"), { [grid]: ["Failed", "TimedOut"] });
  }
  actions.Availability = response({ window, checkedAt: "@utcNow()", people: [0, 1].map(person => ({ person,
    status: `@outputs('State_${person}')`, slots: `@body('Grid_${person}')` })) }, { Grid_0: ["Succeeded"], Grid_1: ["Succeeded"] });
  d.actions = actions;
  return w;
}
function targetSyntax(value) {
  // Equivalent to the former lowercase regex, without the unsupported ParseJson
  // pattern keyword. Shape/length/uniqueness validation must succeed first.
  const letters = "abcdefghijklmnopqrstuvwxyz", digits = "0123456789";
  const strip = (expression, chars) => [...chars].reduce((s, c) => `replace(${s},'${c}','')`, expression);
  const local = `first(split(${value},'@'))`, host = `last(split(${value},'@'))`;
  const suffix = `last(split(${host},'.'))`;
  return `@and(equals(length(split(${value},'@')),2),contains('${letters + digits}',substring(concat(${local},'?'),0,1)),empty(${strip(local, letters + digits + "._+-")}),contains(${host},'.'),greater(length(${host}),add(length(${suffix}),1)),empty(${strip(host, letters + digits + ".-")}),greaterOrEquals(length(${suffix}),2),empty(${strip(suffix, letters)}))`;
}
function buildRepairedAvailability(caller, targets) {
  const w = buildLegacyAvailability(caller, targets);
  w.tags.contract = "bounded-availability-v2";
  const a = w.properties.definition.actions;
  delete a.Validate_targets.inputs.schema.items.pattern;
  a.Validate_target_syntax = { type: "ParseJson", runAfter: after("Validate_targets"), inputs: {
    content: [0, 1].map(i => targetSyntax(`body('Validate_targets')[${i}]`)),
    schema: { type: "array", minItems: 2, maxItems: 2, items: { type: "boolean", enum: [true] } }
  }, runtimeConfiguration: secure("inputs") };
  a.Get_schedule.runAfter = after("Validate_target_syntax");
  a.Invalid_target_syntax = response(a.Invalid_targets.inputs.body, { Validate_target_syntax: ["Failed", "TimedOut"] });
  return w;
}
function buildPriorWeekAvailability(caller, targets) {
  const window = priorWeekWindow;
  const w = buildRepairedAvailability(caller, targets);
  w.tags.contract = "bounded-availability-v3";
  const a = w.properties.definition.actions;
  a.Get_schedule.inputs.body.startTime.dateTime = window.start.slice(0, -1);
  a.Get_schedule.inputs.body.endTime.dateTime = window.end.slice(0, -1);
  for (const person of [0, 1]) {
    // Only the exact old slot bounds change; identity and disclosure gates stay intact.
    a[`State_${person}`].inputs = a[`State_${person}`].inputs.replace(",16)", `,${window.slots})`);
    a[`Grid_${person}`].inputs.from = `@range(0,${window.slots})`;
    a[`Grid_${person}`].inputs.select = a[`Grid_${person}`].inputs.select.replaceAll("????????????????", "?".repeat(window.slots));
  }
  for (const action of Object.values(a)) if (action.type === "Response" && action.inputs.body.window) {
    action.inputs.body.window = window;
    for (const person of action.inputs.body.people) if (Array.isArray(person.slots)) person.slots = Array(window.slots).fill("unknown");
  }
  return w;
}
function buildAvailability(caller, targets) {
  const w = buildPriorWeekAvailability(caller, targets);
  w.tags.contract = "bounded-availability-v4";
  const a = w.properties.definition.actions;
  a.Get_schedule.inputs.body.startTime.dateTime = window.start.slice(0, -1);
  a.Get_schedule.inputs.body.endTime.dateTime = window.end.slice(0, -1);
  for (const action of Object.values(a)) if (action.type === "Response" && action.inputs.body.window) action.inputs.body.window = window;
  return w;
}
function buildOctoberAvailability(caller, targets) {
  const w = buildAvailability(caller, targets);
  w.tags.contract = "bounded-availability-v5";
  const a = w.properties.definition.actions;
  a.Get_schedule.inputs.body.startTime.dateTime = liveWindow.start.slice(0, -1);
  a.Get_schedule.inputs.body.endTime.dateTime = liveWindow.end.slice(0, -1);
  for (const action of Object.values(a)) if (action.type === "Response" && action.inputs.body.window) action.inputs.body.window = liveWindow;
  return w;
}
module.exports = { workflowId, workflowName, window, liveWindow, legacyWindow, priorWeekWindow, validateTargets, buildAvailability, buildOctoberAvailability, buildPriorWeekAvailability, buildRepairedAvailability, buildLegacyAvailability, targetSyntax };