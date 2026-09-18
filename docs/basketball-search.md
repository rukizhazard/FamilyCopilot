# Taiwan basketball: first public-source slice

## Category-first and team-filter update, 17 September 2026

The [implemented category/team increment](activity-discovery-teams.md) supersedes
the Basketball/Samples primary tabs and exact dates-only request restriction below.
Activities now leads with six categories and an explicit Find activities action.
Sports opens unchecked sport choices, not Basketball automatically. Only explicit
Basketball reveals **Add a preferred team** and removable **Your preferred teams**
chips. Watch/Play/Either and its intent behavior are retired: Basketball discovers
spectator listings. Anything and Sports with no chosen sport may query TPBL broadly
with Any team, ignoring hidden sport/team preferences. Non-basketball-only selections never query TPBL.
Other live sports remain unsupported. Direct shared dates and separately disclosed
fixed-September invented ideas preserve calendar independence. The workshop is
classified as Basketball and excluded from explicit Basketball and Swimming-only.
An empty list has no restriction. Add/Enter accepts bounded names without requiring
a roster or sending a query; the **福爾摩沙夢想家 (Formosa Dreamers)** shortcut adds
one preference, never replaces the list. Only preferred teams defaults on; off
means prefer-first then others. Trimmed case-insensitive exact names match actual
numeric-ID home/away teams before the first 40. No fuzzy matching, guessed IDs or
silent fallback. Optional autocomplete uses the full returned roster. Teams remain
page-only across date/category edits; reset/reload/exit clear them, with no new storage.

The local request optionally accepts paired `teamIds`/`teamMode`, at most 16 keys
in a 20,000-byte body. Ages/search text are rejected. The response carries
`tpbl-teams-v2`, normalized selection, roster and exact counts; older backend
responses fail closed. Team choices never reach TPBL. Existing two GETs,
1 MiB/600 rows, DNS/URL/deadline/Origin protections are unchanged. No new source,
live request, service restart, calendar/cache access or browser check occurred in
the Add/chip increment. Its bounded tests passed **159/159** from
**150/150** in default and America/Los_Angeles time zones; Activities labels omit Demo/Sample, with **Invented examples · Not
live listings** and **Synthetic test data** retained. Main-8002's known helper 404
is not repaired or activated by this static change.
Safe activation, isolated parent review and broader source feasibility remain open.
The following historical activation and test evidence is not validation of this update.

## Scope and current handoff, 16 September 2026

Approved: public Taiwan basketball discovery through the existing local Node
backend, on demand, without paid services, Copilot CLI, an LLM, new cloud services,
calendar queries/data/cache access or child-preference disclosure. This is an
individual local experiment, not a general event-search service or deployment.

Implemented: **Activities → Basketball games → Find games**, separate from the
existing **Sample ideas** form. When listings match, choose a game to open details
and an official game link. Selection stays in this page only. No booking, ticket
purchase, invitation, calendar write, comparison, saved profile or monitoring.
Unknown age guidance never filters out a game or becomes verified eligibility.
Sample ages/interests/prices are neither applied nor sent to basketball search.

**Ready at http://127.0.0.1:8002/activities** (localhost also works). The earlier
activation pause is resolved: concurrent calendar edits were preserved, the combined
suite passed, and the verified idle disk-backed local process was gracefully
restarted under the existing operation lock. A fresh exact-origin page/session
and `/api/status` check were used, never a calendar load or snapshot access.
The reusable [local status helper](../scripts/owner-local-status.js) prints only
bounded status/mode/storage metadata, never the page token or calendar data.
Older owner tabs need an owner-deliberate reload for a new session. The live
calendar workflow still supports only its existing September window; no Azure
change or arbitrary-range calendar approval is implied.

### Dates-only handoff

1. In **Our week**, choose start/end dates, **1–7 days inclusive**, years 2000–2100.
  Follow **Activities** in that same tab, without pressing calendar Confirm.
2. The heading and Find games request use exactly those dates in **Asia/Taipei**.
  Games must start at or after local start midnight and before the midnight
  following the selected end date. End times, travel and calendar fit are not checked.
