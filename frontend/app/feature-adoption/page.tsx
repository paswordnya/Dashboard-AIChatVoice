import { getFeatureAdoption } from "@/lib/api";
import { FeatureAdoptionChart } from "./chart";
import { Card, PageHeader, TableCard, Td, Th } from "@/components/ui";

export default async function FeatureAdoptionPage() {
  const features = await getFeatureAdoption();

  return (
    <main className="max-w-7xl p-8">
      <PageHeader
        title="Feature Adoption"
        description="% of requests using each feature. These aren't mutually exclusive (a single request can use Memory and RAG and a Tool Call at once), so bars don't sum to 100%."
      />

      <Card className="mb-6">
        <FeatureAdoptionChart data={features} />
      </Card>

      <TableCard>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/[0.06]">
            <tr>
              <Th>Feature</Th>
              <Th right>Requests</Th>
              <Th right>Adoption</Th>
            </tr>
          </thead>
          <tbody>
            {features.map((f) => (
              <tr key={f.feature} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                <Td className="font-medium">{f.feature}</Td>
                <Td right>{f.requests.toLocaleString()}</Td>
                <Td right>{(f.percentage * 100).toFixed(1)}%</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </main>
  );
}
