# A family decision, not a feature tour

## Status and purpose, 18 September 2026

Planning only, requested by the owner while Calendar independently repairs the
calendar experience. This is not implementation, a new query authorization, or a
claim that calendar-aware recommendations already work. Do not change Calendar
files, restart services, synthesize speech or record more footage for this plan.

The owner approved recording real case content locally. Do not replace it with
fixtures, remove errors to simulate success, or publish the recording. Earlier
recordings remain historical; their synthetic calendar scenes cannot establish
this story's real scheduling outcome.

**The viewer should see Family Copilot connect family interests with schedule
evidence, explain a useful option, and leave the decision to the parent.**

Loading calendars is the starting condition, not the story. Suggestions happen
when the parent asks; calendar loading alone does not trigger unsolicited advice.

## Storyboard

**Opening illustration approved for a separate preview:** precede beat 1 with
the [family animation](demo-intro.html): everyday routines give way to the idea of
a weekend together. Its final question leads into the real, already-loaded week.
The animation is emotional context only, never evidence of an actual scheduling
result. Do not repeat the full opening narration again when the product appears.

English lines below are a draft, not instructions to synthesize. Conditional
lines must be rewritten against the actual result before recording.

| Beat | What the viewer sees | Spoken draft | Evidence needed |
| --- | --- | --- | --- |
| 1. A reason to plan | Already-loaded Our week, with the chosen dates visible | “We want to do something together this weekend. What could work around our plans?” | Real authorized calendar view, no login or Sync walkthrough. |
| 2. Family context | A short, readable view of the commitments in those dates | “Our calendars are here. Let's find something we'd enjoy together.” | Loaded calendars and their actual scope/freshness; do not declare everyone free. |
| 3. Shared interests | The parent selects Sports, then Basketball, then the preferred team | After Basketball is visibly selected: “Let's watch basketball. We'd love to see C T B C D E A.” | Real on-screen preference choices, not an inferred persistent family profile. |
| 4. Ask for help | The parent explicitly requests suggestions | “What are our options for these days?” | The request actually initiates the recommendation flow; loading alone does not. |
| 5. The useful answer | A small set of candidates, with one option explained using preference and schedule evidence | If supported: “This game features our team. Family Copilot also shows how its time compares with our plans.” | Implemented comparison, actual source facts, clear missing context. This is the central missing beat today. |
| 6. Make a decision | The parent reviews the reason, time and venue, then chooses a candidate | “This is worth a closer look.” | A genuine reason to consider this option. Do not automatically pick the first card or invent a conflict in another game. |
| 7. Take the next step | Actual click to the official event page, then a brief closing hold | “Now we have something to discuss as a family, and a place to check the next steps.” | Correct official link; no implication of a booking, ticket availability or a calendar write. |

Use a real comparison between two options only if the data naturally supplies
one. If all candidates conflict, or none match the team, show that outcome and
let the parent explicitly change a preference or date. Do not script a perfect
recommendation first and force the data to fit it.

## What makes the answer useful

A proposed recommendation card should answer four questions in plain language:

1. **Why this activity?** It includes the team the parent selected.
2. **What was compared?** The exact activity interval or start time, the selected
   calendars, their covered range and original freshness.
3. **What did the comparison find?** Known conflict, tentative commitment,
   no overlap in the checked interval, or insufficient information. Avoid an
   opaque match percentage or a universal “best for your family” claim.
4. **What still needs checking?** Only the important missing facts for this
   decision, such as a missing calendar, event end time or travel allowance.

Keep the principal reason next to the candidate, not buried exclusively in
Details. Keep provenance and freshness available without narrating technical
implementation details. A material unknown belongs beside the reason it limits.

### Critical distinction: a start time is not an outing interval

The current TPBL adapter returns date/time, teams, venue and official URL, but no
verified end time. A start-time check cannot prove the whole outing fits. Choose
one honest approach before implementing the comparison:

- **Start-time-only check:** label the conclusion narrowly and leave the rest
  of the outing unverified. This is the smallest useful slice.
- **Parent-selected planning interval:** compare the interval the parent chooses,
  explicitly labelled as a planning assumption, not an official game duration.

Do not silently invent a two-hour game or travel time. If an authoritative end
time later becomes available, validate it before expanding the claim. Missing
child-event gaps and parent `free_or_elsewhere` statuses do not establish that
everyone is available. A missing, expired, blocked or stale source must not
produce a verified family-wide fit.

## Current implementation versus the intended demo

Verified from source during this planning pass:

| Area | Current behavior | Demo implication |
| --- | --- | --- |
| Cross-tab context | Selected dates only, via `familycopilot.dates.v1`; no availability transfer | Repairing Calendar alone will not connect scheduling to activity suggestions. |
| Preferences | Team matching, Only preferred teams, and Prefer first already exist | Reuse these. Do not build a scoring system merely for the video. |
| Results | Date/time, venue, teams, official URL; existing explanation of why listed | Useful foundation, but UI explicitly says it is not a calendar-fit check. |
| Recommendation bridge | No calendar comparison in the current activity flow | Needs a separately reviewed cross-feature increment before the intended demo can be truthful. |
| End time | Not in the current normalized game schema | Full-outing fit cannot be claimed from kickoff alone. |

Relevant code: [date handoff](../shared/date-selection.js),
[team ordering and filtering](../shared/basketball-teams.js),
[game normalization](../scripts/basketball.js), and
[current result presentation](../activity-preview/basketball-ui.js).

### Proposed responsibility split, not an edit assignment

- Calendar owns its ongoing repair and the meaning, scope, freshness and
  invalidation of any title-free scheduling evidence.
- Activities owns candidate facts, preference matching and explanation display.
- Builder coordinates the cross-feature contract and its sole writer before
  either side edits shared files. Calendar content must not be added to the
  dates-only storage key or sent to public sources or speech generation.
- Prefer minimal local, short-lived comparison inputs with explicit purpose and
  lifecycle review, not a new persistent profile, cloud service or LLM dependency.
  The existing calendar-access contract does not automatically authorize this
  new cross-feature use. Recording approval is not implementation approval.

## Production and acceptance checklist

- [ ] Calendar owner supplies a ready state; no reload or error suppression is
  used to bypass a cleanup/privacy block.
- [ ] The recommendation bridge is implemented and tested, or the recording is
  explicitly scoped to preference-based discovery rather than the intended demo.
- [ ] The recording shows the current real UI and authorized data, not synthetic
  substitutions or an editorial overlay pretending to be a product result.
- [ ] Basketball is first mentioned in audio, captions and chapter headings only
  after the visible choice; the team is introduced as the parent enters it.
- [ ] At least one explanation visibly connects the preference to a candidate and
  states what the calendar comparison actually establishes.
- [ ] Source times, comparison scope and unknowns support every spoken claim.
  No private event title is needed to explain a conflict.
- [ ] Pause on the useful answer long enough to read it. Reduce setup footage,
  scrolling and cursor travel. Avoid numbered tutorial chapters and extended
  frozen frames added solely to fit narration.
- [ ] Start with a clean establishing view, use close framing for the explanation,
  and end on the actual official page. Preserve important status indicators.
- [ ] Timing follows the decision, not a fixed duration. Use the approved Jenny
  voice and English captions; finalize wording only after the real outcome.
- [ ] Verify audio/caption timing against actions, desktop legibility, video
  decoding and delivered file integrity. Do not claim human audition from
  automated audio checks.

**Next milestone:** agree the smallest comparison behavior and privacy contract,
then implement and verify it independently of recording. A repaired calendar is
necessary, but not sufficient, for the intended end-to-end demo.