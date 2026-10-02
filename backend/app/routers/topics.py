from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import ConversationTopic, MessageTopic, RequestMetadata, Topic

router = APIRouter(prefix="/topics", tags=["topics"])

ACTIVE_WINDOW_DAYS = 30


def _channel_bucket(platform: Optional[str], channel: Optional[str]) -> str:
    """Topic per Channel needs to distinguish Telegram/Chat/Voice (3 buckets),
    unlike users.py's channel_for() (telegram vs pip_app, 2 buckets) —
    platform=="telegram" always means the Telegram bot; everything else is
    the pip app, split further by channel ("voice" vs "chat")."""
    if platform == "telegram":
        return "telegram"
    return "voice" if channel == "voice" else "chat"


class ChannelCounts(BaseModel):
    telegram: int = 0
    chat: int = 0
    voice: int = 0


class TopicSummaryRow(BaseModel):
    id: int
    name: str
    category: Optional[str]
    total_requests: int
    channels: ChannelCounts
    first_seen: str
    last_seen: Optional[str]


class TopicsSummary(BaseModel):
    total_topics: int
    new_this_week: int
    active_topics: int
    topic_growth_percent: Optional[float]


class TopicModelBreakdown(BaseModel):
    topic: str
    model_used: str
    provider: str
    requests: int


class TopicChannelBreakdown(BaseModel):
    topic: str
    channels: ChannelCounts
    total_requests: int


class NewTopic(BaseModel):
    id: int
    name: str
    category: Optional[str]
    created: str  # "Today" | "Yesterday" | ISO date


class TimelinePoint(BaseModel):
    bucket: str
    requests: int


class RelatedTopic(BaseModel):
    id: int
    name: str
    co_occurrences: int


class IntentBreakdown(BaseModel):
    intent: str
    requests: int


class TopicDetail(BaseModel):
    id: int
    name: str
    category: Optional[str]
    total_requests: int
    avg_latency_ms: Optional[float]
    first_seen: str
    last_seen: Optional[str]
    channels: ChannelCounts
    models_used: list[TopicModelBreakdown]
    top_intents: list[IntentBreakdown]
    knowledge_source: list[dict]
    related_topics: list[RelatedTopic]
    trend: list[TimelinePoint]


def _topic_request_rows(db: Session, topic_ids: list[int]):
    """Every (topic_id, request_metadata row) pair for the given topics —
    the join every breakdown below is built from."""
    if not topic_ids:
        return []
    return db.execute(
        select(MessageTopic.topic_id, RequestMetadata)
        .join(RequestMetadata, RequestMetadata.request_id == MessageTopic.request_id)
        .where(MessageTopic.topic_id.in_(topic_ids))
    ).all()


@router.get("/summary", response_model=TopicsSummary)
def get_topics_summary(db: Session = Depends(get_db)) -> TopicsSummary:
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    two_weeks_ago = now - timedelta(days=14)
    active_since = now - timedelta(days=ACTIVE_WINDOW_DAYS)

    total_topics = db.execute(select(func.count(Topic.id))).scalar_one()

    new_this_week = db.execute(
        select(func.count(Topic.id)).where(Topic.first_seen_at >= week_ago)
    ).scalar_one()
    new_prior_week = db.execute(
        select(func.count(Topic.id)).where(Topic.first_seen_at >= two_weeks_ago, Topic.first_seen_at < week_ago)
    ).scalar_one()

    active_topics = db.execute(
        select(func.count(func.distinct(MessageTopic.topic_id)))
        .join(RequestMetadata, RequestMetadata.request_id == MessageTopic.request_id)
        .where(RequestMetadata.timestamp >= active_since)
    ).scalar_one()

    growth_percent = None
    if new_prior_week:
        growth_percent = (new_this_week - new_prior_week) / new_prior_week * 100

    return TopicsSummary(
        total_topics=total_topics,
        new_this_week=new_this_week,
        active_topics=active_topics,
        topic_growth_percent=growth_percent,
    )


