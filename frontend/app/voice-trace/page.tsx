import Link from "next/link";
import { getVoiceTraces } from "@/lib/api";
import { formatRelativeDate } from "@/lib/format";
import { PageHeader, Pill, TableCard, Td, Th } from "@/components/ui";
import { fmtMs } from "./format";

function ModeFilterLink({ mode, current, label }: { mode?: "a" | "b"; current?: "a" | "b"; label: string }) {
  const active = mode === current;
  const href = mode ? `/voice-trace?mode=${mode}` : "/voice-trace";
  return (
    <Link href={href}>
      <Pill tone={active ? "info" : "neutral"}>{label}</Pill>
    </Link>
  );
}

export default async function VoiceTracePage({ searchParams }: { searchParams: Promise<{ mode?: "a" | "b" }> }) {
  const { mode } = await searchParams;
  const traces = await getVoiceTraces({ mode, limit: 50 });

  return (
    <main className="max-w-7xl p-8">
      <PageHeader
        title="Voice Trace"
        description="Per-turn distributed-tracing view of the voice pipeline — every stage from the user's first sound to Pip's audio finishing, so a bottleneck can be spotted without reading raw logs."
      />

      <div className="mb-4 flex items-center gap-2">
        <ModeFilterLink current={mode} label="All" />
        <ModeFilterLink mode="a" current={mode} label="Mode A" />
        <ModeFilterLink mode="b" current={mode} label="Mode B" />
      </div>

      <TableCard>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/[0.06]">
            <tr>
              <Th>Trace</Th>
              <Th>Timestamp</Th>
              <Th>Mode</Th>
              <Th right>Duration</Th>
              <Th right>Stages</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {traces.length === 0 && (
              <tr>
                <Td colSpan={6} className="text-center text-slate-500">No voice traces yet.</Td>
              </tr>
            )}
            {traces.map((t) => (
              <tr key={t.trace_id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                <Td className="font-medium text-indigo-400">
                  <Link href={`/voice-trace/${encodeURIComponent(t.trace_id)}`} title={t.trace_id} className="font-mono">
                    {t.trace_id.slice(0, 8)}…
                  </Link>
                </Td>
                <Td muted>{formatRelativeDate(t.started_at)}</Td>
                <Td>
                  <Pill tone={t.mode === "a" ? "info" : "neutral"}>{t.mode === "a" ? "Mode A" : "Mode B"}</Pill>
                </Td>
                <Td right>{fmtMs(t.total_duration_ms)}</Td>
                <Td right muted>{t.stage_count}</Td>
                <Td>
                  <Pill tone={t.has_error ? "negative" : "positive"}>{t.has_error ? "Error" : "OK"}</Pill>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </main>
  );
}
