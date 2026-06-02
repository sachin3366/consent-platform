# Consent Platform — Command Log

A self-contained build diary. Each step explains **what was done**, **why it was needed**, and **what concept it demonstrates** — written so you can read any entry cold and understand it without the original conversation.

---

## Step 1 — Project Exploration
**Date:** 2026-05-31

### What & Why
Before writing any new code, we always read the existing codebase first. This tells us what decisions were already made, what patterns to follow, and what's missing. Skipping this step leads to duplicate code or working against the existing architecture.

This project already had a **backend scaffold** — the minimum skeleton needed to run a FastAPI server. Nothing business-specific had been built yet.

### What Already Existed

| File | Purpose |
|---|---|
| `backend/app/main.py` | Creates the FastAPI app, adds CORS middleware, registers a `/health` endpoint, and hooks up database table creation on startup |
| `backend/app/database.py` | Configures the SQLite database connection using SQLModel; provides a `get_session()` function FastAPI uses to open/close a DB session per request |
| `backend/app/routers/__init__.py` | Empty — placeholder for future API route files |
| `backend/requirements.txt` | Lists Python packages: `fastapi`, `uvicorn`, `sqlmodel`, `python-dotenv` |
| `backend/.env` | Environment config: `DATABASE_URL=sqlite:///./consent.db` |
| `frontend/` | Directory exists but completely empty — frontend not started yet |

### Commands Executed

```bash
# List files up to 3 levels deep to get a quick overview of the project shape
find /Users/sachinkhanna/Projects/consent-platform -maxdepth 3 -type f | head -80

# List top-level folders
ls /Users/sachinkhanna/Projects/consent-platform

# List all project files, excluding generated/dependency folders
find /Users/sachinkhanna/Projects/consent-platform -type f \
  | grep -v venv \
  | grep -v __pycache__ \
  | grep -v node_modules \
  | sort
```

> `venv/` contains installed Python packages (not our code).
> `__pycache__/` contains compiled Python bytecode (auto-generated, not our code).
> We filter these out so we only see files we actually wrote.

**Files read (no changes made):** `main.py`, `database.py`, `routers/__init__.py`, `requirements.txt`, `.env`

### Key Concepts
- **FastAPI** — a Python web framework for building APIs; auto-generates docs at `/docs`
- **SQLModel** — combines SQLAlchemy (database ORM) and Pydantic (data validation) into one library
- **ORM (Object-Relational Mapper)** — lets you define database tables as Python classes instead of writing raw SQL
- **CORS middleware** — allows browsers on other domains (your frontend) to call your API; required for any frontend/backend split
- **Lifespan handler** — FastAPI hook that runs setup code (like creating DB tables) when the server starts
- **Virtual environment (`venv`)** — an isolated Python environment so project dependencies don't clash with system Python

### What Comes Next
Step 2 — Define the data models: create `backend/app/models.py` with `ConsentCategory` and `ConsentRecord` classes, which will become the database tables.

---

## Step 2 — Define Data Models
**Date:** 2026-05-31

### What & Why
A **data model** is a Python class that maps directly to a database table. We define our models before writing any API routes because the routes depend on the shape of the data.

