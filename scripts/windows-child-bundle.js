"use strict";
// Fixed application CODE ONLY. No credentials, snapshots, school files, server
// assets or user-selected module paths. All relative imports resolve in registry.
const fs = require("node:fs/promises"), path = require("node:path");
const { OwnerFailure } = require("./owner-calendar");
const { stageBundle } = require("./windows-owner-bundle");
const manifest = Object.freeze([
  "scripts/windows-child-worker.js", "scripts/windows-child-protocol.js", "scripts/windows-azure-cli.js",
  "scripts/child-calendar.js", "scripts/child-calendar-session.js", "scripts/child-calendar-preflight.js",
  "scripts/availability.js", "scripts/calendar-list.js", "scripts/owner-calendar.js", "scripts/owner-operation.js",
  "scripts/owner-local-status.js", "scripts/availability-capability.js", "infra/calendar-list.js", "infra/availability.js",
  "infra/child-calendar.js", "owner/availability-core.js", "owner/child-calendar-core.js"
]);
const root = path.resolve(__dirname, "..");
async function bundle(read = file => fs.readFile(path.join(root, file), "utf8")) {
  const modules = [];
  for (const file of manifest) {
    const source = await read(file);
    if (typeof source !== "string" || Buffer.byteLength(source) > 256 * 1024) throw new OwnerFailure("blocked");
    modules.push(`${JSON.stringify(file)}:function(require,module,exports,__filename,__dirname){\n${source}\n}`);
  }
  return `"use strict";\nconst nativeRequire=require,posix=require('node:path').posix;\nconst modules={${modules.join(",\n")}};\nconst cache=Object.create(null),entry='scripts/windows-child-worker.js';\nfunction load(id){\n if(cache[id])return cache[id].exports;\n if(!Object.hasOwn(modules,id))throw Error('blocked_module');\n const m={exports:{}};cache[id]=m;\n const r=name=>name.startsWith('node:')?nativeRequire(name):load(posix.normalize(posix.join(posix.dirname(id),name))+'.js');\n r.main=id===entry?m:null;\n modules[id](r,m,m.exports,id,posix.dirname(id));return m.exports;\n}\nload(entry);\n`;
}
async function stageChildBundle(options = {}) {
  // Parent's staging helper removes only its own file/directory. A failure on
  // that path may include uncertain disposal, so always promote it to sticky.
  try { return await stageBundle({ ...options, build: bundle }); }
  catch { throw new OwnerFailure("cleanup_failed"); }
}
module.exports = { manifest, bundle, stageChildBundle };