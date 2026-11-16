"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, MailCheck } from "lucide-react";
import { AuthShell } from "@/components/auth-layout";
import { Button, Field, Input } from "@/components/ui";
import { authErrorText, useAuth } from "@/lib/auth";

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err) {
      setError(authErrorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="পাসওয়ার্ড ভুলে গেছেন?"
      subtitle="ইমেইল দিন — পাসওয়ার্ড রিসেট করার লিংক পাঠিয়ে দেব।"
      footer={
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-[13px] font-bold text-brand hover:underline"
        >
          <ArrowLeft className="size-3.5" /> সাইন ইন পেজে ফিরে যান
        </Link>
      }
    >
      {sent ? (
        <div className="rounded-2xl border border-brand/25 bg-brand-soft p-5 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand/15 text-brand">
            <MailCheck className="size-6" />
          </span>
          <p className="mt-3 text-[15px] font-bold text-ink">ইমেইল পাঠানো হয়েছে</p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
            <b className="text-ink">{email}</b> ঠিকানায় পাসওয়ার্ড রিসেটের লিংক পাঠানো হয়েছে।
            ইনবক্স ও স্প্যাম ফোল্ডার দেখুন।
          </p>
          <Button variant="outline" block className="mt-4" onClick={() => setSent(false)}>
            অন্য ইমেইলে পাঠাব
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {error ? (
            <div className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/10 px-3 py-2.5 text-[12.5px] font-medium leading-relaxed text-danger">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {error}
            </div>
          ) : null}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <Field label="অ্যাকাউন্টের ইমেইল">
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
            <Button type="submit" size="lg" block loading={busy}>
              রিসেট লিংক পাঠান
            </Button>
          </form>
          <p className="text-center text-[11.5px] leading-relaxed text-muted">
            Google দিয়ে সাইন ইন করলে পাসওয়ার্ড লাগে না — সরাসরি Google দিয়েই ঢুকতে পারবেন।
          </p>
        </div>
      )}
    </AuthShell>
  );
}
