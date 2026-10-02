const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface OverviewKPIs {
  total_requests: number;
  total_conversations: number;
  total_active_users: number;
  total_sessions: number;
  average_response_time_ms: number | null;
  average_first_token_time_ms: number | null;
  success_rate: number | null;
  error_rate: number | null;
  tool_call_rate: number | null;
}

export async function getOverviewKPIs(): Promise<OverviewKPIs> {
  const res = await fetch(`${API_URL}/overview`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch overview KPIs: ${res.status}`);
  }
  return res.json();
}

export interface ModelUsage {
  model_used: string;
  provider: string;
  total_requests: number;
  success_rate: number;
  error_rate: number;
  avg_latency_ms: number;
  avg_token_usage: number;
  avg_cost_usd: number | null;
  last_used: string;
}

export async function getModelUsage(): Promise<ModelUsage[]> {
  const res = await fetch(`${API_URL}/models`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch model usage: ${res.status}`);
  }
  return res.json();
}

export interface RouterAnalytics {
  total_routed_requests: number;
  route_success: number;
  route_failure: number;
  local_to_cloud_fallback: number;
  cloud_to_local_fallback: number;
  wrong_route_rate: number;
  manual_override: number;
}

export async function getRouterAnalytics(): Promise<RouterAnalytics> {
  const res = await fetch(`${API_URL}/router-analytics`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch router analytics: ${res.status}`);
  }
  return res.json();
}

export interface KnowledgeSourceShare {
  source: string;
  label: string;
  requests: number;
  percentage: number;
}

export async function getKnowledgeSourceDistribution(): Promise<KnowledgeSourceShare[]> {
  const res = await fetch(`${API_URL}/knowledge-source/distribution`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch knowledge source distribution: ${res.status}`);
  }
  return res.json();
}

export interface CategorySummary {
  category: string;
  requests: number;
  percentage: number;
  success_rate: number;
}

export interface CategoryRouteDestination {
  provider: string;
  model_used: string;
  requests: number;
  percentage: number;
}

export async function getCategories(): Promise<CategorySummary[]> {
  const res = await fetch(`${API_URL}/categories`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch categories: ${res.status}`);
  }
  return res.json();
}

export async function getCategoryRouting(category: string): Promise<CategoryRouteDestination[]> {
  const res = await fetch(`${API_URL}/categories/${category}/routing`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch category routing for ${category}: ${res.status}`);
  }
  return res.json();
}

export interface ChannelSummary {
  telegram_users: number;
  pip_app_users: number;
  telegram_requests: number;
  pip_app_requests: number;
  telegram_last_used: string | null;
  pip_chat_last_used: string | null;
  pip_voice_last_used: string | null;
}

export interface ModelActivity {
  model_used: string;
  provider: string;
  requests: number;
}

export interface CategoryActivity {
  category: string;
  requests: number;
}

export interface TopicActivity {
  topic: string;
  requests: number;
}

export interface TopUser {
  user_id: string;
  channel: "telegram" | "pip_app";
  platform: string;
  telegram_username: string | null;
  total_requests: number;
  last_used: string | null;
  models_used: ModelActivity[];
  categories_asked: CategoryActivity[];
  topics_discussed: TopicActivity[];
}

export async function getUsersSummary(): Promise<ChannelSummary> {
  const res = await fetch(`${API_URL}/users/summary`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch users summary: ${res.status}`);
  }
  return res.json();
}

export async function getTopUsers(limit = 20, channel?: "telegram" | "pip_app"): Promise<TopUser[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (channel) params.set("channel", channel);
  const res = await fetch(`${API_URL}/users/top?${params}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch top users: ${res.status}`);
  }
  return res.json();
}

export interface TelegramDirectoryUser {
  telegram_username: string | null;
  user_id: string | null;
  total_requests: number;
  last_used: string | null;
  models_used: ModelActivity[];
  categories_asked: CategoryActivity[];
  topics_discussed: TopicActivity[];
}

export async function getTelegramUsers(): Promise<TelegramDirectoryUser[]> {
  const res = await fetch(`${API_URL}/users/telegram`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch telegram users: ${res.status}`);
  }
  return res.json();
}

export interface LanguageActivity {
  language: string;
  requests: number;
}

export interface UserDetail {
  user_id: string;
  channel: "telegram" | "pip_app";
  platform: string | null;
  telegram_username: string | null;
  total_requests: number;
  first_seen: string | null;
  last_used: string | null;
  models_used: ModelActivity[];
  categories_asked: CategoryActivity[];
  topics_discussed: TopicActivity[];
  // Text channels (Telegram CHAT, Pip app Chat) get this from an LLM
  // classifying the message text (bpjs-pending-bot-local's
  // language_classifier.py); voice turns get it from ASR. Same field either
  // way — one "detected language" breakdown across all of this user's activity.
  languages_used: LanguageActivity[];
}

