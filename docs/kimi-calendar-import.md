# Kimi shared Outlook calendar import

## Diagnostics backend activated, 18 September 2026

The user separately approved the shared 8002 safe restart after reviewing the
offline diagnostic result. Reviewed `activate-windows-owner.js
--approved-local-restart-with-child` performed locked native parent/child metadata
preflight, exact process/mode/idle guards and the existing Windows-auth task
handoff. Final reported PID **54854** is a historical observation: re-identify
before any later operation. Activation and independent local inspection both
confirmed live/disk safe idle, `cleanup: not_requested`, all date/October/saved/
child Sync markers, and no remaining 18002 lock listener. The activation handshake
also verified native execution, `tpbl-teams-v2` and static Activities assets.

Initial activation returned `activation_unconfirmed`; independent inspection
found both ports absent, then the reviewed helper explicitly returned
`ECONNREFUSED`. The same approved restart was continued through the helper's
already-stopped branch with fresh locked metadata checks, no additional stop or
force kill. The original stop-confirmation failure remains undiagnosed.

The activation/status test files `test/activate-windows-owner.test.js`,
`test/activity-activation.test.js` and `test/owner-local-status.test.js` passed
**18/18**. The first test invocation used a nonexistent filename, ran no tests,
and was corrected before activation. No activation code or task settings changed.
Concurrent `activity-preview/poc-storyboard/` work was left untouched.

**Zero calendar queries, private snapshot reads/deletions, cloud mutations or
enrollment repeats.** Native checks read only metadata; no loaded browser tab
was inspected or reloaded. Existing saved records were not migrated or cleared.
This completes the restart authorization and supersedes activation-pending text
below. Reload Our week to get a fresh page session and the Details presentation.
An actual user-run Sync can now expose safe failure evidence, but real Sync
success/root cause is still unverified. Agent-run Sync needs separate approval;
this restart does not authorize it. No commit or push.

## Sync failure diagnostics verified offline, activation pending, 18 September 2026

The reported second-Sync failure is **not yet attributed or fixed**. Existing
cached-first versus fresh-refresh behavior is unchanged. Real worker/backend/
find/import code succeeds through synthetic enrollment and two subsequent Syncs;
missing sources, callback errors and invalid projections can reproduce the same
previously generic message. No additional real source listing/import was run.

Approved offline diagnostics now carry only `{ stage, code, elapsedMs }` on Sync
errors. Stages/codes are fixed allowlists (plus numeric HTTP 400–599 codes), elapsed
is an integer clamped to 0–600000 ms. Worker failures distinguish source matching,
source-list requests, event requests/validation and authentication. Completed
cleanup cannot overwrite the original observed failure; uncertain cleanup still
dominates and remains sticky. Timing covers the reporting layer through cleanup,
not solely the Outlook request. A callback HTTP code describes that endpoint,
not an inferred underlying Graph error. Generic errors stay generic where no
more precise evidence exists. No exception text, response bodies, URLs, credentials,
source IDs/references, names or events are diagnostic fields.

The native protocol validates the optional error-only projection, the adapter and
HTTP boundary validate again, and the browser shows it using textContent in the
existing closed **Details** section. The primary message, cancellation/revocation,
no-fallback policy, storage and parent continuation remain unchanged. Diagnostics
are not saved, logged, added to success/snapshot payloads, shared through the week
bridge, or sent to Activities. Old backend/transport failures are explicitly
labelled browser observations, not guessed native stages.

**Rolling compatibility:** only the new native controller sets the internal Sync
`diagnostics: true` flag. The new worker accepts legacy input and omits diagnostics
for old controllers, which may stage new code before a service restart. Browser
inputs cannot opt into native flags. Existing success shapes and protocol name
remain unchanged. Full native diagnostics require an approved backend restart;
a static reload alone cannot activate the new running controller/server modules.

Verification: baseline seven-file suite **264/264**; final thirteen-file suite
**462/462 each** under UTC, Asia/Taipei and America/Los_Angeles. Executed with
`node --test` against:

