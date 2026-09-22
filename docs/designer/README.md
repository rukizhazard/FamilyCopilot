# Family Copilot design reference

## Publication review, 22 September 2026

Parent A, Parent B and Child below are editorial aliases for the original people,
not their names or a claim that original approvals used those words. All nine
reference PNGs were visually reviewed again: image 3 retains a real family name;
the other eight did not visibly contain the three reviewed names. No image was
modified or removed. Historical hashes remain historical. The neutral HTML draft
and product text are not evidence that old media was anonymized. See the
[publication blockers and validation](../publication-redaction.md).

Reviewed visually: 19 September 2026. All nine PNGs currently in this directory
were inspected, not inferred from filenames. There is no image 1 in this folder.
This is a textual reading of the supplied designs plus subsequent owner decisions,
not a claim that every depicted capability exists or is authorized.

Use this reference before changing the parent-facing experience. For the current
chat implementation, also consult the [chat design handoff](../activity-search-component.md)
and [integration contract](../chat-integration-contract.md). Product permissions
remain in the [product and privacy plan](../parent-schedule-activity-discovery.md).
Newer explicit owner decisions below take precedence over older presentation ideas;
neither screenshots nor this document grant new data access or live operations.

## Whole-month calendar and invitation motion, 21 September 2026

The owner approved integrating the read-only monthly concept into the product,
repairing first-typing jitter and showing a short invitation-preparation animation.
This supersedes the earlier open-day-track default, not its availability or privacy
contract. October now uses five actual weeks. Parent markers say `Busy periods`,
never all-day/unavailable; the note explains that only parts of a day are occupied.
Child's loaded October 3, 4, 9 and 16 events show permitted names/times. All-day,
cancelled and unknown states stay explicit, redacted events stay Busy-only, and
names still use the private DOM renderer rather than crossing the title-free bridge.
Day/member/candidate controls remain functional and explicitly open detail tracks.
No user controls or conversation content automatically collapse.

After Parent B's exact consent, the actual product displays the existing polite
`Preparing Parent A's invitation...` status and spinner during a cancellable 700ms
page-local preparation interval. Reduced-motion retains the status without motion.
Calendar is synchronously revalidated afterward; the only successful result is
`Parent A pending response`, never sent/delivered/accepted. Existing source Details
retain the no-delivery qualification. No new source facts, fixture, network,
persistence, private calendar access or provider behavior was introduced.

The original 25-asset snapshot reproduced 22px desktop scroll at first typing,
without composer resizing. Correct idle scroll padding eliminates that scroll;
mobile still scrolls an offscreen input into view normally. Isolated 1440x900 and
390x844 browser checks passed for month content, no page overflow/clipped cells,
keyboard day details/focus, preference save/cancel, reset, animation and reduced
motion. Mobile uses a horizontally scrollable month, not unreadably narrow cells.
Final focused **228/228** and bounded chat **214/214** checks are bound to the
[25-asset handoff](../chat-builder-handoff.md), SHA-256
`c626ab54ed20895f53ea6b458e6e6a2fde904fdca0e9f7b37fe2830c939c0a61`.
Four restored original images are unchanged, superseding earlier missing-image
status. Producer owns the separately authorized video revision with existing
narration; Builder did not touch media/shared services, install tools or delegate.
Parent usability, physical-device/assistive-technology review and image rights
remain separate limitations, not established by automated checks.

## Preferences product integration, 21 September 2026

After reviewing the equal-interest draft, the owner explicitly approved applying
it to the actual chat product and isolated offline desktop/mobile verification.
The family now has prominent initial avatars, names and Parent/Child roles.
All seven default interests share one grid, 40px icons, the same 750 weight and
17px desktop / 14px mobile labels. No primary/secondary tiers or automatic
conversation collapse were added. Defaults remain editable; unknown interests
use the existing neutral plus icon, and arbitrary team names stay literal text.
Known team typography and bilingual names derive from current preference state,
not the screenshot. Location is secondary. Existing edit buttons, editable form,
Apply/Cancel, custom values, reset, explicit suggestion updates and real Send
remain operational; the static draft's disabled controls were not copied.

