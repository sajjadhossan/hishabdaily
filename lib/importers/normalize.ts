import type { ImportKind } from "./types";

/* ─────────────────────────────────────────────────────────────
   টেক্সট স্বাভাবিককরণ
   ───────────────────────────────────────────────────────────── */

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const ASCII_DIGITS = "0123456789";

/** বাংলা digits +_fullwidth_ digits → ASCII */
export function toAsciiDigits(value: string): string {
  return value
    .replace(/[০-৯]/g, (d) => ASCII_DIGITS[BN_DIGITS.indexOf(d)] ?? d)
    .replace(/[０-９]/g, (d) => String(d.charCodeAt(0) - 0xff10))
    .replace(/[\u2212\u2013\u2014]/g, "-");
}

export function normalizeText(value: string): string {
  return toAsciiDigits(value).replace(/\s+/g, " ").trim();
}

export function fold(value: string): string {
  return normalizeText(value).toLowerCase();
}

/** দ্রুত, নির্ভরযোগ্য ৩২-বিট হ্যাশ (ক্রিপ্টো লাগবে না) */
export function hashString(value: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function rowFingerprint(date: string, amount: number, description: string): string {
  return hashString(`${date}|${amount.toFixed(2)}|${fold(description).replace(/[^a-z0-9\u0980-\u09ff ]/g, "")}`);
}

/* ─────────────────────────────────────────────────────────────
   তারিখ
   ───────────────────────────────────────────────────────────── */

const MONTHS_EN: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6, july: 7,
  august: 8, september: 9, october: 10, november: 11, december: 12,
};

