"use strict";

// Owner-only experiment. No template resource can create or alter a connection.
const scope = Object.freeze({
  subscription: "609bbde3-d152-4d7d-a12b-005e38ac4f27",
  group: "vdi-prebuilt-dte", location: "eastus",
  tenant: "72f988bf-86f1-41af-91ab-2d7cd011db47",
  workflow: "familycopilot-calendar-list-dev",
  connection: "familycopilot-office365-dev",
  invitation: "familycopilot-invitations-dev",
  application: "04b07795-8ddb-461a-bbee-02f9e1bf7b46",
  audience: "https://management.azure.com/"
});
const base = `/subscriptions/${scope.subscription}/resourceGroups/${scope.group}/providers`;
const workflowId = `${base}/Microsoft.Logic/workflows/${scope.workflow}`;
const connectionId = `${base}/Microsoft.Web/connections/${scope.connection}`;
const invitationId = `${base}/Microsoft.Logic/workflows/${scope.invitation}`;
const apiId = `/subscriptions/${scope.subscription}/providers/Microsoft.Web/locations/eastus/managedApis/office365`;
// Verified against the live exported managed API Swagger, not the Graph URL guessed
// from the operation name. ApiConnection supplies the /{connectionId} prefix.
const operationPath = "/codeless/v1.0/me/calendars";
const pageSize = 100;
const secured = properties => ({ secureData: { properties } });
const response = (statusCode, body, runAfter) => ({
  type: "Response", kind: "Http", runAfter,
  inputs: { statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body },
  runtimeConfiguration: secured(["inputs"])
});

function buildWorkflow(caller) {
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(caller || "")) throw new Error("InvalidOperator");
  return {
    location: scope.location,
    tags: { application: "FamilyCopilot", purpose: "owner-calendar-list", environment: "development", contract: "list-only-v1" },
    properties: {
      state: "Disabled",
      accessControl: {
        contents: { allowedCallerIpAddresses: [{ addressRange: "0.0.0.0-0.0.0.0" }] },
        triggers: {
          sasAuthenticationPolicy: { state: "Disabled" },
          openAuthenticationPolicies: { policies: { OwnerOnly: { type: "AAD", claims: [
            { name: "iss", value: `https://sts.windows.net/${scope.tenant}/` },
            { name: "aud", value: scope.audience },
            { name: "oid", value: caller },
            { name: "appid", value: scope.application }
          ] } } }
        }
      },
      definition: {
        $schema: "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
        contentVersion: "1.0.0.0",
        parameters: { $connections: { type: "Object", defaultValue: {} } },
        triggers: { manual: {
          type: "Request", kind: "Http", operationOptions: "EnableSchemaValidation",
          inputs: { method: "POST", schema: { type: "object", properties: {}, additionalProperties: false } },
          runtimeConfiguration: secured(["outputs"])
        } },
        actions: {
          List_calendars: {
            type: "ApiConnection", runAfter: {},
            inputs: {
              host: { connection: { name: "@parameters('$connections')['office365']['connectionId']" } },
              method: "get", path: operationPath, queries: { top: pageSize, skip: 0 },
              retryPolicy: { type: "none" }
            },
            limit: { timeout: "PT1M" },
            runtimeConfiguration: secured(["inputs", "outputs"])
          },
          Validate_list: {
            type: "ParseJson", runAfter: { List_calendars: ["Succeeded"] },
            inputs: {
              content: "@body('List_calendars')",
              schema: { type: "object", required: ["value"], properties: {
                value: { type: "array", maxItems: pageSize, items: {
                  type: "object", required: ["id", "name"], properties: {
                    id: { type: "string", minLength: 1, maxLength: 4096 },
                    name: { type: "string", maxLength: 1024 }
                  }
                } }
              } }
            },
            runtimeConfiguration: secured(["inputs"])
          },
          Summary: response(200, {
            status: "@if(empty(body('Validate_list')['value']), 'empty', 'listed')",
            count: "@length(body('Validate_list')['value'])",
            completeness: "unknown", ownership: "unverified", eventsRead: 0
          }, { Validate_list: ["Succeeded"] }),
          Invalid_list: response(502, { status: "invalid_provider_response", eventsRead: 0 }, { Validate_list: ["Failed", "TimedOut"] }),
          Unavailable: response(502, {
            status: "provider_unavailable", eventsRead: 0,
            providerHttpStatus: "@if(contains(createArray(401,403,404,429,500,502,503,504), outputs('List_calendars')?['statusCode']), outputs('List_calendars')['statusCode'], 0)"
          }, { List_calendars: ["Failed", "TimedOut"] })
        },
        outputs: {}
      },
      parameters: { $connections: { value: { office365: { id: apiId, connectionId, connectionName: scope.connection } } } }
    }
  };
}

// Keep v1 intact: it is the exact deployed prior contract for the one-way update.
function buildOwnerWorkflow(caller) {
  const workflow = buildWorkflow(caller);
  workflow.tags.contract = "local-owner-list-v2";
  const actions = workflow.properties.definition.actions;
  actions.Owner_labels = {
    type: "Select", runAfter: { Validate_list: ["Succeeded"] },
    inputs: { from: "@body('Validate_list')['value']", select: { id: "@item()['id']", name: "@item()['name']" } },
    runtimeConfiguration: secured(["inputs", "outputs"])
  };
  actions.Summary.runAfter = { Owner_labels: ["Succeeded"] };
  actions.Summary.inputs.body.calendars = "@body('Owner_labels')";
  actions.Invalid_projection = response(502, { status: "invalid_provider_response", eventsRead: 0 },
    { Owner_labels: ["Failed", "TimedOut"] });
  return workflow;
}

module.exports = { scope, workflowId, connectionId, invitationId, apiId, operationPath, pageSize, buildWorkflow, buildOwnerWorkflow };