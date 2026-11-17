#!/usr/bin/env node
// `next` CLI-এর মোড়ক। Termux/Android-এ SWC-এর WASM ফলব্যাক প্রিলোড করে,
// বাকি সব জায়গায় (যেমন Vercel/Linux) সরাসরি next চালায়।
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const env = { ...process.env };

if (process.platform === "android") {
  const preload = path.join(__dirname, "preload-swc.cjs");
  env.NODE_OPTIONS = [env.NODE_OPTIONS, `--require=${preload}`]
    .filter(Boolean)
    .join(" ");
  // Next 15-এ bare specifier `@next/swc-wasm-nodejs` কে pathToFileURL দিয়ে import
  // করার কারণে WASM ফলব্যাক ভাঙে — এই env দিলে Next সরাসরি ফাইল পাথ ব্যবহার করে।
  env.NEXT_TEST_WASM_DIR = path.join(__dirname, "..", "node_modules", "@next", "swc-wasm-nodejs");
}

let nextBin;
try {
  nextBin = require.resolve("next/dist/bin/next");
} catch {
  console.error("[hishab] next ইনস্টল করা নেই — আগে pnpm install চালান।");
  process.exit(1);
}

const result = spawnSync(process.execPath, [nextBin, ...process.argv.slice(2)], {
  stdio: "inherit",
  env,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
