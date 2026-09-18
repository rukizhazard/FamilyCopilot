"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), http = require("node:http");
const { once } = require("node:events");
const { isDeepStrictEqual } = require("node:util");
const { buildAvailability, buildOctoberAvailability, buildPriorWeekAvailability, buildRepairedAvailability, buildLegacyAvailability, legacyWindow, priorWeekWindow, targetSyntax, validateTargets, workflowId, window } = require("../infra/availability");
const { scope, workflowId: ownerId, connectionId, invitationId, apiId, buildOwnerWorkflow, buildWorkflow } = require("../infra/calendar-list");
const { logicUrl } = require("../scripts/calendar-list");
const { requireContract, deploy, repair, updateWeek, updateSunday, updateOctober, loadAvailability, availabilityBackend } = require("../scripts/availability");
const { expression, projectCloud } = require("./fixtures/availability-expressions");
const A = require("../owner/availability-core");
const { createServer } = require("../scripts/serve-owner");
const caller = "11111111-1111-4111-8111-111111111111", targets = ["alex@example.test", "sam@example.test"];
const callback = `https://prod-01.eastus.logic.azure.com/workflows/${"b".repeat(32)}/triggers/manual/paths/invoke?api-version=2019-05-01`;
const raw = () => ({ value: targets.map(scheduleId => ({ scheduleId, availabilityView: "0123".repeat(84), scheduleItems: [{ subject: "PRIVATE INSTRUCTION <script>", location: "PRIVATE PLACE" }], workingHours: { secret: "hidden" } })) });
const data = () => projectCloud(buildAvailability(caller),raw(),targets);
function fake({ intercept, output = projectCloud(buildOctoberAvailability(caller), raw(), targets), absent = false, legacy = false, repaired = false, priorWeek = false, september = false } = {}) {
  let resource = absent ? null : (legacy ? buildLegacyAvailability : repaired ? buildRepairedAvailability : priorWeek ? buildPriorWeekAvailability : september ? buildAvailability : buildOctoberAvailability)(caller), cleared = false;
  const calls = [], records = [];
  const b = { caller, async arm(method,id,body) {
    calls.push({method,id,body}); const override = await intercept?.({method,id,body,resource,calls}); if (override) return override;
    if (id === logicUrl(workflowId)) {
      if (method === "PUT") { resource = structuredClone(body); delete resource.properties.parameters.targets; }
      return resource ? {status:200,data:structuredClone(resource)} : {status:404,data:{error:{code:"ResourceNotFound"}}};
    }
    if (id === logicUrl(ownerId)) return {status:200,data:buildOwnerWorkflow(caller)};
    if (id.startsWith(connectionId)) return {status:200,data:{location:"eastus",properties:{api:{id:apiId},statuses:[{status:"Connected"}]}}};
    if (id === logicUrl(invitationId)) return {status:200,data:{properties:{state:"Disabled",accessControl:buildWorkflow(caller).properties.accessControl,parameters:{deliveryEnabled:{value:false}}}}};
    if (id.startsWith(apiId)) return {status:200,data:{paths:{"/{connectionId}/codeless/httprequest":{post:{operationId:"HttpRequest",deprecated:false,
      description:"1st segement: /me, /users/<userId> 2nd segment: messages, calendar, calendars.",parameters:[
        {name:"Uri",in:"header",type:"string",required:true},{name:"Method",in:"header",type:"string",required:true,enum:["POST"]},
        {name:"Body",in:"body",schema:{type:"string",format:"binary"}},{name:"ContentType",in:"header",type:"string",default:"application/json"}
      ]}}}}};
    if (id.includes("listCallbackUrl")) return {status:200,data:{value:callback}};
    if (id.includes("/enable")) { resource.properties.state = "Enabled"; return {status:200}; }
    if (id.includes("/disable")) { resource.properties.state = "Disabled"; return {status:200}; }
    if (!id.includes("/providers/")) return {status:200,data:{location:"eastus"}};
    throw new Error("unexpected_path");
  }, async invoke(url,auth) { assert.equal(url,callback); calls.push({auth}); const r = await intercept?.({auth,resource,calls});
    return r || (auth === "valid" ? {status:200,data:output} : {status:401}); }, clear() { cleared = true; } };
  return {b,calls,records,record:x=>records.push(x),get cleared(){return cleared;}};
}
test("availability exact fixed read-only request, secure parameters and all action histories protected", () => {
  const w = buildAvailability(caller,targets), d = w.properties.definition, a = d.actions.Get_schedule;
  assert.equal(w.properties.state,"Disabled"); assert.deepEqual(w.properties.accessControl,buildWorkflow(caller).properties.accessControl);
  assert.equal(d.parameters.targets.type,"SecureObject"); assert.deepEqual(w.properties.parameters.targets.value,{people:targets});
  assert.doesNotMatch(JSON.stringify(d),/alex@example|sam@example/);
  assert.equal(a.inputs.headers.Uri,"https://graph.microsoft.com/v1.0/me/calendar/getSchedule"); assert.equal(a.inputs.headers.Method,"POST");
  assert.equal(a.inputs.path,"/codeless/httprequest"); assert.equal(a.inputs.body.availabilityViewInterval,30);
  assert.equal(a.inputs.body.startTime.dateTime+"Z",window.start); assert.equal(a.inputs.body.endTime.dateTime+"Z",window.end);
  assert.deepEqual(a.inputs.retryPolicy,{type:"none"}); assert.equal(Object.values(d.actions).filter(a=>a.type === "ApiConnection").length,1);
  assert.deepEqual(d.triggers.manual.inputs.schema,{type:"object",properties:{},additionalProperties:false});
  for (const action of Object.values(d.actions)) assert.deepEqual(action.runtimeConfiguration.secureData.properties,
    ["Compose","Response","ParseJson"].includes(action.type) ? ["inputs"] : ["inputs","outputs"]);
  assert.deepEqual(d.outputs,{});
});
test("operator config rejects third/duplicate/malformed targets and keeps exact two", () => {
  for (const value of [[],[targets[0]], [...targets, "extra@example.test"],[targets[0],targets[0].toUpperCase()],[targets[0],"x;other@example.test"],{}]) assert.throws(()=>validateTargets(value));
  assert.deepEqual(validateTargets(targets),targets);
});
test("actual cloud expressions bind by identity not order and strip malicious content before output", () => {
  const r = raw(); r.value.reverse(); r.value[0].availabilityView = "2".repeat(336);
  const result = projectCloud(buildAvailability(caller),r,targets);
  assert.equal(result.people[1].slots[0],"busy"); assert.equal(result.people[0].slots[0],"free_or_elsewhere");
  assert.doesNotMatch(JSON.stringify(result),/PRIVATE|script|subject|location|scheduleId|@|workingHours/);
  assert.deepEqual(result.people[0].slots.slice(0,4),["free_or_elsewhere","tentative","busy","oof"]);
});
test("cloud projection fails closed independently for missing/duplicate/error/invalid and unknown digits", () => {
  for (const [mutate,status] of [
    [r=>r.value.pop(),"missing"], [r=>r.value[1].scheduleId=targets[0],"missing"],
    [r=>r.value[1].error={message:"PRIVATE",responseCode:"403"},"unavailable"],
    [r=>r.value[1].availabilityView="", "invalid"], [r=>r.value[1].availabilityView={a:"00000000"}, "invalid"], [r=>r.value[1].scheduleId={malicious:"x"},"missing"]
  ]) {
    const r=raw(); mutate(r); const result=projectCloud(buildAvailability(caller),r,targets);
    assert.equal(result.people[1].status,status); assert.ok(result.people[1].slots.every(s=>s==="unknown")); assert.doesNotMatch(JSON.stringify(result),/PRIVATE|403|malicious/);
  }
  const r=raw(); r.value[1].scheduleId=targets[0]; assert.equal(projectCloud(buildAvailability(caller),r,targets).people[0].status,"invalid");
  r.value[1].scheduleId=targets[1]; r.value[1].availabilityView="4?23"+"0123".repeat(83);
  const result=projectCloud(buildAvailability(caller),r,targets); assert.equal(result.people[1].slots[0],"unknown"); assert.equal(A.project(result).people[1].status,"partial");
});
test("local projection drops all extra fields, refuses wrong range and independently handles malformed bindings", () => {
  const d=data(); d.secret="PRIVATE"; d.people[0].subject="PRIVATE";
  assert.doesNotMatch(JSON.stringify(A.project(d)),/PRIVATE|subject|secret/);
  for (const mutate of [x=>x.window.end="2026-09-16T09:00:00Z",x=>x.window.interval=15,x=>x.people.push(x.people[0]),x=>x.checkedAt="now"]) {
    const d=data(); mutate(d); assert.throws(()=>A.project(d));
  }
  d.people[1].person=0; assert.ok(A.project(d).people.every(p=>p.slots.every(s=>s==="unknown")));
  const p=data(); p.people[1].slots[0]="<script>"; assert.equal(A.project(A.project(p)).people[1].status,"partial");
});
test("availability state requires review and fences late success after clear, freshness is bounded", () => {
  let s=A.initial(); assert.equal(A.transition(s,{type:"load"}),s);
  s=A.transition(s,{type:"load",acknowledged:true}); const g=s.generation;
  s=A.transition(s,{type:"clear"}); assert.equal(A.transition(s,{type:"loaded",generation:g,data:data()}),s); assert.equal(s.data,null);
  assert.match(A.freshness(data(),Date.parse(data().checkedAt)+600001),/Stale/);
  assert.match(A.freshness(data(),Date.parse(data().checkedAt)+100),/Snapshot/);
});
test("availability lifecycle denies twice before one authenticated query, disables before disclosure", async () => {
  const f=fake(); const result=await loadAvailability(f.b,{record:f.record});
  assert.equal(result.people.length,2); assert.deepEqual(f.calls.filter(x=>x.auth).map(x=>x.auth),["none","invalid","valid"]);
  assert.deepEqual(f.records,["cleanup_pending","workflow_disabled"]); assert.ok(f.cleared);
  assert.ok(f.calls.filter(x=>x.method && x.method!=="GET").every(x=>x.id.startsWith(workflowId)));
});
test("denial failure, contract drift, cancellation and ambiguous query never retry", async () => {
  for (const intercept of [({auth})=>auth==="none"?{status:200}:null, ({auth})=>{if(auth==="valid")throw new Error("PRIVATE");},
    ({id,resource,calls})=>{if(id===logicUrl(workflowId)&&calls.length>5)resource.tags.drift=true;}]) {
    const f=fake({intercept}); await assert.rejects(loadAvailability(f.b,{record:f.record})); assert.ok(f.calls.filter(x=>x.auth==="valid").length<=1); assert.ok(f.cleared);
  }
  const controller=new AbortController(); const f=fake({intercept:({auth})=>{if(auth==="valid")controller.abort();}});
  await assert.rejects(loadAvailability(f.b,{signal:controller.signal,record:f.record}),/cancelled/); assert.equal(f.records.at(-1),"workflow_disabled");
});
test("cleanup failure and enable ambiguity remain visible, credentials clear only after cleanup", async () => {
  for(const suffix of ["/enable", "/disable"]) {
    const f=fake({intercept:({id})=>{if(id?.includes(suffix))throw new Error("PRIVATE");}});
    await assert.rejects(loadAvailability(f.b,{record:f.record}),/cleanup_failed/); assert.equal(f.records.at(-1),"cleanup_failed"); assert.ok(f.cleared);
    assert.equal(f.calls.filter(x=>x.id?.includes("/disable")).length,1);
  }
});
test("exact metadata guard rejects unknown fields, broadening and unredacted secure values", () => {
  for(const mutate of [w=>w.identity={},w=>w.properties.definition.actions.Extra={},w=>w.properties.accessControl.triggers.sasAuthenticationPolicy.state="Enabled",w=>w.properties.parameters.targets={value:targets}]) {
    const w=buildOctoberAvailability(caller); mutate(w); assert.throws(()=>requireContract(w,caller,"Disabled"));
  }
  const w=buildOctoberAvailability(caller); w.properties.parameters.targets={type:"SecureObject"}; assert.equal(requireContract(w,caller,"Disabled"),w);
});
test("transport blocks arbitrary resources, event writes, URLs, second invocation and cancelled cleanup", async () => {
  const claims={oid:caller,tid:scope.tenant,iss:`https://sts.windows.net/${scope.tenant}/`,appid:scope.application,aud:scope.audience,exp:9999999999};
  const token=`h.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.s`, requests=[], controller=new AbortController();
  const b=await availabilityBackend(controller.signal,"load",undefined,async args=>args.includes("get-access-token")?token:args[0]==="ad"?caller:{tenant:scope.tenant,state:"Enabled"},async(url,options)=>{requests.push({url,options});return {status:200,data:{value:callback}};});
  for(const [method,id] of [["PUT",connectionId],["POST",logicUrl(invitationId,"/enable")],["GET",`${workflowId}/runs`],["POST",logicUrl(ownerId,"/enable")]]) await assert.rejects(b.arm(method,id));
  await assert.rejects(b.invoke(callback,"valid"));
  await b.arm("POST",logicUrl(workflowId,"/triggers/manual/listCallbackUrl"),{});
  await assert.rejects(b.invoke("https://evil.test","valid")); await b.invoke(callback,"valid"); await assert.rejects(b.invoke(callback,"valid"));
  assert.deepEqual(requests.at(-1).options.body,{});
  controller.abort(); await b.arm("POST",logicUrl(workflowId,"/disable")); assert.equal(requests.at(-1).options.signal,undefined); b.clear();
});
test("offline availability proxy E2E enforces CSRF, no configurable range/people, one flight and clear", async t => {
  let calls=0; const f=fake(); const server=createServer({performAvailability: async options=>{calls++;return loadAvailability(f.b,options);}});
  server.listen(0,"127.0.0.1"); await once(server,"listening"); t.after(()=>server.shutdown());
  const request=(path,body,csrf,origin="http://localhost:8002")=>new Promise((resolve,reject)=>{
    const req=http.request({hostname:"127.0.0.1",port:server.address().port,path,method:body===undefined?"GET":"POST",headers:{Host:"localhost:8002",...(body===undefined?{}:{Origin:origin,"Content-Type":"application/json","X-Owner-CSRF":csrf||"bad"})}},res=>{
      let text="";res.on("data",c=>text+=c);res.on("end",()=>resolve({status:res.statusCode,text}));});req.on("error",reject);req.end(body===undefined?undefined:JSON.stringify(body));
  });
  const page=await request("/");const csrf=page.text.match(/name="owner-csrf" content="([a-f0-9]+)"/)[1];const payload={acknowledged:true,requestId:caller};
  assert.equal(calls,0); assert.equal((await request("/api/availability",payload)).status,403);
  assert.equal((await request("/api/availability",payload,csrf,"http://evil.test")).status,403);
  for(const extra of [{people:targets},{start:window.start},{url:"https://graph.microsoft.com"}]) assert.equal((await request("/api/availability",{...payload,...extra},csrf)).status,400);
  const r=await request("/api/availability",payload,csrf);assert.equal(r.status,200);assert.equal(JSON.parse(r.text).people.length,2);assert.equal(calls,1);
  const cached=await request("/api/availability",payload,csrf);assert.equal(cached.status,200);assert.equal(JSON.parse(cached.text).cached,true);assert.equal(calls,1);
  assert.equal(JSON.parse((await request("/api/clear",{},csrf)).text).status,"cleared");
});

