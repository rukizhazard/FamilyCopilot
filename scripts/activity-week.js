"use strict";
// Server-rendered default only. The browser can replace it with dates-only selection.
const { describeWeek } = require("../shared/date-selection");
function activityMarkup(html) {
  const week = describeWeek();
  return html.replace('content="ACTIVITY_WEEK"', `content='${JSON.stringify(week)}'`)
    .replace('class="shell-date">20–26 September 2026', `class="shell-date">${week.label}`);
}
module.exports = { describeWeek, activityMarkup };