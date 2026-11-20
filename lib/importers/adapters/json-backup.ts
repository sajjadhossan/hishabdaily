import { DEFAULT_SETTINGS } from "../../utils";
import { canonicalCategory, canonicalPerson, isPersonName } from "../canonical";
import { normalizeText, parseDate, rowFingerprint } from "../normalize";
import type { ParsedRow } from "../types";

/* ─────────────────────────────────────────────────────────────
   দুই ধরনের JSON ব্যাকআপ একই রূপে আনি

   ১) আমাদের নিজস্ব ব্যাকআপ  → data.transactions / data.debts
   ২) পুরোনো hisabkitab      → data.personal.personalExpenses … ইত্যাদি

   দ্বিতীয়টিতে ১০০০ টি খরচ থাকে — তার মধ্যে ৯৮৩ টি "daily" আর ১৭ টি
   business/family। PDF/Excel স্টেটমেন্টে শুধু ৯৮৩ টি daily খরচ আছে,
   তাই মূল ব্যাচে শুধু daily রাখি, বাকিগুলো আলাদা করে জানিয়ে দিই।
   ───────────────────────────────────────────────────────────── */

export interface JsonBackupResult {
  rows: ParsedRow[];
  /** দৈনিক হিসাবের বাইরে থাকা খরচ (ব্যবসা/পরিবার) — বাদ দেওয়া হয়েছে */
  excludedExpenses: number;
  extraKinds: string[];
}

const EXISTING_CATEGORIES = DEFAULT_SETTINGS.categories.map((c) => c.name);

