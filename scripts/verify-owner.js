"use strict";
// Explicit one-shot owner-authorized verification. Never print response bodies,
// tokens, CSRF values, calendar labels/keys/IDs, addresses or arbitrary errors.
const http = require("node:http");
const { randomUUID } = require("node:crypto");
const { ownerBackend, requireContract, preservedAfterLoad } = require("./owner-calendar");
const { preflight, requireOK, logicUrl } = require("./calendar-list");
const { workflowId } = require("../infra/calendar-list");
const { validList } = require("../owner/core");

async function inspectDisabled() {
  const backend = await ownerBackend(undefined, undefined, undefined, "status");
  try {
    const preserved = await preflight(backend);
    requireContract(requireOK(await backend.arm("GET", logicUrl(workflowId))), backend.caller, "Disabled");
    return preserved; // Private snapshot, compared in memory only.
  } finally { backend.clear(); }
}

function localRequest(path, body, csrf) {
  if (!["/", "/api/load", "/api/clear", "/api/status"].includes(path)) throw new Error("blocked");
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port: 8002, path, method: body === undefined ? "GET" : "POST",
      signal: AbortSignal.timeout(450000), headers: { Host: "localhost:8002",
        ...(body === undefined ? {} : { Origin: "http://localhost:8002", "Content-Type": "application/json", "X-Owner-CSRF": csrf }) }
    }, res => {
      let text = "", size = 0;
      res.setEncoding("utf8");
      res.on("data", chunk => {
        size += Buffer.byteLength(chunk);
        if (size > 200000) { res.destroy(); reject(new Error("bounded_response")); return; }
        text += chunk;
      });
      res.on("error", () => reject(new Error("local_unavailable")));
      res.on("end", () => resolve({ status: res.statusCode, text }));
    });
    req.on("error", () => reject(new Error("local_unavailable")));
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}

async function verifyOnce({ request = localRequest, inspect = inspectDisabled } = {}) {
  const report = { passed: false, loadAttempted: false, listValidated: false, count: 0, eventsRead: 0,
    workflowDisabled: false, preservedResourceContractsUnchanged: false, connectionTimestampChanged: false,
    sessionRevoked: false, proxyIdle: false };
  let csrf, before;
  try {
    before = await inspect();
    const page = await request("/");
    if (page.status !== 200 || !page.text.includes('name="owner-mode" content="live"')) throw new Error("not_live");
    csrf = page.text.match(/name="owner-csrf" content="([a-f0-9]{64})"/)?.[1];
    if (!csrf) throw new Error("no_session");
    const idle = JSON.parse((await request("/api/status", {}, csrf)).text);
    if (idle.status !== "idle" || idle.synthetic !== false) throw new Error("not_idle");
    report.loadAttempted = true;
    let result = await request("/api/load", { acknowledged: true, requestId: randomUUID() }, csrf);
    let data = JSON.parse(result.text);
    if (result.status !== 200 || data.synthetic !== false || !validList(data) ||
      data.calendars.some(c => Object.keys(c).sort().join() !== "key,name")) throw new Error("list_failed");
    report.listValidated = true; report.count = data.count;
    result = undefined; data = undefined;
  } catch { /* Fixed booleans only, including transport/parse failures. No retry. */ }
  finally {
    if (csrf) {
      try {
        const cleared = await request("/api/clear", {}, csrf);
        const data = JSON.parse(cleared.text);
        report.sessionRevoked = cleared.status === 200 && data.status === "cleared";
        const idle = JSON.parse((await request("/api/status", {}, csrf)).text);
        report.proxyIdle = idle.status === "idle" && idle.synthetic === false;
        // No second load as a revocation probe: /clear's tested contract revokes it.
      } catch { /* Cleanup cannot be inferred from an unavailable local service. */ }
    }
    csrf = undefined;
    try {
      const after = await inspect();
      report.workflowDisabled = true;
      report.preservedResourceContractsUnchanged = before !== undefined && preservedAfterLoad(before, after);
      report.connectionTimestampChanged = before !== undefined && before.connection?.properties?.changedTime !== after.connection?.properties?.changedTime;
    } catch { /* Never claim Disabled after a failed independent read. */ }
    before = undefined;
  }
  report.passed = report.listValidated && report.workflowDisabled && report.preservedResourceContractsUnchanged && report.sessionRevoked && report.proxyIdle;
  return report;
}

if (require.main === module) {
  (async () => {
    if (process.argv.length !== 3 || process.argv[2] !== "--live-once") throw new Error("approval_required");
    const report = await verifyOnce();
    console.log(JSON.stringify(report));
    if (!report.passed) process.exitCode = 1;
  })().catch(() => { console.error(JSON.stringify({ passed: false, unexpectedFailure: true })); process.exitCode = 1; });
}
module.exports = { verifyOnce, localRequest };