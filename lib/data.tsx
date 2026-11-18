"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import { useAuth } from "./auth";
import { firebaseReady } from "./firebase";
import { DEFAULT_SETTINGS, formatMoney, isoDate, uid } from "./utils";
import {
  DATA_VERSION,
  DEBT_LABEL,
  type AppData,
  type Category,
  type Contact,
  type Debt,
  type DebtKind,
  type Folder,
  type Settings,
  type Template,
  type TrashItem,
  type TrashKind,
  type Transaction,
} from "./types";

export type TxInput = Pick<
  Transaction,
  | "type"
  | "amount"
  | "category"
  | "account"
  | "note"
  | "date"
  | "title"
  | "quantity"
  | "unit"
  | "familyMember"
> & { templateId?: string };

export type TemplateInput = Omit<Template, "id" | "createdAt" | "uses" | "lastUsed">;
export type ContactInput = Omit<Contact, "id" | "createdAt">;
export type DebtInput = Omit<Debt, "id" | "createdAt" | "contactName" | "txId"> & {
  contactName?: string;
  addToCash?: boolean;
};
export type FolderInput = Pick<Folder, "name" | "emoji" | "color">;

interface DataApi extends AppData {
  ready: boolean;
  isLocal: boolean;
  /** ক্লাউডে সব শেষ পরিবর্তন পৌঁছেছে কি না (অফলাইনে false) */
  synced: boolean;
  error: string | null;
  addTransaction: (input: TxInput) => Promise<Transaction>;
  /** স্মার্ট ইম্পোর্টের জন্য একাধিক লেনদেন এক ব্যাচে লেখে (ডেমো/ক্লাউড দুটোতেই চলে) */
  addTransactionsBulk: (inputs: TxInput[]) => Promise<Transaction[]>;
  updateTransaction: (id: string, patch: Partial<TxInput>) => Promise<void>;
  /** লেনদেনের নাম বদলায় (নোট/টাকা অঘোষিত থাকে) */
  renameTransaction: (id: string, title: string) => Promise<void>;
  /** স্থায়ীভাবে না মুছে রিসাইকেল বিনে পাঠায় */
  removeTransaction: (id: string) => Promise<void>;
  addTemplate: (input: TemplateInput) => Promise<Template>;
  updateTemplate: (id: string, patch: Partial<TemplateInput>) => Promise<void>;
  removeTemplate: (id: string) => Promise<void>;
  useTemplate: (id: string) => Promise<Transaction | null>;
  addFolder: (input: FolderInput) => Promise<Folder>;
  updateFolder: (id: string, patch: Partial<FolderInput>) => Promise<void>;
  /** ফোল্ডার বিনে যাবে, ভেতরের আইটেম "ফোল্ডার ছাড়া" হয়ে থাকবে */
  removeFolder: (id: string) => Promise<void>;
  removeCategory: (id: string) => Promise<void>;
  addContact: (input: ContactInput) => Promise<Contact>;
  updateContact: (id: string, patch: Partial<ContactInput>) => Promise<void>;
  removeContact: (id: string) => Promise<void>;
  addDebt: (input: DebtInput) => Promise<Debt>;
  removeDebt: (id: string) => Promise<void>;
  /** বিন থেকে আসল জায়গায় ফেরত আনে (একই ব্যাচের সব আইটেম সহ) */
  restoreTrash: (id: string) => Promise<void>;
  /** বিন থেকে একটিকে চিরতরে মুছে ফেলে */
  deleteTrashForever: (id: string) => Promise<void>;
  emptyTrash: () => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  replaceAll: (payload: Partial<AppData>) => Promise<void>;
  clearAllData: () => Promise<void>;
}

const EMPTY: AppData = {
  transactions: [],
  templates: [],
  contacts: [],
  debts: [],
  folders: [],
  trash: [],
  settings: DEFAULT_SETTINGS,
};

const DataContext = createContext<DataApi | null>(null);

const localKey = (uid: string) => `hishab.data.${uid}`;

