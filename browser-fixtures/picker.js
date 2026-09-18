// Synthetic-only browser fixture. Not built into or served by the live picker.
import { mount } from "../picker/ui.js";
import { TENANT, REDIRECT, SCOPE } from "../picker/core.js";
import names from "../test/fixtures/picker-browser.js";
const oid="22222222-2222-4222-8222-222222222222";
const account={ tenantId:TENANT, localAccountId:oid, homeAccountId:`${oid}.${TENANT}`, environment:"login.microsoftonline.com",
  username:"adult@example.test", name:"Synthetic adult" };
let active=null;
document.querySelector(".eyebrow").textContent="SYNTHETIC TEST HARNESS · No Microsoft connection";
document.querySelector(".notice").textContent="SYNTHETIC TEST HARNESS. All identities, calendar names and authentication below are fixtures. No Microsoft requests or real sign-in occur.";
mount({ config:{clientId:"11111111-1111-4111-8111-111111111111",tenantId:TENANT,redirectUri:REDIRECT},origin:"http://localhost:8001",
  authFactory:async()=>({ login:async()=>({account,tenantId:TENANT,uniqueId:oid,
    idTokenClaims:{tid:TENANT,oid,aud:"11111111-1111-4111-8111-111111111111",iss:`https://login.microsoftonline.com/${TENANT}/v2.0`,exp:Math.floor(Date.now()/1000)+3600},
    scopes:[SCOPE],accessToken:"synthetic-not-a-token",expiresOn:new Date(Date.now()+3600000)}),
    activate:a=>{active=a;},current:()=>active,clear:async()=>{active=null;} }),
  fetcher:async()=>new Response(JSON.stringify({value:[
    {id:"one",name:names.hostileName,canShare:true,owner:{address:account.username}},
    {id:"two",name:names.longName,canShare:true,owner:{address:account.username}},
    {id:"foreign",name:"Foreign owner label must not render",canShare:false,owner:{address:"other@example.test"}}
  ]}),{headers:{"content-type":"application/json"}})
});