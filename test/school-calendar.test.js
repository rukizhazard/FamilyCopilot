"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { createHash } = require("node:crypto");
const S = require("../owner/school-calendar-core");
const { convert } = require("../scripts/convert-school-calendar");

// All content is invented here. Never read the owner's school/source/cache files.
// Converter writes are authorized only inside each test's disposable directory.
const PDF = Buffer.from("%PDF-1.7\nSynthetic test bytes, not a real school PDF.\n%%EOF\n");
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
function fixture() {
  return { version: 1, id: "synthetic-school-term", title: "Synthetic school calendar",
    source: { file: "synthetic-school.pdf", sha256: sha256(PDF), pageCount: 2, schoolYear: 115, term: 1,
      coverageStart: "2026-08-01", coverageEnd: "2027-01-31", verifiedAt: "2026-09-16T00:00:00Z",
      notice: "Synthetic snapshot only; no live verification or updates." },
    events: ["2026-09-20", "2026-09-22", "2026-09-26"].map((date, index) => ({
      id: `sample-${index}`, date, title: `範例活動${index}`, titleEn: `Synthetic event ${index}`,
      audience: "Parent audience unknown; confirm with the source",
      participation: ["explicit-family", "parent-meeting", "parent-attendance-unconfirmed"][index],
      sourcePage: index === 2 ? 2 : 1, sourceText: `範例原文${index}`, sourceTextEn: `Synthetic excerpt ${index}`,
      notes: "Time, duration and attendance unknown." })) };
}
function set(data, dotted, value) {
  const keys = dotted.split("."), key = keys.pop();
  keys.reduce((object, part) => object[part], data)[key] = value;
}
function rejectsValues(dotted, values) {
  for (const value of values) {
    const data = fixture(); set(data, dotted, value);
    assert.throws(() => S.validate(data), /invalid_school_calendar|invalid_date_range/,
      `${dotted} rejects ${JSON.stringify(value)}`);
  }
}
function freeze(value) {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
const unfolded = ics => ics.replace(/\r\n[ \t]/g, "");
const linesOf = ics => unfolded(ics).split("\r\n").filter(Boolean);
const property = (ics, name) => linesOf(ics).filter(line => line.startsWith(`${name}:`)).map(line => line.slice(name.length + 1));
function withDates(dates) {
  const data = fixture(), sample = data.events[0];
  data.events = dates.map((date, index) => ({ ...sample, id: `date-${index}`, date }));
  data.source.coverageStart = [...dates].sort()[0];
  data.source.coverageEnd = [...dates].sort().at(-1);
  return data;
}
function temporary(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "familycopilot-school-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, "synthetic.pdf"), reviewed = path.join(root, "reviewed.json");
  const output = path.join(root, "nested", "output");
  const write = (data = fixture(), bytes = PDF) => {
    fs.writeFileSync(source, bytes);
    fs.writeFileSync(reviewed, JSON.stringify(data));
  };
  write();
  return { root, source, reviewed, output, write, run: () => convert(source, reviewed, output) };
}
// Compare names, kinds, permissions and bytes, not access times changed by reading.
function tree(directory) {
  return fs.readdirSync(directory).sort().map(name => {
    const file = path.join(directory, name), stat = fs.lstatSync(file);
    if (stat.isSymbolicLink()) return { name, link: fs.readlinkSync(file) };
    return { name, mode: stat.mode & 0o777, ...(stat.isDirectory() ? { children: tree(file) } : { bytes: fs.readFileSync(file) }) };
  });
}

test("school validation accepts the synthetic schema, trims text and returns independent sorted objects", () => {
  const input = fixture(); input.title = "  Synthetic school calendar  "; input.events.reverse();
  input.events[0].notes = "  Time, duration and attendance unknown.  ";
  const before = structuredClone(input), result = S.validate(freeze(input));
  assert.equal(result.title, "Synthetic school calendar");
  assert.deepEqual(result.events.map(e => e.id), ["sample-0", "sample-1", "sample-2"]);
  assert.equal(result.events[2].notes, "Time, duration and attendance unknown.");
  assert.notEqual(result, input); assert.notEqual(result.source, input.source);
  assert.notEqual(result.events, input.events); assert.notEqual(result.events[0], input.events[2]);
  result.source.notice = "changed result"; result.events[0].title = "changed result";
  assert.deepEqual(input, before);
});

test("school validation rejects missing or wrongly typed required schema fields", () => {
  for (const data of [undefined, null, false, 1, "calendar", [], {}]) assert.throws(() => S.validate(data));
  for (const dotted of ["version", "id", "title", "source", "events", ...Object.keys(fixture().source).map(k => `source.${k}`),
    ...Object.keys(fixture().events[0]).map(k => `events.0.${k}`)]) {
    const data = fixture(); set(data, dotted, undefined); assert.throws(() => S.validate(data), dotted);
  }
  rejectsValues("version", ["1", 0, 2, true, null]);
  rejectsValues("source", [null, [], "source", 1]);
  rejectsValues("events", [null, {}, "events", 1]);
  rejectsValues("events.0", [null, {}, [], "event", 1]);
});

test("school validation rejects unsafe identities and accepts exact 1/80-character limits", () => {
  for (const dotted of ["id", "events.0.id"]) {
    rejectsValues(dotted, [null, 1, "", " ", "Uppercase", "_id", "-id", "a_b", "a.b", "a/b", "../escape",
      "a@host", "a b", "a\r\nMETHOD:REQUEST", "範例", "a".repeat(81)]);
    for (const value of ["a", "0", "a-0", "a".repeat(80)]) {
      const data = fixture(); set(data, dotted, value); assert.doesNotThrow(() => S.validate(data));
    }
  }
});

test("school validation enforces numeric source and page boundaries without coercion", () => {
  for (const [dotted, minimum, maximum] of [["source.pageCount", 1, 100], ["source.schoolYear", 89, 189],
    ["source.term", 1, 2], ["events.0.sourcePage", 1, 2]]) {
    rejectsValues(dotted, [minimum - 1, maximum + 1, minimum + 0.5, String(minimum), true, null, NaN, Infinity]);
    for (const value of [minimum, maximum]) {
      const data = fixture(); data.events.forEach(e => { e.sourcePage = 1; }); set(data, dotted, value);
      assert.doesNotThrow(() => S.validate(data), `${dotted}=${value}`);
    }
  }
  rejectsValues("source.sha256", [null, 1, "", "a".repeat(63), "a".repeat(65), "A".repeat(64), "g".repeat(64)]);
});

test("school validation rejects trailing line terminators in calendar and event identities", () => {
  const accepted = [];
  for (const dotted of ["id", "events.0.id"]) for (const suffix of ["\n", "\r", "\r\n"]) {
    const data = fixture(); set(data, dotted, `sample${suffix}`);
    try { S.validate(data); accepted.push(`${dotted} ${JSON.stringify(suffix)}`); }
    catch (error) { assert.match(error.message, /invalid_school_calendar/); }
  }
  assert.deepEqual(accepted, [], "IDs must not insert raw line breaks into UID");
});

test("school validation rejects trailing line terminators in the exact SHA-256 identity", () => {
  rejectsValues("source.sha256", ["a".repeat(64) + "\n", "a".repeat(64) + "\r", "a".repeat(64) + "\r\n"]);
});

test("school validation rejects malformed dates, impossible days and unsupported date years", () => {
  for (const dotted of ["source.coverageStart", "source.coverageEnd", "events.0.date"])
    rejectsValues(dotted, [null, 20260920, "", "2026-9-20", "2026-09-2", "2026-09-20T00:00:00Z", " 2026-09-20",
      "2026-00-20", "2026-13-20", "2026-09-00", "2026-09-31", "2026-02-29", "2100-02-29", "1999-12-31", "2101-01-01"]);
  for (const value of ["2000-01-01", "2000-02-29", "2100-12-31"]) assert.doesNotThrow(() => S.validate(withDates([value])));
});

test("school validation rejects reversed, over-366-day coverage and events outside inclusive coverage", () => {
  const reversed = fixture(); reversed.source.coverageStart = "2027-02-01";
  assert.throws(() => S.validate(reversed), /invalid_school_calendar/);
  const exact = withDates(["2024-01-01", "2025-01-01"]);
  assert.doesNotThrow(() => S.validate(exact));
  exact.source.coverageEnd = "2025-01-02";
  assert.throws(() => S.validate(exact), /invalid_school_calendar/);
  rejectsValues("events.0.date", ["2026-07-31", "2027-02-01"]);
  const edges = withDates(["2026-08-01", "2027-01-31"]);
  assert.equal(S.validate(edges).events.length, 2);
});

test("school validation requires a UTC whole-second timestamp with bounded clock fields", () => {
  rejectsValues("source.verifiedAt", [undefined, null, 0, "", "2026-09-16", "2026-09-16T00:00:00",
    "2026-09-16T00:00:00+00:00", "2026-09-16T00:00:00.000Z", "2026-09-16t00:00:00z",
    "2026-09-16T00:00:00Z\n", "2026-09-16T00:00:00Z\r\n",
    "2026-09-16T25:00:00Z", "2026-09-16T23:60:00Z", "2026-09-16T23:59:60Z",
    "2026-00-16T00:00:00Z", "2026-13-16T00:00:00Z", "2026-09-00T00:00:00Z", "2026-09-32T00:00:00Z"]);
  for (const value of ["2000-02-29T00:00:00Z", "2026-12-31T23:59:59Z", "2100-12-31T23:59:59Z"]) {
    const data = fixture(); data.source.verifiedAt = value;
    assert.equal(S.validate(data).source.verifiedAt, value);
    assert.deepEqual(property(S.toIcs(data), "DTSTAMP"), Array(3).fill(value.replace(/[-:]/g, "")));
  }
});

test("school validation rejects impossible verifiedAt calendar days rather than Date.parse normalization", () => {
  const accepted = [];
  for (const value of ["2026-02-29T00:00:00Z", "2026-02-30T12:00:00Z", "2026-04-31T00:00:00Z", "2100-02-29T00:00:00Z"]) {
    const data = fixture(); data.source.verifiedAt = value;
    try { S.validate(data); accepted.push(value); } catch (error) { assert.match(error.message, /invalid_school_calendar/); }
  }
  assert.deepEqual(accepted, [], "Impossible timestamps must not reach DTSTAMP");
});

test("school validation rejects verifiedAt hour 24 instead of emitting an invalid ICS timestamp", () => {
  rejectsValues("source.verifiedAt", ["2026-09-16T24:00:00Z"]);
});

test("school validation rejects duplicate event IDs even on different dates, but allows distinct same-date events", () => {
  const data = fixture(); data.events[1].id = data.events[0].id;
  assert.throws(() => S.validate(data), /invalid_school_calendar/);
  data.events[1] = { ...data.events[0] };
  assert.throws(() => S.validate(data), /invalid_school_calendar/);
  data.events[1].id = "another-event";
  assert.deepEqual(S.validate(data).events.slice(0, 2).map(e => e.id), ["another-event", "sample-0"]);
});

test("school validation accepts only the three explicit participation enums", () => {
  rejectsValues("events.0.participation", [undefined, null, true, 1, "", "unknown", "confirmed", "busy", "student-only",
    "explicit-family ", "PARENT-MEETING", "__proto__", "constructor"]);
  assert.deepEqual(S.validate(fixture()).events.map(e => e.participation),
    ["explicit-family", "parent-meeting", "parent-attendance-unconfirmed"]);
});

test("school validation accepts zero and exactly 50 events but rejects 51", () => {
  const data = fixture(), event = data.events[0]; data.events = [];
  assert.deepEqual(S.validate(data).events, []);
  assert.equal(property(S.toIcs(data), "BEGIN").filter(v => v === "VEVENT").length, 0);
  data.events = Array.from({ length: 50 }, (_, i) => ({ ...event, id: `sample-${String(i).padStart(2, "0")}` }));
  assert.equal(S.validate(data).events.length, 50);
  assert.equal(property(S.toIcs(data), "UID").length, 50);
  data.events.push({ ...event, id: "sample-50" });
  assert.throws(() => S.validate(data), /invalid_school_calendar/);
});

test("school validation rejects sparse events instead of accepting absent required records", () => {
  const data = fixture(); data.events = new Array(1);
  assert.throws(() => S.validate(data), /invalid_school_calendar/);
});

test("school required text rejects wrong types, blank/control text and one over each exact maximum", () => {
  for (const [dotted, maximum] of [["title", 200], ["source.file", 160], ["source.notice", 1000],
    ["events.0.title", 200], ["events.0.titleEn", 300], ...["audience", "sourceText", "sourceTextEn", "notes"].map(k => [`events.0.${k}`, 1000])]) {
    rejectsValues(dotted, [null, 0, false, {}, [], "", " \t\r\n ", "x".repeat(maximum + 1),
      ...[0, 1, 8, 11, 12, 14, 31, 127].map(code => `before${String.fromCharCode(code)}after`)]);
    const data = fixture(); set(data, dotted, "x".repeat(maximum));
    assert.doesNotThrow(() => S.validate(data), `${dotted} exact maximum`);
  }
});

test("school unknown text stays explicit and accepted tabs/newlines are not inferred as time or attendance", () => {
  const data = fixture(); data.events[0].notes = "Unknown\tdate-only\r\nTime unknown\rDuration unknown\nAttendance unknown";
  const result = S.validate(data);
  assert.equal(result.events[0].notes, data.events[0].notes);
  for (const event of result.events) {
    assert.equal(event.audience, "Parent audience unknown; confirm with the source");
    for (const key of ["start", "end", "startTime", "endTime", "duration", "busy", "confirmed", "attendees"])
      assert.equal(Object.hasOwn(event, key), false, key);
  }
});

test("school validation strips extra root/source/event fields including prototype, auth and invitation data", () => {
  const data = fixture(), expected = fixture();
  const extra = JSON.parse('{"__proto__":{"polluted":true},"constructor":"untrusted","token":"SYNTHETIC_SECRET","attendees":["nobody@example.test"],"organizer":"nobody@example.test","alarms":["DISPLAY"],"METHOD":"REQUEST","url":"javascript:alert(1)","busy":true,"startTime":"09:00"}');
  for (const object of [data, data.source, ...data.events]) Object.defineProperties(object,
    Object.fromEntries(Object.entries(extra).map(([key, value]) => [key, { value, enumerable: true, configurable: true }])));
  const before = structuredClone(data), result = S.validate(data);
  assert.deepEqual(result, expected); assert.deepEqual(data, before);
  assert.equal({}.polluted, undefined);
  const ics = S.toIcs(data);
  assert.doesNotMatch(ics, /SYNTHETIC_SECRET|nobody@example\.test|javascript:|09:00|polluted/);
});

test("school ICS escapes source names, backslashes, separators and every newline without injecting properties", () => {
  const data = fixture();
  const attack = "Synthetic\\name;part,tail\r\nMETHOD:REQUEST\nATTENDEE:mailto:nobody@example.test\rBEGIN:VALARM";
  const escaped = "Synthetic\\\\name\\;part\\,tail\\nMETHOD:REQUEST\\nATTENDEE:mailto:nobody@example.test\\nBEGIN:VALARM";
  data.title = attack; data.source.file = attack; data.source.notice = attack;
  for (const key of ["title", "titleEn", "audience", "sourceText", "sourceTextEn", "notes"]) data.events[0][key] = attack;
  const ics = S.toIcs(data), lines = linesOf(ics);
  assert.ok(lines.includes(`X-WR-CALNAME:${escaped}`));
  assert.equal(property(ics, "SUMMARY")[0], `${escaped} (${escaped})`);
  const description = property(ics, "DESCRIPTION")[0];
  assert.ok(description.includes(`Source: ${escaped}\\, page 1\\; ROC school year 115\\, term 1.`));
  assert.equal(description.split(escaped).length - 1, 8);
  const allowed = new Set(["BEGIN", "END", "VERSION", "PRODID", "CALSCALE", "X-WR-CALNAME", "X-WR-TIMEZONE",
    "UID", "DTSTAMP", "DTSTART;VALUE=DATE", "DTEND;VALUE=DATE", "SUMMARY", "DESCRIPTION", "STATUS", "TRANSP", "CLASS"]);
  for (const line of lines) assert.ok(allowed.has(line.slice(0, line.indexOf(":"))), line);
  assert.deepEqual(property(ics, "BEGIN"), ["VCALENDAR", "VEVENT", "VEVENT", "VEVENT"]);
  assert.deepEqual(property(ics, "END"), ["VEVENT", "VEVENT", "VEVENT", "VCALENDAR"]);
});

test("school ICS is read-only date context, never an invitation, alarm, attendee list or guessed busy commitment", () => {
  const data = fixture(), ics = S.toIcs(data), lines = linesOf(ics);
  for (const [name, value] of [["TRANSP", "TRANSPARENT"], ["STATUS", "TENTATIVE"], ["CLASS", "PRIVATE"]])
    assert.deepEqual(property(ics, name), Array(3).fill(value));
  assert.doesNotMatch(unfolded(ics), /^(?:ATTENDEE|ORGANIZER|METHOD|ACTION|TRIGGER|DURATION|RRULE|FREEBUSY|URL|ATTACH)(?:[;:])|^BEGIN:(?:VALARM|VFREEBUSY)/m);
  assert.equal(lines.filter(line => /^DTSTART;VALUE=DATE:\d{8}$/.test(line)).length, 3);
  assert.equal(lines.filter(line => /^DTEND;VALUE=DATE:\d{8}$/.test(line)).length, 3);
  assert.ok(lines.filter(line => /^DT(?:START|END)/.test(line)).every(line => !line.includes("TZID=") && !line.includes("T000000")));
  for (const [index, description] of property(ics, "DESCRIPTION").entries()) {
    assert.ok(description.includes(`Participation: ${data.events[index].participation}.`));
    assert.ok(description.includes("Date only\\; time and duration not stated."));
    assert.ok(description.includes("not an all-day busy commitment"));
    assert.ok(description.includes("Attendance is not confirmed."));
    assert.ok(description.includes("Synthetic snapshot only\\; no live verification or updates."));
  }
});

test("school ICS folds every physical line to at most 75 UTF-8 bytes and unfolds Chinese/emoji losslessly", () => {
  const data = fixture(); data.title = "範例行事曆".repeat(30); // Synthetic calendar.
  data.events[0].title = "親子活動🌟".repeat(20); // Family activity.
  data.events[0].sourceText = "範例原文漢字🌟".repeat(70); // Synthetic source text.
  const ics = S.toIcs(data), physical = ics.split("\r\n");
  assert.ok(physical.some(line => line.startsWith(" ")), "Includes folded continuation lines");
  for (const line of physical) {
    assert.ok(Buffer.byteLength(line, "utf8") <= 75, `Physical line is ${Buffer.byteLength(line, "utf8")} bytes`);
    assert.equal(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.from(line)), line);
    assert.doesNotMatch(line, /\uFFFD/);
  }
  assert.equal(property(ics, "X-WR-CALNAME")[0], data.title);
  assert.equal(property(ics, "SUMMARY")[0], `${data.events[0].title} (${data.events[0].titleEn})`);
  assert.ok(property(ics, "DESCRIPTION")[0].includes(`${data.events[0].sourceText} (${data.events[0].sourceTextEn})`));
});

