import base64
import json
import logging
import urllib.error
import urllib.request
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import MessageTopic, RequestMetadata, Topic, UserDirectory

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["users"])

TELEGRAM_PLATFORM = "telegram"


def channel_for(platform: str) -> str:
    return "telegram" if platform == TELEGRAM_PLATFORM else "pip_app"


class ChannelSummary(BaseModel):
    telegram_users: int
    pip_app_users: int
    telegram_requests: int
    pip_app_requests: int
    telegram_last_used: Optional[str]
    pip_chat_last_used: Optional[str]
    pip_voice_last_used: Optional[str]


class ModelActivity(BaseModel):
    model_used: str
    provider: str
    requests: int


class CategoryActivity(BaseModel):
    category: str
    requests: int


class TopicActivity(BaseModel):
    topic: str
    requests: int


class LanguageActivity(BaseModel):
    language: str
    requests: int


class TopUser(BaseModel):
    user_id: str
    channel: str
    platform: str
    telegram_username: Optional[str]
    total_requests: int
    last_used: Optional[str]
    models_used: list[ModelActivity]
    categories_asked: list[CategoryActivity]
    topics_discussed: list[TopicActivity]


class TelegramDirectoryUser(BaseModel):
    telegram_username: Optional[str]
    user_id: Optional[str]
    total_requests: int
    last_used: Optional[str]
    models_used: list[ModelActivity]
    categories_asked: list[CategoryActivity]
    topics_discussed: list[TopicActivity]


class UserDetail(BaseModel):
    user_id: str
    channel: str
    platform: Optional[str]
    telegram_username: Optional[str]
    total_requests: int
    first_seen: Optional[str]
    last_used: Optional[str]
    models_used: list[ModelActivity]
    categories_asked: list[CategoryActivity]
    topics_discussed: list[TopicActivity]
    # Text channels only (Telegram CHAT, Pip app Chat) get a real LLM-classified
    # language per message (bpjs-pending-bot-local's language_classifier.py);
    # voice turns get it from faster-whisper's own ASR detection — both land
    # in the same RequestMetadata.language column, so this breakdown covers
    # a user's activity across every channel, not just voice.
    languages_used: list[LanguageActivity]


@router.get("/summary", response_model=ChannelSummary)
def get_users_summary(db: Session = Depends(get_db)) -> ChannelSummary:
    """User count and request volume split by channel: Telegram bot vs the native pip app.
    User counts come from user_directory (the source of truth for who counts as
    a user on each platform — synced externally, not derived from activity), so
    a real user with zero activity still counts. Request counts remain
    activity-based, from request_metadata."""
    directory_counts = dict(
        db.execute(
            select(UserDirectory.platform, func.count()).group_by(UserDirectory.platform)
        ).all()
    )
    telegram_users = directory_counts.get(TELEGRAM_PLATFORM, 0)
    pip_app_users = sum(count for platform, count in directory_counts.items() if platform != TELEGRAM_PLATFORM)

    rows = db.execute(
        select(
            RequestMetadata.platform,
            func.count(RequestMetadata.request_id).label("requests"),
        )
        .where(RequestMetadata.user_id.is_not(None))
        .group_by(RequestMetadata.platform)
    ).all()

    telegram_requests = pip_app_requests = 0
    for r in rows:
        if channel_for(r.platform) == "telegram":
            telegram_requests += r.requests
        else:
            pip_app_requests += r.requests

    telegram_last_used = db.execute(
        select(func.max(RequestMetadata.timestamp)).where(RequestMetadata.platform == TELEGRAM_PLATFORM)
    ).scalar_one_or_none()
    pip_chat_last_used = db.execute(
        select(func.max(RequestMetadata.timestamp)).where(
            RequestMetadata.platform != TELEGRAM_PLATFORM, RequestMetadata.channel == "chat"
        )
    ).scalar_one_or_none()
    pip_voice_last_used = db.execute(
        select(func.max(RequestMetadata.timestamp)).where(
            RequestMetadata.platform != TELEGRAM_PLATFORM, RequestMetadata.channel == "voice"
        )
    ).scalar_one_or_none()

    return ChannelSummary(
        telegram_users=telegram_users,
        pip_app_users=pip_app_users,
        telegram_requests=telegram_requests,
        pip_app_requests=pip_app_requests,
        telegram_last_used=telegram_last_used.isoformat() if telegram_last_used else None,
        pip_chat_last_used=pip_chat_last_used.isoformat() if pip_chat_last_used else None,
        pip_voice_last_used=pip_voice_last_used.isoformat() if pip_voice_last_used else None,
    )


