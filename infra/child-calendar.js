"use strict";
// Candidate HttpRequest contract. Deployment requires current exported metadata,
// exact caller/preservation checks and an explicit operator gate. Never deployed on import.
const { buildWorkflow, workflowId: listId, scope } = require("./calendar-list");
const C = require("../owner/child-calendar-core");
const workflowName = "familycopilot-child-calendar-dev";
const workflowId = listId.replace(scope.workflow, workflowName);
const secure = (...properties) => ({ secureData: { properties } });
const after = name => ({ [name]: ["Succeeded"] });
const response = (body, runAfter, statusCode = 200) => ({ type: "Response", kind: "Http", runAfter,
  inputs: { statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body }, runtimeConfiguration: secure("inputs") });
const requestSchema = { type: "object", additionalProperties: false, required: ["calendarId", "disclosure", "guardian", "person", "confirmed"], properties: {
  calendarId: { type: "string", minLength: 1, maxLength: 4096 }, disclosure: { type: "string", enum: ["busy_only", "details"] },
  guardian: { type: "boolean", enum: [true] }, person: { type: "string", enum: ["Kimi"] }, confirmed: { type: "boolean", enum: [true] }
} };
function buildChildWorkflow(caller) {
  const w = buildWorkflow(caller), d = w.properties.definition;
  w.tags = { application: "FamilyCopilot", purpose: "local-child-calendar", environment: "development", contract: C.contract };
  d.triggers.manual.inputs.schema = requestSchema;
  let idRemainder = "body('Validate_request')['calendarId']";
  for (const c of "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_+/=-") idRemainder = `replace(${idRemainder},'${c}','')`;
  const a = d.actions = {
    // Parse JSON supports Secure Inputs only; this also hides its outputs.
    // Downstream actions explicitly protect their own inputs/outputs.
    Validate_request: { type: "ParseJson", runAfter: {}, inputs: { content: "@triggerBody()", schema: requestSchema }, runtimeConfiguration: secure("inputs") },
    Validate_bounds: { type: "ParseJson", runAfter: after("Validate_request"), inputs: {
      content: `@and(empty(${idRemainder}),lessOrEquals(length(base64(string(triggerBody()))),12000))`, schema: { type: "boolean", enum: [true] }
    }, runtimeConfiguration: secure("inputs") },
    Get_view: { type: "ApiConnection", runAfter: after("Validate_bounds"), inputs: {
      host: { connection: { name: "@parameters('$connections')['office365']['connectionId']" } }, method: "post", path: "/codeless/httprequest",
      headers: { Method: "GET", ContentType: "application/json", CustomHeader1: 'Prefer: outlook.timezone="Taipei Standard Time"',
        Uri: `@concat('https://graph.microsoft.com/v1.0/me/calendars/',uriComponent(body('Validate_request')['calendarId']),'/calendarView?startDateTime=2026-10-08T16%3A00%3A00Z&endDateTime=2026-10-15T16%3A00%3A00Z&$top=100&$select=subject,start,end,isAllDay,isCancelled,sensitivity,type,showAs')` },
      retryPolicy: { type: "none" }
    }, limit: { timeout: "PT1M" }, runtimeConfiguration: secure("inputs", "outputs") },
    Validate_size: { type: "ParseJson", runAfter: after("Get_view"), inputs: {
      content: "@lessOrEquals(length(base64(string(body('Get_view')))),262144)", schema: { type: "boolean", enum: [true] }
    }, runtimeConfiguration: secure("inputs") },
    Validate_view: { type: "ParseJson", runAfter: after("Validate_size"), inputs: { content: "@body('Get_view')", schema: {
      type: "object", required: ["value"], properties: { value: { type: "array", maxItems: 100, items: { type: "object", properties: {
        subject: { type: "string", maxLength: 4096 },
        start: { type: "object", required: ["dateTime", "timeZone"], properties: { dateTime: { type: "string", maxLength: 64 }, timeZone: { type: "string", maxLength: 100 } } },
        end: { type: "object", required: ["dateTime", "timeZone"], properties: { dateTime: { type: "string", maxLength: 64 }, timeZone: { type: "string", maxLength: 100 } } }
      } } } }
    } }, runtimeConfiguration: secure("inputs") },
    Redact: { type: "Select", runAfter: after("Validate_view"), inputs: { from: "@body('Validate_view')['value']", select: {
      title: "@if(and(equals(body('Validate_request')['disclosure'],'details'),equals(item()?['sensitivity'],'normal')),take(string(item()?['subject']),200),'Busy')",
      redacted: "@not(and(equals(body('Validate_request')['disclosure'],'details'),equals(item()?['sensitivity'],'normal')))",
      start: "@concat(convertTimeZone(item()?['start']?['dateTime'],item()?['start']?['timeZone'],'Taipei Standard Time','yyyy-MM-ddTHH:mm:ss'),'+08:00')",
      end: "@concat(convertTimeZone(item()?['end']?['dateTime'],item()?['end']?['timeZone'],'Taipei Standard Time','yyyy-MM-ddTHH:mm:ss'),'+08:00')",
      allDay: "@if(contains(createArray(true,false),item()?['isAllDay']),item()['isAllDay'],null)",
      status: "@if(equals(item()?['isCancelled'],true),'cancelled',if(equals(item()?['isCancelled'],false),'scheduled','unknown'))",
      kind: "@if(contains(createArray('singleInstance','occurrence','exception'),item()?['type']),item()['type'],'unknown')"
    } }, runtimeConfiguration: secure("inputs", "outputs") },
    Result: response({ contract: C.contract, window: C.window, checkedAt: "@utcNow()",
      partial: "@or(greaterOrEquals(length(body('Validate_view')['value']),100),not(empty(body('Validate_view')?['@odata.nextLink'])))", events: "@body('Redact')" }, after("Redact"))
  };
  for (const name of ["Validate_request", "Validate_bounds", "Get_view", "Validate_size", "Validate_view", "Redact"]) {
    a[`Failed_${name}`] = response({ status: name === "Get_view" ? "unavailable" : "invalid_provider_response" }, { [name]: ["Failed", "TimedOut"] }, 502);
  }
  return w;
}
module.exports = { workflowId, workflowName, buildChildWorkflow, requestSchema };