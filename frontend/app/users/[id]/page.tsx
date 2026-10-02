import Link from "next/link";
import { notFound } from "next/navigation";
import { getUserAdaptiveProfile, getUserDetail, type AdaptiveProfile } from "@/lib/api";
import { formatRelativeDate } from "@/lib/format";
import { PageHeader, Pill, SectionHeader, StatCard, TableCard, Td, Th } from "@/components/ui";
import { IconActivity, IconClock, IconGrid, IconUsers } from "@/components/icons";

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let user;
  try {
    user = await getUserDetail(id);
  } catch {
    notFound();
  }

  // Best-effort: a failed/unreachable bot API must never take down the rest
  // of this page (same "distinct from a real 404" spirit as getUserDetail's
  // own directory-only fallback above) — a null profile renders as "no
  // interaction profile yet", not an error.
  let profile: AdaptiveProfile | null = null;
  try {
    profile = await getUserAdaptiveProfile(id);
  } catch {
    profile = null;
  }

  const title = user.telegram_username ? `@${user.telegram_username}` : user.user_id;

  return (
    <main className="max-w-7xl p-8">
      <Link href="/users" className="text-sm text-indigo-400 hover:underline">
        ← Back to Users
      </Link>

      <PageHeader
        title={title}
        description={
          <>
            <Pill tone={user.channel === "telegram" ? "info" : "neutral"}>
              {user.channel === "telegram" ? "Telegram" : "pip app"}
            </Pill>
            <span className="ml-2">
              First seen {formatRelativeDate(user.first_seen)} · Last used {formatRelativeDate(user.last_used)}
            </span>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Requests" value={user.total_requests.toLocaleString()} icon={<IconGrid className="h-5 w-5" />} tintIndex={0} />
        <StatCard label="Channel" value={user.channel === "telegram" ? "Telegram" : "pip app"} icon={<IconUsers className="h-5 w-5" />} tintIndex={1} />
        <StatCard label="First Seen" value={formatRelativeDate(user.first_seen)} icon={<IconClock className="h-5 w-5" />} tintIndex={2} />
        <StatCard label="Last Used" value={formatRelativeDate(user.last_used)} icon={<IconActivity className="h-5 w-5" />} tintIndex={3} />
      </div>

      {user.channel === "pip_app" && (
        <div>
          <SectionHeader
            title="Interaction Profile"
            description="PRD §23 Adaptive Conversation Engine — what pip has learned about how this user likes to be talked to."
          />
          {profile ? (
            <div className="card grid grid-cols-2 gap-x-6 gap-y-4 p-5 sm:grid-cols-3 lg:grid-cols-4">
              <div>
                <div className="text-xs text-slate-500">Communication Style</div>
                <div className="mt-1 text-sm font-medium capitalize">{profile.communication_style ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Preferred Tone</div>
                <div className="mt-1 text-sm font-medium capitalize">{profile.preferred_tone ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Response Length</div>
                <div className="mt-1 text-sm font-medium capitalize">{profile.preferred_response_length ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Technical Level</div>
                <div className="mt-1 text-sm font-medium capitalize">{profile.technical_level ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Interaction Score</div>
                <div className="mt-1 text-sm font-medium">{profile.interaction_score.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Confidence Score</div>
                <div className="mt-1 text-sm font-medium">{profile.confidence_score.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Last Updated</div>
                <div className="mt-1 text-sm font-medium">{formatRelativeDate(profile.last_updated_at)}</div>
              </div>
              <div className="col-span-2 sm:col-span-3 lg:col-span-4">
                <div className="text-xs text-slate-500">Favorite Topics</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {profile.favorite_topics.length > 0 ? (
                    profile.favorite_topics.map((t) => (
                      <Pill key={t} tone="info">
                        {t}
                      </Pill>
                    ))
                  ) : (
                    <span className="text-sm text-slate-500">—</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="card p-5 text-sm text-slate-500">No interaction profile yet — not enough activity for pip to learn from.</div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <SectionHeader title="Models Used" />
          <TableCard>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/[0.06]">
                <tr>
                  <Th>Model</Th>
                  <Th right>Requests</Th>
                </tr>
              </thead>
              <tbody>
                {user.models_used.length === 0 && (
                  <tr>
                    <Td colSpan={2} className="text-center text-slate-500">No model data.</Td>
                  </tr>
                )}
                {user.models_used.map((r) => (
                  <tr key={r.model_used} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                    <Td className="font-medium" title={r.provider}>{r.model_used}</Td>
                    <Td right>{r.requests.toLocaleString()}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableCard>
        </div>

        <div>
          <SectionHeader title="Categories Asked" />
          <TableCard>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/[0.06]">
                <tr>
                  <Th>Category</Th>
                  <Th right>Requests</Th>
                </tr>
              </thead>
              <tbody>
                {user.categories_asked.length === 0 && (
                  <tr>
                    <Td colSpan={2} className="text-center text-slate-500">No category data.</Td>
                  </tr>
                )}
                {user.categories_asked.map((r) => (
                  <tr key={r.category} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                    <Td className="font-medium capitalize">{r.category}</Td>
                    <Td right>{r.requests.toLocaleString()}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableCard>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <SectionHeader title="Topics Discussed" />
          <TableCard>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/[0.06]">
                <tr>
                  <Th>Topic</Th>
                  <Th right>Requests</Th>
                </tr>
              </thead>
              <tbody>
                {user.topics_discussed.length === 0 && (
                  <tr>
                    <Td colSpan={2} className="text-center text-slate-500">No topic data.</Td>
                  </tr>
                )}
                {user.topics_discussed.map((r) => (
                  <tr key={r.topic} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                    <Td className="font-medium">{r.topic}</Td>
                    <Td right>{r.requests.toLocaleString()}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableCard>
        </div>

        <div>
          <SectionHeader
            title="Languages Used"
            description="Detected per message — LLM-classified for Telegram/Chat text, ASR-detected for Voice."
          />
          <TableCard>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/[0.06]">
                <tr>
                  <Th>Language</Th>
                  <Th right>Requests</Th>
                </tr>
              </thead>
              <tbody>
                {user.languages_used.length === 0 && (
                  <tr>
                    <Td colSpan={2} className="text-center text-slate-500">No language data yet.</Td>
                  </tr>
                )}
                {user.languages_used.map((r) => (
                  <tr key={r.language} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                    <Td className="font-medium uppercase">{r.language}</Td>
                    <Td right>{r.requests.toLocaleString()}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableCard>
        </div>
      </div>
    </main>
  );
}
