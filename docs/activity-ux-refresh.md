# Activity UX refresh: isolated design preview

## Read-only inherited activity dates, 18 September 2026

Approved: Activity dates are fixed to the Calendar/Our week selection rather
than another editable range. The activity page now shows a single date summary
and a native Change dates link to same-origin Our week. Start/end inputs and
Reset dates are removed, including the controller's write/reset handlers.
Activity only reads the existing familycopilot.dates.v1 store. No shared date
contract, default range, validation limit, source request or storage format is
changed. No calendar connection or calendar data is required. Start over and
page lifecycle resets retain dates. Returning from Calendar reads the current
selection, discards old results and fences late responses without auto-search.
Invalid/denied storage blocks Find and directs the parent back to Our week.

Owned files: activity-preview/index.html, basketball-ui.js, basketball.css,
serve-search.js; test/basketball-ui.test.js, test/activity-search-server.test.js,
test/fixtures/activity-dom.js; and this document. Existing age-spacing changes
and other chats' calendar/demo changes were preserved. Baseline worktree:
single /home/davidtang/Projects/FamilyCopilot, branch davidtang/dev, HEAD 6dddfb9.

Verification: new read-only regression failed against the old date inputs.
`node --test test/activity-preview.test.js test/activity-preview-ui.test.js test/basketball-ui.test.js test/activity-search-server.test.js`
passed 103/103, exit 0. `node scripts/test-activity-discovery.js`: baseline
204/205, final 205/206; `TZ=America/Los_Angeles node scripts/test-activity-discovery.js`:
205/206. Both final bounded runs have only the pre-existing shared calendar
shell-zone timezone assertion failure in test/shell.test.js, left untouched.
Tests cover inherited request dates, zero startup calls/writes, reset retention,
invalid/denied storage, date changes during response/decode and removed DOM.
Actual browser layout, native-link navigation and physical keyboard checks
were not available; DOM and mocked HTTP tests are not browser approval.

Integration handoff: same-origin navigation in the same browser tab reuses the
existing dates-only store. Separate ports do NOT share it. The independent
service removes the unavailable Calendar links and explicitly identifies its
dates as separate; it retains its own existing selection or labelled default.
An explicit dates-only transfer into 8030 is still an integrator-owned contract
decision, not implemented here. Do not describe 8030 as following 8002 dates.
The offline preview helper and its disabled public requests/CSP remain unchanged.
The updated standalone markup transformation requires an owned-service restart;
no restart is authorized or performed by this edit. Until restarted, its old
transformation can leave same-origin Calendar links pointing back to itself.
Integrated static assets require reload, not a backend contract activation.
No process state revalidation, service operation, live query, 8002/private/Auth
access, commit or push occurred. Historical PID/port ownership is not reverified.

## Age selector arrow spacing, 18 September 2026

The supplied screenshot showed Any crowded by the native dropdown arrow.
activity-preview/preview.css replaces the fixed 62px select width with 6em,
prevents flex shrinking and reserves 2em inline-end padding. Native select
behavior, 44px controls and wrapping age chips remain unchanged.
test/activity-preview.test.js asserts these spacing safeguards; its targeted
regression failed before the CSS change. The final command
`node --test --test-reporter=dot test/activity-preview.test.js test/activity-preview-ui.test.js`
passed. `node scripts/test-activity-discovery.js` baseline and final: 204/205,
with the existing shared main-card timezone assertion failure left untouched.
No browser visual/physical-input verification was available. Scope: stylesheet,
test and this record. Static reload only; no backend contract changes, restart,
process operations, live queries or private/calendar access.

## Remove sport coverage hint sentence, 18 September 2026

Removed only "Live coverage: TPBL basketball only; other sports are not sourced
here." from activity-preview/index.html. "None selected means any sport."
remains. Updated test/activity-preview.test.js to assert the requested absence.
`node scripts/test-activity-discovery.js`: baseline 205/205, regression-first
204/205 with the expected copy failure, final 205/205 (exit 0). Scoped whitespace
checks passed. No search behavior or backend contract changes; static reload
only, no restart. No process operations, live queries, private data access or
browser validation. Scope is markup, its test and this record.

## Concise successful game summary, 18 September 2026

activity-preview/basketball-ui.js now reports "2 games found." rather than
repeated totals and internal filtering narration. Fuzzy resolutions retain the
entered-to-source name mapping, without the unchanged-preference sentence.
Truncation says "Showing 40 of 45 games."; prefer mode adds "Preferred teams
first." when relevant. Unknown, partial, unavailable, ambiguous and no-match
recovery messages, source attribution/freshness and matching logic are unchanged.

Updated test/basketball-ui.test.js for exact compact copy, singular/plural,
truncation, prefer mode, fuzzy mapping and exact-team home/away filtering.
Bounded runner baseline 204/204; new regression failed before implementation.
Final `node scripts/test-activity-discovery.js` and
`TZ=America/Los_Angeles node scripts/test-activity-discovery.js`: 205/205 each,
exit 0. Scope: controller, test and this record only. Static reload suffices;
no backend contract change/restart, process operation, live query, 8002/Auth/
private-data access, commit or push. Browser validation not performed.

## Compact preferred-team controls, 18 September 2026

Applied the parent's approved preference-section simplification: one Preferred
teams label names both the input and chip list; Add, removable chips and Only
preferred teams remain. Removed the second heading, count/policy summary and
checkbox suffix. Successful add/remove/clear leaves team-status empty; invalid
input, duplicate names, the 16-team limit and unadded-draft warnings remain.
Successful Add clears aria-invalid. Chips retain accessible removal labels,
focus handling and 44px controls, with a 12px gap above a populated list.
Only/prefer semantics, empty/hidden preference behavior, fuzzy matching,
filtering before truncation, page-local data and explicit-search boundaries
are unchanged. No other discussed page-copy proposal is included.

Scope: activity-preview/index.html, activity-preview/basketball-ui.js,
activity-preview/basketball.css, test/activity-preview.test.js,
test/basketball-ui.test.js and this record. Existing changes preserved on
davidtang/dev in the single worktree at f72c087; no shared files edited.
`node scripts/test-activity-discovery.js`: baseline 204/204, regression-first
196/204 (eight expected old-copy failures), final 204/204, exit 0.
`TZ=America/Los_Angeles node scripts/test-activity-discovery.js`: 204/204,
exit 0. Both final summaries were directly verified. Existing duplicate,
invalid-input, cap, literal-escaping, focus, reset and no-autosend tests pass.
No actual browser visual/physical input validation was performed this turn.

