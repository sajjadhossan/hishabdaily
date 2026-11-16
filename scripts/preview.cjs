#!/usr/bin/env node
/**
 * এক কমান্ডে অ্যাপের পাবলিক প্রিভিউ:
 *   pnpm preview           → আগের বিল্ড দিয়ে সার্ভার + Cloudflare Quick Tunnel
 *   pnpm preview --build   → নতুন করে বিল্ড করে তারপর প্রিভিউ
 *
 * লিংকটি Cloudflare-এর `*.trycloudflare.com` — অ্যাকাউন্ট লাগে না।
 * কমান্ড বন্ধ করলে লিংকও বন্ধ হয়ে যায়; আবার চালালে নতুন লিংক তৈরি হবে।
 */
const { spawn } = require("node:child_process");
const net = require("node:net");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const urlFile = path.join(root, ".preview-url");
const wantBuild = process.argv.includes("--build");

let server = null;
let tunnel = null;
let shuttingDown = false;

function line(msg) {
  process.stdout.write(msg + "\n");
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", ...opts });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${path.basename(cmd)} exited with ${code}`)),
    );
  });
}

function portFree(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once("error", () => resolve(false));
    s.once("listening", () => s.close(() => resolve(true)));
    s.listen(port, "127.0.0.1");
  });
}

async function pickPort() {
  const preferred = Number(process.env.PORT) || 3000;
  for (let p = preferred; p < preferred + 20; p++) {
    if (await portFree(p)) return p;
  }
  throw new Error("কোনো ফাঁকা পোর্ট পাওয়া যায়নি");
}

async function waitForServer(url, timeoutMs = 90000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.status > 0) return true;
    } catch {
      /* এখনো চালু হয়নি */
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  return false;
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (tunnel && !tunnel.killed) tunnel.kill("SIGTERM");
  if (server && !server.killed) server.kill("SIGTERM");
  setTimeout(() => process.exit(exitCode), 400);
}

async function main() {
  if (!fs.existsSync(path.join(root, ".next", "BUILD_ID"))) {
    line("📦 কোনো বিল্ড পাওয়া যায়নি — প্রথমে বিল্ড করা হচ্ছে…");
    await run(process.execPath, [path.join(__dirname, "next.cjs"), "build"], { cwd: root });
  } else if (wantBuild) {
    line("📦 নতুন করে বিল্ড করা হচ্ছে…");
    await run(process.execPath, [path.join(__dirname, "next.cjs"), "build"], { cwd: root });
  }

  const port = await pickPort();
  const nextBin = require.resolve("next/dist/bin/next");
  server = spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
    cwd: root,
    stdio: ["ignore", "inherit", "inherit"],
  });
  server.on("exit", (code) => {
    if (!shuttingDown) {
      line(`⚠️ সার্ভার বন্ধ হয়েছে (${code})`);
      shutdown(code ?? 1);
    }
  });

  line(`⏳ সার্ভার চালু হচ্ছে (পোর্ট ${port})…`);
  const ok = await waitForServer(`http://127.0.0.1:${port}/login`);
  if (!ok) throw new Error("সার্ভার নির্দিষ্ট সময়ে চালু হয়নি");

  line("🌐 Cloudflare Tunnel তৈরি হচ্ছে…");
  tunnel = spawn(
    "cloudflared",
    ["tunnel", "--url", `http://127.0.0.1:${port}`, "--no-autoupdate"],
    { stdio: ["ignore", "pipe", "pipe"] },
  );

  let announced = false;
  const onOutput = (buf) => {
    const text = buf.toString();
    const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (match && !announced) {
      announced = true;
      const url = match[0];
      fs.writeFileSync(urlFile, url + "\n");
      line("");
      line("┌──────────────────────────────────────────────┐");
      line("│  ✅ পাবলিক প্রিভিউ লিংক তৈরি!                │");
      line("└──────────────────────────────────────────────┘");
      line(`   ${url}`);
      line("");
      line("   লিংকটি কপি করে যেকোনো ব্রাউজারে খুলুন।");
      line("   (বন্ধ করতে: Ctrl+C)");
      line("");
    }
  };
  tunnel.stdout.on("data", onOutput);
  tunnel.stderr.on("data", onOutput);
  tunnel.on("exit", (code) => {
    if (!shuttingDown) {
      line(`⚠️ Tunnel বন্ধ হয়েছে (${code})`);
      shutdown(code ?? 1);
    }
  });

  process.on("SIGINT", () => {
    line("\n👋 প্রিভিউ বন্ধ করা হচ্ছে…");
    shutdown(0);
  });
  process.on("SIGTERM", () => shutdown(0));
}

main().catch((err) => {
  console.error("❌ প্রিভিউ চালু করা যায়নি:", err.message);
  shutdown(1);
});