test("school ICS folds exact 75/76-byte ASCII boundaries with continuation whitespace counted", () => {
  const data = fixture(), prefix = "X-WR-CALNAME:";
  data.title = "x".repeat(75 - Buffer.byteLength(prefix));
  let physical = S.toIcs(data).split("\r\n"), index = physical.findIndex(line => line.startsWith(prefix));
  assert.equal(Buffer.byteLength(physical[index]), 75);
  assert.equal(physical[index + 1], "X-WR-TIMEZONE:Asia/Taipei");
  data.title += "x";
  physical = S.toIcs(data).split("\r\n"); index = physical.findIndex(line => line.startsWith(prefix));
  assert.equal(Buffer.byteLength(physical[index]), 75); assert.equal(physical[index + 1], " x");
  assert.equal(property(S.toIcs(data), "X-WR-CALNAME")[0], data.title);
});

test("school ICS uses only CRLF, a final CRLF and inclusive DATE starts/exclusive next-day ends", () => {
  for (const [date, next] of [["2026-09-20", "20260921"], ["2026-09-30", "20261001"],
    ["2026-02-28", "20260301"], ["2024-02-28", "20240229"], ["2024-02-29", "20240301"],
    ["2000-02-29", "20000301"], ["2026-12-31", "20270101"], ["2100-12-31", "21010101"]]) {
    const ics = S.toIcs(withDates([date]));
    assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n")); assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
    assert.doesNotMatch(ics.replace(/\r\n/g, ""), /[\r\n]/);
    assert.deepEqual(property(ics, "DTSTART;VALUE=DATE"), [date.replace(/-/g, "")]);
    assert.deepEqual(property(ics, "DTEND;VALUE=DATE"), [next]);
  }
});

