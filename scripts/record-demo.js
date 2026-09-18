"use strict";
// Isolated, synthetic-only video production. No live mode and no existing browser.
const fs = require("node:fs/promises");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
// Real team name, fictional fixtures: these IDs and games are not source facts.
const demoTeam = "中信特攻"; // CTBC DEA
const story = [
  { title: "A little more room for happy days", text: "Meet Family Copilot. Start with a clearer view of your week, then explore something fun. This walkthrough uses synthetic calendars and invented game listings, never real family data." },
  { title: "Choose your dates. You stay in control.", text: "Choose your dates, review the calendar access scope, then Confirm. For this walkthrough, continue without the child's calendar. Nothing loads automatically, and parent event titles stay private." },
  { title: "See the week. Keep the unknowns visible.", text: "See busy, tentative, away, and unknown time together. Missing information never means free time. A child's schedule stays unknown until its separate access steps are completed." },
  { title: "Bring the dates, not the calendar data", text: "Move to Activities in the same tab. Your selected dates come along, but calendar data does not. You can also discover activities without connecting any calendar." },
  { title: "Make the search your own", text: "Choose Sports, then Basketball. Add C T B C D E A, using its Chinese team name, to narrow the results. These preferences stay on this page, not in a saved profile." },
  { title: "Search only when you ask", text: "Select Find activities when you are ready. The team name is real, but these games, opponents, and venues are invented examples. No live sports source is contacted in this recording." },
  { title: "Know what still needs checking", text: "Open a listing to inspect its details. The interface keeps important limits visible: tickets, travel, age suitability, and schedule fit are not verified. These examples are not booking recommendations." },
  { title: "A clearer week. More possibilities.", text: "Start over to clear activity choices while keeping your dates. Family Copilot helps you explore, but does not book, buy tickets, or change calendars. You decide what happens next." }
];

