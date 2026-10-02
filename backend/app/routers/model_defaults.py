from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import ModelDefaultAssignment, ModelRegistry

router = APIRouter(prefix="/config/model-defaults", tags=["config"])

UseCase = Literal["chat", "voice", "background_task", "classification", "coding"]
USE_CASES: list[UseCase] = ["chat", "voice", "background_task", "classification", "coding"]


class ModelDefaultOut(BaseModel):
    use_case: UseCase
    model_name: Optional[str]
    display_name: Optional[str]
    # provider/model_identifier — the actual routable values, not just this
    # registry's internal key/label. bpjs-pending-bot-local's voice_mode_a.py
    # (Mode A / Gemini Live) reads THESE for the "voice" use case to resolve
    # which model to open a Live session against — model_name alone isn't
    # callable, it's this table's primary key (e.g. "lmstudio-gemma-4-e4b"
    # vs. the real identifier "google/gemma-4-e4b").
    provider: Optional[str]
    model_identifier: Optional[str]
    updated_at: Optional[str]


class ModelDefaultSet(BaseModel):
    model_name: str


def _to_out(use_case: UseCase, assignment: Optional[ModelDefaultAssignment], model: Optional[ModelRegistry]) -> ModelDefaultOut:
    return ModelDefaultOut(
        use_case=use_case,
        model_name=assignment.model_name if assignment else None,
        display_name=model.display_name if model else None,
        provider=model.provider if model else None,
        model_identifier=model.model_identifier if model else None,
        updated_at=assignment.updated_at.isoformat() if assignment else None,
    )


@router.get("", response_model=list[ModelDefaultOut])
def list_defaults(db: Session = Depends(get_db)) -> list[ModelDefaultOut]:
    """§14 Default Model — one row per use case, always all five even if
    unassigned (model_name null), so the UI has a fixed set of slots to fill
    rather than only showing whatever happens to be configured."""
    rows = {r.use_case: r for r in db.execute(select(ModelDefaultAssignment)).scalars().all()}
    model_names = {r.model_name for r in rows.values()}
    models = {
        m.model_name: m
        for m in db.execute(select(ModelRegistry).where(ModelRegistry.model_name.in_(model_names))).scalars().all()
    } if model_names else {}

    return [_to_out(uc, rows.get(uc), models.get(rows[uc].model_name) if uc in rows else None) for uc in USE_CASES]


@router.put("/{use_case}", response_model=ModelDefaultOut)
def set_default(use_case: UseCase, payload: ModelDefaultSet, db: Session = Depends(get_db)) -> ModelDefaultOut:
    model = db.get(ModelRegistry, payload.model_name)
    if model is None:
        raise HTTPException(status_code=404, detail=f"Model '{payload.model_name}' not found")
    if model.status != "active":
        raise HTTPException(status_code=409, detail=f"Model '{payload.model_name}' is not active — activate it before setting it as a default")

    row = db.get(ModelDefaultAssignment, use_case)
    now = datetime.now(timezone.utc)
    if row is None:
        row = ModelDefaultAssignment(use_case=use_case, model_name=payload.model_name, updated_at=now)
        db.add(row)
    else:
        row.model_name = payload.model_name
        row.updated_at = now
    db.commit()
    return _to_out(use_case, row, model)
