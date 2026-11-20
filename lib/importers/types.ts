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

  /* ── বহু-ফরম্যাট মিলানোর জন্য ঐচ্ছিক তথ্য ── */
  /** উৎস ফরম্যাট — কোনটা বিশ্বস্ত তা জানতে */
  sourceType?: SourceKind;
  /** ফাইলের নিজস্ব আইডি/সিরিয়াল (JSON id বা Excel SL) */
  sourceId?: string;
  /** ফাইলের ভেতরের ক্রম — একই তারিখ/টাকার ডুপ্লিকেট আলাদা রাখতে */
  sourceOrdinal?: number;
  /** familyMember / Person / member কলাম */
  person?: string;
  quantity?: number;
  unit?: string;
  folder?: string;
  subFolder?: string;
  event?: string;
  note?: string;
  /** JSON backup-এর type — daily / family / business */
  recordType?: string;
}

export type SourceKind = "json" | "excel" | "csv" | "pdf" | "ocr" | "text";

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
    /** PDF-এ লেখা মোট টাকা — শনাক্ত করা মোটের সাথে মিলানোর জন্য */
    declaredTotal?: number;
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
