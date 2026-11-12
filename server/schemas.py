"""Request and response shapes, and the checks on what a teacher or a child may send."""

from __future__ import annotations

import re
import unicodedata
from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator

from .content import load_content

_NICK = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 _.'\-]{1,19}$")
_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def clean_text(value: str) -> str:
    """Collapse whitespace and strip control characters. Text is shown with textContent, never as HTML."""
    v = unicodedata.normalize("NFC", _CONTROL.sub("", value))
    return re.sub(r"[ \t]+", " ", v).strip()


class NewClass(BaseModel):
    name: str = Field(min_length=2, max_length=80)

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        v = clean_text(v)
        if len(v) < 2:
            raise ValueError("Give the class a name of at least two characters.")
        return v


class ClassCreated(BaseModel):
    code: str
    name: str
    teacher_token: str
    note: str = "Keep the teacher token safe: it is the only way back into this class's dashboard, and it cannot be recovered."


class ClassInfo(BaseModel):
    code: str
    name: str
    students: int


class JoinRequest(BaseModel):
    nickname: str

    @field_validator("nickname")
    @classmethod
    def _nick(cls, v: str) -> str:
        v = clean_text(v)
        if not _NICK.match(v):
            raise ValueError("Use 2 to 20 letters, numbers or spaces, and start with a letter or number. A nickname, not your real name.")
        return v


class Joined(BaseModel):
    student_code: str
    nickname: str
    class_code: str
    class_name: str
    note: str = "Write this code down. It brings your progress back on any device, and it cannot be recovered if lost."


class Me(BaseModel):
    nickname: str
    class_code: str
    class_name: str
    has_progress: bool
    revision: int = 0
    client_updated_at: int = 0


class ProgressIn(BaseModel):
    profile: dict[str, Any]
    # Overwrite even if the cloud copy is newer (the student chose "use this device").
    force: bool = False

    @model_validator(mode="after")
    def _shape(self) -> ProgressIn:
        p = self.profile
        if not isinstance(p.get("version"), int):
            raise ValueError("This does not look like a Bharat Gatha profile.")
        if not isinstance(p.get("zones", {}), dict):
            raise ValueError("This does not look like a Bharat Gatha profile.")
        return self


class ProgressSaved(BaseModel):
    revision: int
    saved_at: int


class ProgressOut(BaseModel):
    profile: dict[str, Any]
    revision: int
    client_updated_at: int


class QuestionIn(BaseModel):
    zone_id: str
    difficulty: int = Field(ge=1, le=3)
    stem: str = Field(min_length=10, max_length=300)
    context: str | None = Field(default=None, max_length=400)
    options: list[str] = Field(min_length=2, max_length=4)
    answer: int = Field(ge=0, le=3)
    explain: str = Field(min_length=10, max_length=500)
    skill: str = Field(default="Class question", min_length=2, max_length=60)
    tags: list[str] = Field(default_factory=list, max_length=5)

    @field_validator("zone_id")
    @classmethod
    def _zone(cls, v: str) -> str:
        if v != "general" and v not in load_content().zone_ids:
            raise ValueError("Unknown region. Use a region id from /api/content, or 'general'.")
        return v

    @field_validator("stem", "explain", "skill")
    @classmethod
    def _text(cls, v: str) -> str:
        return clean_text(v)

    @field_validator("context")
    @classmethod
    def _ctx(cls, v: str | None) -> str | None:
        v = clean_text(v) if v else None
        return v or None

    @field_validator("options")
    @classmethod
    def _options(cls, v: list[str]) -> list[str]:
        out = [clean_text(o) for o in v]
        if any(not o or len(o) > 160 for o in out):
            raise ValueError("Each option must be between 1 and 160 characters.")
        if len({o.lower() for o in out}) != len(out):
            raise ValueError("Two options are the same.")
        return out

    @field_validator("tags")
    @classmethod
    def _tags(cls, v: list[str]) -> list[str]:
        return [t for t in (clean_text(t).lower()[:30] for t in v) if t]

    @model_validator(mode="after")
    def _answer(self) -> QuestionIn:
        if self.answer >= len(self.options):
            raise ValueError("The correct answer must be one of the options.")
        return self


class QuestionOut(BaseModel):
    """A question in the game's own shape (see `Question` in src/content/types.ts)."""

    id: str
    zoneId: str
    difficulty: int
    stem: str
    context: str | None = None
    options: list[str]
    answer: int
    explain: str
    tags: list[str]
    skill: str
    readingGrade: float | None = None
    warnings: list[str] = Field(default_factory=list)
