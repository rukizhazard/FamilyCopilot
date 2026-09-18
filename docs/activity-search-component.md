# Chat-first family demo: design and three-conversation plan

## Current design handoff, 18 September 2026

**Read this section first.** It captures the parent's latest design discussion
so Builder, Calendar and Activities do not need the originating chat history.
The new direction is a single cute conversation: show the existing calendar,
let AI proactively suggest outings, then refine them conversationally.
The three agents own **three demo conversation stages**, not three separate apps
or merely frontend/backend technical layers.

Status: design direction and requested planning handoff, not an implemented
chat/AI integration. This document does not change active agent permissions,
provider consent, storage, live-query or service-operation authorization.
The older form-first plans below remain historical context. This section
supersedes their UX direction for the proposed demo, not the running product's
contracts or the [product/privacy plan](parent-schedule-activity-discovery.md).
Builder must reconcile conflicting product rules explicitly before implementation.

### Visual reference and reading order

| Stage | Current reference | Intended demonstration |
| --- | --- | --- |
| 1. See the calendar | [04: Calendar in chat](../activity-preview/poc-storyboard/04-calendar-chat.svg) | Keep and expand Our week; demonstrate actual authorized Sync results and freshness. |
| 2. AI brings ideas | [05: Proactive illustrated picks](../activity-preview/poc-storyboard/05-ai-picks.svg) | AI speaks first with basketball and movie alternatives, without a Find form. |
| 3. Ask for sooner | [06: Conversational refinement](../activity-preview/poc-storyboard/06-sooner.svg) | The parent changes the proposed dates in ordinary language; recommendations update in the same conversation. |

Images 01–03 are superseded design iterations, retained for comparison. Images
04–06 are static SVG concepts, not functional UI, real schedules, real listings,
provider logos, a working AI model or proof of background discovery. Their
fictional names, dates, guidance, transport estimates and artwork are placeholders.
The sample calendar is a placement sketch: reuse the existing calendar UI rather
than replacing it with the drawing's simplified grid or generic person labels.

### Parent-confirmed design requirements

1. **Do not abandon Calendar.** Start the demo by proving that the existing UI
	 loads real authorized data. Show actual source, covered dates and last update;
	 distinguish a saved view from a fresh provider load. Preserve current Sync,
	 consent, disclosure, errors and actual identities. No fake successful load.
2. **One chat-first surface, not Calendar/Activities tabs.** Keep the current
	 cute cream/lilac/peach palette, rounded cards, friendly sun and short English
	 UI copy. Calendar remains available as an expandable/collapsible panel within
	 the experience. Use structured cards and a visible message composer, not walls
	 of chat prose or a separate chat application.
3. **One child, age 8.** Do not retain the first sketch's second child or age 12.
	 This demo preference does not rename, infer or authorize any calendar identity.
4. **No Look ahead setup.** AI proposes useful dates. The parent can say the
	 dates are too far away and ask for nearer dates as part of the demo. An
	 internal bounded discovery window is still required, but is not a mandatory
	 parent-facing horizon setting or permission for unlimited searches.
5. **Interests are broad.** Include more than basketball and movies: sports,
	 science, arts/making, nature, music and exhibitions are example categories,
	 not an exhaustive set or confirmed preferences for every category. Basketball
	 and movie are the AI's two demo suggestions, not required user-selected filters.
	 Preferences can be prepared before the demo; persistence is not yet decided.
6. **Starting area: office in Xinyi District, Taipei City.** Show distance or
	 travel time and support relevant ordering. An exact public landmark/nearby MRT,
	 travel mode and any travel limit remain to be confirmed; do not assume a full
	 address, City Hall MRT, transit or 45 minutes from earlier sample copy.
7. **Use thumbnails.** Basketball cards should have corresponding team logos
	 and movie cards a corresponding poster when permitted assets are available.
	 Preserve source identity/attribution and provide a graceful unavailable-image
	 fallback. Current original badges/poster are fictional, not production assets.
