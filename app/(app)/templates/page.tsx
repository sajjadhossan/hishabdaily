"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Pencil,
  Plus,
  Repeat,
  Search,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  Segmented,
  Textarea,
  useToast,
} from "@/components/ui";
import { useData, type TemplateInput } from "@/lib/data";
import type { Template, TxType } from "@/lib/types";
import { cn, formatMoney, todayISO } from "@/lib/utils";

const EMOJIS = [
  "🍚", "🛒", "🚌", "🏠", "💡", "📱", "☕", "🩺",
  "📚", "👕", "🎬", "🤲", "💼", "🏪", "💻", "🎁",
  "⛽", "🧾", "💊", "🧼", "🐟", "🥬", "🛵", "🌐",
];

export default function TemplatesPage() {
  const { templates, settings, addTemplate, updateTemplate, removeTemplate, useTemplate } =
    useData();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [deleting, setDeleting] = useState<Template | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const bengali = settings.bengaliNumerals;
  const currency = settings.currency;

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...templates]
      .filter((t) => (needle ? (t.name + t.category + t.note).toLowerCase().includes(needle) : true))
      .sort((a, b) => (b.lastUsed || b.createdAt) - (a.lastUsed || a.createdAt));
  }, [templates, q]);

  const monthlyEstimate = useMemo(
    () =>
      templates
        .filter((t) => t.type === "expense")
        .reduce((a, t) => a + t.amount, 0),
    [templates],
  );

  async function quickAdd(t: Template) {
    setBusyId(t.id);
    try {
      await useTemplate(t.id);
      toast(`যোগ হয়েছে: ${t.name} · ${formatMoney(t.amount, { currency, bengali })}`);
    } catch (err) {
      toast((err as Error).message || "যোগ করা যায়নি", "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="নিয়মিত কেনাকাটা"
        subtitle="এক ট্যাপে আবার যোগ করুন — বারবার লিখতে হবে না"
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" /> নতুন
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2.5">
        <Card className="p-3.5">
          <p className="flex items-center gap-1.5 text-[10.5px] font-semibold text-muted">
            <Repeat className="size-3.5 text-brand" /> সেভ করা আছে
          </p>
          <p className="tabular mt-1 text-[16px] font-extrabold text-ink">
            {templates.length}টি
          </p>
        </Card>
        <Card className="p-3.5">
          <p className="flex items-center gap-1.5 text-[10.5px] font-semibold text-muted">
            <Zap className="size-3.5 text-warn" /> সব একবার চালালে
          </p>
          <p className="tabular mt-1 text-[16px] font-extrabold text-ink">
            {formatMoney(monthlyEstimate, { currency, bengali })}
          </p>
        </Card>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="টেমপ্লেট খুঁজুন…"
          className="bg-surface pl-9"
        />
      </div>

      {list.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((t) => (
            <div
              key={t.id}
              className="group relative overflow-hidden rounded-2xl border border-line bg-surface p-3.5 shadow-card transition hover:border-brand/40"
            >
              <button
                onClick={() => quickAdd(t)}
                disabled={busyId === t.id}
                className="block w-full text-left disabled:opacity-60"
                aria-label={`${t.name} যোগ করুন`}
              >
                <div className="flex items-start justify-between">
                  <span className="grid size-11 place-items-center rounded-2xl bg-brand-soft text-[21px]">
                    {t.emoji}
                  </span>
                  <span className="grid size-8 place-items-center rounded-full bg-brand text-white shadow-sm transition active:scale-90">
                    <Plus className="size-4" strokeWidth={2.6} />
                  </span>
                </div>
                <p className="mt-2.5 truncate text-[13px] font-bold text-ink">{t.name}</p>
                <p className="tabular mt-0.5 text-[12px] font-semibold text-muted">
                  {formatMoney(t.amount, { currency, bengali })}
                </p>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="truncate rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                    {t.category}
                  </span>
                  <span className="text-[10px] text-muted">{t.uses} বার</span>
                </div>
              </button>

              <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2">
                <span className="text-[10px] font-medium text-muted">{t.account}</span>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => {
                      setEditing(t);
                      setFormOpen(true);
                    }}
                    aria-label="সম্পাদনা"
                    className="grid size-7 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleting(t)}
                    aria-label="মুছুন"
                    className="grid size-7 place-items-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={Sparkles}
            title={q ? "কিছু পাওয়া যায়নি" : "এখনো কিছু সেভ করা হয়নি"}
            message="প্রতিদিনের চা, রিকশা ভাড়া বা বাজার — একবার সেভ করলে পরে এক ট্যাপেই যোগ হবে।"
            action={
              <Button
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="size-4" /> প্রথমটি সেভ করুন
              </Button>
            }
          />
        </Card>
      )}

      <TemplateForm
        open={formOpen}
        editing={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSave={async (input) => {
          if (editing) {
            await updateTemplate(editing.id, input);
            toast("আপডেট হয়েছে");
          } else {
            await addTemplate(input);
            toast("নিয়মিত তালিকায় সেভ হয়েছে");
          }
          setFormOpen(false);
          setEditing(null);
        }}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="টেমপ্লেট মুছে ফেলবেন?"
        message={`“${deleting?.name}” মুছে গেলে পরে আর এক ট্যাপে যোগ করা যাবে না।`}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await removeTemplate(deleting.id);
            toast("মুছে ফেলা হয়েছে");
          } catch (err) {
            toast((err as Error).message || "মুছে ফেলা যায়নি", "error");
          } finally {
            setDeleting(null);
          }
        }}
      />
    </div>
  );
}

