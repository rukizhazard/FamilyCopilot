const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { configuration, run } = require("../scripts/invitation-infra.js");
const template = JSON.parse(readFileSync(require.resolve("../infra/invitation-email.logicapp.json"), "utf8"));
const workflow = template.resources.find(r => r.type === "Microsoft.Logic/workflows");
const connection = template.resources.find(r => r.type === "Microsoft.Web/connections");
const definition = workflow.properties.definition;
const gate = definition.actions.Delivery_gate;
const actions = gate.actions;
const config = { subscription: "11111111-1111-1111-1111-111111111111", group: "synthetic-group" };
const caller = "22222222-2222-2222-2222-222222222222";

function fakeAzure({ resources = [], validation = {}, deployment = { state: "Succeeded" }, failure, connectionMetadata } = {}) {
  const calls = [];
  const az = args => {
    calls.push(args);
    if (failure) throw new Error("Synthetic Azure failure");
    if (args[0] === "group") return { location: "eastus" };
    if (args[0] === "ad") return caller;
    if (args[0] === "resource" && args[1] === "list") return resources;
    if (args[0] === "rest") return { state: "Disabled", sas: "Disabled", deliveryEnabled: false };
    if (args[0] === "resource" && args[1] === "show") return connectionMetadata || { statuses: ["Error"] };
    if (args[2] === "validate") return validation;
    if (args[2] === "create") return deployment;
    throw new Error("Unexpected test command");
  };
  return { az, calls };
}

test("email infrastructure is isolated, disabled, and has no credentials or database resources", () => {
  assert.deepEqual(template.resources.map(r => r.type), ["Microsoft.Web/connections", "Microsoft.Logic/workflows"]);
  assert.equal(workflow.properties.state, "Disabled");
  assert.equal(template.parameters.deliveryEnabled.defaultValue, false);
  assert.equal(template.parameters.approvedRecipient.defaultValue, "");
  assert.equal(template.parameters.approvedRecipient.type, "securestring");
  assert.equal(definition.parameters.approvedRecipient.type, "SecureString");
  assert.equal(connection.kind, "V1");
  assert.equal(connection.properties.parameterValues, undefined);
  assert.deepEqual(Object.keys(template.outputs).sort(), ["connectionId", "workflowId"]);
  assert.doesNotMatch(JSON.stringify(template), /listCallbackUrl|sig=|client_secret|Microsoft.DocumentDB|Recurrence/);
});

test("SAS is disabled and the bootstrap caller must match tenant, audience, object, and application", () => {
  const acl = workflow.properties.accessControl.triggers;
  assert.equal(acl.sasAuthenticationPolicy.state, "Disabled");
  assert.equal(Object.keys(acl.openAuthenticationPolicies.policies).length, 1);
  const policy = acl.openAuthenticationPolicies.policies.ApprovedCaller;
  assert.equal(policy.type, "AAD");
  assert.deepEqual(policy.claims.map(c => c.name), ["iss", "aud", "oid", "appid"]);
  for (const claim of policy.claims) assert.ok(claim.value && !claim.value.includes("*"));
  assert.match(policy.claims[0].value, /subscription\(\)\.tenantId/);
});

test("the POST contract forbids caller-provided recipients, URLs, arbitrary HTML, and additional fields", () => {
  const trigger = definition.triggers.manual;
  assert.equal(trigger.inputs.method, "POST");
  assert.equal(trigger.operationOptions, "EnableSchemaValidation");
  assert.equal(trigger.inputs.schema.additionalProperties, false);
  assert.deepEqual(trigger.inputs.schema.required, ["invitationToken"]);
  assert.deepEqual(Object.keys(trigger.inputs.schema.properties), ["invitationToken"]);
  // Azure Request schema validation rejects regex keywords, unlike Parse JSON.
  assert.doesNotMatch(JSON.stringify(trigger.inputs.schema), /"pattern(?:Properties)?"/);
  assert.deepEqual(trigger.inputs.schema.properties.invitationToken, { type: "string", minLength: 43, maxLength: 43 });
  const validation = actions.Validate_delivery;
  assert.equal(validation.type, "ParseJson");
  assert.equal(validation.inputs.content.invitationToken, "@triggerBody()?['invitationToken']");
  assert.equal(validation.inputs.schema.properties.invitationToken.pattern, "^[A-Za-z0-9_-]{43}$");
  assert.deepEqual(actions.Send_invitation_email.runAfter, { Validate_delivery: ["Succeeded"] });
  // Azure rejects Request concurrency control with synchronous Response actions.
  // Delivery stays disabled until the application supplies rate limits/send state.
  assert.equal(trigger.runtimeConfiguration.concurrency, undefined);
});

