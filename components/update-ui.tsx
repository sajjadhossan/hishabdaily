"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  RefreshCw,
  Smartphone,
  X,
} from "lucide-react";
import { Button, Card, SectionTitle } from "@/components/ui";
import { APP_VERSION, BUILD_NUMBER, VERSION_LABEL } from "@/lib/version";
import {
  checkForApkUpdate,
  downloadAndInstallApk,
  formatBytes,
  getInstallPermission,
  installDownloadedApk,
  isNativeApk,
  markChecked,
  onDownloadProgress,
  openInstallPermissionSettings,
  shouldAutoCheck,
  updaterErrorText,
  type UpdateInfo,
} from "@/lib/updater";
import { cn } from "@/lib/utils";

type Status =
  | "idle"
  | "checking"
  | "found"
  | "none"
  | "downloading"
  | "permission"
  | "started"
  | "error";

function useApkUpdate(auto: boolean) {
  const [status, setStatus] = useState<Status>("idle");
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [error, setError] = useState("");
  const [percent, setPercent] = useState(0);
  const [native] = useState(() => isNativeApk());

  const check = useCallback(
    async (manual = false) => {
      if (!isNativeApk()) return;
      setStatus("checking");
      setError("");
      try {
        const found = await checkForApkUpdate();
        setInfo(found);
        setStatus(found?.available ? "found" : "none");
        markChecked();
      } catch (err) {
        setInfo(null);
        setError(updaterErrorText(err));
        setStatus("error");
        markChecked();
      }
      void manual;
    },
    [],
  );

  const install = useCallback(async (target: UpdateInfo | null, useSaved = false) => {
    if (!target && !useSaved) return;
    setError("");
    try {
      const permission = await getInstallPermission();
      if (!permission.canInstall) {
        setStatus("permission");
        return;
      }

      setStatus("downloading");
      setPercent(0);
      const handle = await onDownloadProgress((event) => {
        setPercent(Math.max(0, Math.min(100, event.percent || 0)));
      });

      try {
        let result;
        if (useSaved) {
          try {
            result = await installDownloadedApk();
          } catch (err) {
            if ((err as { code?: string })?.code !== "NO_FILE") throw err;
            if (!target) throw err;
            result = await downloadAndInstallApk(target.assetUrl);
          }
        } else {
          result = await downloadAndInstallApk(target!.assetUrl);
        }
        if (result?.installStarted) {
          setPercent(100);
          setStatus("started");
        }
      } finally {
        await handle.remove().catch(() => undefined);
      }
    } catch (err) {
      const code = (err as { code?: string })?.code || "";
      if (code === "PERMISSION_REQUIRED") {
        setStatus("permission");
      } else {
        setError(updaterErrorText(err));
        setStatus("error");
      }
    }
  }, []);

  const grant = useCallback(async () => {
    try {
      await openInstallPermissionSettings();
      setError("");
    } catch (err) {
      setError(updaterErrorText(err));
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (auto && native && shouldAutoCheck()) void check();
  }, [auto, native, check]);

  return { status, info, error, percent, native, check, install, grant, setStatus };
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
      <div
        className="h-full rounded-full bg-brand transition-[width] duration-300"
        style={{ width: `${Math.max(3, Math.min(100, percent))}%` }}
      />
    </div>
  );
}

