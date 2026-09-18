# Demo video

## Complete real-calendar story, revised transitions, 18 September 2026

[Complete story MP4](../browser-artifacts/demo/real-calendar-LHXjcP/complete-story/familycopilot-complete-story.mp4)
and [English SRT](../browser-artifacts/demo/real-calendar-LHXjcP/complete-story/familycopilot-complete.en.srt):
**127.44 seconds**, 1080p H.264/AAC, English Jenny Neural, friendly, -3%.
These are private local, Git-ignored deliverables; older edits remain unchanged.

- The animated opening now leads into **“Let's meet Family Copilot.”** The new
  voice begins just before the real calendar appears, rather than abruptly
  starting with an already-loaded-calendar statement.
- The full journey continues through real saved calendars, possible room for an
  outing, Activities, interests, Basketball, CTBC DEA, game results and the
  official game website. Basketball narration and captions start only after its
  on-screen selection. No automatic shared-free-slot or calendar-fit claim.
- Two generic transition clips were synthesized using the same approved Speech
  resource. Existing intro and Activities voices and recordings were reused.
  **No new calendar request, public search, recording or service change.** No
  private calendar content was sent to Speech. Child names remain masked.
- The earlier Activities capture is trimmed from verified source time 43.5s,
  excluding its preceding synthetic calendar. This is an edit across two existing
  recordings, not a newly recorded uninterrupted session or fresh source check.
- [Postproduction entry point](../scripts/finish-real-calendar-demo.js) adds
  `--synthesize-full-approved` and `--render-full-offline` with separate exclusive
  output. [Complete-story compositor](../scripts/render-complete-demo.js) verifies
  source hashes, combines the seven scenes and writes captions and an edit manifest.
  Do not repeat completed synthesis or overwrite an existing output directory.
- **5/5 focused production tests passed**, full video decode and source-hash
  checks passed. Intro bridge, Activities handoff, selected Basketball and official
  ending frames were visually reviewed. Captions remain approximate within each
  clip, not word-aligned. Human audition remains separate from automated checks.

## Real calendar segment with animated opening, 18 September 2026

After explicit permission to record real content and the owner's ready/go,
metadata-only inspection confirmed live/disk, idle, workflow_disabled and safeIdle.
A disposable browser used the application's existing **saved-only handler** for
the fixed October scope, with the displayed dates 9–11 October. Exactly one parent
cache-only request and one child saved-view request were permitted; provider Sync,
imports, destructive Clear, public searches and external requests were blocked.
There were zero blocked attempts. No shared tab, app source or service changed.

The captured UI showed Mike, Debby and Kimi **Loaded**, with real saved statuses
and child event times. Child event names and their tooltips were masked in the
disposable browser before capture. Unknown gaps and the actual UI notices remain.
This is saved-data viewing, not proof of fresh provider verification or full
family availability. A capture-report field was renamed from `childUnavailable`
to `childContextLimited`: its regex matched the missing-time caveat, not a load
failure; the report records the correction and the raw video is unchanged.

[Real calendar MP4](../browser-artifacts/demo/real-calendar-LHXjcP/finished/familycopilot-real-calendar.mp4)
and [English SRT](../browser-artifacts/demo/real-calendar-LHXjcP/finished/familycopilot-calendar.en.srt)
are private local, Git-ignored deliverables. **44.92 seconds**, 1080p H.264/AAC:
family illustration → already-loaded calendar → review commitments → introduce
the question of family interests. This is the calendar segment, not a completed
calendar-aware activity recommendation demo.

- [Recorder](../scripts/record-real-calendar-demo.js): explicit
  `--record-saved-approved`, no provider fallback or fixture replacement.
- [Postproduction](../scripts/finish-real-calendar-demo.js): two new generic
  Jenny friendly -3% clips using the previously approved Speech resource. No
  calendar data is sent to Speech. Original animated opening reused unchanged.
  Exclusive synthesis output, no automatic retries; offline rendering checks
  capture/raw/intro hashes and audio integrity.
- **4/4 focused production tests passed**, syntax and editor checks passed,
  complete FFmpeg decode passed. Loaded-grid and scrolling frames were visually
  reviewed. Captions are approximate within each voice clip, not word-aligned;
  human audition is not established by decoding.

## Animated family opening preview, 18 September 2026

The owner suggested opening with a family wanting to go out together for the
weekend. [Standalone animation](demo-intro.html) uses original SVG illustrations
and CSS motion: separate routines, the family coming together, then the question
“What could we do together?” No sport appears before the later product choice.
These are illustrative characters, not portraits or a substitute for real calendar
footage. The proposed next shot is the already-loaded Our week, not a Sync tutorial.

[Opening MP4](../browser-artifacts/demo/family-intro-6gKRQp/familycopilot-family-intro.mp4)
is a separate **15.2-second, 1080p** preview, not a new complete demo. It reuses
the existing approved Jenny opening narration; no new speech synthesis, live
query, calendar access, service change or application edit occurred. Display
headlines are story titles, not a verbatim subtitle track.

