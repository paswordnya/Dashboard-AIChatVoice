"""Apply any new SQLAlchemy models to the database — the only "migration"
mechanism this backend has (no Alembic). Non-destructive: only creates
tables that don't exist yet (`checkfirst=True` is create_all's default),
never drops or alters an existing one. Run from backend/:

    python scripts/migrate.py

Safe to run repeatedly (e.g. after pulling new model classes) — existing
tables and their data are left untouched.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db import Base, engine  # noqa: E402
from app import models  # noqa: E402,F401 — import registers all model classes on Base.metadata


def main() -> None:
    Base.metadata.create_all(engine)
    print("Schema up to date:", ", ".join(sorted(Base.metadata.tables.keys())))


if __name__ == "__main__":
    main()
