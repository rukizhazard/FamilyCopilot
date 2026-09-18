"use strict";

// No tokens, callback URLs, mailbox content, or unfiltered Azure responses are logged.
// This bootstrap tool can only create new, disabled infrastructure, never send mail.
const { execFileSync } = require("node:child_process");
const { resolve } = require("node:path");
const template = resolve(__dirname, "../infra/invitation-email.logicapp.json");
const workflowName = "familycopilot-invitations-dev";
const connectionName = "familycopilot-office365-dev";

function configuration(env) {
  const subscription = env.AZURE_SUBSCRIPTION_ID;
  const group = env.AZURE_RESOURCE_GROUP;
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(subscription || "")) {
    throw new Error("Set AZURE_SUBSCRIPTION_ID to the explicitly approved subscription UUID.");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9_.()-]{0,89}$/.test(group || "") || group.endsWith(".")) {
    throw new Error("Set AZURE_RESOURCE_GROUP to the existing, approved resource group.");
  }
  return { subscription, group };
}

function azure(args) {
  try {
    const output = execFileSync("az", [...args, "--only-show-errors", "--output", "json"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 180000,
      env: { ...process.env, AZURE_EXTENSION_USE_DYNAMIC_INSTALL: "no" }
    });
    return output.trim() ? JSON.parse(output) : null;
  } catch {
    // Azure errors can include evaluated secure inputs. Inspect details in the portal.
    throw new Error(`Azure ${args.slice(0, 3).join(" ")} failed. Check sign-in, permissions, policy, and deployment errors in the Azure portal. No automatic retry was attempted.`);
  }
}

function run(mode, config, az = azure, log = console.log) {
  if (!["check", "validate", "deploy", "resume", "status"].includes(mode)) throw new Error("Choose check, validate, deploy, resume, or status.");
  const scope = ["--subscription", config.subscription, "--resource-group", config.group];
  const resourceBase = `/subscriptions/${config.subscription}/resourceGroups/${config.group}/providers`;
  const group = az(["group", "show", "--subscription", config.subscription, "--name", config.group,
    "--query", "{location:location}"]);
  if (!group?.location) throw new Error("Resource group location is unavailable.");
  const resources = az(["resource", "list", ...scope,
    "--query", `[?name=='${workflowName}' || name=='${connectionName}'].{name:name,type:type}`]);
  if (!Array.isArray(resources)) throw new Error("Cannot verify resource-name collisions.");
  if (mode === "status") {
    log(JSON.stringify({ resources }, null, 2));
    if (resources.some(r => r.type === "Microsoft.Logic/workflows" && r.name === workflowName)) {
      log(JSON.stringify(az(["rest", "--method", "get", "--url",
        `https://management.azure.com${resourceBase}/Microsoft.Logic/workflows/${workflowName}?api-version=2019-05-01`,
        "--query", "{state:properties.state,sas:properties.accessControl.triggers.sasAuthenticationPolicy.state,policyCount:length(properties.accessControl.triggers.openAuthenticationPolicies.policies),deliveryEnabled:properties.parameters.deliveryEnabled.value}"]), null, 2));
    }
    if (resources.some(r => r.type === "Microsoft.Web/connections" && r.name === connectionName)) {
      log(JSON.stringify(az(["resource", "show", ...scope, "--resource-type", "Microsoft.Web/connections",
        "--name", connectionName, "--api-version", "2016-06-01", "--query", "{statuses:properties.statuses[].status}"]), null, 2));
    }
    return;
  }
  if (mode === "resume") {
    if (resources.length !== 1 || resources[0].name !== connectionName || resources[0].type !== "Microsoft.Web/connections") {
      throw new Error("Resume requires only the bootstrap connection to exist and the workflow to be absent.");
    }
    const existing = az(["resource", "show", ...scope, "--resource-type", "Microsoft.Web/connections", "--name", connectionName,
      "--api-version", "2016-06-01", "--query", "{tags:tags,location:location,api:properties.api.id}"]);
    const expectedApi = `/subscriptions/${config.subscription}/providers/Microsoft.Web/locations/${group.location}/managedApis/office365`;
    if (existing?.tags?.application !== "FamilyCopilot" || existing?.tags?.purpose !== "invitation-email" ||
        existing?.tags?.environment !== "development" || existing?.location !== group.location || existing?.api !== expectedApi) {
      throw new Error("Existing connection does not match the approved bootstrap. No changes made.");
    }
  } else if (resources.length) throw new Error("A target name already exists. Refusing to overwrite or reauthorize any existing resource; use status and review an explicit update separately.");
  const caller = az(["ad", "signed-in-user", "show", "--query", "id"]);
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(caller || "")) {
    throw new Error("A signed-in adult operator is required for the restricted bootstrap policy.");
  }
  log(JSON.stringify({ mode, subscription: config.subscription, resourceGroup: config.group,
    location: group.location, workflowName, connectionName, state: "Disabled", deliveryEnabled: false }, null, 2));
  const deployment = ["deployment", "group"];
  const options = [...scope, "--name", "familycopilot-invitation-bootstrap", "--mode", "Incremental",
    "--template-file", template, "--parameters", `callerObjectId=${caller}`,
    ...(mode === "resume" ? ["createConnection=false"] : [])];
  if (mode === "check") {
    log("Preflight complete. No resources changed; mailbox authorization and application onboarding are not configured.");
    return;
  }
  const validation = az([...deployment, "validate", ...options, "--query", "{error:error.code,state:properties.provisioningState}"]);
  if (validation?.error) throw new Error("Azure template validation failed; deployment was not attempted.");
  log("Azure template validation completed.");
  if (mode === "validate") return;
  const result = az([...deployment, "create", ...options, "--query", "{state:properties.provisioningState}"]);
  if (result?.state !== "Succeeded") throw new Error("Deployment not confirmed successful. Check status before any retry; partial resources may exist.");
  log("Disabled email infrastructure created. No mail sent. Authorize the new Outlook connection interactively in the portal.");
}

if (require.main === module) {
  try {
    const mode = process.argv[2];
    if (!mode || mode === "--help") {
      console.log("Usage: node scripts/invitation-infra.js check|validate|deploy|resume|status\nRequires AZURE_SUBSCRIPTION_ID and AZURE_RESOURCE_GROUP.\nDeploy creates only a new disabled workflow and an unauthenticated Outlook connection. Resume creates only the missing workflow after verifying the existing bootstrap connection. Never enables, invokes, sends email, creates a resource group, or modifies existing resources.");
    } else run(mode, configuration(process.env));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { configuration, run };