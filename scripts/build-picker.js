"use strict";
const { build } = require("esbuild");
const { mkdirSync, copyFileSync } = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
async function run(synthetic = false) {
  const outdir = path.join(root, synthetic ? "dist-picker-synthetic" : "dist-picker");
  mkdirSync(outdir, { recursive:true });
  await build({ absWorkingDir:root, entryPoints:synthetic ? { main:"browser-fixtures/picker.js" } : { main:"picker/main.js", redirect:"picker/redirect.js" }, outdir,
    bundle:true, platform:"browser", format:"iife", target:["es2020"], minify:true, sourcemap:false,
    legalComments:"eof", logLevel:"warning" });
  for (const file of ["index.html", "redirect.html", "picker.css"]) copyFileSync(path.join(root, "picker", file), path.join(outdir, file));
  // Preserve the complete SDK license in the deployable static output.
  copyFileSync(path.join(root, "node_modules/@azure/msal-browser/LICENSE"), path.join(outdir, "MSAL-LICENSE.txt"));
  console.log(synthetic ? "Built SYNTHETIC browser harness only. No Microsoft connection." : "Built isolated picker and MSAL redirect bridge. No cloud deployment or authentication performed.");
}
if (require.main === module) run(process.argv[2] === "--synthetic").catch(() => { console.error("Picker build failed. Review installed dependencies and source files."); process.exitCode = 1; });
module.exports = { run };