test("school ICS output and UIDs are deterministic across input ordering, cloning and repeated calls", () => {
  const data = fixture(), before = structuredClone(data), expected = S.toIcs(data);
  assert.equal(S.toIcs(freeze(data)), expected); assert.deepEqual(data, before);
  const reversed = fixture(); reversed.events.reverse();
  assert.equal(S.toIcs(reversed), expected); assert.equal(S.toIcs(S.validate(reversed)), expected);
  const ids = property(expected, "UID");
  assert.deepEqual(ids, [0, 1, 2].map(i => `synthetic-school-term-sample-${i}@familycopilot.local`));
  assert.equal(new Set(ids).size, 3);
  const changed = fixture(); changed.events[0].title = "Revised synthetic title"; changed.events[0].date = "2026-09-21";
  assert.deepEqual(property(S.toIcs(changed), "UID"), ids);
  changed.id = "other-calendar";
  assert.ok(property(S.toIcs(changed), "UID").every(id => !ids.includes(id)));
});

test("school filter uses exact inclusive 1-7-day bounds, sorts, returns copies and never mutates input", () => {
  const data = fixture(); data.events.reverse(); const before = structuredClone(data); freeze(data);
  for (const [start, end, ids] of [["2026-09-20", "2026-09-26", ["sample-0", "sample-1", "sample-2"]],
    ["2026-09-20", "2026-09-20", ["sample-0"]], ["2026-09-26", "2026-09-26", ["sample-2"]],
    ["2026-09-21", "2026-09-25", ["sample-1"]], ["2026-09-23", "2026-09-25", []],
    ["2026-07-01", "2026-07-07", []], ["2027-02-01", "2027-02-07", []]]) {
    const result = S.filter(data, start, end); assert.deepEqual(result.map(e => e.id), ids);
    if (result.length) result[0].notes = "Edited returned copy";
    assert.deepEqual(data, before);
  }
});

