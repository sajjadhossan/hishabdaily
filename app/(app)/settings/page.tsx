"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { VERSION_LABEL } from "@/lib/version";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Cloud,
  CloudDownload,
  CloudUpload,
  Database,
  Download,
  ExternalLink,
  FileJson,
  FileUp,
  FolderOpen,
  LogOut,
  Moon,
  Palette,
  Pencil,
  Plus,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Smartphone,
  Sun,
  Trash2,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { UpdateCard } from "@/components/update-ui";
import {
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Field,
  IconButton,
  Input,
  Modal,
  SectionTitle,
  Segmented,
  Select,
  Switch,
  useToast,
} from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useData } from "@/lib/data";
import {
  activeConfig,
  configFromEnv,
  configFromStorage,
  googleClientId,
  saveConfigToStorage,
} from "@/lib/firebase";
import {
  deleteBackup,
  downloadBackup,
  driveErrorText,
  driveFolderUrl,
  getDriveToken,
  listBackups,
  uploadBackup,
  type DriveFile,
} from "@/lib/drive";
import { getDriveAccessToken } from "@/lib/google";
import { isNativeApk } from "@/lib/updater";
import {
  backupFileName,
  buildBackup,
  csvFileName,
  parseBackup,
  transactionsToCsv,
} from "@/lib/backup";
import type { AppData, Category, TxType } from "@/lib/types";
import {
  cn,
  downloadBlob,
  timeAgo,
  uid,
} from "@/lib/utils";

const COLORS = [
  "#f97316", "#22c55e", "#3b82f6", "#8b5cf6", "#eab308", "#06b6d4",
  "#ef4444", "#6366f1", "#ec4899", "#a855f7", "#14b8a6", "#64748b",
];
const CURRENCIES = ["৳", "₹", "$", "€", "£", "﷼", "د.إ"];
const EMOJIS = [
  "🍚", "🛒", "🚌", "🏠", "💡", "📱", "☕", "🩺", "📚", "👕", "🎬", "🤲",
  "💼", "🏪", "💻", "🎁", "⛽", "🧾", "💊", "🧼", "🐟", "🥬", "🛵", "🌐",
  "🎓", "🚗", "✈️", "🏥", "🧸", "📦",
];

