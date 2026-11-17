import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, type Firestore } from "firebase/firestore";
import { STORAGE_KEY } from "./utils";

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  config: FirebaseConfig;
}

const envConfig: FirebaseConfig | null = (() => {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  if (!apiKey || !projectId || !appId) return null;
  return {
    apiKey,
    projectId,
    appId,
    authDomain: authDomain || `${projectId}.firebaseapp.com`,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  };
})();

export function isValidConfig(value: unknown): value is FirebaseConfig {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  return Boolean(c.apiKey && c.projectId && c.appId);
}

export function normalizeConfig(raw: unknown): FirebaseConfig | null {
  if (!raw || typeof raw !== "object") return null;
  // পুরো Firebase SDK snippet পেস্ট করলেও কাজ করবে
  const source = raw as Record<string, unknown>;
  const inner = (source.firebaseConfig || source.config || source) as Record<string, unknown>;
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = inner[k] ?? source[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return undefined;
  };
  const cfg = {
    apiKey: pick("apiKey"),
    authDomain: pick("authDomain"),
    projectId: pick("projectId"),
    storageBucket: pick("storageBucket"),
    messagingSenderId: pick("messagingSenderId"),
    appId: pick("appId"),
  };
  return isValidConfig(cfg) ? (cfg as FirebaseConfig) : null;
}

export function configFromEnv(): FirebaseConfig | null {
  return envConfig;
}

export function configFromStorage(): FirebaseConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeConfig(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveConfigToStorage(cfg: FirebaseConfig | null) {
  if (typeof window === "undefined") return;
  if (cfg) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  else window.localStorage.removeItem(STORAGE_KEY);
}

/** public/firebase-config.json থেকেও কনফিগ লোড করা যায় (রিবিল্ড ছাড়াই বদলানো যায়) */
async function fetchRuntimeConfig(): Promise<FirebaseConfig | null> {
  try {
    const res = await fetch("/firebase-config.json", { cache: "no-store" });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text.trim()) return null;
    return normalizeConfig(JSON.parse(text));
  } catch {
    return null;
  }
}

let activeConfigCache: FirebaseConfig | null = null;

export async function resolveConfig(): Promise<FirebaseConfig | null> {
  const cfg = configFromStorage() || configFromEnv() || (await fetchRuntimeConfig());
  if (cfg) activeConfigCache = cfg;
  return cfg;
}

/** এখন যে কনফিগ দিয়ে অ্যাপ চলছে (ডায়াগনস্টিকসে দেখানোর জন্য) */
export function activeConfig(): FirebaseConfig | null {
  return activeConfigCache || configFromEnv() || configFromStorage();
}

/** App Check-এর reCAPTCHA v3 সাইট-কী (থাকলে চালু হবে) */
function appCheckSiteKey(): string | null {
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem("hishab.recaptchaKey");
    if (stored && stored.trim()) return stored.trim();
  }
  return process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || null;
}

let appCheckStarted = false;

async function startAppCheck(app: FirebaseApp) {
  const siteKey = appCheckSiteKey();
  if (!siteKey || appCheckStarted) return;
  appCheckStarted = true;
  try {
    const { initializeAppCheck, ReCaptchaV3Provider } = await import("firebase/app-check");
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    console.warn("App Check চালু করা যায়নি", err);
  }
}

let servicesPromise: Promise<FirebaseServices | null> | null = null;

export function firebaseReady(): Promise<FirebaseServices | null> {
  if (!servicesPromise) {
    servicesPromise = (async () => {
      const config = await resolveConfig();
      if (!config) return null;
      try {
        const app = getApps().length ? getApp() : initializeApp(config);
        void startAppCheck(app);
        const auth = getAuth(app);
        let db: Firestore;
        try {
          db = initializeFirestore(app, {
            localCache: persistentLocalCache({}),
          });
        } catch {
          const { getFirestore } = await import("firebase/firestore");
          db = getFirestore(app);
        }
        return { app, auth, db, config };
      } catch (err) {
        console.error("Firebase init failed", err);
        return null;
      }
    })();
  }
  return servicesPromise;
}

export function googleClientId(): string | null {
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem("hishab.googleClientId");
    if (stored && stored.trim()) return stored.trim();
  }
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || null;
}

export function saveGoogleClientId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id && id.trim()) window.localStorage.setItem("hishab.googleClientId", id.trim());
  else window.localStorage.removeItem("hishab.googleClientId");
}
