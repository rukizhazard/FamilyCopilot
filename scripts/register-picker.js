"use strict";
// Operator-only one-shot registration. Never imported by the browser.
const { execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { scopedConfiguration } = require("./onboarding-preflight.js");
const { TENANT, REDIRECT } = require("../picker/core.js");
const GRAPH = "https://graph.microsoft.com/v1.0/applications";
const RESOURCE = "00000003-0000-0000-c000-000000000000";
const PERMISSION = "662d75ba-a364-42ad-adee-f5f880ea4878";
const guid = value => typeof value === "string" && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
const projection = "{id:id,appId:appId,displayName:displayName,signInAudience:signInAudience,spa:spa,web:web,publicClient:publicClient,isFallbackPublicClient:isFallbackPublicClient,requiredResourceAccess:requiredResourceAccess,passwordCount:length(passwordCredentials),keyCount:length(keyCredentials)}";
function safeCode(error) {
  return ["Authorization_RequestDenied","AuthorizationFailed","InvalidAuthenticationToken","Forbidden","Request_BadRequest","PolicyViolation","Authentication_Unauthorized"]
    .find(code => new RegExp(`\\b${code}\\b`).test(String(error?.stderr || ""))) || "AzureOperationFailed";
}
function azure(args, execute = execFileSync) {
  try {
    return JSON.parse(execute("az", [...args,"--only-show-errors","--output","json"], {
      encoding:"utf8", stdio:["ignore","pipe","pipe"], timeout:90000, maxBuffer:1024*1024,
      env:{ ...process.env, AZURE_EXTENSION_USE_DYNAMIC_INSTALL:"no" }
    }));
  } catch(error) { const safe = new Error("Scoped registration stopped"); safe.code=safeCode(error); throw safe; }
}
function payload(displayName) {
  if (!/^FamilyCopilot-own-picker-[0-9a-f-]{36}$/.test(displayName)) throw new Error("Invalid generated name");
  return { displayName, signInAudience:"AzureADMyOrg", isFallbackPublicClient:false,
    spa:{ redirectUris:[REDIRECT] }, publicClient:{ redirectUris:[] },
    web:{ redirectUris:[], implicitGrantSettings:{ enableIdTokenIssuance:false, enableAccessTokenIssuance:false } },
    requiredResourceAccess:[{ resourceAppId:RESOURCE, resourceAccess:[{ id:PERMISSION, type:"Scope" }] }],
    passwordCredentials:[], keyCredentials:[] };
}
function verify(app, expected) {
  return guid(app?.id) && guid(app?.appId) && app.displayName === expected.displayName && app.signInAudience === "AzureADMyOrg" &&
    app.isFallbackPublicClient === false && app.passwordCount === 0 && app.keyCount === 0 &&
    JSON.stringify(app.spa?.redirectUris) === JSON.stringify([REDIRECT]) &&
    Array.isArray(app.web?.redirectUris) && app.web.redirectUris.length === 0 &&
    Array.isArray(app.publicClient?.redirectUris) && app.publicClient.redirectUris.length === 0 &&
    app.web?.implicitGrantSettings?.enableIdTokenIssuance === false && app.web?.implicitGrantSettings?.enableAccessTokenIssuance === false &&
    app.requiredResourceAccess?.length === 1 && app.requiredResourceAccess[0].resourceAppId === RESOURCE &&
    app.requiredResourceAccess[0].resourceAccess?.length === 1 &&
    app.requiredResourceAccess[0].resourceAccess[0].id === PERMISSION && app.requiredResourceAccess[0].resourceAccess[0].type === "Scope";
}
function run(env, call = azure, nonce = randomUUID()) {
  let stage="scope", created=false, objectId=null;
  if (!guid(nonce)) return { status:"invalid_nonce", created:false };
  const displayName=`FamilyCopilot-own-picker-${nonce}`;
  try {
    const scope=scopedConfiguration(env), args=["--subscription",scope.subscription];
    const account=call(["account","show",...args,"--query","{tenantId:tenantId,state:state}"]);
    if (account?.tenantId !== TENANT || account?.state !== "Enabled") throw new Error("Scope mismatch");
    const group=call(["group","show","--name",scope.group,...args,"--query","{name:name}"]);
    if (group?.name !== scope.group) throw new Error("Scope mismatch");
    const body=payload(displayName);
    stage="create";
    const app=call(["rest","--method","post",...args,"--url",GRAPH,"--headers","Content-Type=application/json","--body",JSON.stringify(body),"--query",projection]);
    created=true;
    if (!guid(app?.id)) throw new Error("Missing object ID");
    objectId=app.id;
    stage="readback";
    const readback=call(["rest","--method","get",...args,"--url",`${GRAPH}/${objectId}`,"--query",projection]);
    if (!verify(readback,body) || readback.id !== objectId || readback.appId !== app.appId) throw new Error("Readback mismatch");
    return { status:"registered_verified", created:true, displayName, objectId,
      publicConfig:{ clientId:readback.appId, tenantId:TENANT, redirectUri:REDIRECT },
      signInAudience:"AzureADMyOrg", delegatedCalendarScope:"Calendars.ReadBasic", credentialsCreated:false,
      consentGranted:false, userSignInTested:false, calendarsAccessed:false, hostingCreated:false };
  } catch(error) {
    const codes=["Authorization_RequestDenied","AuthorizationFailed","InvalidAuthenticationToken","Forbidden","Request_BadRequest","PolicyViolation","Authentication_Unauthorized","AzureOperationFailed"];
    return { status:"stopped", stage, displayName, created, objectId,
      code:codes.includes(error?.code) ? error.code : "ScopeOrReadbackNotVerified",
      creationOutcomeMayBeUnknown:stage==="create" && !created,
      retryAttempted:false, instructions:"Stop. Review this exact application name with the tenant administrator before any further creation. No policy bypass or automatic retry." };
  }
}
if(require.main === module) {
  if(process.argv.length !== 3 || process.argv[2] !== "create-approved-spa") {
    console.log("Usage: node scripts/register-picker.js create-approved-spa. Requires explicit approved AZURE_SUBSCRIPTION_ID and AZURE_RESOURCE_GROUP. Creates one uniquely named, credential-free, single-tenant SPA and reads it back. No consent grants, service principals, credentials, existing-resource updates, hosting or calendar access. Requires separate explicit operator approval before each invocation.");
    process.exitCode=2;
  } else { const result=run(process.env); console.log(JSON.stringify(result,null,2)); if(result.status!=="registered_verified") process.exitCode=1; }
}
module.exports={ payload, verify, safeCode, azure, run, projection };