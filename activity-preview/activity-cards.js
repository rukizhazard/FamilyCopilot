(function (root) {
  "use strict";
  const commonJS = typeof module !== "undefined" && module.exports;
  const contract = commonJS ? require("../shared/chat-contract") : root.FamilyChatContract;
  const assets = commonJS ? require("./chat-assets") : root.FamilyChatActivityAssets;
  const publicSnapshot = commonJS ? require("./chat-public-snapshot") : root.FamilyChatActivityFixtures;
  const statuses = Object.freeze({ results: "Outing alternatives", unknown: "Ideas to explore",
    empty: "No matching options", partial: "Ideas for your family",
    unavailable: "Sources unavailable" });

  function renderActivityCards(host, value) {
    if (!contract.validateActivityResultShape(value)) throw new Error("invalid_result");
    if (!host || !host.ownerDocument || typeof host.append !== "function") throw new Error("invalid_host");
    const result = structuredClone(value);
    const document = host.ownerDocument;
    const cleanups = [];
    let disposed = false;
    const node = (tag, className, text) => {
      const element = document.createElement(tag);
      if (className) element.className = className;
      if (text !== undefined) element.textContent = text;
      return element;
    };
    const list = (parent, texts, className) => {
      const element = node("ul", className);
      for (const text of texts) element.append(node("li", "", text));
      parent.append(element);
    };
    const sourceLink = (parent, url, label) => {
      if (url === null) return;
      const link = node("a", "fc-activity-link", label);
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      parent.append(link);
    };
    const timing = instant => {
      const label = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Taipei", month: "short", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(instant));
      const element = node("time", "", label);
      element.dateTime = instant;
      return element;
    };
    const section = node("section", "fc-activity-results");
    section.setAttribute("aria-label", "Activity alternatives");
    const summary = node("h2", "fc-activity-heading", statuses[result.status]);
    section.append(summary, node("p", "fc-activity-range",
      `${result.range.startDate} to ${result.range.endDate} / Asia/Taipei (UTC+8)`),
    node("p", "fc-activity-fit", "Calendar availability not checked"));
    const compact = result.items.length > 0 && result.sources.every(source => source.kind === "public_snapshot");
    const issueTexts = result.issues.map(issue => {
      const source = result.sources.find(entry => entry.sourceId === issue.sourceId);
      return `${source ? source.name + ": " : ""}${issue.message}`;
    });
    if (compact) section.append(node("p", "fc-activity-source", "Saved public sources / Incomplete shortlist / Availability unverified"));
    if (result.issues.length && (!compact || result.issues.some(issue => !["scope_incomplete", "candidate_limit"].includes(issue.code)))) list(section, issueTexts, "fc-activity-issues");

    function card(item) {
      const source = result.sources.find(entry => entry.sourceId === item.sourceId);
      const publicCard = source.kind === "public_snapshot";
      const visitor = publicCard ? publicSnapshot.visitorInfo?.(item) : null;
      const article = node("article", "fc-activity-card");
      article.setAttribute("data-activity-id", contract.activityCardId(item));
      article.setAttribute("aria-label", item.title);
      const media = node("div", "fc-activity-media");
      const asset = assets.resolve(item, source);
      const fallback = node("p", "fc-activity-fallback", asset?.fallback || "Image unavailable");
      const addImage = (parent, reference, placeholder) => {
        const image = node("img");
        image.alt = reference.alt;
        image.width = 800;
        image.height = 450;
        image.decoding = "async";
        placeholder.hidden = true;
        const failed = () => {
          if (disposed) return;
          image.hidden = true;
          placeholder.hidden = false;
        };
        image.addEventListener("error", failed);
        cleanups.push(() => image.removeEventListener("error", failed));
        image.src = reference.path;
        parent.append(image, placeholder);
      };
      if (asset?.matchup && item.startAt !== null) {
        const matchup = asset.matchup;
        media.className += " fc-activity-matchup";
        const panel = node("div", "fc-matchup-panel");
        const header = node("div", "fc-matchup-header");
        header.append(node("span", "fc-matchup-game", matchup.game),
          node("span", "", `${item.startAt.slice(5, 10).replace("-", "/")} / ${item.startAt.slice(11, 16)} Taipei`));
        const teams = node("div", "fc-matchup-teams");
        const team = (name, role, reference) => {
          const column = node("div", "fc-matchup-team");
          const badge = node("div", "fc-matchup-logo");
          addImage(badge, reference, node("p", "fc-activity-fallback", name));
          column.append(node("span", `fc-matchup-role fc-matchup-${role.toLowerCase()}`, role),
            badge, node("span", "fc-matchup-name", name));
          return column;
        };
        const center = node("div", "fc-matchup-center");
        center.append(node("strong", "fc-matchup-time", item.startAt.slice(11, 16)), node("span", "", "VS"));
        teams.append(team(matchup.awayName, "AWAY", { path: matchup.awayPath, alt: matchup.awayAlt }),
          center, team(matchup.homeName, "HOME", asset));
        panel.append(header, teams);
        media.append(panel);
      } else if (asset) {
        addImage(media, asset, fallback);
      } else {
        media.append(fallback);
      }
      article.append(media);
      const body = node("div", "fc-activity-body");
      body.append(node("p", "fc-activity-label", item.category),
        node("h4", "fc-activity-title", item.title));
      const schedule = node("p", "fc-activity-time");
      if (item.startAt === null) schedule.append(node("span", "", "Showtimes unverified"));
      else {
        schedule.append(timing(item.startAt));
        if (item.endAt !== null) schedule.append(node("span", "", " to "), timing(item.endAt));
        else schedule.append(node("span", "", " / End time not verified"));
      }
      body.append(schedule);
      if (!publicCard) body.append(node("p", "fc-activity-zone", "Asia/Taipei (UTC+8)"));
      body.append(
        node("p", "fc-activity-venue", visitor ? visitor.venue : `${item.venue.name || "Venue name unknown"} / ${item.venue.area}`));
      if (visitor?.format) body.append(node("p", "fc-activity-source", visitor.format));
      const primaryReason = item.rationale.find(reason => reason.text.includes("preferred team:")) || item.rationale[0];
      for (const reason of publicCard ? (primaryReason ? [primaryReason] : []) : item.rationale) body.append(node("p", "fc-activity-reason", reason.text));
      if (visitor) {
        const essentials = node("dl", "fc-activity-facts");
        essentials.append(node("dt", "", "Admission"), node("dd", "", visitor.admission),
          node("dt", "", "Price"), node("dd", "", visitor.price));
        body.append(essentials);
      }
      const facts = node("dl", "fc-activity-facts");
      const fact = (label, text) => facts.append(node("dt", "", label), node("dd", "", text));
      const age = item.ageGuidance;
      const ageUnknown = age.rule === "unknown" || age.minAge === null && age.maxAge === null;
      const guidance = age.minAge !== null && age.maxAge !== null ? `${age.minAge}-${age.maxAge}` :
        age.minAge !== null ? `${age.minAge}+` : `Up to ${age.maxAge}`;
      fact("Age guidance", ageUnknown ? "Unknown" :
        `${age.rule === "required" ? "Required" : "Recommended"}: ${guidance}${age.rule === "recommended" ? " (not an admission rule)" : ""}`);
      fact("Cost", item.cost.amount === null || item.cost.currency === null || item.cost.basis === null ? "Unknown" :
        `${item.cost.currency} ${item.cost.amount} / ${item.cost.basis === "per_child" ? "child" : "person"}`);
      fact("Travel", "Time and distance unknown; district-only origin is not routed.");
      fact("Tickets", "Availability unknown");
      fact("Setting", item.setting);
      const details = node("details", "fc-activity-details");
      details.append(node("summary", "", source.kind === "public_snapshot" && item.category === "basketball" ? "Explore basketball - game and source" : "Evidence and source"),
        node("p", "", `Source: ${item.sourceId}; event: ${item.eventId}; occurrence: ${item.occurrenceId}`));
      const supporting = publicCard ? details : body;
      supporting.append(facts, node("p", "fc-activity-source", publicCard ?
        `${source.name} / Checked ${source.retrievedAt}; saved public data, not a live search` : `${source.name} / Demo; no live retrieval`));
      list(supporting, item.unknowns, "fc-activity-unknowns");
      if (publicCard) {
        for (const reason of item.rationale.filter(reason => reason !== primaryReason)) details.append(node("p", "", reason.text));
        const actions = node("div", "fc-activity-actions");
        sourceLink(actions, item.sourceUrl, item.category === "movie" ? "Choose a showtime" : "Game details");
        if (visitor) {
          sourceLink(actions, visitor.ticketUrl, visitor.ticketLabel);
          sourceLink(actions, visitor.mapUrl, "Venue map");
          details.append(node("p", "", `Visitor information checked ${visitor.checkedOn}. ${visitor.note} Prices, stock and a route from your origin were not verified.`));
          sourceLink(details, visitor.admissionUrl, "Admission source");
          sourceLink(details, visitor.ticketSource, "Ticket-link source");
        }
        body.append(actions);
      }
      body.append(node("p", "fc-activity-fit", "Calendar availability not checked"));
      for (const entry of item.evidence) {
        const paragraph = node("p", "", `${entry.field} / ${entry.kind === "synthetic" ? "demo" : entry.kind}: ${entry.text} Source: ${entry.sourceId}. Retrieved: ${entry.retrievedAt || "unknown"}; source update: unknown.`);
        sourceLink(paragraph, entry.sourceUrl, "Evidence source");
        details.append(paragraph);
      }
      details.append(node("p", "", asset ? asset.attribution : "No permitted matching image available."));
      if (asset?.rights) {
        details.append(node("p", "", asset.rights));
        sourceLink(details, asset.sourceUrl, "Image source");
        if (asset.officialUrl) sourceLink(details, asset.officialUrl, "Official team website");
        if (asset.matchup) {
          details.append(node("p", "", asset.matchup.attribution));
          sourceLink(details, asset.matchup.sourceUrl, "Matchup and away logo source");
        }
      }
      sourceLink(details, item.sourceUrl, "Activity source");
      body.append(details);
      article.append(body);
      return article;
    }

    const groups = node("div", "fc-activity-groups");
    for (const [assessment, title] of [["candidate", "Options"], ["needs_checking", "Explore these ideas"]]) {
      const items = result.items.filter(item => item.assessment === assessment);
      if (!items.length) continue;
      const group = node("section", "fc-activity-group");
      group.setAttribute("aria-label", title);
      group.append(node("h3", "fc-activity-group-title", title));
      const grid = node("div", "fc-activity-grid");
      for (const item of items) grid.append(card(item));
      group.append(grid);
      groups.append(group);
    }
    section.append(groups);
    const sources = node("details", "fc-activity-sources");
    sources.append(node("summary", "", result.sources.some(source => source.kind === "public_snapshot") ? "Saved source scope" : "Searched fixture scope"));
    if (compact && issueTexts.length) list(sources, issueTexts, "fc-activity-issues");
    for (const source of result.sources) {
      const paragraph = node("p", "", `${source.name}: ${source.coverage.categories.join(", ")}; ` +
        `${source.coverage.range.startDate} to ${source.coverage.range.endDate} / ${source.coverage.range.timeZone}; ` +
        (source.kind === "public_snapshot" ? `${source.coverage.completeness}; saved subset checked ${source.retrievedAt}, not a live search.` :
          `${source.coverage.completeness} within demo fixtures only; no live retrieval.`));
      sourceLink(paragraph, source.url, "Source");
      sources.append(paragraph);
    }
    section.append(sources);
    host.append(section);
    return Object.freeze({ dispose() {
      if (disposed) return;
      disposed = true;
      for (const cleanup of cleanups) cleanup();
      section.remove();
    } });
  }

  const api = Object.freeze({ renderActivityCards });
  if (commonJS) module.exports = api;
  else root.FamilyChatActivities = Object.freeze({ ...root.FamilyChatActivities, ...api });
})(globalThis);
