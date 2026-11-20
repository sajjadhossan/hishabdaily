/* ─────────────────────────────  রিপোর্ট ইঞ্জিন  ─────────────────────────────
 * সব রিপোর্ট একই ছাঁচে বানানো হয় — যাতে স্ক্রিনে দেখা, Excel আর PDF — তিনো
 * জায়গাতেই একই ডেটা যায়। কোনো নতুন Firestore কালেকশন লাগবে না; সবকিছু
 * আগের লেনদেন/খাত/ফোল্ডার/পরিচিতি/দেনা-পাওনা থেকেই বের করা হয়।
 */

import type { AppData } from "./types";
import {
  BN_MONTHS,
  formatDate,
  formatMoney,
  monthKey,
  toBengaliDigits,
} from "./utils";

export type ReportKey =
  | "overview"
  | "yearly"
  | "monthly"
  | "daily"
  | "family"
  | "contacts"
  | "category"
  | "folder"
  | "items";

export type PeriodMode = "all" | "year" | "month" | "day";

export interface Period {
  mode: PeriodMode;
  year?: number;
  month?: string; // YYYY-MM
  day?: string; // YYYY-MM-DD
}

export type CellFormat = "text" | "money" | "number" | "percent";

export interface ReportColumn {
  key: string;
  label: string;
  format?: CellFormat;
}

export interface ReportRow {
  [key: string]: string | number;
}

export interface ReportSummary {
  label: string;
  value: string;
}

export interface Report {
  key: ReportKey;
  title: string;
  subtitle: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  summaries: ReportSummary[];
  note?: string;
}

export const REPORT_LIST: { key: ReportKey; label: string; emoji: string }[] = [
  { key: "overview", label: "সারা জীবন", emoji: "💰" },
  { key: "yearly", label: "বছরভিত্তিক", emoji: "📆" },
  { key: "monthly", label: "মাসভিত্তিক", emoji: "🗓️" },
  { key: "daily", label: "দিনভিত্তিক", emoji: "📅" },
  { key: "family", label: "পরিবারের সদস্য", emoji: "👨‍👩‍👧" },
  { key: "contacts", label: "পরিচিতি", emoji: "🤝" },
  { key: "category", label: "খাত", emoji: "🏷️" },
  { key: "folder", label: "সাব-ক্যাটাগরি", emoji: "📁" },
  { key: "items", label: "জিনিস", emoji: "🛒" },
];

/** সময়-ভিত্তিক রিপোর্টে তারিখ বাছাই দেখানো হয় না — সেগুলো সব সময়েরই হিসাব */
export const ALL_TIME_REPORTS: ReportKey[] = ["overview", "yearly", "monthly", "daily"];

export function newPeriod(): Period {
  const now = new Date();
  return {
    mode: "all",
    year: now.getFullYear(),
    month: monthKey(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
    ),
    day: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
  };
}

export function inPeriod(date: string, period: Period): boolean {
  if (!date) return false;
  if (period.mode === "all") return true;
  if (period.mode === "year") return date.startsWith(String(period.year));
  if (period.mode === "month") return monthKey(date) === period.month;
  return date === period.day;
}

/** একটি সেল স্ক্রিনে ও PDF-এ একইভাবে দেখানোর জন্য */
export function formatCell(
  value: string | number,
  format: CellFormat | undefined,
  currency: string,
  bengali: boolean,
): string {
  if (format === "money") return formatMoney(Number(value) || 0, { currency, bengali });
  if (format === "percent") {
    return `${bengali ? toBengaliDigits((Number(value) || 0).toFixed(1)) : (Number(value) || 0).toFixed(1)}%`;
  }
  if (format === "number") return bengali ? toBengaliDigits(value) : String(value);
  return String(value);
}

export function periodLabel(period: Period, bengali = false): string {
  if (period.mode === "all") return "সব সময়";
  const num = (n: string | number) => (bengali ? toBengaliDigits(n) : String(n));
  if (period.mode === "year") return `${num(period.year || "")} সাল`;
  if (period.mode === "month") {
    const [y, m] = (period.month || "").split("-");
    return `${BN_MONTHS[Number(m) - 1] || ""} ${num(y)}`;
  }
  return formatDate(period.day || "", bengali, true);
}