Static markup/controller/styles only: reload required, no backend contract
change or restart required. No process operation or state revalidation,
live query, 8002/Auth/private data access, new storage, commit or push.

## Show public heading only after Find, 18 September 2026

activity-preview/index.html now starts basketball-title hidden. In
activity-preview/basketball-ui.js a validated explicit Find reveals it before
the existing focus/search flow. Clearing or invalidating results (including
choice/date edits, cancellation, reset and page exit) hides it again. Status,
error and recovery messages remain outside that hidden heading; no result panel
or source-detail behavior changes. Tests in test/basketball-ui.test.js cover
initial/category state with zero requests, Find/focus, date edits and reset/exit.

Bounded runner `node scripts/test-activity-discovery.js`: baseline 203/203,
regression-first 203/204, final 204/204. Also ran
`TZ=America/Los_Angeles node scripts/test-activity-discovery.js`: 204/204,
exit 0. Only those three files and this record changed for this increment.
No shared/backend contract change; reload static assets, no restart needed.
No browser tools available for physical/visual validation. No live query,
process operation/reverification, 8002/Auth/private access, commit or push.

## Remove pre-search coverage and disclaimer copy, 18 September 2026

Removed the two requested pre-search paragraphs (Public coverage and Public
games) from activity-preview/index.html, without replacement slogans. Removed
the discovery-scope writer and its alternate category/offline text from
activity-preview/basketball-ui.js so changing choices cannot restore the copy
or access a deleted node. Result details, source coverage, unknown fields,
offline Find feedback, errors, filtering and cancellation remain unchanged.
No backend contract or shared-file change. Scoped files are those two files,
test/basketball-ui.test.js and this record; unrelated work preserved.

`node scripts/test-activity-discovery.js`: baseline 202/202; regression-first
201/203 (two expected failures); final 203/203, exit 0. Also ran
`TZ=America/Los_Angeles node scripts/test-activity-discovery.js`: 203/203, exit 0.
New checks cover absent static/controller text, category/reset with zero calls,
explicit mocked public Find, preserved card unknowns and offline no-query mode.
Scoped whitespace and editor diagnostics checked. Browser tools unavailable;
no actual layout/physical interaction verification claimed.

Reload static assets; no backend restart required. No process started, stopped
or reverified, no live query, 8002/Auth/private-data access, commit or push.
No additional operational approval used or needed for this copy-only change.

## Remove team-entry help paragraph, 17 September 2026

Removed the parent's exact requested team-help paragraph from
activity-preview/index.html, with no replacement copy. The input now references
only team-status through aria-describedby. Matching, limits, validation, privacy
and reset behavior are unchanged. Updated test/activity-preview.test.js and this
record only; preserved other working-tree changes. Bounded runner
`node scripts/test-activity-discovery.js`: baseline 202/202, regression-first
201/202, final 202/202 (exit 0). Static reload only, no backend contract change or
restart required. No browser validation, live requests, process-state inspection,
service operations, 8002/private data access, commit or push performed.

## Remove the entire ideas result surface, 17 September 2026

The parent requested removal of everything in the supplied screenshot, not just
another wording change. Deleted the entire ideas results section from
activity-preview/index.html: heading, Edit choices, fixed coverage paragraph,
filter/date summary, uncertainty strip and card container. The generic status
region is now screen-reader-only for age/reset feedback. With no results mount,
activity-preview/ui.js validates form choices but does not render ideas, announce
their count or focus the removed heading. Missing results/Edit nodes no longer
break startup, invalidation or reset. Public TPBL results are unchanged. This is
removal of a result surface, not relabelling invented cards as real listings.
Other preference controls/copy and the offline preview's CSP remain unchanged.

Owned files: the two files above, test/activity-preview.test.js,
test/basketball-ui.test.js, test/fixtures/activity-dom.js and this record.
The fixture can omit ideas nodes to exercise both real controllers; legacy
mounted-ideas tests remain to verify controller compatibility. Added coverage
for no startup requests, mocked public success, non-basketball/offline searches,
validation errors, reset and page lifecycle with no ideas rendering/count/focus.

Baseline bounded runner: 201/201. Regression-first two-file run: 78/82 passed,
four expected failures before implementation. Final
`node scripts/test-activity-discovery.js` and
`TZ=America/Los_Angeles node scripts/test-activity-discovery.js`: 202/202 each,
exit 0. Scoped whitespace and editor diagnostics checked. No browser tools were
available; no new visual or physical keyboard check is claimed.

No backend contract/shared-file change, process operation, live query, 8002/Auth/
private-data access, commit or push. No process ownership/state reverified this
turn; existing service untouched. Static page/controller reload is sufficient,
not a backend restart. No additional operational approval was used.

## Remove redundant result eyebrow, 17 September 2026

Removed the requested "Invented examples · Not live listings" paragraph from
the result heading, without a replacement slogan or any other UI copy change.
The Ideas heading, Edit choices button, existing coverage paragraph, card details
and footer remain unchanged. No filtering, provenance data or backend contract
changed. Scope: activity-preview/index.html, test/activity-preview.test.js and
this record; existing unrelated working-tree changes were preserved.

Regression-first focused run: 30/31 passed, with the removed-label expectation
failing before the markup edit. Final `node --test test/activity-preview.test.js
test/activity-preview-ui.test.js test/basketball-ui.test.js`: 87/87 passed.
`node scripts/test-activity-discovery.js` before and after: 200/201 passed,
same existing shared-shell header comparison failure caused by differing owner
source-row markup. That shared integration issue was left untouched.
Scoped git/direct untracked-file whitespace checks passed. No browser interaction
tool was available, so no new visual or physical input validation is claimed.
Static markup only: reload is sufficient; no service restart or process operation
performed, and current process state was not reverified. No live queries, 8002,
Auth, calendar/private data access, commit or push. No new approval needed for
this static edit; shared-shell reconciliation remains an integration handoff.

## Activity header and date decluttering, 17 September 2026

Parent screenshots showed the standalone technical badge overflowing its shared
fixed-width container, an unstyled disabled Our week placeholder beside the
active Activities link, and the selected dates repeated in the title, inputs
and helper paragraph. The parent requested applying this cleanup without relaying
messages between chats. The visible historical date todo alone did not establish
an active conflicting editor; current files were reread and other work preserved.

