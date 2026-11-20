"use client";

import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileUp,
  FolderOpen,
  Info,
  Sparkles,
  Trash2,
  Users,
  WandSparkles,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type DragEvent, type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Progress,
  SectionTitle,
  Segmented,
  Select,
  useToast,
} from "@/components/ui";
import { useData } from "@/lib/data";
import { type AutoSetupPlan, analyzeAutoSetup } from "@/lib/importers/auto-setup";
import { canonicalPerson, type MergeReport, mergeBatches } from "@/lib/importers/canonical";
import { knownFingerprints, recordImport, wasImported } from "@/lib/importers/history";
import { rowFingerprint } from "@/lib/importers/normalize";
import { parseImportFile } from "@/lib/importers/parse-file";
import { filterDuplicates, kindLabel } from "@/lib/importers/parse-tabular";
import type {
  ImportKind,
  ParsedBatch,
  ParsedRow,
  ProgressCallback,
} from "@/lib/importers/types";
import type { Category, Settings } from "@/lib/types";
import { formatMoney, uid } from "@/lib/utils";

type Mode = "review" | "fast";

const DEBT_DIRECTIONS: Array<{ value: NonNullable<ParsedRow["debtDirection"]>; label: string }> = [
  { value: "lent", label: "টাকা দিয়েছি" },
  { value: "borrowed", label: "টাকা নিয়েছি" },
  { value: "lent_repaid", label: "ফেরত পেয়েছি" },
  { value: "borrowed_repaid", label: "ফেরত দিয়েছি" },
];

function SetupToggle({
  checked,
  onChange,
  icon,
  title,
  items,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  icon: ReactNode;
  title: string;
  items: string[];
}) {
  if (!items.length) return null;
  return (
    <label className="flex cursor-pointer gap-2.5 rounded-xl border border-line bg-surface-2/40 p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 accent-[rgb(var(--brand))]"
      />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-[12px] font-bold text-ink">
          {icon}
          {title} <span className="font-normal text-muted">({items.length})</span>
        </span>
        <span className="mt-1 block text-[10.5px] leading-relaxed text-muted">
          {items.slice(0, 8).join(" · ")}
          {items.length > 8 ? " …" : ""}
        </span>
      </span>
    </label>
  );
}

function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function batchToCsv(rows: ParsedRow[]): string {
  const quote = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [["তারিখ", "ধরন", "খাত", "বিবরণ", "টাকা", "অ্যাকাউন্ট"].map(quote).join(",")];
  for (const r of rows) {
    lines.push([r.date, kindLabel(r.kind), r.category, r.description, r.amount, r.account || ""].map(quote).join(","));
  }
  return `\uFEFF${lines.join("\n")}`;
}

