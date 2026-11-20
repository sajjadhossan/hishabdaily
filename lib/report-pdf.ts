/* ─────────────────────────────  PDF এক্সপোর্ট  ─────────────────────────────
 * রিপোর্টটা আগে একটা সুন্দর HTML হিসেবে বানানো হয়, তারপর canvas-এ এঁকে
 * PDF-এ ঢোকানো হয়। ফলে বাংলা লেখা ও লোগো ঠিকমতো দেখা যায় (jsPDF-এর
 * নিজস্ব ফন্টে বাংলা লেখা ঠিকমতো আসতে পারে না)। লাইব্রেরি দুটো শুধু এই ফাংশন
 * চালু হওয়ার সময় লোড হয় — অ্যাপের মূল bundle ভারী হয় না।
 */

import { formatCell, type Report } from "./reports";
import { isoDate } from "./utils";

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function reportHtml(
  report: Report,
  userName: string,
  currency: string,
  bengali: boolean,
): string {
  const header = report.columns
    .map(
      (c) =>
        `<th style="padding:10px 12px;text-align:${c.format && c.format !== "text" ? "right" : "left"};font-size:11px;font-weight:700;color:#fff;background:#15803d;border-bottom:2px solid #166534;white-space:nowrap">${esc(c.label)}</th>`,
    )
    .join("");

  const rows = report.rows.length
    ? report.rows
        .map(
          (row, i) =>
            `<tr style="background:${i % 2 ? "#f8fafc" : "#ffffff"};border-bottom:1px solid #e2e8f0">${report.columns
              .map((c) => {
                const value = formatCell(row[c.key] ?? "", c.format, currency, bengali);
                const right = c.format && c.format !== "text" ? "right" : "left";
                const strong = c.format === "money" ? "700" : "500";
                return `<td style="padding:9px 12px;text-align:${right};font-size:12px;font-weight:${strong};color:#0f172a;white-space:nowrap">${esc(value)}</td>`;
              })
              .join("")}</tr>`,
        )
        .join("")
    : `<tr><td colspan="${report.columns.length}" style="padding:32px;text-align:center;color:#64748b;font-size:12px">এই সময়ের কোনো তথ্য নেই।</td></tr>`;

  const summaries = report.summaries.length
    ? `<div style="display:flex;gap:10px;margin:18px 0 22px">${report.summaries
        .map(
          (s) =>
            `<div style="flex:1;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:12px 14px"><div style="font-size:10px;color:#475569;font-weight:600">${esc(s.label)}</div><div style="font-size:14px;font-weight:800;color:#14532d;margin-top:4px">${esc(s.value)}</div></div>`,
        )
        .join("")}</div>`
    : "";

  return `<div xmlns="http://www.w3.org/1999/xhtml" style="width:794px;box-sizing:border-box;background:#ffffff;color:#0f172a;padding:36px 40px;font-family:'Noto Sans Bengali','Solaimanlipi',Arial,sans-serif">
    <div style="display:flex;align-items:center;gap:14px;border-bottom:3px solid #16a34a;padding-bottom:16px">
      <img src="/icon.svg" alt="হিসাব" width="54" height="54" style="width:54px;height:54px;display:block" />
      <div style="line-height:1.15">
        <div style="font-size:24px;font-weight:800;letter-spacing:-0.5px;color:#14532d">হিসাব</div>
        <div style="font-size:11px;color:#64748b;margin-top:3px">আয় · ব্যয় · দেনা-পাওনা</div>
      </div>
      <div style="margin-left:auto;text-align:right;line-height:1.4">
        <div style="font-size:12px;font-weight:800;color:#0f172a">${esc(userName || "ব্যবহারকারী")}</div>
        <div style="font-size:10.5px;color:#64748b">${esc(report.subtitle)}</div>
        <div style="font-size:10px;color:#94a3b8;margin-top:2px">${esc(isoDate())}</div>
      </div>
    </div>
    <div style="margin-top:22px">
      <h1 style="font-size:19px;font-weight:800;color:#0f172a;margin:0 0 4px">${esc(report.title)}</h1>
      <p style="font-size:11px;color:#64748b;margin:0">${esc(report.subtitle)}</p>
    </div>
    ${summaries}
    <table style="width:100%;border-collapse:collapse;background:#fff">
      <thead><tr>${header}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${report.note ? `<div style="margin-top:16px;padding:10px 12px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;font-size:10.5px;color:#92400e;line-height:1.6">${esc(report.note)}</div>` : ""}
    <div style="margin-top:26px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:9.5px;color:#94a3b8">
      <span>হিসাব অ্যাপ থেকে তৈরি করা হয়েছে</span><span>${esc(isoDate())}</span>
    </div>
  </div>`;
}

export async function downloadReportPdf(opts: {
  report: Report;
  userName: string;
  currency: string;
  bengali: boolean;
}): Promise<void> {
  const { report, userName, currency, bengali } = opts;
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const holder = document.createElement("div");
  holder.style.cssText =
    "position:fixed;left:0;top:0;z-index:-9999;width:794px;background:#ffffff";
  holder.innerHTML = reportHtml(report, userName, currency, bengali);
  const page = holder.firstElementChild as HTMLElement;
  document.body.appendChild(holder);

  try {
    // লোগো (SVG) লোড না হলে কিছুক্ষণ অপেক্ষা করি
    await new Promise<void>((resolve) => {
      const img = page.querySelector("img");
      if (!img || img.complete) return resolve();
      img.addEventListener("load", () => resolve(), { once: true });
      img.addEventListener("error", () => resolve(), { once: true });
    });

    const canvas = await html2canvas(page, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      width: 794,
      windowWidth: 794,
    });

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const margin = 10;
    const usableWidth = 210 - margin * 2;
    const usableHeight = 297 - margin * 2;
    const imgHeight = (canvas.height * usableWidth) / canvas.width;
    const data = canvas.toDataURL("image/png");

    let remaining = imgHeight;
    let pageIndex = 0;
    while (remaining > 0) {
      if (pageIndex > 0) pdf.addPage();
      pdf.addImage(data, "PNG", margin, margin - pageIndex * usableHeight, usableWidth, imgHeight);
      remaining -= usableHeight;
      pageIndex += 1;
    }

    pdf.save(`hishab-${report.key}-${isoDate()}.pdf`);
  } finally {
    holder.remove();
  }
}