test("deployment creates only absent disabled workflow after adjacent read, no ETag assumption or query", async () => {
  const f=fake({absent:true}); const report=await deploy(f.b,targets); assert.equal(report.status,"deployed_disabled");
  const writes=f.calls.filter(c=>c.method!=="GET"); assert.equal(writes.length,1);assert.equal(writes[0].method,"PUT");
  assert.equal(f.calls[f.calls.indexOf(writes[0])-1].id,logicUrl(workflowId));assert.equal(writes[0].body.properties.state,"Disabled");assert.ok(f.cleared);
  const collision=fake();await assert.rejects(deploy(collision.b,targets));assert.ok(collision.calls.every(c=>c.method==="GET"));
});
test("safe once verifier keeps partial person outcomes, always clears and independently inspects without retry", async () => {
  const {verifyOnce}=require("../scripts/verify-availability");let loads=0,inspections=0;
  const d=data();d.people[1]=A.unknown(1,"unavailable");
  const report=await verifyOnce({inspect:async()=>{inspections++;return {connection:{},invitation:{}};},request:async(path)=>{
    if(path==="/")return {status:200,text:`<meta name="owner-mode" content="live"><meta name="owner-csrf" content="${"a".repeat(64)}"><button id="availability-load">`};
    if(path==="/api/availability"){loads++;return {status:200,text:JSON.stringify({...d,synthetic:false,cleanup:"workflow_disabled",subject:"PRIVATE"})};}
    return {status:200,text:JSON.stringify(path==="/api/clear"?{status:"cleared"}:{status:"idle",synthetic:false})};
  }});
  assert.equal(loads,1);assert.equal(inspections,2);assert.equal(report.person0Success,true);assert.equal(report.person1Success,false);assert.equal(report.slotCount,336);
  assert.equal(report.workflowDisabled,true);assert.equal(report.sessionCleared,true);assert.doesNotMatch(JSON.stringify(report),/PRIVATE|slots|busy|@|schedule/);
});
test("cancel before any work and cancel immediately after enable never invoke", async () => {
  const cancelled=new AbortController();cancelled.abort();const first=fake();
  await assert.rejects(loadAvailability(first.b,{signal:cancelled.signal}),/cancelled/);assert.equal(first.calls.length,0);assert.ok(first.cleared);
  const c=new AbortController();const f=fake({intercept:({id})=>{if(id?.includes("/enable"))c.abort();}});
  await assert.rejects(loadAvailability(f.b,{signal:c.signal,record:f.record}),/cancelled/);assert.equal(f.calls.filter(x=>x.auth).length,0);assert.equal(f.records.at(-1),"workflow_disabled");
});

