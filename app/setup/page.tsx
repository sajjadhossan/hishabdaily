"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Database,
  ExternalLink,
  KeyRound,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { AuthShell } from "@/components/auth-layout";
import { Button, Card, Field, Input, Textarea, useToast } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import {
  configFromEnv,
  configFromStorage,
  googleClientId,
  normalizeConfig,
  saveConfigToStorage,
  saveGoogleClientId,
} from "@/lib/firebase";

function looseParse(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("JSON অবজেক্ট পাওয়া যায়নি।");
  let body = text.slice(start, end + 1).replace(/\/\/.*$/gm, "").replace(/,\s*}/g, "}");
  try {
    return JSON.parse(body);
  } catch {
    body = body
      .replace(/'/g, '"')
      .replace(/([{,]\s*)([A-Za-z0-9_]+)\s*:/g, '$1"$2":');
    return JSON.parse(body);
  }
}

const STEPS = [
  {
    icon: Database,
    title: "Firebase প্রজেক্ট খুলুন",
    body: "console.firebase.google.com-এ নতুন প্রজেক্ট তৈরি করুন।",
  },
  {
    icon: KeyRound,
    title: "Authentication চালু করুন",
    body: "Google এবং Email/Password — দুটি সাইন-ইন পদ্ধতি enable করুন।",
  },
  {
    icon: ShieldCheck,
    title: "Firestore ডেটাবেস খুলুন",
    body: "Firestore Database তৈরি করে নিচের নিয়মগুলো (rules) বসিয়ে দিন।",
  },
  {
    icon: ExternalLink,
    title: "Web App যোগ করে কনফিগ কপি করুন",
    body: "Project settings → Your apps → Web — firebaseConfig অবজেক্টটি কপি করে নিচে পেস্ট করুন।",
  },
];

export default function SetupPage() {
  const { cloudAvailable } = useAuth();
  const toast = useToast();
  const [text, setText] = useState("");
  const [clientId, setClientId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hasCustom, setHasCustom] = useState(false);
  const [hasEnv, setHasEnv] = useState(false);

  useEffect(() => {
    setHasCustom(!!configFromStorage());
    setHasEnv(!!configFromEnv());
    setClientId(googleClientId() || "");
  }, []);

  function handleSave() {
    setError(null);
    try {
      const parsed = looseParse(text);
      const cfg = normalizeConfig(parsed);
      if (!cfg) {
        setError(
          "কনফিগে apiKey, projectId ও appId পাওয়া যায়নি। Firebase-এর পুরো firebaseConfig অবজেক্টটি পেস্ট করুন।",
        );
        return;
      }
      saveConfigToStorage(cfg);
      saveGoogleClientId(clientId.trim() || null);
      toast("সেভ হয়েছে! অ্যাপ রিলোড হচ্ছে…");
      setTimeout(() => {
        window.location.href = "/login";
      }, 700);
    } catch (err) {
      setError((err as Error).message || "JSON পড়া যায়নি।");
    }
  }

  function handleClear() {
    saveConfigToStorage(null);
    saveGoogleClientId(null);
    window.location.href = "/login";
  }

  async function handleClientJson(file: File) {
    setError(null);
    try {
      const raw = await file.text();
      const json = JSON.parse(raw);

      // Service Account JSON হলে সতর্ক করুন — এটা ব্রাউজারে রাখা যায় না
      if (json.type === "service_account") {
        setError(
          "এটি Service Account JSON — এর private key ব্রাউজারে রাখা নিরাপদ নয়, আর ব্যক্তিগত Gmail Drive-এ আপলোডও কাজ করে না। Google Cloud → Credentials → OAuth client ID (Web application) থেকে JSON নামান, অথবা শুধু Google দিয়ে সাইন ইন করুন।",
        );
        return;
      }

      const id =
        json.web?.client_id || json.installed?.client_id || json.client_id || json.clientId;
      if (typeof id !== "string" || !id.trim().endsWith(".apps.googleusercontent.com")) {
        setError("এই ফাইলে OAuth Client ID পাওয়া যায়নি। Google Cloud → Credentials → OAuth client → Download JSON।");
        return;
      }
      setClientId(id.trim());
      toast("Client ID ফাইল থেকে পাওয়া গেছে — এখন সেভ করুন");
    } catch {
      setError("JSON ফাইলটা পড়া যায়নি। সঠিক ফাইল বেছে নিন।");
    }
  }

  return (
    <AuthShell
      title="Firebase সেটআপ"
      subtitle="কনফিগ একবার বসালেই Google লগইন, ক্লাউড সিঙ্ক আর ব্যাকআপ চালু হয়ে যাবে।"
      footer={
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-[13px] font-bold text-brand hover:underline"
        >
          <ArrowLeft className="size-3.5" /> সাইন ইন পেজে ফিরে যান
        </Link>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 text-[12px] font-medium text-muted">
          {hasEnv ? (
            <>
              <CheckCircle2 className="size-4 text-brand" />
              ডিপ্লয়মেন্টের env ভেরিয়েবল থেকে Firebase কনফিগ পাওয়া যাচ্ছে
            </>
          ) : hasCustom ? (
            <>
              <CheckCircle2 className="size-4 text-brand" />
              এই ব্রাউজারে কাস্টম কনফিগ সেভ করা আছে
            </>
          ) : (
            <>
              <AlertCircle className="size-4 text-amber-500" />
              এখনো কোনো কনফিগ নেই — নিচে পেস্ট করুন
            </>
          )}
        </div>

        {error ? (
          <div className="rounded-xl border border-danger/25 bg-danger/10 px-3 py-2.5 text-[12.5px] font-medium text-danger">
            {error}
          </div>
        ) : null}

        <Field
          label="firebaseConfig"
          hint="Firebase Console → Project settings → Your apps → Web app থেকে কপি করুন"
        >
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`const firebaseConfig = {\n  apiKey: "AIza...",\n  authDomain: "your-app.firebaseapp.com",\n  projectId: "your-app",\n  storageBucket: "your-app.appspot.com",\n  messagingSenderId: "123456789",\n  appId: "1:123456789:web:abcdef"\n};`}
            className="min-h-[160px] font-mono text-[12px]"
            spellCheck={false}
          />
        </Field>

        <Field
          label="Google Client ID (ঐচ্ছিক)"
          hint="Google দিয়ে সাইন ইন করলে এটি লাগে না — শুধু ইমেইল/পাসওয়ার্ড অ্যাকাউন্টে Drive ব্যাকআপ চাইলে দিন"
        >
          <Input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="1234567890-abc.apps.googleusercontent.com"
            spellCheck={false}
          />
        </Field>

        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-surface-2/40 px-3 py-3 text-[12px] font-bold text-muted transition hover:border-brand/50 hover:text-brand">
          <Upload className="size-4" />
          OAuth Client JSON ফাইল দিয়ে বসান
          <input
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleClientJson(f);
              e.target.value = "";
            }}
          />
        </label>

        <div className="flex gap-2">
          <Button size="lg" block onClick={handleSave} disabled={!text.trim()}>
            <Save className="size-4" /> সেভ করুন
          </Button>
          {hasCustom ? (
            <Button variant="outline" size="lg" onClick={handleClear} className="text-danger">
              <Trash2 className="size-4" />
            </Button>
          ) : null}
        </div>

        <Card className="bg-surface-2/60 p-4">
          <p className="text-[12.5px] font-bold text-ink">কী কী লাগবে?</p>
          <ol className="mt-2.5 space-y-2.5">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-2.5">
                <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-brand-soft text-[11px] font-bold text-brand-700 dark:text-brand-300">
                  {i + 1}
                </span>
                <div>
                  <p className="text-[12px] font-semibold text-ink">{s.title}</p>
                  <p className="text-[11px] leading-relaxed text-muted">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-3 border-t border-line pt-2.5 text-[11px] leading-relaxed text-muted">
            Firestore Rules-এর নিয়ম ও ধাপে ধাপে নির্দেশনা প্রজেক্টের{" "}
            <b className="text-ink">README.md</b> ফাইলে দেওয়া আছে।
          </p>
        </Card>

        {!cloudAvailable ? (
          <p className="text-center text-[11px] text-muted">
            শুধু দেখতে চান?{" "}
            <Link href="/login" className="font-bold text-brand hover:underline">
              ডেমো মোড
            </Link>{" "}
            ব্যবহার করুন।
          </p>
        ) : null}
      </div>
    </AuthShell>
  );
}
