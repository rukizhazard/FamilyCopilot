"use strict";
// Read-only integration review of existing services. Never starts/restarts them.
// An isolated browser blocks all APIs, external requests and non-GET requests.
const fs = require("node:fs/promises");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
const origin = "http://127.0.0.1:8002";
const activityOrigin = "http://127.0.0.1:8030";

async function main() {
  assert.deepEqual(process.argv.slice(2), ["--read-only"]);
  const tools = process.env.FAMILYCOPILOT_DEMO_TOOLS;
  assert(tools && path.isAbsolute(tools), "Set the existing isolated Playwright tools directory.");
  const { chromium } = require(path.join(tools, "node_modules/playwright"));
  const output = await fs.mkdtemp(path.join(root, "browser-artifacts", "shared-tabs-"));
  const assets = ["shell.css", "activity-preview/core.js", "activity-preview/ui.js",
    "activity-preview/basketball-ui.js", "activity-preview/preview.css",
    "activity-preview/basketball.css", "shared/basketball-teams.js", "shared/date-selection.js"];
  for (const file of assets) {
    const disk = await fs.readFile(path.join(root, file), "utf8");
    for (const base of [origin, activityOrigin]) {
      const response = await fetch(`${base}/${file}`, { redirect: "error", signal: AbortSignal.timeout(5000) });
      assert.equal(response.status, 200);
      assert.equal(await response.text(), disk, `${base}/${file} differs from disk`);
    }
  }
  // Latest calendar controllers/styles are checked without reading saved data.
  for (const [url, file] of [["/availability-ui.js", "owner/availability-ui.js"],
    ["/child-calendar-ui.js", "owner/child-calendar-ui.js"], ["/owner.css", "owner/owner.css"]]) {
    const response = await fetch(origin + url, { redirect: "error", signal: AbortSignal.timeout(5000) });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), await fs.readFile(path.join(root, file), "utf8"));
  }
  const browser = await chromium.launch({ headless: true });
  const blocked = [], errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 },
      locale: "en-US", timezoneId: "Asia/Taipei", serviceWorkers: "block" });
    await context.route("**/*", route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== origin || url.pathname.startsWith("/api/") || request.method() !== "GET") {
        blocked.push({ method: request.method(), localAPI: url.origin === origin && url.pathname.startsWith("/api/") });
        return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.on("pageerror", () => errors.push("page_error"));
    const navigate = async (href, expectedField) => {
      const link = page.locator(`.shell-nav a[href="${href}"]`);
      await link.focus();
      await link.press("Enter");
      await page.waitForURL(origin + href);
      await page.locator(expectedField).waitFor();
      assert.equal(await page.locator(`.shell-nav a[href="${href}"]`).getAttribute("aria-current"), "page");
    };
    const dates = async (prefix, start, end) => {
      await page.locator(`#${prefix}-start`).fill(start);
      await page.locator(`#${prefix}-end`).fill(end);
    };
    const expectDates = async (prefix, start, end) => {
      assert.equal(await page.locator(`#${prefix}-start`).inputValue(), start);
      assert.equal(await page.locator(`#${prefix}-end`).inputValue(), end);
    };
    const expectDatesOnly = async () => {
      const storage = await page.evaluate(() => ({ session: { ...sessionStorage }, localKeys: Object.keys(localStorage) }));
      assert.deepEqual(Object.keys(storage.session), ["familycopilot.dates.v1"]);
      assert.deepEqual(storage.localKeys, []);
      const value = JSON.parse(storage.session["familycopilot.dates.v1"]);
      assert.deepEqual(Object.keys(value).sort(), value.state === "invalid"
        ? ["state", "version"] : ["endDate", "startDate", "state", "version"]);
    };
    await page.goto(origin + "/", { waitUntil: "networkidle" });
    await page.locator("#availability-load:not([disabled])").waitFor();
    assert(await page.locator("#availability-grid").isHidden());
    await dates("availability", "2026-10-10", "2026-10-12");
    await navigate("/activities", "#activity-start");
    await expectDates("activity", "2026-10-10", "2026-10-12");
    assert.equal(await page.evaluate(() => globalThis.BasketballTeams.matchingContract), "tpbl-fuzzy-v1");
    await page.locator('input[name="interest"][value="sports"]').check();
    await page.locator('input[name="sport"][value="basketball"]').check();
    await page.locator("#team-name").fill("中信特攻"); // CTBC DEA; local preference only.
    await page.locator("#add-team").click();
    assert.equal(await page.locator("#preferred-teams li").count(), 1);
    await expectDatesOnly();
    await page.screenshot({ path: path.join(output, "activities-desktop.png"), fullPage: true });
    await dates("activity", "2026-10-11", "2026-10-13");
    await navigate("/", "#availability-start");
    await expectDates("availability", "2026-10-11", "2026-10-13");
    assert(await page.locator("#availability-grid").isHidden());
    await page.screenshot({ path: path.join(output, "week-desktop.png"), fullPage: true });
    await navigate("/activities", "#activity-start");
    assert.equal(await page.locator("#preferred-teams li").count(), 0);
    await expectDatesOnly();
    await page.setViewportSize({ width: 375, height: 812 });
    for (const [href, field, file] of [["/", "#availability-start", "week-mobile.png"],
      ["/activities", "#activity-start", "activities-mobile.png"]]) {
      await navigate(href, field);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({ path: path.join(output, file), fullPage: true });
    }
    // Invalid activity dates cannot silently restore a previous calendar range.
    await dates("activity", "2026-10-13", "2026-10-11");
    await navigate("/", "#availability-start");
    await expectDates("availability", "", "");
    assert(await page.locator("#availability-load").isDisabled());
    await expectDatesOnly();
    await context.close();
    assert.deepEqual(errors, []);
    assert.deepEqual(blocked, [], "Unexpected request attempted; every such request was blocked.");
    const report = { staticAssetsMatch: true, activityAssetsCompared: assets.length,
      calendarAssetsCompared: 3, sameOriginRoundTrip: true, keyboardNavigation: true,
      datesOnlyStorage: true, preferencesClearedOnExit: true, invalidDatesFailClosed: true,
      desktopWidth: 1280, mobileWidth: 375, calendarQueries: 0, activitySearches: 0,
      blockedRequests: blocked.length, browserErrors: errors.length, serviceChanges: 0,
      runtimeBackendSearchVerified: false };
    await fs.writeFile(path.join(output, "verification.json"), JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output: path.relative(root, output), ...report }));
  } finally { await browser.close(); }
}
main().catch(error => { console.error("Shared-tab review failed: " + error.message); process.exitCode = 1; });