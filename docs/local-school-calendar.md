# Local school calendar

## Scope

The owner provided a school-calendar PDF and approved selecting **family-relevant
events**, including parent meetings and a school sports day even where joint
parent/child attendance is not explicit. Five entries were retained: new-student
and parent orientation, two grade-specific parent days, the anniversary sports
day, and a grandparent–grandchild activity. All dates are from the supplied PDF,
not generated samples or current provider verification.

The two-page PDF was extracted locally with PyMuPDF; the five source entries were
also checked visually on page 1. ROC school year 115 maps to August–December 2026
and January 2027. Both pages were reviewed. Staff meetings, maintenance, exams,
routine classes, holidays, kindergarten-only orientation, undated or weekly-range
entries and activities without evidence of family participation were excluded.
No grade or individual attendance was inferred for this family. The reviewed
local manifest records the original text, English translation, source page,
selection rationale, audience restrictions, exact PDF SHA-256 and uncertainties.

## Files and conversion

- The ignored local calendar directory contains the reviewed selection manifest,
  the validated JSON consumed by the app, and an ICS export for other calendar apps.
- [The converter](../scripts/convert-school-calendar.js) accepts three arguments:
  source PDF path, reviewed JSON path, and output directory. It verifies the PDF
  signature and SHA-256 against the reviewed manifest before emitting files.
  It does not automatically classify PDF text. A changed source requires review.
- Outputs are created without overwriting existing files, with mode 0600. Both
  targets are checked before writing, and failures clean up newly created outputs.
  The school PDF, local output directory and extraction environment are ignored
  by Git. They are not static server assets and must not be committed or published.
- ICS uses UTF-8, CRLF, RFC 5545 line folding, stable UIDs, exclusive next-day
  `DTEND`, `STATUS:TENTATIVE`, `TRANSP:TRANSPARENT` and `CLASS:PRIVATE`. Unknown
  times are date-only entries, **not confirmed all-day busy commitments**. No
  alarms, attendees, organizer, scheduling method or invitation action is generated.
  Importing ICS into another application is an owner action, not performed here.

## Use in Our week

1. Open the owner page, then find the separate **School calendar** card below the
   availability calendar. No Outlook confirmation is needed for local school data.
2. Choose the generated school-family JSON from the local calendar directory.
   The browser reads it locally, previews declared source/scope/coverage/count
   and audience restrictions, but shows no event list before explicit Load.
3. Choose **Selected dates** (the existing Start/End controls) or **Whole term**.
  Press **Load local school calendar**. A selected week may have no entries;
  Whole term shows all five, including past entries. Application defaults may
  change independently; school tests use explicit synthetic dates.
4. Date edits hide loaded school details until Load is pressed again. **Remove
   from page**, replacement files, owner Clear, page exit or reload remove the
   school page copy. Original PDF/JSON/ICS files remain until the owner deletes them.

School events are a separate source-labelled list, never merged into Parent A/Parent B
busy slots or saved snapshots. They work for any valid selected 1–7-day interval
within the source coverage, independently of the provider's supported dates.
Empty or outside-term dates do not establish availability. No school content is
stored in browser storage, shared to Activities, sent over HTTP, uploaded to Azure,
queried against a provider, or used as an instruction. Only two generic JS assets
were added to the server's exact static allowlist; no data/PDF/file-upload routes.

## Validation and limitations (16 September 2026)

- Earlier full offline checkpoint: **460 passed, 0 failed**. Initial baseline was 403/404 with
  one concurrent/pre-existing failure; a later pre-core-test baseline was 423/423.
  No unrelated fix was made to claim that earlier failure was repaired here.
- The latest full-suite rerun was stopped after more than six minutes with
  owner-server tests still running; it is not a final full-suite pass. An older
  concurrent run was also stalled and was left untouched. No server-test fix
  is claimed by this school-calendar increment.
- 37 core/converter tests and 18 UI tests use synthetic fixtures only. They
  passed with `TZ=America/Los_Angeles` (55 passed, 0 failed). The UI fixture
  dates are explicit so application-default changes cannot alter expectations.
  Coverage includes schema/size/date validation, source hash mismatch, UTF-8 ICS escaping
  and folding, date boundaries, deterministic output, no-overwrite/partial-output
  behavior, preview/Load gating, late file reads, date edits, replacement/removal,
  unknown attendance, literal untrusted text, and zero network/storage calls.
- Synthetic browser review on isolated port 8017 verified metadata-only preview,
  keyboard Load/focus, whole-term and selected-date views, no-match state, date-edit
  hiding/reload, removal and measured 319px mobile fit without page overflow.
  No API requests were made. Actual PDF entries and generated output were checked
  locally, but the embedded Windows browser could not access the WSL file chooser
  path. Synthetic browser File objects tested the UI; real file-picker selection
  remains an owner step, not a claimed automated success.
- Existing live service metadata reported safe idle and both school script assets
  returned HTTP 200. No restart was necessary or performed by this increment.
  No real schedule/snapshot reads or clears, cloud operations, commit or push.
- PyMuPDF was installed for local document extraction only, not as an app runtime
  dependency. No document was uploaded. Parent usability and actual attendance
  confirmation remain separate from these tests.