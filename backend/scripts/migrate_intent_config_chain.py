"""One-off schema migration: intent_config's fixed 2-tier
(model/provider/fallback_model/fallback_provider) columns -> a single
`chain` JSONB column (ordered list of {"provider","model"}, any length).

This repo has no Alembic despite it being a listed dependency (see
migrate.py's docstring) — schema changes beyond "add a new table" are
manual ALTER TABLE scripts, same convention documented in models.py's
RequestMetadata.trace_id comment. `create_all` (migrate.py) never alters an
existing table, so this script is the only thing that actually moves
intent_config's 17 real rows (bpjs-pending-bot-local's live voice routing
config, not disposable seed data) onto the new schema — run it once, before
deploying the code that expects `chain` to exist:

    python scripts/migrate_intent_config_chain.py

Idempotent: the backfill only touches rows where chain IS NULL, and the
column-add/drop statements use IF [NOT] EXISTS, so re-running after a
partial failure or after the migration already completed is safe.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text  # noqa: E402

from app.db import engine  # noqa: E402

STATEMENTS = [
    "ALTER TABLE intent_config ADD COLUMN IF NOT EXISTS chain JSONB",
    """
    UPDATE intent_config
    SET chain = CASE
        WHEN fallback_model IS NOT NULL THEN
            jsonb_build_array(
                jsonb_build_object('provider', provider, 'model', model),
                jsonb_build_object('provider', COALESCE(fallback_provider, provider), 'model', fallback_model)
            )
        ELSE
            jsonb_build_array(jsonb_build_object('provider', provider, 'model', model))
    END
    WHERE chain IS NULL
    """,
    "ALTER TABLE intent_config ALTER COLUMN chain SET NOT NULL",
    "ALTER TABLE intent_config DROP COLUMN IF EXISTS model",
    "ALTER TABLE intent_config DROP COLUMN IF EXISTS provider",
    "ALTER TABLE intent_config DROP COLUMN IF EXISTS fallback_model",
    "ALTER TABLE intent_config DROP COLUMN IF EXISTS fallback_provider",
]


def main() -> None:
    with engine.begin() as conn:
        before = conn.execute(text("SELECT count(*) FROM intent_config")).scalar_one()
        for stmt in STATEMENTS:
            conn.execute(text(stmt))
        after = conn.execute(text("SELECT intent, chain FROM intent_config ORDER BY intent")).all()
    print(f"Migrated intent_config: {before} row(s) before, {len(after)} after.")
    for intent, chain in after:
        print(f"  {intent}: {chain}")


if __name__ == "__main__":
    main()
