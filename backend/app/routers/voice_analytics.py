from collections import Counter
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import MessageTopic, RequestMetadata, SystemMetrics, Topic

router = APIRouter(prefix="/voice-analytics", tags=["voice-analytics"])

VOICE_CHANNEL = "voice"


def _voice_rows(db: Session, start: Optional[datetime], end: Optional[datetime]) -> list[RequestMetadata]:
    """Shared row-fetch for every section below — one query, Python-side
    aggregation from there, same style as overview.py. Small dataset sizes
    in this project make round-tripping through SQL group-bys for every
    single stat more ceremony than it's worth; see categories.py/
    knowledge_source.py for the SQL-aggregate style used where the shape is
    a straightforward distribution instead."""
    query = select(RequestMetadata).where(RequestMetadata.channel == VOICE_CHANNEL)
    if start is not None:
        query = query.where(RequestMetadata.timestamp >= start)
    if end is not None:
        query = query.where(RequestMetadata.timestamp <= end)
    return list(db.execute(query).scalars().all())


def _avg(values: list[float]) -> Optional[float]:
    clean = [v for v in values if v is not None]
    return sum(clean) / len(clean) if clean else None


# ------------------------------------------------------------------
# §A Voice Overview
# ------------------------------------------------------------------


class VoiceOverview(BaseModel):
    total_voice_sessions: int
    active_voice_users: int
    total_voice_requests: int
    total_requests_all_channels: int
    average_session_duration_ms: Optional[float]
    average_conversation_turns: Optional[float]
    average_response_time_ms: Optional[float]
    average_time_to_first_audio_ms: Optional[float]
    voice_adoption_rate: Optional[float]


@router.get("/overview", response_model=VoiceOverview)
def get_voice_overview(
    start: Optional[datetime] = None, end: Optional[datetime] = None, db: Session = Depends(get_db)
) -> VoiceOverview:
    rows = _voice_rows(db, start, end)
    total_all = db.execute(select(func.count()).select_from(RequestMetadata)).scalar_one()

    if not rows:
        return VoiceOverview(
            total_voice_sessions=0, active_voice_users=0, total_voice_requests=0,
            total_requests_all_channels=total_all, average_session_duration_ms=None,
            average_conversation_turns=None, average_response_time_ms=None,
            average_time_to_first_audio_ms=None, voice_adoption_rate=(0.0 if total_all else None),
        )

    by_session: dict[str, list[RequestMetadata]] = {}
    for r in rows:
        by_session.setdefault(r.session_id, []).append(r)

    session_durations = []
    for turns in by_session.values():
        timestamps = [t.timestamp for t in turns]
        if len(timestamps) >= 2:
            session_durations.append((max(timestamps) - min(timestamps)).total_seconds() * 1000)

    return VoiceOverview(
        total_voice_sessions=len(by_session),
        active_voice_users=len({r.user_id for r in rows if r.user_id}),
        total_voice_requests=len(rows),
        total_requests_all_channels=total_all,
        average_session_duration_ms=_avg(session_durations),
        average_conversation_turns=len(rows) / len(by_session),
        average_response_time_ms=_avg([r.latency_ms for r in rows]),
        average_time_to_first_audio_ms=_avg([r.first_audio_latency_ms for r in rows]),
        voice_adoption_rate=(len(rows) / total_all) if total_all else None,
    )


# ------------------------------------------------------------------
# §B Voice Usage Analytics
# ------------------------------------------------------------------


class VoiceUsageTrendPoint(BaseModel):
    bucket: str
    requests: int


class VoiceUsage(BaseModel):
    total_voice_sessions: int
    voice_messages: int
    average_voice_duration_ms: Optional[float]
    longest_voice_session_ms: Optional[float]
    voice_per_user: Optional[float]
    peak_usage_hour: Optional[int]
    peak_usage_day: Optional[str]
    daily_trend: list[VoiceUsageTrendPoint]


