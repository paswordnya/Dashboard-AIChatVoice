import { getCategories, getCategoryRouting } from "@/lib/api";
import { PageHeader, Pill, SectionHeader, TableCard, Td, Th } from "@/components/ui";

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export default async function CategoriesPage() {
  const categories = await getCategories();
  const topCategory = categories[0];
  const routing = topCategory ? await getCategoryRouting(topCategory.category) : [];

  return (
    <main className="max-w-7xl p-8">
      <PageHeader
        title="Category Analytics"
        description="§5 Category Analytics — AI-router task/route categories (e.g. qna, small_talk, health_symptom_mild) ranked by how often they're asked. Not conversation topics — see the Topics page for that."
      />

      <TableCard>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/[0.06]">
            <tr>
              <Th>Task</Th>
              <Th right>Requests</Th>
              <Th right>Share</Th>
              <Th right>Success Rate</Th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c, i) => (
              <tr key={c.category} className={`border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] ${i === 0 ? "bg-indigo-500/10" : ""}`}>
                <Td className="font-medium capitalize">
                  <span className="inline-flex items-center gap-2">
                    {c.category}
                    {i === 0 && <Pill tone="info">most asked</Pill>}
                  </span>
                </Td>
                <Td right>{c.requests.toLocaleString()}</Td>
                <Td right>{formatPct(c.percentage)}</Td>
                <Td right>{formatPct(c.success_rate)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>

      {topCategory && (
        <>
          <SectionHeader
            title={`Where "${topCategory.category}" requests get routed`}
            description={`Provider/model breakdown for the most-asked category (${topCategory.requests.toLocaleString()} requests).`}
          />

          <TableCard>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/[0.06]">
                <tr>
                  <Th>Provider</Th>
                  <Th>Model</Th>
                  <Th right>Requests</Th>
                  <Th right>Share</Th>
                </tr>
              </thead>
              <tbody>
                {routing.map((r) => (
                  <tr key={`${r.provider}-${r.model_used}`} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                    <Td muted>{r.provider}</Td>
                    <Td className="font-medium">{r.model_used}</Td>
                    <Td right>{r.requests.toLocaleString()}</Td>
                    <Td right>{formatPct(r.percentage)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableCard>
        </>
      )}
    </main>
  );
}
