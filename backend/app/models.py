from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class RequestMetadata(Base):
    """One row per AI request. Schema follows docs/dashboard-requirements.md
    §"Request Metadata", extended with fields the other 20 dashboard
    sections need (voice-turn timing, routing, errors, filters).
    """

    __tablename__ = "request_metadata"

    request_id: Mapped[str] = mapped_column(String, primary_key=True)
    session_id: Mapped[str] = mapped_column(String, index=True)
    conversation_id: Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)
    # Cross-link to voice_trace_spans.trace_id (== the bot's turn_id, not a
    # separate FK-enforced relationship — spans and this row are written by
    # two different ingestion paths that don't share a transaction). Added
    # after this table already existed in deployed DBs, so `create_all`
    # (scripts/migrate.py, non-destructive) won't backfill it — see that
    # script's docstring; a manual `ALTER TABLE request_metadata ADD COLUMN
    # trace_id VARCHAR NULL` was run against the live DB for this column.
    trace_id: Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)
    user_id: Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)
    telegram_username: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)

    # Routing / model (§2 Model Usage, §9 Router Analytics, PRD §14 Voice Routing)
    model_used: Mapped[str] = mapped_column(String, index=True)
    provider: Mapped[str] = mapped_column(String, index=True)  # lmstudio | gemini | openai | claude | ollama
    intent: Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)
    category: Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)
    route_fallback: Mapped[bool] = mapped_column(Boolean, default=False)
    manual_override: Mapped[bool] = mapped_column(Boolean, default=False)
    wrong_route: Mapped[bool] = mapped_column(Boolean, default=False)
    routing_confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # intent/routing confidence, 0-1
    escalation_steps: Mapped[int] = mapped_column(Integer, default=0)  # 0 = first-choice model answered directly
    escalation_path: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # e.g. "Gemma-4-E4B → Gemma-4-26B → gemini-flash"

    # Knowledge source (§13 Knowledge Source Analytics)
    knowledge_source: Mapped[str] = mapped_column(String, index=True)  # local_db | memory | cache | rag | grounding | web_search | llm_only
    local_db_hit: Mapped[bool] = mapped_column(Boolean, default=False)
    memory_hit: Mapped[bool] = mapped_column(Boolean, default=False)
    rag_hit: Mapped[bool] = mapped_column(Boolean, default=False)
    cache_hit: Mapped[bool] = mapped_column(Boolean, default=False)
    grounding_used: Mapped[bool] = mapped_column(Boolean, default=False)
    web_search_used: Mapped[bool] = mapped_column(Boolean, default=False)
    tool_called: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Tokens / cost (§14 Token Analytics, §8 Cloud Analytics)
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    cost_usd: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Outcome (§1 Overview, §17 Error Analytics)
    success: Mapped[bool] = mapped_column(Boolean, default=True)
    error_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # timeout | tool_failure | model_failure | invalid_response | parsing_error | api_error | hallucination
    negative_feedback: Mapped[bool] = mapped_column(Boolean, default=False)  # explicit thumbs-down, distinct from success
    positive_feedback: Mapped[bool] = mapped_column(Boolean, default=False)  # explicit thumbs-up (PRD Voice Analytics §O wants both, not just negative)

    # Raw query text — for Knowledge Gap / Top Failed Questions analytics.
    # Real user text, not a category/intent proxy: treat as sensitive, same
    # care as any other free-text user input (PII may appear in it).
    query_text: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Latency (§15 Performance Analytics, PRD §15 Monitoring & Observability)
    latency_ms: Mapped[float] = mapped_column(Float)
    first_token_latency_ms: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Voice-turn specific, null for text/chat requests (§16 Voice Analytics, PRD §6/§10/§11/§15)
    channel: Mapped[str] = mapped_column(String, default="chat")  # chat | voice
    platform: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    device: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    vad_time_ms: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    turn_detection_time_ms: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    stt_latency_ms: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    first_audio_latency_ms: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    tts_latency_ms: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    playback_latency_ms: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    interrupt_count: Mapped[int] = mapped_column(Integer, default=0)
    false_end_of_utterance: Mapped[bool] = mapped_column(Boolean, default=False)
    wake_word_detected: Mapped[bool] = mapped_column(Boolean, default=False)

    # Voice Analytics PRD (this session) — §E STT language, §D speech-level
    # audio metrics, §C interaction flags, §O conversation quality, §F TTS
    # provider/voice identity. All nullable/defaulted the same way as the
    # block above: null/False until the bot side actually sends a value,
    # never fabricated server-side.
    # Originally voice-only (faster-whisper's own ASR-detected language, via
    # asr_engine.py — still the more authoritative source for voice turns).
    # Also populated for text channels (Telegram CHAT, Pip app Chat) since
    # bpjs-pending-bot-local's language_classifier.py — an LLM classification
    # of the message text into Indonesian ("id") / English ("en") / a named
    # Indonesian regional language slug (e.g. "jawa", "sunda", "minang") —
    # there being no ASR step to detect it from on those channels. Same
    # column either way: one "detected language of this request" attribute,
    # just sourced differently per channel.
    language: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    stt_confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # ASR confidence, distinct from routing_confidence
    speech_duration_ms: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    speaking_speed_wpm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    average_silence_ms: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    noise_level: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # RMS-based proxy, not calibrated dB SPL
    retry: Mapped[bool] = mapped_column(Boolean, default=False)
    cancel: Mapped[bool] = mapped_column(Boolean, default=False)
    silence_timeout: Mapped[bool] = mapped_column(Boolean, default=False)
    completion_status: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # completed | cancelled | timeout | error
    voice_provider: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    voice_used: Mapped[Optional[str]] = mapped_column(String, nullable=True)


