from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import RequestMetadata

router = APIRouter(prefix="/cost-savings", tags=["cost-savings"])

CLOUD_PROVIDERS = ("gemini", "openai", "claude")
LOCAL_PROVIDERS = ("lmstudio", "ollama")


class CostSavings(BaseModel):
    local_requests: int
    cloud_requests: int
    actual_cloud_cost_usd: float
    avg_cost_per_cloud_request_usd: float
    estimated_savings_usd: float
    estimated_cost_if_all_cloud_usd: float


@router.get("", response_model=CostSavings)
def get_cost_savings(db: Session = Depends(get_db)) -> CostSavings:
    """Estimated $ saved by answering locally instead of via a cloud model.
    Baseline is the average cost of an actual cloud request; savings assumes
    every local request would have cost that same average on cloud — a
    rough proxy, not per-request token accounting."""
    local_requests = db.execute(
        select(func.count()).select_from(RequestMetadata).where(RequestMetadata.provider.in_(LOCAL_PROVIDERS))
    ).scalar_one()

    cloud_row = db.execute(
        select(
            func.count(RequestMetadata.request_id).label("cloud_requests"),
            func.sum(RequestMetadata.cost_usd).label("total_cost"),
            func.avg(RequestMetadata.cost_usd).label("avg_cost"),
        ).where(RequestMetadata.provider.in_(CLOUD_PROVIDERS))
    ).one()

    cloud_requests = cloud_row.cloud_requests or 0
    actual_cloud_cost = float(cloud_row.total_cost or 0.0)
    avg_cost_per_cloud_request = float(cloud_row.avg_cost or 0.0)
    estimated_savings = local_requests * avg_cost_per_cloud_request

    return CostSavings(
        local_requests=local_requests,
        cloud_requests=cloud_requests,
        actual_cloud_cost_usd=round(actual_cloud_cost, 4),
        avg_cost_per_cloud_request_usd=round(avg_cost_per_cloud_request, 6),
        estimated_savings_usd=round(estimated_savings, 4),
        estimated_cost_if_all_cloud_usd=round(actual_cloud_cost + estimated_savings, 4),
    )
