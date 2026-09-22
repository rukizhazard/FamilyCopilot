# Demo video

Current commands, ownership and delivery pointer: [two-agent workflow](demo-workflow.md).
This file retains production history; historical approvals are not reusable.

**Publication note, 22 September 2026:** role labels below are editorial
anonymizations, not verbatim historical speech or authorization text. Original
private requests, audio, captions, videos and snapshots remain unchanged and may
contain real names. Their hashes still identify the original bytes. No new media
was produced or validated in this redaction pass. See [the publication review](publication-redaction.md).

## Jenny Narration For Animated Intro, 22 September 2026

Current [118.64-second MP4](../browser-artifacts/demo/motion-jenny-BrfRBw/familycopilot-animated-jenny.mp4),
[English SRT](../browser-artifacts/demo/motion-jenny-BrfRBw/familycopilot-animated-jenny.en.srt),
[manifest](../browser-artifacts/demo/motion-jenny-BrfRBw/manifest.json),
[preservation verification](../browser-artifacts/demo/motion-jenny-BrfRBw/preservation-verification.json),
[review notes](../browser-artifacts/demo/motion-jenny-BrfRBw/review-notes.json).
Owner accepted the animation and requested dubbing, then explicitly approved
the existing nine-sentence English script through Azure Jenny/friendly/-3%,
at most9requests/700characters, one key read, no retry/provider substitution.
Existing `synthesizeFamilySpeech` executed exactly9requests/675characters.
No private calendar data or names sent; no resource changes. One-time approval
is consumed. [Request](../browser-artifacts/demo/animated-dubs-20260922/request.json)
SHA `9c4c3f4e8be907506005f20caa4c47b42cd419d96aeb9aced24e31032504381d`;
[speech](../browser-artifacts/demo/animated-dubs-20260922/jenny-approved/speech.json)
SHA `61ff80b3bf1dbc65f257dfda7d2ab967b7032d0a259a45a5a7badf00350df467`.

Raw audio57.552s did not fit the49s silent preview. Offline editing trims only
measured silence, retaining60ms lead/120ms tail/320ms long sentence pauses and
all spoken samples at native tempo. No resynthesis or accelerated media.
Animation holds change, not animation speed; intro becomes50.28s. The original
8.4-76.76s demo and narrated ending shift+41.88s, otherwise unchanged. Captions
follow speech sentence timings, not word-level alignment. Product vision and
existing synthetic/public-evidence qualifications remain intact.

Extended existing `render-demo-intro.js` with `--plan-dubs`/`--render-dubs`:
pin request, speech and reviewed preview manifest hashes; reject altered words,
unmatched media or duration>=120; reuse existing FFmpeg/caption helpers. Source
preview manifest SHA `408fa774931f8a81881da2da014b4e0529efcfb646c511999988ee765af98ba7`.
No browser, new capture, shared-service operation, product edit, package install,
private access, public search, delegation, upload, commit or push.

First render `motion-jenny-9V4ylQ` retained: source-audio comparison detected a
56.75ms early demo voice. Normalization/resampling left the intro WAV short.
Fixed by resampling before padding and sample-exact trimming, then independently
verified2413440 stereo frames at48kHz (50.28s) before joining the old voice.
Final same-check rerun passes; never relaxed audio alignment thresholds.

Final H.264/AAC1440x1020/25fps/48kHz stereo,118.64s/2966frames fully decoded.
All nine new clips correlate>0.9984 with retained source speech; original demo
and ending correlate>0.9998. Six source-frame differences<0.09; nine motion pairs
nonzero; caption/source/output hashes pass.32/32production tests, editor checks
passed. Final opening, weekly hero, brand, demo join and narrated ending inspected.
The [existing preservation verifier](../browser-artifacts/demo/animated-intro-20260922/verify.cjs)
now handles silent preview and dubbed outputs. Human continuous viewing/audition
and public image reuse rights remain pending. All prior media preserved.

## Animated Vision Intro Preview, 22 September 2026

Latest [117.36-second MP4](../browser-artifacts/demo/motion-preview-vkQSin/familycopilot-animated-preview.mp4),
[English SRT](../browser-artifacts/demo/motion-preview-vkQSin/familycopilot-animated-preview.en.srt),
[manifest](../browser-artifacts/demo/motion-preview-vkQSin/manifest.json),
[verification](../browser-artifacts/demo/motion-preview-vkQSin/verification.json),
[preservation checks](../browser-artifacts/demo/motion-preview-vkQSin/preservation-verification.json),
[review notes](../browser-artifacts/demo/motion-preview-vkQSin/review-notes.json).
Owner liked the prior video, requested a nine-scene intro and total under two
minutes, then explicitly allowed animation instead of images. Owner approved the
condensed 103-word vision script and isolated offline production, but chose a
preview without new narration. No synthesis or credential access was authorized
or performed. Do not treat this script approval as paid-speech approval.

New intro is 49 seconds of deterministic motion graphics, English captions and
intentional silence. It replaces only the prior 8.4-second opening. The old
8.4-76.76s body is preserved at native speed, shifted +40.6 seconds, including
its existing Jenny audio and narrated brand ending. Final format remains
1440x1020, 25fps, H.264/AAC, 48kHz stereo, measured117.36s/2934frames. Intro
has a Product vision label; school inference, rescheduling, ticket reminders,
registration monitoring, general weekly understanding and the agent architecture
are concepts, not verified deployed behavior. Existing synthetic calendar and
historical movie-page evidence limitations remain unchanged.

Exact owned paths: the existing [intro renderer](../scripts/render-demo-intro.js),
one regression in [production tests](../test/demo-production.test.js), these two
production records, and fresh ignored `animated-intro-20260922`, `motion-review-*`
and `motion-preview-*` outputs. Existing product, compositor and unrelated dirty
changes preserved. No new dependencies, product recapture, shared services/tabs,
private data, public requests, upload, delegation, commit or push.

The renderer now supports `--review-animated` with a pinned brief and
`--render-animated` with pinned brief and review hashes. Rehearsal and rendering
both reject changed source hashes. The old `--render-offline` path remains intact.
[Brief](../browser-artifacts/demo/animated-intro-20260922/brief.json) SHA
`521bb6a7dbb3ca27f6648b8151e3425e83063a676d50f98a6e4e4f08adb2ce47`;
[accepted rehearsal](../browser-artifacts/demo/motion-review-t78pny/review.json) SHA
`24f68223a09dd128b8c7e7465d3f530344f835338fe518e06641cb86cca4e08f`.
The earlier rehearsal is preserved: visual review found headline overlap and
an awkward caption break; both were repaired and the same checks rerun.

Executed: production31/31; complete decode; source/output hashes; ordered caption
export; ten layout checks; six source-frame mappings (mean gray difference<0.09);
six nonzero motion pairs; intro PCM peak0 through48.9s; retained speech and ending
correlations>0.9998. All nine scene compositions inspected across rehearsals;
final join-before/join-after/narrated-ending frames inspected. Reproducible
[preservation verifier](../browser-artifacts/demo/animated-intro-20260922/verify.cjs)
uses only local media. Human continuous viewing/audition remains pending for this
new cut. Public image reuse rights are not cleared; all old media retained.

## Restored Narrated Ending, 21 September 2026

Current [76.76-second MP4](../browser-artifacts/demo/family-story-9snm0K/familycopilot-family-story.mp4),
[English SRT](../browser-artifacts/demo/family-story-9snm0K/familycopilot-family-story.en.srt),
[manifest](../browser-artifacts/demo/family-story-9snm0K/manifest.json),
[verification](../browser-artifacts/demo/family-story-9snm0K/verification.json).
Owner accepted the improved transition but found the silent title ending broken
and preferred the previous ending. Restored the exact existing Jenny clips:
"Now they're waiting for his response." and "Family Copilot. Less coordinating.
More living." The previous title and tagline return; personal closing omitted.
No new synthesis, credential read, capture, browser, network or product changes.

The first five edit segments, first eleven voices and consent cue are unchanged
from the readable-pacing version. Waiting-response narration is 66.22-68.35s;
0.8s fade ends at 69.96s; title fades in over 0.6s. Brand narration starts70.61s,
finishes76.13s before the final0.6s fade. All media1x. Reused movie click remains
offline intercepted with separate historical official-page still, not live loading.
Original25assets/four images and synthetic invitation limitations unchanged.

Reproducible edit helper `--restore-ending`, verifier `--restored-ending`:
[edit](../browser-artifacts/demo/readable-pacing-20260921/edit-restored-ending.json),
SHA `8b5337fd10ac169fb49f7daae2e431ede9beee8f2c462b7a9ebbc0b32b223109`.
Full decode, source/output hashes, caption bounds, 1.24s approach/1.205s hover,
15 white frames, 2.202s question, 2.426s spinner, eight source mappings and two
movie mappings passed. Ending-only audio mean-19.4/peak-4.5dB, non-silent;
maximum internal silence4.009s. Waiting-response, fade and narrated title frames
inspected; helper diagnostics passed. No shared production helper changes or
application tests needed. Human continuous viewing/audition and public image
rights still pending. Prior outputs and the unused personal voice are preserved.

## Readable Pacing And Personal Closing, 21 September 2026

Previous [76.28-second MP4](../browser-artifacts/demo/family-story-0q93Fh/familycopilot-family-story.mp4),
[English SRT](../browser-artifacts/demo/family-story-0q93Fh/familycopilot-family-story.en.srt),
[manifest](../browser-artifacts/demo/family-story-0q93Fh/manifest.json),
[verification](../browser-artifacts/demo/family-story-0q93Fh/verification.json).
Owner approved four pacing fixes and a personal closing. The exact named wording
is omitted from public source; the private original is unchanged. SHA-256 of its
JSON-serialized narration array is
`4bc1eb7dc3ebb22f531fd51b41a7e0c01244e9027b3d92d209b618615f4d4479`.
That original text was separately authorized for one Azure Jenny call, maximum150characters,
one credential read, no retry/provider substitution/resource change. Actual
90characters, one request, 6.277s source WAV; original parent names disclosed, no
calendar payload. This one-time synthesis authorization is consumed.

All25assets match Builder `c626ab54ed20895f53ea6b458e6e6a2fde904fdca0e9f7b37fe2830c939c0a61`.
Production snapshot `f010d274206e578d8643bce8a0f243c69184562bb18513c01d2ef55688ca19c3`.
No product edit: opt-in `--readable-pacing` wraps the existing cancellable
prepareInvitation hook to 2500ms, preserving original callback and abort cleanup.
After school processing settles, the sent question is framed at y180 and held2s.
Two failed rehearsals exposed focus/edge framing; retained. Final rehearsal
`chat-review-AGBjDR` and one formal `chat-preview-DSUx2J` passed with zero missing
images/errors/forbidden requests. Main capture67.84s; the same raw recording
also contains the separately staged offline movie click. Capture approval consumed.

Click movement1.24s, hover1.205s; actual click prevented navigation, not a live
successful load. Cursor indicator follows recorded mouse events. White content
35.16-35.76 is an editorial0.6s wait, followed by the existing official-page still.
No new public requests, booking, shared page/service or real calendar operations.
School question visible46.819-49.021; invitation spinner visible60.03-62.456.
New closing plays66.22-72.257 on pending response; soft0.8s fade starts73.08,
silent brand at73.88. No new success/acceptance claim. All video/audio remains1x.

