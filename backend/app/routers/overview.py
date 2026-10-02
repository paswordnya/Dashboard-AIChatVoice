from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import RequestMetadata

router = APIRouter(prefix="/overview", tags=["overview"])


class OverviewKPIs(BaseModel):
    total_requests: int
    total_conversations: int
    total_active_users: int
    total_sessions: int
    average_response_time_ms: Optional[float]
    average_first_token_time_ms: Optional[float]
    success_rate: Optional[float]
    error_rate: Optional[float]
    tool_call_rate: Optional[float]


@router.get("", response_model=OverviewKPIs)
def get_overview_kpis(
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    db: Session = Depends(get_db),
) -> OverviewKPIs:
    """§1 Overview KPI cards. `start`/`end` implement the date-range filter (§21)."""
    query = select(RequestMetadata)
    if start is not None:
        query = query.where(RequestMetadata.timestamp >= start)
    if end is not None:
        query = query.where(RequestMetadata.timestamp <= end)

    rows = db.execute(query).scalars().all()
    total_requests = len(rows)

    if total_requests == 0:
        return OverviewKPIs(
            total_requests=0,
            total_conversations=0,
            total_active_users=0,
            total_sessions=0,
            average_response_time_ms=None,
            average_first_token_time_ms=None,
            success_rate=None,
            error_rate=None,
            tool_call_rate=None,
        )

    conversations = {r.conversation_id for r in rows if r.conversation_id}
    users = {r.user_id for r in rows if r.user_id}
    sessions = {r.session_id for r in rows}
    successes = sum(1 for r in rows if r.success)
    tool_calls = sum(1 for r in rows if r.tool_called)
    first_token_values = [r.first_token_latency_ms for r in rows if r.first_token_latency_ms is not None]

    return OverviewKPIs(
        total_requests=total_requests,
        total_conversations=len(conversations),
        total_active_users=len(users),
        total_sessions=len(sessions),
        average_response_time_ms=sum(r.latency_ms for r in rows) / total_requests,
        average_first_token_time_ms=(
            sum(first_token_values) / len(first_token_values) if first_token_values else None
        ),
        success_rate=successes / total_requests,
        error_rate=(total_requests - successes) / total_requests,
        tool_call_rate=tool_calls / total_requests,
    )
