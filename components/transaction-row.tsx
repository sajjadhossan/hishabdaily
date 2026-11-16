"use client";

import type { Category, Transaction } from "@/lib/types";
import { cn, formatDate, formatMoney } from "@/lib/utils";

export function TransactionRow({
  tx,
  category,
  currency,
  bengali,
  showDate,
  onClick,
}: {
  tx: Transaction;
  category?: Category;
  currency: string;
  bengali?: boolean;
  showDate?: boolean;
  onClick?: () => void;
}) {
  const income = tx.type === "income";
  const color = category?.color || "#64748b";

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-surface-2/70 active:bg-surface-2"
    >
      <span
        className="grid size-10 shrink-0 place-items-center rounded-xl text-[17px]"
        style={{ backgroundColor: `${color}22` }}
      >
        {category?.emoji || (income ? "💰" : "📦")}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-semibold leading-tight text-ink">
          {tx.category}
        </p>
        <p className="mt-0.5 truncate text-[11.5px] text-muted">
          {tx.note || (showDate ? formatDate(tx.date, bengali) : tx.account)}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p
          className={cn(
            "tabular text-[13.5px] font-bold leading-tight",
            income ? "text-brand" : "text-ink",
          )}
        >
          {income ? "+" : "−"}
          {formatMoney(tx.amount, { currency, bengali })}
        </p>
        <p className="mt-0.5 text-[10.5px] text-muted">
          {showDate ? formatDate(tx.date, bengali) : tx.account}
        </p>
      </div>
    </button>
  );
}
