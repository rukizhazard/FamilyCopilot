# Builder handoff: natural source labels

## Current handoff: 21 September 2026

### Outcome and exact copy

Small offline presentation-only increment, following the owner's rejection of
visible Demo wording. Member calendars still precede shared candidate times.
No preference redesign, fixture substitution, overlay, cropping or new operation.
This entry supersedes the old standalone-disclosure/framing requirements below.

| Surface | Previous copy | Current copy or placement |
| --- | --- | --- |
| Calendar header | `DEMO` | `Sample calendars` |
| Calendar source Details badge | `DEMO / Fictional calendars only` | `Sample calendars / Synthetic schedules` |
| Chat closed summary | `Demo details` | `Details` |
| Composer | `Demo invitation` | `#meeting-disclosure` removed entirely, including CSS and UI binding |
| Running invitation action | `Creating Mike's demo invitation (no real send)...` | `Preparing Mike's invitation...` |
| Queued invitation action | `Create Mike's demo invitation (no real send)` | `Prepare Mike's invitation` |
| Calendar pending status | `Demo invitation / Mike pending response` | `Mike pending response` |
| Calendar result | `Demo invitation sent to Mike... Waiting for his response. No real invitation or calendar change.` | `Mike's invitation for Kimi's school meeting, Friday, October 16, 2026, 3:30-4:30 PM (Asia/Taipei), is awaiting his response.` |
| Timeline note | Repeated demo/no-delivery/no-change prose | `Current user: Debby. Mike's response and travel are not confirmed.` |
| Invitation source fact | Repeated chat instructions and timeline prose | Existing Calendar Details, `#calendar-invitation-source`: `Invitations use sample data and stay on this page. No invitation is delivered and no calendars are changed.` |
| Retry | `Retry this scene before continuing the demo.` | `Retry this request before continuing.` |
| Completion status | `Scripted demo complete. Start a new conversation to replay.` | `This conversation's supported requests are complete. Start a new conversation to begin again.` |
| Completion message | `This scripted demo is complete. Start a new conversation to replay it; further messages are not interpreted.` | `This conversation's supported requests are complete. Start a new conversation to begin again; further messages are not interpreted.` |
| Recovery | `Reload to enter a new demo page; nothing loads automatically.` | `Reload to begin again; nothing loads automatically.` |
| Family accessible label | `Demo family members` | `Family members` |

Source Details member-list labels use `sample` instead of `demo`; retention uses
`Sample snapshots`; candidate Details uses `sample display rules`. Calendar
identity now says `Mike, Debby and Kimi have sample schedules here. Names do not
establish real calendar access or authorization.` It no longer falsely calls the
people fictional. Internal enum/ID/class names containing demo remain unchanged.

Chat Details retains October 1-31 sample coverage, public facts checked September
20, no live search/AI, unverified screenings and unknown game end/admission/tickets/
travel. It retains submission-order limits, October 9-11 then September 19-20,
the fixed September 18 Taipei reference, outside-coverage truth and the distinction
between later saved evidence and what was known on September 18. School dialogue
remains explicitly fixed, not general language understanding. The long replay/
consent instruction transcript was removed; actual explicit consent is unchanged.

### Source truth and preserved behavior

`Sample calendars` is a real product header, not an overlay. No-delivery truth is
consolidated in existing closed Calendar Details, not deleted or repeated as an
Invitation preview nag. It remains accessible with the body collapsed and after
No, Undo, expired context and return to activities; reset clears the conversation.
Offline tests establish DOM placement/lifecycle, not viewport visibility while
scrolling. Producer must establish sample context and never describe real delivery.
Removing all sample/no-delivery evidence would mislead and is not implemented.

Kimi owns October 16, 2026, 15:30-16:30 Taipei. Debby's 30-minute overlap and both
parent busy-only tracks remain. Mike is pending, never accepted or confirmed.
Bare Yes cannot send; exact consent, revalidation, deduplication, revocation and
expiry remain unchanged. Saved-public provenance, unknown availability and
unverified showtimes stay intact. No provider, event write or live functionality.

### Immutable snapshot and verification

- [Snapshot manifest](../browser-artifacts/demo/snapshot-8c0b6785-aeac-477e-a019-a3e7931be9f5/snapshot.json)
- SHA-256: `e7aaece55caf8a85555a8fdeff5383db45fa122af0252cf1ce7ce748e55fb33b`
- Exactly 25 read-only allowlisted assets, plus the revised five-scene Builder
  scenario. Six product assets below differ from prior `snapshot-7b3e77ca-7684-4ddc-99e5-145f4f1a975f`,
  SHA-256 `d3c76cf2d2a43487a30c6c6a8a5ceae896ea8baaffb6a7c724b056dc0b5cad5d`.
  Other 19 assets match, including fixtures, shared algorithms and Activities.
- [Pinned unit report](../browser-artifacts/chat-handoff-IIZk58/unit-report.json)
  and [test output](../browser-artifacts/chat-handoff-IIZk58/unit-tests.txt):
  **210/210 passed**, zero failures/skips/cancellations. All 25 source hashes and
  test/helper hashes are in the report, matched before/after and at final review.
- Baseline 134/134; Calendar 64/64; conversation/integration 70/70; final integration
  38/38 after adding one regression for the 11-scene product sequence. Two failed
  new-test attempts used incorrect mock DOM event conventions; repaired to match
  existing Calendar tests without any product/fixture change. No pre-existing failure.
- Scenario schema, browser-runner syntax and editor diagnostics passed. Exact
  product diff reviewed against prior frozen bytes, not only tracked Git files.
  No browser, keyboard, visual layout, rehearsal or capture was run.

