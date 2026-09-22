"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { auditFiles } = require("../scripts/audit-publication");

test("publication audit reports case-insensitive text and paths without revealing matched content", context => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "publication-audit-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, "sample.js"), 'const label = "ExamplePerson";\n// EXAMPLEPERSON\n');
  fs.writeFileSync(path.join(root, "exampleperson.md"), "Neutral text\n");
  fs.writeFileSync(path.join(root, "reference.png"), Buffer.from([137, 80, 78, 71, 0]));
  fs.writeFileSync(path.join(root, "unlisted.txt"), "ExamplePerson must not be read");
  const files = ["sample.js", "exampleperson.md", "reference.png", "missing.js"];
  const report = auditFiles(root, files, ["exampleperson"]);
  assert.equal(report.textFiles, 2);
  assert.deepEqual(report.findings, [
    { file: "exampleperson.md", filenameMatch: true, lines: [] },
    { file: "sample.js", filenameMatch: false, lines: [1, 2] }
  ]);
  assert.deepEqual(report.binaryFiles, ["reference.png"]);
  assert.deepEqual(report.missingFiles, ["missing.js"]);
  assert.equal(report.binaryContentReviewed, false);
  assert.equal(report.historyReviewed, false);
  assert.doesNotMatch(JSON.stringify(report), /const label|must not be read|EXAMPLEPERSON/);
  assert.equal(auditFiles(root, files.reverse(), ["exampleperson"]).sourceSnapshotSha256, report.sourceSnapshotSha256);
  fs.appendFileSync(path.join(root, "sample.js"), "\n");
  assert.notEqual(auditFiles(root, files, ["exampleperson"]).sourceSnapshotSha256, report.sourceSnapshotSha256);
});

test("publication audit refuses path escapes, does not follow symlinks and requires review terms", context => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "publication-audit-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.symlinkSync("missing-private-file", path.join(root, "private-link"));
  assert.deepEqual(auditFiles(root, ["private-link"], ["exampleperson"]).unreadableFiles, ["private-link"]);
  assert.throws(() => auditFiles(root, ["../private.txt"], ["exampleperson"]), /outside repository/);
  for (const terms of [[], [""], [null]]) assert.throws(() => auditFiles(root, [], terms), /review terms/);
});