export default function ImportPage() {
  const router = useRouter();
  const toast = useToast();
  const {
    transactions,
    contacts,
    folders,
    settings,
    addTransactionsBulk,
    addContact,
    addDebt,
    addFolder,
    updateFolder,
    updateSettings,
    ready,
  } = useData();

  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("review");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("");
  const [percent, setPercent] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [batch, setBatch] = useState<ParsedBatch | null>(null);
  const [draft, setDraft] = useState<ParsedRow[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [sources, setSources] = useState<ParsedBatch[]>([]);
  const [mergeReport, setMergeReport] = useState<MergeReport | null>(null);
  const [account, setAccount] = useState("ব্যাংক");
  const [saved, setSaved] = useState<{ tx: number; debts: number; name: string } | null>(null);
  const [setupPlan, setSetupPlan] = useState<AutoSetupPlan | null>(null);
  const [setupOn, setSetupOn] = useState({
    categories: true,
    folders: true,
    persons: true,
    ceremonies: true,
  });

  const categoryNames = useMemo(() => {
    const base = settings.categories.map((c) => c.name);
    const extra = draft.map((r) => r.category).filter((c) => !base.includes(c));
    return [...base, ...new Set(extra)];
  }, [settings.categories, draft]);

  const summary = useMemo(() => {
    const selected = draft.filter((r) => r.selected);
    const expense = selected.filter((r) => r.kind === "expense").reduce((s, r) => s + r.amount, 0);
    const income = selected.filter((r) => r.kind === "income").reduce((s, r) => s + r.amount, 0);
    const debts = selected.filter((r) => r.kind === "debt").length;
    const dates = selected.map((r) => r.date).filter(Boolean).sort();
    return {
      count: selected.length,
      expense,
      income,
      debts,
      from: dates[0] || "",
      to: dates[dates.length - 1] || "",
      lowConfidence: selected.filter((r) => r.confidence < 0.5).length,
    };
  }, [draft]);

  /** বাছাই করা রো আর ফাইলে লেখা মোটের মিল যাচাই — সেভের আগে কড়া গেট */
  const matchCheck = useMemo(() => {
    if (!batch || !draft.length) return null;
    const selected = draft.filter((r) => r.selected);
    const total = Math.round(
      selected.filter((r) => r.kind === "expense").reduce((s, r) => s + r.amount, 0) * 100,
    ) / 100;
    const declaredTotals = (mergeReport?.declaredTotals || []).map((v) => Math.round(v * 100) / 100);
    const declared = declaredTotals[0] ?? batch.meta.declaredTotal ?? null;
    const ok = declaredTotals.length === 0 || declaredTotals.every((v) => Math.abs(v - total) < 0.5);
    return {
      count: selected.length,
      total,
      declared,
      ok,
      blocked: declaredTotals.length > 0 && !ok,
      conflicts: mergeReport?.conflicts || [],
      coverage: mergeReport?.coverage || {},
      matched: mergeReport?.matchedAcrossSources || 0,
    };
  }, [batch, draft, mergeReport]);

  const patch = useCallback((id: string, change: Partial<ParsedRow>) => {
    setDraft((prev) => prev.map((r) => (r.id === id ? { ...r, ...change } : r)));
  }, []);

  /** ফোল্ডার → খাত → পার্সন তৈরি করে রো-ভিত্তিক পার্সন ম্যাপ ফেরত দেয় */
  const applySetup = useCallback(
    async (plan: AutoSetupPlan | null): Promise<Record<string, string>> => {
      if (!plan) return {};
      const byName = new Map(folders.map((f) => [f.name.trim().toLowerCase(), f]));
      const ids = new Map<string, string>();
      const enabled = (f: (typeof plan.folders)[number]) =>
        f.kind === "ceremony" ? setupOn.ceremonies : setupOn.folders;

      // বাবা আগে, ছেলে পরে — একই নামের ফোল্ডার আছে নতুন করে বানাই না
      const ordered = [...plan.folders].sort((a, b) => Number(!!a.parentName) - Number(!!b.parentName));
      for (const f of ordered) {
        if (!enabled(f)) continue;
        const parentId = f.parentName
          ? ids.get(f.parentName.trim().toLowerCase()) || byName.get(f.parentName.trim().toLowerCase())?.id
          : undefined;
        const existing = byName.get(f.name.trim().toLowerCase());
        if (existing) {
          if (parentId && existing.parentId !== parentId) await updateFolder(existing.id, { parentId });
          ids.set(f.name.trim().toLowerCase(), existing.id);
          continue;
        }
        const created = await addFolder({
          name: f.name,
          emoji: f.emoji,
          color: f.color,
          ...(parentId ? { parentId } : {}),
        });
        ids.set(f.name.trim().toLowerCase(), created.id);
        byName.set(f.name.trim().toLowerCase(), created);
      }

      const settingsPatch: Partial<Settings> = {};
      if (setupOn.categories) {
        const knownCats = new Set(settings.categories.map((c) => c.name.trim().toLowerCase()));
        const freshNames = plan.categories.filter((name) => !knownCats.has(name.trim().toLowerCase()));
        const cats: Category[] = freshNames.map((name) => {
          const parent = plan.folders.find((f) => enabled(f) && f.categories.includes(name));
          const folderId = parent ? ids.get(parent.name.trim().toLowerCase()) : undefined;
          return {
            id: uid(),
            name,
            emoji: "🏷️",
            color: "#0C906A",
            type: "both",
            ...(folderId ? { folderId } : {}),
          };
        });
        if (cats.length) settingsPatch.categories = [...settings.categories, ...cats];
      }
      if (setupOn.persons) {
        const knownPeople = new Set(settings.familyMembers.map((p) => p.trim().toLowerCase()));
        const fresh = plan.persons.filter((p) => !knownPeople.has(p.trim().toLowerCase()));
        if (fresh.length) settingsPatch.familyMembers = [...settings.familyMembers, ...fresh];
      }
      if (Object.keys(settingsPatch).length) await updateSettings(settingsPatch);
      return setupOn.persons ? plan.personByRowId : {};
    },
    [setupOn, addFolder, updateFolder, updateSettings, folders, settings.categories, settings.familyMembers],
  );

  const saveRows = useCallback(
    async (
      rows: ParsedRow[],
      sourceName: string,
      _fileHash: string,
      plan?: AutoSetupPlan | null,
      sourceList?: ParsedBatch[],
    ) => {
      const valid = rows.filter((r) => r.selected && r.date && r.amount > 0);
      if (!valid.length) {
        toast("সেভ করার মতো কোনো লেনদেন নেই — তারিখ ও টাকা চেক করুন।", "error");
        return;
      }
      if (matchCheck?.blocked) {
        toast("ফাইলে লেখা মোট আর শনাক্ত করা মোট মিলছে না — প্রথমে রিভিউ করুন।", "error");
        return;
      }
      setBusy(true);
      setPhase("সেভ করছি…");
      setPercent(96);
      try {
        const activePlan = plan === undefined ? setupPlan : plan;
        // পার্সন ম্যাপ আগে নিই, কিন্তু ফোল্ডার/খাত তৈরি করি লেনদেন সেভ হওয়ার পরে —
        // সেভ ব্যর্থ হলে আধ-গোছা ফোল্ডার থেকে যাবে না।
        const personById = setupOn.persons ? activePlan?.personByRowId || {} : {};
        const txInputs = valid
          .filter((r) => r.kind !== "debt")
          .map((r) => {
            const person = personById[r.id] || (setupOn.persons && r.person ? canonicalPerson(r.person) : "");
            return {
              type: (r.kind === "income" ? "income" : "expense") as "income" | "expense",
              amount: r.amount,
              category: r.category || "অন্যান্য",
              account: r.account || account,
              note: r.description,
              date: r.date,
              ...(person ? { familyMember: person } : {}),
            };
          });
        const created = await addTransactionsBulk(txInputs);

        let debtCount = 0;
        const debtRows = valid.filter((r) => r.kind === "debt");
        for (const row of debtRows) {
          const name = row.description.trim() || "অজানা";
          let contact = contacts.find((c) => c.name.trim().toLowerCase() === name.toLowerCase());
          if (!contact) {
            contact = await addContact({ name, phone: "", note: "ইম্পোর্ট করা" });
          }
          await addDebt({
            contactId: contact.id,
            contactName: contact.name,
            kind: row.debtDirection || "borrowed",
            amount: row.amount,
            note: `${row.description} · ${sourceName}`,
            date: row.date,
          });
          debtCount++;
        }

        let setupNote = "";
        try {
          await applySetup(activePlan);
        } catch {
          setupNote = " তবে ফোল্ডার/খাত তৈরি করা যায়নি — সেটিংস থেকে বানিয়ে নিন।";
        }

        const fromList = sourceList || sources;
        const imported = fromList.length ? fromList : [{ sourceName, fileHash: _fileHash } as ParsedBatch];
        for (const src of imported) {
          recordImport({
            hash: src.fileHash,
            name: src.sourceName,
            at: Date.now(),
            count: valid.length,
            fingerprints: valid.map((r) => r.fingerprint || rowFingerprint(r.date, r.amount, r.description)),
          });
        }
        setSaved({ tx: created.length, debts: debtCount, name: sourceName });
        setBatch(null);
        setDraft([]);
        setSources([]);
        setMergeReport(null);
        setSetupPlan(null);
        setSetupOn({ categories: true, folders: true, persons: true, ceremonies: true });
        toast(`${created.length + debtCount} টি লেনদেন সেভ হয়েছে ✅${setupNote}`, setupNote ? "info" : "success");
      } catch (err) {
        toast(err instanceof Error ? err.message : "সেভ করা যায়নি।", "error");
      } finally {
        setBusy(false);
        setPercent(0);
      }
    },
    [account, addContact, addDebt, addTransactionsBulk, applySetup, contacts, matchCheck, setupOn, setupPlan, sources, toast],
  );

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      const defaults = { categories: true, folders: true, persons: true, ceremonies: true };
      setSaved(null);
      setSetupPlan(null);
      setMergeReport(null);
      setSources([]);
      setBatch(null);
      setDraft([]);
      setSkipped(0);
      setSetupOn(defaults);
      setBusy(true);
      setPercent(2);
      setPhase("ফাইল খোলা হচ্ছে…");
      try {
        const parsed: ParsedBatch[] = [];
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const onProgress: ProgressCallback = (p) => {
            setPhase(p.phase);
            setPercent(Math.round(((i + p.percent / 100) / files.length) * 95));
          };
          const result = await parseImportFile(file, onProgress);
          if (wasImported(result.fileHash)) {
            toast(`${file.name} — আগেই ইম্পোর্ট করা হয়েছে, বাদ দিলাম।`, "info");
            continue;
          }
          parsed.push(result);
        }
        if (!parsed.length) {
          toast("সব ফাইল আগেই ইম্পোর্ট করা হয়েছে — নতুন করে কিছু যোগ করা হয়নি।", "info");
          return;
        }

        // একাধিক ফাইল — JSON > Excel > PDF ক্রমে একই লেনদেন চিনে কলাম মেলাই
        const merged = mergeBatches(parsed, settings.categories.map((c) => c.name));
        const declared = parsed.find((p) => p.meta.declaredTotal != null)?.meta.declaredTotal;
        const primary = parsed[0];
        const combined: ParsedBatch = {
          rows: merged.rows,
          warnings: parsed.flatMap((p) => p.warnings.map((w) => `${p.sourceName}: ${w}`)),
          sourceName: parsed.map((p) => p.sourceName).join(" + "),
          fileHash: parsed.map((p) => p.fileHash).join("|"),
          meta: { ...primary.meta, declaredTotal: declared },
        };

        // আগের ইম্পোর্ট + বর্তমান লেনদেন — দুই জায়গা থেকে ডুপ্লিকেট চেক
        const known = knownFingerprints();
        for (const tx of transactions) {
          known.add(rowFingerprint(tx.date, tx.amount, tx.note || tx.category));
        }
        const { fresh, duplicates } = filterDuplicates(merged.rows, known);
        setSkipped(duplicates);
        setSources(parsed);
        setMergeReport(merged.report);
        setBatch(combined);
        const plan = analyzeAutoSetup(merged.rows, {
          categories: settings.categories.map((c) => c.name),
          folders: folders.map((f) => f.name),
          familyMembers: settings.familyMembers,
          contacts: contacts.map((c) => c.name),
        });
        setSetupPlan(plan);

        if (!fresh.length) {
          setDraft([]);
          toast("সব লেনদেনই আগে থেকে আছে — কিছু যোগ করা হয়নি।", "info");
          return;
        }
        const hasSetup = plan.categories.length || plan.folders.length || plan.persons.length;
        // নতুন খাত/ফোল্ডার থাকলে "দ্রুত" মোডেও আগে রিভিউ দেখাই
        if (mode === "fast" && !hasSetup) {
          await saveRows(fresh, combined.sourceName, combined.fileHash, plan, parsed);
        } else {
          setDraft(fresh);
          toast(
            hasSetup
              ? `${fresh.length} টি লেনদেন পাওয়া গেছে — নতুন খাত/ফোল্ডারও শনাক্ত, রিভিউ করে সেভ করুন।`
              : `${fresh.length} টি লেনদেন পাওয়া গেছে — রিভিউ করে সেভ করুন।`,
            "info",
          );
        }
      } catch (err) {
        toast(err instanceof Error ? err.message : "ফাইল পড়া যায়নি।", "error");
      } finally {
        setBusy(false);
        setPercent(0);
      }
    },
    [contacts, folders, mode, saveRows, settings.categories, settings.familyMembers, toast, transactions],
  );

  const onDrop = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length) void handleFiles(files);
  };

  return (
    <>
      <PageHeader
        title="স্মার্ট ইম্পোর্ট"
        subtitle="পুরোনো অ্যাপের PDF, CSV, Excel বা যেকোনো ফাইল থেকে হিসাব আনুন"
      />

      {/* আপলোড */}
      <Card className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[13px] font-bold text-ink">ফাইল দিন</p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
              PDF, CSV, XLSX, JSON বা ইমেজ — একসাথে একাধিক ফাইল দিতে পারবেন। একই লেনদেন
              বিভিন্ন ফাইলে থাকলে চিনে নতুন তথ্য যোগ করা হয়; সব কাজ এই ফোনেই হয়।
            </p>
          </div>
          <Segmented<Mode>
            value={mode}
            onChange={setMode}
            options={[
              { value: "review", label: "রিভিউ সহ", icon: <WandSparkles className="size-3.5" /> },
              { value: "fast", label: "দ্রুত", icon: <Sparkles className="size-3.5" /> },
            ]}
            className="w-full sm:w-auto"
          />
        </div>

        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".pdf,.csv,.tsv,.txt,.xlsx,.json,.log,.dat,.png,.jpg,.jpeg,.webp,*/*"
          className="hidden"
          disabled={busy || !ready}
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            e.target.value = "";
            if (files.length) void handleFiles(files);
          }}
        />
        <button
          type="button"
          disabled={busy || !ready}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`mt-4 grid w-full cursor-pointer place-items-center rounded-xl border-2 border-dashed px-5 py-9 text-center transition disabled:opacity-60 ${
            dragging ? "border-brand bg-brand-soft" : "border-line bg-surface-2/40 hover:border-brand/50"
          }`}
        >
          <div className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand">
            <FileUp className="size-6" />
          </div>
          <p className="mt-3 text-sm font-bold text-ink">ফাইল এখানে টেনে আনুন বা ট্যাপ করুন</p>
          <p className="mt-1 text-[11px] text-muted">একসাথে একাধিক ফাইল বেছে নিন — PDF, Excel, JSON, CSV</p>
        </button>

        {busy ? (
          <div className="mt-4 rounded-xl border border-line bg-surface-2/40 p-4">
            <div className="flex items-center justify-between text-xs font-semibold text-ink">
              <span>{phase}</span>
              <span className="tabular text-muted">{percent}%</span>
            </div>
            <Progress value={percent} className="mt-2.5" />
          </div>
        ) : null}
      </Card>

      {/* সতর্কতা */}
      {batch?.warnings.length ? (
        <Card className="mt-4 border-warn/30 bg-warn/5 p-4">
          <div className="flex gap-2.5">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-warn" />
            <div className="space-y-1">
              {batch.warnings.map((w) => (
                <p key={w} className="text-[12px] leading-relaxed text-ink">{w}</p>
              ))}
            </div>
          </div>
        </Card>
      ) : null}

      {/* মোট মিল যাচাই */}
      {batch && matchCheck ? (
        <Card
          className={`mt-4 p-4 ${
            matchCheck.declared == null
              ? "border-line"
              : matchCheck.ok
                ? "border-brand/30 bg-brand-soft/40"
                : "border-warn/40 bg-warn/5"
          }`}
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <div className="flex items-center gap-2">
              {matchCheck.ok ? (
                <CheckCircle2 className="size-4 shrink-0 text-brand" />
              ) : (
                <Info className="size-4 shrink-0 text-warn" />
              )}
              <p className="text-[12px] font-bold text-ink">মোট মিল যাচাই</p>
            </div>
            <p className="text-[12px] text-muted">
              শনাক্ত <b className="tabular text-ink">{matchCheck.count} টি</b> ={" "}
              <b className="tabular text-ink">
                {formatMoney(matchCheck.total, { bengali: settings.bengaliNumerals })}
              </b>
            </p>
            {matchCheck.declared != null ? (
              <p className="text-[12px] text-muted">
                PDF-এ লেখা মোট{" "}
                <b className="tabular text-ink">
                  {formatMoney(matchCheck.declared, { bengali: settings.bengaliNumerals })}
                </b>{" "}
                →{" "}
                {matchCheck.ok ? (
                  <b className="text-brand">✅ মিলে গেছে</b>
                ) : (
                  <b className="text-warn">⚠️ মিলছে না — রিভিউ করুন</b>
                )}
              </p>
            ) : (
              <p className="text-[11.5px] text-muted">এই ফাইলে লেখা মোট পাওয়া যায়নি।</p>
            )}
          </div>
        </Card>
      ) : null}

      {/* বহু-ফাইল মিলানোর বিবরণ */}
      {mergeReport ? (
        <Card className="mt-4 p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-brand" />
            <p className="text-[13px] font-bold text-ink">ফাইল মিলানোর হিসাব</p>
            <span className="text-[10.5px] text-muted">JSON → Excel → PDF ক্রমে বিশ্বস্ত</span>
          </div>
          <div className="mt-3 grid gap-2 text-[11.5px] text-muted sm:grid-cols-3">
            <p>মোট ফাইল: <b className="text-ink">{mergeReport.sources.length}</b></p>
            <p>একাধিক ফাইলে মিলেছে: <b className="text-ink">{mergeReport.matchedAcrossSources} টি</b></p>
            <p>মোট লেনদেন: <b className="text-ink">{mergeReport.clusters} টি</b></p>
          </div>
          {mergeReport.sources.length ? (
            <p className="mt-2 text-[10.5px] leading-relaxed text-muted">
              {mergeReport.sources.map((s) => `${s.name} (${s.rows})`).join(" · ")}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10.5px] text-muted">
            {Object.entries(mergeReport.coverage).map(([field, n]) => (
              <span key={field}>{field}: <b className="text-ink">{n}</b></span>
            ))}
          </div>
          {matchCheck?.conflicts.length ? (
            <p className="mt-2 text-[11px] leading-relaxed text-warn">
              ⚠️ {matchCheck.conflicts.length} টি কলামে আলাদা মান পাওয়া গেছে — রিভিউতে ঠিক করে নিন।
            </p>
          ) : null}
          {matchCheck?.blocked ? (
            <p className="mt-2 rounded-lg bg-warn/10 p-2 text-[11px] font-semibold text-warn">
              ফাইলে লেখা মোটের সাথে শনাক্ত করা মোটের মিল নেই। সেভ করার আগে লেনদেনগুলো যাচাই করুন।
            </p>
          ) : null}
        </Card>
      ) : null}

      {/* অটো-সেটআপ প্রিভিউ */}
      {setupPlan &&
      (setupPlan.categories.length || setupPlan.folders.length || setupPlan.persons.length) ? (
        <Card className="mt-4 p-4">
          <div className="flex items-center gap-2">
            <FolderOpen className="size-4 text-brand" />
            <p className="text-[13px] font-bold text-ink">অটো-সেটআপ প্রিভিউ</p>
            <span className="text-[10.5px] text-muted">অনুমান — যেগুলো না চান চেক বাদ দিন</span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <SetupToggle
              checked={setupOn.categories}
              onChange={(v) => setSetupOn((s) => ({ ...s, categories: v }))}
              icon={<span className="text-[13px]">🏷️</span>}
              title="নতুন খাত"
              items={setupPlan.categories}
            />
            <SetupToggle
              checked={setupOn.folders}
              onChange={(v) => setSetupOn((s) => ({ ...s, folders: v }))}
              icon={<FolderOpen className="size-3.5" />}
              title="নতুন ফোল্ডার"
              items={setupPlan.folders.filter((f) => f.kind !== "ceremony").map((f) =>
                f.parentName ? `${f.parentName} › ${f.name}` : f.name,
              )}
            />
            <SetupToggle
              checked={setupOn.persons}
              onChange={(v) => setSetupOn((s) => ({ ...s, persons: v }))}
              icon={<Users className="size-3.5" />}
              title="নতুন পার্সন"
              items={setupPlan.persons}
            />
            <SetupToggle
              checked={setupOn.ceremonies}
              onChange={(v) => setSetupOn((s) => ({ ...s, ceremonies: v }))}
              icon={<span className="text-[13px]">🎉</span>}
              title="অনুষ্ঠানের ফোল্ডার"
              items={setupPlan.folders.filter((f) => f.kind === "ceremony").map((f) => f.name)}
            />
          </div>
          <p className="mt-2.5 text-[10.5px] leading-relaxed text-muted">
            সেভ করার সময় এগুলো তৈরি হবে। ভুল হলে পরে সেটিংস → খাত থেকে বদলানো যাবে।
          </p>
        </Card>
      ) : null}

      {/* সেভের পর ফলাফল */}
      {saved ? (
        <Card className="mt-4 border-brand/30 bg-brand-soft/40 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brand" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-ink">ইম্পোর্ট সম্পন্ন</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                <b className="text-ink">{saved.name}</b> থেকে {saved.tx} টি লেনদেন
                {saved.debts ? ` ও ${saved.debts} টি দেনা-পাওনা` : ""} সেভ হয়েছে।
                দুই সাইটেই সিঙ্ক হবে। মাস ও দিন অনুযায়ী লেনদেন পেজে দেখা যাবে।
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => router.push("/transactions?month=all")}>লেনদেন দেখুন</Button>
                <Button size="sm" variant="outline" onClick={() => setSaved(null)}>আরেকটি ফাইল</Button>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {/* রিভিউ */}
      {batch && draft.length ? (
        <section className="mt-5">
          <SectionTitle
            title="রিভিউ করুন"
            subtitle={`${batch.sourceName} · ${batch.meta.parser.toUpperCase()}${batch.meta.pages ? ` · ${batch.meta.pages} পৃষ্ঠা` : ""}${skipped ? ` · ${skipped} টি ডুপ্লিকেট বাদ` : ""}`}
          />

          <Card className="mb-3 grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
            <div>
              <p className="text-[10.5px] text-muted">মোট নির্বাচিত</p>
              <p className="mt-0.5 text-lg font-extrabold tabular text-ink">{summary.count}</p>
            </div>
            <div>
              <p className="text-[10.5px] text-muted">ব্যয়</p>
              <p className="mt-0.5 text-lg font-extrabold tabular text-danger">
                {formatMoney(summary.expense, { bengali: settings.bengaliNumerals })}
              </p>
            </div>
            <div>
              <p className="text-[10.5px] text-muted">আয়</p>
              <p className="mt-0.5 text-lg font-extrabold tabular text-brand">
                {formatMoney(summary.income, { bengali: settings.bengaliNumerals })}
              </p>
            </div>
            <div>
              <p className="text-[10.5px] text-muted">সময়সীমা</p>
              <p className="mt-0.5 truncate text-[12px] font-bold text-ink">
                {summary.from || "—"} {summary.to && summary.to !== summary.from ? `→ ${summary.to}` : ""}
              </p>
            </div>
          </Card>

          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5">
            <span className="text-[11.5px] font-semibold text-muted">সবগুলোর অ্যাকাউন্ট</span>
            <Select value={account} onChange={(e) => setAccount(e.target.value)} className="h-9 w-auto py-0 text-xs">
              {settings.accounts.map((a) => <option key={a} value={a}>{a}</option>)}
            </Select>
            {summary.lowConfidence ? (
              <Badge tone="warn"><AlertCircle className="size-3" /> {summary.lowConfidence} টি যাচাই করুন</Badge>
            ) : null}
            <div className="ml-auto flex gap-1.5">
              <Button variant="ghost" size="sm" onClick={() => setDraft((prev) => prev.map((r) => ({ ...r, selected: true })))}>
                সব বেছে নিন
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setDraft((prev) => prev.map((r) => ({ ...r, selected: false })))}>
                কিছুই না
              </Button>
            </div>
          </div>

          <Card className="overflow-hidden">
            <div className="overscroll-x-contain overflow-x-auto">
              <div className="min-w-[780px]">
                <div className="grid grid-cols-[36px_130px_1fr_110px_115px_130px_32px] gap-2 border-b border-line bg-surface-2/60 px-3 py-2 text-[10.5px] font-bold text-muted">
                  <span></span><span>তারিখ</span><span>বিবরণ</span><span>টাকা</span><span>ধরন</span><span>খাত</span><span></span>
                </div>
                <div className="divide-y divide-line">
                  {draft.map((row) => (
                    <div
                      key={row.id}
                      className={`grid grid-cols-[36px_130px_1fr_110px_115px_130px_32px] items-center gap-2 px-3 py-2 ${
                        row.selected ? "" : "opacity-45"
                      }`}
                    >
                      <input
                        type="checkbox"
                        aria-label="নির্বাচন"
                        checked={row.selected}
                        onChange={(e) => patch(row.id, { selected: e.target.checked })}
                        className="size-4 accent-[rgb(var(--brand))]"
                      />
                      <Input
                        type="date"
                        value={row.date}
                        onChange={(e) => patch(row.id, { date: e.target.value })}
                        className="h-9 px-2 text-[11px]"
                      />
                      <div title={row.raw}>
                        <Input
                          value={row.description}
                          onChange={(e) => patch(row.id, { description: e.target.value })}
                          className="h-9 px-2 text-[12px]"
                        />
                        {row.confidence < 0.5 ? (
                          <p className="mt-0.5 text-[9.5px] font-semibold text-warn">কম নিশ্চিত — দেখে নিন</p>
                        ) : null}
                      </div>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.amount || ""}
                        onChange={(e) => patch(row.id, { amount: Number(e.target.value) })}
                        className="h-9 px-2 text-[12px] tabular"
                      />
                      <Select
                        value={row.kind}
                        onChange={(e) => {
                          const kind = e.target.value as ImportKind;
                          patch(row.id, {
                            kind,
                            category: kind === "income" ? "বেতন" : kind === "debt" ? "দেনা-পাওনা" : "অন্যান্য",
                          });
                        }}
                        className="h-9 px-1.5 text-[11px]"
                      >
                        <option value="expense">ব্যয়</option>
                        <option value="income">আয়</option>
                        <option value="debt">দেনা-পাওনা</option>
                      </Select>
                      <div>
                        <Select
                          value={row.category}
                          onChange={(e) => patch(row.id, { category: e.target.value })}
                          className="h-9 px-1.5 text-[11px]"
                        >
                          {categoryNames.map((c) => <option key={c} value={c}>{c}</option>)}
                        </Select>
                        {row.kind === "debt" ? (
                          <Select
                            value={row.debtDirection || "borrowed"}
                            onChange={(e) => patch(row.id, { debtDirection: e.target.value as NonNullable<ParsedRow["debtDirection"]> })}
                            className="mt-1 h-7 px-1 text-[10px]"
                          >
                            {DEBT_DIRECTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                          </Select>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        aria-label="সরান"
                        onClick={() => setDraft((prev) => prev.filter((r) => r.id !== row.id))}
                        className="grid size-7 place-items-center rounded-lg text-muted transition hover:bg-danger/10 hover:text-danger"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              loading={busy}
              disabled={!summary.count || matchCheck?.blocked}
              onClick={() => batch && void saveRows(draft, batch.sourceName, batch.fileHash, setupPlan, sources)}
            >
              <CheckCircle2 className="size-4" /> {summary.count} টি সেভ করুন
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (!batch) return;
                downloadText(
                  `hishab-import-${batch.sourceName.replace(/\.[^.]+$/, "")}.json`,
                  JSON.stringify({ source: batch.sourceName, importedAt: new Date().toISOString(), rows: draft }, null, 2),
                  "application/json",
                );
                toast("JSON ব্যাকআপ ডাউনলোড হয়েছে।", "success");
              }}
            >
              <Download className="size-4" /> JSON
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (!batch) return;
                downloadText(
                  `hishab-import-${batch.sourceName.replace(/\.[^.]+$/, "")}.csv`,
                  batchToCsv(draft),
                  "text/csv;charset=utf-8",
                );
                toast("CSV ব্যাকআপ ডাউনলোড হয়েছে।", "success");
              }}
            >
              <Download className="size-4" /> CSV
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setBatch(null);
                setDraft([]);
                setSkipped(0);
                setSetupPlan(null);
                setSources([]);
                setMergeReport(null);
                setSetupOn({ categories: true, folders: true, persons: true, ceremonies: true });
              }}
            >
              <Trash2 className="size-4" /> বাতিল
            </Button>
          </div>
        </section>
      ) : null}

      {/* কোনো ফাইল দেওয়া হয়নি */}
      {!batch && !saved && !busy ? (
        <Card className="mt-4">
          <EmptyState
            icon={FileSpreadsheet}
            title="আগের হিসাব এখানে আনুন"
            message="ব্যাংক স্টেটমেন্ট, পুরোনো অ্যাপের এক্সপোর্ট বা স্ক্যান করা রিসিট — ফাইল দিলেই অ্যাপ নিজে থেকে তারিখ, টাকা ও খাত বের করবে।"
          />
        </Card>
      ) : null}

      <Card className="mt-5 p-4">
        <div className="flex gap-2.5">
          <Info className="mt-0.5 size-4 shrink-0 text-brand" />
          <div className="space-y-1 text-[11.5px] leading-relaxed text-muted">
            <p><b className="text-ink">কীভাবে কাজ করে:</b> একাধিক ফাইল দিলে প্রথমে JSON, তারপর Excel/CSV, শেষে PDF-এর তথ্য নেওয়া হয়। একই লেনদেনের নতুন কলাম (যেমন JSON-এর ফোল্ডার বা পার্সন) পুরোনো রোতে যোগ হয় — টাকা বা সংখ্যা বাড়ে না।</p>
            <p>ফাইলে লেখা মোট আর শনাক্ত করা মোট না মিললে সেভ আটকে যায়। ডুপ্লিকেট আগে থেকে থাকলে বাদ দেওয়া হয়, কিন্তু একই দিনের আসল দুটি লেনদেন থাকে। সব কাজ ব্রাউজারেই হয় — আপনার ফাইল কোথাও আপলোড হয় না।</p>
          </div>
        </div>
      </Card>
    </>
  );
}
