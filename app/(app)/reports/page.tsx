"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Download,
  PiggyBank,
  ReceiptText,
  TrendingUp,
} from "lucide-react";
import { MonthSwitcher, PageHeader } from "@/components/app-shell";
import { MonthlyBars } from "@/components/charts";
import { Button, Card, Progress, SectionTitle, Segmented } from "@/components/ui";
import { useData } from "@/lib/data";
import {
  BN_MONTHS_SHORT,
  addMonths,
  currentMonth,
  downloadBlob,
  formatDate,
  formatMoney,
  monthLabel,
  percent,
  todayISO,
  toBengaliDigits,
} from "@/lib/utils";
import { accountStats, categoryStats, inMonth, topExpenses, totals } from "@/lib/stats";
import { csvFileName, transactionsToCsv } from "@/lib/backup";
import { useToast } from "@/components/ui";

type Mode = "month" | "year";

export default function ReportsPage() {
  const { transactions, settings } = useData();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>("month");
  const [month, setMonth] = useState(currentMonth());
  const [year, setYear] = useState(new Date().getFullYear());

  const currency = settings.currency;
  const bengali = settings.bengaliNumerals;

  const periodTx = useMemo(
    () =>
      transactions.filter((t) =>
        mode === "month" ? inMonth(t, month) : t.date.startsWith(String(year)),
      ),
    [transactions, mode, month, year],
  );

  const sums = useMemo(() => totals(periodTx), [periodTx]);
  const expenseCats = useMemo(
    () => categoryStats(periodTx, settings.categories, "expense"),
    [periodTx, settings.categories],
  );
  const incomeCats = useMemo(
    () => categoryStats(periodTx, settings.categories, "income"),
    [periodTx, settings.categories],
  );
  const accounts = useMemo(() => accountStats(periodTx, "expense"), [periodTx]);
  const biggest = useMemo(() => topExpenses(periodTx, 5), [periodTx]);

  const savingsRate = sums.income ? (sums.net / sums.income) * 100 : 0;

  const dailyAvg = useMemo(() => {
    if (mode === "month") {
      const [y, m] = month.split("-").map(Number);
      const now = new Date();
      const isCurrent = currentMonth() === month;
      const days = isCurrent ? now.getDate() : new Date(y, m, 0).getDate();
      return sums.expense / Math.max(1, days);
    }
    return sums.expense / 365;
  }, [mode, month, sums.expense]);

  const series = useMemo(() => {
    if (mode === "year") {
      return Array.from({ length: 12 }, (_, i) => {
        const ym = `${year}-${String(i + 1).padStart(2, "0")}`;
        const t = totals(transactions.filter((x) => inMonth(x, ym)));
        return { label: BN_MONTHS_SHORT[i], income: t.income, expense: t.expense };
      });
    }
    return [-5, -4, -3, -2, -1, 0].map((i) => {
      const ym = addMonths(month, i);
      const t = totals(transactions.filter((x) => inMonth(x, ym)));
      return {
        label: BN_MONTHS_SHORT[Number(ym.slice(5, 7)) - 1],
        income: t.income,
        expense: t.expense,
      };
    });
  }, [mode, month, year, transactions]);

  function exportCsv() {
    if (!periodTx.length) {
      toast("এই সময়ের কোনো লেনদেন নেই", "error");
      return;
    }
    const csv = transactionsToCsv(periodTx, settings);
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), csvFileName());
    toast("CSV ফাইল ডাউনলোড হয়েছে");
  }

  return (
    <div>
      <PageHeader
        title="রিপোর্ট ও বিশ্লেষণ"
        subtitle={mode === "month" ? monthLabel(month, bengali) : `${bengali ? toBengaliDigits(year) : year} সাল`}
        action={
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="size-4" /> CSV
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented
          className="w-full sm:w-[220px]"
          value={mode}
          onChange={setMode}
          options={[
            { value: "month", label: "মাসিক" },
            { value: "year", label: "বাৎসরিক" },
          ]}
        />
        <div className="ml-auto">
          {mode === "month" ? (
            <MonthSwitcher value={month} onChange={setMonth} label={monthLabel(month, bengali)} />
          ) : (
            <div className="flex items-center gap-1 rounded-full border border-line bg-surface p-0.5">
              <button
                onClick={() => setYear((y) => y - 1)}
                className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface-2"
                aria-label="আগের বছর"
              >
                <ArrowDownRight className="size-4 rotate-90" />
              </button>
              <span className="min-w-[72px] text-center text-[12px] font-bold text-ink">
                {bengali ? toBengaliDigits(year) : year}
              </span>
              <button
                onClick={() => setYear((y) => y + 1)}
                className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface-2"
                aria-label="পরের বছর"
              >
                <ArrowUpRight className="size-4 rotate-90" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* মূল সংখ্যা */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Card className="p-3.5">
          <p className="flex items-center gap-1 text-[10.5px] font-semibold text-muted">
            <ArrowUpRight className="size-3.5 text-brand" /> মোট আয়
          </p>
          <p className="tabular mt-1.5 text-[16px] font-extrabold text-brand">
            {formatMoney(sums.income, { currency, bengali })}
          </p>
        </Card>
        <Card className="p-3.5">
          <p className="flex items-center gap-1 text-[10.5px] font-semibold text-muted">
            <ArrowDownRight className="size-3.5 text-danger" /> মোট ব্যয়
          </p>
          <p className="tabular mt-1.5 text-[16px] font-extrabold text-ink">
            {formatMoney(sums.expense, { currency, bengali })}
          </p>
        </Card>
        <Card className="p-3.5">
          <p className="flex items-center gap-1 text-[10.5px] font-semibold text-muted">
            <PiggyBank className="size-3.5 text-brand" /> সঞ্চয়
          </p>
          <p
            className={
              "tabular mt-1.5 text-[16px] font-extrabold " +
              (sums.net >= 0 ? "text-brand" : "text-danger")
            }
          >
            {formatMoney(sums.net, { currency, bengali })}
          </p>
        </Card>
        <Card className="p-3.5">
          <p className="flex items-center gap-1 text-[10.5px] font-semibold text-muted">
            <TrendingUp className="size-3.5 text-brand" /> সঞ্চয়ের হার
          </p>
          <p className="tabular mt-1.5 text-[16px] font-extrabold text-ink">
            {bengali ? toBengaliDigits(Math.round(savingsRate)) : Math.round(savingsRate)}%
          </p>
        </Card>
      </div>

      {mode === "month" && settings.monthlyBudget > 0 ? (
        <Card className="mt-3 p-4">
          <div className="flex items-center justify-between text-[11.5px] font-semibold">
            <span className="text-muted">মাসিক বাজেটের ব্যবহার</span>
            <span className="text-ink">
              {formatMoney(sums.expense, { currency, bengali })} /{" "}
              {formatMoney(settings.monthlyBudget, { currency, bengali })}
            </span>
          </div>
          <Progress
            value={percent(sums.expense, settings.monthlyBudget)}
            color={
              sums.expense > settings.monthlyBudget
                ? "#e5484d"
                : percent(sums.expense, settings.monthlyBudget) > 80
                  ? "#f5a524"
                  : undefined
            }
            className="mt-2 h-2.5"
          />
          <p className="mt-1.5 text-[10.5px] text-muted">
            {sums.expense > settings.monthlyBudget
              ? `বাজেট ছাড়িয়েছে ${formatMoney(sums.expense - settings.monthlyBudget, { currency, bengali })}`
              : `বাজেটের মধ্যে আছেন — বাকি ${formatMoney(settings.monthlyBudget - sums.expense, { currency, bengali })}`}
          </p>
        </Card>
      ) : null}

      <Card className="mt-4 p-4">
        <SectionTitle
          title={mode === "year" ? "মাসভিত্তিক প্রবাহ" : "গত ৬ মাসের প্রবাহ"}
          subtitle={`দৈনিক গড় খরচ ${formatMoney(Math.round(dailyAvg), { currency, bengali })}`}
        />
        <MonthlyBars data={series} bengali={bengali} compact={mode === "year"} />
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <SectionTitle title="খরচের খাত" subtitle="বড় থেকে ছোট" />
          {expenseCats.length ? (
            <div className="space-y-3">
              {expenseCats.map((c) => (
                <div key={c.name}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5 text-[12px] font-semibold text-ink">
                      <span>{c.emoji}</span>
                      <span className="truncate">{c.name}</span>
                      <span className="shrink-0 text-[10px] font-medium text-muted">
                        ({c.count})
                      </span>
                    </span>
                    <span className="tabular shrink-0 text-[11.5px] font-bold text-ink">
                      {formatMoney(c.amount, { currency, bengali })}
                      <span className="ml-1 text-[10px] font-medium text-muted">
                        {bengali ? toBengaliDigits(c.share.toFixed(0)) : c.share.toFixed(0)}%
                      </span>
                    </span>
                  </div>
                  <Progress value={c.share} color={c.color} className="mt-1.5 h-1.5" />
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-[12px] text-muted">কোনো খরচ নেই।</p>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <SectionTitle title="আয়ের উৎস" />
            {incomeCats.length ? (
              <div className="space-y-2.5">
                {incomeCats.map((c) => (
                  <div key={c.name} className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5 text-[12px] font-semibold text-ink">
                      <span>{c.emoji}</span>
                      <span className="truncate">{c.name}</span>
                    </span>
                    <span className="tabular text-[11.5px] font-bold text-brand">
                      {formatMoney(c.amount, { currency, bengali })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-[12px] text-muted">কোনো আয় নেই।</p>
            )}
          </Card>

          <Card className="p-4">
            <SectionTitle title="অ্যাকাউন্টভিত্তিক খরচ" />
            {accounts.length ? (
              <div className="space-y-2.5">
                {accounts.map((a) => (
                  <div key={a.name}>
                    <div className="flex items-center justify-between text-[12px] font-semibold">
                      <span className="text-ink">{a.name}</span>
                      <span className="tabular text-[11.5px] text-muted">
                        {formatMoney(a.amount, { currency, bengali })}
                      </span>
                    </div>
                    <Progress value={a.share} className="mt-1 h-1.5" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-[12px] text-muted">কোনো তথ্য নেই।</p>
            )}
          </Card>
        </div>
      </div>

      <Card className="mt-4 p-4">
        <SectionTitle title="সবচেয়ে বড় খরচগুলো" />
        {biggest.length ? (
          <div className="divide-y divide-line">
            {biggest.map((t, i) => {
              const cat = settings.categories.find((c) => c.name === t.category);
              return (
                <div key={t.id} className="flex items-center gap-3 py-2.5">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-[11px] font-bold text-muted">
                    {bengali ? toBengaliDigits(i + 1) : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-semibold text-ink">
                      {cat?.emoji} {t.category}
                    </p>
                    <p className="truncate text-[10.5px] text-muted">
                      {formatDate(t.date, bengali, true)}
                      {t.note ? ` · ${t.note}` : ""}
                    </p>
                  </div>
                  <span className="tabular text-[12.5px] font-bold text-ink">
                    {formatMoney(t.amount, { currency, bengali })}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="py-6 text-center text-[12px] text-muted">কোনো খরচ নেই।</p>
        )}
      </Card>

      <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-[10.5px] text-muted">
        <ReceiptText className="size-3" /> রিপোর্ট তৈরি হয়েছে {formatDate(todayISO(), bengali, true)} তারিখে
      </p>
    </div>
  );
}