Changed [activity markup](../activity-preview/index.html),
[activity-only styles](../activity-preview/basketball.css),
[date-hint controller](../activity-preview/basketball-ui.js),
[regression tests](../test/basketball-ui.test.js), and this record.
The activity body class scopes all presentation changes. The technical source row
and standalone disabled navigation placeholder now use display:none, excluding
them from both visible layout and the accessibility tree. The working Our week
link on the integrated host is unaffected; no new cross-origin calendar link or
proxy is introduced. Legacy header/date nodes remain for shared-shell/controller
compatibility, but the selected-date range and timezone in the heading are hidden.
The inputs are the single visible date editor, with one nearby Taipei/UTC+8 hint
and a short default-date indicator where applicable. Invalid/storage-failure
messages remain visible and block search. Storage/reset explanations move into
native, initially closed About these dates details. Navigation can wrap and date
grid labels can shrink; the title remains within the existing card.

Source coverage, invented/synthetic distinctions, freshness, unknown suitability,
optional ages, progressive sports/teams, fuzzy matching, cancellation and dates-only
storage remain unchanged. No date default, range contract, shared utility/shell,
backend, package or agent definition changed. Shared markup is deliberately retained
rather than silently changing shared-shell tests; this is not a CSS change to the
calendar page. The offline preview's connection-denying CSP is unchanged.

Validation: baseline node scripts/test-activity-discovery.js199/199;
regression-first201 tests:199 pass/2 fail. Final runner201/201 in system-default
and TZ=America/Los_Angeles, both exit0. New tests cover scoped header visibility,
one input pair, closed native help, nonduplicated date hints, invalid-date blocking
and reset/focus with zero requests. Existing source/security/fuzzy/late-response
tests remain passing. Editor diagnostics and scoped whitespace checks passed.
No browser interaction tools, installed browser executable or Playwright package
were available: no new screenshot, physical keyboard/pointer or measured mobile/
desktop layout verification is claimed. These tests do not prove unspecified
control malfunctions from the screenshot have been physically reproduced.

Fresh read-only8030 identity matched owned PID94572/start34831006, exact live CLI
and workspace. Four bounded static GETs returned200; page markers and JS/CSS disk
bytes matched. No source POST, TPBL query,8002/Auth/private calendar/cache/cloud
access, service restart, commit or push. The owned service remains live on explicit
Find only; reload the activity page to apply this static revision (page-local
preferences reset). No backend restart is required. Broader shared integration
and actual browser/parent usability checks remain separate.

## Category-first discovery, 17 September 2026

Approved and implemented: six immediately visible categories, Anything/multi-select,
Sports → choose sports → Basketball → Add a preferred team, direct dates and
page-only preferred-team chips. Six native sport icons (🏀 🏓 ⚾ ⚽ 🏸 🏊)
start unchecked, with hidden checkbox squares, accessible names and checkmarks.
Sports alone is broad, never automatically Basketball. Only explicit Basketball
reveals the Add input/button and **Your preferred teams** removable list. Add or
Enter never searches. Names need no roster; up to 16, trimmed/case-insensitive
exact matching, with validation and focus/live feedback. The default only-preferred
policy can be changed to prefer-first; an empty list has no team restriction.
Watch/Play/Either and basketball intent effects are removed; Basketball is spectator
discovery, not the invented workshop. Hidden remembered
choices do not restrict Anything or all-sports searches; other-sport-only choices
make no TPBL request or basketball-workshop match. No other live coverage is claimed.
The **福爾摩沙夢想家 (Formosa Dreamers)** shortcut adds without replacing or searching.
Names remain visible/editable on this page across date/category edits, but not
reset/reload/page exit. Source autocomplete is optional; names are not verification.
One Find activities action replaces primary source-mode tabs. Public TPBL listings
and fixed-September invented ideas remain separately labelled; optional ages and
More options affect ideas only. Visible Demo/Sample wording is removed, retaining
**Invented examples · Not live listings**, fixed coverage, invented prices/venues
and **Synthetic test data** on synthetic public cards. Native checkbox/text/button controls retain
keyboard focus, textual selection and responsive wrapping. Shared outer shell and
compact ages are retained; categories now precede ages.

[Behavior, local API and synthetic review handoff](activity-discovery-teams.md).
The Add/chip increment passed **159/159** bounded offline tests from
**150/150**, in default and America/Los_Angeles time zones. Keyboard event seams and markup are tested; no browser validation of
this increment is claimed. Parent reviews the existing synthetic port 8019; no
server restart or main-8002 helper-404 repair occurred.

Earlier synthetic browser checks (before explicit sport choices) on port 8019 verified keyboard selection, Dreamers
home/away filtering, no-match recovery, Play/Music without public requests and
1279px/319px layouts without overflow. Parent approval and safe main-server
activation remain pending; fixtures do not establish real-game availability.

## Playful artwork and compact ages, 16 September 2026

Implemented the parent's presentation-only feedback in
[markup](../activity-preview/index.html), [styles](../activity-preview/preview.css),
[age-row rendering](../activity-preview/core.js) and the
[controller](../activity-preview/ui.js). The untracked preview has no committed
history to restore; this reuses its existing sun, face, cloud and pastel palette,
plus decorative sparkles, rather than claiming a pixel-exact historical recovery.

- The 62px smiling sun sits in a 120×88px decorative scene, scaled on mobile,
	without changing shared heading/card geometry or adding a separate hero.
	Warm interest illustrations and result cards are unchanged.
- One **Ages (optional)** caption under **Who's coming?**; 62px native selects
	show **Any** or a number. Numbered labels remain screen-reader-only. **×** and
	**+** have accessible names/tooltips and 44px targets. Pastel chips wrap naturally,
	two per row at the measured 319px viewport (320px target).
- Removed the permanent paragraph and duplicate Skip ages action/handler. Any,
	removing all rows and Start over retain skipping. Initial state remains one
	unset age. The existing cap disables Add at eight, with a brief live-status
	message when reached, cleared on the next edit. No new age limits or data fields.
- Search/validation, multi-age AND, twins, safe rendering, sample/uncertainty
	notices, result invalidation, useful focus, reset/reload/exit cleanup are retained.
	[Controller tests](../test/activity-preview-ui.test.js) and
	[rendering tests](../test/activity-preview.test.js) retain prior validation
	coverage and add compact controls, artwork and Any-skipping regressions.

Executed baseline **295/295**, focused activity/shared-shell **34/34**, final
`node --test` **298/298**; `git diff --check` and scoped editor diagnostics passed.
Desktop/mobile screenshots show the larger sky and compact controls. Browser
checks covered eight repeated synthetic ages, cap feedback, first/last/all removal,
44px targets (43.997px rounding), focus, keyboard interest/checkmark and submission,
AND mismatch, Any, empty date, expanded card details, reset, invalid-age recovery
and reload. Two age chips measured 107.39px each at 319px, without page overflow.