3. Fresh Activities with no remembered selection uses the visibly labelled
  configured default, currently **20–26 September 2026**. No calendar is needed.

[The shared helper](../shared/date-selection.js) reuses the single pure
`OwnerAvailability.dateRange` validator; it does not duplicate calendar rules or
read state, cache, credentials or availability responses. The browser loads that
pure core, never the owner UI/authentication controller. Server markup supplies
only the configured default; the session selection replaces the browser heading.
The route passes `window` through `searchBasketball`, season selection, filtering
and the returned descriptor. Exact dates/timezone identify a range, not localized
`Intl` punctuation, which differs between Node and Chromium.

Only `familycopilot.dates.v1` in **sessionStorage** is read/written. Valid content
has exactly `version: 1`, `state: selected`, `startDate`, `endDate`. Invalid edits
replace it with `version: 1, state: invalid`, never hidden earlier dates. Corrupt,
oversized, unknown-version, extra-field or inaccessible storage blocks search.
Failed writes block the owner's Activities navigation rather than hand off old dates.
No names, ages, busy blocks, consent, tokens, calendar identities or results are stored.

Dates restore on owner page initialization before any confirmation or query.
Same-tab/same-origin navigation and reload retain them; independently opened tabs
do not synchronize. A duplicated/opener-created tab may inherit an initial browser
copy, but later edits remain independent. localhost and 127.0.0.1, different ports
and different browser profiles are separate origins. Browser session restore may
retain tab storage; this is not a guaranteed secure deletion mechanism.
**Reset dates** removes only this key and displays the default; it does not clear
calendar snapshots. **Start over** clears sample preferences and basketball results,
not dates. Calendar **Clear** retains its existing separate snapshot semantics.

Focus, pageshow, visibility/storage changes, game selection and response arrival
recheck the date descriptor. A changed/invalid selection aborts and advances the
generation, hides cards/source evidence and requires another deliberate Find games.
No background re-search. Existing six fictional examples retain their explicitly
labelled **20–26 September 2026** dates and never populate public-search gaps.

## Verified public sources

### TPBL: implemented JSON path

