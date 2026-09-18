"use strict";
// Offline revision of an already composited video; never opens a browser or network.
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const root = path.resolve(__dirname, "..");
function transitionPlan(clickRelease, previous, seconds = 1) {
  assert(Number.isFinite(clickRelease) && clickRelease > 0);
  assert(Number.isFinite(seconds) && seconds >= 0.04 && seconds <= 2);
  assert(Number.isFinite(previous.start) && Number.isFinite(previous.end) && previous.end > previous.start);
  const start = Math.ceil(clickRelease * 25 - 1e-8) / 25;
  const end = (Math.round(start * 25) + Math.round(seconds * 25)) / 25;
  assert(end <= previous.start, "Revised site reveal must precede the old handoff");
  return { start, end, officialStart: previous.start, repairEnd: previous.end,
    holdSeconds: Number((previous.start - end).toFixed(8)) };
}
function transitionFilter(plan) {
  // Hold the verified settled site frame across the entire superseded wait.
  return `[1:v]trim=start=${plan.officialStart},trim=end_frame=1,setpts=PTS-STARTPTS,` +
    `crop=1706:960:107:0,setpts=PTS+${plan.end}/TB[site];` +
    `[0:v][site]overlay=x=107:y=0:eof_action=repeat:enable='gte(t,${plan.end})*lt(t,${plan.repairEnd})'[restored];` +
    `[restored]drawbox=x=107:y=0:w=1706:h=960:color=white:t=fill:enable='gte(t,${plan.start})*lt(t,${plan.end})'[v]`;
}
function main(finalDirectory, loadingDirectory, cleanDirectory, clickRelease) {
  const dirs = [finalDirectory, loadingDirectory, cleanDirectory].map(value => {
    const directory = fs.realpathSync(path.resolve(value));
    assert(directory.startsWith(path.join(root, "browser-artifacts/demo/updated-ux-")));
    return directory;
  });
  const [source, previous, clean] = dirs;
  const old = JSON.parse(fs.readFileSync(path.join(previous, "verification.json")));
  assert.equal(old.simulatedLoading, true);
  const name = "familycopilot-updated-ux.mp4", srt = "familycopilot-updated-ux.en.srt";
  const input = path.join(source, name), original = path.join(clean, name);
  const hash = file => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  assert.equal(hash(original), old.sourceVideoHash, "Clean footage must match the prior loading edit");
  const plan = transitionPlan(Number(clickRelease), old.interval);
  const tools = process.env.FAMILYCOPILOT_DEMO_TOOLS; assert(tools && path.isAbsolute(tools));
  const ffmpeg = require(path.join(tools, "node_modules/ffmpeg-static"));
  const output = fs.mkdtempSync(path.join(path.dirname(source), "quick-loading-")); fs.chmodSync(output, 0o700);
  const run = (args, binary = false) => {
    const result = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-n", ...args],
      { cwd: output, encoding: binary ? null : "utf8", timeout: 300000, maxBuffer: 32768 });
    assert.equal(result.status, 0, String(result.stderr)); return binary ? result.stdout : result.stdout.trim();
  };
  run(["-i", input, "-i", original, "-filter_complex", transitionFilter(plan), "-map", "[v]", "-map", "0:a:0",
    "-c:v", "libx264", "-preset", "fast", "-crf", "19", "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", name]);
  run(["-i", name, "-f", "null", "-"]);
  const audioHash = file => run(["-i", file, "-map", "0:a:0", "-f", "hash", "-hash", "sha256", "-"]);
  assert.equal(audioHash(input), audioHash(name));
  fs.copyFileSync(path.join(source, srt), path.join(output, srt), fs.constants.COPYFILE_EXCL);
  for (const [label, time] of [["click", plan.start - .04], ["white-start", plan.start],
    ["white-end", plan.end - .04], ["site-start", plan.end], ["old-white-removed", plan.officialStart + 1],
    ["rejoin", plan.repairEnd]])
    run(["-ss", String(time), "-i", name, "-frames:v", "1", `review-${label}.png`]);
  // Verify every expected white frame (25 frames), plus non-white boundary frames.
  const whites = run(["-ss", String(plan.start), "-i", name, "-t", String(plan.end - plan.start),
    "-vf", "crop=1706:960:107:0,scale=1:1", "-pix_fmt", "rgb24", "-f", "rawvideo", "-"], true);
  assert.equal(whites.length, Math.round((plan.end - plan.start) * 25) * 3);
  assert(whites.every(value => value >= 250), "Loading must stay white for exactly the requested interval");
  for (const time of [plan.start - .04, plan.end, plan.officialStart + 1]) {
    const pixel = run(["-ss", String(time), "-i", name, "-frames:v", "1", "-vf",
      "crop=1706:960:107:0,scale=1:1", "-pix_fmt", "rgb24", "-f", "rawvideo", "-"], true);
    assert(pixel.some(value => value < 250), "Content must be visible outside the white interval");
  }
  const report = { output: path.relative(root, output), plan, simulatedLoading: true,
    clickTimingEvidence: `Recorded cursor release at ${clickRelease}s, inspected at 25 fps`,
    officialFrameHeldAcrossSupersededWait: true,
    networkRequests: 0, audioUnchanged: true, subtitleTimingUnchanged: true, decodePassed: true, whiteFramesVerified: whites.length / 3,
    sourceVideoHash: hash(input), cleanVideoHash: hash(original) };
  fs.writeFileSync(path.join(output, "verification.json"), JSON.stringify(report, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify(report));
}
if (require.main === module) {
  const [mode, ...args] = process.argv.slice(2);
  assert(mode === "--offline" && args.length === 4, "Expected --offline final-dir previous-loading-dir clean-dir click-release-seconds");
  main(...args);
}
module.exports = { transitionPlan, transitionFilter };