[Preparation](../browser-artifacts/demo/readable-pacing-20260921/prepare.cjs),
[edit helper](../browser-artifacts/demo/readable-pacing-20260921/edit.cjs),
[verification helper](../browser-artifacts/demo/readable-pacing-20260921/verify.cjs),
[approval](../browser-artifacts/demo/readable-pacing-20260921/approval.json).
Final edit SHA `cd892260ad840e8c6afb0237507ff9a9e36a767539ae2182785e6fdf2f1f5ba8`.
Initial render `family-story-nAtVKO` retained: internal silence6.496s failed gate.
Only narration placement changed; no re-recording or resynthesis. Final longest
internal silence3.996s; intentional silent brand separate. Audio-21.3mean/-4.4peak.
Full H264/AAC decode1440x1020/25fps/48kHz stereo, caption bounds, all source/raw/
output hashes, eight source-frame mappings, two movie mappings,15whiteframes,
spinner pixel change and fade checks passed. Eight final frames inspected:
opening, movie hover, school question, invitation end, personal closing, fade,
brand and white. Production tests30/30, editor diagnostics passed. Human full
viewing/audition and public image reuse rights remain pending. Older files retained.

## Stable Typing, Whole Month And Invitation Animation, 21 September 2026

Previous [69.76-second MP4](../browser-artifacts/demo/family-story-38u5Sm/familycopilot-family-story.mp4),
[English SRT](../browser-artifacts/demo/family-story-38u5Sm/familycopilot-family-story.en.srt),
[manifest](../browser-artifacts/demo/family-story-38u5Sm/manifest.json),
[verification](../browser-artifacts/demo/family-story-38u5Sm/verification.json).
Owner approved Builder delegation and video revision for the 00:10 jitter,
discussed whole-month calendar, and short invitation-processing animation.
Builder's [handoff](chat-builder-handoff.md) pins 25 assets at
`c626ab54ed20895f53ea6b458e6e6a2fde904fdca0e9f7b37fe2830c939c0a61`.
It reports 228/228 focused and 214/214 bounded product tests plus isolated desktop
and mobile verification. The first-typing root cause was idle fixed-composer
scroll padding: baseline 22px movement, corrected 0px. No private data or IO.

First story now shows the whole October grid with parent Busy periods and Child's
event names/times, then activities. No date is clicked and no candidate-time shot
is scripted. The former schedules/shared-times narration clip was omitted, not
resynthesized; thirteen existing Jenny clips remain at native tempo. All visuals
stay 1x. Four original local logos/posters and their source qualifications remain.

Nine-scene capture snapshot
`aef7601febead8473ed794fd603f75987f5eaa90cbcec930d9946ee76e950452`
matches all 25 Builder assets. Initial rehearsal failed an incorrect hidden-vs-closed
details assertion; corrected to no open disclosure. A subsequent rehearsal was
cancelled, left no completion report and had no running process on resumption.
Final rehearsal `chat-review-wk8L9g` passed, followed by one formal recording
`chat-preview-qIJm9M`, 55.8 seconds. Both prove zero first-typing scroll/composer
change and visible changing native spinner transforms. No extra preparation
delay was added: product 700ms timer remains. No delivery/acceptance is claimed.
Existing capture-only calendar/search delays remain simulated, not provider latency.

[Preparation/edit helper](../browser-artifacts/demo/month-invitation-video-20260921/produce.cjs),
[scoped approval](../browser-artifacts/demo/month-invitation-video-20260921/prepared-o00PcS/approval.json),
[verification helper](../browser-artifacts/demo/month-invitation-video-20260921/verify.cjs).
Edit SHA-256 `8ad0a90caf7a9fb40e439e6e4e6895a90172868458a89463f5bea25ba2966043`.
Full H.264/AAC decode, 1440x1020/25fps/48kHz stereo, source/raw/output hashes,
captions and nine source-frame mappings passed. Upper-page difference around
initial typing is 0.0224 grayscale units; invitation spinner changes by 17.39
units between sampled frames in the final output near 57.38 seconds. WHITE at
33.92-34.92 passes all25frames and boundaries. Historical movie click/separate
official still remains an editorial insert, not newly accessed live evidence.
Audio mean -20.8dB, peak -4.4dB; longest silence 3.850 seconds.

Selected final typing, month, invitation preparation, ideas, opening, white,
official-page and closing frames visually inspected. Production tests 29/29 and
editor diagnostics passed. Human continuous review/audition and image publication
rights remain pending. No new speech, public requests, shared pages/services,
calendar writes, real invitations, installs, publication, commit or push.
Previous attempts and outputs preserved; one formal capture approval consumed.

## Original Images Restored, 21 September 2026

Previous [74.64-second MP4](../browser-artifacts/demo/family-story-Jk0E21/familycopilot-family-story.mp4),
[English SRT](../browser-artifacts/demo/family-story-Jk0E21/familycopilot-family-story.en.srt),
[manifest](../browser-artifacts/demo/family-story-Jk0E21/manifest.json),
[verification](../browser-artifacts/demo/family-story-Jk0E21/verification.json).
Owner requested recovering missing images, then updating the video. All four
original local logos/posters were still present; they had been excluded from the
previous capture snapshot. Git ignore rules remain unchanged. No new artwork,
download, product modification or public reuse permission is implied.

Image recovery review `chat-review-sVwvlM` verified the original four hashes and
loaded images. Full-story snapshot `a3a05e11af2effe001369ccfee7e95aa2e8c8dd4859dc505f5c8ef74e2727c88`
has the same 25 assets as recovery snapshot `dbfa0a215f5a8a0766999d5dbc005021921b281f888af8cf2da39ecb286ff55d`:
21 unchanged Builder assets plus four original reference images. Full rehearsal
`chat-review-aeVP9p` passed eleven scenes, then one formal `chat-preview-7tWada`
recording captured 60.76 seconds. Zero missing images, forbidden requests or
browser errors. Capture scope consumed; no shared pages or services touched.

[Preparation/edit helper](../browser-artifacts/demo/restored-images-video-20260921/produce.cjs)
and [approval](../browser-artifacts/demo/restored-images-video-20260921/approval.json)
preserve the bounded revision. Edit SHA-256:
`5296d65dad435a1286e70cf4f8b1afefa7a7b4d52785c9a251a9e970502c582e`.
All video/audio stays at 1x with fourteen existing Jenny clips, no new synthesis.
Prior movie click and separate official-page still remain historical inserts;
WHITE browser content at 39.40-40.40 is editorial, not measured navigation latency.

Full H.264/AAC decode, 1440x1020/25fps/48kHz stereo, captions, all source/output
hashes, thirteen source-frame mappings and 25 white frames passed. Audio mean
-20.6dB, peak -4.4dB, longest silence 3.768 seconds. Selected final opening,
ideas, weekend, white, official page, pending and closing frames visually reviewed.
Focused helper syntax/editor checks passed; broad product tests were not rerun.
Human continuous viewing/audition and public image reuse rights remain pending.

The owner's first-story feedback remains a separate design decision: explain
calendar consolidation, not availability, and do not focus on one day. The
[monthly concept](../browser-artifacts/demo/month-overview-sample-20260921/review-vZCnY1/month-overview.png)
is only a static proposal. Neither it nor a story rewrite is applied in this
image-only revision. Older videos, snapshots and original media remain preserved.

## Integrated Preferences In Video, 21 September 2026

Previous [74.20-second MP4](../browser-artifacts/demo/family-story-8ecJla/familycopilot-family-story.mp4),
[English SRT](../browser-artifacts/demo/family-story-8ecJla/familycopilot-family-story.en.srt),
[manifest](../browser-artifacts/demo/family-story-8ecJla/manifest.json),
[verification](../browser-artifacts/demo/family-story-8ecJla/verification.json).
Owner requested Update video after approving the integrated preference design.
New footage shows the actual family identity layout and seven equal-weight
interests. Brief preference hold retained as accepted, no optional extra pause.
All visuals and fourteen existing Jenny clips remain at 1x; no new synthesis.

Builder snapshot `a74147a68b7db1cba4725c29ba30c69859e4823582a22626775e5fdec39df8f7`
and capture snapshot `228f845e0f0319d05dc1ea9f36f69065173c5493427e637b60e0a72f3177011a`
have identical 21 assets. Eleven-scene rehearsal `chat-review-hVTqaf` and one
formal capture `chat-preview-nFDqgo` (60.32 seconds) passed with no unexpected
requests or page errors. Four explicitly allowlisted missing image GETs return
local 404s and display the existing product fallback, not substitute artwork.
No external request, private data, provider call, shared-page/service operation,
real invitation, calendar write, install or publication. Capture scope consumed.

Source-continuous calendars/shared-times/activity scroll remains. Movie insert
37.96-42.96 retains the historical 1.20-second actual click (including its original
poster), then WHITE browser area 39.16-40.16 and the prior official-page still.
It is a separate historical insert, not continuous current-UI navigation or a
measured load. Newly recorded cards show missing images; this is not concealed.
Capture-only two-second calendar/search delays retain prior documented scope.

[Preparation/edit helper](../browser-artifacts/demo/preferences-video-20260921/produce.js),
[edit](../browser-artifacts/demo/preferences-video-20260921/edit.json),
[approval](../browser-artifacts/demo/preferences-video-20260921/approval.json) and
[verification helper](../browser-artifacts/demo/preferences-video-20260921/verify.js)
preserve reproducibility. First render `family-story-Nhk6ra` failed the pause gate
at 4.175 seconds; retained. Moving only the weekend question voice 0.64 seconds
later reduced final longest silence to 3.640 seconds. No recapture or acceleration.

29/29 bounded production tests and editor diagnostics pass. Full H.264/AAC decode,
1440x1020/25fps/48kHz stereo, raw/source/output hashes, current preference snapshot,
source-frame mappings and caption bounds verified. All 25 white frames pass pixel
checks with nonwhite frames immediately before/after. Audio mean -20.6dB, peak
-4.4dB. Selected final opening, preferences, member calendar, weekend card, white
wait, official page, pending and closing frames visually inspected. Human full
continuous viewing/audition and publication review remain pending.

## White-Screen Correction, 21 September 2026

Previous [73.96-second MP4](../browser-artifacts/demo/family-story-CX1r7l/familycopilot-family-story.mp4),
[English SRT](../browser-artifacts/demo/family-story-CX1r7l/familycopilot-family-story.en.srt),
[manifest](../browser-artifacts/demo/family-story-CX1r7l/manifest.json) and
[verification](../browser-artifacts/demo/family-story-CX1r7l/white-wait-verification.json).
Owner clarified that the one-second movie wait must be white, not a frozen card,
and approved offline correction plus a separate Builder preference static draft.
This corrects the previous claim of fully meeting the transition request.

The click remains at 37.80-39.00, followed by white browser content at 39.00-40.00,
then the same separate-browser official still until 42.80. Caption band retained.
The blank second is editorial simulation, not measured loading time. No new
recording, website request, synthesis, private access or shared-page operation.
Existing assets, raw sources and prior renders preserved. All actions/audio 1x.

[Revision helper](../browser-artifacts/demo/white-wait-20260921/revise.js) pins the
old edit and produces the new [edit](../browser-artifacts/demo/white-wait-20260921/edit.json).
28/28 offline production tests, editor diagnostics, full H.264/AAC decode and
source hashes passed. All 25 white frames checked, grayscale pixels at least 250;
immediate before/after frames are not white. Eight other sampled frames match
the previous output with mean difference below 0.06. SRT bytes and decoded audio
match the prior version exactly. Click/white/official frames visually inspected;
human continuous viewing and audition remain pending.