@router.get("/usage", response_model=VoiceUsage)
def get_voice_usage(
    start: Optional[datetime] = None, end: Optional[datetime] = None, db: Session = Depends(get_db)
) -> VoiceUsage:
    rows = _voice_rows(db, start, end)
    if not rows:
        return VoiceUsage(
            total_voice_sessions=0, voice_messages=0, average_voice_duration_ms=None,
            longest_voice_session_ms=None, voice_per_user=None, peak_usage_hour=None,
            peak_usage_day=None, daily_trend=[],
        )

    by_session: dict[str, list[RequestMetadata]] = {}
    for r in rows:
        by_session.setdefault(r.session_id, []).append(r)
    durations = []
    for turns in by_session.values():
        timestamps = [t.timestamp for t in turns]
        if len(timestamps) >= 2:
            durations.append((max(timestamps) - min(timestamps)).total_seconds() * 1000)

    users = {r.user_id for r in rows if r.user_id}
    hour_counts = Counter(r.timestamp.hour for r in rows)
    day_counts = Counter(r.timestamp.strftime("%A") for r in rows)
    day_bucket_counts = Counter(r.timestamp.date().isoformat() for r in rows)

    return VoiceUsage(
        total_voice_sessions=len(by_session),
        voice_messages=len(rows),
        average_voice_duration_ms=_avg(durations),
        longest_voice_session_ms=max(durations) if durations else None,
        voice_per_user=(len(rows) / len(users)) if users else None,
        peak_usage_hour=hour_counts.most_common(1)[0][0] if hour_counts else None,
        peak_usage_day=day_counts.most_common(1)[0][0] if day_counts else None,
        daily_trend=[
            VoiceUsageTrendPoint(bucket=b, requests=c)
            for b, c in sorted(day_bucket_counts.items())
        ],
    )


# ------------------------------------------------------------------
# §C Voice Interaction Analytics
# ------------------------------------------------------------------


class VoiceInteraction(BaseModel):
    wake_word_count: int
    continue_conversation_count: int
    interrupt_count: int
    retry_count: int
    cancel_count: int
    manual_stop_count: int
    silence_timeout_count: int


@router.get("/interaction", response_model=VoiceInteraction)
def get_voice_interaction(
    start: Optional[datetime] = None, end: Optional[datetime] = None, db: Session = Depends(get_db)
) -> VoiceInteraction:
    """Push To Talk isn't included — this repo has no per-turn field
    recording whether a turn was PTT-triggered vs VAD-triggered (only the
    session-level listening_mode, in bpjs-pending-bot-local's own DB, not
    this one); would need a new field to report faithfully rather than
    guessed from what's here."""
    rows = _voice_rows(db, start, end)
    return VoiceInteraction(
        wake_word_count=sum(1 for r in rows if r.wake_word_detected),
        continue_conversation_count=sum(1 for r in rows if r.intent == "continue_speaking"),
        interrupt_count=sum(1 for r in rows if r.intent == "interrupt") + sum(r.interrupt_count for r in rows),
        retry_count=sum(1 for r in rows if r.retry),
        cancel_count=sum(1 for r in rows if r.cancel),
        manual_stop_count=sum(1 for r in rows if r.intent == "stop_response"),
        silence_timeout_count=sum(1 for r in rows if r.silence_timeout),
    )


# ------------------------------------------------------------------
# §D Speech Analytics
# ------------------------------------------------------------------


class SpeechAnalytics(BaseModel):
    average_speech_duration_ms: Optional[float]
    longest_speech_ms: Optional[float]
    average_words: Optional[float]
    average_speaking_speed_wpm: Optional[float]
    average_silence_ms: Optional[float]
    average_noise_level: Optional[float]
    average_speech_confidence: Optional[float]


