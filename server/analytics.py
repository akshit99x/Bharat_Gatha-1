"""Turning a saved profile into what a teacher wants to see.

Everything here is a pure function of plain data (a profile dict straight from the game, and the content), so
it is cheap to test and the same code serves the API and the offline tools.

A profile comes from a child's browser, so it is untrusted: every field is read defensively, and a profile
that is missing things or has the wrong types still produces a summary instead of an error.
"""

from __future__ import annotations

import time
from typing import Any

from .content import Content

STALE_DAYS = 14


def _num(v: Any, default: float = 0) -> float:
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) and v == v else default


def _int(v: Any, default: int = 0) -> int:
    return int(_num(v, default))


def _dict(v: Any) -> dict:
    return v if isinstance(v, dict) else {}


def _list(v: Any) -> list:
    return v if isinstance(v, list) else []


def summarise_profile(profile: dict, content: Content) -> dict:
    """One student's progress, in the shape the dashboard and the CSV read."""
    codex_have = {c for c in _list(profile.get("codex")) if isinstance(c, str)}
    zones = _dict(profile.get("zones"))
    story = _dict(profile.get("story"))
    plaque_state = _dict(story.get("plaques"))
    panels = {p for p in _list(story.get("panels")) if isinstance(p, str)}
    stats = _dict(profile.get("stats"))

    chapters = []
    for z in content.zones:
        zp = _dict(zones.get(z["id"]))
        codex_ids = [l["codexId"] for l in z["landmarks"] if l.get("codexId")]
        scanned = sum(1 for c in codex_ids if c in codex_have)
        done = {c for c in _list(zp.get("challenges")) if isinstance(c, str)}
        challenge_total = len(z["challenges"])
        challenges = sum(1 for c in z["challenges"] if c["id"] in done)
        plaque_ids = [p["id"] for p in (z.get("story") or {}).get("plaques", [])]
        plaques = sum(1 for p in plaque_ids if _dict(plaque_state.get(p)).get("done") is True)
        sealed = zp.get("sealed") is True
        restored = z["id"] in panels
        parts = [
            scanned / len(codex_ids) if codex_ids else 1.0,
            challenges / challenge_total if challenge_total else 1.0,
            plaques / len(plaque_ids) if plaque_ids else 1.0,
            1.0 if sealed else 0.0,
            1.0 if restored else 0.0,
        ]
        chapters.append(
            {
                "zone": z["id"],
                "name": z["name"],
                "chapter": z["chapter"],
                "discovered": zp.get("discovered") is True,
                "scanned": scanned,
                "scanTotal": len(codex_ids),
                "challenges": challenges,
                "challengeTotal": challenge_total,
                "plaques": plaques,
                "plaqueTotal": len(plaque_ids),
                "sealed": sealed,
                "bestSeal": _int(zp.get("bestSeal")),
                "restored": restored,
                "fraction": round(sum(parts) / len(parts), 3),
            }
        )

    # Skills: every recorded answer counts toward the skill its question trains.
    per_skill: dict[str, list[int]] = {}
    for qid, rec in _dict(profile.get("questions")).items():
        if not isinstance(qid, str):
            continue
        skill = content.skill_for(qid)
        if not skill:
            continue
        r = _dict(rec)
        seen, right = _int(r.get("seen")), _int(r.get("right"))
        if seen <= 0:
            continue
        acc = per_skill.setdefault(skill, [0, 0])
        acc[0] += seen
        acc[1] += min(right, seen)
    skills = sorted(
        ({"skill": s, "asked": a, "right": r, "accuracy": round(r / a, 3)} for s, (a, r) in per_skill.items()),
        key=lambda x: (x["accuracy"], -x["asked"]),
    )

    asked, right = _int(stats.get("quizAsked")), _int(stats.get("quizRight"))
    plaque_tries = {
        p: _int(_dict(v).get("tries"))
        for p, v in plaque_state.items()
        if isinstance(p, str) and _int(_dict(v).get("tries")) > 0
    }
    return {
        "vidya": _int(profile.get("vidya")),
        "codex": len(codex_have),
        "codexTotal": len(content.codex),
        "playMinutes": round(_num(stats.get("playSeconds")) / 60, 1),
        "challengesDone": _int(stats.get("challengesDone")),
        "quizAsked": asked,
        "quizRight": min(right, asked),
        "accuracy": round(min(right, asked) / asked, 3) if asked > 0 else None,
        "chaptersStarted": sum(1 for c in chapters if c["discovered"]),
        "chaptersSealed": sum(1 for c in chapters if c["sealed"]),
        "chaptersRestored": sum(1 for c in chapters if c["restored"]),
        "chapters": chapters,
        "skills": skills,
        "plaqueTries": plaque_tries,
        "plaquesCorrected": sum(c["plaques"] for c in chapters),
        "sabhaDone": story.get("sabhaDone") is True,
        "twelfthWritten": isinstance(story.get("twelfth"), dict),
        "openPicks": _int(story.get("openPicks")),
        "comfortPicks": _int(story.get("comfortPicks")),
        "updatedAt": _int(profile.get("updatedAt")),
    }


def flags_for(summary: dict, last_seen_ms: int, now_ms: int | None = None) -> list[str]:
    """Why a teacher might want to look at this student. Plain words, never a score or a rank."""
    now = now_ms if now_ms is not None else int(time.time() * 1000)
    out: list[str] = []
    started = summary["chaptersStarted"] > 0 or summary["vidya"] > 0
    idle_days = (now - last_seen_ms) / 86_400_000 if last_seen_ms else 0
    if started and idle_days >= STALE_DAYS:
        out.append(f"Not played for {int(idle_days)} days")
    if summary["quizAsked"] >= 10 and (summary["accuracy"] or 0) < 0.5:
        out.append("Finding the questions hard")
    weak = [s["skill"] for s in summary["skills"] if s["asked"] >= 5 and s["accuracy"] < 0.5]
    if weak:
        out.append("Struggling with: " + ", ".join(weak[:2]))
    if summary["plaquesCorrected"] > 0 and summary["comfortPicks"] > 2 * max(1, summary["openPicks"]) and summary["comfortPicks"] >= 4:
        out.append("Often picks the comfortable reading over the evidence")
    return out


