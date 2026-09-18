"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { sentences, parseSilences, alignSentences, wrapCaption } = require("../scripts/demo-captions");
test("sentence captions never combine the closing brand with the following tagline", () => {
  const cue = { start: 100, seconds: 7, text: "A possibility worth planning around. Family Copilot. Less time piecing plans together." };
  const result = alignSentences(cue, [{ start: 0, end: 0.15 }, { start: 2, end: 3 }, { start: 4, end: 5 }, { start: 6, end: 7 }]);
  assert.deepEqual(result.map(c => [c.start, c.text]), [[100.15, "A possibility worth planning around."], [103, "Family Copilot."], [105, "Less time piecing plans together."]]);
  assert(result.every(c => sentences(c.text).length === 1));
});
test("alignment ignores short within-sentence pauses and rejects mismatched evidence", () => {
  const cue = { start: 0, seconds: 5, text: "Let's explore, then decide. Something to enjoy?" };
  const pauses = [{ start: 0.8, end: 1 }, { start: 2, end: 3 }, { start: 4, end: 5 }];
  assert.deepEqual(alignSentences(cue, pauses).map(c => c.start), [0, 3]);
  assert.throws(() => alignSentences(cue, []), /mismatch/);
  assert.throws(() => alignSentences(cue, [{ start: 3, end: 2 }]), /Invalid/);
  assert.throws(() => sentences("Incomplete text"));
});
test("silence parsing and balanced two-line layout preserve the exact script", () => {
  assert.deepEqual(parseSilences("x silence_start: 1.5\nx silence_end: 2.5 | silence_duration: 1"), [{ start: 1.5, end: 2.5 }]);
  assert.throws(() => parseSilences("silence_start: 1"));
  const text = "Less time piecing plans together, more to look forward to.";
  const lines = wrapCaption(text);
  assert.equal(lines.length, 2); assert.equal(lines.join(" "), text);
  assert(lines.every(line => line.length <= 56));
  const longSentence = "Add their favorite team, and a simple idea becomes more personal: a chance to watch them play together.";
  assert.equal(wrapCaption(longSentence).length, 2);
  assert.throws(() => wrapCaption("word ".repeat(80).trim()));
});