Pinned reproduction, offline only:

```sh
node scripts/test-chat-handoff.js browser-artifacts/demo/snapshot-8c0b6785-aeac-477e-a019-a3e7931be9f5/snapshot.json e7aaece55caf8a85555a8fdeff5383db45fa122af0252cf1ce7ce748e55fb33b
```

### Exact owned paths

- Product: [chat/index.html](../chat/index.html), [chat/ui.js](../chat/ui.js),
  [chat/chat.css](../chat/chat.css), [chat/conversation-core.js](../chat/conversation-core.js),
  [owner/chat-calendar-template.js](../owner/chat-calendar-template.js),
  [owner/chat-calendar.js](../owner/chat-calendar.js).
- Tests: [test/chat-calendar.test.js](../test/chat-calendar.test.js),
  [test/chat-conversation.test.js](../test/chat-conversation.test.js),
  [test/chat-integration.test.js](../test/chat-integration.test.js),
  [scripts/test-chat-browser.js](../scripts/test-chat-browser.js) (syntax only).
- Records: [docs/chat-handoff-scenario.json](chat-handoff-scenario.json),
  [docs/chat-integration-contract.md](chat-integration-contract.md),
  [docs/designer/README.md](designer/README.md), this handoff.
- Generated outputs: only the new snapshot and unit-evidence directories above.
  Other dirty work, previous snapshots, fixtures, Producer scripts/docs/media and
  package commands are preserved. Snapshot/test helpers were reused, not edited.

### Producer scenario changes needed

Read only: [11-scene scenario](../browser-artifacts/demo/member-calendars-20260921/scenario.json),
SHA-256 `ab723d3ff6da8f6328214b308e9ba0801d08afe3b928487b8024aa236952d7a1`.
It was not edited, rehearsed or recorded by Builder.

1. Scene 7: replace `visible #meeting-disclosure false` with
   `count #meeting-disclosure 0` because the element no longer exists.
2. Scenes 9 and 11: remove the visible/text assertions expecting `Demo invitation`;
   use `count #meeting-disclosure 0`. Establish `Sample calendars` via
   `#chat-calendar-heading`; scene 11 can assert `#coordination-status` contains
   `Mike pending response`. Natural chat reply and Kimi ownership assertions remain.
3. Limitation 4: replace the old DEMO/disclosure framing requirement with the
   source placement described above. The no-delivery text is available at
   `#chat-calendar-source-details #calendar-invitation-source`; open its existing
   summary to review it. A text-content assertion alone is not visual evidence.
4. Keep scenes 1-6, 8 and 10's product assertions, calendar/member ordering,
   explicit consent, source facts, uncertainty and pending response. Revalidate
   layout/scroll timing against new bytes only under separate scoped approval.

Producer owns introduction/movie copy and media, including the rejected
ILLUSTRATIVE SCENARIO / SAMPLE CALENDARS introduction wording; those were not
changed here. Old footage still contains old UI and does not prove this revision.
No browser/rehearsal/capture/service/shared tabs/network/TTS/install/other-agent/
commit/push operation was performed. This task grants no unconsumed operational
approval. Parent usability, visual framing and any later media work remain gates.

## Historical handoff: member calendars first, 21 September 2026

### Scope and complexity

B is a small presentation-only change using the existing Calendar UI:
`Family calendars` -> expanded month overview -> expanded member day tracks ->
shared candidate-times summary. No new domain computation, provider access,
fixture data, calendar permissions, storage or dependency is needed.
The day grid retains separate Mike, Debby and Kimi tracks; this does not mean
three independent full-calendar views or unrestricted detailed calendar access.
Parents remain busy-only. Kimi's permitted sample event names/times remain in
Calendar. Missing time is unknown; candidate times are not guaranteed availability.

Progress: `Loading family members' calendars...` then
`Finding activities that match your family's interests...`. Queued actions match
that copy; the unchanged core still runs `search_saved_activities`. Saved-public
provenance, incomplete coverage and unverified showtimes remain elsewhere.
No real search or artificial production delay was added; loading can finish
before a browser paint. Capture-only delay requires separate authorization.

The long `#meeting-disclosure` sentence is replaced by `Demo invitation` in the
same independent status above the composer. It stays visible with meeting context
or history, including pending, No, Undo, stale context and return to activities;
reset/disposal clears it. Calendar DEMO context and its existing no-delivery
details remain. Natural dialogue, explicit consent and revalidation are unchanged.
Kimi still owns the October 16, 2026, 15:30-16:30 Taipei school meeting. Debby's
30-minute overlap remains; Mike is pending, never accepted. No real send exists.

### Immutable snapshot and executed checks

- [Snapshot manifest](../browser-artifacts/demo/snapshot-7b3e77ca-7684-4ddc-99e5-145f4f1a975f/snapshot.json)
- SHA-256: `d3c76cf2d2a43487a30c6c6a8a5ceae896ea8baaffb6a7c724b056dc0b5cad5d`
- 25 read-only allowlisted static assets and the updated five-scene Builder
  scenario. This scenario tests dialogue/visibility, not Producer scroll timing.
- Compared with prior `snapshot-5d543ab6-5a85-4f93-b6cb-6b9257113084`, SHA-256
  `4275e114a1b9c32e772e9d3a6bef5bf5d9cd8274b168a78ea99254c46d205056`:
  only `chat/index.html`, `chat/ui.js`, `owner/chat-calendar-template.js` differ;
  all other 22 asset hashes match, including fixtures and domain algorithms.