function sum(txs: AppData["transactions"], type: "income" | "expense"): number {
  let total = 0;
  for (const t of txs) if (t.type === type) total += Number(t.amount) || 0;
  return total;
}

function money(n: number, currency: string, bengali: boolean): string {
  return formatMoney(n, { currency, bengali });
}

interface AmountCount {
  amount: number;
  count: number;
}

function add(map: Map<string, AmountCount>, key: string, amount: number): void {
  const prev = map.get(key) || { amount: 0, count: 0 };
  prev.amount += amount;
  prev.count += 1;
  map.set(key, prev);
}

function shareOf(value: number, total: number): number {
  return total ? (value / total) * 100 : 0;
}

/** নির্দিষ্ট রিপোর্ট বানাও */
export function buildReport(
  key: ReportKey,
  data: AppData,
  period: Period,
  currency: string,
  bengali: boolean,
  userName: string,
): Report {
  const all = data.transactions || [];
  const scoped = period.mode === "all" ? all : all.filter((t) => inPeriod(t.date, period));
  const expenses = scoped.filter((t) => t.type === "expense");
  const base = { currency, bengali, userName };

  switch (key) {
    case "overview":
      return overviewReport(all, base);
    case "yearly":
      return yearlyReport(all, base);
    case "monthly":
      return monthlyReport(all, base);
    case "daily":
      return dailyReport(all, base);
    case "family":
      return familyReport(expenses, base);
    case "contacts":
      return contactsReport(data, period, base);
    case "category":
      return categoryReport(expenses, data, base);
    case "folder":
      return folderReport(expenses, data, base);
    case "items":
      return itemsReport(expenses, base);
  }
}

type Base = { currency: string; bengali: boolean; userName: string };

function meta(
  key: ReportKey,
  title: string,
  subtitle: string,
  columns: ReportColumn[],
  rows: ReportRow[],
  summaries: ReportSummary[],
  note?: string,
): Report {
  return { key, title, subtitle, columns, rows, summaries, note };
}

function overviewReport(txs: AppData["transactions"], b: Base): Report {
  const now = new Date();
  const y = String(now.getFullYear());
  const ym = monthKey(`${y}-${String(now.getMonth() + 1).padStart(2, "0")}-01`);
  const today = `${ym}-${String(now.getDate()).padStart(2, "0")}`;
  const buckets: { label: string; rows: AppData["transactions"] }[] = [
    { label: "সব সময়", rows: txs },
    { label: `${b.bengali ? toBengaliDigits(y) : y} সাল`, rows: txs.filter((t) => t.date.startsWith(y)) },
    { label: `${BN_MONTHS[Number(ym.slice(5)) - 1]} ${b.bengali ? toBengaliDigits(y) : y}`, rows: txs.filter((t) => monthKey(t.date) === ym) },
    { label: "আজ", rows: txs.filter((t) => t.date === today) },
  ];
  const rows = buckets.map((bucket) => ({
    sample: bucket.label,
    income: sum(bucket.rows, "income"),
    expense: sum(bucket.rows, "expense"),
    net: sum(bucket.rows, "income") - sum(bucket.rows, "expense"),
    count: bucket.rows.length,
  }));
  const lifetimeExpense = sum(txs, "expense");
  return meta(
    "overview",
    "সারা জীবনের হিসাব",
    `${b.userName} · সব সময়`,
    [
      { key: "sample", label: "সময়", format: "text" },
      { key: "income", label: "মোট আয়", format: "money" },
      { key: "expense", label: "মোট খরচ", format: "money" },
      { key: "net", label: "সঞ্চয়", format: "money" },
      { key: "count", label: "লেনদেন", format: "number" },
    ],
    rows,
    [
      { label: "জীবনে মোট খরচ", value: money(lifetimeExpense, b.currency, b.bengali) },
      { label: "জীবনে মোট আয়", value: money(sum(txs, "income"), b.currency, b.bengali) },
      { label: "মোট লেনদেন", value: `${b.bengali ? toBengaliDigits(txs.length) : txs.length} টি` },
    ],
    "এই রিপোর্টে সময় বাছাই প্রযোজ্য নয় — সব সময়ের হিসাব দেখানো হয়।",
  );
}