The bundled font and draft's existing vector paths are reused without downloads
or dependencies. Four accepted missing third-party images remain missing and
use existing product fallback. Calendar order, source facts, processing actions,
Child ownership, consent, dates and domain fixtures are unchanged.

Executed: 39/39 focused integration tests and 211/211 bounded chat checks, then
211/211 bound to the final read-only snapshot. Isolated in-memory browser routes
passed at 1440x900 and 390x844, with keyboard, preference save/cancel/custom/team,
first query, update/reset/focus and scroll-end composer clearance checks. Exact
default interest styles/geometry match at each viewport; no horizontal overflow,
preference-item overlap, forbidden I/O or page errors. Final opening and result
screenshots were visually inspected. No server, shared tab, private data,
provider, recording, TTS or install was used. The [current Builder handoff](../chat-builder-handoff.md)
pins source hashes, screenshots, reproducible checks and preserved failed attempts.
Parent usability, physical-device/assistive-technology review and any media work
remain separate gates. The static record below is historical, not current scope.

## Preferences static review, 21 September 2026

The owner approved a [standalone static draft](preferences-review.html) for review
before any product integration. This supersedes only the earlier statement that
no preference redesign was approved; chat behavior and its existing UI are unchanged.
Owned deliverables are this entry and that self-contained HTML. Producer files,
product code, fixtures, tests, contracts and ignored third-party images are untouched.

The draft promotes Parent A and Parent B as parents and Child as their child, age 7,
consistent with the current integration contract and existing preference markup.
These are real people, not invented identities; no private schedules are included.
Shared interests are not assigned to individual people. The owner's later decision
keeps the page hierarchy but removes within-interest size tiers: all seven interests
share one responsive, equal-weight list with matching icon dimensions, font size,
weight, alignment and spacing. No favorite ranking is implied. Team initials are
typographic fallbacks, not official logos; no replacement images were sought.
Existing brand colors, Nunito Sans and bundled Lucide paths are reused offline,
with bundled notices embedded in the HTML. Sport/activity symbols are inline
vectors, avoiding missing emoji glyphs without downloading replacement assets.

This is a static visual proposal, not an operational chat: Preferences expands
read-only values, the textarea permits local typing, and Send is disabled.
There is no script, search, calendar access, saving, persistence or message delivery.
Reload discards typed text. Optional automatic post-conversation collapse is not
approved or implemented. Review the family hierarchy, shared interests, team
recognition, secondary location/settings and composer before authorizing integration.
Desktop/mobile static screenshots are separately permitted for this draft only;
they do not approve product browser scenarios, recording or parent usability.

Executed for this revision: isolated offline Chromium at 1440x900 and 390x844;
all seven computed styles and item geometry matched at each viewport. Icons are
40x40px, weight 750; desktop labels are 17px and mobile labels 14px. Page overflow,
text clipping, overlaps, expanded settings, keyboard expansion, local typing,
disabled Send and reload checks passed. Both final screenshots were visually
reviewed; mobile scrolls to the composer. No listening server was used: each
viewport fulfilled two fixed in-memory document requests (load and reload), with
zero external requests, resource-timing entries, scripts, linked stylesheets or
page errors; the bundled font loaded and all seven inline icons resolved.
The browser closed. Source SHA-256:
`c73b3096a59362228590b22378fc7c1d0d85aafe15c1535926bff91171debe74`.
Fresh source-bound results, four screenshots and the adapted helper are in the
ignored `browser-artifacts/preferences-equal-interest-review-20260921-9BWcld/`
directory. Earlier evidence is preserved, including two failed helper checks
for visible font/rotated-icon overhang, corrected without changing those surfaces.
This consumes only the static-preview browser scope, not integration approval.

## Latest source-label decision

