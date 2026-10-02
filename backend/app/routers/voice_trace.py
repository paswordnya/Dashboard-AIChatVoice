from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import RequestMetadata, VoiceTraceSpan
from app.routers.events import verify_api_key

router = APIRouter(prefix="/voice-trace", tags=["voice-trace"])

# Stage names that feed the Performance Metrics panel INSTEAD of the
# ordered T0-T12 timeline — see VoiceTraceSpan's docstring. Rows for these
# stages always have sequence=None. `vad` is deliberately NOT here: it's
# real timeline stage T1 (sequence=1, appears in `spans` for the waterfall's
# VAD row) whose duration ALSO feeds the performance panel's VAD Time card
# — see `_build_trace_detail`, which looks it up from the full row set.
_MIC_START_STAGE = "mic_start"
_MIC_STOP_STAGE = "mic_stop"
_VAD_STAGE = "vad"
_NOISE_SUPPRESSION_STAGE = "noise_suppression"
_AEC_STAGE = "aec"
_AGC_STAGE = "agc"
_PERFORMANCE_ONLY_STAGES = {
    _MIC_START_STAGE, _MIC_STOP_STAGE,
    _NOISE_SUPPRESSION_STAGE, _AEC_STAGE, _AGC_STAGE,
}


class VoiceTraceSpanIn(BaseModel):
    span_id: str
    stage: str
    sequence: Optional[int] = None
    timestamp: datetime
    duration_ms: Optional[float] = None
    status: str = "ok"
    provider: Optional[str] = None
    model: Optional[str] = None
    error: Optional[str] = None


class VoiceTraceBatchIn(BaseModel):
    trace_id: str
    session_id: str
    conversation_id: Optional[str] = None
    request_id: Optional[str] = None
    mode: str  # "a" | "b"
    spans: list[VoiceTraceSpanIn]


class VoiceTraceBatchOut(BaseModel):
    trace_id: str
    spans_ingested: int


@router.post("/spans", response_model=VoiceTraceBatchOut, status_code=201, dependencies=[Depends(verify_api_key)])
def create_voice_trace_spans(payload: VoiceTraceBatchIn, db: Session = Depends(get_db)) -> VoiceTraceBatchOut:
    """Batch ingest for one turn's worth of spans, sent once at turn
    completion by the bot's TraceRecorder.flush() (fire-and-forget, no
    retry — see VoiceTraceSpan's docstring for why there's no idempotency
    handling here, unlike /events' POST)."""
    now = datetime.now(timezone.utc)
    rows = [
        VoiceTraceSpan(
            trace_id=payload.trace_id,
            span_id=span.span_id,
            request_id=payload.request_id,
            session_id=payload.session_id,
            conversation_id=payload.conversation_id,
            mode=payload.mode,
            stage=span.stage,
            sequence=span.sequence,
            timestamp=span.timestamp,
            duration_ms=span.duration_ms,
            status=span.status,
            provider=span.provider,
            model=span.model,
            error=span.error,
            created_at=now,
        )
        for span in payload.spans
    ]
    db.add_all(rows)
    db.commit()
    return VoiceTraceBatchOut(trace_id=payload.trace_id, spans_ingested=len(rows))


class TraceSummary(BaseModel):
    trace_id: str
    session_id: str
    conversation_id: Optional[str]
    request_id: Optional[str]
    mode: str
    started_at: datetime
    ended_at: datetime
    total_duration_ms: float
    stage_count: int
    has_error: bool


@router.get("/traces", response_model=list[TraceSummary])
def list_voice_traces(
    mode: Optional[str] = None,
    session_id: Optional[str] = None,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    limit: int = Query(50, le=500),
    db: Session = Depends(get_db),
) -> list[TraceSummary]:
    # has_error is computed via a separate, cheaper query below rather than
    # a boolean-aggregation trick here (awkward/non-portable across SQL
    # dialects for a simple "any row in this group has status='error'" check).
    query = (
        select(
            VoiceTraceSpan.trace_id,
            func.min(VoiceTraceSpan.session_id).label("session_id"),
            func.min(VoiceTraceSpan.conversation_id).label("conversation_id"),
            func.min(VoiceTraceSpan.request_id).label("request_id"),
            func.min(VoiceTraceSpan.mode).label("mode"),
            func.min(VoiceTraceSpan.timestamp).label("started_at"),
            func.max(VoiceTraceSpan.timestamp).label("ended_at"),
            func.count(VoiceTraceSpan.id).label("stage_count"),
        )
        .group_by(VoiceTraceSpan.trace_id)
        .order_by(func.max(VoiceTraceSpan.timestamp).desc())
        .limit(limit)
    )
    if mode is not None:
        query = query.where(VoiceTraceSpan.mode == mode)
    if session_id is not None:
        query = query.where(VoiceTraceSpan.session_id == session_id)
    if start is not None:
        query = query.where(VoiceTraceSpan.timestamp >= start)
    if end is not None:
        query = query.where(VoiceTraceSpan.timestamp <= end)

    rows = db.execute(query).all()
    if not rows:
        return []

    trace_ids = [r.trace_id for r in rows]
    error_trace_ids = set(
        db.execute(
            select(VoiceTraceSpan.trace_id)
            .where(VoiceTraceSpan.trace_id.in_(trace_ids), VoiceTraceSpan.status == "error")
            .distinct()
        ).scalars()
    )

    return [
        TraceSummary(
            trace_id=r.trace_id,
            session_id=r.session_id,
            conversation_id=r.conversation_id,
            request_id=r.request_id,
            mode=r.mode,
            started_at=r.started_at,
            ended_at=r.ended_at,
            total_duration_ms=(r.ended_at - r.started_at).total_seconds() * 1000,
            stage_count=r.stage_count,
            has_error=r.trace_id in error_trace_ids,
        )
        for r in rows
    ]