test("metadata diagnostics emit fixed statuses only and never follow payload links", async () => {
  const {diagnose}=require("../scripts/diagnose-availability");
  const f=fake({intercept:({id})=>{
    if(id===`${logicUrl(workflowId,"/runs")}&$top=1`)return {status:200,data:{value:[{name:"safe-run",properties:{status:"Failed",secret:"PRIVATE"}}]}};
    if(id===logicUrl(workflowId,"/runs/safe-run/actions"))return {status:200,data:{value:[
      {name:"Validate_targets",properties:{status:"Failed",code:"PRIVATE",error:{code:"PRIVATE",message:"PRIVATE"},outputsLink:{uri:"https://evil.test"}}},
      {name:"Get_schedule",properties:{status:"Skipped",code:"ActionSkipped"}}, {name:"PRIVATE",properties:{status:"Succeeded"}}
    ]}};
  }});
  const result=await diagnose(f.b);assert.equal(result.actions.Get_schedule.status,"Skipped");assert.equal(result.workflowDisabled,true);
  assert.equal(result.preservedResourcesUnchanged,true);assert.doesNotMatch(JSON.stringify(result),/PRIVATE|safe-run|https:|@/);
  assert.ok(f.calls.every(c=>c.method==="GET"));assert.ok(f.cleared);
});