8. **Proactive first, conversational second.** The main activity demo must not
	 require selecting dates/categories or pressing Find to obtain the first
	 suggestions. The optional refinement composer follows those suggestions.
	 A precise opt-in trigger and execution model still need agreement; merely
	 showing hardcoded cards is not proof of proactive AI or background monitoring.

### Three demo conversations and acceptance

**Conversation 1 — Calendar (formerly Auth), existing calendar proof**

- Entry: a request such as “Let's take a look at our week.”
- Present the existing Our week UI in the shared experience. Parent-operated
	Sync retains its current access controls. Calendar stays accessible after
	collapse; collapsing/reopening must not trigger another query or lose data.
- Acceptance: actual source, coverage, freshness and partial/missing states stay
	truthful. No private content is transferred to chat/AI just because the UI is
	embedded. First implementation review uses synthetic data; real demonstration
	uses only the separately authorized existing calendar path.

**Conversation 2 — Activities, AI-initiated outing suggestions**

- Entry: an explicitly agreed demo/product trigger, not another parent search
	form. AI introduces two possible outings with a short explanation.
- Show basketball and movie cards as alternatives, not an automatically combined
	itinerary. Include thumbnail, exact occurrence date/time/zone, venue/area,
	evidence-based travel/distance, age guidance, rationale and source/freshness.
	Keep secondary evidence in details; essential uncertainty remains visible.
- Acceptance: age 8 and the Xinyi context are preserved; broader interests remain
	possible. Filter known hard constraints before ranking/truncation. Order using
	comparable evidenced travel values where available; unknown travel is not zero.
	Do not fabricate a second match, silently relax constraints, or claim calendar
	compatibility when it has not been checked. Export reusable card/search seams
	for conversation 3, not a second standalone chat shell.

**Conversation 3 — Builder, refinement and shared integration**

- Entry: “October feels too far away. How about this weekend?”
- Resolve the date request against an explicit reference date and Taipei time,
	show the interpreted dates naturally, and preserve age, origin and other
	preferences. Ask for clarification only if materially ambiguous.
- Reuse conversation 2's search/card components and update the same conversation.
	Cancel/fence outdated requests. No reset-and-refill form or duplicated adapter.
- Acceptance: actual dates change, rather than relabeling old events. A date
	outside loaded calendar coverage has unknown fit, never inferred free time.
	In the drawing, September 20 is outside the October 9–15 sample window; those
	dates illustrate the gap, not a new live calendar authorization. A lack of a
	nearer verified game does not justify inventing one.

### Ownership and proposed shared contracts

Calendar owns stage 1's calendar internals. Activities owns stage 2's activity
components and public discovery. Builder owns stage 3, the shared chat shell,
conversation orchestration and final integration. Stage ownership does not
authorize cross-module writes: agree one writer for each shared path first.
In particular, Calendar owns existing owner markup/controllers/styles; Builder
coordinates any embedding changes rather than editing those files concurrently.
Activities does not add calendar comparison, operate port 8002 or receive raw
calendar data under this plan.

Builder should publish a versioned integration contract before parallel coding.
The following is a checklist to finalize, **not an existing API**:

| Contract | Minimum design decisions | Responsible parties |
| --- | --- | --- |
| Demo context | One age, broad interests, origin precision, explicit reference date/time zone; page-local fixture vs approved retained preferences | Builder coordinates; all consume |
| Calendar presentation | Mount/expand/collapse ownership; covered range, per-source freshness and partial/unknown status; no raw event payload by default | Calendar produces; Builder embeds |
| Activity request | Context revision, bounded proposed dates, explicit constraints, cancellation, synthetic/live mode; no private calendar data to public sources | Activities proposes; Builder consumes |
| Activity result/card | Exact source/occurrence identity, timing, thumbnail attribution/permission, age evidence, travel evidence, unknowns and error/partial/empty states | Activities produces; Builder reuses |
| Conversation lifecycle | Initiation trigger, typed messages/card references, request generation, refinement/reset, stale-result fencing and no duplicate provider calls | Builder owns |
| Future calendar assessment | Separately approved minimal comparison inputs/output, exact checked coverage/freshness and unknown/conflict states; no automatic model disclosure | Calendar and Builder; separate privacy review |

