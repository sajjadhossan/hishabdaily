import { rowsFromFreeText } from "./parse-tabular";
import type { ParsedRow, ProgressCallback } from "./types";

export interface PdfParseResult {
  rows: ParsedRow[];
  text: string;
  pages: number;
  engine: "text" | "ocr";
}

interface TextLikeItem {
  str?: string;
  transform?: number[];
}

/** pdfjs-এর text items-কে y-অনুযায়ী লাইনে সাজায় */
function itemsToText(items: TextLikeItem[]): string {
  const lines = new Map<number, Array<{ x: number; str: string }>>();
  for (const item of items) {
    if (typeof item.str !== "string" || !item.str.trim()) continue;
    const y = Math.round(item.transform?.[5] ?? 0);
    const x = item.transform?.[4] ?? 0;
    const arr = lines.get(y) ?? [];
    arr.push({ x, str: item.str });
    lines.set(y, arr);
  }
  return [...lines.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, parts]) =>
      parts
        .sort((a, b) => a.x - b.x)
        .map((p) => p.str)
        .join(" ")
        .replace(/\s+/g, " ")
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
  const rows = rowsFromFreeText(combined, sourceName);
  await doc.destroy();
  return { rows, text: combined, pages: doc.numPages, engine };
}
