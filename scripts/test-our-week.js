"use strict";
// Bounded offline UI/pure/store checks only. No server, provider, private file or
// inherited credential environment. Disk fixtures use disposable temp directories.
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const files = ["app", "availability-ui", "child-calendar-ui", "child-calendar", "owner-presentation",
  "school-calendar-ui", "school-calendar", "date-selection", "availability-disk-cache", "our-week"];
let failed = false;
for (const timezone of ["UTC", "America/Los_Angeles", "Asia/Taipei"]) {
  for (const [label, args] of [
    ["focused", ["--test", ...files.map(name => `test/${name}.test.js`)]],
    // These two October tests do not open HTTP listeners. Do not run its server cases.
    ["October non-server", ["--test", "--test-name-pattern=^October (is the empty-tab|rejects foreign)", "test/october-demo.test.js"]]
  ]) {
    const result = spawnSync(process.execPath, args, { cwd: path.resolve(__dirname, ".."), env: { TZ: timezone },
      encoding: "utf8", timeout: 60000, killSignal: "SIGKILL", maxBuffer: 4 * 1024 * 1024 });
    const output = `${result.stdout || ""}\n${result.stderr || ""}`;
    console.log(`${timezone} · ${label}`);
    const lines = output.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (/^# (tests|pass|fail|cancelled|skipped|todo|duration_ms)\b/.test(lines[i])) console.log(lines[i]);
      if (/^not ok\b/.test(lines[i])) {
        let end = i + 1;
        while (end < lines.length && !/^(?:not )?ok \d+|^# Subtest:/.test(lines[end])) end++;
        console.log(lines.slice(i, Math.min(end, i + 55)).join("\n"));
      }
    }
    console.log(`exit=${result.status}; timedOut=${result.error?.code === "ETIMEDOUT"}`);
    if (result.status !== 0 || result.error) { failed = true; break; }
  }
  if (failed) break; // No automatic retry of failures/timeouts.
}
process.exitCode = failed ? 1 : 0;