@router.get("", response_model=list[TopicSummaryRow])
def get_topics(
    q: Optional[str] = Query(None, description="Search topic names (substring, case-insensitive)"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> list[TopicSummaryRow]:
    """Topic leaderboard, ranked by total requests. `q` doubles as the
    dashboard's Topic Search — no separate endpoint needed."""
    query = select(Topic)
    if q:
        query = query.where(Topic.name.ilike(f"%{q}%"))
    topics = db.execute(query).scalars().all()
    if not topics:
        return []

    topic_ids = [t.id for t in topics]
    pairs = _topic_request_rows(db, topic_ids)

    channels_by_topic: dict[int, ChannelCounts] = {t.id: ChannelCounts() for t in topics}
    last_seen_by_topic: dict[int, datetime] = {}
    for topic_id, rm in pairs:
        bucket = _channel_bucket(rm.platform, rm.channel)
        counts = channels_by_topic[topic_id]
        setattr(counts, bucket, getattr(counts, bucket) + 1)
        if topic_id not in last_seen_by_topic or rm.timestamp > last_seen_by_topic[topic_id]:
            last_seen_by_topic[topic_id] = rm.timestamp

    rows = [
        TopicSummaryRow(
            id=t.id,
            name=t.name,
            category=t.category,
            total_requests=sum(channels_by_topic[t.id].model_dump().values()),
            channels=channels_by_topic[t.id],
            first_seen=t.first_seen_at.isoformat(),
            last_seen=last_seen_by_topic.get(t.id).isoformat() if t.id in last_seen_by_topic else None,
        )
        for t in topics
    ]
    return sorted(rows, key=lambda r: r.total_requests, reverse=True)[:limit]


@router.get("/by-model", response_model=list[TopicModelBreakdown])
def get_topics_by_model(limit: int = Query(100, ge=1, le=500), db: Session = Depends(get_db)) -> list[TopicModelBreakdown]:
    """Topic × Model pivot (e.g. "SwiftUI" answered mostly by Qwen)."""
    rows = db.execute(
        select(
            Topic.name,
            RequestMetadata.model_used,
            RequestMetadata.provider,
            func.count().label("requests"),
        )
        .join(MessageTopic, MessageTopic.topic_id == Topic.id)
        .join(RequestMetadata, RequestMetadata.request_id == MessageTopic.request_id)
        .group_by(Topic.name, RequestMetadata.model_used, RequestMetadata.provider)
        .order_by(func.count().desc())
        .limit(limit)
    ).all()
    return [TopicModelBreakdown(topic=r.name, model_used=r.model_used, provider=r.provider, requests=r.requests) for r in rows]


@router.get("/by-channel", response_model=list[TopicChannelBreakdown])
def get_topics_by_channel(limit: int = Query(100, ge=1, le=500), db: Session = Depends(get_db)) -> list[TopicChannelBreakdown]:
    """Topic × Channel pivot — e.g. "BPJS" mostly asked via Telegram."""
    topics = db.execute(select(Topic)).scalars().all()
    if not topics:
        return []
    topic_ids = [t.id for t in topics]
    pairs = _topic_request_rows(db, topic_ids)

    channels_by_topic: dict[int, ChannelCounts] = {t.id: ChannelCounts() for t in topics}
    for topic_id, rm in pairs:
        bucket = _channel_bucket(rm.platform, rm.channel)
        counts = channels_by_topic[topic_id]
        setattr(counts, bucket, getattr(counts, bucket) + 1)

    rows = [
        TopicChannelBreakdown(
            topic=t.name,
            channels=channels_by_topic[t.id],
            total_requests=sum(channels_by_topic[t.id].model_dump().values()),
        )
        for t in topics
    ]
    rows = [r for r in rows if r.total_requests > 0]
    return sorted(rows, key=lambda r: r.total_requests, reverse=True)[:limit]


@router.get("/new", response_model=list[NewTopic])
def get_new_topics(days: int = Query(7, ge=1, le=90), db: Session = Depends(get_db)) -> list[NewTopic]:
    since = datetime.now(timezone.utc) - timedelta(days=days)
    topics = db.execute(
        select(Topic).where(Topic.first_seen_at >= since).order_by(Topic.first_seen_at.desc())
    ).scalars().all()

    today = datetime.now(timezone.utc).date()
    yesterday = today - timedelta(days=1)

    def _label(seen_at: datetime) -> str:
        d = seen_at.date()
        if d == today:
            return "Today"
        if d == yesterday:
            return "Yesterday"
        return d.isoformat()

    return [NewTopic(id=t.id, name=t.name, category=t.category, created=_label(t.first_seen_at)) for t in topics]


@router.get("/timeline", response_model=list[TimelinePoint])
def get_topic_timeline(
    bucket: str = Query("day", pattern="^(day|week|month)$"),
    topic_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
) -> list[TimelinePoint]:
    """Daily/Weekly/Monthly topic-activity trend — overall, or for one Topic
    (used by the detail page)."""
    date_bucket = func.date_trunc(bucket, RequestMetadata.timestamp)
    query = (
        select(date_bucket.label("bucket"), func.count().label("requests"))
        .join(MessageTopic, MessageTopic.request_id == RequestMetadata.request_id)
    )
    if topic_id is not None:
        query = query.where(MessageTopic.topic_id == topic_id)
    query = query.group_by(date_bucket).order_by(date_bucket)

    rows = db.execute(query).all()
    return [TimelinePoint(bucket=r.bucket.isoformat(), requests=r.requests) for r in rows]


@router.get("/{topic_id}", response_model=TopicDetail)
def get_topic_detail(topic_id: int, db: Session = Depends(get_db)) -> TopicDetail:
    topic = db.get(Topic, topic_id)
    if topic is None:
        raise HTTPException(status_code=404, detail=f"Topic {topic_id} not found")

    pairs = _topic_request_rows(db, [topic_id])
    if not pairs:
        return TopicDetail(
            id=topic.id,
            name=topic.name,
            category=topic.category,
            total_requests=0,
            avg_latency_ms=None,
            first_seen=topic.first_seen_at.isoformat(),
            last_seen=None,
            channels=ChannelCounts(),
            models_used=[],
            top_intents=[],
            knowledge_source=[],
            related_topics=[],
            trend=[],
        )

    request_ids = [rm.request_id for _, rm in pairs]

    channels = ChannelCounts()
    latencies = []
    last_seen = None
    for _, rm in pairs:
        bucket = _channel_bucket(rm.platform, rm.channel)
        setattr(channels, bucket, getattr(channels, bucket) + 1)
        latencies.append(rm.latency_ms)
        if last_seen is None or rm.timestamp > last_seen:
            last_seen = rm.timestamp

    model_rows = db.execute(
        select(RequestMetadata.model_used, RequestMetadata.provider, func.count().label("requests"))
        .where(RequestMetadata.request_id.in_(request_ids))
        .group_by(RequestMetadata.model_used, RequestMetadata.provider)
        .order_by(func.count().desc())
    ).all()

    intent_rows = db.execute(
        select(RequestMetadata.intent, func.count().label("requests"))
        .where(RequestMetadata.request_id.in_(request_ids), RequestMetadata.intent.is_not(None))
        .group_by(RequestMetadata.intent)
        .order_by(func.count().desc())
    ).all()

    knowledge_rows = db.execute(
        select(RequestMetadata.knowledge_source, func.count().label("requests"))
        .where(RequestMetadata.request_id.in_(request_ids))
        .group_by(RequestMetadata.knowledge_source)
        .order_by(func.count().desc())
    ).all()

    conversation_ids = db.execute(
        select(ConversationTopic.conversation_id).where(ConversationTopic.topic_id == topic_id)
    ).scalars().all()
    related_rows = []
    if conversation_ids:
        related_rows = db.execute(
            select(Topic.id, Topic.name, func.count().label("co_occurrences"))
            .join(ConversationTopic, ConversationTopic.topic_id == Topic.id)
            .where(ConversationTopic.conversation_id.in_(conversation_ids), Topic.id != topic_id)
            .group_by(Topic.id, Topic.name)
            .order_by(func.count().desc())
            .limit(10)
        ).all()

    date_bucket = func.date_trunc("day", RequestMetadata.timestamp)
    trend_rows = db.execute(
        select(date_bucket.label("bucket"), func.count().label("requests"))
        .where(RequestMetadata.request_id.in_(request_ids))
        .group_by(date_bucket)
        .order_by(date_bucket)
    ).all()

    return TopicDetail(
        id=topic.id,
        name=topic.name,
        category=topic.category,
        total_requests=len(pairs),
        avg_latency_ms=sum(latencies) / len(latencies) if latencies else None,
        first_seen=topic.first_seen_at.isoformat(),
        last_seen=last_seen.isoformat() if last_seen else None,
        channels=channels,
        models_used=[
            TopicModelBreakdown(topic=topic.name, model_used=r.model_used, provider=r.provider, requests=r.requests)
            for r in model_rows
        ],
        top_intents=[IntentBreakdown(intent=r.intent, requests=r.requests) for r in intent_rows],
        knowledge_source=[{"knowledge_source": r.knowledge_source, "requests": r.requests} for r in knowledge_rows],
        related_topics=[RelatedTopic(id=r.id, name=r.name, co_occurrences=r.co_occurrences) for r in related_rows],
        trend=[TimelinePoint(bucket=r.bucket.isoformat(), requests=r.requests) for r in trend_rows],
    )