@router.get("/telegram", response_model=list[TelegramDirectoryUser])
def get_telegram_users(db: Session = Depends(get_db)) -> list[TelegramDirectoryUser]:
    """Telegram users straight from the sheet-sourced directory, left-joined
    against activity. A real user with no matching request_metadata rows
    still appears here, with empty/zero stats, per the reconciliation rule:
    the sheet decides who's a Telegram user, the DB only supplies activity."""
    directory_rows = db.execute(
        select(UserDirectory).where(UserDirectory.platform == TELEGRAM_PLATFORM)
    ).scalars().all()
    linked_user_ids = [d.user_id for d in directory_rows if d.user_id is not None]

    model_rows = (
        db.execute(
            select(
                RequestMetadata.user_id,
                RequestMetadata.model_used,
                RequestMetadata.provider,
                func.count(RequestMetadata.request_id).label("requests"),
            )
            .where(RequestMetadata.user_id.in_(linked_user_ids))
            .group_by(RequestMetadata.user_id, RequestMetadata.model_used, RequestMetadata.provider)
            .order_by(func.count(RequestMetadata.request_id).desc())
        ).all()
        if linked_user_ids
        else []
    )
    category_rows = (
        db.execute(
            select(
                RequestMetadata.user_id,
                RequestMetadata.category,
                func.count(RequestMetadata.request_id).label("requests"),
            )
            .where(RequestMetadata.user_id.in_(linked_user_ids), RequestMetadata.category.is_not(None))
            .group_by(RequestMetadata.user_id, RequestMetadata.category)
            .order_by(func.count(RequestMetadata.request_id).desc())
        ).all()
        if linked_user_ids
        else []
    )
    topic_rows = (
        db.execute(
            select(
                RequestMetadata.user_id,
                Topic.name,
                func.count(RequestMetadata.request_id).label("requests"),
            )
            .join(MessageTopic, MessageTopic.request_id == RequestMetadata.request_id)
            .join(Topic, Topic.id == MessageTopic.topic_id)
            .where(RequestMetadata.user_id.in_(linked_user_ids))
            .group_by(RequestMetadata.user_id, Topic.name)
            .order_by(func.count(RequestMetadata.request_id).desc())
        ).all()
        if linked_user_ids
        else []
    )
    last_used_rows = (
        db.execute(
            select(RequestMetadata.user_id, func.max(RequestMetadata.timestamp).label("last_used"))
            .where(RequestMetadata.user_id.in_(linked_user_ids))
            .group_by(RequestMetadata.user_id)
        ).all()
        if linked_user_ids
        else []
    )

    models_by_user: dict[str, list[ModelActivity]] = {uid: [] for uid in linked_user_ids}
    for r in model_rows:
        models_by_user[r.user_id].append(ModelActivity(model_used=r.model_used, provider=r.provider, requests=r.requests))

    categories_by_user: dict[str, list[CategoryActivity]] = {uid: [] for uid in linked_user_ids}
    for r in category_rows:
        categories_by_user[r.user_id].append(CategoryActivity(category=r.category, requests=r.requests))

    topics_by_user: dict[str, list[TopicActivity]] = {uid: [] for uid in linked_user_ids}
    for r in topic_rows:
        topics_by_user[r.user_id].append(TopicActivity(topic=r.name, requests=r.requests))

    last_used_by_user: dict[str, str] = {r.user_id: r.last_used.isoformat() for r in last_used_rows}

    result = []
    for d in directory_rows:
        models = models_by_user.get(d.user_id, [])
        categories = categories_by_user.get(d.user_id, [])
        topics = topics_by_user.get(d.user_id, [])
        result.append(
            TelegramDirectoryUser(
                telegram_username=d.telegram_username,
                user_id=d.user_id,
                total_requests=sum(m.requests for m in models),
                last_used=last_used_by_user.get(d.user_id),
                models_used=models,
                categories_asked=categories,
                topics_discussed=topics,
            )
        )
    return sorted(result, key=lambda u: u.total_requests, reverse=True)


