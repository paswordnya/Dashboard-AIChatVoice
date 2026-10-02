"""Background poll loop (started from app/main.py's lifespan) that mirrors
bpjs-pending-bot-local's live provider cooldown state onto this dashboard's
own model_registry table — the "auto-deactivate a model when its provider is
erroring" half of the Model Management health feature (the other half is the
`auto_deactivated_reason` column on ModelRegistry and the Health column in
frontend/components/model-registry-table.tsx).

Read-only against the bot: this only calls bpjs-pending-bot-local's
dashboard_api.py GET /api/dashboard/provider-status and writes to this
backend's OWN database. The two repos don't share a DB or any code (see both
projects' CLAUDE.md) — bpjs's provider_health.py/ai_router.py are production
code for the live Telegram bot and are deliberately left untouched; all the
new logic lives here instead.

Provider-level granularity only, matching provider_health.py's own
granularity: bpjs's provider_cooldown_state.json (and therefore
/provider-status) tracks cooldown per PROVIDER ("gemini" down), not per
model. So one provider going down cascades to every model_registry row
sharing that provider — there's no finer-grained signal to key off yet.

Best-effort like model_registry_client.py's read of this same table in the
opposite direction: missing bot credentials, or any network/HTTP failure
talking to the bot, just skips that poll cycle silently rather than raising
into the loop or blocking dashboard startup.
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import urllib.error
import urllib.request
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import SessionLocal
from app.models import ModelRegistry

logger = logging.getLogger(__name__)

# bpjs-pending-bot-local's ai_providers.provider_key uses "claude" for
# Anthropic (see ai_router.py's _MODEL_REGISTRY_PROVIDER_ALIAS); this
# dashboard's model_registry.provider uses "anthropic" instead. Same alias,
# duplicated here since the two repos share no code.
_PROVIDER_ALIAS = {"claude": "anthropic"}


def _fetch_provider_status() -> list[dict] | None:
    if not settings.bot_dashboard_user or not settings.bot_dashboard_password:
        logger.info("provider_health_sync: BOT_DASHBOARD_USER/PASSWORD belum diset, skip cycle ini")
        return None

    url = f"{settings.bot_api_url.rstrip('/')}/api/dashboard/provider-status"
    credentials = base64.b64encode(
        f"{settings.bot_dashboard_user}:{settings.bot_dashboard_password}".encode()
    ).decode()
    req = urllib.request.Request(url, headers={"Authorization": f"Basic {credentials}"})
    try:
        with urllib.request.urlopen(req, timeout=5.0) as resp:
            return json.loads(resp.read())
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as e:
        logger.warning("provider_health_sync: gagal fetch provider-status dari bot (%s)", e)
        return None


def sync_once(db: Session) -> None:
    statuses = _fetch_provider_status()
    if statuses is None:
        return

    now = datetime.now(timezone.utc)
    for entry in statuses:
        provider = _PROVIDER_ALIAS.get(entry["provider_key"], entry["provider_key"])
        rows = db.execute(select(ModelRegistry).where(ModelRegistry.provider == provider)).scalars().all()
        for row in rows:
            if entry["is_down"] and row.status == "active":
                row.status = "inactive"
                row.auto_deactivated_reason = entry.get("reason") or "unknown"
                row.updated_at = now
                logger.info(
                    "provider_health_sync: deactivated model=%s (provider=%s down, reason=%s)",
                    row.model_name, provider, row.auto_deactivated_reason,
                )
            elif not entry["is_down"] and row.auto_deactivated_reason is not None:
                row.status = "active"
                row.auto_deactivated_reason = None
                row.updated_at = now
                logger.info("provider_health_sync: reactivated model=%s (provider=%s recovered)", row.model_name, provider)
    db.commit()


async def run_forever() -> None:
    """Runs until cancelled (main.py's lifespan cancels this task on
    shutdown). Each cycle opens/closes its own session — this loop
    outlives any single request, so it can't borrow one from get_db()."""
    interval = settings.provider_health_sync_interval_seconds
    while True:
        try:
            db = SessionLocal()
            try:
                sync_once(db)
            finally:
                db.close()
        except Exception:
            logger.exception("provider_health_sync: sync_once gagal, lanjut ke cycle berikutnya")
        await asyncio.sleep(interval)