// These assert the shipped schema's patterns, not an emulation of Azure's runtime.
test("delivery schema patterns reject URL/HTML/header injection and malformed tokens", () => {
  const schema = actions.Validate_delivery.inputs.schema.properties;
  const accept = (key, value) => typeof value === schema[key].type && value.length <= schema[key].maxLength &&
    (!schema[key].minLength || value.length >= schema[key].minLength) && new RegExp(schema[key].pattern).test(value);
  assert.equal(accept("recipient", "adult.demo@example.test"), true);
  for (const value of ["a@example.test;b@example.test", "a@example.test\n", "a@example.test\r\nBcc: b@example.test", "Adult <a@example.test>", "a".repeat(255)]) {
    assert.equal(accept("recipient", value), false);
  }
  assert.equal(accept("origin", "https://family.example.test"), true);
  for (const value of ["http://family.example.test", "https://user@family.example.test", "https://example.test/evil", "https://example.test?redirect=evil", "https://example.test#evil", "https://example.test\n", 'https://example.test\" onclick=\"bad', "javascript:bad", "https://localhost"]) {
    assert.equal(accept("origin", value), false);
  }
  assert.equal(accept("invitationToken", "a".repeat(43)), true);
  for (const value of [null, [], "a".repeat(42), "a".repeat(44), "a".repeat(42) + "\n", "<".repeat(43), "a/".repeat(22)]) {
    assert.equal(accept("invitationToken", value), false);
  }
});

