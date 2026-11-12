"""The HTTP API.

    uvicorn server.app:app --reload --port 8000        (npm run api:dev)

Three kinds of caller, three kinds of credential:

* A teacher makes a class and gets a **teacher token**; every class-management route needs it as a Bearer token.
* A student joins with a class code and a nickname and gets a **student code**, their only credential.
* Anyone can read the public content summary and ask whether a class code exists.

Everything under /api/me is the student's own data, authenticated by their student code. Nothing here is
needed to play: the game works without it, and goes on working if this is down.
"""


import csv
import io
import json
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import __version__
from .analytics import CSV_COLUMNS, class_report, csv_rows, safe_cell, summarise_profile
from .config import Settings, load_settings
from .content import load_content
from .db import ClassQuestion, Classroom, Database, Progress, Student, now_ms
from .readability import analyse
from .schemas import (
    ClassCreated,
    ClassInfo,
    JoinRequest,
    Joined,
    Me,
    NewClass,
    ProgressIn,
    ProgressOut,
    ProgressSaved,
    QuestionIn,
    QuestionOut,
)
from .security import (
    RateLimiter,
    clean_code,
    hash_secret,
    new_class_code,
    new_student_code,
    new_teacher_token,
    same_secret,
    valid_class_code,
    valid_student_code,
)

# A line a student can read comfortably at 12 to 16: Flesch-Kincaid grade 10 or below.
TARGET_GRADE = 10.0