Builder delivered [standalone preferences draft](designer/preferences-review.html),
promoting family identities, shared interest icons and team typography while
de-emphasizing location/settings. No replacement third-party images downloaded.
1440x900 and 390x844 isolated offline static checks/screenshots passed, no external
requests or page errors; browser closed. Draft permits local typing/read-only
settings but Send is disabled. Not integrated into product or this video. User
design review is the next gate, not another automatic capture or deployment.

## Natural Copy And Movie Wait, 21 September 2026

Previous [73.96-second Jenny MP4](../browser-artifacts/demo/family-story-Pjd8Et/familycopilot-family-story.mp4),
[English SRT](../browser-artifacts/demo/family-story-Pjd8Et/familycopilot-family-story.en.srt),
[manifest](../browser-artifacts/demo/family-story-Pjd8Et/manifest.json) and
[verification](../browser-artifacts/demo/family-story-Pjd8Et/verification.json).
Owner's latest approval covers the natural-copy revision, isolated synthetic
recapture and offline edit. Opening production eyebrow removed; Builder removed
visible Demo terminology, consolidating source facts in Sample calendars and
existing Details. No replacement invitation nag. Preferences remain brief and
unchanged. Calendar/member/shared-time order and continuous activity scroll remain.
All footage, animation and fourteen reused Jenny clips are 1x. No new synthesis.

Builder snapshot `e7aaece55caf8a85555a8fdeff5383db45fa122af0252cf1ce7ce748e55fb33b`
matches all 25 assets in production snapshot
`c52d22ecfa470110c5d724204116308a753bb74613e94529b18fed0324e0a2b6`.
Eleven-scene rehearsal `chat-review-DgoVAO` and one formal 60.16-second capture
`chat-preview-64ZY8r` passed with zero forbidden requests/errors; raw preserved.
Capture-only two-second preparation/search delays retained, not measured latency.
Capture approval consumed. No shared tabs/services, private calendars, live
searches, real invitation, writes, installs, publication or new website visits.

Movie 37.80-42.80 uses 1.20 seconds of the original actual click, one second of
last-frame editorial waiting, then 2.80 seconds of the existing official-page
still. This remains a cross-browser edit, not uninterrupted navigation or website
latency evidence. Existing unverified-showtime qualification remains on the card.
School narration moves nearer typing completion; no accelerated action or voice.

[Reproducible preparation](../browser-artifacts/demo/natural-copy-20260921/produce.js),
[edit](../browser-artifacts/demo/natural-copy-20260921/edit.json),
[approval record](../browser-artifacts/demo/natural-copy-20260921/approval-record.json)
and [verification helper](../browser-artifacts/demo/natural-copy-20260921/verify.js)
retain exact sources. 28/28 bounded production tests and editor diagnostics pass.
Full H.264/AAC decode, 1440x1020/25fps/48kHz stereo, hashes and caption bounds pass.
Eleven final/source frame comparisons have mean grayscale difference below 0.08;
wait frames match and the official page begins after the added second.
Audio mean -20.6dB, peak -4.4dB; longest measured silence 3.518 seconds.
Selected final opening, member calendar, scroll, movie wait/page, proposal,
pending and closing frames reviewed. Human continuous viewing/audition pending.
All older outputs retained. Final video SHA-256:
`21684ef5080c4288b483cad5d8a40c4475efe2155750b1acb449e8089dbb21b8`.

## Member Calendars At Native Speed, 21 September 2026

Previous [71.32-second Jenny MP4](../browser-artifacts/demo/family-story-6HowK2/familycopilot-family-story.mp4),
[English SRT](../browser-artifacts/demo/family-story-6HowK2/familycopilot-family-story.en.srt),
[manifest](../browser-artifacts/demo/family-story-6HowK2/manifest.json) and
[verification](../browser-artifacts/demo/family-story-6HowK2/verification.json).
Owner separately approved isolated synthetic recapture and the three exact Jenny
replacement lines. Both operation approvals are now consumed. The new sequence
shows calendar preparation, interest-based activity search, month/member day
calendars, possible shared times, then continuous native scroll to two ideas.
Both stories, original opening animation and all voice clips play at 1x.
Reset and a static school-offer hold are cut; no action footage is accelerated.
Long independent simulation sentence is now Builder's `Demo invitation` status;
existing Calendar demo/no-delivery details remain. Child ownership, consent and
Parent A awaiting response are unchanged. Parent tracks are busy-only, not unrestricted
private event access. No real invitation or calendar write is demonstrated.

Builder snapshot `d3c76cf2...` supplies all 25 identical assets in production
snapshot `39b2d2f314318eeb53cdd12c7515aecac8c65b5e2d609269eaeaa84fd78de992`.
Final no-video rehearsal `chat-review-slYNpT` passed eleven scenes; formal capture
`chat-preview-NyuO2J` is 60.36 seconds, zero forbidden browser requests/errors,
with original WebM preserved. Two prior failed rehearsals are retained: one
exposed a completion/status visibility race; another exposed an incorrect async
wrapper around synchronous meeting coordination. Recorder repair now delays only
async calendar preparation and activity search, preserves meeting return values,
and checks processing completion before measuring status visibility. Four total
two-second waits are capture-only simulations, not product/provider latency.

[Edit](../browser-artifacts/demo/member-calendars-20260921/edit.json),
[approval record](../browser-artifacts/demo/member-calendars-20260921/approval-record.json),
[speech request](../browser-artifacts/demo/member-calendars-20260921/speech-request.json)
and [reproducible verification](../browser-artifacts/demo/member-calendars-20260921/verify-edit.js)
retain the source chain. Exactly three Jenny requests, 264 characters, no retry,
plus eleven prior clips with only sentence-edge silence trims. Official movie
join at 37.92-41.92 reuses the original actual click and separate-browser page
still, not a new visit or continuous successful navigation.

28/28 bounded production tests and editor diagnostics passed. Full H.264/AAC
decode, 1440x1020 at 25fps, 48kHz stereo, all source/raw/snapshot/output hashes and
caption bounds passed. Eleven sampled final/source comparisons confirm 1x timing,
including frames within the uncut scroll (mean grayscale difference below 0.08).
Selected final frames inspected for opening, calendar loading, member tracks,
summary, scrolling, school loading/proposal, official page, pending and closing.
Audio mean -20.5dB, peak -4.4dB; longest silence 3.318 seconds accompanies school
loading/scrolling. Other 2-3-second visual beats cover reading or typing, not
blank screens. Human audition and continuous viewing remain pending. No shared
tabs/services, real calendars, live searches, publication or installs were used.

## Member-Calendar Revision Pending Capture, 21 September 2026

Owner selected member calendars before shared available times and authorized
Builder delegation. The [new handoff](chat-builder-handoff.md) implements this
with three presentation assets, interest-based progress wording and concise
`Demo invitation` context; 209/209 pinned tests passed. No new domain access,
fixtures or real invitation. The [latest storyboard](demo-recommendation-storyboard.md)
requires continuous scrolling, all actions at 1x, shorter sentence gaps rather
than acceleration, `Family Copilot suggests` and duration below 120 seconds.
The 60.12-second video below remains a previous review baseline, not completion
of this new brief. New browser rehearsal/capture and exact replacement paid
speech require scoped approval; none was executed under delegation authority.

## Calendar Emphasis And Normal-Speed Opening, 21 September 2026

Current [60.12-second Jenny MP4](../browser-artifacts/demo/family-story-iSCdAK/familycopilot-family-story.mp4),
[English SRT](../browser-artifacts/demo/family-story-iSCdAK/familycopilot-family-story.en.srt),
[manifest](../browser-artifacts/demo/family-story-iSCdAK/manifest.json) and
[verification](../browser-artifacts/demo/family-story-iSCdAK/verification.json).
Owner approved an offline revision after finding the opening accelerated and
calendar loading underemphasized. Original animation source 2-11.2 seconds now
plays at 1x for 9.2 seconds; first question/calendar source 11.48-18.84 also plays
at 1x. Calendar scene spans 15.2-26.4 in the final video, with a 3.84-second hold
on the actual loaded result. Parent A, Parent B and Child Loaded labels and the October
range remain visible through the dedicated calendar narration at 21-25.35.
This is a result-reading hold, not real latency or sequential member loading.
The source spinner represents saved activity search; calendar work is synchronous.

The [separate edit](../browser-artifacts/demo/paced-animation-20260921/edit-calendar.json)
reuses fourteen approved Jenny clips, including two older hash-verified query
and calendar lines. Existing 1.12x voice tempo and later action-shot speeds remain;
only the opening and first query/calendar visuals were restored to normal speed.
No new capture, browser, network or paid speech. Existing Chiikawa cross-browser
join moves to 33.68-37.68, with the official-page still at 34.88-37.68. It remains
an editorial join, not uninterrupted navigation or a confirmed screening.

Intermediate lqBGEI and mrGqmc outputs failed visual review and are preserved,
not deliveries. An isolated filter check showed time-based padding emitted only
184 frames; explicit 96-frame padding after fps normalization produced the
required 280 frames (11.2 seconds). Final calendar region differences at 25.2
and 26.32 versus 21.4 seconds are both about 0.012 grayscale levels, and the held
result was visually inspected. Movie page, Child pending response and ending
frames were also inspected. Full decode, source/raw/snapshot/output hashes and
caption bounds passed. Audio mean -20.1dB, peak -4.4dB; maximum measured silence
1.730 seconds. Human continuous viewing/audition and publication consent remain
pending. The owner's previous audible-playback confirmation applies to the
previous version, not a completed human review of this revision.

## Official Chiikawa Page Added, 21 September 2026

Previous [50.28-second Jenny MP4](../browser-artifacts/demo/family-story-VYYUzc/familycopilot-family-story.mp4),
[English SRT](../browser-artifacts/demo/family-story-VYYUzc/familycopilot-family-story.en.srt),
[manifest](../browser-artifacts/demo/family-story-VYYUzc/manifest.json) and
[verification](../browser-artifacts/demo/family-story-VYYUzc/verification.json).
After the failed headless attempt, the owner explicitly requested a workaround.
A new integrated-browser tab successfully opened the identical public Chiikawa
URL and rendered its correct English title and poster. No security settings,
website content, login state or product data were modified to make it work.

The 23.84-27.84-second movie shot uses the preserved real card-click footage,
then holds a real screenshot of the separately opened page from 25.04-27.84.
This is an editorial join across browsers, not a continuous successful headless
navigation or a fresh screening check. The failed Access Denied take remains
preserved. The public page's header, movie title, poster, classification, runtime
and selection notice remain in frame. No showtime selection, trailer playback,
booking, login or purchase was performed. The integrated browser used normal
page dependencies; do not claim its requests followed the headless allowlist.
One website JavaScript error was observed despite successful visible rendering;
this is not a certification of all website controls.

[Movie source evidence](../browser-artifacts/demo/paced-animation-20260921/movie-evidence.json)
pins the screenshot, raw click footage, exact URL and crop. The
[separate edit](../browser-artifacts/demo/paced-animation-20260921/edit-movie.json)
retains the prior animation, preference bridge, Child ownership and exact Jenny
clips. No new synthesis. Full decode, source/snapshot/output hashes, caption
bounds and audio checks passed; longest measured silence 1.730 seconds, mean
-19.9dB, peak -4.4dB. 27/27 bounded production tests passed. Final frames for the
click, official page, animation and Child pending-response state were inspected.
Continuous human viewing/audition and publication consent remain pending.

