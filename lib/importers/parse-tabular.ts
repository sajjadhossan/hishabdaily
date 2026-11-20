import Papa from "papaparse";
import { canonicalPerson, isPersonName } from "./canonical";
import {
  categoryConfidence,
  findAmounts,
  fold,
  guessCategory,
  guessDebtDirection,
  guessKind,
  hashString,
  normalizeText,
  parseDate,
  parseDateCell,
  pickAmount,
  rowFingerprint,
} from "./normalize";
import type { ImportKind, ParsedRow, TableParseResult } from "./types";

/* ─────────────────────────────────────────────────────────────
   CSV / TSV / টেক্সট → সেল ম্যাট্রিক্স
   ───────────────────────────────────────────────────────────── */

function guessDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, 8).join("\n");
  const candidates = ["\t", ",", ";", "|"];
  let best = ",";
  let bestCount = 0;
  for (const d of candidates) {
    const count = sample.split(d).length - 1;
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

export function parseDelimited(text: string): TableParseResult {
  const delimiter = guessDelimiter(text);
  const parsed = Papa.parse<string[]>(text, {
    delimiter,
    skipEmptyLines: "greedy",
    // কোনো কোটেড ফিল্ড ভাঙলে Papaparse নিজেই টেনে আনে
  });
  const rows = (parsed.data || [])
    .filter((row) => Array.isArray(row) && row.some((c) => String(c ?? "").trim()))
    .map((cells, index) => ({ cells: cells.map((c) => String(c ?? "").trim()), index }));
  return { rows, delimiter: delimiter === "\t" ? "tab" : delimiter };
}

export function parsePlainText(text: string): TableParseResult {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => ({ cells: [line], index }));
  return { rows };
}

/** Excel (.xlsx) — এক্সেল ফাইল হলে dynamic import (বান্ডেল ছোট রাখতে) */
export async function parseExcelFile(file: File): Promise<TableParseResult> {
  const mod = await import("read-excel-file/browser");
  const matrix = await mod.readSheet(file);
  const rows = matrix
    .map((cells, index) => ({
      cells: cells.map((cell) => {
        if (cell === null || cell === undefined) return "";
        if (cell instanceof Date) return cell.toISOString().slice(0, 10);
        return String(cell).trim();
      }),
      index,
    }))
    .filter((row) => row.cells.some(Boolean));
  return { rows, sheetName: "Sheet1" };
}

/* ─────────────────────────────────────────────────────────────
   হেডার শনাক্ত
   ───────────────────────────────────────────────────────────── */

interface HeaderMap {
  index: number;
  date: number;
  description: number;
  amount: number;
  debit: number;
  credit: number;
  balance: number;
  category: number;
  type: number;
  person: number;
  quantity: number;
  unit: number;
  event: number;
  note: number;
  folder: number;
  subFolder: number;
  serial: number;
  score: number;
}

const HEADER_WORDS = {
  date: ["date", "txn date", "transaction date", "value date", "posting date", "time", "তারিখ", "দিন", "dt"],
  description: ["description", "item description", "details", "particulars", "narration", "memo", "particular", "বিবরণ", "বর্ণনা", "নাম", "আইটেম"],
  amount: ["amount", "amt", "amount (bdt)", "টাকা", "অঙ্ক", "total", "value"],
  debit: ["debit", "dr", "dr.", "withdrawal", "withdraw", "খরচ", "ব্যয়", "ডেবিট", "debit(bdt)"],
  credit: ["credit", "cr", "cr.", "deposit", "জমা", "ক্রেডিট", "income"],
  balance: ["balance", "bal", "ব্যালেন্স", "অবশিষ্ট", "closing"],
  category: ["category", "ক্যাটাগরি", "খাত", "ধরন"],
  type: ["type", "kind", "dr/cr", "টাইপ"],
  person: ["person", "family member", "familymember", "member", "পার্সন", "ব্যক্তি", "সদস্য"],
  quantity: ["quantity", "qty", "পরিমাণ"],
  unit: ["unit", "ইউনিট"],
  event: ["event", "event name", "অনুষ্ঠান", "ইভেন্ট"],
  note: ["notes", "note", "remarks", "মন্তব্য", "নোট"],
  folder: ["folder", "ফোল্ডার"],
  subFolder: ["sub folder", "subfolder", "sub folder", "সাব ফোল্ডার"],
  serial: ["sl", "sl.", "sr", "sr.", "ক্রম", "নং"],
};

