"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { firebaseReady, googleClientId } from "./firebase";
import { cacheDriveCredential, driveProvider } from "./google";
import { nativeGoogleSignIn } from "./native-google";
import { isNativeApk } from "./updater";

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  photo: string;
  demo: boolean;
  /** Google অ্যাকাউন্ট দিয়ে সাইন ইন করা (Drive ব্যাকআপের জন্য দরকার) */
  google: boolean;
}

interface AuthState {
  user: AppUser | null;
  loading: boolean;
  cloudAvailable: boolean;
  signInGoogle: () => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (name: string, email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signInDemo: () => void;
  logout: () => Promise<void>;
  updateName: (name: string) => Promise<void>;
  refreshUser: () => void;
}

const DEMO_KEY = "hishab.demo";
const AuthContext = createContext<AuthState | null>(null);

export function authErrorText(err: unknown): string {
  const code = (err as { code?: string })?.code || "";
  const map: Record<string, string> = {
    "auth/invalid-email": "ইমেইলের ফরম্যাট সঠিক নয়।",
    "auth/user-not-found": "এই ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি।",
    "auth/wrong-password": "পাসওয়ার্ড ভুল হয়েছে।",
    "auth/invalid-credential": "ইমেইল বা পাসওয়ার্ড ভুল হয়েছে।",
    "auth/invalid-login-credentials": "ইমেইল বা পাসওয়ার্ড ভুল হয়েছে।",
    "auth/email-already-in-use": "এই ইমেইল দিয়ে আগেই অ্যাকাউন্ট আছে। সাইন ইন করুন।",
    "auth/weak-password": "পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে।",
    "auth/missing-password": "পাসওয়ার্ড দিন।",
    "auth/popup-closed-by-user": "সাইন ইন উইন্ডো বন্ধ হয়ে গেছে। আবার চেষ্টা করুন।",
    "auth/cancelled-popup-request": "সাইন ইন বাতিল হয়েছে।",
    "auth/popup-blocked": "ব্রাউজার পপআপ আটকে দিয়েছে। আবার চেষ্টা করুন বা অন্য ব্রাউজার ব্যবহার করুন।",
    "auth/too-many-requests": "অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।",
    "auth/network-request-failed": "ইন্টারনেট সংযোগ পাওয়া যাচ্ছে না।",
    "auth/operation-not-allowed":
      "Firebase Console → Authentication → Sign-in method-এ এই পদ্ধতিটি চালু করুন।",
    "auth/unauthorized-domain":
      "এই ডোমেইনটি Firebase-এ অনুমোদিত নয়। Authentication → Settings → Authorized domains-এ যোগ করুন।",
    "auth/account-exists-with-different-credential":
      "এই ইমেইলে অন্য পদ্ধতিতে অ্যাকাউন্ট আছে। সেই পদ্ধতিতে সাইন ইন করুন।",
    "auth/requires-recent-login": "নিরাপত্তার জন্য আবার সাইন ইন করুন।",
    NO_CLIENT_ID: "Google Web Client ID সেট করা নেই। সেটআপ পেজ থেকে Client ID দিন।",
    SIGN_IN_FAILED: "Google অ্যাকাউন্ট বাছাই ব্যর্থ হয়েছে। আবার চেষ্টা করুন।",
    BAD_CREDENTIAL: "Google অ্যাকাউন্ট থেকে তথ্য পাওয়া যায়নি। আবার চেষ্টা করুন।",
  };
  if (map[code]) return map[code];
  const msg = (err as Error)?.message || "কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।";
  return msg.replace("Firebase: ", "");
}

function mapUser(u: User): AppUser {
  return {
    uid: u.uid,
    name: u.displayName || u.email?.split("@")[0] || "ব্যবহারকারী",
    email: u.email || "",
    photo: u.photoURL || "",
    demo: false,
    google: u.providerData.some((p) => p.providerId === "google.com"),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [cloudAvailable, setCloudAvailable] = useState(false);

  useEffect(() => {
    let active = true;
    let unsub: (() => void) | undefined;

    (async () => {
      const services = await firebaseReady();
      if (!active) return;
      setCloudAvailable(!!services);

      if (!services) {
        try {
          const raw = localStorage.getItem(DEMO_KEY);
          if (raw) setUser(JSON.parse(raw) as AppUser);
        } catch {
          /* ignore */
        }
        setLoading(false);
        return;
      }

      unsub = onAuthStateChanged(
        services.auth,
        (u) => {
          if (!active) return;
          setUser(u ? mapUser(u) : null);
          setLoading(false);
        },
        () => {
          if (!active) return;
          setLoading(false);
        },
      );

      getRedirectResult(services.auth)
        .then((result) => cacheDriveCredential(result))
        .catch(() => undefined);
    })();

    return () => {
      active = false;
      unsub?.();
    };
  }, []);

  const requireServices = useCallback(async () => {
    const services = await firebaseReady();
    if (!services) {
      throw new Error(
        "Firebase এখনো কনফিগার করা হয়নি। সেটআপ পেজ থেকে Firebase কনফিগ পেস্ট করুন।",
      );
    }
    return services;
  }, []);

  const signInGoogle = useCallback(async () => {
    const { auth } = await requireServices();

    if (isNativeApk()) {
      // APK: ডিভাইসে লগইন করা Google অ্যাকাউন্টগুলোর নেটিভ বাছাই।
      // কোনো ব্রাউজার পেজ বা বারবার লগইন নেই।
      const serverClientId = googleClientId();
      if (!serverClientId) {
        throw new Error("Google Web Client ID সেট করা নেই। সেটআপ পেজ থেকে Client ID দিন।");
      }
      const account = await nativeGoogleSignIn(serverClientId);
      const credential = GoogleAuthProvider.credential(account.idToken);
      await signInWithCredential(auth, credential);
      return;
    }

    const provider = driveProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      const result = await signInWithPopup(auth, provider);
      cacheDriveCredential(result);
    } catch (err) {
      const code = (err as { code?: string })?.code || "";
      if (
        code === "auth/popup-blocked" ||
        code === "auth/operation-not-supported-in-this-environment" ||
        code === "auth/cancelled-popup-request"
      ) {
        await signInWithRedirect(auth, provider);
        return;
      }
      throw err;
    }
  }, [requireServices]);

  const signInEmail = useCallback(
    async (email: string, password: string) => {
      const { auth } = await requireServices();
      await signInWithEmailAndPassword(auth, email.trim(), password);
    },
    [requireServices],
  );

  const signUpEmail = useCallback(
    async (name: string, email: string, password: string) => {
      const { auth } = await requireServices();
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (name.trim()) {
        await updateProfile(cred.user, { displayName: name.trim() });
        setUser(mapUser({ ...cred.user, displayName: name.trim() } as User));
      }
    },
    [requireServices],
  );

  const resetPassword = useCallback(
    async (email: string) => {
      const { auth } = await requireServices();
      await sendPasswordResetEmail(auth, email.trim());
    },
    [requireServices],
  );

  const signInDemo = useCallback(() => {
    const demo: AppUser = {
      uid: "demo",
      name: "ডেমো ব্যবহারকারী",
      email: "demo@hishab.app",
      photo: "",
      demo: true,
      google: false,
    };
    localStorage.setItem(DEMO_KEY, JSON.stringify(demo));
    setUser(demo);
  }, []);

  const logout = useCallback(async () => {
    if (user?.demo) {
      localStorage.removeItem(DEMO_KEY);
      setUser(null);
      return;
    }
    const services = await firebaseReady();
    if (services) await signOut(services.auth);
    setUser(null);
  }, [user]);

  const updateName = useCallback(
    async (name: string) => {
      if (user?.demo) {
        const next = { ...user, name };
        localStorage.setItem(DEMO_KEY, JSON.stringify(next));
        setUser(next);
        return;
      }
      const { auth } = await requireServices();
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: name });
        setUser((prev) => (prev ? { ...prev, name } : prev));
      }
    },
    [requireServices, user],
  );

  const refreshUser = useCallback(() => {
    firebaseReady().then((s) => {
      if (s?.auth.currentUser) setUser(mapUser(s.auth.currentUser));
    });
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      cloudAvailable,
      signInGoogle,
      signInEmail,
      signUpEmail,
      resetPassword,
      signInDemo,
      logout,
      updateName,
      refreshUser,
    }),
    [
      user,
      loading,
      cloudAvailable,
      signInGoogle,
      signInEmail,
      signUpEmail,
      resetPassword,
      signInDemo,
      logout,
      updateName,
      refreshUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
