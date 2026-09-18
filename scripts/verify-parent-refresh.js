"use strict";
// Explicit one-shot October refresh through the running owner UI backend.
// No saved-file reads, cached fallback, destructive clear, payload logs or retry.
const http = require("node:http");
const { randomUUID } = require("node:crypto");
const { busyOnly, codes } = require("./windows-owner-protocol");
const { createNativeAdapter } = require("./windows-owner");
function requestLocal(path, body, csrf) {
  if (!["/", "/api/status", "/api/availability"].includes(path)) throw Error("blocked");
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port: 8002, path,
      method: body === undefined ? "GET" : "POST", agent: false,
      signal: AbortSignal.timeout(path === "/api/availability" ? 460000 : 10000),
      headers: { Host: "127.0.0.1:8002", ...(body === undefined ? {} : {
        Origin: "http://127.0.0.1:8002", "Content-Type": "application/json", "X-Owner-CSRF": csrf }) }
    }, res => {
      let text = "", bytes = 0;
      res.setEncoding("utf8");
      res.on("data", chunk => {
        bytes += Buffer.byteLength(chunk);
        if (bytes > 128 * 1024) res.destroy(Error("bounded_response")); else text += chunk;
      });
      res.on("error", () => reject(Error("local_unavailable")));
      res.on("end", () => resolve({ status: res.statusCode, text }));
    });
    req.on("error", () => reject(Error("local_unavailable")));
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}
async function verifyRefresh({ request = requestLocal, inspect = () => createNativeAdapter().status() } = {}) {
  const report = { status: "preflight_failed", refreshSubmitted: false, httpStatus: null,
    cached: null, mikeChecked: false, debbyChecked: false, slotCounts: [],
    cleanup: "not_requested", localIdle: false, disabledVerified: false,
    preservedResourcesUnchanged: false, success: false, automaticRetry: false };
  let csrf;
  try {
    const page = await request("/");
    const meta = name => page.text.match(new RegExp(`<meta name="${name}" content="([^"]+)">`))?.[1];
    csrf = meta("owner-csrf");
    if (page.status !== 200 || !/^[a-f0-9]{64}$/.test(csrf || "") || meta("owner-mode") !== "live" ||
      meta("owner-cache") !== "disk" || meta("owner-contract") !== "bounded-availability-v5" ||
      meta("owner-range") !== "configurable-v1" || meta("owner-saved") !== "preserve-v1") throw Error("blocked");
    const idle = await request("/api/status", {}, csrf), before = JSON.parse(idle.text);
    if (idle.status !== 200 || before.status !== "idle" || before.synthetic !== false || before.cacheStatus ||
      !["not_requested", "workflow_disabled"].includes(before.cleanup)) throw Error("blocked");
    report.refreshSubmitted = true;
    const response = await request("/api/availability", { acknowledged: true, refresh: true,
      startDate: "2026-10-09", endDate: "2026-10-15", requestId: randomUUID() }, csrf);
    report.httpStatus = response.status;
    const body = JSON.parse(response.text);
    report.cleanup = ["not_requested", "workflow_disabled", "cleanup_pending", "cleanup_failed"].includes(body.cleanup) ? body.cleanup : "unconfirmed";
    if (response.status !== 200 || body.synthetic !== false || body.cached !== false || body.cleanup !== "workflow_disabled") {
      report.status = codes.includes(body.status) ? body.status : "unavailable";
    } else {
      const data = busyOnly({ window: body.window, checkedAt: body.checkedAt, people: body.people });
      report.cached = false;
      report.mikeChecked = data.people[0].status === "checked";
      report.debbyChecked = data.people[1].status === "checked";
      report.slotCounts = data.people.map(person => person.slots.length);
      report.status = report.mikeChecked && report.debbyChecked ? "checked" : "partial_or_unavailable";
    }
  } catch { report.status = report.refreshSubmitted ? "unavailable" : "preflight_failed"; }
  finally {
    if (csrf) try {
      const response = await request("/api/status", {}, csrf), after = JSON.parse(response.text);
      report.localIdle = response.status === 200 && after.status === "idle" && after.synthetic === false && !after.cacheStatus &&
        ["not_requested", "workflow_disabled"].includes(after.cleanup);
    } catch { /* No cleanup or retry is inferred from transport failure. */ }
    csrf = undefined;
    if (report.refreshSubmitted) try {
      const after = await inspect();
      report.disabledVerified = after.status === "disabled_verified" && after.execution === "windows-native-v1" &&
        after.availabilityV5Disabled === true && after.ownerV2Disabled === true && after.sasDisabled === true && after.extensionsRemoved === true;
      report.preservedResourcesUnchanged = after.preservedResourcesUnchanged === true && after.connectorConnected === true &&
        after.invitationDisabled === true && after.deliveryOff === true;
    } catch { /* Independent readback failure is not successful cleanup. */ }
  }
  report.success = report.status === "checked" && report.localIdle && report.disabledVerified && report.preservedResourcesUnchanged;
  return report;
}
if (require.main === module) {
  if (process.argv.length !== 3 || process.argv[2] !== "--approved-live-once") {
    console.error("Explicit one-shot parent refresh approval required."); process.exitCode = 1;
  } else verifyRefresh().then(report => { console.log(JSON.stringify(report)); if (!report.success) process.exitCode = 1; })
    .catch(() => { console.error("Parent refresh verification unavailable; no automatic retry."); process.exitCode = 1; });
}
module.exports = { requestLocal, verifyRefresh };