## Animated And Paced Revision, 21 September 2026

Previous [48.92-second Jenny MP4](../browser-artifacts/demo/family-story-gyjx2k/familycopilot-family-story.mp4),
[English SRT](../browser-artifacts/demo/family-story-gyjx2k/familycopilot-family-story.en.srt),
[manifest](../browser-artifacts/demo/family-story-gyjx2k/manifest.json) and
[pacing evidence](../browser-artifacts/demo/family-story-gyjx2k/pacing-review.json).
This restores actual original animation with a nameless opening, adds the brief
interest-summary/calendar bridge before the October question, tightens pauses
and uses the current Child-owned school event before and after the invitation.
The first action loads calendars as implemented; no pre-query loaded state is
fabricated. Existing twelve Jenny clips retain their exact words, with measured
head/tail silence trims and 1.12x offline tempo. One approved generic bridge was
synthesized once on the existing Jenny resource, without retry. No new voice was
requested for the subsequent movie-link idea.

[Approval record](../browser-artifacts/demo/paced-animation-20260921/approval-record.json),
[edit](../browser-artifacts/demo/paced-animation-20260921/edit.json) and
[capture](../browser-artifacts/demo/chat-preview-Cx97vX/manifest.json) preserve
the source chain. Builder's 25 assets at `4275e114...` match the final framed
media snapshot `b0b31d43815bf1de82757ebe63148e1bd7e3a27ea88c7208558f5019f0d88456`.
Two isolated rehearsals corrected final framing; one formal synthetic capture
passed ten scenes, zero external requests and zero browser errors. No shared
tab/service, private calendar, live activity search or real invitation was used.
Cuts and accelerated action shots are editorial, not continuous latency evidence.

Full H.264/AAC decode, 1440x1020 at 25fps, 48kHz stereo, caption bounds and source,
raw-video and snapshot hashes passed. Mean audio -19.8dB, peak -4.5dB. Largest
measured silence is 1.614 seconds at -42dB; maximum scheduled clip gap is 1.444
seconds, replacing prior 4-6.5-second gaps. The lower animation region changes
18.36% of pixels between 1.2 and 5.6 seconds. Visual checks cover opening,
preferences, school ownership before/after consent and ending. The intermediate
`family-story-zShsnZ` is preserved but superseded because it clipped the heart.
Continuous human viewing/audition and wider-sharing consent remain pending.

### Requested Official Movie Click: Blocked

The owner then requested the v1-style real-site click for Chiikawa. The exact
card URL is `https://www.vscinemas.com.tw/vsweb/film/detail.aspx?id=8786`.
Read-only web extraction identified the expected movie, but the actual isolated
browser click returned **Access Denied**. These are different access paths;
the text extraction is not evidence of successful browser playback.
[Attempt evidence](../browser-artifacts/demo/movie-source-5zP23W/failure.json)
records one allowed document request, no other resources and no automatic retry.
The raw click/page videos and denial frame are preserved in that directory.
No official-page segment has been inserted into the current MP4. Do not retry,
change providers or fabricate a success without new scoped approval. A public
page opened normally and explicitly shared/approved for capture is a possible
next step. No booking, login, purchase or calendar operation is authorized.

## Current UI With Jenny, 21 September 2026

Latest [74.48-second narrated MP4](../browser-artifacts/demo/family-story-sGwsd8/familycopilot-family-story.mp4),
[English SRT](../browser-artifacts/demo/family-story-sGwsd8/familycopilot-family-story.en.srt),
[manifest](../browser-artifacts/demo/family-story-sGwsd8/manifest.json) and
[eight-frame review](../browser-artifacts/demo/family-story-sGwsd8/visual-review.json).
This replaces the opening-only silent revision as the current delivery. It
includes the no-Stop UI, current action plus upcoming calendar-comparison step,
natural invitation dialogue, separate visible simulation disclosure, nameless
opening and English Jenny narration. Supporting Calendar demo/source labels are
still present; this does not claim all demo labels were removed or a real send.

Owner approved new isolated rehearsal/capture, then separately approved all
12 exact generic narration lines and existing Azure Speech resource/budget.
[Approval record](../browser-artifacts/demo/current-ui-voice-20260921/approval-record.json)
and [exact speech request](../browser-artifacts/demo/current-ui-voice-20260921/speech-request.json)
preserve scope. Exactly 12 synthesis requests for 596 text characters completed,
with no retry, alternate provider or resource change. Voice: `en-US-JennyNeural`,
friendly, -3%, on existing `hackathon-VDI-taipei-tts` in eastus. No real names,
dates or private calendar payloads were sent. Capture and speech approvals are
consumed; the request's preapproval status is preserved, not rewritten.

Builder snapshot `d4edafb7e596be589986d6d0c44c4a962645e90f98c00343c16eec3bdc3e5fb1`
has 208/208 pinned unit evidence. All 25 frozen assets match the nine-scene
[media snapshot](../browser-artifacts/demo/current-ui-voice-20260921/snapshot/snapshot.json),
SHA-256 `e384ba9f2166bb2000ec10b6c0c3acd9e09f22a0f0e6e3a1cb9b869ed28f4029`.
Rehearsal `chat-review-cIckdj` and one formal capture `chat-preview-jq4iUj`
passed nine scenes with zero forbidden requests/browser errors. Capture lasts
55.24 seconds. No shared page, server, live calendar/search or real invitation
was touched. Two 2000ms activity delays remain capture-only latency simulation;
other fast processing phases may finish before paint.

The [edit](../browser-artifacts/demo/current-ui-voice-20260921/edit.json) pins
capture, illustration and speech hashes. Source cuts 1.12-29.48 and 31.52-55.24
exclude reset; intro lasts 11 seconds, chapter 39.36-43.36, school conversation
43.36-67.08, closing 67.08-74.48. Native product speed is unchanged. Every spoken
clip fits its exact caption cue; outcomes follow visible results. Captions align
to clips, not individual words.

Existing complete-story compositor now supports optional pinned speech and
`--family-speech-approved <request.json> --sha256 <approved-hash>`. The latter
uses an exclusive attempt directory and bounded fixed-provider requests; it
must never be invoked without fresh scoped approval. Offline render uses
`--family-edit <edit.json> --sha256 <hash>` and never invokes synthesis.
24/24 bounded production tests passed, including scope and timing failures.
Full H.264/AAC decode, 1440x1020/25fps, 48kHz stereo, source hashes and caption
bounds passed. Mean audio -21.7dB, peak -4.5dB. Eight final frames were inspected,
including both processing states, invitation offer/result, opening and ending.
Continuous human viewing/audition remain pending. Real names remain in footage;
wider-sharing consent and image rights remain unresolved. All older outputs are
preserved. No product code was changed by Producer.

## Scenario Opening Revision, 21 September 2026

Owner approved changing the actual opening display as well as the script.
Delivered [69.76-second silent MP4](../browser-artifacts/demo/family-story-YcLb56/familycopilot-family-story.mp4),
[English SRT](../browser-artifacts/demo/family-story-YcLb56/familycopilot-family-story.en.srt),
[manifest](../browser-artifacts/demo/family-story-YcLb56/manifest.json) and
[seven-frame review](../browser-artifacts/demo/family-story-YcLb56/visual-review.json).
The first nine seconds now display "Between work, school, and everything else,"
and "finding time together takes planning." Opening captions use those sentences,
then "A parent turns to Family Copilot." The small context label is
"ILLUSTRATIVE SCENARIO / SAMPLE CALENDARS". No named-person introduction remains
in the opening titles, burned-in captions or SRT.

This is an opening-only offline edit, not a fresh capture. All later segments,
cut points and captions are unchanged from `family-story-JlA6rW`. The
[edit specification](../browser-artifacts/demo/scenario-opening-20260921/edit.json)
SHA-256 is `d3a7096dbbe8ef3e566c886a9adf3cb694d654c6cc41986e46a03516ba693afc`.
Existing hash-pinned source capture `chat-preview-83KOMN` and family art are reused.
Full H.264 decode, 1440x1020, 25fps, 69.76-second duration, intentional no audio,
caption bounds, unchanged later-segment assertions and source hashes passed.
Seven final frames, including all three opening caption beats, were inspected.
No helper/product code changes, new browser, services, synthesis or unit-test
rerun were needed. Earlier files are preserved; human continuous review is pending.

The owner clarified that these names identify real people. Do not describe them
as a fictional family or imply factual biography, consent or endorsement from
synthetic calendar footage. Names remain later in this cut, so it is not anonymized.
Existing `Demo invitation` dialogue also remains: Builder's separately requested
copy correction requires its own reviewed handoff and approved capture before
integration. Image rights and consent for wider sharing remain unresolved.

## Corrected Prompts Video, 21 September 2026

Completed the owner's request to fix internal lifecycle text, reset composer
prompts and generate the video. Latest [69.76-second silent MP4](../browser-artifacts/demo/family-story-JlA6rW/familycopilot-family-story.mp4),
[English SRT](../browser-artifacts/demo/family-story-JlA6rW/familycopilot-family-story.en.srt),
[manifest](../browser-artifacts/demo/family-story-JlA6rW/manifest.json) and
[selected-frame review](../browser-artifacts/demo/family-story-JlA6rW/visual-review.json).
The prior copy issue is resolved: the weekend frame at 28 seconds shows
`Earlier suggestions`. All composer placeholders use `Message Family Copilot...`;
typed user questions remain actual inputs, not prefill.

Builder changed three copy-bearing assets, with 205/205 pinned unit tests
in the [handoff](chat-builder-handoff.md). Product snapshot SHA-256:
`4a77796cb2ec5dde5fb81e62080e03fc3436c8be0e09ef09ba4e0403eb4b4def`.
The unchanged nine-scene media scenario uses those exact 25 assets in
[the recording snapshot](../browser-artifacts/demo/snapshot-natural-prompts-8afb3c32-7b11-439e-ae84-97b64a2ee3c2/snapshot.json),
SHA-256 `00d2fd9bd2311eab8de70e0e178dce5085e18e43027ab01fec617f6c2bf4df34`.
Isolated rehearsal `chat-review-lRubfP` and formal capture `chat-preview-83KOMN`
passed nine scenes with zero forbidden I/O/browser errors.

The raw capture lasts 55.92 seconds. The
[edit](../browser-artifacts/demo/chat-preview-83KOMN/family-edit.json) uses source
1.12-29.44 and 31.48-55.92, excluding reset; chapter 37.32-40.32, school conversation
40.32-64.76, family ending 64.76-69.76. Full decode, 1440x1020 H.264/25fps,
intentional no audio, caption bounds and source identity passed. Ten final-video
frames were visually inspected. Captions are scene-timed, not word-aligned.
Native scrolling and two capture-only simulated two-second waits remain.
Earlier files are preserved. No shared tab/service, real invitation/calendar
write, provider query, new synthesis or publication. Human continuous review
and image rights remain pending; recording approval is consumed.
No production helper changes were needed for this revision.

## Invitation story review cut, 21 September 2026