- [Pinned unit report](../browser-artifacts/chat-handoff-1tkluw/unit-report.json)
  and [test output](../browser-artifacts/chat-handoff-1tkluw/unit-tests.txt):
  **209/209 passed**, zero failures/skips/cancellations. Product/test/helper hashes
  matched before and after the seven explicitly listed offline suites.
- Baseline: three focused Calendar/conversation/integration suites passed.
  Final focused results: Calendar 64/64 and conversation/integration 70/70.
  Updated order/default-open, progress, disclosure and retry expectations pass;
  consent, expiry, revocation, ownership and unknown-availability guards remain.
- Browser-runner syntax, scenario schema and editor diagnostics passed. No
  browser, layout, keyboard, rehearsal or recording verification was performed.

Pinned reproduction (offline only):

```sh
node scripts/test-chat-handoff.js browser-artifacts/demo/snapshot-7b3e77ca-7684-4ddc-99e5-145f4f1a975f/snapshot.json d3c76cf2d2a43487a30c6c6a8a5ceae896ea8baaffb6a7c724b056dc0b5cad5d
```

### Exact owned paths

- Product: [chat/index.html](../chat/index.html), [chat/ui.js](../chat/ui.js),
  [owner/chat-calendar-template.js](../owner/chat-calendar-template.js).
- Tests: [test/chat-calendar.test.js](../test/chat-calendar.test.js),
  [test/chat-integration.test.js](../test/chat-integration.test.js),
  [scripts/test-chat-browser.js](../scripts/test-chat-browser.js) (not executed).
- Contract/scenario/handoff: [docs/chat-integration-contract.md](chat-integration-contract.md),
  [docs/designer/README.md](designer/README.md),
  [docs/chat-handoff-scenario.json](chat-handoff-scenario.json), this file.
- Generated evidence: only the new snapshot and unit-evidence directories linked
  above. Existing snapshots, media, dirty/untracked product work and Producer
  files are preserved. No media helper, package command or fixture was edited.

### Existing controls for Producer

After the approved explicit conversation request loads the synthetic calendars:

1. Keep `#chat-calendar-heading` (including DEMO) and `#chat-calendar-status`
   visible when establishing source, member load states and coverage. Use
   `#chat-calendar-toggle` only if the whole Calendar has been collapsed.
2. Show `#calendar-month-overview` / `#calendar-month-days`, already expanded.
   Member markers are reported schedule markers, not unrestricted event titles.
   `#calendar-month-previous` and `#calendar-month-next` browse only; outside
   coverage is unknown and does not fetch additional dates.
3. Select `#calendar-month-days [data-month-date="2026-10-16"]` to review the
   meeting day, then show `#calendar-day-details` / `#availability-grid` and
   `.track-names`. Mike/Debby remain busy-only; Kimi shows School meeting.
   The day-details panel is already expanded; do not blindly toggle its summary.
   Member buttons `#calendar-person-0`, `#calendar-person-1`, `#calendar-person-2`
   inside source Details all focus this same grid, not separate calendar pages.
4. Only then scroll continuously to `#calendar-candidates`,
   `#calendar-candidate-status`, `#calendar-candidate-list` and
   `#calendar-candidate-note`. Existing `[data-candidate-date="2026-10-03"]`
   selects that candidate's day in the same grid without another load. It is not
   the school-meeting day and must not be presented as that meeting's availability.
5. For the meeting, show `#coordination-timeline` / `#coordination-result` and
   retain `#meeting-disclosure` with the pending conversation. Preserve Kimi
   ownership, Debby's overlap, explicit consent and Mike awaiting response.

Selectors and DOM order are verified offline, not visually rehearsed. Use the
fresh immutable bytes for a separately approved desktop review and 1x continuous
scroll capture. Do not crop away sample/demo or uncertainty labels. Names refer
to real people; these sample schedules are not real-calendar verification or
publication consent. Parent usability and source/image rights remain unresolved.

No other agents, browser/shared-page inspection, service operation, live/private
calendar/provider/network access, TTS, installs, commit or push occurred. No
operational approval remains available from this task: browser/rehearsal/capture,
capture-only loading simulation and any paid synthesis need separate approval.

## Historical handoff: Kimi school-event ownership, 21 September 2026

The school meeting belongs to Kimi's sample calendar, not Debby's or Mike's.
The comparison now derives its interval from that calendar event instead of a
separate hard-coded meeting. The heading is `Kimi's school meeting`; the first
timeline row stays `Kimi / School meeting` before and after proposals/invitations.
October 16 has a Kimi month marker and the selected-day details show the event.
The sample event remains October 16, 2026, 15:30-16:30 Asia/Taipei. Parent busy
data is unchanged: Debby 15:00-16:00 (30-minute overlap), Mike 17:00-18:00.
Missing child context fails closed. No event is added to either parent's calendar.

### Fixed snapshot and evidence

- [Immutable snapshot](../browser-artifacts/demo/snapshot-5d543ab6-5a85-4f93-b6cb-6b9257113084/snapshot.json)
- SHA-256: `4275e114a1b9c32e772e9d3a6bef5bf5d9cd8274b168a78ea99254c46d205056`
- 25 allowlisted static assets with the updated five-scene Builder scenario.
  Only `owner/chat-calendar-fixtures.js`, `owner/chat-calendar-template.js` and
  `owner/chat-calendar.js` differ from the preceding `d4edafb7...` snapshot;
  the other 22 asset hashes match. Earlier snapshots and media remain untouched.
- [Pinned unit report](../browser-artifacts/chat-handoff-bP1c4h/unit-report.json)
  and [test output](../browser-artifacts/chat-handoff-bP1c4h/unit-tests.txt):
  **209/209 passed**, zero failed/skipped/cancelled. Product and test/helper hashes
  matched before and after the seven bounded suites.