function readLocal(uid: string): AppData | null {
  try {
    const raw = localStorage.getItem(localKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AppData>;
    return {
      transactions: parsed.transactions || [],
      templates: parsed.templates || [],
      contacts: parsed.contacts || [],
      debts: parsed.debts || [],
      folders: parsed.folders || [],
      trash: parsed.trash || [],
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
    };
  } catch {
    return null;
  }
}

/* ──────────────────────────  ডেমো ডেটা  ────────────────────────── */

function seedDemoData(): AppData {
  const now = new Date();
  const iso = (d: Date) => isoDate(d);
  const daysAgo = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return iso(d);
  };
  const t = (
    type: Transaction["type"],
    amount: number,
    category: string,
    account: string,
    note: string,
    date: string,
  ): Transaction => ({
    id: uid(),
    type,
    amount,
    category,
    account,
    note,
    date,
    createdAt: new Date(date + "T12:00:00").getTime(),
  });

  const transactions: Transaction[] = [
    t("income", 32000, "বেতন", "ব্যাংক", "মাসিক বেতন", daysAgo(12)),
    t("expense", 6500, "বাসা ভাড়া", "ক্যাশ", "বাসা ভাড়া", daysAgo(11)),
    t("expense", 2450, "বাজার", "ক্যাশ", "সাপ্তাহিক বাজার", daysAgo(2)),
    t("expense", 320, "যাতায়াত", "বিকাশ", "রিকশা ও বাস", daysAgo(1)),
    t("expense", 850, "খাবার", "বিকাশ", "বন্ধুদের সাথে দুপুরের খাবার", daysAgo(1)),
    t("expense", 1200, "মোবাইল/ইন্টারনেট", "বিকাশ", "মাসিক ডাটা প্যাক", daysAgo(8)),
    t("income", 8000, "ফ্রিল্যান্সিং", "ব্যাংক", "একটি ছোট প্রজেক্ট", daysAgo(5)),
    t("expense", 480, "যাতায়াত", "ক্যাশ", "অটো ভাড়া", daysAgo(0)),
    t("expense", 250, "খাবার", "ক্যাশ", "নাস্তা", daysAgo(0)),
    t("expense", 3000, "পোশাক", "কার্ড", "ঈদের কেনাকাটা", daysAgo(18)),
    t("expense", 500, "দান/ধর্ম", "ক্যাশ", "মসজিদে দান", daysAgo(4)),
  ];

  const folders: Folder[] = [
    { id: "demo-f-rent", name: "ভাড়া", emoji: "🏠", color: "#8b5cf6", createdAt: Date.now() },
    { id: "demo-f-food", name: "খাবার", emoji: "🍚", color: "#f97316", createdAt: Date.now() },
  ];

  const templates: Template[] = [
    {
      id: uid(),
      folderId: "demo-f-food",
      name: "সকালের নাস্তা",
      emoji: "🍳",
      type: "expense",
      amount: 60,
      category: "খাবার",
      account: "ক্যাশ",
      note: "",
      uses: 12,
      lastUsed: Date.now() - 86400000,
      createdAt: Date.now() - 86400000 * 20,
    },
    {
      id: uid(),
      folderId: "demo-f-rent",
      name: "রিকশা ভাড়া",
      emoji: "🛺",
      type: "expense",
      amount: 40,
      category: "যাতায়াত",
      account: "ক্যাশ",
      note: "",
      uses: 8,
      lastUsed: Date.now() - 86400000,
      createdAt: Date.now() - 86400000 * 15,
    },
    {
      id: uid(),
      name: "মাসিক ইন্টারনেট",
      emoji: "🌐",
      type: "expense",
      amount: 1200,
      category: "মোবাইল/ইন্টারনেট",
      account: "বিকাশ",
      note: "মাসের ৫ তারিখে",
      uses: 6,
      lastUsed: Date.now() - 86400000 * 8,
      createdAt: Date.now() - 86400000 * 90,
    },
    {
      id: uid(),
      folderId: "demo-f-food",
      name: "চা-নাস্তা",
      emoji: "☕",
      type: "expense",
      amount: 30,
      category: "খাবার",
      account: "ক্যাশ",
      note: "",
      uses: 24,
      lastUsed: Date.now() - 86400000 * 2,
      createdAt: Date.now() - 86400000 * 40,
    },
  ];

  const contacts: Contact[] = [
    { id: "demo-c1", name: "রফিক ভাই", phone: "01712345678", note: "প্রতিবেশী", createdAt: Date.now() - 86400000 * 30 },
    { id: "demo-c2", name: "সুমন", phone: "", note: "কলেজ বন্ধু", createdAt: Date.now() - 86400000 * 10 },
  ];

  const debts: Debt[] = [
    {
      id: uid(),
      contactId: "demo-c1",
      contactName: "রফিক ভাই",
      kind: "lent",
      amount: 5000,
      note: "জরুরি প্রয়োজনে দিয়েছি",
      date: daysAgo(20),
      createdAt: Date.now() - 86400000 * 20,
    },
    {
      id: uid(),
      contactId: "demo-c1",
      contactName: "রফিক ভাই",
      kind: "lent_repaid",
      amount: 2000,
      note: "কিছুটা ফেরত দিয়েছেন",
      date: daysAgo(5),
      createdAt: Date.now() - 86400000 * 5,
    },
    {
      id: uid(),
      contactId: "demo-c2",
      contactName: "সুমন",
      kind: "borrowed",
      amount: 1500,
      note: "বই কেনার জন্য নিয়েছি",
      date: daysAgo(3),
      createdAt: Date.now() - 86400000 * 3,
    },
  ];

  return { transactions, templates, contacts, debts, folders, trash: [], settings: DEFAULT_SETTINGS };
}

/* ──────────────────────────  হেল্পার  ────────────────────────── */

/** Firestore-এ undefined ফিল্ড লেখা যায় না — ঐচ্ছিক ফিল্ড না দিলে বাদ দিই */
function stripUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

function stripId<T extends { id: string }>(obj: T): Omit<T, "id"> {
  const { id: _id, ...rest } = obj;
  return stripUndefined(rest) as Omit<T, "id">;
}