def class_report(rows: list[dict], content: Content, now_ms: int | None = None) -> dict:
    """The whole class at a glance. `rows` are {id, nickname, last_seen, saved_at, summary or None}."""
    now = now_ms if now_ms is not None else int(time.time() * 1000)
    week = 7 * 86_400_000
    synced = [r for r in rows if r.get("summary")]

    students = []
    for r in rows:
        s = r.get("summary")
        students.append(
            {
                "id": r["id"],
                "nickname": r["nickname"],
                "lastSeen": r["last_seen"],
                "savedAt": r.get("saved_at"),
                "hasProgress": s is not None,
                "summary": s,
                "flags": flags_for(s, r["last_seen"], now) if s else [],
            }
        )
    students.sort(key=lambda x: x["nickname"].lower())

    # Chapters: how many students have started / sealed / restored each.
    chapters = []
    for z in content.zones:
        started = sealed = restored = 0
        frac = 0.0
        for r in synced:
            c = next((c for c in r["summary"]["chapters"] if c["zone"] == z["id"]), None)
            if not c:
                continue
            started += c["discovered"]
            sealed += c["sealed"]
            restored += c["restored"]
            frac += c["fraction"]
        chapters.append(
            {
                "zone": z["id"],
                "name": z["name"],
                "chapter": z["chapter"],
                "started": started,
                "sealed": sealed,
                "restored": restored,
                "avgProgress": round(frac / len(synced), 3) if synced else 0.0,
            }
        )

    # Skills across the class, weighted by how many answers each student gave.
    skill_totals: dict[str, list[int]] = {}
    for r in synced:
        for s in r["summary"]["skills"]:
            t = skill_totals.setdefault(s["skill"], [0, 0, 0])
            t[0] += s["asked"]
            t[1] += s["right"]
            t[2] += 1
    skills = sorted(
        (
            {"skill": k, "asked": a, "right": ok, "accuracy": round(ok / a, 3), "students": n}
            for k, (a, ok, n) in skill_totals.items()
            if a > 0
        ),
        key=lambda x: x["accuracy"],
    )

    # Plaques the class finds hardest: the average number of tries among those who have attempted them.
    plaque_text = {p["id"]: p["claim"] for z in content.zones for p in (z.get("story") or {}).get("plaques", [])}
    tries: dict[str, list[int]] = {}
    for r in synced:
        for pid, n in r["summary"]["plaqueTries"].items():
            tries.setdefault(pid, []).append(n)
    plaques = sorted(
        (
            {"id": pid, "claim": plaque_text.get(pid, pid), "students": len(v), "avgTries": round(sum(v) / len(v), 2)}
            for pid, v in tries.items()
        ),
        key=lambda x: -x["avgTries"],
    )[:8]

    accs = [r["summary"]["accuracy"] for r in synced if r["summary"]["accuracy"] is not None]
    return {
        "students": len(rows),
        "synced": len(synced),
        "activeThisWeek": sum(1 for r in rows if r["last_seen"] and now - r["last_seen"] < week),
        "averageVidya": round(sum(r["summary"]["vidya"] for r in synced) / len(synced)) if synced else 0,
        "averageAccuracy": round(sum(accs) / len(accs), 3) if accs else None,
        "chaptersRestored": sum(r["summary"]["chaptersRestored"] for r in synced),
        "needAttention": sum(1 for s in students if s["flags"]),
        "chapters": chapters,
        "skills": skills,
        "hardestPlaques": plaques,
        "roster": students,
    }


CSV_COLUMNS = [
    "nickname",
    "vidya",
    "codex_entries",
    "chapters_started",
    "chapters_sealed",
    "panels_restored",
    "plaques_corrected",
    "quiz_answered",
    "quiz_accuracy_percent",
    "play_minutes",
    "weakest_skill",
    "last_seen_utc",
    "notes",
]


def csv_rows(report: dict) -> list[list[Any]]:
    """The roster as spreadsheet rows. Dates are UTC ISO strings, accuracy is a whole percent."""
    rows: list[list[Any]] = []
    for s in report["roster"]:
        sm = s["summary"]
        weakest = next((x["skill"] for x in (sm or {}).get("skills", []) if x["asked"] >= 3), "")
        seen = time.strftime("%Y-%m-%d %H:%M", time.gmtime(s["lastSeen"] / 1000)) if s["lastSeen"] else ""
        if sm is None:
            rows.append([s["nickname"], "", "", "", "", "", "", "", "", "", "", seen, "No progress saved yet"])
            continue
        rows.append(
            [
                s["nickname"],
                sm["vidya"],
                sm["codex"],
                sm["chaptersStarted"],
                sm["chaptersSealed"],
                sm["chaptersRestored"],
                sm["plaquesCorrected"],
                sm["quizAsked"],
                round(sm["accuracy"] * 100) if sm["accuracy"] is not None else "",
                sm["playMinutes"],
                weakest,
                seen,
                "; ".join(s["flags"]),
            ]
        )
    return rows


def safe_cell(value: Any) -> Any:
    """Stop a spreadsheet treating a nickname as a formula (`=1+1`, `@SUM(...)`): prefix it with an apostrophe."""
    if isinstance(value, str) and value[:1] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + value
    return value
