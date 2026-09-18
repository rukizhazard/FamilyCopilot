"use strict";
const { randomBytes } = require("node:crypto");
const C = require("../owner/child-calendar-core");
const { OwnerFailure } = require("./owner-calendar");
const opaque = () => randomBytes(32).toString("hex");
const validId = value => typeof value === "string" && /^[A-Za-z0-9_+/=-]{1,4096}$/.test(value);
function createChildSession({ expires, now = Date.now, sourceValidator = validId, retention = "session" } = {}) {
  if (typeof sourceValidator !== "function" || !["session", "disk", "memory"].includes(retention)) throw new OwnerFailure("blocked");
  let generation = 0, sources = new Map(), review = null, reviewedScope = null, pending = null, closed = false;
  const clear = () => { generation++; sources.clear(); review = null; reviewedScope = null; pending?.abort(); };
  const expiryTimer = setTimeout(clear, Math.max(1, expires - now())); expiryTimer.unref?.();
  const alive = () => { if (closed || !Number.isFinite(expires) || now() >= expires) { clear(); throw new OwnerFailure("expired"); } };
  const invalidateReview = () => { generation++; review = null; pending?.abort(); };
  const invalidateScope = () => { reviewedScope = null; invalidateReview(); };
  async function run(operation, commit, signal) {
    alive();
    if (pending) throw new OwnerFailure("busy");
    const version = generation, controller = new AbortController(); pending = controller;
    const timer = setTimeout(() => { clear(); }, Math.max(1, expires - now())); timer.unref?.();
    try {
      const combined = AbortSignal.any([controller.signal, AbortSignal.timeout(240000), ...(signal ? [signal] : [])]);
      const data = await operation(combined);
      alive();
      if (combined.aborted || version !== generation) throw new OwnerFailure("cancelled");
      return commit(data);
    } catch (error) { sources.clear(); review = null; throw error; }
    finally { clearTimeout(timer); pending = null; }
  }
  return {
    get generation() { return generation; },
    close() { closed = true; clearTimeout(expiryTimer); clear(); },
    clear, invalidateReview, invalidateScope,
    async find(provider, signal) {
      clear();
      return run(provider, data => {
        if (!C.exact(data, ["calendars", "partial"]) || typeof data.partial !== "boolean" || !Array.isArray(data.calendars) || data.calendars.length > 100 || Buffer.byteLength(JSON.stringify(data)) > C.maxBytes) throw new OwnerFailure("invalid_provider_response");
        const ids = new Set(), calendars = [];
        for (const c of data.calendars) {
          if (!C.exact(c, ["id", "name"]) || sourceValidator(c.id) !== true || ids.has(c.id) || typeof c.name !== "string" || c.name.length > 1024) throw new OwnerFailure("invalid_provider_response");
          ids.add(c.id);
          const handle = opaque(), name = c.name.replace(/\S+@\S+/g, "[address hidden]").replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, "").trim() || "Unnamed calendar";
          sources.set(handle, { id: c.id, name }); calendars.push({ handle, name });
        }
        return { calendars, partial: data.partial };
      }, signal);
    },
    review(body, onScopeChanged) {
      alive(); invalidateReview();
      if (!C.exact(body, ["handle", "person", "guardian", "disclosure", "startDate", "endDate"]) || !C.handle(body.handle) || !sources.has(body.handle) || body.person !== "Kimi" || body.guardian !== true || !["busy_only", "details"].includes(body.disclosure) || !C.datesAllowed(body.startDate, body.endDate)) throw new OwnerFailure("blocked");
      // A newly selected source is not identified by its display name. Different
      // sessions must review a fresh handle and invalidate the older saved scope.
      if (!reviewedScope || reviewedScope.handle !== body.handle || reviewedScope.disclosure !== body.disclosure) onScopeChanged?.();
      reviewedScope = { handle: body.handle, disclosure: body.disclosure };
      review = { token: opaque(), handle: body.handle, disclosure: body.disclosure };
      return { token: review.token, summary: C.summary(sources.get(body.handle).name, body.disclosure, retention) };
    },
    // Trusted server-only sync seam; the same expiry/abort/generation commit
    // boundary applies without restoring browser handles or review tokens.
    async sync(provider, signal, onValidated) {
      if (typeof onValidated !== "function") throw new OwnerFailure("blocked");
      return run(provider, onValidated, signal);
    },
    async import(body, provider, signal, onValidated, { enroll = false, enrollmentValidator } = {}) {
      alive();
      if (typeof enroll !== "boolean" || onValidated !== undefined && typeof onValidated !== "function" ||
        enroll && (typeof enrollmentValidator !== "function" || typeof onValidated !== "function")) throw new OwnerFailure("blocked");
      if (!C.exact(body, ["token", "confirmed"]) || !review || body.token !== review.token || body.confirmed !== true) throw new OwnerFailure("blocked");
      const { handle, disclosure } = review, source = sources.get(handle); review = null;
      if (!source) throw new OwnerFailure("blocked");
      const access = C.savedAccess({ person: "Kimi", guardian: true, disclosure, sourceName: source.name });
      return run(s => provider({ calendarId: source.id, disclosure, signal: s }), data => {
        let projected, reference;
        try {
          if (enroll) {
            const validated = enrollmentValidator(data, disclosure, now());
            if (!C.exact(validated, ["reference", "data"]) || !C.handle(validated.reference) || validated.reference.length !== 64) throw Error();
            reference = validated.reference; data = validated.data;
          }
          projected = C.project(data, disclosure, now());
        } catch { throw new OwnerFailure("invalid_provider_response"); }
        onValidated?.(access, projected, reference); // Trusted synchronous commit, after session/abort/expiry fences.
        return projected;
      }, signal);
    }
  };
}
module.exports = { createChildSession, validId };