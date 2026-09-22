"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const origin = "http://familycopilot.localhost";
const { loadSnapshot, digest } = require("./demo-snapshot");

async function checkProcessing(page, label, output, name) {
  await page.waitForFunction(expected => document.querySelector("#chat-status").textContent === expected, label);
  assert.equal(await page.locator("#chat-page").getAttribute("data-processing"), "true");
  assert.equal(await page.locator("#activity-results").getAttribute("aria-busy"), "true");
  assert.equal(await page.locator("#chat-send").isDisabled(), true);
  assert.equal(await page.locator("#chat-pause").count(), 0);
  assert.deepEqual(await page.locator("#chat-progress li").allTextContents(), label === "Loading family members' calendars..." ?
    ["Next: Find activities that match your family's interests", "Next: Compare activity times with calendars"] : ["Next: Compare activity times with calendars"]);
  const progressBounds = await page.locator("#chat-progress").boundingBox();
  assert.ok(progressBounds && progressBounds.y >= 0 && progressBounds.y + progressBounds.height <= page.viewportSize().height, "queued actions stay in viewport");
  const bounds = await page.locator("#chat-status").boundingBox();
  assert.ok(bounds && bounds.y >= 0 && bounds.y + bounds.height <= page.viewportSize().height, "processing status stays in viewport");
  await page.waitForFunction(() => Math.abs(parseFloat(document.documentElement.style.getPropertyValue("--composer-height")) - document.querySelector("#chat-composer").getBoundingClientRect().height) < 1);
  await checkLayout(page);
  await page.screenshot({ path: path.join(output, name) });
}

async function checkLayout(page, { lastItem = false, viewportBottom } = {}) {
  const geometry = await page.evaluate(() => {
    const composer = document.querySelector("#chat-composer").getBoundingClientRect();
    const frame = document.querySelector(".composer-row").getBoundingClientRect();
    const input = document.querySelector("#chat-input").getBoundingClientRect();
    const send = document.querySelector("#chat-send").getBoundingClientRect();
    const pencil = document.querySelector("#preferences-edit").getBoundingClientRect();
    const last = document.querySelector("#activity-results article:last-of-type") || document.querySelector("#chat-messages li:last-child");
    return { width: innerWidth, height: innerHeight, overflow: document.documentElement.scrollWidth > innerWidth,
      idle: document.documentElement.getAttribute("data-conversation") === "idle",
      composerPosition: getComputedStyle(document.querySelector("#chat-composer")).position,
      summaryBottom: document.querySelector(".family-section").getBoundingClientRect().bottom,
      frame: frame.toJSON(), input: input.toJSON(), send: send.toJSON(), pencil: pencil.toJSON(),
      composer: composer.toJSON(), last: last?.getBoundingClientRect().toJSON(),
      padding: parseFloat(getComputedStyle(document.querySelector(".workspace")).paddingBottom) };
  });
  assert.equal(geometry.overflow, false, "no horizontal page overflow");
  assert.ok(Math.abs(geometry.send.width - 40) < 1 && Math.abs(geometry.send.height - 40) < 1, "compact send button");
  assert.ok(Math.abs(geometry.send.top + geometry.send.height / 2 - geometry.frame.top - geometry.frame.height / 2) < 1, "send is vertically centered");
  assert.ok(geometry.send.right < geometry.frame.right && geometry.send.top > geometry.frame.top && geometry.send.bottom < geometry.frame.bottom, "send stays inside input frame");
  assert.ok(geometry.input.right <= geometry.send.left, "input text cannot overlap send");
  assert.ok(geometry.pencil.width >= 43.9 && geometry.pencil.height >= 43.9, "pencil keeps a 44px target");
  if (geometry.idle) {
    assert.equal(geometry.composerPosition, "static", "initial composer stays in the conversation flow");
    assert.ok(geometry.composer.top >= geometry.summaryBottom, "initial composer follows family summary");
  } else {
    assert.equal(geometry.composerPosition, "fixed");
    assert.ok(Math.abs(geometry.composer.bottom - (viewportBottom ?? geometry.height)) < 2, "composer docks at visible bottom");
    assert.ok(geometry.padding >= geometry.composer.height + 20,
      `content reserves composer height: ${JSON.stringify(geometry)}`);
  }
  if (lastItem) assert.ok(geometry.last.bottom <= geometry.composer.top - 12, "last result/message stays above composer at scroll end");
  return geometry;
}