test("school filter rejects invalid ranges and invalid records even when the record is outside requested dates", () => {
  for (const [start, end] of [[null, null], ["", ""], ["2026-02-30", "2026-03-01"], ["2026-09-21", "2026-09-20"],
    ["2026-09-20", "2026-09-27"], ["1999-12-31", "2000-01-01"], ["2100-12-31", "2101-01-01"]])
    assert.throws(() => S.filter(fixture(), start, end), /invalid_date_range/);
  const data = fixture(); data.events[2].participation = "confirmed";
  assert.throws(() => S.filter(data, "2026-09-20", "2026-09-20"), /invalid_school_calendar/);
});

test("school filter handles leap-day and year-crossing selections without timezone shifts", () => {
  assert.deepEqual(S.filter(withDates(["2024-02-28", "2024-02-29", "2024-03-01"]), "2024-02-29", "2024-03-01").map(e => e.date),
    ["2024-02-29", "2024-03-01"]);
  assert.deepEqual(S.filter(withDates(["2026-12-30", "2026-12-31", "2027-01-01"]), "2026-12-31", "2027-01-01").map(e => e.date),
    ["2026-12-31", "2027-01-01"]);
});

test("school converter creates only sanitized deterministic JSON/ICS with private permissions in temporary output", t => {
  const temp = temporary(t), data = fixture(); data.extra = "STRIP_ME"; data.source.extra = "STRIP_ME";
  data.events[0].extra = "STRIP_ME"; data.source.file = "../untrusted\\name;part,tail\nMETHOD:REQUEST.pdf";
  data.events.reverse(); temp.write(data);
  const sourceBefore = fs.readFileSync(temp.source), reviewedBefore = fs.readFileSync(temp.reviewed);
  assert.deepEqual(temp.run(), { status: "converted_locally", events: 3,
    files: ["school-family.json", "school-family.ics"], networkUsed: false });
  assert.deepEqual(fs.readdirSync(temp.output).sort(), ["school-family.ics", "school-family.json"]);
  assert.deepEqual(fs.readdirSync(temp.root).sort(), ["nested", "reviewed.json", "synthetic.pdf"]);
  assert.deepEqual(fs.readdirSync(path.dirname(temp.output)), ["output"]);
  assert.deepEqual(fs.readFileSync(temp.source), sourceBefore); assert.deepEqual(fs.readFileSync(temp.reviewed), reviewedBefore);
  assert.equal(fs.statSync(temp.output).mode & 0o777, 0o700);
  assert.equal(fs.statSync(path.dirname(temp.output)).mode & 0o777, 0o700);
  const json = fs.readFileSync(path.join(temp.output, "school-family.json"), "utf8");
  assert.equal(json, JSON.stringify(S.validate(data), null, 2) + "\n"); assert.doesNotMatch(json, /STRIP_ME/);
  const ics = fs.readFileSync(path.join(temp.output, "school-family.ics"), "utf8");
  assert.equal(ics, S.toIcs(data)); assert.doesNotMatch(unfolded(ics), /^METHOD:/m);
  for (const name of ["school-family.json", "school-family.ics"])
    assert.equal(fs.statSync(path.join(temp.output, name)).mode & 0o777, 0o600);
  const second = path.join(temp.root, "second"); convert(temp.source, temp.reviewed, second);
  for (const name of ["school-family.json", "school-family.ics"])
    assert.deepEqual(fs.readFileSync(path.join(temp.output, name)), fs.readFileSync(path.join(second, name)));
});

