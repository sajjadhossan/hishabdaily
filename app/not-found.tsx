import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-bg px-5 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-8 text-center shadow-card">
        <p className="text-5xl font-extrabold tracking-tight text-brand">৪০৪</p>
        <h1 className="mt-4 text-lg font-bold text-ink">পেজটা পাওয়া যায়নি</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          লিংকটা হয়তো ভুল, নয়তো পেজটা সরিয়ে ফেলা হয়েছে।
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/dashboard"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            ড্যাশবোর্ডে যান
          </Link>
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink transition hover:bg-surface-2"
          >
            হোমে ফিরুন
          </Link>
        </div>
      </div>
    </main>
  );
}
