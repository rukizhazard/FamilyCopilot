"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { activateNative } = require("../scripts/activate-windows-owner");
test("native activation preflights under lock before stopping and requires native task", async () => {
  const steps = []; let mode = "wsl";
  const result = await activateNative({ lock: async fn => { steps.push("lock"); return fn(); },
    preflight: async () => steps.push("preflight"), identity: () => "start", execution: () => mode, report: () => {},
    activate: async d => {
      assert.deepEqual(steps, ["lock", "preflight"]);
      assert.equal(d.identity(1), "start"); d.report({ stage: "await_existing_task_start" });
      assert.throws(() => d.identity(2), /blocked/);
      mode = "windows-native"; assert.equal(d.identity(2), "start"); return { cloudRequests: 0 };
    }
  });
  assert.equal(Object.hasOwn(result, "cloudRequests"), false);
  assert.equal(result.cloudMetadataVerified, true);
  assert.equal(result.cloudChanges, false);
  assert.equal(result.execution, "windows-native-v1");
});
test("native activation cannot stop a server when preflight fails", async () => {
  let activated = false;
  await assert.rejects(activateNative({ lock: fn => fn(), preflight: async () => { throw Error("blocked"); },
    activate: async () => { activated = true; } }));
  assert.equal(activated, false);
});

const childReady = () => ({ status: "child_ready", httpGetCalendarCandidate: true, nativeViewCandidate: false,
  sasDisabled: true, preservedResourcesUnchanged: true, calendarQueries: 0, cloudChanges: false, runtimeVerified: false,
  execution: "windows-child-v1", extensionsRemoved: true, automaticRetry: false });
test("child activation validates exact metadata under one lock before stop, then native opt-in and both local markers", async () => {
  const steps = []; let child, localReady = false, locked = false;
  const result = await activateNative({ enableChild: true,
    lock: async fn => { locked = true; steps.push("lock"); try { return await fn(); } finally { locked = false; } },
    preflight: async () => { assert.equal(locked, true); steps.push("parent"); },
    childPreflight: async () => { assert.equal(locked, true); steps.push("child"); return childReady(); },
    identity: () => "start", execution: () => "windows-native", childMode: () => child,
    inspect: async () => ({ childProtocol: localReady, childSavedProtocol: localReady }), report: () => {},
    activate: async d => {
      assert.deepEqual(steps, ["lock", "parent", "child"]);
      assert.equal(d.identity(1), "start"); assert.equal((await d.inspect()).childProtocol, false);
      d.report({ stage: "await_existing_task_start" });
      for (child of [undefined, "true", "synthetic", "kimi-calendar-v2"]) assert.throws(() => d.identity(2), /blocked/);
      child = "kimi-calendar-v1"; assert.equal(d.identity(2), "start");
      await assert.rejects(d.inspect(), /activation_unconfirmed/);
      localReady = true;
      const after = await d.inspect(); assert.equal(after.childProtocol, true); assert.equal(after.childSavedProtocol, true);
      assert.equal(locked, true); return { stage: "activated", cloudRequests: 0 };
    }
  });
  assert.equal(locked, false); assert.equal(result.childExecution, "windows-child-v1");
  assert.equal(result.childMetadataVerified, true); assert.equal(result.runtimeVerified, false);
  assert.equal(Object.hasOwn(result, "cloudRequests"), false);
});
test("failed or inexact child metadata blocks activation before any stop", async () => {
  const changes = [{ status: "candidate_ready" }, { execution: "windows-native-v1" }, { extensionsRemoved: false },
    { automaticRetry: true }, { sasDisabled: false }, { preservedResourcesUnchanged: false },
    { httpGetCalendarCandidate: false }, { calendarQueries: 1 }, { cloudChanges: true }, { runtimeVerified: true },
    { extra: "unexpected" }];
  for (const change of changes) {
    let activated = false;
    await assert.rejects(activateNative({ enableChild: true, lock: fn => fn(), preflight: async () => {},
      childPreflight: async () => ({ ...childReady(), ...change }), activate: async () => { activated = true; } }));
    assert.equal(activated, false);
  }
  await assert.rejects(activateNative({ enableChild: true, lock: fn => fn(), preflight: async () => {},
    childPreflight: async () => { throw Error("cleanup_failed"); }, activate: async () => assert.fail("must not stop") }), /cleanup_failed/);
});
test("parent-only activation never constructs or invokes child preflight; malformed enablement is inert", async () => {
  await activateNative({ lock: fn => fn(), preflight: async () => {},
    childPreflight: async () => assert.fail("no child metadata"), activate: async () => ({}) });
  for (const enableChild of ["true", "kimi-calendar-v1", null, 1]) {
    await assert.rejects(activateNative({ enableChild, lock: () => assert.fail("must not acquire lock") }), /blocked/);
  }
});
test("child activation retains actual activator idle, identity, graceful stop, task and asset guards", async () => {
  for (const scenario of ["ok", "busy", "cleanup_failed", "cache_invalid", "child_cache_invalid", "child_cache_unavailable",
    "child_cache_clear_failed", "identity_changed", "bad_child_mode", "missing_marker", "missing_cache_marker", "false_cache_marker", "assets_changed"]) {
    let ids = [101], stopped = false, identityCalls = 0; const calls = [];
    const unsafe = ["busy", "cleanup_failed", "cache_invalid", "child_cache_invalid", "child_cache_unavailable", "child_cache_clear_failed"];
    const status = { safeIdle: true, dateProtocol: true, savedViewProtocol: true, octoberProtocol: true };
    const promise = activateNative({ enableChild: true, lock: fn => fn(), preflight: async () => {},
      childPreflight: async () => childReady(),
      identity: () => scenario === "identity_changed" && ++identityCalls > 1 ? "changed" : "start",
      execution: () => "windows-native", childMode: () => stopped && scenario !== "bad_child_mode" ? "kimi-calendar-v1" : undefined,
      inspect: async () => ({ ...status, safeIdle: !unsafe.includes(scenario),
        childProtocol: scenario !== "missing_marker",
        ...(stopped && scenario !== "missing_cache_marker" ? { childSavedProtocol: scenario !== "false_cache_marker" } : {}) }), report: () => {},
      activation: { listeners: () => ids,
        stop: async pid => { assert.equal(pid, 101); calls.push("stop"); stopped = true; ids = []; },
        waitForTask: async () => { calls.push("task"); ids = [202]; },
        assets: async () => { calls.push("assets"); if (scenario === "assets_changed") throw Error("assets_unconfirmed"); }
      }
    });
    if (scenario === "ok") {
      const result = await promise; assert.equal(result.stage, "activated"); assert.equal(result.pid, 202);
      assert.equal(result.calendarQueries, 0); assert.equal(result.privateCacheAccess, false);
      assert.deepEqual(calls, ["stop", "task", "assets"]);
    } else {
      await assert.rejects(promise);
      if ([...unsafe, "identity_changed"].includes(scenario)) assert.deepEqual(calls, []);
      if (["missing_marker", "missing_cache_marker", "false_cache_marker"].includes(scenario)) assert.deepEqual(calls, ["stop", "task"]);
    }
  }
});
test("cooperative lock contention never reaches native metadata or stop", async () => {
  await assert.rejects(activateNative({ enableChild: true, lock: async () => { throw Error("owner_operation_busy"); },
    preflight: async () => assert.fail("no preflight"), activate: async () => assert.fail("no stop") }), /owner_operation_busy/);
});