@router.get("/speech", response_model=SpeechAnalytics)
def get_speech_analytics(
    start: Optional[datetime] = None, end: Optional[datetime] = None, db: Session = Depends(get_db)
) -> SpeechAnalytics:
    rows = _voice_rows(db, start, end)
    durations = [r.speech_duration_ms for r in rows if r.speech_duration_ms is not None]
    words = [
        r.speaking_speed_wpm * (r.speech_duration_ms / 60000)
        for r in rows if r.speaking_speed_wpm is not None and r.speech_duration_ms
    ]
    return SpeechAnalytics(
        average_speech_duration_ms=_avg(durations),
        longest_speech_ms=max(durations) if durations else None,
        average_words=_avg(words),
        average_speaking_speed_wpm=_avg([r.speaking_speed_wpm for r in rows]),
        average_silence_ms=_avg([r.average_silence_ms for r in rows]),
        average_noise_level=_avg([r.noise_level for r in rows]),
        average_speech_confidence=_avg([r.stt_confidence for r in rows]),
    )


# ------------------------------------------------------------------
# §E STT Analytics
# ------------------------------------------------------------------


class STTAnalytics(BaseModel):
    stt_requests: int
    stt_success_rate: Optional[float]
    stt_failure_rate: Optional[float]
    average_stt_latency_ms: Optional[float]
    average_recognition_confidence: Optional[float]
    language_breakdown: dict[str, int]


@router.get("/stt", response_model=STTAnalytics)
def get_stt_analytics(
    start: Optional[datetime] = None, end: Optional[datetime] = None, db: Session = Depends(get_db)
) -> STTAnalytics:
    """STT-specific success/failure isn't separately tracked from overall
    turn success (error_type doesn't distinguish "STT failed" from "LLM
    failed" — see mode_b_pipeline.py's error_type values) — success_rate
    here is a proxy (turns that produced any transcribed text at all count
    as an STT success), not a true per-stage STT failure rate."""
    rows = [r for r in _voice_rows(db, start, end) if r.stt_confidence is not None or r.language is not None]
    total = len(rows)
    if total == 0:
        return STTAnalytics(
            stt_requests=0, stt_success_rate=None, stt_failure_rate=None,
            average_stt_latency_ms=None, average_recognition_confidence=None, language_breakdown={},
        )
    successes = sum(1 for r in rows if r.success)
    return STTAnalytics(
        stt_requests=total,
        stt_success_rate=successes / total,
        stt_failure_rate=(total - successes) / total,
        average_stt_latency_ms=_avg([r.stt_latency_ms for r in rows]),
        average_recognition_confidence=_avg([r.stt_confidence for r in rows]),
        language_breakdown=dict(Counter(r.language for r in rows if r.language)),
    )


# ------------------------------------------------------------------
# §F TTS Analytics
# ------------------------------------------------------------------


class TTSAnalytics(BaseModel):
    tts_requests: int
    average_tts_latency_ms: Optional[float]
    average_playback_duration_ms: Optional[float]
    playback_interrupted_count: int
    voice_provider_breakdown: dict[str, int]
    voice_used_breakdown: dict[str, int]


@router.get("/tts", response_model=TTSAnalytics)
def get_tts_analytics(
    start: Optional[datetime] = None, end: Optional[datetime] = None, db: Session = Depends(get_db)
) -> TTSAnalytics:
    rows = [r for r in _voice_rows(db, start, end) if r.tts_latency_ms is not None or r.voice_provider is not None]
    return TTSAnalytics(
        tts_requests=len(rows),
        average_tts_latency_ms=_avg([r.tts_latency_ms for r in rows]),
        average_playback_duration_ms=_avg([r.playback_latency_ms for r in rows]),
        playback_interrupted_count=sum(1 for r in rows if r.completion_status == "cancelled"),
        voice_provider_breakdown=dict(Counter(r.voice_provider for r in rows if r.voice_provider)),
        voice_used_breakdown=dict(Counter(r.voice_used for r in rows if r.voice_used)),
    )


# ------------------------------------------------------------------
# §G AI Response Analytics
# ------------------------------------------------------------------


