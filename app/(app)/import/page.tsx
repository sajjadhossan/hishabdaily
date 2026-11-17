"use client";

import { useCallback, useMemo, useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileUp,
  Info,
  Sparkles,
  Trash2,
  WandSparkles,
  X,
} from "lucide-react";
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
import { formatMoney, isoDate } from "@/lib/utils";

type Mode = "review" | "fast";

const DEBT_DIRECTIONS: Array<{ value: NonNullable<ParsedRow["debtDirection"]>; label: string }> = [
  { value: "lent", label: "টাকা দিয়েছি" },
  { value: "borrowed", label: "টাকা নিয়েছি" },
  { value: "lent_repaid", label: "ফেরত পেয়েছি" },
  { value: "borrowed_repaid", label: "ফেরত দিয়েছি" },
];

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
    settings,
    addTransactionsBulk,
    addContact,
    addDebt,
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
  const [account, setAccount] = useState("ব্যাংক");
  const [saved, setSaved] = useState<{ tx: number; debts: number; name: string } | null>(null);

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

  const patch = useCallback((id: string, change: Partial<ParsedRow>) => {
    setDraft((prev) => prev.map((r) => (r.id === id ? { ...r, ...change } : r)));
  }, []);

  const saveRows = useCallback(
    async (rows: ParsedRow[], sourceName: string, fileHash: string) => {
      const valid = rows.filter((r) => r.selected && r.date && r.amount > 0);
      if (!valid.length) {
        toast("সেভ করার মতো কোনো লেনদেন নেই — তারিখ ও টাকা চেক করুন।", "error");
        return;
      }
      setBusy(true);
      setPhase("সেভ করছি…");
      setPercent(96);
      try {
        const txInputs = valid
          .filter((r) => r.kind !== "debt")
          .map((r) => ({
            type: (r.kind === "income" ? "income" : "expense") as "income" | "expense",
            amount: r.amount,
            category: r.category || "অন্যান্য",
            account: r.account || account,
            note: r.description,
            date: r.date,
          }));
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

        recordImport({
          hash: fileHash,
          name: sourceName,
          at: Date.now(),
          count: valid.length,
          fingerprints: valid.map((r) => r.fingerprint || rowFingerprint(r.date, r.amount, r.description)),
        });
        setSaved({ tx: created.length, debts: debtCount, name: sourceName });
        setBatch(null);
        setDraft([]);
        toast(`${created.length + debtCount} টি লেনদেন সেভ হয়েছে ✅`, "success");
      } catch (err) {
        toast(err instanceof Error ? err.message : "সেভ করা যায়নি।", "error");
      } finally {
        setBusy(false);
        setPercent(0);
      }
    },
    [account, addContact, addDebt, addTransactionsBulk, contacts, toast],
  );

  const handleFile = useCallback(
    async (file: File) => {
      setSaved(null);
      setBusy(true);
      setPercent(2);
      setPhase("ফাইল খোলা হচ্ছে…");
      try {
        const onProgress: ProgressCallback = (p) => {
          setPhase(p.phase);
          setPercent(p.percent);
        };
        const result = await parseImportFile(file, onProgress);
        if (!result.rows.length) {
          toast("এই ফাইলে কোনো লেনদেন শনাক্ত করা যায়নি।", "error");
          setBatch(result);
          setDraft([]);
          return;
        }
        if (wasImported(result.fileHash)) {
          toast("এই ফাইলটা আগেই ইম্পোর্ট করা হয়েছে — ডুপ্লিকেট এড়ানো হলো।", "info");
          return;
        }

        // আগের ইম্পোর্ট + বর্তমান লেনদেন — দুই জায়গা থেকে ডুপ্লিকেট চেক
        const known = knownFingerprints();
        for (const tx of transactions) {
          known.add(rowFingerprint(tx.date, tx.amount, tx.note || tx.category));
        }
        const { fresh, duplicates } = filterDuplicates(result.rows, known);
        setSkipped(duplicates);
        setBatch(result);

        if (!fresh.length) {
          setDraft([]);
          toast("সব লেনদেনই আগে থেকে আছে — কিছু যোগ করা হয়নি।", "info");
          return;
        }
        if (mode === "fast") {
          await saveRows(fresh, result.sourceName, result.fileHash);
        } else {
          setDraft(fresh);
          toast(`${fresh.length} টি লেনদেন পাওয়া গেছে — রিভিউ করে সেভ করুন।`, "info");
        }
      } catch (err) {
        toast(err instanceof Error ? err.message : "ফাইল পড়া যায়নি।", "error");
      } finally {
        setBusy(false);
        setPercent(0);
      }
    },
    [mode, saveRows, toast, transactions],
  );

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
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
              PDF (টেক্সট বা স্ক্যান), CSV, TSV, XLSX, JSON বা যেকোনো টেক্সট ফাইল —
              সব কিছু এই ফোনেই পার্স হবে, কোনো ডেটা বাইরে যাবে না।
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

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`mt-4 grid cursor-pointer place-items-center rounded-xl border-2 border-dashed px-5 py-9 text-center transition ${
            dragging ? "border-brand bg-brand-soft" : "border-line bg-surface-2/40 hover:border-brand/50"
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.csv,.tsv,.txt,.xlsx,.json,.log,.dat,*/*"
            className="hidden"
            disabled={busy || !ready}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void handleFile(file);
            }}
          />
          <div className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand">
            <FileUp className="size-6" />
          </div>
          <p className="mt-3 text-sm font-bold text-ink">ফাইল এখানে টেনে আনুন বা ট্যাপ করুন</p>
          <p className="mt-1 text-[11px] text-muted">একবারে একটা ফাইল — চাইলে বারবার দিতে পারবেন</p>
        </div>

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
                <Button size="sm" onClick={() => router.push("/transactions")}>লেনদেন দেখুন</Button>
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
            <div className="overflow-x-auto">
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
              disabled={!summary.count}
              onClick={() => batch && void saveRows(draft, batch.sourceName, batch.fileHash)}
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
            <p><b className="text-ink">কীভাবে কাজ করে:</b> ফাইলের ভেতরে প্রথমে টেক্সট পড়া হয়; স্ক্যান করা PDF হলে ছবি থেকে লেখা শনাক্ত (OCR) করা হয়। তারপর প্রতিটি লাইন থেকে তারিখ, অঙ্ক, আয়/ব্যয় ও খাত বের হয়।</p>
            <p>ডুপ্লিকেট আগে থেকে থাকলে বাদ দেওয়া হয়। একই ফাইল আবার দিলেও নতুন করে লেনদেন তৈরি হয় না। সব কাজ ব্রাউজারেই হয় — আপনার ফাইল কোথাও আপলোড হয় না।</p>
          </div>
        </div>
      </Card>
    </>
  );
}