test("school converter rejects a changed source SHA before creating directories or modifying any files", t => {
  const temp = temporary(t); fs.appendFileSync(temp.source, "Synthetic change after review");
  const before = tree(temp.root);
  assert.throws(temp.run, /source_changed_review_required/);
  assert.deepEqual(tree(temp.root), before); assert.equal(fs.existsSync(path.dirname(temp.output)), false);
  for (const hash of [undefined, "A".repeat(64), "b".repeat(64)]) {
    const data = fixture(); data.source.sha256 = hash; temp.write(data);
    const snapshot = tree(temp.root); assert.throws(temp.run, /source_changed_review_required/);
    assert.deepEqual(tree(temp.root), snapshot);
  }
});

test("school converter rejects non-PDF, oversized and non-file sources without output side effects", t => {
  const temp = temporary(t);
  for (const bytes of [Buffer.alloc(0), Buffer.from("%PDF"), Buffer.from("not a PDF"), Buffer.from("x%PDF-1.7")]) {
    temp.write(fixture(), bytes); const before = tree(temp.root);
    assert.throws(temp.run, /invalid_source_pdf/); assert.deepEqual(tree(temp.root), before);
  }
  temp.write(); fs.truncateSync(temp.source, 20 * 1024 * 1024 + 1);
  assert.throws(temp.run, /invalid_source_pdf/); assert.equal(fs.existsSync(path.dirname(temp.output)), false);
  assert.equal(fs.statSync(temp.source).size, 20 * 1024 * 1024 + 1);
  fs.unlinkSync(temp.source); fs.mkdirSync(temp.source);
  const before = tree(temp.root); assert.throws(temp.run, /invalid_source_pdf/); assert.deepEqual(tree(temp.root), before);
});