Owner approved isolated desktop rehearsal and silent recording with network
blocked. New delivery: [68.16-second MP4](../browser-artifacts/demo/family-story-awye1K/familycopilot-family-story.mp4),
[English SRT](../browser-artifacts/demo/family-story-awye1K/familycopilot-family-story.en.srt),
[manifest](../browser-artifacts/demo/family-story-awye1K/manifest.json),
[selected-frame review and remaining issue](../browser-artifacts/demo/family-story-awye1K/visual-review.json).
This is a review cut, not complete editorial signoff: one internal-sounding
product message remains, as described below.

The film retains the nine-second family opening, outing questions, actual UI
loading and smooth scrolling. Movie framing now reaches title, venue, duration,
admission, price and showtime navigation. The chapter at 37.00-40.00 introduces
school responsibilities without narrating a conversation reset. Parent B asks at
40.00; Copilot immediately suggests inviting Parent A with event details, then an
explicit invitation request produces a labelled demo invitation pending response.
The family closing begins at 63.16. Technical verification narration, the earlier
proposal/ask-Parent A loop and Undo are absent. Actual source and uncertainty labels
are preserved; no real invitation, reminder or calendar write is implied.

Producer's [nine-scene scenario](../browser-artifacts/demo/invitation-story-20260921/scenario.json)
was bundled from the pinned Builder bytes, not the mutable workspace. All 25
product asset hashes match Builder snapshot `257e1b1f...` exactly. The derived
[snapshot](../browser-artifacts/demo/invitation-story-20260921/snapshot/snapshot.json)
SHA-256 is `2510b73c3f1fc1fbf2570f7a20d5325dfd5bca7e0c12150b98cbf7ac5bc8c058`.
Disposable rehearsal `chat-review-sJXmOa` passed nine scenes with zero forbidden
I/O or browser errors; five result frames were visually inspected before capture.
Formal capture `chat-preview-Onsr4q` passed the same assertions and full decode
at 54.24 seconds. Both use in-memory routes, no listening server or shared tab.
Two 2000ms capture-only activity delays are simulation, not service performance.

The [hash-pinned edit](../browser-artifacts/demo/invitation-story-20260921/edit.json)
uses source 1.12-29.12 and 31.08-54.24, excluding reset/setup footage. Existing
family art is reused; all prior files are retained. Final H.264 decode, 1440x1020
dimensions, 25 fps, 68.16-second duration, intentional no-audio stream, caption
bounds and source hashes passed. Thirteen final frames were inspected, not a
continuous human viewing. No production helper code was changed; the actual
scenario/edit validators ran. Prior 203 product tests were not rerun or presented
as new browser evidence. No new synthesis, provider calls, product changes or
delegation occurred. Rehearsal/capture approval is consumed. Image publication
rights and continuous human review remain pending.

### Remaining Builder Copy Issue

Historical issue, resolved by the Corrected Prompts Video above. The older
68.16-second recording remains unchanged for evidence.

