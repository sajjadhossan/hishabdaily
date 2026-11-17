/**
 * Google Drive ব্যাকআপের টোকেন।
 *
 * APK-তে Drive অনুমতি নেটিভ Google Identity Services থেকে নেওয়া হয় —
 * ব্যবহারকারীকে কোনো ব্রাউজার পেজে পাঠানো হয় না।
 * ওয়েবে আগের Firebase/popup পদ্ধতিই চলে।
 */
import {
  GoogleAuthProvider,
  reauthenticateWithPopup,
  type UserCredential,
} from "firebase/auth";
import { firebaseReady } from "./firebase";
import { isNativeApk } from "./updater";

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

// Firebase-এর access token সাধারণত ১ ঘণ্টা থাকে; নিরাপদে ৫০ মিনিট ধরি
const TTL = 50 * 60 * 1000;

let cached: { token: string; expires: number } | null = null;

export function driveProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.addScope(DRIVE_SCOPE);
  return provider;
}

/** লগইন/রিঅথেনটিকেশনের ফলাফল থেকে Drive টোকেন মনে রাখে */
export function cacheDriveCredential(result: UserCredential | null | undefined) {
  const token = result ? GoogleAuthProvider.credentialFromResult(result)?.accessToken : null;
  if (token) setDriveAccessToken(token);
}

/** নেটিভ বা অন্য উৎস থেকে পাওয়া Drive access token মনে রাখে */
export function setDriveAccessToken(token: string, expiresInSeconds = 3600) {
  if (!token) return;
  const ttl = Math.max(60, expiresInSeconds - 90) * 1000;
  cached = { token, expires: Date.now() + Math.min(ttl, TTL) };
}

export function cachedDriveToken(): string | null {
  return cached && cached.expires > Date.now() ? cached.token : null;
}

export function hasCachedDriveToken(): boolean {
  return !!cachedDriveToken();
}

/**
 * Drive টোকেন দেয়।
 * - `interactive: false` → শুধু আগে পাওয়া টোকেন থাকলে দেয় (অটো ব্যাকআপের জন্য)
 * - `interactive: true`  → APK-তে নেটিভ অনুমতি, ওয়েবে Firebase পপআপ
 */
export async function getDriveAccessToken(
  { interactive = false }: { interactive?: boolean } = {},
): Promise<string | null> {
  const existing = cachedDriveToken();
  if (existing) return existing;

  if (isNativeApk()) {
    if (!interactive) return null;
    const { nativeDriveToken } = await import("./native-google");
    const token = await nativeDriveToken();
    if (token) setDriveAccessToken(token);
    return token;
  }

  const services = await firebaseReady();
  const user = services?.auth.currentUser;
  if (!services || !user) return null;

  const viaGoogle = user.providerData.some((p) => p.providerId === "google.com");
  if (!viaGoogle || !interactive) return null;

  const provider = driveProvider();
  provider.setCustomParameters({
    prompt: "consent",
    ...(user.email ? { login_hint: user.email } : {}),
  });
  const result = await reauthenticateWithPopup(user, provider);
  cacheDriveCredential(result);
  return cachedDriveToken();
}

export function forgetDriveToken() {
  cached = null;
}
