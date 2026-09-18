(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const button = $("find"), status = $("basketball-status"), sources = $("basketball-sources"), games = $("basketball-games");
  const D = globalThis.FamilyDates, dates = D.createStore();
  const T = globalThis.BasketballTeams, form = $("activity-form");
  let week, ready = false, dateStamp, generation = 0, controller, lastChecked = null;
  let selectedTeams = [], roster = [];
  const selectedLabels = new Map();
  const preview = status.dataset.preview === "true";
  // Intl display punctuation can differ between Node and browser ICU versions.
  // Identity is the exact bounded dates/timezone, not a localized display label.
  const sameWeek = (value, expected) => value && expected && Object.keys(value).sort().join() === Object.keys(expected).sort().join()
    && typeof value.label === "string" && value.label.length <= 120
    && ["start", "end", "timezone", "firstDate", "lastDate"].every(key => value[key] === expected[key]);
  let supported = false;
  try { supported = sameWeek(JSON.parse(document.querySelector('meta[name="activity-week"]').content), D.describeWeek()); } catch { /* Static unsupported entry stays disabled. */ }
  const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  const date = value => new Date(value).toLocaleString("en-GB", { timeZone: "Asia/Taipei", hour12: false });
  const safeLink = url => typeof url === "string" && (/^https:\/\/tpbl\.basketball\/schedule(?:\/[1-9]\d{0,6})?$/.test(url) || url === "https://pleagueofficial.com/schedule");
  const link = (label, url) => {
    const element = node("a", label);
    if (safeLink(url)) { element.href = url; element.target = "_blank"; element.rel = "noopener noreferrer"; }
    return element;
  };
  const categories = () => [...form.querySelectorAll('[name="interest"]')].filter(field => field.checked).map(field => field.value);
  const choices = () => globalThis.ActivityPreview.normalize({ interests: categories(),
    sports: [...form.querySelectorAll('[name="sport"]')].filter(field => field.checked).map(field => field.value) }).value;
  const basketball = () => { const value = choices(); return !!value && globalThis.ActivityPreview.basketballSelected(value); };
  const eligible = () => { const value = choices(); return !!value && globalThis.ActivityPreview.basketballEligible(value); };
  const preference = () => basketball() && selectedTeams.length ? T.selection(selectedTeams, $("only-teams").checked ? "only" : "prefer") : T.selection([], "prefer");
  function sampleClear() { globalThis.ActivitySamples?.clear(); }
  function updateChoices() {
    // Broad search eligibility is separate from explicit category disclosure.
    $("sport-choices").hidden = !categories().includes("sports");
    $("basketball-choices").hidden = !basketball();
    $("team-controls").hidden = !basketball();
    $("only-teams").disabled = false;
  }
  function renderTeams() {
    const list = $("preferred-teams"); list.replaceChildren();
    selectedTeams.forEach((key, index) => {
      const label = T.label(selectedLabels.get(key)), chip = node("li", undefined, "preferred-team");
      const remove = node("button"); remove.type = "button";
      remove.setAttribute("aria-label", `Remove ${label}`); remove.title = `Remove ${label}`;
      const icon = node("span", "×"); icon.setAttribute("aria-hidden", "true"); remove.append(icon);
      remove.addEventListener("click", () => {
        selectedTeams = selectedTeams.filter(id => id !== key); selectedLabels.delete(key);
        invalidate("Teams changed. Choose Find activities when ready."); renderTeams();
        $("team-name").removeAttribute("aria-invalid"); $("team-status").textContent = "";
        (list.querySelectorAll("button")[Math.min(index, selectedTeams.length - 1)] || $("team-name")).focus();
      });
      chip.append(node("span", label), remove); list.append(chip);
    });
    // Optional source autocomplete, never a prerequisite or a claim of availability.
    const suggestions = $("team-suggestions"); suggestions.replaceChildren();
    for (const name of new Set(roster.map(team => T.label(team.name)))) {
      const option = node("option", name); option.value = name; suggestions.append(option);
    }
    updateChoices();
  }
  function addTeam(raw = $("team-name").value) {
    let team;
    try { team = T.preferredTeam(raw); }
    catch { $("team-status").textContent = "Enter a team name of 1–120 characters, without control characters."; $("team-name").setAttribute("aria-invalid", "true"); $("team-name").focus(); return; }
    if (selectedTeams.includes(team.key)) {
      $("team-name").value = "";
      $("team-name").removeAttribute("aria-invalid"); $("team-status").textContent = "Already in your preferred teams (ignoring case and outer spaces).";
    } else if (selectedTeams.length >= 16) {
      $("team-name").setAttribute("aria-invalid", "true"); $("team-status").textContent = "Add up to 16 teams. Remove one first.";
    } else {
      selectedTeams.push(team.key); selectedLabels.set(team.key, team.name);
      $("team-name").value = "";
      invalidate("Teams changed. Choose Find activities when ready."); renderTeams();
      $("team-name").removeAttribute("aria-invalid"); $("team-status").textContent = "";
    }
    $("team-name").focus();
  }
  function invalidate(message = "Choices changed. Choose Find activities when ready.") {
    clear(message); sampleClear(); updateChoices();
  }
  function clear(message = "") {
    generation++; controller?.abort(); controller = null; lastChecked = null;
    $("basketball-title").hidden = true;
    sources.replaceChildren(); games.replaceChildren(); games.removeAttribute("aria-busy");
    $("basketball-source-details").hidden = true; $("basketball-source-details").open = false;
    $("cancel-games").hidden = true; $("team-recovery").hidden = true; button.disabled = !ready;
    status.textContent = !ready ? "Dates unavailable. Choose valid dates in Our week." : message;
  }
  function syncDates() {
    const selection = dates.read();
    const next = selection.window ? D.describeWeek(selection.window) : null;
    const stamp = JSON.stringify({ status: selection.status, week: next });
    if (stamp === dateStamp) return false;
    const changed = dateStamp !== undefined;
    dateStamp = stamp; week = next; ready = !!week;
    document.querySelector(".shell-date").textContent = week?.label || "Choose dates";
    $("basketball-dates").textContent = week
      ? `${week.label} · Taipei (UTC+8)${selection.status === "default" ? " · Default dates" : ""}`
      : "Dates unavailable. Choose valid dates in Our week.";
    roster = []; renderTeams(); sampleClear();
    clear(changed ? "Dates changed. Earlier results discarded. Choose Find activities to search these dates." : "Choose categories, then Find activities. Nothing is loaded automatically.");
    return changed;
  }
  function stale() {
    if (lastChecked && (Date.now() - Date.parse(lastChecked) > 5 * 60000 || Date.parse(lastChecked) > Date.now() + 60000)) {
      if (!status.textContent.includes("May be out of date")) status.textContent += " Earlier search · May be out of date. Find activities again to check the source. No schedule or ticket availability established.";
    }
  }
  function render(data) {
    const applied = preference(), teamIds = applied.teamIds, onlyTeams = applied.teamMode === "only";
    if (!data || !sameWeek(data.week, week) || !Array.isArray(data.games) || data.games.length > 40 ||
      !Array.isArray(data.sources) || data.sources.length !== 2) throw new Error("unavailable");
    // Older local backends returned a pre-truncated list with no team contract.
    // Never pretend that list can be filtered completely in the browser.
    if (T.matchingContract !== "tpbl-fuzzy-v1" || data.teamMatching !== T.matchingContract ||
      data.teamContract !== T.contract || JSON.stringify(data.teamSelection) !== JSON.stringify(applied) ||
      !Array.isArray(data.availableTeams) || data.availableTeams.length > 1200) throw new Error("unavailable");
    const teamKeys = new Set();
    for (const team of data.availableTeams) {
      if (!T.validTeam(team) || teamKeys.has(team.key) || !Number.isInteger(team.gamesInRange) || team.gamesInRange < 0 || team.gamesInRange > 1200) throw new Error("unavailable");
      teamKeys.add(team.key);
    }
    const resolution = T.resolveTeams(data.availableTeams, teamIds), resolvedIds = resolution.teamIds;
    const source = data.sources[0];
    if (source.league !== "TPBL" || source.sourceUrl !== "https://tpbl.basketball/schedule" ||
      !["results", "no_matches", "outside_coverage", "partial", "unavailable"].includes(source.status)) throw new Error("unavailable");
    if (source.status !== "unavailable" && !Number.isFinite(Date.parse(source.checkedAt))) throw new Error("unavailable");
    if (["unavailable", "no_matches", "outside_coverage"].includes(source.status) && data.games.length) throw new Error("unavailable");
    if (source.status !== "unavailable" && (!Number.isInteger(source.matchedCount) || source.matchedCount < data.games.length || source.matchedCount > 600 ||
      data.games.length !== Math.min(40, source.matchedCount) || source.truncated !== (source.matchedCount > 40) ||
      !Number.isInteger(source.preferredCount) || source.preferredCount < 0 || source.preferredCount > source.matchedCount ||
      !Number.isInteger(source.eligibleCount) || source.eligibleCount < source.matchedCount || source.eligibleCount > 600)) throw new Error("unavailable");
    if (source.status === "unavailable" && data.availableTeams.length) throw new Error("unavailable");
    const boundedText = s => typeof s === "string" && s.length > 0 && s.length <= 120;
    const gameIds = new Set();
    for (const game of data.games) {
      const start = Date.parse(`${game?.date}T${game?.time}:00+08:00`);
      if (game.league !== "TPBL" || !/^tpbl-[1-9]\d{0,6}$/.test(game.id) ||
        game.sourceUrl !== `https://tpbl.basketball/schedule/${game.id.slice(5)}` ||
        !safeLink(game.sourceUrl) || !boundedText(game.home) || !boundedText(game.away) ||
        game.venue !== null && !boundedText(game.venue) || game.timezone !== "Asia/Taipei" ||
        !/^\d{4}-\d\d-\d\d$/.test(game.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(game.time) ||
        !Number.isFinite(start) || new Date(start + 8 * 3600000).toISOString().slice(0, 16) !== `${game.date}T${game.time}` ||
        start < Date.parse(week.start) || start >= Date.parse(week.end)) throw new Error("unavailable");
      for (const [key, name] of [[game.homeKey, game.home], [game.awayKey, game.away]]) {
        const team = data.availableTeams.find(team => team.key === key);
        if (!team || team.name !== name && !(T.isDreamers(team.name) && T.isDreamers(name))) throw new Error("unavailable");
      }
      if (gameIds.has(game.id) || teamIds.length && onlyTeams && !T.matches(game, resolvedIds)) throw new Error("unavailable");
      gameIds.add(game.id);
    }
    const wording = {
      results: source.truncated ? `Showing ${data.games.length} of ${source.matchedCount} games.`
        : `${data.games.length} ${data.games.length === 1 ? "game" : "games"} found.`,
      no_matches: "No matching games in the retrieved TPBL season listing. This is not an all-Taiwan search.",
      outside_coverage: "This week is outside the retrieved schedule’s published game range. No games to choose here; this does not establish that no games exist.",
      partial: `${data.games.length} listed game(s). Some source rows could not be verified and were skipped; results are incomplete.`,
      unavailable: "TPBL could not be checked. Try Find activities again, or open the official schedule. No games have been ruled out."
    };
    status.textContent = wording[source.status];
    if (data.synthetic === true) sources.append(node("p", "Synthetic test data · Not verified official events. Game IDs, venues and timestamps are fixtures; game links are not event evidence."));
    if (teamIds.length && source.status !== "unavailable") {
      if (!onlyTeams && source.preferredCount) status.textContent += " Preferred teams first.";
      if (!source.preferredCount) status.textContent += " No matching favorite-team games were verified. No alternate team was selected for you.";
    }
    const unresolved = resolution.matches.filter(match => ["ambiguous", "unmatched"].includes(match.kind));
    const unmatched = unresolved.map(match => match.key);
    if (source.status !== "unavailable") for (const match of resolution.matches) {
      if (match.kind === "fuzzy") status.textContent += ` Fuzzy match: ${T.label(selectedLabels.get(match.key))} → ${T.label(match.candidates[0].name)}.`;
      if (match.kind === "ambiguous") status.textContent += ` Ambiguous team name: ${T.label(selectedLabels.get(match.key))}. Multiple source teams could match; none was selected for this name. Add a full source name below, then Find activities again.`;
    }
    const recoverNames = basketball() && teamIds.length && source.status !== "unavailable" && (!source.preferredCount || unmatched.length);
    if (recoverNames) {
      if (unmatched.length) {
        const missing = unresolved.filter(match => match.kind === "unmatched");
        if (missing.length) status.textContent += ` No confident team-name match in the retrieved roster for: ${missing.map(match => T.label(selectedLabels.get(match.key))).join(", ")}. Choose a returned source name below, then Find activities again.`;
      } else {
        status.textContent += " Team names matched the retrieved roster, but no upcoming games for those teams were verified in these dates. Try different dates; source coverage may be incomplete.";
      }
    }
    roster = data.availableTeams; renderTeams();
    $("team-recovery").hidden = !basketball() || source.status === "unavailable" || !!data.games.length && !recoverNames;
    $("basketball-source-details").hidden = false; $("basketball-source-details").open = data.games.length === 0 || !!unmatched.length;
    lastChecked = source.checkedAt;
    const sourceRow = node("p");
    sourceRow.append(link("TPBL · View official schedule", source.sourceUrl));
    if (lastChecked) sourceRow.append(node("span", ` · Retrieved ${date(lastChecked)} (Taipei). Retrieval is not a guarantee of current listings.`));
    sources.append(sourceRow);
    if (/^\d{4}-\d{4}$/.test(source.season || "")) sources.append(node("p", `Season ${source.season}${/^\d{4}-\d\d-\d\d$/.test(source.publishedFrom || "") && /^\d{4}-\d\d-\d\d$/.test(source.publishedThrough || "") ? ` · Listed game dates: ${source.publishedFrom} to ${source.publishedThrough}` : " · No dated game range available"}.`));
    const other = node("p", "P. LEAGUE+ · Not searched here; this week’s coverage is unverified. ");
    other.append(link("View official schedule", "https://pleagueofficial.com/schedule")); sources.append(other);
    sources.append(node("p", "Partial Taiwan coverage · TPBL season listing only, not every league or special event. No invented results added."));
    if (Number.isInteger(source.skipped) && source.skipped > 0) sources.append(node("p", `${source.skipped} source row(s) could not be verified and were skipped.`));
    if (source.truncated) sources.append(node("p", "Showing the first 40 matching listings only. Open the official schedule for more."));
    if (recoverNames && unmatched.length && roster.length) {
      sources.append(node("p", "Team names returned by this search · Not suggested replacements. Add a name explicitly; existing preferences stay unchanged. Counts cover only verified rows in your selected dates, not ticket availability."));
      const actions = node("div", undefined, "game-actions"), captured = generation;
      // Only validated returned names, never a guessed alias/ID or another query.
      // Bound the recovery UI independently of the backend's filter-before40.
      const candidates = unresolved.flatMap(match => match.candidates);
      const names = [...new Set([...candidates, ...roster].map(team => T.label(team.name)))];
      if (names.length > 16) sources.append(node("p", "Showing the first 16 returned names; the team input's autocomplete contains the full retrieved roster."));
      for (const name of names.slice(0, 16)) {
        const entry = node("div"), choose = node("button", `Add ${name}`);
        choose.type = "button";
        const count = Math.max(...roster.filter(team => T.label(team.name) === name).map(team => team.gamesInRange));
        entry.append(choose, node("p", `${count} listed game(s) in your dates · Retrieved roster only`));
        choose.addEventListener("click", () => {
          if (syncDates() || captured !== generation || !basketball()) return;
          addTeam(name);
        });
        actions.append(entry);
      }
      sources.append(actions);
    }
    for (const game of data.games) {
      const card = node("article", undefined, "game-card");
      const title = `${T.label(game.away)} at ${T.label(game.home)}`;
      card.append(node("p", `${data.synthetic === true ? "Synthetic test data · TPBL fixture" : "TPBL"} · ${game.id}`, "eyebrow"), node("h3", title),
        node("p", `${game.date} · ${game.time} · Taiwan venue time (UTC+8)`), node("p", game.venue || "Venue not provided"));
      const details = node("details"); details.append(node("summary", "Details & what to check"),
        node("p", `Why listed: a Taiwan professional basketball game starting within your dates. ${T.matches(game, resolvedIds) ? "Matches a selected team, home or away." : teamIds.length ? "Another team, included because Prefer first allows others." : "Any team selected."} This is not an age-based recommendation or a calendar-fit check.`),
        node("p", "Age guidance not provided · Admission, price and ticket availability unknown · City not provided separately · End time and travel unverified. Time zone is interpreted as Taiwan venue time; the feed supplies a local clock, not a UTC offset."),
        link("View official game", game.sourceUrl));
      const choose = node("button", "Choose game"); choose.type = "button"; choose.setAttribute("aria-pressed", "false");
      choose.setAttribute("aria-label", `Choose ${title}, ${game.date} ${game.time}`);
      choose.addEventListener("click", () => {
        if (syncDates() || !ready) return;
        for (const previous of games.querySelectorAll("button")) { previous.setAttribute("aria-pressed", "false"); previous.textContent = "Choose game"; }
        choose.setAttribute("aria-pressed", "true"); choose.textContent = "Selected"; details.open = true;
        status.textContent = `Selected ${title}. Kept in this page only; nothing booked, saved or added to calendars.`;
        stale();
      });
      card.append(details, choose); games.append(card);
    }
    stale();
  }
  async function find() {
    syncDates();
    if (!ready || controller) return;
    clear();
    // A visible draft must not silently become an unrestricted/older-team query.
    // Hidden preferences still do not restrict Anything or other sports.
    if (basketball() && $("team-name").value !== "") {
      sampleClear();
      $("team-status").textContent = "Choose Add to use this team name, or clear the input before searching.";
      $("team-name").setAttribute("aria-invalid", "true");
      status.textContent = "Search not sent. Finish the team-name entry first; your preferred teams have not changed.";
      $("team-name").focus();
      return;
    }
    if (!globalThis.ActivitySamples.search()) return;
    updateChoices();
    $("basketball-title").hidden = false;
    if (preview) {
      status.textContent = "Offline preview · No live search was sent. Invented September 20–26 ideas are shown separately below, if they match your choices.";
      if (basketball()) {
        status.textContent += " This preview has no basketball game fixtures. To try other invented ideas, select Anything, then Find activities. Your choices have not been changed.";
        $("basketball-title").focus();
      }
      return;
    }
    if (!eligible()) { status.textContent = "Public search not requested for these choices. Ideas are separate below; other sports or categories were not searched."; return; }
    if (!supported) { status.textContent = "Public search unavailable: this page's date configuration is unsupported. Ideas remain separate. Ask the integrator to check the served page; no calendars need connecting."; return; }
    let requested;
    try { requested = preference(); } catch { clear("Choose valid teams again."); return; }
    clear(); const current = generation; controller = new AbortController();
    $("basketball-title").hidden = false;
    const signal = controller.signal;
    button.disabled = true; $("cancel-games").hidden = false; games.setAttribute("aria-busy", "true");
    status.textContent = "Checking the official TPBL schedule…";
    $("basketball-title").focus();
    try {
      const response = await fetch("/api/activities/basketball", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: week.firstDate, endDate: week.lastDate, ...requested }), credentials: "omit", cache: "no-store", redirect: "error", referrerPolicy: "no-referrer",
        signal: AbortSignal.any([signal, AbortSignal.timeout(35000)]) });
      syncDates();
      if (current !== generation) return;
      if (!response.ok) throw new Error(response.status === 429 ? "busy" : "unavailable");
      const data = await response.json();
      syncDates();
      if (current !== generation) return;
      render(data);
    } catch (error) {
      syncDates();
      if (current !== generation) return;
      sources.replaceChildren(); games.replaceChildren();
      roster = []; renderTeams();
      $("basketball-source-details").hidden = false; $("basketball-source-details").open = true;
      const fallback = node("p");
      fallback.append(link("TPBL · View official schedule", "https://tpbl.basketball/schedule"),
        node("span", " · "), link("P. LEAGUE+ · View official schedule", "https://pleagueofficial.com/schedule"));
      sources.append(fallback);
      status.textContent = error.message === "busy" ? "A search is already running or just finished. Wait a few seconds, then choose Find activities again."
        : "Search unavailable. No public results retained. Check the local team-filter backend version, or try Find activities again. No automatic fallback; ideas stay separate.";
    } finally {
      if (current === generation) { controller = null; button.disabled = false; $("cancel-games").hidden = true; games.removeAttribute("aria-busy"); }
    }
  }
  $("cancel-games").addEventListener("click", () => { clear("Search cancelled. Late results discarded."); button.focus(); });
  function resetTeams() {
    selectedTeams = []; selectedLabels.clear(); roster = []; $("team-name").value = ""; $("only-teams").checked = true; $("team-status").textContent = "";
    syncDates(); invalidate("A fresh start. Choices and results cleared, dates retained."); renderTeams();
  }
  function anyTeams() { selectedTeams = []; selectedLabels.clear(); $("team-status").textContent = ""; invalidate("Any team selected. Choose Find activities to search; nothing loaded automatically."); renderTeams(); }
  $("show-all-teams").addEventListener("click", () => { anyTeams(); button.focus(); });
  $("add-team").addEventListener("click", () => addTeam());
  $("team-name").addEventListener("keydown", event => {
    if (event.key !== "Enter") return;
    event.preventDefault(); event.stopPropagation();
    if (!event.isComposing) addTeam();
  });
  $("only-teams").addEventListener("change", () => invalidate());
  $("team-name").addEventListener("input", event => {
    event.stopPropagation(); invalidate(); $("team-name").removeAttribute("aria-invalid"); $("team-status").textContent = "";
  });
  $("team-name").addEventListener("change", event => event.stopPropagation());
  $("edit-preferred-teams").addEventListener("click", () => {
    invalidate("Edit your preferred teams, then Find activities. No replacement was selected automatically."); $("team-name").focus();
  });
  $("reset").addEventListener("click", () => { resetTeams(); button.focus(); });
  globalThis.ActivityDiscovery = { find, invalidate };
  globalThis.addEventListener("pagehide", resetTeams);
  globalThis.addEventListener("pageshow", event => { syncDates(); if (event.persisted) resetTeams(); });
  globalThis.addEventListener("focus", () => syncDates());
  globalThis.addEventListener("storage", event => { if (event.key === D.key || event.key === null) syncDates(); });
  document.addEventListener("visibilitychange", () => { syncDates(); stale(); });
  $("team-name").value = ""; $("only-teams").checked = true;
  syncDates(); updateChoices();
})();