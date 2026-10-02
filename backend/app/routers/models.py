from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import Float, case, func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import RequestMetadata

router = APIRouter(prefix="/models", tags=["models"])


class ModelUsage(BaseModel):
    model_used: str
    provider: str
    total_requests: int
    success_rate: float
    error_rate: float
    avg_latency_ms: float
    avg_token_usage: float
    avg_cost_usd: Optional[float]
    last_used: str


@router.get("", response_model=list[ModelUsage])
def get_model_usage(db: Session = Depends(get_db)) -> list[ModelUsage]:
    """§2 Model Usage — per-model request counts, success/error rate, latency, tokens, cost."""
    success_count = func.sum(case((RequestMetadata.success.is_(True), 1), else_=0))
    total_count = func.count(RequestMetadata.request_id)

    rows = db.execute(
        select(
            RequestMetadata.model_used,
            RequestMetadata.provider,
            total_count.label("total_requests"),
            success_count.label("success_count"),
            func.avg(RequestMetadata.latency_ms).label("avg_latency_ms"),
            func.avg(
                (RequestMetadata.input_tokens + RequestMetadata.output_tokens).cast(Float)
            ).label("avg_token_usage"),
            func.avg(RequestMetadata.cost_usd).label("avg_cost_usd"),
            func.max(RequestMetadata.timestamp).label("last_used"),
        )
        .group_by(RequestMetadata.model_used, RequestMetadata.provider)
        .order_by(total_count.desc())
    ).all()

    return [
        ModelUsage(
            model_used=r.model_used,
            provider=r.provider,
            total_requests=r.total_requests,
            success_rate=r.success_count / r.total_requests,
            error_rate=(r.total_requests - r.success_count) / r.total_requests,
            avg_latency_ms=r.avg_latency_ms,
            avg_token_usage=r.avg_token_usage,
            avg_cost_usd=r.avg_cost_usd,
            last_used=r.last_used.isoformat(),
        )
        for r in rows
    ]
