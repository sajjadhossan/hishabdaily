import { rowsFromJsonBackup } from "./adapters/json-backup";
import { parsePdfFile } from "./parse-pdf";
import {
  parseDelimited,
  parseExcelFile,
  parsePlainText,
  rowsFromFreeText,
  rowsFromTable,
} from "./parse-tabular";
import type { ParsedBatch, ParsedRow, ProgressCallback } from "./types";

function extension(name: string): string {
  return (name.split(".").pop() || "").toLowerCase();
}

async function sha256(file: File): Promise<string> {
  try {
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return `${file.name}-${file.size}-${file.lastModified}`;
  }
}

export async function parseImportFile(
  file: File,
  onProgress?: ProgressCallback,
): Promise<ParsedBatch> {
  const sourceName = file.name || "ফাইল";
  const ext = extension(sourceName);
  const warnings: string[] = [];
  const fileHash = await sha256(file);
  let rows: ParsedRow[] = [];
  let parser: ParsedBatch["meta"]["parser"] = "text";
  let pages: number | undefined;
  let engine: string | undefined;
  let skippedLines: number | undefined;
  let declaredTotal: number | undefined;

  if (ext === "pdf" || file.type === "application/pdf") {
    const result = await parsePdfFile(file, sourceName, onProgress);
    rows = result.rows;
    parser = result.engine === "ocr" ? "ocr" : "pdf";
    pages = result.pages;
    engine = result.engine === "ocr" ? "Tesseract (eng+ben)" : "PDF text layer";
    declaredTotal = result.declaredTotal;
    if (result.engine === "ocr") warnings.push("স্ক্যান করা PDF — OCR দিয়ে পড়া হয়েছে, হিসাবগুলো একবার যাচাই করে নিন।");
  } else if (ext === "xlsx" || file.type.includes("spreadsheet")) {
    onProgress?.({ phase: "Excel ফাইল পড়ছি…", percent: 25 });
    const table = await parseExcelFile(file);
    rows = rowsFromTable(table, sourceName);
    parser = "excel";
    skippedLines = table.rows.length - rows.length;
  } else if (ext === "xls") {
    warnings.push("পুরোনো .xls ফাইল সমর্থিত নয় — ফাইলটিকে .xlsx বা .csv হিসেবে সেভ করে আবার দিন।");
  } else if (ext === "json" || file.type === "application/json") {
    onProgress?.({ phase: "ব্যাকআপ পড়ছি…", percent: 30 });
    const text = await file.text();
    try {
      const result = rowsFromJsonBackup(text, sourceName);
      rows = result.rows;
      if (result.excludedExpenses) {
        warnings.push(
          `${result.excludedExpenses} টি ব্যবসা/পরিবারের খরচ বাদ দেওয়া হয়েছে — এগুলো দৈনিক স্টেটমেন্টের অংশ নয়।`,
        );
      }
      if (!rows.length) warnings.push("JSON-এ কোনো লেনদেন পাওয়া যায়নি।");
    } catch (err) {
      warnings.push(err instanceof Error ? err.message : "JSON ফাইলটি পড়া যায়নি।");
    }
  } else {
    onProgress?.({ phase: "ফাইল পড়ছি…", percent: 25 });
    const text = (await file.text()).replace(/^\uFEFF/, "");
    const table = parseDelimited(text);
    const multiColumn = table.rows.some((r) => r.cells.length > 1);
    if (multiColumn) {
      const mapped = rowsFromTable(table, sourceName);
      rows = mapped.length ? mapped : rowsFromFreeText(text, sourceName);
      parser = table.delimiter === "\t" ? "tsv" : "csv";
    } else {
      rows = rowsFromFreeText(text, sourceName);
      parser = "text";
    }
    skippedLines = parsePlainText(text).rows.length - rows.length;
  }

  if (!rows.length) {
    warnings.push("এই ফাইলে কোনো তারিখ/টাকার অঙ্ক শনাক্ত করা যায়নি। ফাইলের একটা নমুনা আমার কাছে পাঠালে পার্সার মানিয়ে নেব।");
  } else {
    const noDate = rows.filter((r) => !r.date).length;
    if (noDate) warnings.push(`${noDate} টি লেনদেনের তারিখ পাওয়া যায়নি — রিভিউতে বসিয়ে দিন।`);
    const lowConfidence = rows.filter((r) => r.confidence < 0.5).length;
    if (lowConfidence) warnings.push(`${lowConfidence} টি লেনদেনের ধরন/খাত নিশ্চিত নয় — হলুদ চিহ্নিতগুলো দেখে নিন।`);
  }

  onProgress?.({ phase: "প্রস্তুত", percent: 100 });
  return {
    rows,
    warnings,
    sourceName,
    fileHash,
    meta: { parser, pages, engine, skippedLines, declaredTotal },
  };
}
