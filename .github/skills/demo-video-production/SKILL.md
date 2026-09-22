---
name: "demo-video-production"
description: "Plan, rehearse, capture, narrate, caption, edit and validate a truthful browser-based product demo video. Use for demo video creation, storyboarding, screen recording, voiceover, subtitles, MP4 rendering or revising an existing edit. Reuse repository production scripts, isolate capture, preserve source evidence and require scoped approval for private data, live calls and paid synthesis."
argument-hint: "Provide the audience, story, target UI, data mode, output requirements and operation approvals."
---

# Demo Video Production

Use this workflow for a complete video or a bounded revision. Do not rerun capture
or synthesis when an approved edit can reuse existing media. Project privacy and
ownership rules always take precedence; the FamilyCopilot entry points below are
adapters to this workflow, not assumptions to carry into another project.

## 1. Establish The Brief And Evidence

- Identify audience, takeaway, current product entry point, language, aspect ratio,
  resolution and any duration limit. Prefer a short user story over a feature tour.
- Read current product decisions and inspect only the implementation needed for
  the proposed story. Separate implemented behavior, synthetic scenarios,
  recorded live observations, estimates and planned capabilities.
- Build a shot list with each scene's visible action, prerequisite state,
  narration, expected evidence and source limitations. Use natural spoken wording.
  Do not introduce a selected category or outcome before it appears on screen.
- Present the story for review before new capture or paid narration. Record what
  approval covers: target, data, interactions, request budget, service and output.
  An existing approval is usable only while its exact scope remains unconsumed.

## 2. Rehearse Without Side Effects

- Inspect the relevant recorder and its tests before invoking it. A smoke flag is
  not proof of offline behavior; verify its routes and allowed operations.
- Reuse available isolated tooling. Do not install system packages, change global
  configuration or add application dependencies as incidental production work.
  Resolve missing dependencies and their installation scope explicitly.
- Use a disposable browser and synthetic fixtures with network denied by default.
  Permit only reviewed local assets and explicitly approved requests. Never use
  a shared real-calendar page as a rehearsal fixture or probe private snapshots.
- Confirm current controls, dates, preferences and scripted limitations rather
  than copying a historical click sequence. Review key screenshots for readable
  text, loaded assets, clipping, overlays and accurate visible source labels.
- Follow the agreed output viewport. Do not add unrelated mobile testing to a
  desktop-only video. Do not modify the application to obtain a better-looking shot.

## 3. Capture Approved Material

- Check the approval scope immediately before operations. Synthetic recording
  does not authorize real-data capture; saved-data viewing does not authorize Sync.
  Public-source access and recording are separate from booking or calendar writes.
- Use explicit allowlists and request budgets. Stop on unexpected requests,
  missing redaction, changed product behavior or failed preconditions. Do not
  silently substitute fixtures for real data or label saved results as fresh.
- Apply reviewed masking before capture, including hover text and incidental
  private content. Keep genuine errors, coverage gaps and freshness qualifications.
- Write to a fresh exclusive output directory. Preserve raw recordings and source
  hashes; never delete an attempt marker to replay a one-time authorization.
- Record scenario, data mode, reference date/timezone, capture time, viewport,
  source paths/hashes and observed request counts without secrets or raw private
  payloads. An edit across recordings must not imply an uninterrupted session.

## 4. Narrate And Edit

- Prefer existing approved audio when it matches the reviewed wording. Before new
  paid synthesis, confirm exact text, voice, provider/resource and spending scope.
  Do not inherit historical approval, automatically retry, or switch providers.
- Send only approved narration text, never calendar payloads or unreviewed private
  screen text. Keep credentials out of files, transcripts and command output.
- Freeze the narration and scene timing in a manifest. Reuse existing rendering
  helpers for cuts, transitions, captions and audio; make repeated work scriptable.
- Time narration and captions to visible actions. Avoid premature result claims,
  long dead time, abrupt transitions and unexplained jumps between source clips.
- Produce MP4 and a companion caption file in the agreed language. State whether
  caption timing is approximate or word-aligned. Retain originals and render each
  revision into new output rather than overwriting an earlier deliverable.

## 5. Validate And Deliver

- Run focused offline tests and syntax checks for changed production helpers;
  do not run broad application suites or live recorders as incidental validation.
- Fully decode the final video. Check dimensions, duration, codec, audio presence,
  non-silence and clipping, caption bounds and final source hashes.
- Visually inspect opening, transitions, decisive actions and ending frames.
  Check masking, loaded assets, text/caption overlap, source labels and story order.
- Human audition is a separate gate: report it as pending unless actually done.
  Automated audio measurements do not prove intelligibility or speaker playback.
- Deliver clickable MP4/caption/manifest links, checks actually executed, remaining
  limitations and approvals still needed. Do not claim automated checks establish
  parent usability or real-world calendar fit.
- Clean up only owned disposable resources. Preserve user tabs, shared services,
  source media and existing outputs. Publication or upload requires separate approval.

## FamilyCopilot Entry Points

Start with the [short two-agent workflow](../../../docs/demo-workflow.md).
Use [demo-snapshot.js](../../../scripts/demo-snapshot.js) to package or verify a
reviewed static handoff. Packaging is offline and does not confer recording
approval. Capture with the existing recorder's `--chat-preview --snapshot` mode;
the no-snapshot flag retains an outdated historical story, not today's baseline.
Scenario actions are declarative; do not alter product fixtures to satisfy them.

Postproduction accepts `--plan-chat` and `--render-chat-manifest`. Planning only
validates files and timings. Rendering consumes hash-pinned captures and intro,
and exact matching existing narration clips. Missing/changed words stop planning;
there is no paid synthesis fallback. Reuse individual clips by source directory
and index, including from older approved speech attempts. New synthesis still
needs exact text/resource/budget approval through the existing approved helper.
Do not invoke old synthesis flags as a way around a failed reuse check.

Read [production history](../../../docs/demo-video.md) for current evidence and
limitations, not reusable operational authorization. Read helper source before
running it: some scripts target historical recordings and exclusive output paths.

| Purpose | Existing Entry Point |
| --- | --- |
| Original synthetic capture | [record-demo.js](../../../scripts/record-demo.js) |
| Historical integrated capture | [record-integrated-demo.js](../../../scripts/record-integrated-demo.js) |
| Approved saved-calendar capture | [record-real-calendar-demo.js](../../../scripts/record-real-calendar-demo.js) |
| Integrated narration and edit | [finish-integrated-demo.js](../../../scripts/finish-integrated-demo.js) |
| Calendar and complete-story postproduction | [finish-real-calendar-demo.js](../../../scripts/finish-real-calendar-demo.js) |
| Complete-story compositor | [render-complete-demo.js](../../../scripts/render-complete-demo.js) |
| Isolated animated opening | [render-demo-intro.js](../../../scripts/render-demo-intro.js) |
| Offline production regression tests | [demo-production.test.js](../../../test/demo-production.test.js) |
| Saved-calendar production tests | [real-calendar-demo.test.js](../../../test/real-calendar-demo.test.js) |

Use `FAMILYCOPILOT_DEMO_TOOLS` for the existing isolated media installation and
the browser/runtime/font settings documented in production history. Verify paths
are still available; do not hard-code a previous session's temporary directory.
For a new chat recording, adapt an appropriate existing recorder only after
checking the current interaction contract and agreeing its exact owned files.
