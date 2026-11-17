#!/usr/bin/env node
/*
  একমাত্র ভার্সন-সূত্র: version.json
  usage:
    node scripts/version.cjs get              → current version
    node scripts/version.cjs bump [patch|minor|major]
    node scripts/version.cjs sync             → সব জায়গায় মানিয়ে দেয়
    node scripts/version.cjs check            → মিল আছে কি না যাচাই (CI-তে চলে)
*/
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const versionFile = path.join(root, "version.json");

function readVersion() {
  const v = JSON.parse(fs.readFileSync(versionFile, "utf8"));
  if (!/^\d+\.\d+\.\d+$/.test(v.version) || !Number.isInteger(v.code) || v.code < 1) {
    throw new Error("version.json ভুল ফরম্যাট");
  }
  return v;
}

function writeVersion(v) {
  fs.writeFileSync(versionFile, `${JSON.stringify(v, null, 2)}\n`);
}

function replaceIn(file, fn, label) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    if (process.argv[2] === "check") throw new Error(`${label} পাওয়া যায়নি: ${file}`);
    return false;
  }
  const before = fs.readFileSync(full, "utf8");
  const after = fn(before);
  if (after !== before) fs.writeFileSync(full, after);
  return true;
}

function targets(v) {
  return [
    {
      label: "package.json",
      file: "package.json",
      apply: (s) => s.replace(/"version":\s*"[^"]+"/, `"version": "${v.version}"`),
      expect: (s) => new RegExp(`"version"\\s*:\\s*"${v.version.replace(/\./g, "\\.")}"`).test(s),
    },
    {
      label: "lib/version.ts",
      file: "lib/version.ts",
      apply: (s) =>
        s
          .replace(/APP_VERSION = "[^"]+"/, `APP_VERSION = "${v.version}"`)
          .replace(/BUILD_NUMBER = \d+/, `BUILD_NUMBER = ${v.code}`),
      expect: (s) => s.includes(`APP_VERSION = "${v.version}"`) && s.includes(`BUILD_NUMBER = ${v.code}`),
    },
    {
      label: "android/app/build.gradle",
      file: "android/app/build.gradle",
      apply: (s) =>
        s
          .replace(/\bversionCode\s+\d+/, `versionCode ${v.code}`)
          .replace(/\bversionName\s+"[^"]+"/, `versionName "${v.version}"`),
      expect: (s) =>
        new RegExp(`versionCode\\s+${v.code}`).test(s) &&
        s.includes(`versionName "${v.version}"`),
    },
    {
      label: "README badge",
      file: "README.md",
      apply: (s) =>
        /!\[Version\]/.test(s)
          ? s.replace(/!\[Version\]\([^)]*\)/, `![Version](https://img.shields.io/badge/version-${v.version}-blue)`)
          : s.replace("![Next.js]", `![Version](https://img.shields.io/badge/version-${v.version}-blue)\n![Next.js]`),
      expect: (s) => s.includes(`version-${v.version}-blue`),
    },
  ];
}

function sync(v) {
  for (const t of targets(v)) replaceIn(t.file, t.apply, t.label);
}

function check(v) {
  const bad = [];
  for (const t of targets(v)) {
    const full = path.join(root, t.file);
    if (!fs.existsSync(full) || !t.expect(fs.readFileSync(full, "utf8"))) bad.push(t.label);
  }
  if (bad.length) {
    console.error(`❌ ভার্সন মিলছে না: ${bad.join(", ")}`);
    process.exit(1);
  }
  console.log(`✅ ভার্সন মিল আছে: ${v.version} (build ${v.code})`);
}

const cmd = process.argv[2] || "get";
const current = readVersion();

if (cmd === "get") {
  console.log(`${current.version} (${current.code})`);
} else if (cmd === "sync") {
  sync(current);
  console.log(`synced → ${current.version} (${current.code})`);
} else if (cmd === "check") {
  check(current);
} else if (cmd === "bump") {
  const part = ["major", "minor", "patch"].includes(process.argv[3]) ? process.argv[3] : "patch";
  const [maj, min, pat] = current.version.split(".").map(Number);
  const next =
    part === "major" ? `${maj + 1}.0.0` : part === "minor" ? `${maj}.${min + 1}.0` : `${maj}.${min}.${pat + 1}`;
  const v = { version: next, code: current.code + 1 };
  writeVersion(v);
  sync(v);
  console.log(`bumped → ${v.version} (${v.code})`);
} else {
  console.error("usage: version.cjs get|bump|sync|check");
  process.exit(1);
}