export async function getUserDetail(userId: string): Promise<UserDetail> {
  const res = await fetch(`${API_URL}/users/${encodeURIComponent(userId)}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch user ${userId}: ${res.status}`);
  }
  return res.json();
}

export interface AdaptiveProfile {
  user_id: number;
  preferred_language: string | null;
  communication_style: string | null;
  preferred_tone: string | null;
  preferred_response_length: string | null;
  technical_level: string | null;
  favorite_topics: string[];
  response_preference: string | null;
  humor_preference: string | null;
  emoji_preference: string | null;
  interaction_score: number;
  confidence_score: number;
  last_updated_at: string;
}

// PRD §23 Adaptive Conversation Engine — proxied live from
// bpjs-pending-bot-local (this dashboard has no adaptive_profiles table of
// its own). Returns null for Telegram-only users (no such profile exists
// for them) and for pip app users who haven't interacted enough yet for
// behavior_analyzer.py to compute anything — both are normal, not errors.
export async function getUserAdaptiveProfile(userId: string): Promise<AdaptiveProfile | null> {
  const res = await fetch(`${API_URL}/users/${encodeURIComponent(userId)}/profile`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch adaptive profile for user ${userId}: ${res.status}`);
  }
  return res.json();
}

export interface FallbackDestination {
  model_used: string;
  provider: string;
  fallback_count: number;
  percentage_of_all_fallbacks: number;
}

export async function getFallbackByModel(): Promise<FallbackDestination[]> {
  const res = await fetch(`${API_URL}/router-analytics/fallback-by-model`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch fallback-by-model: ${res.status}`);
  }
  return res.json();
}

export interface CostSavings {
  local_requests: number;
  cloud_requests: number;
  actual_cloud_cost_usd: number;
  avg_cost_per_cloud_request_usd: number;
  estimated_savings_usd: number;
  estimated_cost_if_all_cloud_usd: number;
}

export async function getCostSavings(): Promise<CostSavings> {
  const res = await fetch(`${API_URL}/cost-savings`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch cost savings: ${res.status}`);
  }
  return res.json();
}

export interface FeatureAdoption {
  feature: string;
  requests: number;
  percentage: number;
}

export async function getFeatureAdoption(): Promise<FeatureAdoption[]> {
  const res = await fetch(`${API_URL}/feature-adoption`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch feature adoption: ${res.status}`);
  }
  return res.json();
}

export interface ConfidenceBucket {
  bucket_start: number;
  bucket_end: number;
  requests: number;
}

export interface ConfidenceSummary {
  avg_confidence: number;
  avg_confidence_when_routed_correctly: number;
  avg_confidence_when_wrong_or_escalated: number;
  buckets: ConfidenceBucket[];
}

export async function getConfidenceDistribution(): Promise<ConfidenceSummary> {
  const res = await fetch(`${API_URL}/confidence-distribution`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch confidence distribution: ${res.status}`);
  }
  return res.json();
}

export interface EscalationStepCount {
  escalation_steps: number;
  requests: number;
}

export interface TopEscalationPath {
  escalation_path: string;
  requests: number;
}

export interface EscalationAnalytics {
  total_requests: number;
  escalated_requests: number;
  escalation_rate: number;
  by_steps: EscalationStepCount[];
  top_paths: TopEscalationPath[];
}

export async function getEscalationAnalytics(): Promise<EscalationAnalytics> {
  const res = await fetch(`${API_URL}/escalation-analytics`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch escalation analytics: ${res.status}`);
  }
  return res.json();
}

export interface KnowledgeGapQuestion {
  query_text: string;
  requests: number;
  category: string | null;
  most_common_intent: string | null;
  topic: string | null;
  topic_category: string | null;
}

export async function getKnowledgeGap(limit = 20): Promise<KnowledgeGapQuestion[]> {
  const res = await fetch(`${API_URL}/knowledge-gap?limit=${limit}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch knowledge gap: ${res.status}`);
  }
  return res.json();
}

export interface FailedQuestion {
  query_text: string;
  total_requests: number;
  failure_count: number;
  negative_feedback_count: number;
  category: string | null;
  topic: string | null;
  topic_category: string | null;
}

export async function getTopFailedQuestions(limit = 20): Promise<FailedQuestion[]> {
  const res = await fetch(`${API_URL}/top-failed-questions?limit=${limit}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch top failed questions: ${res.status}`);
  }
  return res.json();
}

export interface IntentChainEntry {
  provider: string;
  model: string;
}

export interface IntentConfigEntry {
  intent: string;
  chain: IntentChainEntry[];
  enabled: boolean;
  priority: number;
  confidence_threshold: number;
  max_latency_ms: number | null;
  requires_rules_check: boolean;
  knowledge_source: string | null;
  updated_at: string;
}

export interface IntentConfigCreateInput {
  intent: string;
  chain: IntentChainEntry[];
  enabled?: boolean;
  priority?: number;
  confidence_threshold?: number;
  max_latency_ms?: number | null;
  requires_rules_check?: boolean;
  knowledge_source?: string | null;
}

