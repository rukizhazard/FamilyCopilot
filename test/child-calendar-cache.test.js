"use strict";
// Offline only: every disk path is a disposable synthetic directory.
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { spawnSync } = require("node:child_process");
const C = require("../owner/child-calendar-core");
const { createChildCache, ChildCacheFailure } = require("../scripts/child-calendar-cache");
const { createChildDiskStore, childBinding, maxFileBytes } = require("../scripts/child-calendar-disk-cache");
const access = () => ({ person: "Kimi", guardian: true, disclosure: "details", sourceName: "Synthetic source" });
const data = () => ({ contract: C.contract, window: { ...C.window }, checkedAt: "2026-09-17T00:00:00Z", partial: false,
  events: [{ title: "Synthetic permitted title", start: "2026-10-09T10:00:00+08:00", end: "2026-10-09T11:00:00+08:00", allDay: false, status: "scheduled", kind: "singleInstance", redacted: false }] });
const response = () => ({ status: "saved", access: access(), data: data() });
const now = () => Date.parse("2026-09-18T00:00:00Z");
function fixture(t, io = fs) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "familycopilot-child-cache-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const directory = path.join(root, "child"), filename = path.join(directory, "child-calendar.json");
  const binding = childBinding({ mode: "synthetic-test" });
  const store = createChildDiskStore({ directory, binding, io, now });
  return { root, directory, filename, store, binding, cache: createChildCache({ storage: store, now }) };
}
test("saved shared validator accepts only projected data and minimal access with original timestamp", () => {
  assert.deepEqual(C.saved(response(), now()), response());
  assert.deepEqual(C.saved({ status: "cache_missing" }, now()), { status: "cache_missing" });
  for (const mutate of [v => { v.token = "secret"; }, v => { v.access.handle = "a".repeat(64); }, v => { v.access.guardian = false; },
    v => { v.access.person = "Other"; }, v => { v.access.disclosure = "private"; }, v => { v.access.sourceName = ""; },
    v => { v.data.events[0].sensitivity = "private"; }, v => { v.data.events[0].redacted = true; },
    v => { v.data.events[0].start = "invalid"; }, v => { v.data.window.end = "2026-10-16T16:00:00Z"; },
    v => { v.access.disclosure = "busy_only"; }]) {
    const v = response(); mutate(v); assert.throws(() => C.saved(v, now()), /invalid_child_response/);
  }
  assert.throws(() => C.saved({ status: "cache_missing", data: data() }), /invalid_child_response/);
});
test("summary keeps backward-compatible session default and truthful disk/RAM retention", () => {
  assert.match(C.summary("Source", "details"), /Page\/session memory only/);
  assert.match(C.summary("Source", "details", "disk"), /until Clear/);
  assert.doesNotMatch(C.summary("Source", "details", "disk"), /no child saved file/);
  assert.match(C.summary("Source", "details", "memory"), /restart/);
  assert.throws(() => C.summary("Source", "details", "cloud"), /invalid_child_response/);
});
test("lazy disk store and default RAM never access a real directory; no TTL and independent reload", t => {
  const f = fixture(t); assert.equal(fs.existsSync(f.directory), false);
  assert.equal(f.cache.retention, "disk"); assert.equal(createChildCache().retention, "memory");
  assert.equal(f.cache.get(), null); assert.equal(fs.existsSync(f.directory), false);
  assert.equal(f.cache.put(access(), data(), f.cache.generation), true);
  const next = createChildCache({ storage: f.store, now: () => now() + 365 * 86400000 });
  assert.deepEqual(next.get(), response());
  const ram = createChildCache({ now }); ram.put(access(), data(), ram.generation);
  assert.deepEqual(ram.get(), response()); assert.equal(createChildCache().get(), null);
});
test("private atomic child file contains no reusable authority, preserves timestamp and parent bytes", t => {
  let renames = 0;
  const f = fixture(t, { ...fs, renameSync(from, to) { assert.equal(fs.statSync(from).mode & 0o777, 0o600); renames++; fs.renameSync(from, to); } });
  const parent = path.join(f.root, "owner-availability.json"); fs.writeFileSync(parent, "SYNTHETIC PARENT SENTINEL");
  f.cache.put(access(), data(), 0);
  assert.equal(fs.statSync(f.directory).mode & 0o777, 0o700); assert.equal(fs.statSync(f.filename).mode & 0o777, 0o600);
  assert.ok(fs.statSync(f.filename).size < maxFileBytes);
  assert.doesNotMatch(fs.readFileSync(f.filename, "utf8"), /calendarId|sealed|handle|token|credential/);
  f.cache.prepare(); f.cache.put(access(), data(), f.cache.generation); assert.equal(renames, 2);
  assert.deepEqual(fs.readdirSync(f.directory), ["child-calendar.json"]);
  f.cache.clear(); assert.equal(fs.readFileSync(parent, "utf8"), "SYNTHETIC PARENT SENTINEL");
});
test("strict corrupted/wrong-binding/extra/private/oversized snapshots stay blocked until explicit Clear", t => {
  const f = fixture(t); f.cache.put(access(), data(), 0);
  const original = fs.readFileSync(f.filename, "utf8");
  const cases = ["{", "x".repeat(maxFileBytes + 1)];
  for (const mutate of [v => { v.binding = "b".repeat(64); }, v => { v.version++; }, v => { v.contract = "wrong"; },
    v => { v.access.sourceId = "private"; }, v => { v.data.events[0].title = "private"; v.data.events[0].redacted = true; },
    v => { v.data.events[0].end = "bad"; }]) { const v = JSON.parse(original); mutate(v); cases.push(JSON.stringify(v)); }
  for (const text of cases) {
    fs.writeFileSync(f.filename, text, { mode: 0o600 }); const c = createChildCache({ storage: f.store, now });
    assert.throws(() => c.get(), { code: "child_cache_invalid" });
    fs.writeFileSync(f.filename, original); assert.throws(() => c.get(), { code: "child_cache_invalid" });
    assert.throws(() => c.put(access(), data(), c.generation), { code: "child_cache_invalid" });
    c.clear(); assert.equal(c.get(), null);
  }
});
test("bindings separate OS owner, workspace, mode and bounded child contract", () => {
  const options = { home: "/tmp/synthetic-home", workspace: "/tmp/synthetic-workspace", uid: 123, mode: "synthetic" };
  for (const change of [{ home: "/tmp/other" }, { workspace: "/tmp/other" }, { uid: 124 }, { mode: "windows-native" }]) assert.notEqual(childBinding(options), childBinding({ ...options, ...change }));
});
test("unsafe file kinds/permissions, symlinks and hardlinks never load or get overwritten", t => {
  const f = fixture(t); f.cache.put(access(), data(), 0);
  fs.chmodSync(f.filename, 0o644); assert.throws(() => f.store.read(), /child_cache_unavailable/);
  assert.throws(() => f.store.write(access(), data()), /child_cache_unavailable/);
  fs.chmodSync(f.filename, 0o600); const linked = path.join(f.root, "linked"); fs.linkSync(f.filename, linked);
  assert.throws(() => f.store.read(), /child_cache_unavailable/); fs.unlinkSync(f.filename);
  fs.symlinkSync(linked, f.filename); assert.throws(() => f.store.read(), /child_cache_unavailable/);
  assert.throws(() => f.store.write(access(), data()), /child_cache_unavailable/);
  fs.unlinkSync(f.filename); fs.mkdirSync(f.filename, { mode: 0o600 }); assert.throws(() => f.store.read(), /child_cache_unavailable/);
  fs.chmodSync(f.directory, 0o755); assert.throws(() => f.store.read(), /child_cache_unavailable/);
});
test("bounded actual reads detect growth after stat", t => {
  const f = fixture(t, { ...fs, fstatSync(fd) { const s = fs.fstatSync(fd); s.size = 0; return s; } });
  f.cache.put(access(), data(), 0); fs.writeFileSync(f.filename, "x".repeat(maxFileBytes + 1));
  assert.throws(() => f.store.read(), /child_cache_invalid/);
});
test("prepare/fence preserves completed disk; Clear fences writers synchronously and survives fresh cache", t => {
  let inspect = false, cache, generation;
  const f = fixture(t, { ...fs, unlinkSync(...args) { if (inspect) assert.equal(cache.put(access(), data(), generation), false); return fs.unlinkSync(...args); } });
  cache = f.cache; cache.put(access(), data(), 0); generation = cache.generation;
  cache.prepare(); assert.equal(cache.put(access(), data(), generation), false); assert.deepEqual(cache.get(), response());
  generation = cache.generation; inspect = true; cache.clear();
  assert.equal(createChildCache({ storage: f.store }).get(), null);
});
test("fixed sticky deletion and write errors never log raw failure and explicit Clear is independent recovery", t => {
  let fail = false;
  const f = fixture(t, { ...fs, unlinkSync(...args) { if (fail) throw Error("PRIVATE token path"); return fs.unlinkSync(...args); } });
  f.cache.put(access(), data(), 0); fail = true;
  assert.throws(() => f.cache.clear(), { message: "child_cache_clear_failed" }); assert.equal(fs.statSync(f.filename).size, 0);
  assert.throws(() => f.cache.get(), /child_cache_clear_failed/);
  assert.throws(() => createChildCache({ storage: f.store }).get(), /child_cache_invalid/);
  fail = false; f.cache.clear(); assert.equal(f.cache.get(), null);
  const broken = createChildCache({ storage: { read() { return null; }, write() { throw Error("PRIVATE"); }, clear() {} } });
  assert.throws(() => broken.put(access(), data(), 0), { message: "child_cache_unavailable" });
  assert.throws(() => broken.get(), /child_cache_unavailable/); broken.clear(); assert.equal(broken.get(), null);
  assert.equal(new ChildCacheFailure("PRIVATE").message, "child_cache_unavailable");
});
test("separate fresh Node process reads only disposable saved projection, never native operations", t => {
  const f = fixture(t); f.cache.put(access(), data(), 0);
  const script = `const assert = require('node:assert/strict');
    const {createChildCache}=require('./scripts/child-calendar-cache');
    const {createChildDiskStore}=require('./scripts/child-calendar-disk-cache');
    const c=createChildCache({storage:createChildDiskStore({directory:process.argv[1],binding:process.argv[2]})});
    const value=c.get(); assert.equal(value.status,'saved'); assert.equal(value.data.checkedAt,'2026-09-17T00:00:00Z');
    assert.equal(value.access.person,'Kimi'); assert.equal(value.data.events.length,1);
    process.stdout.write('synthetic_restart_saved');`;
  const result = spawnSync(process.execPath, ["-e", script, f.directory, f.binding], { cwd: path.resolve(__dirname, ".."), encoding: "utf8", timeout: 10000 });
  assert.equal(result.status, 0); assert.equal(result.stdout, "synthetic_restart_saved");
});
test("oversize stat stops before content read, directory symlinks never resolve into a store", t => {
  let reads = 0;
  const f = fixture(t, { ...fs, readSync(...args) { reads++; return fs.readSync(...args); } });
  f.cache.put(access(), data(), 0); fs.truncateSync(f.filename, maxFileBytes + 1);
  assert.throws(() => f.store.read(), /child_cache_invalid/); assert.equal(reads, 0);
  const link = path.join(f.root, "linked-dir"); fs.symlinkSync(f.directory, link);
  const other = createChildDiskStore({ directory: link, binding: f.binding });
  assert.throws(() => other.read(), /child_cache_unavailable/); assert.throws(() => other.write(access(), data()), /child_cache_unavailable/);
});
test("atomic write failures preserve previous completed bytes, remove temporary files and block in-process reuse", t => {
  for (const operation of ["writeFileSync", "renameSync", "fsyncSync"]) {
    let fail = false;
    const f = fixture(t, { ...fs, [operation](...args) { if (fail) throw Error("PRIVATE diagnostic"); return fs[operation](...args); } });
    f.cache.put(access(), data(), 0); const original = fs.readFileSync(f.filename);
    f.cache.prepare(); fail = true;
    assert.throws(() => f.cache.put(access(), data(), f.cache.generation), /child_cache_unavailable/);
    assert.throws(() => f.cache.get(), /child_cache_unavailable/);
    assert.deepEqual(fs.readFileSync(f.filename), original); assert.deepEqual(fs.readdirSync(f.directory), ["child-calendar.json"]);
    fail = false; f.cache.clear(); assert.equal(f.cache.get(), null);
  }
});
test("failed rename and temp unlink remain blocked until Clear wipes every owned artifact", t => {
  let fail = false, temp;
  const f = fixture(t, { ...fs,
    renameSync(from, to) { if (fail) { temp = from; throw Error("PRIVATE rename failure"); } return fs.renameSync(from, to); },
    unlinkSync(target) { if (fail && target === temp) throw Error("PRIVATE unlink failure"); return fs.unlinkSync(target); }
  });
  f.cache.put(access(), data(), 0); const original = fs.readFileSync(f.filename);
  f.cache.prepare(); fail = true;
  assert.throws(() => f.cache.put(access(), data(), f.cache.generation), { message: "child_cache_unavailable" });
  assert.deepEqual(fs.readFileSync(f.filename), original);
  assert.ok(fs.statSync(temp).size > 0);
  const held = fs.openSync(temp, "r"); t.after(() => fs.closeSync(held));
  assert.throws(() => f.cache.clear(), { message: "child_cache_clear_failed" });
  assert.equal(fs.fstatSync(held).size, 0);
  assert.throws(() => f.cache.get(), /child_cache_clear_failed/);
  assert.throws(() => f.cache.put(access(), data(), f.cache.generation), /child_cache_clear_failed/);
  assert.throws(() => f.cache.clear(), /child_cache_clear_failed/);
  fail = false; f.cache.clear();
  assert.equal(fs.fstatSync(held).size, 0); assert.deepEqual(fs.readdirSync(f.directory), []);
  assert.equal(f.cache.get(), null);
});
test("restart detects abandoned exact-name temps before reading or replacing a canonical snapshot", t => {
  let fail = false, temp;
  const f = fixture(t, { ...fs,
    renameSync(from, to) { if (fail) { temp = from; throw Error("synthetic"); } return fs.renameSync(from, to); },
    unlinkSync(target) { if (fail && target === temp) throw Error("synthetic"); return fs.unlinkSync(target); }
  });
  f.cache.put(access(), data(), 0); f.cache.prepare(); fail = true;
  assert.throws(() => f.cache.put(access(), data(), f.cache.generation), /child_cache_unavailable/);
  const original = fs.readFileSync(f.filename), held = fs.openSync(temp, "r"); t.after(() => fs.closeSync(held));
  let reads = 0;
  const store = createChildDiskStore({ directory: f.directory, binding: f.binding, now,
    io: { ...fs, readSync(...args) { reads++; return fs.readSync(...args); } } });
  assert.throws(() => store.read(), /child_cache_unavailable/); assert.equal(reads, 0);
  assert.throws(() => store.write(access(), data()), /child_cache_unavailable/);
  assert.deepEqual(fs.readFileSync(f.filename), original);
  const restarted = createChildCache({ storage: store, now });
  assert.throws(() => restarted.get(), /child_cache_unavailable/);
  restarted.clear(); assert.equal(restarted.get(), null);
  assert.equal(fs.fstatSync(held).size, 0); assert.deepEqual(fs.readdirSync(f.directory), []);
});
const abandonedName = ".child-calendar-00000000-0000-4000-8000-000000000000.tmp";
test("temp-only failed wipe and unlink stay sticky across repeated Clear until recovered", t => {
  let fail = true;
  const f = fixture(t, { ...fs,
    ftruncateSync(...args) { if (fail) throw Error("PRIVATE truncate failure"); return fs.ftruncateSync(...args); },
    unlinkSync(...args) { if (fail) throw Error("PRIVATE unlink failure"); return fs.unlinkSync(...args); }
  });
  fs.mkdirSync(f.directory, { mode: 0o700 });
  const temp = path.join(f.directory, abandonedName); fs.writeFileSync(temp, "SYNTHETIC TITLE", { mode: 0o600 });
  const held = fs.openSync(temp, "r"); t.after(() => fs.closeSync(held));
  for (let i = 0; i < 2; i++) {
    assert.throws(() => f.cache.clear(), { message: "child_cache_clear_failed" });
    assert.ok(fs.fstatSync(held).size > 0);
    assert.throws(() => f.cache.get(), /child_cache_clear_failed/);
  }
  fail = false; f.cache.clear();
  assert.equal(fs.fstatSync(held).size, 0); assert.equal(fs.existsSync(temp), false); assert.equal(f.cache.get(), null);
});
test("Clear only adopts exact UUID-v4 filenames and never recurses or follows injected traversal names", t => {
  const touched = [];
  const f = fixture(t, { ...fs, lstatSync(target) { touched.push(target); return fs.lstatSync(target); } });
  fs.mkdirSync(f.directory, { mode: 0o700 });
  const names = ["owner-availability.json", ".child-calendar-other.tmp", `${abandonedName}.bak`, `${abandonedName}\n`,
    abandonedName.replace("-4000-", "-1000-"), abandonedName.toUpperCase()];
  for (const name of names) fs.writeFileSync(path.join(f.directory, name), "SYNTHETIC UNRELATED", { mode: 0o600 });
  const nested = path.join(f.directory, "nested"); fs.mkdirSync(nested, { mode: 0o700 });
  fs.writeFileSync(path.join(nested, abandonedName), "SYNTHETIC NESTED", { mode: 0o600 });
  const temp = path.join(f.directory, abandonedName); fs.writeFileSync(temp, "SYNTHETIC OWNED", { mode: 0o600 });
  f.cache.clear(); assert.equal(fs.existsSync(temp), false);
  for (const name of names) {
    assert.equal(fs.readFileSync(path.join(f.directory, name), "utf8"), "SYNTHETIC UNRELATED");
    assert.equal(touched.includes(path.join(f.directory, name)), false);
  }
  assert.equal(fs.readFileSync(path.join(nested, abandonedName), "utf8"), "SYNTHETIC NESTED");
  const outside = path.join(f.root, abandonedName); fs.writeFileSync(outside, "SYNTHETIC OUTSIDE", { mode: 0o600 });
  let scansClosed = 0;
  const store = createChildDiskStore({ directory: f.directory, binding: f.binding, now, io: { ...fs,
    opendirSync() {
      const entries = [`../${abandonedName}`, outside, `nested/${abandonedName}`, `..\\${abandonedName}`];
      return { readSync() { return entries.length ? { name: entries.shift() } : null; }, closeSync() { scansClosed++; } };
    },
    lstatSync(target) { assert.ok(target === f.directory || target === f.filename); return fs.lstatSync(target); }
  } });
  store.clear(); assert.equal(scansClosed, 2);
  assert.equal(fs.readFileSync(outside, "utf8"), "SYNTHETIC OUTSIDE");
});
test("unsafe abandoned entries fail closed without unlinking or modifying their targets", t => {
  for (const kind of ["permissions", "owner", "symlink", "hardlink", "directory"]) {
    let temp;
    const f = fixture(t, { ...fs, lstatSync(target) {
      const stat = fs.lstatSync(target); if (kind === "owner" && target === temp) stat.uid++;
      return stat;
    } });
    fs.mkdirSync(f.directory, { mode: 0o700 }); temp = path.join(f.directory, abandonedName);
    const sentinel = path.join(f.root, "sentinel"); fs.writeFileSync(sentinel, "SYNTHETIC UNRELATED", { mode: 0o600 });
    if (kind === "symlink") fs.symlinkSync(sentinel, temp);
    else if (kind === "hardlink") fs.linkSync(sentinel, temp);
    else if (kind === "directory") fs.mkdirSync(temp, { mode: 0o700 });
    else fs.writeFileSync(temp, "SYNTHETIC TEMP", { mode: kind === "permissions" ? 0o644 : 0o600 });
    assert.throws(() => f.cache.get(), /child_cache_unavailable/);
    assert.throws(() => f.store.write(access(), data()), /child_cache_unavailable/);
    assert.throws(() => f.cache.clear(), /child_cache_clear_failed/);
    assert.ok(fs.lstatSync(temp)); assert.equal(fs.readFileSync(sentinel, "utf8"), "SYNTHETIC UNRELATED");
    if (kind === "permissions" || kind === "owner") assert.equal(fs.readFileSync(temp, "utf8"), "SYNTHETIC TEMP");
    if (kind === "directory") fs.rmdirSync(temp); else fs.unlinkSync(temp);
    f.cache.clear(); assert.equal(f.cache.get(), null);
  }
});
test("directory safety applies to Clear before enumeration or traversal", t => {
  const f = fixture(t); f.cache.put(access(), data(), 0);
  const original = fs.readFileSync(f.filename), link = path.join(f.root, "link"); fs.symlinkSync(f.directory, link);
  const store = createChildDiskStore({ directory: link, binding: f.binding, io: { ...fs, opendirSync() { assert.fail("unsafe enumeration"); } } });
  assert.throws(() => store.clear(), /child_cache_clear_failed/);
  fs.chmodSync(f.directory, 0o755); assert.throws(() => f.cache.clear(), /child_cache_clear_failed/);
  assert.deepEqual(fs.readFileSync(f.filename), original);
  fs.chmodSync(f.directory, 0o700); f.cache.clear();
});
test("bounded directory scan closes handles and blocks instead of assuming no leftovers", t => {
  let scanned = 0, closed = 0;
  const f = fixture(t, { ...fs, opendirSync() {
    return { readSync() { scanned++; return { name: "unrelated" }; }, closeSync() { closed++; } };
  } });
  fs.mkdirSync(f.directory, { mode: 0o700 });
  assert.throws(() => f.cache.get(), /child_cache_unavailable/);
  assert.equal(scanned, 257); assert.equal(closed, 1);
  assert.throws(() => f.store.write(access(), data()), /child_cache_unavailable/);
  assert.throws(() => f.cache.clear(), /child_cache_clear_failed/);
  assert.equal(scanned, 4 * 257); assert.equal(closed, 4);
});
test("scan failures cannot skip remembered temporary cleanup or reset the block", t => {
  let failWrite = true, failScan = false, temp;
  const f = fixture(t, { ...fs,
    renameSync(from) { temp = from; throw Error("synthetic"); },
    unlinkSync(target) { if (failWrite) throw Error("synthetic"); return fs.unlinkSync(target); },
    opendirSync(...args) { if (failScan) throw Error("PRIVATE scan failure"); return fs.opendirSync(...args); }
  });
  assert.throws(() => f.cache.put(access(), data(), 0), /child_cache_unavailable/);
  const held = fs.openSync(temp, "r"); t.after(() => fs.closeSync(held));
  failWrite = false; failScan = true;
  assert.throws(() => f.cache.clear(), { message: "child_cache_clear_failed" });
  assert.equal(fs.fstatSync(held).size, 0); assert.equal(fs.existsSync(temp), false);
  assert.throws(() => f.cache.get(), /child_cache_clear_failed/);
  failScan = false; f.cache.clear(); assert.equal(f.cache.get(), null);
});
test("exclusive-create failure never unlinks a file this writer did not create", t => {
  let collision;
  const f = fixture(t, { ...fs, openSync(target, flags, mode) {
    if (flags & fs.constants.O_EXCL) {
      collision = target; fs.writeFileSync(target, "SYNTHETIC COLLISION", { mode: 0o600 });
      throw Object.assign(Error("synthetic"), { code: "EEXIST" });
    }
    return fs.openSync(target, flags, mode);
  }, unlinkSync() { assert.fail("unowned collision must not be removed"); } });
  assert.throws(() => f.cache.put(access(), data(), 0), /child_cache_unavailable/);
  assert.equal(fs.readFileSync(collision, "utf8"), "SYNTHETIC COLLISION");
});
test("Clear refuses inode substitution between metadata validation and open", t => {
  let temp, swapped = false;
  const f = fixture(t, { ...fs, openSync(target, flags, mode) {
    if (target === temp && !swapped) {
      swapped = true; fs.renameSync(temp, path.join(f.directory, "unrelated-backup"));
      fs.writeFileSync(temp, "SYNTHETIC REPLACEMENT", { mode: 0o600 });
    }
    return fs.openSync(target, flags, mode);
  } });
  fs.mkdirSync(f.directory, { mode: 0o700 }); temp = path.join(f.directory, abandonedName);
  fs.writeFileSync(temp, "SYNTHETIC ORIGINAL", { mode: 0o600 });
  assert.throws(() => f.cache.clear(), /child_cache_clear_failed/);
  assert.equal(fs.readFileSync(temp, "utf8"), "SYNTHETIC REPLACEMENT");
  assert.equal(fs.readFileSync(path.join(f.directory, "unrelated-backup"), "utf8"), "SYNTHETIC ORIGINAL");
});
test("remembered temp identity prevents cleanup of an unrelated replacement", t => {
  let temp;
  const f = fixture(t, { ...fs, renameSync(from) {
    temp = from; fs.renameSync(temp, path.join(f.directory, "unrelated-backup"));
    fs.writeFileSync(temp, "SYNTHETIC REPLACEMENT", { mode: 0o600 });
    throw Error("synthetic rename failure");
  } });
  assert.throws(() => f.cache.put(access(), data(), 0), /child_cache_unavailable/);
  assert.equal(fs.readFileSync(temp, "utf8"), "SYNTHETIC REPLACEMENT");
  assert.throws(() => f.cache.clear(), /child_cache_clear_failed/);
  assert.equal(fs.readFileSync(temp, "utf8"), "SYNTHETIC REPLACEMENT");
});
test("unsafe canonical file cannot prevent independent safe temporary byte removal", t => {
  const f = fixture(t); fs.mkdirSync(f.directory, { mode: 0o700 });
  const sentinel = path.join(f.root, "sentinel"); fs.writeFileSync(sentinel, "SYNTHETIC UNRELATED", { mode: 0o600 });
  fs.symlinkSync(sentinel, f.filename);
  const temp = path.join(f.directory, abandonedName); fs.writeFileSync(temp, "SYNTHETIC TEMP", { mode: 0o600 });
  const held = fs.openSync(temp, "r"); t.after(() => fs.closeSync(held));
  assert.throws(() => f.cache.clear(), /child_cache_clear_failed/);
  assert.equal(fs.fstatSync(held).size, 0); assert.equal(fs.existsSync(temp), false);
  assert.equal(fs.lstatSync(f.filename).isSymbolicLink(), true);
  assert.equal(fs.readFileSync(sentinel, "utf8"), "SYNTHETIC UNRELATED");
});
test("enumeration read and close errors remain fixed failures until explicit Clear succeeds", t => {
  for (const operation of ["readSync", "closeSync"]) {
    let fail = true, closed = 0;
    const f = fixture(t, { ...fs, opendirSync(...args) {
      const dir = fs.opendirSync(...args);
      return {
        readSync() { if (fail && operation === "readSync") throw Error("PRIVATE directory read"); return dir.readSync(); },
        closeSync() { dir.closeSync(); closed++; if (fail && operation === "closeSync") throw Error("PRIVATE directory close"); }
      };
    } });
    fs.mkdirSync(f.directory, { mode: 0o700 });
    assert.throws(() => f.cache.get(), { message: "child_cache_unavailable" }); assert.equal(closed, 1);
    assert.throws(() => f.cache.clear(), { message: "child_cache_clear_failed" });
    fail = false; assert.throws(() => f.cache.get(), /child_cache_clear_failed/);
    f.cache.clear(); assert.equal(f.cache.get(), null);
  }
});
test("fresh Node process fails closed on temp-only restart leftovers and explicitly clears them", t => {
  const f = fixture(t); fs.mkdirSync(f.directory, { mode: 0o700 });
  const temp = path.join(f.directory, abandonedName); fs.writeFileSync(temp, "SYNTHETIC TEMP", { mode: 0o600 });
  const held = fs.openSync(temp, "r"); t.after(() => fs.closeSync(held));
  const script = `const assert=require('node:assert/strict');
    const {createChildCache}=require('./scripts/child-calendar-cache');
    const {createChildDiskStore}=require('./scripts/child-calendar-disk-cache');
    const c=createChildCache({storage:createChildDiskStore({directory:process.argv[1],binding:process.argv[2]})});
    assert.throws(()=>c.get(),{code:'child_cache_unavailable'});
    c.clear(); assert.equal(c.get(),null); process.stdout.write('synthetic_restart_cleanup');`;
  const result = spawnSync(process.execPath, ["-e", script, f.directory, f.binding], { cwd: path.resolve(__dirname, ".."), encoding: "utf8", timeout: 10000 });
  assert.equal(result.status, 0); assert.equal(result.stdout, "synthetic_restart_cleanup"); assert.equal(result.stderr, "");
  assert.equal(fs.fstatSync(held).size, 0); assert.deepEqual(fs.readdirSync(f.directory), []);
});