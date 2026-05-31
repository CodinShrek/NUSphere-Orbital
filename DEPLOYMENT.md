# NUSphere Deployment

This proof of concept is prepared for the services named in the proposal:

- Frontend: Vercel
- Backend: Railway
- Production database/auth target: Supabase

## 1. Railway Backend

Create a Railway service from this repository and set the service root directory to:

```text
backend
```

Railway will use `backend/railway.json` and start FastAPI with:

```text
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Set these Railway environment variables:

```text
FRONTEND_ORIGINS=https://your-vercel-domain.vercel.app
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
OPENROUTER_API_KEY=
```

Current deployed frontend:

```text
https://nusphere-sigma.vercel.app
```

Current deployed backend:

```text
https://nusphere-production-c2e3.up.railway.app
```

For the current technical proof of concept, Supabase/OpenAI/OpenRouter can stay blank. Auth and profile data are held in memory on the backend, so they reset when the Railway service restarts.

## 2. Vercel Frontend

Create a Vercel project from this repository and set the project root directory to:

```text
frontend
```

Set this Vercel environment variable:

```text
NEXT_PUBLIC_API_URL=https://your-railway-backend-domain.up.railway.app
```

Then redeploy the frontend after the Railway URL is known.

## 3. Supabase Production Upgrade

For persistent production auth/profile data, create a Supabase project and wire the backend to Supabase Auth/PostgreSQL. The current POC keeps the backend interface ready for this by using auth/profile API endpoints rather than storing profile data only in the browser.

Recommended production tables:

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

## Deployment Order

1. Deploy backend to Railway.
2. Copy the Railway public URL.
3. Add that URL as `NEXT_PUBLIC_API_URL` in Vercel.
4. Deploy frontend to Vercel.
5. Copy the Vercel public URL.
6. Add that URL as `FRONTEND_ORIGINS` in Railway.
7. Redeploy backend on Railway.
