from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import RequestMetadata

router = APIRouter(prefix="/router-analytics", tags=["router-analytics"])

CLOUD_PROVIDERS = ("gemini", "openai", "claude")
LOCAL_PROVIDERS = ("lmstudio", "ollama")


class RouterAnalytics(BaseModel):
    total_routed_requests: int
    route_success: int
    route_failure: int
    local_to_cloud_fallback: int
    cloud_to_local_fallback: int
    wrong_route_rate: float
    manual_override: int


class FallbackDestination(BaseModel):
    model_used: str
    provider: str
    fallback_count: int
    percentage_of_all_fallbacks: float


@router.get("", response_model=RouterAnalytics)
def get_router_analytics(db: Session = Depends(get_db)) -> RouterAnalytics:
    """§9 Router Analytics. Route success/failure is proxied by overall request
    success (no separate routing-vs-inference outcome is tracked yet).
    Fallback direction is derived from route_fallback + the provider the
    request actually landed on, not a stored field.
    """
    row = db.execute(
        select(
            func.count(RequestMetadata.request_id).label("total"),
            func.sum(case((RequestMetadata.success.is_(True), 1), else_=0)).label("route_success"),
            func.sum(
                case(
                    (
                        RequestMetadata.route_fallback.is_(True)
                        & RequestMetadata.provider.in_(CLOUD_PROVIDERS),
                        1,
                    ),
                    else_=0,
                )
            ).label("local_to_cloud_fallback"),
            func.sum(
                case(
                    (
                        RequestMetadata.route_fallback.is_(True)
                        & RequestMetadata.provider.in_(LOCAL_PROVIDERS),
                        1,
                    ),
                    else_=0,
                )
            ).label("cloud_to_local_fallback"),
            func.sum(case((RequestMetadata.wrong_route.is_(True), 1), else_=0)).label("wrong_route_count"),
            func.sum(case((RequestMetadata.manual_override.is_(True), 1), else_=0)).label("manual_override"),
        )
    ).one()

    total = row.total or 0
    if total == 0:
        return RouterAnalytics(
            total_routed_requests=0,
            route_success=0,
            route_failure=0,
            local_to_cloud_fallback=0,
            cloud_to_local_fallback=0,
            wrong_route_rate=0.0,
            manual_override=0,
        )

    return RouterAnalytics(
        total_routed_requests=total,
        route_success=row.route_success,
        route_failure=total - row.route_success,
        local_to_cloud_fallback=row.local_to_cloud_fallback,
        cloud_to_local_fallback=row.cloud_to_local_fallback,
        wrong_route_rate=row.wrong_route_count / total,
        manual_override=row.manual_override,
    )


@router.get("/fallback-by-model", response_model=list[FallbackDestination])
def get_fallback_by_model(db: Session = Depends(get_db)) -> list[FallbackDestination]:
    """Which models end up absorbing fallback traffic — i.e. the router
    couldn't use its first-choice model and switched, ranked by how often
    each model is the one it switched to."""
    rows = db.execute(
        select(
            RequestMetadata.model_used,
            RequestMetadata.provider,
            func.count(RequestMetadata.request_id).label("fallback_count"),
        )
        .where(RequestMetadata.route_fallback.is_(True))
        .group_by(RequestMetadata.model_used, RequestMetadata.provider)
        .order_by(func.count(RequestMetadata.request_id).desc())
    ).all()

    total_fallbacks = sum(r.fallback_count for r in rows)
    if total_fallbacks == 0:
        return []

    return [
        FallbackDestination(
            model_used=r.model_used,
            provider=r.provider,
            fallback_count=r.fallback_count,
            percentage_of_all_fallbacks=r.fallback_count / total_fallbacks,
        )
        for r in rows
    ]
