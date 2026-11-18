/* ─────────────────────────────  টাইপ ডেফিনিশন  ───────────────────────────── */

export type TxType = "expense" | "income";

export interface Category {
  id: string;
  name: string;
  emoji: string;
  color: string;
  type: TxType | "both";
  /** ফোল্ডারে সাজানো — না দিলে "ফোল্ডার ছাড়া" হিসেবে দেখা যাবে */
  folderId?: string;
}

/** নিয়মিত কেনাকাটা / খাতগুলোকে সাজানোর ঐচ্ছিক ফোল্ডার (ভাড়া, খাবার, অন্যান্য…) */
export interface Folder {
  id: string;
  name: string;
  emoji: string;
  color: string;
  createdAt: number;
  updatedAt?: number;
  updatedBy?: string;
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
  /** ব্যবহারকারী দেওয়া নাম — "রিনেম" এটিই বদলায় (না থাকলে খাতের নাম দেখানো হয়) */
  title?: string;
  /** ঐচ্ছিক: পরিমাণ (যেমন ২ কেজি) — না দিলেও সেভ হয় */
  quantity?: number;
  /** ঐচ্ছিক: একক (টাকা/কেজি/এমএল/নিজের বানানো) */
  unit?: string;
  /** ঐচ্ছিক: কোন পরিবারের সদস্যের জন্য খরচ */
  familyMember?: string;
  /** একাধিক ডিভাইসে এডিট হলে কোনটা নতুন — শেষ লেখাটাই জেতে */
  updatedAt?: number;
  updatedBy?: string;
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
  /** ঐচ্ছিক ফোল্ডার — না দিলে "ফোল্ডার ছাড়া" তালিকায় থাকবে */
  folderId?: string;
  /** ঐচ্ছিক: পরিমাণ, একক ও পরিবারের সদস্য (না দিলেও সেভ হয়) */
  quantity?: number;
  unit?: string;
  familyMember?: string;
  uses: number;
  lastUsed?: number;
  createdAt: number;
  updatedAt?: number;
  updatedBy?: string;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  note: string;
  createdAt: number;
  updatedAt?: number;
  updatedBy?: string;
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
  updatedAt?: number;
  updatedBy?: string;
  /** ক্যাশবহিতে তৈরি হওয়া লেনদেনের আইডি (থাকলে) */
  txId?: string;
}

export interface Settings {
  currency: string;
  monthlyBudget: number;
  categories: Category[];
  accounts: string[];
  /** পরিমাণের একক — টাকা/কেজি/এমএল ইত্যাদি (বাটন দিয়ে নতুন যোগ করা যায়) */
  units: string[];
  /** পরিবারের সদস্য — বাটন দিয়ে নতুন যোগ করা যায় */
  familyMembers: string[];
  bengaliNumerals: boolean;
  theme: "system" | "light" | "dark";
  autoBackup: boolean;
  lastBackupAt?: number;
  version: number;
}

/* ─────────────────────────────  রিসাইকেল বিন  ───────────────────────────── */

export type TrashKind = "transaction" | "template" | "contact" | "debt" | "folder" | "category";

/**
 * ডিলিট করা জিনিসের সম্পূর্ণ কপি এখানে জমা হয় — আসল কালেকশন থেকে সরানো হয়,
 * তাই হিসাব/রিপোর্টে এগুলো আর ধরা পড়ে না, কিন্তু বিন থেকে ফেরত আনা যায়।
 */
export interface TrashItem {
  id: string;
  kind: TrashKind;
  /** আসল কালেকশনের ডকুমেন্ট আইডি */
  originalId: string;
  /** বিনে দেখানোর জন্য সংরক্ষিত নাম ও ছোট বিবরণ */
  label: string;
  detail: string;
  data: Transaction | Template | Contact | Debt | Folder | Category;
  deletedAt: number;
  deletedBy?: string;
  /** একসাথে ডিলিট হওয়া আইটেম (যেমন কন্টাক্ট + তার দেনা) — একসাথে ফেরত আসবে */
  batchId?: string;
  /** ফোল্ডার মুছলে যে আইটেমগুলোর ফোল্ডার খুলে দেওয়া হয়েছে */
  affectedIds?: string[];
}

export const TRASH_LABEL: Record<TrashKind, string> = {
  transaction: "লেনদেন",
  template: "নিয়মিত কেনাকাটা",
  contact: "পরিচিতি",
  debt: "দেনা-পাওনা",
  folder: "ফোল্ডার",
  category: "খাত",
};

export const TRASH_EMOJI: Record<TrashKind, string> = {
  transaction: "🧾",
  template: "🔁",
  contact: "👤",
  debt: "🤝",
  folder: "📁",
  category: "🏷️",
};

export interface AppData {
  transactions: Transaction[];
  templates: Template[];
  contacts: Contact[];
  debts: Debt[];
  folders: Folder[];
  trash: TrashItem[];
  settings: Settings;
}

export const DEBT_LABEL: Record<DebtKind, string> = {
  lent: "টাকা দিয়েছি",
  borrowed: "টাকা নিয়েছি",
  lent_repaid: "ফেরত পেয়েছি",
  borrowed_repaid: "ফেরত দিয়েছি",
};

/** ব্যাকআপ ফরম্যাট — নতুন কালেকশন যোগের সাথে বাড়ানো হয়েছে */
export const DATA_VERSION = 2;