- Calendar baseline 63/63; final Calendar/integration 101/101. Browser-runner
  syntax, scenario schema and editor diagnostics passed. No browser, keyboard,
  visual framing, rehearsal or capture was run for this revision.

Pinned reproduction:

```sh
node scripts/test-chat-handoff.js browser-artifacts/demo/snapshot-5d543ab6-5a85-4f93-b6cb-6b9257113084/snapshot.json 4275e114a1b9c32e772e9d3a6bef5bf5d9cd8274b168a78ea99254c46d205056
```

### Owned scope and Producer requirements

Owned paths: the three product files above, `test/chat-calendar.test.js`,
`test/chat-integration.test.js`, `scripts/test-chat-browser.js`,
`docs/chat-handoff-scenario.json`, `docs/chat-integration-contract.md`,
`docs/designer/README.md` and this handoff. Unrelated working-tree changes remain.

Producer must use this fixed snapshot and show Kimi as event owner, with parents
as separate attendance candidates/busy-only rows. Preserve natural invitation
dialogue, exact explicit consent, Mike pending response and the independent
simulation disclosure described below. Names refer to real people; calendar
content here is sample data, not verified real schedules or publication consent.
The five-scene specification is not a rehearsed media scenario. No private data,
real calendar writes, providers, services, recording, TTS, delegation, commit or
push were accessed or performed. No new browser/rehearsal/capture approval is
supplied or pending execution; the next step needs separately scoped approval.
Parent usability, visual review and all prior source/coverage limitations remain.

## Historical handoff: natural invitation, 21 September 2026

### Fixed snapshot and evidence

- [Immutable snapshot](../browser-artifacts/demo/snapshot-ab2c0ca7-2ed6-406b-9105-58eb0278058a/snapshot.json)
- SHA-256: `d4edafb7e596be589986d6d0c44c4a962645e90f98c00343c16eec3bdc3e5fb1`
- 25 allowlisted static assets and the embedded updated five-scene Builder
  scenario. All asset files and the manifest are read-only. No private cache,
  credentials or media is included; earlier snapshots remain untouched.
- [Pinned unit report](../browser-artifacts/chat-handoff-OH8naz/unit-report.json)
  and [full test output](../browser-artifacts/chat-handoff-OH8naz/unit-tests.txt):
  **208/208 passed**, zero failed/skipped/cancelled. Product and test/helper hashes
  matched before and after the seven bounded suites.
- Baseline conversation/integration: 69/69. Final focused checks: 70/70;
  browser-runner syntax, five-scene schema and editor diagnostics passed.
- No browser, visual framing, keyboard, rehearsal or capture was executed for
  this revision. The previous loading-only browser review is not evidence for
  the new disclosure layout. Parent usability remains unverified.

Receipt verification, with no browser or test execution:

```sh
node scripts/demo-snapshot.js --verify browser-artifacts/demo/snapshot-ab2c0ca7-2ed6-406b-9105-58eb0278058a/snapshot.json --sha256 d4edafb7e596be589986d6d0c44c4a962645e90f98c00343c16eec3bdc3e5fb1
```

Executed snapshot-bound regression command:

```sh
node scripts/test-chat-handoff.js browser-artifacts/demo/snapshot-ab2c0ca7-2ed6-406b-9105-58eb0278058a/snapshot.json d4edafb7e596be589986d6d0c44c4a962645e90f98c00343c16eec3bdc3e5fb1
```

### Exact dialogue and Producer requirements

Offer: `Your work meeting overlaps by half an hour. Mike's calendar looks clear
then. If only one parent needs to attend, shall I invite Mike to Kimi's school
meeting on Friday, October 16, 2026, 3:30-4:30 PM (Asia/Taipei)?`

Supported consent remains `Yes, one parent is enough. Please send Mike an
invitation.` or, in this established context, `Yes, please send Mike an
invitation.` Bare Yes, ambiguity or changed/incomplete calendars cannot send.
No parser, authority, freshness, deduplication or provider behavior changed.

Result: `Mike's invitation for Kimi's school meeting on Friday, October 16,
2026, 3:30-4:30 PM (Asia/Taipei) is awaiting his response.` It does not claim
acceptance or confirmed attendance. The actual operation remains page-local.

Separate visible status, `#meeting-disclosure`: `Simulation only. No real
invitation has been sent and no calendars have changed.` It stays above the
composer while meeting state or meeting messages remain, including No, Undo,
stale context and return to activities; reset/disposal hides it after clearing
the conversation. It is outside the message list, not appended to assistant
dialogue or hidden in Demo details. Calendar's existing synthetic status and
supporting pending-invitation details remain unchanged.

Producer must use these frozen bytes and the embedded scenario. Keep the
disclosure visible alongside the invitation conversation during framing and
editing; do not crop it out or replace product copy in postproduction. The
updated [Builder scenario](chat-handoff-scenario.json) asserts its visibility,
exact text and reset behavior. It is still a five-scene handoff specification,
not a rehearsed media scenario. Preserve explicit consent and Mike pending.
No current browser/rehearsal/capture/TTS approval is supplied by this handoff.

This snapshot also includes the preceding Stop removal and action-specific
progress list, not present in the prior pinned `4a77796c...` snapshot. Compared
with that handoff, only `chat/index.html`, `chat/chat.css`,
`chat/conversation-core.js` and `chat/ui.js` differ; the other 21 asset hashes
are identical. Exact hashes are in the manifest and pinned report.

