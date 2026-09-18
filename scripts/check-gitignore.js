"use strict";
// Offline path-only check: no file contents, private data, network or index writes.
// Run from any directory: node scripts/check-gitignore.js
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const root = path.resolve(__dirname, "..");

function git(args, input) {
  const result = spawnSync("git", ["--no-optional-locks", "-C", root, ...args], {
    input, encoding: "utf8", timeout: 10000, maxBuffer: 4 * 1024 * 1024
  });
  if (result.error || result.signal || ![0, 1].includes(result.status) ||
      (result.status === 1 && args[0] !== "check-ignore")) {
    // Do not echo arbitrary process errors or output containing local paths.
    throw new Error("Git metadata check failed; no publication verdict available.");
  }
  return result.stdout.split("\0").filter(Boolean);
}

function ignored(paths) {
  if (!paths.length) return new Set();
  return new Set(git(["check-ignore", "--no-index", "-z", "--stdin"], paths.join("\0") + "\0"));
}

function main() {
  // These are hypothetical paths: do not create or read the named files.
  const privatePaths = [
    ".env", ".env.local", ".env.production", "owner/.env.development",
    ".npmrc", ".azure/msal_token_cache.json", ".msal/cache.json",
    ".ssh/id_ed25519", "secrets/client.json", "credentials/account.json",
    "local.settings.json", "keys/client.pem", "keys/client.key",
    "keys/client.p12", "keys/client.pfx", "id_rsa", "id_ed25519",
    "國小行事曆.pdf", "local-calendars/school-family.json",
    "local-calendars/school-family.reviewed.json", "local-calendars/school-family.ics",
    "private-data/source.pdf", "export.ics", "export.ical",
    "owner-availability.json", "backup/owner-availability.json.bak",
    ".owner-availability-synthetic.tmp",
    "child-calendar.json", "backup/child-calendar.json",
    "backup/child-calendar.json.bak", ".child-calendar-synthetic.tmp",
    "child-source.json", "backup/child-source.json",
    "backup/child-source.json.bak", ".child-source-synthetic.tmp",
    "node_modules/package/index.js",
    "dist-picker/main.js", "dist-picker-synthetic/main.js",
    ".venv/bin/python", "scripts/__pycache__/example.pyc", ".cache/session.json",
    "coverage/index.html", ".nyc_output/report.json", "debug-logs/session.json",
    "browser-artifacts/screenshot.png", "playwright-report/index.html",
    "test-results/trace.zip", "tmp/result.json", "temp/result.json",
    "session.log", "session.har", "output.tmp", ".DS_Store", "Thumbs.db",
    "app.js.swp", "app.js.swo"
  ];
  const publicPaths = [
    ".gitignore", ".env.example", ".env.sample", ".env.template",
    "picker/.env.example", "package.json", "package-lock.json", "README.md",
    ".vscode/tasks.json", ".github/agents/familycopilot-builder.agent.md",
    "app.js", "index.html", "styles.css", "shell.css",
    "owner/availability-core.js", "activity-preview/core.js",
    "picker/public-config.json", "infra/calendar-list.js",
    "scripts/check-gitignore.js", "scripts/availability-disk-cache.js",
    "scripts/child-calendar-disk-cache.js", "scripts/child-source-store.js",
    "test/child-calendar-cache.test.js", "test/child-source-store.test.js",
    "shared/date-selection.js", "browser-fixtures/availability.js",
    "test/app.test.js", "test/fixtures/activity-dom.js", "docs/local-school-calendar.md"
  ];
  const matches = ignored([...privatePaths, ...publicPaths]);
  const failures = [
    ...privatePaths.filter(file => !matches.has(file)).map(file => ({ reason: "not_ignored", file })),
    ...publicPaths.filter(file => matches.has(file)).map(file => ({ reason: "source_hidden", file }))
  ];
  // --no-index is essential: ordinary ignore checks silently skip tracked files.
  const tracked = git(["ls-files", "-z"]);
  for (const file of ignored(tracked)) failures.push({ reason: "tracked_despite_ignore", file });
  for (const failure of failures) console.log(JSON.stringify(failure));
  console.log(JSON.stringify({
    pathChecks: privatePaths.length + publicPaths.length,
    trackedFilesChecked: tracked.length, failures: failures.length,
    scope: "ignore_rules_only", contentScanned: false, historyScanned: false
  }));
  if (failures.length) process.exitCode = 1;
}

try { main(); }
catch (error) { console.error(error.message); process.exitCode = 1; }