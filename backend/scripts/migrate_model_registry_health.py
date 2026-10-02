"""One-off schema migration: adds model_registry.auto_deactivated_reason,
backing app/services/provider_health_sync.py's auto-deactivate-on-provider-
error feature.

This repo has no Alembic despite it being a listed dependency (see
migrate.py's docstring) — schema changes beyond "add a new table" are
manual ALTER TABLE scripts, same convention as scripts/migrate_intent_config_chain.py.
`create_all` (migrate.py) never alters an existing table, so this script is
what actually adds the column to a live DB — run it once, before deploying
the code that expects it to exist:

    python scripts/migrate_model_registry_health.py

Idempotent: uses ADD COLUMN IF NOT EXISTS, safe to re-run.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text  # noqa: E402

from app.db import engine  # noqa: E402

STATEMENTS = [
    "ALTER TABLE model_registry ADD COLUMN IF NOT EXISTS auto_deactivated_reason TEXT",
]


def main() -> None:
    with engine.begin() as conn:
        for stmt in STATEMENTS:
            conn.execute(text(stmt))
        count = conn.execute(text("SELECT count(*) FROM model_registry")).scalar_one()
    print(f"model_registry.auto_deactivated_reason ready ({count} row(s) in table).")


if __name__ == "__main__":
    main()
