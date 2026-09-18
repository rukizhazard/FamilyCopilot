(function (root) {
  "use strict";
  // Deliberately independent of the shared app and its consent/auth state.
  const week = Object.freeze({ start: "2026-09-20", end: "2026-09-26", zone: "Asia/Taipei", label: "Sun, Sep 20–Sat, Sep 26, 2026 · Taipei (UTC+8)" });
  const maxChildren = 8;
  const slots = Object.freeze({
    week: Object.freeze({ date: null, start: 0, end: 1440, label: week.label }),
    saturday: Object.freeze({ date: "2026-09-26", start: 13 * 60, end: 17 * 60, label: "Sat, Sep 26 · 1–5 pm" }),
    morning: Object.freeze({ date: "2026-09-24", start: 9 * 60, end: 12 * 60, label: "Thu, Sep 24 · 9 am–noon" }),
    sunday: Object.freeze({ date: "2026-09-20", start: 13 * 60, end: 17 * 60, label: "Sun, Sep 20 · 1–5 pm" })
  });
  const categories = Object.freeze({ sports: "Sports", music: "Music", art: "Art", science: "Science", outdoors: "Outdoors", exhibition: "Exhibitions" });
  const sports = Object.freeze({ basketball: "Basketball", pingpong: "Ping-pong", baseball: "Baseball", football: "Football", badminton: "Badminton", swimming: "Swimming" });
  const items = Object.freeze([
    { id: "hoops", category: "sports", sport: "basketball", theme: "peach", emoji: "🏀", title: "Little hoops, big smiles", date: "2026-09-20", start: 810, end: 870, time: "1:30–2:30 pm", minAge: 6, maxAge: 10, cost: 12, format: "class", indoor: true, venue: "Clover Sports Hall", reason: "A playful first basketball workshop for beginners.", keywords: ["basketball", "beginner", "indoor", "indoors", "workshop"], source: "Invented Clover Sports Hall session" },
    { id: "music", category: "music", theme: "lilac", emoji: "🎻", title: "A pocket-sized orchestra", date: "2026-09-21", start: 900, end: 945, time: "3–3:45 pm", minAge: 4, maxAge: 12, cost: 10, format: "watch", indoor: true, venue: "Little Moon Studio", reason: "A short, relaxed concert with a big mix of instruments.", keywords: ["concert", "instruments", "indoor", "indoors", "orchestra"], source: "Invented Little Moon Studio matinee" },
    { id: "art", category: "art", theme: "pink", emoji: "🎨", title: "Paint a tiny world", date: "2026-09-22", start: 840, end: 900, time: "2–3 pm", minAge: 5, maxAge: 12, cost: 8, format: "try", indoor: true, venue: "Peach Tree Art Room", reason: "Make a mini masterpiece, with room for happy accidents.", keywords: ["painting", "beginner", "indoor", "indoors", "making"], source: "Invented Peach Tree Art Room session" },
    { id: "science", category: "science", theme: "blue", emoji: "🫧", title: "The big bubble lab", date: "2026-09-24", start: 600, end: 660, time: "10–11 am", minAge: 6, maxAge: 11, cost: 0, format: "class", indoor: true, venue: "Curiosity Corner", reason: "Hands-on bubble experiments for curious beginners.", keywords: ["bubbles", "beginner", "indoor", "indoors", "experiments"], source: "Invented Curiosity Corner workshop" },
    { id: "nature", category: "outdoors", theme: "mint", emoji: "🌱", title: "Tiny trails & leafy tales", date: "2026-09-25", start: 840, end: 900, time: "2–3 pm", minAge: 4, maxAge: 10, cost: 0, format: "try", indoor: false, venue: "Fern Patch Park", reason: "An easy guided nature walk with a leafy scavenger hunt.", keywords: ["nature", "walk", "beginner", "outdoor", "outdoors"], source: "Invented Fern Patch Park walk" },
    { id: "exhibit", category: "exhibition", theme: "butter", emoji: "🦕", title: "Hello, little dinosaur", date: "2026-09-26", start: 900, end: 960, time: "3–4 pm", minAge: null, maxAge: null, cost: null, format: "watch", indoor: true, venue: "Wonder House", reason: "A guided dinosaur exhibition visit for curious minds.", keywords: ["dinosaurs", "indoor", "indoors", "museum"], source: "Invented Wonder House guided visit" }
  ].map(item => Object.freeze({ ...item, keywords: Object.freeze(item.keywords) })));
  const escapeHtml = value => String(value == null ? "" : value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function normalize(raw = {}) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { error: "Choose your preferences again.", field: "find" };
    if (raw.keywords != null && typeof raw.keywords !== "string") return { error: "Use simple keywords.", field: "keywords" };
    const keywords = String(raw.keywords || "").trim().toLowerCase();
    if (keywords.length > 80 || /[^a-z ,\-]/.test(keywords) || /\b(no|not|without|exclude|except|avoid|only|or|under|over|near|must)\b/.test(keywords)) {
      return { error: "Try simple keywords, like basketball, beginner. Sentences and exclusions aren't supported yet.", field: "keywords" };
    }
    const tokens = [...new Set(keywords.split(/[ ,\-]+/).filter(Boolean))];
    if (tokens.length > 5) return { error: "Try up to five keywords.", field: "keywords" };
    const slot = raw.slot ?? "week";
    // Keep legacy single-age callers, but never silently ignore conflicting input.
    if (raw.ages !== undefined && raw.age !== undefined) return { error: "Choose ages in one place.", field: "age-0" };
    const values = raw.ages === undefined ? (raw.age == null ? [] : [raw.age]) : raw.ages;
    if (!Array.isArray(values) || values.length > maxChildren) return { error: "Choose up to eight ages, or skip ages.", field: "add-age" };
    const ages = [];
    for (let index = 0; index < values.length; index++) {
      const value = values[index];
      if (value === "" || value === null) continue;
      if (!(typeof value === "number" || typeof value === "string" && /^\d{1,2}$/.test(value)) || !Number.isInteger(Number(value)) || Number(value) < 4 || Number(value) > 17) {
        return { error: `Choose an age from 4 to 17 for child ${index + 1}, or skip it.`, field: `age-${index}` };
      }
      ages.push(Number(value));
    }
    const age = ages.length === 1 ? ages[0] : null;
    const interests = raw.interests == null ? [] : raw.interests;
    const format = raw.format ?? "any";
    const sportValues = raw.sports === undefined ? [] : raw.sports;
    if (!Array.isArray(sportValues) || sportValues.length > Object.keys(sports).length || Array.from(sportValues).some(value => typeof value !== "string" || !Object.hasOwn(sports, value))) return { error: "Choose one of the listed sports.", field: "sport-choices" };
    const budgetValue = raw.budget ?? "any";
    if (!["any", "0", "15", "30", 0, 15, 30].includes(budgetValue)) return { error: "Choose a price limit.", field: "budget" };
    const budget = budgetValue === "any" ? null : Number(budgetValue);
    if (typeof slot !== "string" || !Object.hasOwn(slots, slot)) return { error: "Choose one of the listed times.", field: "date" };
    const date = raw.date ?? "any", period = raw.period ?? "any";
    if (date !== "any" && !validDate(date)) return { error: "Choose a day from September 20–26, 2026.", field: "date" };
    if (!["any", "morning", "afternoon"].includes(period)) return { error: "Choose a time of day.", field: "period" };
    if (!Array.isArray(interests) || interests.length > 6 || Array.from(interests).some(x => typeof x !== "string" || !Object.hasOwn(categories, x))) return { error: "Choose one of the pictured interests.", field: "surprise" };
    // Remembered child choices are not effective outside their explicit parent.
    const selectedSports = interests.includes("sports") ? [...new Set(sportValues)] : [];
    if (!["any", "try", "class", "watch"].includes(format)) return { error: "Choose how you'd like to join in.", field: "format" };
    if (raw.indoor !== undefined && typeof raw.indoor !== "boolean") return { error: "Choose indoors or outdoors.", field: "setting" };
    const setting = raw.setting ?? (raw.indoor ? "indoor" : "any");
    if (!["any", "indoor", "outdoor"].includes(setting) || raw.indoor === true && setting !== "indoor") return { error: "Choose indoors or outdoors.", field: "setting" };
    return { value: { slot, date, period, ages, age, interests: [...new Set(interests)], sports: selectedSports, format, budget, setting, indoor: setting === "indoor", tokens } };
  }

  // Accept normalized requests only. Broad category/sport searches do not activate
  // hidden basketball team preferences.
  function basketballSelected(request) { return request.interests.includes("sports") && request.sports.includes("basketball"); }
  function basketballEligible(request) {
    return (!request.interests.length || request.interests.includes("sports")) &&
      (!request.sports.length || request.sports.includes("basketball"));
  }

  function validDate(date) { return typeof date === "string" && /^2026-09-2[0-6]$/.test(date); }
  function knownAges(item) { return Number.isInteger(item.minAge) && Number.isInteger(item.maxAge) && item.minAge >= 0 && item.maxAge >= item.minAge && item.maxAge <= 120; }
  function dateLabel(date) {
    return validDate(date) ? `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][Number(date.slice(-2)) - 20]}, Sep ${date.slice(-2)}` : "Date unknown";
  }

  function search(raw, fixtures = items) {
    const parsed = normalize(raw);
    if (parsed.error) return parsed;
    const request = parsed.value, slot = slots[request.slot];
    const matches = [], uncertain = [];
    const seen = new Set();
    for (const item of Array.isArray(fixtures) ? fixtures.slice(0, 1000) : []) {
      if (!item || typeof item.id !== "string" || !item.id || item.id.length > 80 || seen.has(item.id) || !Object.hasOwn(categories, item.category) || !validDate(item.date)) continue;
      if (slot.date && item.date !== slot.date || request.date !== "any" && item.date !== request.date || !Number.isInteger(item.start) || !Number.isInteger(item.end) || item.end <= item.start || item.start < slot.start || item.end > slot.end) continue;
      if (request.period === "morning" && (item.start < 0 || item.end > 720) || request.period === "afternoon" && (item.start < 720 || item.end > 1080)) continue;
      if (request.interests.length && !request.interests.includes(item.category)) continue;
      if (item.category === "sports" && request.sports.length && !request.sports.includes(item.sport)) continue;
      // Explicit Basketball discovers spectator listings, not the invented workshop.
      if (item.sport === "basketball" && basketballSelected(request) && item.format !== "watch") continue;
      if (request.format !== "any" && item.format !== request.format) continue;
      if (request.setting === "indoor" && item.indoor !== true || request.setting === "outdoor" && item.indoor !== false) continue;
      const knownAge = knownAges(item);
      const knownCost = Number.isFinite(item.cost) && item.cost >= 0;
      if (knownAge && request.ages.some(age => age < item.minAge || age > item.maxAge)) continue;
      if (request.budget !== null && knownCost && item.cost > request.budget) continue;
      const words = `${item.title} ${categories[item.category] || ""} ${Array.isArray(item.keywords) ? item.keywords.join(" ") : ""}`.toLowerCase().split(/[^a-z]+/);
      if (request.tokens.some(token => !words.includes(token))) continue;
      const reasons = [];
      if (request.ages.length && !knownAge) reasons.push("Age guidance unknown");
      if (request.budget !== null && !knownCost) reasons.push("Price unknown");
      seen.add(item.id);
      (reasons.length ? uncertain : matches).push({ item, reasons });
    }
    return { request, matches: matches.slice(0, 6), uncertain: uncertain.slice(0, Math.max(0, 6 - matches.length)) };
  }

  function summary(request) {
    return [request.slot === "week" ? week.label : `${slots[request.slot].label} · 2026 · Taipei (UTC+8)`, request.date === "any" ? "" : dateLabel(request.date),
      request.period === "any" ? "" : request.period === "morning" ? "Morning · midnight–noon" : "Afternoon · noon–6 pm",
      !request.ages.length ? "Age not checked" : `${request.ages.length === 1 ? "Age" : "Ages"} ${request.ages.join(" + ")}`,
      request.interests.length ? request.interests.map(id => categories[id]).join(" + ") : "Any interest",
      request.interests.includes("sports") ? request.sports.length ? request.sports.map(id => sports[id]).join(" + ") : "Any sport" : "",
      ({ any: "Any format", try: "Play / try it", class: "Class / workshop", watch: "Watch / attend" })[request.format],
      request.budget === null ? "Any price" : `Up to $${request.budget} USD per child`,
      ({ any: "Indoors or outdoors", indoor: "Indoors only", outdoor: "Outdoors only" })[request.setting],
      request.tokens.length ? `All keywords: ${request.tokens.join(", ")}` : ""].filter(Boolean).join(" · ");
  }

  function cardHtml(entry, request) {
    const { item, reasons } = entry;
    const theme = ["peach", "lilac", "pink", "blue", "mint", "butter"].includes(item.theme) ? item.theme : "lilac";
    const age = knownAges(item) ? `Suggested ages ${item.minAge}–${item.maxAge}` : "Age guidance unknown";
    const price = Number.isFinite(item.cost) && item.cost >= 0 ? item.cost === 0 ? "Free (invented)" : `$${item.cost} USD / child (invented)` : "Price unknown";
    const fit = reasons.length ? `Needs checking: ${reasons.join("; ")}.` : !request.ages.length ? "Age not checked." : "Illustrative age guidance covers every selected age.";
    return `<article class="activity-card ${theme}"><div class="card-art" aria-hidden="true"><span>${escapeHtml(item.emoji)}</span></div><div class="card-body"><p class="fiction-label">${escapeHtml(categories[item.category] || "Activity")}</p><h3>${escapeHtml(item.title)}</h3><p class="facts"><span aria-hidden="true">◷</span> ${escapeHtml(dateLabel(item.date))} · ${escapeHtml(item.time)}<br>${escapeHtml(age)}<br>${escapeHtml(item.venue)} · Taipei (fictional)<br>${escapeHtml(price)}</p><p class="reason">${escapeHtml(item.reason)}</p><p class="card-warning">${escapeHtml(fit)}</p><details><summary>Details<span class="sr-only"> for ${escapeHtml(item.title)}</span></summary><p>${escapeHtml(item.date)} · Asia/Taipei (UTC+8)<br>${item.indoor === true ? "Indoors" : item.indoor === false ? "Outdoors" : "Setting unknown"} · ${escapeHtml(({ try: "Play / try it", class: "Class / workshop", watch: "Watch / attend" })[item.format])}</p><p>${escapeHtml(item.source)}. All facts and venues are invented; no live source or freshness verification exists. One session; USD prices are invented, not converted or family totals.</p><p>${!request.ages.length ? "Age not checked." : "Suggested ages are guidance, not verified admission rules."} No calendars or travel were checked. Travel not checked · Spaces unknown. Timing does not prove family availability.</p></details></div></article>`;
  }

  function resultsHtml(result) {
    if (result.error) return "";
    const entries = [...result.matches, ...result.uncertain];
    if (!entries.length) return '<div class="empty-card"><span aria-hidden="true">🌱</span><h3>No ideas match.</h3><p>Try fewer filters. Only six invented activities are available here.</p><p>No online search in this section; no filters were changed for you.</p></div>';
    return result.matches.map(entry => cardHtml(entry, result.request)).join("") + (result.uncertain.length ? '<h3 class="checking-heading">Needs checking <span class="optional">Not confirmed matches for your choices</span></h3>' + result.uncertain.map(entry => cardHtml(entry, result.request)).join("") : "");
  }

  function ageRowsHtml(values = [""]) {
    return values.slice(0, maxChildren).map((value, index) => `<div class="age-row"><label class="sr-only" for="age-${index}">Age for child ${index + 1}</label><select id="age-${index}" name="ages" aria-describedby="age-note form-error"><option value="">Any</option>${Array.from({ length: 14 }, (_, i) => i + 4).map(age => `<option value="${age}"${String(value) === String(age) ? " selected" : ""}>${age}</option>`).join("")}</select><button type="button" class="age-icon" data-remove="${index}" aria-label="Remove age ${index + 1}" title="Remove age ${index + 1}"><span aria-hidden="true">×</span></button></div>`).join("");
  }
  const api = { week, maxChildren, slots, categories, sports, basketballSelected, basketballEligible, items, escapeHtml, normalize, search, summary, cardHtml, resultsHtml, ageRowsHtml, dateLabel };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ActivityPreview = Object.freeze(api);
})(typeof globalThis !== "undefined" ? globalThis : this);