test("diagnostic transport accepts only bound latest-run metadata and refuses every write/invoke", async () => {
  const claims={oid:caller,tid:scope.tenant,iss:`https://sts.windows.net/${scope.tenant}/`,appid:scope.application,aud:scope.audience,exp:9999999999};
  const token=`h.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.s`;
  const read=async args=>args.includes("get-access-token")?token:args[0]==="ad"?caller:{tenant:scope.tenant,state:"Enabled"};
  const b=await availabilityBackend(undefined,"diagnostic",undefined,read,async()=>({status:200,data:{value:[{name:"latest-run"}]}}));
  await assert.rejects(b.arm("GET",logicUrl(workflowId,"/runs/latest-run/actions")));
  await b.arm("GET",`${logicUrl(workflowId,"/runs")}&$top=1`);
  await b.arm("GET",logicUrl(workflowId,"/runs/latest-run/actions"));
  for(const suffix of ["/runs/other/actions","/runs/latest-run/actions/Get_schedule/outputs","/enable","/disable","/triggers/manual/listCallbackUrl"])
    await assert.rejects(b.arm(suffix.includes("/runs/")?"GET":"POST",logicUrl(workflowId,suffix)));
  await assert.rejects(b.invoke(callback,"valid"));b.clear();
});

test("availability credentials reserve owner-equivalent cleanup margin before any ARM request", async () => {
  const claims={oid:caller,tid:scope.tenant,iss:`https://sts.windows.net/${scope.tenant}/`,appid:scope.application,aud:scope.audience,exp:Math.floor(Date.now()/1000)+300};
  const token=`h.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.s`;let requests=0;
  await assert.rejects(availabilityBackend(undefined,"load",undefined,
    async args=>args.includes("get-access-token")?token:args[0]==="ad"?caller:{tenant:scope.tenant,state:"Enabled"},
    async()=>{requests++;}),/expired/);
  assert.equal(requests,0);
});

test("runtime pattern-property failure is classified without returning any error text", () => {
  const {errorEvidence} = require("../scripts/diagnose-availability");
  const evidence = errorEvidence({error:{message:"The schema property 'pattern' is not supported. PRIVATE alex@example.test https://secret.test token",details:[{code:"PRIVATE"}]}});
  assert.equal(evidence.patternUnsupported,true); assert.equal(evidence.patternPropertyNamed,true); assert.equal(evidence.propertyNotSupported,true);
  assert.doesNotMatch(JSON.stringify(evidence),/PRIVATE|example|https|token|@/);
  assert.equal(errorEvidence({error:{message:"Property selection is not supported on values of type String"}}).typeMismatch,true);
  assert.equal(errorEvidence({error:{message:"String does not match regex"}}).patternMismatch,true);
});

test("repair changes only contract tag and protected equivalent syntax validation gate", () => {
  const legacy=buildLegacyAvailability(caller), updated=buildRepairedAvailability(caller), copy=structuredClone(updated);
  const a=copy.properties.definition.actions;
  assert.equal(Object.hasOwn(a.Validate_targets.inputs.schema.items,"pattern"),false);
  assert.deepEqual(a.Get_schedule.runAfter,{Validate_target_syntax:["Succeeded"]});
  assert.deepEqual(a.Validate_target_syntax.runAfter,{Validate_targets:["Succeeded"]});
  assert.deepEqual(a.Validate_target_syntax.inputs.schema,{type:"array",minItems:2,maxItems:2,items:{type:"boolean",enum:[true]}});
  assert.deepEqual(a.Invalid_target_syntax.runAfter,{Validate_target_syntax:["Failed","TimedOut"]});
  delete a.Validate_target_syntax; delete a.Invalid_target_syntax;
  a.Get_schedule.runAfter=legacy.properties.definition.actions.Get_schedule.runAfter;
  a.Validate_targets.inputs.schema.items.pattern=legacy.properties.definition.actions.Validate_targets.inputs.schema.items.pattern;
  copy.tags.contract=legacy.tags.contract; assert.deepEqual(copy,legacy);
  assert.throws(()=>requireContract(legacy,caller,"Disabled"));
  requireContract(legacy,caller,"Disabled",buildLegacyAvailability);
});

test("actual WDL target syntax matches former regex without accepting malformed targets", () => {
  const check = value => expression(targetSyntax("item()"),{item:value});
  const former = new RegExp(buildLegacyAvailability(caller).properties.definition.actions.Validate_targets.inputs.schema.items.pattern);
  const samples=[...targets,"a+tag@host.test","a-b.c_d@sub-host.example.test","","@a.test","a@@a.test","a@.ab","a@a.a","a@a.12","a@a.test ","UPPER@host.test","a@host.test\n","a;other@host.test","a@host.test/","a@host.test?", "a@host.test#"];
  // Deterministic character-position corpus, not just the two happy-path strings.
  for(let code=0;code<128;code++) for(const template of ["Xalex@host.test","aXlex@host.test","alex@hoXst.test","alex@host.tXest"])
    samples.push(template.replace("X",String.fromCharCode(code)));
  for(const value of samples) {
    // New gate deliberately rejects terminal newlines that JS $ can accept.
    assert.equal(check(value),former.test(value) && !/[\r\n]/.test(value),JSON.stringify(value));
  }
  const gate=buildAvailability(caller).properties.definition.actions.Validate_target_syntax;
  const c={actions:{Validate_targets:targets}};
  assert.deepEqual(gate.inputs.content.map(e=>expression(e,c)),[true,true]);
  assert.ok(gate.inputs.content.every(e=>e.length<8192));
});

test("guarded repair is one disabled legacy-to-v2 PUT with adjacent complete snapshot fence", async () => {
  const f=fake({legacy:true}); const report=await repair(f.b,targets);
  assert.equal(report.status,"repaired_disabled"); assert.equal(report.queryMade,false); assert.equal(report.atomicCompareAndSwap,false);
  const writes=f.calls.filter(c=>c.method!=="GET"); assert.equal(writes.length,1); assert.equal(writes[0].method,"PUT");
  assert.equal(f.calls[f.calls.indexOf(writes[0])-1].id,logicUrl(workflowId));
  assert.deepEqual(writes[0].body,buildRepairedAvailability(caller,targets)); assert.ok(f.cleared);
});