Fresh, unacknowledged owner pages were used only for geometric comparison with
Activities at **1279, 375 and 319 CSS px**. Header/nav, first-card x/y/width,
title/date/time-zone rectangles matched within 1px; card padding stayed 16px or
14.4px. No View week, Update, Clear or API request occurred. Monitored navigation
and sample interactions made only same-origin static GETs, with no runtime errors.
Existing user tabs and preferences were not inspected. No server was started or
restarted; no provider/cloud/cache/storage/dependency changes, commit or push.

Reload **http://localhost:8002/activities** when ready. Parent visual approval,
screen-reader speech and real-device review remain separate; live discovery and
calendar comparison are not implemented or newly authorized.

## Shared content layout repair, 16 September 2026

The parent reported that matching navigation still left the page layouts
misaligned. This presentation-only repair uses the compact Our week card as the
baseline, preserving each title, the existing activity chips/cards, all control
IDs and behaviors, consent, source labels and the fixed 20–26 September 2026
Taipei window. No calendar data, cache, auth, API, backend or route changes.

**Reproduced:** on the actual 8002 activity route at 1328 CSS px, the standalone
hero measured 225.40px high and the planner was only 859.99px wide, beginning at
x=222.68, y=358.86. The owner used the full-width first card instead. Both current
8002 bodies already had zero margin and headers began at y=0; an extra 8px body
margin was not reproduced there. The earlier nav-only tests did not cover this
content mismatch.

- [Shared structure](../shell.css) now owns body reset/background, the 1280px outer
	container, main spacing, card surface/padding/radius, compact title row, date
	column and time-zone placement. [Owner markup](../owner/index.html) and
	[activity markup](../activity-preview/index.html) use the same structural
	classes. Feature styles no longer override those card/title dimensions.
- The activity title and small sun stay inside the first card. Only the inner
	form retains its comfortable 860px maximum, left-aligned to the card padding;
	[existing controls](../activity-preview/preview.css) are not redesigned. Results
	use the full outer width, three desktop columns or one mobile column, with an
	18px section gap. Card heights intentionally depend on their different content.
- [Shell regressions](../test/shell.test.js) now cover first-card/title containment,
	identical date/zone structure, shared outer geometry, removed competing rules,
	inner-only form limits and preserved navigation/source states. The existing
	[availability markup assertion](../test/availability-ui.test.js) follows the
	new shared classes without changing its fixed-date expectation.

### Executed visual and interaction checks

Fresh, empty owner pages and sample activities were compared at scroll-top on
the existing **http://localhost:8002/** and **/activities** routes. No existing
loaded owner tab was inspected, reloaded or modified. Owner confirmation remained
unchecked, load/update disabled and all fourteen tracks Unknown. Request logging
and a defensive browser API-route block recorded **zero API attempts** and only
GET requests throughout navigation/interaction; nothing was loaded or cleared.

Both pages had identical measured header, navigation, source-badge, first-card,
title-row, date and zone geometry (1 CSS px assertion tolerance; observed paired
difference zero). Inner padding and radii also matched:

| Measured CSS viewport width | First card x / y / width, both pages | Card padding | Header x / y / width / height, both pages |
| --- | --- | --- | --- |
| 1279 | 15.99 / 133.45 / 1225.23 | 16px | 0 / 0 / 1257.21 / 117.46 |
| 1328 | 28.67 / 133.45 / 1248.01 | 16px | 12.68 / 0 / 1279.99 / 117.46 |
| 375 | 11.99 / 177.44 / 329.04 | 14.4px | 0 / 0 / 353.02 / 165.45 |
| 319 | 11.99 / 177.44 / 273.23 | 14.4px | 0 / 0 / 297.21 / 165.45 |

The embedded browser's approximately 67% zoom rounds the requested 1280/1327/320
targets to nearby actual CSS widths above; measured `innerWidth`, not nominal
viewport settings, is reported. Stable scrollbar gutters are included in the
geometry. Same-tab desktop and mobile screenshots showed both card edges and
matched starting positions. An initial second-tab screenshot was cropped by the
browser capture; same-tab captures resolved that limitation without CSS changes.

Keyboard checks covered skip → Our week → Activities, visible nav focus, Space
on interest chips with a visible non-color checkmark, Enter submission/details,
results focus, Edit choices and reset focus. Age 8 + Sports returned one sample;
removing the interest restriction returned six with unknown guidance separately
labelled. The empty September 23 fixture, eight-age limit, collapsed options and
reset worked. Six results with an intentionally long unbroken synthetic title
and expanded details fitted all four widths without page overflow; result edges
matched the main card and their gap measured 18px. No fixture/core/controller
files were changed or real source facts implied.

Baseline **293 passed, 0 failed**; final **295 passed, 0 failed** with `node --test`.
Scoped editor diagnostics and whitespace checks passed. Existing uncommitted work
is preserved; no dependencies, server restarts, cloud actions, cache-file access,
commit or push. Parent visual approval, screen-reader speech and real-device
validation remain separate.

**Standalone preview limitation:** a fresh read-only check of the older running
8010 process found that current scoped CSS/JS asset requests fail (404/MIME
errors), leaving the browser's default 8px body margin and an obsolete week link.
The on-disk standalone server already has the correct route map and link rewrite,
covered by offline HTTP tests, but that process has not adopted it. No restart or
backend patch was performed. This is separate from the repaired 8002 content
layout; use the canonical 8002 activity route for review. Existing services and
loaded real tabs remain untouched. Both newly created review tabs were closed;
no temporary server was started. Reload canonical pages only when ready; no
automatic calendar query follows a reload.

## Approved current increment: simple activity inspiration, 16 September 2026

The parent approved reorganizing the existing sample preview first, with real
activity search and calendar comparison handled separately later. This supersedes
the earlier isolation/navigation and single-age restrictions below only for this
increment. It does not authorize provider calls, cache access, live sources or
calendar-data handoff.

- Keep the warm preview cards/chips. Lead with **Who's coming?** (optional ages
	4–17, up to eight entries, including twins; no names or birth dates), **What
	sounds fun?**, explicit **Surprise us** (clear interests), then **Find ideas**.
- More options starts closed: fixed-week date, morning/afternoon, sample USD
	per-child budget, indoor/outdoor and format. Remove keywords from the UI; keep
	the bounded legacy core helper for compatibility. No address or pretend travel
	filter. Six invented Taipei-area venues, not verified places or prices.
