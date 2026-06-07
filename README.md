# Consent Management Platform

A full-stack web application for recording and auditing user cookie consent preferences. Built from scratch to explore real-world requirements around data privacy compliance — GDPR opt-in semantics, CCPA opt-out semantics, immutable audit trails, and scalable write architecture.

## What it does

When a user visits a website, they are typically shown a cookie banner asking which categories of data collection they allow. This platform handles the full lifecycle of that interaction:

- **Jurisdictional consent banner** — renders differently based on privacy law; GDPR shows all-off opt-in toggles, CCPA shows all-on opt-out toggles with "Do Not Sell My Personal Information" labelling; pre-populated from the user's last saved state on return visits
- **Immutable audit trail** — every preference change is stored as a new event, never an edit; each record links back to the previous one forming a verifiable chain
- **Consent history** — a view showing every consent event for a user, newest first, with the chain of changes visible
- **API key auth** — each client (website) has a scoped API key; a key for `shop.com` cannot read or write data for `bank.com`
- **Async write queue** — consent submissions return `202 Accepted` in microseconds; database writes happen in a background worker so the consent API never slows down the customer's website

## Screenshots

**Consent Banner (GDPR)** — opt-in by default, all toggles off until the user actively consents:

![Consent Banner](docs/banner.png)

**Consent History** — immutable event chain, each record links to the previous:

![Consent History](docs/history.png)

## Tech stack

| Layer | Technology | Purpose |
|---|---|---|
| Backend API | Python, FastAPI | HTTP server and request routing |
| Database ORM | SQLModel (SQLAlchemy + Pydantic) | Maps Python classes to DB tables |
| Database | PostgreSQL | Persistent storage with concurrent writes |
| Cache | Redis | In-memory cache for `GET /consent/latest` |
| Task queue | Celery (broker: Redis) | Async consent writes in a separate worker process |
| Compliance config | Python NamedTuples (`jurisdictions.py`) | Config-driven GDPR / CCPA rules — no database table |
| Frontend | React, TypeScript, Vite | Consent banner and history UI |
| API docs | Swagger UI (auto-generated) | Interactive docs at `/docs` |

## Architectural principles

### 1. Immutable event chain

Consent records are **never edited or deleted**. Each time a user changes their preferences, a new record is created that points back to the previous one via `previous_record_id`. This forms a linked list through the database:

```
ConsentRecord #1  (previous = null)       ← origin
  └── analytics: true, marketing: true

ConsentRecord #2  (previous = #1)
  └── analytics: true, marketing: false   ← user opted out of marketing

ConsentRecord #3  (previous = #2)
  └── analytics: false, marketing: false  ← user opted out of everything
```

To get current consent → query the record with the highest ID for that user and domain.  
To audit past consent → follow `previous_record_id` back through the chain.

This satisfies a core compliance requirement: you can prove exactly what a user consented to at any point in time. No `UPDATE` or `DELETE` ever touches these records.

### 2. Config-driven compliance rules (not a database table)

Jurisdictional behaviour — which toggles default on or off, banner copy, button labels, locked categories — lives in a single Python file (`jurisdictions.py`) as immutable `NamedTuple` dicts. There is no `jurisdiction_rules` database table.

```python
RULES = {
    "GDPR": JurisdictionConfig(requires_opt_in=True,  button_label="Save preferences",    ...),
    "CCPA": JurisdictionConfig(requires_opt_in=False, button_label="Confirm choices",      ...),
}
```

**Why a file and not a table?** Compliance rules are code-level concerns, not operational data. Changing a rule should go through code review and get a git diff. `git log backend/app/jurisdictions.py` is the complete audit trail of every rules change — who made it, when, and what the diff was. A database table would require a migration and an admin UI just to get that same traceability. Adding a new jurisdiction means adding one entry to `RULES` and nothing else.

### 3. Thin write path (async processing)

When a user submits their preferences, `POST /consent` returns a `202 Accepted` response in microseconds — it does not wait for the database write to finish. The write is handed off to a **Celery worker** running as a separate process:

```
Browser → POST /consent → Redis queue → 202 back instantly
                               ↓
                      Celery worker process
                               ↓
                      Writes to PostgreSQL + invalidates cache
```

The route handler does three things: validate the API key, check domain authorization, enqueue the task. No database session is opened. This keeps the write path thin, matching the real-world requirement that a consent API must never slow down the customer's website.

### 4. Cache-aside for reads

`GET /consent/latest` is called on every page load — the hottest endpoint in the system. Results are cached in Redis per `user_identifier + domain`:

- **Cache hit** → return in-memory JSON, no database query
- **Cache miss** → query PostgreSQL, store in Redis with a 5-minute TTL, return result
- **On new submission** → the Celery worker deletes the cache key after committing, so the next read rebuilds from the fresh row

The TTL is a safety net: if cache invalidation ever fails (e.g. Redis momentarily unreachable during a write), the key expires automatically rather than serving stale data indefinitely.

### 5. Per-domain API key authorization

Every client (website) registers and receives an API key scoped to their domain. Every protected request must include the key in the `X-API-Key` header. The server checks two things in order:

1. **Authentication** — does this key exist? (`401` if not — caller is unidentified)
2. **Authorization** — does this key's domain match the requested domain? (`403` if not — caller is identified but not permitted)

