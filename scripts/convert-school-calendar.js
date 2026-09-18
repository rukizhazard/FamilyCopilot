"use strict";
// Reusable offline conversion of reviewed, source-linked selections, not an
// automatic classifier. The source PDF is hashed locally and never uploaded.
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { validate, toIcs } = require("../owner/school-calendar-core");
function convert(sourcePath, reviewedPath, outputDirectory) {
  const stat = fs.statSync(sourcePath);
  if (!stat.isFile() || stat.size > 20 * 1024 * 1024) throw new Error("invalid_source_pdf");
  const pdf = fs.readFileSync(sourcePath);
  if (pdf.subarray(0, 5).toString() !== "%PDF-") throw new Error("invalid_source_pdf");
  const reviewedStat = fs.statSync(reviewedPath);
  if (!reviewedStat.isFile() || reviewedStat.size > 64 * 1024) throw new Error("invalid_reviewed_calendar");
  const reviewed = JSON.parse(fs.readFileSync(reviewedPath, "utf8"));
  const hash = createHash("sha256").update(pdf).digest("hex");
  if (reviewed.source?.sha256 !== hash) throw new Error("source_changed_review_required");
  const calendar = validate(reviewed);
  const outputs = [["school-family.json", JSON.stringify(calendar, null, 2) + "\n"], ["school-family.ics", toIcs(calendar)]];
  // Preflight both targets before creating either, including dangling symlinks.
  for (const [file] of outputs) {
    try { fs.lstatSync(path.join(outputDirectory, file)); }
    catch (e) { if (e.code === "ENOENT") continue; throw e; }
    throw Object.assign(new Error("output_exists"), { code: "EEXIST" });
  }
  fs.mkdirSync(outputDirectory, { recursive: true, mode: 0o700 });
  const created = [];
  try {
    for (const [file, content] of outputs) {
      const target = path.join(outputDirectory, file);
      const fd = fs.openSync(target, "wx", 0o600);
      created.push(target);
      try { fs.writeFileSync(fd, content); } finally { fs.closeSync(fd); }
    }
  } catch (error) {
    for (const target of created) fs.unlinkSync(target);
    throw error;
  }
  return { status: "converted_locally", events: calendar.events.length, files: outputs.map(([name]) => name), networkUsed: false };
}
if (require.main === module) {
  if (process.argv.length !== 5) { console.error("Usage: node scripts/convert-school-calendar.js SOURCE.pdf REVIEWED.json OUTPUT_DIRECTORY"); process.exitCode = 1; }
  else try { console.log(JSON.stringify(convert(...process.argv.slice(2)))); }
  catch (e) { console.error(["source_changed_review_required", "invalid_source_pdf", "invalid_reviewed_calendar"].includes(e.message) ? e.message : "conversion_failed; existing files are never overwritten"); process.exitCode = 1; }
}
module.exports = { convert };