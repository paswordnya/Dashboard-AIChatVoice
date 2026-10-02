from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import RequestMetadata

router = APIRouter(prefix="/feature-adoption", tags=["feature-adoption"])


class FeatureAdoption(BaseModel):
    feature: str
    requests: int
    percentage: float


@router.get("", response_model=list[FeatureAdoption])
def get_feature_adoption(db: Session = Depends(get_db)) -> list[FeatureAdoption]:
    """% of requests using each feature — Voice, Memory, RAG, Web Search,
    Reminder, Calendar, MCP Tools, and any Tool Call overall."""
    total = db.execute(select(func.count()).select_from(RequestMetadata)).scalar_one()
    if total == 0:
        return []

    def count_where(condition) -> int:
        return db.execute(select(func.count()).select_from(RequestMetadata).where(condition)).scalar_one()

    features = [
        ("Voice", RequestMetadata.channel == "voice"),
        ("Memory", RequestMetadata.memory_hit.is_(True)),
        ("RAG", RequestMetadata.rag_hit.is_(True)),
        ("Web Search", RequestMetadata.web_search_used.is_(True)),
        ("Reminder", RequestMetadata.tool_called == "reminder"),
        ("Calendar", RequestMetadata.tool_called == "calendar"),
        ("MCP Tools", RequestMetadata.tool_called == "mcp_tools"),
        ("Tool Calls (any)", RequestMetadata.tool_called.is_not(None)),
    ]

    result = []
    for name, condition in features:
        requests = count_where(condition)
        result.append(FeatureAdoption(feature=name, requests=requests, percentage=requests / total))
    return result