At 26.8 seconds, [the weekend loading frame](../browser-artifacts/demo/family-story-awye1K/review-loading-weekend.png)
shows `Previous search retired.` from
[the history invalidation path](../chat/conversation-core.js#L84). Reproduce by
submitting October, then the distinct weekend question and inspecting history
during processing. Expected: natural parent-facing language for superseded ideas,
not internal lifecycle jargon. Acceptance: update real product copy and a focused
regression without weakening stale-result invalidation, source/coverage truth or
request/consent guards; then pin a fresh snapshot. Do not cover the message in
postproduction. This capture approval does not authorize another product change
or recording. The four rejected technical caption patterns are removed, but this
remaining on-screen message prevents claiming a fully polished final demo.

## Invitation revision implemented offline, 20 September 2026

The owner rejected repetitive verification/debug-like narration, the mechanical
conversation transition and the proposal-only school outcome. After reviewing
the invitation direction, the owner explicitly approved implementation. Producer
delegated product changes to Builder as sole product writer and updated the
[storyboard](demo-recommendation-storyboard.md). Builder's
[handoff](chat-builder-handoff.md) records 203/203 passing hash-bound unit tests.

The assistant now checks both parents on Parent B's school question and immediately
suggests inviting Parent A, conditional on one-parent attendance. Recipient and event
details precede Parent B's explicit send request. The result is a clearly labelled
page-local Demo invitation awaiting Parent A's response, not real delivery or acceptance.
No reminder was added. Duplicate submissions do not resend; context and consent
checks remain fail-closed. Main outing dialogue is shorter; material showtime,
calendar coverage and saved-source qualifications remain in the UI and details.
They are no longer repeated as technical narration in the revised script.

New snapshot:
[snapshot manifest](../browser-artifacts/demo/snapshot-320af2d1-200d-462c-b47d-0c5f0a9fd192/snapshot.json),
SHA-256 `257e1b1fe2721cc66ad8f99b8d1945f6541061b3f10a8bd4d5c000bd2eaa6aa7`.
Only six product assets changed; fixtures and coverage were not widened.
This increment authorizes offline implementation/tests/handoff only. No browser,
new recording, synthesis, real invitation, calendar write or shared-service
operation occurred. The 67.04-second MP4 below is preserved as an earlier review,
not a video of the new flow. New desktop rehearsal/capture need separate approval.

## Family-story editorial cut delivered, 20 September 2026

The owner approved the revised storyboard and offline continuation. Delivered:
[67.04-second silent MP4](../browser-artifacts/demo/family-story-cpocKr/familycopilot-family-story.mp4),
[English SRT](../browser-artifacts/demo/family-story-cpocKr/familycopilot-family-story.en.srt),
[production manifest](../browser-artifacts/demo/family-story-cpocKr/manifest.json),
[selected-frame review](../browser-artifacts/demo/family-story-cpocKr/visual-review.json).

The nine-second illustrated introduction names Parent B and Parent A as Child's parents.
Outings run from 9.00 to 37.44; a three-second chapter explicitly introduces a
separate conversation about sharing school responsibilities. School coordination
runs from 40.44 to 62.04, retaining the user question, conflict, alternate-parent
question and separate consent. The final product state is pending Parent A's
confirmation. A five-second illustrated Family Copilot closing ends the film.
Reset/menu travel and Undo are omitted, not disabled or altered in the product.
Outcome captions follow visible results instead of announcing them during typing.

The two native-pixel product clips reuse source intervals 1.16-29.60 and
31.60-53.20 from the earlier 57.56-second capture. The family illustration reuses
a clean crop of an existing opening frame, without its previous narration/text.
The private [edit specification](../browser-artifacts/demo/family-edit-20260920-v1/edit.json)
pins capture and image hashes. The existing complete-story compositor now supports
`node scripts/render-complete-demo.js --family-edit <edit.json> --sha256 <hash>`;
it validates frame-aligned cuts and captions, creates a fresh private output,
fully decodes the result and rechecks source hashes. Original outputs are preserved.

Checks performed: 22/22 bounded production tests; full H.264 decode at 1440x1020,
25 fps and 67.04 seconds; intentional absence of audio; caption bounds and input
hashes; eleven selected final frames covering opening, cuts, cards, loading,
chapter, conflict, consent, proposal and closing. No new recording, browser,
product change, delegation, network call or speech synthesis. Shared tabs and
services were untouched. Human continuous viewing remains pending.

Synthetic calendars, saved public activity facts and two capture-only simulated
loading waits remain explicit source limitations. Family relationships are the
fictional premise, not authenticated identity. Parent A is not contacted and no
calendar is changed. Some activity details remain below the captured viewport;
the October preference reason and practical information are visible, while the
September card remains poster-heavy. Image rights and narrated/public release
are not approved. This supersedes the prior technical cut as the current review.

## Editorial revision requested, 20 September 2026

The owner identified five issues in the 60.56-second cut: no introduction,
unclear family relationships, unnecessary Undo in the main story, script/design
alignment, and no satisfying ending. That file remains a technical review cut,
not an accepted final story. The [revised storyboard](demo-recommendation-storyboard.md)
now establishes Parent B and Parent A as Child's parents, connects family leisure with
shared responsibilities, removes Undo from the main presentation, and ends on
the pending-Parent A next step followed by a family/brand closing. Undo remains a
product feature and regression test, not a required hero-demo beat.

The review also found premature result captions and poster-heavy activity framing.
Future edits should reveal evidence before explaining outcomes, retain the two
consent steps and avoid false completion or proactive-notification claims.
The actual coordination and closing design images were inspected along with the
current scenario, contract, design reading and earlier family-opening source.
This increment changes only script/production records. No new video, product
edit, delegation, browser operation, recording or speech synthesis occurred.

## Parent B-led two-story video delivered, 20 September 2026

The owner's latest "Go" approved isolated synthetic rehearsal and recording of
the verified Parent B-to-Parent A product revision. Delivered:
[60.56-second silent MP4](../browser-artifacts/demo/school-chapter-wDdirh/familycopilot-two-stories.mp4),
[English SRT](../browser-artifacts/demo/school-chapter-wDdirh/familycopilot-two-stories.en.srt),
[production manifest](../browser-artifacts/demo/school-chapter-wDdirh/manifest.json).

The outing story comes first, retaining both native UI loading waits and smooth
scrolling. At 29.60-32.60 a full-screen editorial "Another user story" chapter
introduces the school meeting. A new conversation follows: Parent B asks about her
schedule, the UI computes her 30-minute conflict, she asks about Parent A, and a
separate Yes creates a proposal awaiting Parent A's confirmation. Undo withdraws it.
No proactive notification is fabricated. Preference editing is not demonstrated;
the existing family summary remains visible in the background.

Builder snapshot SHA is
`2ecadd6c8d86c82e0a3ae2db9684b0e9d1267d8955f93dcad36a19d6939013fb`.
The Producer nine-scene derivative retained privately (identifying path omitted) has SHA
`d8adaad95718379af39d23f92ee4b614394f788d968df2a5159be482155fc9d2`;
all 25 product asset hashes match. Only media order, assertions and pacing changed.
Disposable rehearsal `chat-review-lN67Cg` and one formal capture
`chat-preview-n3xxHs` passed all nine scenes with zero forbidden I/O/browser errors.
Both used intercepted local assets, blocked external network/storage and no server.
No shared page was touched. Native 1440x900 video is retained in a 1440x1020 export
with a 120px caption band, H.264 at 25 fps. The source is a continuous 57.56-second
recording; the final edit inserts a three-second chapter, not a screenshot sequence.

The recorder now checks loading only for actual activity searches, not meeting
replies. Two 2000ms response delays remain capture-only simulation, not measured
performance. The existing chapter compositor now supports the taller capture
without scaling. Production regressions passed 21/21; diagnostics, scoped
whitespace, complete decode, caption bounds, source/output hashes and ignored
media were checked. Rehearsal images showed both loading states, activity images,
conflict, separate consent, proposal and Undo. Final MP4 frames inspected: opening,
chapter, Parent B's input, computed conflict, consent question, pending proposal and
ending. This is scene-level browser evidence, not a complete product browser suite
or human continuous viewing; those broader claims are not made.

Recording approval is consumed. Prior media and frozen snapshots are preserved.
No new speech, product edit, real data, public search, notification, calendar write,
installation, service operation or publication occurred. Source-image rights,
saved-source uncertainty and human continuous review remain unresolved. Long
activity cards still require scrolling. This delivery is an internal silent preview.

## Parent B's coordination story, unit-tested handoff received

Builder delegation was explicitly approved and completed after an interrupted
tool response. Producer independently verified the new 25-asset snapshot against
SHA-256 `2ecadd6c8d86c82e0a3ae2db9684b0e9d1267d8955f93dcad36a19d6939013fb`.
The [current Builder handoff](chat-builder-handoff.md) records 196/196 passing
snapshot-bound offline tests, exact dialogue and evidence. Parent B's actual synthetic
busy interval now computes the conflict; Parent A is assessed and proposed only after
separate confirmation. The earlier product blockers below are resolved by this
handoff, not by caption changes. Browser verification, Producer rehearsal and
capture remain pending and require scoped approval. The old browser runner needs
updated meeting assertions; old recordings still show the wrong roles. No new
video, live access, notification, calendar write or speech was produced.

20 September 2026: the owner approved Parent B as the current user, with her work
meeting conflicting with the school meeting and Parent A as the proposed attendee.
The latest agreed opening is user-initiated, not a proactive notification.
Retain "Another user story" as an editorial separator, not a chat message.
Existing videos below show the reverse roles and do not satisfy this revision.
Do not swap names in captions, insert a fabricated assistant message, or render
the earlier proposed proactive chapter as a substitute for product behavior.

Approved dialogue intent, pending implementation and exact response verification:

1. Parent B: "Can you check my schedule for the school meeting?"
2. Copilot: "Your work meeting overlaps with the school meeting by 30 minutes.
  Does only one parent need to attend?"
3. Parent B: "Yes. Could Parent A go instead?"
4. With complete, current authorized coverage and no known overlap for Parent A,
  Copilot: "Parent A has no conflicting events in the loaded calendar. Shall I
  propose that he attend?"
5. Parent B confirms; show a proposal awaiting Parent A's confirmation, with Undo.
  No contact, notification or calendar write is implied.

Pre-implementation blocker evidence: `chat/conversation-core.js` then recognized
fixed school-meeting commands, reports Parent A's overlap and proposes Parent B after
Yes. `owner/chat-calendar.js` explicitly requires Parent A to conflict and Parent B to
have no conflict, and renders that direction in its timeline and comparison.
The latest conversational product revision is not in the old pinned handoff.
Reproduction from code: review the meeting after an activity scene, then answer
Yes; current messages and proposal target Parent B, not Parent A. No browser reproduction
was executed for this request.

Builder acceptance requested and now unit-verified: explicit synthetic current-user identity Parent B;
matching calendar data and computed overlap; the approved utterances accepted;
one-parent and separate proposal consent; Parent A pending confirmation; Undo;
coverage/freshness/revision failures still block proposals; no activity search
from meeting replies. Provide tested immutable assets and a scenario with exact
wording before Producer rehearses and records. Product edits were delegated only
after the owner explicitly changed the earlier no-Builder-delegation constraint.
No new capture, synthesis or live access occurred.

## Separate school-meeting story, 20 September 2026

The owner requested a clear visual distinction between the outing and school
meeting stories. Latest delivery:
[64.72-second silent MP4](../browser-artifacts/demo/school-chapter-OZArMo/familycopilot-two-stories.mp4),
[English SRT](../browser-artifacts/demo/school-chapter-OZArMo/familycopilot-two-stories.en.srt),
[manifest](../browser-artifacts/demo/school-chapter-OZArMo/manifest.json).

A full-screen editorial chapter at 38.48-41.48 seconds reads "ANOTHER USER STORY"
and "Who can attend the school meeting?", with a demo-data label. It is not product
UI. The existing recording resumes afterward, with all meeting captions shifted
three seconds. The source footage, loading waits, scrolling, proposal limitations
and Undo remain; preference configuration remains excluded. This is now an edited
two-story presentation, not a claim of uninterrupted playback.

Reused `scripts/finish-real-calendar-demo.js --school-chapter` with the pinned
conversation-cut manifest, `--before-scene 6` and `--sha256`. All source hashes
matched before and after rendering. Complete H.264 decode at 1920x1080, 25 fps,
intentional no audio, caption bounds and 20/20 production tests passed. Opening,
pre-chapter, chapter, meeting and ending frames were visually inspected. Continuous
human viewing remains pending. No capture, browser interaction, product change,
network request or speech synthesis occurred. Prior files are preserved; existing
synthetic-data, saved-source and internal-use/image-rights limitations still apply.

## Conversation-first cut, 20 September 2026

The owner clarified that the conversational design no longer needs an interests
configuration walkthrough. Removed the opening summary, preference draft and
Cancel scenes from the existing continuous capture. Latest delivery:
[61.72-second silent MP4](../browser-artifacts/demo/conversation-cut-HQJbGs/familycopilot-conversation.mp4),
[English SRT](../browser-artifacts/demo/conversation-cut-HQJbGs/familycopilot-conversation.en.srt),
[manifest](../browser-artifacts/demo/conversation-cut-HQJbGs/manifest.json).

The cut starts at source time 12.44, with the October question being typed.
Existing preference summary UI remains in the background; no configuration
editor, checkbox modification or Cancel operation appears. This edit does not
claim that conversational preference editing has been implemented. Native UI
loading, continuous scrolling, both activity turns, coverage limits, school
proposal and Undo remain. School coordination now begins around 0:38.5.

Reused `scripts/finish-real-calendar-demo.js` via `--trim-chat-preview`, a pinned
source manifest and `--from-scene 4`. Captions were retimed to the same frame-aligned
cut, and the opening caption retains demo-data disclosure. Previous media and
source hashes are unchanged. Complete decode, caption bounds and 19 production
tests passed; opening, loading and ending frames were inspected. Human continuous
review remains pending. No new capture, browser access, product change, delegation,
live request or synthesis occurred. Internal-use and source-image rights limits
continue to apply; this is still a silent preview.

## Native UI loading and continuous capture delivered, 20 September 2026

The owner's renewed "approved, go" covered isolated rehearsal and a new full-story
recording with native UI loading and smooth scrolling. Delivered:
[74.16-second silent MP4](../browser-artifacts/demo/chat-preview-UWkiu5/familycopilot-chat-preview.mp4),
[English SRT](../browser-artifacts/demo/chat-preview-UWkiu5/familycopilot-chat.en.srt),
[production manifest](../browser-artifacts/demo/chat-preview-UWkiu5/manifest.json).
This supersedes the rejected subtitle-loading edit, which remains preserved.

The existing recorder now accepts explicit `--simulate-loading` only with a pinned
snapshot. It delays each of two activity responses by 2000 ms in the disposable
capture context, preserving request arguments and returned data. The real UI
renders its own spinner, status and Stop control. No loading graphic is injected,
no subtitle pretends to be the loading control, and no postproduction freeze is
inserted. These waits are simulation, not measured live performance. Product
assets, fixtures, shared tabs and services were not edited or operated.

Approved product snapshot SHA:
`37f671af9060540cc75fbf0a5eb42eb0c8e4a3e5c43c4fad497fda8b4f3101cc`.
Producer's twelve-scene pacing/framing specification lives in
`browser-artifacts/demo/ui-loading-story-Zzup4l/scenario.json`; its derived snapshot
SHA is `39d3af4ba51f3ea1f44abc730a9f1753be3dcc9be6df804e45cd5e75de8982e2`.
All 25 product asset hashes match the approved bundle. Only the media scenario
changed, including separate preference draft/Cancel and card-detail reading holds.

No-video rehearsals `chat-review-k3z2qT` and `chat-review-P7lp0z` preceded one formal
capture `chat-preview-UWkiu5`. Both UI waits were visible; twelve final scene checks
passed with zero forbidden requests or browser errors. The final file uses one
continuous WebM recording, not screenshot cuts. Smooth scene scrolling and
offscreen control positioning precede interactions. The capture retains 249 scroll
position samples. Native layout changes can still occur when results update.

Verified: 17/17 bounded production tests, syntax/diagnostics, complete H.264 decode
at 1920x1080 and 74.16 seconds, intentional no audio, caption bounds and unchanged
source hashes. Final-video pixel checks show changing spinner and scrolling regions.
Nine final frames were inspected: opening, both UI waits, two positions during one
scroll, cards, coverage warning, pending proposal and Undo. School coordination
begins around 0:51. Long content still requires scrolling at the 1280x640 viewport;
no product layout was changed. Continuous human review remains pending.

No new speech, installation, live calendar/search, shared service, delegation,
publication, commit or push occurred. Saved-source, calendar-coverage and image
rights limitations remain. This recording approval is consumed; the output is an
internal silent review cut, not a newly narrated or publication-approved release.

## UI loading and continuous-scroll correction requested, 20 September 2026

The owner rejected subtitle-band loading and abrupt viewport jumps in the
80-second edit below. That file is retained as a rejected review iteration, not
an accepted final delivery. Inspection found the recorder used instant
`scrollIntoView` actions in otherwise continuous browser video, not a screenshot
slideshow. Snapshot scene scroll actions now use native smooth scrolling and
wait for settling with a four-second deadline. Two focused offline tests passed;
browser visual validation of this change has not run.

The existing pinned product handoff in `docs/chat-builder-handoff.md` already
contains real composer-adjacent processing text, busy state, indicator and Stop.
Proposed replacement: consume snapshot SHA
`37f671af9060540cc75fbf0a5eb42eb0c8e4a3e5c43c4fad497fda8b4f3101cc`,
use only synthetic calendars and saved public activity facts, and preserve the
four-part story in a continuous desktop capture with visible smooth scrolling.
An explicitly approved capture-only synthetic response delay of about two seconds
would expose the existing UI state without injecting a loading graphic or editing
product assets. Such timing is simulation, not observed live-query latency; keep
demo provenance visible. No Builder delegation or product change is requested.

Renewed scoped rehearsal/capture approval is pending. No browser, service,
network query, recording, speech synthesis or replacement MP4 was run for this
correction. Earlier one-time recording approvals remain consumed.

## Loading simulation edit delivered, 20 September 2026

The owner's "Now go" approved a demo-only loading simulation with no Builder
handoff or product edits. The existing silent 76-second cut was reused offline:
[80-second MP4](../browser-artifacts/demo/loading-edit-HPWfRN/familycopilot-loading-preview.mp4),
[English SRT](../browser-artifacts/demo/loading-edit-HPWfRN/familycopilot-loading.en.srt),
[manifest](../browser-artifacts/demo/loading-edit-HPWfRN/manifest.json).
Two two-second animated loading captions appear at 16.72-18.72 and 40.28-42.28
seconds, with "Demo simulation. No live query." visible throughout each hold.
The first extends an existing processing frame; the second holds the fully typed
question just before submission. Neither represents measured query latency or a
new product state. The school-meeting sequence now begins at about 0:55.

Extended `scripts/finish-real-calendar-demo.js` with `--render-loading-preview`
and a bounded frame-aligned timeline planner. The hash-pinned edit input is
`browser-artifacts/demo/loading-review-vR0HJU/edit.json`. Source media and the
previous deliveries are unchanged. Initial planning caught a one-millisecond
subtitle fragment at an insertion boundary; the planner now omits unrenderable
duplicate fragments, covered by an offline regression test.

Verified: 15/15 production tests, syntax and diagnostics, complete decode at
80 seconds, caption bounds, source hashes and Git-ignored output. Inspected both
loading animations at two phases, both subsequent result frames and the Undo
ending. Human continuous review remains pending. No browser, new recording,
service operation, network request, dependency installation, speech synthesis,
product edit or delegation occurred. This remains an internal silent preview
using synthetic calendars and saved public facts with unresolved image reuse
rights, not a new voiced or publication-approved release.

## Full-story subtitle preview delivered, 20 September 2026

After the owner approved the corrected four-part story, Producer completed a
76-second product-only, silent English-caption preview:
[MP4](../browser-artifacts/demo/chat-preview-pZPHYW/familycopilot-full-story-preview.mp4),
[SRT](../browser-artifacts/demo/chat-preview-pZPHYW/familycopilot-chat.en.srt),
[delivery manifest](../browser-artifacts/demo/chat-preview-pZPHYW/delivery.json).
This completes the approved subtitle-preview step, not a new narrated final edit.
No new speech was synthesized; the original animation and Jenny recordings remain
unchanged for a separately approved full-story edit. Publication is not approved.

| Time | Verified story beat |
| --- | --- |
| 0:00 | Age, seven interests, two teams; deselect one team in the draft, then Cancel and retain the original selections |
| 0:14 | Exact October prompt submitted with Enter; six candidate times, basketball/movie cards and preference reasons |
| 0:31 | Exact nearer-weekend prompt; only the September movie remains, with unverified showtime and outside-October coverage |
| 0:51 | School meeting; Parent A's 30-minute overlap, one-parent condition, Parent B proposal awaiting confirmation, then Undo |

The twelve-scene scenario and all four local image references are preserved in
`browser-artifacts/demo/full-story-OKNytb/`. Explicit assertions verified hidden
Retry/incomplete-search messages on both normal results, image decoding, the
proposal status and Undo restoring the original overlap. The approved capture
used a disposable, network-blocked browser at 1280x640 and exported 1920x1080
H.264 at 25 fps. No shared tab/service, real calendar, public search, dependency
installation, product edit or delegated agent was used. Recording approval is
consumed; this record is not permission for another capture.

Rehearsals `chat-review-KJLkfD` and `chat-review-N4Muno` preceded one capture,
`chat-preview-pZPHYW`. The final snapshot was rebuilt from the first frozen bundle,
not the changing workspace; product asset hashes matched. Accepted snapshot SHA:
`96ffdd1e3c29a9db6ab0f390d8a61a60e5994c975459a335f135b5310bbae20c`.
The recorder gained bounded Enter/Space/Escape actions and boolean checked/visible
assertions, with focused offline coverage. No general script-evaluation action
was added. All twelve scenes completed with zero forbidden requests/browser errors.

Final export inspection caught a timing discrepancy: the initial MP4 ended at
75.88 seconds while its wall-clock subtitle timeline ended at 75.971. The recorder
now rounds output duration up to a video frame and pads the raw tail. Producer
re-exported the SAME raw recording offline to a new filename, preserving the first
cut and original manifest. Final decode passed at exactly 76 seconds; captions
fit within the file, no audio stream is intentional, and the raw hash is unchanged.
The delivery manifest identifies the corrected MP4 separately from that first cut.

Inspected final MP4 frames: opening, preference draft, Cancel, coverage warning,
conflict, proposed attendee and Undo. Rehearsal also covered the candidate times,
two-team artwork, preference rationale and nearer movie body. Proposal and Undo
show the no-contact/no-calendar-change caveat, and captions remain in the lower
band. This is selected-frame review, not continuous human review. Long cards and
the initial composer still extend beyond a single viewport; no product layout
was changed to conceal this. Saved public facts, synthetic calendars, unverified
showtimes and image-rights limitations remain. Human editorial review is pending.

## Full-story correction requested, 20 September 2026

The owner clarified that the intended demo includes preference cancellation,
October activities, nearer-weekend activities and school-meeting coordination.
The delivered 60.28-second version below is a TWO-ACTIVITY-TURN cut, not completion
of that full story. It omits the preference edit/Cancel interaction and the entire
school-meeting scenario. Its nearer-weekend wording also differs from the newly
specified input, and its ending does not demonstrate the out-of-October coverage
explanation. Earlier completion statements must be read with this correction.

Revised shot list and acceptance criteria (planning only):

1. Show age, interests and both preferred teams. Open the team plus control,
   change a draft selection, then Cancel. Verify the original selections remain.
2. Type exactly `What could we do together in October?` and press Enter.
   Show October candidate times, basketball/movie cards and preference rationale.
   Normal results must not display Retry or the incomplete-search message.
3. Type exactly `Could we do something sooner, like this weekend?` and submit.
   Show September movie ideas, unverified showtimes and the fact that these dates
   are outside loaded October calendar coverage. Do not present the October game
   as a nearer-weekend option. Capture the explanation, not only the movie body.
4. Return to Calendar and click `Review a school meeting`. Show Parent A's computed
   30-minute overlap. Select `Only one parent needs to attend`, then
   `Propose Parent B attending`. Show the pending-confirmation proposal, then Undo
   and the withdrawn proposal. This is an independent Calendar-local action,
   not a third activity query, notification or calendar write.

The existing browser runner documents selectors and checks for preference
cancellation and the proposal/Undo sequence; the current integration contract
describes the overlap and pending-confirmation semantics. This planning pass
did not rerun the browser or verify the complete revised sequence end to end.
Producer will use a fresh reviewed snapshot and the same isolated synthetic,
network-blocked environment; no shared tabs/services or product edits are needed
unless a new blocker is found. Duration follows the story, not the old one-minute
cut. Preserve prior outputs. Image public-use rights remain unresolved.

Proposed new English Jenny lines, NOT approved for synthesis:

- Preferences: "We can review our family's age, interests, and favorite teams.
  Cancel keeps our original choices."
- Nearer request: "Could we do something sooner, like this weekend?"
- Nearer result: "Here's a movie idea for this weekend. Showtimes still need
  checking, and these dates fall outside our loaded October calendars."
- Meeting: "Parent A has a thirty-minute overlap with the school meeting. Let's see
  whether one parent could attend."
- Proposal and Undo: "If only one parent needs to attend, we can propose Parent B.
  It's still waiting for her confirmation, and Undo takes the proposal back."

Reuse the existing animated opening and matching Jenny clips where applicable.
Renewed scoped rehearsal/capture approval is required for this expanded story.
Paid synthesis separately requires approval of the five exact lines, provider,
voice and request budget. No speech request, recording, render or delegation was
performed for this correction. Do not reuse consumed approvals from earlier cuts.

## Illustrated chat delivery, 20 September 2026

The owner's renewed approval covered isolated rehearsal, one new recording and
offline rendering of the same October-to-nearer-weekend story. Producer changed
only `scripts/record-demo.js`, its production test, production records and fresh
private outputs. No delegation, product edit, shared tab/service operation,
installation, private calendar access, runtime public search or speech request
was performed in this attempt. This recording approval is now consumed.

Current internal-review delivery:
[MP4](../browser-artifacts/demo/approved-cards-qdF9Tq/jenny-finished/familycopilot-chat-jenny.mp4),
[English SRT](../browser-artifacts/demo/approved-cards-qdF9Tq/jenny-finished/familycopilot-chat.en.srt),
[render manifest](../browser-artifacts/demo/approved-cards-qdF9Tq/jenny-finished/manifest.json),
[visual review](../browser-artifacts/demo/approved-cards-qdF9Tq/jenny-finished/visual-review.json).
Duration 60.28 seconds; 1920x1080, H.264 High, 25 fps, AAC LC 48 kHz stereo.
Final video SHA-256:
`264e441018ec9ed41d7c0f352eecaedd2dded399c917b0ba0a419aa5e11ef4fe`.
The existing 15.2-second family opening and six exact Jenny clips were reused;
all input hashes and WAV formats/durations passed planning and render checks.
Full decode passed; mean volume -22.2 dB and peak -4.5 dB. These are automated
measurements, not a human audition or device playback certification.

The new `--review-scenes` option rehearses all declared actions and saves scene
screenshots without recording video. Initial rehearsal `chat-review-mldAk4`
showed readable double-card titles but a single movie poster filling the ending.
Producer moved the final shot to the movie body, preserving its title, unverified
showtime, suitability, travel, ticket and saved-source qualifications. Between
snapshot exports, Builder independently corrected image containment in the card
stylesheet. The source comparison detected that difference; Producer inspected
the frozen CSS delta and reviewed the new double-card frame rather than claiming
the two bundles were identical. No product files were altered by Producer.

Final rehearsal `chat-review-Iwyjkm` and recording `chat-preview-wIQxOa` used
the same reviewed snapshot SHA-256:
`eca3fa0ee19926b1f211153c792d7ee503f6ea06093f6fc5edf2a8de99c89976`.
All three image hashes matched the Builder handoff and image decoding passed.
The 36.474-second raw-story cut had zero forbidden requests and browser errors,
passed full decode and reverified the pinned snapshot. The original font setup
was reused via process-local `FONTCONFIG_FILE`; Chinese preference and matchup
labels were visually readable. Shared port 34393 was not used by Producer.

Inspected final frames: opening, chat handoff, calendar at 32 seconds, illustrated
alternatives, refinement input at 49 seconds and ending. Titles and central
qualifications are readable; captions occupy a separate lower band. This is key-
frame review, not continuous human viewing. The initial composer extends below
the first viewport until typing scrolls it into view; long cards extend below
the docked composer. The ending deliberately focuses on movie facts rather than
the full poster. No claim is made that all details fit in a single frame.

The scenario remains scripted, with synthetic calendars and saved public facts,
not a live query, model inference or verified activity/calendar fit. Subtitle
timing is approximate, not word-aligned. Full human audition/editorial approval
remains pending. Image sources and unconfirmed reuse rights are preserved in
[the private notice](../browser-artifacts/demo/approved-cards-qdF9Tq/image-rights.md).
This delivery is for internal review only; publication requires rights clearance
and separate approval. Previous media and failed attempts remain preserved.

## Font resolved; capture failed visual review, 20 September 2026

The owner separately approved downloading Noto Sans TC into the isolated media
tools directory. `scripts/setup-demo-font.js --install-approved` completed once:
Google Fonts revision `e44c4b011a820c2cbe2fd2cfa8052037d7edb571`, font SHA-256
`864727d210d54f2537bbe23b3a839436c3992af72de9322af5270897246bd44f`.
The font, OFL license, configuration and manifest are preserved under
`/home/davidtang/.cache/familycopilot-demo-tools/fonts-noto-tc-nEKwKm`.
Only the capture process's `FONTCONFIG_FILE` selected that configuration; no
system configuration or application dependency was changed. This installation
approval is consumed. Do not rerun the installer as routine setup.

The recorder's new `--review-frame` option captures an opening screenshot without
video. The first diagnostic failed because the CDP CSS agent was not enabled;
after enabling DOM and CSS diagnostics, the preview completed with zero forbidden
requests. CDP returned an empty font list for the selected container, so it does
not establish which font rendered each glyph. Visual inspection of
[the opening frame](../browser-artifacts/demo/chat-review-steuVU/font-review.png)
confirmed both preferred-team labels were legible, without missing-glyph boxes.
This does not certify the basketball result title, which was outside the shot.

One approved isolated capture then completed from snapshot SHA-256
`4f244157f9ef236811856bda3b4a27511b00b867e6910e2021a2dc2e3c946718`:
[review MP4](../browser-artifacts/demo/chat-preview-IjHIWY/familycopilot-chat-preview.mp4),
[English captions](../browser-artifacts/demo/chat-preview-IjHIWY/familycopilot-chat.en.srt),
[capture manifest](../browser-artifacts/demo/chat-preview-IjHIWY/manifest.json).
The 36.291-second silent cut passed full decode and pinned snapshot checks;
it is NOT an approved replacement for the existing narrated delivery.
No live calendar, public activity search, shared tab/service or paid speech was used.

Visual review failed at [scene 4](../browser-artifacts/demo/chat-preview-IjHIWY/scene-4.png)
and [the ending](../browser-artifacts/demo/chat-preview-IjHIWY/final-frame.png):
large unavailable-image regions occupy the shot and activity titles/details fall
below the visible area behind the docked composer. This is not evidence that the
whole product cannot be scrolled; it establishes that these chosen shots fail.
The public snapshot's `base()` sets `thumbnail: null`; the asset resolver accepts
only the two original synthetic identities, and the card renderer displays its
unavailable fallback. No missing image request was observed. Copying old fictional
artwork into the public results would misrepresent the product and is not a fix.

Builder handoff: review the public-card unavailable-media presentation or supply
appropriately licensed, provenance-matched imagery under separate approval.
Acceptance: readable activity identity and truthful unknowns/source labels, with
no fictional artwork substituted for public facts. Producer owns a revised shot
list that brings titles and decisive details into view without concealing source
limitations or altering product layout. Reproduce with the frozen two-turn scenario
at 1280x640, scrolling `#activity-results` to the start after each response.
Require reviewed key frames before another recording. Capture approval is consumed;
no automatic retry, new delegation, image download or product edit is authorized.
Narrated rendering was withheld because the visual gate failed. Existing intro,
Jenny clips and earlier deliveries remain unchanged; no new human audition occurred.
Offline production regressions passed 14/14; helper syntax, scoped whitespace
checks and editor diagnostics passed. These checks do not override the failed
visual gate. The separate `visual-review.json` preserves that decision without
rewriting the original capture manifest.

## Capture preflight blocked by Chinese fonts, 20 September 2026

The owner approved an isolated capture of the current October-ideas and nearer-weekend
turns, followed by offline rendering with the existing opening and Jenny clips.
Scope: synthetic calendars and saved public activity facts, network blocked, no
private data, shared tabs/services, new TTS or dependency installation. Product
or font blockers must be reported, not repaired by changing product output.

Preflight confirmed the existing isolated tools and reusable media directories
are present. `fc-list :lang=zh family` returned no fonts. Inspection of the chat
stylesheet found one embedded Nunito Sans face; the existing font builder selects
`nunito-sans-latin-wght-normal.woff2`. This corroborates the unresolved Chinese
glyph limitation in the latest integration contract; no new visual rendering
claim is made. Capture, snapshot export and rendering have not started.

Builder handoff: the current preferred-team labels require Chinese glyphs, but
the reviewed Linux capture environment has no identified font that covers them.
Expected result: both full Chinese team names render legibly without missing-glyph
boxes while preserving the actual product text and offline asset policy. Resolve
the font dependency under explicit installation/network approval, then visually
verify the family summary and basketball result in an isolated desktop context.
Hand off the updated asset/environment evidence before capture is resumed.
Do not change team labels to hide the issue or infer new operation approval from
this record. No browser launch, recording, media render, synthesis, installation,
service operation or delegated agent execution occurred during this preflight.

## Shared caption timeline, 20 September 2026

Chat edit planning now includes narration cues and individual subtitle entries
before any output directory or media tools are initialized. Rendering uses those
same centisecond boundaries for SRT, burned-in ASS captions and its manifest.
Offline regressions cover split-text preservation, ordering, minute rollover,
overlap, out-of-range timestamps and segments that collapse after rounding.
An edit-manifest regression confirms a sub-centisecond intro cue stops preflight
without creating output. Timing remains approximate, not word-aligned; no actual
render, browser capture, speech request or human audition was performed.

## Postproduction preflight, 20 September 2026

The chat timeline planner now rejects coerced string durations, nonfinite values,
sparse scene/audio entries and blank or control-bearing captions. Manifest loading
and planning share the same caption validation. Diagnostics identify incompatible
voice settings, mismatched WAV duration, intro cue overflow and out-of-range scenes.

Temporary-fixture regressions cover missing clips, incompatible WAV headers,
voice mismatch, overlapping/out-of-bounds source scenes and invalid intro cues,
including confirmation that failed preflight creates no output directory.
These are offline data/format checks, not MP4 stream decoding, browser evidence
or human audition. No recording, rendering, synthesis or shared-service operation
was performed for this increment.

## Reviewed snapshot identity, 20 September 2026

The manifest-based recorder now requires `--sha256 <reviewed-hash>` and rejects
missing, malformed or mismatched identity before loading media tools. Completion
checks retain that same digest. Offline snapshot verification accepts the same
option and distinguishes internal integrity from matching a reviewed handoff.
Changing both asset bytes and manifest hashes cannot satisfy the old reviewed hash.

Focused regressions first reproduced the missing check, then passed after repair.
CLI tests use temporary synthetic files and no configured media tools to verify
rejection before browser startup. No recording, rendering, TTS, private calendar
access or shared-service operation was performed. See the updated commands in
the [workflow](demo-workflow.md); browser and render end-to-end review remains pending.

## Workflow tooling, 20 September 2026

Builder now owns all product domains; Demo Producer owns media. New bounded npm
test groups separate quick, chat, production and opt-in browser checks. The existing
chat recorder accepts immutable asset snapshots and declarative scenes. The existing
compositor accepts hash-pinned edit manifests and reuses exact matching voice clips.
Offline planning never invokes Speech; missing matching audio stops the job.
Historical flags and media are preserved. Snapshot/manifest changes have focused
offline regressions; no new browser capture, media rendering, synthesis, private
calendar access or service operation was performed for this workflow update.

Playback follow-up: the owner confirmed hearing the video's narration in Media
Player. VS Code preview failed. This resolves the device-playback question, not
full editorial review or a diagnosis of the VS Code failure.

## Audio playback alternatives, 20 September 2026

The owner could not hear the narrated chat MP4. Full audio decoding confirmed
its default AAC-LC stereo track is non-silent (mean -22.2 dB, peak -4.5 dB).
The actual player/output-device cause is not established; codec compatibility is
a hypothesis, not a confirmed diagnosis.

[WebM with Opus audio](../browser-artifacts/demo/chat-preview-KQBZ79/jenny-intro/audio-compatible-xUwxR8/familycopilot-demo.webm),
[standalone PCM WAV](../browser-artifacts/demo/chat-preview-KQBZ79/jenny-intro/audio-compatible-xUwxR8/familycopilot-narration.wav),
[alternative MP4](../browser-artifacts/demo/chat-preview-KQBZ79/jenny-intro/audio-compatible-xUwxR8/familycopilot-demo.mp4)
and [conversion manifest](../browser-artifacts/demo/chat-preview-KQBZ79/jenny-intro/audio-compatible-xUwxR8/manifest.json)
are fresh private outputs from the [existing audio converter](../scripts/repair-demo-audio.js).
The converter now supports hash-verified synthetic chat manifests, preserves
originals, copies captions and records source/output hashes. No new TTS requests,
recordings, services or shared browser actions were performed.

All three formats fully decoded. WebM has a default 48 kHz stereo Opus track
with mean -21.3 dB and peak -2.6 dB. Syntax and editor checks passed. These are
automated checks only; audible playback on the owner's device remains unconfirmed.

## Chat demo with animated intro and Jenny narration, 19 September 2026

[Narrated MP4](../browser-artifacts/demo/chat-preview-KQBZ79/jenny-intro/familycopilot-chat-jenny.mp4),
[English captions](../browser-artifacts/demo/chat-preview-KQBZ79/jenny-intro/familycopilot-chat.en.srt)
and [production manifest](../browser-artifacts/demo/chat-preview-KQBZ79/jenny-intro/manifest.json):
**60.28 seconds**, 1920x1080 H.264/AAC, 48 kHz stereo. The original 15.2-second
family animation and its narration are reused, followed by the verified chat
preview below. Original outputs remain unchanged and Git-ignored.

- Owner approved the exact six new English lines and one synthesis run using
  `hackathon-VDI-taipei-tts`, Jenny Neural, friendly, -3%, fewer than 1,500 text
  characters. All six requests succeeded; authorization is consumed. No retries,
  private calendar content, resource changes or new recording. Only generic
  narration text was sent to Speech; credentials remained in process memory.
- [Existing postproduction helper](../scripts/finish-real-calendar-demo.js) now
  has `--synthesize-chat-approved` and `--render-chat-offline`, with exclusive
  `jenny-intro` output. Offline rendering verifies source/audio hashes, replaces
  the preview's caption band and extends scene endings for the voice clips.
  The fixed capture is reused rather than reading the changing application tree.
- Seven focused offline production tests and syntax/editor checks passed. The
  complete output decoded, source hashes matched, and measured audio was non-silent
  (mean -22.2 dB, peak -4.5 dB). Opening, chat handoff and ending caption frames
  were visually reviewed. Human audition/playback approval remains pending;
  captions are approximate within clips, not word-aligned.
- This is still synthetic chat with fictional teams, not the requested later
  real-team integration. The inherited activity-detail shot is framed too low;
  narration does not fix that first-cut visual limitation. No calendar-fit claim,
  fresh provider query, public search, shared-browser action or service operation.

## Chat-first captioned review cut, 19 September 2026

[Review MP4](../browser-artifacts/demo/chat-preview-KQBZ79/familycopilot-chat-preview.mp4),
[English captions](../browser-artifacts/demo/chat-preview-KQBZ79/familycopilot-chat.en.srt)
and [manifest](../browser-artifacts/demo/chat-preview-KQBZ79/manifest.json):
35.079 seconds, 1920x1080 H.264, silent review cut. English Jenny narration remains
pending; no paid synthesis was performed. This is an immediate preview, not the
final narrated video or a real-team demonstration.

- Captured the current synthetic chat in a disposable browser using local asset
  interception at a trustworthy localhost origin, without a listening server.
  Two messages produce October options and the September 20 movie. Calendar
  coverage remains October; no real calendars, public search, shared tab or
  shared service was accessed. Network and browser persistence were blocked.
- Existing fictional basketball/movie results remain unchanged. The owner will
  ask another agent to integrate the real preferred team later. Source limitations
  remain in the UI; no live AI or verified calendar-fit claim is made.
- Extended [existing recorder](../scripts/record-demo.js) with `--chat-preview`.
  Isolated tooling was explicitly approved and installed under
  `/home/davidtang/.cache/familycopilot-demo-tools`, including browser runtime
  libraries extracted locally without system installation or sudo.
- Four focused production tests passed, editor diagnostics were clear, activity
  images loaded, no page overflow or forbidden requests were observed, source
  hashes were unchanged and the full MP4 decoded. Opening, activity-detail and
  final captioned frames were visually reviewed. The activity shot dwells too
  low on source details; this remains a first-cut framing limitation.
- A subsequent framing revision preserved the first cut but failed its final
  source-integrity gate because another writer changed `owner/chat-calendar.js`
  during production. That attempt is not the delivered verified cut. No product
  files were reverted or modified by production. Human playback review is pending.

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

The captured UI showed Parent A, Parent B and Child **Loaded**, with real saved statuses
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
verified calendar match; Child's plans still need checking.

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