function yearlyReport(txs: AppData["transactions"], b: Base): Report {
  const map = new Map<string, AmountCount & { income: number }>();
  for (const t of txs) {
    const y = (t.date || "").slice(0, 4);
    if (!/^\d{4}$/.test(y)) continue;
    const prev = map.get(y) || { amount: 0, count: 0, income: 0 };
    if (t.type === "expense") {
      prev.amount += Number(t.amount) || 0;
      prev.count += 1;
    } else {
      prev.income += Number(t.amount) || 0;
    }
    map.set(y, prev);
  }
  const rows = [...map.entries()]
    .sort((a, z) => Number(a[0]) - Number(z[0]))
    .map(([y, v]) => ({
      year: b.bengali ? toBengaliDigits(y) : y,
      income: v.income,
      expense: v.amount,
      net: v.income - v.amount,
      count: v.count,
    }));
  const total = rows.reduce((a, r) => a + Number(r.expense), 0);
  return meta(
    "yearly",
    "বছরভিত্তিক খরচ",
    `${b.userName} · ${rows.length ? rows[0].year : "—"} → ${rows.length ? rows[rows.length - 1].year : "—"}`,
    [
      { key: "year", label: "বছর", format: "text" },
      { key: "income", label: "আয়", format: "money" },
      { key: "expense", label: "খরচ", format: "money" },
      { key: "net", label: "সঞ্চয়", format: "money" },
      { key: "count", label: "খরচের সংখ্যা", format: "number" },
    ],
    rows,
    [
      { label: "মোট খরচ", value: money(total, b.currency, b.bengali) },
      { label: "কত বছরের হিসাব", value: `${b.bengali ? toBengaliDigits(rows.length) : rows.length} টি` },
    ],
    "প্রতি বছরের আয়-খরচ ও সঞ্চয় আলাদা করে দেখানো হয়।",
  );
}

function monthlyReport(txs: AppData["transactions"], b: Base): Report {
  const map = new Map<string, AmountCount & { income: number }>();
  for (const t of txs) {
    const ym = monthKey(t.date);
    if (!/^\d{4}-\d{2}$/.test(ym)) continue;
    const prev = map.get(ym) || { amount: 0, count: 0, income: 0 };
    if (t.type === "expense") {
      prev.amount += Number(t.amount) || 0;
      prev.count += 1;
    } else {
      prev.income += Number(t.amount) || 0;
    }
    map.set(ym, prev);
  }
  const rows = [...map.entries()]
    .sort((a, z) => a[0].localeCompare(z[0]))
    .map(([ym, v]) => ({
      period: b.bengali
        ? `${BN_MONTHS[Number(ym.slice(5)) - 1]} ${toBengaliDigits(ym.slice(0, 4))}`
        : `${ym.slice(5)}/${ym.slice(0, 4)}`,
      income: v.income,
      expense: v.amount,
      net: v.income - v.amount,
      count: v.count,
    }));
  const total = rows.reduce((a, r) => a + Number(r.expense), 0);
  return meta(
    "monthly",
    "মাসভিত্তিক খরচ",
    `${b.userName} · ${rows.length ? rows[0].period : "—"} → ${rows.length ? rows[rows.length - 1].period : "—"}`,
    [
      { key: "period", label: "মাস", format: "text" },
      { key: "income", label: "আয়", format: "money" },
      { key: "expense", label: "খরচ", format: "money" },
      { key: "net", label: "সঞ্চয়", format: "money" },
      { key: "count", label: "খরচের সংখ্যা", format: "number" },
    ],
    rows,
    [
      { label: "মোট খরচ", value: money(total, b.currency, b.bengali) },
      { label: "গড় মাসিক খরচ", value: money(rows.length ? total / rows.length : 0, b.currency, b.bengali) },
    ],
    "প্রতি মাসের আয়-খরচ ও সঞ্চয় আলাদা করে দেখানো হয়।",
  );
}