### Owned scope and limits

This increment changes those four product files, `test/chat-conversation.test.js`,
`test/chat-integration.test.js`, `scripts/test-chat-browser.js`,
`docs/chat-handoff-scenario.json`, `docs/chat-integration-contract.md`,
`docs/designer/README.md` and this handoff. Existing unrelated changes are retained.
No Producer files, media, service, private data, provider, network, install,
delegation, recording, TTS, commit or push was touched. Calendar coverage,
showtimes, travel, public-source completeness and image rights retain their
existing limitations. The next step is separately approved Producer framing
and rehearsal of this exact snapshot, not reuse of earlier browser evidence.

## Historical handoff: neutral composer, 21 September 2026

Completed the approved offline copy correction as sole product writer. No browser,
service, private-data access, live/provider query, network, install, TTS, recording,
delegation, commit or push. Producer files and all existing media remain untouched.
The main agent owns the requested recording step after this handoff; it was not
executed here, and the snapshot does not grant additional operational permissions.

### Fixed snapshot and evidence

- [Snapshot manifest](../browser-artifacts/demo/snapshot-c6339f52-f4d3-49f9-94ae-b4159e686f31/snapshot.json)
- SHA-256: `4a77796cb2ec5dde5fb81e62080e03fc3436c8be0e09ef09ba4e0403eb4b4def`
- Exactly 25 static assets, using the unchanged allowlist and six explicit extra
  images. No private cache, credentials or media is included.
- [Pinned unit report](../browser-artifacts/chat-handoff-PUJYgT/unit-report.json)
  and [full output](../browser-artifacts/chat-handoff-PUJYgT/unit-tests.txt):
  **205/205 passed**, zero failed/skipped/cancelled. All product and test/helper
  hashes matched before and after the seven bounded offline suites.
- Baseline and both post-edit focused runs of
  `node --test test/chat-conversation.test.js test/chat-integration.test.js`:
  **67/67 each**, under a 120-second timeout. No baseline failure.
- Editor diagnostics passed. No browser, layout, keyboard, accessibility,
  rehearsal or video verification is claimed for this revision.

Pinned reproduction:

```sh
node scripts/test-chat-handoff.js browser-artifacts/demo/snapshot-c6339f52-f4d3-49f9-94ae-b4159e686f31/snapshot.json 4a77796cb2ec5dde5fb81e62080e03fc3436c8be0e09ef09ba4e0403eb4b4def
```

### Exact copy and preserved behavior

Invalidated activity history now says `Earlier suggestions`, replacing
`Previous search retired.` in the prior snapshot. The initial HTML and the sole,
unconditional runtime composer placeholder are `Message Family Copilot...`.
The composer remains empty on initial load/reset. No scenario text is prefilled
or automatically submitted. Other input fields and unrelated warnings are unchanged.

The original working tree already had a partial copy revision (`Let's look at
some other ideas.` and several state-specific composer prompts). This correction
replaces only those in-scope strings and their test expectations; unrelated dirty
work is preserved. Existing regressions also verify stale card IDs/result removal,
late-result fencing, unchanged typed queries, explicit invitation consent,
pending response, demo labels, source uncertainty and calendar coverage.

### Comparison With Prior Product and Media

Compared every asset with the prior Builder snapshot
`257e1b1fe2721cc66ad8f99b8d1945f6541061b3f10a8bd4d5c000bd2eaa6aa7`
in `snapshot-320af2d1-200d-462c-b47d-0c5f0a9fd192`. Exactly three assets differ;
the other 22 hashes and the embedded five-scene Builder scenario are identical.
The complete three-file diff contains only the history label and placeholder edits.

| Product path | Prior SHA-256 | New SHA-256 |
| --- | --- | --- |
| [chat/conversation-core.js](../chat/conversation-core.js) | `9a23c008ca8dafe8b14730b754c7ea5305519d68535a679f1542ef66262a689e` | `750351a47c677df651930df35f8478c1bbecd43cfc9bee8b8b2aeb8104973133` |
| [chat/ui.js](../chat/ui.js) | `99b7055c3ecb454d031c07869675b798b538511684fb1928f83cc1fbf03265a5` | `9572e63241bb48c34e0f5fb89b330cb3b1eab66420197dd1e111c947f73ed9e3` |
| [chat/index.html](../chat/index.html) | `4306702140b88dc4c748c0615a3fe852d14a7a0df67d176c92e583339d5b608c` | `e287d7560275156df36467f956a0943bff7269e8057b6c6b6430940f278412ee` |

Read-only verification of the existing
[nine-scene media snapshot](../browser-artifacts/demo/invitation-story-20260921/snapshot/snapshot.json),
SHA-256 `2510b73c3f1fc1fbf2570f7a20d5325dfd5bca7e0c12150b98cbf7ac5bc8c058`,
confirmed all 25 product hashes equal the prior Builder handoff. Its scenario and
media files were not edited. Its four typed inputs remain supported unchanged:

1. `What could we do together in October?`
2. `Could we do something sooner, like this weekend?`
3. `Can you check my schedule for the school meeting?`
4. `Yes, one parent is enough. Please send Mike an invitation.`

The exact invitation offer and result below remain unchanged, including
`No real invitation or calendar change.` and Mike pending response. Producer can
retain the nine-scene scenario when preparing a new media snapshot from these
frozen product assets. The new Builder snapshot still embeds its five-scene test
specification; it must not be mistaken for the nine-scene media scenario. New
visual framing and rehearsal must use the new bytes, not old footage or evidence.

### Owned Paths and Remaining Limits

