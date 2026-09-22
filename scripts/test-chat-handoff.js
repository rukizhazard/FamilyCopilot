"use strict";
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { loadSnapshot, digest } = require("./demo-snapshot");
const { suites, run } = require("./test-workflow");
const root = path.resolve(__dirname, "..");

function verify(manifestFile, expectedSha256) {
  assert.match(expectedSha256, /^[a-f0-9]{64}$/, "Provide the reviewed snapshot SHA-256");
  const snapshot = loadSnapshot(manifestFile, expectedSha256);
  const testFiles = [...suites.chat, "test/fixtures/chat-context.js", "test/fixtures/our-week-harness.js",
    "scripts/test-workflow.js", "scripts/demo-snapshot.js", "scripts/test-chat-handoff.js", "scripts/test-chat-browser.js"];
  const testHashes = Object.fromEntries(testFiles.map(file => [file, digest(fs.readFileSync(path.join(root, file)))]));
  function unchanged() {
    loadSnapshot(manifestFile, expectedSha256);
    for (const [url, hash] of Object.entries(snapshot.manifest.sourceHashes)) {
      assert.equal(digest(fs.readFileSync(path.join(root, url.slice(1)))), hash, `Working asset differs from tested snapshot: ${url}`);
    }
    for (const [file, hash] of Object.entries(testHashes)) {
      assert.equal(digest(fs.readFileSync(path.join(root, file))), hash, `Test changed during verification: ${file}`);
    }
  }
  unchanged();
  const result = run(["chat"]);
  const directory = fs.mkdtempSync(path.join(root, "browser-artifacts/chat-handoff-"));
  const output = `${result.stdout || ""}${result.stderr || ""}${result.error || ""}`;
  fs.writeFileSync(path.join(directory, "unit-tests.txt"), output, { flag: "wx", mode: 0o600 });
  unchanged();
  const report = { snapshot: path.relative(root, path.resolve(manifestFile)), snapshotSha256: expectedSha256,
    sourceHashes: snapshot.manifest.sourceHashes, testHashes, command: "node scripts/test-workflow.js chat",
    files: result.files, exitCode: result.status, outputSha256: digest(Buffer.from(output)),
    sourceMatchedBeforeAndAfter: true, browser: "separate evidence required", recording: "not authorized by this check" };
  fs.writeFileSync(path.join(directory, "unit-report.json"), JSON.stringify(report, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ report: path.relative(root, path.join(directory, "unit-report.json")), exitCode: result.status,
    snapshotSha256: expectedSha256 }, null, 2));
  return result.status;
}

module.exports = { verify };
if (require.main === module) {
  try {
    assert.equal(process.argv.length, 4, "Use test-chat-handoff.js snapshot.json reviewed-sha256");
    process.exitCode = verify(process.argv[2], process.argv[3]);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}