"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const core = require("../picker/core.js");
const config = { clientId:"11111111-1111-4111-8111-111111111111", tenantId:core.TENANT, redirectUri:core.REDIRECT };
const oid = "22222222-2222-4222-8222-222222222222";
const account = { tenantId:core.TENANT, localAccountId:oid, homeAccountId:`${oid}.${core.TENANT}`,
  environment:"login.microsoftonline.com", username:"adult@example.test", name:"Synthetic adult" };
const instant = 2000000000000;
const result = () => ({ account:{ ...account }, tenantId:core.TENANT, uniqueId:oid,
  idTokenClaims:{tid:core.TENANT,oid,aud:config.clientId,iss:`https://login.microsoftonline.com/${core.TENANT}/v2.0`,exp:(instant+3600000)/1000},
  scopes:[core.SCOPE,"openid","profile","offline_access"], accessToken:"synthetic-not-a-token", expiresOn:new Date(instant + 3600000) });
const own = (id = "synthetic-calendar") => ({ id, name:"Synthetic calendar", owner:{ address:account.username }, canShare:true });
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers:{ "content-type":"application/json" } });
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; };
function setup(overrides = {}) {
  let active = null, clock = instant, clears = 0, logins = 0, fetches = 0, lastRequest;
  const auth = { login:async request => { logins++; lastRequest=request; return result(); },
    activate:a => { active=a; }, current:() => active, clear:async () => { clears++; active=null; } };
  const picker = core.createPicker({ config, origin:core.ORIGIN, now:() => clock,
    authFactory:async () => auth, fetcher:async () => { fetches++; return json({ value:[own()] }); }, ...overrides });
  return { picker, auth, setAccount:a => { active=a; }, advance:delta => { clock+=delta; },
    counts:() => ({ clears, logins, fetches, lastRequest }) };
}
test("public config is exact, local, tenant pinned, and fails closed without SDK calls", async () => {
  for (const bad of [{ ...config, clientId:"" }, { ...config, secret:"no" }, { ...config, tenantId:"common" },
    { ...config, redirectUri:"https://example.test/redirect.html" }]) {
    assert.throws(() => core.validateConfig(bad, core.ORIGIN));
    const h = setup({ config:bad, authFactory:() => assert.fail("must not initialize") });
    await h.picker.connect(); assert.equal(h.picker.snapshot().status,"unconfigured");
  }
  assert.throws(() => core.validateConfig(config,"http://127.0.0.1:8001"));
  const settings = core.msalConfiguration(config);
  assert.equal(settings.cache.cacheLocation,"memoryStorage");
  assert.equal(settings.system.allowPlatformBroker,false);
  assert.equal(settings.auth.verifySSO,false);
  assert.equal(settings.system.serverTelemetryEnabled,false);
});
test("explicit sign-in, identity confirmation, no default selection and summary only", async () => {
  const h = setup(); assert.equal(h.counts().fetches,0);
  await h.picker.connect(); assert.equal(h.picker.snapshot().status,"identity");
  assert.deepEqual(h.counts().lastRequest.scopes,[core.SCOPE]);
  assert.equal(h.counts().lastRequest.prompt,"select_account");
  assert.equal(h.counts().lastRequest.responseMode,"fragment");
  await h.picker.load(false); assert.equal(h.counts().fetches,0);
  await h.picker.load(true); assert.equal(h.counts().fetches,1);
  assert.deepEqual(h.picker.snapshot().selected,[]);
  h.picker.review(); assert.notEqual(h.picker.snapshot().status,"summary");
  h.picker.select(0,true); h.picker.review(); assert.notEqual(h.picker.snapshot().status,"summary");
  h.picker.represent(true); h.picker.review(); assert.equal(h.picker.snapshot().status,"summary");
  assert.equal(h.counts().fetches,1); assert.equal(h.counts().logins,1);
  h.picker.back(); h.picker.select(0,false); assert.deepEqual(h.picker.snapshot().selected,[]);
  assert.equal(h.picker.snapshot().self,false); assert.equal(h.picker.snapshot().status,"picker");
  h.picker.disconnect(); assert.equal(h.picker.snapshot().account,null); assert.deepEqual(h.picker.snapshot().calendars,[]);
  assert.ok(h.counts().clears >= 1);
});
test("identity and token/scope mismatches fail before calendar listing", async () => {
  const cases = [ { account:{ ...account, tenantId:"other" } }, { account:{ ...account, homeAccountId:`${oid}.other` } },
    { account:{ ...account, environment:"evil.test" } }, { scopes:["Calendars.ReadWrite"] },
    { scopes:[core.SCOPE,"User.Read"] }, { expiresOn:new Date(instant-1) }, { accessToken:"" }, { account:null },
    {tenantId:"other"}, {uniqueId:"other"}, {idTokenClaims:{...result().idTokenClaims,aud:"other"}},
    {idTokenClaims:{...result().idTokenClaims,iss:"https://evil.test"}}, {idTokenClaims:{...result().idTokenClaims,exp:1}} ];
  for (const change of cases) {
    const h = setup(); h.auth.login = async () => ({ ...result(), ...change });
    await h.picker.connect(); await h.picker.load(true);
    assert.equal(h.counts().fetches,0); assert.equal(h.picker.snapshot().account,null);
  }
});
test("ownership projection withholds shared, unknown and alias owners without leaking labels", async () => {
  const h = setup({ fetcher:async () => json({ value:[own(), { ...own("shared"), canShare:false, name:"foreign sensitive label" },
    { ...own("unknown"), owner:null }, { ...own("alias"), owner:{ address:"alias@example.test" } }] }) });
  await h.picker.connect(); await h.picker.load(true);
  assert.equal(h.picker.snapshot().excluded,3); assert.equal(h.picker.snapshot().calendars.length,1);
  assert.doesNotMatch(JSON.stringify(h.picker.snapshot()),/foreign|accessToken|owner|synthetic-not-a-token/);
});
test("empty list is distinct from failed, partial or free schedule", async () => {
  const h = setup({ fetcher:async () => json({ value:[] }) }); await h.picker.connect(); await h.picker.load(true);
  assert.equal(h.picker.snapshot().status,"empty"); assert.match(core.messages.empty,/does not mean.*free/);
});
test("Graph pagination only permits exact endpoint and restricted immutable query", () => {
  assert.equal(core.safePage(core.FIRST_PAGE+"&$skiptoken=opaque%2Bcursor"),core.FIRST_PAGE+"&$skiptoken=opaque%2Bcursor");
  for (const url of ["//graph.microsoft.com/v1.0/me/calendars",core.FIRST_PAGE.replace("https:","http:"),
    core.FIRST_PAGE.replace("graph.microsoft.com","graph.microsoft.com.evil.test"),
    core.FIRST_PAGE.replace("graph.microsoft.com","user:pass@graph.microsoft.com"),
    core.FIRST_PAGE.replace("/me/","/users/other/"),core.FIRST_PAGE.replace("calendars?","events?"),
    core.FIRST_PAGE+"&$expand=events",core.FIRST_PAGE+"&$select=events",core.FIRST_PAGE+"#fragment",
    core.FIRST_PAGE.replace("$top=50","$top=500"),core.FIRST_PAGE+"&$skip=-1",core.FIRST_PAGE+"&$skiptoken=",core.FIRST_PAGE+"&$skiptoken="+"x".repeat(9000)]) {
    assert.throws(() => core.safePage(url));
  }
});
test("bounded two-page listing never redirects, retries or calls event APIs", async () => {
  const calls=[];
  const h=setup({ fetcher:async (url,opts) => { calls.push(url); assert.equal(opts.method,"GET"); assert.equal(opts.redirect,"error");
    assert.equal(opts.credentials,"omit"); assert.equal(opts.cache,"no-store"); assert.equal(opts.referrerPolicy,"no-referrer");
    assert.equal(opts.headers.Authorization,"Bearer synthetic-not-a-token");
    return json(calls.length===1 ? { value:[own("one")], "@odata.nextLink":core.FIRST_PAGE+"&$skiptoken=two" } : { value:[own("two")] }); } });
  await h.picker.connect(); await h.picker.load(true); assert.equal(calls.length,2); assert.equal(h.picker.snapshot().calendars.length,2);
});
for (const [status,kind] of [[401,"revoked"],[403,"forbidden"],[429,"throttled"],[503,"unavailable"]]) {
  test(`Graph ${status} clears all state without retries or provider body leakage`, async () => {
    let calls=0; const h=setup({ fetcher:async () => { calls++; return json({ secret:"untrusted provider error" },status); } });
    await h.picker.connect(); await h.picker.load(true);
    assert.equal(calls,1); assert.equal(h.picker.snapshot().status,kind); assert.equal(h.picker.snapshot().account,null);
    assert.doesNotMatch(JSON.stringify(h.picker.snapshot()),/untrusted|secret/);
  });
}
test("partial failures discard earlier pages and block summary", async () => {
  for (const badPage of [{ value:[own("two")], "@odata.nextLink":"https://evil.test/" }, { value:[own()] },
    { value:null }, { value:[], "@odata.nextLink":null }, { value:[], "@odata.nextLink":"" },
    { value:[{ ...own("two"), id:"" }] }, { value:[], "@odata.nextLink":core.FIRST_PAGE }]) {
    let calls=0; const h=setup({ fetcher:async () => json(++calls===1 ? { value:[own()], "@odata.nextLink":core.FIRST_PAGE+"&$skiptoken=two" } : badPage) });
    await h.picker.connect(); await h.picker.load(true); h.picker.review();
    assert.equal(h.picker.snapshot().status,"partial"); assert.deepEqual(h.picker.snapshot().calendars,[]); assert.ok(calls<=2);
  }
});
test("response payload, page and item limits fail closed", async () => {
  const cases = [
    () => new Response("x".repeat(core.LIMITS.bytes+1), { headers:{ "content-type":"application/json" } }),
    () => new Response("not-json", { headers:{ "content-type":"application/json" } }),
    () => new Response("{}", { headers:{ "content-type":"text/html" } }),
    () => json({ value:Array.from({length:501},(_,i) => own(String(i))) }),
    (i) => json({ value:[], "@odata.nextLink":core.FIRST_PAGE+`&$skip=${i}` })
  ];
  for (const response of cases) {
    let calls=0; const h=setup({ fetcher:async () => response(++calls) });
    await h.picker.connect(); await h.picker.load(true);
    assert.equal(h.picker.snapshot().status,"partial"); assert.ok(calls<=10); assert.deepEqual(h.picker.snapshot().calendars,[]);
  }
});
test("sign-in cancellation/admin/popup errors are sanitized and non-automatic", async () => {
  for (const [errorCode,kind] of [["user_cancelled","denied"],["access_denied","denied"],["consent_required","admin"],["popup_window_error","popup"],["unknown","unavailable"]]) {
    const h=setup(); h.auth.login=async () => { throw { errorCode, message:"token and private user data", errorUri:"https://evil.test" }; };
    await h.picker.connect(); assert.equal(h.picker.snapshot().status,kind); assert.equal(h.counts().fetches,0);
    assert.doesNotMatch(JSON.stringify(h.picker.snapshot()),/private|evil/);
  }
});
test("disconnect fences late login and initialization and clears SDK again after settlement", async () => {
  for (const phase of ["login","initialization"]) {
    const pending=deferred(), h=setup();
    let picker=h.picker;
    if (phase==="login") h.auth.login=() => pending.promise;
    else picker=setup({ authFactory:() => pending.promise }).picker;
    const work=picker.connect(); await Promise.resolve(); picker.disconnect();
    pending.resolve(phase==="login" ? result() : h.auth); await work;
    assert.equal(picker.snapshot().status,"disconnected"); assert.equal(picker.snapshot().account,null); assert.ok(h.counts().clears>=1);
  }
});
test("disconnect aborts pending fetch and rejects late data and further pagination", async () => {
  const pending=deferred(); let signal, calls=0;
  const h=setup({ fetcher:async (url,options) => { calls++; signal=options.signal; return pending.promise; } });
  await h.picker.connect(); const work=h.picker.load(true); h.picker.disconnect(); assert.equal(signal.aborted,true);
  pending.resolve(json({ value:[own()], "@odata.nextLink":core.FIRST_PAGE+"&$skiptoken=two" })); await work;
  assert.equal(calls,1); assert.equal(h.picker.snapshot().status,"disconnected"); assert.deepEqual(h.picker.snapshot().calendars,[]);
});
test("reconnect is blocked until old login and cache cleanup settle, preventing cross-attempt cache races", async () => {
  const pending=deferred(); const h=setup(); let calls=0;
  h.auth.login=()=>{calls++;return pending.promise;};
  const work=h.picker.connect(); await Promise.resolve(); h.picker.disconnect();
  await h.picker.connect(); assert.equal(calls,1); assert.equal(h.picker.snapshot().settling,true);
  pending.resolve(result()); await work; assert.equal(h.picker.snapshot().settling,false);
  assert.equal(h.picker.snapshot().status,"disconnected");
});
test("request-wide timeout aborts a pending response and late data cannot restore it", async () => {
  const pending=deferred(); let expire, signal, removed=false;
  const h=setup({ schedule:(callback,ms)=>{expire=callback;assert.equal(ms,20000);return 1;},unschedule:()=>{removed=true;},
    fetcher:async(url,options)=>{signal=options.signal;return pending.promise;} });
  await h.picker.connect(); const work=h.picker.load(true); expire();
  assert.equal(signal.aborted,true); assert.equal(h.picker.snapshot().status,"unavailable");
  pending.resolve(json({value:[own()]}));await work;
  assert.equal(h.picker.snapshot().account,null);assert.equal(removed,true);
});
test("changed account, stale list, or expired token clears prior summaries", async () => {
  for (const change of ["account","list","token"]) {
    const h=setup(); await h.picker.connect(); await h.picker.load(true); h.picker.select(0,true); h.picker.represent(true); h.picker.review();
    if(change==="account") h.setAccount({ ...account, localAccountId:"33333333-3333-4333-8333-333333333333" });
    else h.advance(change==="list" ? core.LIMITS.freshness : 3600000);
    h.picker.check(); assert.equal(h.picker.snapshot().status,change==="account"?"mismatch":"stale");
    assert.deepEqual(h.picker.snapshot().selected,[]); assert.equal(h.counts().fetches,1); assert.equal(h.counts().logins,1);
  }
});
test("snapshots cannot mutate authoritative choices; unknown indexes and selection types rejected", async () => {
  const h=setup(); await h.picker.connect(); await h.picker.load(true);
  const state=h.picker.snapshot(); state.calendars.push(own("foreign")); state.calendars[0].id="changed"; state.selected.push("foreign");
  h.picker.select(1,true); h.picker.select(0,"true"); h.picker.represent("true"); h.picker.review();
  assert.equal(h.picker.snapshot().selected.length,0); assert.equal(h.picker.snapshot().calendars[0].id,own().id);
});
test("SDK cleanup failure blocks reconnect instead of claiming successful logout", async () => {
  const h=setup(); h.auth.clear=async () => { throw new Error("sensitive"); }; await h.picker.connect();
  h.picker.disconnect(); await Promise.resolve(); await Promise.resolve();
  assert.equal(h.picker.snapshot().status,"cleanup"); await h.picker.connect(); assert.equal(h.counts().logins,1);
});
test("live source is isolated, uses text nodes and has no silent refresh, storage, mail or event calls", () => {
  const root=path.resolve(__dirname,"..");
  const adapter=fs.readFileSync(path.join(root,"picker/msal-adapter.js"),"utf8");
  assert.match(adapter,/@azure\/msal-browser/); assert.match(adapter,/clearCache/);
  for (const name of ["core.js","ui.js","main.js","msal-adapter.js"]) {
    const source=fs.readFileSync(path.join(root,"picker",name),"utf8");
    assert.doesNotMatch(source,/innerHTML|outerHTML|insertAdjacentHTML|eval\(|acquireTokenSilent|ssoSilent|setInterval|localStorage|sessionStorage|sendBeacon|\/calendarView|\/events|mailto:/i);
  }
  const html=fs.readFileSync(path.join(root,"picker/index.html"),"utf8");
  assert.doesNotMatch(html,/<script[^>]+https:/); assert.match(html,/No event import/); assert.match(html,/No time range checked/);
  assert.doesNotMatch(fs.readFileSync(path.join(root,"index.html"),"utf8"),/picker\/|msal/);
});