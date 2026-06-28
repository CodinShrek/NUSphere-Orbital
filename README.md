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
```

For the deployed version, `NEXT_PUBLIC_API_URL` should point to the Railway backend URL, `FRONTEND_ORIGINS` should include the Vercel frontend URL, and `DATABASE_URL` should point to the managed PostgreSQL database connection string.

## Database Storage

The backend stores application data through SQLAlchemy tables instead of in-memory dictionaries.

- `users`: signup data, student and mentor profiles, profile pictures, interests, goals, mentor type fields, and profile edits
- `sessions`: active login tokens
- `questions`: Q&A posts, knowledge archive tags, attachment names, and generated key terms
- `answers`: mentor responses and archive summaries
- `conversations`: student-mentor chat threads
- `messages`: individual chat messages

Local development uses `sqlite:///./nusphere.db` if `DATABASE_URL` is not set. Deployment should use a PostgreSQL URL from Supabase or Railway.

## Current Limitations

This is still an MVP-stage system, so some parts are intentionally lightweight:

- Database tables are created automatically on backend startup rather than through a full migration tool.
- Supabase Auth is not connected yet.
- Mentor recommendation logic is currently rule-based rather than embedding-based.
- Ratings and the AI assistant are still future features.

## Next Steps

For Milestone 2, the main improvements should be:

- Move database schema changes into Alembic migrations
- Connect Supabase Auth
- Expand mentor profiles and recommendation data
- Add the Q&A platform
- Start the communication system
- Improve mentor matching with embeddings
- Add tests for auth, profile, and recommendation flows

## Deployment

Deployment details are in [DEPLOYMENT.md](DEPLOYMENT.md).
