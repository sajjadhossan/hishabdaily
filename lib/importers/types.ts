/* ─────────────────────────────────────────────────────────────
   স্মার্ট ইম্পোর্ট — ভেতরের টাইপসমূহ
   ───────────────────────────────────────────────────────────── */

export type ImportKind = "expense" | "income" | "debt";

export interface ParsedRow {
  /** ব্যাচের ভেতরে স্থায়ী আইডি (রিভিউ টেবিলে ব্যবহৃত) */
  id: string;
  /** yyyy-MM-dd */
  date: string;
  description: string;
  /** সবসময় ধনাত্মক; kind দিক ঠিক করবে */
  amount: number;
  kind: ImportKind;
  /** শুধু debt-এর ক্ষেত্রে — কাকে টাকা দিয়েছি/নিয়েছি */
  debtDirection?: "lent" | "borrowed" | "lent_repaid" | "borrowed_repaid";
  /** অ্যাপের ক্যাটাগরি লেবেল (DEFAULT_SETTINGS.categories-এর নাম) */
  category: string;
  /** অ্যাকাউন্টের নাম (ব্যাংক স্টেটমেন্ট হলে "ব্যাংক") */
  account?: string;
  /** 0..1 — কম হলে রিভিউতে হলুদ মার্ক দেখানো হবে */
  confidence: number;
  /** মূল লাইন/সেল, ডিবাগging ও রিভিউ সহজ করার জন্য */
  raw: string;
  /** date+amount+description থেকে বানানো ডুপ্লিকেট-চেক কী */
  fingerprint: string;
  selected: boolean;
}

export interface ParseProgress {
  phase: string;
  /** 0..100 */
  percent: number;
}

export type ProgressCallback = (progress: ParseProgress) => void;

export interface ParsedBatch {
  rows: ParsedRow[];
  warnings: string[];
  sourceName: string;
  /** পুরো ফাইলের হ্যাশ — একই ফাইল আবার দিলে আগের ইম্পোর্ট ধরা যাবে */
  fileHash: string;
  meta: {
    parser: "pdf" | "ocr" | "csv" | "tsv" | "excel" | "text";
    pages?: number;
    engine?: string;
    skippedLines?: number;
  };
}

export interface ParsedCellRow {
  cells: string[];
  index: number;
}

export interface TableParseResult {
  rows: ParsedCellRow[];
  delimiter?: string;
  sheetName?: string;
}
