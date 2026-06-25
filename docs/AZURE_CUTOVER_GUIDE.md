# Azure Cutover Guide — Replace Supabase with Azure

Step-by-step plan to move the MyHainan app from Supabase (client-direct) to:

- **Backend API** → Azure SQL (`SQL-Azure`)
- **Auth** → `dbo.users` + JWT (replacing Supabase Auth)
- **Files** → Azure Blob Storage (replacing Supabase Storage)
- **Background jobs** → Azure Functions (replacing Edge Functions)
- **Frontend** → calls your API instead of `@supabase/supabase-js`

**Prerequisite:** Data migration to Azure SQL is done (`docs/SUPABASE_TO_AZURE_MIGRATION_GUIDE.md`).

---

## Table of contents

1. [Target architecture](#1-target-architecture)
2. [Recommended order of work](#2-recommended-order-of-work)
3. [Step 1 — Create the backend API project](#3-step-1--create-the-backend-api-project)
4. [Step 2 — Connect API to Azure SQL](#4-step-2--connect-api-to-azure-sql)
5. [Step 3 — Replace Supabase Auth with dbo.users + JWT](#5-step-3--replace-supabase-auth-with-dbousers--jwt)
6. [Step 4 — Build REST endpoints for each table](#6-step-4--build-rest-endpoints-for-each-table)
7. [Step 5 — Replace Supabase Storage with Azure Blob](#7-step-5--replace-supabase-storage-with-azure-blob)
8. [Step 6 — Port Edge Functions to Azure Functions](#8-step-6--port-edge-functions-to-azure-functions)
9. [Step 7 — Update the frontend](#9-step-7--update-the-frontend)
10. [Step 8 — Deploy to Azure](#10-step-8--deploy-to-azure)
11. [Environment variables reference](#11-environment-variables-reference)
12. [Supabase → Azure mapping cheat sheet](#12-supabase--azure-mapping-cheat-sheet)

---

## 1. Target architecture

### Today (Supabase)

```
Browser (React)
  ├── supabase.auth.*           → Supabase Auth
  ├── supabase.from('table')    → PostgreSQL + RLS
  ├── supabase.storage.*        → Supabase Storage
  └── fetch(.../functions/v1/)  → Edge Functions (Deno)
```

### After cutover (Azure)

```
Browser (React)
  └── fetch(VITE_API_URL + '/...')  → Your Backend API (Node/Express)
        ├── JWT auth middleware     → validates token, loads dbo.users + profiles
        ├── /api/* routes           → mssql → Azure SQL (SQL-Azure)
        ├── /api/files/*            → @azure/storage-blob
        └── (optional) calls Azure Functions for FCM cron

Azure Function (timer trigger)
  └── process-scheduled-notifications  → SQL + Firebase Admin
```

---

## 2. Recommended order of work

Do **not** swap everything at once. Use this sequence:

| Phase | What | Why first |
|-------|------|-----------|
| **A** | Backend API + SQL connection + health check | Proves Azure SQL works from code |
| **B** | Auth (login/signup/JWT) + profiles | Everything else needs `user.id` |
| **C** | Read-only API (GET loan recipients, applications) | Low risk; test frontend reads |
| **D** | Write API (POST/PUT/DELETE) | Replace `supabase.from().insert()` |
| **E** | Blob upload/download URLs | Replace `supabase.storage` |
| **F** | Azure Functions (FCM + scheduler) | Background; app works without it initially |
| **G** | Frontend env + `apiClient` | Final switch |
| **H** | Turn off Supabase | After full testing |

---

## 3. Step 1 — Create the backend API project

Create a **new Node API** inside `backend/api/` (separate from Edge Functions in `backend/functions/`).

```powershell
cd backend
mkdir api
cd api
npm init -y
npm install express cors dotenv mssql bcrypt jsonwebtoken uuid
npm install -D typescript @types/express @types/node @types/bcrypt @types/jsonwebtoken tsx
npx tsc --init
```

Suggested layout:

```
backend/api/
├── src/
│   ├── index.ts              # Express app entry
│   ├── config.ts             # env vars
│   ├── db/pool.ts            # Azure SQL connection pool
│   ├── middleware/auth.ts    # JWT verify
│   ├── routes/
│   │   ├── auth.ts           # login, signup, me, change-password
│   │   ├── profiles.ts
│   │   ├── loans.ts          # applications, recipients, payments
│   │   ├── notifications.ts
│   │   └── files.ts          # upload SAS, download SAS
│   └── services/
│       ├── authService.ts
│       └── blobService.ts
├── package.json
├── tsconfig.json
└── .env.example
```

**Minimal `src/index.ts`:**

```typescript
import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth.js';

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRouter);

const port = process.env.PORT ?? 3001;
app.listen(port, () => console.log(`API http://localhost:${port}`));
```

Run locally:

```powershell
npm run dev   # add "dev": "tsx watch src/index.ts" to package.json
```

Test: `http://localhost:3001/health` → `{ "ok": true }`

---

## 4. Step 2 — Connect API to Azure SQL

### 4.1 Azure Portal — allow API to connect

If API runs on your PC:

1. SQL server **azurelinktal** → **Networking**
2. Add your client IP (same as for SSMS)

If API runs on **Azure App Service** later:

1. Enable **Allow Azure services and resources to access this server**
2. Or use VNet integration

### 4.2 API `.env`

```env
AZURE_SQL_SERVER=azurelinktal.database.windows.net
AZURE_SQL_DATABASE=SQL-Azure
AZURE_SQL_USER=CloudSAddf06751
AZURE_SQL_PASSWORD=your-password

JWT_SECRET=generate-a-long-random-string-min-32-chars
JWT_EXPIRES_IN=7d

CORS_ORIGIN=http://localhost:5173
PORT=3001
```

### 4.3 Connection pool (`src/db/pool.ts`)

```typescript
import sql from 'mssql';

const config: sql.config = {
  server: process.env.AZURE_SQL_SERVER!,
  database: process.env.AZURE_SQL_DATABASE!,
  user: process.env.AZURE_SQL_USER!,
  password: process.env.AZURE_SQL_PASSWORD!,
  options: { encrypt: true, trustServerCertificate: false, enableArithAbort: true },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
};

let pool: sql.ConnectionPool | null = null;

export async function getPool() {
  if (!pool) pool = await sql.connect(config);
  return pool;
}
```

### 4.4 Test query route

```typescript
app.get('/health/db', async (_req, res) => {
  const pool = await getPool();
  const result = await pool.request().query('SELECT COUNT(*) AS n FROM dbo.users');
  res.json({ users: result.recordset[0].n });
});
```

You should see `{ "users": 5 }` if migration succeeded.

---

## 5. Step 3 — Replace Supabase Auth with dbo.users + JWT

### 5.1 Concept mapping

| Supabase Auth | Your API |
|---------------|----------|
| `signInWithPassword` | `POST /api/auth/login` → check `dbo.users.password_hash` with bcrypt |
| `signUp` | `POST /api/auth/signup` → INSERT `users` + `profiles` |
| `getSession()` | `GET /api/auth/me` with `Authorization: Bearer <token>` |
| `signOut()` | Frontend deletes token (no server call required) |
| `resetPasswordForEmail` | `POST /api/auth/forgot-password` → send email (SendGrid/Azure Communication) |
| `updateUser({ password })` | `POST /api/auth/change-password` (authenticated) |
| `session.user.id` | JWT payload `{ sub: userId }` |

### 5.2 Password hashes

Supabase stores **bcrypt** in `auth.users.encrypted_password`. If you migrated with `SUPABASE_DB_URL`, `dbo.users.password_hash` may contain valid bcrypt — `bcrypt.compare(password, hash)` works.

If passwords were **not** migrated, users must **reset password** once on the new system.

### 5.3 Signup flow (`POST /api/auth/signup`)

```sql
-- 1. Check email not taken
SELECT id FROM dbo.users WHERE email = @email;

-- 2. Insert user
INSERT INTO dbo.users (id, email, password_hash, email_confirmed)
VALUES (@id, @email, @hash, 0);

-- 3. Insert profile (same id as user)
INSERT INTO dbo.profiles (id, email, name, role, points)
VALUES (@id, @email, @name, @role, 0);
```

- Hash password: `bcrypt.hash(password, 12)`
- Super admin rule: if `email === SUPER_ADMIN_EMAIL` → `role = 'super_admin'`

Return JWT + profile JSON (same shape as current `UserProfile`).

### 5.4 Login flow (`POST /api/auth/login`)

```typescript
const user = await pool.request()
  .input('email', email)
  .query(`SELECT id, email, password_hash FROM dbo.users WHERE email = @email`);

const ok = await bcrypt.compare(password, user.recordset[0].password_hash);
if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

const profile = await loadProfile(user.recordset[0].id);
const token = jwt.sign({ sub: user.recordset[0].id }, JWT_SECRET, { expiresIn: '7d' });
res.json({ token, user: profile });
```

### 5.5 Auth middleware

```typescript
export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET!) as { sub: string };
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}
```

Every protected route uses `requireAuth`.

### 5.6 Role checks (replace Supabase RLS)

Supabase RLS is gone. Enforce in API:

```typescript
function requireRole(...roles: string[]) {
  return async (req, res, next) => {
    const profile = await loadProfile(req.userId);
    if (!roles.includes(profile.role)) return res.status(403).json({ error: 'Forbidden' });
    req.profile = profile;
    next();
  };
}

// Example: only super_admin can delete recipients
router.delete('/recipients/:id', requireAuth, requireRole('super_admin'), deleteRecipient);
```

---

## 6. Step 4 — Build REST endpoints for each table

Replace direct Supabase calls with REST. One pattern for all tables:

### 6.1 API design pattern

| Old (Supabase) | New (REST) |
|----------------|------------|
| `.from('study_loan_recipients').select('*')` | `GET /api/loan-recipients` |
| `.insert({...})` | `POST /api/loan-recipients` |
| `.update({...}).eq('id', id)` | `PATCH /api/loan-recipients/:id` |
| `.delete().eq('id', id)` | `DELETE /api/loan-recipients/:id` |
| `.select('*, guarantors(*)')` | `GET /api/loan-recipients?include=guarantors` (JOIN in SQL) |

### 6.2 Endpoint list for MyHainan app

| Resource | Routes | Used by |
|----------|--------|---------|
| **Auth** | `POST /login`, `/signup`, `/me`, `/change-password`, `/forgot-password` | AuthContext |
| **Profiles** | `GET/PATCH /api/profiles/me` | AuthContext, dashboard |
| **Applications** | `GET/POST /api/study-loan-applications` | LoansPage, StudyLoanStatusPage |
| **Recipients** | `GET/POST/PATCH/DELETE /api/loan-recipients` | SuperAdminDashboard |
| **Guarantors** | nested in recipients or `POST /api/guarantors` | SuperAdminDashboard |
| **Payments** | `GET/POST/DELETE /api/loan-payments` | RecordLoanPaymentsPage |
| **Association options** | `GET/POST/DELETE /api/association-options` | AssociationSelect |
| **Guarantor options** | `GET/POST/DELETE /api/guarantor-relationship-options` | GuarantorRelationshipSelect |
| **Notifications** | `GET/PATCH /api/user-notifications` | NotificationPanel |
| **Scheduled** | `GET/POST /api/scheduled-notifications` | SuperAdminDashboard |
| **FCM tokens** | `PUT /api/fcm-tokens` | fcmNotifications.ts |
| **Push subs** | `PUT /api/push-subscriptions` | pushNotifications.ts |

### 6.3 Example: GET loan recipients with guarantors

SQL (replaces `.select('*, guarantors(*)')`):

```sql
SELECT r.*,
  g.id AS g_id, g.student_id, g.guarantor_1_zh, g.guarantor_1_en, ...
FROM dbo.study_loan_recipients r
LEFT JOIN dbo.guarantors g ON g.student_id = r.id
ORDER BY r.created_at DESC;
```

Map rows to `{ ...recipient, guarantor: {...} | null }` in API response.

### 6.4 Build order inside Phase C/D

1. `GET /api/loan-recipients` — Super Admin list
2. `GET /api/study-loan-applications` — applicant status
3. `POST /api/study-loan-applications` — loan form
4. Remaining CRUD one screen at a time

Test each endpoint with **Postman** or **curl** before touching frontend.

---

## 7. Step 5 — Replace Supabase Storage with Azure Blob

### 7.1 Concept mapping

| Supabase Storage | Azure Blob |
|------------------|------------|
| Bucket `study-loan-documents` | Container `study-loan-documents` |
| `.upload(path, file)` | Upload via SAS URL or API proxy |
| `.createSignedUrl(path, 3600)` | Generate **SAS URL** server-side |
| `.remove([path])` | `blobClient.delete()` |

Paths in DB stay the same (`79813779-.../offer_letter.pdf`).

### 7.2 Azure Portal setup

1. **Storage accounts** → your account (e.g. `linktalresumes`)
2. **Containers** → ensure `study-loan-documents` exists (Private)
3. **Access keys** → connection string in API `.env`:

```env
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...
AZURE_STORAGE_CONTAINER=study-loan-documents
```

### 7.3 Recommended upload pattern (SAS — browser uploads direct to Blob)

**Why:** Large PDFs/photos should not pass through your API server.

**Flow:**

```
1. Frontend: POST /api/files/upload-url  { path: "uuid/offer_letter.pdf", contentType: "application/pdf" }
2. API: returns { uploadUrl: "https://...?sv=...&sig=..." }  (write SAS, 15 min expiry)
3. Frontend: PUT uploadUrl with file body (fetch)
4. Frontend: save path in loan application as before
```

**Download flow:**

```
1. Frontend: GET /api/files/download-url?path=uuid/offer_letter.pdf
2. API: returns { url: "https://...?sv=...&sig=..." }  (read SAS, 1 hour)
3. Frontend: open url in new tab or <img src={url} />
```

### 7.4 API code sketch (`@azure/storage-blob`)

```typescript
import { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential } from '@azure/storage-blob';

const service = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING!);
const container = service.getContainerClient(process.env.AZURE_STORAGE_CONTAINER!);

// Upload SAS
export function getUploadSasUrl(blobPath: string, contentType: string) {
  const blob = container.getBlockBlobClient(blobPath);
  // generate SAS with write permission, expires in 15 minutes
  return blob.generateSasUrl({ permissions: BlobSASPermissions.parse('cw'), expiresOn: ... });
}
```

Optional: after upload, `INSERT INTO dbo.file_objects` (you already have this table).

### 7.5 Frontend change (LoansPage example)

**Before:**

```typescript
await client.storage.from(STUDY_LOAN_BUCKET).upload(path, file, { upsert: true });
```

**After:**

```typescript
const { uploadUrl } = await api.post('/api/files/upload-url', { path, contentType: file.type });
await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': file.type } });
```

---

## 8. Step 6 — Port Edge Functions to Azure Functions

You have two Supabase Edge Functions:

| Function | Purpose |
|----------|---------|
| `send-fcm-notifications` | On-demand FCM push |
| `process-scheduled-notifications` | Cron: read `scheduled_notifications`, send FCM |

### 8.1 Create Azure Functions project

```powershell
npm install -g azure-functions-core-tools@4
mkdir backend/azure-functions
cd backend/azure-functions
func init --typescript
func new --name send-fcm-notifications --template "HTTP trigger"
func new --name process-scheduled-notifications --template "Timer trigger"
```

### 8.2 Port logic

Copy business logic from:

- `backend/functions/send-fcm-notifications/index.ts`
- `backend/functions/process-scheduled-notifications/index.ts`

Changes when porting Deno → Node:

| Deno (Edge) | Azure Functions (Node) |
|-------------|------------------------|
| `npm:@supabase/supabase-js@2` | `mssql` queries to Azure SQL |
| `npm:firebase-admin@12` | `firebase-admin` npm package |
| `Deno.env.get(...)` | `process.env` / App Settings |
| HTTP handler | `app.http(...)` or `app.timer(...)` |

### 8.3 Timer trigger (scheduled notifications)

`process-scheduled-notifications` — run every 5 minutes:

```typescript
// function.json or v4 model:
// schedule: "0 */5 * * * *"

export async function processScheduledNotifications(timer, context) {
  const pool = await getPool();
  const due = await pool.request().query(`
    SELECT * FROM dbo.scheduled_notifications
    WHERE sent_at IS NULL AND schedule_at <= SYSDATETIMEOFFSET()
  `);
  // ... load recipients, fcm_tokens, send via firebase-admin, update sent_at
}
```

### 8.4 HTTP trigger (send FCM)

```typescript
app.http('send-fcm-notifications', {
  methods: ['POST'],
  authLevel: 'function',  // require function key or switch to JWT
  handler: async (req) => { /* ... */ },
});
```

### 8.5 Azure Portal — Function App settings

Function App → **Settings** → **Environment variables**:

```
AZURE_SQL_SERVER=...
AZURE_SQL_DATABASE=SQL-Azure
AZURE_SQL_USER=...
AZURE_SQL_PASSWORD=...
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
```

### 8.6 Frontend change (SuperAdminDashboard)

**Before:**

```typescript
fetch(`${supabaseUrl}/functions/v1/process-scheduled-notifications`, { ... })
```

**After:**

```typescript
fetch(`${import.meta.env.VITE_FUNCTIONS_URL}/api/process-scheduled-notifications`, {
  method: 'POST',
  headers: { 'x-functions-key': import.meta.env.VITE_FUNCTIONS_KEY },
});
```

Or call through your main API: `POST /api/admin/trigger-scheduled-notifications` (API invokes Function internally — simpler for frontend).

---

## 9. Step 7 — Update the frontend

### 9.1 New environment variables

**Remove (after cutover):**

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_ANON_KEY=
```

**Add:**

```env
VITE_API_URL=http://localhost:3001
# Production:
# VITE_API_URL=https://hainan-api.azurewebsites.net

# Optional if frontend calls Functions directly:
# VITE_FUNCTIONS_URL=https://hainan-func.azurewebsites.net
# VITE_FUNCTIONS_KEY=...
```

### 9.2 Create `frontend/lib/apiClient.ts`

Central HTTP client with JWT:

```typescript
const API_URL = import.meta.env.VITE_API_URL ?? '';

function getToken() {
  return localStorage.getItem('hainan_access_token');
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export const authApi = {
  login: (email: string, password: string) =>
    api<{ token: string; user: UserProfile }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => api<{ user: UserProfile }>('/api/auth/me'),
  // ...
};
```

### 9.3 Replace `AuthContext.tsx`

| Replace | With |
|---------|------|
| `supabase.auth.getSession()` | Check `localStorage` token + `GET /api/auth/me` |
| `supabase.auth.signInWithPassword` | `authApi.login` → save `token` |
| `supabase.auth.signUp` | `authApi.signup` |
| `supabase.auth.signOut` | Remove token from localStorage |
| `fetchOrCreateProfile` via supabase | Profile returned from login/me |

Keep `localStorage` fallback for offline demo if you want — or remove once Azure is stable.

### 9.4 Replace table access (one file at a time)

**Pattern:**

```typescript
// Before
const { data, error } = await supabase.from('study_loan_recipients').select('*, guarantors(*)');

// After
const data = await api<LoanRecipient[]>('/api/loan-recipients?include=guarantors');
```

Suggested file order:

1. `AuthContext.tsx`
2. `SuperAdminDashboard.tsx` (largest)
3. `LoansPage.tsx`, `StudyLoanStatusPage.tsx`
4. `RecordLoanPaymentsPage.tsx`
5. `NotificationPanel.tsx`
6. `AssociationSelect.tsx`, `GuarantorRelationshipSelect.tsx`
7. `lib/fcmNotifications.ts`, `lib/pushNotifications.ts`

### 9.5 Feature flag (safe rollout)

During migration, support both backends:

```typescript
const useAzure = import.meta.env.VITE_API_URL;

if (useAzure) {
  return api('/api/loan-recipients');
} else if (isSupabaseConfigured()) {
  return supabase.from('study_loan_recipients').select('*');
}
```

Remove Supabase branch when fully cut over.

### 9.6 Remove Supabase dependency (final)

```powershell
cd frontend
npm uninstall @supabase/supabase-js
# Delete lib/supabase.ts when unused
```

---

## 10. Step 8 — Deploy to Azure

### 10.1 Backend API → Azure App Service

1. Portal → **Create** → **Web App**
2. Runtime: **Node 20 LTS**
3. Deployment: GitHub Actions or `az webapp up`
4. App Service → **Configuration** → Application settings (all `.env` vars)
5. Enable **HTTPS only**

### 10.2 Azure Functions → Function App

1. Portal → **Create** → **Function App**
2. Deploy `backend/azure-functions`
3. Set environment variables (SQL + Firebase)

### 10.3 Frontend → Static Web Apps or App Service

Build with production API URL:

```powershell
cd frontend
$env:VITE_API_URL="https://hainan-api.azurewebsites.net"
npm run build
# Deploy dist/ to Azure Static Web Apps or nginx container
```

### 10.4 CORS

API `CORS_ORIGIN` must include your frontend URL:

```env
CORS_ORIGIN=https://your-app.azurestaticapps.net
```

---

## 11. Environment variables reference

### Backend API (`backend/api/.env`)

| Variable | Purpose |
|----------|---------|
| `AZURE_SQL_*` | Database connection |
| `JWT_SECRET` | Sign auth tokens |
| `JWT_EXPIRES_IN` | Token lifetime |
| `AZURE_STORAGE_CONNECTION_STRING` | Blob uploads/downloads |
| `AZURE_STORAGE_CONTAINER` | `study-loan-documents` |
| `CORS_ORIGIN` | Frontend URL |
| `PORT` | Local port (3001) |

### Frontend (`frontend/.env`)

| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | Backend base URL |
| `VITE_OPENROUTER_API_KEY` | Unchanged (AI feature) |

### Azure Functions

Same SQL + `FIREBASE_SERVICE_ACCOUNT` JSON string.

---

## 12. Supabase → Azure mapping cheat sheet

| Supabase feature | Azure replacement |
|------------------|-------------------|
| `auth.users` | `dbo.users` + bcrypt + JWT |
| `public.profiles` | `dbo.profiles` via API |
| `supabase.from()` | REST + `mssql` |
| RLS policies | API middleware (`requireAuth`, `requireRole`) |
| Storage bucket | Blob container + SAS URLs |
| Edge Functions | Azure Functions (HTTP + Timer) |
| Realtime | Not used in this app — skip |
| Supabase Dashboard | SSMS + Azure Portal |

---

## Learning checklist

Use this to track your cutover:

- [ ] API runs locally, `/health/db` returns user count
- [ ] Login returns JWT; `/api/auth/me` works
- [ ] Super Admin can list loan recipients from Azure SQL
- [ ] Applicant can submit loan application
- [ ] File upload works via Blob SAS
- [ ] Signed download URL opens PDF
- [ ] Notifications list loads
- [ ] Azure Function sends test FCM
- [ ] Frontend uses only `VITE_API_URL`
- [ ] Production deployed; Supabase project read-only or decommissioned

---

## Related docs

- Data migration (done): `docs/SUPABASE_TO_AZURE_MIGRATION_GUIDE.md`
- Migration scripts: `database/azure-sql/migrate/`
- Azure SQL schema: `database/azure-sql/schema/001_create_tables.sql`
- Original Edge Function source: `backend/functions/`
