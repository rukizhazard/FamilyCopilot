"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { activate } = require("../scripts/activate-activities");
function harness(overrides = {}) {
  let pid = 101, locked = false;
  const calls = [];
  const safe = { safeIdle: true, dateProtocol: true, savedViewProtocol: true, octoberProtocol: true };
  const dependencies = {
    lock: async action => { locked = true; try { return await action(); } finally { locked = false; } },
    listeners: () => pid ? [pid] : [], identity: () => "start",
    inspect: async () => { assert.equal(locked, true); calls.push("status"); return safe; },
    stop: async id => { assert.equal(locked, true); assert.equal(id, 101); calls.push("stop"); pid = 0; },
    waitForTask: async () => { assert.equal(locked, true); calls.push("task"); pid = 202; },
    assets: async () => { assert.equal(locked, true); calls.push("assets"); }, report: () => {}, ...overrides
  };
  return { dependencies, calls, safe };
}
test("approved activation holds exclusion through status, graceful stop, existing task and static verification", async () => {
  const h = harness(); const result = await activate(h.dependencies);
  assert.deepEqual(h.calls, ["status", "stop", "task", "status", "assets"]);
  assert.equal(result.pid, 202); assert.equal(result.teamContract, "tpbl-teams-v2");
  assert.equal(result.calendarQueries, 0); assert.equal(result.cloudRequests, 0); assert.equal(result.privateCacheAccess, false);
});
test("missing, ambiguous, foreign and changed process identities cannot be stopped", async () => {
  for (const listeners of [() => [], () => [1, 2]]) {
    const h = harness({ listeners }); await assert.rejects(activate(h.dependencies)); assert.ok(!h.calls.includes("stop"));
  }
  for (const identity of [() => { throw Error("foreign"); }, (() => { let n = 0; return () => String(n++); })()]) {
    const h = harness({ identity }); await assert.rejects(activate(h.dependencies)); assert.ok(!h.calls.includes("stop"));
  }
});
test("busy, cleanup failure or missing calendar preservation protocols block restart", async () => {
  for (const field of ["safeIdle", "dateProtocol", "savedViewProtocol", "octoberProtocol"]) {
    const h = harness(); h.safe[field] = false;
    await assert.rejects(activate(h.dependencies)); assert.deepEqual(h.calls, ["status"]);
  }
});
test("unconfirmed graceful stop does not start or force kill anything", async () => {
  const h = harness({ stop: async () => {} });
  await assert.rejects(activate(h.dependencies)); assert.deepEqual(h.calls, ["status"]);
});
test("task failure and wrong static assets never report activation success", async () => {
  for (const override of [{ waitForTask: async () => { throw Error("timeout"); } }, { assets: async () => { throw Error("mismatch"); } }]) {
    const h = harness(override); await assert.rejects(activate(h.dependencies)); assert.equal(h.calls.filter(call => call === "stop").length, 1);
  }
});
test("already stopped recovery requires fresh connection refusal and never stops another process", async () => {
  let running = false;
  const h = harness({ listeners: () => running ? [202] : [],
    inspect: async () => { if (!running) throw Object.assign(Error("refused"), { code: "ECONNREFUSED" }); return h.safe; },
    waitForTask: async () => { running = true; } });
  const result = await activate(h.dependencies);
  assert.equal(result.pid, 202); assert.ok(!h.calls.includes("stop"));
  const refused = harness({ listeners: () => [], inspect: async () => { throw Object.assign(Error("timeout"), { code: "ETIMEDOUT" }); } });
  await assert.rejects(activate(refused.dependencies)); assert.ok(!refused.calls.includes("task"));
});