"use client";

import { useEffect, type ReactNode } from "react";
import { AuthProvider } from "@/lib/auth";
import { DataProvider, useData } from "@/lib/data";
import { ToastProvider } from "./ui";

function ThemeSync() {
  const { settings } = useData();

  useEffect(() => {
    const apply = () => {
      const theme = settings.theme || "system";
      const dark =
        theme === "dark" ||
        (theme === "system" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", dark);
      try {
        localStorage.setItem("hishab.theme", theme);
      } catch {
        /* ignore */
      }
    };
    apply();

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => {
      if ((settings.theme || "system") === "system") apply();
    };
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [settings.theme]);

  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <DataProvider>
          {children}
          <ThemeSync />
        </DataProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
