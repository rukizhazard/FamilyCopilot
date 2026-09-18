"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { inspectLocalOwner } = require("../scripts/owner-local-status");
const csrf = "a".repeat(64);
const page = range => `<meta name="owner-csrf" content="${csrf}"><meta name="owner-mode" content="live"><meta name="owner-cache" content="disk">${range ? '<meta name="owner-range" content="configurable-v1">' : ''}`;
test("remembered-source failures never authorize restart and Sync requires current native markers", async () => {
  for (const failure of ["child_source_invalid", "child_source_unavailable", "child_source_clear_failed"]) {
    for (const status of [failure, "idle"]) {
      const data = { status, cleanup: "not_requested", synthetic: false, childSourceStatus: failure };
      const result = await inspectLocalOwner(async path => ({ status: 200, text: path === "/" ? page(true) : JSON.stringify(data) }));
      assert.equal(result.safeIdle, false);
    }
  }
  for (const marker of ["CHILD_SYNC", "unavailable", "child-sync-v1"]) {
    const markup = page(true) + `<meta name="child-mode" content="kimi-calendar-v1"><meta name="child-sync" content="${marker}">`;
    const result = await inspectLocalOwner(async path => ({ status: 200, text: path === "/" ? markup :
      JSON.stringify({ status: "idle", cleanup: "not_requested", synthetic: false, childExecution: "windows-child-v1" }) }));
    assert.equal(result.childSyncProtocol, marker === "child-sync-v1");
  }
});
test("metadata-only status uses a fresh exact-origin session, accepts old date markup and never calls data/clear endpoints", async () => {
  for (const range of [false, true]) {
    const calls = [];
    const result = await inspectLocalOwner(async (path, options) => {
      calls.push(path);
      if (path === "/") return { status: 200, text: page(range) };
      assert.equal(path, "/api/status"); assert.equal(options.body, "{}"); assert.equal(options.method, "POST");
      assert.equal(options.headers.Origin, "http://127.0.0.1:8002"); assert.equal(options.headers["X-Owner-CSRF"], csrf);
      return { status: 200, text: JSON.stringify({ status: "idle", cleanup: "not_requested", synthetic: false }) };
    });
    assert.deepEqual(calls, ["/", "/api/status"]); assert.equal(result.safeIdle, true); assert.equal(result.dateProtocol, range);
    assert.ok(!JSON.stringify(result).includes(csrf));
  }
});
test("busy, sticky cleanup/storage errors and inconsistent metadata cannot authorize restart", async () => {
  for (const data of [{ status: "busy", cleanup: "cleanup_pending", synthetic: false },
    { status: "cleanup_failed", cleanup: "cleanup_failed", synthetic: false },
    { status: "cache_clear_failed", cleanup: "workflow_disabled", synthetic: false },
    { status: "idle", cleanup: "workflow_disabled", cacheStatus: "cache_invalid", synthetic: false }]) {
    const result = await inspectLocalOwner(async path => ({ status: 200, text: path === "/" ? page(true) : JSON.stringify(data) }));
    assert.equal(result.safeIdle, false);
  }
  await assert.rejects(inspectLocalOwner(async () => ({ status: 403, text: "private" })));
  await assert.rejects(inspectLocalOwner(async path => ({ status: 200, text: path === "/" ? page(true) : JSON.stringify({ status: "idle", cleanup: "not_requested", synthetic: true }) })));
});
test("child cache failures are recognized but never safe idle, including idle with childCacheStatus", async () => {
  for (const failure of ["child_cache_invalid", "child_cache_unavailable", "child_cache_clear_failed"]) {
    for (const status of [failure, "idle"]) {
      const data = { status, cleanup: "workflow_disabled", synthetic: false,
        ...(status === "idle" ? { childCacheStatus: failure } : {}) };
      const result = await inspectLocalOwner(async path => ({ status: 200, text: path === "/" ? page(true) : JSON.stringify(data) }));
      assert.equal(result.status, status); assert.equal(result.safeIdle, false);
    }
  }
  await assert.rejects(inspectLocalOwner(async path => ({ status: 200, text: path === "/" ? page(true) :
    JSON.stringify({ status: "child_cache_unknown", cleanup: "workflow_disabled", synthetic: false }) })), /unavailable/);
});
test("child saved protocol requires exact disk and matching child markers; status never reads saved endpoints or files", async t => {
  const fs = require("node:fs");
  for (const method of ["readFileSync", "readFile"]) t.mock.method(fs, method, () => assert.fail("no file reads"));
  t.mock.method(fs.promises, "readFile", () => assert.fail("no file reads"));
  for (const markup of [undefined, "unavailable", "synthetic", "kimi-calendar-v1"]) {
    for (const execution of [undefined, "windows-native-v1", "windows-child-v1"]) {
      for (const cache of [undefined, "__CHILD_CACHE__", "memory", "child-saved-v1-memory", "child-saved-v1-disk"]) {
        const calls = [];
        const result = await inspectLocalOwner(async path => {
          calls.push(path);
          assert.ok(["/", "/api/status"].includes(path), "no saved/data/clear endpoints");
          return { status: 200, text: path === "/" ? page(true) + (markup ? `<meta name="child-mode" content="${markup}">` : "") +
            (cache ? `<meta name="child-cache" content="${cache}">` : "") :
            JSON.stringify({ status: "idle", cleanup: "not_requested", synthetic: false, childExecution: execution }) };
        });
        assert.equal(result.childProtocol, markup === "kimi-calendar-v1" && execution === "windows-child-v1");
        assert.equal(result.childSavedProtocol, result.childProtocol && cache === "child-saved-v1-disk");
        assert.deepEqual(calls, ["/", "/api/status"]); assert.equal(result.safeIdle, true);
      }
    }
  }
});