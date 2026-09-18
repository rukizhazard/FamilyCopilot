"use strict";
// Offline illustration rendering only. No app imports, servers or live data.
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");
const { createHash } = require("node:crypto");
const root = path.resolve(__dirname, "..");
const digest = file => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
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
if (require.main === module) render().catch(e => { console.error(e.message); process.exitCode = 1; });