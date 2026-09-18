# Latest Our week and Activities: shared entry review

## 18 September 2026

Use **http://127.0.0.1:8002/** and its **Our week / Activities** navigation.
Activities is **http://127.0.0.1:8002/activities** on that same origin.
The user requested this integration before continuing video production.

The existing shared host already routes to the same activity markup, styles,
controllers, team helper and basketball route/adapter used by the independent
8030 service. No cross-port links, proxy, CORS exception or duplicated app is
needed. The 8030 service remains unchanged and separate; its session storage
does not synchronize with 8002. Follow the in-page links in one browser tab.

## Verified without calendar or public-source queries

- Eight activity/shared assets served by **both 8002 and 8030** matched disk
  byte-for-byte. Three current calendar controller/style assets on 8002 also
  matched disk.
- Both process command lines and workspace matched their expected entry points.
  The 8002 process started after the current basketball route, adapter and team
  helper modifications. This is startup evidence, **not a fresh runtime search**.
- A fresh isolated browser on 8002 exercised keyboard navigation in both
  directions, retaining edited dates without loading calendars.
- Only the version/state/start/end date key entered session storage. Team
  preferences were page-local and cleared on exit; local storage stayed empty.
- Invalid dates returned to Our week without an older date fallback and with
  loading disabled.
- Desktop 1280px and mobile 375px navigation passed; mobile had no horizontal
  overflow. Screenshots contain only unloaded calendars and an entered team
  preference, never real calendar content or sports results.
- Every API, non-GET and external request was blocked by the review harness.
  **Zero such requests were attempted**, and zero page errors occurred.
- No service start/stop/restart, Azure access, private snapshot access, new live
  search, calendar query or video/speech generation occurred.

## Repeatable verification

[scripts/verify-shared-tabs.js](../scripts/verify-shared-tabs.js) accepts only
`--read-only`. It requires both existing services and an existing isolated
Playwright installation via `FAMILYCOPILOT_DEMO_TOOLS`; it installs nothing.
Use the browser runtime environment described in [demo-video.md](demo-video.md)
where required. It writes screenshots and a verification report into an ignored,
unique browser-artifacts subdirectory and closes its own isolated browser.
It never connects to an existing user browser profile or clicks Sync/Find/Clear.

The initial eight-file offline regression run passed **147/149**. The two
pre-existing failures expected the retired date suffix in the Our week heading.
The current [Calendar design](our-week.md#compact-calendar-controls-18-september-2026)
explicitly removes that suffix. Shared shell/date tests now assert the current
heading and actual date-input defaults without changing either feature's UI or
date contract. Final eight-file regression passed **149/149 in UTC and 149/149
in America/Los_Angeles**, with zero failures, skips or cancellations. The files
were shell, date-selection, basketball-teams, basketball-ui, quiet-week-ui,
activity-search-server, date-range-server and owner-server. Scoped whitespace
checks also passed. This was a focused regression run, not the full repository
suite.

## Remaining scope

This validates navigation and date handoff, not real calendar access, fresh TPBL
results, calendar compatibility, booking, or parent usability approval. No
backend restart is currently indicated by the inspected source/process evidence.
Video revision remains paused; the requested eventual ending is opening the
official activity website rather than demonstrating Start over.