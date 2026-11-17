/*
  স্মার্ট ইম্পোর্টের জন্য ব্রাউজারে চলা worker ফাইলগুলো public/-এ কপি করে।
  static export-এ public/ → out/ হয়ে যায়, তাই /pdf.worker.min.mjs ও /tess/worker.min.js
  দুই সাইটেই সরাসরি পাওয়া যায়। CDN ছাড়াই PDF পড়া যায়; শুধু OCR-এর
  ভাষা/কোর jsdelivr থেকে লোড হয় (প্রথমবার ইন্টারনেট লাগবে)।
*/
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const copies = [
  ["node_modules/pdfjs-dist/build/pdf.worker.min.mjs", "public/pdf.worker.min.mjs"],
  ["node_modules/tesseract.js/dist/worker.min.js", "public/tess/worker.min.js"],
];

let changed = 0;
for (const [from, to] of copies) {
  const src = path.join(root, from);
  const dest = path.join(root, to);
  if (!fs.existsSync(src)) {
    console.warn(`[import] worker পাওয়া যায়নি: ${from}`);
    continue;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const srcSize = fs.statSync(src).size;
  if (fs.existsSync(dest) && fs.statSync(dest).size === srcSize) continue;
  fs.copyFileSync(src, dest);
  changed++;
}
console.log(`[import] worker assets প্রস্তুত${changed ? ` (${changed} কপি হয়েছে)` : ""}`);