- `test/child-sync-diagnostics.test.js`, `test/child-sync-ui.test.js`, `test/child-sync-server.test.js`
- `test/windows-child.test.js`, `test/windows-child-sync.test.js`, `test/windows-child-server.test.js`
- `test/child-calendar-adapter.test.js`, `test/availability-ui.test.js`, `test/child-calendar.test.js`
- `test/child-calendar-cache.test.js`, `test/child-source-store.test.js`, `test/our-week.test.js`, `test/week-display.test.js`

New actual-chain fixtures replace only credential/HTTP I/O, exercise both
disclosures, malformed/leaking IPC rejection, no retries, independent cleanup,
sticky recovery, elapsed bounds, legacy negotiation and late-response fencing.
Editor diagnostics and whitespace checks passed. Full suite was not rerun because
of the previously observed unrelated full-suite hangs.

Isolated RAM-only synthetic browser review on explicitly assigned **8037**, PID
**53788**, from the current worktree: zero startup API calls, real keyboard date
selection/Sync/Details, injected `event_request / http_500 / 4200 ms` shown in
Details, no overflow at observed desktop 1778px or mobile 375px. Only synthetic
child Sync/edit and parent availability endpoints were requested. Pointer click
stability timed out, so physical pointer behavior was not newly verified. The
owned process was stopped; page-close returned page-not-found, so tab closure is
not independently confirmed. No real browser tab, shared 8002 service, private
snapshot, cloud API, public source, permission or deployment was touched.

Changes: child core/UI, native protocol/worker/controller, the child-error branch
of the shared owner server, focused tests and this checkpoint. No markup, CSS,
Activities route, provider contract, native bundle manifest, cache schema or task
configuration changed. Next gate is separately coordinated/approved safe restart;
then one deliberate failure can supply safe diagnostic evidence. Agent-run live
Sync/list/import requires separate approval. Do not repeat enrollment or clear
saved data merely to obtain diagnostics. No commit or push.

## Kimi enrollment completed, 18 September 2026

