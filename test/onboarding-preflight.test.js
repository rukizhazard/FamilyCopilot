"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { scopedConfiguration, credentialEvidence, safeErrorCode, readAzure, run } = require("../scripts/onboarding-preflight.js");
const config = { subscription: "609bbde3-d152-4d7d-a12b-005e38ac4f27", group: "vdi-prebuilt-dte" };
const now = Date.parse("2026-09-15T00:00:00Z");
const rule = (restrictionType, extra = {}) => ({ restrictionType, state: "enabled",
  restrictForAppsCreatedAfterDateTime: "2000-01-01T00:00:00Z", excludeActors: null, ...extra });
const policy = () => ({ isEnabled: true, applicationRestrictions: {
  passwordCredentials: [rule("passwordAddition"), rule("customPasswordAddition"), rule("symmetricKeyAddition")],
  keyCredentials: [rule("asymmetricKeyLifetime", { maxLifetime: "PT0S" })]
} });
function fake({ tenant = "72f988bf-86f1-41af-91ab-2d7cd011db47", allowed = true, management = policy(), failAt } = {}) {
  const calls = [];
  return { calls, read(args) {
    calls.push(args);
    if (calls.length === failAt) throw new Error("Synthetic denial");
    return calls.length === 1 ? { tenantId: tenant, state: "Enabled" }
      : calls.length === 2 ? { allowedToCreateApps: allowed } : management;
  } };
}

test("preflight requires exact approved scope, not just valid-looking Azure identifiers", () => {
  assert.deepEqual(scopedConfiguration({ AZURE_SUBSCRIPTION_ID: config.subscription, AZURE_RESOURCE_GROUP: config.group }), config);
  for (const env of [{}, { AZURE_SUBSCRIPTION_ID: config.subscription, AZURE_RESOURCE_GROUP: "other" },
    { AZURE_SUBSCRIPTION_ID: "11111111-1111-1111-1111-111111111111", AZURE_RESOURCE_GROUP: config.group }]) {
    assert.throws(() => scopedConfiguration(env));
  }
  assert.throws(() => run({ ...config, group: "other" }, () => assert.fail("must not call Azure"), now));
});

test("secret/certificate blocker is evidence, never a claim all identity paths are impossible", () => {
  const f = fake(), result = run(config, f.read, now);
  assert.equal(result.status, "secret_certificate_path_blocked");
  assert.equal(result.allowedToCreateApps, true);
  for (const field of ["passwordAdditionRestricted", "customPasswordAdditionRestricted", "symmetricKeyAdditionRestricted", "zeroCertificateLifetime"]) {
    assert.equal(result.evidence[field], true);
  }
  for (const field of ["deploymentReady", "cloudChanges", "accountTypesVerified", "credentialPathVerified"]) assert.equal(result[field], false);
});

test("preflight only reads fixed endpoints, pins subscription, and never requests credentials or app writes", () => {
  const f = fake(); run(config, f.read, now);
  assert.equal(f.calls.length, 3);
  assert.deepEqual(f.calls.map(c => c.slice(0, 2)), [["account", "show"], ["rest", "--method"], ["rest", "--method"]]);
  for (const c of f.calls) assert.equal(c[c.indexOf("--subscription") + 1], config.subscription);
  for (const c of f.calls.slice(1)) assert.equal(c[c.indexOf("--method") + 1], "get");
  assert.doesNotMatch(JSON.stringify(f.calls), /\/applications|\/me\/|listKeys|listCallbackUrl|addPassword|sendMail|deployment|--debug/i);
});

test("wrong tenant, missing registration evidence, and denials stop without retries", () => {
  const wrong = fake({ tenant: "11111111-1111-1111-1111-111111111111" });
  assert.throws(() => run(config, wrong.read, now), /tenant was not verified/);
  assert.equal(wrong.calls.length, 1);
  for (const allowed of [false, null, "true"]) {
    const f = fake({ allowed });
    assert.equal(run(config, f.read, now).status, "registration_permission_review_required");
    assert.equal(f.calls.length, 2);
  }
  for (const failAt of [1, 2, 3]) {
    const f = fake({ failAt });
    assert.throws(() => run(config, f.read, now));
    assert.equal(f.calls.length, failAt);
  }
});

