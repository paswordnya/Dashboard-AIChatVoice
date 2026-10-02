import { getKnowledgeGap } from "@/lib/api";
import { PageHeader, Pill, TableCard, Td, Th } from "@/components/ui";

export default async function KnowledgeGapPage() {
  const questions = await getKnowledgeGap(20);

  return (
    <main className="max-w-7xl p-8">
      <PageHeader
        title="Knowledge Gap Analytics"
        description="Questions Local Database, Memory, and RAG all missed — the request fell straight through to the LLM with no grounding. Ranked by frequency, these are the strongest candidates for expanding the knowledge base. Topic/Topic Category (auto-detected subject matter) is the stronger signal for what to write; Task/Intent just says which AI-router task handled it."
      />

      <TableCard>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/[0.06]">
            <tr>
              <Th>Question</Th>
              <Th>Topic</Th>
              <Th>Topic Category</Th>
              <Th>Task</Th>
              <Th>Intent</Th>
              <Th right>Requests</Th>
            </tr>
          </thead>
          <tbody>
            {questions.map((q) => (
              <tr key={q.query_text} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                <Td className="font-medium">{q.query_text}</Td>
                <Td muted>{q.topic ?? "—"}</Td>
                <Td muted>{q.topic_category ? <Pill tone="neutral">{q.topic_category}</Pill> : "—"}</Td>
                <Td muted className="capitalize">{q.category ?? "—"}</Td>
                <Td muted>{q.most_common_intent ?? "—"}</Td>
                <Td right>{q.requests.toLocaleString()}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </main>
  );
}
