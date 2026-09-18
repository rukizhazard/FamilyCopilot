"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { spawnSync } = require("node:child_process");
const { createDiskStore, localBinding, defaultCacheDirectory } = require("../scripts/availability-disk-cache");
const { createSnapshotCache } = require("../scripts/availability-cache");
const A = require("../owner/availability-core");
const context = "a".repeat(64), binding = localBinding({ mode: "synthetic-test" });
const snapshot = () => ({ window: A.window, checkedAt: "2026-09-15T01:00:00Z",
  people: [0, 1].map(person => ({ person, status: "checked", slots: Array(336).fill("busy") })) });
function fixture(t, io = fs) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "familycopilot-cache-test-"));
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const directory = path.join(parent, "private"), filename = path.join(directory, "owner-availability.json");
  const store = createDiskStore({ directory, binding, io });
  return { directory, filename, store, cache: createSnapshotCache({ storage: store }) };
}
const ioError = () => { throw Object.assign(new Error("PRIVATE token/path/provider detail"), { code: "EACCES" }); };

test("live and synthetic disk bindings reject each other's snapshots without deleting the file", t => {
  const f = fixture(t);
  for (const [writer, reader] of [["synthetic", "live"], ["live", "synthetic"]]) {
    const source = createDiskStore({ directory: f.directory, binding: localBinding({ mode: writer }) });
    source.write(context, snapshot());
    const other = createSnapshotCache({ storage: createDiskStore({ directory: f.directory, binding: localBinding({ mode: reader }) }) });
    assert.throws(() => other.get(null), { code: "cache_invalid" });
    assert.throws(() => other.get(null), { code: "cache_invalid" });
    assert.equal(fs.existsSync(f.filename), true);
    assert.deepEqual(source.read().data, snapshot());
  }
});

test("disk store is lazy; memory/default imports never access the home cache; XDG fallback is absolute", t => {
  const f = fixture(t);
  assert.equal(fs.existsSync(f.directory), false);
  assert.equal(f.cache.get(null), null); assert.equal(fs.existsSync(f.directory), false);
  createSnapshotCache().put("memory-only", snapshot(), 0);
  assert.equal(fs.existsSync(f.directory), false);
  assert.equal(defaultCacheDirectory({ XDG_CACHE_HOME: "/tmp/example" }, "/tmp/home"), "/tmp/example/familycopilot");
  assert.equal(defaultCacheDirectory({ XDG_CACHE_HOME: "relative" }, "/tmp/home"), "/tmp/home/.cache/familycopilot");
  assert.notEqual(localBinding({ mode: "live" }), binding);
  assert.notEqual(localBinding({ uid: process.getuid() + 1 }), localBinding());
  assert.notEqual(localBinding({ workspace: "/tmp/other" }), localBinding());
});

test("private bounded file projects extras out, atomically replaces, and preserves checkedAt in a fresh process", t => {
  let renames = 0;
  const f = fixture(t, { ...fs, renameSync(from, to) {
    assert.equal(fs.statSync(from).mode & 0o777, 0o600);
    assert.doesNotThrow(() => JSON.parse(fs.readFileSync(from, "utf8")));
    renames++; fs.renameSync(from, to);
  } });
  const d = snapshot(); d.subject = "PRIVATE"; d.token = "SECRET"; d.people[0].address = "PRIVATE";
  assert.equal(f.cache.put(context, d, 0), true);
  assert.equal(fs.statSync(f.directory).mode & 0o777, 0o700);
  assert.equal(fs.statSync(f.filename).mode & 0o777, 0o600);
  assert.ok(fs.statSync(f.filename).size <= A.responseLimit);
  const text = fs.readFileSync(f.filename, "utf8");
  assert.doesNotMatch(text, /PRIVATE|SECRET|subject|token|address|scheduleId|calendarId|Dad|Mom/);
  const next = snapshot(); next.checkedAt = "2026-09-15T01:01:00Z"; next.people[0].slots[0] = "tentative";
  f.cache.put(context, next, 0); assert.equal(renames, 2);
  assert.deepEqual(fs.readdirSync(f.directory), ["owner-availability.json"]);
  const child = spawnSync(process.execPath, ["-e", `
    const assert = require('node:assert/strict');
    const {createDiskStore} = require('./scripts/availability-disk-cache');
    const {createSnapshotCache} = require('./scripts/availability-cache');
    const A = require('./owner/availability-core');
    const c = createSnapshotCache({storage:createDiskStore({directory:process.argv[1],binding:process.argv[2]})});
    const hit = c.get(null);
    assert.equal(hit.checkedAt,'2026-09-15T01:01:00Z');
    assert.equal(hit.people[0].slots[0],'tentative');
    assert.match(A.freshness(hit,Date.parse(hit.checkedAt)+31*60000),/Stale/);
    process.stdout.write('restart_hit_no_provider');
  `, f.directory, binding], { cwd: path.resolve(__dirname, ".."), encoding: "utf8" });
  assert.equal(child.status, 0); assert.equal(child.stdout, "restart_hit_no_provider");
});