function str(value: unknown): string {
  return value == null ? "" : normalizeText(String(value));
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

function baseRow(input: {
  i: number;
  date: string;
  description: string;
  amount: number;
  category: string;
  raw: string;
  kind?: ParsedRow["kind"];
  extra?: Partial<ParsedRow>;
}): ParsedRow {
  const amount = Math.round(input.amount * 100) / 100;
  return {
    id: `json-${input.i}`,
    date: input.date,
    description: input.description.slice(0, 160) || "লেনদেন",
    amount,
    kind: input.kind || "expense",
    category: canonicalCategory(input.category, EXISTING_CATEGORIES),
    account: "",
    confidence: 1,
    raw: input.raw.slice(0, 300),
    fingerprint: rowFingerprint(input.date, amount, input.description),
    selected: true,
    sourceType: "json",
    sourceId: str(input.extra?.sourceId) || `json-${input.i}`,
    sourceOrdinal: input.i,
    ...input.extra,
  };
}

function fromOwnBackup(obj: Record<string, unknown>, _sourceName: string): JsonBackupResult {
  const data = (obj.data || obj) as Record<string, unknown>;
  const rows: ParsedRow[] = [];
  const txs = Array.isArray(data.transactions) ? data.transactions : [];
  txs.forEach((value, i) => {
    const tx = (value || {}) as Record<string, unknown>;
    const amount = num(tx.amount);
    if (!amount) return;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(str(tx.date)) ? str(tx.date) : "";
    const description = str(tx.note) || str(tx.category) || "লেনদেন";
    rows.push(baseRow({
      i, date, description, amount,
      category: str(tx.category),
      raw: `JSON backup · ${str(tx.date)}`,
      kind: tx.type === "income" ? "income" : "expense",
      extra: {
        note: str(tx.note),
        folder: str(tx.folder),
        subFolder: str(tx.subFolder),
        event: str(tx.event),
        person: str(tx.familyMember),
        recordType: "daily",
      },
    }));
  });
  const debts = Array.isArray(data.debts) ? data.debts : [];
  debts.forEach((value, j) => {
    const debt = (value || {}) as Record<string, unknown>;
    const amount = num(debt.amount);
    if (!amount) return;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(str(debt.date)) ? str(debt.date) : "";
    const name = str(debt.contactName) || str(debt.name) || str(debt.note) || "দেনা-পাওনা";
    rows.push(baseRow({
      i: txs.length + j, date, description: name, amount,
      category: "দেনা-পাওনা",
      raw: `JSON backup · ${str(debt.date)}`,
      kind: "debt",
      extra: { debtDirection: (debt.kind as ParsedRow["debtDirection"]) || "borrowed", note: str(debt.note) },
    }));
  });
  return { rows, excludedExpenses: 0, extraKinds: [] };
}

function fromHisabkitab(obj: Record<string, unknown>): JsonBackupResult {
  const data = (obj.data || {}) as Record<string, unknown>;
  const personal = (data.personal || {}) as Record<string, unknown>;
  const expenses = Array.isArray(personal.personalExpenses) ? personal.personalExpenses : [];
  const rows: ParsedRow[] = [];
  let excludedExpenses = 0;
  const extraKinds: string[] = [];

  expenses.forEach((value, i) => {
    const x = (value || {}) as Record<string, unknown>;
    const amount = num(x.amount);
    if (!amount) return;
    const type = str(x.type) || "daily";
    // দৈনিক স্টেটমেন্টের সাথে মেলানোর জন্য শুধু daily রাখি
    if (type !== "daily") {
      excludedExpenses++;
      return;
    }
    const date = /^\d{4}-\d{2}-\d{2}$/.test(str(x.date)) ? str(x.date) : parseDate(str(x.date)) || "";
    const description = str(x.title) || str(x.item) || str(x.note) || str(x.category) || "লেনদেন";
    const rawPerson = str(x.familyMember) || str(x.person) || str(x.member);
    const person = isPersonName(rawPerson) ? canonicalPerson(rawPerson) : "";
    const qtyRaw = x.quantity;
    const quantity = qtyRaw === "" || qtyRaw == null ? undefined : num(qtyRaw) || undefined;
    rows.push(baseRow({
      i, date, description, amount,
      category: str(x.category),
      raw: `JSON · ${str(x.category)} | ${description} | ${str(x.folder)} | ${str(x.subFolder)}`,
      extra: {
        sourceId: str(x.id) || `pex-${i}`,
        person,
        quantity,
        unit: str(x.unit),
        folder: str(x.folder),
        subFolder: str(x.subFolder),
        event: str(x.eventName),
        note: str(x.note) || str(x.purpose),
        recordType: type,
      },
    }));
  });

  const incomes = Array.isArray(personal.personalIncomes) ? personal.personalIncomes : [];
  incomes.forEach((value, k) => {
    const x = (value || {}) as Record<string, unknown>;
    const amount = num(x.amount);
    if (!amount) return;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(str(x.date)) ? str(x.date) : "";
    rows.push(baseRow({
      i: expenses.length + k, date,
      description: str(x.note) || str(x.source) || str(x.category) || "আয়",
      amount, category: str(x.category) || "বেতন",
      raw: `JSON income · ${str(x.date)}`,
      kind: "income",
      extra: { sourceId: str(x.id), recordType: "income", note: str(x.note) },
    }));
  });

  const debtGroups = Array.isArray(personal.personalDebts) ? personal.personalDebts : [];
  let di = 0;
  for (const value of debtGroups) {
    const group = (value || {}) as Record<string, unknown>;
    const contact = str(group.name) || str(group.relation) || "দেনা-পাওনা";
    const txns = Array.isArray(group.transactions) ? group.transactions : [];
    for (const tv of txns) {
      const t = (tv || {}) as Record<string, unknown>;
      const amount = num(t.amount);
      if (!amount) continue;
      const date = /^\d{4}-\d{2}-\d{2}$/.test(str(t.date)) ? str(t.date) : "";
      const direction = str(t.type);
      rows.push(baseRow({
        i: expenses.length + incomes.length + di++, date,
        description: contact, amount,
        category: "দেনা-পাওনা",
        raw: `JSON debt · ${contact} · ${str(t.date)}`,
        kind: "debt",
        extra: {
          sourceId: str(t.id),
          debtDirection: /borrow|ধার নি| owe/i.test(direction) ? "borrowed" : "lent",
          note: str(t.note) || str(t.purpose),
          recordType: "debt",
        },
      }));
    }
  }

  return { rows, excludedExpenses, extraKinds };
}

/** JSON-এর যেকোনো চেনা রূপ থেকে ইম্পোর্ট রো বানায় */
export function rowsFromJsonBackup(text: string, sourceName: string): JsonBackupResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    throw new Error("JSON ফাইলটি পড়া যায়নি।");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("JSON-এ হিসাবের ডেটা পাওয়া যায়নি।");
  const obj = parsed as Record<string, unknown>;
  const data = (obj.data || {}) as Record<string, unknown>;
  const personal = (data.personal || {}) as Record<string, unknown>;
  if (Array.isArray(personal.personalExpenses)) return fromHisabkitab(obj);
  if (Array.isArray(data.transactions) || Array.isArray(obj.transactions)) return fromOwnBackup(obj, sourceName);
  throw new Error("এই JSON-এ চেনা হিসাবের ডেটা পাওয়া যায়নি।");
}