class ModelBreakdown(BaseModel):
    model_used: str
    requests: int


class AIResponseAnalytics(BaseModel):
    average_time_to_first_token_ms: Optional[float]
    average_time_to_first_audio_ms: Optional[float]
    average_full_response_time_ms: Optional[float]
    total_tokens_generated: int
    model_breakdown: list[ModelBreakdown]
    provider_breakdown: list[ModelBreakdown]
    knowledge_source_breakdown: list[ModelBreakdown]


@router.get("/ai-response", response_model=AIResponseAnalytics)
def get_ai_response_analytics(
    start: Optional[datetime] = None, end: Optional[datetime] = None, db: Session = Depends(get_db)
) -> AIResponseAnalytics:
    rows = _voice_rows(db, start, end)
    return AIResponseAnalytics(
        average_time_to_first_token_ms=_avg([r.first_token_latency_ms for r in rows]),
        average_time_to_first_audio_ms=_avg([r.first_audio_latency_ms for r in rows]),
        average_full_response_time_ms=_avg([r.latency_ms for r in rows]),
        total_tokens_generated=sum(r.output_tokens for r in rows),
        model_breakdown=[
            ModelBreakdown(model_used=k, requests=v) for k, v in Counter(r.model_used for r in rows).most_common()
        ],
        provider_breakdown=[
            ModelBreakdown(model_used=k, requests=v) for k, v in Counter(r.provider for r in rows).most_common()
        ],
        knowledge_source_breakdown=[
            ModelBreakdown(model_used=k, requests=v)
            for k, v in Counter(r.knowledge_source for r in rows).most_common()
        ],
    )


# ------------------------------------------------------------------
# §H/I Intent & Category Analytics (voice-scoped) — same underlying
# RequestMetadata.category/.intent as categories.py, filtered to
# channel='voice' and duplicated here rather than shared, per this
# page's "standalone" scope decision (see plan).
# ------------------------------------------------------------------


class LabeledCount(BaseModel):
    label: str
    requests: int


@router.get("/intents", response_model=list[LabeledCount])
def get_voice_intents(
    start: Optional[datetime] = None, end: Optional[datetime] = None, db: Session = Depends(get_db)
) -> list[LabeledCount]:
    rows = _voice_rows(db, start, end)
    return [
        LabeledCount(label=k, requests=v) for k, v in Counter(r.intent for r in rows if r.intent).most_common()
    ]


@router.get("/categories", response_model=list[LabeledCount])
def get_voice_categories(
    start: Optional[datetime] = None, end: Optional[datetime] = None, db: Session = Depends(get_db)
) -> list[LabeledCount]:
    rows = _voice_rows(db, start, end)
    return [
        LabeledCount(label=k, requests=v) for k, v in Counter(r.category for r in rows if r.category).most_common()
    ]


# ------------------------------------------------------------------
# §J Topic Analytics (voice-scoped)
# ------------------------------------------------------------------


class TopicCount(BaseModel):
    topic: str
    category: Optional[str]
    requests: int


class VoiceTopics(BaseModel):
    top_topics: list[TopicCount]
    new_topics: list[TopicCount]
    trending_topics: list[TopicCount]


