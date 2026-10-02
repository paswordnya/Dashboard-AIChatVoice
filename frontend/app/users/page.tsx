import Link from "next/link";
import { getBotUsers, getTelegramUsers, getTopUsers, getUsersSummary, type BotUser, type TopUser } from "@/lib/api";
import { formatRelativeDate } from "@/lib/format";
import { Card, PageHeader, Pill, SectionHeader, StatCard, Tag, TableCard, Td, Th } from "@/components/ui";
import { IconUsers, IconGrid, IconActivity, IconDatabase } from "@/components/icons";

const SUMMARY_CARDS = [
  { key: "telegram_users" as const, label: "Telegram Users", icon: IconUsers },
  { key: "pip_app_users" as const, label: "pip App Users", icon: IconUsers },
  { key: "telegram_requests" as const, label: "Telegram Requests", icon: IconGrid },
  { key: "pip_app_requests" as const, label: "pip App Requests", icon: IconGrid },
];

const TAG_LIMIT = 4;

function channelLabel(channel: "telegram" | "pip_app"): string {
  return channel === "telegram" ? "Telegram" : "pip app";
}

// Caps a user's category/topic tag list at TAG_LIMIT, folding the rest into
// a single "+N more" pill instead of letting the row grow unbounded.
function renderLimitedTags<T extends { requests: number }>(items: T[], keyPrefix: string, labelOf: (item: T) => string) {
  if (items.length === 0) {
    return <span className="text-slate-600">—</span>;
  }
  const shown = items.slice(0, TAG_LIMIT);
  const hiddenCount = items.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((item) => (
        <Tag key={`${keyPrefix}-${labelOf(item)}`}>
          <span className="capitalize">{labelOf(item)}</span> · {item.requests}
        </Tag>
      ))}
      {hiddenCount > 0 && <Pill tone="neutral">+{hiddenCount} more</Pill>}
    </div>
  );
}

