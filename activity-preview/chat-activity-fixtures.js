(function (root) {
  "use strict";

  function occurrence(category, eventId, occurrenceId, title, startAt, endAt) {
    const sourceId = `sample-${category}`;
    const movie = category === "movie";
    const evidence = (field, text) => ({
      id: field, field, kind: "synthetic", sourceId, sourceUrl: null,
      retrievedAt: null, sourceUpdatedAt: null, text
    });
    return {
      sourceId, eventId, occurrenceId, category, title, sourceUrl: null,
      startAt, endAt, timeZone: "Asia/Taipei",
      venue: { name: movie ? "Sample Xinyi Cinema" : "Sample Taipei Arena", area: "Taipei City" },
      ageGuidance: { minAge: movie ? 6 : null, maxAge: null,
        rule: movie ? "recommended" : "unknown", evidenceId: movie ? "age" : null },
      travel: { durationMinutes: null, distanceKm: null, mode: null, originArea: null, evidenceId: null },
      cost: { amount: null, currency: null, basis: null, evidenceId: null },
      setting: "indoor",
      thumbnail: { assetKey: movie ? "movie-synthetic" : "basketball-synthetic",
        alt: movie ? "Original fictional Skybound poster" : "Original fictional Comets and Grove team badges",
        sourceUrl: null, attribution: "Original demo artwork by Family Copilot.",
        permission: "original_synthetic", evidenceId: "thumbnail" },
      rationale: [{ text: movie ? "A fictional animated adventure as an alternative outing." :
        "A fictional basketball game as an alternative outing.", evidenceIds: ["identity"] }],
      evidence: [
        evidence("identity", movie ? "Skybound is a fictional animated movie." : "Comets and Grove are fictional basketball teams."),
        evidence("timing", `Scripted occurrence: ${startAt} to ${endAt}.`),
        evidence("venue", "The venue and its Taipei area are fictional."),
        evidence("setting", "This fixture describes an indoor venue."),
        evidence("thumbnail", "Original local demo artwork, not provider artwork."),
        ...(movie ? [evidence("age", "Fictional recommended guidance: age 6 and above; not an admission rule.")] : [])
      ],
      unknowns: ["Travel time and distance unknown; district-only origin is not routed.",
        "Cost unknown.", "Ticket availability unknown.",
        ...(movie ? [] : ["Age guidance unknown."])],
      assessment: movie ? "candidate" : "needs_checking", calendarFit: "not_checked"
    };
  }

  function createPool(range) {
    return {
      sources: ["basketball", "movie"].map(category => ({
        sourceId: `sample-${category}`, name: `Scripted ${category} fixtures`, url: null,
        kind: "synthetic", coverage: { range: { ...range }, categories: [category], completeness: "complete" },
        retrievedAt: null, freshness: "synthetic"
      })),
      issues: [],
      candidates: [
        { item: occurrence("basketball", "comets-grove", "oct10-1700", "Comets vs Grove",
          "2026-10-10T17:00:00+08:00", "2026-10-10T19:00:00+08:00"),
        teams: ["Comets", "Grove"], interests: ["sports", "basketball"] },
        { item: occurrence("movie", "skybound", "oct11-1430", "Skybound",
          "2026-10-11T14:30:00+08:00", "2026-10-11T16:00:00+08:00"),
        teams: [], interests: ["movie", "movies", "arts"] },
        { item: occurrence("movie", "skybound", "sep20-1400", "Skybound",
          "2026-09-20T14:00:00+08:00", "2026-09-20T15:30:00+08:00"),
        teams: [], interests: ["movie", "movies", "arts"] }
      ]
    };
  }

  const api = Object.freeze({ createPool });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FamilyChatActivityFixtures = api;
})(globalThis);
