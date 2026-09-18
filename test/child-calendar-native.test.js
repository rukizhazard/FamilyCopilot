"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { cliScript, nativeRead } = require("../scripts/child-calendar-native");
const { safeReport } = require("../scripts/child-calendar-native-preflight");
test("native launcher waits for the Electron runtime before reporting exit", () => {
  const script = require("node:fs").readFileSync(require("node:path").join(__dirname, "../scripts/child-calendar-native.ps1"), "utf8");
  assert.match(script, /\$Mode \| Out-String\s+\$result = \$LASTEXITCODE/);
});
test("native CLI accepts exactly the metadata credential reads and rejects arbitrary commands", () => {
  const script = cliScript(["ad", "signed-in-user", "show", "--query", "id"]);
  assert.match(script, /az\.cmd/); assert.match(script, /exit \$LASTEXITCODE/);
  for (const args of [["login"], ["ad", "signed-in-user", "show", "--query", "id; evil"], ["rest"], ["account", "get-access-token"]]) assert.throws(() => cliScript(args), /blocked/);
});
test("native metadata report cannot emit identifiers, arbitrary errors or unexpected fields", () => {
  const base = { status: "preflight_blocked", stage: "signed_in_user", code: "unavailable", calendarQueries: 0, cloudChanges: false, automaticRetry: false };
  assert.deepEqual(safeReport(JSON.stringify(base)), base);
  for (const extras of [{ token: "PRIVATE" }, { code: "PRIVATE" }, { stage: "PRIVATE" }, { calendarQueries: 1 }, { httpGetCalendarCandidate: "PRIVATE" }, { nodeMajor: "PRIVATE" }]) assert.throws(() => safeReport(JSON.stringify({ ...base, ...extras })));
  assert.throws(() => safeReport("PRIVATE\n" + JSON.stringify(base)));
});
test("Linux cannot use nativeRead to export credentials across the OS boundary", { skip: process.platform === "win32" }, async () => {
  await assert.rejects(nativeRead(["ad", "signed-in-user", "show", "--query", "id"]), /blocked/);
});
test("native success reports require exact evidence rather than a status alone", () => {
  for (const data of [
    { status: "metadata_inspected", calendarQueries: 0, cloudChanges: false },
    { status: "native_runtime_ready", nativeWindows: false, nodeMajor: 24, calendarQueries: 0, cloudChanges: false },
    { status: "preflight_blocked", stage: "", code: "", calendarQueries: 0, cloudChanges: false, automaticRetry: false }
  ]) assert.throws(() => safeReport(JSON.stringify(data)));
});
test("synthetic child review permits alternate isolated ports but never protected ports or live mode", () => {
  const { reviewPort } = require("../scripts/serve-child-review");
  assert.equal(reviewPort(["--synthetic"]), 8021);
  assert.equal(reviewPort(["--synthetic", "--port=8022"]), 8022);
  for (const args of [[], ["--live"], ["--synthetic", "--port=8002"], ["--synthetic", "--port=8019"], ["--synthetic", "--port=65536"], ["--synthetic", "--port=8022", "extra"]]) assert.throws(() => reviewPort(args));
});