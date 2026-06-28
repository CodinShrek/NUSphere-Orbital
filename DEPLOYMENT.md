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

The app starts with:

```text
uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
```

When generating the Railway public domain, use the port Railway exposes for the running container. In our current deployment, the working public networking port is:

```text
8080
```

Set this Railway environment variable:

```text
FRONTEND_ORIGINS=https://nusphere-sigma.vercel.app
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
```

`FRONTEND_ORIGINS` allows the deployed frontend to call the backend from the browser. `DATABASE_URL` connects the backend to the persistent PostgreSQL database.

If using Supabase, copy the PostgreSQL connection string from the Supabase project database settings. If using Railway PostgreSQL, add a PostgreSQL service to the same Railway project and use its generated database URL.

Optional variables reserved for future production integrations:

```text
OPENAI_API_KEY=
OPENROUTER_API_KEY=
```

These can stay blank until the AI assistant or external auth flows are connected.

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
```

After changing this variable, redeploy the Vercel project so the frontend uses the deployed backend instead of localhost.

## Deployment Order

1. Deploy the backend on Railway.
2. Add a PostgreSQL database through Supabase or Railway.
3. Set `DATABASE_URL` in Railway.
4. Generate a Railway public domain.
5. Confirm the backend works by visiting `/health`.
6. Deploy the frontend on Vercel.
7. Add the Vercel URL to `FRONTEND_ORIGINS` in Railway.
8. Redeploy the Railway backend.
9. Test login, signup, profile edits, recommendations, Q&A archive, messages, and logout on the Vercel site.

## Database Schema

The backend creates these SQLAlchemy tables on startup:

- `users`: signup fields, student/mentor profile fields, profile pictures, interests, goals, and mentor metadata
- `sessions`: active login sessions
- `questions`: Q&A/knowledge archive posts, tags, attachments, and generated key terms
- `answers`: mentor responses and archive summaries
- `conversations`: student-mentor chat threads
- `messages`: individual messages

The current MVP creates tables automatically. A later production hardening step should move schema changes into Alembic migrations and connect Supabase Auth so the backend validates Supabase JWTs instead of demo session tokens.

## Troubleshooting

If Railway shows "Application failed to respond", check these first:

- The public networking port should match the running container port.
- The deployment logs should show that Uvicorn started successfully.
- The `/health` endpoint should return `{"status":"ok"}`.

If the Vercel site loads but login fails:

- Check that `NEXT_PUBLIC_API_URL` points to the Railway backend.
- Check that `FRONTEND_ORIGINS` in Railway contains the exact Vercel URL, without a trailing slash.
- Check that `DATABASE_URL` is set and the database service is running.
- Redeploy both services after changing environment variables.