Changed only the three product files above,
[test/chat-conversation.test.js](../test/chat-conversation.test.js),
[test/chat-integration.test.js](../test/chat-integration.test.js),
[docs/chat-integration-contract.md](chat-integration-contract.md),
[docs/designer/README.md](designer/README.md), and this handoff. The scenario,
browser runner and all helpers remain unchanged. Generated files are confined to
the fresh snapshot and unit-evidence directories linked above.

No unresolved offline product failure was observed. Browser/parent usability and
provider behavior remain unverified. Source completeness, movie showtimes, game
end, ticket prices/stock, travel and public image rights retain their existing
limitations. This is a product-copy handoff, not a completed new video.

## Historical handoff: 20 September 2026

This section supersedes the historical handoff below. The owner approved offline
product changes, bounded Node tests and a fresh immutable snapshot only. Producer
files, production scripts/tests/media and the shared localhost:34393 preview were
not touched. No browser, service/restart, provider call, real invitation/calendar
write, capture, TTS, install, delegation, commit or push was performed.

### Pinned assets and evidence

- [New snapshot manifest](../browser-artifacts/demo/snapshot-320af2d1-200d-462c-b47d-0c5f0a9fd192/snapshot.json)
- SHA-256: `257e1b1fe2721cc66ad8f99b8d1945f6541061b3f10a8bd4d5c000bd2eaa6aa7`
- 25 static assets, read-only files in a fresh private directory; exact source
  hashes are in the manifest and [unit report](../browser-artifacts/chat-handoff-Si9K6Z/unit-report.json).
- [Five-scene Builder scenario](chat-handoff-scenario.json) is embedded in the
  snapshot. Use the embedded scenario and frozen bytes, not later working assets.
- [Full bounded test output](../browser-artifacts/chat-handoff-Si9K6Z/unit-tests.txt):
  **203/203 passed**, zero failed/skipped/cancelled. Source and test/helper hashes
  matched before and after execution. Packaging alone is not testing.
- Exactly six product assets differ from the prior pinned `2ecadd6c...` snapshot:
  the six product paths listed below. Other assets, including fixtures and
  standalone availability code, are unchanged. No coverage was widened.

Executed pinned verification command:

```sh
node scripts/test-chat-handoff.js browser-artifacts/demo/snapshot-320af2d1-200d-462c-b47d-0c5f0a9fd192/snapshot.json 257e1b1fe2721cc66ad8f99b8d1945f6541061b3f10a8bd4d5c000bd2eaa6aa7
```

This invokes `node scripts/test-workflow.js chat`: the seven explicit contract,
conversation, integration, Calendar, activity-search, cards and date-selection
unit files, with the existing 120-second bound. No production/browser suite ran.
Receipt-only verification without running tests:

```sh
node scripts/demo-snapshot.js --verify browser-artifacts/demo/snapshot-320af2d1-200d-462c-b47d-0c5f0a9fd192/snapshot.json --sha256 257e1b1fe2721cc66ad8f99b8d1945f6541061b3f10a8bd4d5c000bd2eaa6aa7
```

### Exact supported school dialogue

1. Debby: `Can you check my schedule for the school meeting?`
2. Copilot: `Your work meeting overlaps by half an hour. Mike's calendar looks clear then. If only one parent needs to attend, shall I invite him? Demo invitation to Mike: Kimi's school meeting, Friday, October 16, 2026, 3:30-4:30 PM (Asia/Taipei).`
3. Debby: `Yes, one parent is enough. Please send Mike an invitation.` The shorter
   `Yes, please send Mike an invitation.` is also supported in this context only.
4. Copilot: `Demo invitation sent to Mike for Kimi's school meeting, Friday, October 16, 2026, 3:30-4:30 PM (Asia/Taipei). Waiting for his response. No real invitation or calendar change.`

The school story ends at this pending action, not another proposal or asking
Debby to contact Mike. The supporting status reads `Demo invitation / Mike pending
response`. A stable page-local ID, `demo-school-meeting-mike-20261016`, identifies
the single record; duplicates do not create or send another invitation. Mike's
response remains pending. The busy-only timeline retains Debby's conflict, since
an invitation is not attendance confirmation. No reminder feature was added.

Both calendars are checked immediately and revalidated on explicit send. Bare Yes,
the old proposal wording, negative/unknown/conditional replies and missing, partial,
stale, unavailable, revoked, conflicting or revised context cannot authorize send.
Cancel/Undo/No/reset/pause/preferences/expiry clear the demo state, never claim a real
invitation was withdrawn. Continue activities closes the school demo without
searching; the next outing message starts/resumes the unchanged two-scene flow.
Meeting messages do not change outing dates, preferences or request budget.

### Copy placement

Main assistant replies use `Here are some ideas for your family.` and
`Explore this movie for the weekend.` Movie cards visibly show `Showtimes
unverified` and `Choose a showtime` (navigation only). The saved-public-source
label reads `Saved public sources / Incomplete shortlist / Availability unverified`.
The main Calendar assessment keeps `Calendar not checked for this weekend` outside
October coverage, otherwise `Calendar fit not confirmed` for unknown timing.
Coverage bounds, timestamps and per-item reasons are under Calendar check details;
card evidence and Saved source scope keep detailed source limitations. These are
controlling chat/card changes, not edits to the standalone availability helper.

### Executed checks

