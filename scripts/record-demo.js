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

const chatStory = [
  "A little time together starts with the things your family enjoys.",
  "What could we do together in October? Let's explore a few ideas.",
  "The family calendar appears in the conversation, alongside the planning journey.",
  "A basketball game or a movie? Two ideas to explore, with details still worth checking.",
  "October feels too far away. How about this weekend?",
  "A closer movie option, ready to consider. You decide what happens next."
];

function captureOptions(args) {
  assert.equal(args[0], "--chat-preview");
  if (args.length === 1) return {};
  assert(args.length >= 5 && args.length <= 10, "Use --chat-preview --snapshot <file> --sha256 <reviewed manifest hash> [--review-frame|--review-scenes] [--simulate-loading] [--simulate-calendar] [--viewport=1440x900] [--readable-pacing]");
  const flags = args.slice(5);
  assert(flags.every(flag => ["--review-frame", "--review-scenes", "--simulate-loading", "--simulate-calendar", "--viewport=1440x900", "--readable-pacing"].includes(flag)));
  assert(!flags.includes("--readable-pacing") || flags.includes("--simulate-calendar") && flags.includes("--viewport=1440x900"));
  assert(!flags.includes("--simulate-calendar") || flags.includes("--simulate-loading"));
  assert.equal(new Set(flags).size, flags.length);
  assert(!(flags.includes("--review-frame") && flags.includes("--review-scenes")));
  assert.equal(args[1], "--snapshot"); assert.equal(args[3], "--sha256");
  assert.match(args[4], /^[a-f0-9]{64}$/, "Invalid reviewed snapshot hash");
  return { snapshot: path.resolve(args[2]), snapshotSha256: args[4], reviewFrame: flags.includes("--review-frame"),
    reviewScenes: flags.includes("--review-scenes"), simulateLoading: flags.includes("--simulate-loading"), simulateCalendar: flags.includes("--simulate-calendar"),
    tallViewport: flags.includes("--viewport=1440x900"), readablePacing: flags.includes("--readable-pacing") };
}

function installInvitationDwell() {
  let conversation;
  window.demoInvitationDwellMs = 2500;
  Object.defineProperty(window, "FamilyChatConversation", { configurable: true, get: () => conversation, set(value) {
    conversation = { ...value, createConversation(options) {
      const original = options.prepareInvitation;
      return value.createConversation({ ...options, async prepareInvitation(context) {
        const { signal } = context;
        const dwell = new Promise(resolve => {
          if (signal.aborted) return resolve();
          const done = () => { window.clearTimeout(timer); signal.removeEventListener("abort", done); resolve(); };
          const timer = window.setTimeout(done, 2500);
          signal.addEventListener("abort", done, { once: true });
        });
        await Promise.all([original(context), dwell]);
      } });
    } };
  } });
}

function captureLayout(options) {
  return options.tallViewport
    ? { viewport: { width: 1440, height: 900 }, width: 1440, height: 1020, filter: "pad=1440:1020:0:0:color=0x25291f" }
    : { viewport: { width: 1280, height: 640 }, width: 1920, height: 1080, filter: "scale=1920:960,pad=1920:1080:0:0:color=0x25291f" };
}