With later explicit agent listing/event-read approval, the one-shot enrollment
helper found a unique exact Kimi label, used the current session's reviewed handle,
and successfully imported the fixed October week. Six projected events, partial
false; source reference and permitted snapshot committed by the existing backend.
Independent native cleanup verification and local idle passed. No event details
or identifiers reached tool output, no parent refresh or private-file inspection.
This supersedes the missing-source/setup gate below; no recurring setup UI added.
Later fresh Sync is implemented but was not separately live-tested after enrollment.
[Evidence and limits](our-week.md#kimi-source-enrolled-and-events-read-18-september-2026).

## Sync backend activated, 18 September 2026

Explicitly approved shared restart completed; independent metadata-only local
inspection confirmed live/disk safe idle and childSyncProtocol true, with the
operation lock released. Native parent/child preflight and Activities static
compatibility passed. No calendar read or private cache inspection occurred.
This supersedes the activation-pending checkpoint below, not the missing legacy
source reference: no source was enrolled and actual fresh Kimi Sync remains
unverified. Do not ask the user to repeat prior consent/source instructions.
[Activation evidence](our-week.md#explicit-activation-approval-18-september-2026).

## Remembered-source Sync: code ready, not activated, 18 September 2026

Common Sync is now wired to the new capability-gated child Sync endpoint. Native
enrollment derives an exact caller/source fingerprint; separate private storage
keeps only that reference and reviewed access/window. Later deliberate Sync can
reuse it across sessions/restarts without repeating the source wizard, then
refresh parents serially. No provider source name is treated as identity.

Combined offline regression and isolated synthetic browser checks passed.
Existing child snapshots contain no reference and are not migrated or inspected.
One user-only explicit enrollment is still needed; the main UI has no setup entry,
and its one-time onboarding surface remains outstanding. Shared 8002 has not been
restarted for this change. Activation and actual user/provider usability remain
unverified, not completed by tests. No new cloud resources or provider permissions
are needed by this implementation. [Current scope and evidence](our-week.md#remembered-source-sync-implemented-offline-18-september-2026).

## Current UI: no Kimi-specific operations, 17 September 2026

The user's later explicit removal request is implemented in static presentation:
no child setup/select/guardian/disclosure/review/import controls or Calendar access
dialog remain. Shared Confirm/saved-only reads an existing child snapshot without
an extra prompt; a miss remains unknown. Update refreshes parents only and retains
unaffected child saved results and their original timestamp. Clear still deletes
both snapshots. This is not persistent live-source selection; no new child import
is available from this UI. All backend/native consent and token protections remain
unchanged. Previous user instructions below to open the removed controls are
historical. No live/private-data operation or service restart was performed.
[Exact scope, tests and browser evidence](our-week.md#kimi-specific-ui-operations-removed-17-september-2026).

## Private saved view activated, 17 September 2026

After explicit approval of the shared 8002 restart window, the native activation
helper performed locked parent/child metadata preflight and the existing
Windows-auth task started the updated backend. Final process **43554** (historical
observation, re-identify before later operations) reported live/disk, idle,
not_requested, parent/child native execution, all date/October/parent-saved/child
markers, and **childSavedProtocol: true**. Activity assets matched disk and
`tpbl-teams-v2`. Independent local inspection confirmed safe idle/new cache marker
and no remaining 18002 lock listener. No calendar queries, cloud mutations or
private cache reads/deletions occurred. Existing saved files were not migrated.

The first attempt returned generic activation_unconfirmed. Independent socket
and reviewed HTTP checks established no 8002/18002 listener and ECONNREFUSED;
the helper then resumed its already-stopped branch, with fresh metadata preflight,
existing-task start and bounded `verify` handshake. No additional stop or force
kill was used; the original unconfirmed-stop cause remains undiagnosed.

Activation guards now recognize child storage failures, reject them as safe idle,
and require the exact disk-cache marker after restart while accepting the old
markerless backend before upgrade. Three focused test files passed **17/17**;
new regressions first reproduced three failures. No task/UI/provider changes in
this activation step. Prior **325-per-timezone** synthetic integration remains
separate from actual user import and provider feasibility.

**User next:** reload http://127.0.0.1:8002/, use common Confirm and explicitly
review/import Kimi once to create the new saved view. Later reloads can use View
saved only without repeating import. Previously loaded session-only results are
not migrated or inspected. No automatic request occurs on reload; no agent live
listing/import is authorized. This restart approval is now completed. No commit
or push. This section supersedes pending activation statements below.

## Approved private saved view, activation pending, 17 September 2026

The user approved permitted child names/times and minimal reviewed access settings
saved privately on this device **until Clear**, separate from parent availability.
This later narrow approval supersedes historical nonpersistence below, not source
selection, guardian/disclosure review, cloud redaction or agent-access restrictions.
Saved viewing cannot detect offline Outlook revocation or authorize live import.
No provider source IDs, handles, review tokens or credentials are persisted.

Implemented and synthetic-verified: common Confirm/Update/View saved only/Clear,
neutral Calendar access modal, explicit saved-only child endpoint, separate strict
private disk storage, original freshness and fenced deletion/cancellation. The
parent snapshot schema/path and native authentication remain unchanged. Independent
review found and fixed failed-write temporary-file cleanup; deletion stays blocked
until owned artifacts are removed. Final combined tests: **325/325 per timezone**
(UTC/Taipei/Los Angeles). Sample browser reload restored names without new import;
Clear removed both; keyboard and measured 375px mobile checks passed.
[Complete contract, exact checks and limits](our-week.md#unified-saved-calendars-verified-offline-17-september-2026).

**Not activated:** no 8002 restart, real calendar query, private-file inspection,
Azure operation, commit or push this milestone. A coordinated approved restart is
next; the user then makes a new deliberate reviewed import to create the first
child saved view. Existing session-only data is not migrated. Historical completed
activation/deployment approvals below are not reusable.

## Shared confirmation UI checkpoint, 17 September 2026

The later approved bounded UI repair integrates optional Kimi setup into the
shared **Confirm / Update**, replacing persistent **Kimi source & access** and
the separate import action. Initial opening requests nothing. The user explicitly
continues to source listing, selects the source/person/disclosure and guardian
authority, then confirms the visible summary. Parent processing finishes before
child import, avoiding concurrent native-lock requests from this flow.

Configured updates reuse only the current session's explicitly selected handle,
not an old review token. The unchanged local review endpoint supports fresh token
minting; each Update shows that new summary and requires the final shared Confirm
before importing. Handles/tokens remain private to the child controller. The
page-only callback seam passes fixed decisions and boolean safety/progress only;
the public week bridge remains title/source/token-free. No backend API, native,
auth/provider, guardian/session policy, persistent store or static route changed.
Parents remain two-person, full **9–15 October** busy-only snapshots; child data
remains nonpersistent. Saved-only never performs child work, and Clear/expiry/
scope changes fence queued operations under the existing cleanup rules.

**Offline implementation complete; combined acceptance pending.** Baseline
**138/138** passed; final shared/paging/session suite **34/34 per timezone** in
UTC, Los Angeles and Taipei, including **16** new shared-flow regressions.
The earlier broader runner was green, but concurrent parent copy/markup edits
appeared during final validation and were preserved. The final combined UI check
is **110 passed / 17 failed**, with existing availability/presentation assertions
requiring main-writer reconciliation. No final all-green or browser usability
claim is made. See [exact commands, boundaries, selectors and handoff](our-week.md#shared-confirm--update-bounded-ui-implementation-17-september-2026).

Only static UI reload is needed for this repair; no backend activation is part of
it and current service state was not rechecked. No service/browser process was
started by this implementer, nor any live/auth/cloud/calendar/public request,
private-data inspection, restart/deployment/commit/push performed. Prior one-shot
approvals remain consumed. Main owns isolated synthetic desktop/mobile/keyboard
review; real source listing/import still requires the user's separate action.

## User-requested relaunch, 17 September 2026

The subsequent explicit **Relaunch service** request completed through the existing
Windows-auth task. The first attempt was unconfirmed; an independent socket check
and fresh `ECONNREFUSED` confirmed the service had stopped before the reviewed
already-stopped handoff resumed. Final process **77833** (re-identify before any
future operation) verified live/disk safe idle, parent/child native execution,
all date/saved/October/child markers and matching `tpbl-teams-v2` activity assets.
Locked parent/child metadata checks passed; calendar queries, cloud changes and
private-cache access were zero. Focused activation regressions: **16/16 passed**.
No application/UI/task edits, live calendar test or deployment repeated. This
relaunch approval is complete; source visibility still awaits user testing.

## Shared local service activated, 17 September 2026

After the Builder freeze handoff, the user explicitly confirmed that Auth could
take the shared activation window, adjust the existing task and safely restart
8002. The five frozen UI files were not edited. No UI/event/session/cleanup
contract changed. The existing Windows-auth task now supplies the exact child
opt-in; the native activator's explicit child option adds locked child metadata
preflight, exact process-mode checks and matching page/running-backend markers.

Six added offline regressions cover exact readiness, no child work without opt-in,
lock contention, idle/sticky failure/identity guards, task handoff, static activity
compatibility and mismatched child markers. Focused **10/10**, full **786/786**
passed, zero failures. Editor diagnostics and whitespace checks passed.

The initial activation returned `activation_unconfirmed` without enough stage
evidence to identify its cause. Independent socket inspection then found no
8002/18002 listener and the reviewed local inspector returned `ECONNREFUSED`.
The existing activator resumed from its already-stopped branch, repeated only
metadata preflight under the lock, handed off to the existing task, and received
`verify` within the bounded handoff. No force kill or deployment retry occurred.

Successful activation reported process **75754** (historical observation, always
re-identify before operations), live/disk **idle / not_requested**, safe idle,
date/saved/October/child protocol checks all true, parent `windows-native-v1`,
child `windows-child-v1`, parent and child metadata verified, current
`tpbl-teams-v2` and static activity assets matching disk. Activation made **zero
calendar queries**, no cloud changes and no private-cache access. Startup did not
invoke authentication or calendars; preflight was the separate operator action.

**Ready for the user's real test at http://127.0.0.1:8002/.** Reload to replace
the old page/session, open **Kimi source & access**, explicitly Find and select a
returned source, confirm Kimi/guardian/disclosure and the visible review, then
import. Dates remain 9–15 October Taipei. Results stay page/session-only in
**Our week** alongside the parents; the week bridge omits all titles. No agent
source listing/import was performed: `runtimeVerified: false` remains honest
until user testing establishes shared-source visibility and provider behavior.
No new browser/desktop/mobile/physical-keyboard approval is claimed.

This section supersedes deployment/activation-pending statements below. The
one-workflow deployment approval is consumed; parent refresh approval is also
consumed. Neither may be repeated to recover output. No commit or push.

## Native backend verified and workflow deployed; local activation pending

**17 September 2026, after the Builder handoff:** the native child backend wiring
is present in `serve-owner`, with one inert adapter per server, server-only
session binding and sealed source values. The browser request/response schemas,
one-use review flow, date/expiry/cancellation behavior, child display bridge and
parent snapshot contract remain unchanged. This follow-up modified tests and this
checkpoint only; it did not edit Builder's `child-calendar-ui.js`,
`availability-core.js`, `availability-ui.js`, `index.html` or `owner.css`, nor
change session/cleanup behavior after the handoff.

Five added offline tests join the actual native worker, backend and check/status/
deploy/recovery functions with synthetic authentication/HTTPS I/O. A historical
parent-native test still rejected all child opt-in; it now rejects malformed
approval, while the native-child server suite covers valid explicit opt-in.
Combined regression: **318/318 passed**. Full `node --test`: **780/780 passed**,
zero failures, cancellations, skips or timeouts. Checked backend/test editor
diagnostics and whitespace checks passed. No new browser usability pass is claimed.

Actual native operations, all with **zero calendar queries**:

1. `--metadata-only`: `candidate_ready`, `cloudChanges: false`, native extension
  cleanup confirmed. Exact authentication, preserved resources and exported
  HttpRequest capability passed; the child workflow was absent.
2. **The previously approved one-workflow deployment was executed once**:
  `--approved-deploy-once` returned `deployed_disabled`, `sasDisabled: true`,
  `cloudChanges: true`, `extensionsRemoved: true`, `automaticRetry: false`.
  The fixed helper uses one standard PUT after repeated absence/preservation
  checks, not atomic Azure compare-and-swap. **That approval is now consumed.**
3. Independent `--status` returned `child_ready`, SAS Disabled, protected resources
  unchanged, extensions removed, `httpGetCalendarCandidate: true` and
  `nativeViewCandidate: false`. The native V3 candidate was not established by
  current metadata; the deployed workflow uses the verified HttpRequest path.

All reports retain `runtimeVerified: false`: no real source list or event import
was requested, and shared visibility/redaction at provider runtime is not yet
demonstrated. No child source IDs, event data, credentials, callback URLs, private
parent snapshot or school files were inspected. Parent refresh was not repeated.

**Not activated on 8002 yet.** No shared task/configuration edit or service restart
occurred. The remaining local activation requires coordination with Builder and
Activities, the reviewed locked native activation path, exact safe-idle process
checks and child readiness/mode verification. The explicit CLI opt-in is
`FAMILYCOPILOT_CHILD_ENABLED=kimi-calendar-v1` together with
`FAMILYCOPILOT_OWNER_EXECUTION=windows-native`; this is an implementation detail,
not an instruction to bypass activation. Startup must perform no auth/calendar
request. Existing source/person/guardian/disclosure review and confirmation stay
in Builder's compact controls. No UI/event/session/cleanup change is requested.

This checkpoint supersedes older **undeployed** statements below, not their
privacy boundaries or the remaining user-only Find/select/import gate. Do not
rerun the consumed deployment to recover output, and do not claim the UI is ready
for a real Kimi test until local activation is independently verified.

## Shared Our week presentation: offline handoff, 17 September 2026

The approved presentation milestone now integrates Kimi's minimized event times
and reported statuses into the same calendar as Mike and Debby. Explicit Find,
source/person/guardian/disclosure review and confirmation remain in a closed
**Kimi source & access** control. The standalone Kimi list and main School mount
are removed, without changing child core/provider/native protocols, parent
two-person API/snapshot contracts or original private school files. All titles,
including permitted normal titles, are omitted from the week display bridge;
source and access summaries remain in settings. The bridge conveys no consent.

The offline runner passed 281 focused tests plus two non-server October tests in
each of three timezones. Five HTTP tests were intentionally skipped per timezone;
no full-suite or browser usability pass is claimed. No activation, deployment,
provider request or service operation occurred. [Exact scope and handoff](our-week.md)
supersede older descriptions below of a standalone child list or mounted School
fallback, not the existing provider/authorization gates or historical evidence.

## Parent authentication restored; child activation still pending

**17 September 2026:** the separately requested Mike/Debby repair now uses the
supported Windows-native worker rather than the historical UNC PowerShell
script launcher. Actual parent refresh through 8002 succeeded, non-cached,
336 slots per person, followed by independent Disabled/SAS-disabled and
preservation checks. No policy change, new OAuth or credential transfer was
needed. [Parent repair evidence](owner-availability.md#windows-native-parent-update-repair-17-september-2026).

This removes the demonstrated parent authentication blocker, not Kimi's remaining
integration work. The native parent protocol only permits fixed-window busy-only
results; it does not carry child source identifiers, review tokens or titles.
Next: adapt the approved child operations to the same native execution boundary,
verify actual connector capability, review the existing one-workflow deployment
and independent readback, then enable the consent-gated child UI. Do not send
raw provider IDs or broader payloads through the parent protocol. Actual shared
visibility is established only by the user's explicit Find/select step, not by
Debby's successful default-calendar availability. Agent-run child listing/import
remains outside validation approval. No child workflow has been deployed and the
School fallback remains. The older blocked-launcher statements below are history,
not evidence that current Windows-native parent authentication is still blocked.

## Offline implementation checkpoint (17 September 2026)

This section supersedes the historical blocked-before-implementation checkpoint
below. Code now exists on disk: strict cloud response validation, random
per-session source handles, one-use server-held review tokens, a consent-gated
child UI and routes, a protected fixed-window workflow factory and guarded
candidate deployment/import functions. **Not deployed or activated.** Live child
routes default to `child_not_ready`; the School importer remains visibly available
on unactivated live pages. Synthetic mode exercises the replacement without Azure.
No existing 8002/8019 service has been stopped, no private school/cache file read,
no cloud write, no real source listing/events, and no commit/push.

Current task list:
1. Completed: full README/privacy plan/current code inspection and actual baseline
  `node --test`: **503 passed, 0 failed/cancelled/skipped/todo**.
2. Executed final combined `node --test`: **595 passed, 0 failed**, exit 0;
  `git diff --check` passed. These include concurrent repository tests, not 595
  new child tests. Checked child/core/server/native files had no editor errors.
  Synthetic browser review verified explicit source selection, guardian/person/
  disclosure review, import, three fixture events with two Busy titles, literal
  HTML-like text, status focus and immediate result removal on privacy reduction.
  Pointer/keyboard actionability checks timed out; DOM-dispatched clicks were
  used for the functional check, not evidence of keyboard usability. The actual
  viewport was 321 CSS px despite a requested desktop size; desktop/mobile visual
  approval remains unverified. Disposable reviewers received graceful SIGTERM;
  original live/activities services were not stopped.
3. Gated: native-auth metadata preflight and exact exported operation evidence.
  Windows identity lookup succeeded with exit 0 as reported by the user. WSL's
  default Azure directory links to Windows, but its current configuration override
  selects a separate directory. The separate-session failure was AADSTS530084
  (Token Protection); a one-shot original-directory check instead failed with a
  filesystem permission error. No permanent configuration/permission change.
  Standalone `node.exe` was not found on PATH or the standard Program Files path.
  Installed VS Code's native Electron Node returned v24.18.1 when PowerShell
  waited for its output. However, the new UNC PowerShell launcher was rejected
  with `UnauthorizedAccess`: script execution is disabled. The app's metadata
  preflight therefore remains blocked before Azure access. No execution-policy
  change, encoded-script workaround or credential transfer was performed. An
  organization-approved native execution route is required before further live
  work; successful Windows CLI identity alone does not activate this application.
4. Gated: reviewed absent-only deployment, native/WSL cooperative-lock evidence,
  independent cloud readback and later operator-controlled activation. This
  delegation explicitly forbids cloud writes and stopping existing services.
5. User-only: Find calendars, choose one actual returned source, guardian/person/
  disclosure review and explicit import. Parent usability remains separate.

Candidate deployment uses the documented PUT with adjacent absence checks, not
an invented atomic Azure compare-and-swap guarantee. There is intentionally no
executable live/deploy CLI yet; existing approval remains unused for main-agent
review. Runtime `$select`, connector URI behavior and actual sharing support are
not established by offline tests. A one-line `execFile('az.cmd')` is not a verified
Windows solution: `.cmd` dispatch and cross-OS lock coordination require care.

## Checkpoint: blocked before implementation/deployment (17 September 2026)

**Not delivered yet.** The existing School calendar UI remains intact rather than
being replaced with a nonfunctional import. No child route, import workflow,
calendar selection, real listing or event request has been implemented/executed.
All private school source files and existing concurrent work are preserved.

The user has explicitly approved the architecture below. Further architecture
approval is **not** the blocker. Exact-caller verification is currently blocked:

- Direct local process verification confirms PID **87538**, the expected workspace
  and existing owner-server command on actual **8002**.
- A fresh local metadata-only status check reports **idle / not_requested**,
  **live / disk**, `safeIdle: true`, and all date/saved/October protocol markers.
  It does not read or check existence of the private availability snapshot.
- Azure CLI account lookup succeeds and matches the approved tenant/subscription
  state. Its `ad signed-in-user show --query id` call fails through the existing
  bounded helper with safe code **unavailable**. The helper suppresses raw CLI
  errors; the underlying cause (authentication, directory authorization, network
  or CLI failure) is **not established**. Do not invent a policy diagnosis.
- Consequently, exact authorized caller and current exported connector Swagger
  cannot be verified. The initial metadata attempt returned a generic blocked
  status without a failing stage; it established no successful metadata evidence.
  The subsequent stage-isolating diagnostic stopped at the signed-in-user lookup
  and performed no ARM reads. Neither operation could enable a workflow,
  create/update a resource, retrieve a callback, or query calendars/events.
  Current cloud-state preservation is not independently re-established; earlier
  deployment evidence is historical.
- No restart, commit or push. Existing public basketball and owner browser pages
  are untouched. No synthetic server/tab was opened or left as handoff.

Operator unblock: restore the existing Azure CLI session/directory lookup so the
signed-in-user command succeeds, without sharing credentials or its returned ID
with the assistant. Do not create an app/connector, change calendar sharing, or
request edit permissions. A working token alone does not replace the exact-caller
check. Then run the read-only [preflight](../scripts/child-calendar-preflight.js)
and continue the approved milestone; this checkpoint does not authorize any agent
calendar list or event validation request.

## Approved scope, not yet implemented

- Replace the main School calendar section/scripts with **Kimi's calendar**, the
  child of Mike and Debby. Retain the school converter, files and offline tests as
  legacy utilities; do not read/delete private local school inputs or exports.
- Reuse the existing authorized `familycopilot-office365-dev` connection and
  frozen `familycopilot-calendar-list-dev` v2. No new login, OAuth app, PKCE,
  connector, database or cloud provider.
- Create **one absent-only** `familycopilot-child-calendar-dev` workflow in
  subscription `609bbde3-d152-4d7d-a12b-005e38ac4f27`, resource group
  `vdi-prebuilt-dte`, eastus. Existing cooperative operation lock, immediate exact
  before/after checks, exact ARM caller, SAS disabled, Disabled between requests.
  Preserve availability v5 Disabled, list v2, invitations Disabled/delivery off,
  connection and unrelated resources. Unknown state stops; no overwrite or retry.
- Hard bound: **9–15 October 2026 Asia/Taipei**, UTC
  **2026-10-08T16:00:00Z → 2026-10-15T16:00:00Z exclusive**.
- Startup does nothing. Only the user's **Find calendars** may list. Only the
  user's explicit selection of one returned source, guardian acknowledgement,
  disclosure choice and confirmation of a visible access summary may import.
  Summary names Kimi, chosen source label, exact dates, audience and retention.
  No automatic name matching, default-parent-calendar substitution or hidden
  dependency on the inaccessible old picker. Browser receives opaque random
  per-session handles, never provider calendar/event IDs.
- Guardian authorization and nonprivate titles/times are approved for the local
  parent UI only, not an assistant or another family member. Private, unknown,
  personal and confidential sensitivity are busy-only. Redact **in Azure** before
  local response. No descriptions, locations or attendees in the output.
- Prefer a demonstrably supported fixed HttpRequest calendarView with `$select`;
  native V3 is approved if necessary, with protected raw Azure processing and
  explicit minimization. Azure service-managed protected history is **not zero
  retention**. Local child data is session-only, never in the parent disk cache.
- Strict request/response fields, bounded bytes/time/count, fixed read-only
  endpoint, encoded validated selected ID, no arbitrary URLs or pagination
  following, no automatic retry. Mark truncation/pagination partial; never infer
  free time from missing data. Preserve provenance/freshness, recurring instances,
  all-day boundaries, cancellation/unknown status and overlaps without schedule
  or basketball comparison.
- Clear/remove, date edits, disclosure reduction, page exit, expiry and revocation
  cancel/fence late work and discard child state without deleting parent saved
  availability. Existing global cleanup blocks must not be bypassed.

## Verified official documentation versus remaining evidence

Independently read [Office 365 Outlook connector reference](https://learn.microsoft.com/en-us/connectors/office365/)
on 17 September 2026. This corrects earlier research that wrongly claimed the
connector cannot read bounded events or needs a new Graph app:

1. **Get calendar view of events (V3)**, operation `GetEventsCalendarViewV3`, uses
   Graph and includes recurrence instances. Required inputs: `calendarId`,
   `startDateTimeUtc`, `endDateTimeUtc`; maximum **256** entries, with Top/Skip
   controls. Its documented model includes sensitivity and zoned start/end.
2. **HttpRequest** supports `/me` and second segment `calendars`. That establishes
   a candidate, not proof of the exact current exported operation or `$select`
   behavior. The actual operation metadata must pass preflight before deployment.
3. Shared-calendar dropdown visibility has limitations; Microsoft recommends
   Get calendars (V2) to inspect available sources. Per-user calendar IDs differ.
   An Outlook screenshot is not evidence that the connector can retrieve Kimi's
   source. Debby was also selected in the screenshot: no event title/time may be
   attributed to Kimi, copied into a fixture or OCR-imported from it.
4. Missing source must offer actionable read-only sharing/acceptance guidance,
   not permission escalation or guesses. Do not modify the existing share.

The new preflight CLI is **metadata-only**, has no deploy/list/import mode, uses
the existing exact-read status backend, checks all preserved resources before and
after metadata, and emits only fixed statuses/boolean evidence. Native and HTTP
candidates are checked independently. It does not claim shared visibility,
runtime authorization, `$select` support, complete import readiness or deployment.
It records the failing stage without logging raw errors, IDs, tokens or links.
It has **not been run against Azure** in this checkpoint; only mocked tests run.

## Validation and remaining work

Baseline executed: **473/473** offline tests passed, zero failures/skips/todos.
Final executed: **10/10** focused preflight tests and **483/483** full offline tests
passed, zero failures/cancellations/skips/todos. The full result was independently
captured directly, not inferred from a previous run. Whitespace checks and editor
diagnostics passed. The CLI's offline `--help` command succeeded; its new live
metadata mode was not run. Browser checks are not applicable to this checkpoint
because no UI behavior changed. Parent usability review and actual shared-source
availability remain separate from automated tests.

This checkpoint edits only this document, the approval additions in README and
the product/privacy plan, and the new preflight helper/test. The tracked app,
markup, styles and app-test changes and untracked infrastructure/UI files were
already present in the initial working tree; they were not reverted or attributed
to this checkpoint. No baseline hash inventory was taken, so absence of unrelated
concurrent edits is not claimed.

Task list:

1. **Blocked/in progress:** restore exact-caller preflight, verify current exported
   paths/parameters and protected resource state without calendar requests.
2. Pending: implement guarded child workflow, server session handles/consent/
   cleanup, UI replacement, synthetic fixtures and focused regressions.
3. Pending: full offline tests, security/diff review and synthetic desktop/mobile
   keyboard/focus/label checks. No real calendar contents in browser tools.
4. Pending: exactly one guarded absent-only workflow deployment and independent
   readback. The one deployment approval remains **unused**.
5. Pending: safe-idle graceful restart under the existing lock, persistent 8002
   task, fresh empty live page/capability and zero-startup-API check. Leave public
   basketball untouched; no synthetic tab as handoff.
6. User-only step after delivery: Find calendars → select Kimi's returned source
   → guardian/disclosure review → confirm import. No agent-run real query.