test("repair refuses absent/current/unknown/caller/auth drift and preserves creation collision refusal", async () => {
  for(const options of [{absent:true},{}, {legacy:true,intercept:({resource,id})=>{if(id===logicUrl(workflowId))resource.properties.state="Enabled";}},
    {legacy:true,intercept:({resource,id})=>{if(id===logicUrl(workflowId))resource.properties.definition.actions.Extra={};}},
    {legacy:true,intercept:({resource,id})=>{if(id===logicUrl(workflowId))resource.properties.accessControl.triggers.sasAuthenticationPolicy.state="Enabled";}},
    {legacy:true,intercept:({resource,id})=>{if(id===logicUrl(workflowId))resource.properties.accessControl.triggers.openAuthenticationPolicies.policies.OwnerOnly.claims=[];}}]) {
    const f=fake(options); await assert.rejects(repair(f.b,targets)); assert.ok(f.calls.every(c=>c.method==="GET")); assert.ok(f.cleared);
  }
  const f=fake({legacy:true});await assert.rejects(deploy(f.b,targets));assert.ok(f.calls.every(c=>c.method==="GET"));
});

test("repair fences version and preserved resource drift, rejects failed readback without retry", async () => {
  for(const mode of ["version","preserved","post","ambiguous","conflict"]) {
    let reads=0;
    const f=fake({legacy:true,intercept:({method,id,resource,calls})=>{
      if(id===logicUrl(workflowId)&&method==="GET" && ++reads===2 && mode==="version")resource.properties.version="new-version";
      if(id===logicUrl(ownerId)&&mode==="preserved"&&calls.filter(c=>c.id===id).length===2)return {status:200,data:{...buildOwnerWorkflow(caller),etag:"changed"}};
      if(method==="PUT" && mode==="ambiguous")throw new Error("PRIVATE");
      if(method==="PUT" && mode==="conflict")return {status:409};
      if(id===logicUrl(workflowId)&&method==="GET"&&reads===3&&mode==="post")resource.tags.unexpected=true;
    }});
    await assert.rejects(repair(f.b,targets));assert.ok(f.cleared);
    assert.equal(f.calls.filter(c=>c.method==="PUT").length,["version","preserved"].includes(mode)?0:1);
    assert.equal(f.calls.filter(c=>c.auth||c.method==="POST").length,0);
  }
});

test("repair transport allows only one exact new workflow PUT and no invocation or lifecycle mutation", async () => {
  const claims={oid:caller,tid:scope.tenant,iss:`https://sts.windows.net/${scope.tenant}/`,appid:scope.application,aud:scope.audience,exp:9999999999};
  const token=`h.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.s`; let requests=0;
  const b=await availabilityBackend(undefined,"repair",targets,async args=>args.includes("get-access-token")?token:args[0]==="ad"?caller:{tenant:scope.tenant,state:"Enabled"},async()=>{requests++;return {status:200};});
  for(const id of [logicUrl(ownerId),logicUrl(invitationId),connectionId])await assert.rejects(b.arm("PUT",id,buildAvailability(caller,targets)));
  await assert.rejects(b.arm("PUT",logicUrl(workflowId),buildLegacyAvailability(caller,targets)));
  await assert.rejects(b.arm("PUT",logicUrl(workflowId),buildAvailability(caller,targets),{"If-Match":"*"}));
  await assert.rejects(b.arm("POST",logicUrl(workflowId,"/enable")));await assert.rejects(b.invoke(callback,"valid"));
  await b.arm("PUT",logicUrl(workflowId),buildRepairedAvailability(caller,targets));
  await assert.rejects(b.arm("PUT",logicUrl(workflowId),buildRepairedAvailability(caller,targets)));assert.equal(requests,1);b.clear();
});

test("two all-unknown fallback rows are never reported as live verification success", async () => {
  const {verifyOnce}=require("../scripts/verify-availability");
  const d=data(); d.people=[A.unknown(0,"unavailable"),A.unknown(1,"unavailable")]; let loads=0;
  const report=await verifyOnce({inspect:async()=>({connection:{},invitation:{}}),request:async path=>{
    if(path==="/")return {status:200,text:`<meta name="owner-mode" content="live"><meta name="owner-csrf" content="${"a".repeat(64)}"><button id="availability-load">`};
    if(path==="/api/availability"){loads++;return {status:200,text:JSON.stringify({...d,synthetic:false,cleanup:"workflow_disabled"})};}
    return {status:200,text:JSON.stringify(path==="/api/clear"?{status:"cleared"}:{status:"idle",synthetic:false})};
  }});
  assert.equal(loads,1);assert.equal(report.status,"partial_or_unavailable");assert.equal(report.person0Success,false);assert.equal(report.person1Success,false);
});

test("fixed seven full Taipei days have exact UTC bounds and 336 contiguous half-hours", () => {
  assert.deepEqual(window, {start:"2026-09-19T16:00:00Z",end:"2026-09-26T16:00:00Z",timezone:"Asia/Taipei",interval:30,slots:336});
  assert.equal(Date.parse(window.end)-Date.parse(window.start),7*24*60*60000);
  assert.deepEqual(A.days().map(d=>d.date),Array.from({length:7},(_,i)=>`2026-09-${20+i}`));
  assert.equal(A.slotTime(0).time,"00:00"); assert.equal(A.slotTime(335).time,"23:30");
  assert.equal(A.slotTime(335).date,"2026-09-26"); assert.equal(A.slotTime(336).date,"2026-09-27");
  assert.equal(A.slotTime(336).time,"00:00"); assert.equal(Date.parse(A.slotTime(336).utc),Date.parse(window.end));
  for(const day of A.days()) {
    assert.equal(day.end-day.start,48);assert.equal(A.slotTime(day.start).time,"00:00");
    assert.equal(A.slotTime(day.end-1).date,day.date);
  }
  for(const i of [-1,337,0.5,NaN,"0"])assert.throws(()=>A.slotTime(i));
});

