# Our week: Kimi in the shared calendar

## Chat Calendar month overview, 18 September 2026

The conversation Calendar now opens as a month overview, not the October 9-11
time grid. Its 42 civil-date cells show at most one marker per loaded source per
day, derived from parent busy/tentative/out-of-office runs or noncancelled child
events. Empty/unloaded dates do not invent markers or establish free time.
Month cells contain source labels, never event titles or times. An explicit day
selection opens the existing detailed Calendar UI locally; routine details stay
closed. Source freshness, partial/stale/errors and lifecycle fencing remain intact.

Start/End controls are removed from the chat UI, including expanded Details.
Hidden internal values keep the existing controller and fixed approved October
9-15 query scope compatible. Month navigation and selecting a day change only
presentation, never query bounds, shared dates, consent or provider requests.
Standalone owner date controls are unchanged. The public contract remains
`familycopilot.chat.v1` with only expand/collapse/dispose; no event export was added.

Files: `owner/chat-calendar-template.js`, `owner/availability-ui.js`,
`owner/chat-calendar.css`, `test/chat-calendar.test.js` and this record.
Four focused month tests passed, covering initial absence of markers, exactly
seven fixture coverage dates, source markers, hidden dates, day focus, no-query
navigation, retained dates/freshness, invalidation/Clear and year boundaries.
The 15-file regression matrix below passed **353/353 in each of UTC,
Asia/Taipei and America/Los_Angeles**, with zero failed/cancelled/skipped:

```text
node --test --test-reporter=tap test/chat-calendar.test.js test/chat-integration.test.js test/chat-contract.test.js test/chat-conversation.test.js test/owner-ui.test.js test/availability-ui.test.js test/child-calendar-ui.test.js test/child-sync-ui.test.js test/our-week.test.js test/date-selection.test.js test/owner-presentation.test.js test/week-display.test.js test/quiet-week-ui.test.js test/child-saved-ui.test.js test/week-polish-ui.test.js
```

Browser review used a new owned synthetic page at
`http://127.0.0.1:42111/chat/index.html`. The existing PID 5097 listener was
rechecked as a GET/HEAD static-asset allowlist in this checkout, with no API route;
it was neither adopted nor restarted. Measured 1920/375/321 CSS-pixel layouts had
no document overflow; mobile marker labels fit without truncation. Desktop and
mobile screenshots were inspected. Native Enter/Tab/Shift+Tab operated Sync,
previous/next month and day selection, which focused the details grid. Expanded
source Details exposed zero date inputs. Startup and interactions produced zero
fetch/XHR requests. Final mobile CSS was rechecked in the browser. No real tab,
provider, private snapshot, live service or cloud resource was accessed.

Builder handoff: shared/chat files remain Builder-owned. This completes the
month presentation and date-input removal, not real-data embedding. The owner's
real-demo approval is recorded, but the current mount is still synthetic-only;
real embedding needs a coordinated implementation of the shared live boundary,
not a repeat consent question or a silent fixture-to-network switch. No GPT call
is wanted for this demo. The second Kimi Sync investigation remains deferred.
No backend activation, commit or push was performed or required for these assets.

## Compact chat Calendar source details, 18 September 2026

The owner requested removal of the repeated sample/source/window/timestamp wall
from the conversation Calendar. The chat template now places those existing
controller-owned paragraphs inside a single, initially closed Details disclosure.
It remains accessible outside the collapsible Calendar body. Opening it retains
exact coverage, original independent timestamps, saved/fresh provenance and
disclosures without another request. The default surface has only a concise
sample-calendar/date/zone line, three source states and necessary errors.
Partial, missing, loading, unavailable and stale states remain explicit when
collapsed. Cleanup/disposal safety notices remain outside Details.

Changed files: `owner/chat-calendar-template.js`, `owner/chat-calendar.css`,
`owner/availability-ui.js`, `test/chat-calendar.test.js` and this record. The
shared availability controller updates optional chat-only summary nodes; the
standalone page has none and retains its existing presentation. No provider,
consent, date, request, cache, event export or lifecycle contract changed.
This is a Calendar presentation refinement of `familycopilot.chat.v1`; Builder
continues to consume only expand/collapse/dispose, never source summaries/data.

Baseline Calendar/availability/week tests passed. The updated collapsed-source
regression failed against the old always-visible template, then passed after the
change. Added repeated-Sync, closed/open Details and compact missing/stale-state
checks. Calendar/availability/chat-integration/week tests passed 161/161; the same
15-file matrix recorded below passed **343/343 in each of UTC, Asia/Taipei and
America/Los_Angeles**, zero failed/cancelled/skipped. Editor diagnostics and scoped
whitespace checks passed. This supersedes the prior 342-per-zone count only for
this newly executed matrix.

Fresh browser rendering is not verified for this change: the previous 8041 preview
had no listener, and direct WSL file navigation returned `ERR_UNEXPECTED (-9)`.
No service was started or restarted, no existing page was reloaded, and no private
data/provider was accessed. Earlier screenshots do not validate this new layout.
Reload current static assets for the change; a preview serving in-memory startup
copies needs its owner to refresh the preview assets. No production backend
activation, commit or push is needed or performed.

Builder handoff: the owner also asked whether the chat input should stay fixed
during the demo. Recommended behavior is a bottom-anchored composer, constrained
to the conversation width, with reserved scroll space so the last message and
Calendar controls are never covered. Account for safe-area insets, mobile virtual
keyboard/visual viewport, textarea growth and keyboard focus. The Builder-owned
chat stylesheet/shell were inspected but not changed; this Calendar increment
does not claim that the fixed composer is implemented or transfer file ownership.

## Chat Calendar offline milestone complete, 18 September 2026

