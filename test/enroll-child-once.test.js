"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { enrollOnce, requestLocal } = require("../scripts/enroll-child-once");
const C = require("../owner/child-calendar-core");
const h = "a".repeat(64), token = "b".repeat(64);
const idle = { status: "idle", synthetic: false, cleanup: "not_requested", execution: "windows-native-v1", childExecution: "windows-child-v1" };
const metadata = { status: "child_ready", httpGetCalendarCandidate: true, nativeViewCandidate: false,
  sasDisabled: true, preservedResourcesUnchanged: true, calendarQueries: 0, cloudChanges: false,
  runtimeVerified: false, execution: "windows-child-v1", extensionsRemoved: true, automaticRetry: false };
function fixture(options = {}) {
  const calls = []; let inspected = 0;
  const data = { contract: C.contract, window: C.window, checkedAt: new Date().toISOString(), partial: false,
    events: [{ title: "Never log this event", start: "2026-10-09T01:00:00Z", end: "2026-10-09T02:00:00Z", allDay: false, status: "scheduled", kind: "singleInstance", redacted: false }] };
  const request = async (path, body, csrf) => {
    calls.push({ path, body });
    if (path !== "/") assert.equal(csrf, h);
    let response;
    if (path === "/") return { status: 200, text: Object.entries({ "owner-csrf": h, "owner-mode": "live", "owner-cache": "disk", "child-mode": C.contract, "child-cache": "child-saved-v1-disk", "child-sync": "child-sync-v1", ...options.meta }).map(([k,v]) => `<meta name="${k}" content="${v}">`).join("") };
    if (path === "/api/status") response = { ...idle, ...options.status };
    else if (path.endsWith("/find")) response = { calendars: options.sources || [{ name: "Kimi", handle: h }], partial: true };
    else if (path.endsWith("/review")) response = { token, summary: options.summary ?? C.summary("Kimi", "details", "disk") };
    else if (path.endsWith("/import")) {
      if (options.failure) return { status: 503, text: JSON.stringify({ status: options.failure }) };
      response = options.data || data;
    } else throw Error("unexpected_request");
    return { status: 200, text: JSON.stringify(response) };
  };
  return { calls, run: (extra = {}) => enrollOnce({ approved: true, request, inspect: async () => { inspected++; if(options.cleanupFailure) throw Error(); return metadata; }, ...extra }), inspected: () => inspected };
}
test("inert unless explicitly approved and exact requested label; request allowlist excludes saved/clear/parent", async () => {
  const f=fixture(); assert.equal((await f.run({approved:false})).status,"not_approved");
  await f.run({sourceName:"Other"}); assert.equal(f.calls.length,0);
  for(const path of ["/api/clear","/api/child/saved","/api/availability","https://example.com"]) assert.throws(()=>requestLocal(path));
});
test("one exact source uses reviewed token, fixed details/window; output contains counts only", async () => {
  const f=fixture(), r=await f.run(); assert.equal(r.success,true); assert.equal(r.sourceRemembered,true); assert.equal(r.eventCount,1);
  assert.equal(f.inspected(),1);
  assert.deepEqual(f.calls.map(c=>c.path),["/","/api/status","/api/child/find","/api/child/review","/api/child/import","/api/status"]);
  assert.deepEqual(f.calls[3].body,{handle:h,person:"Kimi",guardian:true,disclosure:"details",startDate:"2026-10-09",endDate:"2026-10-15"});
  assert.deepEqual(f.calls[4].body,{token,confirmed:true});
  for(const secret of [h,token,"Never log", "2026-10-09T01"]) assert.equal(JSON.stringify(r).includes(secret),false);
});
test("missing, case variant or duplicate source never guesses or imports", async () => {
  for(const sources of [[],[{name:"kimi",handle:h}],[{name:"Kimi",handle:h},{name:"Kimi",handle:token}]]) {
    const f=fixture({sources}),r=await f.run(); assert.equal(r.importSubmitted,false); assert.equal(r.success,false);
    assert.equal(f.calls.some(c=>c.path.endsWith("/review")),false); assert.equal(f.inspected(),1);
    assert.equal(JSON.stringify(r).includes(h),false);
  }
});
test("bad capability or unsafe idle blocks listing", async () => {
  for(const options of [{meta:{"child-sync":"CHILD_SYNC"}},{status:{status:"busy"}},{status:{childSourceStatus:"child_source_invalid"}}]) {
    const f=fixture(options),r=await f.run(); assert.equal(r.listSubmitted,false); assert.equal(f.inspected(),0);
  }
});
test("inexact review prevents import; independent cleanup still runs", async () => {
  const f=fixture({summary:"wrong"}),r=await f.run(); assert.equal(r.importSubmitted,false); assert.equal(f.inspected(),1);
});
test("failed import has no retry or cached fallback", async () => {
  const f=fixture({failure:"unavailable"}),r=await f.run(); assert.equal(r.success,false);assert.equal(r.sourceRemembered,false);
  assert.equal(f.calls.filter(c=>c.path.endsWith("/import")).length,1); assert.equal(f.inspected(),1);
});
test("independent cleanup uncertainty prevents success", async () => {
  const f=fixture({cleanupFailure:true}),r=await f.run(); assert.equal(r.success,false);assert.equal(r.disabledVerified,false);
});
test("private title leak is rejected and never printed", async () => {
  const f=fixture({data:{invalid:"secret"}}),r=await f.run();assert.equal(r.success,false);assert.equal(r.sourceRemembered,false);
  assert.equal(JSON.stringify(r).includes("secret"),false);
});