from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import RequestMetadata

router = APIRouter(prefix="/confidence-distribution", tags=["confidence-distribution"])

BUCKET_WIDTH = 0.1


class ConfidenceBucket(BaseModel):
    bucket_start: float
    bucket_end: float
    requests: int


class ConfidenceSummary(BaseModel):
    avg_confidence: float
    avg_confidence_when_routed_correctly: float
    avg_confidence_when_wrong_or_escalated: float
    buckets: list[ConfidenceBucket]


@router.get("", response_model=ConfidenceSummary)
def get_confidence_distribution(db: Session = Depends(get_db)) -> ConfidenceSummary:
    """Distribution of intent/routing confidence — low-confidence clusters
    are where the router or intent classifier needs improvement."""
    rows = db.execute(
        select(RequestMetadata.routing_confidence, RequestMetadata.wrong_route, RequestMetadata.escalation_steps).where(
            RequestMetadata.routing_confidence.is_not(None)
        )
    ).all()

    if not rows:
        return ConfidenceSummary(
            avg_confidence=0.0,
            avg_confidence_when_routed_correctly=0.0,
            avg_confidence_when_wrong_or_escalated=0.0,
            buckets=[],
        )

    confidences = [r.routing_confidence for r in rows]
    clean = [r.routing_confidence for r in rows if not r.wrong_route and r.escalation_steps == 0]
    troubled = [r.routing_confidence for r in rows if r.wrong_route or r.escalation_steps > 0]

    bucket_counts: dict[int, int] = {}
    for c in confidences:
        bucket_index = min(int(c / BUCKET_WIDTH), 9)  # clamp 1.0 into the last bucket
        bucket_counts[bucket_index] = bucket_counts.get(bucket_index, 0) + 1

    buckets = [
        ConfidenceBucket(
            bucket_start=round(i * BUCKET_WIDTH, 2),
            bucket_end=round((i + 1) * BUCKET_WIDTH, 2),
            requests=bucket_counts.get(i, 0),
        )
        for i in range(10)
    ]

    return ConfidenceSummary(
        avg_confidence=round(sum(confidences) / len(confidences), 4),
        avg_confidence_when_routed_correctly=round(sum(clean) / len(clean), 4) if clean else 0.0,
        avg_confidence_when_wrong_or_escalated=round(sum(troubled) / len(troubled), 4) if troubled else 0.0,
        buckets=buckets,
    )
