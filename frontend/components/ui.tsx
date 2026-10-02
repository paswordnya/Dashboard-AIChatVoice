import type { ReactNode } from "react";

// Shared visual primitives for the dashboard — pure presentation, no data
// fetching or state. Every page composes its existing data/props through
// these instead of repeating raw Tailwind card/table markup.

export function PageHeader({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
      {description && <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-400">{description}</p>}
    </div>
  );
}

export function SectionHeader({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <div className="mb-4 mt-10 first:mt-0">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {description && <p className="mt-1 max-w-3xl text-sm text-slate-400">{description}</p>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card p-5 ${className}`}>{children}</div>;
}

export function TableCard({ children }: { children: ReactNode }) {
  return <div className="card overflow-x-auto">{children}</div>;
}

// Rotating soft-tint chip colors for stat-card icons — cosmetic variety
// only, not tied to data semantics (unlike chart categorical colors).
const CHIP_TINTS = [
  "bg-indigo-500/10 text-indigo-400",
  "bg-emerald-500/10 text-emerald-400",
  "bg-amber-500/10 text-amber-400",
  "bg-rose-500/10 text-rose-400",
  "bg-sky-500/10 text-sky-400",
  "bg-violet-500/10 text-violet-400",
  "bg-teal-500/10 text-teal-400",
  "bg-fuchsia-500/10 text-fuchsia-400",
] as const;

export function StatCard({
  label,
  value,
  icon,
  tintIndex = 0,
  valueClassName = "",
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tintIndex?: number;
  valueClassName?: string;
}) {
  return (
    <Card className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="truncate text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
        <div className={`mt-2 text-2xl font-bold text-white ${valueClassName}`}>{value}</div>
      </div>
      {icon && (
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${CHIP_TINTS[tintIndex % CHIP_TINTS.length]}`}
        >
          {icon}
        </div>
      )}
    </Card>
  );
}

export function Th({ children, right = false }: { children: ReactNode; right?: boolean }) {
  return (
    <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 ${right ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

export function Td({
  children,
  right = false,
  muted = false,
  className = "",
  colSpan,
  title,
}: {
  children: ReactNode;
  right?: boolean;
  muted?: boolean;
  className?: string;
  colSpan?: number;
  title?: string;
}) {
  return (
    <td
      colSpan={colSpan}
      title={title}
      className={`px-4 py-3 text-slate-200 ${right ? "text-right" : "text-left"} ${muted ? "!text-slate-400" : ""} ${className}`}
    >
      {children}
    </td>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "positive" | "negative" | "warning" | "info";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-white/[0.06] text-slate-300",
    positive: "bg-emerald-500/10 text-emerald-400",
    negative: "bg-rose-500/10 text-rose-400",
    warning: "bg-amber-500/10 text-amber-400",
    info: "bg-sky-500/10 text-sky-400",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function Tag({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span title={title} className="inline-flex items-center rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-xs text-slate-300">
      {children}
    </span>
  );
}

// Circular percentage ring — the "Adminator" reference's donut-progress
// stat pattern, reused here only for metrics that are genuinely a 0-100%
// value (Success Rate, Confidence, Escalation Rate); never fabricated for
// stats that aren't actually a percentage.
export function RadialStat({
  label,
  sublabel,
  percent,
  color = "#6366f1",
}: {
  label: string;
  sublabel?: string;
  percent: number;
  color?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className="flex items-center gap-4">
      <svg width="76" height="76" viewBox="0 0 76 76" className="shrink-0 -rotate-90">
        <circle cx="38" cy="38" r={radius} fill="none" stroke="currentColor" strokeWidth="7" className="text-white/[0.06]" />
        <circle
          cx="38"
          cy="38"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
        <text x="38" y="38" textAnchor="middle" dominantBaseline="central" className="rotate-90 fill-white text-[17px] font-bold" style={{ transform: "rotate(90deg)", transformOrigin: "38px 38px" }}>
          {clamped.toFixed(0)}%
        </text>
      </svg>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-white">{label}</div>
        {sublabel && <div className="truncate text-xs text-slate-500">{sublabel}</div>}
      </div>
    </div>
  );
}
