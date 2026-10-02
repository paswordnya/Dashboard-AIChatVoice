import { getTopFailedQuestions } from "@/lib/api";
import { PageHeader, Pill, TableCard, Td, Th } from "@/components/ui";

export default async function TopFailedQuestionsPage() {
  const questions = await getTopFailedQuestions(20);

  return (
    <main className="max-w-7xl p-8">
      <PageHeader
        title="Top Failed Questions"
        description="Questions most often failing outright or drawing negative feedback, ranked by failures + negative feedback combined. Topic/Topic Category (auto-detected subject matter) is the stronger signal for what to fix; Task just says which AI-router task handled it."
      />

      <TableCard>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/[0.06]">
            <tr>
              <Th>Question</Th>
              <Th>Topic</Th>
              <Th>Topic Category</Th>
              <Th>Task</Th>
              <Th right>Total Requests</Th>
              <Th right>Failures</Th>
              <Th right>Negative Feedback</Th>
            </tr>
          </thead>
          <tbody>
            {questions.map((q) => (
              <tr key={q.query_text} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                <Td className="font-medium">{q.query_text}</Td>
                <Td muted>{q.topic ?? "—"}</Td>
                <Td muted>{q.topic_category ? <Pill tone="neutral">{q.topic_category}</Pill> : "—"}</Td>
                <Td muted className="capitalize">{q.category ?? "—"}</Td>
                <Td right>{q.total_requests.toLocaleString()}</Td>
                <Td right className="text-rose-400">{q.failure_count.toLocaleString()}</Td>
                <Td right className="text-amber-400">{q.negative_feedback_count.toLocaleString()}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </main>
  );
}
