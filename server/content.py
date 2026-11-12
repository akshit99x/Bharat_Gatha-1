"""The game's content, loaded from server/data/content.json (written by `npm run content:export`).

The game is the source of truth. This is a read-only copy so the API can name regions, count what a student
could have done, and check a teacher's question against the same fields the game uses.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

CONTENT_PATH = Path(__file__).resolve().parent / "data" / "content.json"

# Mirrors skillForGeneratedId in src/quiz/QuestionBank.ts: generated questions carry their kind in the id.
GENERATED_SKILLS = {
    "chrono-first": "Chronological reasoning",
    "chrono-last": "Chronological reasoning",
    "century": "Dating and periodisation",
    "era-order": "Dating and periodisation",
    "evidence": "Evaluating evidence",
    "region": "Regional geography",
}


@dataclass(frozen=True)
class Content:
    zones: list[dict]
    codex: list[dict]
    questions: list[dict]

    @property
    def zone_ids(self) -> list[str]:
        return [z["id"] for z in self.zones]

    @property
    def zone_by_id(self) -> dict[str, dict]:
        return {z["id"]: z for z in self.zones}

    @property
    def skills(self) -> list[str]:
        return sorted({q["skill"] for q in self.questions} | set(GENERATED_SKILLS.values()))

    @property
    def skill_of_question(self) -> dict[str, str]:
        return {q["id"]: q["skill"] for q in self.questions}

    @property
    def plaque_total(self) -> int:
        return sum(len((z.get("story") or {}).get("plaques", [])) for z in self.zones)

    def skill_for(self, question_id: str) -> str | None:
        """The skill a recorded answer counts toward: authored questions by id, generated ones by kind."""
        known = self.skill_of_question.get(question_id)
        if known:
            return known
        if question_id.startswith("gen:"):
            parts = question_id.split(":")
            return GENERATED_SKILLS.get(parts[1] if len(parts) > 1 else "")
        if question_id.startswith("class:"):
            return None  # counted by the class-question skill recorded at the time, see analytics
        return None


@lru_cache(maxsize=1)
def load_content(path: Path = CONTENT_PATH) -> Content:
    data = json.loads(path.read_text(encoding="utf-8"))
    return Content(zones=data["zones"], codex=data["codex"], questions=data["questions"])