function installDemoResponseDelay({ calendarPhases = false } = {}) {
  let activities;
  const wrapped = new Set();
  window.demoTiming = { delayMs: 2000, calls: 0, completed: 0 };
  if (calendarPhases) {
    let calendar;
    window.demoTiming.calendarCalls = 0;
    Object.defineProperty(window, "FamilyChatCalendar", { configurable: true, get: () => calendar, set(value) {
      calendar = { ...value, mountCalendar(...args) {
        const controller = value.mountCalendar(...args);
        return { ...controller,
          async loadSynthetic(...parameters) {
            window.demoTiming.calendarCalls++;
            await new Promise(resolve => window.setTimeout(resolve, 2000));
            return controller.loadSynthetic(...parameters);
          }
        };
      } };
    } });
  }
  Object.defineProperty(window, "FamilyChatActivities", { configurable: true, get: () => activities, set(value) {
    activities = value;
    if (value.searchActivities && !wrapped.has(value.searchActivities)) {
      const searchActivities = async (request, options) => {
        window.demoTiming.calls++;
        await new Promise(resolve => window.setTimeout(resolve, 2000));
        const result = await value.searchActivities(request, options);
        window.demoTiming.completed++;
        return result;
      };
      wrapped.add(searchActivities);
      activities = { ...value, searchActivities };
    }
  } });
}
async function smoothSceneScroll(element) {
  const view = element.ownerDocument.defaultView;
  const started = view.performance.now();
  let previous = view.scrollY, stableFrames = 0;
  element.scrollIntoView({ block: "start", behavior: "smooth" });
  await new Promise((resolve, reject) => {
    const check = () => {
      const elapsed = view.performance.now() - started;
      stableFrames = Math.abs(view.scrollY - previous) < 0.5 ? stableFrames + 1 : 0;
      previous = view.scrollY;
      if (elapsed >= 200 && stableFrames >= 4) return resolve();
      if (elapsed >= 4000) return reject(new Error("Demo scroll did not settle"));
      view.requestAnimationFrame(check);
    };
    view.requestAnimationFrame(check);
  });
}
async function sceneAction(page, action) {
  const locator = page.locator(action.selector);
  if (["click", "press", "type"].includes(action.kind) && locator.evaluate) {
    const visible = await locator.evaluate(element => {
      const bounds = element.getBoundingClientRect();
      const composer = document.querySelector("#chat-composer");
      const bottom = composer && getComputedStyle(composer).position === "fixed" && !composer.contains(element) ? composer.getBoundingClientRect().top : innerHeight;
      return bounds.top >= 0 && bounds.bottom <= bottom;
    });
    if (!visible) await locator.evaluate(smoothSceneScroll);
  }
  if (action.kind === "type") await locator.pressSequentially(action.text, { delay: 65 });
  else if (action.kind === "click") await locator.click();
  else if (action.kind === "press") {
    assert(["Enter", "Space", "Escape"].includes(action.key), "Unapproved key");
    await locator.press(action.key);
  }
  else if (action.kind === "checked") assert.equal(await locator.isChecked(), action.value);
  else if (action.kind === "visible") await locator.waitFor({ state: action.value ? "visible" : "hidden" });
  else if (action.kind === "scroll") await locator.evaluate(smoothSceneScroll);
  else if (action.kind === "count") await page.waitForFunction(({ selector, value }) => document.querySelectorAll(selector).length === value, action);
  else if (action.kind === "text") await page.waitForFunction(({ selector, text }) => document.querySelector(selector)?.textContent.includes(text), action);
  else if (action.kind === "value") assert.equal(await locator.inputValue(), action.text);
  else if (action.kind === "images") {
    const images = await locator.evaluateAll(elements => elements.map(image => image.complete && image.naturalWidth > 0));
    assert(images.length > 0 && images.every(Boolean), "Activity illustrations loaded");
  } else throw Error("Unknown scene action");
}

async function simulatedSearchStarted(page, beforeCalls) {
  await page.waitForFunction(previous => window.demoTiming.calls > previous || document.querySelector("#chat-page").dataset.processing !== "true", beforeCalls);
  return await page.evaluate(() => window.demoTiming.calls) > beforeCalls;
}