@router.get("/top", response_model=list[TopUser])
def get_top_users(
    limit: int = Query(20, ge=1, le=200),
    channel: Optional[str] = Query(None, pattern="^(telegram|pip_app)$"),
    db: Session = Depends(get_db),
) -> list[TopUser]:
    """§18 User Analytics — users ranked by how much they ask, with the models
    active on their requests. `channel` filters to telegram or pip_app."""
    base_query = select(
        RequestMetadata.user_id,
        RequestMetadata.platform,
        RequestMetadata.telegram_username,
        func.count(RequestMetadata.request_id).label("total_requests"),
        func.max(RequestMetadata.timestamp).label("last_used"),
    ).where(RequestMetadata.user_id.is_not(None))

    if channel == "telegram":
        base_query = base_query.where(RequestMetadata.platform == TELEGRAM_PLATFORM)
    elif channel == "pip_app":
        base_query = base_query.where(RequestMetadata.platform != TELEGRAM_PLATFORM)

    top_rows = db.execute(
        base_query.group_by(RequestMetadata.user_id, RequestMetadata.platform, RequestMetadata.telegram_username)
        .order_by(func.count(RequestMetadata.request_id).desc())
        .limit(limit)
    ).all()

    if not top_rows:
        return []

    top_user_ids = [r.user_id for r in top_rows]
    model_rows = db.execute(
        select(
            RequestMetadata.user_id,
            RequestMetadata.model_used,
            RequestMetadata.provider,
            func.count(RequestMetadata.request_id).label("requests"),
        )
        .where(RequestMetadata.user_id.in_(top_user_ids))
        .group_by(RequestMetadata.user_id, RequestMetadata.model_used, RequestMetadata.provider)
        .order_by(func.count(RequestMetadata.request_id).desc())
    ).all()

    category_rows = db.execute(
        select(
            RequestMetadata.user_id,
            RequestMetadata.category,
            func.count(RequestMetadata.request_id).label("requests"),
        )
        .where(RequestMetadata.user_id.in_(top_user_ids), RequestMetadata.category.is_not(None))
        .group_by(RequestMetadata.user_id, RequestMetadata.category)
        .order_by(func.count(RequestMetadata.request_id).desc())
    ).all()

    topic_rows = db.execute(
        select(
            RequestMetadata.user_id,
            Topic.name,
            func.count(RequestMetadata.request_id).label("requests"),
        )
        .join(MessageTopic, MessageTopic.request_id == RequestMetadata.request_id)
        .join(Topic, Topic.id == MessageTopic.topic_id)
        .where(RequestMetadata.user_id.in_(top_user_ids))
        .group_by(RequestMetadata.user_id, Topic.name)
        .order_by(func.count(RequestMetadata.request_id).desc())
    ).all()

    models_by_user: dict[str, list[ModelActivity]] = {uid: [] for uid in top_user_ids}
    for r in model_rows:
        models_by_user[r.user_id].append(
            ModelActivity(model_used=r.model_used, provider=r.provider, requests=r.requests)
        )

    categories_by_user: dict[str, list[CategoryActivity]] = {uid: [] for uid in top_user_ids}
    for r in category_rows:
        categories_by_user[r.user_id].append(CategoryActivity(category=r.category, requests=r.requests))

    topics_by_user: dict[str, list[TopicActivity]] = {uid: [] for uid in top_user_ids}
    for r in topic_rows:
        topics_by_user[r.user_id].append(TopicActivity(topic=r.name, requests=r.requests))

    return [
        TopUser(
            user_id=r.user_id,
            channel=channel_for(r.platform),
            platform=r.platform,
            telegram_username=r.telegram_username,
            total_requests=r.total_requests,
            last_used=r.last_used.isoformat() if r.last_used else None,
            models_used=models_by_user[r.user_id],
            categories_asked=categories_by_user[r.user_id],
            topics_discussed=topics_by_user[r.user_id],
        )
        for r in top_rows
    ]


