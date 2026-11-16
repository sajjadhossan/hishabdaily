"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { AuthShell, GoogleIcon } from "@/components/auth-layout";
import { Button, Field, Input } from "@/components/ui";
import { authErrorText, useAuth } from "@/lib/auth";

export default function SignupPage() {
  const { user, loading, signUpEmail, signInGoogle } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<"email" | "google" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [user, loading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে।");
      return;
    }
    if (password !== confirm) {
      setError("দুটি পাসওয়ার্ড মিলছে না।");
      return;
    }
    setBusy("email");
    try {
      await signUpEmail(name, email, password);
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
      router.replace("/dashboard");
    } catch (err) {
      setError(authErrorText(err));
    } finally {
      setBusy(null);
    }
  }

  const strength = password.length >= 10 ? 3 : password.length >= 6 ? 2 : password.length > 0 ? 1 : 0;

  return (
    <AuthShell
      title="অ্যাকাউন্ট খুলুন"
      subtitle="এক মিনিটেই শুরু করুন — সম্পূর্ণ ফ্রি।"
      footer={
        <p className="text-[13px] text-muted">
          আগে থেকেই অ্যাকাউন্ট আছে?{" "}
          <Link href="/login" className="font-bold text-brand hover:underline">
            সাইন ইন করুন
          </Link>
        </p>
      }
    >
      <div className="space-y-4">
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
          Google দিয়ে শুরু করুন
        </Button>

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-line" />
          <span className="text-[11px] font-semibold text-muted">অথবা ইমেইল দিয়ে</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <Field label="আপনার নাম">
            <Input
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="যেমন: আব্দুল করিম"
            />
          </Field>
          <Field label="ইমেইল">
            <Input
              type="email"
              required
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </Field>
          <Field label="পাসওয়ার্ড" hint="অন্তত ৬ অক্ষর">
            <div className="relative">
              <Input
                type={show ? "text" : "password"}
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="শক্ত পাসওয়ার্ড দিন"
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
          {password ? (
            <div className="flex gap-1.5">
              {[1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={
                    "h-1.5 flex-1 rounded-full transition-colors " +
                    (strength >= i
                      ? strength === 1
                        ? "bg-danger"
                        : strength === 2
                          ? "bg-amber-400"
                          : "bg-brand"
                      : "bg-surface-2")
                  }
                />
              ))}
            </div>
          ) : null}
          <Field label="পাসওয়ার্ড আবার লিখুন">
            <Input
              type={show ? "text" : "password"}
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="একই পাসওয়ার্ড আবার"
            />
          </Field>
          {confirm && confirm === password ? (
            <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-brand">
              <CheckCircle2 className="size-3.5" /> পাসওয়ার্ড মিলেছে
            </p>
          ) : null}

          <Button type="submit" size="lg" block loading={busy === "email"}>
            অ্যাকাউন্ট খুলুন
          </Button>
          <p className="text-center text-[11px] leading-relaxed text-muted">
            অ্যাকাউন্ট খুললে আপনি আমাদের শর্তাবলি ও গোপনীয়তা নীতিতে সম্মত হচ্ছেন।
          </p>
        </form>
      </div>
    </AuthShell>
  );
}
