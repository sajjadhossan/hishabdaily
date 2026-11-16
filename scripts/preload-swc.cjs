// Termux/Android-এ Next.js-এর নেটিভ SWC বাইনারি (@next/swc-android-arm64) নেই।
// Next-এর কিছু কোড-পথ (যেমন পেজ-বিশ্লেষণের `parse`) `loadBindings()` কে
// useWasmBinary ছাড়াই ডাকে — ফলে WASM ব্যবহার না করে নেটিভ বাইনারি খুঁজে ব্যর্থ হয়।
// এখানে আগেভাগেই WASM বাইন্ডিং লোড করে রাখা হয়, যাতে ওই কলগুলো একই ফলাফল পায়।
if (process.platform === "android") {
  try {
    const { loadBindings } = require("next/dist/build/swc");
    loadBindings(true).catch((err) => {
      console.error("[hishab] SWC WASM প্রিলোড ব্যর্থ:", err && err.message);
    });
  } catch (err) {
    console.error("[hishab] SWC প্রিলোড করা যায়নি:", err && err.message);
  }
}
