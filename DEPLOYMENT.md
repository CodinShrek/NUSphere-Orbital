# Deployment Guide

NUSphere deploys as two services:

- Frontend: Vercel, root directory `frontend`
- Backend: Railway, built from the repository root `Dockerfile`

Use Supabase Auth for authentication. Use Supabase Postgres or Railway Postgres for production application data.

## Production Checklist

Before deploying:

- Backend tests pass: `python -m unittest discover -s tests`
- Frontend tests pass: `npm test`
- Frontend typecheck passes: `npm run typecheck`
- Frontend production build passes: `npm run build`
- Alembic migrations are current: `alembic upgrade head`
- Backend readiness check passes after deployment: `GET /readiness`
- Supabase Auth redirect URLs include the Vercel production URL
- No service-role key is exposed to Vercel or required by the backend

## Railway Backend

Railway uses the root `Dockerfile`. The container installs backend dependencies, applies migrations, then starts FastAPI:

```text
alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
```

Required Railway environment variables:

```text
FRONTEND_ORIGINS=https://YOUR_VERCEL_DOMAIN
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_JWT_AUDIENCE=authenticated
```

Optional matching variables:

```text
OPENAI_API_KEY=
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_EMBEDDING_DIMENSIONS=256
OPENAI_EMBEDDING_FALLBACK_ON_ERROR=true
MATCH_WEIGHT_SEMANTIC=0.55
MATCH_WEIGHT_STRUCTURED=0.25
MATCH_WEIGHT_FACULTY=0.10
MATCH_WEIGHT_COMPLETENESS=0.10
```

Run this locally with production-like values before configuring Railway:

```powershell
cd backend
python scripts\check_production_readiness.py
```

The script checks for required backend variables, explicit CORS origins, no service-role key, and a PostgreSQL `DATABASE_URL`.

## Vercel Frontend

Vercel project settings:

```text
Root Directory: frontend
Framework Preset: Next.js
Build Command: npm run build
```

Required Vercel environment variables:

```text
NEXT_PUBLIC_API_URL=https://YOUR_RAILWAY_BACKEND_DOMAIN
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Only use Supabase public publishable/anon keys in Vercel. Never add `SUPABASE_SERVICE_ROLE_KEY` to frontend environment variables.

## Supabase Auth Setup

1. Create or open the Supabase project.
2. Copy the project URL for `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL`.
3. Copy the publishable key for `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
4. Enable email/password authentication.
5. Keep email confirmation enabled before real users are invited.
6. Add the local and production frontend URLs to allowed redirect URLs.
7. Confirm issued access tokens use the `authenticated` audience, or update `SUPABASE_JWT_AUDIENCE`.

The backend validates signed Supabase access tokens and links them to NUSphere profiles. It does not directly create Supabase users and does not need a service-role key.

## Database Deployment

For production, use a PostgreSQL database URL from Supabase or Railway:

```text
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
```

Run migrations before the app receives traffic:

```powershell
cd backend
alembic upgrade head
```

The Dockerfile already runs this command on Railway startup. If an existing database was created before Alembic, back it up, inspect the schema, and use `alembic stamp head` only when the schema genuinely matches the migrations.

## Runtime Checks

Health check:

```text
GET https://YOUR_RAILWAY_BACKEND_DOMAIN/health
```

Expected:

```json
{"status":"ok"}
```

Readiness check:

```text
GET https://YOUR_RAILWAY_BACKEND_DOMAIN/readiness
```

Expected when production is configured:

```json
{"status":"ready"}
```

`/readiness` verifies:

- database connectivity
- Alembic revision matches the current migration head
- Supabase auth is configured
- CORS origins are explicit
- matching weights and embedding configuration are valid

It returns only non-secret metadata.

## Post-Deployment Smoke Test

After both services are deployed:

1. Sign up as a student through Supabase Auth and confirm profile sync.
2. Edit profile fields including about, goals, interests, modules, CCAs and NUS opportunities.
3. Run Find Mentors standard search, AI profile search and AI goal search.
4. Open a mentor profile, request connection, accept as mentor, then verify messaging.
5. Confirm unread message counts, mark-read, pin, archive and mute behavior.
6. Ask a Q&A question, check duplicate suggestions, answer as mentor and confirm notifications.
7. Open For You, run standard/profile/goal opportunity matching, create a student opportunity and edit it from My Posts.
8. Create a mentor opportunity and confirm it appears verified.
9. Review an accepted mentor connection from the connected mentor profile flow.

## Troubleshooting

If Railway starts but `/readiness` is `not_ready`:

- Check `DATABASE_URL` points to PostgreSQL and migrations completed.
- Check `FRONTEND_ORIGINS` contains the exact Vercel URL without a trailing slash.
- Check `SUPABASE_URL` matches the project used by the frontend.
- Check matching weights add up to `1.0`.

If Vercel loads but auth fails:

- Check `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Check Supabase redirect URLs include the Vercel URL.
- Check `NEXT_PUBLIC_API_URL` points to the Railway backend.
- Check browser requests include `Authorization: Bearer <token>`.

If AI matching seems unavailable:

- With no `OPENAI_API_KEY`, local deterministic fallback is expected.
- With `OPENAI_API_KEY`, confirm the key is set only in Railway/private local env.
- Run `python scripts\check_openai_embeddings.py` from `backend`.