- Official [schedule](https://tpbl.basketball/schedule).
- The official frontend configuration advertises
  `https://api.tpbl.basketball/api/`. Its inspected main bundle declares
  `/seasons` and `/seasons/{id}/games`; the schedule component calls the latter.
  Discovery came from the official page and its linked frontend bundles, not a
  guessed search API or an authenticated endpoint.
- [Season metadata](https://api.tpbl.basketball/api/seasons) supplies numeric `id`,
  `name`, `started_at`, `ended_at`. Select one overlapping or next published
  season, otherwise the latest published season; disclose that limited scope.
  Never assume metadata season boundaries cover preseason games.
- Verified [2026–27 game feed](https://api.tpbl.basketball/api/seasons/3/games):
  an unpaginated JSON array of **133** rows, dates **2026-10-09–2027-05-16**.
  Fields used: `id`, `home_team.name`, `away_team.name`, `venue`, `status`,
  `game_date`, `game_time`, `gamed_at`. The frontend links the numeric game ID to
  `/schedule/{id}`. Images, scores, descriptions and ticket links are not copied.
- Times are **offset-free local clocks** in the feed and displayed as such by
  the Taiwan league frontend. The adapter interprets these as Taiwan venue time
  (UTC+8), explicitly disclosed in Details; no official UTC-offset field was
  found. Exact UTC source timestamps and event end times are not verified.
  `game_date`, `game_time` and `gamed_at` must agree and form a real date/time.
- City is not separately supplied by this feed; it remains unknown, not inferred
  from team identity. Admission, age rules, price, tickets and travel stay unknown.

**Actual adapter probe:** 16 September 2026, 07:41:55 UTC, zero selected-week
matches; `outside_coverage`, zero skipped rows. **Actual browser-to-backend query:**
07:50:03 UTC, HTTP 200, the same range/status and zero matches. This does **not**
mean no Taiwan basketball games exist that week, nor that the whole schedule is
unpublished. The retrieved season lists later games. No October game was moved
into September and no fictional game was inserted as a fallback.

**Date-handoff public check:** 16 September 2026 **08:07:03.871 UTC**, one explicit
browser-to-8002 request for **9–15 October 2026** returned HTTP 200, `results`,
**7 listings**, dates October **9 (2), 10 (3), 11 (2)**, zero skipped rows.
Returned UTC bounds were **8 October 16:00Z through 15 October 16:00Z exclusive**;
all seven cards appeared and keyboard game selection worked. The retrieved game
range remained October 9–May 16. This was a fresh diagnostic tab with chosen test
dates, not a change to the user's existing date selection. Its dates/results were
reset afterwards. No new September query, PLG query or ticket check was made.

### P. LEAGUE+: official link only

The official [schedule entry](https://pleagueofficial.com/schedule) resolves in
the web reader to the [finals schedule](https://pleagueofficial.com/schedule-finals),
showing **2025–26**, seven completed June finals games and zero upcoming entries
for that page. This does not establish September coverage. Direct Node retrieval
also failed during investigation; the reason was not established.

No reliable structured adapter or complete target-week contract was established
within this small slice. The UI permanently marks this source **Not searched**
and offers its official schedule link. It does not pretend a per-click PLG query
occurred, or label its historical finals page as a complete empty September search.

### Terms and access limits

[TPBL terms](https://tpbl.basketball/terms), especially clauses 9 and 11, reserve
intellectual-property rights and limit use to reasonable personal, noncommercial
use; broader use requires discussing licensing. The site robots response was
HTTP 200 with an empty plain-text body; API robots was HTTP 404. Neither is a
license or availability guarantee. [PLG terms](https://pleagueofficial.com/user-policy)
also reserve content rights and restrict unauthorized commercial use.

This local experiment projects only minimal attributed game facts; it does not
bulk reproduce text, images, frontend code or game feeds, or persist source data.
Production/public distribution, sustained retrieval and any commercial use need
separate source permission/legal/operational review. No authentication, CAPTCHA,
bot restriction or access denial is bypassed.

## Isolation and safety contract

- `POST /api/activities/basketball`, exact `startDate` / `endDate` JSON strings only,
  at most 128 request bytes, validated by `dateRange` before any source work.
  Missing, invalid, reversed or over-seven-day ranges, ages, URLs, free text and
  all extra fields are rejected. The earlier empty-body protocol is no longer accepted.
- Existing exact loopback Host/Origin and forwarded-header restrictions remain.
  The public route additionally requires matching Origin and JSON POST. Browser
  requests use `credentials: omit`; no owner CSRF/session/acknowledgement is used.
  Cross-site simple requests and preflights cannot invoke it; no CORS is added.
- No request on page open, mode change or input. One public search at a time per
  process, five-second minimum start spacing, no retries/background refresh.
- At most **two HTTPS GETs** per search: exact metadata path, then one validated
  numeric season path. Sole network host: `api.tpbl.basketball`, port 443.
- Redirects rejected. DNS must return only allowed public IPv4 addresses; the
  checked address is used for that connection, with normal hostname-verified TLS.
  No user URLs, credentials, cookies, tokens, private/link-local/loopback targets,
  ambient proxy use, or provider-side next-page URL following.
- JSON only, identity encoding, **1 MiB per response**, **40 seasons / 600 game
  rows**, **40 displayed matches**, **10 seconds per request / 25 total**. Browser
  timeout 35 seconds. Byte limits apply while streaming, not only Content-Length.
- Malformed/ambiguous dates, unknown game statuses and invalid identity rows are
  skipped with a source warning. Completed games are not selectable upcoming
  matches. Schema failures, redirects, 403/429 and transport failures become
  unavailable, not empty. Out-of-range published listings remain distinct from
  no matches in a retrieved range. Neither establishes all-league completeness.
- Cancel/reset/mode switch/date change/page exit abort and advance a generation so late
  responses cannot reappear. Server disconnect aborts source work. No result cache,
  preference/calendar browser storage, request logs or usage analytics was added;
  the approved dates-only key is the sole browser-storage exception.
- Text-only DOM rendering, independently validated exact HTTPS official links,
  `noopener noreferrer` and no-referrer. External content never authorizes action.
- Activity CSP now permits only same-origin connections; no direct browser
  connection to the source, model or calendar provider is allowed.
- Standalone static design preview serves the new assets but disables public
  search and explains that the local backend is required.

## Executed validation and remaining gates

### Completed date-handoff increment

- Initial combined baseline: **380 tests, 377 passed, 3 failed** while the other
  calendar session was finishing; its subsequent calendar subset passed **93/93**.
  Those pre-existing protocol-test failures were resolved by that work, not reverted.
- Final combined suite: **397/397**, separately executed in **UTC** and
  **America/Los_Angeles**, offline/deterministic. New regressions cover exact schemas,
  bounds/leap dates, invalid tombstones, storage denial, restore-before-query,
  Oct 9–15 route → adapter → games, stale responses, localized-label compatibility
  and metadata-only activation checks. No skipped or cancelled tests.
- Browser: isolated temporary 8016 server used mocked public feeds and prohibited
  calendar adapters. Owner date edits → same-tab Activities → exact dates-only POST
  returned two synthetic matching cards, with no calendar API calls. Owner inputs
  restored on return. Invalid selection blocked search; reset returned to the
  labelled default without an API call. Controls/keyboard selection and skip-link
  focus checked; measured **1279 / 319 CSS px** without horizontal overflow,
  approximately 44px minimum controls. Desktop/mobile screenshots inspected.
- Live 8002: fresh activity page rendered; one explicit public-only diagnostic
  query returned the seven attributed games above, no page errors. Keyboard
  selection/details worked and layout measured **375 CSS px** without overflow.
  No real owner calendar browser page/results were opened by browser tools.
- The idle 8002 process was identified by listener, exact command, workspace and
  process start identity, then rechecked under the local operation lock. Status
  was `idle / not_requested / live / disk`; graceful SIGTERM released the port,
  and the existing owner task started current code. No cache file was read,
  changed or deleted, no calendar/provider/Azure call or force-kill was used.
- Temporary 8016 review is stopped after checks. Existing older review processes
  are not the handoff URL and are not adopted or stopped without verified ownership.
- Parent usability, screen-reader/real-device review, PLG structured feasibility,
  source permission for broader use and dynamic live calendar scope remain separate.
  No new dependency, framework, paid/AI service, deployment, commit or push.

### Historical first public slice (superseded date and activation protocol)

- Baseline: **301/301** offline tests.
- Before concurrent range additions: **320/320** full offline tests.
- Final isolated activity set: **55/55** in **UTC** and **America/Los_Angeles**,
  including **21** new basketball adapter/HTTP/UI tests. These use synthetic
  source payloads and mocked network/provider/storage responses only.
- A later all-suite run stalled in concurrently edited calendar/date-range tests
  and was interrupted. A subsequent bounded full run completed: **336 tests,
  313 passed, 23 failed**, all failures in availability UI, owner presentation or
  date-range server tests (including the changed acknowledgement-handler seam
  and range-protocol markup assertions). No final whole-repository pass is claimed
  for the combined work. These in-progress calendar assertions were not edited
  to green as part of basketball search.
- Browser: zero startup API calls; explicit body exactly `{}` even after selecting
  a synthetic sample age; two mock game cards with selection/details/official
  links; literal injection text; partial source disclosure; no sample mixing;
  cancellation and focus restoration; sample age-8 Sports still returns one idea;
  keyboard skip/selection; measured **1118, 375 and 319 CSS px** with no overflow,
  minimum 44px controls. Desktop/mobile screenshots inspected. A primary-button
  hover-contrast conflict was found and fixed.
- Changed-file editor diagnostics and `git diff --check` passed. No final calendar
  validation, status query, cache inspection or activation was performed.
- The public-only [probe](../scripts/probe-basketball.js) uses the same adapter and
  emits only source/range/count/status metadata. It accepts no arguments.
- At that earlier handoff, date-picker integration, combined validation and safe
  activation were still open; the completed increment above supersedes those blockers.
  Parent usability/screen-reader/real-device review and PLG feasibility remain open.