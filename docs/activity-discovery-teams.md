# Category-first activity discovery and team preferences

## Fuzzy matching activated on owned8030, 17 September 2026

The parent explicitly approved the proposed8030-only restart. Fresh preflight
verified the single loopback listener, PID54822/start33162828, exact
`node activity-preview/serve-search.js --live --port=8030` command and workspace
`/home/davidtang/Projects/FamilyCopilot`. Branch remains `davidtang/dev`, one
worktree at `f72c087`. The current standalone entry point, route, TPBL adapter,
team matcher and pure date dependencies were inspected before startup. Unrelated
date/calendar work was preserved, not edited or represented as this milestone.

The bounded offline runner passed199/199 before restart. Identity was rechecked
immediately before sending one SIGTERM to that owned process. Its exit and an
unused8030 port were verified before starting the same standalone live command.
No unknown listener was stopped and no force kill or shared-service operation
was used.

**Active: http://127.0.0.1:8030/activities.** New owned process PID94572,
start ticks34831006, exact command/workspace verified. Terminal execution
`e2afb532-20f1-4271-b5cf-b49832ae0147` remains running for the parent. Mode is
live TPBL on explicit Find only, not synthetic. This supersedes the unactivated
runtime checkpoint below, not the source-query approval boundary.

Four bounded local GETs returned200: page, team helper, basketball controller
and health. Helper/controller bytes matched disk with `tpbl-fuzzy-v1`; the page
had independent-service and fuzzy-help copy, no offline-preview flag, and
same-origin-only connection CSP. Health still reports only the v2 team contract;
fuzzy backend activation is supported by the verified replacement process and
inspected startup dependencies, not by claiming health exposes a matching marker.
No search POST or real TPBL query was made. Physical browser/layout and live
listing verification remain unperformed.

Reload the activity page, manually add the preferred name, and choose Find when
ready. Reload is not a source query and clears page-local team preferences as
before. No8002/Auth/private calendar/cache/cloud access or operations, no shared
activation script, new storage, commit or push. Only this scoped handoff record
was edited for activation; implementation contracts are documented below.
Post-restart `node scripts/test-activity-discovery.js` also passed199/199,
exit0. Document diagnostics and direct untracked-file whitespace checks passed.

## Requested fuzzy team matching, 17 September 2026

The parent supplied card `tpbl-27539` (2026-10-10,17:00 Taipei) and explicitly
requested fuzzy matching rather than exact-only search. The card's source name
is 新北中信特攻 (New Taipei CTBC DEA); the entered shorthand was 中信特攻
(CTBC DEA). A direct offline check of the previous helper returned false for
the shorthand and true for the full name. The screenshot is user-provided
evidence, not a fresh source verification. This increment supersedes the
exact-only policy and abbreviation-recovery-only sections below.

Owned changes: [team helper](../shared/basketball-teams.js),
[TPBL projection/filter](../scripts/basketball.js),
[markup](../activity-preview/index.html),
[controller](../activity-preview/basketball-ui.js),
[helper/adapter tests](../test/basketball-teams.test.js),
[UI tests](../test/basketball-ui.test.js),
[offline response fixture](../test/fixtures/basketball-response.js), and this record.
No concurrent calendar/auth/shared-shell changes are included.

Matching resolves each entered name against the entire validated season roster,
including out-of-date/completed entries, before filtering or ranking games and
before40. Exact keys/names and the existing Dreamers aliases retain priority.
Otherwise use NFKC/case/spacing/basic-punctuation normalization, then a contained
abbreviation (minimum2 code points with Han, otherwise3), then at most one
insertion/deletion/substitution/adjacent transposition with both names at least4
code points. Only one candidate at the winning fuzzy tier is applied. Multiple
candidates remain ambiguous, never chosen by earliest game, result count or
source ordering. Numeric keys are never fuzzy matched or guessed. No new aliases,
translation service, dependency, source requests or storage are added.

Source names, IDs and game identities remain untouched; normalization is only
for comparison. The UI displays each fuzzy input-to-source mapping without
replacing entered preferences. Unresolved/ambiguous preferences stay visible
even when other preferences yield games. Returned-name Add controls prioritize
ambiguous candidates, remain bounded16 and generation/date-fenced, and require a
later Find; Add does not search or remove existing preferences. Empty/hidden
preferences, only/prefer policy, calendar independence, literal escaping and
coverage/freshness/unknown disclosures remain unchanged.

**Contract/activation handoff:** request shape and `teamContract: tpbl-teams-v2`
stay unchanged; responses now additionally require
`teamMatching: tpbl-fuzzy-v1` on success and unavailable responses. The new UI
requires the matching helper version and matching response marker, and independently
resolves the full returned roster to reject unrelated/ambiguous only-team games.
It never repairs a stale backend by filtering an incomplete client result list.
An older v2 backend or missing/unknown matching marker fails closed. The existing
v2 health/activation marker alone is insufficient to establish fuzzy readiness.
Shared activator changes and combined calendar/auth regression belong to the
integrator; no shared operational script was edited or invoked.

Validation: baseline `node scripts/test-activity-discovery.js`191/191.
Regression-first195 tests:189 pass/6 fail. Final runner199/199 in system-default
and `TZ=America/Los_Angeles`, both exit0 with zero skipped/cancelled. Tests replay
the supplied October10 card after45 unrelated rows with no guessed source team
ID, verify numeric-ID home/away fuzzy matches, prefer-before40, exact priority,
format/typo thresholds, ambiguous names including out-of-date candidates, old
markers, forged results, page-local storage and date/reset fencing. Browser and
CommonJS helpers agree; injected adapter reads preserve the exact two-path bound
and never send preferences to TPBL. Diagnostics and scoped whitespace passed.
No physical browser/mobile/keyboard or current live-listing validation was available.

