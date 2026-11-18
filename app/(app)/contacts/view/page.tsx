"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  HandCoins,
  Pencil,
  Phone,
  RotateCcw,
  Trash2,
  Users,
} from "lucide-react";
import { ContactFormModal } from "@/components/contact-form";
import { DebtFormModal } from "@/components/debt-form";
import {
  Card,
  ConfirmDialog,
  EmptyState,
  IconButton,
  useToast,
} from "@/components/ui";
import { useData } from "@/lib/data";
import { contactNet } from "@/lib/stats";
import { DEBT_LABEL, type Debt, type DebtKind } from "@/lib/types";
import { cn, formatDate, formatMoney } from "@/lib/utils";

const KIND_META: Record<
  DebtKind,
  { icon: typeof ArrowUpRight; sign: 1 | -1; className: string }
> = {
  lent: { icon: ArrowUpRight, sign: 1, className: "bg-brand-soft text-brand" },
  borrowed: { icon: ArrowDownLeft, sign: -1, className: "bg-danger/10 text-danger" },
  lent_repaid: { icon: CheckCircle2, sign: -1, className: "bg-surface-2 text-muted" },
  borrowed_repaid: { icon: RotateCcw, sign: 1, className: "bg-surface-2 text-muted" },
};

export default function ContactDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="pt-6">
          <Card>
            <EmptyState icon={HandCoins} title="লোড হচ্ছে…" />
          </Card>
        </div>
      }
    >
      <ContactDetailView />
    </Suspense>
  );
}

