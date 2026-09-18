"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const html = readFileSync(require.resolve("../owner/index.html"), "utf8");
const css = readFileSync(require.resolve("../owner/owner.css"), "utf8");

test("technical diagnostics DOM is removed while closed Details retain safety, source and recovery guidance", () => {
  const grid = html.indexOf('id="availability-grid"');
  const start = html.indexOf('<details class="availability-details">');
  const details = html.slice(start, html.indexOf('</details>', start));
  assert.ok(start > grid);
  assert.match(details, /<summary>Details<\/summary>/);
  for (const id of ["availability-cleanup", "availability-freshness", "owner-source-notice", "availability-grid-source",
    "availability-source", "availability-saved-help", "child-week-status", "availability-display-label", "availability-display-help",
    "availability-status-details", "child-status-details"])
    assert.ok(details.includes(`id="${id}"`), id);
  assert.doesNotMatch(html, /id="(?:availability-diagnostic|owner-mode)"/);
  assert.match(html, /<meta name="owner-mode" content="OWNER_MODE">/);
  for (const file of ["../owner/availability-ui.js", "../owner/ui.js"]) {
    const ui = readFileSync(require.resolve(file), "utf8");
    assert.doesNotMatch(ui, /\$\("(?:availability-diagnostic|owner-mode)"\)/);
    assert.match(ui, /meta\[name="owner-mode"\]/);
  }
  assert.match(details, /id="availability-cleanup"[^>]*role="status" hidden><\/p>/);
  assert.match(details, /share only the status message, not calendar contents/);
  assert.match(details, /Restarting does not resolve an unconfirmed update/);
  for (const id of ["availability-status", "child-status", "availability-recovery", "availability-context", "owner-source-badge"])
    assert.ok(html.indexOf(`id="${id}"`) < grid, id);
  assert.match(html, /id="availability-context" aria-live="polite"/);
  assert.match(html, /id="availability-status" role="status" tabindex="-1"/);
  assert.match(html, /id="availability-recovery" hidden><a href="\/">Reload page<\/a>/);
  assert.doesNotMatch(html, /<details[^>]*\sopen|cache-note/);
  assert.match(css, /#availability-status\[data-urgent="true"\][^}]*border-left/);
  assert.match(css, /#availability-status:focus-visible[^}]*outline:3px/);
  assert.doesNotMatch(css, /#availability-cleanup\s*\{[^}]*var\(--warn\)/);
});

test("owner polish keeps scripts and styles intact with sample-only activity navigation", () => {
  assert.match(html, /<body class="owner-page">/);
  assert.deepEqual([...html.matchAll(/<script src="([^"]+)"/g)].map(x => x[1]),
    ["/owner-core.js", "/availability-core.js", "/shared/date-selection.js", "/availability-ui.js", "/child-calendar-core.js", "/child-calendar-ui.js", "/owner-ui.js"]);
  assert.deepEqual([...html.matchAll(/rel="stylesheet" href="([^"]+)"/g)].map(x => x[1]), ["/styles.css", "/owner.css", "/shell.css"]);
  assert.equal((html.match(/href="\/activities"/g) || []).length, 2);
  assert.match(html, /<a href="\/activities">Activities<\/a>/);
  assert.doesNotMatch(html, /8010|activity-preview|fonts\.google|onclick=|style=/);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(x => x[1]);
  assert.equal(new Set(ids).size, ids.length);
});

test("visible date selection precedes Load, with access summary in Details and no consent checkbox", () => {
  const access = html.slice(html.indexOf('<div class="availability-confirmation"'), html.indexOf('id="availability-load"'));
  assert.doesNotMatch(access, /<details|type="checkbox"|availability-ack/);
  const details = html.match(/<details class="availability-details">([\s\S]*?)<\/details>/)[1];
  assert.doesNotMatch(access, /id="availability-targets"/);
  assert.match(details, /<p id="availability-targets">Mike \+ Debby · Default calendars · Busy-only<\/p>/);
  assert.match(access, /role="group" aria-label="Selected dates for Activities and initial calendar display" aria-describedby="availability-date-help"/);
  assert.match(access, /id="availability-date-toggle" type="button" aria-haspopup="dialog"/);
  assert.match(access, /id="availability-date-picker"[^>]*role="dialog"[^>]* hidden/);
  assert.match(access, /<div hidden>\s*<label for="availability-start">/);
  for (const [id, label, value] of [["availability-start", "Start date", ""], ["availability-end", "End date", ""]]) {
    assert.match(access, new RegExp(`<label for="${id}">${label}<input`));
    const input = access.match(new RegExp(`<input id="${id}"[^>]*>`))[0];
    for (const attribute of ['type="date"', 'min="2000-01-01"', 'max="2100-12-31"', `value="${value}"`, "required", 'autocomplete="off"'])
      assert.ok(input.includes(attribute), `${id}: ${attribute}`);
    assert.doesNotMatch(input, /\s(?:hidden|disabled|readonly)(?:\s|=|>)/);
  }
  assert.match(details, /Choose 1–7 days for Activities and the starting calendar view/);
  assert.match(details, /full calendar load scope below; this is not a three-day query/);
  assert.match(access, /id="availability-date-error" role="status" hidden/);
  assert.match(details, /id="availability-range-support"/);
  assert.doesNotMatch(html, /id="availability-ack"/);
  assert.doesNotMatch(html, /A quick access check|availability-access|access-layout|access-facts/);
  assert.match(html, /<button id="availability-load" type="button" disabled aria-describedby="availability-targets availability-load-scope availability-saved-help child-retention">/);
  assert.match(html, /<button id="availability-refresh" hidden disabled aria-describedby="availability-targets availability-load-scope">/);
  assert.match(html, /<meta name="owner-range" content="OWNER_RANGE">/);
});

test("compact confirmation preserves exact scope and dynamic retention in closed details", () => {
  const details = html.match(/<details class="availability-details">([\s\S]*?)<\/details>/)[1];
  for (const text of ["2026-10-09 00:00", "2026-10-16 00:00 (end exclusive)", "Asia/Taipei (UTC+8)",
    "All 336", "672 total", "Nothing checked until Confirm", "this local owner, not in an assistant"])
    assert.ok(details.includes(text), text);
  for (const id of ["availability-identity", "availability-retention", "availability-storage", "availability-window"])
    assert.ok(details.includes(`id="${id}"`));
  assert.match(details, /Cached use does not recheck provider permissions/);
  assert.match(details, /Confirm is the explicit access action/);
  assert.match(details, /Changing the calendar load dates hides results and cancels pending work but keeps a completed saved view/);
  assert.match(details, /Clear deletes the saved view and prevents pending results from restoring it/);
  assert.match(details, /If deletion or finishing an update cannot be confirmed, further use stays blocked/);
  assert.match(details, /Saved views have no expiry timer.*After five minutes they are marked stale, not deleted or automatically refreshed/);
  assert.match(details, /This page expires after 30 minutes.*nothing loads automatically/);
  assert.match(details, /Clear does not erase it/);
  assert.match(details, /Family Copilot cannot change your calendar events/);
  assert.doesNotMatch(details, /Graph|workflow|shared-proxy|credential|fingerprint|0700|0600|availability-diagnostic/i);
  assert.match(details, /View saved only never queries, even on a miss/);
  const beforeGrid = html.slice(0, html.indexOf('id="availability-grid"'));
  assert.doesNotMatch(beforeGrid, /provider permissions|snapshot|cleanup|Graph/);
  assert.doesNotMatch(html, /id="calendar-access"|id="child-calendar-section"/);
  assert.match(details, /Update refreshes parents only; Kimi stays saved-only/);
  assert.match(details, /id="child-retention"/);
  assert.match(html, /Source not verified/);
  assert.match(html, /No availability established/);
  for (const [, ids] of html.matchAll(/aria-(?:labelledby|describedby)="([^"]+)"/g))
    for (const id of ids.split(" ")) assert.ok(html.includes(`id="${id}"`), id);
  assert.doesNotMatch(css, /availability-access|access-layout|access-facts|access-confirmation/);
  assert.match(css, /\.owner-page \.availability-actions button[^}]*min-height:48px/);
});

test("owner decorative icons do not replace action names or uncertainty semantics", () => {
  for (const [id, name] of [["availability-load", "Sync"], ["availability-refresh", "Update"], ["availability-clear", "Clear"]]) {
    const button = html.match(new RegExp(`<button id="${id}"[^>]*>([\\s\\S]*?)</button>`))[1];
    assert.ok(button.includes(name));
    assert.match(button, /<span aria-hidden="true">/);
  }
  assert.match(html, /week-decoration" aria-hidden="true"/);
  const legend = html.slice(html.indexOf('id="availability-legend"'), html.indexOf('id="availability-grid"'));
  assert.doesNotMatch(legend, /data-status="unknown"|>Unknown</);
  for (const text of ["No busy time*", "Tentative", "*May include working elsewhere.", "not guaranteed availability", "Missing data is never free", "24:00 ends that day"])
    assert.ok(html.includes(text), text);
  for (const id of ["availability-status", "availability-cleanup", "availability-source", "availability-context", "availability-freshness", "availability-recovery"])
    assert.ok(html.includes(`id="${id}"`));
});

test("owner polish scopes new rules without changing all-day weekly geometry", () => {
  assert.match(css, /\.owner-page \.week-run \{ border-radius:5px; \}/);
  assert.match(css, /\.owner-page \.child-event, \.owner-page \.child-all-day \{ border-radius:5px; \}/);
  const theme = css.slice(css.indexOf("/* Presentation-only owner theme."));
  // Every added selector is scoped; @media clauses are not selectors.
  const selectors = [...theme.matchAll(/(?:^|\})\s*([^{}]+)\{/g)].map(x => x[1].trim()).filter(x => !x.startsWith("@") && !x.startsWith("/*"));
  assert.ok(selectors.length > 40);
  for (const selector of selectors) assert.ok(selector.startsWith(".owner-page") || selector.startsWith("body.owner-page"), selector);
  assert.match(css, /repeat\(3,minmax\(264px,1fr\)\)/);
  assert.match(css, /repeat\(48,24px\)/);
  assert.match(css, /height:1152px/);
  assert.match(css, /position:sticky; left:0/);
  assert.match(css, /overflow-x:auto/);
  assert.match(css, /repeating-linear-gradient/);
  assert.doesNotMatch(theme, /display:none|outline:none|outline:0|grid-template-rows|\.week-run[^}]*height:/);
  assert.match(theme, /min-height:48px/);
  assert.match(theme, /grid-template-columns:minmax\(0,1\.3fr\) minmax\(0,1fr\) auto/);
  assert.match(theme, /forced-colors:active/);
});

test("owner warm theme and status foregrounds meet normal-text contrast", () => {
  function luminance(hex) {
    const channels = hex.match(/\w\w/g).map(x => parseInt(x, 16) / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4);
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  }
  for (const [foreground, background] of [["352e49", "fcf9f5"], ["625a70", "fbf9fd"], ["ffffff", "624199"],
    ["716579", "f1edf4"], ["253e68", "e6edf9"], ["642b16", "fae7dd"], ["534000", "fff0c2"], ["274f49", "edf5f3"], ["28374a", "dce2e9"]]) {
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    assert.ok((values[0] + .05) / (values[1] + .05) >= 4.5, `${foreground} on ${background}`);
  }
});