test("v3 changes only version, fixed window and slot bounds from exact repaired v2", () => {
  const prior=buildRepairedAvailability(caller), copy=structuredClone(buildPriorWeekAvailability(caller));
  assert.equal(prior.tags.contract,"bounded-availability-v2"); assert.deepEqual(prior.properties.definition.actions.Availability.inputs.body.window,legacyWindow);
  assert.equal(prior.properties.definition.actions.Get_schedule.inputs.body.startTime.dateTime,"2026-09-15T01:00:00");
  copy.tags.contract=prior.tags.contract;
  const a=copy.properties.definition.actions, old=prior.properties.definition.actions;
  a.Get_schedule.inputs.body=old.Get_schedule.inputs.body;
  for(const person of [0,1]) {
    assert.match(a[`State_${person}`].inputs,/,336\)/);
    assert.equal(a[`Grid_${person}`].inputs.from,"@range(0,336)");
    a[`State_${person}`]=old[`State_${person}`];a[`Grid_${person}`]=old[`Grid_${person}`];
  }
  for(const [name,action] of Object.entries(a)) if(action.type==="Response"&&action.inputs.body.window) {
    assert.deepEqual(action.inputs.body.window,priorWeekWindow);
    for(const p of action.inputs.body.people)if(Array.isArray(p.slots))assert.equal(p.slots.length,336);
    action.inputs.body=old[name].inputs.body;
  }
  assert.deepEqual(copy,prior);
  assert.ok(Object.values(a).every(action=>action.type!=="Foreach"));
  assert.equal(old.Validate_targets.inputs.schema.items.pattern,undefined);
});

test("week projection rejects every short/long/old grid without fabricating either person's availability", () => {
  for(const length of [0,16,335,337,672]) {
    const r=raw();r.value[1].availabilityView="0".repeat(length);
    const result=A.project(projectCloud(buildAvailability(caller),r,targets));
    assert.equal(result.people[0].status,"checked");assert.equal(result.people[0].slots.length,336);
    assert.equal(result.people[1].status,"invalid");assert.equal(result.people[1].slots.length,336);
    assert.ok(result.people[1].slots.every(s=>s==="unknown"));
    const d=data();d.people[1].slots=Array(length).fill("free_or_elsewhere");
    assert.equal(A.project(d).people[1].status,"invalid");
  }
  const d=data();d.people[1].slots=Array(336);
  assert.equal(A.project(d).people[1].status,"partial");assert.ok(A.project(d).people[1].slots.every(s=>s==="unknown"));
  assert.throws(()=>A.project({...data(),window:legacyWindow}));
});

test("week migration accepts only exact Disabled v2 with immediate snapshot and redacted secure envelope", async () => {
  const f=fake({repaired:true,intercept:({resource,method,id})=>{
    if(method==="GET"&&id===logicUrl(workflowId))resource.properties.parameters.targets={type:"SecureObject",value:null};
  }});
  const report=await updateWeek(f.b,targets);
  assert.equal(report.status,"week_updated_disabled");assert.equal(report.queryMade,false);
  const writes=f.calls.filter(c=>c.method!=="GET");assert.equal(writes.length,1);
  assert.deepEqual(writes[0].body,buildPriorWeekAvailability(caller,targets));
  assert.equal(f.calls[f.calls.indexOf(writes[0])-1].id,logicUrl(workflowId));assert.ok(f.cleared);
});

test("week migration refuses unknown/legacy/current contracts and identity/auth/window/envelope drift", async () => {
  const changes=[w=>w.properties.state="Enabled",w=>w.properties.definition.actions.Get_schedule.inputs.body.endTime.dateTime="2026-09-16T09:00:00",
    w=>w.properties.parameters.targets={value:{people:targets}},w=>w.properties.definition.actions.Extra={},
    w=>w.properties.accessControl.triggers.sasAuthenticationPolicy.state="Enabled",
    w=>w.properties.accessControl.triggers.openAuthenticationPolicies.policies.OwnerOnly.claims=[]];
  for(const options of [{absent:true},{legacy:true},{},...changes.map(mutate=>({repaired:true,intercept:({id,resource})=>{if(id===logicUrl(workflowId))mutate(resource);}}))]) {
    const f=fake(options);await assert.rejects(updateWeek(f.b,targets));assert.ok(f.calls.every(c=>c.method==="GET"));assert.ok(f.cleared);
  }
});

test("week migration fences adjacent version/preserved drift and does not retry ambiguous PUT/readback", async () => {
  for(const mode of ["version","preserved","post","ambiguous","conflict"]) {
    let reads=0;
    const f=fake({repaired:true,intercept:({method,id,resource,calls})=>{
      if(id===logicUrl(workflowId)&&method==="GET"&&++reads===2&&mode==="version")resource.properties.version="changed";
      if(id===logicUrl(ownerId)&&mode==="preserved"&&calls.filter(c=>c.id===id).length===2)return {status:200,data:{...buildOwnerWorkflow(caller),etag:"changed"}};
      if(method==="PUT"&&mode==="ambiguous")throw new Error("PRIVATE");
      if(method==="PUT"&&mode==="conflict")return {status:412};
      if(id===logicUrl(workflowId)&&method==="GET"&&reads===3&&mode==="post")resource.tags.unexpected=true;
    }});
    await assert.rejects(updateWeek(f.b,targets));assert.ok(f.cleared);
    assert.equal(f.calls.filter(c=>c.method==="PUT").length,["version","preserved"].includes(mode)?0:1);
    assert.equal(f.calls.filter(c=>c.auth||c.method==="POST").length,0);
  }
});

test("week transport permits one exact v3 PUT only; 24KiB limit applies only to bound availability callback", async () => {
  const claims={oid:caller,tid:scope.tenant,iss:`https://sts.windows.net/${scope.tenant}/`,appid:scope.application,aud:scope.audience,exp:9999999999};
  const token=`h.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.s`;
  const read=async args=>args.includes("get-access-token")?token:args[0]==="ad"?caller:{tenant:scope.tenant,state:"Enabled"};
  for(const mode of ["week","load"]) {
    const requests=[];
    const b=await availabilityBackend(undefined,mode,targets,read,async(url,options)=>{requests.push({url,options});return {status:200,data:{value:callback}};});
    if(mode==="week") {
      for(const id of [logicUrl(ownerId),logicUrl(invitationId),connectionId])await assert.rejects(b.arm("PUT",id,buildAvailability(caller,targets)));
      await assert.rejects(b.arm("PUT",logicUrl(workflowId),buildRepairedAvailability(caller,targets)));
      await assert.rejects(b.arm("PUT",logicUrl(workflowId),buildAvailability(caller,targets),{"If-Match":"*"}));
      await assert.rejects(b.arm("POST",logicUrl(workflowId,"/enable")));await assert.rejects(b.invoke(callback,"valid"));
      await b.arm("PUT",logicUrl(workflowId),buildPriorWeekAvailability(caller,targets));
      await assert.rejects(b.arm("PUT",logicUrl(workflowId),buildPriorWeekAvailability(caller,targets)));assert.equal(requests.length,1);
    } else {
      await b.arm("POST",logicUrl(workflowId,"/triggers/manual/listCallbackUrl"),{});
      assert.equal(requests.at(-1).options.maxBytes,8*1024*1024);
      await b.invoke(callback,"valid");assert.equal(requests.at(-1).options.maxBytes,A.responseLimit);
    }
    b.clear();
  }
});

