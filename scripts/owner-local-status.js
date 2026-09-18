"use strict";
// Metadata-only loopback inspection. Never queries Azure, calendars or snapshots,
// never clears anything, and never prints page contents or the in-memory CSRF.
const http = require("node:http");
function requestLocal(path, { method = "GET", body, headers = {} } = {}) {
  if (!["/", "/api/status"].includes(path)) return Promise.reject(new Error("blocked"));
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port: 8002, path, method,
      headers: { Host: "127.0.0.1:8002", ...headers }, signal: AbortSignal.timeout(10000), agent: false }, res => {
      let bytes = 0, text = "";
      res.on("data", chunk => {
        bytes += chunk.length;
        if (bytes > 128 * 1024) res.destroy(new Error("unavailable")); else text += chunk.toString("utf8");
      });
      res.on("error", reject); res.on("end", () => resolve({ status: res.statusCode, text }));
    });
    req.on("error", reject); req.end(body);
  });
}
async function inspectLocalOwner(request = requestLocal) {
  const page = await request("/");
  if (page.status !== 200) throw new Error("unavailable");
  const meta = name => page.text.match(new RegExp(`<meta name="${name}" content="([^"]+)">`))?.[1];
  const csrf = meta("owner-csrf"), mode = meta("owner-mode"), storage = meta("owner-cache");
  if (!/^[a-f0-9]{64}$/.test(csrf || "") || !["live", "synthetic"].includes(mode) || !["disk", "memory"].includes(storage)) throw new Error("unavailable");
  const response = await request("/api/status", { method: "POST", body: "{}", headers: {
    Origin: "http://127.0.0.1:8002", "Content-Type": "application/json", "X-Owner-CSRF": csrf
  } });
  if (response.status !== 200) throw new Error("unavailable");
  const data = JSON.parse(response.text);
    if (!["idle", "busy", "cleanup_failed", "cache_invalid", "cache_unavailable", "cache_clear_failed",
      "child_cache_invalid", "child_cache_unavailable", "child_cache_clear_failed",
      "child_source_invalid", "child_source_unavailable", "child_source_clear_failed"].includes(data?.status) ||
      !["not_requested", "workflow_disabled", "cleanup_pending", "cleanup_failed"].includes(data.cleanup) || data.synthetic !== (mode === "synthetic")) throw new Error("unavailable");
  const childProtocol = meta("child-mode") === "kimi-calendar-v1" && data.childExecution === "windows-child-v1";
  return { status: data.status, cleanup: data.cleanup, mode, storage,
    dateProtocol: meta("owner-range") === "configurable-v1",
    savedViewProtocol: meta("owner-saved") === "preserve-v1",
    octoberProtocol: meta("owner-contract") === "bounded-availability-v5",
    childProtocol,
    childSavedProtocol: childProtocol && meta("child-cache") === "child-saved-v1-disk",
    childSyncProtocol: childProtocol && meta("child-sync") === "child-sync-v1",
    safeIdle: data.status === "idle" && !data.cacheStatus && !data.childCacheStatus && !data.childSourceStatus && ["not_requested", "workflow_disabled"].includes(data.cleanup) && mode === "live" && storage === "disk" };
}
if (require.main === module) {
  if (process.argv.length !== 2) { console.error("No arguments accepted."); process.exitCode = 1; }
  else inspectLocalOwner().then(result => console.log(JSON.stringify(result))).catch(() => { console.error("Local owner status unavailable; no restart authorized by this check."); process.exitCode = 1; });
}
module.exports = { inspectLocalOwner };