"use client";

import { useMemo, useState } from "react";
import {
  FileSpreadsheet,
  FileText,
  Layers,
  Loader2,
  Table2,
} from "lucide-react";
import { Button, Card, Segmented, useToast } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useData } from "@/lib/data";
import { downloadAllReportsExcel, downloadReportExcel } from "@/lib/excel";
import {
  ALL_TIME_REPORTS,
  REPORT_LIST,
  buildReport,
  formatCell,
  newPeriod,
  periodLabel,
  type Period,
  type PeriodMode,
  type ReportKey,
} from "@/lib/reports";
import { downloadReportPdf } from "@/lib/report-pdf";
import type { AppData } from "@/lib/types";

/** সেটিংস পেজের পাশাপাশি রিপোর্ট পেজে বসানো যায় এমন সম্পূর্ণ রিপোর্ট বিল্ডার */
export function ReportBuilder() {
  const data = useData();
  const { user } = useAuth();
  const toast = useToast();
  const [reportKey, setReportKey] = useState<ReportKey>("overview");
  const [period, setPeriod] = useState<Period>(newPeriod);
  const [pdfBusy, setPdfBusy] = useState(false);

  const { transactions, templates, contacts, debts, folders, trash, settings } = data;
  const appData: AppData = useMemo(
    () => ({ transactions, templates, contacts, debts, folders, trash, settings }),
    [transactions, templates, contacts, debts, folders, trash, settings],
  );

  const currency = settings.currency;
  const bengali = settings.bengaliNumerals;
  const userName = user?.name || "ব্যবহারকারী";
  const showPeriod = !ALL_TIME_REPORTS.includes(reportKey);

  const report = useMemo(() => {
    const effective: Period = showPeriod ? period : { mode: "all" };
    return buildReport(reportKey, appData, effective, currency, bengali, userName);
  }, [reportKey, appData, period, showPeriod, currency, bengali, userName]);

  const allReports = useMemo(
    () =>
      REPORT_LIST.map((r) => {
        const effective: Period = ALL_TIME_REPORTS.includes(r.key) ? { mode: "all" } : period;
        return buildReport(r.key, appData, effective, currency, bengali, userName);
      }),
    [appData, period, currency, bengali, userName],
  );

  function handleExcel() {
    if (!report.rows.length) {
      toast("এই রিপোর্টে কোনো তথ্য নেই", "error");
      return;
    }
    downloadReportExcel(report);
    toast("Excel ফাইল ডাউনলোড হয়েছে");
  }

  function handleAllExcel() {
    downloadAllReportsExcel(allReports);
    toast("সব রিপোর্ট একটি Excel ফাইলে ডাউনলোড হয়েছে");
  }

  async function handlePdf() {
    if (!report.rows.length) {
      toast("এই রিপোর্টে কোনো তথ্য নেই", "error");
      return;
    }
    setPdfBusy(true);
    try {
      await downloadReportPdf({ report, userName, currency, bengali });
      toast("PDF ফাইল ডাউনলোড হয়েছে");
    } catch (err) {
      console.warn("pdf export failed", err);
      toast("PDF তৈরি করা যায়নি — আবার চেষ্টা করুন", "error");
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <div>
      {/* রিপোর্ট বাছাই */}
      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <Table2 className="size-4 text-brand" />
          <div>
            <p className="text-[13px] font-bold text-ink">কোন রিপোর্ট দেখবেন?</p>
            <p className="text-[10.5px] text-muted">পছন্দ করুন, তারপর নিচে ফাইল বের করুন</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {REPORT_LIST.map((item) => {
            const active = reportKey === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setReportKey(item.key)}
                className={
                  "flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2 text-center transition " +
                  (active
                    ? "border-brand bg-brand-soft text-brand-700 dark:text-brand-300"
                    : "border-line bg-surface text-muted hover:bg-surface-2 hover:text-ink")
                }
              >
                <span className="text-[17px] leading-none">{item.emoji}</span>
                <span className="text-[10.5px] font-bold leading-tight">{item.label}</span>
              </button>
            );
          })}
        </div>

        {showPeriod ? (
          <div className="mt-4 space-y-2.5 border-t border-line pt-4">
            <Segmented<PeriodMode>
              value={period.mode}
              onChange={(mode) => setPeriod((p) => ({ ...p, mode }))}
              options={[
                { value: "all", label: "সব সময়" },
                { value: "year", label: "বছর" },
                { value: "month", label: "মাস" },
                { value: "day", label: "দিন" },
              ]}
            />
            {period.mode === "year" ? (
              <input
                type="number"
                min={2000}
                max={2100}
                value={period.year ?? new Date().getFullYear()}
                onChange={(e) =>
                  setPeriod((p) => ({ ...p, year: Number(e.target.value) || new Date().getFullYear() }))
                }
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-brand"
                aria-label="বছর"
              />
            ) : null}
            {period.mode === "month" ? (
              <input
                type="month"
                value={period.month ?? ""}
                onChange={(e) => setPeriod((p) => ({ ...p, month: e.target.value }))}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-brand"
                aria-label="মাস"
              />
            ) : null}
            {period.mode === "day" ? (
              <input
                type="date"
                value={period.day ?? ""}
                onChange={(e) => setPeriod((p) => ({ ...p, day: e.target.value }))}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-brand"
                aria-label="দিন"
              />
            ) : null}
          </div>
        ) : null}
      </Card>

      {/* রিপোর্ট */}
      <Card className="mt-4 overflow-hidden">
        <div className="border-b border-line bg-surface-2/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[15px] font-extrabold text-ink">{report.title}</p>
              <p className="mt-0.5 text-[11px] text-muted">
                {userName} · {periodLabel(showPeriod ? period : { mode: "all" }, bengali)}
              </p>
            </div>
            <span className="rounded-full bg-brand-soft px-2.5 py-1 text-[10px] font-bold text-brand">
              {bengali ? formatCell(report.rows.length, "number", currency, bengali) : report.rows.length} সারি
            </span>
          </div>

          {report.summaries.length ? (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {report.summaries.map((s) => (
                <div key={s.label} className="rounded-xl border border-line bg-surface px-3 py-2.5">
                  <p className="text-[10px] font-semibold text-muted">{s.label}</p>
                  <p className="tabular mt-1 text-[12.5px] font-extrabold text-ink">{s.value}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-[11.5px]">
            <thead>
              <tr className="border-b border-line bg-surface-2/60">
                {report.columns.map((c) => (
                  <th
                    key={c.key}
                    className={
                      "whitespace-nowrap px-3 py-2.5 font-bold text-muted " +
                      (c.format && c.format !== "text" ? "text-right" : "text-left")
                    }
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.rows.length ? (
                report.rows.map((row) => (
                  <tr
                    key={`${report.key}-${report.columns.map((c) => String(row[c.key] ?? "")).join("|")}`}
                    className="border-b border-line/60 last:border-0"
                  >
                    {report.columns.map((c) => (
                      <td
                        key={c.key}
                        className={
                          "tabular whitespace-nowrap px-3 py-2.5 " +
                          (c.format === "money" ? "font-bold text-ink" : "text-muted") +
                          " " +
                          (c.format && c.format !== "text" ? "text-right" : "text-left")
                        }
                      >
                        {formatCell(row[c.key] ?? "", c.format, currency, bengali)}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={report.columns.length} className="py-10 text-center text-muted">
                    এই রিপোর্টে কোনো তথ্য নেই।
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {report.note ? (
          <p className="border-t border-line bg-amber-50/60 px-4 py-3 text-[10.5px] leading-relaxed text-amber-700 dark:bg-amber-500/5 dark:text-amber-400">
            {report.note}
          </p>
        ) : null}
      </Card>

      {/* এক্সপোর্ট */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" onClick={handleExcel}>
          <FileSpreadsheet className="size-4" /> Excel
        </Button>
        <Button variant="outline" onClick={handleAllExcel}>
          <Layers className="size-4" /> সব রিপোর্ট (Excel)
        </Button>
        <Button variant="outline" onClick={() => void handlePdf()} disabled={pdfBusy}>
          {pdfBusy ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
          PDF (লোগোসহ)
        </Button>
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-muted">
        Excel ফাইলটি Excel বা LibreOffice-এ খোলে। PDF-এ ওপরে হিসাবের লোগো, আপনার নাম ও সব বিবরণ থাকবে।
      </p>
    </div>
  );
}