**Implemented on disk, not activated.** Existing owned8030 process identity was
rechecked (PID54822, start33162828, exact live CLI and workspace); no process was
started/stopped/restarted. It still needs a requested owned-process restart to load
the changed backend, then an activity-page reload. The shared8002 runtime remains
integrator-owned and untouched. No live query, Auth/private calendar/cache/cloud
operation, worktree change, commit or push. Agent-run public validation still needs
fresh bounded approval; the screenshot is not query authorization.

## Explain unmatched names and offer returned-source recovery, 17 September 2026

The parent supplied a screenshot showing a completed TPBL retrieval with zero
preferred matches, not a transport failure. It does not show selected dates or
entered names, so no particular official name/date mismatch is asserted. The
previous manual CTBC test used identical preference/source strings and therefore
did not validate abbreviation handling against real source names. That limitation
is now exercised explicitly, not hidden by another identical-name fixture.

The [controller](../activity-preview/basketball-ui.js) distinguishes preferred
names absent from the validated returned roster from known roster teams with no
verified upcoming games in the selected dates. Abbreviations are still not
expanded automatically. For unknown names with a retrieved roster, Sources &
coverage now shows up to16 exact returned display names with explicit Add buttons
and selected-date counts. It explains that they are not suggested replacements;
existing preferences and only/prefer mode remain unchanged. Full-roster input
autocomplete remains available. These are on-demand source-derived recovery
controls, not hard-coded/preloaded demo teams. No extra query or guessed alias/ID.

Add uses the ordinary page-local preference path and requires a later deliberate
Find; it never inserts games or runs incomplete client filtering. Backend filtering
still occurs before40. Source names use literal DOM text. Recovery controls carry
the current generation and date check, so detached/reset/stale controls cannot
change preferences. Unavailable sources do not produce name-mismatch claims or
recovery names. Known-team date gaps retain coverage/partial/unknown limitations,
never proof that no games exist. Existing retrieval timestamp and source labels
remain visible. No API or backend contract change (`tpbl-teams-v2`).

[Three regression tests](../test/basketball-ui.test.js) cover a synthetic short/full
name mismatch with a match beyond45 unrelated rows, explicit Add then Find recovery,
preserved old preference and only mode, known-team date gaps, unavailable source,
literal hostile names, a16-button bound and reset fencing. Synthetic full-name
strings are test inputs, not newly verified official roster evidence.
Baseline `node scripts/test-activity-discovery.js`:188/188; regression-first:
188 pass/3 fail; final191/191 in default and `TZ=America/Los_Angeles`.
Diagnostics and scoped whitespace checks passed. No physical browser/keyboard
or layout check was available, and no real source query was made. This fixes
the missing recovery/explanation, not a claim that the parent's exact search has
been independently reproduced or that new live results are guaranteed.

Only the linked controller/test and this record changed. Fresh8030 verification
matched owned PID54822, start33162828, exact live CLI and workspace; one static
GET returned200 and current controller bytes including recovery copy. Reload to
use it; no backend restart required. This chat's existing8030 live-on-demand
service stays running. No8002/Auth/private calendars/cache/cloud, service lifecycle,
storage, worktree, commit or push operations. Shared-service integration remains
an integrator handoff; real agent-run source validation still needs fresh bounded
approval including dates/filter/query count.

## Manual CTBC demo entry, no preset UI, 17 September 2026

The parent changed the intended demo team to 中信特攻 (CTBC DEA), then clarified
they will type it during the demonstration and do not want it added beforehand.
The second instruction determines the UI: **no prefilled name, preset chip or
team shortcut**, not an automatically selected replacement favorite. The old
Dreamers shortcut, its click listener and unused style are removed. The generic
input/Add/Enter flow remains; source autocomplete starts empty and is populated
only after a deliberate search. No new team aliases or guessed source IDs added.

Changed [markup](../activity-preview/index.html),
[controller](../activity-preview/basketball-ui.js),
[styles](../activity-preview/basketball.css),
[controller tests](../test/basketball-ui.test.js), and this record only.
The offline demo regression types the parent's chosen name, presses Enter to add
it without querying, then Find sends its exact-name only-team preference and
excludes an unrelated fixture. Start over clears the entry/list. This is synthetic
verification of input/filtering, not verification of current official listings or
that a shortened name matches every source's published team name.
Existing Dreamers alias, home/away, hidden-preference and late-response tests now
use manual Add rather than a removed shortcut; their matching assertions remain.

Baseline `node scripts/test-activity-discovery.js`:187/187. Regression-first:
187 passed/1 failed. Final same runner:188/188 in system-default and with
`TZ=America/Los_Angeles`. No full suite or real source query. Editor diagnostics
and scoped whitespace checks passed. Physical browser/IME/keyboard/layout review
was unavailable; programmatic Enter coverage is not that evidence.

Fresh owned8030 identity matched PID54822, start33162828, exact workspace/live CLI.
Three static GETs returned200; controller/CSS matched disk, preset absent from
page/controller. Reload the activity page when ready; no process restart needed.
Live service mode/ownership and `tpbl-teams-v2` are unchanged. No8002/Auth/private
calendar/cache/cloud operations, other process changes, new storage, commit or
push. Broader integration remains with the integrator. The earlier screenshot's
actual preference state remains unknown; this UX change does not resolve that
unverified historical filtering report.

## Single-language names and screenshot27538 investigation, 17 September 2026

