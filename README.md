# NUSphere

NUSphere is a mentorship, Q&A, messaging and opportunity-discovery web app for NUS students. It helps students find relevant mentors, ask archived university questions, message connected mentors, review guidance quality, and discover personalised events, CCAs, projects, research openings and other campus opportunities.  

## Current Feature Set

- Supabase Auth signup, login, session restoration and logout
- Student and mentor profile sync into the backend database
- Mentor discovery with standard search, complete-profile AI matching and typed-goal-only AI goal matching
- Transparent match percentages, score breakdowns, provider metadata and match reasoning
- Mentor verification requests, structured availability and connection-based reviews
- Q&A archive with topic clusters, duplicate suggestions, answer summaries and notifications
- Connection-based messaging with per-user unread counts, mark-read, pin, archive and mute controls
- Notification panel with unread count, mark one read and mark all read
- Personalised For You opportunities page with posting, editing owned posts, verified mentor posts, unverified student posts and three matching modes
- Backend regression tests, frontend utility tests and GitHub Actions CI

## Tech Stack

Frontend:

- Next.js 14
- TypeScript
- Tailwind CSS
- Supabase JavaScript client

Backend:

- FastAPI
- SQLAlchemy
- Alembic
- SQLite for local development
- PostgreSQL-compatible `DATABASE_URL` for production
- Supabase JWT validation
- OpenAI embeddings with deterministic local fallback

Deployment:

- Vercel for the frontend
- Railway for the backend
- Supabase Auth
- Supabase Postgres or Railway Postgres for production persistence

## Project Structure

```text
.
|-- backend
|   |-- alembic
|   |-- app
|   |-- scripts
|   |-- tests
|   |-- .env.example
|   |-- requirements.txt
|   |-- railway.json
|   `-- Procfile
|-- frontend
|   |-- app
|   |-- components
|   |-- data
|   |-- lib
|   |-- tests
|   |-- types
|   |-- .env.example
|   |-- package.json
|   `-- vercel.json
|-- .github/workflows/ci.yml
|-- Dockerfile
|-- DEPLOYMENT.md
`-- README.md
```

## Local Setup

Create backend environment:

```powershell
cd backend
Copy-Item .env.example .env
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Create frontend environment in another terminal:

```powershell
cd frontend
Copy-Item .env.example .env.local
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

For the alternate local production server used during testing, run the frontend on `http://127.0.0.1:3001` and include that origin in `FRONTEND_ORIGINS`.

## Environment Variables

Backend values belong in `backend/.env` or Railway:

```text
FRONTEND_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
DATABASE_URL=sqlite:///./nusphere.db
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_JWT_AUDIENCE=authenticated
OPENAI_API_KEY=
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_EMBEDDING_DIMENSIONS=256
OPENAI_EMBEDDING_FALLBACK_ON_ERROR=true
MATCH_WEIGHT_SEMANTIC=0.55
MATCH_WEIGHT_STRUCTURED=0.25
MATCH_WEIGHT_FACULTY=0.10
MATCH_WEIGHT_COMPLETENESS=0.10
```

Frontend values belong in `frontend/.env.local` or Vercel:

```text
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Never expose a Supabase service-role key through the frontend or configure it for this backend. The backend validates Supabase user access tokens through the project's JWKS endpoint and does not need service-role access.

## Database

The backend stores app data with SQLAlchemy models and Alembic migrations. Local development defaults to `backend/nusphere.db`; production should use a PostgreSQL URL.

Core tables include:

- `users`
- `questions`
- `answers`
- `connections`
- `conversations`
- `messages`
- `notifications`
- `reviews`
- `mentor_availability`
- `profile_embeddings`
- `opportunities`

Run migrations after pulling schema changes:

```powershell
cd backend
alembic upgrade head
```

Create a reviewed migration after changing models:

```powershell
cd backend
alembic revision --autogenerate -m "describe schema change"
alembic upgrade head
```

## Matching Behavior

Mentor and opportunity discovery each support three modes:

- Standard search: meaningful keyword matching with stopword filtering and structured terms
- AI profile search: semantic fit using the student's full saved profile plus structured overlap
- AI goal search: semantic and term fit based only on the typed goal text

When `OPENAI_API_KEY` is absent, the backend uses deterministic local embeddings so the app remains testable. Set `OPENAI_EMBEDDING_FALLBACK_ON_ERROR=false` if production should fail AI requests when OpenAI is configured but unavailable.

## Quality Checks

Backend:

```powershell
cd backend
python -m unittest discover -s tests
python scripts\check_production_readiness.py
```

Frontend:

```powershell
cd frontend
npm test
npm run typecheck
npm run build
```

Runtime checks:

```text
GET /health
GET /readiness
```

`/health` confirms the API process is alive. `/readiness` checks database connectivity, Alembic revision, Supabase auth configuration, explicit CORS origins and matching configuration without exposing secrets.

## Deployment

Deployment instructions are in [DEPLOYMENT.md](DEPLOYMENT.md).
