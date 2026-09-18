"use strict";
// Offline only. All filesystem fixtures live under disposable os.tmpdir roots;
// no service, browser, provider, environment, private cache or native worker.
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { createHash } = require("node:crypto");
const C = require("../owner/child-calendar-core");
const { createChildSourceStore, createChildSourceDiskStore, sourceBinding, ChildSourceFailure } = require("../scripts/child-source-store");
const reference = "a".repeat(64), maxBytes = 16 * 1024;
const abandoned = ".child-source-00000000-0000-4000-8000-000000000000.tmp";
const access = () => ({ person: "Kimi", guardian: true, disclosure: "details", sourceName: "Synthetic reviewed source" });
const record = () => ({ version: 1, reference, access: access(), window: { ...C.window } });
const invalid = fn => assert.throws(fn, { code: "child_source_invalid", message: "child_source_invalid" });
const unavailable = fn => assert.throws(fn, { code: "child_source_unavailable", message: "child_source_unavailable" });
const clearFailed = fn => assert.throws(fn, { code: "child_source_clear_failed", message: "child_source_clear_failed" });
function fixture(t, io = fs) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "familycopilot-child-source-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const directory = path.join(root, "source"), filename = path.join(directory, "child-source.json");
  const binding = sourceBinding({ workspace: path.join(root, "synthetic-workspace"), home: root, uid: process.getuid(), mode: "synthetic-test" });
  const disk = createChildSourceDiskStore({ directory, binding, io });
  const store = createChildSourceStore({ storage: disk });
  const reload = (injected = fs) => createChildSourceDiskStore({ directory, binding, io: injected });
  return { root, directory, filename, binding, disk, store, reload };
}
function seed(f, content = JSON.stringify({ binding: f.binding, record: record() }), name = "child-source.json") {
  fs.mkdirSync(f.directory, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(f.directory, name), content, { mode: 0o600 });
}
test("exported API is exact; construction/status/fence are inert and no clock is consulted", () => {
  assert.deepEqual(Object.keys(require("../scripts/child-source-store")).sort(),
    ["ChildSourceFailure", "createChildSourceDiskStore", "createChildSourceStore", "sourceBinding"].sort());
  const noIO = new Proxy({}, { get() { assert.fail("construction must not inspect I/O"); } });
  const disk = createChildSourceDiskStore({ directory: "/synthetic-not-accessed/source", binding: reference, io: noIO });
  const store = createChildSourceStore({ storage: disk, now() { assert.fail("no consentAt/TTL"); } });
  assert.equal(store.retention, "disk"); assert.equal(store.generation, 0); assert.equal(store.failure, null);
  store.fence(); assert.equal(store.generation, 1);
  const ram = createChildSourceStore({ now() { assert.fail("no clock calls"); } });
  assert.equal(ram.retention, "memory"); assert.equal(ram.get(), null);
  assert.equal(ram.put(reference, access()), true); assert.deepEqual(ram.get(), record());
  assert.equal(createChildSourceStore().get(), null);
});
test("RAM validates before retaining and returns independent exact deep copies", () => {
  const store = createChildSourceStore(), input = access();
  assert.equal(store.put(reference, input), true); input.disclosure = "busy_only";
  const first = store.get(); first.reference = "b".repeat(64); first.access.sourceName = "Changed"; first.window.end = "changed";
  assert.deepEqual(store.get(), record()); assert.notEqual(store.get(), store.get());
  assert.notEqual(store.get().window, C.window);
  assert.equal(store.put(reference, { ...access(), disclosure: "busy_only" }), true);
  assert.equal(store.get().access.disclosure, "busy_only");
});
test("strict access rejects extras, hidden/symbol keys, accessors and inherited objects without getters", () => {
  const cases = [null, [], { ...access(), guardian: false }, { ...access(), person: "Other" }, { ...access(), disclosure: "private" },
    { ...access(), sourceName: " " }, { ...access(), sourceName: "x".repeat(1025) }, { ...access(), sourceName: "bad\nname" }];
  for (const key of ["id", "providerId", "sealed", "key", "session", "token", "reviewToken", "handle", "consentAt"]) cases.push({ ...access(), [key]: "SYNTHETIC FORBIDDEN" });
  cases.push(Object.assign(Object.create({ hidden: true }), access()));
  cases.push(Object.defineProperty(access(), "hidden", { value: "SYNTHETIC" }));
  cases.push({ ...access(), [Symbol("extra")]: "SYNTHETIC" });
  cases.push(Object.defineProperty(access(), "sourceName", { enumerable: true, get() { assert.fail("must not evaluate getter"); } }));
  for (const value of cases) {
    const store = createChildSourceStore(); invalid(() => store.put(reference, value)); invalid(() => store.get());
    store.clear({ recover: true }); assert.equal(store.get(), null);
  }
});
test("reference accepts only exactly 64 lowercase hex, never raw IDs, seals or coerced strings", () => {
  for (const value of [null, undefined, 123, {}, new String(reference), "a".repeat(63), "a".repeat(65), "A".repeat(64), "g".repeat(64),
    `${reference}\n`, "provider-id", "FCCH1-synthetic-seal"]) {
    const store = createChildSourceStore(); invalid(() => store.put(value, access()));
  }
});
test("strict generation fencing is synchronous, type-sensitive and preserves completed RAM", () => {
  const store = createChildSourceStore(); store.put(reference, access());
  store.fence(); assert.equal(store.generation, 1); assert.deepEqual(store.get(), record());
  for (const old of [0, "1", null, NaN, {}, -1]) assert.equal(store.put(null, null, old), false);
  assert.equal(store.failure, null); assert.equal(store.put(reference, access(), 1), true);
  store.clear(); assert.equal(store.generation, 2); assert.equal(store.get(), null);
  assert.equal(store.put(reference, access(), 1), false);
});
test("Clear fences before I/O and blocks even reentrant current-generation writes/reads", () => {
  let store, inspect = false, clears = 0, writes = 0;
  const storage = { read() { assert.fail("no read during clear"); }, write() { writes++; }, clear() {
    clears++;
    if (inspect) {
      assert.equal(store.generation, 1); assert.equal(store.put(reference, access(), 0), false);
      assert.equal(store.put(reference, access()), false); assert.equal(store.get(), null);
    }
  } };
  store = createChildSourceStore({ storage }); store.put(reference, access()); inspect = true; store.clear();
  assert.equal(clears, 1); assert.equal(writes, 1);
});
test("storage aliasing and reentrant read/write fences cannot retain or resurrect authority", () => {
  let value = record(), store, writes = 0, clears = 0;
  const storage = { read() { return value; }, write(v) { writes++; v.access.disclosure = "busy_only"; }, clear() { value = null; clears++; } };
  store = createChildSourceStore({ storage }); assert.deepEqual(store.get(), record());
  value.access.disclosure = "busy_only"; assert.deepEqual(store.get(), record());
  store.put(reference, access()); assert.equal(writes, 1); assert.deepEqual(store.get(), record());
  const reading = createChildSourceStore({ storage: { read() { reading.fence(); return record(); }, clear() {} } });
  assert.equal(reading.get(), null);
  storage.write = v => { value = v; store.fence(); };
  assert.equal(store.put(reference, access()), false); assert.equal(clears, 1); assert.equal(store.get(), null);
});
test("get/put failures are fixed and sticky; only successful explicit recovery clears the block", () => {
  for (const action of ["read", "write"]) {
    let broken = true, calls = 0;
    const storage = { read() { calls++; if (broken && action === "read") throw Error("SYNTHETIC PRIVATE diagnostic"); return null; },
      write() { calls++; if (broken && action === "write") throw Error("SYNTHETIC PRIVATE diagnostic"); }, clear() {} };
    const store = createChildSourceStore({ storage });
    unavailable(() => action === "read" ? store.get() : store.put(reference, access()));
    const count = calls, failure = store.failure; broken = false;
    unavailable(() => store.get()); unavailable(() => store.put(reference, access())); assert.equal(calls, count);
    store.fence(); store.clear(); assert.equal(store.failure, failure); unavailable(() => store.get());
    store.clear({ recover: "true" }); unavailable(() => store.get());
    store.clear({ recover: true }); assert.equal(store.failure, null); assert.equal(store.get(), null);
    assert.equal(store.put(reference, access()), true);
  }
  assert.equal(new ChildSourceFailure("SYNTHETIC PRIVATE").message, "child_source_unavailable");
  for (const code of ["child_source_invalid", "child_source_unavailable", "child_source_clear_failed"]) assert.equal(new ChildSourceFailure(code).code, code);
});
test("failed recovery remains sticky, advances generation and does not leak storage error text", () => {
  let fail = true;
  const store = createChildSourceStore({ storage: { read() { return null; }, write() {}, clear() { if (fail) throw Error("SYNTHETIC PRIVATE"); } } });
  store.put(reference, access()); clearFailed(() => store.clear({ recover: true }));
  assert.equal(store.generation, 1); clearFailed(() => store.get()); clearFailed(() => store.put(reference, access()));
  fail = false; store.clear(); clearFailed(() => store.get());
  store.clear({ recover: true }); assert.equal(store.get(), null); assert.equal(store.generation, 3);
});
test("async storage seams cannot report synchronous persistence or recovery", () => {
  const thenable = { then() {} };
  for (const method of ["read", "write", "clear"]) {
    const storage = { read() { return null; }, write() {}, clear() {}, [method]() { return thenable; } };
    const store = createChildSourceStore({ storage });
    if (method === "clear") clearFailed(() => store.clear({ recover: true }));
    else unavailable(() => method === "read" ? store.get() : store.put(reference, access()));
    assert.ok(store.failure);
  }
});
test("binding is deterministic and separates every approved local-context component", () => {
  const options = { workspace: "/synthetic/workspace", home: "/synthetic/home", uid: 123, mode: "synthetic" };
  const expected = createHash("sha256").update(JSON.stringify([1, 123, options.home, options.workspace, options.mode, C.contract, C.window, "child-source-v1"])).digest("hex");
  assert.equal(sourceBinding(options), expected); assert.match(expected, /^[a-f0-9]{64}$/);
  for (const change of [{ uid: 124 }, { home: "/synthetic/other" }, { workspace: "/synthetic/other" }, { mode: "windows-native" }])
    assert.notEqual(sourceBinding({ ...options, ...change }), expected);
});
test("lazy disk miss never creates a directory; atomic private envelope reloads independently", t => {
  const f = fixture(t); assert.equal(fs.existsSync(f.directory), false);
  assert.equal(f.store.get(), null); assert.equal(fs.existsSync(f.directory), false);
  f.store.put(reference, access());
  assert.equal(fs.statSync(f.directory).mode & 0o7777, 0o700); assert.equal(fs.statSync(f.filename).mode & 0o7777, 0o600);
  assert.equal(fs.statSync(f.filename).nlink, 1); assert.ok(fs.statSync(f.filename).size < maxBytes);
  const envelope = JSON.parse(fs.readFileSync(f.filename, "utf8"));
  assert.deepEqual(envelope, { binding: f.binding, record: record() });
  assert.deepEqual(fs.readdirSync(f.directory), ["child-source.json"]);
  const restarted = createChildSourceStore({ storage: f.reload(), now() { assert.fail("no expiry"); } });
  assert.deepEqual(restarted.get(), record());
  const copy = f.disk.read(); copy.access.sourceName = "Changed"; assert.deepEqual(f.disk.read(), record());
  f.store.fence(); assert.deepEqual(fs.readFileSync(f.filename, "utf8"), JSON.stringify(envelope));
  f.store.clear(); assert.equal(createChildSourceStore({ storage: f.reload() }).get(), null);
});
test("separate canonical/temporary namespace never changes parent or child event files", t => {
  const f = fixture(t); f.store.put(reference, access());
  const names = ["owner-availability.json", "child-calendar.json", ".child-calendar-00000000-0000-4000-8000-000000000000.tmp"];
  for (const name of names) seed(f, "SYNTHETIC UNRELATED", name);
  f.store.clear();
  for (const name of names) assert.equal(fs.readFileSync(path.join(f.directory, name), "utf8"), "SYNTHETIC UNRELATED");
});
test("strict disk record/envelope rejects extra, missing or wrong fields with no silent projection", t => {
  const mutations = [v => { v.extra = true; }, v => { v.binding = "b".repeat(64); }, v => { v.record.version = 2; },
    v => { delete v.record.reference; }, v => { v.record.reference += "\n"; }, v => { v.record.window.end = "2026-10-16T16:00:00Z"; },
    v => { v.record.window.extra = true; }, v => { v.record.access.guardian = false; }, v => { v.record.access.sourceName = ""; }];
  for (const key of ["providerId", "sealed", "key", "session", "reviewToken", "handle", "consentAt", "events"])
    mutations.push(v => { v.record[key] = "SYNTHETIC FORBIDDEN"; }, v => { v.record.access[key] = "SYNTHETIC FORBIDDEN"; });
  for (const mutate of mutations) {
    const f = fixture(t), value = { binding: f.binding, record: record() }; mutate(value); seed(f, JSON.stringify(value));
    invalid(() => f.store.get()); seed(f); invalid(() => f.store.get()); invalid(() => f.store.put(reference, access()));
    f.store.clear(); invalid(() => f.store.get()); f.store.clear({ recover: true }); assert.equal(f.store.get(), null);
  }
});
test("malformed UTF-8/JSON and oversized stat fail before parsing with fixed sticky codes", t => {
  for (const bytes of [Buffer.from([0xff]), Buffer.from("{"), Buffer.from("null"), Buffer.alloc(maxBytes + 1, 32)]) {
    let reads = 0;
    const f = fixture(t, { ...fs, readSync(...args) { reads++; return fs.readSync(...args); } }); seed(f, bytes);
    invalid(() => f.disk.read()); if (bytes.length > maxBytes) assert.equal(reads, 0);
    seed(f); invalid(() => f.disk.read()); invalid(() => f.disk.write(record()));
    f.disk.clear(); assert.equal(f.disk.read(), null);
  }
});
test("actual bounded read catches file growth despite size metadata and closes descriptors", t => {
  let total = 0, closed = 0;
  const f = fixture(t, { ...fs, fstatSync(fd) { const stat = fs.fstatSync(fd); stat.size = 0; return stat; },
    readSync(...args) { const count = fs.readSync(...args); total += count; return count; }, closeSync(fd) { closed++; fs.closeSync(fd); } });
  seed(f, Buffer.alloc(maxBytes * 2, 32)); invalid(() => f.disk.read()); assert.equal(total, maxBytes + 1); assert.equal(closed, 1);
});
test("exact 16KiB envelope is accepted and short reads are accumulated", t => {
  const f = fixture(t, { ...fs, readSync(fd, buffer, offset, length, position) { return fs.readSync(fd, buffer, offset, Math.min(length, 7), position); } });
  const text = JSON.stringify({ binding: f.binding, record: record() }); seed(f, text.padEnd(maxBytes, " "));
  assert.deepEqual(f.disk.read(), record());
});
test("invalid direct writes are rejected before any I/O and remain sticky until Clear", () => {
  let calls = 0;
  const io = { lstatSync() { calls++; throw Object.assign(Error(), { code: "ENOENT" }); } };
  const disk = createChildSourceDiskStore({ directory: "/synthetic-not-accessed/source", binding: reference, io });
  invalid(() => disk.write({ ...record(), consentAt: "not allowed" })); assert.equal(calls, 0);
  invalid(() => disk.write(record())); invalid(() => disk.read()); assert.equal(calls, 0);
  disk.clear(); assert.equal(calls, 1); assert.equal(disk.read(), null);
});
test("invalid paths/bindings and repository destinations never perform filesystem I/O", () => {
  const io = new Proxy({}, { get() { assert.fail("forbidden filesystem operation"); } });
  for (const directory of [undefined, "relative", "/synthetic/../source", "/synthetic/source/", 42])
    unavailable(() => createChildSourceDiskStore({ directory, binding: reference, io }));
  for (const binding of [undefined, "bad", `${reference}\n`, "A".repeat(64)])
    unavailable(() => createChildSourceDiskStore({ directory: "/synthetic/source", binding, io }));
  const disk = createChildSourceDiskStore({ directory: path.resolve(__dirname, "..", "synthetic-forbidden"), binding: reference, io });
  unavailable(() => disk.read()); unavailable(() => disk.write(record())); clearFailed(() => disk.clear());
});
test("unsafe file modes, owners, symlinks, hardlinks and directories cannot read/write/clear", t => {
  for (const kind of ["mode", "special-mode", "owner", "symlink", "hardlink", "directory"]) {
    let filename;
    const io = { ...fs, lstatSync(target) { const stat = fs.lstatSync(target); if (target === filename && kind === "owner") stat.uid++; return stat; } };
    const f = fixture(t, io);
    filename = f.filename; seed(f);
    const sentinel = path.join(f.root, "sentinel"); fs.writeFileSync(sentinel, "SYNTHETIC UNRELATED", { mode: 0o600 });
    if (kind === "mode") fs.chmodSync(filename, 0o644);
    if (kind === "special-mode") fs.chmodSync(filename, 0o4600);
    if (kind === "symlink" || kind === "hardlink" || kind === "directory") {
      fs.unlinkSync(filename);
      if (kind === "symlink") fs.symlinkSync(sentinel, filename);
      if (kind === "hardlink") fs.linkSync(sentinel, filename);
      if (kind === "directory") fs.mkdirSync(filename, { mode: 0o700 });
    }
    unavailable(() => f.store.get()); unavailable(() => f.reload(io).write(record())); clearFailed(() => f.store.clear({ recover: true }));
    assert.equal(fs.readFileSync(sentinel, "utf8"), "SYNTHETIC UNRELATED"); assert.ok(fs.lstatSync(filename));
  }
});
test("unsafe directory modes/owners and symlinked ancestors fail before file access or creation", t => {
  for (const kind of ["mode", "owner", "symlink", "ancestor"]) {
    const f = fixture(t); seed(f); const original = fs.readFileSync(f.filename);
    let directory = f.directory;
    if (kind === "mode") fs.chmodSync(directory, 0o755);
    if (kind === "symlink" || kind === "ancestor") {
      const link = path.join(f.root, "link"); fs.symlinkSync(f.directory, link);
      directory = kind === "ancestor" ? path.join(link, "must-not-create") : link;
    }
    const disk = createChildSourceDiskStore({ directory, binding: f.binding, io: { ...fs,
      lstatSync(target) { const stat = fs.lstatSync(target); if (kind === "owner" && target === directory) stat.uid++; return stat; },
      openSync() { assert.fail("no file access"); }, opendirSync() { assert.fail("no unsafe enumeration"); }
    } });
    unavailable(() => disk.write(record()));
    if (kind !== "ancestor") clearFailed(() => disk.clear());
    assert.equal(fs.existsSync(path.join(f.directory, "must-not-create")), false);
    assert.deepEqual(fs.readFileSync(f.filename), original);
  }
});
for (const operation of ["writeFileSync", "fsyncSync", "renameSync", "closeSync"]) test(`failed ${operation} preserves canonical bytes, removes owned temp and blocks reuse`, t => {
  let fail = false;
  const f = fixture(t, { ...fs, [operation](...args) {
    if (fail) { if (operation === "closeSync") fs.closeSync(...args); throw Error("SYNTHETIC PRIVATE failure"); }
    return fs[operation](...args);
  } });
  f.store.put(reference, access()); const original = fs.readFileSync(f.filename); fail = true;
  unavailable(() => f.store.put("b".repeat(64), access())); unavailable(() => f.store.get());
  assert.deepEqual(fs.readFileSync(f.filename), original); assert.deepEqual(fs.readdirSync(f.directory), ["child-source.json"]);
  fail = false; f.store.clear({ recover: true }); assert.equal(f.store.get(), null);
});
test("exclusive UUIDv4 temp creation uses safe flags and never unlinks EEXIST collision", t => {
  let collision;
  const f = fixture(t, { ...fs, openSync(target, flags, mode) {
    assert.ok(flags & fs.constants.O_EXCL); assert.ok(flags & fs.constants.O_NOFOLLOW); assert.ok(flags & fs.constants.O_CREAT);
    assert.equal(mode, 0o600); assert.match(path.basename(target), /^\.child-source-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.tmp$/);
    collision = target; fs.writeFileSync(target, "SYNTHETIC COLLISION", { mode: 0o600 });
    throw Object.assign(Error(), { code: "EEXIST" });
  }, unlinkSync() { assert.fail("never unlink unowned exclusive-create collision"); } });
  unavailable(() => f.store.put(reference, access())); assert.equal(fs.readFileSync(collision, "utf8"), "SYNTHETIC COLLISION");
});
test("failed rename/temp unlink survives restart and Clear independently wipes all exact artifacts", t => {
  let fail = false, temp;
  const f = fixture(t, { ...fs,
    renameSync(from, to) { if (fail) { temp = from; throw Error("SYNTHETIC"); } return fs.renameSync(from, to); },
    unlinkSync(target) { if (fail && target === temp) throw Error("SYNTHETIC"); return fs.unlinkSync(target); }
  });
  f.store.put(reference, access()); const original = fs.readFileSync(f.filename); fail = true;
  unavailable(() => f.store.put("b".repeat(64), access())); assert.deepEqual(fs.readFileSync(f.filename), original);
  const held = fs.openSync(temp, "r"); t.after(() => fs.closeSync(held)); assert.ok(fs.fstatSync(held).size > 0);
  let reads = 0;
  const restarted = createChildSourceStore({ storage: f.reload({ ...fs, readSync(...args) { reads++; return fs.readSync(...args); } }) });
  unavailable(() => restarted.get()); assert.equal(reads, 0); unavailable(() => f.reload().write(record()));
  clearFailed(() => f.store.clear({ recover: true })); assert.equal(fs.fstatSync(held).size, 0);
  clearFailed(() => f.store.get()); fail = false; f.store.clear({ recover: true });
  assert.deepEqual(fs.readdirSync(f.directory), []); assert.equal(f.store.get(), null);
  unavailable(() => restarted.get()); restarted.clear({ recover: true }); assert.equal(restarted.get(), null);
});
test("temp-only restart cleanup truncates independently and a failed wipe stays sticky even after unlink", t => {
  let fail = true;
  const f = fixture(t, { ...fs, ftruncateSync(...args) { if (fail) throw Error("SYNTHETIC"); return fs.ftruncateSync(...args); } });
  seed(f, "SYNTHETIC TEMP", abandoned); const temp = path.join(f.directory, abandoned);
  clearFailed(() => f.store.clear({ recover: true })); assert.equal(fs.existsSync(temp), false);
  clearFailed(() => f.store.get()); fail = false; f.store.clear(); clearFailed(() => f.store.get());
  f.store.clear({ recover: true }); assert.equal(f.store.get(), null);
  seed(f, "SYNTHETIC RESTART TEMP", abandoned);
  const held = fs.openSync(temp, "r"); t.after(() => fs.closeSync(held));
  const restarted = createChildSourceStore({ storage: f.reload() }); unavailable(() => restarted.get());
  restarted.clear({ recover: true }); assert.equal(fs.fstatSync(held).size, 0); assert.equal(restarted.get(), null);
});
test("Clear matches only exact lowercase UUIDv4 temp names, ignores traversal and never recurses", t => {
  const f = fixture(t);
  const names = ["unrelated", ".child-source-other.tmp", `${abandoned}.bak`, `${abandoned}\n`, abandoned.toUpperCase(), abandoned.replace("-4000-", "-1000-")];
  for (const name of names) seed(f, "SYNTHETIC UNRELATED", name);
  const nested = path.join(f.directory, "nested"); fs.mkdirSync(nested, { mode: 0o700 });
  fs.writeFileSync(path.join(nested, abandoned), "SYNTHETIC NESTED", { mode: 0o600 }); seed(f, "SYNTHETIC TEMP", abandoned);
  f.store.clear(); assert.equal(fs.existsSync(path.join(f.directory, abandoned)), false);
  for (const name of names) assert.equal(fs.readFileSync(path.join(f.directory, name), "utf8"), "SYNTHETIC UNRELATED");
  assert.equal(fs.readFileSync(path.join(nested, abandoned), "utf8"), "SYNTHETIC NESTED");
  const disk = f.reload({ ...fs, opendirSync() {
    const entries = [`../${abandoned}`, `nested/${abandoned}`, `..\\${abandoned}`, path.join(f.root, abandoned)];
    return { readSync() { return entries.length ? { name: entries.shift() } : null; }, closeSync() {} };
  }, lstatSync(target) { assert.ok(target === f.directory || target === f.filename); return fs.lstatSync(target); } });
  disk.clear();
});
test("unsafe orphan entries remain untouched while independent safe temp/canonical deletion proceeds", t => {
  for (const kind of ["symlink", "hardlink", "mode", "owner", "directory"]) {
    let temp;
    const f = fixture(t, { ...fs, lstatSync(target) { const stat = fs.lstatSync(target); if (target === temp && kind === "owner") stat.uid++; return stat; } });
    seed(f); temp = path.join(f.directory, abandoned);
    const sentinel = path.join(f.root, "sentinel"); fs.writeFileSync(sentinel, "SYNTHETIC UNRELATED", { mode: 0o600 });
    if (kind === "symlink") fs.symlinkSync(sentinel, temp);
    else if (kind === "hardlink") fs.linkSync(sentinel, temp);
    else if (kind === "directory") fs.mkdirSync(temp, { mode: 0o700 });
    else fs.writeFileSync(temp, "SYNTHETIC TEMP", { mode: kind === "mode" ? 0o644 : 0o600 });
    unavailable(() => f.store.get()); clearFailed(() => f.store.clear({ recover: true }));
    assert.equal(fs.existsSync(f.filename), false); assert.ok(fs.lstatSync(temp)); assert.equal(fs.readFileSync(sentinel, "utf8"), "SYNTHETIC UNRELATED");
  }
  const f = fixture(t); seed(f, "SYNTHETIC TEMP", abandoned);
  const sentinel = path.join(f.root, "sentinel"); fs.writeFileSync(sentinel, "SYNTHETIC", { mode: 0o600 }); fs.symlinkSync(sentinel, f.filename);
  clearFailed(() => f.store.clear({ recover: true })); assert.equal(fs.existsSync(path.join(f.directory, abandoned)), false);
  assert.equal(fs.readFileSync(sentinel, "utf8"), "SYNTHETIC");
});
test("directory enumeration is capped at 256 entries and handles close on overflow", t => {
  let scanned = 0, closed = 0;
  const f = fixture(t, { ...fs, opendirSync() {
    return { readSync() { scanned++; return { name: "unrelated" }; }, closeSync() { closed++; } };
  } }); seed(f);
  unavailable(() => f.store.get()); assert.equal(scanned, 257); assert.equal(closed, 1);
  clearFailed(() => f.store.clear({ recover: true })); assert.equal(scanned, 3 * 257); assert.equal(closed, 3);
  assert.equal(fs.existsSync(f.filename), false);
});
test("directory read/close errors stay fixed and sticky until explicit successful cleanup", t => {
  for (const method of ["readSync", "closeSync"]) {
    let fail = true, closed = 0;
    const f = fixture(t, { ...fs, opendirSync(...args) {
      const dir = fs.opendirSync(...args);
      return { readSync() { if (fail && method === "readSync") throw Error("SYNTHETIC PRIVATE"); return dir.readSync(); },
        closeSync() { dir.closeSync(); closed++; if (fail && method === "closeSync") throw Error("SYNTHETIC PRIVATE"); } };
    } }); seed(f);
    unavailable(() => f.store.get()); assert.equal(closed, 1); clearFailed(() => f.store.clear({ recover: true }));
    fail = false; clearFailed(() => f.store.get()); f.store.clear({ recover: true }); assert.equal(f.store.get(), null);
  }
});
test("failed directory scan cannot skip remembered temporary cleanup", t => {
  let failUnlink = true, failScan = false, temp;
  const f = fixture(t, { ...fs, renameSync(from) { temp = from; throw Error("SYNTHETIC"); },
    unlinkSync(target) { if (failUnlink) throw Error("SYNTHETIC"); return fs.unlinkSync(target); },
    opendirSync(...args) { if (failScan) throw Error("SYNTHETIC"); return fs.opendirSync(...args); }
  });
  unavailable(() => f.store.put(reference, access())); const held = fs.openSync(temp, "r"); t.after(() => fs.closeSync(held));
  failUnlink = false; failScan = true; clearFailed(() => f.store.clear({ recover: true }));
  assert.equal(fs.fstatSync(held).size, 0); assert.equal(fs.existsSync(temp), false);
  failScan = false; f.store.clear({ recover: true }); assert.equal(f.store.get(), null);
});
test("Clear rejects inode substitution between validation/open without wiping replacement", t => {
  let swapped = false, temp;
  const f = fixture(t, { ...fs, openSync(target, flags, mode) {
    if (target === temp && !swapped) {
      swapped = true; fs.renameSync(temp, path.join(f.directory, "unrelated-backup"));
      fs.writeFileSync(temp, "SYNTHETIC REPLACEMENT", { mode: 0o600 });
    }
    return fs.openSync(target, flags, mode);
  } });
  seed(f, "SYNTHETIC ORIGINAL", abandoned); temp = path.join(f.directory, abandoned);
  clearFailed(() => f.store.clear({ recover: true }));
  assert.equal(fs.readFileSync(temp, "utf8"), "SYNTHETIC REPLACEMENT");
  assert.equal(fs.readFileSync(path.join(f.directory, "unrelated-backup"), "utf8"), "SYNTHETIC ORIGINAL");
});
test("remembered temp inode prevents adopting or unlinking an unrelated replacement", t => {
  let temp;
  const f = fixture(t, { ...fs, renameSync(from) {
    temp = from; fs.renameSync(from, path.join(f.directory, "unrelated-backup"));
    fs.writeFileSync(from, "SYNTHETIC REPLACEMENT", { mode: 0o600 }); throw Error("SYNTHETIC");
  } });
  unavailable(() => f.store.put(reference, access())); clearFailed(() => f.store.clear({ recover: true }));
  assert.equal(fs.readFileSync(temp, "utf8"), "SYNTHETIC REPLACEMENT");
});
test("read descriptor metadata/open failures and close errors are sticky and do not leak details", t => {
  for (const operation of ["openSync", "fstatSync", "readSync", "closeSync"]) {
    const f = fixture(t, { ...fs, [operation](...args) {
      if (operation === "closeSync") fs.closeSync(...args);
      throw Error("SYNTHETIC PRIVATE path");
    } }); seed(f);
    unavailable(() => f.store.get()); unavailable(() => f.store.get());
  }
});
test("writer checks canonical/temp inode again before atomic rename", t => {
  let swap = false, filename, directory;
  const f = fixture(t, { ...fs, fsyncSync(fd) {
    fs.fsyncSync(fd);
    if (swap) {
      swap = false; fs.renameSync(filename, path.join(directory, "unrelated-backup"));
      fs.writeFileSync(filename, "SYNTHETIC REPLACEMENT", { mode: 0o600 });
    }
  } }); filename = f.filename; directory = f.directory;
  f.store.put(reference, access()); swap = true; unavailable(() => f.store.put("b".repeat(64), access()));
  assert.equal(fs.readFileSync(filename, "utf8"), "SYNTHETIC REPLACEMENT");
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory, "unrelated-backup"), "utf8")).record, record());
  assert.ok(!fs.readdirSync(directory).some(name => name.startsWith(".child-source-")));
});