/* ─────────────────────────────  Excel এক্সপোর্ট  ─────────────────────────────
 * SpreadsheetML (XML) ফরম্যে .xls ফাইল তৈরি করা হয় — কোনো নতুন লাইব্রেরি
 * লাগবে না, বাংলা লেখা ঠিক থাকে, Excel ও LibreOffice দুটোতেই খোলে।
 * প্রতিটা রিপোর্টের নিজস্ব শিট থাকে; চাইলে সব রিপোর্ট এক ফাইলেও বের করা যায়।
 */

import type { Report } from "./reports";
import { downloadBlob, isoDate } from "./utils";

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Excel শিটের নামে কিছু অক্ষর চলে না */
function sheetName(name: string): string {
  return (
    name
      .replace(/[\\/?*\[\]:]/g, "-")
      .replace(/^\s+|\s+$/g, "")
      .slice(0, 31) || "Report"
  );
}

interface SheetSpec {
  name: string;
  title: string;
  subtitle: string;
  note?: string;
  headers: string[];
  rows: (string | number)[][];
  summaries?: { label: string; value: string }[];
}

function cell(value: string | number, style?: string): string {
  const numeric = typeof value === "number" && Number.isFinite(value);
  const attr = style ? ` ss:StyleID="${style}"` : "";
  return `<Cell${attr}><Data ss:Type="${numeric ? "Number" : "String"}">${esc(String(value))}</Data></Cell>`;
}

function sheetXml(spec: SheetSpec): string {
  const lines: string[] = [];
  lines.push(`<Worksheet ss:Name="${esc(sheetName(spec.name))}">`);
  lines.push("<Table>");
  lines.push(`<Row>${cell(spec.title, "title")}</Row>`);
  lines.push(`<Row>${cell(spec.subtitle, "sub")}</Row>`);
  if (spec.summaries?.length) {
    for (const s of spec.summaries) {
      lines.push(`<Row>${cell(s.label, "sumLabel")}${cell(s.value, "sumValue")}</Row>`);
    }
  }
  lines.push("<Row></Row>");
  lines.push(`<Row>${spec.headers.map((h) => cell(h, "header")).join("")}</Row>`);
  for (const row of spec.rows) {
    lines.push(`<Row>${row.map((v, i) => cell(v, i > 0 && typeof v === "number" ? "num" : undefined)).join("")}</Row>`);
  }
  if (spec.note) {
    lines.push("<Row></Row>");
    lines.push(`<Row>${cell(`মনে রাখবেন: ${spec.note}`, "note")}</Row>`);
  }
  lines.push("</Table>");
  lines.push("</Worksheet>");
  return lines.join("");
}

function workbookXml(sheets: SheetSpec[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal"><Font ss:FontName="Calibri" ss:Size="11"/><Alignment ss:Vertical="Center"/></Style>
  <Style ss:ID="title"><Font ss:FontName="Calibri" ss:Size="16" ss:Bold="1" ss:Color="#14532D"/></Style>
  <Style ss:ID="sub"><Font ss:FontName="Calibri" ss:Size="10" ss:Color="#64748B"/></Style>
  <Style ss:ID="sumLabel"><Font ss:Bold="1" ss:Color="#334155"/></Style>
  <Style ss:ID="sumValue"><Font ss:Bold="1" ss:Color="#15803D"/></Style>
  <Style ss:ID="header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#16A34A" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>
  <Style ss:ID="num"><NumberFormat ss:Format="#,##0.00"/></Style>
  <Style ss:ID="note"><Font ss:Size="9" ss:Color="#64748B"/></Style>
 </Styles>
${sheets.map(sheetXml).join("\n")}
</Workbook>`;
}

function reportToSheet(report: Report): SheetSpec {
  return {
    name: report.title,
    title: report.title,
    subtitle: `${report.subtitle} · তৈরি: ${isoDate()}`,
    note: report.note,
    headers: report.columns.map((c) => c.label),
    rows: report.rows.map((row) => report.columns.map((c) => row[c.key] ?? "")),
    summaries: report.summaries,
  };
}

function saveWorkbook(sheets: SheetSpec[], fileName: string): void {
  const xml = workbookXml(sheets);
  downloadBlob(new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8" }), fileName);
}

export function downloadReportExcel(report: Report): void {
  saveWorkbook([reportToSheet(report)], `hishab-${report.key}-${isoDate()}.xls`);
}

export function downloadAllReportsExcel(reports: Report[]): void {
  saveWorkbook(reports.map(reportToSheet), `hishab-all-reports-${isoDate()}.xls`);
}