class SystemMetrics(Base):
    """Periodic CPU/memory snapshot of the bpjs-pending-bot-local host
    process (system_metrics.py, ~30s interval) — not request-scoped, so it
    doesn't fit RequestMetadata's one-row-per-turn shape. GPU is
    deliberately absent: config.py documents that repo as CPU-only by
    design (int8 STT/TTS), so a GPU Usage number would be fabricated."""

    __tablename__ = "system_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    cpu_percent: Mapped[float] = mapped_column(Float)
    memory_percent: Mapped[float] = mapped_column(Float)
    memory_used_mb: Mapped[float] = mapped_column(Float)


class VoiceTraceSpan(Base):
    """One row per pipeline-stage event within a single voice turn (Voice
    Trace feature). `trace_id` == the bot's `turn_id` (the identifier
    already generated at VAD onset / first Gemini transcript, spanning the
    whole turn — this feature deliberately reuses it rather than minting a
    3rd per-turn UUID alongside `turn_id`/`request_id`).

    Unlike RequestMetadata (one wide row per turn), a turn has MANY spans —
    `sequence` is non-null for the 12 T0-T12 timeline stages (ordered,
    what the waterfall/timeline UI renders) and NULL for DSP/mic-lifecycle
    rows (`aec`/`agc`/`noise_suppression`/`mic_start`/`mic_stop`) that feed
    the Performance Metrics panel instead of the linear timeline.

    Ingested via POST /voice-trace/spans, fire-and-forget from the bot side
    (same discipline as every other analytics_events.* call there) — no
    retry, so no idempotency/dedup logic here (a lost batch is a turn with
    no trace, same failure mode as a missed report_event_async call)."""

    __tablename__ = "voice_trace_spans"
    __table_args__ = (Index("ix_voice_trace_spans_trace_id_sequence", "trace_id", "sequence"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    trace_id: Mapped[str] = mapped_column(String, index=True)
    span_id: Mapped[str] = mapped_column(String)
    request_id: Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)
    session_id: Mapped[str] = mapped_column(String, index=True)
    conversation_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    mode: Mapped[str] = mapped_column(String)  # "a" | "b" — set once per batch by the bot, not inferred
    stage: Mapped[str] = mapped_column(String, index=True)
    # Non-null 0-12 for the T0-T12 timeline; NULL for DSP/mic-lifecycle
    # entries (aec/agc/noise_suppression/mic_start/mic_stop) — these are
    # deliberately excluded from timeline ordering, see class docstring.
    sequence: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    duration_ms: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String, default="ok")  # ok | error | skipped
    provider: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    model: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    error: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))  # ingestion time, distinct from `timestamp`