The parent requested one language per team name, including removing the Dreamers
English parenthesis. [The label helper](../shared/basketball-teams.js) now displays
the existing Chinese Dreamers alias only; both exact Chinese/English input/source
aliases still match the same preference. Other names remain as supplied, without
invented translations. [The shortcut markup](../activity-preview/index.html) is
Chinese-only. [The controller](../activity-preview/basketball-ui.js) deduplicates
autocomplete by display name and uses that same string for option text/value,
preventing browsers from displaying both languages in a single suggestion.
Cards, chips, selection status and accessible button names use the same helper.
No matching, API/version, storage or source identity change was made.

The supplied screenshot shows game `tpbl-27538`, dated2026-10-10 at14:30, with
neither side the Dreamers. It does not show category choices, preferred-team
chips, the only/prefer checkbox state, search status or URL. This card alone
cannot establish why the actual request included it. The earlier draft-entry
guard is not claimed as the explanation for this screenshot.

[A new controller regression](../test/basketball-ui.test.js) replays the supplied
card facts using the existing offline response fixture and real parsing/filtering
helpers, without guessing provider team IDs or making a source query:
- Basketball + checked Only preferred teams + empty preferred list: the request
  is unrestricted and the card appears. The checkbox does not itself add Dreamers.
- Add Dreamers + checked Only preferred teams: the request carries the Dreamers
  key and `only`; this card is excluded, no alternative game is fabricated.
Both checks pass. Existing tests also reject a backend that claims the requested
only-team contract while returning unrelated games. These are controlled offline
facts, not evidence of the parent's actual form state or proof the reported issue
is resolved. Requested the current preferred list, checkbox and result status
before reset/reload; further diagnosis remains blocked on that missing context.
Empty preferences remain unrestricted and hidden preferences remain ignored;
neither rule was silently changed to conceal the report.

Executed `node scripts/test-activity-discovery.js`: baseline183/183;
regression-first182 passed/2 failed for bilingual display; final184/184 in both
system-default and `TZ=America/Los_Angeles`. Also executed
`node --test --test-name-pattern='screenshot listing27538' test/basketball-ui.test.js`:
the targeted case passed. [Helper tests](../test/basketball-teams.test.js) retain
alias and exact-source checks. Editor diagnostics and scoped whitespace passed.
Fresh8030 ownership check matched PID54822/start33162828/cwd/live CLI; three static
GETs returned200, including current helper/controller bytes and the new shortcut.
Preserve the current user form for diagnosis first, then reload to apply these
static presentation changes. No process restart or backend activation required.

Only the three linked implementation files, two linked test files and this record
changed. No8002/Auth/private calendar/cache/cloud access, real TPBL validation,
service operation, new worktree, commit or push. Browser interaction tools remain
unavailable, so no fresh physical keyboard/layout validation is claimed. The
independent live-on-demand process remains owned as documented below, subject to
fresh identity verification. Shared-service operations remain integrator-owned.

## Preferred-team entry guard and label cleanup, 17 September 2026

The parent reported other teams appearing with Only preferred teams checked and
requested removal of the `English translation unverified` suffix. The exact
reported listing/browser state was not available, so its cause is not asserted.
Offline checks confirm committed preferences exclude unrelated games; a preferred
team's opponent remains part of the exact match identity and must still be shown.

One reproducible confusing path was fixed: with Basketball visible, entering a
name but choosing Find before Add silently ignored that draft and searched all
teams (or the previously added list). Find now makes no request or displays any
ideas in this state; it focuses the input and asks the parent to Add or clear it.
The draft is never auto-added. Duplicate Add clears its acknowledged draft so
search can proceed. Hidden drafts still do not restrict Anything/other sports;
an actually empty list/input remains unrestricted, regardless of the checkbox.
Reset, dates-only storage, strict backend contract and filtering-before40 remain
unchanged. No new provider, persistence or source-query permission is implied.

[Team labels](../shared/basketball-teams.js) now retain names without the unwanted
suffix in cards, autocomplete, chips and status text. The existing Dreamers
bilingual alias is retained; no translations, IDs or aliases were invented, and
literal text escaping/source matching remain unchanged. [The controller](../activity-preview/basketball-ui.js)
contains the draft guard. [Helper tests](../test/basketball-teams.test.js) and
[controller tests](../test/basketball-ui.test.js) cover the changes, including an
otherwise valid backend response that falsely includes an unrelated game despite
claiming the requested only-team selection: the UI rejects it, not client-filters it.

Validation: baseline `node scripts/test-activity-discovery.js` **179/179**;
regression-first **178 passed / 5 failed** out of183; final **183/183** in both
system-default and `TZ=America/Los_Angeles`. Four new controller tests plus the
updated suffix/cap assertions cover visible drafts with zero/existing teams and
both checkbox modes, explicit Add recovery, duplicate/reset/hidden behavior,
preferred home/away matches versus unrelated games, and clean literal labels.
Editor diagnostics and scoped whitespace checks passed. Browser interaction
tools were unavailable; no actual user screenshot, public-source query or physical
keyboard/layout validation was performed. If unrelated games still appear with
an added preference, capture the chosen team and game identity on the activity
page before claiming a different filtering defect or changing its semantics.

Fresh identity check confirmed this chat's independent8030 PID54822, start ticks
33162828, exact live CLI and workspace. Two static GETs returned200 and the exact
updated controller/helper disk bytes. Reload the8030 Activities page to apply the
fix; no backend matching/contract change or process restart is needed. The
existing live-on-demand service stays owned by this chat as recorded below, subject
to future identity checks. No8002/Auth/calendar/private/cache/cloud operation,
other-chat edit, new worktree, commit or push. This record and the four linked
code/test files are the only edits in this increment; shared integration needs
no backend change and remains the integrator's responsibility.

## Independent real-search service on 8030, 17 September 2026

