from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import SystemMetrics
from app.routers.events import verify_api_key

router = APIRouter(prefix="/system-metrics", tags=["system-metrics"])


class SystemMetricsIn(BaseModel):
    timestamp: Optional[datetime] = None
    cpu_percent: float
    memory_percent: float
    memory_used_mb: float


class SystemMetricsOut(BaseModel):
    timestamp: datetime
    cpu_percent: float
    memory_percent: float
    memory_used_mb: float


@router.post("", status_code=201, dependencies=[Depends(verify_api_key)])
def create_system_metrics(payload: SystemMetricsIn, db: Session = Depends(get_db)) -> dict:
    """Periodic CPU/memory snapshot from bpjs-pending-bot-local's
    system_metrics.py sampler (~30s interval) — not request-scoped, see
    SystemMetrics' docstring in models.py for why this is a separate
    table/endpoint instead of another request_metadata column. No GPU
    field on purpose — that repo is CPU-only by design."""
    row = SystemMetrics(
        timestamp=payload.timestamp or datetime.now(timezone.utc),
        cpu_percent=payload.cpu_percent,
        memory_percent=payload.memory_percent,
        memory_used_mb=payload.memory_used_mb,
    )
    db.add(row)
    db.commit()
    return {"id": row.id}


@router.get("/latest", response_model=Optional[SystemMetricsOut])
def get_latest_system_metrics(db: Session = Depends(get_db)):
    row = db.execute(select(SystemMetrics).order_by(SystemMetrics.timestamp.desc())).scalars().first()
    if row is None:
        return None
    return SystemMetricsOut(
        timestamp=row.timestamp,
        cpu_percent=row.cpu_percent,
        memory_percent=row.memory_percent,
        memory_used_mb=row.memory_used_mb,
    )
