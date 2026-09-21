"use strict";
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const root = path.resolve(__dirname, "..");
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const readJSON = file => JSON.parse(fs.readFileSync(file, "utf8"));
const actionKeys = {
  type: ["selector", "text"], click: ["selector"], scroll: ["selector"],
  count: ["selector", "value"], text: ["selector", "text"],
  value: ["selector", "text"], images: ["selector"], press: ["selector", "key"],
  checked: ["selector", "value"], visible: ["selector", "value"]
};

function validateScenario(scenario) {
  assert.equal(scenario.version, 1);
  assert.equal(scenario.executionMode, "synthetic");
  assert(["synthetic", "public_snapshot"].includes(scenario.activityEvidence));
  assert.equal(scenario.timezone, "Asia/Taipei");
  assert(Number.isFinite(Date.parse(scenario.referenceInstant)));
  assert(typeof scenario.name === "string" && scenario.name.length > 0);
  assert(Array.isArray(scenario.limitations) && scenario.limitations.every(item => typeof item === "string"));
  assert(Array.isArray(scenario.scenes) && scenario.scenes.length > 0 && scenario.scenes.length <= 12);
  for (const scene of scenario.scenes) {
    assert(typeof scene.text === "string" && scene.text.length > 0 && scene.text.length <= 500);
    assert(!/[\r\n{}\\]/.test(scene.text), "Caption control characters rejected");
    assert(Number.isInteger(scene.holdMs) && scene.holdMs >= 0 && scene.holdMs <= 15000);
    assert(Array.isArray(scene.actions) && scene.actions.length <= 20);
    for (const action of scene.actions) {
      assert(Object.hasOwn(actionKeys, action.kind), "Unknown scene action");
      assert.deepEqual(Object.keys(action).sort(), ["kind", ...actionKeys[action.kind]].sort());
      assert(typeof action.selector === "string" && action.selector.length > 0 && action.selector.length <= 300);
      if (action.kind === "count") assert(Number.isInteger(action.value) && action.value >= 0 && action.value <= 50);
      if (["checked", "visible"].includes(action.kind)) assert.equal(typeof action.value, "boolean");
      if (action.kind === "press") assert(["Enter", "Space", "Escape"].includes(action.key), "Unapproved key");
      if (Object.hasOwn(action, "text")) assert(typeof action.text === "string" && action.text.length <= 1000);
    }
  }
  return scenario;
}

function assetName(name) {
  assert(typeof name === "string" && !name.includes("\\") && !name.includes("%"));
  assert.equal(path.posix.normalize(name), name);
  assert(!name.startsWith("/") && !name.split("/").includes(".."));
  assert(/^(chat|owner|shared|activity-preview)\/[\w./-]+\.(html|js|css|svg|png|jpg|webp|woff2)$/.test(name), "Not a public static asset");
  assert(!name.endsWith(".html") || name === "chat/index.html");
  return name;
}

function safeFile(base, relative) {
  let current = path.resolve(base);
  assert(!fs.lstatSync(current).isSymbolicLink(), "Symlink rejected");
  for (const part of relative.split("/")) {
    current = path.join(current, part);
    assert(!fs.lstatSync(current).isSymbolicLink(), "Symlink rejected");
  }
  assert(fs.statSync(current).isFile());
  return current;
}

function collectAssets(sourceRoot, extraAssets = []) {
  assert(Array.isArray(extraAssets));
  const htmlName = "chat/index.html";
  const html = fs.readFileSync(safeFile(sourceRoot, htmlName));
  const names = new Set([htmlName, ...extraAssets.map(assetName)]);
  const origin = "http://familycopilot.localhost";
  for (const match of html.toString("utf8").matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/g)) {
    const url = new URL(match[1], `${origin}/chat/index.html`);
    assert(url.origin === origin && !url.search && !url.hash, "External asset rejected");
    names.add(assetName(url.pathname.slice(1)));
  }
  const assets = new Map([[htmlName, html]]);
  for (const name of [...names].sort()) if (!assets.has(name)) assets.set(name, fs.readFileSync(safeFile(sourceRoot, name)));
  for (const [name, bytes] of assets) {
    assert.equal(digest(fs.readFileSync(safeFile(sourceRoot, name))), digest(bytes), `Source changed during export: ${name}`);
  }
  return assets;
}