The parent clarified that a separate activity port must retain real search, not
replace it with an offline-only preview, and requested the Activities agent fix
after approving its independent-service scope. **Active entry:
http://127.0.0.1:8030/activities.** Reload an older 8030 tab deliberately: its old
page still has the offline marker. Only the parent's explicit **Find activities**
requests public listings; startup, static loads, health checks and preference edits
do not. Agent-run real TPBL validation still needs separate fresh approval with
source, dates/filters and query count. No real query was made for this repair.

Changed files:
- [Independent server](../activity-preview/serve-search.js): separate live-service
  CLI, explicit `--live --port=8030` (no default port, port 8002 forbidden), bound
  to IPv4 loopback. Reuses the existing basketball route and bounded TPBL adapter.
- [Standalone regressions](../test/activity-search-server.test.js): eleven offline
  tests using injected synthetic source reads, never a live transport fallback.
- [Bounded offline runner](../scripts/test-activity-discovery.js): includes the new
  tests alongside its existing nine files.
- This activity handoff record. No existing UI/controller, shared shell/date,
  adapter, owner service, agent definition, task, package or central doc changed.

The offline [preview helper](../activity-preview/serve.js) remains unchanged with
`data-preview="true"`, disabled public requests and `connect-src 'none'`. The new
server renders the current date descriptor without the offline marker, serves the
exact nine CSS/JS dependencies, and allows same-origin activity requests only.
Its standalone header explains the mode and dates remain in this origin's tab,
not synchronized to the calendar port. Our week is a non-link here, not an owner
proxy or a false calendar page. No Auth, private calendar/cache routes, credential
handling, new provider, storage or background work is added. The only owner-named
dependency is the unchanged pure date utility, not an adapter/controller.

Contract remains `tpbl-teams-v2`: POST `/api/activities/basketball`, bounded selected
dates and optional team selection; exact Host/Origin, forwarded-header rejection,
non-simple JSON, body cap, source limits, single-flight/cooldown and cancellation
are preserved. Static assets use an explicit allowlist, no repository serving or
path normalization fallback. GET `/health` returns only service/contract metadata,
never calls TPBL. Shutdown aborts source work and bounds HTTP connection draining.
The live CLI refuses occupied ports rather than replacing listeners.

Verification:
- Baseline `node scripts/test-activity-discovery.js`: **168/168**.
- Regression-first `node --test test/activity-search-server.test.js`: failed with
  the missing independent-server module before implementation.
- Final `node scripts/test-activity-discovery.js`: **179/179**, also **179/179**
  with `TZ=America/Los_Angeles`; zero skipped/cancelled/failed in both runs.
- Tests connect the served date metadata and both actual UI controllers through
  the standalone HTTP route to the real adapter with **synthetic source reads**.
  They cover zero startup/edit calls, exact team filtering before40, literal hostile
  names, synthetic labels, empty/partial/outside-coverage/unavailable responses,
  security/body/path gates, absence of private modules/routes, cooldown recovery,
  disconnect fencing, idempotent shutdown, occupied-port refusal and retained
  offline-preview isolation. Existing tests retain stale-contract/URL/hidden-team
  and late-decoding coverage. Fake source data is only a test technique, not the
  live service's data source or an error fallback.
- Syntax/editor diagnostics and whitespace checks passed. Final running-service
  readiness check: **46/46 assertions**, **16 GET-only requests** on8030, page plus
  nine asset bytes/types, health contract, rejected private paths on8030, exact
  process identity and Host/Origin/forwarded gates. No search POST/public request.
- Browser interaction tools were unavailable. DOM event seams and HTTP assertions
  do not establish physical keyboard/pointer, desktop/mobile layout, screen-reader
  or parent usability approval; real-source availability remains unverified here.

Assigned-port handoff and ownership:
- Rechecked this chat's old offline PID **48518**, cwd, exact preview argv and
  start ticks **33056948**; one graceful SIGTERM, bounded exit verification, no
  force kill. Confirmed8030 unused before launching the replacement.
- Current owned PID **54822**, start ticks **33162828**, argv
  `node activity-preview/serve-search.js --live --port=8030`; terminal execution
  `7491e9a9-a782-4514-8acf-001b2c4ca891`. Mode: **live TPBL on demand**, not synthetic.
- Worktree `/home/davidtang/Projects/FamilyCopilot`, branch `davidtang/dev`, base
  `f72c087ae026d361f072c07cd465798f16362f32`; existing concurrent work preserved.
  Recheck all identities before any future lifecycle operation; this record is
  not permanent ownership of a PID or port.
- Keep this service running for the parent. Its backend changes require its own
  safe restart, not a static reload. No shared-service restart is needed for this
  independent fix. Any desired main-service integration remains an integrator
  handoff; no proposed shared-file changes in this increment.
- Port8002, other listeners, Auth, private calendars/files/snapshots, credentials
  and cloud resources were not accessed or changed. No commit or push.

## Offline Find feedback repair, 17 September 2026

The parent reported that Find appeared to do nothing in the isolated preview.
The controller did filter invented ideas, but explicit Basketball has no invented
spectator-game fixtures, and the public-search gate misleadingly combined offline
preview with an older-backend error. This is not evidence of a broken live source
or authorization failure; no public request is permitted by the offline preview.

The public controller now labels the offline scope before Find and separates its
post-click explanation from an unsupported page/date configuration. Basketball
focuses the public heading with a no-game-fixtures explanation and suggests the
explicit Anything then Find path for invented ideas. It never changes categories,
teams or dates automatically. Broad searches retain focus on the invented-results
heading; mixed-category ideas and form validation remain intact. No synthetic game
endpoint, real search, CSP relaxation, API change or service restart was added.

