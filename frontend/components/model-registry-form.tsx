"use client";

import { useState } from "react";
import {
  createModelRegistryEntry,
  testModelConnection,
  validateModelConfig,
  type ModelProvider,
  type ModelRegistryEntry,
  type ProbeResult,
} from "@/lib/api";
import { Card } from "@/components/ui";

const PROVIDERS: { value: ModelProvider; label: string }[] = [
  { value: "lmstudio", label: "LM Studio" },
  { value: "ollama", label: "Ollama" },
  { value: "gemini", label: "Gemini" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "azure_openai", label: "Azure OpenAI" },
  { value: "custom_openai_compatible", label: "Custom OpenAI Compatible API" },
];

const EMPTY_FORM = {
  model_name: "",
  display_name: "",
  provider: "lmstudio" as ModelProvider,
  api_base_url: "",
  api_key: "",
  model_identifier: "",
  version: "",
  context_window: "",
  max_output_tokens: "",
  timeout_ms: "",
  supports_streaming: false,
  supports_vision: false,
  supports_function_calling: false,
  supports_json_mode: false,
  supports_embedding: false,
};

const inputClass =
  "mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-2.5 py-1.5 text-sm text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors ${
        checked ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-300" : "border-white/10 bg-slate-800 text-slate-400"
      }`}
    >
      <span>{label}</span>
      <span className={`text-xs font-medium ${checked ? "text-indigo-400" : "text-slate-500"}`}>{checked ? "On" : "Off"}</span>
    </button>
  );
}

function ProbeBanner({ result }: { result: ProbeResult | null }) {
  if (!result) return null;
  return (
    <div
      className={`rounded-lg border px-3 py-2 text-sm ${
        result.ok ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : "border-rose-500/20 bg-rose-500/10 text-rose-400"
      }`}
    >
      {result.message} — {result.latency_ms.toFixed(0)} ms{result.status_code ? ` (HTTP ${result.status_code})` : ""}
    </div>
  );
}

export function ModelRegistryForm({ onCreated }: { onCreated: (model: ModelRegistryEntry) => void }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"connection" | "validate" | "save" | "save-activate" | null>(null);
  const [connectionResult, setConnectionResult] = useState<ProbeResult | null>(null);
  const [validateResult, setValidateResult] = useState<ProbeResult | null>(null);

  function update<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleTestConnection() {
    if (!form.api_base_url.trim()) {
      setError("API Base URL is required to test the connection");
      return;
    }
    setError(null);
    setBusy("connection");
    try {
      setConnectionResult(await testModelConnection(form.api_base_url.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to test connection");
    } finally {
      setBusy(null);
    }
  }

  async function handleValidate() {
    if (!form.api_base_url.trim() || !form.model_identifier.trim()) {
      setError("API Base URL and Model Identifier are required to validate");
      return;
    }
    setError(null);
    setBusy("validate");
    try {
      setValidateResult(
        await validateModelConfig({
          provider: form.provider,
          api_base_url: form.api_base_url.trim(),
          api_key: form.api_key.trim() || null,
          model_identifier: form.model_identifier.trim(),
        })
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to validate model");
    } finally {
      setBusy(null);
    }
  }

  async function handleSave(activate: boolean) {
    if (!form.model_name.trim() || !form.display_name.trim() || !form.api_base_url.trim() || !form.model_identifier.trim()) {
      setError("Model Name, Display Name, API Base URL, and Model Identifier are required");
      return;
    }
    setError(null);
    setBusy(activate ? "save-activate" : "save");
    try {
      const created = await createModelRegistryEntry({
        model_name: form.model_name.trim(),
        display_name: form.display_name.trim(),
        provider: form.provider,
        api_base_url: form.api_base_url.trim(),
        api_key: form.api_key.trim() || null,
        model_identifier: form.model_identifier.trim(),
        version: form.version.trim() || null,
        context_window: form.context_window.trim() ? Number(form.context_window) : null,
        max_output_tokens: form.max_output_tokens.trim() ? Number(form.max_output_tokens) : null,
        timeout_ms: form.timeout_ms.trim() ? Number(form.timeout_ms) : null,
        supports_streaming: form.supports_streaming,
        supports_vision: form.supports_vision,
        supports_function_calling: form.supports_function_calling,
        supports_json_mode: form.supports_json_mode,
        supports_embedding: form.supports_embedding,
        activate,
      });
      onCreated(created);
      setForm(EMPTY_FORM);
      setConnectionResult(null);
      setValidateResult(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save model");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="mb-6">
      <h3 className="mb-4 text-sm font-semibold text-white">Add New Model</h3>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-400">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="block text-xs font-medium text-slate-500">Model Name</label>
          <input
            value={form.model_name}
            onChange={(e) => update("model_name", e.target.value)}
            placeholder="e.g. gemma-4-e4b-lmstudio"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Display Name</label>
          <input
            value={form.display_name}
            onChange={(e) => update("display_name", e.target.value)}
            placeholder="e.g. Gemma-4-E4B"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Provider</label>
          <select value={form.provider} onChange={(e) => update("provider", e.target.value as ModelProvider)} className={inputClass}>
            {PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">API Base URL</label>
          <input
            value={form.api_base_url}
            onChange={(e) => update("api_base_url", e.target.value)}
            placeholder="https://api.example.com/v1"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">API Key (Encrypted)</label>
          <input
            type="password"
            value={form.api_key}
            onChange={(e) => update("api_key", e.target.value)}
            placeholder="stored encrypted at rest"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Model Identifier</label>
          <input
            value={form.model_identifier}
            onChange={(e) => update("model_identifier", e.target.value)}
            placeholder="e.g. google/gemma-4-e4b"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Version</label>
          <input value={form.version} onChange={(e) => update("version", e.target.value)} placeholder="e.g. v4" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Context Window</label>
          <input
            type="number"
            value={form.context_window}
            onChange={(e) => update("context_window", e.target.value)}
            placeholder="e.g. 128000"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Max Output Tokens</label>
          <input
            type="number"
            value={form.max_output_tokens}
            onChange={(e) => update("max_output_tokens", e.target.value)}
            placeholder="e.g. 4096"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Timeout (ms)</label>
          <input
            type="number"
            value={form.timeout_ms}
            onChange={(e) => update("timeout_ms", e.target.value)}
            placeholder="e.g. 30000"
            className={inputClass}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Toggle label="Streaming" checked={form.supports_streaming} onChange={(v) => update("supports_streaming", v)} />
        <Toggle label="Vision" checked={form.supports_vision} onChange={(v) => update("supports_vision", v)} />
        <Toggle label="Function Calling" checked={form.supports_function_calling} onChange={(v) => update("supports_function_calling", v)} />
        <Toggle label="JSON Mode" checked={form.supports_json_mode} onChange={(v) => update("supports_json_mode", v)} />
        <Toggle label="Embedding" checked={form.supports_embedding} onChange={(v) => update("supports_embedding", v)} />
      </div>

      {(connectionResult || validateResult) && (
        <div className="mt-4 space-y-2">
          <ProbeBanner result={connectionResult} />
          <ProbeBanner result={validateResult} />
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={handleTestConnection}
          className="rounded-lg border border-white/10 px-4 py-1.5 text-sm font-medium text-slate-300 hover:bg-white/[0.04] disabled:opacity-50"
        >
          {busy === "connection" ? "Testing…" : "Test Connection"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={handleValidate}
          className="rounded-lg border border-white/10 px-4 py-1.5 text-sm font-medium text-slate-300 hover:bg-white/[0.04] disabled:opacity-50"
        >
          {busy === "validate" ? "Validating…" : "Validate Model"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => handleSave(false)}
          className="rounded-lg bg-white/[0.06] px-4 py-1.5 text-sm font-medium text-slate-100 hover:bg-white/[0.1] disabled:opacity-50"
        >
          {busy === "save" ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => handleSave(true)}
          className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy === "save-activate" ? "Saving…" : "Save & Activate"}
        </button>
      </div>
    </Card>
  );
}
