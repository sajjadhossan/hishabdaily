/* ─────────────────────────────  টাইপ ডেফিনিশন  ───────────────────────────── */

export type TxType = "expense" | "income";

export interface Category {
  id: string;
  name: string;
  emoji: string;
  color: string;
  type: TxType | "both";
}

export interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  category: string;
  account: string;
  note: string;
  /** YYYY-MM-DD (স্থানীয় তারিখ) */
  date: string;
  createdAt: number;
  updatedAt?: number;
  templateId?: string;
}

/** নিয়মিত কেনাকাটা / আয় — এক ক্লিকে আবার যোগ করার টেমপ্লেট */
export interface Template {
  id: string;
  name: string;
  emoji: string;
  type: TxType;
  amount: number;
  category: string;
  account: string;
  note: string;
  uses: number;
  lastUsed?: number;
  createdAt: number;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  note: string;
  createdAt: number;
}

/**
 * দেনা-পাওনার লেজার এন্ট্রি।
 * lent            → আমি টাকা দিয়েছি (সে আমার পাওনা)
 * borrowed        → আমি টাকা নিয়েছি (আমি তার দেনা)
 * lent_repaid     → আমার পাওনা ফেরত পেয়েছি
 * borrowed_repaid → আমার দেনা শোধ করেছি
 */
export type DebtKind = "lent" | "borrowed" | "lent_repaid" | "borrowed_repaid";

export interface Debt {
  id: string;
  contactId: string;
  contactName: string;
  kind: DebtKind;
  amount: number;
  note: string;
  date: string;
  createdAt: number;
  /** ক্যাশবহিতে তৈরি হওয়া লেনদেনের আইডি (থাকলে) */
  txId?: string;
}

export interface Settings {
  currency: string;
  monthlyBudget: number;
  categories: Category[];
  accounts: string[];
  bengaliNumerals: boolean;
  theme: "system" | "light" | "dark";
  autoBackup: boolean;
  lastBackupAt?: number;
  version: number;
}

export interface AppData {
  transactions: Transaction[];
  templates: Template[];
  contacts: Contact[];
  debts: Debt[];
  settings: Settings;
}

export const DEBT_LABEL: Record<DebtKind, string> = {
  lent: "টাকা দিয়েছি",
  borrowed: "টাকা নিয়েছি",
  lent_repaid: "ফেরত পেয়েছি",
  borrowed_repaid: "ফেরত দিয়েছি",
};

export const DATA_VERSION = 1;
