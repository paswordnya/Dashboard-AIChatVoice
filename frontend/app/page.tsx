import { getCategories, getModelUsage, getOverviewKPIs, getProviderStatus, type ProviderStatus } from "@/lib/api";
import { DonutChart, type DonutSlice } from "@/components/donut-chart";
import { Card, PageHeader, SectionHeader, StatCard } from "@/components/ui";
import {
  IconActivity,
  IconAlertTriangle,
  IconArrowUpCircle,
  IconCpu,
  IconDatabase,
  IconGrid,
  IconSliders,
  IconTrendingUp,
  IconUsers,
} from "@/components/icons";

const KPI_LABELS: {
  key: keyof Awaited<ReturnType<typeof getOverviewKPIs>>;
  label: string;
  format: "count" | "ms" | "pct";
  icon: (p: { className?: string }) => React.ReactElement;
}[] = [
  { key: "total_requests", label: "Total Requests", format: "count", icon: IconGrid },
  { key: "total_conversations", label: "Total Conversations", format: "count", icon: IconActivity },
  { key: "total_active_users", label: "Total Active Users", format: "count", icon: IconUsers },
  { key: "total_sessions", label: "Total Sessions", format: "count", icon: IconDatabase },
  { key: "average_response_time_ms", label: "Average Response Time", format: "ms", icon: IconCpu },
  { key: "average_first_token_time_ms", label: "Average First Token Time", format: "ms", icon: IconTrendingUp },
  { key: "success_rate", label: "Success Rate", format: "pct", icon: IconArrowUpCircle },
  { key: "error_rate", label: "Error Rate", format: "pct", icon: IconAlertTriangle },
  { key: "tool_call_rate", label: "Tool Call Rate", format: "pct", icon: IconSliders },
];

function formatValue(value: number | null, format: "count" | "ms" | "pct"): string {
  if (value === null) return "—";
  if (format === "pct") return `${(value * 100).toFixed(1)}%`;
  if (format === "ms") return `${value.toFixed(0)} ms`;
  return value.toLocaleString();
}

const REASON_LABELS: Record<NonNullable<ProviderStatus["reason"]>, string> = {
  quota: "kuota/rate-limit habis",
  auth: "API key salah/kadaluarsa",
  server_error: "server error",
  network: "timeout/koneksi gagal",
};

function formatCooldown(seconds: number): string {
  if (seconds < 60) return `~${seconds}s lagi`;
  return `~${Math.ceil(seconds / 60)} menit lagi`;
}

// Live "is this provider unusable right now" banner (provider_health.py's
// cooldown state, bpjs-pending-bot-local) — distinct from the Model
// Distribution chart below, which is historical volume, not live status.
function ProviderStatusAlert({ providers }: { providers: ProviderStatus[] }) {
  const down = providers.filter((p) => p.is_down);
  if (down.length === 0) return null;

  return (
    <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
      <p className="text-sm font-medium text-amber-400">
        {down.length} model{down.length > 1 ? "s" : ""} sedang tidak bisa dipakai:
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {down.map((p) => (
          <span
            key={p.provider_key}
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300"
            title={p.reason ? REASON_LABELS[p.reason] : undefined}
          >
            {p.display_name}
            <span className="text-amber-400/70">
              · {p.reason ? REASON_LABELS[p.reason] : "down"} · {formatCooldown(p.cooldown_remaining_seconds)}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

// Fixed hue per model (entity), not by rank — slots 1-8 of the validated
// categorical palette, all 8 models fit with no folding needed.
const MODEL_COLORS: Record<string, string> = {
  "Gemma-4-E4B": "#2a78d6",
  "Gemma-4-26B": "#1baf7a",
  "Qwen3.6-27B": "#eda100",
  Nemotron: "#008300",
  "gemini-flash": "#4a3aa7",
  "gpt-5-mini": "#e34948",
  "claude-haiku": "#e87ba4",
  "llama3.3:8b": "#eb6834",
};

// Categories: top 6 get a hue each, everything past that folds into "Other"
// (muted gray, not a categorical hue — it's not a real single entity).
const CATEGORY_COLORS = ["#2a78d6", "#1baf7a", "#eda100", "#008300", "#4a3aa7", "#e34948"];
const OTHER_COLOR = "#898781";
const TOP_CATEGORY_COUNT = 6;

export default async function OverviewPage() {
  const [kpis, models, categories] = await Promise.all([getOverviewKPIs(), getModelUsage(), getCategories()]);

  // Fetched independently, same defensive pattern as app/bot-config/page.tsx
  // and app/users/page.tsx: bpjs-pending-bot-local (a separate project's
  // backend) being unreachable must degrade to "no alert shown", not crash
  // the whole Overview page.
  let providerStatus: ProviderStatus[] = [];
  try {
    providerStatus = await getProviderStatus();
  } catch {
    // silently degrade — this banner is a bonus signal, not core KPI data
  }

  const modelSlices: DonutSlice[] = models.map((m) => ({
    key: m.model_used,
    label: m.model_used,
    value: m.total_requests,
    color: MODEL_COLORS[m.model_used] ?? OTHER_COLOR,
  }));

  const topCategories = categories.slice(0, TOP_CATEGORY_COUNT);
  const restCategories = categories.slice(TOP_CATEGORY_COUNT);
  const otherRequests = restCategories.reduce((sum, c) => sum + c.requests, 0);

  const categorySlices: DonutSlice[] = [
    ...topCategories.map((c, i) => ({
      key: c.category,
      label: c.category.charAt(0).toUpperCase() + c.category.slice(1),
      value: c.requests,
      color: CATEGORY_COLORS[i],
    })),
    ...(otherRequests > 0
      ? [{ key: "other", label: `Other (${restCategories.length})`, value: otherRequests, color: OTHER_COLOR }]
      : []),
  ];

  return (
    <main className="max-w-7xl p-8">
      <PageHeader
        title="Overview"
        description="§1 KPI cards — request_metadata rows, no date-range filter applied yet."
      />

      <ProviderStatusAlert providers={providerStatus} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {KPI_LABELS.map(({ key, label, format, icon: Icon }, i) => (
          <StatCard
            key={key}
            label={label}
            value={formatValue(kpis[key] as number | null, format)}
            icon={<Icon className="h-5 w-5" />}
            tintIndex={i}
          />
        ))}
      </div>

      <SectionHeader
        title="Distribution"
        description={`Model volume and most-asked tasks — tasks beyond the top ${TOP_CATEGORY_COUNT} fold into "Other" (a 10-slice pie is hard to read).`}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="text-base font-semibold text-white">Model Distribution</h3>
          <p className="text-sm text-slate-400">§3 Model Distribution — requests per model.</p>
          <div className="mt-2 flex justify-center">
            <DonutChart data={modelSlices} />
          </div>
        </Card>

        <Card>
          <h3 className="text-base font-semibold text-white">Task Distribution</h3>
          <p className="text-sm text-slate-400">§5 Category Analytics — most-asked AI-router tasks (not conversation topics).</p>
          <div className="mt-2 flex justify-center">
            <DonutChart data={categorySlices} />
          </div>
        </Card>
      </div>
    </main>
  );
}
