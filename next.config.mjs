/** @type {import('next').NextConfig} */
const staticExport = process.env.STATIC_EXPORT === "1";

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  // Cloudflare Pages-এ হোস্ট করার জন্য সম্পূর্ণ স্ট্যাটিক এক্সপোর্ট:
  //   STATIC_EXPORT=1 pnpm build   →  out/ ফোল্ডার
  ...(staticExport ? { output: "export" } : {}),
  // Termux/Android-এ নেটিভ SWC বাইনারি নেই — WASM ব্যবহার হবে।
  // Vercel/Linux-এ এটি স্বয়ংক্রিয়ভাবে বন্ধ থাকবে।
  experimental: { useWasmBinary: process.platform === "android" },
};

export default nextConfig;