- Fixed **Sunday 20–Saturday 26 September 2026, Asia/Taipei (UTC+8)**. Return at
	most six actual matching samples, never pad to three. Every entered age must
	fit the same activity; uncertain guidance/required price stays separately
	**Needs checking**. Skipping ages means age not checked.
- Requests stay in the page only. Results appear only on submit; editing hides
	them. Reset, reload and page exit clear preferences. No accounts, auth scripts,
	API calls, storage or calendar comparison in this page.
- Serve `/activities` and three explicitly allowlisted `/activity-preview/`
	assets from the owner server. Change only its two activity links; retain `/demo`
	and all owner styling, consent, cache and controller behavior. Activity responses
	deny connections/form submissions and do not create owner sessions.
- Baseline executed: **277 passed, 0 failed**. Validation and activation evidence
	will be recorded below. A running backend needs a safe idle restart for new
	routes; do not reload/inspect loaded real calendar tabs or bypass cleanup blocks.

Parent usability approval, real source feasibility and future integration
authorization remain separate. No commit, push or cloud operation is included.

### Current implementation and validation

- Updated the existing [preview markup](../activity-preview/index.html),
	[styles](../activity-preview/preview.css), [core](../activity-preview/core.js),
	[controller](../activity-preview/ui.js), and [standalone server](../activity-preview/serve.js).
	No new framework/dependency. The default is the whole fixed Taipei week, six
	sample sessions spread across September 20, 21, 22, 24, 25 and 26. September 23
	honestly has no fixtures. Morning contains midnight–noon; afternoon noon–18:00;
	the whole session must be within the requested period. No location filter is
	offered because no sourced location/travel evidence exists.
- The legacy core exports and bounded single-age/slot/keyword inputs remain;
	default dates/zone and whole-week results intentionally changed. Legacy slots
	are remapped within this fixed week and the UI no longer exposes keywords.
	New input uses an explicit bounded ages array; ambiguous old/new age inputs,
	malformed values and unsupported filters fail closed. Duplicate ages remain.
- [Owner markup](../owner/index.html) changes only its two activity links/text.
	[Owner server](../scripts/serve-owner.js) adds `/activities`, `/activities/` and
	three exact `/activity-preview/` asset paths with connection/form-denying CSP.
	It does not add owner sessions/cookies or transfer calendar data. `/demo` remains
	byte-for-byte the original demo response. Owner styles, controllers, cache,
	provider/infra files, protected targets and consent behavior were not edited.
- [Core/markup tests](../test/activity-preview.test.js), [actual-controller DOM
	tests](../test/activity-preview-ui.test.js), [HTTP route tests](../test/owner-server.test.js)
	and [owner presentation tests](../test/owner-presentation.test.js) cover age AND
	endpoints, twins/max count, malformed/unknown criteria, full-period containment,
	caps/deduplication, escaping, empty results, reset/history, focus, no persistence,
	no auth/API imports, route traversal/method/origin rejection and no session/cache
	access. Dedicated activity tests pass also with host TZ=America/Los_Angeles.
- Final executed suite: **291 passed, 0 failed** (baseline 277), dedicated activity
	suite **27 passed, 0 failed**, including in America/Los_Angeles. Editor diagnostics,
	tracked/untracked whitespace, conflict-marker and relative-link checks passed.
	Final local readiness confirmed **idle / not_requested / live / disk mode**,
	`/activities` **HTTP 200**, both owner links targeting it and no owner-session
	marker in the activity response. The activity browser is left at the canonical
	URL with ages/results empty and More options closed; no real owner tab was used.
- Browser checks used only a **new sample-activity tab on the actual 8002 route**,
	never a real owner calendar tab. Measured **1280px desktop / 320px mobile**,
	with zero horizontal overflow, three desktop columns and one mobile column.
	Ages 8+10 yielded five known-guidance samples plus one separate Needs checking;
	Sports yielded exactly one. Surprise cleared interests, not ages/budget. Checked
	first/last removal and focus, eight-entry cap, Skip ages, date+Free empty state
	without relaxation, a single morning science card, Details, reset and reload.
	Keyboard Space/Enter, visible focus and non-color checkmarks worked. A synthetic
	invalid-date option produced the error, focused Day and kept results hidden.
	Initial attempted deselection produced no form entry (not invalid-date input);
	the explicit injected option was used for the real validation check.
- A monitored reload and interaction sequence requested **only four local static
	assets, all GET**, with zero API/external requests or JavaScript runtime errors.
	Reload clears all ages/interests and opens no results. CSP blocks connections.
	Desktop/mobile screenshots were inspected; embedded-browser zoom required
	measuring actual CSS width, not assuming viewport dimensions. The browser tool
	initially rewrote localhost to 127.0.0.1 and received the expected Host-gate 403;
	direct navigation preserving `localhost` worked. No security gate was weakened.
- **Activation:** fresh in-memory CSRF plus status-only local POST, exact
	127.0.0.1 socket / localhost:8002 Host+Origin, verified **idle / workflow_disabled /
	disk mode** and no cache failure. Under the existing operation lock, rechecked
	process identity and status, sent SIGTERM only to the verified owner PID 83193,
	confirmed port release and started the existing live owner task. The server now
	serves the actual activity route. No force-kill, cache-file inspection/change,
	provider query, Azure command or real-page reload. The local snapshot retention
	contract is unchanged; old owner tabs need a deliberate reload for a new session.
	Existing 8003/8010/8011 services were untouched; no new synthetic owner server
	was created or left running for this review.

Screen-reader speech, real-device checks and parent usability approval remain
unverified. Next: parent review of this simple sample flow, then separately scoped
real-source discovery and calendar comparison with their own approvals.

## Historical increment: polish the finalized calendar

15 September 2026. The parent now states that the calendar UI is finalized and authorizes improving it. This supersedes the previous pause **for a presentation-only calendar increment**, not for auth changes, data access, live queries or activity integration. This scope is recorded before implementation.

