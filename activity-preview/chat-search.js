(function (root) {
  "use strict";
  const commonJS = typeof module !== "undefined" && module.exports;
  const contract = commonJS ? require("../shared/chat-contract") : root.FamilyChatContract;
  const fixtures = commonJS ? require("./chat-activity-fixtures") : root.FamilyChatActivityFixtures;
  const normalize = value => value.trim().normalize("NFC").toLowerCase();
  const compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;

  function abortIfNeeded(signal) {
    if (signal.aborted) {
      const error = new Error("request_cancelled");
      error.name = "AbortError";
      throw error;
    }
  }

  function assess(item, preferences) {
    const { constraints } = preferences;
    const age = item.ageGuidance;
    const mismatch = preferences.ages.some(value =>
      age.minAge !== null && value < age.minAge || age.maxAge !== null && value > age.maxAge);
    if (age.rule === "required" && mismatch ||
        constraints.excludedCategories.some(value => normalize(value) === normalize(item.category)) ||
        constraints.setting !== "any" && item.setting !== "unknown" && item.setting !== constraints.setting) return null;
    const unknowns = new Set(item.unknowns);
    let needsChecking = age.rule === "unknown" || age.minAge === null && age.maxAge === null || item.endAt === null;
    if (age.rule === "unknown" || age.minAge === null && age.maxAge === null) unknowns.add("Age guidance unknown.");
    if (age.rule === "recommended" && mismatch) {
      needsChecking = true;
      unknowns.add(`Recommended age guidance does not match age ${preferences.ages[0]}; suitability needs checking.`);
    }
    if (item.endAt === null) unknowns.add("End time and duration unknown; time fit needs checking.");
    unknowns.add("Travel time and distance unknown; district-only origin is not routed.");
    unknowns.add("Ticket availability unknown.");
    if (item.cost.amount === null || item.cost.currency === null || item.cost.basis === null) unknowns.add("Cost unknown.");
    if (constraints.setting !== "any" && item.setting === "unknown") {
      needsChecking = true;
      unknowns.add("Indoor/outdoor requirement needs checking.");
    }
    if (constraints.maxTravelMinutes !== null) {
      needsChecking = true;
      unknowns.add("Travel limit cannot be checked without a comparable route.");
    }
    if (constraints.budget !== null) {
      const budget = constraints.budget;
      if (item.cost.amount === null || item.cost.currency !== budget.currency || item.cost.basis !== budget.basis) {
        needsChecking = true;
        unknowns.add("Budget needs checking; comparable currency and price basis are required.");
      } else if (item.cost.amount > budget.amount) return null;
    }
    return { ...item, unknowns: [...unknowns], assessment: needsChecking ? "needs_checking" : "candidate" };
  }

  function select(request, pool) {
    const { candidates, sources, issues } = pool;
    const ordered = [...candidates].sort((left, right) => {
      for (const field of ["sourceId", "eventId", "occurrenceId"]) {
        const difference = compare(left.item[field], right.item[field]);
        if (difference) return difference;
      }
      return 0;
    });
    if (ordered.length > 40) {
      for (const sourceId of new Set(ordered.slice(40).map(candidate => candidate.item.sourceId))) {
        const source = sources.find(entry => entry.sourceId === sourceId);
        if (!source) throw new Error("invalid_result");
        source.coverage.completeness = "partial";
        issues.push({ code: "candidate_limit", sourceId, message: "Candidate limit reached; scope is incomplete." });
      }
    }
    const selected = [];
    const failed = sourceId => issues.some(issue =>
      (issue.sourceId === null || issue.sourceId === sourceId) &&
      ["source_unavailable", "source_unsupported"].includes(issue.code));
    for (const candidate of ordered.slice(0, 40)) {
      const item = candidate.item;
      contract.activityCardId(item);
      if (failed(item.sourceId)) continue;
      const assessed = assess(item, request.preferences);
      if (!assessed) continue;
      const source = sources.find(entry => entry.sourceId === item.sourceId);
      const partial = source.coverage.completeness !== "complete";
      const envelope = { version: request.version, requestId: request.requestId,
        generation: request.generation, contextRevision: request.contextRevision, mode: request.mode,
        range: { ...request.range }, status: partial ? "partial" : assessed.assessment === "candidate" ? "results" : "unknown",
        sources: [source], items: [assessed], issues: issues.filter(issue => issue.sourceId === source.sourceId || issue.sourceId === null), calendarFit: "not_checked" };
      if (!contract.validateActivityResult(envelope, request)) continue;
      const score = candidate.interests.some(value => request.preferences.interests.some(interest => normalize(interest) === normalize(value))) ? 1 : 0;
      const teamScore = candidate.teams.some(value => request.preferences.preferredTeams.some(team => normalize(team) === normalize(value))) ? 1 : 0;
      if (source.kind === "public_snapshot") {
        const matchedTeams = request.preferences.preferredTeams.filter(team => candidate.teams.some(value => normalize(team) === normalize(value)));
        const reasons = [];
        if (score) reasons.push({ text: `Matches your ${item.category === "movie" ? "movie" : "basketball"} interest.`, evidenceIds: ["identity"] });
        if (teamScore) reasons.push({ text: `Features your preferred team: ${matchedTeams.join(", ")}.`, evidenceIds: ["identity"] });
        const local = normalize(item.venue.area) === normalize(request.preferences.origin.area);
        reasons.push({ text: `${local ? "Listed cinema matches your preferred area. " : "Travel from your preferred area is not checked. "}Age ${request.preferences.ages[0]}: admission and suitability still need checking.`, evidenceIds: ["venue"] });
        assessed.rationale = reasons;
      }
      selected.push({ item: assessed, score: score * (source.kind === "public_snapshot" ? 2 : 1) + teamScore });
    }
    selected.sort((left, right) => right.score - left.score);
    const items = selected.slice(0, 6).map(entry => entry.item);
    const allFailed = sources.every(source => failed(source.sourceId));
    const incomplete = sources.some(source => source.coverage.completeness !== "complete") ||
      issues.some(issue => ["source_unavailable", "source_unsupported", "scope_incomplete", "candidate_limit"].includes(issue.code));
    const status = allFailed ? "unavailable" : incomplete ? "partial" : !items.length ? "empty" :
      items.every(item => item.assessment === "needs_checking") ? "unknown" : "results";
    if (status === "empty") issues.push({ code: "no_matches", sourceId: null, message: "No matching occurrences in these demo fixtures." });
    return { version: request.version, requestId: request.requestId, generation: request.generation,
      contextRevision: request.contextRevision, mode: request.mode, range: { ...request.range },
      status, sources, items, issues, calendarFit: "not_checked" };
  }

  async function searchActivities(value, { signal } = {}) {
    if (!(signal instanceof AbortSignal)) throw new Error("invalid_request");
    abortIfNeeded(signal);
    const mode = value && typeof value === "object" ? Object.getOwnPropertyDescriptor(value, "mode") : null;
    if (mode && mode.value === "live") throw new Error("mode_not_enabled");
    if (!contract.validateActivityRequest(value)) throw new Error("invalid_request");
    const request = structuredClone(value);
    await Promise.resolve();
    abortIfNeeded(signal);
    let result;
    try {
      result = select(request, fixtures.createPool(request.range));
      if (!contract.validateActivityResult(result, request)) throw new Error("invalid_result");
    } catch {
      throw new Error("invalid_result");
    }
    await Promise.resolve();
    abortIfNeeded(signal);
    return result;
  }

  const api = Object.freeze({ searchActivities });
  if (commonJS) module.exports = api;
  else root.FamilyChatActivities = Object.freeze({ ...root.FamilyChatActivities, ...api });
})(globalThis);
