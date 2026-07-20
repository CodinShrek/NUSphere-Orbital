# Deployment Guide

This project is deployed using the services listed in the proposal:

- Frontend on Vercel
- Backend on Railway
- Supabase or Railway PostgreSQL for persistent database storage

The frontend and backend are deployed separately because the app uses a Next.js frontend and a FastAPI backend.

## Current Live URLs

Frontend:

```text
https://nusphere-sigma.vercel.app
```

Backend:

```text
https://nusphere-production-c2e3.up.railway.app
```

Backend health check:

```text
https://nusphere-production-c2e3.up.railway.app/health
```

## Railway Backend

Railway deploys the backend from the repository root using the root `Dockerfile`. The Dockerfile installs the Python backend dependencies and starts FastAPI.

The container applies pending Alembic migrations before starting the API:

```text
alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
```

When generating the Railway public domain, use the port Railway exposes for the running container. In our current deployment, the working public networking port is:

```text
8080
```

Set this Railway environment variable:

```text
FRONTEND_ORIGINS=https://nusphere-sigma.vercel.app
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_JWT_AUDIENCE=authenticated
```

`FRONTEND_ORIGINS` allows the deployed frontend to call the backend from the browser. `DATABASE_URL` connects the backend to the persistent PostgreSQL database. `SUPABASE_URL` identifies the issuer and JWKS endpoint used to validate access tokens; no service-role key is required by the backend.

If using Supabase, copy the PostgreSQL connection string from the Supabase project database settings. If using Railway PostgreSQL, add a PostgreSQL service to the same Railway project and use its generated database URL.

OpenAI-backed mentor matching variables:

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

The four matching weights must add up to `1.0`. Keep `OPENAI_API_KEY` only in Railway or a private local `.env` file. With no key, the API remains functional using deterministic local embeddings. Set `OPENAI_EMBEDDING_FALLBACK_ON_ERROR=false` if production should reject AI matching requests whenever OpenAI is configured but unavailable.

Optional variable reserved for the future AI assistant:

```text
OPENROUTER_API_KEY=
```

## Vercel Frontend

Vercel should deploy the `frontend` folder.

Project settings:

```text
Root Directory: frontend
Framework Preset: Next.js
```

Set this Vercel environment variable:

```text
NEXT_PUBLIC_API_URL=https://nusphere-production-c2e3.up.railway.app
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY
```

Use only the public Supabase anon or publishable key in Vercel; never add the service-role key to the frontend. Add the Vercel production URL to Supabase Auth's allowed redirect URLs, then redeploy so the frontend uses the deployed backend and Supabase project.

## Deployment Order

1. Deploy the backend on Railway.
2. Add a PostgreSQL database through Supabase or Railway.
3. Set `DATABASE_URL`, `SUPABASE_URL`, and `SUPABASE_JWT_AUDIENCE` in Railway.
4. Enable email confirmation and asymmetric signing keys in the Supabase Auth project.
5. Generate a Railway public domain.
6. Confirm the deployment logs show `alembic upgrade head` completed, then verify `/health`.
7. Deploy the Supabase-enabled frontend on Vercel.
8. Add the Vercel URL to `FRONTEND_ORIGINS` in Railway.
9. Redeploy the Railway backend.
10. Test login, signup/profile synchronization, profile edits, recommendations, Q&A archive, messages, and logout on the Vercel site.

## Database Schema

The baseline Alembic migration creates these SQLAlchemy tables:

- `users`: Supabase identity, student/mentor profile fields, profile pictures, interests, goals, and mentor metadata
- `sessions`: legacy table retained temporarily for migration compatibility
- `questions`: Q&A/knowledge archive posts, tags, attachments, and generated key terms
- `answers`: mentor responses and archive summaries
- `conversations`: student-mentor chat threads
- `connections`: pending and accepted mentor-student connection requests
- `messages`: individual messages
- `profile_embeddings`: cached semantic profile vectors and embedding model metadata

Alembic records the applied schema revision in `alembic_version`. New databases use `alembic upgrade head`. An existing Milestone 2 database whose tables already match the baseline should be backed up, inspected, and marked with `alembic stamp head` once rather than running the table-creation migration over existing tables.

## Troubleshooting

If Railway shows "Application failed to respond", check these first:

- The public networking port should match the running container port.
- The deployment logs should show that Uvicorn started successfully.
- The `/health` endpoint should return `{"status":"ok"}`.

If the Vercel site loads but login fails:

- Check that `NEXT_PUBLIC_API_URL` points to the Railway backend.
- Check that `FRONTEND_ORIGINS` in Railway contains the exact Vercel URL, without a trailing slash.
- Check that `DATABASE_URL` is set and the database service is running.
- Check that `SUPABASE_URL` exactly matches the project issuing the frontend access token.
- Confirm the frontend sends the Supabase access token in the `Authorization: Bearer <token>` header.
- Redeploy both services after changing environment variables.
