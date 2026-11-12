from __future__ import annotations

import json

from conftest import sample_profile

from tools import content_report, learning_report


def test_content_report_builds_and_has_the_sections(tmp_path):
    out = tmp_path / "r.md"
    assert content_report.main(["--out", str(out)]) == 0
    text = out.read_text()
    for heading in ["# Content report", "## Questions by region", "## Skills the questions train", "## Codex entries above the target reading grade"]:
        assert heading in text
    assert "Sindhu" in text


def test_question_checks_catch_the_usual_mistakes():
    from server.content import Content

    q = lambda i, **o: {"id": i, "zoneId": "sindhu", "difficulty": 1, "stem": f"Stem {i}?", "context": None, "options": ["A", "B", "C"], "answer": 0, "explain": "Because it is so.", "tags": [], "skill": "s", **o}
    c = Content(
        zones=[],
        codex=[],
        questions=[
            q("a", stem="Same stem?"),
            q("b", stem="Same stem?"),
            q("c", options=["A very long correct answer that goes on and on and on", "No", "Yes"]),
            q("d", options=["Same", "same", "Other"]),
            q("e", options=["Yes", "No"]),
        ],
    )
    issues = "\n".join(content_report.question_issues(c))
    assert "`b` has the same stem as `a`" in issues
    assert "`c`: the correct option is much longer" in issues
    assert "`d` has two identical options" in issues
    assert "`e` has only 2 options" in issues


def test_learning_report_reads_exported_files(tmp_path):
    for i, vidya in enumerate([100, 400]):
        (tmp_path / f"s{i}.json").write_text(json.dumps({"exportedAt": "x", "profile": sample_profile(vidya=vidya, playerName=f"Kid{i}")}))
    (tmp_path / "junk.json").write_text("{not json")
    (tmp_path / "other.json").write_text(json.dumps({"hello": 1}))
    csv_path, md_path = tmp_path / "c.csv", tmp_path / "c.md"
    assert learning_report.main([str(tmp_path), "--csv", str(csv_path), "--markdown", str(md_path)]) == 0
    lines = csv_path.read_text(encoding="utf-8-sig").splitlines()
    assert len(lines) == 3 and lines[1].startswith("Kid0,100,") and lines[2].startswith("Kid1,400,")
    assert "Average Vidya: **250**" in md_path.read_text()
    assert learning_report.main([str(tmp_path / "nothing")]) == 1
