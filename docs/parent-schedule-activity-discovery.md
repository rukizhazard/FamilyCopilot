# Parent-facing schedule and activity discovery plan

## Planning status and first-version contract

This document is a proposal for review, not authorization to implement. Product behavior, privacy examples, the child's actual Google account type, supported calendar access, and the web-demo storyboard must be reviewed with the parent before implementation issues are opened.

### Approved child saved-view exception, 17 September 2026

**Later narrow approval, 18 September:** the user approved remembering the exact
confirmed Child source for the common on-demand Sync action, without repeated
confirmation controls. Implemented offline: native caller-bound SHA256 reference
plus minimal reviewed access/window in a separate private local file until Clear.
This supersedes the prohibition on retaining a source reference only for this
fixed-window local-owner slice; raw IDs, session seals, keys, tokens, credentials,
browser/cloud persistence and background work remain excluded. Only a new explicit
reviewed import enrolls it; cached source names cannot establish identity. No live
query, migration, shared restart or deployment occurred. One-time enrollment/setup
and coordinated activation remain open. [Implementation evidence](our-week.md#remembered-source-sync-implemented-offline-18-september-2026).

The user explicitly approved saving permitted Child event names/times and minimal
reviewed access privately on this device **until Clear**, separate from the parent
busy-only cache. This narrowly supersedes child nonpersistence below for the
existing fixed October local-owner view. Source IDs, credentials, handles and
review tokens remain unsaved; no new cloud/browser storage or background refresh.
Offline saved viewing cannot detect Outlook revocation and never authorizes a new
live source. Privacy/source changes and explicit deletion fail closed; completed
views survive page exit/date changes/restart without broadening their original
window. The common Calendar access dialog retains source/person/guardian/disclosure
review. Agent access to real child results is not approved.

Offline/synthetic integration passed, including original freshness after reload,
no provider fallback, independent parent/child storage, temporary-write cleanup,
keyboard and 375px layout checks. **325 focused tests per timezone** passed.
The subsequent explicit shared restart-window approval was completed: the existing
Windows-auth task on 8002 independently verified safe idle and the new child disk
marker, with metadata-only preflight and no calendar query, cloud mutation or
private saved-file access. User-reviewed import remains separate; old session-only
results are not migrated. [Implementation and acceptance record](our-week.md#saved-view-activation-completed-17-september-2026).

### Child native deployment and coordinated local activation, 17 September 2026

The later narrow child approval has now been used: one protected bounded workflow
was deployed Disabled and independently verified, consuming that one-shot
deployment approval. The user then explicitly handed the shared 8002 activation
window to Auth. The reviewed native activator and existing task enabled the
separate child boundary; live/disk safe idle, parent/child execution and protocol
markers, locked metadata preflight and current activity assets passed. Full
offline suite: **786/786**. Builder's frozen UI files and browser event/session/
cleanup contracts were not changed during this follow-up.

No real child source listing/import or private snapshot read occurred. User-only
Find/select/guardian/disclosure/review/import, exact October week, cloud redaction
and child nonpersistence remain required. Native authentication and deployed
metadata do not establish shared-source visibility. This checkpoint supersedes
older undeployed/unused-approval/launcher-blocked statements below, not broader
privacy or production gates. [Evidence and user test](child-calendar-import.md#shared-local-service-activated-17-september-2026).

### Approved parent authentication repair and live refresh, 17 September 2026

The owner subsequently requested verification and repair of the existing
Parent A/Parent B Update path. The local 8002 service now uses existing Windows-native
Azure CLI authentication with bounded native IPC; no new OAuth, permission,
policy, connector, target or deployment change. A single repaired October
refresh returned HTTP 200, non-cached, both people checked/336 slots each,
followed by independent Disabled/SAS-disabled and protected-resource checks
and local idle. The normal successful refresh retained storage at its existing
WSL busy-only snapshot location; no diagnostic file read or Clear occurred.
Full offline suite passed 642/642. Fresh browser/parent usability is separate.
This is a narrow later query authorization, not arbitrary dates or child access.
[Evidence and verification contract](owner-availability.md#windows-native-parent-update-repair-17-september-2026).
Child is still not deployed/activated; the older native script-launcher failure
below is historical. Parent success does not establish shared-source visibility.

### Approved Child shared-Outlook exception, 17 September 2026

The guardian explicitly approved replacing the School calendar UI with direct
import of Child's shared Outlook calendar, using the existing authorized connection
and **one new bounded read-only child workflow** in the existing Azure scope.
This supersedes the broader integration gate only for this local-parent-only
slice, not Google feasibility, production sharing or other integrations.
Only the user may initiate listing, select one returned calendar, acknowledge
guardian authority, choose disclosure and confirm a visible summary before import.
Dates are fixed to **9–15 October 2026 Taipei**, ending 16 October 00:00 exclusive.
Normal titles/times are allowed locally; private/unknown/personal/confidential
events are busy-only, redacted in cloud before response. No descriptions,
locations, attendees, assistant access, cross-parent disclosure, child persistence,
calendar writes or automatic queries. Protected Azure history is not zero retention.
The parent availability file and private school source files must be preserved.

**Offline implemented, not deployed/activated:** consent-gated source selection,
review tokens, session lifecycle, UI/routes and a candidate protected workflow now
exist. The combined offline suite passed 595/595; synthetic browser functional
checks do not establish keyboard/desktop or parent usability approval. Windows
identity lookup succeeded for the user, but the native preflight launcher is
blocked by script-execution policy; no policy bypass or credential transfer was
performed. The one new-workflow deployment approval remains unused; no real listing or import
is approved for agent validation. Official connector V3 does support calendarView
and sensitivity; previous contrary research is incorrect. Shared visibility still
needs the user's eventual explicit listing, not screenshot-based inference.
See [scope, evidence and checkpoint](child-calendar-import.md). Parent usability
and broader production-readiness reviews remain separate.

### Approved bounded October demo (supersedes September live bounds)

The owner approved exactly one migration of the existing availability workflow
from v4 to v5 for **9–15 October 2026**, matching local UI/cache changes and safe
idle-only activation, using the same protected Parent A/Parent B targets and existing
official basketball discovery. Approval is already granted for this narrow
migration, not for arbitrary live ranges, additional resources, real validation
queries or agent access to the private snapshot. Real calendar access remains
the owner's separate **Confirm** action. **Cloud migration and local activation
completed on 16 September 2026:** exactly one existing-resource PUT, independent
Disabled v5/SAS-disabled readback, and the original port-8002 persistent task
verified live/disk and safe-idle with the v5 marker. No calendar query or private
snapshot inspection was performed. Current full offline rerun passed **473/473**;
earlier suites also passed in America/Los_Angeles, from a **460/460** baseline.
Fresh live-browser readiness remains unverified because browser tooling failed;
HTTP page/assets and safe local status passed. This is the bounded local demo,
not broader production deployment or parent usability approval.

The exact Taipei window ends **16 October 00:00 exclusive** (336 half-hours per
person). Empty tabs default to October; remembered date selections are preserved.
September snapshots keep their original window and binding, are not relabelled,
and count only as an October saved-only miss without provider fallback. The
single file is replaced only after a successful matching October result; generic
failure returns no old data, while Clear and known access/contract/cleanup failure
still invalidate. No cache existence is assumed or inspected during validation.
Activities remains dates-only and works without calendar access. Parent usability,
Google child-account feasibility and broader integration/deployment gates remain
separate. [Implementation and actual operation evidence](owner-availability.md#approved-october-demo).

### Approved date-selection confirmation UX, 16 September 2026

**Later approved saved-view repair:** date-only changes now retain a completed
snapshot under its original exact window and authorization, while hiding tab data
and cancelling/fencing pending work. They are not consent withdrawal. Explicit
Clear/deletion and known access/contract/cleanup failures still fail closed.
**View saved only** confirms the displayed scope but cannot invoke a provider on
a miss. Unsupported live dates are blocked locally; an explicit button selects
20–26 September 2026 without loading anything. No prior busy pattern is shifted
to new dates, no cache existence is assumed, and no synthetic fallback is automatic.
This supersedes the destructive date-edit semantics below, not broader storage or
live-range approvals. [Repair record](owner-availability.md#saved-week-recovery-16-september-2026).

The owner requested **select start/end dates → Confirm → load calendars**, removing
the separate owner-attestation checkbox. Confirm explicitly requests the visibly
named two default calendars, busy-only, for 1–7 inclusive Taipei days. This changes
the control used to confirm access, not the existing owner-only authorization,
audience, calendar identities, disclosure, storage permissions or provider scopes.
Calendar requests send dates only on Confirm; the later dates-only basketball
handoff below also sends dates on Find games. Edits after a request hide results immediately
and fence/cancel pending work before reconfirmation, retaining completed snapshots.

This local implementation is tested with synthetic calendars. It does **not**
authorize deployment, new live queries, provider changes or arbitrary-range disk
storage. The deployed fixed-window workflow still limits live reads to 20–26
September 2026; other ranges fail explicitly before cache/provider access. The
original date-UX increment left the running service untouched. The later basketball
handoff safely restarted the idle local server only; a separately approved workflow
update is still needed for other live calendar ranges. Activity discovery now shares
only the selected start/end dates, never calendar state or availability.
See [scope and validation](owner-availability.md#date-selection-and-confirm-16-september-2026).

### Approved sample activity inspiration increment, 16 September 2026

**Later approved public basketball exception:** the parent authorized an on-demand
Taiwan basketball search using the existing local Node backend and official public
sources, without paid/AI services, CLI installation, new cloud resources, calendar
data/cache access or child-preference transfer. The [implemented TPBL slice](basketball-search.md)
has an independent exact dates-only POST, bounded credential-free HTTPS reads, attributed
minimal facts, page-only selection, explicit unknowns and separate sample mode.
P. LEAGUE+ is linked but not searched. This supersedes the sample-only restriction
only for that narrow public discovery path, not calendar comparison or deployment.

**Approved dates-only handoff:** Our week edits remember a validated start/end pair
(1–7 inclusive Taipei days, 2000–2100) in the dedicated `familycopilot.dates.v1`
`sessionStorage` key, with version/state only. Invalid edits store a tombstone so
Activities cannot silently reuse old dates. Dates restore before any calendar
confirmation/query, and calendar access is not required. Ages, names, statuses,
credentials, consent and results are never included. The key survives same-tab,
same-origin navigation/reload; independent tabs/origins do not synchronize. Reset
dates removes only that key; Start over clears activity choices/results, not dates.
Denied storage is visibly blocked. This narrowly supersedes the previous no-browser-
storage restriction for selected dates only, not calendars, profiles or results.

Find games sends exactly `startDate` and `endDate`; the backend validates them with
the same pure `dateRange` before source work. Fresh Activities without a selection
displays the configured default. Focus/history/date changes hide prior results and
fence in-flight responses without re-searching. The fixed September samples remain
separate. This does not authorize schedule comparison or new live calendar ranges.

Combined offline tests passed **397/397** in UTC and America/Los_Angeles and the
idle disk-backed local server was safely restarted without calendar/cache access.
A separate diagnostic October 9–15 public query displayed seven TPBL games; the
earlier September default was `outside_coverage`. No missing date is inferred
free or game-free. PLG remains unsearched. Parent usability approval and production
source permission remain open; this is not an all-Taiwan search or deployment.

The parent approved simplifying the existing preview now, then addressing real
activity search and calendar comparison separately. Implemented: **Who's coming?**
(optional ages 4–17, at most eight, no names/birth dates), multi-select **What sounds
fun?**, explicit **Surprise us** (no interest restriction) and **Find ideas**.
Day/time, sample USD budget, indoor/outdoor and format remain under closed **More
options**. Every selected age must fit one event's known guidance; uncertain
required guidance/price is separately **Needs checking**, never a verified match.
Skipping ages explicitly leaves age unchecked. Return only actual matches, at most
six, and never silently relax filters or fabricate alternatives.

The six invented activities/venues use **20–26 September 2026, Asia/Taipei (UTC+8)**.
That matches the owner page's presentation, not a calendar-derived selection or
schedule comparison. USD prices are invented, not conversions. No real location
lookup, travel estimate, spaces verification, live research or booking exists.

The owner **Activities** links lead to `/activities`, an allowlisted page with
scoped assets; the original `/demo` remains unchanged. The later basketball mode
loads the pure owner date utilities (not its controller/authentication scripts),
and makes only its explicit public-search API request. It imports no owner
session, calendar or cached data. The sample controller remains offline. The
static page has no name, birth date, address or persistent profile. Ages and
interests remain only in this page, clear on reset/reload/exit, and changing any
choice hides prior results. This route approval does not authorize data sharing,
new provider work, storage, infrastructure or live activity services. An idle-only
graceful owner-server restart enabled the routes without reading its cache or
querying calendars. Existing loaded calendar browser tabs were not inspected.

See [implementation and validation](activity-ux-refresh.md#approved-current-increment-simple-activity-inspiration-16-september-2026).
Parent usability, source feasibility and calendar-comparison authorization remain
distinct gates; automated/browser testing does not establish parent approval.

### Approved current POC copy, 16 September 2026

The owner approved **Our week** as the weekly heading and **Parent A / Parent B** as
presentation labels, superseding the historical Dad/Mom copy only. The mapping
remains **Parent A → Parent A; Parent B → Parent B**, with unchanged protected targets,
authorization, fixed **20–26 September 2026 Taipei** week, all 336 slots each,
layout and snapshot/cache binding. No identity or family relationship is inferred.
Synthetic review uses **Parent A (sample) / Parent B (sample)** for the existing fictional
Alex/Sam fixtures, retaining prominent sample/source notices.

This approval does not include optional nickname settings, Add someone, multiuser
onboarding, cloud operations, real queries or cache access/change. Static assets
are read per request, so the copy needs only a page reload, not a backend restart
or snapshot invalidation. Historical milestones below retain their original copy.
See [the current copy record](owner-availability.md#our-week-presentation-copy).

### Approved local-file retention extension, 15 September 2026

The owner explicitly approved keeping the snapshot even while the backend is
stopped. This supersedes the RAM-only/restart-deletes policy **only for the existing
fixed-owner availability POC**. No new database, cloud storage, OAuth, live query,
deployment, background work or wider production architecture is authorized here.

One bounded private JSON file outside the repository retains only projected busy
enums, fixed window, original `checkedAt`, and non-sensitive contract/local-context
binding fingerprints. No credentials, events/details, names, addresses or provider
IDs. Directory 0700/file 0600 and atomic replacement, no encryption-service layer.
No TTL: a completed snapshot survives graceful backend stop/restart; cached use
still requires the running backend, a fresh valid local session, exact Host/Origin,
CSRF and explicit acknowledgement/Check week. No startup file read or query.
Refresh invalidates the prior snapshot before querying; failures have no fallback.
Clear/withdrawal fences RAM and late writers before file I/O and removes the file.
Deletion failure is visibly unconfirmed and blocks reuse; never claim secure erase,
deletion of other displayed copies, backups, credentials or Azure service history.

The stored original verified caller/config-version digest is bound to the same
local OS owner, workspace, fixed workflow/contract/window and indices 0/1. This is
the existing single-owner assumption, not new cloud identity verification after
restart: permissions and remote configuration changes cannot be detected offline.
Clear before changing the owner/provider configuration; deliberate Refresh retains
all current cloud checks. Known access/contract/cleanup failures invalidate cache.
Original timestamp and stale-after-five-minutes warnings remain, independently of
the 30-minute page session. Corrupt/mismatched/oversized files or I/O failure never
become free time or an implicit network query. Synthetic/test stores are isolated.
See [path, limitations, validation and activation](owner-availability.md#local-file-snapshot-no-ttl).

### Historical approved simple RAM-cache and Sunday-week POC, 15 September 2026

The owner explicitly approved this narrow extension, without new login/settings,
storage infrastructure or further architecture approval: **20–26 September 2026,
Sunday–Saturday**, ending 27 September 00:00 exclusive in Taipei, same protected
Dad/Mom targets, 336 slots each. One exact Disabled v3 → v4 workflow configuration
update is authorized, **no true calendar query or workflow enabling this increment**.

One redacted process-RAM snapshot survives reload with **no retention time limit**.
Explicit acknowledgement plus Check week loads it without a provider query, or
queries once if absent; explicit Refresh bypasses it. No automatic startup load,
background query, disk/browser storage or multiuser cache. Clear/withdrawal empties
RAM and fences pending work across sessions; restart empties it. Page exit clears
tab state/cancels its work without deleting a completed snapshot. The existing
30-minute authentication session remains independent of retention. Original
last-updated time and stale-after-five-minutes warning remain visible. Provider
permissions are **not rechecked for cached snapshots**; offline provider revocation
cannot be detected. Known access/contract failures clear the cache; cleanup failure
remains sticky and a failed Refresh never falls back to prior data. Details remain
in protected Azure processing only, not the RAM snapshot or assistant. This is a
local POC exception, not production retention or parent usability approval.
See [the current implementation record](owner-availability.md#sunday-week-and-ram-cache).

### Historical approved presentation-only simplification, 15 September 2026

The owner requested **Dad** instead of Parent A, **Mom** instead of Parent B, and
one seven-day calendar diagram rather than many daily lists. The local UI now
uses these display aliases, explicitly preserving their prior-name mapping in
the access summary. They establish no new identities, parent relationship,
guardian authority, provider target or permission. Each day has two parallel
tracks along a shared time axis, with equal adjacent statuses merged only within
that day. Mobile scroll and textual/hatched unknown states preserve readability.
The fixed Taipei week, exact two default calendars, 336 slots each, explicit
pre-query confirmation, privacy and fail-closed states remain unchanged.

This approval is **presentation only**, with synthetic validation: no live query,
cloud read/write, contract/authentication change or server restart is performed.
Technical explanations are collapsed, not removed; the fictional demo remains
separate. Parent usability and screen-reader validation are still separate gates.
See [the current UI record](owner-availability.md#presentation-only-weekly-diagram-15-september-2026).

### Latest approved fixed-week availability exception, 15 September 2026

The owner explicitly approved hiding the initial calendar-selection UI (retaining
its backend/cleanup capability), replacing the first protected target with **Parent A**,
retaining **Parent B**, and a fixed **2026-09-15 00:00 through 2026-09-22 00:00 exclusive
Asia/Taipei (UTC+8)** window. Seven full days at 30 minutes produce **336 slots per
person**. Default calendars only; owner-only busy-status use through the existing
connector. A named access summary confirms the window and all slots before a
request. One exact guarded Disabled v2 → v3 update and **one true live verification**
are approved, not mail, calendar writes, other queries, background sync or broader
integration. Real addresses remain protected operator parameters, not repo/UI inputs.
The exact update is deployed and the single approved true live verification passed:
**Parent A true / 336 slots; Parent B true / 336 slots**, followed by independent
Disabled/SAS-disabled contract, preserved-resource, cleared-session and idle checks.
No further provider query was made; secure values cannot be read back from ARM.
See [the current execution record](owner-availability.md). Parent usability, provider
feasibility outside this narrow path and production readiness remain separate gates.

### Historical approved single-day two-person availability exception, 15 September 2026

The owner explicitly approved implementation/deployment through the existing authorized Outlook connector for two exact operator-supplied adults, fixed **2026-09-15 09:00–17:00 Asia/Taipei**, 30-minute intervals, busy-status disclosure to the local owner for scheduling. The actors, purpose and architecture no longer await approval. The [implementation and runtime record](owner-availability.md) covers the isolated Disabled/SAS-disabled availability workflow, cloud-side projection/protected processing and two-row local UI. **Earlier live verification passed:** a narrowly authorized, exact-contract v1 → v2 repair replaced the runtime-unsupported Parse JSON `pattern` keyword with equivalent protected WDL validation. The first actual authorized getSchedule query verified both people, 16 slots each, with independent cleanup and preserved-resource checks. **The later user-requested Load failed locally:** HTTP 403 at page age 130 minutes exceeded the 30-minute page session. The smallest local repair distinguishes expired/unavailable sessions from cleanup failure and offers explicit reload guidance. Reload never retries a query or clears a genuine backend cleanup block. Independent Azure reads still confirm Disabled/SAS Disabled; this diagnosis and repair made no new mailbox query or cloud change. Schedule contents were neither logged nor shared with the agent. The local page starts empty. Parent review, Google child-account feasibility, broader imports/sharing, live activity discovery and production retention/readiness remain separate gates. No mail, calendar writes, booking, new registration, connector recreation, persistent storage or background refresh is included.

### Historical two-person availability feasibility, 15 September 2026

The owner requested at least two people's schedules and approved **verification of the existing connector's Free/Busy capability without reading the other person's data**. [The feasibility record](availability-feasibility.md) distinguishes official API contracts, successful read-only Azure metadata evidence, offline tests and unverified runtime authorization. Existing Outlook `HttpRequest` is a candidate for `getSchedule`; meeting suggestions are not a complete grid. Default-calendar coverage, potentially returned subject/location fields, cloud-side busy-only projection and protected service history remain explicit constraints. This approval adds no live schedule request, deployment, permission change or multi-person integration. The intended UI requires independent named-person checked/missing/error states; missing context is never free. Existing owner-list approvals below remain unchanged.

### Later approved owner-only list-only exception, 15 September 2026

The subsequent owner approval adds a loopback-only **explicit Load → Select → Local summary** UI and permits a narrowly guarded update to return minimal calendar labels to that local owner browser. This uses the developer's already authorized account, not visitor sign-in or family sharing. Provider IDs are discarded by the backend, selections stay in the tab, and no event/grant/import action exists. Activity discovery remains independent. The owner-label v2 update is now deployed and independently verified Disabled, with SAS disabled and unchanged authentication/history protections. The documented standard PUT uses local exclusive-operation coordination and immediate pre-/post-read verification, not atomic Azure compare-and-swap; the earlier ETag requirement was a tooling assumption. After a narrow connector-timestamp comparison fix, a separately reauthorized live E2E reported success; its current calendar count was not preserved in the execution summary. Synthetic UI checks and live listing do not establish parent usability approval. [The detailed current boundary and execution evidence](owner-calendar-list.md#local-owner-ui-increment) supersede the earlier count-only output restriction only for this explicitly approved local browser path, never for agent/log output.

The owner subsequently approved reuse of the existing authorized Outlook connection through a **separate owner-only Logic App**, including deployment and one controlled live list verification. [The scoped implementation and execution record](owner-calendar-list.md) is limited to available-calendar metadata, with only counts/status returned to the operator and protected workflow history. It requires no new OAuth app, event access, mail, background refresh, database, sharing, or child-account access. This is an explicit narrow prototype exception to the broader review gate, not completion or approval of the full plan. Calendar selection and pre-import consent remain mandatory before any future event retrieval. Parent usability, provider completeness/ownership and production privacy/retention reviews remain open.

### Earlier explicitly approved narrow exception, 15 September 2026

The parent separately approved an **own Microsoft account browser OAuth PKCE picker**, superseding the earlier server-side architecture for this slice only: explicit sign-in, account confirmation, bounded own-calendar listing, off-by-default selection, and a local summary. No events, background refresh/sync, sharing, invitation acceptance, mail or persistence are authorized by this exception. The initial audience is the owner's corporate home tenant, not general adult/personal/guest Microsoft accounts. Browser-held tokens are an explicitly approved limited experiment, not the storage design for future production imports.

The separate implementation and [actual registration/validation record](microsoft-browser-picker.md) do not complete this plan's broader journey. The app uses delegated `Calendars.ReadBasic` for calendar metadata; that provider permission also permits basic event reading and is not limited to selected calendars, which the UI discloses. The public client ID remains unconfigured after a failed one-shot registration attempt; no real sign-in or calendar access was performed through tools. Secret/certificate restrictions do not themselves block a credential-free SPA. No Functions or Storage are necessary for this picker.

All later server-side adapters, credential/data persistence, event import, date ranges, represented-person/guardian/disclosure choices, family authorization and deployment still require their applicable approvals and reviews below. Parent usability and actual Google child-account feasibility remain unverified. Discovery continues to work independently in the unchanged fictional demo.

The first version is for parents. It responds only when asked and may:

- answer schedule questions from currently permitted calendar data;
- compare availability and identify possible conflicts without claiming missing time is free;
- research science activities, concerts, exhibitions, and similar outings;
- assess whether a pasted event page appears to fit the available schedule; and
- explain sources, freshness, assumptions, missing context, and uncertainty.

It must not send unsolicited recommendations or notifications; serve as a child-facing assistant; create, edit, delete, accept, or decline events; book activities; register children; buy tickets; or start monitoring an event. Calendar events and external pages are untrusted evidence, never instructions or authorization to act.

### Representative parent scenarios

1. **Understand the schedule:** “What does our family have this weekend?”
2. **Discover an activity:** “Find a weekend science activity for my 8-year-old within a 30-minute drive.”
3. **Fit an outing:** “Suggest a kid-friendly concert or exhibition that fits our Saturday schedule.”
4. **Assess a known event:** Paste an event URL and ask, “Does this exhibition fit our schedule?”

Age, location, interests, budget, and travel time in these prompts are examples, not stored facts about a child or family.

## UX outcome

Family Copilot should let a parent understand family commitments and evaluate outings without making them learn provider internals. A parent can try activity discovery without connecting a calendar; calendar connection is offered when schedule-fit analysis needs it.

The experience is read-only and follows these principles:

- **Explain value before asking for access.** State what schedule questions become possible and that Family Copilot cannot change events.
- **Make consent specific.** Show which account, calendars, fields, family members, and retention rules apply before import.
- **Let the guardian minimize access.** Calendars are off until selected, and each can expose event details or only busy times.
- **Show provenance and freshness.** Answers distinguish Outlook from Google events and disclose stale or disconnected sources.
- **Keep control reversible.** A guardian can pause sync, change visibility, disconnect, export, or delete imported data from one place.

### Primary users

- **Parent/guardian:** asks questions, connects provider accounts, confirms authority to use a child's calendar, chooses calendars and privacy levels, and manages or removes access.
- **Other parent:** may connect their own account and receives only information allowed by the calendar owner's disclosure policy. Direct child use is outside the first version, and a child is never asked to provide credentials.

The connected account, the person whose schedule a calendar represents, the fields Family Copilot may process, and the people who may receive those fields are separate decisions. In the first version, a personal or work calendar is always busy-only when disclosed to another parent or family member. Its details may answer the calendar owner's own question but are never disclosed cross-parent.

### Core journey

1. **Discover:** Calendar settings explain the read-only benefit, supported providers, data use, and the difference between event details and busy-only access.
2. **Connect Outlook:** The guardian selects **Connect Outlook**, reviews the single read-only calendar permission, completes Microsoft consent, and returns to Family Copilot. The subsequent Family Copilot picker—not the OAuth grant—controls which owned or shared custom calendars are included.
3. **Connect the child's calendar:** Family Copilot explains how to share the Google calendar read-only with a guardian-controlled account. The guardian attests that they are authorized, selects **Connect Google**, and completes Google consent.
4. **Choose access:** Family Copilot lists calendars without importing events. The guardian selects calendars, labels whose schedule each represents, and chooses **Details** or **Busy only** for each.
5. **Review and confirm:** A summary shows accounts, calendars, visibility choices, imported date range, retention, and affected family members. Import starts only after confirmation.
6. **Verify:** Sync progress ends with a preview of representative upcoming events exactly as the agent will see them. The guardian can correct calendar ownership or privacy settings.
7. **Use:** Agent answers include source labels and a “last updated” time. Private or busy-only events appear as unavailable time without revealing content.
8. **Manage:** Calendar settings show connection health, selected calendars, visibility, last sync, and actions to retry, pause, reconnect, disconnect, export, or delete.

### Required screens and states

| Surface | Required content and behavior |
| --- | --- |
| Calendar overview | Provider connection cards, read-only badge, last successful sync, selected calendar count, and manage action |
| Pre-consent explanation | Benefits, exact data uses, fields requested, retention summary, provider scopes, and cancel action |
| Calendar picker | Account identity, calendar owner/label, selection toggle, Details/Busy-only choice, sharing instructions when an expected family calendar is missing, and child-calendar attestation |
| Pre-import confirmation | Access summary, date window, family visibility, confirm and back actions; no event data is retrieved yet |
| Post-sync preview | Representative upcoming events exactly as the agent may disclose them, with source and privacy redaction visible |
| Schedule result | Structured commitments and conflicts, human-readable sources, freshness, privacy-safe event display, and no claim of completeness when a source is stale |
| Activity result | Suitability rationale, date/time, age guidance, cost, estimated travel, source links, calendar fit, and explicit unknown/unverified labels |
| Event-URL assessment | Identified event/performance, page source, extracted facts, schedule comparison, uncertainty, and no booking or monitoring action |
| Connection management | Pause/retry/reconnect, change selection or privacy, disconnect and revoke where supported, export, and delete |

Every asynchronous surface needs explicit loading, empty, partial, stale, permission-revoked, provider-unavailable, and unsupported-child-account states. Errors must explain whether existing results remain usable and offer a safe recovery action without exposing provider internals.

### UX acceptance criteria

- A guardian can understand the benefit and read-only boundary before leaving Family Copilot for provider consent.
- No events are imported until the guardian selects calendars, chooses their visibility, records whose schedules they represent, and confirms.
- The child-calendar flow establishes guardian authority and never requests the child's password.
- A missing spouse or child Outlook calendar explains that Microsoft family membership alone does not grant calendar access and offers sharing or separate-account connection instructions.
- The post-connection preview matches what the agent may disclose, including private and busy-only redaction.
- Every schedule answer identifies its sources and freshness; stale or partial data is never presented as complete.
- “No conflict found” is shown only for the calendars and time range actually checked; incomplete context is labeled “cannot verify availability,” never “free.”
- A guardian can pause, reconfigure, disconnect, export, and delete calendar data without contacting support.
- Keyboard-only and screen-reader users can complete all steps, and status is not communicated by color alone.

UX prototypes and usability testing with parents must validate this journey and terminology before provider adapters are implemented.

## Activity discovery and event assessment

Activity discovery is sourced research, not a recommendation engine acting autonomously. Ask only for preferences needed for the current request: age range, interests, general starting area, dates, budget, accessibility needs, and travel preference. Do not require a child's name, exact birth date, school, home address, or persistent profile.

For every option:

- retain and show the source URL and the exact event/performance identity;
- show date/time, venue or area, published age guidance, stated cost, and why it may suit the request;
- estimate travel only from a parent-provided general starting area and a cited routing/map result when available;
- identify whether ticket availability was actually verified, merely listed, stale, or unknown;
- compare against only fresh, authorized calendar context and name calendars that are missing or stale; and
- label inferred, conflicting, or unverified details rather than silently resolving them.

A “within 30 minutes” request is a preference, not a guarantee. Without reliable travel evidence, return the known distance/location and mark travel time unverified. Without a connected calendar, discovery still works, but the result says schedule compatibility was not checked. A failed search returns what was searched, which filters may be relaxed, and no fabricated alternatives.

External page content is sanitized and treated as data. It cannot override system policy, request calendar disclosure, initiate tools, or authorize a booking. A pasted URL supports assessment of the identified event only.

## Mobile-friendly hosted web demo

The agreed demo entry point is a dedicated hosted web app optimized for mobile browsers. Browser extensions, native apps, messaging integrations, API-only delivery, PWA installation, proactive notifications, and TicketForge monitoring are outside the demo.

The main page contains a question box, representative prompts, a separate event-URL input, and structured results rather than chat-only prose. Calendar discovery is optional and uses dedicated consent/settings surfaces.

### End-to-end storyboard

1. **Understand a family schedule:** Select a schedule example, optionally connect calendars, review source/freshness labels, and receive commitments plus conflicts. Loading, empty, partial, stale, permission-denied, and disconnected states never turn missing data into free time.
2. **Discover suitable activities:** Enter minimal age/interests/location/date/budget preferences, review sourced activity cards, and inspect suitability, timing, cost, estimated travel, verification state, and calendar fit. This journey works without calendar access.
3. **Assess an event URL:** Paste a page, verify the extracted event/performance, and compare it with available schedule context. Unsupported pages, ambiguous performances, extraction failures, stale listings, and missing calendars produce recoverable explanations.

### Truthful demo labeling

- **Sample calendar:** clearly labeled synthetic data; never represented as the family's schedule.
- **Connected calendar:** shows provider, represented person, disclosure mode, and last successful sync.
- **Mock activity result:** labeled example data and never described as live research or current availability.
- **Live source:** links to the source and distinguishes published facts from Family Copilot estimates or inferences.
- **Unknown:** displayed explicitly; absence of evidence is not converted to availability, suitability, or a free schedule.

The usability test succeeds when a parent, without facilitator explanation, can find a plausible activity, understand why it may fit, open its supporting sources, identify what calendar context was checked, and distinguish sample data, verified facts, estimates, and assumptions. The parent must also understand that Family Copilot cannot book, purchase, alter calendars, or monitor tickets.

## Child Google Calendar feasibility gate

The child likely uses a Family Link-supervised Google account, but this must be confirmed. Family Link supervision does not itself give a parent access to Calendar content, and the parent currently cannot see the child's calendar or titles. Therefore, the Google connection design below is provisional.

Before selecting a production path, test with the actual account configuration:

1. record whether it is a supervised consumer account, Workspace for Education account, or another managed account;
2. determine whether Calendar sharing is available and whether a parent-controlled Google account can receive and read event details;
3. determine whether third-party OAuth is allowed and which account can legally and technically provide consent;
4. verify what private-event and title fields the Calendar API returns; and
5. document provider errors, age/supervision restrictions, and revocation behavior.

Do not ask for the child's password or bypass supervision. If no supported parent-authorized path exists, the safe first-version fallback uses the parent's Outlook calendar and clearly labeled sample or otherwise available calendars. Every answer identifies the child's schedule as missing and says availability cannot be fully verified.

## Future TicketForge boundary

TicketForge is a possible later handoff after a parent selects one exact event/performance. Family Copilot would pass the source page and selected performance only after explicit confirmation; TicketForge would own monitor investigation, generation, validation, deterministic checks, reduced-capability/refusal states, staleness, failures, and repair.

Family Copilot must not duplicate that monitoring system. A TicketForge failure is not “sold out,” monitoring does not authorize purchasing or calendar changes, and background checks or alerts require a separate opt-in design. TicketForge integration is not part of this demo or first version.

## Provisional technical decisions derived from the UX

The intended sources are a parent's Outlook calendar and, only if the feasibility gate identifies a supported path, a child's Google calendar. A parent or verified guardian selects calendars to include and can disconnect or erase either source. These proposals remain provisional until product, privacy, feasibility, and UX decisions are reviewed. Write access is explicitly deferred.

The integration consists of provider adapters behind one synchronization service:

1. OAuth callbacks exchange authorization codes on the server.
2. Encrypted connection records retain refresh credentials and sync cursors.
3. Provider adapters perform an initial bounded import and subsequent incremental refreshes.
4. Events are normalized into a provider-neutral store.
5. The agent receives only the minimum event fields needed for the current request, with event text treated as untrusted content.

## Provider APIs and authentication

### Microsoft Outlook

Use [Microsoft Graph Calendar](https://learn.microsoft.com/graph/api/resources/calendar) with an app registration in Microsoft Entra ID that supports the intended account type, including personal Microsoft accounts when required.

- Use the OAuth 2.0 [authorization code flow with PKCE](https://learn.microsoft.com/entra/identity-platform/v2-oauth2-auth-code-flow). Generate and verify `state` and OIDC `nonce`, use an exact allowlisted HTTPS redirect URI, and perform the code exchange on the server.
- Request delegated `Calendars.Read` for the signed-in user's calendars, `offline_access` for a refresh token, and OIDC `openid` for a stable connected-account subject. Request `profile` only if the UX needs additional account display fields. A shared custom calendar added to the recipient's mailbox can be read through `/me/calendars` with `Calendars.Read`.
- Use `/me/calendars` for calendar selection and `/me/calendars/{calendar-id}/calendarView` to load occurrences from each selected calendar in a bounded time window. Microsoft Graph v1.0 [calendar view delta](https://learn.microsoft.com/graph/delta-query-events) supports the primary calendar, so use it there and store returned `@odata.nextLink` and `@odata.deltaLink` values as opaque secrets. Reconcile complete bounded snapshots for other selected calendars rather than relying on a beta per-calendar delta endpoint.
- Do not request application permissions or `Calendars.ReadWrite` in the first release. A future write feature must use a separate incremental-consent step for delegated `Calendars.ReadWrite`.

Microsoft family membership is not calendar consent. Access to a spouse's or child's Outlook calendar must follow one of these explicit paths:

1. **Share a custom calendar with the guardian account:** The calendar owner, or an authorized adult managing the account, creates or chooses a custom calendar, shares it read-only in Outlook, and places the family events to expose there. The guardian accepts or adds it in Outlook before returning to Family Copilot. It then appears in `/me/calendars`; Family Copilot cannot create the share or elevate its sharing level.
2. **Connect separately:** The spouse signs in to their own Microsoft account, consents to `Calendars.Read`, and selects their calendar. Each connection retains its own token and can be removed independently.

Direct access to another user's shared primary calendar is deferred because it requires `Calendars.Read.Shared`, the owner's mailbox identifier, and different owner-mailbox endpoints whose IDs cannot be mixed with `/me/calendars` IDs. Prefer the custom-calendar path for a child's schedule only when a guardian is authorized to configure that account. Never ask the guardian for the spouse's or child's password, impersonate them, or use application-wide access. Work/school tenant policy, disabled user consent, cross-tenant sharing rules, personal-account age restrictions, or a supervised child account may block consent or sharing; the UX must identify the blocked step and direct the family to the Microsoft or organization administrator rather than attempting a workaround. A spouse's consent remains independent and revocable even when both adults belong to the same Family Copilot family.

### Expected Microsoft family onboarding friction

- The spouse or calendar owner must take an action in Outlook; adding people to a Microsoft Family group alone is insufficient.
- The Microsoft Family group calendar itself is limited to Microsoft Outlook experiences and is not a supported Graph source for this integration. The family must use a separately shared custom calendar instead.
- The owner controls whether the recipient sees only free/busy, limited details, or full non-private details. An ordinary read-only share never exposes private-event details; Family Copilot always represents those as busy-only.
- A sharing invitation may need to be accepted or the calendar explicitly added before Graph returns it. The calendar picker must offer **I've shared it—check again** and troubleshooting guidance.
- A spouse who does not want to share with the guardian can use a separate connection and revoke it independently.
- A child's age, account supervision, or organization/school policy may prevent OAuth consent or external calendar sharing. That is a blocking provider-policy outcome, not an application error.
- Delegated access to shared calendars does not support Graph change notifications. Shared sources therefore use bounded reconciliation and may refresh less immediately than the guardian's primary calendar.

The first-release UX should recommend read-only sharing with the guardian because it avoids handling credentials for every family member, while keeping separate account connections available for independent adult consent.

### Google Calendar

Use [Google Calendar API v3](https://developers.google.com/workspace/calendar/api/v3/reference) in a Google Cloud project with an OAuth consent screen.

- Use the OAuth 2.0 [web-server authorization flow](https://developers.google.com/identity/protocols/oauth2/web-server) with PKCE, `state`, OIDC `nonce`, an exact allowlisted HTTPS redirect URI, and offline access. The server exchanges the code, validates the ID token, and stores any refresh token.
- Request OIDC `openid` for a stable connected-account subject and `email` so the confirmation UI can identify the account. Request `https://www.googleapis.com/auth/calendar.calendarlist.readonly` so the parent can select an accessible calendar and `https://www.googleapis.com/auth/calendar.events.readonly` to read its events. Do not request the broader `calendar` scope.
- Use `calendarList.list` for selection and [`events.list`](https://developers.google.com/workspace/calendar/api/v3/reference/events/list) for loading. Expand recurring events with `singleEvents=true` and retain the series identifier.
- Refresh Google calendars with bounded `events.list` queries using the same import window, `singleEvents=true`, and `showDeleted=true`, then reconcile the complete paged result. Do not combine `syncToken` with `timeMin` or `timeMax`; Google prohibits that combination. An unbounded sync-token strategy may be considered later only after a separate data-retention and privacy review.
- Do not request write scopes in the first release. A future write feature must use a separate incremental-consent step for `https://www.googleapis.com/auth/calendar.events`.

For a child's calendar, sharing read-only with a guardian-controlled Google account is only a candidate path to validate through the feasibility gate; it is not assumed to work for a Family Link-supervised or managed account. If supported, the guardian authorizes Family Copilot and explicitly selects that calendar. The application must not ask a child to share a password or capture a child's credentials. Workspace or supervised-account restrictions may prevent sharing or third-party OAuth; the UI must report that limitation rather than bypass it.

## Secure connection and token handling

Store one connection per provider account and family. The connection record contains the provider, provider account subject, granted scopes, token expiry, consent timestamps, and encrypted refresh credential.

Store a separate selection record for every connected calendar. It contains an internal connection reference, encrypted provider calendar ID, guardian-assigned family member, disclosure mode (`details` or `busy_only`), allowed family audience, consent-policy version and timestamp, lifecycle state (`active`, `paused`, or `disconnected`), synchronization generation, and an optional per-calendar sync cursor. Authorization checks and redaction use this record rather than provider visibility alone.

Privacy reductions are fail-closed and atomic from the user's perspective. Changing from Details to Busy-only, narrowing the audience, or deselecting a calendar immediately blocks the old disclosure policy, advances its synchronization generation, and queues deletion of no-longer-permitted fields from normalized records, caches, embeddings, and summaries. The UI shows the change as pending until cleanup succeeds and retries failures without restoring broader access.

- Keep client secrets and encryption keys in a managed secret store; never ship them to a browser or mobile client.
- Encrypt refresh tokens with envelope encryption and a managed KMS key. Restrict decryption to the synchronization service, rotate keys, and keep production credentials out of source control.
- Store access tokens in memory or an encrypted short-lived cache only. Rotate refresh tokens when a provider returns a replacement. On disconnect, revoke Google tokens through Google's revocation endpoint; for Microsoft, which has no per-application token-revocation endpoint, immediately delete local credentials and offer instructions for removing the application's consent in the Microsoft account.
- Never log authorization codes, tokens, opaque sync links, raw event bodies, attendee addresses, or calendar IDs. Use generated internal IDs and structured redaction.
- Enforce tenant/family ownership on every connection and event query. Separate OAuth callback state from user-supplied return URLs to prevent account-linking and redirect attacks.
- Record connect, scope change, calendar selection, sync, export, disconnect, and deletion actions in a metadata-only audit trail.

## Loading and refresh

### Initial import

1. After consent, list accessible calendars and require the guardian to select each source explicitly.
2. Show the access summary and persist the guardian's confirmation, calendar ownership labels, and visibility choices before retrieving any events.
3. Import a configurable bounded window (initially 30 days in the past through 365 days in the future), paging until complete.
4. Upsert normalized events by `(connection_id, provider_calendar_id, provider_event_id, occurrence_key)` and apply provider cancellation/deletion markers.
5. For the primary Microsoft calendar, save a sync cursor only after all pages commit successfully. If a page fails, retry idempotently without advancing the cursor.

### Incremental refresh

Calendar refresh is data maintenance authorized by the parent's active connection, not proactive agent behavior. It must never produce a recommendation, message, notification, monitoring task, or external action. The consent screen discloses refresh frequency; pause or disconnect stops new jobs.

- Poll each actively connected calendar initially every 15 minutes with jitter and exponential backoff solely to maintain freshness for later parent questions. Respect provider throttling and `Retry-After`.
- Each job captures the selection's synchronization generation when it starts and may commit only while the selection is still active with the same generation. Privacy changes, pause, deselection, deletion, and disconnect advance the generation transactionally, fencing in-flight jobs before cleanup.
- Use Microsoft calendar-view delta links for the primary calendar. Treat its cursor as bound to the time window and request parameters; when rejected, clear it and repeat the bounded import. Reconcile complete bounded snapshots for non-primary Microsoft calendars.
- For Google, re-fetch and reconcile the complete bounded window because its sync tokens cannot be combined with the required time bounds. Page consistently, replace the previous snapshot only after a successful complete fetch, and rate-limit polling.
- Run a daily reconciliation import to recover from missed changes. Stop promptly when access is revoked or a calendar is deselected.
- Add provider webhooks later as a latency optimization, not as the source of truth. Validate webhook authenticity, use opaque subscription IDs, renew subscriptions, and still reconcile through each provider's authoritative refresh mechanism.

A delete action must atomically pause and deselect the affected calendar, advance its synchronization generation, and then purge its data so scheduled or in-flight refreshes cannot re-import it. Resuming that source requires the guardian to select it again and complete a fresh access summary and confirmation.

Store provider timestamps in UTC while preserving the provider time-zone identifier and the original all-day date boundaries. Recurrence exceptions, cancellations, and moved occurrences must remain distinguishable. The agent must not infer that imported events are current if a connection is in an error or stale state.

## Common event model

```text
CalendarEvent
  id: UUID
  family_id: UUID
  connection_id: UUID
  calendar_selection_id: UUID
  source: "microsoft" | "google"
  provider_calendar_id: encrypted string
  provider_event_id: encrypted string
  provider_series_id: encrypted string?
  occurrence_key: string?
  calendar_label: string?
  title: string?
  description: string?
  location: string?
  start_at: timestamp?
  end_at: timestamp?
  start_date: date?
  end_date_exclusive: date?
  time_zone: IANA or provider time-zone identifier?
  is_all_day: boolean
  status: "confirmed" | "tentative" | "cancelled" | "unknown"
  visibility: "default" | "public" | "private" | "confidential"
  organizer: Participant?
  attendees: Participant[]
  recurrence: string[]
  last_modified_at: timestamp
  source_etag: string?
  imported_at: timestamp
  deleted_at: timestamp?

Participant
  display_name: string?
  address: string?
  response: "accepted" | "declined" | "tentative" | "needs_action" | "unknown"
```

`start_at`/`end_at` are used for timed events and `start_date`/`end_date_exclusive` for all-day events. The normalized record preserves provider IDs for synchronization but does not expose them to the agent. Optional sensitive fields such as description, location, organizer, and attendees should be omitted from storage unless a feature requires them; free/busy-only views should contain no title or participants.

Provider payloads remain authoritative. Normalization must preserve unknown values safely, avoid inventing attendees, and map unsupported provider statuses to `unknown` rather than dropping the event.

## Privacy, consent, and safety

- Require a verified adult guardian to connect or select a child's calendar and attest that they are authorized to process it. Obtain any additional consent required by the child's age, account type, school policy, and jurisdiction before collection.
- Show the provider account, selected calendars, exact scopes, imported fields, retention period, and agent uses before connection. Keep consent records versioned and allow calendar-level opt-out.
- Default to data minimization: import only the configured window and selected calendars, hide private-event details unless explicitly allowed, and send only request-relevant fields to the model.
- Do not use calendar data for advertising, model training, or unrelated profiling. Do not expose one family member's private details to another without an explicit family-sharing policy.
- Treat titles, descriptions, locations, links, and attendee text as untrusted data, never as agent instructions. Escape rendered content and prevent events from triggering tools or write actions without an independent authorization check.
- Provide export, disconnect, and deletion controls. Privacy downgrades and deselection purge newly disallowed content. Disconnect revokes access where the provider supports per-app revocation, deletes local credentials, and queues tokens, cursors, normalized events, caches, and derived embeddings/summaries for deletion under a documented retention SLA. Retain only legally required audit metadata.
- Encrypt data in transit and at rest, apply least-privilege service roles, audit privileged access, define incident response, and periodically review provider grants.
- Complete legal review against the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), Microsoft platform terms, and applicable child-privacy law before production use.

### Proposed retention and export

These values require parent and legal review before implementation:

- Keep event data only inside the selected import window (initially 30 days past through 365 days future). A daily provider-independent retention job purges normalized events and their caches, embeddings, and summaries even when a connection is paused, stale, revoked, or failing. Encrypted backup copies expire within 30 days, and restore filters discard out-of-window records before activation.
- A privacy reduction blocks access immediately and removes newly prohibited details from active stores, caches, embeddings, and summaries within 24 hours. Encrypted backups containing those details expire within 30 days; restore procedures filter normalized records under the current window and disclosure policy before activation, discard every restored calendar-derived cache, embedding, and summary, and rebuild only from the filtered records.
- Calendar deletion or disconnect makes data inaccessible immediately and removes credentials, cursors, normalized events, caches, embeddings, and summaries from active systems within 24 hours. Encrypted backup copies expire within 30 days and are not restored into active use.
- Keep metadata-only security and consent audit records for one year unless legal review selects a shorter period. They contain actor/internal IDs, action, policy version, provider, outcome, and timestamp—not tokens, event content, attendee data, calendar IDs, URLs, queries, or child preferences.
- Provide a downloadable UTF-8 JSON export containing connection/provider labels, represented-person labels, calendar disclosure settings, consent history, and normalized event records currently retained and visible to the requesting parent. Exclude secrets, tokens, sync cursors, encryption metadata, internal security logs, data outside the requester's audience, and purged content.
- Activity requests and results are session-only by default. Persist a saved activity only after an explicit parent action. It is owned by and visible only to that parent unless they explicitly share it; retained fields are limited to its source URL, exact event/performance identity, cited facts, and parent-entered notes. Include visible saved activities in that parent's JSON export. Deletion blocks access immediately, removes active records and caches within 24 hours, and expires encrypted backup copies within 30 days without restoring them into active use.

Validate disclosure rules with concrete scenarios before building a generalized permissions system:

| Scenario | Allowed response |
| --- | --- |
| Parent asks about their own work calendar | Use authorized details for that parent's answer; never disclose those details to another parent in the first version |
| Other parent asks when the calendar owner is available | Return busy intervals only; personal/work event details are never disclosed cross-parent in the first version |
| Parent asks about an authorized child/activity calendar | Use only fields permitted by the provider share and recorded guardian policy |
| Event is private, outside the requester's audience, or busy-only | Report unavailable time without title, location, attendees, description, or inferred purpose |
| Child calendar is missing, stale, or unsupported | Name the missing context and say availability cannot be fully verified |

## Planning review and eventual rollout criteria

Before implementation, the parent reviews and agrees the scenarios, on-demand behavior, non-goals, privacy examples, calendar feasibility result, demo storyboard, activity result contract, and sample/mock labeling. Unresolved choices remain visibly marked; this plan is not approval to start coding.

PR #2 reconciles the written proposal with the updated issue but does not complete the issue's validation acceptance criteria. Issue #1 must remain open until the parent review, actual Family Link/account feasibility test, and hosted-web storyboard usability review are completed and their outcomes are recorded here. Remove any automatic closing reference from the PR before merge if those gates are still open.

An eventual first version can maintain a read-only schedule view, answer schedule questions, identify possible conflicts, research activities, and assess event pages. It cannot create, edit, delete, accept, or decline events; notify proactively; monitor tickets; book; register; or purchase. UI copy and agent tools must make those boundaries explicit.

Before an eventual rollout:

- OAuth threat-model tests cover CSRF, PKCE, callback replay, redirect validation, account linking, token leakage, and revocation.
- Adapter contract tests cover owned and shared calendars, sharing-level redaction, pagination, recurrence, all-day events, time zones, cancellations, throttling, expired cursors, and idempotent retry.
- Privacy tests confirm family isolation, private-field filtering, child-calendar deletion, audit redaction, and prompt-injection containment.
- Activity tests cover source attribution, exact performance identity, uncertainty, failed extraction/searches, missing calendar context, travel estimates, and untrusted-page containment.
- Operational metrics cover sync age and failures without event content or provider identifiers.

Write actions are a later opt-in phase requiring narrow write scopes, explicit confirmation for every user-visible change, idempotency, conflict handling, a durable audit trail, and a rollback/correction experience.

## Follow-up issue plan

Do not create implementation issues until the parent has reviewed and agreed the product, privacy, feasibility, and UX decisions above. First create and complete planning/validation issues:

1. **Review parent scenarios and behavior boundaries:** Confirm usefulness, on-demand behavior, non-goals, privacy examples, and required activity fields.
2. **Investigate the actual child Google account:** Record account type and test parent-authorized Calendar sharing/OAuth with the real configuration; produce a supported path or documented unresolved limitation.
3. **Prototype and usability-test the hosted web demo:** Cover all three journeys, consent and disclosure preview, structured results, sample/mock/live labels, accessibility, missing/stale calendars, empty searches, unsupported pages/accounts, and removal of access/data.

After those decisions are approved, split implementation into independently scoped issues:

1. **Define the calendar domain model and provider adapter contract.**
2. **Implement secure OAuth connection storage and privacy controls.**
3. **Implement the approved Microsoft read-only calendar path.**
4. **Implement Google Calendar only if feasibility identifies a supported child-calendar path.**
5. **Build synchronization, freshness, observability, and cleanup.**
6. **Build read-only schedule answers and conflict analysis.**
7. **Build sourced activity discovery and event-URL assessment.**
8. **Build the reviewed mobile-friendly hosted web demo.**

Calendar and activity-discovery work remain separate so either can ship or be tested without the other. TicketForge monitoring, proactive behavior, calendar writes, booking, purchasing, native apps, extensions, and messaging integrations require later issues and explicit scope approval.

## References

- [Microsoft Graph calendar overview](https://learn.microsoft.com/graph/outlook-calendar-concept-overview)
- [Get shared or delegated Outlook calendars and events](https://learn.microsoft.com/graph/outlook-get-shared-events-calendars)
- [Microsoft Graph permissions reference](https://learn.microsoft.com/graph/permissions-reference)
- [Microsoft Graph calendar view delta](https://learn.microsoft.com/graph/delta-query-events)
- [Google Calendar API authorization scopes](https://developers.google.com/workspace/calendar/api/auth)
- [Google Calendar API synchronize resources](https://developers.google.com/workspace/calendar/api/guides/sync)
- [Google Calendar API push notifications](https://developers.google.com/workspace/calendar/api/guides/push)
- [Google Calendar sharing](https://support.google.com/calendar/answer/37082)
- [Google Family Link account management](https://support.google.com/families/answer/7103262)
