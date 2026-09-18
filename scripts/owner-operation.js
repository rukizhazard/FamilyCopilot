"use strict";
const net = require("node:net");

// Cooperative, machine-local exclusion, NOT an Azure lock or atomic CAS.
// A loopback reservation releases on process exit, with no stale lockfile/data.
// Live loads hold it through independent disable cleanup; updates through readback.
const lockPort = 18002;
async function withOwnerOperation(operation, { port = lockPort } = {}) {
  const lock = net.createServer(socket => socket.destroy());
  try {
    await new Promise((resolve, reject) => {
      lock.once("error", () => reject(new Error("owner_operation_busy")));
      lock.listen({ host: "127.0.0.1", port, exclusive: true }, resolve);
    });
    return await operation();
  } finally {
    if (lock.listening) await new Promise(resolve => lock.close(resolve));
  }
}
module.exports = { withOwnerOperation, lockPort };