test("school converter accepts exactly the 20 MiB source limit using synthetic PDF-prefix bytes only", t => {
  const temp = temporary(t), bytes = Buffer.alloc(20 * 1024 * 1024); PDF.copy(bytes);
  const data = fixture(); data.source.sha256 = sha256(bytes); temp.write(data, bytes);
  assert.equal(temp.run().status, "converted_locally");
  assert.equal(JSON.parse(fs.readFileSync(path.join(temp.output, "school-family.json"), "utf8")).source.sha256, sha256(bytes));
});

test("school converter rejects malformed JSON, invalid reviewed schema and oversized/non-file reviews before mkdir", t => {
  const temp = temporary(t);
  for (const content of ["", "{synthetic malformed", JSON.stringify({ ...fixture(), version: 2 }),
    JSON.stringify({ ...fixture(), events: [null] }), JSON.stringify(fixture()) + " ".repeat(64 * 1024)]) {
    fs.writeFileSync(temp.reviewed, content); const before = tree(temp.root);
    assert.throws(temp.run); assert.deepEqual(tree(temp.root), before);
    assert.equal(fs.existsSync(path.dirname(temp.output)), false);
  }
  fs.unlinkSync(temp.reviewed); fs.mkdirSync(temp.reviewed);
  const before = tree(temp.root); assert.throws(temp.run, /invalid_reviewed_calendar/); assert.deepEqual(tree(temp.root), before);
});

