"use client";

import { useState } from "react";
import { setModelDefault, type ModelDefaultEntry, type ModelRegistryEntry, type ModelUseCase } from "@/lib/api";
import { Card } from "@/components/ui";

const USE_CASE_LABELS: Record<ModelUseCase, string> = {
  chat: "Chat",
  voice: "Voice",
  background_task: "Background Task",
  classification: "Classification",
  coding: "Coding",
};

const selectClass =
  "mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-2.5 py-1.5 text-sm text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

export function ModelDefaultsPanel({
  activeModels,
  initialDefaults,
}: {
  activeModels: ModelRegistryEntry[];
  initialDefaults: ModelDefaultEntry[];
}) {
  const [defaults, setDefaults] = useState(initialDefaults);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<ModelUseCase | null>(null);

  async function handleChange(useCase: ModelUseCase, modelName: string) {
    if (!modelName) return;
    setError(null);
    setBusy(useCase);
    try {
      const updated = await setModelDefault(useCase, modelName);
      setDefaults((prev) => prev.map((d) => (d.use_case === useCase ? updated : d)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to set default model");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <h3 className="mb-1 text-sm font-semibold text-white">Default Model</h3>
      <p className="mb-4 text-xs text-slate-500">
        Per §14 — which active model each use case routes to by default. Only models with status Active are selectable.
      </p>
      {error && (
        <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-400">{error}</div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {defaults.map((d) => (
          <div key={d.use_case}>
            <label className="block text-xs font-medium text-slate-500">{USE_CASE_LABELS[d.use_case]}</label>
            <select
              value={d.model_name ?? ""}
              disabled={busy === d.use_case}
              onChange={(e) => handleChange(d.use_case, e.target.value)}
              className={selectClass}
            >
              <option value="" disabled>
                {activeModels.length === 0 ? "No active models" : "Select a model"}
              </option>
              {activeModels.map((m) => (
                <option key={m.model_name} value={m.model_name}>
                  {m.display_name}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </Card>
  );
}