/** ঐচ্ছিক ঘর খালি করলে cloud-এ ফিল্ডটিই মুছে দিই, নাহলে পুরোনো মান থেকে যায় */
const OPTIONAL_FIELDS = [
  "title",
  "quantity",
  "unit",
  "familyMember",
  "folderId",
  "templateId",
] as const;

function cloudPatch<T extends object>(patch: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    out[key] =
      value === undefined && OPTIONAL_FIELDS.includes(key as (typeof OPTIONAL_FIELDS)[number])
        ? deleteField()
        : value;
  }
  return stripUndefined(out);
}

async function deleteCollection(db: Firestore, path: string) {
  for (let guard = 0; guard < 40; guard++) {
    const snap = await getDocs(query(collection(db, path), limit(300)));
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    if (snap.size < 300) return;
  }
}

/** রিসাইকেল বিনে যাওয়া আইটেমের আসল কালেকশন (খাত settings-এ থাকে) */
const TRASH_SOURCE: Record<TrashKind, string> = {
  transaction: "transactions",
  template: "templates",
  contact: "contacts",
  debt: "debts",
  folder: "folders",
  category: "categories",
};

function makeTrash(
  kind: TrashKind,
  data: TrashItem["data"],
  originalId: string,
  label: string,
  detail: string,
  deletedBy?: string,
  extra?: { batchId?: string; affectedIds?: string[] },
): TrashItem {
  return {
    id: uid(),
    kind,
    originalId,
    label,
    detail,
    data,
    deletedAt: Date.now(),
    deletedBy,
    ...extra,
  };
}

/** Firestore-এ undefined ফিল্ড লেখা যায় না — ফোল্ডার খুলতে ফিল্ডটিই বাদ দিই */
function unassignFolder<T extends { folderId?: string }>(row: T): T {
  const { folderId: _folderId, ...rest } = row;
  return rest as T;
}

