"use strict";
// Stage application CODE ONLY on the Windows local filesystem. Electron rejects
// UNC module loading; do not change its allowlist or reinterpret a blocked .ps1.
const fs = require("node:fs/promises"), path = require("node:path");
const { OwnerFailure } = require("./owner-calendar");
const manifest = Object.freeze([
  "scripts/windows-owner-worker.js", "scripts/windows-owner-protocol.js", "scripts/windows-azure-cli.js",
  "scripts/availability.js", "scripts/calendar-list.js", "scripts/owner-calendar.js", "scripts/owner-operation.js",
  "scripts/availability-capability.js", "infra/calendar-list.js", "infra/availability.js", "owner/availability-core.js"
]);
const root = path.resolve(__dirname, "..");
const tempRoot = "/mnt/c/Users/weitan/AppData/Local/Temp";
async function bundle(read = file => fs.readFile(path.join(root, file), "utf8")) {
  const modules = [];
  for (const file of manifest) {
    const source = await read(file);
    if (typeof source !== "string" || Buffer.byteLength(source) > 256 * 1024) throw new OwnerFailure("blocked");
    modules.push(`${JSON.stringify(file)}:function(require,module,exports,__filename,__dirname){\n${source}\n}`);
  }
  // Fixed module registry, no external package resolver or arbitrary file input.
  // The entry's normal require.main guard selects only status/availability/cleanup.
  return `"use strict";\nconst nativeRequire=require, posix=require('node:path').posix;\nconst modules={${modules.join(",\n")}};\nconst cache=Object.create(null);\nconst entry='scripts/windows-owner-worker.js';\nfunction load(id){\n if(cache[id])return cache[id].exports;\n if(!Object.hasOwn(modules,id))throw Error('blocked_module');\n const m={exports:{}};cache[id]=m;\n const r=name=>name.startsWith('node:')?nativeRequire(name):load(posix.normalize(posix.join(posix.dirname(id),name))+'.js');\n r.main=id===entry?m:null;\n modules[id](r,m,m.exports,id,posix.dirname(id));return m.exports;\n}\nload(entry);\n`;
}
async function stageBundle({ filesystem = fs, build = bundle, directory = tempRoot } = {}) {
  const source = await build();
  const folder = await filesystem.mkdtemp(path.join(directory, "familycopilot-owner-worker-"));
  const file = path.join(folder, "worker.cjs");
  const dispose = async () => { await filesystem.unlink(file); await filesystem.rmdir(folder); };
  try {
    await filesystem.writeFile(file, source, { flag: "wx", mode: 0o600 });
    if (!/^\/mnt\/c\//.test(file)) throw new OwnerFailure("blocked");
    return { nativePath: "C:\\" + file.slice("/mnt/c/".length).replaceAll("/", "\\"), dispose };
  } catch {
    // Only files created by this staging invocation, never a recursive remove.
    try { await dispose(); } catch { /* Failure is explicit; no auth/cache data was staged. */ }
    throw new OwnerFailure("unavailable");
  }
}
module.exports = { manifest, bundle, stageBundle };