test("bounded response budget accepts worst-case week and rejects oversized streams and declared sizes", async () => {
  const {jsonRequest}=require("../scripts/calendar-list");
  const d={...data(),cleanup:"workflow_disabled",synthetic:false};
  d.people.forEach(p=>p.slots.fill("free_or_elsewhere"));
  const text=JSON.stringify(d,null,2);assert.ok(Buffer.byteLength(text)>8192);assert.ok(Buffer.byteLength(text)<=A.responseLimit);
  const fetcher=async()=>({status:200,headers:new Headers(),body:[Buffer.from(text)]});
  assert.equal((await jsonRequest("https://example.test",{maxBytes:A.responseLimit},fetcher)).data.people[0].slots.length,336);
  await assert.rejects(jsonRequest("https://example.test",{maxBytes:A.responseLimit},async()=>({status:200,headers:new Headers(),body:[Buffer.alloc(A.responseLimit+1)]})));
  let cancelled=false;
  await assert.rejects(jsonRequest("https://example.test",{maxBytes:A.responseLimit},async()=>({status:200,headers:new Headers({"content-length":String(A.responseLimit+1)}),body:{cancel:async()=>{cancelled=true;}}})));
  assert.equal(cancelled,true);
});

test("v4 changes only exact Sunday window and tag, not targets, auth, SAS or projection", () => {
  const prior = buildPriorWeekAvailability(caller, targets), copy = structuredClone(buildAvailability(caller, targets));
  assert.equal(prior.tags.contract, "bounded-availability-v3"); assert.equal(copy.tags.contract, "bounded-availability-v4");
  copy.tags.contract = prior.tags.contract;
  const a = copy.properties.definition.actions, old = prior.properties.definition.actions;
  a.Get_schedule.inputs.body = old.Get_schedule.inputs.body;
  for (const action of Object.values(a)) if (action.type === "Response" && action.inputs.body.window) assert.deepEqual(action.inputs.body.window, window);
  for (const [name, action] of Object.entries(a)) if (action.type === "Response" && action.inputs.body.window) {
    action.inputs.body.window = old[name].inputs.body.window;
  }
  assert.deepEqual(copy, prior);
});

test("Sunday migration accepts only exact Disabled v3, one adjacent PUT and no calendar invocation", async () => {
  const f = fake({ priorWeek: true }), report = await updateSunday(f.b, targets);
  assert.equal(report.status, "sunday_updated_disabled"); assert.equal(report.queryMade, false);
  const writes = f.calls.filter(c => c.method !== "GET"); assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].body, buildAvailability(caller, targets));
  assert.equal(f.calls[f.calls.indexOf(writes[0]) - 1].id, logicUrl(workflowId)); assert.ok(f.cleared);
  for (const options of [{}, { repaired: true }, { legacy: true }, { absent: true },
    { priorWeek: true, intercept: ({ resource, id }) => { if (id === logicUrl(workflowId)) resource.properties.state = "Enabled"; } },
    { priorWeek: true, intercept: ({ resource, id, calls }) => { if (id === logicUrl(workflowId) && calls.filter(c => c.id === id).length === 2) resource.properties.version = "changed"; } }]) {
    const blocked = fake(options); await assert.rejects(updateSunday(blocked.b, targets));
    assert.ok(blocked.calls.every(c => c.method === "GET"));
  }
});

test("Sunday transport permits one exact v4 Disabled PUT, never enable, invoke, other resource or arbitrary body", async () => {
  const claims = { oid: caller, tid: scope.tenant, iss: `https://sts.windows.net/${scope.tenant}/`, appid: scope.application, aud: scope.audience, exp: 9999999999 };
  const token = `h.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.s`; let requests = 0;
  const b = await availabilityBackend(undefined, "sunday", targets,
    async args => args.includes("get-access-token") ? token : args[0] === "ad" ? caller : { tenant: scope.tenant, state: "Enabled" },
    async () => { requests++; return { status: 200 }; });
  for (const id of [logicUrl(ownerId), logicUrl(invitationId), connectionId]) await assert.rejects(b.arm("PUT", id, buildAvailability(caller, targets)));
  await assert.rejects(b.arm("PUT", logicUrl(workflowId), buildPriorWeekAvailability(caller, targets)));
  await assert.rejects(b.arm("POST", logicUrl(workflowId, "/enable"))); await assert.rejects(b.invoke(callback, "valid"));
  await b.arm("PUT", logicUrl(workflowId), buildAvailability(caller, targets));
  await assert.rejects(b.arm("PUT", logicUrl(workflowId), buildAvailability(caller, targets)));
  assert.equal(requests, 1); b.clear();
});

