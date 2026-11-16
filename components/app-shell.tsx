"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  BarChart3,
  Cloud,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Plus,
  Repeat,
  Settings as SettingsIcon,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useData, type TxInput } from "@/lib/data";
import type { Transaction } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Avatar, Button, Logo, Modal, Spinner } from "./ui";
import { TransactionForm } from "./transaction-form";
import { AutoBackup } from "./auto-backup";

interface FormOptions {
  preset?: Partial<TxInput>;
  editing?: Transaction | null;
}

const QuickAddContext = createContext<(opts?: FormOptions) => void>(() => undefined);
export const useQuickAdd = () => useContext(QuickAddContext);

const NAV = [
  { href: "/dashboard", label: "হোম", icon: LayoutDashboard },
  { href: "/transactions", label: "লেনদেন", icon: ArrowLeftRight },
  { href: "/templates", label: "নিয়মিত", icon: Repeat },
  { href: "/contacts", label: "দেনা-পাওনা", icon: HandCoins },
  { href: "/reports", label: "রিপোর্ট", icon: BarChart3 },
  { href: "/settings", label: "সেটিংস", icon: SettingsIcon },
];

const MOBILE_NAV = [NAV[0], NAV[1], null, NAV[2], null] as const;

function LoadingScreen({ label = "হিসাব লোড হচ্ছে…" }: { label?: string }) {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-bg">
      <div className="flex flex-col items-center gap-4">
        <Logo size={52} />
        <div className="flex items-center gap-2 text-sm font-medium text-muted">
          <Spinner className="size-4" /> {label}
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, logout, cloudAvailable } = useAuth();
  const { ready, isLocal, error } = useData();
  const router = useRouter();
  const pathname = usePathname();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [preset, setPreset] = useState<Partial<TxInput> | undefined>();
  const [moreOpen, setMoreOpen] = useState(false);

  const openForm = useCallback((opts?: FormOptions) => {
    setEditing(opts?.editing ?? null);
    setPreset(opts?.preset);
    setFormOpen(true);
  }, []);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading) return <LoadingScreen />;
  if (!user) return <LoadingScreen label="সাইন ইন পেজে নিয়ে যাচ্ছি…" />;

  const active = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <QuickAddContext.Provider value={openForm}>
      <div className="min-h-[100dvh] bg-bg">
        {/* ───── ডেস্কটপ সাইডবার ───── */}
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line bg-surface lg:flex">
          <div className="px-5 py-5">
            <Link href="/dashboard" aria-label="হোম">
              <Logo size={38} withText />
            </Link>
          </div>
          <div className="px-4">
            <Button block size="md" onClick={() => openForm()}>
              <Plus className="size-4" /> নতুন লেনদেন
            </Button>
          </div>
          <nav className="mt-5 flex-1 space-y-1 overflow-y-auto px-3 pb-4">
            {NAV.map((item) => {
              const Icon = item.icon;
              const on = active(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                    on
                      ? "bg-brand-soft text-brand-700 dark:text-brand-300"
                      : "text-muted hover:bg-surface-2 hover:text-ink",
                  )}
                >
                  <Icon className="size-[18px]" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-line p-3">
            <Link
              href="/settings"
              className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-surface-2"
            >
              <Avatar name={user.name} src={user.photo} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-ink">{user.name}</p>
                <p className="truncate text-[11px] text-muted">
                  {user.demo ? "ডেমো মোড" : user.email}
                </p>
              </div>
            </Link>
            <button
              onClick={() => logout()}
              className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-semibold text-muted transition hover:bg-surface-2 hover:text-danger"
            >
              <LogOut className="size-4" /> লগ আউট
            </button>
          </div>
        </aside>

        {/* ───── মোবাইল হেডার ───── */}
        <header className="sticky top-0 z-30 border-b border-line glass lg:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <Link href="/dashboard" aria-label="হোম">
              <Logo size={30} withText />
            </Link>
            <div className="flex items-center gap-1">
              <Link
                href="/settings"
                className="grid size-9 place-items-center rounded-full"
                aria-label="প্রোফাইল"
              >
                <Avatar name={user.name} src={user.photo} size={32} />
              </Link>
            </div>
          </div>
        </header>

        <main className="lg:pl-64">
          <div className="mx-auto w-full max-w-5xl px-4 pb-28 pt-4 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
            {isLocal ? (
              <div className="mb-4 flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-[11.5px] font-medium leading-relaxed text-amber-700 dark:text-amber-300">
                <Sparkles className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  <b>ডেমো মোড</b> — সব তথ্য শুধু এই ব্রাউজারে থাকছে। Firebase কনফিগার করলে
                  Google লগইন ও ক্লাউড সিঙ্ক চালু হবে।
                </span>
              </div>
            ) : null}
            {error ? (
              <div className="mb-4 rounded-2xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-[12px] font-medium text-danger">
                {error}
              </div>
            ) : null}
            {!ready ? (
              <div className="flex min-h-[50vh] items-center justify-center">
                <Spinner />
              </div>
            ) : (
              children
            )}
          </div>
        </main>

        {/* ───── মোবাইল বটম নেভ ───── */}
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-safe backdrop-blur lg:hidden">
          <div className="mx-auto grid max-w-md grid-cols-5 items-center px-2">
            {MOBILE_NAV.map((item, idx) => {
              if (!item) {
                if (idx === 2) {
                  return (
                    <div key="fab" className="flex justify-center">
                      <button
                        onClick={() => openForm()}
                        aria-label="নতুন লেনদেন"
                        className="-mt-6 grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-700 text-white shadow-lg shadow-brand-700/25 transition active:scale-95"
                      >
                        <Plus className="size-6" strokeWidth={2.5} />
                      </button>
                    </div>
                  );
                }
                return (
                  <button
                    key="more"
                    onClick={() => setMoreOpen(true)}
                    className="flex flex-col items-center gap-1 py-2.5 text-muted"
                  >
                    <span className="grid size-5 place-items-center">
                      <span className="grid grid-cols-2 gap-0.5">
                        <i className="size-1 rounded-full bg-current" />
                        <i className="size-1 rounded-full bg-current" />
                        <i className="size-1 rounded-full bg-current" />
                        <i className="size-1 rounded-full bg-current" />
                      </span>
                    </span>
                    <span className="text-[10px] font-semibold">আরও</span>
                  </button>
                );
              }
              const Icon = item.icon;
              const on = active(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2.5",
                    on ? "text-brand" : "text-muted",
                  )}
                >
                  <Icon className="size-5" strokeWidth={on ? 2.4 : 2} />
                  <span className={cn("text-[10px]", on ? "font-bold" : "font-semibold")}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>

        <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="আরও">
          <div className="grid grid-cols-2 gap-2">
            {NAV.slice(3).map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface-2/60 px-3.5 py-3 text-[13px] font-semibold text-ink"
                >
                  <Icon className="size-4 text-brand" /> {item.label}
                </Link>
              );
            })}
            <Link
              href="/settings#backup"
              onClick={() => setMoreOpen(false)}
              className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface-2/60 px-3.5 py-3 text-[13px] font-semibold text-ink"
            >
              <Cloud className="size-4 text-brand" /> ব্যাকআপ
            </Link>
            <button
              onClick={() => {
                setMoreOpen(false);
                logout();
              }}
              className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface-2/60 px-3.5 py-3 text-left text-[13px] font-semibold text-danger"
            >
              <LogOut className="size-4" /> লগ আউট
            </button>
          </div>
        </Modal>

        <TransactionForm
          open={formOpen}
          editing={editing}
          preset={preset}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
            setPreset(undefined);
          }}
        />

        <AutoBackup />
      </div>
    </QuickAddContext.Provider>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-extrabold tracking-tight text-ink sm:text-2xl">
          {title}
        </h1>
        {subtitle ? <p className="mt-1 text-xs text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function MonthSwitcher({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (next: string) => void;
  label: string;
}) {
  const [y, m] = value.split("-").map(Number);
  const shift = (delta: number) => {
    const d = new Date(y, m - 1 + delta, 1);
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  return (
    <div className="flex items-center gap-1 rounded-full border border-line bg-surface p-0.5">
      <button
        onClick={() => shift(-1)}
        aria-label="আগের মাস"
        className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface-2"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <span className="min-w-[108px] text-center text-[12px] font-bold text-ink">{label}</span>
      <button
        onClick={() => shift(1)}
        aria-label="পরের মাস"
        className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface-2"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
