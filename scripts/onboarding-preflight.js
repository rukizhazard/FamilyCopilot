"use strict";

// Read-only evidence, never a deployment/consent authorization or a policy bypass.
const { execFileSync } = require("node:child_process");
const { configuration } = require("./invitation-infra.js");
const approvedSubscription = "609bbde3-d152-4d7d-a12b-005e38ac4f27";
const approvedGroup = "vdi-prebuilt-dte";
const approvedTenant = "72f988bf-86f1-41af-91ab-2d7cd011db47";

function scopedConfiguration(env) {
  const config = configuration(env);
  if (config.subscription !== approvedSubscription || config.group !== approvedGroup) {
    throw new Error("Preflight is restricted to the approved FamilyCopilot subscription and resource group.");
  }
  return config;
}

function safeErrorCode(error) {
  // Never print raw Azure errors: even error bodies can contain sensitive values.
  const text = String(error?.stderr || "");
  return ["Authorization_RequestDenied", "AuthorizationFailed", "InvalidAuthenticationToken", "Forbidden"]
    .find(code => new RegExp(`\\b${code}\\b`).test(text)) || "AzureReadFailed";
}

function readAzure(args, execute = execFileSync) {
  try {
    const text = execute("az", [...args, "--only-show-errors", "--output", "json"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 90000,
      env: { ...process.env, AZURE_EXTENSION_USE_DYNAMIC_INSTALL: "no" }
    });
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Read-only preflight stopped: ${safeErrorCode(error)}. No retry or cloud mutation attempted.`);
  }
}

function credentialEvidence(policy, now) {
  const evidence = { policyEnabled: policy?.isEnabled === true, policyReadable: false,
    passwordAdditionRestricted: false, customPasswordAdditionRestricted: false,
    symmetricKeyAdditionRestricted: false, zeroCertificateLifetime: false,
    actorExemptionNeedsReview: false, unknownRestriction: false };
  if (typeof policy?.isEnabled !== "boolean" || !Number.isFinite(now)) return evidence;
  if (!policy.isEnabled) return { ...evidence, policyReadable: true };
  const restrictions = policy.applicationRestrictions;
  if (!Array.isArray(restrictions?.passwordCredentials) || !Array.isArray(restrictions?.keyCredentials)) return evidence;
  evidence.policyReadable = true;
  const names = { passwordAddition: "passwordAdditionRestricted", customPasswordAddition: "customPasswordAdditionRestricted",
    symmetricKeyAddition: "symmetricKeyAdditionRestricted" };
  for (const rule of [...restrictions.passwordCredentials, ...restrictions.keyCredentials]) {
    if (rule?.state === "disabled") continue;
    const date = Date.parse(rule?.restrictForAppsCreatedAfterDateTime);
    if (rule?.state !== "enabled" || !Number.isFinite(date)) { evidence.unknownRestriction = true; continue; }
    if (date > now) continue;
    if (rule.excludeActors != null) evidence.actorExemptionNeedsReview = true;
    if (Object.hasOwn(names, rule.restrictionType)) evidence[names[rule.restrictionType]] = true;
    else if (rule.restrictionType === "asymmetricKeyLifetime" && ["PT0S", "P0D"].includes(rule.maxLifetime)) {
      evidence.zeroCertificateLifetime = true;
    } else evidence.unknownRestriction = true;
  }
  return evidence;
}

function run(config, read = readAzure, now = Date.now()) {
  // Validate even when called programmatically; no arbitrary tenant or endpoint inputs.
  scopedConfiguration({ AZURE_SUBSCRIPTION_ID: config?.subscription, AZURE_RESOURCE_GROUP: config?.group });
  const scope = ["--subscription", config.subscription];
  const account = read(["account", "show", ...scope, "--query", "{tenantId:tenantId,state:state}"]);
  if (account?.tenantId !== approvedTenant || account?.state !== "Enabled") {
    throw new Error("Expected enabled subscription tenant was not verified. No further checks attempted.");
  }
  const registration = read(["rest", "--method", "get", ...scope, "--url",
    "https://graph.microsoft.com/v1.0/policies/authorizationPolicy?$select=defaultUserRolePermissions",
    "--query", "{allowedToCreateApps:defaultUserRolePermissions.allowedToCreateApps}"]);
  const base = { deploymentReady: false, cloudChanges: false, accountTypesVerified: false, credentialPathVerified: false };
  if (registration?.allowedToCreateApps !== true) {
    // A directory role might permit creation, but this tool cannot establish that.
    return { ...base, status: "registration_permission_review_required" };
  }
  const policy = read(["rest", "--method", "get", ...scope, "--url",
    "https://graph.microsoft.com/v1.0/policies/defaultAppManagementPolicy",
    "--query", "{isEnabled:isEnabled,applicationRestrictions:applicationRestrictions}"]);
  const evidence = credentialEvidence(policy, now);
  const blocked = evidence.passwordAdditionRestricted && evidence.zeroCertificateLifetime && !evidence.actorExemptionNeedsReview;
  return { ...base, status: blocked ? "secret_certificate_path_blocked" : "administrator_review_required",
    allowedToCreateApps: true, evidence };
}

if (require.main === module) {
  try {
    if (process.argv[2] === "--help") {
      console.log("Usage: node scripts/onboarding-preflight.js check\nRequires explicit AZURE_SUBSCRIPTION_ID and AZURE_RESOURCE_GROUP for the approved scope. Reads tenant registration/credential policy only; never creates resources, credentials, consent, or mail. Exit 2 means review is required; this tool never authorizes deployment.");
    } else {
      if (process.argv[2] !== "check" || process.argv.length !== 3) throw new Error("Choose check or --help only.");
      console.log(JSON.stringify(run(scopedConfiguration(process.env)), null, 2));
      process.exitCode = 2;
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { scopedConfiguration, credentialEvidence, safeErrorCode, readAzure, run };