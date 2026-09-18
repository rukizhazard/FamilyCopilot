"use strict";
// Confirmed native caller-bound references only. No provider/session transport,
// events, automatic reads, expiry, or default private-directory discovery.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { createHash, randomUUID } = require("node:crypto");
const C = require("../owner/child-calendar-core");
const version = 1, maxFileBytes = 16 * 1024, maxDirectoryEntries = 256;
const root = path.resolve(__dirname, "..");
const tempPattern = /^\.child-source-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.tmp$/;
const codes = new Set(["child_source_invalid", "child_source_unavailable", "child_source_clear_failed"]);
class ChildSourceFailure extends Error {
  constructor(code = "child_source_unavailable") {
    super(codes.has(code) ? code : "child_source_unavailable");
    this.code = this.message;
  }
}
const failureOf = error => new ChildSourceFailure(error instanceof ChildSourceFailure ? error.code : undefined);
const hex = value => typeof value === "string" && value.length === 64 && /^[a-f0-9]{64}$/.test(value);
// Reject hidden/symbol fields, accessors and custom prototypes too; validation
// must not run a supplied getter or toJSON while projecting reviewed authority.
function exact(value, keys) {
  if (!value || typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
  const own = Reflect.ownKeys(value);
  return own.length === keys.length && keys.every(key => {
    const d = Object.getOwnPropertyDescriptor(value, key);
    return d && d.enumerable && Object.hasOwn(d, "value");
  });
}
function validate(record) {
  try {
    if (!exact(record, ["version", "reference", "access", "window"]) || record.version !== version || !hex(record.reference) ||
      !exact(record.access, ["person", "guardian", "disclosure", "sourceName"]) ||
      !exact(record.window, Object.keys(C.window)) || Object.keys(C.window).some(key => record.window[key] !== C.window[key])) throw Error();
    return { version, reference: record.reference, access: C.savedAccess(record.access), window: { ...C.window } };
  } catch { throw new ChildSourceFailure("child_source_invalid"); }
}
// Synchronous storage only. A thenable cannot establish completed retention or
// deletion. The seam is trusted application code, never browser configuration.
function synchronous(value) {
  if (value && typeof value.then === "function") throw new ChildSourceFailure();
  return value;
}
function createChildSourceStore({ storage, now = Date.now } = {}) {
  // `now` is intentionally unused: the exact reviewed record has no consentAt/TTL.
  let entry = null, generation = 0, failure = null, clearing = false;
  const attempt = fn => {
    try { return fn(); }
    catch (error) { entry = null; failure = failureOf(error); throw failure; }
  };
  return {
    get retention() { return storage ? "disk" : "memory"; },
    get generation() { return generation; },
    get failure() { return failure; },
    fence() { generation++; },
    get() {
      if (failure) throw failure;
      if (clearing) return null;
      return attempt(() => {
        const current = generation;
        if (!entry && storage) {
          const value = synchronous(storage.read());
          const safe = value === null ? null : validate(value);
          if (current !== generation) return null;
          entry = safe;
        }
        return entry ? validate(entry) : null;
      });
    },
    put(reference, access, current = generation) {
      if (current !== generation || clearing) return false;
      if (failure) throw failure;
      return attempt(() => {
        const safe = validate({ version, reference, access, window: C.window });
        if (current !== generation) return false;
        if (storage) synchronous(storage.write(validate(safe)));
        // Also fence reentrant trusted storage callbacks. No late durable record
        // may outlive a Clear/fence performed inside a synchronous write seam.
        if (current !== generation) {
          entry = null;
          try { if (storage) synchronous(storage.clear()); }
          catch { throw new ChildSourceFailure("child_source_clear_failed"); }
          return false;
        }
        entry = safe;
        return true;
      });
    },
    clear({ recover = false } = {}) {
      generation++; entry = null;
      const previous = failure;
      if (clearing) { failure = new ChildSourceFailure("child_source_clear_failed"); throw failure; }
      clearing = true;
      try {
        if (storage) synchronous(storage.clear());
        failure = recover === true ? null : previous;
      } catch { failure = new ChildSourceFailure("child_source_clear_failed"); throw failure; }
      finally { clearing = false; }
    }
  };
}
function sourceBinding({ workspace = root, home = os.homedir(), uid = process.getuid(), mode = "windows-native" } = {}) {
  // Local-context separation, not a new assertion of provider permission/caller.
  return createHash("sha256").update(JSON.stringify([version, uid, home, workspace, mode, C.contract, C.window, "child-source-v1"])).digest("hex");
}
function createChildSourceDiskStore({ directory, binding, io = fs } = {}) {
  if (typeof directory !== "string" || !path.isAbsolute(directory) || directory !== path.resolve(directory) || !hex(binding)) throw new ChildSourceFailure();
  const filename = path.join(directory, "child-source.json"), flags = fs.constants;
  const ownedTemps = new Map();
  let failure = null;
  const outsideRepo = dir => { const relative = path.relative(root, dir); return relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative); };
  const privateStat = (stat, dir = false) => stat.uid === process.getuid() && (stat.mode & 0o7777) === (dir ? 0o700 : 0o600) &&
    (dir ? stat.isDirectory() : stat.isFile() && stat.nlink === 1);
  const sameInode = (a, b) => a.dev === b.dev && a.ino === b.ino;
  const close = fd => { io.closeSync(fd); };
  function checkDirectory(create = false) {
    if (!outsideRepo(directory)) throw new ChildSourceFailure();
    let stat;
    try { stat = io.lstatSync(directory); }
    catch (error) {
      if (error.code !== "ENOENT") throw error;
      if (!create) return false;
      // Check the nearest existing ancestor before recursive creation so a
      // symlinked ancestor cannot cause writes before the final realpath check.
      let ancestor = path.dirname(directory);
      for (;;) {
        try { if (io.realpathSync(ancestor) !== ancestor) throw new ChildSourceFailure(); break; }
        catch (error) { if (error.code !== "ENOENT" || ancestor === path.dirname(ancestor)) throw error; ancestor = path.dirname(ancestor); }
      }
      io.mkdirSync(directory, { recursive: true, mode: 0o700 });
      stat = io.lstatSync(directory);
    }
    if (!privateStat(stat, true) || io.realpathSync(directory) !== directory) throw new ChildSourceFailure();
    return true;
  }
  function checkedStat(target, expected) {
    const stat = io.lstatSync(target);
    if (!privateStat(stat) || (expected && !sameInode(stat, expected))) throw new ChildSourceFailure();
    return stat;
  }
  function open(access, target, expected) {
    const fd = io.openSync(target, access | flags.O_NOFOLLOW | flags.O_NONBLOCK);
    try {
      const stat = io.fstatSync(fd);
      if (!privateStat(stat) || (expected && !sameInode(stat, expected))) throw new ChildSourceFailure();
      return fd;
    } catch (error) { close(fd); throw error; }
  }
  function temporaryFiles() {
    const dir = io.opendirSync(directory), result = [];
    try {
      let entry, count = 0;
      while ((entry = dir.readSync()) !== null) {
        if (++count > maxDirectoryEntries) throw new ChildSourceFailure();
        if (typeof entry.name === "string" && entry.name.length === 54 && tempPattern.test(entry.name)) result.push(path.join(directory, entry.name));
      }
      return result;
    } finally { dir.closeSync(); }
  }
  function requireNoTemps() {
    if (ownedTemps.size || temporaryFiles().length) throw new ChildSourceFailure();
  }
  function unlink(target, expected) {
    if (!checkDirectory()) { ownedTemps.delete(target); return; }
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
      fd = open(flags.O_WRONLY, target, stat);
      io.ftruncateSync(fd, 0); io.fsyncSync(fd);
    } catch { failed = true; }
    finally { if (fd !== undefined) { try { close(fd); } catch { failed = true; } } }
    // Independently unlink the same safe inode even if truncation/close fails.
    // Byte removal is not physical secure erasure, backups or cloud deletion.
    try { unlink(target, stat); } catch { failed = true; }
    if (failed) throw new ChildSourceFailure();
  }
  function envelope(value) {
    if (!exact(value, ["binding", "record"]) || value.binding !== binding) throw new ChildSourceFailure("child_source_invalid");
    return validate(value.record);
  }
  function attempt(fn) {
    if (failure) throw failure;
    try { return fn(); }
    catch (error) { failure = failureOf(error); throw failure; }
  }
  return {
    read() {
      return attempt(() => {
        let fd;
        try {
          if (!checkDirectory()) return null;
          requireNoTemps();
          let stat;
          try { stat = checkedStat(filename); } catch (error) { if (error.code === "ENOENT") return null; throw error; }
          fd = open(flags.O_RDONLY, filename, stat);
          if (io.fstatSync(fd).size > maxFileBytes) throw new ChildSourceFailure("child_source_invalid");
          const buffer = Buffer.alloc(maxFileBytes + 1); let bytes = 0, count;
          while (bytes < buffer.length && (count = io.readSync(fd, buffer, bytes, buffer.length - bytes, null))) bytes += count;
          if (bytes > maxFileBytes) throw new ChildSourceFailure("child_source_invalid");
          let value;
          try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, bytes))); }
          catch { throw new ChildSourceFailure("child_source_invalid"); }
          return envelope(value);
        } finally { if (fd !== undefined) close(fd); }
      });
    },
    write(record) {
      return attempt(() => {
        let temp, fd;
        try {
          const text = JSON.stringify({ binding, record: validate(record) });
          if (Buffer.byteLength(text) > maxFileBytes) throw new ChildSourceFailure("child_source_invalid");
          checkDirectory(true); requireNoTemps();
          let previous = null;
          try { previous = checkedStat(filename); } catch (error) { if (error.code !== "ENOENT") throw error; }
          temp = path.join(directory, `.child-source-${randomUUID()}.tmp`);
          fd = io.openSync(temp, flags.O_WRONLY | flags.O_CREAT | flags.O_EXCL | flags.O_NOFOLLOW, 0o600);
          ownedTemps.set(temp, null); // Only after successful exclusive creation.
          const stat = io.fstatSync(fd); ownedTemps.set(temp, stat);
          if (!privateStat(stat)) throw new ChildSourceFailure();
          io.writeFileSync(fd, text, "utf8"); io.fsyncSync(fd);
          const closing = fd; fd = undefined; close(closing);
          checkDirectory(); checkedStat(temp, stat);
          if (previous) checkedStat(filename, previous);
          else {
            try { io.lstatSync(filename); throw new ChildSourceFailure(); }
            catch (error) { if (error.code !== "ENOENT") throw error; }
          }
          io.renameSync(temp, filename); ownedTemps.delete(temp); temp = undefined;
        } finally {
          try { if (fd !== undefined) close(fd); }
          finally {
            if (temp && ownedTemps.has(temp)) {
              try { unlink(temp, ownedTemps.get(temp)); }
              catch { /* Ownership retained; explicit Clear must recover. */ }
            }
          }
        }
      });
    },
    clear() {
      try {
        if (!checkDirectory()) { ownedTemps.clear(); failure = null; return; }
        const targets = new Set([filename, ...ownedTemps.keys()]); let failed = false;
        try { for (const temp of temporaryFiles()) targets.add(temp); } catch { failed = true; }
        for (const target of targets) { try { erase(target); } catch { failed = true; } }
        if (checkDirectory() && temporaryFiles().length) failed = true;
        if (failed || ownedTemps.size) throw new ChildSourceFailure();
        failure = null;
      } catch { failure = new ChildSourceFailure("child_source_clear_failed"); throw failure; }
    }
  };
}
module.exports = { createChildSourceStore, createChildSourceDiskStore, sourceBinding, ChildSourceFailure };