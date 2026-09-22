"use strict";
// Bounded, offline activity regression set. Never invoke the known-hanging full suite.
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const files = ["app", "activity-preview", "activity-preview-ui", "basketball", "basketball-ui", "basketball-teams", "date-selection", "shell", "activity-activation", "activity-search-server", "chat-activity-search", "activity-cards"].map(name => `test/${name}.test.js`);
const result = spawnSync(process.execPath, ["--test", ...files], {
  cwd: path.join(__dirname, ".."), env: process.env, encoding: "utf8", timeout: 120000, maxBuffer: 8 * 1024 * 1024
});
const lines = `${result.stdout || ""}\n${result.stderr || ""}`.split(/\r?\n/);
console.log(`Command: node --test ${files.join(" ")}`);
console.log(`TZ: ${process.env.TZ || "system default"}`);
for (let i = 0; i < lines.length; i++) {
  if (/^not ok /.test(lines[i])) console.log(lines.slice(i, Math.min(i + 30, lines.length)).join("\n"));
  if (/^# (tests|pass|fail|cancelled|skipped|todo|duration_ms) /.test(lines[i])) console.log(lines[i]);
}
if (result.error) console.error(`Runner error: ${result.error.message}`);
console.log(`Exit: ${result.status ?? "incomplete"}`);
if (!lines.some(line => /^# tests /.test(line))) console.error(lines.slice(-40).join("\n"));
process.exitCode = result.status === 0 && !result.error ? 0 : 1;