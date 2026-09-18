"use strict";
// Sentence-level alignment for the existing Jenny narration's long pauses.
// Not a word recognizer: fail closed if sentence/pause counts do not agree.
const assert = require("node:assert/strict"), { spawnSync } = require("node:child_process");
function sentences(text) {
  assert(typeof text === "string" && text.trim() && !/[{}\\\r\n]/.test(text));
  const parts = text.match(/[^.!?]+[.!?]+(?:["'](?=\s|$))?/g) || [];
  assert.equal(parts.map(s => s.trim()).join(" "), text.trim(), "Narration must contain complete sentences");
  return parts.map(s => s.trim());
}
function parseSilences(log) {
  const result = []; let start;
  for (const line of log.split(/\r?\n/)) {
    const begin = line.match(/silence_start: ([\d.]+)/);
    if (begin) { assert.equal(start, undefined); start = Number(begin[1]); }
    const end = line.match(/silence_end: ([\d.]+)/);
    if (end) { assert.notEqual(start, undefined); result.push({ start, end: Number(end[1]) }); start = undefined; }
  }
  assert.equal(start, undefined, "Incomplete silence measurement");
  return result;
}
function alignSentences(cue, pauses) {
  const parts = sentences(cue.text), spans = []; let start = 0, previousEnd = 0;
  for (const pause of pauses) {
    assert(Number.isFinite(pause.start) && Number.isFinite(pause.end) && pause.start >= previousEnd &&
      pause.end > pause.start && pause.end <= cue.seconds + 0.01, "Invalid silence interval");
    previousEnd = pause.end;
    if (pause.start <= 0.03) { start = pause.end; continue; }
    // One-second sentence breaks are distinct from brief intra-sentence pauses.
    if (pause.end - pause.start < 0.65) continue;
    assert(pause.start > start);
    spans.push({ start, end: pause.start }); start = pause.end;
  }
  if (cue.seconds - start > 0.04) spans.push({ start, end: cue.seconds });
  assert.equal(spans.length, parts.length, "Sentence/pause mismatch; manual review required, no proportional fallback");
  return spans.map((span, i) => {
    assert(span.end - span.start > 0.3);
    return { start: cue.start + span.start, seconds: span.end - span.start, text: parts[i],
      relativeStart: span.start, relativeEnd: span.end };
  });
}
function wrapCaption(text, max = 56) {
  if (text.length <= max) return [text];
  const words = text.split(" "), choices = [];
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" "), b = words.slice(i).join(" ");
    if (a.length <= max && b.length <= max) choices.push([a, b]);
  }
  assert(choices.length, "Caption exceeds two-line limit; review script phrasing");
  choices.sort((a, b) => Math.abs(a[0].length - a[1].length) - Math.abs(b[0].length - b[1].length));
  return choices[0];
}
function measureCaptions(cues, ffmpeg) {
  const aligned = [], measurements = [];
  for (const [index, cue] of cues.entries()) {
    assert(cue.file && Number.isFinite(cue.seconds));
    const result = spawnSync(ffmpeg, ["-hide_banner", "-i", cue.file, "-af", "silencedetect=noise=-35dB:d=0.12", "-f", "null", "-"],
      { encoding: "utf8", timeout: 30000, maxBuffer: 32768 });
    assert.equal(result.status, 0, "Narration pause measurement failed");
    const pauses = parseSilences(result.stderr), captions = alignSentences(cue, pauses);
    captions.forEach(caption => { wrapCaption(caption.text); aligned.push({ ...caption, clip: index }); });
    measurements.push({ clip: index, pauses, sentences: captions.length });
  }
  for (let i = 1; i < aligned.length; i++) assert(aligned[i].start >= aligned[i - 1].start + aligned[i - 1].seconds);
  return { cues: aligned, measurements, method: "Sentence boundaries matched to measured audio pauses; not word-level alignment" };
}
module.exports = { sentences, parseSilences, alignSentences, wrapCaption, measureCaptions };