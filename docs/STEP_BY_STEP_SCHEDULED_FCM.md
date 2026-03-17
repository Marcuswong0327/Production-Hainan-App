# Step-by-step: One scheduled flow to send real FCM notifications

Use this checklist so that from the **Super Admin dashboard** you can click **Send notifications**, pick when to send, and have real FCM push delivered at that time.

---

## Step 1: Database

1. In **Supabase Dashboard** → **SQL Editor**, run the migration that creates `fcm_tokens`:
   - Open `supabase/migrations/20250318000000_fcm_tokens.sql` in your project and run its contents in the SQL Editor.
2. Ensure these tables exist (you should already have them from earlier setup):
   - `scheduled_notifications`
   - `study_loan_recipients`
   - `profiles`

---

## Step 2: Firebase project

1. Go to [Firebase Console](https://console.firebase.google.com) and select your project (or create one).
2. **Project Settings** (gear) → **General** → under “Your apps” add a **Web** app if you don’t have one. Copy the config (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId).
3. **Project Settings** → **Cloud Messaging** → **Web configuration** → **Web Push certificates** → **Generate key pair**. Copy the **public** key (VAPID key).
4. **Project Settings** → **Service accounts** → **Generate new private key** (JSON). Download the file and keep it safe; you’ll use it in Step 4.

---

## Step 3: Frontend (so users can receive FCM)

1. In your project root, create or edit `.env` and add (use the values from Step 2):

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...firebaseapp.com
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_VAPID_KEY=...   # public key from Web Push certificates
```

2. Open `public/firebase-messaging-sw.js` and replace the placeholder `firebaseConfig` object with the **same** values (apiKey, authDomain, projectId, etc.).
3. Restart the dev server (`npm run dev`).
4. As a **recipient** (a user whose email exists in `study_loan_recipients`), log in on the **public** app, click **Enable push notifications**, and allow when prompted. That saves an FCM token to `fcm_tokens`.

---

## Step 4: Supabase Edge Function secret

1. In **Supabase Dashboard** → **Project Settings** → **Edge Functions** → **Secrets**.
2. Add a secret:
   - **Name:** `FIREBASE_SERVICE_ACCOUNT`
   - **Value:** paste the **entire** contents of the JSON file you downloaded in Step 2 (service account private key). You can minify it to one line.

---

## Step 5: Deploy the scheduled function

1. In a terminal, from your **project root**:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy process-scheduled-notifications
```

(Replace `YOUR_PROJECT_REF` with your Supabase project reference from the dashboard URL.)

2. The function **process-scheduled-notifications** will appear under Edge Functions. It reads `scheduled_notifications`, finds due rows, resolves recipients → profiles → `fcm_tokens`, and sends FCM via Firebase Admin.

---

## Step 6: Run the function on a schedule

So that “at the time I like” actually triggers sending, the function must be called periodically (e.g. every 5 minutes). Choose one:

**Option A – Supabase (pg_cron + pg_net)**  
1. Supabase Dashboard → **Database** → **Extensions** → enable **pg_net**.  
2. **SQL Editor** → New query. Run (replace `YOUR_PROJECT_REF` and `YOUR_SERVICE_ROLE_KEY`):

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

**Option B – Manual test**  
To run it once (e.g. for a “send now” test):

```bash
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-scheduled-notifications' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json'
```

**Option C – External cron**  
From a server or cron job, every 5 minutes run the same `curl` as in Option B.

---

## Step 7: Use “Send notifications” in Super Admin

1. Log in as **Super Admin** and open the **Loan Recipients** tab.
2. Click **Send notifications**.
3. **Who to send to:** All loan recipients / Only active (repaying) / Only completed.
4. **When to send:** Pick date and time (e.g. now, or 10 minutes from now).
5. **Message template:** Type the body of the notification (e.g. “Your repayment is due soon.”).
6. Click **Save schedule**.

When the clock reaches the chosen time and the next run of **process-scheduled-notifications** executes (e.g. on the 5‑minute cron), it will send **real FCM** to all devices that have registered in `fcm_tokens` for the selected recipients.

---

## Quick reference

| Step | Action |
|------|--------|
| 1 | Run `fcm_tokens` migration; have `scheduled_notifications`, `study_loan_recipients`, `profiles` |
| 2 | Firebase: Web app config, VAPID key, service account JSON |
| 3 | `.env` + `firebase-messaging-sw.js` config; users enable push and get tokens in `fcm_tokens` |
| 4 | Supabase secret `FIREBASE_SERVICE_ACCOUNT` = service account JSON |
| 5 | Deploy `process-scheduled-notifications` |
| 6 | Cron (or manual curl) calls the function every 5 min |
| 7 | Super Admin → Send notifications → set audience, time, message → Save schedule |
