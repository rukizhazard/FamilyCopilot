"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { escapeXML } = require("./finish-integrated-demo");

async function download(url, limit) {
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(60000),
    headers: { "User-Agent": "FamilyCopilot-local-demo-font-setup" } });
  assert.equal(response.status, 200, `Font source returned HTTP ${response.status}`);
  const parts = []; let bytes = 0;
  for await (const part of response.body) {
    bytes += part.length;
    assert(bytes <= limit, "Font source exceeded download limit");
    parts.push(part);
  }
  return Buffer.concat(parts);
}

async function install(tools) {
  assert(tools && path.isAbsolute(tools), "Set FAMILYCOPILOT_DEMO_TOOLS to the isolated tool directory");
  const base = await fs.realpath(tools);
  const directory = await fs.mkdtemp(path.join(base, "fonts-noto-tc-"));
  await fs.chmod(directory, 0o700);
  await fs.writeFile(path.join(directory, "attempt.json"), JSON.stringify({ startedAt: new Date().toISOString(), automaticRetry: false }), { flag: "wx" });
  const revisionBytes = await download("https://api.github.com/repos/google/fonts/commits/main", 1024 * 1024);
  const revision = JSON.parse(revisionBytes).sha;
  assert.match(revision, /^[a-f0-9]{40}$/);
  const origin = `https://raw.githubusercontent.com/google/fonts/${revision}/ofl/notosanstc`;
  const fontURL = `${origin}/NotoSansTC%5Bwght%5D.ttf`;
  const font = await download(fontURL, 32 * 1024 * 1024);
  assert(font.length > 1024 && font.readUInt32BE(0) === 0x00010000, "Expected TrueType font");
  const license = await download(`${origin}/OFL.txt`, 65536);
  assert(license.toString("utf8").includes("SIL OPEN FONT LICENSE"));
  await fs.writeFile(path.join(directory, "NotoSansTC.ttf"), font, { flag: "wx", mode: 0o400 });
  await fs.writeFile(path.join(directory, "OFL.txt"), license, { flag: "wx", mode: 0o400 });
  const cache = path.join(directory, "cache");
  await fs.mkdir(cache, { mode: 0o700 });
  const config = path.join(directory, "fonts.conf");
  await fs.writeFile(config, `<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">\n<fontconfig>\n<include ignore_missing="no">/etc/fonts/fonts.conf</include>\n<dir>${escapeXML(directory)}</dir>\n<cachedir>${escapeXML(cache)}</cachedir>\n</fontconfig>\n`, { flag: "wx", mode: 0o400 });
  const characters = [...new Set("\u65b0\u5317\u4e2d\u4fe1\u7279\u653b\u5144\u5f1f")].map(character => character.codePointAt(0).toString(16));
  const result = spawnSync("fc-match", ["-f", "%{family}\n%{file}\n", `:charset=${characters.join(" ")}`], {
    encoding: "utf8", timeout: 15000, env: { ...process.env, FONTCONFIG_FILE: config }, stdio: ["ignore", "pipe", "pipe"]
  });
  assert.equal(result.status, 0, "Isolated font matching failed");
  assert(result.stdout.includes("Noto Sans TC") && result.stdout.includes(path.join(directory, "NotoSansTC.ttf")), "Chinese glyph font match failed");
  const hash = bytes => createHash("sha256").update(bytes).digest("hex");
  const report = { directory, config, revision, fontURL, fontSha256: hash(font), licenseSha256: hash(license),
    checkedCodepoints: characters, fontMatchPassed: true, browserVisualReview: "pending", systemConfigurationChanged: false };
  await fs.writeFile(path.join(directory, "manifest.json"), JSON.stringify(report, null, 2) + "\n", { flag: "wx", mode: 0o400 });
  return report;
}

module.exports = { install };
if (require.main === module) {
  Promise.resolve().then(() => {
    assert.deepEqual(process.argv.slice(2), ["--install-approved"]);
    return install(process.env.FAMILYCOPILOT_DEMO_TOOLS);
  }).then(report => console.log(JSON.stringify(report, null, 2))).catch(error => {
    console.error(`Font setup stopped without retry: ${error.message}`); process.exitCode = 1;
  });
}