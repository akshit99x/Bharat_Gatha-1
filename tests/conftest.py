from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from server.app import create_app
from server.config import Settings


@pytest.fixture()
def settings() -> Settings:
    return Settings(database_url="sqlite:///:memory:", sqlite_path="", max_students_per_class=5, max_questions_per_class=4, retention_days=0)


@pytest.fixture()
def client(settings: Settings) -> TestClient:
    return TestClient(create_app(settings))


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def classroom(client: TestClient) -> dict:
    r = client.post("/api/classes", json={"name": "Class 8B"})
    assert r.status_code == 201, r.text
    return r.json()


@pytest.fixture()
def student(client: TestClient, classroom: dict) -> dict:
    r = client.post(f"/api/classes/{classroom['code']}/join", json={"nickname": "Asha"})
    assert r.status_code == 201, r.text
    return r.json()


def sample_profile(**over) -> dict:
    """A profile shaped like the game's (src/core/Save.ts), a little way into chapter one."""
    p = {
        "version": 4,
        "createdAt": 1_700_000_000_000,
        "updatedAt": 1_700_000_500_000,
        "playerName": "Yatri",
        "worldSeed": "bharat-gatha",
        "vidya": 230,
        "codex": ["indus-townplan", "indus-greatbath"],
        "zones": {"sindhu": {"discovered": True, "challenges": ["sindhu-weights", "sindhu-drains"], "sealed": False, "bestSeal": 0, "timeSpent": 600}},
        "quests": {},
        "story": {
            "prologueSeen": True,
            "plaques": {"sindhu-massacre": {"done": True, "tries": 2}, "sindhu-unplanned": {"done": False, "tries": 4}},
            "panels": [],
            "openPicks": 3,
            "comfortPicks": 1,
            "sabhaDone": False,
            "twelfth": None,
        },
        "questions": {
            "gen:century:1": {"seen": 4, "right": 1, "streak": 0, "last": 1},
            "gen:evidence:9": {"seen": 3, "right": 3, "streak": 3, "last": 2},
        },
        "stats": {"quizAsked": 7, "quizRight": 4, "challengesDone": 2, "distanceWalked": 900, "playSeconds": 1800, "landmarksScanned": 2},
        "settings": {},
    }
    p.update(over)
    return p