@router.get("/{user_id}", response_model=UserDetail)
def get_user_detail(user_id: str, db: Session = Depends(get_db)) -> UserDetail:
    """Full per-user breakdown — the "click into user detail" destination
    for the Users page's three list tables, which stay narrow (no per-user
    tag columns beyond what's already there) rather than growing a Languages
    column on top of the existing Models/Categories/Topics ones."""
    base_row = db.execute(
        select(
            RequestMetadata.platform,
            RequestMetadata.telegram_username,
            func.count(RequestMetadata.request_id).label("total_requests"),
            func.min(RequestMetadata.timestamp).label("first_seen"),
            func.max(RequestMetadata.timestamp).label("last_used"),
        )
        .where(RequestMetadata.user_id == user_id)
        .group_by(RequestMetadata.platform, RequestMetadata.telegram_username)
        .order_by(func.count(RequestMetadata.request_id).desc())
        .limit(1)
    ).first()

    if base_row is None:
        # No activity at all — still a real user if the sheet-sourced
        # directory (see UserDirectory's docstring) knows about them,
        # same "blank stats, not dropped" rule get_telegram_users follows.
        directory_row = db.execute(
            select(UserDirectory).where(UserDirectory.user_id == user_id).limit(1)
        ).scalar_one_or_none()
        if directory_row is None:
            raise HTTPException(status_code=404, detail=f"User {user_id!r} not found")
        return UserDetail(
            user_id=user_id,
            channel=channel_for(directory_row.platform),
            platform=directory_row.platform,
            telegram_username=directory_row.telegram_username,
            total_requests=0,
            first_seen=None,
            last_used=None,
            models_used=[],
            categories_asked=[],
            topics_discussed=[],
            languages_used=[],
        )

    model_rows = db.execute(
        select(
            RequestMetadata.model_used,
            RequestMetadata.provider,
            func.count(RequestMetadata.request_id).label("requests"),
        )
        .where(RequestMetadata.user_id == user_id)
        .group_by(RequestMetadata.model_used, RequestMetadata.provider)
        .order_by(func.count(RequestMetadata.request_id).desc())
    ).all()

    category_rows = db.execute(
        select(
            RequestMetadata.category,
            func.count(RequestMetadata.request_id).label("requests"),
        )
        .where(RequestMetadata.user_id == user_id, RequestMetadata.category.is_not(None))
        .group_by(RequestMetadata.category)
        .order_by(func.count(RequestMetadata.request_id).desc())
    ).all()

    topic_rows = db.execute(
        select(
            Topic.name,
            func.count(RequestMetadata.request_id).label("requests"),
        )
        .join(MessageTopic, MessageTopic.request_id == RequestMetadata.request_id)
        .join(Topic, Topic.id == MessageTopic.topic_id)
        .where(RequestMetadata.user_id == user_id)
        .group_by(Topic.name)
        .order_by(func.count(RequestMetadata.request_id).desc())
    ).all()

    language_rows = db.execute(
        select(
            RequestMetadata.language,
            func.count(RequestMetadata.request_id).label("requests"),
        )
        .where(RequestMetadata.user_id == user_id, RequestMetadata.language.is_not(None))
        .group_by(RequestMetadata.language)
        .order_by(func.count(RequestMetadata.request_id).desc())
    ).all()

    return UserDetail(
        user_id=user_id,
        channel=channel_for(base_row.platform),
        platform=base_row.platform,
        telegram_username=base_row.telegram_username,
        total_requests=base_row.total_requests,
        first_seen=base_row.first_seen.isoformat() if base_row.first_seen else None,
        last_used=base_row.last_used.isoformat() if base_row.last_used else None,
        models_used=[ModelActivity(model_used=r.model_used, provider=r.provider, requests=r.requests) for r in model_rows],
        categories_asked=[CategoryActivity(category=r.category, requests=r.requests) for r in category_rows],
        topics_discussed=[TopicActivity(topic=r.name, requests=r.requests) for r in topic_rows],
        languages_used=[LanguageActivity(language=r.language, requests=r.requests) for r in language_rows],
    )


class AdaptiveProfile(BaseModel):
    user_id: int
    preferred_language: Optional[str] = None
    communication_style: Optional[str] = None
    preferred_tone: Optional[str] = None
    preferred_response_length: Optional[str] = None
    technical_level: Optional[str] = None
    favorite_topics: list[str] = []
    response_preference: Optional[str] = None
    humor_preference: Optional[str] = None
    emoji_preference: Optional[str] = None
    interaction_score: float = 0
    confidence_score: float = 0
    last_updated_at: str


@router.get("/{user_id}/profile", response_model=Optional[AdaptiveProfile])
def get_user_adaptive_profile(user_id: str) -> Optional[AdaptiveProfile]:
    """Adaptive Conversation Engine profile (PRD §23) for this user, proxied
    live from bpjs-pending-bot-local's admin-only GET
    /api/dashboard/users/{user_id}/profile — this dashboard has no DB of its
    own for adaptive_profiles (that table lives in bpjs's `bpjs_pending_bot`
    database, not this one), same cross-repo pattern as
    app/services/provider_health_sync.py.

    Only ever populated for pip app users — adaptive_profiles.user_id is the
    bpjs `users` table id, which Telegram-only users don't have, so those
    always resolve to None here (not an error — the frontend renders that as
    "no interaction profile yet", not a failure state).

    user_id is a path str here (matching UserDetail.user_id's type, which
    doubles as a Telegram chat_id string for Telegram users) but bpjs's
    adaptive_profiles.user_id is an int; a non-numeric id (any Telegram user)
    can never have a row, so that case short-circuits without a wasted round
    trip to the bot.
    """
    if not settings.bot_dashboard_user or not settings.bot_dashboard_password:
        return None
    try:
        numeric_user_id = int(user_id)
    except ValueError:
        return None

    url = f"{settings.bot_api_url.rstrip('/')}/api/dashboard/users/{numeric_user_id}/profile"
    credentials = base64.b64encode(f"{settings.bot_dashboard_user}:{settings.bot_dashboard_password}".encode()).decode()
    req = urllib.request.Request(url, headers={"Authorization": f"Basic {credentials}"})
    try:
        with urllib.request.urlopen(req, timeout=5.0) as resp:
            body = json.loads(resp.read())
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as e:
        logger.warning("get_user_adaptive_profile: gagal fetch profile dari bot untuk user_id=%s (%s)", numeric_user_id, e)
        return None
    return AdaptiveProfile(**body) if body is not None else None
