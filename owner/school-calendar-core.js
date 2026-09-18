"use strict";
(function(root) {
  const A = typeof module !== "undefined" && module.exports ? require("./availability-core") : root.OwnerAvailability;
  const kinds = ["explicit-family", "parent-meeting", "parent-attendance-unconfirmed"];
  function text(value, max = 1000) {
    if (typeof value !== "string" || !value.trim() || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw new Error("invalid_school_calendar");
    return value.trim();
  }
  function date(value) { A.dateRange(value, value); return value; }
  function id(value) {
    if (typeof value !== "string" || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(value)) throw new Error("invalid_school_calendar");
    return value;
  }
  function validate(data) {
    if (!data || data.version !== 1 || !data.source || !Array.isArray(data.events) || data.events.length > 50) throw new Error("invalid_school_calendar");
    const s = data.source;
    if (!Number.isInteger(s.pageCount) || s.pageCount < 1 || s.pageCount > 100 ||
      !Number.isInteger(s.schoolYear) || s.schoolYear < 89 || s.schoolYear > 189 || ![1, 2].includes(s.term) ||
      typeof s.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(s.sha256) ||
      typeof s.verifiedAt !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(s.verifiedAt) || !Number.isFinite(Date.parse(s.verifiedAt)) ||
      new Date(s.verifiedAt).toISOString() !== s.verifiedAt.replace("Z", ".000Z")) throw new Error("invalid_school_calendar");
    const source = { file: text(s.file, 160), sha256: s.sha256, pageCount: s.pageCount, schoolYear: s.schoolYear, term: s.term,
      coverageStart: date(s.coverageStart), coverageEnd: date(s.coverageEnd), verifiedAt: s.verifiedAt, notice: text(s.notice) };
    if (source.coverageStart > source.coverageEnd || Date.parse(source.coverageEnd) - Date.parse(source.coverageStart) > 366 * 86400000) throw new Error("invalid_school_calendar");
    const ids = new Set();
    const events = Array.from(data.events, e => {
      if (!e || !kinds.includes(e.participation) || !Number.isInteger(e.sourcePage) || e.sourcePage < 1 || e.sourcePage > source.pageCount) throw new Error("invalid_school_calendar");
      const event = { id: id(e.id), date: date(e.date), title: text(e.title, 200), titleEn: text(e.titleEn, 300), audience: text(e.audience),
        participation: e.participation, sourcePage: e.sourcePage, sourceText: text(e.sourceText), sourceTextEn: text(e.sourceTextEn), notes: text(e.notes) };
      if (ids.has(event.id) || event.date < source.coverageStart || event.date > source.coverageEnd) throw new Error("invalid_school_calendar");
      ids.add(event.id); return event;
    }).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    return { version: 1, id: id(data.id), title: text(data.title, 200), source, events };
  }
  function filter(calendar, startDate, endDate) {
    A.dateRange(startDate, endDate);
    return validate(calendar).events.filter(e => e.date >= startDate && e.date <= endDate);
  }
  const escape = value => value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
  function fold(line) {
    // RFC 5545: 75 octets, without splitting UTF-8 characters. Continuation
    // whitespace counts toward the next physical line's limit.
    let result = "", current = "", bytes = 0;
    const encoder = new TextEncoder();
    for (const char of line) {
      const size = encoder.encode(char).length;
      if (bytes + size > 75) { result += current + "\r\n"; current = " "; bytes = 1; }
      current += char; bytes += size;
    }
    return result + current;
  }
  function toIcs(input) {
    const calendar = validate(input), s = calendar.source;
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//FamilyCopilot//Local school calendar//EN", "CALSCALE:GREGORIAN",
      `X-WR-CALNAME:${escape(calendar.title)}`, "X-WR-TIMEZONE:Asia/Taipei"];
    for (const e of calendar.events) {
      const next = new Date(Date.parse(`${e.date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
      const description = [`${e.title} (${e.titleEn})`, e.audience, `Participation: ${e.participation}.`,
        "Date only; time and duration not stated. This is not an all-day busy commitment. Attendance is not confirmed.", e.notes,
        `Source: ${s.file}, page ${e.sourcePage}; ROC school year ${s.schoolYear}, term ${s.term}.`,
        `${e.sourceText} (${e.sourceTextEn})`, s.notice].join("\n");
      lines.push("BEGIN:VEVENT", `UID:${calendar.id}-${e.id}@familycopilot.local`, `DTSTAMP:${s.verifiedAt.replace(/[-:]/g, "")}`,
        `DTSTART;VALUE=DATE:${e.date.replace(/-/g, "")}`, `DTEND;VALUE=DATE:${next.replace(/-/g, "")}`,
        `SUMMARY:${escape(`${e.title} (${e.titleEn})`)}`, `DESCRIPTION:${escape(description)}`,
        "STATUS:TENTATIVE", "TRANSP:TRANSPARENT", "CLASS:PRIVATE", "END:VEVENT");
    }
    return [...lines, "END:VCALENDAR"].map(fold).join("\r\n") + "\r\n";
  }
  const api = { validate, filter, toIcs };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.SchoolCalendar = api;
})(globalThis);