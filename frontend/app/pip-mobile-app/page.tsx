import { getMobileApps, getMobileCapabilities } from "@/lib/api";
import { MobileAppsPanel } from "@/components/mobile-devtools";
import { PageHeader } from "@/components/ui";

export default async function PipMobileAppPage() {
  // Never allowed to throw: an unreachable backend must still render the
  // page (with an empty app list / everything-unavailable capabilities)
  // rather than crash the whole route.
  const [apps, capabilities] = await Promise.all([
    getMobileApps().catch(() => []),
    getMobileCapabilities().catch(() => ({ android_studio_installed: false, android_sdk_available: false })),
  ]);

  return (
    <main className="max-w-7xl p-8">
      <PageHeader
        title="Pip Mobile App"
        description="Local dev tooling for native/KMP mobile projects on this machine — open Xcode/Android Studio, list buildable emulators/simulators, build+run, and clear caches. Starts seeded with pipvoice; add more via '+ Add App'."
      />
      <MobileAppsPanel initialApps={apps} capabilities={capabilities} />
    </main>
  );
}
