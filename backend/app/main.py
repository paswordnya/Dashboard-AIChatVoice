import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.services import provider_health_sync
from app.routers import (
    categories,
    confidence,
    cost_savings,
    escalation,
    events,
    failed_questions,
    feature_adoption,
    intent_config,
    knowledge_gap,
    knowledge_source,
    mobile_devtools,
    model_defaults,
    model_registry,
    models,
    overview,
    pip_server_control,
    router_analytics,
    system_metrics,
    topics,
    users,
    voice_analytics,
    voice_trace,
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # See app/services/provider_health_sync.py — polls bpjs-pending-bot-local's
    # live provider status and auto-deactivates/reactivates model_registry
    # rows accordingly. Best-effort: sync_once() never raises past itself.
    task = asyncio.create_task(provider_health_sync.run_forever())
    yield
    task.cancel()


app = FastAPI(title="pip Voice AI — Analytics Dashboard API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(overview.router)
app.include_router(models.router)
app.include_router(router_analytics.router)
app.include_router(knowledge_source.router)
app.include_router(categories.router)
app.include_router(topics.router)
app.include_router(users.router)
app.include_router(cost_savings.router)
app.include_router(feature_adoption.router)
app.include_router(events.router)
app.include_router(confidence.router)
app.include_router(escalation.router)
app.include_router(knowledge_gap.router)
app.include_router(failed_questions.router)
app.include_router(intent_config.router)
app.include_router(model_registry.router)
app.include_router(model_defaults.router)
app.include_router(pip_server_control.router)
app.include_router(mobile_devtools.router)
app.include_router(system_metrics.router)
app.include_router(voice_analytics.router)
app.include_router(voice_trace.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
