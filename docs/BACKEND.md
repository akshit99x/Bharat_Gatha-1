# The teacher API (Python)

The game is a browser app and needs no server. This optional Python service adds three things for classrooms:

| | What it does |
|---|---|
| **Teacher dashboard** | A teacher makes a class, students join with a class code and a nickname, and the dashboard shows how the class is doing: who has finished which chapters, which skills need practice, which claims in the history students find hardest, and who might need a look. |
| **Cloud save** | A student's progress is kept on the server, so it follows them to another device. They bring it back with a student code. |
| **Class questions** | A teacher adds their own questions; they join the quiz for everyone in that class. |

If the server is down, or the game is hosted somewhere without it (GitHub Pages), the game works exactly as before and
simply does not show the class features.

## Try it on your computer

You need Node.js (for the game) and Python 3.12 (it is tested on 3.12 and 3.13).

```bash
python3 -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt

npm install
npm run api:dev        # the API, on http://127.0.0.1:8000  (interactive docs at /api/docs)
npm run dev            # the game; it passes /api through to the API
```

Open the game, choose **Join a class** on the title screen. Open `http://localhost:5178/teacher/` for the dashboard.
(The page it prints may use another port; use that one.)

Run the tests: `npm run api:test` (36 tests: the API, the analytics, the tools).

## Putting it on Vercel

The repository already has `vercel.json` and `api/index.py`, so Vercel runs the API as a Python function next to the
static game. Two things you have to do yourself:

1. **Connect a database.** A serverless host forgets any file it writes, so without one the data vanishes when the
   function restarts. `GET /api/health` says `"storage": "ephemeral"` in that case, and the dashboard warns the
   teacher. Create a free Postgres database (Neon, Supabase, or Vercel's own Postgres) and set its connection string as
   the environment variable **`DATABASE_URL`** in the Vercel project. Tables are created on first use.
2. **If the game is served from another address** (GitHub Pages, say), build it with `VITE_API_URL=https://your-project.vercel.app`
   and set **`BG_CORS_ORIGINS`** on the API to the game's address (for example `https://yourname.github.io`).

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | SQLite file | Postgres connection string for a real deployment |
| `BG_DB_PATH` | `server/data/local.sqlite3` | Where the SQLite file lives locally |
| `BG_CORS_ORIGINS` | none | Comma-separated addresses allowed to call the API from another origin |
| `BG_RETENTION_DAYS` | 365 | Classes idle this long are erased with all their data (0 = never) |
| `BG_MAX_STUDENTS` / `BG_MAX_QUESTIONS` | 400 / 200 | Per class |
| `BG_MAX_PROFILE_BYTES` | 256000 | Largest saved profile accepted |

> **What has and has not been run.** The API, the dashboard and the game's connection are tested end to end against SQLite
> on a laptop. The Postgres path uses the same SQLAlchemy code and only the connection string differs, but it has not been
> run here, and the Vercel deployment itself has not been tried. Do a trial class before relying on it.

## How it works

```
server/
  app.py         the routes
  analytics.py   a profile -> a teacher's summary; the class report; the CSV   (pure functions)
  schemas.py     what may be sent: nicknames, questions, profiles
  security.py    codes, hashing, rate limiting
  db.py          SQLAlchemy tables: classes, students, progress, class questions
  content.py     the game's content, read from server/data/content.json
  readability.py reading-grade scoring (Flesch-Kincaid), standard library only
api/index.py     Vercel entry point
public/teacher/  the dashboard (one static page)
tools/           offline reports (below)
tests/           pytest
```

`server/data/content.json` is a copy of the game's regions, challenges, plaques, codex and questions. **The game is the
source of truth.** After changing any of that content, refresh the copy with `npm run content:export`.

### Who can do what

* **A teacher** gets a *teacher token* when they make a class. It is the credential for everything about that class.
* **A student** gets a *student code* (like `K7M2-QX4D-9HPT`) when they join. It is their only credential, and it is long
  enough that guessing one is not realistic. They give a **nickname**, never a real name or an email.
* Only hashes of codes and tokens are stored, so a copy of the database cannot be used to read or change anyone's progress.
* A student can leave at any time and their saved progress is erased. A teacher can remove a student or erase the whole
  class. Classes idle for a year are erased automatically.
* The class-creation and join routes are rate-limited. On a serverless host each instance counts for itself, so this slows
  a script down rather than stopping it.

### What is sent

Only the student's saved game profile (progress, answers, settings) and the nickname. Not a name, an email, an IP address
or anything from the device. The teacher sees summaries of it, and never anything else about the student.

### If two devices play

Each save carries the time of the last play. If a device tries to save over a newer copy from another device, the server
refuses (HTTP 409) and the game offers a choice: load the newer one, or keep this device's.

## Endpoints

Interactive documentation is at `/api/docs` when the API is running. In brief:

| | |
|---|---|
| `GET /api/health`, `GET /api/content` | public |
| `POST /api/classes` → code and teacher token | public (rate-limited) |
| `GET /api/classes/{code}` | does this class exist? |
| `GET /api/classes/{code}/report` (+ `/report.csv`) | teacher |
| `GET`/`POST`/`DELETE /api/classes/{code}/questions` | teacher |
| `DELETE /api/classes/{code}/students/{id}`, `DELETE /api/classes/{code}` | teacher |
| `POST /api/classes/{code}/join` → student code | public (rate-limited) |
| `GET /api/me`, `GET`/`PUT /api/me/progress`, `GET /api/me/questions`, `DELETE /api/me` | student |

## Tools that need no server

Both run offline, on your own computer.

**Content report.** Reads the game's written content and says where to look:

```bash
npm run content:export && npm run content:report      # writes docs/CONTENT_REPORT.md
```

It measures how hard each codex entry and question is to read (Flesch-Kincaid grade, aiming for 10 or below for ages 12 to
16), counts questions by region, difficulty and skill, and flags questions that look wrong. See
[`CONTENT_REPORT.md`](CONTENT_REPORT.md) for the current findings.

**Learning-record report.** If you would rather not run a server, students can press *Export learning record* in the pause
menu and send you the file. Put the files in a folder and:

```bash
python3 -m tools.learning_report records/ --csv class.csv --markdown class.md
```