The owner's later 21 September 2026 decision rejects repetitive visible Demo
wording and the standalone invitation label. This supersedes those presentation
requirements in earlier entries below, not consent or source truth. Keep
`Sample calendars` in the Calendar header. Remove `#meeting-disclosure`; do not
replace it with repeated Invitation preview labels. Chat's existing `Details`
keeps sample dates, saved-public provenance, no live search/AI, fixed-dialogue
limits and uncertainties without a replay/invitation instruction paragraph.

Calendar's existing closed `Details` states: `Invitations use sample data and
stay on this page. No invitation is delivered and no calendars are changed.`
The static source fact remains available after No, Undo, stale context or return
to activities and when the Calendar body is collapsed. Do not remove this truth
or frame the pending exchange as real delivery. No overlay, cropping or fixture
substitution is an acceptable presentation fix.

Progress is `Preparing Parent A's invitation...`; the pending Calendar status is
`Parent A pending response`. Its result awaits his response without a sent/accepted
claim. Keep the note that Parent A's response and travel are not confirmed. Child
remains event owner, parents remain busy-only and explicit consent is unchanged.
Names refer to real people; their schedules here are sample data, not verified
real calendar access. No preference redesign or new operation was approved.

The [current handoff](../chat-builder-handoff.md) records six changed assets,
19 unchanged assets and **210/210** snapshot-bound offline checks. The 11-scene
Producer scenario was read only; scenes 7, 9 and 11 need new assertions.
No browser/rehearsal/capture, intro/movie edit or service operation occurred.
Visual layout, parent usability and any further media operations remain separate.

## Earlier calendar-first decision

The owner's latest 21 September 2026 choice is B: show family members' schedules
first, then shared candidate times. Reuse the existing expanded month overview
and expanded day tracks in that order under `Family calendars`, followed by the
candidate summary. This is a small UI presentation change, not new calendar
access or three unrestricted detailed calendar views. Parents remain busy-only;
Child's permitted sample event titles stay inside Calendar. Missing time remains
unknown and candidate windows are not guaranteed availability.

Progress is `Loading family members' calendars...` followed by
`Finding activities that match your family's interests...`. Saved-public-source
provenance remains visible on activity results. The operation and fixtures have
not changed; no live discovery or artificial loading delay was added.

Replace the long independent simulation sentence with the concise visible
`Demo invitation` label in `#meeting-disclosure`. Keep it with the invitation
exchange and pending response, including cancellation/stale history until reset
or disposal. Calendar DEMO context and existing no-delivery details remain.
Do not alter exact consent, Child ownership, Parent B's overlap or Parent A pending status.
This supersedes the older long-disclosure copy below, not its safety lifecycle.

The [current Builder handoff](../chat-builder-handoff.md) records the fresh
25-asset snapshot, 209/209 hash-bound offline checks and exact existing selectors.
Browser layout/keyboard review, parent usability, Producer 1x continuous-scroll
rehearsal and capture remain unverified and require separate approval. Do not
reuse prior browser/media evidence for this revision or crop simulation labels.

## Latest composer decision

The owner's later 21 September 2026 decision removes Stop from the composer.
Processing shows the current action plus the actual upcoming steps labelled Next,
rather than using an activity-search message for every operation. Calendar loading,
saved activity search, activity-time comparison, school-meeting checks and the
page-local demo invitation have distinct states. Queued steps are not completed
claims. Synchronous steps may finish immediately; do not add artificial delays.
The status live region receives keyboard focus while busy; completion returns
focus to the composer. New conversation and timeout/retry protections remain.
The [integration record](../chat-integration-contract.md) includes 207/207 tests
and the approved isolated desktop review. Prior videos and snapshots are unchanged.

The owner's 21 September 2026 copy correction uses `Message Family Copilot...`
for the initial chat composer, reset and every runtime state. Do not substitute
October/weekend examples or invitation stage instructions into the placeholder.
Actual typed scenario queries remain supported; the input is not prefilled or
automatically submitted. Invalidated activity history is labelled `Earlier
suggestions`, with stale cards removed and context fencing unchanged. Other input
fields, source/coverage labels and explicit demo-invitation consent are untouched.
The [current Builder handoff](../chat-builder-handoff.md) provides the fresh
25-asset snapshot and 205/205 pinned offline tests; no new browser or video review.