async function main() {
  const tools = process.env.FAMILYCOPILOT_DEMO_TOOLS;
  assert.ok(tools && path.isAbsolute(tools), "Set FAMILYCOPILOT_DEMO_TOOLS to an existing isolated Playwright installation.");
  const { chromium } = require(path.join(tools, "node_modules/playwright"));
  const snapshotIndex = process.argv.indexOf("--snapshot"), hashIndex = process.argv.indexOf("--sha256");
  assert.equal(snapshotIndex >= 0, hashIndex >= 0, "Snapshot and reviewed hash are required together");
  const snapshot = snapshotIndex >= 0 ? loadSnapshot(process.argv[snapshotIndex + 1], process.argv[hashIndex + 1]) : null;
  if (snapshot) assert.match(process.argv[hashIndex + 1], /^[a-f0-9]{64}$/);
  const html = snapshot ? snapshot.assets.get("/chat/index.html").toString("utf8") : await fs.readFile(path.join(root, "chat/index.html"), "utf8");
  const allowed = new Set(["/chat/index.html", "/activity-preview/chat-assets/basketball-synthetic.svg",
    "/activity-preview/chat-assets/movie-synthetic.svg", "/activity-preview/chat-assets/ctbc-dea.png",
    "/activity-preview/chat-assets/forgotten-island.jpg", "/activity-preview/chat-assets/chiikawa.jpg",
    "/activity-preview/chat-assets/formosa-dreamers.webp"]);
  for (const match of html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)) {
    allowed.add(new URL(match[1], `${origin}/chat/index.html`).pathname);
  }
  const assets = snapshot ? snapshot.assets : new Map(await Promise.all([...allowed].map(async url => [url, await fs.readFile(path.join(root, url.slice(1)))])));
  const sourceHashes = Object.fromEntries([...assets].map(([url, bytes]) => [url, digest(bytes)]));
  const runnerSha256 = digest(await fs.readFile(__filename));
  const output = await fs.mkdtemp(path.join(root, "browser-artifacts/chat-preferences-"));
  const browser = await chromium.launch({ headless: true });
  const reports = [];
  try {
    for (const width of process.argv.includes("--all-viewports") ? [1440, 375, 320] : [1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 600,
        hasTouch: width < 600, deviceScaleFactor: 1, serviceWorkers: "block" });
      const failures = [];
      try {
        await context.route("**/*", async route => {
          const url = new URL(route.request().url());
          if (url.origin !== origin || url.search || !allowed.has(url.pathname) || !assets.has(url.pathname)) {
            failures.push("unexpected_resource"); await route.abort(); return;
          }
          const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp" };
          await route.fulfill({ body: assets.get(url.pathname), contentType: mime[path.extname(url.pathname)] });
        });
        await context.addInitScript(() => {
          window.review = { requests: [], calendarCalls: [], violations: [] };
          const deny = () => { window.review.violations.push("forbidden_io"); throw Error("forbidden_io"); };
          for (const name of ["fetch", "XMLHttpRequest", "WebSocket", "localStorage", "sessionStorage", "indexedDB", "caches"]) {
            Object.defineProperty(window, name, { configurable: true, get: deny });
          }
          document.addEventListener("securitypolicyviolation", event => window.review.violations.push(event.violatedDirective));
          let activities, fixtures;
          const wrapped = new Set();
          Object.defineProperty(window, "FamilyChatActivities", { configurable: true, get: () => activities, set(value) {
            activities = value;
            if (value.searchActivities && !wrapped.has(value.searchActivities)) {
              const searchActivities = async (request, options) => {
                window.review.requests.push(structuredClone(request));
                if (window.review.holdActivities) {
                  window.review.holdActivities = false;
                  await new Promise(resolve => { window.review.releaseActivities = resolve; });
                }
                return value.searchActivities(request, options);
              };
              wrapped.add(searchActivities); activities = { ...value, searchActivities };
            }
          } });
          Object.defineProperty(window, "FamilyCalendarFixtures", { configurable: true, get: () => fixtures, set(value) {
            fixtures = { ...value, create(options) {
              const transport = value.create(options);
              return { ...transport, async fetch(url, options) {
                window.review.calendarCalls.push(url);
                if (window.review.holdCalendar) {
                  window.review.holdCalendar = false;
                  await new Promise(resolve => { window.review.releaseCalendar = resolve; });
                }
                return transport.fetch(url, options);
              } };
            } };
          } });
        });
        const page = await context.newPage(); page.setDefaultTimeout(8000);
        page.on("pageerror", error => failures.push(error.message));
        await page.goto(`${origin}/chat/index.html`);
        assert.equal(await page.evaluate(() => isSecureContext && typeof crypto.randomUUID === "function"), true);
        await page.waitForFunction(() => document.documentElement.style.getPropertyValue("--composer-height"));
        assert.deepEqual(await page.evaluate(() => [review.requests.length, review.calendarCalls.length]), [0, 0]);
        await checkLayout(page);
        assert.deepEqual(await page.locator(".family-members li").evaluateAll(elements => elements.map(element => [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join("").trim())), ["Parent A", "Parent B", "Child"]);
        assert.ok(await page.locator(".family-section").isVisible());
        assert.equal(await page.locator("#calendar-conversation").isVisible(), false);
        assert.equal(await page.locator("#availability-load").isVisible(), false);
        for (const selector of ["#chat-calendar-status", "#calendar-month", "#availability-empty", "#availability-clear", "#chat-calendar-toggle"]) {
          assert.equal(await page.locator(selector).isVisible(), false, selector);
        }
        assert.equal(await page.locator(".conversation-region #calendar-host").count(), 1);
        await page.screenshot({ path: path.join(output, `family-${width}.png`) });
        await page.locator("#preferences-edit").press("Enter");
        assert.equal(await page.evaluate(() => document.activeElement.id), "preference-age");
        assert.match(await page.locator('label[for="preference-age"]').textContent(), /Child's age/);
        assert.deepEqual(await page.locator('.interest-options label:has(input[id^="interest-"])').allTextContents(), ["Basketball", "Baseball", "Ping-pong", "Movie", "Concerts", "Museums", "Outdoor play", "Science & discovery"]);
        assert.equal(await page.locator("#preference-age").evaluate(element => getComputedStyle(element).fontSize), "16px");
        await page.keyboard.press("ArrowUp"); assert.equal(await page.locator("#preference-age").inputValue(), "8");
        await page.keyboard.press("Tab"); assert.equal(await page.evaluate(() => document.activeElement.id), "preference-area");
        await page.locator("#preference-area").fill("Zhongshan, Taipei");
        await page.locator("#interest-movies").press("Space"); assert.equal(await page.locator("#interest-movies").isChecked(), false);
        assert.equal(await page.locator("#preference-age-summary").textContent(), "(7)");
        assert.equal(await page.evaluate(() => review.requests.length), 0);
        await page.keyboard.press("Escape"); assert.equal(await page.locator("#preferences-editor").isVisible(), false);
        assert.equal(await page.evaluate(() => document.activeElement.id), "preferences-edit");
        await page.keyboard.press("Enter"); assert.equal(await page.locator("#preference-age").inputValue(), "7");
        assert.equal(await page.locator("#interest-movies").isChecked(), true);
        await page.locator("#preference-age").fill("17"); await page.locator("#preferences-cancel").press("Enter");
        assert.equal(await page.locator("#preference-age-summary").textContent(), "(7)");
        assert.equal(await page.locator("#chat-start").count(), 0);
        await page.locator("#teams-edit").press("Enter");
        assert.equal(await page.evaluate(() => document.activeElement.id), "team-dea");
        assert.equal(await page.locator("#team-dea").isChecked(), true);
        await page.locator("#team-dea").press("Space");
        await page.locator("#preference-other-teams").fill("Formosa Dreamers");
        await page.locator("#preferences-cancel").press("Enter");
        assert.equal(await page.evaluate(() => document.activeElement.id), "teams-edit");
        await page.locator("#teams-edit").press("Enter");
        assert.equal(await page.locator("#team-dea").isChecked(), true);
        assert.equal(await page.locator("#preference-other-teams").inputValue(), "");
        await page.locator("#preferences-editor").screenshot({ path: path.join(output, `teams-editor-${width}.png`) });
        await page.keyboard.press("Escape");
        assert.equal(await page.evaluate(() => document.activeElement.id), "teams-edit");
        assert.equal(await page.evaluate(() => review.requests.length), 0);
        assert.equal(await page.locator("#chat-input").isEnabled(), true);
        await page.locator("#chat-input").press("Enter");
        assert.equal(await page.evaluate(() => review.requests.length), 0);
        await page.locator("#chat-input").fill("First line");
        await page.locator("#chat-input").press("Shift+Enter");
        await page.keyboard.insertText("Second line");
        assert.equal(await page.locator("#chat-input").inputValue(), "First line\nSecond line");
        await page.locator("#chat-input").evaluate(element => {
          element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true, cancelable: true }));
          element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", keyCode: 229, bubbles: true, cancelable: true }));
        });
        assert.equal(await page.locator("#chat-input").inputValue(), "First line\nSecond line");
        await page.locator("#chat-input").fill("Any family outing ideas for October?");
        assert.equal(await page.evaluate(() => review.requests.length), 0);
        assert.equal(await page.evaluate(() => review.calendarCalls.length), 0);
        await page.evaluate(() => { review.holdCalendar = true; review.holdActivities = true; });
        await page.locator("#chat-input").press("Enter");
        await checkProcessing(page, "Loading family members' calendars...", output, `processing-calendar-${width}.png`);
        assert.equal(await page.evaluate(() => review.requests.length), 0);
        await page.evaluate(() => review.releaseCalendar());
        await checkProcessing(page, "Finding activities that match your family's interests...", output, `processing-search-${width}.png`);
        assert.equal(await page.evaluate(() => review.requests.length), 1);
        await page.evaluate(() => review.releaseActivities());
        await page.waitForFunction(() => document.querySelector("#availability-grid")?.firstElementChild &&
          /Parent A: Loaded/.test(document.querySelector("#chat-calendar-status").textContent) &&
          /Parent B: Loaded/.test(document.querySelector("#chat-calendar-status").textContent));
        assert.doesNotMatch(await page.locator("#chat-calendar-status").textContent(), /Unavailable/);
        assert.ok(await page.locator("#chat-calendar-status").isVisible());
        assert.equal(await page.locator("#calendar-month").isVisible(), true);
        assert.equal(await page.locator("#availability-grid").isVisible(), true);
        assert.deepEqual(await page.locator("#chat-calendar-body > details, #chat-calendar-body > #calendar-candidates")
          .evaluateAll(elements => elements.map(element => element.id)), ["calendar-month-overview", "calendar-day-details", "calendar-candidates"]);
        assert.equal(await page.locator("#calendar-candidate-list button").count(), 6);
        assert.deepEqual(await page.locator("#calendar-candidate-list button").evaluateAll(buttons => buttons.map(button => button.dataset.candidateDate)),
          ["2026-10-03", "2026-10-04", "2026-10-10", "2026-10-17", "2026-10-24", "2026-10-31"]);
        assert.equal(new Set(await page.locator(".candidate-time").allTextContents()).size, 6);
        const candidateCalls = await page.evaluate(() => review.calendarCalls.length);
        await page.locator("#calendar-candidate-list button").first().press("Enter");
        assert.equal(await page.evaluate(() => document.activeElement.id), "availability-grid");
        assert.match(await page.locator("#availability-grid").getAttribute("aria-label"), /3 October 2026/);
        assert.equal(await page.locator(".candidate-window").count(), 1);
        assert.equal(await page.evaluate(() => review.calendarCalls.length), candidateCalls);
        await page.locator("#calendar-day-details > summary").press("Enter");
        assert.equal(await page.locator("#calendar-month-days button:enabled").count(), 31);
        await page.locator("#calendar-month-overview > summary").press("Enter");
        assert.equal(await page.locator("#availability-load").isVisible(), false);
        await page.locator("#calendar-candidates").screenshot({ path: path.join(output, `weekend-times-${width}.png`) });
        await page.locator("#coordination-review").press("Enter");
        assert.equal(await page.locator("#coordination-timeline .coordination-row > strong").first().textContent(), "Child / School meeting");
        assert.match(await page.locator("#coordination-status").textContent(), /30 minutes of overlap/);
        assert.equal(await page.locator("#coordination-one-parent, #coordination-select, #coordination-undo").count(), 0);
        assert.equal(await page.evaluate(() => document.activeElement.id), "chat-input");
        assert.match(await page.locator("#chat-messages li").last().textContent(), /half an hour.*Parent A's calendar looks clear then.*If only one parent needs to attend, shall I invite Parent A/);
        assert.match(await page.locator("#chat-messages li").last().textContent(), /Child's school meeting on Friday, October 16, 2026, 3:30-4:30 PM \(Asia\/Taipei\)\?/);
        assert.equal(await page.locator("#meeting-disclosure").count(), 0);
        assert.match(await page.locator("#chat-calendar-heading").textContent(), /Sample calendars/);
        assert.equal(await page.locator("#chat-calendar-source-details > summary").isVisible(), true);
        assert.match(await page.locator("#calendar-invitation-source").textContent(), /No invitation is delivered and no calendars are changed/);
        assert.doesNotMatch(await page.locator("#chat-messages").textContent(), /demo invitation|no real invitation/i);
        await page.screenshot({ path: path.join(output, `meeting-question-${width}.png`) });
        assert.equal(await page.locator(".coordination-overlap").count(), 1);
        await page.locator("#calendar-coordination").screenshot({ path: path.join(output, `conflict-before-${width}.png`) });
        await page.locator("#chat-input").fill("Yes");
        await page.locator("#chat-input").press("Enter");
        assert.equal(await page.locator("#coordination-result").isVisible(), false);
        await page.locator("#chat-input").fill("Yes, one parent is enough. Please send Parent A an invitation.");
        await page.locator("#chat-input").press("Enter");
        assert.match(await page.locator("#chat-messages li").last().textContent(), /Parent A's invitation for Child's school meeting.*awaiting his response/);
        assert.equal(await page.locator("#meeting-disclosure").count(), 0);
        await page.screenshot({ path: path.join(output, `meeting-reply-${width}.png`) });
        assert.match(await page.locator("#coordination-result").textContent(), /Parent A's invitation.*awaiting his response/);
        assert.equal(await page.locator("#coordination-status").textContent(), "Parent A pending response");
        assert.equal(await page.locator("#coordination-timeline .coordination-row > strong").first().textContent(), "Child / School meeting");
        assert.equal(await page.locator(".coordination-overlap").count(), 1);
        assert.equal(await page.evaluate(() => review.calendarCalls.length), candidateCalls);
        await page.locator("#calendar-coordination").screenshot({ path: path.join(output, `invitation-pending-${width}.png`) });
        await page.locator("#chat-input").fill("Undo"); await page.locator("#chat-input").press("Enter");
        assert.equal(await page.locator("#coordination-result").isVisible(), false);
        assert.match(await page.locator("#chat-messages li").last().textContent(), /I'll leave the invitation aside/);
        await page.locator("#chat-input").fill("Continue activities"); await page.locator("#chat-input").press("Enter");
        assert.ok(await page.locator("#calendar-conversation").isVisible());
        await page.evaluate(() => {
          window.originalCalendar = { grid: document.querySelector("#availability-grid").firstElementChild,
            dates: [document.querySelector("#availability-start").value, document.querySelector("#availability-end").value],
            freshness: document.querySelector("#chat-calendar-status").textContent, calls: review.calendarCalls.length };
        });
        await page.waitForFunction(() => document.querySelectorAll("#activity-results article").length === 2);
        assert.equal(await page.locator("#chat-page").getAttribute("data-processing"), "false");
        assert.deepEqual(await page.evaluate(() => review.calendarCalls), ["/api/child/sync", "/api/availability"]);
        assert.equal(await page.evaluate(() => review.requests.length), 1);
        assert.deepEqual(await page.locator("#preference-teams-summary li").allTextContents(), ["新北中信特攻", "中信兄弟"]);
        assert.equal(await page.locator("#chat-retry").isVisible(), false);
        assert.match(await page.locator("#chat-messages").textContent(), /preferred team 新北中信特攻, 中信兄弟, age 7, and Xinyi District/);
        assert.match(await page.locator("#activity-results article").first().textContent(), /新北中信特攻 vs 福爾摩沙夢想家.*preferred team: 新北中信特攻/s);
        assert.match(await page.locator("#activity-results article").nth(1).textContent(), /Forgotten Island.*Showtimes unverified.*matches your preferred area/s);
        const foreground = await page.locator("#activity-results").innerText();
        assert.doesNotMatch(foreground, /Age guidance\s+Unknown|Cost\s+Unknown|Travel time and distance unknown|Availability unknown|Retrieved:|2026-10-10T/);
        assert.match(foreground, /Protected \(6\+\)/);
        assert.match(foreground, /NT\$20\/ticket/);
        assert.equal(await page.locator("#activity-results .fc-activity-reason").count(), 2);
        assert.equal(await page.locator("#activity-results .fc-activity-actions a").count(), 6);
        assert.equal(await page.locator("#activity-results img").count(), 3);
        await page.locator("#activity-results img").evaluateAll(images => Promise.all(images.map(image => image.decode())));
        assert.equal(await page.locator("#activity-results img").evaluateAll(images => images.every(image => {
          const bounds = image.getBoundingClientRect(), media = image.parentElement.getBoundingClientRect();
          return image.naturalWidth > 0 && bounds.height <= media.height + 1 && bounds.width <= media.width + 1 && getComputedStyle(image).objectFit === "contain";
        })), true, "images fit their fixed media regions without clipping");
        assert.deepEqual(await page.locator("#activity-results img").evaluateAll(images => images.map(image => image.getAttribute("src"))),
          ["../activity-preview/chat-assets/formosa-dreamers.webp", "../activity-preview/chat-assets/ctbc-dea.png", "../activity-preview/chat-assets/forgotten-island.jpg"]);
        assert.deepEqual(await page.locator(".fc-matchup-name").allTextContents(), ["福爾摩沙夢想家", "新北中信特攻"]);
        assert.equal(await page.locator(".fc-matchup-time").textContent(), "17:00");
        assert.equal(await page.locator(".fc-matchup-time").evaluate(element =>
          element.getBoundingClientRect().height <= parseFloat(getComputedStyle(element).lineHeight) + 1), true, "start time stays on one line");
        assert.equal(await page.locator(".fc-matchup-panel").evaluate(panel => {
          const container = panel.getBoundingClientRect();
          return [...panel.querySelectorAll("span, strong, img")].every(element => {
            const bounds = element.getBoundingClientRect();
            return bounds.left >= container.left - 1 && bounds.right <= container.right + 1 &&
              bounds.top >= container.top - 1 && bounds.bottom <= container.bottom + 1 && element.scrollWidth <= element.clientWidth + 1;
          });
        }), true, "matchup logos and labels fit without overflowing");
        await page.locator(".fc-activity-matchup").screenshot({ path: path.join(output, `matchup-media-${width}.png`) });
        assert.match(await page.locator("#calendar-assessment").textContent(), /activity time is incomplete/);
        await page.locator("#activity-results").screenshot({ path: path.join(output, `public-picks-${width}.png`) });
        const gameDetails = page.locator("#activity-results article").first().locator("details");
        await gameDetails.locator("summary").press("Enter");
        assert.equal(await gameDetails.getAttribute("open"), "");
        assert.equal(await gameDetails.locator("a").last().getAttribute("href"), "https://tpbl.basketball/schedule/27539");
        await gameDetails.locator("summary").press("Enter");
        if (process.argv.includes("--calendar-review")) {
          await page.evaluate(() => { review.holdActivities = true; });
          await page.locator("#chat-input").fill("Could we do something sooner, like this weekend?");
          await page.locator("#chat-send").click();
          await checkProcessing(page, "Finding activities that match your family's interests...", output, `processing-weekend-${width}.png`);
          await page.evaluate(() => review.releaseActivities());
          await page.waitForFunction(() => document.querySelectorAll("#activity-results article").length === 1);
          assert.match(await page.locator("#calendar-assessment").innerText(), /Calendar not checked for this weekend/);
          assert.doesNotMatch(await page.locator("#calendar-assessment").innerText(), /outside the loaded October calendar/);
          assert.equal(await page.locator("#chat-page").getAttribute("data-processing"), "false");
          await page.locator("#chat-options-toggle").click();
          await page.locator("#chat-reset").click();
          assert.equal(await page.locator("#coordination-body").isVisible(), false);
          assert.equal(await page.locator("#coordination-one-parent").count(), 0);
          await page.locator("#chat-input").fill("October again"); await page.locator("#chat-send").click();
          await page.locator("#calendar-candidate-list button").nth(5).waitFor();
          await page.locator("#availability-clear").click();
          assert.equal(await page.locator("#calendar-candidate-list button").count(), 0);
          assert.equal(await page.locator("#coordination-result").isVisible(), false);
          assert.equal(await page.locator("#coordination-select").count(), 0);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
          assert.deepEqual(await page.evaluate(() => review.violations), []);
          assert.deepEqual(failures, []);
          reports.push({ width, calendarReview: true, candidateCount: 6, weeks: 5, overlapMinutes: 30,
            processing: ["preparing", "loading", "weekend loading", "settled"], invitation: "explicit simulated send, Parent A pending, Undo, Continue activities, reset, clear", forbiddenIO: 0 });
          continue;
        }
        await page.locator("#preferences-edit").press("Enter");
        await page.locator("#preference-age").fill("121"); await page.locator("#preferences-apply").press("Enter");
        assert.equal(await page.locator("#preferences-editor").isVisible(), true);
        assert.equal(await page.locator("#preference-age").evaluate(element => element.validity.rangeOverflow), true);
        assert.equal(await page.locator("#activity-results article").count(), 2);
        await page.locator("#preference-age").fill("12"); await page.locator("#preference-area").fill("  Zhongshan, Taipei  ");
        await page.locator("#interest-basketball").press("Space");
        await page.locator("#interest-baseball").press("Space");
        for (const value of ["concerts", "museums", "outdoor-play", "science-discovery"]) await page.locator(`#interest-${value}`).uncheck();
        await page.locator("#team-dea").uncheck();
        await page.locator("#preference-other-teams").fill("Formosa Dreamers, Formosa Dreamers");
        await page.locator("#preferences-editor").scrollIntoViewIfNeeded();
        await checkLayout(page); await page.screenshot({ path: path.join(output, `editor-${width}.png`) });
        await page.locator("#preferences-apply").press("Enter");
        assert.equal(await page.locator("#preference-age-summary").textContent(), "(12)");
        assert.equal(await page.locator("#preference-area-summary").textContent(), "Zhongshan, Taipei");
        assert.deepEqual(await page.locator("#preference-interests-summary li").allTextContents(), ["Movie"]);
        assert.deepEqual(await page.locator("#preference-teams-summary li").allTextContents(), ["中信兄弟", "Formosa Dreamers"]);
        assert.equal(await page.locator("#activity-results article").count(), 0);
        assert.equal(await page.evaluate(() => review.requests.length), 1);
        assert.equal(await page.evaluate(() => document.activeElement.id), "preferences-edit");
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await checkLayout(page, { lastItem: true });
        const calendarUnchanged = () => page.evaluate(() => originalCalendar.grid === document.querySelector("#availability-grid").firstElementChild &&
          originalCalendar.freshness === document.querySelector("#chat-calendar-status").textContent &&
          JSON.stringify(originalCalendar.dates) === JSON.stringify([document.querySelector("#availability-start").value, document.querySelector("#availability-end").value]) &&
          originalCalendar.calls === review.calendarCalls.length);
        assert.equal(await calendarUnchanged(), true);
        await page.locator("#chat-retry").press("Enter");
        await page.waitForFunction(() => document.querySelectorAll("#activity-results article").length === 2);
        assert.match(await page.locator("#activity-results article").first().textContent(), /Forgotten Island/);
        assert.match(await page.locator("#activity-results article").nth(1).textContent(), /preferred team: Formosa Dreamers/);
        assert.doesNotMatch(await page.locator("#activity-results").textContent(), /preferred team: 新北中信特攻/);
        await page.locator("#chat-input").fill("Could we go a little sooner instead?");
        await page.keyboard.press("Tab"); assert.equal(await page.evaluate(() => document.activeElement.id), "chat-send");
        await page.keyboard.press("Enter");
        await page.waitForFunction(() => document.querySelectorAll("#activity-results article").length === 1);
        assert.match(await page.locator("#activity-results").textContent(), /2026-09-20/);
        assert.match(await page.locator("#activity-results").textContent(), /Chiikawa.*Showtimes unverified/s);
        assert.equal(await page.locator("#activity-results img").count(), 1);
        assert.equal(await page.locator("#activity-results img").getAttribute("src"), "../activity-preview/chat-assets/chiikawa.jpg");
        await page.locator("#activity-results img").evaluateAll(images => Promise.all(images.map(image => image.decode())));
        await page.locator("#activity-results .fc-activity-media").screenshot({ path: path.join(output, `chiikawa-media-${width}.png`) });
        assert.equal(await page.locator("#chat-retry").isVisible(), false);
        assert.doesNotMatch(await page.locator("#activity-results").textContent(), /Forgotten Island|Skybound|Comets vs Grove/);
        const requests = await page.evaluate(() => review.requests);
        assert.doesNotMatch(JSON.stringify(requests), /Parent A|Parent B|Child/);
        assert.equal(requests.length, 3); assert.deepEqual(requests[1].preferences, requests[2].preferences);
        await page.locator("#chat-input").fill("What about another month?");
        await page.locator("#chat-send").press("Enter");
        assert.match(await page.locator("#chat-status").textContent(), /supported requests are complete/);
        assert.equal(await page.evaluate(() => review.requests.length), 3);
        assert.equal(requests[1].preferences.ages[0], 12); assert.equal(requests[1].preferences.interestBasis, "parent_confirmed");
        assert.equal(await calendarUnchanged(), true);
        await page.locator("#activity-results img").evaluateAll(images => Promise.all(images.map(image => image.decode())));
        const normalComposerHeight = await page.locator("#chat-composer").evaluate(element => element.getBoundingClientRect().height);
        await page.locator("#chat-input").evaluate(element => { element.style.height = "150px"; });
        await page.waitForFunction(height => parseFloat(document.documentElement.style.getPropertyValue("--composer-height")) > height + 50, normalComposerHeight);
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await checkLayout(page, { lastItem: true });
        await page.locator("#chat-input").evaluate(element => element.style.removeProperty("height"));
        await page.waitForFunction(height => Math.abs(parseFloat(document.documentElement.style.getPropertyValue("--composer-height")) - height) < 1, normalComposerHeight);
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await checkLayout(page, { lastItem: true }); await page.screenshot({ path: path.join(output, `results-${width}.png`) });
        if (width < 600) {
          await page.setViewportSize({ width, height: 440 });
          await page.locator("#chat-input").focus(); await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
          await checkLayout(page, { lastItem: true });
          await page.screenshot({ path: path.join(output, `keyboard-resize-${width}.png`) });
          await page.setViewportSize({ width, height: 900 });
          await page.evaluate(() => {
            window.nativeViewport = visualViewport;
            const viewport = Object.assign(new EventTarget(), { height: 440, offsetTop: 0 });
            Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
            window.dispatchEvent(new Event("resize")); window.scrollTo(0, document.documentElement.scrollHeight);
          });
          await checkLayout(page, { lastItem: true, viewportBottom: 440 });
          await page.screenshot({ path: path.join(output, `keyboard-overlay-${width}.png`) });
          await page.evaluate(() => { window.visualViewport.offsetTop = 40; window.dispatchEvent(new Event("resize")); window.scrollTo(0, document.documentElement.scrollHeight); });
          await checkLayout(page, { lastItem: true, viewportBottom: 480 });
          await page.evaluate(() => { Object.defineProperty(window, "visualViewport", { configurable: true, value: window.nativeViewport }); window.dispatchEvent(new Event("resize")); });
        }
        await page.locator("#preferences-edit").press("Enter");
        await page.locator("#preference-area").fill("x".repeat(120)); await page.locator("#preferences-apply").press("Enter");
        await checkLayout(page);
        assert.equal(await page.evaluate(() => review.requests.length), 3);
        await page.locator("#chat-options-toggle").press("Enter");
        await page.locator("#chat-reset").press("Enter");
        assert.equal(await page.locator("#preference-age-summary").textContent(), "(7)");
        assert.deepEqual(await page.locator("#preference-interests-summary li").allTextContents(), ["Basketball", "Baseball", "Movie", "Concerts", "Museums", "Outdoor play", "Science & discovery"]);
        assert.equal(await calendarUnchanged(), true);
        assert.deepEqual(await page.evaluate(() => review.violations), []); assert.deepEqual(failures, []);
        await page.locator("#preferences-edit").press("Enter");
        await page.locator("#preference-age").fill("5"); await page.locator("#preferences-apply").press("Enter");
        assert.equal(await page.locator("#preference-age-summary").textContent(), "(5)");
        await page.reload();
        assert.equal(await page.locator("#preference-age-summary").textContent(), "(7)");
        assert.deepEqual(await page.evaluate(() => [review.requests.length, review.calendarCalls.length]), [0, 0]);
        await page.evaluate(() => FamilyChatUI.mountChat(document).dispose());
        assert.equal(await page.locator("#chat-input").isDisabled(), true);
        assert.deepEqual(await page.evaluate(() => review.violations), []); assert.deepEqual(failures, []);
        reports.push({ width, keyboard: "Enter/Tab/Space/Escape/ArrowUp", searches: requests.length,
          calendarUnchanged: true, forbiddenIO: 0, mobileKeyboard: width < 600 ? "simulated resize/overlay/pan" : "not applicable" });
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
  if (snapshot) loadSnapshot(process.argv[snapshotIndex + 1], snapshot.manifestSha256);
  await fs.writeFile(path.join(output, "report.json"), `${JSON.stringify({ snapshotSha256: snapshot?.manifestSha256 ?? null,
    runnerSha256, sourceHashes, passed: reports }, null, 2)}\n`);
  console.log(JSON.stringify({ passed: reports, screenshots: path.relative(root, output) }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });