"""The API end to end: a teacher makes a class, students join and save, the teacher reads the report."""

from __future__ import annotations

from conftest import auth, sample_profile


def test_health_and_content(client):
    h = client.get("/api/health").json()
    assert h["ok"] and h["storage"] == "sqlite"
    c = client.get("/api/content").json()
    assert len(c["zones"]) == 11 and "Chronological reasoning" in c["skills"]


def test_create_class_and_look_it_up(client, classroom):
    assert len(classroom["code"]) == 6 and len(classroom["teacher_token"]) >= 30
    info = client.get(f"/api/classes/{classroom['code'].lower()}").json()  # case does not matter
    assert info == {"code": classroom["code"], "name": "Class 8B", "students": 0}
    assert client.get("/api/classes/ZZZZZZ").status_code == 404
    assert client.get("/api/classes/nope").status_code == 404


def test_class_name_is_cleaned_and_required(client):
    assert client.post("/api/classes", json={"name": "x"}).status_code == 422
    assert client.post("/api/classes", json={}).status_code == 422
    r = client.post("/api/classes", json={"name": "  Class   9A \x00 "}).json()
    assert r["name"] == "Class 9A"


def test_join_gives_a_code_and_rejects_bad_or_taken_nicknames(client, classroom):
    code = classroom["code"]
    ok = client.post(f"/api/classes/{code}/join", json={"nickname": "Ravi K"})
    assert ok.status_code == 201
    body = ok.json()
    assert len(body["student_code"]) == 14 and body["student_code"].count("-") == 2
    assert client.post(f"/api/classes/{code}/join", json={"nickname": "ravi k"}).status_code == 409  # taken, any case
    for bad in ["a", "=cmd|' /C calc'!A0", "<script>", "x" * 30, " ", "-dash"]:
        assert client.post(f"/api/classes/{code}/join", json={"nickname": bad}).status_code == 422, bad
    assert client.post("/api/classes/ZZZZZZ/join", json={"nickname": "Meera"}).status_code == 404


def test_class_can_be_full(client, classroom):
    for i in range(5):
        assert client.post(f"/api/classes/{classroom['code']}/join", json={"nickname": f"Kid {i}"}).status_code == 201
    assert client.post(f"/api/classes/{classroom['code']}/join", json={"nickname": "Late"}).status_code == 409


def test_student_credentials_are_required_and_exact(client, student):
    assert client.get("/api/me").status_code == 401
    assert client.get("/api/me", headers=auth("nonsense")).status_code == 403
    assert client.get("/api/me", headers=auth("AAAA-AAAA-AAAA")).status_code == 403
    me = client.get("/api/me", headers=auth(student["student_code"])).json()
    assert me["nickname"] == "Asha" and me["has_progress"] is False
    # Typed by a child: lower case, spaces instead of dashes, look-alike letters.
    typed = student["student_code"].lower().replace("-", " ")
    assert client.get("/api/me", headers=auth(typed)).status_code == 200


def test_save_and_restore_progress(client, student):
    h = auth(student["student_code"])
    assert client.get("/api/me/progress", headers=h).status_code == 404
    p = sample_profile()
    saved = client.put("/api/me/progress", json={"profile": p}, headers=h)
    assert saved.status_code == 200 and saved.json()["revision"] == 1
    back = client.get("/api/me/progress", headers=h).json()
    assert back["profile"] == p and back["client_updated_at"] == p["updatedAt"]  # exactly as the game wrote it
    p2 = sample_profile(updatedAt=p["updatedAt"] + 1000, vidya=300)
    assert client.put("/api/me/progress", json={"profile": p2}, headers=h).json()["revision"] == 2
    assert client.get("/api/me/progress", headers=h).json()["profile"]["vidya"] == 300
    assert client.get("/api/me", headers=h).json()["has_progress"] is True


def test_older_device_cannot_silently_overwrite_newer_cloud_progress(client, student):
    h = auth(student["student_code"])
    client.put("/api/me/progress", json={"profile": sample_profile(updatedAt=2_000, vidya=500)}, headers=h)
    stale = client.put("/api/me/progress", json={"profile": sample_profile(updatedAt=1_000, vidya=10)}, headers=h)
    assert stale.status_code == 409 and stale.json()["error"]["client_updated_at"] == 2_000
    assert client.get("/api/me/progress", headers=h).json()["profile"]["vidya"] == 500  # untouched
    forced = client.put("/api/me/progress", json={"profile": sample_profile(updatedAt=1_000, vidya=10), "force": True}, headers=h)
    assert forced.status_code == 200
    assert client.get("/api/me/progress", headers=h).json()["profile"]["vidya"] == 10


def test_rejects_things_that_are_not_profiles_or_are_huge(client, student):
    h = auth(student["student_code"])
    assert client.put("/api/me/progress", json={"profile": {"hello": 1}}, headers=h).status_code == 422
    assert client.put("/api/me/progress", json={"profile": "text"}, headers=h).status_code == 422
    assert client.put("/api/me/progress", json={}, headers=h).status_code == 422
    huge = sample_profile(notes="x" * 300_000)
    assert client.put("/api/me/progress", json={"profile": huge}, headers=h).status_code == 413


def test_one_students_code_cannot_touch_anothers_data(client, classroom):
    a = client.post(f"/api/classes/{classroom['code']}/join", json={"nickname": "Asha"}).json()
    b = client.post(f"/api/classes/{classroom['code']}/join", json={"nickname": "Bela"}).json()
    client.put("/api/me/progress", json={"profile": sample_profile(vidya=111)}, headers=auth(a["student_code"]))
    assert client.get("/api/me/progress", headers=auth(b["student_code"])).status_code == 404
    client.put("/api/me/progress", json={"profile": sample_profile(vidya=222)}, headers=auth(b["student_code"]))
    assert client.get("/api/me/progress", headers=auth(a["student_code"])).json()["profile"]["vidya"] == 111


def test_teacher_report(client, classroom, student):
    t = auth(classroom["teacher_token"])
    code = classroom["code"]
    assert client.get(f"/api/classes/{code}/report").status_code == 401
    assert client.get(f"/api/classes/{code}/report", headers=auth("wrong")).status_code == 403
    client.put("/api/me/progress", json={"profile": sample_profile()}, headers=auth(student["student_code"]))
    client.post(f"/api/classes/{code}/join", json={"nickname": "Bela"})  # joined, nothing saved yet
    rep = client.get(f"/api/classes/{code}/report", headers=t).json()
    assert rep["class"]["name"] == "Class 8B"
    assert rep["students"] == 2 and rep["synced"] == 1
    assert rep["averageVidya"] == 230
    names = [s["nickname"] for s in rep["roster"]]
    assert names == ["Asha", "Bela"]
    asha = rep["roster"][0]["summary"]
    assert asha["quizAsked"] == 7 and asha["accuracy"] == round(4 / 7, 3) and asha["codex"] == 2
    sindhu = next(c for c in asha["chapters"] if c["zone"] == "sindhu")
    assert sindhu["discovered"] and sindhu["challenges"] == 2 and sindhu["plaques"] == 1
    assert rep["roster"][1]["hasProgress"] is False
    assert rep["hardestPlaques"][0]["id"] == "sindhu-unplanned" and rep["hardestPlaques"][0]["avgTries"] == 4
    assert {s["skill"] for s in rep["skills"]} == {"Dating and periodisation", "Evaluating evidence"}


def test_another_class_teacher_token_does_not_open_this_class(client, classroom):
    other = client.post("/api/classes", json={"name": "Other"}).json()
    assert client.get(f"/api/classes/{classroom['code']}/report", headers=auth(other["teacher_token"])).status_code == 403


def test_csv_export_is_safe_for_spreadsheets(client, classroom, student):
    # A nickname cannot begin with =, +, - or @ (the schema forbids it), and the CSV defends anyway.
    client.put("/api/me/progress", json={"profile": sample_profile()}, headers=auth(student["student_code"]))
    r = client.get(f"/api/classes/{classroom['code']}/report.csv", headers=auth(classroom["teacher_token"]))
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv")
    lines = r.text.lstrip("﻿").splitlines()
    assert lines[0].startswith("nickname,vidya,codex_entries")
    assert lines[1].startswith("Asha,230,2,")
    assert "attachment" in r.headers["content-disposition"]


def test_teacher_can_remove_a_student_and_delete_the_class(client, classroom, student):
    t = auth(classroom["teacher_token"])
    code = classroom["code"]
    rep = client.get(f"/api/classes/{code}/report", headers=t).json()
    sid = rep["roster"][0]["id"]
    assert client.delete(f"/api/classes/{code}/students/{sid + 99}", headers=t).status_code == 404
    assert client.delete(f"/api/classes/{code}/students/{sid}", headers=t).status_code == 204
    assert client.get("/api/me", headers=auth(student["student_code"])).status_code == 403  # their code no longer works
    assert client.delete(f"/api/classes/{code}", headers=t).status_code == 204
    assert client.get(f"/api/classes/{code}").status_code == 404


def test_student_can_leave_and_erase_their_data(client, student):
    h = auth(student["student_code"])
    client.put("/api/me/progress", json={"profile": sample_profile()}, headers=h)
    assert client.delete("/api/me", headers=h).status_code == 204
    assert client.get("/api/me/progress", headers=h).status_code == 403


