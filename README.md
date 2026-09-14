# FamilyCopilot
Family Copilot is an AI Chief of Staff for families. It understands what matters across school, work, activities, and personal interests, then proactively coordinates schedules, resolves conflicts, and helps families make better decisions before important moments are missed.。

## Static UX prototype (sample data only)

Open [`index.html`](index.html) directly in a browser, or serve this directory with an ordinary static server, for example `python3 -m http.server 8000`, then visit `http://localhost:8000`. No deployment is provided or implied.

The mobile-friendly prototype has three walkthroughs: **Our weekend** shows synthetic, privacy-redacted schedule context; **Find an activity** filters bundled mock science, concert, and exhibition cards; and **Check an event** assesses only preset local mock pages. **Sample calendar settings** demonstrates selection, disclosure, guardian attestation, confirmation-gated sample loading, and session-only management controls.

Use **Demo state controls** to show loading, empty, no-calendar, partial, stale, conflict, revoked, unavailable, and unsupported-child-account wording. Reset removes all session state. It has no backend, persistence, network access, OAuth, live calendar/search/page extraction, analytics, or real URLs/family data. It is ready for ordinary static hosting but is not deployed.

Run lightweight tests with `node --test test/app.test.js`.

### Parent review checklist

- Can you find a plausible sample outing and understand its suitability?
- Can you inspect its local mock provenance and recognize travel/tickets as unverified?
- Can you identify the exact checked/missing calendar context and uncertainty?
- Is it clear that this is sample-only and cannot book, buy, monitor, notify, or verify live information?

This prototype does **not** approve production integrations, establish parent usability validation, or establish child-account/provider feasibility. Those planning gates remain open.

## Planning

- [Parent-facing schedule and activity discovery](docs/parent-schedule-activity-discovery.md)
