from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import MessageTopic, RequestMetadata, Topic

router = APIRouter(prefix="/top-failed-questions", tags=["top-failed-questions"])


class FailedQuestion(BaseModel):
    query_text: str
    total_requests: int
    failure_count: int
    negative_feedback_count: int
    category: Optional[str]
    topic: Optional[str] = None
    topic_category: Optional[str] = None


@router.get("", response_model=list[FailedQuestion])
def get_top_failed_questions(
    limit: int = Query(20, ge=1, le=200), db: Session = Depends(get_db)
) -> list[FailedQuestion]:
    """Questions most often failing outright or drawing negative feedback —
    ranked by failure_count + negative_feedback_count combined. `topic`/
    `topic_category` (auto-detected subject matter, see knowledge_gap.py's
    same pattern) are the stronger signal for WHAT to fix; `category` only
    says which AI-router task handled it."""
    trouble_score = func.sum(
        case((RequestMetadata.success.is_(False), 1), else_=0)
        + case((RequestMetadata.negative_feedback.is_(True), 1), else_=0)
    )

    rows = db.execute(
        select(
            RequestMetadata.query_text,
            RequestMetadata.category,
            func.count(RequestMetadata.request_id).label("total_requests"),
            func.sum(case((RequestMetadata.success.is_(False), 1), else_=0)).label("failure_count"),
            func.sum(case((RequestMetadata.negative_feedback.is_(True), 1), else_=0)).label(
                "negative_feedback_count"
            ),
        )
        .where(RequestMetadata.query_text.is_not(None))
        .group_by(RequestMetadata.query_text, RequestMetadata.category)
        .having(trouble_score > 0)
        .order_by(trouble_score.desc())
        .limit(limit)
    ).all()

    topic_rows = db.execute(
        select(
            RequestMetadata.query_text,
            Topic.name,
            Topic.category,
            func.count(RequestMetadata.request_id).label("requests"),
        )
        .join(MessageTopic, MessageTopic.request_id == RequestMetadata.request_id)
        .join(Topic, Topic.id == MessageTopic.topic_id)
        .where(RequestMetadata.query_text.is_not(None))
        .group_by(RequestMetadata.query_text, Topic.name, Topic.category)
        .order_by(func.count(RequestMetadata.request_id).desc())
    ).all()

    # most frequent Topic per question — same "first row wins" trick as
    # knowledge_gap.py (topic_rows is already ordered by count desc)
    top_topic_by_question: dict[str, tuple[str, Optional[str]]] = {}
    for r in topic_rows:
        if r.query_text not in top_topic_by_question:
            top_topic_by_question[r.query_text] = (r.name, r.category)

    return [
        FailedQuestion(
            query_text=r.query_text,
            total_requests=r.total_requests,
            failure_count=r.failure_count,
            negative_feedback_count=r.negative_feedback_count,
            category=r.category,
            topic=top_topic_by_question.get(r.query_text, (None, None))[0],
            topic_category=top_topic_by_question.get(r.query_text, (None, None))[1],
        )
        for r in rows
    ]
