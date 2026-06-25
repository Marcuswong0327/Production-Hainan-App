# Backend — Supabase Edge Functions

Deno-based serverless functions for push notifications and scheduled messaging.

## Functions

| Function | Path | Description |
|----------|------|-------------|
| `send-fcm-notifications` | `functions/send-fcm-notifications/` | Send FCM push to device tokens on demand |
| `process-scheduled-notifications` | `functions/process-scheduled-notifications/` | Cron-style processor for scheduled notifications |

## Deploy to Supabase

```bash
# From repo root, with Supabase CLI installed
supabase functions deploy send-fcm-notifications --project-ref YOUR_REF
supabase functions deploy process-scheduled-notifications --project-ref YOUR_REF
```

Set secrets in the Supabase dashboard:

- `FIREBASE_SERVICE_ACCOUNT` — Firebase Admin SDK service account JSON

## Local Docker

The root `docker-compose.yml` builds this folder into Supabase Edge Runtime containers:

- **backend** → `send-fcm-notifications` on port 9000
- **backend-scheduler** → `process-scheduled-notifications` on port 9001

```bash
docker compose up --build backend
```

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key for admin DB access |
| `FIREBASE_SERVICE_ACCOUNT` | Yes | Firebase service account JSON string |