## Latest meeting decision

The owner's later 21 September 2026 correction places the school meeting in a
shared or Child calendar, not Parent B's. The implementation uses Child's sample event
as the comparison source, including its October 16 month marker and day details.
Use `Child's school meeting` as the heading and `Child / School meeting` as its
stable timeline row. Parents remain separate busy-only rows and attendance
candidates; proposals/invitations must not change event ownership. The existing
15:30-16:30 Taipei interval, Parent B's 30-minute overlap and Parent A pending response
are unchanged. The [current handoff](../chat-builder-handoff.md) has 209/209 pinned
tests and a new immutable snapshot; browser/visual review remains pending.

On 21 September 2026 the owner approved natural invitation dialogue without
technical `Demo invitation` or no-real-send statements inside messages. The
question explicitly names Parent A, Child's school meeting, Friday, October 16, 2026,
3:30-4:30 PM (Asia/Taipei), and the one-parent condition before asking permission.
The exact explicit-consent replies below remain unchanged; bare Yes never sends.
The response remains awaiting Parent A, not accepted or confirmed attendance.
Simulation/no-real-send facts are continuously visible in the independent
`#meeting-disclosure` status above the composer while meeting context/messages
remain, including cancelled or stale exchanges. Producer must keep it visible
when showing the conversation. Existing Calendar synthetic status remains.
The historical natural-invitation section of the [handoff](../chat-builder-handoff.md)
records that snapshot, updated scenario and 208/208 pinned tests. New visual framing is pending.
This supersedes the older inline demo-disclosure copy below, not consent/privacy.

The owner's latest 20 September 2026 approval replaces the separate one-parent,
Parent A-check and proposal-confirmation turns. The school question now checks both
parents immediately and offers a **Demo invitation** to Parent A, displaying Child's
school meeting on Friday, October 16, 2026, 15:30-16:30 Asia/Taipei before consent.
`Yes, one parent is enough. Please send Parent A an invitation.` or the contextual
`Yes, please send Parent A an invitation.` performs a page-local simulated send.
Bare Yes does not send. Parent A remains pending response, not an accepted attendee;
the timeline keeps Parent B's overlap. Both calendars are revalidated on send;
cancel/reset/pause/expiry/context changes clear only the demo state. No real
contact, calendar write, reminder or persistence was added.

Main assistant copy now leads with the idea and action: `Explore this movie for
the weekend.` Cards retain visible `Showtimes unverified`, `Choose a showtime`,
and saved-public-source/incomplete-shortlist labels. Calendar retains a visible
`Calendar not checked for this weekend` or `Calendar fit not confirmed` summary;
coverage, timestamps and per-item reasons are available under Calendar check
details. No widened fixtures or claims of confirmed screenings/calendar fit.
This revision has offline unit evidence only. The updated
[Builder handoff](../chat-builder-handoff.md) pins its exact assets and scenario;
earlier browser/media records do not verify this revision.

Historical, superseded three-turn implementation:

The newer bounded implementation on 20 September 2026 supersedes the role direction
below: Parent B is the synthetic current user, her 15:00-16:00 work interval overlaps
the 15:30-16:30 school meeting by 30 minutes, and Parent A is the alternate. The exact
opening `Can you check my schedule for the school meeting?` works in a fresh chat.
`Yes. Could Parent A go instead?` establishes the one-parent condition and assesses
Parent A, but does not propose him. A separate `Yes` creates a proposal pending Parent A's
confirmation; willingness and travel stay unknown. Undo/Cancel/reset/context changes
withdraw it. Meeting replies do not search activities or change dates or budgets.
This increment has offline unit evidence only, not new browser or parent approval.
The [Builder handoff](../chat-builder-handoff.md) identifies the new snapshot.

Historical conversation decision, with superseded attendee direction:

On 20 September 2026 the owner explicitly rejected the one-parent checkbox and
proposal/Undo buttons as inconsistent with a conversation. The existing composer
now carries the question, explicit Yes/No decision and Cancel/Undo withdrawal.
The busy-only timeline remains supporting evidence inside Calendar. Parent B is only
a proposed attendee, pending her confirmation, willingness and travel checks;
there is no contact or calendar write. Unknown replies must not imply consent.
Continue activities explicitly leaves this bounded scripted exchange without
triggering a search. The next outing message resumes the existing two-scene demo.
This supersedes earlier form-control descriptions, not privacy or provider gates.
See the [current integration record](../chat-integration-contract.md) for executed
tests, desktop evidence and the distinction from older frozen media.

## Product intent

Family Copilot reduces the parent's coordination work across work, school,
activities and interests. It should answer the parent's question with an organized,
useful result and a small number of relevant next actions. It is not a collection
of developer controls or a form the parent must configure before every question.

The repeated story is: understand the situation, bring together relevant facts,
explain what matters, and offer a next step. The parent remains the decision maker.
Preference-driven opportunities belong alongside responsibilities, not behind a
separate activity-search application. The design's desired proactive assistance
does not imply approval for background polling or unsolicited notifications.

## Image-by-image reading

### Image 2: fragmented information

Source: [Designer (2).png](Designer%20%282%29.png).

- Headline: "So many places. Too much to track." Supporting line: "Things get missed."
- Separate surfaces show a work calendar, school announcement, activity registration,
  baseball ticket sale and reminders. A worried family appears below them.
- Work entries include Team Sync, Client Call, Project Review, 1:1 with Manager and
  Budget Review. The school example is a parent-teacher meeting at Lincoln Elementary.
- Science Camp has a registration deadline; baseball has both a sale time and a
  game time; reminders include pickup, gifts and groceries.
- Meaning: the problem is scattered information and missed decisions, not lack of
  another calendar grid. Event time, sale time and registration deadline are distinct.
- These are fictional slide facts, not actual family data or valid runtime dates.

### Image 3: a prioritized overview

Source: [Designer (3).png](Designer%20%283%29.png).

- Left navigation: Home, Calendar, Events, Inbox, Interests, Family, Settings.
- Main greeting addresses Parent B and introduces three things needing attention.
- Three broad rows show a meeting conflict, an approaching Science Camp deadline
  and an upcoming baseball ticket sale. Each has a category/status icon and chevron.
- Red/peach conveys conflict, yellow deadline urgency, lilac an opportunity.
  A sun and friendly robot soften the presentation.
- Meaning: prioritize and summarize before asking the parent to inspect details.
- The seven-item sidebar is an earlier navigation concept, not a requirement to
  add seven screens to the currently approved single-conversation experience.

### Image 4: explain a detected conflict

Source: [Designer (4).png](Designer%20%284%29.png).

- A school announcement is shown as understood and added to the family calendar.
- The school event leads into a conflict panel comparing a 3:30-4:30 parent-teacher
  meeting with a 3:00-4:00 work meeting. A timeline makes the overlap visible.
- Meaning: a conflict should be understandable from the actual overlapping times,
  not merely a warning color or unexplained score.
- The depicted automatic calendar write and conflict inference are future concepts,
  not implemented chat behavior. Work titles must not leak between parents.
- Artwork contains inconsistent icon/category choices; do not copy such artifacts
  as a semantic rule or use the slide's date/weekday combinations as fixtures.

### Image 5: let the parent choose a response

Source: [Designer (5).png](Designer%20%285%29.png).

- The two conflicting events remain visible beside suggested actions.
- Choices are rescheduling work, coordinating with a spouse/another parent, or
  deciding later with a reminder. Each option has an icon, short explanation and chevron.
- Meaning: recommendations support a decision; they do not silently take the action.
- Scheduling writes, contacting family and reminders require their own authorization
  and implementation. Do not create nonfunctional buttons implying these work today.

### Image 6: interests drive a concrete opportunity

Source: [Designer (6).png](Designer%20%286%29.png).

- "Your Interests" visibly names Baseball, Concerts, Running and Family Activities.
  Baseball has the emphasized green check; the other checkmarks are muted.
- A stadium image anchors a baseball ticket card. It explains the family match,
  ticket sale time, opponent, game date/time and venue.
- A separate action area offers a reminder for the ticket sale. A green strip claims
  no schedule conflicts.
- Meaning: show recognizable interests and connect them to an illustrated, specific
  suggestion. "Open to ideas" alone loses that personalization signal.
- The image does not specify Basketball or Movie as this parent's interests; those
  are explicit owner choices recorded below, not facts extracted from this image.
- An interest is a positive preference, not automatically a hard exclusion of every
  other category. A stadium image is not proof of event identity or image licensing.
- Ticket availability, reminder delivery and schedule fit need real evidence before
  making the depicted claims. Current chat shows unknown/not-checked states instead.

### Image 7: event details and deadline are separate

Source: [Designer (7).png](Designer%20%287%29.png).

- Science Camp uses a prominent activity illustration and a concise event date.
- Registration deadline is visually emphasized separately, with a relative countdown.
- The actions are an external registration site and a reminder tonight at 8 PM.
- Meaning: help the parent distinguish when an activity happens from when a decision
  is due, and keep the action close to the relevant details.
- The depicted schedule-fit badge is not an acceptable default when calendars are
  incomplete or unchecked. Relative deadlines need an explicit real reference instant.

### Image 8: conversation is the front door

Source: [Designer (8).png](Designer%20%288%29.png).

- The parent asks: "What does our family need to take care of this week?"
- Copilot responds "Here's what I found." Results are structured into "Needs
  Attention" and "Coming Up", containing the conflict, camp deadline and baseball sale.
- A compact sidebar names Family Copilot, Calendar, Events and Reminders; a robot
  accompanies the assistant's response.
- Meaning: the question itself initiates assistance. Structured results are part of
  the answer, not a second form or a separate application to launch.
- This image does not depict the currently embedded month calendar or specify a
  composer implementation. Those are later owner-confirmed choices, not pixel facts.
- The current scripted interpreter does not understand this general weekly question;
  that gap must remain explicit until a real interpretation capability is approved.

### Image 9: one experience, multiple specialties

Source: [Designer (9).png](Designer%20%289%29.png).

- School Agent handles events/announcements; Work Agent calendars/meetings;
  Activities Agent registrations/deadlines; Interest Agent tickets/recommendations.
- These feed a Family Timeline, then "Reason + Coordinate", then
  "Recommend + Remind + Act".
- Meaning: specialized sources contribute to one coherent family experience.
  The parent should not have to manage agent execution or route each request.
- This is a conceptual architecture, not evidence of four deployed agents or permission
  to combine private raw calendars into a shared model context.

### Image 10: positioning and emotional tone

Source: [Designer (10).png](Designer%20%2810%29.png).

- "Your AI Chief of Staff at Home" frames the product as coordination assistance.
- Three promises: one place for everything, AI that understands, right time/right nudge.
- Closing theme: "Less coordinating. More living."
- The family, robot, calendar, sun and landscape communicate warmth and relief.
- Meaning: less operational burden, not more switches, setup steps or diagnostic text.
- This is a positioning slide, not a request to replace the working app with a landing
  page or to claim current AI reasoning, monitoring or reminder capabilities.

## Visual and interaction language

- Light warm surfaces, dark readable text and teal/green identity; lilac, peach and
  yellow distinguish types of content. Red is reserved for a meaningful warning.
- Generous spacing, rounded items and short headings make results approachable.
  Preserve hierarchy without reproducing slide-sized typography inside small controls.
- Use recognizable icons plus text for status. Color alone must not carry meaning.
- Activity media identifies the opportunity; family/assistant imagery supplies warmth.
  Prefer relevant licensed assets or explicitly fictional local artwork.
