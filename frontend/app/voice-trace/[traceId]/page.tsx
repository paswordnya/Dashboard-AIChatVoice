import Link from "next/link";
import { notFound } from "next/navigation";
import { getVoiceTraceDetail } from "@/lib/api";
import { Card, PageHeader, Pill, SectionHeader, StatCard, Tag } from "@/components/ui";
import { IconActivity, IconClock, IconMic } from "@/components/icons";
import { fmtMs, formatClockTime, statusTone } from "../format";
import { buildStageRows, buildWaterfallRows, findPrimaryModel, type StageRow } from "./trace-shaping";
import { WaterfallChart } from "./waterfall";

function StageTimeline({ rows }: { rows: StageRow[] }) {
  return (
    <div className="relative space-y-5 pl-5">
      <div className="absolute bottom-2 left-[7px] top-2 w-px bg-white/[0.08]" aria-hidden />
      {rows.map((row) => (
        <div key={row.spanId} className="relative">
          <div
            className={`absolute -left-5 top-1 h-3.5 w-3.5 rounded-full ${
              row.status === "ok" ? "bg-emerald-500/60" : row.status === "error" ? "bg-rose-500/60" : "bg-white/[0.2]"
            }`}
            aria-hidden
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-white">{row.label}</span>
            {row.offsetMs !== null && <Pill tone="neutral">+{Math.round(row.offsetMs)}ms</Pill>}
            <Pill tone={statusTone(row.status)}>{row.status}</Pill>
            {row.durationMs !== null && <span className="ml-auto text-sm text-slate-400">{fmtMs(row.durationMs)}</span>}
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
            <span>{formatClockTime(row.startedAt)}</span>
            {row.provider && <Tag title={row.model ?? undefined}>{row.provider}</Tag>}
          </div>
          {row.error && <p className="mt-1 text-xs text-rose-400">{row.error}</p>}
        </div>
      ))}
    </div>
  );
}

export default async function VoiceTraceDetailPage({ params }: { params: Promise<{ traceId: string }> }) {
  const { traceId } = await params;
  if (!traceId?.trim()) notFound();

  let detail;
  try {
    detail = await getVoiceTraceDetail(traceId);
  } catch {
    notFound();
  }

  const stageRows = buildStageRows(detail);
  const waterfallRows = buildWaterfallRows(detail);
  const primaryModel = findPrimaryModel(detail.spans);
  const perf = detail.performance;

  return (
    <main className="max-w-7xl p-8">
      <Link href="/voice-trace" className="text-sm text-indigo-400 hover:underline">
        ← Back to Voice Trace
      </Link>

      <PageHeader
        title={`Trace ${detail.trace_id.slice(0, 8)}…`}
        description={
          <>
            <Pill tone={detail.mode === "a" ? "info" : "neutral"}>{detail.mode === "a" ? "Mode A" : "Mode B"}</Pill>
            {primaryModel && (
              <span className="ml-2">
                <Tag>{primaryModel.provider}/{primaryModel.model}</Tag>
              </span>
            )}
            <span className="ml-2">
              Session <span className="font-mono text-slate-300">{detail.session_id}</span>
              {detail.request_id && (
                <>
                  {" "}
                  · Request <span className="font-mono text-slate-300">{detail.request_id.slice(0, 8)}…</span>
                </>
              )}
            </span>
          </>
        }
      />

      <SectionHeader
        title="Voice Performance Metrics"
        description={
          detail.mode === "a"
            ? "Gemini Live's VAD/DSP internals are opaque to this pipeline — VAD/NS/AEC/AGC times are expected to be empty for Mode A traces, not a missing-instrumentation bug."
            : "Echo Cancellation Time is empty whenever AEC was disabled for this turn (config.AEC_ENABLED) — an expected null, not an error."
        }
      />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Mic Start" value={fmtMs(perf.mic_start_ms)} icon={<IconMic className="h-5 w-5" />} tintIndex={0} />
        <StatCard label="Mic Stop" value={fmtMs(perf.mic_stop_ms)} icon={<IconMic className="h-5 w-5" />} tintIndex={1} />
        <StatCard label="Voice Duration" value={fmtMs(perf.voice_duration_ms)} icon={<IconClock className="h-5 w-5" />} tintIndex={2} />
        <StatCard label="VAD Time" value={fmtMs(perf.vad_time_ms)} icon={<IconActivity className="h-5 w-5" />} tintIndex={3} />
        <StatCard label="Noise Suppression Time" value={fmtMs(perf.noise_suppression_time_ms)} icon={<IconActivity className="h-5 w-5" />} tintIndex={4} />
        <StatCard label="Echo Cancellation Time" value={fmtMs(perf.echo_cancellation_time_ms)} icon={<IconActivity className="h-5 w-5" />} tintIndex={5} />
        <StatCard label="AGC Time" value={fmtMs(perf.agc_time_ms)} icon={<IconActivity className="h-5 w-5" />} tintIndex={6} />
      </div>

      <SectionHeader title="Waterfall" description="Relative duration of each pipeline component, on a shared timeline — like a browser DevTools network waterfall." />
      <Card>
        <WaterfallChart data={waterfallRows} />
      </Card>

      <SectionHeader title="Timeline" description="Every recorded stage for this turn, in order, with timestamp/duration/status/provider/model/error." />
      <Card>
        {stageRows.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-500">No stages recorded for this trace.</div>
        ) : (
          <StageTimeline rows={stageRows} />
        )}
      </Card>
    </main>
  );
}