test("policy evidence does not assume exemptions or unknown/malformed fields are approval", () => {
  for (const management of [null, {}, { isEnabled: true }, { isEnabled: false },
    { isEnabled: true, applicationRestrictions: { passwordCredentials: [], keyCredentials: [] } }]) {
    const f = fake({ management }), result = run(config, f.read, now);
    assert.equal(result.status, "administrator_review_required");
    assert.equal(result.deploymentReady, false);
  }
  const exempt = policy(); exempt.applicationRestrictions.passwordCredentials[0].excludeActors = { customSecurityAttributes: [] };
  assert.equal(run(config, fake({ management: exempt }).read, now).status, "administrator_review_required");
  assert.equal(credentialEvidence(policy(), NaN).policyReadable, false);
  const unknown = policy(); unknown.applicationRestrictions.keyCredentials = [rule("unknownFutureValue")];
  assert.equal(credentialEvidence(unknown, now).unknownRestriction, true);
});

test("disabled/future restrictions are not applied to a new app today; invalid dates remain unknown", () => {
  for (const extra of [{ state: "disabled" }, { restrictForAppsCreatedAfterDateTime: "2030-01-01T00:00:00Z" }]) {
    const p = policy(); p.applicationRestrictions.passwordCredentials = [rule("passwordAddition", extra)];
    assert.equal(credentialEvidence(p, now).passwordAdditionRestricted, false);
  }
  const p = policy(); p.applicationRestrictions.passwordCredentials = [rule("passwordAddition", { restrictForAppsCreatedAfterDateTime: "bad" })];
  assert.equal(credentialEvidence(p, now).unknownRestriction, true);
});

test("Azure execution captures output privately, bounds duration, disables extension installs and redacts failures", () => {
  let count = 0;
  assert.deepEqual(readAzure(["account", "show"], (command, args, options) => {
    count++; assert.equal(command, "az");
    assert.deepEqual(args.slice(-3), ["--only-show-errors", "--output", "json"]);
    assert.deepEqual(options.stdio, ["ignore", "pipe", "pipe"]);
    assert.equal(options.timeout, 90000);
    assert.equal(options.env.AZURE_EXTENSION_USE_DYNAMIC_INSTALL, "no");
    return '{"state":"Enabled"}';
  }), { state: "Enabled" });
  assert.equal(count, 1);
  const marker = "SYNTHETIC_SENSITIVE_VALUE";
  for (const stderr of [`Forbidden ${marker}`, `{"code":"Authorization_RequestDenied","message":"${marker}"}`, marker]) {
    let attempts = 0;
    assert.throws(() => readAzure(["rest"], () => { attempts++; throw { stderr }; }), error => {
      assert.ok(!error.message.includes(marker)); return true;
    });
    assert.equal(attempts, 1);
  }
  assert.equal(safeErrorCode({ stderr: marker }), "AzureReadFailed");
  assert.throws(() => readAzure([], () => marker), /AzureReadFailed/);
});

test("policy output excludes untrusted policy content, identifiers and credentials", () => {
  const p = policy(); p.extra = "SYNTHETIC_SENSITIVE_VALUE";
  p.applicationRestrictions.passwordCredentials.push(rule("SYNTHETIC_SENSITIVE_VALUE"));
  const result = JSON.stringify(run(config, fake({ management: p }).read, now));
  assert.doesNotMatch(result, /SYNTHETIC_SENSITIVE_VALUE|72f988bf|restrictForAppsCreatedAfterDateTime/);
  assert.equal(JSON.parse(result).evidence.unknownRestriction, true);
});