function dailyReport(txs: AppData["transactions"], b: Base): Report {
  const map = new Map<string, AmountCount & { income: number }>();
  for (const t of txs) {
    const date = t.date || "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const prev = map.get(date) || { amount: 0, count: 0, income: 0 };
    if (t.type === "expense") {
      prev.amount += Number(t.amount) || 0;
      prev.count += 1;
    } else {
      prev.income += Number(t.amount) || 0;
    }
    map.set(date, prev);
  }
  const rows = [...map.entries()]
    .sort((a, z) => z[0].localeCompare(a[0]))
    .map(([date, v]) => ({
      date: formatDate(date, b.bengali, true),
      income: v.income,
      expense: v.amount,
      net: v.income - v.amount,
      count: v.count,
    }));
  const total = rows.reduce((a, r) => a + Number(r.expense), 0);
  return meta(
    "daily",
    "দিনভিত্তিক খরচ",
    `${b.userName} · ${rows.length ? `${b.bengali ? toBengaliDigits(rows.length) : rows.length} দিন` : "—"}`,
    [
      { key: "date", label: "তারিখ", format: "text" },
      { key: "income", label: "আয়", format: "money" },
      { key: "expense", label: "খরচ", format: "money" },
      { key: "net", label: "সঞ্চয়", format: "money" },
      { key: "count", label: "লেনদেন", format: "number" },
    ],
    rows,
    [
      { label: "মোট খরচ", value: money(total, b.currency, b.bengali) },
      { label: "দৈনিক গড়", value: money(rows.length ? total / rows.length : 0, b.currency, b.bengali) },
    ],
    "যেসব দিনে লেনদেন আছে শুধু সেসব দিন দেখানো হয়।",
  );
}

function familyReport(
  expenses: AppData["transactions"],
  b: Base,
): Report {
  const map = new Map<string, AmountCount>();
  for (const t of expenses) {
    const name = (t.familyMember || "").trim();
    if (name) add(map, name, Number(t.amount) || 0);
  }
  const total = [...map.values()].reduce((a, v) => a + v.amount, 0);
  const rows = [...map.entries()]
    .sort((a, z) => z[1].amount - a[1].amount)
    .map(([name, v]) => ({
      name,
      count: v.count,
      amount: v.amount,
      share: shareOf(v.amount, total),
    }));
  return meta(
    "family",
    "পরিবারের সদস্যভিত্তিক খরচ",
    `${b.userName} · ${b.bengali ? "যাদের জন্য খরচ হয়েছে" : "per family member"}`,
    [
      { key: "name", label: "সদস্য", format: "text" },
      { key: "count", label: "কতবার", format: "number" },
      { key: "amount", label: "মোট খরচ", format: "money" },
      { key: "share", label: "শতাংশ", format: "percent" },
    ],
    rows,
    [
      { label: "মোট খরচ", value: money(total, b.currency, b.bengali) },
      { label: "কতজন", value: `${b.bengali ? toBengaliDigits(rows.length) : rows.length} জন` },
      { label: "সবচেয়ে বেশি খরচ", value: rows[0] ? `${rows[0].name} — ${money(Number(rows[0].amount), b.currency, b.bengali)}` : "—" },
    ],
    "লেনদেনে যে সদস্যের নাম দেওয়া আছে শুধু সেগুলো ধরা হয়। নাম না দিলে হিসাবে যোগ হবে না।",
  );
}

