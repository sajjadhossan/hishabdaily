import type { ReactNode } from "react";
import { CheckCircle2, Cloud, HandCoins, PieChart, Zap } from "lucide-react";

export function GoogleIcon({ className = "size-[18px]" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59A14.5 14.5 0 0 1 9.77 24c0-1.6.27-3.14.76-4.59l-7.98-6.19A23.94 23.94 0 0 0 0 24c0 3.88.93 7.55 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

const FEATURES = [
  { icon: Zap, text: "নিয়মিত কেনাকাটা এক ক্লিকে সেভ ও যোগ" },
  { icon: HandCoins, text: "দেনা-পাওনার আলাদা খাতা, কে কত দেবে" },
  { icon: PieChart, text: "মাসিক রিপোর্ট, খাতভিত্তিক বিশ্লেষণ" },
  { icon: Cloud, text: "Google Drive-এ ব্যাকআপ ও রিস্টোর" },
];

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-[100dvh] bg-bg lg:grid-cols-[1.05fr_1fr]">
      {/* ব্র্যান্ড প্যানেল */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-[#052017] p-10 text-white lg:flex xl:p-14">
        <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 size-96 rounded-full bg-brand-300/20 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-white/15 text-xl font-extrabold backdrop-blur">
            ৳
          </span>
          <div className="leading-none">
            <p className="text-lg font-extrabold tracking-tight">হিসাব</p>
            <p className="mt-1 text-[11px] font-medium text-white/65">
              আয় · ব্যয় · দেনা-পাওনা
            </p>
          </div>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-balance text-[34px] font-extrabold leading-[1.15] tracking-tight xl:text-4xl">
            টাকার হিসাব রাখা
            <br />
            এখন একদম সহজ।
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/75">
            প্রতিদিনের কেনাকাটা থেকে শুরু করে দেনা-পাওনা, বাজেট আর রিপোর্ট — সবকিছু এক
            জায়গায়, নিরাপদে।
          </p>
          <ul className="mt-8 space-y-3.5">
            {FEATURES.map((f) => (
              <li key={f.text} className="flex items-center gap-3 text-[13px] font-medium text-white/90">
                <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-white/10">
                  <f.icon className="size-4" />
                </span>
                {f.text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative flex items-center gap-2 text-[11px] text-white/50">
          <CheckCircle2 className="size-3.5" /> আপনার তথ্য শুধু আপনার অ্যাকাউন্টেই থাকে
        </p>
      </div>

      {/* ফর্ম প্যানেল */}
      <div className="flex flex-col px-5 py-8 sm:px-10 lg:justify-center">
        <div className="mb-8 flex items-center gap-2.5 lg:hidden">
          <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-700 text-lg font-extrabold text-white">
            ৳
          </span>
          <div className="leading-none">
            <p className="text-base font-extrabold text-ink">হিসাব</p>
            <p className="mt-1 text-[10px] text-muted">আয় · ব্যয় · দেনা-পাওনা</p>
          </div>
        </div>

        <div className="mx-auto w-full max-w-sm animate-fade-up">
          <h2 className="text-[26px] font-extrabold tracking-tight text-ink">{title}</h2>
          {subtitle ? <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{subtitle}</p> : null}
          <div className="mt-7">{children}</div>
          {footer ? <div className="mt-6 text-center">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}