def create_app(settings: Settings | None = None) -> FastAPI:
    cfg = settings or load_settings()
    db = Database(cfg)
    db.purge_idle(cfg.retention_days)

    app = FastAPI(
        title="Bharat Gatha teacher API",
        version=__version__,
        description="Optional class sync and teacher dashboard for the Bharat Gatha game.",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        redoc_url=None,
    )
    app.state.db = db
    app.state.settings = cfg
    if cfg.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=list(cfg.cors_origins),
            allow_methods=["GET", "POST", "PUT", "DELETE"],
            allow_headers=["Authorization", "Content-Type"],
            max_age=600,
        )

    create_limit = RateLimiter(6, 3600)
    join_limit = RateLimiter(30, 3600)
    auth_limit = RateLimiter(60, 600)

    # ----------------------------------------------------------- plumbing

    def session():
        with db.session() as s:
            yield s

    Db = Annotated[Session, Depends(session)]

    def client_ip(request: Request) -> str:
        fwd = request.headers.get("x-forwarded-for", "")
        return fwd.split(",")[0].strip() or (request.client.host if request.client else "unknown")

    def throttle(limiter: RateLimiter, request: Request, what: str) -> None:
        if not limiter.allow(f"{what}:{client_ip(request)}"):
            raise HTTPException(429, "Too many tries. Wait a little and try again.")

    def bearer(authorization: str | None) -> str:
        if not authorization or not authorization.lower().startswith("bearer "):
            raise HTTPException(401, "Missing credentials.", headers={"WWW-Authenticate": "Bearer"})
        return authorization[7:].strip()

    def find_class(s: Session, code: str) -> Classroom:
        if not valid_class_code(code):
            raise HTTPException(404, "No class has that code.")
        c = s.scalar(select(Classroom).where(Classroom.code == clean_code(code)))
        if not c:
            raise HTTPException(404, "No class has that code.")
        return c

    def teacher(s: Session, code: str, authorization: str | None, request: Request) -> Classroom:
        token = bearer(authorization)
        c = find_class(s, code)
        if not same_secret(token, c.teacher_hash):
            throttle(auth_limit, request, "teacher")
            raise HTTPException(403, "That teacher token does not match this class.")
        c.last_active = now_ms()
        return c

    def student(s: Session, authorization: str | None, request: Request) -> Student:
        code = bearer(authorization)
        if not valid_student_code(code):
            throttle(auth_limit, request, "student")
            raise HTTPException(403, "That is not a student code.")
        st = s.scalar(select(Student).where(Student.code_hash == hash_secret(clean_code(code))))
        if not st:
            throttle(auth_limit, request, "student")
            raise HTTPException(403, "No student has that code.")
        st.last_seen = now_ms()
        st.classroom.last_active = now_ms()
        return st

    Auth = Annotated[str | None, Header(alias="Authorization")]

    def question_out(q: ClassQuestion) -> QuestionOut:
        body = json.loads(q.body_json)
        grade = analyse(" ".join([body["stem"], body.get("context") or "", *body["options"], body["explain"]]))["grade"]
        warnings = []
        if grade is not None and grade > TARGET_GRADE:
            warnings.append(f"Reads at about grade {grade:.0f}; students are 12 to 16. Shorter sentences and plainer words will help.")
        return QuestionOut(
            id=f"class:{q.id}",
            zoneId=q.zone_id,
            difficulty=q.difficulty,
            stem=body["stem"],
            context=body.get("context"),
            options=body["options"],
            answer=body["answer"],
            explain=body["explain"],
            tags=body.get("tags", []),
            skill=q.skill,
            readingGrade=grade,
            warnings=warnings,
        )

    # -------------------------------------------------------------- public

    @app.get("/api/health", tags=["public"])
    def health():
        with db.session() as s:
            classes = s.scalar(select(func.count(Classroom.id))) or 0
        return {
            "ok": True,
            "version": __version__,
            # Said plainly, so a deployment that will forget its data does not look like one that will not.
            "storage": "ephemeral" if cfg.ephemeral else ("postgres" if not cfg.is_sqlite else "sqlite"),
            "classes": classes,
        }

    @app.get("/api/content", tags=["public"])
    def content():
        """Region ids and names (for the question form), and the skills the game trains."""
        c = load_content()
        return {
            "zones": [{"id": z["id"], "name": z["name"], "chapter": z["chapter"]} for z in c.zones],
            "skills": c.skills,
            "targetGrade": TARGET_GRADE,
        }

    @app.get("/api/classes/{code}", response_model=ClassInfo, tags=["public"])
    def class_info(code: str, s: Db):
        """Does this class code exist? Used by the game's Join screen, so it says nothing else."""
        c = find_class(s, code)
        n = s.scalar(select(func.count(Student.id)).where(Student.class_id == c.id)) or 0
        return ClassInfo(code=c.code, name=c.name, students=n)

    # ------------------------------------------------------------- teacher

    @app.post("/api/classes", response_model=ClassCreated, status_code=201, tags=["teacher"])
    def create_class(body: NewClass, request: Request, s: Db):
        throttle(create_limit, request, "create")
        token = new_teacher_token()
        for _ in range(20):
            code = new_class_code()
            if not s.scalar(select(Classroom.id).where(Classroom.code == code)):
                break
        else:  # pragma: no cover - a billion codes
            raise HTTPException(503, "Could not make a class code. Try again.")
        s.add(Classroom(code=code, name=body.name, teacher_hash=hash_secret(token)))
        return ClassCreated(code=code, name=body.name, teacher_token=token)

    @app.get("/api/classes/{code}/report", tags=["teacher"])
    def report(code: str, request: Request, s: Db, authorization: Auth = None):
        c = teacher(s, code, authorization, request)
        return {"class": {"code": c.code, "name": c.name, "createdAt": c.created_at}, **_report(s, c)}

    @app.get("/api/classes/{code}/report.csv", tags=["teacher"])
    def report_csv(code: str, request: Request, s: Db, authorization: Auth = None):
        c = teacher(s, code, authorization, request)
        rep = _report(s, c)
        out = io.StringIO()
        w = csv.writer(out)
        w.writerow(CSV_COLUMNS)
        for row in csv_rows(rep):
            w.writerow([safe_cell(v) for v in row])
        return Response(
            "﻿" + out.getvalue(),  # a byte-order mark so Excel reads the Devanagari-free text as UTF-8
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="bharat-gatha-{c.code}.csv"'},
        )

    def _report(s: Session, c: Classroom) -> dict:
        rows = []
        for st in s.scalars(select(Student).where(Student.class_id == c.id)).all():
            summary = json.loads(st.progress.summary_json) if st.progress else None
            rows.append(
                {
                    "id": st.id,
                    "nickname": st.nickname,
                    "last_seen": st.last_seen,
                    "saved_at": st.progress.saved_at if st.progress else None,
                    "summary": summary,
                }
            )
        return class_report(rows, load_content())

    @app.delete("/api/classes/{code}/students/{student_id}", status_code=204, tags=["teacher"])
    def remove_student(code: str, student_id: int, request: Request, s: Db, authorization: Auth = None):
        c = teacher(s, code, authorization, request)
        st = s.get(Student, student_id)
        if not st or st.class_id != c.id:
            raise HTTPException(404, "No such student in this class.")
        s.delete(st)
        return Response(status_code=204)

    @app.delete("/api/classes/{code}", status_code=204, tags=["teacher"])
    def delete_class(code: str, request: Request, s: Db, authorization: Auth = None):
        """Erase the class, every student in it and all their saved progress."""
        c = teacher(s, code, authorization, request)
        s.delete(c)
        return Response(status_code=204)

    @app.get("/api/classes/{code}/questions", response_model=list[QuestionOut], tags=["teacher"])
    def list_questions(code: str, request: Request, s: Db, authorization: Auth = None):
        c = teacher(s, code, authorization, request)
        return [question_out(q) for q in sorted(c.questions, key=lambda q: q.id)]

    @app.post("/api/classes/{code}/questions", response_model=QuestionOut, status_code=201, tags=["teacher"])
    def add_question(code: str, body: QuestionIn, request: Request, s: Db, authorization: Auth = None):
        c = teacher(s, code, authorization, request)
        if len(c.questions) >= cfg.max_questions_per_class:
            raise HTTPException(409, f"A class can have at most {cfg.max_questions_per_class} questions of its own.")
        stored = {
            "stem": body.stem,
            "context": body.context,
            "options": body.options,
            "answer": body.answer,
            "explain": body.explain,
            "tags": body.tags,
        }
        q = ClassQuestion(class_id=c.id, zone_id=body.zone_id, difficulty=body.difficulty, skill=body.skill, body_json=json.dumps(stored))
        s.add(q)
        s.flush()
        return question_out(q)

    @app.delete("/api/classes/{code}/questions/{question_id}", status_code=204, tags=["teacher"])
    def delete_question(code: str, question_id: int, request: Request, s: Db, authorization: Auth = None):
        c = teacher(s, code, authorization, request)
        q = s.get(ClassQuestion, question_id)
        if not q or q.class_id != c.id:
            raise HTTPException(404, "No such question in this class.")
        s.delete(q)
        return Response(status_code=204)

    # ------------------------------------------------------------- student

    @app.post("/api/classes/{code}/join", response_model=Joined, status_code=201, tags=["student"])
    def join(code: str, body: JoinRequest, request: Request, s: Db):
        throttle(join_limit, request, "join")
        c = find_class(s, code)
        n = s.scalar(select(func.count(Student.id)).where(Student.class_id == c.id)) or 0
        if n >= cfg.max_students_per_class:
            raise HTTPException(409, "This class is full.")
        taken = s.scalar(select(Student.id).where(Student.class_id == c.id, func.lower(Student.nickname) == body.nickname.lower()))
        if taken:
            raise HTTPException(409, "Someone in this class already uses that nickname. Pick another.")
        secret = new_student_code()
        s.add(Student(class_id=c.id, nickname=body.nickname, code_hash=hash_secret(clean_code(secret))))
        c.last_active = now_ms()
        return Joined(student_code=secret, nickname=body.nickname, class_code=c.code, class_name=c.name)

    @app.get("/api/me", response_model=Me, tags=["student"])
    def me(request: Request, s: Db, authorization: Auth = None):
        st = student(s, authorization, request)
        p = st.progress
        return Me(
            nickname=st.nickname,
            class_code=st.classroom.code,
            class_name=st.classroom.name,
            has_progress=p is not None,
            revision=p.revision if p else 0,
            client_updated_at=p.client_updated_at if p else 0,
        )

    @app.get("/api/me/progress", response_model=ProgressOut, tags=["student"])
    def get_progress(request: Request, s: Db, authorization: Auth = None):
        st = student(s, authorization, request)
        if not st.progress:
            raise HTTPException(404, "Nothing is saved yet.")
        return ProgressOut(
            profile=json.loads(st.progress.profile_json),
            revision=st.progress.revision,
            client_updated_at=st.progress.client_updated_at,
        )

    @app.put("/api/me/progress", response_model=ProgressSaved, tags=["student"])
    def put_progress(body: ProgressIn, request: Request, s: Db, authorization: Auth = None):
        st = student(s, authorization, request)
        raw = json.dumps(body.profile, separators=(",", ":"))
        if len(raw.encode("utf-8")) > cfg.max_profile_bytes:
            raise HTTPException(413, "That profile is far larger than any real one.")
        updated = int(body.profile["updatedAt"]) if isinstance(body.profile.get("updatedAt"), (int, float)) else 0
        summary = json.dumps(summarise_profile(body.profile, load_content()), separators=(",", ":"))
        p = st.progress
        if p is None:
            p = Progress(student_id=st.id, profile_json=raw, summary_json=summary, revision=1, client_updated_at=updated, saved_at=now_ms())
            s.add(p)
        else:
            if updated and p.client_updated_at and updated < p.client_updated_at and not body.force:
                # The cloud copy is newer: another device has played since. Do not overwrite it silently.
                raise HTTPException(
                    409,
                    detail={"message": "The saved copy is newer than this device's.", "client_updated_at": p.client_updated_at, "revision": p.revision},
                )
            p.profile_json, p.summary_json = raw, summary
            p.revision += 1
            p.client_updated_at = updated or p.client_updated_at
            p.saved_at = now_ms()
        return ProgressSaved(revision=p.revision, saved_at=p.saved_at)

    @app.get("/api/me/questions", response_model=list[QuestionOut], tags=["student"])
    def my_questions(request: Request, s: Db, authorization: Auth = None):
        st = student(s, authorization, request)
        return [question_out(q) for q in sorted(st.classroom.questions, key=lambda q: q.id)]

    @app.delete("/api/me", status_code=204, tags=["student"])
    def leave(request: Request, s: Db, authorization: Auth = None):
        """Leave the class and erase this student's saved progress."""
        st = student(s, authorization, request)
        s.delete(st)
        return Response(status_code=204)

    # --------------------------------------------------------------- errors

    @app.exception_handler(HTTPException)
    async def http_error(_request: Request, exc: HTTPException):
        detail = exc.detail if isinstance(exc.detail, dict) else {"message": str(exc.detail)}
        return JSONResponse({"error": detail}, status_code=exc.status_code, headers=getattr(exc, "headers", None))

    return app


app = create_app()
