"""Vercel entry point: serves the teacher API (server/app.py) as a Python function.

Everything under /api/* is rewritten here by vercel.json, and FastAPI routes it. The game and the dashboard are
static files and never touch Python.
"""

import sys
from pathlib import Path

# The server package lives at the project root, one level up from this folder.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from server.app import app  # noqa: E402,F401  (Vercel looks for an ASGI object called `app`)
