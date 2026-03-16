# PWA In-App Push Notifications – Step-by-Step

You have **pg_cron** enabled. Next we add PWA push so scheduled notifications can be delivered in-app. After that you can add the cron job that calls the Edge Function.

---

## Step 1: Run the database migrations

In **Supabase Dashboard → SQL Editor**, run these in order (if you haven’t already):

1. **scheduled_notifications**  
   Copy and run: `supabase/migrations/20250316000000_scheduled_notifications.sql`

2. **push_subscriptions**  
   Copy and run: `supabase/migrations/20250316000001_push_subscriptions.sql`

---

## Step 2: Generate VAPID keys (one-time)

Web Push uses a key pair. Generate it once and reuse:

**Option A – Node (if you have Node):**
```bash
npx web-push generate-vapid-keys
```

**Option B – OpenSSL:**
```bash
openssl ecparam -genkey -name prime256v1 -noout -out vapid_private.pem
openssl ec -in vapid_private.pem -pubout -outform DER | tail -c 65 | base64url
openssl ec -in vapid_private.pem -outform DER | tail -c 65 | base64url
```
(First base64url = public key, second = private key.)

You need:
- **Public key** → in the frontend (browser) when subscribing.
- **Private key** → only in the Edge Function (Supabase secret), never in the frontend.

---

## Step 3: Add the public key to the app

1. Create `.env.local` (or add to `.env`) in the project root:
   ```env
   VITE_VAPID_PUBLIC_KEY=your_public_key_here
   ```
2. Restart the dev server (`npm run dev`) after changing env.

The app uses this to subscribe the user for push (see Step 5).

---

## Step 4: Add the private key to Supabase (Edge Function secret)

1. Supabase Dashboard → **Project Settings** → **Edge Functions**.
2. Add a secret, e.g.:
   - **Name:** `VAPID_PRIVATE_KEY`
   - **Value:** the **private** VAPID key from Step 2.

The Edge Function uses this to sign and send push messages.

---

## Step 5: PWA and push in the frontend (already added in code)

The repo includes:

- **`public/manifest.json`** – PWA manifest (name, icons, start_url).
- **`public/sw.js`** – Service worker that listens for `push` and shows a notification.
- **`lib/pushNotifications.ts`** – Requests permission, subscribes with the public key, and saves the subscription to `push_subscriptions`.
- **Registration** – When the user is logged in, the app registers the service worker and, if permitted, subscribes and sends the subscription to Supabase.

So once the env and Supabase table are set, the flow is: **login → permission → subscribe → save to DB**.

---

## Step 6: Deploy the Edge Function

From the project root:

```bash
supabase functions deploy process-scheduled-notifications
```

Set the secret if you didn’t in Step 4:

```bash
supabase secrets set VAPID_PRIVATE_KEY=your_private_key_here
```

The function:

- Reads from `scheduled_notifications` where `schedule_at <= now()` and `sent_at IS NULL`.
- For each row, gets recipients from `study_loan_recipients` (by `target`: all / active / completed).
- For each recipient, finds `user_id` via `profiles` (match by `email`), then gets `push_subscriptions` for that `user_id`.
- Sends a Web Push to each subscription (using the VAPID private key).
- Updates the row: `sent_at`, `sent_count`, and optionally `error_log`.

---

## Step 7: Schedule the Edge Function with pg_cron (optional)

To run the processor every 5 minutes from inside Supabase:

1. Enable **pg_net**: Dashboard → **Database** → **Extensions** → enable **pg_net**.
2. In **SQL Editor** run (replace placeholders):

```sql
SELECT cron.schedule(
  'process-scheduled-notifications',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-scheduled-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

- **YOUR_PROJECT_REF**: Supabase project URL ref (e.g. `abcdefgh` from `https://abcdefgh.supabase.co`).
- **YOUR_SERVICE_ROLE_KEY**: Project Settings → API → `service_role` (secret).

**Alternative:** use an external cron (e.g. GitHub Actions, Vercel Cron) to `POST` the same URL with the same `Authorization` header every 5 minutes.

---

## Step 8: Test the flow

1. **HTTPS:** Push only works on HTTPS (or `localhost`). Use `npm run dev` and `https` in browser if needed, or deploy to a host with HTTPS.
2. **Subscribe:** Log in as a user whose email exists in `study_loan_recipients` (or add them there). Accept the browser permission for notifications. The app should save a row in `push_subscriptions`.
3. **Schedule:** In Super Admin, open **Send notifications**, choose “Only active” (or All), set message and schedule time to **now** (or a time in the past), then **Save schedule**.
4. **Run once:** Either wait for cron or call the Edge Function manually:
   ```bash
   curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-scheduled-notifications' \
     -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY'
   ```
5. You should see a push notification on the device where you subscribed.

---

## Summary

| Step | What |
|------|------|
| 1 | Run migrations: `scheduled_notifications`, `push_subscriptions` |
| 2 | Generate VAPID keys (public + private) |
| 3 | Put public key in `VITE_VAPID_PUBLIC_KEY` |
| 4 | Put private key in Supabase secret `VAPID_PRIVATE_KEY` |
| 5 | Frontend (manifest, sw, push lib) – already in repo |
| 6 | Deploy Edge Function `process-scheduled-notifications` |
| 7 | Optionally schedule it with pg_cron (or external cron) |
| 8 | Test: subscribe → schedule → run function → see push |

After this, PWA in-app push is in place. For users without a push subscription (or not using PWA), add SMS in the same Edge Function as a fallback (e.g. Twilio).