export interface IntentConfigUpdateInput {
  chain?: IntentChainEntry[];
  enabled?: boolean;
  priority?: number;
  confidence_threshold?: number;
  max_latency_ms?: number | null;
  requires_rules_check?: boolean;
  knowledge_source?: string | null;
}

export async function getIntentConfigs(): Promise<IntentConfigEntry[]> {
  const res = await fetch(`${API_URL}/config/intents`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch intent configs: ${res.status}`);
  }
  return res.json();
}

export async function createIntentConfig(input: IntentConfigCreateInput): Promise<IntentConfigEntry> {
  const res = await fetch(`${API_URL}/config/intents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Failed to create intent config: ${res.status}`);
  }
  return res.json();
}

export async function updateIntentConfig(intent: string, input: IntentConfigUpdateInput): Promise<IntentConfigEntry> {
  const res = await fetch(`${API_URL}/config/intents/${encodeURIComponent(intent)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Failed to update intent config: ${res.status}`);
  }
  return res.json();
}

export async function deleteIntentConfig(intent: string): Promise<void> {
  const res = await fetch(`${API_URL}/config/intents/${encodeURIComponent(intent)}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Failed to delete intent config: ${res.status}`);
  }
}

// --- Bot Config (bpjs-pending-bot-local's dashboard, a separate project —
// see this frontend's CLAUDE.md) ------------------------------------------
// Calls THIS app's own /api/bot-config/* route (same-origin, no CORS),
// which injects HTTP Basic Auth server-side before forwarding to
// bpjs-pending-bot-local's backend (port 8000 by default) — those
// credentials never reach the browser.
//
// SITE_URL: the initial GET calls run inside app/bot-config/page.tsx, a
// Server Component — its fetch() executes on the Node.js server during
// SSR, where a relative URL like "/api/bot-config/settings" has no page
// origin to resolve against and throws ERR_INVALID_URL. In the browser
// (client-component PATCH calls from bot-config-tables.tsx), `window`
// exists and a relative URL resolves fine against the current page, so
// SITE_URL collapses to "" there.
const SITE_URL =
  typeof window === "undefined" ? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000" : "";

export interface BotSetting {
  key: string;
  category: string;
  label: string;
  description: string | null;
  data_type: "int" | "float" | "bool" | "string" | "json";
  value: unknown;
  updated_by: string | null;
  updated_at: string;
}

export async function getBotSettings(): Promise<BotSetting[]> {
  const res = await fetch(`${SITE_URL}/api/bot-config/settings`, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Failed to fetch bot settings: ${res.status}`);
  }
  return res.json();
}

export interface BotUser {
  id: number;
  email: string;
  year_of_birth: number | null;
  created_at: string;
}

// Registered email/password accounts (auth.py/auth_store.py in
// bpjs-pending-bot-local) — distinct from BotSetting/BotTemplate/etc above,
// but same proxy route (dashboard_api.py's GET /api/dashboard/users).
export async function getBotUsers(): Promise<BotUser[]> {
  const res = await fetch(`${SITE_URL}/api/bot-config/users`, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Failed to fetch registered users: ${res.status}`);
  }
  return res.json();
}

export interface ProviderStatus {
  provider_key: string;
  display_name: string;
  enabled: boolean;
  is_down: boolean;
  reason: "auth" | "quota" | "server_error" | "network" | null;
  cooldown_remaining_seconds: number;
}

// Live cooldown state (provider_health.py's provider_cooldown_state.json) —
// distinct from getModelUsage()'s historical success/error rate; this is
// "is this provider unusable RIGHT NOW", for an alert banner.
export async function getProviderStatus(): Promise<ProviderStatus[]> {
  const res = await fetch(`${SITE_URL}/api/bot-config/provider-status`, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Failed to fetch provider status: ${res.status}`);
  }
  return res.json();
}

export async function updateBotSetting(key: string, value: unknown, changedBy?: string): Promise<BotSetting> {
  const res = await fetch(`${SITE_URL}/api/bot-config/settings/${encodeURIComponent(key)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value, changed_by: changedBy }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Failed to update setting: ${res.status}`);
  }
  return res.json();
}

export interface BotTemplate {
  key: string;
  category: string;
  label: string;
  description: string | null;
  content: string;
  is_active: boolean;
  updated_by: string | null;
  updated_at: string;
}

