import { getModelUsage } from "@/lib/api";
import { formatRelativeDate } from "@/lib/format";
import { PageHeader, TableCard, Td, Th } from "@/components/ui";

function formatLatency(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms.toFixed(0)} ms`;
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export default async function ModelUsagePage() {
  const models = await getModelUsage();

  return (
    <main className="max-w-7xl p-8">
      <PageHeader title="Model Usage" description="§2 Model Usage — requests per model, ranked by volume." />

      <TableCard>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/[0.06]">
            <tr>
              <Th>Model</Th>
              <Th>Provider</Th>
              <Th right>Requests</Th>
              <Th right>Success</Th>
              <Th right>Error</Th>
              <Th right>Avg Latency</Th>
              <Th right>Avg Tokens</Th>
              <Th right>Avg Cost</Th>
              <Th>Last Used</Th>
            </tr>
          </thead>
          <tbody>
            {models.map((m) => (
              <tr key={`${m.model_used}-${m.provider}`} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                <Td className="font-medium">{m.model_used}</Td>
                <Td muted>{m.provider}</Td>
                <Td right>{m.total_requests.toLocaleString()}</Td>
                <Td right>{formatPct(m.success_rate)}</Td>
                <Td right>{formatPct(m.error_rate)}</Td>
                <Td right>{formatLatency(m.avg_latency_ms)}</Td>
                <Td right>{m.avg_token_usage.toFixed(0)}</Td>
                <Td right>{m.avg_cost_usd !== null ? `$${m.avg_cost_usd.toFixed(4)}` : "—"}</Td>
                <Td muted>{formatRelativeDate(m.last_used)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </main>
  );
}