Changed: [controller](../activity-preview/basketball-ui.js),
[controller tests](../test/basketball-ui.test.js), and this record only.
Baseline **166/166**; regression-first run **166 passed / 2 failed** reproduced the
misleading feedback; final bounded offline runner **168/168** passed. Tests cover
pre-click disclosure, post-click focus, empty Basketball, explicit Anything recovery,
unchanged preferred names, mixed-category results, validation focus and zero network
requests. Browser tools are unavailable, so physical interaction/layout is not newly
verified. The static controller change requires an Activities page reload only;
it does not activate a backend or enable real search. No Auth, owner service,
calendar, private snapshot, cloud, worktree, commit or push operation occurred.

## Activities-only port 8030 handoff, 17 September 2026

The parent assigned **8030** to this Activities chat for an isolated offline
preview. It was unused before startup. This is runtime separation only: the
checkout remains `/home/davidtang/Projects/FamilyCopilot`, branch `davidtang/dev`,
at base commit `f72c087ae026d361f072c07cd465798f16362f32`, with existing modified
and untracked work preserved. No worktree or branch was created or switched.

Entry: **http://127.0.0.1:8030/activities**. The existing
[preview helper](../activity-preview/serve.js) was imported via
`createPreviewServer()` and bound only to `127.0.0.1:8030`, rather than invoking
its default-port CLI or starting the shared owner server. No application code,
tasks, configuration, dependencies or API contracts changed.

Process ownership at startup/verification:
- Owner: this FamilyCopilot Activities chat; assigned review port **8030**.
- PID **48518**, workspace above; terminal execution
  `25a46fd0-01b2-4515-a60e-f74943fa7383`.
- Mode: offline invented-activity preview, not live or synthetic TPBL listings.
- Kept running for parent review. These identities are historical evidence;
  recheck exact ownership before any later cleanup. Do not stop another listener.

The page has `data-preview="true"`, and CSP retains `connect-src 'none'`.
Public search is deliberately unavailable; no TPBL query or basketball result
fixture endpoint is added. Categories, sport disclosure, team entry and invented
idea filtering are reviewable. Invented ideas retain their fixed September dates;
they are not evidence of events for the selected dates. The Our week navigation
still points to the separately owned main service: do not follow it during isolated
review. Different ports have separate dates-only sessionStorage origins.

Validation: the bounded offline activity runner passed **166/166** before startup
and again after the handoff update. Diagnostics and whitespace checks passed.
HTTP isolation checks passed **25/25** assertions: page 200 and preview/CSP markers,
nine referenced local script/style assets with correct types, rejected basketball
POST (405), absent owner status/controller routes (404), incorrect Host (403),
and exact loopback listener/workspace ownership. No browser tools were available
for physical keyboard/pointer, screen-reader or mobile/desktop visual validation.
These remain parent-review limitations, not implied by HTTP or unit-test success.

Port 8002, Auth execution mode, other preview processes, private calendars/files,
snapshots, credentials and cloud resources were not accessed or changed. This
preview startup does not reactivate or validate the historical main-server state
described below. Main activation and shared-file changes remain with Auth or the
designated integrator. No commit or push performed.

## Live backend activation, 17 September 2026

The owner reported the generic backend-version search error and explicitly chose
**Live activity search · port 8002** for safe local activation. Diagnosis reproduced
an HTTP 200 synthetic response on port 8019 with `tpbl-teams-v1` while its freshly
served UI helper required `tpbl-teams-v2`. The main port 8002 helper returned 404.
The on-disk adapter already returned the correct v2 contract; weakening validation,
adding another contract field or reloading static files would not fix the old process.

Main service activation is now complete, superseding older pending-activation
handoffs below. The original exact-workspace WSL Node process (PID 87538) was
verified live/disk, idle/not_requested with date, saved-view and October markers.
It received one graceful SIGTERM under the local operation lock. The first
coordinator returned unconfirmed after stopping; the existing task's shutdown log
confirmed `cleanupFailed:false` and `cleanup:not_requested`, and fresh checks
confirmed no listener/connection refused. No force kill or second stop occurred.
An initial already-stopped coordinator timed out awaiting task start; a deliberate
resume rechecked connection refusal, held the lock through the existing task start
and completed verification. The active PID at verification was **40399**.

[Reusable activation coordinator](../scripts/activate-activities.js) requires explicit
restart approval and the `--approved-local-restart` flag. It holds local operation
exclusion through safe-status/identity checks, a graceful stop (or fresh connection
refusal for already-stopped recovery), starting the **existing local owner calendars**
task, and verification. Its `await_existing_task_start` stage waits for the operator
to run that task and send `verify` within 120 seconds. Use a terminal invocation
that returns control while awaiting this handoff. It does not start the task itself,
auto-retry, force kill, query Azure/calendars, inspect snapshots or silently change
Windows-native auth execution. Static helper/controller bytes must match disk.
It is not the October cloud migration script and must not be used without fresh
approval for another restart. Errors remain fail-closed; an unconfirmed stop needs
independent inspection, not an automatic retry.

Verification performed:
- Bounded offline baseline **160/160**, final **166/166**, with six new mocked
  [activation regressions](../test/activity-activation.test.js) in the existing
  [runner](../scripts/test-activity-discovery.js).
- Fresh main status: `idle / not_requested`, live/disk, all three calendar protocol
  markers; required activity helper/controller both served and matched disk.
- Fresh Activities browser on **http://127.0.0.1:8002/activities**: actual button
  click for **9–15 October 2026** displayed **7 of 7 TPBL listings**, with source
  retrieval **2026-09-17 10:46:50 Asia/Taipei**, season 2026–2027 and no contract
  error. Focus moved to the public results heading. Only one public search was
  made for this live validation; no preferred-team second query was run.
