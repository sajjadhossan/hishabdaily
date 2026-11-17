/* একই ফাইল/লেনদেন আবার ইম্পোর্ট না হওয়া — ব্রাউজারে ছোট একটা ইতিহাস রাখি */

const HISTORY_KEY = "hishab.importHistory";

export interface ImportEntry {
  hash: string;
  name: string;
  at: number;
  count: number;
  fingerprints: string[];
}

export function loadImportHistory(): ImportEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ImportEntry[]) : [];
  } catch {
    return [];
  }
}

export function recordImport(entry: ImportEntry): void {
  if (typeof window === "undefined") return;
  try {
    const history = [entry, ...loadImportHistory()].slice(0, 25);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    /* storage পূর্ণ হলে ইম্পোর্ট থামাব না */
  }
}

export function knownFingerprints(): Set<string> {
  const set = new Set<string>();
  for (const entry of loadImportHistory()) {
    for (const fp of entry.fingerprints || []) set.add(fp);
  }
  return set;
}

export function wasImported(hash: string): boolean {
  return loadImportHistory().some((entry) => entry.hash === hash);
}