class UserDirectory(Base):
    """Authoritative user list, sourced externally per platform (the
    Telegram 'config' sheet for platform='telegram'; a future app-user
    source for ios/android/web) — not derived from request_metadata. A row
    here with no matching user_id, or a user_id with no request_metadata
    rows, is a real user who simply has no activity yet; they must still
    show up, with blank stats, rather than being dropped. `platform` records
    which source synced this row in, so it's known without inferring from
    activity."""

    __tablename__ = "user_directory"

    directory_id: Mapped[str] = mapped_column(String, primary_key=True)
    platform: Mapped[str] = mapped_column(String, index=True)  # telegram | ios | android | web
    telegram_username: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    user_id: Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)


class IntentConfig(Base):
    """AI Router configuration per intent (PRD §14 Voice Routing) — which
    models handle an intent, in priority order, whether the route is
    active, its priority when multiple rules could match, and the
    confidence floor to trigger it. Editable from the dashboard's Config
    page; this is live configuration, not analytics — never wiped by
    reseeding.

    Actually consumed by bpjs-pending-bot-local's voice_router.py (a
    separate project — see this project's CLAUDE.md) as an override layer
    on top of that repo's voice_routes.yaml: when a row exists here and is
    enabled, `chain` becomes the intent's ENTIRE routing chain (every tier,
    not just primary+first-fallback) — voice_routes.yaml's own fallback
    list is only consulted for intents that have no row here at all. This
    replaced a fixed 2-column primary/fallback schema (see git history) —
    the fixed schema couldn't express more than one fallback tier from the
    dashboard, forcing voice_routes.yaml to always supply the deeper safety
    net even for fully-dashboard-managed intents.

    `chain` is a JSON array of {"provider": str, "model": str} objects,
    index 0 = primary — same shape as bpjs-pending-bot-local's
    ai_provider_routes.provider_chain (the chat-path equivalent, already
    N-tier) and voice_routes.yaml's own fallback entries, so all three
    routing configs speak the same (provider, model) vocabulary."""

    __tablename__ = "intent_config"

    intent: Mapped[str] = mapped_column(String, primary_key=True)
    chain: Mapped[list] = mapped_column(JSONB)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    priority: Mapped[int] = mapped_column(Integer, default=0)
    confidence_threshold: Mapped[float] = mapped_column(Float, default=0.5)
    max_latency_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # Server-side, deterministic safety disclaimer (e.g. for health_triage)
    # appended after a successful reply when true — never left to the model
    # to remember to include. See bpjs-pending-bot-local's voice_router.py.
    requires_rules_check: Mapped[bool] = mapped_column(Boolean, default=False)
    # Informational/routing label (e.g. "grounding") — for health_latest_info
    # specifically, voice_router.py special-cases dispatch away from this
    # table entirely, so this column is mostly for dashboard visibility.
    knowledge_source: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Topic(Base):
    """Auto-detected conversation subject (e.g. "SwiftUI", "Diabetes", "BPJS"),
    shared master data across Telegram/Chat/Voice — created once, reused on
    every subsequent sighting. `category` (e.g. "Programming", "Health") is a
    property of the Topic itself, set only when the topic is first created and
    never overwritten afterwards, matching how the extraction prompt assigns
    it (see bpjs-pending-bot-local's topic_classifier.py). Distinct from
    RequestMetadata.category, which is the AI-router routing-key
    (greeting/qna/health_symptom_mild/...), not a real subject taxonomy."""

    __tablename__ = "topics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, unique=True, index=True)
    category: Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ConversationTopic(Base):
    """Links a Topic to a conversation (RequestMetadata.conversation_id —
    str(user_id) for Telegram, session_id for Chat/Voice). `request_count`/
    `last_linked_at` let "related topics" and "active topics" queries avoid
    re-joining request_metadata just to count how often this pairing recurred."""

    __tablename__ = "conversation_topics"

    conversation_id: Mapped[str] = mapped_column(String, primary_key=True)
    topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id"), primary_key=True)
    first_linked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_linked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    request_count: Mapped[int] = mapped_column(Integer, default=0)


