// Feature-local formatters — matches this codebase's established pattern
// of a small formatting helper per top-level page rather than one shared
// module (see voice-analytics/page.tsx's own fmtMs/fmtPct/fmtNum).

export function fmtMs(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value).toLocaleString()} ms`;
}

export function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Asia/Jakarta", hour12: false });
}

const STAGE_LABELS: Record<string, string> = {
  user_speech_start: "User Starts Speaking",
  turn_start: "User Starts Speaking",
  vad: "Voice Activity Detection",
  asr_start: "Speech Recognition Start",
  asr_final: "Speech Recognition Final",
  eou_detection: "End Of Utterance Detection",
  task_classification: "Task Classification",
  ai_router_decision: "AI Router",
  request_sent: "Request Sent",
  first_token: "First Token Received",
  llm_complete: "LLM Complete",
  reply_ready: "Reply Ready (First Token + Audio)",
  tts_start: "TTS Start",
  first_audio: "First Audio",
  playback_finished: "Playback Finished",
  relay: "Relay",
};

// Not a hardcoded authority — `sequence` from the backend decides render
// order. This is only cosmetic labeling, and falls back to a title-cased
// render of the raw stage key for anything unrecognized (never hard-fails
// on a stage name this frontend doesn't know about yet).
export function stageLabel(stage: string): string {
  if (STAGE_LABELS[stage]) return STAGE_LABELS[stage];
  return stage
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function statusTone(status: string): "positive" | "negative" | "neutral" {
  if (status === "error") return "negative";
  if (status === "ok") return "positive";
  return "neutral";
}

// Recharts `fill` needs a literal color, not a Tailwind class — these are
// the hex equivalents of Pill's tone palette (components/ui.tsx) so the
// waterfall chart's bar colors stay consistent with the rest of the app's
// status-color vocabulary instead of inventing a new one.
export function statusColor(status: "ok" | "error" | "skipped" | "no-data"): string {
  switch (status) {
    case "ok":
      return "#34d399"; // emerald-400, matches Pill tone="positive"
    case "error":
      return "#fb7185"; // rose-400, matches Pill tone="negative"
    case "skipped":
      return "#94a3b8"; // slate-400, matches Pill tone="neutral"
    case "no-data":
      return "#334155"; // slate-700, dimmer than skipped — deliberately absent, not just neutral
  }
}
