"""Settings, read from the environment once.

Every setting has a safe default, so `uvicorn server.app:app` works on a laptop with nothing configured.
"""

from __future__ import annotations

import os
import tempfile
from dataclasses import dataclass, field
from pathlib import Path


def _normalise_db_url(url: str) -> str:
    """Hosted Postgres gives out `postgres://` or `postgresql://`; SQLAlchemy needs the driver named."""
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://") :]
    return url


@dataclass(frozen=True)
class Settings:
    # Where data lives. Set DATABASE_URL to a Postgres URL in production; otherwise a SQLite file is used.
    database_url: str = ""
    sqlite_path: str = ""
    # Origins allowed to call the API from a browser on a different address (the same-origin case needs none).
    cors_origins: tuple[str, ...] = field(default_factory=tuple)
    # Largest saved profile accepted, in bytes. A real profile is a few kilobytes.
    max_profile_bytes: int = 256_000
    max_students_per_class: int = 400
    max_questions_per_class: int = 200
    # Students and classes are deleted after this many idle days (0 turns it off). Children's data should not
    # be kept for ever by a hobby project.
    retention_days: int = 365
    # Running on a serverless host (Vercel sets VERCEL): its disk is wiped between runs.
    serverless: bool = False

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    @property
    def ephemeral(self) -> bool:
        """True when data will not survive a restart (SQLite on a serverless host's temp disk)."""
        return self.is_sqlite and self.serverless and self.sqlite_path.startswith(tempfile.gettempdir())


def load_settings(env: dict[str, str] | None = None) -> Settings:
    e = os.environ if env is None else env
    url = e.get("DATABASE_URL", "").strip()
    path = ""
    if url:
        url = _normalise_db_url(url)
    else:
        # A serverless host's disk is read-only apart from the temp folder, and the temp folder is forgotten.
        default = (
            Path(tempfile.gettempdir()) / "bharat-gatha.sqlite3"
            if e.get("VERCEL")
            else Path(__file__).resolve().parent.parent / "server" / "data" / "local.sqlite3"
        )
        path = e.get("BG_DB_PATH", str(default))
        url = f"sqlite:///{path}"
    origins = tuple(o.strip() for o in e.get("BG_CORS_ORIGINS", "").split(",") if o.strip())
    return Settings(
        database_url=url,
        sqlite_path=path,
        cors_origins=origins,
        max_profile_bytes=int(e.get("BG_MAX_PROFILE_BYTES", "256000")),
        max_students_per_class=int(e.get("BG_MAX_STUDENTS", "400")),
        max_questions_per_class=int(e.get("BG_MAX_QUESTIONS", "200")),
        retention_days=int(e.get("BG_RETENTION_DAYS", "365")),
        serverless=bool(e.get("VERCEL")),
    )