@router.get("/topics", response_model=VoiceTopics)
def get_voice_topics(
    start: Optional[datetime] = None, end: Optional[datetime] = None,
    new_since_days: int = Query(7, ge=1, le=90), db: Session = Depends(get_db),
) -> VoiceTopics:
    """"Trending" here is the simplest honest definition available from
    this data: same top_topics ranking, since there's no historical
    snapshot to diff against for a real week-over-week growth rate (that
    would need a second query with its own date window, and this dataset
    doesn't have enough volume yet to make that meaningful) — flagged
    rather than faked."""
    query = (
        select(Topic.name, Topic.category, func.count(RequestMetadata.request_id).label("requests"))
        .join(MessageTopic, MessageTopic.topic_id == Topic.id)
        .join(RequestMetadata, RequestMetadata.request_id == MessageTopic.request_id)
        .where(RequestMetadata.channel == VOICE_CHANNEL)
    )
    if start is not None:
        query = query.where(RequestMetadata.timestamp >= start)
    if end is not None:
        query = query.where(RequestMetadata.timestamp <= end)
    query = query.group_by(Topic.name, Topic.category).order_by(func.count(RequestMetadata.request_id).desc())
    rows = db.execute(query).all()
    top = [TopicCount(topic=r.name, category=r.category, requests=r.requests) for r in rows]

    new_topics_query = select(Topic.name, Topic.category).where(
        Topic.first_seen_at >= func.now() - func.make_interval(0, 0, 0, new_since_days)
    )
    new_names = {r.name for r in db.execute(new_topics_query).all()}
    new_topics = [t for t in top if t.topic in new_names]

    return VoiceTopics(top_topics=top[:20], new_topics=new_topics[:20], trending_topics=top[:10])


# ------------------------------------------------------------------
# §K Knowledge Analytics (voice-scoped)
# ------------------------------------------------------------------


@router.get("/knowledge", response_model=list[LabeledCount])
def get_voice_knowledge(
    start: Optional[datetime] = None, end: Optional[datetime] = None, db: Session = Depends(get_db)
) -> list[LabeledCount]:
    rows = _voice_rows(db, start, end)
    return [
        LabeledCount(label=k, requests=v)
        for k, v in Counter(r.knowledge_source for r in rows if r.knowledge_source).most_common()
    ]


# ------------------------------------------------------------------
# §L Model Analytics (voice-scoped)
# ------------------------------------------------------------------


class VoiceModelUsage(BaseModel):
    model_used: str
    requests: int
    average_latency_ms: Optional[float]


@router.get("/models", response_model=list[VoiceModelUsage])
def get_voice_models(
    start: Optional[datetime] = None, end: Optional[datetime] = None, db: Session = Depends(get_db)
) -> list[VoiceModelUsage]:
    rows = _voice_rows(db, start, end)
    by_model: dict[str, list[RequestMetadata]] = {}
    for r in rows:
        by_model.setdefault(r.model_used, []).append(r)
    result = [
        VoiceModelUsage(model_used=model, requests=len(turns), average_latency_ms=_avg([t.latency_ms for t in turns]))
        for model, turns in by_model.items()
    ]
    return sorted(result, key=lambda m: m.requests, reverse=True)


# ------------------------------------------------------------------
# §M Performance Analytics
# ------------------------------------------------------------------


class PerformanceAnalytics(BaseModel):
    average_latency_ms: Optional[float]
    average_first_audio_ms: Optional[float]
    average_end_to_end_latency_ms: Optional[float]
    cpu_usage_percent: Optional[float]
    memory_usage_percent: Optional[float]
    gpu_usage_percent: Optional[str]


@router.get("/performance", response_model=PerformanceAnalytics)
def get_performance_analytics(
    start: Optional[datetime] = None, end: Optional[datetime] = None, db: Session = Depends(get_db)
) -> PerformanceAnalytics:
    rows = _voice_rows(db, start, end)
    latest_system = db.execute(select(SystemMetrics).order_by(SystemMetrics.timestamp.desc())).scalars().first()
    return PerformanceAnalytics(
        average_latency_ms=_avg([r.latency_ms for r in rows]),
        average_first_audio_ms=_avg([r.first_audio_latency_ms for r in rows]),
        average_end_to_end_latency_ms=_avg([r.latency_ms for r in rows]),
        cpu_usage_percent=latest_system.cpu_percent if latest_system else None,
        memory_usage_percent=latest_system.memory_percent if latest_system else None,
        # Not "0%" — this deployment is CPU-only by design (see
        # bpjs-pending-bot-local/config.py's STT_COMPUTE_TYPE comment), a
        # GPU Usage number would be fabricated. Frontend renders this
        # string as-is rather than treating it as a metric.
        gpu_usage_percent="N/A — CPU-only deployment",
    )


