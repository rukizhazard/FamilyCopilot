"use strict";
const test=require("node:test"), assert=require("node:assert/strict");
const helper=require("../scripts/register-picker.js"), { TENANT }=require("../picker/core.js");
const env={ AZURE_SUBSCRIPTION_ID:"609bbde3-d152-4d7d-a12b-005e38ac4f27", AZURE_RESOURCE_GROUP:"vdi-prebuilt-dte" };
const nonce="11111111-1111-4111-8111-111111111111", id="22222222-2222-4222-8222-222222222222", appId="33333333-3333-4333-8333-333333333333";
function mock(change) {
  const calls=[]; let app;
  const call=args=>{ calls.push(args); if(calls.length===1)return {tenantId:TENANT,state:"Enabled"}; if(calls.length===2)return {name:env.AZURE_RESOURCE_GROUP};
    if(calls.length===3) {app={...JSON.parse(args[args.indexOf("--body")+1]),id,appId,passwordCount:0,keyCount:0};return app;}
    return change?change(app):app;
  }; return {calls,call};
}
test("registration creates exactly one single-tenant SPA with no credentials or consent grants and verifies readback",()=>{
  const m=mock(), result=helper.run(env,m.call,nonce);
  assert.equal(result.status,"registered_verified");assert.equal(m.calls.length,4);assert.equal(result.publicConfig.clientId,appId);
  assert.equal(m.calls[2][m.calls[2].indexOf("--method")+1],"post");
  assert.equal(m.calls[3][m.calls[3].indexOf("--url")+1],`https://graph.microsoft.com/v1.0/applications/${id}`);
  const body=JSON.parse(m.calls[2][m.calls[2].indexOf("--body")+1]);
  assert.deepEqual(body.passwordCredentials,[]);assert.deepEqual(body.keyCredentials,[]);assert.equal(body.requiredResourceAccess[0].resourceAccess.length,1);
  assert.doesNotMatch(JSON.stringify(m.calls),/servicePrincipals|oauth2PermissionGrants|calendarView|\/events|logicApps|Microsoft\.Web|addPassword/);
});
test("scope mismatch stops before create, denial stops without retries, and raw errors are never returned",()=>{
  let calls=0;assert.equal(helper.run({...env,AZURE_RESOURCE_GROUP:"other"},()=>{calls++;},nonce).status,"stopped");assert.equal(calls,0);
  const m=mock();const result=helper.run(env,args=>{if(m.calls.length===2){throw {code:"Authorization_RequestDenied",message:"private token raw body"};}return m.call(args);},nonce);
  assert.equal(result.stage,"create");assert.equal(result.created,false);assert.equal(result.code,"Authorization_RequestDenied");assert.equal(result.retryAttempted,false);
  assert.doesNotMatch(JSON.stringify(result),/private|token|raw body/);
});
test("readback mismatch cannot produce usable browser configuration or a second creation",()=>{
  for(const change of [app=>({...app,signInAudience:"AzureADMultipleOrgs"}),app=>({...app,passwordCount:1}),
    app=>({...app,keyCount:1}),app=>({...app,spa:{redirectUris:["https://evil.test"]}}),
    app=>({...app,requiredResourceAccess:[]}),app=>({...app,publicClient:{redirectUris:["http://localhost"]}})]) {
    const m=mock(change), result=helper.run(env,m.call,nonce);assert.equal(result.status,"stopped");assert.equal(result.created,true);
    assert.equal(result.publicConfig,undefined);assert.equal(m.calls.length,4);
  }
});
test("CLI execution uses bounded piped output, no interactive input and safe error codes",()=>{
  assert.throws(()=>helper.azure(["account","show"],(cmd,args,opts)=>{
    assert.equal(cmd,"az");assert.equal(opts.timeout,90000);assert.deepEqual(opts.stdio,["ignore","pipe","pipe"]);
    assert.ok(args.includes("--only-show-errors"));throw {stderr:"Forbidden secret user data"};
  }),error=>error.code==="Forbidden" && !error.message.includes("secret"));
  assert.equal(helper.safeCode({stderr:"untrusted content"}),"AzureOperationFailed");
});