[Offline renderer](../scripts/render-demo-intro.js), `--render-offline`, uses the
existing isolated media tools and writes a fresh ignored directory. It seeks CSS
animations deterministically for 380 frames at 25 fps, checks reduced-motion
fallback, refuses network requests and verifies source/audio hashes. Syntax,
browser script execution and FFmpeg decode passed; three key frames were visually
reviewed. Human audition remains separate. The HTML preview has keyboard-accessible
Replay and a static closing composition for reduced-motion users.

## Next demo direction: recommendations, not a feature tour

The owner wants an already-loaded, real family calendar to inform activity
suggestions together with explicit preferences. The
[recommendation storyboard](demo-recommendation-storyboard.md) separates that
intended story from current functionality and lists evidence needed before
recording. This is planning only while Calendar independently handles repairs;
the existing videos below do not demonstrate calendar-aware recommendations.

## Latest story edit, 18 September 2026 (Taipei)

The latest edit follows a family wanting time together: review commitments,
consider a possible opening, explore shared interests, choose Basketball and a
favorite team, consider a game, then open its official page. Narration no longer
reads out fixture, storage or source implementation details. Visible sample and
source labels remain. It does not claim automatic free-slot discovery or a
verified calendar match; Kimi's plans still need checking.

- Reuses the completed integrated raw capture below. **No new recording, public
  search, calendar query or service change.** Earlier videos remain unchanged.
- Eight new **Jenny Neural, friendly, -3%** narration clips; **124.84 seconds**,
  1080p H.264/AAC with English captions. Duration follows the story, not a target.
- Basketball is absent from the first four narration scenes and chapter titles.
  In scene five, speech and captions start six seconds into the scene; the raw
  frame at +5.8 seconds already shows the selected basketball option and team.
- `--synthesize-story-approved` and `--render-story-offline` create the separate
  `jenny-story` output. Synthesis freezes the selected wording in a narration
  manifest for rendering, with exclusive output writes and original capture
  hashes checked before and after rendering. Never repeat synthesis implicitly.
- Offline production tests and syntax checks passed. FFmpeg decode passed;
  caption timing remains approximate within each clip, not word-aligned.
  Human audition and speaker playback are not asserted.

[Story MP4](../browser-artifacts/demo/integrated-20260918/jenny-story/familycopilot-integrated-jenny.mp4)
and [story verification](../browser-artifacts/demo/integrated-20260918/jenny-story/verification.json)
are ignored local deliverables.

## Latest integrated recording, 18 September 2026 (Taipei)

The owner approved resuming recording after the shared-tab review. This version
supersedes the **synthetic-only activity and offline narration** descriptions
below, which document the preserved original recorder.

- Latest integrated **8002 Our week → Activities** pages; the Activities assets
  match the independent 8030 version. No service was started, stopped or restarted.
- Calendar responses are intercepted inside a fresh disposable browser: one
  synthetic parent response and one synthetic child saved-view miss. All other
  calendar APIs are blocked or receive synthetic cleanup responses. No real
  calendar request or private snapshot access occurred. Sample labels stay visible.
- Exactly **one** real public TPBL search for **9–11 October 2026** and the entered
  **中信特攻 (CTBC DEA)** returned two source listings. The UI resolved the name
  to **新北中信特攻 (New Taipei CTBC DEA)** using its existing fuzzy matcher.
- The user flow selects the first returned game and clicks **View official game**.
  The final scene shows **https://tpbl.basketball/schedule/27535**, opened in its
  real new tab. No Start over action, ticket purchase, calendar addition or booking
  was performed. Availability, age guidance, travel and calendar fit remain
  unverified. Official listings may change after capture.
- Official-site Google tag loading and one third-party font stylesheet were
  blocked; the visible TPBL page and both team logos rendered successfully.
- **Jenny Neural**, friendly style, -3% rate: seven revised clips synthesized via
  the already approved existing Azure Speech resource, with one unchanged clip
  reused. Credentials remained only in process memory; no resource settings
  changed and there were no automatic synthesis retries.
- Final video: **112.72 seconds, 1920×1080, H.264/AAC, 48 kHz stereo** with English
  burned-in captions and an SRT companion. Caption timing is approximate within
  each voice clip, not word-aligned. Original recordings remain unchanged.

[Latest MP4](../browser-artifacts/demo/integrated-20260918/jenny/familycopilot-integrated-jenny.mp4)
and [verification report](../browser-artifacts/demo/integrated-20260918/jenny/verification.json)
are local ignored artifacts, not repository publication assets.

### Recording and postproduction helpers

- [record-integrated-demo.js](../scripts/record-integrated-demo.js):
  `--calendar-smoke` rehearses the latest calendar/navigation/preferences with
  no public search. `--record-approved` performs the separately authorized
  one-search recording. Its fixed output directory is an exclusive attempt
  marker: do not remove it to silently replay an approval.
- [finish-integrated-demo.js](../scripts/finish-integrated-demo.js):
  `--synthesize-approved` performs the approved fixed-resource voice replacement
  once; `--render-offline` uses only the saved raw videos and WAVs. Existing output
  files are never overwritten. Partial failures require inspection, not a repeat
  cloud call. These helpers are scoped to this recording, not a general deployment
  or voice service.