- No loaded real calendar tab inspected or refreshed, no calendar query, private
  snapshot read/change, cloud call, auth-mode change, commit or push. Completed
  snapshots retain existing shutdown behavior; their contents/existence were not
  inspected. Existing main tabs require deliberate reload after the restart.

The port-8019 synthetic process is deliberately unchanged and still stale for v2
search. Use the main port 8002 for live discovery. The successful public search is
not verification of tickets, travel, age suitability, all-category coverage or
schedule compatibility. Parent usability and broader source coverage remain open.

## Current Add/chip increment, 17 September 2026

The parent requested **Add a preferred team** and **Your preferred teams**, not
a roster-first picker. Add a name with the button or Enter (never a search).
Removable chips are the current page's list, not previous visits. The bilingual
Dreamers suggestion adds one preference without replacing others. No startup,
typing, adding or removing action queries any source. Only **Find activities** does.

The Watch/Play/Either controls, introductory sentence and `basketballIntent`
effects are removed. Explicit Basketball discovers spectator listings and excludes
the invented workshop; broad searches still retain separately labelled invented
ideas. Local API fields and source request bounds are unchanged. The exact-name
numeric-ID defect was reproduced offline (expected home/away matches beyond 40,
actual empty list), then repaired in the shared matcher.

Current validation: baseline **150/150**, final **159/159** in system-default and
America/Los_Angeles time zones using the bounded runner. Nine added regressions
plus migrated controller assertions cover names, Enter/default prevention/IME,
duplicates, bilingual aliases, literal XSS, bounds/controls, cap/remove/re-add,
focus, chips, lifecycle, hidden preferences, source-ID matching before40 and late
transport/decoding. Source/URL/consent protections remain in the eight-file suite.
Diagnostics and scope/whitespace checks passed. Browser usability is the parent's
next review; no browser or live-source verification is claimed for this increment.

## Preserved sport icon controls

The six sport choices use icon-only faces (basketball, ping-pong, baseball,
football, badminton and swimming), native checkboxes, matching accessible names
and hover titles. Tiles are 84 × 64 CSS pixels with wrapping and existing focus
outlines. Checkbox squares are hidden with transparent full-tile inputs, not
removed from keyboard/accessibility navigation. Selected tiles show a corner
checkmark and tinted background, so selection does not rely on color. Search behavior
is unchanged. All 150 focused tests and editor/whitespace checks passed. Browser
DOM checks confirmed icons, names, titles and disclosure; pointer/keyboard review
attempts timed out in the shared browser, so new interaction/layout verification
is not claimed for this styling increment.

## Current discovery behavior

Six existing categories appear first: Sports, Music, Art, Science, Outdoors and
Exhibitions. Multi-select uses OR; **Anything** removes category restrictions and
ignores contextual sport/basketball preferences, retaining age and More options.
Selecting Sports exposes **Which sports?**, with native multi-select checkboxes
for Basketball, Ping-pong, Baseball, Football, Badminton and Swimming. Initially none are selected;
Sports does not choose Basketball. No checked sports means any sport. Only
explicit Basketball exposes the preferred-name input and chips.
Sport choices combine with OR; spectator-only Basketball does not change other
chosen sports. Non-basketball categories remain independent OR matches.

Only **Find activities** searches. Anything or Sports with no specific sport may
query TPBL with Any team; neither applies hidden sport or team choices.
Explicit Basketball may query TPBL with its visible team preference;
non-basketball-only choices never request spectator games.
No other live sports source is implemented. Page-only choices may be remembered
when hidden but are ignored in the effective request, result checks and summaries.
Returning explicitly to Basketball restores its remembered choices. Anything,
deselecting Sports and Start over collapse the panels without a request. Start
over also unchecks every sport and clears team preferences. Any sport edit
clears both result sections and aborts/fences pending transport or JSON decoding.

The public source is still **TPBL only**. Other sports/categories and live play
sessions are not searched. P. LEAGUE+ remains an unsearched official link. The
separate Ideas section contains up to six matching invented activities, with
fixed **20–26 September 2026** coverage, never silently moved to selected dates.
Ages and More options apply only to invented ideas. The hoops workshop is explicitly
classified as Basketball; explicit spectator Basketball and Swimming-only cannot
include it. No Football, Badminton
or Swimming fixtures are invented to fill empty results. Ideas are inspiration,
not selected-date availability.
No game is claimed age-appropriate, affordable, available or calendar-compatible.

Visible Activities copy omits Demo/Sample (including cards, errors, prices and the
footer); identifiers and historical records are unchanged. Main labels stay short:
**Find activities**, **Ideas**, **Your preferred teams**. The section says **Invented examples ·
Not live listings**, with fixed dates and invented venues/prices. Card details
retain provenance, age uncertainty, freshness/travel/ticket/calendar-fit limits;
prices and fictional venues are not presented as verified facts. Synthetic public
fixtures say **Synthetic test data** on cards and in source details, not official
verification. No owner/calendar/picker wording is changed.

Dates are directly editable on Activities: 1–7 inclusive Taipei days using the
existing shared validator/store. Only the existing dates-only sessionStorage key
is used. Edits hide public and sample results, abort/fence pending responses and
clear roster evidence; they neither query nor clear calendars. Invalid/denied
storage blocks Find. Start over clears preferences/results but retains dates;
Reset dates removes the date key and restores the labelled configured default.

## Teams: preference, not a profile

- **Add a preferred team** accepts an arbitrary bounded name before any source
  retrieval. Add and Enter update **Your preferred teams** removable chips, never
  submit search. Up to 16 distinct names, 120 JavaScript string characters each;
  blank, oversized, control/bidi-control and unpaired-surrogate input is rejected
  without echo. Validation and Add return focus to the input. Removal focuses the
  next/previous removal button, or the input when empty; changes announce status.
