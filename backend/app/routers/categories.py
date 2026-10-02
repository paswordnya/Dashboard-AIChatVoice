from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import RequestMetadata

router = APIRouter(prefix="/categories", tags=["categories"])


class CategorySummary(BaseModel):
    category: str
    requests: int
    percentage: float
    success_rate: float


class CategoryRouteDestination(BaseModel):
    provider: str
    model_used: str
    requests: int
    percentage: float


@router.get("", response_model=list[CategorySummary])
def get_categories(db: Session = Depends(get_db)) -> list[CategorySummary]:
    """§5 Category Analytics — categories ranked by how often they're asked."""
    success_count = func.sum(case((RequestMetadata.success.is_(True), 1), else_=0))
    total_count = func.count(RequestMetadata.request_id)

    rows = db.execute(
        select(
            RequestMetadata.category,
            total_count.label("requests"),
            success_count.label("success_count"),
        )
        .where(RequestMetadata.category.is_not(None))
        .group_by(RequestMetadata.category)
        .order_by(total_count.desc())
    ).all()

    total = sum(r.requests for r in rows)
    if total == 0:
        return []

    return [
        CategorySummary(
            category=r.category,
            requests=r.requests,
            percentage=r.requests / total,
            success_rate=r.success_count / r.requests,
        )
        for r in rows
    ]


@router.get("/{category}/routing", response_model=list[CategoryRouteDestination])
def get_category_routing(category: str, db: Session = Depends(get_db)) -> list[CategoryRouteDestination]:
    """Where a category's requests get routed to — provider/model breakdown."""
    total_count = func.count(RequestMetadata.request_id)

    rows = db.execute(
        select(
            RequestMetadata.provider,
            RequestMetadata.model_used,
            total_count.label("requests"),
        )
        .where(RequestMetadata.category == category)
        .group_by(RequestMetadata.provider, RequestMetadata.model_used)
        .order_by(total_count.desc())
    ).all()

    total = sum(r.requests for r in rows)
    if total == 0:
        raise HTTPException(status_code=404, detail=f"No requests found for category '{category}'")

    return [
        CategoryRouteDestination(
            provider=r.provider,
            model_used=r.model_used,
            requests=r.requests,
            percentage=r.requests / total,
        )
        for r in rows
    ]