The `GET /consent/rules/{jurisdiction}` endpoint is intentionally public: a site needs to fetch banner rules before it can render the consent UI, and it has no user identity at that point yet.

### 6. Frontend: centralized API layer

All `fetch()` calls live in a single file — `api.ts` — never scattered across components. Components import named functions (`fetchRules`, `fetchLatest`, `submitConsent`, etc.) and never construct URLs or set headers themselves. This means:

- The `X-API-Key` header is set in one place; changing auth doesn't touch any component
- TypeScript interfaces in `api.ts` mirror the backend schemas, so field mismatches (e.g. `record.userId` vs `record.user_identifier`) are caught at compile time, not at runtime in the browser
- Every fetch function is independently testable

### 7. Frontend: jurisdiction-aware banner rendering

`ConsentBanner` takes a `jurisdiction` prop. When it mounts (or when jurisdiction changes), it fires two requests in parallel — rules for the current jurisdiction and the user's last saved preferences — then merges them:

```typescript
Promise.all([fetchRules(jurisdiction), fetchLatest(userId, domain)])
  .then(([rules, latest]) => {
    // Start from jurisdiction defaults (GDPR: all off, CCPA: all on)
    const defaults = Object.fromEntries(
      rules.categories.map(c => [c.name, c.default_accepted])
    );
    // Overlay saved preferences if they exist
    if (latest) {
      latest.decisions.forEach(d => (defaults[d.category_name] = d.accepted));
    }
    setDecisions(defaults);
  });
```

Starting from jurisdiction defaults then overlaying saved preferences handles both first-time users (no saved prefs → jurisdiction defaults apply) and returning users (saved prefs override defaults) in a single code path. New categories added since a user last saved also default to the jurisdiction's setting rather than crashing.

### 8. Frontend: state lifting and the refreshKey pattern

`App.tsx` owns a `refreshKey` counter. After a successful banner submission it increments the counter and passes it to `ConsentHistory` as a prop. `ConsentHistory` lists `refreshKey` in its `useEffect` dependency array, so it automatically re-fetches whenever the counter changes — without imperative calls between siblings and without a global state library.

```
App (owns refreshKey)
 ├── ConsentBanner  → calls onSubmitted() after submit
 │                    → App increments refreshKey
 └── ConsentHistory → useEffect([..., refreshKey]) re-fetches
```

## Data models

```
ConsentCategory     — the types of cookies (analytics, marketing, etc.)
ConsentRecord       — one immutable consent event per user interaction (includes jurisdiction)
ConsentDecision     — the yes/no answer for one category within one record
APIClient           — a registered website with an API key scoped to one domain
```

## API endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | Public | Server health check |
| `GET` | `/consent/categories` | Public | List all consent categories |
| `GET` | `/consent/rules/{jurisdiction}` | Public | Banner config for a jurisdiction (GDPR / CCPA) |
| `POST` | `/consent` | Required | Enqueue a new consent event (returns 202) |
| `GET` | `/consent/latest` | Required | Get a user's current (most recent) consent |
| `GET` | `/consent/history` | Required | Get a user's full consent audit trail |

Interactive docs at `http://localhost:8000/docs` when running locally.

## Project structure

```
consent-platform/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI app, CORS, lifespan handler
│   │   ├── database.py       # PostgreSQL engine and session factory
│   │   ├── models.py         # SQLModel table definitions
│   │   ├── schemas.py        # Pydantic request/response shapes
│   │   ├── auth.py           # API key validation dependency
│   │   ├── cache.py          # Redis client and cache key helper
│   │   ├── celery_app.py     # Celery configuration (broker: Redis)
│   │   ├── tasks.py          # write_consent_record async task
│   │   ├── jurisdictions.py  # Config-driven GDPR / CCPA rules (NamedTuples)
│   │   └── routers/
│   │       └── consent.py    # All /consent API routes
│   ├── seed.py               # Seeds consent categories and test API clients
│   └── requirements.txt
└── frontend/
    └── src/
        ├── api.ts                # All fetch() calls in one place
        ├── App.tsx               # Nav shell, jurisdiction selector, state lifting
        ├── ConsentBanner.tsx     # Jurisdiction-aware toggle UI + submit
        └── ConsentHistory.tsx    # Audit chain table
```

## Running locally

**Prerequisites:** Python 3.11+, Node.js 18+, PostgreSQL 16, Redis

### Infrastructure

```bash
# Install and start PostgreSQL
brew install postgresql@16
brew services start postgresql@16
createdb consent_platform

# Install and start Redis
brew install redis
brew services start redis
```

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
python seed.py                  # seeds categories and a test API client (run once)
uvicorn app.main:app --port 8000 --reload
```

### Celery worker (separate terminal)

```bash
cd backend
source venv/bin/activate
celery -A app.celery_app worker --loglevel=info
```

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local   # then set VITE_API_KEY=demo-api-key-local
npm run dev
```

Open `http://localhost:5173`. The test API key for local dev is `demo-api-key-local` (seeded automatically, scoped to `demo.local`). Switch the jurisdiction dropdown between GDPR and CCPA to see the banner adapt.

## Build diary

[COMMAND_LOG.md](COMMAND_LOG.md) is a step-by-step log of how this project was built — each step explains what was done, why, and what concepts it demonstrates. Written to be readable cold, without the original conversation.
