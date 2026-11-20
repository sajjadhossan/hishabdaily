import { compactForMatch, repairBengaliFragments } from "./normalize";
import type { ParsedBatch, ParsedRow, SourceKind } from "./types";

/* ─────────────────────────────────────────────────────────────
   বহু-ফরম্যাট মিলানো (multi-way reconciliation)

   নীতি: কোনো এক ফাইলকে "সত্য" ধরা হয় না। প্রতিটি ফাইল থেকে একই
   ইউনিভার্সাল রেকর্ড বানানো হয়, তারপর একই লেনদেন চিনে কলাম-ভিত্তিক
   একত্র করা হয় — সবচেয়ে বিশ্বস্ত উৎস থেকে প্রতিটি কলাম নেওয়া হয়।
   ───────────────────────────────────────────────────────────── */

/** কোন উৎস কতটা বিশ্বস্ত (JSON সবচেয়ে ধনী, OCR সবচেয়ে দুর্বল) */
const PRECEDENCE: Record<SourceKind, number> = {
  json: 5,
  excel: 4,
  csv: 3,
  pdf: 2,
  ocr: 1,
  text: 1,
};

const FIELD_WEIGHT: Record<string, number> = {
  date: 4, amount: 5, title: 4, category: 2, person: 2,
  quantity: 1, unit: 1, folder: 2, subFolder: 2, event: 2, note: 1,
};

export interface MergeConflict {
  key: string;
  field: string;
  values: string[];
}

export interface MergeReport {
  sources: Array<{ name: string; kind: SourceKind; rows: number; declaredTotal?: number }>;
  clusters: number;
  /** একাধিক ফাইলে পাওয়া লেনদেনের সংখ্যা */
  matchedAcrossSources: number;
  conflicts: MergeConflict[];
  /** কতটি মerged রোতে নির্দিষ্ট কলামের মান আছে */
  coverage: Record<string, number>;
  declaredTotals: number[];
}

export interface MergedBatch {
  rows: ParsedRow[];
  report: MergeReport;
}

/** নামের ছোট-বড়/বাংলা-ইংরেজি রূপ একই ধরি (শুধু মিলানোর জন্য, দেখানোর নয়) */
export function nameKey(value: string): string {
  return compactForMatch(repairBengaliFragments(value));
}

const PERSON_GROUPS: string[][] = [
  ["সাজ্জাদ (sajjad)", "sajjadhossan", "sajjad hossan", "সাজ্জাদ", "নিজে (self)", "স্বয়ং", "self"],
  ["আরহাম (arham)", "arham hossan", "আরহাম হোসেন ছেলে (son)", "arham", "আরহাম"],
  ["রিমি (rimi)", "amalina rimi", "আমালিনা রিমি স্ত্রী (wife)", "স্ত্রী (wife)", "রিমি"],
  ["পুরো পরিবার (সবার জন্য)", "পুরো পরিবার", "family"],
];

const PERSON_LOOKUP = new Map<string, string>();
for (const group of PERSON_GROUPS) {
  for (const value of group) PERSON_LOOKUP.set(nameKey(value), group[0]);
}

/** একই মানুষের আলাদা লেখা নাম একটিমানে আনি */
export function canonicalPerson(value: string): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  const compact = nameKey(trimmed);
  const exact = PERSON_LOOKUP.get(compact);
  if (exact) return exact;
  // "Sajjadhossan নিজে (Self)"-এর মতো স্ট্রিং — ভেতরে পরিচিত নাম থাকলে ধরি
  let best = "";
  for (const [alias, canonical] of PERSON_LOOKUP) {
    if (alias.length >= 4 && compact.includes(alias) && alias.length > best.length) best = canonical;
  }
  return best || trimmed;
}

/** "Household"-এর মতো লেবেলকে পার্সন ভেবে নতুন ফ্যামিলি মেম্বার বানাই না */
export function isPersonName(value: string): boolean {
  const trimmed = String(value || "").trim();
  if (!trimmed || trimmed.length > 60) return false;
  const c = nameKey(trimmed);
  return !/^(household|গৃহস্থালি|ব্যক্তিগত|personal|পরিবার|family|অজানা|n\/a|none|self)$/.test(c);
}

