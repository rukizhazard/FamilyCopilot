"use strict";
// A fresh, dates-only browser storage seam. Never reads actual browser/disk data.
function dateStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key), values };
}
module.exports = { dateStorage };