test("school converter accepts exactly 64 KiB reviewed JSON and rejects 64 KiB plus one before output creation", t => {
  const temp = temporary(t), content = JSON.stringify(fixture());
  const exact = content + " ".repeat(64 * 1024 - Buffer.byteLength(content));
  fs.writeFileSync(temp.reviewed, exact + " ");
  const before = tree(temp.root); assert.throws(temp.run, /invalid_reviewed_calendar/); assert.deepEqual(tree(temp.root), before);
  fs.writeFileSync(temp.reviewed, exact); assert.equal(fs.statSync(temp.reviewed).size, 64 * 1024);
  assert.equal(temp.run().status, "converted_locally");
});

test("school converter leaves existing outputs byte-identical and never overwrites on rerun", t => {
  const temp = temporary(t); temp.run();
  fs.writeFileSync(path.join(temp.output, "sentinel.txt"), "Synthetic unrelated output sentinel");
  const before = tree(temp.root); assert.throws(temp.run, { code: "EEXIST" }); assert.deepEqual(tree(temp.root), before);
});

test("school converter fails with no file changes when the first output exists or the output path is a file", t => {
  const temp = temporary(t); fs.mkdirSync(temp.output, { recursive: true });
  fs.writeFileSync(path.join(temp.output, "school-family.json"), "Synthetic existing first output");
  let before = tree(temp.root); assert.throws(temp.run, { code: "EEXIST" }); assert.deepEqual(tree(temp.root), before);
  const blocked = path.join(temp.root, "blocked-output"); fs.writeFileSync(blocked, "Synthetic file, not directory");
  before = tree(temp.root);
  assert.throws(() => convert(temp.source, temp.reviewed, blocked)); assert.deepEqual(tree(temp.root), before);
});