function TemplateForm({
  open,
  editing,
  onClose,
  onSave,
}: {
  open: boolean;
  editing: Template | null;
  onClose: () => void;
  onSave: (input: TemplateInput) => Promise<void>;
}) {
  const { settings } = useData();
  const toast = useToast();
  const [type, setType] = useState<TxType>("expense");
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🛒");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [account, setAccount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const categories = useMemo(
    () => settings.categories.filter((c) => c.type === type || c.type === "both"),
    [settings.categories, type],
  );

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setType(editing.type);
      setName(editing.name);
      setEmoji(editing.emoji);
      setAmount(String(editing.amount));
      setCategory(editing.category);
      setAccount(editing.account);
      setNote(editing.note);
    } else {
      setType("expense");
      setName("");
      setEmoji("🛒");
      setAmount("");
      setCategory(settings.categories.find((c) => c.type === "expense")?.name || "");
      setAccount(settings.accounts[0] || "ক্যাশ");
      setNote("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  function changeType(next: TxType) {
    setType(next);
    const cats = settings.categories.filter((c) => c.type === next || c.type === "both");
    if (!cats.some((c) => c.name === category)) setCategory(cats[0]?.name || "");
  }

  async function submit() {
    if (!name.trim()) {
      toast("টেমপ্লেটের নাম দিন", "error");
      return;
    }
    if (!Number(amount)) {
      toast("টাকার পরিমাণ দিন", "error");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        emoji,
        type,
        amount: Number(amount),
        category,
        account,
        note: note.trim(),
      });
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
      title={editing ? "টেমপ্লেট সম্পাদনা" : "নতুন নিয়মিত কেনাকাটা"}
      subtitle="নাম ও টাকা দিয়ে রাখুন, পরে এক ট্যাপেই যোগ হবে"
      footer={
        <Button block size="lg" loading={saving} onClick={submit}>
          {editing ? "আপডেট করুন" : "সেভ করুন"}
        </Button>
      }
    >
      <div className="space-y-4">
        <Segmented
          value={type}
          onChange={changeType}
          options={[
            { value: "expense", label: "খরচ" },
            { value: "income", label: "আয়" },
          ]}
        />

        <div className="flex items-center gap-2.5">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-2xl">
            {emoji}
          </span>
          <div className="flex-1">
            <Field label="নাম">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="যেমন: সকালের নাস্তা"
              />
            </Field>
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-ink/80">আইকন</p>
          <div className="no-scrollbar flex flex-wrap gap-1.5">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className={cn(
                  "grid size-9 place-items-center rounded-xl border text-lg transition",
                  emoji === e
                    ? "border-brand bg-brand-soft"
                    : "border-line bg-surface hover:bg-surface-2",
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label={`টাকা (${settings.currency})`}>
            <Input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="0"
            />
          </Field>
          <Field label="তারিখ (স্বয়ংক্রিয়)">
            <Input value={todayISO()} readOnly className="text-muted" />
          </Field>
        </div>

        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-ink/80">খাত</p>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.name)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[12px] font-semibold transition",
                  category === c.name
                    ? "border-brand bg-brand-soft text-brand-700 dark:text-brand-300"
                    : "border-line bg-surface text-muted hover:text-ink",
                )}
              >
                <span>{c.emoji}</span> {c.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-ink/80">অ্যাকাউন্ট</p>
          <div className="flex flex-wrap gap-1.5">
            {settings.accounts.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAccount(a)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[12px] font-semibold transition",
                  account === a
                    ? "border-brand bg-brand-soft text-brand-700 dark:text-brand-300"
                    : "border-line bg-surface text-muted hover:text-ink",
                )}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <Field label="নোট (ঐচ্ছিক)">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="যেমন: প্রতিদিন সকালে"
            className="min-h-[70px]"
          />
        </Field>
      </div>
    </Modal>
  );
}
