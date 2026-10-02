import { getCostSavings } from "@/lib/api";
import { Card, PageHeader, StatCard } from "@/components/ui";
import { IconCpu, IconDatabase, IconDollar, IconGrid, IconTrendingUp } from "@/components/icons";

function formatUsd(value: number): string {
  return `$${value.toFixed(4)}`;
}

export default async function CostSavingsPage() {
  const data = await getCostSavings();

  const cards = [
    { label: "Local Requests", value: data.local_requests.toLocaleString(), icon: IconGrid },
    { label: "Cloud Requests", value: data.cloud_requests.toLocaleString(), icon: IconDatabase },
    { label: "Actual Cloud Cost", value: formatUsd(data.actual_cloud_cost_usd), icon: IconDollar },
    { label: "Avg Cost / Cloud Request", value: formatUsd(data.avg_cost_per_cloud_request_usd), icon: IconCpu },
    { label: "Estimated Savings", value: formatUsd(data.estimated_savings_usd), icon: IconTrendingUp },
    { label: "Est. Cost If All-Cloud", value: formatUsd(data.estimated_cost_if_all_cloud_usd), icon: IconDollar },
  ];

  return (
    <main className="max-w-7xl p-8">
      <PageHeader
        title="Cost Saving Analytics"
        description="Estimated $ saved by answering locally instead of via a cloud model. The baseline is the average cost of an actual cloud request; savings assumes every local request would have cost that same average on cloud — a rough proxy, not per-request token accounting."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {cards.map((c, i) => (
          <StatCard key={c.label} label={c.label} value={c.value} icon={<c.icon className="h-5 w-5" />} tintIndex={i} />
        ))}
      </div>

      <Card className="mt-6">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Estimated savings so far</div>
        <div className="mt-2 text-3xl font-bold text-emerald-400">{formatUsd(data.estimated_savings_usd)}</div>
        <div className="mt-1 text-xs text-slate-500">
          out of an estimated {formatUsd(data.estimated_cost_if_all_cloud_usd)} if every request had gone to cloud instead
        </div>
      </Card>
    </main>
  );
}
