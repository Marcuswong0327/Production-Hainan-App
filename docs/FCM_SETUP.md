# FCM (Firebase Cloud Messaging) Setup

This guide covers using Firebase Cloud Messaging for push notifications with Supabase: storing FCM tokens and sending notifications from an Edge Function.

---

## 1. Supabase migration: `fcm_tokens` table

Run the migration in **Supabase Dashboard → SQL Editor** (or via `supabase db push` if using CLI):

- **File:** `supabase/migrations/20250318000000_fcm_tokens.sql`

This creates the `fcm_tokens` table and RLS policies so authenticated users can manage their own tokens and the service role can read all tokens for sending.

---

## 2. Firebase project and Web credentials

1. Open [Firebase Console](https://console.firebase.google.com) and select (or create) your project.
2. **Project Settings** (gear) → **Cloud Messaging**.
3. Under **Web configuration**:
   - If you don’t have a web app, click **Add app** → **Web** and register your site.
   - Under **Web Push certificates**, generate a key pair (or use an existing one). This is your **VAPID key** (public key for the frontend).
4. Note your **Firebase config** (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId) from **Project Settings → General → Your apps**.

---

## 3. Frontend: Firebase config and VAPID key

1. In the project root, add to `.env` (or `.env.local`):

```env
# Firebase (same project as FCM)
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
# Web Push certificate public key (from Cloud Messaging → Web Push certificates)
VITE_FIREBASE_VAPID_KEY=your_vapid_public_key
```

2. **Service worker:** `public/firebase-messaging-sw.js` must use the **same** Firebase config. Replace the placeholder object in that file with your project’s config (same values as above). The file must be served at `/firebase-messaging-sw.js`.

3. Restart the dev server after changing env.

---

## 4. UI: Enable push and save token

- **`lib/firebase.ts`** – initializes the Firebase app from env.
- **`lib/fcmNotifications.ts`** – `requestNotificationPermission()`, `getFCMToken()`, `saveFCMTokenToSupabase()`, `setupFCMNotifications(userId)`.
- **`components/FCMNotificationButton.tsx`** – button that requests permission, gets the FCM token, and saves it to Supabase for the current user.

The **Public Home** page shows “Enable push notifications” when the user is logged in and Firebase is configured. On success, the token is stored in `fcm_tokens`.

---

## 5. Edge Function: send FCM notifications

The function **`send-fcm-notifications`** reads FCM tokens from Supabase and sends a multicast via the Firebase Admin SDK.

### 5.1 Firebase service account secret

1. In Firebase Console: **Project Settings** → **Service accounts** → **Generate new private key** (JSON). Download the file.
2. In **Supabase Dashboard** → **Project Settings** → **Edge Functions** → **Secrets**, add:
   - **Name:** `FIREBASE_SERVICE_ACCOUNT`
   - **Value:** paste the **entire** JSON content of the service account file (as a single-line or minified string).

### 5.2 Deploy the function

From the project root:

```bash
supabase functions deploy send-fcm-notifications
```

If the secret was not set in the dashboard:

```bash
# Paste the JSON content as the value (escape or use a file)
supabase secrets set FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
```

### 5.3 Request body

`POST` to your function URL with:

- **Headers:** `Authorization: Bearer SUPABASE_SERVICE_ROLE_KEY`, `Content-Type: application/json`.
- **Body (JSON):**
  - `title` (string) – notification title.
  - `body` (string) – notification body.
  - `link` (string, optional) – URL to open when the user clicks the notification.
  - `user_ids` (array of UUIDs, optional) – send only to these Supabase auth user IDs. If omitted, all tokens in `fcm_tokens` are used.

Example:

```json
{
  "user_ids": ["uuid-1", "uuid-2"],
  "title": "海南会馆",
  "body": "Your loan repayment reminder.",
  "link": "https://yourapp.com"
}
```

Response (success): `{ "sent": 2, "success": 2, "failure": 0, "responses": [...] }`.

---

## 6. One scheduled flow (Super Admin to FCM)

The **process-scheduled-notifications** Edge Function reads due rows from `scheduled_notifications`, resolves loan recipients by target (all / active / completed) to profiles by email to **fcm_tokens**, then sends **real FCM** via Firebase Admin.

**Deploy:** `supabase functions deploy process-scheduled-notifications` (uses same `FIREBASE_SERVICE_ACCOUNT` secret).

**Cron:** Call the function every 5 min (e.g. pg_cron + pg_net, or external cron) so scheduled times are processed. Example:

```bash
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-scheduled-notifications' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' -H 'Content-Type: application/json'
```

**In Super Admin:** Loan Recipients → Send notifications → choose Who (all/active/completed), When (date/time), Message → Save schedule. When the time is reached and the cron runs, FCM is sent to devices in `fcm_tokens` for those recipients.

---

## 7. Summary

| Step | What |
|------|------|
| 1 | Run migration `20250318000000_fcm_tokens.sql` |
| 2 | Create/configure Firebase project and get Web Push (VAPID) key and config |
| 3 | Set `VITE_FIREBASE_*` and `VITE_FIREBASE_VAPID_KEY` in `.env`; update `public/firebase-messaging-sw.js` config |
| 4 | User clicks “Enable push notifications”; token is saved to `fcm_tokens` |
| 5 | Set `FIREBASE_SERVICE_ACCOUNT` secret; deploy `process-scheduled-notifications` |
| 6 | Set up cron to POST to `process-scheduled-notifications` every 5 min |
| 7 | Super Admin: Send notifications, set audience + time + message, Save schedule |
