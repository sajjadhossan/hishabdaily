import type { Category, Settings } from "./types";

/* ─────────────────────────────  ডিফল্ট ডেটা  ───────────────────────────── */

export const DEFAULT_EXPENSE_CATEGORIES: Category[] = [
  { id: "food", name: "খাবার", emoji: "🍚", color: "#f97316", type: "expense" },
  { id: "grocery", name: "বাজার", emoji: "🛒", color: "#22c55e", type: "expense" },
  { id: "transport", name: "যাতায়াত", emoji: "🚌", color: "#3b82f6", type: "expense" },
  { id: "rent", name: "বাসা ভাড়া", emoji: "🏠", color: "#8b5cf6", type: "expense" },
  { id: "utility", name: "বিদ্যুৎ/পানি", emoji: "💡", color: "#eab308", type: "expense" },
  { id: "mobile", name: "মোবাইল/ইন্টারনেট", emoji: "📱", color: "#06b6d4", type: "expense" },
  { id: "health", name: "স্বাস্থ্য", emoji: "🩺", color: "#ef4444", type: "expense" },
  { id: "education", name: "শিক্ষা", emoji: "📚", color: "#6366f1", type: "expense" },
  { id: "clothes", name: "পোশাক", emoji: "👕", color: "#ec4899", type: "expense" },
  { id: "fun", name: "বিনোদন", emoji: "🎬", color: "#a855f7", type: "expense" },
  { id: "charity", name: "দান/ধর্ম", emoji: "🤲", color: "#14b8a6", type: "expense" },
  { id: "family", name: "পরিবার", emoji: "👨‍👩‍👧", color: "#f43f5e", type: "expense" },
  { id: "debt", name: "দেনা-পাওনা", emoji: "🤝", color: "#78716c", type: "expense" },
  { id: "others", name: "অন্যান্য", emoji: "📦", color: "#64748b", type: "expense" },
];

export const DEFAULT_INCOME_CATEGORIES: Category[] = [
  { id: "salary", name: "বেতন", emoji: "💼", color: "#0ea5e9", type: "income" },
  { id: "business", name: "ব্যবসা", emoji: "🏪", color: "#10b981", type: "income" },
  { id: "freelance", name: "ফ্রিল্যান্সিং", emoji: "💻", color: "#6366f1", type: "income" },
  { id: "gift", name: "উপহার", emoji: "🎁", color: "#f59e0b", type: "income" },
  { id: "investment", name: "বিনিয়োগ/সুদ", emoji: "📈", color: "#14b8a6", type: "income" },
  { id: "rent_in", name: "ভাড়া আয়", emoji: "🏘️", color: "#8b5cf6", type: "income" },
  { id: "income_others", name: "অন্যান্য", emoji: "💰", color: "#64748b", type: "income" },
];

export const DEFAULT_SETTINGS: Settings = {
  currency: "৳",
  monthlyBudget: 0,
  categories: [...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES],
  accounts: ["ক্যাশ", "বিকাশ", "নগদ", "ব্যাংক", "কার্ড"],
  units: ["টাকা", "কেজি", "এমএল", "লিটার", "পিস"],
  familyMembers: [],
  bengaliNumerals: false,
  theme: "system",
  autoBackup: false,
  version: 2,
};

export const STORAGE_KEY = "hishab.firebaseConfig";
export const THEME_KEY = "hishab.theme";

/* ─────────────────────────────  সংখ্যা ও মুদ্রা  ───────────────────────────── */

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

export function toBengaliDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
}

export function digits(value: string | number, bengali: boolean): string {
  return bengali ? toBengaliDigits(value) : String(value);
}

/** 12,345.50 ধাঁচে গ্রুপ করা (ভারতীয়/বাংলাদেশি স্টাইল) */
export function groupNumber(n: number, decimals = 0): string {
  const neg = n < 0;
  const abs = Math.abs(n);
  const fixed = abs.toFixed(decimals);
  const [intPart, decPart] = fixed.split(".");
  const last3 = intPart.slice(-3);
  const rest = intPart.slice(0, -3);
  const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3 : last3;
  return (neg ? "-" : "") + grouped + (decPart ? "." + decPart : "");
}

export function formatMoney(
  amount: number,
  opts: { currency?: string; bengali?: boolean; decimals?: number; compact?: boolean } = {},
): string {
  const { currency = "৳", bengali = false, decimals = 0, compact = false } = opts;
  let text: string;
  if (compact) {
    const abs = Math.abs(amount);
    if (abs >= 10000000) text = groupNumber(amount / 10000000, 1) + " কোটি";
    else if (abs >= 100000) text = groupNumber(amount / 100000, 1) + " লাখ";
    else if (abs >= 1000) text = groupNumber(amount / 1000, 1) + " হাজার";
    else text = groupNumber(amount, decimals);
    if (bengali) text = toBengaliDigits(text);
    return `${currency}${text}`;
  }
  text = groupNumber(amount, decimals);
  return `${currency}${bengali ? toBengaliDigits(text) : text}`;
}

export const uid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/* ─────────────────────────────  তারিখ  ───────────────────────────── */

export const BN_MONTHS = [
  "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
  "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর",
];
export const BN_MONTHS_SHORT = ["জানু", "ফেব", "মার্চ", "এপ্রি", "মে", "জুন", "জুলা", "আগ", "সেপ্ট", "অক্টো", "নভে", "ডিসে"];
export const BN_DAYS = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি"];

export function isoDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const todayISO = () => isoDate(new Date());

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function currentMonth(): string {
  return todayISO().slice(0, 7);
}

export function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(ym: string, bengali = false): string {
  const [y, m] = ym.split("-").map(Number);
  return `${BN_MONTHS[m - 1]} ${bengali ? toBengaliDigits(y) : y}`;
}

export function monthShort(ym: string, bengali = false): string {
  const [y, m] = ym.split("-").map(Number);
  return `${BN_MONTHS_SHORT[m - 1]}${m === 1 ? ` ${bengali ? toBengaliDigits(String(y).slice(2)) : String(y).slice(2)}` : ""}`;
}

export function formatDate(iso: string, bengali = false, withYear = false): string {
  const [y, m, d] = iso.split("-").map(Number);
  const base = `${bengali ? toBengaliDigits(d) : d} ${BN_MONTHS_SHORT[m - 1]}`;
  return withYear ? `${base}, ${bengali ? toBengaliDigits(y) : y}` : base;
}

export function relativeDate(iso: string, bengali = false): string {
  const today = todayISO();
  if (iso === today) return "আজ";
  const d = new Date();
  d.setDate(d.getDate() - 1);
  if (iso === isoDate(d)) return "গতকাল";
  return formatDate(iso, bengali);
}

export function weekdayOf(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return BN_DAYS[new Date(y, m - 1, d).getDay()];
}

export function daysInMonth(ym: string): number {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export function monthRange(ym: string): [string, string] {
  return [`${ym}-01`, `${ym}-${String(daysInMonth(ym)).padStart(2, "0")}`];
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "এইমাত্র";
  if (min < 60) return `${min} মিনিট আগে`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ঘণ্টা আগে`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} দিন আগে`;
  return formatDate(isoDate(new Date(ts)), true, true);
}

/* ─────────────────────────────  অন্যান্য  ───────────────────────────── */

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function csvEscape(v: string | number): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function sum(list: { amount: number }[]): number {
  return list.reduce((a, b) => a + (Number(b.amount) || 0), 0);
}

export function percent(part: number, total: number): number {
  if (!total) return 0;
  return Math.max(0, Math.min(100, (part / total) * 100));
}
