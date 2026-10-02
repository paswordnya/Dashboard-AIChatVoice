"use client";

import { useState } from "react";
import { deleteModelRegistryEntry, updateModelRegistryEntry, type ModelRegistryEntry, type ModelStatus } from "@/lib/api";
import { formatRelativeDate } from "@/lib/format";
import { Pill, Td, Th } from "@/components/ui";

const STATUS_TONE: Record<ModelStatus, "positive" | "neutral" | "warning" | "negative" | "info"> = {
  active: "positive",
  inactive: "neutral",
  maintenance: "warning",
  deprecated: "negative",
  experimental: "info",
};

// Mirrors provider_health.py's cooldown reasons (bpjs-pending-bot-local) —
// surfaced here via app/services/provider_health_sync.py's auto_deactivated_reason.
const HEALTH_REASON_LABEL: Record<string, string> = {
  auth: "Auth error",
  quota: "Quota exceeded",
  server_error: "Server error",
  network: "Network error",
};

export function ModelRegistryTable({
  models,
  onChange,
}: {
  models: ModelRegistryEntry[];
  onChange: (models: ModelRegistryEntry[]) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function handleToggle(m: ModelRegistryEntry) {
    setError(null);
    setBusy(m.model_name);
    try {
      const nextStatus: ModelStatus = m.status === "active" ? "inactive" : "active";
      const updated = await updateModelRegistryEntry(m.model_name, { status: nextStatus });
      onChange(models.map((x) => (x.model_name === m.model_name ? updated : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(modelName: string) {
    setError(null);
    setBusy(modelName);
    try {
      await deleteModelRegistryEntry(modelName);
      onChange(models.filter((x) => x.model_name !== modelName));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete model");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-400">{error}</div>
      )}
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/[0.06]">
            <tr>
              <Th>Model</Th>
              <Th>Provider</Th>
              <Th>Model Identifier</Th>
              <Th>Version</Th>
              <Th>Status</Th>
              <Th>Health</Th>
              <Th>Capabilities</Th>
              <Th>Updated</Th>
              <Th>{""}</Th>
            </tr>
          </thead>
          <tbody>
            {models.length === 0 && (
              <tr>
                <Td colSpan={9} muted>
                  No models registered yet — add one above.
                </Td>
              </tr>
            )}
            {models.map((m) => {
              const busyRow = busy === m.model_name;
              const caps = [
                m.supports_streaming && "Streaming",
                m.supports_vision && "Vision",
                m.supports_function_calling && "Function Calling",
                m.supports_json_mode && "JSON Mode",
                m.supports_embedding && "Embedding",
              ].filter(Boolean) as string[];
              return (
                <tr key={m.model_name} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                  <Td className="font-medium">{m.display_name}</Td>
                  <Td muted>{m.provider}</Td>
                  <Td muted title={m.model_identifier} className="max-w-[16ch] truncate">
                    {m.model_identifier}
                  </Td>
                  <Td muted>{m.version ?? "—"}</Td>
                  <Td>
                    <Pill tone={STATUS_TONE[m.status]}>{m.status}</Pill>
                  </Td>
                  <Td>
                    {m.auto_deactivated_reason ? (
                      <span title="Auto-deactivated by provider health sync">
                        <Pill tone="negative">⚠ {HEALTH_REASON_LABEL[m.auto_deactivated_reason] ?? m.auto_deactivated_reason}</Pill>
                      </span>
                    ) : (
                      <Pill tone="positive">Healthy</Pill>
                    )}
                  </Td>
                  <Td muted className="max-w-[24ch]">
                    {caps.length > 0 ? caps.join(", ") : "—"}
                  </Td>
                  <Td muted>{formatRelativeDate(m.updated_at)}</Td>
                  <Td>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busyRow}
                        onClick={() => handleToggle(m)}
                        className={`rounded-lg px-3 py-1 text-xs font-medium ${
                          m.status === "active"
                            ? "text-rose-400 hover:bg-rose-500/10"
                            : "bg-indigo-600 text-white hover:bg-indigo-700"
                        }`}
                      >
                        {m.status === "active" ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        type="button"
                        disabled={busyRow}
                        onClick={() => handleDelete(m.model_name)}
                        className="rounded-lg px-3 py-1 text-xs font-medium text-slate-400 hover:bg-white/[0.06]"
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
