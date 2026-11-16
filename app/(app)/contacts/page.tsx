"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, ChevronRight, HandCoins, Plus, Search, Users } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { ContactFormModal } from "@/components/contact-form";
import { Card, EmptyState, Input } from "@/components/ui";
import { useData } from "@/lib/data";
import { contactBalances, debtSummary } from "@/lib/stats";
import { cn, formatMoney } from "@/lib/utils";

export default function ContactsPage() {
  const { contacts, debts, settings } = useData();
  const [q, setQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const bengali = settings.bengaliNumerals;
  const currency = settings.currency;

  const summary = useMemo(() => debtSummary(debts), [debts]);
  const balances = useMemo(() => contactBalances(debts), [debts]);
  const balanceMap = useMemo(
    () => new Map(balances.map((b) => [b.contactId, b])),
    [balances],
  );

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...contacts]
      .filter((c) =>
        needle ? (c.name + c.phone + c.note).toLowerCase().includes(needle) : true,
      )
      .sort((a, b) => {
        const an = Math.abs(balanceMap.get(a.id)?.net || 0);
        const bn = Math.abs(balanceMap.get(b.id)?.net || 0);
        if (an !== bn) return bn - an;
        return a.name.localeCompare(b.name, "bn");
      });
  }, [contacts, q, balanceMap]);

  return (
    <div>
      <PageHeader
        title="দেনা-পাওনা"
        subtitle="কার কাছে কত পাবেন, কাকে কত দিতে হবে"
        action={
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-brand px-3.5 text-[12.5px] font-bold text-white shadow-sm"
          >
            <Plus className="size-4" /> নতুন
          </button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3">
        <Card className="relative overflow-hidden p-4">
          <div className="absolute -right-6 -top-6 size-20 rounded-full bg-brand/10" />
          <p className="relative flex items-center gap-1.5 text-[11px] font-semibold text-muted">
            <ArrowUpRight className="size-3.5 text-brand" /> মোট পাওনা
          </p>
          <p className="tabular relative mt-1.5 text-[20px] font-extrabold text-brand">
            {formatMoney(summary.receivable, { currency, bengali })}
          </p>
          <p className="relative mt-0.5 text-[10.5px] text-muted">
            {summary.receivableCount} জনের কাছে
          </p>
        </Card>
        <Card className="relative overflow-hidden p-4">
          <div className="absolute -right-6 -top-6 size-20 rounded-full bg-danger/10" />
          <p className="relative flex items-center gap-1.5 text-[11px] font-semibold text-muted">
            <ArrowDownLeft className="size-3.5 text-danger" /> মোট দেনা
          </p>
          <p className="tabular relative mt-1.5 text-[20px] font-extrabold text-danger">
            {formatMoney(summary.payable, { currency, bengali })}
          </p>
          <p className="relative mt-0.5 text-[10.5px] text-muted">
            {summary.payableCount} জনকে দিতে হবে
          </p>
        </Card>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="নাম বা নম্বর দিয়ে খুঁজুন…"
          className="pl-9"
        />
      </div>

      {list.length ? (
        <Card className="overflow-hidden">
          <div className="divide-y divide-line">
            {list.map((c) => {
              const bal = balanceMap.get(c.id);
              const net = bal?.net || 0;
              return (
                <Link
                  key={c.id}
                  href={`/contacts/${c.id}`}
                  className="flex items-center gap-3 px-3.5 py-3 transition hover:bg-surface-2/60"
                >
                  <span
                    className={cn(
                      "grid size-10 shrink-0 place-items-center rounded-full text-[15px] font-bold text-white",
                      net > 0
                        ? "bg-gradient-to-br from-brand-400 to-brand-600"
                        : net < 0
                          ? "bg-gradient-to-br from-rose-400 to-rose-600"
                          : "bg-gradient-to-br from-slate-400 to-slate-600",
                    )}
                  >
                    {c.name.trim().charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-bold text-ink">{c.name}</p>
                    <p className="truncate text-[11px] text-muted">
                      {c.phone || c.note || "কোনো বিবরণ নেই"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {net === 0 ? (
                      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] font-bold text-muted">
                        সমতা
                      </span>
                    ) : (
                      <>
                        <p
                          className={cn(
                            "tabular text-[13px] font-bold",
                            net > 0 ? "text-brand" : "text-danger",
                          )}
                        >
                          {formatMoney(Math.abs(net), { currency, bengali })}
                        </p>
                        <p className="text-[10px] font-medium text-muted">
                          {net > 0 ? "পাওনা" : "দেনা"}
                        </p>
                      </>
                    )}
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted/60" />
                </Link>
              );
            })}
          </div>
        </Card>
      ) : (
        <Card>
          <EmptyState
            icon={q ? Search : Users}
            title={q ? "কাউকে পাওয়া যায়নি" : "এখনো কোনো ব্যক্তি যোগ করা হয়নি"}
            message="যার সাথে টাকা লেনদেন আছে তাকে যোগ করুন — কে কত পাবেন বা দেবেন সহজে মনে থাকবে।"
            action={
              <button
                onClick={() => setAddOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-[12px] font-bold text-white"
              >
                <Plus className="size-4" /> ব্যক্তি যোগ করুন
              </button>
            }
          />
        </Card>
      )}

      <div className="mt-4 flex items-start gap-2 rounded-2xl border border-line bg-surface-2/50 px-3.5 py-3 text-[11px] leading-relaxed text-muted">
        <HandCoins className="mt-0.5 size-3.5 shrink-0" />
        টাকা দেওয়া, নেওয়া, ফেরত পাওয়া — সব এন্ট্রি আলাদা করে রাখা হয়, তাই কার কাছে কত
        বাকি তা সবসময় স্পষ্ট থাকে।
      </div>

      <ContactFormModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
