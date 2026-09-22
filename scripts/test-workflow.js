"use strict";
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const suites = Object.freeze({
  quick: ["test/chat-contract.test.js", "test/chat-conversation.test.js", "test/date-selection.test.js"],
  chat: ["test/chat-contract.test.js", "test/chat-conversation.test.js", "test/chat-integration.test.js",
    "test/chat-calendar.test.js", "test/chat-activity-search.test.js", "test/activity-cards.test.js", "test/date-selection.test.js"],
  production: ["test/demo-production.test.js", "test/real-calendar-demo.test.js"]
});

function run(args, execute = spawnSync) {
  const [suite, option] = args;
  if (!Object.hasOwn(suites, suite) || args.length > 2 || (option && option !== "--list")) {
    throw Error("Use quick, chat or production, optionally followed by --list.");
  }
  const files = suites[suite];
  if (option === "--list") return { files: [...files], status: 0 };
  const result = execute(process.execPath, ["--test", ...files], {
    cwd: path.resolve(__dirname, ".."), encoding: "utf8", timeout: 120000,
    maxBuffer: 8 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"]
  });
  return { files: [...files], status: result.status ?? 1, stdout: result.stdout,
    stderr: result.stderr, error: result.error?.message };
}

module.exports = { suites, run };
if (require.main === module) {
  try {
    const result = run(process.argv.slice(2));
    process.stdout.write(result.stdout || `${result.files.join("\n")}\n`);
    process.stderr.write(result.stderr || "");
    if (result.error) console.error(result.error);
    process.exitCode = result.status;
  } catch (error) {
    console.error(error.message); process.exitCode = 1;
  }
}