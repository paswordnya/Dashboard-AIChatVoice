"use client";

import { useMemo, useState } from "react";
import type { ModelDefaultEntry, ModelRegistryEntry } from "@/lib/api";
import { ModelRegistryForm } from "@/components/model-registry-form";
import { ModelRegistryTable } from "@/components/model-registry-table";
import { ModelDefaultsPanel } from "@/components/model-defaults-panel";
import { ModelTestPanel } from "@/components/model-test-panel";
import { SectionHeader } from "@/components/ui";

export function ModelManagementConsole({
  initialModels,
  initialDefaults,
}: {
  initialModels: ModelRegistryEntry[];
  initialDefaults: ModelDefaultEntry[];
}) {
  const [models, setModels] = useState(initialModels);
  const activeModels = useMemo(() => models.filter((m) => m.status === "active"), [models]);

  return (
    <div>
      <ModelRegistryForm onCreated={(m) => setModels((prev) => [...prev, m])} />

      <SectionHeader title="Active Models" description="Every registered model — toggle Activate/Deactivate to control AI Router eligibility." />
      <ModelRegistryTable models={models} onChange={setModels} />

      <SectionHeader title="Default Model" />
      <ModelDefaultsPanel activeModels={activeModels} initialDefaults={initialDefaults} />

      <SectionHeader title="Test Model" />
      <ModelTestPanel models={models} />
    </div>
  );
}
