"use strict";
// Re-encode only an existing synthetic recording. No servers or provider calls.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");

function run(ffmpeg, args) {
  const result = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-n", ...args], {
    encoding: "utf8", timeout: 240000, maxBuffer: 1024 * 1024
  });
  if (result.error || result.signal || result.status !== 0) throw new Error("Demo audio conversion or validation failed; original files preserved.");
}

function main() {
  assert.equal(process.argv.length, 3, "Supply one existing synthetic recording directory.");
  const base = fs.realpathSync(path.join(root, "browser-artifacts/demo"));
  const directory = fs.realpathSync(path.resolve(root, process.argv[2]));
  const relative = path.relative(base, directory);
  assert(relative && !relative.startsWith("..") && !path.isAbsolute(relative), "Recording must be inside browser-artifacts/demo.");
  const localFile = name => {
    const file = path.join(directory, name), stat = fs.lstatSync(file);
    assert(stat.isFile() && !stat.isSymbolicLink(), "Only regular recording files are allowed.");
    return file;
  };
  const report = JSON.parse(fs.readFileSync(localFile("verification.json"), "utf8"));
  assert(report.syntheticOnly === true && report.privateStorageUsed === false && report.liveServicesTouched === false,
    "Only verified synthetic recordings are supported.");
  const tools = process.env.FAMILYCOPILOT_DEMO_TOOLS;
  assert(tools && path.isAbsolute(tools), "Set FAMILYCOPILOT_DEMO_TOOLS to the isolated media tools directory.");
  const ffmpeg = require(path.join(tools, "node_modules/ffmpeg-static"));
  const source = localFile("familycopilot-demo.mp4");
  const output = fs.mkdtempSync(path.join(directory, "audio-compatible-"));
  const wav = path.join(output, "familycopilot-narration.wav");
  const mp4 = path.join(output, "familycopilot-demo.mp4");
  const webm = path.join(output, "familycopilot-demo.webm");
  // Normalize once and reuse the same PCM track for both delivery formats.
  run(ffmpeg, ["-i", source, "-map", "0:a:0", "-vn", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
    "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", wav]);
  const inputs = ["-i", source, "-i", wav, "-map", "0:v:0", "-map", "1:a:0", "-shortest"];
  run(ffmpeg, [...inputs, "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
    "-disposition:a:0", "default", "-metadata:s:a:0", "language=eng", "-movflags", "+faststart", mp4]);
  run(ffmpeg, [...inputs, "-c:v", "libvpx-vp9", "-crf", "31", "-b:v", "0", "-deadline", "realtime", "-cpu-used", "6",
    "-row-mt", "1", "-c:a", "libopus", "-b:a", "128k", "-ar", "48000", "-ac", "2",
    "-disposition:a:0", "default", "-metadata:s:a:0", "language=eng", webm]);
  for (const file of [mp4, webm, wav]) run(ffmpeg, ["-i", file, "-f", "null", "-"]);
  console.log(JSON.stringify({ output: path.relative(root, output), originalPreserved: true,
    syntheticOnly: true, audioSampleRate: 48000, channels: 2, loudnessTargetLUFS: -16,
    files: [mp4, webm, wav].map(file => ({ name: path.basename(file), bytes: fs.statSync(file).size })) }));
}

try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }