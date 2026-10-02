import { getIntentConfigs, getModelRegistry } from "@/lib/api";
import { IntentConfigTable } from "@/components/intent-config-table";
import { PageHeader } from "@/components/ui";

export default async function ConfigPage() {
  const [configs, models] = await Promise.all([getIntentConfigs(), getModelRegistry()]);
  const modelOptions = models
    .filter((m) => m.status === "active")
    .map((m) => ({ model: m.model_identifier, provider: m.provider }));

  return (
    <main className="max-w-7xl p-8">
      <PageHeader
        title="Config — Intent Configuration"
        description="AI Router configuration per intent (PRD §14 Voice Routing) — which model handles an intent, whether the route is active, its priority when multiple rules could match, the confidence floor to trigger it, and which model to fall back to. Model choices come from Models > Model Management's active models. Edits here write directly to the database and persist across reseeds."
      />

      <IntentConfigTable initialConfigs={configs} modelOptions={modelOptions} />
    </main>
  );
}
