"use strict";
// Operator-approved one-shot repair through the existing running server.
// No private-file access, parent requests, retry, direct provider IDs or payload logs.
const http = require("node:http");
const C = require("../owner/child-calendar-core");
const P = require("./windows-child-protocol");
const { createChildNativeAdapter } = require("./windows-child");
const dates = Object.freeze({ startDate: "2026-10-09", endDate: "2026-10-15" });
const paths = new Set(["/", "/api/status", "/api/child/find", "/api/child/review", "/api/child/import"]);
function requestLocal(path, body, csrf) {
  if (!paths.has(path)) throw Error("blocked");
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port: 8002, path,
      method: body === undefined ? "GET" : "POST", agent: false,
      signal: AbortSignal.timeout(["/api/child/find", "/api/child/import"].includes(path) ? 460000 : 10000),
      headers: { Host: "127.0.0.1:8002", ...(body === undefined ? {} : {
        Origin: "http://127.0.0.1:8002", "Content-Type": "application/json", "X-Owner-CSRF": csrf }) }
    }, res => {
      let text = "", bytes = 0;
      res.setEncoding("utf8");
      res.on("data", chunk => {
        bytes += Buffer.byteLength(chunk);
        if (bytes > C.maxBytes) res.destroy(Error("bounded_response")); else text += chunk;
      });
      res.on("error", () => reject(Error("local_unavailable")));
      res.on("end", () => resolve({ status: res.statusCode, text }));
    });
    req.on("error", () => reject(Error("local_unavailable")));
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}
const safeIdle = value => value.status === "idle" && value.synthetic === false &&
  value.execution === "windows-native-v1" && value.childExecution === P.protocol &&
  !value.cacheStatus && !value.childCacheStatus && !value.childSourceStatus &&
  ["not_requested", "workflow_disabled"].includes(value.cleanup);
async function enrollOnce({ request = requestLocal, inspect = () => createChildNativeAdapter().status(),
  approved = false, sourceName = "Kimi", progress = () => {} } = {}) {
  const report = { status: "not_approved", listSubmitted: false, importSubmitted: false,
    matches: 0, sourceCount: 0, listPartial: null, eventCount: null, partial: null,
    localIdle: false, disabledVerified: false, sourceRemembered: false, success: false, automaticRetry: false };
  // Name is the user's explicit NEW selection criterion, never a cache migration
  // or identity proof. Reuse after enrollment is by native caller-bound reference.
  if (approved !== true || sourceName !== "Kimi") return report;
  let csrf;
  const post = async (path, body) => {
    const response = await request(path, body, csrf);
    const data = JSON.parse(response.text);
    if (response.status !== 200) throw Error(P.codes.includes(data.status) ? data.status : "unavailable");
    return data;
  };
  try {
    report.status = "preflight_failed";
    const page = await request("/");
    const meta = name => page.text.match(new RegExp(`<meta name="${name}" content="([^"]+)">`))?.[1];
    csrf = meta("owner-csrf");
    if (page.status !== 200 || !C.handle(csrf) || meta("owner-mode") !== "live" ||
      meta("owner-cache") !== "disk" || meta("child-mode") !== C.contract ||
      meta("child-cache") !== "child-saved-v1-disk" || meta("child-sync") !== "child-sync-v1" ||
      !safeIdle(await post("/api/status", {}))) throw Error("blocked");
    report.listSubmitted = true; progress("listing");
    const listed = C.list(await post("/api/child/find", { acknowledged: true, ...dates }));
    report.sourceCount = listed.calendars.length; report.listPartial = listed.partial;
    const matches = listed.calendars.filter(source => source.name === sourceName);
    report.matches = matches.length;
    if (matches.length !== 1) {
      report.status = matches.length ? "source_ambiguous" : "source_not_matched";
      // Only sanitized source labels for necessary disambiguation, never handles.
      report.sourceNames = listed.calendars.map(source => source.name);
    } else {
      const source = matches[0];
      const review = await post("/api/child/review", { handle: source.handle, person: "Kimi",
        guardian: true, disclosure: "details", ...dates });
      if (!C.exact(review, ["token", "summary"]) || !C.handle(review.token) ||
        review.summary !== C.summary(source.name, "details", "disk")) throw Error("blocked");
      report.importSubmitted = true; progress("importing");
      const data = P.project(await post("/api/child/import", { token: review.token, confirmed: true }), "details");
      report.eventCount = data.events.length; report.partial = data.partial;
      // Current capability commits reference and snapshot before returning success.
      report.sourceRemembered = true; report.status = "imported";
    }
  } catch (error) { report.status = P.codes.includes(error.message) ? error.message : "unavailable"; }
  finally {
    if (csrf) try { report.localIdle = safeIdle(await post("/api/status", {})); } catch { /* Fail closed. */ }
    csrf = undefined;
    if (report.listSubmitted) try {
      progress("verifying_cleanup");
      const result = await inspect();
      const { execution, extensionsRemoved, automaticRetry, ...metadata } = result;
      P.validateReport(metadata, "status");
      report.disabledVerified = execution === P.protocol && extensionsRemoved === true && automaticRetry === false;
    } catch { /* Never retry listing/import or infer cleanup from local idle. */ }
  }
  report.success = report.status === "imported" && report.localIdle && report.disabledVerified;
  return report;
}
if (require.main === module) {
  if (process.argv.length !== 3 || process.argv[2] !== "--approved-enroll-once") {
    console.error("Explicit one-shot Kimi source selection, details import and retention approval required."); process.exitCode = 1;
  } else enrollOnce({ approved: true, progress: stage => console.log(JSON.stringify({ stage })) })
    .then(report => { console.log(JSON.stringify(report)); if (!report.success) process.exitCode = 1; })
    .catch(() => { console.error("Kimi enrollment unavailable; no automatic retry."); process.exitCode = 1; });
}
module.exports = { enrollOnce, requestLocal };