class VoiceTraceSpanOut(BaseModel):
    span_id: str
    stage: str
    sequence: Optional[int]
    timestamp: datetime
    duration_ms: Optional[float]
    status: str
    provider: Optional[str]
    model: Optional[str]
    error: Optional[str]


class TracePerformance(BaseModel):
    mic_start_ms: Optional[float] = None
    mic_stop_ms: Optional[float] = None
    voice_duration_ms: Optional[float] = None
    vad_time_ms: Optional[float] = None
    noise_suppression_time_ms: Optional[float] = None
    echo_cancellation_time_ms: Optional[float] = None
    agc_time_ms: Optional[float] = None


class VoiceTraceDetail(BaseModel):
    trace_id: str
    session_id: str
    conversation_id: Optional[str]
    request_id: Optional[str]
    mode: str
    spans: list[VoiceTraceSpanOut]
    performance: TracePerformance


def _build_trace_detail(trace_id: str, rows: list[VoiceTraceSpan]) -> VoiceTraceDetail:
    timeline_rows = sorted(
        (r for r in rows if r.sequence is not None), key=lambda r: r.sequence,
    )
    perf_by_stage = {r.stage: r for r in rows if r.stage in _PERFORMANCE_ONLY_STAGES}
    vad_row = next((r for r in rows if r.stage == _VAD_STAGE), None)

    mic_start_row = perf_by_stage.get(_MIC_START_STAGE)
    mic_stop_row = perf_by_stage.get(_MIC_STOP_STAGE)
    mic_start_ms: Optional[float] = 0.0 if mic_start_row is not None else None
    mic_stop_ms: Optional[float] = None
    voice_duration_ms: Optional[float] = None
    if mic_start_row is not None and mic_stop_row is not None:
        mic_stop_ms = (mic_stop_row.timestamp - mic_start_row.timestamp).total_seconds() * 1000
        voice_duration_ms = mic_stop_ms

    performance = TracePerformance(
        mic_start_ms=mic_start_ms,
        mic_stop_ms=mic_stop_ms,
        voice_duration_ms=voice_duration_ms,
        vad_time_ms=vad_row.duration_ms if vad_row is not None else None,
        noise_suppression_time_ms=(
            perf_by_stage[_NOISE_SUPPRESSION_STAGE].duration_ms if _NOISE_SUPPRESSION_STAGE in perf_by_stage else None
        ),
        echo_cancellation_time_ms=perf_by_stage[_AEC_STAGE].duration_ms if _AEC_STAGE in perf_by_stage else None,
        agc_time_ms=perf_by_stage[_AGC_STAGE].duration_ms if _AGC_STAGE in perf_by_stage else None,
    )

    first = rows[0]
    return VoiceTraceDetail(
        trace_id=trace_id,
        session_id=first.session_id,
        conversation_id=first.conversation_id,
        request_id=first.request_id,
        mode=first.mode,
        spans=[
            VoiceTraceSpanOut(
                span_id=r.span_id, stage=r.stage, sequence=r.sequence, timestamp=r.timestamp,
                duration_ms=r.duration_ms, status=r.status, provider=r.provider, model=r.model, error=r.error,
            )
            for r in timeline_rows
        ],
        performance=performance,
    )


@router.get("/{trace_id}", response_model=VoiceTraceDetail)
def get_voice_trace(trace_id: str, db: Session = Depends(get_db)) -> VoiceTraceDetail:
    rows = list(
        db.execute(select(VoiceTraceSpan).where(VoiceTraceSpan.trace_id == trace_id)).scalars().all()
    )
    if not rows:
        raise HTTPException(status_code=404, detail="trace_id not found")
    return _build_trace_detail(trace_id, rows)


@router.get("/by-request/{request_id}", response_model=VoiceTraceDetail)
def get_voice_trace_by_request(request_id: str, db: Session = Depends(get_db)) -> VoiceTraceDetail:
    """Convenience cross-link for a dashboard user looking at a normal
    RequestMetadata row who wants to jump straight to its trace."""
    metadata_row = db.get(RequestMetadata, request_id)
    if metadata_row is None or metadata_row.trace_id is None:
        raise HTTPException(status_code=404, detail="no trace_id linked to this request_id")
    return get_voice_trace(metadata_row.trace_id, db)
