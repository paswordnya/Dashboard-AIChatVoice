from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import IntentConfig

router = APIRouter(prefix="/config/intents", tags=["config"])


class ChainEntry(BaseModel):
    provider: str
    model: str


class IntentConfigOut(BaseModel):
    intent: str
    chain: list[ChainEntry]
    enabled: bool
    priority: int
    confidence_threshold: float
    max_latency_ms: Optional[int]
    requires_rules_check: bool
    knowledge_source: Optional[str]
    updated_at: str


class IntentConfigCreate(BaseModel):
    intent: str
    chain: list[ChainEntry] = Field(min_length=1)
    enabled: bool = True
    priority: int = 0
    confidence_threshold: float = 0.5
    max_latency_ms: Optional[int] = None
    requires_rules_check: bool = False
    knowledge_source: Optional[str] = None


class IntentConfigUpdate(BaseModel):
    chain: Optional[list[ChainEntry]] = Field(default=None, min_length=1)
    enabled: Optional[bool] = None
    priority: Optional[int] = None
    confidence_threshold: Optional[float] = None
    max_latency_ms: Optional[int] = None
    requires_rules_check: Optional[bool] = None
    knowledge_source: Optional[str] = None


def _to_out(row: IntentConfig) -> IntentConfigOut:
    return IntentConfigOut(
        intent=row.intent,
        chain=[ChainEntry(**entry) for entry in row.chain],
        enabled=row.enabled,
        priority=row.priority,
        confidence_threshold=row.confidence_threshold,
        max_latency_ms=row.max_latency_ms,
        requires_rules_check=row.requires_rules_check,
        knowledge_source=row.knowledge_source,
        updated_at=row.updated_at.isoformat(),
    )


@router.get("", response_model=list[IntentConfigOut])
def list_intent_configs(db: Session = Depends(get_db)) -> list[IntentConfigOut]:
    """§ AI Router configuration — every intent, its full priority-ordered
    model chain, whether the route is active, priority, and confidence
    floor."""
    rows = db.execute(select(IntentConfig).order_by(IntentConfig.priority, IntentConfig.intent)).scalars().all()
    return [_to_out(r) for r in rows]


@router.post("", response_model=IntentConfigOut, status_code=201)
def create_intent_config(payload: IntentConfigCreate, db: Session = Depends(get_db)) -> IntentConfigOut:
    if db.get(IntentConfig, payload.intent) is not None:
        raise HTTPException(status_code=409, detail=f"Intent '{payload.intent}' already configured")

    row = IntentConfig(
        intent=payload.intent,
        chain=[entry.model_dump() for entry in payload.chain],
        enabled=payload.enabled,
        priority=payload.priority,
        confidence_threshold=payload.confidence_threshold,
        max_latency_ms=payload.max_latency_ms,
        requires_rules_check=payload.requires_rules_check,
        knowledge_source=payload.knowledge_source,
        updated_at=datetime.now(timezone.utc),
    )
    db.add(row)
    db.commit()
    return _to_out(row)


@router.patch("/{intent}", response_model=IntentConfigOut)
def update_intent_config(intent: str, payload: IntentConfigUpdate, db: Session = Depends(get_db)) -> IntentConfigOut:
    row = db.get(IntentConfig, intent)
    if row is None:
        raise HTTPException(status_code=404, detail=f"Intent '{intent}' not found")

    updates = payload.model_dump(exclude_unset=True)  # chain, if present, is already list[dict] here
    for field, value in updates.items():
        setattr(row, field, value)
    row.updated_at = datetime.now(timezone.utc)
    db.commit()
    return _to_out(row)


@router.delete("/{intent}", status_code=204)
def delete_intent_config(intent: str, db: Session = Depends(get_db)) -> None:
    row = db.get(IntentConfig, intent)
    if row is None:
        raise HTTPException(status_code=404, detail=f"Intent '{intent}' not found")
    db.delete(row)
    db.commit()