| Command | Result |
| --- | --- |
| `node --test test/chat-calendar.test.js test/chat-conversation.test.js test/chat-integration.test.js` | Baseline 121/121 |
| `node --test --test-name-pattern='^demo invitation requires review' test/chat-calendar.test.js` | First edit: 1 passed, 56 intentionally skipped |
| `node --test test/chat-conversation.test.js` | 30/30 |
| `node --test test/activity-cards.test.js test/chat-conversation.test.js test/chat-integration.test.js` | 75/75; two old copy assertions updated after one initial failure |
| `node --test test/chat-calendar.test.js test/chat-integration.test.js` | 98/98, including new fail-closed send matrix |
| `node --test test/chat-integration.test.js` | 35/35, including visible summary/closed-details assertions |
| Pinned handoff command above | Final 203/203, seven bounded files |
| `node --check scripts/test-chat-browser.js` | Syntax only, no browser execution |

Scenario schema, local documentation links, whitespace and editor diagnostics
passed. Fake-DOM tests do not establish browser layout, keyboard or accessibility.

### Exact changed paths

Product: [chat/conversation-core.js](../chat/conversation-core.js),
[chat/ui.js](../chat/ui.js), [chat/index.html](../chat/index.html),
[owner/chat-calendar.js](../owner/chat-calendar.js),
[owner/chat-calendar-template.js](../owner/chat-calendar-template.js),
[activity-preview/activity-cards.js](../activity-preview/activity-cards.js).

Tests/static browser assertions: [test/chat-calendar.test.js](../test/chat-calendar.test.js),
[test/chat-conversation.test.js](../test/chat-conversation.test.js),
[test/chat-integration.test.js](../test/chat-integration.test.js),
[test/activity-cards.test.js](../test/activity-cards.test.js),
[scripts/test-chat-browser.js](../scripts/test-chat-browser.js).

Builder documentation: [docs/chat-integration-contract.md](chat-integration-contract.md),
[docs/designer/README.md](designer/README.md),
[docs/chat-handoff-scenario.json](chat-handoff-scenario.json), and this handoff.
Generated output is limited to the fresh snapshot and evidence directories above.
Existing dirty changes and older snapshots/media remain intact.

### Remaining gates

Offline implementation and snapshot-bound unit validation are complete. No browser
inspection, visual/keyboard verification, mobile check, rehearsal, capture, media
edit or new video occurred. Old browser evidence cannot verify this snapshot.
No further operational approval transfers to Producer. Next milestone requires
separate approval for desktop verification and Producer rehearsal of this pinned
snapshot. Parent usability, actual provider behavior, movie showtimes, game end,
prices/stock/routes and image public-use rights remain unverified as applicable.

## Historical handoff: superseded three-turn proposal

Date: 20 September 2026. Recipient: Demo Producer. Builder is the sole product
writer; Producer remains read-only on product assets. **Unit-only handoff.**
This replaces the old Mike-conflict/Debby-proposal handoff. The historical
`37f671af9060540cc75fbf0a5eb42eb0c8e4a3e5c43c4fad497fda8b4f3101cc` snapshot and
existing media are unchanged and are not evidence for this revision.

## Fixed product identity

- [Read-only snapshot manifest](../browser-artifacts/demo/snapshot-3d2949bd-81b7-4e07-a0ce-7b268f121918/snapshot.json)
- Manifest SHA-256: `2ecadd6c8d86c82e0a3ae2db9684b0e9d1267d8955f93dcad36a19d6939013fb`
- 25 allowlisted static assets with exact `sourceHashes` in the manifest. No
  private calendars, credentials, caches or media outputs were packaged.
- [Seven-scene specification](chat-handoff-scenario.json), embedded in the manifest.
  Use these frozen assets and embedded scenario, not a later working tree.
- Reference instant: `2026-09-18T12:00:00+08:00`, `Asia/Taipei`. Synthetic calendars
  cover October 2026. Saved public activity facts are not live discoveries.

Offline receipt verification and unit reproduction:

```sh
node scripts/demo-snapshot.js --verify browser-artifacts/demo/snapshot-3d2949bd-81b7-4e07-a0ce-7b268f121918/snapshot.json --sha256 2ecadd6c8d86c82e0a3ae2db9684b0e9d1267d8955f93dcad36a19d6939013fb
node scripts/test-chat-handoff.js browser-artifacts/demo/snapshot-3d2949bd-81b7-4e07-a0ce-7b268f121918/snapshot.json 2ecadd6c8d86c82e0a3ae2db9684b0e9d1267d8955f93dcad36a19d6939013fb
```

## Exact interaction

1. In a fresh conversation, Debby enters `Can you check my schedule for the school meeting?`.
2. Copilot replies `Your work meeting overlaps with the school meeting by 30 minutes. Does only one parent need to attend?`.
3. Debby enters `Yes. Could Mike go instead?`. This establishes one-parent attendance and requests assessment, not a proposal.
4. Copilot replies `Mike has no conflicting events in the loaded calendar. Shall I propose that he attend?`.
5. Debby enters `Yes`. Copilot replies `I propose that Mike attend instead, pending Mike's confirmation. His willingness and travel still need checking. I haven't contacted him or changed any calendars.`.
6. `Undo` or `Cancel` withdraws the proposal. `No` declines; unknown or qualified replies do not consent. New conversation, pause, changed preferences or calendar context also withdraw consent.
7. `Continue activities` closes this exchange without searching. Then `What could we do together in October?` starts the unchanged October 9-11 scene; `Could we do something sooner, like this weekend?` advances to September 19-20 with explicit outside-coverage uncertainty.

Selectors in the scenario: `#chat-input` (type/Enter), `#chat-opening`,
`#chat-messages`, `#coordination-status`, `#coordination-timeline`,
`#coordination-result`, `#chat-calendar-status`, `#activity-results article`,
`#activity-results img`, `#calendar-assessment`, `#chat-options-toggle`,
`#chat-reset`. The old checkbox/proposal/Undo-button selectors are not supported.
Schema and static selector anchors passed; browser execution and framing did not run.
An editorial "Another user story" separator is not a product chat message.

