# Chat-first integration contract v1

Published: 18 September 2026. Contract identifier: `familycopilot.chat.v1`.

## Status, inputs and authorization

**Latest approval, 18 September 2026:** the owner relayed Activities' confirmation
that **T1 and offline M1 are approved**, and requested the shared validators,
contract tests and synthetic context fixture before Activities continues its
synthetic search/reusable-card implementation. Those prerequisites are delivered
and revalidated; see [Activities handoff](#10-t1m1-approval-and-activities-handoff).
This turn delivers code/file coordination only, not a new implementation writer,
service operation, live query or runtime activation.

**Earlier scoped handoff, 18 September 2026:** the owner approved synthetic
Calendar stage 1 and requested delivery of the shared v1 contract first. The
[pure contract module](../shared/chat-contract.js),
[contract tests](../test/chat-contract.test.js) and
[non-calendar context factory](../test/fixtures/chat-context.js) are now delivered.
The owner confirmed that the existing Calendar chat is waiting for this handoff
and other writers have stopped editing its section 5 paths. That existing chat,
not a second Calendar implementation agent, receives the sole-writer handoff.
See [delivery and ownership record](#9-shared-contract-delivery-and-calendar-handoff).
That earlier stage-1-only approval did not approve T1 or stages 2/3; the later
T1/M1 approval above supersedes that coding gate only. Services remain unapproved.

The initial publication was a **documentation-only integration specification**,
not implementation or operational permission. It consolidated both owner-supplied
reviews; the following design boundaries remain:

- Calendar stage 1: single-instance mount, expand/collapse and dispose; Calendar
  renders its own source, coverage, freshness and errors. Builder receives only
  presentation controls, not calendar state or even the existing title-free bridge.
- Activities stage 2: `searchActivities(request, { signal })`, correlated bounded
  requests/results, reusable illustrated cards, no raw chat/private calendars,
  and `calendarFit: "not_checked"`. The explicit once-started scripted synthetic
  session is now approved as T1; no startup or live query is implied.
- Calendar reports that the **second Kimi Sync remains stuck/unresolved**. This
  blocks an actual calendar demonstration. It was not reproduced or diagnosed in
  this contract work; the approved synthetic work does not establish live success.

Design baseline: [current chat-first handoff](activity-search-component.md),
[04 calendar](../activity-preview/poc-storyboard/04-calendar-chat.svg),
[05 suggestions](../activity-preview/poc-storyboard/05-ai-picks.svg), and
[06 refinement](../activity-preview/poc-storyboard/06-sooner.svg).
The [product/privacy plan](parent-schedule-activity-discovery.md) and current
[Our week records](our-week.md) retain their narrow authorization boundaries.
The SVGs contain fictional schedules/listings/artwork, not evidence of capability.

### Additional visual guidance: designer concepts

On 18 September 2026 the owner supplied the nine PNG concepts under
`docs/designer` as implementation guidance. Use the
[chat composition](designer/Designer%20%288%29.png),
[navigation and status cards](designer/Designer%20%283%29.png),
[illustrated activity card](designer/Designer%20%286%29.png) and
[brand overview](designer/Designer%20%2810%29.png) as visual references:
warm off-white surfaces, dark teal navigation, green accents, softly rounded
cards, generous spacing, clear typography, friendly illustration and restrained
pastel status backgrounds. Retain text/icons alongside color, accessible contrast,
keyboard focus and responsive layouts. Use the chat-first stages above rather
than replacing them with the dashboard or adding nonfunctional navigation.

These concepts guide presentation, not authorization or source evidence. Do not
copy claims of conflict-free schedules, known ticket availability or suitability
without evidence. Reminder scheduling, registration, calendar writes/rescheduling,
background monitoring, inbox access and cross-calendar reasoning remain outside
M1. `calendarFit` stays `not_checked`. Depicted names, schools, interests and dates
are not user profile inputs. Artwork remains subject to the thumbnail provenance
rules; do not crop concept screens into purported live results. The T1/M1 approval
gates were unchanged by the visual-guidance request; the later stage-1-only
approval is recorded separately above.

This v1 replaces the integration proposals in
[Builder's v0 checklist](../.github/agents/familycopilot-builder.agent.md)
for the proposed offline milestone only. It does not override stronger active
agent instructions, provider contracts or existing live APIs. Calendar and
Activities must acknowledge this exact v1 and their file sets before coding;
their supplied reviews are not yet acknowledgement of these final details.

## 1. Roles and dependency order

| Stage | Sole responsible role | Deliverable |
| --- | --- | --- |
| 1 | [Calendar](../.github/agents/familycopilot-auth.agent.md) | Existing Our week presentation in an expandable panel, independent source lifecycle and truthful status |
| 2 | [Activities](../.github/agents/familycopilot-activities.agent.md) | Bounded search seam and evidence-based reusable illustrated cards; basketball/movie are alternatives |
| 3 and shell | [Builder](../.github/agents/familycopilot-builder.agent.md) | Shared conversation, date interpretation, request lifecycle, context retention, assembly and integration tests |

Order: owner confirms milestone/trigger → both domain owners acknowledge v1 →
Builder supplies pure contract validators and synthetic non-calendar context →
domain seams and Builder shell proceed within separate owned files → Builder
integrates → parent reviews. No agent changes another owner's files to unblock
itself. An incompatible seam is returned as a contract amendment first.
The earlier stage-1-only approval permitted the independent Calendar seam and
shared-validator prerequisite. The subsequent T1/M1 approval permits the offline
flow within these ownership boundaries; current work is the Activities handoff.

## 2. Host and Calendar presentation boundary

### Host decision

The proposed offline entry is the Builder-owned new `chat/index.html`, containing
one persistent `#calendar-host`, one conversation region and one composer. This
is a dedicated offline review surface, **not a replacement of `/` or `/activities`
and not an iframe/proxy to port 8002**. No server route, port or startup operation
is assigned by this document. Browser review uses an explicitly approved isolated
offline harness; until assigned, a review server must not be started.

Builder owns the host element's placement, not its contents. Calendar mounts its
own markup/styles/controller once inside it and reuses the existing Our week
rendering/consent/lifecycle, rather than drawing the SVG grid or pasting a screenshot.
Required legacy IDs occur only once per document. Standalone auto-bootstrap must
not also run on the chat host. Calendar owns any necessary explicit initialization
and injected synthetic-transport refactor; a `synthetic` label/meta tag alone is
not a network-isolation mechanism.

Calendar injects both a fail-closed in-memory transport and an in-memory date
store (using the existing store's injection seam). No native-fetch or real-browser-
storage fallback is allowed for mount, Sync, saved viewing, date edits, Clear or
dispose. Shared date utilities remain read-only. Contract validators cover public
interface records only; Calendar's private-shaped synthetic payloads remain in
Calendar's own validation/fixtures, not the shared chat schema.

This DOM ownership is an application data-flow restriction, not a security sandbox
against same-origin JavaScript. Builder must not read descendants, observe their
mutations, serialize them, subscribe to internal Calendar events or pass them into
messages, telemetry, Activities or a model. No external model executes in v1.

### Interface

`mountCalendar(host, { version, mode })` is synchronous and returns a frozen
controller exposing **only** `expand()`, `collapse()` and `dispose()`.

| Operation | v1 semantics |
| --- | --- |
| `mountCalendar` | `version` is `familycopilot.chat.v1`; only `mode: "synthetic"` is accepted. First mount creates one instance; the same active host/options returns that controller. A second host, changed options or disposed document is rejected with a fixed local error code. No startup query, saved-file read or storage mutation. Calendar selects its own synthetic fixture/transport internally, not from Builder-supplied event data. |
| `expand()` | Returns no data. Shows the existing body, updates accessible expansion state and preserves local data, scroll, selection and original freshness. Idempotent; no Sync, remount, lifecycle reset or new query. |
| `collapse()` | Returns no data. Hides only the body; Calendar-owned summary/status remains. If focus is inside the body, moves it to Calendar's expand control. Does not cancel an already parent-started operation, clear consent, discard data or suppress freshness/error updates. |
| `dispose()` | Returns an idempotent `Promise<void>`. Immediately fences in-flight work, hides private page state and disables controls; invokes Calendar's existing **non-destructive leave** lifecycle once, then releases listeners/timers. Never maps to explicit Clear/deletion, never retries cleanup automatically. Failure uses a fixed `calendar_cleanup_unconfirmed` code, not state/payload. Required safety status stays visible until the document leaves. |

All repeated/racing dispose calls share the same promise and terminal outcome,
including rejection. After disposal begins, expand/collapse are no-ops and cannot
remount or restore data. Cleanup must explicitly establish success; a legacy
routine resolving after catching an internal failure is not success. Failed or
unknown cleanup rejects with `calendar_cleanup_unconfirmed`. Deliberate SPA exit
keeps the Calendar safety strip on failure; pagehide cannot guarantee awaited
completion and must never be reported as confirmed cleanup without evidence.

No `getState`, result callbacks, payload-bearing lifecycle events, source IDs,
identities, source metadata, busy slots, titles, consent or raw Calendar data are
returned. The existing title-free bridge remains **internal to Calendar**. Builder
can await disposal or show a generic failure, not infer what was loaded.

### Collapsed status and disposal timing

Calendar owns a persistent heading/expand control/status strip inside the host but
outside the collapsible body. It presents source/covered dates/per-source freshness,
saved-vs-fresh provenance, loading/partial/missing/stale/revoked/cleanup failures and
other important errors with accessible text, not color alone. Details can expand,
but essential uncertainty never disappears when collapsed. Builder must not copy
this strip into conversation state. Synthetic persons remain clearly synthetic;
age 8 is an activity preference, not an identity mapping.

An in-flight parent-started synthetic Sync may complete/fail while collapsed.
Status and freshness/expiry update in the strip without focusing hidden controls,
reopening the body, moving scroll/selection or issuing another query.

Collapse, chat refinement, activity cancellation, pause, result updates and **Reset
conversation** do not dispose Calendar or change its dates. A true route/document
exit or explicit teardown of the whole chat experience disposes it. Calendar owns
`pagehide`/`pageshow` integration; Builder calls `dispose()` before a deliberate SPA
exit, but does not manufacture `pagehide` or duplicate cleanup requests. Race/repeat
calls coalesce. A bfcache-restored disposed page hides old data and requires explicit
re-entry/reload; no automatic remount, saved load or Sync.

The synthetic transport performs only in-memory fixture cleanup. Future live
embedding must preserve reviewed `reason: "leave"` behavior and independent cleanup
without deleting completed snapshots/remembered sources; it needs separate review.
Explicit Clear still means the existing destructive user action, not a synonym
for collapse, reset-chat or dispose. Sticky cleanup errors cannot be bypassed.

## 3. Shared schema and validation

v1 is dependency-free JavaScript with browser/CommonJS-compatible pure validators.
Unknown keys are rejected at every record level, not silently stripped. All IDs
below are generated local/public-activity identifiers, never calendar/provider
credentials or person IDs. Numbers must be finite; date strings must validate as
actual dates/instants. Plain text renders through text nodes, never trusted HTML.

### Validator exports (Builder produces first)

The browser/CommonJS contract exports exactly these pure functions:

- `validateDemoContext(value) -> boolean`.
- `validateActivityRequest(value) -> boolean`, including reference-relative bounds.
- `validateActivityResultShape(value) -> boolean`, structure, unique IDs, evidence
  references and status consistency, without active-request or preference checks.
- `validateActivityResult(value, request) -> boolean`, including all correlation,
  range membership, unique identity, evidence references and status consistency.
- `validateCalendarMountOptions(value) -> boolean`, only version/synthetic mode;
  never Calendar payload validation.
- `activityRequestKey(validRequest) -> string`, canonical dedup key as defined in
  section 4; invalid input throws fixed `invalid_request` with no payload.
- `activityCardId(validOccurrence) -> string`, JSON serialization of the tuple
  `[sourceId, eventId, occurrenceId]`, at most 400 characters after JSON escaping;
  invalid input throws `invalid_result`. Individual identifier bounds do not
  override this conversation-reference bound.

Validators are total for JSON-like values, return false rather than echoing input,
have no I/O, clocks, mutation or storage, and never repair invalid records.
Activities uses `invalid_request`/`invalid_result` fixed errors at its API boundary.
Builder validates requests before dispatch and results before rendering. Renderer
accepts only already request-correlated results, then independently calls
`validateActivityResultShape`; it is not the authority
for active-request acceptance. All modules use the single shared implementation.

### 3.1 DemoContext and conversation records (Builder only)

| Field | Exact v1 type / constraint |
| --- | --- |
| `version` | Literal `familycopilot.chat.v1` |
| `sessionId` | Locally generated opaque ID, ASCII `[A-Za-z0-9_-]`, 1–64 characters; no persistence |
| `contextRevision` | Positive safe integer; increment when dates or preferences change |
| `referenceNow` | RFC3339 UTC instant with `Z`; fixed `2026-09-18T04:00:00Z` for this scripted fixture, not a claim of current live time |
| `timeZone` | Literal `Asia/Taipei` |
| `mode` | Literal `synthetic`; `live` is reserved and rejected by this milestone |
| `preferences` | The exact Preferences record below |
| `activityRange` | DateRange below, independent from Calendar's selection |
| `triggerState` | `not_started`, `active`, `paused` or `ended`; not a permission token |

Conversation message: `{ id, role, kind, text, requestId, cardIds }`. `id` uses the
same local-ID bounds; `role` is `parent` or `assistant`; `kind` is `text`,
`interpretation`, `activity_results` or `status`; `text` is plain text ≤1,000
characters, `requestId` is null or a request ID, `cardIds` is ≤6 unique
`activityCardId` strings, each ≤400 characters. Parent composer input is ≤500
characters. Retain at most 20 messages
in page memory; at the limit offer explicit Reset conversation, never silently
persist. No raw input is logged, sent to Activities/model, or used as authorization.

Stage 1 adds only fixed conversation wording and mounts the panel; its event data,
status, coverage and freshness never become a message or DemoContext field.

### 3.2 DateRange and Preferences

`DateRange` has exactly `{ startDate, endDate, timeZone }`: inclusive ISO civil
dates `YYYY-MM-DD`, 1–7 days, years 2000–2100, `Asia/Taipei`. Local comparison uses
start midnight inclusive to midnight after end exclusive. Source occurrences use
explicit instants/zone; never parse an unzoned timestamp using machine timezone.

`Preferences` has exactly:

| Field | Type / meaning |
| --- | --- |
| `ages` | Exactly `[8]` for this demo; not attached to a person or calendar |
| `interests` | ≤12 unique plain-text tokens, each ≤40 characters; empty means no restriction, not all example interests confirmed |
| `interestBasis` | `demo_fixture` or `parent_confirmed`; fixture examples cannot be relabeled parent-confirmed |
| `preferredTeams` | ≤16 names, each ≤120 characters; empty by default; preserve existing validated source-name semantics rather than inventing IDs |
| `origin` | Exactly `{ area: "Xinyi District, Taipei City", precision: "district", landmark: null }`; office-area context, no exact address or inferred MRT |
| `travelMode` | null, `walk`, `transit`, `drive` or `cycle`; default null; non-null requires explicit parent choice, never fixture inference |
| `constraints` | Exactly `{ maxTravelMinutes, budget, setting, excludedCategories }`; defaults null, null, `any`, [] |

`maxTravelMinutes`: null or integer 1–180. `budget`: null or `{ amount, currency,
basis }`, where amount is 0–100000, currency three uppercase ASCII letters and
basis `per_child` or `per_person`; not a family-total claim. `setting`: `any`,
`indoor` or `outdoor`. `excludedCategories`: ≤12 unique tokens ≤40 characters.
Constraints are requirements; interests/team names are preferences. Known required
violations are excluded before ranking/limits; unknown required evidence is flagged
`needs_checking`, never a confirmed match. No silent relaxation or inferred currency.

### 3.3 Activity request

`searchActivities(request, { signal }) -> Promise<ActivityResult>` accepts exactly:

| Field | Type / meaning |
| --- | --- |
| `version` | `familycopilot.chat.v1` |
| `requestId` | New local ID, 1–64 ASCII characters as above |
| `generation` | Positive safe integer, monotonically increasing across requests/cancellation/reset within this document |
| `contextRevision` | Current positive context revision |
| `referenceNow` | The context's explicit reference instant |
| `range` | Validated DateRange |
| `mode` | `synthetic` only; reject reserved `live` with `mode_not_enabled` before any work |
| `trigger` | Exactly `{ kind, actionId }`; kind `demo_start`, `refinement_submit` or `explicit_retry`; actionId is a local ID for one explicit user action |
| `preferences` | Validated Preferences, not the full conversation/context |

`signal` is a required AbortSignal supplied out of band, not serialized. Already
aborted calls reject with `AbortError` before work. Invalid schema rejects with a
fixed `invalid_request` error; no echo of unsafe input. No raw chat, Calendar data,
tokens, consent, source handles, busy intervals or arbitrary extension objects.
Request `trigger` text is not authority: Builder must enforce the approved session
state and Activities must validate the mode/trigger values. v1 invokes only local
fixture providers. It does not alter the existing public TPBL HTTP contract or
send age/origin/preferences to public sources.

### 3.4 ActivityResult and evidence/card records

The result has exactly the following fields:

| Field | Type / meaning |
| --- | --- |
| `version`, `requestId`, `generation`, `contextRevision`, `mode`, `range` | Exact request echoes, including range/zone; Builder rejects any mismatch |
| `status` | `results`, `unknown`, `empty`, `partial` or `unavailable` |
| `sources` | ≤8 Source records; actual searched scope, not supposed category coverage |
| `items` | ≤6 validated ActivityOccurrence records, after hard filtering and ranking |
| `issues` | ≤12 `{ code, sourceId, message }`; sourceId nullable, plain message ≤240 chars |
| `calendarFit` | Literal `not_checked` for every result, regardless of loaded calendars |

Issue code is one of `source_unavailable`, `source_unsupported`, `scope_incomplete`,
`candidate_limit`, `evidence_unknown`, `no_matches`. Source IDs in issues/items/
evidence must resolve to a unique Source record; nullable references mean global
issues, not an invented source. Sources is nonempty for dispatched fixture work.
Public identifier strings exclude control characters; local request IDs retain
the stricter ASCII rule. Duplicate `activityCardId` tuples are rejected.

`Source`: `{ sourceId, name, url, kind, coverage, retrievedAt, freshness }`.
Public/synthetic sourceId ≤80 chars; name ≤120; URL null for fixtures or validated
HTTPS ≤2048. kind `synthetic` in this milestone. coverage is exactly `{ range,
categories, completeness }`, with DateRange, ≤12 category tokens and completeness
`complete`, `partial` or `unknown`. retrievedAt is nullable RFC3339 UTC; null for
unretrieved fixtures. freshness `synthetic`, `fresh`, `stale` or `unknown`; only
`synthetic` is valid for v1 fixtures. Source update time is not invented from now.

`ActivityOccurrence` has exactly:

| Fields | Type / meaning |
| --- | --- |
| `sourceId`, `eventId`, `occurrenceId` | Source reference and public/fictional identities (each ≤120 chars); the same event on different dates has different occurrenceId |
| `category`, `title`, `sourceUrl` | Category token ≤40, plain title ≤160, null or validated HTTPS source link; fixture links never imply a real listing |
| `startAt`, `endAt`, `timeZone` | Explicit RFC3339 instants with offset, end > start when known; end may be null and then time fit is unknown; IANA zone `Asia/Taipei` for v1 |
| `venue` | `{ name, area }`, nullable plain name ≤160, area ≤120 |
| `ageGuidance` | `{ minAge, maxAge, rule, evidenceId }`; nullable integer bounds 0–120, ordered when both known; rule `recommended`, `required` or `unknown`; evidenceId nullable |
| `travel` | `{ durationMinutes, distanceKm, mode, originArea, evidenceId }`; nullable finite duration 0–1440 minutes/distance 0–1000 km; mode null or Preferences travelMode enum; originArea null or text ≤120; evidenceId null or ID ≤80; no absent value becomes zero |
| `cost` | `{ amount, currency, basis, evidenceId }`; amount null or finite 0–100000, currency null or three uppercase ASCII letters, basis null or Preferences basis enum, evidenceId null or ID ≤80; unknown cost never free |
| `setting` | `indoor`, `outdoor` or `unknown` |
| `thumbnail` | null or Thumbnail record below |
| `rationale` | ≤3 `{ text, evidenceIds }`; plain text ≤240, references ≤8 existing Evidence IDs; subjective preference reasons may have an empty reference list but must not assert facts |
| `evidence` | ≤16 Evidence records |
| `unknowns` | ≤12 plain-text uncertainty statements ≤160 chars, including travel/age/availability gaps as applicable |
| `assessment` | `candidate` or `needs_checking`; neither means calendar-compatible |
| `calendarFit` | Literal `not_checked` |

`Evidence`: `{ id, field, kind, sourceId, sourceUrl, retrievedAt, sourceUpdatedAt,
text }`. id ≤80 chars, unique within item; field is `identity`, `timing`, `venue`, `age`,
`travel`, `cost`, `setting` or `thumbnail`; kind is `synthetic`, `published`,
`derived`, `estimated`, `conflicting` or `unknown`; text ≤240; URLs/timestamps
nullable as above. All evidence in this milestone is synthetic or unknown, never
published/live-verified. Every non-null evidenceId and rationale evidence reference
must resolve within the same item. age/travel/cost/thumbnail references must match
their field. Identity evidence supports title/category and public occurrence IDs;
timing/venue/setting values require matching field evidence. Non-null factual
values require synthetic evidence in M1; null/unknown values cannot support
eligibility, price-total or travel claims. Retrieved/source-updated timestamps
remain null for fixtures, rather than implying a live lookup.

`Thumbnail`: `{ assetKey, alt, sourceUrl, attribution, permission, evidenceId }`.
assetKey ≤80 references a compile-time local allowlist, not an arbitrary URL/path;
alt ≤160, attribution ≤240, sourceUrl nullable, permission `original_synthetic`,
`licensed` or `unavailable`. Only `original_synthetic` local assets are enabled in
v1; unavailable/missing/load-error renders a neutral fallback. No remote logo/poster
request, arbitrary SVG/HTML injection or unlicensed provider artwork. Local media
keys and attribution are resolved by Activities, not a calendar/model payload.

Status precedence is normative, evaluated in this order:

1. `unavailable`: all requested source work failed/unsupported, zero items,
  source-unavailable/unsupported issue and no complete-source claim.
2. `partial`: any remaining incomplete/unknown source scope or candidate cap,
  0–6 items and a corresponding issue; takes precedence over `unknown`/`empty`.
3. With all stated scopes complete: zero items is `empty` with `no_matches`;
  1–6 all-needs-checking items is `unknown`; ≥1 candidate is `results` (may also
  include separately grouped needs-checking items).

Never convert failure into empty or claim no events exist. Loading/validation/
clarification/cancelled/paused are Builder lifecycle states, not source results.
Fixture occurrence IDs and facts stay stable; no date-shifting an old event.

Assessment rules: required age exclusions are hard failures; recommended guidance
is not an admission rule and a mismatch/unknown is `needs_checking`, not silently
age-suitable. Missing age guidance, missing end time or any unknown required
constraint makes `needs_checking` mandatory. Budget comparison requires matching
currency and unit basis with evidence; no conversion or assumed adult count.
Unknown age, cost, travel, ticket availability and end time must each appear in
visible uncertainty text when applicable, even without a corresponding constraint.
Ticket availability is always unknown in M1. Travel is usable for filtering **or**
ranking only with comparable evidenced origin/mode/metric; district-only v1 origin
does not support routing or quantitative travel-limit compliance. Leave travel
numbers null rather than using the SVG's illustrative estimates to pass a limit.

### 3.5 Card renderer

`renderActivityCards(host, result) -> { dispose() }` validates the result and owns
only that result's DOM/listeners. Disposal is local listener/DOM cleanup; repeated
calls are safe. Builder disposes the old renderer before replacing that result
region. Stages 2 and 3 use this exact function and `searchActivities`, not copies.

The renderer never searches, mutates preferences, accesses Calendar, calls Sync,
writes storage or invokes adapters. Only explicit user source-link navigation is
allowed, with validated HTTPS and `noopener noreferrer`; fixture links can be
absent/disabled. Secondary evidence is expandable, but synthetic labels, essential
unknowns, exact timing and `Calendar availability not checked` remain visible.
Travel ordering is allowed only for comparable origin/mode/metric/evidence; null
or district-only/unrouted travel does not rank as fastest. Missing matching movie
or game is not filled by invention. Detail toggles cause no network request.

## 4. Dates, trigger and request lifecycle

### Date decisions

  a scripted reference). Initial activity dates are 9–11 October 2026, from the
  demo fixture, **not read from Calendar or sessionStorage**.
  window starting at the Taipei reference date: 18 September–15 October inclusive
  for this fixture. This is a local synthetic budget, not a live backend change
  or a mandatory parent-facing Look ahead setting.
  interval when end is known; boundary equality is permitted. Start must be in
  range and not earlier than referenceNow. Unknown end may appear only as
  `needs_checking` with duration/time-fit unknown. Supplied offsets must match
  `Asia/Taipei` at those instants; reject contradictory zone/offsets. Shared
  validators enforce both the 1–7-day range and the reference-relative window.
  it means that current weekend, with already-started occurrences excluded against
  referenceNow. On Sunday, clip the query's already-past Saturday to the reference
  day and display that interpretation, preserving the forward-only bound.
  In this fixture it resolves to **19–20 September 2026**. The nearer
  fixture screening is a distinct 20 September occurrence, not a relabeled October
  event. Show the interpreted range before/with the result.

- The scripted interpreter recognizes the reviewed demo sentence and this bounded
  weekend intent only, ignoring case/outer whitespace. Conflicting dates, other
  relative-date intents or unsupported input require clarification without a
  search. This is not a general natural-language model. No age/origin inference.
- Calendar owns its independent selected display dates and authorized full query
  scope. Chat date changes never call its date actions, write
  `familycopilot.dates.v1`, dispatch its input events or trigger Sync. Calendar
  date edits likewise do not silently re-search or rewrite active outing context.
- Builder receives no Calendar coverage. It always says fit is not checked; exact
  coverage is displayed only by Calendar. It must not infer or compute September
  mismatch by reading the grid/bridge. A future comparison is separately gated.

### Trigger T1: approved for offline M1

Approved action: **Start scripted demo**, explicitly labeled synthetic/scripted,
opens a page-local demo session and emits one initial `demo_start` search. Calendar
can already be visible; recommendation triggering neither depends on Sync success
nor observes Calendar state. The parent may inspect/Sync the synthetic calendar
before starting recommendations. No Find form or required category/date setup.

The initial publication did not approve execution. The later owner-relayed
T1/M1 approval in section 10 now permits this offline action and execution model.
There are no live providers, background monitors, timers that search, notifications,
startup/reload/typing searches or automatic live fallback. Real proactive AI
requires another scoped decision. The UI must not describe fixtures as live AI.

The exact approved session rules are:

1. One initial search per explicit start. Double-click, render, focus, collapse,
   rerender or repeated Start while active does not issue another request.
2. Only explicit composer submission of a resolved changed range/constraint
   creates `refinement_submit`; typing does not. Invalid/ambiguous input gives
   clarification without dispatch. Age/origin/interests otherwise stay unchanged.
3. Builder maintains one active request, an AbortController, monotonically
   increasing generation and current context revision. Before dispatch of a new
   request, hide/invalidate prior active cards, increment generation and abort
   old work. Abort is advisory; accept responses only if version, requestId,
   generation, contextRevision, mode and entire range match the active record and
   session remains active. Test A → B → A races and providers ignoring abort.
4. Deduplication key is stable canonical serialization of version/mode/referenceNow/
  range/preferences, excluding IDs, generation, contextRevision and trigger.
  Object keys are lexically sorted; primitive types/null retained. Set-like
  interest/exclusion/team arrays use sorted unique normalized tokens for key
  computation only (trim/NFC/lowercase); occurrence facts and display names are
  never rewritten. Dates are exact validated ISO strings. Same active key in
  the same context revision coalesces. A repeated unchanged submission may reuse
  only the **current** completed, non-retired acceptance record without changing
  its IDs/revision/generation; results/unknown/empty qualify, partial/unavailable
  require explicit retry. No cross-revision cache: A → B → A dispatches a fresh
  A with new correlation, not re-enveloped old facts. Reused requestId with
  differing contents is rejected. Retain at most three page-local request keys;
  no global/persistent cache.
5. Retry is explicit after error/partial/unknown/empty if requested; allocate a new
   ID/generation/actionId and bypass completed-key reuse only for `explicit_retry`.
   Do not automatically retry aborts/timeouts. v1 permits **at most three dispatched
   searches per session** (initial + refinement + one additional refinement/retry),
   at most 40 synthetic candidates and 6 returned items per search, 10-second local
   timeout, and zero provider calls. Budget counts dispatches even if cancelled.
  Examine fixture candidates in stable sourceId/eventId/occurrenceId order,
  bounded to 40; filter known hard violations before ranking and the six-item
  output limit. If the input pool exceeds 40, mark affected coverage partial and
  emit `candidate_limit`; never call the examined subset exhaustive or empty.
  Search rejects in-flight cancellation with `AbortError`. Builder owns the
  10-second timer and fixed `request_timeout` UI outcome: retire the acceptance
  record and increment generation **before** aborting/presenting timeout.
  Late success, rejection and finally handlers may not change cards, status,
  loading or dedup entries. Normal rejection likewise retires that request;
  no automatic retry. Error messages never include raw inputs/provider bodies.
6. Pause increments generation, aborts and invalidates active results; Resume does
   not search automatically and offers an explicit retry/refinement. End or Reset
   increments generation, aborts, clears messages/cards/dedup/preferences to the
   fixture, and leaves state `not_started` for a new explicit Start. Calendar is
   untouched. Do not reset the document generation counter or reuse session IDs.
7. Effects are issued by the orchestrator only, never renderer/state derivation.
   Untrusted request/result/event text cannot trigger further requests or consent.

## 5. Exact file ownership for the proposed offline milestone

**The initial publication changed only this document.** The shared contract,
its tests and non-calendar context factory are now delivered under the later
scoped approval. Other new paths below remain reservations. Existing changes must
be preserved; each owner checks actual collisions and acknowledges its exact set.
Listed paths are an upper bound, not a requirement to edit all of them. Anything
not listed is read-only for this milestone unless an explicit handoff amends v1.

| Sole writer | New paths reserved for implementation |
| --- | --- |
| Builder | `shared/chat-contract.js`; `chat/index.html`; `chat/chat.css`; `chat/ui.js`; `chat/conversation-core.js`; `test/chat-contract.test.js`; `test/chat-conversation.test.js`; `test/chat-integration.test.js`; `test/fixtures/chat-context.js` |
| Calendar | `owner/chat-calendar.js`; `owner/chat-calendar-template.js`; `owner/chat-calendar.css`; `owner/chat-calendar-fixtures.js`; `test/chat-calendar.test.js` |
| Activities | `activity-preview/chat-search.js`; `activity-preview/activity-cards.js`; `activity-preview/activity-cards.css`; `activity-preview/chat-activity-fixtures.js`; `activity-preview/chat-assets.js`; `activity-preview/chat-assets/basketball-synthetic.svg`; `activity-preview/chat-assets/movie-synthetic.svg`; `test/chat-activity-search.test.js`; `test/activity-cards.test.js` |

Calendar owns template and synthetic transport/fixtures so Builder cannot supply
or receive event objects. Its fixtures are fictional, separate from real saved
data, and never copied into shared chat context. Activities owns activity fixtures,
media manifest and cards. Builder owns shared schema validators and non-calendar
context only. All producers/consumers import the single contract validator rather
than drifting copies. Browser namespace: `FamilyChatContract`; CommonJS exports
the same pure functions. Domain browser namespaces are `FamilyChatCalendar` and
`FamilyChatActivities`; their public functions are the interfaces in this document.
Builder loads each once in dependency order after its host markup exists.

| Sole writer | Existing paths permitted only if required by the approved slice |
| --- | --- |
| Calendar | [owner/index.html](../owner/index.html), [owner/owner.css](../owner/owner.css), [owner/ui.js](../owner/ui.js), [owner/availability-ui.js](../owner/availability-ui.js), [owner/child-calendar-ui.js](../owner/child-calendar-ui.js); isolate mounting, leave lifecycle and injected synthetic transport without changing standalone semantics |
| Calendar | [test/owner-ui.test.js](../test/owner-ui.test.js), [test/availability-ui.test.js](../test/availability-ui.test.js), [test/child-calendar-ui.test.js](../test/child-calendar-ui.test.js), [test/child-sync-ui.test.js](../test/child-sync-ui.test.js), [test/our-week.test.js](../test/our-week.test.js), [test/fixtures/our-week-harness.js](../test/fixtures/our-week-harness.js); focused preservation regressions |
| Activities | [scripts/test-activity-discovery.js](../scripts/test-activity-discovery.js), solely to include its new focused suites; existing providers/forms and fixtures remain read-only for the first slice |
| Builder | This document only; existing [shell.css](../shell.css), root sample, README and product plan remain read-only in the first slice; put chat-specific styles in the new owned stylesheet |

In particular, [shared/date-selection.js](../shared/date-selection.js), pure
Calendar cores, live TPBL adapter/routes, shared server, activation scripts,
infrastructure, VS Code tasks, package/configuration, private storage and agent
definitions are **not implementation write targets** for this milestone.
If extraction needs an additional path, stop that edit and obtain an exact
single-writer amendment instead of copying an entire controller into the new seam.
Do not start services during concurrent edits or edit code belonging to an active
shared service without coordination. If this conflicts with an existing process,
pause the conflicting work and request a handoff; do not stop/restart it. This
document neither inspects process state nor authorizes any service operation.

Potential later shared route/activation changes remain Calendar's single-writer
handoff after separate approval; port 8002 and its cooperative lock are untouched.
No branch/worktree switch, stash/reset/clean, commit or push is implied.

## 6. First offline milestone and acceptance

Milestone M1: one synthetic/scripted 1 → 2 → 3 conversation. **T1 and offline
implementation approved**, as recorded in section 10; each writer still
acknowledges the exact v1 interface and file set before its implementation.
It demonstrates interaction and privacy boundaries, not real AI, live discovery,
actual calendar availability or resolution of the Kimi Sync blocker.

| Area | Required observable acceptance |
| --- | --- |
| Schema | Pure validators reject unknown keys, malformed/oversized fields, invalid dates/zones, live mode, raw chat/calendar fields, mismatch echoes and unsafe links/assets. All fixtures pass. |
| Stage 1 | Existing grid and controls with synthetic labels; one mount; collapse/reopen preserves local state/scroll/freshness and zero additional calls; independent partial/stale/missing/error states stay visible in Calendar's collapsed strip. |
| Privacy | Controller exposes only three methods, returns no calendar state; chat/request/result/storage contain no calendar fields or internal bridge payload. No DOM scraping or internal event subscription by Builder/Activities. |
| Stage 2 | After approved explicit Start, exactly one synthetic search; basketball/movie illustrated alternatives with timing, evidence, fallback, unknowns and `not_checked`. No setup form; no invented second match when fixtures/constraints do not supply one. |
| Stage 3 | Demo sentence resolves 19–20 September from the fixed reference; a distinct nearer occurrence replaces suggestions using the same search/renderer. Age 8, origin and preferences preserved. No Calendar input/storage/Sync change. Unsupported text asks clarification without searching. |
| Lifecycle | Start double-click dedup, identical query coalescing/reuse, explicit retry budget, timeout, pause/reset, A → B → A and abort-ignoring late responses cannot restore stale cards. |
| Cleanup | Collapse/reset-chat never invoke leave or Clear. True exit invokes non-destructive disposal once despite repeated calls/pagehide race; no late redraw, no snapshot/source deletion. Sticky cleanup failure is not hidden as success. |
| Evidence | Unknown travel never zero; incomparable values not ranked together; known required mismatch filtered before limit; empty/partial/unavailable distinct. Fictional media/copy cannot be described as licensed/live/AI verified. |
| Isolation | Mock providers only; provider/real API/private-file calls all zero, including startup, reload, card rendering, details, collapse and teardown. No model SDK, new dependency, service worker, analytics, profile/transcript persistence or new browser storage key. |
| Accessibility | After a separately agreed isolated browser-review setup: desktop/mobile, actual keyboard, composer labels, focus after collapse/errors/results, live announcements and non-color unknowns; report unavailable checks honestly. |

Validation plan after approval: Builder runs the three new contract/conversation/
integration suites; Calendar runs its new mount suite plus the five existing test
suites listed above (the sixth path is a fixture harness), and relevant saved-view,
date-picker/date-selection and presentation/week regressions read-only if affected;
edits to unlisted tests require an ownership amendment. Activities runs
its two new suites and the inspected bounded discovery runner. Test date logic in
UTC, Asia/Taipei and America/Los_Angeles. Use bounded focused offline runs, not the
known-hanging full suite. Record pre-existing failures separately; do not rewrite
unrelated tests. Parent usability sign-off is separate from automated success.

## 7. Open gates and publication checks

| Gate | State / owner |
| --- | --- |
| Shared contract and synthetic Calendar stage 1 | Owner approved; pure shared module delivered; existing Calendar chat receives sole-writer handoff in section 9 |
| T1 explicit scripted synthetic Start and offline M1 / stages 2–3 | Approved through the owner's Activities handoff message; this turn delivers prerequisites and hands stage 2 to the existing Activities chat, not a service activation |
| Exact v1 interfaces/file reservations | Calendar + Activities acknowledge before coding; report incompatibility rather than editing shared paths |
| Second Kimi Sync hang | Calendar-reported unresolved real-demo blocker; separate repair authorization/scope, no agent reproduction here |
| Real calendar embedding/Sync | Separate approved path and operational validation after blocker resolution; no recorded-image fake success |
| Real AI/proactive behavior | Provider/runtime/cost/tool/outbound-data/retention/trigger review required; no background or notification permission |
| Movies, wider sources, posters/logos, routing | Source/licensing and bounded live validation decisions required; Xinyi district is not a routing origin |
| Calendar-fit assessment | Separate privacy-reviewed minimum-data contract; absent here, all fit remains `not_checked` |

Existing consent, busy-only redaction, audience restrictions, snapshot preservation,
fail-closed revocation/deletion, late-writer fencing, Host/Origin/CSRF, URL/SSRF,
escaping, bounded requests and separate commit/push approvals are unchanged.
Later saved-child exceptions do not make Calendar's private data available to chat.

Initial publication validation was limited to document consistency, local link targets,
reserved-path collisions and whitespace/editor diagnostics. No product tests,
live browser/calendar reads, service probes/operations, private-file inspection,
network/provider requests, dependency installation or product implementation are
claimed for that documentation-only publication. Later scoped implementation and
offline test evidence are recorded in section 9.

Fresh read-only Calendar and Activities reviewers found no remaining blocking
contract inconsistencies after clarifying in-memory date isolation, collapsed
updates, disposal failure, validator exports, status/evidence semantics,
deduplication and timeout fencing. This is specification review only, not approval
from the owner, runtime verification or a release of another chat's file ownership.

## 8. Copyable implementation handoffs (gated)

These messages do not authorize implementation on their own. Calendar stage 1
has the separate owner approval and handoff in section 9; the owner's subsequent
T1/M1 approval and Activities prerequisite delivery are recorded in section 10.

### Calendar handoff

Read `docs/chat-integration-contract.md` v1 (`familycopilot.chat.v1`), its linked
design/04–06 and your updated agent instructions. Acknowledge the exact stage 1
interface and section 5 single-writer file list; flag any extraction conflict.
The owner has now approved this synthetic stage 1 independently; section 9 records
the prerequisite delivery and sole-writer handoff. Implement only the synthetic
single-instance Calendar seam in
Builder's `#calendar-host`: persistent Calendar-owned collapsed status, expand/
collapse without queries/remount, and idempotent non-destructive dispose on true
exit. Export presentation controls only, not calendar state or the title-free
bridge. Preserve current standalone behavior. Use Calendar-owned synthetic
fixtures/transport and focused lifecycle/privacy tests. Do not touch Builder or
Activities files, real tabs/snapshots, shared services or providers. Treat the
second Kimi Sync hang as an unresolved real-demo blocker, not part of M1 repair.
Return exact changed files, contract version, executed tests and remaining gates.

### Activities handoff

Read `docs/chat-integration-contract.md` v1 (`familycopilot.chat.v1`), its linked
design/04–06 and your updated agent instructions. Acknowledge sections 3–5's exact
request/result/card seam, bounds and single-writer file list. T1 and offline M1
are now approved, and the shared prerequisites are delivered. The existing
Activities chat may continue with `searchActivities(request, { signal })` and
`renderActivityCards(host, result)` for synthetic mode only, using shared validators
and your own activity fixtures/local original media. Reject raw chat/calendar
payloads and live mode; echo IDs/revision/range, preserve evidence/unknown/partial
states and fixed `calendarFit: "not_checked"`. Stages 2/3 reuse both interfaces;
renderer never searches, calls Calendar or writes storage. Do not change existing
TPBL/forms, shared contract/shell files or operate any service. Add focused schema,
filter/ranking, cancellation and card/fallback tests. Return exact changed files,
contract version, executed tests and remaining gates.

## 9. Shared contract delivery and Calendar handoff

### Scope and consumer entry points, 18 September 2026

The owner requested code/file handoff only, with no service operations, and
confirmed that synthetic Calendar stage 1 is approved. This delivery creates:

- [shared/chat-contract.js](../shared/chat-contract.js): all seven section 3
  functions, frozen API, browser `globalThis.FamilyChatContract` and identical
  CommonJS exports. No imports, DOM, network, storage, timers, current-clock reads,
  logging, Calendar payloads or domain globals. Validation is not authorization.
- [test/chat-contract.test.js](../test/chat-contract.test.js): 32 contract tests,
  including browser/CommonJS loading with forbidden dependencies trapped.
- [test/fixtures/chat-context.js](../test/fixtures/chat-context.js): CommonJS
  `demoContext()` and `activityRequest()` return fresh non-calendar test records.
  This is not a browser runtime, activity search pool or Calendar fixture.

Calendar loads the shared script before its own seam and calls
`FamilyChatContract.validateCalendarMountOptions(options)`. CommonJS consumers
require the shared module; both use exactly `{ version: "familycopilot.chat.v1",
mode: "synthetic" }`. The validator returns a boolean, rejects extra/missing
properties and live mode, and never inspects a DOM host. Calendar retains ownership
of host checks, lifecycle/controller invariants, fixed boundary errors and its
private-shaped synthetic validation. No shell implementation is needed to consume
this module in Calendar's isolated offline test harness.

Implementation clarifications, without enabling another stage:

- `DemoContext.referenceNow` is the fixed scripted reference. Activity requests
  accept explicit valid UTC instants and enforce the forward 28-day window;
  orchestration must keep them tied to its active context. This module supplies
  no clock, active-session authority, trigger execution or deduplication cache.
- Strict uppercase `T`/`Z` timestamps and `+08:00` occurrence offsets are used.
  Invalid Gregorian dates, rollover and leap-second notation are rejected.
  Fractional seconds are compared without rounding away submillisecond boundaries.
- A single known age bound is open-ended; both absent or rule `unknown` means age
  guidance unknown. Producer evidence/prose must not reinterpret a missing bound
  as proof of an admission policy.
- A failed/unsupported source cannot supply cards merely because another source
  completed. Scope issues, source references and status precedence are validated.
- Thumbnail `assetKey` is a 1–80 character ASCII `[A-Za-z0-9_-]` symbolic key.
  Activities still owns compile-time allowlist membership and fallback rendering.
  `unavailable` permits only a neutral fallback and a matching thumbnail evidence
  reference (which may be unknown); `licensed` remains disabled. Only
  `original_synthetic` with synthetic evidence can enable an allowlisted image.
- The serialized card-ID tuple must fit the existing 400-character message
  reference bound after escaping, as well as each identifier's own bound.
- Validators enforce structured references, bounds and uncertainty flags; they
  do not prove source truth, inspect natural-language claims or confirm that every
  required gap is described in prose. Activities tests/rendering must ensure
  those disclosures and text-node rendering. HTTPS validation is link validation,
  not SSRF protection or permission to fetch. No fetcher exists in this module.
- Ordinary JSON-like records/arrays are accepted, including cross-realm values.
  Accessors, hidden/symbol extras, custom prototypes and sparse arrays are rejected
  without calling input getters. Arbitrary JavaScript Proxies are not JSON data;
  reflection can invoke proxy traps, so this is not a hostile-code sandbox.

### Sole-writer release

The owner explicitly confirmed in this Builder conversation that the existing
Calendar chat is waiting for delivery and other writers have stopped editing the
section 5 Calendar paths. **The existing Calendar chat is now the sole writer**
for its five reserved new paths and eleven existing paths already enumerated in
section 5, within the approved synthetic stage 1 scope. No extra path is released.
Builder and its delegates do not write those paths. No new Calendar implementation
agent was started; the delegated Calendar check was read-only interface review.

All eleven existing Calendar code/test/fixture files were SHA256-compared before
and after delivery and remained byte-identical. Existing uncommitted changes in
[owner/child-calendar-ui.js](../owner/child-calendar-ui.js) and
[test/child-sync-ui.test.js](../test/child-sync-ui.test.js) were preserved, not
reverted or treated as new work by Builder. Preserve the other pre-existing
diagnostic/backend changes too; they do not expand this handoff's file list.

This confirms coordination based on the owner's explicit statement and that this
delivery did not change Calendar files. Stable hashes are **not** a filesystem
lock or proof that another independent chat cannot resume. Any later writer or
unexpected file drift requires stopping the conflicting edit and coordinating
again. Shared-service state was not probed. Existing service coordination rules
remain in force; this handoff grants no start/stop/restart, live query or activation.

### Executed validation and remaining scope

- Before edits: `node --test test/app.test.js test/date-selection.test.js`,
  **60 passed, 0 failed**.
- Three new regression cases first reproduced acceptance of failed-source cards,
  rejection of unavailable thumbnail fallback and oversized escaped card IDs:
  **29 passed, 3 failed** before the fixes.
- Final `node --test test/chat-contract.test.js test/date-selection.test.js
  test/app.test.js`: **92 passed, 0 failed in each of UTC, Asia/Taipei and
  America/Los_Angeles**. This includes 32 new contract tests. No full suite run.
- Editor diagnostics and scoped whitespace checks passed. Read-only Calendar
  review found no shared-interface blocker; this is not another chat's lifecycle
  acceptance or evidence of an implemented mount.

Calendar continues its own implementation after this handoff, rereading the
section 5 limits and preserving standalone semantics. No Calendar implementation,
browser/parent usability validation, real Sync, private-data inspection, service
operation, provider call, dependency installation, commit or push occurred here.
At that stage-1 handoff, T1/stages 2/3 and full M1 were still gated; section 10
records their later offline approval. Service/browser-review setup remains
separately gated. The second Kimi Sync blocker is not repaired by this delivery.

## 10. T1/M1 approval and Activities handoff

### Latest owner-relayed approval, 18 September 2026

The owner relayed Activities' statement that T1/M1 is approved and asked Builder
to deliver the v1 validators, contract tests and synthetic context fixture first,
then hand off synthetic search and reusable cards to Activities. This record
supersedes the earlier T1/M1-pending coding status, not the operational/privacy
boundaries. No service start/stop/restart, live source, private calendar access,
storage, real AI, deployment, commit or push is approved by this handoff.

### Delivered prerequisites

- [shared/chat-contract.js](../shared/chat-contract.js): frozen
  `FamilyChatContract` browser namespace and matching CommonJS exports:
  `validateDemoContext`, `validateActivityRequest`, `validateActivityResultShape`,
  `validateActivityResult`, `validateCalendarMountOptions`, `activityRequestKey`
  and `activityCardId`. Consume this implementation, do not fork its validators.
- [test/chat-contract.test.js](../test/chat-contract.test.js): the shared contract
  regression suite, including mode/correlation/date/evidence/status/URL/identity
  checks, canonical keys and side-effect isolation.
- [test/fixtures/chat-context.js](../test/fixtures/chat-context.js): fresh
  `demoContext()` / `activityRequest()` factories, synthetic only, one age 8,
  Xinyi district, no travel-mode assumption and no Calendar data. Context uses
  fixed `2026-09-18T04:00:00Z` and initial activity dates 9–11 October 2026.
  Tests may derive a fresh 19–20 September request with new correlation values;
  do not shift October occurrences into September. These are CommonJS test
  factories, not a persistent profile or runtime session-ID allocator.

All three prerequisite files are unchanged in this follow-up. Activities owns its
separate occurrence pool and local media; Builder's context is not an activity
provider. Search validates the request and request-correlated result; cards call
`validateActivityResultShape` without reconstructing a request from the result.
The shared module does not implement search, cancellation, dedup caching or any UI.

### File handoff and implementation acceptance

The **existing Activities chat** receives the sole-writer assignment for its
nine reserved paths in section 5, plus only the permitted suite-inclusion edit to
[scripts/test-activity-discovery.js](../scripts/test-activity-discovery.js).
Builder retains the shared module/tests/context and this contract; Calendar keeps
its existing assignment. No additional Activities implementation writer is
launched from this Builder conversation. Preflight found all nine new Activities
paths absent and no Git modification of its existing runner. These observations
are not a lock on independent chats: the receiving writer must acknowledge v1,
the exact file list and any newly discovered collision before editing.

Implement only `searchActivities(request, { signal })` and
`renderActivityCards(host, result)` for synthetic mode, with focused offline tests
and designer-guided cards. Required behavior remains sections 3–4 and 6:

- Required out-of-band abort signal; reject aborted/malformed/live requests before
  work. Return exact correlation echoes; retain distinct unavailable/partial/
  unknown/empty/results, fixed occurrences, field-matched evidence and visible gaps.
- Deterministic bounded search: at most 40 examined candidates / 6 cards; required
  violations filtered before ranking; over-cap scope becomes partial. Never invent
  a second suggestion, a nearer game, travel numbers or calendar compatibility.
- Reuse the same renderer for stages 2/3; local allowlisted original synthetic
  assets only, truthful provenance and fallback, safe text/links, no renderer
  search/storage/Calendar access. All `calendarFit` values stay `not_checked`.
- T1 execution, the composer, generation fencing and the 10-second timeout remain
  Builder orchestration responsibilities, not new Activities triggers or timers.
  No raw chat/Calendar data reaches search. Existing TPBL/forms/services stay intact.

Return exact files changed, executed test results and any contract incompatibility
to Builder. Do not change shared validators or another owner's files to unblock
the implementation. No review port or service startup is assigned here.

### Revalidation in this handoff

`node --test test/chat-contract.test.js` passed **32/32 separately in UTC,
Asia/Taipei and America/Los_Angeles**, with zero failures/cancellations/skips.
All seven exports and both fresh fixture factories were checked; default context
and request pass their validators. Earlier combined 92-per-timezone results in
section 9 are historical, not a newly repeated combined run. Only this contract
document is edited in this follow-up; Activities implementation remains with its
existing chat. There were no service operations or browser/live-data checks.