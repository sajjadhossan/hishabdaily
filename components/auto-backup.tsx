"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { useData } from "@/lib/data";
import { googleClientId } from "@/lib/firebase";
import { getDriveTokenSilent, uploadBackup } from "@/lib/drive";
import { getDriveAccessToken } from "@/lib/google";
import { backupFileName, buildBackup } from "@/lib/backup";

const DAY = 20 * 60 * 60 * 1000; // ২০ ঘণ্টা

/**
 * অটো ব্যাকআপ: দিনে একবার, অ্যাপ খোলার সময় নীরবে Google Drive-এ ব্যাকআপ নেয়।
 * ব্যবহারকারী আগে একবার ব্যাকআপ নিয়ে অনুমতি দিলে এটি কাজ করবে।
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
  const running = useRef(false);

  useEffect(() => {
    if (!ready || !user || user.demo || !settings.autoBackup) return;
    const due = !settings.lastBackupAt || Date.now() - settings.lastBackupAt > DAY;
    if (!due || running.current) return;

    running.current = true;
    (async () => {
      try {
        // Google সাইন-ইনের টোকেন থাকলে সেটাই, নইলে পুরোনো Client ID পদ্ধতি
        const token =
          (await getDriveAccessToken()) ||
          (googleClientId() ? await getDriveTokenSilent(googleClientId()!) : null);
        if (!token) return;
        const payload = buildBackup(
          { transactions, templates, contacts, debts, folders, trash, settings },
          { name: user.name, email: user.email },
        );
        await uploadBackup(
          token,
          backupFileName(user.name),
          JSON.stringify(payload, null, 2),
        );
        await updateSettings({ lastBackupAt: Date.now() });
      } catch (err) {
        console.warn("auto backup skipped", err);
      } finally {
        running.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user?.uid, settings.autoBackup, settings.lastBackupAt]);

  return null;
}