test("strict disk contract rejects corrupt, oversized, wrong binding/window/version/index and extra private fields", t => {
  const f = fixture(t); f.cache.put(context, snapshot(), 0);
  const valid = JSON.parse(fs.readFileSync(f.filename, "utf8"));
  const cases = ["{", "x".repeat(A.responseLimit + 1)];
  for (const mutate of [v => { v.version++; }, v => { v.contract = "wrong"; }, v => { v.binding = "b".repeat(64); },
    v => { v.context = "alias"; }, v => { v.data.window.start = "2026-09-14T16:00:00Z"; },
    v => { v.data.people[0].person = 2; }, v => { v.data.people[1].person = 0; },
    v => { v.data.people[0].slots[0] = "PRIVATE"; }, v => { v.data.people[0].address = "PRIVATE"; },
    v => { v.data.checkedAt = "bad"; }, v => { v.data.subject = "PRIVATE"; }, v => { v.token = "PRIVATE"; },
    v => { v.data.people = [A.unknown(0, "unavailable"), A.unknown(1, "unavailable")]; }]) {
    const changed = structuredClone(valid); mutate(changed); cases.push(JSON.stringify(changed));
  }
  for (const text of cases) {
    fs.writeFileSync(f.filename, text);
    const c = createSnapshotCache({ storage: f.store });
    assert.throws(() => c.get(null), { code: "cache_invalid" });
    assert.throws(() => c.get(null), { code: "cache_invalid" });
  }
  f.store.clear(); assert.equal(fs.existsSync(f.filename), false);
});

test("oversize is rejected before reading; symlinks, unsafe permissions and nonregular files never loaded", t => {
  let reads = 0;
  const f = fixture(t, { ...fs, readSync(...args) { reads++; return fs.readSync(...args); } });
  f.cache.put(context, snapshot(), 0); fs.truncateSync(f.filename, A.responseLimit + 1);
  assert.throws(() => f.store.read(), { code: "cache_invalid" }); assert.equal(reads, 0);
  fs.chmodSync(f.filename, 0o644); assert.throws(() => f.store.read(), { code: "cache_unavailable" });
  fs.unlinkSync(f.filename); fs.symlinkSync(path.join(f.directory, "absent"), f.filename);
  assert.throws(() => f.store.read(), { code: "cache_unavailable" });
  fs.unlinkSync(f.filename); fs.mkdirSync(f.filename, { mode: 0o600 });
  assert.throws(() => f.store.read(), { code: "cache_unavailable" });
  fs.chmodSync(f.directory, 0o755); assert.throws(() => f.store.read(), { code: "cache_unavailable" });
});

test("bounded reads reject growth after stat; partial or missing context never turns free", t => {
  const f = fixture(t, { ...fs, fstatSync(fd) { const s = fs.fstatSync(fd); s.size = 0; return s; } });
  const d = snapshot(); d.people[1] = A.unknown(1, "unavailable");
  f.cache.put(context, d, 0);
  assert.ok(f.store.read().data.people[1].slots.every(s => s === "unknown"));
  fs.writeFileSync(f.filename, "x".repeat(A.responseLimit + 1));
  assert.throws(() => f.store.read(), { code: "cache_invalid" });
});

test("clear invalidates RAM and generation before I/O, fences late writes, restart misses", t => {
  let c, inspect = false, fence;
  const f = fixture(t, { ...fs, unlinkSync(...args) {
    if (inspect) { assert.ok(c.generation > fence); assert.equal(c.put(context, snapshot(), fence), false); }
    fs.unlinkSync(...args);
  } });
  c = f.cache; fence = c.generation; c.put(context, snapshot(), fence); inspect = true;
  c.clear(); assert.equal(c.get(null), null); assert.equal(fs.existsSync(f.filename), false);
  assert.equal(createSnapshotCache({ storage: f.store }).get(null), null);
});

test("unlink failure is visible and sticky, file invalidated before deletion failure, explicit Clear can recover", t => {
  let fail = true;
  const f = fixture(t, { ...fs, unlinkSync(...args) { if (fail) ioError(); return fs.unlinkSync(...args); } });
  f.cache.put(context, snapshot(), 0);
  assert.throws(() => f.cache.clear(), { code: "cache_clear_failed" });
  assert.throws(() => f.cache.get(null), { code: "cache_clear_failed" });
  assert.equal(fs.statSync(f.filename).size, 0);
  assert.throws(() => createSnapshotCache({ storage: f.store }).get(null), { code: "cache_invalid" });
  fail = false; f.cache.clear(); assert.equal(f.cache.get(null), null);
});

test("read/write/rename errors expose only safe cache code, never fallback; failed atomic replacement keeps no temp", t => {
  for (const operation of ["readSync", "writeFileSync", "renameSync", "closeSync"]) {
    let fail = false;
    const f = fixture(t, { ...fs, [operation](...args) {
      if (fail) { if (operation === "closeSync") fs.closeSync(...args); ioError(); }
      return fs[operation](...args);
    } });
    f.cache.put(context, snapshot(), 0); fail = true;
    if (["readSync", "closeSync"].includes(operation)) {
      const c = createSnapshotCache({ storage: f.store });
      assert.throws(() => c.get(null), { message: "cache_unavailable" });
    } else {
      f.cache.clear(); // Same pre-refresh invalidation as server.
      assert.throws(() => f.cache.put(context, snapshot(), f.cache.generation), { message: "cache_unavailable" });
      assert.throws(() => f.cache.get(null), { code: "cache_unavailable" });
      assert.deepEqual(fs.readdirSync(f.directory), []);
      assert.equal(createSnapshotCache({ storage: f.store }).get(null), null);
    }
  }
});