class ModelRegistry(Base):
    """AI Model Management console (docs/dashboard-requirements.md §22) —
    models an Administrator has registered from the Models > Add Model page.
    Distinct from RequestMetadata.model_used/provider (free-text, one row
    per completed request, write-only from the bot's side): this table is
    live configuration the AI Router is meant to consult before a request
    happens, and it's exactly what the dashboard reads/writes. Edits here
    take effect on the next request — no redeploy or process restart.

    api_key_encrypted is Fernet ciphertext (see app/security.py), never the
    raw key — encrypt on write, decrypt only inside the Test Connection /
    Validate / Test Model handlers that need to call the provider.
    """

    __tablename__ = "model_registry"

    model_name: Mapped[str] = mapped_column(String, primary_key=True)
    display_name: Mapped[str] = mapped_column(String)
    provider: Mapped[str] = mapped_column(String, index=True)  # lmstudio | ollama | gemini | openai | anthropic | openrouter | azure_openai | custom_openai_compatible
    api_base_url: Mapped[str] = mapped_column(String)
    api_key_encrypted: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    model_identifier: Mapped[str] = mapped_column(String)
    version: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    context_window: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    max_output_tokens: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    timeout_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    supports_streaming: Mapped[bool] = mapped_column(Boolean, default=False)
    supports_vision: Mapped[bool] = mapped_column(Boolean, default=False)
    supports_function_calling: Mapped[bool] = mapped_column(Boolean, default=False)
    supports_json_mode: Mapped[bool] = mapped_column(Boolean, default=False)
    supports_embedding: Mapped[bool] = mapped_column(Boolean, default=False)
    # active | inactive | maintenance | deprecated | experimental — only
    # "active" is eligible for AI Router selection (§7 Model Status).
    status: Mapped[str] = mapped_column(String, default="inactive")
    # Non-null only while app/services/provider_health_sync.py has this row
    # deactivated because its provider is currently cooling down on
    # bpjs-pending-bot-local's side ("auth"|"quota"|"server_error"|"network").
    # Kept separate from `status` so the next healthy poll reactivates only
    # the rows THIS sync put down, never a status an admin set by hand
    # (maintenance/deprecated/experimental, or a manual "inactive") — see
    # routers/model_registry.py's update_model, which clears this whenever a
    # human explicitly PATCHes `status`. Added after this table already
    # existed in deployed DBs — scripts/migrate_model_registry_health.py is
    # the manual ALTER TABLE for it, same convention as trace_id above.
    auto_deactivated_reason: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ModelDefaultAssignment(Base):
    """§14 Default Model — one active model_registry.model_name per use
    case. use_case is the primary key so setting a new default for "chat"
    simply overwrites the row rather than accumulating history (Version
    History for the model itself lives on ModelRegistry.updated_at, not
    here)."""

    __tablename__ = "model_default_assignment"

    use_case: Mapped[str] = mapped_column(String, primary_key=True)  # chat | voice | background_task | classification | coding
    model_name: Mapped[str] = mapped_column(ForeignKey("model_registry.model_name"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class MessageTopic(Base):
    """Links a Topic to one message (one RequestMetadata row). Many-to-many —
    a single message can surface more than one Topic (e.g. a message that
    touches both "SwiftUI" and "Navigation" gets two rows here, same request_id)."""

    __tablename__ = "message_topics"

    request_id: Mapped[str] = mapped_column(ForeignKey("request_metadata.request_id"), primary_key=True)
    topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id"), primary_key=True)


class MobileDevtoolsApp(Base):
    """One entry in the "Pip Mobile App" page's app list (app/routers/
    mobile_devtools.py) — each row is a different native/KMP mobile project
    on this machine (its own Android project dir / iOS .xcodeproj / bundle
    ids) that the Open Xcode/Android Studio, emulator list, run, and
    clear-cache panel can operate on. This table IS the registry — the
    router self-seeds a single 'pip' row (pointing at the pipvoice project)
    the first time GET /mobile-devtools/apps runs against an empty table;
    every other row comes from the dashboard's "+ Add App" form, not code.
    All the android_*/ios_* fields are nullable because an app might only
    have one platform configured — the corresponding action just returns
    a "not configured" result instead of erroring."""

    __tablename__ = "mobile_devtools_apps"

    id: Mapped[str] = mapped_column(String, primary_key=True)  # slug, e.g. "pip"
    name: Mapped[str] = mapped_column(String)
    android_project_dir: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    android_application_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    android_launcher_activity: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    ios_project_path: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    ios_scheme: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    ios_bundle_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
