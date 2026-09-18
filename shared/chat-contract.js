(function (root) {
  "use strict";

  // familycopilot.chat.v1, synthetic public-interface data only. This module
  // neither imports domain modules nor authorizes work through a valid record.
  const VERSION = "familycopilot.chat.v1";
  const ZONE = "Asia/Taipei";
  const REFERENCE = "2026-09-18T04:00:00Z";
  const AREA = "Xinyi District, Taipei City";
  const DAY = 86400;
  const OFFSET = 8 * 3600;
  const INVALID = Symbol("invalid");
  const controls = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u;

  const check = predicate => value => predicate(value) ? value : INVALID;
  const literal = expected => check(value => value === expected);
  const choice = values => check(value => values.includes(value));
  const nullable = parser => value => value === null ? null : parser(value);
  const text = maximum => check(value => typeof value === "string" &&
    value.length > 0 && value.length <= maximum && value.trim().length > 0 &&
    !controls.test(value));
  const number = (minimum, maximum, integer = false) => check(value =>
    typeof value === "number" && Number.isFinite(value) &&
    value >= minimum && value <= maximum && (!integer || Number.isInteger(value)));
  const positiveInteger = check(value => Number.isSafeInteger(value) && value > 0);
  const localId = check(value => typeof value === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(value));
  const publicId = text;
  const currency = check(value => typeof value === "string" && /^[A-Z]{3}$/.test(value));
  const travelMode = choice(["walk", "transit", "drive", "cycle"]);
  const costBasis = choice(["per_child", "per_person"]);
  const unique = values => new Set(values).size === values.length;
  const normalizeToken = value => value.trim().normalize("NFC").toLowerCase();

  // Inspect own data descriptors, never value[key], iterators, toJSON, coercion
  // hooks or input prototype methods. Cross-realm native records/arrays work;
  // custom prototypes, accessors, symbols and non-JSON properties do not.
  // Proxies are not JSON-like data: JavaScript cannot inspect a Proxy without
  // potentially invoking its reflection traps. This is not a Proxy sandbox.
  function nativePrototype(prototype, constructor) {
    if (prototype === null || prototype === constructor.prototype) return true;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "constructor");
    if (!descriptor || !Object.hasOwn(descriptor, "value") ||
        typeof descriptor.value !== "function") return false;
    const back = Object.getOwnPropertyDescriptor(descriptor.value, "prototype");
    return !!back && Object.hasOwn(back, "value") && back.value === prototype &&
      Function.prototype.toString.call(descriptor.value) === Function.prototype.toString.call(constructor);
  }

  function record(fields, refine = () => true) {
    const entries = Object.entries(fields);
    return value => {
      if (value === null || typeof value !== "object" || Array.isArray(value) ||
          !nativePrototype(Object.getPrototypeOf(value), Object)) return INVALID;
      const keys = Reflect.ownKeys(value);
      if (keys.length !== entries.length || keys.some(key =>
        typeof key !== "string" || !Object.hasOwn(fields, key))) return INVALID;
      const result = Object.create(null);
      for (const [key, parser] of entries) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) return INVALID;
        const parsed = parser(descriptor.value);
        if (parsed === INVALID) return INVALID;
        result[key] = parsed;
      }
      return refine(result) ? result : INVALID;
    };
  }

  function array(parser, maximum, minimum = 0, distinct = false) {
    return value => {
      if (!Array.isArray(value) || !nativePrototype(Object.getPrototypeOf(value), Array)) return INVALID;
      const length = Object.getOwnPropertyDescriptor(value, "length");
      if (!length || !Object.hasOwn(length, "value") || !Number.isSafeInteger(length.value) ||
          length.value < minimum || length.value > maximum) return INVALID;
      // The size check precedes enumeration/traversal, including sparse arrays.
      if (Reflect.ownKeys(value).length !== length.value + 1) return INVALID;
      const result = [];
      for (let index = 0; index < length.value; index++) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) return INVALID;
        const parsed = parser(descriptor.value);
        if (parsed === INVALID) return INVALID;
        result.push(parsed);
      }
      return distinct && !unique(result) ? INVALID : result;
    };
  }

  // Fixed-depth schema traversal only: never recursively inspect unknown fields
  // or stringify arbitrary input. The copies are private, not repaired outputs.
  function safely(parser, value) {
    try { return parser(value); } catch { return INVALID; }
  }

  function leap(year) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  }

  function civilDay(value, minimum = 2000, maximum = 2100) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(5, 7));
    const day = Number(value.slice(8, 10));
    if (year < minimum || year > maximum || month < 1 || month > 12) return null;
    const months = [31, leap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (day < 1 || day > months[month - 1]) return null;
    const priorYear = year - 1;
    let days = 365 * priorYear + Math.floor(priorYear / 4) - Math.floor(priorYear / 100) +
      Math.floor(priorYear / 400) - 719162 + day - 1;
    for (let index = 0; index < month - 1; index++) days += months[index];
    return days;
  }

  // No Date.parse rollover, machine timezone, clock, or millisecond rounding.
  // Fractions retain their exact precision for boundary/order comparisons.
  // Leap-second notation (:60) is not supported by this civil-time contract.
  function instant(value, suffix) {
    if (typeof value !== "string") return null;
    const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|\+08:00)$/.exec(value);
    if (!match || match[6] !== suffix) return null;
    const day = civilDay(match[1], 1, 9999);
    const hour = Number(match[2]), minute = Number(match[3]), second = Number(match[4]);
    if (day === null || hour > 23 || minute > 59 || second > 59) return null;
    return {
      seconds: day * DAY + hour * 3600 + minute * 60 + second - (suffix === "Z" ? 0 : OFFSET),
      fraction: (match[5] || "").replace(/0+$/, "")
    };
  }

  function compareInstants(left, right) {
    return left.seconds - right.seconds ||
      (left.fraction < right.fraction ? -1 : left.fraction > right.fraction ? 1 : 0);
  }

  const civilDate = check(value => civilDay(value) !== null);
  const utcInstant = check(value => instant(value, "Z") !== null);
  const taipeiInstant = check(value => instant(value, "+08:00") !== null);
  const dateRange = record({ startDate: civilDate, endDate: civilDate, timeZone: literal(ZONE) }, range => {
    const difference = civilDay(range.endDate) - civilDay(range.startDate);
    return difference >= 0 && difference <= 6;
  });

  function forwardRange(range, referenceNow) {
    const referenceDay = Math.floor((instant(referenceNow, "Z").seconds + OFFSET) / DAY);
    return civilDay(range.startDate) >= referenceDay && civilDay(range.endDate) <= referenceDay + 27;
  }

  function containedRange(inner, outer) {
    return inner.startDate >= outer.startDate && inner.endDate <= outer.endDate;
  }

  function containedOccurrence(item, range) {
    const start = instant(item.startAt, "+08:00");
    const lower = { seconds: civilDay(range.startDate) * DAY - OFFSET, fraction: "" };
    const upper = { seconds: (civilDay(range.endDate) + 1) * DAY - OFFSET, fraction: "" };
    return compareInstants(start, lower) >= 0 && compareInstants(start, upper) < 0 &&
      (item.endAt === null || compareInstants(instant(item.endAt, "+08:00"), upper) <= 0);
  }

  const httpsUrl = nullable(check(value => {
    if (text(2048)(value) === INVALID || value !== value.trim() ||
        /[\s\\]/u.test(value) || !/^https:\/\/[^/?#]+(?:[/?#]|$)/i.test(value)) return false;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !!url.hostname && !url.username && !url.password;
    } catch { return false; }
  }));

  const preferences = record({
    ages: array(literal(8), 1, 1),
    interests: array(text(40), 12, 0, true),
    interestBasis: choice(["demo_fixture", "parent_confirmed"]),
    preferredTeams: array(text(120), 16),
    origin: record({ area: literal(AREA), precision: literal("district"), landmark: literal(null) }),
    travelMode: nullable(travelMode),
    constraints: record({
      maxTravelMinutes: nullable(number(1, 180, true)),
      budget: nullable(record({ amount: number(0, 100000), currency, basis: costBasis })),
      setting: choice(["any", "indoor", "outdoor"]),
      excludedCategories: array(text(40), 12, 0, true)
    })
  });

  const demoContext = record({
    version: literal(VERSION),
    sessionId: localId,
    contextRevision: positiveInteger,
    referenceNow: literal(REFERENCE),
    timeZone: literal(ZONE),
    mode: literal("synthetic"),
    preferences,
    activityRange: dateRange,
    triggerState: choice(["not_started", "active", "paused", "ended"])
  }, value => forwardRange(value.activityRange, value.referenceNow));

  const activityRequest = record({
    version: literal(VERSION),
    requestId: localId,
    generation: positiveInteger,
    contextRevision: positiveInteger,
    referenceNow: utcInstant,
    range: dateRange,
    mode: literal("synthetic"),
    trigger: record({ kind: choice(["demo_start", "refinement_submit", "explicit_retry"]), actionId: localId }),
    preferences
  }, value => forwardRange(value.range, value.referenceNow));

  const calendarMountOptions = record({ version: literal(VERSION), mode: literal("synthetic") });

  const source = record({
    sourceId: publicId(80),
    name: text(120),
    url: httpsUrl,
    kind: literal("synthetic"),
    coverage: record({
      range: dateRange,
      categories: array(text(40), 12),
      completeness: choice(["complete", "partial", "unknown"])
    }),
    retrievedAt: literal(null),
    freshness: literal("synthetic")
  });

  const issue = record({
    code: choice(["source_unavailable", "source_unsupported", "scope_incomplete", "candidate_limit", "evidence_unknown", "no_matches"]),
    sourceId: nullable(publicId(80)),
    message: text(240)
  });

  const evidence = record({
    id: publicId(80),
    field: choice(["identity", "timing", "venue", "age", "travel", "cost", "setting", "thumbnail"]),
    kind: choice(["synthetic", "unknown"]),
    sourceId: publicId(80),
    sourceUrl: httpsUrl,
    retrievedAt: literal(null),
    sourceUpdatedAt: literal(null),
    text: text(240)
  });

  const ageGuidance = record({
    minAge: nullable(number(0, 120, true)),
    maxAge: nullable(number(0, 120, true)),
    rule: choice(["recommended", "required", "unknown"]),
    evidenceId: nullable(publicId(80))
  }, value => value.minAge === null || value.maxAge === null || value.minAge <= value.maxAge);

  const travel = record({
    // The v1 district origin cannot support a quantitative route, even if a
    // synthetic evidence record accompanies an illustrative number.
    durationMinutes: literal(null),
    distanceKm: literal(null),
    mode: nullable(travelMode),
    originArea: nullable(text(120)),
    evidenceId: nullable(publicId(80))
  });

  const cost = record({
    amount: nullable(number(0, 100000)),
    currency: nullable(currency),
    basis: nullable(costBasis),
    evidenceId: nullable(publicId(80))
  });

  const thumbnail = nullable(record({
    // Symbolic key syntax only, NOT an asset manifest. Activities must resolve
    // membership in its own compile-time allowlist or render the fallback.
    assetKey: check(value => typeof value === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(value)),
    alt: text(160),
    sourceUrl: httpsUrl,
    attribution: text(240),
    permission: choice(["original_synthetic", "unavailable"]),
    evidenceId: publicId(80)
  }));

  function unknownAge(item) {
    const age = item.ageGuidance;
    return age.rule === "unknown" || age.minAge === null && age.maxAge === null;
  }

  function fieldReference(item, byId, field, hasFacts) {
    const reference = field === "age" ? item.ageGuidance.evidenceId : item[field].evidenceId;
    if (reference === null) return !hasFacts;
    const supporting = byId.get(reference);
    return !!supporting && supporting.field === field && (!hasFacts || supporting.kind === "synthetic");
  }

  function occurrenceInvariants(item) {
    // The serialized tuple is also a bounded conversation card reference.
    if (cardId(item).length > 400) return false;
    if (item.endAt !== null && compareInstants(instant(item.endAt, "+08:00"), instant(item.startAt, "+08:00")) <= 0) return false;
    const byId = new Map(item.evidence.map(entry => [entry.id, entry]));
    if (byId.size !== item.evidence.length) return false;
    const supports = field => item.evidence.some(entry => entry.field === field && entry.kind === "synthetic");
    if (!supports("identity") || !supports("timing") || !supports("venue") ||
        item.setting !== "unknown" && !supports("setting")) return false;
    const age = item.ageGuidance;
    if (!fieldReference(item, byId, "age", age.rule !== "unknown" || age.minAge !== null || age.maxAge !== null) ||
        !fieldReference(item, byId, "travel", item.travel.mode !== null || item.travel.originArea !== null) ||
        !fieldReference(item, byId, "cost", item.cost.amount !== null || item.cost.currency !== null || item.cost.basis !== null) ||
        item.thumbnail !== null && !fieldReference(item, byId, "thumbnail", item.thumbnail.permission === "original_synthetic")) return false;
    if (item.rationale.some(reason => reason.evidenceIds.some(id => !byId.has(id)))) return false;
    if ((unknownAge(item) || item.endAt === null) && item.assessment !== "needs_checking") return false;
    // Ticket availability and travel are always unknown in M1, so a visible
    // uncertainty list is mandatory. Its prose cannot be semantically verified
    // here: Activities must describe each applicable gap, not just pass a regex.
    return item.unknowns.length > 0;
  }

  const occurrence = record({
    sourceId: publicId(120),
    eventId: publicId(120),
    occurrenceId: publicId(120),
    category: text(40),
    title: text(160),
    sourceUrl: httpsUrl,
    startAt: taipeiInstant,
    endAt: nullable(taipeiInstant),
    timeZone: literal(ZONE),
    venue: record({ name: nullable(text(160)), area: text(120) }),
    ageGuidance,
    travel,
    cost,
    setting: choice(["indoor", "outdoor", "unknown"]),
    thumbnail,
    rationale: array(record({ text: text(240), evidenceIds: array(publicId(80), 8) }), 3),
    evidence: array(evidence, 16),
    unknowns: array(text(160), 12),
    assessment: choice(["candidate", "needs_checking"]),
    calendarFit: literal("not_checked")
  }, occurrenceInvariants);

  function cardId(item) {
    return JSON.stringify([item.sourceId, item.eventId, item.occurrenceId]);
  }

  const failedIssue = code => code === "source_unavailable" || code === "source_unsupported";
  const incompleteIssue = code => failedIssue(code) || code === "scope_incomplete" || code === "candidate_limit";
  const applies = (entry, sourceId) => entry.sourceId === null || entry.sourceId === sourceId;

  function resultInvariants(result) {
    const sources = new Map(result.sources.map(entry => [entry.sourceId, entry]));
    if (sources.size !== result.sources.length || !unique(result.items.map(cardId))) return false;
    if (result.issues.some(entry => entry.sourceId !== null && !sources.has(entry.sourceId))) return false;
    for (const entry of result.sources) {
      if (!containedRange(entry.coverage.range, result.range)) return false;
      if (entry.coverage.completeness !== "complete" && !result.issues.some(problem =>
        applies(problem, entry.sourceId) && incompleteIssue(problem.code))) return false;
    }
    for (const item of result.items) {
      const origin = sources.get(item.sourceId);
      if (!origin || !containedOccurrence(item, result.range) ||
          !containedOccurrence(item, origin.coverage.range) ||
          result.issues.some(problem => applies(problem, item.sourceId) && failedIssue(problem.code)) ||
          item.evidence.some(entry => !sources.has(entry.sourceId))) return false;
    }
    // This contradiction is invalid even when partial takes status precedence.
    // A different source may independently and truthfully report no matches.
    if (result.items.length > 0 && result.issues.some(entry => entry.code === "no_matches" &&
        (entry.sourceId === null || result.items.some(item => item.sourceId === entry.sourceId)))) return false;
    for (const problem of result.issues) {
      if (!incompleteIssue(problem.code)) continue;
      const affected = result.sources.filter(entry => applies(problem, entry.sourceId));
      // Global issues apply across stated sources but cannot erase complete
      // coverage. A source-specific failure cannot claim complete coverage.
      if (problem.sourceId !== null && affected.some(entry => entry.coverage.completeness === "complete")) return false;
      if (!affected.some(entry => entry.coverage.completeness !== "complete")) return false;
      if (problem.code === "candidate_limit" && !affected.some(entry => entry.coverage.completeness === "partial")) return false;
    }
    const allFailed = result.sources.every(entry => entry.coverage.completeness !== "complete" &&
      result.issues.some(problem => applies(problem, entry.sourceId) && failedIssue(problem.code)));
    if (allFailed) return result.status === "unavailable" && result.items.length === 0;
    const incomplete = result.sources.some(entry => entry.coverage.completeness !== "complete") ||
      result.issues.some(entry => incompleteIssue(entry.code));
    if (incomplete) return result.status === "partial";
    if (result.items.length === 0) return result.status === "empty" && result.issues.some(entry => entry.code === "no_matches");
    return result.status === (result.items.every(item => item.assessment === "needs_checking") ? "unknown" : "results");
  }

  const activityResult = record({
    version: literal(VERSION),
    requestId: localId,
    generation: positiveInteger,
    contextRevision: positiveInteger,
    mode: literal("synthetic"),
    range: dateRange,
    status: choice(["results", "unknown", "empty", "partial", "unavailable"]),
    sources: array(source, 8, 1),
    items: array(occurrence, 6),
    issues: array(issue, 12),
    calendarFit: literal("not_checked")
  }, resultInvariants);

  function preferenceMatch(item, requested) {
    const age = item.ageGuidance;
    const ageMismatch = requested.ages.some(value =>
      age.minAge !== null && value < age.minAge || age.maxAge !== null && value > age.maxAge);
    if (age.rule === "required" && ageMismatch) return false;
    const constraints = requested.constraints;
    if (constraints.excludedCategories.some(value => normalizeToken(value) === normalizeToken(item.category))) return false;
    let needsChecking = unknownAge(item) || item.endAt === null ||
      age.rule === "recommended" && ageMismatch;
    if (constraints.setting !== "any") {
      if (item.setting === "unknown") needsChecking = true;
      else if (item.setting !== constraints.setting) return false;
    }
    if (constraints.budget !== null) {
      const budget = constraints.budget;
      if (item.cost.amount === null || item.cost.currency !== budget.currency || item.cost.basis !== budget.basis) needsChecking = true;
      else if (item.cost.amount > budget.amount) return false;
    }
    // No district-only route can confirm a required travel limit. Interests and
    // preferred team names remain preferences, never admission/filter rules.
    if (constraints.maxTravelMinutes !== null) needsChecking = true;
    return !needsChecking || item.assessment === "needs_checking";
  }

  function validateDemoContext(value) { return safely(demoContext, value) !== INVALID; }
  function validateActivityRequest(value) { return safely(activityRequest, value) !== INVALID; }
  function validateActivityResultShape(value) { return safely(activityResult, value) !== INVALID; }
  function validateCalendarMountOptions(value) { return safely(calendarMountOptions, value) !== INVALID; }

  function validateActivityResult(value, request) {
    try {
      const asked = activityRequest(request);
      if (asked === INVALID) return false;
      const result = activityResult(value);
      if (result === INVALID) return false;
      for (const key of ["version", "requestId", "generation", "contextRevision", "mode"]) {
        if (result[key] !== asked[key]) return false;
      }
      if (result.range.startDate !== asked.range.startDate || result.range.endDate !== asked.range.endDate ||
          result.range.timeZone !== asked.range.timeZone) return false;
      const reference = instant(asked.referenceNow, "Z");
      return result.items.every(item => compareInstants(instant(item.startAt, "+08:00"), reference) >= 0 &&
        preferenceMatch(item, asked.preferences));
    } catch { return false; }
  }

  // Only trusted, schema-copied records reach this serializer. Sorting applies
  // recursively to object keys; primitive types and validated date text stay exact.
  function canonical(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
    return "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + canonical(value[key])).join(",") + "}";
  }

  function activityRequestKey(value) {
    try {
      const request = activityRequest(value);
      if (request !== INVALID) {
        const preferred = request.preferences;
        const tokens = values => [...new Set(values.map(normalizeToken))].sort();
        preferred.interests = tokens(preferred.interests);
        preferred.preferredTeams = tokens(preferred.preferredTeams);
        preferred.constraints.excludedCategories = tokens(preferred.constraints.excludedCategories);
        return canonical({ version: request.version, mode: request.mode, referenceNow: request.referenceNow,
          range: request.range, preferences: preferred });
      }
    } catch { /* Never include the rejected value or caught exception. */ }
    throw new Error("invalid_request");
  }

  function activityCardId(value) {
    try {
      const item = occurrence(value);
      if (item !== INVALID) return cardId(item);
    } catch { /* Never include the rejected value or caught exception. */ }
    throw new Error("invalid_result");
  }

  const api = Object.freeze({
    validateDemoContext,
    validateActivityRequest,
    validateActivityResultShape,
    validateActivityResult,
    validateCalendarMountOptions,
    activityRequestKey,
    activityCardId
  });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FamilyChatContract = api;
})(globalThis);