- Edit only [owner markup](../owner/index.html), [owner styles](../owner/owner.css), this document, and a new dedicated presentation regression test. Preserve all existing IDs, script imports, routes, event handlers, consent gates, fixed people/date/time-zone contract, RAM retention, freshness and cleanup semantics. Existing controller/backend files remain unchanged.
- Keep the finalized seven-day, two-person, 24-hour grid, including all 672 slots, unknown hatching, textual statuses and keyboard horizontal scrolling. Do not replace it with the previously suggested day selector or hide the initial unknown grid.
- Bring the warm cream/lilac palette, softer cards, rounded controls and small decorative symbols to this calendar surface only. Scope new rules beneath an owner-page body class; do not edit root shared CSS or import the activity-preview stylesheet.
- Make the page hierarchy clearer: small brand/navigation header, concise week heading, scannable access summary, explicit acknowledgement and action row, source/freshness/status context, legend and the existing calendar. Reduce duplicated nonessential copy; retain dates, exact scope, owner-only busy disclosure, no-busy caveat, cache/reload/permission caveats and recovery details. Decorative icons use `aria-hidden` and always accompany meaningful labels.
- Preserve the existing synthetic/live notices and hidden/inert older picker. Keep `/demo` navigation unchanged; clarify its sample-only label rather than implying live schedule integration. Do not touch or reload real calendar browser tabs. Test only the synthetic server, starting its existing task if needed; do not restart the live process.
- Baseline executed: **241 passed, 0 failed**, with `git diff --check` passing. Before/after fingerprints will check unchanged owner controllers, availability core, server/cache helpers, shared root assets, package manifest and tasks. Parent visual review remains separate from automated checks.

No deployment, provider verification, dependency installation or commit/push is part of this increment.

Browser validation adjustment: the existing port-8003 synthetic process returned HTTP 400 for a consented Check week request. Its runtime revision/session history is not established; no cause is inferred and no auth/backend fix is included. Use a separate loopback-only synthetic instance of the existing server factory on port 8011 for this review, leaving existing live/synthetic processes untouched. No file or shared task change is needed to launch it.

### Calendar polish execution and validation

- Implemented the scoped cream/lilac theme, rounded cards and controls, decorative labeled icons, shorter week heading, two-column desktop access summary and stacked mobile summary in [owner markup](../owner/index.html) and [owner styles](../owner/owner.css). The fixed week, all-day grid, routes, script imports and control IDs remain intact. Source, freshness, Unknown, consent and recovery information remain available; retention stays visible before the calendar.
- Added five [presentation regressions](../test/owner-presentation.test.js) covering asset boundaries, consent/summary placement, meaningful labels, preserved grid geometry and scoped styling, and selected normal-text contrast pairs. Corrected a test expression that mistakenly treated decorative `aria-hidden` as the HTML `hidden` attribute. Browser review also caught and corrected disabled-primary-button color specificity.
- **Concurrent work:** before/after fingerprints changed for availability core/controller, owner server and cache helper, and the markup gained runtime retention/storage containers. This thread did not edit those behavior files or revert those changes. Preserved the new containers and mode-specific disclosures; tests check their visible placement rather than pinning the earlier RAM-only copy. The initial RAM-retention scope above records the baseline, not a claim about today's live server. Fingerprints still matched for owner list controller/core, availability provider helper, shared root markup/styles, package manifest and tasks.
- Executed **28 focused tests, 28 passed** (`node --test test/owner-presentation.test.js test/availability-ui.test.js test/owner-ui.test.js`) and **261 full-suite tests, 261 passed** (`node --test`). The increase from 241 includes concurrent additions, not just this thread's five tests. `git diff --check` passed; explicit read-only checks of the four owned files found no trailing whitespace, conflict markers or broken relative Markdown links. Editor diagnostics reported no errors. Review found no added external assets, unsafe output construction or changes to auth/network code.
- On the separate **synthetic-only port 8011** instance, verified initially disabled Check week, native keyboard Space acknowledgement, successful fictional loading, seven days/fourteen tracks ending at 24:00, focus on status, Clear returning all fourteen tracks to Unknown with acknowledgement reset, and a partial fixture retaining seven Unknown tracks plus explicit missing-person/source/freshness notices. Keyboard Enter opened privacy details; arrow keys scrolled the focused calendar. No real-calendar tab was opened, reloaded or inspected.
- Measured CSS widths **1279, 390 and 319px**: no document horizontal overflow; narrow screens preserve deliberate 1064px calendar scrolling and approximately 48px-high action targets. Desktop summary uses two columns. Synthetic screenshots were reviewed, but the integrated screenshot capture cropped desktop output despite the larger measured viewport; full desktop visual approval is therefore not established. Browser zoom required measuring `innerWidth`, not assuming nominal viewport dimensions.
- The temporary synthetic review server is left running at **http://localhost:8011/** for parent review; it uses fictional fixtures and no Azure calls. Existing servers and shared tasks were not restarted or modified. Live behavior, screen-reader speech, real-device appearance and parent usability approval remain unverified. This visual increment does not integrate the activity preview or change `/demo`; the next step is parent review of this calendar styling before any further navigation/layout work.

## Previous review: documentation only, UI changes paused

15 September 2026, after the parent reported that the UI seemed overwritten. The parent subsequently instructed **no UI fixes or updates for now**, while retaining the request to review and update documentation. This section supersedes the earlier implementation permission for the current turn: only this document is being edited. No UI, auth, shared assets, routes, tests, configuration or running servers are changed.

### What was actually found

**The friendlier activity preview remains present; an accidental overwrite is not established.** The current experience contains different screens that have not been visually integrated. The owner page has also progressed beyond the earlier calendar-list screen described in this document's historical execution record.

| Surface | Current source evidence | What the parent encounters |
| --- | --- | --- |
| Original fictional demo, port 8000; also owner-server `/demo` | [Root markup](../index.html), [root styles](../styles.css), [owner-server route map](../scripts/serve-owner.js) | Blue/gray prototype with calendar controls, example questions and dropdown activity filters. It is not the newer pastel preview. |
| Local owner page, port 8002; synthetic counterpart configured for 8003 | [Owner markup](../owner/index.html), [owner styles](../owner/owner.css), [availability renderer](../owner/availability-ui.js) | Current source presents a fixed Sunday–Saturday weekly diagram, 20–26 September 2026 in Asia/Taipei, with two parallel person tracks per day. The previous list/selection section remains hidden and inert. This describes source code, not a verified live schedule or server version. |
| Isolated activity preview, port 8010 | [Preview markup](../activity-preview/index.html), [preview styles](../activity-preview/preview.css) | The sunshine illustration, purple/cream palette, emoji chips, optional preferences and **Find a little fun** action are still present. The existing shared preview browser snapshot also shows these controls. It retains its separate fictional September dates in America/New_York. |

The owner navigation's **Explore fictional activities** link resolves to `/demo`, which maps to the root demo, **not** the isolated activity preview. Neither that route map nor the owner navigation currently connects to port 8010. Opening the activity link from the owner page therefore leads to the old activity experience. This is a confirmed navigation mismatch with the newer visual direction, and a plausible explanation for the reported impression; it is not proof of the exact page or sequence the parent saw.

