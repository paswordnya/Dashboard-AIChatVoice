import {
  getBotSettings,
  getBotTemplates,
  getBotRoutes,
  getBotProviders,
  getPipServerStatus,
  type BotSetting,
  type BotTemplate,
  type BotRoute,
  type BotProvider,
  type PipServerActionResult,
} from "@/lib/api";
import { SettingsTable, TemplatesTable, RoutesTable, ProvidersTable } from "@/components/bot-config-tables";
import { PipServerControl } from "@/components/pip-server-control";
import { PageHeader, SectionHeader } from "@/components/ui";

export default async function BotConfigPage() {
  // Fetched independently from the bot-config data below, and never allowed
  // to throw: this panel must render even when bpjs-pending-bot-local is
  // completely unreachable, since it's the ONE section that can actually
  // bring it back up (it talks to this dashboard's OWN backend, port 8010,
  // not through the bot's own API — see pip_server_control.py).
  const serverStatus: PipServerActionResult = await getPipServerStatus().catch((e) => ({
    ok: false,
    output: e instanceof Error ? e.message : "Gagal mengecek status server.",
  }));

  // The bot backend being down must degrade this section, not crash the
  // whole page — otherwise the one panel that could fix it (Server, above)
  // never even renders. A `Promise.all` here would reject as soon as ANY
  // one of these four throws, taking the rest down with it, so each is
  // fetched independently instead.
  let botConfigError: string | null = null;
  let settings: BotSetting[] = [];
  let templates: BotTemplate[] = [];
  let routes: BotRoute[] = [];
  let providers: BotProvider[] = [];
  try {
    [settings, templates, routes, providers] = await Promise.all([
      getBotSettings(),
      getBotTemplates(),
      getBotRoutes(),
      getBotProviders(),
    ]);
  } catch (e) {
    botConfigError = e instanceof Error ? e.message : "Failed to load bot config";
  }

  return (
    <main className="max-w-7xl p-8">
      <PageHeader
        title="Settings — BPJS Bot Config"
        description="Live config for bpjs-pending-bot-local (a separate project, its own backend on port 8000) — validation limits, message templates, AI provider routing, and the provider registry. Edits here write straight to that bot's Postgres database (schema.sql) and take effect immediately, no bot restart needed."
      />

      <section id="server" className="mb-10">
        <SectionHeader title="Server" />
        <PipServerControl initialStatus={serverStatus} />
      </section>

      {botConfigError ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3.5 py-2.5 text-sm text-amber-400">
          Bot backend nggak bisa dihubungi ({botConfigError}) — Settings/Templates/Routes/Providers di bawah nggak bisa
          ditampilkan sampai server-nya jalan lagi. Start dulu lewat panel Server di atas, lalu refresh halaman ini.
        </div>
      ) : (
        <>
          <section id="settings">
            <SectionHeader title="Settings" />
            <SettingsTable initialSettings={settings} />
          </section>

          <section id="templates">
            <SectionHeader title="Prompt Templates" />
            <TemplatesTable initialTemplates={templates} />
          </section>

          <section id="routes">
            <SectionHeader title="AI Provider Routes" />
            <RoutesTable initialRoutes={routes} />
          </section>

          <section id="providers">
            <SectionHeader title="AI Providers" />
            <ProvidersTable initialProviders={providers} />
          </section>
        </>
      )}
    </main>
  );
}