/** অ্যাপ খোলার সময়ই নতুন APK থাকলে ছোট ব্যানার দেখায়। */
export function UpdateBanner() {
  const update = useApkUpdate(true);
  const [dismissed, setDismissed] = useState(false);

  if (!update.native || dismissed) return null;
  const { status, info, error, percent } = update;

  if (status === "found" && info) {
    return (
      <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-brand/30 bg-brand-soft px-3.5 py-3 text-[12px]">
        <Download className="mt-0.5 size-4 shrink-0 text-brand" />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-brand-700 dark:text-brand-300">
            নতুন সংস্করণ পাওয়া গেছে — v{info.version} (build {info.code})
          </p>
          <p className="mt-0.5 text-[11px] text-muted">
            বর্তমান {VERSION_LABEL} · {formatBytes(info.size)} · আনইনস্টল ছাড়াই আপডেট হবে
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void update.install(info)}>
              <Download className="size-3.5" /> এখনই আপডেট
            </Button>
            <a
              href={info.releaseUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold text-muted hover:bg-surface-2"
            >
              <ExternalLink className="size-3.5" /> বিবরণ
            </a>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          aria-label="বন্ধ করুন"
          className="grid size-6 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2"
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  if (status === "permission") {
    return (
      <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-[12px] text-amber-700 dark:text-amber-300">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-bold">APK ইনস্টলের অনুমতি দরকার</p>
          <p className="mt-0.5 text-[11px]">
            “Install unknown apps” চালু করুন, ফিরে এসে “আপডেট” চাপুন। ডেটা মুছে যাবে না।
          </p>
          <Button size="sm" variant="soft" className="mt-2" onClick={() => void update.grant()}>
            অনুমতি দিন
          </Button>
        </div>
      </div>
    );
  }

  if (status === "downloading") {
    return (
      <div className="mb-4 rounded-2xl border border-line bg-surface px-3.5 py-3 text-[12px]">
        <div className="flex items-center gap-2 font-bold text-ink">
          <RefreshCw className="size-4 animate-spin text-brand" /> APK ডাউনলোড হচ্ছে… {percent}%
        </div>
        <ProgressBar percent={percent} />
      </div>
    );
  }

  if (status === "started") {
    return (
      <div className="mb-4 flex items-center gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-3 text-[12px] font-semibold text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="size-4 shrink-0" />
        ইনস্টলার খোলা হয়েছে — নির্দেশনা অনুসরণ করুন। আপনার হিসাব অরক্ষিত থাকবে।
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-[12px] text-danger">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <span className="min-w-0 flex-1">{error}</span>
        <button
          onClick={() => setDismissed(true)}
          aria-label="বন্ধ করুন"
          className="grid size-6 shrink-0 place-items-center rounded-full hover:bg-danger/10"
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  return null;
}

/** সেটিংস পেজে ম্যানুয়াল আপডেট কার্ড। */
export function UpdateCard() {
  const update = useApkUpdate(false);
  if (!update.native) return null;

  const { status, info, error, percent } = update;
  const busy = status === "checking" || status === "downloading";

  return (
    <section className="mt-6" id="app-update">
      <SectionTitle
        title="APK আপডেট"
        subtitle="নতুন সংস্করণ সরাসরি অ্যাপের ভেতরেই ইনস্টল হয়"
      />
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
            <Smartphone className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-ink">
              বর্তমান সংস্করণ {VERSION_LABEL}
            </p>
            {status === "found" && info ? (
              <p className="mt-1 text-[11.5px] font-semibold text-brand">
                নতুন v{info.version} (build {info.code}) পাওয়া গেছে · {formatBytes(info.size)}
              </p>
            ) : null}
            {status === "none" ? (
              <p className="mt-1 flex items-center gap-1.5 text-[11.5px] font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-3.5" /> আপনি আপ-টু-ডেট
              </p>
            ) : null}
            {status === "permission" ? (
              <p className="mt-1 text-[11.5px] font-medium leading-relaxed text-amber-600 dark:text-amber-400">
                “Install unknown apps” অনুমতি দিন, তারপর ইনস্টল আবার চালান। আনইনস্টলের
                দরকার নেই।
              </p>
            ) : null}
            {status === "started" ? (
              <p className="mt-1 text-[11.5px] font-medium text-emerald-600 dark:text-emerald-400">
                ইনস্টলার খোলা হয়েছে। সম্পন্ন হলে অ্যাপ নতুন সংস্করণে চলে যাবে।
              </p>
            ) : null}
            {status === "error" ? (
              <p className="mt-1 flex items-start gap-1.5 text-[11.5px] font-medium text-danger">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {error}
              </p>
            ) : null}
            {status === "idle" ? (
              <p className="mt-1 text-[11px] leading-relaxed text-muted">
                GitHub-এ নতুন release এলে অ্যাপ নিজেই জানিয়ে দেবে। চাইলে এখনই চেক করুন।
              </p>
            ) : null}
          </div>
        </div>

        {status === "downloading" ? <ProgressBar percent={percent} /> : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="soft" loading={busy} onClick={() => void update.check(true)}>
            <RefreshCw className="size-3.5" /> আপডেট চেক করুন
          </Button>
          {status === "found" && info ? (
            <Button size="sm" onClick={() => void update.install(info)}>
              <Download className="size-3.5" /> ডাউনলোড ও ইনস্টল
            </Button>
          ) : null}
          {status === "permission" ? (
            <>
              <Button size="sm" onClick={() => void update.grant()}>
                অনুমতি দিন
              </Button>
              <Button size="sm" variant="outline" onClick={() => void update.install(info, true)}>
                ইনস্টল আবার চালান
              </Button>
            </>
          ) : null}
          {status === "started" ? (
            <Button size="sm" variant="outline" onClick={() => void update.install(info, true)}>
              আবার চালান
            </Button>
          ) : null}
          {info ? (
            <a
              href={info.releaseUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold text-muted hover:bg-surface-2"
            >
              <ExternalLink className="size-3.5" /> Release নোট
            </a>
          ) : null}
        </div>
        <p className="mt-2 text-[10.5px] leading-relaxed text-muted">
          v{APP_VERSION} · build {BUILD_NUMBER} · আপডেটে আপনার লেনদেন, ব্যাকআপ ও সেটিংস অটল থাকে।
        </p>
      </Card>
    </section>
  );
}