Separate conversations do not isolate files or services and do not automatically
share decisions. Each handoff must name the exact files, contract version, tests,
remaining limitations and any operation still requiring approval. Use agreed
independent worktrees only if requested; do not switch the shared branch, copy
worktrees or overwrite unrelated edits as part of this handoff.

### Delivery sequence

1. **Builder reads this design and 04–06, then updates the three agent definitions
	 only.** Map the stages above, retain operational/privacy limits, and flag
	 conflicts requiring a scoped decision. Inspect existing changes/ownership first.
	 Agent files are [Builder](../.github/agents/familycopilot-builder.agent.md),
	 [Calendar](../.github/agents/familycopilot-auth.agent.md) (filename retains Auth),
	 and [Activities](../.github/agents/familycopilot-activities.agent.md).
	 Do not run services or implement the product during that instructions-only step.
2. **Agents reread and acknowledge the plan.** Verify that each session actually
	 has the intended role instructions; if still stale, start a new conversation
	 with the relevant agent and a concise handoff. Reading a file does not itself
	 override stronger active instructions.
3. **Builder publishes contracts, exact file ownership and bounded milestones.**
	 Other agents review their seams before implementation. Resolve where shared
	 fixtures and styles live and who writes each one. This document remains the
	 design baseline; Builder's integration contract must link back to it.
4. **Implement the offline vertical slices in parallel where ownership permits.**
	 Calendar exposes the existing presentation seam, Activities implements reusable
	 illustrated cards/results, Builder implements the shell and refinement flow.
	 Fixtures are visibly synthetic; scripted language handling is labeled scripted.
5. **Builder integrates; parent reviews the entire 1 → 2 → 3 flow.** Test desktop,
	 mobile, actual keyboard/focus, failure/partial/unknown states, context retention,
	 cancellation and zero unintended startup/provider calls. Use focused offline
	 suites; do not substitute the known-hanging full suite. This milestone proves
	 interaction, not real AI, live movie discovery or schedule compatibility.
6. **Complete separately agreed real capability increments.** Select the model,
	 safe tool orchestration, movie/image/routing sources, authorized calendar-fit
	 path and proactive trigger. Then validate bounded live behavior only with fresh
	 applicable approvals. Final demo distinguishes the real calendar proof from
	 any still-synthetic recommendation capability.

### Open decisions and unchanged safety boundaries

- **Proactive model:** an opt-in in-session opportunity, a staged demo trigger,
	scheduled monitoring and external notifications are different scopes. The parent
	wants proactive suggestions; frequency, pause behavior, deduplication, search
	bounds and background execution are not yet specified or authorized here.
- **Real AI:** choose runtime/provider, cost, allowed tools, input minimization,
	outbound data and retention. No secret/model setup is implied by the SVGs.
- **Additional sources:** TPBL is the existing bounded public adapter. Movie
	showtimes/posters, wider categories, licensed images and routing need source
	decisions; a broad interests UI is not evidence of broad live source coverage.
- **Dates:** no horizon setting does not remove existing backend limits. Current
	dates-only storage and calendar coverage remain unchanged until an explicit
	integration milestone handles the new contract. Never silently broaden reads.
- **Privacy/storage:** preconfigured preferences do not imply persistent child
	profiles or model access to calendar details. Existing dates-only sessionStorage
	remains the browser storage boundary. No names, birth dates, school/home address,
	analytics or new retained chat/profile data are added by this plan.
- **Operations:** no bookings, purchases, registration or calendar writes. No
	agent-run live query, service restart, provider/permission/cloud change, new
	dependency or deployment is authorized by a design or instruction update.
	Preserve Host/Origin, URL/SSRF, escaping, bounded requests and late-response
	safeguards. Commit and push require separate exact-diff approvals.