/* ──────────────────────────  প্রোভাইডার  ────────────────────────── */

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, cloudAvailable } = useAuth();
  const [data, setData] = useState<AppData>(EMPTY);
  const [ready, setReady] = useState(false);
  const [synced, setSynced] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isLocal = !user || user.demo || !cloudAvailable;
  const isLocalRef = useRef(isLocal);
  isLocalRef.current = isLocal;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const online = () => setSynced(true);
    const offline = () => setSynced(false);
    if (!navigator.onLine) setSynced(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setData(EMPTY);
      setReady(true);
      return;
    }

    if (isLocal) {
      const stored = readLocal(user.uid);
      setData(stored ?? (user.demo ? seedDemoData() : EMPTY));
      setReady(true);
      setError(null);
      return;
    }

    let active = true;
    const unsubs: (() => void)[] = [];
    setReady(false);
    setError(null);

    (async () => {
      const services = await firebaseReady();
      if (!services || !active) return;
      const { db } = services;
      const u = user.uid;
      const root = doc(db, "users", u);

      let arrived = 0;
      // ১ root + ৬ কালেকশন (transactions, templates, contacts, debts, folders, trash)
      const done = () => {
        arrived++;
        if (arrived >= 7 && active) setReady(true);
      };
      const fail = (err: unknown) => {
        console.error(err);
        if (!active) return;
        setError(
          "ডেটা লোড করা যাচ্ছে না। Firebase-এর Firestore Rules ঠিক আছে কিনা দেখুন (README-তে নিয়ম দেওয়া আছে)।",
        );
        setReady(true);
      };

      unsubs.push(
        onSnapshot(
          root,
          (snap) => {
            const st = snap.data()?.settings as Partial<Settings> | undefined;
            const merged: Settings = {
              ...DEFAULT_SETTINGS,
              ...(st || {}),
              categories: st?.categories?.length ? st.categories : DEFAULT_SETTINGS.categories,
              accounts: st?.accounts?.length ? st.accounts : DEFAULT_SETTINGS.accounts,
            };
            setData((prev) => ({ ...prev, settings: merged }));
            setSynced(!snap.metadata.fromCache);
            if (!snap.exists()) {
              setDoc(root, { settings: DEFAULT_SETTINGS, createdAt: Date.now() }, { merge: true }).catch(
                fail,
              );
            }
            done();
          },
          fail,
        ),
      );

      const watch = <
        K extends "transactions" | "templates" | "contacts" | "debts" | "folders" | "trash",
      >(
        name: K,
      ) => {
        const q =
          name === "transactions"
            ? query(collection(db, "users", u, name), orderBy("createdAt", "desc"), limit(2000))
            : query(collection(db, "users", u, name));
        unsubs.push(
          onSnapshot(
            q,
            (snap) => {
              const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as AppData[K];
              setData((prev) => ({ ...prev, [name]: rows }));
              setSynced(!snap.metadata.fromCache);
              done();
            },
            fail,
          ),
        );
      };

      watch("transactions");
      watch("templates");
      watch("contacts");
      watch("debts");
      watch("folders");
      watch("trash");

      // নিরাপত্তা: কোনো কারণে স্ন্যাপশট না এলে ১০ সেকেন্ড পর লোডিং শেষ
      setTimeout(() => {
        if (active) setReady(true);
      }, 10000);
    })();

    return () => {
      active = false;
      unsubs.forEach((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, authLoading, isLocal]);

  // লোকাল মোডে অটো-সেভ
  useEffect(() => {
    if (!ready || !user || !isLocalRef.current) return;
    try {
      localStorage.setItem(localKey(user.uid), JSON.stringify(data));
    } catch (err) {
      console.error("local save failed", err);
    }
  }, [data, ready, user]);

  const guardCloud = useCallback(async () => {
    const services = await firebaseReady();
    if (!services || !user) throw new Error("ক্লাউড সংযোগ নেই।");
    return services;
  }, [user]);

  /* ──────────────  রিসাইকেল বিন — ভেতরের হেল্পার  ────────────── */

  /** আসল কালেকশন থেকে সরিয়ে বিনে জমা করে (লোকাল + ক্লাউড) */
  const pushToTrash = useCallback(
    async (items: TrashItem[]) => {
      if (!items.length) return;
      const idsOf = (kind: TrashKind) =>
        new Set(items.filter((i) => i.kind === kind).map((i) => i.originalId));
      const txIds = idsOf("transaction");
      const tplIds = idsOf("template");
      const conIds = idsOf("contact");
      const debtIds = idsOf("debt");
      const folderIds = idsOf("folder");
      const catIds = idsOf("category");
      const affected = new Set(items.flatMap((i) => i.affectedIds || []));

      if (isLocalRef.current) {
        setData((prev) => ({
          ...prev,
          transactions: prev.transactions.filter((t) => !txIds.has(t.id)),
          templates: prev.templates
            .filter((t) => !tplIds.has(t.id))
            .map((t) => (affected.has(t.id) ? { ...t, folderId: undefined } : t)),
          contacts: prev.contacts.filter((c) => !conIds.has(c.id)),
          debts: prev.debts.filter((d) => !debtIds.has(d.id)),
          folders: prev.folders.filter((f) => !folderIds.has(f.id)),
          trash: [...items, ...prev.trash],
          settings:
            catIds.size || affected.size
              ? {
                  ...prev.settings,
                  categories: prev.settings.categories
                    .filter((c) => !catIds.has(c.id))
                    .map((c) => (affected.has(c.id) ? { ...c, folderId: undefined } : c)),
                }
              : prev.settings,
        }));
        return;
      }

      const { db } = await guardCloud();
      const uidStr = user!.uid;
      const batch = writeBatch(db);
      items.forEach((item) => {
        batch.set(doc(db, "users", uidStr, "trash", item.id), stripId(item));
        if (item.kind !== "category") {
          batch.delete(doc(db, "users", uidStr, TRASH_SOURCE[item.kind], item.originalId));
        }
      });
      data.templates
        .filter((t) => affected.has(t.id))
        .forEach((t) =>
          batch.update(doc(db, "users", uidStr, "templates", t.id), { folderId: deleteField() }),
        );
      if (catIds.size || affected.size) {
        batch.set(
          doc(db, "users", uidStr),
          {
            settings: {
              ...data.settings,
              categories: data.settings.categories
                .filter((c) => !catIds.has(c.id))
                .map((c) => (affected.has(c.id) ? unassignFolder(c) : c)),
            },
            settingsUpdatedAt: Date.now(),
            settingsUpdatedBy: uidStr,
          },
          { merge: true },
        );
      }
      await batch.commit();
    },
    [guardCloud, user, data.settings, data.templates],
  );

  /** বিন থেকে আসল জায়গায় ফেরত আনে */
  const restoreFromTrash = useCallback(
    async (items: TrashItem[]) => {
      if (!items.length) return;
      const trashIds = new Set(items.map((i) => i.id));
      const folder = items.find((i) => i.kind === "folder");
      const affected = new Set(items.flatMap((i) => i.affectedIds || []));

      if (isLocalRef.current) {
        setData((prev) => {
          const next: AppData = {
            ...prev,
            trash: prev.trash.filter((t) => !trashIds.has(t.id)),
          };
          for (const item of items) {
            if (item.kind === "transaction") {
              const row = item.data as Transaction;
              next.transactions = [row, ...next.transactions.filter((t) => t.id !== row.id)];
            } else if (item.kind === "template") {
              const row = item.data as Template;
              next.templates = [row, ...next.templates.filter((t) => t.id !== row.id)];
            } else if (item.kind === "contact") {
              const row = item.data as Contact;
              next.contacts = [row, ...next.contacts.filter((c) => c.id !== row.id)];
            } else if (item.kind === "debt") {
              const row = item.data as Debt;
              next.debts = [row, ...next.debts.filter((d) => d.id !== row.id)];
            } else if (item.kind === "folder") {
              const row = item.data as Folder;
              next.folders = [row, ...next.folders.filter((f) => f.id !== row.id)];
            } else {
              const row = item.data as Category;
              next.settings = {
                ...next.settings,
                categories: [...next.settings.categories.filter((c) => c.id !== row.id), row],
              };
            }
          }
          if (folder) {
            next.templates = next.templates.map((t) =>
              affected.has(t.id) ? { ...t, folderId: folder.originalId } : t,
            );
            next.settings = {
              ...next.settings,
              categories: next.settings.categories.map((c) =>
                affected.has(c.id) ? { ...c, folderId: folder.originalId } : c,
              ),
            };
          }
          return next;
        });
        return;
      }

      const { db } = await guardCloud();
      const uidStr = user!.uid;
      const batch = writeBatch(db);
      let categories = [...data.settings.categories];
      for (const item of items) {
        batch.delete(doc(db, "users", uidStr, "trash", item.id));
        if (item.kind === "category") {
          const row = item.data as Category;
          categories = [...categories.filter((c) => c.id !== row.id), row];
        } else {
          batch.set(
            doc(db, "users", uidStr, TRASH_SOURCE[item.kind], item.originalId),
            stripId(item.data as { id: string }),
          );
        }
      }
      if (folder) {
        data.templates
          .filter((t) => affected.has(t.id))
          .forEach((t) =>
            batch.update(doc(db, "users", uidStr, "templates", t.id), {
              folderId: folder.originalId,
            }),
          );
        categories = categories.map((c) =>
          affected.has(c.id) ? { ...c, folderId: folder.originalId } : c,
        );
      }
      if (items.some((i) => i.kind === "category") || (folder && affected.size)) {
        batch.set(
          doc(db, "users", uidStr),
          {
            settings: { ...data.settings, categories },
            settingsUpdatedAt: Date.now(),
            settingsUpdatedBy: uidStr,
          },
          { merge: true },
        );
      }
      await batch.commit();
    },
    [guardCloud, user, data.settings, data.templates],
  );

  const addTransaction = useCallback(
    async (input: TxInput): Promise<Transaction> => {
      const now = Date.now();
      const tx: Transaction = {
        id: uid(),
        ...input,
        amount: Number(input.amount) || 0,
        createdAt: now,
        updatedAt: now,
        updatedBy: user?.uid,
      };
      if (isLocalRef.current) {
        setData((prev) => ({ ...prev, transactions: [tx, ...prev.transactions] }));
        return tx;
      }
      const { db } = await guardCloud();
      await setDoc(doc(db, "users", user!.uid, "transactions", tx.id), stripId(tx));
      return tx;
    },
    [guardCloud, user],
  );

  const addTransactionsBulk = useCallback(
    async (inputs: TxInput[]): Promise<Transaction[]> => {
      const now = Date.now();
      const txs: Transaction[] = inputs.map((input, i) => ({
        id: uid(),
        ...input,
        amount: Number(input.amount) || 0,
        createdAt: now + i,
        updatedAt: now + i,
        updatedBy: user?.uid,
      }));
      if (!txs.length) return [];
      if (isLocalRef.current) {
        setData((prev) => ({ ...prev, transactions: [...txs, ...prev.transactions] }));
        return txs;
      }
      const { db } = await guardCloud();
      const uidStr = user!.uid;
      for (let i = 0; i < txs.length; i += 300) {
        const batch = writeBatch(db);
        txs.slice(i, i + 300).forEach((tx) =>
          batch.set(doc(db, "users", uidStr, "transactions", tx.id), stripId(tx)),
        );
        await batch.commit();
      }
      return txs;
    },
    [guardCloud, user],
  );

  const updateTransaction = useCallback(
    async (id: string, patch: Partial<TxInput>) => {
      const clean = { ...patch, updatedAt: Date.now(), updatedBy: user?.uid };
      if (isLocalRef.current) {
        setData((prev) => ({
          ...prev,
          transactions: prev.transactions.map((t) =>
            t.id === id ? { ...t, ...clean, amount: Number(clean.amount ?? t.amount) } : t,
          ),
        }));
        return;
      }
      const { db } = await guardCloud();
      await updateDoc(doc(db, "users", user!.uid, "transactions", id), cloudPatch(clean));
    },
    [guardCloud, user],
  );

  const renameTransaction = useCallback(
    async (id: string, title: string) => {
      const clean = title.trim();
      if (isLocalRef.current) {
        setData((prev) => ({
          ...prev,
          transactions: prev.transactions.map((t) =>
            t.id === id ? { ...t, title: clean, updatedAt: Date.now() } : t,
          ),
        }));
        return;
      }
      const { db } = await guardCloud();
      await updateDoc(doc(db, "users", user!.uid, "transactions", id), {
        title: clean,
        updatedAt: Date.now(),
        updatedBy: user?.uid,
      });
    },
    [guardCloud, user],
  );

  const removeTransaction = useCallback(
    async (id: string) => {
      const tx = data.transactions.find((t) => t.id === id);
      if (!tx) return;
      await pushToTrash([
        makeTrash(
          "transaction",
          tx,
          tx.id,
          tx.title || tx.category,
          `${formatMoney(tx.amount)} · ${tx.date}`,
          user?.uid,
        ),
      ]);
    },
    [data.transactions, pushToTrash, user],
  );

  const addTemplate = useCallback(
    async (input: TemplateInput): Promise<Template> => {
      const tpl: Template = {
        id: uid(),
        ...input,
        uses: 0,
        createdAt: Date.now(),
        updatedBy: user?.uid,
      };
      if (isLocalRef.current) {
        setData((prev) => ({ ...prev, templates: [tpl, ...prev.templates] }));
        return tpl;
      }
      const { db } = await guardCloud();
      await setDoc(doc(db, "users", user!.uid, "templates", tpl.id), stripId(tpl));
      return tpl;
    },
    [guardCloud, user],
  );

  const updateTemplate = useCallback(
    async (id: string, patch: Partial<TemplateInput>) => {
      if (isLocalRef.current) {
        setData((prev) => ({
          ...prev,
          templates: prev.templates.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        }));
        return;
      }
      const { db } = await guardCloud();
      await updateDoc(doc(db, "users", user!.uid, "templates", id), {
        ...cloudPatch(patch),
        updatedAt: Date.now(),
        updatedBy: user!.uid,
      });
    },
    [guardCloud, user],
  );

  const removeTemplate = useCallback(
    async (id: string) => {
      const tpl = data.templates.find((t) => t.id === id);
      if (!tpl) return;
      await pushToTrash([
        makeTrash(
          "template",
          tpl,
          tpl.id,
          tpl.name,
          `${formatMoney(tpl.amount)} · ${tpl.category}`,
          user?.uid,
        ),
      ]);
    },
    [data.templates, pushToTrash, user],
  );

  const useTemplate = useCallback(
    async (id: string): Promise<Transaction | null> => {
      const tpl = data.templates.find((t) => t.id === id);
      if (!tpl) return null;
      const tx = await addTransaction({
        type: tpl.type,
        amount: tpl.amount,
        category: tpl.category,
        account: tpl.account,
        note: tpl.note,
        date: isoDate(new Date()),
        templateId: tpl.id,
        quantity: tpl.quantity,
        unit: tpl.unit,
        familyMember: tpl.familyMember,
      });
      if (isLocalRef.current) {
        setData((prev) => ({
          ...prev,
          templates: prev.templates.map((t) =>
            t.id === id ? { ...t, uses: t.uses + 1, lastUsed: Date.now() } : t,
          ),
        }));
      } else {
        const { db } = await guardCloud();
        await updateDoc(doc(db, "users", user!.uid, "templates", id), {
          uses: (tpl.uses || 0) + 1,
          lastUsed: Date.now(),
          updatedAt: Date.now(),
          updatedBy: user!.uid,
        }).catch(() => undefined);
      }
      return tx;
    },
    [addTransaction, data.templates, guardCloud, updateTemplate, user],
  );

  /* ──────────────  ফোল্ডার ও খাত  ────────────── */

  const addFolder = useCallback(
    async (input: FolderInput): Promise<Folder> => {
      const folder: Folder = {
        id: uid(),
        name: input.name.trim(),
        emoji: input.emoji || "📁",
        color: input.color || "#0C906A",
        createdAt: Date.now(),
        updatedBy: user?.uid,
      };
      if (isLocalRef.current) {
        setData((prev) => ({ ...prev, folders: [folder, ...prev.folders] }));
        return folder;
      }
      const { db } = await guardCloud();
      await setDoc(doc(db, "users", user!.uid, "folders", folder.id), stripId(folder));
      return folder;
    },
    [guardCloud, user],
  );

  const updateFolder = useCallback(
    async (id: string, patch: Partial<FolderInput>) => {
      const clean = { ...patch, updatedAt: Date.now(), updatedBy: user?.uid };
      if (isLocalRef.current) {
        setData((prev) => ({
          ...prev,
          folders: prev.folders.map((f) => (f.id === id ? { ...f, ...clean } : f)),
        }));
        return;
      }
      const { db } = await guardCloud();
      await updateDoc(doc(db, "users", user!.uid, "folders", id), clean);
    },
    [guardCloud, user],
  );

  const removeFolder = useCallback(
    async (id: string) => {
      const folder = data.folders.find((f) => f.id === id);
      if (!folder) return;
      const affectedIds = [
        ...data.templates.filter((t) => t.folderId === id).map((t) => t.id),
        ...data.settings.categories.filter((c) => c.folderId === id).map((c) => c.id),
      ];
      await pushToTrash([
        makeTrash(
          "folder",
          folder,
          folder.id,
          folder.name,
          `${affectedIds.length}টি আইটেম ছিল`,
          user?.uid,
          { affectedIds },
        ),
      ]);
    },
    [data.folders, data.templates, data.settings.categories, pushToTrash, user],
  );

  const removeCategory = useCallback(
    async (id: string) => {
      const cat = data.settings.categories.find((c) => c.id === id);
      if (!cat) return;
      await pushToTrash([
        makeTrash("category", cat, cat.id, cat.name, `${cat.emoji} খাত`, user?.uid),
      ]);
    },
    [data.settings.categories, pushToTrash, user],
  );

  const addContact = useCallback(
    async (input: ContactInput): Promise<Contact> => {
      const contact: Contact = {
        id: uid(),
        ...input,
        createdAt: Date.now(),
        updatedBy: user?.uid,
      };
      if (isLocalRef.current) {
        setData((prev) => ({ ...prev, contacts: [contact, ...prev.contacts] }));
        return contact;
      }
      const { db } = await guardCloud();
      await setDoc(doc(db, "users", user!.uid, "contacts", contact.id), stripId(contact));
      return contact;
    },
    [guardCloud, user],
  );

  const updateContact = useCallback(
    async (id: string, patch: Partial<ContactInput>) => {
      if (isLocalRef.current) {
        setData((prev) => ({
          ...prev,
          contacts: prev.contacts.map((c) => (c.id === id ? { ...c, ...patch } : c)),
          debts: prev.debts.map((d) =>
            d.contactId === id && patch.name ? { ...d, contactName: patch.name } : d,
          ),
        }));
        return;
      }
      const { db } = await guardCloud();
      const batch = writeBatch(db);
      batch.update(doc(db, "users", user!.uid, "contacts", id), {
        ...patch,
        updatedAt: Date.now(),
        updatedBy: user!.uid,
      });
      if (patch.name) {
        data.debts
          .filter((d) => d.contactId === id)
          .forEach((d) =>
            batch.update(doc(db, "users", user!.uid, "debts", d.id), {
              contactName: patch.name,
            }),
          );
      }
      await batch.commit();
    },
    [data.debts, guardCloud, user],
  );

  const removeContact = useCallback(
    async (id: string) => {
      const contact = data.contacts.find((c) => c.id === id);
      if (!contact) return;
      const batchId = uid();
      const related = data.debts.filter((d) => d.contactId === id);
      await pushToTrash([
        makeTrash("contact", contact, contact.id, contact.name, contact.phone || "পরিচিতি", user?.uid, {
          batchId,
        }),
        ...related.map((d) =>
          makeTrash("debt", d, d.id, d.contactName, `${formatMoney(d.amount)} · ${DEBT_LABEL[d.kind]}`, user?.uid, {
            batchId,
          }),
        ),
      ]);
    },
    [data.contacts, data.debts, pushToTrash, user],
  );

  const addDebt = useCallback(
    async (input: DebtInput): Promise<Debt> => {
      const { addToCash, contactName, ...rest } = input;
      const contact =
        data.contacts.find((c) => c.id === rest.contactId) ||
        data.contacts.find((c) => c.name === contactName);
      const debt: Debt = {
        id: uid(),
        ...rest,
        contactName: contact?.name || contactName || "অজানা",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        updatedBy: user!.uid,
      };
      if (addToCash) {
        const isIncoming: DebtKind[] = ["borrowed", "lent_repaid"];
        const type = isIncoming.includes(debt.kind) ? "income" : "expense";
        const tx = await addTransaction({
          type,
          amount: debt.amount,
          category: "দেনা-পাওনা",
          account: "ক্যাশ",
          note: debt.note || `${debt.contactName} — ${debt.kind}`,
          date: debt.date,
        });
        debt.txId = tx.id;
      }
      if (isLocalRef.current) {
        setData((prev) => ({ ...prev, debts: [debt, ...prev.debts] }));
        return debt;
      }
      const { db } = await guardCloud();
      await setDoc(doc(db, "users", user!.uid, "debts", debt.id), stripId(debt));
      return debt;
    },
    [addTransaction, data.contacts, guardCloud, user],
  );

  const removeDebt = useCallback(
    async (id: string) => {
      const debt = data.debts.find((d) => d.id === id);
      if (!debt) return;
      const batchId = uid();
      const tx = debt.txId ? data.transactions.find((t) => t.id === debt.txId) : undefined;
      await pushToTrash([
        makeTrash("debt", debt, debt.id, debt.contactName, `${formatMoney(debt.amount)} · ${DEBT_LABEL[debt.kind]}`, user?.uid, {
          batchId,
        }),
        ...(tx
          ? [
              makeTrash(
                "transaction",
                tx,
                tx.id,
                tx.title || tx.category,
                `${formatMoney(tx.amount)} · ${tx.date}`,
                user?.uid,
                { batchId },
              ),
            ]
          : []),
      ]);
    },
    [data.debts, data.transactions, pushToTrash, user],
  );

  /* ──────────────  রিসাইকেল বিন — পাবলিক অ্যাকশন  ────────────── */

  /** এক আইটেম রিস্টোর করলে একই ব্যাচের বাকিগুলোও ফেরত আসে */
  const restoreTrash = useCallback(
    async (id: string) => {
      const target = data.trash.find((t) => t.id === id);
      if (!target) return;
      const group = target.batchId
        ? data.trash.filter((t) => t.batchId === target.batchId)
        : [target];
      await restoreFromTrash(group);
    },
    [data.trash, restoreFromTrash],
  );

  const deleteTrashForever = useCallback(
    async (id: string) => {
      if (isLocalRef.current) {
        setData((prev) => ({ ...prev, trash: prev.trash.filter((t) => t.id !== id) }));
        return;
      }
      const { db } = await guardCloud();
      await deleteDoc(doc(db, "users", user!.uid, "trash", id));
    },
    [guardCloud, user],
  );

  const emptyTrash = useCallback(async () => {
    if (isLocalRef.current) {
      setData((prev) => ({ ...prev, trash: [] }));
      return;
    }
    const { db } = await guardCloud();
    await deleteCollection(db, `users/${user!.uid}/trash`);
  }, [guardCloud, user]);

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      const next = { ...data.settings, ...patch };
      if (isLocalRef.current) {
        setData((prev) => ({ ...prev, settings: next }));
        return;
      }
      const { db } = await guardCloud();
      await setDoc(
        doc(db, "users", user!.uid),
        { settings: next, settingsUpdatedAt: Date.now(), settingsUpdatedBy: user!.uid },
        { merge: true },
      );
    },
    [data.settings, guardCloud, user],
  );

  const replaceAll = useCallback(
    async (payload: Partial<AppData>) => {
      const next: AppData = {
        transactions: payload.transactions || [],
        templates: payload.templates || [],
        contacts: payload.contacts || [],
        debts: payload.debts || [],
        folders: payload.folders || [],
        trash: payload.trash || [],
        settings: { ...DEFAULT_SETTINGS, ...(payload.settings || {}) },
      };
      if (isLocalRef.current) {
        setData(next);
        return;
      }
      const { db } = await guardCloud();
      const uidStr = user!.uid;
      await Promise.all([
        deleteCollection(db, `users/${uidStr}/transactions`),
        deleteCollection(db, `users/${uidStr}/templates`),
        deleteCollection(db, `users/${uidStr}/contacts`),
        deleteCollection(db, `users/${uidStr}/debts`),
        deleteCollection(db, `users/${uidStr}/folders`),
        deleteCollection(db, `users/${uidStr}/trash`),
      ]);
      const write = async <T extends { id: string }>(name: string, rows: T[]) => {
        for (let i = 0; i < rows.length; i += 300) {
          const batch = writeBatch(db);
          rows.slice(i, i + 300).forEach((row) =>
            batch.set(doc(db, "users", uidStr, name, row.id), stripId(row)),
          );
          await batch.commit();
        }
      };
      await write("transactions", next.transactions);
      await write("templates", next.templates);
      await write("contacts", next.contacts);
      await write("debts", next.debts);
      await write("folders", next.folders);
      await write("trash", next.trash);
      await setDoc(
        doc(db, "users", uidStr),
        { settings: next.settings, settingsUpdatedAt: Date.now(), settingsUpdatedBy: uidStr },
        { merge: true },
      );
    },
    [guardCloud, user],
  );

  const clearAllData = useCallback(async () => {
    if (isLocalRef.current) {
      setData((prev) => ({
        ...prev,
        transactions: [],
        templates: [],
        contacts: [],
        debts: [],
        folders: [],
        trash: [],
      }));
      return;
    }
    const { db } = await guardCloud();
    const uidStr = user!.uid;
    await Promise.all([
      deleteCollection(db, `users/${uidStr}/transactions`),
      deleteCollection(db, `users/${uidStr}/templates`),
      deleteCollection(db, `users/${uidStr}/contacts`),
      deleteCollection(db, `users/${uidStr}/debts`),
      deleteCollection(db, `users/${uidStr}/folders`),
      deleteCollection(db, `users/${uidStr}/trash`),
    ]);
  }, [guardCloud, user]);

  const value = useMemo<DataApi>(
    () => ({
      ...data,
      ready,
      isLocal,
      synced,
      error,
      addTransaction,
      addTransactionsBulk,
      updateTransaction,
      renameTransaction,
      removeTransaction,
      addTemplate,
      updateTemplate,
      removeTemplate,
      useTemplate,
      addFolder,
      updateFolder,
      removeFolder,
      removeCategory,
      addContact,
      updateContact,
      removeContact,
      addDebt,
      removeDebt,
      restoreTrash,
      deleteTrashForever,
      emptyTrash,
      updateSettings,
      replaceAll,
      clearAllData,
    }),
    [
      data,
      ready,
      isLocal,
      synced,
      error,
      addTransaction,
      addTransactionsBulk,
      updateTransaction,
      renameTransaction,
      removeTransaction,
      addTemplate,
      updateTemplate,
      removeTemplate,
      useTemplate,
      addFolder,
      updateFolder,
      removeFolder,
      removeCategory,
      addContact,
      updateContact,
      removeContact,
      addDebt,
      removeDebt,
      restoreTrash,
      deleteTrashForever,
      emptyTrash,
      updateSettings,
      replaceAll,
      clearAllData,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataApi {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside DataProvider");
  return ctx;
}

export { DATA_VERSION };
