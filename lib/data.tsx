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
import { DEFAULT_SETTINGS, isoDate, uid } from "./utils";
import {
  DATA_VERSION,
  type AppData,
  type Contact,
  type Debt,
  type DebtKind,
  type Settings,
  type Template,
  type Transaction,
} from "./types";

export type TxInput = Pick<
  Transaction,
  "type" | "amount" | "category" | "account" | "note" | "date"
> & { templateId?: string };

export type TemplateInput = Omit<Template, "id" | "createdAt" | "uses" | "lastUsed">;
export type ContactInput = Omit<Contact, "id" | "createdAt">;
export type DebtInput = Omit<Debt, "id" | "createdAt" | "contactName" | "txId"> & {
  contactName?: string;
  addToCash?: boolean;
};

interface DataApi extends AppData {
  ready: boolean;
  isLocal: boolean;
  error: string | null;
  addTransaction: (input: TxInput) => Promise<Transaction>;
  updateTransaction: (id: string, patch: Partial<TxInput>) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
  addTemplate: (input: TemplateInput) => Promise<Template>;
  updateTemplate: (id: string, patch: Partial<TemplateInput>) => Promise<void>;
  removeTemplate: (id: string) => Promise<void>;
  useTemplate: (id: string) => Promise<Transaction | null>;
  addContact: (input: ContactInput) => Promise<Contact>;
  updateContact: (id: string, patch: Partial<ContactInput>) => Promise<void>;
  removeContact: (id: string) => Promise<void>;
  addDebt: (input: DebtInput) => Promise<Debt>;
  removeDebt: (id: string) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  replaceAll: (payload: Partial<AppData>) => Promise<void>;
  clearAllData: () => Promise<void>;
}

const EMPTY: AppData = {
  transactions: [],
  templates: [],
  contacts: [],
  debts: [],
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

  const templates: Template[] = [
    {
      id: uid(),
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

  return { transactions, templates, contacts, debts, settings: DEFAULT_SETTINGS };
}

/* ──────────────────────────  হেল্পার  ────────────────────────── */

function stripId<T extends { id: string }>(obj: T): Omit<T, "id"> {
  const { id: _id, ...rest } = obj;
  return rest as Omit<T, "id">;
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

/* ──────────────────────────  প্রোভাইডার  ────────────────────────── */

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, cloudAvailable } = useAuth();
  const [data, setData] = useState<AppData>(EMPTY);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isLocal = !user || user.demo || !cloudAvailable;
  const isLocalRef = useRef(isLocal);
  isLocalRef.current = isLocal;

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
      const done = () => {
        arrived++;
        if (arrived >= 5 && active) setReady(true);
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

      const watch = <K extends "transactions" | "templates" | "contacts" | "debts">(name: K) => {
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

  const addTransaction = useCallback(
    async (input: TxInput): Promise<Transaction> => {
      const tx: Transaction = {
        id: uid(),
        ...input,
        amount: Number(input.amount) || 0,
        createdAt: Date.now(),
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

  const updateTransaction = useCallback(
    async (id: string, patch: Partial<TxInput>) => {
      const clean = { ...patch, updatedAt: Date.now() };
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
      await updateDoc(doc(db, "users", user!.uid, "transactions", id), clean);
    },
    [guardCloud, user],
  );

  const removeTransaction = useCallback(
    async (id: string) => {
      if (isLocalRef.current) {
        setData((prev) => ({ ...prev, transactions: prev.transactions.filter((t) => t.id !== id) }));
        return;
      }
      const { db } = await guardCloud();
      await deleteDoc(doc(db, "users", user!.uid, "transactions", id));
    },
    [guardCloud, user],
  );

  const addTemplate = useCallback(
    async (input: TemplateInput): Promise<Template> => {
      const tpl: Template = { id: uid(), ...input, uses: 0, createdAt: Date.now() };
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
      await updateDoc(doc(db, "users", user!.uid, "templates", id), patch);
    },
    [guardCloud, user],
  );

  const removeTemplate = useCallback(
    async (id: string) => {
      if (isLocalRef.current) {
        setData((prev) => ({ ...prev, templates: prev.templates.filter((t) => t.id !== id) }));
        return;
      }
      const { db } = await guardCloud();
      await deleteDoc(doc(db, "users", user!.uid, "templates", id));
    },
    [guardCloud, user],
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
        }).catch(() => undefined);
      }
      return tx;
    },
    [addTransaction, data.templates, guardCloud, updateTemplate, user],
  );

  const addContact = useCallback(
    async (input: ContactInput): Promise<Contact> => {
      const contact: Contact = { id: uid(), ...input, createdAt: Date.now() };
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
      batch.update(doc(db, "users", user!.uid, "contacts", id), patch);
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
      if (isLocalRef.current) {
        setData((prev) => ({
          ...prev,
          contacts: prev.contacts.filter((c) => c.id !== id),
          debts: prev.debts.filter((d) => d.contactId !== id),
        }));
        return;
      }
      const { db } = await guardCloud();
      const related = data.debts.filter((d) => d.contactId === id);
      const batch = writeBatch(db);
      related.forEach((d) => batch.delete(doc(db, "users", user!.uid, "debts", d.id)));
      batch.delete(doc(db, "users", user!.uid, "contacts", id));
      await batch.commit();
    },
    [data.debts, guardCloud, user],
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
      if (isLocalRef.current) {
        setData((prev) => ({
          ...prev,
          debts: prev.debts.filter((d) => d.id !== id),
          transactions: debt?.txId
            ? prev.transactions.filter((t) => t.id !== debt.txId)
            : prev.transactions,
        }));
        return;
      }
      const { db } = await guardCloud();
      const batch = writeBatch(db);
      if (debt?.txId) batch.delete(doc(db, "users", user!.uid, "transactions", debt.txId));
      batch.delete(doc(db, "users", user!.uid, "debts", id));
      await batch.commit();
    },
    [data.debts, guardCloud, user],
  );

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      const next = { ...data.settings, ...patch };
      if (isLocalRef.current) {
        setData((prev) => ({ ...prev, settings: next }));
        return;
      }
      const { db } = await guardCloud();
      await setDoc(doc(db, "users", user!.uid), { settings: next }, { merge: true });
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
      await setDoc(doc(db, "users", uidStr), { settings: next.settings }, { merge: true });
    },
    [guardCloud, user],
  );

  const clearAllData = useCallback(async () => {
    if (isLocalRef.current) {
      setData((prev) => ({ ...prev, transactions: [], templates: [], contacts: [], debts: [] }));
      return;
    }
    const { db } = await guardCloud();
    const uidStr = user!.uid;
    await Promise.all([
      deleteCollection(db, `users/${uidStr}/transactions`),
      deleteCollection(db, `users/${uidStr}/templates`),
      deleteCollection(db, `users/${uidStr}/contacts`),
      deleteCollection(db, `users/${uidStr}/debts`),
    ]);
  }, [guardCloud, user]);

  const value = useMemo<DataApi>(
    () => ({
      ...data,
      ready,
      isLocal,
      error,
      addTransaction,
      updateTransaction,
      removeTransaction,
      addTemplate,
      updateTemplate,
      removeTemplate,
      useTemplate,
      addContact,
      updateContact,
      removeContact,
      addDebt,
      removeDebt,
      updateSettings,
      replaceAll,
      clearAllData,
    }),
    [
      data,
      ready,
      isLocal,
      error,
      addTransaction,
      updateTransaction,
      removeTransaction,
      addTemplate,
      updateTemplate,
      removeTemplate,
      useTemplate,
      addContact,
      updateContact,
      removeContact,
      addDebt,
      removeDebt,
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