def _question(**over):
    q = {
        "zone_id": "sindhu",
        "difficulty": 2,
        "stem": "Which Indus city had a great bath at its citadel?",
        "options": ["Mohenjo-daro", "Lothal", "Dholavira"],
        "answer": 0,
        "explain": "The Great Bath stands on the citadel mound at Mohenjo-daro.",
    }
    q.update(over)
    return q


def test_class_questions_round_trip_to_students_in_the_games_shape(client, classroom, student):
    t = auth(classroom["teacher_token"])
    code = classroom["code"]
    made = client.post(f"/api/classes/{code}/questions", json=_question(), headers=t)
    assert made.status_code == 201
    q = made.json()
    assert q["id"].startswith("class:") and q["zoneId"] == "sindhu" and q["answer"] == 0 and q["skill"] == "Class question"
    mine = client.get("/api/me/questions", headers=auth(student["student_code"])).json()
    assert [m["id"] for m in mine] == [q["id"]]
    assert set(mine[0]) >= {"id", "zoneId", "difficulty", "stem", "options", "answer", "explain", "tags", "skill"}
    qid = int(q["id"].split(":")[1])
    assert client.delete(f"/api/classes/{code}/questions/{qid}", headers=t).status_code == 204
    assert client.get("/api/me/questions", headers=auth(student["student_code"])).json() == []


def test_question_validation(client, classroom):
    t = auth(classroom["teacher_token"])
    code = classroom["code"]
    bad = [
        _question(zone_id="atlantis"),
        _question(difficulty=4),
        _question(stem="Too short"),
        _question(options=["Only one"]),
        _question(options=["Same", "same", "Other"]),
        _question(options=["a", "b", "c", "d", "e"]),
        _question(answer=3),  # only three options
        _question(explain="short"),
    ]
    for q in bad:
        assert client.post(f"/api/classes/{code}/questions", json=q, headers=t).status_code == 422, q
    assert client.post(f"/api/classes/{code}/questions", json=_question(zone_id="general"), headers=t).status_code == 201


def test_hard_to_read_questions_get_a_warning_not_a_refusal(client, classroom):
    t = auth(classroom["teacher_token"])
    heavy = _question(
        stem="Notwithstanding considerable historiographical disagreement regarding chronological reconstruction, which civilisation demonstrated municipal sophistication?",
        explain="Archaeological investigations demonstrate extraordinarily sophisticated hydraulic infrastructure throughout settlements.",
    )
    q = client.post(f"/api/classes/{classroom['code']}/questions", json=heavy, headers=t).json()
    assert q["readingGrade"] > 10 and q["warnings"]


def test_question_limit(client, classroom):
    t = auth(classroom["teacher_token"])
    for _ in range(4):
        assert client.post(f"/api/classes/{classroom['code']}/questions", json=_question(), headers=t).status_code == 201
    assert client.post(f"/api/classes/{classroom['code']}/questions", json=_question(), headers=t).status_code == 409


def test_the_teachers_token_and_students_codes_are_not_stored_in_clear(settings):
    from sqlalchemy import text

    from server.app import create_app

    app = create_app(settings)
    from fastapi.testclient import TestClient

    c = TestClient(app)
    cl = c.post("/api/classes", json={"name": "Hash check"}).json()
    st = c.post(f"/api/classes/{cl['code']}/join", json={"nickname": "Zed"}).json()
    with app.state.db.engine.connect() as conn:
        everything = " ".join(str(v) for t in ("classes", "students") for row in conn.execute(text(f"select * from {t}")) for v in row)
    assert cl["teacher_token"] not in everything
    assert st["student_code"].replace("-", "") not in everything and st["student_code"] not in everything


def test_rate_limit_slows_class_creation(client):
    codes = [client.post("/api/classes", json={"name": f"Class {i}"}).status_code for i in range(8)]
    assert codes[:6] == [201] * 6 and 429 in codes[6:]


def test_idle_classes_are_purged(settings):
    from dataclasses import replace

    from server.app import create_app
    from server.db import Classroom, now_ms

    app = create_app(replace(settings, retention_days=30))
    from fastapi.testclient import TestClient

    c = TestClient(app)
    c.post("/api/classes", json={"name": "Old"})
    c.post("/api/classes", json={"name": "New"})
    with app.state.db.session() as s:
        old = s.query(Classroom).filter_by(name="Old").one()
        old.last_active = now_ms() - 40 * 86_400_000
    assert app.state.db.purge_idle(30) == 1
    with app.state.db.session() as s:
        assert [x.name for x in s.query(Classroom).all()] == ["New"]
