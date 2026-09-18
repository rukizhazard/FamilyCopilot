"use strict";
// Small synchronous, bounded owner-only store. Never reads at construction/startup.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { createHash, randomUUID } = require("node:crypto");
const { isDeepStrictEqual } = require("node:util");
const { project, window, liveWindow, responseLimit } = require("../owner/availability-core");
const { buildAvailability, workflowId } = require("../infra/availability");
const contract = buildAvailability("11111111-1111-4111-8111-111111111111").tags.contract;
const version = 1;
const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const validContext = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
class CacheFailure extends Error {
  constructor(code = "cache_unavailable") { super(code); this.code = code; }
}
function defaultCacheDirectory(env = process.env, home = os.homedir()) {
  return path.join(env.XDG_CACHE_HOME && path.isAbsolute(env.XDG_CACHE_HOME) ? env.XDG_CACHE_HOME : path.join(home, ".cache"), "familycopilot");
}
function localBinding({ workspace = path.resolve(__dirname, ".."), home = os.homedir(), uid = process.getuid(), mode = "live", october = false } = {}) {
  // NOT a fresh cloud identity check. Same local owner/configuration assumption;
  // retain the original verified cloud fingerprint separately, without identities.
  return digest([version, uid, home, workspace, mode, workflowId, october ? "bounded-availability-v5" : contract, october ? liveWindow : window, [0, 1]]);
}
function createDiskStore({ directory, binding, io = fs, october = false, priorBinding } = {}) {
  if (!path.isAbsolute(directory || "") || !validContext(binding)) throw new CacheFailure();
  if (october && !validContext(priorBinding)) throw new CacheFailure();
  const selectedWindow = october ? liveWindow : window;
  const selectedContract = october ? "bounded-availability-v5" : contract;
  const filename = path.join(directory, "owner-availability.json");
  const flags = fs.constants;
  const privateStat = (stat, directory = false) => stat.uid === process.getuid() &&
    (stat.mode & 0o777) === (directory ? 0o700 : 0o600) &&
    (directory ? stat.isDirectory() : stat.isFile() && stat.nlink === 1);
  function closeFile(fd) {
    try { io.closeSync(fd); } catch { throw new CacheFailure(); }
  }
  function checkDirectory(create = false) {
    if (create) io.mkdirSync(directory, { recursive: true, mode: 0o700 });
    try {
      if (!privateStat(io.lstatSync(directory), true)) throw new CacheFailure();
      // Even a configured XDG directory must not resolve inside this repository.
      const relative = path.relative(path.resolve(__dirname, ".."), io.realpathSync(directory));
      if (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative)) throw new CacheFailure();
      return true;
    } catch (e) { if (e.code === "ENOENT" && !create) return false; throw e; }
  }
  function openFile(access) {
    const fd = io.openSync(filename, access | flags.O_NOFOLLOW | flags.O_NONBLOCK);
    try { if (!privateStat(io.fstatSync(fd))) throw new CacheFailure(); return fd; }
    catch (e) { closeFile(fd); throw e; }
  }
  function validate(value, expectedWindow = selectedWindow, expectedContract = selectedContract, expectedBinding = binding) {
    const data = project(value?.data, expectedWindow);
    if (!isDeepStrictEqual(Object.keys(value).sort(), ["binding", "context", "contract", "data", "version"]) ||
      value.version !== version || value.contract !== expectedContract || value.binding !== expectedBinding || !validContext(value.context) ||
      !isDeepStrictEqual(value.data, data) || data.people.some(p => p.status === "invalid") ||
      !data.people.some(p => ["checked", "partial"].includes(p.status))) throw new CacheFailure("cache_invalid");
    return { context: value.context, data };
  }
  return {
    window: selectedWindow,
    contract: selectedContract,
    preserveOnMiss: october,
    read(requestedWindow = selectedWindow) {
      if (!isDeepStrictEqual(requestedWindow, selectedWindow)) throw new CacheFailure("cache_invalid");
      let fd;
      try {
        if (!checkDirectory()) return null;
        try { fd = openFile(flags.O_RDONLY); } catch (e) { if (e.code === "ENOENT") return null; throw e; }
        if (io.fstatSync(fd).size > responseLimit) throw new CacheFailure("cache_invalid");
        // Bound the actual read too, even if a file grows after fstat.
        const buffer = Buffer.alloc(responseLimit + 1);
        let bytes = 0, count;
        while (bytes < buffer.length && (count = io.readSync(fd, buffer, bytes, buffer.length - bytes, null))) bytes += count;
        if (bytes > responseLimit) throw new CacheFailure("cache_invalid");
        try {
          const value = JSON.parse(buffer.subarray(0, bytes).toString("utf8"));
          if (october && value?.contract === contract) {
            // Recognize only the exact prior owner/window envelope. Keep its
            // original bytes; it is NOT an October hit or a corrupt-file error.
            validate(value, window, contract, priorBinding);
            return null;
          }
          return validate(value);
        }
        catch { throw new CacheFailure("cache_invalid"); }
      } catch (e) { throw e instanceof CacheFailure ? e : new CacheFailure(); }
      finally { if (fd !== undefined) closeFile(fd); }
    },
    write(context, input, requestedWindow = selectedWindow) {
      if (!isDeepStrictEqual(requestedWindow, selectedWindow)) throw new CacheFailure("cache_invalid");
      let temp, fd;
      try {
        const value = { version, binding, contract: selectedContract, context, data: project(input, selectedWindow) };
        validate(value);
        const text = JSON.stringify(value);
        if (Buffer.byteLength(text) > responseLimit) throw new CacheFailure("cache_invalid");
        checkDirectory(true);
        temp = path.join(directory, `.owner-availability-${randomUUID()}.tmp`);
        fd = io.openSync(temp, flags.O_WRONLY | flags.O_CREAT | flags.O_EXCL | flags.O_NOFOLLOW, 0o600);
        io.writeFileSync(fd, text, "utf8"); io.fsyncSync(fd); closeFile(fd); fd = undefined;
        io.renameSync(temp, filename); temp = undefined;
      } catch (e) { throw e instanceof CacheFailure ? e : new CacheFailure(); }
      finally {
        try { if (fd !== undefined) closeFile(fd); }
        finally { if (temp) { try { io.unlinkSync(temp); } catch { /* Fixed error already reported; never reuse a temp file. */ } } }
      }
    },
    clear() {
      let fd;
      try {
        if (!checkDirectory()) return;
        // Destroy validity before unlink: a failed unlink cannot restore this
        // snapshot on restart. Neither operation claims forensic secure erase.
        try {
          fd = openFile(flags.O_WRONLY);
          io.ftruncateSync(fd, 0); io.fsyncSync(fd);
        } catch (e) { if (e.code === "ENOENT") return; /* Still attempt unlink. */ }
        finally { if (fd !== undefined) { closeFile(fd); fd = undefined; } }
        try { io.unlinkSync(filename); } catch (e) { if (e.code !== "ENOENT") throw e; }
      } catch { throw new CacheFailure("cache_clear_failed"); }
    }
  };
}
module.exports = { createDiskStore, defaultCacheDirectory, localBinding, CacheFailure, contract, version };