# Quick Start Guide

## Step 1: Install Dependencies

From the repo root:

```bash
npm install --prefix frontend
```

Or:

```bash
cd frontend
npm install
```

## Step 2: Start the Development Server

From the repo root:

```bash
npm run dev
```

Or from `frontend/`:

```bash
npm run dev
```

You should see output like:

```
  VITE v5.0.8  ready in 500 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

## Step 3: Open in Browser

Open your web browser and navigate to:

**http://localhost:5173**

## Step 4: Configure Supabase (Optional)

1. Copy `.env.example` to `frontend/.env`
2. Add your Supabase URL and anon key
3. Follow [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md)

## Docker Quick Start

```bash
cp .env.example .env
# Edit .env with your keys
docker compose up --build
```

- Frontend: http://localhost:8080
- Database: localhost:5432

## Step 5: Test the Features

1. **Sign Up/Login**: Create an account or login
2. **View Carousel**: Featured images auto-swipe every 5 seconds
3. **Check Header**: Bell icon for notifications, role switcher
4. **Book Events**: Click "Book Now" on event cards
5. **Study Loans**: Apply for a loan (requires Supabase)

## Troubleshooting

### Port Already in Use

Vite will try the next available port. Check terminal output for the actual URL.

### Dependencies Issues

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### Docker Build Fails

Ensure Docker Desktop is running and `.env` is configured.
