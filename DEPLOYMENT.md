# Deployment Guide

This project is deployed using the services listed in the proposal:

- Frontend on Vercel
- Backend on Railway
- Supabase planned for persistent auth and database storage

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
```

This allows the deployed frontend to call the backend from the browser.

Optional variables reserved for future production integrations:

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
OPENROUTER_API_KEY=
```

For the Milestone 1 proof of concept, these can stay blank.

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
2. Generate a Railway public domain.
3. Confirm the backend works by visiting `/health`.
4. Deploy the frontend on Vercel.
5. Add the Vercel URL to `FRONTEND_ORIGINS` in Railway.
6. Redeploy the Railway backend.
7. Test login, signup, profile, recommendations, and logout on the Vercel site.

## Supabase Upgrade Path

The current proof of concept keeps auth/profile data in backend memory. This is acceptable for Milestone 1 because the aim is to prove frontend-backend integration, but it is not enough for a real production deployment.

For the next version, Supabase should store user profiles persistently. A possible `profiles` table is:

```sql
create table profiles (
  id uuid primary key,
  email text not null unique,
  role text not null check (role in ('student', 'mentor')),
  name text not null,
  faculty text not null,
  interests text[] not null default '{}',
  goals text[] not null default '{}',
  created_at timestamptz not null default now()
);
```

Once Supabase Auth is connected, the backend should validate Supabase JWTs instead of using the current demo session tokens.

## Troubleshooting

If Railway shows "Application failed to respond", check these first:

- The public networking port should match the running container port.
- The deployment logs should show that Uvicorn started successfully.
- The `/health` endpoint should return `{"status":"ok"}`.

If the Vercel site loads but login fails:

- Check that `NEXT_PUBLIC_API_URL` points to the Railway backend.
- Check that `FRONTEND_ORIGINS` in Railway contains the exact Vercel URL, without a trailing slash.
- Redeploy both services after changing environment variables.
