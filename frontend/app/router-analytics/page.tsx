import { getFallbackByModel, getRouterAnalytics, type RouterAnalytics } from "@/lib/api";
import { PageHeader, SectionHeader, StatCard, TableCard, Td, Th } from "@/components/ui";
import { IconActivity, IconArrowUpCircle, IconAlertTriangle, IconShuffle, IconTrendingUp, IconSliders } from "@/components/icons";

const CARDS: {
  key: keyof RouterAnalytics;
  label: string;
  format: "count" | "pct";
  icon: (p: { className?: string }) => React.ReactElement;
}[] = [
  { key: "total_routed_requests", label: "Total Routed Requests", format: "count", icon: IconShuffle },
  { key: "route_success", label: "Route Success", format: "count", icon: IconArrowUpCircle },
  { key: "route_failure", label: "Route Failure", format: "count", icon: IconAlertTriangle },
  { key: "local_to_cloud_fallback", label: "Local → Cloud Fallback", format: "count", icon: IconTrendingUp },
  { key: "cloud_to_local_fallback", label: "Cloud → Local Fallback", format: "count", icon: IconActivity },
  { key: "wrong_route_rate", label: "Wrong Route Rate", format: "pct", icon: IconAlertTriangle },
  { key: "manual_override", label: "Manual Override", format: "count", icon: IconSliders },
];

function formatValue(value: number, format: "count" | "pct"): string {
  return format === "pct" ? `${(value * 100).toFixed(1)}%` : value.toLocaleString();
}

export default async function RouterAnalyticsPage() {
  const [data, fallbackByModel] = await Promise.all([getRouterAnalytics(), getFallbackByModel()]);

  return (
    <main className="max-w-7xl p-8">
      <PageHeader
        title="Router Analytics"
        description="§9 Router Analytics — Route Success is proxied by overall request success (no separate routing-vs-inference outcome tracked yet). Fallback direction is derived from route_fallback + the provider the request landed on."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {CARDS.map(({ key, label, format, icon: Icon }, i) => (
          <StatCard key={key} label={label} value={formatValue(data[key], format)} icon={<Icon className="h-5 w-5" />} tintIndex={i} />
        ))}
      </div>

      <SectionHeader
        title="Fallback destinations"
        description="Which models end up absorbing fallback traffic when the router's first choice couldn't be used."
      />

      <TableCard>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/[0.06]">
            <tr>
              <Th>Model</Th>
              <Th>Provider</Th>
              <Th right>Fallback Count</Th>
              <Th right>Share of Fallbacks</Th>
            </tr>
          </thead>
          <tbody>
            {fallbackByModel.map((f) => (
              <tr key={`${f.model_used}-${f.provider}`} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                <Td className="font-medium">{f.model_used}</Td>
                <Td muted>{f.provider}</Td>
                <Td right>{f.fallback_count.toLocaleString()}</Td>
                <Td right>{(f.percentage_of_all_fallbacks * 100).toFixed(1)}%</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </main>
  );
}
