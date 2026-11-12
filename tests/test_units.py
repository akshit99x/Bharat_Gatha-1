"""The pure parts: codes, analytics, readability and the content export."""

from __future__ import annotations

from conftest import sample_profile

from server.analytics import class_report, flags_for, safe_cell, summarise_profile
from server.config import load_settings
from server.content import load_content
from server.readability import analyse, count_syllables
from server.security import (
    ALPHABET,
    RateLimiter,
    clean_code,
    new_class_code,
    new_student_code,
    same_secret,
    hash_secret,
    valid_class_code,
    valid_student_code,
)


def test_codes_use_a_forgiving_alphabet():
    for _ in range(200):
        c, s = new_class_code(), new_student_code()
        assert valid_class_code(c) and valid_student_code(s)
        assert set(c) <= set(ALPHABET) and not set(c) & set("ILOU")
    assert clean_code("k7m2 qx") == "K7M2QX"
    assert clean_code("o0il-u") == "0011V"  # look-alikes folded to what the code can contain
    assert not valid_class_code("K7M2Q") and not valid_student_code("AAAA-AAAA")


def test_secret_comparison():
    h = hash_secret("abc")
    assert same_secret("abc", h) and not same_secret("abd", h) and len(h) == 64


def test_rate_limiter_slides():
    now = [0.0]
    r = RateLimiter(3, 10, clock=lambda: now[0])
    assert [r.allow("k") for _ in range(4)] == [True, True, True, False]
    assert r.allow("other")
    now[0] = 11
    assert r.allow("k")


def test_content_export_matches_the_game():
    c = load_content()
    assert len(c.zones) == 11 and len(c.codex) == 104 and len(c.questions) >= 150
    assert c.plaque_total == 33
    assert all(z["landmarks"] and z["challenges"] for z in c.zones)
    assert c.skill_for("gen:region:3") == "Regional geography" and c.skill_for("gen:nonsense:1") is None
    some = c.questions[0]
    assert c.skill_for(some["id"]) == some["skill"]


def test_summary_handles_a_normal_profile():
    s = summarise_profile(sample_profile(), load_content())
    assert s["vidya"] == 230 and s["codex"] == 2 and s["quizAsked"] == 7 and s["accuracy"] == round(4 / 7, 3)
    assert s["chaptersStarted"] == 1 and s["plaquesCorrected"] == 1 and s["playMinutes"] == 30.0
    assert {x["skill"] for x in s["skills"]} == {"Dating and periodisation", "Evaluating evidence"}
    assert s["skills"][0]["accuracy"] < s["skills"][1]["accuracy"]  # weakest first
    assert s["plaqueTries"] == {"sindhu-massacre": 2, "sindhu-unplanned": 4}


def test_summary_survives_hostile_or_broken_profiles():
    c = load_content()
    garbage = [
        {"version": 4},
        {"version": 4, "zones": {"sindhu": "nope"}, "story": [], "questions": {"gen:century:1": 5, 7: {"seen": "x"}}, "stats": None, "codex": "abc"},
        {"version": 4, "vidya": float("nan"), "stats": {"quizAsked": 3, "quizRight": 99}},
        {"version": 4, "questions": {"gen:century:1": {"seen": 2, "right": 50}}},
    ]
    for g in garbage:
        s = summarise_profile(g, c)
        assert isinstance(s["vidya"], int) and 0 <= s["quizRight"] <= max(s["quizAsked"], 0)
        assert all(0 <= ch["fraction"] <= 1 for ch in s["chapters"])
    assert summarise_profile(garbage[3], c)["skills"][0]["right"] == 2  # right is capped at seen


def test_flags_are_plain_and_specific():
    c = load_content()
    base = summarise_profile(sample_profile(), c)
    day = 86_400_000
    now = 100 * day
    assert flags_for(base, now - day, now) == []
    assert "Not played for 20 days" in flags_for(base, now - 20 * day, now)
    hard = dict(base, quizAsked=20, quizRight=5, accuracy=0.25)
    assert "Finding the questions hard" in flags_for(hard, now, now)
    comfy = dict(base, comfortPicks=9, openPicks=2)
    assert any("comfortable" in f for f in flags_for(comfy, now, now))


def test_class_report_with_no_synced_students_is_empty_not_an_error():
    rep = class_report([{"id": 1, "nickname": "Solo", "last_seen": 0, "saved_at": None, "summary": None}], load_content())
    assert rep["students"] == 1 and rep["synced"] == 0 and rep["averageVidya"] == 0 and rep["averageAccuracy"] is None
    assert all(c["started"] == 0 for c in rep["chapters"]) and rep["roster"][0]["hasProgress"] is False
    assert class_report([], load_content())["students"] == 0


def test_spreadsheet_cells_cannot_be_formulas():
    assert safe_cell("=1+1") == "'=1+1" and safe_cell("@SUM(A1)") == "'@SUM(A1)" and safe_cell("Asha") == "Asha" and safe_cell(5) == 5


def test_syllables_and_reading_grade():
    assert [count_syllables(w) for w in ["the", "water", "history", "civilisation", "made", "tower"]] == [1, 2, 3, 5, 1, 2]
    easy = analyse("The city had wide streets. People lived in brick houses. Water ran in drains.")
    hard = analyse("Archaeological investigations demonstrate extraordinarily sophisticated hydraulic infrastructure throughout settlements.")
    assert easy["grade"] < 5 < 14 < hard["grade"]
    assert analyse("")["grade"] is None


def test_settings_defaults_and_postgres_url_normalising(tmp_path):
    s = load_settings({"BG_DB_PATH": str(tmp_path / "x.db")})
    assert s.is_sqlite and not s.ephemeral
    p = load_settings({"DATABASE_URL": "postgres://u:p@h/db"})
    assert p.database_url == "postgresql+psycopg://u:p@h/db" and not p.is_sqlite
    assert load_settings({"DATABASE_URL": "postgresql://u@h/db"}).database_url == "postgresql+psycopg://u@h/db"
    assert load_settings({"VERCEL": "1"}).ephemeral  # serverless without a database forgets its data
