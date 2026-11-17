"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, ReceiptText, Search, SlidersHorizontal, X } from "lucide-react";
import { MonthSwitcher, PageHeader, useQuickAdd } from "@/components/app-shell";
import { TransactionRow } from "@/components/transaction-row";
import { Button, Card, Chip, EmptyState, Input, Segmented } from "@/components/ui";
import { useData } from "@/lib/data";
import type { Transaction, TxType } from "@/lib/types";
import {
  currentMonth,
  formatMoney,
  monthLabel,
  weekdayOf,
  formatDate,
  digits,
} from "@/lib/utils";
import { totals } from "@/lib/stats";

type TypeFilter = "all" | TxType;

export default function TransactionsPage() {
  const { transactions, settings } = useData();
  const openForm = useQuickAdd();
  const [month, setMonth] = useState<string>(currentMonth());
  const [type, setType] = useState<TypeFilter>("all");

  // ইম্পোর্টের পর ?month=all দিয়ে এলে পুরোনো সব মাসের ডেটা দেখা যায়
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("month");
    if (requested) setMonth(requested);
  }, []);

  const [q, setQ] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const bengali = settings.bengaliNumerals;
  const currency = settings.currency;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return transactions
      .filter((t) => (month === "all" ? true : t.date.startsWith(month)))
      .filter((t) => (type === "all" ? true : t.type === type))
      .filter((t) =>
        needle
          ? [t.category, t.note, t.account, String(t.amount)]
              .join(" ")
              .toLowerCase()
              .includes(needle)
          : true,
      )
      .sort((a, b) =>
        a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1,
      );
  }, [transactions, month, type, q]);

  const grouped = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of filtered) {
      const arr = map.get(t.date) || [];
      arr.push(t);
      map.set(t.date, arr);
    }
    return [...map.entries()];
  }, [filtered]);

  const sums = useMemo(() => totals(filtered), [filtered]);

  return (
    <div>
      <PageHeader
        title="সব লেনদেন"
        subtitle={`${digits(filtered.length, bengali)}টি লেনদেন পাওয়া গেছে`}
        action={
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowSearch((s) => !s)}
              className="grid size-10 place-items-center rounded-xl border border-line bg-surface text-muted lg:hidden"
              aria-label="খুঁজুন"
            >
              <Search className="size-4" />
            </button>
            <Button onClick={() => openForm()} className="hidden lg:inline-flex">
              <Plus className="size-4" /> নতুন
            </Button>
          </div>
        }
      />

      {/* সারসংক্ষেপ */}
      <div className="mb-4 grid grid-cols-3 gap-2.5">
        <Card className="p-3">
          <p className="text-[10.5px] font-semibold text-muted">আয়</p>
          <p className="tabular mt-1 text-[13.5px] font-extrabold text-brand">
            {formatMoney(sums.income, { currency, bengali, compact: true })}
          </p>
        </Card>
        <Card className="p-3">
          <p className="text-[10.5px] font-semibold text-muted">ব্যয়</p>
          <p className="tabular mt-1 text-[13.5px] font-extrabold text-danger">
            {formatMoney(sums.expense, { currency, bengali, compact: true })}
          </p>
        </Card>
        <Card className="p-3">
          <p className="text-[10.5px] font-semibold text-muted">ব্যালেন্স</p>
          <p
            className={
              "tabular mt-1 text-[13.5px] font-extrabold " +
              (sums.net >= 0 ? "text-ink" : "text-danger")
            }
          >
            {formatMoney(sums.net, { currency, bengali, compact: true })}
          </p>
        </Card>
      </div>

      {/* ফিল্টার */}
      <div className="mb-4 space-y-2.5">
        <div className={showSearch ? "block" : "hidden lg:block"}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="খাত, নোট বা টাকা দিয়ে খুঁজুন…"
              className="pl-9 pr-9"
            />
            {q ? (
              <button
                onClick={() => setQ("")}
                aria-label="মুছুন"
                className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-surface-2"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            className="w-full sm:w-auto"
            value={type}
            onChange={setType}
            options={[
              { value: "all", label: "সব" },
              { value: "expense", label: "খরচ" },
              { value: "income", label: "আয়" },
            ]}
          />
          <div className="ml-auto flex items-center gap-2">
            <Chip active={month === "all"} onClick={() => setMonth("all")}>
              <SlidersHorizontal className="size-3" /> সব সময়
            </Chip>
            {month !== "all" ? (
              <MonthSwitcher
                value={month}
                onChange={setMonth}
                label={monthLabel(month, bengali)}
              />
            ) : (
              <button
                onClick={() => setMonth(currentMonth())}
                className="rounded-full border border-line bg-surface px-3 py-1.5 text-[11.5px] font-semibold text-muted hover:text-ink"
              >
                মাস বেছে নিন
              </button>
            )}
          </div>
        </div>
      </div>

      {/* তালিকা */}
      {grouped.length ? (
        <div className="space-y-4">
          {grouped.map(([date, rows]) => {
            const day = totals(rows);
            return (
              <div key={date}>
                <div className="mb-1.5 flex items-center justify-between px-1">
                  <p className="text-[11.5px] font-bold text-ink">
                    {formatDate(date, bengali)}{" "}
                    <span className="font-medium text-muted">· {weekdayOf(date)}</span>
                  </p>
                  <p className="tabular text-[10.5px] font-semibold text-muted">
                    {day.expense > 0
                      ? `−${formatMoney(day.expense, { currency, bengali })}`
                      : `+${formatMoney(day.income, { currency, bengali })}`}
                  </p>
                </div>
                <Card className="overflow-hidden">
                  <div className="divide-y divide-line">
                    {rows.map((t) => (
                      <TransactionRow
                        key={t.id}
                        tx={t}
                        category={settings.categories.find((c) => c.name === t.category)}
                        currency={currency}
                        bengali={bengali}
                        onClick={() => openForm({ editing: t })}
                      />
                    ))}
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={ReceiptText}
            title="কোনো লেনদেন পাওয়া যায়নি"
            message={
              q
                ? "অন্য কিছু লিখে খুঁজে দেখুন অথবা ফিল্টার বদলান।"
                : "এই সময়ের জন্য কোনো লেনদেন নেই। নতুন একটি যোগ করুন।"
            }
            action={
              <Button size="sm" onClick={() => openForm()}>
                <Plus className="size-4" /> লেনদেন যোগ করুন
              </Button>
            }
          />
        </Card>
      )}
    </div>
  );
}
