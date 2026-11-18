"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { useData } from "@/lib/data";
import { googleClientId } from "@/lib/firebase";
import { getDriveTokenSilent, pruneBackups, uploadBackup } from "@/lib/drive";
import { getDriveAccessToken } from "@/lib/google";
import { backupFileName, buildBackup } from "@/lib/backup";
import { useToast } from "./ui";

const INTERVAL = 10 * 60 * 1000; // প্রতি ১০ মিনিটে
const KEEP = 5; // Drive-এ শেষ ৫টি ব্যাকআপ রাখি

/**
 * অটো ব্যাকআপ:
 * - অ্যাপ খোলার সাথে সাথে একবার
 * - এরপর যতক্ষণ অ্যাপ খোলা থাকে প্রতি ১০ মিনিটে
 * - ফোন/ট্যাব আবার ফোকাস হলেও একবার (visibility change)
 * প্রতিবার নতুন JSON ফাইল যায়, তারপর শেষ ৫টি ছাড়া পুরোনোগুলো মুছে দেয়।
 * Drive অনুমতি না থাকলে চুপচাপ বসে না — একবার বার্তা দেখায়।
 */
export function AutoBackup() {
  const { user } = useAuth();
  const {
    ready,
    settings,
    transactions,
    templates,
    contacts,
    debts,
    folders,
    trash,
    updateSettings,
  } = useData();
  const toast = useToast();
  const running = useRef(false);
  const warned = useRef(false);

  const run = useCallback(async () => {
    if (!ready || !user || user.demo || !settings.autoBackup) return;
    if (running.current) return;
    running.current = true;
    try {
      // Google সাইন-ইনের টোকেন থাকলে সেটাই, নইলে পুরোনো Client ID পদ্ধতি
      const token =
        (await getDriveAccessToken()) ||
        (googleClientId() ? await getDriveTokenSilent(googleClientId()!) : null);
      if (!token) {
        if (!warned.current) {
          warned.current = true;
          toast("Drive সংযুক্ত নয় — সেটিংস থেকে একবার ব্যাকআপ নিন", "error");
        }
        return;
      }

      const payload = buildBackup(
        { transactions, templates, contacts, debts, folders, trash, settings },
        { name: user.name, email: user.email },
      );
      await uploadBackup(
        token,
        backupFileName(user.name),
        JSON.stringify(payload, null, 2),
      );
      await pruneBackups(token, KEEP);
      await updateSettings({ lastBackupAt: Date.now() });
      warned.current = false;
    } catch (err) {
      console.warn("auto backup skipped", err);
    } finally {
      running.current = false;
    }
  }, [
    ready,
    user,
    settings,
    transactions,
    templates,
    contacts,
    debts,
    folders,
    trash,
    updateSettings,
    toast,
  ]);

  // run-এর রেফারেন্স সবসময় নতুন রাখি, কিন্তু টাইমার বারবার রিসেট হয় না।
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    if (!ready || !user || user.demo || !settings.autoBackup) return;

    // খোলার সাথে সাথে একবার
    void runRef.current();

    const timer = window.setInterval(() => void runRef.current(), INTERVAL);
    const onVisible = () => {
      if (document.visibilityState === "visible") void runRef.current();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ready, user, settings.autoBackup]);

  return null;
}
