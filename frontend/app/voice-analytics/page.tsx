import {
  getVoiceOverview,
  getVoiceUsage,
  getVoiceInteraction,
  getSpeechAnalytics,
  getSTTAnalytics,
  getTTSAnalytics,
  getVoiceAIResponse,
  getVoiceIntents,
  getVoiceCategories,
  getVoiceTopics,
  getVoiceKnowledge,
  getVoiceModels,
  getVoicePerformance,
  getVoiceErrors,
  getConversationQuality,
} from "@/lib/api";
import { PageHeader, SectionHeader, StatCard, Card, TableCard, Td, Th, Pill } from "@/components/ui";
import { IconMic, IconActivity, IconUsers, IconGrid, IconCpu, IconAlertTriangle } from "@/components/icons";

function fmtMs(v: number | null): string {
  if (v === null || v === undefined) return "—";
  if (v >= 1000) return `${(v / 1000).toFixed(1)}s`;
  return `${Math.round(v)}ms`;
}

function fmtPct(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function fmtNum(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function BreakdownTable({ rows, labelHeader }: { rows: { label: string; requests: number }[]; labelHeader: string }) {
  if (rows.length === 0) {
    return <p className="px-1 text-sm text-slate-500">Belum ada data.</p>;
  }
  return (
    <TableCard>
      <table className="w-full text-left text-sm">
        <thead className="border-b border-white/[0.06]">
          <tr>
            <Th>{labelHeader}</Th>
            <Th right>Requests</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
              <Td className="font-medium capitalize">{r.label}</Td>
              <Td right>{r.requests.toLocaleString()}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableCard>
  );
}

function RecordBreakdown({ record, labelHeader }: { record: Record<string, number>; labelHeader: string }) {
  const rows = Object.entries(record)
    .map(([label, requests]) => ({ label, requests }))
    .sort((a, b) => b.requests - a.requests);
  return <BreakdownTable rows={rows} labelHeader={labelHeader} />;
}

export default async function VoiceAnalyticsPage() {
  const [
    overview, usage, interaction, speech, stt, tts, aiResponse,
    intents, categories, topics, knowledge, models, performance, errors, quality,
  ] = await Promise.all([
    getVoiceOverview(), getVoiceUsage(), getVoiceInteraction(), getSpeechAnalytics(),
    getSTTAnalytics(), getTTSAnalytics(), getVoiceAIResponse(), getVoiceIntents(),
    getVoiceCategories(), getVoiceTopics(), getVoiceKnowledge(), getVoiceModels(),
    getVoicePerformance(), getVoiceErrors(), getConversationQuality(),
  ]);

  return (
    <main className="max-w-7xl p-8">
      <PageHeader
        title="Voice Analytics"
        description="Voice AI usage, performance, speech quality, and conversation behavior across Mode A (Gemini Live) and Mode B (cascaded pipeline) — filtered to channel='voice' only."
      />

      {/* §A Overview */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Voice Sessions" value={overview.total_voice_sessions.toLocaleString()} icon={<IconMic className="h-5 w-5" />} tintIndex={0} />
        <StatCard label="Active Voice Users" value={overview.active_voice_users.toLocaleString()} icon={<IconUsers className="h-5 w-5" />} tintIndex={1} />
        <StatCard label="Voice Requests" value={overview.total_voice_requests.toLocaleString()} icon={<IconGrid className="h-5 w-5" />} tintIndex={2} />
        <StatCard label="Voice Adoption Rate" value={fmtPct(overview.voice_adoption_rate)} icon={<IconActivity className="h-5 w-5" />} tintIndex={3} />
        <StatCard label="Avg Session Duration" value={fmtMs(overview.average_session_duration_ms)} tintIndex={4} />
        <StatCard label="Avg Conversation Turns" value={fmtNum(overview.average_conversation_turns)} tintIndex={5} />
        <StatCard label="Avg Response Time" value={fmtMs(overview.average_response_time_ms)} tintIndex={6} />
        <StatCard label="Avg Time to First Audio" value={fmtMs(overview.average_time_to_first_audio_ms)} tintIndex={7} />
      </div>

      {/* §B Usage */}
      <SectionHeader title="Voice Usage" description="§B — session/message volume, peaks, daily trend." />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Voice Messages" value={usage.voice_messages.toLocaleString()} tintIndex={0} />
        <StatCard label="Avg Voice Duration" value={fmtMs(usage.average_voice_duration_ms)} tintIndex={1} />
        <StatCard label="Longest Session" value={fmtMs(usage.longest_voice_session_ms)} tintIndex={2} />
        <StatCard label="Voice / User" value={fmtNum(usage.voice_per_user)} tintIndex={3} />
        <StatCard label="Peak Usage Hour" value={usage.peak_usage_hour !== null ? `${usage.peak_usage_hour}:00` : "—"} tintIndex={4} />
        <StatCard label="Peak Usage Day" value={usage.peak_usage_day ?? "—"} tintIndex={5} />
      </div>
      {usage.daily_trend.length > 0 && (
        <div className="mt-4">
          <BreakdownTable rows={usage.daily_trend.map((p) => ({ label: p.bucket, requests: p.requests }))} labelHeader="Day" />
        </div>
      )}

      {/* §C Interaction */}
      <SectionHeader
        title="Voice Interaction"
        description="§C — control commands and turn-taking behavior. Push To Talk isn't tracked here (session-level setting, lives in bpjs-pending-bot-local's own DB, not per-turn in this one)."
      />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Wake Word" value={interaction.wake_word_count.toLocaleString()} tintIndex={0} />
        <StatCard label="Continue Conversation" value={interaction.continue_conversation_count.toLocaleString()} tintIndex={1} />
        <StatCard label="Interrupt" value={interaction.interrupt_count.toLocaleString()} tintIndex={2} />
        <StatCard label="Retry" value={interaction.retry_count.toLocaleString()} tintIndex={3} />
        <StatCard label="Cancel" value={interaction.cancel_count.toLocaleString()} tintIndex={4} />
        <StatCard label="Manual Stop" value={interaction.manual_stop_count.toLocaleString()} tintIndex={5} />
        <StatCard label="Silence Timeout" value={interaction.silence_timeout_count.toLocaleString()} tintIndex={6} />
      </div>

      {/* §D Speech */}
      <SectionHeader title="Speech Analytics" description="§D — user audio characteristics. Noise Level is an RMS proxy, not calibrated dB SPL." />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Avg Speech Duration" value={fmtMs(speech.average_speech_duration_ms)} tintIndex={0} />
        <StatCard label="Longest Speech" value={fmtMs(speech.longest_speech_ms)} tintIndex={1} />
        <StatCard label="Avg Words" value={fmtNum(speech.average_words)} tintIndex={2} />
        <StatCard label="Speaking Speed" value={speech.average_speaking_speed_wpm !== null ? `${fmtNum(speech.average_speaking_speed_wpm)} wpm` : "—"} tintIndex={3} />
        <StatCard label="Avg Silence" value={fmtMs(speech.average_silence_ms)} tintIndex={4} />
        <StatCard label="Avg Noise Level" value={fmtNum(speech.average_noise_level)} tintIndex={5} />
        <StatCard label="Speech Confidence" value={fmtPct(speech.average_speech_confidence)} tintIndex={6} />
      </div>

      {/* §E STT */}
      <SectionHeader
        title="STT Analytics"
        description="§E — speech-to-text quality. Success/failure here is a proxy (any transcribed text = success) since STT-stage failure isn't tracked separately from overall turn failure."
      />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="STT Requests" value={stt.stt_requests.toLocaleString()} tintIndex={0} />
        <StatCard label="Success Rate" value={fmtPct(stt.stt_success_rate)} tintIndex={1} />
        <StatCard label="Failure Rate" value={fmtPct(stt.stt_failure_rate)} tintIndex={2} />
        <StatCard label="Avg STT Latency" value={fmtMs(stt.average_stt_latency_ms)} tintIndex={3} />
        <StatCard label="Recognition Confidence" value={fmtPct(stt.average_recognition_confidence)} tintIndex={4} />
      </div>
      <div className="mt-4">
        <RecordBreakdown record={stt.language_breakdown} labelHeader="Language" />
      </div>

      {/* §F TTS */}
      <SectionHeader title="TTS Analytics" description="§F — text-to-speech generation and playback." />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="TTS Requests" value={tts.tts_requests.toLocaleString()} tintIndex={0} />
        <StatCard label="Avg TTS Latency" value={fmtMs(tts.average_tts_latency_ms)} tintIndex={1} />
        <StatCard label="Avg Playback Duration" value={fmtMs(tts.average_playback_duration_ms)} tintIndex={2} />
        <StatCard label="Playback Interrupted" value={tts.playback_interrupted_count.toLocaleString()} tintIndex={3} />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RecordBreakdown record={tts.voice_provider_breakdown} labelHeader="Voice Provider" />
        <RecordBreakdown record={tts.voice_used_breakdown} labelHeader="Voice Used" />
      </div>

      {/* §G AI Response */}
      <SectionHeader title="AI Response Analytics" description="§G — routing/model performance for voice requests." />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Time to First Token" value={fmtMs(aiResponse.average_time_to_first_token_ms)} tintIndex={0} />
        <StatCard label="Time to First Audio" value={fmtMs(aiResponse.average_time_to_first_audio_ms)} tintIndex={1} />
        <StatCard label="Full Response Time" value={fmtMs(aiResponse.average_full_response_time_ms)} tintIndex={2} />
        <StatCard label="Tokens Generated" value={aiResponse.total_tokens_generated.toLocaleString()} tintIndex={3} />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <BreakdownTable rows={aiResponse.model_breakdown.map((m) => ({ label: m.model_used, requests: m.requests }))} labelHeader="Model" />
        <BreakdownTable rows={aiResponse.provider_breakdown.map((m) => ({ label: m.model_used, requests: m.requests }))} labelHeader="Provider" />
        <BreakdownTable rows={aiResponse.knowledge_source_breakdown.map((m) => ({ label: m.model_used, requests: m.requests }))} labelHeader="Knowledge Source" />
      </div>

      {/* §H/I Intent & Category */}
      <SectionHeader title="Intent & Category (Voice)" description="§H/I — AI-router intent/task breakdown, voice-only." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BreakdownTable rows={intents} labelHeader="Intent" />
        <BreakdownTable rows={categories} labelHeader="Category" />
      </div>

      {/* §J Topics */}
      <SectionHeader title="Topic Analytics (Voice)" description="§J — auto-detected subjects discussed by voice. Trending uses the same ranking as Top (no historical snapshot to diff a real growth rate against yet)." />
      <TableCard>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/[0.06]">
            <tr>
              <Th>Topic</Th>
              <Th>Category</Th>
              <Th right>Requests</Th>
            </tr>
          </thead>
          <tbody>
            {topics.top_topics.length === 0 ? (
              <tr><Td colSpan={3} muted>Belum ada data.</Td></tr>
            ) : (
              topics.top_topics.map((t) => (
                <tr key={t.topic} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                  <Td className="font-medium">{t.topic}</Td>
                  <Td muted>{t.category ? <Pill tone="neutral">{t.category}</Pill> : "—"}</Td>
                  <Td right>{t.requests.toLocaleString()}</Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableCard>
      {topics.new_topics.length > 0 && (
        <Card className="mt-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">New topics (last 7 days)</div>
          <div className="flex flex-wrap gap-1.5">
            {topics.new_topics.map((t) => (
              <Pill key={t.topic} tone="info">{t.topic}</Pill>
            ))}
          </div>
        </Card>
      )}

      {/* §K Knowledge */}
      <SectionHeader title="Knowledge Analytics (Voice)" description="§K — where voice AI answers came from." />
      <BreakdownTable rows={knowledge} labelHeader="Source" />

      {/* §L Model */}
      <SectionHeader title="Model Analytics (Voice)" description="§L — model usage and latency for voice requests." />
      <TableCard>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/[0.06]">
            <tr>
              <Th>Model</Th>
              <Th right>Requests</Th>
              <Th right>Avg Latency</Th>
            </tr>
          </thead>
          <tbody>
            {models.length === 0 ? (
              <tr><Td colSpan={3} muted>Belum ada data.</Td></tr>
            ) : (
              models.map((m) => (
                <tr key={m.model_used} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                  <Td className="font-medium">{m.model_used}</Td>
                  <Td right>{m.requests.toLocaleString()}</Td>
                  <Td right>{fmtMs(m.average_latency_ms)}</Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableCard>

      {/* §M Performance */}
      <SectionHeader title="Performance Analytics" description="§M — latency + host resource usage (bpjs-pending-bot-local process, sampled ~every 5 minutes)." />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Avg Latency" value={fmtMs(performance.average_latency_ms)} tintIndex={0} />
        <StatCard label="Avg First Audio" value={fmtMs(performance.average_first_audio_ms)} tintIndex={1} />
        <StatCard label="End-to-End Latency" value={fmtMs(performance.average_end_to_end_latency_ms)} tintIndex={2} />
        <StatCard label="CPU Usage" value={performance.cpu_usage_percent !== null ? `${performance.cpu_usage_percent.toFixed(0)}%` : "—"} icon={<IconCpu className="h-5 w-5" />} tintIndex={3} />
        <StatCard label="Memory Usage" value={performance.memory_usage_percent !== null ? `${performance.memory_usage_percent.toFixed(0)}%` : "—"} tintIndex={4} />
        <StatCard label="GPU Usage" value={performance.gpu_usage_percent ?? "—"} valueClassName="text-sm text-slate-500" tintIndex={5} />
      </div>

      {/* §N Errors */}
      <SectionHeader title="Error Analytics" description="§N — failures and recovery behavior. error_type isn't broken out per-stage (STT/TTS/decode/network) today, so the breakdown reflects whatever granularity is actually reported." />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Requests" value={errors.total_requests.toLocaleString()} tintIndex={0} />
        <StatCard label="Errors" value={errors.error_count.toLocaleString()} icon={<IconAlertTriangle className="h-5 w-5" />} tintIndex={1} />
        <StatCard label="Timeouts" value={errors.timeout_count.toLocaleString()} tintIndex={2} />
        <StatCard label="Retry Rate" value={fmtPct(errors.retry_rate)} tintIndex={3} />
        <StatCard label="Interrupt Rate" value={fmtPct(errors.interrupt_rate)} tintIndex={4} />
        <StatCard label="Cancel Rate" value={fmtPct(errors.cancel_rate)} tintIndex={5} />
      </div>
      {errors.error_breakdown.length > 0 && (
        <div className="mt-4">
          <BreakdownTable rows={errors.error_breakdown} labelHeader="Error Type" />
        </div>
      )}

      {/* §O Conversation Quality */}
      <SectionHeader title="Conversation Quality" description="§O — clarification rate isn't included: nothing today detects/reports 'the assistant asked a clarifying question' as a distinct event." />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Completion Rate" value={fmtPct(quality.conversation_completion_rate)} tintIndex={0} />
        <StatCard label="Barge-in Rate" value={fmtPct(quality.barge_in_rate)} tintIndex={1} />
        <StatCard label="Repeat Rate" value={fmtPct(quality.repeat_rate)} tintIndex={2} />
        <StatCard label="Escalation Rate" value={fmtPct(quality.escalation_rate)} tintIndex={3} />
        <StatCard label="👍 Positive Feedback" value={quality.positive_feedback_count.toLocaleString()} tintIndex={4} />
        <StatCard label="👎 Negative Feedback" value={quality.negative_feedback_count.toLocaleString()} tintIndex={5} />
        <StatCard label="Avg Conversation Turns" value={fmtNum(quality.average_conversation_turns)} tintIndex={6} />
      </div>
    </main>
  );
}
