# Consent Management Platform

A full-stack web application for recording and auditing user cookie consent preferences. Built from scratch to explore real-world requirements around data privacy compliance (GDPR / CCPA).

## What it does

When a user visits a website, they are typically shown a cookie banner asking which categories of data collection they allow. This platform handles the full lifecycle of that interaction:

- **Consent Banner** — a UI where users toggle on/off each cookie category and save their preferences
- **Immutable audit trail** — every preference change is stored as a new event, never an edit; each record links back to the previous one forming a verifiable chain
- **Consent History** — a view showing every consent event for a user, newest first, with the chain of changes visible

This design mirrors how real consent management platforms work: consent data must be tamper-proof so a company can prove exactly what a user agreed to and when.

## Screenshots

**Consent Banner** — loads categories live from the API, all toggles default to off:

![Consent Banner](docs/banner.png)

**Consent History** — immutable event chain, each record links to the previous:

![Consent History](docs/history.png)

## Tech stack

| Layer | Technology |
|---|---|
| Backend API | Python, FastAPI |
| Database ORM | SQLModel (SQLAlchemy + Pydantic) |
| Database | SQLite (dev) |
| Frontend | React, TypeScript, Vite |
| API docs | Auto-generated Swagger UI (`/docs`) |

## Architecture

### Immutable event chain

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

### Data models

```
ConsentCategory          — the types of cookies (analytics, marketing, etc.)
ConsentRecord            — one immutable consent event per user interaction
ConsentDecision          — the yes/no answer for one category within one record
```

### API endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server health check |
| `GET` | `/consent/categories` | List all consent categories |
| `POST` | `/consent` | Record a new consent event |
| `GET` | `/consent/latest` | Get a user's current (most recent) consent |
| `GET` | `/consent/history` | Get a user's full consent audit trail |

Interactive docs available at `http://localhost:8000/docs` when running locally.

## Project structure

```
consent-platform/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app, CORS, lifespan handler
│   │   ├── database.py      # SQLite engine and session factory
│   │   ├── models.py        # SQLModel table definitions
│   │   ├── schemas.py       # Pydantic request/response shapes
│   │   └── routers/
│   │       └── consent.py   # All /consent API routes
│   ├── seed.py              # One-time script to seed consent categories
│   └── requirements.txt
└── frontend/
    └── src/
        ├── api.ts               # All fetch() calls in one place
        ├── App.tsx              # Nav shell, view switching, state lifting
        ├── ConsentBanner.tsx    # Toggle UI + submit
        └── ConsentHistory.tsx   # Audit chain table
```

## Running locally

**Prerequisites:** Python 3.11+, Node.js 18+

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
python seed.py                  # seed the consent categories (run once)
uvicorn app.main:app --port 8000 --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. The frontend talks to the backend at `http://localhost:8000`.

## Build diary

[COMMAND_LOG.md](COMMAND_LOG.md) is a step-by-step log of how this project was built — each step explains what was done, why, and what concepts it demonstrates. Written to be readable cold, without the original conversation.