## Verified behavior

| Condition | Offline result |
| --- | --- |
| Identity and data | Stable Mike = person 0, Debby = person 1. Debby is explicitly the synthetic current user. Her October 16 15:00-16:00 work interval overlaps the 15:30-16:30 meeting by a computed 30 minutes. Mike's 17:00-18:00 busy interval does not overlap. |
| Calendar presentation | Busy-only timeline, overlap marker and before/after comparison match Debby-to-Mike direction. No raw event titles reach chat or activity requests. |
| Two consent boundaries | Review records revision; one-parent reply assesses Mike; separate Yes proposes. Each boundary rechecks current coverage, freshness, person status and alternate overlap. |
| Fail closed | Partial, missing, stale, unavailable, revoked, changed revision, Mike conflict and expiry block further consent and retire proposals. Meeting-only expiry notifies chat without an activity timer. |
| Fresh-start preparation | No startup query. Exact school question loads only in-memory synthetic fixtures; no activity request, date change or request-budget use. Duplicate loading coalesces; stop/reset/preferences/timeout fence late completion. |
| Withdrawal and activities | Undo/Cancel/No/reset/context invalidation tested. Meeting replies never dispatch activity search; explicit exit preserves both existing outing scenes and limits. |

## Executed evidence

Final **196/196 passed**, zero failed/skipped/cancelled, across seven explicit
offline unit files with the existing 120-second runner limit. The
[unit report](../browser-artifacts/chat-handoff-zviNuh/unit-report.json) pins every
test/helper hash, snapshot SHA-256 and source hashes before/after execution.
[Full output](../browser-artifacts/chat-handoff-zviNuh/unit-tests.txt) records counts.
No product asset changed after packaging. Packaging alone is not testing.

| Executed unit command | Result |
| --- | --- |
| `node --test test/chat-calendar.test.js test/chat-conversation.test.js test/chat-integration.test.js` | Baseline 112/112; later regression run 120/120 before the final expiry test. |
| `node --test --test-name-pattern='^coordination computes the overlap' test/chat-calendar.test.js` | First edit: 1 passed, 51 intentionally skipped. |
| `node --test test/chat-calendar.test.js` | Calendar slice: 52/52. |
| `node --test test/chat-conversation.test.js test/chat-integration.test.js` | Dialogue slice: 62/62. |
| Focused expiry command below | 4 passed, 87 intentionally skipped. |
| Pinned `test-chat-handoff.js` command above, invoking `node scripts/test-workflow.js chat` | Final 196/196, including all new tests. |

```sh
node --test --test-name-pattern='^meeting-only expiry|^coordination requires|^fresh Debby school|^school meeting is a conversation' test/chat-calendar.test.js test/chat-integration.test.js
```

Final runner files: `test/chat-contract.test.js`, `test/chat-conversation.test.js`,
`test/chat-integration.test.js`, `test/chat-calendar.test.js`,
`test/chat-activity-search.test.js`, `test/activity-cards.test.js`,
`test/date-selection.test.js`. All are unit tests; VM/fake-DOM integration is not
a browser. Editor diagnostics, scenario schema/static anchors and scoped whitespace
checks also passed. No unrestricted test discovery or production suite ran.

## Exact changed paths

- [chat/conversation-core.js](../chat/conversation-core.js)
- [chat/ui.js](../chat/ui.js)
- [owner/chat-calendar-fixtures.js](../owner/chat-calendar-fixtures.js)
- [owner/chat-calendar.js](../owner/chat-calendar.js)
- [owner/chat-calendar-template.js](../owner/chat-calendar-template.js)
- [test/chat-calendar.test.js](../test/chat-calendar.test.js)
- [test/chat-conversation.test.js](../test/chat-conversation.test.js)
- [test/chat-integration.test.js](../test/chat-integration.test.js)
- [docs/chat-integration-contract.md](chat-integration-contract.md)
- [docs/designer/README.md](designer/README.md)
- [docs/chat-handoff-scenario.json](chat-handoff-scenario.json)
- [docs/chat-builder-handoff.md](chat-builder-handoff.md)

Generated outputs are only the new snapshot directory and new unit evidence
directory linked above. Existing dirty work, snapshots and media were preserved.
No Producer scripts, production tests or media/workflow records were edited.

## Limits and next step

- Bounded exact dialogue only, not general NLP or proactive/background monitoring.
- Mike's willingness, travel and confirmation remain unknown. No one was contacted;
  no notification or calendar write exists. Calendar gaps are never free time.
- No browser execution, screenshots, desktop/mobile layout, actual keyboard,
  accessibility, rehearsal, capture or parent usability verification this turn.
  Old browser evidence must not be reused for this snapshot. The unchanged browser
  runner still has historical meeting assertions and needs a scoped update/review
  before it can validate this dialogue.
- Film showtimes, game end, numeric ticket prices, stock and routes remain unverified.
  Existing imagery has unconfirmed public-use rights; internal review only.
- Producer's production record still says product handoff pending because it was
  explicitly read-only this turn. Producer can reconcile it against this handoff;
  that discrepancy is not evidence that the new product assets were rehearsed.
- Implementation and offline packaging are complete. No unconsumed browser,
  service, private-data, network, recording, TTS, publication, commit or push
  approvals transfer. Next: separately approve scoped desktop verification and
  Producer rehearsal of this exact snapshot; return product blockers to Builder.