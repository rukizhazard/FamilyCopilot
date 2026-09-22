"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");

function auditFiles(root, files, terms) {
  if (!Array.isArray(terms) || !terms.length || terms.some(term => typeof term !== "string" || !term.trim())) {
    throw Error("Provide one or more non-empty review terms.");
  }
  root = fs.realpathSync(root);
  const needles = terms.map(term => term.toLowerCase());
  const matches = value => needles.some(term => value.toLowerCase().includes(term));
  const findings = [], binaryFiles = [], unreadableFiles = [], missingFiles = [];
  const sourceHash = createHash("sha256");
  let textFiles = 0;
  for (const file of [...new Set(files)].sort()) {
    const absolute = path.resolve(root, file);
    if (!absolute.startsWith(root + path.sep)) throw Error("File outside repository.");
    let metadata;
    try { metadata = fs.lstatSync(absolute); } catch (error) {
      if (error.code !== "ENOENT") throw error;
      missingFiles.push(file); continue;
    }
    if (!metadata.isFile() || fs.realpathSync(absolute) !== absolute) {
      unreadableFiles.push(file); continue;
    }
    const bytes = fs.readFileSync(absolute);
    const filenameMatch = matches(file);
    let text;
    try {
      if (bytes.includes(0)) throw Error("Binary file");
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      binaryFiles.push(file);
      if (filenameMatch) findings.push({ file, filenameMatch, lines: [] });
      continue;
    }
    textFiles++;
    if (/\.(?:js|cjs|mjs|json|html|css)$/.test(file)) {
      sourceHash.update(JSON.stringify([file, createHash("sha256").update(bytes).digest("hex")]) + "\n");
    }
    const lines = text.split(/\r?\n/).flatMap((line, index) => matches(line) ? [index + 1] : []);
    if (filenameMatch || lines.length) findings.push({ file, filenameMatch, lines });
  }
  return { textFiles, sourceSnapshotSha256: sourceHash.digest("hex"), findings, binaryFiles,
    unreadableFiles, missingFiles, binaryContentReviewed: false, historyReviewed: false };
}

module.exports = { auditFiles };
if (require.main === module) {
  try {
    const root = path.resolve(__dirname, "..");
    const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      { cwd: root, encoding: "utf8", timeout: 10000, maxBuffer: 8 * 1024 * 1024 }).split("\0").filter(Boolean);
    const result = auditFiles(root, files, process.argv.slice(2));
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.findings.length || result.unreadableFiles.length ? 1 : 0;
  } catch {
    console.error("Publication audit failed. Supply review terms and check repository access; no files were changed.");
    process.exitCode = 2;
  }
}