const CATEGORY_GROUPS: string[][] = [
  ["বাজার", "bazaar", "grocery", "market", "supermarket", "কেনাকাটা", "গ্রোসারি", "household", "গৃহস্থালি ও নিত্য কেনাকাটা", "ভেজিটেবল অ্যাড ফ্রুটস", "ভেজিটেবল অ্যান্ড ফ্রুটস"],
  ["যাতায়াত", "transport", "transport (ভাড়া)", "যাতায়াত ও ভাড়া", "ভাড়া", "ট্রান্সপোর্ট", "ট্রান্সপোর্ট"],
  ["স্বাস্থ্য", "medical", "medicine", "চিকিৎসা ও ওষুধ", "পারিবারিক চিকিৎসা ও ওষুধ", "ওষুধ"],
  ["খাবার", "food", "hotel", "রেস্টুরেন্ট", "নাশতা"],
  ["পোশাক", "clothing", "clothes", "পোশাক", "কাপড়"],
  ["বিদ্যুৎ/পানি", "utility", "utilities", "বিদ্যুৎ", "পানি", "ইউটিলিটি"],
  ["মোবাইল/ইন্টারনেট", "ইন্টারনেট ও মোবাইল", "internet", "mobile", "মোবাইল", "ইন্টারনেট"],
  ["দান/ধর্ম", "gift", "donat", "দান", "জাকাত", "দান, চেরেটি,সাহায্য", "দান/সলকা/সাহায্য/সহযুগীতা", "দান ও সদকা"],
  ["বিনোদন", "sports", "খেলা", "game", "movie"],
  ["পরিবার", "family", "পরিবার", "personal care", "parsonal care", "personal care & beauty", "ব্যক্তিগত যত্ন"],
  ["অন্যান্য", "other", "অন্য", "অন্যান্য"],
];

const CATEGORY_LOOKUP = new Map<string, string>();
for (const group of CATEGORY_GROUPS) {
  for (const value of group) CATEGORY_LOOKUP.set(nameKey(value), group[0]);
}

/** অ্যাপে আগে থেকে থাকা ক্যাটাগরির নাম থাকলে সেটাই ব্যবহার করি */
export function canonicalCategory(value: string, existing: string[] = []): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "অন্যান্য";
  const want = nameKey(trimmed);
  const exact = existing.find((c) => nameKey(c) === want);
  if (exact) return exact;
  const group = CATEGORY_LOOKUP.get(want);
  if (group) {
    const known = existing.find((c) => nameKey(c) === nameKey(group));
    return known || group;
  }
  return trimmed;
}

/** একই লেনদেনের স্থায়ী পরিচয় — একই দিন, একই টাকা, একই আইটেম */
export function canonicalKey(row: ParsedRow): string {
  const date = String(row.date || "").slice(0, 10);
  const amount = Math.round((row.amount || 0) * 100);
  return `${date}|${amount}|${nameKey(row.description || "")}`;
}

interface Candidate {
  row: ParsedRow;
  kind: SourceKind;
  sourceName: string;
  ordinal: number;
}

function sourceKind(row: ParsedRow, batch: ParsedBatch): SourceKind {
  if (row.sourceType) return row.sourceType;
  const parser = batch.meta.parser;
  return parser === "pdf" ? "pdf" : parser === "ocr" ? "ocr" : parser === "excel" ? "excel" : parser === "csv" ? "csv" : "text";
}

function has(row: ParsedRow, field: string): boolean {
  const value = (row as unknown as Record<string, unknown>)[field];
  return typeof value === "string" ? value.trim().length > 0 : value !== undefined && value !== null && value !== 0;
}

/**
 * একাধিক ব্যাচ একত্র করে একটা রিভিউ-যোগ্য তালিকা বানায়।
 * একই ফাইলে একই কী-র আসল ডুপ্লিকেটগুলো ক্রম অনুযায়ী আলাদা ক্লাস্টারে থাকে।
 */
