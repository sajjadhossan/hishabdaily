/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  // Termux/Android-এ নেটিভ SWC বাইনারি নেই — WASM ব্যবহার হবে।
  // Vercel/Linux-এ এটি স্বয়ংক্রিয়ভাবে বন্ধ থাকবে।
  experimental: { useWasmBinary: process.platform === "android" },
};

export default nextConfig;
