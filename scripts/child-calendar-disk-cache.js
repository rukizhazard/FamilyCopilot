"use strict";
// Separate bounded private child file. Never inspect/create files at construction.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { createHash, randomUUID } = require("node:crypto");
const C = require("../owner/child-calendar-core");
const { ChildCacheFailure } = require("./child-calendar-cache");
const version = 1, maxFileBytes = 270 * 1024;
// Reserved writer namespace, including pre-restart artifacts. Never recurse or
// adopt arbitrary prefix matches; excessive directory entries fail closed.
const tempPattern = /^\.child-calendar-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.tmp$/;
const maxDirectoryEntries = 256;
const root = path.resolve(__dirname, "..");
const validBinding = b => typeof b === "string" && /^[a-f0-9]{64}$/.test(b);
function childBinding({ workspace = root, home = os.homedir(), uid = process.getuid(), mode = "windows-native" } = {}) {
  // Local binding only, NOT a fresh provider identity/permission assertion.
  return createHash("sha256").update(JSON.stringify([version, uid, home, workspace, mode, C.contract, C.window, "child-saved-v1"])).digest("hex");
}
function createChildDiskStore({ directory, binding, io = fs, now = Date.now } = {}) {
  if (!path.isAbsolute(directory || "") || !validBinding(binding)) throw new ChildCacheFailure();
  const filename = path.join(directory, "child-calendar.json"), flags = fs.constants;
  const ownedTemps = new Map();
  const outsideRepo = dir => { const relative = path.relative(root, dir); return relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative); };
  const privateStat = (stat, dir = false) => stat.uid === process.getuid() && (stat.mode & 0o7777) === (dir ? 0o700 : 0o600) &&
    (dir ? stat.isDirectory() : stat.isFile() && stat.nlink === 1);
  const close = fd => { try { io.closeSync(fd); } catch { throw new ChildCacheFailure(); } };
  function checkDirectory(create = false) {
    if (!outsideRepo(path.resolve(directory))) throw new ChildCacheFailure();
    try {
      if (create) io.mkdirSync(directory, { recursive: true, mode: 0o700 });
      if (!privateStat(io.lstatSync(directory), true)) throw new ChildCacheFailure();
      const real = io.realpathSync(directory);
      if (real !== path.resolve(directory) || !outsideRepo(real)) throw new ChildCacheFailure();
      return true;
    } catch (error) { if (!create && error.code === "ENOENT") return false; throw error; }
  }
  function open(access, target = filename) {
    const fd = io.openSync(target, access | flags.O_NOFOLLOW | flags.O_NONBLOCK);
    try { if (!privateStat(io.fstatSync(fd))) throw new ChildCacheFailure(); return fd; }
    catch (error) { close(fd); throw error; }
  }
  const sameInode = (a, b) => a.dev === b.dev && a.ino === b.ino;
  function temporaryFiles() {
    const dir = io.opendirSync(directory), result = [];
    try {
      let entry, count = 0;
      while ((entry = dir.readSync()) !== null) {
        if (++count > maxDirectoryEntries) throw new ChildCacheFailure();
        // The length check also rejects a trailing newline accepted by JS '$'.
        if (typeof entry.name === "string" && entry.name.length === 56 && tempPattern.test(entry.name)) result.push(path.join(directory, entry.name));
      }
      return result;
    } finally { dir.closeSync(); }
  }
  function requireNoTemps() {
    if (ownedTemps.size || temporaryFiles().length) throw new ChildCacheFailure();
  }
  function checkedStat(target, expected) {
    const stat = io.lstatSync(target);
    if (!privateStat(stat) || (expected && !sameInode(stat, expected))) throw new ChildCacheFailure();
    return stat;
  }
  function unlink(target, expected) {
    if (!checkDirectory()) return;
    try { checkedStat(target, expected); io.unlinkSync(target); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    ownedTemps.delete(target);
  }
  function erase(target) {
    let fd, stat, failed = false;
    if (!checkDirectory()) { ownedTemps.delete(target); return; }
    try { stat = checkedStat(target, ownedTemps.get(target)); }
    catch (error) { if (error.code === "ENOENT") { ownedTemps.delete(target); return; } throw error; }
    try {
      fd = open(flags.O_WRONLY, target);
      const opened = io.fstatSync(fd);
      if (!privateStat(opened) || !sameInode(opened, stat)) throw new ChildCacheFailure();
      io.ftruncateSync(fd, 0); io.fsyncSync(fd);
    } catch { failed = true; }
    finally { if (fd !== undefined) { try { close(fd); } catch { failed = true; } } }
    // Independently remove only the same safe inode, even after a wipe failure.
    // Truncation is byte removal from this inode, not physical secure erasure.
    try { unlink(target, stat); } catch { failed = true; }
    if (failed) throw new ChildCacheFailure();
  }
  function validate(value) {
    try {
      if (!C.exact(value, ["version", "binding", "contract", "access", "data"]) || value.version !== version || value.binding !== binding || value.contract !== C.contract) throw Error();
      return C.saved({ status: "saved", access: value.access, data: value.data }, now());
    } catch { throw new ChildCacheFailure("child_cache_invalid"); }
  }
  return {
    read() {
      let fd;
      try {
        if (!checkDirectory()) return null;
        requireNoTemps();
        try { fd = open(flags.O_RDONLY); } catch (error) { if (error.code === "ENOENT") return null; throw error; }
        if (io.fstatSync(fd).size > maxFileBytes) throw new ChildCacheFailure("child_cache_invalid");
        const buffer = Buffer.alloc(maxFileBytes + 1); let bytes = 0, count;
        while (bytes < buffer.length && (count = io.readSync(fd, buffer, bytes, buffer.length - bytes, null))) bytes += count;
        if (bytes > maxFileBytes) throw new ChildCacheFailure("child_cache_invalid");
        let value; try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, bytes))); } catch { throw new ChildCacheFailure("child_cache_invalid"); }
        return validate(value);
      } catch (error) { throw new ChildCacheFailure(error instanceof ChildCacheFailure ? error.code : undefined); }
      finally { if (fd !== undefined) close(fd); }
    },
    write(access, data) {
      let temp, fd;
      try {
        const value = { version, binding, contract: C.contract, access, data }; validate(value);
        const text = JSON.stringify(value); if (Buffer.byteLength(text) > maxFileBytes) throw new ChildCacheFailure("child_cache_invalid");
        checkDirectory(true);
        requireNoTemps();
        // Never replace an unsafe existing inode or follow a symlink.
        try { if (!privateStat(io.lstatSync(filename))) throw new ChildCacheFailure(); } catch (error) { if (error.code !== "ENOENT") throw error; }
        temp = path.join(directory, `.child-calendar-${randomUUID()}.tmp`);
        fd = io.openSync(temp, flags.O_WRONLY | flags.O_CREAT | flags.O_EXCL | flags.O_NOFOLLOW, 0o600);
        // Own the path only after exclusive creation succeeded, never on EEXIST.
        ownedTemps.set(temp, null);
        const stat = io.fstatSync(fd); ownedTemps.set(temp, stat);
        if (!privateStat(stat)) throw new ChildCacheFailure();
        io.writeFileSync(fd, text, "utf8"); io.fsyncSync(fd); close(fd); fd = undefined;
        io.renameSync(temp, filename); ownedTemps.delete(temp); temp = undefined;
      } catch (error) { throw new ChildCacheFailure(error instanceof ChildCacheFailure ? error.code : undefined); }
      finally {
        try { if (fd !== undefined) close(fd); }
        finally {
          if (temp && ownedTemps.has(temp)) {
            try { unlink(temp, ownedTemps.get(temp)); }
            catch { /* Retain ownership; explicit Clear must recover before reuse. */ }
          }
        }
      }
    },
    clear() {
      try {
        if (!checkDirectory()) { ownedTemps.clear(); return; }
        const targets = new Set([filename, ...ownedTemps.keys()]); let failed = false;
        try { for (const temp of temporaryFiles()) targets.add(temp); } catch { failed = true; }
        // A missing/failed canonical file must not skip independent temp cleanup.
        for (const target of targets) { try { erase(target); } catch { failed = true; } }
        if (checkDirectory() && temporaryFiles().length) failed = true;
        if (failed || ownedTemps.size) throw new ChildCacheFailure();
      } catch { throw new ChildCacheFailure("child_cache_clear_failed"); }
    }
  };
}
module.exports = { createChildDiskStore, childBinding, maxFileBytes, version };