The earlier isolated implementation deliberately avoided shared entry points to protect parallel auth work. That explains the documented separation, but does not establish the cause or intent of every subsequent change. A review of current markup and the prior record shows that the owner surface has evolved; attribution to a particular thread is not verified.

Evidence limits:

- Direct `git status --short` shows substantial pre-existing modified/untracked work. `activity-preview/`, `owner/` and this document remain untracked; `git ls-files` returns no entries for them. There is no committed version history for those files from which to prove or rule out intermediate overwrites.
- The current root stylesheet SHA-256 equals the fingerprint captured at the prior preview completion: `f3bd453a03a7f35267c82263f05ff163e55483ec46454ba98e5f8f81ad5c38b9`. This supports that particular file's unchanged content since that checkpoint, not that all UI files or loaded browser versions are unchanged.
- Only the existing **fictional activity preview** browser snapshot was read. No real owner page, private calendar result, account API or cloud resource was inspected. Owner findings are based on static markup/CSS/controller inspection; loaded-state/mobile appearance and current server behavior were not revalidated.
- The earlier 14/178 test totals below are historical. This documentation-only review does not claim a fresh test run or renewed parent usability approval.

### Design assessment and recommended next changes

These are **proposals for later review, not changes made or currently authorized**. Preserve the parent's priorities: fewer words, intuitive symbols with short labels, and a warmer, cuter parent-facing design.

| Priority | Observed issue | Recommended design direction | Boundary that must remain explicit |
| --- | --- | --- | --- |
| 1 | The same brand opens different activity designs; the owner link returns to the older demo. | Agree on a canonical parent journey and a clear distinction between **Calendar**, **Activities**, and **Design preview**. Coordinate a deliberate route/entry-point change instead of replacing shared files or silently changing the destination. | No implied integration: real schedule data must not enter the fictional preview merely because pages are linked. Auth thread owns its current routes until coordination. |
| 2 | Owner controls expose exact slot counts, implementation terminology and multiple status paragraphs before the calendar. | Show one compact review summary (people/default calendars, full dates, time zone, busy-only use, audience and retention), explicit acknowledgement, and one primary **Check week** action. Group deeper implementation explanations under a clear disclosure. | Do not conceal the access summary or the material fact that a cached snapshot can remain until Clear/restart, lacks a retention timer, and does not recheck provider permissions. Cached/stale/partial/cleanup failures need visible concise labels. |
| 3 | The weekly grid has a 1064px minimum width and a 1152px time axis; all seven days and 24 hours are rendered even before data is available. | Prototype a compact **Not checked** initial state and a mobile day selector/day view alongside the full desktop week. Let parents see one day's two tracks without continuous sideways scanning. | This is a layout proposal, not authorization to reduce the checked week or omit overnight blocks. Keep every day/hour reachable, exact time labels, keyboard access and Unknown distinct from no busy block. |
| 4 | Root/owner use blue system styling while the preview uses rounded purple/cream styling. Owner CSS inherits root styles. | Reuse the preview's warm color, radius, spacing and short-label direction in a scoped presentation layer after approval. Keep the calendar calm; use playful symbols mainly for navigation and activity categories. | Do not copy the entire preview stylesheet into the owner page: its global selectors and form rules could affect consent controls. Use scoped tokens/component styles, not a new framework or a broad shared refactor. |
| 5 | Preview copy repeats several cheerful slogans and fictional/uncertainty explanations; the hero takes vertical space on mobile. | Keep one short greeting, a smaller decorative illustration on narrow screens, compact inputs and one primary action. Consolidate repeated nonessential explanations into Details. Cards should prioritize title, time, age guidance, price basis and one reason. | Keep a prominent fictional-data notice, result provenance and visible travel/space/availability uncertainty. Cut repetition, not safeguards; don't shrink essential text to save space. |
| 6 | A basketball emoji represents all Sports, while specific interests and participation format require secondary choices or literal keywords. | Consider contextual subchips such as **Basketball** after Sports, and a short **Play / Class / Watch** choice. Use icons with labels rather than unlabeled emoji. | Do not imply the current keyword matcher understands free-form requests or exclusions. No silent broader search, guessed ages or persistent child profile. |
| 7 | Owner and activity preview show different dates and time zones with no slot handoff. | A later integrated journey should display the selected window and zone consistently, with a clear origin label and editable manual alternative. | No automatic copying or zone relabeling now. An approved handoff must preserve instants, checked sources/freshness/missing context and revocation cleanup; an empty-looking calendar is not proof of free time. |

Proposed concise owner screen hierarchy: **week + time zone → people/source context → review and confirm access → Check week → freshness/status → calendar**. Secondary explanations and recovery controls should remain easy to find, but should not compete with the main task. Keep **Clear** available and meaningful; no automatic reload, provider request, cache-policy change or consent bypass is implied by a visual simplification.

### Coordination and next review

UI implementation remains paused. Before resuming, agree which surface is being revised, the exact file ownership and navigation changes with the auth thread, and the intended mobile/desktop layout. Use only synthetic owner fixtures for future visual testing; do not inspect or screenshot real schedules. Parent visual review, keyboard/screen-reader checks, status contrast and truthful disclosure remain separate acceptance gates.

This follow-up changes this document only. It does not reconcile other threads' README/auth records, restart processes, change browser selections, rerun live verification, or restore files from an assumed earlier design.

## Scope recorded before implementation

15 September 2026. The parent approved revising the activity UX toward fewer words, intuitive symbols and a cuter design, with two explicit conditions: document the work first and avoid conflicts with another thread working on authentication.

This record precedes implementation. Approval is limited to a local, fictional visual/interaction preview, not online search, calendar integration, auth changes, deployment or the full [activity-search component proposal](activity-search-component.md).

## Concurrent-work boundary

This thread owns only the new `activity-preview/` directory, this document, and a new dedicated activity-preview test file. No existing application files will be edited or imported by the preview.

Leave root markup/styles/application, README, existing product plans, package manifests/lockfile, VS Code tasks, agent instructions, existing tests, browser fixtures, owner/picker code, scripts, infrastructure, configuration and auth documentation untouched. Do not inspect real owner-calendar browser pages, call their APIs, restart their servers, modify credentials, or run cloud commands. Do not stash, revert, stage, commit or push any work.

Use a dedicated browser page. Try opening the isolated HTML directly; if browser file access is unavailable, use an allowlisted loopback-only static server inside the preview directory on a separate port. It must serve only preview assets, never the repository or auth files, and must not alter shared tasks or existing servers.

