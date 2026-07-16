# NUSphere

NUSphere is a mentorship matching web application for NUS students. The idea is to help students find seniors, professors, and experienced peers who are relevant to their academic goals, interests, CCAs, research plans, exchange/NOC plans, and other pathways through university.

This repository contains the NUSphere MVP work. The app now keeps the core full-stack flow working with persistent backend storage: users can sign up or log in, the frontend talks to the backend, profile information is saved in a database, and mentor recommendations are returned based on user interests and goals.

## Live Demo

Frontend:

```text
https://nusphere-sigma.vercel.app
```

Backend health check:

```text
https://nusphere-production-c2e3.up.railway.app/health
```

Demo account:

```text
Email: studentid@u.nus.edu
Password: password123
```

## What Is Implemented

- Student and mentor login/register flow
- User profile page populated with information entered during sign up
- Home page greeting that uses the logged-in user's name
- Logout flow connected to the backend
- Basic mentor recommendation endpoint
- Mentor listing and mentor profile screens
- Frontend-backend integration through FastAPI endpoints
- UI based on the provided NUSphere mockups

## Tech Stack

Frontend:

- Next.js 14
- TypeScript
- Tailwind CSS

Backend:

- Python
- FastAPI
- Pydantic
- SQLAlchemy
- PostgreSQL-compatible database through `DATABASE_URL`
- SQLite fallback for local development

Deployment:

- Vercel for the frontend
- Railway for the backend

Planned production services:

- Supabase PostgreSQL or Railway PostgreSQL for persistent storage
- Supabase Auth
- Supabase Realtime for future messaging
- OpenAI embeddings for richer mentor recommendations
- OpenRouter for the future AI assistant

## Project Structure

```text
.
|-- backend
|   |-- app
|   |   `-- main.py
|   |-- requirements.txt
|   |-- railway.json
|   `-- Procfile
|-- frontend
|   |-- app
|   |-- lib
|   |-- package.json
|   `-- vercel.json
|-- Dockerfile
|-- DEPLOYMENT.md
`-- README.md
```

## Local Setup

Run the backend:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Run the frontend in another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## Environment Variables

Frontend:

```text
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Backend:

```text
FRONTEND_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
DATABASE_URL=sqlite:///./nusphere.db
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_JWT_AUDIENCE=authenticated
```

For the deployed version, `NEXT_PUBLIC_API_URL` should point to the Railway backend URL, `FRONTEND_ORIGINS` should include the Vercel frontend URL, `DATABASE_URL` should point to the managed PostgreSQL database connection string, and `SUPABASE_URL` should identify the Supabase project that issues access tokens.

## Authentication

The backend validates Supabase access-token signatures, issuer, audience, expiry, and subject against the project's JWKS endpoint. After Supabase signup, the frontend sends the access token as `Authorization: Bearer <token>` to `PUT /auth/profile`; this creates the application profile or synchronizes the existing profile. Email comes from the signed token rather than the request body, and an account's student/mentor role cannot be changed after creation.

Existing local profiles are linked by matching the authenticated Supabase email. Keep Supabase email confirmation enabled before migrating real accounts so an email address must be verified before it can claim an existing profile. The backend does not need a Supabase service-role key.

## Database Storage

The backend stores application data through SQLAlchemy tables instead of in-memory dictionaries.

- `users`: Supabase user identity, student and mentor profiles, profile pictures, interests, goals, mentor type fields, and profile edits
- `sessions`: retained temporarily for migration compatibility; no longer used for authentication
- `questions`: Q&A posts, knowledge archive tags, attachment names, and generated key terms
- `answers`: mentor responses and archive summaries
- `conversations`: student-mentor chat threads
- `connections`: pending and accepted mentor-student connection requests
- `messages`: individual chat messages
- `profile_embeddings`: cached semantic profile vectors and embedding model metadata

Local development uses `sqlite:///./nusphere.db` if `DATABASE_URL` is not set. Deployment should use a PostgreSQL URL from Supabase or Railway. Alembic owns the database schema; run `alembic upgrade head` from `backend/` after pulling schema changes and before starting the API.

After changing `backend/app/models.py`, create and review a migration:

```powershell
cd backend
alembic revision --autogenerate -m "describe the schema change"
alembic upgrade head
```

## Current Limitations

This is still an MVP-stage system. The backend Supabase JWT flow is implemented, but the frontend must complete its Supabase client migration before this backend version is deployed.
- Mentor recommendation logic is currently rule-based rather than embedding-based.
- Ratings and the AI assistant are still future features.

## Next Steps

For Milestone 2, the main improvements should be:

- Connect Supabase Auth
- Expand mentor profiles and recommendation data
- Add the Q&A platform
- Start the communication system
- Improve mentor matching with embeddings
- Add tests for auth, profile, and recommendation flows

## Deployment

Deployment details are in [DEPLOYMENT.md](DEPLOYMENT.md).
