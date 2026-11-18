/**
 * Knip wrapper.
 *
 * Knip uses oxc native bindings, which cannot load on Termux/Android
 * (`__emutls_get_address` missing). On Android we skip with a clear message;
 * the same check runs in GitHub Actions on Linux via .github/workflows/code-quality.yml.
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");

if (process.platform === "android") {
  console.log("Knip Termux-এ চলে না (oxc native binding)। GitHub Actions-এর Code Quality check দেখুন।");
  process.exit(0);
}

const cli = path.join(__dirname, "..", "node_modules", "knip", "bin", "knip.js");
const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);