export function mergeBatches(batches: ParsedBatch[], existingCategories: string[] = []): MergedBatch {
  const clusters = new Map<string, Candidate[]>();
  const report: MergeReport = {
    sources: [], clusters: 0, matchedAcrossSources: 0, conflicts: [], coverage: {}, declaredTotals: [],
  };

  for (const batch of batches) {
    const kind = batch.meta.parser === "pdf" ? "pdf" : batch.meta.parser === "ocr" ? "ocr" : batch.meta.parser === "excel" ? "excel" : batch.meta.parser === "csv" ? "csv" : batch.meta.parser === undefined ? "text" : "text";
    report.sources.push({ name: batch.sourceName, kind, rows: batch.rows.length, declaredTotal: batch.meta.declaredTotal });
    if (batch.meta.declaredTotal != null) report.declaredTotals.push(batch.meta.declaredTotal);

    // স্থায়ী কী: তারিখ + টাকা + ধরন + একই দিনে কততম বার (occurrence)।
    // PDF-এ বাংলা শব্দ ভেঙে যাওয়ায় আইটেমের নাম দিয়ে মিলানো যায় না — তাই
    // প্রতিটি ফাইলের নিজস্ব ক্রম ধরে একই অবস্থানের রো জোড়া লাগাই। আসল
    // ডুপ্লিকেট (একই দিনে দুবার ৳৩০) আলাদা occurrence-এ আলাদা ক্লাস্টারে থাকে।
    const seen = new Map<string, number>();
    const ordered = [...batch.rows].sort((a, b) => (a.sourceOrdinal ?? 0) - (b.sourceOrdinal ?? 0));
    ordered.forEach((row, index) => {
      const date = String(row.date || "").slice(0, 10);
      const amount = Math.round((row.amount || 0) * 100);
      // kind-এলা মিচ্ছে (PDF "দেনা" ধরলে JSON "খরচ" ধরে) — তাই কী-তে kind রাখি না
      const bucket = `${date}|${amount}`;
      const occurrence = seen.get(bucket) || 0;
      seen.set(bucket, occurrence + 1);
      const clusterKey = `${bucket}#${occurrence}`;
      const list = clusters.get(clusterKey) || [];
      list.push({
        row,
        kind: sourceKind(row, batch),
        sourceName: batch.sourceName,
        ordinal: row.sourceOrdinal ?? index,
      });
      clusters.set(clusterKey, list);
    });
  }

  const merged: ParsedRow[] = [];
  for (const [key, list] of clusters) {
    list.sort((a, b) => {
      const diff = PRECEDENCE[b.kind] - PRECEDENCE[a.kind];
      return diff !== 0 ? diff : a.ordinal - b.ordinal;
    });
    const base = list[0];
    const out: ParsedRow = { ...base.row, sourceType: base.kind, sourceId: base.row.sourceId || String(base.ordinal + 1) };

    // প্রতিটি কলাম — সবচেয়ে বিশ্বস্ত ফাইলের অ-খালি মান নিই
    for (const field of ["description", "date", "amount", "category", "person", "quantity", "unit", "folder", "subFolder", "event", "note", "recordType"]) {
      for (const candidate of list) {
        if (!has(candidate.row, field)) continue;
        const value = (candidate.row as unknown as Record<string, unknown>)[field];
        if (field === "category") {
          (out as unknown as Record<string, unknown>)[field] = canonicalCategory(String(value), existingCategories);
        } else if (field === "person") {
          (out as unknown as Record<string, unknown>)[field] = canonicalPerson(String(value));
        } else {
          (out as unknown as Record<string, unknown>)[field] = value;
        }
        break;
      }
    }

    // দ্বন্দ্ব — একই লেনদেনে আলাদা টাকা/আইটেম হলে রিভিউতে দেখাব
    for (const field of Object.keys(FIELD_WEIGHT)) {
      const dataField = field === "title" ? "description" : field;
      // PDF/OCR-এ ভাঙা শব্দের সাথে আসল নামের দ্বন্দ্ব দেখালে রিভিউ ভরে যায়
      if (field === "title" && list.some((c) => c.kind === "pdf" || c.kind === "ocr" || c.kind === "text")) continue;
      const values = new Set<string>();
      for (const c of list) {
        if (!has(c.row, dataField)) continue;
        const raw = (c.row as unknown as Record<string, unknown>)[dataField];
        values.add(
          dataField === "person"
            ? canonicalPerson(String(raw))
            : dataField === "category"
              ? canonicalCategory(String(raw), existingCategories)
              : String(raw),
        );
      }
      if (values.size > 1) {
        report.conflicts.push({ key, field, values: [...values].slice(0, 4) });
      }
    }

    if (list.length > 1) report.matchedAcrossSources++;
    const sourceNames = new Set(list.map((c) => c.sourceName));
    out.confidence = Math.min(1, Math.round((base.row.confidence + (sourceNames.size > 1 ? 0.1 : 0) + Math.min(0.1, list.length * 0.02)) * 100) / 100);
    merged.push(out);
  }

  report.clusters = merged.length;
  for (const field of ["person", "folder", "subFolder", "quantity", "unit", "event", "note"]) {
    report.coverage[field] = merged.filter((r) => has(r, field)).length;
  }

  merged.sort((a, b) => {
    const d = String(a.date).localeCompare(String(b.date));
    if (d) return d;
    return (a.sourceOrdinal ?? 0) - (b.sourceOrdinal ?? 0);
  });
  return { rows: merged, report };
}

/** সেভের আগে কড়া যাচাই — declared আর detected মিলছে কি */
export function reconcile(merged: MergedBatch): {
  count: number;
  total: number;
  declaredTotals: number[];
  allMatch: boolean;
  conflicts: MergeConflict[];
} {
  const expenseRows = merged.rows.filter((r) => r.kind === "expense");
  const total = Math.round(expenseRows.reduce((s, r) => s + r.amount, 0) * 100) / 100;
  const declaredTotals = merged.report.declaredTotals.map((v) => Math.round(v * 100) / 100);
  return {
    count: expenseRows.length,
    total,
    declaredTotals,
    allMatch: declaredTotals.length > 0 && declaredTotals.every((v) => Math.abs(v - total) < 0.5),
    conflicts: merged.report.conflicts,
  };
}
