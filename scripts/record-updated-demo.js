"use strict";
// Local approved recording: saved-only calendars, one explicit public search.
// Never Sync, reset, restart a service, or touch an existing browser tab.
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const { createHash } = require("node:crypto"), { spawnSync } = require("node:child_process");
const { allowedRequest } = require("./record-real-calendar-demo");
const { wavInfo, chunks, stamp } = require("./finish-integrated-demo");
const root = path.resolve(__dirname, ".."), origin = "http://127.0.0.1:8002";
const previous = path.join(root, "browser-artifacts/demo/real-calendar-LHXjcP");
const voiceRoot = path.join(root, "browser-artifacts/demo/integrated-20260918/jenny-story");
const intro = path.join(root, "browser-artifacts/demo/family-intro-6gKRQp/familycopilot-family-intro.mp4");
const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const hash = file => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const write = (dir, name, value) => fs.writeFileSync(path.join(dir, name), JSON.stringify(value, null, 2) + "\n", { flag: "wx", mode: 0o600 });
function permittedSearch(url, method, body) {
  return url.origin === origin && url.pathname === "/api/activities/basketball" && method === "POST" &&
    body?.startDate === "2026-10-09" && body.endDate === "2026-10-11" && body.teamMode === "only" &&
    Array.isArray(body.teamIds) && body.teamIds.length === 1 && body.teamIds[0] === `tpbl:name:${encodeURIComponent("中信特攻")}`;
}
function voices() {
  const bridge = path.join(previous, "complete-story"), script = read(path.join(bridge, "script.json"));
  const activity = read(path.join(voiceRoot, "narration-plan.json"));
  const clips = [...read(path.join(bridge, "audio.json")).map((a, i) => ({ ...a, text: script.narration[i], file: path.join(bridge, a.file) })),
    ...read(path.join(voiceRoot, "audio.json")).slice(3).map((a, i) => ({ ...a, text: activity[i + 3].text, file: path.join(voiceRoot, a.file) }))];
  for (const clip of clips) {
    assert.equal(wavInfo(fs.readFileSync(clip.file)).seconds, clip.seconds);
    if (clip.sha256) assert.equal(hash(clip.file), clip.sha256);
  }
  return { clips, introText: script.introText };
}
function sourceHashes() {
  const files = ["shell.css", "styles.css", ...["owner", "activity-preview", "shared"].flatMap(dir =>
    fs.readdirSync(path.join(root, dir)).filter(f => /\.(js|css|html)$/.test(f)).map(f => `${dir}/${f}`))];
  return Object.fromEntries(files.map(f => [f, hash(path.join(root, f))]));
}
function captionCues(capture, clips, introText) {
  const shift = time => 15.2 + time - capture.captureStart;
  return [{ start: 0.35, seconds: 12.992208333333334, text: introText },
    { ...clips[0], start: 14.65 }, { ...clips[1], start: shift(capture.calendarSecondVoice) },
    ...capture.scenes.slice(1).map((s, i) => ({ ...clips[i + 2], start: shift(s.start) + s.delay }))];
}
async function record() {
  assert.equal((await require("./owner-local-status").inspectLocalOwner()).safeIdle, true);
  const { clips } = voices(), hashes = sourceHashes();
  const tools = process.env.FAMILYCOPILOT_DEMO_TOOLS; assert(tools && path.isAbsolute(tools));
  const { chromium } = require(path.join(tools, "node_modules/playwright"));
  const output = fs.mkdtempSync(path.join(root, "browser-artifacts/demo/updated-ux-")); fs.chmodSync(output, 0o700);
  const counts = { parentSaved: 0, childSaved: 0, cleanup: 0, publicSearch: 0, blocked: 0 };
  const browser = await chromium.launch({ headless: true }); let context;
  let phase = "setup", allowSearch = false, allowOfficial = false, sourceResult;
  const errors = [], blocked = new Set(), scenes = [];
  try {
    context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1,
      locale: "en-US", timezoneId: "Asia/Taipei", reducedMotion: "reduce", serviceWorkers: "block", bypassCSP: true,
      recordVideo: { dir: output, size: { width: 1600, height: 900 } } });
    await context.route("**/*", async route => {
      const req = route.request(), url = new URL(req.url()); let body;
      try { body = req.postDataJSON(); } catch { /* GET */ }
      if (permittedSearch(url, req.method(), body) && allowSearch && counts.publicSearch === 0) {
        counts.publicSearch++; return route.continue();
      }
      if (allowedRequest(url, req.method(), body)) {
        if (url.pathname === "/api/availability") { if (counts.parentSaved++) return route.abort(); }
        else if (url.pathname === "/api/child/saved") { if (counts.childSaved++) return route.abort(); }
        else if (url.pathname.startsWith("/api/")) counts.cleanup++;
        return route.continue();
      }
      if (allowOfficial && url.protocol === "https:" && req.method() === "GET" &&
        (url.hostname === "tpbl.basketball" || url.hostname.endsWith(".tpbl.basketball") ||
          ["fonts.googleapis.com", "fonts.gstatic.com", "cdn.jsdelivr.net"].includes(url.hostname))) return route.continue();
      counts.blocked++; blocked.add(url.origin + url.pathname); return route.abort();
    });
    await context.addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        const mask = () => {
          for (const el of document.querySelectorAll(".child-event,.child-all-day")) {
            const parts = el.textContent.split(" · "); el.textContent = ["Event", ...parts.slice(1)].join(" · ");
            el.removeAttribute("title"); el.setAttribute("aria-label", el.textContent);
          }
        };
        const observer = new MutationObserver(() => { observer.disconnect(); mask(); observer.observe(document.body, { childList: true, subtree: true }); });
        mask(); observer.observe(document.body, { childList: true, subtree: true });
        const cursor = document.createElement("div"); cursor.id = "recording-cursor";
        cursor.style.cssText = "position:fixed;z-index:2147483647;width:20px;height:20px;border:2px solid #624199;background:#ffffff99;border-radius:50%;pointer-events:none;left:-50px;top:-50px;transform:translate(-50%,-50%);box-shadow:0 0 0 5px #62419920";
        document.body.append(cursor);
        document.addEventListener("mousemove", e => { cursor.style.left = `${e.clientX}px`; cursor.style.top = `${e.clientY}px`; });
        document.addEventListener("mousedown", () => { cursor.style.background = "#b7a1df"; });
        document.addEventListener("mouseup", () => { cursor.style.background = "#ffffff99"; });
      });
    });
    const page = await context.newPage(), raw = page.video(), clock = Date.now();
    const now = () => (Date.now() - clock) / 1000;
    page.on("pageerror", () => errors.push("app_page_error"));
    const click = async selector => {
      const el = page.locator(selector).first(); await el.scrollIntoViewIfNeeded(); const box = await el.boundingBox(); assert(box);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 });
      await page.waitForTimeout(450); await page.mouse.down(); await page.waitForTimeout(140); await page.mouse.up();
      await page.waitForTimeout(400);
    };
    const until = async time => { const ms = (time - now()) * 1000; if (ms > 0) await page.waitForTimeout(ms); };
    const shot = name => page.screenshot({ path: path.join(output, `${name}.png`) });
    phase = "saved_calendar";
    await page.goto(origin, { waitUntil: "networkidle" });
    assert.equal(await page.locator('meta[name="owner-mode"]').getAttribute("content"), "live");
    assert.equal(await page.locator("#availability-start").inputValue(), "2026-10-09");
    assert.equal(await page.locator("#availability-end").inputValue(), "2026-10-11");
    await page.waitForFunction(() => !document.querySelector("#availability-saved").disabled);
    await page.locator("#availability-saved").evaluate(el => el.click());
    // Parent rendering can finish before the separate child saved-view callback.
    // Wait for all three status flags, not merely the first parent grid paint.
    await page.waitForFunction(() => document.querySelectorAll(".week-run").length > 0 &&
      !document.querySelector("#availability-saved").disabled &&
      [0, 1, 2].every(i => document.querySelector(`#calendar-person-${i}`).dataset.loaded === "true"), {}, { timeout: 30000 });
    const state = await page.evaluate(() => ({
      parentBlocks: document.querySelectorAll(".week-run").length,
      childBlocks: document.querySelectorAll(".child-event,.child-all-day").length,
      allLoaded: [0, 1, 2].every(i => /· Loaded/.test(document.querySelector(`#calendar-person-${i}`).getAttribute("aria-label"))),
      urgent: [...document.querySelectorAll('[data-urgent="true"]')].some(el => !el.hidden),
      sample: /sample/i.test(document.querySelector("#owner-source-badge").textContent)
    }));
    assert(state.allLoaded && state.parentBlocks > 0 && !state.urgent && !state.sample, "Saved calendar not ready");
    // Establish top-of-page framing BEFORE the take. Never move the calendar grid.
    await page.evaluate(() => { document.activeElement?.blur(); scrollTo(0, 0); });
    await page.waitForTimeout(500);
    const baseline = await page.evaluate(() => {
      const grid = document.querySelector("#availability-grid");
      window.__calendarScrolls = 0;
      window.addEventListener("scroll", () => window.__calendarScrolls++);
      grid.addEventListener("scroll", () => window.__calendarScrolls++);
      return { pageY: scrollY, gridY: grid.scrollTop };
    });
    assert.equal(baseline.pageY, 0);
    const captureStart = now(), calendarSecondVoice = captureStart + clips[0].seconds + 0.65;
    await shot("calendar");
    await until(calendarSecondVoice + clips[1].seconds + 0.6);
    scenes.push({ kind: "calendar", start: captureStart, end: now(), delay: 0 });
    phase = "activities_transition";
    const transitionStart = now(), nav = page.locator('.shell-nav a[href="/activities"]'), box = await nav.boundingBox();
    assert(box && box.y >= 0 && box.y + box.height <= 900);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 30 });
    await page.waitForTimeout(800); await shot("activities-hover");
    const scrollCheck = await page.evaluate(() => ({ count: window.__calendarScrolls, pageY: scrollY, gridY: document.querySelector("#availability-grid").scrollTop }));
    assert.deepEqual(scrollCheck, { count: 0, ...baseline });
    const clickTime = now(); await page.mouse.down(); await page.waitForTimeout(160); await page.mouse.up();
    await page.waitForURL(origin + "/activities");
    assert.equal(await page.locator("#activity-start").inputValue(), "2026-10-09");
    assert.equal(await page.locator("#activity-end").inputValue(), "2026-10-11");
    const activitiesVisible = now(); await shot("activities");
    await until(transitionStart + clips[2].seconds + 1);
    scenes.push({ kind: "transition", start: transitionStart, end: now(), delay: 0.15, clickTime, activitiesVisible });
    phase = "preferences";
    const selectionStart = now();
    await click('label:has(input[name="interest"][value="sports"])');
    await click('label:has(input[name="sport"][value="basketball"])');
    const basketballSelected = now();
    await page.locator("#team-name").pressSequentially("中信特攻", { delay: 180 });
    await click("#add-team"); assert.equal(await page.locator("#preferred-teams li").count(), 1);
    const delay = Math.max(6, now() - selectionStart + 0.3);
    await shot("basketball"); await until(selectionStart + delay + clips[3].seconds + 0.7);
    scenes.push({ kind: "preferences", start: selectionStart, end: now(), delay, basketballSelected });
    phase = "public_search";
    const searchStart = now(); allowSearch = true;
    const response = page.waitForResponse(origin + "/api/activities/basketball", { timeout: 40000 });
    await click("#find"); const result = await response; sourceResult = await result.json();
    assert(result.ok() && sourceResult.synthetic !== true && sourceResult.games?.length > 0);
    assert(sourceResult.games.every(g => /中信特攻/.test(g.home + g.away)));
    await page.locator("#basketball-games article").first().waitFor({ state: "visible" });
    await page.locator("#basketball-games").evaluate(el => el.scrollIntoView({ block: "center" }));
    const searchDelay = now() - searchStart + 0.3;
    await shot("results"); await until(searchStart + searchDelay + clips[4].seconds + 0.7);
    scenes.push({ kind: "results", start: searchStart, end: now(), delay: searchDelay });
    write(output, "public-search.json", sourceResult);
    phase = "game_details";
    const detailStart = now(); await click("#basketball-games article button");
    await page.locator("#basketball-games article details").first().evaluate(el => el.scrollIntoView({ block: "center" }));
    await shot("game"); await until(detailStart + clips[5].seconds + 0.7);
    const link = page.locator("#basketball-games article a").first(), officialUrl = await link.getAttribute("href");
    assert(/^https:\/\/tpbl\.basketball\/schedule\/[1-9]\d{0,6}$/.test(officialUrl));
    assert.equal(await link.getAttribute("rel"), "noopener noreferrer");
    allowOfficial = true;
    const popup = context.waitForEvent("page"); await click("#basketball-games article a");
    const official = await popup, officialRaw = official.video();
    const captureEnd = now(); scenes.push({ kind: "details", start: detailStart, end: captureEnd, delay: 0.15 });
    phase = "official_page";
    await official.waitForLoadState("domcontentloaded", { timeout: 45000 }); await official.waitForTimeout(4000);
    assert.equal(new URL(official.url()).hostname, "tpbl.basketball");
    await official.screenshot({ path: path.join(output, "official.png") }); await official.waitForTimeout(19000);
    // Official clip uses a verified settled-frame trim; its narration begins after the cut.
    scenes.push({ kind: "official", start: captureEnd, delay: 0.2, duration: clips[6].seconds + 1.2 });
    assert.equal(counts.parentSaved, 1); assert.equal(counts.childSaved, 1); assert.equal(counts.publicSearch, 1);
    assert.deepEqual(errors, []); assert([...blocked].every(u => !u.startsWith(origin)));
    await context.close(); context = null;
    assert.deepEqual(sourceHashes(), hashes, "Application changed during recording");
    write(output, "capture.json", { raw: path.basename(await raw.path()), officialRaw: path.basename(await officialRaw.path()),
      captureStart, captureEnd, calendarSecondVoice, scenes, ...state, counts, calendarScrolls: scrollCheck.count,
      calendarProviderRequests: 0, savedViewOnly: true, syntheticCalendars: false, childNamesMasked: true,
      continuousCalendarToActivities: true, officialUrl, blockedResources: [...blocked], sourceHashes: hashes,
      serviceChanges: 0, recordedAt: new Date().toISOString() });
    console.log(JSON.stringify({ output: path.relative(root, output), counts, calendarScrolls: 0, continuousCalendarToActivities: true, allLoaded: state.allLoaded }));
  } catch (error) {
    write(output, "failed.json", { phase, counts, automaticRetry: false });
    console.error(JSON.stringify({ output: path.relative(root, output), phase, counts, automaticRetry: false })); throw error;
  } finally { if (context) await context.close(); await browser.close(); }
}
function render(directory, alignedCaptions = false) {
  const source = path.resolve(directory); assert(source.startsWith(path.join(root, "browser-artifacts/demo/updated-ux-")));
  const c = read(path.join(source, "capture.json")), { clips, introText } = voices();
  assert(c.continuousCalendarToActivities && c.calendarScrolls === 0 && c.calendarProviderRequests === 0 && c.allLoaded && !c.syntheticCalendars);
  const tools = process.env.FAMILYCOPILOT_DEMO_TOOLS; assert(tools && path.isAbsolute(tools));
  const ffmpeg = require(path.join(tools, "node_modules/ffmpeg-static"));
  const output = path.join(source, alignedCaptions ? "caption-timed" : "finished");
  const cues = captionCues(c, clips, introText), appSeconds = c.captureEnd - c.captureStart;
  const duration = Math.ceil((15.2 + appSeconds + c.scenes.at(-1).duration) * 25) / 25;
  for (let i = 1; i < cues.length; i++) assert(cues[i - 1].start + cues[i - 1].seconds <= cues[i].start);
  const inputs = [intro, path.join(source, c.raw), path.join(source, c.officialRaw), ...clips.map(a => a.file)];
  const hashes = Object.fromEntries(inputs.map(f => [f, hash(f)]));
  let alignment;
  if (alignedCaptions) {
    // Fix subtitles without silently changing the approved visuals or voice timing.
    assert.deepEqual(read(path.join(source, "finished/timeline.json")).cues, cues);
    assert.deepEqual(read(path.join(source, "finished/input-hashes.json")), hashes);
    alignment = require("./demo-captions").measureCaptions(cues.map((cue, i) => ({ ...cue,
      file: i === 0 ? path.join(voiceRoot, "voice-1.wav") : cue.file })), ffmpeg);
  }
  fs.mkdirSync(output, { mode: 0o700 });
  write(output, "input-hashes.json", hashes); write(output, "timeline.json", { duration, cues, capture: c });
  if (alignment) write(output, "caption-alignment.json", alignment);
  let ass = fs.readFileSync(path.join(previous, "finished/captions.ass"), "utf8").split("[Events]")[0] + "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n";
  if (alignment) ass = ass.replace("Caption,DejaVu Sans,30,", "Caption,DejaVu Sans,28,")
    .replace(",3,12,0,2,65,65,28,1", ",3,8,0,2,65,65,24,1");
  let srt = "", number = 0;
  for (const cue of alignment?.cues || cues) {
    if (alignment) {
      const lines = require("./demo-captions").wrapCaption(cue.text), end = cue.start + cue.seconds;
      ass += `Dialogue: 0,${stamp(cue.start, true)},${stamp(end, true)},Caption,,0,0,0,,${lines.join("\\N")}\n`;
      srt += `${++number}\n${stamp(cue.start)} --> ${stamp(end)}\n${lines.join("\n")}\n\n`;
      continue;
    }
    let elapsed = 0; const parts = chunks(cue.text), total = parts.reduce((n, p) => n + p.length, 0);
    for (const text of parts) {
      const start = cue.start + cue.seconds * elapsed / total; elapsed += text.length;
      const end = cue.start + cue.seconds * elapsed / total;
      ass += `Dialogue: 0,${stamp(start, true)},${stamp(end, true)},Caption,,0,0,0,,${text}\n`;
      srt += `${++number}\n${stamp(start)} --> ${stamp(end)}\n${text}\n\n`;
    }
  }
  fs.writeFileSync(path.join(output, "captions.ass"), ass, { flag: "wx", mode: 0o600 });
  fs.writeFileSync(path.join(output, "familycopilot-updated-ux.en.srt"), srt, { flag: "wx", mode: 0o600 });
  const filters = ["[0:v]fps=25,setsar=1,settb=AVTB,setpts=PTS-STARTPTS[v0]",
    `[1:v]trim=start=${c.captureStart}:end=${c.captureEnd},setpts=PTS-STARTPTS,fps=25,scale=1706:960,pad=1920:1080:107:0:color=0xfbf8f3,setsar=1,settb=AVTB[v1]`,
    `[2:v]trim=start=5,setpts=PTS-STARTPTS,fps=25,scale=1706:960,pad=1920:1080:107:0:color=0xfbf8f3,tpad=stop_mode=clone:stop_duration=20,trim=duration=${c.scenes.at(-1).duration},setsar=1,settb=AVTB[v2]`,
    `[v0][v1][v2]concat=n=3:v=1:a=0,ass=captions.ass,fade=t=out:st=${duration - 0.7}:d=0.7[v]`,
    "[0:a]aresample=48000,asetpts=PTS-STARTPTS[a0]",
    ...cues.slice(1).map((cue, i) => `[${i + 3}:a]adelay=${Math.round(cue.start * 1000)}:all=1[a${i + 1}]`),
    `${cues.map((_, i) => `[a${i}]`).join("")}amix=inputs=${cues.length}:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,apad[a]`];
  const run = args => { const r = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-n", ...args], { cwd: output, encoding: "utf8", timeout: 300000, maxBuffer: 32768 }); assert.equal(r.status, 0, r.stderr?.slice(-2000)); };
  run([...inputs.flatMap(f => ["-i", f]), "-filter_complex", filters.join(";"), "-map", "[v]", "-map", "[a]", "-t", String(duration), "-r", "25", "-c:v", "libx264", "-preset", "fast", "-crf", "19", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-metadata:s:a:0", "language=eng", "-movflags", "+faststart", "familycopilot-updated-ux.mp4"]);
  run(["-i", "familycopilot-updated-ux.mp4", "-f", "null", "-"]);
  for (const [f, digest] of Object.entries(hashes)) assert.equal(hash(f), digest);
  const shift = t => 15.2 + t - c.captureStart;
  for (const [name, time] of [["calendar", 19], ["click", shift(c.scenes[1].clickTime) - 0.2], ["activities", shift(c.scenes[1].activitiesVisible) + 0.5], ["basketball", cues[4].start + 0.5], ["results", cues[5].start + 0.5], ["official", duration - 5]]) run(["-ss", String(time), "-i", "familycopilot-updated-ux.mp4", "-frames:v", "1", `review-${name}.png`]);
  if (alignment) {
    const ending = alignment.cues.filter(cue => cue.clip === 7);
    assert.equal(ending[3].text, "Family Copilot.");
    assert(ending[4].text.startsWith("Less time"));
    for (const [name, time] of [["before-brand", ending[3].start - 0.3], ["brand", ending[3].start + 0.2], ["tagline", ending[4].start + 0.2]])
      run(["-ss", String(time), "-i", "familycopilot-updated-ux.mp4", "-frames:v", "1", `review-${name}.png`]);
  }
  const verification = { duration, decodePassed: true, inputHashesMatched: true, continuousCalendarToActivities: true,
    calendarScrolls: 0, calendarProviderRequests: 0, publicSearches: c.counts.publicSearch,
    speechRequests: 0, voice: "en-US-JennyNeural", style: "friendly", rate: "-3%",
    subtitleTiming: alignment?.method || "Approximate, not word-aligned", captionCount: alignment?.cues.length,
    humanAudition: false };
  write(output, "verification.json", verification); console.log(JSON.stringify({ output: path.relative(root, output), ...verification }));
}
if (require.main === module) {
  const [mode, directory] = process.argv.slice(2);
  if (mode === "--record-approved" && !directory) record().catch(() => { console.error("Recording stopped. No automatic retry or live calendar fallback."); process.exitCode = 1; });
  else if (mode === "--render-offline" && directory) render(directory);
  else if (mode === "--render-aligned-offline" && directory) render(directory, true);
  else throw Error("Explicit recording or offline rendering mode required");
}
module.exports = { permittedSearch, captionCues };