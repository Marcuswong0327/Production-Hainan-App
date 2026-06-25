# MyHainan App

A Progressive Web App (PWA) for the Hainan Association community, built with React, TypeScript, and Vite.

## Monorepo Structure

```
Production-Hainan-App/
├── frontend/          # React + Vite PWA
│   ├── components/
│   ├── ui/
│   ├── lib/
│   ├── styles/
│   ├── public/
│   ├── Dockerfile
│   └── package.json
├── backend/           # Supabase Edge Functions (Deno)
│   ├── functions/
│   │   ├── send-fcm-notifications/
│   │   └── process-scheduled-notifications/
│   └── Dockerfile
├── database/          # PostgreSQL migrations & schema
│   ├── migrations/
│   ├── sql/
│   └── Dockerfile
├── docs/
├── docker-compose.yml
└── package.json       # Root scripts (dev, build, docker)
```

## Features

- **User Authentication**: Supabase Auth with profiles and roles
- **Role-Based Access**: Super Admin, Sub Admin, Sub Editor, and Public users
- **Event Management**: Create, approve, and book events
- **Study Loans**: Applications, guarantors, and admin review via Supabase
- **Notifications**: FCM push, scheduled notifications, in-app panel
- **Donations & Gamification**: Points and badges

## Quick Start (Local Dev)

```bash
# Install frontend dependencies
npm install --prefix frontend

# Start dev server
npm run dev
# → http://localhost:5173
```

Or from the `frontend/` folder directly:

```bash
cd frontend
npm install
npm run dev
```

## Docker

```bash
# Copy env template and fill in Supabase/Firebase keys
cp .env.example .env

# Start all services
docker compose up --build

# Frontend:  http://localhost:8080
# Database:  localhost:5432  (postgres/postgres, db: hainan)
# Backend:   http://localhost:9000  (send-fcm-notifications)
# Scheduler: http://localhost:9001  (process-scheduled-notifications)
```

Individual services:

```bash
docker compose up --build frontend
docker compose up --build database
docker compose up --build backend
```

## Environment

Copy `.env.example` to `.env` at the repo root (for Docker) or `frontend/.env` (for local Vite dev):

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key |
| `VITE_OPENROUTER_API_KEY` | Optional — AI document extraction |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend functions only |
| `FIREBASE_SERVICE_ACCOUNT` | Backend FCM push (JSON string) |

See [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md) for database and auth setup.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start frontend dev server |
| `npm run build` | Build frontend for production |
| `npm run preview` | Preview production build |
| `npm run docker:up` | `docker compose up --build` |
| `npm run docker:down` | Stop Docker services |

## Technology Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend:** Supabase Edge Functions (Deno)
- **Database:** PostgreSQL (Supabase hosted or Docker)
- **Push:** Firebase Cloud Messaging

## Documentation

- [QUICK_START.md](QUICK_START.md) — Step-by-step local setup
- [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md) — Database & auth
- [docs/FCM_SETUP.md](docs/FCM_SETUP.md) — Push notifications
- [backend/README.md](backend/README.md) — Edge functions
- [database/README.md](database/README.md) — Migrations

## License

This project is for demonstration purposes.
