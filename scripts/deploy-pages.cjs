#!/usr/bin/env node
/**
 * Cloudflare Pages-এ অ্যাপ ডিপ্লয় (সরাসরি API দিয়ে — wrangler লাগে না):
 *
 *   CLOUDFLARE_API_TOKEN=xxxx pnpm deploy:pages
 *
 * আগে স্ট্যাটিক বিল্ড থাকতে হবে:
 *   pnpm build:pages      → out/ ফোল্ডার
 *
 * প্রথমবার চালালে `hishabdaily` নামে Pages প্রজেক্ট তৈরি হবে,
 * তারপর ঠিকানা হবে: https://hishabdaily.pages.dev
 */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.join(__dirname, "..");
const outDir = path.join(root, "out");
const projectName = process.env.PAGES_PROJECT || "hishabdaily";
const productionBranch = process.env.PAGES_BRANCH || "main";
const token = process.env.CLOUDFLARE_API_TOKEN || "";
const api = "https://api.cloudflare.com/client/v4";

function fail(msg) {
  console.error("❌ " + msg);
  process.exit(1);
}

async function cf(pathname, init = {}) {
  const res = await fetch(api + pathname, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) },
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* খালি রেসপন্স */
  }
  return { ok: res.ok, status: res.status, json };
}

function walk(dir, base = dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full, base));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

async function getAccountId() {
  if (process.env.CLOUDFLARE_ACCOUNT_ID) return process.env.CLOUDFLARE_ACCOUNT_ID;
  const res = await cf("/accounts");
  if (!res.ok) fail(`অ্যাকাউন্ট পাওয়া যায়নি (${res.status}): ${JSON.stringify(res.json?.errors)}`);
  const accounts = res.json?.result || [];
  if (!accounts.length) fail("এই টোকেনে কোনো Cloudflare অ্যাকাউন্ট নেই");
  if (accounts.length > 1)
    fail(
      "একাধিক অ্যাকাউন্ট পাওয়া গেছে — CLOUDFLARE_ACCOUNT_ID দিয়ে একটি বেছে নিন:\n" +
        accounts.map((a) => `  ${a.id}  ${a.name}`).join("\n"),
    );
  return accounts[0].id;
}

async function ensureProject(accountId) {
  const existing = await cf(`/accounts/${accountId}/pages/projects/${projectName}`);
  if (existing.ok) return existing.json.result;

  console.log(`🆕 Pages প্রজেক্ট তৈরি হচ্ছে: ${projectName}`);
  const created = await cf(`/accounts/${accountId}/pages/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: projectName, production_branch: productionBranch }),
  });
  if (!created.ok) {
    const code = created.json?.errors?.[0]?.code;
    if (code === 8000002)
      fail(`"${projectName}" নামটি ইতিমধ্যে অন্য অ্যাকাউন্টে ব্যবহার হচ্ছে — PAGES_PROJECT দিয়ে অন্য নাম দিন`);
    fail(`প্রজেক্ট তৈরি ব্যর্থ (${created.status}): ${JSON.stringify(created.json?.errors)}`);
  }
  return created.json.result;
}

async function main() {
  if (!token)
    fail(
      "CLOUDFLARE_API_TOKEN নেই।\n" +
        "   ১) https://dash.cloudflare.com/profile/api-tokens → Create Token\n" +
        '   ২) টেমপ্লেট: "Edit Cloudflare Workers" (Pages Edit অনুমতিসহ) বা কাস্টম টোকেনে\n' +
        '      Account → Cloudflare Pages → Edit\n' +
        "   ৩) চালান:  CLOUDFLARE_API_TOKEN=<টোকেন> pnpm deploy:pages",
    );

  if (!fs.existsSync(path.join(outDir, "index.html")))
    fail("out/ ফোল্ডারে স্ট্যাটিক বিল্ড নেই — আগে `pnpm build:pages` চালান");

  const accountId = await getAccountId();
  const project = await ensureProject(accountId);
  console.log(`📦 আপলোড হচ্ছে → ${projectName}`);

  const files = walk(outDir);
  const manifest = {};
  const parts = [];
  for (const file of files) {
    const rel = "/" + path.relative(outDir, file).split(path.sep).join("/");
    const buf = fs.readFileSync(file);
    const hash = crypto.createHash("sha256").update(buf).digest("hex");
    manifest[rel] = hash;
    parts.push({ hash, rel, buf });
  }

  // রুটে firebase-config.json থাকলে সেটাও ডিপ্লয়ের সাথে যায় —
  // রিবিল্ড ছাড়াই সাইটে Firebase কনফিগ পাওয়া যাবে।
  const runtimeConfig = path.join(root, "firebase-config.json");
  if (fs.existsSync(runtimeConfig)) {
    const buf = fs.readFileSync(runtimeConfig);
    const rel = "/firebase-config.json";
    const hash = crypto.createHash("sha256").update(buf).digest("hex");
    manifest[rel] = hash;
    parts.push({ hash, rel, buf });
    console.log("🔑 firebase-config.json ডিপ্লয়ের সাথে যোগ হচ্ছে");
  }

  const form = new FormData();
  form.append("manifest", JSON.stringify(manifest));
  form.append("branch", productionBranch);
  form.append("commit_dirty", "true");
  for (const p of parts)
    form.append(p.hash, new Blob([p.buf]), p.rel.slice(1));

  const res = await cf(
    `/accounts/${accountId}/pages/projects/${projectName}/deployments`,
    { method: "POST", body: form },
  );
  if (!res.ok) {
    const errs = res.json?.errors || res.json || {};
    fail(`ডিপ্লয় ব্যর্থ (${res.status}): ${JSON.stringify(errs)}`);
  }

  const url = res.json?.result?.url || `https://${projectName}.pages.dev`;
  const shortUrl = res.json?.result?.aliases?.find((a) => a.endsWith(".pages.dev")) || url;
  fs.writeFileSync(path.join(root, ".preview-url"), shortUrl + "\n");

  console.log("");
  console.log("┌──────────────────────────────────────────────┐");
  console.log("│  ✅ স্থায়ী লিংকে ডিপ্লয় সম্পন্ন!            │");
  console.log("└──────────────────────────────────────────────┘");
  console.log(`   ${shortUrl}`);
  console.log("");
  console.log("   ডেভেলপমেন্ট শাখার লিংকও থাকবে:");
  console.log(`   https://${productionBranch}.${projectName}.pages.dev`);
}

main().catch((err) => fail(err.message));
