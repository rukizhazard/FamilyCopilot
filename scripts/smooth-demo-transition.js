"use strict";
// Offline retake of activity controls only. Never contacts a running service.
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const { spawnSync, execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const root = path.resolve(__dirname, "..");
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const origin = "http://demo.invalid";
const assets = {
  "/activities": "activity-preview/index.html",
  "/availability-core.js": "owner/availability-core.js",
  ...Object.fromEntries(["shell.css", "activity-preview/preview.css", "activity-preview/basketball.css",
    "activity-preview/core.js", "activity-preview/ui.js", "activity-preview/basketball-ui.js",
    "shared/date-selection.js", "shared/basketball-teams.js"].map(file => ["/" + file, file]))
};
function replayAsset(file, expected) {
  const current = fs.readFileSync(path.join(root, file));
  if (digest(current) === expected) return current;
  const committed = execFileSync("git", ["show", `HEAD:${file}`], { cwd: root });
  assert.equal(digest(committed), expected, `Original recording asset unavailable: ${file}`);
  return committed;
}
function spliceWindow(capture) {
  const shift = time => Math.round((15.2 + time - capture.captureStart) * 25) / 25;
  const start = shift(capture.scenes.find(s => s.kind === "preferences").start);
  const end = shift(capture.scenes.find(s => s.kind === "details").start);
  assert(end > start && start > 15.2);
  return { start, end, seconds: end - start };
}
async function main(directory) {
  const source = path.resolve(directory);
  assert(source.startsWith(path.join(root, "browser-artifacts/demo/updated-ux-")));
  const capture = JSON.parse(fs.readFileSync(path.join(source, "capture.json")));
  const window = spliceWindow(capture), old = path.join(source, "caption-timed");
  const input = path.join(old, "familycopilot-updated-ux.mp4");
  const publicBody = fs.readFileSync(path.join(source, "public-search.json"));
  const bodies = Object.fromEntries(Object.entries(assets).map(([url, file]) => [url, replayAsset(file, capture.sourceHashes[file])]));
  bodies["/activities"] = Buffer.from(require("./activity-week").activityMarkup(bodies["/activities"].toString()));
  const tools = process.env.FAMILYCOPILOT_DEMO_TOOLS; assert(tools && path.isAbsolute(tools));
  const { chromium } = require(path.join(tools, "node_modules/playwright"));
  const ffmpeg = require(path.join(tools, "node_modules/ffmpeg-static"));
  const output = fs.mkdtempSync(path.join(source, "smooth-scroll-")); fs.chmodSync(output, 0o700);
  const run = args => {
    const result = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-n", ...args],
      { cwd: output, encoding: "utf8", timeout: 300000, maxBuffer: 32768 });
    assert.equal(result.status, 0, result.stderr); return result.stdout;
  };
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1,
    locale: "en-US", timezoneId: "Asia/Taipei", reducedMotion: "reduce", serviceWorkers: "block", bypassCSP: true,
    recordVideo: { dir: output, size: { width: 1600, height: 900 } } });
  let replayedSearches = 0; const blocked = [], errors = [], scrolls = [];
  let raw, takeStart;
  try {
    await context.route("**/*", async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin === origin && request.method() === "GET" && bodies[url.pathname]) {
        const type = url.pathname.endsWith(".js") ? "application/javascript" : url.pathname.endsWith(".css") ? "text/css" : "text/html";
        return route.fulfill({ status: 200, contentType: type, body: bodies[url.pathname] });
      }
      if (url.origin === origin && url.pathname === "/api/activities/basketball" && request.method() === "POST") {
        assert(require("./record-updated-demo").permittedSearch(new URL("http://127.0.0.1:8002" + url.pathname), "POST", request.postDataJSON()));
        assert.equal(++replayedSearches, 1);
        return route.fulfill({ status: 200, contentType: "application/json", body: publicBody });
      }
      blocked.push(url.pathname); return route.abort();
    });
    await context.addInitScript(() => {
      sessionStorage.setItem("familycopilot.dates.v1", JSON.stringify({ version: 1, state: "selected", startDate: "2026-10-09", endDate: "2026-10-11" }));
      document.addEventListener("DOMContentLoaded", () => {
        const cursor = document.createElement("div"); cursor.id = "recording-cursor";
        cursor.style.cssText = "position:fixed;z-index:2147483647;width:20px;height:20px;border:2px solid #624199;background:#ffffff99;border-radius:50%;pointer-events:none;left:-50px;top:-50px;transform:translate(-50%,-50%);box-shadow:0 0 0 5px #62419920";
        document.body.append(cursor);
        document.addEventListener("mousemove", e => { cursor.style.left = `${e.clientX}px`; cursor.style.top = `${e.clientY}px`; });
        document.addEventListener("mousedown", () => { cursor.style.background = "#b7a1df"; });
        document.addEventListener("mouseup", () => { cursor.style.background = "#ffffff99"; });
      });
    });
    const page = await context.newPage(), clock = Date.now(); raw = page.video();
    page.on("pageerror", error => errors.push(error.message));
    await page.clock.setFixedTime(new Date(capture.recordedAt));
    await page.goto(origin + "/activities", { waitUntil: "networkidle" });
    await page.mouse.move(1365, 48); await page.waitForTimeout(500);
    takeStart = (Date.now() - clock) / 1000;
    const until = async seconds => { const ms = (takeStart + seconds) * 1000 - (Date.now() - clock); if (ms > 0) await page.waitForTimeout(ms); };
    const click = async selector => {
      const box = await page.locator(selector).first().boundingBox();
      assert(box && box.y >= 0 && box.y + box.height <= 900, `Click must not auto-scroll: ${selector}`);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 });
      await page.waitForTimeout(350); await page.mouse.down(); await page.waitForTimeout(140); await page.mouse.up();
      await page.waitForTimeout(350);
    };
    const scroll = async selector => {
      const samples = await page.locator(selector).evaluate(element => new Promise(resolve => {
        const from = scrollY, box = element.getBoundingClientRect();
        const to = Math.max(0, Math.min(document.documentElement.scrollHeight - innerHeight, from + box.y + box.height / 2 - innerHeight / 2));
        const started = performance.now(), positions = [];
        const frame = now => {
          const t = Math.min(1, (now - started) / 1200), eased = t * t * (3 - 2 * t);
          scrollTo({ top: from + (to - from) * eased, behavior: "instant" }); positions.push(scrollY);
          if (t < 1) requestAnimationFrame(frame); else resolve(positions);
        };
        requestAnimationFrame(frame);
      }));
      assert(samples.length >= 15 && samples.at(-1) > samples[0]);
      const maxStep = Math.max(...samples.slice(1).map((y, i) => Math.abs(y - samples[i])));
      assert(maxStep < 100, "Scroll must show intermediate positions, not jump");
      scrolls.push({ selector, frames: samples.length, from: samples[0], to: samples.at(-1), maxStep });
    };
    await click('label:has(input[name="interest"][value="sports"])');
    await until(1.4); await click('label:has(input[name="sport"][value="basketball"])');
    await page.locator("#team-name").pressSequentially("中信特攻", { delay: 180 });
    await click("#add-team"); assert.equal(await page.locator("#preferred-teams li").count(), 1);
    await page.screenshot({ path: path.join(output, "added.png") });
    await until(16.5); await scroll("#find");
    await page.screenshot({ path: path.join(output, "after-scroll.png") });
    await until(19.3); await click("#find");
    await page.locator("#basketball-games article").first().waitFor({ state: "visible" });
    await page.waitForTimeout(600); await scroll("#basketball-games");
    await page.mouse.move(615, 599, { steps: 15 });
    await page.screenshot({ path: path.join(output, "results.png") });
    await until(window.seconds + 0.5);
    assert.equal(replayedSearches, 1); assert.deepEqual(blocked, []); assert.deepEqual(errors, []);
  } finally { await context.close(); await browser.close(); }
  const rawFile = await raw.path();
  // Overlay only the app viewport. Existing burned captions and exact audio remain intact.
  const filter = `[1:v]trim=start=${takeStart}:duration=${window.seconds},setpts=PTS-STARTPTS,fps=25,scale=1706:960,setpts=PTS+${window.start}/TB[retake];[0:v][retake]overlay=x=107:y=0:eof_action=pass:enable='gte(t,${window.start})*lt(t,${window.end})'[v]`;
  run(["-i", input, "-i", rawFile, "-filter_complex", filter, "-map", "[v]", "-map", "0:a:0",
    "-c:v", "libx264", "-preset", "fast", "-crf", "19", "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", "familycopilot-updated-ux.mp4"]);
  run(["-i", "familycopilot-updated-ux.mp4", "-f", "null", "-"]);
  const audioHash = file => run(["-i", file, "-map", "0:a:0", "-f", "hash", "-hash", "sha256", "-"]).trim();
  assert.equal(audioHash(input), audioHash("familycopilot-updated-ux.mp4"));
  fs.copyFileSync(path.join(old, "familycopilot-updated-ux.en.srt"), path.join(output, "familycopilot-updated-ux.en.srt"), fs.constants.COPYFILE_EXCL);
  for (const [name, time] of [["before", 74.2], ["middle", 74.9], ["after", 75.8], ["results", 81], ["join", 94.48]])
    run(["-ss", String(time), "-i", "familycopilot-updated-ux.mp4", "-frames:v", "1", `review-${name}.png`]);
  const report = { output: path.relative(root, output), window, takeStart, scrolls, networkRequests: 0,
    replayedSearches, historicalPublicResponse: true, calendarRetake: false, audioUnchanged: true,
    subtitleTimingUnchanged: true, decodePassed: true, sourceVideoHash: digest(fs.readFileSync(input)) };
  fs.writeFileSync(path.join(output, "verification.json"), JSON.stringify(report, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify(report));
}
if (require.main === module) {
  const [mode, directory] = process.argv.slice(2);
  assert(mode === "--offline" && directory, "Explicit --offline capture-directory required");
  main(directory).catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { spliceWindow, replayAsset, assets };