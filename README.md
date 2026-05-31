# NUSphere Technical Proof of Concept

Milestone 1 proof of concept for NUSphere, an NUS mentorship matching platform.

## Stack

- Frontend: Next.js 14, TypeScript, Tailwind CSS
- Backend: Python, FastAPI
- Database/Auth: Supabase-ready architecture with local JSON seed data for the proof of concept

## What This POC Demonstrates

- Student and mentor login/register flow against the backend
- Frontend-backend integration using FastAPI endpoints
- Basic mentor recommendation endpoint using profile interests and goals
- UI styled to match the provided NUSphere mockups

## Run Locally

Backend:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

## Deploy

See [DEPLOYMENT.md](DEPLOYMENT.md) for the Vercel, Railway, and Supabase deployment setup.