### Planning handoff record

This increment edits only this document; other chats' calendar changes, the
existing UX record and all six SVGs are preserved. Agent definitions and central
README/product plan are read-only here. No runtime/API contract changed, process
started/stopped/revalidated, real browser/calendar inspected or live source queried.
No restart is needed for this documentation change.

Validation: `node scripts/test-activity-discovery.js` before and after: 206 total,
205 passed, one existing shared-calendar shell timezone assertion failure, exit 1.
Relative Markdown file targets exist; scoped `git diff --check` and editor
diagnostics passed. No UI/browser, actual AI or live capability validation is
claimed for this documentation-only increment.

## Historical available-slot and form-first plan

The sections below preserve previous proposals and dated implementation records.
They are not the new chat-first demo specification or current runtime evidence.

## Current approved category/team increment, 17 September 2026

The [implemented discovery increment](activity-discovery-teams.md) now leads with
six categories, not source-mode tabs. Sports opens six unchecked icons in order:
🏀 🏓 ⚾ ⚽ 🏸 🏊. Explicit Basketball discovers spectator listings and reveals
**Add a preferred team** plus **Your preferred teams** removable chips, not
Watch/Play/Either or a required roster. Add/Enter accepts up to 16 bounded names
without searching; matching trims outer spaces and ignores case, never fuzzy
matches or guesses source IDs. The bilingual Dreamers shortcut adds one preference.
Only preferred teams defaults on, with prefer-first optional and no restriction
for an empty list. Exact source-name matching (including numeric-ID teams) happens
before 40. Previously added means this page only; dates/category edits retain the
list, reset/reload/exit clear it. No new persistence.
Anything/all-sports ignore hidden favorites and may query TPBL; non-basketball-only
choices make zero public requests. Explicit Basketball excludes the invented
workshop; other fixed-September ideas remain independent. No other live source,
general free-text research or calendar availability comparison is implied.
This increment passed **159/159** focused offline tests (baseline **150/150**) in
default and America/Los_Angeles time zones; no live requests, service activation
or browser validation were performed. Activities copy omits Demo/Sample while retaining **Invented
examples · Not live listings** and **Synthetic test data** disclosures.
The older handoff blockers and mode descriptions below are historical; broader
slot/age/travel/source and calendar-comparison proposals remain unimplemented.

## Approved narrow basketball increment, 16 September 2026

The parent subsequently approved public Taiwan basketball discovery through the
existing local backend, without paid/AI services, CLI installation, cloud work,
calendar access or child-preference transfer. The first implemented source is
TPBL's official structured season/game feed; P. LEAGUE+ remains an explicitly
unsearched official link. Real and sample modes do not mix. Exact scope, verified
source contracts and browser/test evidence are in [the basketball record](basketball-search.md).

The adapter and rendered descriptor share the configured owner-window constant.
Concurrent calendar date-picker edits are preserved but are not handed off to
activity search. This integration and coordinated activation remain blocked;
the isolated review uses September 20–26. Actual public search yielded zero
matches with `outside_coverage`, not a claim of no games. The proposal below
remains broader than the approved/implemented slice.

## Status and outcome

Planning draft, 15 September 2026. The parent requested planning for a separate component that searches online for activities using an available time slot, age, and interests or free-text preferences. This authorizes planning, not live search integration, deployment, paid services, persistence, or calendar import.

**Outcome:** A parent supplies or selects a time window, describes the intended participants and interests, and receives a short, sourced list explaining what fits, what does not, and what remains unknown. Discovery works without connecting a calendar.

