"use strict";
// Re-encode only an existing synthetic recording. No servers or provider calls.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const root = path.resolve(__dirname, "..");

function run(ffmpeg, args) {
  const result = spawnSync(ffmpeg, ["-nostdin", "-hide_banner", "-loglevel", "error", "-n", ...args], {
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
  const chat = fs.existsSync(path.join(directory, "manifest.json"));
  const reportFile = localFile(chat ? "manifest.json" : "verification.json");
  const report = JSON.parse(fs.readFileSync(reportFile, "utf8"));
  if (chat) {
    assert(report.syntheticChat === true && report.decodePassed === true && report.calendarRequests === 0 && report.publicSearches === 0,
      "Only verified synthetic chat recordings are supported.");
  } else {
    assert(report.syntheticOnly === true && report.privateStorageUsed === false && report.liveServicesTouched === false,
      "Only verified synthetic recordings are supported.");
  }
  const tools = process.env.FAMILYCOPILOT_DEMO_TOOLS;
  assert(tools && path.isAbsolute(tools), "Set FAMILYCOPILOT_DEMO_TOOLS to the isolated media tools directory.");
  const ffmpeg = require(path.join(tools, "node_modules/ffmpeg-static"));
  const source = localFile(chat ? "familycopilot-chat-jenny.mp4" : "familycopilot-demo.mp4");
  const hash = file => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  const sourceHash = hash(source), reportHash = hash(reportFile);
  if (chat) assert.equal(sourceHash, report.videoSha256, "Source MP4 hash mismatch.");
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
  assert.equal(hash(source), sourceHash); assert.equal(hash(reportFile), reportHash);
  const captions = chat ? path.join(directory, "familycopilot-chat.en.srt") : path.join(directory, "familycopilot-demo.en.srt");
  if (fs.existsSync(captions)) fs.copyFileSync(captions, path.join(output, "familycopilot-demo.en.srt"), fs.constants.COPYFILE_EXCL);
  fs.writeFileSync(path.join(output, "manifest.json"), JSON.stringify({
    source: path.relative(root, source), sourceSha256: sourceHash, sourceManifestSha256: reportHash,
    decodePassed: true, originalPreserved: true, newSynthesisRequests: 0,
    audioSampleRate: 48000, channels: 2, loudnessTargetLUFS: -16,
    humanAudition: "pending", playerCompatibility: "WebM Opus and PCM WAV alternatives; user playback unconfirmed",
    files: [mp4, webm, wav].map(file => ({ name: path.basename(file), sha256: hash(file) }))
  }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ output: path.relative(root, output), originalPreserved: true,
    syntheticOnly: true, audioSampleRate: 48000, channels: 2, loudnessTargetLUFS: -16,
    files: [mp4, webm, wav].map(file => ({ name: path.basename(file), bytes: fs.statSync(file).size })) }));
}

try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }