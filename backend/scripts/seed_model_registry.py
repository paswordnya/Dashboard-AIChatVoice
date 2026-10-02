"""Seed model_registry with the models bpjs-pending-bot-local's
voice_router.py actually routes to today (per voice_routes.yaml /
config.py in that separate project — see this repo's CLAUDE.md for how the
two relate). Unlike seed.py (fabricated analytics volume for local UI
development), these rows are meant to be real config that
model_registry_client.py in that project reads back — provider and
model_identifier here MUST match voice_routes.yaml's (provider, model)
pairs exactly, or the Activate/Deactivate toggle on the dashboard's Model
Management page won't actually affect anything there.

No api_key is seeded for any row — the bot still authenticates via its own
.env (OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, ...), not via this
table. Test Connection / Validate Model / Test Model against these rows
from the dashboard UI will need a key entered by hand first for the
providers that require one; the (provider, model) pairs themselves are
still real and immediately usable for the Activate/Deactivate integration.

Idempotent — only inserts rows whose model_name doesn't already exist, so
re-running after someone has edited these from the dashboard won't stomp
their changes. Run from backend/:

    python scripts/seed_model_registry.py
"""

import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db import SessionLocal  # noqa: E402
from app.models import ModelRegistry  # noqa: E402

# (model_name, display_name, provider, api_base_url, model_identifier)
# base URLs/provider keys sourced from bpjs-pending-bot-local's config.py
# and voice_router.py (_STREAM_CALL / _PROVIDER_DEFAULT_MODEL) — see that
# project's CLAUDE.md before changing provider keys here, since
# voice_router.py's chain loop matches on the exact (provider, model) tuple.
MODELS = [
    ("lmstudio-gemma-4-e4b", "Gemma-4-E4B", "lmstudio", "http://localhost:1234/v1", "google/gemma-4-e4b"),
    ("lmstudio-gemma-4-26b", "Gemma-4-26B", "lmstudio", "http://localhost:1234/v1", "google/gemma-4-26b-a4b-qat"),
    ("lmstudio-qwen3-6-27b", "Qwen3.6-27B", "lmstudio", "http://localhost:1234/v1", "qwen/qwen3.6-27b"),
    ("lmstudio-nemotron-3-nano-4b", "Nemotron-3-Nano-4B", "lmstudio", "http://localhost:1234/v1", "nvidia/nemotron-3-nano-4b"),
    ("gemini-flash-lite-latest", "Gemini Flash Lite", "gemini", "https://generativelanguage.googleapis.com/v1beta", "gemini-flash-lite-latest"),
    ("openai-gpt-4o-mini", "GPT-4o mini", "openai", "https://api.openai.com/v1", "gpt-4o-mini"),
    ("anthropic-claude-sonnet-5", "Claude Sonnet 5", "anthropic", "https://api.anthropic.com/v1", "claude-sonnet-5"),
    ("ollama-llama3-2", "Llama 3.2", "ollama", "http://localhost:11434/v1", "llama3.2"),
]


def main() -> None:
    db = SessionLocal()
    try:
        existing = {row.model_name for row in db.query(ModelRegistry.model_name).all()}
        now = datetime.now(timezone.utc)
        inserted = 0
        for model_name, display_name, provider, api_base_url, model_identifier in MODELS:
            if model_name in existing:
                continue
            db.add(
                ModelRegistry(
                    model_name=model_name,
                    display_name=display_name,
                    provider=provider,
                    api_base_url=api_base_url,
                    api_key_encrypted=None,
                    model_identifier=model_identifier,
                    version=None,
                    context_window=None,
                    max_output_tokens=None,
                    timeout_ms=None,
                    supports_streaming=True,
                    supports_vision=False,
                    supports_function_calling=False,
                    supports_json_mode=False,
                    supports_embedding=False,
                    status="active",
                    created_at=now,
                    updated_at=now,
                )
            )
            inserted += 1
        db.commit()
        print(f"Inserted {inserted} model(s), {len(MODELS) - inserted} already present.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
