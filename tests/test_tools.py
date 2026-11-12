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


SAMPLE_TS = """export const QUESTIONS = [
  {
    id: 'q-one',
    stem: 'Which?',
    options: [
      'A long and very detailed right answer',
      'No',
    ],
    answer: 0,
  },
  {
    id: 'q-two',
    options: ['x', 'y'],
    answer: 1,
  },
];
"""


def test_fix_options_rewrites_in_place_and_keeps_the_answer():
    from tools import fix_options

    start, end, opts, answer = fix_options.locate(SAMPLE_TS, "q-one")
    assert opts == ["A long and very detailed right answer", "No"] and answer == 0
    assert fix_options.locate(SAMPLE_TS, "missing") is None
    _, _, opts2, answer2 = fix_options.locate(SAMPLE_TS, "q-two")
    assert opts2 == ["x", "y"] and answer2 == 1


def test_fix_options_refuses_bad_fixes():
    from tools import fix_options

    problems = fix_options.apply({"no-such-question": ["a", "b"]}, write=False)
    assert problems and "no-such-question" in problems[0]
    qid = "sindhu-meluhha"
    n = len(fix_options.locate((fix_options.ROOT / "src/content/questions/ancient.ts").read_text(), qid)[2])
    assert fix_options.apply({qid: ["only one"]}, write=False)  # wrong count
    assert fix_options.apply({qid: ["same"] * n}, write=False)  # duplicates


def test_quiz_options_do_not_give_the_answer_away():
    """Guards the rewrite of the options: the right answer should not be the longest far more often than chance."""
    from server.content import load_content

    bias = content_report.length_bias(load_content().questions)
    assert bias["clear"] == 0, "some correct options are clearly longer than every alternative"
    assert bias["rate"] <= bias["chance"] + 0.15


def test_exported_content_matches_the_game_source():
    """server/data/content.json is generated from src/content; it must be re-exported after edits."""
    import shutil
    import subprocess

    import pytest

    from server.content import CONTENT_PATH

    if not shutil.which("npm") or not (fix_options_root() / "node_modules").exists():
        pytest.skip("needs node and npm install")
    before = CONTENT_PATH.read_bytes()
    try:
        subprocess.run(["npm", "run", "-s", "content:export"], cwd=fix_options_root(), check=True, capture_output=True)
        assert CONTENT_PATH.read_bytes() == before, "run `npm run content:export` and commit server/data/content.json"
    finally:
        CONTENT_PATH.write_bytes(before)


def fix_options_root():
    from tools import fix_options

    return fix_options.ROOT
