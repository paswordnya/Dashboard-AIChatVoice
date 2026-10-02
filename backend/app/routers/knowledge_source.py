from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import RequestMetadata

router = APIRouter(prefix="/knowledge-source", tags=["knowledge-source"])

SOURCE_LABELS = {
    "local_db": "Local Database",
    "memory": "User Memory",
    "rag": "Local RAG",
    "cache": "Cache",
    "web_search": "Web Search",
    "grounding": "Grounding",
    "llm_only": "LLM Only",
}


class KnowledgeSourceShare(BaseModel):
    source: str
    label: str
    requests: int
    percentage: float


@router.get("/distribution", response_model=list[KnowledgeSourceShare])
def get_knowledge_source_distribution(db: Session = Depends(get_db)) -> list[KnowledgeSourceShare]:
    """§13 Knowledge Source Distribution — where AI answers came from, ranked by volume."""
    rows = db.execute(
        select(RequestMetadata.knowledge_source, func.count(RequestMetadata.request_id).label("requests"))
        .group_by(RequestMetadata.knowledge_source)
        .order_by(func.count(RequestMetadata.request_id).desc())
    ).all()

    total = sum(r.requests for r in rows)
    if total == 0:
        return []

    return [
        KnowledgeSourceShare(
            source=r.knowledge_source,
            label=SOURCE_LABELS.get(r.knowledge_source, r.knowledge_source),
            requests=r.requests,
            percentage=r.requests / total,
        )
        for r in rows
    ]