export default async function UsersPage() {
  const [summary, topUsers, telegramUsers] = await Promise.all([
    getUsersSummary(),
    getTopUsers(20),
    getTelegramUsers(),
  ]);

  // Fetched independently, same defensive pattern as app/bot-config/page.tsx:
  // bpjs-pending-bot-local (a separate project/backend, port 8000) being
  // unreachable must degrade this one section, not crash the whole page.
  let registeredUsersError: string | null = null;
  let registeredUsers: BotUser[] = [];
  let pipAppActivity: TopUser[] = [];
  try {
    // High limit (not the "Most active users" section's top-20) so every
    // registered account's own activity is available to join against below,
    // not just the site-wide top 20.
    [registeredUsers, pipAppActivity] = await Promise.all([getBotUsers(), getTopUsers(200, "pip_app")]);
  } catch (e) {
    registeredUsersError = e instanceof Error ? e.message : "Failed to load registered accounts";
  }
  // auth.py's users.id (int, bpjs-pending-bot-local) is what gets sent as
  // RequestMetadata.user_id (stringified) once a session is authenticated
  // (see ai_router_stream.py/voice_router.py/mode_b_pipeline.py/voice_mode_a.py) —
  // same identifier space, so a plain string match joins the two.
  const activityByUserId = new Map(pipAppActivity.map((a) => [a.user_id, a]));

  return (
    <main className="max-w-7xl p-8">
      <PageHeader
        title="Users"
        description="§18 User Analytics — users ranked by how much they ask, split by channel (Telegram bot vs the native pip app), with the models active on their requests."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {SUMMARY_CARDS.map(({ key, label, icon: Icon }, i) => (
          <StatCard key={key} label={label} value={summary[key].toLocaleString()} icon={<Icon className="h-5 w-5" />} tintIndex={i} />
        ))}
      </div>

      <SectionHeader title="Last activity by channel" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            <IconActivity className="h-4 w-4" /> Telegram
          </div>
          <div className="mt-2 text-lg font-semibold text-white">{formatRelativeDate(summary.telegram_last_used)}</div>
        </Card>
        <Card>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            <IconActivity className="h-4 w-4" /> pip App — Chat
          </div>
          <div className="mt-2 text-lg font-semibold text-white">{formatRelativeDate(summary.pip_chat_last_used)}</div>
        </Card>
        <Card>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            <IconDatabase className="h-4 w-4" /> pip App — Voice
          </div>
          <div className="mt-2 text-lg font-semibold text-white">{formatRelativeDate(summary.pip_voice_last_used)}</div>
        </Card>
      </div>

      <SectionHeader
        title="Telegram users"
        description="Straight from the config sheet — the authoritative list, not the request log. A user with no activity yet still appears here, with blank stats."
      />

      <TableCard>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/[0.06]">
            <tr>
              <Th>Telegram username</Th>
              <Th right>Requests</Th>
              <Th>Last Used</Th>
              <Th>Tasks asked</Th>
              <Th>Topics discussed</Th>
              <Th>Models active</Th>
            </tr>
          </thead>
          <tbody>
            {telegramUsers.map((u, idx) => {
              const rowKey = u.telegram_username ?? u.user_id ?? String(idx);
              return (
                <tr key={rowKey} className="border-b border-white/[0.04] align-top last:border-0 hover:bg-white/[0.02]">
                  <Td className="font-medium text-indigo-400">
                    {u.telegram_username && u.user_id ? (
                      <Link href={`/users/${encodeURIComponent(u.user_id)}`} className="hover:underline">
                        @{u.telegram_username}
                      </Link>
                    ) : u.telegram_username ? (
                      `@${u.telegram_username}`
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </Td>
                  <Td right>
                    {u.total_requests > 0 ? u.total_requests.toLocaleString() : <span className="text-slate-600">—</span>}
                  </Td>
                  <Td muted>{formatRelativeDate(u.last_used)}</Td>
                  <Td>{renderLimitedTags(u.categories_asked, `${rowKey}-cat`, (c) => c.category)}</Td>
                  <Td>{renderLimitedTags(u.topics_discussed, `${rowKey}-topic`, (t) => t.topic)}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1.5">
                      {u.models_used.length > 0 ? (
                        u.models_used.map((m) => (
                          <Tag key={`${rowKey}-${m.model_used}`} title={m.provider}>
                            {m.model_used} · {m.requests}
                          </Tag>
                        ))
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableCard>

      <SectionHeader title="Most active users" description="Top 20, ranked by total requests." />

      <TableCard>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/[0.06]">
            <tr>
              <Th>User</Th>
              <Th>Channel</Th>
              <Th right>Requests</Th>
              <Th>Last Used</Th>
              <Th>Tasks asked</Th>
              <Th>Topics discussed</Th>
              <Th>Models active</Th>
            </tr>
          </thead>
          <tbody>
            {topUsers.map((u) => (
              <tr key={`${u.user_id}-${u.channel}`} className="border-b border-white/[0.04] align-top last:border-0 hover:bg-white/[0.02]">
                <Td className="font-medium text-indigo-400">
                  <Link href={`/users/${encodeURIComponent(u.user_id)}`} className="hover:underline">
                    {u.user_id}
                  </Link>
                </Td>
                <Td>
                  <Pill tone={u.channel === "telegram" ? "info" : "neutral"}>{channelLabel(u.channel)}</Pill>
                  <span className="ml-2 text-xs text-slate-500">{u.platform}</span>
                  {u.telegram_username && <div className="mt-1 text-xs text-indigo-400">@{u.telegram_username}</div>}
                </Td>
                <Td right>{u.total_requests.toLocaleString()}</Td>
                <Td muted>{formatRelativeDate(u.last_used)}</Td>
                <Td>{renderLimitedTags(u.categories_asked, `${u.user_id}-cat`, (c) => c.category)}</Td>
                <Td>{renderLimitedTags(u.topics_discussed, `${u.user_id}-topic`, (t) => t.topic)}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1.5">
                    {u.models_used.map((m) => (
                      <Tag key={`${u.user_id}-${m.model_used}`} title={m.provider}>
                        {m.model_used} · {m.requests}
                      </Tag>
                    ))}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>

      <SectionHeader
        title="Registered accounts (email login)"
        description="Email/password accounts from Pip's iOS/Android login+signup — sourced from bpjs-pending-bot-local's users table (auth.py), not from request activity."
      />

      {registeredUsersError ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3.5 py-2.5 text-sm text-amber-400">
          Bot backend nggak bisa dihubungi ({registeredUsersError}) — daftar akun terdaftar nggak bisa ditampilkan
          sampai server-nya jalan lagi.
        </div>
      ) : (
        <TableCard>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/[0.06]">
              <tr>
                <Th>Email</Th>
                <Th>Year of Birth</Th>
                <Th>Registered At</Th>
                <Th>Channel</Th>
                <Th>Tasks asked</Th>
                <Th>Topics discussed</Th>
                <Th>Models active</Th>
              </tr>
            </thead>
            <tbody>
              {registeredUsers.map((u) => {
                const activity = activityByUserId.get(String(u.id));
                return (
                  <tr key={u.id} className="border-b border-white/[0.04] align-top last:border-0 hover:bg-white/[0.02]">
                    <Td className="font-medium text-indigo-400">
                      <Link href={`/users/${u.id}`} className="hover:underline">
                        {u.email}
                      </Link>
                    </Td>
                    <Td>{u.year_of_birth ?? <span className="text-slate-600">—</span>}</Td>
                    <Td muted>{formatRelativeDate(u.created_at)}</Td>
                    <Td>
                      {activity ? (
                        <>
                          <Pill tone="neutral">pip app</Pill>
                          <span className="ml-2 text-xs text-slate-500">{activity.platform}</span>
                        </>
                      ) : (
                        <span className="text-slate-600">Belum ada aktivitas</span>
                      )}
                    </Td>
                    <Td>
                      {activity ? (
                        renderLimitedTags(activity.categories_asked, `${u.id}-cat`, (c) => c.category)
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </Td>
                    <Td>
                      {activity ? (
                        renderLimitedTags(activity.topics_discussed, `${u.id}-topic`, (t) => t.topic)
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </Td>
                    <Td>
                      {activity && activity.models_used.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {activity.models_used.map((m) => (
                            <Tag key={`${u.id}-${m.model_used}`} title={m.provider}>
                              {m.model_used} · {m.requests}
                            </Tag>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </Td>
                  </tr>
                );
              })}
              {registeredUsers.length === 0 && (
                <tr>
                  <Td className="text-slate-600" colSpan={7}>
                    Belum ada akun terdaftar.
                  </Td>
                </tr>
              )}
            </tbody>
          </table>
        </TableCard>
      )}
    </main>
  );
}
