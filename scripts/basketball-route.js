"use strict";
const { searchBasketball } = require("./basketball");
const { requestWindow } = require("../shared/date-selection");
const T = require("../shared/basketball-teams");
// At most 16 bounded local keys. No age, query text or arbitrary source URL.
const bodyLimit = 20000;
function searchRequest(body) {
  if (!body || typeof body !== "object" || Array.isArray(body) ||
    Object.keys(body).some(key => !["startDate", "endDate", "teamIds", "teamMode"].includes(key))) throw new Error("blocked");
  const window = requestWindow({ startDate: body.startDate, endDate: body.endDate });
  if (Object.hasOwn(body, "teamIds") !== Object.hasOwn(body, "teamMode")) throw new Error("blocked");
  return { window, ...T.selection(body.teamIds, body.teamMode) };
}
// Public discovery has no owner session, consent, data, cache or credentials.
function createBasketballRoute({ search = searchBasketball, now = Date.now } = {}) {
  let active = null, last = -Infinity;
  const send = (res, code, body) => {
    if (!res.destroyed && !res.writableEnded) res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" }).end(JSON.stringify(body));
  };
  async function handle(req, res) {
    // The hosting server checks exact loopback Host and rejects forwarded headers first.
    // Exact Origin + non-simple JSON POST prevents cross-site invocation; no CORS/preflight.
    if (req.method !== "POST" || req.headers.origin !== `http://${req.headers.host}` ||
      req.headers["content-type"] !== "application/json" || req.headers["content-encoding"] ||
      req.headers["sec-fetch-site"] && req.headers["sec-fetch-site"] !== "same-origin") return send(res, 403, { status: "blocked" });
    let raw = "", size = 0;
    req.setTimeout(10000, () => req.destroy());
    for await (const chunk of req) {
      size += chunk.length;
      if (size > bodyLimit) { send(res, 400, { status: "blocked" }); return; }
      raw += chunk.toString("utf8");
    }
    req.setTimeout(0);
    let options;
    try { options = searchRequest(JSON.parse(raw)); }
    catch { return send(res, 400, { status: "blocked" }); }
    if (active || now() - last < 5000) return send(res, 429, { status: "busy" });
    last = now(); const controller = new AbortController(); active = controller;
    const close = () => { if (!res.writableEnded) controller.abort(); };
    res.on("close", close);
    try {
      const result = await search({ ...options, signal: controller.signal });
      if (!controller.signal.aborted) send(res, 200, result);
    } catch { send(res, 503, { status: "unavailable" }); }
    finally { res.off("close", close); if (active === controller) active = null; }
  }
  return { handle, close: () => active?.abort() };
}
module.exports = { createBasketballRoute, searchRequest, bodyLimit };