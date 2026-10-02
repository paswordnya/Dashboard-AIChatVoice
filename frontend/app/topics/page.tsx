import Link from "next/link";
import {
  getNewTopics,
  getTopicsByChannel,
  getTopicsByModel,
  getTopics,
  getTopicsSummary,
  getTopicTimeline,
} from "@/lib/api";
import { formatRelativeDate } from "@/lib/format";
import { Card, PageHeader, Pill, SectionHeader, StatCard, TableCard, Td, Th } from "@/components/ui";
import { IconActivity, IconGrid, IconTrendingUp, IconUsers } from "@/components/icons";
import { TopicTimelineChart } from "./chart";

function formatGrowth(pct: number | null): string {
  if (pct === null) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

export default async function TopicsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;

  const [summary, topics, byModel, byChannel, newTopics, timeline] = await Promise.all([
    getTopicsSummary(),
    getTopics(q, 50),
    getTopicsByModel(),
    getTopicsByChannel(),
    getNewTopics(7),
    getTopicTimeline("day"),
  ]);

  return (
    <main className="max-w-7xl p-8">
      <PageHeader
        title="Topics"
        description="Auto-detected conversation subjects (Intent → Category → Topic) — what users actually ask about, across Telegram, Chat, and Voice, without reading raw logs."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Topics" value={summary.total_topics.toLocaleString()} icon={<IconTrendingUp className="h-5 w-5" />} tintIndex={0} />
        <StatCard label="New This Week" value={summary.new_this_week.toLocaleString()} icon={<IconGrid className="h-5 w-5" />} tintIndex={1} />
        <StatCard label="Active Topics" value={summary.active_topics.toLocaleString()} icon={<IconActivity className="h-5 w-5" />} tintIndex={2} />
        <StatCard label="Topic Growth" value={formatGrowth(summary.topic_growth_percent)} icon={<IconUsers className="h-5 w-5" />} tintIndex={3} />
      </div>

      <SectionHeader title="Timeline" description="Daily topic activity — total requests that surfaced a topic." />
      <Card>
        <TopicTimelineChart data={timeline} />
      </Card>

      <SectionHeader title="Leaderboard" description="Every detected topic, ranked by volume." />
      <form method="get" className="mb-4">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search topics (e.g. SwiftUI)…"
          className="w-full max-w-sm rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-indigo-500/50 focus:outline-none"
        />
      </form>

      <TableCard>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/[0.06]">
            <tr>
              <Th>Topic</Th>
              <Th>Category</Th>
              <Th right>Requests</Th>
              <Th right>Telegram</Th>
              <Th right>Chat</Th>
              <Th right>Voice</Th>
              <Th>Last Seen</Th>
            </tr>
          </thead>
          <tbody>
            {topics.length === 0 && (
              <tr>
                <Td colSpan={7} className="text-center text-slate-500">
                  {q ? `No topics matching "${q}".` : "No topics detected yet."}
                </Td>
              </tr>
            )}
            {topics.map((t) => (
              <tr key={t.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                <Td className="font-medium text-indigo-400">
                  <Link href={`/topics/${t.id}`}>{t.name}</Link>
                </Td>
                <Td muted>{t.category ? <Pill tone="neutral">{t.category}</Pill> : "—"}</Td>
                <Td right>{t.total_requests.toLocaleString()}</Td>
                <Td right muted>{t.channels.telegram.toLocaleString()}</Td>
                <Td right muted>{t.channels.chat.toLocaleString()}</Td>
                <Td right muted>{t.channels.voice.toLocaleString()}</Td>
                <Td muted>{formatRelativeDate(t.last_seen)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <SectionHeader title="Topic per Model" description="Which model answers each topic." />
          <TableCard>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/[0.06]">
                <tr>
                  <Th>Topic</Th>
                  <Th>Model</Th>
                  <Th right>Requests</Th>
                </tr>
              </thead>
              <tbody>
                {byModel.map((r) => (
                  <tr key={`${r.topic}-${r.model_used}`} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                    <Td className="font-medium">{r.topic}</Td>
                    <Td muted title={r.provider}>{r.model_used}</Td>
                    <Td right>{r.requests.toLocaleString()}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableCard>
        </div>

        <div>
          <SectionHeader title="Topic per Channel" description="Which channel each topic is discussed on." />
          <TableCard>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/[0.06]">
                <tr>
                  <Th>Topic</Th>
                  <Th right>Chat</Th>
                  <Th right>Voice</Th>
                  <Th right>Telegram</Th>
                </tr>
              </thead>
              <tbody>
                {byChannel.map((r) => (
                  <tr key={r.topic} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                    <Td className="font-medium">{r.topic}</Td>
                    <Td right muted>{r.channels.chat.toLocaleString()}</Td>
                    <Td right muted>{r.channels.voice.toLocaleString()}</Td>
                    <Td right muted>{r.channels.telegram.toLocaleString()}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableCard>
        </div>
      </div>

      <SectionHeader title="New This Week" description="Topics first seen in the last 7 days." />
      <TableCard>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/[0.06]">
            <tr>
              <Th>Topic</Th>
              <Th>Category</Th>
              <Th>Created</Th>
            </tr>
          </thead>
          <tbody>
            {newTopics.length === 0 && (
              <tr>
                <Td colSpan={3} className="text-center text-slate-500">No new topics this week.</Td>
              </tr>
            )}
            {newTopics.map((t) => (
              <tr key={t.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                <Td className="font-medium text-indigo-400">
                  <Link href={`/topics/${t.id}`}>{t.name}</Link>
                </Td>
                <Td muted>{t.category ?? "—"}</Td>
                <Td>
                  <Pill tone={t.created === "Today" ? "positive" : "neutral"}>{t.created}</Pill>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </main>
  );
}
