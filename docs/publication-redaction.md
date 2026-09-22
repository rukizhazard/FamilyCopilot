# Repository Name Redaction

Date: 22 September 2026. **Not ready for public publication.**

## Completed Scope

The requested mapping was applied to publishable display text: the first parent
(including the original full-name form) is Parent A, the second is Parent B, and
the child is Child. Family avatars are A, B and C. Age 7 and behavioral fixtures
were not changed. Parent indices, explicit invitation consent, expiry, cancellation,
busy-only disclosure, unknown coverage and HTML escaping remain intact.

Builder was the sole writer for this pass. Existing user/Producer changes were
preserved; the previously anonymized [design draft](designer/preferences-review.html)
was not rewritten. Changes cover chat and owner presentation, associated tests and
browser assertions, public scenarios, tracked documentation, the Calendar agent's
text references, and production wording. No new dependency or framework was added.

Name-derived paths are now [child import documentation](child-calendar-import.md),
[one-shot enrollment helper](../scripts/enroll-child-once.js), and
[its tests](../test/enroll-child-once.test.js). Public references were updated.
The helper's operational target was NOT changed or executed. Parent-refresh report
keys are now `parentAChecked` and `parentBChecked`; indices and auth targets are unchanged.

## Historical Evidence

Role labels throughout edited historical prose are editorial substitutions, not
verbatim approval transcripts. They do not imply those names were spoken, approved
or present in past footage. Old snapshot hashes and test counts still describe the
original snapshots, not the changed working tree. No new asset snapshot was created.

The named closing in [speech validation](../scripts/render-complete-demo.js) now
uses the SHA-256 digest of the exact original JSON narration array, calculated from
the previously tracked source before redaction. Changed words, including neutral
substitutions, are rejected. Private request files, WAVs, captions, videos and
immutable snapshots were not read or changed. Positive reuse of the original
private named narration was not executed; offline tests cover rejection and normal
synthetic speech reuse. Future template wording is not approval for new synthesis.

## Remaining Blockers

- [Designer image 3](designer/Designer%20%283%29.png) visibly contains a real family
  name. All nine PNGs were visually reviewed; the other eight did not visibly
  contain the three reviewed names. Original images remain tracked and unchanged.
  No OCR, image rewriting, removal or index removal was performed.
- Legacy child contract/opt-in strings and `person` values remain in
  [child core](../owner/child-calendar-core.js), [workflow schema](../infra/child-calendar.js),
  native/session adapters, task configuration and matching fixtures/tests. These
  participate in deployed schema checks, saved access and source-reference hashing.
  Blind substitution could invalidate existing data or misrepresent identity.
  They remain explicit publication blockers, not a successful privacy exception.
- [Enrollment](../scripts/enroll-child-once.js) retains the exact approved source
  selection criterion. Replacing it with Child would silently target a different
  provider calendar. A separately reviewed private-configuration/migration design
  is required before removing these operational identities from public source.
- Ignored media, private caches and historical requests remain private and may
  retain names and name-derived paths. Do not force-add them. Identifying private
  paths were omitted from public prose without renaming evidence or inventing hashes.
- Git history, commits, author metadata and remote state were not inspected or
  rewritten. Working-tree redaction does not remove names from earlier commits.
- Existing cloud resource/subscription identifiers, local account paths and
  organization/location references were encountered and not changed. This is a
  three-name review, not a credential, all-PII or licensing clearance. No credentials
  or private operational inputs were opened.

## Verification

[Read-only publication audit](../scripts/audit-publication.js) enumerates tracked
and nonignored untracked files, never ignored folders. Invoke it with the review
terms as separate arguments. It reports filenames/line numbers, not matched text;
exit 1 means residual text/path matches or unreadable entries, 2 means audit failure.
Exit 0 is not binary, history or complete privacy clearance. Binary assets are
listed separately. Source digests cover sorted publishable JS/JSON/HTML/CSS paths
and contents; documentation and binary files are outside that digest.

Final code/test/source digest:
`7fd966737b5c1ab522ed430633be8b449eeb832e844dd86c548c24e2e9756b8e`.
The audit computed the same digest immediately before and after the final test run.
This is a working-tree code digest, not an immutable media handoff or approval.

Executed checks:

- `npm run test:production`: baseline 32/32 and final 32/32.
- `npm run test:chat`: final 215/215, including neutral roles, A/B/C avatars and
  unchanged age 7; existing consent, cancellation and disclosure checks pass.
- Final combined run below: **603/603**, 24 explicit files, no failures, skips or
  cancellations, with a 120-second process bound and matching before/after digest.
- `node --check` on 39 changed/new JavaScript files; two JSON parses; 406 public
  Markdown file targets; editor diagnostics on the main touched code; and
  `git diff --check` passed. Link checking deliberately excludes private artifacts.
- Nine PNG blob hashes match HEAD. An initial full-blob comparison exceeded Node's
  output buffer; the completed check used `git rev-parse` and read-only
  `git hash-object` instead. No image bytes or Git objects were written.
- Case-insensitive publication audit: 248 text files, **33 files / 65 matching
  lines remain**, zero matching existing filenames, zero unreadable entries.
  Three old tracked paths are absent because of the documented renames; new neutral
  paths are present but unstaged. Nine binary files are reported separately.

The exact final offline file list was:

```sh
node --test \
  test/chat-contract.test.js test/chat-conversation.test.js \
  test/chat-integration.test.js test/chat-calendar.test.js \
  test/chat-activity-search.test.js test/activity-cards.test.js \
  test/date-selection.test.js test/demo-production.test.js \
  test/real-calendar-demo.test.js test/publication-audit.test.js \
  test/availability-ui.test.js test/owner-presentation.test.js \
  test/child-calendar.test.js test/child-calendar-cache.test.js \
  test/child-calendar-ui.test.js test/child-saved-ui.test.js \
  test/child-sync-ui.test.js test/member-demo-ui.test.js \
  test/our-week.test.js test/quiet-week-ui.test.js \
  test/shared-confirmation.test.js test/week-display.test.js \
  test/enroll-child-once.test.js test/windows-child-sync.test.js
```

The test command was executed via Node `spawnSync` with `timeout: 120000`, not
unrestricted discovery. Server/activation suites were not run. Their changed
negative-test wording received syntax checks only. Temporary synthetic cache/WAV
fixtures in these inspected suites are not real saved data or generated media.

No live operations, network/provider/auth calls, browser/service launches, TTS,
media generation, uploads, package installation, delegation, commit, push or history
rewrite were performed. Browser layout after the longer labels is unverified.
Next gate: approve handling of the original named image and a compatibility-safe
private identity configuration before publication; separately review history.