# ------------------------------------------------------------------
# §N Error Analytics
# ------------------------------------------------------------------


class ErrorAnalytics(BaseModel):
    total_requests: int
    error_count: int
    error_breakdown: list[LabeledCount]
    timeout_count: int
    retry_rate: Optional[float]
    interrupt_rate: Optional[float]
    cancel_rate: Optional[float]


@router.get("/errors", response_model=ErrorAnalytics)
def get_voice_errors(
    start: Optional[datetime] = None, end: Optional[datetime] = None, db: Session = Depends(get_db)
) -> ErrorAnalytics:
    """error_type isn't broken out per-stage (STT/TTS/streaming/decode) —
    see mode_b_pipeline.py's error_type values (currently just
    "model_failure"/"search_failed") — error_breakdown reflects whatever
    granularity actually gets reported today, not the PRD's full stage
    list; sections without real data (Audio Decode Error, Network Error
    specifically) will just show 0 until that granularity is added."""
    rows = _voice_rows(db, start, end)
    total = len(rows)
    if total == 0:
        return ErrorAnalytics(
            total_requests=0, error_count=0, error_breakdown=[], timeout_count=0,
            retry_rate=None, interrupt_rate=None, cancel_rate=None,
        )
    errors = [r for r in rows if not r.success]
    return ErrorAnalytics(
        total_requests=total,
        error_count=len(errors),
        error_breakdown=[
            LabeledCount(label=k, requests=v) for k, v in Counter(r.error_type for r in errors if r.error_type).most_common()
        ],
        timeout_count=sum(1 for r in errors if r.error_type == "timeout"),
        retry_rate=sum(1 for r in rows if r.retry) / total,
        interrupt_rate=sum(1 for r in rows if r.intent == "interrupt") / total,
        cancel_rate=sum(1 for r in rows if r.cancel) / total,
    )


# ------------------------------------------------------------------
# §O Conversation Quality Analytics
# ------------------------------------------------------------------


class ConversationQuality(BaseModel):
    conversation_completion_rate: Optional[float]
    barge_in_rate: Optional[float]
    repeat_rate: Optional[float]
    escalation_rate: Optional[float]
    positive_feedback_count: int
    negative_feedback_count: int
    average_conversation_turns: Optional[float]


@router.get("/quality", response_model=ConversationQuality)
def get_conversation_quality(
    start: Optional[datetime] = None, end: Optional[datetime] = None, db: Session = Depends(get_db)
) -> ConversationQuality:
    """clarification_rate (PRD "AI meminta klarifikasi") has no field —
    nothing in the bot currently detects/reports "the assistant asked a
    clarifying question" as a distinct event, so it's omitted here rather
    than estimated."""
    rows = _voice_rows(db, start, end)
    total = len(rows)
    if total == 0:
        return ConversationQuality(
            conversation_completion_rate=None, barge_in_rate=None, repeat_rate=None,
            escalation_rate=None, positive_feedback_count=0, negative_feedback_count=0,
            average_conversation_turns=None,
        )
    by_session: dict[str, list[RequestMetadata]] = {}
    for r in rows:
        by_session.setdefault(r.session_id, []).append(r)
    completed = sum(1 for r in rows if r.completion_status == "completed")
    return ConversationQuality(
        conversation_completion_rate=completed / total,
        barge_in_rate=sum(1 for r in rows if r.intent == "interrupt") / total,
        repeat_rate=sum(1 for r in rows if r.retry) / total,
        escalation_rate=sum(1 for r in rows if r.escalation_steps > 0) / total,
        positive_feedback_count=sum(1 for r in rows if r.positive_feedback),
        negative_feedback_count=sum(1 for r in rows if r.negative_feedback),
        average_conversation_turns=total / len(by_session),
    )
