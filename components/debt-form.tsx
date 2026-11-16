"use client";

import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, RotateCcw } from "lucide-react";
import { useData } from "@/lib/data";
import { DEBT_LABEL, type DebtKind } from "@/lib/types";
import { cn, todayISO } from "@/lib/utils";
import { Button, Field, Input, Modal, Switch, Textarea, useToast } from "./ui";

const KINDS: { kind: DebtKind; icon: typeof ArrowUpRight; hint: string }[] = [
  { kind: "lent", icon: ArrowUpRight, hint: "আমি টাকা দিলাম" },
  { kind: "borrowed", icon: ArrowDownLeft, hint: "আমি টাকা নিলাম" },
  { kind: "lent_repaid", icon: CheckCircle2, hint: "পাওনা ফেরত পেলাম" },
  { kind: "borrowed_repaid", icon: RotateCcw, hint: "দেনা শোধ করলাম" },
];

export function DebtFormModal({
  open,
  onClose,
  contactId,
  contactName,
  defaultKind = "lent",
}: {
  open: boolean;
  onClose: () => void;
  contactId: string;
  contactName: string;
  defaultKind?: DebtKind;
}) {
  const { addDebt, settings } = useData();
  const toast = useToast();
  const [kind, setKind] = useState<DebtKind>(defaultKind);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [addToCash, setAddToCash] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setKind(defaultKind);
    setAmount("");
    setDate(todayISO());
    setNote("");
    setAddToCash(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultKind]);

  async function submit() {
    const value = Number(amount);
    if (!value || value <= 0) {
      toast("টাকার পরিমাণ দিন", "error");
      return;
    }
    setSaving(true);
    try {
      await addDebt({
        contactId,
        contactName,
        kind,
        amount: value,
        note: note.trim(),
        date,
        addToCash,
      });
      toast("দেনা-পাওনায় যোগ হয়েছে");
      onClose();
    } catch (err) {
      toast((err as Error).message || "সেভ করা যায়নি", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${contactName} — নতুন এন্ট্রি`}
      subtitle="দেনা-পাওনার খাতায় লিখে রাখুন"
      footer={
        <Button block size="lg" loading={saving} onClick={submit}>
          সেভ করুন
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {KINDS.map((k) => {
            const Icon = k.icon;
            const active = kind === k.kind;
            return (
              <button
                key={k.kind}
                type="button"
                onClick={() => setKind(k.kind)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition",
                  active
                    ? "border-brand bg-brand-soft text-brand-700 dark:text-brand-300"
                    : "border-line bg-surface text-ink hover:bg-surface-2",
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="text-[11.5px] font-bold leading-tight">
                  {DEBT_LABEL[k.kind]}
                </span>
              </button>
            );
          })}
        </div>

        <Field label={`টাকার পরিমাণ (${settings.currency})`}>
          <Input
            autoFocus
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder="0"
            className="h-14 text-center text-2xl font-extrabold"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="তারিখ">
            <Input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value || todayISO())} />
          </Field>
          <Field label="নোট (ঐচ্ছিক)">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="কারণ" />
          </Field>
        </div>

        <div className="rounded-2xl border border-dashed border-line bg-surface-2/60 p-3.5">
          <Switch
            checked={addToCash}
            onChange={setAddToCash}
            label="ক্যাশ হিসাবেও যোগ করুন"
            description="টাকা হাতবদল হয়েছে, তাই মূল লেনদেনেও দেখাবে"
          />
        </div>
      </div>
    </Modal>
  );
}
