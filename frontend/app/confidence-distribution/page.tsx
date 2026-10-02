import { getConfidenceDistribution } from "@/lib/api";
import { ConfidenceHistogram } from "./chart";
import { Card, PageHeader, StatCard } from "@/components/ui";
import { IconActivity, IconArrowUpCircle, IconAlertTriangle } from "@/components/icons";

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export default async function ConfidenceDistributionPage() {
  const data = await getConfidenceDistribution();

  return (
    <main className="max-w-7xl p-8">
      <PageHeader
        title="Confidence Distribution"
        description="Distribution of intent/routing confidence. The low cluster (highlighted) is where wrong routes and model escalations concentrate — the area most worth improving."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Average Confidence" value={pct(data.avg_confidence)} icon={<IconActivity className="h-5 w-5" />} tintIndex={0} />
        <StatCard
          label="Avg When Routed Correctly"
          value={pct(data.avg_confidence_when_routed_correctly)}
          valueClassName="text-emerald-400"
          icon={<IconArrowUpCircle className="h-5 w-5" />}
          tintIndex={1}
        />
        <StatCard
          label="Avg When Wrong / Escalated"
          value={pct(data.avg_confidence_when_wrong_or_escalated)}
          valueClassName="text-rose-400"
          icon={<IconAlertTriangle className="h-5 w-5" />}
          tintIndex={3}
        />
      </div>

      <Card className="mt-6">
        <ConfidenceHistogram buckets={data.buckets} />
      </Card>
    </main>
  );
}
