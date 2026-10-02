"use client";

import { useState } from "react";
import {
  createIntentConfig,
  deleteIntentConfig,
  updateIntentConfig,
  type IntentChainEntry,
  type IntentConfigEntry,
} from "@/lib/api";
import { Card, Th, Td } from "@/components/ui";

// Options come from pip-voice-ai-dashboard's own model_registry (Models >
// Model Management, §22) — only status="active" rows, passed down from
// app/config/page.tsx. NOT a hardcoded list anymore: this table drives real
// Mode B voice routing in bpjs-pending-bot-local (via voice_router.py
// reading intent_config as an override on top of voice_routes.yaml), so a
// model string here that doesn't match a real provider model ID makes that
// intent's requests fail outright — model_registry is what now keeps that
// in sync (see model_registry_client.py in that project).
type ModelOption = { model: string; provider: string };

function makeEmptyForm(modelOptions: ModelOption[]) {
  return {
    intent: "",
    chain: modelOptions[0] ? [{ provider: modelOptions[0].provider, model: modelOptions[0].model }] : [],
    priority: 0,
    confidence_threshold: 0.6,
    max_latency_ms: "",
    requires_rules_check: false,
    knowledge_source: "",
  };
}

const inputClass =
  "rounded-lg border border-white/10 bg-slate-800 px-2.5 py-1.5 text-sm text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

