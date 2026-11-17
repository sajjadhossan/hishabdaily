/**
 * APK self-updater.
 * GitHub Releases-এর latest release দেখে বর্তমান APK-র সাথে তুলনা করে এবং
 * Capacitor native plugin দিয়ে নতুন APK ডাউনলোড + ইনস্টল করে।
 */
import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { APP_VERSION, BUILD_NUMBER } from "./version";

const REPO = "sajjadhossan/hishabdaily";
const LATEST_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
const RELEASES_URL = `https://github.com/${REPO}/releases/latest`;
const LAST_CHECK_KEY = "hishab.lastUpdateCheck";

export interface InstallPermission {
  canInstall: boolean;
  hasPermission: boolean;
  androidSdk?: number;
}

export interface DownloadProgress {
  percent: number;
  downloaded: number;
  total: number;
}

export interface DownloadResult {
  installStarted: boolean;
  path: string;
  size?: number;
}

export interface UpdateInfo {
  version: string;
  code: number;
  tag: string;
  assetName: string;
  assetUrl: string;
  size: number;
  publishedAt: string;
  releaseUrl: string;
  available: boolean;
}

interface ApkUpdaterPluginType {
  checkInstallPermission(): Promise<InstallPermission>;
  openInstallPermissionSettings(): Promise<{ opened: boolean; canInstall: boolean; fallback?: boolean }>;
  hasDownloaded(): Promise<{ downloaded: boolean; path?: string; size?: number }>;
  installDownloaded(): Promise<DownloadResult>;
  downloadAndInstall(options: { url: string }): Promise<DownloadResult>;
  addListener(
    eventName: "downloadProgress",
    listenerFunc: (event: DownloadProgress) => void,
  ): Promise<PluginListenerHandle>;
}

let plugin: ApkUpdaterPluginType | null = null;
function apkUpdater(): ApkUpdaterPluginType {
  if (!plugin) plugin = registerPlugin<ApkUpdaterPluginType>("ApkUpdater");
  return plugin;
}

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface GitHubRelease {
  tag_name: string;
  body?: string | null;
  published_at?: string;
  html_url?: string;
  assets?: ReleaseAsset[];
}

function parseVersion(value: string): number[] {
  return value
    .replace(/^v/i, "")
    .split(/[.+\-]/)
    .map((part) => Number.parseInt(part, 10))
    .filter((n) => Number.isFinite(n));
}

export function compareVersions(a: string, b: string): number {
  const left = parseVersion(a);
  const right = parseVersion(b);
  const len = Math.max(left.length, right.length);
  for (let i = 0; i < len; i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

export function isNativeApk(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  } catch {
    return false;
  }
}

export function updaterErrorText(err: unknown): string {
  const code = (err as { code?: string })?.code || "";
  const message = (err as Error)?.message || "";
  if (code === "PERMISSION_REQUIRED" || /permission/i.test(message)) {
    return "নতুন APK ইনস্টল করার অনুমতি দরকার। ‘Install unknown apps’ চালু করুন।";
  }
  if (code === "NO_FILE") return "ডাউনলোড করা APK পাওয়া যায়নি। আবার চেষ্টা করুন।";
  if (code === "BAD_URL") return "আপডেট লিংক পাওয়া যায়নি।";
  if (/failed to fetch|network|timeout/i.test(message)) {
    return "GitHub-এর সাথে যোগাযোগ করা যায়নি। ইন্টারনেট চেক করে আবার চেষ্টা করুন।";
  }
  return message || "আপডেট চেক করা যায়নি। পরে আবার চেষ্টা করুন।";
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function shouldAutoCheck(now = Date.now(), intervalMs = 6 * 60 * 60 * 1000): boolean {
  try {
    const last = Number(localStorage.getItem(LAST_CHECK_KEY) || 0);
    return !last || now - last >= intervalMs;
  } catch {
    return true;
  }
}

export function markChecked(now = Date.now()): void {
  try {
    localStorage.setItem(LAST_CHECK_KEY, String(now));
  } catch {
    /* ignore */
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GitHub API (${res.status})`);
  return (await res.json()) as T;
}

async function releaseCode(release: GitHubRelease, version: string): Promise<number> {
  const metadata = release.assets?.find(
    (a) => a.name === "hishabdaily-version.json" || a.name === "version.json",
  );
  if (metadata) {
    try {
      const data = await fetchJson<{ code?: number }>(metadata.browser_download_url);
      if (Number.isInteger(data.code) && (data.code as number) > 0) return data.code as number;
    } catch {
      /* fallback to release notes */
    }
  }
  const fromNotes = release.body?.match(/build\s*[:#]?\s*(\d+)/i);
  if (fromNotes) return Number.parseInt(fromNotes[1], 10);

  // ট্যাগে build থাকলে সেটি ব্যবহার করি: v1.2.3+7
  const fromTag = release.tag_name.match(/\+(\d+)$/);
  if (fromTag) return Number.parseInt(fromTag[1], 10);

  void version;
  return BUILD_NUMBER;
}

export async function checkForApkUpdate(): Promise<UpdateInfo | null> {
  if (!isNativeApk()) return null;

  const release = await fetchJson<GitHubRelease>(LATEST_URL);
  const version = release.tag_name.replace(/^v/i, "").split("+")[0];
  if (!/^\d+\.\d+\.\d+/.test(version)) return null;

  const assets = release.assets || [];
  const expected = `hishabdaily-v${version}.apk`;
  const apk =
    assets.find((a) => a.name === expected) ||
    assets.find((a) => a.name.toLowerCase().endsWith(".apk"));
  if (!apk) return null;

  const code = await releaseCode(release, version);
  const newer = compareVersions(version, APP_VERSION) > 0 ||
    (compareVersions(version, APP_VERSION) === 0 && code > BUILD_NUMBER);

  return {
    version,
    code,
    tag: release.tag_name,
    assetName: apk.name,
    assetUrl: apk.browser_download_url,
    size: apk.size || 0,
    publishedAt: release.published_at || "",
    releaseUrl: release.html_url || RELEASES_URL,
    available: newer,
  };
}

export async function getInstallPermission(): Promise<InstallPermission> {
  if (!isNativeApk()) return { canInstall: true, hasPermission: true };
  return apkUpdater().checkInstallPermission();
}

export async function openInstallPermissionSettings(): Promise<boolean> {
  if (!isNativeApk()) return false;
  const result = await apkUpdater().openInstallPermissionSettings();
  return !!result.opened;
}

export async function installDownloadedApk(): Promise<DownloadResult> {
  if (!isNativeApk()) throw new Error("শুধু Android APK-তেই আপডেট করা যায়।");
  return apkUpdater().installDownloaded();
}

export async function downloadAndInstallApk(url: string): Promise<DownloadResult> {
  if (!isNativeApk()) throw new Error("শুধু Android APK-তেই আপডেট করা যায়।");
  return apkUpdater().downloadAndInstall({ url });
}

export async function onDownloadProgress(
  callback: (progress: DownloadProgress) => void,
): Promise<PluginListenerHandle> {
  if (!isNativeApk()) {
    return { remove: async () => undefined } as PluginListenerHandle;
  }
  return apkUpdater().addListener("downloadProgress", callback);
}
