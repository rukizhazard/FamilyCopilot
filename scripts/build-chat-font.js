"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const fontPackage = "https://cdn.jsdelivr.net/npm/@fontsource-variable/nunito-sans@5.2.6";
const iconPackage = "https://cdn.jsdelivr.net/npm/lucide-static@0.468.0";
const start = "/* BEGIN bundled Nunito Sans */";
const end = "/* END bundled Nunito Sans */";

async function download(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: "error" });
  if (!response.ok) throw Error(`Asset download failed: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 1024 * 1024) throw Error("Unexpected asset size");
  return bytes;
}

async function main() {
  const [font, fontLicense, iconLicense] = await Promise.all([
    download(`${fontPackage}/files/nunito-sans-latin-wght-normal.woff2`),
    download(`${fontPackage}/LICENSE`), download(`${iconPackage}/LICENSE`)
  ]);
  if (font.subarray(0, 4).toString() !== "wOF2") throw Error("Expected WOFF2 font");
  const cssPath = path.join(root, "chat/chat.css");
  const css = await fs.readFile(cssPath, "utf8");
  const first = css.indexOf(start), last = css.indexOf(end);
  if ((first < 0) !== (last < 0) || first > last) throw Error("Invalid font block markers");
  const block = `${start}\n@font-face { font-family: "Nunito Sans"; font-style: normal; font-weight: 200 900; font-display: swap; src: url(data:font/woff2;base64,${font.toString("base64")}) format("woff2"); }\n${end}\n`;
  const updated = first < 0 ? block + css : css.slice(0, first) + block + css.slice(last + end.length).replace(/^\n/, "");
  const notices = `Bundled chat assets\n\nNunito Sans (Latin variable font)\n${fontPackage}\n${fontLicense.toString()}\n\nLucide pencil, map-pin, plus, arrow-up (inline SVG)\n${iconPackage}\n${iconLicense.toString()}\n`;
  await fs.writeFile(path.join(root, "chat/THIRD-PARTY-NOTICES.txt"), notices);
  await fs.writeFile(cssPath, updated);
  console.log("Bundled Nunito Sans and saved font/icon license notices. No runtime external requests required.");
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });