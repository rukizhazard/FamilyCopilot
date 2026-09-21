# Builder and Demo Producer workflow

Current workflow: 20 September 2026. This is a short operational index, not
permission to run browsers, providers, speech synthesis or shared services.

## Ownership

Builder owns product behavior, domain code, fixtures, product tests and the
[integration contract](chat-integration-contract.md). Demo Producer owns recording,
editing, narration, captions, production tests and media records. Agree exact
paths and a sole writer before shared tooling changes. Calendar and Activities
definitions remain optional technical references; no extra agent handoff is needed.

For each task, read the latest relevant decisions and the controlling code/test.
Do not reread every historical proposal. Preserve other work in the shared tree.

## Bounded checks

| Command | Scope |
| --- | --- |
| `npm test` or `npm run test:quick` | Contract, conversation and dates unit tests |
| `npm run test:chat` | Seven explicit chat, calendar, activity and date test files |
| `npm run test:production` | Two production regression files, no recording or TTS |
| `npm run test:chat -- --list` | Print the exact file list without running it |
| `npm run test:browser` | Separate disposable desktop browser check, approval required |

The first three commands use a 120-second process timeout. No unrestricted test
discovery, service activation suites or browser work is included. They are not
full-project coverage. Add an affected domain's focused tests when needed.
Mobile (`--all-viewports`) is opt-in. Do not use unrestricted `node --test`.

## Immutable handoff

1. Builder and Producer agree the exact scenario, data scope, reference instant,
   expected controls/results and limitations. Review the
   [example scenario](demo-scenario.example.json); it is a draft, not a passed
   browser test or capture authorization. It covers the two outing turns only.
   Add the separate meeting-conflict story only after its actions are reviewed.
2. `npm run demo:snapshot -- docs/demo-scenario.example.json` writes a fresh
   private directory and prints its snapshot manifest path. It copies only the
   chat HTML, directly linked JavaScript/CSS and explicitly listed `extraAssets`.
   List nested CSS fonts/images/imports explicitly; no recursive repository copy.
   Do not include private files, caches or credentials. Static asset extension
   filtering is not a privacy review. Concurrent export-time changes fail the check.
3. `npm run demo:verify -- <snapshot.json>` checks every bundled asset hash and
   prints the manifest SHA-256. Review and pin that hash in the handoff together
  with exact verification command/results and limitations. Unpinned verification
  reports `reviewedHashMatched: false`: it proves internal integrity only.
  On receipt, run `npm run demo:verify -- <snapshot.json> --sha256 <reviewed-hash>`
  to compare with the handed-off identity, entirely offline. Packaging alone
   records `browser: not_run`, not a successful review. Unit tests on the working
   tree must not be presented as browser evidence for a snapshot.
4. After separate capture approval,
  `npm run demo:record -- <snapshot.json> --sha256 <reviewed-hash>`
   records from in-memory snapshot bytes in a disposable browser with network
   and persistence blocked. No listening server or shared tab is used. It records
  the manifest hash and scenario, and rechecks the bundle on completion. A missing
  or mismatched reviewed hash stops before loading recording tools or launching
  a browser. Later Builder edits cannot invalidate this capture. Snapshot
  tampering still fails even if its internal asset hashes have been rewritten.
5. Producer reports product blockers to Builder with reproduction steps and
   expected behavior. Never edit the product or replace its answers for filming.

Under scoped rehearsal approval, append `--review-scenes` to the recording command
to execute the same actions and save all scene screenshots without a video. Review
decisive frames before recording; `--review-frame` checks only the opening. Neither
option grants browser approval. Use the same reviewed snapshot hash for capture.

Snapshot files are read-only and content-hashed, not a cryptographic attestation.
Compare the manifest digest with the reviewed handoff; editing both a manifest
and its assets intentionally creates a different handoff that needs review.
Do not automatically recalculate the accepted hash immediately before capture;
use the previously reviewed value. A match is not recording authorization.
The recorder's old `--chat-preview` without a snapshot is historical compatibility
only, with obsolete fictional-result assertions.

## Reusable postproduction

Use an edit JSON under `browser-artifacts/demo/`. All its relative paths resolve
from that file, and all media must remain under the private demo directory.
The schema is:

```json
{
  "version": 1,
  "kind": "familycopilot.demo.edit",
  "capture": "capture-folder/manifest.json",
  "captureSha256": "REVIEWED_SHA256_OF_CAPTURE_MANIFEST",
  "intro": {
    "file": "opening-folder/familycopilot-family-intro.mp4",
    "sha256": "REVIEWED_SHA256_OF_OPENING",
    "duration": 15.2,
    "text": "Exact existing opening narration.",
    "cue": { "start": 0.35, "seconds": 12.992208333333334 }
  },
  "narration": ["Exact existing narration for this scene."],
  "voices": [{ "directory": "previous-speech-attempt", "index": 0 }],
  "output": "new-edit-directory"
}
```

This is a schema example, not a ready-to-run job. Provide one narration/voice
entry per recorded scene. Voice indices are zero-based; each referenced directory
must contain the existing `script.json`, `audio.json`, `speech-verification.json`
and hashed WAV. Clips can come from different attempts. Text, voice, style, rate,
WAV duration and hash must match. Changed text requires separately approved new
speech; the planner does not synthesize, retry, access credentials or call Azure.
The new manifest path supports Jenny/friendly/-3% reuse only; arbitrary new
voice profiles or manifest-driven synthesis are not implemented.

`npm run demo:plan -- <edit.json>` validates hashes, exact narration reuse,
source scene bounds and timing, without rendering or creating an output directory.
Its JSON output includes `cues` for narration and `captions` with each subtitle's
text, start and end in seconds. Subtitle boundaries are rounded once to ASS's
centisecond precision; SRT and burned-in captions use that same timeline. Inspect
these entries before rendering. Empty-after-rounding intervals, overlapping cues
and captions beyond the video duration fail preflight, not after output creation.
It rejects missing clips, incompatible WAVs, nonnumeric or nonfinite durations,
sparse or overlapping scenes, source-range overflow, intro cues beyond the opening,
and blank captions or subtitle control characters. These checks validate file
integrity, WAV format and declared timing, not the actual MP4 streams: video
decoding, visual framing and human audition remain separate gates.
`npm run demo:render -- <edit.json>` then uses the existing compositor to write
a fresh MP4, English captions, review frames and manifest. Existing outputs are
never overwritten. The legacy flags and historical media remain available.
Automated decode and audio levels do not replace visual review or human audition.

Media commands use the previously installed isolated tools. The persistent tool
root is `/home/davidtang/.cache/familycopilot-demo-tools`, selected by
`FAMILYCOPILOT_DEMO_TOOLS`. Its `browsers` directory supplies
`PLAYWRIGHT_BROWSERS_PATH`; its `runtime/usr/lib/x86_64-linux-gnu` supplies
`LD_LIBRARY_PATH` in this WSL environment. No new application dependency is needed.

## Current delivery and remaining review

Current revision: [73.96-second Jenny MP4](../browser-artifacts/demo/family-story-Pjd8Et/familycopilot-family-story.mp4),
[English SRT](../browser-artifacts/demo/family-story-Pjd8Et/familycopilot-family-story.en.srt),
[manifest](../browser-artifacts/demo/family-story-Pjd8Et/manifest.json).
Opening production note and visible Demo wording removed. Brief preferences,
member calendars before shared times and continuous activity scroll retained.
All footage/audio 1x; existing movie click gains one second of editorial waiting
before the separate-browser official still. All fourteen Jenny clips reused,
no new speech or public requests. One approved isolated synthetic recapture,
zero browser errors/forbidden requests. 28 production tests, full decode, source
hashes/frame mappings, wait boundaries and selected visual checks passed.
Human continuous viewing/audition remain pending. See [production record](demo-video.md).

Previous revision: [71.32-second Jenny MP4](../browser-artifacts/demo/family-story-6HowK2/familycopilot-family-story.mp4),
[English SRT](../browser-artifacts/demo/family-story-6HowK2/familycopilot-family-story.en.srt),
[manifest](../browser-artifacts/demo/family-story-6HowK2/manifest.json).
All actions and audio at 1x. Member month/day calendars precede shared-time
summary and a continuous scroll to ideas. Both stories show native calendar
loading with explicit capture-only latency; no live calendar/search/send.
Concise Demo invitation replaces the long independent sentence. Three approved
Jenny lines synthesized once, eleven existing clips reused. Existing official
movie evidence retained offline. 28 production tests, full decode, source-frame
mapping, hashes and selected final-frame review passed. Human continuous viewing
and audition remain pending. See [production record](demo-video.md).

Previous revision: [60.12-second Jenny MP4](../browser-artifacts/demo/family-story-iSCdAK/familycopilot-family-story.mp4),
[English SRT](../browser-artifacts/demo/family-story-iSCdAK/familycopilot-family-story.en.srt),
[manifest](../browser-artifacts/demo/family-story-iSCdAK/manifest.json).
Opening animation and first question/calendar footage now play at 1x. The loaded
calendar result stays visible through its dedicated narration, including all
three member Loaded labels. A 3.84-second editorial result hold is not measured
loading time; no sequential member loading was fabricated. Existing movie-page
join, preference bridge and Kimi ownership remain. No new capture, network or
TTS. Decode, hashes, calendar frame comparisons and audio checks passed; human
continuous viewing/audition remain pending. See [production record](demo-video.md).

Previous revision: [50.28-second Jenny MP4](../browser-artifacts/demo/family-story-VYYUzc/familycopilot-family-story.mp4),
[English SRT](../browser-artifacts/demo/family-story-VYYUzc/familycopilot-family-story.en.srt),
[manifest](../browser-artifacts/demo/family-story-VYYUzc/manifest.json).
Includes the requested real Chiikawa page: original card click followed by a held
screenshot from a separately opened integrated-browser tab at the same URL.
The owner approved this workaround after the headless Access Denied attempt.
Not continuous navigation; no confirmed screening, booking, login or new TTS.
Animation, preference bridge and latest Kimi ownership remain. 27 production
tests, full decode, source hashes, final-frame and audio checks passed; human
viewing/audition remain pending. See [production record](demo-video.md).

Previous revision: [48.92-second Jenny MP4](../browser-artifacts/demo/family-story-gyjx2k/familycopilot-family-story.mp4),
[English SRT](../browser-artifacts/demo/family-story-gyjx2k/familycopilot-family-story.en.srt),
[manifest](../browser-artifacts/demo/family-story-gyjx2k/manifest.json).
Actual animation restored; preference/calendar bridge added; 1.12x offline
speech and tighter cuts; latest Kimi-owned school event shown before/after consent.
One new approved Jenny bridge request used, all other clips reused. Full decode,
source hashes, animation pixel-change and audio checks passed; longest measured
silence is 1.614 seconds. Human viewing/audition remain pending. A subsequently
requested real Chiikawa-site click returned Access Denied in the disposable
browser and is not included. No automatic retry. See the latest
[production record](demo-video.md) for evidence and remaining approval.

Previous narrated delivery: [74.48-second Jenny MP4](../browser-artifacts/demo/family-story-sGwsd8/familycopilot-family-story.mp4),
[English SRT](../browser-artifacts/demo/family-story-sGwsd8/familycopilot-family-story.en.srt),
[manifest](../browser-artifacts/demo/family-story-sGwsd8/manifest.json).
New frozen-UI capture includes no Stop, current and upcoming action labels,
natural invitation dialogue and separate visible simulation disclosure. Nameless
opening retained. Twelve expressly approved Jenny clips synthesized once, with
no retries, names/private payloads or resource changes. Capture and synthesis
approvals consumed. 24 production tests, full decode, audio-level/source-hash
checks and eight final-frame inspections passed. Human viewing/audition pending;
publication rights and wider-sharing consent unresolved. See
[production record](demo-video.md), Current UI With Jenny.

Previous opening-only revision: [69.76-second silent MP4](../browser-artifacts/demo/family-story-YcLb56/familycopilot-family-story.mp4),
[English SRT](../browser-artifacts/demo/family-story-YcLb56/familycopilot-family-story.en.srt),
[manifest](../browser-artifacts/demo/family-story-YcLb56/manifest.json).
Actual opening display and subtitles now use a nameless family-life scenario,
not an introduction of real people. No new capture or speech. Full decode,
source hashes, caption bounds and seven final-frame inspections passed.
Later footage is unchanged and still contains names and the older `Demo invitation`
dialogue; Builder's separate copy change is not included. Human continuous review,
publication rights and wider-sharing consent remain pending.
See [production record](demo-video.md), Scenario Opening Revision.

Previous corrected delivery: [69.76-second silent MP4](../browser-artifacts/demo/family-story-JlA6rW/familycopilot-family-story.mp4),
[English SRT](../browser-artifacts/demo/family-story-JlA6rW/familycopilot-family-story.en.srt),
[manifest](../browser-artifacts/demo/family-story-JlA6rW/manifest.json),
[visual review](../browser-artifacts/demo/family-story-JlA6rW/visual-review.json).
Internal history text is now `Earlier suggestions`; all composer placeholders
are `Message Family Copilot...`, with no prefilled script. Builder's 205/205
pinned tests passed. New nine-scene isolated rehearsal and capture passed with
zero forbidden I/O/browser errors. Full decode and ten final-frame inspections
passed. No real send/write, shared service or TTS. Human continuous review and
public image rights remain pending. See [the production record](demo-video.md), Corrected Prompts Video.

Previous invitation review (copy issue since fixed): [68.16-second silent MP4](../browser-artifacts/demo/family-story-awye1K/familycopilot-family-story.mp4),
[English SRT](../browser-artifacts/demo/family-story-awye1K/familycopilot-family-story.en.srt),
[manifest](../browser-artifacts/demo/family-story-awye1K/manifest.json),
[visual review](../browser-artifacts/demo/family-story-awye1K/visual-review.json).
Approved September 21 isolated rehearsal and one capture passed all nine scenes
with zero forbidden I/O/browser errors. Full decode, hashes and caption bounds
passed; thirteen final frames were inspected. Chapter at 0:37, school question
at 0:40, labelled demo invitation pending Mike, family closing at 1:03.16.
No real send/write or new speech. One product-copy issue remains: `Previous search
retired.` is visible during weekend loading at 0:26.8; see the
[Builder issue and acceptance criteria](demo-video.md), historical Remaining Builder Copy Issue section.
Continuous human review and image rights remain pending; capture approval consumed.

Current product revision: the [Builder invitation handoff](chat-builder-handoff.md)
and [revised storyboard](demo-recommendation-storyboard.md) supersede the
proposal-only dialogue below. 203/203 pinned offline product tests passed.
The new footage above uses these exact product bytes; older recordings below do not.
No real invitation, calendar write or reminder is implemented by the demo send.

Latest existing video, earlier story: [67.04-second silent MP4](../browser-artifacts/demo/family-story-cpocKr/familycopilot-family-story.mp4),
[English SRT](../browser-artifacts/demo/family-story-cpocKr/familycopilot-family-story.en.srt),
[manifest](../browser-artifacts/demo/family-story-cpocKr/manifest.json),
[selected-frame review](../browser-artifacts/demo/family-story-cpocKr/visual-review.json).
The nine-second introduction identifies Debby and Mike as Kimi's parents. A
chapter at 0:37.44 introduces the separate school conversation. Reset and Undo
are omitted; the proposal remains pending Mike's confirmation, followed by a
five-second family/brand closing. Existing footage only; no capture or synthesis.
22/22 production tests, full decode, hashes, caption bounds and eleven selected
frames passed review. The September card remains poster-heavy. Human continuous
viewing and publication rights remain pending; see [production history](demo-video.md).
The reusable offline command is
`node scripts/render-complete-demo.js --family-edit <edit.json> --sha256 <hash>`.

Previous Debby-led technical cut: [60.56-second silent MP4](../browser-artifacts/demo/school-chapter-wDdirh/familycopilot-two-stories.mp4),
[English SRT](../browser-artifacts/demo/school-chapter-wDdirh/familycopilot-two-stories.en.srt),
[manifest](../browser-artifacts/demo/school-chapter-wDdirh/manifest.json).
The separate school story begins at 0:29.60. Debby initiates the review, her work
calendar conflicts, and Mike is proposed only after separate confirmation.
Nine-scene isolated rehearsal and recording passed with zero forbidden I/O;
21/21 production tests and final decode passed. The current
[Builder handoff](chat-builder-handoff.md) provides the 196/196 offline product
tests. Human continuous viewing and publication remain pending. Capture approval
is consumed; see [the production record](demo-video.md). No proactive alert,
contact or calendar write is demonstrated.

