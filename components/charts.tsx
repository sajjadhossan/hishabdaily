"use client";

import { cn } from "@/lib/utils";

export interface Segment {
  label: string;
  value: number;
  color: string;
}

export function Donut({
  segments,
  size = 176,
  thickness = 13,
  centerLabel,
  centerValue,
  className,
}: {
  segments: Segment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
  className?: string;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} className="-rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth={thickness} className="text-surface-2" />
        {total > 0 &&
          segments.map((s, i) => {
            const dash = (s.value / total) * circumference;
            const el = (
              <circle
                key={`${s.label}-${i}`}
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeDasharray={`${Math.max(dash - 1.5, 0)} ${circumference}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
              />
            );
            offset += dash;
            return el;
          })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        {centerLabel ? (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
            {centerLabel}
          </span>
        ) : null}
        {centerValue ? (
          <span className="mt-0.5 text-lg font-extrabold tracking-tight text-ink">
            {centerValue}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function MonthlyBars({
  data,
  bengali,
  compact = false,
}: {
  data: { label: string; income: number; expense: number }[];
  bengali?: boolean;
  compact?: boolean;
}) {
  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expense]));

  return (
    <div>
      <div className={cn("flex items-end justify-between gap-1.5", compact ? "h-28" : "h-40")}>
        {data.map((d, i) => (
          <div key={`${d.label}-${i}`} className="group flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <div className="flex h-full w-full items-end justify-center gap-[3px]">
              <div
                className="w-1/2 max-w-[13px] rounded-t-[4px] bg-brand/85 transition-all duration-500 group-hover:bg-brand"
                style={{ height: `${Math.max(3, (d.income / max) * 100)}%` }}
                title={`আয়: ${d.income}`}
              />
              <div
                className="w-1/2 max-w-[13px] rounded-t-[4px] bg-danger/70 transition-all duration-500 group-hover:bg-danger"
                style={{ height: `${Math.max(3, (d.expense / max) * 100)}%` }}
                title={`ব্যয়: ${d.expense}`}
              />
            </div>
            <span className="w-full truncate text-center text-[10px] font-medium text-muted">
              {d.label}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-center gap-4 text-[11px] font-medium text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-brand" /> আয়
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-danger/80" /> ব্যয়
        </span>
        {bengali ? null : null}
      </div>
    </div>
  );
}

export function MiniBars({
  values,
  color = "rgb(var(--brand))",
  height = 36,
}: {
  values: number[];
  color?: string;
  height?: number;
}) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {values.map((v, i) => (
        <div
          key={i}
          className="w-1.5 rounded-full transition-all"
          style={{
            height: `${Math.max(8, (v / max) * 100)}%`,
            backgroundColor: color,
            opacity: 0.35 + (i / Math.max(1, values.length - 1)) * 0.65,
          }}
        />
      ))}
    </div>
  );
}
