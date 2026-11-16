"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Logo, Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? "/dashboard" : "/login");
  }, [user, loading, router]);

  return (
    <div className="grid min-h-[100dvh] place-items-center bg-bg">
      <div className="flex flex-col items-center gap-4">
        <Logo size={54} />
        <div className="flex items-center gap-2 text-sm font-medium text-muted">
          <Spinner className="size-4" /> হিসাব লোড হচ্ছে…
        </div>
      </div>
    </div>
  );
}
