import Link from "next/link";
import { notFound } from "next/navigation";
import { getTopicDetail } from "@/lib/api";
import { formatRelativeDate } from "@/lib/format";
import { Card, PageHeader, Pill, SectionHeader, StatCard, TableCard, Td, Th } from "@/components/ui";
import { IconActivity, IconDatabase, IconGrid, IconTrendingUp } from "@/components/icons";
import { TopicTimelineChart } from "../chart";

export default async function TopicDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const topicId = Number(id);
  if (!Number.isFinite(topicId)) notFound();

  let topic;
  try {
    topic = await getTopicDetail(topicId);
  } catch {
    notFound();
  }

  return (
    <main className="max-w-7xl p-8">
      <Link href="/topics" className="text-sm text-indigo-400 hover:underline">
        ← Back to Topics
      </Link>

      <PageHeader
        title={topic.name}
        description={
          <>
            {topic.category && <Pill tone="neutral">{topic.category}</Pill>}
            <span className="ml-2">
              First seen {formatRelativeDate(topic.first_seen)} · Last seen {formatRelativeDate(topic.last_seen)}
            </span>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Requests" value={topic.total_requests.toLocaleString()} icon={<IconGrid className="h-5 w-5" />} tintIndex={0} />
        <StatCard
          label="Avg Response Time"
          value={topic.avg_latency_ms !== null ? `${Math.round(topic.avg_latency_ms).toLocaleString()} ms` : "—"}
          icon={<IconActivity className="h-5 w-5" />}
          tintIndex={1}
        />
        <StatCard label="Telegram" value={topic.channels.telegram.toLocaleString()} icon={<IconTrendingUp className="h-5 w-5" />} tintIndex={2} />
        <StatCard label="Chat + Voice" value={(topic.channels.chat + topic.channels.voice).toLocaleString()} icon={<IconDatabase className="h-5 w-5" />} tintIndex={3} />
      </div>

      <SectionHeader title="Trend" description="Daily request volume for this topic." />
      <Card>
        <TopicTimelineChart data={topic.trend} />
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <SectionHeader title="Top Intents" />
          <TableCard>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/[0.06]">
                <tr>
                  <Th>Intent</Th>
                  <Th right>Requests</Th>
                </tr>
              </thead>
              <tbody>
                {topic.top_intents.length === 0 && (
                  <tr>
                    <Td colSpan={2} className="text-center text-slate-500">No intent data.</Td>
                  </tr>
                )}
                {topic.top_intents.map((r) => (
                  <tr key={r.intent} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                    <Td className="font-medium">{r.intent}</Td>
                    <Td right>{r.requests.toLocaleString()}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableCard>
        </div>

        <div>
          <SectionHeader title="Models Used" />
          <TableCard>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/[0.06]">
                <tr>
                  <Th>Model</Th>
                  <Th right>Requests</Th>
                </tr>
              </thead>
              <tbody>
                {topic.models_used.map((r) => (
                  <tr key={r.model_used} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                    <Td className="font-medium" title={r.provider}>{r.model_used}</Td>
                    <Td right>{r.requests.toLocaleString()}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableCard>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <SectionHeader title="Knowledge Source" />
          <TableCard>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/[0.06]">
                <tr>
                  <Th>Source</Th>
                  <Th right>Requests</Th>
                </tr>
              </thead>
              <tbody>
                {topic.knowledge_source.map((r) => (
                  <tr key={r.knowledge_source} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                    <Td className="font-medium">{r.knowledge_source}</Td>
                    <Td right>{r.requests.toLocaleString()}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableCard>
        </div>

        <div>
          <SectionHeader title="Related Topics" description="Topics discussed in the same conversations." />
          <TableCard>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/[0.06]">
                <tr>
                  <Th>Topic</Th>
                  <Th right>Co-occurrences</Th>
                </tr>
              </thead>
              <tbody>
                {topic.related_topics.length === 0 && (
                  <tr>
                    <Td colSpan={2} className="text-center text-slate-500">No related topics yet.</Td>
                  </tr>
                )}
                {topic.related_topics.map((r) => (
                  <tr key={r.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                    <Td className="font-medium text-indigo-400">
                      <Link href={`/topics/${r.id}`}>{r.name}</Link>
                    </Td>
                    <Td right>{r.co_occurrences.toLocaleString()}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableCard>
        </div>
      </div>
    </main>
  );
}
