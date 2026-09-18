"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const read = path => readFileSync(require.resolve(`../${path}`), "utf8");
const owner = read("owner/index.html"), activity = read("activity-preview/index.html");

test("both pages share brand and navigation while calendar source rows intentionally differ", () => {
  const normalized = html => html.match(/<header class="family-shell">[\s\S]*?<\/header>/)[0]
    .replace(/ aria-current="page"/g, "")
    .replace(/\s*<div class="shell-source-row"[^>]*>[\s\S]*?<\/div>/, "");
  assert.equal(normalized(owner), normalized(activity));
  for (const [html, current] of [[owner, "/"], [activity, "/activities"]]) {
    const nav = html.match(/<nav class="shell-nav" aria-label="Family Copilot">([\s\S]*?)<\/nav>/)[1];
    assert.deepEqual([...nav.matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map(x => [x[1], x[2]]), [["/", "Our week"], ["/activities", "Activities"]]);
    assert.equal((nav.match(/aria-current="page"/g) || []).length, 1);
    assert.ok(nav.includes(`href="${current}" aria-current="page"`));
    assert.match(html, /<a class="shell-skip" href="#main">Skip to content<\/a>/);
    assert.match(html, /<main id="main" class="shell-main/);
    assert.equal((html.match(/<h1\b/g) || []).length, 1);
    assert.equal((html.match(/href="\/shell.css"/g) || []).length, 1);
  }
  assert.match(owner, /<div class="shell-source-row" id="owner-source-row" hidden><span class="shell-source" id="owner-source-badge" aria-label="Calendar source">Source not verified<\/span><\/div>/);
  assert.doesNotMatch(owner, /Read-only calendar/);
  assert.match(activity, /<div class="shell-source-row"><span class="shell-source" id="activity-source">/);
  assert.match(activity, /class="shell-source" id="activity-source">Activity discovery/);
  assert.match(owner, /<a href="\/activities">Explore activities →<\/a>/);
  assert.match(activity, /<button type="button" id="reset"/);
});

test("shell fixes geometry and non-color current/focus states without importing calendar content styles", () => {
  const css = read("shell.css");
  assert.match(css, /scrollbar-gutter: stable/);
  assert.match(css, /\.family-shell, main\.shell-main[^}]*max-width: 1280px[^}]*padding: 16px/);
  assert.match(css, /\.shell-nav[^}]*gap: 8px; margin: 0/);
  assert.match(css, /\.shell-nav a[^}]*min-height: 44px/);
  assert.match(css, /aria-current="page"[^}]*text-decoration: underline/);
  assert.match(css, /a:focus-visible[^}]*outline: 3px/);
  assert.match(css, /\.shell-source[^}]*width: 160px; height: 28px/);
  assert.match(css, /max-width: 600px[^]*padding: 12px/);
  assert.match(css, /\.shell-heading[^}]*flex-direction: column/);
  assert.doesNotMatch(css, /main\.shell-activities > \*/);
  assert.match(css, /forced-colors: active/);
  assert.doesNotMatch(css, /@import|url\(|availability|week-run|interest-face|\.activity-card/);
  assert.deepEqual([...activity.matchAll(/rel="stylesheet" href="([^"]+)"/g)].map(x => x[1]), ["/activity-preview/preview.css", "/shell.css", "/activity-preview/basketball.css"]);
});

test("shared main card preserves titles and timezone with feature-specific date presentation", () => {
  for (const [html, title, control] of [[owner, "availability-title", "availability-confirmation"], [activity, "page-title", "activity-form"]]) {
    assert.match(html, /<main[^>]+>\s*<section class="shell-card /);
    const card = html.slice(html.indexOf('<section class="shell-card '), html.indexOf(control));
    assert.match(card, /<div class="shell-intro">/);
    assert.ok(card.includes(`id="${title}" class="shell-title"`));
    assert.match(card, /<p class="shell-zone">Taipei \(UTC\+8\)<\/p>/);
    assert.match(card, /class="shell-decoration [^"]+" aria-hidden="true"/);
  }
  assert.match(owner, /id="availability-title" class="shell-title">Our week<\/h1>/);
  assert.match(owner, /id="availability-start"[^>]*value="2026-10-09"/);
  assert.match(owner, /id="availability-end"[^>]*value="2026-10-11"/);
  assert.match(activity, /<span class="shell-date">9–11 October 2026<\/span>/);
  assert.doesNotMatch(activity, /class="hero"/);
  assert.match(activity, /A little more <span class="fun-word">fun\.<\/span>/);
});

test("shell owns body, card, title and spacing geometry; feature styles only constrain inner controls", () => {
  const css = read("shell.css"), local = read("activity-preview/preview.css"), calendar = read("owner/owner.css");
  assert.match(css, /body \{ margin: 0; border: 0; min-height: 100vh; background: #fcf9f5/);
  assert.match(css, /main\.shell-main \{[^}]*display: grid;[^}]*minmax\(0, 1fr\); gap: 18px/);
  assert.match(css, /\.shell-card \{[^}]*margin: 0; padding: 16px; border: 1px[^}]*border-radius: 24px/);
  assert.match(css, /\.shell-title \{[^}]*grid-template-columns: 240px minmax\(0, 1fr\)[^}]*font-size: 25\.6px/);
  assert.match(css, /max-width: 600px[^]*\.shell-title \{ grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /max-width: 500px[^]*\.shell-card \{ border-radius: 18px; padding: 14\.4px/);
  assert.doesNotMatch(local, /(?:^|\n)(?:main|\.planner|\.hero|h1)\s*\{/);
  assert.doesNotMatch(calendar, /\.owner-page (?:\.calendar-card|\.card|#availability-title|\.week-date|\.week-intro)\s*\{/);
  assert.match(local, /#activity-form \{ max-width: 860px; \}/);
  assert.match(local, /\.cards \{ display: grid; grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(local, /\.results \{ margin-top:/);
});

test("shared branding is prominent with readable mobile type and wrapping rather than clipped text", () => {
  const css = read("shell.css");
  assert.match(css, /\.shell-brand \{[^}]*gap: 12px; min-width: 0/);
  assert.match(css, /\.shell-brand > div \{ min-width: 0/);
  assert.match(css, /\.shell-mark \{[^}]*flex-shrink: 0[^}]*font-size: 48px/);
  assert.match(css, /\.shell-name \{[^}]*font-size: 32px[^}]*line-height: 1\.2/);
  assert.match(css, /\.shell-tagline \{[^}]*margin: 4px 0 0[^}]*font-size: 15px[^}]*line-height: 1\.5/);
  const mobile = css.slice(css.indexOf("@media (max-width: 600px)"));
  assert.match(mobile, /\.shell-mark \{ font-size: 44px/);
  assert.match(mobile, /\.shell-name \{ font-size: 28px/);
  assert.match(mobile, /\.shell-tagline \{ font-size: 14px/);
  for (const rule of css.matchAll(/\.shell-(?:brand|name|tagline)[^{]*\{([^}]+)\}/g))
    assert.doesNotMatch(rule[1], /white-space: nowrap|overflow: hidden|text-overflow|max-height/);
});