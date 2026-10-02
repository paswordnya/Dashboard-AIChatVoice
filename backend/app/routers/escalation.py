from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import RequestMetadata

router = APIRouter(prefix="/escalation-analytics", tags=["escalation-analytics"])


class EscalationStepCount(BaseModel):
    escalation_steps: int
    requests: int


class TopEscalationPath(BaseModel):
    escalation_path: str
    requests: int


class EscalationAnalytics(BaseModel):
    total_requests: int
    escalated_requests: int
    escalation_rate: float
    by_steps: list[EscalationStepCount]
    top_paths: list[TopEscalationPath]


@router.get("", response_model=EscalationAnalytics)
def get_escalation_analytics(db: Session = Depends(get_db)) -> EscalationAnalytics:
    """How often a request had to climb from a small/local model up to a
    bigger or cloud model before it could be answered."""
    total = db.execute(select(func.count()).select_from(RequestMetadata)).scalar_one()
    if total == 0:
        return EscalationAnalytics(
            total_requests=0, escalated_requests=0, escalation_rate=0.0, by_steps=[], top_paths=[]
        )

    step_rows = db.execute(
        select(RequestMetadata.escalation_steps, func.count(RequestMetadata.request_id).label("requests"))
        .group_by(RequestMetadata.escalation_steps)
        .order_by(RequestMetadata.escalation_steps)
    ).all()

    path_rows = db.execute(
        select(RequestMetadata.escalation_path, func.count(RequestMetadata.request_id).label("requests"))
        .where(RequestMetadata.escalation_path.is_not(None))
        .group_by(RequestMetadata.escalation_path)
        .order_by(func.count(RequestMetadata.request_id).desc())
        .limit(10)
    ).all()

    escalated = sum(r.requests for r in step_rows if r.escalation_steps > 0)

    return EscalationAnalytics(
        total_requests=total,
        escalated_requests=escalated,
        escalation_rate=escalated / total,
        by_steps=[EscalationStepCount(escalation_steps=r.escalation_steps, requests=r.requests) for r in step_rows],
        top_paths=[TopEscalationPath(escalation_path=r.escalation_path, requests=r.requests) for r in path_rows],
    )