- Both use the existing isolated media installation described below via
  `FAMILYCOPILOT_DEMO_TOOLS`; browser capture also uses its existing Chromium,
  runtime-library and font environment. No application dependency was added.
- [Offline production tests](../test/demo-production.test.js): **3/3 passed**;
  both scripts passed syntax checks. The calendar smoke and complete capture
  passed with zero application page errors and unchanged application file hashes.
  FFmpeg decoded the final MP4 successfully; measured audio was non-silent
  (mean -20.4 dB, peak -4.3 dB). Final result and official-ending frames were
  inspected. This is not human audition or confirmation of speaker playback.

## Original synthetic-only recording (historical)

The owner requested an Our week → Activities walkthrough with English captions
and narration, targeting about 60–90 seconds. This is an offline synthetic demonstration, not evidence
of live provider access, actual family availability, event verification or parent
usability approval.

The preferred-team example is **中信特攻 (CTBC DEA)**, as requested by the owner.
Only the team name is real: the demo's numeric IDs, games, opponents, venues and
dates are fictional, not verified CTBC DEA fixtures or an endorsement. The
English narration explains this and the synthetic badge remains visible. Both
returned game cards and the preferred-team chip are checked for that team name.

## Reusable recorder

Run `node scripts/record-demo.js --smoke` to validate all eight scenes and produce
review screenshots. Run `node scripts/record-demo.js` to produce the narrated MP4.
Set `FAMILYCOPILOT_DEMO_TOOLS` to an **absolute isolated tooling directory** with
`playwright` and `ffmpeg-static` installed under its node_modules directory.
Playwright Chromium must be installed; use `PLAYWRIGHT_BROWSERS_PATH` and, where
needed, `LD_LIBRARY_PATH` for isolated browser/runtime installations. These are
media-production tools, not application dependencies. A local fontconfig file
can include isolated Noto Color Emoji and Noto Sans CJK installations through
`FONTCONFIG_FILE`, so sport icons and the Traditional Chinese team name render
correctly without changing the product or system fonts.
No system installation or administrator permissions are required by the recorder.

Narration currently requires WSL with Windows PowerShell and the installed
**Microsoft Zira Desktop** System.Speech voice. Speech is synthesized locally;
there is no cloud speech service, account, voice cloning or execution-policy
change. Failure to find the required tools stops recording instead of silently
substituting a different service.

Outputs are created in a new, Git-ignored `browser-artifacts/demo/recording-*`
directory: MP4, English SRT, narration, timeline, scene screenshots, source video,
WAV clips and a verification report. Only publish the reviewed deliverables.
The MP4 contains synthetic labels, chapter headings, burned-in English captions
and an English audio track. It is encoded as H.264/AAC with fast-start metadata.

## If narration is inaudible in a preview

An audio track being present does not prove a particular player can decode it or
that its volume is enabled. The original 22.05 kHz mono AAC recording contained
non-silent speech; the user's playback failure was not reproduced or attributed
to a confirmed cause. Some editor previews may not support AAC playback.

Run `node scripts/repair-demo-audio.js <recording-directory>` with the same
`FAMILYCOPILOT_DEMO_TOOLS` setting to make additional playback formats, without
recording again or contacting any service. It accepts only an existing verified
synthetic recording under `browser-artifacts/demo`, preserves the original,
and writes a new ignored `audio-compatible-*` subdirectory containing:

- WebM with VP9 video and Opus audio, an alternative for browser/editor players.
- MP4 with unchanged H.264 video and 48 kHz stereo AAC audio, default English track.
- Standalone 48 kHz stereo PCM WAV narration, for independent audio playback.

Speech is normalized toward -16 LUFS with a -1.5 dB true-peak target. All three
outputs are decoded by FFmpeg for integrity checks. This is not human audition
or confirmation of the user's sound-device/player settings. If editor playback
is still silent, try the WebM or WAV in a normal browser or desktop media player.

## Boundaries

- A new OS-assigned loopback port and fresh headless browser context are used.
  Existing tasks, user tabs, browser profiles and live port 8002 are untouched.
- Only synthetic parent and basketball adapters may run. Owner listing and child
  import are explicitly blocked. No persistent calendar store is supplied.
- Browser requests are restricted to the new local origin, HTTPS provider calls
  and global fetch are blocked, and unexpected calls fail the recording.
- Synthetic basketball examples are produced through the existing fixture
  projection and filtering path. Official external links are never opened.
- Dates cross the pages through the existing dates-only tab contract; calendar
  results and consent never transfer to Activities.
- The demo adds only a visible synthetic badge and mouse indicator in its own
  disposable browser. CSP bypass is local to that recording context to allow
  those overlays; production markup, CSP and behavior are not changed.
- Screenshots are reviewed before publication. A successful recorder checks one
  synthetic parent request, one synthetic search, zero startup API calls, zero
  external browser requests and zero page errors. FFmpeg decodes the final MP4
  to check encoding integrity. These checks are not a full application test run.