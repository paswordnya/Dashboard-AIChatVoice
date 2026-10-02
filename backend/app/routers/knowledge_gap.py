from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import MessageTopic, RequestMetadata, Topic

router = APIRouter(prefix="/knowledge-gap", tags=["knowledge-gap"])


class KnowledgeGapQuestion(BaseModel):
    query_text: str
    requests: int
    category: Optional[str]
    most_common_intent: Optional[str]
    topic: Optional[str] = None
    topic_category: Optional[str] = None


@router.get("", response_model=list[KnowledgeGapQuestion])
def get_knowledge_gap(limit: int = Query(20, ge=1, le=200), db: Session = Depends(get_db)) -> list[KnowledgeGapQuestion]:
    """Questions Local DB, Memory, and RAG all missed — the request fell
    straight through to the LLM with no grounding. Ranked by frequency,
    these are the strongest candidates for expanding the knowledge base.
    `topic`/`topic_category` (from topics.py's Topic table, auto-detected
    subject matter — distinct from `category`, the AI-router task) are the
    stronger signal for deciding WHAT knowledge base content to actually
    write; `category`/`most_common_intent` only say which task handled it."""
    rows = db.execute(
        select(
            RequestMetadata.query_text,
            RequestMetadata.category,
            RequestMetadata.intent,
            func.count(RequestMetadata.request_id).label("requests"),
        )
        .where(RequestMetadata.knowledge_source == "llm_only", RequestMetadata.query_text.is_not(None))
        .group_by(RequestMetadata.query_text, RequestMetadata.category, RequestMetadata.intent)
        .order_by(func.count(RequestMetadata.request_id).desc())
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
        .where(RequestMetadata.knowledge_source == "llm_only", RequestMetadata.query_text.is_not(None))
        .group_by(RequestMetadata.query_text, Topic.name, Topic.category)
        .order_by(func.count(RequestMetadata.request_id).desc())
    ).all()

    # a question can surface more than one Topic across its occurrences —
    # keep just the most frequent one per question, same "first row wins"
    # trick as by_question below (topic_rows is already ordered by count desc)
    top_topic_by_question: dict[str, tuple[str, Optional[str]]] = {}
    for r in topic_rows:
        if r.query_text not in top_topic_by_question:
            top_topic_by_question[r.query_text] = (r.name, r.category)

    # collapse (query_text, category, intent) triples back down to one row
    # per question, keeping the most frequent category/intent pairing
    by_question: dict[str, KnowledgeGapQuestion] = {}
    for r in rows:
        existing = by_question.get(r.query_text)
        if existing is None or r.requests > existing.requests:
            topic_name, topic_category = top_topic_by_question.get(r.query_text, (None, None))
            by_question[r.query_text] = KnowledgeGapQuestion(
                query_text=r.query_text,
                requests=r.requests if existing is None else existing.requests + r.requests,
                category=r.category,
                most_common_intent=r.intent,
                topic=topic_name,
                topic_category=topic_category,
            )
        else:
            existing.requests += r.requests

    return sorted(by_question.values(), key=lambda q: q.requests, reverse=True)[:limit]