- Outer spaces are trimmed; duplicate detection and source-name matching use
  JavaScript lowercase, not fuzzy search, transliteration, punctuation changes,
  accent stripping or internal-whitespace normalization. Arbitrary entered names
  are preferences, never proof of a verified roster identity or game.
- **福爾摩沙夢想家 (Formosa Dreamers)** is an additive shortcut, not an initial
  restriction or query. Exact bilingual aliases (ignoring English case) deduplicate.
- The **full validated fetched season** optionally supplies native autocomplete,
  not a prerequisite for adding. Retrieval freshness and source failures remain
  in result details; no verbose empty-roster UI. Dates clear old source suggestions,
  not the preferred list. Names from sources and users render as literal text.
- **Only preferred teams** defaults on; off means **Prefer first**, with other games
  following explicitly. Both home and away match. No favorite match explains
  the result and offers show-all on next search (clears preferences), change dates,
  or edit preferred names. An empty list has no restriction in either mode.
  No automatic replacement, fabricated alternative or
  guessed official Dreamers ID. No extra roster endpoint or startup request.
- Source numeric IDs are used only when actually present and valid. A preferred
  name key matches that validated game's exact source name even when its identity
  key is numeric. Matching/ranking precedes the first 40; missing IDs retain
  reversible exact-name local keys, never guessed official IDs.
  Unknown translations are explicitly unverified, not invented; Dreamers always
  displays its English gloss. Names are text, never HTML or instructions.
- Teams/input/ages/results stay page-memory only; reload, reset and page
  exit clear them. Date/category edits retain the list, but hidden teams are ignored
  for broad/non-basketball searches. Team edits clear prior results/selections and
  fence pending transport and JSON decoding. Preferences reach the local process only on Find and are
  never forwarded to TPBL. No profiles, analytics or new persistence.

## Local API contract

`POST /api/activities/basketball` accepts exact required `startDate`, `endDate`,
and optional **paired** `teamIds`, `teamMode`. Omitted pair means Any/prefer for
legacy dates-only callers. Present pair: at most 16 unique canonical local keys,
`teamMode: prefer | only`. Other fields (including ages/categories/search text/
URLs) fail before source work. Maximum body: **20,000 bytes**, enough for 16
bounded percent-encoded names; individual keys at most 1,100 characters.

[Team helper](../shared/basketball-teams.js) exports `team`, `preferredTeam`, `validName`, `selection`,
`selectGames`, `matches`, `validKey`, `validTeam`, `label`, `contract`, `dreamersKey`.
Keys: `tpbl:id:<positive source integer>`, `tpbl:name:<canonical encoded name>`,
or local exact-alias `tpbl:alias:formosa-dreamers`. The last is **not** an official
numeric ID. Preferred-name keys are trimmed/case-folded; returned source names
retain original spelling. Legacy canonical exact-name keys also match by case.
Invalid supplied IDs are rejected rather than guessed from names.
Conflicting numeric-ID/name mappings fail the source response closed.

Response adds `teamContract: tpbl-teams-v2`, normalized `teamSelection`,
`availableTeams: [{key, name, gamesInRange}]`, and `homeKey`/`awayKey` on each game.
TPBL source metadata adds `eligibleCount`, `matchedCount`, `preferredCount` and
`truncated`. Validation/date/status filtering and roster construction precede
team filtering/ranking; **only then** are the first 40 returned. The source still
has at most 600 rows; malformed rows mark partial, never complete coverage.

The UI rejects old or mismatched team contracts and invalid counts/keys/links.
An older running server cannot adopt the new local route merely by reloading its
page; no service was restarted in this increment. The operator must separately
review safe activation. Standalone preview remains offline, with public search
unavailable but sample filtering usable.

Unchanged protections: exact loopback Host/Origin, JSON-only POST, no CORS,
credential omission, single-flight/cooldown, disconnect cancellation, at most
**two existing HTTPS GETs**, 1 MiB per response, 40 seasons/600 rows, source
deadlines, public-IPv4 DNS pinning, no redirects/retries or arbitrary URLs. External
requests receive only their existing paths and abort signal, never team choices.
No owner/calendar/auth/infra/cache logic is changed. The earlier owner static
helper allowlist addition is not changed or activated by this increment.

## Current parent handoff and offline validation

Earlier synthetic browser checks verified the prior sports disclosure and
Dreamers filtering. New programmatic browser DOM checks verified Enter-to-add,
duplicate suppression, removal/re-add and absence of the old intent controls.
Physical pointer/keyboard review timed out waiting on the Sports control, so
real interaction/layout validation is not claimed for this increment.
The preview was left showing the Dreamers chip. Parent review should use the
existing isolated port-8019 Activities page and deliberately reload its static
assets. Do not restart it or the main service. The known main-8002 missing-helper
404 remains unchanged; this work does not claim main-server readiness.
Running Node processes may retain the older shared matcher in memory. Static
reload alone cannot activate the numeric-ID/name fix. The new `tpbl-teams-v2`
contract rejects older matching semantics rather than showing false no-matches. Full matching
evidence here is from fresh offline tests, not existing-service activation.
Any later safe backend activation needs separate approval; do not restart for
this handoff. Parent can review static entry/chip behavior independently.

Review: initial collapsed panels → Sports shows unchecked sports → explicitly
Basketball → add an arbitrary name with Add/Enter → add Dreamers → remove/re-add;
then Swimming-only, multiple sports, Anything, dates and Start over. Check cap16,
long names, duplicates/aliases, Space/Tab/Enter, focus, small/large layouts,
invented and synthetic disclosures, no automatic searches, non-basketball empty
results, ignored hidden favorites and late-response cancellation. Do not open
synthetic game URLs as evidence or use real calendar/provider requests for review.

