import { findDeclaredTotal } from "./normalize";
import { rowsFromFreeText } from "./parse-tabular";
import type { ParsedRow, ProgressCallback } from "./types";

export interface PdfParseResult {
  rows: ParsedRow[];
  text: string;
  pages: number;
  engine: "text" | "ocr";
  /** PDF-এ নিজে লেখা "মোট দৈনিক খরচ : ৳ …" — মিল যাচাইয়ের জন্য */
  declaredTotal?: number;
}

interface TextLikeItem {
  str?: string;
  transform?: number[];
}

/** item-এর শুরুতে বসা ভাঙা 'ি' (িচ → চি) — শুধু item-এর প্রথম অবস্থানে প্রয়োগ */
const LEADING_I_RE = /^\u09bf([\u0995-\u09b9\u09dc-\u09df])/;

/**
 * pdfjs-এর text items-কে y-অনুযায়ী লাইনে সাজায়।
 *
 * Chromium/Skia print-to-PDF-এ বাংলার প্রতিটি glyph-cluster আলাদা item হয়
 * আর শব্দের মাঝের space-ও একটা আলাদা item (`str === " "`) হিসেবে আসে।
 * আগে ওই space item-গুলো ফেলে দিয়ে সব item-এর মাঝে নিজে " " দেওয়া হতো —
 * ফলে "যাতায়াত ও ভাড়া" লেখাটি "যা তা য়া ত ও ভা ড়া" হয়ে যেতো। এখন আসল
 * space item-গুলো রেখে কোনো joiner ছাড়াই x-অনুযায়ী জোড়া লাগাই।
 */
function itemsToText(items: TextLikeItem[]): string {
  const lines = new Map<number, Array<{ x: number; str: string }>>();
  for (const item of items) {
    if (typeof item.str !== "string") continue;
    const y = Math.round(item.transform?.[5] ?? 0);
    const x = item.transform?.[4] ?? 0;
    const arr = lines.get(y) ?? [];
    // Skia আগে-বসা 'ি' কে ব্যঞ্জনের আগে লেখে (িচ) — item-স্তরেই ঠিক করি,
    // যাতে পরের item-এর 'ি'-ও নিজের জায়গায় ফিরে যায় (িচ + িক → চি + কি)।
    arr.push({ x, str: item.str.replace(LEADING_I_RE, "$1\u09bf") });
    lines.set(y, arr);
  }
  return [...lines.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, parts]) =>
      parts
        .sort((a, b) => a.x - b.x)
        .map((p) => p.str)
        .join("")
        .replace(/[ \t]+/g, " ")
        .trim(),
    )
    .filter(Boolean)
    .join("\n");
}

export async function parsePdfFile(
  file: File,
  sourceName: string,
  onProgress?: ProgressCallback,
): Promise<PdfParseResult> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  onProgress?.({ phase: "PDF পড়ছি…", percent: 8 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data: bytes, useSystemFonts: true, isEvalSupported: false });
  const doc = await task.promise;

  const pageTexts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = itemsToText(content.items as TextLikeItem[]);
    pageTexts.push(text);
    onProgress?.({ phase: `পৃষ্ঠা ${i}/${doc.numPages} পড়ছি…`, percent: 8 + Math.round((i / doc.numPages) * 42) });
  }

  let combined = pageTexts.join("\n");
  let engine: "text" | "ocr" = "text";
  const avgChars = combined.length / Math.max(1, doc.numPages);

  // স্ক্যান করা PDF-এ টেক্সট থাকে না — সেক্ষেত্রে ব্রাউজারেই OCR চালাই
  if (avgChars < 45) {
    engine = "ocr";
    onProgress?.({ phase: "স্ক্যান করা পৃষ্ঠা — OCR চালু করছি…", percent: 52 });
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng+ben", 1, {
      workerPath: "/tess/worker.min.js",
      logger: (msg) => {
        if (msg.status === "recognizing text" && typeof msg.progress === "number") {
          onProgress?.({
            phase: "ছবি থেকে লেখা শনাক্ত করছি…",
            percent: 55 + Math.round(msg.progress * 38),
          });
        }
      },
    });
    try {
      const ocrPages: string[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) throw new Error("ক্যানভাস তৈরি করা যায়নি।");
        await page.render({ canvasContext: ctx, viewport }).promise;
        const result = await worker.recognize(canvas);
        ocrPages.push(result.data.text || "");
      }
      combined = ocrPages.join("\n");
    } finally {
      await worker.terminate();
    }
  }

  onProgress?.({ phase: "লেনদেন শনাক্ত করছি…", percent: 95 });
  const declaredTotal = findDeclaredTotal(combined) ?? undefined;
  const pdfOpts = { requireDate: true, sourceType: engine === "ocr" ? "ocr" as const : "pdf" as const };
  let rows = rowsFromFreeText(combined, sourceName, pdfOpts);
  // OCR-এ তারিখ ভুল পড়া হলে সব রো হারানোর চেয়ে ফ্যালব্যাক ব্যবহার করি
  if (!rows.length) rows = rowsFromFreeText(combined, sourceName, { sourceType: pdfOpts.sourceType });
  await doc.destroy();
  return { rows, text: combined, pages: doc.numPages, engine, declaredTotal };
}
