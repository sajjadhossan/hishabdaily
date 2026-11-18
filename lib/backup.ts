import { DEFAULT_SETTINGS, csvEscape, isoDate } from "./utils";
import { DATA_VERSION, type AppData, type Settings, type Transaction } from "./types";

export interface BackupFile {
  app: "hishab";
  version: number;
  exportedAt: string;
  user: { name: string; email: string };
  data: {
    transactions: AppData["transactions"];
    templates: AppData["templates"];
    contacts: AppData["contacts"];
    debts: AppData["debts"];
    folders: AppData["folders"];
    trash: AppData["trash"];
  };
  settings: Settings;
}

export function buildBackup(
  data: AppData,
  user: { name: string; email: string },
): BackupFile {
  return {
    app: "hishab",
    version: DATA_VERSION,
    exportedAt: new Date().toISOString(),
    user: { name: user.name, email: user.email },
    data: {
      transactions: data.transactions,
      templates: data.templates,
      contacts: data.contacts,
      debts: data.debts,
      folders: data.folders || [],
      trash: data.trash || [],
    },
    settings: data.settings,
  };
}

export function backupFileName(userName = "user"): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
  return `hishab-backup-${stamp}.json`;
}

export function parseBackup(text: string): Partial<AppData> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("ফাইলটি সঠিক JSON ব্যাকআপ নয়।");
  }
  const obj = raw as Partial<BackupFile> & Partial<AppData>;
  const source = (obj.data || obj) as Partial<AppData>;
  if (!source || (!Array.isArray(source.transactions) && !Array.isArray(source.contacts))) {
    throw new Error("এই ফাইলে হিসাবের ডেটা পাওয়া যায়নি।");
  }
  const clean = <T extends { id: string }>(rows: T[] | undefined): T[] =>
    (rows || []).filter((r) => r && typeof r === "object" && typeof r.id === "string");

  return {
    transactions: clean(source.transactions),
    templates: clean(source.templates),
    contacts: clean(source.contacts),
    debts: clean(source.debts),
    // পুরনো ব্যাকআপে এই দুটি ছিল না — সেক্ষেত্রে খালি তালিকা ধরি
    folders: clean(source.folders),
    trash: clean(source.trash),
    settings: { ...DEFAULT_SETTINGS, ...(source.settings || obj.settings || {}) },
  };
}

export function transactionsToCsv(transactions: Transaction[], settings: Settings): string {
  const header = ["তারিখ", "ধরন", "খাত", "অ্যাকাউন্ট", "টাকা", "নোট"];
  const rows = [...transactions]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt))
    .map((t) => [
      t.date,
      t.type === "income" ? "আয়" : "খরচ",
      t.category,
      t.account,
      t.amount,
      t.note || "",
    ]);
  const csv = [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
  return "\uFEFF" + csv;
}

export function csvFileName(): string {
  return `hishab-transactions-${isoDate()}.csv`;
}