export default function SettingsPage() {
  const { user, logout, updateName, cloudAvailable } = useAuth();
  const {
    transactions,
    templates,
    contacts,
    debts,
    folders,
    trash,
    settings,
    updateSettings,
    removeCategory,
    replaceAll,
    clearAllData,
    isLocal,
    synced,
  } = useData();
  const toast = useToast();

  const [nameOpen, setNameOpen] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [budget, setBudget] = useState(String(settings.monthlyBudget || ""));
  const [catOpen, setCatOpen] = useState(false);
  const [catType, setCatType] = useState<TxType>("expense");
  const [catName, setCatName] = useState("");
  const [catEmoji, setCatEmoji] = useState("🛒");
  const [catColor, setCatColor] = useState(COLORS[0]);
  const [catFolderId, setCatFolderId] = useState("");
  const [accountInput, setAccountInput] = useState("");
  const [catToDelete, setCatToDelete] = useState<Category | null>(null);

  const [clientId, setClientId] = useState<string | null>(null);
  const [envConfigured, setEnvConfigured] = useState(false);
  const [customConfigured, setCustomConfigured] = useState(false);

  const [backupBusy, setBackupBusy] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [driveTestBusy, setDriveTestBusy] = useState(false);
  const [driveFolder, setDriveFolder] = useState<string | null>(null);
  const [driveBackupCount, setDriveBackupCount] = useState<number | null>(null);
  const [pendingPayload, setPendingPayload] = useState<Partial<AppData> | null>(null);
  const [pendingSource, setPendingSource] = useState("");
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setClientId(googleClientId());
    setEnvConfigured(!!configFromEnv());
    setCustomConfigured(!!configFromStorage());
    setBudget(settings.monthlyBudget ? String(settings.monthlyBudget) : "");
  }, [settings.monthlyBudget]);

  const bengali = settings.bengaliNumerals;
  const currency = settings.currency;
  const cats = settings.categories.filter((c) => c.type === catType || (catType === "expense" && c.type === "both"));

  async function requireToken(interactive = true): Promise<string | null> {
    // APK: Drive অনুমতি নেটিভ ফ্লোতে নেওয়া হয়। ব্রাউজার/GIS পদ্ধতিতে যাই না।
    if (isNativeApk()) {
      try {
        const token = await getDriveAccessToken({ interactive });
        if (token) return token;
        if (interactive) toast("Google Drive অনুমতি পাওয়া যায়নি। আবার চেষ্টা করুন।", "error");
      } catch (err) {
        if (interactive) toast(driveErrorText(err), "error");
      }
      return null;
    }

    // ১) ওয়েব: Google দিয়ে সাইন ইন করা থাকলে সেখান থেকেই Drive টোকেন
    try {
      const direct = await getDriveAccessToken({ interactive });
      if (direct) return direct;
    } catch (err) {
      if (interactive) toast(driveErrorText(err), "error");
      if (!clientId) return null;
    }

    // ২) পুরোনো পদ্ধতি: আলাদা Google Client ID (ঐচ্ছিক)
    if (!clientId) {
      if (interactive)
        toast("ব্যাকআপের জন্য Google দিয়ে সাইন ইন করুন — অথবা সেটআপে Google Client ID দিন", "error");
      return null;
    }
    try {
      return await getDriveToken(clientId);
    } catch (err) {
      if (interactive) toast(driveErrorText(err), "error");
      return null;
    }
  }

  async function testDrive() {
    setDriveTestBusy(true);
    try {
      const token = await requireToken();
      if (!token) return;
      const list = await listBackups(token);
      setDriveBackupCount(list.length);
      setDriveFolder(driveFolderUrl());
      toast(`Drive সংযুক্ত ✅ · ${list.length}টি ব্যাকআপ পাওয়া গেছে`);
    } catch (err) {
      toast(driveErrorText(err), "error");
    } finally {
      setDriveTestBusy(false);
    }
  }

  async function doBackup() {
    setBackupBusy(true);
    try {
      const token = await requireToken();
      if (!token) return;
      const payload = buildBackup(
        { transactions, templates, contacts, debts, folders, trash, settings },
        { name: user?.name || "ব্যবহারকারী", email: user?.email || "" },
      );
      const file = await uploadBackup(
        token,
        backupFileName(user?.name),
        JSON.stringify(payload, null, 2),
      );
      await updateSettings({ lastBackupAt: Date.now() });
      toast(`ব্যাকআপ সম্পন্ন হয়েছে · ${file.name}`);
    } catch (err) {
      toast(driveErrorText(err) || "ব্যাকআপ ব্যর্থ হয়েছে", "error");
    } finally {
      setBackupBusy(false);
    }
  }

  async function openBackups() {
    setBackupOpen(true);
    setLoadingFiles(true);
    try {
      const token = await requireToken();
      if (!token) return;
      setFiles(await listBackups(token));
    } catch (err) {
      toast(driveErrorText(err) || "তালিকা আনা যায়নি", "error");
    } finally {
      setLoadingFiles(false);
    }
  }

  async function restoreFromDrive(file: DriveFile) {
    setRestoreBusy(true);
    try {
      const token = await requireToken();
      if (!token) return;
      const text = await downloadBackup(token, file.id);
      const payload = parseBackup(text);
      setPendingPayload(payload);
      setPendingSource(file.name);
      setBackupOpen(false);
    } catch (err) {
      toast(driveErrorText(err) || "রিস্টোর করা যায়নি", "error");
    } finally {
      setRestoreBusy(false);
    }
  }

  async function handleLocalFile(file: File) {
    try {
      const text = await file.text();
      const payload = parseBackup(text);
      setPendingPayload(payload);
      setPendingSource(file.name);
    } catch (err) {
      toast((err as Error).message || "ফাইল পড়া যায়নি", "error");
    }
  }

  async function confirmRestore() {
    if (!pendingPayload) return;
    setRestoreBusy(true);
    try {
      await replaceAll(pendingPayload);
      toast("ডেটা সফলভাবে রিস্টোর হয়েছে");
      setPendingPayload(null);
    } catch (err) {
      toast((err as Error).message || "রিস্টোর ব্যর্থ", "error");
    } finally {
      setRestoreBusy(false);
    }
  }

  function downloadLocalBackup() {
    const payload = buildBackup(
      { transactions, templates, contacts, debts, folders, trash, settings },
      { name: user?.name || "ব্যবহারকারী", email: user?.email || "" },
    );
    downloadBlob(
      new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
      backupFileName(user?.name),
    );
    toast("ব্যাকআপ ফাইল ডাউনলোড হয়েছে");
  }

  function exportCsv() {
    if (!transactions.length) {
      toast("রপ্তানি করার মতো লেনদেন নেই", "error");
      return;
    }
    downloadBlob(
      new Blob([transactionsToCsv(transactions, settings)], {
        type: "text/csv;charset=utf-8",
      }),
      csvFileName(),
    );
    toast("CSV ডাউনলোড হয়েছে");
  }

  async function addCategory() {
    if (!catName.trim()) {
      toast("খাতের নাম দিন", "error");
      return;
    }
    if (settings.categories.some((c) => c.name === catName.trim())) {
      toast("এই নামে খাত আগেই আছে", "error");
      return;
    }
    await updateSettings({
      categories: [
        ...settings.categories,
        {
          id: uid(),
          name: catName.trim(),
          emoji: catEmoji,
          color: catColor,
          type: catType,
          folderId: catFolderId || undefined,
        },
      ],
    });
    setCatName("");
    setCatFolderId("");
    setCatOpen(false);
    toast("নতুন খাত যোগ হয়েছে");
  }

  async function deleteCategory(cat: Category) {
    await removeCategory(cat.id);
    setCatToDelete(null);
    toast("খাত রিসাইকেল বিনে চলে গেছে");
  }

  async function addAccount() {
    const value = accountInput.trim();
    if (!value) return;
    if (settings.accounts.includes(value)) {
      toast("এই অ্যাকাউন্ট আগেই আছে", "error");
      return;
    }
    await updateSettings({ accounts: [...settings.accounts, value] });
    setAccountInput("");
    toast("অ্যাকাউন্ট যোগ হয়েছে");
  }

  async function removeAccount(acc: string) {
    if (settings.accounts.length <= 1) {
      toast("অন্তত একটি অ্যাকাউন্ট থাকতে হবে", "error");
      return;
    }
    await updateSettings({ accounts: settings.accounts.filter((a) => a !== acc) });
  }

  async function saveBudget() {
    const value = Number(budget) || 0;
    await updateSettings({ monthlyBudget: value });
    toast(value ? "মাসিক বাজেট সেভ হয়েছে" : "বাজেট সরানো হয়েছে");
  }

  return (
    <div>
      <PageHeader title="সেটিংস" subtitle="অ্যাপ, ডেটা ও ব্যাকআপ নিয়ন্ত্রণ করুন" />

      {/* প্রোফাইল */}
      <Card className="p-4">
        <div className="flex items-center gap-3.5">
          <Avatar name={user?.name || "হ"} src={user?.photo} size={54} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-[15px] font-extrabold text-ink">{user?.name}</p>
              {isLocal ? <Badge tone="warn">ডেমো</Badge> : <Badge tone="brand">ক্লাউড</Badge>}
            </div>
            <p className="truncate text-[11.5px] text-muted">{user?.email}</p>
          </div>
          <IconButton
            label="নাম সম্পাদনা"
            onClick={() => {
              setName(user?.name || "");
              setNameOpen(true);
            }}
          >
            <Pencil className="size-4" />
          </IconButton>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
          <div>
            <p className="text-[10px] font-medium text-muted">লেনদেন</p>
            <p className="tabular text-[13px] font-bold text-ink">{transactions.length}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-muted">টেমপ্লেট</p>
            <p className="tabular text-[13px] font-bold text-ink">{templates.length}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-muted">ব্যক্তি</p>
            <p className="tabular text-[13px] font-bold text-ink">{contacts.length}</p>
          </div>
        </div>
      </Card>

      {/* APK আপডেট — শুধু Android APK-তে দেখাবে */}
      <UpdateCard />

      {/* পছন্দ */}
      <section className="mt-6">
        <SectionTitle title="পছন্দ ও চেহারা" />
        <Card className="divide-y divide-line">
          <div className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-surface-2 text-muted">
                <Palette className="size-4" />
              </span>
              <div>
                <p className="text-[13px] font-semibold text-ink">থিম</p>
                <p className="text-[10.5px] text-muted">অ্যাপের রঙ</p>
              </div>
            </div>
            <Segmented
              value={settings.theme}
              onChange={(theme) => updateSettings({ theme })}
              options={[
                { value: "light", label: "লাইট", icon: <Sun className="size-3.5" /> },
                { value: "system", label: "অটো", icon: <Smartphone className="size-3.5" /> },
                { value: "dark", label: "ডার্ক", icon: <Moon className="size-3.5" /> },
              ]}
              className="w-[190px] shrink-0"
            />
          </div>

          <div className="p-4">
            <Switch
              checked={settings.bengaliNumerals}
              onChange={(bengaliNumerals) => updateSettings({ bengaliNumerals })}
              label="বাংলা সংখ্যায় দেখান"
              description="টাকার অঙ্ক ইংরেজি ১২৩-এর বদলে বাংলা ১২৩-এ দেখাবে"
            />
          </div>

          <div className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-[13px] font-semibold text-ink">মুদ্রার চিহ্ন</p>
              <p className="text-[10.5px] text-muted">টাকার আগে যে চিহ্ন দেখাবে</p>
            </div>
            <Select
              value={settings.currency}
              onChange={(e) => updateSettings({ currency: e.target.value })}
              className="h-9 w-24 shrink-0 text-center"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>

          <div className="p-4">
            <div className="flex items-end gap-2">
              <Field
                label="মাসিক বাজেট"
                hint="০ রাখলে বাজেট হিসাব বন্ধ থাকবে"
                className="flex-1"
              >
                <Input
                  inputMode="decimal"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value.replace(/[^\d.]/g, ""))}
                  placeholder="যেমন: 25000"
                />
              </Field>
              <Button variant="soft" onClick={saveBudget}>
                সেভ
              </Button>
            </div>
          </div>
        </Card>
      </section>

      {/* খাত */}
      <section className="mt-6">
        <SectionTitle
          title="খরচ ও আয়ের খাত"
          subtitle={`${settings.categories.length}টি খাত`}
          action={
            <Button
              size="sm"
              variant="soft"
              onClick={() => {
                setCatType("expense");
                setCatOpen(true);
              }}
            >
              <Plus className="size-3.5" /> নতুন
            </Button>
          }
        />
        <Card className="p-4">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {settings.categories.map((c) => (
              <span
                key={c.id}
                className="group inline-flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pl-2.5 pr-1.5 text-[11.5px] font-semibold text-ink"
              >
                <span>{c.emoji}</span>
                {c.name}
                <button
                  onClick={() => setCatToDelete(c)}
                  aria-label={`${c.name} মুছুন`}
                  className="grid size-5 place-items-center rounded-full text-muted hover:bg-danger/10 hover:text-danger"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
          <button
            onClick={() => setCatOpen(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line py-2 text-[11.5px] font-semibold text-muted hover:border-brand/40 hover:text-brand"
          >
            <Plus className="size-3.5" /> নিজের খাত যোগ করুন
          </button>
        </Card>
      </section>

      {/* অ্যাকাউন্ট */}
      <section className="mt-6">
        <SectionTitle title="টাকার উৎস / অ্যাকাউন্ট" subtitle="ক্যাশ, বিকাশ, ব্যাংক, কার্ড…" />
        <Card className="p-4">
          <div className="flex flex-wrap gap-1.5">
            {settings.accounts.map((a) => (
              <span
                key={a}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pl-3 pr-1.5 text-[11.5px] font-semibold text-ink"
              >
                <Wallet className="size-3 text-muted" />
                {a}
                <button
                  onClick={() => removeAccount(a)}
                  aria-label={`${a} সরান`}
                  className="grid size-5 place-items-center rounded-full text-muted hover:bg-danger/10 hover:text-danger"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Input
              value={accountInput}
              onChange={(e) => setAccountInput(e.target.value)}
              placeholder="নতুন অ্যাকাউন্ট, যেমন: ইসলামী ব্যাংক"
              onKeyDown={(e) => {
                if (e.key === "Enter") addAccount();
              }}
            />
            <Button variant="soft" onClick={addAccount}>
              <Plus className="size-4" />
            </Button>
          </div>
        </Card>
      </section>

      {/* ব্যাকআপ */}
      <section className="mt-6" id="backup">
        <SectionTitle title="Google Drive ব্যাকআপ" subtitle="সব তথ্য নিরাপদে আপনার ড্রাইভে" />
        <Card className="overflow-hidden">
          <div className="flex items-start gap-3 border-b border-line p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
              <Cloud className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-ink">
                {settings.lastBackupAt
                  ? `শেষ ব্যাকআপ: ${timeAgo(settings.lastBackupAt)}`
                  : "এখনো ব্যাকআপ নেওয়া হয়নি"}
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                Google Drive-এ “Hishab Backups” ফোল্ডারে JSON ফাইল হিসেবে সেভ হবে।
              </p>
              {user?.google ? (
                <p className="mt-1.5 flex items-center gap-1.5 text-[10.5px] font-medium text-brand">
                  <CheckCircle2 className="size-3" />
                  Google অ্যাকাউন্ট: {user.email} — ব্যাকআপ এই Drive-এ যাবে
                </p>
              ) : null}
              {!clientId && !user?.google ? (
                <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-warn/10 px-2.5 py-2 text-[10.5px] font-medium leading-relaxed text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                  Drive ব্যাকআপের জন্য Google দিয়ে সাইন ইন করুন (লগআউট করে “Google দিয়ে
                  চালিয়ে যান”) — তাহলে আলাদা Client ID লাগবে না।
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 pb-1 pt-3">
            <Button
              variant="ghost"
              loading={driveTestBusy}
              onClick={testDrive}
              className="text-[11px]"
            >
              <ShieldCheck className="size-3.5" /> Drive সংযোগ পরীক্ষা
            </Button>
            {driveBackupCount !== null ? (
              <span className="text-[10.5px] font-medium text-muted">
                {driveBackupCount}টি ব্যাকআপ পাওয়া গেছে
              </span>
            ) : null}
            {driveFolder ? (
              <a
                href={driveFolder}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[10.5px] font-bold text-brand hover:underline"
              >
                <ExternalLink className="size-3" /> ফোল্ডার খুলুন
              </a>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2 p-4">
            <Button loading={backupBusy} onClick={doBackup} className="col-span-2">
              <CloudUpload className="size-4" /> এখনই ব্যাকআপ নিন
            </Button>
            <Button variant="outline" onClick={openBackups}>
              <CloudDownload className="size-4" /> রিস্টোর
            </Button>
            <Button variant="outline" onClick={downloadLocalBackup}>
              <Download className="size-4" /> ডাউনলোড
            </Button>
          </div>

          <div className="border-t border-line p-4">
            <Switch
              checked={settings.autoBackup}
              onChange={(autoBackup) => updateSettings({ autoBackup })}
              label="অটো ব্যাকআপ"
              description="দিনে একবার, অ্যাপ খোলার সময় নিজে থেকেই ব্যাকআপ হবে"
            />
          </div>
        </Card>
      </section>

      {/* ডেটা */}
      <section className="mt-6">
        <SectionTitle title="ডেটা" subtitle="আমদানি, রপ্তানি, রিস্টোর বা মুছে ফেলা" />
        <Card className="divide-y divide-line">
          <Link
            href="/import"
            className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-surface-2/60"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand">
              <FileUp className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-ink">স্মার্ট ইম্পোর্ট</p>
              <p className="text-[10.5px] text-muted">PDF, CSV, Excel বা টেক্সট ফাইল থেকে পুরোনো হিসাব আনুন</p>
            </div>
            <ChevronRight className="size-4 text-muted" />
          </Link>

          <button
            onClick={exportCsv}
            className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-surface-2/60"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-surface-2 text-muted">
              <FileJson className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-ink">সব লেনদেন CSV-তে রপ্তানি</p>
              <p className="text-[10.5px] text-muted">Excel বা Google Sheets-এ খুলতে পারবেন</p>
            </div>
            <ChevronRight className="size-4 text-muted" />
          </button>

          <button
            onClick={() => fileRef.current?.click()}
            className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-surface-2/60"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-surface-2 text-muted">
              <Upload className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-ink">ফাইল থেকে রিস্টোর</p>
              <p className="text-[10.5px] text-muted">আগে ডাউনলোড করা JSON ব্যাকআপ বেছে নিন</p>
            </div>
            <ChevronRight className="size-4 text-muted" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleLocalFile(f);
              e.target.value = "";
            }}
          />

          <button
            onClick={() => setClearOpen(true)}
            className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-danger/5"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-danger/10 text-danger">
              <Trash2 className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-danger">সব ডেটা মুছে ফেলুন</p>
              <p className="text-[10.5px] text-muted">
                লেনদেন, টেমপ্লেট, দেনা-পাওনা — সব মুছে যাবে (সেটিংস থাকবে)
              </p>
            </div>
          </button>
        </Card>
      </section>

      {/* Firebase */}
      <section className="mt-6">
        <SectionTitle title="সংযোগ ও অ্যাকাউন্ট" />
        <Card className="divide-y divide-line">
          <div className="flex items-center gap-3 p-4">
            <span className="grid size-9 place-items-center rounded-xl bg-surface-2 text-muted">
              <Database className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-ink">Firebase</p>
              <p className="text-[10.5px] text-muted">
                {cloudAvailable
                  ? "সব ডিভাইসে রিয়েল-টাইম সিঙ্ক সক্রিয়"
                  : envConfigured
                    ? "env ভেরিয়েবল থেকে কনফিগার করা"
                    : customConfigured
                      ? "কাস্টম কনফিগ সেভ করা আছে"
                      : "কনফিগার করা হয়নি"}
              </p>
            </div>
            {cloudAvailable ? (
              <Badge tone="brand">
                <CheckCircle2 className="size-3" /> সক্রিয়
              </Badge>
            ) : (
              <Badge tone="warn">নিষ্ক্রিয়</Badge>
            )}
          </div>

          {!isLocal ? (
            <div className="flex items-start gap-3 p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted">
                <RefreshCw className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-ink">
                  ডেটা সিঙ্ক —{" "}
                  <span className={synced ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
                    {synced ? "চালু" : "অফলাইন"}
                  </span>
                </p>
                <p className="text-[10.5px] leading-relaxed text-muted">
                  প্রজেক্ট: {activeConfig()?.projectId || "—"} · একই অ্যাকাউন্টে অন্য
                  ডিভাইস/ওয়েবসাইটে লগইন করলে ডেটা সাথে সাথে দেখা যাবে।
                </p>
                <p className="mt-1 text-[10.5px] text-muted">
                  {transactions.length}টি লেনদেন · {contacts.length}জন ব্যক্তি ·{" "}
                  {debts.length}টি দেনা-পাওনা · {templates.length}টি টেমপ্লেট
                </p>
              </div>
            </div>
          ) : null}

          <Link
            href="/setup"
            className="flex w-full items-center gap-3 p-4 transition hover:bg-surface-2/60"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-surface-2 text-muted">
              <Settings2 className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-ink">Firebase কনফিগ ও Google Client ID</p>
              <p className="text-[10.5px] text-muted">সেটআপ বা পরিবর্তন করুন</p>
            </div>
            <ChevronRight className="size-4 text-muted" />
          </Link>

          {customConfigured && envConfigured ? (
            <button
              onClick={() => {
                saveConfigToStorage(null);
                toast("কাস্টম কনফিগ সরানো হয়েছে — env কনফিগ ব্যবহার হবে");
              }}
              className="flex w-full items-center gap-3 p-4 text-left"
            >
              <span className="grid size-9 place-items-center rounded-xl bg-surface-2 text-muted">
                <RefreshCw className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-ink">কাস্টম কনফিগ সরান</p>
                <p className="text-[10.5px] text-muted">env-এ দেওয়া কনফিগে ফিরে যান</p>
              </div>
            </button>
          ) : null}

          <button
            onClick={() => logout()}
            className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-danger/5"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-surface-2 text-muted">
              <LogOut className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-ink">লগ আউট</p>
              <p className="text-[10.5px] text-muted">
                {user?.demo ? "ডেমো সেশন শেষ করুন" : "অন্য অ্যাকাউন্টে ঢুকতে"}
              </p>
            </div>
          </button>
        </Card>
      </section>

      {/* সম্পর্কে */}
      <section className="mt-6">
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-700 text-lg font-extrabold text-white">
              ৳
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-ink">হিসাব — ব্যক্তিগত হিসাবের খাতা</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                আয়-ব্যয়, নিয়মিত কেনাকাটা ও দেনা-পাওনার সহজ ট্র্যাকার। Next.js, Firebase ও
                Google Drive দিয়ে তৈরি।
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge>সংস্করণ ১.০</Badge>
                {isLocal ? <Badge tone="warn">লোকাল ডেটা</Badge> : <Badge tone="brand">Firestore</Badge>}
                <Badge tone="neutral">
                  <ShieldCheck className="size-3" /> Google Auth
                </Badge>
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* মডালগুলো */}
      <Modal
        open={nameOpen}
        onClose={() => setNameOpen(false)}
        title="নাম পরিবর্তন"
        footer={
          <Button
            block
            onClick={async () => {
              if (!name.trim()) return;
              try {
                await updateName(name.trim());
                toast("নাম আপডেট হয়েছে");
                setNameOpen(false);
              } catch (err) {
                toast((err as Error).message || "আপডেট করা যায়নি", "error");
              }
            }}
          >
            সেভ করুন
          </Button>
        }
      >
        <Field label="আপনার নাম">
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
      </Modal>

      <Modal
        open={catOpen}
        onClose={() => setCatOpen(false)}
        title="নতুন খাত"
        footer={
          <Button block onClick={addCategory}>
            খাত যোগ করুন
          </Button>
        }
      >
        <div className="space-y-4">
          <Segmented
            value={catType}
            onChange={(v) => setCatType(v)}
            options={[
              { value: "expense", label: "খরচের খাত" },
              { value: "income", label: "আয়ের খাত" },
            ]}
          />
          <div className="flex items-center gap-2.5">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-2xl">
              {catEmoji}
            </span>
            <Field label="নাম" className="flex-1">
              <Input
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="যেমন: গ্যাস বিল"
              />
            </Field>
          </div>
          <Field label="ফোল্ডার (ঐচ্ছিক)" hint="নিয়মিত কেনাকাটা পেজে ফোল্ডার বানান">
            <Select value={catFolderId} onChange={(e) => setCatFolderId(e.target.value)}>
              <option value="">ফোল্ডার ছাড়া</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.emoji} {f.name}
                </option>
              ))}
            </Select>
          </Field>
          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-ink/80">আইকন</p>
            <div className="flex flex-wrap gap-1.5">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setCatEmoji(e)}
                  className={cn(
                    "grid size-9 place-items-center rounded-xl border text-lg transition",
                    catEmoji === e ? "border-brand bg-brand-soft" : "border-line bg-surface",
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
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCatColor(c)}
                  aria-label={c}
                  className={cn(
                    "size-8 rounded-full border-2 transition",
                    catColor === c ? "border-ink scale-110" : "border-transparent",
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {settings.categories
              .filter((c) => c.type === catType)
              .slice(0, 6)
              .map((c) => (
                <span
                  key={c.id}
                  className="rounded-full bg-surface-2 px-2 py-1 text-[10.5px] font-medium text-muted"
                >
                  {c.emoji} {c.name}
                </span>
              ))}
          </div>
        </div>
      </Modal>

      <Modal
        open={backupOpen}
        onClose={() => setBackupOpen(false)}
        title="Google Drive ব্যাকআপ"
        subtitle="রিস্টোর করলে বর্তমান ডেটা প্রতিস্থাপিত হবে"
      >
        {loadingFiles ? (
          <p className="py-10 text-center text-[12px] text-muted">ব্যাকআপ খোঁজা হচ্ছে…</p>
        ) : files.length ? (
          <div className="divide-y divide-line">
            {files.map((f) => (
              <div key={f.id} className="flex items-center gap-3 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                  <FileJson className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold text-ink">{f.name}</p>
                  <p className="text-[10.5px] text-muted">
                    {f.createdTime
                      ? new Date(f.createdTime).toLocaleString("bn-BD")
                      : "তারিখ অজানা"}
                    {f.size ? ` · ${(Number(f.size) / 1024).toFixed(0)} KB` : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="soft"
                  loading={restoreBusy}
                  onClick={() => restoreFromDrive(f)}
                >
                  <FolderOpen className="size-3.5" /> রিস্টোর
                </Button>
                <button
                  onClick={async () => {
                    try {
                      const token = await requireToken();
                      if (!token) return;
                      await deleteBackup(token, f.id);
                      setFiles((prev) => prev.filter((x) => x.id !== f.id));
                      toast("ব্যাকআপ মুছে ফেলা হয়েছে");
                    } catch (err) {
                      toast((err as Error).message || "মুছে ফেলা যায়নি", "error");
                    }
                  }}
                  aria-label="ব্যাকআপ মুছুন"
                  className="grid size-8 place-items-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-10 text-center">
            <Cloud className="mx-auto size-8 text-muted" />
            <p className="mt-2 text-[12px] font-semibold text-ink">কোনো ব্যাকআপ পাওয়া যায়নি</p>
            <p className="mt-1 text-[11px] text-muted">আগে “এখনই ব্যাকআপ নিন” চাপুন।</p>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!catToDelete}
        onClose={() => setCatToDelete(null)}
        title={`“${catToDelete?.name}” খাত মুছবেন?`}
        message="পুরোনো লেনদেনে খাতের নাম থেকে যাবে, কিন্তু নতুন লেনদেনে এটি আর দেখাবে না।"
        confirmText="খাত মুছুন"
        danger={false}
        onConfirm={() => catToDelete && deleteCategory(catToDelete)}
      />

      <ConfirmDialog
        open={!!pendingPayload}
        onClose={() => setPendingPayload(null)}
        title="ব্যাকআপ থেকে রিস্টোর করবেন?"
        message={`“${pendingSource}” থেকে ডেটা ফিরিয়ে আনা হবে। বর্তমান সব লেনদেন, টেমপ্লেট ও দেনা-পাওনা প্রতিস্থাপিত হবে।`}
        confirmText="রিস্টোর করুন"
        danger={false}
        loading={restoreBusy}
        onConfirm={confirmRestore}
      />

      <ConfirmDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        title="সব ডেটা মুছে ফেলবেন?"
        message="লেনদেন, টেমপ্লেট, ব্যক্তি ও দেনা-পাওনার সব তথ্য স্থায়ীভাবে মুছে যাবে। সেটিংস ও অ্যাকাউন্ট থাকবে। আগে ব্যাকআপ নেওয়ার পরামর্শ রইল।"
        loading={clearing}
        onConfirm={async () => {
          setClearing(true);
          try {
            await clearAllData();
            toast("সব ডেটা মুছে ফেলা হয়েছে");
            setClearOpen(false);
          } catch (err) {
            toast((err as Error).message || "মুছে ফেলা যায়নি", "error");
          } finally {
            setClearing(false);
          }
        }}
      />

      <p className="mt-6 text-center text-[10.5px] tabular text-muted">
        হিসাব · {VERSION_LABEL}
      </p>
    </div>
  );
}