export async function getBotTemplates(): Promise<BotTemplate[]> {
  const res = await fetch(`${SITE_URL}/api/bot-config/templates`, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Failed to fetch bot templates: ${res.status}`);
  }
  return res.json();
}

export async function updateBotTemplate(
  key: string,
  patch: { content?: string; is_active?: boolean },
  changedBy?: string
): Promise<BotTemplate> {
  const res = await fetch(`${SITE_URL}/api/bot-config/templates/${encodeURIComponent(key)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...patch, changed_by: changedBy }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Failed to update template: ${res.status}`);
  }
  return res.json();
}

// A chain entry is either a bare provider name or a {"provider","model"}
// object pinning a specific model within that provider (e.g. a specific
// LM Studio model per task) — mirrors voice_routes.yaml's fallback shape.
export type ChainEntry = string | { provider: string; model?: string };

export interface BotRoute {
  task_name: string;
  provider_chain: ChainEntry[];
  target_latency_ms: number | null;
  requires_rules_check: boolean;
  knowledge_source: string | null;
  updated_by: string | null;
  updated_at: string;
}

export async function getBotRoutes(): Promise<BotRoute[]> {
  const res = await fetch(`${SITE_URL}/api/bot-config/routes`, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Failed to fetch bot routes: ${res.status}`);
  }
  return res.json();
}

export async function updateBotRoute(
  taskName: string,
  providerChain: ChainEntry[],
  targetLatencyMs: number | null,
  requiresRulesCheck: boolean,
  knowledgeSource: string | null,
  changedBy?: string
): Promise<BotRoute> {
  const res = await fetch(`${SITE_URL}/api/bot-config/routes/${encodeURIComponent(taskName)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider_chain: providerChain,
      target_latency_ms: targetLatencyMs,
      requires_rules_check: requiresRulesCheck,
      knowledge_source: knowledgeSource,
      changed_by: changedBy,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Failed to update route: ${res.status}`);
  }
  return res.json();
}

export interface BotProvider {
  provider_key: string;
  display_name: string;
  model_name: string;
  enabled: boolean;
  cost_per_1k_tokens_idr: number;
  updated_by: string | null;
  updated_at: string;
}

export async function getBotProviders(): Promise<BotProvider[]> {
  const res = await fetch(`${SITE_URL}/api/bot-config/providers`, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Failed to fetch bot providers: ${res.status}`);
  }
  return res.json();
}

export async function updateBotProvider(
  providerKey: string,
  patch: { model_name?: string; enabled?: boolean; cost_per_1k_tokens_idr?: number },
  changedBy?: string
): Promise<BotProvider> {
  const res = await fetch(`${SITE_URL}/api/bot-config/providers/${encodeURIComponent(providerKey)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...patch, changed_by: changedBy }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Failed to update provider: ${res.status}`);
  }
  return res.json();
}

// --- Topics (auto-detected conversation subjects — Intent/Category/Topic) ---

export interface ChannelCounts {
  telegram: number;
  chat: number;
  voice: number;
}

export interface TopicSummaryRow {
  id: number;
  name: string;
  category: string | null;
  total_requests: number;
  channels: ChannelCounts;
  first_seen: string;
  last_seen: string | null;
}

export interface TopicsSummary {
  total_topics: number;
  new_this_week: number;
  active_topics: number;
  topic_growth_percent: number | null;
}

export interface TopicModelBreakdown {
  topic: string;
  model_used: string;
  provider: string;
  requests: number;
}

export interface TopicChannelBreakdown {
  topic: string;
  channels: ChannelCounts;
  total_requests: number;
}

export interface NewTopic {
  id: number;
  name: string;
  category: string | null;
  created: string;
}

export interface TimelinePoint {
  bucket: string;
  requests: number;
}

export interface RelatedTopic {
  id: number;
  name: string;
  co_occurrences: number;
}

export interface IntentBreakdown {
  intent: string;
  requests: number;
}

export interface TopicDetail {
  id: number;
  name: string;
  category: string | null;
  total_requests: number;
  avg_latency_ms: number | null;
  first_seen: string;
  last_seen: string | null;
  channels: ChannelCounts;
  models_used: TopicModelBreakdown[];
  top_intents: IntentBreakdown[];
  knowledge_source: { knowledge_source: string; requests: number }[];
  related_topics: RelatedTopic[];
  trend: TimelinePoint[];
}

export async function getTopicsSummary(): Promise<TopicsSummary> {
  const res = await fetch(`${API_URL}/topics/summary`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch topics summary: ${res.status}`);
  }
  return res.json();
}

export async function getTopics(q?: string, limit = 50): Promise<TopicSummaryRow[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (q) params.set("q", q);
  const res = await fetch(`${API_URL}/topics?${params}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch topics: ${res.status}`);
  }
  return res.json();
}

export async function getTopicsByModel(): Promise<TopicModelBreakdown[]> {
  const res = await fetch(`${API_URL}/topics/by-model`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch topics by model: ${res.status}`);
  }
  return res.json();
}

export async function getTopicsByChannel(): Promise<TopicChannelBreakdown[]> {
  const res = await fetch(`${API_URL}/topics/by-channel`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch topics by channel: ${res.status}`);
  }
  return res.json();
}

export async function getNewTopics(days = 7): Promise<NewTopic[]> {
  const res = await fetch(`${API_URL}/topics/new?days=${days}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch new topics: ${res.status}`);
  }
  return res.json();
}

export async function getTopicTimeline(bucket: "day" | "week" | "month" = "day"): Promise<TimelinePoint[]> {
  const res = await fetch(`${API_URL}/topics/timeline?bucket=${bucket}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch topic timeline: ${res.status}`);
  }
  return res.json();
}

export async function getTopicDetail(id: number): Promise<TopicDetail> {
  const res = await fetch(`${API_URL}/topics/${id}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch topic ${id}: ${res.status}`);
  }
  return res.json();
}

// ------------------------------------------------------------------
// Voice Analytics (§A-O) — all filtered server-side to channel='voice'
// ------------------------------------------------------------------

async function fetchVoice<T>(path: string, label: string): Promise<T> {
  const res = await fetch(`${API_URL}/voice-analytics/${path}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${label}: ${res.status}`);
  }
  return res.json();
}

export interface VoiceOverview {
  total_voice_sessions: number;
  active_voice_users: number;
  total_voice_requests: number;
  total_requests_all_channels: number;
  average_session_duration_ms: number | null;
  average_conversation_turns: number | null;
  average_response_time_ms: number | null;
  average_time_to_first_audio_ms: number | null;
  voice_adoption_rate: number | null;
}
export const getVoiceOverview = () => fetchVoice<VoiceOverview>("overview", "voice overview");

export interface VoiceUsageTrendPoint {
  bucket: string;
  requests: number;
}
export interface VoiceUsage {
  total_voice_sessions: number;
  voice_messages: number;
  average_voice_duration_ms: number | null;
  longest_voice_session_ms: number | null;
  voice_per_user: number | null;
  peak_usage_hour: number | null;
  peak_usage_day: string | null;
  daily_trend: VoiceUsageTrendPoint[];
}
export const getVoiceUsage = () => fetchVoice<VoiceUsage>("usage", "voice usage");

export interface VoiceInteraction {
  wake_word_count: number;
  continue_conversation_count: number;
  interrupt_count: number;
  retry_count: number;
  cancel_count: number;
  manual_stop_count: number;
  silence_timeout_count: number;
}
export const getVoiceInteraction = () => fetchVoice<VoiceInteraction>("interaction", "voice interaction");

export interface SpeechAnalytics {
  average_speech_duration_ms: number | null;
  longest_speech_ms: number | null;
  average_words: number | null;
  average_speaking_speed_wpm: number | null;
  average_silence_ms: number | null;
  average_noise_level: number | null;
  average_speech_confidence: number | null;
}
export const getSpeechAnalytics = () => fetchVoice<SpeechAnalytics>("speech", "speech analytics");

export interface STTAnalytics {
  stt_requests: number;
  stt_success_rate: number | null;
  stt_failure_rate: number | null;
  average_stt_latency_ms: number | null;
  average_recognition_confidence: number | null;
  language_breakdown: Record<string, number>;
}
export const getSTTAnalytics = () => fetchVoice<STTAnalytics>("stt", "STT analytics");

export interface TTSAnalytics {
  tts_requests: number;
  average_tts_latency_ms: number | null;
  average_playback_duration_ms: number | null;
  playback_interrupted_count: number;
  voice_provider_breakdown: Record<string, number>;
  voice_used_breakdown: Record<string, number>;
}
export const getTTSAnalytics = () => fetchVoice<TTSAnalytics>("tts", "TTS analytics");

export interface ModelBreakdown {
  model_used: string;
  requests: number;
}
export interface AIResponseAnalytics {
  average_time_to_first_token_ms: number | null;
  average_time_to_first_audio_ms: number | null;
  average_full_response_time_ms: number | null;
  total_tokens_generated: number;
  model_breakdown: ModelBreakdown[];
  provider_breakdown: ModelBreakdown[];
  knowledge_source_breakdown: ModelBreakdown[];
}
export const getVoiceAIResponse = () => fetchVoice<AIResponseAnalytics>("ai-response", "AI response analytics");

export interface LabeledCount {
  label: string;
  requests: number;
}
export const getVoiceIntents = () => fetchVoice<LabeledCount[]>("intents", "voice intents");
export const getVoiceCategories = () => fetchVoice<LabeledCount[]>("categories", "voice categories");
export const getVoiceKnowledge = () => fetchVoice<LabeledCount[]>("knowledge", "voice knowledge sources");

export interface TopicCount {
  topic: string;
  category: string | null;
  requests: number;
}
export interface VoiceTopics {
  top_topics: TopicCount[];
  new_topics: TopicCount[];
  trending_topics: TopicCount[];
}
export const getVoiceTopics = () => fetchVoice<VoiceTopics>("topics", "voice topics");

export interface VoiceModelUsage {
  model_used: string;
  requests: number;
  average_latency_ms: number | null;
}
export const getVoiceModels = () => fetchVoice<VoiceModelUsage[]>("models", "voice models");

