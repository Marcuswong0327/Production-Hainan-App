# Scheduled Notifications: Supabase Setup & PWA + SMS

## 1. Create the table

Run the migration in **Supabase Dashboard → SQL Editor**:

- Open `database/migrations/20250316000000_scheduled_notifications.sql`
- Copy its contents and execute in the SQL Editor.

Or with Supabase CLI:

```bash
supabase db push
```

---

## 2. How to configure scheduling in Supabase

Supabase doesn’t run arbitrary cron inside the dashboard. You have two main options.

### Option A: Supabase Edge Functions + Cron (recommended)

Use **Supabase Edge Functions** with an **external cron** that calls your function on a schedule.

1. **Create an Edge Function** that:
   - Reads from `scheduled_notifications` where `schedule_at <= now()` and `sent_at IS NULL`
   - For each row, resolves recipients from `study_loan_recipients` (filter by `target`: all / active / completed)
   - For each recipient: send **in-app (PWA)** if they have a push subscription; otherwise send **SMS**
   - Updates the row: set `sent_at = now()`, `sent_count = N`, and optionally `error_log`

2. **Trigger it on a schedule** with one of:
   - **Supabase Cron (pg_cron)**  
     In SQL Editor (with `pg_cron` enabled):
     ```sql
     SELECT cron.schedule(
       'process-scheduled-notifications',
       '*/5 * * * *',  -- every 5 minutes
       $$
       SELECT net.http_post(
         url := 'https://<PROJECT_REF>.supabase.co/functions/v1/process-scheduled-notifications',
         headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
         body := '{}'::jsonb
       );
       $$
     );
     ```
     (Requires `pg_net` extension and your Edge Function URL + service role key.)
   - **External cron** (e.g. GitHub Actions, Vercel Cron, or a small server):
     - Every 5–15 minutes: `POST https://<PROJECT_REF>.supabase.co/functions/v1/process-scheduled-notifications`
     - Header: `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`

### Option B: pg_cron inside the database (no Edge Function)

You can run only SQL on a schedule. That’s enough to **mark** due notifications or enqueue them, but **sending** SMS or HTTP (e.g. to a push service) requires `pg_net` or an outbound HTTP helper. So in practice:

- Use **pg_cron** to call an Edge Function (as in Option A), or
- Use **pg_cron** only to update DB state and have a separate worker (e.g. Edge Function called by external cron) that does the actual send.

**Enable pg_cron (if you use it):**

- Supabase Dashboard → **Database** → **Extensions** → enable **pg_cron** (and **pg_net** if you call Edge Functions from SQL).

---

## 3. PWA in-app vs SMS

Your intended flow:

- **PWA users** → **inline / in-app notification** (and optionally push).
- **Non-PWA or no push** → **SMS**.

Suggested flow in the processor (e.g. Edge Function):

1. Get due rows from `scheduled_notifications` (where `schedule_at <= now()` and `sent_at IS NULL`).
2. For each schedule, get recipient list from `study_loan_recipients` (filter by `target`: all, status = active, or status = completed).
3. For each recipient:
   - If you have a **push subscription** or **device token** for that user (e.g. in a `user_push_tokens` or `profiles` table): send **in-app / PWA** (e.g. FCM, OneSignal, or your own push endpoint).
   - Else (or if PWA send fails): send **SMS** using your SMS provider (Twilio, etc.) with `phone_number` from `study_loan_recipients`.
4. Update the schedule row: `sent_at`, `sent_count`, `error_log`.

So you need:

- A table or column to store **PWA push subscription** or device token per user/recipient (e.g. when they open the PWA and grant permission).
- **SMS provider** (e.g. Twilio) with API key/secret stored in Edge Function secrets.
- One Edge Function (or two: one for “fetch due + enqueue”, one for “send”) that implements the logic above.

---

## 4. Useful queries

**Due notifications (for processor):**

```sql
SELECT id, target, message, schedule_at, created_at
FROM public.scheduled_notifications
WHERE sent_at IS NULL
  AND schedule_at <= now()
ORDER BY schedule_at ASC;
```

**Mark as sent after processing:**

```sql
UPDATE public.scheduled_notifications
SET sent_at = now(), sent_count = $1, error_log = $2
WHERE id = $3;
```

**List upcoming (admin UI):**

```sql
SELECT id, target, message, schedule_at, created_at, sent_at, sent_count
FROM public.scheduled_notifications
ORDER BY schedule_at DESC
LIMIT 50;
```

**Recipients by target (for sending):**

```sql
-- target 'all'
SELECT id, full_name, phone_number, email FROM public.study_loan_recipients;

-- target 'active'
SELECT id, full_name, phone_number, email FROM public.study_loan_recipients WHERE status = 'active';

-- target 'completed'
SELECT id, full_name, phone_number, email FROM public.study_loan_recipients WHERE status = 'completed';
```

---

## 5. App: align insert with new columns

Your app currently inserts `id`, `target`, `message`, `schedule_at`, `created_at`. The new table adds `sent_at`, `sent_count`, `error_log` (all optional with defaults). No app change is required for the insert to work. When you implement the processor, have it update `sent_at` (and optionally `sent_count`, `error_log`) so the same row isn’t sent again.