function ContactDetailView() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const router = useRouter();
  const { contacts, debts, settings, removeContact, removeDebt, ready } = useData();
  const toast = useToast();

  const [debtOpen, setDebtOpen] = useState(false);
  const [kind, setKind] = useState<DebtKind>("lent");
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [debtToDelete, setDebtToDelete] = useState<Debt | null>(null);

  const contact = contacts.find((c) => c.id === id);
  const net = useMemo(() => (id ? contactNet(debts, id) : 0), [debts, id]);

  const entries = useMemo(
    () =>
      debts
        .filter((d) => d.contactId === id)
        .sort((a, b) =>
          a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1,
        ),
    [debts, id],
  );

  if (!contact) {
    return (
      <div className="pt-6">
        <Card>
          <EmptyState
            icon={ready ? Users : HandCoins}
            title={ready ? "এই ব্যক্তি পাওয়া যায়নি" : "লোড হচ্ছে…"}
            message={ready ? "সম্ভবত এটি রিসাইকেল বিনে চলে গেছে।" : undefined}
            action={
              ready ? (
                <Link
                  href="/contacts"
                  className="rounded-xl bg-brand px-4 py-2 text-[12px] font-bold text-white"
                >
                  তালিকায় ফিরে যান
                </Link>
              ) : null
            }
          />
        </Card>
      </div>
    );
  }

  const currency = settings.currency;
  const bengali = settings.bengaliNumerals;

  function openDebt(k: DebtKind) {
    setKind(k);
    setDebtOpen(true);
  }

  async function handleDeleteContact() {
    setDeleting(true);
    try {
      await removeContact(contact!.id);
      toast("ব্যক্তি ও তার হিসাব রিসাইকেল বিনে চলে গেছে");
      setConfirmDelete(false);
      router.replace("/contacts");
    } catch (err) {
      toast((err as Error).message || "মুছে ফেলা যায়নি", "error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Link
          href="/contacts"
          className="inline-flex items-center gap-1.5 text-[12px] font-bold text-muted hover:text-ink"
        >
          <ArrowLeft className="size-4" /> দেনা-পাওনা
        </Link>
        <div className="flex items-center gap-1">
          <IconButton label="সম্পাদনা" onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" />
          </IconButton>
          <IconButton
            label="মুছে ফেলুন"
            onClick={() => setConfirmDelete(true)}
            className="hover:bg-danger/10 hover:text-danger"
          >
            <Trash2 className="size-4" />
          </IconButton>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span
          className={cn(
            "grid size-14 place-items-center rounded-2xl text-xl font-bold text-white",
            net > 0
              ? "bg-gradient-to-br from-brand-400 to-brand-600"
              : net < 0
                ? "bg-gradient-to-br from-rose-400 to-rose-600"
                : "bg-gradient-to-br from-slate-400 to-slate-600",
          )}
        >
          {contact.name.charAt(0)}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-[20px] font-extrabold tracking-tight text-ink">
            {contact.name}
          </h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted">
            {contact.phone ? (
              <>
                <Phone className="size-3" /> {contact.phone}
              </>
            ) : (
              contact.note || "কোনো বিবরণ নেই"
            )}
          </p>
        </div>
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="p-4 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            {net > 0 ? "আমার পাওনা" : net < 0 ? "আমার দেনা" : "হিসাব"}
          </p>
          <p
            className={cn(
              "tabular mt-1 text-[30px] font-extrabold leading-none tracking-tight",
              net > 0 ? "text-brand" : net < 0 ? "text-danger" : "text-ink",
            )}
          >
            {formatMoney(Math.abs(net), { currency, bengali })}
          </p>
          <p className="mt-1.5 text-[11px] text-muted">
            {net > 0
              ? `${contact.name} আপনার কাছে এই টাকা পাওনা`
              : net < 0
                ? `আপনি ${contact.name}-এর কাছে এই টাকা দেনা`
                : "সব হিসাব সমান, কারো কাছে কিছু বাকি নেই"}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-line bg-surface-2/40 p-2.5">
          <button
            onClick={() => openDebt("lent")}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-surface px-2 py-2.5 text-[11.5px] font-bold text-ink shadow-sm transition hover:bg-surface-2"
          >
            <ArrowUpRight className="size-3.5 text-brand" /> টাকা দিলাম
          </button>
          <button
            onClick={() => openDebt("borrowed")}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-surface px-2 py-2.5 text-[11.5px] font-bold text-ink shadow-sm transition hover:bg-surface-2"
          >
            <ArrowDownLeft className="size-3.5 text-danger" /> টাকা নিলাম
          </button>
          <button
            onClick={() => openDebt("lent_repaid")}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-surface px-2 py-2.5 text-[11.5px] font-bold text-ink shadow-sm transition hover:bg-surface-2"
          >
            <CheckCircle2 className="size-3.5 text-brand" /> ফেরত পেলাম
          </button>
          <button
            onClick={() => openDebt("borrowed_repaid")}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-surface px-2 py-2.5 text-[11.5px] font-bold text-ink shadow-sm transition hover:bg-surface-2"
          >
            <RotateCcw className="size-3.5 text-danger" /> ফেরত দিলাম
          </button>
        </div>
      </Card>

      <div className="mb-2.5 mt-5 flex items-center justify-between px-1">
        <h2 className="text-[14px] font-bold text-ink">সব এন্ট্রি</h2>
        <span className="text-[11px] font-semibold text-muted">{entries.length}টি</span>
      </div>

      {entries.length ? (
        <Card className="overflow-hidden">
          <div className="divide-y divide-line">
            {entries.map((d) => {
              const meta = KIND_META[d.kind];
              const Icon = meta.icon;
              return (
                <div key={d.id} className="flex items-center gap-3 px-3.5 py-3">
                  <span
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-xl",
                      meta.className,
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-bold text-ink">{DEBT_LABEL[d.kind]}</p>
                    <p className="truncate text-[11px] text-muted">
                      {formatDate(d.date, bengali, true)}
                      {d.note ? ` · ${d.note}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={cn(
                        "tabular text-[13px] font-bold",
                        meta.sign > 0 ? "text-brand" : "text-danger",
                      )}
                    >
                      {meta.sign > 0 ? "+" : "−"}
                      {formatMoney(d.amount, { currency, bengali })}
                    </p>
                    <p className="text-[10px] text-muted">ব্যালেন্সে</p>
                  </div>
                  <button
                    onClick={() => setDebtToDelete(d)}
                    aria-label="এন্ট্রি মুছুন"
                    className="grid size-8 shrink-0 place-items-center rounded-lg text-muted/70 hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <Card>
          <EmptyState
            icon={HandCoins}
            title="এখনো কোনো এন্ট্রি নেই"
            message="উপরের বাটন থেকে টাকা দেওয়া, নেওয়া বা ফেরতের হিসাব যোগ করুন।"
          />
        </Card>
      )}

      {contact.note ? (
        <p className="mt-4 rounded-2xl border border-line bg-surface-2/50 px-3.5 py-3 text-[11.5px] leading-relaxed text-muted">
          <b className="text-ink">নোট:</b> {contact.note}
        </p>
      ) : null}

      <DebtFormModal
        open={debtOpen}
        onClose={() => setDebtOpen(false)}
        contactId={contact.id}
        contactName={contact.name}
        defaultKind={kind}
      />
      <ContactFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        editing={contact}
      />
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`${contact.name}-কে মুছে ফেলবেন?`}
        message="এই ব্যক্তির সব দেনা-পাওনার এন্ট্রিও মুছে যাবে। এটি ফেরানো যাবে না।"
        loading={deleting}
        onConfirm={handleDeleteContact}
      />
      <ConfirmDialog
        open={!!debtToDelete}
        onClose={() => setDebtToDelete(null)}
        title="এন্ট্রি মুছে ফেলবেন?"
        message={
          debtToDelete
            ? `${DEBT_LABEL[debtToDelete.kind]} — ${formatMoney(debtToDelete.amount, {
                currency,
                bengali,
              })}। এন্ট্রিটি রিসাইকেল বিনে জমা হবে — ভুল হলে ফেরত আনতে পারবেন।`
            : ""
        }
        onConfirm={async () => {
          if (!debtToDelete) return;
          try {
            await removeDebt(debtToDelete.id);
            toast("এন্ট্রি রিসাইকেল বিনে চলে গেছে");
          } catch (err) {
            toast((err as Error).message || "মুছে ফেলা যায়নি", "error");
          } finally {
            setDebtToDelete(null);
          }
        }}
      />
    </div>
  );
}