export interface PerformanceAnalytics {
  average_latency_ms: number | null;
  average_first_audio_ms: number | null;
  average_end_to_end_latency_ms: number | null;
  cpu_usage_percent: number | null;
  memory_usage_percent: number | null;
  gpu_usage_percent: string | null;
}
export const getVoicePerformance = () => fetchVoice<PerformanceAnalytics>("performance", "voice performance");

export interface ErrorAnalytics {
  total_requests: number;
  error_count: number;
  error_breakdown: LabeledCount[];
  timeout_count: number;
  retry_rate: number | null;
  interrupt_rate: number | null;
  cancel_rate: number | null;
}
export const getVoiceErrors = () => fetchVoice<ErrorAnalytics>("errors", "voice errors");

export interface ConversationQuality {
  conversation_completion_rate: number | null;
  barge_in_rate: number | null;
  repeat_rate: number | null;
  escalation_rate: number | null;
  positive_feedback_count: number;
  negative_feedback_count: number;
  average_conversation_turns: number | null;
}
export const getConversationQuality = () => fetchVoice<ConversationQuality>("quality", "conversation quality");

// ------------------------------------------------------------------
// Voice Trace — per-turn pipeline spans + waterfall/timeline drill-in.
// Separate endpoint prefix (/voice-trace, not /voice-analytics) since this
// is per-record detail, not an aggregate section — own small fetch wrapper
// rather than overloading fetchVoice above.
// ------------------------------------------------------------------

async function fetchVoiceTrace<T>(path: string, label: string): Promise<T> {
  const res = await fetch(`${API_URL}/voice-trace/${path}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${label}: ${res.status}`);
  }
  return res.json();
}

export interface VoiceTraceSummary {
  trace_id: string;
  session_id: string;
  conversation_id: string | null;
  request_id: string | null;
  mode: "a" | "b";
  started_at: string;
  ended_at: string;
  total_duration_ms: number;
  stage_count: number;
  has_error: boolean;
}

export async function getVoiceTraces(opts?: { mode?: "a" | "b"; limit?: number }): Promise<VoiceTraceSummary[]> {
  const params = new URLSearchParams({ limit: String(opts?.limit ?? 50) });
  if (opts?.mode) params.set("mode", opts.mode);
  return fetchVoiceTrace<VoiceTraceSummary[]>(`traces?${params}`, "recent voice traces");
}

export interface TraceSpan {
  span_id: string;
  stage: string;
  sequence: number | null;
  timestamp: string;
  duration_ms: number | null;
  status: "ok" | "error" | "skipped";
  provider: string | null;
  model: string | null;
  error: string | null;
}

export interface TracePerformance {
  mic_start_ms: number | null;
  mic_stop_ms: number | null;
  voice_duration_ms: number | null;
  vad_time_ms: number | null;
  noise_suppression_time_ms: number | null;
  echo_cancellation_time_ms: number | null;
  agc_time_ms: number | null;
}

export interface VoiceTraceDetail {
  trace_id: string;
  session_id: string;
  conversation_id: string | null;
  request_id: string | null;
  mode: "a" | "b";
  spans: TraceSpan[];
  performance: TracePerformance;
}

export async function getVoiceTraceDetail(traceId: string): Promise<VoiceTraceDetail> {
  return fetchVoiceTrace<VoiceTraceDetail>(encodeURIComponent(traceId), `voice trace ${traceId}`);
}

// ------------------------------------------------------------------
// Model Management (§22 docs/dashboard-requirements.md) — Add Model,
// Active Models, Enable/Disable, Default Model, Test Model.
// ------------------------------------------------------------------

export type ModelProvider =
  | "lmstudio"
  | "ollama"
  | "gemini"
  | "openai"
  | "anthropic"
  | "openrouter"
  | "azure_openai"
  | "custom_openai_compatible";

export type ModelStatus = "active" | "inactive" | "maintenance" | "deprecated" | "experimental";

export interface ModelRegistryEntry {
  model_name: string;
  display_name: string;
  provider: ModelProvider;
  api_base_url: string;
  has_api_key: boolean;
  model_identifier: string;
  version: string | null;
  context_window: number | null;
  max_output_tokens: number | null;
  timeout_ms: number | null;
  supports_streaming: boolean;
  supports_vision: boolean;
  supports_function_calling: boolean;
  supports_json_mode: boolean;
  supports_embedding: boolean;
  status: ModelStatus;
  // Non-null when the backend's provider_health_sync poller (not an admin)
  // deactivated this row because its provider is currently cooling down.
  auto_deactivated_reason: "auth" | "quota" | "server_error" | "network" | string | null;
  created_at: string;
  updated_at: string;
}

