"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronRight,
  HandCoins,
  Plus,
  ReceiptText,
  Repeat,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { MonthSwitcher, useQuickAdd } from "@/components/app-shell";
import { TransactionRow } from "@/components/transaction-row";
import { MonthlyBars, Donut } from "@/components/charts";
import { Card, SectionTitle, useToast } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useData } from "@/lib/data";
import {
  BN_MONTHS_SHORT,
  addMonths,
  currentMonth,
  formatMoney,
  monthLabel,
  percent,
} from "@/lib/utils";
import { categoryStats, debtSummary, inMonth, totals } from "@/lib/stats";

export default function DashboardPage() {
  const { user } = useAuth();
  const { transactions, templates, debts, settings, useTemplate } = useData();
  const openForm = useQuickAdd();
  const toast = useToast();
  const [month, setMonth] = useState(currentMonth());
  const [addingId, setAddingId] = useState<string | null>(null);

  const bengali = settings.bengaliNumerals;
  const currency = settings.currency;

  const monthTx = useMemo(
    () => transactions.filter((t) => inMonth(t, month)),
    [transactions, month],
  );
  const { income, expense, net } = useMemo(() => totals(monthTx), [monthTx]);
  const prevTotals = useMemo(
    () => totals(transactions.filter((t) => inMonth(t, addMonths(month, -1)))),
    [transactions, month],
  );

  const cats = useMemo(
    () => categoryStats(monthTx, settings.categories, "expense"),
    [monthTx, settings.categories],
  );
  const donutSegments = useMemo(() => {
    const top = cats.slice(0, 4).map((c) => ({
      label: c.name,
      value: c.amount,
      color: c.color,
    }));
    const rest = cats.slice(4).reduce((a, c) => a + c.amount, 0);
    if (rest > 0) top.push({ label: "অন্যান্য", value: rest, color: "#94a3b8" });
    return top;
  }, [cats]);

  const series = useMemo(
    () =>
      [-5, -4, -3, -2, -1, 0].map((i) => {
        const ym = addMonths(month, i);
        const t = totals(transactions.filter((x) => inMonth(x, ym)));
        return {
          label: BN_MONTHS_SHORT[Number(ym.slice(5, 7)) - 1],
          income: t.income,
          expense: t.expense,
        };
      }),
    [transactions, month],
  );

  const quick = useMemo(
    () =>
      [...templates]
        .sort((a, b) => (b.lastUsed || b.createdAt) - (a.lastUsed || a.createdAt))
        .slice(0, 8),
    [templates],
  );

  const recent = useMemo(
    () =>
      [...transactions]
        .sort((a, b) =>
          a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1,
        )
        .slice(0, 6),
    [transactions],
  );

  const debt = useMemo(() => debtSummary(debts), [debts]);

  const budget = settings.monthlyBudget;
  const budgetPct = percent(expense, budget);
  const remaining = budget - expense;
  const expenseUp = prevTotals.expense > 0 ? expense >= prevTotals.expense : false;
  const todayExpense = monthTx
    .filter((t) => t.date === new Date().toISOString().slice(0, 10) && t.type === "expense")
    .reduce((a, t) => a + t.amount, 0);

  async function addFromTemplate(id: string, name: string, amount: number) {
    setAddingId(id);
    try {
      await useTemplate(id);
      toast(`যোগ হয়েছে: ${name} · ${formatMoney(amount, { currency, bengali })}`);
    } catch (err) {
      toast((err as Error).message || "যোগ করা যায়নি", "error");
    } finally {
      setAddingId(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            স্বাগতম
          </p>
          <h1 className="mt-0.5 text-[22px] font-extrabold leading-tight tracking-tight text-ink">
            হ্যালো, {(user?.name || "বন্ধু").split(" ")[0]} 👋
          </h1>
        </div>
        <MonthSwitcher
          value={month}
          onChange={setMonth}
          label={monthLabel(month, bengali)}
        />
      </div>

      {/* ব্যালেন্স কার্ড */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 p-5 text-white shadow-lg shadow-brand-900/15">
        <div className="pointer-events-none absolute -right-12 -top-16 size-52 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-12 size-48 rounded-full bg-brand-300/25 blur-3xl" />

        <div className="relative">
          <div className="flex items-center justify-between">
            <p className="text-[11.5px] font-semibold tracking-wide text-white/70">
              এই মাসের ব্যালেন্স
            </p>
            <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[10.5px] font-semibold text-white/90 backdrop-blur">
              {monthLabel(month, bengali)}
            </span>
          </div>

          <div className="mt-2 flex items-end gap-2">
            <p className="tabular text-[34px] font-extrabold leading-none tracking-tight">
              {formatMoney(net, { currency, bengali })}
            </p>
            <span className="mb-1 text-[11px] font-medium text-white/60">
              {net >= 0 ? "উদ্বৃত্ত" : "ঘাটতি"}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl bg-white/10 px-3 py-2.5 backdrop-blur-sm">
              <p className="flex items-center gap-1 text-[10.5px] font-semibold text-white/70">
                <TrendingUp className="size-3" /> আয়
              </p>
              <p className="tabular mt-0.5 text-[15px] font-bold">
                {formatMoney(income, { currency, bengali })}
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 px-3 py-2.5 backdrop-blur-sm">
              <p className="flex items-center gap-1 text-[10.5px] font-semibold text-white/70">
                <TrendingDown className="size-3" /> ব্যয়
              </p>
              <p className="tabular mt-0.5 text-[15px] font-bold">
                {formatMoney(expense, { currency, bengali })}
              </p>
            </div>
          </div>

          {budget > 0 ? (
            <div className="mt-4">
              <div className="flex items-center justify-between text-[10.5px] font-medium text-white/70">
                <span>মাসিক বাজেট {formatMoney(budget, { currency, bengali })}</span>
                <span>
                  {remaining >= 0
                    ? `বাকি ${formatMoney(remaining, { currency, bengali })}`
                    : `${formatMoney(-remaining, { currency, bengali })} বেশি`}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                <div
                  className={
                    "h-full rounded-full transition-all duration-500 " +
                    (budgetPct >= 100
                      ? "bg-red-300"
                      : budgetPct >= 80
                        ? "bg-amber-300"
                        : "bg-white")
                  }
                  style={{ width: `${Math.min(100, budgetPct)}%` }}
                />
              </div>
            </div>
          ) : (
            <button
              onClick={() => openForm({ preset: { type: "expense" } })}
              className="mt-4 flex w-full items-center justify-between rounded-xl bg-white/10 px-3 py-2 text-[11px] font-semibold text-white/85 backdrop-blur-sm transition hover:bg-white/15"
            >
              আজকের খরচ {formatMoney(todayExpense, { currency, bengali })} · বাজেট সেট করুন
              <ChevronRight className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* দেনা-পাওনা */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Link
          href="/contacts"
          className="rounded-2xl border border-line bg-surface p-3.5 shadow-card transition hover:border-brand/30"
        >
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
            <HandCoins className="size-3.5 text-brand" /> আমার পাওনা
          </p>
          <p className="tabular mt-1.5 text-[17px] font-extrabold text-brand">
            {formatMoney(debt.receivable, { currency, bengali })}
          </p>
          <p className="mt-0.5 text-[10.5px] text-muted">
            {debt.receivableCount} জনের কাছে
          </p>
        </Link>
        <Link
          href="/contacts"
          className="rounded-2xl border border-line bg-surface p-3.5 shadow-card transition hover:border-danger/30"
        >
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
            <Wallet className="size-3.5 text-danger" /> আমার দেনা
          </p>
          <p className="tabular mt-1.5 text-[17px] font-extrabold text-danger">
            {formatMoney(debt.payable, { currency, bengali })}
          </p>
          <p className="mt-0.5 text-[10.5px] text-muted">
            {debt.payableCount} জনকে দিতে হবে
          </p>
        </Link>
      </div>

      {/* নিয়মিত কেনাকাটা */}
      <section className="mt-6">
        <SectionTitle
          title="নিয়মিত কেনাকাটা"
          subtitle="এক ট্যাপেই লেনদেন যোগ করুন"
          action={
            <Link
              href="/templates"
              className="flex items-center gap-1 text-[11.5px] font-bold text-brand hover:underline"
            >
              সব দেখুন <ArrowRight className="size-3" />
            </Link>
          }
        />
        {quick.length ? (
          <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {quick.map((t) => (
              <button
                key={t.id}
                onClick={() => addFromTemplate(t.id, t.name, t.amount)}
                disabled={addingId === t.id}
                className="group w-[128px] shrink-0 rounded-2xl border border-line bg-surface p-3 text-left shadow-card transition hover:border-brand/40 active:scale-[.98] disabled:opacity-60"
              >
                <div className="flex items-start justify-between">
                  <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-[17px]">
                    {t.emoji}
                  </span>
                  <span className="grid size-6 place-items-center rounded-full bg-brand text-white">
                    <Plus className="size-3.5" />
                  </span>
                </div>
                <p className="mt-2 truncate text-[12px] font-bold text-ink">{t.name}</p>
                <p className="tabular text-[11px] font-medium text-muted">
                  {formatMoney(t.amount, { currency, bengali })}
                </p>
              </button>
            ))}
            <Link
              href="/templates"
              className="flex w-[112px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line bg-surface-2/50 p-3 text-muted transition hover:border-brand/40 hover:text-brand"
            >
              <Repeat className="size-5" />
              <span className="text-[11px] font-semibold">নতুন সেভ</span>
            </Link>
          </div>
        ) : (
          <Card className="flex items-center gap-3 p-3.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
              <Repeat className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-bold text-ink">এখনো নিয়মিত কিছু সেভ করা হয়নি</p>
              <p className="text-[11px] text-muted">
                প্রতিদিনের চা, রিকশা বা বাজার — একবার সেভ করে রাখুন।
              </p>
            </div>
            <Link
              href="/templates"
              className="shrink-0 rounded-xl bg-brand px-3 py-1.5 text-[11px] font-bold text-white"
            >
              সেভ করুন
            </Link>
          </Card>
        )}
      </section>

      {/* চার্ট */}
      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        <Card className="p-4">
          <SectionTitle
            title="গত ৬ মাসের প্রবাহ"
            action={
              <span className="text-[10.5px] font-semibold text-muted">
                {expenseUp ? "ব্যয় বাড়ছে" : "ব্যয় কমছে"}
              </span>
            }
          />
          <MonthlyBars data={series} bengali={bengali} />
        </Card>

        <Card className="p-4">
          <SectionTitle title="খরচের খাত" subtitle="এই মাসে কোথায় বেশি খরচ" />
          {donutSegments.length ? (
            <div className="flex items-center gap-3">
              <Donut
                segments={donutSegments}
                size={132}
                thickness={14}
                centerLabel="মোট ব্যয়"
                centerValue={formatMoney(expense, { currency, bengali, compact: true })}
              />
              <div className="min-w-0 flex-1 space-y-1.5">
                {donutSegments.slice(0, 4).map((s) => (
                  <div key={s.label} className="flex items-center gap-2">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-ink">
                      {s.label}
                    </span>
                    <span className="tabular text-[11px] font-semibold text-muted">
                      {formatMoney(s.value, { currency, bengali, compact: true })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="py-10 text-center text-[12px] text-muted">
              এই মাসে এখনো কোনো খরচ যোগ করা হয়নি।
            </p>
          )}
        </Card>
      </div>

      {/* সাম্প্রতিক লেনদেন */}
      <section className="mt-6">
        <SectionTitle
          title="সাম্প্রতিক লেনদেন"
          action={
            <Link
              href="/transactions"
              className="flex items-center gap-1 text-[11.5px] font-bold text-brand hover:underline"
            >
              সব দেখুন <ArrowRight className="size-3" />
            </Link>
          }
        />
        <Card className="overflow-hidden">
          {recent.length ? (
            <div className="divide-y divide-line">
              {recent.map((t) => (
                <TransactionRow
                  key={t.id}
                  tx={t}
                  category={settings.categories.find((c) => c.name === t.category)}
                  currency={currency}
                  bengali={bengali}
                  showDate
                  onClick={() => openForm({ editing: t })}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-surface-2 text-muted">
                <ReceiptText className="size-5" />
              </span>
              <p className="text-[13px] font-bold text-ink">এখনো কোনো লেনদেন নেই</p>
              <p className="text-[11.5px] text-muted">
                প্রথম খরচ বা আয় যোগ করে হিসাব শুরু করুন।
              </p>
              <button
                onClick={() => openForm()}
                className="mt-1 rounded-xl bg-brand px-4 py-2 text-[12px] font-bold text-white"
              >
                লেনদেন যোগ করুন
              </button>
            </div>
          )}
        </Card>
      </section>

      {!budget ? (
        <p className="mt-6 text-center text-[11px] text-muted">
          টিপস: সেটিংস থেকে মাসিক বাজেট সেট করলে খরচ নিয়ন্ত্রণ সহজ হবে।
        </p>
      ) : null}
    </div>
  );
}
