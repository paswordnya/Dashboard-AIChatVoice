import { getEscalationAnalytics } from "@/lib/api";
import { PageHeader, SectionHeader, StatCard, TableCard, Td, Th } from "@/components/ui";
import { IconArrowUpCircle, IconGrid, IconTrendingUp } from "@/components/icons";

export default async function EscalationAnalyticsPage() {
  const data = await getEscalationAnalytics();

  return (
    <main className="max-w-7xl p-8">
      <PageHeader
        title="Escalation Analytics"
        description="How often a request had to climb from a small/local model up to a bigger or cloud model before it could be answered."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Total Requests" value={data.total_requests.toLocaleString()} icon={<IconGrid className="h-5 w-5" />} tintIndex={0} />
        <StatCard label="Escalated Requests" value={data.escalated_requests.toLocaleString()} icon={<IconTrendingUp className="h-5 w-5" />} tintIndex={1} />
        <StatCard label="Escalation Rate" value={`${(data.escalation_rate * 100).toFixed(1)}%`} icon={<IconArrowUpCircle className="h-5 w-5" />} tintIndex={2} />
      </div>

      <SectionHeader title="By escalation depth" />
      <TableCard>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/[0.06]">
            <tr>
              <Th>Escalation Steps</Th>
              <Th right>Requests</Th>
            </tr>
          </thead>
          <tbody>
            {data.by_steps.map((s) => (
              <tr key={s.escalation_steps} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                <Td className="font-medium">{s.escalation_steps === 0 ? "0 (answered directly)" : s.escalation_steps}</Td>
                <Td right>{s.requests.toLocaleString()}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>

      <SectionHeader title="Most common escalation paths" />
      <TableCard>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/[0.06]">
            <tr>
              <Th>Path</Th>
              <Th right>Requests</Th>
            </tr>
          </thead>
          <tbody>
            {data.top_paths.map((p) => (
              <tr key={p.escalation_path} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                <Td className="font-medium">{p.escalation_path}</Td>
                <Td right>{p.requests.toLocaleString()}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </main>
  );
}