function contactsReport(
  data: AppData,
  period: Period,
  b: Base,
): Report {
  const debts = (data.debts || []).filter((d) => inPeriod(d.date, period));
  const map = new Map<string, { name: string; lent: number; borrowed: number; repaid: number }>();
  for (const d of debts) {
    const id = d.contactId || d.contactName || "অজানা";
    const prev = map.get(id) || { name: d.contactName || "অজানা", lent: 0, borrowed: 0, repaid: 0 };
    const amount = Number(d.amount) || 0;
    if (d.kind === "lent") prev.lent += amount;
    else if (d.kind === "borrowed") prev.borrowed += amount;
    else prev.repaid += amount;
    map.set(id, prev);
  }
  const rows = [...map.entries()]
    .sort((a, z) => {
      const netA = a[1].lent - a[1].borrowed;
      const netZ = z[1].lent - z[1].borrowed;
      return Math.abs(netZ) - Math.abs(netA);
    })
    .map(([, v]) => ({
      name: v.name,
      lent: v.lent,
      borrowed: v.borrowed,
      repaid: v.repaid,
      net: v.lent - v.borrowed,
    }));
  return meta(
    "contacts",
    "পরিচিতিভিত্তিক হিসাব",
    `${b.userName} · ${b.bengali ? "দেনা-পাওনাসহ" : "with dues"}`,
    [
      { key: "name", label: "পরিচিতি", format: "text" },
      { key: "lent", label: "দিয়েছি", format: "money" },
      { key: "borrowed", label: "নিয়েছি", format: "money" },
      { key: "repaid", label: "ফেরত", format: "money" },
      { key: "net", label: "বাকি", format: "money" },
    ],
    rows,
    [
      {
        label: "মোট পাওনা",
        value: money(rows.reduce((a, r) => a + Math.max(0, Number(r.net)), 0), b.currency, b.bengali),
      },
      {
        label: "মোট দেনা",
        value: money(rows.reduce((a, r) => a + Math.max(0, -Number(r.net)), 0), b.currency, b.bengali),
      },
      { label: "কতজন", value: `${b.bengali ? toBengaliDigits(rows.length) : rows.length} জন` },
    ],
    "পরিচিতির হিসাব দেনা-পাওনা রেকর্ড থেকে আসে — এটা সরাসরি খরচ নয়। 'বাকি' ধনাত্মক হলে সে আমার পাওনা, ঋণাত্মক হলে আমি তার দেনা।",
  );
}

function categoryReport(
  expenses: AppData["transactions"],
  data: AppData,
  b: Base,
): Report {
  const map = new Map<string, AmountCount>();
  for (const t of expenses) add(map, t.category || "অনির্দিষ্ট", Number(t.amount) || 0);
  const total = [...map.values()].reduce((a, v) => a + v.amount, 0);
  const catByName = new Map((data.settings?.categories || []).map((c) => [c.name, c]));
  const rows = [...map.entries()]
    .sort((a, z) => z[1].amount - a[1].amount)
    .map(([name, v]) => ({
      name: `${catByName.get(name)?.emoji || "📦"} ${name}`.trim(),
      count: v.count,
      amount: v.amount,
      share: shareOf(v.amount, total),
    }));
  return meta(
    "category",
    "খাতভিত্তিক খরচ",
    `${b.userName} · ${b.bengali ? "বড় থেকে ছোট" : "largest first"}`,
    [
      { key: "name", label: "খাত", format: "text" },
      { key: "count", label: "কতবার", format: "number" },
      { key: "amount", label: "মোট খরচ", format: "money" },
      { key: "share", label: "শতাংশ", format: "percent" },
    ],
    rows,
    [
      { label: "মোট খরচ", value: money(total, b.currency, b.bengali) },
      { label: "কতটি খাত", value: `${b.bengali ? toBengaliDigits(rows.length) : rows.length} টি` },
      { label: "সবচেয়ে বেশি", value: rows[0] ? `${rows[0].name} — ${money(Number(rows[0].amount), b.currency, b.bengali)}` : "—" },
    ],
    "লেনদেনে বেছে নেওয়া খাত অনুযায়ী দলে ভাগ করা হয়েছে।",
  );
}

