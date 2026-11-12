"""How hard a piece of English is to read: Flesch Reading Ease and the Flesch-Kincaid grade.

Pure standard library, so the API (checking a teacher's question) and the content tools share it. Syllables
are counted by the usual vowel-group heuristic. It is an estimate, and a good enough one to flag a paragraph
written for a university when the audience is twelve.
"""

from __future__ import annotations

import re

_WORD = re.compile(r"[A-Za-z][A-Za-z'’\-]*")
_SENTENCE_END = re.compile(r"[.!?]+(?:[\"”’')\]]+)?(?:\s+|$)")


def count_syllables(word: str) -> int:
    w = re.sub(r"[^a-z]", "", word.lower())
    if not w:
        return 0
    if len(w) <= 3:
        return 1
    # Silent endings: -e, -es, -ed (but not -le, -ted, -ded).
    w = re.sub(r"(?:[^laeiouy]es|ed|[^laeiouy]e)$", "", w) or w
    w = re.sub(r"^y", "", w)
    groups = re.findall(r"[aeiouy]{1,2}", w)
    return max(1, len(groups))


def sentences(text: str) -> list[str]:
    parts = [p.strip() for p in _SENTENCE_END.split(text) if p and p.strip()]
    return parts or ([text.strip()] if text.strip() else [])


def analyse(text: str) -> dict:
    words = _WORD.findall(text)
    n_words = len(words)
    n_sent = max(1, len(sentences(text)))
    if n_words == 0:
        return {"words": 0, "sentences": 0, "syllables": 0, "reading_ease": None, "grade": None, "avg_sentence": 0.0}
    syll = sum(count_syllables(w) for w in words)
    wps = n_words / n_sent
    spw = syll / n_words
    ease = 206.835 - 1.015 * wps - 84.6 * spw
    grade = 0.39 * wps + 11.8 * spw - 15.59
    return {
        "words": n_words,
        "sentences": n_sent,
        "syllables": syll,
        "reading_ease": round(ease, 1),
        "grade": round(max(0.0, grade), 1),
        "avg_sentence": round(wps, 1),
    }