Prior two-story cut (old roles): [64.72-second silent MP4](../browser-artifacts/demo/school-chapter-OZArMo/familycopilot-two-stories.mp4),
[English SRT](../browser-artifacts/demo/school-chapter-OZArMo/familycopilot-two-stories.en.srt),
[manifest](../browser-artifacts/demo/school-chapter-OZArMo/manifest.json).
A three-second editorial chapter at 0:38.48 explicitly introduces the school
meeting as another user story. No new capture or product change was needed.

Earlier conversation-first cut: [61.72-second silent MP4](../browser-artifacts/demo/conversation-cut-HQJbGs/familycopilot-conversation.mp4),
[English SRT](../browser-artifacts/demo/conversation-cut-HQJbGs/familycopilot-conversation.en.srt),
[manifest](../browser-artifacts/demo/conversation-cut-HQJbGs/manifest.json).
The owner removed configuration from the demo story: it now starts with the
October question and retains UI loading, scrolling and school coordination.
This is an offline trim of existing media, not a new product capability or capture.

Earlier full capture: [74.16-second native UI loading MP4](../browser-artifacts/demo/chat-preview-UWkiu5/familycopilot-chat-preview.mp4),
[English SRT](../browser-artifacts/demo/chat-preview-UWkiu5/familycopilot-chat.en.srt),
[production manifest](../browser-artifacts/demo/chat-preview-UWkiu5/manifest.json).
One continuous recording shows the real UI loading state with two approved
recording-only two-second response delays and native smooth scrolling. It remains
silent. Twelve scenes, final decode, pixel-motion checks and 17 production tests
passed; continuous human review remains pending. The renewed capture approval is
consumed. See [production history](demo-video.md) for source and privacy limits.

Retained review iteration: [80-second loading simulation MP4](../browser-artifacts/demo/loading-edit-HPWfRN/familycopilot-loading-preview.mp4),
[English SRT](../browser-artifacts/demo/loading-edit-HPWfRN/familycopilot-loading.en.srt),
[manifest](../browser-artifacts/demo/loading-edit-HPWfRN/manifest.json).
This offline edit inserts two labelled two-second animated waits, not product
loading behavior. No Builder handoff, browser capture or new speech was used.
It remains silent; school coordination begins at about 0:55.

The previous full-story subtitle preview remains available:
[76-second silent MP4](../browser-artifacts/demo/chat-preview-pZPHYW/familycopilot-full-story-preview.mp4),
[English SRT](../browser-artifacts/demo/chat-preview-pZPHYW/familycopilot-chat.en.srt),
[delivery manifest](../browser-artifacts/demo/chat-preview-pZPHYW/delivery.json).
It includes preference edit/Cancel, October suggestions, nearer-weekend coverage
and school-meeting coordination with pending Debby proposal and Undo (from 0:51).
All twelve scene assertions, complete decode, caption bounds and selected final
frames passed. It is a product-only subtitle preview, not a narrated final edit;
new Jenny speech remains unapproved. The capture approval is consumed.

- [Earlier two-turn narrated MP4](../browser-artifacts/demo/approved-cards-qdF9Tq/jenny-finished/familycopilot-chat-jenny.mp4),
  [English captions](../browser-artifacts/demo/approved-cards-qdF9Tq/jenny-finished/familycopilot-chat.en.srt),
  [manifest](../browser-artifacts/demo/approved-cards-qdF9Tq/jenny-finished/manifest.json),
  [visual review](../browser-artifacts/demo/approved-cards-qdF9Tq/jenny-finished/visual-review.json).
  This 60.28-second internal-review version includes the original animation,
  six reused Jenny clips, public-team imagery and readable Chinese team labels.
- Snapshot capture, manifest planning and offline rendering completed end to end.
  Full decode, pinned hashes, image loading, audio levels and selected final frames
  passed their checks. No new speech requests or runtime external activity queries.
  Human audition and continuous editorial review remain pending; captions are
  approximately timed. Earlier Media Player success does not certify this new file.
- Calendars are synthetic; activity facts are saved public data, not confirmed
  showtimes or calendar fit. Image public-use rights remain unconfirmed. Do not
  publish without rights clearance and separate approval. The isolated font setup
  was reused, not reinstalled. Shared tabs and services were not touched.
- The earlier failed cuts remain preserved. The renewed recording approval is
  consumed; another capture or installation needs fresh scoped approval.

Keep this delivery pointer short and update it only after verifying a new output.
Keep historical approvals and evidence in [production history](demo-video.md);
completed approvals remain consumed.