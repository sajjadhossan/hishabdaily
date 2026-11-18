"use client";

import { CalendarDays, Pencil, StickyNote, Tag, Trash2, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, ConfirmDialog, Field, IconButton, Input, Modal, useToast } from "@/components/ui";
import { useData } from "@/lib/data";
import type { Transaction } from "@/lib/types";
import { formatDate, formatMoney, weekdayOf } from "@/lib/utils";

/**
 * লেনদেনের বিশদ দেখা + নাম বদলানো + মুছে ফেলা।
 * মুছলে জিনিসটি চিরতরে না গিয়ে রিসাইকেল বিনে জমা হয়।
 */
export function TransactionDetail({
  tx,
  onClose,
  onEdit,
}: {
  tx: Transaction | null;
  onClose: () => void;
  onEdit: (tx: Transaction) => void;
}) {
  const { settings, renameTransaction, removeTransaction } = useData();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const currency = settings.currency;
  const bengali = settings.bengaliNumerals;

  useEffect(() => {
    if (tx) setTitle(tx.title || "");
  }, [tx]);

  async function saveTitle() {
    if (!tx) return;
    setSaving(true);
    try {
      await renameTransaction(tx.id, title);
      toast(title.trim() ? "নাম বদলে গেছে" : "নাম সরিয়ে দেওয়া হয়েছে");
    } catch (err) {
      toast((err as Error).message || "নাম বদলানো যায়নি", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!tx) return;
    setDeleting(true);
    try {
      await removeTransaction(tx.id);
      toast("লেনদেন রিসাইকেল বিনে চলে গেছে");
      setConfirmDelete(false);
      onClose();
    } catch (err) {
      toast((err as Error).message || "মুছে ফেলা যায়নি", "error");
    } finally {
      setDeleting(false);
    }
  }

  const rows = tx
    ? [
        { icon: Tag, label: "খাত", value: tx.category },
        { icon: Wallet, label: "অ্যাকাউন্ট", value: tx.account || "ক্যাশ" },
        {
          icon: CalendarDays,
          label: "তারিখ",
          value: `${formatDate(tx.date, bengali, true)} · ${weekdayOf(tx.date)}`,
        },
        { icon: StickyNote, label: "নোট", value: tx.note || "—" },
      ]
    : [];

  return (
    <>
      <Modal
        open={!!tx}
        onClose={onClose}
        title="লেনদেনের বিশদ"
        subtitle="নাম বদলাতে পারবেন, ভুল হলে বিন থেকে ফেরত আনতে পারবেন"
        footer={
          <div className="flex items-center gap-2">
            <IconButton
              label="মুছে ফেলুন"
              onClick={() => setConfirmDelete(true)}
              className="border border-line text-danger hover:bg-danger/10 hover:text-danger"
            >
              <Trash2 className="size-4" />
            </IconButton>
            <Button
              variant="soft"
              onClick={() => tx && onEdit(tx)}
              className="flex-1"
            >
              <Pencil className="size-4" /> সম্পাদনা
            </Button>
            <Button onClick={saveTitle} loading={saving} className="flex-1">
              নাম সংরক্ষণ
            </Button>
          </div>
        }
      >
        {tx && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-surface-2 p-4 text-center">
              <p className="text-[11px] font-semibold text-muted">
                {tx.type === "income" ? "আয়" : "খরচ"}
              </p>
              <p className="tabular mt-0.5 text-[26px] font-extrabold text-ink">
                {tx.type === "income" ? "+" : "−"}
                {formatMoney(tx.amount, { currency, bengali })}
              </p>
            </div>

            <Field label="লেনদেনের নাম (রিনেম)" hint="নাম দিলে তালিকায় এটাই দেখা যাবে">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="যেমন: বাসা ভাড়া — জুলাই"
              />
            </Field>

            <div className="divide-y divide-line rounded-2xl border border-line">
              {rows.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-2.5 px-3.5 py-2.5">
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted" />
                  <span className="w-[74px] shrink-0 text-[11.5px] font-semibold text-muted">
                    {label}
                  </span>
                  <span className="min-w-0 flex-1 break-words text-[12.5px] font-semibold text-ink">
                    {value}
                  </span>
                </div>
              ))}
            </div>

            <p className="text-[10.5px] text-muted">
              তৈরি: {new Date(tx.createdAt).toLocaleDateString("bn-BD")}
              {tx.templateId ? " · নিয়মিত তালিকা থেকে যোগ করা" : ""}
            </p>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="লেনদেন মুছে ফেলবেন?"
        message="এটি রিসাইকেল বিনে জমা হবে। ভুল হলে পরে ওখান থেকে ফেরত আনতে পারবেন।"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  );
}