The owner's request to finish the Calendar work closes the approved synthetic
`familycopilot.chat.v1` milestone using the combined Calendar and Builder evidence.
Calendar's previous browser-tool limitations below are historical observations,
not outstanding automated acceptance after incorporating
[Builder's completed integrated browser review](chat-integration-contract.md#13-isolated-synthetic-browser-review).

That review records measured 1920/375/321 CSS-pixel layouts, desktop/mobile
screenshots without overlapping controls or document overflow, browser-keyboard
Sync and collapse/reopen, narrow-grid ArrowRight scrolling, and awaited synthetic
Calendar disposal. It also verifies that the integrated conversation can refine
activity dates without calendar coupling, with zero fetch/XHR or external
requests. Calendar's own checks below additionally establish retained grid,
dates, original freshness and manual scroll, plus the two late-response date-race
regressions. The final Calendar/chat matrix passed 342/342 in each of UTC,
Asia/Taipei and America/Los_Angeles.

These are combined, previously executed checks, not a new browser session or
repeated test run in this close-out. No reproducible product defect remains from
this review that requires a Calendar code repair. The verbose mobile status strip
is a possible later presentation refinement, not a failed functional check or
permission to hide source/coverage/freshness/unknowns.

Calendar implementation and automated integration acceptance are complete for
this offline milestone. Human parent review, assistive technology and physical
device/pointer testing remain distinct release/usability reviews, not claims made
by automated browser keyboard tests. Real calendar embedding, provider validation
and the explicitly deferred second Kimi Sync hang are outside this completion.

This close-out edits only this Calendar record; Builder's evidence and all product
files remain unchanged. Link/anchor and whitespace checks passed. No new process
was started or stopped; a read-only socket check found no listener on the former
8041 review port. No live service, real browser tab, private snapshot, provider,
deployment, commit or push was accessed or performed. No activation is needed.

## Chat Calendar integration follow-up, 18 September 2026

The owner explicitly approved continuing Calendar's conversation-UX integration
and synthetic review, while deferring the real second Kimi Sync hang. That issue
is not a blocker for this offline milestone. Contract remains
`familycopilot.chat.v1`; no live embedding, provider or storage change is implied.

This increment changes only [test/chat-calendar.test.js](../test/chat-calendar.test.js)
and this record. Two new regressions hold a child or parent response pending,
collapse Calendar, change dates outside the scope and back, then deliver the old
response. Both verify no restored grid/child events, no new Sync, no external date
storage or Calendar event export, and no destructive Clear. Existing implementation
passed both cases; no product-code repair was necessary. Other writers' changes
and the Builder-owned contract/shell were preserved.

Baseline `node --test --test-reporter=dot test/chat-calendar.test.js
test/availability-ui.test.js test/our-week.test.js` passed. The new focused command
`node --test --test-name-pattern='collapsed date-away-and-back'
test/chat-calendar.test.js` passed both selected tests (23 unrelated tests skipped).
Final command, separately under UTC, Asia/Taipei and America/Los_Angeles:

```sh
node --test --test-reporter=tap test/chat-calendar.test.js test/chat-integration.test.js test/chat-contract.test.js test/chat-conversation.test.js test/owner-ui.test.js test/availability-ui.test.js test/child-calendar-ui.test.js test/child-sync-ui.test.js test/our-week.test.js test/date-selection.test.js test/owner-presentation.test.js test/week-display.test.js test/quiet-week-ui.test.js test/child-saved-ui.test.js test/week-polish-ui.test.js
```

Each run passed **342/342**, zero failures/cancellations/skips, within a 90-second
bound. New-test editor diagnostics and scoped whitespace checks passed.

Browser review used a new disposable page on the already-running 8041 preview,
not the shared user page. Read-only process inspection established PID 1726,
workspace `/home/davidtang/Projects/FamilyCopilot`, branch `davidtang/demo-v2`, and
an inline Node static server with a fixed asset allowlist, in-memory startup
copies, loopback/Host/method guards, and no API/private-file routes. These are
observations, not ownership of that pre-existing process; it was not restarted,
stopped or adopted. No preview process was created by this increment.
Only the new review page was closed; a subsequent browser lookup returned
page-not-found. The original shared page was left untouched.

Browser DOM actions confirmed synthetic Sync, collapse focus transfer to the
toggle, preservation of manual scroll on reopen, and no page overflow at measured
375 CSS pixels or the wider desktop check. The grid retains internal horizontal
scroll. The scripted September 19-20 refinement left October Calendar dates,
grid identity and original freshness unchanged. Resource timing contained zero
fetch/XHR requests throughout these actions. This is synthetic presentation
evidence, not live-calendar access or a claim of actual AI.

Physical Enter did not activate Sync and pointer actionability timed out in the
browser tool. Functional checks therefore used DOM-dispatched actions; actual
keyboard/pointer acceptance remains open. Viewport screenshots were obtainable,
but did not reliably reflect requested scrolling, so full grid visual acceptance
is not claimed. The status strip remains vertically verbose on mobile and needs
further presentation review without hiding source/coverage/freshness/unknowns.
The date-picker implementation mentioned in historical memory was absent from
this checkout's actual controller; no speculative replacement was added.

At this checkpoint, Calendar's own browser tooling had not completed visual and
keyboard acceptance. The completion record above incorporates Builder's successful
integrated review without repeating it. No production activation is needed for
these test/document changes. No real tab/snapshot, port 8002, provider, cloud
resource, dependency, commit or push was touched.

## White loaded-event gaps, 18 September 2026

Requested presentation-only change: loaded Kimi tracks use white gaps without
the Gaps unknown label or striped background. Accessible track descriptions and
Details still explain unknown gaps; no free-time inference. Unloaded/failed
tracks retain their Unknown text and pattern. Event blocks and all-day/timing,
provider scope, Sync, snapshots and consent are unchanged.

128/128 availability, week-polish and child-week tests passed. Owned synthetic
8035 preview with intercepted fictional responses confirmed white/no-pattern/no
gap label, event retained, keyboard Sync and no overflow at 993px/375px. Preview
stopped; no real tabs, provider requests or shared-service restart. Static reload
only; no commit/push.

## Consumer-facing calendar polish, 18 September 2026

Implemented the six requested presentation changes in owner markup/styles/UI:
removed the repeated timezone under Our week; idle member chips show names only,
ready members use a checkmark, and partial/loading/unavailable states remain
explicit. Full status stays in accessible names and tooltips. The add button now
shares the member palette. A single calendar-icon Sync button sits above the
empty-state heading and becomes a compact action when results are displayed;
loading feedback and existing disabled/fail-closed gates are unchanged. Removed
the standalone arrow row; secondary text-labelled day paging remains in Details.

The full 24-hour grid now scrolls vertically, initially to 06:00 Taipei (12 existing
24px slots). Date/person headings and all-day bands stay sticky. Midnight events,
all 336 parent slots and exact child timing remain intact; this is not a provider
window change. Manual vertical/horizontal position survives freshness redraws.
Home/End on the focused grid reach the start/end; child event keys are untouched.
No changes to provider/source/consent/cache/date-sharing behavior or Activities.

Validation: UTC 242/242 focused presentation/availability/child/week/date tests;
Asia/Taipei and America/Los_Angeles 50/50 each for week polish/display/integration.
Whitespace and editor checks passed. Owned synthetic memory-only 8035 review:
zero startup API calls, keyboard Enter Sync/add member and Home/End, initial
06:00 alignment below the sticky header, earlier synthetic event reachable at
Home, all-day band retained, no page overflow at 1500px and 375px CSS widths.
One synthetic parent HTTP request hit browser ERR_NO_BUFFER_SPACE; the final
layout review used browser-intercepted fictional parent/child responses, not live
data or a claim of backend connectivity. One initially malformed fixture was
rejected as unavailable before correcting it to the existing interval schema.
The review process was stopped afterward. Shared 8002 and real calendar tabs
were untouched; reload serves the static changes, no restart needed. No commit/push.

## Interactive demo member list, 18 September 2026

User explicitly accepted fake member management for the demo. Added a working
plus button, name editor, per-member minus buttons and Reset members in the
existing owner markup/controller/styles. Enter adds, Escape cancels, and focus
returns to plus. Empty/duplicate/control-character/overlong names are rejected;
the roster is limited to 12. Names render as text, never HTML.

This is explicitly a **demo member list only**: new entries say Demo, and removing
a name affects the list, not calendar columns, Sync targets, authorization, source
references or snapshots. State exists only in this page and resets on reload.
No storage, provider calls, new profiles, activity changes or backend changes.
Existing real per-person status bindings remain unchanged.

Verification: baseline availability/quiet UI 98/98; UTC member-demo, availability,
quiet, child-sync and our-week tests 179/179; focused member/quiet/child-sync tests
55/55 each in Asia/Taipei and America/Los_Angeles. Diagnostics and whitespace clean.
Owned synthetic memory-only review on 8035 (public search disabled) verified real
keyboard Enter/Escape, add/remove/reset and focus; zero startup/API requests;
no horizontal overflow at 993px or 375px CSS width including long-name/editor
states. Preview stopped after review. Shared 8002 not restarted or queried;
static page reload is sufficient. No commit/push.

## Kimi source enrolled and events read, 18 September 2026

The user explicitly approved agent source listing, then event reading, and Go
after clarification that import means loading into FamilyCopilot, not writing
Outlook. This later authorization supersedes the user-only gate for this one-shot
repair. Existing guardian/details/window/retention scope was preserved.

Executed `node scripts/enroll-kimi-once.js --approved-enroll-once` after 8/8
offline helper tests, clean diagnostics, safe-idle inspection and whitespace check.
The exact requested label Kimi matched one returned source among five; listing
was partial, so this is not a complete inventory or proof of historical identity.
The current session's opaque handle and exact review token were used for the
approved new enrollment. No cached-name migration or fuzzy/first-source selection.

Result: imported, six projected events, partial false, sourceRemembered true,
localIdle true, disabledVerified true, success true. Independent native status
validated cleanup/preserved contracts after the operation. Only safe status/counts
were output; no event titles/times, raw IDs, handles, tokens or private-file reads.
The existing server committed the caller-bound reference and permitted child
snapshot. Parent snapshot and Activities were untouched. No restart or deployment.

This resolves the missing-source enrollment gate described below. Reloading the
page and using Sync can now open the saved child result; later explicit Sync uses
the remembered source. A separate live remembered-source refresh was not repeated
merely for verification; that path has offline and synthetic browser coverage.
One-shot listing/import approval is consumed. No commit or push.

## Explicit activation approval, 18 September 2026

The user explicitly agreed to restarting the shared owner service for the new
Sync backend. This is not authorization for an agent calendar listing/import,
private snapshot inspection or repeated source-selection UI. The user's prior
source instructions are not missing consent; the implementation failed to retain
the machine source reference. Do not ask the user to repeat those instructions.

Activation completed: the original service stopped, independently checked
8002/18002 were absent, and an existing-task handoff timed out. A subsequent
preflight returned a generic failure; separate parent and child native status
checks then both succeeded. No calendar queries or cloud mutations were made.
The approved already-stopped handoff then completed under the operation lock:
existing Windows-auth task, PID 85202 (historical observation), live/disk,
idle/not_requested, safeIdle and all markers including childSyncProtocol true.
Independent local status confirmed these markers and released 18002; Activities
assets matched and tpbl-teams-v2 remained intact. Focused regression: 141/141.
No private cache read, source enrollment, calendar refresh, commit or push.
Restart approval is consumed. Existing source-reference recovery remains an
implementation gap, not a request to repeat the user's stated choice. No setup
controls were added and actual Kimi fresh-read usability is not yet verified.

## Remembered-source Sync implemented offline, 18 September 2026

The later explicit Go approved implementing remembered Kimi source reuse and
connecting it to the common Sync button. This supersedes the earlier parent-only
Sync limitation **on a current backend with an enrolled source**. No activation,
real calendar query, private snapshot inspection or cloud deployment was performed.

- New `child-sync-v1` capability gates `/api/child/sync`. First Sync opens a saved
  child result or queries an enrolled source; later Sync requests a fresh child
  result then fresh parents, serially. Older backends retain saved-only behavior
  without endpoint probing. No automatic request/retry or repeated consent UI.
- A successful explicitly reviewed import now enrolls an exact native caller-bound
  SHA256 source reference. Separate private local storage retains that reference,
  reviewed access and exact October window. Raw source IDs, session seals, keys,
  review tokens and credentials remain unsaved. Native Sync relists at most 100
  sources and matches only the reference, never source names, then independently
  authenticates/imports the fixed window with existing cloud redaction/cleanup.
- Invalid/revoked/cleanup/storage failures fail closed; source and result stores
  are independently cleared. Clear deletes both plus parent snapshot; completed
  records survive page/date changes and backend shutdown. Late writers are fenced.
  Source failures are visible to metadata-only safe-idle inspection.
- **Existing caches have no reference and cannot migrate from their display name.**
  They can still open on first Sync; fresh Kimi Sync returns not connected until
  one explicit source enrollment. The main page has no setup wizard. Existing
  backend find/review/import endpoints support enrollment, but a user-facing
  one-time setup entry remains outstanding; do not describe live usability as done.

Verification: combined 19-file native/storage/server/UI/status/activation regression
command passed with dot reporter (exit 0); UI implementer additionally passed 256
tests in each of UTC/Taipei/Los Angeles. Individual native/source/server regression
results are in the focused test files. Owned memory-only synthetic 8034 review
enrolled a fictional fixture without exposing its reference, reloaded into a fresh
session, and keyboard Sync returned all three loaded states. A second keyboard
Sync issued exactly child `refresh:true` then parent `refresh:true`; initial flags
were both false. Focus returned to Sync and no page overflow at 1920/375 CSS px.
Review page closed and owned process stopped. No real browser tabs were inspected.

Changed layers: windows-child protocol/worker/controller and tests; new
child-source-store and tests; child-calendar-session and serve-owner with server
regressions; three owner presentation files, shared harness and child-sync-ui
tests; owner-local-status and its tests. Activities/demo files remain untouched.

Next gates: coordinated, separately approved 8002 activation, independent native
`childSyncProtocol` verification, and one-time user-only source enrollment. No
restart approval is inferred from offline implementation Go. No commit or push.

## Quiet person status labels, 18 September 2026

Removed Stale from the three person buttons at the user's request. Original
timestamps and freshness warnings remain in Details; no age, expiry, cache or
query behavior changed. Kimi still lacks remembered-source live refresh: the
shared UI currently reads a saved child result only, unlike the parent refresh
path. This is an implementation gap, not evidence of a Microsoft restriction.

## Single Sync action, 18 September 2026

Sync replaces the visible Load and Update buttons. The first click retains the
existing saved-child-then-parent load; subsequent explicit clicks use parent
`refresh: true` and preserve unaffected Kimi saved data. The former Update control
is hidden; Sync inherits its retry eligibility after ordinary failures, while
pending, expired, revoked, storage and cleanup blocks remain enforced. No automatic
retry, new source import or live Kimi refresh is introduced. The empty-state note
requested for removal is also deleted. Static reload only; no backend restart.

## Compact calendar controls, 18 September 2026

The heading no longer repeats selected dates. Parent target information and the
date/scope explanations are in collapsed Details. Confirm is now labelled **Load**;
the separate View saved only control is hidden from the UI (its existing internal
handler and cache-only contract remain unchanged). Load still opens the child
saved view and loads parents; Update remains parent-only. No new Kimi import or
remembered provider-source authorization is implemented.

Mike, Debby and Kimi have matching status buttons driven by the current validated
results. They distinguish not loaded, loading, unavailable, loaded, partial and
stale data. Only available results enable a button; activating it focuses the
shared calendar without fetching or changing filters. No result is assumed loaded
from a display name or cached-file existence.

Offline baseline: 96 tests passed. Final seven-file UI suite passed in UTC,
Asia/Taipei and America/Los_Angeles: availability-ui, quiet-week-ui,
owner-presentation, shared-confirmation, child-saved-ui, our-week and week-display.
Whitespace check passed. Owned RAM-only synthetic review on 8034 showed zero
startup API resource entries, keyboard Load and status-button-to-grid focus,
truthful missing-child state, and no page overflow at measured 1920/375 CSS px.
No real page, private cache, provider query or shared service restart was used.
Static reload applies these changes.

## Kimi-specific UI operations removed, 17 September 2026

The user explicitly requested removal of all Kimi calendar operations from the
UI. The Calendar access entry, modal, source/person/disclosure selectors, guardian
checkbox and child find/review/import/change/remove/skip/cancel buttons are now
removed, not hidden. No shared action can reopen the wizard. Relevant retention
and saved-access information remains in common Details; fixed unknown/stale/error
states and Kimi's event display remain.

**Current scope is saved viewing, not remembered live-source authorization.**
Confirm reads a matching existing Kimi snapshot and loads parents without a
second confirmation. A child miss stays unknown and does not block parents or
open setup. View saved only independently reads both snapshots, never falling
back to Outlook. Update queries parents only and preserves unaffected Kimi names
and original freshness, clearly labelled saved-only. Common Clear still deletes
both saved views when deliberately clicked. Date/expiry/access/cleanup failures
retain synchronous hiding and late-response fences. No provider ID is guessed
from the cached display name. The earlier request to remember a provider source
for one-click live child updates remains **unimplemented**, not satisfied by
removing its controls. There is no new-import/live-Kimi-refresh UI in this version.

Changed four owner presentation files and their focused UI tests/harnesses.
Obsolete wizard interaction tests were replaced by no-operation/saved-display
regressions; backend source/guardian/disclosure/token enforcement tests remain.
Delegated baseline 204/204; final expanded suite 308/308 per UTC/Taipei/Los Angeles.
Independent main execution passed **264/264**, zero failures, for `node --test`
with availability-ui, child-calendar-ui, child-saved-ui, shared-confirmation,
our-week, week-display, date-selection, basketball-ui and owner-presentation tests.

Owned synthetic RAM review on **8034** verified zero startup API requests and
zero child operation controls/dialogs. Keyboard Enter Confirm completed on a miss
without setup. An explicitly seeded fictional fixture (synthetic endpoints only,
not UI auto-import) then survived reload and appeared through one common Confirm:
only child/saved and availability requests. Enter Update sent only availability,
preserving child names/timestamp and focus. Measured **1920/375 CSS px** had no
page overflow. The review page closed and owned process stopped. No real tabs,
saved files, provider/public search, Azure, shared-service restart, commit or push.

Static reload applies this change; no backend activation is needed. Existing
cache contents are not assumed or inspected. This supersedes earlier instructions
to open Calendar access or import through the UI, not backend cache safety.

## Saved-view activation completed, 17 September 2026

The subsequent explicit shared-service restart approval is complete. The existing
Windows-auth task now serves the disk-backed child saved-view capability on 8002,
with independent safe-idle and matching native/child-cache markers. No real tab,
calendar request or private saved file was accessed. Existing session-only results
are not migrated: reload and explicitly review/import once, then use View saved
only on later reloads. The common Calendar access dialog and earlier verified
UI remain unchanged. Activation guards/tests add recognition of child storage
failures and require the new disk marker after restart; **17/17** focused tests
passed. [Exact activation evidence and remaining user step](kimi-calendar-import.md#private-saved-view-activated-17-september-2026).
This supersedes the pending activation checkpoint below, not the separate limits
on provider feasibility, actual import or assistant access.

## Unified saved calendars verified offline, 17 September 2026

The user explicitly approved keeping Kimi's permitted names/times and reviewed
access settings privately on this device **until Clear**, separate from the
parent file. This supersedes older child session-only and parent-only saved-view
statements below, only for this bounded local-owner view. No automatic refresh,
provider permission recheck on saved viewing, browser calendar storage, new cloud
work or assistant disclosure is authorized. Fixed October 9–15 bounds remain.

The standalone child section is replaced by the common **Calendar access** modal.
**Confirm** tries the child saved view first; a miss offers explicit source/access
review without automatically finding calendars. **View saved only** opens parent
and child snapshots independently, without provider fallback. **Update** requires
fresh final review; cached settings never authorize a live source. Parent work
finishes before child import. Both sources retain their original timestamps.
**Clear** removes both snapshots; child source/privacy changes delete the child
copy only. Date changes, page leave and cancelled review preserve completed data
while hiding/fencing page results. Titles stay outside the title-free week bridge.

The new backend uses a separate bounded private child file, strict schema and
local binding, 0700 directory/0600 file and atomic replacement. No source IDs,
handles, review tokens or credentials are saved. Disk retention is until Clear;
synthetic memory retention ends at server restart. Temporary-write cleanup was
independently found defective and repaired: failed rename/removal remains blocked,
and explicit Clear handles owned temporary files, including bounded restart
recovery, without deleting unrelated files. This is not physical secure erasure.

Final directly executed tests: **325/325 in each of UTC, Asia/Taipei and
America/Los_Angeles**, zero failures/cancellations/skips. Exact `node --test` files:
`test/child-calendar-cache.test.js`, `test/child-calendar-saved-server.test.js`,
`test/child-calendar-session.test.js`, `test/child-saved-ui.test.js`,
`test/availability-ui.test.js`, `test/child-calendar-ui.test.js`,
`test/our-week.test.js`, `test/week-display.test.js`,
`test/shared-confirmation.test.js`, `test/date-selection.test.js`,
`test/availability-disk-cache.test.js`, `test/basketball-ui.test.js`.
The disk tests use disposable/injected synthetic storage; no real saved file was
read. No new full-suite pass is claimed.

Browser review used this chat's isolated `serve-child-review.js --synthetic
--port=8034`, with RAM-only sample adapters and public search disabled. Verified:
zero startup API requests; explicit fictional source/guardian/details review;
native Tab/Enter confirmation; reload then saved-only restored literal sample
names and the original timestamp, with only availability/saved endpoints and no
find/import; Clear then reload/saved-only missed both snapshots without fallback.
Escape closed the shared modal and returned focus to the invoking control.
Measured desktop **1920 CSS px** and mobile **375 CSS px** had no page overflow;
the mobile modal had no horizontal overflow. Screen-reader and physical-device
acceptance remain unverified. The page was closed, owned server stopped, and
8034 independently confirmed without a listener. Existing real tabs untouched.

**Activation remains pending.** The shared 8002 service was not restarted, queried
or checked for saved contents. A matching backend restart needs a separate
coordinated approval; static reload alone cannot enable caching. Old/missing cache
markers block child use rather than claiming persistence. Earlier session results
are not migrated: only a new user-reviewed successful import on the matching
backend can create its saved view. No commit or push.

## Consented Kimi event names, 17 September 2026

The user requested event names instead of numbered labels. This narrowly
supersedes the historical title-omitting grid presentation, not the parent
busy-only protocol or the title-free `child-week-changed` bridge.

After validation against the actual reviewed disclosure, the child controller
keeps at most 100 permitted title strings in its page closure, indexed to the
projected event array. A single-registration `FamilyWeekRenderer` callback writes
literal text and accessible labels into the corresponding calendar nodes; it
returns no names. Names never cross the display bridge, shared action interface,
custom events, URLs, date storage or parent snapshots. Private/redacted,
Busy-only and empty titles retain generic event labels. Time, event status,
all-day distinction and unknown availability remain unchanged.

Generation/revision checks prevent stale names attaching to new events. Names
clear synchronously on loading, consent changes, invalid dates, cancellation,
expiry and cleanup/access failure. Paging and valid stale/focus redraws keep the
same permitted names. Markup and dollar sequences are literal text, not HTML;
long names wrap within existing geometry. Normal titles require the existing
explicit **Normal titles and times** review; Mike/Debby remain busy-only.

Changed: four owner presentation files, three integration tests and their
synthetic harness, plus this record. No backend, provider, authentication, date
logic, storage or deployment change. Baseline five-file suite **151/151**;
regressions reproduced **15 failures** before implementation. Final five-file
suite **166/166 per timezone** (UTC, Los Angeles, Taipei); bounded Our week runner
**305 focused + 2 October non-server passes per timezone**, five October listener
cases deliberately skipped. Additional combined UI/server/shell suite **209/209**.
No new full-suite pass is claimed.

Owned sample-only review on unused **8034** used the existing isolated helper,
no private snapshot or public search adapter. Explicit fictional source selection,
guardian/details review and keyboard Enter confirmation displayed the fictional
title as literal text; redacted events stayed generic and accessible labels
matched. Measured widths **1920/563 CSS px** had no page overflow, with internal
grid scrolling at the narrower width. Exact requested 1280/375 emulation and
screen-reader/physical-device validation remain unclaimed. No existing real page
or provider was accessed. The temporary review process was stopped afterward.

Static assets require a deliberate reload, not a backend restart. Reload removes
session-only child data; the user must review/import again with details selected
to see names. No agent real import, cloud work, commit or push is authorized or
performed. Parent review is the next step.

## Shared-action final verification, 17 September 2026

The main reviewer ran full `node --test` directly after reconciliation: **837
passed, zero failed/cancelled/skipped/todo**, exit 0. This includes isolated
synthetic HTTP tests; it does not run a real calendar request. The earlier
17-failure checkpoint below is superseded by the current passing tree.

A dedicated synthetic-only 8027 page completed the common Confirm wizard and
showed both parent results and three fictional child events. The wizard hid after
confirmation; configured Update showed the existing-source summary without the
source-setup panel. Browser actionability/wait checks were unreliable (timeouts);
functional checks used DOM-dispatched actions. No physical keyboard, screen-reader,
exact mobile breakpoint or browser request-count acceptance is claimed here.
Serialization/no-relisting/cancellation are established by the focused controller
tests, not those unreliable browser timing results. The owned synthetic process
was stopped with Ctrl-C; no shared 8002 restart or real-tab inspection occurred.

Delivery is static-only: deliberately reload the owner page. Shared Confirm/Update
starts the integrated flow; the final visible Confirm authorizes the reviewed
operations. Saved-only still excludes Kimi. Existing backend/provider/storage
contracts, source-selection and guardian/disclosure requirements are unchanged.

## Calendar UI diagnostic cleanup, 17 September 2026

The user requested removal of **Read-only calendar** and debug information, and
explicitly handed this chat the previously reserved UI files for this UI-only
change. The live source row is now hidden, including before JavaScript runs;
the controller clears its badge text. Sample review still shows **SAMPLE DATA**
and fictional aliases. Source/mode metadata and script order are unchanged.

Removed the diagnostic output element, visible execution-mode label, duplicate
raw UTC timestamps and operator implementation prose. Storage, retention and
recovery copy now uses parent-facing wording. Routine successful cleanup is
silent; pending, unknown, expired and sticky blocked states retain fixed warnings.
**Check status** reports local app state, never a fresh calendar or Outlook
permission check. Raw response error text is never displayed.

Exact Taipei load scope/coverage, source/consent disclosure, Kimi's separate
guardian/access review, original freshness, unknown gaps, saved-only and Clear
semantics remain. No calendar writes are enabled. This chat edited only
`owner/index.html`, `owner/availability-ui.js`, `owner/ui.js`, four focused test
files and this record. Backend, date logic, Activities and authentication were
not changed. Concurrent uncommitted/untracked work was preserved, including the
separate reconciliation record below, which arrived during this cleanup.

Validation: availability UI baseline **86/86**. Final
`node scripts/test-our-week.js`: **290 focused + 2 October non-server tests passed
in each of UTC, America/Los_Angeles and Asia/Taipei**; five October server cases
intentionally skipped per timezone. Final `node --test` with
`test/availability-ui.test.js`, `test/owner-presentation.test.js`,
`test/shell.test.js`, `test/owner-server.test.js`, `test/owner-ui.test.js`,
`test/week-display.test.js` and `test/shared-confirmation.test.js`: **165/165**.
Editor diagnostics and whitespace checks passed. No full-suite pass is claimed.

This chat's isolated synthetic-only browser review used unused loopback **8034**
with `serve-child-review`, no real storage or public searches. Startup and keyboard
Enter opening Details made **zero API requests** and did not open child consent.
Measured widths were **1920 and 563 CSS px**, without page overflow; requested
1280/375 emulation did not produce those exact widths, so exact mobile validation
is not claimed. The final UTC-copy removal was tested offline after the browser
check. The owned review process exited after graceful interruption. Existing real
tabs and the shared 8002 service were not inspected/reloaded/restarted.

No calendar/provider/Azure request, private-file access, deployment, commit or
push. Static assets apply on the user's next deliberate reload; no backend
activation is needed. Parent visual review remains the next step.

## Current-tree offline reconciliation, 17 September 2026

The delegated reconciliation found that the concurrent presentation/assertion
updates were already present. Before any edit, the previously reported four-file
command (`availability-ui`, `child-calendar-ui`, `our-week`, `owner-presentation`)
passed **130/130**, with zero failures, cancellations or skips. The historical
**110 passed / 17 failed** checkpoint below is not reproducible in this tree.
There is no preserved failing-tree diff here to attribute each historical failure;
this pass is not a claim that this reconciler fixed 17 defects.

Review of the current controllers, markup and assertions retains the simplified
presentation: no live source badge or diagnostic DOM, silent routine cleanup,
and no redundant checked-person pills. Explicit source/disclosure, unknown and
partial context, original timestamps/staleness, retention limitations and blocked
recovery remain covered. Shared confirmation still tests explicit source/person/
guardian review, fresh one-use tokens, parent-before-child ordering, independent
failures, saved-only isolation, cancellation/expiry and late-result fencing.
No functional repair or further assertion rewrite was needed. No tests were
deleted or blanket-updated; this reconciliation changes **only this document**.

Executed provider-free, in-memory integration checks:

- `node --test test/availability-ui.test.js test/child-calendar-ui.test.js
  test/our-week.test.js test/owner-presentation.test.js test/week-display.test.js
  test/child-calendar-session.test.js test/shared-confirmation.test.js`
- **164/164 passed in each of UTC, America/Los_Angeles and Asia/Taipei**:
  **492 passing executions**, zero failures/cancellations/skips. This includes all
  **16 shared-confirmation tests**. Each timezone used a 35-second subprocess
  limit, under a 120-second overall command bound, and finished in under two seconds.

Task status: current presentation/shared integration verification complete;
unrestricted full-suite verification blocked by the no-services boundary.
Plain `node --test` includes HTTP/socket listeners (for example owner-server,
child-calendar-server, date-range-server and owner-operation tests), so it was
**not run** under this request's prohibition on services. No exclusions were
silently counted as a full-suite pass. Main must explicitly allow isolated
test-only listeners before that remaining check; browser and parent usability
review are separate and remain unperformed here. No service, cloud/auth/provider/
native operation, calendar/private-cache/environment-file access, browser,
deployment, restart, commit or push was performed by this reconciler.

## Shared Confirm / Update: bounded UI implementation, 17 September 2026

This later approved UI milestone replaces the persistent **Kimi source & access**
control with an initially hidden inline wizard in the shared Confirm/Update flow.
There is no separate Load Kimi action. The existing three-day display, dates-only
Activities storage, full October load bounds and backend contracts are retained.

### Implemented flow and reviewed coordination boundary

- Shared **Confirm** or **Update** opens the optional Kimi step. Opening an
  unconfigured step makes no API request. **Continue** explicitly requests source
  names after disclosure. No source/person is preselected and guardian authority
  remains unchecked. The user selects a returned source, Kimi, disclosure and
  guardian authority, then **Continue** prepares the access summary.
- The visible final **Confirm** applies to the parent operation and the reviewed
  child import. Parents finish first, including their cleanup, then Kimi imports.
  A configured Update does not list again: the existing session-local review API
  mints a fresh one-use token for the selected source and shows the summary for a
  new final confirmation. No old token is replayed. This deliberately uses the
  inline-final-confirmation option, not silent import on the initial Update click.
- **Continue without Kimi**, **Cancel** and Escape are supported. Skip waits for
  review invalidation before starting the parent action. Cancel starts neither
  queued operation and preserves parents. **Change Kimi access** invalidates the
  review; **Remove Kimi access** independently erases child selection/results.
- `FamilyWeekActions` is a page-only callback interface in the existing parent
  controller: exactly `prepare`, `importReviewed`, `dismiss`. `prepare` returns
  only `include`, `skip` or `cancel`; child progress returns exactly boolean
  `pending`, `blocked`, `expired`. No handles, source names, titles, summary text,
  tokens or provider IDs cross this seam. Those stay in child-controller scope.
  The existing strict title-free `child-week-changed` display schema is unchanged.
- Parent `week-safety-changed.pending` also covers parent operations. Shared
  controls are gated during child operations/cleanup. Action revisions fence
  scope-away/back, Clear, cancellation and expiry before queued import. Child
  cleanup failures block further calendar actions, without a signalling deletion
  of the parent snapshot. Generic child failures preserve parent partial results;
  generic parent failures can still show the explicitly confirmed child result.
  Existing global access/cleanup/session blocks prevent queued work.
- **View saved only** remains exactly parent-only and never opens setup, reviews,
  finds or imports Kimi. It cannot make a provider request on a miss. Shared Clear
  retains its existing parent deletion/session semantics plus independent child
  cleanup. No new persistence, route, provider/auth/native/session/store change.

### Validation, concurrent-edit warning and handoff

Task list: implementation and focused synthetic regressions complete; combined
presentation reconciliation and main-owned browser review remain open. Scope was
offline edits/tests only. No process was started, existing tab inspected, service
status queried, authentication/cloud/provider/calendar/public search performed,
private snapshot/school/environment file read, restart/deployment/commit/push or
branch/worktree operation performed by this implementer.

- Baseline: `node --test test/availability-ui.test.js test/child-calendar-ui.test.js
  test/our-week.test.js test/week-display.test.js test/child-calendar-session.test.js`
  passed **138/138**.
- Before concurrent copy changes: `node scripts/test-our-week.js` completed
  successfully (its **287** focused cases and **2** non-server October cases per
  timezone; **5** intentional HTTP-case skips per timezone). The additional
  display/session/shared suite then passed **33/33** in each timezone.
- Final current-tree shared/paging/session check:
  `node --test test/week-display.test.js test/child-calendar-session.test.js
  test/shared-confirmation.test.js` passed **34/34** in **UTC**, **America/Los_Angeles**
  and **Asia/Taipei**, zero failures/cancellations/skips. This includes **16** new
  actual registered-controller shared-flow tests. Older independent display and
  source-lifecycle tests explicitly omit only the action registration seam;
  the default combined harness uses the real registration.
- During final validation, concurrent changes appeared in parent presentation
  text/markup outside this implementer's edits: source-row visibility, diagnostics
  removal and retention/cleanup wording. They were **not overwritten**. The final
  `node --test test/availability-ui.test.js test/child-calendar-ui.test.js
  test/our-week.test.js test/owner-presentation.test.js` returned **110 passed,
  17 failed, 0 cancelled/skipped**. Fifteen failures are in availability UI tests,
  two in owner presentation tests. The current combined tree is **not green**;
  the main writer must reconcile these concurrent changes and assertions before
  claiming final acceptance. No unrelated copy repair was attempted here.
- Commands were bounded to 120 seconds. No full/server suite or browser process
  was run. Final editor diagnostics were clear, both controller syntax checks and
  `git diff --check` passed, and the 11 milestone files (including untracked files)
  had zero trailing-whitespace lines.

Changed by this milestone: `owner/index.html`, `owner/owner.css`,
`owner/availability-ui.js`, `owner/child-calendar-ui.js`,
`test/fixtures/our-week-harness.js`, `test/shared-confirmation.test.js`,
`test/our-week.test.js`, `test/week-display.test.js`,
`test/owner-presentation.test.js`, this document and `kimi-calendar-import.md`.
No new script/allowlist route is needed. These static-only changes need a deliberate
page reload, not a backend restart; no current live service claim is made.

Main reviewer selectors: shared `#availability-load`, `#availability-refresh`,
`#availability-saved`, `#availability-clear`; transient region
`#child-calendar-section` (hidden initially), `#child-flow-title`, `#child-setup`;
steps `#child-find` (**Continue**, source names), `#child-source-select`,
`#child-person`, `#child-disclosure`, `#child-guardian`, `#child-review` (**Continue**),
`#child-summary`, `#child-import` (**Confirm**, both operations);
`#child-change`, `#child-skip`, `#child-cancel`, `#child-clear`.
Independent status remains `#availability-status`, `#child-status` and
`#child-week-status`; display controls/selectors below are unchanged.

The inline region intentionally is not a modal and does not trap focus. Native
Tab/Shift+Tab navigation, Enter/Space, Escape, heading/summary focus, return focus,
desktop/mobile overflow and screen-reader announcements still need the main
reviewer's isolated synthetic browser check. DOM seam assertions are not physical
keyboard evidence. No synthetic process is owned by this implementer. Existing
user-only real listing/import gates remain unchanged.

## Bounded three-day display repair, 17 September 2026

The latest narrow implementation request supersedes the blocked-three-day
behavior recorded below. The existing candidate scope resolution, disclosures,
markup/styles and Kimi date adapter were retained, not rewritten. This integrator
changed only the parent presentation helper/controller, focused week-display tests
and this document. No child consent/session/cleanup policy or backend changed.

Three separate ranges now have explicit meanings:

- **Main selection:** fresh **9–11 October 2026**, or the exact remembered 1–7-day
  selection. Only this pair goes to the existing Activities date store. Paging
  does not read/write/remove that key or change the inputs.
- **Calendar load scope:** a selection wholly inside **9–15 October** resolves to
  the existing full week: Taipei **9 October 00:00 → 16 October 00:00 exclusive**,
  UTC **8 October 16:00 → 15 October 16:00 exclusive**. Confirm, Update and saved-only
  explicitly cover this scope, **336 slots for each of two parents**, not 144.
  Kimi's separate source/guardian/disclosure/review/import covers the same exact
  week; the review summary discloses that range. No shorter provider query exists.
- **Visible viewport:** at most three days, with Mike, Debby and Kimi tracks on
  every displayed day once any valid source is loaded. Fresh/full-week paging is
  **9–11 → 12–14 → 15**, and Previous visits those exact pages in reverse. Remembered
  short or later selections retain their own initial viewport; adjacent pages
  partition the remaining load scope without overlaps or skipped days.

`calendarWindow` leaves outside-week selections unchanged so existing live/disk
gates reject them; it never clamps them into October or broadens provider support.
Synthetic memory-only arbitrary-date behavior is unchanged. Opening, restoring,
editing or paging never automatically loads data. Parent/child response validation
still uses the **entire** load scope before rendering the visible subset. Later
slot offsets, midnight-exclusive ends, exact seconds and all-day bands are kept.

Paging is render-only: no API, abort, date-store operation, safety event, consent
invalidation or snapshot deletion. Original data and `checkedAt` survive. Existing
freshness warnings can still age naturally. Main date edits resolving to the same
scope update Activities/initial display only and preserve consent and in-flight
responses. Actual scope changes or invalid dates retain cancellation, revocation,
both cleanup barriers, late-result fencing and sticky failure behavior. Explicit
Clear, page exit and expiry retain their original semantics. Kimi is not included
in the parent request or saved snapshot and still needs its own explicit actions.

### Executed offline checks

Main follow-up: full offline `node --test` passed **816/816**, with zero failures,
cancellations or skips. A dedicated synthetic-only process on 8027 loaded both
parent fixtures and a separately reviewed/imported fictional Kimi source. Browser
keyboard Enter navigation verified 9–11 → 12–14 → 15 → 12–14 → 9–11, boundary focus
transfer, unchanged Activities dates and **zero API requests during navigation**.
The three-day/three-person grid, all-day band and unknown gaps were visually
checked. The narrow browser view kept horizontal scrolling inside the grid.
Requested 375px emulation reported `innerWidth: 563`, so exact mobile breakpoint
and physical-device/assistive-technology verification remain unclaimed. A final
single-day label correction is covered by the display regression. No real tab,
provider, snapshot or shared service was accessed for this browser check.

- Candidate baseline: **143/143** focused tests passed. The strengthened paging
  assertions then reproduced the overlapping last page; the new helper test also
  failed before implementation. After repair: **147/147** focused tests passed.
- Existing [bounded runner](../scripts/test-our-week.js), invoked with
  `node scripts/test-our-week.js`: **287/287** focused and **2** October non-server
  cases passed **in each of UTC, America/Los_Angeles and Asia/Taipei**. Five October
  HTTP-listener cases were deliberately skipped per timezone.
- Supplemental [display suite](../test/week-display.test.js), invoked with
  `node --test test/week-display.test.js`: **12/12 in each of the same timezones**.
  The existing runner does not include this new file; run both commands. All
  commands were bounded to 120 seconds, with no failures/cancellations/timeouts.
- Regressions cover all 28 contained date selections, reversible short pages,
  original parent slot offsets, no navigation side effects, same-scope edits while
  both requests are pending, separate one-use child review, off-page invalid data,
  late/midnight/all-day child events and invalid-date/sticky-cleanup fencing.
  Disk regression fixtures use disposable synthetic directories only.

No full/server suite or browser process was run for this repair. Desktop/mobile,
physical keyboard, screen-reader and parent usability remain for the main reviewer;
provider visibility and live behavior were not revalidated. No service/task change,
cloud/auth/provider request, private snapshot/school/environment-file read,
deployment, commit, push or worktree/branch change was made. Pre-edit rereads and
hash checks detected no change in the six reviewed UI/document files before this
integrator's edits; this is not an atomic lock or proof of other-chat ownership.

### Main-reviewer browser handoff (not executed here)

The existing [synthetic review helper](../scripts/serve-child-review.js) accepts
required `--synthetic` and optional `--port=N` (**8020–65535**, default **8021**).
The main reviewer must assign an unused isolated port, never take over a listener
or use a real page. The helper is synthetic-only and rejects activity searching;
no process was created by this integrator.

Current selectors:

| Purpose | Selectors |
| --- | --- |
| Main dates / Activities disclosure | `#availability-start`, `#availability-end`, `#availability-date-sharing` |
| Full load disclosure / actions | `#availability-load-scope`, `#availability-window`, `#availability-load`, `#availability-refresh`, `#availability-saved` |
| Display-only paging / result | `#availability-display-previous`, `#availability-display-next`, `#availability-display-label`, `#availability-grid` |
| Source / independent freshness | `#owner-source-badge`, `#availability-source`, `#availability-status`, `#availability-freshness`, `#child-week-status` |
| Kimi source / reviewed scope | `#child-calendar-section > summary`, `#child-source`, `#child-source-select`, `#child-summary`, `#child-imported-access` |
| Separate child actions | `#child-find`, `#child-person`, `#child-guardian`, `#child-disclosure`, `#child-review`, `#child-import` |

Review 1280px desktop and 320/375px mobile: empty startup with zero requests;
visible full-week disclosure; all three tracks on each 3/3/1 page; no page-level
overflow; internal grid scrolling; native keyboard paging with focus moving to
the enabled opposite button at a boundary. Import only synthetic child data via
the complete separate consent flow. Compare API counts, dates/store and timestamps
before/after paging, then test a same-scope date edit and a truly unsupported or
invalid edit separately. No live query is authorized by this handoff.

## Historical first-open date default, 17 September 2026

When the dedicated remembered-date key is missing, Our week and Activities now
start at **9–11 October 2026 inclusive, Asia/Taipei**: UTC
**8 October 16:00 → 11 October 16:00 exclusive**, three days / **144 half-hours
per parent**. Reading this default writes nothing and makes no API request.
Remembered full-week/custom selections remain unchanged; corrupt or unavailable
storage still blocks rather than falling back. Activities **Reset dates** removes
only the date key and returns to this default without loading anything.

This is a default-only change, **not shorter live-calendar support**. Parent live
and Kimi windows remain exactly **9–15 October**, with unchanged authorization,
cache binding and backend contracts. `describeWeek()` still defaults to the full
live week for server/browser Activities compatibility. The initial visible date
copy is separate from that compatibility marker. At this earlier checkpoint the
three-day selection was blocked on live pages; **Choose 9–15 October 2026** changed dates only, followed
by a separate **Confirm** or **View saved only**. Kimi retains separate consent.
No snapshot is read, rewritten, deleted or relabelled by opening the page.

Validation uses pure logic and real controllers with synthetic VM/mock adapters,
not services, providers, private files or actual snapshots. Import fixtures
explicitly select the supported full week; fresh-default regressions remain
independent. Desktop/mobile rendering, physical keyboard and parent review are
not established by these checks. No restart or activation is part of this change.

Executed: baseline **294/294** focused tests and **1** October default check.
New default/copy regressions failed before implementation (**11 expected failures**).
Final expanded pure/VM suite: **305/305 in each of UTC, America/Los_Angeles and
Asia/Taipei**, plus **1 October default check per timezone**; no failures,
cancellations or timeouts. The other **6 October cases were skipped**, including
disk fixtures as well as server cases. The broader runner/full suite was not run
for this increment. Saved-view preservation was checked with in-memory synthetic
data only, not the real file. Historical disk/browser evidence below is separate.

## Offline milestone, 17 September 2026

Implemented on disk, not activated or verified against any live calendar. Auth
handed the compact child consent/page bridge to Builder; Week handed shared
presentation/markup/styles/tests to Builder. Builder was the sole writer for this
milestone and preserved the existing uncommitted work.

Our week now has Mike, Debby and Kimi display tracks in the same day columns.
**Kimi source & access** is a closed, native details control above the calendar,
not a separate card. Find, explicit returned-source selection, represented-person
choice, guardian authority, disclosure review and separate import confirmation
remain mandatory. Confirm/Update never load Kimi automatically. The main page no
longer mounts the school importer or its scripts; original private school files,
converter and implementation modules are untouched. Legacy tests use an isolated
synthetic HTML mount, not hidden duplicate production markup.

## Boundaries and presentation

- Parent `project`, `transition`, windows, `displayPeople`, `weekLayout`, request
  bodies, backend routes and snapshot implementation remain unchanged. Parent
  queries/storage still have only indices 0 and 1, 336 half-hours each for the
  fixed October week. Three **display** tracks do not create a third provider row.
- Child core/provider/native protocols are unchanged. The controller first calls
  `ChildCalendar.project` with the actual reviewed disclosure. A details response
  cannot be validated as busy-only: that validator rejects, rather than redacts,
  unexpected titles. Then an explicit fresh projection emits only version,
  generation, date revision, lifecycle, synthetic flag, exact window, original
  `checkedAt`, partial flag and event start/end/allDay/status. No titles, source
  names, handles, tokens, provider IDs or review text cross this bridge.
- `child-week-changed` is an in-page display event, not authorization. The receiver
  validates/copies its exact allowlist, mode, window and monotonic generation/date
  revision. It neither requests nor stores data. Activities still receives only
  the existing dates-only handoff, never this event or any calendar content.
- Source provenance and consent summaries remain inside compact settings. The
  grid uses temporary event numbers and **Event reported**, **Cancelled event**,
  or **Event status unknown**, not Busy derived from `scheduled`. No `showAs` data
  exists for this child import. Gaps are unknown, never free; null all-day flags
  are explicitly unknown. Busy-only/private titles are omitted, as are all other
  titles in this shared display.
- Exact Taipei half-open day clipping retains off-half-hour timing and seconds.
  Midnight end points do not leak into the following day. Overlapping intervals
  receive deterministic lanes. True all-day events use a separate band capped at
  three visible rows with keyboard scrolling. Every day and axis share its height.
  Parent 48 × 24px rows remain intact; day minimum widths now fit three tracks.
- With neither source loaded, the compact empty state remains. Parent-only and
  child-only views explicitly leave the other schedules unknown. An empty valid
  child import is loaded with no returned events, not proof of free time.

## Lifecycle and cleanup

Child `hide()` immediately emits an empty lifecycle projection before asynchronous
cleanup on find/review/import replacement, consent/date edits, Clear, errors,
expiry, shared session clear and page exit/BFcache restoration. Old generations
and date-away/back packets cannot repaint. Original timestamps stay separate;
child freshness is stale at **five minutes or later**, with the existing
**30-minute page lifetime**. Freshness/visibility redraws preserve focus on surviving
child event/band controls; the existing scroll region stays keyboard reachable.

Parent loading, Update, saved-only miss and generic failed requests do not
invalidate a valid child. Child Clear/consent/error/expiry never clears the parent
snapshot just to signal a UI change. Shared access/expiry/cleanup failures hide
child data through allowlisted `week-safety-changed` metadata. The parent date
revision synchronously invalidates the bridge, and child actions stay blocked
until both the existing parent range cleanup and child cleanup settle. This is
necessary because the existing parent range endpoint also clears child sessions.
Cleanup failure remains fail-closed. Older parent capability markers disable
child work, not a request or activation attempt.

## Executed validation and limitations

Run the reusable [bounded offline runner](../scripts/test-our-week.js) with
`node scripts/test-our-week.js`. It starts no server and passes only an explicit
timezone environment to its subprocesses. Disk fixtures use disposable synthetic
temporary directories, never the owner's snapshot or school files.

- Baseline: **260 passed, 0 failed** in the focused offline suite.
- Final focused suite: **281 passed, 0 failed** in each of UTC,
  America/Los_Angeles and Asia/Taipei, no cancellation, skips or timeouts.
- In each timezone, **2 October non-server tests passed**; **5 HTTP-listener tests
  were deliberately skipped** to honor the no-server constraint. No whole-suite
  or server-suite pass is claimed. The potentially hanging broad suite was not run.
- Tests exercise real parent/child controllers with a multi-listener event bus,
  explicit mock adapters, replay/late-result fencing, both cleanup completion
  orders, independent loading, empty/partial/stale/unknown states, invalid packets,
  redaction, old protocols, exact geometry and unchanged parent request bodies.
  Existing parent privacy/disk tests and legacy school coverage remain intact.
- Editor diagnostics and scoped whitespace/diff review are part of the handoff.
  A new blank browser page was attempted with intercepted synthetic-only routes,
  but the workspace-file fulfillment timed out before mounting the app. No
  desktop/mobile rendering, physical keyboard or screen-reader pass is claimed.
  Existing real tabs were not inspected or changed; no review server was started.

Next: an isolated synthetic desktop/mobile and keyboard usability review, then
parent review. Auth owns any separately approved live capability/deployment and
activation work. This milestone ran no provider/calendar/auth/cloud command,
read no private application data, and performed no installation, service restart,
activation, deployment, commit or push. Historical live evidence in other records
is not revalidated or renewed by these offline tests.