We created three models based on real-world consent platform requirements (derived from Osano's engineering blog):
- **Consent data must be immutable** — records are never edited or deleted, only new ones are appended
- **Each record links to the previous one** — forming an audit chain so you can ask "what did this user consent to on date X?"
- **Consent is per-category** — a user doesn't just say "yes" or "no" globally; they decide per purpose (analytics, marketing, etc.)

### What Changed

| File | Change |
|---|---|
| `backend/app/models.py` | Created — defines `ConsentCategory`, `ConsentRecord`, `ConsentDecision` |
| `backend/app/main.py` | Added `from app import models` import |

### The Three Models

**`ConsentCategory`** — defines the types of consent purposes
```
id          primary key (auto-assigned integer)
name        e.g. "analytics", "marketing", "functional" (unique, indexed)
description plain-English explanation of this category
```

**`ConsentRecord`** — one immutable consent event per user interaction
```
id                  primary key
user_identifier     cookie or session ID from the browser (indexed for fast lookup)
domain              which website this consent belongs to (e.g. "example.com")
created_at          timestamp — auto-set to now when the record is created
previous_record_id  FK pointing to the prior ConsentRecord for this user+domain
                    (NULL for first-ever record; forms the audit chain)
```

**`ConsentDecision`** — the yes/no answer for one category inside one record
```
id                  primary key
consent_record_id   FK → ConsentRecord (which event does this decision belong to)
category_id         FK → ConsentCategory (which purpose is being decided)
accepted            true = user consented, false = user declined
```

### How the Audit Chain Works
```
ConsentRecord #1  (user_id="abc", domain="shop.com", previous=NULL)
  └── ConsentDecision: analytics=true, marketing=true

ConsentRecord #2  (user_id="abc", domain="shop.com", previous=#1)
  └── ConsentDecision: analytics=true, marketing=false  ← user changed mind

ConsentRecord #3  (user_id="abc", domain="shop.com", previous=#2)
  └── ConsentDecision: analytics=false, marketing=false ← opted out of everything
```
To get current consent → find the ConsentRecord with the highest `id` for this user+domain.
To audit past consent → follow `previous_record_id` back through the chain.

### Commands Executed
```bash
# Created new file
backend/app/models.py  (written via editor)

# Edited existing file — added one import line
backend/app/main.py
```

**Why the import in `main.py` matters:**
`create_db_and_tables()` calls `SQLModel.metadata.create_all(engine)`, which creates a table for every SQLModel class it knows about. SQLModel only knows about a class once its module has been imported. Without `from app import models`, the tables would never be created even though the code is there.

The `# noqa: F401` comment tells Python linters "I know this import looks unused — it's intentional."

### Key Concepts
- **ORM (Object-Relational Mapper)** — write Python classes, get database tables; no raw SQL needed
- **Primary key** — unique identifier for each row; SQLite auto-increments integers
- **Foreign key** — a field in one table that references the primary key of another table; enforces relationships
- **Self-referential foreign key** — a foreign key that points to the same table (`previous_record_id → consentrecord.id`); used to build linked lists/chains in a database
- **Index** — a data structure the database builds on a column to make lookups faster; we index `user_identifier` and `domain` because we'll query by those fields often
- **`table=True`** — tells SQLModel this class is a real database table (not just a Pydantic validation schema)
- **`default_factory=datetime.utcnow`** — calls `datetime.utcnow()` at insert time to stamp the record; using `default=datetime.utcnow` (without parentheses) would be a bug — it would capture the time the class was defined, not when the record was created

### What Comes Next
Step 3 — Run the server to verify the tables are created, then seed the database with default `ConsentCategory` rows (analytics, marketing, functional, strictly_necessary).

---

## Step 3 — Run Server, Verify Tables, Seed Categories
**Date:** 2026-05-31

### What & Why
Before writing any API routes, we need to confirm that:
1. The server boots without errors
2. The three tables were actually created in SQLite
3. The `consentcategory` table has the standard consent categories pre-loaded

We also hit a real-world problem: an **old server was already running** on port 8000 (started before we added `from app import models`). That old process had no knowledge of our models, so no tables were created. We had to kill it and restart fresh — a good reminder that import order matters.

### What Changed

| File | Change |
|---|---|
| `backend/seed.py` | Created — inserts the 4 standard consent categories if they don't already exist |

### Commands Executed

```bash
# Start the uvicorn server in the background; redirect logs to a temp file
uvicorn app.main:app --port 8000 &> /tmp/uvicorn.log &

# Wait 3 seconds for the server to boot, then hit the health endpoint
sleep 3 && curl -s http://localhost:8000/health
# Expected response: {"status":"ok","version":"0.1.0"}

# Check server logs (revealed port conflict with old process)
cat /tmp/uvicorn.log

# Find what process was using port 8000
lsof -ti :8000

# Check what that process was
ps -p 6010 -o pid,command

# Kill old server and failed attempt, then restart
kill 6010 8068
uvicorn app.main:app --port 8000 &> /tmp/uvicorn.log &
sleep 3 && curl -s http://localhost:8000/health

# Confirm tables exist in SQLite
sqlite3 backend/consent.db ".tables"
sqlite3 backend/consent.db ".schema"

# Run the seed script
python seed.py

# Verify categories were inserted
sqlite3 backend/consent.db "SELECT * FROM consentcategory;"
```

### Server Startup Log (what SQLModel emitted)
When the server started, SQLModel ran these SQL statements automatically:
```sql
CREATE TABLE consentcategory (id INTEGER NOT NULL, name VARCHAR NOT NULL, ...);
CREATE UNIQUE INDEX ix_consentcategory_name ON consentcategory (name);

CREATE TABLE consentrecord (id INTEGER NOT NULL, user_identifier VARCHAR NOT NULL,
  domain VARCHAR NOT NULL, created_at DATETIME NOT NULL, previous_record_id INTEGER,
  FOREIGN KEY(previous_record_id) REFERENCES consentrecord (id));
CREATE INDEX ix_consentrecord_domain ON consentrecord (domain);
CREATE INDEX ix_consentrecord_user_identifier ON consentrecord (user_identifier);

CREATE TABLE consentdecision (id INTEGER NOT NULL, consent_record_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL, accepted BOOLEAN NOT NULL,
  FOREIGN KEY(consent_record_id) REFERENCES consentrecord (id),
  FOREIGN KEY(category_id) REFERENCES consentcategory (id));
```
This is SQLModel translating our Python classes into actual SQL — the core benefit of using an ORM.

### Seeded Data
```
id | name               | description
---|--------------------|----------------------------------------------
1  | strictly_necessary | Essential for the website to function. Cannot be disabled.
2  | functional         | Remembers user preferences (language, region, etc.).
3  | analytics          | Tracks how visitors use the site (e.g. Google Analytics).
4  | marketing          | Used to show personalised ads and track ad performance.
```

### Problem Encountered & Fix
**Problem:** Port 8000 was already in use by an old uvicorn process started before models were added.
**Symptom:** `.tables` returned empty even though the server responded to `/health`.
**Diagnosis:** `lsof -ti :8000` found the PID; `ps -p <PID>` confirmed it was an old uvicorn.
**Fix:** Kill both processes (`kill <old> <new>`), restart fresh.
**Lesson:** Always check server logs when something behaves unexpectedly. `lsof -ti :<port>` is the go-to command to find what's holding a port.

### Key Concepts
- **`uvicorn`** — the ASGI server that runs FastAPI; `--reload` makes it auto-restart on file changes (dev only)
- **`&`** — runs a command in the background so the terminal stays free
- **`&> file`** — redirects both stdout and stderr to a file
- **`lsof -ti :<port>`** — "list open files, just the process IDs, for this port"; essential for diagnosing port conflicts
- **`sqlite3 <db> "<sql>"`** — run a SQL command against an SQLite file directly from the terminal
- **`.tables` / `.schema`** — SQLite dot-commands (meta-commands, not SQL) that show table names and CREATE statements
- **Seed script** — a one-time script to pre-populate reference data the app depends on; not part of the API, run manually once per environment
- **Idempotent seeding** — the seed script checks before inserting so running it twice doesn't create duplicates

### What Comes Next
Step 4 — Build the first real API routes: `POST /consent` (record a new consent event) and `GET /consent/latest` (retrieve current consent for a user+domain).

---

## Step 4 — Build API Routes (POST /consent and GET /consent/latest)
**Date:** 2026-05-31

### What & Why
With the database tables in place, we can now build the two most important endpoints:
- `POST /consent` — called when a user interacts with a cookie banner; records their choices as a new immutable event
- `GET /consent/latest` — called when a page loads to check if this user has already consented; returns their most recent record

We also introduced **schemas** — a separate layer of Pydantic models that define what the API accepts and returns, independent of the database models. This separation matters because what you store in the DB is not always the same shape as what you expose in the API.

### What Changed

| File | Change |
|---|---|
| `backend/app/schemas.py` | Created — request/response shapes for the consent endpoints |
| `backend/app/routers/consent.py` | Created — the two API endpoints |
| `backend/app/main.py` | Added router import and `app.include_router(consent.router)` |

### Schemas (backend/app/schemas.py)
Schemas are **not** database tables — they are just shapes for data coming in and going out of the API.

```
ConsentIn (request body for POST)
├── user_identifier: str
├── domain: str
└── decisions: list of DecisionIn
      ├── category_name: str   (e.g. "analytics")
      └── accepted: bool

ConsentOut (response body)
├── id, user_identifier, domain, created_at, previous_record_id
└── decisions: list of DecisionOut
      ├── category_name: str
      └── accepted: bool
```

### POST /consent — Logic Walkthrough
1. Query for the most recent existing `ConsentRecord` for this user+domain → becomes `previous_record_id`
2. Create a new `ConsentRecord` and `flush()` to get its auto-assigned `id` without committing yet
3. For each decision in the payload, look up the `ConsentCategory` by name, create a `ConsentDecision` row
4. `commit()` — writes everything to the database atomically
5. Return the new record with its decisions

### GET /consent/latest — Logic Walkthrough
1. Query `ConsentRecord` filtered by `user_identifier` + `domain`, ordered by `id DESC`, take first row
2. If no row found → return 404
3. Query `ConsentDecision` joined with `ConsentCategory` for that record's id
4. Return the record + decisions

### Commands Executed

```bash
# Kill old server process and restart with updated code
kill $(lsof -ti :8000)
uvicorn app.main:app --port 8000 &> /tmp/uvicorn.log &
sleep 3 && curl -s http://localhost:8000/health

# Test POST /consent — first event (no previous record)
curl -s -X POST http://localhost:8000/consent \
  -H "Content-Type: application/json" \
  -d '{"user_identifier": "cookie-abc-123", "domain": "shop.com",
       "decisions": [{"category_name": "strictly_necessary", "accepted": true},
                     {"category_name": "analytics", "accepted": true},
                     {"category_name": "marketing", "accepted": false}]}'

# Test POST /consent — second event (user changes mind; previous_record_id should = 1)
curl -s -X POST http://localhost:8000/consent \
  -H "Content-Type: application/json" \
  -d '{"user_identifier": "cookie-abc-123", "domain": "shop.com",
       "decisions": [{"category_name": "strictly_necessary", "accepted": true},
                     {"category_name": "analytics", "accepted": false},
                     {"category_name": "marketing", "accepted": false}]}'

# Test GET /consent/latest — should return record #2
curl -s "http://localhost:8000/consent/latest?user_identifier=cookie-abc-123&domain=shop.com"

# Test GET /consent/latest — unknown user, should return 404
curl -s "http://localhost:8000/consent/latest?user_identifier=unknown-user&domain=shop.com"
```

### Test Results
```
POST #1 → id=1, previous_record_id=null   ✓ (first record, no chain yet)
POST #2 → id=2, previous_record_id=1      ✓ (chain linked to record #1)
GET latest → returns record #2             ✓ (most recent wins)
GET unknown → 404 with clear message       ✓ (handles missing data gracefully)
```

### Key Concepts
- **Router** — a FastAPI object that groups related endpoints; registered on the app with `include_router()`; keeps `main.py` clean as the app grows
- **Schema vs Model** — Models define DB tables; Schemas define API shapes. They often look similar but serve different purposes: models map to storage, schemas map to the API contract with clients
- **`Depends(get_session)`** — FastAPI's dependency injection; automatically opens a DB session before the function runs and closes it after, without you writing any setup/teardown code
- **`session.flush()`** — sends the INSERT to the database within the current transaction so the auto-generated `id` is returned, but does not commit; lets you use the new `id` to create related rows before committing everything at once
- **`session.commit()`** — makes all changes permanent; if anything fails before this line, nothing is written
- **`order_by(ConsentRecord.id.desc())`** — sorts results highest-id-first so `.first()` gives the most recent record
- **`status_code=201`** — HTTP 201 Created is the correct response code for a successful POST that creates a new resource (vs 200 OK which means "request succeeded but nothing new was created")
- **`raise HTTPException(404, ...)`** — FastAPI converts this into a proper JSON error response automatically
- **JOIN** — combines rows from two tables based on a matching field; used in GET /latest to fetch decision rows enriched with category names from the category table

### What Comes Next
Step 5 — Open `http://localhost:8000/docs` to explore the auto-generated API documentation and test the endpoints interactively in the browser.

---

## Step 5 — Explore the Auto-Generated API Docs
**Date:** 2026-05-31

### What & Why
FastAPI automatically generates interactive API documentation from your code — no extra work needed. It does this by reading your route decorators, function signatures, and Pydantic schemas, then producing an **OpenAPI specification** (a standard JSON document that describes your API). The `/docs` page renders that spec as a visual, clickable UI.

This is one of FastAPI's biggest advantages: your code *is* your documentation. If you change a schema or add a route, the docs update instantly.

### Two URLs FastAPI gives you for free

| URL | What it is |
|---|---|
| `http://localhost:8000/docs` | Swagger UI — interactive browser for your API |
| `http://localhost:8000/openapi.json` | The raw OpenAPI spec in JSON format |

### Commands Executed
```bash
# Verify the server was still running
curl -s http://localhost:8000/health

# Fetch the raw OpenAPI specification
curl -s http://localhost:8000/openapi.json | python3 -m json.tool
```

### What the OpenAPI Spec Contains
The spec is a machine-readable contract for your API. Key sections:

**`info`** — title, description, version (set in `main.py` when we created the FastAPI app)

**`paths`** — every route, its method, parameters, request body, and possible responses:
```
POST /consent     → accepts ConsentIn body → returns ConsentOut (201) or error (422)
GET  /consent/latest → accepts query params → returns ConsentOut (200) or error (422)
GET  /health      → no params → returns {} (200)
```

**`components/schemas`** — every Pydantic schema with its fields and types:
```
ConsentIn    → user_identifier (str), domain (str), decisions (DecisionIn[])
ConsentOut   → id (int), user_identifier, domain, created_at, previous_record_id, decisions
DecisionIn   → category_name (str), accepted (bool)
DecisionOut  → category_name (str), accepted (bool)
```

Notice `422 Unprocessable Entity` appears on every route automatically — FastAPI adds this because it validates all inputs against your schemas before your code runs. If the client sends the wrong shape, FastAPI rejects it immediately with a clear error.

### What to Do in the /docs UI
1. Open `http://localhost:8000/docs` in your browser
2. Click **POST /consent** → click **"Try it out"** → paste a request body → click **Execute**
3. See the response, status code, and the curl command it ran
4. Click **GET /consent/latest** → enter `user_identifier` and `domain` as query params → Execute
5. Try sending an invalid category name — observe the 400 error response

### Key Concepts
- **OpenAPI** — an industry-standard specification format for describing REST APIs; supported by almost every API tool and language
- **Swagger UI** — an open-source tool that renders an OpenAPI spec as an interactive web page; FastAPI bundles it automatically
- **`/openapi.json`** — the raw spec; frontend teams, mobile teams, or third-party tools can import this to auto-generate API clients in their own language
- **422 Unprocessable Entity** — HTTP status meaning "the request was well-formed (valid JSON) but the content failed validation"; FastAPI returns this automatically when a required field is missing or the wrong type
- **API contract** — the formal agreement between backend and frontend about what requests look like and what responses return; the OpenAPI spec *is* the contract

### What Comes Next
Step 6 — Set up git version control and make the first commit.

---

## Step 6 — Git Setup and First Commit
**Date:** 2026-06-01

### What & Why
Version control with git does two things:
1. **Safety net** — you can always revert to any previous working state
2. **Learning diary** — `git log` and `git diff` show exactly what changed in each step, complementing this `COMMAND_LOG.md`

From this step forward, every logical step ends with a commit.

We also created a `.gitignore` before the first commit — this is critical. Files listed in `.gitignore` are permanently excluded from git. If you accidentally commit a secret (like a database password in `.env`), removing it from git history is painful. Always set up `.gitignore` first.

### What Changed

| File | Change |
|---|---|
| `.gitignore` | Created — tells git which files to permanently ignore |

### The .gitignore Rules Explained

```
venv/          Python virtual environment — thousands of package files, not your code
               (anyone can recreate it with: pip install -r requirements.txt)
__pycache__/   Python auto-generates this when it compiles .py files — not source code
*.pyc          Individual compiled Python files — same reason
.env           Contains secrets like database passwords — NEVER commit this
*.db           Local SQLite database — each developer/environment has their own
.DS_Store      macOS metadata file added to every folder — not part of the project
node_modules/  Future frontend — same as venv/, anyone can recreate with npm install
dist/          Future frontend build output — generated files, not source code
```

### Commands Executed

```bash
# Initialise an empty git repository in the project root
git init

# Check what git can see before staging — verify .gitignore is working
git status

# Stage all files git can see (everything not in .gitignore)
git add .

# Review exactly what is staged before committing
git status

# Create the first commit
git commit -m "feat: initial backend scaffold with consent API"
```

### What the Staged File List Confirmed
```
✓  .gitignore
✓  COMMAND_LOG.md
✓  backend/app/__init__.py
✓  backend/app/database.py
✓  backend/app/main.py
✓  backend/app/models.py
✓  backend/app/routers/__init__.py
✓  backend/app/routers/consent.py
✓  backend/app/schemas.py
✓  backend/requirements.txt
✓  backend/seed.py

✗  venv/         (hidden by .gitignore — correct)
✗  .env          (hidden by .gitignore — correct)
✗  consent.db    (hidden by .gitignore — correct)
```

### Commit Message Format: feat/fix/chore
Good commit messages follow a convention — a short prefix says what kind of change it is:

| Prefix | Meaning | Example |
|---|---|---|
| `feat:` | New feature or capability | `feat: add POST /consent endpoint` |
| `fix:` | Bug fix | `fix: prevent duplicate categories on seed` |
| `chore:` | Maintenance, config, tooling | `chore: add .gitignore` |
| `docs:` | Documentation only | `docs: update COMMAND_LOG step 3` |

This is called **Conventional Commits** — widely used in professional teams.

### Key Concepts
- **`git init`** — creates a hidden `.git/` folder in the project root; this folder is the entire repository history
- **`git status`** — shows which files are untracked, staged, or modified; run this constantly
- **`git add .`** — stages all unignored files; can also do `git add <specific-file>` for selective staging
- **`git commit -m "..."`** — creates a permanent snapshot of everything staged
- **`.gitignore`** — a plain text file listing patterns of files git should never track; processed before `git add`
- **Staging area** — a holding zone between your working files and the repository; `git add` moves files in, `git commit` saves them permanently
- **`git log`** — shows all commits; `git log --oneline` gives a compact one-line-per-commit view
- **`git diff HEAD~1`** — shows exactly what changed between the last commit and the one before it

### What Comes Next
Step 7 — Push to GitHub via SSH.

---

## Step 7 — Push to GitHub via SSH
**Date:** 2026-06-01

### What & Why
Pushing to GitHub gives the project a remote backup and a public URL. From this point, every step ends with `git push` so the remote stays in sync.

We used **SSH** instead of HTTPS because GitHub no longer accepts passwords over HTTPS. SSH authenticates using a key pair — a private key on your machine and a public key registered on GitHub. You generate it once and never need to enter credentials again.

### What Changed
No code changes — this step was purely git and SSH configuration.

### Commands Executed

```bash
# Test whether SSH can reach GitHub (before adding to known_hosts this fails)
ssh -T git@github.com

# GitHub's host key wasn't in known_hosts yet — add it
ssh-keyscan github.com >> ~/.ssh/known_hosts

# Test again — "Hi sachin3366! You've successfully authenticated" = success
# (exit code 1 is expected — GitHub confirms auth but denies shell access)
ssh -T git@github.com

# Switch remote URL from HTTPS to SSH
git remote set-url origin git@github.com:sachin3366/consent-platform.git

# Push and set upstream tracking (so future `git push` needs no arguments)
git push -u origin main
```

### SSH Key Setup (done manually before these commands)
```bash
# Generated a new SSH key pair
ssh-keygen -t ed25519 -C "sachinkhanna3366@gmail.com"
# Creates two files:
#   ~/.ssh/id_ed25519      ← private key (never share this)
#   ~/.ssh/id_ed25519.pub  ← public key (safe to share — added to GitHub)

# Copied public key to clipboard
cat ~/.ssh/id_ed25519.pub | pbcopy
# Then pasted into: github.com → Settings → SSH and GPG keys → New SSH key
```

### HTTPS vs SSH — Why SSH Wins for Development

| | HTTPS | SSH |
|---|---|---|
| Authentication | Personal Access Token (expires, must be rotated) | Key pair (set once, works forever) |
| Credential prompt | Every push unless cached | Never after setup |
| Security | Token can leak if stored carelessly | Private key stays on your machine |
| Setup effort | Low | Slightly higher (one-time) |

### Key Concepts
- **SSH key pair** — two mathematically linked files: private key (stays on your machine) and public key (shared with GitHub). GitHub encrypts a challenge with your public key; your machine decrypts it with the private key. If decryption succeeds, you're authenticated — no password needed.
- **`known_hosts`** — a file that records the fingerprints of servers you've connected to before. When you connect again, SSH checks the fingerprint matches. `ssh-keyscan` adds a server's fingerprint without requiring an interactive prompt.
- **`git remote set-url`** — changes the URL of an existing remote without removing and re-adding it
- **`-u` flag on git push** — sets "upstream tracking", linking your local `main` branch to `origin/main`. After this, plain `git push` (no arguments) knows where to push.
- **`ed25519`** — a modern elliptic curve algorithm for SSH keys; faster and more secure than the older RSA algorithm

### Repository URL
**https://github.com/sachin3366/consent-platform**

### Git Workflow Going Forward
```bash
git add .                        # stage changes
git status                       # verify what's staged
git commit -m "feat: ..."        # commit with clear message
git push                         # push to GitHub (no arguments needed after -u)
```

### What Comes Next
Step 8 — Add `GET /consent/history` endpoint (returns the full audit chain for a user+domain), commit and push.

---

## Step 8 — Add GET /consent/history Endpoint
**Date:** 2026-06-01

### What & Why
`GET /consent/latest` answers "what does this user consent to right now?" — one record.
`GET /consent/history` answers "show me everything this user has ever consented to" — all records, newest first.

This is the audit trail endpoint. A compliance team, a support agent, or the user themselves could call this to see exactly how consent preferences changed over time and when.

### What Changed

| File | Change |
|---|---|
| `backend/app/routers/consent.py` | Added `GET /consent/history` route |

### The Endpoint Logic

```
1. SELECT all ConsentRecord rows for user+domain, ORDER BY id DESC
2. If none found → 404
3. For each record (loop):
      SELECT ConsentDecision JOIN ConsentCategory WHERE consent_record_id = record.id
      Build a ConsentOut object with decisions list
4. Return the list of ConsentOut objects
```

### Response Shape
```json
[
  {
    "id": 2, "previous_record_id": 1,
    "decisions": [{"category_name": "analytics", "accepted": false}]
  },
  {
    "id": 1, "previous_record_id": null,
    "decisions": [{"category_name": "analytics", "accepted": true}]
  }
]
```
Reading top to bottom = most recent → oldest. You can see analytics flipped from `true` → `false` between record #1 and #2.

### Commands Executed
```bash
# Restart server to pick up code change
kill $(lsof -ti :8000)
uvicorn app.main:app --port 8000 &> /tmp/uvicorn.log &
sleep 3 && curl -s http://localhost:8000/health

# Test — should return 2 records newest first
curl -s "http://localhost:8000/consent/history?user_identifier=cookie-abc-123&domain=shop.com"

# Test — unknown user, should return 404
curl -s "http://localhost:8000/consent/history?user_identifier=nobody&domain=shop.com"

# Stage only the changed file (not everything)
git add backend/app/routers/consent.py
git status
git commit -m "feat: add GET /consent/history endpoint"
git push
```

### N+1 Query Problem — A Known Trade-off
This endpoint runs **one SELECT per record** to fetch decisions. If a user had 100 consent records, that's 101 database queries (1 for records + 100 for decisions). This is called the **N+1 problem**.

For `/consent/history` this is acceptable — it's an audit endpoint called rarely, not on every page load. The alternative (a single JOIN query grouped in Python) is more efficient but harder to read.

**Rule of thumb:** Optimise for the hot path (high-frequency endpoints like `/latest`). Accept N+1 on low-frequency endpoints until it becomes a measurable problem.

### Key Concepts
- **`response_model=list[ConsentOut]`** — tells FastAPI the response is an array of `ConsentOut` objects; no new schema needed
- **`.all()`** — returns every matching row as a list (vs `.first()` which returns one row or None)
- **N+1 query problem** — when fetching a list of N items requires N additional queries for related data; a classic ORM pitfall worth knowing but not always worth fixing
- **Audit trail** — an immutable, append-only log of every change; our `previous_record_id` chain makes this possible
- **`git add <specific-file>`** — staging a specific file instead of `git add .`; good practice when only one file changed, makes the commit diff cleaner

### What Comes Next
Step 9 — Start the frontend: scaffold a React app inside the `frontend/` directory.

---
