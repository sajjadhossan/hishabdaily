/**
 * Android-এ নেটিভ Google সাইন-ইন ও Drive অনুমতি।
 * কোনো ব্রাউজার/ওয়েব পেজ খোলা হয় না — ডিভাইসে লগইন করা অ্যাকাউন্টগুলোর
 * নেটিভ বottom sheet দেখে ব্যবহারকারী অ্যাকাউন্ট বেছে নেন।
 */
import { registerPlugin } from "@capacitor/core";

export interface NativeGoogleAccount {
  idToken: string;
  email: string;
  name: string;
  photo: string;
}

export interface NativeDriveToken {
  accessToken: string;
  expiresIn: number;
}

interface GoogleAuthPluginType {
  isAvailable(): Promise<{ available: boolean; platform: string }>;
  signIn(options: { serverClientId: string }): Promise<NativeGoogleAccount>;
  driveToken(): Promise<NativeDriveToken>;
}

let plugin: GoogleAuthPluginType | null = null;
function native(): GoogleAuthPluginType {
  if (!plugin) plugin = registerPlugin<GoogleAuthPluginType>("GoogleAuth");
  return plugin;
}

export async function nativeGoogleAvailable(): Promise<boolean> {
  try {
    const result = await native().isAvailable();
    return !!result.available;
  } catch {
    return false;
  }
}

export async function nativeGoogleSignIn(serverClientId: string): Promise<NativeGoogleAccount> {
  const result = await native().signIn({ serverClientId });
  if (!result?.idToken) throw new Error("Google ID token পাওয়া যায়নি।");
  return result;
}

export async function nativeDriveToken(): Promise<string | null> {
  try {
    const result = await native().driveToken();
    return result?.accessToken || null;
  } catch (err) {
    const code = (err as { code?: string })?.code || "";
    if (code === "IN_PROGRESS") return null;
    throw err;
  }
}