test("school converter rejects first-output symlinks without following them or modifying their temporary target", t => {
  const temp = temporary(t); fs.mkdirSync(temp.output, { recursive: true });
  const target = path.join(temp.root, "synthetic-target.txt"); fs.writeFileSync(target, "Synthetic sentinel");
  fs.symlinkSync(target, path.join(temp.output, "school-family.json"));
  const before = tree(temp.root); assert.throws(temp.run, { code: "EEXIST" }); assert.deepEqual(tree(temp.root), before);
});

// Deliberately enforce the desired failure invariant, not the partial-write bug.
// A failure here is a handoff to the implementation owner, not permission to fix it.
test("school converter second-output conflicts must not leave a partial first output or change existing entries", t => {
  const leftovers = [];
  for (const kind of ["file", "directory", "symlink"]) {
    const temp = temporary(t); fs.mkdirSync(temp.output, { recursive: true });
    const second = path.join(temp.output, "school-family.ics");
    if (kind === "file") fs.writeFileSync(second, "Synthetic existing second output");
    else if (kind === "directory") fs.mkdirSync(second);
    else {
      const target = path.join(temp.root, "synthetic-target.txt"); fs.writeFileSync(target, "Synthetic sentinel");
      fs.symlinkSync(target, second);
    }
    const before = tree(temp.root); assert.throws(temp.run, { code: "EEXIST" });
    const first = path.join(temp.output, "school-family.json");
    if (fs.existsSync(first)) leftovers.push(kind);
    // Check existing entries independently even when the no-partial-output assertion fails.
    const after = tree(temp.root);
    after.find(entry => entry.name === "nested").children.find(entry => entry.name === "output").children =
      after.find(entry => entry.name === "nested").children.find(entry => entry.name === "output").children.filter(entry => entry.name !== "school-family.json");
    assert.deepEqual(after, before);
  }
  assert.deepEqual(leftovers, [], "Failed conversion must not leave school-family.json when school-family.ics already exists");
});