export interface ModelRegistryCreateInput {
  model_name: string;
  display_name: string;
  provider: ModelProvider;
  api_base_url: string;
  api_key?: string | null;
  model_identifier: string;
  version?: string | null;
  context_window?: number | null;
  max_output_tokens?: number | null;
  timeout_ms?: number | null;
  supports_streaming?: boolean;
  supports_vision?: boolean;
  supports_function_calling?: boolean;
  supports_json_mode?: boolean;
  supports_embedding?: boolean;
  activate?: boolean;
}

export type ModelRegistryUpdateInput = Partial<Omit<ModelRegistryCreateInput, "model_name" | "activate">> & {
  status?: ModelStatus;
};

export async function getModelRegistry(): Promise<ModelRegistryEntry[]> {
  const res = await fetch(`${API_URL}/config/models`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch models: ${res.status}`);
  return res.json();
}

export async function createModelRegistryEntry(input: ModelRegistryCreateInput): Promise<ModelRegistryEntry> {
  const res = await fetch(`${API_URL}/config/models`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Failed to create model: ${res.status}`);
  }
  return res.json();
}

export async function updateModelRegistryEntry(
  modelName: string,
  input: ModelRegistryUpdateInput
): Promise<ModelRegistryEntry> {
  const res = await fetch(`${API_URL}/config/models/${encodeURIComponent(modelName)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Failed to update model: ${res.status}`);
  }
  return res.json();
}

export async function deleteModelRegistryEntry(modelName: string): Promise<void> {
  const res = await fetch(`${API_URL}/config/models/${encodeURIComponent(modelName)}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Failed to delete model: ${res.status}`);
  }
}

export interface ProbeResult {
  ok: boolean;
  status_code: number | null;
  latency_ms: number;
  message: string;
}

export async function testModelConnection(apiBaseUrl: string): Promise<ProbeResult> {
  const res = await fetch(`${API_URL}/config/models/test-connection`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_base_url: apiBaseUrl }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Failed to test connection: ${res.status}`);
  }
  return res.json();
}

export async function validateModelConfig(input: {
  provider: ModelProvider;
  api_base_url: string;
  api_key?: string | null;
  model_identifier: string;
}): Promise<ProbeResult> {
  const res = await fetch(`${API_URL}/config/models/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Failed to validate model: ${res.status}`);
  }
  return res.json();
}

export interface TestPromptResult {
  ok: boolean;
  response_text: string | null;
  latency_ms: number;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  health_status: "ok" | "error";
  error: string | null;
}

export async function testModelPrompt(modelName: string, prompt: string): Promise<TestPromptResult> {
  const res = await fetch(`${API_URL}/config/models/${encodeURIComponent(modelName)}/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Failed to test model: ${res.status}`);
  }
  return res.json();
}

export type ModelUseCase = "chat" | "voice" | "background_task" | "classification" | "coding";

export interface ModelDefaultEntry {
  use_case: ModelUseCase;
  model_name: string | null;
  display_name: string | null;
  provider: ModelProvider | null;
  model_identifier: string | null;
  updated_at: string | null;
}

export async function getModelDefaults(): Promise<ModelDefaultEntry[]> {
  const res = await fetch(`${API_URL}/config/model-defaults`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch model defaults: ${res.status}`);
  return res.json();
}

export async function setModelDefault(useCase: ModelUseCase, modelName: string): Promise<ModelDefaultEntry> {
  const res = await fetch(`${API_URL}/config/model-defaults/${encodeURIComponent(useCase)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model_name: modelName }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Failed to set default for ${useCase}: ${res.status}`);
  }
  return res.json();
}

// ------------------------------------------------------------------
// Pip server control — Settings page panel that shells out to
// bpjs-pending-bot-local's pipctl.sh (start/stop/restart the merged bot +
// Pip voice backend). Talks to THIS dashboard's own backend (port 8010),
// never directly to the process being controlled — see
// backend/app/routers/pip_server_control.py for why that separation matters.
// ------------------------------------------------------------------

export interface PipServerActionResult {
  ok: boolean;
  output: string;
}

export async function getPipServerStatus(): Promise<PipServerActionResult> {
  const res = await fetch(`${API_URL}/pip-server/status`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch pip server status: ${res.status}`);
  return res.json();
}

export async function startPipServer(port?: number): Promise<PipServerActionResult> {
  const res = await fetch(`${API_URL}/pip-server/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ port: port ?? null }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Failed to start pip server: ${res.status}`);
  }
  return res.json();
}

export async function stopPipServer(): Promise<PipServerActionResult> {
  const res = await fetch(`${API_URL}/pip-server/stop`, { method: "POST" });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Failed to stop pip server: ${res.status}`);
  }
  return res.json();
}