function folderReport(
  expenses: AppData["transactions"],
  data: AppData,
  b: Base,
): Report {
  const folderById = new Map((data.folders || []).map((f) => [f.id, f]));
  const folderEmojiByName = new Map((data.folders || []).map((f) => [f.name, f.emoji]));
  const catByName = new Map((data.settings?.categories || []).map((c) => [c.name, c]));
  const map = new Map<string, AmountCount>();
  for (const t of expenses) {
    const cat = catByName.get(t.category || "");
    const folder = cat?.folderId ? folderById.get(cat.folderId) : undefined;
    const name = folder?.name || "ফোল্ডার ছাড়া";
    add(map, name, Number(t.amount) || 0);
  }
  const total = [...map.values()].reduce((a, v) => a + v.amount, 0);
  const rows = [...map.entries()]
    .sort((a, z) => z[1].amount - a[1].amount)
    .map(([name, v]) => ({
      name: `${folderEmojiByName.get(name) || "📁"} ${name}`.trim(),
      count: v.count,
      amount: v.amount,
      share: shareOf(v.amount, total),
    }));
  return meta(
    "folder",
    "সাব-ক্যাটাগরি (ফোল্ডার) ভিত্তিক খরচ",
    `${b.userName} · ${b.bengali ? "ফোল্ডার অনুযায়ী" : "by folder"}`,
    [
      { key: "name", label: "সাব-ক্যাটাগরি", format: "text" },
      { key: "count", label: "কতবার", format: "number" },
      { key: "amount", label: "মোট খরচ", format: "money" },
      { key: "share", label: "শতাংশ", format: "percent" },
    ],
    rows,
    [
      { label: "মোট খরচ", value: money(total, b.currency, b.bengali) },
      { label: "কতটি সাব-ক্যাটাগরি", value: `${b.bengali ? toBengaliDigits(rows.length) : rows.length} টি` },
      { label: "সবচেয়ে বেশি", value: rows[0] ? `${rows[0].name} — ${money(Number(rows[0].amount), b.currency, b.bengali)}` : "—" },
    ],
    "খাতগুলো যে ফোল্ডারে সাজানো আছে (সেটিংস → খাত) সেটাকেই সাব-ক্যাটাগরি ধরা হয়েছে। ফোল্ডার না দিলে 'ফোল্ডার ছাড়া' তালিকায় যাবে।",
  );
}

function itemsReport(
  expenses: AppData["transactions"],
  b: Base,
): Report {
  const map = new Map<string, AmountCount & { last: string }>();
  for (const t of expenses) {
    const name = (t.title || "").trim();
    if (!name) continue;
    const prev = map.get(name) || { amount: 0, count: 0, last: "" };
    prev.amount += Number(t.amount) || 0;
    prev.count += 1;
    if (t.date > prev.last) prev.last = t.date;
    map.set(name, prev);
  }
  const total = [...map.values()].reduce((a, v) => a + v.amount, 0);
  const rows = [...map.entries()]
    .sort((a, z) => z[1].count - a[1].count || z[1].amount - a[1].amount)
    .map(([name, v]) => ({
      name,
      count: v.count,
      amount: v.amount,
      last: formatDate(v.last, b.bengali, true),
    }));
  return meta(
    "items",
    "জিনিসভিত্তিক কেনাকাটা",
    `${b.userName} · ${b.bengali ? "সবচেয়ে বেশি কেনা প্রথমে" : "most bought first"}`,
    [
      { key: "name", label: "জিনিসের নাম", format: "text" },
      { key: "count", label: "কতবার কেনা", format: "number" },
      { key: "amount", label: "মোট খরচ", format: "money" },
      { key: "last", label: "শেষ কেনা", format: "text" },
    ],
    rows,
    [
      { label: "মোট খরচ", value: money(total, b.currency, b.bengali) },
      { label: "কত রকম জিনিস", value: `${b.bengali ? toBengaliDigits(rows.length) : rows.length} রকম` },
      { label: "সবচেয়ে বেশি কেনা", value: rows[0] ? `${rows[0].name} (${b.bengali ? toBengaliDigits(Number(rows[0].count)) : rows[0].count} বার)` : "—" },
    ],
    "লেনদেনের 'নাম' (title) একই হলে একই জিনিস ধরে কতবার কেনা হয়েছে তা গণনা করা হয়। নাম না থাকলে ধরা হয় না।",
  );
}