test("October v5 changes only tag and exact UTC windows; v4 and earlier factories remain frozen", () => {
  const prior = buildAvailability(caller, targets), next = buildOctoberAvailability(caller, targets);
  assert.equal(next.tags.contract, "bounded-availability-v5");
  assert.deepEqual(A.liveWindow, { start: "2026-10-08T16:00:00Z", end: "2026-10-15T16:00:00Z", timezone: "Asia/Taipei", interval: 30, slots: 336 });
  assert.deepEqual(A.dateRange("2026-10-09", "2026-10-15"), A.liveWindow);
  assert.equal(A.slotTime(336, A.liveWindow).date, "2026-10-16");
  assert.equal(A.slotTime(335, A.liveWindow).time, "23:30");
  assert.deepEqual(A.weekLayout([], A.liveWindow).map(d => d.heading), ["Fri 09", "Sat 10", "Sun 11", "Mon 12", "Tue 13", "Wed 14", "Thu 15"]);
  const copy = structuredClone(next), a = copy.properties.definition.actions, old = prior.properties.definition.actions;
  assert.equal(a.Get_schedule.inputs.body.startTime.dateTime, "2026-10-08T16:00:00");
  assert.equal(a.Get_schedule.inputs.body.endTime.dateTime, "2026-10-15T16:00:00");
  assert.equal(a.Get_schedule.inputs.body.startTime.timeZone, "UTC");
  for (const [name, action] of Object.entries(a)) if (action.type === "Response" && action.inputs.body.window) {
    assert.deepEqual(action.inputs.body.window, A.liveWindow);
    for (const p of action.inputs.body.people) if (Array.isArray(p.slots)) assert.equal(p.slots.length, 336);
  }
  for (const [name, action] of Object.entries(a)) if (action.type === "Response" && action.inputs.body.window) {
    action.inputs.body.window = old[name].inputs.body.window;
  }
  copy.tags.contract = prior.tags.contract;
  a.Get_schedule.inputs.body = old.Get_schedule.inputs.body;
  assert.deepEqual(copy, prior);
  assert.deepEqual(prior, buildAvailability(caller, targets));
  const projected = projectCloud(next, raw(), targets);
  assert.equal(A.project(projected, A.liveWindow).people[0].slots.length, 336);
  assert.doesNotMatch(JSON.stringify(projected), /PRIVATE|subject|scheduleId|@/);
  assert.throws(() => A.project(data(), A.liveWindow));
});

test("October migration is exactly one adjacent Disabled v4-to-v5 PUT, no lifecycle/query or other-resource write", async () => {
  const f = fake({ september: true });
  const report = await updateOctober(f.b, targets);
  assert.deepEqual(report, { status: "october_updated_disabled", sasDisabled: true, preservedResourcesUnchanged: true, queryMade: false, atomicCompareAndSwap: false });
  const writes = f.calls.filter(c => c.method !== "GET");
  assert.equal(writes.length, 1); assert.equal(writes[0].id, logicUrl(workflowId));
  assert.deepEqual(writes[0].body, buildOctoberAvailability(caller, targets));
  assert.equal(f.calls[f.calls.indexOf(writes[0]) - 1].id, logicUrl(workflowId));
  assert.equal(writes[0].body.properties.state, "Disabled");
  assert.ok(f.cleared);
});

test("October migration refuses absent/old/current, policy and preserved drift, never retries ambiguous writes", async () => {
  for (const options of [{ absent: true }, { legacy: true }, { repaired: true }, { priorWeek: true }, {},
    ...[w => { w.properties.state = "Enabled"; }, w => { w.properties.accessControl.triggers.sasAuthenticationPolicy.state = "Enabled"; },
      w => { w.properties.parameters.targets = { value: { people: targets } }; }, w => { w.properties.definition.actions.Extra = {}; },
      w => { w.properties.accessControl.triggers.openAuthenticationPolicies.policies.OwnerOnly.claims = []; }]
      .map(mutate => ({ september: true, intercept: ({ id, resource }) => { if (id === logicUrl(workflowId)) mutate(resource); } }))]) {
    const f = fake(options); await assert.rejects(updateOctober(f.b, targets));
    assert.ok(f.calls.every(c => c.method === "GET")); assert.ok(f.cleared);
  }
  for (const mode of ["version", "owner", "connector", "invitation", "post", "ambiguous", "conflict"]) {
    let reads = 0;
    const f = fake({ september: true, intercept: ({ method, id, resource, calls }) => {
      if (id === logicUrl(workflowId) && method === "GET" && ++reads === 2 && mode === "version") resource.properties.version = "changed";
      if (id === logicUrl(ownerId) && mode === "owner" && calls.filter(c => c.id === id).length === 2) return { status: 200, data: { ...buildOwnerWorkflow(caller), etag: "changed" } };
      if ((mode === "connector" && id.startsWith(connectionId) || mode === "invitation" && id === logicUrl(invitationId)) && calls.filter(c => c.id === id).length === 2) return { status: 200, data: {} };
      if (method === "PUT" && mode === "ambiguous") throw new Error("PRIVATE");
      if (method === "PUT" && mode === "conflict") return { status: 412 };
      if (id === logicUrl(workflowId) && method === "GET" && reads === 3 && mode === "post") resource.tags.extra = true;
    } });
    await assert.rejects(updateOctober(f.b, targets));
    assert.equal(f.calls.filter(c => c.method === "PUT").length, ["version", "owner", "connector", "invitation"].includes(mode) ? 0 : 1);
    assert.equal(f.calls.filter(c => c.auth || c.method === "POST").length, 0); assert.ok(f.cleared);
  }
});

test("October transport accepts one exact v5 only and cannot enable, invoke, create another resource or widen dates", async () => {
  const claims = { oid: caller, tid: scope.tenant, iss: `https://sts.windows.net/${scope.tenant}/`, appid: scope.application, aud: scope.audience, exp: 9999999999 };
  const token = `h.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.s`; let calls = 0;
  const b = await availabilityBackend(undefined, "october", targets,
    async args => args.includes("get-access-token") ? token : args[0] === "ad" ? caller : { tenant: scope.tenant, state: "Enabled" },
    async () => { calls++; return { status: 200 }; });
  for (const id of [logicUrl(ownerId), logicUrl(invitationId), connectionId]) await assert.rejects(b.arm("PUT", id, buildOctoberAvailability(caller, targets)));
  for (const factory of [buildAvailability, buildPriorWeekAvailability, buildRepairedAvailability]) await assert.rejects(b.arm("PUT", logicUrl(workflowId), factory(caller, targets)));
  const wide = buildOctoberAvailability(caller, targets); wide.properties.definition.actions.Get_schedule.inputs.body.endTime.dateTime = "2026-10-16T16:00:00";
  await assert.rejects(b.arm("PUT", logicUrl(workflowId), wide));
  for (const suffix of ["/enable", "/disable", "/triggers/manual/listCallbackUrl"]) await assert.rejects(b.arm("POST", logicUrl(workflowId, suffix)));
  await assert.rejects(b.invoke(callback, "valid"));
  await b.arm("PUT", logicUrl(workflowId), buildOctoberAvailability(caller, targets));
  await assert.rejects(b.arm("PUT", logicUrl(workflowId), buildOctoberAvailability(caller, targets)));
  assert.equal(calls, 1); b.clear();
});