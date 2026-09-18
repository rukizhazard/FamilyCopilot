# FamilyCopilot
Family Copilot is an AI Chief of Staff for families. It understands what matters across school, work, activities, and personal interests, then proactively coordinates schedules, resolves conflicts, and helps families make better decisions before important moments are missed.

## Kimi remembered-source Sync activated and source enrolled

The common Sync button can now load/refresh Kimi through a remembered, explicitly
enrolled source and then load/refresh parents. Offline native/storage/server/UI
tests and an isolated synthetic reload/Sync browser check passed. The explicitly
approved shared restart completed on 18 September; independent local status
confirmed childSyncProtocol, native execution and safe idle. The user's later
explicit listing/event-read approval then allowed one successful Kimi enrollment
and bounded import, with the source remembered and independent cleanup verified.
No private cache inspection or parent refresh occurred. Common Sync can now load
the saved child view and reuse its source; a separate live refresh after enrollment
was not repeated. No recurring source-selection controls were added.
[Enrollment evidence](docs/our-week.md#kimi-source-enrolled-and-events-read-18-september-2026).
[Current evidence and remaining gates](docs/our-week.md#remembered-source-sync-implemented-offline-18-september-2026).

## Kimi-specific operations removed, 17 September 2026

Reload Our week to remove all Kimi setup/selection/confirmation controls and the
Calendar access dialog. Common Confirm displays any matching existing Kimi saved
view alongside parents, without a wizard. Common Update refreshes **parents only**;
Kimi retains its original saved timestamp. If no child snapshot exists, its schedule
stays unknown. No live Kimi import/update UI is available in this version; remembered
provider-source authorization is not yet implemented. Existing saved files were
not deleted. This static-only change needs no server restart.
[Behavior and synthetic validation](docs/our-week.md#kimi-specific-ui-operations-removed-17-september-2026).

## Unified calendar caching active, 17 September 2026

Implemented with explicit owner approval: Kimi's permitted event names/times and
reviewed access settings can be saved privately until Clear, separate from the
parent busy-only snapshot. All calendars use common controls and a **Calendar
access** dialog instead of a standalone Kimi section. Saved viewing never refreshes
Outlook automatically or restores authorization for a live source.

Final focused tests: **325/325 in each of UTC, Taipei and Los Angeles**. Isolated
sample-browser import → reload → saved-only restored names/original freshness;
Clear → reload → saved-only returned misses without a new import. Keyboard and
375px mobile checks passed. No real calendar or private snapshot was accessed.

**Active at http://127.0.0.1:8002/.** The owner approved the shared restart window;
locked metadata preflight, the existing Windows-auth task and independent local
status verified the new disk-cache capability, native execution and safe idle.
No calendar query or private saved-file access occurred. **View saved only**
restores an existing snapshot without another import. The later UI removal above
supersedes this milestone's former import instructions. Existing session-only results are not
migrated. Older session-only descriptions below are historical.
[Scope, exact validation and remaining gates](docs/our-week.md#unified-saved-calendars-verified-offline-17-september-2026).

## Kimi ready for user testing, 17 September 2026

**Active: http://127.0.0.1:8002/.** The approved bounded Kimi workflow was deployed
once and independently verified Disabled/SAS Disabled. After explicit shared
service handoff, the existing Windows-auth task was activated with the separate
child-native boundary. Live backend/page markers, safe idle and current Activities
assets passed. No agent child listing/import, calendar query during activation,
private snapshot read, permission/policy change or new OAuth occurred.

Reload the page, open **Kimi source & access**, Find and explicitly select the
returned source, review Kimi/guardian/disclosure and confirm import. Shared-source
visibility is still unverified until this user-run test. Parent saved snapshots
remain unchanged; Kimi results are session-only in the shared **Our week**.
The five Builder-frozen UI files and event/session/cleanup contracts were preserved.
Full offline tests: **786/786 passed**. Browser/keyboard usability is not newly
verified. [Activation evidence and remaining scope](docs/kimi-calendar-import.md#shared-local-service-activated-17-september-2026)
supersede older undeployed/unactivated checkpoints below.

## Kimi in Our week: offline shared-calendar milestone, 17 September 2026

Implemented on disk: **Mike / Debby / Kimi** share one weekly calendar. Closed
**Kimi source & access** keeps explicit source selection, guardian/disclosure
review and import confirmation accessible without a separate child card. The
standalone School section and script mounts are removed; original school files
and legacy modules/tests are preserved. The empty state remains when nothing is
loaded. Parent Confirm/Update/saved snapshots still cover only two parent calendars.

Kimi's page-only bridge contains times/status, never titles or source identifiers.
It adds exact event timing, overlap lanes and a compact all-day band, not inferred
Busy/free time. Parent and child results/freshness remain independent; shared
cleanup/date changes fence late results without a signalling snapshot deletion.
**Offline validation:** 281 focused tests passed in each of UTC, Los Angeles and
Taipei; two non-server October tests also passed per timezone (five server tests
deliberately skipped). Browser mounting was blocked; visual/physical-keyboard and
parent review remain pending. No live query, private-file access, service change,
deployment or activation was performed. Older School/standalone-Kimi UI descriptions
below are historical. [Scope, validation and handoff](docs/our-week.md).

## Parent Update restored through Windows authentication, 17 September 2026

**Active: http://127.0.0.1:8002/.** The owner requested repair and a real refresh
of Mike/Debby's existing calendars. The local service now uses the existing
Windows-native Azure CLI authentication through the bounded native worker, not
the failing WSL credential path. No new OAuth, permission/policy change,
credential copying or cloud deployment was needed. The existing WSL snapshot
location is unchanged; a successful Update replaces its busy-only data normally.

**Actual end-to-end verification passed:** one October 9–15 refresh through the
running service returned HTTP 200, `cached: false`, both people checked and
**336 slots each**. Cleanup reported `workflow_disabled`; independent native
readback verified Disabled v5/owner v2, SAS Disabled, connected Outlook and
unchanged protected resources. Local status returned idle. Calendar patterns,
titles, credentials and the private snapshot were not printed or inspected.
No verification Clear was sent, and there was no automatic calendar retry.

Full offline suite: **642/642 passed**. Fresh browser/parent usability was not
revalidated. Activities retains the current `tpbl-teams-v2` assets and backend;
no public search was repeated. **Kimi remains unactivated and undeployed**:
parent authentication now works, but it does not establish shared-calendar
visibility or authorize agent-run child listing/import. The older PowerShell
launcher blocker below is historical, not the current parent execution path.
[Repair, safe activation and verification details](docs/owner-availability.md#windows-native-parent-update-repair-17-september-2026).

## Live activity search restored, 17 September 2026

**Active: http://127.0.0.1:8002/activities.** The owner explicitly approved the
idle-only local server restart. The old main process lacked the team helper route;
the separate synthetic preview returned `tpbl-teams-v1` to a `v2` page. Refreshing
static assets alone could not repair either running backend.

The existing main task now serves the current helper/controller and `tpbl-teams-v2`
backend. One fresh browser **Find activities** for **9–15 October 2026** displayed
**7 TPBL listings**, retrieved **17 September at 10:46:50 Taipei**. This verifies
public discovery, not ticket availability, age suitability or calendar fit.
Port 8019 remains the unchanged synthetic preview, not the live search entry.
Existing main tabs need a deliberate reload; no calendar query occurs on reload.

The bounded offline activity suite passed **166/166**, including six new mocked
activation checks. Activation used only local status metadata, graceful shutdown,
the existing task and static asset checks. No calendar query, private snapshot
read/change, Azure request, auth-mode change, commit or push. Saved data was left
untouched. [Activation evidence and reusable coordinator](docs/activity-discovery-teams.md#live-backend-activation-17-september-2026).
This supersedes the pending-main-activation statements in older sections below.

## Add preferred teams, 17 September 2026

Implemented on disk: **Sports → choose sports → Basketball → Add a preferred team**.
Six initially unchecked sport icons stay in order: 🏀 🏓 ⚾ ⚽ 🏸 🏊, with native
keyboard controls, accessible names and no visible checkbox squares. Basketball
discovers spectator listings; the Watch/Play/Either section and intent behavior
are removed. Anything/all-sports still permit TPBL; non-basketball-only choices
make no public request. Hidden preferred teams do not restrict broad searches.

Type a name and press **Add** or **Enter**, without submitting a search.
**Your preferred teams** shows removable chips for this page's list, not past
visits. Up to 16 names, 120 characters each; trim outer spaces and ignore case
for duplicates/exact matching. The bilingual **福爾摩沙夢想家 (Formosa Dreamers)**
shortcut adds to, never replaces, the list. Names are preferences, not verified
teams or games. A returned roster can autocomplete names but is not required.
**Only preferred teams** defaults on; turn it off to prefer them before other
games. An empty list has no restriction. Exact names match actual source-ID
home/away teams **before 40**, without guessed IDs, fuzzy matching or fallback.

Only **Find activities** requests listings. Edits fence late results and clear
game selections. Team preferences survive date/category edits but reset, reload
and page exit clear them; no new storage. Only dates use the existing tab key.
Preferences reach only the local filter, never TPBL. Other invented ideas retain
fixed 20–26 September 2026 dates and separate disclosures; explicit Basketball
does not include the invented workshop. No calendar compatibility is claimed.

Baseline **150/150**, final **159/159** bounded offline tests in both system-default
and America/Los_Angeles time zones; editor diagnostics and scope checks passed.
No full suite, browser review, live-source/private-data access, service change,
restart, cloud work, commit or push. Parent reviews the existing isolated synthetic
preview on port 8019. The known main-8002 helper 404 remains untouched; safe
activation and parent usability approval remain pending. Local API shape stays
`tpbl-teams-v2`; old/mismatched response contracts fail closed. A running Node
process may still hold the older matcher: reloading static UI does not activate
this backend fix, and the unchanged contract marker cannot detect that difference. See
[scope, contract, mock-response helper and validation handoff](docs/activity-discovery-teams.md).
Historical source-mode and dates-only API descriptions below are superseded by
this increment, not evidence of current service activation or parent approval.

## Kimi shared-calendar import: offline implementation, live activation blocked

**17 September 2026:** the guardian approved a separate, bounded read-only Azure
import using the existing Outlook connection, replacing the School calendar UI.
The consent-gated UI, session-only source handles/review tokens, strict response
validation, routes and candidate protected workflow are implemented on disk.
**Not deployed or activated:** existing live pages retain the School fallback.
The combined offline suite passed **595/595**; synthetic browser functional checks
passed, but keyboard and desktop visual validation remain incomplete. Windows
CLI identity succeeded for the user; the native preflight launcher is blocked by
PowerShell script-execution policy. No policy was weakened, credentials copied,
real calendars/events or private school/snapshot data read, cloud write performed,
or existing live/activities service restarted. [Approval, blocker, official documentation
correction and implementation checkpoint](docs/kimi-calendar-import.md).

## Approved October demo (supersedes September live bounds)

The owner approved one update of the **existing** availability workflow from v4
to v5 for **9–15 October 2026**, with the same two protected targets and busy-only
disclosure. This is not approval for arbitrary live dates or an agent-run query.
The exact window is Taipei **9 October 00:00 → 16 October 00:00 exclusive**,
UTC **2026-10-08T16:00:00Z → 2026-10-15T16:00:00Z** (336 half-hours/person).

**Cloud migration and local activation completed on 16 September 2026.**
Exactly one existing-resource PUT succeeded at **09:11:59 UTC**; independent
readback at **09:12:02 UTC** confirmed **Disabled v5 / SAS Disabled** and preserved
resource guards. The original persistent owner task is active at
**http://127.0.0.1:8002/** (PID **87538**): locked status-only verification at
**09:15:46 UTC** confirmed live/disk, `idle / not_requested`, and the v5 marker.
No agent calendar query or private snapshot inspection occurred. Current full
offline tests passed **473/473**. The served page and all seven required scripts
returned HTTP 200. Fresh live-browser Confirm/zero-startup-API verification is
**not confirmed**: integrated browser creation failed and isolated Edge CDP
connection failed. Earlier synthetic browser evidence below remains separate.

Empty tabs now default to October; remembered dates remain unchanged. Confirm,
Update and View saved only accept only the exact October live window. Activities
still accepts independent 1–7-day selections without calendar access. New UI blocks
older backends until a safe restart establishes the v5 capability marker.

A valid September snapshot is retained under its original contract, never
relabeled as October. October saved-only returns a miss without provider fallback.
Only a successful matching October result replaces the single file; generic query
failure keeps prior bytes but returns no old data. Clear and known access,
contract or cleanup failures still invalidate it. No snapshot existence is assumed.

Baseline **460/460**; final offline suites **473/473** in both the default and
America/Los_Angeles time zones. Synthetic Edge checks passed empty startup (zero
API requests), October Confirm, 672 slots, exact saved grid/timestamp, keyboard
focus, 1280/320 CSS px layouts and date-edit hiding. The Activities end-to-end
browser check remains incomplete; dates-only/public-search regressions passed
offline. No real calendar or private snapshot was accessed for validation.
[Scope, deployment evidence and limitations](docs/owner-availability.md#approved-october-demo).

## Saved-week recovery (16 September 2026)

Changing dates now hides results and cancels/fences pending work **without deleting
a completed saved snapshot**. This supersedes the date-change deletion behavior
below, not explicit Clear, access revocation or contract/cleanup failure handling.
The diagnosed destructive path was the UI's range-clear request, not the already
non-destructive unsupported-range availability gate. The earlier generic failure's
exact cause is unconfirmed: local status retains no historical request error.

**View saved only** explicitly confirms the visible busy-only scope and reads only
a matching snapshot. A miss says no saved view exists, with **no provider fallback**.
Outside the fixed **20–26 September 2026** calendar contract, Confirm/Update/saved
view are blocked locally. **Choose 20–26 September 2026** changes dates only; then
press View saved only. No old week is relabelled as October. Activities still accepts
any valid 1–7-day selection independently. No cache existence is claimed on startup.

The new `owner-saved: preserve-v1` marker blocks this UI on older backends until a
safe local restart. **Validation and activation completed:** final `node --test`
passed **405/405**, with clean editor diagnostics. Isolated headless Edge verified
saved-only September → unsupported October → September, identical original data
and timestamp, unchanged disposable snapshot bytes, plain failure/miss messages,
keyboard/mobile behavior and zero provider-adapter calls.

**Active: http://127.0.0.1:8002/**. Port 8002 was already stopped (fresh GET refused;
no listener), so no process was killed. The existing persistent owner task was
started under the local operation lock. Fresh matching-origin CSRF/status returned
`idle / not_requested`, live/disk, both protocol markers and no sticky failure.
A new empty browser page loaded successfully with zero startup API requests and
View saved only available. Existing user pages and the real saved file were not
read, refreshed, changed or checked for existence. Reload an older page only when
ready. No Azure/provider call, workflow update or real calendar retry occurred;
temporary synthetic review was stopped. See [final evidence and concurrent-work limitation](docs/owner-availability.md#saved-week-recovery-16-september-2026).

## Local school calendar (16 September 2026)

Converted the owner-provided PDF into **five family-relevant events**, with
grade/audience restrictions and unconfirmed participation kept explicit. The local
calendar directory contains the reviewed manifest, app JSON and ICS export, all
excluded from Git along with the original PDF. Date-only ICS entries are tentative
and transparent, with no reminders or assumed busy times.

In **Our week → School calendar**, select the generated school-family JSON,
choose **Whole term** to see all five (or **Selected dates** for the current range),
then **Load local school calendar**. A selected week may have no matching entries.
School data stays in the page, separate from Outlook
availability and saved snapshots; no upload or calendar query is needed.
Removal clears only the page copy, not the original local files.

Earlier full-suite checkpoint: **460/460** passed. Latest school-specific tests:
**55/55** passed in America/Los_Angeles; the latest full-suite rerun stalled in
owner-server tests and was stopped, not counted as passed. Synthetic browser
keyboard, filter/removal and mobile checks passed with zero API requests. Real file-picker selection is
still an owner step because the embedded browser could not access the WSL path.
The running service already serves both required scripts; no restart or cloud
change was performed. [Usage, provenance, conversion and limitations](docs/local-school-calendar.md).

## Calendar dates and Confirm (16 September 2026)

The owner approved **choose Start date and End date → Confirm → load calendars**,
without a separate owner checkbox. The two default calendars and Busy-only scope
remain visible before Confirm. Select **1–7 inclusive days**, in Taipei time;
Confirm is the explicit access action, not visitor sign-in. Update is available
only after confirmation. Date edits immediately hide old results; after a request
they hide the saved view and cancel/fence pending work before another
confirmation. Invalid dates never request data. Clear, expiry and cleanup failures
retain their fail-closed behavior. Basketball now shares only these selected dates,
not calendar data or consent; see the handoff below.

**Local code is now active on port 8002 after the basketball handoff below.** Synthetic RAM
review supports the selected dates. The existing live Azure workflow and disk
snapshot contract still support only **20–26 September 2026**. Other live ranges
return `range_unavailable` before cache access or provider work; they never load
the old week under new dates. Updating that workflow still needs separate approval.
No cloud update, real calendar query or real snapshot access was performed. The
later idle-only local restart did not enable new live calendar ranges. Old servers lack the new capability marker: the updated
page blocks requests and asks for a safe operator restart and reload, rather than
sending an unsupported request. A reload alone does not update the backend.

**Validation:** full offline suite **380/380** passed, including the concurrent
basketball work (superseding its earlier in-progress combined-test failures below).
Isolated synthetic browser checks covered zero startup requests, keyboard Confirm,
one-/two-/three-day views, year/leap-day boundaries, invalid ranges, date-edit
clearing, slow-request cancellation followed by reconfirmation, partial/unknown
schedules and mobile layout at measured **319 CSS px**. Parent usability and dynamic
live-calendar authorization remain separate. [Details](docs/owner-availability.md#date-selection-and-confirm-16-september-2026).

## Public Taiwan basketball search: Our week dates connected

**16 September 2026:** Activities now has **Basketball games → Find games**, using
the official TPBL public JSON schedule, with separate **Sample ideas**. Choose a
matching game to inspect details and open its official page. No paid API, AI/CLI
installation, new cloud service, booking, calendar query/data/cache access or
child-preference transfer. Source requests run only when asked.

**Open http://127.0.0.1:8002/activities** (localhost also works). In the same tab,
choose **Start date / End date** in **Our week**, then follow **Activities** and
press **Find games**. Do **not** press calendar Confirm just to find games.
The heading and public request use exactly those **1–7 inclusive Taipei days**.
Without a selection, the displayed configured default is **20–26 September 2026**.
Invalid dates block search, never silently reuse an earlier week.

Only version/state/start/end dates are remembered in one `sessionStorage` key;
no names, ages, busy blocks, calendar consent or results are stored/shared.
Same-origin navigation and reload retain dates; separate tabs and localhost vs
127.0.0.1 are separate storage contexts. **Reset dates** forgets this tab’s dates;
**Start over** clears choices/results but keeps dates. Sample ideas retain their
explicitly labelled original September fixture dates. This is not availability comparison.

**Actual public check:** one fresh diagnostic tab searched **9–15 October 2026**
and displayed **7 TPBL listings**, all October 9–11 (16 September, 08:07:03 UTC).
That tab’s diagnostic dates/results were reset, not applied to existing user tabs.
The earlier September check was outside the retrieved range, which begins October 9.
P. LEAGUE+ is **not searched**, with an official link; this is not all-Taiwan coverage.

**Validation:** full offline suite **397/397** in both UTC and America/Los_Angeles;
synthetic owner-input → navigation → exact public request/card checks, invalid
dates, reset, late-response fencing, desktop/mobile layout and keyboard checks.
Browser review found and fixed a Node/Chromium `Intl` label-punctuation mismatch.
Only the verified idle disk-backed 8002 process was gracefully restarted under
the existing local operation lock. No real calendar/cache access or Azure change.
Older owner tabs need a deliberate reload for a fresh page session; reload never
queries calendars. Parent review remains separate. [Scope, sources and validation](docs/basketball-search.md).

## Earlier sample-only activity flow (historical)

**Loopback access repair (16 September 2026):** open
**http://127.0.0.1:8002/activities** in remote VS Code; **http://localhost:8002/activities**
also works. The reported connection refusal was followed by a reproduced HTTP 403:
the restarted server accepted only `localhost`, while remote forwarding used
`127.0.0.1`. The owner server now accepts only these two exact hosts on its configured
port (8002 for the live entry point). Origin must match the actual request host;
CSRF page sessions are bound to that exact origin. Cross-host token reuse, other
ports/hosts, cross-origin requests and Forwarded/X-Forwarded-* headers are rejected.
No wildcard, proxy-header trust, redirect or CORS permission was added.

The identified live process was confirmed idle with a fresh localhost page session
and local status check under the existing operation lock, then gracefully restarted
using the existing task. No real calendar/provider/Azure request or snapshot read,
clear or deletion was performed. Older owner tabs need an owner-deliberate reload
for a fresh page session; activity navigation still carries no owner session/data.
Baseline **298/298**, final **301/301** offline tests passed, including three new
HTTP regressions. The formerly blocked browser page now loads at the actual IPv4
URL, with its four CSS/JS assets returning 200, zero API/external requests, keyboard
skip-link focus and no desktop horizontal overflow. Parent review remains separate.

**Playful activity polish (16 September 2026):** a larger smiling sun, cloud and
sparkles fit inside the existing heading, with the shared navigation and outer
card alignment unchanged. **Who's coming?** has one **Ages (optional)** caption,
compact pastel **Any / age** selects and 44px **× / +** buttons with accessible
names. No permanent age paragraph, visible numbered labels or duplicate Skip
ages button. Any, removing all rows, and Start over still skip ages; bounds 4–17,
eight-entry maximum, twins, all-ages matching and sample disclosures are unchanged.
Baseline **295/295**, final **298/298** tests passed; desktop/mobile screenshots,
keyboard and fresh empty-owner alignment checks passed at 1279/375/319 CSS px,
with zero API requests. No server restart or calendar/cache access.
[Scope and validation](docs/activity-ux-refresh.md#playful-artwork-and-compact-ages-16-september-2026).

**Earlier shared content layout (16 September 2026):** Our week and Activities now start
with the same full-width card, compact in-card heading, fixed-week date and Taipei
time-zone placement. [Shared layout styles](shell.css) own page margins, content
width, card padding/radius and section spacing. The activity sun is now a small
in-card illustration, not a separate hero pushing the form down. Existing chips,
controls and matching behavior remain; only the inner form is capped at 860px,
while result cards span the shared content width. No controller, calendar, cache,
auth, API, route or server changes were made.

Baseline **293/293**, final **295/295** tests passed. Browser comparisons on actual
8002 routes at measured **1279, 1328, 375 and 319 CSS px** found matching card
x/y/width/padding and header/nav/date/time-zone geometry within 1px, with no page
overflow. Desktop/mobile screenshots and keyboard/result checks passed using
fresh, unacknowledged empty owner pages and sample activities only; zero API
requests. No service restart or real snapshot access. Reload when ready; reload
does not query calendars automatically. Use **http://localhost:8002/activities**:
the older running 8010 preview lacks the current asset routes and was left
untouched. [Measurements and limitations](docs/activity-ux-refresh.md#shared-content-layout-repair-16-september-2026).
Parent review remains open.

**Earlier shared navigation (16 September 2026):** Our week and Activities use
[the same visual shell](shell.css): matching brand/tagline, container, link order,
spacing, keyboard focus and underlined current-page state. The fixed source row
keeps **Read-only calendar**, **SAMPLE DATA**, and **Sample activities** distinct
without moving navigation. Activity cards, controls and page-only state are unchanged.
Baseline **291/291**, final **293/293** tests passed. Fresh unacknowledged owner and
sample pages had identical header/link rectangles in both directions at actual
1280/320px on port 8002 and 375px in synthetic review; no browser API requests.
Only the verified idle disk-backed 8002 process was gracefully restarted for the
explicit stylesheet allowlist. No snapshot was read/cleared or provider queried;
loaded tabs were untouched. Older owner tabs need an owner-deliberate reload for
a fresh local session. Temporary review servers were stopped. Parent review remains open.

Open **http://localhost:8002/activities**, or use **Activities** from the owner
page. The existing **FamilyCopilot: local owner calendars** task now serves the
preview's allowlisted static assets too; no activity build or dependencies are
needed. The owner calendar page remains separate, and `/demo` still serves the
original fictional walkthrough. The product vision above is not implemented
proactive behavior: this activity flow responds only when **Find ideas** is pressed.

1. **Who's coming?** Optionally add up to eight ages (4–17), with no names or birth
	dates. Skip/remove any or all ages. Twins are supported; every chosen age must
	fit the same sample's guidance.
2. **What sounds fun?** Choose Sports, Music, Art, Science, Outdoors or Exhibitions.
	**Surprise us** explicitly clears interests, not other filters.
3. **Find ideas** returns up to six actual matching invented cards, never padded.
	Unknown required age/price guidance is separately **Needs checking**. No age
	selection means **Age not checked**. **More options** starts closed, with day,
	morning/afternoon, USD sample price per child, indoor/outdoor and format filters.

Dates are fixed to **Sunday 20–Saturday 26 September 2026, Taipei (UTC+8)**,
matching the Our week heading, not importing a calendar window or availability.
All six activities and Taipei venues are fictional. USD prices are invented, not
converted or verified local prices. Travel, spaces and schedule fit are not checked.
There is no live source, search service, location lookup or calendar integration.
Ages/interests stay in this page only; edits hide previous cards, and Start over,
reload or page exit clears preferences/results. No profile, browser storage,
analytics, owner auth scripts or API requests are used by this activity page.

**Activation (16 September 2026):** only the verified idle disk-backed 8002 process
was gracefully restarted under the existing local operation lock to load the new
routes. No real cache file was read/changed, calendar/provider query made, or loaded
calendar browser tab inspected/reloaded. The live task is running; old calendar
tabs have an obsolete local session and can be reloaded by the owner when ready.
Reload itself never requests availability. Existing other servers were untouched.

Executed baseline **277/277**, final **291/291**; **27/27** dedicated activity tests
also pass in America/Los_Angeles. Desktop 1280px/mobile 320px browser checks passed
without activity API/external requests. Editor diagnostics and whitespace checks
are clean. [Scope and validation record](docs/activity-ux-refresh.md#approved-current-increment-simple-activity-inspiration-16-september-2026).
Parent usability review is still required; real activity sourcing and calendar
comparison are separate future milestones, not authorized by this navigation change.

## Interactive demo (static prototype)

Open [index.html](index.html) directly in a modern browser, or serve this directory with an ordinary static server. No build, dependencies, or deployment are required or implied.

The mobile-friendly prototype has three walkthroughs: **Our weekend** shows fictional, privacy-redacted schedule context; **Find an activity** filters bundled science, concert, and exhibition cards; and **Check an event** assesses only preset fictional pages. The English **Calendars** list appears above the question box in every journey. Each compact row contains a colored initial avatar, a user-chosen name/alias, a textual **Not configured**, **Ready**, or **Paused** status, and icon-only **⋯** / **−** actions. Connection and disclosure details appear only inside Settings.

The single overall notice reads: **Interactive demo · No real calendars connected. Data is fictional and stays in this tab. Do not enter personal information.** Its **About this prototype** disclosure holds the full read-only/no-live-research boundary. Schedule and activity results also identify fictional sources and retain checked/missing context, non-current freshness, and unknown travel/tickets. **Ready** means ready within this demo, never a live connection.

**This fictional demo has no real calendar integration.** A separate [browser PKCE own-calendar picker](docs/microsoft-browser-picker.md) is now implemented and tested, but remains unconfigured after a failed registration attempt. It does not change the demo or implement event import. An email address alone is neither consent nor a calendar connection. The invitation preview accepts fictional `.test` addresses only. Provider feasibility, parent review, and later import remain separate gates.

### Approved owner-only Logic App calendar listing

The owner separately approved a simpler **list available calendars only** experiment using the existing authorized Outlook connection, with a separate, exact-caller-protected Logic App. [The original operator-only slice](docs/owner-calendar-list.md) added count-only responses and protected run history. **Historical result (15 September 2026):** deployment succeeded; anonymous and invalid-token requests both returned 401; one authenticated list returned **3 entries**; the workflow was then disabled. No events were requested. Completeness and ownership are not established.

The subsequent explicitly approved local UI adds **Load → Select → Local summary**, discoverable from the fictional demo's Calendars section. Start **FamilyCopilot: local owner calendars** in [.vscode/tasks.json](.vscode/tasks.json), then open **http://localhost:8002/** in external Edge. It starts idle without credentials or Azure access. Use the developer/owner acknowledgement before Load; this is the existing authorized account, **not visitor sign-in**. Selection grants nothing and feeds neither an assistant nor the fictional demo. Clear/cancel removes local names and fences late results; the connector is not disconnected.

**Current result (15 September 2026):** the authorized **v1 → v2 owner-label update is deployed**, with independent readback confirming **Disabled, SAS Disabled**, connection **Connected**, invitation **Disabled**, delivery **off**. The updater uses the documented exact workflow PUT, cooperative local exclusion, an immediate pre-write re-read and exact post-readback checks. It does not claim atomic Azure compare-and-swap; the former mandatory ETag gate was an unsupported tooling assumption, not a provider requirement. A live check exposed a second overly strict check on the connector's runtime `changedTime`; that narrow post-load comparison is fixed. The separately reauthorized E2E check then reported **passed, exit 0**. Its execution summary omitted the returned calendar count, so no current count is claimed. See [the evidence, concurrency limitation and handoff](docs/owner-calendar-list.md#local-owner-ui-increment). The real page is running empty at **http://localhost:8002/**; reload an old page before using it.

The separate **FamilyCopilot: synthetic owner browser review** task serves **http://localhost:8003/** with explicitly fictional fixtures and no Azure calls. Desktop/mobile keyboard, escaping, focus, summary and failure/cleanup checks use only this harness. The owner server needs Node **18.17+** (verified on 20.20.1) and a current browser; no build or new packages are needed. Do not expose either server to other people or share a real calendar page with an agent. Mail, event import, multiuser sharing, persistence and new OAuth registration remain outside this increment; it does not unblock the PKCE picker.

### Current owner POC: Sunday week and local-file snapshot

The weekly heading is **Our week**, with **Mike / Debby** throughout the person
labels, access summary and accessible calendar descriptions. This is presentation
copy only: **Mike → Mike Lee; Debby → Debby**, with the same protected targets,
authorization, dates, layout and cache binding. No family-role assertion, editable
nickname controls, Add someone or multiuser flow is added. Earlier Dad/Mom records
below are historical. [Current copy scope and validation](docs/owner-availability.md#our-week-presentation-copy).

The parent-facing page now leads with the calendar: **Our week**, the fixed date,
**Mike + Debby · Default calendars · Busy-only**, one unchecked owner confirmation,
then **View week**, **Update**, and secondary **Clear**. One **Updated [date, time] ·
Saved view** line retains the original time, with **May be out of date** when stale.
Missing schedules and actionable errors stay visible; routine technical explanations
are in closed **Details** below the calendar. Synthetic pages keep a visible
**SAMPLE DATA** badge and short sample-source label. Consent and requests are unchanged.
[Parent-friendly presentation](docs/owner-availability.md#parent-friendly-calendar-presentation).

**Use http://localhost:8002/ for owner calendars.** Port 8011 was an ad-hoc
synthetic UX review server, not the owner's schedule. Its partial fixture repeats
four statuses every half hour for the first sample and leaves the second unknown
all week. Review pages now say **SAMPLE DATA** in the header and **SAMPLE calendars**
in the tab, with **Mike (sample) / Debby (sample)** and a source notice beside the grid.
These remain fictional Alex/Sam fixtures, not real schedules. The UX styling and
protected targets are unchanged. Reload older
pages for the labels; reload never loads availability. [Diagnosis and validation](docs/owner-availability.md#synthetic-review-source-label-repair).

The approved current week is **20–26 September 2026**, Sunday leftmost, ending
**27 September 00:00 exclusive, Asia/Taipei** (UTC 19 September 16:00 through
26 September 16:00 exclusive). Mike/Debby retain the same protected targets and
336 half-hour slots each. The fictional demo is unchanged.

After explicit acknowledgement, **View week** prefers one verified redacted local
snapshot and queries only on a miss. **Update** explicitly queries again, without
cached fallback on failure. **Clear** or withdrawing acknowledgement
invalidates shared RAM, removes the local file and fences pending results. Reload clears the tab, not an
already verified snapshot; review again and press View week to reuse it without
a provider query. **Backend stop/restart retains the file, with no TTL.** The backend
must still be running to view/reuse it; this is not an offline-browser feature.
No browser storage, database, cloud store, background requests or new login/settings.
The existing **30-minute page
authentication session is separate from snapshot retention**.

The live entry point explicitly enables a single bounded JSON file at
`$XDG_CACHE_HOME/familycopilot/owner-availability.json` when XDG_CACHE_HOME is absolute,
otherwise `~/.cache/familycopilot/owner-availability.json`. It is outside the repository:
directory **0700**, file **0600**, atomic replacement. Only projected busy-status
enums, fixed window, original timestamp and non-sensitive binding fingerprints are
stored, never credentials, raw events, names, addresses or provider IDs. Clear is
file removal, not secure erase or deletion of backups/Azure history. Invalid files
or I/O failure give an explicit error and no silent provider fallback; retry Clear
before reloading/reviewing. The synthetic entry point and imported constructors
default to RAM only; tests explicitly inject disposable private directories.

**Activation:** an already-running RAM-only backend cannot adopt this code by page
reload. It was not stopped or migrated because its current RAM may contain user
results and has no cache-only export route. At the next safe backend restart the
live task enables disk storage; only a subsequent deliberate successful View week
or Update saves a snapshot. Details discloses the running server's storage mode.

The original **Last updated** timestamp stays unchanged on reuse; after five
minutes freshness is stale, not live. **Provider permissions are not rechecked for
a cached snapshot**; offline revocation cannot be detected. Known access/contract
failures and sticky cleanup blocks cannot be bypassed. One local owner, one fixed
week, not a multiuser store. [Current local-storage contract](docs/owner-availability.md#local-file-snapshot-no-ttl).

The following sections are historical milestones; the current week and local-file
retention above supersede their earlier date and reload-retention descriptions.

### Historical approved fixed-week two-person availability

The next explicitly approved milestone replaces the first protected target with
**Mike Lee**, retains **Debby**, and checks **2026-09-15 00:00 through 2026-09-22
00:00 exclusive, Asia/Taipei (UTC+8)**: seven full days, **336 half-hour slots per
person**. Dates never roll. The owner page hides **Choose available calendars**
without removing its backend or shared cleanup protections. The named access
summary must be confirmed before one request; the initial expandable daily groups
are now superseded by the weekly diagram below. Default calendars only; missing
data is never free. The fictional activities link remains separate, not integrated.

The exact guarded **Disabled v2 → v3** update is deployed. The **single approved
live verification succeeded: Mike Lee true / 336 slots; Debby true / 336 slots**.
Independent exact-contract readback confirms **Disabled / SAS Disabled**; preserved
resource checks passed, verification session cleared and proxy idle. Real target
addresses stay only in protected operator parameters, whose values ARM hides on
readback. Existing connector, invitation and calendar-list configurations were not
modified. Only the idle port-8002 owner process was restarted onto current code;
**reload an older tab**. No further provider query was made. Baseline **212 passed**;
current suite **223 passed**, with synthetic desktop/mobile review at 1279px/319px.
See [the fixed-week contract and execution record](docs/owner-availability.md).

### Presentation-only weekly calendar simplification

The owner-approved display aliases are **Dad (previously Mike Lee)** and
**Mom (previously Debby)**. These are labels only, not new identities, parent or
guardian claims, or changed authorization. The exact protected targets and fixed
15–21 September 2026 Taipei window remain unchanged.

The owner page now has **one weekly diagram**, Tuesday 15 through Monday 21,
with parallel Dad/Mom tracks in each day and a shared vertical time axis. Adjacent
equal statuses merge within each day; midnight ends at **24:00**. All seven columns
fit desktop; mobile uses a keyboard-focusable horizontal scroll region with sticky
time labels. Unknown remains labelled and hatched, never free. Source, freshness,
missing context and the working-elsewhere caveat remain visible. Confirm the exact
two default calendars and all 336 slots each before **Check week**. Technical
explanations are collapsed; the old calendar picker remains hidden and inert.

This increment makes **no live request or cloud change**. Static assets are read
from disk per request, so no server restart is needed. Reload an older tab to see
the new presentation; reloading discards its local results and never queries
availability automatically. Synthetic review remains separate; see the
[presentation validation record](docs/owner-availability.md#presentation-only-weekly-diagram-15-september-2026).

### Historical single-day availability and session-expiry repair

The owner subsequently explicitly approved implementation and deployment for two operator-confirmed adults, **15 September 2026, 09:00–17:00 Asia/Taipei**, 30-minute intervals, owner-only scheduling. The existing **http://localhost:8002/** page now includes two independent availability rows, explicit review, fixed-range/source disclosure, loading/partial/unknown/stale states and shared-session clear/cancellation. No browser-configurable mailbox/range, assistant ingestion, mail, writes or background refresh. Default calendars only; a zero grid value can mean working elsewhere, not guaranteed free time. Synthetic review is separate on port 8003.

**Earlier live result:** the exact guarded v1 → v2 repair is deployed **Disabled / SAS Disabled**. The Parse JSON runtime rejected the schema's `pattern` property; equivalent protected WDL syntax checks replaced it without weakening authorization or projection. The first authorized mailbox query returned **person 0 success: true; person 1 success: true; 16 checked slots each**, with independent cleanup and preserved-resource checks. This historical success does not establish that a later Load succeeded.

**Latest user-reported failure:** the existing browser request returned **HTTP 403 at page age 130 minutes**, beyond the proxy's **30-minute session lifetime**. The local session gate rejected it before Azure work. The UI hid this distinction behind generic unavailable/unconfirmed-cleanup text. The proxy now reports a fixed `session_unavailable` reason; the UI explains local rejection and offers an explicit reload link, without retrying or treating reload as cleanup confirmation. Genuine cleanup failures remain sticky. Independent checks found the proxy idle and Azure **Disabled / SAS Disabled**; no cloud repair or new mailbox query was needed. Only the idle port-8002 owner service was restarted. **Reload the existing tab** to use the repaired code and a fresh session, then explicitly check local cleanup; reload itself performs no availability request.

See [implementation, privacy contract and repair evidence](docs/owner-availability.md). Cloud projection strips details before the local boundary, but Graph may fetch them into protected Azure processing; no zero-retention claim. Full offline suite **212 passed**, including expiry and sticky-cleanup regressions, with synthetic desktop/mobile recovery checks. No live retry was performed for this fix; parent review and production readiness remain separate. The [earlier metadata-only feasibility record](docs/availability-feasibility.md) is historical, not the current approval boundary.

### Approved invitation email infrastructure

The parent subsequently approved the adult Microsoft account invitation journey and authorized an Azure Logic App for user-requested onboarding emails. [The email infrastructure increment](docs/invitation-email.md) adds an isolated Consumption workflow, a new Outlook API connection, a guarded deployment helper, and offline infrastructure tests. It deploys disabled, with delivery separately off and no recipient configured; it cannot connect calendars or supply an invitee website. Mailbox authorization, reachable onboarding, invitation lifecycle, and a reviewed first send remain prerequisites. The static prototype now previews email-first entry but does not call this workflow. This approval is not permission for meeting invitations, calendar writes, alerts, or child-account access.

**Current Azure result (15 September 2026):** workflow deployment succeeded after correcting Request-trigger schema compatibility. Subsequent read-only checks confirm the workflow and SAS are disabled, delivery is off, and one Entra caller policy is present. The preserved Outlook connection now reports **Connected**, after external interactive authorization; it was not reset or re-created. No mail or calendar access occurred in this increment. Deployment and offline tests do not establish runtime authorization or mail delivery. See [deployment status and recovery](docs/invitation-email.md#scope-and-status).

### Earlier server-side onboarding approval: historical credential preflight

The parent explicitly approved implementation and deployment using **Azure Static Web Apps + Functions, independent Storage for invitation state, and an Entra app registration**. This supersedes the earlier pending architecture approval for this narrow adult invitation/picker milestone, not for calendar event import or the first real email. Parent usability review and provider/account policy remain separate gates.

Read-only preflight found that the subscription tenant permits default-user application creation, but its enabled application-management policy prohibits new client secrets and specifies a zero-second certificate maximum lifetime. The standard secret/certificate-backed authentication path is therefore blocked. No new app registration, hosting, Storage, credentials, or deployment was attempted. This is not evidence that all federation paths are prohibited, or that multitenant/personal accounts are permitted.

[The preflight record and administrator handoff](docs/live-onboarding-preflight.md) distinguish verified facts, documented hosting constraints, and unresolved choices. [The reusable read-only check](scripts/onboarding-preflight.js) takes `check`, requires the explicit approved Azure scope, emits only bounded policy evidence, and never creates resources or authorizes deployment. [Its offline tests](test/onboarding-preflight.test.js) use mocked Azure responses. The UI and invitation lifecycle remain unchanged and offline; no additional fake success flow was added.

### Newly approved browser PKCE picker: implemented, registration unresolved

The parent subsequently **explicitly approved browser OAuth PKCE** for the smallest own-account milestone: sign in, confirm identity, list own calendars, select and review a local summary. This supersedes the server-side choice for this picker only. It is not an attempt to bypass tenant policy, and secret/certificate restrictions do not block the SPA protocol. No unnecessary Functions or Storage were created.

[picker/index.html](picker/index.html) and its isolated [state/Graph adapter](picker/core.js) use locally bundled MSAL Browser 5.21.0, a dedicated v5 popup bridge, memory-only tokens, bounded calendar-list pagination, conservative own-calendar filtering and late-response cleanup fencing. The initial audience is only the owner's corporate home tenant, not all adult Microsoft accounts. No events, background refresh, assistant access, cross-family sharing, email or persistent connection are enabled. `Calendars.ReadBasic` is broader than calendar names at the provider level; the UI discloses that distinction.

**Actual cloud result:** one approved credential-free registration attempt stopped with safe code `AzureOperationFailed`; a read-only exact-name lookup returned zero matching apps. No success or underlying policy cause is inferred, and creation was not retried. The public client ID remains empty, so sign-in is disabled. No hosting deployment or account-holder OAuth/calendar access occurred. Existing mail resources were rechecked and remain unchanged. See the [exact attempt, public configuration, safety contract and validation record](docs/microsoft-browser-picker.md).

For external Edge, use the **FamilyCopilot: live Microsoft picker** task in [.vscode/tasks.json](.vscode/tasks.json), then open **http://localhost:8001/**. Install the exact lockfile with `npm ci --ignore-scripts` if needed. The task builds and serves only the picker; do not use the original port-8000 asset-limited server for it. The page currently correctly says **Not configured**. A verified public app ID is the next blocker, not another architecture approval. The account holder must perform future real sign-in/consent externally, never through agent tools. [Detailed trial instructions](docs/microsoft-browser-picker.md#try-in-external-edge) describe configuration and separate synthetic review. Parent usability, live consent/mailbox support and actual desktop/mobile Edge checks remain unverified.

### Email-first invitation entry (offline preview)

1. Press **+** beside **Calendars** (accessible name: **Invite an adult**). A named modal asks for **Adult email (preview only)** and discloses that sending and recipient onboarding are unavailable.
2. Enter a fictional address such as `adult@example.test` and select **Review invitation**, or press Enter. Validation checks one bounded email address and restricts preview state to `.test` domains. It does not verify mailbox existence, adulthood, ownership, or authority. Real addresses and malformed entries are rejected without copying them into application state or error messages; submission clears the input. While typing, text exists only in the input DOM. Autocomplete is disabled as a browser hint, not a guarantee about browser-managed history.
3. Review the fictional recipient and requested action. **Not sent · Unavailable** explains the absent connected invitation server, mail delivery, and onboarding page. **Send invitation (unavailable)** is disabled. No link, email draft, calendar row, consent, or delivery/acceptance status is fabricated.
4. The review describes the intended future adult journey: explicitly acknowledge or decline after verified sign-in, choose calendars/represented people/disclosure/audience, then review and confirm access before any import. Opening an email or acknowledging an invitation grants no calendar access. Cross-parent personal/work details remain hidden and private events stay Busy-only. None of this recipient-side flow is implemented here.
5. **Change recipient** clears the review and returns to empty entry. **Cancel**, Escape, reset, page exit, or simulated revocation clears invitation state and input; close restores focus to **+**. Deleting a fictional row, changing provider/privacy choices, pause, and disconnect also clear any invitation preview. No invitation data is persisted or sent. Reload starts empty.

The preview state machine is deliberately limited to `closed`, `editing`, and `unavailable`. It has no send/accept/import action and cannot promote a fictional email into a sample calendar identity. The existing email infrastructure is operator-only and uses a configured recipient, not an arbitrary UI-provided address. Merely deploying it cannot complete this journey. The approved next live slice needs an authenticated invitation service and reachable recipient website, identity/audience binding, expiring single-use/revocable invitations, send ledger/rate limits, reviewed retention, and separate calendar selection/consent. Its implementation is blocked at the credential-policy gate above; no hosting, storage, account registration, or live application authorization has been added.

### Fictional calendars, settings when needed

1. Start with the fictional **Alex** and **Sam** rows, both **Not configured**. To add another fictional alias, expand **Demo state controls**, enter **Fictional alias (demo calendars only)** and press Enter or **Add demo alias**. This is separate from **+**, which opens invitation entry. **−** removes a row (for example, **Remove Alex**). Names are trimmed, limited to 60 JavaScript string characters, and duplicate checked case-insensitively. An alias is optional to the overall experience; only adding a demo row requires a nonblank label. Use fictional aliases, not real personal information. Adding a name requires no provider, age, or child details; it imports nothing, grants nothing, and creates no persistent profile. Discovery remains usable even after all rows are removed.
2. Select **⋯** (for example, **Calendar settings for Alex**). The named dialog offers **Provider** and explicitly states that no real permission is requested. Choose Outlook or Google, then **Continue in demo** (or **Manage Outlook / Google** to resume). **Step 1 · Outlook / Google access** describes read-only use and fields. **Data use and privacy** expands retention and sharing restrictions. **Deny permission**, **Cancel**, **Close**, or Escape exits without importing anything.
3. Select **Grant permission in demo** to reach **Step 2 · Choose calendars**. Permission only enables the picker; it imports nothing. Each provider has one bundled calendar, initially unselected with **Busy-only** disclosure. Explicitly select it and its matching fictional represented-person label. The Google/Sam source additionally requires guardian attestation; the adult Outlook/Alex source does not. Child status comes from the source, never from the added name. No real identities or credentials are requested. **Missing a calendar?** expands provider and guardian-access limitations.
4. Select **Review access**. **Step 3 · Review access** lists provider/account, calendar, represented person, disclosure, guardian attestation where applicable, the fixed 20–21 June 2026 range, current-demo-viewer-only audience, and session retention. The illustrative pre-import preview explains disclosure without loading calendar events.
5. Select **Confirm in demo**. Only that subject’s reviewed choices are committed; the dialog closes and its row becomes **Ready**. Reopen **⋯** for the selected-calendar summary, disclosure, simulated freshness, and **Imported preview — current disclosure**. Private events always stay Busy-only. Closing returns focus to the row’s Settings button.
6. Configure another subject independently, including with the same provider. Each subject has separate grants, drafts, and confirmed choices. A label such as “Example Third” using Google still shows **Demo source: Sam Google / Sam (fictional child)** in Settings and results. It is not presented as Example Third’s real calendar or evidence of identity/authority. Results name exactly which existing subjects were checked or remain unchecked; deleted names are not invented as missing context.

Colors are presentation only: the six fixed themes **ocean, plum, forest, clay, indigo, rose** are assigned in creation order using a stored `colorIndex` and the monotonic subject sequence. The first six created subjects have distinct colors; subsequent subjects cycle through the palette. Deletion, settings, provider changes, pause, and revocation do not recolor surviving names. Reset restores the initial two colors. The same accent appears in the row, Settings identity header, and disclosed commitment blocks. Colors never imply identity, sensitive attributes, permission, or status; names and statuses remain textual. Only allowlisted CSS classes are rendered, never user-supplied styles. **Names, colors, and privacy** explains this inside Settings.

Within Settings, **Manage Outlook / Manage Google** reopens that subject’s choices. Opening or cancelling unchanged management preserves confirmed access. Editing any choice immediately removes that subject’s previous import and invalidates its summary, even if later cancelled; review and confirm again to restore access. Changing provider also clears that subject’s previous grant and choices. Other subjects remain unchanged. Cancelling after a simulated grant leaves the row **Not configured** with no imported samples; reopen Settings and use Manage to continue.

**Pause** and **Disconnect** are inside Settings. Both clear the affected authorization and imported/derived results, including any prior event assessment. Pause retains only pretend permission; resumption requires selection and a fresh summary/confirmation. Disconnect removes pretend permission as well. **−** on the front list removes the entire subject, including grants, drafts, confirmed events, and derived assessment; focus moves to the next/previous row’s **⋯** button or **+** if no rows remain. Re-adding the same name cannot restore deleted data. Other subjects remain intact. None of these actions contacts a real provider.

**Reset demo**, the footer reset, or reload removes session changes and returns to the two unconfigured fictional examples. There is no persistence, export, background refresh, backend, network access, OAuth, live calendar/search/page extraction, analytics, or real family data.

Expand the initially closed **Demo state controls** to show loading, empty, no-calendar, partial, stale, conflict, revoked, unavailable, and unsupported-child-account wording. The default Ready scenario has no checked context until consent is confirmed. Scenarios cannot authorize import, and subject actions never change the global scenario to Ready. Partial omits all Google fixtures from checked context; revoked clears all grants/drafts/confirmed choices while retaining the editable names and requires fresh consent. Unavailable states suppress comparisons without asserting free time. Fixed June timestamps are synthetic, not current freshness evidence.

### Validation and testable helpers

Run `node --test` (or `node --test test/app.test.js` for app-only coverage) and `git diff --check`. Tests are offline and deterministic, using Node built-ins only. The UI increment starts from **118 passing tests** and adds owner update/projection, local HTTP security/lifecycle and pure UI regressions; the executed totals are recorded in [the owner validation record](docs/owner-calendar-list.md#local-owner-ui-increment). Earlier increment counts below are historical. The separate picker bundles require the pinned npm dependencies, but unit tests and the fictional demo do not.

[app.js](app.js) keeps browser/CommonJS compatibility. The browser uses a session-only subject array; each subject owns an independent instance of the existing pure provider consent engine, with one chosen provider at a time. Names are display strings, never DOM IDs or state keys. Generated IDs, source revisions, consent revisions, and reset generations fence stale reviews across deletion/re-add, provider switching, and reset. No alternate UI path bypasses consent.

- Subject helpers: `resetSubjects`, `validateSubjectName`, `subjectTransition`, `subjectStatus`, `subjectAuthorizedChoices`, `subjectDisclosedEvents`, `subjectScheduleContext`, `subjectListHtml`, `subjectSettingsHtml`, `focusAfterSubjectDelete`. Presentation helpers: `subjectPalette`, `subjectColor`, `subjectInitials`.
- Invitation helpers: `resetInvitation`, `validateInvitationEmail`, `invitationTransition`, `invitationReviewHtml`. Invitation state is separate from subjects' consent; no network adapter or live-success state exists. Eight invitation regressions cover syntax/length and fictional-only input, immutable fail-closed transitions, rejection/redaction, output escaping, isolation from calendar consent, keyboard-entry handler/focus seams, lifecycle cleanup, and offline markup constraints. Current executed suite: **64 passing tests (52 app + 12 infrastructure)**. Infrastructure tests remain a separate offline contract, not proof of delivery or deployment.
- Reused consent helpers: `resetState`, `transition`, `validateChoices`, `canConfirmImport`, `authorizedChoices`, `disclosedEvents`, `consentHtml`, `providerCardsHtml` (rendered only within Settings). `scheduleContext` accepts either state shape; `renderWeekendHtml` renders subject-labelled, redacted context. Filtering, safe URL handling, and HTML escaping remain available.
- The preceding 44 app tests are retained (with changed +/alias copy and focus assertions). Coverage includes consent/security/filter/DOM regressions, name validation/XSS, add/delete/empty, same-provider independence, stale summaries, source/reset fencing, scoped revocation, scenario preservation, Settings-only details, and focus seams. Seven UI-polish regressions cover palette uniqueness/cycling/stability, class-injection resistance, escaped initials/icon names/tooltips, 44px/nonwrapping CSS rules and palette contrast, consent/demo copy, result uncertainty, and matched accents across surfaces. CSS tests verify at least 4.5:1 contrast for white initials on each accent and status text on each tint; they do not establish browser usability approval.

### Browser validation handoff

Use the already-running static page; no server or dependency change is needed. Inspect desktop/mobile layouts, keyboard access, native dialog focus trapping, Escape/Close, and screen-reader labels/status announcements.

- List: `#subject-list`; initial subject IDs `subject-0-1` (Alex) and `subject-0-2` (Sam). **⋯** buttons: `#settings-subject-0-1`, `#settings-subject-0-2`, or `[data-subject-id="…"][data-action="settings"]`. Accessible names/tooltips: **Calendar settings for Alex**, **Calendar settings for Sam**, dynamically using the alias. **−** buttons: `[data-subject-id="subject-0-1"][data-action="delete"]` and equivalent IDs, with **Remove Alex** / **Remove Sam**. Visible symbols are hidden from screen readers; meaningful labels remain on native buttons.
- Invite: `#add-calendar` (**+**, accessible name/tooltip **Invite an adult**), `#invitation-dialog`, `#invitation-email`, `#invitation-form`, `#invitation-error`, `#invitation-review`, `#close-invitation`. Enter reviews a fictional `.test` email; the unavailable Send button is disabled. `[data-invitation-action="back"]` clears the review. Cancel/Escape restores **+** focus.
- Demo alias: expand `.demo-controls > summary`, then use `#add-subject`, `#subject-name`, **Add demo alias**, `#name-error`. Enter submits; success and validation errors focus the alias field. First added ID is `subject-0-3`; reset advances the generation rather than recycling IDs.
- Dialog: `#consent-dialog`, `#consent-title`, `#consent-content`, `#consent-error`, `#close-settings` (**Close**). Provider: `#subject-provider`, values `outlook` / `google`.
- Consent buttons inside the dialog use `data-action`: `begin`, `manage`, `grant`, `deny`, `review`, `confirm`, `back`, `cancel`, `pause`, `disconnect`. Fields: `#choose-calendar`, `#represented-person`, `#calendar-disclosure`, `#guardian-authority` (Google fixture only). Confirmation carries `data-summary-id`.
- Demo controls: `.demo-controls > summary`, `#scenario`, `#reset`, `#footer-reset`. Result surfaces: `#weekend-result`, `#activity-results`, `#event-result`. Verify event assessments clear on access changes and deletion.
- Reload the existing shared page for this revision. At desktop and 320–390px mobile widths, check invitation entry/review, unavailable Send, Change recipient, Escape/Cancel and focus return, plus 60-character/unbroken aliases, always-inline **⋯ / −** actions, **+**, 44px targets, keyboard focus outlines, Settings and textual statuses. Add several fictional aliases through Demo state controls, remove one, and confirm surviving colors stay unchanged. No preview server was started or changed for this increment.

Browser checks for this polish passed at 1280px desktop and 320px mobile widths: keyboard add/settings/remove, distinct colors and stability after deletion, Escape and focus return, long unbroken alias wrapping, inline actions, picker/summary overflow, simulated confirmation, and dialog focus containment. Buttons specified at 44px measured approximately 43.994px in the embedded browser; geometry assertions allow 0.02px rounding tolerance. A desktop screenshot was also inspected. Screen-reader announcements and parent usability approval were not tested or established; automated/browser checks do not replace those reviews.

Invitation-entry browser checks on 15 September 2026 reused the existing port-8000 preview, without starting/changing a server. At 1280px and 320px: + keyboard activation, email focus, Enter-to-review, disabled Send, textual unavailable status, dialog horizontal fit, focus containment, Escape cleanup and focus return passed. At 320px, real-domain rejection/input clearing, Change recipient, Cancel, demo alias creation/Settings/removal, discovery and whole-page horizontal fit also passed. Native file preview was denied by the editor's trusted-folder check, so the existing HTTP preview was used instead. Screen-reader announcements, parent usability and live services remain unvalidated.

### Parent review checklist

- Can you find a plausible sample outing and understand its suitability?
- Can you inspect its local mock provenance and recognize travel/tickets as unverified?
- Can you identify the exact checked/missing calendar context and uncertainty?
- Is it clear that this is sample-only and cannot book, buy, monitor, notify, or verify live information?

This prototype does **not** approve production integrations, establish parent usability validation, or establish child-account/provider feasibility. Those planning gates remain open.

## Planning

- [Parent-facing schedule and activity discovery](docs/parent-schedule-activity-discovery.md)
- [Activity search from an available slot: age, interests, free text, and sourced matching](docs/activity-search-component.md) (planning draft; no live search authorized)
- [PKCE sequence diagram: app, auth server, and calendar server](docs/pkce-sequence.md)
