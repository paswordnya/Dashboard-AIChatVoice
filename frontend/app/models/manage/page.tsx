import { getModelDefaults, getModelRegistry } from "@/lib/api";
import { ModelManagementConsole } from "@/components/model-management-console";
import { PageHeader } from "@/components/ui";

export default async function ModelManagementPage() {
  const [models, defaults] = await Promise.all([getModelRegistry(), getModelDefaults()]);

  return (
    <main className="max-w-7xl p-8">
      <PageHeader
        title="Model Management"
        description="§22 AI Model Management & Dynamic Configuration — add, activate, and test models without a deployment. Edits write directly to the database and take effect on the next request."
      />
      <ModelManagementConsole initialModels={models} initialDefaults={defaults} />
    </main>
  );
}
