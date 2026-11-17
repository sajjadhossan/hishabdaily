/**
 * Google সাইন-ইন থেকেই Drive ব্যাকআপের অনুমতি নেওয়া হয় —
 * আলাদা Google Client ID ছাড়াও ব্যাকআপ কাজ করবে।
 *
 * Firebase-এর Google provider-এ `drive.file` স্কোপ যোগ করলে
 * লগইনের সাথেই Drive টোকেন পাওয়া যায়। টোকেনের মেয়াদ শেষ হলে
 * ব্যবহারকারীকে আবার একবার Google পপআপে অনুমতি দিতে হয়।
 */
import {
  GoogleAuthProvider,
  reauthenticateWithPopup,
  type UserCredential,
} from "firebase/auth";
import { firebaseReady } from "./firebase";

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
  if (token) cached = { token, expires: Date.now() + TTL };
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
 * - `interactive: true`  → না থাকলে Google পপআপ খুলে অনুমতি নেয়
 */
export async function getDriveAccessToken(
  { interactive = false }: { interactive?: boolean } = {},
): Promise<string | null> {
  const existing = cachedDriveToken();
  if (existing) return existing;

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
