"""Rewrite quiz answer options in the game's source, safely.

    python3 -m tools.fix_options tools/data/option_fixes.json [--check]

The fixes file maps a question id to its new list of options. For each one this finds the question in
src/content/questions/*.ts, checks the list has the same number of options and that the correct option is still
in the same place (so `answer:` stays right), and replaces the `options: [...]` array. It never touches anything
else, and it refuses the whole batch if any single fix does not apply cleanly.

It exists to fix one specific bias the content report found: the correct answer was almost always the longest,
so a student could guess it without knowing the history. `--check` reports what would change without writing.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
QUESTION_FILES = sorted((ROOT / "src" / "content" / "questions").glob("*.ts"))

_STR = re.compile(r"""'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`""")


def _unquote(m: re.Match) -> str:
    raw = next(g for g in m.groups() if g is not None)
    return re.sub(r"\\(.)", r"\1", raw)


def _quote(s: str) -> str:
    return "'" + s.replace("\\", "\\\\").replace("'", "\\'") + "'"


def locate(source: str, qid: str) -> tuple[int, int, list[str], int] | None:
    """Where this question's options array is: (start, end) of the `[...]`, the options, and `answer`."""
    m = re.search(r"\bid:\s*['\"]" + re.escape(qid) + r"['\"]", source)
    if not m:
        return None
    o = source.find("options:", m.end())
    nxt = source.find("\n  {", m.end())  # the next question object
    if o < 0 or (nxt >= 0 and o > nxt):
        return None
    start = source.index("[", o)
    depth, i, in_str = 0, start, None
    while i < len(source):
        ch = source[i]
        if in_str:
            if ch == "\\":
                i += 2
                continue
            if ch == in_str:
                in_str = None
        elif ch in "'\"`":
            in_str = ch
        elif ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 0:
                break
        i += 1
    end = i + 1
    options = [_unquote(x) for x in _STR.finditer(source[start:end])]
    a = re.search(r"\banswer:\s*(\d+)", source[end : end + 200])
    return start, end, options, int(a.group(1)) if a else -1


def apply(fixes: dict[str, list[str]], write: bool) -> list[str]:
    problems: list[str] = []
    texts = {p: p.read_text(encoding="utf-8") for p in QUESTION_FILES}
    done: set[str] = set()
    for qid, new in fixes.items():
        hit = None
        for path, src in texts.items():
            loc = locate(src, qid)
            if loc:
                hit = (path, loc)
                break
        if not hit:
            problems.append(f"{qid}: not found")
            continue
        path, (start, end, old, answer) = hit
        if len(new) != len(old):
            problems.append(f"{qid}: has {len(old)} options, fix gives {len(new)}")
            continue
        if not 0 <= answer < len(old):
            problems.append(f"{qid}: could not read its answer index")
            continue
        if len({o.lower() for o in new}) != len(new) or any(not o.strip() for o in new):
            problems.append(f"{qid}: options must be distinct and non-empty")
            continue
        # Find the indentation used for the options, and keep it.
        line_start = texts[path].rfind("\n", 0, start) + 1
        indent = re.match(r"\s*", texts[path][line_start:]).group(0)
        body = "".join(f"\n{indent}  {_quote(o)}," for o in new)
        texts[path] = texts[path][:start] + "[" + body + f"\n{indent}]" + texts[path][end:]
        done.add(qid)
    if write and not problems:
        for path, src in texts.items():
            path.write_text(src, encoding="utf-8")
    return problems


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("fixes", type=Path)
    ap.add_argument("--check", action="store_true", help="validate only; write nothing")
    args = ap.parse_args(argv)
    fixes = json.loads(args.fixes.read_text(encoding="utf-8"))
    problems = apply(fixes, write=not args.check)
    for p in problems:
        print("x", p, file=sys.stderr)
    if problems:
        print(f"{len(problems)} problem(s); nothing written.", file=sys.stderr)
        return 1
    print(f"{'Checked' if args.check else 'Rewrote'} {len(fixes)} question(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
