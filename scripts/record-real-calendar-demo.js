"use strict";
// Authorized local video only. Saved-view handlers, never Sync or provider calls.
const fs = require("node:fs/promises"), path = require("node:path"), assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const root = path.resolve(__dirname, ".."), origin = "http://127.0.0.1:8002";
function allowedRequest(url, method, body) {
  if (url.origin !== origin) return false;
  if (method === "GET") return !url.pathname.startsWith("/api/");
  if (method !== "POST") return false;
  if (url.pathname === "/api/availability") return body?.cacheOnly === true && body.refresh === false &&
    body.acknowledged === true && body.startDate === "2026-10-09" && body.endDate === "2026-10-15";
  if (url.pathname === "/api/child/saved") return body?.startDate === "2026-10-09" && body.endDate === "2026-10-15";
  return ["/api/clear", "/api/child/clear", "/api/child/edit"].includes(url.pathname) &&
    ["leave", "range"].includes(body?.reason);
}
async function record() {
  assert.deepEqual(process.argv.slice(2), ["--record-saved-approved"]);
  const { inspectLocalOwner } = require("./owner-local-status");
  assert.equal((await inspectLocalOwner()).safeIdle, true);
  const tools = process.env.FAMILYCOPILOT_DEMO_TOOLS; assert(tools && path.isAbsolute(tools));
  const { chromium } = require(path.join(tools, "node_modules/playwright"));
  const output = await fs.mkdtemp(path.join(root, "browser-artifacts/demo/real-calendar-"));
  await fs.chmod(output, 0o700);
  const hashes = {};
  for (const file of ["owner/index.html", "owner/availability-ui.js", "owner/child-calendar-ui.js", "owner/owner.css", "shell.css"]) {
    hashes[file] = createHash("sha256").update(await fs.readFile(path.join(root, file))).digest("hex");
  }
  const browser = await chromium.launch({ headless: true });
  let context;
  const counts = { parentSaved: 0, childSaved: 0, cleanup: 0, blocked: 0 }, errors = [];
  try {
    context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1,
      locale: "en-US", timezoneId: "Asia/Taipei", reducedMotion: "reduce", serviceWorkers: "block",
      recordVideo: { dir: output, size: { width: 1600, height: 900 } } });
    await context.route("**/*", route => {
      const request = route.request(), url = new URL(request.url());
      let body; try { body = request.postDataJSON(); } catch { /* GET */ }
      if (!allowedRequest(url, request.method(), body)) { counts.blocked++; return route.abort(); }
      if (url.pathname === "/api/availability") { assert.equal(counts.parentSaved++, 0); }
      else if (url.pathname === "/api/child/saved") { assert.equal(counts.childSaved++, 0); }
      else if (url.pathname.startsWith("/api/")) counts.cleanup++;
      return route.continue();
    });
    await context.addInitScript(() => {
      // Presentation-only privacy mask before paint; no content is exported.
      const mask = () => {
        for (const el of document.querySelectorAll('.child-event,.child-all-day')) {
          const parts = el.textContent.split(' · ');
          el.textContent = ['Event', ...parts.slice(1)].join(' · ');
          el.removeAttribute('title'); el.setAttribute('aria-label', el.textContent);
        }
      };
      document.addEventListener('DOMContentLoaded', () => {
        const observer = new MutationObserver(() => { observer.disconnect(); mask(); observer.observe(document.body, {childList:true,subtree:true}); });
        mask(); observer.observe(document.body, {childList:true,subtree:true});
      });
    });
    const page = await context.newPage(), video = page.video(), start = Date.now();
    page.on("pageerror", () => errors.push("page_error"));
    await page.goto(origin, { waitUntil: "networkidle" });
    assert.equal(await page.locator('meta[name="owner-mode"]').getAttribute("content"), "live");
    await page.locator('#availability-start').fill('2026-10-09');
    await page.locator('#availability-end').fill('2026-10-11');
    await page.waitForFunction(() => !document.querySelector('#availability-saved').disabled);
    // Existing cache-only application handler, not an API replay or fallback.
    await page.locator('#availability-saved').evaluate(el => el.click());
    await page.waitForFunction(() => document.querySelectorAll('.week-run').length > 0 &&
      !document.querySelector('#availability-saved').disabled, { }, { timeout: 30000 });
    const state = await page.evaluate(() => ({
      parentBlocks: document.querySelectorAll('.week-run').length,
      childBlocks: document.querySelectorAll('.child-event,.child-all-day').length,
      childContextLimited: /unavailable|not loaded|missing/i.test(document.querySelector('#child-week-status').textContent),
      urgent: [...document.querySelectorAll('[data-urgent="true"]')].some(el => !el.hidden && /cleanup|blocked|failed/i.test(el.textContent)),
      sample: /sample/i.test(document.querySelector('#owner-source-badge').textContent)
    }));
    assert(!state.urgent && !state.sample && state.parentBlocks > 0);
    assert.equal(counts.parentSaved, 1); assert.equal(counts.childSaved, 1);
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(500);
    const captureStart = (Date.now() - start) / 1000;
    await page.screenshot({ path: path.join(output, 'week-overview.png') });
    await page.waitForTimeout(5500);
    await page.locator('#availability-grid').evaluate(el => scrollTo({top: scrollY + el.getBoundingClientRect().top - 80, behavior:'smooth'}));
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(output, 'week-calendar.png') });
    await page.waitForTimeout(6000);
    await page.mouse.wheel(0, 330);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(output, 'week-later.png') });
    await page.waitForTimeout(6500);
    await page.evaluate(() => scrollTo({top:0,behavior:'smooth'}));
    await page.waitForTimeout(4500);
    const captureEnd = (Date.now() - start) / 1000;
    await context.close(); context = null;
    for (const [file, h] of Object.entries(hashes)) assert.equal(createHash('sha256').update(await fs.readFile(path.join(root,file))).digest('hex'), h, 'Source changed during capture');
    assert.equal(counts.blocked, 0); assert.deepEqual(errors, []);
    const report = { output: path.relative(root,output), raw: path.basename(await video.path()), captureStart, captureEnd,
      ...state, ...counts, calendarProviderRequests: 0, syntheticCalendars: false, childNamesMasked: true,
      savedViewOnly: true, newPublicSearches: 0, serviceChanges: 0, sourceHashes: hashes, capturedAt: new Date().toISOString() };
    await fs.writeFile(path.join(output,'capture.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
    console.log(JSON.stringify(report));
  } finally { if(context) await context.close(); await browser.close(); }
}
if (require.main === module) record().catch(() => { console.error('Real recording stopped; no retry or live fallback performed.'); process.exitCode=1; });
module.exports = { allowedRequest };