This component extends the [product and privacy plan](parent-schedule-activity-discovery.md#activity-discovery-and-event-assessment). Existing Microsoft picker and invitation approvals do not authorize an activity-search service. Calendar-provider feasibility is not a dependency for manually entered slots.

### Current facts versus proposed work

- [The demo](../app.js) currently filters three fictional science/concert/exhibition cards by exact age-band label, category, date, and budget. The area field does not filter. There is no online search or general free-text understanding.
- Activity times are embedded in titles rather than normalized start/end fields. Cards reuse a schedule-context message; they do not establish per-activity slot fit.
- [Existing tests](../test/app.test.js) cover fixture filtering, calendar independence, URL schemes and escaping. Those helpers are useful seams, not proof of live-search safety or time/age matching.
- Proposed priorities: (1) clarify the request and slot contract, (2) test explainable matching against richer synthetic fixtures, (3) investigate source feasibility, then (4) implement one explicitly approved live source path.

## Recommended input: structured choices plus optional free text

Use a small form with interest chips and an optional **Anything else?** field. Do not make parents compose a prompt, and do not force every preference into a fixed taxonomy. A natural-language request can populate the same form, but uncertain or conflicting interpretations must be reviewed, not silently applied.

| Input | Proposed behavior |
| --- | --- |
| Available slot | Prefill start, end and IANA time zone from the calling screen; all remain editable. Manual entry is equally supported. Clarify that the window includes getting there and back, with unknown travel explicitly unresolved. |
| Participant ages | Optional ages in completed years or a range, entered for this request only. Explain that omitting age prevents age-specific checks. Multiple ages need no names or persistent participant identities. Never ask for birth dates. |
| Interests | Multi-select **Sports**, **Music**, **Science**, **Arts & making**, **Nature**, **Exhibitions**, plus **Any interest**. Proposed starting categories, not an exhaustive list. |
| More specific interest | Optional child chips, e.g. Sports → Basketball / Swimming / Soccer; Music → Singing / Instruments / Concerts. Preserve unfamiliar terms as editable keywords instead of discarding them. |
| Activity format | **Participate / try it**, **Class / workshop**, **Watch / attend**, or **Any**. Basketball can mean a clinic, casual play, or watching a game; music can mean a lesson or concert. |
| Starting area | City, neighborhood or broad postal area for in-person search; request region/country only to resolve ambiguity. Never infer location from a work calendar, IP address or account. No exact address or automatic geolocation. Online-only search can omit area. |
| Optional constraints | Budget and currency, travel mode/maximum, indoor/outdoor, beginner level, drop-in versus recurring commitment, accessibility features and exclusions. Ask only when useful; do not solicit diagnoses. |
| Free text | Optional bounded text, proposed maximum 500 characters. Example: “Beginner basketball indoors, one-off session, no full-term enrollment.” Warn against names, school, addresses or other personal details. |

Default interest semantics are **any selected interest**, not all simultaneously; other explicit constraints combine with AND. A specific child selection searches that interest: selecting Basketball must not accidentally expand to every sport. Offer **Any sport** separately. Distinguish requirements from preferences, e.g. **Must be indoors** versus **Prefer indoors**.

For an entered age range, treat the range as uncertainty about actual ages, not evidence that everyone in the range is eligible. Only label age guidance as matching when it covers all supplied ages (or the entire supplied range). Partial overlap is uncertain and can prompt optional clarification. “Recommended age” is not an admission rule; missing guidance is unknown, not “all ages.”

### Request review and free-text interpretation

1. Prefill the slot and show a compact input form. An explicit **Find activities** action initiates search; typing never sends queries or starts research.
2. Present an editable **Search summary**: time zone, area, age guidance, interests, format, requirements and preferences. Structured-only requests can review this inline without a separate modal.
3. If text is interpreted, show proposed changes and unresolved phrases. For example, Music selected with “basketball only” requires clarification instead of an invisible override. Never silently infer age, location, price limits or dates.
4. Use deterministic chips/known synonyms for the first offline milestone. If natural-language parsing later uses an external model, disclose that separate transfer and obtain approval before sending text; do not claim that raw text always stays local. Model output must validate against the same bounded request schema.
5. Before live search, show the minimal query to be sent and the receiving service. Send only confirmed search terms, broad area and necessary date/age guidance. Do not forward raw free text automatically, calendar titles, person labels, account identifiers or the family's complete availability. Search by relevant date rather than transmitting exact free/busy intervals where possible.

Unrecognized text remains visibly unapplied until clarified or explicitly accepted as a search keyword. Accessibility needs should become parent-approved feature terms such as step-free access, not inferred health information. No sensitive-text detector is treated as a guarantee of anonymization.

## Slot and activity contracts

Keep these provider-neutral. The discovery adapter receives a minimal search request, not calendar access or tokens. The authorized schedule layer supplies any private fit context separately.

| Record | Minimum proposed fields |
| --- | --- |
| `AvailableSlot` | `startAt`, `endAt`, `timeZone`, `origin` (`manual`, `synthetic`, `authorized-calendar`), and a local context revision. For authorized context: checked range, authorized display labels, freshness, missing/stale context, and validity status. Do not send those labels to search providers. |
| `ActivitySearchRequest` | Request ID/revision, slot, optional ages/range, interest IDs/keywords, format, broad area or online-only, explicit constraints, preference priorities, approved outbound query. Session-only. |
| `ActivityOccurrence` | Source/provider identity, source URL, exact event and occurrence identity, organizer, venue/area, start/end/time zone or opening/admission windows, format, interest tags, published age guidance and restriction type, published price/currency/unit, commitment requirements, cancellation status. Missing fields remain unknown. |
| `Evidence` | Field supported, source URL, bounded supporting fact/excerpt where permitted, retrieval time, source update time when published, and whether the value is published, derived, estimated, conflicting or unknown. Retrieval time does not prove that a listing is up to date. |
| `ActivityAssessment` | Per-dimension result for age, interest, format, time, cost and travel; exclusion/uncertainty reasons; supporting evidence references; separate slot-fit and calendar-context status. |

A recurring class needs a dated occurrence and disclosed enrollment commitment, not merely “Saturdays.” An exhibition's opening hours are not the visitor's required duration; timed admission, last admission and expected visit duration need distinct fields. If duration is parent-estimated, label it as an assumption.

## Search and source strategy

Proposed pipeline: **Confirm request → Discover candidates → Resolve exact occurrences → Normalize cited facts → Filter → Rank → Explain**.

- Prefer official organizer, municipal recreation, library, museum and venue sources for factual verification. Approved event catalogs or a general web-search API can discover candidates, but snippets are leads, not verified date, price or age evidence.
- Investigate one launch region first. Sports classes and municipal programs may have different coverage from ticketed performances; no single provider is assumed sufficient.
- Reconcile syndicated duplicates by source identity, organizer, venue and occurrence time. Do not merge different performances solely because titles match. Preserve conflicting source facts; exclude uncertain essential timing from confirmed-fit results.
- Respect source terms, permitted API use, robots guidance, attribution, licensing, rate limits and content retention. Do not bypass login, CAPTCHAs or paywalls. Prefer links and minimal attributed facts over copying whole pages.
- Bound query count, candidate count, pagination, response size and execution time. Choose numerical limits and freshness policies during source feasibility review. Show the actual search scope and whether it was incomplete; never imply exhaustive coverage.
- No provider or hosting choice is made here. Feasibility review should compare geographic/category coverage, dated occurrences, age/price fields, permission to retrieve/use content, attribution, latency, query retention and cost. Confirm current official documentation before implementation.

Possible logical adapters are `searchCandidates`, `readActivityEvidence`, and optional `estimateTravel`. Their implementation and any backend remain approval-gated. Reuse the static demo and pure JavaScript logic first; do not add a framework or install an AI/search SDK for this planning increment.

## Matching and ranking

**Filter first, rank second.** Known violations of a must-have constraint never become recommended matches because another score is high. Unknown required facts belong in a separate **Needs checking** group. Known mismatches can be shown only as explicit alternatives, never silently blended with matches.

1. Validate the slot: end after start, explicit zone, and unambiguous instants across daylight-saving changes. Preserve source zones and normalize comparison instants. Reject invalid/ambiguous local times pending clarification.
2. For a fixed session, require its entire duration to lie within the slot. When evidenced travel is available, require `activityStart - outboundTravel - arrivalBuffer >= slotStart` and `activityEnd + returnTravel + departureBuffer <= slotEnd`. Equality fits the mathematical window; zero buffers are not a practical travel guarantee. Parents can choose buffers, and assumptions remain visible.
3. Unknown end time, session identity, time zone or essential admission rules prevents a confirmed time fit. A drop-in venue may fit via a visit interval wholly inside its opening/admission windows; disclose the selected duration and its evidence or assumption.
4. Age checks use numeric intervals or explicit published guidance, not equality between UI labels. Multiple supplied ages must all pass before the card says guidance matches the group.
5. Cost checks distinguish per-child, per-person, family and session/term prices. A known unit price is not a total. Do not assume adult ticket counts, omit stated mandatory fees, treat unknown price as free, or convert currencies without evidence.
6. Rank surviving candidates by explicit interest/format match, preferred features, and evidence completeness. Use known price or evidenced travel only as comparable tie-breakers. Explain ordering with facts, not an opaque “98% suitable” score; no sponsored preference or inferred child profile.
7. Show separately: **Event timing fits the entered window**, **Travel unverified**, and **Calendar availability not checked** when that is the evidence. With calendar-derived context, name only authorized checked sources/ranges/freshness and disclose omissions. “Fits your window” is never equivalent to “your family is free.”

Do not relax age restrictions, dates, distance/time limits or budget automatically. No results should offer explicit actions such as **Try another date**, **Increase budget**, or **Include related interests**, each requiring parent choice and a fresh query summary.

## Results and failure states

Start with a small shortlist (proposed 3–5 options), not endless cards. Each card shows:

- Exact activity/session title, organizer, venue or online format, date/time/zone, published age guidance, price basis and any registration/term commitment.
- A short **Why this matches** explanation, plus clearly separate unknowns, conflicts and requirements that need checking.
- Source links, which facts they support, when retrieved and source publication/update date where available. Synthetic fixtures must say **Fictional example**, not “verified today.”
- Timing fit, travel evidence or unknown travel, and the provenance/limits of any calendar comparison.
- Ticket/space status as published, stale or unknown. Reading a listing or observing a registration link never proves that places remain. No inventory polling or monitoring.
- **View source** and optionally **Compare details**. Neither books, registers, adds an event, contacts an organizer, saves a profile or sends a notification. Warn that external-site actions and privacy policies are separate.

Required states: idle, validating/needs clarification, loading, results, no matches, partial results, stale evidence, source unavailable/rate-limited, unsupported page/region, ambiguous session and cancelled event. Search failure is not “no activities exist.” Show filters/source scope and offer explicit retry; no automatic background refresh. Loading announcements, empty states and errors need accessible text and keyboard-operable recovery.

Calendar loading, empty, partial, stale, conflict, revoked, unavailable and unsupported-account states remain independent of search state. Search can still work, but no stale or revoked fit assertion remains usable. Request edits invalidate the old query's results immediately; late responses must match the current request generation before display.

## Privacy and security boundaries

- On demand, parent-facing, read-only; session-only requests/results by default. No analytics, child profiles, saved searches, persistent result storage or cross-parent sharing in the first slice. Explicitly distinguish session-only app state from a future provider's own retention policy, which must be reviewed.
- Age and preferences never attach to existing calendar aliases automatically. Only the authorized schedule layer handles calendar-derived context; search/page services receive no calendar text. Filter disclosures before any optional assistant receives context, not after it generates a reply.
- Reset, deletion, pause, deselection, disconnect or privacy reduction clears affected calendar-derived fit and fences in-flight assessments. Clear a slot derived from invalidated calendar context; a parent may explicitly enter a new manual slot to continue. Independent manual discovery remains available without restoring revoked data.
- Treat user text, result titles and pages as untrusted data. They cannot grant tool permissions, change constraints, trigger follow-up requests, reveal private context or authorize any external action. Bound and schema-validate extraction/model output, escape rendered text, and validate links independently.
- Existing `safeHttpUrl` checks link schemes only; it is not SSRF protection. Any future server fetcher must reject credentials, unsafe schemes/ports, localhost/private/link-local/reserved addresses and metadata endpoints, validate DNS and every redirect, defend against rebinding, and bound redirects/time/body size/content types. Use an isolated fetch path with no family/provider credentials. Restrict the initial source set rather than implementing an arbitrary proxy.
- Never log raw queries/free text, ages tied to identifiers, calendar content, tokens, personal locations or sensitive URLs. Choose metadata-only operational measures. API keys stay server-side; any hosting, spending, provider transfer or persisted cache needs explicit scope/architecture approval.

## Delivery and acceptance plan

| Milestone | Deliverable and exit criteria | Gate |
| --- | --- | --- |
| 0. Review this plan | Parent agrees hybrid input, slot meaning, format distinctions, result wording and privacy examples. Select an initial search region for later feasibility; no location needed for synthetic work. | Current planning task; implementation not implied. |
| 1. Offline vertical slice | Slot entry/handoff, numeric age handling, hierarchical interests, format, reviewed keywords, pure matching and 3–5 synthetic cards with complete/unknown/conflicting evidence states. Keep existing browser/CommonJS compatibility and regression coverage. | Explicit approval for the prototype increment and review scope. No network or new dependencies. |
| 2. Parent usability review | Parent can find an option using chips or keywords, distinguish playing from watching, understand age guidance and travel/availability uncertainty, relax filters intentionally, and use keyboard/mobile layouts. | Record human review separately from automated checks. |
| 3. Source feasibility | Compare candidate sources for the chosen region; document exact API/page permissions, coverage, supported fields, retention, costs, failure modes and bounded search/fetch architecture. | Research is not deployment authorization. Resolve provider/privacy choices before a live adapter. |
| 4. One live search path | Approved source adapter, source-grounded cards, bounded retrieval, mocked adapter/security tests, explicit adult-triggered live validation with non-sensitive requests. | Approve provider, architecture, spend/hosting/data handling and exact live-validation scope first. Calendar integration not required. |
| 5. Release readiness | Threat-model review, provider terms and operational limits, accessibility/parent validation, truthful freshness and deletion/retention behavior. | Separate deployment approval; no implied booking, monitoring or calendar-import approval. |

### Focused regression matrix for the first implementation

- Manual/no-calendar discovery works; missing or stale calendar context never becomes a free-time claim; revocation and late responses cannot restore old fit results.
- Age endpoints, partial overlap, multiple ages, unknown guidance and recommended-versus-required guidance; no inferred child identity.
- Sports/Basketball hierarchy, multiple-interest OR logic, exact participation format, unfamiliar keywords, conflicting text and explicit must/prefer constraints.
- Exact slot boundaries, partial overlap, missing duration/zone, daylight-saving ambiguity, cross-midnight sessions, travel/buffer overflow, open-hours versus visit duration, and recurring-term requirements.
- Unknown/zero/per-person/term prices, mandatory fees, currency mismatch, missing travel and source cancellation; no false total or availability claim.
- Duplicate listings versus distinct performances, stale/conflicting evidence, partial/rate-limited/unsupported sources, empty matches and explicit filter relaxation.
- HTML/link injection, malicious page instructions, bounded inputs and schema validation. Add SSRF/redirect/secret-redaction adapter tests before live fetching, not just UI URL checks.
- Desktop and narrow mobile layout, labeled controls, keyboard chips, focus after validation/retry, non-color status indicators and appropriate live announcements.

## Planning validation record

Reviewed the complete product/privacy plan, current demo filter/render paths, form, app tests and separate-picker architecture. Baseline executed on 15 September 2026: `node --test`, **118 passed, 0 failed**; `git diff --check` passed before documentation edits. These results validate the existing suite only, not this proposed component. No UI, live research, provider verification, parent usability review, account connection or deployment was performed for this planning increment.