Executed baseline **150/150** and final **159/159** using the existing bounded
[runner](../scripts/test-activity-discovery.js), with no failures, cancellations or
skipped tests, in both system-default and America/Los_Angeles time zones.
The same eight test files include nine new regressions described above. The unchanged API
security and team-filter-before-40 tests remain included. No full suite was run.
Editor diagnostics and whitespace checks passed. Real-device/parent approval,
safe operator activation and broader sport-provider feasibility remain separate.
No cloud, private calendars/files/cache, live provider requests, dependencies,
server restart, commit or push occurred.

Current increment edits only these 14 files; unrelated modified/untracked work
is preserved. Untracked activity edits require direct file review as well as
Git's tracked diff check.

- UI: [markup](../activity-preview/index.html), [control styles](../activity-preview/basketball.css),
  [core](../activity-preview/core.js), [team helper](../shared/basketball-teams.js),
  [public controller](../activity-preview/basketball-ui.js).
- Tests: [core/markup](../test/activity-preview.test.js), [team matching](../test/basketball-teams.test.js),
  [two controllers](../test/basketball-ui.test.js), [DOM seam](../test/fixtures/activity-dom.js).
- Docs: this record, [README](../README.md), [component](activity-search-component.md),
  [UX](activity-ux-refresh.md), [basketball](basketball-search.md).

## Earlier isolated synthetic browser handoff (before explicit sport selection)

An isolated synthetic review server was started on port 8019 with the injected
fixture adapter and calendar operations denied, no private storage or external
requests. Existing services were not restarted. Browser checks verified six
visible categories, keyboard Dreamers shortcut without a request, one explicit
POST returning two home/away Dreamers fixtures, Play and Music with zero POSTs,
no-match recovery without replacement and focus on an available synthetic team.
Measured 1279px desktop and 319px mobile layouts had no horizontal overflow.
The preview is left open with the Dreamers preference selected and no results
loaded, for owner review. Fixtures are not evidence of a real Dreamers game.
Real source suitability and parent usability remain unverified. For repeatable
review, use an isolated synthetic page and intercept only the activity POST;
do not attach a real owner page or start a real public query.

Import `basketballResponse` and `row` from
[test/fixtures/basketball-response.js](../test/fixtures/basketball-response.js).
Call `basketballResponse({startDate, endDate, teamIds, teamMode, rows, checkedAt})`
with dates and team fields copied from the intercepted JSON request, **synthetic**
TPBL-shaped rows and an explicit review timestamp. `row(id, date, changes)` creates
a valid invented row; pass `home_team: {name: "Formosa Dreamers"}` or
`away_team: {name: "Formosa Dreamers"}` in `changes` to test the alias. Numeric test
IDs are synthetic, not claims about official IDs. `changes` overrides all fields;
if changing time, also update `gamed_at` to agree. Do not pass already truncated
game cards. The helper uses real `parseGames(rows, week, season, selection)` and
returns the roster, counts, keys and version contract correctly. It adds
`synthetic: true`; the current UI labels cards and source evidence **Synthetic test data**.
Mock game URLs are not proof of real events and should not be opened in review.

Review desktop/mobile layouts, native keyboard checkbox/radio/search navigation,
focus after cancel/reset/recovery, 16-team limit, long names, zero startup/edit
requests, Play/no-sports zero POST, no-match alternatives and late-response
fencing. Default fixture timestamp is fixed, so stale warnings are expected unless
the reviewer explicitly supplies its current synthetic observation time.

## Earlier category/team validation and remaining gates

Baseline executed: **121/121** in the seven existing focused files. Final focused
suite: **137/137**, zero failures/cancellations/skips, in both the system default
time zone and `America/Los_Angeles`. The reusable
[focused runner](../scripts/test-activity-discovery.js) prints the exact eight-file
`node --test` command and bounded counts; run it with Node. Team and two-controller
integration coverage uses only offline synthetic fixtures. Editor diagnostics and
`git diff --check` passed. The known-hanging full suite is deliberately not run.
Parent accessibility/usability validation, safe
operator activation, broader live category sourcing, source permission for wider
distribution and calendar-comparison approval remain separate. No Azure, live
source requests, private files/calendars/cache access, dependencies, deployment,
commit or push occurred.

### Increment path inventory

Existing unrelated modified/untracked work was present at baseline and preserved.
Paths edited or added by this increment only:

- UI: [index](../activity-preview/index.html), [sample core](../activity-preview/core.js),
  [sample controller](../activity-preview/ui.js), [public controller](../activity-preview/basketball-ui.js),
  [control styles](../activity-preview/basketball.css), [standalone allowlist](../activity-preview/serve.js).
- Local contract: [team helper](../shared/basketball-teams.js), [adapter](../scripts/basketball.js),
  [public route](../scripts/basketball-route.js), [owner static allowlist only](../scripts/serve-owner.js).
- Validation: [focused runner](../scripts/test-activity-discovery.js),
  [sample regressions](../test/activity-preview.test.js), [adapter/HTTP regressions](../test/basketball.test.js),
  [two-controller regressions](../test/basketball-ui.test.js), [team regressions](../test/basketball-teams.test.js),
  [shell assertions](../test/shell.test.js), [DOM seam](../test/fixtures/activity-dom.js),
  [mock response builder](../test/fixtures/basketball-response.js).
- Documentation: this document, [README](../README.md), [basketball record](basketball-search.md),
  [UX record](activity-ux-refresh.md), [component proposal status](activity-search-component.md).