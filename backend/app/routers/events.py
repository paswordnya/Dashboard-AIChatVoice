import secrets
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Security
from fastapi.security import APIKeyHeader
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import ConversationTopic, MessageTopic, RequestMetadata, Topic, UserDirectory

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def verify_api_key(api_key: Optional[str] = Security(api_key_header)) -> None:
    if api_key is None or not secrets.compare_digest(api_key, settings.events_api_key):
        raise HTTPException(status_code=401, detail="Invalid or missing X-API-Key")


router = APIRouter(prefix="/events", tags=["events"], dependencies=[Depends(verify_api_key)])

TELEGRAM_PLATFORM = "telegram"


class TopicIn(BaseModel):
    """One auto-detected topic for this message. `category` (e.g.
    "Programming", "Health") is only used the first time this topic name is
    seen — see `_upsert_topics`."""

    name: str
    category: Optional[str] = None


class RequestEventIn(BaseModel):
    """Ingestion contract for the real pip app / Telegram bot. Only
    request_id, session_id, model_used, provider, knowledge_source, and
    latency_ms are required — everything else defaults to null/false/0 when
    the caller doesn't have that data yet. Nothing here is ever fabricated
    server-side; a field the caller omits stays empty, it is never guessed."""

    request_id: Optional[str] = None
    session_id: str
    conversation_id: Optional[str] = None
    # Cross-link to voice_trace_spans.trace_id (Voice Trace feature) — null
    # for any turn the bot didn't instrument with a TraceRecorder (text/
    # chat requests, or a voice turn from before this field existed).
    trace_id: Optional[str] = None
    user_id: Optional[str] = None
    telegram_username: Optional[str] = None
    timestamp: Optional[datetime] = None

    model_used: str
    provider: str
    intent: Optional[str] = None
    category: Optional[str] = None
    query_text: Optional[str] = None
    topics: Optional[list[TopicIn]] = None
    route_fallback: bool = False
    manual_override: bool = False
    wrong_route: bool = False
    routing_confidence: Optional[float] = None
    escalation_steps: int = 0
    escalation_path: Optional[str] = None

    knowledge_source: str
    local_db_hit: bool = False
    memory_hit: bool = False
    rag_hit: bool = False
    cache_hit: bool = False
    grounding_used: bool = False
    web_search_used: bool = False
    tool_called: Optional[str] = None

    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: Optional[float] = None

    success: bool = True
    error_type: Optional[str] = None
    # No caller sends this today — bpjs-pending-bot-local has no feedback
    # capture mechanism (no inline keyboard, no callback_query handler) yet.
    # Field added so the ingestion contract is ready once that UI exists;
    # stays False (never guessed) until then.
    negative_feedback: bool = False

    latency_ms: float
    first_token_latency_ms: Optional[float] = None

    channel: str = "chat"
    platform: Optional[str] = None
    device: Optional[str] = None
    vad_time_ms: Optional[float] = None
    turn_detection_time_ms: Optional[float] = None
    stt_latency_ms: Optional[float] = None
    first_audio_latency_ms: Optional[float] = None
    tts_latency_ms: Optional[float] = None
    playback_latency_ms: Optional[float] = None
    interrupt_count: int = 0
    false_end_of_utterance: bool = False
    wake_word_detected: bool = False

    # Voice Analytics PRD (this session)
    language: Optional[str] = None
    stt_confidence: Optional[float] = None
    speech_duration_ms: Optional[float] = None
    speaking_speed_wpm: Optional[float] = None
    average_silence_ms: Optional[float] = None
    noise_level: Optional[float] = None
    retry: bool = False
    cancel: bool = False
    silence_timeout: bool = False
    completion_status: Optional[str] = None
    voice_provider: Optional[str] = None
    voice_used: Optional[str] = None


class RequestEventOut(BaseModel):
    request_id: str


def _upsert_user_directory(db: Session, event: RequestEventIn) -> None:
    """Keep the directory in sync with real traffic: a user_id seen for the
    first time gets added, tagged with the platform it arrived on. Existing
    entries (e.g. the sheet-sourced Telegram rows) are left untouched — this
    only fills gaps, it never overwrites a directory row that already exists."""
    if event.user_id is None:
        return

    if event.platform == TELEGRAM_PLATFORM and event.telegram_username:
        directory_id = event.telegram_username
    else:
        directory_id = event.user_id

    existing = db.get(UserDirectory, directory_id)
    if existing is not None:
        return

    db.add(
        UserDirectory(
            directory_id=directory_id,
            platform=event.platform or "unknown",
            telegram_username=event.telegram_username,
            user_id=event.user_id,
        )
    )


def _get_or_create_topic(db: Session, topic_in: TopicIn, now: datetime) -> Topic:
    """Case-insensitive lookup by name; insert if missing. `category` is only
    ever set here, at creation — a later sighting of the same topic name with
    a different suggested category does NOT overwrite it, matching "Master
    Topic... disimpan satu kali" (stored once)."""
    name = topic_in.name.strip()
    existing = db.execute(select(Topic).where(func.lower(Topic.name) == name.lower())).scalar_one_or_none()
    if existing is not None:
        return existing

    topic = Topic(name=name, category=topic_in.category, first_seen_at=now, created_at=now)
    db.add(topic)
    db.flush()  # need topic.id before linking message_topics/conversation_topics below
    return topic


