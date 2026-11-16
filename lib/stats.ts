import type { Category, Debt, Transaction } from "./types";
import { monthKey } from "./utils";

export function inMonth(t: Transaction, ym: string): boolean {
  return monthKey(t.date) === ym;
}

export function totals(txs: Transaction[]): { income: number; expense: number; net: number } {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (t.type === "income") income += Number(t.amount) || 0;
    else expense += Number(t.amount) || 0;
  }
  return { income, expense, net: income - expense };
}

export interface CategoryStat {
  name: string;
  emoji: string;
  color: string;
  amount: number;
  count: number;
  share: number;
}

export function categoryStats(
  txs: Transaction[],
  categories: Category[],
  type: "expense" | "income",
): CategoryStat[] {
  const map = new Map<string, { amount: number; count: number }>();
  for (const t of txs) {
    if (t.type !== type) continue;
    const prev = map.get(t.category) || { amount: 0, count: 0 };
    prev.amount += Number(t.amount) || 0;
    prev.count += 1;
    map.set(t.category, prev);
  }
  const total = [...map.values()].reduce((a, b) => a + b.amount, 0) || 1;
  return [...map.entries()]
    .map(([name, v]) => {
      const cat = categories.find((c) => c.name === name);
      return {
        name,
        emoji: cat?.emoji || "📦",
        color: cat?.color || "#64748b",
        amount: v.amount,
        count: v.count,
        share: (v.amount / total) * 100,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

export function accountStats(
  txs: Transaction[],
  type: "expense" | "income" | "all" = "all",
): { name: string; amount: number; share: number }[] {
  const map = new Map<string, number>();
  for (const t of txs) {
    if (type !== "all" && t.type !== type) continue;
    map.set(t.account || "অন্যান্য", (map.get(t.account || "অন্যান্য") || 0) + (Number(t.amount) || 0));
  }
  const total = [...map.values()].reduce((a, b) => a + b, 0) || 1;
  return [...map.entries()]
    .map(([name, amount]) => ({ name, amount, share: (amount / total) * 100 }))
    .sort((a, b) => b.amount - a.amount);
}

export function topExpenses(txs: Transaction[], n = 5): Transaction[] {
  return txs
    .filter((t) => t.type === "expense")
    .sort((a, b) => b.amount - a.amount)
    .slice(0, n);
}

export interface ContactBalance {
  contactId: string;
  name: string;
  net: number;
  lastDate: string;
  count: number;
}

/** ধনাত্মক = সে আমার পাওনা, ঋণাত্মক = আমি তার দেনা */
export function contactBalances(debts: Debt[]): ContactBalance[] {
  const map = new Map<string, ContactBalance>();
  for (const d of debts) {
    const delta =
      d.kind === "lent"
        ? d.amount
        : d.kind === "borrowed"
          ? -d.amount
          : d.kind === "lent_repaid"
            ? -d.amount
            : d.amount;
    const prev = map.get(d.contactId) || {
      contactId: d.contactId,
      name: d.contactName,
      net: 0,
      lastDate: d.date,
      count: 0,
    };
    prev.net += delta;
    prev.count += 1;
    if (d.date > prev.lastDate) prev.lastDate = d.date;
    map.set(d.contactId, prev);
  }
  return [...map.values()].sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
}

export function debtSummary(debts: Debt[]): {
  receivable: number;
  payable: number;
  receivableCount: number;
  payableCount: number;
} {
  const balances = contactBalances(debts);
  let receivable = 0;
  let payable = 0;
  let receivableCount = 0;
  let payableCount = 0;
  for (const b of balances) {
    if (b.net > 0) {
      receivable += b.net;
      receivableCount += 1;
    } else if (b.net < 0) {
      payable += -b.net;
      payableCount += 1;
    }
  }
  return { receivable, payable, receivableCount, payableCount };
}

export function contactNet(debts: Debt[], contactId: string): number {
  return debts
    .filter((d) => d.contactId === contactId)
    .reduce((acc, d) => {
      const delta =
        d.kind === "lent"
          ? d.amount
          : d.kind === "borrowed"
            ? -d.amount
            : d.kind === "lent_repaid"
              ? -d.amount
              : d.amount;
      return acc + delta;
    }, 0);
}
