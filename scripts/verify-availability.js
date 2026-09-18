"use strict";
// ONLY the explicitly authorized once-only verification. No payload logging or
// file persistence. A future execution requires a new owner authorization.
const http = require("node:http");
const { randomUUID } = require("node:crypto");
const { inspectDisabled } = require("./availability");
const { preservedAfterLoad } = require("./owner-calendar");
const { project } = require("../owner/availability-core");
function localRequest(path, body, csrf) {
  if (!["/", "/api/status", "/api/availability", "/api/clear"].includes(path)) throw new Error("blocked");
  return new Promise((resolve,reject) => {
    const req = http.request({ hostname:"127.0.0.1",port:8002,path,method:body === undefined ? "GET" : "POST", signal:AbortSignal.timeout(450000),
      headers:{Host:"localhost:8002",...(body === undefined ? {} : {Origin:"http://localhost:8002","Content-Type":"application/json","X-Owner-CSRF":csrf})}},res=>{
      let text="",bytes=0; res.setEncoding("utf8");
      res.on("data",chunk=>{bytes+=Buffer.byteLength(chunk);if(bytes>64000){res.destroy();reject(new Error("bounded_response"));}else text+=chunk;});
      res.on("error",()=>reject(new Error("local_unavailable"))); res.on("end",()=>resolve({status:res.statusCode,text}));
    }); req.on("error",()=>reject(new Error("local_unavailable")));req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}
async function verifyOnce({ request = localRequest, inspect = inspectDisabled } = {}) {
  const report={status:"not_started",loadAttempted:false,slotCount:0,person0SlotCount:0,person1SlotCount:0,person0Success:false,person1Success:false,workflowDisabled:false,preservedResourcesUnchanged:false,sessionCleared:false,proxyIdle:false};
  let before,csrf;
  try {
    before=await inspect();const page=await request("/");
    if(page.status!==200 || !page.text.includes('name="owner-mode" content="live"') || !page.text.includes('id="availability-load"')) throw new Error();
    csrf=page.text.match(/name="owner-csrf" content="([a-f0-9]{64})"/)?.[1];if(!csrf)throw new Error();
    const idle=JSON.parse((await request("/api/status",{},csrf)).text);if(idle.status!=="idle" || idle.synthetic!==false)throw new Error();
    report.loadAttempted=true;
    let result=await request("/api/availability",{acknowledged:true,requestId:randomUUID(),refresh:true},csrf), body=JSON.parse(result.text);
    if(result.status!==200 || body.cleanup!=="workflow_disabled" || body.synthetic!==false || body.cached===true) {
      report.status=["expired","cleanup_failed","contract_drift","blocked","busy","unavailable"].includes(body.status)?body.status:"unavailable";
    } else {
      const data=project(body);report.slotCount=data.window.slots;report.person0Success=data.people[0].status==="checked";report.person1Success=data.people[1].status==="checked";
      report.person0SlotCount=data.people[0].slots.length;report.person1SlotCount=data.people[1].slots.length;
      report.status=report.person0Success && report.person1Success ? "checked" : "partial_or_unavailable";
    }
    result=undefined;body=undefined;
  } catch { report.status=report.loadAttempted?"unavailable":"preflight_failed"; }
  finally {
    if(csrf)try {
      const clear=await request("/api/clear",{},csrf);report.sessionCleared=clear.status===200 && JSON.parse(clear.text).status==="cleared";
      const idle=JSON.parse((await request("/api/status",{},csrf)).text);report.proxyIdle=idle.status==="idle" && idle.synthetic===false;
    } catch { report.sessionCleared=false; }
    csrf=undefined;
    try {const after=await inspect();report.workflowDisabled=true;report.preservedResourcesUnchanged=!!before && preservedAfterLoad(before,after);}
    catch {report.workflowDisabled=false;}
    before=undefined;
  }
  return report;
}
if(require.main===module)(async()=>{
  if(process.argv.length!==3 || process.argv[2]!=="--live-once")throw new Error();
  const report=await verifyOnce();console.log(JSON.stringify(report));
  if(report.status!=="checked" || !report.workflowDisabled || !report.preservedResourcesUnchanged || !report.sessionCleared || !report.proxyIdle)process.exitCode=1;
})().catch(()=>{console.error(JSON.stringify({status:"stopped",automaticRetry:false}));process.exitCode=1;});
module.exports={localRequest,verifyOnce};