export async function restartPipServer(): Promise<PipServerActionResult> {
  const res = await fetch(`${API_URL}/pip-server/restart`, { method: "POST" });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Failed to restart pip server: ${res.status}`);
  }
  return res.json();
}

export async function getPipServerLogs(lines = 150): Promise<PipServerActionResult> {
  const res = await fetch(`${API_URL}/pip-server/logs?lines=${lines}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch pip server logs: ${res.status}`);
  return res.json();
}

// ------------------------------------------------------------------
// "Pip Mobile App" page — local dev tooling for one or more native/KMP
// mobile projects on this machine, each a registered "app" (see
// MobileDevtoolsApp in backend/app/models.py — starts seeded with just
// "pip", more are added from the page's "+ Add App" form). See
// backend/app/routers/mobile_devtools.py for the subprocess calls each
// per-app action proxies to (open Xcode/Android Studio, list emulators,
// build+run, clear cache). Local-dev only, same as the Server panel above.
// ------------------------------------------------------------------

export interface MobileDevtoolsActionResult {
  ok: boolean;
  output: string;
}

export interface MobileApp {
  id: string;
  name: string;
  android_project_dir: string | null;
  android_application_id: string | null;
  android_launcher_activity: string | null;
  ios_project_path: string | null;
  ios_scheme: string | null;
  ios_bundle_id: string | null;
}

export type MobileAppInput = Omit<MobileApp, "id">;

export interface AndroidDevice {
  id: string;
  state: string;
}

export interface IosSimulator {
  udid: string;
  name: string;
  state: string;
  runtime: string;
}

export interface MobileEmulators {
  android_avds: string[];
  android_devices: AndroidDevice[];
  ios_simulators: IosSimulator[];
}

export interface MobileCapabilities {
  android_studio_installed: boolean;
  android_sdk_available: boolean;
}

async function postDevtools(path: string, body?: unknown): Promise<MobileDevtoolsActionResult> {
  const res = await fetch(`${API_URL}/mobile-devtools/${path}`, {
    method: "POST",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export async function getMobileApps(): Promise<MobileApp[]> {
  const res = await fetch(`${API_URL}/mobile-devtools/apps`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to list apps: ${res.status}`);
  return res.json();
}

export async function createMobileApp(input: MobileAppInput): Promise<MobileApp> {
  const res = await fetch(`${API_URL}/mobile-devtools/apps`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? `Failed to create app: ${res.status}`);
  }
  return res.json();
}

export async function deleteMobileApp(appId: string): Promise<void> {
  const res = await fetch(`${API_URL}/mobile-devtools/apps/${appId}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? `Failed to delete app: ${res.status}`);
  }
}

export async function openXcode(appId: string): Promise<MobileDevtoolsActionResult> {
  return postDevtools(`apps/${appId}/open-xcode`);
}

export async function openAndroidStudio(appId: string): Promise<MobileDevtoolsActionResult> {
  return postDevtools(`apps/${appId}/open-android-studio`);
}

export async function getMobileEmulators(): Promise<MobileEmulators> {
  const res = await fetch(`${API_URL}/mobile-devtools/emulators`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to list emulators: ${res.status}`);
  return res.json();
}

// Cheap machine-level tool detection (Android Studio.app, Android SDK
// binaries) — fetched once on page load so Android-specific UI (Open
// Android Studio button, AVD list) can hide/relabel itself before the user
// clicks anything, rather than only failing after the fact.
export async function getMobileCapabilities(): Promise<MobileCapabilities> {
  const res = await fetch(`${API_URL}/mobile-devtools/capabilities`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to check mobile devtools capabilities: ${res.status}`);
  return res.json();
}

export async function runAndroidApp(appId: string, target: { avd?: string; serial?: string } = {}): Promise<MobileDevtoolsActionResult> {
  return postDevtools(`apps/${appId}/run-android`, { avd: target.avd ?? null, serial: target.serial ?? null });
}

export async function runIosApp(appId: string, udid: string): Promise<MobileDevtoolsActionResult> {
  return postDevtools(`apps/${appId}/run-ios`, { udid });
}

export async function clearAndroidCache(appId: string): Promise<MobileDevtoolsActionResult> {
  return postDevtools(`apps/${appId}/clear-cache/android`);
}

export async function clearIosCache(appId: string): Promise<MobileDevtoolsActionResult> {
  return postDevtools(`apps/${appId}/clear-cache/ios`);
}

export interface BrowseEntry {
  name: string;
  path: string;
  is_project_bundle: boolean;
}

export interface BrowseResult {
  path: string;
  parent: string | null;
  entries: BrowseEntry[];
  // True when macOS blocked reading this folder (TCC privacy protection on
  // ~/Documents, ~/Desktop, etc.) — distinct from a genuinely empty folder,
  // which has this false with entries: [].
  permission_denied: boolean;
}

// Server-side directory listing, NOT a native browser file picker — see
// mobile_devtools.py's browse() docstring for why: a native picker can
// never return an absolute path, which is exactly what the Add App form's
// Browse buttons need to fill in.
export async function browseDirectory(path?: string): Promise<BrowseResult> {
  const url = path ? `${API_URL}/mobile-devtools/browse?path=${encodeURIComponent(path)}` : `${API_URL}/mobile-devtools/browse`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? `Failed to browse: ${res.status}`);
  }
  return res.json();
}
