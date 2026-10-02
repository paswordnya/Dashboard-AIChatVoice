"use client";

import { Fragment, useState } from "react";
import {
  type BotSetting,
  type BotTemplate,
  type BotRoute,
  type BotProvider,
  type ChainEntry,
  updateBotSetting,
  updateBotTemplate,
  updateBotRoute,
  updateBotProvider,
} from "@/lib/api";

// "lmstudio:qwen/qwen3.6-27b" -> {provider,model}; "gemini" -> "gemini" —
// mirrors dashboard_web.py's _parse_chain_entry/_chain_entry_to_str (same
// comma-separated text-field UI convention as that server-rendered form).
function chainEntryToStr(entry: ChainEntry): string {
  return typeof entry === "string" ? entry : `${entry.provider}:${entry.model ?? ""}`;
}
function parseChainEntry(raw: string): ChainEntry {
  const [provider, ...rest] = raw.split(":");
  const model = rest.join(":").trim();
  return model ? { provider: provider.trim(), model } : provider.trim();
}
import { Card, Th, Td } from "@/components/ui";

const inputClass =
  "rounded-lg border border-white/10 bg-slate-800 px-2.5 py-1.5 text-sm text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

function ErrorBanner({ error }: { error: string | null }) {
  if (!error) return null;
  return <div className="mb-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-400">{error}</div>;
}

