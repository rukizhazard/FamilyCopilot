"use strict";
// Explicit mixed-source recording: synthetic calendars + one live public search.
// Existing services and application files are never changed or restarted.
const fs = require("node:fs/promises"), path = require("node:path");
const assert = require("node:assert/strict"), crypto = require("node:crypto");
const root = path.resolve(__dirname, "..");
const origin = "http://127.0.0.1:8002";
const A = require("../owner/availability-core"); // Pure validation only.
const story = [
  { title: "Let's make time for each other.", text: "Between work, school, and everyday routines, family time can be easy to put off. This weekend, let's do something together. But when could we go, and what would everyone enjoy?" },
  { title: "Start with the family's week.", text: "Start with Family Copilot. Pick the days you have in mind and bring up the family calendar. Instead of piecing together separate plans, begin with a clearer view of the commitments ahead." },
  { title: "Look for room in the week.", text: "Look through the commitments and consider where an outing might fit. Here, we still need to check Kimi's plans before settling on a time. For now, let's explore ideas for these three days." },
  { title: "What would we enjoy together?", text: "With those days in mind, move to Activities. Now the question becomes: what would make this time together special? Start with what your family enjoys, and turn a broad idea into something to look forward to." },
  { title: "A shared favorite.", text: "Basketball it is. The family loves cheering for C T B C D E A. Add their favorite team, and a simple idea becomes more personal: a chance to watch them play together." },
  { title: "An idea becomes a possibility.", text: "Search for activities, and the idea starts to take shape. Here are games featuring the family's favorite team within the chosen dates. Now there are concrete options to bring back to the family." },
  { title: "Picture the outing.", text: "One game catches our attention. Open it and look at when and where it takes place. Could we get there after our other plans? This gives us a specific outing to discuss, rather than starting from scratch." },
  { title: "Something to look forward to.", text: "Open the official game page to take a closer look. We started with a busy week and a wish to spend time together. Now we have a possibility worth planning around. Family Copilot. Less time piecing plans together, more to look forward to." }
];
const hash = text => crypto.createHash("sha256").update(text).digest("hex");
function sampleWeek() {
  return { window: A.liveWindow, checkedAt: new Date().toISOString(), synthetic: true, cleanup: "workflow_disabled",
    people: [0, 1].map(person => ({ person, status: "checked", slots: Array.from({ length: 336 }, (_, i) => {
      const hour = (i % 48) / 2, day = Math.floor(i / 48);
      if (person === 0 && hour >= 9 && hour < 11 + day % 2) return "busy";
      if (person === 1 && hour >= 13 && hour < 15) return "oof";
      if (hour >= 16 + person && hour < 17.5 + person) return "tentative";
      return "free_or_elsewhere";
    }) })) };
}
function syntheticMarkup(html) {
  for (const [name, content] of Object.entries({ "owner-csrf": "synthetic-video-only", "owner-mode": "synthetic",
    "owner-cache": "memory", "child-mode": "synthetic", "child-cache": "child-saved-v1-memory" })) {
    const re = new RegExp(`(<meta name="${name}" content=")[^"]*(">)`);
    assert(re.test(html), `Missing ${name}`); html = html.replace(re, `$1${content}$2`);
  }
  return html;
}
async function record(smoke) {
  const tools = process.env.FAMILYCOPILOT_DEMO_TOOLS;
  assert(tools && path.isAbsolute(tools));
  const { chromium } = require(path.join(tools, "node_modules/playwright"));
  const output = smoke ? await fs.mkdtemp(path.join(root, "browser-artifacts", "integrated-smoke-"))
    : path.join(root, "browser-artifacts/demo/integrated-20260918");
  if (!smoke) await fs.mkdir(output); // One-shot live attempt marker; no automatic retries.
  const counts = { sampleParent: 0, sampleChildMiss: 0, sampleCleanup: 0, liveSearch: 0, blocked: 0 };
  const hashes = {};
  for (const file of ["owner/index.html", "owner/availability-ui.js", "owner/child-calendar-ui.js", "owner/owner.css",
    "activity-preview/index.html", "activity-preview/basketball-ui.js", "activity-preview/preview.css", "activity-preview/basketball.css", "shared/basketball-teams.js", "shared/date-selection.js", "shell.css"]) {
    hashes[file] = hash(await fs.readFile(path.join(root, file)));
  }
  await fs.writeFile(path.join(output, "source-hashes.json"), JSON.stringify(hashes, null, 2));
  const browser = await chromium.launch({ headless: true });
  let context, page, official;
  const timeline = [], errors = [], assets = new Set(), blockedResources = new Set();
  let allowSearch = false, allowOfficial = false, sourceResult, officialUrl, rawVideo, officialVideo;
  try {
    context = await browser.newContext({ viewport: { width: 1280, height: 640 }, deviceScaleFactor: 1,
      locale: "en-US", timezoneId: "Asia/Taipei", reducedMotion: "reduce", serviceWorkers: "block", bypassCSP: true,
      ...(!smoke ? { recordVideo: { dir: output, size: { width: 1280, height: 640 } } } : {}) });
    await context.route("**/*", async route => {
      const req = route.request(), url = new URL(req.url());
      const json = data => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
      if (url.origin === origin) {
        if (url.pathname === "/api/availability" && req.method() === "POST") {
          const body = req.postDataJSON(); assert.equal(body.acknowledged, true);
          assert.equal(body.startDate, "2026-10-09"); assert.equal(body.endDate, "2026-10-15");
          counts.sampleParent++; return json(sampleWeek());
        }
        if (url.pathname === "/api/child/saved" && req.method() === "POST") {
          counts.sampleChildMiss++; return json({ status: "cache_missing" });
        }
        if (["/api/clear", "/api/child/edit"].includes(url.pathname) && req.method() === "POST") {
          assert(["leave", "range", "cancel"].includes(req.postDataJSON().reason));
          counts.sampleCleanup++; return json({ status: "cleared", cleanup: "not_requested" });
        }
        if (url.pathname === "/api/activities/basketball" && !smoke && allowSearch && !counts.liveSearch && req.method() === "POST") {
          const body = req.postDataJSON();
          assert.equal(body.startDate, "2026-10-09"); assert.equal(body.endDate, "2026-10-11");
          assert.equal(body.teamMode, "only"); assert.equal(body.teamIds.length, 1);
          assert.equal(decodeURIComponent(body.teamIds[0]), "tpbl:name:中信特攻");
          counts.liveSearch++; return route.continue();
        }
        if (req.method() === "GET" && !url.pathname.startsWith("/api/")) {
          if (url.pathname === "/") {
            const response = await route.fetch(); assert.equal(response.status(), 200);
            return route.fulfill({ response, body: syntheticMarkup(await response.text()) });
          }
          assets.add(url.pathname); return route.continue();
        }
      } else if (allowOfficial && url.protocol === "https:" && req.method() === "GET" &&
        (url.hostname === "tpbl.basketball" || url.hostname.endsWith(".tpbl.basketball") ||
          ["fonts.googleapis.com", "fonts.gstatic.com", "cdn.jsdelivr.net"].includes(url.hostname))) {
        return route.continue();
      }
      counts.blocked++; blockedResources.add(url.origin + url.pathname); return route.abort();
    });
    await context.addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        const badge = document.createElement("div");
        badge.textContent = location.hostname === "tpbl.basketball" ? "OFFICIAL TPBL WEBSITE"
          : location.pathname === "/" ? "DEMO · SAMPLE CALENDARS" : "DEMO · PUBLIC TPBL SEARCH";
        badge.style.cssText = "position:fixed;right:14px;top:82px;z-index:2147483647;background:#193d36;color:#fff;padding:8px 12px;border-radius:24px;font:700 10px system-ui;letter-spacing:.8px;pointer-events:none";
        const cursor = document.createElement("div");
        cursor.style.cssText = "position:fixed;z-index:2147483646;width:18px;height:18px;border:2px solid #355e50;background:#ffffff80;border-radius:50%;pointer-events:none;left:-40px;top:-40px;transform:translate(-50%,-50%);box-shadow:0 0 0 4px #355e5020";
        document.body.append(badge, cursor);
        document.addEventListener("mousemove", event => { cursor.style.left = `${event.clientX}px`; cursor.style.top = `${event.clientY}px`; });
      });
    });
    page = await context.newPage(); rawVideo = page.video();
    page.on("pageerror", () => errors.push("app_page_error"));
    page.on("response", async response => {
      if (response.url() === origin + "/api/activities/basketball") {
        try { sourceResult = await response.json(); } catch { /* Final assertions fail closed. */ }
      }
    });
    const started = Date.now(), pause = ms => page.waitForTimeout(smoke ? 30 : ms);
    const focus = async selector => {
      await page.locator(selector).first().evaluate(el => el.scrollIntoView({ block: "center", behavior: "instant" })); await pause(300);
    };
    const click = async selector => {
      const el = page.locator(selector).first(); await el.scrollIntoViewIfNeeded();
      const box = await el.boundingBox(); assert(box);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: smoke ? 1 : 16 });
      await pause(250); await el.click(); await pause(350);
    };
    const scene = async (index, action, seconds = 13) => {
      const start = (Date.now() - started) / 1000;
      await action();
      await page.screenshot({ path: path.join(output, `scene-${index + 1}.png`) });
      await pause(Math.max(0, seconds * 1000 - (Date.now() - started - start * 1000)));
      timeline.push({ ...story[index], start, end: (Date.now() - started) / 1000, source: "app" });
    };
    await scene(0, async () => {
      await page.goto(origin, { waitUntil: "networkidle" });
      await page.locator("#availability-load:not([disabled])").waitFor();
      assert.match(await page.locator("#owner-source-badge").innerText(), /SAMPLE/);
      assert.equal(counts.sampleParent + counts.sampleChildMiss + counts.liveSearch, 0);
    });
    await scene(1, async () => {
      await page.locator("#availability-start").fill("2026-10-09"); await pause(300);
      await page.locator("#availability-end").fill("2026-10-11");
      await click("#availability-load");
      await page.locator("#availability-grid").waitFor({ state: "visible" });
      await page.evaluate(() => scrollTo(0, 0));
    });
    await scene(2, async () => {
      await page.locator("#availability-grid").evaluate(el => scrollTo({ top: scrollY + el.getBoundingClientRect().top - 30, behavior: "instant" }));
      await pause(2500);
      await page.mouse.wheel(0, 450); await pause(1200);
      assert.match(await page.locator("#child-week-status").textContent(), /unknown|not loaded/i);
    });
    await scene(3, async () => {
      await click('.shell-nav a[href="/activities"]'); await page.waitForURL(origin + "/activities");
      assert.equal(await page.locator("#activity-start").inputValue(), "2026-10-09");
      assert.equal(await page.locator("#activity-end").inputValue(), "2026-10-11");
      await focus(".discovery-dates");
    }, 11);
    await scene(4, async () => {
      await click('label:has(input[name="interest"][value="sports"])');
      await click('label:has(input[name="sport"][value="basketball"])');
      await focus("#basketball-choices");
      await page.locator("#team-name").pressSequentially("中信特攻", { delay: smoke ? 0 : 180 });
      await click("#add-team"); assert.equal(await page.locator("#preferred-teams li").count(), 1);
    }, 14);
    if (!smoke) {
      await scene(5, async () => {
        allowSearch = true; await click("#find");
        await page.locator("#basketball-games article").first().waitFor({ state: "visible", timeout: 40000 });
        assert(sourceResult && sourceResult.synthetic !== true && sourceResult.teamMatching === "tpbl-fuzzy-v1");
        assert(sourceResult.games.length > 0 && sourceResult.games.every(g => /中信特攻/.test(g.home + g.away)));
        await fs.writeFile(path.join(output, "public-search.json"), JSON.stringify(sourceResult, null, 2));
        await focus("#basketball-games");
      });
      await scene(6, async () => {
        await click("#basketball-games article button");
        await focus("#basketball-games article details");
        const link = page.locator('#basketball-games article a').first();
        officialUrl = await link.getAttribute("href");
        assert(/^https:\/\/tpbl\.basketball\/schedule\/[1-9]\d{0,6}$/.test(officialUrl));
        assert.equal(await link.getAttribute("rel"), "noopener noreferrer");
      });
      // Keep the actual click at the end of the app footage, then cut to its new tab.
      allowOfficial = true;
      const popup = context.waitForEvent("page");
      await click("#basketball-games article a");
      official = await popup; officialVideo = official.video();
      timeline.at(-1).end = (Date.now() - started) / 1000;
      const officialStarted = Date.now();
      await official.waitForLoadState("domcontentloaded", { timeout: 45000 });
      await official.waitForTimeout(5000);
      assert.equal(new URL(official.url()).hostname, "tpbl.basketball");
      await official.screenshot({ path: path.join(output, "scene-8.png") });
      await official.waitForTimeout(9000);
      timeline.push({ ...story[7], source: "official", start: 0, end: (Date.now() - officialStarted) / 1000 });
    }
    assert.equal(counts.sampleParent, 1); assert.equal(counts.sampleChildMiss, 1);
    assert.equal(counts.liveSearch, smoke ? 0 : 1); assert.deepEqual(errors, []);
    await context.close(); context = null;
    if (!smoke) {
      await fs.writeFile(path.join(output, "timeline.json"), JSON.stringify(timeline, null, 2));
      await fs.writeFile(path.join(output, "raw-files.json"), JSON.stringify({ app: path.basename(await rawVideo.path()), official: path.basename(await officialVideo.path()) }));
    }
    for (const [file, digest] of Object.entries(hashes)) assert.equal(hash(await fs.readFile(path.join(root, file))), digest, `Concurrent edit: ${file}`);
    const report = { appOrigin: origin, smoke, syntheticCalendars: true, calendarNetworkRequests: 0,
      privateSnapshotAccess: false, ...counts, officialUrl: officialUrl || null,
      officialOpened: !!official, rawScenes: timeline.length, pageErrors: errors.length,
      assets: [...assets], blockedResources: [...blockedResources], appFilesUnchanged: true,
      serviceChanges: 0, recordedAt: new Date().toISOString() };
    await fs.writeFile(path.join(output, "capture-verification.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ output: path.relative(root, output), ...report }));
  } finally { if (context) await context.close(); await browser.close(); }
}
if (require.main === module) {
  assert.equal(process.argv.length, 3);
  assert(["--calendar-smoke", "--record-approved"].includes(process.argv[2]));
  record(process.argv[2] === "--calendar-smoke").catch(e => { console.error("Recording stopped: " + e.message); process.exitCode = 1; });
}
module.exports = { story, sampleWeek, syntheticMarkup };