- Keep a small set of contextual actions. Do not expose test-session machinery as
  the parent's main workflow, or paste every backend status into assistant messages.
- The images are desktop concepts. Mobile layout, focus order, touch targets, wrapping,
  loading, empty, error and incomplete-data states require implementation decisions
  and separate verification; the images do not specify these states.
- Do not blindly reproduce slide inconsistencies, dates, invented venues, nested
  panels or every sidebar. Preserve intent under the current approved UI constraints.

## Current owner-confirmed chat decisions

These decisions come from the September 19 conversation, not inferred image content.

1. The visible composer is usable immediately. Sending a message starts the flow;
   there is no Start conversation button and no startup/reload/typing query.
  The owner later approved stage-driven execution, not text matching: the first
  valid submission proposes October 9-11, the next distinct submission searches
  September 19-20, and later input shows demo completion. Messages do not change
  dates/preferences by meaning. Contextual copy explicitly labels the scripted
  behavior. Blank, duplicate and in-flight inputs never skip a scene; failures
  or cancellation require retrying that scene, and reset restarts the sequence.
2. Calendar appears inside the same conversation after the approved synthetic
   trigger. No separate Sync step, duplicate calendar or Calendar/Activities tabs.
3. Suggestions follow the settled Calendar attempt, but do not require its success
  or claim calendar fit. The second scene actually searches the new weekend dates.
4. Stop is contextual while working; retry appears for failures/incomplete results;
   New conversation belongs in the secondary menu. No persistent four-button row.
5. Do not show a standalone scripted reference timestamp or a default activity-date
   banner beside the conversation heading. Relevant dates belong in answers/cards;
   synthetic/scripted provenance remains truthful and visible.
6. Default interests are Basketball, Baseball, Movie, Concerts, Museums,
  Outdoor play and Science & discovery, with other suggestions welcome.
  Ping-pong remains an editable option, not a selected default. The
   internal movie interest remains `movies`; no fake `any` category is added.
7. Show the editable age directly beside Child as Child (7), as explicitly requested
  by the owner. Remove the separate Children block and numbered child marker.
  This is a page-local presentation association only, not a Calendar identity
  lookup, consent decision or new name field in activity requests.
  The owner corrected the default age from 8 to 7 on September 19; initial display,
  activity preference and conversation reset all use 7. Calendar data is unchanged.
8. Family names precede the calendar experience. Parent A/Parent B/Child in the current
   demo are synthetic presentation, not verified permissions or identity mappings.
  Place the family-preferences pencil beside the Our family heading on desktop
  and mobile, not at the far edge of the location/interests row. Its tooltip and
  accessible name are "Edit family preferences". The interest plus stays beside
  the tags; both reuse the existing editor and return focus to their opener.
  The pencil is a light, borderless 20px icon inside a 44px target with a hover
  background. The 40px send button sits vertically centered inside the composer
  input frame, with a separate text column to prevent overlap. Keyboard focus
  remains visible on both controls and the shared input frame.
9. Remove the repeated Synthetic labels and the masthead Demo / Scripted badge.
   Source/evidence details and scripted interpretation limitations remain truthful;
   unknown calendar fit, travel and availability remain visible. Internal synthetic
   identifiers, guards and permissions are unchanged. This does not enable live AI.
10. Interests use plain colored tags without decorative vertical bars. Replace
    "Other suggestions welcome" with a functional plus control opening the existing
    editor. Parents can select categories and enter comma-separated extra interests;
    Apply validates up to 12 distinct interests, at most 40 characters each, and
    does not search. Cancel/Escape restores focus without applying the draft.
    Tags remain noninteractive summaries; explicit exclusions alone restrict scope.
    The owner approved Concerts, Museums, Outdoor play and Science & discovery
    as additional selectable options, then explicitly confirmed that all seven
    interests should be selected by default and visible on the initial page.
    Reload and New conversation restore all seven. New options do not add
    providers or imply verified results.
