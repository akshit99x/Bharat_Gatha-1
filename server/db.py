"""The database: classes, students and their saved progress.

SQLAlchemy runs the same code on SQLite (a laptop, the tests) and Postgres (a hosted deployment).
"""

from __future__ import annotations

import time
from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import BigInteger, ForeignKey, Index, Integer, String, Text, create_engine, event, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker
from sqlalchemy.pool import StaticPool

from .config import Settings


def now_ms() -> int:
    return int(time.time() * 1000)


class Base(DeclarativeBase):
    pass


class Classroom(Base):
    __tablename__ = "classes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(8), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(80))
    teacher_hash: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[int] = mapped_column(BigInteger, default=now_ms)
    last_active: Mapped[int] = mapped_column(BigInteger, default=now_ms)

    students: Mapped[list[Student]] = relationship(back_populates="classroom", cascade="all, delete-orphan")
    questions: Mapped[list[ClassQuestion]] = relationship(back_populates="classroom", cascade="all, delete-orphan")


class Student(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"), index=True)
    # A nickname, never a real name: students are children.
    nickname: Mapped[str] = mapped_column(String(24))
    code_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    created_at: Mapped[int] = mapped_column(BigInteger, default=now_ms)
    last_seen: Mapped[int] = mapped_column(BigInteger, default=now_ms)

    classroom: Mapped[Classroom] = relationship(back_populates="students")
    progress: Mapped[Progress | None] = relationship(back_populates="student", cascade="all, delete-orphan", uselist=False)


class Progress(Base):
    __tablename__ = "progress"

    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), primary_key=True)
    # The game's whole profile, as the game wrote it, so it can be restored exactly.
    profile_json: Mapped[str] = mapped_column(Text)
    # What the dashboard reads, worked out once on save so a report does not re-parse every profile.
    summary_json: Mapped[str] = mapped_column(Text)
    revision: Mapped[int] = mapped_column(Integer, default=1)
    # The game's own `updatedAt` for this profile (milliseconds), used to decide which side is newer.
    client_updated_at: Mapped[int] = mapped_column(BigInteger, default=0)
    saved_at: Mapped[int] = mapped_column(BigInteger, default=now_ms)

    student: Mapped[Student] = relationship(back_populates="progress")


class ClassQuestion(Base):
    __tablename__ = "class_questions"
    __table_args__ = (Index("ix_class_questions_class", "class_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"))
    zone_id: Mapped[str] = mapped_column(String(32))
    difficulty: Mapped[int] = mapped_column(Integer)
    skill: Mapped[str] = mapped_column(String(60))
    # The question as the game reads it (stem, options, answer, explain, context, tags), as JSON.
    body_json: Mapped[str] = mapped_column(Text)
    created_at: Mapped[int] = mapped_column(BigInteger, default=now_ms)

    classroom: Mapped[Classroom] = relationship(back_populates="questions")


class Database:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        kwargs: dict = {"future": True}
        if settings.is_sqlite:
            kwargs["connect_args"] = {"check_same_thread": False}
            if ":memory:" in settings.database_url:
                # One shared in-memory database, for the tests.
                kwargs["poolclass"] = StaticPool
        else:
            kwargs["pool_pre_ping"] = True
            kwargs["pool_size"] = 3
            kwargs["max_overflow"] = 2
        if settings.is_sqlite and settings.sqlite_path:
            import os

            os.makedirs(os.path.dirname(settings.sqlite_path) or ".", exist_ok=True)
        self.engine: Engine = create_engine(settings.database_url, **kwargs)
        if settings.is_sqlite:

            @event.listens_for(self.engine, "connect")
            def _sqlite_pragmas(dbapi_connection, _record) -> None:  # pragma: no cover - trivial
                cur = dbapi_connection.cursor()
                cur.execute("PRAGMA foreign_keys=ON")
                cur.execute("PRAGMA journal_mode=WAL")
                cur.close()

        Base.metadata.create_all(self.engine)
        self._session = sessionmaker(self.engine, expire_on_commit=False, future=True)

    @contextmanager
    def session(self) -> Iterator[Session]:
        s = self._session()
        try:
            yield s
            s.commit()
        except Exception:
            s.rollback()
            raise
        finally:
            s.close()

    def purge_idle(self, days: int) -> int:
        """Delete classes nobody has touched for `days` days, and with them their students' data."""
        if days <= 0:
            return 0
        cutoff = now_ms() - days * 86_400_000
        removed = 0
        with self.session() as s:
            for c in s.scalars(select(Classroom).where(Classroom.last_active < cutoff)).all():
                s.delete(c)
                removed += 1
        return removed
