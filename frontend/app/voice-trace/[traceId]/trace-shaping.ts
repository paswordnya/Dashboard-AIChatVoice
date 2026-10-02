// Pure data-shaping shared by the server-rendered vertical timeline
// (page.tsx) and the client-rendered waterfall chart (waterfall.tsx) — one
// T0/offset definition, computed once, so the two visuals of the same
// trace can't silently disagree with each other.

import type { TracePerformance, TraceSpan, VoiceTraceDetail } from "@/lib/api";
import { stageLabel } from "../format";

export interface StageRow {
  spanId: string;
  stage: string;
  label: string;
  offsetMs: number | null;
  startedAt: string;
  durationMs: number | null;
  status: "ok" | "error" | "skipped";
  provider: string | null;
  model: string | null;
  error: string | null;
}

export function traceStartMs(spans: TraceSpan[]): number | null {
  if (spans.length === 0) return null;
  return Math.min(...spans.map((s) => new Date(s.timestamp).getTime()));
}

// Which LLM-category span actually pins the model for this turn — checked
// in this order since not every trace reaches llm_complete (e.g. an error
// mid-turn), but an earlier stage in the same request still recorded it.
const MODEL_BEARING_STAGES = ["llm_complete", "reply_ready", "request_sent", "first_token"];

export interface PrimaryModel {
  provider: string;
  model: string;
}

export function findPrimaryModel(spans: TraceSpan[]): PrimaryModel | null {
  for (const stage of MODEL_BEARING_STAGES) {
    const span = spans.find((s) => s.stage === stage && s.provider && s.model);
    if (span) return { provider: span.provider!, model: span.model! };
  }
  return null;
}

export function buildStageRows(detail: VoiceTraceDetail): StageRow[] {
  const startMs = traceStartMs(detail.spans);
  return [...detail.spans]
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
    .map((s) => ({
      spanId: s.span_id,
      stage: s.stage,
      label: stageLabel(s.stage),
      offsetMs: startMs === null ? null : new Date(s.timestamp).getTime() - startMs,
      startedAt: s.timestamp,
      durationMs: s.duration_ms,
      status: s.status,
      provider: s.provider,
      model: s.model,
      error: s.error,
    }));
}

export interface WaterfallSpanRef {
  stage: string;
  label: string;
  startMs: number;
  durationMs: number | null;
  status: string;
  provider: string | null;
  model: string | null;
  error: string | null;
}

export interface WaterfallRow {
  category: string;
  offsetMs: number;
  durationMs: number;
  status: "ok" | "error" | "skipped" | "no-data";
  spans: WaterfallSpanRef[];
}

// Multi-stage categories span the union of their constituent spans' time
// ranges — e.g. "Speech Recognition" covers both asr_start and asr_final.
const CATEGORY_STAGES: Record<string, string[]> = {
  VAD: ["vad"],
  "Speech Recognition": ["asr_start", "asr_final"],
  "Turn Manager": ["eou_detection", "task_classification"],
  "AI Router": ["ai_router_decision"],
  LLM: ["request_sent", "first_token", "llm_complete", "reply_ready"],
  TTS: ["tts_start"],
  Playback: ["first_audio", "playback_finished", "relay"],
};
const CATEGORY_ORDER = ["Mic", "VAD", "Speech Recognition", "Turn Manager", "AI Router", "LLM", "TTS", "Playback"];

function worstStatus(statuses: string[]): "ok" | "error" | "skipped" {
  if (statuses.includes("error")) return "error";
  if (statuses.includes("skipped")) return "skipped";
  return "ok";
}

export function buildWaterfallRows(detail: VoiceTraceDetail): WaterfallRow[] {
  const startMs = traceStartMs(detail.spans);

  return CATEGORY_ORDER.map((category) => {
    if (category === "Mic") {
      return micRow(detail.performance);
    }

    const stages = CATEGORY_STAGES[category] ?? [];
    const matched = detail.spans.filter((s) => stages.includes(s.stage));
    if (matched.length === 0 || startMs === null) {
      return { category, offsetMs: 0, durationMs: 0, status: "no-data" as const, spans: [] };
    }

    const starts = matched.map((s) => new Date(s.timestamp).getTime() - startMs);
    const ends = matched.map((s) => new Date(s.timestamp).getTime() - startMs + (s.duration_ms ?? 0));
    const offsetMs = Math.min(...starts);
    const endMs = Math.max(...ends);

    return {
      category,
      offsetMs,
      durationMs: Math.max(0, endMs - offsetMs),
      status: worstStatus(matched.map((s) => s.status)),
      spans: matched.map((s) => ({
        stage: s.stage, label: stageLabel(s.stage), startMs: new Date(s.timestamp).getTime() - startMs,
        durationMs: s.duration_ms, status: s.status, provider: s.provider, model: s.model, error: s.error,
      })),
    };
  });
}

function micRow(performance: TracePerformance): WaterfallRow {
  if (performance.mic_start_ms === null || performance.mic_stop_ms === null) {
    return { category: "Mic", offsetMs: 0, durationMs: 0, status: "no-data", spans: [] };
  }
  return {
    category: "Mic",
    offsetMs: performance.mic_start_ms,
    durationMs: Math.max(0, performance.mic_stop_ms - performance.mic_start_ms),
    status: "ok",
    spans: [
      {
        stage: "mic_start", label: "Mic", startMs: performance.mic_start_ms,
        durationMs: performance.mic_stop_ms - performance.mic_start_ms,
        status: "ok", provider: null, model: null, error: null,
      },
    ],
  };
}
