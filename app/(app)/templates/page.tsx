"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FolderOpen,
  FolderPlus,
  Folder as FolderIcon,
  Pencil,
  Plus,
  Repeat,
  Search,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { OptionalFields } from "@/components/optional-fields";
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  Segmented,
  Select,
  Textarea,
  useToast,
} from "@/components/ui";
import { useData, type TemplateInput } from "@/lib/data";
import type { Folder, Template, TxType } from "@/lib/types";
import { cn, formatMoney, todayISO } from "@/lib/utils";

const EMOJIS = [
  "🍚", "🛒", "🚌", "🏠", "💡", "📱", "☕", "🩺",
  "📚", "👕", "🎬", "🤲", "💼", "🏪", "💻", "🎁",
  "⛽", "🧾", "💊", "🧼", "🐟", "🥬", "🛵", "🌐",
];

export default function TemplatesPage() {
  const {
    templates,
    folders,
    settings,
    addTemplate,
    updateTemplate,
    removeTemplate,
    useTemplate,
    addFolder,
    updateFolder,
    removeFolder,
  } = useData();
  const toast = useToast();
  const [q, setQ] = useState("");
  /** "all" = সব, "none" = ফোল্ডার ছাড়া, বাকি = ফোল্ডার আইডি */
  const [activeFolder, setActiveFolder] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [deleting, setDeleting] = useState<Template | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [folderFormOpen, setFolderFormOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<Folder | null>(null);

  const bengali = settings.bengaliNumerals;
  const currency = settings.currency;

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...templates]
      .filter((t) => {
        if (activeFolder === "none" && t.folderId) return false;
        if (activeFolder !== "all" && activeFolder !== "none" && t.folderId !== activeFolder)
          return false;
        return needle ? (t.name + t.category + t.note).toLowerCase().includes(needle) : true;
      })
      .sort((a, b) => (b.lastUsed || b.createdAt) - (a.lastUsed || a.createdAt));
  }, [templates, q, activeFolder]);

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

      {/* ফোল্ডার — ঐচ্ছিক: যেকোনো আইটেম ফোল্ডার ছাড়াও থাকতে পারে */}
      <div className="no-scrollbar mb-3 flex items-center gap-1.5 overflow-x-auto pb-1 overscroll-x-contain">
        <button
          type="button"
          onClick={() => setActiveFolder("all")}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-[11.5px] font-bold transition",
            activeFolder === "all"
              ? "border-brand bg-brand text-white"
              : "border-line bg-surface text-muted hover:text-ink",
          )}
        >
          সব ({templates.length})
        </button>
        {folders.map((f) => (
          <span key={f.id} className="group/folder inline-flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => setActiveFolder(f.id)}
              className={cn(
                "rounded-l-full border border-r-0 py-1.5 pl-2.5 pr-1.5 text-[11.5px] font-bold transition",
                activeFolder === f.id
                  ? "border-brand bg-brand-soft text-brand-700 dark:text-brand-300"
                  : "border-line bg-surface text-muted hover:text-ink",
              )}
            >
              {f.emoji} {f.name} ({templates.filter((t) => t.folderId === f.id).length})
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingFolder(f);
                setFolderFormOpen(true);
              }}
              aria-label={`${f.name} ফোল্ডার সম্পাদনা`}
              className={cn(
                "grid size-[30px] place-items-center rounded-r-full border transition",
                activeFolder === f.id
                  ? "border-brand bg-brand-soft text-brand-700"
                  : "border-line bg-surface text-muted hover:text-ink",
              )}
            >
              <Pencil className="size-3" />
            </button>
            <button
              type="button"
              onClick={() => setDeletingFolder(f)}
              aria-label={`${f.name} ফোল্ডার মুছুন`}
              className={cn(
                "ml-0.5 grid size-[30px] place-items-center rounded-full border transition hover:bg-danger/10 hover:text-danger",
                activeFolder === f.id ? "border-brand/40" : "border-line",
              )}
            >
              <Trash2 className="size-3" />
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => {
            setActiveFolder("none");
          }}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-[11.5px] font-bold transition",
            activeFolder === "none"
              ? "border-brand bg-brand-soft text-brand-700 dark:text-brand-300"
              : "border-line bg-surface text-muted hover:text-ink",
          )}
        >
          <FolderOpen className="mr-1 inline size-3.5" />
          ফোল্ডার ছাড়া ({templates.filter((t) => !t.folderId).length})
        </button>
        <button
          type="button"
          onClick={() => {
            setEditingFolder(null);
            setFolderFormOpen(true);
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-brand/50 px-3 py-1.5 text-[11.5px] font-bold text-brand transition hover:bg-brand-soft"
        >
          <FolderPlus className="size-3.5" /> নতুন ফোল্ডার
        </button>
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
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {t.folderId && folders.find((f) => f.id === t.folderId) && (
                    <span className="truncate rounded-full bg-brand-soft px-1.5 py-0.5 text-[10px] font-bold text-brand-700 dark:text-brand-300">
                      📁 {folders.find((f) => f.id === t.folderId)?.name}
                    </span>
                  )}
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
        folders={folders}
        defaultFolderId={
          activeFolder !== "all" && activeFolder !== "none" ? activeFolder : undefined
        }
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
        message={`“${deleting?.name}” রিসাইকেল বিনে চলে যাবে — ভুল হলে পরে ফেরত আনতে পারবেন।`}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await removeTemplate(deleting.id);
            toast("রিসাইকেল বিনে চলে গেছে");
          } catch (err) {
            toast((err as Error).message || "মুছে ফেলা যায়নি", "error");
          } finally {
            setDeleting(null);
          }
        }}
      />

      <FolderForm
        open={folderFormOpen}
        editing={editingFolder}
        onClose={() => {
          setFolderFormOpen(false);
          setEditingFolder(null);
        }}
        onSave={async (input) => {
          try {
            if (editingFolder) {
              await updateFolder(editingFolder.id, input);
              toast("ফোল্ডার আপডেট হয়েছে");
            } else {
              const created = await addFolder(input);
              setActiveFolder(created.id);
              toast("নতুন ফোল্ডার তৈরি হয়েছে");
            }
            setFolderFormOpen(false);
            setEditingFolder(null);
          } catch (err) {
            toast((err as Error).message || "সেভ করা যায়নি", "error");
          }
        }}
      />

      <ConfirmDialog
        open={!!deletingFolder}
        onClose={() => setDeletingFolder(null)}
        title="ফোল্ডার মুছে ফেলবেন?"
        message={`“${deletingFolder?.name}” বিনে যাবে। ভেতরের আইটেমগুলো মুছবে না — "ফোল্ডার ছাড়া" তালিকায় থাকবে।`}
        confirmText="ফোল্ডার মুছুন"
        onConfirm={async () => {
          if (!deletingFolder) return;
          try {
            await removeFolder(deletingFolder.id);
            if (activeFolder === deletingFolder.id) setActiveFolder("all");
            toast("ফোল্ডার রিসাইকেল বিনে চলে গেছে");
          } catch (err) {
            toast((err as Error).message || "মুছে ফেলা যায়নি", "error");
          } finally {
            setDeletingFolder(null);
          }
        }}
      />
    </div>
  );
}