const MONTHS_BN: Record<string, number> = {
  জানু: 1, জানুয়ারি: 1, ফেব: 2, ফেব্রুয়ারি: 2, মার্চ: 3, এপ্রি: 4, এপ্রিল: 4,
  মে: 5, জুন: 6, জুলা: 7, জুলাই: 7, আগ: 8, আগস্ট: 8, সেপ: 9, সেপ্টেম্বর: 9,
  অক্টো: 10, অক্টোবর: 10, নভে: 11, নভেম্বর: 11, ডিসে: 12, ডিসেম্বর: 12,
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function validDate(y: number, m: number, d: number): string | null {
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** টেক্সটে প্রথম বৈধ তারিখ খুঁজে yyyy-MM-dd ফরম্যাটে দেয় */
export function parseDate(input: string): string | null {
  if (!input) return null;
  const s = toAsciiDigits(input);
  const patterns: Array<(t: string) => string | null> = [
    // 2024-03-12 / 2024/03/12 / 2024.03.12  (+ সময় থাকলেও চলবে)
    (t) => {
      const m = t.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
      return m ? validDate(+m[1], +m[2], +m[3]) : null;
    },
    // 12/03/2024 · 12-03-24 · 12.03.2024  (বাংলাদেশি DD/MM priority)
    (t) => {
      const m = t.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
      if (!m) return null;
      let y = +m[3];
      if (y < 100) y += y > 50 ? 1900 : 2000;
      const a = +m[1];
      const b = +m[2];
      // 13+ মানে নিশ্চিত দিন-first; নাহলে 03/12 ambiguity-তে day-first ধরি
      return validDate(y, b, a) || validDate(y, a, b);
    },
    // 12 Mar 2024 · 12-March-24
    (t) => {
      const m = t.match(/\b(\d{1,2})\s*[-/ ]\s*([A-Za-z\u0980-\u09ff]{3,})\s*[-/ ]\s*(\d{2,4})\b/);
      if (!m) return null;
      const month = MONTHS_EN[m[2].toLowerCase().slice(0, 9)] ?? MONTHS_BN[m[2]] ?? null;
      if (!month) return null;
      let y = +m[3];
      if (y < 100) y += y > 50 ? 1900 : 2000;
      return validDate(y, month, +m[1]);
    },
    // March 12, 2024 · 12 জানুয়ারি ২০২৪
    (t) => {
      const m = t.match(/\b([A-Za-z\u0980-\u09ff]{3,})\s+(\d{1,2})(?:,|\s)+(\d{2,4})\b/);
      if (!m) return null;
      const key = m[1].toLowerCase();
      const month = MONTHS_EN[key.slice(0, 9)] ?? MONTHS_BN[m[1]] ?? null;
      if (!month) return null;
      let y = +m[3];
      if (y < 100) y += y > 50 ? 1900 : 2000;
      return validDate(y, month, +m[2]);
    },
    // 20240312
    (t) => {
      const m = t.match(/\b(20\d{2})(\d{2})(\d{2})\b/);
      return m ? validDate(+m[1], +m[2], +m[3]) : null;
    },
  ];
  for (const fn of patterns) {
    const result = fn(s);
    if (result) return result;
  }
  return null;
}

/** সেলে শুধু তারিখ থাকলে সরাসরি (format guard সহ) */
export function parseDateCell(input: string): string | null {
  return parseDate(input);
}

/* ─────────────────────────────────────────────────────────────
   টাকার অঙ্ক
   ───────────────────────────────────────────────────────────── */

const AMOUNT_RE = /(?:\(|\[)?\s*(?:(?:৳|টাকা|tk\.?|bdt|rs\.?)\s*)?([+-]?\d[\d,]*(?:\.\d{1,2})?)\s*(?:(?:৳|টাকা|tk\.?|bdt|\/-)\s*)?(?:\)|\])?/gi;

export interface AmountHit {
  value: number;
  negative: boolean;
  index: number;
  length: number;
}

export function findAmounts(input: string): AmountHit[] {
  const s = toAsciiDigits(input);
  // তারিখের অংশকে অঙ্ক হিসেবে না ধরতে সরিয়ে দিই
  // তারিখের অংশকে অঙ্ক হিসেবে না ধরতে সমান দৈর্ঘ্যের ফাঁকা দিয়ে বদলাই,
  // যাতে hit.index মূল স্ট্রিংয়ের সাথে মেলে (ব্যালেন্স কলাম চেনার জন্য দরকার)।
  const masked = s
    .replace(/\b\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}\b/g, (m) => " ".repeat(m.length))
    .replace(/\b\d{8}\b/g, (m) => " ".repeat(m.length));
  const hits: AmountHit[] = [];
  for (const m of masked.matchAll(AMOUNT_RE)) {
    const raw = m[1].replace(/,/g, "");
    const value = Number.parseFloat(raw);
    if (!Number.isFinite(value) || value === 0) continue;
    const whole = m[0];
    const negative = whole.includes("-") || /^\s*[\(\[]/.test(whole) || /\)\s*$/.test(whole);
    hits.push({ value: Math.abs(value), negative, index: m.index ?? 0, length: whole.length });
  }
  return hits;
}

/** লাইন থেকে একটা অঙ্ক বেছে নেয় — ব্যালেন্স কলাম এড়িয়ে */
export function pickAmount(input: string): { amount: number; negative: boolean } | null {
  const amounts = findAmounts(input);
  if (!amounts.length) return null;
  const cleaned = fold(input);
  const usable = amounts.filter((hit) => {
    const before = cleaned.slice(Math.max(0, hit.index - 22), hit.index);
    const after = cleaned.slice(hit.index + hit.length, hit.index + hit.length + 22);
    const nearBalance = /bal|ব্যালেন্স|balance|অবশিষ্ট/.test(before + after);
    return !nearBalance;
  });
  const pool = usable.length ? usable : amounts;
  // ঋণাত্মক/ক্রেডিট-মার্ক করা অঙ্ককে অগ্রাধিকার, নাহলে প্রথমটা
  const chosen = pool.find((hit) => hit.negative) ?? pool[0];
  return { amount: chosen.value, negative: chosen.negative };
}

/* ─────────────────────────────────────────────────────────────
   ধরন ও ক্যাটাগরি শনাক্ত
   ───────────────────────────────────────────────────────────── */

const INCOME_WORDS = [
  "salary", "b salary", "payroll", "income", "credit", "interest", "bonus",
  "refund", "cashback", "dividend", "বেতন", "স্যালারি", "আয়", "সুদ", "বোনাস",
  "ফেরত", "রিফান্ড", "জমা", "ক্রেডিট", "commission", "কমিশন",
];
const DEBT_WORDS = [
  "loan", "due", "borrow", "repay", "emd", "installment", "ধার", "দেনা", "পাওনা",
  "বাকি", "ঋণ", "কিস্তি", "owe", "advance", "অগ্রিম",
];
const EXPENSE_WORDS = [
  "debit", "withdraw", "payment", "paid", "purchase", "expense", "খরচ", "ব্যয়",
  "ডেবিট", "উত্তোলন", "পেমেন্ট", "কেনা", "টাকা কাটা",
];

export function guessKind(input: string, explicit?: string, negative?: boolean): ImportKind {
  const text = fold(input);
  if (explicit) {
    const e = fold(explicit);
    if (/income|credit|cr\b|জমা|ক্রেডিট|আয়|salary/.test(e)) return "income";
    if (/debt|due|loan|ধার|দেনা|পাওনা|বাকি|ঋণ/.test(e)) return "debt";
    if (/expense|debit|dr\b|ব্যয়|খরচ|ডেবিট/.test(e)) return "expense";
  }
  if (DEBT_WORDS.some((w) => text.includes(w))) return "debt";
  if (INCOME_WORDS.some((w) => text.includes(w))) return "income";
  if (EXPENSE_WORDS.some((w) => text.includes(w))) return "expense";
  return negative ? "expense" : "expense";
}

type CategoryRule = { category: string; words: string[]; kinds?: ImportKind[] };

/** অ্যাপের DEFAULT_SETTINGS.categories-এর নামগুলোর সাথে হুবহু ম্যাচ */
const CATEGORY_RULES: CategoryRule[] = [
  { category: "বেতন", kinds: ["income"], words: ["salary", "payroll", "বেতন", "স্যালারি"] },
  { category: "বিনিয়োগ/সুদ", kinds: ["income"], words: ["interest", "dividend", "সুদ", "বিনিয়োগ", "investment"] },
  { category: "ভাড়া আয়", kinds: ["income"], words: ["rent income", "rental", "ভাড়া আয়", "বাড়ি ভাড়া"] },
  { category: "ব্যবসা", kinds: ["income"], words: ["business", "sales", "profit", "ব্যবসা", "বিকিকিনি"] },
  { category: "ফ্রিল্যান্সিং", kinds: ["income"], words: ["freelance", "upwork", "fiverr", "ফ্রিল্যান্স"] },
  { category: "উপহার", kinds: ["income"], words: ["gift", "donation received", "উপহার"] },
  { category: "দেনা-পাওনা", words: ["loan", "due", "borrow", "repay", "emd", "installment", "ধার", "দেনা", "পাওনা", "বাকি", "ঋণ", "কিস্তি", "অগ্রিম"] },
  { category: "বাজার", words: ["grocery", "market", "supermarket", "shopping", "daraz", "amazon", "purchase", "বাজার", "গ্রোসারি", "সুপারমার্কেট", "কেনাকাটা", "দোকান"] },
  { category: "খাবার", words: ["restaurant", "food", "cafe", "lunch", "dinner", "snack", "pizza", "burger", "রেস্টুরেন্ট", "খাবার", "হোটেল", "চা", "নাশতা"] },
  { category: "যাতায়াত", words: ["taxi", "uber", "pathao", "indriver", "bus", "train", "ticket", "petrol", "fuel", "ট্যাক্সি", "বাস", "ট্রেন", "টিকিট", "পেট্রোল", "জ্বালানি", "যাতায়াত", "ride"] },
  { category: "বিদ্যুৎ/পানি", words: ["electric", "water bill", "utility", "বিদ্যুৎ", "পানি", "ইউটিলিটি", "current bill"] },
  { category: "মোবাইল/ইন্টারনেট", words: ["internet", "wifi", "mobile bill", "sim", " recharge", "ইন্টারনেট", "মোবাইল"] },
  { category: "বাসা ভাড়া", words: ["house rent", "rent", "ভাড়া", "বাসা"] },
  { category: "শিক্ষা", words: ["book", "tuition", "course", "school", "college", "fee", "বই", "টিউশন", "কোর্স", "স্কুল", "কলেজ", "ফি"] },
  { category: "স্বাস্থ্য", words: ["medicine", "doctor", "hospital", "pharmacy", "clinic", "ওষুধ", "ডাক্তার", "হাসপাতাল", "ফার্মাসি", "ক্লিনিক", "স্বাস্থ্য"] },
  { category: "পোশাক", words: ["clothes", "garments", "dress", "পোশাক", "কাপড়", "জামা"] },
  { category: "বিনোদন", words: ["movie", "cinema", "netflix", "youtube", "game", "subscription", "সিনেমা", "বিনোদন", "গেম", "সাবস্ক্রিপশন"] },
  { category: "দান/ধর্ম", words: ["donation", "zakat", "জাকাত", "দান", "মসজিদ", "charity"] },
  { category: "পরিবার", words: ["family", "child", "পরিবার", "বাচ্চা", "সন্তান"] },
];

export function guessCategory(description: string, kind: ImportKind): string {
  const text = fold(description);
  for (const rule of CATEGORY_RULES) {
    if (rule.kinds && !rule.kinds.includes(kind)) continue;
    if (rule.words.some((w) => text.includes(w))) return rule.category;
  }
  if (kind === "income") return "অন্যান্য";
  if (kind === "debt") return "দেনা-পাওনা";
  return "অন্যান্য";
}

export function categoryConfidence(description: string, category: string): number {
  const rule = CATEGORY_RULES.find((r) => r.category === category);
  if (!rule) return 0.45;
  return rule.words.some((w) => fold(description).includes(w)) ? 0.9 : 0.55;
}

/** ধার দিয়েছি নাকি নিয়েছি — দেনা-পাওনার দিক শনাক্ত */
export function guessDebtDirection(description: string): "lent" | "borrowed" | "lent_repaid" | "borrowed_repaid" {
  const t = fold(description);
  if (/repay|returned|ফেরত|দিয়েছি.*ধার|ধার.*দিয়েছি/.test(t)) {
    return /nied|নিয়েছি|borrow/.test(t) ? "borrowed_repaid" : "lent_repaid";
  }
  if (/borrow|নিয়েছি|ধার নিল|ধার নিয়েছি|loan received|owe him|owe her/.test(t)) return "borrowed";
  return "lent";
}
