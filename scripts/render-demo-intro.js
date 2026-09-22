"use strict";
// Offline illustration rendering only. No app imports, servers or live data.
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const { spawnSync, spawn } = require("node:child_process");
const { once } = require("node:events");
const { pathToFileURL } = require("node:url");
const { createHash } = require("node:crypto");
const root = path.resolve(__dirname, "..");
const digest = file => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
function animatedIntroPlan(brief, source) {
  assert.equal(brief.version, 1);
  assert.equal(brief.kind, "familycopilot.demo.intro-brief");
  assert.equal(source.videoSha256, brief.sourceVideoSha256);
  assert.equal(source.segments[0].start, 0);
  assert.equal(source.segments[0].duration, brief.replaceOpeningSeconds);
  assert(source.segments.every(segment => segment.speed === 1));
  assert(Array.isArray(brief.scenes) && brief.scenes.length === 9);
  let cursor = 0;
  const { captionTimeline } = require("./finish-real-calendar-demo");
  const captions = [];
  for (const [index, scene] of brief.scenes.entries()) {
    assert.equal(scene.id, index + 1);
    assert.equal(scene.start, cursor);
    assert(Number.isFinite(scene.end) && scene.end > scene.start);
    assert(Math.abs(scene.end * 25 - Math.round(scene.end * 25)) < 1e-6);
    const cues = scene.captionCues || [{ start: scene.start + 0.2,
      seconds: scene.end - scene.start - 0.4, text: scene.narration }];
    assert.equal(cues.map(cue => cue.text).join(" "), scene.narration);
    assert(cues.every(cue => cue.start >= scene.start));
    captions.push(...captionTimeline(cues, scene.end));
    cursor = scene.end;
  }
  assert.equal(cursor, brief.introTargetSeconds);
  const sourceDuration = Math.max(...source.segments.map(segment => segment.start + segment.duration));
  assert(Math.abs(sourceDuration - brief.sourceDurationSeconds) < 0.001);
  const shift = cursor - brief.replaceOpeningSeconds;
  const duration = Math.round((sourceDuration + shift) * 100) / 100;
  assert.equal(duration, brief.fullVideoTargetSeconds);
  assert.equal(brief.fullVideoExclusiveLimitSeconds, 120);
  assert(duration < 120, "Full video must be strictly shorter than two minutes");
  for (const segment of source.segments.slice(1)) for (const cue of segment.captions) {
    assert(cue.start >= brief.replaceOpeningSeconds && cue.end > cue.start);
    captions.push({ ...cue, start: Math.round((cue.start + shift) * 100) / 100,
      end: Math.round((cue.end + shift) * 100) / 100 });
  }
  let previousEnd = 0;
  for (const cue of captions) {
    assert(cue.start >= previousEnd && cue.end <= duration);
    previousEnd = cue.end;
  }
  return { duration, introDuration: cursor, sourceStart: brief.replaceOpeningSeconds,
    sourceDuration, shift, captions, introNarration: "none: approved silent animation preview", speed: 1 };
}
function dubTimingPlan(brief, speech, silences) {
  assert.equal(speech.voice, "en-US-JennyNeural");
  assert.equal(speech.style, "friendly"); assert.equal(speech.rate, "-3%");
  assert.equal(speech.audio.length, 9); assert.equal(silences.length, 9);
  let cursor = 0;
  const scenes = brief.scenes.map((scene, index) => {
    const clip = speech.audio[index], pauses = silences[index];
    assert.equal(clip.text, scene.narration);
    assert(Number.isFinite(clip.seconds) && clip.seconds > 0);
    assert(pauses.length >= 2 && pauses[0].start === 0);
    assert(Math.abs(pauses.at(-1).end - clip.seconds) < 0.001);
    let lastEnd = 0;
    for (const pause of pauses) {
      assert(Number.isFinite(pause.start) && Number.isFinite(pause.end));
      assert(pause.start >= lastEnd && pause.end > pause.start && pause.end <= clip.seconds + 0.001);
      lastEnd = pause.end;
    }
    const first = Math.max(0, pauses[0].end - 0.06);
    const last = Math.min(clip.seconds, pauses.at(-1).start + 0.12);
    let begin = first;
    const pieces = [];
    for (const pause of pauses.slice(1, -1)) if (pause.end - pause.start > 0.7) {
      const cutStart = pause.start + 0.16, cutEnd = pause.end - 0.16;
      assert(cutStart > begin && cutEnd < last);
      pieces.push({ start: begin, end: cutStart }); begin = cutEnd;
    }
    assert(last > begin); pieces.push({ start: begin, end: last });
    const seconds = pieces.reduce((sum, piece) => sum + piece.end - piece.start, 0);
    const minimum = index === 5 ? 3.28 : index === 6 ? 8 : scene.end - scene.start;
    const duration = Math.ceil((Math.max(minimum, seconds + 0.28) - 1e-8) * 25) / 25;
    const voiceStart = cursor + 0.12;
    const captionCues = [{ start: voiceStart, seconds, text: clip.text }];
    if (scene.captionCues) {
      assert.equal(scene.captionCues.length, 2);
      const pause = pauses.slice(1, -1).find(item => item.end - item.start > 0.7);
      assert(pause);
      const split = pieces.reduce((sum, piece) => sum + Math.max(0, Math.min(piece.end, pause.end) - piece.start), 0);
      captionCues.splice(0, 1,
        { start: voiceStart, seconds: split, text: scene.captionCues[0].text },
        { start: voiceStart + split, seconds: seconds - split, text: scene.captionCues[1].text });
    }
    const result = { id: scene.id, start: cursor, duration, sourceStart: scene.start, sourceEnd: scene.end,
      voiceStart, voiceSeconds: seconds, audioFile: clip.file, pieces, sourceSilences: pauses,
      captions: require("./finish-real-calendar-demo").captionTimeline(captionCues, cursor + duration) };
    cursor = Math.round((cursor + duration) * 25) / 25;
    return result;
  });
  const duration = Math.round((cursor + brief.preservedDemoSeconds) * 100) / 100;
  assert(duration < 120, "Natural-speed narration does not fit under two minutes");
  return { scenes, introDuration: cursor, duration, demoShift: cursor - brief.replaceOpeningSeconds,
    voiceTempo: 1, videoSpeed: 1, pauseEdit: "Only detected long silence shortened; retain 60ms lead, 120ms tail and 320ms sentence pauses" };
}
function dubbedIntro(args) {
  const [mode, name, hashFlag, expectedHash, speechFlag, speechHash, previewFlag, previewHash] = args;
  assert.equal(args.length, 8); assert(["--plan-dubs", "--render-dubs"].includes(mode));
  assert.equal(hashFlag, "--sha256"); assert.equal(speechFlag, "--speech-sha256"); assert.equal(previewFlag, "--preview-sha256");
  const base = fs.realpathSync(path.join(root, "browser-artifacts/demo"));
  const inside = file => { const result = fs.realpathSync(file); assert(result.startsWith(base + path.sep)); return result; };
  const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
  const requestFile = inside(name), directory = path.dirname(requestFile);
  assert.equal(digest(requestFile), expectedHash);
  const request = require("./render-complete-demo").validateFamilySpeechRequest(read(requestFile));
  const briefFile = inside(path.resolve(directory, request.briefFile)); assert.equal(digest(briefFile), request.briefSha256);
  const brief = read(briefFile);
  assert.deepEqual(brief.scenes.map(scene => scene.narration), request.narration);
  const speechFile = inside(path.join(directory, "jenny-approved/speech.json")); assert.equal(digest(speechFile), speechHash);
  const speech = read(speechFile); assert.equal(speech.requestSha256, expectedHash);
  assert.equal(speech.requests, 9); assert.equal(speech.textCharacters, 675);
  assert.deepEqual(speech.audio.map(clip => clip.text), request.narration);
  const previewFile = inside(path.resolve(directory, request.previewManifest)); assert.equal(digest(previewFile), previewHash);
  const preview = read(previewFile), previewVideo = inside(path.join(path.dirname(previewFile), preview.videoFile));
  assert.equal(preview.kind, "familycopilot.demo.animated-preview"); assert.equal(preview.introDuration, 49);
  assert.equal(digest(previewVideo), preview.videoSha256);
  const sourceManifestFile = inside(path.resolve(path.dirname(briefFile), brief.sourceManifest));
  const source = read(sourceManifestFile), sourceVideo = inside(path.join(path.dirname(sourceManifestFile), source.videoFile));
  assert.equal(digest(sourceVideo), brief.sourceVideoSha256); animatedIntroPlan(brief, source);
  const files = [requestFile, briefFile, speechFile, previewFile, previewVideo, sourceManifestFile, sourceVideo, __filename];
  const audioFiles = speech.audio.map(clip => {
    const file = inside(path.join(path.dirname(speechFile), clip.file));
    assert.equal(digest(file), clip.sha256);
    assert.equal(require("./finish-integrated-demo").wavInfo(fs.readFileSync(file)).seconds, clip.seconds);
    files.push(file); return file;
  });
  const hashes = Object.fromEntries(files.map(file => [file, digest(file)]));
  const tools = process.env.FAMILYCOPILOT_DEMO_TOOLS; assert(tools && path.isAbsolute(tools));
  const ffmpeg = require(path.join(tools, "node_modules/ffmpeg-static"));
  const run = (args, cwd) => {
    const result = spawnSync(ffmpeg, ["-nostdin", "-hide_banner", "-n", ...args], { cwd, encoding: "utf8", timeout: 300000, maxBuffer: 1048576 });
    assert.equal(result.status, 0, (result.stderr || "Dubbing failed").slice(-3000)); return result.stderr;
  };
  const silences = audioFiles.map(file => {
    const log = run(["-i", file, "-af", "silencedetect=noise=-45dB:d=0.12", "-f", "null", "-"]);
    const pauses = []; let start = null;
    for (const match of log.matchAll(/silence_(start|end): ([0-9.]+)/g)) {
      if (match[1] === "start") { assert.equal(start, null); start = Number(match[2]); }
      else { assert(start !== null); pauses.push({ start, end: Number(match[2]) }); start = null; }
    }
    assert.equal(start, null); return pauses;
  });
  const plan = dubTimingPlan(brief, speech, silences);
  if (mode === "--plan-dubs") { console.log(JSON.stringify(plan, null, 2)); return; }
  const output = fs.mkdtempSync(path.join(base, "motion-jenny-")); fs.chmodSync(output, 0o700);
  const save = (file, data) => fs.writeFileSync(path.join(output, file), typeof data === "string" ? data : JSON.stringify(data, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  save("source-hashes.json", hashes); save("dubbing-plan.json", plan); save("request.json", request);
  const { stamp } = require("./finish-integrated-demo");
  const captions = [...plan.scenes.flatMap(scene => scene.captions), ...source.segments.slice(1).flatMap(segment => segment.captions.map(cue => ({ ...cue,
    start: Math.round((cue.start + plan.demoShift) * 100) / 100, end: Math.round((cue.end + plan.demoShift) * 100) / 100 })))];
  let previousEnd = 0;
  for (const cue of captions) { assert(cue.start >= previousEnd && cue.end <= plan.duration); previousEnd = cue.end; }
  const captionsFile = "familycopilot-animated-jenny.en.srt", videoFile = "familycopilot-animated-jenny.mp4";
  save(captionsFile, captions.map((cue, index) => `${index + 1}\n${stamp(cue.start)} --> ${stamp(cue.end)}\n${cue.text}\n`).join("\n"));
  let ass = fs.readFileSync(path.join(path.dirname(sourceManifestFile), "captions.ass"), "utf8").split("[Events]")[0];
  ass += "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n";
  for (const cue of plan.scenes.flatMap(scene => scene.captions)) ass += `Dialogue: 0,${stamp(cue.start, true)},${stamp(cue.end, true)},Caption,,0,0,0,,${cue.text}\n`;
  save("captions.ass", ass);
  const audioFilters = [];
  for (const [index, scene] of plan.scenes.entries()) {
    audioFilters.push(`[${index}:a]asplit=${scene.pieces.length}${scene.pieces.map((_, part) => `[a${index}p${part}]`).join("")}`);
    scene.pieces.forEach((piece, part) => audioFilters.push(`[a${index}p${part}]atrim=start=${piece.start}:end=${piece.end},asetpts=PTS-STARTPTS[c${index}p${part}]`));
    audioFilters.push(`${scene.pieces.map((_, part) => `[c${index}p${part}]`).join("")}concat=n=${scene.pieces.length}:v=0:a=1,adelay=${Math.round(scene.voiceStart * 1000)}:all=1[voice${index}]`);
  }
  audioFilters.push(`${plan.scenes.map((_, index) => `[voice${index}]`).join("")}amix=inputs=9:normalize=0,loudnorm=I=-21.2:TP=-4.5:LRA=11,aresample=48000,apad,atrim=end_sample=${Math.round(plan.introDuration * 48000)},asetpts=PTS-STARTPTS[introvoice]`);
  run(["-loglevel", "error", ...audioFiles.flatMap(file => ["-i", file]), "-filter_complex_threads", "2", "-filter_complex", audioFilters.join(";"), "-map", "[introvoice]", "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", "intro-narration.wav"], output);
  const pcm = spawnSync(ffmpeg, ["-nostdin", "-v", "error", "-i", "intro-narration.wav", "-ar", "48000", "-ac", "2", "-f", "s16le", "pipe:1"], { cwd: output, timeout: 30000, maxBuffer: 16 * 1024 * 1024 });
  assert.equal(pcm.status, 0); assert.equal(pcm.stdout.length, Math.round(plan.introDuration * 48000) * 4, "Intro audio must be sample-exact before joining original narration");
  const parts = [];
  for (const [index, scene] of plan.scenes.entries()) {
    const tail = 0.28, coreDuration = Math.min(scene.duration, scene.sourceEnd - scene.sourceStart) - tail;
    const holdFrames = Math.round((scene.duration - tail - coreDuration) * 25);
    const filter = [
      "[0:v]split=2[core][tail]",
      `[core]trim=start=${scene.sourceStart}:end=${scene.sourceStart + coreDuration},setpts=PTS-STARTPTS,fps=25${holdFrames ? `,tpad=stop_mode=clone:stop=${holdFrames}` : ""},settb=AVTB[held]`,
      `[tail]trim=start=${scene.sourceEnd - tail}:end=${scene.sourceEnd},setpts=PTS-STARTPTS,fps=25,settb=AVTB[last]`,
      "[held][last]concat=n=2:v=1:a=0,crop=1440:900:0:0,pad=1440:1020:0:0:color=0x25291f,setsar=1[video]"
    ];
    const file = `scene-${index + 1}.mp4`; parts.push(file);
    run(["-loglevel", "error", "-i", previewVideo, "-filter_complex_threads", "2", "-filter_complex", filter.join(";"), "-map", "[video]", "-an", "-t", String(scene.duration), "-c:v", "libx264", "-threads", "2", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p", file], output);
  }
  const videoFilters = plan.scenes.map((scene, index) => `[${index}:v]setpts=PTS-STARTPTS,settb=AVTB[v${index}]`);
  videoFilters.push(`${plan.scenes.map((_, index) => `[v${index}]`).join("")}concat=n=9:v=1:a=0,ass=captions.ass[intro]`);
  videoFilters.push(`[9:v]trim=start=${brief.replaceOpeningSeconds}:end=${brief.sourceDurationSeconds},setpts=PTS-STARTPTS,fps=25,setsar=1,settb=AVTB[demo]`);
  videoFilters.push("[intro][demo]concat=n=2:v=1:a=0[video]");
  videoFilters.push(`[9:a]atrim=start=${brief.replaceOpeningSeconds}:end=${brief.sourceDurationSeconds},asetpts=PTS-STARTPTS,aresample=48000[oldvoice]`);
  videoFilters.push("[10:a][oldvoice]concat=n=2:v=0:a=1[audio]");
  run(["-loglevel", "error", ...parts.flatMap(file => ["-i", file]), "-i", sourceVideo, "-i", "intro-narration.wav", "-filter_complex_threads", "2", "-filter_complex", videoFilters.join(";"), "-map", "[video]", "-map", "[audio]", "-t", String(plan.duration), "-c:v", "libx264", "-threads", "2", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-metadata:s:a:0", "language=eng", "-movflags", "+faststart", videoFile], output);
  const decoded = run(["-i", videoFile, "-f", "null", "-"], output);
  assert.match(decoded, /Video: h264.*1440x1020/); assert.match(decoded, /Audio: aac.*48000 Hz, stereo/);
  const durationMatch = decoded.match(/Duration: (\d+):(\d+):(\d+\.\d+)/); assert(durationMatch);
  const measuredDuration = Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3]);
  assert(measuredDuration < 120 && Math.abs(measuredDuration - plan.duration) < 0.04);
  const decodedFrames = Number([...decoded.matchAll(/frame=\s*(\d+)/g)].at(-1)?.[1]);
  assert.equal(decodedFrames, Math.round(plan.duration * 25));
  const levels = run(["-i", videoFile, "-af", "volumedetect", "-vn", "-f", "null", "-"], output);
  const meanDb = Number(levels.match(/mean_volume: (-?[\d.]+) dB/)?.[1]), peakDb = Number(levels.match(/max_volume: (-?[\d.]+) dB/)?.[1]);
  assert(meanDb > -35 && peakDb < -0.1);
  const reviewFrames = plan.scenes.map(scene => ({ file: `final-scene-${scene.id}.png`, time: scene.start + Math.min(scene.duration - 0.5, scene.id === 7 ? 6.9 : scene.duration * 0.72) }));
  reviewFrames.push({ file: "final-demo-join.png", time: plan.introDuration + 0.12 }, { file: "final-ending.png", time: plan.duration - 3 });
  for (const frame of reviewFrames) run(["-loglevel", "error", "-ss", String(frame.time), "-i", videoFile, "-frames:v", "1", frame.file], output);
  for (const [file, hash] of Object.entries(hashes)) assert.equal(digest(file), hash);
  const manifest = { version: 1, kind: "familycopilot.demo.animated-jenny", videoFile, captionsFile, videoSha256: digest(path.join(output, videoFile)),
    captionsSha256: digest(path.join(output, captionsFile)), ...plan, captions, sourceHashes: hashes, measuredDuration, decodedFrames,
    fullDecodePassed: true, meanDb, peakDb, reviewFrames, synthesisRequests: speech.requests, synthesisCharacters: speech.textCharacters,
    extraSpeechRequestsDuringEdit: 0, newCapture: false, humanAudition: "pending", humanContinuousReview: "pending",
    limitations: ["Conceptual intro; not evidence of deployed reminders, registrations, rescheduling or multi-agent execution.", "Original synthetic demo and historical public movie-page evidence retained, not refreshed. Public image reuse rights remain unconfirmed.", "Silence-only editorial cuts retain spoken samples at native tempo; subtitles are sentence-timed, not word-aligned."] };
  save("manifest.json", manifest);
  console.log(JSON.stringify({ output, videoFile, duration: measuredDuration, introDuration: plan.introDuration, fullDecodePassed: true, synthesisRequests: speech.requests, additionalRequests: 0 }));
}
async function animatedPreview(args) {
  const [mode, briefName, hashFlag, expectedHash, reviewFlag, reviewName, reviewHashFlag, reviewHash] = args;
  assert(["--review-animated", "--render-animated"].includes(mode));
  const reviewing = mode === "--review-animated";
  assert.equal(args.length, reviewing ? 4 : 8);
  assert.equal(hashFlag, "--sha256"); assert.match(expectedHash, /^[a-f0-9]{64}$/);
  const base = fs.realpathSync(path.join(root, "browser-artifacts/demo"));
  const inside = name => { const file = fs.realpathSync(name); assert(file.startsWith(base + path.sep)); return file; };
  const briefFile = inside(briefName); assert.equal(digest(briefFile), expectedHash);
  const directory = path.dirname(briefFile), read = file => JSON.parse(fs.readFileSync(file, "utf8"));
  const brief = read(briefFile), approvalFile = inside(path.join(directory, "approval.json")), approval = read(approvalFile);
  assert.equal(approval.offlineAnimationReviewAndRenderingApproved, true);
  assert.equal(approval.newSpeechApproved, false);
  assert.equal(approval.visionFramingApproved, true);
  const sourceManifest = inside(path.resolve(directory, brief.sourceManifest)), source = read(sourceManifest);
  const plan = animatedIntroPlan(brief, source);
  const sourceVideo = inside(path.join(path.dirname(sourceManifest), source.videoFile));
  const sourceCaptions = inside(path.join(path.dirname(sourceManifest), source.captionsFile));
  assert.equal(digest(sourceVideo), brief.sourceVideoSha256);
  assert.equal(digest(sourceCaptions), source.captionsSha256);
  const htmlFile = inside(path.join(directory, "intro.html"));
  const fontSource = inside(path.join(base, "readable-pacing-20260921/snapshot/assets/chat/chat.css"));
  const fontCss = fs.readFileSync(fontSource, "utf8").match(/@font-face\s*\{[^}]+\}/g)?.join("\n");
  assert(fontCss && fontCss.includes("Nunito Sans") && fontCss.includes("data:font/woff2;base64,"));
  assert(!/https?:/.test(fontCss));
  const sourceFiles = [briefFile, approvalFile, sourceManifest, sourceVideo, sourceCaptions, htmlFile, fontSource, __filename];
  const hashes = Object.fromEntries(sourceFiles.map(file => [file, digest(file)]));
  if (!reviewing) {
    assert.equal(reviewFlag, "--review"); assert.equal(reviewHashFlag, "--review-sha256");
    const reviewedFile = inside(reviewName); assert.equal(digest(reviewedFile), reviewHash);
    const review = read(reviewedFile);
    assert.equal(review.kind, "familycopilot.demo.animation-review");
    assert.equal(review.layoutPassed, true); assert.equal(review.forbiddenRequests, 0);
    assert.deepEqual(review.sourceHashes, hashes);
  }
  const tools = process.env.FAMILYCOPILOT_DEMO_TOOLS;
  assert(tools && path.isAbsolute(tools));
  const { chromium } = require(path.join(tools, "node_modules/playwright"));
  const ffmpeg = require(path.join(tools, "node_modules/ffmpeg-static"));
  const output = fs.mkdtempSync(path.join(base, reviewing ? "motion-review-" : "motion-preview-"));
  fs.chmodSync(output, 0o700);
  const save = (name, data) => fs.writeFileSync(path.join(output, name), typeof data === "string" ? data : JSON.stringify(data, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  save("approval.json", approval); save("brief.json", brief); save("intro.html", fs.readFileSync(htmlFile, "utf8")); save("font.css", fontCss);
  save("source-hashes.json", hashes);
  const browser = await chromium.launch({ headless: true });
  let forbiddenRequests = 0, encoder = null;
  const errors = [], frames = [], layoutChecks = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1020 }, deviceScaleFactor: 1, serviceWorkers: "block" });
    const target = "http://familycopilot-animation.localhost/intro.html";
    await context.route("**/*", route => {
      if (route.request().url() === target && route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "text/html", body: fs.readFileSync(htmlFile) });
      forbiddenRequests++; return route.abort();
    });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(target); await page.addStyleTag({ content: fontCss });
    await page.evaluate(async captions => { window.intro.setCaptions(captions); await document.fonts.ready; }, plan.captions.filter(cue => cue.end <= plan.introDuration));
    assert.equal(await page.evaluate(() => document.fonts.check('24px "Nunito Sans"')), true);
    assert.equal(await page.evaluate(() => window.intro.duration), plan.introDuration);
    const times = [4.8, 10.8, 14.9, 18.8, 22.8, 26.8, 30.8, 35.8, 40.8, 47.5];
    for (const [index, time] of times.entries()) {
      await page.evaluate(seconds => window.intro.seek(seconds), time);
      const check = await page.evaluate(() => {
        const active = [...document.querySelectorAll('.scene')].find(element => getComputedStyle(element).visibility === 'visible');
        const outside = [];
        if (active.dataset.scene === '1') {
          const heading = active.querySelector('.chaos-title').getBoundingClientRect();
          for (const note of active.querySelectorAll('.note')) {
            if (Number(getComputedStyle(note).opacity) < 0.1) continue;
            const bounds = note.getBoundingClientRect();
            if (bounds.left < heading.right && bounds.right > heading.left && bounds.top < heading.bottom && bounds.bottom > heading.top) outside.push('Notification overlaps the opening headline');
          }
        }
        for (const element of active.querySelectorAll('h1,h2,h3,p,b,strong,small,.status,.label,.choice,.agent,.arch-level,.question,.answer-row')) {
          if ([element, ...ancestors(element, active)].some(parent => Number(getComputedStyle(parent).opacity) < 0.1)) continue;
          const range = document.createRange(); range.selectNodeContents(element);
          const bounds = range.getBoundingClientRect();
          if (bounds.left < 20 || bounds.right > 1420 || bounds.top < 95 || bounds.bottom > 883 || element.scrollWidth > element.clientWidth + 2 && element.clientWidth > 0) outside.push(element.textContent.trim().slice(0, 80));
        }
        function ancestors(element, stop) { const result = []; while (element.parentElement && element !== stop) { element = element.parentElement; result.push(element); } return result; }
        const caption = document.querySelector('.captions p').getBoundingClientRect();
        return { scene: active.dataset.scene, outside, captionFits: caption.top >= 900 && caption.bottom <= 1020, loadedFonts: [...document.fonts].filter(font => font.status === 'loaded').map(font => font.family) };
      });
      layoutChecks.push({ time, ...check });
      const name = `review-${String(index + 1).padStart(2, "0")}.png`;
      await page.screenshot({ path: path.join(output, name) }); frames.push({ time, file: name });
      assert.deepEqual(check.outside, [], `Text overflow at ${time}: ${check.outside.join(", ")}`);
      assert.equal(check.captionFits, true);
    }
    if (!reviewing) {
      const rawFile = path.join(output, "familycopilot-animated-intro.mp4");
      encoder = spawn(ffmpeg, ["-hide_banner", "-loglevel", "error", "-n", "-f", "image2pipe", "-framerate", "25", "-vcodec", "png", "-i", "pipe:0", "-an", "-c:v", "libx264", "-threads", "2", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", rawFile], { stdio: ["pipe", "ignore", "pipe"] });
      let encoderErrors = "", pipeError = null;
      encoder.stderr.on("data", data => { encoderErrors = (encoderErrors + data).slice(-4000); });
      encoder.stdin.on("error", error => { pipeError = error; });
      const completed = once(encoder, "close");
      for (let frame = 0; frame < plan.introDuration * 25; frame++) {
        assert(!pipeError, pipeError?.message); assert.equal(encoder.exitCode, null, encoderErrors);
        await page.evaluate(seconds => window.intro.seek(seconds), frame / 25);
        const png = await page.screenshot();
        if (!encoder.stdin.write(png)) await once(encoder.stdin, "drain");
        if (frame % 250 === 0) console.log(JSON.stringify({ animationFrame: frame, total: plan.introDuration * 25 }));
      }
      encoder.stdin.end(); const [code] = await completed; assert.equal(code, 0, encoderErrors); encoder = null;
    }
    await context.close();
  } finally {
    if (encoder && encoder.exitCode === null) encoder.kill("SIGTERM");
    await browser.close();
  }
  assert.deepEqual(errors, []); assert.equal(forbiddenRequests, 0);
  for (const [file, value] of Object.entries(hashes)) assert.equal(digest(file), value);
  const common = { sourceHashes: hashes, layoutPassed: true, layoutChecks, forbiddenRequests, browserErrors: errors.length, reviewFrames: frames,
    newSpeechRequests: 0, privateCalendarAccess: false, sourceSpeed: 1, introNarration: plan.introNarration };
  if (reviewing) {
    save("review.json", { kind: "familycopilot.demo.animation-review", ...common });
    console.log(JSON.stringify({ output, review: path.join(output, "review.json"), sha256: digest(path.join(output, "review.json")), ...plan })); return;
  }
  const run = args => {
    const result = spawnSync(ffmpeg, ["-nostdin", "-hide_banner", "-n", ...args], { cwd: output, encoding: "utf8", timeout: 300000, maxBuffer: 1048576 });
    assert.equal(result.status, 0, (result.stderr || "Animation composition failed").slice(-3000)); return result.stderr;
  };
  const videoFile = "familycopilot-animated-preview.mp4", captionsFile = "familycopilot-animated-preview.en.srt";
  const { stamp } = require("./finish-integrated-demo");
  save(captionsFile, plan.captions.map((cue, index) => `${index + 1}\n${stamp(cue.start)} --> ${stamp(cue.end)}\n${cue.text}\n`).join("\n"));
  const filters = [
    "[0:v]fps=25,setsar=1,settb=AVTB,setpts=PTS-STARTPTS[intro]",
    `[1:v]trim=start=${plan.sourceStart}:end=${plan.sourceDuration},setpts=PTS-STARTPTS,fps=25,setsar=1,settb=AVTB[demo]`,
    "[intro][demo]concat=n=2:v=1:a=0[video]",
    `anullsrc=r=48000:cl=stereo,atrim=duration=${plan.introDuration},asetpts=PTS-STARTPTS[silent]`,
    `[1:a]atrim=start=${plan.sourceStart}:end=${plan.sourceDuration},asetpts=PTS-STARTPTS,aresample=48000[voice]`,
    "[silent][voice]concat=n=2:v=0:a=1[audio]"
  ];
  run(["-loglevel", "error", "-i", "familycopilot-animated-intro.mp4", "-i", sourceVideo, "-filter_complex_threads", "2", "-filter_complex", filters.join(";"), "-map", "[video]", "-map", "[audio]", "-t", String(plan.duration), "-c:v", "libx264", "-threads", "2", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", videoFile]);
  const decode = run(["-i", videoFile, "-f", "null", "-"]);
  assert.match(decode, /Video: h264.*1440x1020/); assert.match(decode, /Audio: aac.*48000 Hz, stereo/);
  const durationMatch = decode.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
  assert(durationMatch); const measuredDuration = Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3]);
  assert(measuredDuration < 120 && Math.abs(measuredDuration - plan.duration) <= 0.04);
  const framesDecoded = [...decode.matchAll(/frame=\s*(\d+)/g)].at(-1); assert(framesDecoded);
  assert.equal(Number(framesDecoded[1]), Math.round(plan.duration * 25));
  const audio = run(["-i", videoFile, "-ss", String(plan.introDuration), "-af", "volumedetect", "-vn", "-f", "null", "-"]);
  assert.match(audio, /mean_volume: -\d+(?:\.\d+)? dB/);
  for (const [name, time] of [["join-before", 48.92], ["join-after", 49.12], ["demo-month", 59.88], ["ending", 114.2]]) {
    run(["-loglevel", "error", "-ss", String(time), "-i", videoFile, "-frames:v", "1", `final-${name}.png`]);
  }
  for (const [file, value] of Object.entries(hashes)) assert.equal(digest(file), value);
  const manifest = { version: 1, kind: "familycopilot.demo.animated-preview", videoFile, captionsFile, videoSha256: digest(path.join(output, videoFile)),
    captionsSha256: digest(path.join(output, captionsFile)), ...plan, ...common, measuredDuration, decodedFrames: Number(framesDecoded[1]), fullDecodePassed: true,
    demoMeanVolume: audio.match(/mean_volume: ([^\n]+)/)?.[1], demoPeakVolume: audio.match(/max_volume: ([^\n]+)/)?.[1],
    limitations: ["New intro is a silent captioned product vision, not shipped capability evidence. No new narration synthesized.", "Existing synthetic demo and old public-image qualifications remain unchanged. No live searches, real invitations, registration or reminder delivery.", "Human continuous review and audition pending; no upload or public image rights clearance."], humanContinuousReview: "pending", humanAudition: "pending" };
  save("manifest.json", manifest); save("verification.json", { fullDecodePassed: true, sourceHashesMatched: true, measuredDuration, decodedFrames: manifest.decodedFrames, layoutChecks, forbiddenRequests, newSpeechRequests: 0, humanContinuousReview: "pending", humanAudition: "pending" });
  console.log(JSON.stringify({ output, videoFile, duration: measuredDuration, fullDecodePassed: true, newSpeechRequests: 0 }));
}
async function render() {
  assert.deepEqual(process.argv.slice(2), ["--render-offline"]);
  const tools = process.env.FAMILYCOPILOT_DEMO_TOOLS;
  assert(tools && path.isAbsolute(tools));
  const { chromium } = require(path.join(tools, "node_modules/playwright"));
  const ffmpeg = require(path.join(tools, "node_modules/ffmpeg-static"));
  assert(fs.existsSync(ffmpeg));
  const source = path.join(root, "docs/demo-intro.html");
  const voice = path.join(root, "browser-artifacts/demo/integrated-20260918/jenny-story/voice-1.wav");
  const voiceProof = path.join(path.dirname(voice), "speech-verification.json");
  const proof = JSON.parse(fs.readFileSync(voiceProof, "utf8"));
  assert.equal(proof.voice, "en-US-JennyNeural");
  const { wavInfo } = require("./finish-integrated-demo");
  const audio = wavInfo(fs.readFileSync(voice));
  assert(audio.seconds < 14.5);
  const before = { html: digest(source), voice: digest(voice) };
  const output = fs.mkdtempSync(path.join(root, "browser-artifacts/demo/family-intro-"));
  fs.chmodSync(output, 0o700);
  const browser = await chromium.launch({ headless: true });
  let requests = 0;
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1,
      serviceWorkers: "block", reducedMotion: "no-preference" });
    await context.route("**/*", route => {
      if (route.request().url().startsWith(pathToFileURL(source).href)) return route.continue();
      requests++; return route.abort();
    });
    const page = await context.newPage();
    page.on("pageerror", () => errors.push("page_error"));
    await page.goto(pathToFileURL(source).href + "?record=1");
    const duration = await page.evaluate(() => window.intro.duration);
    assert.equal(duration, 15.2);
    const fps = 25, frames = Math.round(duration * fps);
    for (let i = 0; i < frames; i++) {
      await page.evaluate(t => window.intro.seek(t), i / fps);
      await page.screenshot({ path: path.join(output, `frame-${String(i).padStart(4, "0")}.png`), animations: "allow" });
    }
    assert.deepEqual(errors, []); assert.equal(requests, 0);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(() => document.querySelector('.stage').classList.remove('capture'));
    assert.equal(await page.locator('.end').evaluate(el => getComputedStyle(el).opacity), "1");
    assert.equal(await page.locator('.scene').evaluate(el => getComputedStyle(el).opacity), "0");
    await context.close();
    const run = args => {
      const r = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-n", ...args],
        { cwd: output, encoding: "utf8", timeout: 300000, maxBuffer: 32768 });
      if (r.status !== 0) throw Error((r.stderr || "Encoding failed").slice(-1600));
    };
    run(["-framerate", String(fps), "-i", "frame-%04d.png", "-i", voice,
      "-vf", "fade=t=in:st=0:d=0.35,fade=t=out:st=14.8:d=0.4", "-af", "adelay=350:all=1,apad,loudnorm=I=-16:TP=-1.5:LRA=11",
      "-t", String(duration), "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", "familycopilot-family-intro.mp4"]);
    run(["-i", "familycopilot-family-intro.mp4", "-f", "null", "-"]);
    assert.equal(digest(source), before.html); assert.equal(digest(voice), before.voice);
    // Keep representative review frames, not hundreds of intermediate images.
    for (let i = 0; i < frames; i++) if (![50, 175, 337].includes(i)) fs.unlinkSync(path.join(output, `frame-${String(i).padStart(4, "0")}.png`));
    const report = { output: path.relative(root, output), duration, fps, width: 1920, height: 1080,
      illustrationOnly: true, realCalendarAccess: false, networkRequests: requests, newSpeechRequests: 0,
      narration: "Reused existing approved Jenny opening clip", sourceHashes: before,
      reducedMotionChecked: true, pageErrors: errors.length, decodePassed: true };
    fs.writeFileSync(path.join(output, "verification.json"), JSON.stringify(report, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    console.log(JSON.stringify(report));
  } finally { await browser.close(); }
}
if (require.main === module) Promise.resolve().then(() => {
  if (["--plan-dubs", "--render-dubs"].includes(process.argv[2])) return dubbedIntro(process.argv.slice(2));
  return process.argv[2]?.includes("-animated") ? animatedPreview(process.argv.slice(2)) : render();
}).catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { animatedIntroPlan, dubTimingPlan };