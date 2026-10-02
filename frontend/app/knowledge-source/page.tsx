import { getKnowledgeSourceDistribution } from "@/lib/api";
import { KnowledgeSourceChart } from "./chart";
import { Card, PageHeader, TableCard, Td, Th } from "@/components/ui";

export default async function KnowledgeSourcePage() {
  const distribution = await getKnowledgeSourceDistribution();

  return (
    <main className="max-w-7xl p-8">
      <PageHeader
        title="Knowledge Source Distribution"
        description="§13 Knowledge Source Distribution — where AI answers came from, ranked by volume (includes Local Database)."
      />

      <Card className="mb-6">
        <KnowledgeSourceChart data={distribution} />
      </Card>

      <TableCard>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/[0.06]">
            <tr>
              <Th>Source</Th>
              <Th right>Requests</Th>
              <Th right>Percentage</Th>
            </tr>
          </thead>
          <tbody>
            {distribution.map((row) => (
              <tr key={row.source} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                <Td className="font-medium">{row.label}</Td>
                <Td right>{row.requests.toLocaleString()}</Td>
                <Td right>{(row.percentage * 100).toFixed(1)}%</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </main>
  );
}