async function chatPreview(options) {
  const { loadSnapshot, collectAssets, digest } = require("./demo-snapshot");
  const snapshot = options.snapshot ? loadSnapshot(options.snapshot, options.snapshotSha256) : null;
  const scenario = snapshot?.manifest.scenario;
  const tools = process.env.FAMILYCOPILOT_DEMO_TOOLS;
  assert(tools && path.isAbsolute(tools), "Set FAMILYCOPILOT_DEMO_TOOLS.");
  const { chromium } = require(path.join(tools, "node_modules/playwright"));
  const ffmpeg = require(path.join(tools, "node_modules/ffmpeg-static"));
  const crypto = require("node:crypto");
  const origin = "http://familycopilot.localhost";
  const assets = snapshot?.assets || new Map([...collectAssets(root, [
    "activity-preview/chat-assets/basketball-synthetic.svg", "activity-preview/chat-assets/movie-synthetic.svg"
  ])].map(([name, bytes]) => [`/${name}`, bytes]));
  const hashes = Object.fromEntries([...assets].map(([name, bytes]) => [name, digest(bytes)]));
  const layout = captureLayout(options);
  const reviewOnly = options.reviewFrame || options.reviewScenes;
  const output = await fs.mkdtemp(path.join(root, reviewOnly ? "browser-artifacts/demo/chat-review-" : "browser-artifacts/demo/chat-preview-"));
  const failures = [], timeline = [], expectedMissingImages = [], typingEvidence = [], processingEvidence = [], questionEvidence = [];
  let offlineMovieClick = null;
  const browser = await chromium.launch({ headless: true });
  let context;
  try {
    context = await browser.newContext({ viewport: layout.viewport, deviceScaleFactor: 1,
      locale: "en-US", timezoneId: "Asia/Taipei", serviceWorkers: "block",
      ...(reviewOnly ? {} : { recordVideo: { dir: output, size: layout.viewport } }) });
    await context.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.origin === origin && !url.search && route.request().method() === "GET" &&
        route.request().resourceType() === "image" && scenario?.missingImageAssets?.includes(url.pathname)) {
        expectedMissingImages.push(url.pathname);
        await route.fulfill({ status: 404, body: "", headers: { "Cache-Control": "no-store" } }); return;
      }
      if (url.origin !== origin || url.search || !assets.has(url.pathname) || route.request().method() !== "GET") {
        failures.push("unexpected_request"); await route.abort(); return;
      }
      const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml",
        ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2" };
      await route.fulfill({ body: assets.get(url.pathname), contentType: mime[path.extname(url.pathname)] });
    });
    await context.addInitScript(() => {
      window.demoViolations = [];
      window.demoScrollTrace = [];
      document.addEventListener("scroll", () => {
        if (window.demoScrollTrace.length < 3000) window.demoScrollTrace.push({ at: Date.now(), y: scrollY });
      });
      const deny = () => { window.demoViolations.push("forbidden_io"); throw Error("forbidden_io"); };
      for (const name of ["fetch", "XMLHttpRequest", "WebSocket", "localStorage", "sessionStorage", "indexedDB", "caches"]) {
        Object.defineProperty(window, name, { configurable: true, get: deny });
      }
    });
    if (options.simulateLoading) await context.addInitScript(installDemoResponseDelay, { calendarPhases: Boolean(options.simulateCalendar) });
    if (options.readablePacing) await context.addInitScript(installInvitationDwell);
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on("pageerror", error => failures.push(error.message));
    const video = page.video(), started = Date.now();
    await page.goto(`${origin}/chat/index.html`);
    await page.locator("#chat-input").waitFor({ state: "visible" });
    assert(await page.evaluate(() => isSecureContext && typeof crypto.randomUUID === "function"));
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(900);
    if (options.reviewFrame) {
      const session = await context.newCDPSession(page);
      await session.send("DOM.enable");
      await session.send("CSS.enable");
      const { root: documentNode } = await session.send("DOM.getDocument");
      const { nodeId } = await session.send("DOM.querySelector", { nodeId: documentNode.nodeId, selector: "#preference-teams-summary" });
      const { fonts } = await session.send("CSS.getPlatformFontsForNode", { nodeId });
      await page.screenshot({ path: path.join(output, "font-review.png") });
      assert.deepEqual(await page.evaluate(() => window.demoViolations), []);
      assert.deepEqual(failures, []);
      loadSnapshot(options.snapshot, options.snapshotSha256);
      const report = { output, snapshotSha256: options.snapshotSha256, fonts, forbiddenRequests: failures.length,
        recording: false, sharedServicesTouched: false, humanVisualReview: "pending" };
      await fs.writeFile(path.join(output, "review.json"), JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
      console.log(JSON.stringify(report));
      return;
    }
    const scene = async (index, action, hold = 5500) => {
      const start = (Date.now() - started) / 1000;
      await action();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: path.join(output, `scene-${index + 1}.png`) });
      if (!options.reviewScenes) await page.waitForTimeout(hold);
      timeline.push({ text: scenario ? scenario.scenes[index].text : chatStory[index], start, end: (Date.now() - started) / 1000 });
    };
    if (scenario) {
      for (const [index, shot] of scenario.scenes.entries()) {
        await scene(index, async () => {
          for (const action of shot.actions) {
            const submission = options.simulateLoading && action.kind === "press" && action.selector === "#chat-input" && action.key === "Enter";
            const beforeCalls = submission ? await page.evaluate(() => window.demoTiming.calls) : null;
            const submittedText = submission && options.readablePacing ? await page.locator("#chat-input").inputValue() : "";
            const typing = action.kind === "type" && action.selector === "#chat-input";
            const beforeTyping = typing ? await page.evaluate(() => ({ y: scrollY, composerHeight: document.querySelector("#chat-composer").getBoundingClientRect().height })) : null;
            await sceneAction(page, action);
            if (typing) typingEvidence.push({ scene: index + 1, before: beforeTyping,
              after: await page.evaluate(() => ({ y: scrollY, composerHeight: document.querySelector("#chat-composer").getBoundingClientRect().height })) });
            if (submission && options.simulateCalendar) {
              if (options.readablePacing && submittedText === "Can you check my schedule for the school meeting?") {
                await page.waitForFunction(() => document.querySelector("#chat-page").dataset.processing === "false");
                const question = page.locator("#chat-opening .message-parent");
                await question.waitFor({ state: "visible" });
                await question.evaluate(smoothSceneScroll);
                await question.evaluate(element => window.scrollTo({ top: scrollY + element.getBoundingClientRect().top - 180, behavior: "smooth" }));
                await page.waitForTimeout(600);
                const start = (Date.now() - started) / 1000;
                await page.screenshot({ path: path.join(output, "school-question-visible.png") });
                await page.waitForTimeout(2000);
                const bounds = await question.boundingBox();
                assert(bounds && bounds.y >= 0 && bounds.y + bounds.height < layout.viewport.height - 160);
                assert.equal(await question.locator("p").innerText(), submittedText);
                questionEvidence.push({ start, end: (Date.now() - started) / 1000, text: submittedText, bounds });
              }
              const seen = new Set();
              const processingStarted = Date.now();
              while (await page.locator("#chat-page").getAttribute("data-processing") === "true") {
                assert(Date.now() - processingStarted < 12000, "Capture-only processing did not settle");
                const status = page.locator("#chat-status"), text = await status.innerText();
                if (await page.locator("#chat-page").getAttribute("data-processing") !== "true" || !await status.isVisible()) break;
                if (await status.getAttribute("data-action") === "send_demo_invitation") {
                  const evidence = await status.evaluate(element => {
                    const bounds = element.getBoundingClientRect();
                    return { text: element.textContent, transform: getComputedStyle(element, "::before").transform,
                      x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
                      visible: bounds.y >= 0 && bounds.bottom <= innerHeight, at: Date.now() };
                  });
                  processingEvidence.push({ ...evidence, scene: index + 1, time: (evidence.at - started) / 1000 });
                }
                if (!seen.has(text)) {
                  seen.add(text);
                  const bounds = await status.boundingBox();
                  if (!bounds && await page.locator("#chat-page").getAttribute("data-processing") !== "true") break;
                  if (options.readablePacing && (!bounds || bounds.y < 0 || bounds.y + bounds.height > layout.viewport.height)) { await page.waitForTimeout(100); continue; }
                  assert(bounds && bounds.y >= 0 && bounds.y + bounds.height <= layout.viewport.height);
                  await page.screenshot({ path: path.join(output, `processing-${index + 1}-${seen.size}.png`) });
                }
                await page.waitForTimeout(100);
              }
            } else if (submission && await simulatedSearchStarted(page, beforeCalls)) {
              await page.waitForFunction(() => document.querySelector("#chat-page").dataset.processing === "true");
              await page.waitForTimeout(350);
              const status = page.locator("#chat-status");
              assert.match(await status.innerText(), /Loading|Searching|Finding/);
              const bounds = await status.boundingBox();
              assert(bounds && bounds.y >= 0 && bounds.y + bounds.height <= layout.viewport.height, "UI processing status must stay in view");
              await page.screenshot({ path: path.join(output, `processing-${index + 1}.png`) });
              await page.waitForFunction(() => document.querySelector("#chat-page").dataset.processing === "false");
            }
          }
        }, shot.holdMs);
      }
    } else {
    await scene(0, async () => {});
    await scene(1, async () => {
      await page.locator("#chat-input").pressSequentially("What could we do together in October?", { delay: 65 });
    }, 1600);
    await scene(2, async () => {
      await page.locator("#chat-send").click();
      await page.waitForFunction(() => document.querySelectorAll("#activity-results article").length === 2);
      assert.match(await page.locator("#chat-calendar-status").textContent(), /Parent A: Loaded/);
      await page.locator("#calendar-conversation").scrollIntoViewIfNeeded();
    });
    await scene(3, async () => {
      await page.locator("#activity-results").evaluate(element => element.scrollIntoView({ block: "start", behavior: "instant" }));
      const images = await page.locator("#activity-results img").evaluateAll(elements => elements.map(image => image.complete && image.naturalWidth > 0));
      assert(images.length > 0 && images.every(Boolean), "Activity illustrations loaded");
    }, 6500);
    await scene(4, async () => {
      await page.locator("#chat-input").pressSequentially("October feels too far away. How about this weekend?", { delay: 65 });
    }, 1500);
    await scene(5, async () => {
      await page.locator("#chat-send").click();
      await page.waitForFunction(() => document.querySelectorAll("#activity-results article").length === 1);
      await page.locator("#activity-results article").scrollIntoViewIfNeeded();
      assert.match(await page.locator("#activity-results").textContent(), /Skybound/);
      assert.match(await page.locator("#chat-messages").textContent(), /2026-09-19/);
      assert.equal(await page.locator("#availability-start").inputValue(), "2026-10-09");
    }, 7000);
    }
    if (options.readablePacing) {
      const scene = scenario.scenes.find(shot => shot.text === "Sharing school responsibilities.");
      assert(scene);
      for (const action of scene.actions) await sceneAction(page, action);
      for (const shot of scenario.scenes.slice(0, 4)) for (const action of shot.actions) await sceneAction(page, action);
      const link = page.locator('a[href="https://www.vscinemas.com.tw/vsweb/film/detail.aspx?id=8786"]').first();
      await link.evaluate(smoothSceneScroll);
      const bounds = await link.boundingBox(); assert(bounds);
      await page.evaluate(() => {
        const cursor = document.createElement("div"); cursor.id = "demo-cursor";
        cursor.style.cssText = "position:fixed;z-index:2147483646;width:18px;height:18px;border:2px solid #355e50;background:#ffffff80;border-radius:50%;pointer-events:none;left:-40px;top:-40px;transform:translate(-50%,-50%)";
        document.body.append(cursor);
        document.addEventListener("mousemove", event => { cursor.style.left = `${event.clientX}px`; cursor.style.top = `${event.clientY}px`; });
      });
      const target = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
      const origin = { x: target.x - 200, y: target.y - 100 };
      await page.mouse.move(origin.x, origin.y);
      const start = (Date.now() - started) / 1000, positions = [];
      for (let step = 1; step <= 25; step++) {
        const fraction = step / 25, eased = fraction * fraction * (3 - 2 * fraction);
        await page.mouse.move(origin.x + (target.x - origin.x) * eased, origin.y + (target.y - origin.y) * eased);
        positions.push({ time: (Date.now() - started) / 1000, fraction });
        await page.waitForTimeout(40);
      }
      const hoverStart = (Date.now() - started) / 1000;
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(output, "movie-hover.png") });
      await link.evaluate(element => element.addEventListener("click", event => { event.preventDefault(); window.demoInterceptedMovieClick = true; }, { once: true }));
      const clickAt = (Date.now() - started) / 1000;
      await page.mouse.click(target.x, target.y);
      assert(await page.evaluate(() => window.demoInterceptedMovieClick === true));
      await page.waitForTimeout(240);
      offlineMovieClick = { start, hoverStart, clickAt, end: (Date.now() - started) / 1000, positions, target, intercepted: true, navigationRequests: 0 };
    }
    assert.deepEqual(await page.evaluate(() => window.demoViolations), []);
    assert.deepEqual(failures, []);
    const timing = options.simulateLoading ? await page.evaluate(() => window.demoTiming) : null;
    if (timing) {
      assert.equal(timing.calls, options.readablePacing ? 4 : 2); assert.equal(timing.completed, options.readablePacing ? 4 : 2); assert.equal(timing.delayMs, 2000);
      if (options.simulateCalendar) assert.equal(timing.calendarCalls, options.readablePacing ? 3 : 2);
    }
    const scrollTrace = (await page.evaluate(() => window.demoScrollTrace)).map(sample => ({ time: (sample.at - started) / 1000, y: sample.y }));
    await fs.writeFile(path.join(output, "scroll-trace.json"), JSON.stringify(scrollTrace, null, 2) + "\n", { flag: "wx" });
    if (options.reviewScenes) {
      loadSnapshot(options.snapshot, options.snapshotSha256);
      const report = { output, snapshotSha256: options.snapshotSha256, viewport: layout.viewport, scenes: timeline.length,
        forbiddenRequests: 0, expectedMissingImages, typingEvidence, processingEvidence, questionEvidence, offlineMovieClick, browserErrors: 0, recording: false, simulatedResponseTiming: timing, humanVisualReview: "pending" };
      await fs.writeFile(path.join(output, "review.json"), JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
      console.log(JSON.stringify(report));
      return;
    }
    await context.close(); context = null;
    const raw = await video.path(), duration = Math.ceil(timeline.at(-1).end * 25) / 25;
    const srt = timeline.map((scene, index) => `${index + 1}\n${timestamp(scene.start)} --> ${timestamp(scene.end)}\n${scene.text}\n`).join("\n");
    await fs.writeFile(path.join(output, "familycopilot-chat.en.srt"), srt, { flag: "wx" });
    const assTime = seconds => timestamp(seconds, ".").replace(/^0/, "").slice(0, -1);
    const header = "[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Caption,DejaVu Sans,30,&H00FFFFFF,&H00FFFFFF,&H001F2925,&H001F2925,0,0,0,0,100,100,0,0,1,0,0,2,100,100,40,1\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n";
    const captionHeader = header.replace("PlayResX: 1920", `PlayResX: ${layout.width}`).replace("PlayResY: 1080", `PlayResY: ${layout.height}`);
    await fs.writeFile(path.join(output, "captions.ass"), captionHeader + timeline.map(scene =>
      `Dialogue: 0,${assTime(scene.start)},${assTime(scene.end)},Caption,,0,0,0,,${scene.text}\n`).join(""), { flag: "wx" });
    command(ffmpeg, ["-nostdin", "-hide_banner", "-loglevel", "error", "-n", "-i", raw, "-vf",
      `tpad=stop_mode=clone:stop_duration=${duration},${layout.filter},ass=captions.ass`, "-t", duration.toFixed(3),
      "-r", "25", "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-pix_fmt", "yuv420p", "-an",
      "-movflags", "+faststart", "familycopilot-chat-preview.mp4"], { cwd: output, timeout: 240000 });
    command(ffmpeg, ["-nostdin", "-hide_banner", "-loglevel", "error", "-i", "familycopilot-chat-preview.mp4", "-f", "null", "-"], { cwd: output });
    command(ffmpeg, ["-nostdin", "-hide_banner", "-loglevel", "error", "-n", "-ss", String(Math.max(0, duration - 2)),
      "-i", "familycopilot-chat-preview.mp4", "-frames:v", "1", "final-frame.png"], { cwd: output });
    if (snapshot) loadSnapshot(options.snapshot, snapshot.manifestSha256);
    const manifest = { output, durationSeconds: duration, width: layout.width, height: layout.height, viewport: layout.viewport, timeline, sourceHashes: hashes,
      snapshot: snapshot ? { path: options.snapshot, sha256: snapshot.manifestSha256, scenario } : null,
      rawFile: path.basename(raw), rawSha256: crypto.createHash("sha256").update(await fs.readFile(raw)).digest("hex"),
      videoSha256: crypto.createHash("sha256").update(await fs.readFile(path.join(output, "familycopilot-chat-preview.mp4"))).digest("hex"),
      syntheticOnly: true, forbiddenRequests: failures.length, expectedMissingImages, typingEvidence, processingEvidence, questionEvidence, offlineMovieClick, browserErrors: 0, fullDecodePassed: true,
      narration: "none: captioned review cut; English Jenny narration pending approval", liveServicesTouched: false,
      calendarFit: "not_checked", realTeamIncluded: snapshot ? null : false,
      activityEvidence: scenario?.activityEvidence || "synthetic", simulatedResponseTiming: timing,
      continuousCapture: true, sceneScrolling: "native smooth", scrollTrace: "scroll-trace.json", humanReview: "pending" };
    await fs.writeFile(path.join(output, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", { flag: "wx" });
    console.log(JSON.stringify({ output, durationSeconds: duration, fullDecodePassed: true }));
  } finally {
    if (context) await context.close();
    await browser.close();
  }
}

const movieSourceUrl = "https://www.vscinemas.com.tw/vsweb/film/detail.aspx?id=8786";
function allowedMovieRequest(url, method, type) {
  if (method !== "GET" || url.protocol !== "https:") return false;
  if (type === "document") return url.href === movieSourceUrl;
  return ["script", "stylesheet", "image", "font"].includes(type) &&
    ["www.vscinemas.com.tw", "www.unicornpopcorn.com.tw", "ajax.googleapis.com", "cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com"].includes(url.hostname);
}
async function recordMovieSource(options) {
  const { loadSnapshot, digest } = require("./demo-snapshot");
  const snapshot = loadSnapshot(options.snapshot, options.snapshotSha256);
  assert.equal(snapshot.manifest.scenario.scenes[4].text, "This movie could be a fun weekend option.");
  const tools = process.env.FAMILYCOPILOT_DEMO_TOOLS; assert(tools && path.isAbsolute(tools));
  const { chromium } = require(path.join(tools, "node_modules/playwright"));
  const ffmpeg = require(path.join(tools, "node_modules/ffmpeg-static"));
  const output = await fs.mkdtemp(path.join(root, "browser-artifacts/demo/movie-source-"));
  const save = (name, value) => fs.writeFile(path.join(output, name), JSON.stringify(value, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  await save("attempt.json", { target: movieSourceUrl, approval: "Owner requested clicking the real Chiikawa link for v2 video", maximumDocumentRequests: 1, automaticRetries: 0, snapshotSha256: options.snapshotSha256 });
  const browser = await chromium.launch({ headless: true });
  let context, publicEnabled = false, documentRequests = 0, officialStarted = 0;
  const allowed = [], blocked = [], errors = [];
  try {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1,
      locale: "en-US", timezoneId: "Asia/Taipei", serviceWorkers: "block",
      recordVideo: { dir: output, size: { width: 1440, height: 900 } } });
    await context.route("**/*", async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin === "http://familycopilot.localhost" && !url.search && request.method() === "GET" && snapshot.assets.has(url.pathname)) {
        const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2" };
        return route.fulfill({ body: snapshot.assets.get(url.pathname), contentType: mime[path.extname(url.pathname)] });
      }
      if (publicEnabled && allowedMovieRequest(url, request.method(), request.resourceType()) && allowed.length < 120) {
        if (request.resourceType() === "document" && ++documentRequests > 1) { blocked.push("extra_document"); return route.abort(); }
        allowed.push({ url: url.href, type: request.resourceType() }); return route.continue();
      }
      blocked.push({ url: url.origin + url.pathname, type: request.resourceType(), method: request.method() }); return route.abort();
    });
    await context.addInitScript(() => {
      if (location.hostname !== "familycopilot.localhost") return;
      const deny = () => { throw Error("Synthetic application forbids external IO"); };
      for (const name of ["fetch", "XMLHttpRequest", "WebSocket", "localStorage", "sessionStorage", "indexedDB", "caches"]) {
        Object.defineProperty(window, name, { configurable: true, get: deny });
      }
      document.addEventListener("DOMContentLoaded", () => {
        const cursor = document.createElement("div");
        cursor.style.cssText = "position:fixed;z-index:2147483646;width:18px;height:18px;border:2px solid #355e50;background:#ffffff80;border-radius:50%;pointer-events:none;left:-40px;top:-40px;transform:translate(-50%,-50%)";
        document.body.append(cursor);
        document.addEventListener("mousemove", event => { cursor.style.left = `${event.clientX}px`; cursor.style.top = `${event.clientY}px`; });
      });
    });
    const page = await context.newPage(), appVideo = page.video(), appStarted = Date.now();
    page.setDefaultTimeout(10000); page.on("pageerror", error => errors.push(error.message));
    await page.goto("http://familycopilot.localhost/chat/index.html");
    await page.evaluate(() => document.fonts.ready);
    for (const scene of snapshot.manifest.scenario.scenes.slice(0, 5)) for (const action of scene.actions) await sceneAction(page, action);
    assert.deepEqual(errors, []); assert.equal(blocked.length, 0);
    const link = page.locator(`#activity-results a[href="${movieSourceUrl}"]`).first();
    assert.equal(await link.getAttribute("rel"), "noopener noreferrer");
    await link.scrollIntoViewIfNeeded();
    const bounds = await link.boundingBox(); assert(bounds);
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, { steps: 14 });
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(output, "link-before-click.png") });
    publicEnabled = true;
    const popup = context.waitForEvent("page");
    const clickAt = (Date.now() - appStarted) / 1000;
    await link.click();
    const official = await popup, officialVideo = official.video(); officialStarted = Date.now();
    await official.waitForLoadState("domcontentloaded", { timeout: 45000 });
    assert.equal(official.url(), movieSourceUrl);
    await official.locator("h2").filter({ hasText: "CHIIKAWA THE MOVIE THE SECRET OF THE MERMAID ISLAND" }).waitFor({ state: "visible", timeout: 10000 });
    await official.waitForFunction(() => [...document.images].some(image => image.src.includes("film_20260604010.jpg") && image.complete && image.naturalWidth > 0), null, { timeout: 10000 });
    await official.locator("h1").first().scrollIntoViewIfNeeded();
    await official.evaluate(() => document.fonts.ready);
    await official.screenshot({ path: path.join(output, "official-page.png") });
    const officialReady = (Date.now() - officialStarted) / 1000;
    await official.waitForTimeout(5000);
    assert.equal(documentRequests, 1); assert.deepEqual(errors, []);
    loadSnapshot(options.snapshot, options.snapshotSha256);
    await context.close(); context = null;
    const appRaw = await appVideo.path(), officialRaw = await officialVideo.path();
    const filter = `[0:v]trim=start=${clickAt - .6}:end=${clickAt + .2},setpts=PTS-STARTPTS,fps=25,settb=AVTB[click];[1:v]trim=start=${officialReady + .4}:end=${officialReady + 4.2},setpts=PTS-STARTPTS,fps=25,settb=AVTB[official];[click][official]concat=n=2:v=1:a=0,pad=1440:1020:0:0:color=0x25291f[video]`;
    command(ffmpeg, ["-nostdin", "-hide_banner", "-loglevel", "error", "-n", "-i", appRaw, "-i", officialRaw,
      "-filter_complex", filter, "-map", "[video]", "-an", "-t", "4.6", "-r", "25", "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "familycopilot-movie-source.mp4"], { cwd: output });
    command(ffmpeg, ["-nostdin", "-hide_banner", "-loglevel", "error", "-i", "familycopilot-movie-source.mp4", "-f", "null", "-"], { cwd: output });
    const manifest = { version: 1, kind: "familycopilot.demo.public-movie-source", videoFile: "familycopilot-movie-source.mp4",
      videoSha256: digest(await fs.readFile(path.join(output, "familycopilot-movie-source.mp4"))), durationSeconds: 4.6, width: 1440, height: 1020,
      clickedHref: movieSourceUrl, officialUrl: movieSourceUrl, documentRequests, allowed, blocked, fullDecodePassed: true,
      raw: [{ file: path.basename(appRaw), sha256: digest(await fs.readFile(appRaw)) }, { file: path.basename(officialRaw), sha256: digest(await fs.readFile(officialRaw)) }],
      clickAt, officialReady, snapshot: { path: options.snapshot, sha256: options.snapshotSha256 }, browserErrors: errors,
      bookingActions: 0, privateCalendarReads: 0, sharedServicesTouched: false, capturedAt: new Date().toISOString(),
      limitations: ["Live public movie details only. No screening, availability, ticket purchase or booking verified.", "One real link click; loading trimmed between separate app and official-page videos.", "Third-party tracking, frames and non-GET calls blocked. No shared browser or prior login state."], visualReview: "pending" };
    await save("manifest.json", manifest); console.log(JSON.stringify({ output, documentRequests, allowed: allowed.length, blocked: blocked.length, fullDecodePassed: true }));
  } catch (error) {
    await save("failure.json", { message: error.message, documentRequests, allowed, blocked, automaticRetry: false }); throw error;
  } finally { if (context) await context.close(); await browser.close(); }
}
module.exports = { chatStory, timestamp, subtitleChunks, captureOptions, captureLayout, sceneAction, smoothSceneScroll, installDemoResponseDelay, installInvitationDwell, simulatedSearchStarted, allowedMovieRequest };
if (require.main === module) {
  Promise.resolve().then(() => process.argv[2] === "--movie-source-approved" ? recordMovieSource(captureOptions(["--chat-preview", ...process.argv.slice(3)])) : process.argv.includes("--chat-preview") ? chatPreview(captureOptions(process.argv.slice(2))) : main()).catch(error => {
    console.error(`Demo stopped: ${error.message}`); process.exitCode = 1;
  });
}