def _upsert_topics(db: Session, event: "RequestEventIn", request_id: str, now: datetime) -> None:
    """Links every extracted topic to this message, and to the conversation
    it belongs to (if any) — creating each Topic the first time its name is
    seen, reusing it on every subsequent sighting (across all channels, since
    they all share this one table)."""
    if not event.topics:
        return

    for topic_in in event.topics:
        if not topic_in.name or not topic_in.name.strip():
            continue
        topic = _get_or_create_topic(db, topic_in, now)

        db.add(MessageTopic(request_id=request_id, topic_id=topic.id))

        if event.conversation_id:
            conv_topic = db.get(ConversationTopic, (event.conversation_id, topic.id))
            if conv_topic is None:
                db.add(
                    ConversationTopic(
                        conversation_id=event.conversation_id,
                        topic_id=topic.id,
                        first_linked_at=now,
                        last_linked_at=now,
                        request_count=1,
                    )
                )
            else:
                conv_topic.last_linked_at = now
                conv_topic.request_count += 1


@router.post("", response_model=RequestEventOut, status_code=201)
def create_event(event: RequestEventIn, db: Session = Depends(get_db)) -> RequestEventOut:
    """Real ingestion path for the pip app and Telegram bot — one row per
    AI request, written straight into request_metadata. This is what
    replaces scripts/seed.py's mock data once the actual systems exist."""
    request_id = event.request_id or str(uuid.uuid4())
    timestamp = event.timestamp or datetime.now(timezone.utc)

    existing = db.get(RequestMetadata, request_id)
    if existing is not None:
        return RequestEventOut(request_id=request_id)

    row = RequestMetadata(
        request_id=request_id,
        session_id=event.session_id,
        conversation_id=event.conversation_id,
        trace_id=event.trace_id,
        user_id=event.user_id,
        telegram_username=event.telegram_username,
        timestamp=timestamp,
        model_used=event.model_used,
        provider=event.provider,
        intent=event.intent,
        category=event.category,
        query_text=event.query_text,
        route_fallback=event.route_fallback,
        manual_override=event.manual_override,
        wrong_route=event.wrong_route,
        routing_confidence=event.routing_confidence,
        escalation_steps=event.escalation_steps,
        escalation_path=event.escalation_path,
        knowledge_source=event.knowledge_source,
        local_db_hit=event.local_db_hit,
        memory_hit=event.memory_hit,
        rag_hit=event.rag_hit,
        cache_hit=event.cache_hit,
        grounding_used=event.grounding_used,
        web_search_used=event.web_search_used,
        tool_called=event.tool_called,
        input_tokens=event.input_tokens,
        output_tokens=event.output_tokens,
        cost_usd=event.cost_usd,
        success=event.success,
        error_type=event.error_type,
        negative_feedback=event.negative_feedback,
        latency_ms=event.latency_ms,
        first_token_latency_ms=event.first_token_latency_ms,
        channel=event.channel,
        platform=event.platform,
        device=event.device,
        vad_time_ms=event.vad_time_ms,
        turn_detection_time_ms=event.turn_detection_time_ms,
        stt_latency_ms=event.stt_latency_ms,
        first_audio_latency_ms=event.first_audio_latency_ms,
        tts_latency_ms=event.tts_latency_ms,
        playback_latency_ms=event.playback_latency_ms,
        interrupt_count=event.interrupt_count,
        false_end_of_utterance=event.false_end_of_utterance,
        wake_word_detected=event.wake_word_detected,
        language=event.language,
        stt_confidence=event.stt_confidence,
        speech_duration_ms=event.speech_duration_ms,
        speaking_speed_wpm=event.speaking_speed_wpm,
        average_silence_ms=event.average_silence_ms,
        noise_level=event.noise_level,
        retry=event.retry,
        cancel=event.cancel,
        silence_timeout=event.silence_timeout,
        completion_status=event.completion_status,
        voice_provider=event.voice_provider,
        voice_used=event.voice_used,
    )
    db.add(row)
    db.flush()  # request_metadata row must exist before message_topics' FK to it below
    _upsert_user_directory(db, event)
    _upsert_topics(db, event, request_id, timestamp)
    db.commit()

    return RequestEventOut(request_id=request_id)


class RequestEventPatch(BaseModel):
    """Partial update for fields only known AFTER the initial /events POST —
    specifically Mode B voice's TTS/playback timing, which can't be known
    until the reply pipeline (LLM -> sentence buffer -> TTS -> playback)
    actually finishes, well after the row for this turn was created. Also
    used to record barge-in (completion_status='cancelled') and, later,
    negative_feedback once a client sends one. Every field is optional and
    only overwrites the row when explicitly provided (None means "don't
    touch this field", not "clear it")."""

    first_audio_latency_ms: Optional[float] = None
    tts_latency_ms: Optional[float] = None
    playback_latency_ms: Optional[float] = None
    completion_status: Optional[str] = None
    negative_feedback: Optional[bool] = None
    positive_feedback: Optional[bool] = None
    interrupt_count: Optional[int] = None


@router.patch("/{request_id}", response_model=RequestEventOut, dependencies=[Depends(verify_api_key)])
def update_event(request_id: str, patch: RequestEventPatch, db: Session = Depends(get_db)) -> RequestEventOut:
    row = db.get(RequestMetadata, request_id)
    if row is None:
        raise HTTPException(status_code=404, detail="request_id not found")

    for field, value in patch.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(row, field, value)
    db.commit()
    return RequestEventOut(request_id=request_id)
