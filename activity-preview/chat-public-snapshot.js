(function (root) {
  "use strict";
  const retrievedAt = "2026-09-20T09:29:03Z";
  const gameUrl = "https://tpbl.basketball/schedule/27539";
  const feedUrl = "https://api.tpbl.basketball/api/seasons/3/games";
  const films = [
    { id: "8956", title: "Forgotten Island", releaseDate: "2026-09-25", minutes: 109 },
    { id: "8786", title: "Chiikawa The Movie: The Secret of the Mermaid Island", releaseDate: "2026-07-31", minutes: 100 }
  ];
  function evidence(sourceId, sourceUrl, field, text, known = true) {
    return { id: field, field, kind: known ? "public_snapshot" : "unknown", sourceId, sourceUrl,
      retrievedAt: known ? retrievedAt : null, sourceUpdatedAt: null, text };
  }
  function base(sourceId, eventId, category, title, sourceUrl) {
    return { sourceId, eventId, occurrenceId: `catalogue-${eventId}`, category, title, sourceUrl,
      startAt: null, endAt: null, timeZone: "Asia/Taipei",
      venue: { name: null, area: "Taipei City" },
      ageGuidance: { minAge: null, maxAge: null, rule: "unknown", evidenceId: null },
      travel: { durationMinutes: null, distanceKm: null, mode: null, originArea: null, evidenceId: null },
      cost: { amount: null, currency: null, basis: null, evidenceId: null },
      setting: "unknown", thumbnail: null, rationale: [], evidence: [],
      unknowns: ["Saved public information; recheck the official source before making plans.", "Ticket availability unknown."],
      assessment: "needs_checking", calendarFit: "not_checked" };
  }
  function createPool(range) {
    const source = (sourceId, name, url, category) => ({ sourceId, name, url, kind: "public_snapshot",
      coverage: { range: { ...range }, categories: [category], completeness: "partial" },
      retrievedAt, freshness: "snapshot" });
    const sources = [source("tpbl-snapshot", "TPBL official schedule snapshot", feedUrl, "basketball"),
      source("vieshow-snapshot", "Vieshow official film catalogue snapshot", "https://www.vscinemas.com.tw/vsweb/film/index.aspx", "movie")];
    const game = base("tpbl-snapshot", "27539", "basketball", "新北中信特攻 vs 福爾摩沙夢想家", gameUrl);
    Object.assign(game, { occurrenceId: "27539-20261010", startAt: "2026-10-10T17:00:00+08:00",
      venue: { name: "Taipei Heping Basketball Gymnasium", area: "Taipei City" } });
    game.evidence = [
      evidence(game.sourceId, feedUrl, "identity", "Official game 27539: New Taipei CTBC DEA (team 6) vs Formosa Dreamers (team 3). English names are display translations."),
      evidence(game.sourceId, feedUrl, "timing", "Published local start: 2026-10-10 17:00. Interpreted as Taiwan venue time (UTC+8); the feed gives no end time."),
      evidence(game.sourceId, feedUrl, "venue", "Official venue: Taipei Heping Basketball Gymnasium (English display translation).")
    ];
    const candidates = [{ item: game, teams: ["新北中信特攻", "中信特攻", "CTBC DEA", "New Taipei CTBC DEA", "福爾摩沙夢想家", "Formosa Dreamers"], interests: ["basketball", "sports"] }];
    const film = films.find(entry => entry.releaseDate <= range.endDate);
    if (film) {
      const url = `https://www.vscinemas.com.tw/vsweb/film/detail.aspx?id=${film.id}`;
      const movie = base("vieshow-snapshot", film.id, "movie", film.title, url);
      movie.venue = { name: "Vieshow Cinemas Taipei Hsin Yi (listed cinema; showtime unverified)", area: "Xinyi District, Taipei City" };
      movie.evidence = [
        evidence(movie.sourceId, url, "identity", `Official film catalogue: ${film.title}. Taiwan release: ${film.releaseDate}; listed runtime: ${film.minutes} minutes.`),
        evidence(movie.sourceId, url, "timing", "No dated screening verified for the requested range. Film runtime is not a screening start or end time.", false),
        evidence(movie.sourceId, url, "venue", "Official film page lists Vieshow Cinemas Taipei Hsin Yi for a Mandarin digital version; requested-date availability is unverified."),
        evidence(movie.sourceId, url, "age", "The official page displays Taiwan Protected classification. Numeric admission conditions and individual suitability have not been verified.")
      ];
      movie.unknowns.push("Film idea only: no screening on the requested dates has been verified.");
      candidates.push({ item: movie, teams: [], interests: ["movies", "movie", "arts"] });
    }
    return { sources, candidates, issues: [
      { code: "scope_incomplete", sourceId: "tpbl-snapshot", message: "One saved October game, not a complete schedule. No nearer basketball game is verified in this snapshot." },
      { code: "scope_incomplete", sourceId: "vieshow-snapshot", message: "Real film catalogue, not confirmed screenings. Requested-date showtimes and age admission conditions still need checking." }
    ] };
  }
  function visitorInfo(item) {
    const game = item.sourceId === "tpbl-snapshot" && item.eventId === "27539" && item.category === "basketball" && item.sourceUrl === gameUrl;
    const film = films.find(entry => item.sourceId === "vieshow-snapshot" && item.eventId === entry.id && item.category === "movie" &&
      item.sourceUrl === `https://www.vscinemas.com.tw/vsweb/film/detail.aspx?id=${entry.id}`);
    if (!game && !film) return null;
    return {
      checkedOn: "2026-09-20",
      venue: game ? "Taipei Heping Basketball Gymnasium" : "Vieshow Cinemas Taipei Hsin Yi",
      admission: game ? "110 cm+: ticket required. Under 110 cm: one non-seated child per ticket holder. General club policy; confirm game exceptions." : "Protected (6+). Ages 6-11 must be accompanied by an adult.",
      admissionUrl: game ? "https://tix.ctbcsports.com/DEA/UTK0107_" : "https://www.vscinemas.com.tw/vsTicketing/ticketing/ticket.aspx",
      price: game ? "Game-specific prices: check official ticketing." : "Child concession tickets; price varies by screening. Online fee: NT$20/ticket.",
      ticketUrl: game ? "https://tix.ctbcsports.com/DEA/UTK0101_" : "https://www.vscinemas.com.tw/vsTicketing/ticketing/ticket.aspx",
      ticketLabel: game ? "Ticket prices" : "Cinema prices",
      mapUrl: game ? "https://www.google.com/maps/search/?api=1&query=Taipei+Heping+Basketball+Gymnasium" : "https://www.google.com/maps/search/?api=1&query=Vieshow+Cinemas+Taipei+Hsin+Yi",
      format: game ? null : `Indoor cinema / ${film.minutes} min`,
      note: game ? "General club admission policy, not a verified rule for this particular game. No child's height was collected or inferred." :
        "The film page lists Protected classification and runtime. Cinema rules prohibit under-6 admission and require adult accompaniment at 6-11. Ages 2-11 need concession tickets. Classification is not personalized suitability; no screening is confirmed.",
      ticketSource: game ? "https://ctbcdea.com.tw/" : item.sourceUrl
    };
  }
  const api = Object.freeze({ createPool, visitorInfo });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FamilyChatActivityFixtures = api;
})(globalThis);