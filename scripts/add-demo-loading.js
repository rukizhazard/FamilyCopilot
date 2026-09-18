"use strict";
// Explicitly simulated browser loading, applied offline to an existing edit.
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const root = path.resolve(__dirname, "..");
function loadingInterval(capture, seconds = 3) {
  assert(Number.isFinite(capture.captureStart) && Number.isFinite(capture.captureEnd) && capture.captureEnd > capture.captureStart);
  assert(Number.isFinite(seconds) && seconds > 0 && seconds <= 5);
  const startFrame = Math.ceil((15.2 + capture.captureEnd - capture.captureStart) * 25 - 1e-8);
  return { start: startFrame / 25, end: (startFrame + Math.round(seconds * 25)) / 25 };
}
function main(directory) {
  const source = path.resolve(directory);
  assert(source.startsWith(path.join(root, "browser-artifacts/demo/updated-ux-")));
  const captureDir = path.dirname(source);
  const capture = JSON.parse(fs.readFileSync(path.join(captureDir, "capture.json")));
  const interval = loadingInterval(capture);
  const input = path.join(source, "familycopilot-updated-ux.mp4");
  const output = fs.mkdtempSync(path.join(captureDir, "official-loading-")); fs.chmodSync(output, 0o700);
  const tools = process.env.FAMILYCOPILOT_DEMO_TOOLS; assert(tools && path.isAbsolute(tools));
  const ffmpeg = require(path.join(tools, "node_modules/ffmpeg-static"));
  const run = args => {
    const result = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-n", ...args],
      { cwd: output, encoding: "utf8", timeout: 300000, maxBuffer: 32768 });
    assert.equal(result.status, 0, result.stderr); return result.stdout.trim();
  };
  const name = "familycopilot-updated-ux.mp4";
  run(["-i", input, "-vf", `drawbox=x=107:y=0:w=1706:h=960:color=white:t=fill:enable='gte(t,${interval.start})*lt(t,${interval.end})'`,
    "-map", "0:v:0", "-map", "0:a:0", "-c:v", "libx264", "-preset", "fast", "-crf", "19", "-pix_fmt", "yuv420p",
    "-c:a", "copy", "-movflags", "+faststart", name]);
  run(["-i", name, "-f", "null", "-"]);
  const audioHash = file => run(["-i", file, "-map", "0:a:0", "-f", "hash", "-hash", "sha256", "-"]);
  assert.equal(audioHash(input), audioHash(name));
  const srt = "familycopilot-updated-ux.en.srt";
  fs.copyFileSync(path.join(source, srt), path.join(output, srt), fs.constants.COPYFILE_EXCL);
  for (const [label, time] of [["click", interval.start - 0.08], ["loading", interval.start + 1],
    ["loading-end", interval.end - 0.04], ["revealed", interval.end + 0.04]])
    run(["-ss", String(time), "-i", name, "-frames:v", "1", `review-${label}.png`]);
  const report = { output: path.relative(root, output), simulatedLoading: true, interval, networkRequests: 0,
    calendarRetake: false, audioUnchanged: true, subtitleTimingUnchanged: true, decodePassed: true,
    sourceVideoHash: createHash("sha256").update(fs.readFileSync(input)).digest("hex") };
  fs.writeFileSync(path.join(output, "verification.json"), JSON.stringify(report, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify(report));
}
if (require.main === module) {
  const [mode, directory] = process.argv.slice(2);
  assert(mode === "--offline" && directory, "Explicit --offline source-edit-directory required");
  main(directory);
}
module.exports = { loadingInterval };