// Priority-ordered model chain — index 0 is tried first; on failure/down
// (bpjs-pending-bot-local's provider_health.py cooldown, or a model
// deactivated in Model Management) the router moves to the next tier. Add/
// remove toggles which models are in the chain at all; ↑/↓ reorders
// priority — no separate "fallback" field anymore, any tier count works.
function ChainEditor({
  chain,
  options,
  onChange,
}: {
  chain: IntentChainEntry[];
  options: ModelOption[];
  onChange: (chain: IntentChainEntry[]) => void;
}) {
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= chain.length) return;
    const next = [...chain];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }
  function remove(i: number) {
    onChange(chain.filter((_, idx) => idx !== i));
  }
  function add() {
    if (options.length === 0) return;
    onChange([...chain, { provider: options[0].provider, model: options[0].model }]);
  }
  function updateEntry(i: number, modelStr: string) {
    const opt = options.find((o) => o.model === modelStr) ?? options[0];
    const next = [...chain];
    next[i] = { provider: opt.provider, model: opt.model };
    onChange(next);
  }

  return (
    <div className="min-w-[16rem] space-y-1">
      {chain.length === 0 && <div className="text-xs text-amber-400">No tiers — this intent can never route.</div>}
      {chain.map((entry, i) => (
        <div key={i} className="flex items-center gap-1">
          <span className="w-4 shrink-0 text-xs text-slate-500">{i + 1}.</span>
          <select value={entry.model} onChange={(e) => updateEntry(i, e.target.value)} className={`${inputClass} min-w-0 flex-1`}>
            {options.map((o) => (
              <option key={o.model} value={o.model}>
                {o.model}
              </option>
            ))}
          </select>
          <button
            type="button"
            title="Move up (higher priority)"
            disabled={i === 0}
            onClick={() => move(i, -1)}
            className="rounded px-1.5 py-1 text-xs text-slate-400 hover:bg-white/[0.06] disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            title="Move down (lower priority)"
            disabled={i === chain.length - 1}
            onClick={() => move(i, 1)}
            className="rounded px-1.5 py-1 text-xs text-slate-400 hover:bg-white/[0.06] disabled:opacity-30"
          >
            ↓
          </button>
          <button
            type="button"
            title="Remove tier"
            onClick={() => remove(i)}
            className="rounded px-1.5 py-1 text-xs text-rose-400 hover:bg-rose-500/10"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={options.length === 0}
        onClick={add}
        className="rounded-lg border border-dashed border-white/10 px-2.5 py-1 text-xs text-slate-400 hover:bg-white/[0.04] disabled:opacity-40"
      >
        + Add tier
      </button>
    </div>
  );
}

function chainsEqual(a: IntentChainEntry[], b: IntentChainEntry[]) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function IntentConfigTable({
  initialConfigs,
  modelOptions,
}: {
  initialConfigs: IntentConfigEntry[];
  modelOptions: ModelOption[];
}) {
  const [configs, setConfigs] = useState(initialConfigs);
  const [form, setForm] = useState(() => makeEmptyForm(modelOptions));
  const [error, setError] = useState<string | null>(null);
  const [savingIntent, setSavingIntent] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<
    Record<
      string,
      {
        priority: number;
        confidence_threshold: number;
        chain: IntentChainEntry[];
        max_latency_ms: string;
        knowledge_source: string;
      }
    >
  >({});

  function draftFor(c: IntentConfigEntry) {
    return (
      drafts[c.intent] ?? {
        priority: c.priority,
        confidence_threshold: c.confidence_threshold,
        chain: c.chain,
        max_latency_ms: c.max_latency_ms?.toString() ?? "",
        knowledge_source: c.knowledge_source ?? "",
      }
    );
  }

  function setDraft(
    intent: string,
    patch: Partial<{
      priority: number;
      confidence_threshold: number;
      chain: IntentChainEntry[];
      max_latency_ms: string;
      knowledge_source: string;
    }>
  ) {
    setDrafts((prev) => {
      const config = configs.find((c) => c.intent === intent)!;
      const base = prev[intent] ?? {
        priority: config.priority,
        confidence_threshold: config.confidence_threshold,
        chain: config.chain,
        max_latency_ms: config.max_latency_ms?.toString() ?? "",
        knowledge_source: config.knowledge_source ?? "",
      };
      return { ...prev, [intent]: { ...base, ...patch } };
    });
  }

  function isDirty(c: IntentConfigEntry) {
    const d = drafts[c.intent];
    if (!d) return false;
    return (
      d.priority !== c.priority ||
      d.confidence_threshold !== c.confidence_threshold ||
      !chainsEqual(d.chain, c.chain) ||
      d.max_latency_ms !== (c.max_latency_ms?.toString() ?? "") ||
      d.knowledge_source !== (c.knowledge_source ?? "")
    );
  }

  async function handleToggleRulesCheck(c: IntentConfigEntry) {
    setError(null);
    setSavingIntent(c.intent);
    try {
      const updated = await updateIntentConfig(c.intent, { requires_rules_check: !c.requires_rules_check });
      setConfigs((prev) => prev.map((x) => (x.intent === c.intent ? updated : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setSavingIntent(null);
    }
  }

  async function handleToggleEnabled(c: IntentConfigEntry) {
    setError(null);
    setSavingIntent(c.intent);
    try {
      const updated = await updateIntentConfig(c.intent, { enabled: !c.enabled });
      setConfigs((prev) => prev.map((x) => (x.intent === c.intent ? updated : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setSavingIntent(null);
    }
  }

  async function handleSaveRow(c: IntentConfigEntry) {
    const d = draftFor(c);
    if (d.chain.length === 0) {
      setError(`${c.intent}: chain must have at least one tier`);
      return;
    }
    setError(null);
    setSavingIntent(c.intent);
    try {
      const maxLatency = d.max_latency_ms.trim() ? Number(d.max_latency_ms) : null;
      if (maxLatency !== null && Number.isNaN(maxLatency)) throw new Error("max_latency_ms harus angka");
      const updated = await updateIntentConfig(c.intent, {
        priority: d.priority,
        confidence_threshold: d.confidence_threshold,
        chain: d.chain,
        max_latency_ms: maxLatency,
        knowledge_source: d.knowledge_source.trim() || null,
      });
      setConfigs((prev) => prev.map((x) => (x.intent === c.intent ? updated : x)));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[c.intent];
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setSavingIntent(null);
    }
  }

  async function handleDelete(intent: string) {
    setError(null);
    setSavingIntent(intent);
    try {
      await deleteIntentConfig(intent);
      setConfigs((prev) => prev.filter((x) => x.intent !== intent));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setSavingIntent(null);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.intent.trim()) {
      setError("Intent name is required");
      return;
    }
    if (form.chain.length === 0) {
      setError("Chain must have at least one tier");
      return;
    }
    setError(null);
    try {
      const maxLatency = form.max_latency_ms.trim() ? Number(form.max_latency_ms) : null;
      if (maxLatency !== null && Number.isNaN(maxLatency)) throw new Error("max_latency_ms harus angka");
      const created = await createIntentConfig({
        intent: form.intent.trim(),
        chain: form.chain,
        priority: form.priority,
        confidence_threshold: form.confidence_threshold,
        max_latency_ms: maxLatency,
        requires_rules_check: form.requires_rules_check,
        knowledge_source: form.knowledge_source.trim() || null,
      });
      setConfigs((prev) => [...prev, created].sort((a, b) => a.priority - b.priority));
      setForm(makeEmptyForm(modelOptions));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add intent");
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-400">{error}</div>
      )}
      {modelOptions.length === 0 && (
        <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3.5 py-2.5 text-sm text-amber-400">
          No active models in Model Management — activate at least one there before adding an intent route here.
        </div>
      )}

      <Card className="mb-6">
        <h3 className="mb-3 text-sm font-semibold text-white">Add Intent</h3>
        <form onSubmit={handleAdd} className="flex flex-wrap items-start gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500">Intent</label>
            <input
              value={form.intent}
              onChange={(e) => setForm((f) => ({ ...f, intent: e.target.value }))}
              placeholder="e.g. small_talk"
              className={`mt-1 w-40 ${inputClass}`}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Model Chain (priority order)</label>
            <div className="mt-1">
              <ChainEditor chain={form.chain} options={modelOptions} onChange={(chain) => setForm((f) => ({ ...f, chain }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Priority</label>
            <input
              type="number"
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))}
              className={`mt-1 w-20 ${inputClass}`}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Confidence Threshold</label>
            <input
              type="number"
              step="0.05"
              min="0"
              max="1"
              value={form.confidence_threshold}
              onChange={(e) => setForm((f) => ({ ...f, confidence_threshold: Number(e.target.value) }))}
              className={`mt-1 w-24 ${inputClass}`}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Max Latency (ms)</label>
            <input
              type="number"
              value={form.max_latency_ms}
              placeholder="no limit"
              onChange={(e) => setForm((f) => ({ ...f, max_latency_ms: e.target.value }))}
              className={`mt-1 w-28 ${inputClass}`}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Knowledge Source</label>
            <input
              value={form.knowledge_source}
              placeholder="e.g. grounding"
              onChange={(e) => setForm((f) => ({ ...f, knowledge_source: e.target.value }))}
              className={`mt-1 w-32 ${inputClass}`}
            />
          </div>
          <div className="flex items-center gap-2 pt-5">
            <label className="block text-xs font-medium text-slate-500">Rules Check</label>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, requires_rules_check: !f.requires_rules_check }))}
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                form.requires_rules_check ? "bg-amber-500/10 text-amber-400" : "bg-white/[0.06] text-slate-400"
              }`}
            >
              {form.requires_rules_check ? "On" : "Off"}
            </button>
          </div>
          <button
            type="submit"
            disabled={modelOptions.length === 0}
            className="mt-5 rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            Add Intent
          </button>
        </form>
      </Card>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/[0.06]">
            <tr>
              <Th>Intent</Th>
              <Th>Model Chain (priority order)</Th>
              <Th>Enable</Th>
              <Th>Priority</Th>
              <Th>Confidence Threshold</Th>
              <Th>Max Latency (ms)</Th>
              <Th>Knowledge Source</Th>
              <Th>Rules Check</Th>
              <Th>{""}</Th>
            </tr>
          </thead>
          <tbody>
            {configs.map((c) => {
              const d = draftFor(c);
              const dirty = isDirty(c);
              const busy = savingIntent === c.intent;
              return (
                <tr key={c.intent} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] align-top">
                  <Td className="pt-4 font-medium">{c.intent}</Td>
                  <Td>
                    <ChainEditor chain={d.chain} options={modelOptions} onChange={(chain) => setDraft(c.intent, { chain })} />
                  </Td>
                  <Td className="pt-4">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleToggleEnabled(c)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        c.enabled ? "bg-emerald-500/10 text-emerald-400" : "bg-white/[0.06] text-slate-400"
                      }`}
                    >
                      {c.enabled ? "Enabled" : "Disabled"}
                    </button>
                  </Td>
                  <Td className="pt-4">
                    <input
                      type="number"
                      value={d.priority}
                      onChange={(e) => setDraft(c.intent, { priority: Number(e.target.value) })}
                      className={`w-16 ${inputClass}`}
                    />
                  </Td>
                  <Td className="pt-4">
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="1"
                      value={d.confidence_threshold}
                      onChange={(e) => setDraft(c.intent, { confidence_threshold: Number(e.target.value) })}
                      className={`w-20 ${inputClass}`}
                    />
                  </Td>
                  <Td className="pt-4">
                    <input
                      type="number"
                      value={d.max_latency_ms}
                      placeholder="no limit"
                      onChange={(e) => setDraft(c.intent, { max_latency_ms: e.target.value })}
                      className={`w-24 ${inputClass}`}
                    />
                  </Td>
                  <Td className="pt-4">
                    <input
                      value={d.knowledge_source}
                      placeholder="e.g. grounding"
                      onChange={(e) => setDraft(c.intent, { knowledge_source: e.target.value })}
                      className={`w-32 ${inputClass}`}
                    />
                  </Td>
                  <Td className="pt-4">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleToggleRulesCheck(c)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        c.requires_rules_check ? "bg-amber-500/10 text-amber-400" : "bg-white/[0.06] text-slate-400"
                      }`}
                    >
                      {c.requires_rules_check ? "On" : "Off"}
                    </button>
                  </Td>
                  <Td className="pt-4">
                    <div className="flex gap-2">
                      {dirty && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleSaveRow(c)}
                          className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700"
                        >
                          Save
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleDelete(c.intent)}
                        className="rounded-lg px-3 py-1 text-xs font-medium text-rose-400 hover:bg-rose-500/10"
                      >
                        Delete
                      </button>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
