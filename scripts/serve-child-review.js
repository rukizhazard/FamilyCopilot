"use strict";
// Isolated synthetic review; no live mode, disk storage or provider adapter.
const { createServer } = require("./serve-owner");
function reviewPort(args) {
  if (args[0] !== "--synthetic" || args.length > 2 || args.length < 1 || args[1] && !/^--port=\d{4,5}$/.test(args[1])) throw Error("synthetic_arguments_required");
  const port = args[1] ? Number(args[1].slice(7)) : 8021;
  if (port < 8020 || port > 65535) throw Error("synthetic_port_unavailable");
  return port;
}
if (require.main === module) {
  try {
    const port = reviewPort(process.argv.slice(2));
    const server = createServer({ port, synthetic: true, searchBasketball: async () => { throw Error("synthetic_child_review_only"); } });
    const stop = () => void server.shutdown();
    process.on("SIGINT", stop); process.on("SIGTERM", stop);
    server.on("error", () => { console.error("Synthetic review port unavailable; existing services untouched."); process.exitCode = 1; });
    server.listen(port, "127.0.0.1", () => console.log(`SYNTHETIC child review only: http://127.0.0.1:${port}/ · no Azure or saved data`));
  } catch { console.error("Use --synthetic [--port=8020..65535] only."); process.exitCode = 1; }
}
module.exports = { reviewPort };