function FolderForm({
  open,
  editing,
  onClose,
  onSave,
}: {
  open: boolean;
  editing: Folder | null;
  onClose: () => void;
  onSave: (input: { name: string; emoji: string; color: string }) => Promise<void>;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📁");
  const [color, setColor] = useState("#0C906A");
  const [saving, setSaving] = useState(false);
  const colors = ["#0C906A", "#8b5cf6", "#f97316", "#3b82f6", "#ec4899", "#eab308"];

  useEffect(() => {
    if (!open) return;
    setName(editing?.name || "");
    setEmoji(editing?.emoji || "📁");
    setColor(editing?.color || "#0C906A");
  }, [open, editing?.id]);

  async function submit() {
    if (!name.trim()) {
      toast("ফোল্ডারের নাম দিন", "error");
      return;
    }
    setSaving(true);
    try {
      await onSave({ name: name.trim(), emoji, color });
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
      title={editing ? "ফোল্ডার সম্পাদনা" : "নতুন ফোল্ডার"}
      subtitle="যেমন: ভাড়া, খাবার, অন্যান্য পণ্য — চাইলে ফোল্ডার ছাড়াও রাখতে পারবেন"
      footer={
        <Button block size="lg" loading={saving} onClick={submit}>
          {editing ? "আপডেট করুন" : "ফোল্ডার বানান"}
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2.5">
          <span
            className="grid size-12 shrink-0 place-items-center rounded-2xl text-2xl"
            style={{ backgroundColor: `${color}22` }}
          >
            {emoji}
          </span>
          <div className="flex-1">
            <Field label="ফোল্ডারের নাম">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="যেমন: ভাড়া"
              />
            </Field>
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-ink/80">আইকন</p>
          <div className="no-scrollbar flex flex-wrap gap-1.5">
            {["📁", "🏠", "🍚", "🛒", "🚌", "💡", "👕", "💊", "🎁", "📦", "🧾", "💼"].map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className={cn(
                  "grid size-9 place-items-center rounded-xl border text-lg transition",
                  emoji === e ? "border-brand bg-brand-soft" : "border-line bg-surface hover:bg-surface-2",
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-ink/80">রঙ</p>
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`রঙ ${c}`}
                className={cn(
                  "size-8 rounded-full border-2 transition",
                  color === c ? "scale-110 border-ink" : "border-transparent",
                )}
                style={{ backgroundColor: c }}
              >
                {color === c && <FolderIcon className="size-4 text-white" />}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function TemplateForm({
  open,
  editing,
  folders,
  defaultFolderId,
  onClose,
  onSave,
}: {
  open: boolean;
  editing: Template | null;
  folders: Folder[];
  defaultFolderId?: string;
  onClose: () => void;
  onSave: (input: TemplateInput) => Promise<void>;
}) {
  const { settings } = useData();
  const toast = useToast();
  const [type, setType] = useState<TxType>("expense");
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🛒");
  const [folderId, setFolderId] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [account, setAccount] = useState("");
  const [note, setNote] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [familyMember, setFamilyMember] = useState("");
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
      setQuantity(editing.quantity ? String(editing.quantity) : "");
      setUnit(editing.unit || "");
      setFamilyMember(editing.familyMember || "");
      setFolderId(editing.folderId || "");
    } else {
      setType("expense");
      setName("");
      setEmoji("🛒");
      setFolderId(defaultFolderId || "");
      setAmount("");
      setCategory(settings.categories.find((c) => c.type === "expense")?.name || "");
      setAccount(settings.accounts[0] || "ক্যাশ");
      setNote("");
      setQuantity("");
      setUnit("");
      setFamilyMember("");
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
        folderId: folderId || undefined,
        quantity: quantity ? Number(quantity) : undefined,
        unit: unit || undefined,
        familyMember: familyMember || undefined,
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

        <Field label="ফোল্ডার (ঐচ্ছিক)" hint="ফোল্ডার না দিলেও কাজ চলবে">
          <Select value={folderId} onChange={(e) => setFolderId(e.target.value)}>
            <option value="">ফোল্ডার ছাড়া</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.emoji} {f.name}
              </option>
            ))}
          </Select>
        </Field>

        <OptionalFields
          quantity={quantity}
          unit={unit}
          familyMember={familyMember}
          onQuantity={setQuantity}
          onUnit={setUnit}
          onFamilyMember={setFamilyMember}
        />

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
