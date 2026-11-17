import Papa from "papaparse";
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
  score: number;
}

const HEADER_WORDS = {
  date: ["date", "txn date", "transaction date", "value date", "posting date", "time", "তারিখ", "দিন", "dt"],
  description: ["description", "details", "particulars", "narration", "memo", "remarks", "particular", "বিবরণ", "বর্ণনা", "নাম", "খাত"],
  amount: ["amount", "amt", "amount (bdt)", "টাকা", "অঙ্ক", "total", "value"],
  debit: ["debit", "dr", "dr.", "withdrawal", "withdraw", "খরচ", "ব্যয়", "ডেবিট", "debit(bdt)"],
  credit: ["credit", "cr", "cr.", "deposit", "জমা", "ক্রেডিট", "income"],
  balance: ["balance", "bal", "ব্যালেন্স", "অবশিষ্ট", "closing"],
  category: ["category", "ক্যাটাগরি", "খাত", "ধরন"],
  type: ["type", "kind", "dr/cr", "ধরন", "টাইপ"],
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
        if (HEADER_WORDS[key].some((word) => cell === word || cell.includes(word))) found.set(key, ci);
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
      .replace(/(?:^|\s)[+-]?\d[\d,]*(?:\.\d{1,2})?(?:\s*\/\-\s*)?(?=\s|$)/g, " ")
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
    });
  }
  return rows;
}

/** PDF/OCR-এর মতো ফ্রি-টেক্সট থেকে লাইন ধরে লেনদেন বানায় */
export function rowsFromFreeText(text: string, sourceName: string): ParsedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => normalizeText(line))
    .filter((line) => line.length > 6 && /\d/.test(line));

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
    });
  }
  return rows;
}

/** ডুপ্লিকেট চেক — একই fingerprint আগের ইম্পোর্টে ছিল কি না */
export function filterDuplicates(rows: ParsedRow[], knownFingerprints: Set<string>): { fresh: ParsedRow[]; duplicates: number } {
  const seen = new Set<string>();
  const fresh: ParsedRow[] = [];
  let duplicates = 0;
  for (const row of rows) {
    if (knownFingerprints.has(row.fingerprint) || seen.has(row.fingerprint)) {
      duplicates++;
      continue;
    }
    seen.add(row.fingerprint);
    fresh.push(row);
  }
  return { fresh, duplicates };
}

export function kindLabel(kind: ImportKind): string {
  return kind === "income" ? "আয়" : kind === "debt" ? "দেনা-পাওনা" : "ব্যয়";
}