function createSnapshot(sourceRoot, directory, scenario) {
  validateScenario(scenario);
  const assets = collectAssets(sourceRoot, scenario.extraAssets);
  fs.mkdirSync(directory, { mode: 0o700 });
  const hashes = {};
  for (const [name, bytes] of assets) {
    const file = path.join(directory, "assets", name);
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    fs.writeFileSync(file, bytes, { flag: "wx", mode: 0o400 });
    hashes[`/${name}`] = digest(bytes);
  }
  const manifest = { version: 1, kind: "familycopilot.demo.snapshot", createdAt: new Date().toISOString(),
    entry: "/chat/index.html", scenario, sourceHashes: hashes,
    verification: { packagingOnly: true, browser: "not_run", recordingApproval: "required" } };
  const manifestFile = path.join(directory, "snapshot.json");
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + "\n", { flag: "wx", mode: 0o400 });
  return manifestFile;
}

function loadSnapshot(manifestFile, expectedSha256) {
  if (expectedSha256 !== undefined) assert.match(expectedSha256, /^[a-f0-9]{64}$/, "Invalid reviewed snapshot hash");
  const directory = path.dirname(path.resolve(manifestFile));
  const bytes = fs.readFileSync(safeFile(directory, path.basename(manifestFile)));
  const manifestSha256 = digest(bytes);
  if (expectedSha256 !== undefined) assert.equal(manifestSha256, expectedSha256, "Reviewed snapshot hash mismatch");
  const manifest = JSON.parse(bytes);
  assert.equal(manifest.version, 1); assert.equal(manifest.kind, "familycopilot.demo.snapshot");
  assert.equal(manifest.entry, "/chat/index.html"); validateScenario(manifest.scenario);
  assert(manifest.sourceHashes && Object.hasOwn(manifest.sourceHashes, manifest.entry));
  const assets = new Map();
  for (const [url, expected] of Object.entries(manifest.sourceHashes)) {
    assert(url.startsWith("/"));
    const name = assetName(url.slice(1));
    assert.match(expected, /^[a-f0-9]{64}$/);
    const content = fs.readFileSync(safeFile(directory, `assets/${name}`));
    assert.equal(digest(content), expected, `Snapshot changed: ${url}`);
    assets.set(url, content);
  }
  return { manifest, manifestSha256, assets };
}

module.exports = { createSnapshot, loadSnapshot, collectAssets, validateScenario, digest };
if (require.main === module) {
  try {
    const [mode, file, option, expectedSha256] = process.argv.slice(2);
    if (mode === "--verify") {
      assert(process.argv.length === 4 || process.argv.length === 6, "Use --verify snapshot.json [--sha256 reviewed-hash]");
      if (process.argv.length === 6) {
        assert.equal(option, "--sha256");
        assert.match(expectedSha256, /^[a-f0-9]{64}$/, "Invalid reviewed snapshot hash");
      }
      const result = loadSnapshot(path.resolve(file), expectedSha256);
      console.log(JSON.stringify({ manifestSha256: result.manifestSha256, assets: result.assets.size,
        verified: true, reviewedHashMatched: expectedSha256 !== undefined }));
    } else {
      assert.equal(process.argv.length, 4, "Use --create scenario.json");
      assert.equal(mode, "--create");
      const directory = path.join(root, "browser-artifacts/demo", `snapshot-${require("node:crypto").randomUUID()}`);
      console.log(createSnapshot(root, directory, readJSON(file)));
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}