11. Remove "OUR CONVERSATION", "Time for something together" and the initial
    "Ready when you are." status. The owner's later supplied brand snapshot
    supersedes the interim "Less juggling. More 'that was fun.'" headline:
    use "Family Copilot" and "Your AI Chief of Staff at Home". This is brand
    positioning, not evidence of live AI or newly authorized capabilities.
    Show the brand only once in the introduction, with the sun beside its heading;
    remove the duplicate masthead brand row.
    Keep loading, failure and uncertainty states when relevant, and keep the
    composer immediately usable. No replacement start button.
  12. Replace the visible Starting area title with a decorative location pin and
    Microsoft Taiwan above Xinyi, Taipei. This is an owner-specified display label,
    not verified coordinates or device location. Editing to another area hides
    Microsoft Taiwan. The outbound origin stays district-only, with no landmark,
    geolocation, geocoding or routing added.

## Implementation boundaries and remaining gaps

### September 19 desktop design approval

The owner approved a unified desktop-demo pass; phone layout, touch and virtual
keyboard review are deferred. Existing responsive rules remain but were not
reviewed or expanded in this pass. The latest choices supersede the earlier
separate family/location/interests rows and always-docked initial composer:

- Use "About our family" for one semantic section containing members, the
  district-only location display and all seven default interests. Keep Child (7).
- Remove internal dividing lines. Use a shared spacing rhythm, warm-white surface,
  teal text/actions, blue brand accent and restrained lilac/peach/green details.
- Use locally bundled Nunito Sans and Lucide pencil, map-pin, plus and arrow-up
  icons with consistent 20px geometry. Keep the friendly sun as the brand accent.
  The interest plus follows the last tag rather than occupying a separate row.
- Keep the initial composer immediately below the summary. After the first
  conversation message, dock it at the bottom; New conversation restores inline
  placement. No startup search, extra assistant message or new data flow is added.
- `node scripts/build-chat-font.js` packages the pinned font into existing CSS
  and records font/icon licenses in [third-party notices](../../chat/THIRD-PARTY-NOTICES.txt).
  Browser assets need no external requests; CSP permits embedded font data only,
  while `connect-src 'none'` remains unchanged.
- `node scripts/test-chat-browser.js` now targets desktop by default; optional
  `--all-viewports` retains the previous wider review for separately scoped work.
  This pass used the shared isolated desktop preview for font/icon/layout,
  keyboard editing, inline-to-docked composer and synthetic result visibility.

### Capability boundaries

The current demo has a two-scene scripted conversation, embedded synthetic
Calendar, page-local preferences and reusable illustrated activity results. It is
not yet a general conversational assistant matching every scenario in these images.
Basketball and Movie have synthetic cards; Baseball preference does not create a
verified baseball source. Never fabricate a baseball result merely to fill the UI.

Calendar assessment, real model reasoning, school-announcement understanding,
cross-source conflict resolution, registration, calendar writes, family coordination,
ticket monitoring and reminders remain separately scoped capabilities. Unknown
travel is not zero; missing calendar coverage is not free time. Private calendar
data must not enter chat/model/public discovery just because the design depicts a
unified timeline. No profile/chat persistence is introduced by these preferences.

The approved default interests are encoded in the synthetic demo seed and shared
fixture with `interestBasis: "demo_fixture"`; a later edited interest selection uses
`parent_confirmed`. This describes request provenance, not an inference from calendars.
Existing search treats interests as ranking preferences, leaving alternative
categories eligible subject to explicit constraints and source coverage.

## Review checklist

- Can a parent begin by typing, without a start button or setup form?
- Are concrete interests visible, editable and preserved through date refinement?
- Does the response distinguish responsibilities, opportunities and uncertainty?
- Are dates shown with the relevant answer rather than as unexplained preselected UI?
- Are calendar display, activity search and their permissions kept separate internally?
- Does every availability, fit, travel, deadline and action claim have supporting evidence?
- Are artwork provenance, partial/empty states and unsupported intents honest?
- Can the same flow be used with keyboard and a narrow mobile viewport?
- Is a proposed feature truly approved, rather than merely pictured in a slide?