"""Codes, tokens and a small rate limiter.

Nothing here stores a secret in the clear: the database holds only hashes of student codes and teacher
tokens, so a leaked database cannot be used to read or change anyone's progress.
"""

from __future__ import annotations

import hashlib
import hmac
import re
import secrets
import time
from collections import defaultdict, deque

# Crockford's base 32: no I, L, O or U, so a code read out loud or copied by a child is hard to get wrong.
ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
_CLASS_LEN = 6
_STUDENT_LEN = 12


def _pick(n: int) -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(n))


def new_class_code() -> str:
    """Six characters, like `K7M2QX`: about a billion codes, and short enough to write on a board."""
    return _pick(_CLASS_LEN)


def new_student_code() -> str:
    """Twelve characters shown as `K7M2-QX4D-9HPT`. It is the student's only credential, so it is long."""
    raw = _pick(_STUDENT_LEN)
    return "-".join(raw[i : i + 4] for i in range(0, _STUDENT_LEN, 4))


def new_teacher_token() -> str:
    return secrets.token_urlsafe(24)


def clean_code(code: str) -> str:
    """Normalise what a person typed: case, dashes, spaces, and the look-alike letters."""
    c = re.sub(r"[\s\-_]", "", code or "").upper()
    return c.translate(str.maketrans({"O": "0", "I": "1", "L": "1", "U": "V"}))


def hash_secret(secret: str) -> str:
    return hashlib.sha256(secret.encode("utf-8")).hexdigest()


def same_secret(secret: str, stored_hash: str) -> bool:
    return hmac.compare_digest(hash_secret(secret), stored_hash)


def valid_student_code(code: str) -> bool:
    c = clean_code(code)
    return len(c) == _STUDENT_LEN and all(ch in ALPHABET for ch in c)


def valid_class_code(code: str) -> bool:
    c = clean_code(code)
    return len(c) == _CLASS_LEN and all(ch in ALPHABET for ch in c)


class RateLimiter:
    """Best effort: a sliding window per key, kept in this process.

    On a serverless host each instance has its own counters, so this slows a script down rather than
    stopping it. It exists to make guessing codes and flooding signups tedious, not impossible.
    """

    def __init__(self, limit: int, per_seconds: float, clock=time.monotonic) -> None:
        self.limit = limit
        self.window = per_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._clock = clock

    def allow(self, key: str) -> bool:
        now = self._clock()
        hits = self._hits[key]
        while hits and now - hits[0] > self.window:
            hits.popleft()
        if len(hits) >= self.limit:
            return False
        hits.append(now)
        # Do not let the table grow without bound on a long-lived process.
        if len(self._hits) > 5000:
            for k in [k for k, v in self._hits.items() if not v or now - v[-1] > self.window]:
                del self._hits[k]
        return True