function detectHeader(rows: TableParseResult["rows"]): HeaderMap | null {
  const limit = Math.min(rows.length, 12);
  let best: HeaderMap | null = null;
  for (let i = 0; i < limit; i++) {
    const cells = rows[i].cells.map(fold);
    const found = new Map<keyof typeof HEADER_WORDS, number>();
    cells.forEach((cell, ci) => {
      (Object.keys(HEADER_WORDS) as Array<keyof typeof HEADER_WORDS>).forEach((key) => {
        if (found.has(key)) return;
        // "cr"/"dr"/"sl" ছোট শব্দ — ভেতরে মিলালে "Item Description"-এ cr ধরা যায়।
        // তাই ছোট শব্দ শুধু হুবহু, বড় শব্দই ভেতরে খুঁজি।
        if (HEADER_WORDS[key].some((word) => cell === word || (word.length >= 4 && cell.includes(word)))) {
          found.set(key, ci);
        }
      });
    });
    const core = ["date", "description", "amount", "debit", "credit"].filter((k) => found.has(k as keyof typeof HEADER_WORDS)).length;
    if (core < 2) continue;
    const map: HeaderMap = {
      index: i,
      date: found.get("date") ?? -1,
      description: found.get("description") ?? -1,
      amount: found.get("amount") ?? -1,
      debit: found.get("debit") ?? -1,
      credit: found.get("credit") ?? -1,
      balance: found.get("balance") ?? -1,
      category: found.get("category") ?? -1,
      type: found.get("type") ?? -1,
      person: found.get("person") ?? -1,
      quantity: found.get("quantity") ?? -1,
      unit: found.get("unit") ?? -1,
      event: found.get("event") ?? -1,
      note: found.get("note") ?? -1,
      folder: found.get("folder") ?? -1,
      subFolder: found.get("subFolder") ?? -1,
      serial: found.get("serial") ?? -1,
      score: core,
    };
    if (!best || map.score > best.score) best = map;
  }
  return best;
}

function cellAt(cells: string[], index: number): string {
  return index >= 0 && index < cells.length ? cells[index] : "";
}

