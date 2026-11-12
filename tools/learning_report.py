"""Turn exported learning records into a class spreadsheet, with no server at all.

A student (or you) presses "Export learning record" in the game's pause menu, which downloads a JSON file. Put
a folder of those files together and run:

    python -m tools.learning_report records/ --csv class.csv --markdown class.md

It uses the same analysis as the teacher API, so the numbers agree. Nothing leaves your computer.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

from server.analytics import CSV_COLUMNS, class_report, csv_rows, safe_cell, summarise_profile
from server.content import load_content


def load_records(paths: list[Path]) -> list[dict]:
    """Rows in the shape `class_report` wants. A file that is not a learning record is skipped with a note."""
    files: list[Path] = []
    for p in paths:
        files.extend(sorted(p.glob("*.json")) if p.is_dir() else [p])
    content = load_content()
    rows, seen = [], set()
    for i, f in enumerate(files, 1):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            profile = data["profile"] if isinstance(data, dict) and "profile" in data else data
            if not isinstance(profile, dict) or "version" not in profile:
                raise ValueError("no profile in this file")
        except (OSError, ValueError, KeyError) as e:
            print(f"skipped {f.name}: {e}", file=sys.stderr)
            continue
        name = str(profile.get("playerName") or f.stem)[:24]
        while name.lower() in seen:  # two files, one name: keep both, tell them apart
            name += f" ({i})"
        seen.add(name.lower())
        updated = int(profile["updatedAt"]) if isinstance(profile.get("updatedAt"), (int, float)) else 0
        rows.append({"id": i, "nickname": name, "last_seen": updated, "saved_at": updated, "summary": summarise_profile(profile, content)})
    return rows


def markdown(report: dict) -> str:
    out = [f"# Class report ({report['students']} students)", ""]
    out += [
        f"- Average Vidya: **{report['averageVidya']}**",
        f"- Average quiz accuracy: **{'n/a' if report['averageAccuracy'] is None else str(round(report['averageAccuracy'] * 100)) + '%'}**",
        f"- Chapter panels restored in total: **{report['chaptersRestored']}**",
        f"- Students to look at: **{report['needAttention']}**",
        "",
        "## Skills, weakest first",
        "",
    ]
    out += [f"- {s['skill']}: {round(s['accuracy'] * 100)}% over {s['asked']} answers" for s in report["skills"]] or ["- No quiz answers yet."]
    out += ["", "## Claims the class finds hardest", ""]
    out += [f"- “{p['claim']}” ({p['avgTries']} tries on average)" for p in report["hardestPlaques"]] or ["- None yet."]
    out += ["", "## Students", "", "| Nickname | Vidya | Panels | Accuracy | Notes |", "|---|---:|---:|---:|---|"]
    for s in report["roster"]:
        sm = s["summary"]
        acc = "" if sm["accuracy"] is None else f"{round(sm['accuracy'] * 100)}%"
        out.append(f"| {s['nickname']} | {sm['vidya']} | {sm['chaptersRestored']} | {acc} | {'; '.join(s['flags'])} |")
    return "\n".join(out) + "\n"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("records", nargs="+", type=Path, help="exported JSON files, or folders of them")
    ap.add_argument("--csv", type=Path, help="write the roster as a spreadsheet")
    ap.add_argument("--markdown", type=Path, help="write a readable summary")
    args = ap.parse_args(argv)
    rows = load_records(args.records)
    if not rows:
        print("No learning records found.", file=sys.stderr)
        return 1
    report = class_report(rows, load_content())
    if args.csv:
        with args.csv.open("w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f)
            w.writerow(CSV_COLUMNS)
            for r in csv_rows(report):
                w.writerow([safe_cell(v) for v in r])
    text = markdown(report)
    if args.markdown:
        args.markdown.write_text(text, encoding="utf-8")
    if not args.csv and not args.markdown:
        print(text)
    else:
        print(f"{len(rows)} record(s) read.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
