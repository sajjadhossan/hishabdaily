"use client";

import { Archive, Info, RotateCcw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  IconButton,
  useToast,
} from "@/components/ui";
import { useData } from "@/lib/data";
import { TRASH_EMOJI, TRASH_LABEL, type TrashItem, type TrashKind } from "@/lib/types";
import { cn } from "@/lib/utils";

type KindFilter = "all" | TrashKind;

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export default function RecycleBinPage() {
  const { trash, restoreTrash, deleteTrashForever, emptyTrash } = useData();
  const toast = useToast();
  const [kind, setKind] = useState<KindFilter>("all");
  const [restoring, setRestoring] = useState<TrashItem | null>(null);
  const [deleting, setDeleting] = useState<TrashItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const kinds = useMemo(() => {
    const set = new Set<TrashKind>();
    trash.forEach((t) => {
      set.add(t.kind);
    });
    return [...set];
  }, [trash]);

  const shown = useMemo(
    () =>
      [...trash]
        .filter((t) => (kind === "all" ? true : t.kind === kind))
        .sort((a, b) => b.deletedAt - a.deletedAt),
    [trash, kind],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, TrashItem[]>();
    for (const item of shown) {
      const key = dayKey(item.deletedAt);
      const arr = map.get(key) || [];
      arr.push(item);
      map.set(key, arr);
    }
    return [...map.entries()];
  }, [shown]);

  async function handleRestore() {
    if (!restoring) return;
    setBusy(true);
    try {
      const inBatch = restoring.batchId
        ? trash.filter((t) => t.batchId === restoring.batchId).length
        : 1;
      await restoreTrash(restoring.id);
      toast(inBatch > 1 ? `${inBatch}টি আইটেম ফেরত এসেছে` : "আইটেম ফেরত এসেছে");
      setRestoring(null);
    } catch (err) {
      toast((err as Error).message || "ফেরত আনা যায়নি", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteForever() {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteTrashForever(deleting.id);
      toast("চিরতরে মুছে ফেলা হয়েছে");
      setDeleting(null);
    } catch (err) {
      toast((err as Error).message || "মুছে ফেলা যায়নি", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleEmpty() {
    setBusy(true);
    try {
      await emptyTrash();
      toast("রিসাইকেল বিন খালি হয়ে গেছে");
      setConfirmEmpty(false);
    } catch (err) {
      toast((err as Error).message || "বিন খালি করা যায়নি", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="রিসাইকেল বিন"
        subtitle={`${trash.length}টি আইটেম জমা আছে — চাইলে ফেরত আনুন`}
        action={
          trash.length > 0 ? (
            <Button variant="danger" size="sm" onClick={() => setConfirmEmpty(true)}>
              <Trash2 className="size-4" /> বিন খালি করুন
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex items-start gap-2 rounded-2xl border border-line bg-surface-2/60 p-3 text-[11.5px] leading-relaxed text-muted">
        <Info className="mt-0.5 size-4 shrink-0 text-brand" />
        <p>
          মুছে ফেলা জিনিস এখানে জমা থাকে। <b className="text-ink">ফেরত আনুন</b> দিলে আবার আগের
          জায়গায় চলে যাবে। বিন খালি করলে আর ফেরত আনা যাবে না।
        </p>
      </div>

      {trash.length > 1 && (
        <div className="no-scrollbar mb-3 flex items-center gap-1.5 overflow-x-auto pb-1 overscroll-x-contain">
          <button
            type="button"
            onClick={() => setKind("all")}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-[11.5px] font-bold transition",
              kind === "all"
                ? "border-brand bg-brand text-white"
                : "border-line bg-surface text-muted hover:text-ink",
            )}
          >
            সব ({trash.length})
          </button>
          {kinds.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-[11.5px] font-bold transition",
                kind === k
                  ? "border-brand bg-brand-soft text-brand-700 dark:text-brand-300"
                  : "border-line bg-surface text-muted hover:text-ink",
              )}
            >
              {TRASH_EMOJI[k]} {TRASH_LABEL[k]} ({trash.filter((t) => t.kind === k).length})
            </button>
          ))}
        </div>
      )}

      {grouped.length ? (
        <div className="space-y-4">
          {grouped.map(([date, items]) => (
            <div key={date}>
              <p className="mb-1.5 px-1 text-[11.5px] font-bold text-ink">
                {new Date(`${date}T00:00:00`).toLocaleDateString("bn-BD", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
              <Card className="overflow-hidden">
                <div className="divide-y divide-line">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 px-3.5 py-2.5">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-lg">
                        {TRASH_EMOJI[item.kind]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-[12.5px] font-bold text-ink">
                            {item.label}
                          </p>
                          <span className="shrink-0 rounded-full bg-surface-2 px-1.5 py-0.5 text-[9.5px] font-bold text-muted">
                            {TRASH_LABEL[item.kind]}
                          </span>
                        </div>
                        <p className="truncate text-[10.5px] text-muted">
                          {item.detail} ·{" "}
                          {new Date(item.deletedAt).toLocaleString("bn-BD", {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                          {item.batchId ? " · সাথে আরও আছে" : ""}
                        </p>
                      </div>
                      <IconButton
                        label="ফেরত আনুন"
                        onClick={() => setRestoring(item)}
                        className="text-brand hover:bg-brand/10 hover:text-brand"
                      >
                        <RotateCcw className="size-4" />
                      </IconButton>
                      <IconButton
                        label="চিরতরে মুছুন"
                        onClick={() => setDeleting(item)}
                        className="text-danger hover:bg-danger/10 hover:text-danger"
                      >
                        <Trash2 className="size-4" />
                      </IconButton>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          ))}
        </div>
      ) : (
        <Card className="p-4">
          <EmptyState
            icon={Archive}
            title={trash.length ? "এই ধরনের কিছু নেই" : "বিন খালি"}
            message={
              trash.length
                ? "অন্য ধরনের আইটেম দেখতে উপরের বাটন চাপুন।"
                : "এখনো কিছু মুছে ফেলা হয়নি। মুছে ফেললে এখানে জমা হবে।"
            }
          />
        </Card>
      )}

      <ConfirmDialog
        open={!!restoring}
        onClose={() => setRestoring(null)}
        title="ফেরত আনবেন?"
        message={
          restoring?.batchId
            ? `“${restoring.label}” ও তার সাথে যুক্ত আইটেমগুলোও আবার আগের জায়গায় চলে যাবে।`
            : `“${restoring?.label}” আবার আগের জায়গায় চলে যাবে।`
        }
        confirmText="ফেরত আনুন"
        danger={false}
        loading={busy}
        onConfirm={handleRestore}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="চিরতরে মুছে ফেলবেন?"
        message={`“${deleting?.label}” আর কখনো ফেরত আনা যাবে না।`}
        confirmText="চিরতরে মুছুন"
        loading={busy}
        onConfirm={handleDeleteForever}
      />

      <ConfirmDialog
        open={confirmEmpty}
        onClose={() => setConfirmEmpty(false)}
        title="পুরো বিন খালি করবেন?"
        message={`এখন থাকা ${trash.length}টি আইটেম চিরতরে মুছে যাবে। আর ফেরত আনা যাবে না।`}
        confirmText="বিন খালি করুন"
        loading={busy}
        onConfirm={handleEmpty}
      />
    </div>
  );
}