The working tree already contains substantial modified/untracked work. Other-thread changes during validation are not ours to fix. Direct baseline on 15 September: `node --test` returned **164 passed, 0 failed**. Later totals may include concurrent additions; report the dedicated preview suite separately.

## Visual and interaction direction

- One friendly question: **What sounds fun?** Short supporting text, generous space, cream/lilac/peach colors, soft rounded cards and a small decorative sunshine motif. Parent-facing, not a child-facing game.
- Emoji paired with short visible labels: Basketball/Sports, Music, Art, Science, Outdoors and Exhibitions. Native checkboxes styled as chips; a checkmark and checked state communicate selection without color alone. No decorative emoji in accessible names.
- Compact **Sample time** and optional **Age** controls first. Fixed, clearly dated fictional windows and an explicit time zone; no implied calendar connection or live free-time calculation.
- One primary action: **Find a little fun**, with **Fictional examples only** beside it. No recommendations appear until requested.
- Put format (try/class/watch), sample price limit, indoor-only and optional keyword refinement under **A few preferences**. Keyword matching is literal, not general language understanding; unsupported sentence/negation input must not be silently interpreted as requirements. No personal location or profile requested.
- Result cards show a playful illustration/emoji, title, time, age guidance, price basis and one short suitability sentence. Put source identity and longer limitations under **Details**, while **Fictional example**, **Travel not checked**, and **Spaces unknown** remain visible. A shared visible statement says no calendars were checked.
- Provide useful empty results, an explicit reset, short validation messages, and clear old results immediately when filters change. Do not silently relax filters or add simulated loading delays.
- Icons never replace consent, safety or uncertainty labels. No booking, save-to-calendar, invitations, account/avatar/settings controls or fake live-source buttons.

## Implementation boundary and deliberate omissions

Use dependency-free HTML/CSS/JavaScript, pure CommonJS-compatible matching helpers and synthetic fixtures. The isolated page must not import the existing app (which includes consent logic) merely to reuse a small helper. Keep text rendering escaped and classes allowlisted; no external images/fonts/scripts, fetch, storage, cookies, analytics or model calls. Reset/reload/page exit clears this page's choices/results; no auth state is read or changed.

This is not the full component milestone. Arbitrary date/time editing, calendar-derived slot handoff, multi-person ages, geographic search, natural-language parsing, routing, live evidence/extraction and provider failure states remain future work. Fixed sample slot containment checks are not a production time-zone or availability engine. Age guidance is not proof of admission eligibility. Sample prices have explicit USD/unit labels, not inferred family totals.

## Acceptance and verification

1. The page works independently of auth and the main demo, with a brief initial surface and expandable secondary content.
2. Age, interest (OR across selections), format, slot, indoor-only, sample price and keywords change only fictional matches after explicit submission. Empty matches and invalid keywords are recoverable; changing a filter invalidates old cards.
3. Unknown age/travel/space/calendar facts never become verified suitability or availability. Synthetic sources are not presented as current web research.
4. All controls have visible accessible labels, keyboard access, a visible focus indicator and approximately 44px minimum targets. Check desktop and 320–390px mobile without horizontal overflow; expand preferences/details and test empty/reset/focus flows.
5. Run dedicated offline tests, then the existing full suite and whitespace checks. Record actual totals, browser findings, no-network evidence, limitations and exact owned files below after implementation.
6. Leave integration into the shared app for a later coordinated change after visual review and the auth thread's work. Do not edit shared entry points now.

## Execution record

Implemented only the owned, isolated additions:

- [Preview page](../activity-preview/index.html), [scoped styles](../activity-preview/preview.css), [pure matching helpers and six synthetic fixtures](../activity-preview/core.js), and [page controller](../activity-preview/ui.js).
- [Loopback static preview helper](../activity-preview/serve.js), serving only the four browser assets. Direct file preview was denied by the integrated browser's trusted-folder check, so this helper was started on **http://127.0.0.1:8010/**. No shared task/server was changed. Start it with `node activity-preview/serve.js` from the repository root if needed; stop its own terminal with Ctrl+C.
- [Dedicated offline regression tests](../test/activity-preview.test.js). Run `node --test test/activity-preview.test.js` for the isolated suite; no build or dependency installation is needed.

Actual validation on 15 September 2026:

- Dedicated tests: **14 passed, 0 failed**. Full offline suite: **178 passed, 0 failed** (164 baseline + 14 preview tests). `git diff --check` passed. Focused read-only review found no blocking issues in the owned additions.
- Shared-file SHA-256 fingerprints matched before/after for root README, markup, app, styles, both package manifests and VS Code tasks. No existing files were edited by this increment; owner/picker/auth/infra/scripts and their existing tests were untouched. No shared or real-calendar browser page was used. No cloud actions, account access, commit or push.
- Browser default submit returned three examples only after the click. Keyboard Space toggled interests; Enter opened preferences/details. Age, interest, format, indoor, price and keyword combinations filtered samples. Invalid negation input focused the error field; unmatched keywords showed the empty state. Editing removed old cards; reset cleared choices/results and returned focus to Sample time. Unknown exhibition age stayed **Needs checking**, not a confirmed age match.
- Narrow-layout checks used **319px and 390px actual CSS viewport widths**, with expanded preferences and card details; desktop layout was checked at **1279px actual CSS width**. No horizontal overflow was observed. Core keyboard/error/empty/reset interactions were also repeated at 319px. Actual checkbox hit areas cover the full cards and exceed 44px in both dimensions; a too-small hidden input hit area discovered in browser review was corrected and regression-covered.
- The embedded browser was zoomed to approximately 67%, so nominal Playwright viewport sizes did not equal CSS viewport widths. Width assertions used measured `innerWidth` and verified mobile media-query activation rather than assuming the requested size. Desktop and narrow-mobile screenshots were visually inspected.
- A monitored reload and interactions requested only this preview's local HTML, CSS and two JavaScript assets, with no JavaScript page errors or external requests observed. CSP disables connections and form submissions; offline tests verify there are no shared imports, storage or networking calls in browser code. The preview server tests deny non-allowlisted files, traversal, nonlocal Host headers and write methods.

Limitations remain deliberate: fixed fictional slots, literal English keywords (not free-form AI), sample age guidance/prices only, no real activity source/calendar/travel/space verification. Screen-reader speech, real-device browsers and parent visual/usability approval are not established. Integrating this design into the shared application requires a later coordinated change with the auth thread; no root entry-point link was added here.