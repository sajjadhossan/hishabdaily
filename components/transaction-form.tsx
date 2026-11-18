"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, Trash2, Zap } from "lucide-react";
import { useData, type TxInput } from "@/lib/data";
import { formatMoney, todayISO, isoDate, cn } from "@/lib/utils";
import type { Transaction, TxType } from "@/lib/types";
import {
  Button,
  ConfirmDialog,
  Field,
  Input,
  Modal,
  Segmented,
  Switch,
  Textarea,
  useToast,
} from "./ui";

const QUICK_AMOUNTS = [50, 100, 200, 500, 1000];

export function TransactionForm({
  open,
  onClose,
  editing,
  preset,
}: {
  open: boolean;
  onClose: () => void;
  editing?: Transaction | null;
  preset?: Partial<TxInput>;
}) {
  const { settings, addTransaction, updateTransaction, removeTransaction, addTemplate } = useData();
  const toast = useToast();

  const [type, setType] = useState<TxType>("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [account, setAccount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [asTemplate, setAsTemplate] = useState(false);
  const [tplName, setTplName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const categories = useMemo(
    () => settings.categories.filter((c) => c.type === type || c.type === "both"),
    [settings.categories, type],
  );

  const currency = settings.currency;

  useEffect(() => {
    if (!open) return;
    const src: Partial<TxInput> = editing ?? preset ?? {};
    const nextType: TxType = src.type ?? "expense";
    const cats = settings.categories.filter(
      (c) => c.type === nextType || c.type === "both",
    );
    setType(nextType);
    setAmount(src.amount ? String(src.amount) : "");
    setCategory(src.category ?? cats[0]?.name ?? "");
    setAccount(src.account ?? settings.accounts[0] ?? "ক্যাশ");
    setDate(src.date ?? todayISO());
    setNote(src.note ?? "");
    setAsTemplate(false);
    setTplName("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  function switchType(next: TxType) {
    setType(next);
    const cats = settings.categories.filter((c) => c.type === next || c.type === "both");
    if (!cats.some((c) => c.name === category)) setCategory(cats[0]?.name ?? "");
  }

  const activeCategory = settings.categories.find((c) => c.name === category);

  async function handleSave() {
    const value = Number(amount);
    if (!value || value <= 0) {
      toast("টাকার পরিমাণ সঠিকভাবে লিখুন", "error");
      return;
    }
    if (!category) {
      toast("একটি খাত বেছে নিন", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        type,
        amount: value,
        category,
        account: account || settings.accounts[0] || "ক্যাশ",
        note: note.trim(),
        date,
      };
      if (editing) {
        await updateTransaction(editing.id, payload);
        toast("লেনদেন আপডেট হয়েছে");
      } else {
        await addTransaction(payload);
        if (asTemplate) {
          await addTemplate({
            name: tplName.trim() || note.trim() || category,
            emoji: activeCategory?.emoji || "🔁",
            type,
            amount: value,
            category,
            account: payload.account,
            note: payload.note,
          });
        }
        toast(asTemplate ? "লেনদেন যোগ হয়েছে ও নিয়মিত তালিকায় সেভ হয়েছে" : "লেনদেন যোগ হয়েছে");
      }
      onClose();
    } catch (err) {
      toast((err as Error).message || "সেভ করা যায়নি", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editing) return;
    setDeleting(true);
    try {
      await removeTransaction(editing.id);
      toast("লেনদেন মুছে ফেলা হয়েছে");
      setConfirmDelete(false);
      onClose();
    } catch (err) {
      toast((err as Error).message || "মুছে ফেলা যায়নি", "error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={editing ? "লেনদেন সম্পাদনা" : "নতুন লেনদেন"}
        subtitle={editing ? "তথ্য বদলে সেভ করুন" : "যা খরচ বা আয় করেছেন, লিখে রাখুন"}
        footer={
          <div className="flex gap-2">
            {editing ? (
              <Button
                variant="outline"
                className="!px-3 text-danger"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="size-4" />
              </Button>
            ) : null}
            <Button block size="lg" loading={saving} onClick={handleSave}>
              {editing ? "আপডেট করুন" : "যোগ করুন"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Segmented
            value={type}
            onChange={switchType}
            options={[
              { value: "expense", label: "খরচ" },
              { value: "income", label: "আয়" },
            ]}
          />

          <div className="rounded-2xl bg-surface-2 px-4 py-5">
            <p className="text-center text-[11px] font-semibold uppercase tracking-wider text-muted">
              কত টাকা?
            </p>
            <div className="mt-1 flex items-center justify-center gap-1.5">
              <span
                className={cn(
                  "text-2xl font-bold",
                  type === "expense" ? "text-ink/50" : "text-brand",
                )}
              >
                {currency}
              </span>
              <input
                autoFocus
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="0"
                className="tabular w-full max-w-[240px] bg-transparent text-center text-[38px] font-extrabold leading-none tracking-tight text-ink outline-none placeholder:text-muted/40"
              />
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {QUICK_AMOUNTS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setAmount(String(q))}
                  className="rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-semibold text-muted transition hover:border-brand/40 hover:text-ink"
                >
                  {formatMoney(q, { currency, bengali: settings.bengaliNumerals })}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[13px] font-semibold text-ink/80">খাত</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {categories.map((c) => {
                const active = c.name === category;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.name)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl border px-1 py-2.5 transition",
                      active
                        ? "border-brand bg-brand-soft text-brand-700 dark:text-brand-300"
                        : "border-line bg-surface text-ink hover:bg-surface-2",
                    )}
                  >
                    <span className="text-lg leading-none">{c.emoji}</span>
                    <span className="w-full truncate text-center text-[11px] font-semibold">
                      {c.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[13px] font-semibold text-ink/80">কোথা থেকে / কোথায়</p>
            <div className="flex flex-wrap gap-1.5">
              {settings.accounts.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAccount(a)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition",
                    account === a
                      ? "border-brand bg-brand-soft text-brand-700 dark:text-brand-300"
                      : "border-line bg-surface text-muted hover:text-ink",
                  )}
                >
                  {account === a ? <Check className="size-3" /> : null}
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="তারিখ">
              <Input
                type="date"
                value={date}
                max={isoDate(new Date())}
                onChange={(e) => setDate(e.target.value || todayISO())}
              />
            </Field>
            <Field label="নোট (ঐচ্ছিক)">
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="যেমন: দুপুরের খাবার"
              />
            </Field>
          </div>

          {!editing ? (
            <div className="rounded-2xl border border-dashed border-line bg-surface-2/60 p-3.5">
              <Switch
                checked={asTemplate}
                onChange={(v) => {
                  setAsTemplate(v);
                  if (v && !tplName) setTplName(note.trim() || category);
                }}
                label="নিয়মিত কেনাকাটায় সেভ করুন"
                description="পরে এক ক্লিকেই একই লেনদেন যোগ করতে পারবেন"
              />
              {asTemplate ? (
                <div className="mt-3 flex items-center gap-2">
                  <Zap className="size-4 shrink-0 text-brand" />
                  <Input
                    value={tplName}
                    onChange={(e) => setTplName(e.target.value)}
                    placeholder="নাম দিন, যেমন: সকালের নাস্তা"
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <p className="flex items-center gap-1.5 text-[11px] text-muted">
              <CalendarDays className="size-3.5" />
              তৈরি: {new Date(editing.createdAt).toLocaleDateString("bn-BD")}
            </p>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="লেনদেন মুছে ফেলবেন?"
        message="এটি রিসাইকেল বিনে জমা হবে — ভুল হলে পরে ফেরত আনতে পারবেন।"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  );
}
