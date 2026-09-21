"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { sampleWeek, syntheticMarkup, story } = require("../scripts/record-integrated-demo");
const { wavInfo, escapeXML, stamp, chunks, narrationDelay } = require("../scripts/finish-integrated-demo");
const A = require("../owner/availability-core");
test("calendar timing simulation is opt-in and preserves calendar and meeting results", async () => {
  const { installDemoResponseDelay, captureOptions } = require("../scripts/record-demo");
  const callbacks = [], calls = [];
  const window = { setTimeout(callback, milliseconds) { assert.equal(milliseconds, 2000); callbacks.push(callback); } };
  require("node:vm").runInNewContext(`(${installDemoResponseDelay.toString()})({calendarPhases:true})`, { window });
  const result = { state: "review" }, host = {};
  window.FamilyChatCalendar = { mountCalendar(received) {
    assert.equal(received, host);
    return { loadSynthetic: () => { calls.push("load"); return result; }, coordinateMeeting: action => { calls.push(action); return result; } };
  } };
  const controller = window.FamilyChatCalendar.mountCalendar(host);
  const loading = controller.loadSynthetic(); assert.equal(calls.length, 0);
  callbacks.shift()(); assert.equal(await loading, result);
  assert.equal(controller.coordinateMeeting("review"), result);
  assert.equal(controller.coordinateMeeting("send_invitation"), result);
  assert.equal(callbacks.length, 0);
  assert.equal(window.demoTiming.calendarCalls, 1); assert.equal(window.demoTiming.meetingCalls, undefined);
  const args = ["--chat-preview", "--snapshot", "snapshot.json", "--sha256", "a".repeat(64)];
  assert.throws(() => captureOptions([...args, "--simulate-calendar"]));
  assert.equal(captureOptions([...args, "--simulate-loading", "--simulate-calendar"]).simulateCalendar, true);
});
test("loading verification skips meeting replies and waits for actual activity search", async () => {
  const { simulatedSearchStarted } = require("../scripts/record-demo");
  const vm = require("node:vm");
  for (const sample of [{ calls: 0, processing: "false", expected: false }, { calls: 1, processing: "true", expected: true }]) {
    const page = {
      async waitForFunction(predicate, previous) {
        const context = { window: { demoTiming: { calls: sample.calls } }, document: { querySelector: () => ({ dataset: { processing: sample.processing } }) } };
        assert.equal(vm.runInNewContext(`(${predicate.toString()})(${previous})`, context), true);
        context.window.demoTiming.calls = 0; context.document.querySelector = () => ({ dataset: { processing: "true" } });
        assert.equal(vm.runInNewContext(`(${predicate.toString()})(${previous})`, context), false);
      },
      async evaluate() { return sample.calls; }
    };
    assert.equal(await simulatedSearchStarted(page, 0), sample.expected);
  }
});
test("school chapter separates stories and shifts meeting captions without losing source time", () => {
  const { chapterPreviewPlan, chapterFrame } = require("../scripts/finish-real-calendar-demo");
  assert.deepEqual(chapterFrame({width:1440,height:1020}),{width:1440,height:1020,contentHeight:900});
  assert.deepEqual(chapterFrame({width:1920,height:1080}),{width:1920,height:1080,contentHeight:960});
  assert.throws(() => chapterFrame({width:1440,height:1080}));
  const capture = { duration: 61.72, timeline: [
    { start: 0.015, end: 38.484, text: "Outing ideas" },
    { start: 38.484, end: 55.359, text: "School meeting" },
    { start: 55.359, end: 61.702, text: "Undo" }
  ] };
  const original = JSON.stringify(capture), plan = chapterPreviewPlan(capture, 2);
  assert.equal(plan.at, 38.48); assert.equal(plan.duration, 64.72);
  assert.equal(plan.chapter.end, 41.48); assert.match(plan.chapter.text, /Another user story.*school meeting/);
  assert.equal(plan.timeline[0].end, 38.48);
  assert.equal(plan.timeline[2].start, 41.484); assert.equal(plan.captions.at(-1).end, 64.7);
  assert.equal(plan.at + (capture.duration - plan.at), capture.duration);
  assert.equal(JSON.stringify(capture), original);
  for (const index of [0, 1, 4, 1.5, NaN]) assert.throws(() => chapterPreviewPlan(capture, index));
  for (const seconds of [0, 1, 6, 3.01, NaN]) assert.throws(() => chapterPreviewPlan(capture, 2, seconds));
});
test("conversation trim removes configuration scenes and shifts all remaining captions", () => {
  const { trimPreviewPlan } = require("../scripts/finish-real-calendar-demo");
  const capture = { durationSeconds: 74.16, timeline: [
    { start: 1, end: 12.455, text: "Configuration" },
    { start: 12.455, end: 23.729, text: "Question" },
    { start: 23.729, end: 74.142, text: "Result and meeting" }
  ] };
  const plan = trimPreviewPlan(capture, 2);
  assert.equal(plan.sourceStart, 12.44); assert.equal(plan.duration, 61.72);
  assert.equal(plan.timeline.length, 2); assert.equal(plan.captions[0].start, 0.02);
  assert(plan.captions.every(cue => cue.end <= plan.duration && cue.text !== "Configuration"));
  for (const index of [0, 4, 1.5, NaN]) assert.throws(() => trimPreviewPlan(capture, index));
});
test("loading edit inserts labelled waits and shifts captions without losing source time", () => {
  const { loadingPlan } = require("../scripts/finish-real-calendar-demo");
  const timeline = [{ start: 0, end: 4, text: "Question" }, { start: 4, end: 10, text: "Result" }];
  const plan = loadingPlan(10, timeline, [{ at: 2, seconds: 2 }, { at: 4, seconds: 2 }]);
  assert.equal(plan.duration, 14);
  assert.deepEqual(plan.waits.map(wait => [wait.start, wait.end]), [[2, 4], [6, 8]]);
  assert.deepEqual(plan.captions.map(cue => [cue.start, cue.end]), [[0, 2], [2, 4], [4, 6], [6, 8], [8, 14]]);
  assert.match(plan.captions[1].text, /demo simulation.*No live query/);
  const nearBoundary = loadingPlan(10, [{ start: 0, end: 4.001, text: "Question" }, { start: 4.001, end: 10, text: "Result" }], [{ at: 4, seconds: 2 }]);
  assert.deepEqual(nearBoundary.captions.map(cue => [cue.start, cue.end]), [[0, 4], [4, 6], [6, 12]]);
  for (const insertions of [[{ at: 0, seconds: 2 }], [{ at: 10, seconds: 2 }], [{ at: 2.01, seconds: 2 }], [{ at: 2, seconds: 10 }], [{ at: 4, seconds: 2 }, { at: 2, seconds: 2 }]]) {
    assert.throws(() => loadingPlan(10, timeline, insertions));
  }
});
test("two-agent workflow definitions, local links and example scenario stay valid", () => {
  const fs = require("node:fs"), path = require("node:path");
  const root = path.resolve(__dirname, "..");
  const files = [".github/agents/familycopilot-builder.agent.md", ".github/agents/familycopilot-demo-producer.agent.md",
    ".github/skills/demo-video-production/SKILL.md", "docs/demo-workflow.md"];
  for (const file of files) {
    const text = fs.readFileSync(path.join(root, file), "utf8");
    if (file.startsWith(".github/")) assert.match(text, /^---\nname: .+\ndescription: ".+"\n/);
    for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
      const target = path.resolve(root, path.dirname(file), match[1]);
      if (!path.relative(root, target).startsWith("browser-artifacts/")) assert(fs.existsSync(target), `${file}: ${match[1]}`);
    }
    if (file.includes("builder.agent")) {
      assert.match(text, /sole product writer/i);
      assert.doesNotMatch(text, /Proposed shared contract v0|one age 8/);
    }
  }
  require("../scripts/demo-snapshot").validateScenario(JSON.parse(fs.readFileSync(path.join(root, "docs/demo-scenario.example.json"), "utf8")));
  const scripts = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).scripts;
  assert.equal(scripts.test, "node scripts/test-workflow.js quick");
  assert.equal(scripts["demo:plan"], "node scripts/finish-real-calendar-demo.js --plan-chat");
});
test("demo snapshots survive source edits but reject corruption, traversal, symlinks and overwrite", context => {
  const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
  const { createSnapshot, loadSnapshot, validateScenario } = require("../scripts/demo-snapshot");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "demo-snapshot-test-"));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.mkdirSync(path.join(directory, "chat"));
  fs.writeFileSync(path.join(directory, "chat/index.html"), '<script src="ui.js"></script>');
  fs.writeFileSync(path.join(directory, "chat/ui.js"), "original");
  const scenario = { version: 1, name: "fixture", executionMode: "synthetic", activityEvidence: "synthetic",
    referenceInstant: "2026-09-18T12:00:00+08:00", timezone: "Asia/Taipei", limitations: ["Test fixture"],
    scenes: [{ text: "A family outing.", holdMs: 100, actions: [] }] };
  const output = path.join(directory, "snapshot");
  const manifestFile = createSnapshot(directory, output, scenario);
  const before = loadSnapshot(manifestFile);
  assert.equal(loadSnapshot(manifestFile, before.manifestSha256).manifestSha256, before.manifestSha256);
  assert.throws(() => loadSnapshot(manifestFile, "0".repeat(64)), /Reviewed snapshot hash mismatch/);
  assert.throws(() => loadSnapshot(manifestFile, "not-a-sha256"), /Invalid reviewed snapshot hash/);
  const { spawnSync } = require("node:child_process");
  const command = (script, args) => spawnSync(process.execPath, [require.resolve(`../scripts/${script}`), ...args], {
    encoding: "utf8", timeout: 10000, env: { ...process.env, FAMILYCOPILOT_DEMO_TOOLS: "" }
  });
  const verified = command("demo-snapshot", ["--verify", manifestFile, "--sha256", before.manifestSha256]);
  assert.equal(verified.status, 0, verified.stderr);
  assert.equal(JSON.parse(verified.stdout).reviewedHashMatched, true);
  const unpinned = command("demo-snapshot", ["--verify", manifestFile]);
  assert.equal(unpinned.status, 0, unpinned.stderr);
  assert.equal(JSON.parse(unpinned.stdout).reviewedHashMatched, false);
  const rejected = command("demo-snapshot", ["--verify", manifestFile, "--sha256", "0".repeat(64)]);
  assert.equal(rejected.status, 1); assert.match(rejected.stderr, /Reviewed snapshot hash mismatch/);
  const capture = command("record-demo", ["--chat-preview", "--snapshot", manifestFile, "--sha256", "0".repeat(64)]);
  assert.equal(capture.status, 1); assert.match(capture.stderr, /Reviewed snapshot hash mismatch/);
  assert.doesNotMatch(capture.stderr, /Set FAMILYCOPILOT_DEMO_TOOLS|Cannot find module/);
  const missingHash = command("record-demo", ["--chat-preview", "--snapshot", manifestFile]);
  assert.equal(missingHash.status, 1); assert.match(missingHash.stderr, /reviewed manifest hash/);
  fs.writeFileSync(path.join(directory, "chat/ui.js"), "new version");
  assert.equal(loadSnapshot(manifestFile).assets.get("/chat/ui.js").toString(), "original");
  assert.equal(loadSnapshot(manifestFile).manifestSha256, before.manifestSha256);
  assert.equal(before.manifest.verification.browser, "not_run");
  assert.throws(() => createSnapshot(directory, output, scenario), /EEXIST/);
  for (const extra of ["../secret.js", "owner/../chat/ui.js", "chat/%2e%2e/secret.js", "owner/private.json"]) {
    assert.throws(() => createSnapshot(directory, path.join(directory, "invalid"), { ...scenario, extraAssets: [extra] }));
  }
  fs.symlinkSync(path.join(directory, "chat/ui.js"), path.join(directory, "chat/link.js"));
  assert.throws(() => createSnapshot(directory, path.join(directory, "linked"), { ...scenario, extraAssets: ["chat/link.js"] }), /Symlink/);
  const asset = path.join(output, "assets/chat/ui.js"); fs.chmodSync(asset, 0o600); fs.writeFileSync(asset, "corrupted");
  assert.throws(() => loadSnapshot(manifestFile), /Snapshot changed/);
  const changed = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  changed.sourceHashes["/chat/ui.js"] = require("../scripts/demo-snapshot").digest(Buffer.from("corrupted"));
  fs.chmodSync(manifestFile, 0o600); fs.writeFileSync(manifestFile, JSON.stringify(changed));
  assert.equal(loadSnapshot(manifestFile).assets.get("/chat/ui.js").toString(), "corrupted");
  assert.throws(() => loadSnapshot(manifestFile, before.manifestSha256), /Reviewed snapshot hash mismatch/);
  assert.throws(() => validateScenario({ ...scenario, executionMode: "live" }));
  assert.throws(() => validateScenario({ ...scenario, scenes: [{ text: "Unsafe", holdMs: 1, actions: [{ kind: "evaluate", selector: "body" }] }] }));
});
test("workflow tests use bounded explicit lists; listing never executes tests", () => {
  const { run, suites } = require("../scripts/test-workflow");
  let calls = 0;
  const execute = (command, args, options) => {
    calls++;
    assert.equal(command, process.execPath);
    assert.deepEqual(args, ["--test", ...suites.production]);
    assert.equal(options.timeout, 120000);
    return { status: 0 };
  };
  assert.equal(run(["production", "--list"], execute).status, 0);
  assert.equal(calls, 0);
  assert.equal(run(["production"], execute).status, 0);
  assert.equal(calls, 1);
  for (const args of [["all"], ["chat", "--live"], ["chat", "--list", "extra"]]) assert.throws(() => run(args, execute));
  for (const files of Object.values(suites)) {
    assert(files.length > 0);
    for (const file of files) assert.match(file, /^test\/[\w-]+\.test\.js$/);
  }
});
test("tall capture preserves native pixels and keeps loading simulation opt-in", () => {
  const { captureOptions, captureLayout } = require("../scripts/record-demo");
  const args = ["--chat-preview", "--snapshot", "snapshot.json", "--sha256", "a".repeat(64)];
  for (const flags of [["--viewport=1440x900"], ["--review-scenes", "--viewport=1440x900"]]) {
    const options = captureOptions([...args, ...flags]);
    assert.equal(options.simulateLoading, false);
    assert.deepEqual(captureLayout(options), { viewport: { width: 1440, height: 900 }, width: 1440, height: 1020,
      filter: "pad=1440:1020:0:0:color=0x25291f" });
    assert.doesNotMatch(captureLayout(options).filter, /scale|crop/);
  }
  assert.deepEqual(captureLayout(captureOptions(args)).viewport, { width: 1280, height: 640 });
  assert.throws(() => captureOptions([...args, "--viewport=1440x900", "--viewport=1440x900"]));
  assert.throws(() => captureOptions([...args, "--viewport=1440x901"]));
});
test("capture-only loading delay preserves responses and is explicit", async () => {
  const { installDemoResponseDelay, captureOptions } = require("../scripts/record-demo");
  let release, calls = 0;
  const window = { setTimeout(callback, milliseconds) { assert.equal(milliseconds, 2000); release = callback; } };
  require("node:vm").runInNewContext(`(${installDemoResponseDelay.toString()})()`, { window });
  const response = { status: "complete" }, request = {}, options = {};
  window.FamilyChatActivities = { searchActivities: async (received, settings) => {
    assert.equal(received, request); assert.equal(settings, options); calls++; return response;
  } };
  window.FamilyChatActivities = { ...window.FamilyChatActivities };
  const pending = window.FamilyChatActivities.searchActivities(request, options);
  assert.equal(calls, 0); assert.equal(window.demoTiming.calls, 1);
  release(); assert.equal(await pending, response); assert.equal(calls, 1);
  assert.equal(window.demoTiming.completed, 1);
  assert.equal(captureOptions(["--chat-preview", "--snapshot", "snapshot.json", "--sha256", "a".repeat(64), "--review-scenes", "--simulate-loading"]).simulateLoading, true);
  assert.throws(() => captureOptions(["--chat-preview", "--simulate-loading"]));
});
test("demo scene scrolling is smooth and waits for movement to settle with a deadline", async () => {
  const { smoothSceneScroll, sceneAction } = require("../scripts/record-demo");
  let time = 0, calls = 0, options;
  const view = { scrollY: 0, performance: { now: () => time }, requestAnimationFrame(callback) {
    time += 16; calls++;
    if (time < 320) view.scrollY += 10;
    queueMicrotask(callback);
  } };
  const element = { ownerDocument: { defaultView: view }, scrollIntoView(value) { options = value; } };
  await sceneAction({ locator: () => ({ evaluate: callback => callback(element) }) }, { kind: "scroll", selector: "#activity-results" });
  assert.deepEqual(options, { block: "start", behavior: "smooth" });
  assert(time >= 368 && calls > 4);
  time = 0;
  view.requestAnimationFrame = callback => { time += 16; view.scrollY += 10; queueMicrotask(callback); };
  await assert.rejects(smoothSceneScroll(element), /did not settle/);
});
test("snapshot recorder parses explicit input and executes only bounded scene actions", async () => {
  const { captureOptions, sceneAction } = require("../scripts/record-demo");
  assert.deepEqual(captureOptions(["--chat-preview"]), {});
  const hash = "a".repeat(64);
  const options = captureOptions(["--chat-preview", "--snapshot", "snapshot.json", "--sha256", hash]);
  assert(options.snapshot.endsWith("/snapshot.json"));
  assert.equal(options.snapshotSha256, hash);
  assert.equal(options.reviewFrame, false);
  assert.equal(options.reviewScenes, false);
  const review = captureOptions(["--chat-preview", "--snapshot", "snapshot.json", "--sha256", hash, "--review-scenes"]);
  assert.equal(review.reviewScenes, true);
  assert.equal(review.reviewFrame, false);
  assert.equal(captureOptions(["--chat-preview", "--snapshot", "snapshot.json", "--sha256", hash, "--review-frame"]).reviewFrame, true);
  assert.throws(() => captureOptions(["--chat-preview", "--snapshot", "snapshot.json", "--sha256", hash, "--unknown"]));
  assert.throws(() => captureOptions(["--chat-preview", "--snapshot", "snapshot.json"]));
  assert.throws(() => captureOptions(["--chat-preview", "--snapshot", "snapshot.json", "--sha256", "invalid"]));
  assert.throws(() => captureOptions(["--chat-preview", "--live", "x"]));
  const calls = [];
  const page = { locator(selector) {
    assert.equal(selector, "#chat-input");
    return { async pressSequentially(text) { calls.push(text); }, async inputValue() { return "October"; },
      async press(key) { calls.push(key); }, async isChecked() { return true; },
      async waitFor(options) { calls.push(options.state); } };
  } };
  await sceneAction(page, { kind: "type", selector: "#chat-input", text: "October" });
  await sceneAction(page, { kind: "value", selector: "#chat-input", text: "October" });
  assert.deepEqual(calls, ["October"]);
  await sceneAction(page, { kind: "press", selector: "#chat-input", key: "Enter" });
  await sceneAction(page, { kind: "checked", selector: "#chat-input", value: true });
  await sceneAction(page, { kind: "visible", selector: "#chat-input", value: false });
  assert.deepEqual(calls, ["October", "Enter", "hidden"]);
  await assert.rejects(sceneAction(page, { kind: "press", selector: "#chat-input", key: "Control+L" }), /Unapproved key/);
  await assert.rejects(sceneAction(page, { kind: "checked", selector: "#chat-input", value: false }));
  const { validateScenario } = require("../scripts/demo-snapshot");
  const scenario = JSON.parse(require("node:fs").readFileSync(require.resolve("../docs/demo-scenario.example.json"), "utf8"));
  scenario.scenes[0].actions = [
    { kind: "press", selector: "#chat-input", key: "Enter" },
    { kind: "checked", selector: "#team-dea", value: true },
    { kind: "visible", selector: "#chat-retry", value: false }
  ];
  validateScenario(scenario);
  scenario.scenes[0].actions[0].key = "Control+L";
  assert.throws(() => validateScenario(scenario), /Unapproved key/);
  scenario.scenes[0].actions.shift();
  scenario.scenes[0].actions[0].value = "true";
  assert.throws(() => validateScenario(scenario));
  await assert.rejects(sceneAction(page, { kind: "evaluate", selector: "#chat-input" }), /Unknown/);
});
test("chat preview captions follow the outing story without claiming live team or calendar fit", () => {
  const { chatStory, timestamp, subtitleChunks } = require("../scripts/record-demo");
  assert.equal(chatStory.length, 6);
  assert.match(chatStory[1], /October/);
  assert.match(chatStory[3], /basketball.*movie.*checking/);
  assert.match(chatStory[4], /this weekend/);
  assert.match(chatStory[5], /You decide/);
  assert.doesNotMatch(chatStory.join(" "), /CTBC|available tickets|conflict.free|live search/i);
  assert.equal(timestamp(61.25), "00:01:01,250");
  for (const text of chatStory) assert.equal(subtitleChunks(text).join(" "), text);
});
test("video calendar fixture is synthetic and bounded; unchanged latest UI gets explicit sample metadata", () => {
  const data = sampleWeek(); assert.equal(data.synthetic, true);
  assert.deepEqual(A.project(data, A.liveWindow).people, data.people);
  assert.deepEqual(Object.keys(data.people[0]).sort(), ["person", "slots", "status"]);
  const html = require("node:fs").readFileSync(require.resolve("../owner/index.html"), "utf8");
  const output = syntheticMarkup(html);
  assert.match(output, /name="owner-mode" content="synthetic"/);
  assert.match(output, /name="owner-csrf" content="synthetic-video-only"/);
  assert.match(output, /name="child-cache" content="child-saved-v1-memory"/);
  assert.throws(() => syntheticMarkup("<html></html>"));
});
test("family story introduces interests before basketball and ends at the source without technical narration", () => {
  assert.equal(story.length, 8);
  assert.match(story[0].text, /family time.*when could we go.*everyone enjoy/is);
  assert.doesNotMatch(story.slice(0, 4).map(s => s.title + s.text).join(" "), /basketball|T P B L|C T B C|official public schedule/i);
  assert.match(story[4].text, /Basketball it is.*family loves.*C T B C/s);
  assert.doesNotMatch(story[4].title, /basketball/i);
  assert(narrationDelay(4, true) > 5.8);
  assert.equal(narrationDelay(3, true), 0.15);
  assert.equal(narrationDelay(4, false), 0.15);
  assert.match(story[2].text, /consider.*might fit.*check Kimi's plans/s);
  assert.match(story[7].text, /official game page/);
  assert.doesNotMatch(story.map(s => s.text).join(" "), /Start over|invented game|Synthetic Away|fictional|sample calendars|saved profile|automatically.*free/i);
  for (const s of story) assert.equal(chunks(s.text).join(" "), s.text);
  assert.equal(stamp(59.9996), "00:01:00,000");
  assert.equal(stamp(59.9996, true), "0:01:00.00");
  assert.equal(escapeXML('<&"\''), "&lt;&amp;&quot;&apos;");
});
test("narration WAV validation rejects silence, truncation and incompatible formats", () => {
  const b = Buffer.alloc(46); b.write("RIFF"); b.writeUInt32LE(38, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(48000, 24); b.writeUInt32LE(96000, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(2, 40); b.writeInt16LE(500, 44);
  assert.equal(wavInfo(b).seconds, 1 / 48000);
  assert.throws(() => wavInfo(b.subarray(0, 45)));
  b.writeUInt16LE(2, 22); assert.throws(() => wavInfo(b)); b.writeUInt16LE(1, 22);
  b.writeInt16LE(0, 44); assert.throws(() => wavInfo(b));
});