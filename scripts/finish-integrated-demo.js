"use strict";
// Postproduction only. No app server imports, calendar access or public search.
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const crypto = require("node:crypto"), { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const source = path.join(root, "browser-artifacts/demo/integrated-20260918");
const storyRevision = ["--synthesize-story-approved", "--render-story-offline"].includes(process.argv[2]);
const output = path.join(source, storyRevision ? "jenny-story" : "jenny");
const original = path.join(root, "browser-artifacts/demo/recording-2026-09-17T08-26-33-334Z");
const voice = "en-US-JennyNeural", speechOrigin = "https://eastus.tts.speech.microsoft.com";
const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const write = (file, value) => fs.writeFileSync(path.join(output, file), JSON.stringify(value, null, 2) + "\n", { flag: "wx", mode: 0o600 });
const hash = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const escapeXML = value => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
function wavInfo(b) {
  assert(b.length >= 44 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WAVE");
  let format, data;
  for (let p = 12; p + 8 <= b.length;) {
    const n = b.readUInt32LE(p + 4), start = p + 8; assert(start + n <= b.length);
    const id = b.toString("ascii", p, p + 4);
    if (id === "fmt ") { assert(n >= 16); format = [b.readUInt16LE(start), b.readUInt16LE(start + 2), b.readUInt32LE(start + 4), b.readUInt32LE(start + 8), b.readUInt16LE(start + 14)]; }
    if (id === "data") data = b.subarray(start, start + n);
    p = start + n + (n % 2);
  }
  assert.deepEqual(format, [1, 1, 48000, 96000, 16]);
  assert(data && data.length > 0 && data.length % 2 === 0 && data.some(n => n !== 0));
  return { seconds: data.length / 96000, sampleRate: 48000, channels: 1, bits: 16 };
}
async function boundedBody(response, limit) {
  assert(response.body); const chunks = []; let bytes = 0;
  for await (const chunk of response.body) { bytes += chunk.length; assert(bytes <= limit); chunks.push(chunk); }
  return Buffer.concat(chunks);
}
function inputs() {
  const verification = read(path.join(source, "capture-verification.json"));
  assert(!verification.smoke && verification.syntheticCalendars && verification.calendarNetworkRequests === 0 &&
    verification.privateSnapshotAccess === false && verification.liveSearch === 1 && verification.officialOpened);
  const timeline = read(path.join(source, "timeline.json")), raw = read(path.join(source, "raw-files.json"));
  assert.equal(timeline.length, 8);
  for (const name of Object.values(raw)) assert(/^[\w@.-]+\.webm$/.test(name) && fs.lstatSync(path.join(source, name)).isFile());
  timeline.forEach((s, i) => {
    assert.equal(s.source, i === 7 ? "official" : "app");
    assert(typeof s.text === "string" && s.text.length < 600 && !/[{}\\\r\n]/.test(s.text + s.title));
    assert(s.start >= 0 && s.end > s.start);
  });
  return { timeline, raw, verification };
}
function stamp(seconds, ass = false) {
  const p = ass ? 100 : 1000, ticks = Math.round(seconds * p), whole = Math.floor(ticks / p);
  return `${String(Math.floor(whole / 3600)).padStart(ass ? 1 : 2, "0")}:${String(Math.floor(whole / 60) % 60).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}${ass ? "." : ","}${String(ticks % p).padStart(ass ? 2 : 3, "0")}`;
}
function chunks(text) {
  const result = []; let line = "";
  for (const word of text.split(/\s+/)) {
    if (line && (line + " " + word).length > 94) { result.push(line); line = ""; }
    line += (line ? " " : "") + word;
  }
  if (line) result.push(line); return result;
}
function narrationDelay(index, isStory) {
  // The captured +5.8-second review frame already shows Basketball selected.
  return isStory && index === 4 ? 6 : 0.15;
}
async function synthesize() {
  const captured = inputs(), raw = captured.raw;
  const timeline = storyRevision ? captured.timeline.map((s, i) => ({ ...s, ...require("./record-integrated-demo").story[i] })) : captured.timeline;
  const oldTimeline = read(path.join(original, "timeline.json"));
  const oldVoice = read(path.join(original, "azure-jenny-20260918/verification.json"));
  assert(oldVoice.voice === voice && oldVoice.style === "friendly" && oldVoice.rate === "-3%");
  const plan = timeline.map((s, i) => ({ ...s, index: i, reuse: oldTimeline.findIndex(old => old.text === s.text) }));
  const required = plan.filter(s => s.reuse < 0);
  assert(required.length <= (storyRevision ? 8 : 7) && required.reduce((n, s) => n + s.text.length, 0) < 3000);
  fs.mkdirSync(output, { mode: 0o700 }); // Retained attempt marker on failure; no automatic retries.
  write("narration-plan.json", timeline);
  const sourceHashes = Object.fromEntries(["timeline.json", "capture-verification.json", "raw-files.json", ...Object.values(raw)].map(f => [f, hash(path.join(source, f))]));
  write("source-hashes.json", sourceHashes);
  let key = "", stage = "credential_access", requests = 0;
  try {
    const r = spawnSync("az", ["cognitiveservices", "account", "keys", "list", "--subscription", "609bbde3-d152-4d7d-a12b-005e38ac4f27",
      "--resource-group", "ReceiptModeling", "--name", "hackathon-VDI-taipei-tts", "--query", "key1", "-o", "tsv", "--only-show-errors"],
    { timeout: 30000, maxBuffer: 16384, stdio: ["ignore", "pipe", "pipe"] });
    if (r.status !== 0) { r.stdout?.fill(0); r.stderr?.fill(0); throw Error(); }
    key = r.stdout.toString("utf8").trim(); r.stdout.fill(0); r.stderr?.fill(0);
    assert(key.length > 0 && key.length < 512 && !/[\r\n]/.test(key));
    const audio = [];
    for (const s of plan) {
      stage = `voice_${s.index + 1}`; let buffer;
      if (s.reuse >= 0) buffer = fs.readFileSync(path.join(original, "azure-jenny-20260918", `voice-${s.reuse + 1}.wav`));
      else {
        const body = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US"><voice name="${voice}"><mstts:express-as style="friendly"><prosody rate="-3%">${escapeXML(s.text)}</prosody></mstts:express-as></voice></speak>`;
        assert(body.length < 1000); requests++;
        const response = await fetch(`${speechOrigin}/cognitiveservices/v1`, { method: "POST", headers: {
          "Ocp-Apim-Subscription-Key": key, "Content-Type": "application/ssml+xml", "X-Microsoft-OutputFormat": "riff-48khz-16bit-mono-pcm" },
        body, redirect: "error", signal: AbortSignal.timeout(60000) });
        if (response.status !== 200) { stage += `_http_${response.status}`; await response.body?.cancel(); throw Error(); }
        buffer = await boundedBody(response, 12 * 1024 * 1024);
      }
      const info = wavInfo(buffer), file = `voice-${s.index + 1}.wav`;
      assert(info.seconds > 2 && info.seconds < 60);
      fs.writeFileSync(path.join(output, file), buffer, { flag: "wx", mode: 0o600 });
      audio.push({ file, ...info, reused: s.reuse >= 0 });
      console.log(JSON.stringify({ scene: s.index + 1, seconds: info.seconds, reused: s.reuse >= 0 }));
    }
    write("audio.json", audio);
    write("speech-verification.json", { voice, style: "friendly", rate: "-3%", synthesisRequests: requests,
      reusedClips: plan.length - requests, resourceModified: false, textOnly: true, automaticRetry: false });
    console.log(JSON.stringify({ status: "voices_complete", synthesisRequests: requests, output }));
  } catch {
    console.error(JSON.stringify({ status: "voices_failed", stage, synthesisRequests: requests, automaticRetry: false }));
    process.exitCode = 1;
  } finally { key = ""; }
}
function render() {
  const captured = inputs(), { raw, verification } = captured;
  const timeline = read(path.join(output, "narration-plan.json")), audio = read(path.join(output, "audio.json"));
  assert.equal(timeline.length, captured.timeline.length);
  timeline.forEach((s, i) => {
    for (const key of ["source", "start", "end"]) assert.equal(s[key], captured.timeline[i][key]);
    assert(typeof s.text === "string" && s.text.length < 600 && !/[{}\\\r\n]/.test(s.text + s.title));
  });
  assert.equal(audio.length, 8);
  const hashes = read(path.join(output, "source-hashes.json"));
  const verifyHashes = () => Object.entries(hashes).forEach(([f, h]) => assert.equal(hash(path.join(source, f)), h));
  verifyHashes();
  audio.forEach((s, i) => { assert.equal(s.file, `voice-${i + 1}.wav`); assert.equal(wavInfo(fs.readFileSync(path.join(output, s.file))).seconds, s.seconds); });
  const tools = process.env.FAMILYCOPILOT_DEMO_TOOLS; assert(tools && path.isAbsolute(tools));
  const ffmpeg = require(path.join(tools, "node_modules/ffmpeg-static"));
  const run = args => {
    const r = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-n", ...args], { cwd: output, encoding: "utf8", timeout: 300000, maxBuffer: 32768 });
    if (r.status !== 0) throw Error("FFmpeg failed: " + (r.stderr || "").slice(-1600));
  };
  let cursor = 0;
  const updated = timeline.map((s, i) => {
    const sourceStart = i === 7 ? 3 : s.start; // Omit the new official tab's initial loading frames.
    // Let the viewer see the user's selection before naming basketball aloud.
    const voiceDelay = narrationDelay(i, storyRevision);
    const duration = Math.ceil(Math.max(s.end - sourceStart, voiceDelay + audio[i].seconds + 0.65) * 25) / 25;
    const result = { ...s, sourceStart, sourceEnd: s.end, start: cursor, end: cursor + duration, duration, voiceDelay, voiceSeconds: audio[i].seconds };
    cursor = result.end; return result;
  });
  const duration = cursor;
  const header = fs.readFileSync(path.join(original, "captions.ass"), "utf8").split("[Events]")[0] +
    "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n";
  let events = "", srt = "", number = 0;
  for (const [i, s] of updated.entries()) {
    events += `Dialogue: 0,${stamp(s.start, true)},${stamp(s.end, true)},Chapter,,0,0,0,,${String(i + 1).padStart(2, "0")}  /  ${s.title}\n`;
    const parts = chunks(s.text), total = parts.reduce((n, p) => n + p.length, 0); let elapsed = 0;
    for (const p of parts) {
      const start = s.start + s.voiceDelay + s.voiceSeconds * elapsed / total; elapsed += p.length;
      const end = s.start + s.voiceDelay + s.voiceSeconds * elapsed / total;
      events += `Dialogue: 1,${stamp(start, true)},${stamp(end, true)},Caption,,0,0,0,,${p}\n`;
      srt += `${++number}\n${stamp(start)} --> ${stamp(end)}\n${p}\n\n`;
    }
  }
  fs.writeFileSync(path.join(output, "captions.ass"), header + events, { flag: "wx" });
  fs.writeFileSync(path.join(output, "familycopilot-demo.en.srt"), srt, { flag: "wx" });
  write("timeline.json", updated);
  const audioFilters = updated.map((s, i) => `[${i}:a]adelay=${Math.round((s.start + s.voiceDelay) * 1000)}:all=1[a${i}]`);
  audioFilters.push(`${audio.map((_, i) => `[a${i}]`).join("")}amix=inputs=8:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,apad[a]`);
  run([...audio.flatMap(a => ["-i", a.file]), "-filter_complex", audioFilters.join(";"), "-map", "[a]", "-t", duration.toFixed(3), "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", "familycopilot-narration.wav"]);
  const filters = [`[0:v]split=7${updated.slice(0, 7).map((_, i) => `[s${i}]`).join("")}`];
  updated.forEach((s, i) => filters.push(`[${i === 7 ? "1:v" : `s${i}`}]trim=start=${s.sourceStart}:end=${s.sourceEnd},setpts=PTS-STARTPTS,fps=25,tpad=stop_mode=clone:stop_duration=${s.duration},trim=duration=${s.duration},setpts=PTS-STARTPTS,settb=AVTB[v${i}]`));
  filters.push(`${updated.map((_, i) => `[v${i}]`).join("")}concat=n=8:v=1:a=0,scale=1920:960,pad=1920:1080:0:0:color=0x182e28,ass=captions.ass,fade=t=in:st=0:d=0.4,fade=t=out:st=${duration - 0.7}:d=0.7[v]`);
  run(["-i", path.join(source, raw.app), "-i", path.join(source, raw.official), "-i", "familycopilot-narration.wav", "-filter_complex", filters.join(";"),
    "-map", "[v]", "-map", "2:a", "-t", duration.toFixed(3), "-r", "25", "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-metadata:s:a:0", "language=eng", "-disposition:a:0", "default", "-movflags", "+faststart", "familycopilot-integrated-jenny.mp4"]);
  run(["-i", "familycopilot-integrated-jenny.mp4", "-f", "null", "-"]); verifyHashes();
  const report = { ...read(path.join(output, "speech-verification.json")), durationSeconds: duration, scenes: 8,
    storyRevision, newPublicSearches: 0, newCalendarQueries: 0,
    calendarData: "synthetic browser fixtures", calendarNetworkRequests: 0, publicSearches: 1,
    officialUrl: verification.officialUrl, officialWebsiteEnding: true, startOverDemonstrated: false,
    sourceFilesUnchanged: true, appFilesChanged: false, serviceChanges: 0, decodePassed: true,
    subtitleTiming: "Approximate within each narration clip, not word-aligned" };
  write("verification.json", report); console.log(JSON.stringify({ output, ...report }));
}
if (require.main === module) {
  assert.equal(process.argv.length, 3);
  if (["--synthesize-approved", "--synthesize-story-approved"].includes(process.argv[2])) synthesize().catch(() => { console.error("Narration refused; source or existing attempt marker invalid."); process.exitCode = 1; });
  else if (["--render-offline", "--render-story-offline"].includes(process.argv[2])) { try { render(); } catch (e) { console.error(e.message); process.exitCode = 1; } }
  else throw Error("Use --synthesize-approved or --render-offline; no implicit network operation.");
}
module.exports = { wavInfo, escapeXML, stamp, chunks, narrationDelay };