test("delivery is gated and only uses validated fixed mail fields with no automatic retry", () => {
  assert.match(gate.expression, /deliveryEnabled/);
  assert.match(gate.expression, /approvedRecipient/);
  assert.match(gate.expression, /https:\/\/example\.invalid/);
  const send = actions.Send_invitation_email;
  assert.equal(send.inputs.path, "/v2/Mail");
  assert.equal(send.inputs.method, "post");
  assert.deepEqual(send.inputs.retryPolicy, { type: "none" });
  assert.deepEqual(send.runAfter, { Validate_delivery: ["Succeeded"] });
  assert.deepEqual(Object.keys(send.inputs.body).sort(), ["Body", "Importance", "Subject", "To"]);
  assert.equal(send.inputs.body.To, "@body('Validate_delivery')['recipient']");
  assert.match(send.inputs.body.Body, /\/invite#token=/);
  assert.match(send.inputs.body.Body, /does not grant calendar access/);
  assert.match(send.inputs.body.Body, /Personal and work event details are not shared/);
});

test("sensitive steps protect run data and response states never echo provider content", () => {
  assert.deepEqual(definition.triggers.manual.runtimeConfiguration.secureData.properties, ["outputs"]);
  // ParseJson supports Secure Inputs only; Azure hides its outputs implicitly.
  // Its downstream consumer must explicitly protect both inputs and outputs.
  assert.deepEqual(actions.Validate_delivery.runtimeConfiguration.secureData.properties, ["inputs"]);
  assert.deepEqual(actions.Send_invitation_email.runtimeConfiguration.secureData.properties, ["inputs", "outputs"]);
  assert.deepEqual(actions.Accepted.runAfter, { Send_invitation_email: ["Succeeded"] });
  assert.equal(actions.Accepted.inputs.body.status, "provider_accepted");
  assert.equal(actions.Accepted.inputs.body.calendarAccessGranted, false);
  assert.equal(actions.Delivery_unknown.inputs.statusCode, 502);
  assert.equal(actions.Delivery_unknown.inputs.body.retryAutomatically, false);
  assert.deepEqual(actions.Delivery_unknown.runAfter, { Send_invitation_email: ["Failed", "TimedOut"] });
  assert.equal(actions.Invalid_delivery.inputs.statusCode, 400);
  assert.equal(gate.else.actions.Not_ready.inputs.statusCode, 503);
  for (const action of [...Object.values(actions), ...Object.values(gate.else.actions)]) {
    if (action.type !== "Response") continue;
    assert.equal(action.inputs.headers["Cache-Control"], "no-store");
    assert.doesNotMatch(JSON.stringify(action.inputs.body), /@|invitationToken|recipient/);
  }
});

test("bootstrap requires explicit subscription and resource group and rejects flag injection", () => {
  assert.deepEqual(configuration({ AZURE_SUBSCRIPTION_ID: config.subscription, AZURE_RESOURCE_GROUP: config.group }), config);
  for (const env of [{}, { AZURE_SUBSCRIPTION_ID: "--debug", AZURE_RESOURCE_GROUP: "group" },
    { AZURE_SUBSCRIPTION_ID: config.subscription, AZURE_RESOURCE_GROUP: "--debug" },
    { AZURE_SUBSCRIPTION_ID: config.subscription, AZURE_RESOURCE_GROUP: "group;bad" }]) assert.throws(() => configuration(env));
});

test("check and validate never deploy, and every scoped command uses the explicit subscription", () => {
  for (const mode of ["check", "validate"]) {
    const { az, calls } = fakeAzure();
    run(mode, config, az, () => {});
    assert.equal(calls.some(c => c.includes("create")), false);
    assert.equal(calls.filter(c => c.includes("validate")).length, mode === "validate" ? 1 : 0);
    for (const call of calls.filter(c => c[0] !== "ad")) assert.equal(call[call.indexOf("--subscription") + 1], config.subscription);
  }
});

test("deployment is incremental, validates first, and supplies no email or enabling parameters", () => {
  const { az, calls } = fakeAzure();
  run("deploy", config, az, () => {});
  const deployments = calls.filter(c => c[0] === "deployment");
  assert.deepEqual(deployments.map(c => c[2]), ["validate", "create"]);
  for (const call of deployments) {
    assert.equal(call[call.indexOf("--mode") + 1], "Incremental");
    assert.deepEqual(call.slice(call.indexOf("--parameters") + 1, call.indexOf("--query")), [`callerObjectId=${caller}`]);
  }
  assert.doesNotMatch(JSON.stringify(calls), /enable|invoke|listCallbackUrl|sendMail|role assignment/);
});

test("name collisions, failed validation, Azure failures, and incomplete deployments stop safely", () => {
  for (const resources of [[{ name: "familycopilot-invitations-dev", type: "Microsoft.Logic/workflows" }],
    [{ name: "familycopilot-office365-dev", type: "Microsoft.Web/connections" }]]) {
    const { az, calls } = fakeAzure({ resources });
    assert.throws(() => run("deploy", config, az, () => {}), /Refusing to overwrite/);
    assert.equal(calls.some(c => c[0] === "deployment"), false);
  }
  for (const options of [{ validation: { error: "InvalidTemplate" } }, { failure: true }]) {
    const { az, calls } = fakeAzure(options);
    assert.throws(() => run("deploy", config, az, () => {}));
    assert.equal(calls.some(c => c.includes("create")), false);
  }
  const { az, calls } = fakeAzure({ deployment: { state: "Failed" } });
  assert.throws(() => run("deploy", config, az, () => {}), /partial resources may exist/);
  assert.equal(calls.filter(c => c.includes("create")).length, 1);
});

test("status is read-only and prints only selected safe fields", () => {
  const { az, calls } = fakeAzure({ resources: [
    { name: "familycopilot-invitations-dev", type: "Microsoft.Logic/workflows" },
    { name: "familycopilot-office365-dev", type: "Microsoft.Web/connections" }
  ] });
  const logs = [];
  run("status", config, az, line => logs.push(line));
  assert.equal(calls.some(c => c[0] === "deployment" || c[0] === "ad"), false);
  assert.equal(calls.filter(c => c[0] === "rest").every(c => c[c.indexOf("--method") + 1] === "get"), true);
  assert.doesNotMatch(logs.join(""), /sig=|invitationToken|approvedRecipient|access_token/);
});

test("partial deployment resume creates only a missing workflow without rewriting its connection", () => {
  const resources = [{ name: "familycopilot-office365-dev", type: "Microsoft.Web/connections" }];
  const connectionMetadata = { location: "eastus", tags: { application: "FamilyCopilot", purpose: "invitation-email", environment: "development" },
    api: `/subscriptions/${config.subscription}/providers/Microsoft.Web/locations/eastus/managedApis/office365` };
  const { az, calls } = fakeAzure({ resources, connectionMetadata });
  run("resume", config, az, () => {});
  assert.equal(template.parameters.createConnection.defaultValue, true);
  assert.equal(connection.condition, "[parameters('createConnection')]");
  for (const call of calls.filter(c => c[0] === "deployment")) assert.ok(call.includes("createConnection=false"));
  for (const options of [
    { resources: [] },
    { resources: [...resources, { name: "familycopilot-invitations-dev", type: "Microsoft.Logic/workflows" }] },
    { resources, connectionMetadata: { ...connectionMetadata, tags: {} } },
    { resources, connectionMetadata: { ...connectionMetadata, api: "/unrelated/connection" } },
    { resources, connectionMetadata: { ...connectionMetadata, location: "westus" } }
  ]) {
    const fake = fakeAzure(options);
    assert.throws(() => run("resume", config, fake.az, () => {}));
    assert.equal(fake.calls.some(c => c[0] === "deployment"), false);
  }
});