/** সেল-অ্যারের অংশ হিসেবে এসে থাকা তারিখ/অঙ্ক বাদ দিয়ে বিবরণ বানায় */
function cleanDescription(cells: string[], skip: number[]): string {
  const parts = cells.filter((_, i) => !skip.includes(i)).map((c) => normalizeText(c)).filter(Boolean);
  let text = parts.join(" · ");
  const amounts = findAmounts(text);
  if (amounts.length) {
    // অঙ্কগুলোর ঠিক আগের/পরের তারিখও সরাই
    text = text
      .replace(/\b\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}\b/g, " ")
      .replace(/(?:৳|টাকা|tk\.?|bdt|rs\.?)\s*[+-]?\d[\d,]*(?:\.\d{1,2})?/gi, " ")
      .replace(/(?:^|\s)[+-]?\d[\d,]*(?:\.\d{1,2})?(?=\s|$)/g, " ")
      .replace(/\s+(?:৳|টাকা|tk|bdt|rs)\.?\s*$/i, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return text || fold(cells.join(" ")).slice(0, 120) || "লেনদেন";
}

/* ─────────────────────────────────────────────────────────────
   সেল → ParsedRow
   ───────────────────────────────────────────────────────────── */

export function rowsFromTable(table: TableParseResult, sourceName: string): ParsedRow[] {
  const header = detectHeader(table.rows);
  const dataRows = header ? table.rows.filter((r) => r.index > header.index) : table.rows;
  const rows: ParsedRow[] = [];

  for (const tableRow of dataRows) {
    const cells = tableRow.cells.map((c) => normalizeText(c));
    if (!cells.some(Boolean)) continue;

    const joined = cells.join(" ");
    let date = header && header.date >= 0 ? parseDateCell(cellAt(cells, header.date)) : null;
    if (!date) date = parseDate(joined);

    const description = header && header.description >= 0
      ? cellAt(cells, header.description) || cleanDescription(cells, [header.description, header.date, header.amount, header.debit, header.credit, header.balance])
      : cleanDescription(cells, [header?.date ?? -1, header?.amount ?? -1, header?.debit ?? -1, header?.credit ?? -1, header?.balance ?? -1]);

    let amount: number | null = null;
    let negative = false;
    let explicitKind = "";

    if (header) {
      const debit = cellAt(cells, header.debit);
      const credit = cellAt(cells, header.credit);
      if (debit && /\d/.test(debit)) {
        const hit = pickAmount(debit);
        if (hit) {
          amount = hit.amount;
          negative = true;
          explicitKind = "debit";
        }
      } else if (credit && /\d/.test(credit)) {
        const hit = pickAmount(credit);
        if (hit) {
          amount = hit.amount;
          negative = false;
          explicitKind = "credit";
        }
      }
      if (amount === null && header.amount >= 0) {
        const hit = pickAmount(cellAt(cells, header.amount));
        if (hit) {
          amount = hit.amount;
          negative = hit.negative;
        }
      }
    }
    if (amount === null) {
      const hit = pickAmount(joined);
      if (hit) {
        amount = hit.amount;
        negative = hit.negative;
      }
    }
    if (amount === null) continue;

    const explicitType = header ? cellAt(cells, header.type) : "";
    const explicitCategory = header ? cellAt(cells, header.category) : "";
    const rawPerson = header ? cellAt(cells, header.person) : "";
    const person = isPersonName(rawPerson) ? canonicalPerson(rawPerson) : "";
    const qtyRaw = header ? cellAt(cells, header.quantity) : "";
    const quantity = qtyRaw && /\d/.test(qtyRaw) ? Number(qtyRaw.replace(/,/g, "")) || undefined : undefined;
    const serial = header ? cellAt(cells, header.serial) : "";
    const kind = guessKind(`${description} ${explicitType} ${explicitCategory}`, explicitKind || explicitType, negative);
    const guessedCategory = guessCategory(`${description} ${explicitCategory}`, kind);
    const category = explicitCategory && !/^( category| ধরন)$/i.test(explicitCategory)
      ? guessCategory(`${explicitCategory} ${description}`, kind)
      : guessedCategory;

    let confidence = 0.35;
    if (date) confidence += 0.25;
    if (description.length > 3) confidence += 0.15;
    if (header) confidence += 0.12;
    if (category !== "অন্যান্য") confidence = Math.max(confidence, categoryConfidence(description, category));
    confidence = Math.min(0.98, confidence);

    const isExcel = /\.(xlsx?|ods)$/i.test(sourceName);
    rows.push({
      id: hashString(`${sourceName}-${tableRow.index}-${joined}`) + `-${tableRow.index}`,
      date: date || "",
      description: description.slice(0, 160) || "লেনদেন",
      amount: Math.round(amount * 100) / 100,
      kind,
      ...(kind === "debt" ? { debtDirection: guessDebtDirection(description) } : {}),
      category,
      confidence: Math.round(confidence * 100) / 100,
      raw: tableRow.cells.join(" | ").slice(0, 300),
      fingerprint: rowFingerprint(date || "", amount, description),
      selected: true,
      sourceType: isExcel ? "excel" : "csv",
      sourceId: serial || undefined,
      sourceOrdinal: tableRow.index,
      ...(person ? { person } : {}),
      ...(quantity ? { quantity } : {}),
      ...(header && cellAt(cells, header.unit) ? { unit: cellAt(cells, header.unit) } : {}),
      ...(header && cellAt(cells, header.event) ? { event: cellAt(cells, header.event) } : {}),
      ...(header && cellAt(cells, header.note) ? { note: cellAt(cells, header.note) } : {}),
      ...(header && cellAt(cells, header.folder) ? { folder: cellAt(cells, header.folder) } : {}),
      ...(header && cellAt(cells, header.subFolder) ? { subFolder: cellAt(cells, header.subFolder) } : {}),
    });
  }
  return rows;
}

/** নিশ্চিত হেডার/ফুটার — তারিখ থাকলেও কখনো লেনদেন নয় */
const HARD_NOISE_RE = /generated\s*on|period\s*:|verified|smart\s*report|statement|daily\s*expense|পৃষ্ঠা|page\s*\d|হিসাব\s*-?\s*কিতাব|hisabkitab|©|all\s*rights/i;
/** সারাংশের শব্দ — শুধু তারিখ না থাকলেই বাদ দিই (মোটরসাইকেল/Total Nutrition রাখতে) */
const SOFT_NOISE_RE = /তারিখ|খাত|আইটেম|অ্যাকাউন্ট|মোট|টোটাল|সাবটোটাল|total|subtotal|grand\s*total|balance/i;

/** PDF/OCR-এর মতো ফ্রি-টেক্সট থেকে লাইন ধরে লেনদেন বানায় */
export function rowsFromFreeText(
  text: string,
  sourceName: string,
  opts?: { requireDate?: boolean; sourceType?: "pdf" | "ocr" | "text" },
): ParsedRow[] {
  const rawLines = text.split(/\r?\n/).map((line) => normalizeText(line));
  const lines = rawLines.filter((line) => {
    if (line.length <= 6 || !/\d/.test(line)) return false;
    if (HARD_NOISE_RE.test(line)) return false;
    // PDF-এ প্রতিটি আসল লাইনে তারিখ থাকে — তারিখ থাকলে সারাংশের শব্দ থাকলেও রাখি
    if (parseDate(line)) return true;
    if (opts?.requireDate) return false;
    return !SOFT_NOISE_RE.test(line);
  });

  const rows: ParsedRow[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const date = parseDate(line) || "";
    const hit = pickAmount(line);
    if (!hit) continue;
    const description = cleanDescription([line], [])
      .replace(/\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (description.length < 3 && !date) continue;

    const kind = guessKind(description, undefined, hit.negative);
    const category = guessCategory(description, kind);
    let confidence = 0.3 + (date ? 0.25 : 0) + (description.length > 4 ? 0.15 : 0);
    if (category !== "অন্যান্য") confidence = Math.max(confidence, categoryConfidence(description, category));

    rows.push({
      id: hashString(`${sourceName}-${i}-${line}`) + `-${i}`,
      date,
      description: description.slice(0, 160) || "লেনদেন",
      amount: Math.round(hit.amount * 100) / 100,
      kind,
      ...(kind === "debt" ? { debtDirection: guessDebtDirection(description) } : {}),
      category,
      confidence: Math.min(0.95, Math.round(confidence * 100) / 100),
      raw: line.slice(0, 300),
      fingerprint: rowFingerprint(date, hit.amount, description),
      selected: true,
      sourceType: opts?.sourceType || "text",
      sourceOrdinal: i,
    });
  }
  return rows;
}

/**
 * ডুপ্লিকেট চেক — শুধু আগের ইম্পোর্ট/বর্তমান ডেটার সাথে মিল বাদ দেয়।
 * একই ফাইলে একই দিন একই টাকার দুটো আসল লেনদেন থাকতে পারে (যেমন দুবার auto-vara ৳৩০) —
 * সেগুলো রেখে দিই, নাহলে আসল টাকা কমে যায়। ফাইলের হ্যাশ দিয়ে একই ফাইল আবার এড়ানো হয়।
 */
export function filterDuplicates(rows: ParsedRow[], knownFingerprints: Set<string>): { fresh: ParsedRow[]; duplicates: number } {
  const fresh: ParsedRow[] = [];
  let duplicates = 0;
  for (const row of rows) {
    if (knownFingerprints.has(row.fingerprint)) {
      duplicates++;
      continue;
    }
    fresh.push(row);
  }
  return { fresh, duplicates };
}

export function kindLabel(kind: ImportKind): string {
  return kind === "income" ? "আয়" : kind === "debt" ? "দেনা-পাওনা" : "ব্যয়";
}
