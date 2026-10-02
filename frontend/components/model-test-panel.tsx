"use client";

import { useState } from "react";
import { testModelPrompt, type ModelRegistryEntry, type TestPromptResult } from "@/lib/api";
import { Card, Pill } from "@/components/ui";

const inputClass =
  "mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-2.5 py-1.5 text-sm text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

export function ModelTestPanel({ models }: { models: ModelRegistryEntry[] }) {
  const [modelName, setModelName] = useState(models[0]?.model_name ?? "");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TestPromptResult | null>(null);

  async function handleRun() {
    if (!modelName || !prompt.trim()) {
      setError("Pick a model and enter a prompt");
      return;
    }
    setError(null);
    setBusy(true);
    setResult(null);
    try {
      setResult(await testModelPrompt(modelName, prompt.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to run test prompt");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h3 className="mb-1 text-sm font-semibold text-white">Test Model</h3>
      <p className="mb-4 text-xs text-slate-500">§15 — send a real prompt to a registered model: Response, Latency, Token, Cost, Health Status.</p>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-400">{error}</div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="w-full sm:w-56">
          <label className="block text-xs font-medium text-slate-500">Model</label>
          <select value={modelName} onChange={(e) => setModelName(e.target.value)} className={inputClass}>
            {models.length === 0 && <option value="">No registered models</option>}
            {models.map((m) => (
              <option key={m.model_name} value={m.model_name}>
                {m.display_name} {m.status !== "active" ? `(${m.status})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-500">Prompt</label>
          <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. Say hello in one sentence" className={inputClass} />
        </div>
        <button
          type="button"
          disabled={busy || models.length === 0}
          onClick={handleRun}
          className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy ? "Running…" : "Run"}
        </button>
      </div>

      {result && (
        <div className="mt-5 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={result.health_status === "ok" ? "positive" : "negative"}>{result.health_status === "ok" ? "Healthy" : "Error"}</Pill>
            <Pill tone="neutral">{result.latency_ms.toFixed(0)} ms</Pill>
            <Pill tone="neutral">
              {result.input_tokens !== null && result.output_tokens !== null
                ? `${result.input_tokens} in / ${result.output_tokens} out tokens`
                : "tokens unknown"}
            </Pill>
            <Pill tone="neutral">{result.cost_usd !== null ? `$${result.cost_usd.toFixed(4)}` : "cost unknown"}</Pill>
          </div>
          {result.ok ? (
            <div className="rounded-lg border border-white/10 bg-slate-800 p-3 text-sm text-slate-200 whitespace-pre-wrap">
              {result.response_text ?? "(empty response)"}
            </div>
          ) : (
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-400">{result.error}</div>
          )}
        </div>
      )}
    </Card>
  );
}
