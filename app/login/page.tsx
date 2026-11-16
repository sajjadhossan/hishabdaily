"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Sparkles, Wrench } from "lucide-react";
import { AuthShell, GoogleIcon } from "@/components/auth-layout";
import { Button, Field, Input } from "@/components/ui";
import { authErrorText, useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { user, loading, signInGoogle, signInEmail, signInDemo, cloudAvailable } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<"email" | "google" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [user, loading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy("email");
    try {
      await signInEmail(email, password);
      router.replace("/dashboard");
    } catch (err) {
      setError(authErrorText(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleGoogle() {
    setError(null);
    setBusy("google");
    try {
      await signInGoogle();
    } catch (err) {
      setError(authErrorText(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <AuthShell
      title="আবার স্বাগতম 👋"
      subtitle="আপনার হিসাব দেখতে সাইন ইন করুন।"
      footer={
        <p className="text-[13px] text-muted">
          নতুন ব্যবহারকারী?{" "}
          <Link href="/signup" className="font-bold text-brand hover:underline">
            ফ্রি অ্যাকাউন্ট খুলুন
          </Link>
        </p>
      }
    >
      <div className="space-y-4">
        {!cloudAvailable && !loading ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5">
            <p className="flex items-center gap-2 text-[12.5px] font-bold text-amber-700 dark:text-amber-300">
              <Wrench className="size-4" /> Firebase এখনো কনফিগার করা হয়নি
            </p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-amber-700/80 dark:text-amber-300/80">
              Google লগইন ও ক্লাউড সিঙ্ক চালু করতে Firebase কনফিগ পেস্ট করুন — অথবা নিচে
              ডেমো মোডে অ্যাপটি দেখে নিন।
            </p>
            <div className="mt-2.5 flex gap-2">
              <Link href="/setup">
                <Button size="sm" variant="outline">
                  Firebase সেটআপ
                </Button>
              </Link>
              <Button size="sm" variant="soft" onClick={signInDemo}>
                <Sparkles className="size-3.5" /> ডেমো মোড
              </Button>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/10 px-3 py-2.5 text-[12.5px] font-medium leading-relaxed text-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </div>
        ) : null}

        <Button
          variant="outline"
          size="lg"
          block
          className="gap-2.5"
          loading={busy === "google"}
          onClick={handleGoogle}
        >
          {busy !== "google" ? <GoogleIcon /> : null}
          Google দিয়ে সাইন ইন
        </Button>

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-line" />
          <span className="text-[11px] font-semibold text-muted">অথবা ইমেইল দিয়ে</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <Field label="ইমেইল">
            <Input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              inputMode="email"
            />
          </Field>
          <Field label="পাসওয়ার্ড">
            <div className="relative">
              <Input
                type={show ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pr-11"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখুন"}
                className="absolute right-1 top-1 grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2"
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>

          <div className="flex justify-end">
            <Link href="/forgot-password" className="text-[12px] font-semibold text-brand hover:underline">
              পাসওয়ার্ড ভুলে গেছেন?
            </Link>
          </div>

          <Button type="submit" size="lg" block loading={busy === "email"}>
            সাইন ইন করুন
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}