function TogglePill({ active, busy, onClick, activeLabel, inactiveLabel }: { active: boolean; busy: boolean; onClick: () => void; activeLabel: string; inactiveLabel: string }) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${active ? "bg-emerald-500/10 text-emerald-400" : "bg-white/[0.06] text-slate-400"}`}
    >
      {active ? activeLabel : inactiveLabel}
    </button>
  );
}

function SaveButton({ onClick, busy }: { onClick: () => void; busy: boolean }) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700"
    >
      Save
    </button>
  );
}

// --- Settings ---------------------------------------------------------

export function SettingsTable({ initialSettings }: { initialSettings: BotSetting[] }) {
  const [settings, setSettings] = useState(initialSettings);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  function baseline(s: BotSetting): string {
    return s.data_type === "json" ? JSON.stringify(s.value, null, 2) : String(s.value);
  }
  function draftFor(s: BotSetting): string {
    return drafts[s.key] ?? baseline(s);
  }
  function isDirty(s: BotSetting): boolean {
    return drafts[s.key] !== undefined && drafts[s.key] !== baseline(s);
  }

  async function handleSave(s: BotSetting) {
    setError(null);
    setBusyKey(s.key);
    try {
      const raw = drafts[s.key];
      let value: unknown = raw;
      if (s.data_type === "int") value = parseInt(raw, 10);
      else if (s.data_type === "float") value = parseFloat(raw);
      else if (s.data_type === "json") value = JSON.parse(raw);
      if (typeof value === "number" && Number.isNaN(value)) throw new Error("Nilai bukan angka yang valid");
      const updated = await updateBotSetting(s.key, value);
      setSettings((prev) => prev.map((x) => (x.key === s.key ? updated : x)));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[s.key];
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save setting");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleToggleBool(s: BotSetting) {
    setError(null);
    setBusyKey(s.key);
    try {
      const updated = await updateBotSetting(s.key, !s.value);
      setSettings((prev) => prev.map((x) => (x.key === s.key ? updated : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save setting");
    } finally {
      setBusyKey(null);
    }
  }

  let lastCategory = "";
  return (
    <div>
      <ErrorBanner error={error} />
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/[0.06]">
            <tr>
              <Th>Key</Th>
              <Th>Label</Th>
              <Th>Value</Th>
              <Th>{""}</Th>
            </tr>
          </thead>
          <tbody>
            {settings.map((s) => {
              const dirty = isDirty(s);
              const busy = busyKey === s.key;
              const showCategory = s.category !== lastCategory;
              lastCategory = s.category;
              return (
                <Fragment key={s.key}>
                  {showCategory && (
                    <tr className="bg-white/[0.03]">
                      <Td colSpan={4} className="!py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {s.category}
                      </Td>
                    </tr>
                  )}
                  <tr className="border-b border-white/[0.04] align-top last:border-0 hover:bg-white/[0.02]">
                    <Td className="font-mono text-xs !text-slate-500">{s.key}</Td>
                    <Td>
                      <div className="font-medium text-white">{s.label}</div>
                      {s.description && <div className="text-xs text-slate-500">{s.description}</div>}
                    </Td>
                    <Td>
                      {s.data_type === "bool" ? (
                        <TogglePill
                          active={Boolean(s.value)}
                          busy={busy}
                          onClick={() => handleToggleBool(s)}
                          activeLabel="true"
                          inactiveLabel="false"
                        />
                      ) : s.data_type === "json" ? (
                        <textarea
                          value={draftFor(s)}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [s.key]: e.target.value }))}
                          rows={3}
                          className={`w-64 font-mono text-xs ${inputClass}`}
                        />
                      ) : (
                        <input
                          type={s.data_type === "int" || s.data_type === "float" ? "number" : "text"}
                          step={s.data_type === "float" ? "0.01" : undefined}
                          value={draftFor(s)}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [s.key]: e.target.value }))}
                          className={`w-40 ${inputClass}`}
                        />
                      )}
                    </Td>
                    <Td>{dirty && s.data_type !== "bool" && <SaveButton busy={busy} onClick={() => handleSave(s)} />}</Td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Prompt templates ---------------------------------------------------

export function TemplatesTable({ initialTemplates }: { initialTemplates: BotTemplate[] }) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  function draftFor(t: BotTemplate) {
    return drafts[t.key] ?? t.content;
  }
  function isDirty(t: BotTemplate) {
    return drafts[t.key] !== undefined && drafts[t.key] !== t.content;
  }

  async function handleSave(t: BotTemplate) {
    setError(null);
    setBusyKey(t.key);
    try {
      const updated = await updateBotTemplate(t.key, { content: drafts[t.key] });
      setTemplates((prev) => prev.map((x) => (x.key === t.key ? updated : x)));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[t.key];
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save template");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleToggle(t: BotTemplate) {
    setError(null);
    setBusyKey(t.key);
    try {
      const updated = await updateBotTemplate(t.key, { is_active: !t.is_active });
      setTemplates((prev) => prev.map((x) => (x.key === t.key ? updated : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to toggle template");
    } finally {
      setBusyKey(null);
    }
  }

  let lastCategory = "";
  return (
    <div>
      <ErrorBanner error={error} />
      <div className="space-y-3">
        {templates.map((t) => {
          const dirty = isDirty(t);
          const busy = busyKey === t.key;
          const showCategory = t.category !== lastCategory;
          lastCategory = t.category;
          return (
            <Fragment key={t.key}>
              {showCategory && (
                <div className="pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t.category}</div>
              )}
              <Card>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-mono text-xs text-slate-500">{t.key}</div>
                    <div className="font-medium text-white">{t.label}</div>
                    {t.description && <div className="text-xs text-slate-500">{t.description}</div>}
                  </div>
                  <div className="shrink-0">
                    <TogglePill
                      active={t.is_active}
                      busy={busy}
                      onClick={() => handleToggle(t)}
                      activeLabel="Active"
                      inactiveLabel="Inactive (hardcoded default)"
                    />
                  </div>
                </div>
                <textarea
                  value={draftFor(t)}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [t.key]: e.target.value }))}
                  rows={4}
                  className={`mt-3 w-full font-mono text-xs ${inputClass}`}
                />
                {dirty && (
                  <div className="mt-2">
                    <SaveButton busy={busy} onClick={() => handleSave(t)} />
                  </div>
                )}
              </Card>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

// --- AI provider routes ---------------------------------------------------

export function RoutesTable({ initialRoutes }: { initialRoutes: BotRoute[] }) {
  const [routes, setRoutes] = useState(initialRoutes);
  const [drafts, setDrafts] = useState<Record<string, { chain: string; latency: string; knowledgeSource: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  function baseline(r: BotRoute) {
    return {
      chain: r.provider_chain.map(chainEntryToStr).join(", "),
      latency: r.target_latency_ms?.toString() ?? "",
      knowledgeSource: r.knowledge_source ?? "",
    };
  }
  function draftFor(r: BotRoute) {
    return drafts[r.task_name] ?? baseline(r);
  }
  function isDirty(r: BotRoute) {
    const d = drafts[r.task_name];
    if (!d) return false;
    const b = baseline(r);
    return d.chain !== b.chain || d.latency !== b.latency || d.knowledgeSource !== b.knowledgeSource;
  }

  async function handleSave(r: BotRoute) {
    const d = draftFor(r);
    setError(null);
    setBusyKey(r.task_name);
    try {
      const chain = d.chain.split(",").map((p) => p.trim()).filter(Boolean).map(parseChainEntry);
      const latency = d.latency.trim() ? Number(d.latency) : null;
      if (latency !== null && Number.isNaN(latency)) throw new Error("target_latency_ms harus angka");
      const updated = await updateBotRoute(
        r.task_name, chain, latency, r.requires_rules_check, d.knowledgeSource.trim() || null
      );
      setRoutes((prev) => prev.map((x) => (x.task_name === r.task_name ? updated : x)));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[r.task_name];
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save route");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleToggleRulesCheck(r: BotRoute) {
    setError(null);
    setBusyKey(r.task_name);
    try {
      const updated = await updateBotRoute(
        r.task_name, r.provider_chain, r.target_latency_ms, !r.requires_rules_check, r.knowledge_source
      );
      setRoutes((prev) => prev.map((x) => (x.task_name === r.task_name ? updated : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to toggle rules check");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div>
      <ErrorBanner error={error} />
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/[0.06]">
            <tr>
              <Th>Task</Th>
              <Th>Provider chain (urut, pisah koma — &quot;provider&quot; atau &quot;provider:model&quot;)</Th>
              <Th>target_latency_ms</Th>
              <Th>Knowledge Source</Th>
              <Th>Rules Check</Th>
              <Th>{""}</Th>
            </tr>
          </thead>
          <tbody>
            {routes.map((r) => {
              const d = draftFor(r);
              const dirty = isDirty(r);
              const busy = busyKey === r.task_name;
              return (
                <tr key={r.task_name} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                  <Td className="font-medium">{r.task_name}</Td>
                  <Td>
                    <input
                      type="text"
                      value={d.chain}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [r.task_name]: { ...d, chain: e.target.value } }))}
                      className={`w-72 ${inputClass}`}
                    />
                  </Td>
                  <Td>
                    <input
                      type="number"
                      value={d.latency}
                      placeholder="tanpa batas"
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [r.task_name]: { ...d, latency: e.target.value } }))}
                      className={`w-28 ${inputClass}`}
                    />
                  </Td>
                  <Td>
                    <input
                      type="text"
                      value={d.knowledgeSource}
                      placeholder="e.g. grounding"
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [r.task_name]: { ...d, knowledgeSource: e.target.value } }))}
                      className={`w-32 ${inputClass}`}
                    />
                  </Td>
                  <Td>
                    <TogglePill
                      active={r.requires_rules_check}
                      busy={busy}
                      onClick={() => handleToggleRulesCheck(r)}
                      activeLabel="On"
                      inactiveLabel="Off"
                    />
                  </Td>
                  <Td>{dirty && <SaveButton busy={busy} onClick={() => handleSave(r)} />}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- AI providers ---------------------------------------------------

export function ProvidersTable({ initialProviders }: { initialProviders: BotProvider[] }) {
  const [providers, setProviders] = useState(initialProviders);
  const [drafts, setDrafts] = useState<Record<string, { model_name: string; cost: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  function baseline(p: BotProvider) {
    return { model_name: p.model_name, cost: String(p.cost_per_1k_tokens_idr) };
  }
  function draftFor(p: BotProvider) {
    return drafts[p.provider_key] ?? baseline(p);
  }
  function isDirty(p: BotProvider) {
    const d = drafts[p.provider_key];
    if (!d) return false;
    const b = baseline(p);
    return d.model_name !== b.model_name || d.cost !== b.cost;
  }

  async function handleSave(p: BotProvider) {
    const d = draftFor(p);
    setError(null);
    setBusyKey(p.provider_key);
    try {
      const cost = Number(d.cost);
      if (Number.isNaN(cost)) throw new Error("cost_per_1k_tokens_idr harus angka");
      const updated = await updateBotProvider(p.provider_key, { model_name: d.model_name, cost_per_1k_tokens_idr: cost });
      setProviders((prev) => prev.map((x) => (x.provider_key === p.provider_key ? updated : x)));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[p.provider_key];
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save provider");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleToggle(p: BotProvider) {
    setError(null);
    setBusyKey(p.provider_key);
    try {
      const updated = await updateBotProvider(p.provider_key, { enabled: !p.enabled });
      setProviders((prev) => prev.map((x) => (x.provider_key === p.provider_key ? updated : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to toggle provider");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div>
      <ErrorBanner error={error} />
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/[0.06]">
            <tr>
              <Th>Provider</Th>
              <Th>Enabled</Th>
              <Th>Model name</Th>
              <Th>Cost / 1k token (IDR)</Th>
              <Th>{""}</Th>
            </tr>
          </thead>
          <tbody>
            {providers.map((p) => {
              const d = draftFor(p);
              const dirty = isDirty(p);
              const busy = busyKey === p.provider_key;
              return (
                <tr key={p.provider_key} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                  <Td className="font-medium">{p.display_name}</Td>
                  <Td>
                    <TogglePill active={p.enabled} busy={busy} onClick={() => handleToggle(p)} activeLabel="Enabled" inactiveLabel="Disabled" />
                  </Td>
                  <Td>
                    <input
                      type="text"
                      value={d.model_name}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [p.provider_key]: { ...d, model_name: e.target.value } }))}
                      className={`w-44 ${inputClass}`}
                    />
                  </Td>
                  <Td>
                    <input
                      type="number"
                      step="0.01"
                      value={d.cost}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [p.provider_key]: { ...d, cost: e.target.value } }))}
                      className={`w-24 ${inputClass}`}
                    />
                  </Td>
                  <Td>{dirty && <SaveButton busy={busy} onClick={() => handleSave(p)} />}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