function command(executable, args, options = {}) {
  const result = spawnSync(executable, args, { encoding: "utf8", timeout: 120000, maxBuffer: 4 * 1024 * 1024, ...options });
  if (result.error || result.signal || result.status !== 0) throw new Error(`Demo command failed: ${path.basename(executable)} (${result.status ?? "unavailable"})`);
  return result.stdout.trim();
}
function wavSeconds(buffer) {
  assert.equal(buffer.toString("ascii", 0, 4), "RIFF");
  let rate, size;
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const id = buffer.toString("ascii", offset, offset + 4), length = buffer.readUInt32LE(offset + 4);
    if (id === "fmt ") rate = buffer.readUInt32LE(offset + 16);
    if (id === "data") size = length;
    offset += 8 + length + (length % 2);
  }
  assert(rate > 0 && size > 0, "Invalid narration WAV");
  return size / rate;
}
function timestamp(seconds, separator = ",") {
  const ms = Math.round(seconds * 1000);
  return `${String(Math.floor(ms / 3600000)).padStart(2, "0")}:${String(Math.floor(ms / 60000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}${separator}${String(ms % 1000).padStart(3, "0")}`;
}
function subtitleChunks(text) {
  const chunks = []; let chunk = "";
  for (const word of text.split(" ")) {
    if (chunk.length + word.length > 95) { chunks.push(chunk); chunk = ""; }
    chunk += (chunk ? " " : "") + word;
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

async function main() {
  const tools = process.env.FAMILYCOPILOT_DEMO_TOOLS;
  assert(tools && path.isAbsolute(tools), "Set FAMILYCOPILOT_DEMO_TOOLS to an isolated media-tool installation.");
  const { chromium } = require(path.join(tools, "node_modules/playwright"));
  const ffmpeg = require(path.join(tools, "node_modules/ffmpeg-static"));
  const powershell = "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe";
  const smoke = process.argv.includes("--smoke");
  assert(process.argv.slice(2).every(arg => arg === "--smoke"), "Unknown demo option");
  const output = path.join(root, "browser-artifacts", "demo", `${smoke ? "smoke" : "recording"}-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  await fs.mkdir(output, { recursive: true });
  const voices = [];
  if (!smoke) {
    for (let i = 0; i < story.length; i++) {
      const file = path.join(output, `voice-${i + 1}.wav`);
      const windowsPath = command("wslpath", ["-w", file]);
      const literal = value => `'${value.replace(/'/g, "''")}'`;
      const ps = `Add-Type -AssemblyName System.Speech; $s=New-Object System.Speech.Synthesis.SpeechSynthesizer; try { $s.SelectVoice('Microsoft Zira Desktop'); $s.Rate=2; $s.SetOutputToWaveFile(${literal(windowsPath)}); $s.Speak(${literal(story[i].text)}); } finally { $s.Dispose() }`;
      command(powershell, ["-NoProfile", "-NonInteractive", "-Command", ps]);
      voices.push({ file, duration: wavSeconds(await fs.readFile(file)) });
    }
  }

  // Fail closed if an unexpected module attempts outbound source fetching.
  const counts = { parentFixture: 0, basketballFixture: 0, forbiddenNetwork: 0, startupApi: 0 };
  const deny = () => { counts.forbiddenNetwork++; throw new Error("Synthetic demo forbids outbound requests"); };
  globalThis.fetch = deny;
  const https = require("node:https"); https.request = deny; https.get = deny;
  const { createServer } = require("./serve-owner");
  const fixture = require("../browser-fixtures/availability");
  const { basketballResponse, row } = require("../test/fixtures/basketball-response");
  const D = require("../shared/date-selection");
  const dates = { startDate: "2026-10-09", endDate: "2026-10-11" };
  const rows = [
    row(9001, "2026-10-09", { home_team: { id: 901, name: demoTeam }, away_team: { id: 902, name: "Synthetic Away" } }),
    row(9002, "2026-10-10", { home_team: { id: 903, name: "Synthetic City" }, away_team: { id: 901, name: demoTeam }, venue: "Synthetic Riverside Arena" }),
    row(9003, "2026-10-11", { home_team: { id: 904, name: "Synthetic Stars" }, away_team: { id: 902, name: "Synthetic Away" } })
  ];
  // Discover a free loopback port. If another process takes it before listen,
  // fail with EADDRINUSE; never stop or take over that process.
  const reservation = require("node:net").createServer();
  await new Promise((resolve, reject) => { reservation.once("error", reject); reservation.listen(0, "127.0.0.1", resolve); });
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const server = createServer({ port, synthetic: true,
    perform: async () => { throw new Error("Owner listing is outside this demo"); },
    performChild: async () => { throw new Error("Child import is outside this demo"); },
    performAvailability: async options => { counts.parentFixture++; return fixture.perform(options); },
    searchBasketball: async options => {
      counts.basketballFixture++;
      const week = D.describeWeek(options.window);
      return basketballResponse({ startDate: week.firstDate, endDate: week.lastDate,
        teamIds: options.teamIds, teamMode: options.teamMode, rows, checkedAt: new Date().toISOString() });
    }
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", resolve); });
  let browser, context, page;
  const external = [], pageErrors = [], timeline = [];
  const origin = `http://127.0.0.1:${port}`;
  try {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({ viewport: { width: 1280, height: 640 }, deviceScaleFactor: 1,
      locale: "en-US", timezoneId: "Asia/Taipei", colorScheme: "light", reducedMotion: "reduce",
      bypassCSP: true, serviceWorkers: "block",
      ...(!smoke ? { recordVideo: { dir: output, size: { width: 1280, height: 640 } } } : {}) });
    await context.route("**/*", route => {
      if (new URL(route.request().url()).origin !== origin) { external.push("blocked"); return route.abort(); }
      return route.continue();
    });
    await context.addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        const badge = document.createElement("div");
        badge.textContent = "DEMO · SYNTHETIC DATA";
        badge.style.cssText = "position:fixed;right:14px;top:12px;z-index:2147483647;background:#193d36;color:#fff;padding:8px 12px;border-radius:24px;font:700 11px system-ui;letter-spacing:1px;pointer-events:none";
        const cursor = document.createElement("div");
        cursor.style.cssText = "position:fixed;z-index:2147483646;width:18px;height:18px;border:2px solid #355e50;background:#ffffff80;border-radius:50%;pointer-events:none;left:-40px;top:-40px;transform:translate(-50%,-50%);box-shadow:0 0 0 4px #355e5020";
        document.body.append(badge, cursor);
        document.addEventListener("mousemove", event => { cursor.style.left = `${event.clientX}px`; cursor.style.top = `${event.clientY}px`; });
      });
    });
    page = await context.newPage();
    page.on("pageerror", () => pageErrors.push("page_error"));
    let firstAction = false;
    page.on("request", request => { if (!firstAction && new URL(request.url()).pathname.startsWith("/api/")) counts.startupApi++; });
    const started = Date.now();
    const video = page.video();
    const pause = ms => new Promise(resolve => setTimeout(resolve, smoke ? 30 : ms));
    const focus = async selector => {
      await page.locator(selector).first().evaluate(element => element.scrollIntoView({ block: "center", behavior: "instant" }));
      await pause(250);
    };
    const click = async selector => {
      const element = page.locator(selector).first(); await element.scrollIntoViewIfNeeded();
      const box = await element.boundingBox(); assert(box, `No target: ${selector}`);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: smoke ? 1 : 16 });
      await pause(180); await element.click(); await pause(350);
    };
    const scene = async (index, action) => {
      const start = (Date.now() - started) / 1000;
      firstAction = index > 0;
      await action();
      await page.screenshot({ path: path.join(output, `scene-${index + 1}.png`) });
      const target = smoke ? 0 : Math.max(8, voices[index].duration + 1);
      await pause(Math.max(0, (target - ((Date.now() - started) / 1000 - start)) * 1000));
      timeline.push({ ...story[index], start, end: (Date.now() - started) / 1000 });
    };
    await scene(0, async () => {
      await page.goto(origin, { waitUntil: "networkidle" });
      await page.locator("#availability-load").waitFor({ state: "visible" });
      assert.match(await page.locator("#owner-source-badge").innerText(), /SAMPLE/);
      assert.equal(counts.startupApi, 0);
    });
    await scene(1, async () => {
      await page.locator("#availability-start").fill(dates.startDate);
      await pause(400);
      await page.locator("#availability-end").fill(dates.endDate);
      await click("#availability-load");
      // The current shared Confirm flow offers separate child consent. This
      // parent-only walkthrough explicitly skips it; no child adapter may run.
      if (await page.locator("#child-skip").isVisible()) await click("#child-skip");
      await page.locator("#availability-grid").waitFor({ state: "visible" });
      await focus(".availability-confirmation");
    });
    await scene(2, async () => {
      await page.locator("#availability-grid").evaluate(element => {
        scrollTo({ top: scrollY + element.getBoundingClientRect().top - 60, behavior: "instant" });
      });
      assert.match(await page.locator("#child-week-status").innerText(), /unknown|not loaded/i);
    });
    await scene(3, async () => {
      await click('.shell-nav a[href="/activities"]');
      await page.waitForURL(`${origin}/activities`);
      assert.equal(await page.locator("#activity-start").inputValue(), dates.startDate);
      assert.equal(await page.locator("#activity-end").inputValue(), dates.endDate);
      await focus(".discovery-dates");
    });
    await scene(4, async () => {
      await click('label:has(input[name="interest"][value="sports"])');
      await click('label:has(input[name="sport"][value="basketball"])');
      await focus("#basketball-choices");
      await page.locator("#team-name").pressSequentially(demoTeam, { delay: smoke ? 0 : 180 });
      await click("#add-team");
      assert((await page.locator("#preferred-teams").innerText()).includes(demoTeam));
    });
    await scene(5, async () => {
      await click("#find");
      await page.locator("#basketball-games article").first().waitFor({ state: "visible" });
      assert.equal(await page.locator("#basketball-games article").count(), 2);
      const titles = await page.locator("#basketball-games article h3").allTextContents();
      assert(titles.every(title => title.includes(demoTeam)));
      assert(!(await page.locator("#basketball-games").innerText()).includes("Synthetic Home"));
      await focus("#basketball-panel");
    });
    await scene(6, async () => {
      await click("#basketball-games article details summary");
      await focus("#basketball-games article details");
      assert.match(await page.locator("#basketball-games").innerText(), /unverified|unknown|not checked/i);
    });
    await scene(7, async () => {
      await click("#reset");
      assert.equal(await page.locator("#preferred-teams li").count(), 0);
      assert.equal(await page.locator("#activity-start").inputValue(), dates.startDate);
      await page.evaluate(() => scrollTo(0, 0));
    });
    assert.equal(counts.parentFixture, 1);
    assert.equal(counts.basketballFixture, 1);
    assert.equal(counts.forbiddenNetwork, 0);
    assert.equal(external.length, 0);
    assert.equal(pageErrors.length, 0);
    await context.close(); context = null;
    await browser.close(); browser = null;
    if (!smoke) {
      const raw = await video.path();
      const duration = timeline.at(-1).end;
      const subtitles = []; let number = 0;
      timeline.forEach((item, index) => {
        const chunks = subtitleChunks(item.text), segment = voices[index].duration / chunks.length;
        chunks.forEach((text, j) => subtitles.push(`${++number}\n${timestamp(item.start + 0.15 + segment * j)} --> ${timestamp(item.start + 0.15 + segment * (j + 1))}\n${text}\n`));
      });
      await fs.writeFile(path.join(output, "familycopilot-demo.en.srt"), subtitles.join("\n"));
      await fs.writeFile(path.join(output, "narration.txt"), timeline.map(item => `${item.title}\n${item.text}`).join("\n\n") + "\n");
      const assTime = seconds => timestamp(seconds, ".").replace(/^0/, "").slice(0, -1);
      const header = `[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Caption,DejaVu Sans,29,&H00FFFFFF,&H00FFFFFF,&H00182E28,&H00182E28,0,0,0,0,100,100,0,0,1,0,0,2,140,140,22,1\nStyle: Chapter,DejaVu Sans,20,&H0089CDBB,&H0089CDBB,&H00182E28,&H00182E28,-1,0,0,0,100,100,1,0,1,0,0,2,100,100,80,1\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
      let events = "";
      timeline.forEach((item, index) => {
        events += `Dialogue: 0,${assTime(item.start)},${assTime(item.end)},Chapter,,0,0,0,,${String(index + 1).padStart(2, "0")}  /  ${item.title}\n`;
        const chunks = subtitleChunks(item.text), segment = voices[index].duration / chunks.length;
        chunks.forEach((text, j) => { events += `Dialogue: 1,${assTime(item.start + 0.15 + segment * j)},${assTime(item.start + 0.15 + segment * (j + 1))},Caption,,0,0,0,,${text}\n`; });
      });
      await fs.writeFile(path.join(output, "captions.ass"), header + events);
      const args = ["-hide_banner", "-loglevel", "error", "-y", "-i", raw];
      voices.forEach(voice => args.push("-i", voice.file));
      const filters = voices.map((_, index) => `[${index + 1}:a]adelay=${Math.round((timeline[index].start + 0.15) * 1000)}:all=1[a${index}]`);
      filters.push(`${voices.map((_, i) => `[a${i}]`).join("")}amix=inputs=${voices.length}:normalize=0,apad[audio]`);
      filters.push(`[0:v]scale=1920:960,pad=1920:1080:0:0:color=0x182e28,ass=captions.ass,fade=t=in:st=0:d=0.4,fade=t=out:st=${duration - 0.7}:d=0.7[video]`);
      args.push("-filter_complex", filters.join(";"), "-map", "[video]", "-map", "[audio]", "-t", duration.toFixed(3),
        "-r", "25", "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "familycopilot-demo.mp4");
      command(ffmpeg, args, { cwd: output, timeout: 240000 });
      command(ffmpeg, ["-hide_banner", "-loglevel", "error", "-i", "familycopilot-demo.mp4", "-f", "null", "-"], { cwd: output });
      await fs.writeFile(path.join(output, "timeline.json"), JSON.stringify(timeline, null, 2) + "\n");
    }
    const report = { syntheticOnly: true, demoTeam, realScheduleVerified: false,
      narration: smoke ? "not recorded" : "Windows offline Zira voice",
      ...counts, externalBrowserRequests: external.length, pageErrors: pageErrors.length,
      scenes: timeline.length, durationSeconds: timeline.at(-1).end, privateStorageUsed: false, liveServicesTouched: false };
    await fs.writeFile(path.join(output, "verification.json"), JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output: path.relative(root, output), ...report }));
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
    await server.shutdown();
  }
}

main().catch(error => { console.error(`Demo stopped: ${error.message}`); process.exitCode = 1; });