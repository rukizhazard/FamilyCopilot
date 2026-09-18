"use strict";
// Offline UI take: real current date picker, simulated Sync, existing masked calendar image.
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process"), { createHash } = require("node:crypto");
const { assets: activityAssets, replayAsset } = require("./smooth-demo-transition");
const root = path.resolve(__dirname, ".."), origin = "http://demo.invalid";
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const ownerAssets = { "/": "owner/index.html", "/styles.css": "styles.css", "/owner.css": "owner/owner.css",
  "/owner-ui.js": "owner/ui.js", "/owner-core.js": "owner/core.js", "/availability-ui.js": "owner/availability-ui.js",
  "/child-calendar-core.js": "owner/child-calendar-core.js", "/child-calendar-ui.js": "owner/child-calendar-ui.js" };
async function main(directory) {
  const source = path.resolve(directory); assert(source.startsWith(path.join(root, "browser-artifacts/demo/updated-ux-")));
  const eventTitle = process.env.FAMILYCOPILOT_DEMO_EVENT_TITLE || "";
  assert(eventTitle.length <= 120 && !/[\u0000-\u001f\u007f]/.test(eventTitle));
  const captureDir = path.dirname(source), capture = JSON.parse(fs.readFileSync(path.join(captureDir, "capture.json")));
  const output = fs.mkdtempSync(path.join(captureDir, "date-selection-")); fs.chmodSync(output, 0o700);
  const tools = process.env.FAMILYCOPILOT_DEMO_TOOLS; assert(tools && path.isAbsolute(tools));
  const ffmpeg = require(path.join(tools, "node_modules/ffmpeg-static"));
  const run = args => {
    const r = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-n", ...args],
      { cwd: output, encoding: "utf8", timeout: 300000, maxBuffer: 32768 });
    assert.equal(r.status, 0, r.stderr); return r.stdout.trim();
  };
  run(["-i", path.join(captureDir, "calendar.png"), "-vf", "crop=1214:479:186:421", "-frames:v", "1", "recorded-calendar.png"]);
  const bodies = Object.fromEntries(Object.entries(activityAssets).map(([url, file]) => [url, replayAsset(file, capture.sourceHashes[file])]));
  bodies["/activities"] = Buffer.from(require("./activity-week").activityMarkup(bodies["/activities"].toString()));
  const ownerHashes = {};
  for (const [url, file] of Object.entries(ownerAssets)) { bodies[url] = fs.readFileSync(path.join(root, file)); ownerHashes[file] = hash(bodies[url]); }
  let html = bodies["/"].toString();
  for (const [token, value] of Object.entries({ OWNER_CSRF: "offline-demo-csrf", OWNER_MODE: "live", OWNER_CACHE: "disk",
    OWNER_RANGE: "configurable-v1", OWNER_SAVED: "preserve-v1", OWNER_CONTRACT: "bounded-availability-v5",
    CHILD_MODE: "kimi-calendar-v1", CHILD_CACHE: "child-saved-v1-disk", CHILD_SYNC: "child-sync-v1" })) html = html.replace(token, value);
  bodies["/"] = Buffer.from(html); bodies["/recorded-calendar.png"] = fs.readFileSync(path.join(output, "recorded-calendar.png"));
  const { chromium } = require(path.join(tools, "node_modules/playwright"));
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1,
    locale: "en-US", timezoneId: "Asia/Taipei", reducedMotion: "reduce", serviceWorkers: "block", bypassCSP: true,
    recordVideo: { dir: output, size: { width: 1600, height: 900 } } });
  const blocked = [], requests = [], errors = [], actions = []; let raw, takeStart;
  try {
    await context.route("**/*", async route => {
      const req = route.request(), url = new URL(req.url());
      if (url.origin === origin && req.method() === "GET" && bodies[url.pathname]) {
        return route.fulfill({ status: 200, contentType: url.pathname.endsWith(".js") ? "application/javascript"
          : url.pathname.endsWith(".css") ? "text/css" : url.pathname.endsWith(".png") ? "image/png" : "text/html", body: bodies[url.pathname] });
      }
      if (url.origin === origin && req.method() === "POST" && ["/api/clear", "/api/child/clear"].includes(url.pathname)) {
        requests.push(url.pathname);
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "cleared", cleanup: "not_requested" }) });
      }
      blocked.push(url.pathname); return route.abort();
    });
    await context.addInitScript(() => {
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
    await page.goto(origin, { waitUntil: "networkidle" });
    assert.equal(await page.locator("#availability-start").inputValue(), "");
    assert(await page.locator("#availability-load").isDisabled());
    // Intercept the visible click before application handlers. No Sync API is sent.
    await page.evaluate(() => {
      window.__syncClicks = 0; window.__calendarScrolls = 0;
      window.addEventListener("scroll", () => window.__calendarScrolls++);
      document.addEventListener("click", event => {
        if (!event.target.closest("#availability-load")) return;
        event.preventDefault(); event.stopImmediatePropagation(); window.__syncClicks++;
        document.querySelector("#availability-load").disabled = true;
        document.querySelector("#availability-sync-label").textContent = "Syncing…";
        document.querySelector("#availability-empty-title").textContent = "Loading your week…";
        for (const [i, name] of ["Mike", "Debby", "Kimi"].entries()) document.querySelector(`#calendar-person-${i}`).textContent = `${name} · Syncing`;
      }, true);
    });
    await page.waitForTimeout(350); takeStart = (Date.now() - clock) / 1000;
    const until = async seconds => { const ms = (takeStart + seconds) * 1000 - (Date.now() - clock); if (ms > 0) await page.waitForTimeout(ms); };
    const click = async selector => {
      const box = await page.locator(selector).first().boundingBox(); assert(box && box.y >= 0 && box.y + box.height <= 900);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 24 });
      await page.waitForTimeout(300); await page.mouse.down(); await page.waitForTimeout(140); await page.mouse.up();
      actions.push({ selector, seconds: (Date.now() - clock) / 1000 - takeStart }); await page.waitForTimeout(300);
    };
    await page.screenshot({ path: path.join(output, "initial.png") });
    await until(0.6); await click("#availability-date-toggle");
    await until(2.2); await click('[data-date="2026-10-09"]');
    await until(3.8); await click('[data-date="2026-10-11"]');
    await page.screenshot({ path: path.join(output, "selection.png") });
    await until(5.2); await click("#availability-date-apply");
    assert.equal(await page.locator("#availability-start").inputValue(), "2026-10-09");
    assert.equal(await page.locator("#availability-end").inputValue(), "2026-10-11");
    await until(6.8); await click("#availability-load");
    await page.screenshot({ path: path.join(output, "syncing.png") });
    await until(9.2);
    await page.evaluate(async approvedTitle => {
      const image = new Image(); image.src = "/recorded-calendar.png"; image.alt = "Previously recorded family calendar, child names masked";
      await image.decode(); image.style.cssText = "display:block;width:100%;height:auto";
      const grid = document.querySelector("#availability-grid"); grid.replaceChildren(image); grid.hidden = false;
      grid.style.cssText = "position:relative;border:0;margin-top:16px;max-height:none;height:auto;overflow:hidden";
      if (approvedTitle) {
        if (image.naturalWidth !== 1214 || Math.abs(image.getBoundingClientRect().width - 1214) > 1) throw Error("Calendar image geometry changed");
        const event = document.createElement("div"); event.id = "approved-demo-event";
        event.textContent = `${approvedTitle} · 09:00–11:00 · Event reported`;
        event.style.cssText = "position:absolute;box-sizing:border-box;left:701px;top:266px;width:122px;height:96px;border:1px solid #624199;border-radius:5px;background:#f3edf9;color:#352e49;font-size:12px;line-height:18px;padding:0 2px;overflow:hidden;overflow-wrap:anywhere";
        grid.append(event); image.alt = "Previously recorded family calendar with one user-approved event title";
      }
      document.querySelector("#availability-status").hidden = true;
      document.querySelector("#availability-surface").dataset.loaded = "true";
      document.querySelector("#availability-empty").hidden = true;
      document.querySelector("#availability-sync-label").textContent = "Sync";
      document.querySelector("#availability-load").disabled = false;
      for (const [i, name] of ["Mike", "Debby", "Kimi"].entries()) {
        const el = document.querySelector(`#calendar-person-${i}`); el.textContent = `${name} ✓`; el.dataset.loaded = "true";
        el.setAttribute("aria-label", `${name} · Loaded`); el.disabled = false;
      }
    }, eventTitle);
    await page.screenshot({ path: path.join(output, "loaded.png") });
    await until(26.1);
    assert.deepEqual(await page.evaluate(() => ({ syncClicks: window.__syncClicks, scrolls: window.__calendarScrolls })), { syncClicks: 1, scrolls: 0 });
    await click('.shell-nav a[href="/activities"]'); await page.waitForURL(origin + "/activities");
    assert.equal(await page.locator("#activity-start").inputValue(), "2026-10-09");
    assert.equal(await page.locator("#activity-end").inputValue(), "2026-10-11");
    await until(43.1); assert.deepEqual(blocked, []); assert.deepEqual(errors, []);
  } finally { await context.close(); await browser.close(); }
  for (const [file, expected] of Object.entries(ownerHashes)) assert.equal(hash(fs.readFileSync(path.join(root, file))), expected, "Calendar assets changed during retake");
  const input = path.join(source, "familycopilot-updated-ux.mp4"), name = "familycopilot-updated-ux.mp4";
  const filter = `[1:v]trim=start=${takeStart}:duration=42.6,setpts=PTS-STARTPTS,fps=25,scale=1706:960,setpts=PTS+15.2/TB[retake];[0:v][retake]overlay=x=107:y=0:eof_action=pass:enable='gte(t,15.2)*lt(t,57.8)'[v]`;
  run(["-i", input, "-i", await raw.path(), "-filter_complex", filter, "-map", "[v]", "-map", "0:a:0",
    "-c:v", "libx264", "-preset", "fast", "-crf", "19", "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", name]);
  run(["-i", name, "-f", "null", "-"]);
  const audio = file => run(["-i", file, "-map", "0:a:0", "-f", "hash", "-hash", "sha256", "-"]);
  assert.equal(audio(input), audio(name));
  fs.copyFileSync(path.join(source, "familycopilot-updated-ux.en.srt"), path.join(output, "familycopilot-updated-ux.en.srt"), fs.constants.COPYFILE_EXCL);
  for (const [label, time] of [["selection", 20], ["sync", 23.2], ["loaded", 30], ["activities", 46]])
    run(["-ss", String(time), "-i", name, "-frames:v", "1", `review-${label}.png`]);
  const report = { output: path.relative(root, output), ownerHashes, actions, takeStart, simulatedSync: true,
    calendarContent: "Existing calendar screenshot, not refreshed data", approvedEventTitlesShown: eventTitle ? 1 : 0,
    otherEventTitlesMasked: true, networkRequests: 0, localCleanupReplays: requests,
    calendarScrolls: 0, audioUnchanged: true, subtitleTimingUnchanged: true, decodePassed: true, sourceVideoHash: hash(fs.readFileSync(input)) };
  fs.writeFileSync(path.join(output, "verification.json"), JSON.stringify(report, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify(report));
}
if (require.main === module) {
  const [mode, directory] = process.argv.slice(2); assert(mode === "--offline" && directory);
  main(directory).catch(error => { console.error(error); process.exitCode = 1; });
}